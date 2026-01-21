---
stepsCompleted: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11]
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-grimoire-2026-01-09.md'
  - '_bmad-output/analysis/brainstorming-session-2026-01-09.md'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 0
workflowType: 'prd'
lastStep: 11
---

# Product Requirements Document - Grimoire

**Author:** Teazyou
**Date:** 2026-01-15

## Executive Summary

Grimoire is an Electron-based interactive client for Claude Code workflows. This PRD covers **Phase 1: Observability Core** - establishing the foundational UI, session management, and plugin architecture that future workflow management features will build upon.

**The Core Problem:**
Claude Code's terminal-based interface creates friction. When workflows spawn multiple sub-agents, tracing their individual conversations and decisions is nearly impossible. Tool calls are buried in noise, token usage is invisible, and there's no unified place to manage, resume, or review sessions.

**Why This Matters:**
Today's pain is a preview. As workflow complexity grows - chained agents, shared memory, reusable templates - the need for clear session management becomes critical. This foundation ensures that when workflows become powerful, they remain understandable and controllable.

**This Phase Solves:**
A unified interface for all Claude Code sessions - create new, resume old, watch in real-time, review history. One place for every conversation, always interactive, never lost.

### What Makes This Special

**The moment it clicks:** You just ran a 45-minute workflow with 6 sub-agents. Something went wrong. In terminal, you're scrolling endlessly, losing context, frustrated. In Grimoire, you see the conversation tree laid out clearly. You click the failing agent and immediately understand what happened. Relief.

**Unified session experience:** Every session - past or present - lives in one place. Click any session, type a message, hit Enter. Grimoire wakes it up. No terminal switching, no session hunting, no lost context.

**Intelligent resource management:** Child processes spawn only when needed, stop when idle. Your machine isn't running unused Claude instances.

**Foundation-first approach:** Phase 1 builds the solid base (fast, bug-free, polished UI/UX) that workflow management features will layer onto. No over-engineering, no premature abstraction.

**Success gate:** If it's not faster than CLI for managing sessions, it fails.

## Project Classification

**Technical Type:** Desktop App (Electron)
**Domain:** General (developer productivity)
**Complexity:** Low (personal tool, local-first, no compliance requirements)
**Project Context:** Greenfield - Phase 1 of multi-phase product

### Architectural Principles

