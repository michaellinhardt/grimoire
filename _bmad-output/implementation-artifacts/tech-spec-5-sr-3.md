---
title: 'Python Orchestrator Core Loop'
slug: '5-sr-3-orchestrator-core-loop'
created: '2026-01-24'
status: 'complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack:
  - Python 3.9+
  - asyncio (subprocess, gather, create_task)
  - pyyaml
  - sqlite3 (via db.py module)
  - aiohttp (WebSocket broadcast via server.py)
files_to_modify:
  - '_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py'
code_patterns:
  - asyncio.subprocess.create_subprocess_exec for Claude CLI
  - NDJSON line-by-line parsing via readline()
  - asyncio.gather for parallel create-story + discovery
  - asyncio.create_task for fire-and-forget background reviews
  - CSV parsing for task log lines
  - YAML safe_load/dump for sprint-status.yaml
test_patterns:
  - Mock subprocess for unit tests
  - Canned NDJSON responses for integration tests
  - Pytest asyncio for async test methods
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
3. Parses NDJSON output streams to capture task-id events from CSV log lines
4. Updates state in SQLite database (via db.py module from Story 5-SR-2)
5. Emits WebSocket events for real-time dashboard updates (via server.py from Story 5-SR-5)
6. Follows `instructions.md` workflow steps exactly

### Scope

**In Scope:**
- Main orchestrator class (`Orchestrator`) with start/stop lifecycle
- Command-line argument parsing (batch_size: number or "all")
- Project context check (Step 0) - both wait and background modes
- Sprint-status.yaml reading and story selection (Step 1)
- Create-story + discovery parallel execution (Step 2)
- Story review with background chain spawning (Step 2b)
- Tech-spec creation and review (Steps 3, 3b)
- Dev-story + code-review loop with model switching (Step 4)
- Batch-commit triggering (Step 4c)
- Cycle tracking and batch completion (Step 6)
- Error recovery patterns (Step 5) - 3x same error = blocked
- NDJSON stream parsing for task-id events
- Database event logging via db.py
- WebSocket event emission via server.py
- sprint-status.yaml updates

**Out of Scope:**
- Dashboard UI (Story 5-SR-6)
- WebSocket server implementation (Story 5-SR-5)
- Database schema creation and CRUD operations (Story 5-SR-2)
- File relocation (Story 5-SR-1)
- Dashboard HTML enhancements (Story 5-SR-7)

## Context for Development

### Codebase Patterns

**Existing Reference Patterns:**

1. **Claude CLI Spawning** (`src/main/sessions/cc-spawner.ts`):
   - Uses `spawn()` with args: `-p`, `--output-format stream-json`, `--input-format stream-json`
   - For orchestrator: Use simpler `-p --output-format stream-json` (no input format needed)
   - Prompt sent via stdin, then `stdin.end()`
   - Environment inherits PATH for claude executable location

2. **NDJSON Parsing** (`src/main/sessions/stream-parser.ts`):
   - Uses readline interface for line-by-line parsing
   - Try/catch around JSON.parse for malformed lines
   - Emits events for different message types

3. **Orchestrator Logging** (`_bmad/scripts/orchestrator.sh`):
   - CSV format: `timestamp,epicID,storyID,command,task-id,status,"message"`
   - Subagents call this script to log progress
   - Orchestrator parses these from tool output in NDJSON stream

4. **Sprint Status** (`_bmad-output/implementation-artifacts/sprint-status.yaml`):
   - `development_status` section contains story states
   - Filter: exclude `epic-*` and `*-retrospective` keys
   - Sort numerically: 1-1, 1-2, 2-1, 2a-1, 2b-1, etc.

5. **Prompt Templates** (`_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/*.md`):
   - Variables: `{{story_key}}`, `{{implementation_artifacts}}`, `{{review_attempt}}`
   - Multi-story handling: comma-separated story_keys (e.g., "3a-1,3a-2")
   - Tech-spec decision output: `[TECH-SPEC-DECISION: REQUIRED]` or `[TECH-SPEC-DECISION: SKIP]`

