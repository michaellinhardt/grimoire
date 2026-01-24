# Sprint Runner Dashboard

Python-based orchestrator and real-time dashboard for automated sprint execution.

## Overview

The Sprint Runner Dashboard provides:

- **Python Orchestrator** (`orchestrator.py`): Manages sprint execution workflow
- **WebSocket Server** (`server.py`): Real-time event streaming
- **SQLite Database** (`db.py`): Persistent state tracking
- **Dashboard UI** (`dashboard.html`): Visual monitoring interface

## File Structure

```
dashboard/
├── orchestrator.py       # Main orchestration engine
├── server.py            # aiohttp WebSocket server
├── db.py                # SQLite database module
├── dashboard.html       # Browser-based monitoring UI
├── requirements.txt     # Python dependencies
├── sprint-runner.db     # SQLite database (auto-created)
├── test_orchestrator.py # Orchestrator unit tests
├── test_server.py       # Server unit tests
├── test_db.py          # Database unit tests
├── test_integration.py  # Integration tests
└── test_parity.py      # Functional parity tests
```

## Quick Start

### Prerequisites

- Python 3.9+
- pip package manager

### Installation

```bash
cd _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard
pip install -r requirements.txt
```

### Running the Server

```bash
python server.py
```

The server starts on `http://localhost:8765` by default.

### Accessing the Dashboard

Open `http://localhost:8765` in your browser to view the real-time dashboard.

## API Endpoints

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard HTML page |
| `/ws` | GET | WebSocket connection |
| `/api/orchestrator/start` | POST | Start orchestration |
| `/api/orchestrator/stop` | POST | Stop orchestration |
| `/api/orchestrator/status` | GET | Get current status |
| `/story-descriptions.json` | GET | Story metadata |

### WebSocket Events

Connect to `/ws` to receive real-time events:

```javascript
const ws = new WebSocket('ws://localhost:8765/ws');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.payload);
};
```

#### Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `init` | `{batch, events, stories}` | Initial state on connect |
| `batch:start` | `{batch_id, max_cycles}` | Batch started |
| `batch:end` | `{batch_id, status}` | Batch completed/stopped |
| `story:start` | `{story_key, epic_id}` | Story processing started |
| `story:status` | `{story_key, status}` | Story status changed |
| `command:start` | `{command, task_id}` | Command phase started |
| `command:end` | `{command, status}` | Command phase completed |
| `context:create` | `{status}` | Project context creation |
| `context:refresh` | `{status}` | Background context refresh |
| `context:complete` | `{}` | Context generation complete |
| `context:fresh` | `{}` | Context is fresh, skipped |

## Database Schema

The SQLite database (`sprint-runner.db`) contains:

```sql
-- Batch runs
batches (id, started_at, ended_at, max_cycles, cycles_completed, status)

-- Story states
stories (id, batch_id, story_key, epic_id, status, started_at, ended_at)

-- Commands executed
commands (id, story_id, command, task_id, started_at, ended_at, status, output_summary)

-- Events log
events (id, batch_id, story_id, command_id, timestamp, epic_id, story_key, command, task_id, status, message)

-- Background tasks
background_tasks (id, batch_id, story_key, task_type, spawned_at, completed_at, status)
```

## Orchestrator Configuration

### Batch Modes

- **fixed**: Run a specific number of cycles (default: 2)
- **all**: Run until all stories are done

### Starting the Orchestrator

```bash
# Via HTTP API
curl -X POST http://localhost:8765/api/orchestrator/start \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 3, "mode": "fixed"}'
```

### Stopping the Orchestrator

```bash
curl -X POST http://localhost:8765/api/orchestrator/stop
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
              create_event() → SQLite database
```

## Deprecated Scripts

The following shell scripts are deprecated in favor of this Python implementation:

- `_bmad/scripts/project-context-should-refresh.sh` - Replaced by `orchestrator.check_project_context_status()`
- `_bmad/scripts/orchestrator.sh` - Replaced by `db.create_event()` and `server.emit_event()`

These scripts are kept for backwards compatibility but should not be used for new implementations.

## Troubleshooting

### Server won't start

1. Check if port 8765 is already in use
2. Verify Python version is 3.9+
3. Install dependencies: `pip install -r requirements.txt`

### WebSocket not connecting

1. Check browser console for errors
2. Verify server is running on correct port
3. Check firewall settings

### Database issues

1. Delete `sprint-runner.db` to reset state
2. Check write permissions in dashboard folder

## License

Part of the BMAD Framework.
