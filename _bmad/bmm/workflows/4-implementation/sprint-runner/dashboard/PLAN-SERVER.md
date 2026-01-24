# PLAN-SERVER.md: Server Restructuring Implementation Plan

## Revision Notes

This plan has been updated to address issues from REVIEW-PLAN-SERVER.md and HAIKU-REVIEW-SERVER.md:

**Critical Fixes Applied:**
1. Fixed `find_project_root()` in shared.py - now starts from `Path(__file__).parent` and walks up (matching current server.py pattern)
2. Removed `PORT = 8080` from shared.py - server uses `get_settings().server_port` instead
3. Removed `DASHBOARD_DIR` from shared.py - only `FRONTEND_DIR` is used in the new structure

**High Priority Fixes Applied:**
4. Replaced awkward `@property` pattern in orchestrator.py with getter methods (e.g., `_get_context_max_age_seconds()`)
5. Added import strategy section - clarifies use of relative imports within server/ package
6. Fixed sprint-log.sh line range - changed "lines 67-78" to "lines 66-78"

**Medium Priority Fixes Applied:**
7. Added settings validation with type/range checking in `update_settings()`
8. Fixed test file imports - uses `sys.path.insert(0, str(Path(__file__).parent.parent))`
9. Added CORS headers to error responses in settings handlers
10. Added rollback step for settings.json cleanup
11. Added warning for corrupt settings.json in `_load_settings()`

---

## Overview

This plan covers the restructuring of the dashboard server components into a `server/` subdirectory with centralized configuration management.

## Pre-Implementation Verification

Before starting, verify:
1. All tests pass: `cd dashboard && pytest -v`
2. Server starts: `python server.py`
3. No uncommitted changes: `git status`

---

## Import Strategy

**IMPORTANT:** All imports within the `server/` package MUST use relative imports:

```python
# CORRECT - Relative imports within server/ package
from .shared import PROJECT_ROOT, ARTIFACTS_DIR, FRONTEND_DIR, DB_PATH
from .settings import get_settings, update_settings
from .db import get_active_batch

# INCORRECT - Do not use absolute imports within the package
from shared import PROJECT_ROOT  # Will fail when running as package
```

**Entry Point:** The server must be started from the `dashboard/` directory:
```bash
cd dashboard
python -m server.server  # Runs as module, relative imports work
# OR
python server/server.py  # Only works with sys.path manipulation
```

**Delayed Imports:** Any delayed imports (to avoid circular dependencies) must also use relative form:
```python
# In server.py line 326
from .db import get_active_batch, get_events_by_batch  # NOT: from db import...

# In orchestrator.py line 93
from .server import broadcast, emit_event  # NOT: from server import...
```

---

## Step 1: Create server/ Directory Structure

**Action:** Create the `server/` folder and `__init__.py`

**Path:** `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/`

**File: `server/__init__.py`**
```python
"""
Sprint Runner Server Package

Provides HTTP/WebSocket server, orchestration engine, and database modules.
"""

from .shared import PROJECT_ROOT, ARTIFACTS_DIR, FRONTEND_DIR, DB_PATH
from .settings import Settings, get_settings, update_settings

__all__ = [
    'PROJECT_ROOT', 'ARTIFACTS_DIR', 'FRONTEND_DIR', 'DB_PATH',
    'Settings', 'get_settings', 'update_settings',
]
```

---

## Step 2: Create shared.py with Centralized Constants

**Action:** Create `shared.py` with all path constants and `find_project_root()`

**Path:** `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/shared.py`

**File Content:**
```python
#!/usr/bin/env python3
"""
Centralized shared constants and path utilities.

This module MUST NOT import from server.py, orchestrator.py, or db.py
to prevent circular dependencies.
"""

from pathlib import Path


# Path resolution - start from current directory and walk up
def find_project_root() -> Path:
    """Find project root by looking for package.json or .git"""
    current = Path(__file__).parent  # Start from server/
    while current != current.parent:
        if (current / "package.json").exists() or (current / ".git").exists():
            return current
        current = current.parent
    raise RuntimeError("Could not find project root (no package.json or .git found)")


# Computed paths
PROJECT_ROOT = find_project_root()
ARTIFACTS_DIR = PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"  # sibling of server/
DB_PATH = Path(__file__).parent / "sprint-runner.db"
```

