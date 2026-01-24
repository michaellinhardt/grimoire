# Prompt and Script Review

**Reviewed:** 2026-01-24
**Scope:** Sprint Runner commands, scripts, and orchestrator prompt handling

---

## Critical Issues

### CRITICAL-1: Inconsistent Log Command Names Between taxonomy and Actual Instructions

- **Issue:** The `task-taxonomy.yaml` defines command names like `create-story`, `story-discovery`, `story-review` but the actual instructions.xml files use different command names in their logging calls.
- **Why it's an error:** The taxonomy specifies `command_mappings` with keys like `sprint-create-story`, `sprint-story-review`, etc., but some XML instructions log with just `create-story`, `story-discovery`, `story-review` (without the `sprint-` prefix). This inconsistency could cause:
  - Dashboard parsing failures when correlating log entries
  - Broken analytics on command execution patterns
  - Confusion when debugging which command produced which log
- **Where it occurs:**
  - `sprint-create-story-discovery/instructions.xml` logs as `command":"story-discovery"` but taxonomy says `sprint-create-story-discovery`
  - `sprint-story-review/instructions.xml` logs as `command":"story-review"` but taxonomy says `sprint-story-review`
  - `sprint-dev-story/instructions.xml` logs as `command":"dev-story"` but taxonomy says `sprint-dev-story`
  - `sprint-code-review/instructions.xml` logs with `command":"code-review-{{review_attempt}}"` which is correct format
- **How to fix:** Standardize all command names in log calls to match the taxonomy `command_mappings` keys. Either:
  1. Update taxonomy to use short names (without `sprint-` prefix), OR
  2. Update all XML instructions to use full `sprint-` prefixed names

### CRITICAL-2: Missing Variable Validation in sprint-create-story instructions.xml

- **Issue:** The instructions reference `{{story_count}}` variable in Step 1 logging without first defining how to compute it.
- **Why it's an error:** The log message `"Setup complete, processing {{story_count}} stories"` references a variable that is described but never explicitly computed. LLM agents may fail to substitute this correctly or output literal `{{story_count}}`.
- **Where it occurs:** `sprint-create-story/instructions.xml` line 42
- **How to fix:** Add explicit action before the log: `<action>Set {{story_count}} = length of story_keys_array</action>`

### CRITICAL-3: Log Format Mismatch Between sprint-log.sh and orchestrator.py Expectations

- **Issue:** The `sprint-log.sh` script produces a human-readable log format (`[timestamp] [epic_id/story_id] [command:task_id] [status] message`) but the `orchestrator.py` expects CSV format with specific columns.
- **Why it's an error:** The orchestrator's `_parse_csv_log_line` method (lines 854-876) expects CSV format: `timestamp,epicID,storyID,command,task-id,status,"message"` but the shell script outputs a completely different format with square brackets. This means:
  - The dashboard will NEVER receive properly parsed task events from subagents
  - All subagent logging will effectively be invisible to the orchestrator
  - WebSocket events for task progress will never fire
- **Where it occurs:**
  - `scripts/sprint-log.sh` lines 59-62 (outputs bracket format)
  - `orchestrator.py` lines 854-876 (expects CSV)
- **How to fix:** Either:
  1. Rewrite `sprint-log.sh` to output CSV format matching orchestrator expectations, OR
  2. Update `orchestrator.py` to parse the bracket format

### CRITICAL-4: sprint-log.sh Outputs to Wrong Location for Dashboard Visibility

- **Issue:** The logging script writes to `$SCRIPT_DIR/../dashboard/sprint.log` but the orchestrator/dashboard expects logs in a different location or via stdout for NDJSON parsing.
- **Why it's an error:** The orchestrator parses stdout from subagent processes looking for CSV lines in tool_result content. Writing to a log file instead of stdout means the data never reaches the orchestrator's stream parser.
- **Where it occurs:**
  - `scripts/sprint-log.sh` line 67-68 writes to file
  - `instructions.md` line 46-47 says logs go to `./docs/sprint-runner.csv`
  - `orchestrator.py` parses stdout streams
