# Timeline Redesign Implementation Plan v2

## Overview

This document outlines the implementation plan for redesigning the timeline view in `dashboard.html`. The redesign introduces Unix timestamp-based positioning, resizable columns, a new expand/collapse paradigm, and configurable time blocks.

---

## Current State Analysis

### Existing Implementation
- Timeline uses **sequential positioning** (stories placed one after another)
- Position calculated as: `startOffset += durationMinutes`
- Expand/collapse triggered by clicking the **timeline bar**
- Fixed 180px left column width
- Hour markers generated sequentially
- No support for real Unix timestamp positioning

### Data Available (orchestrator.md)
The orchestrator data is in markdown table format with:
- Story metadata (epic, started date, completed date, duration)
- Command steps with duration (e.g., `~5m`, `~15m`)
- **No raw Unix timestamps** in current format

### Key Insight
The orchestrator markdown format does NOT contain Unix timestamps. The current implementation uses sequential positioning. To implement true timestamp-based positioning, we would need either:
1. A CSV format with Unix timestamps
2. Enhance the markdown parser to extract/estimate timestamps from dates

For this plan, we will assume a **future CSV format** or **enhance parsing** to derive timestamps.

---

## Data Structures

### 1. Timeline State (Enhanced)

```javascript
let timelineState = {
    // Zoom and scale
    zoomLevel: 100,
    pixelsPerHour: 60,       // Base pixels per hour (replaces pixelsPerMinute)

    // Column sizing
    labelColumnWidth: 200,   // Default, stored and resizable
    minLabelWidth: 120,
    maxLabelWidth: 400,

    // Time block configuration
    blockSizeHours: 2,       // Default 2 hours per block

    // Expansion state
    expandedStoryId: null,   // Single expansion mode

    // Timeline bounds (Unix timestamps in seconds)
    timelineStart: null,     // Earliest timestamp
    timelineEnd: null,       // Latest timestamp
};
```

### 2. Processed Story Data Structure

```javascript
interface TimelineStory {
    storyId: string;
    epic: string;

    // Unix timestamps (seconds)
    startTs: number;         // First command start
    endTs: number;           // Last command end

    // Computed positions (pixels from timeline start)
    xStart: number;
    xEnd: number;
    barWidth: number;

    // Durations
    durationSecs: number;
    durationFormatted: string;

    // Command data with paired timestamps
    commands: TimelineCommand[];
}

interface TimelineCommand {
    name: string;            // e.g., "create-story", "code-review"
    step: number;            // 1, 2, 3...

    // Unix timestamps (seconds)
    startTs: number;
    endTs: number;

    // Computed positions
    xStart: number;
    xEnd: number;
    barWidth: number;

    // Duration
    durationSecs: number;
    durationFormatted: string;

    // Result (from orchestrator)
    result: string;
}
```

### 3. Command Pairing Logic

Commands in orchestrator data have paired entries:
- `result="start"` marks command begin
- `result!="start"` marks command end

```javascript
// Pseudocode for pairing
function pairCommands(entries) {
    const pairs = new Map();

    entries.forEach(entry => {
        const key = `${entry.storyId}:${entry.command}`;

        if (entry.result === 'start') {
            pairs.set(key, { startTs: entry.timestamp, command: entry.command });
        } else {
            const pair = pairs.get(key);
            if (pair) {
                pair.endTs = entry.timestamp;
                pair.result = entry.result;
                pair.durationSecs = pair.endTs - pair.startTs;
            }
        }
    });

    return Array.from(pairs.values());
}
```

---

## CSS Changes

### 1. CSS Variables for Dynamic Sizing

```css
:root {
    --timeline-label-width: 200px;
    --timeline-block-width: 120px;  /* Calculated: blockSizeHours * pixelsPerHour */
    --timeline-row-height: 48px;
    --timeline-command-row-height: 28px;
}
```

### 2. Resizable Column Styles