**Python Equivalents:**
```python
# Subprocess spawning
process = await asyncio.subprocess.create_subprocess_exec(
    'claude', '-p', '--output-format', 'stream-json',
    stdin=asyncio.subprocess.PIPE,
    stdout=asyncio.subprocess.PIPE,
    stderr=asyncio.subprocess.PIPE,
    env=os.environ.copy(),
    cwd=project_root
)

# Send prompt
process.stdin.write(prompt.encode())
await process.stdin.drain()
process.stdin.close()

# Parse NDJSON line-by-line
while True:
    line = await process.stdout.readline()
    if not line:
        break
    try:
        event = json.loads(line.decode().strip())
        yield event
    except json.JSONDecodeError:
        pass  # Skip malformed lines
```

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md` | Canonical workflow logic - steps 0-6 |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml` | Valid task-id definitions per command |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story.md` | Create story prompt with tech-spec decision |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/code-review.md` | Code review prompt with model routing |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/background-review-chain.md` | Background review-2/3 chain logic |
| `_bmad/scripts/orchestrator.sh` | CSV log format reference |
| `_bmad/scripts/project-context-should-refresh.sh` | Freshness check logic (24h threshold) |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Sprint state source of truth |
| `_bmad-output/planning-artifacts/project-context.md` | Project context file to check |
| `src/main/sessions/cc-spawner.ts` | Reference for CLI spawning patterns |
| `src/main/sessions/stream-parser.ts` | Reference for NDJSON parsing patterns |
| `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` | HTTP server (relocated from docs/ by 5-SR-1) |

### Technical Decisions

**TD-1: Main Loop Architecture**
- Use `asyncio` event loop as the foundation
- Orchestrator class with async `start()` and `stop()` methods
- State machine: `IDLE` -> `STARTING` -> `RUNNING_CYCLE` -> `WAITING_CHILD` -> `STOPPING` -> `IDLE`
- Graceful shutdown via `stop_requested` flag (complete current command, then exit)

**TD-2: Claude CLI Invocation Pattern**
- Command: `claude -p --output-format stream-json`
- Prompt passed via stdin (not as argument) - matches create-story.md pattern
- No `--input-format stream-json` needed (we send plain text prompts)
- Inherit full environment including PATH for claude executable location
- Working directory set to project root for proper relative path resolution

**TD-3: NDJSON Stream Parsing**
- Line-by-line async reading with `process.stdout.readline()`
- Async generator pattern for yielding parsed events
- Try/except for malformed JSON lines (skip silently, log warning)
- Look for tool_result events containing orchestrator.sh CSV output
- Parse CSV format: `timestamp,epicID,storyID,command,task-id,status,"message"`

**TD-4: Task-ID Event Extraction**
- Subagents call orchestrator.sh which appends to CSV file
- NDJSON stream contains tool_result events with Bash output
- Parse these for orchestrator.sh calls or CSV-formatted lines
- Match task-id against task-taxonomy.yaml phases per command
- Record: timestamp, epic_id, story_id, command, task_id, status, message

**TD-5: Parallel Execution Strategy**
- Step 2 (create-story + discovery): `asyncio.gather(create_task, discovery_task)`
- Both tasks receive comma-separated story_keys
- Wait for both to complete before proceeding
- Post-parallel: run project-context-injection.sh on discovery files

**TD-6: Background Task Spawning**
- Review-2/3 chains spawned as background tasks when review-1 finds CRITICAL issues
- Use `asyncio.create_task()` - fire-and-forget, does not block main flow
- Track in `background_tasks` database table (batch_id, story_key, task_type)
- Background chains use Haiku model, do NOT update sprint-status.yaml
- Main flow continues immediately to next step

**TD-7: State Machine Definition**
```python
class OrchestratorState(Enum):
    IDLE = "idle"               # Not running
    STARTING = "starting"       # Initializing batch
    RUNNING_CYCLE = "running"   # Executing workflow steps
    WAITING_CHILD = "waiting"   # Subprocess active
    STOPPING = "stopping"       # Graceful shutdown in progress
```

**TD-8: Error Handling and Blocking Logic**
- Track `error_history` list per story for code-review loop
- 3 consecutive same error pattern: Mark story "blocked", skip to next
- ZERO issues in code-review: Mark story "done"
- No CRITICAL issues after 3 reviews: Mark story "done" (non-critical may remain)
- 10 review hard limit: Mark story "blocked"
- Unexpected subprocess errors: Log, update state, try to continue

**TD-9: Graceful Shutdown Behavior**
- `stop()` sets `stop_requested = True`
- Current subprocess completes naturally (no SIGTERM during active command)
- After command ends, check flag before starting next command/story
- Emit `batch:end` with status "stopped"
- Update database batch record with `ended_at` and `cycles_completed`

**TD-10: Prompt Variable Substitution**
```python
def load_prompt(self, filename: str, **kwargs) -> str:
    """Load and substitute variables in prompt file."""
    prompt_path = Path(self.project_root) / '_bmad/bmm/workflows/4-implementation/sprint-runner/prompts' / filename
    template = prompt_path.read_text()

    # Substitute variables
    for key, value in kwargs.items():
        template = template.replace(f'{{{{{key}}}}}', str(value))

    # Standard substitutions
    template = template.replace('{{implementation_artifacts}}',
        str(Path(self.project_root) / '_bmad-output/implementation-artifacts'))

    return template
