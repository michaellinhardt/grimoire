/**
 * operations.js - Active operations display and timer system
 * Dependencies: utils.js
 * Accesses: sprintRunState from main.js
 */

// ============================================================
// Timer System
// ============================================================

/**
 * Start command timer
 * @param {string} taskId - Task ID
 * @param {number} startTime - Start timestamp
 */
function startCommandTimer(taskId, startTime) {
    stopCommandTimer(taskId);
    const startTs = typeof startTime === 'number' ? startTime : Date.now();

    const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - startTs) / 1000);
        updateTimerDisplay(taskId, formatTimerDuration(elapsed));
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);
    sprintRunState.runningTimers.set(taskId, intervalId);
}

/**
 * Stop command timer
 * @param {string} taskId - Task ID
 */
function stopCommandTimer(taskId) {
    const intervalId = sprintRunState.runningTimers.get(taskId);
    if (intervalId) {
        clearInterval(intervalId);
        sprintRunState.runningTimers.delete(taskId);
    }
}

/**
 * Stop all running timers
 */
function stopAllTimers() {
    sprintRunState.runningTimers.forEach(intervalId => clearInterval(intervalId));
    sprintRunState.runningTimers.clear();
}

/**
 * Update timer display element
 * @param {string} taskId - Task ID
 * @param {string} timeText - Formatted time
 */
function updateTimerDisplay(taskId, timeText) {
    const timerEl = document.querySelector(`[data-timer-task="${CSS.escape(taskId)}"]`);
    if (timerEl) timerEl.textContent = timeText;
}

// ============================================================
// Active Operations Display
// ============================================================

/**
 * Render active operations display
 */
function renderActiveOperationsDisplay() {
    const container = document.getElementById('sprintActiveStories');
    if (!container) return;

    if (sprintRunState.activeOperations.size === 0) {
        container.innerHTML = sprintRunState.activeStories.length > 0
            ? sprintRunState.activeStories.map(key =>
                `<span class="sprint-story-badge in-progress" data-story="${escapeHtml(key)}">${escapeHtml(key)}</span>`
            ).join('')
            : '';
        return;
    }

    let html = '';
    sprintRunState.activeOperations.forEach((op, taskId) => {
        const cmdColors = getCommandTypeColors(op.command);
        html += `<div class="active-operation-card operation-running" data-operation-task="${escapeHtml(taskId)}">
            <div class="active-operation-header">
                <span class="active-operation-story">${escapeHtml(op.storyKey)}</span>
                <span class="active-operation-timer" data-timer-task="${escapeHtml(taskId)}">0:00</span>
            </div>
            <span class="active-operation-command" style="background: ${cmdColors.bg}; color: ${cmdColors.text};">${escapeHtml(op.command)}</span>
            <div class="active-operation-progress"><div class="active-operation-progress-fill progress-active"></div></div>
            <div class="active-operation-message">${escapeHtml(op.message || 'Starting...')}</div>
        </div>`;
    });

    container.innerHTML = html;

    // Trigger animations for new cards
    container.querySelectorAll('.active-operation-card').forEach(card => {
        triggerNewItemAnimation(card);
    });
}

/**
 * Update active operation message
 * @param {string} taskId - Task ID
 * @param {string} message - New message
 */
function updateActiveOperationMessage(taskId, message) {
    const msgEl = document.querySelector(`[data-operation-task="${CSS.escape(taskId)}"] .active-operation-message`);
    if (msgEl) msgEl.textContent = message || '';
}

/**
 * Create an Operation Card
 * @param {Object} operation - Operation data
 * @returns {string} - HTML string
 */
function createOperationCard(operation) {
    const storyKey = operation.storyKey || operation.storyId || '';
    const command = operation.command || '';
    const message = operation.message || '';
    const elapsedSeconds = operation.elapsedSeconds || 0;
    const elapsedStr = formatDuration(elapsedSeconds);

    return `<div class="operation-card operation-card--running" data-story-key="${escapeHtml(storyKey)}">
        <div class="operation-card__header">
            <span class="operation-card__story-key">${escapeHtml(storyKey)}</span>
            ${createCommandBadge(command, true)}
            <span class="operation-card__timer">${escapeHtml(elapsedStr)}</span>
        </div>
        <div class="operation-card__progress">
            <div class="operation-card__progress-bar">
                <div class="operation-card__progress-fill"></div>
            </div>
        </div>
        ${message ? `<div class="operation-card__message">${escapeHtml(message)}</div>` : ''}
    </div>`;
}

// ============================================================
// State Restoration
// ============================================================

/**
 * Restore active operations from historical events
 * @param {Array} events - Array of events
 */