```css
/* Resizable label column */
.timeline-label-spacer,
.timeline-row-label {
    width: var(--timeline-label-width);
    min-width: var(--timeline-label-width);
    position: relative;
}

/* Drag handle for resizing */
.timeline-resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    background: transparent;
    transition: background 0.15s ease;
    z-index: 30;
}

.timeline-resize-handle:hover,
.timeline-resize-handle.active {
    background: #3b82f6;
}

/* Label content layout: title on left, duration on right */
.timeline-row-label {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: 0 12px;
    cursor: pointer;
    user-select: none;
}

.timeline-row-label:hover {
    background: #f7f6f3;
}

.label-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
    color: #37352f;
}

.label-duration {
    flex-shrink: 0;
    margin-left: 8px;
    font-size: 11px;
    font-weight: 400;
    color: #787774;
    font-family: 'SF Mono', Monaco, monospace;
}
```

### 3. Expanded Row with Command Rows

```css
/* Story row (collapsed) */
.timeline-row {
    display: flex;
    min-height: var(--timeline-row-height);
    border-bottom: 1px solid #f0efed;
    transition: min-height 200ms ease-out;
}

/* Story row (expanded) - grows to fit command rows */
.timeline-row.expanded {
    min-height: auto;
}

/* Command rows container */
.timeline-command-rows {
    display: none;
    flex-direction: column;
    width: 100%;
}

.timeline-row.expanded .timeline-command-rows {
    display: flex;
}

/* Individual command row */
.timeline-command-row {
    display: flex;
    height: var(--timeline-command-row-height);
    border-top: 1px dashed #e8e7e5;
}

.timeline-command-row-label {
    width: var(--timeline-label-width);
    min-width: var(--timeline-label-width);
    padding: 0 12px 0 24px;  /* Indented */
    font-size: 12px;
    color: #787774;
    display: flex;
    align-items: center;
    background: #fafaf9;
    border-right: 1px solid #e8e7e5;
}

.timeline-command-row-content {
    flex: 1;
    position: relative;
    height: var(--timeline-command-row-height);
}
```

### 4. Bar Color Differentiation

```css
/* Story bars - single color */
.timeline-bar.story-bar {
    background: #10b981;   /* Green for completed */
    height: 24px;
    border-radius: 4px;
}

.timeline-bar.story-bar.in-progress {
    background: #fbbf24;   /* Yellow for in-progress */
}

/* Command bars - distinct colors per type */
.command-bar {
    height: 18px;
    border-radius: 3px;
    opacity: 0.9;
}

.command-bar.create-story      { background: #3b82f6; }  /* Blue */
.command-bar.story-review      { background: #f59e0b; color: #37352f; }  /* Orange */
.command-bar.create-tech-spec  { background: #6366f1; }  /* Indigo */
.command-bar.tech-spec-review  { background: #8b5cf6; }  /* Violet */
.command-bar.dev-story         { background: #22c55e; }  /* Bright green */
.command-bar.code-review       { background: #a855f7; }  /* Purple */
.command-bar.default           { background: #6b7280; }  /* Gray */
```

### 5. Timeline Controls Enhancement

```css
.timeline-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: white;
    border: 1px solid #e8e7e5;
    border-radius: 8px 8px 0 0;
    border-bottom: none;
    gap: 16px;
}

/* Block size input group */
.timeline-block-size {
    display: flex;
    align-items: center;
    gap: 8px;
}

.timeline-block-size label {
    font-size: 13px;
    color: #787774;
}

.timeline-block-size input {
    width: 60px;
    padding: 4px 8px;
    border: 1px solid #e8e7e5;
    border-radius: 4px;
    font-size: 13px;
    text-align: center;
}

.timeline-block-size input:focus {
    outline: none;
    border-color: #3b82f6;
}
```

---

## HTML Structure Changes

### 1. Updated Timeline Controls

```html
<div class="timeline-controls">
    <!-- Zoom controls (existing) -->
    <div class="timeline-zoom">
        <button class="zoom-btn" onclick="zoomTimeline('out')">-</button>
        <span class="zoom-level" id="zoomLevel">100%</span>
        <button class="zoom-btn" onclick="zoomTimeline('in')">+</button>
    </div>

    <!-- NEW: Block size input -->
    <div class="timeline-block-size">
        <label for="blockSizeInput">Block size:</label>
        <input type="number"
               id="blockSizeInput"
               min="1"
               max="24"
               value="2"
               onchange="setBlockSize(this.value)">
        <span>hours</span>
    </div>

    <!-- Legend (existing) -->
    <div class="timeline-legend">
        <span class="legend-item">
            <span class="legend-color done"></span> Story
        </span>
        <span class="legend-item">
            <span class="legend-color" style="background:#3b82f6"></span> Command
        </span>
    </div>
</div>
```

