# Sprint Runner - Automated Implementation Orchestrator

<critical>DO NOT read any project documentation. Each subagent workflow has its own discovery step.</critical>
<critical>You are a lightweight coordinator. Your job is to loop commands and log results.</critical>

---

## Batch Size Configuration

<step n="0" goal="Determine batch size">
  <check if="user said 'all' (e.g., 'complete all', 'all stories', 'run all')">
    <action>Set batch_mode = "all"</action>
    <action>Set batch_size = infinite (no limit)</action>
    <action>Set stories_completed = 0</action>
    <action>Log to orchestrator.md: "Batch started: ALL stories (until sprint complete)"</action>
    <action>Go to Step 1 immediately</action>
  </check>

  <check if="user provided batch size in command (e.g., 'complete 2 stories', 'run 3', '5 stories')">
    <action>Parse number from user input</action>
    <action>Set batch_mode = "fixed"</action>
    <action>Set batch_size = parsed number</action>
    <action>Set stories_completed = 0</action>
    <action>Log to orchestrator.md: "Batch started: [batch_size] stories"</action>
    <action>Go to Step 1 immediately</action>
  </check>

  <check if="no batch size provided">
    <action>Ask user: "How many stories to complete? (number or 'all')"</action>
    <action>Wait for user response</action>
    <check if="user said 'all'">
      <action>Set batch_mode = "all"</action>
      <action>Set batch_size = infinite</action>
    </check>
    <check if="user provided number">
      <action>Set batch_mode = "fixed"</action>
      <action>Set batch_size = user's number</action>
    </check>
    <action>Set stories_completed = 0</action>
    <action>Log to orchestrator.md: "Batch started: [batch_size] stories"</action>
    <action>Go to Step 1</action>
  </check>
</step>

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
1. Find the FIRST story (numerically sorted: 1-1 before 1-2 before 2-1) that is NOT `done`
2. Based on its status, determine the workflow to run
3. Ignore keys starting with `epic-` or ending with `-retrospective`

---

## Orchestrator Log Format

Write to `{orchestrator_log}` with this structure:

```markdown
# Sprint Runner Log

Started: [ISO timestamp]
Project: [project name]

---

## Story: [story-key]
Epic: [epic number]
Started: [ISO timestamp]

| Step | Command | Result | Duration |
|------|---------|--------|----------|
| 1 | create-story | Created story file | 2m 34s |
| 2 | story-review #1 | 2 critical issues fixed | 1m 45s |
| 3 | story-review #2 | No critical issues | 1m 12s |
| 4 | dev-story | All tasks completed | 15m 12s |
| 5 | code-review #1 | 2 issues found, fixed | 4m 08s |
| 6 | code-review #2 | 1 issue found, fixed | 3m 22s |
| 7 | code-review #3 | Clean - marked done | 2m 45s |

Story completed: [ISO timestamp]
Total duration: [duration]

---

## Story: [next-story-key]
...
```

---

## Workflow Steps

<step n="1" goal="Initialize and read sprint status">
  <action>Record start time</action>
  <action>Read `{sprint_status_file}` completely</action>

  <check if="file not found">
    <output>HALT: sprint-status.yaml not found. Run `/sprint-planning` first.</output>
    <action>Exit</action>
  </check>

  <action>Parse all entries in `development_status` section</action>
  <action>Filter to story keys only (exclude `epic-*` and `*-retrospective`)</action>
  <action>Sort stories numerically (1-1, 1-2, 1-3, 2-1, 2-2, etc.)</action>
  <action>Find the FIRST story where status != "done"</action>

  <check if="all stories are done">
    <action>Write to orchestrator.md: "All stories completed at [timestamp]"</action>
    <output>All stories in sprint-status.yaml are done. Sprint complete.</output>
    <action>Exit</action>
  </check>

  <action>Store: current_story_key, current_story_status, current_epic</action>
  <action>Initialize or append to `{orchestrator_log}`</action>
  <action>Log: "## Story: [current_story_key]" with epic and start timestamp</action>
</step>

