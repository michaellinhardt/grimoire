# Sprint Runner Dashboard - Implementation Epics

> BMAD Epic File for Dashboard Enhancement Implementation

**Version:** 1.0.0
**Created:** 2026-01-24
**Status:** READY FOR IMPLEMENTATION
**Total Estimated Time:** 6-7 hours (including testing buffer)

---

## Epic Overview

| Epic | Title | Stories | Priority | Dependencies |
|------|-------|---------|----------|--------------|
| E1 | Critical Bug Fixes | 5 | CRITICAL | None |
| E2 | Layout Architecture | 4 | HIGH | E1 |
| E3 | Component System | 6 | HIGH | E2 |
| E4 | Animation System | 4 | MEDIUM | E3 |
| E5 | Batch History | 4 | MEDIUM | E3 |
| E6 | Real-time Updates | 5 | MEDIUM | E3, E4 |

---

## Epic 1: Critical Bug Fixes

**Priority:** CRITICAL
**Estimated Time:** 1.5 hours
**Goal:** Fix blocking issues identified in HAIKU-REVIEW.md and PLAN-UNIFIED-ORDER.md Phase 1

### E1-S1: Database Schema Migration

**Title:** Consolidate database schema changes into single migration

**Description:**
Combine all schema changes (FK constraint, event_type column, timestamp standardization) into a single atomic migration. Addresses HAIKU-REVIEW issue #1 (Phase 1 logical flaw) and PLAN-UNIFIED-ORDER Phase 1.

**Acceptance Criteria:**
- [ ] Add `VALID_STORY_STATUSES` constant to db.py (line ~33)
- [ ] Add FK constraint on `batch_id` column
- [ ] Add `event_type` column to events table
- [ ] Convert all timestamps to milliseconds (13 digits)
- [ ] Add status validation to `update_story()` function
- [ ] Existing `sprint-runner.db` is backed up before deletion
- [ ] New schema creates successfully on server restart
- [ ] Verify timestamps are ~13 digits via SQL query

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py`
  - Lines: 33 (add constant), 176, 267, 378, 470, 540 (timestamps)

**Technical Notes:**
- Parameter order in tuples must match schema column order
- Run: `grep -n "create_event(" orchestrator.py` to verify exactly 3 locations

---

### E1-S2: Update create_event() Callers

**Title:** Update all create_event() calls with new event_type parameter

**Description:**
After schema migration adds `event_type` column, all `create_event()` callers must be updated. Addresses PLAN-UNIFIED-ORDER Phase 2.2.

**Acceptance Criteria:**
- [ ] Update `create_event()` call at lines 502-512
- [ ] Update `create_event()` call at lines 534-544
- [ ] Update `create_event()` call at lines 888-898
- [ ] Each call includes appropriate `event_type` value
- [ ] Verification: `grep -n "create_event(" orchestrator.py` shows all 3 updated
- [ ] Server starts without errors
- [ ] Events written to DB have `event_type` populated

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`
  - Lines: 502-512, 534-544, 888-898

**Depends On:** E1-S1

---

### E1-S3: Fix Logging Pipeline CSV Output

**Title:** Fix sprint-log.sh to output CSV format for orchestrator parsing

**Description:**
The logging script outputs to file but orchestrator expects CSV on stdout. Fix the output format and ensure proper escaping. Addresses PLAN-PROMPTS-SCRIPTS Fix 1.1 and HAIKU-REVIEW issue #5.

