# Sprint Runner - Automated Implementation Orchestrator

<critical>DO NOT read any project documentation. Each subagent workflow has its own discovery step.</critical>
<critical>You are a lightweight coordinator. Your job is to loop commands and log results.</critical>

---

## Prompt Files Location

Subagent prompts are stored in: `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/`

Available prompts:
- `create-story.md` - CREATE MODE (includes tech-spec decision)
- `create-story-discovery.md` - DISCOVERY MODE (parallel)
- `story-review.md` - REVIEW MODE
- `create-tech-spec.md` - CREATE MODE (includes inline discovery)
- `tech-spec-review.md` - REVIEW MODE
- `dev-story.md`
- `code-review.md`

Note: create-tech-spec-discovery.md has been removed. Tech-spec discovery is now inline.

To use a prompt:
1. Read the prompt file
2. Substitute variables: `{{story_key}}`, `{{implementation_artifacts}}`, `{{review_attempt}}`, `{{epic_id}}`, `{{story_id}}`, `{{command}}`
3. Pass the substituted prompt to Task tool

**Logging Variables:**
- `{{epic_id}}` - Short numeric ID extracted from story_key (e.g., "2a" from "2a-1")
- `{{story_id}}` - Short numeric ID, same as story_key (e.g., "2a-1", "2b-1")
- `{{command}}` - Workflow name with iteration for reviews (e.g., "story-review-1", "code-review-3")

**IMPORTANT:** Always use SHORT NUMERIC IDs, never full story titles or epic names.
- CORRECT: `2a`, `2a-1`, `2b-1`
- WRONG: `epic-2a-user-authentication`, `story-2b-1-login-feature`

**Tech-Spec Decision Variables:**
- `{{tech_spec_needed}}` - Boolean, true if any story in batch requires tech-spec
- `{{tech_spec_decisions}}` - Object mapping story_id to decision (REQUIRED/SKIP)

---

## Orchestrator Log Format

Subagents write to `./docs/sprint-runner.csv` in CSV format (no header):

```
timestamp,epicID,storyID,command,task-id,status
```

- `status` = "start" or "end"
- Duration is calculated by dashboard (matching start/end pairs)

**IMPORTANT:** The orchestrator does NOT log. Only subagents log using the script.

Example log entries (from subagents):
```
1706054400,2a,2a-1,create-story,workflow,start
1706054500,2a,2a-1,create-story,workflow,end
1706054501,2a,2a-1,story-discovery,workflow,start
1706054600,2a,2a-1,story-discovery,workflow,end
```

---

## Subagent Autonomy Rules (ENFORCE STRICTLY)

<critical>ALL subagents MUST operate with FULL AUTONOMY. Enforce these rules in EVERY subagent prompt:</critical>

1. **NO APPROVAL REQUESTS** - Subagents must NEVER ask for approval, confirmation, or user input. If they do, remind them: "You must take all decisions on your own. No human is available. Proceed with your best judgment."

2. **ALWAYS REVIEW BEFORE VALIDATE** - When a workflow offers optional review/validation steps, subagents MUST always choose to review first. Quality over speed.

3. **DECISION AUTHORITY** - Subagents have full authority to:
   - Choose implementation approaches
   - Select between options (always prefer thorough/review options)
   - Fix issues without asking
   - Make architectural micro-decisions
   - Skip only if genuinely not applicable

4. **REMINDER PHRASE** - If a subagent hesitates or asks for input, respond: "AUTONOMOUS MODE: Take the decision yourself. Choose the most thorough option. Proceed without confirmation."

---

## Understanding sprint-status.yaml

The `sprint-status.yaml` file is your source of truth. Read it to determine what to do.

### Status Definitions

