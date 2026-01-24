# Implementation Plan: Prompts & Scripts Fixes

## Overview

This plan addresses the CRITICAL and HIGH priority issues identified in the Sprint Runner prompts and scripts review. The primary issues are:

1. **CRITICAL: `{{log_script}}` placeholder not resolved** - 5 instruction files use unresolved template variables for the log script path
2. **CRITICAL: Missing `--command` flag in spawn_subagent** - The orchestrator does not use `--command` flag when spawning Claude CLI
3. **HIGH: Inconsistent command names in taxonomy** - The `commands` section uses `story-discovery` but `command_mappings` uses `sprint-create-story-discovery`
4. **HIGH: Unresolved `{{story_file}}` variable** - If workflow.yaml is not loaded, the story file path is unknown

## Prerequisites

1. Verify all files exist before making changes
2. Changes should be made in dependency order (infrastructure first, then consumers)
3. After changes, run a test execution to validate fixes work

## Phase 1: Fix Log Script Path (CRITICAL)

The log script path `_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh` needs to be hardcoded in all instructions.xml files that currently use `{{log_script}}` placeholder.

### Step 1.1: Fix sprint-dev-story instructions.xml

- **File**: `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-dev-story/instructions.xml`
- **Change**: Replace all occurrences of `{{log_script}}` with the literal path
- **Occurrences**: Lines 36, 68, 76, 107, 112, 132, 137, 148, 153, 176, 182, 188, 220 (13 total)

- **Before** (example from line 36):
```xml
<bash>{{log_script}} '{"epic_id":"{{epic_id}}","story_id":"{{story_key}}","command":"sprint-dev-story","task_id":"setup","status":"start","message":"Loading implementation context for {{story_key}}"}'</bash>
```

- **After**:
```xml
<bash>_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh '{"epic_id":"{{epic_id}}","story_id":"{{story_key}}","command":"sprint-dev-story","task_id":"setup","status":"start","message":"Loading implementation context for {{story_key}}"}'</bash>
```

- **Also update the `<logging_reference>` section** (line 220):
```xml
<logging_reference>
  <script>_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh</script>
  ...
</logging_reference>
```

### Step 1.2: Fix sprint-story-review instructions.xml

- **File**: `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-story-review/instructions.xml`
- **Change**: Replace all occurrences of `{{log_script}}` with the literal path
- **Occurrences**: Lines 28, 42, 47, 54, 95, 103, 117, 123, 124, 129, 150, 165, 169 (13 total)

- **Before** (example from line 28):
```xml
<bash>{{log_script}} '{"epic_id":"{{epic_id}}","story_id":"{{story_keys}}","command":"sprint-story-review","task_id":"setup","status":"start","message":"Initializing story review"}'</bash>
```

- **After**:
```xml
<bash>_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh '{"epic_id":"{{epic_id}}","story_id":"{{story_keys}}","command":"sprint-story-review","task_id":"setup","status":"start","message":"Initializing story review"}'</bash>
```

- **Also update the `<logging_reference>` section** (line 165):
```xml
<logging_reference>
  <script>_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh</script>
  ...
</logging_reference>
```

### Step 1.3: Fix sprint-tech-spec-review instructions.xml

- **File**: `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-tech-spec-review/instructions.xml`
- **Change**: Replace all occurrences of `{{log_script}}` with the literal path
- **Occurrences**: Lines 28, 42, 47, 54, 104, 112, 126, 132, 133, 138, 159, 173, 178 (13 total)

- **Before** (example from line 28):
```xml
<bash>{{log_script}} '{"epic_id":"{{epic_id}}","story_id":"{{story_keys}}","command":"sprint-tech-spec-review","task_id":"setup","status":"start","message":"Initializing tech-spec review"}'</bash>
```

- **After**:
```xml
<bash>_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh '{"epic_id":"{{epic_id}}","story_id":"{{story_keys}}","command":"sprint-tech-spec-review","task_id":"setup","status":"start","message":"Initializing tech-spec review"}'</bash>
```

- **Also update the `<logging_reference>` section** (line 173):
```xml
<logging_reference>
  <script>_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh</script>
  ...
</logging_reference>
```

### Step 1.4: Fix sprint-code-review instructions.xml

- **File**: `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-code-review/instructions.xml`
- **Change**: Replace all occurrences of `{{log_script}}` with the literal path
- **Occurrences**: Lines 31, 46, 54, 58, 140, 144, 171, 175, 195, 199, 222, 264, 268

- **Before** (example from line 31):
```xml
<bash>{{log_script}} '{"epic_id":"{{epic_id}}","story_id":"{{story_key}}","command":"sprint-code-review","task_id":"setup","status":"start","message":"Loading code for review ({{story_key}})"}'</bash>
```