**Acceptance Criteria:**
- [ ] sprint-log.sh outputs CSV to stdout
- [ ] sprint-log.sh writes human-readable format to log file
- [ ] CSV format: `timestamp,epicID,storyID,command,task-id,status,"message"`
- [ ] Messages with quotes are properly escaped
- [ ] Messages with newlines are handled
- [ ] Test command passes: `echo '{"epic_id":"2a",...}' | sprint-log.sh`
- [ ] Add edge case test with `"Test with \"quotes\" and\nnewlines"`

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh`

**Technical Notes:**
- Use absolute paths in test commands: `/Users/teazyou/dev/grimoire/_bmad/...`

---

### E1-S4: Fix Command Names in Log Calls

**Title:** Standardize command names to use sprint- prefix

**Description:**
All log calls in instructions.xml files must use `sprint-` prefixed command names matching task-taxonomy.yaml. Addresses PLAN-PROMPTS-SCRIPTS Fix 1.2.

**Acceptance Criteria:**
- [ ] All `"command":` values use `sprint-` prefix
- [ ] Command names match task-taxonomy.yaml entries
- [ ] Verification: `grep -r '"command":' commands/ | grep -v sprint-` returns nothing
- [ ] Log parsing works end-to-end

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story/instructions.xml`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-dev-story/instructions.xml`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-code-review/instructions.xml`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-story-review/instructions.xml`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-tech-spec-review/instructions.xml`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-commit/instructions.xml`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-tech-spec/instructions.xml`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story-discovery/instructions.xml`

**Depends On:** E1-S3

---

### E1-S5: Server and WebSocket Fixes

**Title:** Fix server.py critical issues

**Description:**
Fix port references, add missing event types, and normalize DB events. Addresses PLAN-DASHBOARD-DATA Fixes 1.1, 1.2, 3.3, 3.4, 1.4.

**Acceptance Criteria:**
- [ ] Add `sprint-runner.csv` to allowed static files
- [ ] Add `PONG` and `BATCH_WARNING` to EventType enum
- [ ] Add context event schemas to EVENT_PAYLOAD_SCHEMAS
- [ ] Add batch:warning payload schema
- [ ] Remove dead `heartbeat_task()` function
- [ ] Filter events by batch in `get_initial_state()`
- [ ] Normalize DB events to WebSocket format
- [ ] Server starts on port 8080
- [ ] WebSocket connects without errors

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/README.md`

**Depends On:** E1-S1, E1-S2

---

## Epic 2: Layout Architecture

**Priority:** HIGH
**Estimated Time:** 1 hour
**Goal:** Implement Split Panel Layout from UI/UX Specification Section 1

### E2-S1: CSS Variables Foundation

**Title:** Implement CSS custom properties from UI/UX spec

**Description:**
Create variables.css with all CSS custom properties from Appendix A of the UI/UX specification.