**Key Changes:**
- `PROJECT_ROOT`: Moved from server.py line 54
- `ARTIFACTS_DIR`: Moved from server.py line 55
- `DB_PATH`: Moved from db.py line 23
- `FRONTEND_DIR`: New constant for frontend/ sibling directory
- **Removed:** `PORT` constant - use `get_settings().server_port` instead
- **Removed:** `DASHBOARD_DIR` - was confusing in new structure

---

## Step 3: Create settings.py with Configurable Settings

**Action:** Create `settings.py` with all 9 configurable settings

**Path:** `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/settings.py`

**File Content:**
```python
#!/usr/bin/env python3
"""
Configurable settings for Sprint Runner.

Settings are persisted to JSON file and loaded on startup.
API endpoints allow runtime modification.
"""

from __future__ import annotations
import json
import logging
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional

# Settings file location (same directory as this module)
SETTINGS_FILE = Path(__file__).parent / "settings.json"

logger = logging.getLogger(__name__)


@dataclass
class Settings:
    """All configurable sprint-runner settings."""

    # From orchestrator.py
    project_context_max_age_hours: int = 24
    injection_warning_kb: int = 100
    injection_error_kb: int = 150
    default_max_cycles: int = 2
    max_code_review_attempts: int = 10
    haiku_after_review: int = 2

    # From server.py
    server_port: int = 8080
    websocket_heartbeat_seconds: int = 30
    default_batch_list_limit: int = 20

    def to_dict(self) -> dict[str, Any]:
        """Convert settings to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Settings":
        """Create Settings from dictionary, ignoring unknown keys."""
        known_fields = {f.name for f in cls.__dataclass_fields__.values()}
        filtered = {k: v for k, v in data.items() if k in known_fields}
        return cls(**filtered)


# Module-level settings instance (singleton pattern)
_settings: Optional[Settings] = None


def _load_settings() -> Settings:
    """Load settings from file or return defaults."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, 'r') as f:
                data = json.load(f)
            return Settings.from_dict(data)
        except json.JSONDecodeError as e:
            logger.warning(
                f"Corrupt settings.json detected: {e}. Using defaults. "
                f"Consider removing or fixing: {SETTINGS_FILE}"
            )
        except OSError as e:
            logger.warning(f"Could not read settings.json: {e}. Using defaults.")
    return Settings()


def _save_settings(settings: Settings) -> None:
    """Persist settings to file."""
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings.to_dict(), f, indent=2)


def get_settings() -> Settings:
    """Get current settings (lazy initialization)."""
    global _settings
    if _settings is None:
        _settings = _load_settings()
    return _settings


def _validate_setting(key: str, value: Any) -> None:
    """Validate setting value type and range."""
    # Type validation
    int_fields = {
        'project_context_max_age_hours', 'injection_warning_kb', 'injection_error_kb',
        'default_max_cycles', 'max_code_review_attempts', 'haiku_after_review',
        'server_port', 'websocket_heartbeat_seconds', 'default_batch_list_limit'
    }

    if key in int_fields:
        if not isinstance(value, int):
            raise ValueError(f"Setting '{key}' must be an integer, got {type(value).__name__}")

        # Range validation
        if value < 0:
            raise ValueError(f"Setting '{key}' must be non-negative, got {value}")

        # Specific range checks
        if key == 'server_port' and not (1 <= value <= 65535):
            raise ValueError(f"Setting 'server_port' must be 1-65535, got {value}")
        if key == 'injection_warning_kb' and value < 1:
            raise ValueError(f"Setting 'injection_warning_kb' must be at least 1")
        if key == 'injection_error_kb' and value < 1:
            raise ValueError(f"Setting 'injection_error_kb' must be at least 1")


def update_settings(**kwargs: Any) -> Settings:
    """Update specific settings and persist."""
    global _settings
    current = get_settings()

    for key, value in kwargs.items():
        if not hasattr(current, key):
            raise ValueError(f"Unknown setting: {key}")
        _validate_setting(key, value)
        setattr(current, key, value)

    _save_settings(current)
    return current


def reset_settings() -> Settings:
    """Reset all settings to defaults."""
    global _settings
    _settings = Settings()
    _save_settings(_settings)
    return _settings
```