### 2. Updated Timeline Header with Resize Handle

```html
<div class="timeline-header" id="timelineHeader">
    <div class="timeline-label-spacer">
        <span>Story</span>
        <div class="timeline-resize-handle" id="resizeHandle"></div>
    </div>
    <div class="timeline-hours" id="timelineHours">
        <!-- Generated time blocks -->
    </div>
</div>
```

### 3. Updated Row Structure

```html
<!-- Story row -->
<div class="timeline-row" data-story-id="story-id">
    <!-- Label (clickable for expand/collapse) -->
    <div class="timeline-row-label" onclick="toggleStoryRow('story-id')">
        <span class="label-title">story-id</span>
        <span class="label-duration">~30m</span>
    </div>

    <!-- Timeline content area -->
    <div class="timeline-row-content">
        <!-- Story bar -->
        <div class="timeline-bar story-bar" style="left: Xpx; width: Ypx;">
            <!-- No expand button - click handled by label -->
        </div>

        <!-- Command rows (shown when expanded) -->
        <div class="timeline-command-rows">
            <div class="timeline-command-row">
                <div class="timeline-command-row-label">create-story</div>
                <div class="timeline-command-row-content">
                    <div class="command-bar create-story" style="left: Xpx; width: Ypx;">
                        <span class="command-label">~3m</span>
                    </div>
                </div>
            </div>
            <!-- More command rows... -->
        </div>
    </div>
</div>
```

---

## JavaScript Functions

### 1. Position Calculation (Timestamp-Based)

```javascript
/**
 * Calculate X position from Unix timestamp
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {number} - X position in pixels
 */
function timestampToX(timestamp) {
    if (!timelineState.timelineStart) return 0;

    const secondsFromStart = timestamp - timelineState.timelineStart;
    const hoursFromStart = secondsFromStart / 3600;
    const pixelsPerHour = timelineState.pixelsPerHour * (timelineState.zoomLevel / 100);

    return hoursFromStart * pixelsPerHour;
}

/**
 * Calculate story bar position and width
 * @param {TimelineStory} story
 * @returns {{left: number, width: number}}
 */
function calculateStoryBarPosition(story) {
    const left = timestampToX(story.startTs);
    const right = timestampToX(story.endTs);
    const width = Math.max(right - left, 40); // Minimum 40px width

    return { left, width };
}

/**
 * Calculate command bar position and width
 * @param {TimelineCommand} command
 * @returns {{left: number, width: number}}
 */
function calculateCommandBarPosition(command) {
    const left = timestampToX(command.startTs);
    const right = timestampToX(command.endTs);
    const width = Math.max(right - left, 30); // Minimum 30px width

    return { left, width };
}
```

### 2. Time Block Generation

```javascript
/**
 * Generate time blocks based on timeline bounds and block size
 */
function generateTimeBlocks() {
    const { timelineStart, timelineEnd, blockSizeHours, pixelsPerHour, zoomLevel } = timelineState;

    if (!timelineStart || !timelineEnd) return [];

    const blockWidthPx = blockSizeHours * pixelsPerHour * (zoomLevel / 100);
    const totalSeconds = timelineEnd - timelineStart;
    const totalHours = totalSeconds / 3600;
    const blockCount = Math.ceil(totalHours / blockSizeHours);

    const blocks = [];
    for (let i = 0; i <= blockCount; i++) {
        const blockStartTs = timelineStart + (i * blockSizeHours * 3600);
        const date = new Date(blockStartTs * 1000);

        blocks.push({
            timestamp: blockStartTs,
            label: formatBlockLabel(date),
            widthPx: blockWidthPx
        });
    }

    return blocks;
}

/**
 * Format block label based on block size
 */
function formatBlockLabel(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();

    // If block shows start of day, include date
    if (hours === 0 && minutes === 0) {
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    // Otherwise just time
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}
```

