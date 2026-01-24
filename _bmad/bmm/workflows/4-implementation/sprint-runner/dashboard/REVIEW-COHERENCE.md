# REVIEW-COHERENCE.md: Cross-Study Coherence Validation Report

**Review Date**: 2026-01-24
**Studies Reviewed**: STUDY-DASHBOARD-SERVER.md, STUDY-SERVER-SPAWN.md
**Reviews Referenced**: REVIEW-DASHBOARD-SERVER.md, REVIEW-SERVER-SPAWN.md
**Coherence Status**: COHERENT (Minor Reconciliation Needed)

---

## 1. Executive Summary

Both studies are **fundamentally coherent** and can support parallel implementation of the `server/` and `frontend/` restructuring. There are no blocking conflicts between the studies. Minor reconciliation items have been identified and documented below.

**Key Findings:**
- Path constants are consistently defined across both studies
- Both studies agree on the `shared.py` and `settings.py` structure
- Import dependencies are correctly analyzed with no conflicting recommendations
- API contracts between frontend and server are well-aligned
- Implementation can proceed in parallel with defined integration points

---

## 2. Path Consistency Analysis

### 2.1 Path Constants Comparison

| Constant | Study 1 (Dashboard-Server) | Study 2 (Server-Spawn) | Status |
|----------|---------------------------|------------------------|--------|
| `PROJECT_ROOT` | `find_project_root()` at server.py L54 | `find_project_root()` at server.py L54 | CONSISTENT |
| `DASHBOARD_DIR` | `Path(__file__).parent` at server.py L41 | `Path(__file__).parent` at server.py L41 | CONSISTENT |
| `ARTIFACTS_DIR` | `PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"` at L55 | Same definition, L55 | CONSISTENT |
| `DB_PATH` | db.py L23 (after review correction) | db.py L23 | CONSISTENT |
| `PORT` | `8080` at server.py L38 | `8080` at server.py L38 | CONSISTENT |

### 2.2 Path Resolution After Restructuring

Both studies agree on the required changes:

| Path | Current | After Restructuring | Agreement |
|------|---------|---------------------|-----------|
| `DASHBOARD_DIR` | `Path(__file__).parent` (dashboard/) | `Path(__file__).parent.parent / "frontend"` | YES |
| `DB_PATH` | `Path(__file__).parent / 'sprint-runner.db'` | Same (will be server/sprint-runner.db) | YES |
| `PROJECT_ROOT` | Scan up for .git/package.json | No change needed | YES |
| `ARTIFACTS_DIR` | Relative to PROJECT_ROOT | No change needed | YES |

### 2.3 Path Consistency Verdict

**STATUS: CONSISTENT** - Both studies reference identical paths and agree on restructuring changes.

---

## 3. Constants Alignment Table

### 3.1 Constants for shared.py

| Constant | Source | Study 1 | Study 2 | Target File |
|----------|--------|---------|---------|-------------|
| `PROJECT_ROOT` | server.py | Documented | Documented | shared.py |
| `ARTIFACTS_DIR` | server.py | Documented | Documented | shared.py |
| `DASHBOARD_DIR` | server.py | Documented | Documented | shared.py (as FRONTEND_DIR) |
| `DB_PATH` | db.py | Documented | Documented | shared.py |
| `PORT` | server.py | Documented | Documented | shared.py |

### 3.2 Constants for settings.py (Configurable Values)

| Setting Name | Default | Source | Study 1 | Study 2 | Status |
|--------------|---------|--------|---------|---------|--------|
| `project_context_max_age_hours` | 24 | orchestrator.py | Mentioned | Documented | ALIGNED |
| `injection_warning_kb` | 100 | orchestrator.py | Mentioned | Documented | ALIGNED |
| `injection_error_kb` | 150 | orchestrator.py | Mentioned | Documented | ALIGNED |
| `default_max_cycles` | 2 | orchestrator.py | Mentioned | Documented | ALIGNED |
| `max_code_review_attempts` | 10 | orchestrator.py | Mentioned | Documented | ALIGNED |
| `haiku_after_review` | 2 | orchestrator.py | Mentioned | Documented | ALIGNED |
| `server_port` | 8080 | server.py | Mentioned | Documented | ALIGNED |
| `websocket_heartbeat_seconds` | 30 | server.py | Mentioned | Documented | ALIGNED |
| `default_batch_list_limit` | 20 | server.py | Mentioned | Documented | ALIGNED |

