# Sprint Runner - Automated Implementation Orchestrator

<critical>DO NOT read any project documentation. Each subagent workflow has its own discovery step.</critical>
<critical>You are a lightweight coordinator. Your job is to loop commands and log results.</critical>

---

## Prompt Files Location

Subagent prompts are stored in: `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/`

Available prompts:
- `create-story.md` - CREATE MODE
- `create-story-discovery.md` - DISCOVERY MODE (parallel)
- `story-review.md` - REVIEW MODE
- `create-tech-spec.md` - CREATE MODE
- `create-tech-spec-discovery.md` - DISCOVERY MODE (parallel)
- `tech-spec-review.md` - REVIEW MODE
- `dev-story.md`
- `code-review.md`

To use a prompt:
1. Read the prompt file
2. Substitute variables: `{{story_key}}`, `{{implementation_artifacts}}`, `{{review_attempt}}`, `{{epic_id}}`, `{{story_id}}`, `{{command}}`
3. Pass the substituted prompt to Task tool

**Logging Variables:**
- `{{epic_id}}` - Extract from story_key (e.g., "2a" from "2a.1")
- `{{story_id}}` - Same as story_key (e.g., "2a.1")
- `{{command}}` - Workflow name with iteration for reviews (e.g., "story-review-1", "code-review-3")

---

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

<step n="0" goal="Initialize: project context, cleanup, and batch size">

  <!-- FIRST: Set iteration flag for cleanup safety (MEDIUM-5 Resolution) -->
  <action>Set is_first_iteration = true</action>

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

  <substep n="0b" goal="Cleanup from previous runs (FIRST ITERATION ONLY)">
    <!-- MEDIUM-5 Resolution: Only cleanup if first iteration flag is true -->
    <check if="is_first_iteration == true">
      <action>Log: "First iteration - cleaning implementation artifacts"</action>

      <!-- LOG FILE PRESERVED: ./docs/sprint-runner.csv is NOT deleted -->
      <!-- Dashboard can filter by date, preserving history across runs -->
      <action>Log: "Log file preserved at ./docs/sprint-runner.csv"</action>

      <action>Spawn BMAD Master subagent with Task tool</action>
      <subagent-prompt>
      AUTONOMOUS MODE - Clean implementation artifacts from previous runs.

      Clean the folder: {implementation_artifacts}/

      IMPORTANT: Log ALL files being deleted BEFORE deletion (MEDIUM-5 Resolution)

      DELETE these files (if they exist):
      - All files matching *-discovery-*.md
      - All completed story files (check sprint-status.yaml for "done" status)
      - All completed tech-spec files for done stories

      PRESERVE these files:
      - sprint-status.yaml
      - Any files for stories NOT in "done" status

      NOTE: sprint-runner.csv is preserved (not deleted) - history is kept.

      For each file to be deleted, output:
      "DELETING: [filepath]"

      After completion, output:
      "CLEANUP COMPLETE: Deleted [count] files"
      </subagent-prompt>
      <action>Wait for completion</action>
      <action>Log: "Cleanup complete"</action>

      <!-- Fresh orchestrator.md will be created by first orchestrator.sh call -->
    </check>

    <check if="is_first_iteration == false">
      <action>Log: "Not first iteration - skipping cleanup"</action>
    </check>
  </substep>

  <substep n="0c" goal="Determine batch size (moved from old Step 0)">
    <check if="user said 'all' (e.g., 'complete all', 'all stories', 'run all')">
      <action>Set batch_mode = "all"</action>
      <action>Set batch_size = infinite (no limit)</action>
      <action>Set stories_completed = 0</action>
      <action>Run: _bmad/scripts/orchestrator.sh batch-start all batch-init start</action>
      <action>Go to Step 1 immediately</action>
    </check>

    <check if="user provided batch size in command (e.g., 'complete 2 stories', 'run 3', '5 stories')">
      <action>Parse number from user input</action>
      <action>Set batch_mode = "fixed"</action>
      <action>Set batch_size = parsed number</action>
      <action>Set stories_completed = 0</action>
      <action>Run: _bmad/scripts/orchestrator.sh batch-start [batch_size] batch-init start</action>
      <action>Go to Step 1 immediately</action>
    </check>

    <check if="no batch size provided">
      <action>Set batch_mode = "fixed"</action>
      <action>Set batch_size = 2 (default)</action>
      <action>Set stories_completed = 0</action>
      <action>Log: "Using default batch size: 2"</action>
      <action>Run: _bmad/scripts/orchestrator.sh batch-start 2 batch-init start</action>
      <action>Go to Step 1</action>
    </check>
  </substep>

  <!-- AFTER CLEANUP: Clear iteration flag (MEDIUM-5 Resolution) -->
  <action>Set is_first_iteration = false</action>

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

  <!-- Story pairing logic (MEDIUM-3 Resolution: Epic extraction clarified) -->
  <action>Set first_story = first non-done, non-blocked story</action>
  <action>Extract first_story_epic = everything BEFORE the LAST dot in story key</action>
  <comment>Examples: "2a.1" -> epic "2a", "1.2.3" -> epic "1.2"</comment>

  <check if="batch_size == 1">
    <action>Set story_keys = [first_story]</action>
    <action>Log: "Single story mode: processing [first_story]"</action>
  </check>

  <check if="batch_size > 1">
    <action>Find second_story = next non-done, non-blocked story with SAME epic prefix</action>

    <check if="second_story exists AND same epic as first_story">
      <action>Set story_keys = [first_story, second_story]</action>
      <action>Log: "Paired stories: processing [first_story] and [second_story]"</action>
    </check>

    <check else>
      <action>Set story_keys = [first_story]</action>
      <action>Log: "Last story of epic: processing [first_story] alone"</action>
    </check>
  </check>

  <action>Store: story_keys, current_epic</action>
  <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story_keys] story-select start</action>
