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
- `background-review-chain.md` - Background review-2/3 chain (runs in parallel with next step)

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

Subagents write to `./docs/sprint-runner.csv` in CSV format (no header, 7 columns):

```
timestamp,epicID,storyID,command,task-id,status,"message"
```

**Column definitions:**
- `timestamp` - Unix epoch seconds
- `epicID` - Short epic identifier (e.g., "2a", "3b")
- `storyID` - Short story identifier (e.g., "2a-1", "3b-2")
- `command` - Workflow name (e.g., "create-story", "dev-story", "code-review-1")
- `task-id` - Task phase from taxonomy (e.g., "setup", "implement", "validate")
- `status` - Event status: "start" or "end"
- `message` - Descriptive message (required, max 150 chars, quoted for CSV)

**Task IDs:** See `task-taxonomy.yaml` for valid task IDs per command.

**Message format:**
- Start message: Describes what the task is about to do
- End message: Describes outcome with structured suffix format: `Text (metric:value, metric:value)`
- Recommended metrics: `files`, `lines`, `tests`, `issues`, `sections`

**Script usage:**
```bash
_bmad/scripts/orchestrator.sh <epic_id> <story_id> <command> <task_id> <status> "<message>"
```

**IMPORTANT:** The orchestrator does NOT log. Only subagents log using the script.

