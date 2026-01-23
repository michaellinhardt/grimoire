# Sprint Runner Optimization - Implementation Plan

**Date:** 2026-01-23
**Source:** sprint-runner-change-request-2026-01-23.md
**Status:** Ready for Implementation

---

## Revision History

| Version | Date | Description |
|---------|------|-------------|
| 1.0 | 2026-01-23 | Initial implementation plan |
| 2.0 | 2026-01-23 | Incorporated review feedback (14 issues addressed) - Ready for Implementation |

### Issues Addressed in Revision 2.0

| Issue ID | Severity | Resolution |
|----------|----------|------------|
| CRITICAL-1 | CRITICAL | Tech spec naming verified - `tech-spec-{{story_key}}.md` is correct convention |
| CRITICAL-2 | CRITICAL | Parallel execution confirmed - Task tool supports multiple concurrent calls in single message |
| HIGH-1 | HIGH | Discovery file naming clarified - uses dot notation (e.g., `2a.1-discovery-story.md`) |
| HIGH-2 | HIGH | Removed references to non-existent `discovery-project-level.md` - project context injected into existing discovery files |
| HIGH-3 | HIGH | Step numbering restructured with clear before/after mapping |
| HIGH-4 | HIGH | orchestrator.md migration added to cleanup step (delete old file, fresh CSV created) |
| MEDIUM-1 | MEDIUM | Added `set -e` to all shell scripts |
| MEDIUM-2 | MEDIUM | Documented that Step 0 must complete before discovery phase |
| MEDIUM-3 | MEDIUM | Story pairing parsing rule clarified with examples |
| MEDIUM-4 | MEDIUM | Review attempt counters explicitly scoped per-story |
| MEDIUM-5 | MEDIUM | Cleanup safety added with `is_first_iteration` flag and deletion logging |
| LOW-1 | LOW | Model routing parameter verified as `model: "haiku"` for Task tool |
| LOW-2 | LOW | generate-project-context prompt kept inline (setup step exception) |
| LOW-3 | LOW | Dashboard update documented as follow-up task |

---

## Part 1: Change Inventory

| Change ID | Description | Files to Create/Modify | Dependencies |
|-----------|-------------|------------------------|--------------|
| **C1** | Restructure orchestrator.md for CSV Dashboard Format | `_bmad/scripts/orchestrator.sh` (create), `instructions.md` (modify) | None |
| **C2** | Extract Subagent Prompts to Files | `prompts/` folder with 8 files (create), `instructions.md` (modify) | None |
| **C3** | Model Routing (Haiku for Reviews 2+) | `instructions.md` (modify) | C2 (prompts exist) |
| **C4** | Quality Gate Checklists | `prompts/create-story.md`, `prompts/create-tech-spec.md` (modify) | C2 |
| **C5** | Discovery File Generation | `prompts/create-story.md`, `prompts/create-tech-spec.md`, `prompts/story-review.md`, `prompts/tech-spec-review.md` (modify) | C2 |
| **C6** | Project Context Refresh Script | `_bmad/scripts/project-context-should-refresh.sh` (create) | None |
| **C7** | Project Context Injection Script | `_bmad/scripts/project-context-injection.sh` (create) | None |
| **C8** | Step 0a - Project Context Generation | `instructions.md` (modify) | C6 |
| **C9** | Parallel Creation + Discovery | `instructions.md` (modify), discovery prompts | C2, C5, C7 |
| **C10** | Story Pairing (2 Stories Per Cycle) | `instructions.md` (modify) | C9 |
| **C11** | Discovery File for Review Agents | `prompts/story-review.md`, `prompts/tech-spec-review.md` (modify) | C2, C5, C7 |
| **C12** | Cleanup Before First Loop (includes orchestrator.md) | `instructions.md` (modify) | C8 |
| **C13** | Early Exit on Repeated Errors | `instructions.md` (modify) | None |

### Step Structure Mapping (HIGH-3 Resolution)

| Current Step | New Step | Description |
|--------------|----------|-------------|
| Step 0 (batch size) | Step 0c | Determine batch size |
| - | Step 0a | Project context refresh (C8) - NEW |
| - | Step 0b | Cleanup implementation-artifacts including orchestrator.md (C12) - NEW |
| Step 1 | Step 1 | Initialize and select next stories (enhanced with pairing logic) |
| Step 2 | Step 2 | CREATE-STORY phase (now parallel with discovery) |
| - | Step 2b | STORY-REVIEW phase (sequential) - NEW |
| Step 3 | Step 3 | CREATE-TECH-SPEC phase (now parallel with discovery) |
| - | Step 3b | TECH-SPEC-REVIEW phase (sequential) - NEW |
| Step 4 | Step 4 | DEV + CODE-REVIEW phase (sequential per story) |
| Step 5 | Step 5 | Error recovery |
| Step 6 | Step 6 | Batch tracking |

---

## Part 2: Implementation Order

### Phase 1: Foundation (No Dependencies)
1. **C1** - Create orchestrator.sh shell script
2. **C6** - Create project-context-should-refresh.sh script
3. **C7** - Create project-context-injection.sh script

### Phase 2: Prompt Extraction (Foundation for All Prompt Changes)
4. **C2** - Extract all subagent prompts to separate files

### Phase 3: Prompt Enhancements (Depend on C2)
5. **C4** - Add quality gate checklists to create-story and create-tech-spec prompts
6. **C5** - Add discovery file generation logic to prompts
7. **C11** - Add discovery file consumption to review prompts (includes skip instructions)
8. **C3** - Add model routing annotations to prompts

### Phase 4: Orchestrator Logic Changes
9. **C8** - Add Step 0 with project context generation
10. **C12** - Add cleanup logic to Step 0
11. **C13** - Add early exit on repeated errors
12. **C9** - Implement parallel creation + discovery execution
13. **C10** - Implement story pairing logic

### Phase 5: Final Integration
14. Update `instructions.md` to reference prompt files and new flow

---

## Part 3: Detailed Implementation Steps

### Step 1: Create orchestrator.sh (C1)

**Files to Create:**
- `/Users/teazyou/dev/grimoire/_bmad/scripts/orchestrator.sh`

