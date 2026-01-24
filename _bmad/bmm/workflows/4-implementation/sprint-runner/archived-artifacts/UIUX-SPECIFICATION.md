# Sprint Runner Dashboard - UI/UX Specification

> The definitive design specification for the Sprint Runner Dashboard

**Version:** 1.0.0
**Date:** January 24, 2026
**Author:** UI/UX Analyst Agent
**Status:** APPROVED FOR IMPLEMENTATION

---

## Executive Summary

The Sprint Runner Dashboard is a real-time monitoring interface for technical users who need to start sprint runs quickly and observe every detail of batch execution. The design philosophy centers on **living information** - where running operations pulse with energy, completions celebrate briefly, and the entire system state is comprehensible at a glance while offering unlimited depth for investigation.

This specification delivers:
- A Split Panel Layout with collapsible batch history sidebar
- A hierarchical, expandable information architecture (Batch > Story > Command > Task)
- Physics-based animations that communicate state without distraction
- A warm neutral color palette inspired by Anthropic's design language
- Full real-time updates via WebSocket with graceful reconnection

The user experience follows a natural workflow: **Start Run -> Monitor Live -> Review History**. Every design decision prioritizes this flow.

---

## 1. Layout Architecture

### 1.1 Layout Decision: Split Panel Layout

**Selected:** Split Panel Layout (Section 4.1 from brainstorm)

**Rationale:**
- The Stacked Card Layout (4.2) optimizes for mobile but sacrifices information density for desktop users
- The Timeline-Centric Layout (4.3) is powerful but makes current operations secondary to visualization
- Split Panel provides the best balance: persistent batch history access + rich main content area
- Technical users benefit from seeing batch history alongside current operations without navigation

**Rejected Alternatives:**
- Stacked Card: Insufficient information density, requires excessive scrolling
- Timeline-Centric: Too focused on temporal visualization, obscures real-time status

### 1.2 Final Layout Structure

```
+-----------------------------------------------------------------------------+
|                         SPRINT RUN HEADER                                    |
|  [Start] [Stop]  |  Batch Mode: [n] [All]  |  [Settings]  |  Connection: *   |
+--------------------+--------------------------------------------------------+
|                    |                                                        |
|  BATCH HISTORY     |              MAIN CONTENT AREA                        |
|  SIDEBAR           |                                                        |
|  (240px, collapsible)|  +--------------------------------------------------+  |
|                    |  | BATCH HEADER                                      |  |
|  +----------------+|  | Batch #42  *Running  |  2h 15m  |  Cycle 2/5       |  |
|  | * #42 Running  ||  +--------------------------------------------------+  |
|  |   #41 Done     ||                                                        |
|  |   #40 Done     ||  +--------------------------------------------------+  |
|  |   X #39 Failed ||  | ACTIVE OPERATIONS (Pulsing)                       |  |
|  |   #38 Done     ||  | [Currently running commands with live updates]    |  |
|  +----------------+|  +--------------------------------------------------+  |
|                    |                                                        |
|  [Collapse <<]     |  +--------------------------------------------------+  |
|                    |  | STORY LIST                                        |  |
|                    |  | [Expandable story cards with command hierarchy]   |  |
|                    |  +--------------------------------------------------+  |
|                    |                                                        |
+--------------------+--------------------------------------------------------+
```

### 1.3 Responsive Behavior

| Breakpoint | Sidebar Behavior | Main Content |
|------------|------------------|--------------|
| >= 1200px  | Visible, 240px fixed | Full width remaining |
| 900-1199px | Visible, 200px | Compressed content |
| < 900px    | Hidden, overlay on toggle | Full width |

### 1.4 Z-Index Hierarchy

| Layer | Z-Index | Components |
|-------|---------|------------|
| Base | 0 | Main content, cards |
| Elevated | 10 | Sidebar |
| Overlay | 100 | Mobile sidebar overlay |
| Modal | 1000 | Dialogs, context menus |
| Toast | 2000 | Notifications |

---

## 2. Component Specifications

### 2.1 Batch History Sidebar

**Purpose:** Persistent navigation to all batch runs (past and current)

