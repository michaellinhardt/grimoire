# STUDY-SERVER-SPAWN.md: Server ↔ Spawn Child Investigation Report

## Executive Summary

The sprint-runner system implements a **parent-child orchestrator pattern** where:

1. **server.py** acts as the HTTP/WebSocket server providing REST APIs and real-time UI updates
2. **orchestrator.py** implements the workflow automation engine that spawns Claude CLI subagents as child processes
3. **db.py** provides SQLite persistence for all events, batches, stories, commands, and background tasks
4. **sprint-log.sh** currently writes human-readable logs to disk but is designed to eventually write directly to SQLite

The architecture has **bidirectional coupling**: orchestrator imports from server (for WebSocket broadcast), and server imports from orchestrator (for start/stop control).

---

## 1. Child Process Spawning Mechanics

### How Orchestrator Spawns Subagents

**Location**: `orchestrator.py`, method `spawn_subagent()` (lines 721-810)

```python
async def spawn_subagent(
    self,
    prompt: str,
    prompt_name: str = "unknown",
    wait: bool = True,
    is_background: bool = False,
    model: Optional[str] = None,
    prompt_system_append: Optional[str] = None,
) -> dict[str, Any]:
```

### Spawning Process

1. **Command Construction** (line 745):
   ```python
   args = ["claude", "-p", "--output-format", "stream-json"]
   ```

2. **Model Override** (lines 748-749):
   ```python
   if model:
       args.extend(["--model", model])
   ```

3. **Prompt System Append** (lines 752-753):
   ```python
   if prompt_system_append:
       args.extend(["--prompt-system-append", prompt_system_append])
   ```

4. **Subprocess Creation** (lines 757-764):
   ```python
   process = await asyncio.subprocess.create_subprocess_exec(
       *args,
       stdin=asyncio.subprocess.PIPE,
       stdout=asyncio.subprocess.PIPE,
       stderr=asyncio.subprocess.PIPE,
       env=os.environ.copy(),
       cwd=str(self.project_root),
   )
   ```

5. **Stdin Write** (lines 767-776):
   - Prompt text written to stdin
   - stdin closed after writing
   - Error handling for BrokenPipeError

6. **Output Handling**:
   - **If wait=True**: Parses NDJSON stream from stdout, collects events
   - **If wait=False**: Fire-and-forget background task, returns immediately

---

## 2. Prompt Injection System

### How `build_prompt_system_append()` Works

**Location**: `orchestrator.py`, lines 981-1135

### File Scanning & Collection

1. **Input Parameters**:
   - `command_name`: Name for logging
   - `story_keys`: List like `["2a-1"]` to match files
   - `include_project_context`: Boolean
   - `include_discovery`: Boolean
   - `include_tech_spec`: Boolean
   - `additional_files`: Explicit file paths

2. **Scanning Process**:
   - Project context file: `_bmad-output/planning-artifacts/sprint-project-context.md`
   - Story files: `_bmad-output/implementation-artifacts/*` matching story_key
   - Discovery files: Files with "discovery" in name
   - Tech-spec files: Files with "tech-spec" in name
   - Additional: Explicit paths provided

3. **Deduplication**: Uses `set[Path]` to prevent duplicate file reads (lines 1044-1046)

4. **File Ordering** (lines 1033-1089):
   ```
   1. Project context (if requested)
   2. Story files (sorted)
   3. Discovery files (if include_discovery=True)
   4. Tech-spec files (if include_tech_spec=True)
   5. Additional explicit files
   ```

### XML Injection Format

**Lines 1102-1112**:
```xml
<file_injections rule="DO NOT read these files - content already provided">
  <file path="relative/path/to/file.md">
    [FILE CONTENT HERE]
  </file>
  ...
</file_injections>
```

### Size Monitoring & Thresholds

**Constants** (lines 254, 257-258):
- `PROJECT_CONTEXT_MAX_AGE_SECONDS = 24 * 3600` (24 hours)
- `INJECTION_WARNING_THRESHOLD_BYTES = 100 * 1024` (100KB)
- `INJECTION_ERROR_THRESHOLD_BYTES = 150 * 1024` (150KB)

