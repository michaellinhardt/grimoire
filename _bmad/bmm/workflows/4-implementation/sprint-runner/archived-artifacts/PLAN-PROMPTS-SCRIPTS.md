# Implementation Plan: Prompts and Scripts Fixes

> **IMPORTANT**: This plan has been reconciled with PLAN-DASHBOARD-DATA.md.
> See **PLAN-UNIFIED-ORDER.md** for the correct execution sequence.
>
> **Key Integration Points**:
> - Fix 1.1 (logging format) must coordinate with DASHBOARD-DATA Fix 4.4 (create_event signature change)
> - Fix 3.1/3.3 (orchestrator.py changes) must be applied AFTER DASHBOARD-DATA Phase 1 schema changes
> - All orchestrator.py `create_event()` calls will need the new `event_type` parameter

## Overview

This plan addresses 21 issues found in the Sprint Runner prompts and scripts review:
- **4 Critical Issues**: Logging format mismatch, command name inconsistency, variable validation
- **5 High Priority Issues**: Template/variable issues, orphaned commands, file pattern mismatches
- **6 Medium Priority Issues**: Timeout handling, metric computation, dependency documentation
- **6 Low Priority Issues**: Code quality and maintainability improvements

**Most Urgent**: CRITICAL-3 and CRITICAL-4 (logging architecture mismatch) - without fixing these, the dashboard cannot track subagent progress.

---

## Phase 1: Critical Fixes

### Fix 1.1: Logging Format Mismatch (CRITICAL-3 + CRITICAL-4)

- **Issue**: `sprint-log.sh` outputs human-readable bracket format but `orchestrator.py` expects CSV format. Additionally, the script writes to a file instead of stdout, making logs invisible to the orchestrator.
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh`
- **Changes**:
  1. Modify `sprint-log.sh` to output CSV format to stdout (for orchestrator parsing)
  2. Optionally also write to file for human readability (dual output)
  3. Format must match orchestrator expectation: `timestamp,epicID,storyID,command,task-id,status,"message"`
- **Code**:
  ```bash
  # Current format (line 62):
  LOG_ENTRY="[$TIMESTAMP] [$EPIC_ID/$STORY_ID] [$COMMAND:$TASK_ID] [$STATUS] $MESSAGE"

  # Change to CSV format:
  # Generate Unix timestamp for CSV
  UNIX_TIMESTAMP=$(date +%s)

  # CSV format for orchestrator stdout parsing
  CSV_ENTRY="${UNIX_TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${TASK_ID},${STATUS},\"${MESSAGE}\""

  # Output CSV to stdout (orchestrator parses this)
  echo "$CSV_ENTRY"

  # Also write human-readable format to file for debugging
  HUMAN_ENTRY="[$TIMESTAMP] [$EPIC_ID/$STORY_ID] [$COMMAND:$TASK_ID] [$STATUS] $MESSAGE"
  echo "$HUMAN_ENTRY" >> "$LOG_FILE"
  ```
- **Test**:
  1. Run `sprint-log.sh` with test JSON and verify stdout is CSV format
  2. Verify orchestrator's `_parse_csv_log_line` can parse the output
  3. Verify file still gets human-readable entries

### Fix 1.2: Inconsistent Command Names (CRITICAL-1)

- **Issue**: Instructions use short names (`story-discovery`, `dev-story`, `story-review`) but taxonomy defines full names (`sprint-create-story-discovery`, `sprint-dev-story`, `sprint-story-review`)
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story-discovery/instructions.xml`
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-story-review/instructions.xml`
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-dev-story/instructions.xml`
- **Changes**: Update all `command` values in log calls to use `sprint-` prefixed names matching taxonomy
- **Code**:
  ```xml
  <!-- sprint-create-story-discovery/instructions.xml - Change from: -->
  "command":"story-discovery"
  <!-- To: -->
  "command":"sprint-create-story-discovery"

  <!-- sprint-story-review/instructions.xml - Change from: -->
  "command":"story-review"
  <!-- To: -->
  "command":"sprint-story-review"

  <!-- sprint-dev-story/instructions.xml - Change from: -->
  "command":"dev-story"
  <!-- To: -->
  "command":"sprint-dev-story"
  ```
