---
title: 'Build Prompt System Append Method'
slug: 'build-prompt-system-append-a1'
story_key: 'A-1'
created: '2026-01-24'
status: 'done'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Python 3.x', 'pathlib', 'asyncio']
files_to_modify:
  - '_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py'
code_patterns:
  - 'pathlib.Path for all file operations'
  - 'Set-based deduplication with order preservation'
  - 'XML string building via list join'
  - 'Class-level constants for thresholds'
  - 'emit_event() for logging/WebSocket'
  - 'Type hints with Optional[] for optional params'
test_patterns:
  - 'Manual testing via method calls'
  - 'Integration testing with spawn_subagent'
---

# Tech-Spec: Build Prompt System Append Method

**Story:** A-1
**Created:** 2026-01-24

## Overview

### Problem Statement

Currently, sprint-runner subagents must discover and read project context, discovery files, and other artifacts themselves at startup. This causes:
- Wasted tokens on repetitive setup
- Inconsistent context loading
- Slower execution times
- Potential for agents to miss or misread context

### Solution

Create a `build_prompt_system_append()` method in the orchestrator that:
1. Scans `_bmad-output/implementation-artifacts/` for files matching story IDs
2. Reads project-context.md (or sprint-project-context.md)
3. Deduplicates files by path using a set
4. Generates XML injection format for Claude CLI's `--prompt-system-append` flag
5. Returns the complete string for injection

Every agent receives identical, verified context via `--prompt-system-append`. Despite being "pre-computed," every spawn reads files fresh at that exact moment for maximum accuracy.

### Scope

**In Scope:**
- Method accepts command_name, story_keys, and flags for what to include
- Scan `_bmad-output/implementation-artifacts/` for files matching story IDs
- Read sprint-project-context.md (copied at batch start by A-3)
- Deduplicate files by path using set
- Generate XML format with rule attribute ("DO NOT read these files")
- Size monitoring with warning threshold (100KB) and error threshold (150KB)
- Return complete string for `--prompt-system-append`

**Out of Scope:**
- Caching between agent spawns (explicitly NOT wanted - fresh reads each call)
- Sharding for injections exceeding 150KB (future enhancement)
- Calling this method from phase methods (Story A-6)
- Modifying spawn_subagent to accept the parameter (Story A-2)
- Copying project-context.md to sprint-project-context.md (Story A-3)
- `<workflow_instructions>` section (mentioned in context but not in A-1 ACs)

## Context for Development

### Codebase Patterns

This is a Python orchestrator within the BMAD workflow system. Key patterns from the existing orchestrator.py:

