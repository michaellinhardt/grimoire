# Timeline Filter Enhancements - Implementation Plan v3

## Overview

This plan outlines enhancements to the dashboard timeline view to provide granular story filtering, improved time controls, and compact empty time blocks.

---

## 1. Story Visibility Checkboxes

### Requirements
- Add checkbox in front of each story title in timeline
- Default: checked (visible)
- Unchecking hides that story row
- If hiding first or last story: rebuild timeline with new bounds

### State Changes

```javascript
// Add to timelineState object (around line 1358)
timelineState = {
    // ... existing properties ...
    hiddenStories: new Set(),  // Set of storyId strings that are hidden
};
```

### HTML Structure Change

Current label structure:
```html
<div class="timeline-row-label">
    <span class="label-expand-icon">&#9654;</span>
    <span class="label-title">story-id</span>
    <span class="label-duration">1h 30m</span>
</div>
```

New label structure:
```html
<div class="timeline-row-label">
    <input type="checkbox"
           class="story-visibility-checkbox"
           data-story-id="story-id"
           checked>
    <span class="label-expand-icon">&#9654;</span>
    <span class="label-title">story-id</span>
    <span class="label-duration">1h 30m</span>
</div>
```

### CSS to Add

```css
/* Story visibility checkbox */
.story-visibility-checkbox {
    width: 14px;
    height: 14px;
    margin-right: 6px;
    cursor: pointer;
    accent-color: #10b981;
    flex-shrink: 0;
}

/* Hidden row styling */
.timeline-row.hidden {
    display: none;
}
```

### JavaScript Functions

```javascript
/**
 * Toggle story visibility via checkbox
 * @param {string} storyId - The story identifier
 * @param {boolean} visible - Whether the story should be visible
 */
function toggleStoryVisibility(storyId, visible) {
    if (visible) {
        timelineState.hiddenStories.delete(storyId);
    } else {
        timelineState.hiddenStories.add(storyId);
    }

    // Check if we need to recalculate timeline bounds
    const timelineData = getTimelineData(state.orchestratorData);
    if (!timelineData) return;

    const visibleActivities = timelineData.filter(
        a => !timelineState.hiddenStories.has(a.storyId)
    );

    if (visibleActivities.length === 0) {
        // All stories hidden - just hide rows
        applyStoryVisibility();
        return;
    }

    // Check if hidden story was first or last (affects bounds)
    const oldFirst = timelineData[0];
    const oldLast = timelineData[timelineData.length - 1];
    const newFirst = visibleActivities[0];
    const newLast = visibleActivities[visibleActivities.length - 1];

    const boundsChanged = (
        oldFirst.storyId !== newFirst.storyId ||
        oldLast.storyId !== newLast.storyId
    );

    if (boundsChanged) {
        // Rebuild timeline with new bounds
        renderTimeline();
    } else {
        // Just hide/show the row
        applyStoryVisibility();
    }
}

/**
 * Apply visibility state to all story rows
 */
function applyStoryVisibility() {
    document.querySelectorAll('.timeline-row').forEach(row => {
        const storyId = row.dataset.storyId;
        const isHidden = timelineState.hiddenStories.has(storyId);
        row.classList.toggle('hidden', isHidden);

        // Update checkbox state
        const checkbox = row.querySelector('.story-visibility-checkbox');
        if (checkbox) {
            checkbox.checked = !isHidden;
        }
    });
}
```

### Modification to renderTimeline()

In the row rendering section (around line 2364), modify label creation:

```javascript
// Create row label with checkbox
const label = document.createElement('div');
label.className = 'timeline-row-label';
label.title = safeStoryId;

// Add visibility checkbox
const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
checkbox.className = 'story-visibility-checkbox';
checkbox.dataset.storyId = safeStoryId;
checkbox.checked = !timelineState.hiddenStories.has(activity.storyId);
checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    toggleStoryVisibility(activity.storyId, e.target.checked);
});
checkbox.addEventListener('click', (e) => e.stopPropagation());

label.appendChild(checkbox);
// ... rest of label content
```

### Timeline Bounds Recalculation

Modify the bounds calculation in `renderTimeline()`:

```javascript
// Filter out hidden stories for bounds calculation
const visibleActivities = timelineData.filter(
    a => !timelineState.hiddenStories.has(a.storyId)
);

if (visibleActivities.length === 0) {
    // Show empty state
    hoursEl.innerHTML = '';
    gridEl.innerHTML = '';
    rowsEl.innerHTML = '<div class="timeline-empty">All stories hidden</div>';
    return;
}

// Calculate bounds from visible stories only
const startTimestamps = visibleActivities.map(a => a.startTs).filter(ts => ts != null);
const endTimestamps = visibleActivities.map(a => a.endTs || a.startTs + 3600).filter(ts => ts != null);

timelineState.timelineStartTs = startTimestamps.length > 0 ? Math.min(...startTimestamps) : 0;
timelineState.timelineEndTs = endTimestamps.length > 0 ? Math.max(...endTimestamps) : 3600;
```

