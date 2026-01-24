/**
 * batch.js - Batch display and progress functionality
 * Dependencies: utils.js
 * Accesses: sprintRunState from main.js
 */

// ============================================================
// Batch State Handling
// ============================================================

/**
 * Handle batch state from init or reconnect
 * @param {Object} batch - Batch data from server
 */
function handleBatchState(batch) {
    if (batch && batch.status === 'running') {
        sprintRunState.isRunning = true;
        sprintRunState.currentBatchId = batch.id;
        sprintRunState.maxCycles = batch.max_cycles;
        sprintRunState.currentCycle = batch.cycles_completed || 0;
        updateSprintUI();
        showProgressSection(true);
        updateTabIndicator(true);
    }
}

// ============================================================
// Progress Display Functions
// ============================================================

/**
 * Update progress bar and stats
 */
function updateProgress() {
    const fill = document.getElementById('sprintProgressFill');
    const stats = document.getElementById('sprintProgressStats');

    if (!fill || !stats) return;

    // Handle unlimited mode with indeterminate progress
    const isUnlimited = sprintRunState.maxCycles <= 0;

    if (isUnlimited) {
        // Use indeterminate progress animation for unlimited mode
        fill.style.width = '100%';
        if (!fill.classList.contains('progress-indeterminate')) {
            fill.classList.remove('progress-active');
            fill.classList.add('progress-indeterminate');
        }
    } else {
        const progress = (sprintRunState.currentCycle / sprintRunState.maxCycles) * 100;
        fill.style.width = `${Math.min(progress, 100)}%`;
        fill.classList.remove('progress-indeterminate');

        // Add shimmer animation when running
        if (sprintRunState.isRunning && !fill.classList.contains('progress-active')) {
            startProgressAnimation(fill);
        } else if (!sprintRunState.isRunning) {
            stopProgressAnimation(fill);
        }
    }

    stats.textContent = sprintRunState.maxCycles > 0
        ? `${sprintRunState.currentCycle}/${sprintRunState.maxCycles} cycles`
        : `${sprintRunState.currentCycle} cycles`;
}

/**
 * Update active stories display
 */
function updateActiveStories() {
    const container = document.getElementById('sprintActiveStories');
    if (!container) return;

    container.innerHTML = sprintRunState.activeStories.map(key =>
        `<span class="sprint-story-badge in-progress" data-story="${escapeHtml(key)}">${escapeHtml(key)}</span>`
    ).join('');
}

/**
 * Update story badge status
 * @param {string} storyKey - Story key
 * @param {string} status - New status
 */
function updateStoryBadge(storyKey, status) {
    // Use CSS.escape for safe selector
    const escapedKey = CSS.escape(storyKey);
    const badge = document.querySelector(`.sprint-story-badge[data-story="${escapedKey}"]`);
    if (badge) {
        badge.className = `sprint-story-badge ${status === 'done' ? 'done' : 'in-progress'}`;
        // Trigger status change animation
        triggerStatusChangeAnimation(badge);
    }
}

// ============================================================
// Event Log Functions
// ============================================================

/**
 * Add entry to sprint event log
 * @param {Object} event - Event data
 * @param {string} status - Event status type
 */
function addLogEntry(event, status) {
    const entries = document.getElementById('sprintLogEntries');
    if (!entries) return;

    // Remove empty state message if present
    const emptyMsg = entries.querySelector('.log-empty');
    if (emptyMsg) emptyMsg.remove();

    const entry = document.createElement('div');
    entry.className = `log-entry ${status}`;

    // Handle timestamp - database events use seconds, WebSocket uses milliseconds
    let timestamp;
    if (event.timestamp) {
        // Database timestamps are in seconds, WebSocket in milliseconds
        const ts = event.timestamp < 10000000000 ? event.timestamp * 1000 : event.timestamp;
        timestamp = formatLogTime(ts);
    } else {
        timestamp = formatLogTime(Date.now());
    }

    // Handle both WebSocket format (payload object) and database format (flat fields)
    const payload = event.payload || {};
    const storyKey = payload.story_key || event.story_key || '-';
    const command = payload.command || event.command || event.type?.split(':')[0] || '-';
    const taskId = payload.task_id || event.task_id || '-';
    const message = payload.message || event.message || '';

    if (event.type === 'system' || status === 'system') {
        entry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-message">${escapeHtml(message || event.type || 'System event')}</span>
        `;
    } else {
        entry.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-story-key">${escapeHtml(storyKey)}</span>
            <span class="log-command">${escapeHtml(command)}</span>
            <span class="log-task-id">${escapeHtml(taskId)}</span>
            <span class="log-status ${status}">${escapeHtml(status)}</span>
            <span class="log-message">${escapeHtml(message)}</span>
        `;
    }

    // Insert at top (newest first)
    entries.insertBefore(entry, entries.firstChild);

    // Trigger animation for new log entry
    animateLogEntry(entry, status);

    // Auto-scroll handling
    if (sprintRunState.autoScroll && !sprintRunState.userScrolled) {
        const logContainer = document.getElementById('sprintLog');
        if (logContainer) logContainer.scrollTop = 0;
    }

    // Limit entries to prevent memory issues
    while (entries.children.length > 500) {
        entries.removeChild(entries.lastChild);
    }
}

/**
 * Clear sprint event log
 */
function clearSprintLog() {
    const entries = document.getElementById('sprintLogEntries');
    if (entries) {
        entries.innerHTML = '<div class="log-empty">Log cleared. Events will appear here.</div>';
    }
}

