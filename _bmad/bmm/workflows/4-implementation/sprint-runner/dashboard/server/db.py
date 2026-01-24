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
import json
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Optional, Any, Generator, List

from .shared import DB_PATH

# =============================================================================
# Field Whitelists for SQL Injection Prevention
# =============================================================================

BATCH_FIELDS = {'started_at', 'ended_at', 'max_cycles', 'cycles_completed', 'status'}
STORY_FIELDS = {'batch_id', 'story_key', 'epic_id', 'status', 'started_at', 'ended_at'}
COMMAND_FIELDS = {'command', 'task_id', 'started_at', 'ended_at', 'status', 'output_summary'}
BACKGROUND_TASK_FIELDS = {'task_type', 'spawned_at', 'completed_at', 'status'}

# Valid story statuses for validation (E1-S1: status validation)
VALID_STORY_STATUSES = {
    'pending',      # Story created but not started
    'in-progress',  # Story currently being worked on
    'done',         # Story completed successfully
    'failed',       # Story failed after max retries
    'blocked',      # Story blocked by external issue
    'skipped',      # Story skipped (e.g., dependencies not met)
}


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
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

-- Events log (E1-S1: added event_type column, FK on batch_id)
-- E1-S2: added payload_json for complete event reconstruction
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    story_id INTEGER,
    command_id INTEGER,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    epic_id TEXT NOT NULL,
    story_key TEXT NOT NULL,
    command TEXT NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    payload_json TEXT,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (command_id) REFERENCES commands(id)
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
CREATE INDEX IF NOT EXISTS idx_stories_batch_key ON stories(batch_id, story_key);
CREATE INDEX IF NOT EXISTS idx_commands_story_id ON commands(story_id);
CREATE INDEX IF NOT EXISTS idx_events_batch_id ON events(batch_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_background_tasks_batch_id ON background_tasks(batch_id);
CREATE INDEX IF NOT EXISTS idx_background_tasks_status ON background_tasks(status);
"""


def init_db() -> None:
    """
    Initialize the database with all tables and indexes.

    Idempotent - safe to call multiple times.
    Creates sprint-runner.db in the dashboard folder if it doesn't exist.
    """
    with get_connection() as conn:
        conn.executescript(SCHEMA)

    # Run migrations for existing databases
    migrate_db()


def migrate_db() -> None:
    """Apply schema migrations for existing databases."""
    with get_connection() as conn:
        # Check if payload_json column exists in events table
        cursor = conn.execute("PRAGMA table_info(events)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'payload_json' not in columns:
            conn.execute("ALTER TABLE events ADD COLUMN payload_json TEXT")
            print("Migrated events table: added payload_json column")


# =============================================================================
# Batch Operations (AC: #2)
# =============================================================================


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
            (int(time.time() * 1000), max_cycles)  # E1-S1: millisecond timestamps
        )
        return cursor.lastrowid  # type: ignore


def update_batch(batch_id: int, **kwargs: Any) -> int:
    """
    Update batch fields.

    Args:
        batch_id: The batch to update
        **kwargs: Fields to update (ended_at, cycles_completed, status, etc.)

    Returns:
        Number of rows affected

    Raises:
        ValueError: If invalid fields are provided
    """
    if not kwargs:
        return 0

    invalid = set(kwargs.keys()) - BATCH_FIELDS
    if invalid:
        raise ValueError(f"Invalid fields for batch: {invalid}")

    fields = ', '.join(f"{k} = ?" for k in kwargs.keys())
    values = list(kwargs.values()) + [batch_id]

    with get_connection() as conn:
        cursor = conn.execute(
            f"UPDATE batches SET {fields} WHERE id = ?",
            values
        )
        return cursor.rowcount


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


# =============================================================================
# Story Operations (AC: #3)
# =============================================================================


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
            (batch_id, story_key, epic_id, int(time.time() * 1000))  # E1-S1: millisecond timestamps
        )
        return cursor.lastrowid  # type: ignore


def update_story(story_id: int, **kwargs: Any) -> int:
    """
    Update story fields.

    Args:
        story_id: The story to update
        **kwargs: Fields to update (status, ended_at, etc.)

    Returns:
        Number of rows affected

    Raises:
        ValueError: If invalid fields are provided or invalid status value
    """
    if not kwargs:
        return 0

    invalid = set(kwargs.keys()) - STORY_FIELDS
    if invalid:
        raise ValueError(f"Invalid fields for story: {invalid}")

    # E1-S1: Validate status value if provided
    if 'status' in kwargs and kwargs['status'] not in VALID_STORY_STATUSES:
        raise ValueError(
            f"Invalid story status: '{kwargs['status']}'. "
            f"Valid statuses: {sorted(VALID_STORY_STATUSES)}"
        )

    fields = ', '.join(f"{k} = ?" for k in kwargs.keys())
    values = list(kwargs.values()) + [story_id]

    with get_connection() as conn:
        cursor = conn.execute(
            f"UPDATE stories SET {fields} WHERE id = ?",
            values
        )
        return cursor.rowcount


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


def get_stories_by_batch(batch_id: int) -> List[dict]:
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


# =============================================================================
# Command Operations (AC: #4)
# =============================================================================


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
            (story_id, command, task_id, int(time.time() * 1000))  # E1-S1: millisecond timestamps
        )
        return cursor.lastrowid  # type: ignore


def update_command(command_id: int, **kwargs: Any) -> int:
    """
    Update command fields.

    Args:
        command_id: The command to update
        **kwargs: Fields to update (ended_at, status, output_summary, etc.)

    Returns:
        Number of rows affected

    Raises:
        ValueError: If invalid fields are provided
    """
    if not kwargs:
        return 0

    invalid = set(kwargs.keys()) - COMMAND_FIELDS
    if invalid:
        raise ValueError(f"Invalid fields for command: {invalid}")

    fields = ', '.join(f"{k} = ?" for k in kwargs.keys())
    values = list(kwargs.values()) + [command_id]

    with get_connection() as conn:
        cursor = conn.execute(
            f"UPDATE commands SET {fields} WHERE id = ?",
            values
        )
        return cursor.rowcount


def get_commands_by_story(story_id: int) -> List[dict]:
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


# =============================================================================
# Event Logging Operations (AC: #5)
# =============================================================================


def create_event(
    batch_id: int,
    story_id: Optional[int],
    command_id: Optional[int],
    event_type: str,
    epic_id: str,
    story_key: str,
    command: str,
    task_id: str,
    status: str,
    message: str,
    payload: Optional[dict] = None
) -> int:
    """
    Log an event with timestamp=now.

    Args:
        batch_id: Parent batch ID
        story_id: Associated story ID (optional)
        command_id: Associated command ID (optional)
        event_type: Type of event (e.g., 'command:start', 'command:end', 'command:progress')
        epic_id: Epic identifier
        story_key: Story identifier
        command: Command name
        task_id: Task phase
        status: Event status (start, end, progress)
        message: Event message
        payload: Full event payload for reconstruction (optional)

    Returns:
        The new event ID
    """
    payload_json = json.dumps(payload) if payload else None

    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO events
            (batch_id, story_id, command_id, timestamp, event_type, epic_id, story_key, command, task_id, status, message, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (batch_id, story_id, command_id, int(time.time() * 1000), event_type, epic_id, story_key, command, task_id, status, message, payload_json)
        )
        return cursor.lastrowid  # type: ignore


def get_events(limit: int = 100, offset: int = 0) -> List[dict]:
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


def get_events_by_batch(batch_id: int) -> List[dict]:
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


# =============================================================================
# Background Task Operations (AC: #6)
# =============================================================================


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
            (batch_id, story_key, task_type, int(time.time() * 1000))  # E1-S1: millisecond timestamps
        )
        return cursor.lastrowid  # type: ignore


def update_background_task(task_id: int, **kwargs: Any) -> int:
    """
    Update background task fields.

    Args:
        task_id: The task to update
        **kwargs: Fields to update (completed_at, status, etc.)

    Returns:
        Number of rows affected

    Raises:
        ValueError: If invalid fields are provided
    """
    if not kwargs:
        return 0

    invalid = set(kwargs.keys()) - BACKGROUND_TASK_FIELDS
    if invalid:
        raise ValueError(f"Invalid fields for background_task: {invalid}")

    fields = ', '.join(f"{k} = ?" for k in kwargs.keys())
    values = list(kwargs.values()) + [task_id]

    with get_connection() as conn:
        cursor = conn.execute(
            f"UPDATE background_tasks SET {fields} WHERE id = ?",
            values
        )
        return cursor.rowcount


def get_pending_background_tasks(batch_id: int) -> List[dict]:
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


# =============================================================================
# Helper Queries for Decision-Making (AC: #7)
# =============================================================================


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
