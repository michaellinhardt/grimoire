---
title: 'Update spawn_subagent() Method for Prompt System Append'
slug: 'A-2-spawn-subagent-prompt-system-append'
created: '2026-01-24'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Python 3.12+', 'asyncio', 'Claude CLI', 'pytest']
files_to_modify: ['_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py']
code_patterns: ['async/await subprocess management', 'CLI argument building', 'Optional parameter pattern']
test_patterns: ['pytest fixtures', 'AsyncMock for subprocess', 'patch decorators']
---

# Tech-Spec: Update spawn_subagent() Method for Prompt System Append

**Created:** 2026-01-24
**Story:** A-2 (Epic A: Orchestrator Infrastructure)

## Overview

### Problem Statement

The orchestrator's `spawn_subagent()` method currently has no way to pass context to Claude CLI via the `--prompt-system-append` flag. Story A-1 implements `build_prompt_system_append()` which generates XML content for injection, but there's no mechanism to pass this content to the spawned subagent.

### Solution

Update the `spawn_subagent()` method to accept an optional `prompt_system_append: Optional[str] = None` parameter. When provided, add the `--prompt-system-append` flag to the Claude CLI arguments with the content as its value. This enables pre-computed context injection into subagents at spawn time.

### Scope

**In Scope:**
- Add new `prompt_system_append` parameter to method signature
- Add `--prompt-system-append` flag to CLI args when parameter is provided
- Preserve all existing functionality (model override, background tasks, NDJSON parsing)
- Ensure proper flag ordering (after model, before subprocess creation)

**Out of Scope:**
- Modifying `build_prompt_system_append()` (Story A-1 - already complete)
- Updating callers to use the new parameter (Story A-6)
- Shell escaping for special characters (Claude CLI handles this internally)
- Temp file approach for large content (deferred - Claude CLI handles large strings)

## Context for Development

### Codebase Patterns

**Current Method Signature (lines 524-531):**
```python
async def spawn_subagent(
    self,
    prompt: str,
    prompt_name: str = "unknown",
    wait: bool = True,
    is_background: bool = False,
    model: Optional[str] = None,
) -> dict[str, Any]:
```

**Existing Flag Pattern (lines 547-549):**
```python
# Model override for review-2+ (uses Haiku)
if model:
    args.extend(["--model", model])
```

**The new parameter follows the identical pattern:**
```python
if prompt_system_append:
    args.extend(["--prompt-system-append", prompt_system_append])
```

### Files to Reference

| File | Purpose | Lines |
| ---- | ------- | ----- |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` | Target file - contains `spawn_subagent()` method | 524-606 |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/test_orchestrator.py` | Test patterns - pytest fixtures, AsyncMock usage | All |

### Technical Decisions

1. **Parameter Position**: Add `prompt_system_append` as the last optional parameter after `model` to maintain backwards compatibility with all existing callers
2. **Flag Ordering**: Place `--prompt-system-append` after `--model` in the CLI args (mirrors parameter order)
3. **No Temp File**: Pass content directly to CLI flag - Claude CLI handles large strings internally; if issues arise, temp file approach can be implemented as future enhancement
4. **Type Annotation**: Use `Optional[str] = None` matching the existing `model` parameter pattern
5. **No Validation**: Do not validate content size in `spawn_subagent()` - that's handled by `build_prompt_system_append()` (Story A-1) which enforces the 150KB limit

## Implementation Plan

### Tasks

**Task 1: Update Method Signature**
- **File:** `orchestrator.py`
- **Location:** Lines 524-531
- **Action:** Add `prompt_system_append: Optional[str] = None` as the last parameter

**Before:**
```python
async def spawn_subagent(
    self,
    prompt: str,
    prompt_name: str = "unknown",
    wait: bool = True,
    is_background: bool = False,
    model: Optional[str] = None,
) -> dict[str, Any]:
```

**After:**
```python
async def spawn_subagent(
    self,
    prompt: str,
    prompt_name: str = "unknown",
    wait: bool = True,
    is_background: bool = False,
    model: Optional[str] = None,
    prompt_system_append: Optional[str] = None,
) -> dict[str, Any]:
```

**Task 2: Update Docstring**
- **File:** `orchestrator.py`
- **Location:** Lines 532-544
- **Action:** Add documentation for the new parameter

**Add to Args section:**
```python
prompt_system_append: Optional content to append to system prompt via
    --prompt-system-append flag. Used for context injection.
```

**Task 3: Add CLI Flag Logic**
- **File:** `orchestrator.py`
- **Location:** After line 549 (after model flag logic)
- **Action:** Add conditional to extend args with `--prompt-system-append`

**Add after model handling:**
```python
# Prompt system append for context injection (Story A-2)
if prompt_system_append:
    args.extend(["--prompt-system-append", prompt_system_append])
```

### Acceptance Criteria

**AC1: Method Signature Updated**
- Given the `spawn_subagent` method
- When the signature is examined
- Then it includes `prompt_system_append: Optional[str] = None` as the last parameter

