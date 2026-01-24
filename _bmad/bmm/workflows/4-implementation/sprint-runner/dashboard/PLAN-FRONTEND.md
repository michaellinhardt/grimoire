# PLAN-FRONTEND.md - Frontend Restructuring Implementation Plan

## Revision Notes

**Fixes applied from REVIEW-PLAN-FRONTEND.md and HAIKU-REVIEW-FRONTEND.md:**

1. **Step 4.6 stories.js line numbers**: Corrected from "5750-5999" to "4432-4704" for story rendering functions
2. **Function name fix**: Changed `toggleEpic(epicId)` to `toggleEpicCard(epicId)` (line 4657)
3. **Added handleBatchState()**: Included this function (line 6627) in batch.js assignment
4. **Added DOMContentLoaded wrapper**: All init calls wrapped in DOMContentLoaded event in main.js
5. **Added missing utils.js functions**: `getCommandType()` (line 7151), `restoreScrollPositions()` (line 3790), `formatLogTime()` (line 6833)
6. **Added missing main.js functions**: `saveUIState()`, `restoreUIState()`, `tryAutoLoad()`, `switchTab()`, `restoreActiveTab()`, `updateTabCounts()`, `updateLastUpdatedTime()`
7. **Clarified sprintRunState ownership**: main.js owns all state objects, other modules reference globally
8. **Added WebSocket protocol check**: wss:// for HTTPS pages
9. **Added localStorage prefix strategy**: `grimoire-sprint-runner-{key}` for all keys
10. **Added CSS namespace for settings**: Use `.settings-select` instead of bare `select`
11. **Added error state UI for settings**: Inline error messages below inputs
12. **Added Settings tab position**: Specified as 6th tab AFTER Sprint Run
13. **Updated dependency diagram**: Shows main.js owns state objects

---

## Executive Summary

This plan details the extraction and modularization of the monolithic `dashboard.html` (~7,545 lines) into a clean `frontend/` folder structure with separated CSS, modular JavaScript, and a new settings page UI.

---

## Phase 1: Create Folder Structure

### Step 1.1: Create Frontend Directory Hierarchy

Create the following folders:
```
frontend/
├── css/
├── js/
└── assets/
```

---

## Phase 2: CSS Extraction

### Step 2.1: Extract All CSS to `frontend/css/styles.css`

Extract CSS from lines 7-3228 of dashboard.html. The CSS is organized into the following sections:

**CSS Variables (lines 15-144):**
- Color system (base, status, commands, interactive states)
- Typography (font stacks, sizes, line heights)
- Spacing scale (4px - 48px)
- Shadows, border radius
- Animation durations and easing
- Layout variables (sidebar-width, header-height)
- Z-index hierarchy
- Legacy timeline variables

**Layout Sections:**
1. Reset & Base (lines 8-14, 146-154)
2. Split Panel Layout - app-layout grid (lines 161-589)
3. App Header (lines 177-312)
4. Batch Sidebar (lines 313-488)
5. Main Content (lines 489-494)
6. App Footer (lines 496-530)
7. Mobile Responsive (lines 531-589)
8. Container/Header Legacy (lines 591-639)
9. Summary Cards (lines 641-676)
10. Section Headers (lines 678-689)
11. Epic Board/Kanban (lines 691-831)
12. Story Tooltip (lines 833-850)
13. Story Table (lines 852-901)
14. Status Badges (lines 903-942)
15. Activity Log (lines 944-1096)
16. Command/Task Hierarchy (lines 1098-1397)
17. Filters (lines 1399-1436)
18. Empty State (lines 1438-1452)
19. Tab Navigation (lines 1454-1508)
20. Timeline Styles (lines 1510-2044)
21. Sprint Run Tab (lines 2089-2447)
22. Real-time Update Animations (lines 2503-2879)
23. Active Operation Card (lines 2882-2943)
24. Toast Notifications (lines 2946-3024)
25. Batch History Sidebar Epic 5 (lines 3032-3089)
26. Component System Epic 3 (lines 3091-3227)

---

## Phase 3: Create index.html

### Step 3.1: Create `frontend/index.html`