### 3. Block Size Configuration

```javascript
/**
 * Set timeline block size in hours
 * @param {number|string} hours
 */
function setBlockSize(hours) {
    const parsed = parseInt(hours, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 24) {
        document.getElementById('blockSizeInput').value = timelineState.blockSizeHours;
        return;
    }

    timelineState.blockSizeHours = parsed;
    renderTimeline();
}
```

### 4. Column Resizing

```javascript
let isResizing = false;
let startX = 0;
let startWidth = 0;

/**
 * Initialize column resize functionality
 */
function initColumnResize() {
    const handle = document.getElementById('resizeHandle');
    if (!handle) return;

    handle.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

function startResize(e) {
    isResizing = true;
    startX = e.clientX;
    startWidth = timelineState.labelColumnWidth;
    document.getElementById('resizeHandle').classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
}

function doResize(e) {
    if (!isResizing) return;

    const diff = e.clientX - startX;
    const newWidth = Math.min(
        Math.max(startWidth + diff, timelineState.minLabelWidth),
        timelineState.maxLabelWidth
    );

    timelineState.labelColumnWidth = newWidth;
    document.documentElement.style.setProperty(
        '--timeline-label-width',
        newWidth + 'px'
    );
}

function stopResize() {
    if (!isResizing) return;

    isResizing = false;
    document.getElementById('resizeHandle')?.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Persist to localStorage
    localStorage.setItem('timeline-label-width', timelineState.labelColumnWidth);
}

/**
 * Restore column width from localStorage
 */
function restoreColumnWidth() {
    const saved = localStorage.getItem('timeline-label-width');
    if (saved) {
        const width = parseInt(saved, 10);
        if (!isNaN(width) && width >= timelineState.minLabelWidth && width <= timelineState.maxLabelWidth) {
            timelineState.labelColumnWidth = width;
            document.documentElement.style.setProperty(
                '--timeline-label-width',
                width + 'px'
            );
        }
    }
}
```

### 5. Expand/Collapse via Label Click

```javascript
/**
 * Toggle story row expansion - triggered by label click
 * @param {string} storyId
 */
function toggleStoryRow(storyId) {
    const sanitizedId = CSS.escape(String(storyId || ''));
    const row = document.querySelector(`.timeline-row[data-story-id="${sanitizedId}"]`);
    if (!row) return;

    const wasExpanded = row.classList.contains('expanded');

    // Collapse all other rows (single expansion mode)
    document.querySelectorAll('.timeline-row.expanded').forEach(r => {
        if (r !== row) {
            r.classList.remove('expanded');
        }
    });

    // Toggle current row
    row.classList.toggle('expanded', !wasExpanded);
    timelineState.expandedStoryId = wasExpanded ? null : storyId;
}
```

### 6. Command Pairing from Orchestrator

```javascript
/**
 * Parse orchestrator data and pair commands by start/end
 * @param {string} text - Raw orchestrator data
 * @returns {TimelineStory[]}
 */
function parseOrchestratorWithPairing(text) {
    const stories = new Map();
    const lines = text.trim().split('\n');

    // Detect format
    const isCSV = lines[0].includes('unix_timestamp') || lines[0].match(/^\d+,/);

    if (isCSV) {
        return parseCSVWithPairing(lines);
    }

    // Fallback to markdown (estimate timestamps from dates)
    return parseMarkdownWithEstimatedTimestamps(lines);
}

/**
 * Parse CSV format with actual Unix timestamps
 * Format: unix_timestamp,epicid,storyid,command,result
 */
function parseCSVWithPairing(lines) {
    const stories = new Map();
    const startIndex = lines[0].includes('unix_timestamp') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [timestamp, epicId, storyId, command, result] = line.split(',');
        const ts = parseInt(timestamp, 10);

        if (!stories.has(storyId)) {
            stories.set(storyId, {
                storyId,
                epic: `epic-${epicId}`,
                commands: new Map(),
                commandList: [],
                startTs: null,
                endTs: null
            });
        }

        const story = stories.get(storyId);
        const cmdKey = command;

        if (result === 'start') {
            // Command start
            story.commands.set(cmdKey, {
                name: command,
                startTs: ts,
                step: story.commandList.length + 1
            });

            // Track story start
            if (!story.startTs || ts < story.startTs) {
                story.startTs = ts;
            }
        } else {
            // Command end
            const cmd = story.commands.get(cmdKey);
            if (cmd) {
                cmd.endTs = ts;
                cmd.result = result;
                cmd.durationSecs = ts - cmd.startTs;
                cmd.durationFormatted = formatDuration(cmd.durationSecs);
                story.commandList.push({ ...cmd });
            }

            // Track story end
            if (!story.endTs || ts > story.endTs) {
                story.endTs = ts;
            }
        }
    }

    // Convert to array and calculate totals
    return Array.from(stories.values()).map(story => {
        story.durationSecs = story.endTs - story.startTs;
        story.durationFormatted = formatDuration(story.durationSecs);
        story.commands = story.commandList;
        delete story.commandList;
        return story;
    });
}
```

