# Sprint Runner Dashboard

Python-based orchestrator and real-time dashboard for automated sprint execution.

## Overview

The Sprint Runner Dashboard provides:

- **Python Orchestrator** (`orchestrator.py`): Manages sprint execution workflow
- **WebSocket Server** (`server.py`): Real-time event streaming with batch history API
- **SQLite Database** (`db.py`): Persistent state tracking with event types and status validation
- **Dashboard UI** (`dashboard.html`): Split panel layout with batch history sidebar and real-time updates
- **Logging Script** (`sprint-log.sh`): CSV output for orchestrator parsing

## File Structure

```
dashboard/
├── orchestrator.py       # Main orchestration engine
├── server.py            # aiohttp WebSocket server with batch history API
├── db.py                # SQLite database module with event types
├── dashboard.html       # Browser-based monitoring UI (split panel layout)
├── requirements.txt     # Python dependencies
├── sprint-runner.db     # SQLite database (auto-created)
├── sprint.log           # Human-readable log output
├── test_orchestrator.py # Orchestrator unit tests
├── test_server.py       # Server unit tests
├── test_db.py          # Database unit tests
├── test_integration.py  # Integration tests
├── test_parity.py      # Functional parity tests
├── UIUX-SPECIFICATION.md # Complete UI/UX design specification
└── README.md           # This file
```

## Quick Start

### Prerequisites

- Python 3.9+
- pip package manager
- jq (for sprint-log.sh script)

### Installation

```bash
cd _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard
pip install -r requirements.txt
```

### Running the Server

```bash
python server.py
```

The server starts on `http://localhost:8080` by default.

### Accessing the Dashboard

Open `http://localhost:8080` in your browser to view the real-time dashboard.

## Dashboard UI

### Split Panel Layout

The dashboard uses a split panel layout with three main sections:

```
+-----------------------------------------------------------------------------+
|                         SPRINT RUN HEADER                                    |
|  [Start] [Stop]  |  Batch Mode: [n] [All]  |  [Settings]  |  Connection: *   |
+--------------------+--------------------------------------------------------+
|                    |                                                        |
|  BATCH HISTORY     |              MAIN CONTENT AREA                        |
|  SIDEBAR           |                                                        |
|  (240px,           |  +--------------------------------------------------+  |
|   collapsible)     |  | BATCH HEADER                                      |  |
|                    |  | Batch #42  *Running  |  2h 15m  |  Cycle 2/5       |  |
|  +----------------+|  +--------------------------------------------------+  |
|  | * #42 Running  ||                                                        |
|  |   #41 Done     ||  +--------------------------------------------------+  |
|  |   #40 Done     ||  | ACTIVE OPERATIONS (Pulsing)                       |  |
|  |   X #39 Failed ||  | [Currently running commands with live updates]    |  |
|  |   #38 Done     ||  +--------------------------------------------------+  |
|  +----------------+|                                                        |
|                    |  +--------------------------------------------------+  |
|  [Collapse <<]     |  | STORY LIST                                        |  |
|                    |  | [Expandable story cards with command hierarchy]   |  |
+--------------------+--------------------------------------------------------+
```

### Key UI Components

1. **Batch History Sidebar**: Collapsible sidebar showing all batch runs with pagination
2. **Batch Header**: Current batch status with progress bar and cycle information
3. **Active Operations**: Real-time display of running commands with pulse animations
4. **Story List**: Expandable cards showing story > command > task hierarchy

### Responsive Behavior

| Breakpoint | Sidebar Behavior | Main Content |
|------------|------------------|--------------|
| >= 1200px  | Visible, 240px fixed | Full width remaining |
| 900-1199px | Visible, 200px | Compressed content |
| < 900px    | Hidden, overlay on toggle | Full width |

### Animation System

