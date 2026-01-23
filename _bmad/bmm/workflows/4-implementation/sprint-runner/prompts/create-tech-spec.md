# Create Tech Spec Subagent Prompt (CREATE MODE)

## Variables
- `{{story_key}}` - The story identifier
- `{{implementation_artifacts}}` - Path to implementation artifacts folder

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:create-tech-spec

Target story: {{story_key}}
Story file: {{implementation_artifacts}}/{{story_key}}.md

CRITICAL INSTRUCTIONS:
- Create a technical specification for implementing this story
- You MUST make all decisions autonomously. No one will answer questions.
- Read the story file to understand requirements and acceptance criteria
- Design the technical approach, data structures, APIs, components needed
- Do NOT ask for confirmation. Complete the tech spec fully.
- Save the tech spec in the appropriate location

DECISION RULES:
- If the workflow asks for approval -> proceed without approval
- If multiple approaches exist -> choose the most robust one
- Never wait for human input. You ARE the decision maker.

DISCOVERY INSTRUCTIONS:
You are responsible for your own technical discovery. As part of creating the tech spec:
- Explore the codebase to understand existing patterns
- Identify relevant files and dependencies
- Analyze architectural constraints
- Document your findings IN the tech spec itself (not a separate file)

Do NOT create a separate discovery file. Integrate all technical context into the spec.

CHECKLIST ENFORCEMENT:
Before saving the tech spec, you MUST verify against this checklist and output:
"CHECKLIST COMPLETED: YES"

## READY FOR DEVELOPMENT STANDARD:
- [ ] ACTIONABLE: Every task has clear file path AND specific action
- [ ] LOGICAL: Tasks ordered by dependency (lowest level first)
- [ ] TESTABLE: All ACs use Given/When/Then format
- [ ] COMPLETE: No placeholders, no "TBD", no "TODO"
- [ ] SELF-CONTAINED: A fresh agent can implement without reading conversation history

## SPECIFIC CHECKS:
- [ ] Files to Reference table is populated with real paths
- [ ] Codebase Patterns section matches actual project patterns
- [ ] Implementation tasks are numbered and sequenced
- [ ] Dependencies section lists any required prior work
- [ ] Testing Strategy specifies test types and locations

## DISASTER PREVENTION:
- [ ] No task requires "figure out" or "research" - all decided upfront
- [ ] No ambiguous instructions that could be interpreted multiple ways
- [ ] Scope boundaries are explicit (what NOT to do)

IF ANY CHECK FAILS: Fix it before saving. Do not output an incomplete spec.

IMPORTANT OUTPUT: At the end, clearly state:
- "TECH SPEC CREATED: [filename]"
- Location where the tech spec was saved

---

## Logging Instructions

You MUST log your progress using the orchestrator script. Log START at beginning of task, END when complete.

**Format:** `./_bmad/scripts/orchestrator.sh <epicID> <storyID> <command> <task-id> <status>`
- epicID: Short numeric ID (e.g., `2a`, `2b`) - extract from story key
- storyID: Short numeric ID (e.g., `2a-1`, `2b-1`) - same as story key
- command: "create-tech-spec"
- task-id: identifies the granular task
- status: "start" or "end"

**IMPORTANT:** Always use SHORT NUMERIC IDs, never full story/epic titles.

**Required logs for this workflow:**

```bash
# At START of workflow
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec workflow start

# At END of workflow (before terminating)
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec workflow end
```

**CRITICAL:** Always log both START and END. Duration is calculated by dashboard (end - start).

---

## Model Routing
- Default: general-purpose
