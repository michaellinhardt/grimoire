# Change Report: Sprint Runner Task Granularity Enhancement

**Date:** 2026-01-24
**Requested by:** Teazyou
**Author:** BMad Master
**Status:** Validated and Ready for Implementation

---

## Executive Summary

This change enhances the sprint-runner logging system to provide granular task-level tracking with descriptive messages. Currently, all events log `"workflow"` as the task-id, providing no insight into what specific work is being performed. This change introduces:

1. **Granular task IDs** via a taxonomy file (hybrid approach: major phases + critical checkpoints)
2. **Message field** (7th CSV column) with required messages for start/end events
3. **Dashboard updates** to display messages inline in timeline and expandable in activity log

---

## Current State Analysis

### CSV Format (6 columns)
```
timestamp,epicID,storyID,command,task-id,status
1769178243,2b,2b-6,create-story,workflow,start
```

### Issues with Current Format
- `task-id` is always literal `"workflow"` - zero granularity
- No context about what the task is doing or its outcome
- Dashboard cannot show meaningful task breakdowns
- No visibility into subagent progress within a command

### Current Files Involved
| File | Purpose |
|------|---------|
| `_bmad/scripts/orchestrator.sh` | Shell script that writes to CSV |
| `docs/sprint-runner.csv` | CSV log file |
| `docs/dashboard.html` | Visualization (parseOrchestratorCSV function) |
| `docs/server.py` | Python HTTP server |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md` | Orchestrator instructions |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/*.md` | Subagent prompts |

---

## Validated Requirements

### 1. Task Granularity (Hybrid Approach)

**Strategy:** Define taxonomy with major phases + critical checkpoints per command.

**Taxonomy file location:** `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml`

**Injection point:** This file will be referenced in `project-context-injection.sh` to inject task taxonomy into discovery files alongside project context.

**Example taxonomy structure:**
```yaml
version: "1.0"
commands:
  create-story:
    phases:
      - id: setup
        description: Initialize story creation context
      - id: read-epic
        description: Read epic file and requirements
      - id: generate-story
        description: Generate story content
      - id: write-file
        description: Write story file to disk
      - id: validate
        description: Validate story structure

  dev-story:
    phases:
      - id: setup
        description: Read story and tech-spec
      - id: implementation
        description: Write code implementation
      - id: tests
        description: Write and run tests
      - id: lint
        description: Run linting and formatting
      - id: validate
        description: Final validation

  code-review:
    phases:
      - id: setup
        description: Load story and code context
      - id: analyze
        description: Analyze code for issues
      - id: fix
        description: Apply fixes to identified issues
      - id: validate
        description: Verify fixes resolved issues
```

### 2. Message Field (7th CSV Column)

**Format:** `timestamp,epicID,storyID,command,task-id,status,message`

**Message requirements:**
- **Required** for both start and end events
- **Maximum length:** 150 characters
- **Escaping:** RFC 4180 compliant (double-quote fields containing commas, escape internal quotes as `""`)

**Start message:** Describes what the task is about to do
- Example: `"Reading epic-2a requirements and extracting story context"`

**End message:** Describes outcome with optional structured suffix
- Format: `Prose text (metric:value, metric:value)`
- Example: `"Story file created successfully (lines:45, sections:5)"`

**Recommended metrics (free-form allowed):**
- `files` - Number of files created/modified
- `lines` - Lines of code/content
- `tests` - Test results (e.g., "12/12 passed")
- `issues` - Issues found/fixed
- `sections` - Document sections

### 3. Dashboard Updates

#### Timeline View
- Messages display **below each command bar** (inline, not tooltip)
- Commands are **expanded by default** (showing all tasks)
- Click command name to **toggle task visibility** (collapse/expand)

#### Activity Log
- Each command is **expandable**
- Expanded view shows:
  - Task list with messages
  - Duration per task
  - Status indicators

### 4. Backward Compatibility

Dashboard must handle both formats:
- **6-column (legacy):** `timestamp,epic,story,cmd,task-id,status`
- **7-column (new):** `timestamp,epic,story,cmd,task-id,status,message`

Detection: Check if line has 6 or 7 fields after proper CSV parsing.

---

## Technical Specifications

### orchestrator.sh Changes

**Current signature:**
```bash
./orchestrator.sh <epic_id> <story_id> <command> <task_id> <status>
```

**New signature:**
```bash
./orchestrator.sh <epic_id> <story_id> <command> <task_id> <status> <message>
```

**Validation rules:**
1. All 6 parameters required
2. `status` must be `"start"` or `"end"`
3. `message` must be non-empty
4. `message` length <= 150 characters (warn if exceeded, truncate)
5. Quote message field with proper CSV escaping

**Output format:**
```bash
echo "${TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${TASK_ID},${STATUS},\"${ESCAPED_MESSAGE}\"" >> "$OUTPUT_FILE"
```

### task-taxonomy.yaml Structure