- **How to fix:** The script should `echo` the log line to stdout (for orchestrator parsing) in addition to or instead of file writing. The current architecture expects subagents to produce output that the orchestrator can parse from the Claude CLI's NDJSON stream.

---

## High Priority Issues

### HIGH-1: No Error Handling for sprint-log.sh Execution Failures

- **Issue:** All instruction XML files call sprint-log.sh via `<bash>` blocks but none handle the case where the script fails (missing jq, permission errors, etc.).
- **Why it's an error:** If logging fails silently, the orchestrator and dashboard have no visibility into task progress. Critical workflow failures could go unnoticed.
- **Where it occurs:** Every instructions.xml file contains multiple `<bash>` calls to sprint-log.sh
- **How to fix:** Add error handling or at minimum document that jq dependency must be installed. Consider adding a health check in the orchestrator's initialization.

### HIGH-2: Undefined Template Variables in sprint-create-story/instructions.xml

- **Issue:** The `<template-output>` elements reference template sections like `story_header`, `developer_context_section`, etc. that don't exist in the actual template.md file.
- **Why it's an error:** The template.md file is a simple markdown template with placeholders, but the instructions expect named sections that can be individually invoked. This mismatch means the templating won't work as intended.
- **Where it occurs:** `sprint-create-story/instructions.xml` lines 110-134
- **How to fix:** Either restructure template.md to have named sections that can be referenced, or change instructions to use the template as a whole document rather than section-by-section.

### HIGH-3: Variable Reference Syntax Inconsistency

- **Issue:** Instructions use inconsistent variable reference syntax - some use `{{variable}}`, others use `{variable}`, and YAML files use `'{config_source}:variable'` syntax.
- **Why it's an error:** LLM agents may not correctly interpret which syntax to use where, leading to literal strings appearing in output instead of resolved values.
- **Where it occurs:**
  - workflow.yaml files use single-brace: `{project-root}`, `{installed_path}`
  - instructions.xml use double-brace: `{{epic_id}}`, `{{story_key}}`
  - Some logging calls mix both
- **How to fix:** Document the convention clearly and standardize. Typical pattern: single-brace for workflow system variables, double-brace for runtime context variables.

### HIGH-4: Orphaned tech-spec-discovery Command in Taxonomy

- **Issue:** The `task-taxonomy.yaml` defines `tech-spec-discovery` command but there is no corresponding command folder in `commands/`.
- **Why it's an error:** The taxonomy documentation is out of sync with actual implementation, causing confusion about what commands exist.
- **Where it occurs:** `task-taxonomy.yaml` lines 153-171
- **How to fix:** Either remove the orphaned definition from taxonomy, or create the missing command if it's actually needed.

### HIGH-5: Incorrect Discovery File Pattern in orchestrator.py

- **Issue:** The orchestrator in `_execute_create_story_phase` looks for discovery files with pattern `sprint-{story_key}-discovery-story.md` but the actual sprint-create-story-discovery command outputs to a different pattern according to its workflow.yaml.
- **Why it's an error:** The project-context-injection script won't find the files if naming doesn't match.
- **Where it occurs:**
  - `orchestrator.py` line 1266: expects `sprint-{story_key}-discovery-story.md`
  - `sprint-create-story-discovery/workflow.yaml` line 21: uses `sprint-{story_key}-discovery-story.md` (matches, but XML template shows just `{story_key}-discovery-story.md` in output)
  - `sprint-create-story-discovery/instructions.xml` line 151: uses `sprint-{{story_key}}-discovery-story.md`
- **How to fix:** Ensure all three locations use exactly the same pattern. Currently they're close but XML may resolve to different names.

---

## Medium Priority Issues

### MEDIUM-1: No Timeout Handling for Subagent Processes