- **After**:
```xml
<bash>_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh '{"epic_id":"{{epic_id}}","story_id":"{{story_key}}","command":"sprint-code-review","task_id":"setup","status":"start","message":"Loading code for review ({{story_key}})"}'</bash>
```

- **Also update the `<logging_reference>` section** (line 264):
```xml
<logging_reference>
  <script>_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh</script>
  ...
</logging_reference>
```

### Step 1.5: Fix sprint-commit instructions.xml

- **File**: `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-commit/instructions.xml`
- **Change**: Replace all occurrences of `{{log_script}}` with the literal path
- **Occurrences**: Lines 28, 48, 52, 83, 91, 95, 113, 122, 126, 137, 172, 177

- **Before** (example from line 28):
```xml
<bash>{{log_script}} '{"epic_id":"{{epic_id}}","story_id":"{{story_keys}}","command":"sprint-commit","task_id":"setup","status":"start","message":"Initializing smart commit for batch"}'</bash>
```

- **After**:
```xml
<bash>_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh '{"epic_id":"{{epic_id}}","story_id":"{{story_keys}}","command":"sprint-commit","task_id":"setup","status":"start","message":"Initializing smart commit for batch"}'</bash>
```

- **Also update the `<logging_reference>` section** (line 172):
```xml
<logging_reference>
  <script>_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh</script>
  ...
</logging_reference>
```

---

## Phase 2: Fix Command Name Inconsistency (HIGH)

The `task-taxonomy.yaml` file has an inconsistency between the `commands` section (uses `story-discovery`) and the `command_mappings` section (uses `sprint-create-story-discovery`). The instructions.xml uses `sprint-create-story-discovery` in log calls.

### Step 2.1: Standardize command name in task-taxonomy.yaml

- **File**: `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml`
- **Change**: Rename `story-discovery` to `sprint-create-story-discovery` in the `commands` section (lines 77-91)
- **Rationale**: The `command_mappings` section and the actual instructions.xml files all use the longer `sprint-create-story-discovery` name, so we align the `commands` section to match

- **Before** (lines 77-91):
```yaml
  # ----------------------------------------------------------
  # STORY-DISCOVERY: Parallel discovery for story context
  # ----------------------------------------------------------
  story-discovery:
    description: Parallel discovery for story context (runs alongside create-story)
    phases:
      - id: setup
        description: Load story and project context
        typical_start: "Loading discovery context for {story_id}"
        typical_end: "Context loaded"

      - id: explore
        description: Explore codebase for relevant patterns
        typical_start: "Exploring codebase patterns"
        typical_end: "Patterns identified (files:N)"

      - id: write
        description: Write discovery file
        typical_start: "Writing discovery file"
        typical_end: "Discovery file written (lines:N)"
```

- **After**:
```yaml
  # ----------------------------------------------------------
  # SPRINT-CREATE-STORY-DISCOVERY: Parallel discovery for story context
  # ----------------------------------------------------------
  sprint-create-story-discovery:
    description: Parallel discovery for story context (runs alongside create-story)
    phases:
      - id: setup
        description: Load story and project context
        typical_start: "Loading discovery context for {story_id}"
        typical_end: "Context loaded"

      - id: explore
        description: Explore codebase for relevant patterns
        typical_start: "Exploring codebase patterns"
        typical_end: "Patterns identified (files:N)"

      - id: write
        description: Write discovery file
        typical_start: "Writing discovery file"
        typical_end: "Discovery file written (lines:N)"
```

---

## Phase 3: Fix Story File Path Variable (HIGH)

The `sprint-dev-story` instructions reference `{{story_file}}` for saving the story file, but this variable may not be resolved if the workflow.yaml is not loaded. We need to provide an explicit path.

### Step 3.1: Replace story_file variable with explicit path pattern

- **File**: `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/sprint-dev-story/instructions.xml`
- **Change**: Replace `{{story_file}}` with an explicit instruction using the known path pattern
- **Location**: Line 174

- **Before** (line 174):
```xml
<action>Save the story file to disk at {{story_file}}</action>
```

- **After**:
```xml
<action>Save the story file to disk at _bmad-output/implementation-artifacts/sprint-{{story_key}}.md</action>
```

---

## Phase 4: Address --command Flag Issue (CRITICAL)

The review finding states the orchestrator uses `-p` without `--command`, meaning command-specific workflow.yaml and instructions.xml are not loaded. However, after analyzing the orchestrator code, the system uses `--prompt-system-append` to inject context rather than `--command`. This is an architectural decision.

