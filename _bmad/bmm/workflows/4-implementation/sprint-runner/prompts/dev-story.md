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

You MUST log your progress using the orchestrator script. Use the Bash tool to run:

```bash
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "result_message"
```

**Required logs:**
1. Log milestones as you complete them (see list below)
2. ALWAYS log "end" as your FINAL action before terminating

**Milestone logs for this workflow:**
- `tests-written` - After tests are created
- `implementation-complete` - After code implementation is done
- `validation-passed` - After validation passes
- `end` - ALWAYS log this as your final action

**Example:**
```bash
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "tests-written"
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "implementation-complete"
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "validation-passed"
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "end"
```

**CRITICAL:** Failure to log "end" will break duration tracking in the dashboard.

---

## Model Routing
- Default: general-purpose
