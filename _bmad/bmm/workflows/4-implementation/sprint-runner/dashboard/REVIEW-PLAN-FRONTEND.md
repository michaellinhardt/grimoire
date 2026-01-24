# REVIEW-PLAN-FRONTEND.md

## Status: NEEDS-WORK

The plan contains significant line number inaccuracies and missing function assignments that could lead to extraction errors during implementation. While the overall structure and approach are sound, the specific line references and module assignments require corrections before proceeding.

---

## Critical Issues Found

### Issue 1: CSS Line Range End Boundary

**Claimed:** CSS ends at lines 7-3228
**Actual:** CSS is at lines 7-3228 (closing `</style>` tag), HTML body starts at line 3230

**Verdict:** CORRECT - The CSS range is accurate.

### Issue 2: JavaScript Function Line Numbers - MAJOR INACCURACIES

#### WebSocket Functions (Step 4.2)

| Function | Plan Claims | Actual Line | Status |
|----------|-------------|-------------|--------|
| `connectSprintWebSocket()` | 6096 | 6096 | CORRECT |
| `handleWebSocketEvent()` | (implied 6096-6271) | 6437 | WRONG - Not in claimed range |
| `getEventStatus()` | (implied 6096-6271) | 6609 | WRONG - Not in claimed range |

**Issue:** The plan claims WebSocket functions are at lines 6096-6271, but `handleWebSocketEvent()` is at line 6437 and `getEventStatus()` is at line 6609. These are approximately 150-350 lines away from the claimed range.

#### Sidebar Functions (Step 4.3)

| Function | Plan Claims | Actual Line | Status |
|----------|-------------|-------------|--------|
| `toggleBatchSidebar()` | 7220-7542 | 7259 | CORRECT (within range) |
| `renderBatchList()` | 7220-7542 | 7268 | CORRECT |
| `fetchBatches()` | 7220-7542 | 7322 | CORRECT |
| `batchHistoryState` | "around line 7254" | 7220 | CORRECT |

**Verdict:** Sidebar line numbers are generally accurate.

#### Controls Functions (Step 4.4)

| Function | Plan Claims | Actual Line | Status |
|----------|-------------|-------------|--------|
| `updateSprintUI()` | 6854-7054 | 6855 | CORRECT |
| `startSprint()` | 6854-7054 | 6973 | CORRECT |
| `stopSprint()` | 6854-7054 | 7005 | CORRECT |

**Verdict:** Controls line numbers are accurate.

#### Story Functions (Step 4.6)

| Function | Plan Claims | Actual Line | Status |
|----------|-------------|-------------|--------|
| `renderStoryTable()` | 5750-5999 | 4704 | WRONG - Over 1000 lines off! |
| `renderSummaryCards()` | 5750-5999 | 4462 | WRONG - Over 1300 lines off! |
| `renderEpicBoard()` | 5750-5999 | 4496 | WRONG - Over 1250 lines off! |
| `toggleEpic()` | 5750-5999 | 4657 | WRONG - Function is `toggleEpicCard()` |
| `showStoryTooltip()` | 5750-5999 | 4432 | WRONG - Over 1300 lines off! |

**Critical Error:** The story rendering functions are approximately 1000-1300 lines earlier than claimed. The plan locates them at 5750-5999 but they are actually at 4432-4704.

#### Component Factories (Step 4.6 continued)

| Function | Plan Claims | Actual Line | Status |
|----------|-------------|-------------|--------|
| `createStoryCard()` | 7078-7178 | 7093 | CORRECT |
| `createCommandGroup()` | 7078-7178 | ~7100 | CORRECT |
| `createBatchCard()` | 7078-7178 | 7083 | CORRECT |

**Verdict:** Component factory line numbers are accurate.

#### Operations Functions (Step 4.7)

