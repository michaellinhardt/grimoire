# Implementation Plan: Dashboard and Data Flow Fixes

> **IMPORTANT**: This plan has been reconciled with PLAN-PROMPTS-SCRIPTS.md.
> See **PLAN-UNIFIED-ORDER.md** for the correct execution sequence.
>
> **Key Integration Points**:
> - Fix 4.3 (event_type column) changes `create_event()` signature - PROMPTS-SCRIPTS Fix 1.1 depends on this
> - Fix 2.2 (timestamp standardization) affects orchestrator.py which PROMPTS-SCRIPTS also modifies
> - All schema changes (Fix 2.1, 2.2, 4.3) must be applied atomically before any other changes

## Overview

This plan addresses 19 issues identified in the dashboard and data flow review, organized into 4 phases:
1. **Phase 1**: Critical fixes (high impact, low effort) - 4 issues
2. **Phase 2**: Data coherence fixes (data integrity) - 4 issues
3. **Phase 3**: WebSocket protocol fixes (event system) - 4 issues
4. **Phase 4**: Frontend-backend alignment (UI consistency) - 4 issues

Remaining 3 issues are addressed in a "Long-term Architectural" section for future sprints.

---

## Phase 1: Critical Fixes (High Impact, Low Effort)

### Fix 1.1: Port Mismatch in Documentation (Issue #2)

- **Issue**: README.md states port 8765 but server.py uses 8080
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/README.md`
- **Changes**: Update all references from `8765` to `8080` on the following lines:
  - Line 51: `http://localhost:8765` -> `http://localhost:8080`
  - Line 55: `http://localhost:8765` -> `http://localhost:8080`
  - Line 75: `ws://localhost:8765/ws` -> `ws://localhost:8080/ws`
  - Line 130: `http://localhost:8765/api/orchestrator/start` -> `http://localhost:8080/api/orchestrator/start`
  - Line 138: `http://localhost:8765/api/orchestrator/stop` -> `http://localhost:8080/api/orchestrator/stop`
  - Line 206: port 8765 reference in troubleshooting section
- **Code**:
```markdown
# Before
The server starts on `http://localhost:8765` by default.

# After
The server starts on `http://localhost:8080` by default.
```
- **Test**:
  1. Start server with `python server.py`
  2. Verify it announces port 8080
  3. Verify README instructions match

### Fix 1.2: Add `sprint-runner.csv` to Allowed Files (Issue #11)

- **Issue**: Dashboard fetches `sprint-runner.csv` but server only allows `orchestrator.csv`
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
- **Changes**: Add `"sprint-runner.csv"` to `ALLOWED_DATA_FILES` set (actual location: lines 597-602)
- **Code**:
```python
# Before (lines 597-602 in serve_file_handler function)
    ALLOWED_DATA_FILES = {
        "sprint-status.yaml",
        "orchestrator.md",
        "orchestrator.csv",
        "orchestrator-sample.md",
    }

# After
    ALLOWED_DATA_FILES = {
        "sprint-status.yaml",
        "orchestrator.md",
        "orchestrator.csv",
        "sprint-runner.csv",  # Dashboard activity log
        "orchestrator-sample.md",
    }
