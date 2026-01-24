# Story 5-SR.4: Project Context Refresh Integration

Status: review

## Story

As an **operator**,
I want **the orchestrator to manage project-context.md automatically**,
so that **agents always have current project context without manual intervention**.

## Acceptance Criteria

1. **Given** project-context.md does not exist, **When** the orchestrator starts a batch, **Then** the `/generate-project-context` workflow is spawned **And** the orchestrator WAITS for completion before continuing **And** a "context:create" event is logged

2. **Given** project-context.md exists but is expired (>24 hours old), **When** the orchestrator starts a batch, **Then** the `/generate-project-context` workflow is spawned in BACKGROUND **And** the orchestrator continues immediately without waiting **And** a "context:refresh" event is logged **And** the background task is tracked in background_tasks table

3. **Given** the old shell script `project-context-should-refresh.sh` exists, **When** the orchestrator is fully implemented, **Then** the shell script dependency is removed **And** the freshness check is implemented directly in Python: file exists check + file modification time check (24 hour threshold)

4. **Given** context refresh is running in background, **When** the task completes, **Then** the background_tasks record is updated with completed_at **And** a "context:complete" event is logged

## Tasks / Subtasks

- [x] Task 1: Implement project context freshness check in Python (AC: 3)
  - [x] 1.1 Create `check_project_context_status()` function in orchestrator.py
  - [x] 1.2 Check if file exists at `_bmad-output/planning-artifacts/project-context.md`
  - [x] 1.3 If exists, check file modification time using `os.path.getmtime()`
  - [x] 1.4 Compare against 24-hour (86400 seconds) threshold
  - [x] 1.5 Return status: "missing", "expired", or "fresh"

- [x] Task 2: Implement blocking context creation flow (AC: 1)
  - [x] 2.1 Add `create_project_context()` async function
  - [x] 2.2 Spawn Claude CLI: `claude -p --output-format stream-json`
  - [x] 2.3 Pass generate-project-context prompt via stdin
  - [x] 2.4 Parse NDJSON events, emit to WebSocket as "context:create" events
  - [x] 2.5 Block (await) until subprocess completes
  - [x] 2.6 Log "context:create" event to database

- [x] Task 3: Implement background context refresh flow (AC: 2, 4)
  - [x] 3.1 Add `refresh_project_context_background()` async function
  - [x] 3.2 Create record in `background_tasks` table with status "running"
  - [x] 3.3 Spawn subprocess (same as Task 2) with asyncio but DO NOT await
  - [x] 3.4 Log "context:refresh" event immediately
  - [x] 3.5 Continue main loop without waiting
  - [x] 3.6 Create callback/task that updates `background_tasks.completed_at` on finish
  - [x] 3.7 Emit "context:complete" WebSocket event when done

- [x] Task 4: Integrate into orchestrator main loop (AC: 1, 2)
  - [x] 4.1 Call `check_project_context_status()` at start of each batch (Step 0a)
  - [x] 4.2 If "missing": call `create_project_context()` and WAIT
  - [x] 4.3 If "expired": call `refresh_project_context_background()` and CONTINUE
  - [x] 4.4 If "fresh": log "Project context is fresh, skipping regeneration"

- [x] Task 5: Remove shell script dependency (AC: 3)
  - [x] 5.1 Remove all calls to `project-context-should-refresh.sh` from orchestrator
  - [x] 5.2 Update instructions.md Step 0a to reflect Python implementation
  - [x] 5.3 Mark shell script as deprecated (add comment, do not delete)

- [x] Task 6: Add WebSocket event types and database logging (AC: 1, 2, 4)
  - [x] 6.1 Add event types to WebSocket emit: "context:create", "context:refresh", "context:complete"
  - [x] 6.2 Add event logging to `events` table for all context operations
  - [x] 6.3 Ensure background task tracking in `background_tasks` table

## Dev Notes

### Technical Implementation

**File Locations:**
- Orchestrator: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`
- Database module: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py`
- Project context path: `_bmad-output/planning-artifacts/project-context.md`
- Shell script (deprecated): `_bmad/scripts/project-context-should-refresh.sh`