**Behavior**:
- **If size > 150KB**: Raise ValueError, blocking execution
- **If 100KB < size < 150KB**: Emit warning event, still execute
- **If size < 100KB**: Silent success

---

## 3. File Path Analysis (Hardcoded Paths)

### Paths Scanned for Injection

**In orchestrator.py**:

1. **Project Context**:
   - Source: `{project_root}/_bmad-output/planning-artifacts/project-context.md`
   - Dest: `{project_root}/_bmad-output/planning-artifacts/sprint-project-context.md`
   - Line: 270-271

2. **Implementation Artifacts**:
   - Base: `{project_root}/_bmad-output/implementation-artifacts`
   - Scanned for: `*` files matching story keys
   - Lines: 1043-1067

3. **Sprint Status**:
   - Path: `{project_root}/_bmad-output/implementation-artifacts/sprint-status.yaml`
   - Read at: Line 647

4. **Archive Directory**:
   - Path: `{project_root}/_bmad-output/archived-artifacts`
   - Lines: 352

### Paths in server.py

**Lines 41-55**:
```python
DASHBOARD_DIR = Path(__file__).parent  # = /path/to/dashboard

def find_project_root() -> Path:
    current = Path(__file__).parent
    while current != current.parent:
        if (current / "package.json").exists() or (current / ".git").exists():
            return current
        current = current.parent

PROJECT_ROOT = find_project_root()
ARTIFACTS_DIR = PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"
```

### Paths in db.py

**Line 23**:
```python
DB_PATH = Path(__file__).parent / 'sprint-runner.db'
```

### Paths in sprint-log.sh

**Lines 70-72**:
```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../dashboard"
LOG_FILE="$LOG_DIR/sprint.log"
```

---

## 4. Constants Inventory

### Orchestrator Constants

| Constant | Value | Type | Location | Purpose |
|----------|-------|------|----------|---------|
| `PROJECT_CONTEXT_MAX_AGE_SECONDS` | `24 * 3600` | int | Line 254 | Hours before context refresh |
| `INJECTION_WARNING_THRESHOLD_BYTES` | `100 * 1024` | int | Line 257 | Warn if injection exceeds KB |
| `INJECTION_ERROR_THRESHOLD_BYTES` | `150 * 1024` | int | Line 258 | Error if injection exceeds KB |

### Server Constants

| Constant | Value | Type | Location | Purpose |
|----------|-------|------|----------|---------|
| `PORT` | `8080` | int | Line 38 | HTTP server port |
| `DASHBOARD_DIR` | `Path(__file__).parent` | Path | Line 41 | Dashboard directory |
| `PROJECT_ROOT` | `find_project_root()` | Path | Line 54 | Project root |
| `ARTIFACTS_DIR` | `PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"` | Path | Line 55 | Implementation artifacts |
| `heartbeat` | `30.0` | float | Line 364 | WebSocket heartbeat interval |
| `limit` | `20` | int | Line 692 | Default batch list pagination |

### Database Constants

| Constant | Value | Type | Location | Purpose |
|----------|-------|------|----------|---------|
| `DB_PATH` | `Path(__file__).parent / 'sprint-runner.db'` | Path | Line 23 | SQLite database file |
| `BATCH_FIELDS` | `{'started_at', 'ended_at', ...}` | set | Line 29 | Whitelist for batch updates |
| `STORY_FIELDS` | `{'batch_id', 'story_key', ...}` | set | Line 30 | Whitelist for story updates |
| `COMMAND_FIELDS` | `{'command', 'task_id', ...}` | set | Line 31 | Whitelist for command updates |
| `BACKGROUND_TASK_FIELDS` | `{'task_type', 'spawned_at', ...}` | set | Line 32 | Whitelist for background task updates |
| `VALID_STORY_STATUSES` | `{'pending', 'in-progress', ...}` | set | Lines 35-42 | Valid story status values for validation |

---

## 5. Server ↔ Orchestrator Dependencies