- **Issue:** The `spawn_subagent` method in orchestrator.py has no timeout mechanism for runaway subagent processes.
- **Why it's an error:** A stuck subagent could hang the entire sprint-runner indefinitely.
- **Where it occurs:** `orchestrator.py` lines 719-808
- **How to fix:** Add asyncio.wait_for with configurable timeout, implement cleanup of stuck processes.

### MEDIUM-2: Hardcoded Metric Names in Log Messages

- **Issue:** Log message examples use metrics like `(files:N)`, `(lines:N)`, `(tests:N)` but the actual values are never computed in most instructions.
- **Why it's an error:** The dashboard expects structured metrics in log messages but gets placeholder text or inconsistent formats.
- **Where it occurs:** Multiple instructions.xml files reference metrics in their logging but don't show how to compute the counts.
- **How to fix:** Add explicit actions to compute counts before logging, or make metric extraction more flexible in the parser.

### MEDIUM-3: Background Task Tracking Gaps

- **Issue:** Background review chains spawned via `asyncio.create_task` in orchestrator.py don't properly track completion status for all cases.
- **Why it's an error:** If background tasks fail, there's no mechanism to surface this to the dashboard or alert the user.
- **Where it occurs:** `orchestrator.py` lines 1310-1318, 1378-1386
- **How to fix:** Ensure all background tasks update the `background_tasks` table on completion or failure.

### MEDIUM-4: Inconsistent Story Key Formats Across Commands

- **Issue:** Some commands expect `story_key` (singular), others expect `story_keys` (plural comma-separated). This creates potential for runtime errors.
- **Why it's an error:** If orchestrator passes comma-separated keys to a command expecting singular key, parsing fails.
- **Where it occurs:**
  - `sprint-dev-story` expects singular `story_key`
  - `sprint-code-review` expects singular `story_key`
  - `sprint-create-story` expects plural `story_keys`
  - `sprint-commit` expects plural `story_keys`
- **How to fix:** Standardize the variable name or ensure all commands can handle both formats.

### MEDIUM-5: Missing jq Dependency Documentation

- **Issue:** The sprint-log.sh script requires jq but this dependency isn't documented anywhere prominent.
- **Why it's an error:** Users on fresh systems will get cryptic failures.
- **Where it occurs:** `scripts/sprint-log.sh` line 20-23
- **How to fix:** Add jq to requirements or documentation, consider a fallback for systems without jq.

### MEDIUM-6: XML CDATA Blocks Not Consistently Used

- **Issue:** Some bash commands in XML instructions are wrapped in `<![CDATA[...]]>` and others are not, leading to potential XML parsing issues with special characters.
- **Why it's an error:** JSON payloads containing quotes or special characters could break XML parsing.
- **Where it occurs:** Inconsistent usage across all instructions.xml files
- **How to fix:** Wrap ALL bash commands in CDATA blocks for safety.

---

## Low Priority Issues

### LOW-1: Duplicate Information in Template and Checklist

- **Issue:** The `sprint-create-tech-spec/template.md` includes a Validation Checklist section that duplicates content from `checklist.md`.
- **Why it's an error:** Maintenance burden - changes need to be made in two places.
- **Where it occurs:** template.md lines 106-127, checklist.md contains same criteria
- **How to fix:** Remove checklist from template or reference the external checklist file.

### LOW-2: Magic Number for Project Context Age

- **Issue:** The 24-hour freshness threshold is hardcoded as `24 * 3600` with no configuration option.
- **Why it's an error:** Users may want different refresh intervals.
- **Where it occurs:** `orchestrator.py` line 254
- **How to fix:** Make this configurable via environment variable or config file.

### LOW-3: Inconsistent Marker Formats

- **Issue:** Different commands use different marker formats for their output signals:
  - `[TECH-SPEC-DECISION: REQUIRED/SKIP]`
  - `[CRITICAL-ISSUES-FOUND: YES/NO]`
  - `[DEV-STORY-COMPLETE: YES/NO]`
  - `HIGHEST SEVERITY: CRITICAL/HIGH/MEDIUM/LOW/ZERO ISSUES`
