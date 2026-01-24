# Sprint Runner v3 - Optimization Context File

## Overview

This document describes the comprehensive optimization of the sprint-runner workflow system. The goal is to **accelerate workflow execution time** and **improve context accuracy/quality** by moving setup work from subagents to the Python orchestrator.

---

## Problem Statement

Currently, sprint-runner subagents:
1. Must read and parse BMAD command files at startup
2. Must discover and read project-context.md themselves
3. Must find and read discovery files themselves
4. Perform redundant file reads across multiple agents
5. Execute initialization steps that could be pre-computed

This causes:
- Wasted tokens on repetitive setup
- Inconsistent context loading
- Slower execution times
- Potential for agents to miss or misread context

---

## Solution Architecture

### 1. Custom Commands (`sprint-*`)

Create dedicated sprint-runner command variants that:
- Are pre-optimized for the orchestrator workflow
- Have setup steps removed (handled by script)
- Receive all context via `--prompt-system-append`
- Follow BMAD workflow structure for consistency

**Location:** `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/`

**Commands to create:**
| Command | Purpose |
|---------|---------|
| `sprint-create-story` | Create story files (no project discovery) |
| `sprint-create-story-discovery` | Generate discovery files only |
| `sprint-story-review` | Review existing stories (skip creation) |
| `sprint-create-tech-spec` | Create tech specs (context injected) |
| `sprint-tech-spec-review` | Review tech specs |
| `sprint-dev-story` | Implement story (all context injected) |
| `sprint-code-review` | Code review (all context injected) |
| `sprint-commit` | Smart git commit by story IDs |

### 2. Prompt System Append

Use Claude CLI's `--prompt-system-append` flag to inject:

```xml
<file_injections rule="DO NOT read these files during initialization - content already provided">
  <file path="_bmad-output/planning-artifacts/sprint-project-context.md">
    [content of project-context.md]
  </file>
  <file path="_bmad-output/implementation-artifacts/sprint-3a-1-discovery-story.md">
    [content of discovery file]
  </file>
  <!-- All files with story IDs from current batch -->
</file_injections>

<workflow_instructions>
  [Pre-computed workflow instruction string - replaces the "load workflow.xml" steps]
</workflow_instructions>
```

**Order in prompt system:**
1. Original Claude Code system prompt (preserved)
2. BMAD command workflow (from skill invocation)
3. **Our appended content** (via --prompt-system-append):
   - `<file_injections>` with all context files
   - `<workflow_instructions>` with pre-computed command

### 3. File Scanning & Injection

The orchestrator implements a routine that:
1. Scans `_bmad-output/implementation-artifacts/` for files containing story IDs
2. Collects all matching files (by filename, not content)
3. Deduplicates the list (same file may match multiple patterns)
4. Generates XML injection string
5. Appends to prompt system

**Matching logic:** Any file with story ID in filename (e.g., `sprint-3a-1-discovery-story.md`, `sprint-tech-spec-3a-1.md`)

### 4. File Naming Convention

ALL artifacts use `sprint-` prefix:
- `sprint-{story_key}.md` - Story files
- `sprint-{story_key}-discovery-story.md` - Discovery files
- `sprint-tech-spec-{story_key}.md` - Tech spec files
- `sprint-project-context.md` - Project context copy

### 5. Cleanup Workflow

Moved from batch-commit to orchestrator script:
1. List all files in `implementation-artifacts/` with story ID from current batch
2. Move matched files to `archived-artifacts/`
3. No separate subagent needed

### 6. Sprint-Commit Command

New custom command that:
1. Runs `git status` to see changes
2. Filters to files related to story IDs (by filename pattern)
3. Can investigate files if unsure about relation
4. Stages only related files
5. Commits with appropriate message
6. Ignores unrelated changes

---

## Implementation Details

### Orchestrator Changes (`orchestrator.py`)

