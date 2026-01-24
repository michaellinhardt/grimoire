# STUDY-DASHBOARD-SERVER.md: Dashboard ↔ Server Investigation Report

## Executive Summary

The sprint-runner dashboard system implements a **real-time WebSocket-driven architecture** with a Python aiohttp server backend and a monolithic HTML5 frontend (~7545 lines). The system uses:

- **WebSocket**: Bi-directional real-time event streaming from orchestrator to dashboard
- **REST API**: HTTP endpoints for orchestrator control, batch history, and static file serving
- **SQLite Database**: Persistent state tracking for batches, stories, commands, and events
- **Orchestrator Bridge**: Direct event emission from orchestrator.py via server.py's broadcast mechanism

## 1. HTTP Routes & Static Serving

### Route Configuration (server.py, lines 970-989)

**WebSocket & Dashboard:**
- `GET /ws` → `websocket_handler()` - Real-time event streaming
- `GET /` → `index_handler()` - Serves dashboard.html

**API Endpoints:**
- `GET /story-descriptions.json` → `story_descriptions_handler()` - Dynamically extracts story descriptions from artifact files
- `POST /api/orchestrator/start` → `orchestrator_start_handler()` - Starts batch execution
- `POST /api/orchestrator/stop` → `orchestrator_stop_handler()` - Stops running batch
- `GET /api/orchestrator/status` → `orchestrator_status_handler()` - Returns orchestrator state
- `GET /api/batches` → `batches_list_handler()` - Lists batch history with pagination
- `GET /api/batches/{batch_id}` → `batch_detail_handler()` - Returns single batch with stories/commands
- `GET /{filename}` → `serve_file_handler()` - Whitelisted static file serving

**CORS Preflight Handlers:**
- `OPTIONS /api/orchestrator/start` → `cors_preflight_handler()`
- `OPTIONS /api/orchestrator/stop` → `cors_preflight_handler()`
- `OPTIONS /api/batches` → `cors_preflight_handler()`
- `OPTIONS /api/batches/{batch_id}` → `cors_preflight_handler()`

**CORS Support:**
- All endpoints include `"Access-Control-Allow-Origin": "*"` headers
- OPTIONS preflight handlers for POST endpoints

### Static File Serving (server.py, lines 842-898)

**Whitelisted Files** (ALLOWED_DATA_FILES):
- `sprint-status.yaml` - Sprint execution status
- `orchestrator.md` - Activity log markdown
- `orchestrator.csv` - CSV export
- `sprint-runner.csv` - Alternative CSV format

**Path Resolution:**
- Tries `ARTIFACTS_DIR` first, falls back to `DASHBOARD_DIR`
- Security: Blocks path traversal (`..`, `/`)
- Uses `web.FileResponse()` for file responses

### Path Constants

**server.py (lines 38-55):**
```python
PORT = 8080
DASHBOARD_DIR = Path(__file__).parent  # ~/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/
PROJECT_ROOT = find_project_root()     # ~/grimoire/
ARTIFACTS_DIR = PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"
```

**db.py (line 23):**
```python
DB_PATH = Path(__file__).parent / 'sprint-runner.db'
```

**Issue for Restructuring:** After moving to `server/` folder, these must be updated:
- `DASHBOARD_DIR` will incorrectly point to `server/` instead of `dashboard/`
- Frontend paths need adjustment to point to `../frontend/`

---

## 2. WebSocket Communication

### Connection Flow (dashboard.html, lines 6096-6162)

**Initialization:**
```javascript
function connectSprintWebSocket() {
    const wsUrl = `ws://${window.location.host}/ws`;
    sprintRunState.ws = new WebSocket(wsUrl);
}
```

### Event Types (server.py, lines 87-142)

**Defined EventType Enum:**
- **Batch Events:** `batch:start`, `batch:end`, `batch:warning`
- **Cycle Events:** `cycle:start`, `cycle:end`
- **Command Events:** `command:start`, `command:progress`, `command:end`
- **Story Events:** `story:status`
- **Context Events:** `context:create`, `context:refresh`, `context:complete`
- **System:** `error`, `pong`

### Payload Schemas (server.py, lines 120-142)

Each event type has required fields validated before broadcast. Examples:
- `command:start` requires: `story_key`, `command`, `task_id`
- `batch:end` requires: `batch_id`, `cycles_completed`, `status`
- All include `timestamp` (milliseconds since epoch)

### Server → Dashboard Event Flow

**Broadcasting Mechanism (server.py, lines 168-217):**
```python
async def broadcast(event: dict[str, Any]) -> None:
    # Add timestamp if missing
    if "timestamp" not in event:
        event["timestamp"] = int(time.time() * 1000)

    # Send to all connected clients in parallel
    message = json.dumps(event)
    tasks = [ws.send_str(message) for ws in connected_clients]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Remove failed connections
