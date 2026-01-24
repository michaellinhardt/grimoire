# Story 5-SR.2: SQLite Database Schema and Operations

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want **a SQLite database to track orchestrator state**,
So that **sprint execution can persist across sessions and provide queryable event history**.

## Acceptance Criteria

1. **AC1: Database Initialization**
   - Given the dashboard folder exists at `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/`
   - When the orchestrator imports `db.py` for the first time
   - Then `sprint-runner.db` is created in the dashboard folder
   - And all 5 tables are initialized with correct schema (batches, stories, commands, events, background_tasks)
   - And foreign key constraints are enabled
   - And an `init_db()` function is available for explicit initialization

2. **AC2: Batch CRUD Operations**
   - Given the database is initialized
   - When batch operations are needed
   - Then the following functions work correctly:
     - `create_batch(max_cycles: int) -> int` - creates batch with started_at=now, status='running', returns batch_id
     - `update_batch(batch_id: int, **kwargs) -> None` - updates any batch fields
     - `get_batch(batch_id: int) -> Optional[dict]` - returns batch record or None
     - `get_active_batch() -> Optional[dict]` - returns batch where status='running' or None

3. **AC3: Story CRUD Operations**
   - Given a batch exists
   - When story operations are needed
   - Then the following functions work correctly:
     - `create_story(batch_id: int, story_key: str, epic_id: str) -> int` - creates story with started_at=now, status='in-progress'
     - `update_story(story_id: int, **kwargs) -> None` - updates any story fields
     - `get_story(story_id: int) -> Optional[dict]` - returns story record or None
     - `get_story_by_key(story_key: str, batch_id: int) -> Optional[dict]` - finds story by key within batch
     - `get_stories_by_batch(batch_id: int) -> List[dict]` - returns all stories in batch

4. **AC4: Command CRUD Operations**
   - Given a story exists
   - When command tracking is needed
   - Then the following functions work correctly:
     - `create_command(story_id: int, command: str, task_id: str) -> int` - creates command with started_at=now, status='running'
     - `update_command(command_id: int, **kwargs) -> None` - updates any command fields
     - `get_commands_by_story(story_id: int) -> List[dict]` - returns all commands for story

5. **AC5: Event Logging Operations**
   - Given commands are executing
   - When events need to be logged
   - Then the following functions work correctly:
     - `create_event(batch_id: int, story_id: Optional[int], command_id: Optional[int], epic_id: str, story_key: str, command: str, task_id: str, status: str, message: str) -> int`
     - `get_events(limit: int = 100, offset: int = 0) -> List[dict]` - returns recent events
     - `get_events_by_batch(batch_id: int) -> List[dict]` - returns all events for batch

6. **AC6: Background Task Operations**
   - Given background tasks may run
   - When tracking fire-and-forget tasks
   - Then the following functions work correctly:
     - `create_background_task(batch_id: int, story_key: str, task_type: str) -> int` - creates with spawned_at=now, status='running'
     - `update_background_task(task_id: int, **kwargs) -> None` - updates any fields
     - `get_pending_background_tasks(batch_id: int) -> List[dict]` - returns tasks where status='running'

7. **AC7: Helper Queries for Decision-Making**
   - Given the orchestrator needs state information
   - When making workflow decisions
   - Then the following helper queries work correctly:
     - `get_current_batch_status() -> Optional[dict]` - returns running batch with cycle count or None
     - `count_completed_cycles(batch_id: int) -> int` - returns cycles_completed from batch
     - `check_story_blocked(story_id: int) -> bool` - returns True if story has 3+ consecutive failed commands

## Tasks / Subtasks

