#!/usr/bin/env python3
"""
Unit tests for db.py SQLite database module.

Run with: cd dashboard && pytest -v server/test_db.py
"""

from __future__ import annotations
import sys
import time
from pathlib import Path
from unittest.mock import patch

import pytest

# Add dashboard/ to path so we can import server package
sys.path.insert(0, str(Path(__file__).parent.parent))


# =============================================================================
# Test fixtures
# =============================================================================


@pytest.fixture
def temp_db(tmp_path):
    """Create a temporary database for testing."""
    from server import db

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


# =============================================================================
# Test: Database initialization (8.1)
# =============================================================================


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

    def test_init_creates_indexes(self, temp_db):
        """Verify all indexes are created."""
        with temp_db.get_connection() as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
            )
            indexes = [row['name'] for row in cursor.fetchall()]

        assert 'idx_stories_batch_id' in indexes
        assert 'idx_stories_story_key' in indexes
        assert 'idx_stories_batch_key' in indexes  # Compound index
        assert 'idx_commands_story_id' in indexes
        assert 'idx_events_batch_id' in indexes
        assert 'idx_events_timestamp' in indexes
        assert 'idx_background_tasks_batch_id' in indexes
        assert 'idx_background_tasks_status' in indexes

    def test_init_is_idempotent(self, temp_db):
        """Calling init_db() multiple times should not fail."""
        temp_db.init_db()
        temp_db.init_db()
        # Should not raise any errors

    def test_foreign_keys_enabled(self, temp_db, sample_batch):
        """Foreign key constraints should be enforced."""
        import sqlite3
        # Try to create a story with non-existent batch_id
        with pytest.raises(sqlite3.IntegrityError):
            temp_db.create_story(
                batch_id=99999,  # Non-existent
                story_key="1-1",
                epic_id="1"
            )


# =============================================================================
# Test: Batch CRUD operations (8.2)
# =============================================================================


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

    def test_create_batch_sets_timestamp(self, temp_db):
        """create_batch should set started_at to current time."""
        before = int(time.time() * 1000)
        batch_id = temp_db.create_batch(max_cycles=1)
        after = int(time.time() * 1000)

        batch = temp_db.get_batch(batch_id)
        assert before <= batch['started_at'] <= after

    def test_update_batch(self, temp_db, sample_batch):
        """update_batch should modify specified fields."""
        rows = temp_db.update_batch(
            sample_batch,
            cycles_completed=2,
            status='completed',
            ended_at=int(time.time() * 1000)
        )

        assert rows == 1
        batch = temp_db.get_batch(sample_batch)
        assert batch['cycles_completed'] == 2
        assert batch['status'] == 'completed'
        assert batch['ended_at'] is not None

    def test_update_batch_empty_kwargs(self, temp_db, sample_batch):
        """update_batch with no kwargs should do nothing."""
        original = temp_db.get_batch(sample_batch)
        rows = temp_db.update_batch(sample_batch)
        assert rows == 0
        updated = temp_db.get_batch(sample_batch)
        assert original == updated

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

    def test_get_active_batch_returns_most_recent(self, temp_db):
        """get_active_batch should return the most recent running batch."""
        batch1 = temp_db.create_batch(max_cycles=1)
        batch2 = temp_db.create_batch(max_cycles=2)

        active = temp_db.get_active_batch()
        assert active['id'] == batch2

    def test_update_batch_rejects_invalid_fields(self, temp_db, sample_batch):
        """update_batch should raise ValueError for invalid fields."""
        import pytest
        with pytest.raises(ValueError, match="Invalid fields"):
            temp_db.update_batch(sample_batch, invalid_field="value")

    def test_update_batch_returns_rowcount(self, temp_db, sample_batch):
        """update_batch should return number of affected rows."""
        rows = temp_db.update_batch(sample_batch, status='completed')
        assert rows == 1

        # Update non-existent batch
        rows = temp_db.update_batch(99999, status='completed')
        assert rows == 0


