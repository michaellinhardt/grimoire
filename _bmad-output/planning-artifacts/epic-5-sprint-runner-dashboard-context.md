# Epic 5: Sprint Runner Dashboard Orchestrator

## Executive Summary

Replace the LLM-based sprint-runner orchestrator (`instructions.md`) with a deterministic Python script that manages workflow execution via SQLite state and provides real-time WebSocket updates to an enhanced dashboard with sprint control capabilities.

**Core Value**: Eliminate LLM interpretation variability, enable persistent state across sessions, and provide operators with real-time visibility and control over sprint execution.

---

## Technical Scope

### In Scope

1. **Python Orchestrator Script**
   - Async execution loop using `asyncio`
   - Spawns Claude CLI: `claude -p --output-format stream-json`
   - Follows existing `instructions.md` workflow logic exactly
   - Parses child process JSON output for task events
   - Conservative parallelization (matches current behavior)

2. **SQLite Database**
   - Tables: `batches`, `stories`, `commands`, `events`, `background_tasks`
   - Single file database in dashboard folder
   - Replaces CSV-based event logging
   - Enables query-based dashboard data

3. **WebSocket Real-Time Updates**
   - Events: `batch:start/end`, `cycle:start/end`, `command:start/progress/end`, `story:status`, `error`
   - Library: `aiohttp` or `websockets`
   - Dashboard receives push updates (no polling)

4. **Dashboard Enhancements**
   - New "Sprint Run" tab with start/stop controls
   - Real-time event log display
   - Full-width layout (remove `max-width: 1400px` constraint)
   - Incremental DOM updates (no page reload on refresh)
   - All UI state persisted to localStorage

5. **File Relocation**
   - `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` (relocated from docs/)
   - `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html` (relocated from docs/)
   - Create new orchestrator script in same folder

### Boundaries

| Aspect | Specification |
|--------|---------------|
| Language | Python 3.9+ with asyncio |
| Database | SQLite (single file) |
| WebSocket | aiohttp or websockets library |
| CLI Interface | `claude -p --output-format stream-json` |
| Task IDs | Fixed from `task-taxonomy.yaml` (no changes) |
| Workflow Logic | Must match `instructions.md` exactly |

---

## Key Files

### Source Files (Read/Reference)

| File | Purpose |
|------|---------|
| `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md` | Workflow logic to implement |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml` | Fixed task-id definitions |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/*.md` | Subagent prompt templates |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` | HTTP server (relocated from docs/) |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html` | Dashboard UI (relocated from docs/) |
| `_bmad-output/implementation-artifacts/sprint-runner-orchestrator-study.md` | Analysis and proposed schema |

### Destination Files (Create/Modify)

| File | Purpose |
|------|---------|
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` | Enhanced HTTP + WebSocket server |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html` | Enhanced dashboard with Sprint Run tab |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` | Main orchestrator script |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py` | SQLite database module |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/sprint-runner.db` | SQLite database file |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/requirements.txt` | Python dependencies |

---

## Dependencies and Risks

### Dependencies

| Dependency | Type | Mitigation |
|------------|------|------------|
| Python 3.9+ | Runtime | Document in README, check at startup |
| `aiohttp` or `websockets` | Library | Include in requirements.txt |
| `pyyaml` | Library | Include in requirements.txt |
| Claude CLI installed | External | Verify at startup, clear error message |
| `sprint-status.yaml` exists | Data | Create empty template if missing |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Workflow parity issues | Medium | High | Extensive testing against current behavior |
| Claude CLI output format changes | Low | High | Abstract parsing layer |
| Database corruption | Low | Medium | Write-ahead logging, backups |
| WebSocket connection drops | Medium | Low | Auto-reconnect in dashboard |
| Background task orphaning | Medium | Medium | Track PID, cleanup on startup |

---

## Behavioral Specifications

### Project Context Refresh

| Condition | Behavior |
|-----------|----------|
| File missing | Create via subagent, **WAIT** for completion before proceeding |
| File expired | Refresh in **BACKGROUND** while main loop continues |

### Batch Size Control

- Controlled **only** via dashboard UI (not CLI args)
- Default: 2 cycles
- Options: specific number, "all" (run until complete)

### Parallelization Rules

Follow `instructions.md` strictly:
- Step 2: create-story + story-discovery (parallel)
- Step 2b/3b: review-1 blocks, review-2/3 fire-and-forget background
- Step 4: dev + code-review sequential per story
- No new parallelization beyond current spec

---

## Success Criteria

1. **Functional Parity**: Orchestrator produces identical workflow execution as LLM-interpreted `instructions.md`
2. **State Persistence**: Sprint can be stopped and resumed from exact position
3. **Real-Time Visibility**: Dashboard shows live updates within 500ms of event
4. **Control Interface**: Start/stop/pause available via dashboard buttons
5. **Data Integrity**: All events stored in SQLite with correct relationships
6. **No Regressions**: Existing dashboard views continue working
7. **Documentation**: Clear setup instructions for new server

### Acceptance Tests

- [ ] Run 3 cycles, stop mid-story, resume completes correctly
- [ ] WebSocket shows real-time command progress
- [ ] Dashboard Sprint Run tab controls work
- [ ] localStorage preserves UI state across refresh
- [ ] Full-width layout renders correctly
- [ ] Incremental DOM updates (no full page reload)

---

## Out of Scope

1. **Prompt Modifications**: Subagent prompts remain unchanged
2. **Task Taxonomy Changes**: Fixed IDs from `task-taxonomy.yaml` unchanged
3. **New Parallelization**: No optimization beyond current `instructions.md`
4. **Multi-User Support**: Single operator assumption
5. **Remote Deployment**: Local development only
6. **Authentication**: No auth required for dashboard
7. **Historical Analytics**: Basic event log only, no trend analysis
8. **Mobile Responsive**: Desktop-first dashboard

---

## Implementation Notes

### SQLite Schema (from study document)

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

### WebSocket Event Format

```json
{
  "type": "command:progress",
  "payload": {
    "story_key": "2a-1",
    "command": "dev-story",
    "task_id": "implement",
    "message": "Writing test files"
  }
}
```

### Dashboard Sprint Run Tab Layout

```
+--------------------------------------------------+
| Sprint Run                                        |
+--------------------------------------------------+
| [Start] [Stop] [Pause]    Cycles: [___] or [All] |
+--------------------------------------------------+
| Status: Running cycle 2/5                         |
| Current: 2a-1 dev-story (implement)              |
+--------------------------------------------------+
| Event Log (live):                                 |
| 14:32:01 2a-1 dev-story implement start          |
| 14:31:45 2a-1 dev-story setup end                |
| 14:31:30 2a-1 dev-story setup start              |
| ...                                               |
+--------------------------------------------------+
```

---

## References

- `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md` - Canonical workflow
- `_bmad-output/implementation-artifacts/sprint-runner-orchestrator-study.md` - Detailed analysis
- `task-taxonomy.yaml` - Fixed task phases per command