1. **Path handling**: Uses `pathlib.Path` throughout (e.g., `self.project_root / "path"`)
2. **File operations**: Direct `.read_text()` and `.exists()` on Path objects
3. **Method signatures**: Uses type hints with `Optional[]` for optional params
4. **Constants**: Class-level constants for thresholds at class level (e.g., `PROJECT_CONTEXT_MAX_AGE_SECONDS = 24 * 3600`)
5. **Logging**: Uses `self.emit_event(event_type, payload_dict)` for WebSocket events
6. **Section organization**: Uses `# ===` comment blocks to separate logical sections
7. **Docstrings**: Triple-quoted docstrings with description and Args/Returns when applicable
8. **Glob patterns**: Uses `Path.glob()` for file pattern matching

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` | Target file for implementation - lines 237-267 show similar pattern with constants and helper methods |
| `_bmad-output/implementation-artifacts/sprint-runner-v3-context.md` | Contains the detailed design context and example method signature (lines 119-176) |
| `_bmad-output/implementation-artifacts/sprint-runner-v3-research.md` | Research doc with risk analysis (Risk 9 confirms deduplication approach) |
| `_bmad-output/planning-artifacts/epics-sprint-runner-v3.md` | Story A-1 acceptance criteria (lines 81-133) |

### Technical Decisions

1. **Fresh reads, no caching**: Files are read fresh at each call. This ensures maximum context accuracy and eliminates staleness risks. Every `spawn_subagent()` call reads files fresh at that exact moment.

2. **Set-based deduplication with order preservation**: Use a Python `set` to track seen paths, but build the final list by appending only if not seen (preserves insertion order).

3. **File ordering**: Maintain consistent ordering:
   1. Project context (sprint-project-context.md)
   2. Story files (sprint-{story_key}.md or *{story_key}*.md)
   3. Discovery files (*{story_key}*discovery*)
   4. Tech-spec files (*tech-spec*{story_key}* or *{story_key}*tech-spec*)
   5. Additional explicit files

4. **XML format with rule attribute**: The XML includes a `rule` attribute with explicit "DO NOT read" instruction to prevent agents from re-reading injected files.

5. **Relative paths in XML**: Use relative paths from project root in the XML `path` attribute for portability. Convert absolute paths by removing `self.project_root` prefix.

6. **Size monitoring**: Warn at 100KB via `emit_event()`, raise `ValueError` at 150KB. This prevents injection from becoming too large.

7. **Case-insensitive matching**: Story keys should match case-insensitively in filenames (e.g., "A-1" matches "sprint-a-1-discovery.md").

8. **Silent skip on missing files**: If a file referenced by `additional_files` doesn't exist, skip it silently (don't raise error).

## Implementation Plan

### Tasks

**Task 1: Add Size Threshold Constants**

File: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

Add after line 242 (after `PROJECT_CONTEXT_MAX_AGE_SECONDS`):

```python
    # Prompt system append size limits
    INJECTION_WARNING_THRESHOLD_BYTES = 100 * 1024  # 100KB - warn if larger
    INJECTION_ERROR_THRESHOLD_BYTES = 150 * 1024    # 150KB - error if larger
```

---

**Task 2: Add New Section Comment Block**

File: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

Add new section after the "Sprint Status Updates" section (around line 760), before the "Main Orchestration Loop" section:

```python
    # =========================================================================
    # Prompt System Append (Story A-1)
    # =========================================================================
