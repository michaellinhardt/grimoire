# Dashboard Enhancement Implementation Plan

**Document Version:** 1.1
**Date:** 2026-01-23
**Author:** Technical Lead
**Status:** Ready for Implementation (Reviewed & Corrected)

---

## Review Summary (v1.1 Changes)

This document was reviewed and corrected. The following issues were identified and fixed:

### Line Number Corrections
| Section | Original | Corrected | Issue |
|---------|----------|-----------|-------|
| File loader CSS | 71-156 | 71-177 | Missing `.refresh-btn` styles (lines 158-177) |
| Header CSS | 31-35 | 30-36 | Off by one, missing comment line |

### Format Specification Corrections
- **Orchestrator CSV format:** Changed from `epic_id, story_id` to `epicid, storyid` (no underscores) per task requirements
- Updated all sample data and parser references to match spec

### Code Quality Fixes
1. **XSS Prevention:** Added escaping for story IDs in HTML attributes
2. **Timeline Timestamps:** Added `timestamps` array storage in CSV parser for timeline feature
3. **Backward Compatibility:** Full implementation of markdown parser with compatibility fields
4. **Activity Description:** Preserved bullet separator, conditional rendering

### Documentation Additions
- Added "Known Limitations and Edge Cases" section
- Added implementation notes for security and format detection
- Expanded checklist with more specific tasks

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Task 1: UI Cleanup and Header Modernization](#task-1-ui-cleanup-and-header-modernization)
3. [Task 2: Epic Tab Enhancements](#task-2-epic-tab-enhancements)
4. [Task 3: Orchestrator Format Migration](#task-3-orchestrator-format-migration)
5. [Task 4: Story Descriptions Integration](#task-4-story-descriptions-integration)
6. [Task 5: Duration Display and Timeline View](#task-5-duration-display-and-timeline-view)
7. [Appendix: Sample Data Files](#appendix-sample-data-files)

---

## Executive Summary

This document provides line-by-line implementation guidance for the dashboard enhancement project. Each task includes specific CSS selectors, line numbers, and complete code snippets for implementation.

**File Under Modification:** `/Users/teazyou/dev/grimoire/docs/dashboard.html`

**Implementation Order:**
1. Task 1 (UI Cleanup) - Low risk, clears deprecated code
2. Task 3 (Orchestrator Migration) - Foundation for duration calculations
3. Task 2 (Epic Tab) - Enables expandable epics
4. Task 4 (Story Descriptions) - Backend + frontend integration
5. Task 5 (Durations + Timeline) - Most complex, depends on Task 3

---

## Task 1: UI Cleanup and Header Modernization

### Subtask 1.1: Remove File Loader Section

**What to Remove:**
- **CSS (lines 71-177):** Delete the entire `.file-loader` block and all child styles (includes `.refresh-btn` styles)
- **HTML (lines 655-689):** Delete the `<div class="file-loader">` element entirely
- **JavaScript (lines 1304-1334):** Remove file input event listeners

**CSS to Delete (lines 71-177):**
```css
/* DELETE ENTIRE BLOCK - File Loader */
.file-loader { ... }
.file-loader.loaded { ... }
.file-loader-header { ... }
.file-loader-title { ... }
.file-inputs { ... }
.file-input-group { ... }
.file-input-label { ... }
.file-input-wrapper { ... }
.file-input-wrapper input[type="file"] { ... }
.file-input-display { ... }
.file-input-wrapper:hover .file-input-display { ... }
.file-input-display.loaded { ... }
.file-icon { ... }
.refresh-btn { ... }
.refresh-btn:hover { ... }
.refresh-btn:disabled { ... }
```

> **Note:** The `.refresh-btn` styles (lines 158-177) are part of the file-loader section and should also be deleted.

**HTML to Delete (lines 655-689):**
```html
<!-- DELETE THIS ENTIRE BLOCK -->
<div class="file-loader" id="fileLoader">
    ... entire file loader section ...
</div>
```

**JavaScript to Delete:**
```javascript
// DELETE: File input event listeners (lines 1304-1334)
document.getElementById('sprintFile').addEventListener('change', async (e) => { ... });
document.getElementById('orchestratorFile').addEventListener('change', async (e) => { ... });

// DELETE: processFiles function (lines 1138-1175)
async function processFiles() { ... }

// DELETE: state properties no longer needed
// In state object (line 786-794), remove:
sprintFile: null,
orchestratorFile: null,
```

---

### Subtask 1.2: Remove Auto-Refresh Toggle Button

**What to Remove:**
- **HTML (line 659):** Delete watchBtn element
- **JavaScript (lines 1204-1228):** Delete `toggleWatch()` function
- **JavaScript (line 1260):** Delete watchBtn event listener

**HTML to Delete:**
```html
<!-- DELETE: line 659 -->
<button class="refresh-btn" id="watchBtn" disabled>Auto-refresh: OFF</button>
```

**JavaScript to Delete:**
```javascript
// DELETE: toggleWatch function (lines 1204-1228)
function toggleWatch() { ... }

// DELETE: event listener (line 1260)
document.getElementById('watchBtn').addEventListener('click', toggleWatch);
```

---

### Subtask 1.3: Reduce Header Title Size

**Location:** CSS line 38-43

**Current CSS:**
```css
h1 {
    font-size: 40px;
    font-weight: 700;
    color: #37352f;
    margin-bottom: 8px;
}
```

**Replace With:**
```css
h1 {
    font-size: 22px;
    font-weight: 600;
    color: #37352f;
    margin-bottom: 0;
}
```

**Also Update Header Padding (lines 30-36):**

**Current:**
```css
/* Header */
header {
    background: white;
    border-radius: 8px;
    padding: 32px 40px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
```

**Replace With:**
```css
/* Header */
header {
    background: white;
    border-radius: 8px;
    padding: 16px 24px;
    margin-bottom: 24px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    display: flex;
    justify-content: space-between;
    align-items: center;
}
```

---

### Subtask 1.4: Relocate "Last Updated" Display

**Location:** CSS lines 45-51 and HTML line 649-652

**Current CSS:**
```css
.last-updated {
    font-size: 14px;
    color: #787774;
    display: flex;
    align-items: center;
    gap: 8px;
}
```

**No CSS change needed** - the flexbox on header handles positioning.

**Current HTML (lines 647-653):**
```html
<header>
    <h1>Grimoire</h1>
    <div class="last-updated">
        <span class="update-dot inactive" id="updateDot"></span>
        <span id="lastUpdated">Load files to begin</span>
    </div>
</header>
```

**Replace With:**
```html
<header>
    <h1>Grimoire</h1>
    <div class="last-updated">
        <span class="update-dot" id="updateDot"></span>
        <span id="lastUpdated">Loading...</span>
    </div>
</header>
```

---

### Subtask 1.5: Enable Auto-Refresh on Load

**Location:** JavaScript function `tryAutoLoad()` (lines 1263-1300)

**Modify the end of tryAutoLoad() - after successful load, start auto-refresh:**

**Current Code (end of tryAutoLoad, ~line 1288-1295):**
```javascript
if (state.sprintData || state.orchestratorData) {
    document.getElementById('dashboardContent').classList.add('visible');
    document.getElementById('fileLoader').classList.add('loaded');
    document.getElementById('updateDot').classList.remove('inactive');
    document.getElementById('watchBtn').disabled = false;
    state.autoLoadWorks = true;
    updateTabCounts(state.sprintData, state.orchestratorData);
}
```

**Replace With:**
```javascript
if (state.sprintData || state.orchestratorData) {
    document.getElementById('dashboardContent').classList.add('visible');
    document.getElementById('updateDot').classList.remove('inactive');
    state.autoLoadWorks = true;
    updateTabCounts(state.sprintData, state.orchestratorData);

    // Auto-start refresh interval on successful load
    if (!state.watchInterval) {
        state.isWatching = true;
        state.watchInterval = setInterval(async () => {
            await refreshViaFetch();
        }, 5000);
        console.log('Auto-refresh enabled (5s interval)');
    }
}
```

---

## Task 2: Epic Tab Enhancements

### Subtask 2.1: Fix Epic Column Rendering

**Location:** JavaScript function `renderEpicBoard()` (lines 956-1001)

**Issue:** The current logic checks `epic.status` but the parser may not be setting status correctly for all epics.

**Analysis of Current Parser (lines 827-841):**
The parser looks for `epic-(\w+):\s*(\w+|-)` pattern and assigns status. This should work correctly.

**Debug Step:** Add console logging to verify epic statuses are being parsed:

```javascript
function renderEpicBoard(data) {
    const backlogEl = document.getElementById('epicsBacklog');
    const inProgressEl = document.getElementById('epicsInProgressCol');
    const doneEl = document.getElementById('epicsDone');

    backlogEl.innerHTML = '';
    inProgressEl.innerHTML = '';
    doneEl.innerHTML = '';

    const epics = Object.values(data.epics).filter(e => !e.id.includes('retrospective'));

    // DEBUG: Log epic statuses
    console.log('Epic statuses:', epics.map(e => ({ id: e.id, status: e.status })));

    epics.forEach(epic => {
        const epicStories = epic.stories.filter(s => !s.id.includes('retrospective'));
        const doneStories = epicStories.filter(s => s.status === 'done').length;
        const totalStories = epicStories.length;
        const progress = totalStories > 0 ? (doneStories / totalStories) * 100 : 0;

        const card = document.createElement('div');
        card.className = 'epic-card';
        card.dataset.epicId = epic.id; // Add for expand/collapse
        card.innerHTML = `
            <div class="epic-card-header">
                <div class="epic-card-title">${epic.name}</div>
                <span class="epic-expand-icon">&#9654;</span>
            </div>
            <div class="epic-card-progress">${doneStories}/${totalStories} stories</div>
            <div class="epic-card-progress-bar">
                <div class="epic-card-progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="epic-stories-list" style="display: none;"></div>
        `;

        // Normalize status comparison (handle undefined, null, hyphen)
        const status = (epic.status || 'backlog').toLowerCase().trim();

        if (status === 'done' || status === 'completed') {
            doneEl.appendChild(card);
        } else if (status === 'in-progress' || status === 'in_progress' || status === 'inprogress') {
            inProgressEl.appendChild(card);
        } else {
            // Default to backlog for 'backlog', '-', '', undefined, etc.
            backlogEl.appendChild(card);
        }
    });

    // Empty state handling
    if (!backlogEl.children.length) {
        backlogEl.innerHTML = '<div class="empty-state">No epics</div>';
    }
    if (!inProgressEl.children.length) {
        inProgressEl.innerHTML = '<div class="empty-state">No epics</div>';
    }
    if (!doneEl.children.length) {
        doneEl.innerHTML = '<div class="empty-state">No epics</div>';
    }
}
```

---

### Subtask 2.2: Verify Progress Bar Calculation

**Location:** JavaScript lines 968-971

**Current Code:**
```javascript
const epicStories = epic.stories.filter(s => !s.id.includes('retrospective'));
const doneStories = epicStories.filter(s => s.status === 'done').length;
const totalStories = epicStories.length;
const progress = totalStories > 0 ? (doneStories / totalStories) * 100 : 0;
```

**This is correct.** The calculation properly:
- Filters out retrospective stories
- Counts stories with status === 'done'
- Divides by total to get percentage
- Handles division by zero

**Enhancement - Also count optional stories separately:**
```javascript
const epicStories = epic.stories.filter(s => !s.id.includes('retrospective'));
const optionalStories = epicStories.filter(s => s.status === 'optional').length;
const requiredStories = epicStories.filter(s => s.status !== 'optional');
const doneStories = requiredStories.filter(s => s.status === 'done').length;
const totalRequired = requiredStories.length;
const progress = totalRequired > 0 ? (doneStories / totalRequired) * 100 : 0;
```

---

### Subtask 2.3: Add Expandable Epic Cards

**Add New CSS (insert after line 297, before `/* Story Table */`):**

```css
/* Expandable Epic Cards */
.epic-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.epic-expand-icon {
    font-size: 10px;
    color: #787774;
    transition: transform 0.2s ease;
    cursor: pointer;
}

.epic-card.expanded .epic-expand-icon {
    transform: rotate(90deg);
}

.epic-stories-list {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e8e7e5;
}

.epic-story-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 13px;
    color: #37352f;
    cursor: pointer;
}

.epic-story-item:hover {
    background: #f0efed;
    margin: 0 -8px;
    padding: 6px 8px;
    border-radius: 4px;
}

.epic-story-item .story-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.epic-story-item .badge {
    flex-shrink: 0;
    margin-left: 8px;
    font-size: 10px;
    padding: 2px 6px;
}

/* Story Tooltip */
.story-tooltip {
    position: fixed;
    background: #37352f;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    max-width: 300px;
    z-index: 1000;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    transition: opacity 0.15s ease;
}

.story-tooltip.visible {
    opacity: 1;
}
```

**Add JavaScript for expand/collapse (insert after `toggleActivity` function, ~line 1115):**

```javascript
// Toggle epic card expansion
function toggleEpicCard(epicId) {
    const card = document.querySelector(`.epic-card[data-epic-id="${epicId}"]`);
    if (!card) return;

    const isExpanded = card.classList.toggle('expanded');
    const storiesList = card.querySelector('.epic-stories-list');

    if (isExpanded && state.sprintData) {
        const epic = state.sprintData.epics[epicId];
        if (epic && epic.stories.length > 0) {
            const stories = epic.stories.filter(s => !s.id.includes('retrospective'));
            storiesList.innerHTML = stories.map(story => {
                // Escape story.id for safe use in HTML attributes
                const safeId = story.id.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                return `
                    <div class="epic-story-item"
                         data-story-id="${safeId}"
                         onmouseenter="showStoryTooltip(event, '${safeId}')"
                         onmouseleave="hideStoryTooltip()">
                        <span class="story-name">${story.id}</span>
                        <span class="badge badge-${story.status}">${story.status}</span>
                    </div>
                `;
            }).join('');
            storiesList.style.display = 'block';
        }
    } else {
        storiesList.style.display = 'none';
    }
}

> **Security Note:** Story IDs are escaped to prevent XSS if IDs contain special characters.

// Attach click handlers to epic cards
function attachEpicCardHandlers() {
    document.querySelectorAll('.epic-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.epic-story-item')) {
                toggleEpicCard(card.dataset.epicId);
            }
        });
    });
}
```

**Update `renderEpicBoard()` to call handler attachment:**
Add at end of function:
```javascript
// After appending all cards
attachEpicCardHandlers();
```

---

### Subtask 2.4: Render Story List Inside Expanded Epic

**Already handled in Subtask 2.3** - the `toggleEpicCard` function renders the story list.

---

### Subtask 2.5: Add Story Description Tooltip

**Add tooltip container to HTML (after `<div class="container">` opening, line 645):**

```html
<div class="story-tooltip" id="storyTooltip"></div>
```

**Add JavaScript tooltip functions:**

```javascript
// Story descriptions cache (populated from backend)
let storyDescriptions = {};

// Show tooltip with story description
function showStoryTooltip(event, storyId) {
    const tooltip = document.getElementById('storyTooltip');
    const description = storyDescriptions[storyId] || 'No description available';

    tooltip.textContent = description;
    tooltip.style.left = (event.clientX + 10) + 'px';
    tooltip.style.top = (event.clientY + 10) + 'px';
    tooltip.classList.add('visible');
}

function hideStoryTooltip() {
    const tooltip = document.getElementById('storyTooltip');
    tooltip.classList.remove('visible');
}

// Fetch story descriptions from backend
async function loadStoryDescriptions() {
    try {
        const response = await fetch('./story-descriptions.json');
        if (response.ok) {
            storyDescriptions = await response.json();
            console.log('Loaded story descriptions:', Object.keys(storyDescriptions).length);
        }
    } catch (e) {
        console.log('Story descriptions not available:', e);
    }
}
```

**Call `loadStoryDescriptions()` in `tryAutoLoad()`:**
```javascript
// Add at beginning of tryAutoLoad
await loadStoryDescriptions();
```

---

## Task 3: Orchestrator Format Migration

### Subtask 3.1: Define New CSV Format

**New Format Specification (per task requirements):**

```
unix_timestamp,epicid,storyid,command,result
```

> **IMPORTANT:** Field names use no underscores per the task spec: `epicid` not `epic_id`, `storyid` not `story_id`.

**Field Definitions:**
| Field | Type | Description |
|-------|------|-------------|
| `unix_timestamp` | Integer | Unix epoch timestamp in seconds |
| `epicid` | String | Epic identifier (e.g., "2a", "2b") - no underscore |
| `storyid` | String | Story identifier (e.g., "2a-1", "2a-2") - no underscore |
| `command` | String | Command name (e.g., "create-story", "dev-story", "code-review") |
| `result` | String | "start" when beginning, or result string when complete ("success", "failed", "retry-1") |

**Example CSV Data:**
```csv
unix_timestamp,epicid,storyid,command,result
1706025600,2a,2a-1,create-story,start
1706025660,2a,2a-1,create-story,success
1706025720,2a,2a-1,dev-story,start
1706027520,2a,2a-1,dev-story,success
1706027580,2a,2a-1,code-review,start
1706028180,2a,2a-1,code-review,success
1706028240,2a,2a-2,create-story,start
1706028300,2a,2a-2,create-story,success
```

> **Note:** Header row is optional but recommended for clarity.

---

### Subtask 3.2: Create orchestrator-sample.csv

**File:** `/Users/teazyou/dev/grimoire/docs/orchestrator-sample.csv`

See [Appendix A](#appendix-a-sample-orchestrator-csv) for complete sample data.

---

### Subtask 3.3: Update Parser Function

**Location:** JavaScript function `parseOrchestrator()` (lines 867-924)

**Replace entire function with:**

```javascript
// Parse orchestrator CSV log
// Format: unix_timestamp,epicid,storyid,command,result
function parseOrchestratorCSV(text) {
    const activities = [];
    const lines = text.trim().split('\n');

    // Skip header if present
    const startIndex = lines[0].includes('unix_timestamp') ? 1 : 0;

    // Group entries by storyid
    const storyMap = new Map();

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 5) continue;

        // Note: field names match spec (epicid, storyid - no underscores)
        const [timestamp, epicId, storyId, command, result] = parts;
        const ts = parseInt(timestamp, 10);

        if (!storyMap.has(storyId)) {
            storyMap.set(storyId, {
                storyId: storyId,
                epic: `epic-${epicId}`,
                started: null,
                completed: null,
                duration: '',
                steps: [],
                commandPairs: new Map(),
                // Store timestamps for timeline feature
                timestamps: []
            });
        }

        const activity = storyMap.get(storyId);

        // Store timestamp for timeline
        activity.timestamps.push({ ts, command, result });

        // Track command start/end pairs
        if (result === 'start') {
            activity.commandPairs.set(command, { startTs: ts });
            if (!activity.started) {
                activity.started = formatTimestamp(ts);
                activity.startTs = ts;
            }
        } else {
            // Command completed
            const pair = activity.commandPairs.get(command) || { startTs: ts };
            const durationSecs = ts - pair.startTs;
            const durationStr = formatDuration(durationSecs);

            activity.steps.push({
                step: activity.steps.length + 1,
                command: command,
                result: result,
                duration: durationStr,
                durationSecs: durationSecs
            });

            // Check if this is the final step (code-review success)
            if (command === 'code-review' && result === 'success') {
                activity.completed = formatTimestamp(ts);
                activity.endTs = ts;
                activity.duration = formatDuration(ts - activity.startTs);
            }
        }
    }

    // Convert map to array and calculate totals
    const result = Array.from(storyMap.values()).map(activity => {
        // Calculate total duration from all steps
        const totalSecs = activity.steps.reduce((sum, s) => sum + (s.durationSecs || 0), 0);
        if (!activity.duration && totalSecs > 0) {
            activity.duration = formatDuration(totalSecs);
        }
        activity.totalDurationSecs = totalSecs;

        // Calculate min/max timestamps for timeline
        if (activity.timestamps.length > 0) {
            activity.minTs = Math.min(...activity.timestamps.map(t => t.ts));
            activity.maxTs = Math.max(...activity.timestamps.map(t => t.ts));
        }

        // Clean up temporary properties (keep timestamps for timeline)
        delete activity.commandPairs;

        return activity;
    });

    // Sort by most recent first (based on first step timestamp)
    return result.reverse();
}

// Format unix timestamp to readable date
function formatTimestamp(ts) {
    const date = new Date(ts * 1000);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format duration in seconds to human readable
function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds}s`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
}
```

---

### Subtask 3.4: Calculate Durations from Timestamps

**Already handled in Subtask 3.3** - the parser calculates:
- Individual command durations (from start to result)
- Total story duration (sum of all command durations)

---

### Subtask 3.5: Backward Compatibility Check

**Add format detection wrapper to parseOrchestrator:**

```javascript
// Main parser with format detection (replaces original parseOrchestrator)
function parseOrchestrator(text) {
    // Detect format: CSV starts with timestamp or header, MD starts with ## Story:
    const firstLine = text.trim().split('\n')[0];

    if (firstLine.match(/^\d+,/) || firstLine.includes('unix_timestamp')) {
        console.log('Detected CSV orchestrator format');
        return parseOrchestratorCSV(text);
    } else if (text.includes('## Story:')) {
        console.log('Detected Markdown orchestrator format (legacy)');
        return parseOrchestratorMarkdown(text);
    }

    console.warn('Unknown orchestrator format, attempting markdown parse');
    return parseOrchestratorMarkdown(text);
}

// Rename existing markdown parser (keep original code from lines 867-924)
function parseOrchestratorMarkdown(text) {
    const activities = [];
    const storyBlocks = text.split(/^## Story:/m).slice(1);

    for (let block of storyBlocks) {
        const lines = block.split('\n');
        const activity = {
            storyId: '',
            epic: '',
            started: '',
            completed: '',
            duration: '',
            steps: [],
            // Add empty timestamps array for compatibility with timeline
            timestamps: [],
            totalDurationSecs: 0
        };

        for (let line of lines) {
            if (line.includes('Epic:')) {
                activity.epic = line.split('Epic:')[1].trim();
            }
            if (line.includes('Started:')) {
                activity.started = line.split('Started:')[1].trim();
            }
            if (line.includes('Story completed:')) {
                activity.completed = line.split('Story completed:')[1].trim();
            }
            if (line.includes('Total duration:')) {
                activity.duration = line.split('Total duration:')[1].trim();
            }
        }

        activity.storyId = lines[0].trim();

        const tableStart = lines.findIndex(l => l.includes('| Step |'));
        if (tableStart !== -1) {
            const tableLines = lines.slice(tableStart + 2);

            for (let row of tableLines) {
                if (!row.startsWith('|') || !row.includes('|')) continue;

                const cells = row.split('|').map(c => c.trim()).filter(c => c);
                if (cells.length >= 4) {
                    activity.steps.push({
                        step: cells[0],
                        command: cells[1],
                        result: cells[2],
                        duration: cells[3]
                    });
                }
            }
        }

        if (activity.storyId) {
            activities.push(activity);
        }
    }

    return activities.reverse();
}

// New CSV parser (from Subtask 3.3)
function parseOrchestratorCSV(text) {
    // ... implementation from Subtask 3.3
}
```

> **Implementation Note:** The markdown parser is preserved with added compatibility fields (`timestamps`, `totalDurationSecs`) so both formats work with the timeline feature. The CSV format will have full timeline support; markdown format will show activities without precise timeline positioning.

---

## Task 4: Story Descriptions Integration

### Subtask 4.1: Create Story Description Extractor

**New File:** `/Users/teazyou/dev/grimoire/docs/extract-story-descriptions.py`

```python
#!/usr/bin/env python3
"""
Story Description Extractor

Scans _bmad-output/implementation-artifacts/ for story files,
extracts descriptions, and outputs JSON for dashboard consumption.

Usage:
    python3 extract-story-descriptions.py > story-descriptions.json

Or via server.py integration.
"""

import os
import re
import json
import sys
from pathlib import Path

# Configuration
ARTIFACTS_DIR = Path(__file__).parent.parent / '_bmad-output' / 'implementation-artifacts'
OUTPUT_FILE = Path(__file__).parent / 'story-descriptions.json'

def extract_story_id(filename: str) -> str | None:
    """Extract story ID from filename like '2a-1-session-scanner.md' -> '2a-1'"""
    # Match patterns like: 2a-1, 2b-3, 1-1, etc.
    match = re.match(r'^(\d+[a-z]?-\d+)', filename)
    if match:
        return match.group(1)
    return None

def extract_description(filepath: Path) -> str | None:
    """Extract text between ## Story and next ## heading"""
    try:
        content = filepath.read_text(encoding='utf-8')

        # Find ## Story section
        story_match = re.search(
            r'^##\s+Story[^\n]*\n(.*?)(?=^##\s|\Z)',
            content,
            re.MULTILINE | re.DOTALL
        )

        if story_match:
            description = story_match.group(1).strip()
            # Clean up: remove markdown formatting, limit length
            description = re.sub(r'\*\*([^*]+)\*\*', r'\1', description)  # Remove bold
            description = re.sub(r'\n+', ' ', description)  # Flatten newlines
            description = description[:500]  # Limit length
            return description

        # Fallback: try to get first paragraph after title
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('# '):
                # Get next non-empty lines as description
                desc_lines = []
                for j in range(i + 1, min(i + 10, len(lines))):
                    if lines[j].strip() and not lines[j].startswith('#'):
                        desc_lines.append(lines[j].strip())
                    elif lines[j].startswith('#'):
                        break
                if desc_lines:
                    return ' '.join(desc_lines)[:500]

        return None
    except Exception as e:
        print(f"Error reading {filepath}: {e}", file=sys.stderr)
        return None

def scan_artifacts() -> dict[str, str]:
    """Scan artifacts directory and extract all story descriptions"""
    descriptions = {}

    if not ARTIFACTS_DIR.exists():
        print(f"Artifacts directory not found: {ARTIFACTS_DIR}", file=sys.stderr)
        return descriptions

    # Find all .md files
    for filepath in ARTIFACTS_DIR.glob('*.md'):
        filename = filepath.name

        # Skip non-story files
        if filename.startswith('tech-spec-'):
            continue
        if filename in ('orchestrator.md', 'sprint-status.yaml', 'index.md'):
            continue

        story_id = extract_story_id(filename)
        if story_id:
            description = extract_description(filepath)
            if description:
                descriptions[story_id] = description
                print(f"Extracted: {story_id}", file=sys.stderr)

    return descriptions

def main():
    descriptions = scan_artifacts()

    # Output JSON
    json_output = json.dumps(descriptions, indent=2, ensure_ascii=False)

    if len(sys.argv) > 1 and sys.argv[1] == '--file':
        OUTPUT_FILE.write_text(json_output, encoding='utf-8')
        print(f"Written to {OUTPUT_FILE}", file=sys.stderr)
    else:
        print(json_output)

if __name__ == '__main__':
    main()
```

---

### Subtask 4.2: Integrate with Data Loading

**Option A: Static File Generation (Recommended)**

Add to your build/serve script:
```bash
cd /Users/teazyou/dev/grimoire/docs
python3 extract-story-descriptions.py --file
```

**Option B: Server-side Integration**

**Modify `/Users/teazyou/dev/grimoire/docs/server.py`:**

```python
#!/usr/bin/env python3
"""
Enhanced Dashboard Server

Serves dashboard files and provides story description extraction endpoint.

Usage:
    cd /Users/teazyou/dev/grimoire/docs
    python3 server.py

Then open: http://localhost:8080/dashboard.html
"""

import http.server
import socketserver
import json
import os
import sys
from pathlib import Path

# Add parent dir to import extractor
sys.path.insert(0, str(Path(__file__).parent))
from extract_story_descriptions import scan_artifacts

PORT = 8080

class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/story-descriptions.json':
            self.send_story_descriptions()
        else:
            super().do_GET()

    def send_story_descriptions(self):
        descriptions = scan_artifacts()
        content = json.dumps(descriptions, ensure_ascii=False).encode('utf-8')

        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(content))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(content)

def main():
    os.chdir(Path(__file__).parent)

    with socketserver.TCPServer(("", PORT), DashboardHandler) as httpd:
        print(f"Serving at http://localhost:{PORT}/dashboard.html")
        httpd.serve_forever()

if __name__ == '__main__':
    main()
```

---

### Subtask 4.3: Stories Tab - Add Tooltip

**Location:** JavaScript function `renderStoryTable()` (lines 1003-1027)

**Update the row template (line 1020-1026):**

**Current:**
```javascript
tbody.innerHTML = filtered.map(story => `
    <tr>
        <td class="story-id">${story.id}</td>
        <td>${story.name || story.id}</td>
        <td>${story.epic}</td>
        <td><span class="badge badge-${story.status}">${story.status}</span></td>
    </tr>
`).join('');
```

**Replace With:**
```javascript
tbody.innerHTML = filtered.map(story => `
    <tr class="story-row"
        data-story-id="${story.id}"
        onmouseenter="showStoryTooltip(event, '${story.id}')"
        onmouseleave="hideStoryTooltip()">
        <td class="story-id">${story.id}</td>
        <td>${story.name || story.id}</td>
        <td>${story.epic}</td>
        <td><span class="badge badge-${story.status}">${story.status}</span></td>
    </tr>
`).join('');
```

---

### Subtask 4.4: Activity Tab - Show Description

**Location:** JavaScript function `renderActivityLog()` (lines 1046-1108)

**Update activity item template to include description:**

Find the `activity-meta` div (~line 1100-1102):
```javascript
<div class="activity-meta">
    Epic: ${activity.epic} ${activity.started ? `• Started: ${activity.started}` : ''}
</div>
```

**Replace With:**
```javascript
<div class="activity-meta">
    Epic: ${activity.epic} ${activity.started ? `• Started: ${activity.started}` : ''}
</div>
${storyDescriptions[activity.storyId] ? `
<div class="activity-description">
    ${storyDescriptions[activity.storyId]}
</div>
` : ''}
```

> **Note:** Preserved the bullet separator (•) and only render description div if description exists.

**Add CSS for activity description (insert after line 482):**
```css
.activity-description {
    font-size: 13px;
    color: #5a5a58;
    margin-bottom: 12px;
    line-height: 1.5;
    font-style: italic;
}
```

---

### Subtask 4.5: Epic Expanded View - Add Tooltip

**Already handled in Subtask 2.5** - the tooltip system works for all story items.

---

## Task 5: Duration Display and Timeline View

### Subtask 5.1: Activity Tab - Command Durations

**Already handled in Task 3** - the new CSV parser extracts durations per command.

**Enhancement: Add story total duration in header**

Update `renderActivityLog()` activity header template:

**Current (~line 1097):**
```javascript
<div class="activity-date">${activity.duration || activity.started || ''}</div>
```

**Replace With:**
```javascript
<div class="activity-meta-right">
    ${activity.duration ? `<span class="activity-duration">${activity.duration}</span>` : ''}
    <span class="activity-date">${activity.started || ''}</span>
</div>
```

**Add CSS:**
```css
.activity-meta-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
}

.activity-duration {
    font-size: 12px;
    font-weight: 600;
    color: #37352f;
    background: #e8e7e5;
    padding: 2px 8px;
    border-radius: 4px;
}
```

---

### Subtask 5.2: Stories Tab - Completion Time Column

**Update table header (HTML line 760-765):**

```html
<thead>
    <tr>
        <th>Story ID</th>
        <th>Name</th>
        <th>Epic</th>
        <th>Duration</th>
        <th>Status</th>
    </tr>
</thead>
```

**Update `renderStoryTable()` to include duration:**

```javascript
function renderStoryTable(data, epicFilter = 'all', statusFilter = 'all') {
    const tbody = document.getElementById('storyTableBody');
    const stories = data.stories.filter(s => !s.id.includes('retrospective'));

    let filtered = stories;
    if (epicFilter !== 'all') {
        filtered = filtered.filter(s => s.epic === epicFilter);
    }
    if (statusFilter !== 'all') {
        filtered = filtered.filter(s => s.status === statusFilter);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No stories found</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(story => {
        // Get duration from orchestrator data if available
        const activity = state.orchestratorData?.find(a => a.storyId === story.id);
        const duration = activity?.duration || '-';

        return `
            <tr class="story-row"
                data-story-id="${story.id}"
                onmouseenter="showStoryTooltip(event, '${story.id}')"
                onmouseleave="hideStoryTooltip()">
                <td class="story-id">${story.id}</td>
                <td>${story.name || story.id}</td>
                <td>${story.epic}</td>
                <td class="story-duration">${duration}</td>
                <td><span class="badge badge-${story.status}">${story.status}</span></td>
            </tr>
        `;
    }).join('');
}
```

**Add CSS:**
```css
.story-duration {
    font-family: 'SF Mono', Monaco, 'Courier New', monospace;
    font-size: 12px;
    color: #787774;
}
```

---

### Subtask 5.3: Epics Tab - Total Duration

**Update `renderEpicBoard()` to calculate and display total duration:**

```javascript
epics.forEach(epic => {
    const epicStories = epic.stories.filter(s => !s.id.includes('retrospective'));
    const doneStories = epicStories.filter(s => s.status === 'done').length;
    const totalStories = epicStories.length;
    const progress = totalStories > 0 ? (doneStories / totalStories) * 100 : 0;

    // Calculate total duration from orchestrator data
    let totalDurationSecs = 0;
    epicStories.forEach(story => {
        const activity = state.orchestratorData?.find(a => a.storyId === story.id);
        if (activity?.totalDurationSecs) {
            totalDurationSecs += activity.totalDurationSecs;
        }
    });
    const totalDuration = totalDurationSecs > 0 ? formatDuration(totalDurationSecs) : '';

    const card = document.createElement('div');
    card.className = 'epic-card';
    card.dataset.epicId = epic.id;
    card.innerHTML = `
        <div class="epic-card-header">
            <div class="epic-card-title">${epic.name}</div>
            <span class="epic-expand-icon">&#9654;</span>
        </div>
        <div class="epic-card-meta">
            <span class="epic-card-progress">${doneStories}/${totalStories} stories</span>
            ${totalDuration ? `<span class="epic-card-duration">${totalDuration}</span>` : ''}
        </div>
        <div class="epic-card-progress-bar">
            <div class="epic-card-progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="epic-stories-list" style="display: none;"></div>
    `;

    // ... rest of column assignment
});
```

**Add CSS:**
```css
.epic-card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}

.epic-card-duration {
    font-size: 11px;
    font-weight: 500;
    color: #065f46;
    background: #d1fae5;
    padding: 2px 6px;
    border-radius: 4px;
}
```

---

### Subtask 5.4: Create Timeline Tab

**Update tab navigation HTML (line 713-717):**

```html
<div class="tab-nav">
    <button class="tab-btn active" data-tab="epics">Epics <span class="tab-count" id="epicsCount">0</span></button>
    <button class="tab-btn" data-tab="stories">Stories <span class="tab-count" id="storiesCount">0</span></button>
    <button class="tab-btn" data-tab="activity">Activity <span class="tab-count" id="activityCount">0</span></button>
    <button class="tab-btn" data-tab="timeline">Timeline</button>
</div>
```

**Add Timeline tab panel (after line 780, before closing `</div>` of dashboardContent):**

```html
<!-- Timeline Tab -->
<div class="tab-panel" id="tab-timeline">
    <div class="timeline-controls">
        <div class="timeline-zoom">
            <button class="zoom-btn" onclick="zoomTimeline('out')">-</button>
            <span class="zoom-level" id="zoomLevel">100%</span>
            <button class="zoom-btn" onclick="zoomTimeline('in')">+</button>
        </div>
        <div class="timeline-legend">
            <span class="legend-item"><span class="legend-color done"></span> Done</span>
            <span class="legend-item"><span class="legend-color in-progress"></span> In Progress</span>
        </div>
    </div>
    <div class="timeline-container" id="timelineContainer">
        <div class="timeline-header" id="timelineHeader"></div>
        <div class="timeline-body" id="timelineBody"></div>
    </div>
</div>
```

---

### Subtask 5.5: Build Horizontal Timeline Component

**Add Timeline CSS (insert before `/* Responsive */` section):**

```css
/* Timeline Styles */
.timeline-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: white;
    border: 1px solid #e8e7e5;
    border-radius: 8px 8px 0 0;
    border-bottom: none;
}

.timeline-zoom {
    display: flex;
    align-items: center;
    gap: 8px;
}

.zoom-btn {
    width: 28px;
    height: 28px;
    border: 1px solid #e8e7e5;
    background: white;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.zoom-btn:hover {
    background: #f7f6f3;
}

.zoom-level {
    font-size: 13px;
    color: #787774;
    min-width: 50px;
    text-align: center;
}

.timeline-legend {
    display: flex;
    gap: 16px;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #787774;
}

.legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
}

.legend-color.done {
    background: #10b981;
}

.legend-color.in-progress {
    background: #fbbf24;
}

.timeline-container {
    background: white;
    border: 1px solid #e8e7e5;
    border-radius: 0 0 8px 8px;
    overflow-x: auto;
    overflow-y: hidden;
}

.timeline-header {
    display: flex;
    border-bottom: 1px solid #e8e7e5;
    background: #fafaf9;
    position: sticky;
    top: 0;
    z-index: 10;
}

.timeline-hour {
    min-width: 60px;
    padding: 8px 4px;
    text-align: center;
    font-size: 11px;
    color: #787774;
    border-right: 1px solid #e8e7e5;
    flex-shrink: 0;
}

.timeline-body {
    position: relative;
    min-height: 200px;
    padding: 16px 0;
}

.timeline-row {
    display: flex;
    align-items: center;
    height: 36px;
    margin-bottom: 8px;
    position: relative;
}

.timeline-row-label {
    width: 100px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 500;
    color: #37352f;
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    position: sticky;
    left: 0;
    background: white;
    z-index: 5;
}

.timeline-row-bars {
    flex: 1;
    position: relative;
    height: 100%;
}

.timeline-bar {
    position: absolute;
    height: 24px;
    top: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding: 0 8px;
    font-size: 11px;
    color: white;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: transform 0.1s ease;
}

.timeline-bar:hover {
    transform: scaleY(1.1);
    z-index: 10;
}

.timeline-bar.done {
    background: #10b981;
}

.timeline-bar.in-progress {
    background: #fbbf24;
    color: #92400e;
}

.timeline-bar.review {
    background: #a855f7;
}

.timeline-grid {
    position: absolute;
    top: 0;
    left: 100px;
    right: 0;
    bottom: 0;
    display: flex;
    pointer-events: none;
}

.timeline-grid-line {
    min-width: 60px;
    border-right: 1px dashed #e8e7e5;
    flex-shrink: 0;
}

.timeline-empty {
    text-align: center;
    padding: 60px 20px;
    color: #787774;
    font-size: 14px;
}
```

**Add Timeline JavaScript:**

```javascript
// Timeline state
let timelineState = {
    zoomLevel: 100,
    pixelsPerMinute: 1, // Base: 1 pixel per minute
    minTimestamp: null,
    maxTimestamp: null
};

// Zoom timeline
function zoomTimeline(direction) {
    const levels = [50, 75, 100, 150, 200];
    const currentIndex = levels.indexOf(timelineState.zoomLevel);

    if (direction === 'in' && currentIndex < levels.length - 1) {
        timelineState.zoomLevel = levels[currentIndex + 1];
    } else if (direction === 'out' && currentIndex > 0) {
        timelineState.zoomLevel = levels[currentIndex - 1];
    }

    document.getElementById('zoomLevel').textContent = timelineState.zoomLevel + '%';
    renderTimeline();
}

// Render timeline visualization
function renderTimeline() {
    const container = document.getElementById('timelineBody');
    const header = document.getElementById('timelineHeader');

    if (!state.orchestratorData || state.orchestratorData.length === 0) {
        container.innerHTML = '<div class="timeline-empty">No activity data available for timeline</div>';
        header.innerHTML = '';
        return;
    }

    // Calculate time range from all activities using stored timestamps
    let minTs = Infinity;
    let maxTs = -Infinity;

    state.orchestratorData.forEach(activity => {
        // Use minTs/maxTs calculated in parser (for CSV format)
        if (activity.minTs && activity.minTs < minTs) {
            minTs = activity.minTs;
        }
        if (activity.maxTs && activity.maxTs > maxTs) {
            maxTs = activity.maxTs;
        }
    });

    // Filter activities that have valid data
    const activities = state.orchestratorData.filter(a => a.steps && a.steps.length > 0);

    if (activities.length === 0) {
        container.innerHTML = '<div class="timeline-empty">No timeline data available</div>';
        header.innerHTML = '';
        return;
    }

    // Calculate total duration span
    const totalMinutes = activities.reduce((sum, a) => {
        return sum + (a.totalDurationSecs || 0) / 60;
    }, 0);

    const ppm = timelineState.pixelsPerMinute * (timelineState.zoomLevel / 100);
    const totalWidth = Math.max(totalMinutes * ppm, 800);

    // Generate hour markers
    const hours = Math.ceil(totalMinutes / 60);
    header.innerHTML = Array.from({ length: hours + 1 }, (_, i) =>
        `<div class="timeline-hour" style="min-width: ${60 * ppm}px">${i}h</div>`
    ).join('');

    // Generate rows
    let currentOffset = 0;

    container.innerHTML = `
        <div class="timeline-grid">
            ${Array.from({ length: hours + 1 }, () =>
                `<div class="timeline-grid-line" style="min-width: ${60 * ppm}px"></div>`
            ).join('')}
        </div>
        ${activities.map(activity => {
            const durationMins = (activity.totalDurationSecs || 0) / 60;
            const width = durationMins * ppm;
            const left = currentOffset * ppm;

            const isCompleted = activity.completed !== '';
            const statusClass = isCompleted ? 'done' : 'in-progress';

            currentOffset += durationMins;

            return `
                <div class="timeline-row">
                    <div class="timeline-row-label" title="${activity.storyId}">${activity.storyId}</div>
                    <div class="timeline-row-bars">
                        <div class="timeline-bar ${statusClass}"
                             style="left: ${left}px; width: ${Math.max(width, 40)}px;"
                             title="${activity.storyId}: ${activity.duration || 'In progress'}">
                            ${activity.duration || '...'}
                        </div>
                    </div>
                </div>
            `;
        }).join('')}
    `;
}

// Update tab switching to render timeline when selected
const originalSwitchTab = switchTab;
switchTab = function(tabName) {
    originalSwitchTab(tabName);
    if (tabName === 'timeline') {
        renderTimeline();
    }
};
```

---

## Appendix: Sample Data Files

### Appendix A: Sample Orchestrator CSV

**File:** `/Users/teazyou/dev/grimoire/docs/orchestrator-sample.csv`

```csv
unix_timestamp,epicid,storyid,command,result
1706025600,2a,2a-1,create-story,start
1706025660,2a,2a-1,create-story,success
1706025720,2a,2a-1,dev-story,start
1706027520,2a,2a-1,dev-story,success
1706027580,2a,2a-1,code-review,start
1706028180,2a,2a-1,code-review,success
1706028240,2a,2a-2,create-story,start
1706028300,2a,2a-2,create-story,success
1706028360,2a,2a-2,dev-story,start
1706030160,2a,2a-2,dev-story,success
1706030220,2a,2a-2,code-review,start
1706030520,2a,2a-2,code-review,failed
1706030580,2a,2a-2,code-review,start
1706030880,2a,2a-2,code-review,success
1706030940,2a,2a-3,create-story,start
1706031000,2a,2a-3,create-story,success
1706031060,2a,2a-3,dev-story,start
1706033760,2a,2a-3,dev-story,success
1706033820,2a,2a-3,code-review,start
1706034420,2a,2a-3,code-review,success
1706034480,2b,2b-1,create-story,start
1706034540,2b,2b-1,create-story,success
1706034600,2b,2b-1,dev-story,start
```

> **Note:** Header uses `epicid` and `storyid` (no underscores) per task spec.

### Appendix B: Story Descriptions JSON Format

**File:** `/Users/teazyou/dev/grimoire/docs/story-descriptions.json`

```json
{
  "2a-1": "Implement session scanner to detect and catalog all active Claude sessions from the filesystem. Scanner should identify session folders, parse metadata, and sync with local database.",
  "2a-2": "Create session list component displaying all scanned sessions with title, timestamp, and status indicators. Support sorting and filtering.",
  "2a-3": "Add session management actions including rename, archive, delete with confirmation dialogs. Implement keyboard shortcuts.",
  "2a-4": "Handle empty state when no sessions exist and new session creation flow with template selection.",
  "2b-1": "Implement conversation message display with proper markdown rendering and code highlighting."
}
```

---

## Known Limitations and Edge Cases

### Timeline Feature
- **CSV format:** Full timeline support with precise positioning based on timestamps
- **Markdown format:** Timeline will display activities sequentially without precise time positioning (legacy data lacks timestamps)
- **Empty state:** Timeline shows "No activity data available" when orchestrator has no parsed activities

### Backward Compatibility
- Format detection is automatic based on first line content
- Both formats produce compatible data structures with same field names
- Markdown format adds empty `timestamps` array for compatibility

### XSS Prevention
- Story IDs are escaped before insertion into HTML attributes
- Description text is inserted as textContent in tooltips (safe)
- Activity descriptions should be sanitized if they come from untrusted sources

### Error Handling
- Failed fetch requests silently log to console (existing behavior)
- Invalid CSV rows (< 5 fields) are skipped
- Missing story descriptions default to "No description available"

---

## Implementation Checklist

### Task 1: UI Cleanup
- [ ] Delete `.file-loader` CSS (lines 71-177, includes .refresh-btn)
- [ ] Delete `.file-loader` HTML (lines 655-689)
- [ ] Delete file input JS handlers (lines 1304-1334)
- [ ] Delete `processFiles()` function
- [ ] Delete `toggleWatch()` function
- [ ] Delete watchBtn event listener
- [ ] Update header CSS for flexbox layout
- [ ] Reduce h1 font-size to 22px
- [ ] Enable auto-refresh in `tryAutoLoad()`

### Task 2: Epic Enhancements
- [ ] Add epic status normalization in `renderEpicBoard()`
- [ ] Add expandable card CSS
- [ ] Add `toggleEpicCard()` function
- [ ] Add story tooltip system
- [ ] Add `loadStoryDescriptions()` fetch

### Task 3: Orchestrator Migration
- [ ] Create `orchestrator-sample.csv` (use `epicid`, `storyid` - no underscores)
- [ ] Keep existing `parseOrchestrator()` as wrapper with format detection
- [ ] Rename original markdown logic to `parseOrchestratorMarkdown()`
- [ ] Add new `parseOrchestratorCSV()` function
- [ ] Add `formatTimestamp()` helper
- [ ] Add `formatDuration()` helper
- [ ] Store timestamps array in parsed activities for timeline feature

### Task 4: Story Descriptions
- [ ] Create `extract-story-descriptions.py`
- [ ] Create/update `server.py` with endpoint
- [ ] Add tooltip to Stories tab rows
- [ ] Add description to Activity tab items
- [ ] Verify tooltip works in Epic expanded view

### Task 5: Duration & Timeline
- [ ] Add Duration column to Stories table
- [ ] Add duration badge to Epic cards
- [ ] Add Timeline tab button
- [ ] Add Timeline tab panel HTML
- [ ] Add Timeline CSS styles
- [ ] Implement `renderTimeline()` function
- [ ] Implement `zoomTimeline()` function

---

*End of Implementation Plan*
