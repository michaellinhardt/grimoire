# Implementation Plan: Sprint-Runner Logging Enhancements

**Date:** 2026-01-23
**Source:** change-report-sprint-runner-logging-2026-01-23.md
**Implementer:** BMAD Master

---

## 1. Change Summary

| # | Change | Description |
|---|--------|-------------|
| 1 | Rename log file | `orchestrator.md` -> `sprint-runner.csv` |
| 2 | Relocate log file | `_bmad-output/implementation-artifacts/` -> `./docs/` |
| 3 | Orchestrator logs only "start" | Remove result logging from orchestrator |
| 4 | Subagents log milestones | Each subagent logs its own progress |
| 5 | Subagents send "end" | All subagents must log "end" before terminating |
| 6 | Iteration numbering | Review commands include iteration number (e.g., `story-review-1`) |
| 7 | Preserve log history | Don't delete log file on cleanup (changed from previous behavior) |

---

## 2. Implementation Steps

### Step 1: Update orchestrator.sh

**File:** `_bmad/scripts/orchestrator.sh`

**Change:** Update OUTPUT_FILE path

**Current code (line 12):**
```bash
OUTPUT_FILE="${BMAD_OUTPUT:-_bmad-output}/implementation-artifacts/orchestrator.md"
```

**New code:**
```bash
OUTPUT_FILE="./docs/sprint-runner.csv"
```

---

### Step 2: Update instructions.md - File References

**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**Change 2a:** Update Orchestrator Log Format section (lines 29-45)

**Find this text:**
```markdown
## Orchestrator Log Format

Write to `{orchestrator_log}` in CSV format (no header):

```
unix_timestamp,epic_id,story_id,command,result
```

Use the script: `_bmad/scripts/orchestrator.sh <epic_id> <story_id> <command> <result>`

Example log entries:
```
1706054400,epic-2a,2a.1,create-story,start
1706054520,epic-2a,2a.1,create-story,Story file created
1706054521,epic-2a,2a.1,story-review,start
1706054620,epic-2a,2a.1,story-review,No critical issues
```
```

**Replace with:**
```markdown
## Orchestrator Log Format

Write to `./docs/sprint-runner.csv` in CSV format (no header):

```
unix_timestamp,epic_id,story_id,command,result
```

Use the script: `./_bmad/scripts/orchestrator.sh <epic_id> <story_id> <command> <result>`

**IMPORTANT:** Orchestrator only logs "start". Subagents log milestones and "end".

Example log entries:
```
1706054400,epic-2a,2a.1,create-story,start           # Orchestrator logs start
1706054500,epic-2a,2a.1,create-story,discovery-complete  # Subagent logs milestone
1706054520,epic-2a,2a.1,create-story,story-created       # Subagent logs milestone
1706054521,epic-2a,2a.1,create-story,end                 # Subagent logs end
1706054522,epic-2a,2a.1,story-review-1,start         # Orchestrator (iteration 1)
1706054620,epic-2a,2a.1,story-review-1,review-complete   # Subagent
1706054621,epic-2a,2a.1,story-review-1,no-issues         # Subagent
1706054622,epic-2a,2a.1,story-review-1,end               # Subagent
```
```

---

### Step 3: Update instructions.md - Cleanup Section

**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**Change:** Remove orchestrator.md deletion from cleanup, preserve sprint-runner.csv

**Find this text (lines 146-151):**
```markdown
      <!-- HIGH-4 Resolution: Delete orchestrator.md to prevent CSV-to-markdown corruption -->
      <action>Log: "Deleting orchestrator.md (will be recreated in CSV format)"</action>
      <check if="file exists: {implementation_artifacts}/orchestrator.md">
        <action>Log: "DELETING: {implementation_artifacts}/orchestrator.md"</action>
        <action>Delete: {implementation_artifacts}/orchestrator.md</action>
      </check>
```

**Replace with:**
```markdown
      <!-- LOG FILE PRESERVED: ./docs/sprint-runner.csv is NOT deleted -->
      <!-- Dashboard can filter by date, preserving history across runs -->
      <action>Log: "Log file preserved at ./docs/sprint-runner.csv"</action>
```

Also find (line 170):
```markdown
      NOTE: orchestrator.md has already been deleted by the orchestrator.
```

