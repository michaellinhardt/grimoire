# Dashboard and Data Flow Review

## Critical Issues

### 1. Missing `batch_id` Foreign Key Validation in `events` Table Insert
- **Issue**: In `db.py` line 463-471, `create_event()` accepts `batch_id` as a required parameter but the events table has `FOREIGN KEY (story_id) REFERENCES stories(id)` and `FOREIGN KEY (command_id) REFERENCES commands(id)`, but no foreign key constraint on `batch_id` to `batches(id)`.
- **Why it's an error**: While `batch_id` is stored, there's no referential integrity for the batch. If a batch is deleted or doesn't exist, orphan events can exist with invalid `batch_id` values.
- **How to fix**: Add `FOREIGN KEY (batch_id) REFERENCES batches(id)` constraint to the `events` table schema.

### 2. Port Mismatch in Documentation vs Code
- **Issue**: The `README.md` states the server runs on port 8765 (lines 51, 55, 75), but `server.py` line 38 defines `PORT = 8080`.
- **Why it's an error**: Users following the documentation will attempt to connect to the wrong port, resulting in connection failures.
- **How to fix**: Update `README.md` to reflect the actual port 8080, or change `server.py` to use port 8765.

### 3. `get_events()` Missing `batch_id` Filtering for Initial WebSocket State
- **Issue**: In `server.py` line 253, `get_events(limit=50)` retrieves the 50 most recent events globally, not filtered by the active batch.
- **Why it's an error**: When a new WebSocket client connects, it receives events from potentially different/old batches, mixing historical data with current batch state. This causes confusion in the dashboard UI.
- **How to fix**: Use `get_events_by_batch(batch.id)` with limit when there's an active batch, or add a `batch_id` parameter to `get_events()`.

---

## High Priority Issues

### 4. Event Type Enum Missing from Schema Validation
- **Issue**: `server.py` lines 109-112 define context events (`CONTEXT_CREATE`, `CONTEXT_REFRESH`, `CONTEXT_COMPLETE`), but `EVENT_PAYLOAD_SCHEMAS` (lines 116-126) has no validation schemas for these event types.
- **Why it's an error**: Payload validation silently passes for unknown event types (line 141-143), meaning context events bypass all validation. Malformed payloads won't be caught.
- **How to fix**: Add validation schemas for context events to `EVENT_PAYLOAD_SCHEMAS`.

### 5. WebSocket `init` Event Payload Schema Inconsistency
- **Issue**: In `server.py` line 287, the initial state sent to clients has structure `{batch, events}`. The dashboard (line 4728-4735) expects `{batch, events}` but also accesses `payload.stories` which doesn't exist.
- **Why it's an error**: Accessing undefined properties in JavaScript returns `undefined` which may cause silent failures or unexpected behavior.
- **How to fix**: Either add `stories` to the initial state in `get_initial_state()`, or remove the reference in the frontend if not needed.

### 6. Missing Database Error Handling in `orchestrator.py` Event Logging
- **Issue**: In `orchestrator.py` line 888-898, `create_event()` is called but exceptions are not caught. Database failures will crash the orchestrator.
- **Why it's an error**: A transient SQLite lock or disk error would terminate the entire orchestration process, potentially leaving stories in inconsistent states.
- **How to fix**: Wrap `create_event()` calls in try/except blocks with appropriate error logging.

### 7. Race Condition in Batch Cleanup
- **Issue**: In `server.py` lines 656-669 (`cleanup_stale_batches`) and lines 526-543 (`orchestrator_stop_handler`), both can update the same batch status without coordination.
- **Why it's an error**: If the stop handler and startup cleanup run concurrently (e.g., quick server restart while stop is in progress), they may both try to update the batch, causing unpredictable state.
- **How to fix**: Add a database transaction or use a lock when cleaning up stale batches.

---

## Data Coherence Issues

### 8. Timestamp Unit Inconsistency
- **Issue**: The orchestrator (`orchestrator.py` line 921) uses `datetime.now().timestamp() * 1000` (milliseconds), while `db.py` uses `int(time.time())` (seconds) throughout. The frontend (line 4857-4859) has to detect and handle both formats.
- **Why it's an error**: This inconsistency creates confusion and requires defensive coding. If the frontend misdetects the format, timestamps display incorrectly.
- **How to fix**: Standardize on one format (recommend milliseconds for JavaScript compatibility) throughout all components.

### 9. Story Status Values Not Consistently Defined
- **Issue**: Different status values appear across components:
  - `sprint-status.yaml` parsing: `backlog`, `ready-for-dev`, `in-progress`, `review`, `done` (dashboard line 2984-2090)
  - `db.py` schema: `'in-progress'` as default (line 84)
  - `orchestrator.py`: `done`, `blocked` (line 963)
  - Dashboard CSS: also supports `optional` status (line 380-384)
- **Why it's an error**: There's no single source of truth for valid status values, leading to potential UI bugs (missing badge styles) or data integrity issues.
- **How to fix**: Define a shared enum/constant list of valid statuses and validate against it in all components.

### 10. Database `stories` Table `status` Field Not Validated
- **Issue**: The `update_story()` function in `db.py` (lines 272-301) accepts any string for `status` field without validation against valid status values.
- **Why it's an error**: Invalid status values can be stored in the database, which may cause UI rendering issues or break business logic.
- **How to fix**: Add status validation in `update_story()` or use a CHECK constraint in the schema.