</step>

<step n="2" goal="CREATE-STORY PHASE (PARALLEL)">
  <check if="status == backlog">
    <action>Log: "Starting CREATE-STORY phase for [story_key(s)]"</action>
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story_keys] create-story start</action>

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

    <!-- POST-PARALLEL: Inject project context -->
    <for-each story in="story_keys">
      <action>Run: _bmad/scripts/project-context-injection.sh {{implementation_artifacts}}/{{story}}-discovery-story.md</action>
    </for-each>

    <action>Log: "CREATE-STORY phase complete, discovery files enriched"</action>
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
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] story-review-[story_review_attempt] start</action>

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

      <!-- Subagent logs milestones and "end" before terminating -->
      <action>Increment story_review_attempt</action>
      <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] story-review-[story_review_attempt] start</action>
    </loop>
  </for-each>

  <action>Go to Step 3 (CREATE-TECH-SPEC)</action>
</step>

<step n="3" goal="CREATE-TECH-SPEC PHASE (PARALLEL)">
  <action>Log: "Starting CREATE-TECH-SPEC phase for [story_key(s)]"</action>
  <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story_keys] create-tech-spec start</action>

  <!-- PARALLEL EXECUTION (CRITICAL-2 Resolution: Verified Task tool capability) -->
  <!-- Make TWO Task tool calls in a SINGLE message for concurrent execution -->
  <parallel-execution>
    <task-call id="1">
      <action>Load prompt from prompts/create-tech-spec.md, substitute variables</action>
      <action>Spawn subagent with Task tool (default model)</action>
      <goal>Create tech spec file(s)</goal>
    </task-call>

    <task-call id="2">
      <action>Load prompt from prompts/create-tech-spec-discovery.md, substitute variables</action>
      <action>Spawn subagent with Task tool (default model)</action>
      <goal>Generate tech discovery file(s)</goal>
    </task-call>
  </parallel-execution>

  <action>Wait for BOTH Task calls to complete</action>
  <!-- Subagents log their own milestones and "end" -->

  <!-- POST-PARALLEL: Inject project context -->
  <for-each story in="story_keys">
    <action>Run: _bmad/scripts/project-context-injection.sh {{implementation_artifacts}}/{{story}}-discovery-tech.md</action>
  </for-each>

  <action>Log: "CREATE-TECH-SPEC phase complete, discovery files enriched"</action>
  <action>Go to Step 3b (tech-spec review)</action>
</step>

<step n="3b" goal="TECH-SPEC-REVIEW PHASE (SEQUENTIAL)">
  <for-each story in="story_keys">
    <!-- MEDIUM-4 Resolution: Review counters are PER-STORY and reset for each story -->
    <action>Set tech_spec_review_attempt = 1</action>
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] tech-spec-review-[tech_spec_review_attempt] start</action>

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

      <!-- Subagent logs milestones and "end" before terminating -->
      <action>Increment tech_spec_review_attempt</action>
      <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] tech-spec-review-[tech_spec_review_attempt] start</action>
    </loop>
  </for-each>

  <action>Go to Step 4 (DEV + CODE-REVIEW)</action>
</step>

<step n="4" goal="DEV + CODE-REVIEW PHASE (SEQUENTIAL per story)">
  <for-each story in="story_keys">
    <action>Log: "Starting DEV phase for [story]"</action>
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] dev-story start</action>

    <!-- DEV-STORY -->
    <action>Load prompt from prompts/dev-story.md, substitute variables for [story]</action>
    <action>Spawn subagent with Task tool (default model)</action>
    <action>Wait for completion</action>
    <!-- Subagent logs milestones and "end" before terminating -->

    <!-- CODE-REVIEW LOOP -->
    <!-- MEDIUM-4 Resolution: Review counters are PER-STORY and reset for each story -->
    <action>Set review_attempt = 1</action>
    <action>Initialize error_history = []</action>
    <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] code-review-[review_attempt] start</action>

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

      <!-- Subagent logs milestones and "end" before terminating -->
      <action>Increment review_attempt</action>
      <action>Run: _bmad/scripts/orchestrator.sh [current_epic] [story] code-review-[review_attempt] start</action>
    </loop>
  </for-each>

  <action>Increment stories_completed by length of story_keys (count non-blocked)</action>
  <action>Go to Step 5 (batch tracking)</action>