**Structure:**
```
+--------------------+
| BATCH RUNS         |
| [Filter/Search]    |
+--------------------+
| * #42              |
|   Running          |
|   Cycle 2/5        |
|   Started 2h ago   |
+--------------------+
|   #41              |
|   Completed        |
|   5 cycles, 8 stories|
|   2h 27m           |
+--------------------+
|   #40              |
|   Completed        |
|   3 cycles, 5 stories|
|   1h 15m           |
+--------------------+
| [Load More...]     |
+--------------------+
| [<< Collapse]      |
+--------------------+
```

**Behavior:**
- Current batch always pinned at top with distinct styling
- Clicking a past batch loads it into main content area
- Infinite scroll pagination (20 batches per load)
- Collapse button shrinks to 48px icon strip showing only status indicators

**States:**
- Selected: Blue left border, subtle background tint
- Running: Amber pulsing indicator dot
- Completed: Green checkmark
- Failed/Stopped: Red X indicator

### 2.2 Batch Header

**Purpose:** Display current batch status and provide quick actions

**Structure:**
```
+------------------------------------------------------------------------+
|  Batch #42                                                              |
|  [*] Running  |  Started: 2:15 PM (2h 15m ago)  |  Cycle: 2/5          |
|                                                                         |
|  Progress: [========================================----------] 67%     |
|            3 stories done / 2 in progress / 1 pending                   |
+------------------------------------------------------------------------+
```

**Elements:**
- Batch ID (monospace, bold)
- Status badge with appropriate color and animation
- Start time with relative duration (updates every minute)
- Cycle progress as fraction
- Visual progress bar showing story completion
- Story counts by status

**Interactions:**
- Click batch ID to copy to clipboard
- Hover on progress bar shows story breakdown tooltip

### 2.3 Active Operations Section

**Purpose:** Real-time display of currently executing commands

**Structure:**
```
+------------------------------------------------------------------------+
| ACTIVE OPERATIONS                                              [2 active]|
+------------------------------------------------------------------------+
| +--------------------------------------------------------------------+ |
| | * 2a-3: dev-story                                                   | |
| |   [implement] ========================================----  3:42    | |
| |   "Writing authentication middleware for OAuth2..."                | |
| +--------------------------------------------------------------------+ |
| +--------------------------------------------------------------------+ |
| | * 3b-1: code-review [background]                                    | |
| |   [review-2] =======================================-------  1:22    | |
| |   "Analyzing code patterns..."                                      | |
| +--------------------------------------------------------------------+ |
+------------------------------------------------------------------------+
```

**Each Operation Card:**
- Story key (clickable to expand story)
- Command type badge with color
- Progress bar with shimmer animation (indeterminate)
- Running timer (MM:SS format, updates every second)
- Latest message from command:progress events
- Background task indicator when applicable

**Animation:**
- Entire card has subtle pulsing glow effect
- Progress bar has moving shimmer
- Timer increments smoothly

### 2.4 Story List Section

**Purpose:** Display all stories in current batch with expandable details

**Structure (Collapsed):**
```
+------------------------------------------------------------------------+
| > 2a-1: User Authentication Setup                             [done] 8m|
+------------------------------------------------------------------------+
| > 2a-2: OAuth2 Integration                                    [done]12m|
+------------------------------------------------------------------------+
| v 2a-3: Session Management                              [in-progress]  |
|   +----------------------------------------------------------------+   |
|   | [create-story]    2m 15s    done                               |   |
|   | [story-review]    3m 42s    done                               |   |
|   | [dev-story]       4:32      running *                          |   |
|   |   v [implement]   3:42      running *                          |   |
|   |     "Writing authentication middleware..."                      |   |
|   | [code-review]     --        pending                            |   |
|   +----------------------------------------------------------------+   |
+------------------------------------------------------------------------+
| > 3b-1: API Rate Limiting                                  [pending]   |
+------------------------------------------------------------------------+
```

**Hierarchy Levels:**
1. **Story Row** (always visible)
   - Expand/collapse chevron
   - Story key (monospace)
   - Story title
   - Status badge
   - Total duration or "--" if pending