**Replace with:**
```markdown
      NOTE: sprint-runner.csv is preserved (not deleted) - history is kept.
```

---

### Step 4: Update instructions.md - Remove Result Logging

**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**Change:** Remove result logging after subagent completion. Subagents now log their own results.

**Find and REMOVE these lines throughout the file:**

**Line 292:**
```markdown
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story_keys] create-story "Story files created"</action>
```

**Line 333:**
```markdown
        <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] story-review "No critical issues"</action>
```

**Line 338:**
```markdown
      <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] story-review "Critical issues fixed, re-review"</action>
```

**Line 367:**
```markdown
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story_keys] create-tech-spec "Tech specs created"</action>
```

**Line 398:**
```markdown
        <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] tech-spec-review "No critical issues"</action>
```

**Line 403:**
```markdown
      <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] tech-spec-review "Critical issues fixed, re-review"</action>
```

**Line 419:**
```markdown
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] dev-story "Implementation complete"</action>
```

**Lines 445, 467, 474, 480, 495:**
Remove all code-review result logging (subagent handles it)

---

### Step 5: Update instructions.md - Iteration Numbering

**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**Change:** Append iteration number to review command names when logging start

**Find (line 318):**
```markdown
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] story-review start</action>
```

**Replace with:**
```markdown
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] story-review-[story_review_attempt] start</action>
```

**Find (line 382):**
```markdown
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] tech-spec-review start</action>
```

**Replace with:**
```markdown
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] tech-spec-review-[tech_spec_review_attempt] start</action>
```

**Find (line 425):**
```markdown
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] code-review start</action>
```

**Replace with:**
```markdown
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] code-review-[review_attempt] start</action>
```

---

### Step 6: Add Logging Instructions to Prompt Files

Add the logging section to each of the 8 prompt files. See Section 3 for the template.

---

## 3. Logging Template

### Base Template (add after "## Model Routing" section in each prompt file)

```markdown
---

## Logging Instructions

You MUST log your progress using the orchestrator script. Use the Bash tool to run:

```bash
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "result_message"
```

**Required logs:**
1. Log milestones as you complete them (see list below)
2. ALWAYS log "end" as your FINAL action before terminating

**Milestone logs for this workflow:**
[WORKFLOW-SPECIFIC MILESTONES - see below]

**Example:**
```bash
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "milestone-name"
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "end"
```
```

### Workflow-Specific Milestone Sections

**create-story.md:**
```markdown
**Milestone logs for this workflow:**
- `discovery-complete` - After discovery phase completes
- `story-created` - After story file is saved
- `end` - ALWAYS log this as your final action
```

**create-story-discovery.md:**
```markdown
**Milestone logs for this workflow:**
- `discovery-files-created` - After all discovery files are saved
- `end` - ALWAYS log this as your final action
```

**story-review.md:**
```markdown
**Milestone logs for this workflow:**
- `review-complete` - After review analysis is done
- `issues-fixed` - If you fixed issues (or `no-issues` if none found)
- `end` - ALWAYS log this as your final action
```

**create-tech-spec.md:**
```markdown
**Milestone logs for this workflow:**
- `investigation-complete` - After codebase investigation
- `spec-created` - After tech spec file is saved
- `end` - ALWAYS log this as your final action
```

**create-tech-spec-discovery.md:**
```markdown
**Milestone logs for this workflow:**
- `discovery-files-created` - After all discovery files are saved
- `end` - ALWAYS log this as your final action
```

**tech-spec-review.md:**
```markdown
**Milestone logs for this workflow:**
- `review-complete` - After review analysis is done
- `issues-fixed` - If you fixed issues (or `no-issues` if none found)
- `end` - ALWAYS log this as your final action
```

**dev-story.md:**
```markdown
**Milestone logs for this workflow:**
- `tests-written` - After tests are created
- `implementation-complete` - After code implementation is done
- `validation-passed` - After validation passes
- `end` - ALWAYS log this as your final action
```

**code-review.md:**
```markdown
**Milestone logs for this workflow:**
- `review-complete` - After code review analysis is done
- `issues-fixed` - If you fixed issues (or `zero-issues` if none found)
- `end` - ALWAYS log this as your final action
```