**Analysis**: The current implementation works around the `--command` limitation by:
1. Building context via `build_prompt_system_append()`
2. Injecting file contents directly into the system prompt
3. The subagent receives the prompt text with all necessary context

**Decision**: This is a design choice, not a bug. The instructions.xml files ARE being used - they contain the workflow steps that guide the LLM. The orchestrator sends the prompt with:
- A simple instruction (e.g., "Story keys: 2a-1\nEpic ID: 2a")
- Injected file context via `--prompt-system-append`

The subagent then follows the instructions.xml workflow based on the prompt. However, the variable substitution expected by `{{log_script}}`, `{{story_file}}` etc. does NOT happen - which is why Phase 1 and Phase 3 fixes are critical.

**No code change needed** for this item - the Phase 1 and Phase 3 fixes address the symptom (unresolved variables).

---

## Phase 5: Optional Improvements (MEDIUM/LOW Priority)

These are non-critical improvements that could be addressed in a future iteration.

### Step 5.1: Add required variable validation (LOW)

Each instructions.xml could add explicit validation in step 1 to halt if required variables are missing. This pattern already exists in `sprint-create-story/instructions.xml` (lines 34-38).

Example addition for other commands:
```xml
<check if="story_keys is empty or not provided">
  <output>ERROR: No story_keys provided by orchestrator</output>
  <action>HALT - Cannot proceed without story_keys</action>
</check>
```

### Step 5.2: Document Haiku threshold setting (LOW)

Add explicit documentation in `instructions.md` about the `haiku_after_review` setting default value.

---

## Testing Plan

### Pre-Implementation Verification

1. **Backup current files**:
   ```bash
   cp -r _bmad/bmm/workflows/4-implementation/sprint-runner/commands ./commands-backup
   cp _bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml ./task-taxonomy-backup.yaml
   ```

### Post-Implementation Testing

1. **Syntax validation** - Ensure all XML files are well-formed:
   ```bash
   for f in _bmad/bmm/workflows/4-implementation/sprint-runner/commands/*/instructions.xml; do
     xmllint --noout "$f" 2>&1 || echo "FAILED: $f"
   done
   ```

2. **YAML validation** - Ensure task-taxonomy.yaml is valid:
   ```bash
   python -c "import yaml; yaml.safe_load(open('_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml'))"
   ```

3. **Search verification** - Confirm no `{{log_script}}` remains:
   ```bash
   grep -r "{{log_script}}" _bmad/bmm/workflows/4-implementation/sprint-runner/commands/
   # Should return no results
   ```

4. **Functional test** - Run a single sprint-runner cycle with a test story:
   ```bash
   cd /Users/teazyou/dev/grimoire
   # Note: The orchestrator should be invoked via the dashboard server or direct Python execution
   # The exact invocation method depends on the server setup. Example:
   python _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/orchestrator.py 1
   ```

   Verify:
   - Log entries appear in `./docs/sprint-runner.csv`
   - No errors about `{{log_script}}` being an invalid command
   - Story files are saved to correct paths

---

## Risk Assessment

### Low Risk

- **Log script path changes**: Direct string replacement with no logic changes
- **Task taxonomy rename**: Simple key rename, no functional impact

### Medium Risk

- **Story file path change**: Hardcoding the path pattern means if the path pattern changes in the future, both workflow.yaml and instructions.xml need updating

### Mitigation

1. **Before deployment**: Create a backup of all modified files
2. **After deployment**: Run a single-cycle test before full sprint execution
3. **Rollback procedure**:
   ```bash
   rm -rf _bmad/bmm/workflows/4-implementation/sprint-runner/commands
   cp -r ./commands-backup _bmad/bmm/workflows/4-implementation/sprint-runner/commands
   cp ./task-taxonomy-backup.yaml _bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml
   ```

---

## Implementation Checklist

- [ ] Phase 1.1: Fix sprint-dev-story `{{log_script}}` (13 occurrences)
- [ ] Phase 1.2: Fix sprint-story-review `{{log_script}}` (13 occurrences)
- [ ] Phase 1.3: Fix sprint-tech-spec-review `{{log_script}}` (13 occurrences)
- [ ] Phase 1.4: Fix sprint-code-review `{{log_script}}` (13 occurrences)
- [ ] Phase 1.5: Fix sprint-commit `{{log_script}}` (12 occurrences)
- [ ] Phase 2.1: Rename `story-discovery` to `sprint-create-story-discovery` in task-taxonomy.yaml
- [ ] Phase 3.1: Replace `{{story_file}}` with explicit path in sprint-dev-story
- [ ] Run syntax validation tests
- [ ] Run functional test with single cycle

---

