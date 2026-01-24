# Tech Spec: Story A-4 - Cleanup Batch Files Method

**Story:** A-4 - Cleanup Batch Files Method
**Epic:** A - Orchestrator Infrastructure
**Date:** 2026-01-24

---

## Overview

Implement the `cleanup_batch_files()` method in the orchestrator to move completed story artifacts from `implementation-artifacts/` to `archived-artifacts/`. This keeps the working directory clean and organized after batch completion.

---

## Requirements Summary

From Story A-4 Acceptance Criteria:

1. Accept `story_keys: list[str]` parameter
2. Scan `_bmad-output/implementation-artifacts/` for files with story IDs in filename
3. Move matched files to `_bmad-output/archived-artifacts/`
4. Create archive directory if it doesn't exist
5. Handle errors gracefully (log and continue)
6. Return count of files moved

**Key Constraints:**
- Files are matched by pattern `*{story_key}*` in filename
- If a file with same name exists in archive, it is overwritten
- sprint-project-context.md is NOT moved (stays in planning-artifacts)
- Only implementation-artifacts files are affected

---

## Technical Design

### Method Signature

```python
def cleanup_batch_files(self, story_keys: list[str]) -> int:
    """
    Move completed story artifacts to archived-artifacts folder.

    Args:
        story_keys: List of story keys to match files for (e.g., ["2a-1", "2a-2"])

    Returns:
        Count of files successfully moved.
    """
```

### Implementation Approach

1. **Path Setup:**
   - `impl_artifacts = self.project_root / "_bmad-output/implementation-artifacts"`
   - `archive_dir = self.project_root / "_bmad-output/archived-artifacts"`

2. **Directory Creation:**
   - Use `archive_dir.mkdir(parents=True, exist_ok=True)` to ensure archive directory exists

3. **File Discovery:**
   - For each story_key, use `impl_artifacts.glob(f"*{story_key}*")` to find matching files
   - Only process regular files (`file.is_file()`)

4. **File Movement:**
   - Use `shutil.move()` for atomic moves that handle cross-filesystem moves
   - Destination: `archive_dir / file.name`
   - `shutil.move` automatically overwrites existing files

5. **Error Handling:**
   - Catch OSError, PermissionError for each file operation
   - Log errors via `emit_event()` but continue processing
   - Count only successful moves

6. **Logging:**
   - Emit `cleanup:file_moved` for each successful move
   - Emit `cleanup:file_error` for each failed move
   - Emit `cleanup:complete` at the end with total count

### Edge Cases

1. **Empty story_keys list:** Return 0, no files processed
2. **No matching files:** Return 0, emit cleanup:complete
3. **Implementation-artifacts directory doesn't exist:** Handle gracefully, return 0
4. **Duplicate matches:** Same file may match multiple story keys - use set to deduplicate
5. **Case sensitivity:** Use case-insensitive matching for robustness

---

## Implementation

```python
def cleanup_batch_files(self, story_keys: list[str]) -> int:
    """
    Move completed story artifacts to archived-artifacts folder.

    Scans implementation-artifacts/ for files matching any of the provided
    story keys and moves them to archived-artifacts/. Creates the archive
    directory if it doesn't exist.

    Args:
        story_keys: List of story keys to match files for (e.g., ["2a-1", "2a-2"])

    Returns:
        Count of files successfully moved.
    """
    import shutil

    impl_artifacts = self.project_root / "_bmad-output/implementation-artifacts"
    archive_dir = self.project_root / "_bmad-output/archived-artifacts"

    # Early return if no story keys or source dir doesn't exist
    if not story_keys:
        return 0

    if not impl_artifacts.exists():
        return 0

    # Create archive directory
    try:
        archive_dir.mkdir(parents=True, exist_ok=True)
    except (OSError, PermissionError) as e:
        self.emit_event(
            "cleanup:error",
            {
                "error": f"Failed to create archive directory: {e}",
                "message": "Cannot proceed with cleanup",
            },
        )
        return 0

    # Collect files to move (using set to deduplicate)
    files_to_move: set[Path] = set()
    for story_key in story_keys:
        story_key_lower = story_key.lower()
        for file_path in impl_artifacts.iterdir():
            if file_path.is_file() and story_key_lower in file_path.name.lower():
                files_to_move.add(file_path)

    # Move files
    files_moved = 0
    for file_path in sorted(files_to_move, key=lambda p: p.name.lower()):
        dest = archive_dir / file_path.name
        try:
            shutil.move(str(file_path), str(dest))
            files_moved += 1
            self.emit_event(
                "cleanup:file_moved",
                {
                    "source": str(file_path),
                    "destination": str(dest),
                    "file_name": file_path.name,
                },
            )
        except (OSError, PermissionError, shutil.Error) as e:
            self.emit_event(
                "cleanup:file_error",
                {
                    "file": str(file_path),
                    "error": str(e),
                    "message": f"Failed to move {file_path.name}",
                },
            )
            # Continue processing other files

    self.emit_event(
        "cleanup:complete",
        {
            "files_moved": files_moved,
            "story_keys": story_keys,
            "message": f"Cleanup complete: {files_moved} files archived",
        },
    )

    return files_moved
```

---

## Test Cases

### Unit Tests

1. **test_cleanup_batch_files_moves_matching_files** - Verify files with story keys are moved
2. **test_cleanup_batch_files_creates_archive_directory** - Verify directory creation
3. **test_cleanup_batch_files_returns_count** - Verify correct count returned
4. **test_cleanup_batch_files_handles_empty_story_keys** - Empty list returns 0
5. **test_cleanup_batch_files_handles_no_matching_files** - No matches returns 0
6. **test_cleanup_batch_files_handles_missing_source_dir** - Missing dir returns 0
7. **test_cleanup_batch_files_handles_move_error** - Error handling continues
8. **test_cleanup_batch_files_deduplicates_matches** - Same file not moved twice
9. **test_cleanup_batch_files_case_insensitive** - Case-insensitive matching
10. **test_cleanup_batch_files_overwrites_existing** - Existing files overwritten
11. **test_cleanup_batch_files_emits_events** - Verify event emission

---

## File List

- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (modify)
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/test_orchestrator.py` (modify)

---

## Validation Checklist

- [ ] Method signature matches spec: `cleanup_batch_files(self, story_keys: list[str]) -> int`
- [ ] Creates archive directory if missing
- [ ] Matches files by story key pattern (case-insensitive)
- [ ] Uses shutil.move for atomic moves
- [ ] Handles errors gracefully (logs and continues)
- [ ] Returns correct count of moved files
- [ ] Deduplicates files matched by multiple story keys
- [ ] Emits appropriate events for monitoring
- [ ] All tests pass
