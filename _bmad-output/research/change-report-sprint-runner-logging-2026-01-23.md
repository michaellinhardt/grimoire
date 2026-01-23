# Change Report: Sprint-Runner Logging Enhancements

**Date:** 2026-01-23
**Scope:** Sprint-runner workflow and subagent prompts
**Related:** dashboard.html changes (separate report)

---

## Summary

Enhance the sprint-runner logging system to:
1. Rename output file from `orchestrator.md` to `sprint-runner.csv`
2. Move file location from `_bmad-output/implementation-artifacts/` to `./docs/`
3. Have subagents log their actions (not just orchestrator)
4. Subagents send "end" before terminating
5. Orchestrator only sends "start", subagents handle the rest

---

## Change 1: Rename and Relocate Log File

### Current
- File: `_bmad-output/implementation-artifacts/orchestrator.md`
- Format: CSV (despite .md extension)

### New
- File: `./docs/sprint-runner.csv`
- Format: CSV

### Files to Modify
- `_bmad/scripts/orchestrator.sh` - Update OUTPUT_FILE path
- `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md` - Update file references

---

## Change 2: Update orchestrator.sh

### Current Behavior
- Outputs to: `${BMAD_OUTPUT:-_bmad-output}/implementation-artifacts/orchestrator.md`

### New Behavior
- Outputs to: `./docs/sprint-runner.csv`
- Path is relative from project root

### Script Update
```bash
OUTPUT_FILE="./docs/sprint-runner.csv"
```

---

## Change 3: Orchestrator Sends Only "start"

### Current Behavior
- Orchestrator sends both "start" and result

### New Behavior
- Orchestrator sends "start" only
- Subagents send action logs and "end"

### Files to Modify
- `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`
  - Remove result logging after subagent completion
  - Keep only "start" logging before spawning subagent

---

## Change 4: Subagent Logging Instructions

All 8 prompt files need instructions to:
1. Use the SH script to log major milestones
2. Send "end" before terminating

### Script Usage Pattern
```bash
./_bmad/scripts/orchestrator.sh [epic_id] [story_id] [command] [result]
```

### Logging Granularity (Medium - Milestones)

**create-story.md:**
- `discovery-complete` - After discovery phase
- `story-created` - After story file saved
- `end` - Before terminating

**create-story-discovery.md:**
- `discovery-files-created` - After all discovery files saved
- `end` - Before terminating

**story-review.md:**
- `review-complete` - After review analysis
- `issues-fixed` - If issues were fixed (or `no-issues`)
- `end` - Before terminating

**create-tech-spec.md:**
- `investigation-complete` - After codebase investigation
- `spec-created` - After tech spec saved
- `end` - Before terminating

**create-tech-spec-discovery.md:**
- `discovery-files-created` - After all discovery files saved
- `end` - Before terminating

**tech-spec-review.md:**
- `review-complete` - After review analysis
- `issues-fixed` - If issues were fixed (or `no-issues`)
- `end` - Before terminating

**dev-story.md:**
- `tests-written` - After tests created
- `implementation-complete` - After code implemented
- `validation-passed` - After validation
- `end` - Before terminating

**code-review.md:**
- `review-complete` - After code review analysis
- `issues-fixed` - If issues were fixed (or `zero-issues`)
- `end` - Before terminating

---

## Change 5: Review Iteration Logging

Each review iteration logs separately with iteration number in command:

### Pattern
```
timestamp,epic-1,2a.1,story-review-1,start      # Orchestrator
timestamp,epic-1,2a.1,story-review-1,review-complete
timestamp,epic-1,2a.1,story-review-1,2-issues-fixed
timestamp,epic-1,2a.1,story-review-1,end        # Subagent
timestamp,epic-1,2a.1,story-review-2,start      # Orchestrator (iteration 2)
timestamp,epic-1,2a.1,story-review-2,no-issues
timestamp,epic-1,2a.1,story-review-2,end        # Subagent
```

### Files to Modify
- `instructions.md` - Append iteration number to command when logging
- Review prompts - Include iteration number in their logs

---

## Change 6: Prompt File Updates

### Template Addition for All Prompts

Add to each prompt file:

```markdown
## Logging Instructions

You MUST log your progress using the orchestrator script. Use the Bash tool to run:

```bash
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "result_message"
```

**Required logs:**
1. Log milestones as you complete them (see list below)
2. ALWAYS log "end" as your FINAL action before terminating

**Milestone logs for this workflow:**
[workflow-specific milestones]

**Example:**
```bash
./_bmad/scripts/orchestrator.sh epic-1 2a.1 dev-story "tests-written"
./_bmad/scripts/orchestrator.sh epic-1 2a.1 dev-story "implementation-complete"
./_bmad/scripts/orchestrator.sh epic-1 2a.1 dev-story "end"
```
```

---

## Change 7: Cleanup Step Update

### Current
- Deletes `orchestrator.md` from `implementation-artifacts`

### New
- Deletes `sprint-runner.csv` from `./docs/`
- Or: Don't delete (preserve history across runs)

### Decision Needed
Since the file is now in `./docs/`, should cleanup:
- **A)** Still delete it for fresh start
- **B)** Preserve it (append to existing)

**Recommendation:** B - Preserve history, dashboard can filter by date

---

## Files to Modify Summary

| File | Changes |
|------|---------|
| `_bmad/scripts/orchestrator.sh` | Update OUTPUT_FILE to `./docs/sprint-runner.csv` |
| `instructions.md` | Remove result logging, update file references, add iteration numbers |
| `prompts/create-story.md` | Add logging instructions section |
| `prompts/create-story-discovery.md` | Add logging instructions section |
| `prompts/story-review.md` | Add logging instructions section |
| `prompts/create-tech-spec.md` | Add logging instructions section |
| `prompts/create-tech-spec-discovery.md` | Add logging instructions section |
| `prompts/tech-spec-review.md` | Add logging instructions section |
| `prompts/dev-story.md` | Add logging instructions section |
| `prompts/code-review.md` | Add logging instructions section |

---

## Variables Passed to Subagents

The orchestrator must pass these variables to subagents for logging:
- `{{epic_id}}` - e.g., `epic-1`
- `{{story_id}}` - e.g., `2a.1`
- `{{command}}` - e.g., `dev-story`, `story-review-1`

These should be included in the prompt or as context.
