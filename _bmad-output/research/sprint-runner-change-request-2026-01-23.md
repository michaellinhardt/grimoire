# Sprint Runner Optimization - Change Request

**Date:** 2026-01-23
**Requested by:** Teazyou
**Status:** Validated

---

## Summary

Comprehensive optimization of the sprint-runner workflow to reduce token consumption, execution time, and context overhead while maintaining quality through pre-computed discovery and intelligent model routing.

---

## Change 1: Restructure orchestrator.md for Dashboard

### Description
Replace the current human-readable markdown log with a CSV-formatted file optimized for `dashboard.html` parsing.

### Implementation
Create `_bmad/scripts/orchestrator.sh` that:
- Takes arguments: `[epic_id] [story_id] [command] [start_or_result]`
- Appends CSV line to `{output_folder}/implementation-artifacts/orchestrator.md`
- Format: `unix_timestamp,epic_id,story_id,command,result`
- No header in file (dashboard knows the schema)
- `result="start"` logged before command execution
- `result="[actual result]"` logged after command completion

### Example Usage
```bash
./orchestrator.sh epic-1 2a.1 dev-story start
./orchestrator.sh epic-1 2a.1 dev-story "All tasks completed"
./orchestrator.sh epic-1 2a.1 code-review start
./orchestrator.sh epic-1 2a.1 code-review "ZERO ISSUES"
```

---

## Change 2: Extract Subagent Prompts to Files

### Description
Remove all `<subagent-prompt for="xxx">` blocks from `instructions.md` and save them as separate files, reducing orchestrator context size.

### Implementation
Create folder: `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/`

Files to create:
- `create-story.md` (CREATE MODE)
- `create-story-discovery.md` (DISCOVERY MODE - parallel with create)
- `story-review.md` (REVIEW MODE)
- `create-tech-spec.md` (CREATE MODE)
- `create-tech-spec-discovery.md` (DISCOVERY MODE - parallel with create)
- `tech-spec-review.md` (REVIEW MODE)
- `dev-story.md`
- `code-review.md`

The orchestrator will reference these by path instead of embedding full prompts.

---

## Change 3: Model Routing (Haiku for Reviews 2+)

### Description
Use Haiku model for all review iterations after the first one, per workflow type.

### Implementation
Add `model: "haiku"` parameter to Task tool calls when:
- `story_review_attempt >= 2`
- `tech_spec_review_attempt >= 2`
- `review_attempt >= 2` (code review)

### Routing Table
| Workflow | Review 1 | Review 2+ |
|----------|----------|-----------|
| create-story | default | default |
| story-review | default | haiku |
| create-tech-spec | default | default |
| tech-spec-review | default | haiku |
| dev-story | default | default |
| code-review | default | haiku |

---

## Change 4: Quality Gate Checklists (Better Upfront Specs)

### Description
Add mandatory quality gate checklists to create-story and create-tech-spec prompts to reduce review iterations.

### Implementation
Inject the checklists from the research file into:
- `prompts/create-story.md` - Story creation checklist
- `prompts/create-tech-spec.md` - Tech spec creation checklist

**Enforcement**: Each prompt MUST require output to include:
```
CHECKLIST COMPLETED: YES
```
This forces agents to explicitly confirm checklist completion before saving.

These checklists force self-review before output, reducing external review cycles.

---

## Change 5: Discovery File Generation (Review Step Skip)

### Description
First-run agents (create-story, create-tech-spec) generate discovery files that review agents consume, eliminating redundant discovery.

### Implementation

**Create-story (CREATE mode)** generates:
- `{implementation_artifacts}/{story_id}-discovery-story.md`

**Create-tech-spec (CREATE mode)** generates:
- `{implementation_artifacts}/{story_id}-discovery-tech.md`

**Review agents receive:**
- Project-level discovery file (see Change 8)
- Story-specific or tech-specific discovery file

**Review prompts include:**
- Explicit instruction to SKIP discovery steps
- List of steps to skip (from research file)
- Path to discovery files to read instead

---

## Change 6: Project Context Refresh Script

### Description
Shell script to check if project context needs regeneration.

### Implementation
Create `_bmad/scripts/project-context-should-refresh.sh`:
- Returns `TRUE` (exit 0) if:
  - `{output_folder}/planning-artifacts/project-context.md` does not exist
  - OR file is older than 6 hours
- When returning TRUE, also deletes existing file to force regeneration
- Returns `FALSE` (exit 1) otherwise

---

## Change 7: Project Context Injection Script

### Description
Shell script to inject project context into discovery files.

### Implementation
Create `_bmad/scripts/project-context-injection.sh`:
- Takes file path as argument
- Checks if `# Project Context Dump Below` header exists
- If found: exit (already injected)
- If not: append to file:
```markdown

# Project Context Dump Below
The project context from `{planning_artifacts}/project-context.md` is injected below. Do not read that file separately - use this content.

[contents of project-context.md]
```

---

## Change 8: Step 0 - Project Context Generation

### Description
Before the main loop starts, ensure project context is fresh.

