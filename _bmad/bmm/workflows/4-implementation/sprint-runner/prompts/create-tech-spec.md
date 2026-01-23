# Create Tech Spec Subagent Prompt (CREATE MODE)

## Variables
- `{{story_key}}` - The story identifier(s) - comma-separated for paired stories (e.g., "3a-1,3a-2")
- `{{implementation_artifacts}}` - Path to implementation artifacts folder

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
   b. Read story file: {{implementation_artifacts}}/[story_id].md
   c. Create the tech spec following all instructions below
   d. Log END for this story
3. After ALL stories complete, terminate

Example for "3a-1,3a-2":
- Process 3a-1 completely (log start, create spec, log end)
- Then process 3a-2 completely (log start, create spec, log end)

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

You MUST log your progress using the orchestrator script with granular task phases and descriptive messages.

**Format:** `./_bmad/scripts/orchestrator.sh <epicID> <storyID> <command> <task-id> <status> "<message>"`
- epicID: Short numeric ID (e.g., `2a`, `2b`) - extract from story key
- storyID: Short numeric ID (e.g., `2a-1`, `2b-1`) - same as story key
- command: "create-tech-spec"
- task-id: Phase from taxonomy (setup, discover, generate, write, validate)
- status: "start" or "end"
- message: Descriptive text (max 150 chars, required)

**IMPORTANT:** Always use SHORT NUMERIC IDs, never full story/epic titles.

**Task phases for create-tech-spec (from task-taxonomy.yaml):**
- `setup` - Load story and discovery context
- `discover` - Inline discovery for technical details
- `generate` - Generate tech-spec content
- `write` - Write tech-spec file
- `validate` - Validate tech-spec completeness

**Message format:**
- Start: Describe what the task is about to do
- End: Describe outcome with metrics suffix `(metric:value)`
- Recommended metrics: files, lines, sections

**Required logs for this workflow:**

```bash
# At START of each phase
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec setup start "Loading tech-spec context for {{story_id}}"
# ... load context ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec setup end "Context loaded"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec discover start "Discovering technical requirements"
# ... explore codebase ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec discover end "Discovery complete (files:N)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec generate start "Generating tech-spec"
# ... generate content ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec generate end "Tech-spec generated (sections:N)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec write start "Writing tech-spec file"
# ... write file ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec write end "Tech-spec written (lines:N)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec validate start "Validating tech-spec"
# ... validate ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-tech-spec validate end "Validation passed"
```

**CRITICAL:** Always log both START and END for each phase. Replace N with actual counts.

---

## Model Routing
- Default: general-purpose
