/**
 * utils.js - Pure utility functions and localStorage helpers
 * No dependencies - loads first
 */

// ============================================================
// LocalStorage Prefix and Helpers
// ============================================================

const STORAGE_PREFIX = 'grimoire-sprint-runner-';

/**
 * Get item from localStorage with prefix
 * @param {string} key - Storage key (without prefix)
 * @returns {string|null} - Stored value or null
 */
function storageGet(key) {
    try {
        return localStorage.getItem(STORAGE_PREFIX + key);
    } catch (e) {
        console.warn('localStorage get failed:', e);
        return null;
    }
}

/**
 * Set item in localStorage with prefix
 * @param {string} key - Storage key (without prefix)
 * @param {string} value - Value to store
 */
function storageSet(key, value) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, value);
    } catch (e) {
        console.warn('localStorage set failed:', e);
    }
}

/**
 * Remove item from localStorage with prefix
 * @param {string} key - Storage key (without prefix)
 */
function storageRemove(key) {
    try {
        localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
        console.warn('localStorage remove failed:', e);
    }
}

/**
 * Get JSON from localStorage with prefix
 * @param {string} key - Storage key (without prefix)
 * @param {*} defaultValue - Default value if not found or parse fails
 * @returns {*} - Parsed value or default
 */
function storageGetJSON(key, defaultValue = null) {
    const raw = storageGet(key);
    if (raw === null) return defaultValue;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return defaultValue;
    }
}

/**
 * Set JSON in localStorage with prefix
 * @param {string} key - Storage key (without prefix)
 * @param {*} value - Value to serialize and store
 */
function storageSetJSON(key, value) {
    try {
        storageSet(key, JSON.stringify(value));
    } catch (e) {
        console.warn('localStorage JSON set failed:', e);
    }
}

// ============================================================
// UI State Keys
// ============================================================

const UI_STATE_KEYS = {
    ACTIVE_TAB: 'active-tab',
    TIMELINE_WIDTH: 'timeline-label-width',
    EXPANDED_EPICS: 'expanded-epics',
    FILTERS: 'filters',
    BATCH_SIZE: 'batch-size',
    SORT_PREFS: 'sort-prefs',
    SCROLL_POSITIONS: 'scroll-positions',
    EXPANDED_ACTIVITIES: 'expanded-activities',
    TIMELINE_EXPANDED_STORIES: 'timeline-expanded-stories',
    TIMELINE_HIDDEN_STORIES: 'timeline-hidden-stories',
    SIDEBAR_COLLAPSED: 'sidebar-collapsed',
    BATCH_SIDEBAR_COLLAPSED: 'batch-sidebar-collapsed',
    SPRINTRUN_BATCHSIZE: 'sprintrun-batchsize',
    SPRINTRUN_RUNALL: 'sprintrun-runall'
};

// ============================================================
// Security: HTML Escaping Utilities
// ============================================================

/**
 * Escape HTML special characters to prevent XSS
 * @param {*} text - Text to escape
 * @returns {string} - Escaped HTML string
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const str = String(text);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escape for use in JavaScript string literals
 * Prevents XSS in inline event handlers
 * @param {*} text - Text to escape
 * @returns {string} - Escaped string
 */
function escapeJsString(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// ============================================================
// String Formatting Utilities
// ============================================================

/**
 * Normalize status string for CSS class usage
 * @param {string} status - Status string
 * @returns {string} - Normalized status
 */
function normalizeStatusForClass(status) {
    if (!status) return 'backlog';
    return String(status).toLowerCase().trim().replace(/_/g, '-');
}

/**
 * Format duration in seconds to human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '-';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format timer duration (mm:ss format)
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted timer
 */
function formatTimerDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp for log display
 * @param {number} timestamp - Unix timestamp (ms)
 * @returns {string} - Formatted time
 */
function formatLogTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour12: false });
}

/**
 * Format batch time for display
 * @param {number|string} timestamp - Timestamp
 * @returns {string} - Formatted date/time
 */