**AC2: Backwards Compatibility Preserved**
- Given existing callers of `spawn_subagent` (15+ call sites in orchestrator.py)
- When they call the method without `prompt_system_append`
- Then the method behaves exactly as before (no `--prompt-system-append` flag added)

**AC3: Flag Added When Parameter Provided**
- Given a call to `spawn_subagent` with `prompt_system_append="<xml>content</xml>"`
- When the CLI args are constructed
- Then the args list includes `["--prompt-system-append", "<xml>content</xml>"]`

**AC4: Flag Ordering Correct**
- Given a call with both `model="haiku"` and `prompt_system_append="content"`
- When the CLI args are constructed
- Then args order is: `["claude", "-p", "--output-format", "stream-json", "--model", "haiku", "--prompt-system-append", "content"]`

**AC5: Existing NDJSON Parsing Unchanged**
- Given a subagent spawned with `prompt_system_append`
- When parsing the NDJSON output stream
- Then task-id events are captured correctly and WebSocket events are emitted as before

**AC6: Background Task Tracking Unchanged**
- Given a call with `is_background=True` and `prompt_system_append`
- When the subagent runs in background
- Then the background task is tracked in `_background_tasks` list as before

## Additional Context

### Dependencies

- **Story A-1 (MUST BE COMPLETE):** `build_prompt_system_append()` method - provides the content to pass to this parameter
- **Story A-6 (DEPENDS ON THIS):** Will update all phase methods to call `spawn_subagent` with the new parameter

### Call Sites That Will Use This (Story A-6)

From grep of `spawn_subagent` calls in orchestrator.py:
- Line 320: `create_project_context()` - project context generation
- Line 370: `_run_background_context_refresh()` - background context refresh
- Line 409: `_run_background_task()` - generic background task runner
- Line 1014: `_execute_create_story_phase()` - create-story command
- Line 1017: `_execute_create_story_phase()` - story-discovery command
- Line 1053: `_execute_story_review_phase()` - story-review command
- Line 1066: `_execute_story_review_phase()` - background review chain
- Line 1076: `_execute_tech_spec_phase()` - create-tech-spec command
- Line 1085: `_execute_tech_spec_review_phase()` - tech-spec-review command
- Line 1097: `_execute_tech_spec_review_phase()` - background review chain
- Line 1109: `_execute_dev_phase()` - dev-story command
- Line 1126: `_execute_code_review_loop()` - code-review command
- Line 1173: `_execute_batch_commit()` - batch-commit command

All 15 callers will continue to work unchanged (backwards compatible).

### Testing Strategy

**Unit Tests to Add (in test_orchestrator.py):**

1. **test_spawn_subagent_without_prompt_system_append**: Verify existing behavior unchanged when parameter not provided
2. **test_spawn_subagent_with_prompt_system_append**: Verify flag added to args when parameter provided
3. **test_spawn_subagent_flag_ordering**: Verify `--prompt-system-append` comes after `--model`
4. **test_spawn_subagent_with_both_model_and_append**: Verify both flags work together

**Test Pattern (from existing tests):**
```python
@pytest.mark.asyncio
async def test_spawn_subagent_with_prompt_system_append(self, orchestrator):
    """Should add --prompt-system-append flag when parameter provided."""
    with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
        mock_process = AsyncMock()
        mock_process.stdin.write.return_value = None
        mock_process.stdin.drain = AsyncMock()
        mock_process.stdin.close.return_value = None
        mock_process.stdout.readline = AsyncMock(return_value=b"")
        mock_process.wait = AsyncMock()
        mock_process.returncode = 0
        mock_create.return_value = mock_process

        await orchestrator.spawn_subagent(
            "test prompt",
            prompt_system_append="<file_injections>test</file_injections>"
        )

        # Verify the flag was passed
        call_args = mock_create.call_args[0]
        assert "--prompt-system-append" in call_args
        idx = call_args.index("--prompt-system-append")
        assert call_args[idx + 1] == "<file_injections>test</file_injections>"
```

### Notes

- The `--prompt-system-append` flag is a Claude CLI feature that **appends** content to the system prompt WITHOUT replacing it
- This is different from `--prompt-system` which would **replace** the entire system prompt
- Content sizes up to 150KB (per Story A-1 limits) should work - Claude CLI handles this internally
- The XML content from `build_prompt_system_append()` may contain quotes, angle brackets, and other special characters - these pass through correctly as a single string argument
- No shell escaping is needed since we use `create_subprocess_exec()` which passes args directly to the process without shell interpretation

### Implementation Verification Checklist

- [ ] Parameter added to method signature after `model`
- [ ] Docstring updated with parameter documentation
- [ ] Flag logic added after model handling (line ~549)
- [ ] Existing tests still pass
- [ ] New tests added for the parameter
- [ ] Manual verification: call with test content, verify flag appears in subprocess args
