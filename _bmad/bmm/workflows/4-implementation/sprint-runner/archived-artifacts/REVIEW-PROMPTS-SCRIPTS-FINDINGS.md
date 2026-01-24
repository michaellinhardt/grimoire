# Review: Prompts & Scripts

## Summary

A comprehensive review of the Sprint Runner system's prompts (instructions.xml files) and scripts (orchestrator.py, sprint-log.sh) was conducted. The system is generally well-designed with clear separation of concerns, consistent logging patterns, and proper context injection mechanisms. However, several errors and inconsistencies were identified that could cause runtime failures or incorrect behavior.

**Key Findings:**
- 4 Errors (runtime-impacting issues)
- 6 Warnings (non-critical issues that should be addressed)
- Multiple positive observations about the system design

---

## Errors Found

### Error 1: Variable Placeholder Mismatch in sprint-dev-story

- **Location**: `commands/sprint-dev-story/instructions.xml:36, 68, 76, etc.`
- **Issue**: The instructions use `{{log_script}}` as a placeholder for the logging script path, but the workflow.yaml defines it as `log_script` (not in double braces). The instructions reference it as if it's a template variable, but the orchestrator does not perform variable substitution on these XML files before passing them to subagents.
- **Why it's an error**: When the subagent tries to execute the bash command, it will literally execute `{{log_script}} '{"epic_id":...}` which will fail because `{{log_script}}` is not a valid executable path. This will cause all logging in sprint-dev-story to fail.
- **Suggested fix**: Replace all instances of `{{log_script}}` with the actual path `_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh` as done in the other instructions.xml files (sprint-create-story, sprint-create-story-discovery, sprint-create-tech-spec).

**Affected files with the same issue:**
- `commands/sprint-story-review/instructions.xml` - uses `{{log_script}}`
- `commands/sprint-tech-spec-review/instructions.xml` - uses `{{log_script}}`
- `commands/sprint-code-review/instructions.xml` - uses `{{log_script}}`
- `commands/sprint-commit/instructions.xml` - uses `{{log_script}}`

---

### Error 2: Inconsistent Command Names in Logging

- **Location**: `commands/sprint-create-story-discovery/instructions.xml:35, 46, 60, 67, etc.`
- **Issue**: The instructions use command name `sprint-create-story-discovery` in log calls, but the task-taxonomy.yaml defines the command as `story-discovery` (without `sprint-create-` prefix).
- **Why it's an error**: The orchestrator's `_parse_csv_log_line()` method parses the command field from CSV logs. While this doesn't cause a direct runtime failure, it creates inconsistency in log parsing and makes it harder to correlate logs with the task taxonomy. The `command_mappings` section in task-taxonomy.yaml uses `sprint-create-story-discovery` but the `commands` section uses `story-discovery`.
- **Suggested fix**: Standardize command names. Either:
  1. Update task-taxonomy.yaml to use `sprint-create-story-discovery` consistently in the `commands` section, OR
  2. Update instructions.xml to use the shorter `story-discovery` name in logs

---

### Error 3: Missing Tech-Spec Filename Pattern in Orchestrator

- **Location**: `orchestrator.py:1077-1084` and `commands/sprint-create-tech-spec/instructions.xml:128`
- **Issue**: The tech-spec instructions generate files with pattern `sprint-tech-spec-{{story_key}}.md`, but the orchestrator's `build_prompt_system_append()` method searches for files containing `tech-spec` in the filename (case-insensitive). However, the tech-spec file is written to `_bmad-output/implementation-artifacts/sprint-tech-spec-{{story_key}}.md` while the orchestrator scans `impl_artifacts` which is the same directory. This appears correct BUT the matching logic at line 1082 uses `"tech-spec" in filename_lower` which would NOT match `sprint-tech-spec-2a-1.md` because the hyphen positions differ.
- **Why it's an error**: Actually on closer inspection, `"tech-spec" in "sprint-tech-spec-2a-1.md"` would return True. This is NOT an error - my initial analysis was incorrect. **Removing this error.**

**(Error 3 Withdrawn - false positive after detailed analysis)**

---

### Error 3 (Revised): Story File Naming Mismatch

- **Location**: `orchestrator.py:1062-1084` (file scanning) vs `commands/sprint-create-story/instructions.xml:109-110, 150`
- **Issue**: The sprint-create-story instructions generate files with the pattern `sprint-{{story_key}}.md` (e.g., `sprint-2a-1.md`). However, the orchestrator's `build_prompt_system_append()` scans for files in `implementation-artifacts` and matches based on whether the `story_key_lower` is in `filename_lower`. For a story key like `2a-1`, the file `sprint-2a-1.md` would match correctly. **This is actually fine.**

**(Error 3 Withdrawn - after verification, the matching logic works correctly)**

---

### Error 3 (Final): Discovery File Naming Pattern Inconsistency

- **Location**: `commands/sprint-create-story-discovery/instructions.xml:151` vs `orchestrator.py:1317`
- **Issue**: The discovery instructions create files named `sprint-{{story_key}}-discovery-story.md` (e.g., `sprint-2a-1-discovery-story.md`). The orchestrator at line 1317 looks for files with pattern `sprint-{story_key}-discovery-story.md`. However, the orchestrator's context injection script call (line 1317-1321) uses `f"sprint-{story_key}-discovery-story.md"` which is CORRECT. But the discovery instructions at line 151 say `sprint-{{story_key}}-discovery-story.md`. The double braces `{{story_key}}` in XML suggest template substitution that doesn't happen in this context.
- **Why it's an error**: The XML uses `{{story_key}}` which is meant to be a placeholder that the subagent fills in at runtime. This is actually the INTENDED behavior - the subagent should replace `{{story_key}}` with the actual value. So this is NOT an error.

**(Error 3 Withdrawn - template syntax is intentional for subagent variable substitution)**

---

### Error 3 (Actual): Orchestrator Hardcodes Wrong Sprint Log Script Path

- **Location**: `orchestrator.py` - No direct reference to sprint-log.sh
- **Issue**: The orchestrator does NOT invoke sprint-log.sh directly. It relies on subagents to call it. The subagents have the path hardcoded in their instructions.xml files. The instructions.xml files that use the full path (`_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh`) are correct. The ones using `{{log_script}}` (as noted in Error 1) will fail.
- **Why it's an error**: See Error 1 - this is a duplicate observation.

**(Error 3 consolidated with Error 1)**

---

### Error 3: Orchestrator Spawns Subagents Without Command Flag

- **Location**: `orchestrator.py:762-781` (spawn_subagent method) vs `instructions.md:26-27`
- **Issue**: The instructions.md states: "Invoke via Claude CLI: `claude --command sprint-{command-name} --prompt-system-append '...'`". However, the orchestrator's `spawn_subagent()` method at line 762 builds args as `["claude", "-p", "--output-format", "stream-json"]`. It does NOT use `--command` flag to load the command's workflow.yaml and instructions.xml.
- **Why it's an error**: Without the `--command` flag, the Claude CLI will not load the command-specific configuration (workflow.yaml, instructions.xml). The subagent will receive only the raw prompt text without the workflow structure. This means all the carefully crafted instructions.xml files are NEVER loaded by subagents during orchestrator-spawned execution.
- **Suggested fix**: Update `spawn_subagent()` to include the `--command` flag when spawning commands:
  ```python
  args = ["claude", "--command", command_name, "-p", "--output-format", "stream-json"]
  ```
  Or, inject the instructions.xml content into the prompt directly via the `--prompt-system-append` flag (which the orchestrator already supports but uses differently).

---

### Error 4: Missing story_file Variable in sprint-dev-story Instructions

- **Location**: `commands/sprint-dev-story/instructions.xml:174`
- **Issue**: The instructions reference `{{story_file}}` at line 174: "Save the story file to disk at {{story_file}}". While workflow.yaml defines `story_file: '{story_dir}/sprint-{{story_key}}.md'`, this variable resolution depends on the workflow engine loading workflow.yaml, which per Error 3 may not happen.
- **Why it's an error**: If the workflow.yaml is not loaded (per Error 3), the `{{story_file}}` variable will not be resolved, and the subagent won't know where to save the updated story file.
- **Suggested fix**: Either fix Error 3 to ensure workflow.yaml is loaded, or explicitly document the file path in the instructions.xml itself.

---

## Warnings (Non-Critical Issues)

### Warning 1: Inconsistent Use of story_keys vs story_key

- **Location**: Multiple instructions.xml files and orchestrator.py
- **Issue**: Some commands use `story_keys` (plural) for batch processing while others use `story_key` (singular). The orchestrator builds prompts with inconsistent variable names:
  - `_execute_create_story_phase()` line 1278: Uses `story_keys_str`
  - `_execute_dev_phase()` line 1452: Uses `story_key` (singular)
- **Impact**: This creates confusion and requires subagents to handle both patterns.
- **Recommendation**: Standardize on `story_keys` for batch-capable commands and document clearly when a command processes one vs multiple stories.

---

### Warning 2: sprint-commit Uses Pre-captured Git Status But May Become Stale

- **Location**: `orchestrator.py:1156-1179` and `commands/sprint-commit/instructions.xml:54`
- **Issue**: The orchestrator captures git status before spawning sprint-commit subagent and injects it via `git_status_xml`. The instructions tell the agent: "Do NOT run git status yourself - use the pre-captured output." However, if the subagent takes a long time to process, the git status could become stale if other processes modify files.
- **Impact**: Low - in the sprint-runner context, no other processes should be modifying files during commit phase.
- **Recommendation**: Add a note in the instructions about this assumption.

---

### Warning 3: CSV Parsing May Fail on Messages with Embedded Commas

- **Location**: `orchestrator.py:873-895` and `sprint-log.sh:78-87`
- **Issue**: The sprint-log.sh script properly wraps the message in quotes and escapes internal quotes. However, the Python CSV parser in `_parse_csv_log_line()` uses `csv.reader` which should handle this correctly. The row length check `if len(row) >= 7` is appropriate for the 7-field format.
- **Impact**: Low - the CSV escaping appears correct.
- **Recommendation**: None needed, but consider adding a test case for messages with commas and quotes.

---

### Warning 4: Background Task Tracking Not Used Consistently

- **Location**: `orchestrator.py:821-826` and various `spawn_subagent()` calls
- **Issue**: The `is_background=True` parameter creates entries in the `background_tasks` table, but the orchestrator spawns background tasks in multiple ways:
  1. Via `asyncio.create_task()` directly (line 572 for context refresh)
  2. Via `spawn_subagent(..., is_background=True)` (line 821)
  3. Via `asyncio.create_task(self.spawn_subagent(...))` in review chains (lines 1358, 1430)
- **Impact**: Inconsistent tracking of background tasks in the database.
- **Recommendation**: Standardize background task creation to ensure all are tracked in `background_tasks` table.

---

### Warning 5: Haiku Model Override Threshold Configuration

- **Location**: `orchestrator.py:1470` and `instructions.md:444-446`
- **Issue**: The code uses `settings.haiku_after_review` (default appears to be 2 based on code logic), but the instructions.md states "Review 2+: Haiku model". The code at line 1470 says `if review_attempt >= settings.haiku_after_review` which would use Haiku starting at attempt 2 if the setting is 2. This is consistent, but the configuration value isn't visible in the reviewed files.
- **Impact**: Low - behavior appears correct.
- **Recommendation**: Document the default value in settings or instructions.md.

---

### Warning 6: Missing Validation for Required Variables

- **Location**: All workflow.yaml files
- **Issue**: Variables are defined with descriptions but no validation that they're provided. For example, `sprint-create-tech-spec/workflow.yaml` line 19-26 marks `story_keys` as `required: true` but there's no mechanism in the orchestrator or Claude CLI to enforce this.
- **Impact**: If orchestrator fails to provide required variables, subagents will receive empty values without explicit error.
- **Recommendation**: Add explicit checks in instructions.xml step 1 to halt if required variables are missing (sprint-create-story already does this at lines 34-38).

---

## Positive Observations

### 1. Well-Structured Task Taxonomy
The `task-taxonomy.yaml` provides clear, consistent definitions for all task phases. The `command_mappings` section at the bottom serves as a useful quick reference.

### 2. Consistent Logging Format
The CSV log format is well-documented in `instructions.md` lines 44-87, with clear examples. The sprint-log.sh script includes proper input validation and CSV escaping.

### 3. Comprehensive Autonomous Mode Instructions
All instructions.xml files include clear `<autonomous_mode>` sections that establish the subagent's authority to make decisions without human input.

### 4. Context Injection Architecture
The `build_prompt_system_append()` method in orchestrator.py (lines 998-1154) is well-designed with:
- Deduplication via sets
- Deterministic ordering
- Size monitoring with warning/error thresholds
- Graceful handling of unreadable files

### 5. Proper Error Handling in sprint-log.sh
The script validates JSON input, checks for required fields, and provides clear error messages. The jq-based parsing is robust.

### 6. Clear Output Markers
Each command defines specific output markers (e.g., `[TECH-SPEC-DECISION: REQUIRED]`, `[CRITICAL-ISSUES-FOUND: YES]`, `HIGHEST SEVERITY: ZERO ISSUES`) that the orchestrator can parse deterministically.

### 7. Graceful Degradation
The orchestrator handles missing files gracefully (e.g., continuing without project context if not found, silently skipping unreadable files in injection).

### 8. Well-Documented Workflow Steps
The `instructions.md` file provides detailed step-by-step workflow documentation with clear state transitions and decision points.

---

## Summary of Required Fixes

| Priority | Issue | Files Affected |
|----------|-------|----------------|
| CRITICAL | Error 1: `{{log_script}}` placeholder not resolved | sprint-dev-story, sprint-story-review, sprint-tech-spec-review, sprint-code-review, sprint-commit |
| CRITICAL | Error 3: Missing `--command` flag in spawn_subagent | orchestrator.py |
| HIGH | Error 2: Inconsistent command names in taxonomy | task-taxonomy.yaml |
| HIGH | Error 4: Unresolved `{{story_file}}` if workflow.yaml not loaded | sprint-dev-story |
| MEDIUM | Warning 1: Inconsistent story_keys vs story_key | Multiple files |
| LOW | Warning 6: Missing required variable validation | All workflow.yaml files |

---

**Review Completed:** 2026-01-24
**Reviewer:** Technical Lead (Claude Opus 4.5)
