/**
 * stories.js - Story and Epic rendering functionality
 * Dependencies: utils.js
 * Accesses: state from main.js
 */

// ============================================================
// Story Descriptions Cache
// ============================================================

let storyDescriptions = {};

// ============================================================
// Epic Board Rendering
// ============================================================

/**
 * Render the epic board (kanban columns)
 * @param {Object} data - Sprint data
 */
function renderEpicBoard(data) {
    if (!data || !data.epics) return;

    const backlogCol = document.getElementById('epicsBacklog');
    const inProgressCol = document.getElementById('epicsInProgressCol');
    const doneCol = document.getElementById('epicsDone');

    if (!backlogCol || !inProgressCol || !doneCol) return;

    backlogCol.innerHTML = '';
    inProgressCol.innerHTML = '';
    doneCol.innerHTML = '';

    // Sort epics by ID
    const sortedEpics = Object.entries(data.epics).sort((a, b) =>
        a[0].localeCompare(b[0], undefined, { numeric: true })
    );

    for (const [epicId, epic] of sortedEpics) {
        const stories = data.stories.filter(s => s.epic === epicId);
        const doneCount = stories.filter(s =>
            s.status?.toLowerCase() === 'done'
        ).length;
        const totalStories = stories.length;
        const progress = totalStories > 0 ? (doneCount / totalStories) * 100 : 0;

        // Calculate epic duration
        let epicDuration = 0;
        stories.forEach(story => {
            if (story.totalDuration) {
                epicDuration += story.totalDuration;
            }
        });
        const durationStr = epicDuration > 0 ? formatDuration(epicDuration) : '';

        // Determine epic status
        let epicStatus = 'backlog';
        if (progress >= 100) {
            epicStatus = 'done';
        } else if (stories.some(s =>
            ['in-progress', 'review', 'ready-for-dev'].includes(s.status?.toLowerCase().replace(/_/g, '-'))
        )) {
            epicStatus = 'in-progress';
        }

        // Build story list HTML
        const storyListHtml = stories.map(story => {
            const status = normalizeStatusForClass(story.status);
            const storyId = story.storyId || story.id || '';
            return `
                <div class="epic-story-item"
                     data-story-id="${escapeHtml(storyId)}"
                     onmouseenter="showStoryTooltip(event, '${escapeJsString(storyId)}')"
                     onmouseleave="hideStoryTooltip()">
                    <span class="story-name">${escapeHtml(story.name || storyId)}</span>
                    <span class="badge badge-${status}">${escapeHtml(story.status || 'backlog')}</span>
                </div>
            `;
        }).join('');

        const epicCard = `
            <div class="epic-card" data-epic-id="${escapeHtml(epicId)}" onclick="toggleEpicCard('${escapeJsString(epicId)}')">
                <div class="epic-card-header">
                    <div class="epic-card-title">${escapeHtml(epic.title || epicId)}</div>
                    <span class="epic-expand-icon">&#9654;</span>
                </div>
                <div class="epic-card-meta">
                    <span class="epic-card-progress">${doneCount}/${totalStories} stories</span>
                    ${durationStr ? `<span class="epic-card-duration">${escapeHtml(durationStr)}</span>` : ''}
                </div>
                <div class="epic-card-progress-bar">
                    <div class="epic-card-progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="epic-stories-list" style="display: none;">
                    ${storyListHtml}
                </div>
            </div>
        `;

        if (epicStatus === 'done') {
            doneCol.innerHTML += epicCard;
        } else if (epicStatus === 'in-progress') {
            inProgressCol.innerHTML += epicCard;
        } else {
            backlogCol.innerHTML += epicCard;
        }
    }
}

/**
 * Toggle epic card expansion
 * @param {string} epicId - Epic ID to toggle
 */
function toggleEpicCard(epicId) {
    const card = document.querySelector(`.epic-card[data-epic-id="${CSS.escape(epicId)}"]`);
    if (!card) return;

    card.classList.toggle('expanded');

    const storiesList = card.querySelector('.epic-stories-list');
    if (storiesList) {
        storiesList.style.display = card.classList.contains('expanded') ? 'block' : 'none';
    }

    // Save UI state
    saveUIState();
}

/**
 * Restore expanded epics from localStorage
 */
function restoreExpandedEpics() {
    try {
        const expandedIds = storageGetJSON(UI_STATE_KEYS.EXPANDED_EPICS, []);
        expandedIds.forEach(epicId => {
            const card = document.querySelector(`.epic-card[data-epic-id="${CSS.escape(epicId)}"]`);
            if (card && !card.classList.contains('expanded')) {
                toggleEpicCard(epicId);
            }
        });
    } catch (e) {
        console.warn('Failed to restore expanded epics:', e);
    }
}

