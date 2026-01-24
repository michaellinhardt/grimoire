/**
 * websocket.js - WebSocket connection management
 * Dependencies: utils.js
 * Accesses: sprintRunState from main.js (initialized before use)
 */

// ============================================================
// WebSocket URL Generation with Protocol Detection
// ============================================================

/**
 * Get WebSocket URL with correct protocol (ws:// or wss://)
 * @returns {string} - WebSocket URL
 */
function getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
}

// ============================================================
// WebSocket Connection Management
// ============================================================

/**
 * Connect to the Sprint WebSocket server
 * Uses sprintRunState from main.js
 */
function connectSprintWebSocket() {
    const wsUrl = getWebSocketUrl();

    // Determine status based on reconnect attempts
    const isReconnecting = sprintRunState.wsReconnectAttempts > 0;
    updateWsConnectionStatus(isReconnecting ? 'reconnecting' : 'connecting');

    try {
        sprintRunState.ws = new WebSocket(wsUrl);

        sprintRunState.ws.onopen = () => {
            console.log('WebSocket connected');
            updateWsConnectionStatus('connected');

            const wasReconnecting = sprintRunState.wsReconnectAttempts > 0;
            sprintRunState.wsReconnectAttempts = 0;

            if (wasReconnecting) {
                addLogEntry({ type: 'system', message: 'Reconnected to server' }, 'system');
                // Request full state for reconciliation
                requestStateReconciliation();
            } else {
                addLogEntry({ type: 'system', message: 'Connected to server' }, 'system');
            }

            // Process any queued events
            processEventQueue();
        };

        sprintRunState.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Track last event timestamp for reconciliation
                if (data.timestamp) {
                    sprintRunState.lastEventTimestamp = Math.max(
                        sprintRunState.lastEventTimestamp,
                        data.timestamp
                    );
                }

                handleWebSocketEvent(data);
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };

        sprintRunState.ws.onclose = (event) => {
            console.log('WebSocket disconnected', event.code, event.reason);
            updateWsConnectionStatus('disconnected');

            // Stop all running timers on disconnect
            stopAllTimers();

            scheduleWsReconnect();
        };

        sprintRunState.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            // Don't update status here - onclose will fire next
        };
    } catch (e) {
        console.error('Failed to create WebSocket:', e);
        updateWsConnectionStatus('disconnected');
        scheduleWsReconnect();
    }
}

/**
 * Schedule WebSocket reconnection with exponential backoff
 */
function scheduleWsReconnect() {
    if (sprintRunState.wsReconnectTimer) return;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const baseDelay = 1000;
    const delay = Math.min(baseDelay * Math.pow(2, sprintRunState.wsReconnectAttempts), 30000);
    sprintRunState.wsReconnectAttempts++;

    console.log(`Scheduling reconnect attempt ${sprintRunState.wsReconnectAttempts} in ${delay}ms`);
    updateWsConnectionStatus('reconnecting');

    sprintRunState.wsReconnectTimer = setTimeout(() => {
        sprintRunState.wsReconnectTimer = null;
        connectSprintWebSocket();
    }, delay);
}

/**
 * Update WebSocket connection status UI
 * @param {string} status - connected|connecting|reconnecting|disconnected
 */
function updateWsConnectionStatus(status) {
    sprintRunState.connectionStatus = status;

    // Update sprint run tab status
    const dot = document.getElementById('wsConnectionDot');
    const text = document.getElementById('wsConnectionText');
    const statusContainer = document.querySelector('.ws-connection-status');

    // Update header status
    const headerDot = document.getElementById('headerConnectionDot');
    const headerText = document.getElementById('headerConnectionText');

    const statusConfig = {
        connected: {
            text: 'Connected',
            tooltip: 'Connected to server'
        },
        connecting: {
            text: 'Connecting...',
            tooltip: 'Connecting to server...'
        },
        reconnecting: {
            text: `Reconnecting (${sprintRunState.wsReconnectAttempts})...`,
            tooltip: `Reconnecting to server (attempt ${sprintRunState.wsReconnectAttempts}). Click to retry now.`
        },
        disconnected: {
            text: 'Disconnected',
            tooltip: 'Disconnected from server. Click to retry.'
        }
    };

    const config = statusConfig[status] || statusConfig.disconnected;

    // Update sprint run tab
    if (dot) dot.className = 'ws-connection-dot ' + status;
    if (text) text.textContent = config.text;

    if (statusContainer) {
        statusContainer.title = config.tooltip;
        statusContainer.style.cursor = (status === 'disconnected' || status === 'reconnecting')
            ? 'pointer'
            : 'default';
    }

    // Update header
    if (headerDot) headerDot.className = 'connection-indicator__dot connection-indicator__dot--' + status;
    if (headerText) headerText.textContent = config.text;
}

