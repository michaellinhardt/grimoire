# Timeline Visualization Component Design Document

## Overview

This document specifies the design and implementation requirements for an improved timeline visualization component that displays sprint story execution data. The timeline will show stories as horizontal bars on a time axis, with expandable detail views showing individual command durations.

---

## 1. Functional Requirements

### 1.1 Primary Timeline View

| Requirement | Description |
|-------------|-------------|
| **Time Axis** | Horizontal axis displaying time in hours/minutes, left-to-right chronological order |
| **Story Bars** | Each completed or in-progress story rendered as a horizontal bar |
| **Bar Width** | Proportional to total story duration (extracted from `~Xm` format or calculated from steps) |
| **Bar Position** | Sequential placement based on story start times from orchestrator data |
| **Labels** | Story ID displayed on or adjacent to each bar |
| **Duration Badge** | Total duration shown on hover or within the bar |

### 1.2 Expandable Command Detail

| Requirement | Description |
|-------------|-------------|
| **Expand Trigger** | Single click on a story bar expands that story |
| **Expand Direction** | Expands downward, pushing subsequent content down |
| **Command Bars** | Sub-bars for each command (create-story, dev-story, code-review, etc.) |
| **Command Duration** | Each sub-bar width proportional to command duration |
| **Collapse** | Click again or click collapse button to return to summary view |
| **Single Expansion** | Only one story expanded at a time (clicking another auto-collapses previous) |

### 1.3 Time Scale

| Requirement | Description |
|-------------|-------------|
| **Default Scale** | 1 pixel per minute (60px per hour) |
| **Zoom Levels** | 50%, 75%, 100%, 150%, 200% (0.5 to 2 pixels per minute) |
| **Scale Markers** | Hour markers in header; 15-minute gridlines in body |
| **Dynamic Adjustment** | Total width calculated from sum of all story durations |

### 1.4 Data Handling

| Requirement | Description |
|-------------|-------------|
| **Markdown Format** | Parse `~Xm` duration strings (e.g., `~15m`, `~5m`) |
| **Duration Extraction** | Extract numeric value, assume minutes unless otherwise specified |
| **Missing Start Times** | Calculate relative positions from sequential story order |
| **Step Aggregation** | Sum step durations for total story duration when not explicitly provided |

---

## 2. Visual Design

### 2.1 Color Palette (From Existing Dashboard)

```css
/* Status Colors */
--color-done: #10b981;           /* Green - completed stories */
--color-in-progress: #fbbf24;    /* Amber - active stories */
--color-review: #a855f7;         /* Purple - in review */

/* Command Type Colors (for expanded view) */
--color-create-story: #3b82f6;   /* Blue */
--color-dev-story: #10b981;      /* Green */
--color-code-review: #a855f7;    /* Purple */
--color-story-review: #f59e0b;   /* Orange */
--color-tech-spec: #6366f1;      /* Indigo */

/* Background & Borders */
--color-bg-primary: #ffffff;
--color-bg-secondary: #fafaf9;
--color-bg-page: #f7f6f3;
--color-border: #e8e7e5;
--color-text-primary: #37352f;
--color-text-secondary: #787774;
```

### 2.2 Layout Dimensions

```
Timeline Container
+------------------------------------------------------------------+
| Controls Bar (height: 48px)                                       |
|  [- 100% +]                              [Legend: Done | Active]  |
+------------------------------------------------------------------+
| Header Row (height: 32px)                                         |
|  | 0h      | 1h      | 2h      | 3h      | 4h      | ...         |
+------------------------------------------------------------------+
| Story Rows (height: 48px each, expandable to 120px)               |
|                                                                   |
|  story-1-2  |========[30m]========|                               |
|                                                                   |
|  story-1-3  |         |===========[35m]===========|               |
|                                                                   |
|  story-2a-1 |                     |============[45m]============| |
|                                                                   |
+------------------------------------------------------------------+
```

### 2.3 Component Specifications

#### 2.3.1 Story Bar (Collapsed)

| Property | Value |
|----------|-------|
| Height | 28px |
| Border Radius | 6px |
| Vertical Margin | 10px (centered in 48px row) |
| Min Width | 60px (for very short durations) |
| Font Size | 12px |
| Font Weight | 500 |
| Text Color | #ffffff (or #37352f for amber) |
| Shadow | none (add on hover: `0 2px 8px rgba(0,0,0,0.15)`) |