<step n="2" goal="Determine and execute next workflow">
  <action>Based on current_story_status, determine workflow:</action>

  <check if="status == backlog">
    <action>Set workflow = "create-story"</action>
    <action>Set workflow_instruction = "Create the story file for [story_key]. Make all decisions autonomously - no human available."</action>
  </check>

  <check if="status == ready-for-dev OR status == in-progress">
    <action>Set workflow = "dev-story"</action>
    <action>Set workflow_instruction below</action>
  </check>

  <check if="status == review">
    <action>Set workflow = "code-review"</action>
    <action>Set review_attempt = 1</action>
    <action>Set workflow_instruction below</action>
  </check>

  <action>Record step start time</action>
  <action>Spawn subagent with Task tool (see Step 3)</action>
</step>

<step n="3" goal="Spawn subagent with autonomous instructions">
  <critical>Every subagent MUST receive these instructions:</critical>

  <subagent-prompt for="create-story">
  ```
  AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

  Run the workflow: /bmad:bmm:workflows:create-story

  Target: Create the next story from the epics. The sprint-status.yaml shows story [story_key] in backlog.

  CRITICAL INSTRUCTIONS:
  - You MUST make all decisions autonomously. No one will answer questions.
  - If you encounter ambiguity, make a reasonable choice and document it.
  - Your goal is to complete the task fully.
  - Do NOT ask for confirmation. Do NOT pause for review.
  - When done, the story status should be "ready-for-dev" in sprint-status.yaml.

  MANDATORY OPTION SELECTION:
  - When the workflow offers completion options, you MUST select:
    "1. Review the story file for completeness"
  - ALWAYS review before validating. Quality over speed.
  - If any step offers a "review" or "validate" option, choose REVIEW first.
  - Never skip review steps even if they appear optional.
  ```
  </subagent-prompt>

  <subagent-prompt for="dev-story">
  ```
  AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

  Run the workflow: /bmad:bmm:workflows:dev-story

  Target story: [story_key]
  Story file: {implementation_artifacts}/[story_key].md

  CRITICAL INSTRUCTIONS:
  - You MUST make all decisions autonomously. No one will answer questions.
  - If you encounter ambiguity, make a reasonable choice and document it.
  - Complete ALL tasks and subtasks in the story file.
  - Write tests, implement code, validate everything.
  - Do NOT ask for confirmation. Do NOT pause for review.
  - When done, the story status should be "review" in sprint-status.yaml.
  - If you encounter blocking issues, document them in the story file and continue with what you can.

  DECISION RULES:
  - If the workflow asks for approval → proceed without approval, you have full authority.
  - If the workflow offers optional validation/review → ALWAYS choose to validate/review.
  - If multiple approaches exist → choose the most thorough one.
  - Never wait for human input. You ARE the decision maker.
  ```
  </subagent-prompt>

  <subagent-prompt for="code-review">
  ```
  AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

  Run the workflow: /bmad:bmm:workflows:code-review

  Target story: [story_key]
  Story file: {implementation_artifacts}/[story_key].md
  Review attempt: [review_attempt]

  CRITICAL INSTRUCTIONS:
  - You MUST make all decisions autonomously. No one will answer questions.
  - Perform adversarial code review as the workflow instructs.
  - If you find ANY issues (CRITICAL, HIGH, MEDIUM, or LOW severity):
    - FIX THEM AUTOMATICALLY (choose option 1 "Fix them automatically" when prompted)
    - Do NOT create action items
    - Do NOT change story status to "done"
    - Keep story status as "review" so another review pass happens
  - ONLY if you find ZERO issues:
    - Mark story status as "done" in sprint-status.yaml
    - Update story file status to "done"
  - Do NOT ask for confirmation. Fix everything you find.

  IMPORTANT: After fixing issues, the story stays in "review" status for another review pass.

  MANDATORY OUTPUT FORMAT - At the end of your review, clearly state:
  - "HIGHEST SEVERITY: CRITICAL" or "HIGHEST SEVERITY: HIGH" or "HIGHEST SEVERITY: MEDIUM" or "HIGHEST SEVERITY: LOW" or "ZERO ISSUES"
  - Include counts: "Issues: X CRITICAL, X HIGH, X MEDIUM, X LOW"
  - This determines the re-review logic

  DECISION RULES:
  - If the workflow asks "What should I do with these issues?" → ALWAYS choose option 1 "Fix them automatically"
  - If the workflow asks for approval → proceed without approval, you have full authority.
  - Never wait for human input. You ARE the decision maker.
  - Be thorough in finding issues. The goal is quality, not speed.
  ```
  </subagent-prompt>

  <action>Use Task tool with subagent_type="general-purpose"</action>
  <action>Wait for subagent completion</action>
  <action>Record end time and calculate duration</action>
