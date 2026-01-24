# Story 5-SR-3: Python Orchestrator Core Loop

Status: review

## Story

As an **operator**,
I want **the orchestrator to execute the sprint workflow deterministically**,
So that **sprint execution follows `instructions.md` exactly without LLM interpretation variance**.

## Acceptance Criteria

1. **Given** the orchestrator is started with a batch size
   **When** the main loop executes
   **Then** the workflow follows `instructions.md` steps exactly:
   - Check project-context.md status
   - Read sprint-status.yaml
   - Filter and sort stories (exclude `epic-*`, `*-retrospective`)
   - Find next non-done, non-blocked story
   - Pair stories from same epic if available
   - Execute create-story + story-discovery in parallel
   - Execute story-review-1, spawn background chain if critical issues
   - Execute tech-spec if needed, then tech-spec-review-1 with same background logic
   - Execute dev-story + code-review loop per story
   - Execute batch-commit for completed stories
   - Increment cycle counter, check batch size

2. **Given** a command needs to be executed
   **When** spawning a Claude CLI subagent
   **Then** the orchestrator uses `asyncio.subprocess.create_subprocess_exec`
   **And** the command is `claude -p --output-format stream-json`
   **And** the appropriate prompt file is passed via stdin
   **And** stdout is parsed for NDJSON events

3. **Given** the Claude CLI outputs NDJSON
   **When** parsing the stream
   **Then** task-id events are captured (from task-taxonomy.yaml phases)
   **And** each event triggers a database event record
   **And** each event triggers a WebSocket emission (if connected)

4. **Given** a story transitions status
   **When** the status changes (backlog -> in-progress -> done/blocked)
   **Then** the database is updated
   **And** sprint-status.yaml is updated
   **And** a story:status WebSocket event is emitted

5. **Given** batch_mode is "all"
   **When** all stories are done or blocked
   **Then** the orchestrator stops naturally

6. **Given** batch_mode is a number
   **When** cycles_completed >= max_cycles
   **Then** the orchestrator pauses and emits batch:end event

## Tasks / Subtasks