#### 2.3.2 Story Bar (Expanded)

| Property | Value |
|----------|-------|
| Summary Bar Height | 28px |
| Command Bar Height | 20px |
| Command Bar Spacing | 4px vertical gap |
| Expanded Row Height | 120px (accommodates ~4 command bars) |
| Transition Duration | 200ms ease-out |

#### 2.3.3 Command Sub-Bars

| Property | Value |
|----------|-------|
| Height | 20px |
| Border Radius | 4px |
| Left Offset | Aligned to command start time within story |
| Font Size | 11px |
| Opacity | 0.9 |
| Label Format | `{command} ({duration})` |

#### 2.3.4 Row Labels

| Property | Value |
|----------|-------|
| Width | 180px (fixed, sticky left) |
| Font Size | 13px |
| Font Weight | 500 |
| Color | #37352f |
| Background | #ffffff |
| Padding | 0 16px |
| Text Overflow | ellipsis |
| Border Right | 1px solid #e8e7e5 |

#### 2.3.5 Time Header

| Property | Value |
|----------|-------|
| Height | 32px |
| Background | #fafaf9 |
| Font Size | 11px |
| Font Weight | 600 |
| Color | #787774 |
| Border Bottom | 1px solid #e8e7e5 |
| Hour Cell Width | 60px * zoom level |

#### 2.3.6 Grid Lines

| Property | Value |
|----------|-------|
| Hour Lines | 1px solid #e8e7e5 |
| 15-Minute Lines | 1px dashed #e8e7e5 (at 150%+ zoom) |
| Opacity | 0.5 |

### 2.4 Hover States

#### Story Bar Hover
```css
.timeline-bar:hover {
    transform: scaleY(1.08);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 10;
}
```

#### Story Bar Hover Tooltip
```
+----------------------------------+
| 1-3-tab-system-for-sessions      |
| Duration: ~35m                   |
| Steps: 7                         |
| Started: Jan 22, 12:00 PM        |
+----------------------------------+
```

| Property | Value |
|----------|-------|
| Background | #37352f |
| Text Color | #ffffff |
| Padding | 8px 12px |
| Border Radius | 6px |
| Font Size | 12px |
| Max Width | 280px |
| Shadow | 0 4px 12px rgba(0,0,0,0.15) |
| Position | Above bar, horizontally centered |

### 2.5 Expand/Collapse Animation

```css
.timeline-row {
    transition: height 200ms ease-out;
}

.timeline-row.collapsed {
    height: 48px;
}

.timeline-row.expanded {
    height: 120px;
}

.command-bars-container {
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 150ms ease-out, transform 150ms ease-out;
}

.timeline-row.expanded .command-bars-container {
    opacity: 1;
    transform: translateY(0);
}
```

### 2.6 Scrolling Behavior

| Axis | Behavior |
|------|----------|
| **Horizontal** | Scroll to navigate time axis; row labels remain sticky-left |
| **Vertical** | Scroll to see more stories; time header remains sticky-top |
| **Scroll Indicators** | Subtle fade gradient at edges when more content exists |
| **Initial Position** | Scroll to show most recent activity (rightmost) |

---

## 3. Data Mapping

### 3.1 Data Source Structure (Markdown Format)

From `orchestrator.md`:

```markdown
## Story: 1-3-tab-system-for-sessions
Epic: epic-1
Started: 2026-01-22T12:00:00Z

| Step | Command | Result | Duration |
|------|---------|--------|----------|
| 1 | create-story | Story file created with 7 AC, 9 tasks | ~3m |
| 2 | story-review #1 | 4 critical issues fixed | ~4m |
| 3 | dev-story | All 8 tasks done, 14 files, 42 tests pass | ~15m |
| 4 | code-review #1 | 7 issues fixed | ~5m |
...

Total duration: ~35m
```

### 3.2 Parsed Data Structure