</step>

<step n="4" goal="Process subagent result and log">
  <action>Parse subagent result for outcome summary</action>
  <action>Log to orchestrator.md table: step number, command, one-sentence result, duration</action>

  <check if="workflow was code-review">
    <action>Re-read sprint-status.yaml to check current_story_key status</action>
    <action>Parse subagent result for highest severity found (CRITICAL/HIGH/MEDIUM/LOW/NONE)</action>
    <action>Increment review_attempt</action>

    <check if="review_attempt >= 10">
      <action>Log to orchestrator.md: "HARD LIMIT REACHED: 10 code reviews on story [story_key]"</action>
      <action>Log: "STOPPING - Human review required. Too many review cycles."</action>
      <output>
**ORCHESTRATOR STOPPED - HUMAN REVIEW REQUIRED**

Story: [story_key]
Code reviews attempted: 10 (hard limit)
Issues keep recurring - possible systemic problem.

Please review the story manually and resolve before resuming.
      </output>
      <action>EXIT workflow - do not continue</action>
    </check>

    <check if="status == done OR zero issues found">
      <action>Log: "Story completed - code review passed with ZERO issues"</action>
      <action>Go to Step 6 (batch tracking)</action>
    </check>

    <check if="CRITICAL issues found">
      <action>Log: "CRITICAL issues found and fixed, mandatory re-review (attempt [review_attempt]/10)"</action>
      <action>Go to Step 3 (another code-review)</action>
    </check>

    <check if="non-critical issues (HIGH/MEDIUM/LOW) AND review_attempt < 3">
      <action>Log: "Non-critical issues found, attempt [review_attempt] of 3"</action>
      <action>Go to Step 3 (another code-review)</action>
    </check>

    <check if="non-critical issues (HIGH/MEDIUM/LOW) AND review_attempt >= 3">
      <action>Log: "3 review attempts completed, non-critical issues may remain"</action>
      <action>Update sprint-status.yaml: set story to "done"</action>
      <action>Log: "Marked done after 3 review cycles (no critical issues)"</action>
      <action>Go to Step 6 (batch tracking)</action>
    </check>
  </check>

  <check if="workflow was create-story">
    <action>Re-read sprint-status.yaml to verify status changed to ready-for-dev</action>
    <action>Set story_review_attempt = 1</action>
    <action>Go to Step 4b (story review loop)</action>
  </check>

  <check if="workflow was story-review">
    <action>Parse subagent result for critical issues found</action>

    <check if="critical issues found AND story_review_attempt < 3">
      <action>Increment story_review_attempt</action>
      <action>Log: "Story review found critical issues, attempt [n] of 3"</action>
      <action>Go to Step 4b (another story-review)</action>
    </check>

    <check if="no critical issues OR story_review_attempt >= 3">
      <action>Log: "Story review complete, proceeding to dev-story"</action>
      <action>Go to Step 2 (run dev-story)</action>
    </check>
  </check>

  <check if="workflow was dev-story">
    <action>Re-read sprint-status.yaml to verify status changed to review</action>
    <action>Set review_attempt = 1</action>
    <action>Go to Step 2 (run code-review)</action>
  </check>
</step>