---

## 2. Hide/Show All Buttons

### Requirements
- Add "Hide All" and "Show All" buttons at top of timeline controls
- Hide All: uncheck all checkboxes, hide all stories
- Show All: check all checkboxes, show all stories

### HTML Addition (timeline-controls section, around line 1239)

Add button group after zoom controls:

```html
<div class="timeline-controls">
    <div class="timeline-zoom">
        <!-- existing zoom buttons -->
    </div>

    <!-- NEW: Visibility buttons -->
    <div class="timeline-visibility-btns">
        <button class="visibility-btn" onclick="hideAllStories()">Hide All</button>
        <button class="visibility-btn" onclick="showAllStories()">Show All</button>
    </div>

    <!-- existing block size input -->
    <div class="timeline-block-size">
        <!-- ... -->
    </div>
</div>
```

### CSS to Add

```css
/* Visibility button group */
.timeline-visibility-btns {
    display: flex;
    gap: 6px;
}

.visibility-btn {
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid #e8e7e5;
    border-radius: 4px;
    background: white;
    color: #787774;
    cursor: pointer;
    transition: all 0.15s ease;
}

.visibility-btn:hover {
    background: #f7f6f3;
    color: #37352f;
    border-color: #d1d0ce;
}

.visibility-btn:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
}
```

### JavaScript Functions

```javascript
/**
 * Hide all stories in timeline
 */
function hideAllStories() {
    const timelineData = getTimelineData(state.orchestratorData);
    if (!timelineData) return;

    timelineData.forEach(activity => {
        timelineState.hiddenStories.add(activity.storyId);
    });

    // Update all checkboxes
    document.querySelectorAll('.story-visibility-checkbox').forEach(cb => {
        cb.checked = false;
    });

    // Hide all rows
    document.querySelectorAll('.timeline-row').forEach(row => {
        row.classList.add('hidden');
    });

    // Show empty state message
    const rowsEl = document.getElementById('timelineRows');
    if (rowsEl && !rowsEl.querySelector('.timeline-empty')) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'timeline-empty';
        emptyMsg.textContent = 'All stories hidden - use checkboxes or "Show All" to reveal';
        rowsEl.appendChild(emptyMsg);
    }
}

/**
 * Show all stories in timeline
 */
function showAllStories() {
    timelineState.hiddenStories.clear();

    // Remove any empty state message
    document.querySelectorAll('.timeline-empty').forEach(el => el.remove());

    // Rebuild timeline with full bounds
    renderTimeline();
}
```

---

## 3. Block Size in Minutes

### Requirements
- Change block size input from hours to minutes
- Default: 120 minutes (was 2 hours)
- Label should say "Block size (min)"

### State Change

```javascript
// Modify timelineState (around line 1365)
timelineState = {
    // ... existing properties ...
    blockSizeMinutes: 120,  // Changed from blockSizeHours: 2
};
```

### HTML Change

Current (line 1247-1256):
```html
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
```

New:
```html
<div class="timeline-block-size">
    <label for="blockSizeInput">Block size (min):</label>
    <input type="number"
           id="blockSizeInput"
           min="15"
           max="480"
           step="15"
           value="120"
           onchange="setBlockSizeMinutes(this.value)">
</div>
```

### JavaScript Changes

Replace `setBlockSize()` function:

```javascript
/**
 * Set block size in minutes
 * @param {number|string} minutes - Block size in minutes
 */
function setBlockSizeMinutes(minutes) {
    const parsed = parseInt(minutes, 10);
    if (isNaN(parsed) || parsed < 15 || parsed > 480) {
        document.getElementById('blockSizeInput').value = timelineState.blockSizeMinutes;
        return;
    }

    timelineState.blockSizeMinutes = parsed;
    renderTimeline();
}
```

Update `generateTimeBlocks()` function:

