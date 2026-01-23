# Implementation Plan: Sprint Runner Task Granularity Enhancement

**Date:** 2026-01-24
**Reference:** change-report-sprint-runner-task-granularity-2026-01-24.md
**Author:** BMad Master

---

## Implementation Order

The implementation follows a bottom-up approach: infrastructure first, then UI, then prompts.

---

## Phase 1: Infrastructure (Foundation)

### Task 1.1: Create task-taxonomy.yaml
**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml`
**Action:** CREATE new file
**Dependencies:** None
**Details:**
- Define taxonomy structure with version, description, recommended_metrics
- Define phases for each command: create-story, story-discovery, story-review, create-tech-spec, tech-spec-discovery, tech-spec-review, dev-story, code-review
- Each phase has: id, description, typical_message_start, typical_message_end

### Task 1.2: Update orchestrator.sh
**File:** `_bmad/scripts/orchestrator.sh`
**Action:** MODIFY
**Dependencies:** None
**Details:**
- Add 6th parameter: `MESSAGE`
- Validate message is non-empty
- Validate message length <= 150 chars (warn and truncate if exceeded)
- Implement RFC 4180 CSV escaping for message field:
  - Wrap in double quotes
  - Escape internal double quotes as `""`
  - Handle newlines (replace with space)
- Update output format to 7 columns
- Update usage message

**Code changes:**
```bash
# Old signature
# Usage: ./orchestrator.sh <epic_id> <story_id> <command> <task_id> <status>

# New signature
# Usage: ./orchestrator.sh <epic_id> <story_id> <command> <task_id> <status> <message>

MESSAGE="$6"

# Validation
if [[ -z "$MESSAGE" ]]; then
    echo "Error: message is required" >&2
    exit 1
fi

