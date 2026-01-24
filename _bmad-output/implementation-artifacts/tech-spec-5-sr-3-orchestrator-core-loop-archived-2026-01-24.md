---
title: 'Python Orchestrator Core Loop'
slug: '5-sr-3-orchestrator-core-loop'
created: '2026-01-24'
status: 'in-progress'
stepsCompleted: [1]
tech_stack:
  - Python 3.9+
  - asyncio
  - aiohttp (WebSocket client)
  - pyyaml
  - sqlite3
files_to_modify:
  - '_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py'
code_patterns:
  - asyncio.subprocess.create_subprocess_exec
  - NDJSON line-by-line parsing
  - asyncio.gather for parallel tasks
  - asyncio.create_task for background tasks
test_patterns:
  - Mock subprocess for unit tests
  - Integration test with mock Claude CLI
---

# Tech-Spec: Python Orchestrator Core Loop

**Created:** 2026-01-24
**Story:** 5-SR-3

## Overview

### Problem Statement

The current sprint-runner workflow relies on LLM interpretation of `instructions.md`, which introduces variance in execution. Different agent instances may interpret workflow steps differently, leading to inconsistent results. We need a deterministic Python-based orchestrator that executes the workflow exactly as defined, eliminating interpretation variability.

### Solution

Implement a Python orchestrator using asyncio that:
1. Reads workflow state from `sprint-status.yaml`
2. Spawns Claude CLI subagents via `asyncio.subprocess`
3. Parses NDJSON output streams to capture task-id events
4. Updates state in SQLite database (via db.py module)
5. Emits WebSocket events for real-time dashboard updates
6. Follows `instructions.md` workflow steps exactly

### Scope

**In Scope:**
- Main orchestrator class (`Orchestrator`) with start/stop lifecycle
- Command-line argument parsing (batch_size: number or "all")
- Project context check (Step 0)
- Sprint-status.yaml reading and story selection (Step 1)
- Create-story + discovery parallel execution (Step 2)
- Story review with background chain spawning (Step 2b)
- Tech-spec creation and review (Steps 3, 3b)
- Dev-story + code-review loop (Step 4)
- Batch-commit triggering (Step 4c)
- Cycle tracking and batch completion (Step 6)
- Error recovery patterns (Step 5)
- NDJSON stream parsing for task-id events
- Database event logging
- WebSocket event emission
- sprint-status.yaml updates

**Out of Scope:**
- Dashboard UI (Story 5-SR-6)
- WebSocket server implementation (Story 5-SR-5)
- Database schema creation (Story 5-SR-2)
- File relocation (Story 5-SR-1)
- Dashboard HTML enhancements (Story 5-SR-7)

## Context for Development

### Codebase Patterns

**Existing TypeScript Patterns (for reference):**
- `src/main/sessions/cc-spawner.ts` - Shows Claude CLI spawning with proper argument handling
- `src/main/sessions/stream-parser.ts` - Shows NDJSON parsing using readline interface

**Python Equivalents:**
- Use `asyncio.subprocess.create_subprocess_exec` instead of Node's `spawn`
- Use async generator with `readline()` for NDJSON parsing
- Use `asyncio.gather` for parallel task execution
- Use `asyncio.create_task` for fire-and-forget background tasks