| Animation | When Applied | Duration | Easing |
|-----------|--------------|----------|--------|
| Pulse Glow | Running operations | 2s infinite | ease-in-out |
| Progress Shimmer | Active progress bars | 2s infinite | linear |
| Completion Flash | Command/task ends successfully | 600ms | ease-out |
| Error Shake | Command/task fails | 500ms | ease-out |
| Expand/Collapse | Story/command expand | 300ms | ease-out |
| Connection Pulse | Connected indicator | 2s infinite | ease-in-out |

## CSS Variables

The dashboard uses CSS custom properties for consistent theming. Key variables include:

### Colors - Base

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-bg` | `#f7f6f3` | Page background |
| `--color-surface` | `#ffffff` | Cards, panels |
| `--color-text` | `#37352f` | Body text, headings |
| `--color-text-secondary` | `#787774` | Labels, metadata |
| `--color-text-muted` | `#9ca3af` | Disabled, placeholder |
| `--color-border` | `#e8e7e5` | Dividers, card outlines |

### Colors - Status

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-running` | `#3b82f6` | Active operations |
| `--color-success` | `#10b981` | Completed items |
| `--color-error` | `#ef4444` | Failed items |
| `--color-warning` | `#f59e0b` | Warnings, running batches |
| `--color-pending` | `#9ca3af` | Pending items |

### Colors - Commands

| Command | Primary | Background |
|---------|---------|------------|
| create-story | `#3b82f6` | `#dbeafe` |
| story-review | `#f59e0b` | `#fef3c7` |
| create-tech-spec | `#6366f1` | `#e0e7ff` |
| tech-spec-review | `#8b5cf6` | `#ede9fe` |
| dev-story | `#22c55e` | `#dcfce7` |
| code-review | `#a855f7` | `#f3e8ff` |
| commit | `#14b8a6` | `#ccfbf1` |

### Layout

| Variable | Value | Description |
|----------|-------|-------------|
| `--sidebar-width` | `240px` | Expanded sidebar width |
| `--sidebar-collapsed` | `48px` | Collapsed sidebar width |
| `--header-height` | `56px` | Header bar height |
| `--footer-height` | `32px` | Footer bar height |

### Z-Index Hierarchy

| Layer | Z-Index | Components |
|-------|---------|------------|
| Base | 0 | Main content, cards |
| Elevated | 10 | Sidebar |
| Overlay | 100 | Mobile sidebar overlay |
| Modal | 1000 | Dialogs, context menus |
| Toast | 2000 | Notifications |

## API Endpoints

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard HTML page |
| `/ws` | GET | WebSocket connection |
| `/api/orchestrator/start` | POST | Start orchestration |
| `/api/orchestrator/stop` | POST | Stop orchestration |
| `/api/orchestrator/status` | GET | Get current status |
| `/api/batches` | GET | List batches with pagination |
| `/api/batches/:id` | GET | Get batch details with stories |
| `/story-descriptions.json` | GET | Story metadata |

### Batch History API

#### List Batches

```
GET /api/batches?limit=20&offset=0
```

Response:
```json
{
  "batches": [
    {
      "id": 42,
      "started_at": 1706112000000,
      "ended_at": 1706120000000,
      "max_cycles": 5,
      "cycles_completed": 5,
      "status": "completed",
      "story_count": 8,
      "duration_seconds": 8000
    }
  ],
  "total": 42
}
```

#### Get Batch Details

```
GET /api/batches/42
```

Response:
```json
{
  "batch": { ... },
  "stories": [
    {
      "id": 1,
      "story_key": "2a-1",
      "epic_id": "2a",
      "status": "done",
      "commands": [ ... ]
    }
  ],
  "stats": {
    "story_count": 8,
    "command_count": 42,
    "stories_done": 7,
    "stories_failed": 1
  }
}
```

### WebSocket Events

