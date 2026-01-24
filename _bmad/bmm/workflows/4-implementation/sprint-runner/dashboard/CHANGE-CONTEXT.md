# Change Context: Dashboard Folder Restructuring

## Overview

This document describes the complete restructuring of the `dashboard/` folder into a `server/` and `frontend/` architecture, with centralized configuration and settings management.

## Current State

```
dashboard/
├── orchestrator.py       # Workflow automation engine
├── server.py             # WebSocket server + HTTP API
├── db.py                 # SQLite database module
├── dashboard.html        # Monolithic UI (~300KB)
├── requirements.txt      # Python dependencies
├── sprint-runner.db      # SQLite database
├── sprint.log            # Log file (TO BE REMOVED)
├── test_orchestrator.py  # Tests
├── test_server.py        # Tests
├── test_db.py            # Tests
├── test_integration.py   # Tests
├── test_parity.py        # Tests
└── README.md             # Documentation
```

## Target State

```
dashboard/
├── server/
│   ├── __init__.py           # Package init
│   ├── server.py             # WebSocket server + HTTP API
│   ├── orchestrator.py       # Workflow automation engine
│   ├── db.py                 # SQLite database module
│   ├── shared.py             # NEW: Centralized constants/paths
│   ├── settings.py           # NEW: Configurable settings
│   ├── requirements.txt      # Python dependencies
│   ├── sprint-runner.db      # SQLite database
│   ├── test_orchestrator.py  # Tests
│   ├── test_server.py        # Tests
│   ├── test_db.py            # Tests
│   ├── test_integration.py   # Tests
│   └── test_parity.py        # Tests
├── frontend/
│   ├── index.html            # Main entry point
│   ├── css/
│   │   └── styles.css        # All CSS extracted
│   ├── js/
│   │   ├── main.js           # App initialization
│   │   ├── websocket.js      # WebSocket connection management
│   │   ├── sidebar.js        # Batch history sidebar
│   │   ├── controls.js       # Start/Stop/Settings controls
│   │   ├── batch.js          # Batch header & progress
│   │   ├── stories.js        # Story list & cards
│   │   ├── operations.js     # Active operations display
│   │   ├── settings.js       # NEW: Settings page UI
│   │   └── utils.js          # Shared utilities
│   └── assets/               # Any static assets (if needed)
└── README.md                 # Updated documentation
```

## Change Categories

### Category 1: Server Restructuring

#### Files to Move
- `server.py` → `server/server.py`
- `orchestrator.py` → `server/orchestrator.py`
- `db.py` → `server/db.py`
- `requirements.txt` → `server/requirements.txt`
- `sprint-runner.db` → `server/sprint-runner.db`
- `test_*.py` → `server/test_*.py`

#### Files to Create
1. **`server/__init__.py`** - Package initialization
2. **`server/shared.py`** - Centralized shared data:
   - `PROJECT_ROOT` - Project root path
   - `ARTIFACTS_DIR` - Implementation artifacts path
   - `DASHBOARD_DIR` - Dashboard directory path
   - `DB_PATH` - Database file path
   - `PORT` - Server port
   - All path constants currently scattered across files

3. **`server/settings.py`** - Configurable settings:
   - `max_cycles_default` - Default batch size
   - `batch_mode_default` - Default batch mode (fixed/all)
   - `project_context_max_age_hours` - Context freshness threshold
   - `injection_warning_threshold_kb` - Prompt injection size warning
   - `injection_error_threshold_kb` - Prompt injection size error
   - `websocket_heartbeat_seconds` - Heartbeat interval
   - `code_review_max_attempts` - Max code review loop iterations
   - `haiku_after_review_n` - Switch to Haiku after N reviews
   - Settings persistence (JSON file or SQLite table)
   - API endpoints for reading/updating settings

#### Files to Remove
- `sprint.log` - Unused, replaced by SQLite

#### Import Updates Required
All Python files must update imports to use:
```python
from shared import PROJECT_ROOT, ARTIFACTS_DIR, DB_PATH, ...
from settings import Settings, get_settings, update_settings
```

### Category 2: Frontend Restructuring

#### Files to Create from dashboard.html

1. **`frontend/index.html`** - Minimal HTML structure:
   - DOCTYPE and head (meta, title, CSS links)
   - Body structure with component containers
   - Script imports at bottom

2. **`frontend/css/styles.css`** - All CSS extracted:
   - CSS variables (colors, layout, z-index)
   - Base styles
   - Component styles (header, sidebar, main, footer)
   - Animation keyframes
   - Responsive breakpoints

3. **`frontend/js/main.js`** - Application bootstrap:
   - DOM ready handler
   - Initialize all modules
   - Global state management

4. **`frontend/js/websocket.js`** - WebSocket management:
   - Connection establishment
   - Reconnection logic
   - Event dispatching
   - Ping/pong handling

5. **`frontend/js/sidebar.js`** - Batch history sidebar:
   - Sidebar toggle
   - Batch list rendering
   - Batch selection
   - Pagination/load more

