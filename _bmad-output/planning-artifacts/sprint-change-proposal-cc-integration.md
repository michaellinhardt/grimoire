# Sprint Change Proposal: CC Integration Mode Change

**Date:** 2026-01-22
**Status:** Pending Approval
**Change Type:** Architectural Simplification
**Impact Level:** Moderate (multiple artifacts, no MVP scope change)

---

## Executive Summary

This proposal documents a significant simplification to Grimoire's Claude Code integration architecture. The change replaces NDJSON streaming mode with the `-p` (prompt) flag request-response pattern, eliminating substantial complexity while maintaining all user-facing functionality.

### The Change

| Aspect | Before | After |
|--------|--------|-------|
| CC invocation | `--output-format stream-json --include-partial-messages -p "msg"` | `--session-id <uuid> -p "msg"` |
| Response delivery | NDJSON streaming events | Process exit + session file read |
| State machine | 6 states (Idle, Spawning, Working, Pending, Terminating, Error) | 3 states (Idle, Working, Error) |
| Instance lifecycle | Persistent with tiered timeouts | Per-message (exits after response) |
| User feedback | Real-time streaming text | "Thinking..." indicator + full response |

### Why This Change

1. **Discovered simplicity:** The `-p` flag provides complete functionality without streaming complexity
2. **No warmup penalty:** Testing confirmed no cold-start delay with `-p` mode
3. **Reduced complexity:** Eliminates NDJSON parsing, stream state management, file watchers, timeout logic
4. **Session file as truth:** CC already writes complete responses to session file - we just read it

---

## Impact Analysis

### Artifacts Affected

| Artifact | Sections Modified | Edit Count |
|----------|-------------------|------------|
| spawn-child-decisions.md | 10 sections | 10 edits |
| architecture.md | 25+ sections | 43 edits |
| epics.md | 15+ sections | 28 edits |
| prd.md | 12 sections | 17 edits |
| ux-design-specification.md | 15 sections | 18 edits |

### Components Removed

| Component | Reason |
|-----------|--------|
| NDJSON stream parser | No streaming with `-p` mode |
| File watcher | Read file on process exit instead |
| Tiered timeout system | Processes exit naturally |
| Pending state | No waiting state - process exits |
| Spawning state | Simplified to Working |
| Terminating state | Process exits naturally |
| 🔌 Disconnect button | No persistent instances to disconnect |
| First-keystroke spawn | No warmup benefit with `-p` |

### Components Added/Modified

| Component | Change |
|-----------|--------|
| Session file reader | New - reads JSONL after process exit |
| "Thinking..." indicator | New - shows while process runs |
| 3-state machine | Simplified from 6 states |
| On-send spawn | Replaces first-keystroke spawn |

---

## Technical Summary

### New CC Invocation Pattern

```typescript
const child = spawn('claude', [
  '--session-id', sessionId,
  '-p', message
], {
  env: {
    ...process.env,
    CLAUDE_CONFIG_DIR: path.join(app.getPath('userData'), '.claude')
  }
});

child.on('exit', async (code) => {
  if (code === 0) {
    const newEvents = await readSessionFile(sessionId);
    emitResponseReady(sessionId, newEvents);
  } else {
    emitError(sessionId, code);
  }
});
```

### New State Machine

```
Idle → Working → Idle (success)
         ↓
       Error
```

### New IPC Channels

| Old Channel | New Channel |
|-------------|-------------|
| `instance:streamChunk` | `instance:responseReady` |
| `sessions:spawn` | `sessions:sendMessage` |

### New Data Flow

```
User clicks Send
       ↓
Spawn: claude --session-id <uuid> -p "message"
       ↓
State: Working ("Thinking..." indicator)
       ↓
Process completes (exit code 0)
       ↓
Read session JSONL file
       ↓
Extract new events since last read
       ↓
Display response
       ↓
State: Idle
```

---

## Approved Edits Summary

### spawn-child-decisions.md (10 edits)

