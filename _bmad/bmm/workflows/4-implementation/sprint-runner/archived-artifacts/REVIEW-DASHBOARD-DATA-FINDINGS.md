# Review: Dashboard & Data Flow

## Summary

The Sprint Runner dashboard implementation is well-structured with a clear separation between server (Python/aiohttp) and frontend (modular JavaScript). After thorough review, I identified several issues ranging from data consistency problems to missing API endpoints and potential race conditions. The most critical issues involve mismatches between WebSocket event schemas and frontend expectations, missing API endpoints referenced in frontend code, and potential race conditions in state management.

---

## Errors Found

### Error 1: Missing API Endpoints for Sprint/Orchestrator Data

- **Location**: `frontend/js/main.js:299-329`
- **Issue**: The frontend's `tryAutoLoad()` function fetches from `/api/sprint-status` and `/api/orchestrator-status`, but these endpoints are not defined in the server.
- **Why it's an error**: The server only provides:
  - `/api/orchestrator/start` (POST)
  - `/api/orchestrator/stop` (POST)
  - `/api/orchestrator/status` (GET)
  - `/api/batches` (GET)
  - `/api/batches/{batch_id}` (GET)

  The `/api/sprint-status` and `/api/orchestrator-status` endpoints don't exist, causing 404 errors on page load and preventing the dashboard from displaying sprint data.
- **Suggested fix**: Either:
  1. Add these endpoints to `server.py` that return sprint-status.yaml and orchestrator activity data, OR
  2. Update the frontend to fetch `/sprint-status.yaml` directly and parse YAML client-side

### Error 2: WebSocket Event Schema Mismatch - batch:warning

- **Location**: `server/server.py:108` vs `frontend/js/websocket.js:392-396`
- **Issue**: The server schema for `batch:warning` requires `{batch_id, message, warning_type}`, but the orchestrator emits `{batch_id, warning}` (line 217-220 in orchestrator.py).
- **Why it's an error**: The payload validation will emit warnings to stderr for every batch warning event. The frontend handles `payload.message` but the orchestrator sends `payload.warning`.
- **Suggested fix**: Standardize on one key name. Either:
  1. Change orchestrator.py line 217 from `"warning": "..."` to `"message": "..."`, OR
  2. Update frontend to check both `payload.message || payload.warning`

### Error 3: Timestamp Unit Inconsistency in batch:end

- **Location**: `server/orchestrator.py:244-249`
- **Issue**: When updating the batch on completion, `ended_at=int(time.time())` passes seconds, but the database schema and all other timestamps use milliseconds.
- **Why it's an error**: The database stores all timestamps in milliseconds (per README and db.py usage). This causes duration calculations to be incorrect by a factor of 1000.
- **Suggested fix**: Change line 247 to `ended_at=int(time.time() * 1000)`

### Error 4: Missing cycle_number and story_keys in normalize_db_event_to_ws

- **Location**: `server/server.py:276-286`
- **Issue**: The `normalize_db_event_to_ws()` function handles `cycle:` events but only extracts `cycle_number`, not `story_keys` for `cycle:start` or `completed_stories` for `cycle:end`. These are required fields per the schema (lines 110-111).
- **Why it's an error**: Events restored from the database on WebSocket reconnect will have incomplete payloads, failing validation and potentially breaking frontend state restoration.
- **Suggested fix**: Add extraction logic for these fields from the database event record, or ensure the events table stores these additional fields.

### Error 5: Database Events Table Missing Columns for Full Event Reconstruction

- **Location**: `server/db.py:113-129` (events table schema)
- **Issue**: The events table doesn't store:
  - `cycle_number` (for cycle events)
  - `story_keys` (for cycle:start)
  - `completed_stories` (for cycle:end)
  - `context_type` (for context events)
  - `max_cycles`, `batch_mode` (for batch:start)
  - `old_status`, `new_status` (for story:status)

- **Why it's an error**: When `get_initial_state()` reconstructs events from the database, these fields are missing, causing incomplete events to be sent to reconnecting clients.
- **Suggested fix**: Either:
  1. Add a `payload_json` TEXT column to store the full event payload, OR
  2. Add individual columns for each event type's required fields

### Error 6: Race Condition in emit_event

- **Location**: `server/server.py:230-234`
- **Issue**: `emit_event()` uses `asyncio.create_task(broadcast(event))` without awaiting, and catches `RuntimeError` for no event loop. This can cause events to be dropped silently if the event loop is shutting down or overwhelmed.
- **Why it's an error**: During high-frequency event emission (multiple concurrent stories), events may be lost without any indication, leading to inconsistent frontend state.
- **Suggested fix**: Consider using a thread-safe queue for events or ensuring the caller awaits the broadcast in critical paths. At minimum, log when events cannot be sent.

### Error 7: Frontend handleWebSocketEvent Missing batch:warning handler for warning_type

- **Location**: `frontend/js/websocket.js:392-396`
- **Issue**: The `batch:warning` handler uses `payload.message` but the server schema requires `warning_type` which indicates the category of warning. The frontend ignores this field.
- **Why it's an error**: Different warning types might need different UI treatment (display color, icon, urgency).
- **Suggested fix**: Update the handler to check `payload.warning_type` and adjust the toast type/styling accordingly.

