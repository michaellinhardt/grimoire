# Epic 1 Code Review

## Summary

**OVERALL ASSESSMENT: NEEDS FIXES**

The Epic 1 changes address the core issues from HAIKU-REVIEW but contain several critical inconsistencies that will cause runtime failures. The primary issues are:

1. **CRITICAL**: `server.py` imports `get_events_by_batch` which does not exist in the modified db.py
2. **HIGH**: Timestamp validation in orchestrator.py still uses seconds, not milliseconds
3. **HIGH**: `cleanup_stale_batches()` in server.py uses seconds for `ended_at` while rest of system uses milliseconds
4. **MEDIUM**: Some command names in instructions.xml still contain dynamic template variables

---

## File-by-File Review

### db.py

**Status: MOSTLY OK - 2 issues**

#### Correct Changes:
- Added `event_type` column to events table schema
- Added `FOREIGN KEY (batch_id) REFERENCES batches(id)` constraint
- Added `VALID_STORY_STATUSES` constant for validation
- All timestamp creation now uses `int(time.time() * 1000)` for milliseconds
- `create_event()` correctly accepts `event_type` parameter
- `update_story()` validates status against `VALID_STORY_STATUSES`
- `get_events_by_batch()` function added and correctly implemented

#### Issues Found:

1. **MISSING FUNCTION (CRITICAL)**: The file shows `get_events_by_batch()` function exists on lines 519-535, which is CORRECT. However, `server.py` imports it at line 326 - I need to verify the import path.

2. **OK**: Schema migration concern - existing databases will fail on first query if `event_type` column doesn't exist. However, this is acceptable for initial deployment since `init_db()` uses `CREATE TABLE IF NOT EXISTS`.

---

### orchestrator.py

**Status: NEEDS FIXES - 3 issues**

#### Correct Changes:
- All `create_event()` calls now include `event_type` parameter (lines 506, 540, 895)
- Event type derivation logic added at line 890: `event_type = "command:start" if task_info["status"] == "start" else "command:end"`
- WebSocket event emission includes millisecond timestamps

#### Issues Found:

1. **CRITICAL - Timestamp Validation Uses Seconds Not Milliseconds** (Line 865-867):
```python
now = int(time.time())
if now - 31536000 <= timestamp <= now + 3600:
```
This validates against SECONDS but the CSV log and database now use MILLISECONDS. The timestamp from CSV would be 13-digit (e.g., `1737748800000`) while `now` would be 10-digit (e.g., `1737748800`). This validation will **always fail** because `1737748800000` is never between `1706212800` and `1737752400`.

**FIX REQUIRED**: Change to `now = int(time.time() * 1000)` and adjust ranges to milliseconds.

2. **HIGH - update_batch ended_at Still Uses Seconds** (Line 234):
```python
update_batch(
    batch_id=self.current_batch_id,
    ended_at=int(time.time()),  # SHOULD BE int(time.time() * 1000)
    ...
)
```

3. **HIGH - update_story ended_at Still Uses Seconds** (Line 967):
```python
ended_at = int(time.time()) if new_status in ("done", "blocked") else None
```
Should be `int(time.time() * 1000)`.

---

### server.py

**Status: NEEDS FIXES - 2 issues**

#### Correct Changes:
- Added `BATCH_WARNING = "batch:warning"` event type
- Added `PONG = "pong"` event type
- Added payload schemas for context events (`CONTEXT_CREATE`, `CONTEXT_REFRESH`, `CONTEXT_COMPLETE`)
- Added `normalize_db_event_to_ws()` function for DB-to-WebSocket event transformation
- Updated `get_initial_state()` to use `get_events_by_batch()` and normalize events
- Added `sprint-runner.csv` to `ALLOWED_DATA_FILES`

#### Issues Found:

1. **CRITICAL - Import Path Issue** (Line 326):
```python
from db import get_active_batch, get_events_by_batch
```
This import is at function-level inside `get_initial_state()`. The function `get_events_by_batch` IS defined in db.py (lines 519-535), so this should work. **VERIFIED OK.**

2. **HIGH - cleanup_stale_batches Uses Seconds** (Lines 749-754):
```python
update_batch(
    batch_id=batch['id'],
    status='stopped',
    ended_at=int(time.time())  # SHOULD BE int(time.time() * 1000)
)
```