Create minimal HTML structure with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grimoire - Project Dashboard</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <!-- Toast Container -->
    <div class="toast-container" id="toastContainer"></div>

    <!-- Story Tooltip -->
    <div class="story-tooltip" id="storyTooltip"></div>

    <!-- App Layout (lines 3238-3543 of original) -->
    <div class="app-layout" id="appLayout">
        <!-- Mobile Sidebar Overlay -->
        <!-- App Header -->
        <!-- Batch Sidebar -->
        <!-- Main Content with tabs -->

        <!-- Tab Navigation - All 6 tabs in order -->
        <nav class="tab-nav">
            <button class="tab-btn" data-tab="epics">Epics</button>
            <button class="tab-btn" data-tab="stories">Stories</button>
            <button class="tab-btn" data-tab="activity">Activity</button>
            <button class="tab-btn" data-tab="timeline">Timeline</button>
            <button class="tab-btn" data-tab="sprint-run">Sprint Run</button>
            <button class="tab-btn" data-tab="settings">Settings</button>
        </nav>
    </div>

    <!-- App Footer -->
    <footer class="app-footer">...</footer>

    <!-- Script imports (order matters!) -->
    <script src="js/utils.js"></script>
    <script src="js/websocket.js"></script>
    <script src="js/sidebar.js"></script>
    <script src="js/controls.js"></script>
    <script src="js/batch.js"></script>
    <script src="js/stories.js"></script>
    <script src="js/operations.js"></script>
    <script src="js/settings.js"></script>
    <script src="js/main.js"></script>
</body>
</html>
```

---

## Phase 4: JavaScript Module Extraction

### Step 4.1: `frontend/js/utils.js` - Shared Utilities

**Functions to extract:**
- `escapeHtml(str)` - HTML entity encoding
- `escapeJsString(str)` - JavaScript string escaping
- `normalizeStatusForClass(status)` - CSS class name generation
- `formatDuration(seconds)` - Duration formatting (e.g., "2m 30s")
- `formatLogTime(timestamp)` - Log timestamp formatting (moved from line 6833 to utils)
- `formatBatchTime(timestamp)` - Batch timestamp formatting
- `formatBatchDuration(seconds)` - Batch duration formatting
- `formatTimerDuration(seconds)` - Timer display (mm:ss)
- `hashString(str)` - Change detection hashing
- `updateElement(id, value)` - Conditional DOM update
- `updateTextContent(id, value)` - Text-only DOM update
- `saveScrollPosition(el)` / `restoreScrollPosition(el, pos)` - Scroll state management
- `restoreScrollPositions()` (line 3790) - Restore multiple scroll positions
- `CSS.escape()` polyfill check
- `getCommandTypeColors(command)` - Command color mapping
- `getCommandType(command)` (line 7151) - Command type classification

**State/Constants:**
- None (pure utility functions)

**localStorage Key Strategy:**
All localStorage operations must use prefix: `grimoire-sprint-runner-{key}`
```javascript
const STORAGE_PREFIX = 'grimoire-sprint-runner-';

function getStorageKey(key) {
    return STORAGE_PREFIX + key;
}

function setStorageItem(key, value) {
    localStorage.setItem(getStorageKey(key), JSON.stringify(value));
}