- [x] Task 1: Create db.py module with database schema (AC: #1)
  - [x] 1.1 Create `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py`
  - [x] 1.2 Define all CREATE TABLE statements matching the schema
  - [x] 1.3 Implement `init_db()` function with idempotent table creation
  - [x] 1.4 Enable foreign key constraints via PRAGMA
  - [x] 1.5 Implement connection context manager for thread safety

- [x] Task 2: Implement batch operations (AC: #2)
  - [x] 2.1 Implement `create_batch(max_cycles: int) -> int`
  - [x] 2.2 Implement `update_batch(batch_id: int, **kwargs) -> None`
  - [x] 2.3 Implement `get_batch(batch_id: int) -> Optional[dict]`
  - [x] 2.4 Implement `get_active_batch() -> Optional[dict]`

- [x] Task 3: Implement story operations (AC: #3)
  - [x] 3.1 Implement `create_story(batch_id: int, story_key: str, epic_id: str) -> int`
  - [x] 3.2 Implement `update_story(story_id: int, **kwargs) -> None`
  - [x] 3.3 Implement `get_story(story_id: int) -> Optional[dict]`
  - [x] 3.4 Implement `get_story_by_key(story_key: str, batch_id: int) -> Optional[dict]`
  - [x] 3.5 Implement `get_stories_by_batch(batch_id: int) -> List[dict]`

- [x] Task 4: Implement command operations (AC: #4)
  - [x] 4.1 Implement `create_command(story_id: int, command: str, task_id: str) -> int`
  - [x] 4.2 Implement `update_command(command_id: int, **kwargs) -> None`
  - [x] 4.3 Implement `get_commands_by_story(story_id: int) -> List[dict]`

- [x] Task 5: Implement event logging operations (AC: #5)
  - [x] 5.1 Implement `create_event(...)` with all parameters
  - [x] 5.2 Implement `get_events(limit: int, offset: int) -> List[dict]`
  - [x] 5.3 Implement `get_events_by_batch(batch_id: int) -> List[dict]`

- [x] Task 6: Implement background task operations (AC: #6)
  - [x] 6.1 Implement `create_background_task(batch_id: int, story_key: str, task_type: str) -> int`
  - [x] 6.2 Implement `update_background_task(task_id: int, **kwargs) -> None`
  - [x] 6.3 Implement `get_pending_background_tasks(batch_id: int) -> List[dict]`

- [x] Task 7: Implement helper queries (AC: #7)
  - [x] 7.1 Implement `get_current_batch_status() -> Optional[dict]`
  - [x] 7.2 Implement `count_completed_cycles(batch_id: int) -> int`
  - [x] 7.3 Implement `check_story_blocked(story_id: int) -> bool` (3+ consecutive failures)

- [x] Task 8: Write unit tests for all functions
  - [x] 8.1 Test database initialization and table creation
  - [x] 8.2 Test all batch CRUD operations
  - [x] 8.3 Test all story CRUD operations
  - [x] 8.4 Test all command CRUD operations
  - [x] 8.5 Test all event logging operations
  - [x] 8.6 Test all background task operations
  - [x] 8.7 Test all helper queries including edge cases

## Dev Notes

### Database Schema

```sql
CREATE TABLE batches (
  id INTEGER PRIMARY KEY,
  started_at INTEGER NOT NULL,      -- Unix timestamp
  ended_at INTEGER,                 -- Unix timestamp, NULL while running
  max_cycles INTEGER NOT NULL,
  cycles_completed INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running'  -- running, completed, stopped, error
);

CREATE TABLE stories (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  story_key TEXT NOT NULL,          -- e.g., "2a-1"
  epic_id TEXT NOT NULL,            -- e.g., "2a"
  status TEXT NOT NULL DEFAULT 'in-progress',
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE commands (
  id INTEGER PRIMARY KEY,
  story_id INTEGER NOT NULL,
  command TEXT NOT NULL,            -- e.g., "create-story", "code-review-2"
  task_id TEXT NOT NULL,            -- e.g., "setup", "analyze"
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT NOT NULL DEFAULT 'running',  -- running, completed, failed
  output_summary TEXT,              -- Optional: key metrics extracted
  FOREIGN KEY (story_id) REFERENCES stories(id)
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  story_id INTEGER,
  command_id INTEGER,
  timestamp INTEGER NOT NULL,
  epic_id TEXT NOT NULL,
  story_key TEXT NOT NULL,
  command TEXT NOT NULL,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL,             -- start, end, progress
  message TEXT
);

CREATE TABLE background_tasks (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  story_key TEXT NOT NULL,
  task_type TEXT NOT NULL,          -- story-review-chain, tech-spec-review-chain, context-refresh
  spawned_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'running',  -- running, completed, failed
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);
```

### Implementation Patterns

1. **Connection Management**
   - Use a module-level `DB_PATH` constant pointing to `sprint-runner.db` in the same directory
   - Use context manager pattern for all connections
   - Enable foreign keys via `PRAGMA foreign_keys = ON`

2. **Thread Safety**
   - Create a new connection per operation (SQLite handles this well for single-file access)
   - Use `check_same_thread=False` if needed for async operations

3. **Timestamps**
   - All timestamps stored as Unix epoch integers (seconds)
   - Use `int(time.time())` for current timestamp

4. **Return Types**
   - All get functions return `dict` or `List[dict]` using `sqlite3.Row` factory
   - Create operations return the new row's `id` (lastrowid)
   - Update operations return `None` (void)

5. **Error Handling**
   - Let SQLite exceptions propagate (IntegrityError, OperationalError)
   - Caller handles errors appropriately

6. **Blocked Story Detection (check_story_blocked)**
   - Query last 3 commands for the story
   - If all 3 have status='failed', return True
   - Else return False

### File Location

```
_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/
  db.py                  <- THIS STORY
  sprint-runner.db       <- Created on first init_db() call
  server.py              <- From story 5-SR-1
  dashboard.html         <- From story 5-SR-1
  requirements.txt       <- From story 5-SR-1
```

### Testing Approach

- Use `tempfile.NamedTemporaryFile` for test database
- Test each function in isolation
- Test foreign key constraints enforcement
- Test edge cases: empty results, non-existent IDs, concurrent access

### Project Structure Notes

- This is a Python module in the BMAD workflow system
- Does NOT use the Grimoire Electron app patterns
- Standalone Python script, no React/TypeScript involved
- Tests should use pytest (add to requirements.txt if needed)

### References

- [Source: _bmad-output/planning-artifacts/epic-5-sprint-runner-dashboard.md#Story-5-SR-2]
- [Source: _bmad-output/planning-artifacts/epic-5-sprint-runner-dashboard-context.md#SQLite-Database]
- [Source: _bmad-output/implementation-artifacts/sprint-runner-orchestrator-study.md#SQLite-Database-Schema]

## Tech-Spec Decision

**[TECH-SPEC-DECISION: REQUIRED]**

A tech-spec is required to:
1. Define exact index requirements for performance (events table will grow large)
2. Specify connection pooling strategy for async orchestrator
3. Document transaction boundaries for multi-step operations
4. Define error handling and retry patterns
5. Specify migration strategy for future schema changes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None required - all tests pass on first run.

### Completion Notes List

1. **Task 1 (AC1)**: Created `db.py` with complete SQLite schema including 5 tables (batches, stories, commands, events, background_tasks) and 7 indexes for query performance. Connection context manager pattern implemented with foreign key enforcement via PRAGMA.

2. **Task 2 (AC2)**: Implemented all batch CRUD operations: `create_batch()`, `update_batch()`, `get_batch()`, `get_active_batch()`. All use context manager pattern and proper return types.

3. **Task 3 (AC3)**: Implemented all story CRUD operations: `create_story()`, `update_story()`, `get_story()`, `get_story_by_key()`, `get_stories_by_batch()`. Foreign key constraint on batch_id enforced.

4. **Task 4 (AC4)**: Implemented all command CRUD operations: `create_command()`, `update_command()`, `get_commands_by_story()`. Commands ordered by ID for chronological access.

5. **Task 5 (AC5)**: Implemented all event logging operations: `create_event()` with all parameters, `get_events()` with pagination (newest first), `get_events_by_batch()` (chronological order).

6. **Task 6 (AC6)**: Implemented all background task operations: `create_background_task()`, `update_background_task()`, `get_pending_background_tasks()` (filters to status='running' only).

7. **Task 7 (AC7)**: Implemented all helper queries: `get_current_batch_status()`, `count_completed_cycles()`, `check_story_blocked()` (detects 3+ consecutive failures).

8. **Task 8**: Created comprehensive test suite with 55 tests covering all CRUD operations, edge cases, foreign key constraints, unicode support, and rollback behavior. All tests pass (55/55 in 0.56s).

### Change Log

- 2026-01-24: Initial implementation of SQLite database module with complete schema, CRUD operations for all 5 tables, helper queries, and 55 unit tests. All acceptance criteria satisfied.

### File List

- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py` (NEW)
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/test_db.py` (NEW)
- `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/requirements.txt` (MODIFIED - added pytest dependencies)
