# Epic 5-SR: Sprint Runner Dashboard Orchestrator

**User Outcome:** Control and monitor sprint-runner workflow execution via a web dashboard with real-time updates, replacing the LLM-based orchestrator with deterministic Python script automation.

**Core Value:** Eliminate LLM interpretation variability, enable persistent state across sessions, and provide operators with real-time visibility and control over sprint execution.

---

## Technical Context

### Key Files

| File | Purpose |
|------|---------|
| `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md` | Workflow logic to implement |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml` | Fixed task-id definitions |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/*.md` | Subagent prompt templates |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` | HTTP server (relocated from docs/) |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html` | Dashboard UI (relocated from docs/) |

### Destination Files

| File | Purpose |
|------|---------|
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` | Enhanced HTTP + WebSocket server |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html` | Enhanced dashboard with Sprint Run tab |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` | Main orchestrator script |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py` | SQLite database module |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/sprint-runner.db` | SQLite database file |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/requirements.txt` | Python dependencies |

---

## Story 5-SR-1: Folder Structure and File Relocation

As a **developer**,
I want **the sprint-runner dashboard files organized in a dedicated folder**,
So that **all orchestrator components are colocated and easy to maintain**.

**Acceptance Criteria:**

**Given** the current file locations in `docs/`
**When** the relocation is complete
**Then** `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/` folder exists
**And** `server.py` is located at `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
**And** `dashboard.html` is located at `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`
**And** a `requirements.txt` file is created with `aiohttp`, `pyyaml`, and `websockets` dependencies

**Given** the files are relocated
**When** any prompt or script references the old paths
**Then** all path references are updated to the new locations
**And** the server still launches correctly from the new location
**And** the dashboard HTML loads correctly when served

**Given** documentation exists referencing old paths
**When** the relocation is complete
**Then** all documentation references use the new paths in `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/`

---

## Story 5-SR-2: SQLite Database Schema and Operations

As a **developer**,
I want **a SQLite database to track orchestrator state**,
So that **sprint execution can persist across sessions and provide queryable event history**.

**Acceptance Criteria:**

**Given** the dashboard folder exists
**When** the orchestrator starts for the first time
**Then** `sprint-runner.db` is created in the dashboard folder
**And** the following tables are initialized:

```sql
CREATE TABLE batches (
  id INTEGER PRIMARY KEY,
  started_at INTEGER,
  ended_at INTEGER,
  max_cycles INTEGER,
  cycles_completed INTEGER,
  status TEXT  -- running, completed, stopped, error
);