**Plan Created**: 2026-01-24
**Estimated Implementation Time**: 30-45 minutes
**Author**: Technical Lead (Claude Opus 4.5)

---

## Review Amendments

**Reviewed**: 2026-01-24
**Reviewer**: Technical Lead (Claude Opus 4.5)

### Corrections Made

1. **Line Number Accuracy (Phase 1.1-1.3)**
   - Removed incorrect line numbers from occurrence lists
   - sprint-dev-story: Removed line 224 (does not contain `{{log_script}}`)
   - sprint-story-review: Removed line 138 (inside summary_format, no `{{log_script}}`)
   - sprint-tech-spec-review: Removed line 147 (inside summary_format, no `{{log_script}}`)

2. **Occurrence Counts (Implementation Checklist)**
   - Updated sprint-dev-story from 14 to 13 occurrences
   - Updated sprint-story-review from 14 to 13 occurrences
   - Updated sprint-tech-spec-review from 14 to 13 occurrences

3. **Testing Plan (Functional Test)**
   - Fixed invalid Python module path (hyphens are not valid in Python module names)
   - Changed from `python -m _bmad.bmm.workflows.4-implementation...` to direct script invocation

4. **Rollback Procedure**
   - Fixed copy command syntax that would fail for directories
   - Changed to proper `rm -rf` + `cp -r` pattern for directory restoration

### Verification Summary

- All CRITICAL issues from review findings are addressed in the plan
- All HIGH priority issues from review findings are addressed in the plan
- Phase 4 correctly identifies that the `--command` flag issue is by design (context injection via `--prompt-system-append`)
- Code snippets in before/after examples are accurate
- File paths are correct and verified to exist
- Dependency ordering is appropriate (Phase 1 before Phase 3 is logical)

### Status: APPROVED WITH AMENDMENTS

The plan is now ready for implementation after the above corrections.

---

## Coherence Review

**Reviewed Against**: `PLAN-DASHBOARD-DATA.md`
**Review Date**: 2026-01-24
**Reviewer**: Technical Lead (Claude Opus 4.5)

### Conflicts Found: NONE

The two plans operate on completely different layers of the Sprint Runner system:
- **This plan (PROMPTS-SCRIPTS)**: XML instruction files, YAML taxonomy, shell script paths
- **DASHBOARD-DATA**: Python server code, JavaScript frontend, SQLite database

No code changes overlap between the two plans.

### Data Mismatches Found: NONE

The logging system interaction is compatible:
- This plan fixes the log script PATH (`{{log_script}}` -> hardcoded path to `sprint-log.sh`)
- DASHBOARD-DATA addresses how dashboard events are stored/transmitted (database schema, WebSocket)

The shell log script writes to `sprint-runner.csv`, which is independent of the dashboard's database-driven event system. These are parallel logging mechanisms with no interdependency.

### Ordering Dependencies

**Recommended Order**: Execute PLAN-PROMPTS-SCRIPTS first

**Rationale**: This plan fixes the ability for subagent commands to log properly via the shell script. While DASHBOARD-DATA captures orchestrator-level events in the database, having the subagent logging working first ensures complete observability during testing of the dashboard fixes.

**Strict Dependency**: NO - Both plans can be executed independently without breaking each other. The recommended order is for operational convenience, not technical necessity.

### Shared File Modifications: NONE

Files modified by this plan:
- `commands/sprint-dev-story/instructions.xml`
- `commands/sprint-story-review/instructions.xml`
- `commands/sprint-tech-spec-review/instructions.xml`
- `commands/sprint-code-review/instructions.xml`
- `commands/sprint-commit/instructions.xml`
- `task-taxonomy.yaml`

Files modified by DASHBOARD-DATA:
- `dashboard/server/server.py`
- `dashboard/server/orchestrator.py`
- `dashboard/server/db.py`
- `dashboard/frontend/js/websocket.js`
- `dashboard/frontend/js/sidebar.js`
- `dashboard/frontend/js/settings.js`

No overlap detected.

### Integration Points

| Integration Point | This Plan | DASHBOARD-DATA | Status |
|-------------------|-----------|----------------|--------|
| Log script invocation | Fixes path resolution | N/A | Independent |
| CSV log output | Output target | N/A | Independent |
| Orchestrator events | N/A | Fixes schema/storage | Independent |
| WebSocket events | N/A | Fixes payload format | Independent |

### Conclusion

**Both plans can be executed together safely.** There are no conflicts, no data mismatches, and no shared file modifications. The plans address orthogonal concerns within the Sprint Runner system.

**Execution Strategy**: Either sequential (PROMPTS-SCRIPTS first recommended) or parallel implementation by different developers is acceptable.
