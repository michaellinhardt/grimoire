# Epics & Stories - Sprint Runner v3 Optimization

**PRD Source:** `_bmad-output/planning-artifacts/prd-sprint-runner-v3.md`
**Context:** `_bmad-output/implementation-artifacts/sprint-runner-v3-context.md`
**Research:** `_bmad-output/implementation-artifacts/sprint-runner-v3-research.md`
**Date:** 2026-01-24

---

## Executive Summary

Sprint Runner v3 optimizes the BMAD sprint-runner workflow orchestration system by moving setup work from subagents to the Python orchestrator. Using Claude CLI's `--prompt-system-append` flag, pre-computed context is injected at agent spawn time, reducing token usage and improving consistency.

**Core Innovation:** Every agent receives identical, verified context via `--prompt-system-append`. No more hoping agents correctly discover and read the right files. Despite being "pre-computed," every spawn reads files fresh at that exact moment for maximum accuracy.

---

## Epic Summary

| Epic | Title | Stories | Complexity |
|------|-------|---------|------------|
| A | Orchestrator Infrastructure | 5 | Medium |
| B | Custom Sprint Commands | 8 | Low-Medium |
| C | Documentation & Cleanup | 3 | Low |
| **Total** | | **16** | |

---

## Requirements Coverage

### Functional Requirements from PRD

| FR | Description | Epic |
|----|-------------|------|
| FR1 | Build prompt-system-append content from story keys and command name | A |
| FR2 | Scan implementation-artifacts for files matching story IDs | A |
| FR3 | Deduplicate file list by path before injection | A |
| FR4 | Generate XML injection format with file paths and content | A |
| FR5 | Pass prompt-system-append to Claude CLI spawn | A |
| FR6 | Copy project-context.md to sprint-project-context.md | A |
| FR7 | Move completed story artifacts to archived-artifacts | A |
| FR8 | Read files fresh at each spawn (no caching between spawns) | A |
| FR9 | sprint-create-story creates story files using injected context | B |
| FR10 | sprint-create-story outputs TECH-SPEC-DECISION marker | B |
| FR11 | sprint-create-story-discovery generates discovery files in parallel | B |
| FR12 | sprint-story-review reviews stories using injected context | B |
| FR13 | sprint-story-review outputs CRITICAL-ISSUES-FOUND marker | B |
| FR14 | sprint-create-tech-spec creates tech specs using injected context | B |
| FR15 | sprint-tech-spec-review reviews tech specs using injected context | B |
| FR16 | sprint-tech-spec-review outputs CRITICAL-ISSUES-FOUND marker | B |
| FR17 | sprint-dev-story implements stories using injected context | B |
| FR18 | sprint-code-review performs adversarial review using injected context | B |
| FR19 | sprint-code-review outputs HIGHEST SEVERITY marker | B |
| FR20 | sprint-commit analyzes git status to find modified files | B |
| FR21 | sprint-commit matches files to story IDs from File List | B |
| FR22 | sprint-commit stages only files related to current batch stories | B |
| FR23 | sprint-commit creates commit with appropriate message format | B |
| FR24 | Sprint commands process comma-separated story_keys sequentially | B |
| FR25 | Sprint commands log start/end for each story in multi-story batches | B |
| FR26 | Sprint commands maintain isolation between stories in same batch | B |
| FR27 | Subagents call sprint-log.sh directly with JSON argument | A |
| FR28 | Subagents log with task IDs: setup, analyze, generate, write, validate, implement, tests, lint | B |
| FR29 | Subagents include attempt number in code-review logging | B |
| FR30 | Orchestrator identifies all files with story ID in filename | A |
| FR31 | Orchestrator moves matched files to archived-artifacts directory | A |
| FR32 | Orchestrator creates archived-artifacts directory if not exists | A |

---

## Epic A: Orchestrator Infrastructure (Python/Server Code)

**User Outcome:** The orchestrator handles all context discovery, file injection, and cleanup, enabling subagents to start productive work immediately without setup overhead.

**Technical Scope:**
- All Python code changes to `orchestrator.py`
- New `sprint-log.sh` shell script
- All server-side functionality for context injection

---