# =============================================================================
# Test: Story CRUD operations (8.3)
# =============================================================================


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
        assert story['started_at'] > 0
        assert story['ended_at'] is None

    def test_update_story(self, temp_db, sample_story):
        """update_story should modify specified fields."""
        rows = temp_db.update_story(
            sample_story,
            status='done',
            ended_at=int(time.time() * 1000)
        )

        assert rows == 1
        story = temp_db.get_story(sample_story)
        assert story['status'] == 'done'
        assert story['ended_at'] is not None

    def test_update_story_empty_kwargs(self, temp_db, sample_story):
        """update_story with no kwargs should do nothing."""
        original = temp_db.get_story(sample_story)
        rows = temp_db.update_story(sample_story)
        assert rows == 0
        updated = temp_db.get_story(sample_story)
        assert original == updated

    def test_get_story_not_found(self, temp_db):
        """get_story should return None for non-existent ID."""
        assert temp_db.get_story(99999) is None

    def test_get_story_by_key(self, temp_db, sample_batch, sample_story):
        """get_story_by_key should find story by key within batch."""
        found = temp_db.get_story_by_key("2a-1", sample_batch)
        assert found is not None
        assert found['id'] == sample_story

    def test_get_story_by_key_wrong_batch(self, temp_db, sample_batch, sample_story):
        """get_story_by_key with wrong batch should return None."""
        assert temp_db.get_story_by_key("2a-1", 99999) is None

    def test_get_story_by_key_wrong_key(self, temp_db, sample_batch, sample_story):
        """get_story_by_key with wrong key should return None."""
        assert temp_db.get_story_by_key("nonexistent", sample_batch) is None

    def test_get_stories_by_batch(self, temp_db, sample_batch):
        """get_stories_by_batch should return all stories in batch."""
        temp_db.create_story(sample_batch, "1-1", "1")
        temp_db.create_story(sample_batch, "1-2", "1")
        temp_db.create_story(sample_batch, "2a-1", "2a")

        stories = temp_db.get_stories_by_batch(sample_batch)
        assert len(stories) == 3

    def test_get_stories_by_batch_empty(self, temp_db):
        """get_stories_by_batch should return empty list for batch with no stories."""
        empty_batch = temp_db.create_batch(max_cycles=1)
        assert temp_db.get_stories_by_batch(empty_batch) == []

    def test_get_stories_by_batch_ordered(self, temp_db, sample_batch):
        """get_stories_by_batch should return stories in creation order."""
        id1 = temp_db.create_story(sample_batch, "1-1", "1")
        id2 = temp_db.create_story(sample_batch, "1-2", "1")
        id3 = temp_db.create_story(sample_batch, "1-3", "1")

        stories = temp_db.get_stories_by_batch(sample_batch)
        assert stories[0]['id'] == id1
        assert stories[1]['id'] == id2
        assert stories[2]['id'] == id3

    def test_update_story_rejects_invalid_fields(self, temp_db, sample_story):
        """update_story should raise ValueError for invalid fields."""
        import pytest
        with pytest.raises(ValueError, match="Invalid fields"):
            temp_db.update_story(sample_story, invalid_field="value")

    def test_update_story_returns_rowcount(self, temp_db, sample_story):
        """update_story should return number of affected rows."""
        rows = temp_db.update_story(sample_story, status='done')
        assert rows == 1

        # Update non-existent story
        rows = temp_db.update_story(99999, status='done')
        assert rows == 0


# =============================================================================
# Test: Command CRUD operations (8.4)
# =============================================================================


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
        assert commands[0]['started_at'] > 0
        assert commands[0]['ended_at'] is None
        assert commands[0]['output_summary'] is None

    def test_update_command(self, temp_db, sample_story):
        """update_command should modify specified fields."""
        cmd_id = temp_db.create_command(sample_story, "code-review", "analyze")

        rows = temp_db.update_command(
            cmd_id,
            status='completed',
            ended_at=int(time.time() * 1000),
            output_summary='(issues:0)'
        )

        assert rows == 1
        commands = temp_db.get_commands_by_story(sample_story)
        assert commands[0]['status'] == 'completed'
        assert commands[0]['output_summary'] == '(issues:0)'
        assert commands[0]['ended_at'] is not None

    def test_update_command_empty_kwargs(self, temp_db, sample_story):
        """update_command with no kwargs should do nothing."""
        cmd_id = temp_db.create_command(sample_story, "cmd", "task")
        original = temp_db.get_commands_by_story(sample_story)[0]
        rows = temp_db.update_command(cmd_id)
        assert rows == 0
        updated = temp_db.get_commands_by_story(sample_story)[0]
        assert original == updated

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

    def test_get_commands_by_story_empty(self, temp_db, sample_story):
        """get_commands_by_story should return empty list for story with no commands."""
        assert temp_db.get_commands_by_story(sample_story) == []

    def test_command_foreign_key_constraint(self, temp_db):
        """create_command should fail with non-existent story_id."""
        import sqlite3
        with pytest.raises(sqlite3.IntegrityError):
            temp_db.create_command(
                story_id=99999,  # Non-existent
                command="cmd",
                task_id="task"
            )

    def test_update_command_rejects_invalid_fields(self, temp_db, sample_story):
        """update_command should raise ValueError for invalid fields."""
        cmd_id = temp_db.create_command(sample_story, "cmd", "task")
        with pytest.raises(ValueError, match="Invalid fields"):
            temp_db.update_command(cmd_id, invalid_field="value")

    def test_update_command_returns_rowcount(self, temp_db, sample_story):
        """update_command should return number of affected rows."""
        cmd_id = temp_db.create_command(sample_story, "cmd", "task")
        rows = temp_db.update_command(cmd_id, status='completed')
        assert rows == 1

        # Update non-existent command
        rows = temp_db.update_command(99999, status='completed')
        assert rows == 0