**Story Status** (what you care about):
| Status | Meaning | Action |
|--------|---------|--------|
| `backlog` | Story exists only in epic file, not yet created | Run `create-story` |
| `ready-for-dev` | Story file exists, ready for implementation | Run `dev-story` |
| `in-progress` | Currently being implemented | Run `dev-story` (resume) |
| `review` | Implementation done, needs code review | Run `code-review` |
| `blocked` | Human intervention required | Skip, move to next |
| `done` | Story completed | Skip, move to next |

**Epic Status** (for context):
| Status | Meaning |
|--------|---------|
| `backlog` | Epic not started |
| `in-progress` | At least one story being worked |
| `done` | All stories completed |

### How to Read the YAML

```yaml
development_status:
  epic-1: in-progress          # Epic status (ignore for looping)
  1-1-some-story: done         # Story DONE - skip
  1-2-another-story: ready-for-dev  # Story READY - run dev-story
  1-3-third-story: backlog     # Story BACKLOG - run create-story first
  epic-1-retrospective: optional    # Retrospective (ignore)
```

**Selection Logic:**
1. Find the FIRST story (numerically sorted: 1-1 before 1-2 before 2-1) that is NOT `done` and NOT `blocked`
2. Based on its status, determine the workflow to run
3. Ignore keys starting with `epic-` or ending with `-retrospective`

---

## Workflow Steps

<step n="0" goal="Initialize: project context and batch size">

  <substep n="0a" goal="Check and refresh project context (C8)">
    <action>Run: _bmad/scripts/project-context-should-refresh.sh</action>

    <check if="script returns exit 0 (TRUE)">
      <action>Log: "Project context needs refresh"</action>
      <action>Spawn subagent with Task tool</action>
      <subagent-prompt>
      AUTONOMOUS MODE - Generate fresh project context.

      Run the workflow: /bmad:bmm:workflows:generate-project-context

      CRITICAL: Do NOT read project-context.md first - it may have been deleted.
      Run the workflow to generate a fresh copy.

      Output the file to: {planning_artifacts}/project-context.md
      </subagent-prompt>
      <action>Wait for completion</action>
      <action>Log: "Project context generated"</action>
    </check>

    <check if="script returns exit 1 (FALSE)">
      <action>Log: "Project context is fresh, skipping regeneration"</action>
    </check>
  </substep>

  <!-- NOTE: Cleanup (formerly Step 0b) has been moved to batch-commit workflow -->
  <!-- Cleanup now happens at end of each cycle, not at start -->

  <substep n="0b" goal="Determine number of cycles to run">
    <comment>
    CYCLE vs STORY: The number is CYCLES, not stories.
    Each cycle processes 1-2 stories:
    - 2 stories if next two are from same epic (paired)
    - 1 story if it's the last story of an epic (no pair available)
    So "run 2" means 2 cycles, which could complete 2-4 stories depending on pairing.
    </comment>

    <check if="user said 'all' (e.g., 'complete all', 'all stories', 'run all')">
      <action>Set batch_mode = "all"</action>
      <action>Set max_cycles = infinite (no limit)</action>
      <action>Set cycles_completed = 0</action>
      <action>Go to Step 1 immediately</action>
    </check>

    <check if="user provided number in command (e.g., 'run 2', '3 cycles', '5')">
      <action>Parse number from user input</action>
      <action>Set batch_mode = "fixed"</action>
      <action>Set max_cycles = parsed number</action>
      <action>Set cycles_completed = 0</action>
      <action>Go to Step 1 immediately</action>
    </check>

    <check if="no number provided">
      <action>Set batch_mode = "fixed"</action>
      <action>Set max_cycles = 2 (default)</action>
      <action>Set cycles_completed = 0</action>
      <action>Log: "Using default: 2 cycles"</action>
      <action>Go to Step 1</action>
    </check>
  </substep>

</step>