2. **Command Row** (visible when story expanded)
   - Command type badge with color
   - Duration or timer if running
   - Status indicator
   - Expand chevron if has tasks

3. **Task Row** (visible when command expanded)
   - Task name
   - Duration or timer
   - Latest message

**Expansion Behavior:**
- Single-click expands/collapses
- Shift-click expands all nested levels
- Currently running items auto-expand on status change

### 2.5 Past Batch View

**Purpose:** Display completed batch details when selected from sidebar

**Structure:**
```
+------------------------------------------------------------------------+
| [<- Back to Current Batch]                                              |
+------------------------------------------------------------------------+
|  Batch #41  [Completed]                                                 |
|  Jan 23, 2026  2:15 PM - 4:42 PM (2h 27m)                              |
+------------------------------------------------------------------------+
| SUMMARY                                                                 |
| +----------------+----------------+----------------+----------------+   |
| | Cycles         | Stories        | Commands       | Duration       |   |
| | 5              | 8              | 42             | 2h 27m         |   |
| +----------------+----------------+----------------+----------------+   |
+------------------------------------------------------------------------+
| STORIES                                                                 |
| [Same expandable story list as current batch, but all completed]       |
+------------------------------------------------------------------------+
```

**Elements:**
- Back navigation button (returns to current batch)
- Batch metadata header
- Summary statistics cards
- Full story list with same expandable structure

---

## 3. Animation System

### 3.1 Animation Decision Matrix

| Animation | When Applied | Duration | Easing |
|-----------|--------------|----------|--------|
| Pulse Glow | Running operations | 2s infinite | ease-in-out |
| Progress Shimmer | Active progress bars | 2s infinite | linear |
| Completion Flash | Command/task ends successfully | 600ms | ease-out |
| Error Shake | Command/task fails | 500ms | ease-out |
| Expand/Collapse | Story/command expand | 300ms | ease-out |
| Connection Pulse | Connected indicator | 2s infinite | ease-in-out |
| Reconnecting Blink | Reconnecting state | 1s infinite | step |
| New Item Slide | New story/command appears | 300ms | ease-out |

### 3.2 Running Operation: Pulse Glow

**Purpose:** Indicate active execution with subtle energy

```css
.operation-running {
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
    border-color: rgba(59, 130, 246, 0.5);
  }
  50% {
    box-shadow: 0 0 16px 4px rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.8);
  }
}
```

### 3.3 Progress Bar: Shimmer Effect

**Purpose:** Show indeterminate progress with movement

```css
.progress-active {
  background: linear-gradient(
    90deg,
    #3b82f6 0%,
    #60a5fa 50%,
    #3b82f6 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s linear infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

### 3.4 Completion: Success Flash

**Purpose:** Brief celebration when command completes successfully

```css
.just-completed {
  animation: complete-flash 600ms ease-out forwards;
}

@keyframes complete-flash {
  0% {
    background-color: transparent;
    transform: scale(1);
  }
  30% {
    background-color: rgba(16, 185, 129, 0.2);
    transform: scale(1.01);
  }
  100% {
    background-color: transparent;
    transform: scale(1);
  }
}
```

### 3.5 Error: Shake Effect

**Purpose:** Draw attention to failures

```css
.error-shake {
  animation: shake 500ms ease-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-3px); }
  40%, 80% { transform: translateX(3px); }
}
```

### 3.6 Expand/Collapse: Smooth Transition

**Purpose:** Smooth reveal of nested content

```css
.expandable-content {
  overflow: hidden;
  transition: max-height 300ms ease-out, opacity 300ms ease-out;
}

.expandable-content.collapsed {
  max-height: 0;
  opacity: 0;
}

