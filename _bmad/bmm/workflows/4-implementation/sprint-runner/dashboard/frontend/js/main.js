/**
 * main.js - Main entry point, owns ALL state, DOMContentLoaded wrapper
 * Dependencies: All other JS modules must be loaded before this
 */

// ============================================================
// GLOBAL STATE - Owned by main.js
// ============================================================

/**
 * Main application state
 */
const state = {
    sprintData: null,
    orchestratorData: null,
    lastUpdateTime: null,
    watchInterval: null,
    isWatching: false,
    autoLoadWorks: false,
    lastDataHash: null
};

/**
 * Sidebar state
 */
const sidebarState = {
    collapsed: false,
    mobileOpen: false
};

/**
 * Sprint Run state - comprehensive real-time state
 */
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
    // Real-time state
    connectionStatus: 'disconnected',  // connected, connecting, reconnecting, disconnected
    eventQueue: [],                    // Queue events during reconnection
    activeOperations: new Map(),       // Map of task_id -> operation data
    runningTimers: new Map(),          // Map of task_id -> timer interval ID
    lastEventTimestamp: 0,             // For state reconciliation
    storyExpansionState: new Map(),    // Track expanded stories for auto-expand
    pendingAnimations: new Set()       // Track elements with pending animations
};

/**
 * Batch history state
 */
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

/**
 * Timeline state
 */
const timelineState = {
    zoomLevel: 100,
    blockSizeMinutes: 10,
    expandedStoryIds: new Set(),
    hiddenStories: new Set()
};

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type: info, success, warning, error
 * @param {string} title - Optional title
 * @param {number} duration - Duration in ms (default 5000)
 */
function showToast(message, type = 'info', title = null, duration = 5000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        error: '&#10060;',
        success: '&#10004;',
        warning: '&#9888;',
        info: '&#8505;'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-content">
            ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    // Auto-dismiss
    if (type !== 'error' || duration > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, type === 'error' ? 10000 : duration);
    }
}

// ============================================================
// TAB NAVIGATION
// ============================================================

/**
 * Switch to tab
 * @param {string} tabId - Tab ID to switch to
 */
function switchTab(tabId) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });

    // Save active tab
    storageSet(UI_STATE_KEYS.ACTIVE_TAB, tabId);
}

/**
 * Restore active tab from localStorage
 */
function restoreActiveTab() {
    const savedTab = storageGet(UI_STATE_KEYS.ACTIVE_TAB);
    if (savedTab) {
        switchTab(savedTab);
    }
}

/**
 * Initialize tab navigation
 */
function initTabNavigation() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    restoreActiveTab();
}

// ============================================================
// UI STATE PERSISTENCE
// ============================================================

/**
 * Save all UI state to localStorage
 */
function saveUIState() {
    try {
        // Get expanded epic IDs
        const expandedEpics = Array.from(document.querySelectorAll('.epic-card.expanded'))
            .map(el => el.dataset.epicId)
            .filter(Boolean);
        storageSetJSON(UI_STATE_KEYS.EXPANDED_EPICS, expandedEpics);

        // Get filter values
        const epicFilter = document.getElementById('epicFilter')?.value || 'all';
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        storageSetJSON(UI_STATE_KEYS.FILTERS, { epic: epicFilter, status: statusFilter });

        // Get scroll positions
        const scrollPositions = {};
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) scrollPositions.tableContainer = tableContainer.scrollTop;
        const activityLog = document.getElementById('activityLog');
        if (activityLog) scrollPositions.activityLog = activityLog.scrollTop;
        const timelineScroll = document.getElementById('timelineScrollContainer');
        if (timelineScroll) scrollPositions.timelineScroll = timelineScroll.scrollLeft;
        storageSetJSON(UI_STATE_KEYS.SCROLL_POSITIONS, scrollPositions);

        // Get expanded activity items
        const expandedActivities = Array.from(document.querySelectorAll('.activity-item:not(.collapsed)'))
            .map((el, idx) => idx)
            .filter(idx => idx > 0);
        storageSetJSON(UI_STATE_KEYS.EXPANDED_ACTIVITIES, expandedActivities);

        // Save timeline states
        storageSetJSON(UI_STATE_KEYS.TIMELINE_EXPANDED_STORIES, Array.from(timelineState.expandedStoryIds));
        storageSetJSON(UI_STATE_KEYS.TIMELINE_HIDDEN_STORIES, Array.from(timelineState.hiddenStories));
    } catch (e) {
        console.warn('Failed to save UI state:', e);
    }
}