**What to Do:**
1. Create the `_bmad/scripts/` directory if it doesn't exist
2. Create `orchestrator.sh` with the following behavior:
   - Accept arguments: `[epic_id] [story_id] [command] [start_or_result]`
   - Append CSV line to `{output_folder}/implementation-artifacts/orchestrator.md`
   - Format: `unix_timestamp,epic_id,story_id,command,result`
   - No header (dashboard knows schema)

**Content:**
```bash
#!/bin/bash
set -e  # Exit on error (MEDIUM-1 Resolution)

# orchestrator.sh - Log sprint-runner events in CSV format
# Usage: ./orchestrator.sh <epic_id> <story_id> <command> <result>
# Example: ./orchestrator.sh epic-1 2a.1 dev-story start

EPIC_ID="$1"
STORY_ID="$2"
COMMAND="$3"
RESULT="$4"
OUTPUT_FILE="${BMAD_OUTPUT:-_bmad-output}/implementation-artifacts/orchestrator.md"

# Get Unix timestamp
TIMESTAMP=$(date +%s)

# Append CSV line
echo "${TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${RESULT}" >> "$OUTPUT_FILE"
```

**Acceptance Criteria:**
- [ ] Script exists at correct path
- [ ] Script is executable (`chmod +x`)
- [ ] Running `./orchestrator.sh epic-1 2a.1 dev-story start` appends a CSV line
- [ ] Timestamp is Unix epoch format
- [ ] No header is written

**Complexity:** Low

---

### Step 2: Create project-context-should-refresh.sh (C6)

**Files to Create:**
- `/Users/teazyou/dev/grimoire/_bmad/scripts/project-context-should-refresh.sh`

**What to Do:**
1. Create script that checks if project context needs regeneration
2. Returns exit code 0 (TRUE) if refresh needed, 1 (FALSE) otherwise
3. Deletes existing file when returning TRUE

**Content:**
```bash
#!/bin/bash
set -e  # Exit on error (MEDIUM-1 Resolution)

# project-context-should-refresh.sh - Check if project context needs regeneration
# Returns: exit 0 (TRUE/needs refresh), exit 1 (FALSE/no refresh needed)
# If refresh needed, deletes existing file to force regeneration

OUTPUT_FOLDER="${BMAD_OUTPUT:-_bmad-output}"
CONTEXT_FILE="${OUTPUT_FOLDER}/planning-artifacts/project-context.md"
MAX_AGE_HOURS=6

# Check if file exists
if [ ! -f "$CONTEXT_FILE" ]; then
    echo "TRUE: project-context.md does not exist"
    exit 0
fi

# Check file age (in seconds)
FILE_AGE=$(($(date +%s) - $(stat -f %m "$CONTEXT_FILE" 2>/dev/null || stat -c %Y "$CONTEXT_FILE" 2>/dev/null)))
MAX_AGE_SECONDS=$((MAX_AGE_HOURS * 3600))

if [ "$FILE_AGE" -gt "$MAX_AGE_SECONDS" ]; then
    echo "TRUE: project-context.md is older than ${MAX_AGE_HOURS} hours"
    rm -f "$CONTEXT_FILE"
    exit 0
fi

echo "FALSE: project-context.md is fresh (${FILE_AGE}s old, max ${MAX_AGE_SECONDS}s)"
exit 1
```

**Acceptance Criteria:**
- [ ] Script returns exit 0 when file doesn't exist
- [ ] Script returns exit 0 when file is older than 6 hours
- [ ] Script deletes file when returning exit 0 for age condition
- [ ] Script returns exit 1 when file is fresh
- [ ] Works on both macOS (stat -f) and Linux (stat -c)

**Complexity:** Low

---

### Step 3: Create project-context-injection.sh (C7)

**Files to Create:**
- `/Users/teazyou/dev/grimoire/_bmad/scripts/project-context-injection.sh`

**What to Do:**
1. Accept file path as argument
2. Check if `# Project Context Dump Below` header already exists
3. If not found, append project context to the file

**Content:**
```bash
#!/bin/bash
set -e  # Exit on error (MEDIUM-1 Resolution)

# project-context-injection.sh - Inject project context into discovery files
# Usage: ./project-context-injection.sh <file_path>

TARGET_FILE="$1"
OUTPUT_FOLDER="${BMAD_OUTPUT:-_bmad-output}"
CONTEXT_FILE="${OUTPUT_FOLDER}/planning-artifacts/project-context.md"
HEADER="# Project Context Dump Below"

if [ -z "$TARGET_FILE" ]; then
    echo "Error: No target file specified"
    echo "Usage: ./project-context-injection.sh <file_path>"
    exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
    echo "Error: Target file does not exist: $TARGET_FILE"
    exit 1
fi

# Check if already injected
if grep -q "$HEADER" "$TARGET_FILE"; then
    echo "Already injected: $TARGET_FILE"
    exit 0
fi

# Check if project context exists
if [ ! -f "$CONTEXT_FILE" ]; then
    echo "Warning: project-context.md not found, skipping injection"
    exit 0
fi

# Append project context
cat >> "$TARGET_FILE" << EOF

$HEADER
The project context from \`${OUTPUT_FOLDER}/planning-artifacts/project-context.md\` is injected below. Do not read that file separately - use this content.

$(cat "$CONTEXT_FILE")
EOF

echo "Injected project context into: $TARGET_FILE"
```

**Acceptance Criteria:**
- [ ] Script accepts file path argument
- [ ] Script exits silently if header already exists (idempotent)
- [ ] Script appends header + project context content
- [ ] Script handles missing project-context.md gracefully

**Complexity:** Low

---

### Step 4: Extract Subagent Prompts to Files (C2)

**Files to Create:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story.md`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story-discovery.md`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/story-review.md`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-tech-spec.md`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-tech-spec-discovery.md`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/tech-spec-review.md`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/dev-story.md`
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/code-review.md`

**What to Do:**
1. Create `prompts/` directory
2. Extract each `<subagent-prompt for="xxx">` block from `instructions.md`
3. Save each as a separate markdown file
4. Add placeholder for variables: `{{story_key}}`, `{{implementation_artifacts}}`, etc.

**Prompt File Template Structure:**
```markdown
# [Workflow Name] Subagent Prompt

## Variables
- `{{story_key}}` - The story identifier (e.g., 2a.1)
- `{{implementation_artifacts}}` - Path to implementation artifacts folder

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:[workflow-name]

[Rest of existing prompt content with variables replacing hardcoded values]

---

## Model Routing
- Default: general-purpose
- Review 2+: haiku (if applicable)
```