.expandable-content.expanded {
  max-height: 2000px; /* Large enough for content */
  opacity: 1;
}
```

### 3.7 Reduced Motion Support

**Critical:** Respect user preferences

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 4. Color System

### 4.1 Color Decision: Warm Anthropic Palette

**Selected:** Warm neutral palette inspired by Anthropic's design language (Section 5.1)

**Rationale:**
- Matches the Anthropic aesthetic users expect from Claude-related tools
- Warm colors reduce eye strain during long monitoring sessions
- High contrast ensures readability in varied lighting conditions
- Status colors are distinct and accessible

### 4.2 Base Colors

| Name | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Background | `#f7f6f3` | `--color-bg` | Page background |
| Surface | `#ffffff` | `--color-surface` | Cards, panels |
| Text Primary | `#37352f` | `--color-text` | Body text, headings |
| Text Secondary | `#787774` | `--color-text-secondary` | Labels, metadata, timestamps |
| Text Muted | `#9ca3af` | `--color-text-muted` | Disabled, placeholder |
| Border | `#e8e7e5` | `--color-border` | Dividers, card outlines |
| Border Hover | `#d1d0cd` | `--color-border-hover` | Interactive borders |

### 4.3 Status Colors

| Status | Color | Hex | CSS Variable | Animation |
|--------|-------|-----|--------------|-----------|
| Running | Blue | `#3b82f6` | `--color-running` | Pulse glow |
| Success | Emerald | `#10b981` | `--color-success` | Flash |
| Error | Red | `#ef4444` | `--color-error` | Shake |
| Warning | Amber | `#f59e0b` | `--color-warning` | None |
| Pending | Gray | `#9ca3af` | `--color-pending` | None |
| In Progress | Blue Light | `#60a5fa` | `--color-in-progress` | Shimmer |

### 4.4 Command Type Colors

| Command | Primary | Hex | Background | Hex |
|---------|---------|-----|------------|-----|
| create-story | Blue | `#3b82f6` | Blue Light | `#dbeafe` |
| story-review | Amber | `#f59e0b` | Amber Light | `#fef3c7` |
| create-tech-spec | Indigo | `#6366f1` | Indigo Light | `#e0e7ff` |
| tech-spec-review | Violet | `#8b5cf6` | Violet Light | `#ede9fe` |
| dev-story | Green | `#22c55e` | Green Light | `#dcfce7` |
| code-review | Purple | `#a855f7` | Purple Light | `#f3e8ff` |
| commit | Teal | `#14b8a6` | Teal Light | `#ccfbf1` |

### 4.5 Interactive State Colors

| State | Background | Border | Text |
|-------|------------|--------|------|
| Default | `transparent` | `#e8e7e5` | `#37352f` |
| Hover | `#f7f6f3` | `#d1d0cd` | `#37352f` |
| Active/Pressed | `#e8e7e5` | `#9ca3af` | `#37352f` |
| Selected | `#dbeafe` | `#3b82f6` | `#1e40af` |
| Disabled | `#f7f6f3` | `#e8e7e5` | `#9ca3af` |

---

## 5. Typography Scale

### 5.1 Font Stacks

**Primary (UI Text):**
```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;
```

**Monospace (Code, IDs, Durations):**
```css
--font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Fira Code',
             'Courier New', monospace;
```

### 5.2 Type Scale

| Name | Size | Line Height | Weight | Usage |
|------|------|-------------|--------|-------|
| `text-xs` | 11px | 16px | 400 | Timestamps, metadata |
| `text-sm` | 13px | 18px | 400 | Secondary info, labels |
| `text-base` | 14px | 20px | 400 | Body text, default |
| `text-lg` | 16px | 24px | 500 | Card titles |
| `text-xl` | 20px | 28px | 600 | Section headings |
| `text-2xl` | 24px | 32px | 600 | Page title |

### 5.3 Specific Typography Applications

| Element | Font | Size | Weight | Color | Notes |
|---------|------|------|--------|-------|-------|
| Batch ID | Mono | 16px | 600 | Primary | Clickable to copy |
| Story Key | Mono | 14px | 500 | Primary | e.g., "2a-3" |
| Story Title | Sans | 14px | 400 | Primary | Truncate with ellipsis |
| Command Badge | Sans | 12px | 500 | White | Uppercase |
| Duration | Mono | 13px | 400 | Secondary | Right-aligned |
| Running Timer | Mono | 14px | 500 | Running Blue | MM:SS format |
| Message | Sans | 13px | 400 | Secondary | Truncate, full on hover |
| Timestamp | Mono | 11px | 400 | Muted | Relative format |