**Settings Extracted:**

| Setting | Source | Default | Type |
|---------|--------|---------|------|
| `project_context_max_age_hours` | orchestrator.py:254 | 24 | int |
| `injection_warning_kb` | orchestrator.py:257 | 100 | int |
| `injection_error_kb` | orchestrator.py:258 | 150 | int |
| `default_max_cycles` | orchestrator.py:142 | 2 | int |
| `max_code_review_attempts` | orchestrator.py:1425 | 10 | int |
| `haiku_after_review` | orchestrator.py:1427 | 2 | int |
| `server_port` | server.py:38 | 8080 | int |
| `websocket_heartbeat_seconds` | server.py:364 | 30 | int |
| `default_batch_list_limit` | server.py:692 | 20 | int |

---

## Step 4: Move Python Files to server/

**Actions:** Move each Python file from dashboard/ to server/

### 4.1 Move server.py

```bash
mv dashboard/server.py dashboard/server/server.py
```

### 4.2 Move orchestrator.py

```bash
mv dashboard/orchestrator.py dashboard/server/orchestrator.py
```

### 4.3 Move db.py

```bash
mv dashboard/db.py dashboard/server/db.py
```

### 4.4 Move requirements.txt

```bash
mv dashboard/requirements.txt dashboard/server/requirements.txt
```

### 4.5 Move sprint-runner.db

```bash
mv dashboard/sprint-runner.db dashboard/server/sprint-runner.db
```

### 4.6 Move test files

```bash
mv dashboard/test_orchestrator.py dashboard/server/test_orchestrator.py
mv dashboard/test_server.py dashboard/server/test_server.py
mv dashboard/test_db.py dashboard/server/test_db.py
mv dashboard/test_integration.py dashboard/server/test_integration.py
mv dashboard/test_parity.py dashboard/server/test_parity.py
```

---

## Step 5: Update Import Statements

### 5.1 Update db.py

**File:** `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/db.py`

**Changes:**

Line 23 - Replace:
```python
DB_PATH = Path(__file__).parent / 'sprint-runner.db'
```

With:
```python
from .shared import DB_PATH
```

### 5.2 Update server.py

**File:** `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/server.py`

**Changes:**

Lines 38-55 - Replace:
```python
PORT = 8080

# Paths - Robust project root detection
DASHBOARD_DIR = Path(__file__).parent


def find_project_root() -> Path:
    """Find project root by looking for package.json or .git"""
    current = Path(__file__).parent
    while current != current.parent:
        if (current / "package.json").exists() or (current / ".git").exists():
            return current
        current = current.parent
    raise RuntimeError("Could not find project root (no package.json or .git found)")


PROJECT_ROOT = find_project_root()
ARTIFACTS_DIR = PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"
```

With:
```python
from .shared import PROJECT_ROOT, ARTIFACTS_DIR, FRONTEND_DIR
from .settings import get_settings
```

Line 364 - Replace:
```python
ws = web.WebSocketResponse(heartbeat=30.0)
```

With:
```python
settings = get_settings()
ws = web.WebSocketResponse(heartbeat=float(settings.websocket_heartbeat_seconds))
```

Line 692 - Replace:
```python
limit = int(request.query.get("limit", "20"))
```

With:
```python
settings = get_settings()
limit = int(request.query.get("limit", str(settings.default_batch_list_limit)))
```

Line 894 - Update static file serving path:
```python
# Change: DASHBOARD_DIR / filename
# To: FRONTEND_DIR / filename (for frontend files)
filepath = FRONTEND_DIR / filename
```

Update main() to use settings for port:
```python
# In main() function, replace PORT with:
port = get_settings().server_port
web.run_app(app, host="0.0.0.0", port=port)
```

Add Settings API endpoints (in create_app function):
```python
# Settings API endpoints
app.router.add_get("/api/settings", settings_get_handler)
app.router.add_put("/api/settings", settings_update_handler)
app.router.add_options("/api/settings", cors_preflight_handler)
```

