---
title: 'SQLite Database Schema and Operations for Sprint Runner'
slug: 'story-5-sr-2-sqlite-db'
created: '2026-01-24'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Python 3.8+', 'SQLite3 (stdlib)', 'pytest']
files_to_modify:
  - '_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py'
  - '_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/test_db.py'
  - '_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/requirements.txt'
code_patterns:
  - 'context manager for DB connections'
  - 'foreign key enforcement via PRAGMA'
  - 'Unix timestamps (seconds)'
  - 'sqlite3.Row for dict-like access'
  - 'type hints on all functions'
test_patterns:
  - 'pytest with tmp_path fixture'
  - 'patch DB_PATH for isolation'
  - 'fixtures for sample data'
  - 'class-based test organization'
---

# Tech-Spec: SQLite Database Schema and Operations for Sprint Runner

**Created:** 2026-01-24

## Overview

### Problem Statement

The sprint-runner orchestrator needs persistent state tracking across sessions, queryable event history, and relational data for batches, stories, commands, events, and background tasks. Currently there is no database - this story introduces SQLite as the persistence layer.

### Solution

Create a `db.py` Python module in the dashboard folder that:
1. Initializes a SQLite database with 5 tables (batches, stories, commands, events, background_tasks)
2. Provides CRUD operations for each table with clean Python interfaces
3. Includes helper queries for orchestrator decision-making (blocked detection, cycle counting)
4. Uses context manager pattern for thread-safe connection handling

### Scope

**In Scope:**
- SQLite database initialization with idempotent table creation
- CRUD operations for all 5 tables
- Helper queries for orchestrator decision-making
- Foreign key enforcement
- Index creation for performance
- Unit tests with pytest

**Out of Scope:**
- Migration tooling (schema assumed stable for MVP)
- Connection pooling (simple per-request pattern sufficient)
- Async wrappers (orchestrator.py handles async, db.py is sync)
- Dashboard integration (Story 5-SR-3 and beyond)

## Context for Development

### Codebase Patterns

**File Location:**
```
_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/
  db.py                  <- THIS FILE
  sprint-runner.db       <- Created on first init_db() call
  server.py              <- From story 5-SR-1
  dashboard.html         <- From story 5-SR-1
  requirements.txt       <- From story 5-SR-1
  test_db.py             <- Unit tests for db.py
```

**Python Style (from existing server.py):**
- Use `from __future__ import annotations` for forward references
- Type hints on all function signatures
- `Path` from pathlib for file paths
- Print to stderr for debug logging
- Docstrings for public functions

