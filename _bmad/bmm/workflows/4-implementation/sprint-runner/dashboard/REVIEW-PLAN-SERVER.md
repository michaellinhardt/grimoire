# REVIEW-PLAN-SERVER.md

## Status: NEEDS-WORK

---

## Issues Found

### CRITICAL Issues

#### Issue 1: Incorrect Line Numbers in server.py
**Plan Claims:**
- Line 38: `PORT = 8080`
- Line 41: `DASHBOARD_DIR = Path(__file__).parent` (implied in study)
- Line 54: `PROJECT_ROOT = find_project_root()`
- Line 55: `ARTIFACTS_DIR = PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"`

**Actual Source (server.py):**
- Line 38: `PORT = 8080` - CORRECT
- Line 41: `DASHBOARD_DIR = Path(__file__).parent` - CORRECT
- Line 54: `PROJECT_ROOT = find_project_root()` - CORRECT
- Line 55: `ARTIFACTS_DIR = PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"` - CORRECT

**Status:** Line numbers are accurate.

---

#### Issue 2: Incorrect Line Numbers in orchestrator.py
**Plan Claims (Step 5.3):**
- Lines 254-258: Contains `PROJECT_CONTEXT_MAX_AGE_SECONDS`, `INJECTION_WARNING_THRESHOLD_BYTES`, `INJECTION_ERROR_THRESHOLD_BYTES`
- Line 142: `max_cycles: int = 2` default
- Line 1425: `while review_attempt <= 10`
- Line 1427: `model = "haiku" if review_attempt >= 2`

**Actual Source (orchestrator.py):**
- Lines 253-258: Constants are at lines 254, 257-258 - CORRECT
- Line 141-142: `max_cycles: int = 2` is at line 142 - CORRECT
- Line 1425: `while review_attempt <= 10:` - CORRECT
- Line 1427: `model = "haiku" if review_attempt >= 2 else None` - CORRECT

**Status:** Line numbers are accurate.

---

#### Issue 3: Incorrect Line Number for websocket_heartbeat
**Plan Claims (Step 5.2):**
- Line 364: `ws = web.WebSocketResponse(heartbeat=30.0)`

**Actual Source (server.py):**
- Line 364: `ws = web.WebSocketResponse(heartbeat=30.0)` - CORRECT

**Status:** Line number is accurate.

---

#### Issue 4: Incorrect Line Number for batch_list_limit
**Plan Claims (Step 5.2):**
- Line 692: `limit = int(request.query.get("limit", "20"))`

**Actual Source (server.py):**
- Line 692: `limit = int(request.query.get("limit", "20"))` - CORRECT

**Status:** Line number is accurate.

---

#### Issue 5: Missing db.py Line Number for DB_PATH
**Plan Claims (Step 5.1):**
- Line 23: `DB_PATH = Path(__file__).parent / 'sprint-runner.db'`

**Actual Source (db.py):**
- Line 23: `DB_PATH = Path(__file__).parent / 'sprint-runner.db'` - CORRECT

**Status:** Line number is accurate.

---

### HIGH Priority Issues

#### Issue 6: INCORRECT sprint-log.sh Line Numbers
**Plan Claims (Step 6):**
- Line 64: `TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")`
- Line 102: CSV output format
- Lines 67-78: Log file writing to remove

**Actual Source (sprint-log.sh):**
- Line 64: `TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")` - CORRECT
- Line 102: `echo "${TIMESTAMP},${EPIC_ID}..."` - CORRECT
- Lines 66-78: Log file writing - Actually lines 66-78, not 67-78

**Correction:** Line range for log file removal is slightly off (66-78, not 67-78).

---

#### Issue 7: Proposed Import Strategy Has Issues
**Plan Step 5.1 (db.py):**
```python
from shared import DB_PATH
```

**Problem:** After moving to `server/`, the import should be:
```python
from .shared import DB_PATH
```
or:
```python
from shared import DB_PATH  # Only works if running from server/ directory
```

**Risk:** Relative imports may be needed for proper package structure. The plan should clarify whether to use absolute or relative imports within the package.

---

#### Issue 8: Missing DASHBOARD_DIR in shared.py Exports
**Plan shared.py (Step 2):**
```python
DASHBOARD_DIR = Path(__file__).parent  # For backward compatibility
```