**Acceptance Criteria:**
- [ ] Create `/static/css/dashboard/variables.css` or add to existing CSS
- [ ] All color variables defined (--color-bg, --color-surface, etc.)
- [ ] All status colors defined (--color-running, --color-success, etc.)
- [ ] All command type colors defined
- [ ] Typography variables defined (--font-sans, --font-mono, --text-*)
- [ ] Spacing scale defined (--space-1 through --space-12)
- [ ] Shadow variables defined
- [ ] Border radius variables defined
- [ ] Animation duration/easing variables defined
- [ ] Layout variables defined (--sidebar-width, --header-height)

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html` (inline styles or linked CSS)

**Reference:** UI/UX Specification Appendix A (lines 888-961)

---

### E2-S2: Split Panel Layout Structure

**Title:** Implement main split panel layout with sidebar

**Description:**
Create the foundational split panel layout with collapsible batch history sidebar and main content area per Section 1.2.

**Acceptance Criteria:**
- [ ] Header bar with controls (56px height)
- [ ] Left sidebar for batch history (240px, collapsible to 48px)
- [ ] Main content area fills remaining width
- [ ] Sidebar toggle button functional
- [ ] Collapsed state shows only status indicators
- [ ] CSS uses BEM-like naming convention

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 1.2 (lines 42-69)

---

### E2-S3: Responsive Breakpoints

**Title:** Implement responsive behavior for layout

**Description:**
Implement responsive behavior for different screen sizes per Section 1.3.

**Acceptance Criteria:**
- [ ] >= 1200px: Sidebar visible at 240px
- [ ] 900-1199px: Sidebar visible at 200px, content compressed
- [ ] < 900px: Sidebar hidden, overlay on toggle
- [ ] Smooth transitions between breakpoints
- [ ] Mobile overlay has proper z-index (100)

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 1.3-1.4 (lines 71-87)

**Depends On:** E2-S2

---

### E2-S4: Z-Index Hierarchy

**Title:** Implement z-index layer system

**Description:**
Establish consistent z-index hierarchy for all overlay elements.

**Acceptance Criteria:**
- [ ] Base layer (0): Main content, cards
- [ ] Elevated (10): Sidebar
- [ ] Overlay (100): Mobile sidebar overlay
- [ ] Modal (1000): Dialogs, context menus
- [ ] Toast (2000): Notifications
- [ ] No z-index conflicts observed

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 1.4 (lines 79-87)

**Depends On:** E2-S2

---

## Epic 3: Component System

**Priority:** HIGH
**Estimated Time:** 1.5 hours
**Goal:** Implement UI components from UI/UX Specification Section 2

### E3-S1: Batch History Sidebar Component

**Title:** Build batch history sidebar with item states

**Description:**
Implement the batch history sidebar component per Section 2.1 with all item states.

**Acceptance Criteria:**
- [ ] Sidebar header with "BATCH RUNS" title
- [ ] Filter/Search input (placeholder for future)
- [ ] Batch item structure: Status icon, ID, label, stats, duration
- [ ] Current batch pinned at top with distinct styling
- [ ] States implemented: Selected (blue left border), Running (amber pulse), Completed (green check), Failed (red X)
- [ ] "Load More" button at bottom
- [ ] Collapse button functional
- [ ] Infinite scroll pagination (20 batches per load)

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 2.1 (lines 95-134)

**Depends On:** E2-S2

---

### E3-S2: Batch Header Component

**Title:** Build current batch header with status and progress

**Description:**
Implement the batch header component showing current batch status per Section 2.2.

**Acceptance Criteria:**
- [ ] Batch ID display (monospace, bold, clickable to copy)
- [ ] Status badge with appropriate color and animation
- [ ] Start time with relative duration (updates every minute)
- [ ] Cycle progress as fraction (e.g., "Cycle: 2/5")
- [ ] Visual progress bar showing story completion
- [ ] Story counts by status (done / in progress / pending)
- [ ] Hover on progress bar shows story breakdown tooltip

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 2.2 (lines 136-163)

**Depends On:** E2-S2

---

### E3-S3: Active Operations Section

**Title:** Build active operations display with running commands

**Description:**
Implement the active operations section showing currently executing commands per Section 2.3.

**Acceptance Criteria:**
- [ ] Section header with count of active operations
- [ ] Operation card for each running command
- [ ] Card shows: Story key (clickable), command type badge, progress bar, timer, latest message
- [ ] Background task indicator when applicable
- [ ] Timer in MM:SS format, updates every second
- [ ] Progress bar with shimmer animation (indeterminate)

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 2.3 (lines 165-197)

**Depends On:** E2-S2

---

### E3-S4: Story List with Expansion

**Title:** Build expandable story list with hierarchy

**Description:**
Implement the story list section with expandable cards per Section 2.4.

**Acceptance Criteria:**
- [ ] Story row (always visible): Chevron, key, title, status badge, duration
- [ ] Command row (when story expanded): Type badge, duration/timer, status, expand chevron
- [ ] Task row (when command expanded): Task name, duration, latest message
- [ ] Single-click expands/collapses
- [ ] Shift-click expands all nested levels
- [ ] Running items auto-expand
- [ ] Expansion state persists within session

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 2.4 (lines 199-256)

**Depends On:** E2-S2

---

### E3-S5: Past Batch View

**Title:** Build past batch detail view

**Description:**
Implement the past batch view displayed when selecting from sidebar per Section 2.5.

**Acceptance Criteria:**
- [ ] Back navigation button to return to current batch
- [ ] Batch metadata header (ID, status, date range, duration)
- [ ] Summary statistics cards (cycles, stories, commands, duration)
- [ ] Same expandable story list structure as current batch
- [ ] All items show completed state

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 2.5 (lines 249-276)

**Depends On:** E3-S4

---

### E3-S6: Command Type Badges

**Title:** Implement styled command type badges

**Description:**
Create styled badges for each command type with colors from Section 4.4.

**Acceptance Criteria:**
- [ ] Badge component with consistent sizing
- [ ] Colors per command type:
  - create-story: Blue (#3b82f6)
  - story-review: Amber (#f59e0b)
  - create-tech-spec: Indigo (#6366f1)
  - tech-spec-review: Violet (#8b5cf6)
  - dev-story: Green (#22c55e)
  - code-review: Purple (#a855f7)
  - commit: Teal (#14b8a6)
- [ ] Light background variant for each
- [ ] Hover shows command description tooltip

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 4.4 (lines 449-459)

---

## Epic 4: Animation System

**Priority:** MEDIUM
**Estimated Time:** 45 minutes
**Goal:** Implement animations from UI/UX Specification Section 3

### E4-S1: Running State Animations

**Title:** Implement pulse glow and shimmer for running states

**Description:**
Implement the pulse glow animation for running operations and shimmer for progress bars per Section 3.2-3.3.

**Acceptance Criteria:**
- [ ] Pulse glow animation: 2s infinite ease-in-out
- [ ] Box shadow and border color transition
- [ ] Progress shimmer: 2s linear infinite
- [ ] Gradient movement effect on progress bars
- [ ] Animations apply to `.operation-running` and `.progress-active` classes

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 3.2-3.3 (lines 296-334)

**Depends On:** E3-S3

---

### E4-S2: Completion and Error Animations

**Title:** Implement success flash and error shake animations

**Description:**
Implement the completion flash for successful commands and shake for errors per Section 3.4-3.5.

**Acceptance Criteria:**
- [ ] Success flash: 600ms ease-out, green background tint, subtle scale
- [ ] Error shake: 500ms ease-out, horizontal translation
- [ ] Animations apply to `.just-completed` and `.error-shake` classes
- [ ] Animations are one-shot (not infinite)

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 3.4-3.5 (lines 336-375)

**Depends On:** E3-S4

---

### E4-S3: Expand/Collapse Transitions

**Title:** Implement smooth expand/collapse transitions

**Description:**
Implement smooth transitions for expandable content per Section 3.6.

**Acceptance Criteria:**
- [ ] Transition on max-height and opacity
- [ ] Duration: 300ms ease-out
- [ ] Collapsed state: max-height 0, opacity 0
- [ ] Expanded state: max-height 2000px, opacity 1
- [ ] No layout jump during transition

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 3.6 (lines 377-396)

**Depends On:** E3-S4

---

### E4-S4: Reduced Motion Support

**Title:** Implement prefers-reduced-motion support

**Description:**
Respect user's reduced motion preference per Section 3.7.

**Acceptance Criteria:**
- [ ] Media query for prefers-reduced-motion: reduce
- [ ] All animations reduced to 0.01ms duration
- [ ] All transitions reduced to 0.01ms duration
- [ ] Animation iteration count set to 1
- [ ] Verify with system accessibility setting

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 3.7 (lines 398-410)

---

## Epic 5: Batch History

**Priority:** MEDIUM
**Estimated Time:** 45 minutes
**Goal:** Implement batch history features from UI/UX Specification Section 8

### E5-S1: Batch List Data Loading

**Title:** Implement batch list data fetching and pagination

**Description:**
Implement data loading for batch history sidebar per Section 8.3.

**Acceptance Criteria:**
- [ ] Initial load: 20 most recent batches
- [ ] "Load More" button triggers additional load
- [ ] Loading indicator while fetching
- [ ] Handle empty state gracefully
- [ ] Cache loaded batches in client state

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 8.3 (lines 692-698)

**Depends On:** E3-S1

---

### E5-S2: Batch Item Display

**Title:** Implement batch item card with all info

**Description:**
Implement batch item display per Section 8.1-8.2.

**Acceptance Criteria:**
- [ ] Status icon (colored dot/icon)
- [ ] Batch ID (#N format)
- [ ] Status label text
- [ ] Stats: "X cycles, Y stories"
- [ ] Duration or "Running" for active

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 8.1-8.2 (lines 668-690)

**Depends On:** E5-S1

---

### E5-S3: Batch Selection and View Switch

**Title:** Implement batch selection to switch main view

**Description:**
Clicking a batch in sidebar loads its details in main content area.

**Acceptance Criteria:**
- [ ] Click batch to select and load
- [ ] Selected batch has distinct styling (blue left border)
- [ ] Current batch always pinned at top
- [ ] Back button returns to current batch
- [ ] Expansion state resets when switching batches

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Sections 2.1, 2.5

**Depends On:** E5-S2, E3-S5

---

### E5-S4: Backend API for Batch History

**Title:** Implement batch history API endpoints

**Description:**
Add REST API endpoints for batch history per Section 9.6.

**Acceptance Criteria:**
- [ ] GET /api/batches - List batches with pagination
- [ ] Query params: limit (default 20), offset
- [ ] Response: { batches: [...], total: number }
- [ ] GET /api/batches/:id - Get single batch details
- [ ] Response: { batch: {...}, stories: [...], stats: {...} }

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`

