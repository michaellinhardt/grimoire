# Unified Implementation Order

This document reconciles PLAN-PROMPTS-SCRIPTS.md and PLAN-DASHBOARD-DATA.md to ensure coherent, conflict-free implementation.

## Resolved Conflicts

### Conflict 1: `create_event()` Signature Change (CRITICAL)

- **Source**: PLAN-DASHBOARD-DATA Fix 4.3 adds `event_type` parameter to `create_event()`
- **Impact**: PLAN-PROMPTS-SCRIPTS doesn't account for this; orchestrator.py has 3 `create_event()` calls
- **Resolution**:
  1. Apply schema change (Fix 4.3) FIRST
  2. Update ALL `create_event()` callers IMMEDIATELY after schema change
  3. Include orchestrator.py updates from PLAN-DASHBOARD-DATA Fix 4.4 as part of schema migration
  4. Any subsequent fixes touching `create_event()` must use the new signature

### Conflict 2: Timestamp Format Inconsistency

- **Source**: PLAN-DASHBOARD-DATA Fix 2.2 changes `db.py` to milliseconds, but orchestrator.py already uses milliseconds for WebSocket events
- **Impact**: Mixed timestamp formats could cause frontend display issues
- **Resolution**:
  1. Apply timestamp standardization to ALL components together
  2. Verify orchestrator.py WebSocket events use same format
  3. Current orchestrator.py line 921: `int(datetime.now().timestamp() * 1000)` - already milliseconds, GOOD
  4. Current db.py line 176, 267, 378, 470, 540: `int(time.time())` - needs change to milliseconds

### Conflict 3: Shared File orchestrator.py

- **Source**: Both plans modify orchestrator.py
  - PLAN-PROMPTS-SCRIPTS Fix 3.1: Adds timeout handling (lines 719-808)
  - PLAN-DASHBOARD-DATA Fix 4.4: Updates `create_event()` calls (lines 502-512, 534-544, 888-898)