```

---

**Task 3: Implement build_prompt_system_append() Method**

File: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

Add within the new section:

```python
    def build_prompt_system_append(
        self,
        command_name: str,
        story_keys: list[str],
        include_project_context: bool = True,
        include_discovery: bool = False,
        include_tech_spec: bool = False,
        additional_files: Optional[list[str]] = None,
    ) -> str:
        """
        Build the --prompt-system-append content for a subagent.

        Scans for files matching story IDs, deduplicates, and generates
        XML injection format. Files are read fresh at each call (no caching).

        Args:
            command_name: Name of the command being executed (for logging)
            story_keys: List of story keys to match files for
            include_project_context: Include sprint-project-context.md
            include_discovery: Include discovery files for the stories
            include_tech_spec: Include tech-spec files for the stories
            additional_files: Explicit additional file paths to include

        Returns:
            Complete XML string ready for --prompt-system-append

        Raises:
            ValueError: If injection size exceeds 150KB
        """
        files_to_inject: list[tuple[str, str]] = []  # (relative_path, content)
        seen_paths: set[str] = set()

        def add_file(path: Path) -> None:
            """Add file to injection list if not already seen."""
            if not path.exists() or not path.is_file():
                return
            # Convert to relative path for XML
            try:
                rel_path = str(path.relative_to(self.project_root))
            except ValueError:
                rel_path = str(path)
            if rel_path not in seen_paths:
                seen_paths.add(rel_path)
                files_to_inject.append((rel_path, path.read_text()))

        # 1. Project context (if requested)
        if include_project_context:
            ctx_path = self.project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"
            add_file(ctx_path)

        # 2. Scan for story files and optionally discovery/tech-spec
        impl_artifacts = self.project_root / "_bmad-output/implementation-artifacts"
        if impl_artifacts.exists():
            for story_key in story_keys:
                # Match files containing story key (case-insensitive)
                story_key_lower = story_key.lower()
                for file_path in impl_artifacts.iterdir():
                    if not file_path.is_file():
                        continue
                    filename_lower = file_path.name.lower()
                    if story_key_lower not in filename_lower:
                        continue

                    # Categorize and add based on flags
                    is_discovery = "discovery" in filename_lower
                    is_tech_spec = "tech-spec" in filename_lower

                    if is_discovery and include_discovery:
                        add_file(file_path)
                    elif is_tech_spec and include_tech_spec:
                        add_file(file_path)
                    elif not is_discovery and not is_tech_spec:
                        # Story file or other matching file
                        add_file(file_path)

        # 3. Additional explicit files
        if additional_files:
            for file_path_str in additional_files:
                file_path = Path(file_path_str)
                if not file_path.is_absolute():
                    file_path = self.project_root / file_path_str
                add_file(file_path)

        # 4. Generate XML
        xml_parts: list[str] = [
            '<file_injections rule="DO NOT read these files - content already provided">'
        ]
        for rel_path, content in files_to_inject:
            xml_parts.append(f'  <file path="{rel_path}">')
            xml_parts.append(content)
            xml_parts.append('  </file>')
        xml_parts.append('</file_injections>')

        result = '\n'.join(xml_parts)

        # 5. Size monitoring
        size_bytes = len(result.encode('utf-8'))
        if size_bytes > self.INJECTION_ERROR_THRESHOLD_BYTES:
            raise ValueError(
                f"Injection size ({size_bytes} bytes) exceeds maximum "
                f"({self.INJECTION_ERROR_THRESHOLD_BYTES} bytes). "
                f"Consider reducing included files for command '{command_name}'."
            )
        if size_bytes > self.INJECTION_WARNING_THRESHOLD_BYTES:
            self.emit_event(
                "injection:warning",
                {
                    "command": command_name,
                    "size_bytes": size_bytes,
                    "threshold_bytes": self.INJECTION_WARNING_THRESHOLD_BYTES,
                    "message": f"Injection size ({size_bytes} bytes) exceeds warning threshold",
                },
            )

        return result
```

---

### Acceptance Criteria

**AC1: Method Signature**
- **Given** the orchestrator needs to spawn a subagent
- **When** `build_prompt_system_append()` is called with command_name and story_keys
- **Then** the method accepts the following parameters:
  - `command_name: str` - Name of the command being executed
  - `story_keys: list[str]` - List of story keys to match files for
  - `include_project_context: bool = True` - Include sprint-project-context.md
  - `include_discovery: bool = False` - Include discovery files
  - `include_tech_spec: bool = False` - Include tech-spec files
  - `additional_files: Optional[list[str]] = None` - Explicit additional files

**AC2: File Scanning**
- **Given** story_keys contains one or more story IDs (e.g., ["A-1", "A-2"])
- **When** scanning `_bmad-output/implementation-artifacts/`
- **Then** files are matched by filename pattern containing story_key (case-insensitive)
- **And** only files (not directories) are collected

**AC3: Deduplication**
- **Given** multiple story_keys or additional_files may reference the same file
- **When** building the injection list
- **Then** file paths are deduplicated using a set-based approach
- **And** the first occurrence's order is preserved

**AC4: Fresh Reads**
- **Given** the method is called to build injection content
- **When** reading file contents
- **Then** each file is read fresh at call time (no caching between spawns)
- **And** using Path.read_text() for each file

**AC5: XML Format**
- **Given** files are collected for injection
- **When** generating the XML format
- **Then** the output follows this exact structure:
```xml
<file_injections rule="DO NOT read these files - content already provided">
  <file path="_bmad-output/planning-artifacts/sprint-project-context.md">
    [content of project-context.md]
  </file>
  <file path="_bmad-output/implementation-artifacts/sprint-A-1-discovery-story.md">
    [content of discovery file]
  </file>