```

**TD-11: Tech-Spec Decision Parsing**
```python
def parse_tech_spec_decision(self, output: str) -> str:
    """Parse tech-spec decision from create-story output."""
    if '[TECH-SPEC-DECISION: SKIP]' in output:
        return 'SKIP'
    # Default to REQUIRED (including if no decision found)
    return 'REQUIRED'
```

## Implementation Plan

### Tasks

#### Task 1: Create orchestrator.py scaffold (AC: #1)

**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py`

**Subtasks:**
- 1.1: Create file with shebang, docstring, and imports
- 1.2: Define `OrchestratorState` enum
- 1.3: Define `Orchestrator` class with `__init__` accepting batch_mode and max_cycles
- 1.4: Add placeholder async `start()` and `stop()` methods
- 1.5: Add `main()` with argparse for batch_size argument
- 1.6: Add import stubs for db.py and server.py modules

```python
#!/usr/bin/env python3
"""
Sprint Runner Orchestrator - Deterministic workflow automation.

Implements the workflow defined in instructions.md without LLM interpretation.
Spawns Claude CLI subagents and parses NDJSON output streams.
"""

import asyncio
import argparse
import json
import os
import sys
import csv
import io
import re
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, AsyncGenerator, Any
from dataclasses import dataclass, field
from enum import Enum

import yaml

# Imports from sibling modules (Story 5-SR-2 and 5-SR-5)
try:
    from db import (
        init_db, create_batch, update_batch, get_active_batch,
        create_story, update_story, get_story_by_key,
        create_command, update_command,
        create_event, create_background_task, update_background_task
    )
    from server import broadcast_websocket
except ImportError:
    # Stubs for development before dependencies are complete
    def init_db(): pass
    def create_batch(**kwargs): return 1
    def update_batch(**kwargs): pass
    def get_active_batch(): return None
    def create_story(**kwargs): return 1
    def update_story(**kwargs): pass
    def get_story_by_key(**kwargs): return None
    def create_command(**kwargs): return 1
    def update_command(**kwargs): pass
    def create_event(**kwargs): return 1
    def create_background_task(**kwargs): return 1
    def update_background_task(**kwargs): pass
    async def broadcast_websocket(msg): pass


class OrchestratorState(Enum):
    IDLE = "idle"
    STARTING = "starting"
    RUNNING_CYCLE = "running"
    WAITING_CHILD = "waiting"
    STOPPING = "stopping"
```

#### Task 2: Implement project context check (AC: #1, Step 0)

**Subtasks:**
- 2.1: Add `check_project_context()` async method
- 2.2: Check if `_bmad-output/planning-artifacts/project-context.md` exists
- 2.3: Check file modification time using `stat().st_mtime`
- 2.4: If missing: spawn `/generate-project-context` and WAIT for completion
- 2.5: If expired (>24h): spawn `/generate-project-context` in BACKGROUND
- 2.6: Emit context:create or context:refresh events

```python
async def check_project_context(self) -> None:
    """Check and refresh project context if needed (Step 0)."""
    context_path = self.project_root / '_bmad-output/planning-artifacts/project-context.md'

    if not context_path.exists():
        # Missing: spawn and WAIT
        self.emit_event('context:create', {'status': 'starting'})
        prompt = self._generate_context_prompt()
        await self.spawn_subagent(prompt, 'generate-project-context', wait=True)
        self.emit_event('context:create', {'status': 'complete'})
    else:
        # Check freshness (24 hour threshold)
        mtime = datetime.fromtimestamp(context_path.stat().st_mtime)
        age = datetime.now() - mtime
        if age > timedelta(hours=24):
            # Expired: spawn in BACKGROUND (no wait)
            self.emit_event('context:refresh', {'status': 'starting', 'age_hours': age.total_seconds() / 3600})
            prompt = self._generate_context_prompt()
            asyncio.create_task(
                self.spawn_subagent(prompt, 'generate-project-context', wait=False, is_background=True)
            )
        # Fresh: skip silently

def _generate_context_prompt(self) -> str:
    """Generate the project context refresh prompt."""
    return f"""AUTONOMOUS MODE - Generate fresh project context.

Run the workflow: /bmad:bmm:workflows:generate-project-context

CRITICAL: Do NOT read project-context.md first - it may have been deleted.
Run the workflow to generate a fresh copy.

Output the file to: {self.project_root}/_bmad-output/planning-artifacts/project-context.md
"""
```

#### Task 3: Implement sprint-status.yaml reading and story selection (AC: #1, Steps 1-2)

**Subtasks:**
- 3.1: Add `read_sprint_status()` method using pyyaml
- 3.2: Add `select_stories()` with filtering (exclude epic-*, *-retrospective)
- 3.3: Implement numeric sorting via `_story_sort_key()`
- 3.4: Implement `_extract_epic()` helper
- 3.5: Implement story pairing logic (up to 2 from same epic)
- 3.6: Return list of 1-2 story keys