```typescript
interface TimelineStory {
    storyId: string;              // "1-3-tab-system-for-sessions"
    epic: string;                 // "epic-1"
    started: string | null;       // ISO timestamp or null
    completed: string | null;     // ISO timestamp or null
    duration: string;             // "~35m"
    durationMinutes: number;      // 35
    steps: TimelineStep[];
    status: 'done' | 'in-progress';
}

interface TimelineStep {
    step: number;
    command: string;              // "dev-story", "code-review #1"
    commandType: string;          // "dev-story", "code-review" (base type)
    result: string;
    duration: string;             // "~15m"
    durationMinutes: number;      // 15
    startOffset: number;          // Minutes from story start
}
```

### 3.3 Duration Parsing

```javascript
function parseDuration(durationStr) {
    // Input: "~15m", "~3m", "30m", "1h 15m"
    // Output: number (minutes)

    if (!durationStr) return 0;

    const cleaned = durationStr.replace(/^~/, '').trim();

    // Handle hours and minutes: "1h 15m" or "1h15m"
    const hourMatch = cleaned.match(/(\d+)h/);
    const minMatch = cleaned.match(/(\d+)m/);

    let minutes = 0;
    if (hourMatch) minutes += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) minutes += parseInt(minMatch[1], 10);

    // Handle plain number (assume minutes)
    if (!hourMatch && !minMatch) {
        const numMatch = cleaned.match(/(\d+)/);
        if (numMatch) minutes = parseInt(numMatch[1], 10);
    }

    return minutes;
}
```

### 3.4 Timeline Position Calculation

Since stories in the orchestrator log are sequential (one story completes before the next begins), positions are calculated by accumulating durations:

```javascript
function calculateTimelinePositions(stories) {
    let currentOffset = 0;  // minutes from timeline start

    return stories.map(story => {
        const startOffset = currentOffset;
        const durationMinutes = parseDuration(story.duration);

        // Calculate step offsets within story
        let stepOffset = 0;
        const stepsWithOffsets = story.steps.map(step => {
            const stepStart = stepOffset;
            const stepDuration = parseDuration(step.duration);
            stepOffset += stepDuration;

            return {
                ...step,
                durationMinutes: stepDuration,
                startOffset: stepStart
            };
        });

        currentOffset += durationMinutes;

        return {
            ...story,
            durationMinutes,
            timelineStart: startOffset,
            timelineEnd: currentOffset,
            steps: stepsWithOffsets
        };
    });
}
```

### 3.5 Pixel Position Mapping

```javascript
function getPixelPosition(minutes, pixelsPerMinute) {
    return minutes * pixelsPerMinute;
}

function getBarStyle(story, ppm, labelWidth = 180) {
    const left = labelWidth + getPixelPosition(story.timelineStart, ppm);
    const width = Math.max(getPixelPosition(story.durationMinutes, ppm), 60);

    return {
        left: `${left}px`,
        width: `${width}px`
    };
}
```

### 3.6 Command Type Color Mapping

```javascript
const COMMAND_COLORS = {
    'create-story': '#3b82f6',    // Blue
    'story-review': '#f59e0b',    // Orange
    'create-tech-spec': '#6366f1', // Indigo
    'tech-spec-review': '#8b5cf6', // Violet
    'dev-story': '#10b981',       // Green
    'code-review': '#a855f7'      // Purple
};

function getCommandColor(command) {
    // Extract base command type: "code-review #1" -> "code-review"
    const baseCommand = command.split(' ')[0].split('#')[0].trim();
    return COMMAND_COLORS[baseCommand] || '#6b7280';  // Gray fallback
}
```

---

## 4. Component Architecture

### 4.1 HTML Structure

```html
<div class="timeline-panel" id="tab-timeline">
    <!-- Controls -->
    <div class="timeline-controls">
        <div class="timeline-zoom">
            <button class="zoom-btn" data-action="out">-</button>
            <span class="zoom-level">100%</span>
            <button class="zoom-btn" data-action="in">+</button>
        </div>
        <div class="timeline-legend">
            <span class="legend-item">
                <span class="legend-dot" style="background: #10b981"></span>
                Done
            </span>
            <span class="legend-item">
                <span class="legend-dot" style="background: #fbbf24"></span>
                In Progress
            </span>
        </div>
    </div>

    <!-- Scrollable Container -->
    <div class="timeline-scroll-container">
        <!-- Time Header (sticky top) -->
        <div class="timeline-header">
            <div class="timeline-label-spacer"></div>
            <div class="timeline-hours">
                <!-- Generated hour markers -->
            </div>
        </div>

        <!-- Timeline Body -->
        <div class="timeline-body">
            <!-- Grid Lines (absolute positioned) -->
            <div class="timeline-grid"></div>

            <!-- Story Rows -->
            <div class="timeline-rows">
                <!-- Generated story rows -->
            </div>
        </div>
    </div>

    <!-- Tooltip (positioned absolutely) -->
    <div class="timeline-tooltip" id="timelineTooltip"></div>
</div>
```