// ============================================================
// Story Table Rendering
// ============================================================

/**
 * Render story table with filters
 * @param {Object} data - Sprint data
 * @param {string} epicFilter - Epic filter value
 * @param {string} statusFilter - Status filter value
 */
function renderStoryTable(data, epicFilter = 'all', statusFilter = 'all') {
    const tbody = document.getElementById('storyTableBody');
    if (!tbody || !data || !data.stories) return;

    // Filter stories
    let stories = data.stories;

    if (epicFilter !== 'all') {
        stories = stories.filter(s => s.epic === epicFilter);
    }

    if (statusFilter !== 'all') {
        stories = stories.filter(s =>
            normalizeStatusForClass(s.status) === statusFilter
        );
    }

    if (stories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No stories match the current filters</td></tr>';
        return;
    }

    // Sort by epic then story ID
    stories.sort((a, b) => {
        const epicCompare = (a.epic || '').localeCompare(b.epic || '', undefined, { numeric: true });
        if (epicCompare !== 0) return epicCompare;
        return (a.storyId || a.id || '').localeCompare(b.storyId || b.id || '', undefined, { numeric: true });
    });

    tbody.innerHTML = stories.map(story => {
        const storyId = story.storyId || story.id || '';
        const status = normalizeStatusForClass(story.status);
        const duration = story.totalDuration ? formatDuration(story.totalDuration) : '-';

        return `
            <tr>
                <td class="story-id">${escapeHtml(storyId)}</td>
                <td>${escapeHtml(story.name || '-')}</td>
                <td>${escapeHtml(story.epic || '-')}</td>
                <td class="story-duration">${escapeHtml(duration)}</td>
                <td><span class="badge badge-${status}">${escapeHtml(story.status || 'backlog')}</span></td>
            </tr>
        `;
    }).join('');
}

/**
 * Update epic filter dropdown
 * @param {Object} data - Sprint data
 */
function updateEpicFilter(data) {
    const select = document.getElementById('epicFilter');
    if (!select || !data || !data.epics) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Epics</option>';

    const sortedEpics = Object.keys(data.epics).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
    );

    sortedEpics.forEach(epicId => {
        const epic = data.epics[epicId];
        const option = document.createElement('option');
        option.value = epicId;
        option.textContent = epic.title || epicId;
        select.appendChild(option);
    });

    // Restore previous selection if still valid
    if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
        select.value = currentValue;
    }
}

// ============================================================
// Summary Cards Rendering
// ============================================================

/**
 * Render summary cards
 * @param {Object} data - Sprint data
 */
function renderSummaryCards(data) {
    if (!data) return;

    // Total epics
    const totalEpicsEl = document.getElementById('totalEpics');
    if (totalEpicsEl) {
        totalEpicsEl.textContent = data.epics ? Object.keys(data.epics).length : 0;
    }

    // Epics in progress
    const epicsInProgressEl = document.getElementById('epicsInProgress');
    if (epicsInProgressEl && data.epics && data.stories) {
        let inProgressCount = 0;
        for (const epicId in data.epics) {
            const stories = data.stories.filter(s => s.epic === epicId);
            const hasInProgress = stories.some(s =>
                ['in-progress', 'review', 'ready-for-dev'].includes(
                    normalizeStatusForClass(s.status)
                )
            );
            if (hasInProgress) inProgressCount++;
        }
        epicsInProgressEl.textContent = inProgressCount;
    }

    // Stories progress
    const storiesProgressEl = document.getElementById('storiesProgress');
    const storiesPercentEl = document.getElementById('storiesPercent');
    if (storiesProgressEl && storiesPercentEl && data.stories) {
        const total = data.stories.length;
        const done = data.stories.filter(s =>
            normalizeStatusForClass(s.status) === 'done'
        ).length;
        storiesProgressEl.textContent = `${done}/${total}`;
        storiesPercentEl.textContent = total > 0 ? `${Math.round((done / total) * 100)}%` : '0%';
    }

    // Current story
    const currentStoryEl = document.getElementById('currentStory');
    const currentStoryStatusEl = document.getElementById('currentStoryStatus');
    if (currentStoryEl && currentStoryStatusEl && data.stories) {
        const inProgress = data.stories.find(s =>
            normalizeStatusForClass(s.status) === 'in-progress'
        );
        if (inProgress) {
            currentStoryEl.textContent = inProgress.storyId || inProgress.id || '-';
            currentStoryStatusEl.textContent = inProgress.name || '-';
        } else {
            currentStoryEl.textContent = '-';
            currentStoryStatusEl.textContent = '-';
        }
    }
}

