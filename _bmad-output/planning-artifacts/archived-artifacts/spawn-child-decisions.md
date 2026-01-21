# Grimoire: Spawn Child - Architecture Decisions

**Date:** 2026-01-20
**Updated:** 2026-01-22 (CC Integration Mode Change)
**Status:** Decisions Captured - Updated for Request-Response Pattern

---

## Overview

Grimoire is an application that wraps Claude Code CLI to provide a multi-session chat interface. Key concepts:

- **Session:** A conversation within Claude Code (persisted in `.claude` folder)
- **Instance:** A running Claude Code child process for a single request (ephemeral, exits after response)

---

## 1. Session ID Management

**Decision:** Hybrid approach - folder is truth, DB adds metadata

| Responsibility | Source of Truth | Purpose |
|----------------|-----------------|---------|
| Session existence | `.claude` folder | Claude Code is authoritative |
| App metadata/stats | Database | Links app data to sessions |

**Why:** Claude Code creates sessions, not us. We only record in DB after Claude confirms session creation (first response/error). This prevents phantom sessions.

**DB entry created:** Only after Claude Code's first response or error confirms the session exists.

---

## 2. App Startup Pattern

**Decision:** DB-First with Background Validation (Pattern 3)

| Step | Action |
|------|--------|
| 1 | Query DB → Show session list immediately (fast startup) |
| 2 | Background: Scan `.claude` folder |
| 3 | Compare → Flag discrepancies |
| 4 | Notify user of "discovered" sessions if any |

**Why:** Respects that `.claude` is truth while keeping startup fast and UI clean. User can optionally sync discovered sessions.

---

## 3. Instance Lifecycle

### 3.1 Process Lifecycle (Request-Response Pattern)

**Decision:** Each user message spawns a new process that exits after response.

| Event | Behavior |
|-------|----------|
| User sends message | Spawn `claude` process with `-p` flag |
| Process running | State = Working, "Thinking..." indicator shown |
| Process exits (code 0) | Read session file, display response, State = Idle |
| Process exits (non-zero) | State = Error, show error in chat |

**Why:** The `-p` flag provides complete functionality without streaming complexity. Process exit is a clear completion signal. No timeout management needed.

### 3.2 State Machine (3 states)

```
Idle → Working → Idle (success)
         ↓
       Error
```

| State | Description |
|-------|-------------|
| Idle | No process running, ready for input |
| Working | Process running, "Thinking..." indicator shown |
| Error | Process failed, error message displayed |

**Why:** Simplified from 6-state machine. Request-response pattern eliminates Spawning, Pending, and Terminating states.

### 3.3 Error Handling (Simplified)

| Error Type | Handling |
|------------|----------|
| Spawn failure (ENOENT) | Show immediately - CC not installed |
| Non-zero exit code | Show error in chat, session returns to Idle |
| Process timeout (optional) | Configurable max runtime, default none |

**Why:** With request-response pattern, error handling is simpler. No stream state to manage.

### 3.4 Concurrency (Unlimited + Simple)

**Decision:** No artificial limits. Each session can have at most one active process.

- Multiple sessions can have concurrent processes
- No disconnect button needed (processes exit naturally)
- User can abort via abort button if needed

**Why:** Let users manage their own resources. Processes exit naturally after each response.

### 3.5 Spawn Strategy (On-Send)

**Decision:** Spawn process when user clicks Send

```
User clicks session → (no spawn)
User types message → (no spawn)
User clicks Send → SPAWN PROCESS
Process runs → "Thinking..." indicator
Process exits → Display response
```

**Why:** No warmup penalty with `-p` flag. Clear, predictable behavior.

---

## 4. UI/UX Indicators

### 4.1 Session State Indicators

**Decision:** Color bar + Icon + Animation (triple redundancy for accessibility)

| State | Visual |
|-------|--------|
| Idle | No decoration |
| Working | ⚡ + animated `···` + green color bar |
| Error | ⚠️ icon + red color bar |

Left color accent bar for quick scanning + icons for explicit state.

### 4.2 Working Indicator

**Decision:** `···` dots in session list + "Thinking..." in chat panel

- Slow blink (1-2s cycle) in session list (ambient awareness)
- "Thinking..." indicator in chat panel (active awareness when focused)

### 4.3 Completion Notification

**Decision:** Flash highlight → Red dot badge + optional sound

- Brief highlight/flash on completion
- Settles to red dot badge
- Red dot clears when session focused (or 2s if already focused)
- Optional completion sound (off by default, enable in settings)

### 4.4 Error Indication

**Decision:** Colored ⚠️ with tooltip