- **Plugin-ready architecture:** Core features will use the same extension patterns planned for future community plugins (inspired by Obsidian's approach)
- **Data model extensibility:** Design for workflow definitions, shared memory, and plugin state from the start
- **Event-based communication:** Loose coupling between components to support future plugin system
- **No over-building:** Establish patterns now, implement abstractions when needed

## Success Criteria

### User Success

**The Confidence Test:**
After reviewing a multi-agent session in Grimoire, the user feels confident they know exactly what happened. No uncertainty, no "I think it did X." Complete clarity.

**Success Indicators:**
| Indicator | Success State |
|-----------|---------------|
| Sub-agent visibility | Click an agent, immediately understand its full conversation |
| Session retrieval | Find any past session in under 10 seconds |
| Tool clarity | Distinguish tool calls from conversation at a glance |
| Navigation | Jump to any point in a 100+ message session instantly |
| Session resume | Type in any session, hit Enter, continue conversation seamlessly |

**The Escape Hatch Test:**
If any of these fail, the user falls back to CLI:
- Slow startup (> 3 seconds)
- Missing sessions
- Unreadable UI (can't tell tools from messages)
- Sub-agent drill-down broken or laggy
- Session resume fails or loses context

### Business Success

**Personal Utility Adoption** (personal tool metrics):

| Timeframe | Success Indicator |
|-----------|-------------------|
| 1 month | Opening Grimoire instead of terminal for all CC sessions |
| 3 months | Grimoire has revealed workflow insights that improved prompts/agents |
| 6 months | Removing Grimoire would feel like losing a critical tool |

**Core Test:** "Do I open Grimoire instead of defaulting to CLI?"

### Technical Success

**Performance Requirements:**
| Metric | Target |
|--------|--------|
| App startup | < 3 seconds |
| Session load (100+ messages) | < 1 second |
| Sub-agent expansion | Instant (< 100ms perceived) |
| Live updates | Real-time, no perceptible lag |
| Child spawn/resume | < 500ms |

**Reliability Requirements:**
- All CC sessions from `~/.claude/projects/` display correctly
- Zero data loss or corruption
- Works offline, no account required
- Human-readable errors (no stack traces)

**Child Process Management:**
- Child processes stop when CC waits for user input
- Child processes restart seamlessly when user sends message
- Active sessions show visual indicator in session list
- Session ID ↔ child process mapping always accurate

**Plugin Architecture Validation:**
- Core plugin (Sessions) runs on same architecture community plugins will use
- Plugins can be toggled on/off from settings
- Per-plugin settings functional
- Disabling plugins measurably improves startup time

### Measurable Outcomes

**Phase 1 Complete When:**
- [ ] Core infrastructure functional and stable
- [ ] Sessions plugin fully operational (history, create, interact, real-time)
- [ ] Plugin architecture validated with Sessions core plugin
- [ ] Child process lifecycle management working correctly
- [ ] Performance targets met consistently
- [ ] Used daily for 2 weeks without falling back to CLI

## Product Scope

### MVP - Phase 1: Observability Core

**Core Infrastructure:**
1. Core UI Shell (Obsidian-inspired ribbon + panels)
2. Loading Screen (CC verification, auth check)
3. Plugin Architecture (settings page, enable/disable, per-plugin config)

**Core Plugins:**
4. Sessions (unified session management: history, create new, interact, real-time view, child process lifecycle)

**Capabilities:**
5. Run CC from Grimoire (spawn with `CLAUDE_CONFIG_DIR` isolation, intelligent child lifecycle)

### Growth Features (Post-MVP)

- Internationalization System (EN, FR, then more languages)
- System notifications
- Global keyboard shortcuts
- Windows/Linux support
- Workflow library and management
- Workflow builder
- Community plugin support
- Sharing/export workflows
- Analytics dashboard

### Vision (Future)

- Reusable workflow templates
- Shared agent memory spaces
- Workflow chaining and connections
- Community plugin marketplace
- Team collaboration features

## User Journeys

### Journey 1: Session Reviewer - "What Did That Agent Actually Do?"

You just finished a 40-minute Claude Code session. A complex BMAD workflow that spawned 6 sub-agents to create a PRD. Something felt off - the output wasn't quite right, and you're not sure which agent went sideways.

In the terminal, you'd be scrolling through hundreds of lines, trying to piece together which agent said what. Tool calls mixed with conversation. Sub-agent spawns buried in noise. You'd give up after 5 minutes.

Instead, you open Grimoire. The session appears in the left panel - you click it. In under a second, the conversation tree loads. You see the main conversation with clear visual markers where sub-agents were spawned. One agent has a red indicator - it errored.

You click that agent's bubble. Its full conversation expands in the middle panel - every message, every tool call, clearly separated. You spot it immediately: the agent tried to read a file that didn't exist, hallucinated content, and continued as if nothing happened.

You now know exactly what to fix in your workflow. Total time: 90 seconds. Confidence: complete.

---

### Journey 2: Sessions - "Your Claude Code Home"

You have an idea. You open Grimoire. The Sessions panel shows your recent conversations - yesterday's PRD workflow, this morning's quick code fix, last week's research session. You click "New Session."

A clean conversation view opens. Chat input at the bottom. You paste your prompt and hit Enter.

Grimoire spawns a Claude Code child process, assigns a session ID. Claude's response streams in - clean message bubbles, tool calls as collapsible cards, sub-agents as expandable nested conversations. You watch it work without the terminal noise.

Claude asks a clarifying question and waits. The moment it waits for input, Grimoire stops the child process - no idle resources. The session shows a "paused" indicator in the sidebar.

You think for a minute. Type your answer. Hit Enter. Grimoire restarts the child, sends your input. Claude continues. When it finishes, the child stops again. Your session sits in the list, ready to resume anytime.

Three days later, you remember something. You click that session in the sidebar. Type a follow-up. Hit Enter. Grimoire wakes it up - same session ID, same context. The conversation continues as if no time passed.

One interface. All your Claude Code sessions. Always resumable. Never lost.

---

### Journey 3: Plugin Manager - "Your Grimoire, Your Way"

You've been using Grimoire for a week. You want to tweak a few things to match your workflow.

You open Settings and navigate to Core Plugins. The Sessions plugin is listed with a toggle (enabled) and a settings gear. You click the gear.

Inside, you find options that matter:
- "Default sub-agent view: Collapsed / Expanded" - you set it to Collapsed (less visual noise)
- "Tool calls: Show summary / Show full" - you keep it on Summary (expand on click)
- "Sessions list: Show last 20 / 50 / 100" - you bump it to 50

You close settings. Next session you open, sub-agents are collapsed by default, tool calls show summaries, and your sidebar shows more history. Small tweaks, big comfort.

The plugin system that will power community plugins someday is already powering your daily experience.

---

### Journey Requirements Summary

| Journey | Capabilities Required |
|---------|----------------------|
| Session Reviewer | Session list, conversation view, sub-agent expansion, tool call display, error indicators |
| Sessions | Chat input, child process spawn/stop, session ID management, real-time streaming, visual status indicators |
| Plugin Manager | Settings UI, plugin toggle, per-plugin config |

## Innovation & Novel Patterns

### Detected Innovation Areas

**Core Innovation: CLI-to-Visual Paradigm Shift**
Grimoire transforms Claude Code from a terminal-only tool into a visual, interactive client. This isn't a wrapper - it's a paradigm shift in how AI CLI tools can be accessed and controlled.

**Key Innovation Dimensions:**

| Dimension | Current State | Grimoire Innovation |
|-----------|--------------|---------------------|
| Access | CLI-only, expert users | Visual interface, accessible to non-experts |
| Session management | Terminal history, raw JSON | Unified list, click-to-resume |
| Multi-agent visibility | Opaque, buried in output | Clear tree, expandable conversations |
| Workflow control | Command line, flags, manual | Chat interface, intelligent process lifecycle |

### Future Innovation Potential

Phase 1 establishes the foundation. Future phases unlock:
- **Workflow creation** for non-experts (no code, no CLI)
- **Workflow sharing** (community templates)
- **Plugin ecosystem** (community extensions)

These capabilities will open Claude Code's power to an audience that would never touch a terminal.

### Validation Approach

**Phase 1 Success Criterion:**
> "I don't need to use the terminal anymore."

If Grimoire becomes the default way to interact with Claude Code - replacing terminal entirely for session creation, interaction, and review - the core innovation is validated.

**Future Validation:**
- Non-expert users can operate Grimoire without CLI knowledge
- Workflow builder enables creation without code
- Community adoption of plugin/workflow ecosystem

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Too slow vs CLI | Performance targets (< 3s startup, < 500ms spawn) |
| Missing CLI capabilities | Ensure all CC features accessible via chat interface |
| Complexity creep | Foundation-first approach, no over-building |
| Plugin architecture fragility | Core plugins validate architecture before community opens |

## Desktop App Specific Requirements

### Project-Type Overview

Grimoire is an Electron-based desktop application. Phase 1 focuses on Mac as the primary platform, with architecture that enables future Windows/Linux support without major refactoring.

### Platform Support

**Phase 1:**
- Primary: macOS (development and testing focus)
- Architecture: Electron (cross-platform ready)
- No platform-specific code that would block future expansion

**Post-Phase 1:**
- Windows support
- Linux support
- Platform-specific optimizations as needed

### Update Strategy

**Auto-Update Behavior:**
- Check for updates on app launch
- Prompt user when new version available
- User options: Update now / Skip this version / Remind me later
- No forced updates - user controls timing
- Update downloads in background, installs on next launch

### System Integration

**Phase 1:**
- CC child process spawning and lifecycle management via 6-state machine:
  - **Idle:** No instance running
  - **Spawning:** Instance starting (first-keystroke triggered)
  - **Working:** CC processing (no timeout)
  - **Pending:** Waiting for user input (tiered timeout applies)
  - **Terminating:** Instance stopping
  - **Error:** Failed operation
- Session file reading from `CLAUDE_CONFIG_DIR` folder (app data path)
- `CLAUDE_CONFIG_DIR` isolation for CC instances (per-process env var)

**Post-Phase 1:**
- System notifications (session complete, errors, etc.)
- Global keyboard shortcuts
- Menu bar presence (optional)
- File associations (if applicable)

### Offline Capabilities

**Offline-First Design:**
- App launches and functions without internet
- Full session history browsing offline
- Workflow creation and editing offline
- Plugin settings and configuration offline

**Online Required:**
- Running CC sessions (API calls)
- Update checks

**Offline Indicator:**
- Clear UI indication when offline
- Graceful handling when attempting online-only actions

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Platform MVP
Build the foundational architecture that enables future expansion. Prove the core value proposition (visual CC client) before adding complexity.

**Core Principle:** Ship the smallest thing that validates "I don't need terminal anymore."

### MVP Feature Set (Phase 1)

**Supported User Journeys:**
- Session Reviewer - Full support
- Sessions (interactive) - Full support
- Plugin Manager - Basic support

**Must-Have Capabilities:**

| Component | Purpose |
|-----------|---------|
| Core UI Shell | Obsidian-inspired ribbon + panels foundation |
| Loading Screen | CC verification, auth check, app initialization |
| Plugin Architecture | Settings page, enable/disable, per-plugin config |
| Sessions Plugin | History, create, interact, real-time view, child lifecycle |
| Run CC from Grimoire | Spawn with `CLAUDE_CONFIG_DIR` isolation, intelligent child lifecycle |

**Explicitly Deferred:**
- Internationalization (EN/FR) - Post-MVP
- System notifications - Post-MVP
- Global keyboard shortcuts - Post-MVP
- Cross-platform (Windows/Linux) - Post-MVP

### Post-MVP Features

**Phase 2 (Enhancement):**
- i18n System (EN, FR, architecture for more)
- System notifications
- Global keyboard shortcuts
- Windows/Linux support

**Phase 3 (Expansion):**
- Workflow library and management
- Workflow builder
- Community plugin support
- Sharing/export workflows

**Phase 4 (Vision):**
- Reusable workflow templates
- Shared agent memory spaces
- Workflow chaining
- Community plugin marketplace
- Team collaboration

### Risk Mitigation Strategy

**Technical Risks:**
| Risk | Mitigation |
|------|------------|
| CC child process management complexity | Start with simple spawn/stop, iterate on lifecycle |
| Session file parsing edge cases | Test against real session files early |
| Plugin architecture over-engineering | Core plugin validates architecture before community |

**Market Risks:**
| Risk | Mitigation |
|------|------------|
| Not faster than CLI | Performance targets baked into success criteria |
| Missing critical CC features | Parity check before each release |

**Resource Risks:**
| Risk | Mitigation |
|------|------------|
| Scope creep | Strict Phase 1 boundaries, defer everything else |
| Solo development | Lean MVP, modular architecture for future help |

## Functional Requirements

### Application Shell

- FR1: User can view application in multi-panel layout with navigation ribbon (left panel, middle panel, right panel)
- FR2: User can collapse/expand left and right panels
- FR3: User can navigate between app sections via ribbon icons
- FR4: User can resize panels by dragging dividers
- FR5: User can open multiple sessions in a tab system (one session = one tab maximum, sub-agent conversations open as additional tabs)
- FR6: User can switch between open session tabs (clicking already-open session focuses existing tab)
- FR7: User can drag a tab to panel border to split view
- FR7a: System displays confirmation dialog when user closes tab with Working session
- FR7b: User can close tab with Pending/Idle session without confirmation
- FR7c: System terminates all child processes gracefully on application quit

### Application Lifecycle

- FR8: System displays loading screen with app logo during startup
- FR9: System verifies Claude Code installation on startup
- FR10: System verifies `CLAUDE_CONFIG_DIR` environment configuration on startup
- FR11: System displays modal error with quit/retry if config directory setup fails
- FR12: System verifies authentication credentials on startup
- FR13: User can use the application offline for non-CC operations
- FR14: System indicates online/offline status clearly
- FR15: System checks for updates on launch and prompts user when available
- FR16: User can choose to update now, skip version, or defer update reminder
- FR17: System persists user preferences and application state across restarts
- FR17a: System queries database first on startup for fast session list display (DB-first pattern)
- FR17b: System scans `CLAUDE_CONFIG_DIR` folder in background after startup
- FR17c: System notifies user of sessions discovered in config folder that are not in database
- FR17d: User can sync discovered sessions into the database
- FR18: System opens to new Session ready for input on launch
- FR19: User can configure which plugin displays on startup (in settings)

### Plugin System

- FR20: User can view list of installed plugins in settings
- FR21: User can enable/disable individual plugins
- FR22: User can access plugin-specific settings for each plugin
- FR23: System loads only enabled plugins on startup
- FR24: Core plugins use the same architecture as future community plugins

### Session Management

- FR25: User can view list of all CC sessions from `CLAUDE_CONFIG_DIR` folder (app data path)
- FR26: User can select a session to view its conversation
- FR27: User can create a new session (requires folder selection when initiated from within app)
- FR28: User can see which sessions have active child processes (visual indicator)
- FR28a: User can disconnect (kill) a running instance via 🔌 button on session row
- FR28b: System shows warning when disconnecting a Working instance (not Pending)
- FR29: User can see session metadata (date, project, duration, folder path)
- FR29a: System displays folder path below session name in session list
- FR29b: System displays warning icon on sessions whose folder no longer exists
- FR30: User can archive sessions
- FR31: User can toggle visibility of archived sessions
- FR32: System displays empty/new session state when no session selected
- FR32a: System builds sub-agent index when session loads, containing path, parent reference, and label for each sub-agent
- FR32b: System updates sub-agent index when new sub-agents are discovered during streaming

### Conversation Display

- FR33: User can view conversation as sequential message bubbles (user/Claude)
- FR34: User can distinguish tool calls from regular messages visually
- FR35: User can expand tool calls to see full input/output details
- FR36: User can see sub-agent spawns as nested/collapsible conversation elements
- FR37: User can expand sub-agent to view its full conversation
- FR37a: User can open sub-agent conversation in a dedicated tab by clicking "open in tab" button on sub-agent bubble
- FR37b: User can open sub-agent conversation in a dedicated tab by clicking sub-agent event in timeline
- FR37c: System displays sub-agent tabs with visual differentiation (color tint via CSS class)
- FR37d: System displays sub-agent tab label in format "{agentType}-{shortId}" (e.g., "Explore-a8b2")
- FR38: User can see error indicators on failed operations
- FR39: User can scroll through long conversations
- FR40: User can navigate long conversations via navigation map in right panel
- FR41: System displays non-persistent "thinking" indicator while waiting for CC response
- FR42: System displays "Loading Claude Code" indicator when spawning child

### Session Information

- FR43: User can view session information in right panel (context-dependent view)
- FR43a: Right panel shows session info/events when viewing a conversation
- FR43b: Right panel shows file edit history when viewing a file
- FR43c: Right panel shows folder tree when folder tree view is active
- FR44: User can see token usage for the session
- FR45: User can see token consumption per message (if available from CC data)
- FR46: User can see all metadata available from Claude Code session files

### Session Interaction

- FR47: User can type messages in chat input at bottom of conversation view
- FR48: User can paste multi-line content into chat input
- FR49: User can send message to spawn/resume CC child process
- FR50: User can see real-time streaming of CC responses
- FR51: User can interact with any session (historical or new) via chat input
- FR52: System generates Session UUID on first user input (before CC spawn)
- FR53: System saves session even if CC spawn fails (preserves user input and errors)
- FR54: System stops child process when CC waits for user input (transitions to Pending state)
- FR55: System restarts child process when user sends new message
- FR55a: System spawns child process when user starts typing in an inactive session (first-keystroke spawn)
- FR55b: User can configure idle timeout for unfocused sessions (default: 3 minutes)
- FR55c: User can configure idle timeout for focused sessions (default: 10 minutes)
- FR55d: User can disable idle timeout entirely ("never close" option)
- FR55e: Timer resets when switching tabs (not cumulative)
- FR56: System maintains session ID mapping to child processes
- FR57: User can abort a running CC process
- FR58: System displays "Aborted" message in conversation when user aborts
- FR59: User can resume aborted session by typing new message
- FR60: Chat input displays placeholder "Type anything to continue..." on started sessions

### CC Integration

- FR61: System spawns CC child processes with `CLAUDE_CONFIG_DIR` environment variable for isolation
- FR62: System spawns CC with session ID argument for session continuity
- FR63: System passes user input to CC child process as terminal input
- FR64: System captures CC output and renders in conversation view
- FR65: System tracks session ID for each spawned CC instance
- FR66: System supports resuming any existing session by ID
- FR67: System displays actionable error in conversation when CC fails to spawn
- FR67a: System uses unified conversation loader for both main sessions and sub-agent conversations
- FR67b: System determines conversation type (main vs sub-agent) from file path, not loader logic

### Folder Management

- FR68: System requires folder selection when creating new session from within app (folder picker dialog)
- FR69: System uses implicit folder from CLI argument when launched via `grimoire <path>` or OS context menu
- FR70: User can view hierarchical folder tree in left panel showing folders that contain sessions
- FR71: User can expand/collapse folder nodes in hierarchy to see nested folders
- FR72: User can see session count (direct + recursive) on each folder in hierarchy
- FR73: User can click folder to filter session list to that folder's sessions
- FR74: User can see folder path displayed below session name in session list
- FR75: System displays warning icon on sessions whose folder no longer exists (orphaned)
- FR76: System displays warning icon on folders in hierarchy that no longer exist
- FR77: User can relocate orphaned folder via "Relocate folder" action

### Folder Tree (Right Panel)

- FR78: User can view full file tree of active session's folder in right panel
- FR79: System respects `.gitignore` when building folder tree (excludes `node_modules`, etc.)
- FR80: User can expand/collapse folders in file tree
- FR81: User can use "Collapse All" / "Expand All" buttons in file tree header
- FR82: User can click any file to open file preview in middle panel tab
- FR83: System displays change indicator (color + count) on files modified by AI
- FR84: System bubbles up change indicators to parent folders (if any descendant has changes)

### Search Feature

- FR85: User can access expandable search bar in session list panel header
- FR86: User can access expandable search bar in folder hierarchy panel header
- FR87: System filters list instantly per keystroke (no confirmation needed)
- FR88: System supports fuzzy matching on session name, folder path, session ID, git branch
- FR89: System supports comma-separated terms as OR logic (e.g., "dev,marketing")
- FR90: User can collapse search bar by clicking outside or clicking search icon again

### Pinning

- FR91: User can pin any session (pinned sessions appear at top of session list)
- FR92: User can pin root folders only (pinned folders appear at top of folder hierarchy)
- FR93: System reveals pin icon on hover (top-left of item)
- FR94: User can toggle pin state by clicking pin icon

### File Edit Tracking

- FR95: System tracks all AI file edits with session ID, timestamp, tool type, and line range
- FR96: User can view file edit history in right panel when viewing a file (not conversation)
- FR97: System displays file edits from all sessions that modified that file (cross-session)
- FR98: User can click file edit event to open the session that made that edit

### Deferred to Post-MVP

- Content search within conversations

## Non-Functional Requirements

### Performance

| Metric | Requirement | Rationale |
|--------|-------------|-----------|
| App startup | < 3 seconds | Faster than opening terminal + typing `claude` |
| Session load (100+ messages) | < 1 second | Instant-feel navigation |
| Sub-agent expansion | < 100ms | Perceived as instant |
| Child spawn/resume | < 500ms | No waiting after hitting Enter |
| Real-time streaming | No perceptible lag | Matches terminal experience |
| Panel resize/collapse | Instant | No UI jank |
| Tab switching | Instant | No reload delay |

**Performance Gate:** If any user-facing operation feels slower than the CLI equivalent, it's a bug.

### Reliability

**Data Integrity:**
- Zero session data loss under any circumstance
- User input preserved even if CC spawn fails
- Application state persists across crashes/restarts
- Graceful degradation when offline (read-only operations work)

**Crash Recovery:**
- Application restarts to last known good state
- Open tabs/sessions restored on restart
- No corruption of session files or preferences
- Clear error messaging when recovery needed

**Process Stability:**
- Child process failures don't crash the main application
- Orphaned child processes are cleaned up on app quit
- Memory usage remains stable during long sessions

### Integration

**Claude Code Integration:**
- Reads session files from `CLAUDE_CONFIG_DIR` folder (platform-specific app data path)
- Spawns CC with `--session-id` and `--output-format stream-json` arguments
- Passes user input to CC child process via `-p` argument
- Captures NDJSON stream for conversation rendering
- `CLAUDE_CONFIG_DIR` isolation prevents config conflicts (per-process env var)

**File System:**
- File watcher monitors `CLAUDE_CONFIG_DIR` folder for new/updated sessions
- Session list updates automatically when new sessions detected
- Changes to session files reflected in real-time (if session is open)

**System:**
- Respects system dark/light mode (if applicable to UI framework)
- Proper app lifecycle (quit, minimize, background behavior)

### Not Applicable (Explicitly Excluded)

**Scalability:** Personal single-user tool - no multi-user or cloud scale requirements for Phase 1.

**Accessibility:** Deferred to post-MVP when expanding to non-expert users. Will revisit for Phase 2+.

**Security:** Local-first architecture with no network data transmission beyond CC's own API calls. `CLAUDE_CONFIG_DIR` isolation covered in functional requirements.