<step n="1" goal="Initialize and select next stories">
  <action>Record start time</action>
  <action>Read `{sprint_status_file}` completely</action>

  <check if="file not found">
    <output>HALT: sprint-status.yaml not found. Run `/sprint-planning` first.</output>
    <action>Exit</action>
  </check>

  <!-- Find stories to process -->
  <action>Parse all entries in `development_status` section</action>
  <action>Filter to story keys only (exclude `epic-*` and `*-retrospective`)</action>
  <action>Sort stories numerically (1-1, 1-2, 1-3, 2-1, 2-2, etc.)</action>
  <action>Find all stories where status != "done" AND status != "blocked"</action>

  <check if="all stories are done or blocked">
    <output>All stories in sprint-status.yaml are done or blocked. Sprint complete.</output>
    <action>Exit</action>
  </check>

  <!-- Story pairing logic: Always try to pair up to 2 stories from same epic -->
  <action>Set first_story = first non-done, non-blocked story</action>
  <action>Extract first_story_epic = everything BEFORE the LAST dash in story key</action>
  <comment>Examples: "2a-1" -> epic "2a", "2b-3" -> epic "2b"</comment>

  <action>Find second_story = next non-done, non-blocked story with SAME epic prefix</action>

  <check if="second_story exists AND same epic as first_story">
    <action>Set story_keys = [first_story, second_story]</action>
    <action>Log: "Cycle: paired [first_story] + [second_story] (same epic)"</action>
  </check>

  <check else>
    <action>Set story_keys = [first_story]</action>
    <action>Log: "Cycle: single [first_story] (last of epic or different epic next)"</action>
  </check>

  <action>Store: story_keys, current_epic</action>
</step>

<step n="2" goal="CREATE-STORY PHASE (PARALLEL)">
  <check if="status == backlog">
    <action>Log: "Starting CREATE-STORY phase for [story_key(s)]"</action>

    <!-- PARALLEL EXECUTION (CRITICAL-2 Resolution: Verified Task tool capability) -->
    <!-- Make TWO Task tool calls in a SINGLE message for concurrent execution -->
    <parallel-execution>
      <task-call id="1">
        <action>Load prompt from prompts/create-story.md, substitute variables</action>
        <action>Spawn subagent with Task tool (default model)</action>
        <goal>Create story file(s)</goal>
      </task-call>

      <task-call id="2">
        <action>Load prompt from prompts/create-story-discovery.md, substitute variables</action>
        <action>Spawn subagent with Task tool (default model)</action>
        <goal>Generate discovery file(s)</goal>
      </task-call>
    </parallel-execution>

    <action>Wait for BOTH Task calls to complete</action>
    <!-- Subagents log their own milestones and "end" -->

    <!-- POST-PARALLEL: Inject project context into story discovery -->
    <for-each story in="story_keys">
      <action>Run: _bmad/scripts/project-context-injection.sh {{implementation_artifacts}}/{{story}}-discovery-story.md</action>
    </for-each>

    <!-- PARSE TECH-SPEC DECISIONS -->
    <action>Initialize tech_spec_needed = false</action>
    <action>Initialize tech_spec_decisions = {}</action>

    <for-each story in="story_keys">
      <action>Parse create-story output for [TECH-SPEC-DECISION: REQUIRED] or [TECH-SPEC-DECISION: SKIP]</action>

      <check if="output contains '[TECH-SPEC-DECISION: REQUIRED]' (case-insensitive)">
        <action>Set tech_spec_decisions[story] = "REQUIRED"</action>
        <action>Set tech_spec_needed = true</action>
        <action>Log: "Story [story] tech-spec decision: REQUIRED"</action>
      </check>

      <check if="output contains '[TECH-SPEC-DECISION: SKIP]' (case-insensitive)">
        <action>Set tech_spec_decisions[story] = "SKIP"</action>
        <action>Log: "Story [story] tech-spec decision: SKIP"</action>
      </check>

      <check if="no decision found in output">
        <action>Set tech_spec_decisions[story] = "REQUIRED"</action>
        <action>Set tech_spec_needed = true</action>
        <action>Log: "WARNING: No tech-spec decision found for [story], defaulting to REQUIRED"</action>
      </check>
    </for-each>

    <action>Log: "CREATE-STORY phase complete. Tech-spec needed: [tech_spec_needed]"</action>
    <action>Go to Step 2b (story review)</action>
  </check>

  <check if="status == ready-for-dev">
    <action>Log: "Story already exists, skipping to tech-spec phase"</action>
    <action>Go to Step 3</action>
  </check>

  <check if="status == in-progress OR status == review">
    <action>Log: "Story in progress or review, skipping to Step 4 (DEV + CODE-REVIEW)"</action>
    <action>Go to Step 4</action>
  </check>
