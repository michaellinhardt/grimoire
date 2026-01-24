# Sprint Runner Dashboard - UI/UX Research Brainstorm

> A comprehensive design exploration for elevating the Sprint Run tab to Apple/Anthropic quality standards

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Design Philosophy & Inspiration](#2-design-philosophy--inspiration)
3. [Information Architecture](#3-information-architecture)
4. [Layout Concepts](#4-layout-concepts)
5. [Visual Design System](#5-visual-design-system)
6. [Animation & Motion Design](#6-animation--motion-design)
7. [Real-time Updates Strategy](#7-real-time-updates-strategy)
8. [Interaction Patterns](#8-interaction-patterns)
9. [Accessibility Considerations](#9-accessibility-considerations)
10. [Implementation Roadmap](#10-implementation-roadmap)

---

## 1. Current State Analysis

### 1.1 Existing Data Model

The Sprint Runner Dashboard tracks a rich hierarchy of workflow data:

```
Batch
├── id, started_at, ended_at, max_cycles, cycles_completed, status
│
├── Stories[]
│   ├── story_key, epic_id, status, started_at, ended_at
│   │
│   └── Commands[]
│       ├── command, task_id, started_at, ended_at, status
│       └── Events[]
│           └── timestamp, status, message
│
└── Background Tasks[]
    └── task_type, spawned_at, completed_at, status
```

### 1.2 Event Types Tracked

| Event | Description | Data Available |
|-------|-------------|----------------|
| `batch:start` | New batch initiated | batch_id, max_cycles, batch_mode |
| `batch:end` | Batch completed/stopped | batch_id, cycles_completed, status |
| `cycle:start` | New cycle begins | cycle_number, story_keys |
| `cycle:end` | Cycle completes | cycle_number, completed_stories |
| `command:start` | Command execution begins | story_key, command, task_id |
| `command:progress` | Mid-command update | story_key, command, task_id, message |
| `command:end` | Command completes | story_key, command, task_id, status |
| `story:status` | Story status change | story_key, old_status, new_status |
| `context:create/refresh/complete` | Project context lifecycle | Various |

### 1.3 Current UI Pain Points

1. **Flat Event Log**: Events displayed as terminal-style log entries without hierarchy
2. **No Batch History**: Only current batch visible; past runs not accessible
3. **Limited Command Visibility**: Individual commands/tasks not expandable
4. **No Time Tracking Visualization**: Durations shown as text only
5. **Basic Progress Indicators**: Simple text status, no visual progress
6. **Missing Contextual Actions**: No ability to inspect artifacts, retry, or drill down
7. **No Filtering/Search**: Can't find specific events or stories

### 1.4 WebSocket Architecture

The current implementation uses aiohttp WebSockets with:
- Auto-reconnect with exponential backoff
- Initial state hydration on connect
- Heartbeat/ping-pong for connection health
- Broadcast to all connected clients

---

## 2. Design Philosophy & Inspiration

### 2.1 Apple Design Principles

| Principle | Application |
|-----------|-------------|
| **Clarity** | Text is legible, icons precise, decorations subtle |
| **Deference** | UI recedes, content takes center stage |
| **Depth** | Visual layers and realistic motion provide hierarchy |
| **Consistency** | Familiar patterns reduce cognitive load |
| **Direct Manipulation** | Objects respond immediately to interaction |
| **Feedback** | Every action acknowledged with immediate response |

### 2.2 Anthropic Claude Design Language

| Element | Characteristics |
|---------|-----------------|
| **Colors** | Warm neutrals, orange accents, high contrast |
| **Typography** | Clean sans-serif, generous spacing |
| **Cards** | Soft shadows, subtle borders, rounded corners |
| **Animations** | Purposeful, never gratuitous, physics-based |
| **Information Density** | Progressive disclosure, expandable sections |

### 2.3 Design Vision Statement

> "A dashboard that feels alive - where every running operation pulses with energy, completed work celebrates itself briefly, and the entire system state is comprehensible at a glance while offering unlimited depth for investigation."

---

## 3. Information Architecture

### 3.1 Primary View: Current Batch

The default view should prioritize the active batch with:

```
┌─────────────────────────────────────────────────────────────────┐
│  BATCH HEADER                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Batch #42  ●  Running  │  Started 2h 15m ago  │  2/5 cycles │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  EPIC/STORY CARDS (Horizontal Scroll)                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ Epic 2a │ │ Epic 3b │ │ Epic 5  │ │ ...     │               │
│  │ ●●●○○   │ │ ●●○○○   │ │ ○○○○○   │ │         │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                 │
│  ACTIVE OPERATIONS (Live)                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ ▶ 2a-3: dev-story / implement ████████████░░░░░  [3:42]     │ │
│  │   └─ Writing authentication middleware...                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  TIMELINE / COMMAND HISTORY                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [Expandable command/task hierarchy]                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Batch History Sidebar/Drawer

```
┌───────────────┐
│ BATCH RUNS    │
├───────────────┤
│ ● #42 Running │ ← Current
│ ✓ #41 5 cycles│
│ ✓ #40 3 cycles│
│ ✗ #39 Stopped │
│ ✓ #38 2 cycles│
│ ...           │
└───────────────┘
```

### 3.3 Batch Detail View (Click on Past Batch)

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Back to Current Batch                                            │
│                                                                    │
│ BATCH #41  ✓ Completed                                             │
│ Jan 23, 2026 2:15 PM - 4:42 PM (2h 27m)                           │
│                                                                    │
│ SUMMARY                                                            │
│ ┌─────────┬─────────┬─────────┬─────────┐                         │
│ │ Cycles  │ Stories │ Commands│ Time    │                         │
│ │    5    │    8    │   42    │ 2h 27m  │                         │
│ └─────────┴─────────┴─────────┴─────────┘                         │
│                                                                    │
│ STORIES COMPLETED                                                  │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ [Story cards with full command breakdown]                      │ │
│ └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### 3.4 Story Deep Dive

```
┌────────────────────────────────────────────────────────────────────┐
│ STORY 2a-3: User Authentication                                    │
│ Epic: 2a (Security Features)  │  Status: done  │  Duration: 18m   │
│                                                                    │
│ COMMANDS                                                           │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ ▼ create-story                           ✓ 2m 15s           │   │
│ │   ├─ setup                               ✓ 12s              │   │
│ │   ├─ analyze                             ✓ 45s              │   │
│ │   ├─ generate                            ✓ 58s              │   │
│ │   └─ validate                            ✓ 20s              │   │
│ ├──────────────────────────────────────────────────────────────│   │
│ │ ▼ story-review                           ✓ 3m 42s           │   │
│ │   ├─ review-1 (sonnet)                   ✓ 2m 10s           │   │
│ │   │   └─ Message: "No critical issues found"                │   │
│ │   └─ review-2 (haiku) [background]       ✓ 1m 32s           │   │
│ ├──────────────────────────────────────────────────────────────│   │
│ │ ▼ dev-story                              ✓ 8m 22s           │   │
│ │   ├─ setup                               ✓ 8s               │   │
│ │   ├─ implement                           ✓ 6m 45s           │   │
│ │   ├─ tests                               ✓ 1m 12s           │   │
│ │   └─ validate                            ✓ 17s              │   │
│ ├──────────────────────────────────────────────────────────────│   │
│ │ ▼ code-review                            ✓ 3m 45s           │   │
│ │   ├─ code-review-1                       ⚠ HIGH (2 issues)  │   │
│ │   └─ code-review-2                       ✓ ZERO issues      │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ MESSAGES / OUTPUT                                                  │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ [Expandable message log for each task]                       │   │
│ └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. Layout Concepts

### 4.1 Split Panel Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SPRINT RUN                                     │
├─────────────────┬───────────────────────────────────────────────────────┤
│                 │                                                       │
│  BATCH LIST     │              MAIN CONTENT                             │
│  (Collapsible)  │                                                       │
│                 │  ┌─────────────────────────────────────────────────┐  │
│  ● #42 Running  │  │ Batch Header with Controls                     │  │
│  ✓ #41 Done     │  ├─────────────────────────────────────────────────┤  │
│  ✓ #40 Done     │  │                                                 │  │
│  ✗ #39 Stopped  │  │ Currently Active Section                        │  │
│                 │  │ (Pulsing, animated)                             │  │
│                 │  │                                                 │  │
│                 │  ├─────────────────────────────────────────────────┤  │
│                 │  │                                                 │  │
│                 │  │ Command/Story Detail Area                       │  │
│                 │  │ (Expandable hierarchy)                          │  │
│                 │  │                                                 │  │
│                 │  └─────────────────────────────────────────────────┘  │
└─────────────────┴───────────────────────────────────────────────────────┘
```

### 4.2 Stacked Card Layout (Mobile-First)

```
┌─────────────────────────────────────────┐
│ CONTROLS                                │
│ [▶ Start] [■ Stop]  Batch: [2] [□ All]  │
├─────────────────────────────────────────┤
│ CURRENT BATCH #42  ●                    │
│ Running • Cycle 2/5 • 3 stories         │
│ ████████████████████░░░░░ 67%           │
├─────────────────────────────────────────┤
│ NOW RUNNING                             │
│ ┌─────────────────────────────────────┐ │
│ │ 2a-3: dev-story                     │ │
│ │ ████████████░░░░░░░░░ 3:42          │ │
│ │ "Writing auth middleware..."        │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ COMPLETED THIS BATCH                    │
│ ┌─────────────────────────────────────┐ │
│ │ 2a-1: create-story ✓       2m 15s  │ │
│ │ 2a-2: story-review ✓       3m 42s  │ │
│ │ [Tap to expand]                     │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ PAST BATCHES                            │
│ ▶ #41 - 5 cycles - 2h 27m              │
│ ▶ #40 - 3 cycles - 1h 15m              │
└─────────────────────────────────────────┘
```

### 4.3 Timeline-Centric Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ BATCH #42  [▶ Running]                      [Cycle 2/5]   [← History →] │
├─────────────────────────────────────────────────────────────────────────┤
│ TIMELINE                                                                │
│                                                                         │
│  2:00 PM              2:30 PM              3:00 PM              NOW     │
│  │                    │                    │                    ▼       │
│  ├────────────────────┴────────────────────┴────────────────────┤       │
│                                                                         │
│  2a-1 ████████████████████████                                          │
│  2a-2          █████████████████████████                                │
│  2a-3                       ████████████████████▓▓▓▓▓▓                  │
│                                              └─ In progress             │
│                                                                         │
│  Legend: [create-story] [review] [dev-story] [code-review]              │
└─────────────────────────────────────────────────────────────────────────┘

Click on any bar to expand:

┌─────────────────────────────────────────────────────────────────────────┐
│  2a-3 ▼                                                                 │
│  │                                                                      │
│  ├─ create-story     ████                                               │
│  ├─ story-review          █████                                         │
│  ├─ dev-story                   ████████████▓▓▓▓                        │
│  └─ code-review                              (pending)                  │
│                                                                         │
│  Expand dev-story:                                                      │
│  ├─ setup        █                                                      │
│  ├─ implement    ████████████▓▓▓▓  ← Active                            │
│  ├─ tests        (pending)                                              │
│  └─ validate     (pending)                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Visual Design System

### 5.1 Color Palette

#### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Background | `#f7f6f3` | Page background |
| Surface | `#ffffff` | Cards, panels |
| Text Primary | `#37352f` | Body text |
| Text Secondary | `#787774` | Labels, metadata |
| Border | `#e8e7e5` | Dividers, outlines |

#### Status Colors
| Status | Color | Hex | Animation |
|--------|-------|-----|-----------|
| Running | Amber | `#f59e0b` | Pulse glow |
| Success | Emerald | `#10b981` | Brief flash |
| Error | Red | `#ef4444` | Shake + glow |
| Pending | Gray | `#9ca3af` | None |
| In Progress | Blue | `#3b82f6` | Shimmer |

#### Command Type Colors
| Command | Color | Hex |
|---------|-------|-----|
| create-story | Blue | `#3b82f6` |
| story-review | Amber | `#f59e0b` |
| create-tech-spec | Indigo | `#6366f1` |
| tech-spec-review | Violet | `#8b5cf6` |
| dev-story | Green | `#22c55e` |
| code-review | Purple | `#a855f7` |
| commit | Teal | `#14b8a6` |

### 5.2 Typography

```css
/* Primary Font Stack */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;

/* Monospace (for code, durations, IDs) */
font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Courier New', monospace;

/* Scale */
--text-xs: 11px;    /* Labels, metadata */
--text-sm: 13px;    /* Secondary text */
--text-base: 14px;  /* Body text */
--text-lg: 16px;    /* Headings */
--text-xl: 20px;    /* Section titles */
--text-2xl: 24px;   /* Page title */
```

### 5.3 Spacing System

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

### 5.4 Shadow System

```css
/* Elevation levels */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 4px 8px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.12);

/* Interactive states */
--shadow-hover: 0 8px 24px rgba(0, 0, 0, 0.10);
--shadow-active: 0 2px 4px rgba(0, 0, 0, 0.08);
```

### 5.5 Border Radius

```css
--radius-sm: 4px;   /* Buttons, badges */
--radius-md: 6px;   /* Small cards */
--radius-lg: 8px;   /* Cards, panels */
--radius-xl: 12px;  /* Large containers */
--radius-full: 9999px; /* Pills, avatars */
```

---

## 6. Animation & Motion Design

### 6.1 Running Operation Animations

#### Pulsing Glow Effect
```css
.operation-running {
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  50% {
    box-shadow: 0 0 20px 4px rgba(59, 130, 246, 0.2);
  }
}
```

#### Progress Bar Shimmer
```css
.progress-bar-running {
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

#### Striped Progress (In Progress)
```css
.in-progress-stripe {
  background: repeating-linear-gradient(
    45deg,
    #fbbf24,
    #fbbf24 10px,
    #f59e0b 10px,
    #f59e0b 20px
  );
  animation: stripe-scroll 1s linear infinite;
}

@keyframes stripe-scroll {
  0% { background-position: 0 0; }
  100% { background-position: 28px 0; }
}
```

### 6.2 Status Transition Animations

#### Completion Celebration
```css
.just-completed {
  animation: complete-flash 0.6s ease-out;
}

@keyframes complete-flash {
  0% {
    background-color: #d1fae5;
    transform: scale(1);
  }
  30% {
    background-color: #10b981;
    transform: scale(1.02);
  }
  100% {
    background-color: transparent;
    transform: scale(1);
  }
}
```

#### Error Shake
```css
.error-shake {
  animation: shake 0.5s ease-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
```

### 6.3 Expand/Collapse Animations

```css
.expand-content {
  animation: expand 0.3s ease-out forwards;
  overflow: hidden;
}

@keyframes expand {
  from {
    max-height: 0;
    opacity: 0;
  }
  to {
    max-height: 1000px;
    opacity: 1;
  }
}

.collapse-content {
  animation: collapse 0.2s ease-in forwards;
  overflow: hidden;
}

@keyframes collapse {
  from {
    max-height: 1000px;
    opacity: 1;
  }
  to {
    max-height: 0;
    opacity: 0;
  }
}
```

### 6.4 Loading States

#### Skeleton Loader
```css
.skeleton {
  background: linear-gradient(
    90deg,
    #f0efed 25%,
    #e8e7e5 50%,
    #f0efed 75%
  );
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

#### Spinning Indicator
```css
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e8e7e5;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 6.5 Connection Status Animation

```css
.connected-pulse {
  animation: connected-pulse 2s infinite;
}

@keyframes connected-pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
  }
}

.reconnecting-blink {
  animation: reconnect-blink 1s infinite;
}

@keyframes reconnect-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}
```

---

## 7. Real-time Updates Strategy

### 7.1 WebSocket Event Flow

```
Server                          Client
  │                               │
  │   ← WebSocket Connect →       │
  │   {"type": "init", ...}       │
  │ ─────────────────────────────→│ Hydrate initial state
  │                               │
  │   {"type": "batch:start"}     │
  │ ─────────────────────────────→│ Show new batch card
  │                               │ Animate batch appearing
  │   {"type": "cycle:start"}     │
  │ ─────────────────────────────→│ Update cycle counter
  │                               │ Show active stories
  │   {"type": "command:start"}   │
  │ ─────────────────────────────→│ Add to active operations
  │                               │ Start progress animation
  │   {"type": "command:progress"}│
  │ ─────────────────────────────→│ Update message text
  │                               │ Keep animation running
  │   {"type": "command:end"}     │
  │ ─────────────────────────────→│ Move to completed
  │                               │ Flash success animation
  │   ...                         │
```

### 7.2 Optimistic UI Updates

```javascript
// When command starts, immediately show it running
function handleCommandStart(event) {
  // 1. Add to active operations immediately
  addActiveOperation(event.payload);

  // 2. Start timer animation
  startOperationTimer(event.payload.story_key);

  // 3. Update story card status
  updateStoryStatus(event.payload.story_key, 'in-progress');
}

// When command ends, transition smoothly
function handleCommandEnd(event) {
  // 1. Stop timer
  stopOperationTimer(event.payload.story_key);

  // 2. Flash success/error based on status
  if (event.payload.status === 'success') {
    flashSuccess(event.payload);
  } else {
    flashError(event.payload);
  }

  // 3. Move from active to completed (after animation)
  setTimeout(() => {
    moveToCompleted(event.payload);
  }, 600);
}
```

### 7.3 State Reconciliation

On reconnect, reconcile server state with client:

```javascript
function reconcileState(serverState) {
  const clientBatch = getCurrentBatch();
  const serverBatch = serverState.batch;

  if (!serverBatch) {
    // No active batch - reset UI
    clearActiveBatch();
    return;
  }

  if (clientBatch?.id !== serverBatch.id) {
    // Different batch - full refresh
    loadBatch(serverBatch);
    return;
  }

  // Same batch - incremental update
  // Find new events we missed
  const lastKnownEvent = getLastEventTimestamp();
  const missedEvents = serverState.events
    .filter(e => e.timestamp > lastKnownEvent);

  // Replay missed events
  missedEvents.forEach(processEvent);
}
```

### 7.4 Debouncing & Batching

For high-frequency updates:

```javascript
const eventBuffer = [];
let flushTimeout = null;

function bufferEvent(event) {
  eventBuffer.push(event);

  if (!flushTimeout) {
    flushTimeout = requestAnimationFrame(() => {
      flushEvents();
      flushTimeout = null;
    });
  }
}

function flushEvents() {
  // Group events by type for batch DOM updates
  const grouped = groupBy(eventBuffer, 'type');

  // Apply updates in priority order
  if (grouped['command:end']) {
    updateCompletedCommands(grouped['command:end']);
  }
  if (grouped['command:progress']) {
    updateProgressMessages(grouped['command:progress']);
  }
  if (grouped['command:start']) {
    addActiveCommands(grouped['command:start']);
  }

  eventBuffer.length = 0;
}
```

---

## 8. Interaction Patterns

### 8.1 Batch History Navigation

```
[Current Batch (Default View)]
         │
         ▼ Click batch in sidebar
[Past Batch View]
         │
         ▼ Click story card
[Story Detail View]
         │
         ▼ Click command row
[Command Detail with Messages]
         │
         ▼ "← Back" button or breadcrumb
[Parent View]
```

### 8.2 Expandable Hierarchy

Each level can expand independently:

```
▼ Story 2a-3 (Total: 18m 22s)
  │
  ├─ ▶ create-story (2m 15s) ← Collapsed
  │
  ├─ ▼ story-review (3m 42s) ← Expanded
  │   ├─ setup: 12s ✓
  │   ├─ analyze: 45s ✓ "Scanning requirements..."
  │   ├─ review: 2m 10s ✓ "No critical issues"
  │   └─ validate: 35s ✓
  │
  ├─ ▶ dev-story (8m 22s)
  │
  └─ ▶ code-review (4m 03s)
```

### 8.3 Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑/↓` | Navigate between items |
| `←/→` | Collapse/Expand |
| `Enter` | Select/Open |
| `Esc` | Go back / Close |
| `Space` | Toggle selection |
| `H` | Toggle batch history |
| `R` | Refresh data |

### 8.4 Context Menu (Right-Click)

```
┌─────────────────────────┐
│ 📋 Copy Story ID        │
│ 📄 View Story File      │
│ 📁 Open in Finder       │
│ ──────────────────────── │
│ 🔄 Retry Story          │
│ ⏭ Skip to Next         │
│ ──────────────────────── │
│ 📊 Export Timeline      │
└─────────────────────────┘
```

### 8.5 Touch/Mobile Gestures

| Gesture | Action |
|---------|--------|
| Tap | Select item |
| Long press | Context menu |
| Swipe left | Quick actions |
| Swipe right | Go back |
| Pinch | Zoom timeline |
| Two-finger scroll | Horizontal pan |

---

## 9. Accessibility Considerations

### 9.1 ARIA Landmarks

```html
<main role="main" aria-label="Sprint Runner Dashboard">
  <nav role="navigation" aria-label="Batch History">
    <!-- Batch list -->
  </nav>

  <section role="region" aria-label="Active Batch">
    <h2>Batch #42</h2>
    <!-- Batch content -->
  </section>

  <section role="log" aria-live="polite" aria-label="Event Log">
    <!-- Real-time events -->
  </section>
</main>
```

### 9.2 Screen Reader Announcements

```javascript
// Announce important state changes
function announceToScreenReader(message, priority = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

// Usage
handleCommandEnd = (event) => {
  announceToScreenReader(
    `${event.payload.story_key} ${event.payload.command} completed in ${event.payload.duration}`
  );
};
```

### 9.3 Focus Management

```javascript
// Trap focus within modals
function trapFocus(container) {
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  container.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}
```

### 9.4 Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .pulse-glow,
  .shimmer,
  .stripe-scroll {
    animation: none !important;
  }
}
```

### 9.5 Color Contrast

Ensure all text meets WCAG AA standards:

| Context | Foreground | Background | Ratio |
|---------|------------|------------|-------|
| Body text | `#37352f` | `#ffffff` | 12.6:1 |
| Secondary text | `#787774` | `#ffffff` | 4.7:1 |
| Labels on dark | `#ffffff` | `#37352f` | 12.6:1 |
| Error on light | `#b91c1c` | `#fef2f2` | 5.2:1 |
| Success on light | `#047857` | `#d1fae5` | 4.8:1 |

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Week 1)

1. **Database Queries for History**
   - Add `get_all_batches(limit, offset)` function
   - Add `get_batch_summary(batch_id)` for stats
   - Index optimization for batch queries

2. **Batch History UI**
   - Sidebar component for batch list
   - Click to load batch details
   - Visual indicators for status

3. **Enhanced State Management**
   - Client-side batch cache
   - Navigation state (current view, selected items)
   - UI state persistence

### Phase 2: Detail Views (Week 2)

1. **Story Detail Component**
   - Expandable command hierarchy
   - Task-level breakdown
   - Message display

2. **Command/Task Visualization**
   - Color-coded command types
   - Duration bars
   - Status indicators

3. **Keyboard Navigation**
   - Arrow key navigation
   - Enter/Space selection
   - Escape to go back

### Phase 3: Real-time Polish (Week 3)

1. **Enhanced Animations**
   - Running operation glow
   - Completion celebration
   - Smooth expand/collapse

2. **Progress Indicators**
   - Shimmer for active tasks
   - Striped bars for in-progress
   - Timer counters

3. **Connection Handling**
   - Reconnection UI
   - Offline state
   - State reconciliation

### Phase 4: Advanced Features (Week 4)

1. **Timeline Integration**
   - Story timeline within batch view
   - Zoom/pan controls
   - Task-level timeline bars

2. **Filtering & Search**
   - Filter by status
   - Search events
   - Date range selection

3. **Export & Actions**
   - Export batch summary
   - Copy story IDs
   - Quick actions

### Phase 5: Accessibility & Polish (Week 5)

1. **ARIA & Screen Readers**
   - Proper landmarks
   - Live regions
   - Focus management

2. **Motion Preferences**
   - Reduced motion support
   - Animation controls

3. **Mobile Optimization**
   - Responsive layout
   - Touch gestures
   - Performance tuning

---

## Appendix A: Component Inventory

| Component | Priority | Complexity | Dependencies |
|-----------|----------|------------|--------------|
| BatchHistorySidebar | High | Medium | db.py queries |
| BatchDetailCard | High | Low | None |
| StoryExpandableCard | High | Medium | BatchDetailCard |
| CommandHierarchy | High | High | StoryExpandableCard |
| TaskRow | Medium | Low | CommandHierarchy |
| ActiveOperationCard | High | Medium | WebSocket |
| ProgressBar | High | Low | CSS only |
| AnimatedStatusBadge | Medium | Low | CSS only |
| TimelineBar | Low | High | Timeline tab |
| ConnectionIndicator | High | Low | WebSocket |
| BreadcrumbNav | Medium | Low | Router |
| FilterPanel | Low | Medium | State |
| SearchInput | Low | Medium | State |

---

## Appendix B: API Additions Needed

### New REST Endpoints

```
GET /api/batches
  Query: ?limit=20&offset=0
  Response: { batches: [...], total: number }

GET /api/batches/:id
  Response: { batch: {...}, stories: [...], stats: {...} }

GET /api/batches/:id/events
  Query: ?limit=100&offset=0
  Response: { events: [...], total: number }

GET /api/stories/:story_key/commands
  Response: { commands: [...] }
```

### New WebSocket Events

```
// Client → Server
{ type: "subscribe:batch", batch_id: number }
{ type: "unsubscribe:batch", batch_id: number }

// Server → Client (new)
{ type: "batch:update", payload: { batch_id, field, value } }
```

---

## Appendix C: Figma/Design Asset Suggestions

1. **Icon Set**: Use Heroicons (MIT) or custom SF Symbols-style
2. **Illustrations**: Consider Anthropic's warm illustration style for empty states
3. **Motion**: Framer Motion or CSS animations library
4. **Charts**: Consider lightweight charting for time analytics

---

*Document created: January 24, 2026*
*Author: UI/UX Research Agent*
*Version: 1.0.0*
