# Dev Story Subagent Prompt

## Variables
- `{{story_key}}` - The story identifier
- `{{implementation_artifacts}}` - Path to implementation artifacts folder

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:dev-story

Target story: {{story_key}}
Story file: {{implementation_artifacts}}/{{story_key}}.md
Tech spec file: {{implementation_artifacts}}/tech-spec-{{story_key}}.md

CRITICAL INSTRUCTIONS:
- You MUST make all decisions autonomously. No one will answer questions.
- If you encounter ambiguity, make a reasonable choice and document it.
- Complete ALL tasks and subtasks in the story file.
- Write tests, implement code, validate everything.
- Do NOT ask for confirmation. Do NOT pause for review.
- When done, the story status should be "review" in sprint-status.yaml.
- If you encounter blocking issues, document them in the story file and continue with what you can.

DECISION RULES:
- If the workflow asks for approval -> proceed without approval, you have full authority.
- If the workflow offers optional validation/review -> ALWAYS choose to validate/review.
- If multiple approaches exist -> choose the most thorough one.
- Never wait for human input. You ARE the decision maker.

---

## Logging Instructions

You MUST log your progress using the orchestrator script with granular task phases and descriptive messages.

**Format:** `./_bmad/scripts/orchestrator.sh <epicID> <storyID> <command> <task-id> <status> "<message>"`
- epicID: Short numeric ID (e.g., `2a`, `2b`) - extract from story key
- storyID: Short numeric ID (e.g., `2a-1`, `2b-1`) - same as story key
- command: "dev-story"
- task-id: Phase from taxonomy (setup, implement, tests, lint, validate)
- status: "start" or "end"
- message: Descriptive text (max 150 chars, required)

**IMPORTANT:** Always use SHORT NUMERIC IDs, never full story/epic titles.

**Task phases for dev-story (from task-taxonomy.yaml):**
- `setup` - Load story, tech-spec, and context
- `implement` - Write implementation code
- `tests` - Write and run tests
- `lint` - Run linting and formatting
- `validate` - Final validation

**Message format:**
- Start: Describe what the task is about to do
- End: Describe outcome with metrics suffix `(metric:value)`
- Recommended metrics: files, lines, tests

**Required logs for this workflow:**

```bash
# At START of each phase
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} dev-story setup start "Loading implementation context for {{story_id}}"
# ... load context ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} dev-story setup end "Context loaded (files:N)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} dev-story implement start "Implementing story code"
# ... write code ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} dev-story implement end "Implementation complete (files:N, lines:N)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} dev-story tests start "Writing and running tests"
# ... run tests ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} dev-story tests end "Tests complete (tests:N passed)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} dev-story lint start "Running lint and format"
# ... lint ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} dev-story lint end "Lint passed"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} dev-story validate start "Running final validation"
# ... validate ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} dev-story validate end "Validation passed"
```

**CRITICAL:** Always log both START and END for each phase. Replace N with actual counts.

---

## Model Routing
- Default: general-purpose