</step>

<step n="5" goal="Error recovery">
  <critical>If any step fails or produces unexpected state:</critical>

  <action>Log error to orchestrator via: _bmad/scripts/orchestrator.sh [epic] [story] error "[details]"</action>
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

<step n="6" goal="Batch tracking and next story">
  <check if="batch_mode == 'all'">
    <action>Run: _bmad/scripts/orchestrator.sh batch [stories_completed] batch-progress "mode:ALL"</action>
    <action>Log: "Story batch complete. ([stories_completed] total, mode: ALL)"</action>
    <action>Go to Step 1 (next story - continues until all done)</action>
  </check>

  <check if="batch_mode == 'fixed'">
    <action>Run: _bmad/scripts/orchestrator.sh batch [stories_completed] batch-progress "[stories_completed]/[batch_size]"</action>

    <check if="stories_completed >= batch_size">
      <action>Run: _bmad/scripts/orchestrator.sh batch [batch_size] batch-complete "Batch done"</action>
      <output>
**Batch Complete!**

Stories completed this batch: [stories_completed]
Total in sprint-status.yaml done: [count from yaml]

Ready for next batch.
      </output>
      <action>Ask user: "How many stories for the next batch? (number or 'all')"</action>
      <action>Wait for user response</action>
      <check if="user said 'all'">
        <action>Set batch_mode = "all"</action>
        <action>Set batch_size = infinite</action>
      </check>
      <check if="user provided number">
        <action>Set batch_size = user's number</action>
      </check>
      <action>Set stories_completed = 0</action>
      <action>Run: _bmad/scripts/orchestrator.sh batch-start [batch_size] batch-init "New batch"</action>
    </check>

    <action>Go to Step 1 (next story)</action>
  </check>
</step>

---

## Execution Summary

```
START:
  0a. Run project-context-should-refresh.sh
      - If TRUE: spawn subagent to generate fresh project context
      - If FALSE: skip (context is fresh)

  0b. FIRST LOOP ONLY: Cleanup (is_first_iteration flag)
      - DELETE orchestrator.md (for CSV migration)
      - Spawn BMAD Master to clean discovery files and done story files
      - Log all deletions before deleting

  0c. Get batch_size from command or use default (2):
      - Number (e.g., "3") -> complete 3 stories then prompt
      - "all" -> complete ALL stories until sprint done
      - Default: 2 stories

LOOP (for each story or story pair):
  1. Read sprint-status.yaml -> find next 1-2 stories (same epic)
     - Story pairing: pair only from same epic
     - Last story of epic runs alone
     - batch_size=1 processes single story

  2. If status == backlog (PARALLEL):
     a. create-story (CREATE MODE) + create-story-discovery (DISCOVERY MODE)
        - TWO Task tool calls in single message (concurrent)
     b. Inject project context into discovery files
     c. story-review loop (sequential, Haiku for review 2+, max 3)

  3. create-tech-spec (PARALLEL):
     a. create-tech-spec (CREATE MODE) + create-tech-spec-discovery (DISCOVERY MODE)
        - TWO Task tool calls in single message (concurrent)
     b. Inject project context into discovery files
     c. tech-spec-review loop (sequential, Haiku for review 2+, max 3)

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

  5. Increment stories_completed by 1 or 2

  6. Check batch mode:
     - "all" -> next story pair
     - "fixed" + complete -> prompt for next batch
     - "fixed" + incomplete -> next story pair

SUBAGENT RULES:
  - All subagents run AUTONOMOUS (no human input)
  - Make all decisions independently
  - Review 2+: model: "haiku"
  - Review agents receive discovery file paths (context already injected)
  - Review agents skip discovery steps (use provided file)

LOG FORMAT:
  - CSV: unix_timestamp,epic_id,story_id,command,result
  - Via script: _bmad/scripts/orchestrator.sh
```

**Usage Examples:**
- `/sprint-runner` -> uses default batch size (2)
- `/sprint-runner 3` -> completes 3 stories then prompts
- `/sprint-runner all` -> runs until all stories done
- `/sprint-runner 1` -> processes one story at a time (no pairing)

<critical>BEGIN NOW. Parse batch size from command, run Step 0 (project context + cleanup), then start the loop.</critical>
