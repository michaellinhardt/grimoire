# Create Story Subagent Prompt (CREATE MODE)

## Variables
- `{{story_key}}` - The story identifier(s) - comma-separated for paired stories (e.g., "3a-1,3a-2")
- `{{implementation_artifacts}}` - Path to implementation artifacts folder

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:create-story

Target stories: {{story_key}}

**MULTI-STORY HANDLING:**
You may receive 1 or 2 story keys (comma-separated). Process each story SEQUENTIALLY:

1. Parse the story_key(s) into a list
2. For EACH story in the list:
   a. Log START for this story (see Logging Instructions)
   b. Create the story file following all instructions below
   c. Output the TECH-SPEC DECISION for this story
   d. Log END for this story
3. After ALL stories complete, terminate

Example for "3a-1,3a-2":
- Process 3a-1 completely (log start, create, decide, log end)
- Then process 3a-2 completely (log start, create, decide, log end)

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

ADDITIONAL OUTPUT REQUIREMENT:
After creating the story, save a discovery file to:
{{implementation_artifacts}}/{{story_key}}-discovery-story.md

The discovery file MUST contain:
- Story Requirements (from epics): User story statement, acceptance criteria, technical requirements
- Previous Story Learnings (if story_num > 1): Files created, patterns used, dev notes
- Architecture Relevance: Applicable patterns, constraints for this story
- Git Context: Recent relevant commits

CHECKLIST ENFORCEMENT:
Before saving the story file, you MUST verify against this checklist and output:
"CHECKLIST COMPLETED: YES"

## CRITICAL CHECKS (Block if not met):
- [ ] User story has clear role, action, and benefit
- [ ] ALL acceptance criteria from epics are included (not just some)
- [ ] Each AC is testable with Given/When/Then format
- [ ] Tasks cover ALL acceptance criteria (map each task to AC#)
- [ ] No task is vague - each has specific file path or action
- [ ] Dev Notes include: architecture patterns, file locations, testing approach
- [ ] Previous story learnings included (if story_num > 1)
- [ ] No placeholders or TBDs remain

## DISASTER PREVENTION CHECKS:
- [ ] Identified existing code to reuse (not reinvent)
- [ ] Specified correct libraries/versions from architecture
- [ ] Noted file structure conventions to follow
- [ ] Included regression risks if touching existing code

## LLM-OPTIMIZATION CHECKS:
- [ ] Instructions are direct and actionable (no fluff)
- [ ] Critical requirements are prominent (not buried)
- [ ] Structure is scannable (headers, bullets, emphasis)

IF ANY CHECK FAILS: Fix it before saving. Do not output a flawed story.

---

## TECH-SPEC DECISION (MANDATORY OUTPUT)

After completing all checks and saving the story file, you MUST evaluate whether a technical specification is necessary for this story.

**OUTPUT REQUIREMENT - Include this line in your final output:**

If tech-spec IS needed:
```
[TECH-SPEC-DECISION: REQUIRED]
```

If tech-spec is OVERKILL:
```
[TECH-SPEC-DECISION: SKIP]
```

**Decision Guidelines:**

SKIP tech-spec (simple/straightforward):
- Bug fixes with clear, isolated root cause
- Configuration or environment changes
- Documentation-only updates
- Single-file changes with obvious implementation path
- Copy/paste patterns from existing similar code
- Simple refactors (rename, move, extract method)
- Adding/removing feature flags
- Updating dependencies with no code changes

REQUIRE tech-spec (complex/multi-faceted):
- New features involving multiple files or components
- API changes (new endpoints, request/response changes)
- Database schema modifications
- Architectural decisions or new patterns
- Complex business logic with multiple branches
- Integration with external services or systems
- Changes spanning multiple layers (UI + backend + data)
- Performance optimizations requiring analysis
- Security-sensitive implementations

**DEFAULT TO REQUIRED** - When uncertain, choose REQUIRED. Quality over speed.

The orchestrator will parse this decision to determine whether to run the tech-spec phase.

---

## Logging Instructions

You MUST log your progress using the orchestrator script. Log START at beginning of task, END when complete.

**Format:** `./_bmad/scripts/orchestrator.sh <epicID> <storyID> <command> <task-id> <status>`
- epicID: Short numeric ID (e.g., `2a`, `2b`) - extract from story key
- storyID: Short numeric ID (e.g., `2a-1`, `2b-1`) - same as story key
- command: "create-story"
- task-id: identifies the granular task
- status: "start" or "end"

**IMPORTANT:** Always use SHORT NUMERIC IDs, never full story/epic titles.

**Required logs for this workflow:**

```bash
# At START of workflow
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-story workflow start

# At END of workflow (before terminating)
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} create-story workflow end
```

**CRITICAL:** Always log both START and END. Duration is calculated by dashboard (end - start).

---

## Model Routing
- Default: general-purpose
