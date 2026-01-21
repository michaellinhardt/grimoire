# UX Design Specification Alignment Fix

## Context

A comprehensive gap analysis was performed across all planning artifacts (PRD, Architecture, Epics, UX Spec). The PRD was updated to simplify the process lifecycle model, but these changes were **not propagated** to the UX Design Specification.

## Source of Truth

The **PRD** (`_bmad-output/planning-artifacts/prd.md`) is the source of truth. The UX Spec must be updated to align with it.

## Issues to Fix

### Issue 1: Session List Item - Disconnect Button (CRITICAL)

**Current (Wrong):** Session List Item component anatomy shows disconnect button:

```
┌────────────────────────────────┐
│ [⚡] Session Name        [🔌][⋮]│
│     2 hours ago                │
└────────────────────────────────┘
```

And the "Session List Item with Folder Path" section shows:
```
┌────────────────────────────────┐
│ [📌][⚡] Session Name    [🔌][⋮]│
│        /path/to/folder         │
│        2 hours ago             │
└────────────────────────────────┘
```

**Correct (Per PRD):** FR28a and FR28b are marked [REMOVED] - "No persistent instances to disconnect with request-response model"

**Fix Required:**
- Remove `[🔌]` from all Session List Item anatomy diagrams
- Remove any text describing disconnect button functionality
- The simplified anatomy should be:

```
┌────────────────────────────────┐
│ [⚡] Session Name           [⋮] │
│     2 hours ago                │
└────────────────────────────────┘
```

And with folder path:
```
┌────────────────────────────────┐
│ [📌][⚡] Session Name       [⋮] │
│        /path/to/folder         │
│        2 hours ago             │
└────────────────────────────────┘
```

---

### Issue 2: AR15 Reference - 6-State Machine (MEDIUM)

**Current (Wrong):** In the "Additional Requirements" section under "From Architecture - Spawn Child System":

```
AR15: 6-state instance machine: Idle → Spawning → Working → Pending → Terminating (+ Error)
AR16: Tiered timeout: Working=∞, Pending+Focused=10min, Pending+Unfocused=3min
AR17: First-keystroke spawn strategy (typing masks cold start)
AR18: Error categorization...
```

**Correct (Per PRD):**
- 3-state model only: Idle, Working, Error
- No timeouts (processes exit after response)
- On-send spawn (not first-keystroke)

**Fix Required:**
- Update AR15 to: "3-state instance machine: Idle, Working, Error"
- Remove AR16 entirely (no timeouts)
- Update AR17 to: "On-send spawn strategy (process spawns when user sends message)"
- Or remove these AR references entirely since they should come from Architecture

---

### Issue 3: Status Indicator - Pending State Reference (MEDIUM)

**Current:** The Status Indicator section correctly shows 3-state:

```
| State | Visual | Icon | Animation | Usage |
|-------|--------|------|-----------|-------|
| Idle | No decoration | - | - | No process running |
| Working | Green bar | ⚡ | `···` dots | CC processing |
| Error | Red bar | ⚠️ | - | Failed operation |
```

**But elsewhere** in the document there are references to:
- "Pending state"
- "amber indicator" for Pending
- 6-state model

**Fix Required:**
- Search for and remove any references to "Pending" state
- Remove references to "amber indicator" (only green for Working, red for Error)
- Ensure 3-state model is consistent throughout

---

### Issue 4: Session States Table (MEDIUM)

**Current (Wrong):** In "UX Consistency Patterns" → "State Patterns" → "Session States":

The table may reference states beyond the 3-state model.

**Fix Required:**
- Ensure only Idle, Working, Error states are described
- Remove any Pending/Spawning/Terminating references

---

### Issue 5: Journey Flow - Pending State References (MINOR)

**Current (Wrong):** In "Journey 1: App Launch → First Message" flow:

```
U --> V[Stop Child Process]
V --> W[Session Paused State]
```

The term "Paused" might be confused with "Pending".

**Correct (Per PRD):** With request-response model, there is no "paused" state. Process exits after response, session returns to Idle.

**Fix Required:**
- Change "Session Paused State" to "Session Idle State" or "Session Ready State"
- Clarify that process exits after response (not "paused")

---

### Issue 6: Feedback Patterns - Pending References (MINOR)

**Current (Wrong):** In "Feedback Patterns" section, check for:
- References to Pending state
- References to amber indicator
- References to disconnect functionality

**Fix Required:**
- Remove any Pending state feedback descriptions
- Ensure only Idle (no indicator), Working (green), Error (red) are described

---

## Summary of Changes

| Section | Action |
|---------|--------|
| Session List Item anatomy | Remove `[🔌]` disconnect button |
| Session List Item with Folder Path | Remove `[🔌]` disconnect button |
| AR15-AR18 references | Update to 3-state, on-send spawn, remove timeouts |
| Status Indicator | Verify 3-state only (already correct, just verify) |
| Session States table | Remove Pending references |
| Journey flows | Change "Paused" to "Idle" |
| Feedback Patterns | Remove Pending/amber references |

## Search Terms to Find Issues

Search the document for these terms and evaluate each occurrence:

| Term | Action |
|------|--------|
| `🔌` | Remove (disconnect button) |
| `Pending` | Remove or replace with appropriate state |
| `Paused` | Replace with "Idle" if referring to state |
| `amber` | Remove (no amber indicator in 3-state) |
| `6-state` | Replace with "3-state" |
| `first-keystroke` | Replace with "on-send" |
| `timeout` | Remove (no timeouts in request-response model) |
| `AR15` | Update to 3-state model |
| `AR16` | Remove (timeouts) |
| `AR17` | Update to on-send spawn |

## Validation

After fixes, verify:
1. No `[🔌]` disconnect button in any component anatomy
2. No "Pending" state references
3. No "amber" indicator references
4. No "6-state" references
5. No "first-keystroke spawn" references
6. No timeout configuration references
7. Consistent 3-state model (Idle, Working, Error) throughout
8. Session List Item shows only: status icon, name, folder path, timestamp, pin icon, menu icon