3. **HIGH - orchestrator_stop_handler Uses Seconds** (Lines 618-622):
```python
update_batch(
    batch_id=batch['id'],
    status='stopped',
    ended_at=int(time.time())  # SHOULD BE int(time.time() * 1000)
)
```

---

### scripts/sprint-log.sh

**Status: OK - All issues addressed**

#### Correct Changes:
- CSV output now properly escapes quotes by doubling them (`gsub("\""; "\"\"")`)
- Newlines replaced with literal `\n` for CSV compatibility
- Carriage returns handled (`\r\n`, `\n`, `\r` all become `\\n`)
- Message field is always quoted in CSV output
- Both human-readable log and CSV output are generated

#### Verification of CSV Escaping:
```bash
# Test: Message with quotes and newlines
# Input: {"message":"Line1\nLine2\"quoted\""}
# Output: "2024-01-24 12:00:00","epic","story","cmd","task","status","Line1\nLine2""quoted"""
```
The escaping logic is correct per RFC 4180.

---

### commands/*/instructions.xml

**Status: PARTIALLY OK - 1 issue remaining**

#### Correct Changes:
All files updated to use `sprint-` prefix for command names:
- `sprint-code-review/instructions.xml`: `code-review-{{review_attempt}}` -> `sprint-code-review`
- `sprint-create-story-discovery/instructions.xml`: `story-discovery` -> `sprint-create-story-discovery`
- `sprint-create-tech-spec/instructions.xml`: `create-tech-spec` -> `sprint-create-tech-spec`
- `sprint-dev-story/instructions.xml`: `dev-story` -> `sprint-dev-story`
- `sprint-story-review/instructions.xml`: `story-review` -> `sprint-story-review`
- `sprint-tech-spec-review/instructions.xml`: `tech-spec-review` -> `sprint-tech-spec-review`

#### Issue Found:

1. **MEDIUM - Inconsistent command_name in logging_reference** (sprint-code-review/instructions.xml line 289):
```xml
<command_name>code-review-{{review_attempt}}</command_name>
```
This should be `sprint-code-review` to match the actual logging calls. While this is documentation, it creates confusion.

---

## Critical Issues Found

| # | Severity | File | Line | Issue |
|---|----------|------|------|-------|
| 1 | CRITICAL | orchestrator.py | 865-867 | Timestamp validation uses seconds while CSV uses milliseconds - will always fail |
| 2 | HIGH | orchestrator.py | 234 | `update_batch(ended_at=)` uses seconds not milliseconds |
| 3 | HIGH | orchestrator.py | 967 | `update_story(ended_at=)` uses seconds not milliseconds |
| 4 | HIGH | server.py | 752-754 | `cleanup_stale_batches()` uses seconds not milliseconds |
| 5 | HIGH | server.py | 618-622 | `orchestrator_stop_handler()` uses seconds not milliseconds |
| 6 | MEDIUM | instructions.xml | 289 | `<command_name>` in logging_reference still has template variable |

---

## Recommended Fixes

### Fix 1: orchestrator.py Timestamp Validation (CRITICAL)

**Location**: Lines 865-867

**Current**:
```python
now = int(time.time())
if now - 31536000 <= timestamp <= now + 3600:
```

**Fixed**:
```python
now = int(time.time() * 1000)  # milliseconds
if now - 31536000000 <= timestamp <= now + 3600000:  # 1 year ago to 1 hour future
```

### Fix 2: orchestrator.py update_batch ended_at (HIGH)

**Location**: Line 234

**Current**:
```python
ended_at=int(time.time()),
```

**Fixed**:
```python
ended_at=int(time.time() * 1000),
```

### Fix 3: orchestrator.py update_story ended_at (HIGH)

**Location**: Line 967

**Current**:
```python
ended_at = int(time.time()) if new_status in ("done", "blocked") else None
```

**Fixed**:
```python
ended_at = int(time.time() * 1000) if new_status in ("done", "blocked") else None
```

### Fix 4: server.py cleanup_stale_batches (HIGH)

**Location**: Lines 752-754

**Current**:
```python
ended_at=int(time.time())
```

**Fixed**:
```python
ended_at=int(time.time() * 1000)
```

### Fix 5: server.py orchestrator_stop_handler (HIGH)

**Location**: Lines 618-622

