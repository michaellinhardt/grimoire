# HAIKU-REVIEW-SERVER.md - Additional Issues

## Summary
5 MEDIUM/MEDIUM-HIGH priority issues related to imports, settings persistence, port configuration, and validation.

---

## NEW Issue 18: Circular Import Risk with Delayed Imports
**Risk Level:** MEDIUM-HIGH

The code uses delayed imports to avoid circular dependencies:
- `server.py` line 326: `from db import get_active_batch, get_events_by_batch`
- `orchestrator.py` line 93: `from server import broadcast, emit_event...`

After moving to `server/` package with relative imports, these delayed imports may fail.

**Mitigation:** Specify that delayed imports use relative form:
```python
from .db import get_active_batch  # NOT: from db import...
```

---

## NEW Issue 19: __init__.py Missing from Test Structure
**Risk Level:** LOW-MEDIUM

Plan Step 5.4 shows `sys.path.insert(0, str(Path(__file__).parent))` which keeps path at `server/`. Should be:
```python
sys.path.insert(0, str(Path(__file__).parent.parent))  # Goes up to dashboard/
```

---

## NEW Issue 20: No Rollback Strategy for settings.json
**Risk Level:** LOW

If `settings.json` gets created during testing and rollback triggers, it will persist.

**Mitigation:** Add to Rollback Plan:
```bash
rm dashboard/server/settings.json
```

---

## NEW Issue 21: Default Port Conflict Between shared.py and settings.py
**Risk Level:** MEDIUM

Both define port defaults:
- `shared.py`: `PORT = 8080` (constant)
- `settings.py`: `server_port: int = 8080` (configurable)

Recommendation: Remove `PORT` from shared.py and ALWAYS use `get_settings().server_port`.

---

## NEW Issue 22: Missing Edge Case - Empty/Corrupt settings.json
**Risk Level:** MEDIUM

`_load_settings()` catches `json.JSONDecodeError` but silently returns defaults. No logging/warning. Should add warning log or rename corrupt file.

---

## NEW Issue 23: Relative Import in __init__.py May Conflict with Entry Point
**Risk Level:** MEDIUM

If server is started with `python server.py` directly (not `python -m server`), relative imports fail. Clarify startup method.

---

## NEW Issue 24: No Validation of Settings Values
**Risk Level:** LOW-MEDIUM

`update_settings()` accepts any value without validation. Should add basic validation for types and ranges.
