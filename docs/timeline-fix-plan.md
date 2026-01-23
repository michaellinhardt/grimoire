# Timeline Fix Plan

## Overview

This document outlines the issues with the current timeline implementation and provides a detailed plan to fix it according to Jira/Gantt chart principles.

---

## 1. Current Problems Identified

### Problem 1: Block-Coupled Bar Positioning

**Current behavior:** Bar positions are calculated relative to discrete time blocks using `timestampToXWithCompact()`. This function iterates through blocks and positions bars based on which block they fall into.

**Issue:** When `blockSizeMinutes` changes, the number of blocks changes, and since bar positions are tied to block boundaries, the bars appear to shift positions even though the underlying timestamps haven't changed.

**Code location:** `timestampToXWithCompact()` function (lines 2353-2394)

```javascript
// Current problematic approach - positions tied to block iteration
for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    // ... position calculated per-block
}
```

### Problem 2: Grid and Bars Not Decoupled

**Current behavior:** The grid columns (via `generateTimeBlocks()`) and bar positions (via `timestampToXWithCompact()`) use the same block-based logic. Changing block size affects both simultaneously.

**Expected behavior:**
- Grid columns should change when block size changes (more/fewer columns)
- Bar positions should remain constant relative to the continuous time axis

### Problem 3: Total Timeline Width Varies with Block Size

**Current behavior:** Total timeline width = `blockCount * COLUMN_WIDTH_PX`. Since `blockCount = totalMinutes / blockSizeMinutes`, changing block size changes total width.

**Expected behavior:** Total timeline width should be based on the total time range, independent of block granularity. Block size only determines how many grid lines appear within that fixed width.

### Problem 4: Empty Block Compaction Distorts Time Scale

**Current behavior:** Empty blocks are compacted to `COMPACT_WIDTH_PX` (20px vs 60px), which breaks the linear time-to-pixel mapping.

**Issue:** This causes bars to be positioned incorrectly because the time scale is no longer uniform across the timeline.

---

## 2. Correct Formulas

### 2.1 Bar Positioning (Time-Based, Not Block-Based)

Bars should be positioned using a continuous time axis:

```javascript
// Timeline bounds
const timelineStart = firstStoryStartTimestamp;
const timelineEnd = lastStoryEndTimestamp;
const totalTimeRange = timelineEnd - timelineStart; // in seconds

// Fixed total width based on desired pixels-per-second ratio
// OR calculate from block count at a reference block size
const totalTimelineWidth = calculateTotalTimelineWidth();

// Bar position formula
function timestampToX(timestamp) {
    const timeOffset = timestamp - timelineStart;
    return (timeOffset / totalTimeRange) * totalTimelineWidth;
}

// Bar dimensions
const barLeft = timestampToX(storyStartTimestamp);
const barRight = timestampToX(storyEndTimestamp);
const barWidth = barRight - barLeft;
```

### 2.2 Grid Column Rendering (Block-Size Dependent)

Grid columns overlay the timeline and change based on block size:

```javascript
// Grid calculation
const blockSizeSeconds = blockSizeMinutes * 60;
const blockCount = Math.ceil(totalTimeRange / blockSizeSeconds);

// Column width is DERIVED from total width, not fixed
const columnWidth = totalTimelineWidth / blockCount;

// OR keep fixed column width and scale total width
const COLUMN_WIDTH_PX = 60;
const totalTimelineWidth = blockCount * COLUMN_WIDTH_PX;
```

### 2.3 The Key Insight

There are two valid approaches:

**Approach A: Fixed Total Width (Jira-like)**
- Total timeline width stays constant (e.g., viewport width or calculated once)
- Column width = totalWidth / blockCount
- Smaller block size = more columns = narrower columns
- Larger block size = fewer columns = wider columns
- Bars stay in same position

**Approach B: Fixed Column Width (Current approach, but broken)**
- Column width stays constant (60px)
- Total timeline width = blockCount * columnWidth
- Smaller block size = more columns = wider total timeline
- Larger block size = fewer columns = narrower total timeline
- Problem: bars must still be positioned by time proportion, not block position

The current implementation tries to do Approach B but positions bars by block iteration, breaking the time-proportional positioning.

---

## 3. Step-by-Step Code Changes

### Step 1: Create Pure Timestamp-to-Pixel Function

Create a new function that calculates position purely from timestamps:

```javascript
/**
 * Convert timestamp to X position using continuous time scale
 * This is independent of block size - only depends on timeline bounds
 */
function timestampToXContinuous(timestamp) {
    const { timelineStartTs, timelineEndTs, zoomLevel } = timelineState;

    if (!timelineStartTs || !timelineEndTs) return 0;

    const totalTimeRange = timelineEndTs - timelineStartTs;
    if (totalTimeRange <= 0) return 0;

    // Calculate total timeline width from block count
    // This ensures grid and bars align
    const totalMinutes = totalTimeRange / 60;
    const blockCount = Math.ceil(totalMinutes / timelineState.blockSizeMinutes);
    const totalTimelineWidth = blockCount * COLUMN_WIDTH_PX * (zoomLevel / 100);

    // Position bar proportionally within total width
    const timeOffset = timestamp - timelineStartTs;
    return (timeOffset / totalTimeRange) * totalTimelineWidth;
}
```