**Detailed Content for Each File:**

#### prompts/create-story.md
```markdown
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
```

#### prompts/create-story-discovery.md
```markdown
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

## Model Routing
- Default: general-purpose
```

#### prompts/story-review.md
```markdown
# Story Review Subagent Prompt (REVIEW MODE)

## Variables
- `{{story_key}}` - The story identifier
- `{{implementation_artifacts}}` - Path to implementation artifacts folder
- `{{review_attempt}}` - Current review attempt number

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:create-story

Target story: {{story_key}} (status: ready-for-dev)
Story file: {{implementation_artifacts}}/{{story_key}}.md

MODE: REVIEW ONLY - The story already exists. Do NOT create a new story.

PRE-COMPUTED DISCOVERY AVAILABLE (HIGH-2 Resolution):
Read this discovery file first - it contains story context WITH project context already injected:
- {{implementation_artifacts}}/{{story_key}}-discovery-story.md

NOTE: Project context is ALREADY APPENDED to the discovery file (see "# Project Context Dump Below" section).
Do NOT read project-context.md separately - use the content already in the discovery file.

SKIP THESE STEPS ENTIRELY (use provided discovery file instead):
- Step 2 (Load and analyze core artifacts) - USE PROVIDED FILE
- Step 3 (Architecture analysis) - ALREADY IN DISCOVERY FILE
- Step 4 (Web research) - NOT NEEDED FOR REVIEW

EXECUTE THESE STEPS:
- Step 1: Identify the target story file to review
- Step 5: REVIEW (not create) the story file for:
  - Completeness against acceptance criteria
  - Alignment with architecture (from discovery files)
  - Missing technical requirements
  - Quality of Dev Notes section
- Step 6: Update sprint status only if issues found

When the workflow asks what to do, select:
"1. Review the story file for completeness"

CRITICAL INSTRUCTIONS:
- Review the existing story file for completeness and quality
- Fix ANY issues you find (critical, high, medium, low)
- You MUST make all decisions autonomously. No one will answer questions.
- Do NOT ask for confirmation. Fix everything you find.
- After fixing, report what critical issues were found and fixed

DECISION RULES:
- If the workflow asks for approval -> proceed without approval
- Always choose review/validate options when offered
- Never wait for human input. You ARE the decision maker.

IMPORTANT OUTPUT: At the end, clearly state:
- "CRITICAL ISSUES FOUND: [count]" or "NO CRITICAL ISSUES FOUND"
- This determines if another review pass is needed

---

## Model Routing
- Review 1: general-purpose
- Review 2+: haiku
```

#### prompts/create-tech-spec.md
```markdown
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

ADDITIONAL OUTPUT REQUIREMENT:
After creating the tech spec, save a discovery file to:
{{implementation_artifacts}}/{{story_key}}-discovery-tech.md

The discovery file MUST contain:
- Technical Context: Key file paths, component dependencies, patterns to follow
- Implementation Decisions: Why certain approaches were chosen
- Risk Areas: Potential issues to watch for during implementation
- Testing Strategy: What tests are needed and where

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

## Model Routing
- Default: general-purpose
```

#### prompts/create-tech-spec-discovery.md
```markdown
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
```

#### prompts/tech-spec-review.md
```markdown
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

## Model Routing
- Review 1: general-purpose
- Review 2+: haiku
```

#### prompts/dev-story.md
```markdown
# Dev Story Subagent Prompt

## Variables
- `{{story_key}}` - The story identifier
- `{{implementation_artifacts}}` - Path to implementation artifacts folder

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:dev-story

Target story: {{story_key}}
Story file: {{implementation_artifacts}}/{{story_key}}.md
Tech spec file: {{implementation_artifacts}}/tech-spec-{{story_key}}.md

CRITICAL INSTRUCTIONS:
- You MUST make all decisions autonomously. No one will answer questions.
- If you encounter ambiguity, make a reasonable choice and document it.
- Complete ALL tasks and subtasks in the story file.
- Write tests, implement code, validate everything.
- Do NOT ask for confirmation. Do NOT pause for review.
- When done, the story status should be "review" in sprint-status.yaml.
- If you encounter blocking issues, document them in the story file and continue with what you can.

DECISION RULES:
- If the workflow asks for approval -> proceed without approval, you have full authority.
- If the workflow offers optional validation/review -> ALWAYS choose to validate/review.
- If multiple approaches exist -> choose the most thorough one.
- Never wait for human input. You ARE the decision maker.

---

## Model Routing
- Default: general-purpose
```

#### prompts/code-review.md
```markdown
# Code Review Subagent Prompt

## Variables
- `{{story_key}}` - The story identifier
- `{{implementation_artifacts}}` - Path to implementation artifacts folder
- `{{review_attempt}}` - Current review attempt number

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:code-review

Target story: {{story_key}}
Story file: {{implementation_artifacts}}/{{story_key}}.md
Review attempt: {{review_attempt}}

CRITICAL INSTRUCTIONS:
- You MUST make all decisions autonomously. No one will answer questions.
- Perform adversarial code review as the workflow instructs.
- If you find ANY issues (CRITICAL, HIGH, MEDIUM, or LOW severity):
  - FIX THEM AUTOMATICALLY (choose option 1 "Fix them automatically" when prompted)
  - Do NOT create action items
  - Do NOT change story status to "done"
  - Keep story status as "review" so another review pass happens
- ONLY if you find ZERO issues:
  - Mark story status as "done" in sprint-status.yaml
  - Update story file status to "done"
- Do NOT ask for confirmation. Fix everything you find.

IMPORTANT: After fixing issues, the story stays in "review" status for another review pass.

MANDATORY OUTPUT FORMAT - At the end of your review, clearly state:
- "HIGHEST SEVERITY: CRITICAL" or "HIGHEST SEVERITY: HIGH" or "HIGHEST SEVERITY: MEDIUM" or "HIGHEST SEVERITY: LOW" or "ZERO ISSUES"
- Include counts: "Issues: X CRITICAL, X HIGH, X MEDIUM, X LOW"
- This determines the re-review logic

DECISION RULES:
- If the workflow asks "What should I do with these issues?" -> ALWAYS choose option 1 "Fix them automatically"
- If the workflow asks for approval -> proceed without approval, you have full authority.
- Never wait for human input. You ARE the decision maker.
- Be thorough in finding issues. The goal is quality, not speed.

---

## Model Routing
- Review 1: general-purpose
- Review 2+: haiku
```

