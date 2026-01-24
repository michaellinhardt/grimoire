/**
 * sidebar.js - Batch history sidebar management
 * Dependencies: utils.js
 * Accesses: state, batchHistoryState from main.js
 */

// ============================================================
// Sidebar Toggle Functions
// ============================================================

/**
 * Toggle main sidebar collapsed state (desktop)
 */
function toggleSidebar() {
    const appLayout = document.getElementById('appLayout');
    sidebarState.collapsed = !sidebarState.collapsed;

    if (sidebarState.collapsed) {
        appLayout.classList.add('sidebar-collapsed');
    } else {
        appLayout.classList.remove('sidebar-collapsed');
    }

    // Save to localStorage with prefix
    storageSet(UI_STATE_KEYS.SIDEBAR_COLLAPSED, sidebarState.collapsed);
}

/**
 * Toggle mobile sidebar (overlay mode)
 */
function toggleMobileSidebar() {
    const appLayout = document.getElementById('appLayout');
    sidebarState.mobileOpen = !sidebarState.mobileOpen;

    if (sidebarState.mobileOpen) {
        appLayout.classList.add('sidebar-open');
    } else {
        appLayout.classList.remove('sidebar-open');
    }
}

/**
 * Close mobile sidebar
 */
function closeMobileSidebar() {
    const appLayout = document.getElementById('appLayout');
    sidebarState.mobileOpen = false;
    appLayout.classList.remove('sidebar-open');
}

/**
 * Restore sidebar state on page load
 */
function restoreSidebarState() {
    const savedCollapsed = storageGet(UI_STATE_KEYS.SIDEBAR_COLLAPSED);
    if (savedCollapsed === 'true') {
        sidebarState.collapsed = true;
        const appLayout = document.getElementById('appLayout');
        if (appLayout) {
            appLayout.classList.add('sidebar-collapsed');
        }
    }
}

// ============================================================
// Batch Sidebar Functions
// ============================================================

/**
 * Toggle batch sidebar collapse
 */
function toggleBatchSidebar() {
    const sidebar = document.getElementById('batchSidebar');
    if (!sidebar) return;
    batchHistoryState.sidebarCollapsed = !batchHistoryState.sidebarCollapsed;
    sidebar.classList.toggle('collapsed', batchHistoryState.sidebarCollapsed);
    storageSet(UI_STATE_KEYS.BATCH_SIDEBAR_COLLAPSED, batchHistoryState.sidebarCollapsed);
}

/**
 * Render batch list in sidebar
 */