---

## 6. Interaction Patterns

### 6.1 Click Behaviors

| Element | Single Click | Double Click |
|---------|--------------|--------------|
| Batch in Sidebar | Select and load batch | - |
| Story Row | Expand/collapse | - |
| Command Row | Expand/collapse | - |
| Batch ID | Copy to clipboard | - |
| Story Key | Copy to clipboard | Open story file |
| Duration | - | - |
| Message | Show full text tooltip | Copy message |

### 6.2 Hover Behaviors

| Element | Hover Effect |
|---------|--------------|
| Batch in Sidebar | Background tint, cursor pointer |
| Story Row | Background tint, show expand icon |
| Command Badge | Show command description tooltip |
| Duration | Show exact timestamps tooltip |
| Truncated Message | Show full message tooltip |
| Progress Bar | Show percentage tooltip |

### 6.3 Expand/Collapse Logic

**Default State:**
- All stories collapsed
- Running story auto-expanded
- Running command within story auto-expanded

**Expansion Rules:**
- Clicking chevron or row toggles expansion
- Shift+click expands all nested levels
- When command starts, its story auto-expands
- When command ends, remains expanded for 3 seconds, then can collapse

**Persistence:**
- Expansion state persists within session
- Reset when switching batches

### 6.4 Keyboard Navigation

| Key | Context | Action |
|-----|---------|--------|
| `ArrowUp/Down` | Story list | Navigate between stories |
| `ArrowLeft` | Story/command | Collapse current |
| `ArrowRight` | Story/command | Expand current |
| `Enter` | Story row | Toggle expansion |
| `Escape` | Anywhere | Collapse all / Go back to current batch |
| `H` | Anywhere | Toggle sidebar visibility |
| `R` | Anywhere | Force refresh data |
| `C` | On story | Copy story key |

### 6.5 Right-Click Context Menu

**On Story Row:**
```
+---------------------------+
| Copy Story Key            |
| Copy Full Identifier      |
+---------------------------+
| View Story File           |
| Open in Editor            |
+---------------------------+
| Expand All Commands       |
| Collapse All Commands     |
+---------------------------+
```

**On Batch (Sidebar):**
```
+---------------------------+
| View Batch Details        |
| Copy Batch ID             |
+---------------------------+
| Export Batch Summary      |
+---------------------------+
```

---

## 7. Real-time Updates

### 7.1 WebSocket Event Handling

**Connection Lifecycle:**
```
1. Initial Connect -> Receive full state hydration
2. Steady State -> Receive incremental events
3. Disconnect -> Show reconnecting indicator
4. Reconnect -> Receive missed events, reconcile state
```

### 7.2 Event to UI Mapping

| Event Type | UI Action |
|------------|-----------|
| `batch:start` | Create new batch in sidebar (selected), show in main content |
| `batch:end` | Update batch status, stop all animations, show summary |
| `cycle:start` | Update cycle counter, add new stories if needed |
| `cycle:end` | Update cycle counter |
| `command:start` | Add to Active Operations, auto-expand story, start timer |
| `command:progress` | Update message text in Active Operations |
| `command:end` | Flash animation, move from Active to completed, stop timer |
| `story:status` | Update story status badge, trigger appropriate animation |

### 7.3 Timer Updates

**Running Timer Behavior:**
- Start at 0:00 when command:start received
- Increment every second (client-side)
- Format: MM:SS (no hours for commands)
- Stop when command:end received
- Final duration comes from server (authoritative)

**Implementation:**
```javascript
// Client-side timer (not server-synced)
const startTimer = (commandId) => {
  const startTime = Date.now();
  timers[commandId] = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    updateTimerDisplay(commandId, formatDuration(elapsed));
  }, 1000);
};
```

### 7.4 State Reconciliation on Reconnect

**Strategy:**
1. On reconnect, request full state from server
2. Compare server batch ID with client batch ID
3. If different: full refresh
4. If same: merge events based on timestamp
5. Animate only truly new items

### 7.5 Connection Status Indicator

**Location:** Top-right of header

