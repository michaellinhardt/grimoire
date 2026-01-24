# Story 5-SR-7: Dashboard UI Improvements

Status: ready-for-dev

## Story

As an **operator**,
I want **an improved dashboard experience**,
so that **I can use more screen space and not lose my UI state on refresh**.

## Acceptance Criteria

1. **AC1 - Full Width Layout**
   - Given the dashboard HTML
   - When removing the width constraint
   - Then the `max-width: 1400px` constraint is removed from `.container`
   - And the dashboard uses full available width
   - And content flows naturally to fill the viewport

2. **AC2 - Incremental DOM Updates**
   - Given the dashboard auto-refresh feature
   - When data updates every 5 seconds
   - Then DOM is updated incrementally (no full page reload)
   - And only changed elements are re-rendered
   - And scroll position is preserved
   - And expanded/collapsed states are preserved

3. **AC3 - UI State Persistence to localStorage**
   - Given the user adjusts UI state
   - When interacting with the dashboard
   - Then the following are saved to localStorage:
     - Active tab selection (already exists)
     - Filter/search values
     - Checkbox states (e.g., show archived)
     - Expanded/collapsed elements (epic cards)
     - Column sort preferences
     - Batch size input value
     - Timeline label column width (already exists)

4. **AC4 - UI State Restoration**
   - Given the user refreshes the browser
   - When the dashboard loads
   - Then all UI state is restored from localStorage
   - And the user sees exactly what they had before
   - And no server round-trip is needed for UI state

5. **AC5 - WebSocket-Ready Updates** (Preparation for 5-SR-5)
   - Given the WebSocket connection will be active (future)
   - When receiving updates
   - Then data tables update in-place
   - And new rows are inserted without full re-render
   - And status changes update the specific cell/badge

## Tasks / Subtasks

- [ ] Task 1: Remove width constraint (AC: 1)
  - [ ] 1.1: Remove `max-width: 1400px` from `.container` CSS rule
  - [ ] 1.2: Verify dashboard stretches to full viewport width
  - [ ] 1.3: Ensure all sections (cards, epic board, tables) adapt to wider layout

- [ ] Task 2: Implement incremental DOM updates (AC: 2, 5)
  - [ ] 2.1: Refactor `renderEpicBoard()` to diff and update only changed epic cards
  - [ ] 2.2: Refactor `renderStoryTable()` to update rows in-place instead of full innerHTML
  - [ ] 2.3: Refactor `renderTimeline()` to update only changed timeline elements
  - [ ] 2.4: Refactor `renderActivityLog()` to prepend new entries without clearing existing
  - [ ] 2.5: Create helper function `updateElement(selector, newContent)` for targeted updates
  - [ ] 2.6: Preserve scroll position during updates using `scrollTop` save/restore

- [ ] Task 3: Expand localStorage persistence (AC: 3, 4)
  - [ ] 3.1: Create `saveUIState()` function to serialize all UI state
  - [ ] 3.2: Create `restoreUIState()` function to restore all UI state on load
  - [ ] 3.3: Add localStorage key: `dashboard-expanded-epics` (array of expanded epic IDs)
  - [ ] 3.4: Add localStorage key: `dashboard-filters` (object with filter field values)
  - [ ] 3.5: Add localStorage key: `dashboard-checkboxes` (object with checkbox states)
  - [ ] 3.6: Add localStorage key: `dashboard-batch-size` (number or "all")
  - [ ] 3.7: Add localStorage key: `dashboard-sort-prefs` (object with column sort state)
  - [ ] 3.8: Call `saveUIState()` on every UI interaction that changes state
  - [ ] 3.9: Call `restoreUIState()` in DOMContentLoaded before initial render

- [ ] Task 4: Test and verify (AC: 1-5)
  - [ ] 4.1: Test full-width layout at various screen sizes
  - [ ] 4.2: Test auto-refresh doesn't reset expanded epics
  - [ ] 4.3: Test browser refresh restores all UI state
  - [ ] 4.4: Test scroll position preserved during auto-refresh
  - [ ] 4.5: Verify no visual flicker during incremental updates