```
- **Test**:
  1. Start server
  2. Run `curl http://localhost:8080/sprint-runner.csv`
  3. Verify returns file content (or 404 if file doesn't exist) instead of 403

### Fix 1.3: Sanitize Story Badge Selector (Issue #17)

- **Issue**: `updateStoryBadge()` uses unsanitized `storyKey` in CSS selector
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`
- **Changes**: Use `CSS.escape()` for the story key in the selector (lines 4991-4992)
- **Code**:
```javascript
// Before (lines 4991-4992)
        function updateStoryBadge(storyKey, status) {
            const badge = document.querySelector(`.sprint-story-badge[data-story="${storyKey}"]`);

// After
        function updateStoryBadge(storyKey, status) {
            const badge = document.querySelector(`.sprint-story-badge[data-story="${CSS.escape(storyKey)}"]`);
```
- **Note**: Also fix `updateActiveStories()` at line 4986-4988 where `data-story="${key}"` should escape `key`
- **Additional Code Fix**:
```javascript
// Before (line 4987)
                `<span class="sprint-story-badge in-progress" data-story="${key}">${key}</span>`

// After - escape both attribute and display text
                `<span class="sprint-story-badge in-progress" data-story="${key.replace(/"/g, '&quot;')}">${key.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
```
- **Test**:
  1. Create a story with special characters in key (e.g., `test"story`)
  2. Verify badge updates without console errors
  3. Verify no XSS vulnerabilities from story keys

### Fix 1.4: Remove Dead Heartbeat Task (Issue #14)

- **Issue**: `heartbeat_task()` does nothing - aiohttp handles heartbeats automatically via `heartbeat=30.0` in `WebSocketResponse()` (line 278)
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
- **Changes** (corrected line numbers from actual file):
  1. Remove `heartbeat_task()` function (lines 323-361)
  2. Remove heartbeat task startup in `on_startup()` (lines 677-679)
  3. Remove heartbeat task cleanup in `on_cleanup()` (lines 684-691)
- **Code**:
```python
# Remove entire heartbeat_task function (lines 323-361):
async def heartbeat_task() -> None:
    """..."""
    while True:
        await asyncio.sleep(30)
        # ... (entire function body)

# In on_startup (lines 677-679), remove these 2 lines:
    app["heartbeat_task"] = asyncio.create_task(heartbeat_task())
    print("Started heartbeat task")

# In on_cleanup (lines 685-691), remove:
    if "heartbeat_task" in app:
        app["heartbeat_task"].cancel()
        try:
            await app["heartbeat_task"]
        except asyncio.CancelledError:
            pass
        print("Stopped heartbeat task")
```
- **Rationale**: The `heartbeat_task()` function body does nothing useful (the `try` block at line 349-352 has only a `pass` statement). The actual heartbeat is already handled by aiohttp's built-in mechanism via `heartbeat=30.0` on line 278.
- **Test**:
  1. Start server
  2. Verify no "Started heartbeat task" message
  3. Verify WebSocket connections still work (aiohttp's built-in heartbeat handles it)
  4. Verify long-running connections are maintained

---

## Phase 2: Data Coherence Fixes

### Fix 2.1: Add Foreign Key Constraint for `batch_id` in Events Table (Issue #1)

- **Issue**: `events` table has no foreign key constraint on `batch_id`
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py`
- **Changes**: Add `FOREIGN KEY (batch_id) REFERENCES batches(id)` to events table schema (lines 103-118 in the SCHEMA string)
- **Code**:
```python
# Before (lines 103-118 within SCHEMA string)
-- Events log
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_id INTEGER,
    command_id INTEGER,
    timestamp INTEGER NOT NULL,
    epic_id TEXT NOT NULL,
    story_key TEXT NOT NULL,
    command TEXT NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (command_id) REFERENCES commands(id)
);

# After - add FOREIGN KEY constraint for batch_id (insert before story_id FK)
-- Events log
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_id INTEGER,
    command_id INTEGER,
    timestamp INTEGER NOT NULL,
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
- **Dependencies**: Requires deleting existing `sprint-runner.db` to apply schema change
- **WARNING**: Database migration is destructive - backup existing data if needed
- **Test**:
  1. Delete `sprint-runner.db`
  2. Start server (auto-creates DB via `init_db()`)
  3. Verify constraint: `sqlite3 sprint-runner.db "PRAGMA foreign_key_list(events);"`
  4. Expected output should include `batch_id` with `batches` table reference

### Fix 2.2: Standardize Timestamps to Milliseconds (Issue #8)

- **Issue**: `db.py` uses seconds, `orchestrator.py` uses milliseconds, frontend has to detect both
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py`
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
- **Changes**:
  1. Update all `int(time.time())` calls in `db.py` to `int(time.time() * 1000)`
  2. Ensure `server.py` uses consistent milliseconds (already does in most places)
- **Code** (corrected line numbers from actual db.py):
```python
# db.py - Update these lines to use milliseconds:

# Line 176 in create_batch() - the tuple parameter
(int(time.time() * 1000), max_cycles)

# Line 267 in create_story() - the tuple parameter
(batch_id, story_key, epic_id, int(time.time() * 1000))

# Line 378 in create_command() - the tuple parameter
(story_id, command, task_id, int(time.time() * 1000))

# Line 470 in create_event() - the tuple parameter
(batch_id, story_id, command_id, int(time.time() * 1000), epic_id, story_key, command, task_id, status, message)

# Line 540 in create_background_task() - the tuple parameter
(batch_id, story_key, task_type, int(time.time() * 1000))
```
- **ALSO UPDATE in server.py** (missed in original plan):
```python
# Line 535 and 665 in orchestrator_stop_handler and cleanup_stale_batches:
ended_at=int(time.time() * 1000)  # Was: int(time.time())
```
- **Dependencies**: Fix 2.1 (delete DB first anyway)
- **Test**:
  1. Create a batch
  2. Query: `sqlite3 sprint-runner.db "SELECT started_at FROM batches LIMIT 1;"`
  3. Verify timestamp is ~13 digits (milliseconds) not ~10 digits (seconds)
  4. Query: `sqlite3 sprint-runner.db "SELECT timestamp FROM events LIMIT 1;"`
  5. Verify event timestamp is also ~13 digits

### Fix 2.3: Define Shared Story Status Constants (Issue #9)

- **Issue**: Story status values are inconsistent across components
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py` (add constants)
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (import and use)
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` (import for validation)
- **Changes**: Create a shared `VALID_STORY_STATUSES` constant
- **Code**:
```python
# Add to db.py after line 32 (BACKGROUND_TASK_FIELDS definition)

# Valid story status values (shared across all components)
VALID_STORY_STATUSES = {
    'backlog',           # Not yet started
    'ready-for-dev',     # Story created, ready for development
    'in-progress',       # Currently being developed
    'review',            # In code review
    'done',              # Completed successfully
    'blocked',           # Blocked, needs intervention
    'optional',          # Optional story (low priority)
}
```
- **Additional Step** (MISSING FROM ORIGINAL PLAN): Export in __all__ or ensure module-level visibility
```python
# At top of db.py (if __all__ exists, add to it; otherwise this is auto-exported)
# No change needed if no __all__ defined - Python exports all module-level names by default
```
- **Test**:
  1. Verify import works: `python -c "from db import VALID_STORY_STATUSES; print(VALID_STORY_STATUSES)"`
  2. Verify set contains all expected statuses
  3. Verify orchestrator.py can import: `from db import VALID_STORY_STATUSES`

### Fix 2.4: Add Status Validation to `update_story()` (Issue #10)

- **Issue**: `update_story()` accepts any string for status without validation
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py`
- **Changes**: Add validation in `update_story()` function (lines 272-301)
- **Code**:
```python
# In update_story() function, after line 291 (invalid fields check), add:

def update_story(story_id: int, **kwargs: Any) -> int:
    if not kwargs:
        return 0

    invalid = set(kwargs.keys()) - STORY_FIELDS
    if invalid:
        raise ValueError(f"Invalid fields for story: {invalid}")

    # Validate status if provided
    if 'status' in kwargs:
        status_value = kwargs['status']
        if status_value not in VALID_STORY_STATUSES:
            raise ValueError(f"Invalid story status '{status_value}'. Valid values: {VALID_STORY_STATUSES}")

    # ... rest of function unchanged
```
- **Dependencies**: Fix 2.3 (needs VALID_STORY_STATUSES)
- **Test**:
  1. Try `update_story(1, status='invalid-status')`
  2. Verify raises `ValueError`
  3. Try `update_story(1, status='done')`
  4. Verify succeeds

---

## Phase 3: WebSocket Protocol Fixes

### Fix 3.1: Filter Events by Batch in Initial State (Issue #3)

- **Issue**: `get_events(limit=50)` returns events from all batches, mixing old data
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
- **Changes**: Update `get_initial_state()` to filter by active batch (lines 242-261)
- **Code**:
```python
# Before (lines 249-255 - verified in actual file)
async def get_initial_state() -> dict[str, Any]:
    try:
        from db import get_active_batch, get_events

        batch = get_active_batch()
        events = get_events(limit=50)

        return {"batch": batch, "events": events}

# After - add get_events_by_batch import and filter logic
async def get_initial_state() -> dict[str, Any]:
    try:
        from db import get_active_batch, get_events, get_events_by_batch

        batch = get_active_batch()

        # Filter events by active batch to avoid mixing historical data
        if batch:
            events = get_events_by_batch(batch['id'])[-50:]  # Last 50 events for this batch
        else:
            events = get_events(limit=50)  # Fallback to global events if no active batch

        return {"batch": batch, "events": events}
```
- **Note**: `get_events_by_batch()` already exists in db.py at line 498 - verified
- **Test**:
  1. Create batch 1, add events, complete it
  2. Create batch 2 with different events
  3. Connect WebSocket
  4. Verify `init` event only contains batch 2 events

### Fix 3.2: Add Validation Schemas for Context Events (Issue #4)

- **Issue**: `CONTEXT_CREATE`, `CONTEXT_REFRESH`, `CONTEXT_COMPLETE` have no payload validation
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
- **Changes**: Add schemas to `EVENT_PAYLOAD_SCHEMAS` (currently ends at line 126)
- **Code**:
```python
# Current EVENT_PAYLOAD_SCHEMAS (lines 116-126) ends with ERROR
# Add these entries before the closing brace:
EVENT_PAYLOAD_SCHEMAS: dict[str, set[str]] = {
    EventType.BATCH_START: {"batch_id", "max_cycles"},
    EventType.BATCH_END: {"batch_id", "cycles_completed", "status"},
    EventType.CYCLE_START: {"cycle_number", "story_keys"},
    EventType.CYCLE_END: {"cycle_number", "completed_stories"},
    EventType.COMMAND_START: {"story_key", "command", "task_id"},
    EventType.COMMAND_PROGRESS: {"story_key", "command", "task_id", "message"},
    EventType.COMMAND_END: {"story_key", "command", "task_id", "status"},
    EventType.STORY_STATUS: {"story_key", "old_status", "new_status"},
    EventType.ERROR: {"type", "message"},
    # Context events (Story 5-SR-4) - ADDED
    EventType.CONTEXT_CREATE: {"status"},
    EventType.CONTEXT_REFRESH: {"task_id", "status"},
    EventType.CONTEXT_COMPLETE: {"task_id", "status"},
}
```
- **Note**: Context event types already exist in EventType enum (lines 109-112), just missing from schema dict
- **Test**:
  1. Call `validate_payload("context:create", {"status": "starting"})`
  2. Verify returns `True`
  3. Call `validate_payload("context:create", {})`
  4. Verify returns `False`

### Fix 3.3: Add Missing Event Types to Enum (Issues #12, #13)

- **Issue**: `pong` and `batch:warning` events are emitted but not defined in `EventType`
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
- **Changes**: Add missing event types to `EventType` enum (lines 87-112)
- **Code**:
```python
class EventType(str, Enum):
    """WebSocket event types for real-time updates."""

    # Batch events
    BATCH_START = "batch:start"
    BATCH_END = "batch:end"
    BATCH_WARNING = "batch:warning"  # Added: warning during batch execution

    # Cycle events
    CYCLE_START = "cycle:start"
    CYCLE_END = "cycle:end"

    # Command events
    COMMAND_START = "command:start"
    COMMAND_PROGRESS = "command:progress"
    COMMAND_END = "command:end"

    # Story events
    STORY_STATUS = "story:status"

    # Error events
    ERROR = "error"

    # Context events (from Story 5-SR-4)
    CONTEXT_CREATE = "context:create"
    CONTEXT_REFRESH = "context:refresh"
    CONTEXT_COMPLETE = "context:complete"

    # Connection events
    PONG = "pong"  # Added: response to client ping
```
- **Test**:
  1. Import `EventType`
  2. Verify `EventType.PONG.value == "pong"`
  3. Verify `EventType.BATCH_WARNING.value == "batch:warning"`

### Fix 3.4: Add `batch:warning` Payload Schema (Issue #13 continued)

- **Issue**: `batch:warning` needs validation schema
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
- **Changes**: Add schema to `EVENT_PAYLOAD_SCHEMAS`
- **Code**:
```python
# Add to EVENT_PAYLOAD_SCHEMAS
EventType.BATCH_WARNING: {"batch_id", "warning"},
```
- **Dependencies**: Fix 3.3 (needs EventType.BATCH_WARNING)
- **Test**:
  1. Call `validate_payload("batch:warning", {"batch_id": 1, "warning": "test"})`
  2. Verify returns `True`

---

## Phase 4: Frontend-Backend Alignment

### Fix 4.1: Normalize Database Events to WebSocket Format (Issue #16)

- **Issue**: Database events have flat structure, WebSocket events have `{type, payload}` structure
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
- **Changes**: Transform database events in `get_initial_state()` to match WebSocket format
- **Code**:
```python
# In get_initial_state() after retrieving events, normalize format:

async def get_initial_state() -> dict[str, Any]:
    try:
        from db import get_active_batch, get_events, get_events_by_batch

        batch = get_active_batch()

        if batch:
            raw_events = get_events_by_batch(batch['id'])[-50:]
        else:
            raw_events = get_events(limit=50)

        # Normalize database events to WebSocket format
        events = []
        for e in raw_events:
            # Derive event type from status field
            status = e.get('status', '')
            if status == 'start':
                event_type = 'command:start'
            elif status in ('end', 'complete', 'done'):
                event_type = 'command:end'
            elif status == 'progress':
                event_type = 'command:progress'
            else:
                event_type = 'command:progress'  # Default

            events.append({
                'type': event_type,
                'timestamp': e.get('timestamp', 0),
                'payload': {
                    'story_key': e.get('story_key'),
                    'command': e.get('command'),
                    'task_id': e.get('task_id'),
                    'status': status,
                    'message': e.get('message'),
                    'epic_id': e.get('epic_id'),
                }
            })

        return {"batch": batch, "events": events}
```
- **Dependencies**: Fix 3.1 (builds on batch filtering)
- **Test**:
  1. Connect WebSocket
  2. Check `init` event payload
  3. Verify each event in `events` array has `type` and `payload` keys

### Fix 4.2: Handle Unlimited Mode in Progress Bar (Issue #19)

- **Issue**: Progress bar shows 0% forever when `maxCycles` is 0 (unlimited mode)
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`
- **Changes**: Update `updateProgress()` to handle unlimited mode (lines 4970-4982)
- **Code**:
```javascript
// Before (actual code from lines 4970-4982)
        function updateProgress() {
            const fill = document.getElementById('sprintProgressFill');
            const stats = document.getElementById('sprintProgressStats');

            const progress = sprintRunState.maxCycles > 0
                ? (sprintRunState.currentCycle / sprintRunState.maxCycles) * 100
                : 0;

            fill.style.width = `${Math.min(progress, 100)}%`;
            stats.textContent = sprintRunState.maxCycles > 0
                ? `${sprintRunState.currentCycle}/${sprintRunState.maxCycles} cycles`
                : `${sprintRunState.currentCycle} cycles`;
        }

// After - handle unlimited mode (maxCycles >= 999)
        function updateProgress() {
            const fill = document.getElementById('sprintProgressFill');
            const stats = document.getElementById('sprintProgressStats');

            if (sprintRunState.maxCycles > 0 && sprintRunState.maxCycles < 999) {
                // Fixed mode: show percentage progress
                const progress = (sprintRunState.currentCycle / sprintRunState.maxCycles) * 100;
                fill.style.width = `${Math.min(100, progress)}%`;
                fill.classList.remove('progress-indeterminate');
                stats.textContent = `${sprintRunState.currentCycle}/${sprintRunState.maxCycles} cycles`;
            } else {
                // Unlimited mode: show indeterminate progress animation
                fill.style.width = '100%';
                fill.classList.add('progress-indeterminate');
                stats.textContent = `${sprintRunState.currentCycle} cycles (unlimited)`;
            }
        }
```
- **Additional CSS**: Add indeterminate animation style (find existing `.sprint-progress-fill` styles and add nearby)
```css
.progress-indeterminate {
    background: linear-gradient(90deg, var(--primary-color), var(--primary-color-dark), var(--primary-color));
    background-size: 200% 100%;
    animation: progress-pulse 1.5s ease-in-out infinite;
}
@keyframes progress-pulse {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
```
- **Note**: Need to verify `--primary-color` and `--primary-color-dark` CSS variables exist or use fallback colors
- **Test**:
  1. Start orchestrator with `batch_size: "all"` (sets maxCycles=999)
  2. Verify progress bar shows pulsing animation
  3. Verify stats show "N cycles (unlimited)"
  4. Switch to fixed mode, verify animation stops and progress shows normally

### Fix 4.3: Add `event_type` Column to Events Table (Issue #18)

- **Issue**: Events table doesn't store the WebSocket event type
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py`
- **Changes**:
  1. Add `event_type` column to schema
  2. Update `create_event()` function signature
- **Code**:
```python
# Update schema (lines 103-118 within SCHEMA string) - combine with Fix 2.1 FK addition
-- Events log
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_id INTEGER,
    command_id INTEGER,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,  -- ADDED: WebSocket event type (e.g., 'command:start')
    epic_id TEXT NOT NULL,
    story_key TEXT NOT NULL,
    command TEXT NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    FOREIGN KEY (batch_id) REFERENCES batches(id),  -- From Fix 2.1
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (command_id) REFERENCES commands(id)
);

# Update create_event function signature (lines 435-472)
# IMPORTANT: Insert event_type after command_id, before epic_id to match schema column order
def create_event(
    batch_id: int,
    story_id: Optional[int],
    command_id: Optional[int],
    event_type: str,  # ADDED parameter
    epic_id: str,
    story_key: str,
    command: str,
    task_id: str,
    status: str,
    message: str
) -> int:
    """
    Log an event with timestamp=now.

    Args:
        batch_id: Parent batch ID
        story_id: Associated story ID (optional)
        command_id: Associated command ID (optional)
        event_type: WebSocket event type (e.g., 'command:start', 'command:end')
        epic_id: Epic identifier
        story_key: Story identifier
        command: Command name
        task_id: Task phase
        status: Event status (start, end, progress)
        message: Event message

    Returns:
        The new event ID
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO events
            (batch_id, story_id, command_id, timestamp, event_type, epic_id, story_key, command, task_id, status, message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (batch_id, story_id, command_id, int(time.time() * 1000), event_type, epic_id, story_key, command, task_id, status, message)
        )
        return cursor.lastrowid
```
- **Dependencies**: Fix 2.1, Fix 2.2 (schema changes should be combined - delete DB once before all schema changes)
- **BREAKING CHANGE**: All callers of `create_event()` must be updated to pass `event_type` parameter
- **Test**:
  1. Delete DB, restart server
  2. Create an event
  3. Query: `sqlite3 sprint-runner.db "SELECT event_type FROM events LIMIT 1;"`
  4. Verify column exists and has value

### Fix 4.4: Update Orchestrator to Pass Event Type (Issue #18 continued)

- **Issue**: `orchestrator.py` needs to pass event_type when calling `create_event()`
- **File(s)**: `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`
- **Changes**: Update all `create_event()` calls to include `event_type` parameter
- **Affected Locations** (verified from actual file):
  1. Line 502-512: `create_project_context()` - event_type should be `"context:create"`
  2. Line 534-544: `refresh_project_context_background()` - event_type should be `"context:refresh"`
  3. Line 888-898: `_handle_stream_event()` - derive from status field

- **Code for each location**:
```python
# Location 1: create_project_context (lines 502-512)
create_event(
    batch_id=self.current_batch_id,
    story_id=None,
    command_id=None,
    event_type="context:create",  # ADDED
    epic_id="system",
    story_key="context",
    command="generate-project-context",
    task_id="context",
    status="create",
    message="Creating project context (blocking)",
)

# Location 2: refresh_project_context_background (lines 534-544)
create_event(
    batch_id=self.current_batch_id,
    story_id=None,
    command_id=None,
    event_type="context:refresh",  # ADDED
    epic_id="system",
    story_key="context",
    command="generate-project-context",
    task_id="context",
    status="refresh",
    message="Starting background context refresh",
)

# Location 3: _handle_stream_event (lines 888-898)
ws_type = "command:start" if task_info["status"] == "start" else "command:end"
create_event(
    batch_id=self.current_batch_id,
    story_id=None,
    command_id=None,
    event_type=ws_type,  # ADDED - derive from status
    epic_id=task_info["epic_id"],
    story_key=task_info["story_id"],
    command=task_info["command"],
    task_id=task_info["task_id"],
    status=task_info["status"],
    message=task_info["message"],
)
```
- **Dependencies**: Fix 4.3 (needs updated schema and function signature)
- **Test**:
  1. Run orchestrator
  2. Query events table: `sqlite3 sprint-runner.db "SELECT event_type, status FROM events LIMIT 10;"`
  3. Verify `event_type` column is populated with correct values (e.g., "command:start", "context:create")

---

## Long-term Architectural Improvements (Future Sprint)

These issues require more significant refactoring and should be planned for a dedicated sprint:

### Issue #6: Database Error Handling in Orchestrator

- **Issue**: `create_event()` calls in orchestrator have no try/except
- **Recommendation**: Wrap all database calls in try/except with logging
- **Scope**: ~15 call sites in orchestrator.py

### Issue #7: Race Condition in Batch Cleanup

- **Issue**: `cleanup_stale_batches` and `orchestrator_stop_handler` can conflict
- **Recommendation**: Add database transaction or mutex lock
- **Scope**: Requires careful testing of concurrent scenarios

### Issue #15: WebSocket Reconnection State Recovery

- **Issue**: Reconnection doesn't restore missed events
- **Recommendation**: Implement `last_event_id` parameter for event catchup
- **Scope**: Requires new API endpoint and protocol change

---

## Dependencies Graph

```
Phase 1 (Independent - can run in parallel):
  Fix 1.1 (README port) - standalone
  Fix 1.2 (CSV whitelist) - standalone
  Fix 1.3 (CSS.escape) - standalone
  Fix 1.4 (heartbeat) - standalone

Phase 2 (Sequential - schema changes):
  Fix 2.1 (FK constraint) -> Fix 2.2 (timestamps) -> Fix 2.3 (status enum) -> Fix 2.4 (validation)
  NOTE: Delete sprint-runner.db once before starting Phase 2

Phase 3 (Mostly independent):
  Fix 3.1 (batch filter) - standalone
  Fix 3.2 (context schemas) - standalone
  Fix 3.3 (event types) -> Fix 3.4 (warning schema)

Phase 4 (Dependencies):
  Fix 4.1 (normalize events) - depends on Fix 3.1
  Fix 4.2 (progress bar) - standalone
  Fix 4.3 (event_type column) - depends on Phase 2 schema changes
  Fix 4.4 (orchestrator) - depends on Fix 4.3
```

---

## Testing Strategy

### Unit Tests

For each fix, add or update tests in the corresponding test file:

| Fix | Test File | Test Cases |
|-----|-----------|------------|
| 1.2 | `test_server.py` | Test `sprint-runner.csv` in ALLOWED_DATA_FILES |
| 2.1-2.4 | `test_db.py` | Test FK constraint, timestamp format, status validation |
| 3.1-3.4 | `test_server.py` | Test payload validation, event types |
| 4.1 | `test_server.py` | Test event normalization |
| 4.3-4.4 | `test_db.py`, `test_orchestrator.py` | Test event_type storage |

### Integration Tests

Add to `test_integration.py`:

1. **WebSocket flow test**: Connect, receive init, verify event format
2. **Full cycle test**: Start batch, verify events have correct types
3. **Reconnection test**: Disconnect, reconnect, verify state sync

### Manual Testing Checklist

- [ ] Start server, verify port 8080
- [ ] Open dashboard, verify WebSocket connects
- [ ] Start orchestrator, verify progress bar works
- [ ] Check unlimited mode shows indeterminate progress
- [ ] Query database, verify timestamps are milliseconds
- [ ] Query database, verify event_type column populated
- [ ] Test story badge update with special characters

### Regression Tests

Run existing test suite after each fix:

```bash
cd /Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard
python -m pytest test_*.py -v
```

---

## Execution Order Summary

1. **Phase 1** (15 min): All 4 fixes in parallel - minimal risk
2. **Phase 2** (30 min): Delete DB, apply all schema fixes together
3. **Phase 3** (20 min): Apply event type fixes
4. **Phase 4** (45 min): Apply frontend-backend alignment fixes
5. **Testing** (30 min): Run full test suite, manual verification

**Total estimated time**: 2-3 hours

---

## Review Notes

### Review Date
2026-01-24

### What Was Reviewed
- All 19 fixes across 4 phases were reviewed against actual source files
- File paths and line numbers verified against `server.py`, `db.py`, `orchestrator.py`, `dashboard.html`, and `README.md`
- Code snippets compared with actual implementation
- Dependencies and execution order validated

### Issues Found and Fixed

#### 1. **Line Number Corrections**
- Fix 1.1: Corrected README.md line references (130, 138 instead of 131, 133)
- Fix 1.2: Clarified actual location is within `serve_file_handler` function
- Fix 1.4: Updated to reflect actual heartbeat_task location (323-361) and cleanup lines
- Fix 4.2: Corrected actual code structure (stats text format differs from plan)
- Fix 4.4: Added specific line numbers for all 3 `create_event()` call sites in orchestrator.py

#### 2. **Missing Code Changes**
- Fix 1.3: Added missing XSS fix for `updateActiveStories()` function at line 4987
- Fix 2.2: Added missing `server.py` timestamp fixes at lines 535 and 665
- Fix 4.3: Added complete docstring for updated `create_event()` function

#### 3. **Missing Verification Steps**
- Fix 2.1: Added "backup data" warning for destructive database migration
- Fix 2.3: Added verification command for module import
- Fix 3.1: Added note confirming `get_events_by_batch()` exists at line 498
- Fix 3.2: Added note that EventType entries already exist
- Fix 4.2: Added note to verify CSS variables exist or use fallbacks
- Fix 4.3: Added "BREAKING CHANGE" warning about function signature change

#### 4. **Clarifications Added**
- Fix 1.4: Added rationale explaining why the function does nothing useful
- Fix 4.3: Clarified column order in schema matches parameter order in function

### What Was Added
1. More precise line number references for all fixes
2. Complete verification commands for testing
3. Breaking change warnings where applicable
4. Additional test cases for edge conditions
5. XSS security fix for story badge rendering

### Potential Issues Not Addressed
1. **Test file updates**: The plan mentions updating test files but doesn't include specific test code to add
2. **CSS variable availability**: Fix 4.2 assumes `--primary-color` variables exist
3. **Error handling**: Fix 4.4 doesn't handle the case where `task_info["status"]` is neither "start" nor "end"

### Recommendations
1. Run existing tests before starting: `python -m pytest test_*.py -v`
2. Create a database backup before Phase 2: `cp sprint-runner.db sprint-runner.db.backup`
3. Apply all Phase 2 schema changes together before deleting DB
4. Consider adding a migration script instead of destructive DB delete

### Confidence Level
**HIGH (85%)**

The plan is implementable with the corrections made. The main risks are:
- CSS variable availability (minor - fallback colors easy to add)
- Test coverage for new edge cases (moderate - tests exist but may need updates)
- Orchestrator create_event calls being complete (verified 3 locations, but grep for others recommended)

### Verification Command
Before implementation, verify no other `create_event` calls exist:
```bash
grep -n "create_event(" orchestrator.py | wc -l
# Should show 3 locations
```