### Error 8: Stale State After Past Batch View Return

- **Location**: `frontend/js/sidebar.js:305-335`
- **Issue**: `returnToLiveView()` restores the original HTML from `dataset.originalHtml` and calls render functions, but doesn't re-establish timer state or active operations from the current WebSocket state.
- **Why it's an error**: If a user views a past batch while a sprint is running, returning to live view won't show currently active operations or running timers until new events arrive.
- **Suggested fix**: After restoring HTML, also call:
  1. `restoreActiveOperationsFromEvents()` with current events
  2. Re-start any timers for active operations in `sprintRunState.activeOperations`

### Error 9: Settings Validation Mismatch Between Frontend and Backend

- **Location**: `frontend/js/settings.js:18-31` vs `server/settings.py:99-109`
- **Issue**: Frontend validates `server_port` must be >= 1024, but backend only validates >= 1. This inconsistency could confuse users or allow invalid states.
- **Why it's an error**: Users could be prevented from setting ports 1-1023 via UI but these would work via direct API calls, creating inconsistent behavior.
- **Suggested fix**: Align validation rules - either both allow 1-65535, or both require 1024-65535 (privileged ports require root).

---

## Warnings (Non-Critical Issues)

### Warning 1: Memory Leak Risk in Reconnect Timer

- **Location**: `frontend/js/websocket.js:100-114`
- **Issue**: `scheduleWsReconnect()` creates timers but only checks `if (sprintRunState.wsReconnectTimer) return`. If the timer fires and sets itself to null (line 111) but another call races in, duplicate connections could be created.
- **Impact**: Low - exponential backoff limits this, but could cause brief duplicate connections.

### Warning 2: Log Entry Limit Could Cause Information Loss

- **Location**: `frontend/js/batch.js:161-164`
- **Issue**: Log entries are limited to 500 with oldest removed. For long-running batches, early events are lost.
- **Impact**: Users lose visibility into early batch events during extended runs.
- **Suggestion**: Consider pagination or persistence to localStorage for event history.

### Warning 3: No Timeout on Background Task Refresh

- **Location**: `server/orchestrator.py:576-610`
- **Issue**: `_run_background_context_refresh()` has no timeout. If the subagent hangs, the background task record stays in "running" state indefinitely.
- **Impact**: Stale background task records could accumulate in the database.
- **Suggestion**: Add a timeout wrapper with `asyncio.wait_for()`.

### Warning 4: Header Controls Not Synced on Initial Load

- **Location**: `frontend/js/controls.js:284-309`
- **Issue**: Header batch size and run-all checkbox sync is set up via event listeners, but initial values aren't synced from the main form on page load if localStorage values differ.
- **Impact**: Header controls might show different values than the main Sprint Run tab controls.

### Warning 5: CSS File Too Large for Single Request

- **Location**: `frontend/css/styles.css`
- **Issue**: The CSS file exceeds 30k tokens and couldn't be fully read. Large single-file CSS can slow initial page load.
- **Suggestion**: Consider splitting into critical and non-critical CSS, or use CSS custom properties more extensively to reduce repetition.

### Warning 6: No Debouncing on Settings Input Validation

- **Location**: `frontend/js/settings.js:481-493`
- **Issue**: Every keystroke triggers validation and marks state as dirty. This could cause performance issues on slower devices.
- **Suggestion**: Debounce the input handler by 150-300ms.

### Warning 7: Potential XSS in renderPastBatchView

- **Location**: `frontend/js/sidebar.js:235-288`
- **Issue**: While most fields use `escapeHtml()`, the batch header HTML uses string interpolation for status class: `past-batch-header__status--${batch.status}`. If status contained special characters, it could break CSS class parsing (though not XSS since it's a class name).
- **Impact**: Malformed batch status could break styling.
- **Suggestion**: Sanitize status for CSS class usage with `normalizeStatusForClass()`.

---

## Positive Observations

1. **Clean Module Separation**: The frontend JavaScript is well-organized into 9 focused modules with clear dependencies documented in comments.

2. **Comprehensive WebSocket Reconnection**: The exponential backoff reconnection strategy with event queueing is well-implemented.

3. **Security Considerations**: HTML escaping via `escapeHtml()` and `escapeJsString()` utilities are consistently used throughout the frontend to prevent XSS.

4. **Settings Persistence**: The settings system with JSON file storage and API validation is robust and follows good practices.

5. **Database Design**: Foreign keys, indexes, and field whitelists for SQL injection prevention show good security practices in `db.py`.

6. **Event Type System**: The `EventType` enum and payload schema validation provides structure and helps catch malformed events.

7. **CORS Headers**: Proper CORS headers are set on API responses for cross-origin access.

8. **Graceful Shutdown**: The server properly cleans up stale batches on startup and closes WebSocket connections on shutdown.

9. **Animation System**: The animation helpers in `operations.js` properly check for `prefers-reduced-motion` accessibility preference.

10. **Comprehensive README**: The dashboard README provides excellent documentation of the API, database schema, and event types.