---

## 4. Variable Passing

The orchestrator must pass these variables to subagents via prompt substitution:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{epic_id}}` | Epic identifier | `epic-2a` |
| `{{story_id}}` | Story identifier | `2a.1` |
| `{{command}}` | Workflow command with iteration | `story-review-1`, `code-review-3` |

### Substitution in instructions.md

When the orchestrator loads a prompt file, it substitutes:
- `{{story_key}}` -> story identifier (e.g., `2a.1`)
- `{{implementation_artifacts}}` -> artifact path
- `{{review_attempt}}` -> iteration number

**New variables to add for logging:**
- `{{epic_id}}` -> extracted from story_key (e.g., `2a` from `2a.1`)
- `{{command}}` -> workflow name with iteration (e.g., `story-review-1`)

### Implementation in instructions.md

Add to Step 2b (story-review), Step 3b (tech-spec-review), Step 4 (code-review):

```markdown
<action>Set logging_command = "[workflow_name]-[iteration]"</action>
<action>Substitute {{command}} in prompt with logging_command</action>
<action>Substitute {{epic_id}} in prompt with current_epic</action>
<action>Substitute {{story_id}} in prompt with [story]</action>
```

---

## 5. Iteration Numbering

### Review Workflows

| Workflow | Max Iterations | Command Pattern |
|----------|----------------|-----------------|
| story-review | 3 | `story-review-1`, `story-review-2`, `story-review-3` |
| tech-spec-review | 3 | `tech-spec-review-1`, `tech-spec-review-2`, `tech-spec-review-3` |
| code-review | 10 | `code-review-1`, `code-review-2`, ... `code-review-10` |

### Non-Review Workflows

| Workflow | Command (no iteration) |
|----------|------------------------|
| create-story | `create-story` |
| create-story-discovery | `create-story-discovery` |
| create-tech-spec | `create-tech-spec` |
| create-tech-spec-discovery | `create-tech-spec-discovery` |
| dev-story | `dev-story` |

### Example Log Sequence

```csv
1706054400,epic-2a,2a.1,create-story,start
1706054410,epic-2a,2a.1,create-story,discovery-complete
1706054500,epic-2a,2a.1,create-story,story-created
1706054501,epic-2a,2a.1,create-story,end
1706054502,epic-2a,2a.1,story-review-1,start
1706054550,epic-2a,2a.1,story-review-1,review-complete
1706054560,epic-2a,2a.1,story-review-1,2-issues-fixed
1706054561,epic-2a,2a.1,story-review-1,end
1706054562,epic-2a,2a.1,story-review-2,start
1706054600,epic-2a,2a.1,story-review-2,review-complete
1706054601,epic-2a,2a.1,story-review-2,no-issues
1706054602,epic-2a,2a.1,story-review-2,end
```

---

## 6. Files Checklist

### Core Files

- [ ] `_bmad/scripts/orchestrator.sh` - Update OUTPUT_FILE path
- [ ] `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`
  - [ ] Update log format section
  - [ ] Update cleanup section (preserve log file)
  - [ ] Remove result logging after subagent calls
  - [ ] Add iteration numbers to review start logs
  - [ ] Add variable substitution for logging

### Prompt Files

- [ ] `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story.md`
- [ ] `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story-discovery.md`
- [ ] `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/story-review.md`
- [ ] `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-tech-spec.md`
- [ ] `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-tech-spec-discovery.md`
- [ ] `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/tech-spec-review.md`
- [ ] `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/dev-story.md`
- [ ] `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/code-review.md`

### Verification

After implementation:
- [ ] Run orchestrator.sh manually to verify new path works
- [ ] Verify ./docs/ directory exists or is created
- [ ] Test with sample sprint to verify subagent logging

---

## 7. Execution Order

1. **orchestrator.sh** - Single line change, foundational
2. **instructions.md** - Multiple changes, update file references first
3. **Prompt files** - Add logging sections to all 8 files
4. **Verification** - Test the changes

---

## 8. Rollback Plan

If issues occur:
1. Revert orchestrator.sh OUTPUT_FILE to original path
2. Revert instructions.md changes
3. Remove logging sections from prompt files

The log file format remains CSV, so existing dashboard parsing should work once path is updated.