function restoreActiveOperationsFromEvents(events) {
    const activeOps = new Map();

    events.forEach(event => {
        const type = event.type;
        const payload = event.payload || event;

        if (type === 'command:start') {
            activeOps.set(payload.task_id, {
                storyKey: payload.story_key,
                command: payload.command,
                taskId: payload.task_id,
                message: '',
                startTime: event.timestamp || Date.now()
            });
        } else if (type === 'command:end') {
            activeOps.delete(payload.task_id);
        } else if (type === 'command:progress' && activeOps.has(payload.task_id)) {
            activeOps.get(payload.task_id).message = payload.message || '';
        }
    });

    sprintRunState.activeOperations = activeOps;

    // Start timers for active operations
    activeOps.forEach((op, taskId) => {
        startCommandTimer(taskId, op.startTime);
    });

    renderActiveOperationsDisplay();
}

/**
 * Auto-expand story row in timeline
 * @param {string} storyKey - Story key
 */
function autoExpandStoryRow(storyKey) {
    sprintRunState.storyExpansionState.set(storyKey, true);
    const storyRow = document.querySelector(`[data-story-id="${CSS.escape(storyKey)}"]`);
    if (storyRow && !storyRow.classList.contains('expanded')) {
        const expandIcon = storyRow.querySelector('.timeline-row-expand');
        if (expandIcon) expandIcon.click();
    }
}

// ============================================================
// Animation Helpers
// ============================================================

/**
 * Apply a one-shot animation class to an element
 * @param {HTMLElement} element - Element to animate
 * @param {string} animationClass - CSS animation class
 * @param {number} duration - Duration in ms
 */
function triggerAnimation(element, animationClass, duration = 600) {
    if (!element || prefersReducedMotion()) return;

    // Track pending animations to prevent duplicates
    const animKey = `${element.id || element.className}-${animationClass}`;
    if (sprintRunState.pendingAnimations.has(animKey)) return;

    sprintRunState.pendingAnimations.add(animKey);
    element.classList.add(animationClass);

    setTimeout(() => {
        element.classList.remove(animationClass);
        sprintRunState.pendingAnimations.delete(animKey);
    }, duration);
}

/**
 * Trigger completion flash animation
 * @param {HTMLElement} element - Element that completed
 */
function triggerCompletionAnimation(element) {
    triggerAnimation(element, 'just-completed', 600);
}

/**
 * Trigger error shake animation
 * @param {HTMLElement} element - Element with error
 */
function triggerErrorAnimation(element) {
    triggerAnimation(element, 'error-shake', 500);
}

/**
 * Trigger new item slide animation
 * @param {HTMLElement} element - New element
 */
function triggerNewItemAnimation(element) {
    triggerAnimation(element, 'new-item-slide', 300);
}

/**
 * Trigger status change highlight animation
 * @param {HTMLElement} element - Element with status change
 */
function triggerStatusChangeAnimation(element) {
    triggerAnimation(element, 'status-changed', 600);
}

/**
 * Add running animation class to element
 * @param {HTMLElement} element - Element in running state
 */
function startRunningAnimation(element) {
    if (!element || prefersReducedMotion()) return;
    element.classList.add('operation-running');
}

/**
 * Remove running animation class from element
 * @param {HTMLElement} element - Element no longer running
 */
function stopRunningAnimation(element) {
    if (!element) return;
    element.classList.remove('operation-running');
}

/**
 * Add shimmer animation to progress bar
 * @param {HTMLElement} progressBar - Progress bar element
 */
function startProgressAnimation(progressBar) {
    if (!progressBar || prefersReducedMotion()) return;
    progressBar.classList.add('progress-active');
}

/**
 * Remove shimmer animation from progress bar
 * @param {HTMLElement} progressBar - Progress bar element
 */
function stopProgressAnimation(progressBar) {
    if (!progressBar) return;
    progressBar.classList.remove('progress-active');
}

/**
 * Apply new-entry animation to log entry
 * @param {HTMLElement} entry - Log entry element
 * @param {string} status - Status type
 */
function animateLogEntry(entry, status) {
    if (!entry || prefersReducedMotion()) return;

    entry.classList.add('new-entry');

    // Remove animation class after completion
    setTimeout(() => {
        entry.classList.remove('new-entry');
    }, 300);
}

/**
 * Simple animation helper
 * @param {string|HTMLElement} element - Element or selector
 * @param {string} animationClass - CSS class
 * @param {number} duration - Duration in ms
 */
function animateElement(element, animationClass, duration = 500) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (!el) return;
    el.classList.add(animationClass);
    setTimeout(() => el.classList.remove(animationClass), duration);
}

function flashSuccess(element) { animateElement(element, 'just-completed', 800); }
function shakeError(element) { animateElement(element, 'error-shake', 500); }
function slideInNew(element) { animateElement(element, 'new-item-slide', 300); }