/**
 * Restore UI state from localStorage
 */
function restoreUIState() {
    try {
        // Restore filters
        const filters = storageGetJSON(UI_STATE_KEYS.FILTERS, {});
        const epicFilter = document.getElementById('epicFilter');
        const statusFilter = document.getElementById('statusFilter');
        if (epicFilter && filters.epic) epicFilter.value = filters.epic;
        if (statusFilter && filters.status) statusFilter.value = filters.status;

        // Restore timeline expanded stories
        const expanded = storageGetJSON(UI_STATE_KEYS.TIMELINE_EXPANDED_STORIES, []);
        timelineState.expandedStoryIds = new Set(expanded);

        // Restore timeline hidden stories
        const hidden = storageGetJSON(UI_STATE_KEYS.TIMELINE_HIDDEN_STORIES, []);
        timelineState.hiddenStories = new Set(hidden);
    } catch (e) {
        console.warn('Failed to restore UI state:', e);
    }
}

/**
 * Restore scroll positions
 */
function restoreScrollPositions() {
    try {
        const positions = storageGetJSON(UI_STATE_KEYS.SCROLL_POSITIONS, {});
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer && positions.tableContainer) tableContainer.scrollTop = positions.tableContainer;
        const activityLog = document.getElementById('activityLog');
        if (activityLog && positions.activityLog) activityLog.scrollTop = positions.activityLog;
        const timelineScroll = document.getElementById('timelineScrollContainer');
        if (timelineScroll && positions.timelineScroll) timelineScroll.scrollLeft = positions.timelineScroll;
    } catch (e) {
        console.warn('Failed to restore scroll positions:', e);
    }
}

// ============================================================
// DATA LOADING
// ============================================================

/**
 * Update last updated time display
 */
function updateLastUpdatedTime() {
    const el = document.getElementById('lastUpdated');
    const dot = document.getElementById('updateDot');

    if (!state.lastUpdateTime) {
        if (el) el.textContent = 'Loading...';
        if (dot) dot.classList.add('inactive');
        return;
    }

    const diff = Math.floor((Date.now() - state.lastUpdateTime) / 1000);
    let text;

    if (diff < 5) {
        text = 'Just now';
    } else if (diff < 60) {
        text = `${diff}s ago`;
    } else if (diff < 3600) {
        text = `${Math.floor(diff / 60)}m ago`;
    } else {
        text = `${Math.floor(diff / 3600)}h ago`;
    }

    if (el) el.textContent = text;
    if (dot) {
        dot.classList.toggle('inactive', diff > 30);
    }
}

/**
 * Try to auto-load data
 */
async function tryAutoLoad() {
    try {
        // Load sprint data
        const sprintResponse = await fetch('/api/sprint-status');
        if (sprintResponse.ok) {
            const data = await sprintResponse.json();
            state.sprintData = data;
            state.lastUpdateTime = Date.now();
            state.autoLoadWorks = true;

            renderSummaryCards(data);
            updateEpicFilter(data);
            renderEpicBoard(data);
            renderStoryTable(data,
                document.getElementById('epicFilter')?.value || 'all',
                document.getElementById('statusFilter')?.value || 'all'
            );
            restoreExpandedEpics();
            updateTabCounts(data, state.orchestratorData);
        }

        // Load orchestrator data
        const orchestratorResponse = await fetch('/api/orchestrator-status');
        if (orchestratorResponse.ok) {
            const data = await orchestratorResponse.json();
            state.orchestratorData = data;

            renderActivityLog(data);
            restoreExpandedActivities();
            updateTabCounts(state.sprintData, data);
        }

        restoreScrollPositions();

    } catch (e) {
        console.error('Failed to load data:', e);
    }
}

// ============================================================
// FILTER EVENT HANDLERS
// ============================================================

/**
 * Initialize filter event handlers
 */