// ============================================================
// Activity Log Rendering
// ============================================================

/**
 * Render activity log
 * @param {Object} data - Orchestrator data
 */
function renderActivityLog(data) {
    const activityLog = document.getElementById('activityLog');
    if (!activityLog) return;

    if (!data || !data.stories || data.stories.length === 0) {
        activityLog.innerHTML = '<div class="empty-state">No activity loaded</div>';
        return;
    }

    // Sort stories by most recent activity
    const sortedStories = [...data.stories].sort((a, b) => {
        const aTime = a.lastActivityTime || 0;
        const bTime = b.lastActivityTime || 0;
        return bTime - aTime;
    });

    activityLog.innerHTML = sortedStories.map((story, idx) => {
        const storyKey = story.storyId || story.id || '';
        const status = normalizeStatusForClass(story.status);
        const duration = story.totalDuration ? formatDuration(story.totalDuration) : '';
        const isCollapsed = idx > 0; // Collapse all but first

        // Build steps/commands HTML
        let stepsHtml = '';
        if (story.commands && story.commands.length > 0) {
            stepsHtml = `
                <div class="activity-steps">
                    <table>
                        <thead>
                            <tr>
                                <th>Command</th>
                                <th>Task</th>
                                <th>Duration</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${story.commands.map(cmd => `
                                <tr>
                                    <td>${escapeHtml(cmd.command || '-')}</td>
                                    <td>${escapeHtml(cmd.taskId || '-')}</td>
                                    <td class="step-duration">${cmd.duration ? formatDuration(cmd.duration) : '-'}</td>
                                    <td class="step-result">${escapeHtml(cmd.status || '-')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        return `
            <div class="activity-item ${status} ${isCollapsed ? 'collapsed' : ''}" data-story-key="${escapeHtml(storyKey)}">
                <div class="activity-header" onclick="toggleActivityItem(this)">
                    <div class="activity-title-row">
                        <span class="activity-toggle">&#9660;</span>
                        <span class="activity-story">${escapeHtml(storyKey)}</span>
                        <span class="activity-badge">${escapeHtml(story.status || 'backlog')}</span>
                    </div>
                    <div class="activity-meta-right">
                        ${duration ? `<span class="activity-duration">${escapeHtml(duration)}</span>` : ''}
                    </div>
                </div>
                <div class="activity-body">
                    ${story.description ? `<div class="activity-description">${escapeHtml(story.description)}</div>` : ''}
                    ${stepsHtml}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Toggle activity item expansion
 * @param {HTMLElement} header - Header element clicked
 */
function toggleActivityItem(header) {
    const item = header.closest('.activity-item');
    if (item) {
        item.classList.toggle('collapsed');
        saveUIState();
    }
}

/**
 * Restore expanded activities from localStorage
 */
function restoreExpandedActivities() {
    try {
        const expandedIndices = storageGetJSON(UI_STATE_KEYS.EXPANDED_ACTIVITIES, []);
        const items = document.querySelectorAll('.activity-item');
        items.forEach((item, idx) => {
            if (idx === 0) {
                // First item expanded by default
                item.classList.remove('collapsed');
            } else if (expandedIndices.includes(idx)) {
                item.classList.remove('collapsed');
            }
        });
    } catch (e) {
        console.warn('Failed to restore expanded activities:', e);
    }
}

// ============================================================
// Tab Count Updates
// ============================================================

/**
 * Update tab counts
 * @param {Object} sprintData - Sprint data
 * @param {Object} orchestratorData - Orchestrator data
 */
function updateTabCounts(sprintData, orchestratorData) {
    // Epics count
    const epicsCount = document.getElementById('epicsCount');
    if (epicsCount && sprintData?.epics) {
        epicsCount.textContent = Object.keys(sprintData.epics).length;
    }

    // Stories count
    const storiesCount = document.getElementById('storiesCount');
    if (storiesCount && sprintData?.stories) {
        storiesCount.textContent = sprintData.stories.length;
    }

    // Activity count
    const activityCount = document.getElementById('activityCount');
    if (activityCount && orchestratorData?.stories) {
        activityCount.textContent = orchestratorData.stories.length;
    }
}

// ============================================================
// Story Tooltip
// ============================================================

/**
 * Show story tooltip
 * @param {Event} event - Mouse event
 * @param {string} storyId - Story ID
 */
function showStoryTooltip(event, storyId) {
    const tooltip = document.getElementById('storyTooltip');
    if (!tooltip) return;

    // Get story description from cache or data
    const description = storyDescriptions[storyId] || 'No description available';

    tooltip.textContent = description;
    tooltip.classList.add('visible');

    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left}px`;
    tooltip.style.top = `${rect.bottom + 5}px`;
}

/**
 * Hide story tooltip
 */
function hideStoryTooltip() {
    const tooltip = document.getElementById('storyTooltip');
    if (tooltip) {
        tooltip.classList.remove('visible');
    }
}

// ============================================================
// Story Card Component
// ============================================================

/**
 * Create a Story Card (expandable)
 * @param {Object} story - Story data
 * @param {boolean} isExpanded - Whether expanded
 * @returns {string} - HTML string
 */
function createStoryCard(story, isExpanded = false) {
    const storyKey = story.storyId || story.id || '';
    const duration = story.duration || story.totalDuration || '';
    const commands = story.commands || story.steps || [];
    const expandedClass = isExpanded ? 'story-card--expanded' : '';
    const commandsHtml = commands.map(cmd => createCommandGroup(cmd)).join('');

    return `<div class="story-card ${expandedClass}" data-story-key="${escapeHtml(storyKey)}">
        <div class="story-card__header" onclick="toggleStoryCard('${escapeJsString(storyKey)}')">
            <span class="story-card__chevron">&#9654;</span>
            <span class="story-card__key">${escapeHtml(storyKey)}</span>
            <span class="story-card__title">${escapeHtml(story.name || '')}</span>
            ${createStatusBadge(story.status || 'pending')}
            <span class="story-card__duration">${escapeHtml(duration)}</span>
        </div>
        <div class="story-card__content">
            <div class="story-card__commands">${commandsHtml}</div>
        </div>
    </div>`;
}

/**
 * Toggle story card expansion
 * @param {string} storyKey - Story key
 */
function toggleStoryCard(storyKey) {
    const card = document.querySelector(`.story-card[data-story-key="${CSS.escape(storyKey)}"]`);
    if (card) {
        card.classList.toggle('story-card--expanded');
        saveUIState();
    }
}

/**
 * Create a Command Group (expandable with tasks)
 * @param {Object} cmd - Command data
 * @param {boolean} isExpanded - Whether expanded
 * @returns {string} - HTML string
 */
function createCommandGroup(cmd, isExpanded = true) {
    const command = cmd.command || cmd.stepName || '';
    const duration = cmd.totalDuration || cmd.duration || '';
    const tasks = cmd.tasks || [];
    const expandedClass = isExpanded ? 'command-group-v2--expanded' : '';
    const tasksHtml = tasks.map(task => createTaskRow(task)).join('');

    if (tasks.length <= 1) {
        return `<div class="command-group-v2 ${expandedClass}">
            <div class="command-group-v2__header">
                ${createCommandBadge(command)}
                <span class="command-group-v2__duration">${escapeHtml(duration)}</span>
            </div>
        </div>`;
    }

    return `<div class="command-group-v2 ${expandedClass}" data-command="${escapeHtml(command)}">
        <div class="command-group-v2__header" onclick="toggleCommandGroup(this)">
            <span class="command-group-v2__chevron">&#9654;</span>
            ${createCommandBadge(command)}
            <span class="command-group-v2__duration">${escapeHtml(duration)}</span>
        </div>
        <div class="command-group-v2__tasks">${tasksHtml}</div>
    </div>`;
}

/**
 * Toggle command group expansion
 * @param {HTMLElement} headerEl - Header element
 */
function toggleCommandGroup(headerEl) {
    const group = headerEl.closest('.command-group-v2');
    if (group) group.classList.toggle('command-group-v2--expanded');
}

/**
 * Create a Task Row
 * @param {Object} task - Task data
 * @returns {string} - HTML string
 */
function createTaskRow(task) {
    const taskId = task.taskId || task.id || '';
    const duration = task.duration || '';
    const message = task.message || '';
    const status = task.status || 'pending';

    return `<div class="task-row-v2" data-task-id="${escapeHtml(taskId)}">
        <span class="task-row-v2__name">${escapeHtml(taskId)}</span>
        ${createStatusBadge(status)}
        <span class="task-row-v2__duration">${escapeHtml(duration)}</span>
        ${message ? `<span class="task-row-v2__message" title="${escapeHtml(message)}">${escapeHtml(message)}</span>` : ''}
    </div>`;
}