```python
def read_sprint_status(self) -> dict:
    """Read and parse sprint-status.yaml."""
    status_path = self.project_root / '_bmad-output/implementation-artifacts/sprint-status.yaml'
    if not status_path.exists():
        raise FileNotFoundError(f"sprint-status.yaml not found at {status_path}")
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

    # Sort numerically
    available.sort(key=self._story_sort_key)

    if not available:
        return []

    # Pairing logic
    first = available[0]
    first_epic = self._extract_epic(first)

    for story in available[1:]:
        if self._extract_epic(story) == first_epic:
            return [first, story]

    return [first]

def _extract_epic(self, story_key: str) -> str:
    """Extract epic prefix from story key."""
    # "2a-1" -> "2a", "3b-2" -> "3b", "5-sr-3" -> "5-sr"
    parts = story_key.rsplit('-', 1)
    return parts[0] if len(parts) > 1 else story_key

def _story_sort_key(self, key: str) -> tuple:
    """Sort key for numeric story ordering."""
    # Patterns: 1-1, 2-3, 2a-1, 3b-2, 5-sr-3
    match = re.match(r'^(\d+)([a-z]?(?:-[a-z]+)?)-(\d+)', key)
    if match:
        major = int(match.group(1))
        suffix = match.group(2) or ''
        story_num = int(match.group(3))
        return (major, suffix, story_num)
    return (999, '', 999)
```

#### Task 4: Implement Claude CLI spawning (AC: #2)

**Subtasks:**
- 4.1: Create `spawn_subagent()` async method
- 4.2: Build args: `claude`, `-p`, `--output-format`, `stream-json`
- 4.3: Use `asyncio.subprocess.create_subprocess_exec`
- 4.4: Write prompt to stdin, drain, close
- 4.5: Handle wait vs fire-and-forget modes
- 4.6: Track background tasks in database

```python
async def spawn_subagent(
    self,
    prompt: str,
    prompt_name: str = 'unknown',
    wait: bool = True,
    is_background: bool = False,
    model: Optional[str] = None
) -> dict[str, Any]:
    """
    Spawn Claude CLI subagent.

    Args:
        prompt: The prompt text to send via stdin
        prompt_name: Name for logging
        wait: If True, await completion
        is_background: If True, track in background_tasks table
        model: Optional model override (e.g., 'haiku')

    Returns:
        Dict with 'events' list and 'exit_code' (only if wait=True)
    """
    args = ['claude', '-p', '--output-format', 'stream-json']

    # Model override for review-2+ (uses Haiku)
    if model:
        args.extend(['--model', model])

    self.state = OrchestratorState.WAITING_CHILD

    process = await asyncio.subprocess.create_subprocess_exec(
        *args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=os.environ.copy(),
        cwd=str(self.project_root)
    )

    # Send prompt via stdin
    process.stdin.write(prompt.encode())
    await process.stdin.drain()
    process.stdin.close()

    if wait:
        results: list[dict] = []
        stdout_content = ''

        async for event in self._parse_ndjson_stream(process):
            results.append(event)
            self._handle_stream_event(event)

            # Accumulate stdout for tech-spec decision parsing
            if event.get('type') == 'assistant':
                content = event.get('message', {}).get('content', [])
                for block in content:
                    if block.get('type') == 'text':
                        stdout_content += block.get('text', '')

        await process.wait()
        self.state = OrchestratorState.RUNNING_CYCLE

        return {
            'events': results,
            'exit_code': process.returncode,
            'stdout': stdout_content
        }
    else:
        # Fire and forget
        if is_background:
            create_background_task(
                batch_id=self.current_batch_id,
                story_key=','.join(self.current_story_keys),
                task_type=prompt_name
            )
        return {}
```

#### Task 5: Implement NDJSON stream parsing (AC: #3)

**Subtasks:**
- 5.1: Create `_parse_ndjson_stream()` async generator
- 5.2: Read stdout line by line
- 5.3: Parse JSON with try/except
- 5.4: Create `_extract_task_event()` for CSV log parsing
- 5.5: Parse orchestrator.sh output format
- 5.6: Handle stream end gracefully

```python
async def _parse_ndjson_stream(
    self,
    process: asyncio.subprocess.Process
) -> AsyncGenerator[dict, None]:
    """Parse NDJSON from subprocess stdout."""
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

def _extract_task_event(self, event: dict) -> Optional[dict]:
    """Extract task-id event from tool_result content."""
    if event.get('type') != 'tool_result':
        return None

    content = event.get('content', '')
    if not isinstance(content, str):
        return None

    # Look for CSV log lines
    for line in content.split('\n'):
        parsed = self._parse_csv_log_line(line)
        if parsed:
            return parsed

    return None

def _parse_csv_log_line(self, line: str) -> Optional[dict]:
    """Parse orchestrator.sh CSV log line."""
    # Format: timestamp,epicID,storyID,command,task-id,status,"message"
    try:
        reader = csv.reader(io.StringIO(line))
        row = next(reader)
        if len(row) >= 7:
            timestamp = int(row[0])
            # Validate it's a recent Unix timestamp (2020-2030)
            if 1577836800 <= timestamp <= 1893456000:
                return {
                    'timestamp': timestamp,
                    'epic_id': row[1],
                    'story_id': row[2],
                    'command': row[3],
                    'task_id': row[4],
                    'status': row[5],
                    'message': row[6]
                }
    except (ValueError, StopIteration, csv.Error):
        pass
    return None
```