/**
 * Process queued events after reconnection
 */
function processEventQueue() {
    if (sprintRunState.eventQueue.length === 0) return;

    console.log(`Processing ${sprintRunState.eventQueue.length} queued events`);
    const queue = [...sprintRunState.eventQueue];
    sprintRunState.eventQueue = [];

    queue.forEach(event => handleWebSocketEvent(event));
}

/**
 * Queue event during reconnection
 * @param {Object} event - Event to queue
 */
function queueEvent(event) {
    // Only queue if we're reconnecting and have a batch running
    if (sprintRunState.connectionStatus === 'reconnecting' && sprintRunState.isRunning) {
        sprintRunState.eventQueue.push(event);
        // Limit queue size to prevent memory issues
        if (sprintRunState.eventQueue.length > 100) {
            sprintRunState.eventQueue.shift();
        }
    }
}

/**
 * Request state reconciliation after reconnect
 */
function requestStateReconciliation() {
    if (sprintRunState.ws && sprintRunState.ws.readyState === WebSocket.OPEN) {
        // Send ping to get fresh state
        sprintRunState.ws.send(JSON.stringify({
            type: 'ping',
            last_timestamp: sprintRunState.lastEventTimestamp
        }));
    }
}

/**
 * Force immediate reconnection attempt
 */
function forceReconnect() {
    const status = sprintRunState.connectionStatus;
    if (status === 'disconnected' || status === 'reconnecting') {
        // Cancel any pending reconnect
        if (sprintRunState.wsReconnectTimer) {
            clearTimeout(sprintRunState.wsReconnectTimer);
            sprintRunState.wsReconnectTimer = null;
        }
        // Reset attempts for immediate retry
        sprintRunState.wsReconnectAttempts = 0;
        connectSprintWebSocket();
    }
}

// ============================================================
// WebSocket Event Handler
// ============================================================

/**
 * Handle incoming WebSocket events
 * @param {Object} event - Parsed event data
 */
