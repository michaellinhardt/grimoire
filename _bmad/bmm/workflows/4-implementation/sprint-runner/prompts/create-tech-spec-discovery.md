# Create Tech Spec Discovery Subagent Prompt (DISCOVERY MODE)

## Variables
- `{{story_key}}` - The story identifier (or comma-separated list for paired stories)
- `{{implementation_artifacts}}` - Path to implementation artifacts folder

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:create-tech-spec

MODE: DISCOVERY ONLY

Your ONLY task is to generate discovery files for the following stories: {{story_key}}

CRITICAL: DO NOT CREATE TECH SPEC FILES. Another agent is doing that in parallel.

SKIP THESE STEPS ENTIRELY:
- Step 1.1-1.5 (Greet, orient scan, questions, capture, init WIP) - ANOTHER AGENT DOING
- Step 3 (Generate spec) - ANOTHER AGENT IS DOING THIS

EXECUTE THESE STEPS:
- Step 1.0: Check for existing work
- Step 2.1: Load current state (story file exists)
- Step 2.2: Execute investigation
- Step 2.3: Document technical context

OUTPUT REQUIREMENT:
For EACH story in {{story_key}}, create a discovery file at:
{{implementation_artifacts}}/[story_id]-discovery-tech.md

Each discovery file MUST contain:
- Technical Context: Key file paths, component dependencies, patterns to follow
- Investigation Results: What was found during codebase analysis
- Implementation Hints: Suggested approaches based on existing patterns
- Risk Areas: Potential issues to watch for during implementation
- Testing Strategy: What tests are needed and where

IMPORTANT: Generate one discovery file per story. If processing 2a.1 and 2a.2, create:
- {{implementation_artifacts}}/2a.1-discovery-tech.md
- {{implementation_artifacts}}/2a.2-discovery-tech.md

---

## Model Routing
- Default: general-purpose
