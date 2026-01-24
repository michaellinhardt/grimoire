# Memory: Dashboard Restructuring Project

## Project Goal

Restructure the `dashboard/` folder into `server/` and `frontend/` folders:
- `server/`: All Python code (server.py, orchestrator.py, db.py, tests) + new shared.py + settings.py
- `frontend/`: HTML/CSS/JS split into feature modules with settings page
- Remove `sprint.log` (unused), update `sprint-log.sh` to write directly to SQLite

## Completed Phases

### 1. Clarify Phase - DONE
- orchestrator.py stays with server
- Feature-based JS architecture
- Tests stay in server/
- Data files in server/, sprint.log removed
- Create shared.py + settings.py + settings page

### 2. Change Context Phase - DONE
- Created `CHANGE-CONTEXT.md` with complete specification

### 3. Study Phase (Parallel) - DONE
- `STUDY-DASHBOARD-SERVER.md`: HTTP routes, WebSocket, CSS/JS structure
- `STUDY-SERVER-SPAWN.md`: subprocess spawning, constants, coupling

### 4. Study Review Phase - DONE
- Review 1: PASS (after corrections)
- Review 2: NEEDS-WORK (timestamp format mismatch)

### 5. Study Coherence Review - DONE
- Status: COHERENT

### 6. Plan Phase (Parallel) - DONE
- `PLAN-SERVER.md`: 7-step implementation plan
- `PLAN-FRONTEND.md`: 6-phase implementation plan

### 7. Plan Review Phase (Parallel) - DONE
- Server: NEEDS-WORK (path error, import strategy, PORT duplication)
- Frontend: NEEDS-WORK (line numbers off, missing functions)

### 8. Plan Coherence Review - DONE
- Status: COHERENT (with fixes needed)

### 9. Haiku Review Phase (Parallel) - DONE
- Server: 7 additional issues (validation, imports, rollback)
- Frontend: 6 additional issues (race conditions, browser compat)

### 10. Plan Fix Phase (Parallel) - DONE
**Server Plan Fixes Applied (11 total):**
1. Fixed find_project_root() - starts at Path(__file__).parent
2. Removed PORT from shared.py - use get_settings().server_port
3. Removed DASHBOARD_DIR - only FRONTEND_DIR
4. Replaced @property with getter methods
5. Added import strategy section (relative imports)
6. Fixed sprint-log.sh line range (66-78)
7. Added settings validation
8. Fixed test imports (parent.parent)
9. Added CORS headers to error responses
10. Added rollback for settings.json
11. Added warning for corrupt settings.json

**Frontend Plan Fixes Applied (13 total):**
1. Fixed stories.js line numbers (4432-4704)
2. Fixed toggleEpic → toggleEpicCard
3. Added handleBatchState() to batch.js
4. Added DOMContentLoaded wrapper
5. Added missing utils.js functions
6. Added missing main.js functions
7. Clarified sprintRunState ownership
8. Added wss:// protocol check
9. Added localStorage prefix strategy
10. Added CSS namespace for settings
11. Added error state UI
12. Added Settings tab position (6th)
13. Updated dependency diagram

### 11. Implementation Phase (Parallel) - DONE
**Server Implementation:**
- Created `server/` folder with `__init__.py`, `shared.py`, `settings.py`
- Moved server.py, orchestrator.py, db.py into server/
- Moved all test files into server/
- Updated all imports to relative form (`.shared`, `.db`, `.settings`)
- Added GET/PUT `/api/settings` handlers
- Fixed sprint-log.sh to use `date +%s` (Unix epoch)
- Removed sprint.log

**Frontend Implementation:**
- Created `frontend/` folder with `css/`, `js/`, `assets/` subfolders
- Extracted CSS to `styles.css` (3,332 lines)
- Created 9 JS modules in correct load order
- Created `index.html` (426 lines)
- Settings tab as 6th tab with 9 server settings

### 12. Implementation Review Phase (Parallel) - DONE
**Server Review - NEEDS-WORK → FIXED:**
- Issue 1: test_db.py missing `event_type` in `create_event` calls → Fixed
- Issue 2: Test timestamp unit mismatch (seconds vs ms) → Fixed
- Issue 3: Unused `field` import in settings.py → Fixed
- Verification: PASS (65 tests pass)