**Acceptance Criteria:**
- [ ] `prompts/` directory exists
- [ ] All 8 prompt files exist
- [ ] Each prompt has Variables section with placeholders
- [ ] Each prompt has Model Routing section
- [ ] Prompts preserve original intent from instructions.md

**Complexity:** Medium

---

### Step 5: Add Quality Gate Checklists (C4)

**Files to Modify:**
- Already done in Step 4 - checklists are embedded in `create-story.md` and `create-tech-spec.md`

**Acceptance Criteria:**
- [ ] `create-story.md` includes CRITICAL CHECKS section
- [ ] `create-story.md` includes DISASTER PREVENTION CHECKS section
- [ ] `create-story.md` includes LLM-OPTIMIZATION CHECKS section
- [ ] `create-tech-spec.md` includes READY FOR DEVELOPMENT STANDARD section
- [ ] `create-tech-spec.md` includes SPECIFIC CHECKS section
- [ ] `create-tech-spec.md` includes DISASTER PREVENTION section
- [ ] Both require "CHECKLIST COMPLETED: YES" output

**Complexity:** Low (already done in Step 4)

---

### Step 6: Add Discovery File Generation (C5)

**Files to Modify:**
- Already done in Step 4 - discovery output requirements are in prompts

**Acceptance Criteria:**
- [ ] `create-story.md` requires output of `{{story_key}}-discovery-story.md`
- [ ] `create-tech-spec.md` requires output of `{{story_key}}-discovery-tech.md`
- [ ] Discovery file content requirements are specified

**Complexity:** Low (already done in Step 4)

---

### Step 7: Add Discovery Consumption to Review Prompts (C11)

**Files to Modify:**
- Already done in Step 4 - skip instructions are in review prompts

**HIGH-2 Resolution - Project Context Injection Clarification:**

Review agents receive discovery files WITH project context already injected (via project-context-injection.sh):

| Review Agent | Discovery File Received | Contains |
|--------------|------------------------|----------|
| story-review | `{story_id}-discovery-story.md` | Story context + injected project-context.md |
| tech-spec-review | `{story_id}-discovery-tech.md` | Tech context + injected project-context.md |

**NOTE:** There is NO separate `{story_id}-discovery-project-level.md` file. Project context is INJECTED INTO the story and tech discovery files by the `project-context-injection.sh` script after the parallel discovery phase completes. Review agents should read only their respective discovery file - the project context is already appended at the bottom.

**Acceptance Criteria:**
- [ ] `story-review.md` specifies discovery file path to read: `{{story_key}}-discovery-story.md`
- [ ] `story-review.md` lists steps to skip (2, 3, 4)
- [ ] `tech-spec-review.md` specifies discovery file path to read: `{{story_key}}-discovery-tech.md`
- [ ] `tech-spec-review.md` lists steps to skip (1.1-1.5, 2.2, 2.3, 3)
- [ ] Both prompts note that project context is already injected into discovery files

**Complexity:** Low (already done in Step 4)

---

### Step 8: Add Model Routing Annotations (C3)

**Files to Modify:**
- Already done in Step 4 - Model Routing sections in prompts

**LOW-1 Resolution - Correct Task Tool Syntax:**

The Task tool accepts a `model` parameter. For Haiku routing on reviews 2+:

```
Task tool call with: model: "haiku"
```

**What to Do (in instructions.md):**
Add logic to orchestrator to pass `model` parameter to Task tool:
```
<check if="story_review_attempt >= 2 OR tech_spec_review_attempt >= 2 OR review_attempt >= 2">
  <action>Spawn subagent with Task tool using model: "haiku"</action>
</check>
<check else>
  <action>Spawn subagent with Task tool (default model)</action>
</check>
```

**Acceptance Criteria:**
- [ ] Each review prompt has Model Routing section
- [ ] Orchestrator instructions include model selection logic
- [ ] Review 2+ uses `model: "haiku"` parameter in Task tool call

**Complexity:** Low

---

### Step 9: Add Step 0 with Project Context Generation (C8) - HIGH-3 Resolution

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**What to Do:**
Restructure Step 0 into three substeps (0a, 0b, 0c) as per HIGH-3 resolution:

```markdown
<step n="0" goal="Initialize: project context, cleanup, and batch size">

  <!-- FIRST: Set iteration flag for cleanup safety (MEDIUM-5 Resolution) -->
  <action>Set is_first_iteration = true</action>

  <substep n="0a" goal="Check and refresh project context (C8)">
    <action>Run: _bmad/scripts/project-context-should-refresh.sh</action>

    <check if="script returns exit 0 (TRUE)">
      <action>Log: "Project context needs refresh"</action>
      <action>Spawn subagent with Task tool</action>
      <subagent-prompt>
      AUTONOMOUS MODE - Generate fresh project context.

      Run the workflow: /bmad:bmm:workflows:generate-project-context

      CRITICAL: Do NOT read project-context.md first - it may have been deleted.
      Run the workflow to generate a fresh copy.

      Output the file to: {planning_artifacts}/project-context.md
      </subagent-prompt>
      <action>Wait for completion</action>
      <action>Log: "Project context generated"</action>
    </check>

    <check if="script returns exit 1 (FALSE)">
      <action>Log: "Project context is fresh, skipping regeneration"</action>
    </check>
  </substep>

  <substep n="0b" goal="Cleanup from previous runs (C12) - FIRST ITERATION ONLY">
    <!-- See Step 10 for full cleanup logic -->
  </substep>

  <substep n="0c" goal="Determine batch size (moved from old Step 0)">
    <check if="user provided batch_size argument">
      <action>Set batch_size = user_provided_value</action>
    </check>
    <check else>
      <action>Set batch_size = 2 (default)</action>
    </check>
    <action>Log: "Batch size: [batch_size]"</action>
  </substep>

  <!-- AFTER CLEANUP: Clear iteration flag (MEDIUM-5 Resolution) -->
  <action>Set is_first_iteration = false</action>

</step>
```