```yaml
# Task Taxonomy for Sprint Runner Logging
# Version: 1.0
# Location: _bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml

version: "1.0"
description: |
  Defines valid task IDs for sprint-runner logging.
  Subagents MUST use these task IDs when calling orchestrator.sh.

recommended_metrics:
  - key: files
    description: Number of files created or modified
  - key: lines
    description: Lines of code or content
  - key: tests
    description: Test results, e.g., "12/12 passed" or "3 failed"
  - key: issues
    description: Number of issues found or fixed
  - key: sections
    description: Document sections processed

commands:
  create-story:
    description: Creates story file from epic requirements
    phases:
      - id: setup
        description: Initialize context and load epic file
        typical_message_start: "Initializing story creation for {story_id}"
        typical_message_end: "Setup complete (files:1)"
      - id: analyze
        description: Analyze epic requirements for story scope
        typical_message_start: "Analyzing epic requirements"
        typical_message_end: "Requirements analyzed (sections:N)"
      - id: generate
        description: Generate story content and structure
        typical_message_start: "Generating story content"
        typical_message_end: "Story content generated (lines:N)"
      - id: write
        description: Write story file to implementation-artifacts
        typical_message_start: "Writing story file"
        typical_message_end: "Story file written (files:1, lines:N)"
      - id: validate
        description: Validate story structure and completeness
        typical_message_start: "Validating story structure"
        typical_message_end: "Validation passed (sections:N)"

  story-discovery:
    description: Parallel discovery for story context
    phases:
      - id: setup
        description: Load story and project context
        typical_message_start: "Loading discovery context"
        typical_message_end: "Context loaded"
      - id: explore
        description: Explore codebase for relevant patterns
        typical_message_start: "Exploring codebase patterns"
        typical_message_end: "Patterns identified (files:N)"
      - id: write
        description: Write discovery file
        typical_message_start: "Writing discovery file"
        typical_message_end: "Discovery file written (lines:N)"

  story-review:
    description: Review story quality and completeness
    phases:
      - id: setup
        description: Load story and discovery files
        typical_message_start: "Loading story for review"
        typical_message_end: "Files loaded"
      - id: analyze
        description: Analyze story for issues
        typical_message_start: "Analyzing story quality"
        typical_message_end: "Analysis complete (issues:N)"
      - id: fix
        description: Fix identified issues
        typical_message_start: "Fixing identified issues"
        typical_message_end: "Issues fixed (issues:N)"
      - id: validate
        description: Validate fixes
        typical_message_start: "Validating fixes"
        typical_message_end: "Validation passed"

  create-tech-spec:
    description: Creates technical specification for story
    phases:
      - id: setup
        description: Load story and discovery context
        typical_message_start: "Loading tech-spec context"
        typical_message_end: "Context loaded"
      - id: discover
        description: Inline discovery for technical details
        typical_message_start: "Discovering technical requirements"
        typical_message_end: "Discovery complete (files:N)"
      - id: generate
        description: Generate tech-spec content
        typical_message_start: "Generating tech-spec"
        typical_message_end: "Tech-spec generated (sections:N)"
      - id: write
        description: Write tech-spec file
        typical_message_start: "Writing tech-spec file"
        typical_message_end: "Tech-spec written (lines:N)"
      - id: validate
        description: Validate tech-spec completeness
        typical_message_start: "Validating tech-spec"
        typical_message_end: "Validation passed"

  tech-spec-discovery:
    description: Discovery phase for tech-spec (if separate)
    phases:
      - id: setup
        description: Initialize discovery context
        typical_message_start: "Initializing tech-spec discovery"
        typical_message_end: "Setup complete"
      - id: explore
        description: Explore codebase for implementation patterns
        typical_message_start: "Exploring implementation patterns"
        typical_message_end: "Patterns found (files:N)"
      - id: write
        description: Write discovery findings
        typical_message_start: "Writing discovery findings"
        typical_message_end: "Discovery written (lines:N)"

  tech-spec-review:
    description: Review tech-spec quality
    phases:
      - id: setup
        description: Load tech-spec files
        typical_message_start: "Loading tech-spec for review"
        typical_message_end: "Files loaded"
      - id: analyze
        description: Analyze tech-spec completeness
        typical_message_start: "Analyzing tech-spec quality"
        typical_message_end: "Analysis complete (issues:N)"
      - id: fix
        description: Fix identified issues
        typical_message_start: "Fixing tech-spec issues"
        typical_message_end: "Issues fixed"
      - id: validate
        description: Validate fixes
        typical_message_start: "Validating tech-spec fixes"
        typical_message_end: "Validation passed"

  dev-story:
    description: Implement story code
    phases:
      - id: setup
        description: Load story, tech-spec, and context
        typical_message_start: "Loading implementation context"
        typical_message_end: "Context loaded (files:N)"
      - id: implement
        description: Write implementation code
        typical_message_start: "Implementing story code"
        typical_message_end: "Implementation complete (files:N, lines:N)"
      - id: tests
        description: Write and run tests
        typical_message_start: "Writing and running tests"
        typical_message_end: "Tests complete (tests:N passed)"
      - id: lint
        description: Run linting and formatting
        typical_message_start: "Running lint and format"
        typical_message_end: "Lint passed"
      - id: validate
        description: Final validation
        typical_message_start: "Running final validation"
        typical_message_end: "Validation passed"

  code-review:
    description: Review implemented code
    phases:
      - id: setup
        description: Load story code and context
        typical_message_start: "Loading code for review"
        typical_message_end: "Code loaded (files:N)"
      - id: analyze
        description: Analyze code for issues
        typical_message_start: "Analyzing code quality"
        typical_message_end: "Analysis complete (issues:N found)"
      - id: fix
        description: Apply fixes to code
        typical_message_start: "Applying code fixes"
        typical_message_end: "Fixes applied (issues:N fixed)"
      - id: test
        description: Re-run tests after fixes
        typical_message_start: "Re-running tests"
        typical_message_end: "Tests passed (tests:N)"
      - id: validate
        description: Validate all fixes
        typical_message_start: "Validating code review fixes"
        typical_message_end: "Validation passed"
```