1. §3.1: Tiered Timeout → Process Lifecycle (request-response)
2. §3.2: 6-state → 3-state machine
3. §3.3: Error handling simplified
4. §3.5: First-keystroke spawn → On-send spawn
5. §4.1: Status indicators (6→3 states)
6. §4.5: Connection status icon REMOVED
7. §4.6: Typing/spawning feedback simplified
8. §5: Stream Communication → CC Communication (complete replacement)
9. §6.6: NEW section documenting removed settings
10. §8.2-8.3: Tab management updated

### architecture.md (43 edits)

- Cross-Cutting Concerns 1-4, 6: Updated for 3-state, file reading
- Requirements Overview: FR references updated
- NFRs: Integration requirements updated
- Instance Lifecycle: Complete rewrite
- CC Communication: Complete rewrite (was Stream Communication)
- Spawn Implementation: Code updated
- IPC Channels: Streaming channels removed
- Event System Patterns: Updated for response events
- Data Flow Diagram: Complete rewrite
- Project Structure: stream-parser → session-file-reader
- Multiple reference updates throughout

### epics.md (28 edits)

- FR7b, FR28a/b, FR50, FR54-FR55e, FR64: Updated/removed
- NFR5, NFR20-22, NFR24: Updated
- AR7, AR15-AR22: Updated for new architecture
- UX10: Updated to 3-state
- FR Coverage Map: Updated
- Epic 2a, 3a, 3b stories: Significant rewrites
- Story 3b.2: NDJSON Stream Parser → Session File Reader
- Story 3b.3: 6-state → 3-state machine
- Story 3b.4: Timeouts → On-Send Spawn Pattern

### prd.md (17 edits)

- Executive Summary: Resource management updated
- Technical Success: Performance requirements updated
- Child Process Management: Updated for request-response
- Journey 2: Updated flow description
- System Integration: 6-state → 3-state
- FR7b, FR28a/b, FR32b, FR41, FR50, FR54-FR55e, FR64: Updated
- NFRs: Streaming → response display
- CC Integration: Spawn arguments updated
- File System: File watcher → file reading

### ux-design-specification.md (18 edits)

- Critical Success Moments: Streaming → thinking indicator
- Experience Mechanics: Updated for request-response
- Journey 1 & 2 flows: Complete diagram updates
- Journey Patterns: 6-state → 3-state
- Session List Item: Disconnect button removed
- Status Indicator: 6-state → 3-state machine
- Feedback Patterns: Streaming → thinking feedback
- Loading/Session States: Updated

---

## Implementation Impact

### Reduced Implementation Scope

| Removed Work | Estimated Savings |
|--------------|-------------------|
| NDJSON stream parser | Moderate complexity |
| Stream state management | High complexity |
| File watcher setup | Low complexity |
| Tiered timeout logic | Moderate complexity |
| Disconnect button UI | Low complexity |
| 6-state machine testing | Moderate complexity |

### New Implementation Work

| Added Work | Estimated Effort |
|------------|------------------|
| Session file reader | Low complexity |
| "Thinking..." indicator | Low complexity |
| 3-state machine | Low complexity (simpler than 6-state) |

### Net Impact

**Significant reduction in implementation complexity.** The request-response pattern is fundamentally simpler than streaming with state management.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| No real-time feedback | Low | Medium | "Thinking..." indicator provides feedback |
| Long responses feel slow | Low | Low | CC processes quickly; indicator shows activity |
| Session file parsing errors | Low | Medium | CC writes valid JSONL; add error handling |

---

## Approval Checklist

- [ ] All edit proposals reviewed
- [ ] Technical approach validated
- [ ] No MVP scope changes required
- [ ] Implementation complexity reduced
- [ ] User experience maintained (with "Thinking..." indicator)

---

## Next Steps

Upon approval:

1. Apply all approved edits to planning artifacts
2. Update any dependent documentation
3. Proceed with implementation using simplified architecture

---

**Prepared by:** Claude (Correct Course Workflow)
**Review requested from:** @teazyou
