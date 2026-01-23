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

You MUST log your progress using the orchestrator script. Use the Bash tool to run:

```bash
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "<step>" "<result>"
```

**Step logs for this workflow:**
- `discovery-scan` - After scanning artifacts and architecture
- `discovery-write` - After discovery files are saved

**Example:**
```bash
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "discovery-scan" "complete"
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "discovery-write" "complete"
```

**CRITICAL:** Duration is calculated automatically when the next log entry is written.

---

## Model Routing
- Default: general-purpose
