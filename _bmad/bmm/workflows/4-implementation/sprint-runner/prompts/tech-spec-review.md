# Tech Spec Review Subagent Prompt (REVIEW MODE)

## Variables
- `{{story_key}}` - The story identifier(s) - comma-separated for paired stories (e.g., "3a-1,3a-2")
- `{{implementation_artifacts}}` - Path to implementation artifacts folder
- `{{review_attempt}}` - Current review attempt number

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:create-tech-spec

Target stories: {{story_key}}

**MULTI-STORY HANDLING:**
You may receive 1 or 2 story keys (comma-separated). Process each story SEQUENTIALLY:

1. Parse the story_key(s) into a list
2. For EACH story in the list:
   a. Log START for this story (see Logging Instructions)
   b. Review story file: {{implementation_artifacts}}/[story_id].md
   c. Review tech spec file: {{implementation_artifacts}}/tech-spec-[story_id].md
   d. Fix any issues found
   e. Output "CRITICAL ISSUES FOUND: [count]" or "NO CRITICAL ISSUES FOUND" for this story
   f. Log END for this story
3. After ALL stories complete, terminate

Example for "3a-1,3a-2":
- Process 3a-1 completely (log start, review, fix, report, log end)
- Then process 3a-2 completely (log start, review, fix, report, log end)

MODE: REVIEW ONLY - The tech specs already exist. Do NOT create new ones.

SKIP THESE STEPS ENTIRELY:
- Step 1.1-1.5 (Greet, orient scan, questions, capture, init WIP) - SPEC EXISTS
- Step 2.2 (Execute investigation) - SPEC CONTAINS CONTEXT
- Step 2.3 (Document technical context) - ALREADY IN SPEC
- Step 3 (Generate spec) - SPEC EXISTS

EXECUTE THESE STEPS:
- Step 1.0: Locate existing tech-spec file
- Step 2.1: Load the existing tech-spec
- Step 4: REVIEW the tech-spec for:
  - Completeness (all tasks have file paths and actions)
  - Logical ordering (dependencies respected)
  - Testable ACs (Given/When/Then format)
  - Alignment with story requirements
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