## Dev Notes

### File to Modify

**Single file change:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html` - All changes are in this file (relocated from docs/ by Story 5-SR-1)

### Current Implementation Analysis

**CSS (Line 34-36):**
```css
.container {
    max-width: 1400px;
    margin: 0 auto;
}
```
Remove the `max-width: 1400px;` line only.

**Current Auto-Refresh (Lines 3595-3598):**
```javascript
state.watchInterval = setInterval(async () => {
    await refreshViaFetch();
}, 5000);
```
The `refreshViaFetch()` function calls render functions that do full innerHTML replacements.

**Existing localStorage Keys:**
- `dashboard-active-tab` - Tab selection (working)
- `timeline-label-width` - Timeline column width (working)

### Incremental Update Strategy

Replace full innerHTML updates with DOM diffing:

```javascript
// BEFORE (full replacement):
function renderEpicBoard() {
    const backlogCol = document.querySelector('.backlog-column');
    backlogCol.innerHTML = epics.map(e => createEpicCard(e)).join('');
}

// AFTER (incremental):
function renderEpicBoard() {
    const backlogCol = document.querySelector('.backlog-column');
    const existingCards = new Map();
    backlogCol.querySelectorAll('.epic-card').forEach(card => {
        existingCards.set(card.dataset.epicId, card);
    });

    epics.forEach(epic => {
        const existing = existingCards.get(epic.id);
        if (existing) {
            // Update only if changed
            updateEpicCard(existing, epic);
            existingCards.delete(epic.id);
        } else {
            // Insert new card
            backlogCol.appendChild(createEpicCardElement(epic));
        }
    });

    // Remove cards no longer in data
    existingCards.forEach(card => card.remove());
}
```

### localStorage Structure

```javascript
const UI_STATE_KEYS = {
    ACTIVE_TAB: 'dashboard-active-tab',           // existing
    TIMELINE_WIDTH: 'timeline-label-width',       // existing
    EXPANDED_EPICS: 'dashboard-expanded-epics',   // new: ['epic-1', 'epic-2']
    FILTERS: 'dashboard-filters',                 // new: {search: '', status: 'all'}
    CHECKBOXES: 'dashboard-checkboxes',           // new: {showArchived: false}
    BATCH_SIZE: 'dashboard-batch-size',           // new: 2 or 'all'
    SORT_PREFS: 'dashboard-sort-prefs'            // new: {column: 'story', dir: 'asc'}
};

function saveUIState() {
    const state = {
        expandedEpics: Array.from(document.querySelectorAll('.epic-card.expanded'))
            .map(el => el.dataset.epicId),
        filters: {
            search: document.querySelector('.search-input')?.value || ''
        },
        checkboxes: {
            showArchived: document.querySelector('#showArchived')?.checked || false
        },
        batchSize: document.querySelector('#batchSize')?.value || 2
    };

    Object.entries(state).forEach(([key, value]) => {
        localStorage.setItem(`dashboard-${key}`, JSON.stringify(value));
    });
}
```

### Testing Approach

1. **Visual testing:** Manually verify layout at 1920px, 2560px, and 4K widths
2. **State persistence:** Expand epic cards, refresh browser, verify still expanded
3. **Scroll preservation:** Scroll down in table, wait for auto-refresh, verify position
4. **Performance:** Observe no full-page flash during 5-second refresh cycles

### Project Structure Notes

- Single HTML file with embedded CSS and JavaScript (no build process)
- Vanilla JavaScript (no React, no framework patterns apply)
- This is for the sprint-runner dashboard, NOT the main Grimoire Electron app

### References

- [Source: _bmad-output/planning-artifacts/epic-5-sprint-runner-dashboard.md#Story-5-SR-7]
- [Source: _bmad-output/planning-artifacts/epic-5-sprint-runner-dashboard-context.md#Dashboard-Enhancements]
- [Source: _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html - Current implementation]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