# Truncate if needed
if [[ ${#MESSAGE} -gt 150 ]]; then
    echo "Warning: message truncated to 150 chars" >&2
    MESSAGE="${MESSAGE:0:150}"
fi

# CSV escape function
csv_escape() {
    local str="$1"
    # Replace newlines with space
    str="${str//$'\n'/ }"
    # Escape double quotes
    str="${str//\"/\"\"}"
    echo "\"$str\""
}

ESCAPED_MESSAGE=$(csv_escape "$MESSAGE")

# Output
echo "${TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${TASK_ID},${STATUS},${ESCAPED_MESSAGE}" >> "$OUTPUT_FILE"
```

### Task 1.3: Update instructions.md log format documentation
**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`
**Action:** MODIFY
**Dependencies:** Task 1.1, Task 1.2
**Details:**
- Update "Orchestrator Log Format" section
- Document new 7-column format
- Reference task-taxonomy.yaml for valid task IDs
- Add examples with messages

---

## Phase 2: Dashboard UI

### Task 2.1: Update CSV parser for 7-column format
**File:** `docs/dashboard.html`
**Action:** MODIFY (parseOrchestratorCSV function)
**Dependencies:** Task 1.2
**Details:**
- Implement proper CSV parsing that handles quoted fields (RFC 4180)
- Detect 6 vs 7 column format for backward compatibility
- Extract message from 7th field when present
- Store message in task objects: `{ taskId, startTs, endTs, durationSecs, duration, status, startMessage, endMessage }`
- Handle both start and end messages

**Code changes:**
```javascript
// Add RFC 4180 CSV line parser
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (inQuotes) {
            if (char === '"' && nextChar === '"') {
                current += '"';
                i++; // Skip escaped quote
            } else if (char === '"') {
                inQuotes = false;
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
    }
    result.push(current);
    return result;
}

// In parseOrchestratorCSV:
const parts = parseCSVLine(line);
// 6-column: timestamp,epic,story,cmd,task,status
// 7-column: timestamp,epic,story,cmd,task,status,message
const [timestamp, epicId, storyId, command, taskId, status, message = ''] = parts;
```

### Task 2.2: Update task data structure
**File:** `docs/dashboard.html`
**Action:** MODIFY (task object creation in parseOrchestratorCSV)
**Dependencies:** Task 2.1
**Details:**
- Track separate startMessage and endMessage per task
- Associate messages with correct start/end events
- Store in pair tracking: `{ start: entry, end: entry, startMessage, endMessage }`

### Task 2.3: Add message display in timeline
**File:** `docs/dashboard.html`
**Action:** MODIFY (renderTimeline function)
**Dependencies:** Task 2.2
**Details:**
- Below each command bar, render message text
- Style: smaller font, muted color, left-aligned
- Show endMessage if completed, startMessage if in-progress
- CSS class: `.timeline-task-message`

**HTML structure:**
```html
<div class="timeline-row">
    <div class="timeline-row-label">create-story</div>
    <div class="timeline-row-content">
        <div class="command-bar">...</div>
    </div>
</div>
<div class="timeline-task-row" data-command="create-story">
    <div class="timeline-task-row-label">setup</div>
    <div class="timeline-task-row-content">
        <div class="task-bar">...</div>
    </div>
</div>
<div class="timeline-message-row" data-command="create-story">
    <div class="timeline-message">Setup complete (files:1)</div>
</div>
```

### Task 2.4: Implement command expand/collapse toggle
**File:** `docs/dashboard.html`
**Action:** MODIFY (renderTimeline + renderActivity functions)
**Dependencies:** Task 2.3
**Details:**
- Default state: expanded (show all tasks)
- Click command name to toggle
- Track expanded state per command
- CSS transitions for smooth expand/collapse
- Add toggle icon (chevron)

**JavaScript:**
```javascript
// Track expanded state
const commandExpandedState = new Map(); // command -> boolean (default true)

function toggleCommandExpanded(storyId, command) {
    const key = `${storyId}|${command}`;
    const current = commandExpandedState.get(key) ?? true; // default expanded
    commandExpandedState.set(key, !current);
    // Re-render affected section
}
```

### Task 2.5: Update activity log with expandable commands
**File:** `docs/dashboard.html`
**Action:** MODIFY (renderActivity function)
**Dependencies:** Task 2.2
**Details:**
- Each command in activity log is expandable
- Expanded view shows:
  - Task list with task IDs
  - Messages (startMessage for context, endMessage for result)
  - Duration per task
- Default: expanded
- Click header to collapse/expand

### Task 2.6: Add CSS styles for messages and toggles
**File:** `docs/dashboard.html`
**Action:** MODIFY (CSS section)
**Dependencies:** Task 2.3, Task 2.4, Task 2.5
**Details:**
```css
.timeline-message-row {
    display: flex;
    height: 20px;
    border-top: none;
}

.timeline-message {
    font-size: 11px;
    color: #787774;
    font-style: italic;
    padding: 2px 12px 2px 48px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.command-toggle-icon {
    transition: transform 0.2s ease;
    cursor: pointer;
}

.command-toggle-icon.collapsed {
    transform: rotate(-90deg);
}

/* Hide task rows when command collapsed */
.command-group.collapsed .timeline-task-row,
.command-group.collapsed .timeline-message-row {
    display: none;
}
```

---

## Phase 3: Subagent Prompts

### Task 3.1: Create logging instruction template
**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/_logging-instructions.md`
**Action:** CREATE (internal template, not a standalone prompt)
**Dependencies:** Task 1.1
**Details:**
- Standard instructions for task logging
- Reference to task-taxonomy.yaml
- Examples of calling orchestrator.sh
- Message formatting guidelines

**Content:**
```markdown
## Task Logging Instructions

You MUST log task events using the orchestrator script. Reference the task taxonomy for valid task IDs.

**Script:** `_bmad/scripts/orchestrator.sh`
**Signature:** `./orchestrator.sh <epic_id> <story_id> <command> <task_id> <status> <message>`

**Rules:**
1. Log `start` BEFORE beginning a phase
2. Log `end` AFTER completing a phase
3. Messages are REQUIRED (max 150 chars)
4. Use structured suffix for end messages: `Text (metric:value, metric:value)`

**Example:**
```bash
_bmad/scripts/orchestrator.sh 2b 2b-6 create-story setup start "Initializing story creation for 2b-6"
# ... do work ...
_bmad/scripts/orchestrator.sh 2b 2b-6 create-story setup end "Setup complete (files:1)"
```

**Valid task IDs for {{command}}:** See task-taxonomy.yaml
```

### Task 3.2: Update create-story.md prompt
**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story.md`
**Action:** MODIFY
**Dependencies:** Task 3.1
**Details:**
- Add logging instructions section
- Specify task IDs: setup, analyze, generate, write, validate
- Add example log calls

### Task 3.3: Update create-story-discovery.md prompt
**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story-discovery.md`
**Action:** MODIFY
**Dependencies:** Task 3.1
**Details:**
- Add logging instructions
- Task IDs: setup, explore, write

### Task 3.4: Update story-review.md prompt
**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/story-review.md`
**Action:** MODIFY
**Dependencies:** Task 3.1
**Details:**
- Add logging instructions
- Task IDs: setup, analyze, fix, validate

### Task 3.5: Update create-tech-spec.md prompt
**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-tech-spec.md`
**Action:** MODIFY
**Dependencies:** Task 3.1
**Details:**
- Add logging instructions
- Task IDs: setup, discover, generate, write, validate

### Task 3.6: Update tech-spec-review.md prompt
**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/tech-spec-review.md`
**Action:** MODIFY
**Dependencies:** Task 3.1
**Details:**
- Add logging instructions
- Task IDs: setup, analyze, fix, validate

### Task 3.7: Update dev-story.md prompt
**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/dev-story.md`
**Action:** MODIFY
**Dependencies:** Task 3.1
**Details:**
- Add logging instructions
- Task IDs: setup, implement, tests, lint, validate

### Task 3.8: Update code-review.md prompt
**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/code-review.md`
**Action:** MODIFY
**Dependencies:** Task 3.1
**Details:**
- Add logging instructions
- Task IDs: setup, analyze, fix, test, validate

---

## Phase 4: Integration

### Task 4.1: Update project-context-injection.sh
**File:** `_bmad/scripts/project-context-injection.sh`
**Action:** MODIFY
**Dependencies:** Task 1.1
**Details:**
- Add task-taxonomy.yaml content to injected context
- Inject after project context section
- Format as markdown code block

### Task 4.2: Manual testing
**Action:** TEST
**Dependencies:** All previous tasks
**Details:**
1. Create sample CSV with 7-column format
2. Verify dashboard parses correctly
3. Test expand/collapse functionality
4. Test with mixed 6-column and 7-column data
5. Verify messages display correctly
6. Test message truncation in shell script

---

## File Change Summary

| # | File | Action | Phase |
|---|------|--------|-------|
| 1 | `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml` | CREATE | 1 |
| 2 | `_bmad/scripts/orchestrator.sh` | MODIFY | 1 |
| 3 | `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md` | MODIFY | 1 |
| 4 | `docs/dashboard.html` | MODIFY | 2 |
| 5 | `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story.md` | MODIFY | 3 |
| 6 | `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story-discovery.md` | MODIFY | 3 |
| 7 | `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/story-review.md` | MODIFY | 3 |
| 8 | `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-tech-spec.md` | MODIFY | 3 |
| 9 | `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/tech-spec-review.md` | MODIFY | 3 |
| 10 | `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/dev-story.md` | MODIFY | 3 |
| 11 | `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/code-review.md` | MODIFY | 3 |
| 12 | `_bmad/scripts/project-context-injection.sh` | MODIFY | 4 |

---

## Estimated Implementation Sequence

```
Phase 1 (Infrastructure):
  1.1 Create task-taxonomy.yaml
  1.2 Update orchestrator.sh
  1.3 Update instructions.md

Phase 2 (Dashboard):
  2.1 Update CSV parser
  2.2 Update task data structure
  2.3 Add message display in timeline
  2.4 Implement expand/collapse toggle
  2.5 Update activity log
  2.6 Add CSS styles

Phase 3 (Prompts):
  3.1 Create logging template
  3.2-3.8 Update all prompt files

Phase 4 (Integration):
  4.1 Update project-context-injection.sh
  4.2 Manual testing
```

---

## Rollback Plan

If issues arise:
1. Dashboard: Revert to 6-column parsing (messages ignored)
2. Shell script: Remove message parameter, revert to 5 args
3. Prompts: Remove logging instructions (subagents use old format)

The system remains functional with old logs while new logs accumulate.