6. **`frontend/js/controls.js`** - Header controls:
   - Start/Stop buttons
   - Batch mode selector
   - Connection indicator

7. **`frontend/js/batch.js`** - Batch display:
   - Batch header rendering
   - Progress bar
   - Cycle information

8. **`frontend/js/stories.js`** - Story list:
   - Story card rendering
   - Command hierarchy
   - Expand/collapse
   - Status updates

9. **`frontend/js/operations.js`** - Active operations:
   - Running command display
   - Pulse animations
   - Real-time updates

10. **`frontend/js/settings.js`** - Settings page:
    - Settings form UI
    - Fetch current settings from API
    - Update settings via API
    - Validation

11. **`frontend/js/utils.js`** - Shared utilities:
    - Time formatting
    - Status color mapping
    - DOM helpers

### Category 3: Script Updates

#### `scripts/sprint-log.sh`
Current behavior: Writes to `dashboard/sprint.log`
New behavior: Write directly to SQLite database

Changes required:
- Remove log file writing
- Add SQLite insert via `sqlite3` CLI command
- Use same database path as server (`server/sprint-runner.db`)

### Category 4: Server API Updates

#### New Endpoints for Settings
- `GET /api/settings` - Retrieve all settings
- `PUT /api/settings` - Update settings
- `GET /api/settings/:key` - Get single setting
- `PUT /api/settings/:key` - Update single setting

#### Updated Static File Serving
- Serve `frontend/index.html` at `/`
- Serve `frontend/css/*` at `/css/*`
- Serve `frontend/js/*` at `/js/*`

### Category 5: Path Updates

#### Hardcoded Paths to Update

In `server.py`:
- `DASHBOARD_DIR = Path(__file__).parent` → Points to `server/`
- Static file serving must point to `../frontend/`

In `orchestrator.py`:
- `PROJECT_CONTEXT_MAX_AGE_SECONDS` → Move to settings
- `INJECTION_WARNING_THRESHOLD_BYTES` → Move to settings
- `INJECTION_ERROR_THRESHOLD_BYTES` → Move to settings

In `db.py`:
- `DB_PATH = Path(__file__).parent / 'sprint-runner.db'` → Use from shared.py

In `scripts/sprint-log.sh`:
- `DASHBOARD_DIR` path reference
- Log file path → Database path

## Settings to Extract

From `orchestrator.py`:
| Current | Setting Name | Default | Description |
|---------|-------------|---------|-------------|
| `PROJECT_CONTEXT_MAX_AGE_SECONDS = 24 * 3600` | `project_context_max_age_hours` | 24 | Hours before context refresh |
| `INJECTION_WARNING_THRESHOLD_BYTES = 100 * 1024` | `injection_warning_kb` | 100 | Warn if injection exceeds KB |
| `INJECTION_ERROR_THRESHOLD_BYTES = 150 * 1024` | `injection_error_kb` | 150 | Error if injection exceeds KB |
| `max_cycles=2` (default) | `default_max_cycles` | 2 | Default cycles for fixed mode |
| `review_attempt <= 10` | `max_code_review_attempts` | 10 | Max code review iterations |
| `model = "haiku" if review_attempt >= 2` | `haiku_after_review` | 2 | Use Haiku after N reviews |

From `server.py`:
| Current | Setting Name | Default | Description |
|---------|-------------|---------|-------------|
| `PORT = 8080` | `server_port` | 8080 | HTTP server port |
| `heartbeat=30.0` | `websocket_heartbeat_seconds` | 30 | WebSocket heartbeat interval |
| `limit = 20` (batches) | `default_batch_list_limit` | 20 | Default pagination limit |

## Acceptance Criteria

### Server Changes
- [ ] All Python files moved to `server/` folder
- [ ] `shared.py` contains all centralized constants
- [ ] `settings.py` provides read/write settings API
- [ ] All imports updated to use `shared.py`
- [ ] Server starts correctly from `server/` folder
- [ ] All tests pass after restructuring
- [ ] `sprint.log` removed, script writes to SQLite

### Frontend Changes
- [ ] `index.html` loads and displays dashboard
- [ ] CSS extracted to `css/styles.css`
- [ ] JS split into feature modules
- [ ] All existing functionality preserved
- [ ] Settings page allows viewing/editing all settings
- [ ] WebSocket connection works with new paths

### Integration
- [ ] Server serves frontend from correct paths
- [ ] Settings changes persist and take effect
- [ ] No broken references or 404 errors
- [ ] README updated with new structure

## Non-Goals

- No changes to business logic
- No new features beyond settings UI
- No refactoring of algorithms or data structures
- No changes to command instructions (XML files)
- No changes to workflow logic

## Dependencies

- Frontend depends on Server API paths
- Server modules depend on shared.py
- Settings page depends on settings API
- sprint-log.sh depends on database schema (already exists)

## Risk Areas

1. **Import cycles** - shared.py must not import from other modules
2. **Path resolution** - Frontend paths must work relative to server location
3. **Test isolation** - Tests may need path adjustments
4. **Settings persistence** - Need to handle missing settings file gracefully