#### Task 6: Implement database event logging (AC: #3, #4)

**Subtasks:**
- 6.1: Create `_handle_stream_event()` method
- 6.2: Call db.py functions for event logging
- 6.3: Track current context (batch_id, story_id, command_id)
- 6.4: Update story status on transitions

```python
def _handle_stream_event(self, event: dict) -> None:
    """Handle stream event: log to database and emit WebSocket."""
    task_info = self._extract_task_event(event)

    if task_info:
        # Log to database
        create_event(
            batch_id=self.current_batch_id,
            story_id=None,  # Would need DB lookup for story record ID
            command_id=None,
            epic_id=task_info['epic_id'],
            story_key=task_info['story_id'],
            command=task_info['command'],
            task_id=task_info['task_id'],
            status=task_info['status'],
            message=task_info['message']
        )

        # Emit WebSocket event
        ws_type = 'command:start' if task_info['status'] == 'start' else 'command:end'
        self.emit_event(ws_type, {
            'story_key': task_info['story_id'],
            'command': task_info['command'],
            'task_id': task_info['task_id'],
            'message': task_info['message']
        })
```

#### Task 7: Implement WebSocket event emission (AC: #3, #4)

**Subtasks:**
- 7.1: Create `emit_event()` method
- 7.2: Format event with type, payload, timestamp
- 7.3: Call broadcast_websocket from server.py
- 7.4: Handle no connected clients gracefully

```python
def emit_event(self, event_type: str, payload: dict) -> None:
    """Emit WebSocket event to all connected clients."""
    event = {
        'type': event_type,
        'payload': payload,
        'timestamp': int(datetime.now().timestamp() * 1000)
    }

    try:
        asyncio.create_task(broadcast_websocket(json.dumps(event)))
    except Exception:
        # No connected clients or broadcast failed - continue anyway
        pass
```

#### Task 8: Implement sprint-status.yaml updates (AC: #4)

**Subtasks:**
- 8.1: Create `update_sprint_status()` method
- 8.2: Read YAML, update key, write back
- 8.3: Preserve formatting where possible
- 8.4: Emit story:status WebSocket event
- 8.5: Update database via db.py

```python
def update_sprint_status(self, story_key: str, new_status: str) -> None:
    """Update story status in sprint-status.yaml."""
    status_path = self.project_root / '_bmad-output/implementation-artifacts/sprint-status.yaml'

    with open(status_path, 'r') as f:
        data = yaml.safe_load(f)

    old_status = data.get('development_status', {}).get(story_key)

    if 'development_status' not in data:
        data['development_status'] = {}
    data['development_status'][story_key] = new_status

    with open(status_path, 'w') as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)

    # Emit WebSocket event
    self.emit_event('story:status', {
        'story_key': story_key,
        'old_status': old_status,
        'new_status': new_status
    })

    # Update database
    ended_at = int(datetime.now().timestamp() * 1000) if new_status in ('done', 'blocked') else None
    update_story(story_key=story_key, status=new_status, ended_at=ended_at)
```

#### Task 9: Implement main orchestration loop (AC: #1, #5, #6)

**Subtasks:**
- 9.1: Implement `run_cycle()` method
- 9.2: Step 2: create-story + discovery via asyncio.gather
- 9.3: Step 2b: story-review with background chain
- 9.4: Step 3: create-tech-spec (conditional)
- 9.5: Step 3b: tech-spec-review with background chain
- 9.6: Step 4: dev-story + code-review loop
- 9.7: Step 4c: batch-commit
- 9.8: Step 6: cycle tracking