<step n="4b" goal="Story review loop after create-story">
  <critical>After create-story, we MUST review the story before dev-story</critical>

  <action>Record step start time</action>
  <action>Spawn NEW subagent with story-review instructions</action>

  <subagent-prompt for="story-review">
  ```
  AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

  Run the workflow: /bmad:bmm:workflows:create-story

  Target story: [story_key] (status: ready-for-dev)
  Story file: {implementation_artifacts}/[story_key].md

  MODE: REVIEW ONLY - The story already exists. Do NOT create a new story.

  When the workflow asks what to do, select:
  "1. Review the story file for completeness"

  CRITICAL INSTRUCTIONS:
  - Review the existing story file for completeness and quality
  - Fix ANY issues you find (critical, high, medium, low)
  - You MUST make all decisions autonomously. No one will answer questions.
  - Do NOT ask for confirmation. Fix everything you find.
  - After fixing, report what critical issues were found and fixed

  DECISION RULES:
  - If the workflow asks for approval → proceed without approval
  - Always choose review/validate options when offered
  - Never wait for human input. You ARE the decision maker.

  IMPORTANT OUTPUT: At the end, clearly state:
  - "CRITICAL ISSUES FOUND: [count]" or "NO CRITICAL ISSUES FOUND"
  - This determines if another review pass is needed
  ```
  </subagent-prompt>

  <action>Wait for subagent completion</action>
  <action>Record end time and calculate duration</action>
  <action>Log to orchestrator.md: step number, "story-review", result summary, duration</action>
  <action>Go to Step 4 to process story-review result</action>
</step>

<step n="5" goal="Error recovery">
  <critical>If any step fails or produces unexpected state:</critical>

  <action>Log error to orchestrator.md with full details</action>
  <action>Re-read sprint-status.yaml to understand current state</action>

  <check if="story stuck in unexpected status">
    <action>Run `/bmad:bmm:workflows:sprint-status` via subagent to diagnose</action>
    <action>Based on sprint-status recommendation, resume appropriate workflow</action>
  </check>

  <check if="subagent returned error or incomplete">
    <action>Log: "Subagent error: [details]"</action>
    <action>Attempt to continue from current sprint-status.yaml state</action>
    <action>If 3 consecutive errors on same story, log and skip to next story</action>
  </check>
</step>

<step n="6" goal="Batch tracking and next story">
  <action>Increment stories_completed by 1</action>

  <check if="batch_mode == 'all'">
    <action>Log to orchestrator.md: "Story [story_key] fully completed. ([stories_completed] total, mode: ALL)"</action>
    <action>Go to Step 1 (next story - continues until all done)</action>
  </check>

  <check if="batch_mode == 'fixed'">
    <action>Log to orchestrator.md: "Story [story_key] fully completed. ([stories_completed]/[batch_size])"</action>

    <check if="stories_completed >= batch_size">
      <action>Log to orchestrator.md: "=== BATCH COMPLETE: [batch_size] stories ==="</action>
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
      <action>Log to orchestrator.md: "New batch started: [batch_size] stories"</action>
    </check>

    <action>Go to Step 1 (next story)</action>
  </check>
</step>

---

## Execution Summary

```
START:
  0. Get batch_size from command or ask user:
     - Number (e.g., "3") → complete 3 stories then prompt
     - "all" → complete ALL stories until sprint done

LOOP:
  1. Read sprint-status.yaml → find first non-done story
  2. Determine workflow based on status:
     - backlog → create-story → story-review loop (until no critical issues)
     - ready-for-dev/in-progress → dev-story
     - review → code-review (max 3 attempts)
  3. Spawn subagent with AUTONOMOUS instructions
  4. Log result to orchestrator.md
  5. After create-story: spawn review subagent, repeat if critical issues
  6. After code-review clean or 3 attempts → mark done
  7. Increment stories_completed
  8. Check batch mode:
     - "all" → continue to next story (no prompt)
     - "fixed" + batch complete → prompt for next batch
     - "fixed" + batch not complete → continue to next story

BATCH COMPLETE (fixed mode only):
  - Report completion
  - Ask "How many stories for next batch? (number or 'all')"
  - Reset counter, continue loop
```

**Usage Examples:**
- `/sprint-runner` → asks "How many stories to complete?"
- `/sprint-runner 3` → completes 3 stories then prompts
- `/sprint-runner all` → runs until all stories done

<critical>BEGIN NOW. Check for batch size in command, or ask user, then start the loop.</critical>