Add handler functions:
```python
async def settings_get_handler(request: web.Request) -> web.Response:
    """GET /api/settings - Retrieve all settings."""
    from .settings import get_settings
    settings = get_settings()
    return web.json_response(
        settings.to_dict(),
        headers={"Access-Control-Allow-Origin": "*"},
    )


async def settings_update_handler(request: web.Request) -> web.Response:
    """PUT /api/settings - Update settings."""
    from .settings import update_settings
    try:
        data = await request.json()
        settings = update_settings(**data)
        return web.json_response(
            settings.to_dict(),
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except ValueError as e:
        return web.Response(
            status=400,
            text=str(e),
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except json.JSONDecodeError:
        return web.Response(
            status=400,
            text="Invalid JSON",
            headers={"Access-Control-Allow-Origin": "*"},
        )
```

### 5.3 Update orchestrator.py

**File:** `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server/orchestrator.py`

**Changes:**

Add import near top (around line 30):
```python
from .settings import get_settings
```

Lines 254-258 - Replace:
```python
# Constants for project context freshness
PROJECT_CONTEXT_MAX_AGE_SECONDS = 24 * 3600  # 24 hours

# Prompt system append size limits (Story A-1)
INJECTION_WARNING_THRESHOLD_BYTES = 100 * 1024  # 100KB - warn if larger
INJECTION_ERROR_THRESHOLD_BYTES = 150 * 1024    # 150KB - error if larger
```

With getter methods in the Orchestrator class:
```python
def _get_context_max_age_seconds(self) -> int:
    """Get project context max age from settings."""
    return get_settings().project_context_max_age_hours * 3600

def _get_injection_warning_threshold(self) -> int:
    """Get injection warning threshold in bytes from settings."""
    return get_settings().injection_warning_kb * 1024

def _get_injection_error_threshold(self) -> int:
    """Get injection error threshold in bytes from settings."""
    return get_settings().injection_error_kb * 1024
```

Update all references to use the getter methods:
```python
# Change: if age_seconds > self.PROJECT_CONTEXT_MAX_AGE_SECONDS:
# To: if age_seconds > self._get_context_max_age_seconds():

# Change: if size > self.INJECTION_WARNING_THRESHOLD_BYTES:
# To: if size > self._get_injection_warning_threshold():

# Change: if size > self.INJECTION_ERROR_THRESHOLD_BYTES:
# To: if size > self._get_injection_error_threshold():
```

Line 142 - Update default max_cycles:
```python
def __init__(
    self,
    batch_mode: str = "fixed",
    max_cycles: int = None,  # Changed from 2
    project_root: Optional[Path] = None,
):
    # Use settings default if not specified
    if max_cycles is None:
        max_cycles = get_settings().default_max_cycles
    self.max_cycles = max_cycles
```

Line 1425 - Replace hardcoded loop limit:
```python
while review_attempt <= get_settings().max_code_review_attempts:
```

Line 1427 - Replace hardcoded Haiku threshold:
```python
model = "haiku" if review_attempt >= get_settings().haiku_after_review else None
```

### 5.4 Update Test Files

Each test file needs import path updates to go up to dashboard/ level.

**test_db.py** - Line 23-30:
```python
@pytest.fixture
def temp_db(tmp_path):
    """Create a temporary database for testing."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))  # Goes up to dashboard/
    from server import db
    from server.shared import DB_PATH
    # ... rest unchanged
```

**test_server.py** and **test_orchestrator.py** - Similar pattern:
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))  # Goes up to dashboard/