### 7. Main Render Function (Updated)

```javascript
/**
 * Render timeline with timestamp-based positioning
 */
function renderTimeline() {
    const hoursEl = document.getElementById('timelineHours');
    const gridEl = document.getElementById('timelineGrid');
    const rowsEl = document.getElementById('timelineRows');

    if (!hoursEl || !gridEl || !rowsEl) return;

    // Get processed data
    const timelineData = getTimelineData(state.orchestratorData);

    if (!timelineData || timelineData.length === 0) {
        rowsEl.innerHTML = '<div class="timeline-empty">No timeline data available</div>';
        return;
    }

    // Calculate timeline bounds
    timelineState.timelineStart = Math.min(...timelineData.map(s => s.startTs));
    timelineState.timelineEnd = Math.max(...timelineData.map(s => s.endTs));

    // Generate time blocks
    const blocks = generateTimeBlocks();
    renderTimeBlocks(hoursEl, blocks);
    renderGridLines(gridEl, blocks);

    // Render story rows
    rowsEl.innerHTML = '';
    timelineData.forEach(story => {
        const rowEl = createStoryRow(story);
        rowsEl.appendChild(rowEl);
    });
}

/**
 * Create a story row element
 */
function createStoryRow(story) {
    const { left, width } = calculateStoryBarPosition(story);
    const isCompleted = story.endTs !== null;

    const row = document.createElement('div');
    row.className = 'timeline-row';
    row.dataset.storyId = story.storyId;

    // Label (clickable)
    const label = document.createElement('div');
    label.className = 'timeline-row-label';
    label.onclick = () => toggleStoryRow(story.storyId);
    label.innerHTML = `
        <span class="label-title">${escapeHtml(story.storyId)}</span>
        <span class="label-duration">${escapeHtml(story.durationFormatted || '')}</span>
    `;

    // Content area
    const content = document.createElement('div');
    content.className = 'timeline-row-content';

    // Story bar
    const bar = document.createElement('div');
    bar.className = `timeline-bar story-bar ${isCompleted ? 'done' : 'in-progress'}`;
    bar.style.left = left + 'px';
    bar.style.width = width + 'px';
    content.appendChild(bar);

    // Command rows container
    const commandRows = document.createElement('div');
    commandRows.className = 'timeline-command-rows';

    story.commands.forEach(cmd => {
        const cmdRow = createCommandRow(cmd);
        commandRows.appendChild(cmdRow);
    });

    content.appendChild(commandRows);
    row.appendChild(label);
    row.appendChild(content);

    return row;
}

/**
 * Create a command row element
 */
function createCommandRow(cmd) {
    const { left, width } = calculateCommandBarPosition(cmd);
    const cmdClass = getCommandClass(cmd.name);

    const row = document.createElement('div');
    row.className = 'timeline-command-row';

    row.innerHTML = `
        <div class="timeline-command-row-label">${escapeHtml(cmd.name)}</div>
        <div class="timeline-command-row-content">
            <div class="command-bar ${cmdClass}" style="left: ${left}px; width: ${width}px;">
                <span class="command-label">${escapeHtml(cmd.durationFormatted || '')}</span>
            </div>
        </div>
    `;

    return row;
}
```

---

## Implementation Order