### 3.3 Database Field Constants (db.py only)

| Constant | Study 1 | Study 2 | Status |
|----------|---------|---------|--------|
| `BATCH_FIELDS` | Not documented | Documented | OK (server-side only) |
| `STORY_FIELDS` | Not documented | Documented | OK (server-side only) |
| `COMMAND_FIELDS` | Not documented | Documented | OK (server-side only) |
| `BACKGROUND_TASK_FIELDS` | Not documented | Documented (after review) | OK (server-side only) |
| `VALID_STORY_STATUSES` | Not documented | Documented (after review) | OK (server-side only) |

**Note:** Database field constants are appropriately only in Study 2 (Server-Spawn) since they are internal to the server/database layer and not exposed to the frontend.

### 3.4 Constants Alignment Verdict

**STATUS: ALIGNED** - Both studies document consistent constants with appropriate division of responsibility.

---

## 4. Import Dependency Resolution

### 4.1 Current Import Structure

```
server.py ──imports──> orchestrator.Orchestrator (lazy, in handler)
     │
     └── orchestrator.py ──imports──> server.broadcast, server.emit_event (try/except)
                │
                └── db.py (no circular imports)
```

### 4.2 Post-Restructuring Import Structure (Both Studies Agree)

```
server/
├── __init__.py
├── shared.py ◄───────── IMPORTS FROM: Nothing (leaf module)
├── settings.py ◄──────── IMPORTS FROM: shared.py (for paths)
├── db.py ◄────────────── IMPORTS FROM: shared.py (for DB_PATH)
├── orchestrator.py ◄──── IMPORTS FROM: shared.py, settings.py, db.py, server.py (try/except)
└── server.py ◄────────── IMPORTS FROM: shared.py, settings.py, db.py, orchestrator.py (lazy)
```

### 4.3 Circular Dependency Analysis

| Import Pair | Risk | Mitigation | Studies Agree |
|-------------|------|------------|---------------|
| server ↔ orchestrator | Medium | try/except + lazy import | YES |
| shared → any | None | Leaf module, no imports | YES |
| settings → shared | None | One-way dependency | YES |
| db → shared | None | One-way dependency | YES |

### 4.4 Import Dependency Verdict

**STATUS: RESOLVED** - Both studies agree on the import structure and circular dependency mitigation strategies.

---

## 5. API Contract Verification

### 5.1 REST API Endpoints

| Endpoint | Study 1 Documents | Frontend Uses | Server Implements | Status |
|----------|-------------------|---------------|-------------------|--------|
| `GET /` | Yes | N/A (HTML) | Yes | ALIGNED |
| `GET /ws` | Yes | `ws://${host}/ws` | Yes | ALIGNED |
| `GET /story-descriptions.json` | Yes | `./story-descriptions.json` | Yes | ALIGNED |
| `POST /api/orchestrator/start` | Yes | `startOrchestrator()` | Yes | ALIGNED |
| `POST /api/orchestrator/stop` | Yes | `stopOrchestrator()` | Yes | ALIGNED |
| `GET /api/orchestrator/status` | Yes | `fetchStatus()` | Yes | ALIGNED |
| `GET /api/batches` | Yes | `fetchBatches(append)` | Yes | ALIGNED |
| `GET /api/batches/{id}` | Yes | `fetchBatchDetail(id)` | Yes | ALIGNED |

### 5.2 Settings API (New Endpoints)

From CHANGE-CONTEXT.md:

| Endpoint | Purpose | Frontend Component | Status |
|----------|---------|-------------------|--------|
| `GET /api/settings` | Retrieve all settings | `settings.js` | PLANNED |
| `PUT /api/settings` | Update settings | `settings.js` | PLANNED |
| `GET /api/settings/:key` | Get single setting | Optional | PLANNED |
| `PUT /api/settings/:key` | Update single setting | Optional | PLANNED |

### 5.3 WebSocket Event Types