**Acceptance Criteria:**
- [ ] Step 0 has substeps 0a, 0b, 0c
- [ ] Step 0a: Calls project-context-should-refresh.sh
- [ ] Step 0a: Spawns generate-project-context workflow if refresh needed
- [ ] Step 0b: Placeholder for cleanup (detailed in Step 10)
- [ ] Step 0c: Determines batch size (moved from old Step 0)
- [ ] is_first_iteration flag set at start, cleared after cleanup

**Complexity:** Medium

---

### Step 10: Add Cleanup Logic (C12) - HIGH-4 and MEDIUM-5 Resolutions

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**What to Do:**
Add substep 0b to Step 0 with orchestrator.md migration and cleanup safety:

```markdown
  <substep n="0b" goal="Cleanup from previous runs (FIRST ITERATION ONLY)">
    <!-- MEDIUM-5 Resolution: Only cleanup if first iteration flag is true -->
    <check if="is_first_iteration == true">
      <action>Log: "First iteration - cleaning implementation artifacts"</action>

      <!-- HIGH-4 Resolution: Delete orchestrator.md to prevent CSV-to-markdown corruption -->
      <action>Log: "Deleting orchestrator.md (will be recreated in CSV format)"</action>
      <check if="file exists: {implementation_artifacts}/orchestrator.md">
        <action>Log: "DELETING: {implementation_artifacts}/orchestrator.md"</action>
        <action>Delete: {implementation_artifacts}/orchestrator.md</action>
      </check>

      <action>Spawn BMAD Master subagent with Task tool</action>
      <subagent-prompt>
      AUTONOMOUS MODE - Clean implementation artifacts from previous runs.

      Clean the folder: {implementation_artifacts}/

      IMPORTANT: Log ALL files being deleted BEFORE deletion (MEDIUM-5 Resolution)

      DELETE these files (if they exist):
      - All files matching *-discovery-*.md
      - All completed story files (check sprint-status.yaml for "done" status)
      - All completed tech-spec files for done stories

      PRESERVE these files:
      - sprint-status.yaml
      - Any files for stories NOT in "done" status

      NOTE: orchestrator.md has already been deleted by the orchestrator.

      For each file to be deleted, output:
      "DELETING: [filepath]"

      After completion, output:
      "CLEANUP COMPLETE: Deleted [count] files"
      </subagent-prompt>
      <action>Wait for completion</action>
      <action>Log: "Cleanup complete"</action>

      <!-- Fresh orchestrator.md will be created by first orchestrator.sh call -->
    </check>

    <check if="is_first_iteration == false">
      <action>Log: "Not first iteration - skipping cleanup"</action>
    </check>
  </substep>
```

**Cleanup Safety (MEDIUM-5 Resolution):**
1. `is_first_iteration` flag is set to `true` at the very start of Step 0
2. Cleanup ONLY runs if `is_first_iteration == true`
3. After cleanup completes (in Step 0), set `is_first_iteration = false`
4. All files being deleted are logged BEFORE deletion

**orchestrator.md Migration (HIGH-4 Resolution):**
- DELETE existing orchestrator.md during cleanup (it contains markdown from previous runs)
- Fresh CSV-only orchestrator.md will be created by first orchestrator.sh call
- This prevents CSV-to-markdown corruption

**Acceptance Criteria:**
- [ ] Cleanup runs only when `is_first_iteration == true`
- [ ] orchestrator.md is explicitly deleted as part of cleanup
- [ ] All files logged before deletion
- [ ] Deletes discovery files from past runs
- [ ] Preserves sprint-status.yaml
- [ ] Preserves files for in-progress stories
- [ ] is_first_iteration set to false after cleanup

**Complexity:** Low

---

### Step 11: Add Early Exit on Repeated Errors (C13)

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**What to Do:**
Add to Step 4 code-review handling:

```markdown
    <action>Store error_pattern from this review in error_history[review_attempt]</action>

    <check if="review_attempt >= 3">
      <action>Compare error_history[review_attempt], error_history[review_attempt-1], error_history[review_attempt-2]</action>

      <check if="all three error patterns are substantially similar">
        <action>Log to orchestrator.md: "REPEATED ERROR DETECTED: Same issue found 3 times - human intervention required"</action>
        <action>Log: "Error pattern: [error_pattern]"</action>
        <action>Set story status to "blocked" in sprint-status.yaml</action>
        <output>
**ORCHESTRATOR STOPPED - REPEATED ERROR PATTERN**

Story: [story_key]
Error appeared 3 times consecutively: [error_pattern]

The same issue keeps recurring. This may indicate:
- A systemic problem in the codebase
- Missing dependencies or configuration
- An issue the automated review cannot fix

Please review manually and resolve before resuming.
        </output>
        <action>EXIT workflow</action>
      </check>
    </check>
```

**Acceptance Criteria:**
- [ ] Error patterns are tracked across review attempts
- [ ] Comparison happens after 3+ attempts
- [ ] Early exit if same error 3x consecutive
- [ ] Story marked as "blocked"
- [ ] Clear output explaining the issue

**Complexity:** Medium

---

### Step 12: Implement Parallel Creation + Discovery (C9) - CRITICAL-2 Resolution

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**CRITICAL-2 Resolution - Verified Parallel Execution:**

The Task tool DOES support parallel execution by spawning multiple agents in a single message. This is verified behavior.

**Implementation:** Orchestrator makes TWO Task tool calls in a single message:
- Task 1: create-story CREATE MODE (prompt file path)
- Task 2: create-story DISCOVERY MODE (prompt file path)
Both run concurrently. Wait for BOTH to complete before proceeding.

**What to Do:**
Replace Step 2 and related steps with parallel execution:

```markdown
<step n="2" goal="CREATE-STORY PHASE (PARALLEL)">
  <check if="status == backlog">
    <action>Log: "Starting CREATE-STORY phase for [story_key(s)]"</action>

    <!-- PARALLEL EXECUTION (CRITICAL-2 Resolution: Verified Task tool capability) -->
    <!-- Make TWO Task tool calls in a SINGLE message for concurrent execution -->
    <parallel-execution>
      <task-call id="1">
        <action>Load prompt from prompts/create-story.md, substitute variables</action>
        <action>Spawn subagent with Task tool (default model)</action>
        <goal>Create story file(s)</goal>
      </task-call>

      <task-call id="2">
        <action>Load prompt from prompts/create-story-discovery.md, substitute variables</action>
        <action>Spawn subagent with Task tool (default model)</action>
        <goal>Generate discovery file(s)</goal>
      </task-call>
    </parallel-execution>

    <action>Wait for BOTH Task calls to complete</action>

    <!-- POST-PARALLEL: Inject project context -->
    <for-each story in="story_keys">
      <action>Run: _bmad/scripts/project-context-injection.sh {{implementation_artifacts}}/{{story}}-discovery-story.md</action>
    </for-each>

    <action>Log: "CREATE-STORY phase complete, discovery files enriched"</action>
    <action>Go to Step 2b (story review)</action>
  </check>
</step>

<step n="2b" goal="STORY-REVIEW PHASE (SEQUENTIAL)">
  <for-each story in="story_keys">
    <!-- MEDIUM-4 Resolution: Review counters are PER-STORY and reset for each story -->
    <action>Set story_review_attempt = 1</action>

    <loop max="3">
      <action>Load prompt from prompts/story-review.md, substitute variables</action>
      <check if="story_review_attempt >= 2">
        <!-- LOW-1 Resolution: Use model: "haiku" parameter -->
        <action>Spawn subagent with Task tool using model: "haiku"</action>
      </check>
      <check else>
        <action>Spawn subagent with Task tool (default model)</action>
      </check>
      <action>Wait for completion</action>
      <action>Parse result for critical issues</action>

      <check if="no critical issues found">
        <action>Log: "Story review passed for [story]"</action>
        <action>Break loop</action>
      </check>

      <action>Increment story_review_attempt</action>
    </loop>
  </for-each>

  <action>Go to Step 3 (CREATE-TECH-SPEC)</action>
</step>

<step n="3" goal="CREATE-TECH-SPEC PHASE (PARALLEL)">
  <action>Log: "Starting CREATE-TECH-SPEC phase for [story_key(s)]"</action>

  <!-- PARALLEL EXECUTION (CRITICAL-2 Resolution: Verified Task tool capability) -->
  <!-- Make TWO Task tool calls in a SINGLE message for concurrent execution -->
  <parallel-execution>
    <task-call id="1">
      <action>Load prompt from prompts/create-tech-spec.md, substitute variables</action>
      <action>Spawn subagent with Task tool (default model)</action>
      <goal>Create tech spec file(s)</goal>
    </task-call>

    <task-call id="2">
      <action>Load prompt from prompts/create-tech-spec-discovery.md, substitute variables</action>
      <action>Spawn subagent with Task tool (default model)</action>
      <goal>Generate tech discovery file(s)</goal>
    </task-call>
  </parallel-execution>

  <action>Wait for BOTH Task calls to complete</action>

  <!-- POST-PARALLEL: Inject project context -->
  <for-each story in="story_keys">
    <action>Run: _bmad/scripts/project-context-injection.sh {{implementation_artifacts}}/{{story}}-discovery-tech.md</action>
  </for-each>

  <action>Log: "CREATE-TECH-SPEC phase complete, discovery files enriched"</action>
  <action>Go to Step 3b (tech-spec review)</action>
</step>

<step n="3b" goal="TECH-SPEC-REVIEW PHASE (SEQUENTIAL)">
  <for-each story in="story_keys">
    <!-- MEDIUM-4 Resolution: Review counters are PER-STORY and reset for each story -->
    <action>Set tech_spec_review_attempt = 1</action>

    <loop max="3">
      <action>Load prompt from prompts/tech-spec-review.md, substitute variables</action>
      <check if="tech_spec_review_attempt >= 2">
        <!-- LOW-1 Resolution: Use model: "haiku" parameter -->
        <action>Spawn subagent with Task tool using model: "haiku"</action>
      </check>
      <check else>
        <action>Spawn subagent with Task tool (default model)</action>
      </check>
      <action>Wait for completion</action>
      <action>Parse result for critical issues</action>

      <check if="no critical issues found">
        <action>Log: "Tech spec review passed for [story]"</action>
        <action>Break loop</action>
      </check>

      <action>Increment tech_spec_review_attempt</action>
    </loop>
  </for-each>

  <action>Go to Step 4 (DEV + CODE-REVIEW)</action>
</step>
```

**Acceptance Criteria:**
- [ ] Create and discovery run in parallel
- [ ] Project context is injected after parallel phase completes
- [ ] Reviews run sequentially with model routing
- [ ] Tech spec follows same pattern

**Complexity:** High

---

### Step 13: Implement Story Pairing (C10) - MEDIUM-3 Resolution

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**MEDIUM-3 Resolution - Epic Extraction Parsing Rule:**

Epic is everything BEFORE the LAST dot-separated segment:
- `2a.1` -> epic `2a`, story `1`
- `2a.2` -> epic `2a`, story `2`
- `1.1` -> epic `1`, story `1`
- `1.2.3` -> epic `1.2`, story `3`

Stories are paired only if they share the same epic prefix.

**What to Do:**
Modify Step 1 to select 1-2 stories:

```markdown
<step n="1" goal="Initialize and select next stories">
  <action>Record start time</action>
  <action>Read `{sprint_status_file}` completely</action>

  <!-- Find stories to process -->
  <action>Parse all entries in `development_status` section</action>
  <action>Filter to story keys only (exclude `epic-*` and `*-retrospective`)</action>
  <action>Sort stories numerically (1-1, 1-2, 1-3, 2-1, 2-2, etc.)</action>
  <action>Find all stories where status != "done"</action>

  <check if="all stories are done">
    <output>All stories in sprint-status.yaml are done. Sprint complete.</output>
    <action>Exit</action>
  </check>

  <!-- Story pairing logic (MEDIUM-3 Resolution: Epic extraction clarified) -->
  <action>Set first_story = first non-done story</action>
  <action>Extract first_story_epic = everything BEFORE the LAST dot in story key</action>
  <comment>Examples: "2a.1" -> epic "2a", "1.2.3" -> epic "1.2"</comment>

  <check if="batch_size == 1">
    <action>Set story_keys = [first_story]</action>
    <action>Log: "Single story mode: processing [first_story]"</action>
  </check>

  <check if="batch_size > 1">
    <action>Find second_story = next non-done story with SAME epic prefix</action>

    <check if="second_story exists AND same epic as first_story">
      <action>Set story_keys = [first_story, second_story]</action>
      <action>Log: "Paired stories: processing [first_story] and [second_story]"</action>
    </check>

    <check else>
      <action>Set story_keys = [first_story]</action>
      <action>Log: "Last story of epic: processing [first_story] alone"</action>
    </check>
  </check>

  <action>Store: story_keys, current_epic</action>
  <action>Log to orchestrator.md: "## Stories: [story_keys]"</action>
</step>
```