**Plan server.py import (Step 5.2):**
```python
from shared import PORT, PROJECT_ROOT, ARTIFACTS_DIR, FRONTEND_DIR, DASHBOARD_DIR
```

**Issue:** The `shared.py` defines `DASHBOARD_DIR = Path(__file__).parent` which would point to `server/`, but the plan also uses `DASHBOARD_DIR` for backward compatibility. This is confusing since:
1. After restructuring, `DASHBOARD_DIR` would point to `server/` not `dashboard/`
2. Static file serving needs `FRONTEND_DIR` for frontend files
3. The constant name `DASHBOARD_DIR` is misleading in the new structure

**Recommendation:** Remove `DASHBOARD_DIR` from shared.py and use only `FRONTEND_DIR` for the new structure.

---

#### Issue 9: Inconsistent Static File Serving Update
**Plan Step 5.2 mentions:**
```python
Line 894 - Update static file serving path:
# Change: DASHBOARD_DIR / filename
# To: FRONTEND_DIR / filename (for frontend files)
```

**Actual Source (server.py lines 842-898):**
- Line 894: `filepath = DASHBOARD_DIR / filename`

The plan mentions updating line 894 but does not provide explicit before/after code. The actual change needs to be more specific about:
1. Which files go to FRONTEND_DIR (HTML, CSS, JS)
2. Which files stay in server/ (DB, config)
3. The logic for distinguishing between frontend assets and data files

---

#### Issue 10: orchestrator.py Property Pattern is Incorrect
**Plan Step 5.3 proposes:**
```python
@property
def PROJECT_CONTEXT_MAX_AGE_SECONDS(self) -> int:
    return get_settings().project_context_max_age_hours * 3600
```

**Problem:** This pattern is WRONG. The constants are currently CLASS-LEVEL constants, not instance properties. They are used as:
```python
if age_seconds > self.PROJECT_CONTEXT_MAX_AGE_SECONDS:  # Line 463
```

If changed to `@property`, this would still work, but it breaks the pattern. The constants are also used outside the class context.

**Better Approach:** Replace direct constant references with function calls:
```python
# Instead of property, use helper function
def _get_context_max_age_seconds(self) -> int:
    return get_settings().project_context_max_age_hours * 3600

# And update usage from:
if age_seconds > self.PROJECT_CONTEXT_MAX_AGE_SECONDS:
# To:
if age_seconds > self._get_context_max_age_seconds():
```

---

### MEDIUM Priority Issues

#### Issue 11: Missing settings.py Import in orchestrator.py
**Plan Step 5.3:**
The proposed changes show adding `from settings import get_settings` but the exact insertion point is not specified. It should be added near the top imports (around line 30).

---

#### Issue 12: server.py Settings Import Location
**Plan Step 5.2:**
```python
from shared import PORT, PROJECT_ROOT, ARTIFACTS_DIR, FRONTEND_DIR, DASHBOARD_DIR
from settings import get_settings
```

**Issue:** These imports need to be placed correctly. Current server.py imports are at lines 24-36. The new imports should be added there, and the existing constant definitions (lines 38-55) should be removed.

---

#### Issue 13: find_project_root() in shared.py Has Wrong Path
**Plan shared.py (Step 2):**
```python
def find_project_root() -> Path:
    """Find project root by looking for package.json or .git"""
    current = Path(__file__).parent.parent.parent  # server/ -> dashboard/ -> sprint-runner/
```

**Issue:** The comment says `server/ -> dashboard/ -> sprint-runner/` but:
- `Path(__file__).parent` = `server/`
- `Path(__file__).parent.parent` = `dashboard/`
- `Path(__file__).parent.parent.parent` = `sprint-runner/`

This is starting 3 levels up, but the project root (grimoire) is higher. The current server.py implementation starts at `Path(__file__).parent` and walks up - which is correct. The plan's version would fail to find the project root.

**Correction:** Should be:
```python
current = Path(__file__).parent  # Start from server/, walk up
```

---

#### Issue 14: Settings Settings Persistence Location
**Plan settings.py (Step 3):**
```python
SETTINGS_FILE = Path(__file__).parent / "settings.json"
```

**Issue:** This places `settings.json` in `server/settings.json`. While acceptable, this should be explicitly noted and tested. Also consider whether settings should be in a user-writable location outside the code directory.

---

