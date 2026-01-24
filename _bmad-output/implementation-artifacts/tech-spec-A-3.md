---
title: 'Copy Project Context Method'
slug: 'copy-project-context'
created: '2026-01-24'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Python 3.11+', 'pathlib', 'shutil']
files_to_modify:
  - '_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py'
code_patterns: ['Path operations', 'Error handling with return values', 'Logging via emit_event']
test_patterns: ['Unit test with mocked filesystem']
---

# Tech-Spec: Copy Project Context Method

**Created:** 2026-01-24
**Story:** A-3

## Overview

### Problem Statement

The sprint-runner orchestrator needs to ensure all agents in a sprint batch receive identical, frozen project context. Currently, each agent might read the project-context.md at different times, potentially getting different versions if the file is updated during a batch. This creates inconsistency and makes debugging difficult.

### Solution

Implement a `copy_project_context()` method that copies `project-context.md` to `sprint-project-context.md` once at batch start. All subsequent agent spawns will use the sprint copy, ensuring:
1. Identical context for all agents in a batch
2. Isolation from any background context refreshes during the batch
3. Clear audit trail of which context version was used

### Scope

**In Scope:**
- Implement `copy_project_context()` method in orchestrator.py
- Create destination directory if it doesn't exist
- Handle missing source file gracefully with logging
- Return boolean indicating success/failure
- Integrate call into batch initialization (before first agent spawn)

**Out of Scope:**
- Modifying the project-context.md generation workflow
- Adding timestamps or metadata to the sprint copy
- Versioning or backup of previous sprint context copies
- Cleanup of sprint-project-context.md (handled by separate cleanup story)

## Context for Development

### Codebase Patterns

1. **Path Operations**: The orchestrator uses `pathlib.Path` for all file operations. `self.project_root` is the base path.

2. **Error Handling**: Methods return boolean success indicators and log errors via `self.emit_event()`. Example from existing code:
   ```python
   def check_project_context_status(self) -> str:
       context_path = self.project_root / "_bmad-output/planning-artifacts/project-context.md"
       if not context_path.exists():
           return "missing"
   ```

3. **Event Emission**: Use `self.emit_event(event_type, payload_dict)` for WebSocket notifications and logging.

4. **Method Organization**: Related methods are grouped together. File operation methods should be near existing file-related methods like `build_prompt_system_append()`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` | Main implementation file - contains existing stub at lines 220-229 |
| `_bmad-output/planning-artifacts/project-context.md` | Source file to copy |
| `_bmad-output/planning-artifacts/sprint-project-context.md` | Destination file |

### Technical Decisions

1. **Return Type**: Return `bool` instead of raising exceptions. This allows the orchestrator to decide whether to continue or abort based on context availability.

2. **Directory Creation**: Use `parent.mkdir(parents=True, exist_ok=True)` to ensure the destination directory exists.

3. **Overwrite Behavior**: Always overwrite existing `sprint-project-context.md` - each batch should start with a fresh copy.

4. **Logging Strategy**: Emit events for both success and failure cases to aid debugging.

5. **Integration Point**: Call at the start of batch initialization in `start()` method, after database initialization but before the main loop.

## Implementation Plan

### Tasks

#### Task 1: Update `copy_project_context()` method signature and implementation

**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

**Current Code (lines 220-229):**
```python
def copy_project_context(self) -> None:
    """Copy project-context.md to sprint-project-context.md for injection."""

    source = self.project_root / "_bmad-output/planning-artifacts/project-context.md"
    dest = self.project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"

    if source.exists():
        dest.write_text(source.read_text())
