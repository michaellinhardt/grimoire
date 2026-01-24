# Haiku Review: Dashboard & Data Plan

## Summary

The implementation plan addresses critical data flow issues in the Sprint Runner dashboard but execution status is incomplete. Of the 9 critical errors identified in the original review, only partial fixes have been implemented. The plan is comprehensive and technically sound, but several high-priority items remain unimplemented in the codebase. Key gaps exist in API endpoint availability, batch:warning schema alignment, timestamp consistency, and frontend state restoration. The plan itself is well-structured and executable, but requires full implementation before the dashboard can function reliably.

---

## Plan Coverage Analysis

### Implemented (Verified in Code)
- Step 1.4: Timestamp unit fix appears partially applied (line 246 in orchestrator.py still shows seconds, not milliseconds)
- Step 4.3: Settings validation is NOT aligned (still shows min: 1024, requires fix)

### NOT Implemented (Critical Gaps)

**Phase 1 - API Endpoints (Steps 1.1-1.2)**
- `sprint_status_handler()` does NOT exist in server.py
- `/api/sprint-status` endpoint NOT registered
- `orchestrator_activity_handler()` does NOT exist in server.py
- `/api/orchestrator-status` endpoint NOT registered
- **Impact**: Frontend `tryAutoLoad()` will receive 404 errors on page load, preventing dashboard initialization

**Phase 1 - WebSocket Schema (Step 1.3)**
- batch:warning event still emits `"warning"` key at line 217 in orchestrator.py
- Should emit `"message"` and `"warning_type"` per the plan
- **Impact**: Schema validation mismatch; frontend expects `message`, backend sends `warning`

**Phase 1 - Timestamp Fixes (Steps 1.4-1.6)**
- Line 246 in orchestrator.py: still shows `int(time.time())` NOT `int(time.time() * 1000)`
- Line 984 in orchestrator.py: also uses seconds not milliseconds
- **Impact**: Duration calculations will be off by factor of 1000

**Phase 2 - Database Schema (Step 2.1)**
- `payload_json` column NOT added to events table
- Schema at lines 113-129 in db.py has no `payload_json` column
- **Impact**: Events cannot be fully reconstructed on client reconnection; cycle and story events will have missing required fields

**Phase 2 - DB Function Updates (Step 2.2-2.3)**
- `create_event()` function signature does NOT include `payload` parameter
- `normalize_db_event_to_ws()` does NOT check for `payload_json` or fall back correctly
- **Impact**: Legacy event reconstruction is impossible; reconnecting clients get incomplete event history

**Phase 4 - Frontend Fixes (Steps 4.1-4.2)**
- batch:warning handler at line 392 in websocket.js does NOT check `warning_type`
- Still uses simple toast without warning_type differentiation
- **Impact**: Cannot differentiate warning severity; context_unavailable warnings treated same as other warnings

**Phase 4 - Stale State Fix (Step 4.2)**
- `returnToLiveView()` at line 305 in sidebar.js still lacks active operation restoration
- No calls to `renderActiveOperationsDisplay()` or timer re-establishment
- **Impact**: Users viewing past batches during active sprint won't see operations until next event

---

## Critical Issues Assessment

### Priority CRITICAL (Breaking functionality)

1. **Missing API Endpoints (Errors 1)** - BLOCKING
   - Frontend requires `/api/sprint-status` and `/api/orchestrator-status` for dashboard load
   - Currently returns 404, preventing app initialization
   - Estimated effort: 30 minutes

2. **Timestamp Inconsistency (Errors 3)** - BLOCKER FOR DATA INTEGRITY
   - Affects duration calculations, batch history, timing-based features
   - Must be fixed before full testing
   - Estimated effort: 15 minutes

3. **Missing payload_json Column (Error 5)** - BLOCKER FOR RECONNECTION
   - Prevents client reconnection from recovering state
   - New clients cannot receive complete event history
   - Estimated effort: 45 minutes (schema migration + function updates)

### Priority HIGH (Degraded functionality)

4. **batch:warning Schema Mismatch (Errors 2, 7)** - SILENT FAILURES
   - Events are emitted but validation fails silently
   - Frontend cannot render warnings correctly
   - Estimated effort: 15 minutes

5. **Stale State in Past Batch Return (Error 8)** - USER EXPERIENCE
   - Users see stale UI when returning from history view
   - No data loss, but confusing UX
   - Estimated effort: 20 minutes

### Priority MEDIUM (Incomplete event reconstruction)

6. **Missing Field Extraction in normalize_db_event_to_ws (Error 4)** - COVERED BY payload_json
   - Once payload_json is implemented, this is resolved
   - Falls back to incomplete extraction if payload_json not available
   - Estimated effort: Included in Error 5 fix

---

## Additional Issues Found

### Issue A: Database Migration Not Provided
The plan assumes schema migration will occur via `init_db()`, but `CREATE TABLE IF NOT EXISTS` will not add columns to existing tables. Users with existing databases will not get the `payload_json` column.

**Recommendation**: Add a migration check function:
```python
def migrate_db() -> None:
    """Apply schema migrations for existing databases."""
    with get_connection() as conn:
        cursor = conn.execute("PRAGMA table_info(events)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'payload_json' not in columns:
            conn.execute("ALTER TABLE events ADD COLUMN payload_json TEXT")
            print("Migrated events table: added payload_json column")
```

This should be called in server startup before `init_db()`.

### Issue B: Import Statement Missing
The plan correctly identifies that `yaml` import is needed for sprint_status_handler, but this hasn't been added to server.py. The `json` import is needed for db.py but also missing.

