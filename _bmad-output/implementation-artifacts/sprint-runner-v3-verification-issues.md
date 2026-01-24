# Sprint-Runner v3 Verification Issues - Run 3

**Date:** 2026-01-24
**Scope:** Final Comprehensive Verification
**Test Results:** 287 passed, 49 warnings (all test warnings are unawaited coroutines in mocks - not functional issues)

---

## CRITICAL ISSUES FOUND

### Issue 1: Output Marker Mismatch Between Orchestrator and Review Commands

**Severity:** CRITICAL
**Location:** `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (lines 1494-1496)

**Problem:**
The orchestrator's `_check_for_critical_issues()` method checks for `HIGHEST SEVERITY: CRITICAL` but the review commands output different markers:

- `sprint-story-review` outputs: `[CRITICAL-ISSUES-FOUND: YES]`
- `sprint-tech-spec-review` outputs: `[CRITICAL-ISSUES-FOUND: YES]`
- `sprint-code-review` outputs: `HIGHEST SEVERITY: CRITICAL` (correct match)

**Impact:**
Background review chains will **never** be triggered for story-review and tech-spec-review phases because the orchestrator is looking for the wrong output marker.

**Current Code (orchestrator.py line 1494-1496):**
```python
def _check_for_critical_issues(self, stdout: str) -> bool:
    """Check if output indicates critical issues."""
    return "HIGHEST SEVERITY: CRITICAL" in stdout
```

**Fix Required:**
```python
def _check_for_critical_issues(self, stdout: str) -> bool:
    """Check if output indicates critical issues."""
    # Check both marker formats used by different commands:
    # - story-review and tech-spec-review use: [CRITICAL-ISSUES-FOUND: YES]
    # - code-review uses: HIGHEST SEVERITY: CRITICAL
    return ("[CRITICAL-ISSUES-FOUND: YES]" in stdout or
            "HIGHEST SEVERITY: CRITICAL" in stdout)
```

---

### Issue 2: Discovery File Naming Pattern Mismatch

**Severity:** HIGH
**Location:** `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (lines 1264-1269)

**Problem:**
The orchestrator expects discovery files at: `{story_key}-discovery-story.md`
But the `sprint-create-story-discovery` command outputs: `sprint-{story_key}-discovery-story.md`

**Current Code (orchestrator.py lines 1264-1269):**
```python
discovery_file = (
    self.project_root
    / "_bmad-output/implementation-artifacts"
    / f"{story_key}-discovery-story.md"  # WRONG: Missing 'sprint-' prefix
)
```

**Expected Pattern (from command instructions.xml):**
```xml
<file pattern="sprint-{story_key}-discovery-story.md">
```

**Impact:**
- `project-context-injection.sh` will not find discovery files after create-story-discovery phase
- Discovery context may not be properly enriched with project context

**Fix Required:**
```python
discovery_file = (
    self.project_root
    / "_bmad-output/implementation-artifacts"
    / f"sprint-{story_key}-discovery-story.md"  # Correct with 'sprint-' prefix
)
```

---

## VERIFICATION SUMMARY BY PHASE

### Phase Method Injection Flags (All Correct)

| Phase Method | project_context | discovery | tech_spec | Expected | Status |
|--------------|-----------------|-----------|-----------|----------|--------|
| `create_story` | True | False | False | True/False/False | PASS |
| `create_story_discovery` | True | False | False | True/False/False | PASS |
| `story_review` | True | True | False | True/True/False | PASS |
| `tech_spec` | True | True | False | True/True/False | PASS |
| `tech_spec_review` | True | True | True | True/True/True | PASS |
| `dev_story` | True | True | True | True/True/True | PASS |
| `code_review` | True | True | True | True/True/True | PASS |
| `batch_commit` | False | False | False | False/False/False | PASS |

### Command Name Alignment (Orchestrator vs Commands Folder)