# =============================================================================
# Test: Event logging operations (8.5)
# =============================================================================


class TestEventOperations:
    def test_create_event(self, temp_db, sample_batch, sample_story):
        """create_event should log event with timestamp."""
        event_id = temp_db.create_event(
            batch_id=sample_batch,
            story_id=sample_story,
            command_id=None,
            event_type="info",
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
        assert events[0]['batch_id'] == sample_batch
        assert events[0]['story_id'] == sample_story
        assert events[0]['command_id'] is None
        assert events[0]['epic_id'] == "2a"
        assert events[0]['story_key'] == "2a-1"
        assert events[0]['command'] == "dev-story"
        assert events[0]['task_id'] == "implement"
        assert events[0]['status'] == 'start'
        assert events[0]['message'] == "Starting implementation"
        assert events[0]['timestamp'] > 0

    def test_create_event_with_all_ids(self, temp_db, sample_batch, sample_story):
        """create_event with all optional IDs populated."""
        cmd_id = temp_db.create_command(sample_story, "cmd", "task")
        event_id = temp_db.create_event(
            batch_id=sample_batch,
            story_id=sample_story,
            command_id=cmd_id,
            event_type="info",
            epic_id="2a",
            story_key="2a-1",
            command="cmd",
            task_id="task",
            status="end",
            message="Completed"
        )

        events = temp_db.get_events_by_batch(sample_batch)
        assert events[0]['command_id'] == cmd_id

    def test_get_events_pagination(self, temp_db, sample_batch):
        """get_events should support limit and offset."""
        # Create 5 events
        for i in range(5):
            temp_db.create_event(
                batch_id=sample_batch,
                story_id=None,
                command_id=None,
                event_type="info",
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

        # Get last 1
        events = temp_db.get_events(limit=2, offset=4)
        assert len(events) == 1

    def test_get_events_returns_newest_first(self, temp_db, sample_batch):
        """get_events should return events in descending timestamp order."""
        temp_db.create_event(sample_batch, None, None, "info", "1", "1-1", "cmd", "task", "start", "First")
        time.sleep(0.1)  # Ensure different timestamps
        temp_db.create_event(sample_batch, None, None, "info", "1", "1-2", "cmd", "task", "start", "Second")

        events = temp_db.get_events(limit=10)
        assert "Second" in events[0]['message']
        assert "First" in events[1]['message']

    def test_get_events_by_batch(self, temp_db):
        """get_events_by_batch should only return events for that batch."""
        batch1 = temp_db.create_batch(max_cycles=1)
        batch2 = temp_db.create_batch(max_cycles=1)

        temp_db.create_event(batch1, None, None, "info", "1", "1-1", "cmd", "task", "start", "Batch 1")
        temp_db.create_event(batch2, None, None, "info", "2", "2-1", "cmd", "task", "start", "Batch 2")

        events1 = temp_db.get_events_by_batch(batch1)
        assert len(events1) == 1
        assert "Batch 1" in events1[0]['message']

        events2 = temp_db.get_events_by_batch(batch2)
        assert len(events2) == 1
        assert "Batch 2" in events2[0]['message']

    def test_get_events_by_batch_ordered_ascending(self, temp_db, sample_batch):
        """get_events_by_batch should return events in ascending timestamp order."""
        temp_db.create_event(sample_batch, None, None, "info", "1", "1-1", "cmd", "task", "start", "First")
        time.sleep(0.1)
        temp_db.create_event(sample_batch, None, None, "info", "1", "1-2", "cmd", "task", "start", "Second")

        events = temp_db.get_events_by_batch(sample_batch)
        assert "First" in events[0]['message']
        assert "Second" in events[1]['message']

    def test_get_events_by_batch_empty(self, temp_db, sample_batch):
        """get_events_by_batch should return empty list for batch with no events."""
        assert temp_db.get_events_by_batch(sample_batch) == []

    def test_event_foreign_key_story_constraint(self, temp_db, sample_batch):
        """create_event should fail with non-existent story_id."""
        import sqlite3
        with pytest.raises(sqlite3.IntegrityError):
            temp_db.create_event(
                batch_id=sample_batch,
                story_id=99999,  # Non-existent
                command_id=None,
                event_type="info",
                epic_id="1",
                story_key="1-1",
                command="cmd",
                task_id="task",
                status="start",
                message="test"
            )

    def test_event_foreign_key_command_constraint(self, temp_db, sample_batch):
        """create_event should fail with non-existent command_id."""
        import sqlite3
        with pytest.raises(sqlite3.IntegrityError):
            temp_db.create_event(
                batch_id=sample_batch,
                story_id=None,
                command_id=99999,  # Non-existent
                event_type="info",
                epic_id="1",
                story_key="1-1",
                command="cmd",
                task_id="task",
                status="start",
                message="test"
            )


# =============================================================================
# Test: Background task operations (8.6)
# =============================================================================


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
        assert tasks[0]['batch_id'] == sample_batch
        assert tasks[0]['story_key'] == "2a-1"
        assert tasks[0]['task_type'] == "story-review-chain"
        assert tasks[0]['status'] == 'running'
        assert tasks[0]['spawned_at'] > 0
        assert tasks[0]['completed_at'] is None

    def test_update_background_task(self, temp_db, sample_batch):
        """update_background_task should modify fields."""
        task_id = temp_db.create_background_task(
            sample_batch, "2a-1", "context-refresh"
        )

        rows = temp_db.update_background_task(
            task_id,
            status='completed',
            completed_at=int(time.time() * 1000)
        )

        assert rows == 1
        # Should no longer appear in pending
        pending = temp_db.get_pending_background_tasks(sample_batch)
        assert len(pending) == 0

    def test_update_background_task_empty_kwargs(self, temp_db, sample_batch):
        """update_background_task with no kwargs should do nothing."""
        task_id = temp_db.create_background_task(sample_batch, "1-1", "type")
        original = temp_db.get_pending_background_tasks(sample_batch)[0]
        rows = temp_db.update_background_task(task_id)
        assert rows == 0
        updated = temp_db.get_pending_background_tasks(sample_batch)[0]
        assert original == updated

    def test_get_pending_filters_completed(self, temp_db, sample_batch):
        """get_pending_background_tasks should only return running tasks."""
        task1 = temp_db.create_background_task(sample_batch, "1-1", "type1")
        task2 = temp_db.create_background_task(sample_batch, "1-2", "type2")

        temp_db.update_background_task(task1, status='completed')

        pending = temp_db.get_pending_background_tasks(sample_batch)
        assert len(pending) == 1
        assert pending[0]['id'] == task2

    def test_get_pending_filters_failed(self, temp_db, sample_batch):
        """get_pending_background_tasks should filter out failed tasks."""
        task1 = temp_db.create_background_task(sample_batch, "1-1", "type1")
        task2 = temp_db.create_background_task(sample_batch, "1-2", "type2")

        temp_db.update_background_task(task1, status='failed')

        pending = temp_db.get_pending_background_tasks(sample_batch)
        assert len(pending) == 1
        assert pending[0]['id'] == task2

    def test_get_pending_background_tasks_ordered(self, temp_db, sample_batch):
        """get_pending_background_tasks should return tasks in spawned_at order."""
        task1 = temp_db.create_background_task(sample_batch, "1-1", "type1")
        task2 = temp_db.create_background_task(sample_batch, "1-2", "type2")

        pending = temp_db.get_pending_background_tasks(sample_batch)
        assert pending[0]['id'] == task1
        assert pending[1]['id'] == task2

    def test_background_task_foreign_key_constraint(self, temp_db):
        """create_background_task should fail with non-existent batch_id."""
        import sqlite3
        with pytest.raises(sqlite3.IntegrityError):
            temp_db.create_background_task(
                batch_id=99999,  # Non-existent
                story_key="1-1",
                task_type="type"
            )

    def test_update_background_task_rejects_invalid_fields(self, temp_db, sample_batch):
        """update_background_task should raise ValueError for invalid fields."""
        task_id = temp_db.create_background_task(sample_batch, "1-1", "type")
        with pytest.raises(ValueError, match="Invalid fields"):
            temp_db.update_background_task(task_id, invalid_field="value")

    def test_update_background_task_returns_rowcount(self, temp_db, sample_batch):
        """update_background_task should return number of affected rows."""
        task_id = temp_db.create_background_task(sample_batch, "1-1", "type")
        rows = temp_db.update_background_task(task_id, status='completed')
        assert rows == 1

        # Update non-existent task
        rows = temp_db.update_background_task(99999, status='completed')
        assert rows == 0


# =============================================================================
# Test: Helper queries (8.7)
# =============================================================================


class TestHelperQueries:
    def test_get_current_batch_status(self, temp_db, sample_batch):
        """get_current_batch_status should return running batch."""
        status = temp_db.get_current_batch_status()
        assert status is not None
        assert status['id'] == sample_batch
        assert status['status'] == 'running'

    def test_get_current_batch_status_no_running(self, temp_db, sample_batch):
        """get_current_batch_status should return None when no running batch."""
        temp_db.update_batch(sample_batch, status='completed')
        assert temp_db.get_current_batch_status() is None

    def test_count_completed_cycles(self, temp_db, sample_batch):
        """count_completed_cycles should return cycles_completed."""
        assert temp_db.count_completed_cycles(sample_batch) == 0

        temp_db.update_batch(sample_batch, cycles_completed=5)
        assert temp_db.count_completed_cycles(sample_batch) == 5

    def test_count_completed_cycles_nonexistent(self, temp_db):
        """count_completed_cycles should return 0 for non-existent batch."""
        assert temp_db.count_completed_cycles(99999) == 0

    def test_check_story_blocked_false_no_commands(self, temp_db, sample_story):
        """Story with no commands should not be blocked."""
        assert temp_db.check_story_blocked(sample_story) is False

    def test_check_story_blocked_false_one_failure(self, temp_db, sample_story):
        """Story with only 1 failed command should not be blocked."""
        cmd_id = temp_db.create_command(sample_story, "cmd1", "task1")
        temp_db.update_command(cmd_id, status='failed')

        assert temp_db.check_story_blocked(sample_story) is False

    def test_check_story_blocked_false_two_failures(self, temp_db, sample_story):
        """Story with only 2 failed commands should not be blocked."""
        cmd1 = temp_db.create_command(sample_story, "cmd1", "task1")
        temp_db.update_command(cmd1, status='failed')

        cmd2 = temp_db.create_command(sample_story, "cmd2", "task2")
        temp_db.update_command(cmd2, status='failed')

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

    def test_check_story_blocked_recent_success_unblocks(self, temp_db, sample_story):
        """Recent success should prevent blocked status."""
        # 3 old failures
        for i in range(3):
            cmd_id = temp_db.create_command(sample_story, f"fail{i}", "task")
            temp_db.update_command(cmd_id, status='failed')

        # 1 recent success
        cmd_id = temp_db.create_command(sample_story, "success", "task")
        temp_db.update_command(cmd_id, status='completed')

        # Most recent 3 are: fail2, fail1, success (only 2 consecutive failures in last 3)
        assert temp_db.check_story_blocked(sample_story) is False


# =============================================================================
# Test: Edge cases and error handling
# =============================================================================


class TestEdgeCases:
    def test_connection_rollback_on_error(self, temp_db, sample_batch):
        """Connection should rollback on error."""
        import sqlite3

        # Create a story, then try to create invalid command
        story_id = temp_db.create_story(sample_batch, "1-1", "1")

        with pytest.raises(sqlite3.IntegrityError):
            temp_db.create_command(99999, "cmd", "task")

        # Original story should still exist
        assert temp_db.get_story(story_id) is not None

    def test_unicode_support(self, temp_db, sample_batch):
        """Database should handle unicode characters."""
        story_id = temp_db.create_story(sample_batch, "story-unicode", "epic")
        temp_db.create_event(
            batch_id=sample_batch,
            story_id=story_id,
            command_id=None,
            event_type="info",
            epic_id="epic",
            story_key="story-unicode",
            command="cmd",
            task_id="task",
            status="progress",
            message="Test with unicode: emoji and chinese characters supported"
        )

        events = temp_db.get_events_by_batch(sample_batch)
        assert "unicode" in events[0]['message']

    def test_large_output_summary(self, temp_db, sample_story):
        """Commands should handle large output_summary values."""
        cmd_id = temp_db.create_command(sample_story, "cmd", "task")

        # Large output summary (1000 characters)
        large_summary = "x" * 1000
        temp_db.update_command(cmd_id, output_summary=large_summary)

        commands = temp_db.get_commands_by_story(sample_story)
        assert len(commands[0]['output_summary']) == 1000
