# Sprint Change Proposal - Stream JSON Integration & Rewind Feature

**Date:** 2026-01-22
**Author:** Correct Course Workflow
**Status:** Pending Approval
**Scope:** Minor (Direct Implementation)

---

## 1. Issue Summary

### Problem Statement

Pre-implementation research and prototyping (documented in `decision-claude-spawn.md`) validated a superior approach for Claude Code integration. The original architecture planned to read session files after process exit, but streaming JSON provides real-time data that eliminates this need and enables new capabilities.

### Context

- **Discovery:** During CC integration research phase
- **Evidence:** Working prototype at `/prototype/` with validated tests
- **Impact:** Improves UX (real-time display), enables rewind feature, simplifies data flow

### Trigger

Research completion revealing that `-p --output-format stream-json` provides:

- Immediate session ID
- Real-time message content
- User message UUIDs (checkpoint capability)
- Cost/token metadata
- Tool call details as they execute

---

## 2. Impact Analysis

### Epic Impact

| Epic        | Impact | Details                                                               |
| ----------- | ------ | --------------------------------------------------------------------- |
| **Epic 3b** | Modify | Stream parsing replaces post-exit file reading                        |
| **Epic 2a** | Add    | New DB fields for session forking (forked_from_session_id, is_hidden) |
| **Epic 2b** | Add    | Rewind UI on user message hover                                       |
| **Epic 2c** | Modify | Info panel displays cost metadata from DB                             |

### Artifact Conflicts

#### PRD Changes

| Change Type | Details                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| Modify FR50 | "responses displayed after process completion" → "responses streamed in real-time"                  |
| Modify FR64 | "reads session file after process exit" → "parses NDJSON stream; file reading only at startup sync" |
| Add FR      | Session forking: track lineage via forked_from_session_id                                           |
| Add FR      | Hidden sessions: is_hidden flag for forked-from sessions                                            |
| Add FR      | Rewind UI: hover action on user messages                                                            |
| Add FR      | Sub-agent read-only: hide input on sub-agent tabs                                                   |

#### Architecture Changes

**Spawn Pattern (Replace):**

```
OLD: spawn → process runs → exit → read file → display
NEW: spawn → stream JSON → parse real-time → display → exit
```

**CLI Arguments:**

```bash
claude -p \
  --input-format stream-json \
  --output-format stream-json \
  --verbose \
  --replay-user-messages \
  --dangerously-skip-permissions \
  --resume <session-id>
```

**Database Schema Additions:**