### Issue C: Logging Function Missing
Step 3.1 mentions logging dropped events but the actual implementation requires `import sys` and stderr output formatting. This has not been added.

### Issue D: Frontend State Restoration Incomplete
The proposed `returnToLiveView()` fix references functions that exist but are conditionally called. The logic needs proper error handling if `sprintRunState.activeOperations` is undefined or empty.

### Issue E: No Validation Tests Added
The plan provides test cases but no pytest tests or frontend unit tests have been created to verify the fixes work end-to-end.

---

## Recommendations

### Immediate Actions (Required Before Use)
1. **Implement Phase 1 API endpoints** (Steps 1.1-1.2) - 30 minutes
   - These are blocking for frontend initialization
   - Add both handlers and routes to server.py
   - Include `import yaml` at top of file

2. **Fix batch:warning schema** (Step 1.3) - 15 minutes
   - Change `"warning"` to `"message"` in orchestrator.py line 217
   - Add `"warning_type": "context_unavailable"`

3. **Fix timestamp units** (Steps 1.4-1.6) - 15 minutes
   - Apply millisecond conversion to ALL three locations
   - Use `int(time.time() * 1000)` consistently
   - Verify with database query after test run

4. **Add database schema column** (Step 2.1-2.2) - 45 minutes
   - Add migration function and call on startup
   - Update `create_event()` signature with `payload` parameter
   - Import `json` in db.py

5. **Update event normalization** (Step 2.3) - 20 minutes
   - Add `payload_json` preference in normalize_db_event_to_ws
   - Test fallback for legacy events

### High-Priority Improvements (Next Sprint)
6. **Fix frontend warning handler** (Step 4.1) - 15 minutes
   - Check `warning_type` and adjust toast styling
   - Add warning_type to log entry

7. **Restore state on view switch** (Step 4.2) - 20 minutes
   - Add active operations re-rendering
   - Restart command timers

8. **Add comprehensive tests** - 1 hour
   - Integration test for API endpoints
   - Database migration test
   - WebSocket reconnection test with full event history

### Quality Assurance
- **Manual testing checklist**:
  - Load dashboard with no sprint running (verify API endpoints work)
  - Start sprint and trigger context warning (verify schema correct)
  - Check database timestamps (verify milliseconds)
  - Disconnect/reconnect WebSocket (verify event reconstruction)
  - View past batch while sprint running, return to live (verify operations visible)

- **Automated testing**:
  - Add `test_api_endpoints.py` for Step 1.1-1.2
  - Add `test_timestamp_consistency.py` for Step 1.4-1.6
  - Add `test_event_reconstruction.py` for Step 2.1-2.3

---

## Implementation Order & Sequencing

**Recommended sequence** (dependencies matter):

1. Phase 1 API endpoints (no dependencies)
2. Phase 1 batch:warning fix (no dependencies)
3. Phase 1 timestamp fixes (apply all together)
4. Phase 2 database schema + migration (depends on Phase 1 timestamps)
5. Phase 2 create_event update (depends on Phase 2 schema)
6. Phase 2 normalize_db_event_to_ws (depends on Phase 2 create_event)
7. Phase 3 emit_event logging (optional, can parallel with Phase 2)
8. Phase 4 frontend fixes (can parallel with backend)

**Estimated total effort**: 3.5-4 hours implementation + 1 hour testing = 4.5 hours

---

## Risk Assessment Summary

### Low Risk (Isolated, easily reversible)
- API endpoint additions (additive only)
- batch:warning field rename (same event, same payload structure)
- Frontend websocket handler updates (UI-only)
- Emit event logging (logging only, non-blocking)

### Medium Risk (Affects data paths, but tested)
- Timestamp fixes (all three locations must be applied together)
- Settings validation alignment (frontend UI only)
- returnToLiveView state restoration (affects UX during view switch)

### Higher Risk (Schema change, requires migration)
- Database `payload_json` column (but: column is nullable, backward compatible)
- Migration must run before new events are logged to ensure consistency
- **Mitigation**: Test migration on copy of production DB first; SQLite ALTER TABLE is safe

### Mitigation Strategies
1. Implement all timestamp fixes in single commit to ensure consistency
2. Run database migration on startup with clear logging
3. Add feature flags to disable new features if migration fails
4. Create backup before schema change (user responsibility, document clearly)

---

## Code Quality Notes

### Good Practices in Plan
- Clear step-by-step instructions with line numbers
- Before/after code snippets for verification
- Comprehensive test plan included
- Risk assessment and rollback strategy provided
- Dependencies between phases clearly stated

### Gaps in Plan
- Database migration script not provided (assumes init_db will handle it)
- No explicit pytest test cases provided
- Frontend function availability not fully verified against codebase
- No mention of documentation updates needed

---

## Conclusion

The implementation plan is **comprehensive, well-structured, and technically sound**. However, the plan has NOT been executed in the codebase. Zero of 9 critical errors are currently fixed. The plan provides clear guidance for implementation but requires 4.5 hours of developer time to complete.

**Current Status**: READY FOR IMPLEMENTATION (plan is complete, execution not started)

**Recommendation**: Execute phases in recommended order. Prioritize API endpoints and timestamp fixes before proceeding with database changes. Add automated tests for verification before mark-as-complete.

**Success Criteria**:
- All 9 errors from original review resolved
- Dashboard loads without 404 errors
- WebSocket events validate against schema
- Reconnecting clients receive complete event history
- Timestamps consistent across database and API
- Frontend state preserved during view switching
- All automated tests pass