### Story A-1: Build Prompt System Append Method

As an **orchestrator developer**,
I want **a method to build prompt-system-append content from story keys**,
So that **subagents receive complete, verified context at spawn time**.

**Acceptance Criteria:**

**Given** the orchestrator needs to spawn a subagent
**When** `build_prompt_system_append()` is called with command_name and story_keys
**Then** the method scans `_bmad-output/implementation-artifacts/` for files matching story IDs
**And** files are matched by filename pattern (e.g., `*{story_key}*`)
**And** file paths are deduplicated using a set-based approach
**And** each file is read fresh at call time (no caching between spawns)

**Given** files are collected for injection
**When** generating the XML format
**Then** the output follows this structure:
```xml
<file_injections rule="DO NOT read these files - content already provided">
  <file path="_bmad-output/planning-artifacts/sprint-project-context.md">
    [content of project-context.md]
  </file>
  <file path="_bmad-output/implementation-artifacts/sprint-3a-1-discovery-story.md">
    [content of discovery file]
  </file>
</file_injections>

<workflow_instructions>
  [Pre-computed workflow instruction string]
</workflow_instructions>
```

**Given** optional parameters are provided
**When** building the injection
**Then** `include_project_context=True` includes sprint-project-context.md
**And** `include_discovery=True` includes discovery files for the story
**And** `include_tech_spec=True` includes tech-spec files for the story
**And** `additional_files` list allows explicit file inclusion

**Given** injection size is computed
**When** the total exceeds 100KB
**Then** a warning is logged
**And** if exceeds 150KB, an error is raised (future: implement sharding)

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

**Implementation Notes:**
- Use `pathlib.Path` for all file operations
- Maintain file order: project context, architecture, story files, discovery files, tech-spec files
- Include size monitoring with warning threshold

---

### Story A-2: Update Spawn Subagent Method

As an **orchestrator developer**,
I want **the spawn_subagent method to accept and pass prompt_system_append**,
So that **subagents receive injected context via Claude CLI's `--prompt-system-append` flag**.

**Acceptance Criteria:**

**Given** the spawn_subagent method signature
**When** updated
**Then** it accepts an optional `prompt_system_append: Optional[str] = None` parameter
**And** the existing functionality remains unchanged when parameter is not provided

**Given** `prompt_system_append` is provided
**When** building the Claude CLI command
**Then** the `--prompt-system-append` flag is added with the content
**And** the content is properly escaped/quoted for shell execution
**And** the flag appears after other model parameters

**Given** a subagent is spawned with injection
**When** parsing the NDJSON output
**Then** existing event parsing continues to work
**And** task-id events are captured correctly
**And** WebSocket events are emitted as before

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

**Implementation Notes:**
- Handle large content strings (may need to write to temp file and reference)
- Test with content containing special characters (quotes, XML, etc.)

---

### Story A-3: Copy Project Context Method

As an **orchestrator developer**,
I want **a method to copy project-context.md to sprint-project-context.md**,
So that **all agents in a sprint batch receive identical, frozen context**.

**Acceptance Criteria:**

**Given** project-context.md exists at `_bmad-output/planning-artifacts/project-context.md`
**When** `copy_project_context()` is called
**Then** content is copied to `_bmad-output/planning-artifacts/sprint-project-context.md`
**And** the copy preserves exact content (no modifications)
**And** any existing sprint-project-context.md is overwritten

**Given** project-context.md does not exist
**When** `copy_project_context()` is called
**Then** an error is logged
**And** the method returns False
**And** the orchestrator can decide whether to continue or abort

**Given** a sprint batch is starting
**When** the batch initialization runs
**Then** `copy_project_context()` is called once at the start
**And** all subsequent spawns use the sprint-project-context.md copy

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

**Implementation Notes:**
- Call this at the start of each batch, not each spawn
- Consider adding timestamp to track when copy was made

---

### Story A-4: Cleanup Batch Files Method

As an **orchestrator developer**,
I want **a method to move completed story artifacts to archived-artifacts**,
So that **the implementation-artifacts folder stays clean and organized**.

**Acceptance Criteria:**

