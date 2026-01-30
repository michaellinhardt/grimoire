# Sprint-Runner Loop Analysis

## Entry Point
- Batch size: user input -> "all" (infinite) or number (default=1)
- cycles_completed = 0
- batch_mode = "all" | "fixed"

## Main Loop (per cycle)

### Step 0: Initialize
**0a. Project Context Check:**
- Call `check_project_context_status()` -> returns "missing" | "expired" | "fresh"
- If MISSING: spawn generate-project-context (BLOCKING - wait)
- If EXPIRED (>24h): spawn background refresh (NON-BLOCKING - fire & forget)
- If FRESH: skip regeneration
- Copy project-context.md -> sprint-project-context.md (frozen for batch)

**0b. Batch Size:**
- Parse from command: number -> fixed mode, "all" -> infinite mode
- Default: 2 cycles

### Step 1: Story Selection
- Read sprint-status.yaml
- Filter: exclude `epic-*` and `*-retrospective` keys
- Filter: exclude `done` and `blocked` stories
- Sort numerically (1-1, 1-2, 2a-1, 2b-1, etc.)
- Find first non-done, non-blocked story
- Pair with second story IF same epic prefix
- Output: 1-2 story_keys

### Step 2: Create-Story (if status=backlog)
**PARALLEL EXECUTION:**
```
asyncio.gather(
    sprint-create-story(story_keys)       # Creates story files
    sprint-create-story-discovery(story_keys)  # Creates discovery files
)
```
- Both spawned simultaneously via Task tool
- Both wait to complete before continuing
- Post-parallel: inject project-context into discovery files
- Parse `[TECH-SPEC-DECISION: REQUIRED]` or `[TECH-SPEC-DECISION: SKIP]` from output
- Set `tech_spec_needed = true` if any story requires tech-spec

### Step 2b: Story-Review
- **Review-1**: BLOCKING (default model/Opus)
  - Receives project_context + discovery files via injection
  - Wait for completion
  - Parse for `[CRITICAL-ISSUES-FOUND: YES]`
- **If critical issues found**: spawn background chain (Haiku)
  - review-2 -> review-3 (if needed)
  - Fire & forget - does NOT block main flow
  - Does NOT update sprint-status
- **Continue immediately** to Step 3 or Step 4

### Step 3: Tech-Spec (conditional)
- **ONLY if** `tech_spec_needed == true`
- If ALL stories marked SKIP -> bypass this phase
- Single agent handles ALL stories sequentially
- Inline discovery (no separate discovery files)

### Step 3b: Tech-Spec-Review
- Same pattern as Step 2b:
  - Review-1: BLOCKING (default model)
  - If critical: spawn background chain (Haiku) - fire & forget
  - Continue immediately to Step 4

### Step 4: Dev + Code-Review (per story)
```
FOR each story in story_keys:
  update status -> "in-progress"

  sprint-dev-story(story_key)  # Single execution

  FOR attempt = 1 to 10:
    model = "haiku" if attempt >= 2 else default
    sprint-code-review(story_key, attempt)

    parse severity from output

    EXIT IF: severity == "ZERO"
      -> status = "done"

    EXIT IF: attempt >= 3 AND same_error_3x(history)
      -> status = "blocked"

    EXIT IF: attempt >= 3 AND severity != "CRITICAL"
      -> status = "done"

    EXIT IF: attempt == 10
      -> status = "blocked"
```
- Attempt 1: Default model (Opus)
- Attempt 2+: Haiku model
- Review counters reset PER STORY

### Step 4c: Batch-Commit
- Collect completed story IDs (exclude blocked)
- If no completed stories -> skip commit
- Capture `git status` for injection
- Spawn sprint-commit agent with:
  - Story files injection
  - Git status injection
- Workflow:
  1. Archive artifacts to `archived-artifacts/`
  2. Delete discovery files
  3. Git commit: `feat({epic_id}): implement stories {story_ids}`

### Step 5: Error Recovery
- If subagent error: attempt to continue from current state
- If 3 consecutive errors on same story: mark "blocked", skip to next
- Re-read sprint-status.yaml to understand current state

### Step 6: Loop Control
- `cycles_completed++`
- If `batch_mode == "all"` -> continue to Step 1
- If `batch_mode == "fixed"`:
  - If `cycles_completed >= max_cycles` -> prompt user for next batch
  - Else -> continue to Step 1

## Parallel vs Sequential Summary

| Phase | Parallel | Sequential |
|-------|----------|------------|
| Create-Story + Discovery | Yes | |
| Review background chains | Yes (async) | |
| Tech-spec creation | | Yes |
| Stories within batch (dev) | | Yes |
| Code-review attempts | | Yes |
| Batch-commit | | Yes (per cycle) |

## Model Usage

| Command | Model |
|---------|-------|
| create-story | Default (Opus) |
| create-story-discovery | Default (Opus) |
| story-review-1 | Default (Opus) |
| story-review-2/3 (background) | Haiku |
| create-tech-spec | Default (Opus) |
| tech-spec-review-1 | Default (Opus) |
| tech-spec-review-2/3 (background) | Haiku |
| dev-story | Default (Opus) |
| code-review-1 | Default (Opus) |
| code-review-2+ | Haiku |
| batch-commit | Default (Opus) |

## Exit Conditions

| Condition | Result |
|-----------|--------|
| All stories done/blocked | Sprint complete |
| Batch limit reached (fixed mode) | Prompt user |
| ZERO issues in code-review | Story done |
| Same error 3x consecutive | Story blocked |
| No critical after 3 reviews | Story done |
| 10 code-review attempts | Story blocked |
| Stop requested | Graceful shutdown |

## Key Files

| File | Purpose |
|------|---------|
| sprint-status.yaml | Source of truth for story states |
| sprint-project-context.md | Frozen project context for batch |
| sprint-{story_key}.md | Story definition |
| sprint-{story_key}-discovery-story.md | Discovery findings |
| sprint-tech-spec-{story_key}.md | Technical specification |
| sprint-runner.db | SQLite state database |

## Prompt Injection Architecture

Files are injected via `--prompt-system-append` flag:
```xml
<file_injections rule="DO NOT read these files - content already provided">
  <file path="_bmad-output/planning-artifacts/sprint-project-context.md">
    <!-- frozen project context -->
  </file>
  <file path="_bmad-output/implementation-artifacts/sprint-2a-1-discovery-story.md">
    <!-- discovery findings -->
  </file>
</file_injections>
```

Injection contents vary by phase:
- **create-story**: project_context only
- **discovery**: project_context only
- **story-review**: project_context + discovery
- **tech-spec**: project_context + discovery
- **tech-spec-review**: project_context + discovery + tech_spec
- **dev-story**: project_context + discovery + tech_spec
- **code-review**: project_context + discovery + tech_spec
- **batch-commit**: story files + git_status
