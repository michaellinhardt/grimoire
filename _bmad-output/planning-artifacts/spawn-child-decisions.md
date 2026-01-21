# Grimoire: Spawn Child - Architecture Decisions

**Date:** 2026-01-20
**Status:** Brainstorming Phase - Decisions Captured
**Next Step:** Multi-window/tab behavior (use same approach study method)

---

## Overview

Grimoire is an application that wraps Claude Code CLI to provide a multi-session chat interface. Key concepts:

- **Session:** A conversation within Claude Code (persisted in `.claude` folder)
- **Instance:** A running Claude Code stream/child process (ephemeral)

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

### 3.1 Tiered Timeout (Pattern 6)

| State | Default Timeout | Behavior |
|-------|-----------------|----------|
| Working | None | No timeout while processing |
| Pending + Focused | 10 min | User viewing this session |
| Pending + Unfocused | 3 min | User in different session |
| Never close | ∞ | Optional setting |

**Timer behavior:** Switching tabs RESETS the counter (doesn't accumulate). Switch away = restart at 3 min. Switch back = restart at 10 min.

**Settings:** Both timeouts configurable, plus "never close" option.

### 3.2 State Machine (Standard - 6 states)

```
Idle → Spawning → Working → Pending → Terminating
                     ↓
                   Error
```

**Why:** Maps directly to UI indicators (blinking dots = Working, red dot = Pending, warning = Error). Clean, not over-engineered.

### 3.3 Error Handling (Categorized)

| Error Type | Handling |
|------------|----------|
| Network/transient | Auto-retry 2x, then surface |
| Spawn failure | Show immediately, offer retry button |
| Claude error | Show in chat, instance stays alive |
| Crash/fatal | Terminate, show error, offer restart |

**Why:** Different errors need different handling. Network blips shouldn't require user action.

### 3.4 Concurrency (Unlimited + User-Managed)

**Decision:** No artificial limits. User manages via UI.

- Connected icon (🔌) shown for sessions with running instance
- Click to disconnect (kills instance)
- Warning shown if disconnecting while Working (not Pending)

**Why:** Let users manage their own resources rather than imposing arbitrary limits.

### 3.5 Spawn Strategy (First Keystroke)

**Decision:** Spawn instance when user starts typing

```
User clicks session → (no spawn yet)
User starts typing → SPAWN INSTANCE
User still typing → (instance warming up)
User hits Send → Instance ready (or nearly ready)
```

**Why:** Clear intent signal, typing time masks cold start latency. Can't pre-spawn because Claude Code streams are session-bound (1:1).

---

## 4. UI/UX Indicators

### 4.1 Session State Indicators

**Decision:** Color bar + Icon + Animation (triple redundancy for accessibility)

| State | Visual |
|-------|--------|
| Idle (no instance) | No decoration |
| Connected + Pending | ⚡ icon |
| Connected + Working | ⚡ + animated `···` |
| Error | ⚠️ icon |

Left color accent bar for quick scanning + icons for explicit state.

### 4.2 Working Indicator

**Decision:** `···` dots in session list + streaming preview in chat panel

- Slow blink (1-2s cycle) in session list (ambient awareness)
- Streaming text in chat panel (active awareness when focused)

### 4.3 Completion Notification

**Decision:** Flash highlight → Red dot badge + optional sound

- Brief highlight/flash on completion
- Settles to red dot badge
- Red dot clears when session focused (or 2s if already focused)
- Optional completion sound (off by default, enable in settings)

### 4.4 Error Indication

**Decision:** Colored ⚠️ with tooltip

- ⚠️ yellow for transient/retrying (auto-clears if retry succeeds)
- ⚠️ red for fatal errors (persists until dismissed)
- Hover/click shows error detail tooltip
- Error also shown in chat panel when focused

### 4.5 Connection Status Icon

**Decision:** 🔌 icon on right side of session row

- Only visible if instance exists
- Click to disconnect
- Warning if disconnecting while Working

### 4.6 Typing/Spawning Feedback

**Decision:** Optimistic queue + subtle indicator

- User can always type and send (never blocked)
- If instance not ready: message queued, subtle "connecting..." shown
- Auto-sends when ready
- If spawn fails: show error, message preserved in input

---

## 5. Stream Communication

### 5.1 Message Protocol

**Decision:** NDJSON stream-json via Claude Code CLI with isolated config

```bash
CLAUDE_CONFIG_DIR=/path/to/grimoire/.claude \
claude --session-id <uuid> \
       --output-format stream-json \
       --include-partial-messages \
       -p "user message"
```

**Event types from stream:**
| Event | Purpose |
|-------|---------|
| `init` | Session metadata |
| `message` | Assistant/user messages with content blocks |
| `tool_use` | Tool invocations (name, params) |
| `tool_result` | Tool execution output |
| `result` | Final completion status |

**Known issue:** Final `result` event may not emit (GitHub #1920). Mitigation: timeout-based completion detection or detect via `stop_reason` in message event.

### 5.2 Streaming Display

**Decision:** Buffered append (50-100ms batches) + progressive markdown rendering

- Buffer chunks for smoother rendering
- Parse markdown incrementally
- Fall back to raw text for incomplete structures

### 5.3 Input Handling

**Decision:** Optimistic echo + queue

- Instant local echo when user sends
- Queue if instance not ready
- If send fails: show error inline, preserve message for retry

### 5.4 Response Tracking

**Decision:** Response object with full state

```typescript
interface Response {
  id: string
  status: 'sending' | 'streaming' | 'complete' | 'error'
  chunks: string[]
  fullText: string
  error?: Error
  startedAt: Date
  completedAt?: Date
}
```

**Why:** Tracks everything needed for UI and debugging, easy to serialize for history, supports analytics.

### 5.5 History Management

**Decision:** Hybrid - Claude reads + DB metadata

- `.claude` files = message content (authoritative)
- DB = metadata, search index, analytics

**Why:** Aligns with hybrid pattern. Claude Code owns content, Grimoire adds value layer.

### 5.6 Error Recovery in Stream

**Decision:** Checkpoint + Partial preserve

- Periodically checkpoint long responses to DB
- On failure: save partial response, show "Received X% before error"
- Offer retry (regenerate full) or accept partial

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
       --output-format stream-json \
       --include-partial-messages \
       -p "user message"
```

**In Node.js/Electron:**
```typescript
const child = spawn('claude', [
  '--session-id', sessionId,
  '--output-format', 'stream-json',
  '--include-partial-messages',
  '-p', message
], {
  env: {
    ...process.env,
    CLAUDE_CONFIG_DIR: path.join(app.getPath('userData'), '.claude')
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
| Sessions storage | ✅ Yes |
| Credentials/API keys | ✅ Yes |
| Skills/agents | ✅ Yes |
| CLAUDE.md files | ✅ Yes |
| MCP config | ✅ Yes |
| `/ide` command | ❌ Broken (ignores it) |
| Some install detection | ❌ May still create local `.claude/` |

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
| Close tab while Pending/Idle | Tab closes, instance terminates |
| Close tab while Working | Confirmation dialog |
| Close app | All instances terminate (graceful shutdown) |

### 8.3 Close While Working - Confirmation Dialog

When user closes a tab with a Working instance:

```
"Response in progress. Close anyway?"
[Cancel] [Close & Stop]
```

- **Confirm (Close & Stop):** Kill instance immediately, close tab
- **Cancel:** Keep tab open, instance continues

**Why:** Simple and explicit. No background processing complexity. User makes clear choice.

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
| 3 | Instance Lifecycle | ✅ |
| 4 | UI/UX Indicators | ✅ |
| 5 | Stream Communication | ✅ |
| 6 | Settings Architecture | ✅ |
| 7 | Isolation | ✅ |
| 8 | Tab Behavior | ✅ |
| 9 | Data Export/Backup | ✅ |

**Next Phase:** Architecture document creation