```python
async def run_cycle(self) -> bool:
    """Run one orchestration cycle."""
    status = self.read_sprint_status()
    story_keys = self.select_stories(status)

    if not story_keys:
        self.emit_event('batch:end', {
            'batch_id': self.current_batch_id,
            'cycles_completed': self.cycles_completed,
            'status': 'all_done'
        })
        return False

    self.current_story_keys = story_keys
    self.emit_event('cycle:start', {
        'cycle_number': self.cycles_completed + 1,
        'story_keys': story_keys
    })

    current_status = status['development_status'].get(story_keys[0], 'backlog')

    # Step 2: CREATE-STORY phase
    if current_status == 'backlog':
        await self._execute_create_story_phase(story_keys)
        await self._execute_story_review_phase(story_keys)

        if self.tech_spec_needed:
            await self._execute_tech_spec_phase(story_keys)
            await self._execute_tech_spec_review_phase(story_keys)

    # Step 4: DEV + CODE-REVIEW
    for story_key in story_keys:
        if self.stop_requested:
            break
        await self._execute_dev_phase(story_key)

    # Step 4c: Batch commit
    completed = [k for k in story_keys if self._get_story_status(k) == 'done']
    if completed:
        await self._execute_batch_commit(completed)

    self.cycles_completed += 1
    self.emit_event('cycle:end', {
        'cycle_number': self.cycles_completed,
        'completed_stories': completed
    })

    return True

async def _execute_create_story_phase(self, story_keys: list[str]) -> None:
    """Step 2: Create-story + discovery in parallel."""
    story_keys_str = ','.join(story_keys)

    create_prompt = self.load_prompt('create-story.md', story_key=story_keys_str)
    discovery_prompt = self.load_prompt('create-story-discovery.md', story_key=story_keys_str)

    create_task = asyncio.create_task(
        self.spawn_subagent(create_prompt, 'create-story')
    )
    discovery_task = asyncio.create_task(
        self.spawn_subagent(discovery_prompt, 'story-discovery')
    )

    create_result, discovery_result = await asyncio.gather(create_task, discovery_task)

    # Parse tech-spec decisions
    self.tech_spec_needed = False
    self.tech_spec_decisions = {}
    stdout = create_result.get('stdout', '')

    for story_key in story_keys:
        decision = self._parse_tech_spec_decision(stdout)
        self.tech_spec_decisions[story_key] = decision
        if decision == 'REQUIRED':
            self.tech_spec_needed = True

    # Run project-context-injection.sh on discovery files
    for story_key in story_keys:
        discovery_file = self.project_root / '_bmad-output/implementation-artifacts' / f'{story_key}-discovery-story.md'
        if discovery_file.exists():
            await self._run_shell_script(
                '_bmad/scripts/project-context-injection.sh',
                str(discovery_file)
            )

async def _execute_story_review_phase(self, story_keys: list[str]) -> None:
    """Step 2b: Story review with background chain."""
    story_keys_str = ','.join(story_keys)

    prompt = self.load_prompt('story-review.md', story_key=story_keys_str, review_attempt=1)
    result = await self.spawn_subagent(prompt, 'story-review-1')

    has_critical = self._check_for_critical_issues(result.get('stdout', ''))

    if has_critical:
        # Spawn background review chain
        chain_prompt = self.load_prompt('background-review-chain.md',
            review_type='story-review',
            story_keys=story_keys_str,
            prompt_file='prompts/story-review.md'
        )
        asyncio.create_task(
            self.spawn_subagent(chain_prompt, 'story-review-chain', is_background=True, model='haiku')
        )

async def _execute_tech_spec_phase(self, story_keys: list[str]) -> None:
    """Step 3: Create tech-spec."""
    story_keys_str = ','.join(story_keys)

    prompt = self.load_prompt('create-tech-spec.md', story_key=story_keys_str)
    await self.spawn_subagent(prompt, 'create-tech-spec')

async def _execute_tech_spec_review_phase(self, story_keys: list[str]) -> None:
    """Step 3b: Tech-spec review with background chain."""
    story_keys_str = ','.join(story_keys)

    prompt = self.load_prompt('tech-spec-review.md', story_key=story_keys_str, review_attempt=1)
    result = await self.spawn_subagent(prompt, 'tech-spec-review-1')

    has_critical = self._check_for_critical_issues(result.get('stdout', ''))

    if has_critical:
        chain_prompt = self.load_prompt('background-review-chain.md',
            review_type='tech-spec-review',
            story_keys=story_keys_str,
            prompt_file='prompts/tech-spec-review.md'
        )
        asyncio.create_task(
            self.spawn_subagent(chain_prompt, 'tech-spec-review-chain', is_background=True, model='haiku')
        )

async def _execute_dev_phase(self, story_key: str) -> None:
    """Step 4: Dev-story + code-review loop."""
    # Dev-story
    prompt = self.load_prompt('dev-story.md', story_key=story_key)
    await self.spawn_subagent(prompt, 'dev-story')

    # Code review loop
    await self._execute_code_review_loop(story_key)

async def _execute_code_review_loop(self, story_key: str) -> str:
    """Execute code-review loop until done or blocked."""
    review_attempt = 1
    error_history: list[str] = []

    while review_attempt <= 10:
        model = 'haiku' if review_attempt >= 2 else None
        prompt = self.load_prompt('code-review.md',
            story_key=story_key,
            review_attempt=review_attempt
        )

        result = await self.spawn_subagent(prompt, f'code-review-{review_attempt}', model=model)
        stdout = result.get('stdout', '')

        severity = self._parse_highest_severity(stdout)
        error_history.append(severity)

        # Exit conditions
        if severity == 'ZERO':
            self.update_sprint_status(story_key, 'done')
            return 'done'

        if review_attempt >= 3:
            if self._same_errors_3x(error_history):
                self.update_sprint_status(story_key, 'blocked')
                return 'blocked'
            if severity not in ('CRITICAL',):
                self.update_sprint_status(story_key, 'done')
                return 'done'

        review_attempt += 1

    self.update_sprint_status(story_key, 'blocked')
    return 'blocked'

async def _execute_batch_commit(self, completed_stories: list[str]) -> None:
    """Step 4c: Batch commit."""
    story_ids_str = ','.join(completed_stories)
    epic_id = self._extract_epic(completed_stories[0])

    prompt = f"""AUTONOMOUS MODE - Run batch-commit workflow.

Run the workflow: /bmad:bmm:workflows:batch-commit

Parameters:
- story_ids: {story_ids_str}
- epic_id: {epic_id}

This workflow will:
1. Archive completed story artifacts to archived-artifacts/
2. Delete discovery files (intermediate files)
3. Stage and commit all changes with message: feat({epic_id}): implement stories {story_ids_str}

Execute with full autonomy. Handle errors gracefully.
"""
    await self.spawn_subagent(prompt, 'batch-commit')
```