**Given** a list of story_keys for a completed batch
**When** `cleanup_batch_files()` is called
**Then** `_bmad-output/archived-artifacts/` directory is created if it doesn't exist
**And** all files in `implementation-artifacts/` matching any story_key are identified
**And** files are matched by pattern `*{story_key}*` in filename

**Given** files are identified for archival
**When** moving files
**Then** each file is moved to `archived-artifacts/` preserving the filename
**And** if a file with same name exists in archive, it is overwritten
**And** a count of moved files is returned

**Given** sprint-project-context.md exists
**When** cleanup runs
**Then** sprint-project-context.md is NOT moved (stays in planning-artifacts)
**And** only implementation-artifacts files are affected

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

**Implementation Notes:**
- Use `shutil.move()` for atomic moves
- Log each file moved for debugging
- Consider option to delete instead of archive (future enhancement)

---

### Story A-5: Sprint Log Shell Script

As an **orchestrator developer**,
I want **a shell script that subagents call directly for logging**,
So that **logging is reliable without orchestrator stdout parsing**.

**Acceptance Criteria:**

**Given** a subagent needs to log an event
**When** calling `_bmad/scripts/sprint-log.sh` with JSON argument
**Then** the script accepts a single JSON string argument
**And** the JSON is validated for required fields: epic_id, story_id, command, task_id, status
**And** optional fields include: message, metrics, attempt

**Given** valid JSON is provided
**When** the script executes
**Then** the event is appended to the sprint log file
**And** format is: `timestamp | epic_id | story_id | command | task_id | status | message`
**And** the log file is at `_bmad-output/implementation-artifacts/sprint-log.txt`

**Given** a subagent executes a logging call
**When** during instruction execution
**Then** the call format is:
```bash
_bmad/scripts/sprint-log.sh '{"epic_id":"2a","story_id":"2a-1","command":"create-story","task_id":"setup","status":"start","message":"Initializing story creation"}'
```

**File List:**
- `_bmad/scripts/sprint-log.sh` (new file)

**Implementation Notes:**
- Keep script minimal and fast
- Use `jq` for JSON parsing if available, fallback to grep/awk
- Ensure atomic writes to log file

---

### Story A-6: Update Phase Methods for Sprint Commands

As an **orchestrator developer**,
I want **all phase methods updated to use sprint-* commands with injection**,
So that **the new optimized workflow is fully integrated**.

**Acceptance Criteria:**

**Given** the create-story phase (Phase 2)
**When** executing
**Then** `sprint-create-story` command is invoked instead of BMAD `create-story`
**And** `build_prompt_system_append()` is called with story_keys
**And** project context and discovery files are injected

**Given** the story-review phase (Phase 2b)
**When** executing
**Then** `sprint-story-review` command is invoked
**And** story files and discovery files are injected

**Given** the tech-spec phase (Phase 3)
**When** executing
**Then** `sprint-create-tech-spec` command is invoked
**And** story, discovery, and project context are injected

**Given** the tech-spec-review phase (Phase 3b)
**When** executing
**Then** `sprint-tech-spec-review` command is invoked
**And** tech-spec and story files are injected

**Given** the dev-story phase (Phase 4)
**When** executing
**Then** `sprint-dev-story` command is invoked
**And** story, tech-spec, discovery, and project context are injected

**Given** the code-review phase (Phase 4b)
**When** executing
**Then** `sprint-code-review` command is invoked
**And** story file with Dev Agent Record is injected
**And** attempt number is passed for logging

**Given** the batch-commit phase (Phase 4c)
**When** executing
**Then** `sprint-commit` command is invoked instead of BMAD `batch-commit`
**And** story files are injected for File List matching

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

**Implementation Notes:**
- Each phase method should build appropriate injection content
- Maintain parallel execution where applicable (create-story + story-discovery)
- Preserve existing error handling and retry logic

---

## Epic B: Custom Sprint Commands (Markdown/BMAD Workflows)

**User Outcome:** Eight optimized sprint-* command variants that receive context via injection and immediately begin productive work without setup overhead.

**Technical Scope:**
- All 8 `sprint-*` command folders
- Each command's `workflow.yaml`, `instructions.xml`, `template.md`, `checklist.md`
- Pure markdown/YAML content, no Python