**Project Context Rules:**
- Python scripts are standalone, not part of Electron/npm build
- Uses Python 3.9+ with asyncio
- All paths should be relative to project root or use absolute paths
- sprint-status.yaml is the source of truth for workflow state

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md` | Canonical workflow logic |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml` | Valid task-id definitions per command |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/*.md` | Subagent prompt templates |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Sprint state source of truth |
| `_bmad-output/planning-artifacts/project-context.md` | Project context file to check |
| `src/main/sessions/cc-spawner.ts` | Reference for CLI spawning patterns |
| `src/main/sessions/stream-parser.ts` | Reference for NDJSON parsing patterns |

### Technical Decisions

**TD-1: Main Loop Architecture**
- Use `asyncio` event loop as the foundation
- Orchestrator class with async `start()` and `stop()` methods
- State machine: `idle` -> `running_cycle` -> `waiting_child` -> `running_cycle` -> `idle`
- Graceful shutdown via `asyncio.Event` flag

**TD-2: Claude CLI Invocation Pattern**
- Command: `claude -p --output-format stream-json`
- Prompt passed via stdin (not as argument)
- No `--input-format stream-json` (we send plain text prompts)
- Inherit PATH from environment for claude executable location

**TD-3: NDJSON Stream Parsing**
- Line-by-line async reading with `process.stdout.readline()`
- Async generator pattern for yielding parsed events
- Try/except for malformed JSON lines (skip silently)
- Extract task-id from message content matching task-taxonomy.yaml phases

**TD-4: Task-ID Pattern Matching**
- Parse NDJSON for orchestrator.sh calls in tool output
- Extract: epicID, storyID, command, task-id, status, message
- Match task-id against task-taxonomy.yaml valid phases
- Log to database and emit to WebSocket

**TD-5: Parallel Execution Strategy**
- Step 2: Use `asyncio.gather(create_story_task, discovery_task)` for parallel
- Review chains: Use `asyncio.create_task()` for fire-and-forget background
- Step 4: Sequential within story, but stories could be parallelized in future

**TD-6: Background Task Spawning**
- Review-2/3 chains spawned as background tasks
- Tracked in `background_tasks` database table
- Use `asyncio.create_task()` - does not block main flow
- Background tasks update files but NOT sprint-status.yaml

**TD-7: State Machine States**
```
IDLE -> STARTING -> RUNNING_CYCLE -> WAITING_CHILD -> RUNNING_CYCLE -> STOPPING -> IDLE
                                       |                                    ^
                                       +------------------------------------+
                                       (on stop request: complete current, then stop)
```

**TD-8: Error Handling**
- 3 consecutive same errors: Mark story "blocked", continue to next
- ZERO issues in code-review: Mark story "done"
- No CRITICAL after 3 reviews: Mark story "done"
- 10 review hard limit: Mark story "blocked"
- Unexpected errors: Log, try to continue from current state

**TD-9: Graceful Shutdown**
- Set stop_requested flag
- Complete current command (don't kill mid-execution)
- Don't start new commands/stories
- Emit batch:end with status "stopped"
- Save state to database for resume

## Implementation Plan

### Tasks

#### Task 1: Create orchestrator.py scaffold

**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

```python
#!/usr/bin/env python3
"""
Sprint Runner Orchestrator - Deterministic workflow automation.

Implements the workflow defined in instructions.md without LLM interpretation.
"""

import asyncio
import argparse
import json
import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, AsyncGenerator
from dataclasses import dataclass, field
from enum import Enum

# Import db module (from Story 5-SR-2)
from db import (
    create_batch, update_batch, get_active_batch,
    create_story, update_story,
    create_command, update_command,
    create_event, create_background_task, update_background_task
)

# Import server module for WebSocket broadcast
from server import broadcast_websocket

# ... rest of implementation
```

**Subtasks:**
- 1.1: Create file with shebang and docstring
- 1.2: Define imports (asyncio, json, os, pathlib, dataclasses, enum)
- 1.3: Define `OrchestratorState` enum (IDLE, STARTING, RUNNING_CYCLE, WAITING_CHILD, STOPPING)
- 1.4: Define `Orchestrator` class with `__init__`, `start()`, `stop()` methods
- 1.5: Add command-line argument parsing for batch_size
- 1.6: Import db.py module (dependency from Story 5-SR-2)
- 1.7: Import broadcast_websocket from server.py

#### Task 2: Implement project context check (Step 0)

```python
async def check_project_context(self) -> None:
    """Check and refresh project context if needed."""
    context_path = Path(self.project_root) / '_bmad-output/planning-artifacts/project-context.md'

    if not context_path.exists():
        # Missing: spawn and WAIT
        self.emit_event('context:create', {'status': 'starting'})
        await self.spawn_subagent(
            prompt=self.load_prompt('generate-project-context'),
            wait=True
        )
        self.emit_event('context:create', {'status': 'complete'})
    else:
        # Check freshness (24 hour threshold)
        mtime = datetime.fromtimestamp(context_path.stat().st_mtime)
        if datetime.now() - mtime > timedelta(hours=24):
            # Expired: spawn in BACKGROUND (no wait)
            self.emit_event('context:refresh', {'status': 'starting'})
            asyncio.create_task(self.spawn_subagent(
                prompt=self.load_prompt('generate-project-context'),
                wait=False,
                is_background=True
            ))
        else:
            # Fresh: skip
            pass
```

**Subtasks:**
- 2.1: Add `check_project_context()` async method
- 2.2: Check if `_bmad-output/planning-artifacts/project-context.md` exists
- 2.3: Check file modification time (24-hour freshness threshold)
- 2.4: If missing: spawn `/generate-project-context` and WAIT for completion
- 2.5: If expired: spawn `/generate-project-context` in BACKGROUND (no wait)
- 2.6: Emit context:create or context:refresh events

#### Task 3: Implement sprint-status.yaml reading and story selection (Step 1)

```python
import yaml

def read_sprint_status(self) -> dict:
    """Read and parse sprint-status.yaml."""
    status_path = Path(self.project_root) / '_bmad-output/implementation-artifacts/sprint-status.yaml'
    with open(status_path, 'r') as f:
        return yaml.safe_load(f)

def select_stories(self, status: dict) -> list[str]:
    """Select next 1-2 stories for processing."""
    dev_status = status.get('development_status', {})

    # Filter: exclude epic-* and *-retrospective
    stories = [
        key for key in dev_status.keys()
        if not key.startswith('epic-') and not key.endswith('-retrospective')
    ]

    # Filter: exclude done and blocked
    available = [
        key for key in stories
        if dev_status[key] not in ('done', 'blocked')
    ]

    # Sort numerically (1-1, 1-2, 2-1, 2a-1, etc.)
    available.sort(key=self._story_sort_key)

    if not available:
        return []

    # Pairing logic: try to pair from same epic
    first = available[0]
    first_epic = self._extract_epic(first)

    for story in available[1:]:
        if self._extract_epic(story) == first_epic:
            return [first, story]

    return [first]

def _extract_epic(self, story_key: str) -> str:
    """Extract epic prefix from story key (everything before last dash)."""
    parts = story_key.rsplit('-', 1)
    return parts[0] if len(parts) > 1 else story_key

def _story_sort_key(self, key: str) -> tuple:
    """Sort key for numeric story ordering."""
    # Handle patterns like: 1-1, 2-3, 2a-1, 3b-2
    import re
    match = re.match(r'(\d+)([a-z])?-(\d+)', key)
    if match:
        major = int(match.group(1))
        minor_letter = match.group(2) or ''
        story_num = int(match.group(3))
        return (major, minor_letter, story_num)
    return (999, '', 999)  # Fallback for unexpected format
```

**Subtasks:**
- 3.1: Add `read_sprint_status()` method using pyyaml
- 3.2: Add `select_stories()` method with filtering (exclude epic-*, *-retrospective)
- 3.3: Implement numeric sorting for story keys
- 3.4: Implement `_extract_epic()` helper
- 3.5: Implement story pairing logic (pair from same epic prefix)
- 3.6: Return list of 1-2 story keys

#### Task 4: Implement Claude CLI spawning

```python
async def spawn_subagent(
    self,
    prompt: str,
    prompt_name: str = 'unknown',
    wait: bool = True,
    is_background: bool = False
) -> dict:
    """
    Spawn Claude CLI subagent and optionally wait for completion.

    Args:
        prompt: The prompt text to send via stdin
        prompt_name: Name for logging (e.g., 'create-story', 'code-review-1')
        wait: If True, await completion. If False, fire-and-forget.
        is_background: If True, track in background_tasks table

    Returns:
        Parsed results dict (only if wait=True)
    """
    args = [
        'claude',
        '-p',
        '--output-format', 'stream-json',
    ]

    process = await asyncio.subprocess.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=os.environ.copy(),
        cwd=self.project_root
    )

    # Send prompt via stdin
    process.stdin.write(prompt.encode())
    await process.stdin.drain()
    process.stdin.close()

    if wait:
        # Parse NDJSON stream and collect results
        results = []
        async for event in self.parse_ndjson_stream(process):
            results.append(event)
            # Log to database and emit WebSocket
            self.handle_stream_event(event)

        await process.wait()
        return {'events': results, 'exit_code': process.returncode}
    else:
        # Fire and forget - track as background task
        if is_background:
            create_background_task(
                batch_id=self.current_batch_id,
                story_key=self.current_story_key,
                task_type=prompt_name
            )
        return {}
```

**Subtasks:**
- 4.1: Create `spawn_subagent()` async method
- 4.2: Build args: `claude`, `-p`, `--output-format`, `stream-json`
- 4.3: Use `asyncio.subprocess.create_subprocess_exec` with stdin/stdout/stderr as PIPE
- 4.4: Write prompt to stdin, drain, close
- 4.5: Handle wait vs fire-and-forget modes
- 4.6: Track background tasks in database

#### Task 5: Implement NDJSON stream parsing

```python
async def parse_ndjson_stream(
    self,
    process: asyncio.subprocess.Process
) -> AsyncGenerator[dict, None]:
    """
    Parse NDJSON from subprocess stdout line by line.

    Yields:
        Parsed JSON events from the stream
    """
    while True:
        line = await process.stdout.readline()
        if not line:
            break

        line_str = line.decode().strip()
        if not line_str:
            continue

        try:
            event = json.loads(line_str)
            yield event
        except json.JSONDecodeError:
            # Skip malformed lines
            pass

def extract_task_id(self, event: dict) -> Optional[dict]:
    """
    Extract task-id information from stream event.

    Looks for orchestrator.sh calls in tool output and parses:
    - epicID
    - storyID
    - command
    - task-id
    - status
    - message
    """
    # Check for tool_result events that contain orchestrator.sh output
    if event.get('type') == 'tool_result':
        content = event.get('content', '')
        # Parse for orchestrator.sh pattern
        # Format: timestamp,epicID,storyID,command,task-id,status,"message"
        lines = content.split('\n')
        for line in lines:
            if 'orchestrator.sh' in line or self._looks_like_task_log(line):
                parsed = self._parse_task_log_line(line)
                if parsed:
                    return parsed
    return None

def _looks_like_task_log(self, line: str) -> bool:
    """Check if line matches CSV log format."""
    parts = line.split(',')
    return len(parts) >= 6

def _parse_task_log_line(self, line: str) -> Optional[dict]:
    """Parse a task log CSV line."""
    import csv
    import io
    try:
        reader = csv.reader(io.StringIO(line))
        row = next(reader)
        if len(row) >= 7:
            return {
                'timestamp': int(row[0]),
                'epic_id': row[1],
                'story_id': row[2],
                'command': row[3],
                'task_id': row[4],
                'status': row[5],
                'message': row[6]
            }
    except (ValueError, StopIteration):
        pass
    return None
```

**Subtasks:**
- 5.1: Create `parse_ndjson_stream()` async generator
- 5.2: Read stdout line by line using `readline()`
- 5.3: Parse each JSON line with try/except for malformed lines
- 5.4: Create `extract_task_id()` method for parsing task events
- 5.5: Implement CSV parsing for orchestrator.sh log format
- 5.6: Yield parsed events for caller to handle

#### Task 6: Implement database event logging

```python
def handle_stream_event(self, event: dict) -> None:
    """Log stream event to database and emit WebSocket."""
    task_info = self.extract_task_id(event)

    if task_info:
        # Create event record
        create_event(
            batch_id=self.current_batch_id,
            story_id=self.current_story_db_id,
            command_id=self.current_command_id,
            timestamp=task_info['timestamp'],
            epic_id=task_info['epic_id'],
            story_key=task_info['story_id'],
            command=task_info['command'],
            task_id=task_info['task_id'],
            status=task_info['status'],
            message=task_info['message']
        )

        # Emit WebSocket event
        event_type = f"command:{task_info['status']}"
        self.emit_event(event_type, {
            'story_key': task_info['story_id'],
            'command': task_info['command'],
            'task_id': task_info['task_id'],
            'message': task_info['message']
        })
```

**Subtasks:**
- 6.1: Create `handle_stream_event()` method
- 6.2: Call `create_event()` from db.py for each parsed event
- 6.3: Track current batch_id, story_id, command_id context
- 6.4: Update story status when transitions detected

#### Task 7: Implement WebSocket event emission

```python
def emit_event(self, event_type: str, payload: dict) -> None:
    """Emit WebSocket event to all connected clients."""
    event = {
        'type': event_type,
        'payload': payload,
        'timestamp': int(datetime.now().timestamp() * 1000)
    }

    # Use broadcast from server module (handles no clients gracefully)
    try:
        asyncio.create_task(broadcast_websocket(json.dumps(event)))
    except Exception:
        # No connected clients or broadcast failed - continue anyway
        pass
```

**Subtasks:**
- 7.1: Create `emit_event()` method
- 7.2: Format event with type, payload, timestamp
- 7.3: Call `broadcast_websocket()` from server.py
- 7.4: Handle case when no WebSocket clients connected (no-op)

#### Task 8: Implement sprint-status.yaml updates

```python
def update_sprint_status(self, story_key: str, new_status: str) -> None:
    """Update story status in sprint-status.yaml."""
    status_path = Path(self.project_root) / '_bmad-output/implementation-artifacts/sprint-status.yaml'

    # Read current state
    with open(status_path, 'r') as f:
        data = yaml.safe_load(f)

    # Get old status for event
    old_status = data.get('development_status', {}).get(story_key)

    # Update status
    if 'development_status' not in data:
        data['development_status'] = {}
    data['development_status'][story_key] = new_status

    # Write back
    with open(status_path, 'w') as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)

    # Emit WebSocket event
    self.emit_event('story:status', {
        'story_key': story_key,
        'old_status': old_status,
        'new_status': new_status
    })

    # Update database
    update_story(
        story_key=story_key,
        status=new_status,
        ended_at=int(datetime.now().timestamp() * 1000) if new_status in ('done', 'blocked') else None
    )
```

**Subtasks:**
- 8.1: Create `update_sprint_status()` method
- 8.2: Read YAML, update specific key, write back
- 8.3: Preserve YAML formatting where possible
- 8.4: Emit story:status WebSocket event
- 8.5: Update database via db.py

#### Task 9: Implement main orchestration loop

```python
async def run_cycle(self) -> bool:
    """
    Run one orchestration cycle (1-2 stories).

    Returns:
        True if cycle completed successfully, False if stopped/error
    """
    # Step 1: Select stories
    status = self.read_sprint_status()
    story_keys = self.select_stories(status)

    if not story_keys:
        self.emit_event('batch:end', {
            'batch_id': self.current_batch_id,
            'cycles_completed': self.cycles_completed,
            'status': 'all_done'
        })
        return False

    self.emit_event('cycle:start', {
        'cycle_number': self.cycles_completed + 1,
        'story_keys': story_keys
    })

    # Determine current status
    current_status = status['development_status'].get(story_keys[0], 'backlog')

    # Step 2: CREATE-STORY phase (if backlog)
    if current_status == 'backlog':
        await self.execute_create_story_phase(story_keys)
        await self.execute_story_review_phase(story_keys)

        # Step 3: TECH-SPEC phase (if needed)
        if self.tech_spec_needed:
            await self.execute_tech_spec_phase(story_keys)
            await self.execute_tech_spec_review_phase(story_keys)

    # Step 4: DEV + CODE-REVIEW phase
    for story_key in story_keys:
        if self.stop_requested:
            break
        await self.execute_dev_phase(story_key)

    # Step 4c: Batch commit
    completed_stories = [k for k in story_keys if self.get_story_status(k) == 'done']
    if completed_stories:
        await self.execute_batch_commit(completed_stories)

    self.cycles_completed += 1

    self.emit_event('cycle:end', {
        'cycle_number': self.cycles_completed,
        'completed_stories': completed_stories
    })

    return True
```

**Subtasks:**
- 9.1: Create `run_cycle()` method
- 9.2: Implement Step 0: project context check
- 9.3: Implement Step 1: read sprint-status, select stories
- 9.4: Implement Step 2: create-story + discovery (parallel via asyncio.gather)
- 9.5: Implement Step 2b: story-review-1, background chain if critical issues
- 9.6: Implement Step 3: create-tech-spec (conditional on tech_spec_needed)
- 9.7: Implement Step 3b: tech-spec-review-1, background chain if critical issues
- 9.8: Implement Step 4: dev-story + code-review loop per story
- 9.9: Implement Step 4c: batch-commit workflow call

#### Task 10: Implement batch control and main entry

```python
async def start(self) -> None:
    """Start the orchestrator."""
    self.state = OrchestratorState.STARTING

    # Create batch record
    self.current_batch_id = create_batch(
        started_at=int(datetime.now().timestamp() * 1000),
        max_cycles=self.max_cycles if self.batch_mode == 'fixed' else None,
        status='running'
    )

    self.emit_event('batch:start', {
        'batch_id': self.current_batch_id,
        'max_cycles': self.max_cycles,
        'batch_mode': self.batch_mode
    })

    # Step 0: Project context check
    await self.check_project_context()

    self.state = OrchestratorState.RUNNING_CYCLE

    # Main loop
    while not self.stop_requested:
        success = await self.run_cycle()

        if not success:
            break

        # Check batch limits
        if self.batch_mode == 'fixed' and self.cycles_completed >= self.max_cycles:
            self.emit_event('batch:end', {
                'batch_id': self.current_batch_id,
                'cycles_completed': self.cycles_completed,
                'status': 'completed'
            })
            break

    # Finalize
    update_batch(
        batch_id=self.current_batch_id,
        ended_at=int(datetime.now().timestamp() * 1000),
        cycles_completed=self.cycles_completed,
        status='stopped' if self.stop_requested else 'completed'
    )

    self.state = OrchestratorState.IDLE

async def stop(self) -> None:
    """Request graceful stop."""
    self.stop_requested = True
    self.emit_event('batch:stopping', {
        'batch_id': self.current_batch_id
    })

def main():
    parser = argparse.ArgumentParser(description='Sprint Runner Orchestrator')
    parser.add_argument(
        'batch_size',
        nargs='?',
        default='2',
        help='Number of cycles to run, or "all" for continuous'
    )
    args = parser.parse_args()

    # Parse batch size
    if args.batch_size.lower() == 'all':
        batch_mode = 'all'
        max_cycles = float('inf')
    else:
        batch_mode = 'fixed'
        max_cycles = int(args.batch_size)

    orchestrator = Orchestrator(
        batch_mode=batch_mode,
        max_cycles=max_cycles
    )

    asyncio.run(orchestrator.start())

if __name__ == '__main__':
    main()
```

**Subtasks:**
- 10.1: Add `batch_mode` and `max_cycles` attributes
- 10.2: Implement `start()` with batch creation and main loop
- 10.3: Implement "all" mode: loop until all stories done/blocked
- 10.4: Implement "fixed" mode: stop when cycles_completed >= max_cycles
- 10.5: Implement `stop()` for graceful shutdown
- 10.6: Add command-line argument parsing in `main()`
- 10.7: Emit batch:start and batch:end events

### Acceptance Criteria

**AC1: Workflow Execution**
- **Given** the orchestrator is started with a batch size
- **When** the main loop executes
- **Then** the workflow follows `instructions.md` steps exactly

**AC2: Claude CLI Spawning**
- **Given** a command needs to be executed
- **When** spawning a Claude CLI subagent
- **Then** `asyncio.subprocess.create_subprocess_exec` is used
- **And** command is `claude -p --output-format stream-json`
- **And** prompt is passed via stdin

**AC3: NDJSON Parsing**
- **Given** the Claude CLI outputs NDJSON
- **When** parsing the stream
- **Then** task-id events are captured from task-taxonomy.yaml phases
- **And** events trigger database records and WebSocket emissions

**AC4: Story Status Transitions**
- **Given** a story transitions status
- **When** the status changes
- **Then** database is updated, sprint-status.yaml is updated, WebSocket event is emitted

**AC5: Batch Mode "all"**
- **Given** batch_mode is "all"
- **When** all stories are done or blocked
- **Then** the orchestrator stops naturally

**AC6: Batch Mode Fixed**
- **Given** batch_mode is a number
- **When** cycles_completed >= max_cycles
- **Then** the orchestrator pauses and emits batch:end event

## Additional Context

### Dependencies

**Required (from Story 5-SR-1 and 5-SR-2):**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/` folder exists
- `db.py` module with CRUD operations implemented
- `server.py` with `broadcast_websocket()` function available
- `requirements.txt` with: `aiohttp`, `pyyaml`

**Python Standard Library:**
- `asyncio` - async subprocess and task management
- `json` - NDJSON parsing
- `csv` - CSV log line parsing
- `pathlib` - path manipulation
- `argparse` - command-line parsing
- `datetime` - timestamps and freshness checks
- `dataclasses` - data structures
- `enum` - state machine states

### Testing Strategy

**Unit Tests:**
1. Test `select_stories()` with various sprint-status.yaml states
2. Test `_extract_epic()` with different story key formats
3. Test `_story_sort_key()` for correct numeric ordering
4. Test `extract_task_id()` with sample NDJSON events
5. Test `_parse_task_log_line()` with CSV log format

**Integration Tests:**
1. Mock subprocess that returns canned NDJSON
2. Test full cycle execution with mock Claude CLI
3. Test graceful shutdown behavior
4. Test error recovery with simulated failures

**Manual Verification:**
1. Run orchestrator with batch_size=1
2. Verify sprint-status.yaml updates correctly
3. Verify database records created
4. Verify WebSocket events emitted (if dashboard connected)

### Notes

**Parallel Execution Patterns:**
```python
# Step 2: Parallel create-story + discovery
async def execute_create_story_phase(self, story_keys: list[str]):
    create_prompt = self.load_prompt('create-story.md', story_keys=story_keys)
    discovery_prompt = self.load_prompt('create-story-discovery.md', story_keys=story_keys)

    create_task = asyncio.create_task(
        self.spawn_subagent(create_prompt, 'create-story')
    )
    discovery_task = asyncio.create_task(
        self.spawn_subagent(discovery_prompt, 'story-discovery')
    )

    create_result, discovery_result = await asyncio.gather(create_task, discovery_task)

    # Parse tech-spec decisions from create-story output
    self.parse_tech_spec_decisions(create_result)
```

**Background Review Chain:**
```python
# Step 2b: Story review with background chain
async def execute_story_review_phase(self, story_keys: list[str]):
    # Review-1: Always blocks
    result = await self.spawn_subagent(
        self.load_prompt('story-review.md', story_keys=story_keys, review_attempt=1),
        'story-review-1'
    )

    has_critical = self.check_for_critical_issues(result)

    if has_critical:
        # Spawn background chain (fire-and-forget)
        asyncio.create_task(
            self.run_background_review_chain(story_keys, 'story-review')
        )

    # Continue immediately to next step
```

**Code Review Loop:**
```python
async def execute_dev_phase(self, story_key: str):
    # Dev-story
    await self.spawn_subagent(
        self.load_prompt('dev-story.md', story_key=story_key),
        'dev-story'
    )

    # Code review loop
    review_attempt = 1
    error_history = []

    while review_attempt <= 10:
        model = 'haiku' if review_attempt >= 2 else None
        result = await self.spawn_subagent(
            self.load_prompt('code-review.md', story_key=story_key, review_attempt=review_attempt),
            f'code-review-{review_attempt}',
            model=model
        )

        issues = self.parse_review_issues(result)
        error_history.append(issues)

        # Exit conditions
        if not issues:
            self.update_sprint_status(story_key, 'done')
            break

        if review_attempt >= 3 and self.same_errors_3x(error_history):
            self.update_sprint_status(story_key, 'blocked')
            break

        if review_attempt >= 3 and not self.has_critical_issues(issues):
            self.update_sprint_status(story_key, 'done')
            break

        review_attempt += 1

    if review_attempt > 10:
        self.update_sprint_status(story_key, 'blocked')
```