#### Issue 15: Test File Import Updates Are Incomplete
**Plan Step 5.4 only shows:**
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
```

**Issue:** This is a workaround but not a proper solution. After moving to a package structure with `__init__.py`, tests should use proper imports. The plan should include pytest configuration updates or conftest.py changes.

---

### LOW Priority Issues

#### Issue 16: Missing server_port Usage
**Plan settings.py includes:**
```python
server_port: int = 8080
```

**Plan Step 5.2 shows:**
```python
from shared import PORT, ...
```

**Issue:** The settings include `server_port` but the plan still imports `PORT` from `shared.py`. There's a conflict - should the port come from settings or shared?

**Recommendation:** Remove `PORT` from shared.py and use only `get_settings().server_port`.

---

#### Issue 17: CORS Headers Missing from Settings Endpoints
**Plan Step 5.2 shows settings_update_handler:**
```python
except json.JSONDecodeError:
    return web.Response(status=400, text="Invalid JSON")
```

**Issue:** Error responses don't include CORS headers. All responses should include `Access-Control-Allow-Origin: *` for consistency with other endpoints.

---

## Verification Checklist

- [x] All constants listed match actual source (PORT=8080, heartbeat=30, limit=20, etc.)
- [x] All line numbers verified against source - MOSTLY CORRECT
- [x] Settings defaults verified - All 9 settings have correct defaults
- [ ] Import strategy will work - NEEDS CLARIFICATION (relative vs absolute imports)
- [ ] No missing steps - See issues above about import locations and test updates

### Settings Verification (All 9 Confirmed)

| Setting | Source | Line | Default | Verified |
|---------|--------|------|---------|----------|
| `project_context_max_age_hours` | orchestrator.py | 254 | 24 | CORRECT |
| `injection_warning_kb` | orchestrator.py | 257 | 100 | CORRECT |
| `injection_error_kb` | orchestrator.py | 258 | 150 | CORRECT |
| `default_max_cycles` | orchestrator.py | 142 | 2 | CORRECT |
| `max_code_review_attempts` | orchestrator.py | 1425 | 10 | CORRECT |
| `haiku_after_review` | orchestrator.py | 1427 | 2 | CORRECT |
| `server_port` | server.py | 38 | 8080 | CORRECT |
| `websocket_heartbeat_seconds` | server.py | 364 | 30 | CORRECT |
| `default_batch_list_limit` | server.py | 692 | 20 | CORRECT |

---

## Recommendations

### 1. Fix find_project_root() in shared.py
```python
def find_project_root() -> Path:
    """Find project root by looking for package.json or .git"""
    current = Path(__file__).parent  # Start from server/
    while current != current.parent:
        if (current / "package.json").exists() or (current / ".git").exists():
            return current
        current = current.parent
    raise RuntimeError("Could not find project root")
```

### 2. Clarify Import Strategy
Add a section specifying:
- Use relative imports within the `server/` package: `from .shared import ...`
- Or use sys.path manipulation if running scripts directly

### 3. Remove DASHBOARD_DIR Confusion
- Remove `DASHBOARD_DIR` from shared.py entirely
- Use only `FRONTEND_DIR` for the new structure
- Update all references in server.py

### 4. Fix orchestrator.py Constants Approach
Instead of properties, use getter methods:
```python
def _get_injection_warning_threshold(self) -> int:
    return get_settings().injection_warning_kb * 1024
```

### 5. Add PORT vs server_port Resolution
Decide: Either:
- Keep `PORT` in shared.py as a convenience constant
- Or remove it and always use `get_settings().server_port`

Do not have both.

### 6. Add Test Configuration
Include pytest.ini or conftest.py updates for proper test discovery after restructuring.

### 7. Add Error Response CORS Headers
All error responses should include:
```python
headers={"Access-Control-Allow-Origin": "*"}
```

---

## Summary

The plan is **mostly accurate** with correct line numbers and settings identification. However, it has several issues that need resolution before implementation:

1. **Critical**: The `find_project_root()` implementation in shared.py starts at the wrong path level
2. **High**: The property-based approach for orchestrator constants is awkward
3. **High**: Import strategy (relative vs absolute) is not specified
4. **Medium**: PORT vs server_port duplication creates confusion
5. **Medium**: DASHBOARD_DIR naming is misleading in the new structure

Recommend fixing these issues before proceeding with implementation.