**States:**
| State | Icon | Color | Animation |
|-------|------|-------|-----------|
| Connected | Filled circle | Green `#10b981` | Subtle pulse |
| Connecting | Open circle | Gray `#9ca3af` | Spin |
| Reconnecting | Triangle | Amber `#f59e0b` | Blink |
| Disconnected | X | Red `#ef4444` | None |

**Hover Tooltip:** "Connected" / "Reconnecting (attempt 3)..." / "Disconnected - click to retry"

---

## 8. Past Batch List Design

### 8.1 Sidebar Batch Item Structure

```
+------------------------+
| [Status] #ID           |
| Status Label           |
| X cycles, Y stories    |
| Duration or "Running"  |
+------------------------+
```

### 8.2 Information Displayed per Batch

| Field | Format | Example |
|-------|--------|---------|
| Status Icon | Colored dot/icon | Green checkmark, amber dot |
| Batch ID | #N | #42 |
| Status Label | Text | "Completed", "Running", "Stopped" |
| Stats | "X cycles, Y stories" | "5 cycles, 8 stories" |
| Duration | HHh MMm or "Running" | "2h 27m" or "Running" |

### 8.3 Pagination

- Initial load: 20 most recent batches
- "Load More" button at bottom
- Infinite scroll alternative: auto-load when scrolled to bottom
- Visual indicator when loading more

### 8.4 Filtering (Future Enhancement)

- Filter by status (All, Completed, Failed, Running)
- Date range picker
- Search by batch ID

---

## 9. Implementation Notes

### 9.1 Technology Recommendations

| Layer | Recommendation | Rationale |
|-------|----------------|-----------|
| Frontend Framework | Existing (enhance) | Dashboard already uses HTMX, extend it |
| Animations | CSS Animations | No additional JS library needed |
| State Management | JavaScript object | Keep it simple, no Redux needed |
| WebSocket Client | Existing implementation | Already has reconnection logic |

### 9.2 CSS Architecture

**Approach:** CSS Custom Properties + BEM-like naming

```css
/* Variables in :root */
:root {
  --color-bg: #f7f6f3;
  --color-surface: #ffffff;
  /* ... all variables from Color System */
}

/* Component naming */
.batch-sidebar { }
.batch-sidebar__item { }
.batch-sidebar__item--selected { }
.batch-sidebar__item--running { }

.story-card { }
.story-card__header { }
.story-card__content { }
.story-card--expanded { }

.command-row { }
.command-row__badge { }
.command-row__duration { }
.command-row--running { }
```

### 9.3 HTML Structure Patterns

**Expandable Story:**
```html
<div class="story-card" data-story-key="2a-3" data-expanded="false">
  <div class="story-card__header" onclick="toggleStory(this)">
    <span class="story-card__chevron">></span>
    <span class="story-card__key">2a-3</span>
    <span class="story-card__title">Session Management</span>
    <span class="story-card__status story-card__status--in-progress">in-progress</span>
    <span class="story-card__duration">--</span>
  </div>
  <div class="story-card__content">
    <!-- Command rows here -->
  </div>
</div>
```

### 9.4 WebSocket Message Handlers

```javascript
const eventHandlers = {
  'batch:start': (data) => {
    addBatchToSidebar(data.batch);
    selectBatch(data.batch.id);
    renderBatchHeader(data.batch);
  },

  'command:start': (data) => {
    addActiveOperation(data);
    expandStory(data.story_key);
    startTimer(data.task_id);
  },

  'command:progress': (data) => {
    updateOperationMessage(data.task_id, data.message);
  },

  'command:end': (data) => {
    const el = getOperationElement(data.task_id);
    stopTimer(data.task_id);

    if (data.status === 'success') {
      el.classList.add('just-completed');
    } else {
      el.classList.add('error-shake');
    }

    setTimeout(() => {
      moveToCompleted(data);
    }, 600);
  }
};
```

### 9.5 Performance Considerations

1. **DOM Updates:** Batch DOM operations using requestAnimationFrame
2. **Event Throttling:** Debounce rapid command:progress events (max 1 update per 100ms)
3. **Virtual Scrolling:** For batches with >50 stories, consider virtualization
4. **Timer Precision:** Use setInterval for display, not requestAnimationFrame
5. **Memory:** Clean up timers and event listeners when components unmount