| Function | Plan Claims | Actual Line | Status |
|----------|-------------|-------------|--------|
| `startCommandTimer()` | 6639-6767 | 6643 | CORRECT |
| `stopCommandTimer()` | 6639-6767 | 6655 | CORRECT |
| `renderActiveOperationsDisplay()` | 6639-6767 | 6683 | CORRECT |
| `restoreActiveOperationsFromEvents()` | 6639-6767 | 6739 | CORRECT |

**Verdict:** Operations line numbers are accurate.

#### Batch Functions (Step 4.5)

| Function | Plan Claims | Actual Line | Status |
|----------|-------------|-------------|--------|
| `showProgressSection()` | 6854-6970 | 6906 | CORRECT |
| `updateProgress()` | 6854-6970 | 6911 | CORRECT |
| `updateActiveStories()` | 6854-6970 | 6943 | CORRECT |
| `handleBatchState()` | - | 6627 | MISSING FROM PLAN - Not in claimed range |

**Issue:** `handleBatchState()` is at line 6627 but Step 4.5 claims lines 6854-6970.

---

### Issue 3: Missing Utility Functions in utils.js Assignment

The following utility functions exist but are NOT mentioned in the plan's utils.js section:

| Function | Actual Line | Assignment |
|----------|-------------|------------|
| `hashString()` | 3847 | Listed correctly |
| `updateElement()` | 3894 | Listed correctly |
| `updateTextContent()` | 3905 | Listed correctly |
| `saveScrollPosition()` | 3916 | Listed correctly |
| `restoreScrollPosition()` | 3922 | Listed correctly |
| `getCommandType()` | 7151 | **MISSING** - Should be in utils.js |
| `restoreScrollPositions()` | 3790 | **MISSING** - Distinct from saveScrollPosition |

---

### Issue 4: Animation Functions Not Fully Assigned

The plan mentions animation functions in Phase 5 (lines 6277-6434) but several are located elsewhere:

| Function | Plan Claims | Actual Line | Status |
|----------|-------------|-------------|--------|
| `animateLogEntry()` | 6277-6434 | 6408 | CORRECT |
| `animateStoryStatusChange()` | 6277-6434 | 6424 | CORRECT |
| `prefersReducedMotion()` | 6277-6434 | 6281 | CORRECT |

**Verdict:** Animation line numbers are accurate.

---

### Issue 5: Event Log Functions Assignment

| Function | Plan Claims | Actual Line | Status |
|----------|-------------|-------------|--------|
| `addLogEntry()` | 6769-6852 | 6770 | CORRECT |
| `clearSprintLog()` | 6769-6852 | 6838 | CORRECT |
| `toggleAutoScroll()` | 6769-6852 | 6843 | CORRECT |
| `formatLogTime()` | (implied utils.js) | 6833 | WRONG MODULE - In log section, not utils |

**Issue:** `formatLogTime()` is at line 6833, which is within the log functions section (6769-6852), not in the earlier utility section. This creates a dependency issue - if log.js uses `formatLogTime()` but it's supposed to be in utils.js, it must be extracted to utils.js first.

---

### Issue 6: Missing Main.js Functions

The following functions are not assigned to any module in the plan:

| Function | Actual Line | Suggested Module |
|----------|-------------|------------------|
| `saveUIState()` | 3704 | main.js |
| `restoreUIState()` | 3752 | main.js |
| `tryAutoLoad()` | 5913 | main.js |
| `initColumnResize()` | 5016 | main.js or timeline.js |
| `initTimelineCursorLine()` | 5026 | main.js or timeline.js |
| `switchTab()` | 5804 | main.js |
| `restoreActiveTab()` | 5824 | main.js |
| `updateTabCounts()` | 5831 | main.js |
| `updateLastUpdatedTime()` | 5843 | main.js |

---

### Issue 7: Function Name Discrepancy

**Claimed:** `toggleEpic(epicId)`
**Actual:** `toggleEpicCard(epicId)` at line 4657

---

### Issue 8: Settings Page - Missing Current Tab Structure

The plan does not account for the fact that the existing tab structure in dashboard.html already has tabs:
- Epics
- Stories
- Activity
- Timeline
- Sprint Run

