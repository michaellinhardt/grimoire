# Implementation Plan: Dashboard & Data Flow Fixes

## Overview

This plan addresses 9 errors identified in the Sprint Runner dashboard review. The fixes are organized into 4 phases covering: API endpoint additions, WebSocket schema alignment, timestamp consistency, database schema extension, and frontend state management improvements.

**Issues addressed:**
- Error 1: Missing API endpoints `/api/sprint-status` and `/api/orchestrator-status`
- Error 2: WebSocket `batch:warning` schema mismatch (`warning` vs `message`)
- Error 3: Timestamp unit inconsistency (`seconds` vs `milliseconds`)
- Error 4: Missing fields in `normalize_db_event_to_ws()`
- Error 5: Database events table missing columns for full event reconstruction
- Error 6: Race condition in `emit_event()`
- Error 7: Frontend missing `warning_type` handling in `batch:warning`
- Error 8: Stale state after returning from past batch view
- Error 9: Settings validation mismatch (frontend vs backend `server_port`)

---

## Prerequisites

1. **Backup database** before schema migration (Phase 2)
2. **Test environment** ready for validation
3. **No active sprint runs** during database migration

---

## Phase 1: API Endpoint & Schema Alignment

### Step 1.1: Add Missing `/api/sprint-status` Endpoint

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/server.py`
- **Change**: Add new handler function and route
- **Location**: After `orchestrator_status_handler` (around line 656)

**Add this handler function:**

```python
async def sprint_status_handler(request: web.Request) -> web.Response:
    """
    Get sprint status from sprint-status.yaml.

    GET /api/sprint-status

    Returns the parsed YAML content as JSON.
    """
    try:
        status_path = ARTIFACTS_DIR / "sprint-status.yaml"
        if not status_path.exists():
            return web.json_response(
                {"error": "sprint-status.yaml not found"},
                status=404,
                headers={"Access-Control-Allow-Origin": "*"},
            )

        import yaml
        with open(status_path, "r") as f:
            data = yaml.safe_load(f)

        return web.json_response(
            data,
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        return web.Response(status=500, text=f"Failed to read sprint status: {e}")
```

**Add route in `create_app()` (around line 1019):**

```python
    # Sprint status API
    app.router.add_get("/api/sprint-status", sprint_status_handler)
    app.router.add_options("/api/sprint-status", cors_preflight_handler)
```

**Add import at top of file (if not present):**

```python
import yaml
```

### Step 1.2: Add Missing `/api/orchestrator-status` Endpoint

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/server.py`
- **Change**: Add new handler function and route
- **Location**: After `sprint_status_handler`

**Add this handler function:**

```python
async def orchestrator_activity_handler(request: web.Request) -> web.Response:
    """
    Get orchestrator activity log.

    GET /api/orchestrator-status

    Returns parsed orchestrator.md activity log as JSON.
    """
    try:
        activity_path = ARTIFACTS_DIR / "orchestrator.md"
        if not activity_path.exists():
            return web.json_response(
                {"activities": [], "raw": ""},
                headers={"Access-Control-Allow-Origin": "*"},
            )

        content = activity_path.read_text(encoding="utf-8")

        # Parse basic structure - extract log entries
        # Format: each line is a log entry after the header
        lines = content.strip().split('\n')
        activities = []
        for line in lines:
            if line.strip() and not line.startswith('#'):
                activities.append(line.strip())

        return web.json_response(
            {"activities": activities, "raw": content},
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        return web.Response(status=500, text=f"Failed to read orchestrator status: {e}")
```

**Add route in `create_app()` (after sprint-status route):**

```python
    app.router.add_get("/api/orchestrator-status", orchestrator_activity_handler)
    app.router.add_options("/api/orchestrator-status", cors_preflight_handler)
```

### Step 1.3: Fix `batch:warning` Schema Mismatch in Orchestrator

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/orchestrator.py`
- **Change**: Rename `warning` key to `message` and add `warning_type`
- **Location**: Lines 213-220

**Before:**

```python
            self.emit_event(
                "batch:warning",
                {
                    "batch_id": self.current_batch_id,
                    "warning": "Project context not available - proceeding without context",
                },
            )
```

**After:**

```python
            self.emit_event(
                "batch:warning",
                {
                    "batch_id": self.current_batch_id,
                    "message": "Project context not available - proceeding without context",
                    "warning_type": "context_unavailable",
                },
            )
```

### Step 1.4: Fix Timestamp Unit in `orchestrator.py` batch end

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/orchestrator.py`
- **Change**: Convert `time.time()` to milliseconds
- **Location**: Line 246

**Before:**

```python
        update_batch(
            batch_id=self.current_batch_id,
            ended_at=int(time.time()),
            cycles_completed=self.cycles_completed,
            status="stopped" if self.stop_requested else "completed",
        )
```

**After:**

```python
        update_batch(
            batch_id=self.current_batch_id,
            ended_at=int(time.time() * 1000),
            cycles_completed=self.cycles_completed,
            status="stopped" if self.stop_requested else "completed",
        )
```

### Step 1.5: Fix Timestamp Unit in `server.py` stop handler

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/server.py`
- **Change**: Convert `time.time()` to milliseconds
- **Location**: Lines 603-607 (orchestrator_stop_handler)

**Before:**

```python
                update_batch(
                    batch_id=batch['id'],
                    status='stopped',
                    ended_at=int(time.time())
                )
```

**After:**

```python
                update_batch(
                    batch_id=batch['id'],
                    status='stopped',
                    ended_at=int(time.time() * 1000)
                )
```

### Step 1.6: Fix Timestamp Unit in `server.py` cleanup_stale_batches

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/server.py`
- **Change**: Convert `time.time()` to milliseconds
- **Location**: Lines 915-920 (cleanup_stale_batches)

**Before:**

```python
            update_batch(
                batch_id=batch['id'],
                status='stopped',
                ended_at=int(time.time())
            )
```

**After:**

```python
            update_batch(
                batch_id=batch['id'],
                status='stopped',
                ended_at=int(time.time() * 1000)
            )
```

---

## Phase 2: Database Schema Enhancement

### Step 2.1: Add `payload_json` Column to Events Table

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/db.py`
- **Change**: Add `payload_json` TEXT column to store complete event payloads
- **Location**: Lines 112-129 (events table schema)

**Before:**

```python
-- Events log (E1-S1: added event_type column, FK on batch_id)
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_id INTEGER,
    command_id INTEGER,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    epic_id TEXT NOT NULL,
    story_key TEXT NOT NULL,
    command TEXT NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (command_id) REFERENCES commands(id)
);
```

**After:**

```python
-- Events log (E1-S1: added event_type column, FK on batch_id)
-- E1-S2: added payload_json for complete event reconstruction
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_id INTEGER,
    command_id INTEGER,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    epic_id TEXT NOT NULL,
    story_key TEXT NOT NULL,
    command TEXT NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    payload_json TEXT,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (command_id) REFERENCES commands(id)
);
```

### Step 2.2: Update `create_event` Function to Accept Payload

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/db.py`
- **Change**: Add optional `payload` parameter and store as JSON
- **Location**: Lines 453-492