### 9.6 API Requirements (Backend)

**New Endpoints Needed:**

```
GET /api/batches
Query: ?limit=20&offset=0
Response: { batches: [...], total: number }

GET /api/batches/:id
Response: { batch: {...}, stories: [...], stats: {...} }
```

**WebSocket Enhancements:**

```javascript
// Client -> Server
{ type: "get_batch_history", limit: 20, offset: 0 }

// Server -> Client
{ type: "batch_history", batches: [...], total: number }
```

### 9.7 Accessibility Checklist

- [ ] All interactive elements have focus styles
- [ ] Keyboard navigation works for all actions
- [ ] ARIA labels on all buttons and interactive regions
- [ ] Live regions for real-time updates (aria-live="polite")
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Reduced motion preference respected
- [ ] Screen reader announces status changes

---

## 10. Design Assets Needed

### 10.1 Icons (Heroicons Solid)

| Icon Name | Usage |
|-----------|-------|
| `chevron-right` | Expand indicator |
| `chevron-down` | Collapse indicator |
| `check-circle` | Success status |
| `x-circle` | Error status |
| `clock` | Pending/time |
| `play` | Running/start |
| `stop` | Stop button |
| `arrow-left` | Back navigation |
| `cog` | Settings |
| `wifi` | Connection status |
| `document-text` | Story file |
| `clipboard-copy` | Copy action |

### 10.2 CSS File Structure

```
/static/css/
  dashboard/
    variables.css      # All CSS custom properties
    base.css           # Reset, typography
    layout.css         # Grid, sidebar, main content
    components/
      sidebar.css      # Batch history sidebar
      batch-header.css # Current batch header
      active-ops.css   # Active operations section
      story-card.css   # Story list components
      command-row.css  # Command hierarchy
      badges.css       # Status badges
      buttons.css      # Control buttons
    animations.css     # All keyframe animations
    utilities.css      # Helper classes
```

---

## Appendix A: Complete CSS Variables

```css
:root {
  /* Colors - Base */
  --color-bg: #f7f6f3;
  --color-surface: #ffffff;
  --color-text: #37352f;
  --color-text-secondary: #787774;
  --color-text-muted: #9ca3af;
  --color-border: #e8e7e5;
  --color-border-hover: #d1d0cd;

  /* Colors - Status */
  --color-running: #3b82f6;
  --color-success: #10b981;
  --color-error: #ef4444;
  --color-warning: #f59e0b;
  --color-pending: #9ca3af;
  --color-in-progress: #60a5fa;

  /* Colors - Commands */
  --color-cmd-create-story: #3b82f6;
  --color-cmd-story-review: #f59e0b;
  --color-cmd-create-tech-spec: #6366f1;
  --color-cmd-tech-spec-review: #8b5cf6;
  --color-cmd-dev-story: #22c55e;
  --color-cmd-code-review: #a855f7;
  --color-cmd-commit: #14b8a6;

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Fira Code', 'Courier New', monospace;

  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 24px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.12);

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-full: 9999px;

  /* Animation */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --easing-default: ease-out;

  /* Layout */
  --sidebar-width: 240px;
  --sidebar-collapsed: 48px;
  --header-height: 56px;
}
```

---

## Appendix B: Figma Component Checklist

For design handoff, create these Figma components:

- [ ] Batch Sidebar Item (Default, Selected, Running, Completed, Failed)
- [ ] Batch Header (Running, Completed, Stopped)
- [ ] Active Operation Card (Running, just completed)
- [ ] Story Card (Collapsed, Expanded, Running, Completed)
- [ ] Command Row (All command types, all states)
- [ ] Task Row (Running, Completed, Failed)
- [ ] Status Badge (All statuses)
- [ ] Command Badge (All command types)
- [ ] Progress Bar (Determinate, Indeterminate)
- [ ] Connection Indicator (All states)
- [ ] Buttons (Start, Stop, Settings)
- [ ] Context Menu
- [ ] Tooltips

---

*Document finalized: January 24, 2026*
*Ready for implementation*