- **Resolution**: Apply PLAN-DASHBOARD-DATA changes first (they're smaller, targeted). Then apply PLAN-PROMPTS-SCRIPTS changes which add new code.

### Conflict 4: Database Schema Changes Must Be Atomic

- **Source**: Multiple schema changes in PLAN-DASHBOARD-DATA
  - Fix 2.1: Add FK constraint on `batch_id`
  - Fix 4.3: Add `event_type` column
- **Resolution**: Combine ALL schema changes into a single migration step. Delete DB once, apply all changes.

## Execution Sequence

### Phase 0: Pre-Implementation Backup (5 min)
```bash
# Backup existing database if it has valuable data
cp /Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/sprint-runner.db sprint-runner.db.backup 2>/dev/null || echo "No existing DB"

# Run existing tests to establish baseline
cd /Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard
python -m pytest test_*.py -v 2>/dev/null || echo "Tests not available"
```

### Phase 1: Foundation - Database Schema (30 min)
*All schema changes must be done together before any other changes*

| Order | Fix | Source Plan | File | Description |
|-------|-----|-------------|------|-------------|
| 1.1 | 2.3 | DASHBOARD-DATA | db.py | Add `VALID_STORY_STATUSES` constant (line 33) |
| 1.2 | 2.1+4.3 | DASHBOARD-DATA | db.py | Combined schema: FK constraint + event_type column |
| 1.3 | 2.2 | DASHBOARD-DATA | db.py | Timestamp standardization to milliseconds |
| 1.4 | 2.4 | DASHBOARD-DATA | db.py | Add status validation to `update_story()` |

**POST-STEP**: Delete `sprint-runner.db` and restart server to recreate with new schema.

### Phase 2: Critical Logging Pipeline (45 min)
*Fix the logging architecture mismatch - highest priority*

| Order | Fix | Source Plan | File | Description |
|-------|-----|-------------|------|-------------|
| 2.1 | 1.1 | PROMPTS-SCRIPTS | sprint-log.sh | Change to CSV output to stdout + file |
| 2.2 | 4.4 | DASHBOARD-DATA | orchestrator.py | Update `create_event()` calls with `event_type` |
| 2.3 | 1.2 | PROMPTS-SCRIPTS | instructions.xml (3 files) | Fix command names in log calls |
| 2.4 | 1.3 | PROMPTS-SCRIPTS | instructions.xml | Add `story_count` computation |

**POST-STEP**: Test logging end-to-end:
```bash
# Test sprint-log.sh outputs CSV to stdout
echo '{"epic_id":"2a","story_id":"2a-1","command":"test","task_id":"setup","status":"start","message":"Test"}' | _bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh
```

### Phase 3: Server and WebSocket Fixes (30 min)

| Order | Fix | Source Plan | File | Description |
|-------|-----|-------------|------|-------------|
| 3.1 | 1.1 | DASHBOARD-DATA | README.md | Update port references (8765 -> 8080) |
| 3.2 | 1.2 | DASHBOARD-DATA | server.py | Add `sprint-runner.csv` to allowed files |
| 3.3 | 3.3 | DASHBOARD-DATA | server.py | Add PONG and BATCH_WARNING to EventType enum |
| 3.4 | 3.2 | DASHBOARD-DATA | server.py | Add context event schemas to EVENT_PAYLOAD_SCHEMAS |
| 3.5 | 3.4 | DASHBOARD-DATA | server.py | Add batch:warning payload schema |
| 3.6 | 1.4 | DASHBOARD-DATA | server.py | Remove dead heartbeat_task() function |
| 3.7 | 3.1 | DASHBOARD-DATA | server.py | Filter events by batch in get_initial_state() |
| 3.8 | 4.1 | DASHBOARD-DATA | server.py | Normalize DB events to WebSocket format |
| 3.9 | 2.2 (partial) | DASHBOARD-DATA | server.py | Update timestamp to milliseconds (lines 535, 665) |

### Phase 4: Frontend Fixes (20 min)

| Order | Fix | Source Plan | File | Description |
|-------|-----|-------------|------|-------------|
| 4.1 | 1.3 | DASHBOARD-DATA | dashboard.html | CSS.escape() for story badge selector |
| 4.2 | 4.2 | DASHBOARD-DATA | dashboard.html | Handle unlimited mode in progress bar |

### Phase 5: High Priority Prompt/Script Fixes (45 min)

| Order | Fix | Source Plan | File | Description |
|-------|-----|-------------|------|-------------|
| 5.1 | 2.1 | PROMPTS-SCRIPTS | template.md | Restructure with named sections |
| 5.2 | 2.2 | PROMPTS-SCRIPTS | All files | Document variable syntax convention |
| 5.3 | 2.3 | PROMPTS-SCRIPTS | task-taxonomy.yaml | Remove orphaned tech-spec-discovery |
| 5.4 | 2.5 | PROMPTS-SCRIPTS | instructions.xml | Add error handling for sprint-log.sh |

### Phase 6: Medium Priority Fixes (30 min)

| Order | Fix | Source Plan | File | Description |
|-------|-----|-------------|------|-------------|
| 6.1 | 3.1 | PROMPTS-SCRIPTS | orchestrator.py | Add subagent timeout handling |
| 6.2 | 3.2 | PROMPTS-SCRIPTS | instructions.xml | Compute actual metrics in log messages |
| 6.3 | 3.3 | PROMPTS-SCRIPTS | orchestrator.py | Background task tracking wrapper |
| 6.4 | 3.4 | PROMPTS-SCRIPTS | instructions.xml | Normalize story_key/story_keys handling |
| 6.5 | 3.5 | PROMPTS-SCRIPTS | README.md | Document jq dependency |
| 6.6 | 3.6 | PROMPTS-SCRIPTS | instructions.xml | Wrap all bash in CDATA blocks |

### Phase 7: Low Priority Fixes (20 min)

| Order | Fix | Source Plan | File | Description |
|-------|-----|-------------|------|-------------|
| 7.1 | 4.1 | PROMPTS-SCRIPTS | template.md | Remove duplicate checklist content |
| 7.2 | 4.2 | PROMPTS-SCRIPTS | orchestrator.py | Make context age configurable via env |
| 7.3 | 4.3 | PROMPTS-SCRIPTS | instructions.xml | Standardize output markers (CAUTION: update parser) |
| 7.4 | 4.4 | PROMPTS-SCRIPTS | instructions.xml | Compress verbose comments |
| 7.5 | 4.5 | PROMPTS-SCRIPTS | workflow.yaml | Add version numbers |
| 7.6 | 4.6 | PROMPTS-SCRIPTS | workflow.yaml | Remove unused variables |

## Integration Points

### 1. sprint-log.sh <-> orchestrator.py
- **Connection**: `sprint-log.sh` outputs CSV, `orchestrator.py._parse_csv_log_line()` parses it
- **Format Contract**: `timestamp,epicID,storyID,command,task-id,status,"message"`
- **After Fix 2.1**: Sprint-log.sh outputs CSV to stdout for orchestrator parsing
- **Test**: Run sprint-log.sh, pipe output to Python CSV parser

### 2. db.py <-> orchestrator.py
- **Connection**: `create_event()` function signature
- **After Fix 1.2 + 2.2**: New `event_type` parameter required
- **All callers must be updated**: Lines 502-512, 534-544, 888-898 in orchestrator.py
- **Test**: Start orchestrator, verify events have event_type in database

### 3. db.py <-> server.py
- **Connection**: `get_events()`, `get_events_by_batch()`, `get_active_batch()`
- **Timestamp Contract**: After Fix 1.3, all timestamps are milliseconds (13 digits)
- **Test**: Query DB, verify timestamps are ~13 digits not ~10 digits

### 4. server.py <-> dashboard.html (WebSocket)
- **Connection**: WebSocket event format `{type, timestamp, payload}`
- **Event Types**: Must match `EventType` enum in server.py
- **After Fix 3.3**: New event types PONG, BATCH_WARNING available
- **After Fix 4.1**: Events in init payload are normalized to WebSocket format

### 5. instructions.xml <-> task-taxonomy.yaml
- **Connection**: Command names in log calls must match taxonomy
- **After Fix 2.3**: All log calls use `sprint-` prefixed names
- **Test**: `grep -r '"command":' commands/ | grep -v sprint-` should return nothing

### 6. orchestrator.py emit_event() <-> server.py broadcast()
- **Connection**: orchestrator.py calls `emit_event()` which triggers `broadcast()`
- **Payload Validation**: server.py `validate_payload()` checks required fields
- **After Fix 3.2 + 3.4**: Context and warning events have proper schemas

## Final Testing Order

### Unit Tests (Run after each phase)
```bash
cd /Users/teazyou/dev/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard
python -m pytest test_db.py -v       # After Phase 1
python -m pytest test_server.py -v   # After Phase 3
python -m pytest test_*.py -v        # After all phases
```

### Integration Tests

1. **Logging Pipeline Test** (After Phase 2):
   ```bash
   # Terminal 1: Start server
   python server.py

   # Terminal 2: Test logging
   _bmad/bmm/workflows/4-implementation/sprint-runner/scripts/sprint-log.sh \
     '{"epic_id":"2a","story_id":"2a-1","command":"sprint-create-story","task_id":"setup","status":"start","message":"Test"}'

   # Verify: stdout shows CSV, file gets human-readable
   ```

2. **WebSocket Flow Test** (After Phase 3):
   ```bash
   # Start server
   python server.py

   # Connect with wscat
   wscat -c ws://localhost:8080/ws

   # Verify: Receive init event with batch and events in correct format
   ```

3. **Full Cycle Test** (After Phase 6):
   ```bash
   # Start server with orchestrator
   curl -X POST http://localhost:8080/api/orchestrator/start \
     -H "Content-Type: application/json" \
     -d '{"batch_size": 1}'

   # Verify:
   # - Dashboard shows progress
   # - Database has events with event_type
   # - Timestamps are milliseconds
   # - No console errors
   ```

### Manual Verification Checklist

- [ ] Server starts on port 8080
- [ ] Dashboard loads at http://localhost:8080/
- [ ] WebSocket connects without errors
- [ ] Progress bar works in unlimited mode (shows pulsing animation)
- [ ] Story badges update without console errors
- [ ] Timestamps in database are milliseconds (~13 digits)
- [ ] Events have event_type column populated
- [ ] sprint-runner.csv is accessible at /sprint-runner.csv
- [ ] Command names in logs match taxonomy (sprint- prefix)

## Rollback Strategy

If issues occur during implementation:

1. **Phase 1 Rollback**: Restore `db.py` from git, delete `sprint-runner.db`
2. **Phase 2 Rollback**: Restore `sprint-log.sh` and `orchestrator.py` from git
3. **Phase 3 Rollback**: Restore `server.py` from git
4. **Full Rollback**: `git checkout -- .` to restore all files

Each phase should be committed separately:
```bash
git add -A && git commit -m "Phase N: <description>"
```

## Time Estimates

| Phase | Estimated Time | Cumulative |
|-------|----------------|------------|
| Phase 0 | 5 min | 5 min |
| Phase 1 | 30 min | 35 min |
| Phase 2 | 45 min | 80 min |
| Phase 3 | 30 min | 110 min |
| Phase 4 | 20 min | 130 min |
| Phase 5 | 45 min | 175 min |
| Phase 6 | 30 min | 205 min |
| Phase 7 | 20 min | 225 min |
| Testing | 30 min | 255 min |

**Total Estimated Time**: ~4.5 hours

## Critical Dependencies Summary

```
MUST DO FIRST:
  Phase 1 (db.py schema)
    |
    +-> Phase 2.2 (orchestrator.py create_event calls)
    |
    +-> Phase 3.9 (server.py timestamps)

MUST DO TOGETHER:
  Phase 2.1 (sprint-log.sh CSV) + Phase 2.3 (command names)

INDEPENDENT TRACKS (can parallelize):
  Track A: Phase 3 (server.py) + Phase 4 (dashboard.html)
  Track B: Phase 5-7 (prompts/scripts)
```

---

**Document Version**: 1.0
**Created**: 2026-01-24
**Based On**:
- PLAN-PROMPTS-SCRIPTS.md (21 issues)
- PLAN-DASHBOARD-DATA.md (19 issues)