#### New Method: `build_prompt_system_append()`
```python
def build_prompt_system_append(
    self,
    command_name: str,
    story_keys: list[str],
    include_project_context: bool = True,
    include_discovery: bool = False,
    include_tech_spec: bool = False,
    additional_files: list[str] = None
) -> str:
    """Build the --prompt-system-append content for a subagent."""

    files_to_inject = []

    # 1. Project context (if needed)
    if include_project_context:
        ctx_path = self.project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"
        if ctx_path.exists():
            files_to_inject.append((str(ctx_path), ctx_path.read_text()))

    # 2. Scan for all files with story IDs
    impl_artifacts = self.project_root / "_bmad-output/implementation-artifacts"
    for story_key in story_keys:
        for file in impl_artifacts.glob(f"*{story_key}*"):
            if file.is_file():
                files_to_inject.append((str(file), file.read_text()))

    # 3. Additional explicit files
    if additional_files:
        for file_path in additional_files:
            path = Path(file_path)
            if path.exists():
                files_to_inject.append((str(path), path.read_text()))

    # 4. Deduplicate by path
    seen_paths = set()
    unique_files = []
    for path, content in files_to_inject:
        if path not in seen_paths:
            seen_paths.add(path)
            unique_files.append((path, content))

    # 5. Build XML
    xml_parts = ['<file_injections rule="DO NOT read these files during initialization - content already provided">']
    for path, content in unique_files:
        xml_parts.append(f'  <file path="{path}">')
        xml_parts.append(content)
        xml_parts.append('  </file>')
    xml_parts.append('</file_injections>')

    # 6. Add workflow instructions
    workflow_str = self._compute_workflow_instructions(command_name, story_keys)
    xml_parts.append('<workflow_instructions>')
    xml_parts.append(workflow_str)
    xml_parts.append('</workflow_instructions>')

    return '\n'.join(xml_parts)
```

#### Updated Method: `spawn_subagent()`
```python
async def spawn_subagent(
    self,
    prompt: str,
    prompt_name: str = "unknown",
    wait: bool = True,
    is_background: bool = False,
    model: Optional[str] = None,
    prompt_system_append: Optional[str] = None,  # NEW
) -> dict[str, Any]:
    """Spawn Claude CLI subagent with optional prompt system append."""

    args = ["claude", "-p", "--output-format", "stream-json"]

    if model:
        args.extend(["--model", model])

    if prompt_system_append:
        args.extend(["--prompt-system-append", prompt_system_append])

    # ... rest of method
```

#### New Method: `cleanup_batch_files()`
```python
def cleanup_batch_files(self, story_keys: list[str]) -> None:
    """Move completed story artifacts to archived-artifacts."""

    impl_artifacts = self.project_root / "_bmad-output/implementation-artifacts"
    archive_dir = self.project_root / "_bmad-output/archived-artifacts"
    archive_dir.mkdir(parents=True, exist_ok=True)

    for story_key in story_keys:
        for file in impl_artifacts.glob(f"*{story_key}*"):
            if file.is_file():
                dest = archive_dir / file.name
                file.rename(dest)
```

#### New Method: `copy_project_context()`
```python
def copy_project_context(self) -> None:
    """Copy project-context.md to sprint-project-context.md for injection."""

    source = self.project_root / "_bmad-output/planning-artifacts/project-context.md"
    dest = self.project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"

    if source.exists():
        dest.write_text(source.read_text())
```

### Custom Command Structure

Each command folder follows BMAD structure:
```
sprint-create-story/
├── workflow.yaml       # Metadata and variable definitions
├── instructions.xml    # Step-by-step instructions (modified for sprint-runner)
├── template.md         # Output template (if applicable)
└── checklist.md        # Validation checklist (if applicable)
```

**Key modifications per command:**

#### sprint-create-story
- REMOVE: Steps to read project-context.md (injected)
- REMOVE: Steps to run discover_inputs protocol (injected)
- ADD: Instruction to use injected files from `<file_injections>`
- KEEP: All story creation logic, validation, tech-spec decision

#### sprint-story-review
- REMOVE: All creation steps
- REMOVE: Steps to read discovery files (injected)
- ADD: Review-focused instructions
- ADD: Critical issue detection and reporting

#### sprint-create-tech-spec
- REMOVE: Discovery steps (context injected)
- REMOVE: Project context reading (injected)
- KEEP: Tech spec generation logic

#### sprint-dev-story
- REMOVE: Context loading steps (injected)
- ADD: Instruction to use injected story and tech-spec files

#### sprint-code-review
- REMOVE: Context loading (injected)
- KEEP: Adversarial review logic
- KEEP: Auto-fix behavior

#### sprint-commit
- NEW: Git status analysis
- NEW: Story ID file matching logic
- NEW: Selective staging
- NEW: Commit message formatting