```

**Client Tracking (server.py, lines 61-80):**
- `connected_clients: set[web.WebSocketResponse]` - Global connection registry
- `_clients_lock: asyncio.Lock()` - Thread-safe access
- `add_client()` / `remove_client()` called on connect/disconnect

**Heartbeat Management (server.py, lines 364, 409-446):**
- WebSocketResponse configured with `heartbeat=30.0` seconds
- Automatic ping/pong handling by aiohttp
- Background heartbeat_task() cleans up dead connections every 30 seconds

### Initial State Loading (server.py, lines 315-347)

When client connects, server sends:
```javascript
{
    "type": "init",
    "payload": {
        "batch": { /* current batch or null */ },
        "events": [ /* 50 most recent events */ ]
    }
}
```

---

## 3. Data Flow: Database ↔ API ↔ Frontend

### Database → Server → Dashboard Pipeline

```
SQLite Database (db.py)
    ↓
REST API (server.py handlers)
    ↓
HTTP/WebSocket (JSON responses)
    ↓
JavaScript State (dashboard.html)
    ↓
DOM Rendering
```

### Batch History Data Flow (server.py, lines 679-749)

**Endpoint:** `GET /api/batches?limit=20&offset=0`

**Query Path:**
```sql
SELECT b.id, b.started_at, b.ended_at, b.max_cycles, b.cycles_completed, b.status,
       (SELECT COUNT(*) FROM stories WHERE batch_id = b.id) as story_count