**Frontend Review - NEEDS-WORK → FIXED:**
- Issue 1: Settings implemented wrong values (UI prefs vs server settings) → Fixed
- Issue 2: Settings used localStorage instead of API → Fixed
- Issue 3: Tab ID naming (`sprintrun` vs `sprint-run`) → Fixed
- Verification: PASS (all 9 settings correct, API calls verified)

### 13. Runtime Test - DONE
**Test Results:**
- `GET /` → 200 ✓ (index.html)
- `GET /css/styles.css` → 404 ✗ → **Fixed** → 200 ✓
- `GET /js/*.js` (all 9) → 404 ✗ → **Fixed** → 200 ✓
- `GET /api/settings` → 200 ✓

**Bug Found & Fixed:**
- Route pattern `/{filename}` didn't match nested paths like `css/styles.css`
- Fixed to `/{filename:.*}` to capture paths with slashes
- Added explicit MIME type handling for `.css`, `.js`, `.html`, `.svg`, `.png`, `.ico`

## PROJECT COMPLETE ✓

## Files Created

| File | Purpose | Status |
|------|---------|--------|
| CHANGE-CONTEXT.md | Complete change specification | Done |
| STUDY-DASHBOARD-SERVER.md | Dashboard ↔ Server analysis | Done |
| STUDY-SERVER-SPAWN.md | Server ↔ Spawn analysis | Done |
| REVIEW-DASHBOARD-SERVER.md | Study 1 review | Done |
| REVIEW-SERVER-SPAWN.md | Study 2 review | Done |
| REVIEW-COHERENCE.md | Cross-study coherence | Done |
| PLAN-SERVER.md | Server implementation plan | **FIXED** |
| PLAN-FRONTEND.md | Frontend implementation plan | **FIXED** |
| REVIEW-PLAN-SERVER.md | Server plan review | Done |
| REVIEW-PLAN-FRONTEND.md | Frontend plan review | Done |
| REVIEW-PLAN-COHERENCE.md | Cross-plan coherence | Done |
| HAIKU-REVIEW-SERVER.md | Additional server issues | Done |
| HAIKU-REVIEW-FRONTEND.md | Additional frontend issues | Done |
| memory.md | This file | Updated |

## Final Structure

```
dashboard/
├── server/
│   ├── __init__.py
│   ├── shared.py          (path constants, find_project_root)
│   ├── settings.py        (9 settings + validation + API)
│   ├── server.py          (HTTP/WebSocket server)
│   ├── orchestrator.py    (workflow automation)
│   ├── db.py              (SQLite database)
│   ├── sprint-runner.db
│   ├── requirements.txt
│   ├── test_db.py
│   ├── test_server.py
│   ├── test_orchestrator.py
│   ├── test_integration.py
│   └── test_parity.py
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── utils.js
│   │   ├── websocket.js
│   │   ├── sidebar.js
│   │   ├── controls.js
│   │   ├── batch.js
│   │   ├── stories.js
│   │   ├── operations.js
│   │   ├── settings.js
│   │   └── main.js
│   └── assets/
└── sprint-log.sh          (uses date +%s)
```

## Critical Technical Details

### Server shared.py Constants
- PROJECT_ROOT = find_project_root() (walks up from current)
- ARTIFACTS_DIR = PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"
- FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
- DB_PATH = Path(__file__).parent / "sprint-runner.db"

### Settings (9 total)
| Setting | Default | Type |
|---------|---------|------|
| project_context_max_age_hours | 24 | int |
| injection_warning_kb | 100 | int |
| injection_error_kb | 150 | int |
| default_max_cycles | 2 | int |
| max_code_review_attempts | 10 | int |
| haiku_after_review | 2 | int |
| server_port | 8080 | int |
| websocket_heartbeat_seconds | 30 | int |
| default_batch_list_limit | 20 | int |

### Frontend JS Modules (load order)
1. utils.js - pure functions, localStorage prefix
2. websocket.js - wss:// protocol detection
3. sidebar.js - batch history
4. controls.js - start/stop (uses main.js state)
5. batch.js - batch display
6. stories.js - story cards
7. operations.js - active operations
8. settings.js - settings page
9. main.js - owns state, DOMContentLoaded init

### Entry Points
- Server: `cd dashboard && python -m server.server`
- Frontend: Load index.html (served by server)