**Command Directory:** `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/`

---

### Story B-1: sprint-create-story Command

As a **subagent**,
I want **a sprint-optimized create-story command**,
So that **I can immediately create story files using injected context**.

**Acceptance Criteria:**

**Given** the command folder structure
**When** created at `commands/sprint-create-story/`
**Then** contains: `workflow.yaml`, `instructions.xml`, `template.md`, `checklist.md`

**Given** instructions.xml content
**When** compared to BMAD create-story
**Then** REMOVES:
- Steps to read project-context.md (injected via `<file_injections>`)
- Steps to run discover_inputs protocol (discovery injected)
- Steps to update sprint-status.yaml (orchestrator handles)
**And** ADDS:
- Instruction: "Project context and discovery have been pre-injected. See `<file_injections>` section"
- Instruction: "For multi-story batches, process each story_key sequentially"
- Output: `[TECH-SPEC-DECISION: REQUIRED]` or `[TECH-SPEC-DECISION: SKIP]` marker
- Logging calls via `sprint-log.sh` with task IDs: setup, analyze, generate, write, validate

**Given** workflow.yaml content
**When** defining the command
**Then** includes:
- `name: sprint-create-story`
- `description: Create story files using injected context`
- `variables: story_keys, epic_id`

**Given** multi-story batch execution
**When** story_keys contains comma-separated values (e.g., "2a-1,2a-2")
**Then** each story is processed sequentially
**And** logging includes start/end for each story
**And** isolation is maintained between stories

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story/instructions.xml`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story/template.md`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story/checklist.md`

---

### Story B-2: sprint-create-story-discovery Command

As a **subagent**,
I want **a discovery-only command for parallel execution**,
So that **discovery can run alongside story creation for efficiency**.

**Acceptance Criteria:**

**Given** the command folder structure
**When** created at `commands/sprint-create-story-discovery/`
**Then** contains: `workflow.yaml`, `instructions.xml`
**And** no template.md (output format is defined in instructions)

**Given** instructions.xml content
**When** defining discovery workflow
**Then** INCLUDES:
- Codebase exploration for story context
- Git pattern analysis for relevant files
- Architecture constraint discovery
**And** OUTPUTS:
- Discovery file at: `_bmad-output/implementation-artifacts/sprint-{story_key}-discovery-story.md`
**And** ADDS:
- Instruction: "This runs in PARALLEL with sprint-create-story"
- Instruction: "Output discovery information that will be injected into later phases"
- Logging calls with task IDs: setup, explore, write

**Given** parallel execution context
**When** running with sprint-create-story
**Then** both commands complete independently
**And** discovery output is available for subsequent phases

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story-discovery/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story-discovery/instructions.xml`

---

### Story B-3: sprint-story-review Command

As a **subagent**,
I want **a sprint-optimized story review command**,
So that **I can review stories using injected context without discovery overhead**.

**Acceptance Criteria:**

**Given** the command folder structure
**When** created at `commands/sprint-story-review/`
**Then** contains: `workflow.yaml`, `instructions.xml`

**Given** instructions.xml content
**When** compared to review workflows
**Then** REMOVES:
- Story creation logic
- Discovery file reading (injected)
- Epic requirement discovery (injected)
**And** ADDS:
- Instruction: "Story and discovery files pre-injected. See `<file_injections>`"
- Instruction: "Review for completeness, clarity, and technical accuracy"
- Output: `[CRITICAL-ISSUES-FOUND: YES]` or `[CRITICAL-ISSUES-FOUND: NO]` marker
- Logging calls with task IDs: setup, analyze, fix, validate