**Python Implementation Pattern:**

```python
import os
import time
import asyncio

PROJECT_CONTEXT_PATH = "_bmad-output/planning-artifacts/project-context.md"
MAX_AGE_SECONDS = 24 * 3600  # 24 hours

def check_project_context_status() -> str:
    """
    Returns: "missing", "expired", or "fresh"
    """
    if not os.path.exists(PROJECT_CONTEXT_PATH):
        return "missing"

    file_mtime = os.path.getmtime(PROJECT_CONTEXT_PATH)
    current_time = time.time()
    age_seconds = current_time - file_mtime

    if age_seconds > MAX_AGE_SECONDS:
        return "expired"

    return "fresh"

async def create_project_context(db, ws_clients, batch_id):
    """Blocking context creation - WAITS for completion"""
    # Log start event
    db.create_event(batch_id=batch_id, story_id=None, command_id=None,
                   task_id="context", status="create",
                   message="Creating project context (blocking)")

    # Spawn Claude CLI
    proc = await asyncio.subprocess.create_subprocess_exec(
        "claude", "-p", "--output-format", "stream-json",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    # Send prompt
    prompt = """AUTONOMOUS MODE - Generate fresh project context.
Run the workflow: /bmad:bmm:workflows:generate-project-context
Output the file to: _bmad-output/planning-artifacts/project-context.md"""

    proc.stdin.write(prompt.encode())
    await proc.stdin.drain()
    proc.stdin.close()

    # Wait for completion
    await proc.wait()

    # Emit WebSocket event
    await emit_ws_event(ws_clients, {
        "type": "context:create",
        "payload": {"status": "complete"}
    })

async def refresh_project_context_background(db, ws_clients, batch_id):
    """Non-blocking background refresh - returns immediately"""
    # Create background task record
    task_id = db.create_background_task(
        batch_id=batch_id,
        story_key=None,
        task_type="project-context-refresh",
        status="running"
    )

    # Log event
    db.create_event(batch_id=batch_id, story_id=None, command_id=None,
                   task_id="context", status="refresh",
                   message="Starting background context refresh")

    # Emit immediate WebSocket event
    await emit_ws_event(ws_clients, {
        "type": "context:refresh",
        "payload": {"task_id": task_id, "status": "started"}
    })

    # Spawn task that runs in background (fire and forget)
    asyncio.create_task(_run_context_refresh(db, ws_clients, batch_id, task_id))

    # Return immediately - main loop continues

async def _run_context_refresh(db, ws_clients, batch_id, task_id):
    """Background task that actually runs the refresh"""
    try:
        proc = await asyncio.subprocess.create_subprocess_exec(
            "claude", "-p", "--output-format", "stream-json",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        prompt = """AUTONOMOUS MODE - Generate fresh project context.
Run the workflow: /bmad:bmm:workflows:generate-project-context
Output the file to: _bmad-output/planning-artifacts/project-context.md"""

        proc.stdin.write(prompt.encode())
        await proc.stdin.drain()
        proc.stdin.close()

        await proc.wait()

        # Update background task record
        db.update_background_task(task_id, status="completed")

        # Emit completion event
        await emit_ws_event(ws_clients, {
            "type": "context:complete",
            "payload": {"task_id": task_id, "status": "completed"}
        })

    except Exception as e:
        db.update_background_task(task_id, status="error")
        # Log error but don't crash - this is background work
```

**Integration into Main Loop (Step 0a):**

```python
async def run_batch(db, ws_clients, batch_id, max_cycles):
    # Step 0a: Check project context
    context_status = check_project_context_status()

    if context_status == "missing":
        # BLOCKING: Wait for creation
        await create_project_context(db, ws_clients, batch_id)
    elif context_status == "expired":
        # NON-BLOCKING: Start refresh and continue
        await refresh_project_context_background(db, ws_clients, batch_id)
    else:
        # Fresh - log and continue
        db.create_event(batch_id=batch_id, story_id=None, command_id=None,
                       task_id="context", status="fresh",
                       message=f"Project context is fresh, skipping regeneration")

    # Continue with Step 0b and main loop...
```