#### Task 10: Implement batch control (AC: #5, #6)

**Subtasks:**
- 10.1: Add batch_mode and max_cycles handling
- 10.2: Implement `start()` with batch creation
- 10.3: Implement "all" mode (infinite loop until all done)
- 10.4: Implement "fixed" mode (stop at max_cycles)
- 10.5: Implement `stop()` for graceful shutdown
- 10.6: Emit batch:start and batch:end events

```python
class Orchestrator:
    """Main orchestrator for sprint-runner workflow automation."""

    def __init__(
        self,
        batch_mode: str = "fixed",
        max_cycles: int = 2,
        project_root: Optional[Path] = None
    ):
        self.batch_mode = batch_mode
        self.max_cycles = max_cycles
        self.project_root = project_root or Path.cwd()

        self.state = OrchestratorState.IDLE
        self.stop_requested = False
        self.cycles_completed = 0
        self.current_batch_id: Optional[int] = None
        self.current_story_keys: list[str] = []
        self.tech_spec_needed = False
        self.tech_spec_decisions: dict[str, str] = {}

    async def start(self) -> None:
        """Start the orchestrator."""
        self.state = OrchestratorState.STARTING

        # Initialize database
        init_db()

        self.current_batch_id = create_batch(
            max_cycles=self.max_cycles if self.batch_mode == 'fixed' else 999
        )

        self.emit_event('batch:start', {
            'batch_id': self.current_batch_id,
            'max_cycles': self.max_cycles if self.max_cycles != float('inf') else None,
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
            ended_at=int(datetime.now().timestamp()),
            cycles_completed=self.cycles_completed,
            status='stopped' if self.stop_requested else 'completed'
        )

        self.state = OrchestratorState.IDLE

    async def stop(self) -> None:
        """Request graceful shutdown."""
        self.stop_requested = True
        self.emit_event('batch:stopping', {
            'batch_id': self.current_batch_id
        })

    # Helper methods
    def _check_for_critical_issues(self, stdout: str) -> bool:
        """Check if output indicates critical issues."""
        return 'HIGHEST SEVERITY: CRITICAL' in stdout

    def _parse_highest_severity(self, stdout: str) -> str:
        """Parse highest severity from code-review output."""
        if 'ZERO ISSUES' in stdout:
            return 'ZERO'
        if 'HIGHEST SEVERITY: CRITICAL' in stdout:
            return 'CRITICAL'
        if 'HIGHEST SEVERITY: HIGH' in stdout:
            return 'HIGH'
        if 'HIGHEST SEVERITY: MEDIUM' in stdout:
            return 'MEDIUM'
        if 'HIGHEST SEVERITY: LOW' in stdout:
            return 'LOW'
        return 'UNKNOWN'

    def _same_errors_3x(self, history: list[str]) -> bool:
        """Check if last 3 error patterns are the same."""
        if len(history) < 3:
            return False
        return history[-1] == history[-2] == history[-3]

    def _parse_tech_spec_decision(self, stdout: str) -> str:
        """Parse tech-spec decision from output."""
        if '[TECH-SPEC-DECISION: SKIP]' in stdout:
            return 'SKIP'
        return 'REQUIRED'

    def _get_story_status(self, story_key: str) -> str:
        """Get current status of a story from sprint-status.yaml."""
        status = self.read_sprint_status()
        return status.get('development_status', {}).get(story_key, 'unknown')

    def load_prompt(self, filename: str, **kwargs) -> str:
        """Load and substitute variables in prompt template."""
        path = self.project_root / '_bmad/bmm/workflows/4-implementation/sprint-runner/prompts' / filename
        template = path.read_text()

        impl_artifacts = str(self.project_root / '_bmad-output/implementation-artifacts')
        template = template.replace('{{implementation_artifacts}}', impl_artifacts)

        for key, value in kwargs.items():
            template = template.replace(f'{{{{{key}}}}}', str(value))

        return template

    async def _run_shell_script(self, script_path: str, *args: str) -> None:
        """Run a shell script."""
        full_path = self.project_root / script_path
        process = await asyncio.subprocess.create_subprocess_exec(
            str(full_path), *args,
            cwd=str(self.project_root)
        )
        await process.wait()


def main():
    parser = argparse.ArgumentParser(description='Sprint Runner Orchestrator')
    parser.add_argument(
        'batch_size',
        nargs='?',
        default='2',
        help='Number of cycles to run, or "all" for continuous'
    )
    args = parser.parse_args()

    if args.batch_size.lower() == 'all':
        batch_mode = 'all'
        max_cycles = float('inf')
    else:
        batch_mode = 'fixed'
        max_cycles = int(args.batch_size)

    orchestrator = Orchestrator(batch_mode=batch_mode, max_cycles=max_cycles)
    asyncio.run(orchestrator.start())


if __name__ == '__main__':
    main()
```

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
- **Then** task-id events are captured from CSV log lines
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