FROM batches b
ORDER BY b.id DESC
LIMIT ? OFFSET ?
```

### Batch Detail Data Flow (server.py, lines 751-834)

**Endpoint:** `GET /api/batches/{batch_id}`

**Response Structure:**
```json
{
    "batch": { "id", "started_at", "ended_at", "max_cycles", "cycles_completed", "status" },
    "stories": [
        {
            "id", "story_key", "epic_id", "status", "duration_seconds",
            "commands": [ { "id", "command", "task_id", "status", "started_at", "ended_at" } ]
        }
    ],
    "stats": { "story_count", "command_count", "duration_seconds", "stories_done", "stories_failed", "stories_in_progress" }
}
```

---

## 4. Frontend Code Structure: CSS and JavaScript

### Major CSS Sections (dashboard.html, lines 7-3050+)

**CSS Variable System (lines 15-144):**
- **Colors:** `--color-bg`, `--color-surface`, `--color-text`, status colors
- **Typography:** Font stacks, sizes (--text-xs to --text-2xl), line heights
- **Spacing:** `--space-1` through `--space-12` (4px to 48px)
- **Shadows:** `--shadow-sm` through `--shadow-xl`
- **Borders:** `--radius-sm` through `--radius-full`
- **Animation:** Durations, easing functions
- **Layout:** `--sidebar-width: 240px`, `--header-height: 56px`
- **Z-Index Hierarchy:** `--z-base`, `--z-elevated`, `--z-overlay`, `--z-modal`, `--z-toast`

**Component Styles:**
1. **Layout Grid (lines 161-175):** 3-row, 2-column grid with header/sidebar/main/footer
2. **Header (lines 177-312):** Title, controls, connection indicator with pulse animation
3. **Sidebar (lines 313-463):** Batch history, toggle button, load-more pagination
4. **Main Content (lines 489-494):** Scrollable primary view
5. **Footer (lines 496-499):** Status timestamp

### Global JavaScript Variables (dashboard.html)

**State Objects:**

`state` (line 3551):
```javascript
let state = {
    sprintData: null,
    orchestratorData: null,
    lastUpdateTime: null,
    watchInterval: null,
    isWatching: false,
    autoLoadWorks: false,
    lastDataHash: null
};
```

`sidebarState` (line 3566):
```javascript
let sidebarState = {
    collapsed: false,
    mobileOpen: false
};
```

`sprintRunState` (line 6034):
```javascript
const sprintRunState = {
    ws: null,
    wsReconnectTimer: null,
    wsReconnectAttempts: 0,
    isRunning: false,
    isStopping: false,
    currentBatchId: null,
    maxCycles: 0,
    currentCycle: 0,
    activeStories: [],
    currentOperation: null,
    autoScroll: true,
    userScrolled: false,
    connectionStatus: 'disconnected',
    eventQueue: [],
    activeOperations: new Map(),
    runningTimers: new Map(),
    lastEventTimestamp: 0,
    storyExpansionState: new Map(),
    pendingAnimations: new Set()
};
```

`batchSidebarState` (around line 7254):
```javascript
const batchSidebarState = {
    batches: [],
    offset: 0,
    limit: 20,
    hasMore: true,
    isLoading: false,
    selectedBatchId: null
};
```

### Major JavaScript Functions

**Initialization & DOM Management:**
- `restoreSidebarState()` - Restore from localStorage
- `toggleSidebar()` - Collapse/expand sidebar
- `saveUIState()` - Persist filters, scroll positions
- `restoreUIState()` - Restore from localStorage

**WebSocket Management:**
- `connectSprintWebSocket()` - Establish WS connection
- `handleWebSocketEvent()` - Route incoming events
- `updateConnectionIndicator()` - Show connection status

**Data Rendering:**
- `renderEpics()` - Render kanban board
- `renderStories()` - Render story table
- `renderActivityLog()` - Render activity timeline
- `renderBatchSidebar()` - Render batch history sidebar
- `getTimelineData()` - Transform orchestrator data for visualization

**API Calls:**
- `fetchStoryDescriptions()` - GET `/story-descriptions.json`
- `startOrchestrator()` - POST `/api/orchestrator/start`
- `stopOrchestrator()` - POST `/api/orchestrator/stop`
- `loadBatches()` - GET `/api/batches`
- `fetchBatchDetail()` - GET `/api/batches/{id}`

**Batch History:**
- `fetchBatches(append)` - Fetch batch history with pagination
- `loadMoreBatches()` - Load additional batches
- `renderBatchList()` - Render sidebar batch list
- `renderPastBatchView(data)` - Render historical batch detail view

**Timer Management:**
- `startCommandTimer(taskId, startTime)` - Start operation timer
- `stopCommandTimer(taskId)` - Stop specific timer
- `stopAllTimers()` - Stop all running timers
- `updateTimerDisplay(taskId, timeText)` - Update timer display

**Animation System (Epic 4):**
- `prefersReducedMotion()` - Check reduced motion preference
- `triggerAnimation(element, class, duration)` - Generic animation trigger
- `triggerCompletionAnimation(element)` - Completion flash animation
- `triggerErrorAnimation(element)` - Error shake animation
- `triggerNewItemAnimation(element)` - New item slide animation
- `animateLogEntry(entry, status)` - Log entry animation
- `animateStoryStatusChange(storyKey, newStatus)` - Story status animation
- `startRunningAnimation(element)` / `stopRunningAnimation(element)` - Running state animations
- `startProgressAnimation(progressBar)` / `stopProgressAnimation(progressBar)` - Progress animations
- `toggleExpand(element, expand)` - Expand/collapse with animation

**Active Operations:**
- `renderActiveOperationsDisplay()` - Render active operations panel
- `updateActiveOperationMessage(taskId, message)` - Update operation message

**Timeline:**
- `renderTimeline()` - Render timeline visualization
- `initTimelineCursorLine()` - Initialize cursor tracking
- `initColumnResize()` - Initialize column resize

**Utilities:**
- `escapeHtml()` - HTML entity encoding
- `escapeJsString()` - JavaScript string escaping
- `normalizeStatusForClass()` - CSS class name generation
- `updateElement()` - Conditional DOM update
- `updateTextContent()` - Text-only DOM update
- `hashString()` - Change detection for caching
- `saveScrollPosition(el)` / `restoreScrollPosition(el, pos)` - Scroll state management

---

## 5. Critical IDs and Selectors

### Header Controls
- `#headerStartBtn` - Start batch button
- `#headerStopBtn` - Stop batch button
- `#headerBatchSize` - Batch size input
- `#headerRunAll` - "Run All" checkbox
- `#headerConnectionDot` - Connection status dot

### Sprint Run Section
- `#sprintStartBtn` - Start button (duplicate)
- `#sprintStopBtn` - Stop button (duplicate)
- `#batchSizeInput` - Batch size input field
- `#runAllCheckbox` - Run all stories checkbox
- `#sprintStatusValue` - Current status display
- `#sprintProgressFill` - Progress bar fill
- `#sprintProgressStats` - Progress text