**Before:**

```python
def create_event(
    batch_id: int,
    story_id: Optional[int],
    command_id: Optional[int],
    event_type: str,
    epic_id: str,
    story_key: str,
    command: str,
    task_id: str,
    status: str,
    message: str
) -> int:
```

**After:**

```python
def create_event(
    batch_id: int,
    story_id: Optional[int],
    command_id: Optional[int],
    event_type: str,
    epic_id: str,
    story_key: str,
    command: str,
    task_id: str,
    status: str,
    message: str,
    payload: Optional[dict] = None
) -> int:
    """
    Log an event with timestamp=now.

    Args:
        batch_id: Parent batch ID
        story_id: Associated story ID (optional)
        command_id: Associated command ID (optional)
        event_type: Type of event (e.g., 'command:start', 'command:end', 'command:progress')
        epic_id: Epic identifier
        story_key: Story identifier
        command: Command name
        task_id: Task phase
        status: Event status (start, end, progress)
        message: Event message
        payload: Full event payload for reconstruction (optional)

    Returns:
        The new event ID
    """
    payload_json = json.dumps(payload) if payload else None

    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO events
            (batch_id, story_id, command_id, timestamp, event_type, epic_id, story_key, command, task_id, status, message, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (batch_id, story_id, command_id, int(time.time() * 1000), event_type, epic_id, story_key, command, task_id, status, message, payload_json)
        )
        return cursor.lastrowid  # type: ignore
```