- **Why it's an error:** Makes parsing logic more complex than necessary.
- **Where it occurs:** Various workflow.yaml and instructions.xml files
- **How to fix:** Standardize to a consistent format like `[MARKER-NAME: VALUE]` for all.

### LOW-4: Verbose Comments in Instructions

- **Issue:** Some XML instructions contain excessive comments and explanatory notes that increase token usage when sent to LLMs.
- **Why it's an error:** Unnecessary token consumption reduces context window for actual work.
- **Where it occurs:** All instructions.xml files
- **How to fix:** Compress or remove redundant comments while keeping essential guidance.

### LOW-5: No Version Information in Commands

- **Issue:** Individual command workflow.yaml files don't have version numbers, making it hard to track which version of a command is deployed.
- **Why it's an error:** Debugging issues across different deployments becomes harder.
- **Where it occurs:** All workflow.yaml files in commands/
- **How to fix:** Add a `version` field to each workflow.yaml.

### LOW-6: Unused Variables in workflow.yaml Files

- **Issue:** Some workflow.yaml files define variables that are never used in their instructions.
- **Why it's an error:** Creates confusion about what's actually needed.
- **Where it occurs:** `sprint-code-review/workflow.yaml` defines `implementation_artifacts` but it's not used
- **How to fix:** Remove unused variable definitions or document their purpose.

---

## Recommendations

### Architecture Recommendations

1. **Unify Logging Architecture:** The current split between file-based logging (sprint-log.sh), stdout parsing (orchestrator), and database logging creates multiple points of failure. Consider a single logging pathway.

2. **Add Schema Validation:** Create JSON schemas for the expected formats of:
   - Log entries
   - Output markers
   - File injection content

   This would catch format errors early.

3. **Implement Health Checks:** Add a pre-flight check that validates:
   - jq is installed
   - Required paths exist
   - Config files are valid
   - Dependencies are available

### Prompt Engineering Recommendations

4. **Consolidate Critical Rules:** Each instructions.xml has similar `<critical_rules>` and `<autonomous_mode>` sections. Consider extracting these to a shared include to ensure consistency.

5. **Add Examples to All Commands:** Some commands have good examples in their prompts (sprint-commit), others don't. Add concrete examples of expected input/output to all commands.

6. **Reduce Token Usage:** The instructions are quite verbose. Consider:
   - Moving detailed explanations to separate documentation
   - Using more structured XML with less prose
   - Compressing repeated patterns

### Robustness Recommendations

7. **Add Retry Logic:** For critical operations like git commits and file writes, add retry with exponential backoff.

8. **Implement Graceful Degradation:** When optional components fail (logging, background tasks), the main workflow should continue with warnings rather than halt.

9. **Add Dry-Run Mode:** Allow running the sprint-runner in a mode that shows what would happen without making changes, for testing and debugging.

### Testing Recommendations

10. **Add Prompt Unit Tests:** Create tests that verify LLM agents correctly interpret the instructions by checking:
    - Variable substitution works
    - Marker outputs are correctly formatted
    - Logging calls are valid

11. **Mock Subagent Testing:** The orchestrator tests should have comprehensive mocks for subagent behavior including:
    - Timeout scenarios
    - Malformed output
    - Partial completion

---

## Summary

| Priority | Count | Key Themes |
|----------|-------|------------|
| Critical | 4 | Logging format mismatch, command name inconsistency |
| High | 5 | Template/variable issues, missing commands |
| Medium | 6 | Timeout handling, metric computation, dependency docs |
| Low | 6 | Code quality, maintainability improvements |

**Most Urgent Fix:** CRITICAL-3 and CRITICAL-4 regarding the logging format mismatch - without fixing these, the dashboard and orchestrator cannot track subagent progress at all.

**Highest Impact Fix:** CRITICAL-1 regarding command name consistency - this affects all analytics and debugging capabilities.