### Step 2: Modify generateTimeBlocks()

Keep block generation but store total width for reference:

```javascript
function generateTimeBlocks() {
    const { timelineStartTs, timelineEndTs, blockSizeMinutes, zoomLevel } = timelineState;

    if (!timelineStartTs || !timelineEndTs) return [];

    const blockWidthPx = COLUMN_WIDTH_PX * (zoomLevel / 100);
    const totalSeconds = timelineEndTs - timelineStartTs;
    const totalMinutes = totalSeconds / 60;
    const blockCount = Math.ceil(totalMinutes / blockSizeMinutes);

    // Store total width for bar positioning
    timelineState.totalTimelineWidth = blockCount * blockWidthPx;

    const blocks = [];
    for (let i = 0; i <= blockCount; i++) {
        // ... existing block generation
        blocks.push({
            timestamp: blockStartTs,
            label: label,
            widthPx: blockWidthPx,
            xPosition: i * blockWidthPx, // Pre-calculate X position for grid line
            isEmpty: false
        });
    }

    return blocks;
}
```

### Step 3: Update Bar Rendering in renderTimeline()

Replace block-based positioning with continuous positioning:

```javascript
// In renderTimeline(), for story bars:
if (!isHidden && blocks.length > 0) {
    // Use continuous time-based positioning
    const barLeft = timestampToXContinuous(activity.startTs);
    const barRight = timestampToXContinuous(activity.endTs || activity.startTs + 3600);
    const barWidth = Math.max(barRight - barLeft, 40);

    // ... rest of bar creation
}

// For command step bars:
(activity.steps || []).forEach(step => {
    const cmdLeft = timestampToXContinuous(step.startTs);
    const cmdRight = timestampToXContinuous(step.endTs || step.startTs + 60);
    const cmdWidth = Math.max(cmdRight - cmdLeft, 30);
    // ... rest of command row creation
});
```

### Step 4: Decide on Empty Block Strategy

**Option A: Remove empty block compaction entirely**
- Simplest fix
- Timeline shows continuous time scale
- Empty periods are visible (which is actually correct Jira behavior)

**Option B: Keep compaction but separate from bar positioning**
- More complex
- Would require maintaining two coordinate systems
- Not recommended

Recommendation: **Use Option A** - remove empty block compaction to maintain time scale integrity.

```javascript
// Simplify renderTimeline() grid rendering:
blocks.forEach((block, index) => {
    const gridLine = document.createElement('div');
    gridLine.className = 'timeline-grid-line';
    gridLine.style.width = block.widthPx + 'px';
    gridEl.appendChild(gridLine);
});
```

### Step 5: Remove or Deprecate timestampToXWithCompact()

Once continuous positioning is implemented:

```javascript
// Mark as deprecated or remove entirely
// function timestampToXWithCompact() { ... }

// Keep simple timestampToX() but fix it:
function timestampToX(timestamp) {
    return timestampToXContinuous(timestamp);
}
```

---

## 4. Functions to Modify

| Function | Change Required |
|----------|----------------|
| `timestampToX()` | Rewrite to use continuous time scale formula |
| `timestampToXWithCompact()` | Remove or deprecate - causes time distortion |
| `generateTimeBlocks()` | Store total timeline width in state; remove isEmpty logic if removing compaction |
| `detectEmptyBlocks()` | Remove if removing compaction feature |
| `renderTimeline()` | Use new continuous positioning for bars; simplify grid rendering |

---

## 5. Expected Behavior After Fix

1. **Changing block size:**
   - Grid columns change (more/fewer, narrower/wider)
   - Bar positions remain constant relative to time
   - A story that starts at minute 30 always appears at the same visual position

2. **Visual verification:**
   - Draw two stories: one from 0-60 min, one from 60-120 min
   - Change block size from 30 min to 60 min
   - Grid should change from 4 columns to 2 columns
   - Both bars should stay in same positions, each taking half the timeline

3. **Time scale integrity:**
   - 1 minute of work should always be the same pixel width
   - `pixelsPerMinute = totalTimelineWidth / totalTimeRangeMinutes`
   - This ratio stays constant regardless of block size

---

## 6. Implementation Order

1. Add `timestampToXContinuous()` function
2. Add `totalTimelineWidth` to `timelineState`
3. Update `generateTimeBlocks()` to calculate and store total width
4. Update bar rendering in `renderTimeline()` to use new function
5. Update command step rendering to use new function
6. Remove empty block compaction logic
7. Test with various block sizes to verify bars stay positioned correctly
8. Clean up deprecated functions

---

## 7. Testing Checklist

- [ ] Bars stay in same position when changing block size
- [ ] Grid columns change correctly when changing block size
- [ ] Bar widths accurately represent duration (proportional to time)
- [ ] Overlapping stories display correctly
- [ ] Zoom still works correctly with new positioning
- [ ] Timeline scrolling works correctly
- [ ] Tooltips still appear at correct positions