```javascript
function generateTimeBlocks() {
    const { timelineStartTs, timelineEndTs, blockSizeMinutes, pixelsPerHour, zoomLevel } = timelineState;

    if (!timelineStartTs || !timelineEndTs) return [];

    const blockSizeHours = blockSizeMinutes / 60;
    const blockWidthPx = blockSizeHours * pixelsPerHour * (zoomLevel / 100);
    const totalSeconds = timelineEndTs - timelineStartTs;
    const totalMinutes = totalSeconds / 60;
    const blockCount = Math.ceil(totalMinutes / blockSizeMinutes);

    const blocks = [];
    for (let i = 0; i <= blockCount; i++) {
        const blockStartTs = timelineStartTs + (i * blockSizeMinutes * 60);
        const minutesFromStart = i * blockSizeMinutes;

        // Format label based on total minutes
        let label;
        if (minutesFromStart >= 60) {
            const hours = Math.floor(minutesFromStart / 60);
            const mins = minutesFromStart % 60;
            label = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        } else {
            label = `${minutesFromStart}m`;
        }

        blocks.push({
            timestamp: blockStartTs,
            label: label,
            widthPx: blockWidthPx,
            isEmpty: false  // Will be set by empty block detection
        });
    }

    return blocks;
}
```

---

## 4. Compact Empty Time Columns

### Requirements
- After filtering visible stories, identify time blocks with NO tasks
- Empty blocks display as compacted (e.g., 20px width instead of full width)
- No text in header for compacted blocks
- Blocks WITH tasks display at full width with time label

### CSS to Add

```css
/* Compact empty time block */
.timeline-hour.compact {
    min-width: 20px;
    width: 20px;
    padding: 8px 2px;
    background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 3px,
        #f0efed 3px,
        #f0efed 6px
    );
    color: transparent;
    overflow: hidden;
}

.timeline-grid-line.compact {
    min-width: 20px;
    width: 20px;
    background: #f7f6f3;
    border-right: 1px dashed #d1d0ce;
}
```

### Algorithm for Empty Block Detection

```javascript
/**
 * Detect which time blocks are empty (no tasks)
 * @param {Array} blocks - Array of time blocks from generateTimeBlocks()
 * @param {Array} activities - Array of visible activities
 * @param {number} blockSizeMinutes - Block size in minutes
 * @returns {Array} blocks with isEmpty flag set
 */
function detectEmptyBlocks(blocks, activities, blockSizeMinutes) {
    const blockSizeSeconds = blockSizeMinutes * 60;

    return blocks.map((block, index) => {
        const blockStart = block.timestamp;
        const blockEnd = blockStart + blockSizeSeconds;

        // Check if any activity or step overlaps this block
        const hasContent = activities.some(activity => {
            // Check if story bar overlaps
            const storyOverlaps = (
                activity.startTs < blockEnd &&
                (activity.endTs || activity.startTs + 3600) > blockStart
            );

            if (storyOverlaps) return true;

            // Check if any command step overlaps
            return (activity.steps || []).some(step => {
                const stepEnd = step.endTs || step.startTs + 60;
                return step.startTs < blockEnd && stepEnd > blockStart;
            });
        });

        return {
            ...block,
            isEmpty: !hasContent
        };
    });
}
```

### Modification to renderTimeline()

Update the block rendering section:

```javascript
// Generate time blocks with empty detection
let blocks = generateTimeBlocks();

// Get visible activities for empty detection
const visibleActivities = timelineData.filter(
    a => !timelineState.hiddenStories.has(a.storyId)
);

// Detect empty blocks
blocks = detectEmptyBlocks(blocks, visibleActivities, timelineState.blockSizeMinutes);

const pph = timelineState.pixelsPerHour * (timelineState.zoomLevel / 100);
const normalBlockWidth = (timelineState.blockSizeMinutes / 60) * pph;
const compactBlockWidth = 20;

// Render time header with compact empty blocks
hoursEl.innerHTML = '';
blocks.forEach(block => {
    const hourDiv = document.createElement('div');
    hourDiv.className = 'timeline-hour' + (block.isEmpty ? ' compact' : '');
    hourDiv.style.minWidth = (block.isEmpty ? compactBlockWidth : normalBlockWidth) + 'px';
    hourDiv.style.width = (block.isEmpty ? compactBlockWidth : normalBlockWidth) + 'px';
    hourDiv.textContent = block.isEmpty ? '' : block.label;
    hoursEl.appendChild(hourDiv);
});

// Render grid lines with compact empty blocks
gridEl.innerHTML = '';
blocks.forEach(block => {
    const gridLine = document.createElement('div');
    gridLine.className = 'timeline-grid-line' + (block.isEmpty ? ' compact' : '');
    gridLine.style.minWidth = (block.isEmpty ? compactBlockWidth : normalBlockWidth) + 'px';
    gridLine.style.width = (block.isEmpty ? compactBlockWidth : normalBlockWidth) + 'px';
    gridEl.appendChild(gridLine);
});
```

### Update timestampToX() for Compact Blocks

The X position calculation needs to account for compact blocks:

```javascript
/**
 * Calculate X position accounting for compact empty blocks
 * @param {number} timestamp - Unix timestamp
 * @param {Array} blocks - Processed blocks with isEmpty flags
 * @returns {number} X position in pixels
 */
function timestampToXWithCompact(timestamp, blocks) {
    if (!timelineState.timelineStartTs || !blocks || blocks.length === 0) return 0;

    const blockSizeSeconds = timelineState.blockSizeMinutes * 60;
    const pph = timelineState.pixelsPerHour * (timelineState.zoomLevel / 100);
    const normalWidth = (timelineState.blockSizeMinutes / 60) * pph;
    const compactWidth = 20;

    let xPosition = 0;

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const blockEnd = block.timestamp + blockSizeSeconds;
        const blockWidth = block.isEmpty ? compactWidth : normalWidth;

        if (timestamp <= block.timestamp) {
            // Timestamp is before this block
            break;
        } else if (timestamp >= blockEnd) {
            // Timestamp is after this block - add full block width
            xPosition += blockWidth;
        } else {
            // Timestamp is within this block
            const secondsIntoBlock = timestamp - block.timestamp;
            const fractionIntoBlock = secondsIntoBlock / blockSizeSeconds;
            xPosition += fractionIntoBlock * blockWidth;
            break;
        }
    }

    return xPosition;
}
```

Store blocks in state for position calculations:

```javascript
// In renderTimeline(), after detecting empty blocks:
timelineState.processedBlocks = blocks;

// Update bar positioning to use new function
const barLeft = timestampToXWithCompact(activity.startTs, timelineState.processedBlocks);
const barRight = timestampToXWithCompact(activity.endTs || activity.startTs + 3600, timelineState.processedBlocks);
```

---

## Summary of All Changes

### State Additions
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `hiddenStories` | `Set<string>` | `new Set()` | Story IDs that are hidden |
| `blockSizeMinutes` | `number` | `120` | Block size in minutes (replaces `blockSizeHours`) |
| `processedBlocks` | `Array` | `[]` | Time blocks with isEmpty flags |

### New CSS Classes
| Class | Purpose |
|-------|---------|
| `.story-visibility-checkbox` | Checkbox styling in row labels |
| `.timeline-row.hidden` | Hidden story row |
| `.timeline-visibility-btns` | Button group container |
| `.visibility-btn` | Hide/Show All button styling |
| `.timeline-hour.compact` | Compact empty time header |
| `.timeline-grid-line.compact` | Compact empty grid line |

### New JavaScript Functions
| Function | Purpose |
|----------|---------|
| `toggleStoryVisibility(storyId, visible)` | Toggle single story visibility |
| `applyStoryVisibility()` | Apply visibility state to DOM |
| `hideAllStories()` | Hide all stories |
| `showAllStories()` | Show all stories |
| `setBlockSizeMinutes(minutes)` | Set block size in minutes |
| `detectEmptyBlocks(blocks, activities, blockSizeMinutes)` | Identify empty time blocks |
| `timestampToXWithCompact(timestamp, blocks)` | Calculate X position with compact blocks |

### Modified Functions
| Function | Changes |
|----------|---------|
| `generateTimeBlocks()` | Use minutes instead of hours |
| `renderTimeline()` | Add checkboxes, use compact blocks, filter visible stories for bounds |

---

## Implementation Order

1. **Block Size in Minutes** (simplest, no dependencies)
   - Update state
   - Update HTML input
   - Update `setBlockSizeMinutes()` and `generateTimeBlocks()`

2. **Story Visibility Checkboxes** (builds on existing structure)
   - Add CSS
   - Add state
   - Add checkbox to row label
   - Add `toggleStoryVisibility()` and `applyStoryVisibility()`
   - Modify bounds calculation

3. **Hide/Show All Buttons** (depends on visibility infrastructure)
   - Add HTML buttons
   - Add CSS
   - Add `hideAllStories()` and `showAllStories()`

4. **Compact Empty Time Columns** (most complex, depends on minutes)
   - Add CSS
   - Add `detectEmptyBlocks()`
   - Add `timestampToXWithCompact()`
   - Modify `renderTimeline()` for compact block rendering

---

## Testing Checklist

- [ ] Checkbox toggles story visibility
- [ ] Hiding first/last story recalculates timeline bounds
- [ ] "Hide All" hides all stories and shows empty message
- [ ] "Show All" restores all stories and bounds
- [ ] Block size input accepts minutes (15-480)
- [ ] Block labels format correctly (e.g., "30m", "1h", "1h 30m")
- [ ] Empty blocks display as compact (20px width)
- [ ] Non-empty blocks display at full width with label
- [ ] Bar positions calculate correctly with compact blocks
- [ ] Compact blocks have visual distinction (hatched pattern)