function getStorageItem(key, defaultValue = null) {
    const item = localStorage.getItem(getStorageKey(key));
    return item ? JSON.parse(item) : defaultValue;
}
```

---

### Step 4.2: `frontend/js/websocket.js` - WebSocket Management

**Functions to extract (lines 6096-6271, plus additional):**
- `connectSprintWebSocket()` - Establish WS connection
- `scheduleWsReconnect()` - Exponential backoff reconnection
- `updateWsConnectionStatus(status)` - Update status display
- `processEventQueue()` - Process queued events after reconnect
- `queueEvent(event)` - Queue events during reconnection
- `requestStateReconciliation()` - Request fresh state after reconnect
- `handleWebSocketEvent(event)` (line 6437) - Main event router (calls other modules)
- `getEventStatus(event)` (line 6609) - Determine event status type

**WebSocket Protocol Detection (CRITICAL for HTTPS compatibility):**
```javascript
function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    return wsUrl;
}
```

**State variables:**
```javascript
const wsState = {
    ws: null,
    wsReconnectTimer: null,
    wsReconnectAttempts: 0,
    connectionStatus: 'disconnected',
    eventQueue: [],
    lastEventTimestamp: 0
};
```

**Exports:**
- `connectSprintWebSocket()`
- `wsState` (read-only access)
- `updateWsConnectionStatus()`

---

### Step 4.3: `frontend/js/sidebar.js` - Batch History Sidebar

**Functions to extract (lines 7220-7542):**
- `toggleBatchSidebar()` - Collapse/expand sidebar
- `renderBatchList()` - Render batch items
- `fetchBatches(append)` - Fetch batch list from API
- `loadMoreBatches()` - Pagination
- `selectBatch(batchId)` - Select batch for viewing
- `renderPastBatchView(data)` - Render historical batch detail
- `returnToLiveView()` - Return from past batch view
- `initBatchHistory()` - Initialize sidebar
- `createBatchCard(batch, isSelected, isCurrent)` - Component factory

**State variables:**
```javascript
const batchHistoryState = {
    batches: [],
    selectedBatchId: null,
    currentBatchId: null,
    isLoading: false,
    hasMore: true,
    offset: 0,
    limit: 20,
    sidebarCollapsed: false,
    viewingPastBatch: false
};
```

**Also includes:**
- `toggleSidebar()` - General sidebar toggle
- `restoreSidebarState()` - Restore from localStorage
- `toggleMobileSidebar()` / `closeMobileSidebar()` - Mobile handling

---

### Step 4.4: `frontend/js/controls.js` - Start/Stop/Settings Controls

**Functions to extract (lines 6854-7054):**
- `updateSprintUI()` - Update control button states
- `startSprint()` - POST /api/orchestrator/start
- `stopSprint()` - POST /api/orchestrator/stop
- `saveSprintRunPrefs()` - Persist batch size/run-all to localStorage
- `restoreSprintRunPrefs()` - Restore from localStorage
- Header button sync with Sprint Run tab buttons

**Event Listeners:**
- `#sprintStartBtn`, `#sprintStopBtn` click handlers
- `#headerStartBtn`, `#headerStopBtn` click handlers
- `#runAllCheckbox` change handler
- `#batchSizeInput` / `#headerBatchSize` change handlers

**State references:**
- Uses `sprintRunState.isRunning`, `sprintRunState.isStopping` (defined in main.js, accessed globally)

---

### Step 4.5: `frontend/js/batch.js` - Batch Header & Progress Display

**Functions to extract (lines 6627-6970):**
- `showProgressSection(show)` - Show/hide progress section
- `updateProgress()` - Update progress bar and stats
- `updateActiveStories()` - Render active story badges
- `updateStoryBadge(storyKey, status)` - Update individual story badge
- `updateTabIndicator(isActive)` - Sprint Run tab indicator
- `handleBatchState(batch)` (line 6627) - Handle batch state from init event

**State references:**
- `sprintRunState.currentCycle`, `sprintRunState.maxCycles` (defined in main.js)
- `sprintRunState.activeStories`

---

### Step 4.6: `frontend/js/stories.js` - Story List & Cards

**Functions to extract (lines 4432-4704):**
- `showStoryTooltip(event, story)` (line 4432) - Show story tooltip
- `hideStoryTooltip()` - Hide tooltip
- `renderSummaryCards(data)` (line 4462) - Update summary cards
- `renderEpicBoard(data)` (line 4496) - Render kanban board
- `toggleEpicCard(epicId)` (line 4657) - Expand/collapse epic card
- `renderStoryTable(data, epicFilter, statusFilter)` (line 4704) - Render story table

**Component factories (lines 7078-7178):**
- `createStoryCard(story, isExpanded)` - Story card component
- `createCommandGroup(cmd, isExpanded)` - Command group component
- `createTaskRow(task)` - Task row component
- `createStatusBadge(status)` - Status badge component
- `createCommandBadge(command, solid)` - Command badge component
- `toggleStoryCard(storyKey)` - Toggle story expansion
- `toggleCommandGroup(headerEl)` - Toggle command group

**State:**
- Epic expansion state persisted to localStorage (use `grimoire-sprint-runner-epic-expansion`)

---

### Step 4.7: `frontend/js/operations.js` - Active Operations Display