### server.py → orchestrator.py

**Imports** (line 574):
```python
from orchestrator import Orchestrator
```

**Usage**:
- Instantiation in `orchestrator_start_handler()` (line 577)
- State access: `_orchestrator_instance.state.value` (lines 570, 612, 664)
- Attribute access: `current_batch_id`, `cycles_completed`, `max_cycles`, `current_story_keys`
- Method calls: `.stop()` (line 634)

### orchestrator.py → server.py

**Imports** (lines 91-96):
```python
# WebSocket broadcast - import from server module (Story 5-SR-5)
try:
    from server import broadcast, emit_event as server_emit_event, EventType
    _websocket_available = True
except ImportError:
    _websocket_available = False
```

**Usage**:
- `broadcast_websocket()` wrapper (lines 103-110)
- `emit_event()` for events (line 929): Broadcasts JSON-serialized events

### Circular Dependency Risk

**Current Mitigation**:
- Orchestrator has try/except for server import (handles missing import)
- Server lazy-imports orchestrator only when needed
- No module-level circular import

### Start/Stop Control

**Server → Orchestrator**:
1. POST `/api/orchestrator/start` → Creates instance, calls `start()`
2. POST `/api/orchestrator/stop` → Calls `stop()` on running instance

**Orchestrator → Server**:
1. During execution, emits events via `broadcast_websocket()`
2. Events include batch, cycle, story, command, context updates

---

## 6. sprint-log.sh Analysis

### Current Behavior

**Dual Output**:

1. **Human-Readable Log** (lines 66-78):
   - Format: `[timestamp] [epic_id/story_id] [command:task_id] [status] message`
   - Written to: `../dashboard/sprint.log`
   - Append mode: Each call adds one line

2. **CSV to stdout** (lines 81-102):
   - Format: `timestamp,epicID,storyID,command,task-id,status,"message"`
   - Consumed by: Orchestrator's CSV parser
   - Message field always quoted, double-quotes escaped

### Input JSON Schema

```json
{
  "epic_id": "required",
  "story_id": "required",
  "command": "required",
  "task_id": "required",
  "status": "required",
  "message": "optional",
  "metrics": "optional",
  "attempt": "optional"
}
```

### Validation

- JSON well-formedness checked (line 30)
- All required fields validated (lines 51-61)
- jq dependency required (lines 24-27)

### IMPORTANT: Timestamp Format Discrepancy

The script outputs timestamps in human-readable format (`YYYY-MM-DD HH:MM:SS`), NOT Unix epoch milliseconds:
```bash
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")  # Line 64
```

This differs from the database which stores timestamps as milliseconds since epoch (`int(time.time() * 1000)`). The orchestrator's `_parse_csv_log_line()` method expects Unix timestamps and will **reject** the current script output format.

---

## 7. Database Direct Write Strategy

### How to Add SQLite Direct Write

**Proposed Addition** (conceptual):

```bash
# After CSV generation, add SQLite insert:
sqlite3 "$DB_PATH" <<EOF
INSERT INTO events (
  batch_id, story_id, command_id, timestamp, event_type,
  epic_id, story_key, command, task_id, status, message
) VALUES (
  ?, NULL, NULL, ?, ?,
  ?, ?, ?, ?, ?, ?
);
EOF
```

### Implementation Requirements

1. **Database Path**: Must match `server/sprint-runner.db` location
2. **Timestamp**: Use milliseconds (current: `int(time.time() * 1000)`)
3. **Event Type**: Derive from status: "start" → "command:start", etc.
4. **Foreign Keys**: batch_id must exist (constraint already enabled)

---

## 8. Impact Assessment for Restructuring

### When Moving to `server/` Subdirectory

**Required Changes**:

1. **Database Path** (db.py, line 23):
   ```python
   # Current:
   DB_PATH = Path(__file__).parent / 'sprint-runner.db'
   # After move to server/: ✓ Still correct (server/sprint-runner.db)
   ```

