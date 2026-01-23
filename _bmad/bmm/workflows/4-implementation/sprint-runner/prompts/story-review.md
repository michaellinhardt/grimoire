# Story Review Subagent Prompt (REVIEW MODE)

## Variables
- `{{story_key}}` - The story identifier
- `{{implementation_artifacts}}` - Path to implementation artifacts folder
- `{{review_attempt}}` - Current review attempt number

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:create-story

Target story: {{story_key}} (status: ready-for-dev)
Story file: {{implementation_artifacts}}/{{story_key}}.md

MODE: REVIEW ONLY - The story already exists. Do NOT create a new story.

PRE-COMPUTED DISCOVERY AVAILABLE (HIGH-2 Resolution):
Read this discovery file first - it contains story context WITH project context already injected:
- {{implementation_artifacts}}/{{story_key}}-discovery-story.md

NOTE: Project context is ALREADY APPENDED to the discovery file (see "# Project Context Dump Below" section).
Do NOT read project-context.md separately - use the content already in the discovery file.

SKIP THESE STEPS ENTIRELY (use provided discovery file instead):
- Step 2 (Load and analyze core artifacts) - USE PROVIDED FILE
- Step 3 (Architecture analysis) - ALREADY IN DISCOVERY FILE
- Step 4 (Web research) - NOT NEEDED FOR REVIEW

EXECUTE THESE STEPS:
- Step 1: Identify the target story file to review
- Step 5: REVIEW (not create) the story file for:
  - Completeness against acceptance criteria
  - Alignment with architecture (from discovery files)
  - Missing technical requirements
  - Quality of Dev Notes section
- Step 6: Update sprint status only if issues found

When the workflow asks what to do, select:
"1. Review the story file for completeness"

CRITICAL INSTRUCTIONS:
- Review the existing story file for completeness and quality
- Fix ANY issues you find (critical, high, medium, low)
- You MUST make all decisions autonomously. No one will answer questions.
- Do NOT ask for confirmation. Fix everything you find.
- After fixing, report what critical issues were found and fixed

DECISION RULES:
- If the workflow asks for approval -> proceed without approval
- Always choose review/validate options when offered
- Never wait for human input. You ARE the decision maker.

IMPORTANT OUTPUT: At the end, clearly state:
- "CRITICAL ISSUES FOUND: [count]" or "NO CRITICAL ISSUES FOUND"
- This determines if another review pass is needed

---

## Logging Instructions

You MUST log your progress using the orchestrator script. Log START at beginning of task, END when complete.

**Format:** `./_bmad/scripts/orchestrator.sh <epicID> <storyID> <command> <task-id> <status>`
- epicID: Short numeric ID (e.g., `2a`, `2b`) - extract from story key
- storyID: Short numeric ID (e.g., `2a-1`, `2b-1`) - same as story key
- command: "story-review-{{review_attempt}}" (includes attempt number)
- task-id: identifies the granular task
- status: "start" or "end"

**IMPORTANT:** Always use SHORT NUMERIC IDs, never full story/epic titles.

**Required logs for this workflow:**

```bash
# At START of workflow
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} story-review-{{review_attempt}} workflow start

# At END of workflow (before terminating)
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} story-review-{{review_attempt}} workflow end
```

**CRITICAL:** Always log both START and END. Duration is calculated by dashboard (end - start).

---

## Model Routing
- Review 1: general-purpose
- Review 2+: haiku