**Functions to extract (lines 6639-6767):**
- `startCommandTimer(taskId, startTime)` - Start operation timer
- `stopCommandTimer(taskId)` - Stop specific timer
- `stopAllTimers()` - Stop all running timers
- `updateTimerDisplay(taskId, timeText)` - Update timer display
- `renderActiveOperationsDisplay()` - Render active operations panel
- `updateActiveOperationMessage(taskId, message)` - Update operation message
- `restoreActiveOperationsFromEvents(events)` - Restore from history
- `autoExpandStoryRow(storyKey)` - Auto-expand story during operation

**State:**
```javascript
// Part of sprintRunState (defined in main.js)
activeOperations: new Map(),  // task_id -> operation data
runningTimers: new Map(),     // task_id -> interval ID
storyExpansionState: new Map()
```

---

### Step 4.8: `frontend/js/settings.js` - NEW Settings Page UI

**New functions to create:**
- `initSettingsPage()` - Initialize settings form
- `fetchSettings()` - GET /api/settings
- `saveSettings(settings)` - PUT /api/settings
- `validateSettings(settings)` - Client-side validation
- `renderSettingsForm(settings)` - Render settings form UI
- `handleSettingChange(key, value)` - Handle individual setting change
- `resetToDefaults()` - Reset all settings to defaults
- `showSettingsError(fieldId, message)` - Show field-level error
- `clearSettingsError(fieldId)` - Clear field-level error

**Settings to display (9 total from CHANGE-CONTEXT.md):**

| Setting Key | Type | Default | Description | Validation |
|-------------|------|---------|-------------|------------|
| `server_port` | number | 8080 | HTTP server port | 1024-65535 |
| `default_max_cycles` | number | 2 | Default batch cycles | 1-999 |
| `project_context_max_age_hours` | number | 24 | Context freshness (hours) | 1-168 |
| `injection_warning_kb` | number | 100 | Warn if injection > KB | 50-200 |
| `injection_error_kb` | number | 150 | Error if injection > KB | 100-300 |
| `websocket_heartbeat_seconds` | number | 30 | WebSocket heartbeat interval | 10-120 |
| `max_code_review_attempts` | number | 10 | Max code review iterations | 1-20 |
| `haiku_after_review` | number | 2 | Switch to Haiku after N reviews | 1-10 |
| `default_batch_list_limit` | number | 20 | Default pagination limit | 10-100 |

**UI Design (Settings is 6th tab, AFTER Sprint Run):**
```html
<!-- New tab in tab-nav - Position 6 (after Sprint Run) -->
<button class="tab-btn" data-tab="settings">Settings</button>

<!-- Settings Tab Panel -->
<div class="tab-panel" id="tab-settings">
    <div class="settings-container">
        <div class="settings-header">
            <h2>Settings</h2>
            <button class="settings-reset-btn" onclick="resetToDefaults()">
                Reset to Defaults
            </button>
        </div>

        <div class="settings-section">
            <h3 class="settings-section-title">Server Configuration</h3>
            <div class="settings-group">
                <label class="settings-label" for="setting-server-port">
                    Server Port
                    <span class="settings-hint">Port for HTTP server (requires restart)</span>
                </label>
                <input type="number" id="setting-server-port"
                       class="settings-input" min="1024" max="65535">
                <div class="settings-error" id="error-server-port"></div>
            </div>
            <!-- More settings groups... -->
        </div>

        <div class="settings-section">
            <h3 class="settings-section-title">Orchestrator Settings</h3>
            <!-- default_max_cycles, project_context_max_age_hours, etc. -->
        </div>

        <div class="settings-section">
            <h3 class="settings-section-title">Safety Thresholds</h3>
            <!-- injection_warning_kb, injection_error_kb -->
        </div>

        <div class="settings-actions">
            <button class="settings-save-btn" onclick="saveSettings()">
                Save Changes
            </button>
            <span class="settings-status" id="settingsStatus"></span>
        </div>
    </div>
</div>
```