</step>

<step n="2b" goal="STORY-REVIEW PHASE (SEQUENTIAL)">
  <for-each story in="story_keys">
    <!-- MEDIUM-4 Resolution: Review counters are PER-STORY and reset for each story -->
    <action>Set story_review_attempt = 1</action>

    <loop max="3">
      <action>Load prompt from prompts/story-review.md, substitute variables</action>
      <check if="story_review_attempt >= 2">
        <!-- LOW-1 Resolution: Use model: "haiku" parameter -->
        <action>Spawn subagent with Task tool using model: "haiku"</action>
      </check>
      <check else>
        <action>Spawn subagent with Task tool (default model)</action>
      </check>
      <action>Wait for completion</action>
      <action>Parse result for critical issues</action>

      <check if="no critical issues found">
        <!-- Subagent logs its own "end" before terminating -->
        <action>Log: "Story review passed for [story]"</action>
        <action>Break loop</action>
      </check>

      <!-- Subagent logs milestones -->
      <action>Increment story_review_attempt</action>
    </loop>
  </for-each>

  <check if="tech_spec_needed == true">
    <action>Go to Step 3 (CREATE-TECH-SPEC)</action>
  </check>

  <check if="tech_spec_needed == false">
    <action>Log: "All stories marked tech-spec as SKIP, proceeding directly to DEV"</action>
    <action>Go to Step 4 (DEV + CODE-REVIEW)</action>
  </check>
</step>

<step n="3" goal="CREATE-TECH-SPEC PHASE (SEQUENTIAL - CONDITIONAL)">
  <!-- This step only runs if tech_spec_needed == true -->

  <action>Log: "Starting CREATE-TECH-SPEC phase for [story_key(s)]"</action>

  <!-- SEQUENTIAL EXECUTION - One tech-spec at a time, subagent does its own discovery -->
  <for-each story in="story_keys">
    <action>Load prompt from prompts/create-tech-spec.md, substitute variables for [story]</action>
    <action>Spawn subagent with Task tool (default model)</action>
    <goal>Create tech spec with inline discovery for [story]</goal>
    <action>Wait for completion</action>
    <!-- Subagent logs milestones and "end" -->
  </for-each>

  <!-- NOTE: No tech-discovery parallel execution -->
  <!-- NOTE: No project-context injection for tech-discovery files -->

  <action>Log: "CREATE-TECH-SPEC phase complete"</action>
  <action>Go to Step 3b (tech-spec review)</action>
</step>

<step n="3b" goal="TECH-SPEC-REVIEW PHASE (SEQUENTIAL)">
  <for-each story in="story_keys">
    <!-- MEDIUM-4 Resolution: Review counters are PER-STORY and reset for each story -->
    <action>Set tech_spec_review_attempt = 1</action>

    <loop max="3">
      <action>Load prompt from prompts/tech-spec-review.md, substitute variables</action>
      <check if="tech_spec_review_attempt >= 2">
        <!-- LOW-1 Resolution: Use model: "haiku" parameter -->
        <action>Spawn subagent with Task tool using model: "haiku"</action>
      </check>
      <check else>
        <action>Spawn subagent with Task tool (default model)</action>
      </check>
      <action>Wait for completion</action>
      <action>Parse result for critical issues</action>

      <check if="no critical issues found">
        <!-- Subagent logs its own "end" before terminating -->
        <action>Log: "Tech spec review passed for [story]"</action>
        <action>Break loop</action>
      </check>

      <!-- Subagent logs milestones -->
      <action>Increment tech_spec_review_attempt</action>
    </loop>
  </for-each>

  <action>Go to Step 4 (DEV + CODE-REVIEW)</action>