Connect to `/ws` to receive real-time events:

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.payload, data.timestamp);
};
```

#### Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `init` | `{batch, events}` | Initial state on connect |
| `batch:start` | `{batch_id, max_cycles}` | Batch started |
| `batch:end` | `{batch_id, cycles_completed, status}` | Batch completed/stopped |
| `batch:warning` | `{batch_id, message, warning_type}` | Batch warning |
| `cycle:start` | `{cycle_number, story_keys}` | Cycle started |
| `cycle:end` | `{cycle_number, completed_stories}` | Cycle completed |
| `story:status` | `{story_key, old_status, new_status}` | Story status changed |
| `command:start` | `{story_key, command, task_id}` | Command phase started |
| `command:progress` | `{story_key, command, task_id, message}` | Command progress update |
| `command:end` | `{story_key, command, task_id, status}` | Command phase completed |
| `context:create` | `{story_key, context_type}` | Project context creation |
| `context:refresh` | `{story_key, context_type}` | Background context refresh |
| `context:complete` | `{story_key, context_type, status}` | Context generation complete |
| `error` | `{type, message}` | Error occurred |
| `pong` | `{}` | Ping response |

#### Event Message Format

All WebSocket events follow this structure:

```json
{
  "type": "command:start",
  "timestamp": 1706112000000,
  "payload": {
    "story_key": "2a-1",
    "command": "create-story",
    "task_id": "setup"
  }
}
```

## Database Schema

The SQLite database (`sprint-runner.db`) contains:

```sql
-- Batch runs
batches (
    id INTEGER PRIMARY KEY,
    started_at INTEGER NOT NULL,      -- Millisecond timestamp
    ended_at INTEGER,                 -- Millisecond timestamp
    max_cycles INTEGER NOT NULL,
    cycles_completed INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running'
)

-- Story states with status validation
stories (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_key TEXT NOT NULL,
    epic_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in-progress',  -- Validated values
    started_at INTEGER NOT NULL,      -- Millisecond timestamp
    ended_at INTEGER,                 -- Millisecond timestamp
    FOREIGN KEY (batch_id) REFERENCES batches(id)
)

-- Commands executed
commands (
    id INTEGER PRIMARY KEY,
    story_id INTEGER NOT NULL,
    command TEXT NOT NULL,
    task_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,      -- Millisecond timestamp
    ended_at INTEGER,                 -- Millisecond timestamp
    status TEXT NOT NULL DEFAULT 'running',
    output_summary TEXT,
    FOREIGN KEY (story_id) REFERENCES stories(id)
)

-- Events log with event_type column
events (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_id INTEGER,
    command_id INTEGER,
    timestamp INTEGER NOT NULL,       -- Millisecond timestamp
    event_type TEXT NOT NULL,         -- e.g., 'command:start', 'command:end'
    epic_id TEXT NOT NULL,
    story_key TEXT NOT NULL,
    command TEXT NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (command_id) REFERENCES commands(id)
)

-- Background tasks
background_tasks (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_key TEXT NOT NULL,
    task_type TEXT NOT NULL,
    spawned_at INTEGER NOT NULL,      -- Millisecond timestamp
    completed_at INTEGER,             -- Millisecond timestamp
    status TEXT NOT NULL DEFAULT 'running',
    FOREIGN KEY (batch_id) REFERENCES batches(id)
)
```

### Valid Story Statuses

The `stories.status` field is validated against:

- `pending` - Story created but not started
- `in-progress` - Story currently being worked on
- `done` - Story completed successfully
- `failed` - Story failed after max retries
- `blocked` - Story blocked by external issue
- `skipped` - Story skipped (e.g., dependencies not met)

### Timestamps

All timestamps are stored in milliseconds since epoch for precise timing.

## Logging

### sprint-log.sh

The logging script outputs CSV format for orchestrator parsing:

```bash
./sprint-log.sh '{"epic_id":"2a","story_id":"2a-1","command":"create-story","task_id":"setup","status":"start","message":"Initializing"}'
```

#### Output Formats

**stdout (CSV):**
```
timestamp,epicID,storyID,command,task-id,status,"message"
2026-01-24 10:30:00,2a,2a-1,create-story,setup,start,"Initializing"
```

**Log file (Human-readable):**
```
[2026-01-24 10:30:00] [2a/2a-1] [create-story:setup] [start] Initializing
```

#### Required JSON Fields

- `epic_id` - Epic identifier (e.g., "2a")
- `story_id` - Story identifier (e.g., "2a-1")
- `command` - Command name (e.g., "create-story")
- `task_id` - Task phase (e.g., "setup")
- `status` - Event status (e.g., "start", "end", "progress")

#### Optional JSON Fields

- `message` - Event message
- `metrics` - Performance metrics
- `attempt` - Retry attempt number

## Orchestrator Configuration

### Batch Modes

- **fixed**: Run a specific number of cycles (default: 2)
- **all**: Run until all stories are done

### Starting the Orchestrator

```bash
# Via HTTP API
curl -X POST http://localhost:8080/api/orchestrator/start \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 3}'