function formatBatchTime(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ============================================================
// Hash Utilities
// ============================================================

/**
 * Simple string hash function for change detection
 * @param {string} str - String to hash
 * @returns {number} - Hash value
 */
function hashString(str) {
    let hash = 0;
    if (!str || str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
}

// ============================================================
// DOM Utilities
// ============================================================

/**
 * Update element content only if changed (prevents flicker)
 * @param {string|HTMLElement} selector - CSS selector or element
 * @param {string} newContent - New innerHTML content
 * @returns {boolean} - True if content was updated
 */
function updateElement(selector, newContent) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return false;
    if (el.innerHTML !== newContent) {
        el.innerHTML = newContent;
        return true;
    }
    return false;
}

/**
 * Update element text content only if changed
 * @param {string|HTMLElement} selector - CSS selector or element
 * @param {string} newText - New text content
 * @returns {boolean} - True if content was updated
 */
function updateText(selector, newText) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return false;
    if (el.textContent !== newText) {
        el.textContent = newText;
        return true;
    }
    return false;
}

/**
 * Check if user prefers reduced motion
 * @returns {boolean}
 */
function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ============================================================
// Command Type Helpers
// ============================================================

/**
 * Get command type for styling
 * @param {string} command - Command name
 * @returns {string} - Command type key
 */
function getCommandType(command) {
    if (!command) return 'default';
    const baseCommand = command.split(' ')[0].split('#')[0].trim().toLowerCase();
    const knownCommands = [
        'create-story', 'story-review', 'create-tech-spec',
        'tech-spec-review', 'dev-story', 'code-review', 'commit'
    ];
    return knownCommands.includes(baseCommand) ? baseCommand : 'default';
}

/**
 * Get command type colors for active operation cards
 * @param {string} command - Command name
 * @returns {Object} - Object with bg and text colors
 */
function getCommandTypeColors(command) {
    const colors = {
        'sprint-create-story': { bg: '#dbeafe', text: '#1e40af' },
        'create-story': { bg: '#dbeafe', text: '#1e40af' },
        'sprint-story-review': { bg: '#fef3c7', text: '#92400e' },
        'story-review': { bg: '#fef3c7', text: '#92400e' },
        'sprint-create-tech-spec': { bg: '#e0e7ff', text: '#3730a3' },
        'create-tech-spec': { bg: '#e0e7ff', text: '#3730a3' },
        'sprint-tech-spec-review': { bg: '#ede9fe', text: '#5b21b6' },
        'tech-spec-review': { bg: '#ede9fe', text: '#5b21b6' },
        'sprint-dev-story': { bg: '#dcfce7', text: '#166534' },
        'dev-story': { bg: '#dcfce7', text: '#166534' },
        'sprint-code-review': { bg: '#f3e8ff', text: '#6b21a8' },
        'code-review': { bg: '#f3e8ff', text: '#6b21a8' },
        'sprint-commit': { bg: '#ccfbf1', text: '#115e59' },
        'commit': { bg: '#ccfbf1', text: '#115e59' }
    };
    return colors[command] || { bg: '#e8e7e5', text: '#787774' };
}

// ============================================================
// Event Status Helpers
// ============================================================

/**
 * Get event status from event object
 * @param {Object} event - Event object
 * @returns {string} - Status string
 */
function getEventStatus(event) {
    // Handle database event format (has 'status' field)
    if (event.status) {
        const s = event.status.toLowerCase();
        if (s === 'start') return 'start';
        if (s === 'end' || s === 'complete' || s === 'completed') return 'end';
        if (s === 'progress') return 'progress';
        if (s === 'error' || s === 'failed') return 'error';
        return 'system';
    }
    // Handle WebSocket event format (has 'type' field)
    if (event.type?.includes('start')) return 'start';
    if (event.type?.includes('end') || event.type?.includes('complete')) return 'end';
    if (event.type?.includes('progress')) return 'progress';
    if (event.type?.includes('error')) return 'error';
    return 'system';
}

// ============================================================
// Export for module pattern (optional)
// ============================================================

// All functions are global for simple script loading
// If using ES modules in future, uncomment:
// export { ... }