### 4.2 Story Row Template

```html
<div class="timeline-row" data-story-id="1-3-tab-system-for-sessions">
    <!-- Sticky Label -->
    <div class="timeline-row-label">
        <span class="label-text">1-3-tab-system...</span>
        <span class="label-duration">~35m</span>
    </div>

    <!-- Bar Container -->
    <div class="timeline-row-content">
        <!-- Main Story Bar -->
        <div class="timeline-bar done"
             style="left: 120px; width: 210px;"
             data-duration="35"
             data-steps="7">
            <span class="bar-label">~35m</span>
            <button class="expand-btn" aria-label="Expand details">
                <svg><!-- chevron icon --></svg>
            </button>
        </div>

        <!-- Command Bars (hidden until expanded) -->
        <div class="timeline-commands">
            <div class="command-bar"
                 style="left: 120px; width: 18px; background: #3b82f6;">
                <span class="command-label">create-story</span>
            </div>
            <div class="command-bar"
                 style="left: 138px; width: 24px; background: #f59e0b;">
                <span class="command-label">story-review</span>
            </div>
            <!-- ... more command bars -->
        </div>
    </div>
</div>
```

---

## 5. Interaction Specifications

### 5.1 Click Behaviors

| Target | Action | Result |
|--------|--------|--------|
| Story Bar | Single Click | Toggle expand/collapse |
| Expand Button | Single Click | Toggle expand/collapse |
| Command Bar | Single Click | Show command details in tooltip |
| Empty Area | Single Click | Collapse any expanded story |
| Zoom Buttons | Single Click | Adjust zoom level |

### 5.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move focus between story bars |
| Enter/Space | Expand/collapse focused story |
| Escape | Collapse expanded story |
| Arrow Left/Right | Scroll timeline horizontally |
| Arrow Up/Down | Navigate between story rows |

### 5.3 Accessibility

| Requirement | Implementation |
|-------------|----------------|
| ARIA Labels | `role="region"`, `aria-label="Project Timeline"` |
| Bar Labels | `aria-label="{storyId}, duration {duration}, {status}"` |
| Expand State | `aria-expanded="true/false"` on story bars |
| Focus Visible | High contrast focus ring on interactive elements |
| Screen Reader | Announce story details on focus |

---

## 6. Performance Considerations

### 6.1 Rendering Optimization

| Strategy | Implementation |
|----------|----------------|
| Virtual Scrolling | Only render visible rows for large datasets (>50 stories) |
| Debounced Resize | 100ms debounce on window resize recalculations |
| CSS Transforms | Use `transform` for animations instead of layout properties |
| Will-Change | Apply `will-change: transform` to animated elements |

### 6.2 Data Caching

```javascript
// Cache parsed timeline data to avoid re-parsing on zoom
let cachedTimelineData = null;
let cachedDataHash = null;

function getTimelineData(orchestratorData) {
    const hash = hashData(orchestratorData);
    if (hash === cachedDataHash) {
        return cachedTimelineData;
    }

    cachedTimelineData = calculateTimelinePositions(orchestratorData);
    cachedDataHash = hash;
    return cachedTimelineData;
}
```

---

## 7. Error Handling

| Scenario | Handling |
|----------|----------|
| No data | Show empty state: "No timeline data available" |
| Parse error | Log warning, show partial data if possible |
| Invalid duration | Default to 1 minute, show warning indicator |
| Missing timestamps | Calculate from sequential order |

---

## 8. Future Enhancements (Out of Scope)

- Drag to scroll/pan timeline
- Date range picker for filtering
- Export timeline as image
- Real-time updates during active sprint
- Comparison view between sprints
- Annotations/comments on timeline events