---

## Verification Checklist

### Infrastructure
- [ ] `commands/` folder created in sprint-runner
- [ ] `--prompt-system-append` integrated in orchestrator
- [ ] File scanning routine implemented
- [ ] Deduplication logic working
- [ ] XML generation correct (with rule attribute)
- [ ] `sprint-project-context.md` copy mechanism working

### Custom Commands
- [ ] `sprint-create-story/` - workflow.yaml, instructions.xml, template.md, checklist.md
- [ ] `sprint-create-story-discovery/` - workflow.yaml, instructions.xml
- [ ] `sprint-story-review/` - workflow.yaml, instructions.xml
- [ ] `sprint-create-tech-spec/` - workflow.yaml, instructions.xml, template.md, checklist.md
- [ ] `sprint-tech-spec-review/` - workflow.yaml, instructions.xml
- [ ] `sprint-dev-story/` - workflow.yaml, instructions.xml
- [ ] `sprint-code-review/` - workflow.yaml, instructions.xml
- [ ] `sprint-commit/` - workflow.yaml, instructions.xml

### Orchestrator Updates
- [ ] `build_prompt_system_append()` method added
- [ ] `spawn_subagent()` updated with prompt_system_append param
- [ ] `cleanup_batch_files()` method added
- [ ] `copy_project_context()` method added
- [ ] All phase methods updated to use new commands
- [ ] Batch-commit replaced with sprint-commit

### Cleanup
- [ ] Old `prompts/` folder deleted
- [ ] README.md updated
- [ ] task-taxonomy.yaml updated

### Testing
- [ ] File injection XML format correct
- [ ] Deduplication prevents double injection
- [ ] Cleanup moves correct files
- [ ] sprint-commit only commits related files
- [ ] End-to-end workflow completes successfully

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing BMAD commands | We duplicate, never modify originals |
| Missing context in injection | Scan broadly by story ID, dedupe after |
| Prompt system too large | Monitor token usage, optimize if needed |
| Git commit wrong files | Conservative matching, allow investigation |

---

## Success Criteria

1. **Faster execution** - Subagents start working immediately without setup
2. **Consistent context** - All agents receive identical, pre-verified context
3. **Isolated changes** - Original BMAD system untouched
4. **Maintainable** - Clear separation between sprint-runner and BMAD

---

## Critical Architecture Decision: Dynamic Injection

**Every prompt system injection is generated dynamically at the moment of spawning each agent.**

This means:
- Every `spawn_subagent()` call reads files fresh at that exact moment
- Agent receives the most current version of ALL injected files
- If project-context was refreshed in background between spawns → next agent gets the updated version
- No stale data - always fresh reads at spawn time
- No caching of file contents between agent spawns

This ensures maximum context accuracy and eliminates staleness risks.

---

## Logging Architecture

Subagents call SH script directly with JSON argument for logging. No orchestrator parsing required.

```bash
# Subagent calls directly:
_bmad/scripts/sprint-log.sh '{"epic_id":"2a","story_id":"2a-1","command":"create-story","task_id":"setup","status":"start","message":"Initializing story creation"}'
```

The orchestrator does NOT parse stdout for logging - subagents handle their own logging via the script.

---

## File Locations Reference

| Item | Path |
|------|------|
| Sprint-runner root | `_bmad/bmm/workflows/4-implementation/sprint-runner/` |
| Custom commands | `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/` |
| Orchestrator | `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` |
| Implementation artifacts | `_bmad-output/implementation-artifacts/` |
| Planning artifacts | `_bmad-output/planning-artifacts/` |
| Archived artifacts | `_bmad-output/archived-artifacts/` |
| Project context copy | `_bmad-output/planning-artifacts/sprint-project-context.md` |

---

## Original BMAD Commands to Duplicate

| BMAD Command | Location |
|--------------|----------|
| create-story | `_bmad/bmm/workflows/4-implementation/create-story/` |
| dev-story | `_bmad/bmm/workflows/4-implementation/dev-story/` |
| code-review | `_bmad/bmm/workflows/4-implementation/code-review/` |
| create-tech-spec | `_bmad/bmm/workflows/4-implementation/create-tech-spec/` |

Note: Some commands (story-discovery, story-review, tech-spec-review, sprint-commit) are new variants created for sprint-runner.
