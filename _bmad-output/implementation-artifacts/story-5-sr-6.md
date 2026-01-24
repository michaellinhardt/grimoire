# Story 5.SR-6: Dashboard Sprint Run Tab

Status: ready-for-dev

## Story

As an **operator**,
I want **a dedicated Sprint Run tab with controls and live event log**,
So that **I can start, stop, and monitor sprint execution from the dashboard**.

## Acceptance Criteria

1. **AC1 - Tab Navigation**: Sprint Run tab visible in navigation alongside existing tabs (Epics, Stories, Activity, Timeline). Clicking the tab shows the Sprint Run view.

2. **AC2 - Control Panel**: The following UI elements are displayed:
   - [Start] button - begins a new batch
   - [Stop] button - stops the current batch gracefully
   - Batch size input - number field with "all" checkbox option
   - Current status display (Idle, Running cycle X/Y, Stopping..., Stopped, Error)
   - Current operation display (e.g., "2a-1 dev-story (implement)")

3. **AC3 - Start Behavior**: When no batch is running, user enters batch size and clicks [Start]:
   - POST to `/api/orchestrator/start` with `{ batch_size: number | "all" }`
   - Status updates to "Running cycle 1/N"
   - [Start] is disabled, [Stop] is enabled

4. **AC4 - Stop Behavior**: When a batch is running, user clicks [Stop]:
   - POST to `/api/orchestrator/stop`
   - Status updates to "Stopping..."
   - Graceful stop initiated (current command completes, then stops)
   - Once stopped, status shows "Stopped" with final cycle count

5. **AC5 - Real-Time Event Log**: Events stream via WebSocket and display:
   - Format: `HH:MM:SS story_key command task_id status [message]`
   - New events appear at TOP (newest first)
   - Auto-scroll unless user has scrolled up manually
   - Events color-coded by status (start=blue, progress=yellow, end=green, error=red)

6. **AC6 - Error Handling**: When error events are received:
   - Toast notification appears (top-right, auto-dismiss after 5s unless error)
   - Error highlighted in event log with red background
   - Error details accessible on click/hover

## Tasks / Subtasks