### Phase 1: Foundation (CSS Variables + Resizable Column)
**Estimated: 30 minutes**

1. Add CSS custom properties (`:root` variables)
2. Update `.timeline-label-spacer` and `.timeline-row-label` to use CSS var
3. Add resize handle element and styles
4. Implement `initColumnResize()`, `startResize()`, `doResize()`, `stopResize()`
5. Add localStorage persistence for column width
6. Test: drag handle resizes column smoothly

### Phase 2: Label Click Expand/Collapse
**Estimated: 20 minutes**

1. Move duration display to right side of label
2. Add click handler to `.timeline-row-label` instead of bar
3. Remove expand button from timeline bar
4. Update `toggleStoryRow()` to handle label clicks
5. Test: clicking label expands/collapses, bar no longer clickable for expansion

### Phase 3: Command Row Structure
**Estimated: 45 minutes**

1. Create new CSS for `.timeline-command-rows` and `.timeline-command-row`
2. Update `createStoryRow()` to generate command row elements
3. Create `createCommandRow()` function
4. Update CSS for proper indentation and styling
5. Test: expanded rows show command rows beneath story bar

### Phase 4: Command Pairing Logic
**Estimated: 30 minutes**

1. Implement `parseCSVWithPairing()` for CSV format
2. Implement `parseMarkdownWithEstimatedTimestamps()` for fallback
3. Match command start/end pairs by name
4. Calculate duration = end_timestamp - start_timestamp
5. Test: commands are correctly paired with durations

### Phase 5: Timestamp-Based Positioning
**Estimated: 45 minutes**

1. Implement `timestampToX()` function
2. Implement `calculateStoryBarPosition()` and `calculateCommandBarPosition()`
3. Calculate timeline bounds (earliest start, latest end)
4. Update `renderTimeline()` to use timestamp positioning
5. Test: bars positioned by actual timestamps, not sequential

### Phase 6: Configurable Time Blocks
**Estimated: 30 minutes**

1. Add block size input to timeline controls HTML
2. Implement `setBlockSize()` function
3. Update `generateTimeBlocks()` to use configurable size
4. Update `formatBlockLabel()` to show appropriate date/time
5. Test: changing block size refreshes timeline with new markers

### Phase 7: Bar Color Differentiation
**Estimated: 15 minutes**

1. Add `.story-bar` class to story bars
2. Update command bar colors to be distinct
3. Update legend to show both story and command colors
4. Test: visual distinction between story and command bars

### Phase 8: Testing & Polish
**Estimated: 30 minutes**

1. Test horizontal scrolling with many stories
2. Test vertical scrolling with expanded rows
3. Test zoom at different levels
4. Test with edge cases (single story, many commands)
5. Performance testing with large datasets
6. Accessibility testing (keyboard navigation, screen readers)

---

## Migration Notes

### Data Format Dependency

The current orchestrator.md format does not include Unix timestamps. Options:

1. **CSV Format (Recommended)**: Add support for `orchestrator.csv` with format:
   ```
   unix_timestamp,epicid,storyid,command,result
   1706140800,1,1-2-core-shell-layout,create-story,start
   1706140980,1,1-2-core-shell-layout,create-story,success
   ```

2. **Timestamp Estimation**: Parse ISO dates from markdown and estimate command timestamps based on durations

### Backward Compatibility

- Keep existing sequential rendering as fallback when timestamps unavailable
- Detect format automatically in `parseOrchestrator()`
- Show warning if using estimated timestamps

---

## File Locations

| File | Purpose |
|------|---------|
| `/Users/teazyou/dev/grimoire/docs/dashboard.html` | Main implementation file |
| `/Users/teazyou/dev/grimoire/docs/timeline-plan-v2.md` | This plan document |

---

## Success Criteria

1. Column width is resizable via drag handle
2. Column width persists across page reloads
3. Clicking story title expands/collapses command rows
4. Clicking timeline bar does NOT expand (bar is just visual)
5. Command rows show one row per command with its own bar
6. Story bars use one color, command bars use different colors per type
7. Block size input changes timeline scale
8. Bars positioned by actual timestamps (when data available)
9. Timeline scrolls both horizontally and vertically
10. Performance remains smooth with 50+ stories