- [x] Task 1: Create orchestrator.py scaffold (AC: #1)
  - [x] 1.1: Create `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`
  - [x] 1.2: Define main `Orchestrator` class with `__init__`, `start()`, `stop()` methods
  - [x] 1.3: Add command-line argument parsing for batch_size (number or "all")
  - [x] 1.4: Import db.py module for database operations
  - [x] 1.5: Import aiohttp WebSocket broadcast function from server.py

- [x] Task 2: Implement project context check (AC: #1, Step 0)
  - [x] 2.1: Add `check_project_context()` async method
  - [x] 2.2: Check if `_bmad-output/planning-artifacts/project-context.md` exists
  - [x] 2.3: Check file modification time (24-hour freshness threshold)
  - [x] 2.4: If missing: spawn `/generate-project-context` and WAIT for completion
  - [x] 2.5: If expired: spawn `/generate-project-context` in BACKGROUND (no wait)
  - [x] 2.6: Log context:create or context:refresh events

- [x] Task 3: Implement sprint-status.yaml reading and story selection (AC: #1, Steps 1-2)
  - [x] 3.1: Add `read_sprint_status()` method using pyyaml
  - [x] 3.2: Filter stories: exclude `epic-*` and `*-retrospective` keys
  - [x] 3.3: Sort stories numerically (1-1, 1-2, 2-1, 2a-1, etc.)
  - [x] 3.4: Find first non-done, non-blocked story
  - [x] 3.5: Implement story pairing logic (pair from same epic prefix)
  - [x] 3.6: Extract epic_id from story_key (everything before last dash)

- [x] Task 4: Implement Claude CLI spawning with asyncio.subprocess (AC: #2)
  - [x] 4.1: Create `spawn_subagent(prompt: str, prompt_file: str)` async method
  - [x] 4.2: Use `asyncio.subprocess.create_subprocess_exec` with `claude` executable
  - [x] 4.3: Build args: `-p`, `--output-format`, `stream-json`
  - [x] 4.4: Set up stdin/stdout/stderr as PIPE
  - [x] 4.5: Write prompt to stdin, then close stdin
  - [x] 4.6: Handle process environment (inherit PATH for claude)

- [x] Task 5: Implement NDJSON stream parsing (AC: #3)
  - [x] 5.1: Create `parse_ndjson_stream(process)` async generator
  - [x] 5.2: Read stdout line by line using `readline()` or async iteration
  - [x] 5.3: Parse each JSON line with try/except for malformed lines
  - [x] 5.4: Extract task-id events from parsed JSON (match task-taxonomy.yaml phases)
  - [x] 5.5: Yield parsed events for caller to handle
  - [x] 5.6: Handle stream end gracefully

- [x] Task 6: Implement database event logging (AC: #3, #4)
  - [x] 6.1: Call `db.create_event()` for each parsed event
  - [x] 6.2: Include: batch_id, story_id, command_id, timestamp, task_id, status, message
  - [x] 6.3: Call `db.update_story()` when story status changes
  - [x] 6.4: Ensure atomic updates (use db connection as context manager)

- [x] Task 7: Implement WebSocket event emission (AC: #3, #4)
  - [x] 7.1: Create `emit_event(event_type: str, payload: dict)` method
  - [x] 7.2: Broadcast to all connected WebSocket clients via server module
  - [x] 7.3: Emit command:start, command:progress, command:end events
  - [x] 7.4: Emit story:status events on story transitions
  - [x] 7.5: Handle case when no WebSocket clients connected (no-op)

- [x] Task 8: Implement sprint-status.yaml updates (AC: #4)
  - [x] 8.1: Create `update_sprint_status(story_key: str, new_status: str)` method
  - [x] 8.2: Read YAML, update specific key, write back (preserve comments if possible)
  - [x] 8.3: Use ruamel.yaml for comment-preserving round-trip if available, else pyyaml
  - [x] 8.4: Handle file locking to prevent concurrent write corruption

- [x] Task 9: Implement main orchestration loop (AC: #1, #5, #6)
  - [x] 9.1: Implement Step 0: project context check
  - [x] 9.2: Implement Step 1: read sprint-status, select stories
  - [x] 9.3: Implement Step 2: create-story + discovery (parallel via asyncio.gather)
  - [x] 9.4: Implement Step 2b: story-review-1, background chain if critical issues
  - [x] 9.5: Implement Step 3: create-tech-spec (conditional on tech_spec_needed)
  - [x] 9.6: Implement Step 3b: tech-spec-review-1, background chain if critical issues
  - [x] 9.7: Implement Step 4: dev-story + code-review loop (sequential per story)
  - [x] 9.8: Implement Step 4c: batch-commit workflow call
  - [x] 9.9: Implement Step 6: cycle tracking and batch completion

- [x] Task 10: Implement batch control (AC: #5, #6)
  - [x] 10.1: Add `batch_mode` attribute ("all" or "fixed")
  - [x] 10.2: Add `max_cycles` and `cycles_completed` counters
  - [x] 10.3: Implement "all" mode: loop until all stories done/blocked
  - [x] 10.4: Implement "fixed" mode: pause when cycles_completed >= max_cycles
  - [x] 10.5: Emit batch:start and batch:end events
  - [x] 10.6: Handle graceful stop request (complete current command, then exit)

## Dev Notes

### Critical Architecture: Follow instructions.md Exactly

The orchestrator MUST implement the exact workflow defined in `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`. This includes:

1. **Step 0**: Project context check (create if missing, refresh in background if expired)
2. **Step 1**: Read sprint-status.yaml, filter, sort, select 1-2 stories
3. **Step 2**: Parallel create-story + story-discovery
4. **Step 2b**: story-review-1, fork background chain if critical
5. **Step 3**: create-tech-spec (conditional)
6. **Step 3b**: tech-spec-review-1, fork background chain if critical
7. **Step 4**: Sequential dev-story + code-review loop per story
8. **Step 4c**: batch-commit workflow
9. **Step 6**: Cycle tracking and batch completion

### Claude CLI Invocation Pattern

Based on existing Grimoire patterns in `src/main/sessions/cc-spawner.ts`:

```python
import asyncio
import json
import os

async def spawn_subagent(prompt: str, prompt_file: str) -> dict:
    """Spawn Claude CLI subagent and parse NDJSON output."""

    # Build command
    args = [
        'claude',
        '-p',
        '--output-format', 'stream-json',
    ]

    # Spawn process
    process = await asyncio.subprocess.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=os.environ.copy()  # Inherit PATH
    )

    # Send prompt via stdin
    stdout, stderr = await process.communicate(input=prompt.encode())

    # Parse NDJSON (line by line)
    results = []
    for line in stdout.decode().splitlines():
        if line.strip():
            try:
                event = json.loads(line)
                results.append(event)
            except json.JSONDecodeError:
                pass  # Skip malformed lines

    return results
```

### NDJSON Parsing for task-id Events

The orchestrator needs to capture task-id events as defined in `task-taxonomy.yaml`. Example phases per command:

| Command | Task IDs |
|---------|----------|
| create-story | setup, analyze, generate, write, validate |
| story-discovery | setup, explore, write |
| story-review | setup, analyze, fix, validate |
| create-tech-spec | setup, discover, generate, write, validate |
| tech-spec-review | setup, analyze, fix, validate |
| dev-story | setup, implement, tests, lint, validate |
| code-review | setup, analyze, fix, test, validate |

### Story Pairing Logic (from instructions.md)

```python
def pair_stories(stories: list[str]) -> list[str]:
    """Pair up to 2 stories from same epic prefix."""
    if not stories:
        return []

    first = stories[0]
    # Extract epic prefix (everything before last dash)
    # "2a-1-name" -> "2a-1" -> epic "2a"
    parts = first.rsplit('-', 1)
    if len(parts) > 1:
        epic_prefix = parts[0].rsplit('-', 1)[0] if '-' in parts[0] else parts[0]
    else:
        epic_prefix = first

    # Find second story with same epic
    for i, story in enumerate(stories[1:], 1):
        story_epic = story.rsplit('-', 1)[0].rsplit('-', 1)[0] if '-' in story.rsplit('-', 1)[0] else story.rsplit('-', 1)[0]
        if story_epic == epic_prefix:
            return [first, story]

    return [first]  # No pair available
```

### Parallel Execution with asyncio.gather

```python
async def execute_create_story_phase(story_keys: list[str]):
    """Execute create-story + discovery in parallel."""

    # Substitute prompt variables
    create_prompt = load_prompt('create-story.md').replace('{{story_key}}', ','.join(story_keys))
    discovery_prompt = load_prompt('create-story-discovery.md').replace('{{story_key}}', ','.join(story_keys))

    # Run both in parallel
    create_task = asyncio.create_task(spawn_subagent(create_prompt, 'create-story'))
    discovery_task = asyncio.create_task(spawn_subagent(discovery_prompt, 'story-discovery'))

    create_result, discovery_result = await asyncio.gather(create_task, discovery_task)

    return create_result, discovery_result
```

### Background Task Spawning (fire-and-forget)

For review-2/3 chains that should run in background:

```python
async def spawn_background_review_chain(story_keys: list[str], review_type: str):
    """Spawn background review chain (does not block main flow)."""

    # Create background task
    task = asyncio.create_task(
        run_review_chain(story_keys, review_type, start_attempt=2)
    )

    # Track in database but don't await
    db.create_background_task(
        batch_id=current_batch_id,
        story_key=','.join(story_keys),
        task_type=f'{review_type}-chain'
    )

    # Fire and forget - main loop continues
    return task
```

### WebSocket Event Format (from epic context)

```python
def emit_event(event_type: str, payload: dict):
    """Emit WebSocket event to all connected clients."""
    event = {
        "type": event_type,
        "payload": payload
    }
    # Use aiohttp WebSocket broadcast from server.py
    asyncio.create_task(broadcast_websocket(json.dumps(event)))
```

Event types:
- `batch:start` - `{ batch_id, max_cycles }`
- `batch:end` - `{ batch_id, cycles_completed, status }`
- `cycle:start` - `{ cycle_number, story_keys }`
- `cycle:end` - `{ cycle_number, completed_stories }`
- `command:start` - `{ story_key, command, task_id }`
- `command:progress` - `{ story_key, command, task_id, message }`
- `command:end` - `{ story_key, command, task_id, status, metrics }`
- `story:status` - `{ story_key, old_status, new_status }`
- `error` - `{ type, message, context }`

### sprint-status.yaml Update Pattern

```python
import yaml
from pathlib import Path

def update_sprint_status(story_key: str, new_status: str):
    """Update story status in sprint-status.yaml."""
    status_file = Path('_bmad-output/implementation-artifacts/sprint-status.yaml')

    # Read current state
    with open(status_file, 'r') as f:
        data = yaml.safe_load(f)

    # Update status
    if 'development_status' in data and story_key in data['development_status']:
        old_status = data['development_status'][story_key]
        data['development_status'][story_key] = new_status

        # Write back
        with open(status_file, 'w') as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)

        # Emit WebSocket event
        emit_event('story:status', {
            'story_key': story_key,
            'old_status': old_status,
            'new_status': new_status
        })
```

### Error Handling and Blocking Logic (from instructions.md)

- **3 consecutive same errors**: Mark story as "blocked" and skip
- **ZERO issues in code-review**: Mark story as "done"
- **No CRITICAL after 3 reviews**: Mark story as "done" (non-critical may remain)
- **10 review hard limit**: Mark story as "blocked"

### File Locations (Story 5-SR-1 completed)

After Story 5-SR-1 completes file relocation:
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (create)
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` (existing, relocated)
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py` (from Story 5-SR-2)
- `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/*.md` (existing prompt files)

### Dependencies

This story depends on:
- **5-SR-1**: Folder structure (dashboard folder exists)
- **5-SR-2**: Database module (db.py with CRUD operations)

These must be completed first or the orchestrator will fail to import db.py and find files.

### Project Structure Notes

- Python scripts are standalone, not part of Electron/npm build
- Uses Python 3.9+ with asyncio for async subprocess management
- Imports db.py module from same dashboard folder
- Integrates with server.py for WebSocket broadcast function

### Testing Approach

1. **Unit tests**: Mock subprocess, test NDJSON parsing
2. **Integration test**: Run with mock Claude CLI that returns canned NDJSON
3. **Manual verification**: Run actual workflow with 1 cycle

### References

- [Source: _bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md] - Canonical workflow logic
- [Source: _bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml] - Task ID definitions
- [Source: _bmad-output/planning-artifacts/epic-5-sprint-runner-dashboard.md#Story 5-SR-3]
- [Source: _bmad-output/planning-artifacts/epic-5-sprint-runner-dashboard-context.md]
- [Source: src/main/sessions/cc-spawner.ts] - Reference for CC spawning patterns
- [Source: src/main/sessions/stream-parser.ts] - Reference for NDJSON parsing patterns

## Tech-Spec Decision

[TECH-SPEC-DECISION: REQUIRED]

This story involves complex orchestration logic that needs detailed specification:
- asyncio.subprocess spawning patterns
- NDJSON parsing state machine
- Parallel vs sequential execution coordination
- Background task management
- Error handling and retry logic
- Database and WebSocket integration points

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - Implementation proceeded without significant debugging issues.

### Completion Notes List

1. **Task 1 Complete**: Created `orchestrator.py` with 650+ lines implementing the full Orchestrator class with OrchestratorState enum, __init__, start(), stop() methods, and argparse CLI entry point.

2. **Task 2 Complete**: Implemented `check_project_context()` async method that checks for project-context.md existence and 24-hour freshness threshold, spawning subagent to regenerate if needed.

3. **Task 3 Complete**: Implemented `read_sprint_status()`, `select_stories()`, `_extract_epic()`, and `_story_sort_key()` methods for proper story selection with epic pairing. Fixed epic extraction regex to handle story keys like "2a-1-first" correctly.

4. **Task 4 Complete**: Implemented `spawn_subagent()` async method using `asyncio.subprocess.create_subprocess_exec` with claude CLI args, stdin/stdout PIPE, prompt via stdin, and support for wait/fire-and-forget modes.

5. **Task 5 Complete**: Implemented `_parse_ndjson_stream()` async generator that reads stdout line-by-line, parses JSON with try/except, and `_parse_csv_log_line()` for orchestrator.sh CSV format extraction.

6. **Task 6 Complete**: Implemented `_handle_stream_event()` that calls db.create_event() for task events extracted from stream, updates story status via db.update_story() on transitions.

7. **Task 7 Complete**: Implemented `emit_event()` method that constructs WebSocket event format and calls broadcast_websocket via asyncio.create_task (gracefully handles failures).

8. **Task 8 Complete**: Implemented `update_sprint_status()` that reads/updates/writes sprint-status.yaml via pyyaml, emits story:status WebSocket events, and updates database.

9. **Task 9 Complete**: Implemented `run_cycle()` orchestration loop with all workflow steps: _execute_create_story_phase (parallel), _execute_story_review_phase (background chain), _execute_tech_spec_phase, _execute_tech_spec_review_phase, _execute_dev_phase, _execute_code_review_loop, _execute_batch_commit.

10. **Task 10 Complete**: Implemented batch control with batch_mode ("all"/"fixed"), max_cycles counter, cycle tracking, graceful stop via stop_requested flag, batch:start/batch:end events.

### File List

- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (created - 660 lines)
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/test_orchestrator.py` (created - 560 lines, 50 tests)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified - status update)
- `_bmad-output/implementation-artifacts/story-5-sr-3.md` (modified - task completion)

### Change Log

- 2026-01-24: Created orchestrator.py implementing all 10 tasks with 50 passing tests covering story selection, epic extraction, CSV parsing, tech-spec decision parsing, error pattern detection, severity parsing, sprint status updates, and batch control.
