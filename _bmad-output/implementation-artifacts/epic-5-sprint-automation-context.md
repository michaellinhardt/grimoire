# Change Request Context: Sprint Runner Automation

## Overview

Replace the Claude Code orchestrator agent with a Python-based automation script that provides:
- Full programmatic control over the sprint workflow
- SQLite database for state persistence and history
- WebSocket-based real-time dashboard updates
- Dashboard UI control (start/stop) via new "Sprint Run" tab

## Business Value

1. **Reliability**: Scripted logic is deterministic, no LLM interpretation variance
2. **Performance**: Faster execution without orchestrator agent overhead
3. **Observability**: Full database history of all runs, commands, events
4. **Control**: Dashboard becomes mission control for sprint execution
5. **Cost Reduction**: Eliminates orchestrator agent token usage

## Scope

### In Scope
- New `dashboard/` folder in sprint-runner command
- Python orchestrator script with asyncio
- SQLite database for all state
- WebSocket server for real-time events
- Updated dashboard with "Sprint Run" tab
- Dashboard state persistence (localStorage)
- Partial DOM updates (no full page reloads)
- Toast notifications for errors/events
- Relocate existing dashboard.html and server.py
- Update all path references in prompts

### Out of Scope
- Changes to individual workflow prompts (create-story.md, etc.) beyond JSON markers
- Changes to sprint-status.yaml format
- New parallelization strategies (follow existing workflow)

## Technical Approach

### Architecture
```
dashboard/
├── server.py              # aiohttp server (HTTP + WebSocket)
├── orchestrator.py        # Main loop logic
├── database.py            # SQLite operations
├── models.py              # Data models (Batch, Story, Command, Event)
├── conditions.py          # Workflow condition evaluator
├── dashboard.html         # Updated with Sprint Run tab
├── static/
│   ├── app.js             # Dashboard JavaScript
│   └── styles.css         # Extracted styles
└── sprint-runner.db       # SQLite database (created at runtime)
```

### Key Behaviors

1. **Project Context Refresh**
   - File doesn't exist → Create and WAIT before proceeding
   - File exists but expired → Start refresh in BACKGROUND, continue loop
   - File exists and fresh → Skip

2. **Batch Control**
   - Dashboard sends: `{ action: "start", max_cycles: N }` or `{ action: "start", max_cycles: "all" }`
   - Dashboard sends: `{ action: "stop" }` to gracefully stop after current story
   - Script responds with real-time events via WebSocket

3. **State Persistence**
   - SQLite: batches, stories, commands, events tables
   - Dashboard: localStorage for UI state (filters, expanded, selected)

4. **Real-time Updates**
   - WebSocket events for all state changes
   - Partial DOM updates (no full reload)
   - Toast notifications for important events

### CLI Invocation
```bash
claude -p "prompt content" --output-format stream-json
```
Script parses JSON stream, extracts task-taxonomy events.

## Dependencies

- Python 3.9+
- aiohttp
- aiosqlite
- PyYAML
- websockets (or aiohttp built-in)

## Risks

| Risk | Mitigation |
|------|------------|
| CLI output format changes | Pin Claude Code version, defensive parsing |
| Background task tracking | Database tracks spawned_at/completed_at |
| State corruption on crash | Write-ahead logging, atomic transactions |
| Dashboard WebSocket disconnect | Auto-reconnect with exponential backoff |

## Success Criteria

1. Sprint can run from dashboard Start button
2. All events appear in real-time in Sprint Run tab
3. Dashboard state persists across refreshes
4. Full history available in SQLite database
5. Graceful stop works mid-cycle
6. Error toasts appear for failures
7. No full page reloads during operation

## References

- Study document: `sprint-runner-orchestrator-study.md`
- Current instructions: `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`
- Task taxonomy: `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml`
