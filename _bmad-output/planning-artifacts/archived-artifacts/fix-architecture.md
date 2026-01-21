# Architecture Document Alignment Fix

## Context

A comprehensive gap analysis was performed across all planning artifacts (PRD, Architecture, Epics, UX Spec). The PRD was updated to simplify the process lifecycle model, but these changes were **not propagated** to the Architecture document.

## Source of Truth

The **PRD** (`_bmad-output/planning-artifacts/prd.md`) is the source of truth. The Architecture document must be updated to align with it.

## Issues to Fix

### Issue 1: State Machine Model (CRITICAL)

**Current (Wrong):** Architecture describes a 6-state instance machine:
- AR15: "6-state instance machine: Idle → Spawning → Working → Pending → Terminating (+ Error)"
- Multiple references to "Pending" state throughout

**Correct (Per PRD):** 3-state model only:
- **Idle:** No process running
- **Working:** CC processing (process running)
- **Error:** Failed operation

**PRD References:** FR28 describes 3-state, FR54/FR55a-55e are marked [REMOVED] indicating no Pending state.

**Fix Required:**
- Update "Instance Lifecycle" section to 3-state
- Update state machine diagram from 6-state to 3-state
- Remove all references to "Pending", "Spawning", "Terminating" states
- Update "Instance State Machine" code/diagram

---

### Issue 2: First-Keystroke Spawn Strategy (CRITICAL)

**Current (Wrong):** AR17 states "First-keystroke spawn strategy (typing masks cold start)"

**Correct (Per PRD):** On-send spawn - process spawns when user clicks Send, not on first keystroke. FR55a is marked [REMOVED] with note "On-send spawn instead".

**Fix Required:**
- Remove AR17 or update to "On-send spawn strategy"
- Update "Spawn Strategy" section to describe spawn occurring on message send
- Remove any references to "first-keystroke" or "typing masks cold start"

---

### Issue 3: Timeout Configuration (CRITICAL)

**Current (Wrong):** AR16 describes "Tiered timeout: Working=∞, Pending+Focused=10min, Pending+Unfocused=3min"

**Correct (Per PRD):** No timeouts needed. FR55b-55e are all marked [REMOVED] with notes "No timeout needed" and "No idle timeout needed, processes exit after response".

**Fix Required:**
- Remove AR16 entirely
- Remove any timeout-related configuration
- Remove references to "unfocused timeout", "focused timeout", "timer reset"
- The request-response model means processes exit naturally after each response

---

### Issue 4: Response State Tracking (MEDIUM)

**Current:** `ResponseState` interface includes `status: 'idle' | 'sending' | 'complete' | 'error'`

**Should Be:** Simplified to match 3-state model. "sending" is essentially "working".

**Fix Required:**
- Align ResponseState with 3-state model or clarify this is internal tracking separate from UI state

---

### Issue 5: Missing Rewind Architecture (GAP)

**Current:** IPC includes `sessions:rewind` but no implementation detail exists.

**PRD Requirements (FR67c-67h):**
- FR67c: Capture session ID from stream init message
- FR67d: Capture user message UUIDs from stream for checkpoint capability
- FR67e: Store session metadata (tokens, cost) to database during streaming
- FR67f: Track session lineage via `forked_from_session_id` when rewinding
- FR67g: Can hide forked-from sessions via `is_hidden` flag
- FR67h: User can rewind conversation from any user message via hover action

**Fix Required:**
Add new section "Rewind Architecture" covering:
1. How `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1` env var enables checkpointing
2. How checkpoint UUIDs are captured from user message events in stream
3. Fork mechanics: how new session is created from checkpoint
4. Session lineage: `forked_from_session_id` and `is_hidden` flag usage
5. IPC flow for `sessions:rewind` request/response

---

## Summary of Changes

| Section | Action |
|---------|--------|
| AR15 (6-state machine) | Replace with 3-state model |
| AR16 (Tiered timeout) | Remove entirely |
| AR17 (First-keystroke spawn) | Change to on-send spawn |
| Instance Lifecycle | Rewrite for 3-state + request-response |
| Spawn Strategy | Update to on-send |
| State Machine diagram | Simplify to Idle → Working → Idle (+ Error) |
| NEW: Rewind Architecture | Add section with implementation details |

## Validation

After fixes, verify:
1. No mentions of "Pending" state
2. No mentions of "first-keystroke spawn"
3. No mentions of "timeout" configuration
4. 3-state model consistently described
5. Rewind architecture section exists with implementation guidance