2. **Dashboard Directory** (server.py, line 41):
   ```python
   # Current:
   DASHBOARD_DIR = Path(__file__).parent
   # After move: Must become:
   DASHBOARD_DIR = Path(__file__).parent.parent / "frontend"
   # For serving frontend/ sibling directory
   ```

3. **Project Root Detection** (server.py, lines 44-51):
   ```python
   # Works by scanning up for .git/package.json
   # No changes needed - will still find root
   ```

4. **Import Statements**:
   ```python
   # server.py line 574:
   from orchestrator import Orchestrator
   # Works from same directory - no change needed

   # orchestrator.py line 93:
   from server import broadcast
   # Works from same directory - no change needed

   # db.py imports:
   # No orchestrator/server imports - no changes needed
   ```

5. **Path References in orchestrator.py**:
   ```python
   # Lines 270-271, 351-352, 646-647, 1038, 1043:
   # All use self.project_root which is passed in __init__
   # No changes needed - paths are relative to project_root
   ```

6. **Static File Serving** (server.py, lines 842-898):
   ```python
   # Line 894: DASHBOARD_DIR / filename
   # Must update to serve from ../frontend/
   ```

### New Files to Create

1. **shared.py** - Extract all constants:
   - `PROJECT_ROOT`
   - `ARTIFACTS_DIR`
   - `DASHBOARD_DIR` → `FRONTEND_DIR`
   - `DB_PATH`
   - `PORT`

2. **settings.py** - Extract configurable settings:
   - `PROJECT_CONTEXT_MAX_AGE_HOURS`
   - `INJECTION_WARNING_KB`
   - `INJECTION_ERROR_KB`
   - `DEFAULT_MAX_CYCLES`
   - `CODE_REVIEW_MAX_ATTEMPTS`
   - `HAIKU_AFTER_REVIEW`
   - `WEBSOCKET_HEARTBEAT_SECONDS`

---

## 9. Recommendations

### 1. Immediate Actions (Before Restructuring)

- Extract hardcoded paths to `shared.py`
- Extract thresholds to `settings.py`
- Update `sprint-log.sh` to write directly to SQLite
- Add SQLite schema migration for sprint-log.sh compatibility

### 2. Restructuring Steps

1. Create `server/__init__.py`
2. Create `server/shared.py` with all constants
3. Create `server/settings.py` with configurable values
4. Move `orchestrator.py`, `server.py`, `db.py` to `server/`
5. Update import statements (minimal changes needed)
6. Update static file serving path in server.py
7. Run tests to verify imports work

### 3. Frontend Migration

- Extract dashboard.html to `frontend/index.html`
- Extract CSS to `frontend/css/styles.css`
- Extract JS modules to `frontend/js/*.js`
- Update server.py static routes to point to `../frontend/`

### 4. sprint-log.sh Enhancement

- Remove file logging entirely (unused)
- Add SQLite direct write mode
- Point to correct database path: `server/sprint-runner.db`

### 5. Testing Strategy

- Verify all imports resolve correctly
- Test database path resolution
- Test static file serving with new paths
- Test WebSocket events flow
- Test orchestrator start/stop from server

---

## Summary Table: Constants to Extract

| Source | Constant | Setting Name | Default |
|--------|----------|-------------|---------|
| orchestrator.py | `PROJECT_CONTEXT_MAX_AGE_SECONDS` | `project_context_max_age_hours` | 24 |
| orchestrator.py | `INJECTION_WARNING_THRESHOLD_BYTES` | `injection_warning_kb` | 100 |
| orchestrator.py | `INJECTION_ERROR_THRESHOLD_BYTES` | `injection_error_kb` | 150 |
| orchestrator.py | `max_cycles=2` | `default_max_cycles` | 2 |
| orchestrator.py | `review_attempt <= 10` | `max_code_review_attempts` | 10 |
| orchestrator.py | `haiku if review >= 2` | `haiku_after_review` | 2 |
| server.py | `PORT` | `server_port` | 8080 |
| server.py | `heartbeat=30.0` | `websocket_heartbeat_seconds` | 30 |
| server.py | `limit=20` | `default_batch_list_limit` | 20 |