**Required Modules (from other stories):**
- `db.py` (Story 5-SR-2): CRUD operations for batches, stories, commands, events, background_tasks
- `server.py` (Story 5-SR-5): `broadcast_websocket()` function for real-time events
- Dashboard folder (Story 5-SR-1): `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/`

**Python Standard Library:**
- `asyncio` - async subprocess, gather, create_task
- `json` - NDJSON parsing
- `csv` - CSV log line parsing
- `io` - StringIO for csv reader
- `pathlib` - Path manipulation
- `argparse` - CLI argument parsing
- `datetime` - Timestamps and freshness checks
- `dataclasses` - Data structures
- `enum` - State machine
- `re` - Story key parsing

**External Packages (from requirements.txt):**
- `pyyaml` - YAML parsing for sprint-status.yaml

### Testing Strategy

**Unit Tests:**
1. `test_select_stories()` - Various sprint-status.yaml states, filtering, sorting
2. `test_extract_epic()` - Different story key formats (1-1, 2a-1, 5-sr-3)
3. `test_story_sort_key()` - Correct numeric ordering
4. `test_parse_csv_log_line()` - Valid and invalid CSV formats
5. `test_parse_tech_spec_decision()` - REQUIRED vs SKIP detection

**Integration Tests:**
1. Mock subprocess returning canned NDJSON
2. Full cycle execution with mocked Claude CLI
3. Graceful shutdown mid-cycle
4. Error recovery with simulated failures
5. Background task spawning verification

**Manual Verification:**
1. Run `python orchestrator.py 1` with real Claude CLI
2. Verify sprint-status.yaml updates correctly
3. Verify database records (requires 5-SR-2)
4. Verify WebSocket events (requires 5-SR-5)

### Notes

**Full Orchestrator Class (consolidated):**

The complete `orchestrator.py` file should contain approximately 450-500 lines including:
- Imports and module setup (~30 lines)
- OrchestratorState enum (~10 lines)
- Orchestrator class with all methods (~400 lines)
- main() function and entry point (~30 lines)

**Key Implementation Patterns:**

1. **Async/Await Throughout**: All subprocess operations and I/O are async
2. **State Machine**: Clear state transitions for debugging and monitoring
3. **Graceful Shutdown**: Check `stop_requested` between major operations
4. **Error Resilience**: Continue processing other stories if one fails
5. **Logging**: All events logged to database and emitted to WebSocket
6. **Parallelism**: Use `asyncio.gather` for parallel operations, `asyncio.create_task` for fire-and-forget

**WebSocket Event Types (for dashboard integration):**

| Event Type | Payload |
|------------|---------|
| `batch:start` | `{ batch_id, max_cycles, batch_mode }` |
| `batch:stopping` | `{ batch_id }` |
| `batch:end` | `{ batch_id, cycles_completed, status }` |
| `cycle:start` | `{ cycle_number, story_keys }` |
| `cycle:end` | `{ cycle_number, completed_stories }` |
| `command:start` | `{ story_key, command, task_id, message }` |
| `command:end` | `{ story_key, command, task_id, message }` |
| `story:status` | `{ story_key, old_status, new_status }` |
| `context:create` | `{ status }` |
| `context:refresh` | `{ status, age_hours }` |