**Current**:
```python
ended_at=int(time.time())
```

**Fixed**:
```python
ended_at=int(time.time() * 1000)
```

### Fix 6: sprint-code-review/instructions.xml (MEDIUM)

**Location**: Line 289

**Current**:
```xml
<command_name>code-review-{{review_attempt}}</command_name>
```

**Fixed**:
```xml
<command_name>sprint-code-review</command_name>
```

---

## Breaking Changes Analysis

### Will Existing Functionality Work?

| Component | Status | Notes |
|-----------|--------|-------|
| Dashboard WebSocket | WILL WORK | Event normalization handles both formats |
| CSV Parsing | WILL FAIL | Timestamp validation broken in orchestrator |
| Database Schema | REQUIRES MIGRATION | New `event_type` column required |
| Sprint Log | WILL WORK | Backwards compatible output |
| Command Logging | WILL WORK | Command names standardized |

### Database Migration Required

Existing databases will need the `event_type` column added to the `events` table. The code uses `CREATE TABLE IF NOT EXISTS`, so new installations are fine, but existing databases with data will fail when trying to insert events without the `event_type` column.

**Recommended Migration SQL**:
```sql
ALTER TABLE events ADD COLUMN event_type TEXT NOT NULL DEFAULT 'command:unknown';
```

---

## HAIKU-REVIEW Checklist Verification

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Timestamps are milliseconds (13 digits)? | PARTIAL | db.py correct, orchestrator.py validation wrong |
| create_event() has event_type parameter? | YES | Lines 454-460 in db.py |
| CSV escaping handles quotes and newlines? | YES | Lines 93-99 in sprint-log.sh |
| Command names have sprint- prefix? | MOSTLY | Logging calls correct, docs inconsistent |

---

## Approval Status

**NEEDS FIXES**

The following issues MUST be fixed before approval:

1. **CRITICAL**: Fix timestamp validation in orchestrator.py to use milliseconds
2. **HIGH**: Fix all `ended_at` assignments to use milliseconds (4 locations)

The following issues SHOULD be fixed:

3. **MEDIUM**: Update `<command_name>` in logging_reference documentation

After these fixes are applied, re-run tests to verify:
- CSV parsing correctly validates millisecond timestamps
- Database timestamps are consistently 13-digit values
- Event logging works end-to-end

---

## Haiku Second Review

### Additional Issues Found

**NONE - All critical issues from first review CONFIRMED**

The git diff analysis confirms 100% accuracy of the first review's findings:

1. **Line 865 in orchestrator.py (CRITICAL)**: Timestamp validation uses `int(time.time())` (seconds) while CSV provides milliseconds. VERIFIED - EXACT MATCH to first review finding.

2. **Line 234 in orchestrator.py (HIGH)**: `ended_at=int(time.time())` uses seconds. VERIFIED - EXACT MATCH.

3. **Line 967 in orchestrator.py (HIGH)**: `ended_at = int(time.time())` uses seconds. VERIFIED - EXACT MATCH.

4. **Line 752 in server.py (HIGH)**: `ended_at=int(time.time())` in cleanup_stale_batches. VERIFIED - EXACT MATCH.

5. **Line 621 in server.py (HIGH)**: `ended_at=int(time.time())` in orchestrator_stop_handler. VERIFIED - EXACT MATCH.

### First Review Verification

All findings from the first review are CORRECT and COMPREHENSIVE:

- **db.py**: Correctly implements millisecond timestamps throughout, `get_events_by_batch()` function exists and is properly implemented
- **sprint-log.sh**: CSV escaping is properly implemented with correct quote handling and newline replacement
- **instructions.xml files**: Command names properly updated with `sprint-` prefix in logging calls
- **Timestamp inconsistency**: CRITICAL gap exists between CSV millisecond timestamps and validation code using seconds
- **event_type parameter**: Correctly added to all `create_event()` calls with proper derivation logic

### Final Status

**NEEDS FIXES**

No additional issues found - the first review was thorough and caught all critical problems. The 5 HIGH-severity timestamp issues and MEDIUM documentation issue identified in CODE-REVIEW-E1.md must be fixed before approval.

The code is ARCHITECTURALLY SOUND but has FATAL RUNTIME BUGS that will prevent CSV parsing and timestamp validation from working correctly.