| Event Type | Study 1 Documents | Study 2 Documents | Frontend Handles | Status |
|------------|-------------------|-------------------|------------------|--------|
| `batch:start` | Yes (L87-142) | Yes | `handleWebSocketEvent()` | ALIGNED |
| `batch:end` | Yes | Yes | Yes | ALIGNED |
| `batch:warning` | Yes | Yes | Yes | ALIGNED |
| `cycle:start` | Yes | Yes | Yes | ALIGNED |
| `cycle:end` | Yes | Yes | Yes | ALIGNED |
| `command:start` | Yes | Yes | Yes | ALIGNED |
| `command:progress` | Yes | Yes | Yes | ALIGNED |
| `command:end` | Yes | Yes | Yes | ALIGNED |
| `story:status` | Yes | Yes | Yes | ALIGNED |
| `context:create` | Yes | Yes | Yes | ALIGNED |
| `context:refresh` | Yes | Yes | Yes | ALIGNED |
| `context:complete` | Yes | Yes | Yes | ALIGNED |
| `error` | Yes | Yes | Yes | ALIGNED |
| `pong` | Yes | Yes | Yes | ALIGNED |
| `init` | Yes | Yes (implicitly) | Yes | ALIGNED |

### 5.4 API Contract Verdict

**STATUS: ALIGNED** - All documented endpoints and event types are consistent between studies.

---

## 6. Implementation Sequencing Recommendation

### 6.1 Parallel Implementation Strategy

```
Phase 1: Foundation (Can be parallel)
├── Task A: Create server/shared.py         ← No dependencies
├── Task B: Create server/settings.py       ← Depends on shared.py
└── Task C: Create server/__init__.py       ← No dependencies

Phase 2: Server Migration (Sequential)
├── Task D: Move files to server/           ← Depends on Phase 1
├── Task E: Update imports in all .py files ← Depends on Task D
└── Task F: Run tests to verify             ← Depends on Task E

Phase 3: Frontend Extraction (Parallel with Phase 2 after Task D)
├── Task G: Create frontend/index.html      ← Depends on Phase 1
├── Task H: Extract CSS to styles.css       ← Can parallel with G
├── Task I: Extract JS to modules           ← Can parallel with G, H
└── Task J: Wire up module imports          ← Depends on G, H, I

Phase 4: Integration (Sequential)
├── Task K: Update server.py static routes  ← Depends on Phase 2, 3
├── Task L: Implement settings API          ← Depends on Task B, K
├── Task M: Create settings.js UI           ← Depends on Task L
└── Task N: Integration testing             ← Depends on all above
```

### 6.2 Critical Path

```
shared.py → settings.py → server migration → static routes → integration
                        ↘
                         frontend extraction ↗
```

### 6.3 Blocking Dependencies Between server/ and frontend/

| Dependency | Description | Resolution |
|------------|-------------|------------|
| Static file paths | Frontend needs correct serve paths | Implement static routes in server.py first |
| Settings API | settings.js needs API endpoints | Implement settings API before settings.js |
| WebSocket URL | Frontend uses relative `/ws` | No change needed - works with new structure |

### 6.4 Implementation Sequencing Verdict

**STATUS: PARALLELIZABLE** - server/ and frontend/ can be implemented in parallel after shared.py/settings.py foundation is in place.

---

## 7. Unified Recommendations

### 7.1 Merged from Both Studies

| Priority | Recommendation | Source | Implementation |
|----------|----------------|--------|----------------|
| 1 | Create shared.py first | Both | Leaf module, no imports |
| 2 | Create settings.py second | Both | Import only from shared.py |
| 3 | Move Python files to server/ | Both | Update imports after move |
| 4 | Extract frontend files | Study 1 | Can parallel with server |
| 5 | Update static file serving | Both | Point to ../frontend/ |
| 6 | Implement settings API | Both | New endpoints as specified |
| 7 | Run all tests | Both | After each phase |

### 7.2 Reconciled Recommendations

From REVIEW-SERVER-SPAWN (Critical Gap):
- **Fix sprint-log.sh timestamp format**: Currently outputs `YYYY-MM-DD HH:MM:SS` but orchestrator expects Unix epoch seconds
- **Resolution**: Update sprint-log.sh line 64 from `date +"%Y-%m-%d %H:%M:%S"` to `date +%s`