/**
 * Toggle auto-scroll for event log
 */
function toggleAutoScroll() {
    sprintRunState.autoScroll = !sprintRunState.autoScroll;
    const stateEl = document.getElementById('autoScrollState');
    if (stateEl) {
        stateEl.textContent = sprintRunState.autoScroll ? 'ON' : 'OFF';
    }
}

/**
 * Initialize auto-scroll detection
 * Called from main.js in DOMContentLoaded
 */
function initAutoScrollDetection() {
    const sprintLog = document.getElementById('sprintLog');
    if (sprintLog) {
        sprintLog.addEventListener('scroll', function() {
            const isAtTop = this.scrollTop < 50;
            sprintRunState.userScrolled = !isAtTop;
        });
    }
}

// ============================================================
// Component Factory Functions
// ============================================================

/**
 * Create a Batch Card for history sidebar
 * @param {Object} batch - Batch data
 * @param {boolean} isSelected - Whether selected
 * @param {boolean} isCurrent - Whether current running batch
 * @returns {string} - HTML string
 */
function createBatchCard(batch, isSelected = false, isCurrent = false) {
    const statusClass = batch.status || 'completed';
    const duration = batch.duration_seconds
        ? formatDuration(batch.duration_seconds)
        : (batch.status === 'running' ? 'running...' : '-');

    let classes = 'batch-card';
    if (isCurrent) classes += ' batch-card--current';
    if (isSelected) classes += ' batch-card--selected';

    return `<div class="${classes}" data-batch-id="${batch.id}">
        <div class="batch-card__header">
            <span class="batch-card__status-icon batch-card__status-icon--${statusClass}"></span>
            <span class="batch-card__id">Batch #${escapeHtml(batch.id)}</span>
        </div>
        <div class="batch-card__label">${escapeHtml(batch.status)}</div>
        <div class="batch-card__stats">${batch.cycles_completed || 0}/${batch.max_cycles || 0} cycles</div>
        <div class="batch-card__duration">${escapeHtml(duration)}</div>
    </div>`;
}

/**
 * Create a Status Badge
 * @param {string} status - Status value
 * @returns {string} - HTML string
 */
function createStatusBadge(status) {
    const normalizedStatus = normalizeStatusForClass(status);
    const displayStatus = status.replace(/-/g, ' ');
    return `<span class="status-badge-v2 status-badge-v2--${normalizedStatus}">
        <span class="status-badge-v2__icon"></span>
        ${escapeHtml(displayStatus)}
    </span>`;
}

/**
 * Create a Command Badge
 * @param {string} command - Command name
 * @param {boolean} solid - Use solid variant
 * @returns {string} - HTML string
 */
function createCommandBadge(command, solid = false) {
    const commandType = getCommandType(command);
    const solidClass = solid ? 'command-badge--solid' : '';
    return `<span class="command-badge command-badge--${commandType} ${solidClass}">${escapeHtml(command)}</span>`;
}

/**
 * Create a Progress Bar
 * @param {number} progress - Progress percentage
 * @param {Object} options - Options (variant, size, active, unlimited)
 * @returns {string} - HTML string
 */
function createProgressBar(progress, options = {}) {
    const { variant = 'success', size = 'normal', active = false, unlimited = false } = options;

    let containerClasses = 'progress-bar-v2';
    if (size === 'thin') containerClasses += ' progress-bar-v2--thin';
    if (size === 'thick') containerClasses += ' progress-bar-v2--thick';
    if (active) containerClasses += ' progress-bar-v2--active';
    if (unlimited) containerClasses += ' progress-bar-v2--unlimited';

    const fillClass = `progress-bar-v2__fill progress-bar-v2__fill--${variant}`;
    const width = unlimited ? 30 : Math.min(100, Math.max(0, progress));

    return `<div class="${containerClasses}">
        <div class="${fillClass}" style="width: ${width}%"></div>
    </div>`;
}

/**
 * Create a Control Button
 * @param {string} type - Button type (start, stop, secondary)
 * @param {string} label - Button label
 * @param {Object} options - Options (disabled, icon, onclick)
 * @returns {string} - HTML string
 */
function createControlButton(type, label, options = {}) {
    const { disabled = false, icon = '', onclick = '' } = options;
    const iconHtml = icon ? `<span class="control-btn__icon">${icon}</span>` : '';
    const disabledAttr = disabled ? 'disabled' : '';
    const onclickAttr = onclick ? `onclick="${escapeHtml(onclick)}"` : '';
    return `<button class="control-btn control-btn--${type}" ${disabledAttr} ${onclickAttr}>
        ${iconHtml}${escapeHtml(label)}
    </button>`;
}

/**
 * Create a Connection Indicator
 * @param {string} status - Connection status
 * @param {string} text - Display text
 * @returns {string} - HTML string
 */
function createConnectionIndicator(status, text) {
    return `<div class="connection-indicator connection-indicator--${status}">
        <span class="connection-indicator__icon"></span>
        <span class="connection-indicator__text">${escapeHtml(text)}</span>
    </div>`;
}

/**
 * Update connection indicator in the UI
 * @param {string} status - Connection status
 * @param {string} text - Display text
 */
function updateConnectionIndicator(status, text) {
    const indicator = document.getElementById('connectionIndicator');
    if (indicator) {
        indicator.className = `connection-indicator connection-indicator--${status}`;
        const textEl = indicator.querySelector('.connection-indicator__text');
        if (textEl) textEl.textContent = text;
    }
}
