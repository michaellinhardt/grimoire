# Create Story Discovery Subagent Prompt (DISCOVERY MODE)

## Variables
- `{{story_key}}` - The story identifier (or comma-separated list for paired stories)
- `{{implementation_artifacts}}` - Path to implementation artifacts folder

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:create-story

MODE: DISCOVERY ONLY

Your ONLY task is to generate discovery files for the following stories: {{story_key}}

CRITICAL: DO NOT CREATE STORY FILES. Another agent is doing that in parallel.

SKIP THESE STEPS ENTIRELY:
- Step 5 (Create story file) - ANOTHER AGENT IS DOING THIS
- Step 6 (Update sprint status) - ANOTHER AGENT IS DOING THIS

EXECUTE THESE STEPS:
- Step 1: Identify target stories
- Step 2: Load and analyze core artifacts (discover_inputs)
- Step 3: Architecture analysis
- Step 4: Web research (if applicable)

OUTPUT REQUIREMENT:
For EACH story in {{story_key}}, create a discovery file at:
{{implementation_artifacts}}/[story_id]-discovery-story.md

Each discovery file MUST contain:
- Story Requirements (from epics): User story statement, acceptance criteria, technical requirements
- Previous Story Learnings (if applicable): Files created, patterns used, dev notes
- Architecture Relevance: Applicable patterns, constraints for this story
- Git Context: Recent relevant commits

IMPORTANT: Generate one discovery file per story. If processing 2a.1 and 2a.2, create:
- {{implementation_artifacts}}/2a.1-discovery-story.md
- {{implementation_artifacts}}/2a.2-discovery-story.md

---

## Logging Instructions

You MUST log your progress using the orchestrator script. Log START at beginning of task, END when complete.

**Format:** `./_bmad/scripts/orchestrator.sh <epicID> <storyID> <command> <task-id> <status>`
- command: "story-discovery"
- task-id: identifies the granular task
- status: "start" or "end"

**Required logs for this workflow:**

```bash
# At START of workflow
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} story-discovery workflow start

# At END of workflow (before terminating)
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} story-discovery workflow end
```

**CRITICAL:** Always log both START and END. Duration is calculated by dashboard (end - start).

---

## Model Routing
- Default: general-purpose