</step>

<step n="4" goal="DEV + CODE-REVIEW PHASE (SEQUENTIAL per story)">
  <for-each story in="story_keys">
    <action>Log: "Starting DEV phase for [story]"</action>

    <!-- DEV-STORY -->
    <action>Load prompt from prompts/dev-story.md, substitute variables for [story]</action>
    <action>Spawn subagent with Task tool (default model)</action>
    <action>Wait for completion</action>
    <!-- Subagent logs milestones and "end" before terminating -->

    <!-- CODE-REVIEW LOOP -->
    <!-- MEDIUM-4 Resolution: Review counters are PER-STORY and reset for each story -->
    <action>Set review_attempt = 1</action>
    <action>Initialize error_history = []</action>

    <loop max="10">
      <action>Load prompt from prompts/code-review.md, substitute variables for [story]</action>
      <check if="review_attempt >= 2">
        <!-- LOW-1 Resolution: Use model: "haiku" parameter -->
        <action>Spawn subagent with Task tool using model: "haiku"</action>
      </check>
      <check else>
        <action>Spawn subagent with Task tool (default model)</action>
      </check>
      <action>Wait for completion</action>
      <action>Parse result for issues and severity</action>
      <action>Store error_pattern in error_history[review_attempt]</action>

      <!-- Early exit on repeated errors (C13) -->
      <check if="review_attempt >= 3">
        <action>Compare error_history[review_attempt], error_history[review_attempt-1], error_history[review_attempt-2]</action>

        <check if="all three error patterns are substantially similar">
          <!-- Subagent will log "end" before terminating -->
          <action>Log: "Error pattern: [error_pattern]"</action>
          <action>Set story status to "blocked" in sprint-status.yaml</action>
          <output>
**ORCHESTRATOR STOPPED - REPEATED ERROR PATTERN**

Story: [story]
Error appeared 3 times consecutively: [error_pattern]

The same issue keeps recurring. This may indicate:
- A systemic problem in the codebase
- Missing dependencies or configuration
- An issue the automated review cannot fix

Please review manually and resolve before resuming.
          </output>
          <action>Break loop for this story (continue with next story if paired)</action>
        </check>
      </check>

      <check if="ZERO issues found">
        <action>Mark story as "done" in sprint-status.yaml</action>
        <!-- Subagent logs "zero-issues" and "end" before terminating -->
        <action>Log: "Story [story] completed with ZERO issues"</action>
        <action>Break loop</action>
      </check>

      <check if="review_attempt >= 3 AND no CRITICAL issues">
        <action>Mark story as "done" in sprint-status.yaml</action>
        <!-- Subagent logs "issues-fixed" and "end" before terminating -->
        <action>Log: "Story [story] completed after 3 reviews (non-critical may remain)"</action>
        <action>Break loop</action>
      </check>

      <check if="review_attempt >= 10">
        <!-- Subagent logs "end" before terminating -->
        <action>Log: "HARD LIMIT REACHED: 10 code reviews on story [story]"</action>
        <action>Set story status to "blocked" in sprint-status.yaml</action>
        <output>
**ORCHESTRATOR STOPPED - HUMAN REVIEW REQUIRED**

Story: [story]
Code reviews attempted: 10 (hard limit)
Issues keep recurring - possible systemic problem.

Please review the story manually and resolve before resuming.
        </output>
        <action>Break loop for this story</action>
      </check>

      <!-- Subagent logs milestones -->
      <action>Increment review_attempt</action>
    </loop>
  </for-each>

  <action>Increment cycles_completed by 1 (one cycle done, regardless of 1 or 2 stories)</action>
  <action>Go to Step 4c (batch-commit)</action>