### Critical Behavioral Differences

| Condition | Old Shell Script | New Python Implementation |
|-----------|------------------|---------------------------|
| File missing | Exit 0 (TRUE) | Return "missing", WAIT for creation |
| File expired | Exit 0 + DELETE file | Return "expired", BACKGROUND refresh (no delete) |
| File fresh | Exit 1 (FALSE) | Return "fresh", skip regeneration |

**Key Change:** The shell script deletes the file when expired. The Python implementation does NOT delete - it starts a background refresh while the existing (stale) file remains available for subagents. This is more robust.

### Database Schema Usage

**background_tasks table (from Story 5-SR-2):**
```sql
CREATE TABLE background_tasks (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER,
  story_key TEXT,  -- NULL for context refresh tasks
  task_type TEXT,  -- "project-context-refresh"
  spawned_at INTEGER,
  completed_at INTEGER,
  status TEXT  -- "running", "completed", "error"
);
```

**events table entries:**
- `task_id = "context"`, `status = "create"` - Blocking creation started
- `task_id = "context"`, `status = "refresh"` - Background refresh started
- `task_id = "context"`, `status = "complete"` - Refresh finished
- `task_id = "context"`, `status = "fresh"` - No action needed

### Project Structure Notes

- File lives in: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/`
- Follows Python 3.9+ async patterns with asyncio
- Uses `asyncio.create_task()` for fire-and-forget background work
- WebSocket events use same pattern as Story 5-SR-5

### References

- [Source: _bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md#Step-0a] - Original workflow spec
- [Source: _bmad/scripts/project-context-should-refresh.sh] - Shell script to replace
- [Source: epic-5-sprint-runner-dashboard.md#Story-5-SR-4] - Acceptance criteria
- [Source: epic-5-sprint-runner-dashboard-context.md#Behavioral-Specifications] - Missing vs expired behavior

### Testing Approach

1. **Unit tests for `check_project_context_status()`:**
   - Test with missing file -> returns "missing"
   - Test with fresh file (< 24h) -> returns "fresh"
   - Test with expired file (> 24h) -> returns "expired"

2. **Integration tests for blocking creation:**
   - Mock subprocess, verify WAIT behavior
   - Verify event logged to database
   - Verify WebSocket emit

3. **Integration tests for background refresh:**
   - Verify returns immediately (< 100ms)
   - Verify background_tasks record created
   - Verify completion callback updates record

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5

### Debug Log References
N/A - No debug issues encountered during implementation.

### Completion Notes List
- Implemented `check_project_context_status()` method in Orchestrator class that returns "missing", "expired", or "fresh"
- Implemented `create_project_context()` async method for blocking context creation when file is missing
- Implemented `refresh_project_context_background()` async method for non-blocking background refresh when file is expired
- Implemented `_run_background_context_refresh()` helper for actual background task execution with completion tracking
- Updated `check_project_context()` to use the new status-based flow instead of direct file checks
- Added WebSocket event types: "context:create", "context:refresh", "context:complete", "context:fresh", "context:error"
- Added database event logging for all context operations (create, refresh, complete)
- Added background_tasks table tracking for context refresh operations
- Updated instructions.md Step 0a to document Python implementation instead of shell script
- Added deprecation notice to project-context-should-refresh.sh shell script
- Key behavioral improvement: Python implementation does NOT delete expired file (unlike shell script), allowing stale context to remain available during background refresh

### File List
- _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py (modified)
- _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/test_orchestrator.py (modified - added 15 new tests)
- _bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md (modified - Step 0a and Execution Summary)
- _bmad/scripts/project-context-should-refresh.sh (modified - added deprecation notice)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-24 | Implemented project context refresh integration with Python replacing shell script. Added blocking creation for missing files, non-blocking background refresh for expired files. All 64 orchestrator tests pass. | Claude Opus 4.5 |