The Settings tab needs to be added as a **sixth tab**, not replacing any existing tab. The plan's HTML shows the tab button but does not specify its position relative to existing tabs.

---

### Issue 9: Module Dependency Analysis - Controls.js Issue

The plan states:
> `controls.js` - Depends on websocket.js (for state reference)

However, examining the code, `controls.js` functions like `updateSprintUI()` reference `sprintRunState.isRunning` and `sprintRunState.isStopping`. But `sprintRunState` is defined in the Sprint Run Tab section (line 6034), not in websocket.js.

**Recommended Fix:** Either:
1. Move `sprintRunState` to main.js as a global
2. Or clarify that controls.js depends on main.js, not websocket.js

---

### Issue 10: CSS Section Line Numbers - Some Inaccuracies

| Section | Plan Claims | Verification |
|---------|-------------|--------------|
| CSS Variables | 15-144 | CORRECT |
| Reset & Base | 8-14, 146-154 | CORRECT |
| Split Panel Layout | 161-589 | CORRECT |
| App Header | 177-312 | CORRECT |
| Status Badges | 903-942 | CORRECT |
| Activity Log | 944-1096 | CORRECT |
| Filters | 1399-1436 | CORRECT |
| Tab Navigation | 1454-1508 | CORRECT |
| Sprint Run Tab | 2089-2447 | CORRECT (starts at 2089) |

**Verdict:** CSS line numbers are largely accurate.

---

## Verification Checklist

- [x] CSS line ranges verified - **PASS** (mostly accurate)
- [ ] JS function locations verified - **FAIL** (stories.js functions 1000+ lines off)
- [x] Module loading order correct - **PASS** (but sprintRunState dependency needs clarification)
- [x] All 9 settings in settings.js - **PASS**
- [ ] No missing functions - **FAIL** (several functions unassigned)

---

## Recommendations

### High Priority Fixes Required

1. **Correct stories.js line numbers**: Change from 5750-5999 to 4432-4704 for the rendering functions.

2. **Add missing functions to module assignments**:
   - `getCommandType()` (line 7151) to utils.js
   - `restoreScrollPositions()` (line 3790) to utils.js
   - Timeline functions to a dedicated timeline.js or main.js
   - `formatLogTime()` should move to utils.js to avoid circular dependency

3. **Correct function name**: `toggleEpic()` should be `toggleEpicCard()`

4. **Clarify sprintRunState ownership**: Define which module owns `sprintRunState` and update dependency chain accordingly. Recommend:
   ```
   main.js defines: state, sidebarState, sprintRunState
   Other modules reference via global access
   ```

5. **Add Settings tab integration detail**: Specify that Settings tab button goes AFTER Sprint Run tab in the existing tab-nav structure.

6. **Create explicit handleBatchState assignment**: This function (line 6627) handles WebSocket init events and should be in websocket.js or batch.js.

### Medium Priority

7. Consider creating a **timeline.js** module for timeline-specific functions:
   - `renderTimeline()`
   - `initTimelineCursorLine()`
   - `initColumnResize()`
   - `getTimelineData()`

8. Add explicit HTML structure for index.html showing the complete tab-nav with all 6 tabs.

### Documentation Improvement

9. Add a **dependency diagram** showing:
   ```
   utils.js (no deps)
       |
   websocket.js (uses utils)
       |
   sidebar.js (uses utils)
       |
   controls.js (uses main.js state)
       |
   batch.js (uses utils, main.js state)
       |
   stories.js (uses utils)
       |
   operations.js (uses utils, stories)
       |
   settings.js (uses utils)
       |
   main.js (orchestrates all)
   ```

---

## Summary

The plan's overall architecture is sound, but the line number inaccuracies for stories.js (off by 1000+ lines) and missing function assignments could cause extraction errors. The CSS extraction is accurate. Before implementation:

1. Fix the stories.js line number references
2. Add missing function assignments
3. Clarify sprintRunState module ownership
4. Correct the `toggleEpic` -> `toggleEpicCard` function name

With these corrections, the plan should be executable.