</step>

<step n="4c" goal="BATCH-COMMIT PHASE">
  <action>Log: "Starting batch-commit for completed stories"</action>

  <!-- Collect story_keys from current cycle -->
  <action>Collect completed story IDs from story_keys (exclude any marked "blocked")</action>
  <action>Format as comma-separated list (e.g., "3a-1,3a-2")</action>

  <check if="no completed stories in cycle (all blocked)">
    <action>Log: "No completed stories to commit, skipping batch-commit"</action>
    <action>Go to Step 5 (error recovery) or Step 6 (cycle tracking)</action>
  </check>

  <action>Extract epic_id from story_keys (everything BEFORE last dash)</action>
  <comment>Examples: "3a-1" -> epic "3a", for multiple epics join with comma</comment>

  <action>Spawn subagent with Task tool</action>
  <subagent-prompt>
  AUTONOMOUS MODE - Run batch-commit workflow.

  Run the workflow: /bmad:bmm:workflows:batch-commit

  Parameters:
  - story_ids: {{completed_story_ids}}
  - epic_id: {{epic_id}}

  This workflow will:
  1. Archive completed story artifacts to archived-artifacts/
  2. Delete discovery files (intermediate files)
  3. Stage and commit all changes with message: feat({{epic_id}}): implement stories {{story_ids}}

  Execute with full autonomy. Handle errors gracefully.
  </subagent-prompt>

  <action>Wait for completion</action>
  <action>Log: "Batch-commit complete"</action>

  <action>Go to Step 5 (error recovery check) or Step 6 (cycle tracking)</action>
</step>

<step n="5" goal="Error recovery">
  <critical>If any step fails or produces unexpected state:</critical>

  <action>Log: "Error encountered: [details]"</action>
  <action>Re-read sprint-status.yaml to understand current state</action>

  <check if="story stuck in unexpected status">
    <action>Run `/bmad:bmm:workflows:sprint-status` via subagent to diagnose</action>
    <action>Based on sprint-status recommendation, resume appropriate workflow</action>
  </check>

  <check if="subagent returned error or incomplete">
    <action>Log: "Subagent error: [details]"</action>
    <action>Attempt to continue from current sprint-status.yaml state</action>
    <action>If 3 consecutive errors on same story, set story to "blocked" and skip to next story</action>
  </check>
</step>

<step n="6" goal="Cycle tracking and next iteration">
  <check if="batch_mode == 'all'">
    <action>Log: "Cycle [cycles_completed] complete. (mode: ALL - continuing)"</action>
    <action>Go to Step 1 (next cycle - continues until all done)</action>
  </check>

  <check if="batch_mode == 'fixed'">
    <check if="cycles_completed >= max_cycles">
      <output>
**Batch Complete!**

Cycles completed: [cycles_completed]
Total stories done in sprint-status.yaml: [count from yaml]

Ready for next batch.
      </output>
      <action>Ask user: "How many cycles for the next batch? (number or 'all')"</action>
      <action>Wait for user response</action>
      <check if="user said 'all'">
        <action>Set batch_mode = "all"</action>
        <action>Set max_cycles = infinite</action>
      </check>
      <check if="user provided number">
        <action>Set max_cycles = user's number</action>
      </check>
      <action>Set cycles_completed = 0</action>
    </check>

    <action>Go to Step 1 (next cycle)</action>
  </check>
</step>

---

## Execution Summary