### Implementation
Add Step 0 to orchestrator:
1. Run `project-context-should-refresh.sh`
2. If TRUE:
   - Spawn subagent with `/bmad:bmm:workflows:generate-project-context`
   - **CRITICAL**: Subagent must NOT read project-context.md before running the script (it may be deleted)
3. Project context is now available for all subsequent agents

---

## Change 9: Parallel Creation + Discovery (REVISED)

### Description
Run story/spec creation and discovery generation in parallel, then sequential reviews. This replaces the previous "project-level discovery as separate step" approach.

### Implementation - create-story Phase

**Step 1 (PARALLEL):**
- Agent A: `create-story CREATE MODE` - creates story files for 1-2 stories
- Agent B: `create-story DISCOVERY MODE` - generates `{story_id}-discovery-story.md` for each story

**DISCOVERY MODE prompt requirements:**
- Explicitly list ALL steps to skip (most of them - we ONLY want discovery output)
- Clear context about which stories to generate discovery for
- Enforced instruction: "Your ONLY task is to generate discovery files. Do not create story files."
- Output: One discovery file per story in `{implementation_artifacts}/`

**Step 2 (SEQUENTIAL):**
- `story-review MODE 1` (default model) - receives discovery file path
- `story-review MODE 2` (Haiku) - receives discovery file path
- (up to max 3 iterations)

### Implementation - create-tech-spec Phase

**Step 1 (PARALLEL):**
- Agent A: `create-tech-spec CREATE MODE` - creates tech specs for 1-2 stories
- Agent B: `create-tech-spec DISCOVERY MODE` - generates `{story_id}-discovery-tech.md` for each story

**Step 2 (SEQUENTIAL):**
- `tech-spec-review MODE 1` (default model) - receives discovery file path
- `tech-spec-review MODE 2` (Haiku) - receives discovery file path
- (up to max 3 iterations)

### New Prompt Files Required
Add to `prompts/` folder:
- `create-story-discovery.md` - DISCOVERY MODE for story phase
- `create-tech-spec-discovery.md` - DISCOVERY MODE for tech-spec phase

### Injection
After discovery files are created, run `project-context-injection.sh` on each to append project context.

---

## Change 10: Story Pairing (2 Stories Per Cycle)

### Description
Process 2 stories together in certain phases to reduce overhead, while maintaining sequential implementation.

### Rules
- Pair stories from SAME EPIC only
- If last story of epic: runs alone
- If batch_size=1: single story only
- If batch_size>1: process in pairs (e.g., 5 stories = 2+2+1)

### Pairing by Phase (Updated for Parallel Flow)

| Phase | Execution |
|-------|-----------|
| create-story CREATE | Parallel with Discovery - handles both stories |
| create-story DISCOVERY | Parallel with Create - generates discovery for both |
| story-review | Sequential per story - Review 1, then Review 2 (Haiku) |
| create-tech-spec CREATE | Parallel with Discovery - handles both stories |
| create-tech-spec DISCOVERY | Parallel with Create - generates discovery for both |
| tech-spec-review | Sequential per story - Review 1, then Review 2 (Haiku) |
| dev-story | **Sequential** (story 1 first, then story 2) |
| code-review | **Sequential** (story 1 loop, then story 2 loop) |

### File Naming (Always Single)
- `2a.1-discovery-story.md` (not `2a.1-2a.2-...`)
- `2a.2-discovery-story.md`
- Each story has its own discovery file
- Subagents are told the folder and naming convention to find them

---

## Change 11: Discovery File for Review Agents

### Description
Review agents skip discovery by consuming pre-generated files.

### Implementation
Each review agent receives paths to:
1. `{story_id}-discovery-project-level.md`
2. `{story_id}-discovery-story.md` (for story-review)
3. `{story_id}-discovery-tech.md` (for tech-spec-review)

Review prompt explicitly lists steps to SKIP (from research):

**story-review skips:** Steps 2, 3, 4
**tech-spec-review skips:** Steps 1.1-1.5, 2.2, 2.3, 3

---

## Change 12: Cleanup Before First Loop

### Description
Before starting the first loop iteration, clean all past artifacts from implementation-artifacts folder to start fresh.

### Implementation
Add to Step 0 (before main loop):
1. Orchestrator spawns BMAD Master subagent
2. Instruct: "Clean `_bmad-output/implementation-artifacts/` from all past story/spec/discovery files"
3. Preserve: `orchestrator.md`, `sprint-status.yaml`, any actively-in-progress files
4. Delete: All `*-discovery-*.md`, completed story files, completed tech-spec files

**Trigger**: Only on FIRST loop of a new sprint-runner session, not on subsequent loops.

---

## Change 13: Early Exit on Repeated Errors

### Description
If the same error pattern appears 3 times consecutively in code-review, exit early instead of looping to hard limit of 10.

### Implementation
In the code-review loop:
1. Parse error message/pattern from each review result
2. Store last 3 error patterns
3. If all 3 are identical (or substantially similar):
   - Log: "REPEATED ERROR DETECTED: Same issue found 3 times - human intervention required"
   - Exit loop early
   - Set story status to "blocked" (new status) or keep as "review"
   - Output clear message about the recurring issue