**Given** critical issues are found
**When** the marker is output
**Then** orchestrator spawns background review chain (review-2, review-3)
**And** background chain uses haiku model for efficiency

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-story-review/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-story-review/instructions.xml`

---

### Story B-4: sprint-create-tech-spec Command

As a **subagent**,
I want **a sprint-optimized tech-spec creation command**,
So that **I can create technical specifications using injected context**.

**Acceptance Criteria:**

**Given** the command folder structure
**When** created at `commands/sprint-create-tech-spec/`
**Then** contains: `workflow.yaml`, `instructions.xml`, `template.md`, `checklist.md`

**Given** instructions.xml content
**When** compared to tech-spec creation
**Then** REMOVES:
- Full discovery phase (discovery files injected)
- Project context loading (injected)
- Architecture loading (injected)
**And** ADDS:
- Instruction: "All context pre-injected. Perform INLINE discovery only as needed"
- Output file at: `_bmad-output/implementation-artifacts/sprint-tech-spec-{story_key}.md`
- Logging calls with task IDs: setup, discover, generate, write, validate

**Given** story requires tech-spec
**When** TECH-SPEC-DECISION was REQUIRED in create-story
**Then** this command executes with full story and discovery context

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-tech-spec/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-tech-spec/instructions.xml`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-tech-spec/template.md`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-tech-spec/checklist.md`

---

### Story B-5: sprint-tech-spec-review Command

As a **subagent**,
I want **a sprint-optimized tech-spec review command**,
So that **I can review technical specifications using injected context**.

**Acceptance Criteria:**

**Given** the command folder structure
**When** created at `commands/sprint-tech-spec-review/`
**Then** contains: `workflow.yaml`, `instructions.xml`

**Given** instructions.xml content
**When** defining review workflow
**Then** REMOVES:
- Tech-spec creation logic
- Discovery process (already complete)
**And** ADDS:
- Instruction: "Tech-spec and story files pre-injected. Review for technical completeness"
- Instruction: "Check for architecture compliance, security concerns, performance implications"
- Output: `[CRITICAL-ISSUES-FOUND: YES]` or `[CRITICAL-ISSUES-FOUND: NO]` marker
- Logging calls with task IDs: setup, analyze, fix, validate

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-tech-spec-review/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-tech-spec-review/instructions.xml`

---

### Story B-6: sprint-dev-story Command

As a **subagent**,
I want **a sprint-optimized dev-story command**,
So that **I can implement stories immediately using injected context**.

**Acceptance Criteria:**

**Given** the command folder structure
**When** created at `commands/sprint-dev-story/`
**Then** contains: `workflow.yaml`, `instructions.xml`

**Given** instructions.xml content
**When** compared to BMAD dev-story
**Then** REMOVES:
- Step 1: Story discovery (orchestrator provides story_key)
- Step 2: Project context loading (injected)
- Step 4: Sprint-status marking (orchestrator handles)
**And** ADDS:
- Instruction: "All context pre-injected: story file, tech-spec, project context, discovery file. See `<file_injections>`"
- Instruction: "Do NOT attempt to read files from disk - use injected content"
- Instruction: "Update Dev Agent Record in story file with implementation notes"
- Logging calls with task IDs: setup, implement, tests, lint, validate

**Given** the Dev Agent Record section
**When** implementation completes
**Then** File List is populated with all modified/created files
**And** this File List is used by sprint-commit for selective staging

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-dev-story/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-dev-story/instructions.xml`

---

### Story B-7: sprint-code-review Command

As a **subagent**,
I want **a sprint-optimized code-review command**,
So that **I can perform adversarial review using injected context with auto-fix**.

**Acceptance Criteria:**

**Given** the command folder structure
**When** created at `commands/sprint-code-review/`
**Then** contains: `workflow.yaml`, `instructions.xml`

**Given** instructions.xml content
**When** compared to BMAD code-review
**Then** REMOVES:
- Step 1 (git discovery part): Story and context already injected
- File discovery: Code changes are in the injected story files
**And** MODIFIES:
- Still analyze git changes but with injected story context as baseline
**And** ADDS:
- Instruction: "Story file and implementation context pre-injected. Focus on adversarial code review"
- Instruction: "Log review attempts with attempt number: command='code-review-{attempt_num}'"
- Output: `HIGHEST SEVERITY: {CRITICAL|HIGH|MEDIUM|LOW|ZERO ISSUES}`
- Output: `Issues: X CRITICAL, X HIGH, X MEDIUM, X LOW`
- Logging calls with task IDs: setup, analyze, fix, validate

**Given** review attempt number
**When** logging
**Then** command field includes attempt: `code-review-1`, `code-review-2`, etc.
**And** orchestrator provides attempt number via injection or argument

