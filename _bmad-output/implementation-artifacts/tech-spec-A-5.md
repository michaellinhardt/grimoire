# Tech Spec: Story A-5 - Sprint Log Shell Script

## Overview

This tech spec defines the implementation of `sprint-log.sh`, a shell script that subagents call directly to log events during sprint execution. This eliminates the need for orchestrator stdout parsing and provides reliable, atomic logging.

## Story Reference

**Story:** A-5 - Sprint Log Shell Script
**Epic:** A - Orchestrator Infrastructure
**PRD:** Sprint Runner v3 Optimization

## Requirements Summary

From the story acceptance criteria:

1. Script accepts a single JSON string argument
2. JSON is validated for required fields: `epic_id`, `story_id`, `command`, `task_id`, `status`
3. Optional fields: `message`, `metrics`, `attempt`
4. Event is appended to sprint log file
5. Log format: `timestamp | epic_id | story_id | command | task_id | status | message`
6. Location: `_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh`

## Technical Design

### Script Location

```
_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh
```

### Log File Location

```
_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/sprint.log
```

The log file is placed in the `dashboard/` directory so it can be easily accessed by the dashboard UI for real-time monitoring.

### Usage Pattern

```bash
_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh '{"epic_id":"2a","story_id":"2a-1","command":"create-story","task_id":"setup","status":"start","message":"Initializing"}'
```

### JSON Schema

**Required fields:**
| Field | Type | Description |
|-------|------|-------------|
| `epic_id` | string | Epic identifier (e.g., "2a", "A") |
| `story_id` | string | Story identifier (e.g., "2a-1", "A-5") |
| `command` | string | Sprint command name (e.g., "create-story", "dev-story") |
| `task_id` | string | Task phase identifier (e.g., "setup", "analyze", "write") |
| `status` | string | Status indicator (e.g., "start", "complete", "error") |

**Optional fields:**
| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Human-readable message (default: empty) |
| `metrics` | object | Performance metrics (future use) |
| `attempt` | number | Retry attempt number for code-review |

### Log Entry Format

```
[YYYY-MM-DD HH:MM:SS] [epic_id/story_id] [command:task_id] [status] message
```

Example:
```
[2026-01-24 14:30:45] [2a/2a-1] [create-story:setup] [start] Initializing story creation
[2026-01-24 14:30:47] [2a/2a-1] [create-story:analyze] [start] Analyzing requirements
[2026-01-24 14:31:02] [2a/2a-1] [create-story:write] [complete] Story file written
```

### Implementation Details

#### JSON Parsing

Use `jq` for reliable JSON parsing. The script requires `jq` to be installed on the system.

```bash
EPIC_ID=$(echo "$JSON" | jq -r '.epic_id // "unknown"')
```

The `// "unknown"` syntax provides a default value if the field is missing.

#### Atomic Writes

The script uses `>>` append operator which is atomic for single-line writes on POSIX systems. This ensures log integrity even with concurrent subagent logging.

#### Path Resolution

The script resolves paths relative to its own location using:

```bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

This ensures the script works correctly regardless of the working directory from which it's called.

#### Error Handling

- Missing JSON argument: Exit with error code 1, print usage to stderr
- Invalid JSON: `jq` will fail, fields default to "unknown"
- Missing log directory: Created automatically with `mkdir -p`

### Task IDs by Command

Per task-taxonomy.yaml, valid task IDs for each command:

| Command | Task IDs |
|---------|----------|
| sprint-create-story | setup, analyze, generate, write, validate |
| sprint-create-story-discovery | setup, explore, write |
| sprint-story-review | setup, analyze, fix, validate |
| sprint-create-tech-spec | setup, discover, generate, write, validate |
| sprint-tech-spec-review | setup, analyze, fix, validate |
| sprint-dev-story | setup, implement, tests, lint, validate |
| sprint-code-review | setup, analyze, fix, validate |
| sprint-commit | setup, stage, commit, validate |

### Status Values

Standard status values:
- `start` - Task beginning
- `complete` - Task finished successfully
- `error` - Task failed
- `skip` - Task skipped
- `retry` - Task being retried

## File List

**Create:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh`

**Modify:** None

## Testing Strategy

### Manual Testing

```bash
# Test basic logging
./scripts/sprint-log.sh '{"epic_id":"test","story_id":"test-1","command":"test-cmd","task_id":"setup","status":"start","message":"Test message"}'

# Verify log entry
tail -1 ./dashboard/sprint.log

# Test with missing optional message
./scripts/sprint-log.sh '{"epic_id":"test","story_id":"test-1","command":"test-cmd","task_id":"setup","status":"complete"}'

# Test error handling - missing argument
./scripts/sprint-log.sh
# Should print error and exit 1
```

### Verification

1. Script is executable (`chmod +x`)
2. Log file is created in correct location
3. Log format matches specification
4. Timestamps are accurate
5. Fields default correctly when missing

## Dependencies

- `bash` - Shell interpreter
- `jq` - JSON parser (required)
- `date` - Timestamp generation (standard Unix)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `jq` not installed | Error message guides user to install |
| Concurrent writes | Atomic append operation |
| Log file grows large | Future: log rotation (out of scope) |
| Invalid JSON input | Default values prevent script failure |

## Implementation Checklist

- [ ] Create `scripts/` directory
- [ ] Create `sprint-log.sh` script
- [ ] Set executable permissions
- [ ] Test with valid JSON
- [ ] Test with missing fields
- [ ] Test error handling
- [ ] Verify log format
