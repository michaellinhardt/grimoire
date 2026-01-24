/**
 * controls.js - Start/Stop control functionality
 * Dependencies: utils.js
 * Accesses: sprintRunState from main.js
 */

// ============================================================
// Start/Stop Sprint Actions
// ============================================================

/**
 * Start a sprint run
 */
async function startSprint() {
    const batchInput = document.getElementById('batchSizeInput');
    const runAllCheckbox = document.getElementById('runAllCheckbox');

    const batchSize = runAllCheckbox.checked ? 'all' : parseInt(batchInput.value, 10);

    if (!runAllCheckbox.checked && (isNaN(batchSize) || batchSize < 1)) {
        showToast('Please enter a valid batch size (positive number)', 'warning');
        return;
    }

    try {
        const response = await fetch('/api/orchestrator/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_size: batchSize })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Failed to start sprint');
        }

        // UI updates will come via WebSocket
        showToast('Sprint started', 'success');

    } catch (error) {
        console.error('Failed to start sprint:', error);
        showToast(error.message || 'Failed to start sprint', 'error');
    }
}

/**
 * Stop a running sprint
 */
async function stopSprint() {
    sprintRunState.isStopping = true;
    updateSprintUI();

    try {
        const response = await fetch('/api/orchestrator/stop', {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Failed to stop sprint');
        }

        showToast('Stop signal sent. Waiting for current operation to complete...', 'warning');

    } catch (error) {
        console.error('Failed to stop sprint:', error);
        showToast(error.message || 'Failed to stop sprint', 'error');
        sprintRunState.isStopping = false;
        updateSprintUI();
    }
}

// ============================================================
// Sprint UI Update Functions
// ============================================================

/**
 * Update Sprint Run tab UI based on state
 */
function updateSprintUI() {
    const startBtn = document.getElementById('sprintStartBtn');
    const stopBtn = document.getElementById('sprintStopBtn');
    const batchInput = document.getElementById('batchSizeInput');
    const runAllCheckbox = document.getElementById('runAllCheckbox');
    const statusValue = document.getElementById('sprintStatusValue');

    // Header controls
    const headerStartBtn = document.getElementById('headerStartBtn');
    const headerStopBtn = document.getElementById('headerStopBtn');

    if (sprintRunState.isRunning) {
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = sprintRunState.isStopping;
        if (batchInput) batchInput.disabled = true;
        if (runAllCheckbox) runAllCheckbox.disabled = true;

        // Header buttons
        if (headerStartBtn) headerStartBtn.disabled = true;
        if (headerStopBtn) headerStopBtn.disabled = sprintRunState.isStopping;

        if (statusValue) {
            if (sprintRunState.isStopping) {
                statusValue.textContent = 'Stopping...';
                statusValue.className = 'sprint-status-value stopping';
            } else {
                const cycleText = sprintRunState.maxCycles > 0
                    ? `Running cycle ${sprintRunState.currentCycle}/${sprintRunState.maxCycles}`
                    : `Running cycle ${sprintRunState.currentCycle}`;
                statusValue.textContent = cycleText;
                statusValue.className = 'sprint-status-value running';
            }
        }
    } else {
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        if (batchInput) batchInput.disabled = runAllCheckbox?.checked || false;
        if (runAllCheckbox) runAllCheckbox.disabled = false;

        // Header buttons
        if (headerStartBtn) headerStartBtn.disabled = false;
        if (headerStopBtn) headerStopBtn.disabled = true;

        if (statusValue) {
            statusValue.textContent = 'Idle';
            statusValue.className = 'sprint-status-value idle';
        }
    }
}

/**
 * Update current operation display
 */
function updateCurrentOperation() {
    const opDisplay = document.getElementById('sprintCurrentOp');
    const opCard = opDisplay?.closest('.card, .active-operation-card');

    if (opDisplay) {
        opDisplay.textContent = sprintRunState.currentOperation || '-';
    }

    // Trigger running animation when operation is active
    if (opCard) {
        if (sprintRunState.currentOperation) {
            startRunningAnimation(opCard);
        } else {
            stopRunningAnimation(opCard);
            // Trigger completion animation when operation ends
            triggerCompletionAnimation(opCard);
        }
    }
}

/**
 * Show/hide progress section
 * @param {boolean} show - Whether to show
 */
function showProgressSection(show) {
    const section = document.getElementById('sprintProgressSection');
    if (section) {
        section.style.display = show ? 'block' : 'none';
    }
}

/**
 * Update tab indicator for Sprint Run tab
 * @param {boolean} isActive - Whether sprint is running
 */
function updateTabIndicator(isActive) {
    const countSpan = document.getElementById('sprintRunCount');
    if (countSpan) {
        if (isActive) {
            countSpan.textContent = '\u25CF'; // Filled circle
            countSpan.classList.add('active');
        } else {
            countSpan.textContent = '';
            countSpan.classList.remove('active');
        }
    }
}

// ============================================================
// Sprint Run Preferences Persistence
// ============================================================

/**
 * Save sprint run preferences to localStorage
 */
function saveSprintRunPrefs() {
    const batchInput = document.getElementById('batchSizeInput');
    const runAllCheckbox = document.getElementById('runAllCheckbox');

    if (batchInput && batchInput.value && !runAllCheckbox?.checked) {
        storageSet(UI_STATE_KEYS.SPRINTRUN_BATCHSIZE, batchInput.value);
    }
    if (runAllCheckbox) {
        storageSet(UI_STATE_KEYS.SPRINTRUN_RUNALL, runAllCheckbox.checked);
    }
}

/**
 * Restore sprint run preferences from localStorage
 */
function restoreSprintRunPrefs() {
    const savedBatchSize = storageGet(UI_STATE_KEYS.SPRINTRUN_BATCHSIZE);
    const savedRunAll = storageGet(UI_STATE_KEYS.SPRINTRUN_RUNALL) === 'true';

    const batchInput = document.getElementById('batchSizeInput');
    const runAllCheckbox = document.getElementById('runAllCheckbox');

    if (savedBatchSize && batchInput) {
        batchInput.value = savedBatchSize;
    }
    if (runAllCheckbox) {
        runAllCheckbox.checked = savedRunAll;
    }
    if (batchInput) {
        batchInput.disabled = savedRunAll;
    }
}

// ============================================================
// Control Event Listeners Initialization
// ============================================================

/**
 * Initialize control event listeners
 * Called from main.js in DOMContentLoaded
 */
function initControlListeners() {
    // Sprint Run tab buttons
    const sprintStartBtn = document.getElementById('sprintStartBtn');
    const sprintStopBtn = document.getElementById('sprintStopBtn');

    if (sprintStartBtn) {
        sprintStartBtn.addEventListener('click', startSprint);
    }
    if (sprintStopBtn) {
        sprintStopBtn.addEventListener('click', stopSprint);
    }

    // Run All checkbox
    const runAllCheckbox = document.getElementById('runAllCheckbox');
    if (runAllCheckbox) {
        runAllCheckbox.addEventListener('change', function() {
            const batchInput = document.getElementById('batchSizeInput');
            if (batchInput) {
                batchInput.disabled = this.checked;
                if (this.checked) {
                    batchInput.value = '';
                } else {
                    batchInput.value = storageGet(UI_STATE_KEYS.SPRINTRUN_BATCHSIZE) || '2';
                }
            }
            saveSprintRunPrefs();
        });
    }

    // Batch size input
    const batchSizeInput = document.getElementById('batchSizeInput');
    if (batchSizeInput) {
        batchSizeInput.addEventListener('change', saveSprintRunPrefs);
    }

    // Header controls
    const headerStartBtn = document.getElementById('headerStartBtn');
    const headerStopBtn = document.getElementById('headerStopBtn');
    const headerBatchSize = document.getElementById('headerBatchSize');
    const headerRunAll = document.getElementById('headerRunAll');

    // Connect header start button
    if (headerStartBtn) {
        headerStartBtn.addEventListener('click', function() {
            if (sprintStartBtn) sprintStartBtn.click();
        });
    }

    // Connect header stop button
    if (headerStopBtn) {
        headerStopBtn.addEventListener('click', function() {
            if (sprintStopBtn) sprintStopBtn.click();
        });
    }

    // Sync batch size input
    if (headerBatchSize && batchSizeInput) {
        headerBatchSize.value = batchSizeInput.value;

        headerBatchSize.addEventListener('change', function() {
            batchSizeInput.value = this.value;
            saveSprintRunPrefs();
        });

        batchSizeInput.addEventListener('change', function() {
            headerBatchSize.value = this.value;
        });
    }

    // Sync run all checkbox
    if (headerRunAll && runAllCheckbox) {
        headerRunAll.checked = runAllCheckbox.checked;

        headerRunAll.addEventListener('change', function() {
            runAllCheckbox.checked = this.checked;
            runAllCheckbox.dispatchEvent(new Event('change'));
        });

        runAllCheckbox.addEventListener('change', function() {
            headerRunAll.checked = this.checked;
        });
    }
}