```sql
-- Add to sessions table
ALTER TABLE sessions ADD COLUMN forked_from_session_id TEXT;
ALTER TABLE sessions ADD COLUMN is_hidden INTEGER DEFAULT 0;

-- New table for cost/token tracking
CREATE TABLE session_metadata (
  session_id TEXT PRIMARY KEY,
  total_input_tokens INTEGER,
  total_output_tokens INTEGER,
  total_cost_usd REAL,
  model TEXT,
  updated_at INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

**New IPC Channels:**

```typescript
'sessions:rewind' // Rewind to checkpoint UUID, fork session
'sessions:getMetadata' // Get cost/token data for info panel
```

#### UX Changes

**User Message Bubble - Add Rewind Icon:**

```
┌─────────────────────────────────┐
│ Message content here...     [↺] │  ← Appears on hover
└─────────────────────────────────┘
```

**Rewind Modal (New Component):**

```
┌─────────────────────────────────────────┐
│         Rewind Conversation             │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │ Enter new message...            │    │
│  └─────────────────────────────────┘    │
│              [Cancel]  [Send]           │
└─────────────────────────────────────────┘
- Darkened overlay background
- Click outside or Escape closes
```

**Sub-Agent Tabs:**

- Hide chat input completely when `tab.type === 'subagent'`
- Rationale: Cleaner UI, reinforces read-only nature

### Technical Impact

| Area                     | Change                                          |
| ------------------------ | ----------------------------------------------- |
| `stream-parser.ts`       | New file: parse NDJSON from stdout in real-time |
| `instance-manager.ts`    | Update spawn args, handle stdin JSON input      |
| `session-file-reader.ts` | Reduce scope to startup sync only               |
| `conversation-loader.ts` | Can use stream data directly during session     |
| Database                 | New columns and table as specified above        |

---

## 3. Recommended Approach

### Selected Path: Direct Adjustment

Modify and add stories within existing epic structure.

### Rationale

1. **Validated approach** - Working prototype confirms feasibility
2. **No existing implementation** - Pre-implementation change is cleanest
3. **Fits epic structure** - Changes map to existing epics
4. **Better UX** - Real-time > post-exit display
5. **New capability** - Rewind feature adds significant user value

### Alternatives Considered

| Alternative                 | Why Not Selected                                                 |
| --------------------------- | ---------------------------------------------------------------- |
| Keep file-reading approach  | Inferior UX, misses rewind capability                            |
| Defer rewind to post-MVP    | Rewind is natural extension of stream data, minimal extra effort |
| Add rewind as separate epic | Too small, fits naturally in Epic 2b                             |

### Effort & Risk Assessment

| Dimension             | Rating  | Notes                                            |
| --------------------- | ------- | ------------------------------------------------ |
| Implementation Effort | Low     | Stream parsing well-understood, prototype exists |
| Timeline Impact       | Minimal | No scope increase, just implementation change    |
| Technical Risk        | Low     | CLI flags are stable, SDK is documented          |
| UX Complexity         | Low     | Modal pattern is standard, icon is unobtrusive   |

---

## 4. Detailed Change Proposals

### Story Changes - Epic 3b

#### Story 3b.2: NDJSON Stream Parser

**OLD Title:** NDJSON Stream Parser
**OLD Description:** Parse NDJSON from stdout during streaming

**NEW Description:** Parse NDJSON from stdout in real-time using stream-json format. Capture session_id, message UUIDs (for checkpoints), tool calls, and cost metadata as they arrive.

**NEW Acceptance Criteria (additions):**

- System sends message via stdin JSON (not CLI arg)
- System captures session_id from first `system.init` message
- System captures UUID from each user message (checkpoint capability)
- System stores cost metadata to session_metadata table
- System updates conversation view in real-time as content arrives

---

#### Story 3b.1: CC Child Process Spawning

**Modify spawn arguments:**

**OLD:**

```typescript
const args = ['--session-id', sessionId, '-p', message]
```

**NEW:**

```typescript
const args = [
  '-p',
  '--input-format',
  'stream-json',
  '--output-format',
  'stream-json',
  '--verbose',
  '--replay-user-messages',
  '--dangerously-skip-permissions'
]
if (sessionId) args.push('--resume', sessionId)
// Message sent via stdin, not CLI arg
```

---

### Story Additions - Epic 2a

#### NEW Story: Session Forking Database Support

**As a** system,
**I want** to track session lineage and hidden status,
**So that** rewind operations preserve history while keeping the UI clean.

**Acceptance Criteria:**

- Database has `forked_from_session_id` column in sessions table
- Database has `is_hidden` column in sessions table (default 0)
- When session is forked, new session records parent ID
- When session is forked, parent session is marked as hidden
- Session list query excludes hidden sessions by default
- Hidden sessions accessible via "Show all sessions" toggle (optional, can defer)

---

#### NEW Story: Session Metadata Storage

**As a** user,
**I want** to see token usage and cost in the Info panel,
**So that** I can track my Claude Code usage.

**Acceptance Criteria:**

- Database has session_metadata table with cost/token fields
- System updates metadata after each response from stream
- Info panel displays: total input tokens, output tokens, estimated cost
- Metadata persists across app restarts

---

### Story Additions - Epic 2b

#### NEW Story: Rewind UI on User Messages

**As a** user,
**I want** to rewind a conversation from any of my messages,
**So that** I can explore different paths without losing history.

**Acceptance Criteria:**

- Hovering over user message reveals [↺] rewind icon (top-right)
- Clicking [↺] opens modal with text input
- Modal has darkened overlay background
- Clicking outside modal or pressing Escape closes it
- Clicking Cancel closes modal
- Clicking Send triggers rewind operation:
  1. Fork session at message's parent checkpoint
  2. Mark original session as hidden
  3. Store forked_from_session_id in new session
  4. Send new message to forked session
  5. Display forked session (replaces current view)
- First user message does NOT show rewind icon (no prior checkpoint)

---

#### NEW Story: Sub-Agent Tab Read-Only

**As a** user viewing a sub-agent conversation,
**I want** a read-only view without input box,
**So that** I understand this is a historical view, not interactive.

**Acceptance Criteria:**

- When `tab.type === 'subagent'`, chat input area is hidden
- Conversation view expands to fill available space
- No "disabled input" message needed (cleaner)

---

### Story Modifications - Epic 2c

#### Story 2c.2: Session Info View

**Add to Acceptance Criteria:**

- Info panel displays cost/token data from session_metadata table
- Format: "Tokens: 12.5k in / 8.2k out"
- Format: "Est. Cost: $0.42"
- Data updates in real-time during streaming

---

## 5. Implementation Handoff

### Scope Classification

**Minor** - Direct implementation by development team

### Implementation Sequence

1. **Database schema changes** - Add columns and table
2. **Stream parser implementation** - Core functionality
3. **Instance manager updates** - New spawn pattern
4. **Metadata capture** - Store costs during streaming
5. **Rewind UI** - Modal component and interaction
6. **Sub-agent input hiding** - Conditional render
7. **Info panel updates** - Display metadata

### Success Criteria

- [ ] Stream JSON parsing works in real-time
- [ ] Session ID captured from stream (not file)
- [ ] Rewind creates forked session correctly
- [ ] Parent session hidden after fork
- [ ] Cost/token data displays in Info panel
- [ ] Sub-agent tabs have no input box
- [ ] All existing tests pass
- [ ] New functionality has test coverage

### Handoff Recipients

| Role      | Responsibility                       |
| --------- | ------------------------------------ |
| Dev Team  | Implement all changes                |
| QA (self) | Validate against acceptance criteria |

---

## 6. Approval

**Recommendation:** Approve and proceed with implementation

**Changes are:**

- Well-researched with working prototype
- Low risk and effort
- Improve user experience
- Enable valuable new capability
- Fit within existing project structure

---

**Document Status:** Ready for Review

**Next Steps on Approval:**

1. Update PRD with new/modified FRs
2. Update Architecture document
3. Update UX specification
4. Add stories to sprint backlog
5. Begin implementation