- [ ] Task 1: Add Sprint Run tab to navigation (AC: #1)
  - [ ] 1.1 Add new tab button in `.tab-nav` section
  - [ ] 1.2 Create `#tab-sprintrun` panel container
  - [ ] 1.3 Update `switchTab()` function if needed
  - [ ] 1.4 Add tab count badge (show active batch indicator)

- [ ] Task 2: Build control panel section (AC: #2)
  - [ ] 2.1 Create control panel container with flex layout
  - [ ] 2.2 Add Start/Stop buttons with appropriate styling
  - [ ] 2.3 Add batch size number input with "all" checkbox
  - [ ] 2.4 Add status display area (idle/running/stopped states)
  - [ ] 2.5 Add current operation display area

- [ ] Task 3: Implement Start functionality (AC: #3)
  - [ ] 3.1 Add click handler for Start button
  - [ ] 3.2 Validate batch size input (positive integer or "all")
  - [ ] 3.3 POST to `/api/orchestrator/start` endpoint
  - [ ] 3.4 Handle response and update UI state
  - [ ] 3.5 Disable Start, enable Stop on success

- [ ] Task 4: Implement Stop functionality (AC: #4)
  - [ ] 4.1 Add click handler for Stop button
  - [ ] 4.2 POST to `/api/orchestrator/stop` endpoint
  - [ ] 4.3 Update status to "Stopping..."
  - [ ] 4.4 Handle completion and reset UI state

- [ ] Task 5: Build real-time event log (AC: #5)
  - [ ] 5.1 Create event log container with scrollable area
  - [ ] 5.2 Connect to existing WebSocket endpoint (`/ws`)
  - [ ] 5.3 Parse incoming events and format display
  - [ ] 5.4 Implement auto-scroll with user-scroll detection
  - [ ] 5.5 Add color-coding for different event statuses

- [ ] Task 6: Implement error handling with toasts (AC: #6)
  - [ ] 6.1 Create toast container and styling
  - [ ] 6.2 Create showToast() function
  - [ ] 6.3 Handle error events from WebSocket
  - [ ] 6.4 Highlight errors in event log
  - [ ] 6.5 Add click handler for error details

- [ ] Task 7: Creative enhancements (stretch goals)
  - [ ] 7.1 Progress bar showing cycle progress (X/Y cycles)
  - [ ] 7.2 Story status indicators (colored badges per active story)
  - [ ] 7.3 Collapsible command details in event log
  - [ ] 7.4 Time elapsed per command/story display

## Dev Notes

### Target File
**Primary file to modify**: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html`

Note: Per Story 5-SR-1, files are being relocated from `docs/` to `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/`. Check which location exists at implementation time. If files are still in `docs/`, modify there.

### WebSocket Events (from 5-SR-5)

The server emits these events to connected clients:

| Event Type | Payload | UI Action |
|------------|---------|-----------|
| `batch:start` | `{ batch_id, max_cycles }` | Update status to "Running cycle 1/{max_cycles}" |
| `batch:end` | `{ batch_id, cycles_completed, status }` | Update status based on status field |
| `cycle:start` | `{ cycle_number, story_keys }` | Update cycle counter |
| `cycle:end` | `{ cycle_number, completed_stories }` | Update progress |
| `command:start` | `{ story_key, command, task_id }` | Add to log, update current operation |
| `command:progress` | `{ story_key, command, task_id, message }` | Add to log |
| `command:end` | `{ story_key, command, task_id, status, metrics }` | Add to log, clear current operation |
| `story:status` | `{ story_key, old_status, new_status }` | Update story badge if shown |
| `error` | `{ type, message, context }` | Show toast, highlight in log |

### API Endpoints (from 5-SR-3)

- `POST /api/orchestrator/start` - Body: `{ batch_size: number | "all" }`
- `POST /api/orchestrator/stop` - No body required
- `GET /api/orchestrator/status` - Returns current batch state (use for initial load)

### Existing Dashboard Patterns

Follow these established patterns from `dashboard.html`:

**Tab Structure:**
```html
<!-- In .tab-nav -->
<button class="tab-btn" data-tab="sprintrun">Sprint Run <span class="tab-count" id="sprintrunCount"></span></button>

<!-- Tab panel -->
<div class="tab-panel" id="tab-sprintrun">
  <!-- content -->
</div>
```

**Badge Classes:**
- `.badge-backlog` - gray
- `.badge-ready-for-dev` - blue
- `.badge-in-progress` - yellow
- `.badge-done` - green

**Button Styling:** Use existing button patterns or add new `.btn-primary`, `.btn-danger` classes.

**Cards:** Use `.card` with `.card-label` and `.card-value` for status displays.

### UI Layout Specification

```
+------------------------------------------------------------------+
| Sprint Run                                                    [*] |
+------------------------------------------------------------------+
| CONTROLS                                                          |
| +------+ +------+  Batch Size: [___] [ ] Run All                 |
| |Start | | Stop |                                                 |
| +------+ +------+  Status: Running cycle 2/5                     |
|                    Current: 2a-1 dev-story (implement)           |
+------------------------------------------------------------------+
| PROGRESS (stretch)                                                |
| [=========>                    ] 40% (2/5 cycles)                 |
| Active: 2a-1 [in-progress] 2a-2 [ready]                          |
+------------------------------------------------------------------+
| EVENT LOG                                                         |
| 14:32:15 2a-1 dev-story implement progress Writing tests...      |
| 14:32:01 2a-1 dev-story implement start                          |
| 14:31:45 2a-1 dev-story setup end                                |
| 14:31:30 2a-1 dev-story setup start                              |
| ...                                                               |
+------------------------------------------------------------------+
```

### CSS Additions Needed

```css
/* Sprint Run Tab Styles */
.sprint-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
}

.sprint-status {
  flex: 1;
}

.sprint-log {
  background: #1a1a2e;
  color: #e0e0e0;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  padding: 16px;
  border-radius: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.log-entry {
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 2px;
}

.log-entry.start { background: rgba(59, 130, 246, 0.2); }
.log-entry.progress { background: rgba(251, 191, 36, 0.1); }
.log-entry.end { background: rgba(16, 185, 129, 0.2); }
.log-entry.error { background: rgba(239, 68, 68, 0.3); }

/* Toast notifications */
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
}

.toast {
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  margin-bottom: 8px;
  animation: slideIn 0.3s ease;
}

.toast.error {
  border-left: 4px solid #ef4444;
}
```

### JavaScript Implementation Notes

**WebSocket Connection:**
```javascript
// Reuse existing WS connection if available, or create new
let ws = null;

function connectWebSocket() {
  ws = new WebSocket(`ws://${window.location.host}/ws`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketEvent(data);
  };

  ws.onclose = () => {
    // Reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };
}

function handleWebSocketEvent(event) {
  switch(event.type) {
    case 'batch:start':
      updateStatus('running', event.payload);
      break;
    case 'batch:end':
      updateStatus(event.payload.status, event.payload);
      break;
    case 'command:start':
    case 'command:progress':
    case 'command:end':
      addLogEntry(event);
      updateCurrentOperation(event);
      break;
    case 'error':
      showToast(event.payload.message, 'error');
      addLogEntry(event);
      break;
  }
}
```

**Auto-scroll Logic:**
```javascript
let userScrolled = false;
const logContainer = document.getElementById('sprintLog');

logContainer.addEventListener('scroll', () => {
  // User scrolled if not at bottom
  userScrolled = logContainer.scrollTop < logContainer.scrollHeight - logContainer.clientHeight - 50;
});

function addLogEntry(event) {
  const entry = createLogEntry(event);
  logContainer.prepend(entry); // Newest first

  if (!userScrolled) {
    logContainer.scrollTop = 0; // Keep at top (newest)
  }
}
```

### localStorage Persistence

Save these to localStorage (Story 5-SR-7 pattern):
- `dashboard-sprintrun-batchsize` - Last used batch size
- `dashboard-sprintrun-runall` - Run all checkbox state

### Testing Notes

Manual testing checklist:
1. Tab appears and switches correctly
2. Start with batch size 3, verify status updates
3. Stop mid-execution, verify graceful stop
4. Events appear in log in correct format
5. Scroll up in log, verify auto-scroll stops
6. Trigger error, verify toast appears
7. Refresh page, verify batch size persists

### Project Structure Notes

- This is a standalone HTML file with embedded CSS/JS (no build process)
- All styles go in the `<style>` block at the top
- All JavaScript goes in the `<script>` block at the bottom
- Follow existing code organization patterns in the file

### References

- [Source: _bmad-output/planning-artifacts/epic-5-sprint-runner-dashboard.md#Story-5-SR-6]
- [Source: _bmad-output/planning-artifacts/epic-5-sprint-runner-dashboard-context.md#WebSocket-Event-Format]
- [Source: _bmad-output/planning-artifacts/epic-5-sprint-runner-dashboard-context.md#Dashboard-Sprint-Run-Tab-Layout]
- [Source: _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/dashboard.html - Existing tab patterns, badge styles, card components]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