Modify Step 4 (DEV + CODE-REVIEW) to be sequential per story:

```markdown
<step n="4" goal="DEV + CODE-REVIEW PHASE (SEQUENTIAL per story)">
  <for-each story in="story_keys">
    <action>Log: "Starting DEV phase for [story]"</action>

    <!-- DEV-STORY -->
    <action>Load prompt from prompts/dev-story.md, substitute variables for [story]</action>
    <action>Spawn subagent with Task tool (default model)</action>
    <action>Wait for completion</action>
    <action>Log result to orchestrator.md</action>

    <!-- CODE-REVIEW LOOP -->
    <!-- MEDIUM-4 Resolution: Review counters are PER-STORY and reset for each story -->
    <action>Set review_attempt = 1</action>
    <action>Initialize error_history = []</action>

    <loop max="10">
      <action>Load prompt from prompts/code-review.md, substitute variables for [story]</action>
      <check if="review_attempt >= 2">
        <!-- LOW-1 Resolution: Use model: "haiku" parameter -->
        <action>Spawn subagent with Task tool using model: "haiku"</action>
      </check>
      <check else>
        <action>Spawn subagent with Task tool (default model)</action>
      </check>
      <action>Wait for completion</action>
      <action>Parse result for issues and severity</action>
      <action>Store error_pattern in error_history</action>
      <action>Log result to orchestrator.md</action>

      <!-- Early exit on repeated errors (C13) -->
      <check if="review_attempt >= 3 AND last 3 errors are similar">
        <action>Mark story as "blocked"</action>
        <action>Log: "REPEATED ERROR - human intervention required"</action>
        <action>Break loop for this story</action>
      </check>

      <check if="ZERO issues found">
        <action>Mark story as "done" in sprint-status.yaml</action>
        <action>Log: "Story [story] completed with ZERO issues"</action>
        <action>Break loop</action>
      </check>

      <check if="review_attempt >= 3 AND no CRITICAL issues">
        <action>Mark story as "done" in sprint-status.yaml</action>
        <action>Log: "Story [story] completed after 3 reviews (non-critical may remain)"</action>
        <action>Break loop</action>
      </check>

      <action>Increment review_attempt</action>
    </loop>
  </for-each>

  <action>Increment stories_completed by length of story_keys</action>
  <action>Go to Step 5 (batch tracking)</action>
</step>
```

**Acceptance Criteria:**
- [ ] Stories are paired only from same epic
- [ ] Last story of epic runs alone
- [ ] batch_size=1 processes single story
- [ ] Dev + code-review runs sequentially per story
- [ ] stories_completed increments by 1 or 2

**Complexity:** High

---

### Step 14: Update instructions.md to Reference Prompt Files

**Files to Modify:**
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**What to Do:**
1. Remove all inline `<subagent-prompt>` blocks
2. Add reference to prompt files folder
3. Add instruction to load prompts from files and substitute variables
4. Update orchestrator.md format to CSV

**Add near top of file:**
```markdown
## Prompt Files Location

Subagent prompts are stored in: `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/`

Available prompts:
- `create-story.md` - CREATE MODE
- `create-story-discovery.md` - DISCOVERY MODE (parallel)
- `story-review.md` - REVIEW MODE
- `create-tech-spec.md` - CREATE MODE
- `create-tech-spec-discovery.md` - DISCOVERY MODE (parallel)
- `tech-spec-review.md` - REVIEW MODE
- `dev-story.md`
- `code-review.md`

To use a prompt:
1. Read the prompt file
2. Substitute variables: `{{story_key}}`, `{{implementation_artifacts}}`, `{{review_attempt}}`
3. Pass the substituted prompt to Task tool
```

**Update Orchestrator Log Format section:**
```markdown
## Orchestrator Log Format

Write to `{orchestrator_log}` in CSV format (no header):

```
unix_timestamp,epic_id,story_id,command,result
```

Use the script: `_bmad/scripts/orchestrator.sh <epic_id> <story_id> <command> <result>`

Example log entries:
```
1706054400,epic-2a,2a.1,create-story,start
1706054520,epic-2a,2a.1,create-story,Story file created
1706054521,epic-2a,2a.1,story-review,start
1706054620,epic-2a,2a.1,story-review,No critical issues
```
```

**Acceptance Criteria:**
- [ ] No inline subagent-prompt blocks remain in instructions.md
- [ ] Prompt files are referenced by path
- [ ] Variable substitution is documented
- [ ] CSV format is documented for orchestrator.md

**Complexity:** Medium

---

## Part 4: Testing Strategy

### Shell Scripts Testing

| Script | Test Command | Expected Result |
|--------|--------------|-----------------|
| orchestrator.sh | `./orchestrator.sh epic-1 2a.1 dev-story start && cat _bmad-output/implementation-artifacts/orchestrator.md` | CSV line appended with timestamp |
| project-context-should-refresh.sh (file missing) | `rm -f _bmad-output/planning-artifacts/project-context.md && ./project-context-should-refresh.sh && echo "Exit code: $?"` | Exit code 0, "TRUE" message |
| project-context-should-refresh.sh (file fresh) | `touch _bmad-output/planning-artifacts/project-context.md && ./project-context-should-refresh.sh && echo "Exit code: $?"` | Exit code 1, "FALSE" message |
| project-context-injection.sh | `./project-context-injection.sh test-discovery.md && grep "Project Context Dump Below" test-discovery.md` | Header found in file |
| project-context-injection.sh (idempotent) | `./project-context-injection.sh test-discovery.md` (run twice) | Second run exits silently |

### Prompt Files Testing

1. **Syntax Check:** Each prompt file should be valid markdown
2. **Variable Check:** All prompts should contain expected variables ({{story_key}}, etc.)
3. **Model Routing Check:** Review prompts should have model routing section

### Integration Testing

1. **Single Story Flow:**
   - Run sprint-runner with batch_size=1
   - Verify Step 0 runs (project context check)
   - Verify create-story and discovery run in parallel
   - Verify discovery files are created
   - Verify project context is injected
   - Verify story-review receives discovery file path
   - Verify Haiku model used for review 2+