### 11. Frontend Parses Different File Than Server Serves
- **Issue**: The dashboard fetches `sprint-runner.csv` (line 4454), but the server's `ALLOWED_DATA_FILES` whitelist (line 597-603) doesn't include it. The file `orchestrator.csv` is whitelisted instead.
- **Why it's an error**: The fetch will return 404, causing the activity log to never display data when accessed via the server.
- **How to fix**: Either add `sprint-runner.csv` to `ALLOWED_DATA_FILES` or change the dashboard to fetch `orchestrator.csv`.

---

## WebSocket Protocol Issues

### 12. Missing `pong` Event Type in Server Enum
- **Issue**: The server handles `ping` messages from clients and responds with `pong` (line 297-298), but `pong` is not defined in the `EventType` enum.
- **Why it's an error**: While the code works, it's inconsistent with the typed event system. Other developers may not realize `pong` is a valid server response.
- **How to fix**: Add `PONG = "pong"` to the `EventType` enum.

### 13. Missing `batch:warning` Event Type
- **Issue**: `orchestrator.py` line 201-207 emits `batch:warning` events, but this event type is not defined in `server.py`'s `EventType` enum or `EVENT_PAYLOAD_SCHEMAS`.
- **Why it's an error**: The event bypasses validation and isn't documented, making it easy to miss in frontend handling.
- **How to fix**: Add `BATCH_WARNING = "batch:warning"` to `EventType` and define its payload schema.

### 14. Heartbeat Task Does Nothing Useful
- **Issue**: The `heartbeat_task()` function in `server.py` (lines 323-360) iterates over connections but the actual work (line 350-353) is just `pass` with a comment that aiohttp handles it automatically.
- **Why it's an error**: This is dead code that runs every 30 seconds consuming CPU cycles without providing any benefit.
- **How to fix**: Either remove the heartbeat task entirely (since aiohttp handles heartbeats), or implement actual heartbeat logic if custom behavior is needed.

### 15. WebSocket Reconnection Doesn't Restore UI State
- **Issue**: When WebSocket reconnects (dashboard line 4707-4711), it calls `connectSprintWebSocket()` which sends initial state, but if the orchestrator state changed during disconnection, the UI may show stale data.
- **Why it's an error**: The `init` event sends cached data from `get_initial_state()` which may be outdated if the disconnection lasted through state changes.
- **How to fix**: Add a `last_event_id` parameter to the reconnection flow to request missed events, or force a full UI refresh on reconnection.

---

## Frontend-Backend Mismatch Issues

### 16. Event Log Entry Format Mismatch
- **Issue**: The frontend `addLogEntry()` (line 4845) expects events to have either `payload` object (WebSocket format) or flat fields like `story_key`, `command` (database format). However, `get_events()` returns raw database rows which have `story_key`, `command` directly.
- **Why it's an error**: The format detection logic works but is fragile. Any new event source must match one of these two formats exactly.
- **How to fix**: Normalize event format in `get_initial_state()` to always use the WebSocket format (`{type, payload}`).

### 17. Story Badge Update Uses Unsanitized Selector
- **Issue**: In `updateStoryBadge()` (line 4991), the story key is used directly in a CSS selector without escaping: `document.querySelector(\`.sprint-story-badge[data-story="${storyKey}"]\`)`.
- **Why it's an error**: If `storyKey` contains special characters (like quotes or brackets), the selector will fail or potentially cause injection issues.
- **How to fix**: Use `CSS.escape(storyKey)` as done elsewhere in the codebase (e.g., line 3953).

### 18. Database Events Missing `type` Field
- **Issue**: The `events` table schema (line 103-118 in `db.py`) stores `status` but not the WebSocket event `type`. The frontend event handler (line 4723) switches on `type`, but database events don't have this field.
- **Why it's an error**: When loading historical events from the database into the log, they can't be properly categorized by event type.
- **How to fix**: Add an `event_type` column to the `events` table, or derive the type from the `command` and `status` combination.

### 19. Progress Bar Calculation Issue for Unlimited Mode
- **Issue**: In `updateProgress()` (line 4970-4981), when `maxCycles` is 0 (unlimited mode), the progress bar stays at 0% forever because `(currentCycle / 0) * 100` produces `Infinity` which is then clamped.
- **Why it's an error**: Users running in unlimited mode see no progress feedback even though cycles are completing.
- **How to fix**: Show a different UI for unlimited mode (e.g., just the cycle count, or an indeterminate progress indicator).

---

## Recommendations

### Short-term Fixes (High Impact, Low Effort)
1. Fix the port mismatch in documentation (Issue #2)
2. Add `sprint-runner.csv` to allowed files or update dashboard fetch target (Issue #11)
3. Sanitize the story badge selector (Issue #17)
4. Remove or properly implement the heartbeat task (Issue #14)

### Medium-term Improvements
1. Standardize timestamp format across all components to milliseconds (Issue #8)
2. Create a shared status enum/constant file imported by all components (Issue #9)
3. Add proper validation schemas for all event types (Issue #4)
4. Normalize database events to WebSocket format in `get_initial_state()` (Issue #16)

### Long-term Architectural Improvements
1. Add an event_type column to the database and implement proper event sourcing
2. Implement missed-event recovery for WebSocket reconnections (Issue #15)
3. Add database migrations for schema changes instead of relying on `CREATE TABLE IF NOT EXISTS`
4. Consider using a message queue for event delivery to ensure no events are lost

### Testing Recommendations
1. Add integration tests that verify frontend and backend agree on event formats
2. Add tests for WebSocket reconnection scenarios
3. Add tests for concurrent batch operations (stop during startup, etc.)
4. Add validation that all CSS status classes have corresponding badge styles