**Given** issues are found
**When** severity is CRITICAL or HIGH
**Then** auto-fix is performed
**And** code-review loop continues (up to 10 attempts)

**Given** ZERO ISSUES result
**When** all issues resolved
**Then** story status transitions to "done"

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-code-review/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-code-review/instructions.xml`

---

### Story B-8: sprint-commit Command

As a **subagent**,
I want **a smart git commit command that commits only story-related files**,
So that **commits are clean and isolated to the completed batch**.

**Acceptance Criteria:**

**Given** the command folder structure
**When** created at `commands/sprint-commit/`
**Then** contains: `workflow.yaml`, `instructions.xml`

**Given** instructions.xml content
**When** defining commit workflow
**Then** INCLUDES:
1. Run `git status` to find modified/staged files
2. Parse injected story files for Dev Agent Record -> File List
3. Match git changes to story IDs using File List
4. For ambiguous files, investigate file contents
5. Stage only files related to current batch stories
6. Create commit with message format: `feat({epic_id}): implement stories {story_ids}`
7. Report files committed and skipped

**Given** story files are injected
**When** extracting File List
**Then** each story's Dev Agent Record -> File List section is parsed
**And** all listed files are candidates for commit

**Given** a file in git status is NOT in any File List
**When** deciding whether to commit
**Then** the file is SKIPPED (conservative approach)
**And** skipped files are reported in output

**Given** commit message format
**When** creating commit
**Then** format is: `feat({epic_id}): implement stories {story_ids}`
**And** example: `feat(2a): implement stories 2a-1, 2a-2`
**And** includes `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`

**Given** logging requirements
**When** executing
**Then** log with task IDs: setup, stage, commit, validate

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-commit/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-commit/instructions.xml`

---

## Epic C: Documentation & Cleanup

**User Outcome:** Clear documentation, removed legacy code, and updated configuration for the v3 architecture.

---

### Story C-1: Update README.md

As a **developer**,
I want **the sprint-runner README updated for v3 architecture**,
So that **the documentation reflects the new custom commands and injection approach**.

**Acceptance Criteria:**

**Given** the README at `_bmad/bmm/workflows/4-implementation/sprint-runner/README.md`
**When** updated
**Then** includes:
- Overview of v3 architecture and `--prompt-system-append` approach
- List of 8 custom `sprint-*` commands with descriptions
- Explanation of context injection flow
- File naming conventions (`sprint-{story_key}.md`, etc.)
- Logging architecture via `sprint-log.sh`
- Migration notes from v2 to v3

**Given** the commands/ folder structure
**When** documented
**Then** each command folder is listed with its purpose:
- `sprint-create-story/` - Create story files (context injected)
- `sprint-create-story-discovery/` - Parallel discovery for stories
- `sprint-story-review/` - Review stories (context injected)
- `sprint-create-tech-spec/` - Create tech specs (context injected)
- `sprint-tech-spec-review/` - Review tech specs (context injected)
- `sprint-dev-story/` - Implement stories (context injected)
- `sprint-code-review/` - Adversarial review (context injected)
- `sprint-commit/` - Smart git commit by story IDs

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/README.md`

---

### Story C-2: Delete Old Prompts Folder

As a **developer**,
I want **the old prompts/ folder removed**,
So that **the codebase is clean and uses only the new commands/ approach**.

**Acceptance Criteria:**

**Given** the folder `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/`
**When** v3 is fully functional
**Then** the entire `prompts/` folder is deleted
**And** all contents (*.md prompt files) are removed
**And** no references to `prompts/` remain in orchestrator.py
**And** no references to `prompts/` remain in instructions.md

**Given** the orchestrator previously used prompts/
**When** updated for v3
**Then** all prompt file paths are replaced with commands/ paths
**And** the `_compute_workflow_instructions()` method references commands/

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/` (DELETE)

---

### Story C-3: Update Task Taxonomy

As a **developer**,
I want **task-taxonomy.yaml updated for v3 commands**,
So that **logging task IDs are accurate and complete**.

**Acceptance Criteria:**