from server import shared, settings
from server.orchestrator import Orchestrator
```

---

## Step 6: Fix sprint-log.sh Timestamp Format

**File:** `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh`

**Issue:** Line 64 outputs human-readable timestamps but orchestrator expects Unix epoch seconds.

**Change Line 64:**
```bash
# Current:
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# New:
TIMESTAMP=$(date +%s)
```

**Also update CSV output on Line 102:**
```bash
# Current format uses human-readable timestamp
# New format uses Unix epoch seconds for orchestrator compatibility
echo "${TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${TASK_ID},${STATUS},\"${CSV_MESSAGE}\""
```

**Optional:** Remove log file writing (lines 66-78) since it's being replaced by SQLite:
```bash
# Remove these lines:
# LOG_ENTRY="[$TIMESTAMP] [$EPIC_ID/$STORY_ID] [$COMMAND:$TASK_ID] [$STATUS] $MESSAGE"
# SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# LOG_DIR="$SCRIPT_DIR/../dashboard"
# LOG_FILE="$LOG_DIR/sprint.log"
# mkdir -p "$LOG_DIR"
# echo "$LOG_ENTRY" >> "$LOG_FILE"
```

---

## Step 7: Remove sprint.log File

**Action:** Delete the unused log file

```bash
rm dashboard/sprint.log
```

**Verification:** Confirm file no longer exists and no code references it (except sprint-log.sh which we modified).

---

## Acceptance Criteria Checklist

### Server Changes
- [ ] All Python files moved to `server/` folder
- [ ] `__init__.py` created with proper exports
- [ ] `shared.py` contains all centralized constants (PROJECT_ROOT, ARTIFACTS_DIR, FRONTEND_DIR, DB_PATH)
- [ ] `settings.py` provides read/write settings with 9 settings
- [ ] All imports updated to use relative imports (`.shared`, `.settings`, etc.)
- [ ] All imports updated to use `settings.py` for configurable values
- [ ] Server starts correctly from `dashboard/` folder using `python -m server.server`
- [ ] Settings API endpoints work (GET/PUT /api/settings)
- [ ] All tests pass after restructuring
- [ ] `sprint.log` removed, script writes Unix timestamps
- [ ] No circular import dependencies

### Quality Checklist
- [ ] `pytest -v` passes all tests
- [ ] `python -m py_compile server/server.py server/orchestrator.py server/db.py server/shared.py server/settings.py` - no syntax errors
- [ ] `python -c "from server.shared import PROJECT_ROOT"` - imports work
- [ ] `python -c "from server.settings import get_settings; print(get_settings())"` - settings load
- [ ] Server startup: `cd dashboard && python -m server.server` works
- [ ] WebSocket connection: `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8080/ws`

---

## Dependencies Between Steps

```
Step 1 (Create server/)
    |
    v
Step 2 (shared.py) ----+
    |                  |
    v                  |
Step 3 (settings.py) --+
    |                  |
    v                  v
Step 4 (Move files) <--+
    |
    v
Step 5 (Update imports)
    |
    v
Step 6 (Fix sprint-log.sh)
    |
    v
Step 7 (Remove sprint.log)
```

**Critical Sequencing:**
- Steps 2 and 3 must complete before Step 5
- Step 4 must complete before Step 5
- Steps 6 and 7 can run in parallel after Step 5

---

## Rollback Plan

If issues occur:
1. `git checkout -- dashboard/` to restore original files
2. Delete `server/` folder if partially created
3. Restore `sprint.log` from git if deleted
4. Remove settings.json if created: `rm dashboard/server/settings.json`

---

## Post-Implementation Verification

1. **Unit Tests:**
   ```bash
   cd dashboard
   pytest -v server/test_db.py server/test_server.py server/test_orchestrator.py
   ```

2. **Integration Tests:**
   ```bash
   cd dashboard
   pytest -v server/test_integration.py server/test_parity.py
   ```

3. **Manual Server Test:**
   ```bash
   cd dashboard
   python -m server.server
   # In another terminal:
   curl http://localhost:8080/api/settings
   curl http://localhost:8080/api/orchestrator/status
   ```

4. **Settings Persistence:**
   ```bash
   curl -X PUT -H "Content-Type: application/json" \
     -d '{"default_max_cycles": 5}' \
     http://localhost:8080/api/settings
   # Verify settings.json was created
   cat dashboard/server/settings.json
   ```

---

## Critical Files for Implementation

- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` - Main server with path constants and static serving to update
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` - Contains 6 settings constants to extract
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py` - DB_PATH constant to import from shared.py
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh` - Timestamp format fix required
- `/Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/test_db.py` - Reference for test fixture pattern to update
