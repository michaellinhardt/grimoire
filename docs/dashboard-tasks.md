# Dashboard Enhancement Implementation Tasks

## Task 1: UI Cleanup and Header Modernization
**Scope:** Remove deprecated UI elements, restructure header, enable auto-refresh by default

### Subtasks:
1. **Remove file loader section** - Delete the entire `.file-loader` div and associated styles, as data now loads via Python server
2. **Remove auto-refresh toggle button** - Delete `watchBtn` element and `toggleWatch()` function; make auto-refresh the default behavior on page load
3. **Reduce header title size** - Change `h1` font-size from 40px to ~20-24px (topbar navigation size); adjust header padding accordingly
4. **Relocate "last updated" display** - Move `.last-updated` element to right side of header using flexbox `justify-content: space-between`
5. **Enable auto-refresh on load** - Modify `tryAutoLoad()` to automatically start 5-second refresh interval when data loads successfully

---

## Task 2: Epic Tab Enhancements
**Scope:** Fix epic display logic and add expandable story list

### Subtasks:
1. **Fix epic column rendering** - Update `renderEpicBoard()` to correctly place epics in Backlog, In-Progress, and Done columns based on `epic.status` (currently only showing done)
2. **Verify progress bar calculation** - Audit the progress calculation logic: ensure it counts `doneStories / totalStories` correctly for each epic
3. **Add expandable epic cards** - Modify `.epic-card` to be expandable on click; add expand/collapse toggle icon
4. **Render story list inside expanded epic** - When epic is expanded, show list of stories with status badges (similar to activity toggle pattern)
5. **Add story description tooltip** - On mouseover of story items within expanded epics, show description tooltip (requires story descriptions from Task 4)

---

## Task 3: Orchestrator Format Migration
**Scope:** Migrate from Markdown table format to CSV, create sample data, calculate durations

### Subtasks:
1. **Define new CSV format** - Format: `unix_timestamp,epicid,storyid,command,result`
   - `result` = "start" when command begins, actual result string when complete
2. **Create `orchestrator-sample.md`** - Generate fake sample data in new CSV format for development/testing (10-15 entries covering multiple stories)
3. **Update parser function** - Replace `parseOrchestrator()` to handle CSV format instead of Markdown tables
4. **Calculate durations from timestamps** - For each command pair (start + result), calculate duration; for stories, sum all command durations
5. **Backward compatibility check** - Optionally detect format and support both during migration period

---

## Task 4: Story Descriptions Integration
**Scope:** Backend extraction and frontend display of story descriptions

### Subtasks:
1. **Create story description extractor** - Backend utility that:
   - Lists files in `_bmad-output/implementation-artifacts/`
   - Matches files containing story ID (e.g., "2a-1")
   - Extracts text between `## Story` and next `##` heading
   - Trims whitespace and returns description
2. **Integrate with data loading** - Modify data loading to call extractor and attach description to each story object
3. **Stories tab: Add tooltip** - On row mouseover, display story description in tooltip/popover
4. **Activity tab: Show description** - Add description text below story name in activity items
5. **Epic expanded view: Add tooltip** - Story items in expanded epic cards show description on mouseover

---

## Task 5: Duration Display and Timeline View
**Scope:** Add duration metrics throughout UI and create new Timeline tab

### Subtasks:
1. **Activity tab: Command durations** - Display duration for each command row; add story total duration in activity header
2. **Stories tab: Completion time** - Add "Duration" column showing time to complete each story
3. **Epics tab: Total duration** - Show SUM of completed story durations for each epic in the card
4. **Create Timeline tab** - Add new tab button "Timeline" to `.tab-nav`
5. **Build horizontal timeline component** - Create Jira-style horizontal scrollable timeline showing:
   - Horizontal axis = time
   - Bars for each epic/story showing start and end times
   - Color-coded by status (in-progress, done)
   - Scrollable container for large time ranges

---

## Implementation Order

| Order | Task | Rationale |
|-------|------|-----------|
| 1 | Task 1 (UI Cleanup) | Low risk, removes unused code, simplifies subsequent work |
| 2 | Task 3 (Orchestrator Migration) | Foundation for duration calculations needed by Tasks 4-5 |
| 3 | Task 2 (Epic Tab) | Enables expandable epics before adding tooltips |
| 4 | Task 4 (Story Descriptions) | Requires backend work but enables all tooltip features |
| 5 | Task 5 (Durations + Timeline) | Depends on new orchestrator format; most complex feature |

---

## Key Files

- `/Users/teazyou/dev/grimoire/docs/dashboard.html` - Main dashboard file
- `/Users/teazyou/dev/grimoire/docs/orchestrator-sample.md` - New file for development data
- `/Users/teazyou/dev/grimoire/docs/server.py` - Backend script for story description extraction