**Given** task-taxonomy.yaml at `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml`
**When** updated for v3
**Then** includes task IDs for all sprint-* commands:
- sprint-create-story: setup, analyze, generate, write, validate
- sprint-create-story-discovery: setup, explore, write
- sprint-story-review: setup, analyze, fix, validate
- sprint-create-tech-spec: setup, discover, generate, write, validate
- sprint-tech-spec-review: setup, analyze, fix, validate
- sprint-dev-story: setup, implement, tests, lint, validate
- sprint-code-review: setup, analyze, fix, validate
- sprint-commit: setup, stage, commit, validate

**Given** logging via sprint-log.sh
**When** subagents log events
**Then** task_id values match the taxonomy
**And** command values use sprint-* names

**File List:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml`

---

## Implementation Dependencies

### Story Dependencies

```
A-1 (build_prompt_system_append) ──┬──> A-6 (update phase methods)
A-2 (spawn_subagent update) ───────┘
A-3 (copy_project_context) ────────> A-6 (update phase methods)
A-4 (cleanup_batch_files) ─────────> A-6 (update phase methods)
A-5 (sprint-log.sh) ───────────────> B-* (all commands use logging)

A-6 (update phase methods) ────────> B-* (commands must exist)

B-1 (sprint-create-story) ─────────┐
B-2 (sprint-create-story-discovery)┼──> Integration Testing
B-3 (sprint-story-review) ─────────┤
B-4 (sprint-create-tech-spec) ─────┤
B-5 (sprint-tech-spec-review) ─────┤
B-6 (sprint-dev-story) ────────────┤
B-7 (sprint-code-review) ──────────┤
B-8 (sprint-commit) ───────────────┘

C-1 (README update) ───────────────> After B-* complete
C-2 (delete prompts/) ─────────────> After B-* complete and tested
C-3 (task taxonomy) ───────────────> Before B-* (needed for logging)
```

### Recommended Implementation Order

**Phase 1: Infrastructure Foundation**
1. C-3 (task taxonomy update - needed for logging)
2. A-5 (sprint-log.sh - needed by commands)
3. A-1 (build_prompt_system_append)
4. A-2 (spawn_subagent update)
5. A-3 (copy_project_context)
6. A-4 (cleanup_batch_files)

**Phase 2: Custom Commands**
7. B-1 (sprint-create-story)
8. B-2 (sprint-create-story-discovery)
9. B-3 (sprint-story-review)
10. B-4 (sprint-create-tech-spec)
11. B-5 (sprint-tech-spec-review)
12. B-6 (sprint-dev-story)
13. B-7 (sprint-code-review)
14. B-8 (sprint-commit)

**Phase 3: Integration**
15. A-6 (update phase methods)

**Phase 4: Cleanup**
16. C-1 (README update)
17. C-2 (delete prompts/)

---

## Success Criteria

### Performance
- [ ] Agent startup: Immediate (no setup steps executed)
- [ ] Context injection build: < 1 second per agent
- [ ] File scanning: < 500ms for implementation-artifacts directory
- [ ] Injection size: < 150KB per agent (warn if larger)
- [ ] Token usage: Measurable reduction vs v2

### Reliability
- [ ] Zero context injection failures
- [ ] File deduplication always correct
- [ ] Cleanup moves all and only completed story artifacts
- [ ] Sprint-commit stages only related files

### Functional Completeness
- [ ] All 8 sprint-* commands created and functional
- [ ] Orchestrator `build_prompt_system_append()` working
- [ ] Orchestrator `spawn_subagent()` accepts prompt_system_append
- [ ] Orchestrator `cleanup_batch_files()` working
- [ ] Orchestrator `copy_project_context()` working
- [ ] All phase methods use new commands
- [ ] End-to-end sprint batch completes successfully

---

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|---------------------|
| Injection size too large | Monitor size, warn >100KB, implement sharding if >150KB |
| Agents still read files | Explicit "DO NOT read" instruction with rule attribute |
| Multi-story logging confusion | Per-story sequential processing with individual logging |
| Git commit wrong files | Conservative matching from File List, investigation for ambiguous |
| Breaking existing BMAD | Duplicate, never modify - sprint-* are completely separate |
| Deduplication logic errors | Set-based path tracking, test with overlapping patterns |
