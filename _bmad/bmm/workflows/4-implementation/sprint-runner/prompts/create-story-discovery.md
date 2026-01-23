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

**IMPORTANT:** Use SHORT NUMERIC IDs only (e.g., `2a-1`, `2b-1`), never full story titles.
- CORRECT: `2a-1-discovery-story.md`
- WRONG: `2a-1-user-authentication-discovery-story.md`

Each discovery file MUST contain:
- Story Requirements (from epics): User story statement, acceptance criteria, technical requirements
- Previous Story Learnings (if applicable): Files created, patterns used, dev notes
- Architecture Relevance: Applicable patterns, constraints for this story
- Git Context: Recent relevant commits

IMPORTANT: Generate one discovery file per story. If processing 2a-1 and 2a-2, create:
- {{implementation_artifacts}}/2a-1-discovery-story.md
- {{implementation_artifacts}}/2a-2-discovery-story.md

---

## Logging Instructions

You MUST log your progress using the orchestrator script with granular task phases and descriptive messages.

**Format:** `./_bmad/scripts/orchestrator.sh <epicID> <storyID> <command> <task-id> <status> "<message>"`
- epicID: Short numeric ID (e.g., `2a`, `2b`) - extract from story key
- storyID: Short numeric ID (e.g., `2a-1`, `2b-1`) - same as story key
- command: "story-discovery"
- task-id: Phase from taxonomy (setup, explore, write)
- status: "start" or "end"
- message: Descriptive text (max 150 chars, required)

**IMPORTANT:** Always use SHORT NUMERIC IDs, never full story/epic titles.

**Task phases for story-discovery (from task-taxonomy.yaml):**
- `setup` - Load story and project context
- `explore` - Explore codebase for relevant patterns
- `write` - Write discovery file

**Message format:**
- Start: Describe what the task is about to do
- End: Describe outcome with metrics suffix `(metric:value)`
- Recommended metrics: files, lines, sections

**Required logs for this workflow:**

```bash
# At START of each phase
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} story-discovery setup start "Loading discovery context for {{story_id}}"
# ... do setup work ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} story-discovery setup end "Context loaded"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} story-discovery explore start "Exploring codebase patterns"
# ... explore codebase ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} story-discovery explore end "Patterns identified (files:N)"

./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} story-discovery write start "Writing discovery file"
# ... write file ...
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} story-discovery write end "Discovery file written (lines:N)"
```

**CRITICAL:** Always log both START and END for each phase. Replace N with actual counts.

---

## Model Routing
- Default: general-purpose