From REVIEW-DASHBOARD-SERVER:
- **Correct batchHistoryState name**: Should be `batchSidebarState` (corrected in study)
- **Add missing DOM IDs**: Timeline and toast-related elements added to study

### 7.3 Naming Conventions (Unified)

| Entity | Agreed Name | Notes |
|--------|-------------|-------|
| Server folder | `server/` | Contains all Python code |
| Frontend folder | `frontend/` | Contains HTML, CSS, JS |
| Constants module | `shared.py` | Path and fixed constants |
| Settings module | `settings.py` | Configurable values |
| Frontend path constant | `FRONTEND_DIR` | Renamed from DASHBOARD_DIR |

---

## 8. Gap Reconciliation

### 8.1 Gaps in Study 1 Addressed by Study 2

| Gap | Study 2 Provides |
|-----|------------------|
| Orchestrator spawn mechanics | Complete `spawn_subagent()` documentation |
| Prompt injection system | `build_prompt_system_append()` analysis |
| File scanning paths | All artifact paths documented |
| Database field constants | `BATCH_FIELDS`, `STORY_FIELDS`, etc. |

### 8.2 Gaps in Study 2 Addressed by Study 1

| Gap | Study 1 Provides |
|-----|------------------|
| Frontend code structure | Complete CSS/JS analysis |
| DOM element IDs | Critical selectors documented |
| JavaScript state objects | `state`, `sidebarState`, `sprintRunState`, `batchSidebarState` |
| UI function inventory | All render and animation functions |

### 8.3 Gaps in Both Studies (Requires Additional Work)

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| Settings persistence format | Low | Document in settings.py: JSON file or SQLite table |
| Error handling in settings API | Low | Add 400/404/500 responses specification |
| Frontend build process | Low | Decide if bundling needed (current: vanilla JS) |

### 8.4 Conflicting Recommendations

**None found.** Both studies agree on all major recommendations.

---

## 9. Fixes Needed

### 9.1 Study Updates Required

| Study | Fix Required | Priority |
|-------|--------------|----------|
| STUDY-SERVER-SPAWN.md | Document that sprint-log.sh timestamp format must change | HIGH |
| STUDY-DASHBOARD-SERVER.md | Already corrected per REVIEW-DASHBOARD-SERVER.md | DONE |

### 9.2 Code Fixes Required Before Implementation

| File | Fix | Priority |
|------|-----|----------|
| sprint-log.sh | Line 64: Change `date +"%Y-%m-%d %H:%M:%S"` to `date +%s` | HIGH |

### 9.3 Documentation Updates

| Document | Update | Priority |
|----------|--------|----------|
| CHANGE-CONTEXT.md | Add sprint-log.sh timestamp fix to "Files to Update" | MEDIUM |
| README.md | Will need full rewrite after restructuring | LOW (post-impl) |

---

## 10. Coherence Status Summary

| Check | Result | Notes |
|-------|--------|-------|
| Path Consistency | PASS | All paths aligned |
| Constants Alignment | PASS | Complete and non-overlapping |
| Import Dependencies | PASS | Circular deps addressed |
| API Contract Consistency | PASS | All endpoints match |
| WebSocket Events | PASS | All 14 event types aligned |
| Implementation Compatibility | PASS | Can parallelize |
| Gap Reconciliation | PASS | Studies complement each other |
| Conflicting Recommendations | PASS | None found |

---

## Final Verdict

**COHERENCE STATUS: COHERENT**

Both studies are well-aligned and can be used together for parallel implementation of the dashboard restructuring. The one critical gap (sprint-log.sh timestamp format) identified in REVIEW-SERVER-SPAWN.md should be addressed before integration testing.

**Ready for Implementation: YES**

---

**Reviewer Notes:**
- All five documents (CHANGE-CONTEXT, Study 1, Study 2, Review 1, Review 2) were analyzed
- Cross-referenced all path constants, settings, API endpoints, and WebSocket events
- Verified no conflicting recommendations exist
- Implementation can proceed with high confidence
