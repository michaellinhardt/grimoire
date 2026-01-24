# REVIEW-SERVER-SPAWN.md: Study Validation Report

**Review Date**: 2026-01-24
**Reviewer**: Claude Code (Automated)
**Study Reviewed**: STUDY-SERVER-SPAWN.md
**Verification Status**: NEEDS-WORK

---

## 1. Issues Found (with Corrections Applied)

### 1.1 Minor Line Number Corrections

| Location | Original | Corrected | Description |
|----------|----------|-----------|-------------|
| server.py imports | "lines 574-575" | "line 574" | Import is single line |
| orchestrator.py imports | "lines 92-96" | "lines 91-96" | Comment line was excluded |
| sprint-log.sh paths | "Lines 69-72" | "Lines 70-72" | Off by one |
| sprint-log.sh validation | "lines 50-61" | "lines 51-61" | Off by one |

**Status**: Corrected in study file.

### 1.2 Missing Constants Added

The following were missing from the Database Constants table:

| Constant | Value | Line | Purpose |
|----------|-------|------|---------|
| `BACKGROUND_TASK_FIELDS` | `{'task_type', 'spawned_at', ...}` | 32 | Whitelist for background task updates |
| `VALID_STORY_STATUSES` | `{'pending', 'in-progress', ...}` | 35-42 | Valid story status values for validation |

**Status**: Added to study file.

---

## 2. Gaps Identified

### 2.1 CRITICAL: Timestamp Format Mismatch

**Discovery**: The `sprint-log.sh` script outputs timestamps in human-readable format:
```bash
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")  # Line 64
```

But the orchestrator's `_parse_csv_log_line()` method (lines 856-878) expects Unix epoch seconds:
```python
timestamp = int(row[0])
# Validation: now - 31536000 <= timestamp <= now + 3600
```

**Impact**: The orchestrator will **reject all CSV lines** from sprint-log.sh because:
1. `int("2026-01-24 12:34:56")` will raise `ValueError`
2. Even if parsed, the date string won't pass timestamp validation

**Resolution Required**: Either:
- Update sprint-log.sh to output Unix epoch seconds: `TIMESTAMP=$(date +%s)`
- Or update orchestrator to parse human-readable timestamps

**Status**: Added note to study file. Requires implementation fix.

### 2.2 Missing Sprint-log.sh SQLite Integration Details

The study mentions "designed to eventually write directly to SQLite" but lacks:
- Specific database path resolution strategy
- Event type derivation logic from status field
- batch_id acquisition mechanism (script doesn't have access to current batch)
- Transaction handling for concurrent writes

**Recommendation**: Add section on sprint-log.sh SQLite requirements:
```bash
# Proposed fields needed:
# - DB_PATH: How to find server/sprint-runner.db
# - BATCH_ID: How to get current running batch
# - EVENT_TYPE: Mapping from status to event_type
```

### 2.3 Missing Event Type Enumeration

The study documents `EventType` enum in server.py but doesn't list all values. Complete list:

```python
class EventType(str, Enum):
    BATCH_START = "batch:start"
    BATCH_END = "batch:end"
    BATCH_WARNING = "batch:warning"
    CYCLE_START = "cycle:start"
    CYCLE_END = "cycle:end"
    COMMAND_START = "command:start"
    COMMAND_PROGRESS = "command:progress"
    COMMAND_END = "command:end"
    STORY_STATUS = "story:status"
    ERROR = "error"
    CONTEXT_CREATE = "context:create"
    CONTEXT_REFRESH = "context:refresh"
    CONTEXT_COMPLETE = "context:complete"
    PONG = "pong"
```

### 2.4 Missing Payload Validation Schemas

The study doesn't document `EVENT_PAYLOAD_SCHEMAS` (server.py lines 120-142) which defines required fields for each event type.

---

## 3. Verification Status

| Category | Status | Notes |
|----------|--------|-------|
| Line number accuracy | PASS | Minor corrections applied |
| Constant values | PASS | All values verified correct |
| Function signatures | PASS | All match actual code |
| Subprocess spawning | PASS | Correctly described |
| Import dependencies | PASS | All documented |
| Database schema | PASS | Complete and accurate |
| Sprint-log.sh analysis | NEEDS-WORK | Timestamp format critical issue |
| Completeness | NEEDS-WORK | Missing some constants/enums |

**Overall Status**: NEEDS-WORK

The study is accurate on the facts it covers, but has one critical gap (timestamp format mismatch) that will cause runtime failures.

---

## 4. Additional Findings

### 4.1 Circular Import Handling

The study correctly identifies the circular dependency mitigation:
- orchestrator.py uses try/except for server imports
- server.py lazy-imports orchestrator in handler functions

This pattern is safe and correctly documented.

### 4.2 Graceful Shutdown Pattern

The study correctly documents the `_background_tasks` tracking and cancellation in `stop()` method.

### 4.3 Database Timestamp Consistency

All Python code uses millisecond timestamps (`int(time.time() * 1000)`):
- db.py create_batch, create_story, create_command, create_event, create_background_task
- orchestrator.py emit_event
- server.py broadcast

This is consistent and well-documented in the study.

### 4.4 Static File Serving Path

The study correctly identifies that after restructuring:
- `DASHBOARD_DIR` will need to point to `../frontend/`
- Line 894 `DASHBOARD_DIR / filename` must be updated

---

## 5. Recommendations

1. **Immediate**: Fix sprint-log.sh timestamp format before integration testing
2. **Before Restructuring**: Create shared.py with centralized constants
3. **Documentation**: Add EVENT_PAYLOAD_SCHEMAS to study for frontend developers
4. **Testing**: Add integration test that verifies CSV parsing works with actual sprint-log.sh output

---

## Appendix: Files Reviewed

| File | Lines | Last Verified |
|------|-------|---------------|
| orchestrator.py | 1587 | 2026-01-24 |
| server.py | 1021 | 2026-01-24 |
| db.py | 673 | 2026-01-24 |
| sprint-log.sh | 103 | 2026-01-24 |
| STUDY-SERVER-SPAWN.md | 473 | 2026-01-24 |