### Current Execution
- `#currentStory` - Story key display
- `#currentStoryStatus` - Story status badge
- `#sprintCurrentOp` - Current operation display

### Batch History
- `#batchSidebar` - Batch sidebar container
- `#batchSidebarContent` - Batch list
- `#loadMoreBatches` - Load more button
- `.batch-item` - Individual batch item
- `.batch-item--selected` - Selected batch

### Layout
- `#appLayout` - Root layout container
- `#mainContent` - Main content area
- `#dashboardContent` - Dashboard content wrapper
- `.app-header` - Header component
- `.batch-sidebar` - Sidebar component
- `.app-footer` - Footer component

### Sidebar
- `#batchSidebar` - Batch sidebar container
- `#batchSidebarToggle` - Sidebar toggle button
- `#batchSidebarContent` - Batch list container
- `#sidebarOverlay` - Mobile sidebar overlay

### Timeline
- `#timelineScrollContainer` - Timeline scroll container
- `#timelineHeader` - Timeline header row
- `#timelineBody` - Timeline content body
- `#timelineGrid` - Timeline grid lines
- `#timelineRows` - Timeline story rows
- `#timelineTooltip` - Timeline tooltip popup
- `#timelineCursorLine` - Cursor tracking line
- `#zoomLevel` - Zoom level display
- `#blockSizeInput` - Block size input
- `#resizeHandle` - Column resize handle

### Notifications
- `#toastContainer` - Toast notification container
- `#storyTooltip` - Story tooltip element

---

## 6. Path/URL References

### Frontend-Constructed URLs

**WebSocket:**
```javascript
const wsUrl = `ws://${window.location.host}/ws`;
```

**Static Files (relative paths):**
```javascript
fetch('./story-descriptions.json')
fetch('./sprint-status.yaml')
fetch('./sprint-runner.csv?t=' + Date.now())
fetch('./orchestrator.md')
```

**API Endpoints (absolute paths):**
```javascript
fetch('/api/orchestrator/start', { method: 'POST' })
fetch('/api/orchestrator/stop', { method: 'POST' })
fetch('/api/orchestrator/status')
fetch(`/api/batches?limit=${limit}&offset=${offset}`)
fetch(`/api/batches/${batchId}`)
```

---

## 7. Impact Assessment for Restructuring

### High-Impact Changes Required

1. **Path Resolution (Critical)**
   - Currently: `DASHBOARD_DIR = Path(__file__).parent` (dashboard/)
   - After: Must point to `frontend/` directory
   - Scope: `server.py` lines 41, 530, 894

2. **Frontend Asset Paths**
   - Currently: Dashboard files in same directory
   - After: HTML at `frontend/index.html`, CSS at `frontend/css/`, JS at `frontend/js/`
   - New route handling needed

3. **Import Statements**
   - Currently: `from orchestrator import Orchestrator`
   - After: Same (if in same server/ directory)
   - Scope: Test files may need updates

4. **Settings Extraction (New)**
   - Constants scattered across files need centralization
   - All move to `server/settings.py`

---

## 8. Recommendations

### Phase 1: Setup
1. Create `shared.py` with ALL constants
2. Create `settings.py` with configurable values
3. Create `frontend/index.html` with script includes

### Phase 2: Server Restructuring
4. Update `server.py` paths
5. Update `db.py` to import from shared
6. Update `orchestrator.py` for settings

### Phase 3: Frontend Restructuring
8. Extract CSS from dashboard.html to `frontend/css/styles.css`
9. Extract JavaScript to modular files
10. Create `frontend/index.html`

### Phase 4: Testing & Settings API
11. Implement Settings API Endpoints
12. Update settings.js UI
13. Update tests

---

## Summary Table: Files to Move/Create/Update

| Action | File | Location | Notes |
|--------|------|----------|-------|
| Create | `shared.py` | `server/` | Centralized constants |
| Create | `settings.py` | `server/` | Settings management |
| Create | `__init__.py` | `server/` | Package marker |
| Move | `server.py` | `server/` | Update paths |
| Move | `orchestrator.py` | `server/` | Update imports |
| Move | `db.py` | `server/` | Import from shared |
| Create | `index.html` | `frontend/` | Link CSS/JS |
| Create | `css/styles.css` | `frontend/css/` | Extract from HTML |
| Create | `js/*.js` | `frontend/js/` | Split modules |
| Delete | `sprint.log` | `dashboard/` | Replaced by SQLite |