</file_injections>
```

**AC6: Optional Parameters**
- **Given** optional parameters are provided
- **When** building the injection
- **Then** `include_project_context=True` includes sprint-project-context.md
- **And** `include_discovery=True` includes discovery files for the story
- **And** `include_tech_spec=True` includes tech-spec files for the story
- **And** `additional_files` list allows explicit file inclusion by path

**AC7: Size Monitoring**
- **Given** injection size is computed
- **When** the total exceeds 100KB
- **Then** a warning is logged via emit_event with type "injection:warning"
- **And** if exceeds 150KB, a ValueError is raised with descriptive message

**AC8: Return Value**
- **Given** the injection is built successfully
- **When** the method returns
- **Then** it returns a complete string ready for `--prompt-system-append`
- **And** the string can be passed directly to spawn_subagent (once A-2 is implemented)

**AC9: File Order**
- **Given** multiple file types are included
- **When** building the injection
- **Then** files appear in this order:
  1. Project context (sprint-project-context.md)
  2. Story files (files with story_key but not discovery/tech-spec)
  3. Discovery files (when include_discovery=True)
  4. Tech-spec files (when include_tech_spec=True)
  5. Additional explicit files

**AC10: Missing Files Handling**
- **Given** include flags are set or additional_files are specified
- **When** a referenced file does not exist
- **Then** the missing file is silently skipped
- **And** no error is raised

## Additional Context

### Dependencies

- **Story A-3 (copy_project_context)**: This method reads `sprint-project-context.md` which is created by A-3. If A-3 is not implemented, the project context flag will simply not find the file and skip it.
- **Story A-2 (spawn_subagent update)**: The return value of this method will be passed to spawn_subagent once A-2 adds the `prompt_system_append` parameter.

### Testing Strategy

Since this is orchestrator code (Python, not the Electron/React application), testing should be done via:

1. **Manual testing**: Create test files in implementation-artifacts, call the method with various story_keys and flags, verify XML output structure
2. **Size threshold testing**: Create a large test file (>100KB), verify warning is emitted; create >150KB content, verify ValueError is raised
3. **Deduplication testing**: Pass overlapping story_keys and verify no duplicate file entries in output
4. **Case-insensitivity testing**: Verify "A-1" matches files named "sprint-a-1-story.md"
5. **Integration testing**: Once A-2 and A-6 are complete, test full injection flow with actual subagent spawn

### Notes

- The `_compute_workflow_instructions()` method referenced in the v3-context document is NOT part of A-1. A-1 focuses only on `<file_injections>` XML generation.
- Path in XML uses relative paths from project root for portability
- Content is NOT escaped - XML special characters in file content are acceptable since Claude CLI handles the injection appropriately
- The method does NOT modify any files - it only reads and returns a string
- The method is synchronous (not async) since file I/O is fast and no network calls are involved

---

## Code Review Record

### Review 1 of 2 (2026-01-24)
**Reviewer:** Claude Opus 4.5
**Issues Found:** 0 CRITICAL, 1 HIGH, 5 MEDIUM, 2 LOW

**Issues Fixed:**
1. HIGH: File read error handling - Added try/except for OSError, UnicodeDecodeError, PermissionError
2. MEDIUM: Duplicate file prevention - Changed from lists to sets for collection
3. MEDIUM: Deterministic file ordering - Added sorted() with case-insensitive key
4. MEDIUM: XML path attribute escaping - Added quote escaping with &quot;
5. MEDIUM: Empty injection logging - Added emit_event for injection:empty
6. MEDIUM: Docstring improvements - Updated return value documentation

### Review 2 of 2 - FINAL (2026-01-24)
**Reviewer:** Claude Opus 4.5
**Issues Found:** 0 CRITICAL, 0 HIGH, 0 MEDIUM, 3 LOW

**LOW Issues (Informational - No Action Required):**
1. File content not XML-escaped - Documented design decision per tech-spec
2. No path traversal validation - Input is internally controlled
3. Large file memory before size check - Mitigated by exception handling

**Final Status:** APPROVED
**All Acceptance Criteria:** VERIFIED (AC1-AC10)
**Story Status:** done