2. **Paired Story Flow:**
   - Run sprint-runner with batch_size=2
   - Verify two stories from same epic are selected
   - Verify both discovery files created
   - Verify sequential dev + code-review per story

3. **Early Exit Testing:**
   - Simulate repeated error (may need mock)
   - Verify exit after 3 identical errors
   - Verify story marked as "blocked"

4. **Cleanup Testing (updated per HIGH-4, MEDIUM-5):**
   - Create dummy discovery files
   - Create dummy orchestrator.md with markdown content
   - Run sprint-runner
   - Verify cleanup happens on first loop only (is_first_iteration flag)
   - Verify orchestrator.md is DELETED (not preserved)
   - Verify fresh orchestrator.md created in CSV format by first orchestrator.sh call
   - Verify all deleted files are logged before deletion

---

## Part 5: Rollback Plan

### Before Implementation
1. Create backup branch: `git checkout -b backup-sprint-runner-pre-optimization`
2. Commit current state

### Rollback Steps

| Change | Rollback Action |
|--------|-----------------|
| Shell scripts (C1, C6, C7) | Delete `_bmad/scripts/` folder |
| Prompt files (C2) | Delete `prompts/` folder |
| instructions.md changes | `git checkout main -- _bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md` |

### Partial Rollback
If specific changes cause issues:
1. **Parallel execution broken:** Revert to sequential by removing `<parallel>` blocks
2. **Haiku routing issues:** Remove model_param checks, use general-purpose everywhere
3. **Discovery files broken:** Remove discovery file requirements from prompts

### Recovery Command
```bash
# Full rollback to pre-optimization state
git checkout backup-sprint-runner-pre-optimization -- _bmad/bmm/workflows/4-implementation/sprint-runner/
rm -rf _bmad/scripts/orchestrator.sh _bmad/scripts/project-context-*.sh
```

---

## Implementation Checklist

- [ ] Phase 1: Foundation Scripts
  - [ ] C1: orchestrator.sh created and tested (with `set -e`)
  - [ ] C6: project-context-should-refresh.sh created and tested (with `set -e`)
  - [ ] C7: project-context-injection.sh created and tested (with `set -e`)

- [ ] Phase 2: Prompt Extraction
  - [ ] C2: prompts/ folder created
  - [ ] C2: All 8 prompt files created

- [ ] Phase 3: Prompt Enhancements
  - [ ] C4: Quality gate checklists added
  - [ ] C5: Discovery file generation added
  - [ ] C11: Discovery consumption for reviews added (with project context injection clarification)
  - [ ] C3: Model routing annotations added (using `model: "haiku"` syntax)

- [ ] Phase 4: Orchestrator Logic
  - [ ] C8: Step 0a with project context added
  - [ ] C12: Step 0b cleanup logic added (includes orchestrator.md deletion)
  - [ ] Step 0c batch size determination added
  - [ ] is_first_iteration flag implemented for cleanup safety
  - [ ] C13: Early exit on repeated errors added
  - [ ] C9: Parallel execution implemented (two Task calls in single message)
  - [ ] C10: Story pairing implemented (with epic extraction parsing rule)

- [ ] Phase 5: Final Integration
  - [ ] instructions.md updated to reference prompts
  - [ ] Inline prompts removed
  - [ ] CSV format documented

- [ ] Testing
  - [ ] All shell scripts tested (including `set -e` behavior)
  - [ ] Single story flow verified
  - [ ] Paired story flow verified
  - [ ] Early exit verified
  - [ ] orchestrator.md migration verified (old deleted, fresh CSV created)
  - [ ] Cleanup safety verified (is_first_iteration flag, deletion logging)

- [ ] Review Issues Resolved (Revision 2.0)
  - [x] CRITICAL-2: Parallel execution verified
  - [x] HIGH-4: orchestrator.md migration documented
  - [x] HIGH-3: Step numbering restructured
  - [x] HIGH-2: Project-level discovery references removed
  - [x] MEDIUM-1: `set -e` added to all shell scripts
  - [x] MEDIUM-5: Cleanup safety with is_first_iteration flag
  - [x] LOW-1: Model routing parameter verified

---

## Estimated Timeline

| Phase | Estimated Time | Complexity |
|-------|----------------|------------|
| Phase 1 | 30 minutes | Low |
| Phase 2 | 1 hour | Medium |
| Phase 3 | 30 minutes | Low (mostly done in Phase 2) |
| Phase 4 | 2 hours | High |
| Phase 5 | 30 minutes | Medium |
| Testing | 1 hour | Medium |
| **Total** | **5-6 hours** | |

---

## Notes for Implementer

1. **Parallel Execution (CRITICAL-2 Verified):** The Task tool supports parallel execution by making multiple Task calls in a single message. Both tasks run concurrently, and the orchestrator waits for both to complete before proceeding. This is verified behavior, not conceptual.

2. **Variable Substitution:** Implement a simple find-replace for `{{variable}}` patterns

3. **Error Pattern Matching:** For C13, use semantic similarity rather than exact string match - the agent should determine if errors are "substantially similar"

4. **Model Parameter (LOW-1 Verified):** The Task tool accepts `model: "haiku"` parameter for Haiku routing on reviews 2+

5. **File Paths:** All paths should use the `{output_folder}`, `{implementation_artifacts}`, `{planning_artifacts}` variables defined elsewhere in the workflow

6. **Review Counter Scope (MEDIUM-4):** Review attempt counters (`story_review_attempt`, `tech_spec_review_attempt`, `review_attempt`) are PER-STORY and reset to 1 at the start of each story's review phase

7. **Project Context Injection (HIGH-2):** There is no separate `discovery-project-level.md` file. Project context is INJECTED INTO `{story_id}-discovery-story.md` and `{story_id}-discovery-tech.md` by the injection script. Review agents read only their respective discovery file.

8. **orchestrator.md Migration (HIGH-4):** The old orchestrator.md (markdown format) is DELETED during cleanup. A fresh CSV-only orchestrator.md is created by the first `orchestrator.sh` call.

9. **Cleanup Safety (MEDIUM-5):** Cleanup only runs when `is_first_iteration == true`. All files are logged before deletion.

10. **Dashboard Update (LOW-3):** Dashboard.html update to parse CSV format is a FOLLOW-UP TASK, not included in this implementation plan. CSV format can be parsed by standard tools in the interim.