function renderBatchList() {
    const container = document.getElementById('batchSidebarContent');
    if (!container) return;

    if (batchHistoryState.isLoading && batchHistoryState.batches.length === 0) {
        container.innerHTML = '<div class="batch-sidebar__loading">Loading batches...</div>';
        return;
    }

    if (batchHistoryState.batches.length === 0) {
        container.innerHTML = '<div class="batch-sidebar__empty">No batch runs yet</div>';
        return;
    }

    let html = '';
    batchHistoryState.batches.forEach((batch, idx) => {
        const isCurrent = batch.status === 'running';
        const isSelected = batch.id === batchHistoryState.selectedBatchId;
        const statusClass = batch.status || 'completed';

        let classes = 'batch-sidebar__item';
        if (isCurrent) classes += ' batch-sidebar__item--current';
        if (isSelected) classes += ' batch-sidebar__item--selected';

        const duration = batch.duration_seconds
            ? formatDuration(batch.duration_seconds)
            : (isCurrent ? 'running...' : '-');

        html += `
            <div class="${classes}" data-batch-id="${batch.id}" onclick="selectBatch(${batch.id})">
                <div class="batch-sidebar__item-header">
                    <span class="batch-sidebar__status-dot batch-sidebar__status-dot--${statusClass}"></span>
                    <span class="batch-sidebar__batch-id">Batch #${batch.id}</span>
                    <span class="batch-sidebar__status-label">${escapeHtml(batch.status)}</span>
                </div>
                <div class="batch-sidebar__stats">
                    ${batch.cycles_completed}/${batch.max_cycles} cycles, ${batch.story_count || 0} stories
                </div>
                <div class="batch-sidebar__duration">${escapeHtml(duration)}</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Update load more button
    const loadMoreBtn = document.getElementById('loadMoreBatches');
    if (loadMoreBtn) {
        loadMoreBtn.disabled = !batchHistoryState.hasMore || batchHistoryState.isLoading;
        loadMoreBtn.textContent = batchHistoryState.isLoading ? 'Loading...' : 'Load More...';
    }
}

/**
 * Fetch batch list from API
 * @param {boolean} append - Append to existing list
 */
async function fetchBatches(append = false) {
    if (batchHistoryState.isLoading) return;

    batchHistoryState.isLoading = true;
    if (!append) {
        batchHistoryState.offset = 0;
        renderBatchList();
    }

    try {
        const url = `/api/batches?limit=${batchHistoryState.limit}&offset=${batchHistoryState.offset}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch batches');

        const data = await response.json();

        if (append) {
            batchHistoryState.batches = [...batchHistoryState.batches, ...data.batches];
        } else {
            batchHistoryState.batches = data.batches;
        }

        batchHistoryState.hasMore = batchHistoryState.batches.length < data.total;
        batchHistoryState.offset = batchHistoryState.batches.length;

        // Track current running batch
        const runningBatch = batchHistoryState.batches.find(b => b.status === 'running');
        if (runningBatch) {
            batchHistoryState.currentBatchId = runningBatch.id;
        }

        renderBatchList();
    } catch (e) {
        console.error('Failed to fetch batches:', e);
        if (!append) {
            const container = document.getElementById('batchSidebarContent');
            if (container) {
                container.innerHTML = '<div class="batch-sidebar__empty">Failed to load batches</div>';
            }
        }
    } finally {
        batchHistoryState.isLoading = false;
    }
}

/**
 * Load more batches (pagination)
 */
function loadMoreBatches() {
    if (batchHistoryState.hasMore && !batchHistoryState.isLoading) {
        fetchBatches(true);
    }
}

/**
 * Select a batch to view
 * @param {number} batchId - Batch ID to select
 */
async function selectBatch(batchId) {
    // If selecting current running batch, show live view
    if (batchId === batchHistoryState.currentBatchId) {
        returnToLiveView();
        return;
    }

    batchHistoryState.selectedBatchId = batchId;
    batchHistoryState.viewingPastBatch = true;

    // Update sidebar selection
    document.querySelectorAll('.batch-sidebar__item').forEach(el => {
        el.classList.toggle('batch-sidebar__item--selected',
            parseInt(el.dataset.batchId) === batchId);
    });

    // Fetch and display batch details
    try {
        const response = await fetch(`/api/batches/${batchId}`);
        if (!response.ok) throw new Error('Failed to fetch batch');

        const data = await response.json();
        renderPastBatchView(data);
    } catch (e) {
        console.error('Failed to fetch batch details:', e);
        showToast('Failed to load batch details', 'error');
    }
}

/**
 * Render past batch view
 * @param {Object} data - Batch data with batch, stories, stats
 */
function renderPastBatchView(data) {
    const { batch, stories, stats } = data;

    // Create past batch view content
    const pastBatchHtml = `
        <div class="past-batch-header">
            <button class="past-batch-header__back" onclick="returnToLiveView()">
                &larr; Back to Live
            </button>
            <div class="past-batch-header__info">
                <div class="past-batch-header__title">Batch #${batch.id}</div>
                <div class="past-batch-header__meta">
                    ${formatBatchTime(batch.started_at)} -
                    ${batch.ended_at ? formatBatchTime(batch.ended_at) : 'In Progress'}
                </div>
            </div>
            <span class="past-batch-header__status past-batch-header__status--${batch.status}">
                ${escapeHtml(batch.status)}
            </span>
        </div>

        <div class="batch-summary-stats">
            <div class="batch-summary-stat">
                <div class="batch-summary-stat__value">${stats.story_count}</div>
                <div class="batch-summary-stat__label">Stories</div>
            </div>
            <div class="batch-summary-stat">
                <div class="batch-summary-stat__value">${stats.cycles_completed}/${stats.max_cycles}</div>
                <div class="batch-summary-stat__label">Cycles</div>
            </div>
            <div class="batch-summary-stat">
                <div class="batch-summary-stat__value">${stats.stories_done}/${stats.story_count}</div>
                <div class="batch-summary-stat__label">Completed</div>
            </div>
            <div class="batch-summary-stat">
                <div class="batch-summary-stat__value">${stats.duration_seconds ? formatDuration(stats.duration_seconds) : '-'}</div>
                <div class="batch-summary-stat__label">Duration</div>
            </div>
        </div>

        <div class="past-batch-stories">
            <div class="past-batch-stories__header">Stories in this Batch</div>
            ${stories.map(story => `
                <div class="past-batch-story">
                    <span class="past-batch-story__key">${escapeHtml(story.story_key)}</span>
                    <span class="past-batch-story__epic">${escapeHtml(story.epic_id)}</span>
                    <span class="past-batch-story__status">
                        <span class="status-badge status-${normalizeStatusForClass(story.status)}">${escapeHtml(story.status)}</span>
                    </span>
                    <span class="past-batch-story__duration">
                        ${story.duration_seconds ? formatDuration(story.duration_seconds) : '-'}
                    </span>
                    <span class="past-batch-story__commands">${story.command_count} commands</span>
                </div>
            `).join('')}
            ${stories.length === 0 ? '<div class="past-batch-story">No stories in this batch</div>' : ''}
        </div>
    `;

    // Insert past batch view, hide normal dashboard content
    const dashboardContent = document.getElementById('dashboardContent');
    if (!dashboardContent) return;

    // Store original content if not already stored
    if (!dashboardContent.dataset.originalHtml) {
        dashboardContent.dataset.originalHtml = dashboardContent.innerHTML;
    }

    dashboardContent.innerHTML = pastBatchHtml;
}

/**
 * Return to live view from past batch view
 */
function returnToLiveView() {
    batchHistoryState.selectedBatchId = null;
    batchHistoryState.viewingPastBatch = false;

    // Update sidebar selection
    document.querySelectorAll('.batch-sidebar__item').forEach(el => {
        el.classList.remove('batch-sidebar__item--selected');
    });

    // Restore original dashboard content
    const dashboardContent = document.getElementById('dashboardContent');
    if (dashboardContent && dashboardContent.dataset.originalHtml) {
        dashboardContent.innerHTML = dashboardContent.dataset.originalHtml;
        delete dashboardContent.dataset.originalHtml;

        // Re-render current data
        if (state.sprintData) {
            renderSummaryCards(state.sprintData);
            renderEpicBoard(state.sprintData);
            renderStoryTable(state.sprintData,
                document.getElementById('epicFilter')?.value || 'all',
                document.getElementById('statusFilter')?.value || 'all');
            restoreExpandedEpics();
        }
        if (state.orchestratorData) {
            renderActivityLog(state.orchestratorData);
            restoreExpandedActivities();
        }
        updateTabCounts(state.sprintData, state.orchestratorData);
    }
}

/**
 * Initialize batch history sidebar
 */
function initBatchHistory() {
    // Restore sidebar collapsed state
    const savedCollapsed = storageGet(UI_STATE_KEYS.BATCH_SIDEBAR_COLLAPSED);
    if (savedCollapsed === 'true') {
        batchHistoryState.sidebarCollapsed = true;
        const sidebar = document.getElementById('batchSidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }

    // Attach event listeners
    const loadMoreBtn = document.getElementById('loadMoreBatches');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreBatches);
    }

    const toggleBtn = document.querySelector('.batch-sidebar__toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleBatchSidebar);
    }

    // Fetch initial batch list
    fetchBatches();

    // Refresh batch list periodically
    setInterval(() => {
        if (!batchHistoryState.viewingPastBatch) {
            fetchBatches();
        }
    }, 30000); // Every 30 seconds
}