```
START:
  0a. Run project-context-should-refresh.sh
      - If TRUE: spawn subagent to generate fresh project context
      - If FALSE: skip (context is fresh)

  0b. Get number of CYCLES from command or use default (2):
      - Number (e.g., "3") -> run 3 cycles then prompt
      - "all" -> run cycles until all stories done
      - Default: 2 cycles
      NOTE: Each cycle processes 1-2 stories (2 if same epic, 1 if last of epic)

LOOP (for each CYCLE):
  1. Read sprint-status.yaml -> find next 1-2 stories (same epic)
     - Story pairing: pair only from same epic (up to 2 stories)
     - Last story of epic runs alone (1 story)
     - Each iteration = 1 cycle, regardless of 1 or 2 stories

  2. If status == backlog (PARALLEL):
     a. create-story (CREATE MODE) + create-story-discovery (DISCOVERY MODE)
        - TWO Task tool calls in single message (concurrent)
     b. Inject project context into discovery files
     c. story-review loop (sequential, Haiku for review 2+, max 3)

  3. create-tech-spec (SEQUENTIAL - CONDITIONAL):
     - ONLY runs if tech_spec_needed == true (any story requires it)
     - If ALL stories marked SKIP, this phase is bypassed
     a. For each story: create-tech-spec (CREATE MODE with inline discovery)
        - SINGLE subagent per story (no parallel discovery)
        - Subagent performs its own discovery during spec creation
     b. tech-spec-review loop (sequential, Haiku for review 2+, max 3)

  Note: Tech-spec decision is made by create-story subagent based on complexity.
  Decision output: [TECH-SPEC-DECISION: REQUIRED] or [TECH-SPEC-DECISION: SKIP]

  4. DEV + CODE-REVIEW (SEQUENTIAL per story):
     FOR each story:
       a. dev-story (default model)
       b. code-review loop:
          - Review 1: default model
          - Review 2+: Haiku model
          - Early exit if same error 3x consecutive -> mark "blocked"
          - ZERO issues -> done
          - No critical after 3 -> done
          - Hard limit 10 -> mark "blocked"

  4c. BATCH-COMMIT (end of cycle):
      - Spawn batch-commit workflow with completed story IDs
      - Archives story artifacts to archived-artifacts/
      - Deletes discovery files (intermediate)
      - Commits all changes with: feat({epic}): implement stories {ids}
      - Skipped if all stories in cycle were blocked

  5. Error recovery (if needed)

  6. Check batch mode:
     - "all" -> next cycle (continues until all done)
     - "fixed" + cycles_completed >= max_cycles -> prompt for next batch
     - "fixed" + cycles remaining -> next cycle

SUBAGENT RULES:
  - All subagents run AUTONOMOUS (no human input)
  - Make all decisions independently
  - Review 2+: model: "haiku"
  - Review agents receive discovery file paths (context already injected)
  - Review agents skip discovery steps (use provided file)

LOG FORMAT:
  - CSV: timestamp,epicID,storyID,command,task-id,status
  - status = "start" or "end" (duration calculated by dashboard)
  - Subagents log via: _bmad/scripts/orchestrator.sh <epicID> <storyID> <command> <task-id> <status>
  - Use SHORT NUMERIC IDs only (e.g., "2a", "2a-1"), never full titles
  - Orchestrator does NOT log

GIT COMMITS:
  - Each cycle produces one git commit via batch-commit workflow
  - Commit message format: feat({epic_id}): implement stories {story_ids}
  - Artifacts archived to _bmad-output/archived-artifacts/
  - Discovery files deleted (not preserved)
```

**Usage Examples:**
- `/sprint-runner` -> runs 2 cycles (default), each cycle = 1-2 stories
- `/sprint-runner 3` -> runs 3 cycles then prompts (could complete 3-6 stories)
- `/sprint-runner all` -> runs cycles until all stories done
- `/sprint-runner 1` -> runs 1 cycle (1-2 stories depending on pairing)

**Cycle Math:**
- 1 cycle with paired stories (same epic) = 2 stories
- 1 cycle with unpaired story (last of epic) = 1 story
- "run 2" = 2 cycles = 2-4 stories depending on pairing

<critical>BEGIN NOW. Parse number of cycles from command, run Step 0 (project context check + batch size), then start the loop.</critical>