| Orchestrator Method | prompt_name Used | Commands Folder | Status |
|---------------------|------------------|-----------------|--------|
| `_execute_create_story_phase` | `sprint-create-story` | `commands/sprint-create-story/` | PASS |
| `_execute_create_story_phase` | `sprint-create-story-discovery` | `commands/sprint-create-story-discovery/` | PASS |
| `_execute_story_review_phase` | `sprint-story-review` | `commands/sprint-story-review/` | PASS |
| `_execute_tech_spec_phase` | `sprint-create-tech-spec` | `commands/sprint-create-tech-spec/` | PASS |
| `_execute_tech_spec_review_phase` | `sprint-tech-spec-review` | `commands/sprint-tech-spec-review/` | PASS |
| `_execute_dev_phase` | `sprint-dev-story` | `commands/sprint-dev-story/` | PASS |
| `_execute_code_review_loop` | `sprint-code-review` | `commands/sprint-code-review/` | PASS |
| `_execute_batch_commit` | `sprint-commit` | `commands/sprint-commit/` | PASS |

### XML Structure in Commands (All Correct)

All command files use proper XML structure with:
- `<workflow>` root element
- Proper `<step>` elements with n="" and goal="" attributes
- `<bash>` elements for sprint-log.sh calls
- Correct JSON format for logging: `{"epic_id":"...","story_id":"...","command":"...","task_id":"...","status":"...","message":"..."}`

### Logging Script (sprint-log.sh) JSON Schema (Correct)

Required fields validated:
- `epic_id` - Epic identifier
- `story_id` - Story key(s)
- `command` - Command name
- `task_id` - Task phase
- `status` - start/end
- `message` (optional) - Description

### Output Markers by Command

| Command | Marker Pattern | Orchestrator Parses | Status |
|---------|---------------|---------------------|--------|
| `sprint-create-story` | `[TECH-SPEC-DECISION: REQUIRED/SKIP]` | `_parse_tech_spec_decisions` | PASS |
| `sprint-story-review` | `[CRITICAL-ISSUES-FOUND: YES/NO]` | `_check_for_critical_issues` | **FAIL** |
| `sprint-tech-spec-review` | `[CRITICAL-ISSUES-FOUND: YES/NO]` | `_check_for_critical_issues` | **FAIL** |
| `sprint-code-review` | `HIGHEST SEVERITY: {level}` | `_parse_highest_severity` | PASS |
| `sprint-code-review` | `ZERO ISSUES` | `_parse_highest_severity` | PASS |
| `sprint-commit` | `[COMMIT-SUCCESS: {hash}]` | Not parsed | N/A |
| `sprint-dev-story` | `[DEV-STORY-COMPLETE: YES/NO]` | Not parsed | N/A |

### Edge Cases Checked

1. **Hardcoded Paths:** None found - uses `self.project_root` consistently
2. **Error Handling:** Present for:
   - File read errors in `add_file()`
   - Process communication errors (BrokenPipeError, ConnectionResetError)
   - Background task cancellation
   - YAML parsing errors would raise FileNotFoundError
3. **Missing Error Handling:** None identified

---

## ACTIONS REQUIRED

1. **Fix `_check_for_critical_issues()` method** to check for both marker formats
2. **Fix discovery file path** to use `sprint-{story_key}-discovery-story.md` prefix

Both fixes are single-line changes with minimal risk.

---

## Previous Issues (From Earlier Runs - For Reference)

Issues from Run 1 and Run 2 that may still need attention:

### Log Script Path Inconsistencies (Lower Priority)
- Some workflow.yaml and instructions.xml files reference `_bmad/scripts/sprint-log.sh` instead of `_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh`
- Impact: Only affects standalone command invocation, not orchestrator-driven execution

### Dead Code: load_prompt() Method
- Method at lines 1535-1556 is never called
- Recommend removal in future cleanup

---

## Test Run Summary

```
287 passed, 49 warnings in 1.65s
```

All 287 tests pass. The 49 warnings are all `RuntimeWarning: coroutine was never awaited` from async mock tests - these are cosmetic issues with the test mocks, not functional problems with the code.
