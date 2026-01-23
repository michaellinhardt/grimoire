# Tech Spec Review Subagent Prompt (REVIEW MODE)

## Variables
- `{{story_key}}` - The story identifier
- `{{implementation_artifacts}}` - Path to implementation artifacts folder
- `{{review_attempt}}` - Current review attempt number

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:create-tech-spec

Target story: {{story_key}}
Story file: {{implementation_artifacts}}/{{story_key}}.md
Tech spec file: {{implementation_artifacts}}/tech-spec-{{story_key}}.md

MODE: REVIEW ONLY - The tech spec already exists. Do NOT create a new one.

PRE-COMPUTED DISCOVERY AVAILABLE (HIGH-2 Resolution):
Read this discovery file first - it contains tech context WITH project context already injected:
- {{implementation_artifacts}}/{{story_key}}-discovery-tech.md

NOTE: Project context is ALREADY APPENDED to the discovery file (see "# Project Context Dump Below" section).
Do NOT read project-context.md separately - use the content already in the discovery file.

SKIP THESE STEPS ENTIRELY (use provided discovery file instead):
- Step 1.1-1.5 (Greet, orient scan, questions, capture, init WIP) - SPEC EXISTS
- Step 2.2 (Execute investigation) - USE PROVIDED FILE
- Step 2.3 (Document technical context) - ALREADY DOCUMENTED
- Step 3 (Generate spec) - SPEC EXISTS

EXECUTE THESE STEPS:
- Step 1.0: Locate existing tech-spec file
- Step 2.1: Load the existing tech-spec
- Step 4: REVIEW the tech-spec for:
  - Completeness (all tasks have file paths and actions)
  - Logical ordering (dependencies respected)
  - Testable ACs (Given/When/Then format)
  - Alignment with story requirements (from discovery files)
  - No placeholders or TBDs

When the workflow asks what to do, select the REVIEW option.

CRITICAL INSTRUCTIONS:
- Review the existing tech spec for completeness and quality
- Verify it aligns with the story requirements and acceptance criteria
- Check for missing components, unclear specifications, potential issues
- Fix ANY issues you find (critical, high, medium, low)
- You MUST make all decisions autonomously. No one will answer questions.
- Do NOT ask for confirmation. Fix everything you find.

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
- command: "tech-spec-review-{{review_attempt}}" (includes attempt number)
- task-id: identifies the granular task
- status: "start" or "end"

**IMPORTANT:** Always use SHORT NUMERIC IDs, never full story/epic titles.

**Required logs for this workflow:**

```bash
# At START of workflow
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} tech-spec-review-{{review_attempt}} workflow start

# At END of workflow (before terminating)
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} tech-spec-review-{{review_attempt}} workflow end
```

**CRITICAL:** Always log both START and END. Duration is calculated by dashboard (end - start).

---

## Model Routing
- Review 1: general-purpose
- Review 2+: haiku
