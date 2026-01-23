# Create Story Subagent Prompt (CREATE MODE)

## Variables
- `{{story_key}}` - The story identifier
- `{{implementation_artifacts}}` - Path to implementation artifacts folder

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:create-story

Target: Create the next story from the epics. The sprint-status.yaml shows story {{story_key}} in backlog.

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

## Model Routing
- Default: general-purpose