### Dashboard parseOrchestratorCSV Changes

**Key modifications:**
1. Parse 7th field as message (handle RFC 4180 quoting)
2. Store message in task objects
3. Render messages below command bars in timeline
4. Add expand/collapse toggle for commands (expanded by default)
5. Show messages in activity log when command expanded

### Subagent Prompt Changes

Each prompt must include:
1. Reference to task-taxonomy.yaml for valid task IDs
2. Instructions to call orchestrator.sh with granular task IDs and messages
3. Examples of proper start/end messages

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| CSV parsing with quoted fields | MEDIUM | LOW | Use proper RFC 4180 parser |
| Backward compatibility | MEDIUM | LOW | Detect field count, handle both formats |
| Subagent prompt bloat | LOW | MEDIUM | Keep taxonomy reference brief, full file in discovery |
| Message truncation data loss | LOW | LOW | Warn in logs, truncate gracefully |
| Inconsistent task IDs | MEDIUM | MEDIUM | Taxonomy provides authoritative list |
| Dashboard performance | LOW | LOW | Message parsing is O(n), minimal overhead |

---

## Migration Plan

### Phase 1: Infrastructure
1. Create `task-taxonomy.yaml`
2. Update `orchestrator.sh` to accept message parameter
3. Update dashboard CSV parser

### Phase 2: Dashboard UI
1. Add message display below command bars
2. Implement command expand/collapse (expanded by default)
3. Add message display in activity log

### Phase 3: Subagent Prompts
1. Update all prompts in `prompts/` directory
2. Add task taxonomy injection to discovery process

### Phase 4: Testing
1. Manual testing with sample logs
2. Verify backward compatibility with existing CSV

---

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `_bmad/scripts/orchestrator.sh` | MODIFY | Add message parameter, CSV escaping |
| `docs/dashboard.html` | MODIFY | Parser + UI changes for messages |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml` | CREATE | New taxonomy file |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story.md` | MODIFY | Add task logging instructions |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story-discovery.md` | MODIFY | Add task logging instructions |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/story-review.md` | MODIFY | Add task logging instructions |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-tech-spec.md` | MODIFY | Add task logging instructions |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/tech-spec-review.md` | MODIFY | Add task logging instructions |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/dev-story.md` | MODIFY | Add task logging instructions |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/code-review.md` | MODIFY | Add task logging instructions |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md` | MODIFY | Update log format documentation |
| `_bmad/scripts/project-context-injection.sh` | MODIFY | Inject task taxonomy |

---

## Acceptance Criteria

1. **orchestrator.sh** accepts 6 parameters including message
2. **CSV output** has 7 columns with properly quoted messages
3. **Dashboard timeline** shows messages below command bars
4. **Dashboard commands** are expandable (expanded by default)
5. **Activity log** shows messages when commands expanded
6. **Backward compatibility** - dashboard handles both 6 and 7 column formats
7. **All subagent prompts** include task logging instructions
8. **Task taxonomy** file created and documented

---

## Appendix: Example CSV Output

**New format:**
```csv
1769178243,2b,2b-6,create-story,setup,start,"Initializing story creation for 2b-6"
1769178245,2b,2b-6,create-story,setup,end,"Setup complete (files:1)"
1769178246,2b,2b-6,create-story,analyze,start,"Analyzing epic requirements"
1769178260,2b,2b-6,create-story,analyze,end,"Requirements analyzed (sections:4)"
1769178261,2b,2b-6,create-story,generate,start,"Generating story content"
1769178300,2b,2b-6,create-story,generate,end,"Story content generated (lines:85)"
1769178301,2b,2b-6,create-story,write,start,"Writing story file"
1769178305,2b,2b-6,create-story,write,end,"Story file written (files:1, lines:85)"
1769178306,2b,2b-6,create-story,validate,start,"Validating story structure"
1769178310,2b,2b-6,create-story,validate,end,"Validation passed (sections:5)"
```