- ⚠️ red for errors (persists until dismissed or new message sent)
- Hover/click shows error detail tooltip
- Error also shown in chat panel when focused
- Sending new message clears error and starts fresh

### 4.5 [REMOVED] Connection Status Icon

**Previous Decision:** 🔌 disconnect button on session row.

**Removed:** With request-response pattern, processes exit naturally after each response. No persistent instances to disconnect. User can abort a running process via abort button in chat input area.

### 4.6 Send Feedback

**Decision:** Immediate feedback + "Thinking..." indicator

- Send button triggers process spawn immediately
- "Thinking..." indicator appears in chat
- If spawn fails: show error inline, message preserved in input
- User can abort via abort button (replaces send button while Working)

---

## 5. CC Communication

### 5.1 Message Protocol

**Decision:** Request-response via Claude Code CLI with `-p` flag

```bash
CLAUDE_CONFIG_DIR=/path/to/grimoire/.claude \
claude --session-id <uuid> \
       -p "user message"
```

**Why:** The `-p` flag runs Claude Code in prompt mode - it processes the message and exits. No streaming, no partial messages, no NDJSON parsing needed.

### 5.2 Response Retrieval

**Decision:** Read session JSONL file after process exit

```typescript
async function getResponseAfterProcess(sessionId: string): Promise<ConversationEvent[]> {
  const sessionPath = getSessionPath(sessionId)
  const lines = await readJsonlFile(sessionPath)
  const events = lines.map(parseConversationEvent)

  // Return only new events since last read
  const lastKnownUuid = getLastKnownEventUuid(sessionId)
  return events.slice(events.findIndex(e => e.uuid === lastKnownUuid) + 1)
}
```

**Why:** CC writes complete responses to session file. Process exit (code 0) signals completion. Simple and reliable.

### 5.3 Input Handling

**Decision:** Direct send

- User clicks Send → spawn process immediately
- No queuing needed (process spawns on demand)
- If send fails: show error inline, preserve message for retry

### 5.4 Response Tracking

**Decision:** Response object with simplified state

```typescript
interface ResponseState {
  sessionId: string
  status: 'idle' | 'sending' | 'complete' | 'error'
  lastEventUuid: string | null
  error?: string
  startedAt?: Date
  completedAt?: Date
}
```

**Why:** Tracks what's needed for UI. No streaming state to manage.

### 5.5 History Management

**Decision:** Hybrid - Claude reads + DB metadata

- `.claude` files = message content (authoritative)
- DB = metadata, search index, analytics

**Why:** Aligns with hybrid pattern. Claude Code owns content, Grimoire adds value layer.

### 5.6 [REMOVED] Stream Error Recovery

**Previous Decision:** Checkpoint + partial preserve for streaming errors.

**Removed:** With request-response pattern, there's no partial response to recover. Either the process completes (read full response from file) or it fails (show error). Simple and clean.

---

## 6. Settings Architecture

### 6.1 Storage

**Decision:** Database (not files)

- Global + per-project settings stored in DB
- No scattered config files in projects
- Clean, discrete, queryable

**Why:** User doesn't want folders/files in every project.

### 6.2 Claude Code Integration

**Decision:** Grimoire manages `.claude` folder

- Grimoire controls the `.claude` folder (isolated)
- MVP: Configure once for all projects
- No separate editor UI for Claude Code settings in MVP, iterate later

### 6.3 UI Pattern

**Decision:** Already defined - Obsidian-style

- One settings page, different categories
- Each plugin has its own category (e.g., "Session")
- Already documented elsewhere

### 6.4 Defaults

**Decision:** Schema-driven

- Schema defines defaults, validation, UI hints
- Settings file contains only user overrides
- Easy to add new settings, auto-migration

### 6.5 Change Application

**Decision:** Immediate + Undo

- Changes apply immediately (no save button)
- "Reset to default" per setting
- "Reset all" for full reset
- Flag any that truly need restart

### 6.6 Removed Settings (CC Integration Mode Change)

The following settings were removed with the switch to request-response pattern:

| Setting | Previous Purpose | Why Removed |
|---------|------------------|-------------|
| Unfocused timeout | Kill idle instances after 3 min | Processes exit after each response |
| Focused timeout | Kill idle instances after 10 min | Processes exit after each response |
| Never close option | Keep instances alive indefinitely | No persistent instances |

---

## 7. Isolation (MVP)

**Decision:** Use `CLAUDE_CONFIG_DIR` environment variable per-process