**Reference:** UI/UX Specification Section 9.6 (lines 812-831)

---

## Epic 6: Real-time Updates

**Priority:** MEDIUM
**Estimated Time:** 1 hour
**Goal:** Implement real-time WebSocket features from UI/UX Specification Section 7

### E6-S1: WebSocket Event Handlers

**Title:** Implement WebSocket event handlers for all event types

**Description:**
Implement JavaScript handlers for all WebSocket events per Section 7.2.

**Acceptance Criteria:**
- [ ] batch:start - Create batch in sidebar, select, render header
- [ ] batch:end - Update status, stop animations, show summary
- [ ] cycle:start - Update cycle counter
- [ ] cycle:end - Update cycle counter
- [ ] command:start - Add to active operations, auto-expand story, start timer
- [ ] command:progress - Update message text
- [ ] command:end - Flash animation, move to completed, stop timer
- [ ] story:status - Update badge, trigger animation

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 7.2, 9.4 (lines 610-622, 766-800)

**Depends On:** E3-S3, E3-S4

---

### E6-S2: Timer System

**Title:** Implement client-side running timers

**Description:**
Implement timer system for running commands per Section 7.3.

**Acceptance Criteria:**
- [ ] Start at 0:00 on command:start
- [ ] Increment every second (client-side)
- [ ] Format: MM:SS
- [ ] Stop on command:end
- [ ] Final duration from server is authoritative
- [ ] Clean up timer on component removal

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 7.3 (lines 624-643)

