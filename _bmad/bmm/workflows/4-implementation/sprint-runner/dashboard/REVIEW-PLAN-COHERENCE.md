# REVIEW-PLAN-COHERENCE.md

## Status: COHERENT (with minor fixes needed)

The server and frontend plans are fundamentally aligned on architecture, paths, and API contracts. Both plans can be implemented in parallel with minimal coordination. However, several issues from the individual reviews must be addressed to ensure the implementations integrate correctly.

---

## Cross-Plan Alignment

| Aspect | Status | Notes |
|--------|--------|-------|
| Paths | ALIGNED | Both plans use `server/` and `frontend/` as siblings under `dashboard/` |
| Settings API | ALIGNED | Both agree on `GET/PUT /api/settings` with identical 9-setting schema |
| Static serving | ALIGNED | Server plan updates static serving to use `FRONTEND_DIR`; frontend plan places files in `frontend/` |
| Settings schema | ALIGNED | Same 9 settings with identical names and defaults in both plans |

### Path Agreement Verification

**Server Plan (PLAN-SERVER.md):**
```
dashboard/
  server/
    server.py, orchestrator.py, db.py, shared.py, settings.py, ...
  frontend/
    (served by server.py)
```

**Frontend Plan (PLAN-FRONTEND.md):**
```
dashboard/
  frontend/
    index.html
    css/styles.css
    js/*.js
```

**CHANGE-CONTEXT.md Target State:**
```
dashboard/
  server/
    __init__.py, server.py, orchestrator.py, db.py, shared.py, settings.py, ...
  frontend/
    index.html, css/, js/, assets/
```

**Verdict:** All three documents agree on the folder structure.

---

### Settings API Contract Agreement

**Server Plan (settings.py Step 3):**
```python
@dataclass
class Settings:
    project_context_max_age_hours: int = 24
    injection_warning_kb: int = 100
    injection_error_kb: int = 150
    default_max_cycles: int = 2
    max_code_review_attempts: int = 10
    haiku_after_review: int = 2
    server_port: int = 8080
    websocket_heartbeat_seconds: int = 30
    default_batch_list_limit: int = 20
```

**Frontend Plan (settings.js Step 4.8):**
| Setting Key | Type | Default |
|-------------|------|---------|
| `server_port` | number | 8080 |
| `default_max_cycles` | number | 2 |
| `project_context_max_age_hours` | number | 24 |
| `injection_warning_kb` | number | 100 |
| `injection_error_kb` | number | 150 |
| `websocket_heartbeat_seconds` | number | 30 |
| `max_code_review_attempts` | number | 10 |
| `haiku_after_review` | number | 2 |
| `default_batch_list_limit` | number | 20 |

**Verdict:** Identical settings names, types, and defaults. API contract is fully aligned.

---

### Static File Serving Agreement

**Server Plan (Step 5.2):**
- Defines `FRONTEND_DIR = Path(__file__).parent.parent / "frontend"` (sibling of server/)
- Updates static file serving to use `FRONTEND_DIR / filename`

**Frontend Plan (Phase 3):**
- Creates `frontend/index.html` with relative paths:
  - `<link rel="stylesheet" href="css/styles.css">`
  - `<script src="js/utils.js"></script>` etc.

**Integration Point:**
- Server serves `frontend/index.html` at `/`
- Server serves `frontend/css/*` at `/css/*`
- Server serves `frontend/js/*` at `/js/*`

**Verdict:** Aligned. Frontend uses relative paths; server will serve from `FRONTEND_DIR`.

---

## Conflict Analysis

### No Direct Conflicts Found

The plans do not conflict with each other. However, the individual plan reviews identified issues that, if left unfixed, could cause integration problems:

#### Potential Integration Issues from Server Review

1. **`find_project_root()` starting path** (REVIEW-PLAN-SERVER Issue 13)
   - Impact: If server cannot find project root, `ARTIFACTS_DIR` path will fail
   - Integration risk: LOW - only affects orchestrator reading project files, not frontend serving

2. **PORT vs server_port duplication** (REVIEW-PLAN-SERVER Issue 16)
   - Impact: Confusion about which port is canonical
   - Integration risk: LOW - server will use `PORT` at startup; settings can override for restart

3. **CORS headers on error responses** (REVIEW-PLAN-SERVER Issue 17)
   - Impact: Frontend settings save could fail silently if validation error occurs
   - Integration risk: MEDIUM - frontend may not display proper error messages

#### Potential Integration Issues from Frontend Review