**Settings CSS (add to styles.css - with proper namespacing):**
```css
/* Settings Page */
.settings-container { max-width: 800px; margin: 0 auto; }
.settings-header { display: flex; justify-content: space-between; margin-bottom: var(--space-6); }
.settings-section { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-6); margin-bottom: var(--space-4); }
.settings-section-title { font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-4); }
.settings-group { margin-bottom: var(--space-4); }
.settings-label { display: block; font-size: var(--text-base); font-weight: 500; margin-bottom: var(--space-1); }
.settings-hint { display: block; font-size: var(--text-sm); color: var(--color-text-muted); font-weight: normal; }
.settings-input { width: 100%; max-width: 200px; padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--text-base); }
.settings-input:focus { outline: none; border-color: var(--color-running); }
.settings-input.invalid { border-color: var(--color-error); }

/* Settings select - namespaced to avoid global select conflicts */
.settings-select { width: 100%; max-width: 200px; padding: var(--space-2) var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: var(--text-base); background: var(--color-surface); }
.settings-select:focus { outline: none; border-color: var(--color-running); }

/* Settings error messages */
.settings-error { font-size: var(--text-sm); color: var(--color-error); margin-top: var(--space-1); min-height: 1.2em; }
.settings-error:empty { display: none; }

.settings-actions { display: flex; align-items: center; gap: var(--space-3); padding-top: var(--space-4); border-top: 1px solid var(--color-border); }
.settings-save-btn { padding: var(--space-2) var(--space-6); background: var(--color-success); color: white; border: none; border-radius: var(--radius-md); font-weight: 600; cursor: pointer; }
.settings-save-btn:hover { background: #059669; }
.settings-reset-btn { padding: var(--space-2) var(--space-4); background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-md); color: var(--color-text-secondary); cursor: pointer; }
.settings-status { font-size: var(--text-sm); color: var(--color-text-secondary); }
.settings-status.success { color: var(--color-success); }
.settings-status.error { color: var(--color-error); }
```

---

### Step 4.9: `frontend/js/main.js` - Application Bootstrap

**Functions to extract/create:**
- `initApp()` - Main initialization
- `initSprintRunTab()` - Initialize Sprint Run tab
- `switchTab(tabId)` (line 5804) - Tab switching logic
- `tryAutoLoad()` (line 5913) - Initial data loading
- `saveUIState()` (line 3704) - Save UI state to localStorage
- `restoreUIState()` (line 3752) - Restore UI state from localStorage
- `restoreActiveTab()` (line 5824) - Restore last active tab
- `updateLastUpdatedTime()` (line 5843) - Update timestamp display
- `updateTabCounts(sprintData, orchestratorData)` (line 5831) - Update tab counts