### Pattern Detection
- Compare error type/category (not exact string match)
- Examples of "same error":
  - "Missing test for function X" appearing 3 times
  - "Type error in file Y" appearing 3 times
- Agent decides if errors are "substantially similar"

---

## File Locations Summary

| File | Location |
|------|----------|
| orchestrator.sh | `_bmad/scripts/orchestrator.sh` |
| project-context-should-refresh.sh | `_bmad/scripts/project-context-should-refresh.sh` |
| project-context-injection.sh | `_bmad/scripts/project-context-injection.sh` |
| Subagent prompts (8 files) | `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/` |
| orchestrator.md | `{output_folder}/implementation-artifacts/orchestrator.md` |
| project-context.md | `{output_folder}/planning-artifacts/project-context.md` |
| Story discovery | `{output_folder}/implementation-artifacts/{story_id}-discovery-story.md` |
| Tech discovery | `{output_folder}/implementation-artifacts/{story_id}-discovery-tech.md` |

### Prompt Files (8 total)
```
prompts/
├── create-story.md           # CREATE MODE
├── create-story-discovery.md # DISCOVERY MODE (parallel)
├── story-review.md           # REVIEW MODE
├── create-tech-spec.md       # CREATE MODE
├── create-tech-spec-discovery.md # DISCOVERY MODE (parallel)
├── tech-spec-review.md       # REVIEW MODE
├── dev-story.md
└── code-review.md
```

---

## Execution Flow (Updated)

```
STEP 0: Initialization
  A. Run project-context-should-refresh.sh
     - If TRUE: spawn subagent to generate project context

  B. FIRST LOOP ONLY: Cleanup
     - Spawn BMAD Master to clean implementation-artifacts from past runs
     - Preserve orchestrator.md and sprint-status.yaml

MAIN LOOP (per story pair or single):
  1. Read sprint-status.yaml → find next 1-2 stories (same epic)

  2. CREATE-STORY PHASE (PARALLEL):
     - Agent A: create-story CREATE MODE → creates story files
     - Agent B: create-story DISCOVERY MODE → creates {story_id}-discovery-story.md
     - After both complete: run project-context-injection.sh on discovery files

  3. STORY-REVIEW PHASE (SEQUENTIAL):
     - story-review MODE 1 (default) → receives discovery file path
     - story-review MODE 2 (Haiku) → receives discovery file path
     - (max 3 iterations, skip if no critical issues)

  4. CREATE-TECH-SPEC PHASE (PARALLEL):
     - Agent A: create-tech-spec CREATE MODE → creates tech specs
     - Agent B: create-tech-spec DISCOVERY MODE → creates {story_id}-discovery-tech.md
     - After both complete: run project-context-injection.sh on discovery files

  5. TECH-SPEC-REVIEW PHASE (SEQUENTIAL):
     - tech-spec-review MODE 1 (default) → receives discovery file path
     - tech-spec-review MODE 2 (Haiku) → receives discovery file path
     - (max 3 iterations, skip if no critical issues)

  6. DEV + CODE-REVIEW PHASE (SEQUENTIAL per story):
     FOR story 1:
       a. dev-story
       b. code-review loop (Review 2+ uses Haiku)
          - Early exit if same error 3x consecutive
          - Max 10 iterations (hard limit)

     FOR story 2 (if paired):
       c. dev-story
       d. code-review loop (Review 2+ uses Haiku)

  7. Increment stories_completed by 1 or 2
  8. Check batch completion → continue or prompt

SUBAGENT RULES:
  - All autonomous (no human input)
  - Review 2+ uses Haiku model
  - All review agents receive discovery file paths (not content)
  - All review agents instructed to skip discovery steps
  - DISCOVERY MODE agents skip ALL steps except discovery output
  - Early exit on 3x repeated errors in code-review
```

---

## Expected Benefits

| Optimization | Impact |
|--------------|--------|
| Parallel creation + discovery | ~50% faster create phases |
| Pre-computed discovery | 6-11 min saved per story |
| Haiku for reviews 2+ | 30-40% faster reviews |
| Quality gate checklists | 50% fewer review iterations |
| Prompt extraction | Smaller orchestrator context |
| Story pairing | ~40% fewer agent spawns |
| CSV orchestrator.md | Faster dashboard parsing |
| Cleanup before run | Fresh start, no stale data |
| Early exit on repeated errors | Faster failure detection |

---

## Dependencies

- `dashboard.html` must be updated to parse CSV format
- Task tool must support `model` parameter for Haiku routing

---

## Open Questions (Resolved)

1. **orchestrator.md format**: CSV only, no human-readable ✓
2. **Story pairing**: Same epic only, last runs alone ✓
3. **Discovery naming**: Always single story ID ✓
4. **Project context path**: planning-artifacts ✓
5. **BMAD Master approach**: Use generate-project-context workflow ✓
6. **Haiku routing**: model parameter in Task tool ✓
7. **Prompts folder**: sprint-runner/prompts/ ✓
8. **Dev/review sequence**: Sequential per story ✓