function handleWebSocketEvent(event) {
    const { type, payload, timestamp } = event;

    switch (type) {
        case 'init':
            // Initial state hydration from server
            if (payload.batch) {
                handleBatchState(payload.batch);
            }
            if (payload.events) {
                // Sort events by timestamp for proper ordering
                const sortedEvents = [...payload.events].sort((a, b) =>
                    (a.timestamp || 0) - (b.timestamp || 0));
                sortedEvents.forEach(e => addLogEntry(e, getEventStatus(e)));
                // Restore active operations from historical events
                restoreActiveOperationsFromEvents(sortedEvents);
            }
            break;

        case 'batch:start':
            sprintRunState.isRunning = true;
            sprintRunState.isStopping = false;
            sprintRunState.currentBatchId = payload.batch_id;
            sprintRunState.maxCycles = payload.max_cycles || 0;
            sprintRunState.currentCycle = 0;
            // Clear stale state from previous batch
            sprintRunState.activeOperations.clear();
            stopAllTimers();
            updateSprintUI();
            showProgressSection(true);
            addLogEntry({ type, payload, timestamp }, 'start');
            updateTabIndicator(true);
            // Animate progress section entrance
            triggerNewItemAnimation(document.getElementById('sprintProgressSection'));
            break;

        case 'batch:end':
            sprintRunState.isRunning = false;
            sprintRunState.isStopping = false;
            sprintRunState.currentOperation = null;
            // Stop all timers and clear active operations
            stopAllTimers();
            sprintRunState.activeOperations.clear();
            renderActiveOperationsDisplay();
            updateSprintUI();
            // Stop progress animation and trigger completion
            const progressFill = document.getElementById('sprintProgressFill');
            if (progressFill) {
                stopProgressAnimation(progressFill);
                progressFill.classList.remove('progress-indeterminate');
            }
            // Trigger completion animation on progress section
            const progressSection = document.getElementById('sprintProgressSection');
            if (progressSection && payload.status === 'completed') {
                triggerCompletionAnimation(progressSection);
            }
            addLogEntry({ type, payload, timestamp }, payload.status === 'completed' ? 'end' : 'system');
            updateTabIndicator(false);
            if (payload.status === 'completed') {
                showToast(`Batch completed: ${payload.cycles_completed} cycles`, 'success', 'Sprint Complete');
            } else if (payload.status === 'stopped') {
                showToast('Batch stopped by user', 'warning', 'Sprint Stopped');
            } else if (payload.status === 'error') {
                showToast('Batch ended with errors', 'error', 'Sprint Error');
            }
            break;

        case 'cycle:start':
            sprintRunState.currentCycle = payload.cycle_number;
            sprintRunState.activeStories = payload.story_keys || [];
            updateProgress();
            updateActiveStories();
            addLogEntry({ type, payload, timestamp }, 'start');
            break;

        case 'cycle:end':
            updateProgress();
            addLogEntry({ type, payload, timestamp }, 'end');
            break;

        case 'command:start':
            sprintRunState.currentOperation = `${payload.story_key} ${payload.command} (${payload.task_id})`;
            updateCurrentOperation();
            // Track active operations and start timer
            sprintRunState.activeOperations.set(payload.task_id, {
                storyKey: payload.story_key,
                command: payload.command,
                taskId: payload.task_id,
                message: '',
                startTime: timestamp || Date.now()
            });
            startCommandTimer(payload.task_id, timestamp || Date.now());
            renderActiveOperationsDisplay();
            autoExpandStoryRow(payload.story_key);
            addLogEntry({ type, payload, timestamp }, 'start');
            break;

        case 'command:progress':
            // Update active operation message
            const progOp = sprintRunState.activeOperations.get(payload.task_id);
            if (progOp) {
                progOp.message = payload.message || '';
                updateActiveOperationMessage(payload.task_id, payload.message);
            }
            addLogEntry({ type, payload, timestamp }, 'progress');
            break;

        case 'command:end':
            // Stop timer and animate completion
            stopCommandTimer(payload.task_id);
            const opElement = document.querySelector(`[data-operation-task="${CSS.escape(payload.task_id)}"]`);
            if (opElement) {
                if (payload.status === 'error' || payload.status === 'failed') {
                    triggerErrorAnimation(opElement);
                } else {
                    triggerCompletionAnimation(opElement);
                }
                setTimeout(() => {
                    sprintRunState.activeOperations.delete(payload.task_id);
                    renderActiveOperationsDisplay();
                }, 600);
            } else {
                sprintRunState.activeOperations.delete(payload.task_id);
                renderActiveOperationsDisplay();
            }
            if (sprintRunState.currentOperation &&
                sprintRunState.currentOperation.includes(payload.story_key)) {
                sprintRunState.currentOperation = null;
                updateCurrentOperation();
            }
            // Trigger error animation if command failed
            if (payload.status === 'error' || payload.status === 'failed') {
                const opCard = document.getElementById('sprintCurrentOp')?.closest('.card, .active-operation-card');
                if (opCard) triggerErrorAnimation(opCard);
            }
            addLogEntry({ type, payload, timestamp }, (payload.status === 'error' || payload.status === 'failed') ? 'error' : 'end');
            break;

        case 'story:status':
            updateStoryBadge(payload.story_key, payload.new_status);
            addLogEntry({ type, payload, timestamp }, 'system');
            break;

        case 'error':
            addLogEntry({ type, payload, timestamp }, 'error');
            showToast(payload.message, 'error', 'Error');
            // Trigger error animation on error events
            const errorCard = document.getElementById('sprintCurrentOp')?.closest('.card, .active-operation-card');
            if (errorCard) triggerErrorAnimation(errorCard);
            break;

        case 'context:create':
        case 'context:refresh':
        case 'context:complete':
            addLogEntry({ type, payload, timestamp }, 'system');
            break;

        case 'batch:warning':
            // Handle batch warning events
            addLogEntry({ type, payload, timestamp }, 'warning');
            showToast(payload.message || 'Warning occurred', 'warning', 'Warning');
            break;

        case 'pong':
            // Server acknowledged ping - no action needed
            break;

        default:
            console.log('Unknown WebSocket event:', type, payload);
    }
}

// ============================================================
// Event Listener for Connection Status Click
// ============================================================

// Will be initialized in main.js DOMContentLoaded
function initWebSocketClickHandler() {
    const statusContainer = document.querySelector('.ws-connection-status');
    if (statusContainer) {
        statusContainer.addEventListener('click', forceReconnect);
    }

    const headerIndicator = document.getElementById('headerConnectionIndicator');
    if (headerIndicator) {
        headerIndicator.addEventListener('click', forceReconnect);
    }
}