CREATE TABLE stories (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER,
  story_key TEXT,
  epic_id TEXT,
  status TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE commands (
  id INTEGER PRIMARY KEY,
  story_id INTEGER,
  command TEXT,
  task_id TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  status TEXT,
  output_summary TEXT,
  FOREIGN KEY (story_id) REFERENCES stories(id)
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER,
  story_id INTEGER,
  command_id INTEGER,
  timestamp INTEGER,
  epic_id TEXT,
  story_key TEXT,
  command TEXT,
  task_id TEXT,
  status TEXT,
  message TEXT
);

CREATE TABLE background_tasks (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER,
  story_key TEXT,
  task_type TEXT,
  spawned_at INTEGER,
  completed_at INTEGER,
  status TEXT
);
```

**Given** `db.py` module is implemented
**When** the orchestrator needs to track state
**Then** CRUD operations are available for all tables:
- `create_batch()`, `update_batch()`, `get_batch()`, `get_active_batch()`
- `create_story()`, `update_story()`, `get_story()`, `get_stories_by_batch()`
- `create_command()`, `update_command()`, `get_commands_by_story()`
- `create_event()`, `get_events()`, `get_events_by_batch()`
- `create_background_task()`, `update_background_task()`, `get_pending_background_tasks()`

**Given** the orchestrator needs to make decisions
**When** querying state
**Then** helper queries are available:
- `get_current_batch_status()` - returns running batch or None
- `get_next_available_story()` - returns first non-done, non-blocked story
- `count_completed_cycles()` - returns cycles completed in current batch
- `check_story_blocked()` - returns True if story has 3+ consecutive errors

---

## Story 5-SR-3: Python Orchestrator Core Loop

As an **operator**,
I want **the orchestrator to execute the sprint workflow deterministically**,
So that **sprint execution follows `instructions.md` exactly without LLM interpretation variance**.

**Acceptance Criteria:**

**Given** the orchestrator is started with a batch size
**When** the main loop executes
**Then** the workflow follows `instructions.md` steps exactly:
1. Check project-context.md status
2. Read sprint-status.yaml
3. Filter and sort stories (exclude `epic-*`, `*-retrospective`)
4. Find next non-done, non-blocked story
5. Pair stories from same epic if available
6. Execute create-story + story-discovery in parallel
7. Execute story-review-1, spawn background chain if critical issues
8. Execute tech-spec if needed, then tech-spec-review-1 with same background logic
9. Execute dev-story + code-review loop per story
10. Execute batch-commit for completed stories
11. Increment cycle counter, check batch size

**Given** a command needs to be executed
**When** spawning a Claude CLI subagent
**Then** the orchestrator uses `asyncio.subprocess.create_subprocess_exec`
**And** the command is `claude -p --output-format stream-json`
**And** the appropriate prompt file is passed via stdin
**And** stdout is parsed for NDJSON events

**Given** the Claude CLI outputs NDJSON
**When** parsing the stream
**Then** task-id events are captured (from task-taxonomy.yaml phases)
**And** each event triggers a database event record
**And** each event triggers a WebSocket emission (if connected)

**Given** a story transitions status
**When** the status changes (backlog -> in-progress -> done/blocked)
**Then** the database is updated
**And** sprint-status.yaml is updated
**And** a story:status WebSocket event is emitted

**Given** batch_mode is "all"
**When** all stories are done or blocked
**Then** the orchestrator stops naturally

**Given** batch_mode is a number
**When** cycles_completed >= max_cycles
**Then** the orchestrator pauses and emits batch:end event

---

## Story 5-SR-4: Project Context Refresh Integration

As an **operator**,
I want **the orchestrator to manage project-context.md automatically**,
So that **agents always have current project context without manual intervention**.

**Acceptance Criteria:**

**Given** project-context.md does not exist
**When** the orchestrator starts a batch
**Then** the `/generate-project-context` workflow is spawned
**And** the orchestrator WAITS for completion before continuing
**And** a "context:create" event is logged

**Given** project-context.md exists but is expired (>24 hours old)
**When** the orchestrator starts a batch
**Then** the `/generate-project-context` workflow is spawned in BACKGROUND
**And** the orchestrator continues immediately without waiting
**And** a "context:refresh" event is logged
**And** the background task is tracked in background_tasks table

**Given** the old shell script `project-context-should-refresh.sh` exists
**When** the orchestrator is fully implemented
**Then** the shell script dependency is removed
**And** the freshness check is implemented directly in Python:
- File exists check
- File modification time check (24 hour threshold)

**Given** context refresh is running in background
**When** the task completes
**Then** the background_tasks record is updated with completed_at
**And** a "context:complete" event is logged

---

## Story 5-SR-5: WebSocket Real-Time Events

As an **operator**,
I want **real-time events pushed to the dashboard**,
So that **I can monitor sprint progress without polling or page refresh**.

**Acceptance Criteria:**

**Given** the server starts
**When** initializing
**Then** both HTTP and WebSocket servers run on the same port via aiohttp
**And** WebSocket endpoint is available at `/ws`

**Given** a dashboard connects via WebSocket
**When** the connection is established
**Then** the server tracks the connection in a set
**And** initial state is sent (current batch status, recent events)

**Given** events occur in the orchestrator
**When** state changes
**Then** events are emitted to all connected WebSocket clients:

| Event Type | Payload |
|------------|---------|
| `batch:start` | `{ batch_id, max_cycles }` |
| `batch:end` | `{ batch_id, cycles_completed, status }` |
| `cycle:start` | `{ cycle_number, story_keys }` |
| `cycle:end` | `{ cycle_number, completed_stories }` |
| `command:start` | `{ story_key, command, task_id }` |
| `command:progress` | `{ story_key, command, task_id, message }` |
| `command:end` | `{ story_key, command, task_id, status, metrics }` |
| `story:status` | `{ story_key, old_status, new_status }` |
| `error` | `{ type, message, context }` |

**Given** multiple dashboards are connected
**When** events are emitted
**Then** all connected clients receive the event
**And** events are delivered within 500ms of occurrence

**Given** a WebSocket connection drops
**When** the disconnect is detected
**Then** the connection is removed from the tracking set
**And** no errors occur from attempting to send to closed connections

---

## Story 5-SR-6: Dashboard Sprint Run Tab

As an **operator**,
I want **a dedicated Sprint Run tab with controls and live event log**,
So that **I can start, stop, and monitor sprint execution from the dashboard**.

**Acceptance Criteria:**

**Given** the dashboard loads
**When** viewing the navigation
**Then** a "Sprint Run" tab is visible alongside existing tabs
**And** clicking the tab shows the Sprint Run view

**Given** the Sprint Run tab is active
**When** viewing the controls
**Then** the following UI elements are displayed:
- [Start] button - begins a new batch
- [Stop] button - stops the current batch gracefully
- Batch size input - number field or "all" checkbox
- Current status display (Idle, Running cycle X/Y, Stopped, Error)
- Current operation display (e.g., "2a-1 dev-story (implement)")

**Given** no batch is running
**When** the user enters a batch size and clicks [Start]
**Then** the orchestrator starts a new batch
**And** the status updates to "Running cycle 1/N"
**And** [Start] is disabled, [Stop] is enabled

**Given** a batch is running
**When** the user clicks [Stop]
**Then** a graceful stop is initiated (current command completes, then stops)
**And** the status updates to "Stopping..."
**And** once stopped, status shows "Stopped" with cycle count

**Given** the Sprint Run tab is active
**When** events stream from the orchestrator
**Then** a real-time event log displays at the bottom
**And** format is: `HH:MM:SS story_key command task_id status`
**And** new events appear at the top (newest first)
**And** the log scrolls automatically unless user has scrolled up

**Given** an error occurs
**When** the error event is received
**Then** a toast notification appears
**And** the error is highlighted in the event log
**And** the error details are accessible

**Creative features to consider:**
- Progress bar showing cycle progress
- Story status indicators (colored badges per story)
- Collapsible command details
- Time elapsed per command/story

---

## Story 5-SR-7: Dashboard UI Improvements

As an **operator**,
I want **an improved dashboard experience**,
So that **I can use more screen space and not lose my UI state on refresh**.

**Acceptance Criteria:**

**Given** the dashboard HTML
**When** removing the width constraint
**Then** the `max-width: 1400px` constraint is removed
**And** the dashboard uses full available width
**And** content flows naturally to fill the viewport

**Given** the dashboard auto-refresh feature
**When** data updates
**Then** DOM is updated incrementally (no full page reload)
**And** only changed elements are re-rendered
**And** scroll position is preserved
**And** expanded/collapsed states are preserved

**Given** the user adjusts UI state
**When** interacting with the dashboard
**Then** the following are saved to localStorage:
- Active tab selection
- Filter/search values
- Checkbox states (e.g., show archived)
- Expanded/collapsed elements
- Column sort preferences
- Batch size input value

**Given** the user refreshes the browser
**When** the dashboard loads
**Then** all UI state is restored from localStorage
**And** the user sees exactly what they had before
**And** no server round-trip is needed for UI state

**Given** the WebSocket connection is active
**When** receiving updates
**Then** data tables update in-place
**And** New rows are inserted without full re-render
**And** Status changes update the specific cell/badge

---

## Story 5-SR-8: Integration Testing and Cleanup

As a **developer**,
I want **comprehensive testing and cleanup of old infrastructure**,
So that **the new orchestrator is verified and legacy code is removed**.

**Acceptance Criteria:**

**Given** the new orchestrator is complete
**When** running an integration test
**Then** the following workflow executes successfully:
1. Start dashboard server
2. Connect browser to dashboard
3. Click [Start] with batch size 2
4. Verify events stream in real-time
5. Verify sprint-status.yaml updates correctly
6. Verify database records are created
7. Click [Stop] mid-story, verify graceful stop
8. Click [Start] to resume, verify continuation from correct point

**Given** functional parity testing
**When** comparing to LLM-based orchestrator
**Then** the same workflow (create-story, review, tech-spec, dev, code-review) executes
**And** the same parallelization rules are followed
**And** the same retry/blocking logic is applied
**And** output files match expected structure

**Given** the new orchestrator is verified
**When** cleanup is performed
**Then** old shell scripts are removed or deprecated:
- `project-context-should-refresh.sh` (logic moved to Python)
- Any other orchestrator-related shell scripts
**And** old CSV logging code is marked deprecated (if still referenced)

**Given** documentation exists for the sprint-runner
**When** cleanup is complete
**Then** documentation reflects new file locations
**And** setup instructions include `pip install -r requirements.txt`
**And** usage instructions explain dashboard controls
**And** any references to old patterns are removed

---

## Success Criteria Summary

1. **Functional Parity**: Orchestrator produces identical workflow execution as LLM-interpreted `instructions.md`
2. **State Persistence**: Sprint can be stopped and resumed from exact position
3. **Real-Time Visibility**: Dashboard shows live updates within 500ms of event
4. **Control Interface**: Start/stop available via dashboard buttons
5. **Data Integrity**: All events stored in SQLite with correct relationships
6. **No Regressions**: Existing dashboard views continue working
7. **Documentation**: Clear setup instructions for new server

## Acceptance Tests

- [ ] Run 3 cycles, stop mid-story, resume completes correctly
- [ ] WebSocket shows real-time command progress
- [ ] Dashboard Sprint Run tab controls work
- [ ] localStorage preserves UI state across refresh
- [ ] Full-width layout renders correctly
- [ ] Incremental DOM updates (no full page reload)