**Example log entries (from subagents):**
```csv
1706054400,2a,2a-1,create-story,setup,start,"Initializing story creation for 2a-1"
1706054402,2a,2a-1,create-story,setup,end,"Setup complete (files:1)"
1706054403,2a,2a-1,create-story,analyze,start,"Analyzing epic requirements"
1706054420,2a,2a-1,create-story,analyze,end,"Requirements analyzed (sections:4)"
1706054421,2a,2a-1,create-story,generate,start,"Generating story content"
1706054480,2a,2a-1,create-story,generate,end,"Story content generated (lines:85)"
1706054481,2a,2a-1,create-story,write,start,"Writing story file"
1706054485,2a,2a-1,create-story,write,end,"Story file written (files:1, lines:85)"
1706054486,2a,2a-1,create-story,validate,start,"Validating story structure"
1706054490,2a,2a-1,create-story,validate,end,"Validation passed (sections:5)"
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
    <action>Call: orchestrator.check_project_context_status() - returns "missing", "expired", or "fresh"</action>
    <!-- NOTE: Python implementation replaces shell script project-context-should-refresh.sh (Story 5-SR-4) -->

    <check if="status == 'missing'">
      <action>Log: "Project context missing, creating (blocking)"</action>
      <action>Emit WebSocket event: context:create with status=starting</action>
      <action>Log event to database: task_id=context, status=create</action>
      <action>Spawn subagent with generate-project-context workflow</action>
      <subagent-prompt>
      AUTONOMOUS MODE - Generate fresh project context.

      Run the workflow: /bmad:bmm:workflows:generate-project-context

      CRITICAL: Do NOT read project-context.md first - it may have been deleted.
      Run the workflow to generate a fresh copy.

      Output the file to: {planning_artifacts}/project-context.md
      </subagent-prompt>
      <action>WAIT for completion (blocking)</action>
      <action>Emit WebSocket event: context:create with status=complete</action>
    </check>

    <check if="status == 'expired'">
      <action>Log: "Project context expired, refreshing in background (non-blocking)"</action>
      <action>Create record in background_tasks table with task_type=project-context-refresh</action>
      <action>Log event to database: task_id=context, status=refresh</action>
      <action>Emit WebSocket event: context:refresh with status=started</action>
      <action>Spawn background task (asyncio.create_task) for refresh</action>
      <action>CONTINUE immediately without waiting</action>
      <action>Background task updates background_tasks.completed_at on finish</action>
      <action>Background task emits context:complete event when done</action>
    </check>

    <check if="status == 'fresh'">
      <action>Emit WebSocket event: context:fresh</action>
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

<step n="2b" goal="STORY-REVIEW PHASE (PARALLEL AFTER REVIEW-1)">
  <!-- REVIEW-1: Always runs first, blocks until complete -->
  <action>Load prompt from prompts/story-review.md</action>
  <action>Substitute {{story_key}} with comma-separated story_keys (e.g., "3a-1,3a-2")</action>
  <action>Substitute {{review_attempt}} = 1</action>
  <action>Spawn ONE subagent with Task tool (default model)</action>
  <action>Wait for completion</action>
  <comment>Subagent processes each story sequentially, logging start/end for each</comment>
  <action>Parse result for critical issues across ALL stories in batch</action>
  <action>Store has_critical_issues = true/false</action>

  <!-- FORK: Spawn background review chain if critical issues found -->
  <check if="has_critical_issues == true">
    <action>Log: "Critical issues found, spawning background review chain (story-review-2/3)"</action>
    <action>Load prompt from prompts/background-review-chain.md</action>
    <action>Substitute {{review_type}} = "story-review"</action>
    <action>Substitute {{story_keys}} with comma-separated story_keys</action>
    <action>Substitute {{prompt_file}} = "prompts/story-review.md"</action>
    <action>Spawn subagent with Task tool using run_in_background: true, model: "haiku"</action>
    <comment>Background chain runs review-2 → review-3 (if needed), does NOT block main flow</comment>
    <comment>Background chain does NOT update sprint-status</comment>
  </check>

  <check if="has_critical_issues == false">
    <action>Log: "Story review-1 passed for all stories, no background reviews needed"</action>
  </check>

  <!-- MAIN FLOW: Continue immediately to next step -->
  <check if="tech_spec_needed == true">
    <action>Go to Step 3 (CREATE-TECH-SPEC)</action>
  </check>

  <check if="tech_spec_needed == false">
    <action>Log: "All stories marked tech-spec as SKIP, proceeding directly to DEV"</action>
    <action>Go to Step 4 (DEV + CODE-REVIEW)</action>
  </check>
</step>

<step n="3" goal="CREATE-TECH-SPEC PHASE (CONDITIONAL)">
  <!-- This step only runs if tech_spec_needed == true -->
  <!-- ONE agent creates tech-specs for ALL stories in the batch -->

  <action>Log: "Starting CREATE-TECH-SPEC phase for [story_key(s)]"</action>

  <action>Load prompt from prompts/create-tech-spec.md</action>
  <action>Substitute {{story_key}} with comma-separated story_keys (e.g., "3a-1,3a-2")</action>
  <action>Spawn ONE subagent with Task tool (default model)</action>
  <goal>Create tech specs for all stories (processes sequentially, logs each)</goal>
  <action>Wait for completion</action>
  <comment>Subagent processes each story sequentially, logging start/end for each</comment>

  <!-- NOTE: Subagent does its own inline discovery for each story -->

  <action>Log: "CREATE-TECH-SPEC phase complete"</action>
  <action>Go to Step 3b (tech-spec review)</action>
</step>

<step n="3b" goal="TECH-SPEC-REVIEW PHASE (PARALLEL AFTER REVIEW-1)">
  <!-- REVIEW-1: Always runs first, blocks until complete -->
  <action>Load prompt from prompts/tech-spec-review.md</action>
  <action>Substitute {{story_key}} with comma-separated story_keys (e.g., "3a-1,3a-2")</action>
  <action>Substitute {{review_attempt}} = 1</action>
  <action>Spawn ONE subagent with Task tool (default model)</action>
  <action>Wait for completion</action>
  <comment>Subagent processes each story sequentially, logging start/end for each</comment>
  <action>Parse result for critical issues across ALL stories in batch</action>
  <action>Store has_critical_issues = true/false</action>

  <!-- FORK: Spawn background review chain if critical issues found -->
  <check if="has_critical_issues == true">
    <action>Log: "Critical issues found, spawning background review chain (tech-spec-review-2/3)"</action>
    <action>Load prompt from prompts/background-review-chain.md</action>
    <action>Substitute {{review_type}} = "tech-spec-review"</action>
    <action>Substitute {{story_keys}} with comma-separated story_keys</action>
    <action>Substitute {{prompt_file}} = "prompts/tech-spec-review.md"</action>
    <action>Spawn subagent with Task tool using run_in_background: true, model: "haiku"</action>
    <comment>Background chain runs review-2 → review-3 (if needed), does NOT block main flow</comment>
    <comment>Background chain does NOT update sprint-status</comment>
  </check>

  <check if="has_critical_issues == false">
    <action>Log: "Tech-spec review-1 passed for all stories, no background reviews needed"</action>
  </check>

  <!-- MAIN FLOW: Continue immediately to dev-story -->
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
  0a. Check project context status (Python: orchestrator.check_project_context_status())
      - If MISSING: spawn subagent to create project context (BLOCKING - wait)
      - If EXPIRED (>24h): spawn background refresh (NON-BLOCKING - continue immediately)
      - If FRESH: skip regeneration

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

  2. If status == backlog (PARALLEL - 2 agents):
     a. ONE create-story agent (handles ALL stories in batch sequentially)
        - Receives comma-separated story_keys (e.g., "3a-1,3a-2")
        - Processes each story, logs start/end for each
        - Outputs TECH-SPEC DECISION for each story
     b. ONE create-story-discovery agent (handles ALL stories in parallel)
        - Receives comma-separated story_keys
        - Creates discovery file for each story
     c. Inject project context into discovery files
     d. Parse TECH-SPEC DECISIONS from create-story output

  2b. STORY-REVIEW (PARALLEL AFTER REVIEW-1):
      - story-review-1 (default model) - BLOCKS until complete
      - After review-1 ends, FORK:
        ├── IF critical issues: spawn background chain (review-2 → review-3)
        │   - Uses Haiku model
        │   - Runs with run_in_background: true
        │   - Does NOT block main flow
        │   - Does NOT update sprint-status
        └── IMMEDIATELY continue to Step 3 or Step 4

  3. create-tech-spec (CONDITIONAL - 1 agent):
     - ONLY runs if tech_spec_needed == true (any story requires it)
     - If ALL stories marked SKIP, this phase is bypassed
     a. ONE create-tech-spec agent (handles ALL stories sequentially)
        - Receives comma-separated story_keys
        - Processes each story, logs start/end for each
        - Does inline discovery (no separate discovery files)

  3b. TECH-SPEC-REVIEW (PARALLEL AFTER REVIEW-1):
      - tech-spec-review-1 (default model) - BLOCKS until complete
      - After review-1 ends, FORK:
        ├── IF critical issues: spawn background chain (review-2 → review-3)
        │   - Uses Haiku model
        │   - Runs with run_in_background: true
        │   - Does NOT block main flow
        │   - Does NOT update sprint-status
        └── IMMEDIATELY continue to Step 4

  Note: Tech-spec decision is made by create-story subagent based on complexity.
  Decision output: [TECH-SPEC-DECISION: REQUIRED] or [TECH-SPEC-DECISION: SKIP]

  4. DEV + CODE-REVIEW (FULLY SEQUENTIAL per story):
     FOR each story:
       a. dev-story (default model)
       b. code-review loop (NO parallelism here):
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

PARALLEL REVIEW CHAINS (background-review-chain.md):
  - Spawned when review-1 finds critical issues
  - Run with run_in_background: true
  - Sequential within chain: review-2 → review-3 (if needed)
  - Use Haiku model for both review-2 and review-3
  - Do NOT update sprint-status (only fix files)
  - Do NOT block main flow
  - "Fire and forget" fix-up tasks
  - Main flow continues independently to next step

SUBAGENT RULES:
  - All subagents run AUTONOMOUS (no human input)
  - Make all decisions independently
  - Review 2+: model: "haiku"
  - ONE agent handles ALL stories in batch (1-2 stories)
  - Agent processes stories SEQUENTIALLY, logs start/end for EACH story
  - Prompts receive comma-separated story_keys (e.g., "3a-1,3a-2")
  - Story-review agents use discovery files (context already injected)
  - Tech-spec agents do inline discovery (no separate discovery files)
  - Background review chains are unaware they run in parallel

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
