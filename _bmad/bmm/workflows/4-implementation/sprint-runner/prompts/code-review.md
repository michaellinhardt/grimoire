# Code Review Subagent Prompt

## Variables
- `{{story_key}}` - The story identifier
- `{{implementation_artifacts}}` - Path to implementation artifacts folder
- `{{review_attempt}}` - Current review attempt number

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:code-review

Target story: {{story_key}}
Story file: {{implementation_artifacts}}/{{story_key}}.md
Review attempt: {{review_attempt}}

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
- If the workflow asks "What should I do with these issues?" -> ALWAYS choose option 1 "Fix them automatically"
- If the workflow asks for approval -> proceed without approval, you have full authority.
- Never wait for human input. You ARE the decision maker.
- Be thorough in finding issues. The goal is quality, not speed.

---

## Logging Instructions

You MUST log your progress using the orchestrator script with granular task phases and descriptive messages.

**Format:** `./_bmad/scripts/orchestrator.sh <epicID> <storyID> <command> <task-id> <status> "<message>"`
- epicID: Short numeric ID (e.g., `2a`, `2b`) - extract from story key
- storyID: Short numeric ID (e.g., `2a-1`, `2b-1`) - same as story key
- command: "code-review-{{review_attempt}}" (includes attempt number)
- task-id: Phase from taxonomy (setup, analyze, fix, test, validate)
- status: "start" or "end"
- message: Descriptive text (max 150 chars, required)

**IMPORTANT:** Always use SHORT NUMERIC IDs, never full story/epic titles.

**Task phases for code-review (from task-taxonomy.yaml):**
- `setup` - Load story code and context
- `analyze` - Analyze code for issues
- `fix` - Apply fixes to code
- `test` - Re-run tests after fixes
- `validate` - Validate all fixes

**Message format:**
- Start: Describe what the task is about to do
- End: Describe outcome with metrics suffix `(metric:value)`
- Recommended metrics: files, issues, tests

**Required logs for this workflow:**

```bash
# At START of each phase
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} code-review-{{review_attempt}} setup start "Loading code for review ({{story_id}})"
# ... load code ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} code-review-{{review_attempt}} setup end "Code loaded (files:N)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} code-review-{{review_attempt}} analyze start "Analyzing code quality"
# ... analyze code ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} code-review-{{review_attempt}} analyze end "Analysis complete (issues:N found)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} code-review-{{review_attempt}} fix start "Applying code fixes"
# ... fix code ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} code-review-{{review_attempt}} fix end "Fixes applied (issues:N fixed)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} code-review-{{review_attempt}} test start "Re-running tests"
# ... run tests ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} code-review-{{review_attempt}} test end "Tests passed (tests:N)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} code-review-{{review_attempt}} validate start "Validating code review fixes"
# ... validate ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} code-review-{{review_attempt}} validate end "Validation passed"
```

**CRITICAL:** Always log both START and END for each phase. Replace N with actual counts.

---

## Model Routing
- Review 1: general-purpose
- Review 2+: haiku