**Global State Management (main.js OWNS all state objects):**
```javascript
// main.js owns these state objects - other modules reference them globally
const state = {
    sprintData: null,
    orchestratorData: null,
    lastUpdateTime: null,
    watchInterval: null,
    isWatching: false,
    autoLoadWorks: false,
    lastDataHash: null
};

const sidebarState = {
    collapsed: false,
    mobileOpen: false
};

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

**Initialization sequence (wrapped in DOMContentLoaded):**
```javascript
document.addEventListener('DOMContentLoaded', () => {
    // 1. Restore UI state
    restoreUIState();
    restoreSidebarState();
    restoreSprintRunPrefs();
    restoreActiveTab();

    // 2. Initialize modules (with null checks for DOM elements)
    try {
        initBatchHistory();
    } catch (e) {
        console.error('Failed to initialize batch history:', e);
    }

    try {
        initSettingsPage();
    } catch (e) {
        console.error('Failed to initialize settings page:', e);
    }

    initSprintRunTab();
    initTimelineCursorLine();
    initColumnResize();

    // 3. Connect WebSocket
    connectSprintWebSocket();

    // 4. Load initial data
    tryAutoLoad();

    // 5. Start periodic updates
    setInterval(updateLastUpdatedTime, 1000);
    setInterval(saveUIState, 5000);
});
```

---

## Phase 5: Animation System (included in utils.js or separate animations.js)

**Animation functions (lines 6277-6434):**
- `prefersReducedMotion()` - Check reduced motion preference
- `triggerAnimation(element, animationClass, duration)` - Generic trigger
- `triggerCompletionAnimation(element)` - Success flash
- `triggerErrorAnimation(element)` - Error shake
- `triggerNewItemAnimation(element)` - Slide in
- `triggerStatusChangeAnimation(element)` - Status highlight
- `startRunningAnimation(element)` / `stopRunningAnimation(element)`
- `startProgressAnimation(progressBar)` / `stopProgressAnimation(progressBar)`
- `toggleExpand(element, expand)` - Expand/collapse
- `animateLogEntry(entry, status)` - Log entry animation
- `animateStoryStatusChange(storyKey, newStatus)` - Story status animation

---

## Phase 6: Event Log Functions (include in operations.js or separate log.js)

**Log functions (lines 6769-6852):**
- `addLogEntry(event, status)` - Add log entry to display
- `clearSprintLog()` - Clear log
- `toggleAutoScroll()` - Toggle auto-scroll

**Note:** `formatLogTime()` has been moved to utils.js to avoid circular dependencies.

---

## Acceptance Criteria Checklist

### Functionality Preserved
- [ ] Dashboard loads without JavaScript errors
- [ ] All tabs display correctly (Epics, Stories, Activity, Timeline, Sprint Run, Settings)
- [ ] WebSocket connection establishes and maintains
- [ ] Real-time updates work (batch start/end, command progress)
- [ ] Batch history sidebar loads and navigates
- [ ] Sidebar collapse/expand works
- [ ] Mobile responsive layout works
- [ ] Toast notifications display correctly
- [ ] All animations play correctly (respects reduced motion)
- [ ] LocalStorage persistence works for UI state
- [ ] Start/Stop controls work
- [ ] Settings page loads and saves

### New Features
- [ ] Settings tab visible in tab navigation (6th position)
- [ ] Settings form displays all 9 settings
- [ ] Settings can be fetched from API
- [ ] Settings can be saved via API
- [ ] Settings validation works client-side
- [ ] Reset to defaults works
- [ ] Field-level error messages display correctly

### Quality Checklist
- [ ] No 404 errors for CSS/JS resources
- [ ] Script load order is correct (dependencies first)
- [ ] All ID references still work
- [ ] All class references still work
- [ ] No duplicate function definitions
- [ ] No circular dependencies between modules
- [ ] CSS variables load before component styles
- [ ] Responsive breakpoints preserved
- [ ] Reduced motion support preserved
- [ ] All keyboard navigation works
- [ ] WebSocket uses wss:// on HTTPS pages
- [ ] localStorage keys use grimoire-sprint-runner- prefix

---

## Module Loading Order

Critical: Scripts must load in this order due to dependencies:

1. **utils.js** - No dependencies, pure functions
2. **websocket.js** - Depends on utils.js (escapeHtml, formatLogTime)
3. **sidebar.js** - Depends on utils.js
4. **controls.js** - Depends on main.js state (sprintRunState)
5. **batch.js** - Depends on utils.js, main.js state
6. **stories.js** - Depends on utils.js
7. **operations.js** - Depends on utils.js, stories.js (autoExpandStoryRow)
8. **settings.js** - Depends on utils.js
9. **main.js** - Depends on all above, initializes everything, OWNS all state objects

---

## Module Dependency Diagram

```
utils.js (no deps)
    |
    +-- formatLogTime, escapeHtml, getCommandType, etc.
    |
websocket.js (uses utils)
    |
    +-- uses formatLogTime from utils
    |
sidebar.js (uses utils)
    |
controls.js (uses main.js state)
    |
    +-- references sprintRunState.isRunning, sprintRunState.isStopping
    |
batch.js (uses utils, main.js state)
    |
    +-- references sprintRunState.currentCycle, etc.
    |
stories.js (uses utils)
    |
operations.js (uses utils, stories)
    |
    +-- calls autoExpandStoryRow from stories
    |
settings.js (uses utils)
    |
main.js (orchestrates all, OWNS state objects)
    |
    +-- defines: state, sidebarState, sprintRunState
    +-- other modules access state globally
```

---

## Critical Files for Implementation

- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html` - The monolithic source file containing all CSS (lines 7-3228), HTML (lines 3230-3543), and JavaScript (lines 3544-7543) to extract
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/CHANGE-CONTEXT.md` - Specification defining the 9 settings and target folder structure
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/STUDY-DASHBOARD-SERVER.md` - API endpoint documentation and function mapping for proper module integration
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` - Server routes reference for settings API endpoint design (lines 970-989 for route setup)
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` - Contains the current hardcoded settings values that will become configurable (lines 254-258 for constants)