function initFilterHandlers() {
    const epicFilter = document.getElementById('epicFilter');
    const statusFilter = document.getElementById('statusFilter');

    if (epicFilter) {
        epicFilter.addEventListener('change', (e) => {
            if (state.sprintData) {
                const statusVal = document.getElementById('statusFilter')?.value || 'all';
                renderStoryTable(state.sprintData, e.target.value, statusVal);
                saveUIState();
            }
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            if (state.sprintData) {
                const epicVal = document.getElementById('epicFilter')?.value || 'all';
                renderStoryTable(state.sprintData, epicVal, e.target.value);
                saveUIState();
            }
        });
    }
}

// ============================================================
// FOOTER TIMESTAMP
// ============================================================

/**
 * Update footer timestamp
 */
function updateFooterTimestamp() {
    const el = document.getElementById('footerTimestamp');
    if (el) {
        el.textContent = new Date().toLocaleTimeString();
    }
}

// ============================================================
// TIMELINE FUNCTIONS (Stubs - can be expanded)
// ============================================================

function zoomTimeline(direction) {
    const step = 25;
    if (direction === 'in') {
        timelineState.zoomLevel = Math.min(200, timelineState.zoomLevel + step);
    } else {
        timelineState.zoomLevel = Math.max(50, timelineState.zoomLevel - step);
    }
    const zoomEl = document.getElementById('zoomLevel');
    if (zoomEl) zoomEl.textContent = `${timelineState.zoomLevel}%`;
    // Trigger timeline re-render if implemented
}

function setBlockSizeMinutes(value) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 480) {
        timelineState.blockSizeMinutes = num;
        // Trigger timeline re-render if implemented
    }
}

function showAllStories() {
    timelineState.hiddenStories.clear();
    document.querySelectorAll('.timeline-row.hidden-story').forEach(row => {
        row.classList.remove('hidden-story');
    });
    saveUIState();
}

function hideAllStories() {
    document.querySelectorAll('.timeline-row').forEach(row => {
        const storyId = row.dataset.storyId;
        if (storyId) {
            timelineState.hiddenStories.add(storyId);
            row.classList.add('hidden-story');
        }
    });
    saveUIState();
}

function initColumnResize() {
    // Column resize implementation can be added here
}

function restoreColumnWidth() {
    const savedWidth = storageGet(UI_STATE_KEYS.TIMELINE_WIDTH);
    if (savedWidth) {
        document.documentElement.style.setProperty('--timeline-label-width', savedWidth + 'px');
    }
}

function initTimelineCursorLine() {
    const container = document.getElementById('timelineScrollContainer');
    const cursor = document.getElementById('timelineCursorLine');
    if (!container || !cursor) return;

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        cursor.style.left = (e.clientX - rect.left) + 'px';
        cursor.style.display = 'block';
    });

    container.addEventListener('mouseleave', () => {
        cursor.style.display = 'none';
    });
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize Sprint Run tab
 */
function initSprintRunTab() {
    restoreSprintRunPrefs();
    connectSprintWebSocket();
    updateSprintUI();
}

/**
 * Main DOMContentLoaded initialization
 */
document.addEventListener('DOMContentLoaded', function() {
    // Restore sidebar state
    restoreSidebarState();

    // Initialize tab navigation
    initTabNavigation();

    // Initialize filter handlers
    initFilterHandlers();

    // Restore UI state
    restoreUIState();
    restoreColumnWidth();
    initColumnResize();
    initTimelineCursorLine();

    // Initialize control listeners
    initControlListeners();

    // Initialize WebSocket click handlers
    initWebSocketClickHandler();

    // Initialize settings
    initSettingsListeners();

    // Initialize batch history
    initBatchHistory();

    // Initialize Sprint Run tab
    initSprintRunTab();

    // Initialize auto-scroll detection
    initAutoScrollDetection();

    // Load data
    tryAutoLoad();

    // Start periodic updates
    setInterval(updateLastUpdatedTime, 1000);
    setInterval(updateFooterTimestamp, 1000);
    setInterval(saveUIState, 5000);

    // Update footer timestamp immediately
    updateFooterTimestamp();

    // Show dashboard content
    const dashboardContent = document.getElementById('dashboardContent');
    if (dashboardContent) {
        dashboardContent.classList.add('visible');
    }

    console.log('Sprint Runner Dashboard initialized');
});