```

**New Implementation:**
```python
def copy_project_context(self) -> bool:
    """
    Copy project-context.md to sprint-project-context.md for injection.

    Called once at batch start to ensure all agents in a sprint batch
    receive identical, frozen context.

    Returns:
        True if copy succeeded, False if source file is missing.
    """
    source = self.project_root / "_bmad-output/planning-artifacts/project-context.md"
    dest = self.project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"

    if not source.exists():
        self.emit_event(
            "context:copy_failed",
            {
                "source": str(source),
                "reason": "Source file does not exist",
                "message": "project-context.md not found - agents will not have project context",
            },
        )
        return False

    # Ensure destination directory exists
    dest.parent.mkdir(parents=True, exist_ok=True)

    # Copy content (overwrites existing file)
    dest.write_text(source.read_text())

    self.emit_event(
        "context:copied",
        {
            "source": str(source),
            "destination": str(dest),
            "message": "Project context copied for sprint batch",
        },
    )
    return True
```

#### Task 2: Integrate into batch initialization

**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

**Location:** In `start()` method, after database initialization and project context check, before main loop.

**Current Code (around line 195-199):**
```python
# Step 0: Project context check
await self.check_project_context()

self.state = OrchestratorState.RUNNING_CYCLE

# Main loop
while not self.stop_requested:
```

**New Implementation:**
```python
# Step 0: Project context check
await self.check_project_context()

# Copy project context for this batch
context_copied = self.copy_project_context()
if not context_copied:
    self.emit_event(
        "batch:warning",
        {
            "batch_id": self.current_batch_id,
            "warning": "Project context not available - proceeding without context",
        },
    )
    # Continue anyway - agents can function without project context

self.state = OrchestratorState.RUNNING_CYCLE

# Main loop
while not self.stop_requested:
```

### Acceptance Criteria

#### AC1: Copy when source exists
**Given** project-context.md exists at `_bmad-output/planning-artifacts/project-context.md`
**When** `copy_project_context()` is called
**Then** content is copied to `_bmad-output/planning-artifacts/sprint-project-context.md`
**And** the copy preserves exact content (no modifications)
**And** any existing sprint-project-context.md is overwritten
**And** the method returns `True`
**And** a `context:copied` event is emitted

#### AC2: Handle missing source gracefully
**Given** project-context.md does not exist
**When** `copy_project_context()` is called
**Then** an error is logged via `context:copy_failed` event
**And** the method returns `False`
**And** the orchestrator can decide whether to continue or abort

#### AC3: Create destination directory if needed
**Given** the destination directory `_bmad-output/planning-artifacts/` does not exist
**When** `copy_project_context()` is called with an existing source file
**Then** the destination directory is created
**And** the file is copied successfully

#### AC4: Called at batch start
**Given** a sprint batch is starting
**When** the batch initialization runs
**Then** `copy_project_context()` is called once at the start
**And** this happens after project context check but before the main loop
**And** all subsequent spawns use the sprint-project-context.md copy

## Additional Context

### Dependencies

- **Story A-1 (build_prompt_system_append)**: Uses `sprint-project-context.md` as the source for context injection. This story provides the file that A-1 consumes.
- **Story A-6 (update phase methods)**: Will call `build_prompt_system_append()` which expects `sprint-project-context.md` to exist.

### Testing Strategy

**Unit Test Approach:**
1. Create temp directory with mock project structure
2. Test case: source exists -> verify copy created, True returned
3. Test case: source missing -> verify False returned, event emitted
4. Test case: destination dir missing -> verify dir created
5. Test case: existing destination -> verify overwritten

**Integration Test:**
- Run batch with project-context.md present
- Verify sprint-project-context.md is created before first agent spawn
- Verify all agents receive same content via injection

### Notes

1. **Timing**: The method is synchronous since file copy is fast. No async needed.

2. **Error Resilience**: The orchestrator continues even if context copy fails. Agents can function without project context (reduced quality but not blocked).

3. **No Cleanup**: This story does not handle cleanup of sprint-project-context.md. That is handled by Story A-4 (cleanup_batch_files) or can persist across batches.

4. **Existing Implementation**: There is already a basic implementation at lines 220-229 in orchestrator.py. This spec enhances it with:
   - Return value for error handling
   - Directory creation
   - Event emission for logging
   - Integration into batch startup
