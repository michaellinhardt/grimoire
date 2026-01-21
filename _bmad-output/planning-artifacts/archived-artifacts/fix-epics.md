# Epics Document Alignment Fix

## Context

A comprehensive gap analysis was performed across all planning artifacts (PRD, Architecture, Epics, UX Spec). The PRD was updated to simplify the process lifecycle model, but these changes were **not propagated** to the Epics document.

## Source of Truth

The **PRD** (`_bmad-output/planning-artifacts/prd.md`) is the source of truth. The Epics document must be updated to align with it.

## Issues to Fix

### Issue 1: Story 2a.3 - Disconnect Button References (CRITICAL)

**Current (Wrong):** Story 2a.3 "Session Management Actions" contains:

```
Given a session has an active instance (⚡ indicator)
When the user clicks the 🔌 disconnect button (FR28a)
Then if the instance is Working, a warning dialog appears (FR28b)
And if the instance is Pending, no warning is shown
And confirming disconnect terminates the child process
And the session transitions to Idle state
```

**Correct (Per PRD):** FR28a and FR28b are marked [REMOVED] - "No persistent instances to disconnect with request-response model"

**Fix Required:**
- Remove the entire acceptance criteria block about disconnect button
- Remove references to FR28a, FR28b from the story
- The request-response model means processes exit naturally; no disconnect needed

---

### Issue 2: Story 3b.3 - Instance State Machine (CRITICAL)

**Current (Wrong):** Describes 6-state machine:

```
Given the 6-state instance machine (AR15)
When a session instance changes state
Then transitions follow: Idle → Spawning → Working → Pending → (Terminating) → Idle
```

Also references "Pending state" multiple times.

**Correct (Per PRD):** 3-state model only: Idle, Working, Error

**Fix Required:**
- Change "6-state" to "3-state"
- Update state transitions to: Idle → Working → Idle (or Idle → Working → Error → Idle)
- Remove all acceptance criteria mentioning "Pending" state
- Remove FR54 reference (marked [REMOVED])
- Simplify the state machine description

**Acceptance criteria to remove/modify:**
- "CC reaches a point waiting for user input (FR54)" - REMOVE
- "session transitions to Pending state" - REMOVE
- "UI shows amber indicator" for Pending - REMOVE

---

### Issue 3: Story 3b.4 - First-Keystroke Spawn and Timeouts (CRITICAL)

**Current (Wrong):** Entire story describes removed functionality:

```
Story 3b.4: First-Keystroke Spawn and Timeouts

Given a session is in Idle state (FR55a)
When the user starts typing in the input
Then CC child process begins spawning immediately (first-keystroke spawn)
...

Given a session is in Pending state and unfocused (FR55b)
When the idle timeout elapses (default 3 minutes)
...
```

**Correct (Per PRD):** FR55a-55e are ALL marked [REMOVED]:
- FR55a: [REMOVED - On-send spawn instead]
- FR55b-55e: [REMOVED - No timeout needed]

**Fix Required:**
- **Rewrite or remove Story 3b.4 entirely**
- If keeping, rename to "On-Send Spawn" and simplify to:
  - Process spawns when user sends message (not on keystroke)
  - Process exits after response (no timeout management)
  - No Pending state to manage

---

### Issue 4: FR Coverage Map Includes Removed FRs (MEDIUM)

**Current (Wrong):** The "Detailed FR to Epic Mapping" section lists:
- FR28a: Epic 2a - Disconnect button
- FR28b: Epic 2a - Warning on Working disconnect
- FR54: Epic 3b - Stop on wait for input
- FR55a-55e: Epic 3b - Various timeout/spawn features

**Correct:** These FRs are [REMOVED] and should not be mapped.

**Fix Required:**
- Remove FR28a, FR28b from mapping
- Remove FR54, FR55a, FR55b, FR55c, FR55d, FR55e from mapping
- Update Epic 2a FR count (currently claims 14 FRs)
- Update Epic 3b FR count (currently claims 17 FRs)

---

### Issue 5: Requirements Inventory Lists Removed FRs (MEDIUM)

**Current (Wrong):** The "Requirements Inventory" section at the top lists:
- FR28a, FR28b with [REMOVED] notes
- FR54, FR55a-55e with [REMOVED] notes

**Fix Required:**
- Either remove these entries entirely, OR
- Keep them clearly marked as [REMOVED] for traceability but exclude from story coverage

---

### Issue 6: Epic Summary FR Counts (MINOR)

**Current:**
- Epic 2a: 14 FRs (includes FR28a, FR28b)
- Epic 3b: 17 FRs (includes FR54, FR55a-55e)

**Fix Required:**
- Epic 2a: Should be 12 FRs (remove 2)
- Epic 3b: Should be 11 FRs (remove 6)
- Update total from 125 to 117

---

## Stories to Modify

| Story | Action |
|-------|--------|
| **2a.3** | Remove disconnect button acceptance criteria |
| **3b.3** | Rewrite for 3-state model, remove Pending references |
| **3b.4** | Major rewrite or removal - remove first-keystroke spawn and all timeout logic |

## Sections to Update

| Section | Action |
|---------|--------|
| Requirements Inventory | Mark removed FRs clearly or remove |
| FR Coverage Map | Remove FR28a, FR28b, FR54, FR55a-55e |
| Detailed FR to Epic Mapping | Remove mappings for removed FRs |
| Epic Summary table | Update FR counts |

## New Content Needed

Consider adding acceptance criteria for the **simplified request-response model**:

```
### Story 3b.4: Request-Response Process Model (REVISED)

As a **user**,
I want **each message to spawn a fresh process that exits after response**,
So that **system resources are used efficiently without idle processes**.

**Acceptance Criteria:**

Given the user sends a message
When the send action triggers
Then a new CC child process spawns
And the process runs to completion
And the process exits naturally after response
And no idle process remains running

Given a CC process completes
When the response is fully received
Then the session returns to Idle state
And no timeout management is needed
And the next message will spawn a fresh process
```

## Validation

After fixes, verify:
1. No acceptance criteria reference "disconnect button"
2. No acceptance criteria reference "Pending" state
3. No acceptance criteria reference "first-keystroke spawn"
4. No acceptance criteria reference "timeout" configuration
5. State machine descriptions use 3-state model
6. FR counts are accurate (excluding removed FRs)
7. FR mappings exclude removed FRs