- **Specific Changes (Verified by grep)**:
  - `sprint-create-story-discovery/instructions.xml`: Lines 35, 46, 60, 67, 140, 147, 260 - replace `"command":"story-discovery"` with `"command":"sprint-create-story-discovery"`
  - `sprint-story-review/instructions.xml`: Lines 28, 42, 47, 54, 95, 103, 117, 123, 124, 129, 150, 169 - replace `"command":"story-review"` with `"command":"sprint-story-review"`
  - `sprint-dev-story/instructions.xml`: Lines 36, 68, 76, 107, 112, 132, 137, 148, 153, 176, 182, 188, 224 - replace `"command":"dev-story"` with `"command":"sprint-dev-story"`
  - **NOTE**: Also verify `sprint-code-review/instructions.xml` uses `"command":"code-review-{{review_attempt}}"` which is correct but may need alignment with taxonomy
- **Test**:
  1. Verify all command names in log calls match taxonomy `command_mappings` keys
  2. Run grep across all instructions.xml to confirm consistency:
     ```bash
     grep -r '"command":' _bmad/bmm/workflows/4-implementation/sprint-runner/commands/ | grep -v sprint-
     ```

### Fix 1.3: Missing Variable Validation (CRITICAL-2)

- **Issue**: `sprint-create-story/instructions.xml` references `{{story_count}}` without computing it first
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story/instructions.xml`
- **Changes**: Add explicit action to compute `story_count` before using it in the log message
- **Code**:
  ```xml
  <!-- Add after line 31 (after parsing story_keys): -->
  <action>Set {{story_count}} = length of story_keys_array (count of comma-separated values)</action>

  <!-- Line 42 log message already uses {{story_count}}, now it will have a value -->
  ```
- **Test**: Verify the instructions clearly define how to compute `story_count` before logging

---

## Phase 2: High Priority Fixes

### Fix 2.1: Undefined Template Sections (HIGH-2)

- **Issue**: `sprint-create-story/instructions.xml` references template sections (`story_header`, `developer_context_section`, etc.) that don't exist as named sections in `template.md`
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story/instructions.xml` (lines 110-134)
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story/template.md`
- **Changes**: Option A (recommended) - Restructure template.md to have clearly named sections that can be referenced. Add XML-style markers for each section.
- **Code** (template.md restructure):
  ```markdown
  <!-- SECTION: story_header -->
  # Story {{epic_num}}.{{story_num}}: {{story_title}}

  Status: ready-for-dev
  <!-- END: story_header -->

  <!-- SECTION: story_requirements -->
  ## Story

  As a {{role}},
  I want {{action}},
  so that {{benefit}}.

  ## Acceptance Criteria

  1. [Add acceptance criteria from injected epics content]
  <!-- END: story_requirements -->

  <!-- SECTION: tasks_subtasks -->
  ## Tasks / Subtasks

  - [ ] Task 1 (AC: #)
    - [ ] Subtask 1.1
  <!-- END: tasks_subtasks -->

  <!-- SECTION: developer_context_section -->
  ## Dev Notes

  - Relevant architecture patterns and constraints
  - Source tree components to touch
  - Testing standards summary
  <!-- END: developer_context_section -->

  <!-- ... continue for all sections ... -->
  ```
- **Alternative** (Option B): Change instructions.xml to use the template as a whole document rather than section-by-section references. Replace `<template-output>` elements with direct content generation.
- **Test**: Verify the template-output elements can properly resolve named sections

### Fix 2.2: Variable Reference Syntax Inconsistency (HIGH-3)

- **Issue**: Mixed use of `{{variable}}` (instructions.xml) and `{variable}` (workflow.yaml)
- **File(s)**: All workflow.yaml and instructions.xml files in sprint-runner
- **Changes**: Document the convention clearly and add a comment at the top of each file
- **Code** (add to each file's header):
  ```yaml
  # Variable Syntax Convention:
  # - Single brace {variable}: Workflow system variables (resolved by workflow engine)
  # - Double brace {{variable}}: Runtime context variables (resolved by LLM agent)
  ```
  ```xml
  <!-- Variable Syntax Convention:
       - Single brace {variable}: Workflow system variables (resolved by workflow engine)
       - Double brace {{variable}}: Runtime context variables (resolved by LLM agent)
  -->
  ```
- **Test**: Review all files to ensure consistent application of the convention

### Fix 2.3: Orphaned tech-spec-discovery Command (HIGH-4)

- **Issue**: `task-taxonomy.yaml` defines `tech-spec-discovery` but no corresponding command folder exists
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml`
- **Changes**: Remove the orphaned `tech-spec-discovery` section from taxonomy (lines 155-172) since `sprint-create-tech-spec` has inline discovery
- **Code**:
  ```yaml
  # DELETE lines 155-172 (tech-spec-discovery section):
  # tech-spec-discovery:
  #   description: Discovery phase for tech-spec (when run separately)
  #   phases:
  #     - id: setup
  #     ...
  ```
- **Additional Issue Found**: The `command_mappings` section (lines 311-327) does NOT include `tech-spec-discovery`, confirming it was already semi-orphaned. However, ensure consistency:
  - The `commands:` section (lines 41-286) uses short names like `create-story`, `story-review`
  - The `command_mappings:` section (lines 311-327) uses full names like `sprint-create-story`, `sprint-story-review`
  - **Recommendation**: Either align both sections OR add clarifying comments that `commands:` defines phases for logging while `command_mappings:` defines canonical command names
- **Test**: Verify taxonomy only contains commands that have corresponding folders

### Fix 2.4: Discovery File Pattern Mismatch (HIGH-5)

- **Issue**: Potential mismatch in discovery file naming pattern between orchestrator and instructions
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (line 1266)
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-story-discovery/instructions.xml` (line 151)
- **Changes**: Verify all three locations use exactly `sprint-{story_key}-discovery-story.md`
- **Current State**:
  - orchestrator.py line 1266: `f"sprint-{story_key}-discovery-story.md"` (correct)
  - workflow.yaml line 21: `sprint-{story_key}-discovery-story.md` (correct)
  - instructions.xml line 151: `sprint-{{story_key}}-discovery-story.md` (correct - double braces for runtime)
- **Verification**: All patterns are consistent. Mark as VERIFIED - no changes needed.
- **Test**: Create a test discovery file and verify orchestrator can find it

### Fix 2.5: Error Handling for sprint-log.sh Failures (HIGH-1)

- **Issue**: No error handling when sprint-log.sh fails (missing jq, permissions, etc.)
- **File(s)**: All instructions.xml files with bash calls
- **Changes**: Add error handling wrapper or document requirements clearly
- **Code** (add to each bash block):
  ```xml
  <!-- Option A: Add || true to prevent failures from stopping workflow -->
  <bash><![CDATA[
  _bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh '{"..."}' || echo "Warning: Log failed, continuing..."
  ]]></bash>

  <!-- Option B: Add pre-flight check at workflow start (recommended) -->
  <step n="0" goal="Pre-flight validation">
    <bash><![CDATA[
  if ! command -v jq &> /dev/null; then
    echo "ERROR: jq is required but not installed. Install with: brew install jq"
    exit 1
  fi
    ]]></bash>
  </step>
  ```
- **Test**: Test workflow execution with jq unavailable

---

## Phase 3: Medium Priority Fixes

### Fix 3.1: Add Timeout Handling for Subagents (MEDIUM-1)

- **Issue**: No timeout mechanism for runaway subagent processes
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (lines 719-808)
- **Changes**: Add `asyncio.wait_for` with configurable timeout
- **Code**:
  ```python
  # Add constant at class level (after line 254):
  SUBAGENT_TIMEOUT_SECONDS = 30 * 60  # 30 minutes default

  # In spawn_subagent method, wrap the await with timeout:
  if wait:
      try:
          results: list[dict] = []
          stdout_content = ""

          async def process_stream():
              nonlocal stdout_content
              async for event in self._parse_ndjson_stream(process):
                  results.append(event)
                  self._handle_stream_event(event)
                  if event.get("type") == "assistant":
                      content = event.get("message", {}).get("content", [])
                      for block in content:
                          if block.get("type") == "text":
                              stdout_content += block.get("text", "")

          await asyncio.wait_for(
              process_stream(),
              timeout=self.SUBAGENT_TIMEOUT_SECONDS
          )
      except asyncio.TimeoutError:
          process.kill()
          self.emit_event("subagent:timeout", {
              "prompt_name": prompt_name,
              "timeout_seconds": self.SUBAGENT_TIMEOUT_SECONDS,
          })
          raise
  ```
- **Test**: Create a slow subagent and verify timeout triggers

### Fix 3.2: Hardcoded Metrics in Log Messages (MEDIUM-2)

- **Issue**: Metrics like `(files:N)` are placeholders, not computed values
- **File(s)**: Multiple instructions.xml files
- **Changes**: Add explicit actions to compute counts before logging
- **Code** (example for sprint-dev-story):
  ```xml
  <!-- Before line 107 (end of implement phase): -->
  <action>Count files in File List: {{files_modified}} = count of unique files in File List</action>
  <action>Count lines using: git diff --stat HEAD~1 | tail -1 to get {{lines_changed}}</action>

  <!-- Update log message: -->
  <bash>{{log_script}} '{"...","message":"Implementation complete (files:{{files_modified}}, lines:{{lines_changed}})"}'</bash>
  ```
- **Test**: Verify log messages contain actual computed values

### Fix 3.3: Background Task Tracking Gaps (MEDIUM-3)

- **Issue**: Background tasks don't properly update completion status in all cases
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (lines 1310-1318, 1378-1386)
- **Changes**: Ensure all `asyncio.create_task` calls are tracked with proper completion callbacks
- **Code**:
  ```python
  # Wrap background task spawning (lines 1310-1318):
  async def _spawn_tracked_background_task(
      self, task_name: str, prompt: str, story_keys: list[str], **kwargs
  ) -> None:
      """Spawn a background task with proper tracking."""
      task_id = create_background_task(
          batch_id=self.current_batch_id,
          story_key=",".join(story_keys),
          task_type=task_name,
      )
      try:
          await self.spawn_subagent(prompt, task_name, **kwargs)
          update_background_task(
              task_id,
              status="completed",
              completed_at=int(time.time()),
          )
      except Exception as e:
          update_background_task(
              task_id,
              status="error",
              completed_at=int(time.time()),
          )
          self.emit_event("background:error", {
              "task_id": task_id,
              "task_type": task_name,
              "error": str(e),
          })
  ```
- **Test**: Verify background tasks show completion status in database

### Fix 3.4: Inconsistent Story Key Formats (MEDIUM-4)

- **Issue**: Some commands expect singular `story_key`, others expect plural `story_keys`
- **File(s)**: All instructions.xml files
- **Changes**: Standardize documentation and add normalization in each command
- **Code** (add to each instructions.xml step 1):
  ```xml
  <action>Normalize input variables:</action>
  <note>
    - If story_keys is provided (comma-separated), use it
    - If story_key is provided (singular), convert to array: story_keys = [story_key]
    - Commands should handle both formats gracefully
  </note>
  ```
- **Test**: Test each command with both singular and plural formats

### Fix 3.5: Document jq Dependency (MEDIUM-5)

- **Issue**: jq dependency not documented prominently
- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/README.md`
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/requirements.txt`
- **Changes**: Add jq to prerequisites
- **Code** (add to README.md):
  ```markdown
  ## Prerequisites

  - Python 3.9+
  - `jq` command-line JSON processor
    - macOS: `brew install jq`
    - Ubuntu/Debian: `apt-get install jq`
    - Windows: `choco install jq`
  ```
- **Test**: Document how to verify jq is installed

### Fix 3.6: Wrap Bash Commands in CDATA (MEDIUM-6)

- **Issue**: Inconsistent CDATA usage in bash commands
- **File(s)**: All instructions.xml files
- **Changes**: Wrap ALL bash commands in CDATA blocks
- **Code**:
  ```xml
  <!-- Ensure ALL bash blocks use CDATA: -->
  <bash><![CDATA[
  _bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh '{"epic_id":"{{epic_id}}","story_id":"{{story_key}}","command":"sprint-create-story","task_id":"setup","status":"start","message":"Initializing"}'
  ]]></bash>
  ```
- **Test**: Parse all instructions.xml with XML parser to verify validity

---

## Phase 4: Low Priority Fixes

### Fix 4.1: Remove Duplicate Checklist Content (LOW-1)

- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-create-tech-spec/template.md`
- **Changes**: Remove inline checklist, reference external checklist.md
- **Test**: Verify template references external checklist correctly

### Fix 4.2: Make Project Context Age Configurable (LOW-2)

- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (line 254)
- **Changes**: Add environment variable override
- **Code**:
  ```python
  PROJECT_CONTEXT_MAX_AGE_SECONDS = int(
      os.environ.get("SPRINT_CONTEXT_MAX_AGE", 24 * 3600)
  )
  ```
- **Test**: Set environment variable and verify behavior changes

### Fix 4.3: Standardize Output Markers (LOW-3)

- **File(s)**: All instructions.xml and workflow.yaml files
- **Changes**: Standardize to format: `[MARKER-NAME: VALUE]`
- **Current Markers**:
  - `[TECH-SPEC-DECISION: REQUIRED/SKIP]` - already correct
  - `[CRITICAL-ISSUES-FOUND: YES/NO]` - already correct
  - `[DEV-STORY-COMPLETE: YES/NO]` - already correct
  - `[DEV-STORY-BLOCKED: YES]` - already correct (found in sprint-dev-story)
  - `HIGHEST SEVERITY: CRITICAL/HIGH/MEDIUM/LOW/ZERO ISSUES` - needs brackets
- **Code** (in sprint-code-review/instructions.xml):
  ```xml
  <!-- Change from: -->
  HIGHEST SEVERITY: {{highest_severity}}
  <!-- To: -->
  [HIGHEST-SEVERITY: {{highest_severity}}]
  ```
- **CRITICAL DEPENDENCY**: If marker format changes, MUST update orchestrator.py parsers:
  - `_check_for_critical_issues()` at lines 1494-1502 - parses `HIGHEST SEVERITY: CRITICAL`
  - `_parse_highest_severity()` at lines 1504-1516 - parses `HIGHEST SEVERITY: X` patterns
  - **Recommendation**: Keep current format OR update both places simultaneously
- **Test**: Update orchestrator's parser to handle new format

### Fix 4.4: Compress Verbose Comments (LOW-4)

- **File(s)**: All instructions.xml files
- **Changes**: Remove redundant explanatory text while keeping essential guidance
- **Approach**: Reduce token usage by ~30% through comment compression
- **Test**: Verify essential guidance is preserved

### Fix 4.5: Add Version Numbers to Commands (LOW-5)

- **File(s)**: All workflow.yaml files in commands/
- **Changes**: Add `version` field
- **Code**:
  ```yaml
  version: "3.0.0"
  command: sprint-create-story
  description: ...
  ```
- **Test**: Verify all workflow.yaml files have version field

### Fix 4.6: Remove Unused Variables (LOW-6)

- **File(s)**:
  - `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-code-review/workflow.yaml`
- **Changes**: Remove or document unused `implementation_artifacts` variable
- **Test**: Verify no undefined variable references

---

## Dependencies

```
Phase 1 (Critical) - No dependencies, can be done first
  |
  v
Phase 2 (High Priority) - Depends on Phase 1 logging fixes
  - Fix 2.1 (Template sections) - Independent
  - Fix 2.2 (Variable syntax) - Independent
  - Fix 2.3 (Remove orphan) - Independent
  - Fix 2.4 (File patterns) - Depends on 1.2 for testing
  - Fix 2.5 (Error handling) - Independent
  |
  v
Phase 3 (Medium Priority) - Can proceed after Phase 1 critical logging fixes
  - All fixes in Phase 3 are independent of each other
  |
  v
Phase 4 (Low Priority) - Can be done anytime
  - Fix 4.3 (Markers) - Must update orchestrator parser if changed
```

---

## Testing Strategy

### Unit Tests

1. **Logging Format Test**: Create test cases for `sprint-log.sh` verifying:
   - CSV output format matches orchestrator expectation
   - All required fields are present
   - Message escaping works correctly

2. **Orchestrator Parser Test**: Add tests for `_parse_csv_log_line`:
   - Valid CSV line parsing
   - Malformed line handling
   - Timestamp validation

3. **Template Section Test**: Verify template sections can be extracted:
   - Each named section resolves correctly
   - Missing sections handled gracefully

### Integration Tests

1. **End-to-End Logging Flow**:
   - Spawn a mock subagent that logs via sprint-log.sh
   - Verify orchestrator receives and parses logs
   - Verify dashboard database gets updated

2. **Command Name Consistency**:
   - Run grep across all files for command names
   - Verify all match taxonomy definitions

3. **Background Task Tracking**:
   - Spawn background task
   - Verify completion updates database
   - Verify WebSocket event fires

### Manual Validation

1. Run a complete sprint-runner cycle with:
   - Dashboard open to monitor events
   - Database queries to verify logging
   - Log file review for human-readable entries

2. Verify each command:
   - `sprint-create-story`: Story file created, tech-spec decision output
   - `sprint-create-story-discovery`: Discovery file created
   - `sprint-story-review`: Issues found/fixed, marker output
   - `sprint-dev-story`: Implementation complete, marker output
   - `sprint-code-review`: Severity analysis, marker output
   - `sprint-commit`: Files committed

---

## Implementation Order

### Recommended Sequence

1. **Fix 1.1 (Logging Format)** - Most critical, enables all dashboard visibility
2. **Fix 1.2 (Command Names)** - Ensures log correlation works
3. **Fix 2.5 (Error Handling)** - Prevents silent failures during testing
4. **Fix 3.6 (CDATA Blocks)** - Ensures XML parsing works
5. **Fix 1.3 (Variable Validation)** - Minor fix, quick win
6. **Fix 2.1 (Template Sections)** - Larger change, needs template restructure
7. **Remaining fixes** - In phase order

### Time Estimates

| Phase | Estimated Time | Priority |
|-------|----------------|----------|
| Phase 1 | 2-3 hours | Critical - do first |
| Phase 2 | 3-4 hours | High - do second |
| Phase 3 | 2-3 hours | Medium - can parallelize |
| Phase 4 | 1-2 hours | Low - defer if needed |

**Total Estimated Time**: 8-12 hours

---

## Rollback Plan

If issues occur after deployment:

1. **Logging Rollback**: Revert `sprint-log.sh` to bracket format, update orchestrator to parse brackets instead of CSV

2. **Command Name Rollback**: Revert instructions.xml files, update taxonomy to use short names

3. **Template Rollback**: Keep original template.md, update instructions to generate content directly

All changes should be committed in small, reversible commits with clear descriptions.

---

## Review Notes

**Reviewed By**: Plan Review Agent
**Review Date**: 2026-01-24

### What Was Reviewed

1. **Source Files Examined**:
   - `sprint-log.sh` - Verified current logging format (bracket-based, file-only output)
   - `orchestrator.py` - Verified `_parse_csv_log_line()` expects CSV format (confirmed mismatch)
   - `task-taxonomy.yaml` - Verified `tech-spec-discovery` orphan and naming inconsistencies
   - All `instructions.xml` files in commands/ - Verified command name usage in log calls
   - `template.md` for sprint-create-story - Verified no named sections exist
   - `README.md` - Verified jq dependency is NOT documented
   - All workflow.yaml files - Verified variable syntax patterns

2. **Plan Sections Reviewed**:
   - All 21 fixes across 4 phases
   - Dependencies diagram
   - Testing strategy
   - Implementation order
   - Rollback plan

### What Was Fixed

1. **Fix 1.2 (Command Names)**: Updated specific line numbers after grep verification. Added note about `sprint-code-review` using dynamic command name format `code-review-{{review_attempt}}`. Added test command to verify no remaining short names.

2. **Fix 2.3 (Orphaned Command)**: Corrected line numbers from 152-172 to 155-172. Added discovery that `command_mappings` section uses different naming convention than `commands` section - both need alignment or clarifying comments.

3. **Fix 4.3 (Output Markers)**: Added `[DEV-STORY-BLOCKED: YES]` marker found in sprint-dev-story. Added CRITICAL DEPENDENCY note about orchestrator.py parsers that MUST be updated if marker format changes, with specific line references.

### What Was Added

1. **Verification Commands**: Added concrete bash commands for testing fixes (grep patterns)

2. **Missing Dependency Notes**: Added explicit warning about orchestrator.py parser dependencies for Fix 4.3

3. **Additional Discovery**: Noted the taxonomy naming inconsistency between `commands:` and `command_mappings:` sections

### Issues Still Present (Not Fixed by This Review)

1. **Fix 2.1 (Template Sections)**: The proposed template restructure is valid but complex. Consider Option B (removing template-output references) as simpler alternative.

2. **Log Script Path Inconsistency (NEW FINDING)**:
   - Files using `{{log_script}}` variable: `sprint-code-review`, `sprint-commit`, `sprint-dev-story`, `sprint-tech-spec-review`, `sprint-story-review`
   - Files using hardcoded path: `sprint-create-story`, `sprint-create-story-discovery`, `sprint-create-tech-spec`
   - **Recommendation**: Standardize all to use `{{log_script}}` variable for maintainability, defined in each workflow.yaml

3. **Missing Test Cases in Testing Strategy**: No explicit test cases for:
   - Multi-story batch processing (comma-separated story_keys)
   - Background task cancellation during graceful shutdown
   - Edge cases in `_extract_epic()` regex parsing

4. **sprint-create-story command name**: Uses `"command":"sprint-create-story"` which IS correct (matches taxonomy), but should be verified the orchestrator correlates this properly

### Confidence Level

**HIGH (85%)**

- All critical fixes are accurate and implementable
- Line numbers verified against actual source files
- Dependencies correctly identified
- Minor uncertainty around template restructure complexity (Fix 2.1) - recommend pilot test before full rollout

### Recommended Next Steps

1. Implement Phase 1 fixes first (especially Fix 1.1 logging format)
2. Create automated test for CSV log parsing before/after change
3. Consider creating a single PR per phase for easier rollback
4. Add jq dependency check to orchestrator startup (not just README docs)