# Run all stories
curl -X POST http://localhost:8080/api/orchestrator/start \
  -H "Content-Type: application/json" \
  -d '{"batch_size": "all"}'
```

### Stopping the Orchestrator

```bash
curl -X POST http://localhost:8080/api/orchestrator/stop
```

### Getting Status

```bash
curl http://localhost:8080/api/orchestrator/status
```

Response:
```json
{
  "status": "running",
  "batch_id": 42,
  "cycles_completed": 2,
  "max_cycles": 5,
  "current_stories": ["2a-1", "2a-2"]
}
```

## Testing

### Run All Tests

```bash
python -m pytest test_*.py -v
```

### Run Specific Test Suites

```bash
# Unit tests
python -m pytest test_orchestrator.py test_server.py test_db.py -v

# Integration tests
python -m pytest test_integration.py -v

# Functional parity tests
python -m pytest test_parity.py -v
```

### Test Coverage

```bash
python -m pytest test_*.py --cov=. --cov-report=html
```

## Architecture

### Workflow Sequence

```
1. Context Check (blocking if missing, background if expired)
2. Read sprint-status.yaml
3. Select stories (pair up to 2 from same epic)
4. CREATE-STORY phase (parallel: create-story + discovery)
5. STORY-REVIEW phase (review-1 blocking, review-2/3 background)
6. CREATE-TECH-SPEC phase (conditional)
7. TECH-SPEC-REVIEW phase (review-1 blocking, review-2/3 background)
8. DEV + CODE-REVIEW phase (sequential per story)
9. BATCH-COMMIT phase
10. Repeat or prompt for next batch
```

### Event Flow

```
Orchestrator → emit_event() → WebSocket broadcast → Dashboard UI
                    ↓
              create_event() → SQLite database (with event_type)
```

### Component Architecture

```
dashboard.html
├── app-layout (CSS Grid)
│   ├── app-header
│   │   ├── controls (Start/Stop)
│   │   ├── batch-mode-controls
│   │   └── connection-indicator
│   ├── batch-sidebar
│   │   ├── sidebar-header
│   │   ├── batch-items (virtual scroll)
│   │   └── load-more button
│   ├── main-content
│   │   ├── batch-header
│   │   ├── active-operations
│   │   └── story-list
│   └── app-footer
```

## Deprecated Scripts

The following shell scripts are deprecated in favor of this Python implementation:

- `_bmad/scripts/project-context-should-refresh.sh` - Replaced by `orchestrator.check_project_context_status()`
- `_bmad/scripts/orchestrator.sh` - Replaced by `db.create_event()` and `server.emit_event()`

These scripts are kept for backwards compatibility but should not be used for new implementations.

## Troubleshooting

### Server won't start

1. Check if port 8080 is already in use
2. Verify Python version is 3.9+
3. Install dependencies: `pip install -r requirements.txt`

### WebSocket not connecting

1. Check browser console for errors
2. Verify server is running on correct port
3. Check firewall settings

### Database issues

1. Delete `sprint-runner.db` to reset state
2. Check write permissions in dashboard folder
3. Server cleans up stale batches on startup

### Batch history not loading

1. Check `/api/batches` endpoint response
2. Verify database has batch records
3. Check browser network tab for errors

## Related Documentation

- [UI/UX Specification](./UIUX-SPECIFICATION.md) - Complete design specification

## License

Part of the BMAD Framework.