**Depends On:** E6-S1

---

### E6-S3: Connection Status Indicator

**Title:** Implement connection status indicator with all states

**Description:**
Implement WebSocket connection status indicator per Section 7.5.

**Acceptance Criteria:**
- [ ] Location: Top-right of header
- [ ] Connected: Green filled circle, subtle pulse
- [ ] Connecting: Gray open circle, spin
- [ ] Reconnecting: Amber triangle, blink
- [ ] Disconnected: Red X, no animation
- [ ] Hover tooltip with status text
- [ ] Click to retry when disconnected

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 7.5 (lines 656-666)

---

### E6-S4: State Reconciliation on Reconnect

**Title:** Implement state reconciliation after reconnection

**Description:**
Handle state reconciliation when WebSocket reconnects per Section 7.4.

**Acceptance Criteria:**
- [ ] Request full state on reconnect
- [ ] Compare server batch ID with client
- [ ] Full refresh if batch ID different
- [ ] Merge events by timestamp if same batch
- [ ] Animate only truly new items
- [ ] No duplicate entries after reconnect

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** UI/UX Specification Section 7.4 (lines 645-654)

**Depends On:** E6-S1

---

### E6-S5: Frontend Fix - CSS Escape and Progress Bar

**Title:** Fix CSS.escape() for selectors and unlimited mode progress

**Description:**
Fix frontend issues identified in PLAN-DASHBOARD-DATA Phase 4. Addresses Fix 1.3 and 4.2.

**Acceptance Criteria:**
- [ ] Use CSS.escape() for story badge selector
- [ ] Handle unlimited mode in progress bar (show pulsing animation)
- [ ] No console errors when updating story badges
- [ ] Progress bar works in both limited and unlimited modes

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

**Reference:** PLAN-DASHBOARD-DATA Fix 1.3, 4.2

---

## Implementation Order

Execute epics in this sequence:

```
E1 (Critical Bug Fixes) - MUST COMPLETE FIRST
    |
    v
E2 (Layout Architecture)
    |
    v
E3 (Component System)
    |
    +---> E4 (Animation System) ----+
    |                               |
    +---> E5 (Batch History)        |
                                    |
                                    v
                    E6 (Real-time Updates)
```

## Testing Checkpoints

### After E1 (Critical Fixes)
```bash
cd /Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard
python -m pytest test_db.py -v
python -m pytest test_server.py -v
# Manual: Server starts on 8080, WebSocket connects
```

### After E2 (Layout)
- [ ] Page renders with sidebar and main content
- [ ] Sidebar collapses/expands
- [ ] Responsive breakpoints work

### After E3 (Components)
- [ ] All component sections render
- [ ] Expand/collapse works on story list
- [ ] Command badges show correct colors

### After E4 (Animations)
- [ ] Running items pulse
- [ ] Completion flash works
- [ ] Reduced motion respected

### After E5 (Batch History)
- [ ] Batch list loads
- [ ] Batch selection switches view
- [ ] Pagination works

### After E6 (Real-time)
- [ ] WebSocket events update UI
- [ ] Timers increment
- [ ] Connection indicator shows status
- [ ] Reconnection works

---

**Document Status:** Ready for implementation
**Next Action:** Begin E1-S1 (Database Schema Migration)