**Why chosen over alternatives:**
- Docker: Too much friction for users (requires install, 500MB+)
- HOME override: Breaks developer toolchain (git, ssh, npm, etc.)
- Symlink swap: Risky if user runs standalone Claude Code, messy with heavy `.claude` folders
- `CLAUDE_CONFIG_DIR`: Clean, per-process, no filesystem manipulation

### Implementation

**When spawning Claude Code instance:**
```bash
CLAUDE_CONFIG_DIR=~/Library/Application\ Support/Grimoire/.claude \
claude --session-id <uuid> \
       -p "user message"
```

**In Node.js/Electron:**
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

// Handle process completion
child.on('exit', async (code) => {
  if (code === 0) {
    const newEvents = await getResponseAfterProcess(sessionId);
    emitResponseReady(sessionId, newEvents);
  } else {
    emitError(sessionId, `Process exited with code ${code}`);
  }
});
```

### Grimoire Data Location

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Grimoire/.claude/` |
| Windows | `%APPDATA%/Grimoire/.claude/` |
| Linux | `~/.local/share/grimoire/.claude/` |

### CLAUDE_CONFIG_DIR Behavior

| Component | Uses CLAUDE_CONFIG_DIR? |
|-----------|------------------------|
| Sessions storage | Yes |
| Credentials/API keys | Yes |
| Skills/agents | Yes |
| CLAUDE.md files | Yes |
| MCP config | Yes |
| `/ide` command | Broken (ignores it) |
| Some install detection | May still create local `.claude/` |

**Why this is acceptable for Grimoire:**
- Grimoire doesn't use `/ide` command
- Install detection edge case is minor and doesn't affect core functionality
- All session/config features work correctly

### Known Limitations

| Issue | Impact | Mitigation |
|-------|--------|------------|
| `/ide` command broken | None - Grimoire doesn't use it | N/A |
| May create local `.claude/` on some operations | Minor - doesn't affect sessions | Ignore or clean up periodically |
| GitHub issues #3833, #4739 | Edge cases | Monitor issues, update if fixed |

### Benefits Over Symlink Swap

1. **No filesystem manipulation** - User's `~/.claude` is never touched
2. **Per-process isolation** - Each spawn is isolated independently
3. **Crash-safe** - No state to repair on crash
4. **Concurrent safe** - User can run standalone Claude Code simultaneously
5. **No startup/shutdown overhead** - Just an env variable

### First Run Setup

On first Grimoire launch:
1. Create Grimoire's `.claude` directory in app data folder
2. Initialize with default CLAUDE.md if desired
3. No user warning needed - completely transparent

---

## 8. Tab Behavior

### 8.1 Architecture

**Decision:** Single-window app with tabbed interface

- Grimoire = one application window with tabs inside
- One session = one tab maximum
- Multiple Grimoire instances = not supported/handled

### 8.2 Tab Management

| Scenario | Behavior |
|----------|----------|
| Click session in list | Open tab (or focus if already open) |
| Click same session again | Focus existing tab |
| Close tab while Idle | Tab closes immediately |
| Close tab while Working | Confirmation dialog, kill process if confirmed |
| Close app | All active processes terminate (graceful shutdown) |

### 8.3 Close While Working - Confirmation Dialog

When user closes a tab with a Working process:

```
"Response in progress. Close anyway?"
[Cancel] [Close & Stop]
```

- **Confirm (Close & Stop):** Kill process immediately, close tab
- **Cancel:** Keep tab open, process continues

**Why:** Simple and explicit. User makes clear choice.

---

## 9. Data Export/Backup

**Decision:** Not in MVP

- No export/import feature in initial release
- Users can manually backup app data folder if needed:
  - macOS: `~/Library/Application Support/Grimoire/`
  - Windows: `%APPDATA%/Grimoire/`
  - Linux: `~/.local/share/grimoire/`

**Why:** Sessions already on disk in `.claude` folder. Settings can be recreated. Add export feature later based on user demand.

---

## Status

**Completed:** All core architecture decisions for Spawn Child feature

| Section | Topic | Status |
|---------|-------|--------|
| 1 | Session ID Management | ✅ |
| 2 | App Startup Pattern | ✅ |
| 3 | Instance Lifecycle | ✅ Updated for request-response |
| 4 | UI/UX Indicators | ✅ Updated for 3-state |
| 5 | CC Communication | ✅ Updated for request-response |
| 6 | Settings Architecture | ✅ Documented removed settings |
| 7 | Isolation | ✅ Updated spawn code |
| 8 | Tab Behavior | ✅ Updated for new states |
| 9 | Data Export/Backup | ✅ |

**Architecture Change:** 2026-01-22 - Changed from NDJSON streaming to `-p` request-response pattern. See `sprint-change-proposal-cc-integration.md` for details.