**Add import at top of file:**

```python
import json
```

### Step 2.3: Update `normalize_db_event_to_ws` to Use `payload_json`

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/server.py`
- **Change**: Prefer `payload_json` if available, fall back to field extraction
- **Location**: Lines 242-296

**Before:**

```python
def normalize_db_event_to_ws(event: dict[str, Any]) -> dict[str, Any]:
    """..."""
    event_type = event.get("event_type", "")

    # Build payload from DB fields based on event type
    payload: dict[str, Any] = {}

    # Common fields for command events
    if event_type.startswith("command:"):
        # ... existing extraction logic
```

**After:**

```python
def normalize_db_event_to_ws(event: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize a database event record to WebSocket event format.

    DB events have flat structure with fields like:
    - id, batch_id, story_id, command_id, timestamp, event_type,
    - epic_id, story_key, command, task_id, status, message, payload_json

    WebSocket events have structure:
    - type: event type string
    - timestamp: milliseconds since epoch
    - payload: dict with event-specific fields

    Args:
        event: Database event record as dict

    Returns:
        WebSocket-formatted event dict
    """
    event_type = event.get("event_type", "")

    # Prefer stored payload_json if available (complete reconstruction)
    if event.get("payload_json"):
        try:
            payload = json.loads(event["payload_json"])
            return {
                "type": event_type,
                "timestamp": event.get("timestamp", 0),
                "payload": payload,
            }
        except json.JSONDecodeError:
            pass  # Fall through to manual extraction

    # Build payload from DB fields based on event type (legacy fallback)
    payload: dict[str, Any] = {}

    # Common fields for command events
    if event_type.startswith("command:"):
        payload["story_key"] = event.get("story_key", "")
        payload["command"] = event.get("command", "")
        payload["task_id"] = event.get("task_id", "")
        if event_type == "command:progress":
            payload["message"] = event.get("message", "")
        elif event_type == "command:end":
            payload["status"] = event.get("status", "")
    elif event_type.startswith("batch:"):
        payload["batch_id"] = event.get("batch_id")
        if event_type == "batch:end":
            payload["cycles_completed"] = event.get("cycles_completed", 0)
            payload["status"] = event.get("status", "")
        elif event_type == "batch:warning":
            payload["message"] = event.get("message", "")
            payload["warning_type"] = "unknown"
    elif event_type.startswith("cycle:"):
        payload["cycle_number"] = event.get("cycle_number", 0)
        # Note: story_keys and completed_stories not available in legacy events
    elif event_type.startswith("story:"):
        payload["story_key"] = event.get("story_key", "")
        payload["old_status"] = event.get("old_status", "")
        payload["new_status"] = event.get("new_status", "")
    elif event_type.startswith("context:"):
        payload["story_key"] = event.get("story_key", "")
        payload["context_type"] = event.get("context_type", "")

    # Include any message if present
    if "message" in event and event["message"]:
        payload["message"] = event["message"]

    return {
        "type": event_type,
        "timestamp": event.get("timestamp", 0),
        "payload": payload,
    }
```

---

## Phase 3: Emit Event Robustness & Orchestrator Updates

### Step 3.1: Add Logging to `emit_event` for Dropped Events

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/server.py`
- **Change**: Log when events cannot be sent
- **Location**: Lines 230-234

**Before:**

```python
    try:
        asyncio.create_task(broadcast(event))
    except RuntimeError:
        # No event loop running - ignore
        pass
```

**After:**

```python
    try:
        asyncio.create_task(broadcast(event))
    except RuntimeError as e:
        # No event loop running - log for debugging
        print(f"Warning: Event '{event_type}' not sent (no event loop): {e}", file=sys.stderr)
```

### Step 3.2: Update Orchestrator `emit_event` Calls to Store Payload

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/orchestrator.py`
- **Change**: Update `create_event` calls to include full payload
- **Location**: Multiple locations in orchestrator.py

**Example change in `_handle_stream_event` (lines 901-931):**

**Before:**

```python
            create_event(
                batch_id=self.current_batch_id,
                story_id=None,
                command_id=None,
                event_type=event_type,
                epic_id=task_info["epic_id"],
                story_key=task_info["story_id"],
                command=task_info["command"],
                task_id=task_info["task_id"],
                status=task_info["status"],
                message=task_info["message"],
            )
```

**After:**

```python
            ws_payload = {
                "story_key": task_info["story_id"],
                "command": task_info["command"],
                "task_id": task_info["task_id"],
                "message": task_info["message"],
            }
            if event_type == "command:end":
                ws_payload["status"] = task_info["status"]

            create_event(
                batch_id=self.current_batch_id,
                story_id=None,
                command_id=None,
                event_type=event_type,
                epic_id=task_info["epic_id"],
                story_key=task_info["story_id"],
                command=task_info["command"],
                task_id=task_info["task_id"],
                status=task_info["status"],
                message=task_info["message"],
                payload=ws_payload,
            )
```

---

## Phase 4: Frontend Fixes

### Step 4.1: Update `batch:warning` Handler for `warning_type`

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/frontend/js/websocket.js`
- **Change**: Handle both `message` and `warning` keys, use `warning_type` for styling
- **Location**: Lines 392-396

**Before:**

```javascript
        case 'batch:warning':
            // Handle batch warning events
            addLogEntry({ type, payload, timestamp }, 'warning');
            showToast(payload.message || 'Warning occurred', 'warning', 'Warning');
            break;
```

**After:**

```javascript
        case 'batch:warning':
            // Handle batch warning events
            // Support both 'message' (schema) and 'warning' (legacy) keys
            const warningMessage = payload.message || payload.warning || 'Warning occurred';
            const warningType = payload.warning_type || 'general';

            addLogEntry({ type, payload, timestamp }, 'warning');

            // Adjust toast type based on warning_type
            const toastType = warningType === 'context_unavailable' ? 'info' : 'warning';
            showToast(warningMessage, toastType, `Warning: ${warningType}`);
            break;
```

### Step 4.2: Fix Stale State After Returning From Past Batch View

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/frontend/js/sidebar.js`
- **Change**: Restore active operations and timers after returning to live view
- **Location**: Lines 305-335

**Before:**

```javascript
function returnToLiveView() {
    batchHistoryState.selectedBatchId = null;
    batchHistoryState.viewingPastBatch = false;

    // Update sidebar selection
    document.querySelectorAll('.batch-sidebar__item').forEach(el => {
        el.classList.remove('batch-sidebar__item--selected');
    });

    // Restore original dashboard content
    const dashboardContent = document.getElementById('dashboardContent');
    if (dashboardContent && dashboardContent.dataset.originalHtml) {
        dashboardContent.innerHTML = dashboardContent.dataset.originalHtml;
        delete dashboardContent.dataset.originalHtml;

        // Re-render current data
        if (state.sprintData) {
            renderSummaryCards(state.sprintData);
            renderEpicBoard(state.sprintData);
            renderStoryTable(state.sprintData,
                document.getElementById('epicFilter')?.value || 'all',
                document.getElementById('statusFilter')?.value || 'all');
            restoreExpandedEpics();
        }
        if (state.orchestratorData) {
            renderActivityLog(state.orchestratorData);
            restoreExpandedActivities();
        }
        updateTabCounts(state.sprintData, state.orchestratorData);
    }
}
```

**After:**

```javascript
function returnToLiveView() {
    batchHistoryState.selectedBatchId = null;
    batchHistoryState.viewingPastBatch = false;

    // Update sidebar selection
    document.querySelectorAll('.batch-sidebar__item').forEach(el => {
        el.classList.remove('batch-sidebar__item--selected');
    });

    // Restore original dashboard content
    const dashboardContent = document.getElementById('dashboardContent');
    if (dashboardContent && dashboardContent.dataset.originalHtml) {
        dashboardContent.innerHTML = dashboardContent.dataset.originalHtml;
        delete dashboardContent.dataset.originalHtml;

        // Re-render current data
        if (state.sprintData) {
            renderSummaryCards(state.sprintData);
            renderEpicBoard(state.sprintData);
            renderStoryTable(state.sprintData,
                document.getElementById('epicFilter')?.value || 'all',
                document.getElementById('statusFilter')?.value || 'all');
            restoreExpandedEpics();
        }
        if (state.orchestratorData) {
            renderActivityLog(state.orchestratorData);
            restoreExpandedActivities();
        }
        updateTabCounts(state.sprintData, state.orchestratorData);

        // Restore active operations and timers from current WebSocket state
        if (sprintRunState.isRunning) {
            // Re-render active operations display
            renderActiveOperationsDisplay();

            // Restart timers for any active operations
            sprintRunState.activeOperations.forEach((operation, taskId) => {
                // Only restart timer if not already running
                if (!sprintRunState.runningTimers.has(taskId)) {
                    startCommandTimer(taskId, operation.startTime);
                }
            });

            // Update sprint UI to reflect running state
            updateSprintUI();
            showProgressSection(true);
        }
    }
}
```

### Step 4.3: Align Settings Validation (Frontend)

- **File**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/frontend/js/settings.js`
- **Change**: Update `server_port` validation to match backend (1-65535)
- **Location**: Lines 15-30

**Before:**

```javascript
    server_port: {
        id: 'settingServerPort',
        type: 'number',
        defaultValue: 8080,
        min: 1024,
        max: 65535,
        label: 'Server Port',
        hint: 'HTTP server port (requires restart)',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1024 || num > 65535) {
                return 'Port must be between 1024 and 65535';
            }
            return null;
        }
    },
```

**After:**

```javascript
    server_port: {
        id: 'settingServerPort',
        type: 'number',
        defaultValue: 8080,
        min: 1,
        max: 65535,
        label: 'Server Port',
        hint: 'HTTP server port (requires restart). Ports 1-1023 require root privileges.',
        validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1 || num > 65535) {
                return 'Port must be between 1 and 65535';
            }
            return null;
        }
    },
```

---

## Testing Plan

### Phase 1 Tests

1. **API Endpoints**
   - `curl http://localhost:8080/api/sprint-status` - Should return JSON with sprint data or 404
   - `curl http://localhost:8080/api/orchestrator-status` - Should return JSON with activities

2. **WebSocket Schema**
   - Start a batch without project context
   - Verify `batch:warning` event has `message` and `warning_type` fields
   - Check browser console for no validation warnings

3. **Timestamp Consistency**
   - Create a batch, let it complete
   - Query database: `SELECT started_at, ended_at FROM batches ORDER BY id DESC LIMIT 1`
   - Verify both are in milliseconds (13+ digits)
   - Verify `ended_at - started_at` gives reasonable duration in ms

### Phase 2 Tests

1. **Database Migration**
   - After migration, verify column exists: `PRAGMA table_info(events)`
   - Create test event with payload
   - Query: `SELECT payload_json FROM events WHERE id = ?`

2. **Event Reconstruction**
   - Start batch, run cycle, stop batch
   - Disconnect WebSocket, reconnect
   - Verify `init` event contains complete payloads with `story_keys`, `completed_stories`

### Phase 3 Tests

1. **Emit Event Logging**
   - Force event loop closure during event emission
   - Check stderr for warning message

### Phase 4 Tests

1. **batch:warning Handler**
   - Trigger context unavailable warning
   - Verify toast shows correct type (`info` not `warning`)
   - Verify title includes `warning_type`

2. **Live View State Restoration**
   - Start a batch
   - While running, click on a past batch
   - Click "Back to Live"
   - Verify active operations display is visible
   - Verify timers are running

3. **Settings Validation**
   - Set port to 80 via frontend form
   - Should now be accepted (was rejected before)
   - Verify hint mentions root privileges

---

## Risk Assessment

### Low Risk
- **Phase 1 API endpoints**: Additive change, no existing code modified
- **Phase 4 frontend fixes**: UI-only changes, easily reversible

### Medium Risk
- **Phase 1 timestamp fixes**: Could affect duration calculations if partially applied. **Mitigation**: Apply all timestamp fixes together
- **Phase 3 emit_event logging**: Minor, only adds logging

### Higher Risk
- **Phase 2 database schema**: Schema change on live database. **Mitigation**:
  1. SQLite `ALTER TABLE ADD COLUMN` is safe (no data loss)
  2. New column is nullable, backward compatible
  3. Test on copy of production DB first
  4. Keep backup before migration

### Rollback Strategy

1. **API endpoints**: Remove routes from `create_app()`, delete handler functions
2. **Database**: Column cannot be easily removed in SQLite; however, it's nullable and ignored by old code
3. **Frontend**: Revert JS file changes via git

---

## Implementation Order

1. **Phase 1** - Can be done incrementally, low interdependency
2. **Phase 2** - Do after Phase 1 timestamp fixes are in place
3. **Phase 3** - Do after Phase 2 (depends on `create_event` signature change)
4. **Phase 4** - Can be done in parallel with backend phases

**Estimated effort**: 2-3 hours for implementation, 1 hour for testing

---

## Review Amendments

**Reviewed**: 2026-01-24 by Technical Lead

### Line Number Corrections

The following line numbers have been verified and corrected where needed:

1. **Step 1.1**: `orchestrator_status_handler` is at line 628-656, not "around line 656". Route additions should go in `create_app()` at line 1008+, not 1019.

2. **Step 1.3**: The `batch:warning` emission is at lines 213-219 (verified correct).

3. **Step 1.4**: The `update_batch` call for batch end is at lines 244-249 (verified correct).

4. **Step 1.5**: Lines 603-607 verified correct for `orchestrator_stop_handler`.

5. **Step 1.6**: `cleanup_stale_batches` is at lines 909-922, with `update_batch` at lines 915-919. The plan reference of 915-920 is acceptable.

6. **Step 2.2**: `create_event` function at lines 453-492 verified.

7. **Step 2.3**: `normalize_db_event_to_ws` at lines 242-296 verified.

### Code Snippet Corrections

**Step 3.2** - The "Before" code snippet in the plan does not match actual code. The actual `_handle_stream_event` in orchestrator.py (lines 901-931) already emits status in the ws_payload only for `command:end`, but the plan's proposed payload structure differs from current implementation.

**Current actual code (lines 921-931):**
```python
            # Emit WebSocket event
            ws_type = "command:start" if task_info["status"] == "start" else "command:end"
            self.emit_event(
                ws_type,
                {
                    "story_key": task_info["story_id"],
                    "command": task_info["command"],
                    "task_id": task_info["task_id"],
                    "message": task_info["message"],
                },
            )
```

The plan's fix should update the `create_event` call (lines 908-919) to include the `payload` parameter, passing the same payload dict used for WebSocket emission.

### Missing Import Verifications

- **yaml import**: Confirmed NOT present in server.py - must be added as stated
- **json import**: Confirmed NOT present in db.py - must be added as stated
- **json import for server.py Step 2.3**: Already present (line 27) - no addition needed

### Gap Analysis: Error 4 Coverage

The plan addresses Error 4 (missing fields in `normalize_db_event_to_ws`) by storing `payload_json`. However, for **legacy events** without `payload_json`, the fallback logic in Step 2.3 still lacks:

- `story_keys` extraction for `cycle:start` events
- `completed_stories` extraction for `cycle:end` events
- `old_status` / `new_status` extraction for `story:status` events

**Recommendation**: Add a note that legacy events (before this fix) will have incomplete payloads on reconnection. This is acceptable since:
1. Legacy events are historical only
2. New events will have complete payloads via `payload_json`
3. Full schema migration is not worth the complexity for this edge case

### Frontend Function Availability (Step 4.2)

Verified that all referenced functions exist and are accessible:
- `renderActiveOperationsDisplay()` - operations.js:67
- `startCommandTimer()` - operations.js:16
- `updateSprintUI()` - controls.js:79
- `showProgressSection()` - controls.js:156
- `sprintRunState.activeOperations` - main.js (global state)
- `sprintRunState.runningTimers` - main.js (global state)
- `sprintRunState.isRunning` - main.js (global state)

All functions are in the global scope and accessible from sidebar.js.

### Additional Recommendations

1. **Database Migration Script**: Consider adding a standalone migration script in case users have existing databases. The schema change via `ALTER TABLE ADD COLUMN` is safe, but `init_db()` only runs `CREATE TABLE IF NOT EXISTS`, which won't add the column to existing tables.

   Add migration check:
   ```python
   def migrate_db() -> None:
       """Apply schema migrations for existing databases."""
       with get_connection() as conn:
           # Check if payload_json column exists
           cursor = conn.execute("PRAGMA table_info(events)")
           columns = [row[1] for row in cursor.fetchall()]
           if 'payload_json' not in columns:
               conn.execute("ALTER TABLE events ADD COLUMN payload_json TEXT")
               print("Migrated events table: added payload_json column")
   ```

2. **Testing Enhancement**: Add a test case for verifying millisecond timestamps across the entire flow (batch create -> batch end -> query -> verify 13-digit values).

---

## Review Status: APPROVED WITH AMENDMENTS

The implementation plan adequately addresses all 9 CRITICAL and HIGH priority issues from the review findings. The amendments above clarify line number discrepancies and add important context for implementation. The plan is approved for execution with the noted corrections.

---

## Coherence Review

**Reviewed Against**: `PLAN-PROMPTS-SCRIPTS.md`
**Review Date**: 2026-01-24
**Reviewer**: Technical Lead (Claude Opus 4.5)

### Conflicts Found: NONE

The two plans operate on completely different layers of the Sprint Runner system:
- **PROMPTS-SCRIPTS**: XML instruction files, YAML taxonomy, shell script paths
- **This plan (DASHBOARD-DATA)**: Python server code, JavaScript frontend, SQLite database

No code changes overlap between the two plans.

### Data Mismatches Found: NONE

The logging system interaction is compatible:
- PROMPTS-SCRIPTS fixes the log script PATH (`{{log_script}}` -> hardcoded path to `sprint-log.sh`)
- This plan addresses how dashboard events are stored/transmitted (database schema, WebSocket)

The shell log script writes to `sprint-runner.csv`, which is independent of the dashboard's database-driven event system. These are parallel logging mechanisms with no interdependency.

### Ordering Dependencies

**Recommended Order**: Execute PLAN-PROMPTS-SCRIPTS first, then this plan

**Rationale**: PROMPTS-SCRIPTS fixes the ability for subagent commands to log properly via the shell script. Having that working first ensures complete observability during testing of the dashboard fixes in this plan.

**Strict Dependency**: NO - Both plans can be executed independently without breaking each other. The recommended order is for operational convenience, not technical necessity.

### Shared File Modifications: NONE

Files modified by PROMPTS-SCRIPTS:
- `commands/sprint-dev-story/instructions.xml`
- `commands/sprint-story-review/instructions.xml`
- `commands/sprint-tech-spec-review/instructions.xml`
- `commands/sprint-code-review/instructions.xml`
- `commands/sprint-commit/instructions.xml`
- `task-taxonomy.yaml`

Files modified by this plan:
- `dashboard/server/server.py`
- `dashboard/server/orchestrator.py`
- `dashboard/server/db.py`
- `dashboard/frontend/js/websocket.js`
- `dashboard/frontend/js/sidebar.js`
- `dashboard/frontend/js/settings.js`

No overlap detected.

### Integration Points

| Integration Point | PROMPTS-SCRIPTS | This Plan | Status |
|-------------------|-----------------|-----------|--------|
| Log script invocation | Fixes path resolution | N/A | Independent |
| CSV log output | Output target | N/A | Independent |
| Orchestrator events | N/A | Fixes schema/storage | Independent |
| WebSocket events | N/A | Fixes payload format | Independent |

### Conclusion

**Both plans can be executed together safely.** There are no conflicts, no data mismatches, and no shared file modifications. The plans address orthogonal concerns within the Sprint Runner system.

**Execution Strategy**: Either sequential (PROMPTS-SCRIPTS first recommended) or parallel implementation by different developers is acceptable.