**Database Conventions (from project-context.md):**
- Column names: snake_case
- Timestamps: Unix epoch integers (seconds, not milliseconds like Electron app)
- Booleans: Not needed for this schema
- Foreign keys: Enabled via PRAGMA

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` | Existing Python patterns (relocated from docs/) |
| `/Users/teazyou/dev/grimoire/_bmad-output/implementation-artifacts/story-5-sr-2.md` | Full story with acceptance criteria |
| `/Users/teazyou/dev/grimoire/_bmad-output/implementation-artifacts/sprint-runner-orchestrator-study.md` | Proposed schema and architecture |
| `/Users/teazyou/dev/grimoire/_bmad-output/planning-artifacts/epic-5-sprint-runner-dashboard.md` | Epic context |

### Technical Decisions

#### 1. Database Location
**Decision:** Database file at `{dashboard_folder}/sprint-runner.db`
**Rationale:** Colocated with dashboard code, easy to find/backup, follows existing file organization pattern.

#### 2. Connection Management Pattern
**Decision:** New connection per operation (NOT singleton)
**Rationale:**
- SQLite handles concurrent reads well
- Simpler code - no connection pool management
- Orchestrator may be async, but db.py is sync (caller handles async wrapping)
- Each function creates connection, uses context manager, closes automatically

#### 3. Thread Safety Approach
**Decision:** Per-function connection with `check_same_thread=False`
**Rationale:**
- Orchestrator may call db functions from different async contexts
- `check_same_thread=False` allows this safely
- Write operations are infrequent enough that WAL mode handles contention

#### 4. Timestamp Format
**Decision:** Unix epoch integers (seconds)
**Rationale:**
- Matches proposed schema in orchestrator study
- Simple to generate: `int(time.time())`
- Easy to compare/sort in queries
- No timezone ambiguity

#### 5. Foreign Key Enforcement
**Decision:** Enable via `PRAGMA foreign_keys = ON` in connection context manager
**Rationale:**
- Ensures referential integrity
- Must be enabled per-connection (SQLite default is OFF)
- Context manager guarantees it's always set

#### 6. Index Strategy
**Decision:** Create indexes on frequently queried columns
**Indexes to create:**
```sql
CREATE INDEX idx_stories_batch_id ON stories(batch_id);
CREATE INDEX idx_stories_story_key ON stories(story_key);
CREATE INDEX idx_commands_story_id ON commands(story_id);
CREATE INDEX idx_events_batch_id ON events(batch_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_background_tasks_batch_id ON background_tasks(batch_id);
CREATE INDEX idx_background_tasks_status ON background_tasks(status);
```
**Rationale:**
- `stories.batch_id` - get_stories_by_batch() query
- `stories.story_key` - get_story_by_key() query
- `commands.story_id` - get_commands_by_story() query
- `events.batch_id` - get_events_by_batch() query
- `events.timestamp` - sorting recent events
- `background_tasks.batch_id/status` - get_pending_background_tasks() query

#### 7. Migration Strategy
**Decision:** Recreate-on-change for MVP (no migrations)
**Rationale:**
- Sprint data is ephemeral (can be regenerated)
- Schema assumed stable after initial implementation
- Future: add version table and migration scripts if needed

## Implementation Plan

### Tasks

#### Task 1: Create db.py module with database schema (AC: #1)

**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py`

**1.1 Module setup and imports**
```python
#!/usr/bin/env python3
"""
SQLite database module for sprint-runner orchestrator.

Provides persistent state tracking for batches, stories, commands, events,
and background tasks.

Usage:
    from db import init_db, create_batch, get_active_batch

    init_db()  # Call once at startup
    batch_id = create_batch(max_cycles=3)
"""

from __future__ import annotations
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Optional, Any

# Database location - same directory as this file
DB_PATH = Path(__file__).parent / 'sprint-runner.db'
```

**1.2 Connection context manager**
```python
@contextmanager
def get_connection():
    """
    Context manager for database connections.

    Ensures:
    - Foreign keys are enabled
    - Connection is properly closed
    - Row factory returns dicts

    Usage:
        with get_connection() as conn:
            cursor = conn.execute("SELECT * FROM batches")
            rows = cursor.fetchall()
    """
    conn = sqlite3.connect(
        DB_PATH,
        check_same_thread=False,
        timeout=30.0
    )
    conn.row_factory = sqlite3.Row  # Enable dict-like access
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
```

**1.3 Schema definition with indexes**
```python
SCHEMA = """
-- Batch runs
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    max_cycles INTEGER NOT NULL,
    cycles_completed INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running'
);

-- Story states
CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_key TEXT NOT NULL,
    epic_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in-progress',
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- Commands executed
CREATE TABLE IF NOT EXISTS commands (
    id INTEGER PRIMARY KEY,
    story_id INTEGER NOT NULL,
    command TEXT NOT NULL,
    task_id TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    status TEXT NOT NULL DEFAULT 'running',
    output_summary TEXT,
    FOREIGN KEY (story_id) REFERENCES stories(id)
);

-- Events log
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_id INTEGER,
    command_id INTEGER,
    timestamp INTEGER NOT NULL,
    epic_id TEXT NOT NULL,
    story_key TEXT NOT NULL,
    command TEXT NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT
);

-- Background tasks (fire-and-forget)
CREATE TABLE IF NOT EXISTS background_tasks (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_key TEXT NOT NULL,
    task_type TEXT NOT NULL,
    spawned_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL DEFAULT 'running',
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_stories_batch_id ON stories(batch_id);
CREATE INDEX IF NOT EXISTS idx_stories_story_key ON stories(story_key);
CREATE INDEX IF NOT EXISTS idx_commands_story_id ON commands(story_id);
CREATE INDEX IF NOT EXISTS idx_events_batch_id ON events(batch_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_background_tasks_batch_id ON background_tasks(batch_id);
CREATE INDEX IF NOT EXISTS idx_background_tasks_status ON background_tasks(status);
"""
```

**1.4 init_db() function**
```python
def init_db() -> None:
    """
    Initialize the database with all tables and indexes.

    Idempotent - safe to call multiple times.
    Creates sprint-runner.db in the dashboard folder if it doesn't exist.
    """
    with get_connection() as conn:
        conn.executescript(SCHEMA)
```

#### Task 2: Implement batch operations (AC: #2)

```python
def create_batch(max_cycles: int) -> int:
    """
    Create a new batch with started_at=now, status='running'.

    Args:
        max_cycles: Maximum number of cycles for this batch

    Returns:
        The new batch ID
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO batches (started_at, max_cycles, status)
            VALUES (?, ?, 'running')
            """,
            (int(time.time()), max_cycles)
        )
        return cursor.lastrowid


def update_batch(batch_id: int, **kwargs: Any) -> None:
    """
    Update batch fields.

    Args:
        batch_id: The batch to update
        **kwargs: Fields to update (ended_at, cycles_completed, status, etc.)
    """
    if not kwargs:
        return

    fields = ', '.join(f"{k} = ?" for k in kwargs.keys())
    values = list(kwargs.values()) + [batch_id]

    with get_connection() as conn:
        conn.execute(
            f"UPDATE batches SET {fields} WHERE id = ?",
            values
        )


def get_batch(batch_id: int) -> Optional[dict]:
    """
    Get a batch by ID.

    Returns:
        Batch record as dict, or None if not found
    """
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM batches WHERE id = ?",
            (batch_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_active_batch() -> Optional[dict]:
    """
    Get the currently running batch.

    Returns:
        Batch record with status='running', or None
    """
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM batches WHERE status = 'running' ORDER BY id DESC LIMIT 1"
        )
        row = cursor.fetchone()
        return dict(row) if row else None
```

#### Task 3: Implement story operations (AC: #3)

```python
def create_story(batch_id: int, story_key: str, epic_id: str) -> int:
    """
    Create a new story with started_at=now, status='in-progress'.

    Args:
        batch_id: Parent batch ID
        story_key: Story identifier (e.g., "2a-1")
        epic_id: Epic identifier (e.g., "2a")

    Returns:
        The new story ID
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO stories (batch_id, story_key, epic_id, started_at)
            VALUES (?, ?, ?, ?)
            """,
            (batch_id, story_key, epic_id, int(time.time()))
        )
        return cursor.lastrowid


def update_story(story_id: int, **kwargs: Any) -> None:
    """
    Update story fields.

    Args:
        story_id: The story to update
        **kwargs: Fields to update (status, ended_at, etc.)
    """
    if not kwargs:
        return

    fields = ', '.join(f"{k} = ?" for k in kwargs.keys())
    values = list(kwargs.values()) + [story_id]

    with get_connection() as conn:
        conn.execute(
            f"UPDATE stories SET {fields} WHERE id = ?",
            values
        )


def get_story(story_id: int) -> Optional[dict]:
    """
    Get a story by ID.

    Returns:
        Story record as dict, or None if not found
    """
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM stories WHERE id = ?",
            (story_id,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_story_by_key(story_key: str, batch_id: int) -> Optional[dict]:
    """
    Find a story by its key within a specific batch.

    Args:
        story_key: Story identifier (e.g., "2a-1")
        batch_id: Batch to search within

    Returns:
        Story record as dict, or None if not found
    """
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM stories WHERE story_key = ? AND batch_id = ?",
            (story_key, batch_id)
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_stories_by_batch(batch_id: int) -> list[dict]:
    """
    Get all stories in a batch.

    Returns:
        List of story records as dicts
    """
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM stories WHERE batch_id = ? ORDER BY id",
            (batch_id,)
        )
        return [dict(row) for row in cursor.fetchall()]
```

#### Task 4: Implement command operations (AC: #4)

```python
def create_command(story_id: int, command: str, task_id: str) -> int:
    """
    Create a new command with started_at=now, status='running'.

    Args:
        story_id: Parent story ID
        command: Command name (e.g., "create-story", "code-review-2")
        task_id: Task phase (e.g., "setup", "analyze")

    Returns:
        The new command ID
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO commands (story_id, command, task_id, started_at)
            VALUES (?, ?, ?, ?)
            """,
            (story_id, command, task_id, int(time.time()))
        )
        return cursor.lastrowid


def update_command(command_id: int, **kwargs: Any) -> None:
    """
    Update command fields.

    Args:
        command_id: The command to update
        **kwargs: Fields to update (ended_at, status, output_summary, etc.)
    """
    if not kwargs:
        return

    fields = ', '.join(f"{k} = ?" for k in kwargs.keys())
    values = list(kwargs.values()) + [command_id]

    with get_connection() as conn:
        conn.execute(
            f"UPDATE commands SET {fields} WHERE id = ?",
            values
        )


def get_commands_by_story(story_id: int) -> list[dict]:
    """
    Get all commands for a story.

    Returns:
        List of command records as dicts, ordered by ID
    """
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM commands WHERE story_id = ? ORDER BY id",
            (story_id,)
        )
        return [dict(row) for row in cursor.fetchall()]
```

#### Task 5: Implement event logging operations (AC: #5)

```python
def create_event(
    batch_id: int,
    story_id: Optional[int],
    command_id: Optional[int],
    epic_id: str,
    story_key: str,
    command: str,
    task_id: str,
    status: str,
    message: str
) -> int:
    """
    Log an event with timestamp=now.

    Args:
        batch_id: Parent batch ID
        story_id: Associated story ID (optional)
        command_id: Associated command ID (optional)
        epic_id: Epic identifier
        story_key: Story identifier
        command: Command name
        task_id: Task phase
        status: Event status (start, end, progress)
        message: Event message

    Returns:
        The new event ID
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO events
            (batch_id, story_id, command_id, timestamp, epic_id, story_key, command, task_id, status, message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (batch_id, story_id, command_id, int(time.time()), epic_id, story_key, command, task_id, status, message)
        )
        return cursor.lastrowid


def get_events(limit: int = 100, offset: int = 0) -> list[dict]:
    """
    Get recent events, newest first.

    Args:
        limit: Maximum number of events to return
        offset: Number of events to skip

    Returns:
        List of event records as dicts
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT * FROM events
            ORDER BY timestamp DESC, id DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset)
        )
        return [dict(row) for row in cursor.fetchall()]


def get_events_by_batch(batch_id: int) -> list[dict]:
    """
    Get all events for a specific batch.

    Returns:
        List of event records as dicts, ordered by timestamp
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT * FROM events
            WHERE batch_id = ?
            ORDER BY timestamp ASC, id ASC
            """,
            (batch_id,)
        )
        return [dict(row) for row in cursor.fetchall()]
```

#### Task 6: Implement background task operations (AC: #6)

```python
def create_background_task(batch_id: int, story_key: str, task_type: str) -> int:
    """
    Create a background task with spawned_at=now, status='running'.

    Args:
        batch_id: Parent batch ID
        story_key: Story identifier
        task_type: Task type (e.g., "story-review-chain", "tech-spec-review-chain", "context-refresh")

    Returns:
        The new task ID
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO background_tasks (batch_id, story_key, task_type, spawned_at)
            VALUES (?, ?, ?, ?)
            """,
            (batch_id, story_key, task_type, int(time.time()))
        )
        return cursor.lastrowid


def update_background_task(task_id: int, **kwargs: Any) -> None:
    """
    Update background task fields.

    Args:
        task_id: The task to update
        **kwargs: Fields to update (completed_at, status, etc.)
    """
    if not kwargs:
        return

    fields = ', '.join(f"{k} = ?" for k in kwargs.keys())
    values = list(kwargs.values()) + [task_id]

    with get_connection() as conn:
        conn.execute(
            f"UPDATE background_tasks SET {fields} WHERE id = ?",
            values
        )


def get_pending_background_tasks(batch_id: int) -> list[dict]:
    """
    Get background tasks that are still running for a batch.

    Returns:
        List of running background task records as dicts
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT * FROM background_tasks
            WHERE batch_id = ? AND status = 'running'
            ORDER BY spawned_at ASC
            """,
            (batch_id,)
        )
        return [dict(row) for row in cursor.fetchall()]
```

#### Task 7: Implement helper queries (AC: #7)

```python
def get_current_batch_status() -> Optional[dict]:
    """
    Get the running batch with cycle information.

    Returns:
        Dict with batch info including cycle count, or None if no running batch
    """
    return get_active_batch()


def count_completed_cycles(batch_id: int) -> int:
    """
    Get the number of completed cycles for a batch.

    Returns:
        cycles_completed value from batch, or 0 if batch not found
    """
    batch = get_batch(batch_id)
    return batch['cycles_completed'] if batch else 0


def check_story_blocked(story_id: int) -> bool:
    """
    Check if a story should be marked as blocked.

    A story is blocked if it has 3 or more consecutive failed commands.

    Args:
        story_id: The story to check

    Returns:
        True if story has 3+ consecutive failed commands
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT status FROM commands
            WHERE story_id = ?
            ORDER BY id DESC
            LIMIT 3
            """,
            (story_id,)
        )
        rows = cursor.fetchall()

        # Need at least 3 commands to be blocked
        if len(rows) < 3:
            return False

        # Check if all 3 most recent are failed
        return all(row['status'] == 'failed' for row in rows)
```

#### Task 8: Write unit tests (AC: #8)

**File:** `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/test_db.py`

```python
#!/usr/bin/env python3
"""
Unit tests for db.py SQLite database module.

Run with: pytest test_db.py -v
"""

from __future__ import annotations
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

import pytest


# Test fixtures

@pytest.fixture
def temp_db(tmp_path):
    """Create a temporary database for testing."""
    import db

    # Override DB_PATH to use temp directory
    test_db_path = tmp_path / 'test-sprint-runner.db'

    with patch.object(db, 'DB_PATH', test_db_path):
        db.init_db()
        yield db

    # Cleanup handled by tmp_path fixture


@pytest.fixture
def sample_batch(temp_db):
    """Create a sample batch for testing."""
    batch_id = temp_db.create_batch(max_cycles=3)
    return batch_id


@pytest.fixture
def sample_story(temp_db, sample_batch):
    """Create a sample story for testing."""
    story_id = temp_db.create_story(
        batch_id=sample_batch,
        story_key="2a-1",
        epic_id="2a"
    )
    return story_id


# Test: Database initialization (8.1)

class TestDatabaseInit:
    def test_init_creates_tables(self, temp_db):
        """Verify all 5 tables are created."""
        with temp_db.get_connection() as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            tables = [row['name'] for row in cursor.fetchall()]

        assert 'batches' in tables
        assert 'stories' in tables
        assert 'commands' in tables
        assert 'events' in tables
        assert 'background_tasks' in tables

    def test_init_is_idempotent(self, temp_db):
        """Calling init_db() multiple times should not fail."""
        temp_db.init_db()
        temp_db.init_db()
        # Should not raise any errors

    def test_foreign_keys_enabled(self, temp_db, sample_batch):
        """Foreign key constraints should be enforced."""
        # Try to create a story with non-existent batch_id
        with pytest.raises(Exception):  # IntegrityError
            temp_db.create_story(
                batch_id=99999,  # Non-existent
                story_key="1-1",
                epic_id="1"
            )


# Test: Batch CRUD operations (8.2)

class TestBatchOperations:
    def test_create_batch(self, temp_db):
        """create_batch should return new batch ID."""
        batch_id = temp_db.create_batch(max_cycles=5)
        assert batch_id > 0

        batch = temp_db.get_batch(batch_id)
        assert batch['max_cycles'] == 5
        assert batch['status'] == 'running'
        assert batch['cycles_completed'] == 0
        assert batch['started_at'] > 0
        assert batch['ended_at'] is None

    def test_update_batch(self, temp_db, sample_batch):
        """update_batch should modify specified fields."""
        temp_db.update_batch(
            sample_batch,
            cycles_completed=2,
            status='completed',
            ended_at=int(time.time())
        )

        batch = temp_db.get_batch(sample_batch)
        assert batch['cycles_completed'] == 2
        assert batch['status'] == 'completed'
        assert batch['ended_at'] is not None

    def test_get_batch_not_found(self, temp_db):
        """get_batch should return None for non-existent ID."""
        assert temp_db.get_batch(99999) is None

    def test_get_active_batch(self, temp_db, sample_batch):
        """get_active_batch should return running batch."""
        active = temp_db.get_active_batch()
        assert active is not None
        assert active['id'] == sample_batch

        # Mark as completed
        temp_db.update_batch(sample_batch, status='completed')
        assert temp_db.get_active_batch() is None


# Test: Story CRUD operations (8.3)

class TestStoryOperations:
    def test_create_story(self, temp_db, sample_batch):
        """create_story should return new story ID."""
        story_id = temp_db.create_story(
            batch_id=sample_batch,
            story_key="2b-3",
            epic_id="2b"
        )

        story = temp_db.get_story(story_id)
        assert story['batch_id'] == sample_batch
        assert story['story_key'] == "2b-3"
        assert story['epic_id'] == "2b"
        assert story['status'] == 'in-progress'

    def test_update_story(self, temp_db, sample_story):
        """update_story should modify specified fields."""
        temp_db.update_story(
            sample_story,
            status='done',
            ended_at=int(time.time())
        )

        story = temp_db.get_story(sample_story)
        assert story['status'] == 'done'
        assert story['ended_at'] is not None

    def test_get_story_by_key(self, temp_db, sample_batch, sample_story):
        """get_story_by_key should find story by key within batch."""
        found = temp_db.get_story_by_key("2a-1", sample_batch)
        assert found is not None
        assert found['id'] == sample_story

        # Wrong batch should return None
        assert temp_db.get_story_by_key("2a-1", 99999) is None

    def test_get_stories_by_batch(self, temp_db, sample_batch):
        """get_stories_by_batch should return all stories in batch."""
        temp_db.create_story(sample_batch, "1-1", "1")
        temp_db.create_story(sample_batch, "1-2", "1")
        temp_db.create_story(sample_batch, "2a-1", "2a")

        stories = temp_db.get_stories_by_batch(sample_batch)
        assert len(stories) == 3

        # Empty batch should return empty list
        empty_batch = temp_db.create_batch(max_cycles=1)
        assert temp_db.get_stories_by_batch(empty_batch) == []


# Test: Command CRUD operations (8.4)

class TestCommandOperations:
    def test_create_command(self, temp_db, sample_story):
        """create_command should return new command ID."""
        cmd_id = temp_db.create_command(
            story_id=sample_story,
            command="dev-story",
            task_id="implement"
        )

        commands = temp_db.get_commands_by_story(sample_story)
        assert len(commands) == 1
        assert commands[0]['id'] == cmd_id
        assert commands[0]['command'] == "dev-story"
        assert commands[0]['task_id'] == "implement"
        assert commands[0]['status'] == 'running'

    def test_update_command(self, temp_db, sample_story):
        """update_command should modify specified fields."""
        cmd_id = temp_db.create_command(sample_story, "code-review", "analyze")

        temp_db.update_command(
            cmd_id,
            status='completed',
            ended_at=int(time.time()),
            output_summary='(issues:0)'
        )

        commands = temp_db.get_commands_by_story(sample_story)
        assert commands[0]['status'] == 'completed'
        assert commands[0]['output_summary'] == '(issues:0)'

    def test_get_commands_by_story_ordered(self, temp_db, sample_story):
        """Commands should be returned in creation order."""
        temp_db.create_command(sample_story, "create-story", "setup")
        temp_db.create_command(sample_story, "create-story", "analyze")
        temp_db.create_command(sample_story, "create-story", "write")

        commands = temp_db.get_commands_by_story(sample_story)
        assert len(commands) == 3
        assert commands[0]['task_id'] == 'setup'
        assert commands[1]['task_id'] == 'analyze'
        assert commands[2]['task_id'] == 'write'


# Test: Event logging operations (8.5)

class TestEventOperations:
    def test_create_event(self, temp_db, sample_batch, sample_story):
        """create_event should log event with timestamp."""
        event_id = temp_db.create_event(
            batch_id=sample_batch,
            story_id=sample_story,
            command_id=None,
            epic_id="2a",
            story_key="2a-1",
            command="dev-story",
            task_id="implement",
            status="start",
            message="Starting implementation"
        )

        events = temp_db.get_events_by_batch(sample_batch)
        assert len(events) == 1
        assert events[0]['id'] == event_id
        assert events[0]['status'] == 'start'

    def test_get_events_pagination(self, temp_db, sample_batch):
        """get_events should support limit and offset."""
        # Create 5 events
        for i in range(5):
            temp_db.create_event(
                batch_id=sample_batch,
                story_id=None,
                command_id=None,
                epic_id="1",
                story_key=f"1-{i}",
                command="test",
                task_id="test",
                status="test",
                message=f"Event {i}"
            )

        # Get first 2
        events = temp_db.get_events(limit=2, offset=0)
        assert len(events) == 2

        # Get next 2
        events = temp_db.get_events(limit=2, offset=2)
        assert len(events) == 2

    def test_get_events_by_batch(self, temp_db):
        """get_events_by_batch should only return events for that batch."""
        batch1 = temp_db.create_batch(max_cycles=1)
        batch2 = temp_db.create_batch(max_cycles=1)

        temp_db.create_event(batch1, None, None, "1", "1-1", "cmd", "task", "start", "Batch 1")
        temp_db.create_event(batch2, None, None, "2", "2-1", "cmd", "task", "start", "Batch 2")

        events1 = temp_db.get_events_by_batch(batch1)
        assert len(events1) == 1
        assert "Batch 1" in events1[0]['message']


# Test: Background task operations (8.6)

class TestBackgroundTaskOperations:
    def test_create_background_task(self, temp_db, sample_batch):
        """create_background_task should create with status='running'."""
        task_id = temp_db.create_background_task(
            batch_id=sample_batch,
            story_key="2a-1",
            task_type="story-review-chain"
        )

        tasks = temp_db.get_pending_background_tasks(sample_batch)
        assert len(tasks) == 1
        assert tasks[0]['id'] == task_id
        assert tasks[0]['status'] == 'running'

    def test_update_background_task(self, temp_db, sample_batch):
        """update_background_task should modify fields."""
        task_id = temp_db.create_background_task(
            sample_batch, "2a-1", "context-refresh"
        )

        temp_db.update_background_task(
            task_id,
            status='completed',
            completed_at=int(time.time())
        )

        # Should no longer appear in pending
        pending = temp_db.get_pending_background_tasks(sample_batch)
        assert len(pending) == 0

    def test_get_pending_filters_completed(self, temp_db, sample_batch):
        """get_pending_background_tasks should only return running tasks."""
        task1 = temp_db.create_background_task(sample_batch, "1-1", "type1")
        task2 = temp_db.create_background_task(sample_batch, "1-2", "type2")

        temp_db.update_background_task(task1, status='completed')

        pending = temp_db.get_pending_background_tasks(sample_batch)
        assert len(pending) == 1
        assert pending[0]['id'] == task2


# Test: Helper queries (8.7)

class TestHelperQueries:
    def test_get_current_batch_status(self, temp_db, sample_batch):
        """get_current_batch_status should return running batch."""
        status = temp_db.get_current_batch_status()
        assert status is not None
        assert status['id'] == sample_batch

    def test_count_completed_cycles(self, temp_db, sample_batch):
        """count_completed_cycles should return cycles_completed."""
        assert temp_db.count_completed_cycles(sample_batch) == 0

        temp_db.update_batch(sample_batch, cycles_completed=5)
        assert temp_db.count_completed_cycles(sample_batch) == 5

        # Non-existent batch should return 0
        assert temp_db.count_completed_cycles(99999) == 0

    def test_check_story_blocked_false_insufficient_commands(self, temp_db, sample_story):
        """Story with < 3 commands should not be blocked."""
        temp_db.create_command(sample_story, "cmd1", "task1")
        temp_db.update_command(1, status='failed')

        temp_db.create_command(sample_story, "cmd2", "task2")
        temp_db.update_command(2, status='failed')

        # Only 2 failed commands - not blocked
        assert temp_db.check_story_blocked(sample_story) is False

    def test_check_story_blocked_true_three_failures(self, temp_db, sample_story):
        """Story with 3 consecutive failures should be blocked."""
        for i in range(3):
            cmd_id = temp_db.create_command(sample_story, f"cmd{i}", "task")
            temp_db.update_command(cmd_id, status='failed')

        assert temp_db.check_story_blocked(sample_story) is True

    def test_check_story_blocked_false_mixed_status(self, temp_db, sample_story):
        """Story with mixed statuses should not be blocked."""
        cmd1 = temp_db.create_command(sample_story, "cmd1", "task")
        temp_db.update_command(cmd1, status='failed')

        cmd2 = temp_db.create_command(sample_story, "cmd2", "task")
        temp_db.update_command(cmd2, status='completed')  # Success in between

        cmd3 = temp_db.create_command(sample_story, "cmd3", "task")
        temp_db.update_command(cmd3, status='failed')

        assert temp_db.check_story_blocked(sample_story) is False

    def test_check_story_blocked_considers_most_recent(self, temp_db, sample_story):
        """check_story_blocked should look at most recent 3 commands."""
        # Old successful commands
        for i in range(5):
            cmd_id = temp_db.create_command(sample_story, f"old{i}", "task")
            temp_db.update_command(cmd_id, status='completed')

        # Recent 3 failures
        for i in range(3):
            cmd_id = temp_db.create_command(sample_story, f"new{i}", "task")
            temp_db.update_command(cmd_id, status='failed')

        assert temp_db.check_story_blocked(sample_story) is True
```

### Acceptance Criteria

#### AC1: Database Initialization
- **Given** the dashboard folder exists at `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/`
- **When** the orchestrator imports `db.py` for the first time
- **Then** `sprint-runner.db` is created in the dashboard folder
- **And** all 5 tables are initialized with correct schema (batches, stories, commands, events, background_tasks)
- **And** foreign key constraints are enabled
- **And** an `init_db()` function is available for explicit initialization

#### AC2: Batch CRUD Operations
- **Given** the database is initialized
- **When** batch operations are needed
- **Then** the following functions work correctly:
  - `create_batch(max_cycles: int) -> int` - creates batch with started_at=now, status='running', returns batch_id
  - `update_batch(batch_id: int, **kwargs) -> None` - updates any batch fields
  - `get_batch(batch_id: int) -> Optional[dict]` - returns batch record or None
  - `get_active_batch() -> Optional[dict]` - returns batch where status='running' or None

#### AC3: Story CRUD Operations
- **Given** a batch exists
- **When** story operations are needed
- **Then** the following functions work correctly:
  - `create_story(batch_id: int, story_key: str, epic_id: str) -> int` - creates story with started_at=now, status='in-progress'
  - `update_story(story_id: int, **kwargs) -> None` - updates any story fields
  - `get_story(story_id: int) -> Optional[dict]` - returns story record or None
  - `get_story_by_key(story_key: str, batch_id: int) -> Optional[dict]` - finds story by key within batch
  - `get_stories_by_batch(batch_id: int) -> List[dict]` - returns all stories in batch

#### AC4: Command CRUD Operations
- **Given** a story exists
- **When** command tracking is needed
- **Then** the following functions work correctly:
  - `create_command(story_id: int, command: str, task_id: str) -> int` - creates command with started_at=now, status='running'
  - `update_command(command_id: int, **kwargs) -> None` - updates any command fields
  - `get_commands_by_story(story_id: int) -> List[dict]` - returns all commands for story

#### AC5: Event Logging Operations
- **Given** commands are executing
- **When** events need to be logged
- **Then** the following functions work correctly:
  - `create_event(batch_id, story_id, command_id, epic_id, story_key, command, task_id, status, message) -> int`
  - `get_events(limit: int = 100, offset: int = 0) -> List[dict]` - returns recent events
  - `get_events_by_batch(batch_id: int) -> List[dict]` - returns all events for batch

#### AC6: Background Task Operations
- **Given** background tasks may run
- **When** tracking fire-and-forget tasks
- **Then** the following functions work correctly:
  - `create_background_task(batch_id: int, story_key: str, task_type: str) -> int` - creates with spawned_at=now, status='running'
  - `update_background_task(task_id: int, **kwargs) -> None` - updates any fields
  - `get_pending_background_tasks(batch_id: int) -> List[dict]` - returns tasks where status='running'

#### AC7: Helper Queries for Decision-Making
- **Given** the orchestrator needs state information
- **When** making workflow decisions
- **Then** the following helper queries work correctly:
  - `get_current_batch_status() -> Optional[dict]` - returns running batch with cycle count or None
  - `count_completed_cycles(batch_id: int) -> int` - returns cycles_completed from batch
  - `check_story_blocked(story_id: int) -> bool` - returns True if story has 3+ consecutive failed commands

## Additional Context

### Dependencies

**Runtime Dependencies:**
- Python 3.8+ (for f-strings, typing features)
- sqlite3 (Python stdlib)
- time (Python stdlib)
- pathlib (Python stdlib)
- contextlib (Python stdlib)

**Test Dependencies:**
- pytest
- pytest-cov (optional, for coverage)

Add to `requirements.txt`:
```
pytest>=7.0.0
pytest-cov>=4.0.0
```

### Testing Strategy

1. **Unit Test Isolation**
   - Each test uses a fresh temporary database via `tmp_path` fixture
   - Tests are independent and can run in any order
   - No shared state between tests

2. **Coverage Requirements**
   - All CRUD operations have happy path tests
   - Foreign key constraint enforcement is tested
   - Edge cases: empty results, non-existent IDs, concurrent access patterns

3. **Running Tests**
   ```bash
   cd _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard
   pytest test_db.py -v
   pytest test_db.py -v --cov=db --cov-report=term-missing
   ```

### Notes

**Thread Safety Considerations:**
- The `check_same_thread=False` parameter allows SQLite connections to be used from multiple threads
- For high-concurrency scenarios, consider enabling WAL mode: `PRAGMA journal_mode=WAL`
- The per-request connection pattern avoids connection sharing issues

**Performance Considerations:**
- Indexes are created on all foreign key columns and frequently filtered columns
- For very large event tables (10k+ rows), consider pagination in queries
- Consider periodic cleanup of old batches/events if database grows too large

**Error Handling:**
- SQLite exceptions (IntegrityError, OperationalError) propagate to caller
- The orchestrator (story 5-SR-3) handles errors appropriately
- Context manager ensures connection cleanup even on exceptions

**Future Enhancements:**
- Add `get_blocked_stories(batch_id)` for dashboard display
- Add `cleanup_old_batches(days_old)` for maintenance
- Add schema versioning for migrations if schema evolves