1. **sprintRunState ownership** (REVIEW-PLAN-FRONTEND Issue 9)
   - Impact: Controls and batch modules need access to shared state
   - Integration risk: LOW - internal frontend issue, does not affect server

2. **Line number inaccuracies for stories.js** (REVIEW-PLAN-FRONTEND Issue 2)
   - Impact: Wrong code may be extracted during implementation
   - Integration risk: LOW - extraction issue, not a cross-plan conflict

---

## Implementation Order Recommendation

### Can They Be Parallel? YES

The server and frontend plans can be implemented in parallel because:

1. **No blocking dependencies**: Frontend can be developed against mock/existing API
2. **Clear interface boundary**: Settings API contract is well-defined
3. **Independent file sets**: Server touches `.py` files; frontend touches `.html/.css/.js`
4. **Static serving is additive**: Server's static serving update is backward-compatible

### Recommended Parallel Implementation Strategy

```
Week 1 (Parallel):
  Server Team:                    Frontend Team:
  - Create server/ folder         - Create frontend/ folder
  - Move Python files             - Extract CSS to styles.css
  - Create shared.py              - Create index.html
  - Create settings.py            - Extract JS modules

Week 2 (Parallel, with sync point):
  Server Team:                    Frontend Team:
  - Update imports                - Create settings.js
  - Add Settings API endpoints    - Integrate settings form UI
  - Test API endpoints            - Test against API (or mock)

  SYNC POINT: Verify Settings API contract works end-to-end

Week 3 (Integration):
  - Update static file serving
  - Integration testing
  - Fix any path issues
```

### Critical Sync Points

1. **Settings API contract** - Both teams must use identical field names and types
2. **Static file paths** - Server must serve from correct `FRONTEND_DIR`
3. **CORS configuration** - Server must allow frontend origin for all endpoints

---

## Consolidated Fix List

Priority fixes from both reviews, merged and ordered by implementation phase:

### Phase 1 Fixes (Before Implementation)

| Priority | Source | Issue | Fix |
|----------|--------|-------|-----|
| HIGH | Server Review | `find_project_root()` wrong starting path | Change to `current = Path(__file__).parent` and walk up |
| HIGH | Frontend Review | stories.js line numbers 1000+ off | Correct to lines 4432-4704 |
| MEDIUM | Server Review | Import strategy unclear (relative vs absolute) | Specify: use `from .shared import ...` for package imports |
| MEDIUM | Frontend Review | Function name `toggleEpic` vs `toggleEpicCard` | Correct to `toggleEpicCard` |

### Phase 2 Fixes (During Implementation)

| Priority | Source | Issue | Fix |
|----------|--------|-------|-----|
| HIGH | Server Review | Property pattern for orchestrator constants | Use getter methods instead of @property |
| MEDIUM | Server Review | DASHBOARD_DIR naming confusion | Remove; use only FRONTEND_DIR |
| MEDIUM | Server Review | PORT vs server_port duplication | Keep PORT for startup, note settings require restart |
| MEDIUM | Frontend Review | sprintRunState module ownership | Define in main.js as global state |
| MEDIUM | Frontend Review | Missing functions in module assignments | Add `getCommandType`, `restoreScrollPositions`, `handleBatchState` |

### Phase 3 Fixes (Integration Testing)

| Priority | Source | Issue | Fix |
|----------|--------|-------|-----|
| MEDIUM | Server Review | CORS on error responses | Add headers to all error responses |
| LOW | Server Review | settings.json location | Document that it lives in server/ |
| LOW | Server Review | Test file imports | Add conftest.py for proper test discovery |
| LOW | Frontend Review | Settings tab position | Specify: Settings tab goes after Sprint Run |

---

## Summary

The server and frontend plans are **coherent** and can be implemented in parallel. The key alignments are:

1. **Folder structure**: Both use `dashboard/server/` and `dashboard/frontend/`
2. **Settings API**: Identical 9 settings with same names, types, and defaults
3. **Static serving**: Server serves from `FRONTEND_DIR`; frontend uses relative paths

The individual review issues are primarily:
- **Server side**: Import strategy, constant patterns, path resolution
- **Frontend side**: Line number inaccuracies for extraction, module ownership

None of these issues represent cross-plan conflicts. With the consolidated fix list applied, both plans can proceed to implementation.

---

## Decision

**PROCEED WITH PARALLEL IMPLEMENTATION**

Apply the Phase 1 fixes to both plans before starting. Use the sync point at Settings API integration to verify the contract works correctly.
