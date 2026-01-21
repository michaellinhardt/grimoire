---
stepsCompleted: [1, 2, 3, 4]
status: complete
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# Grimoire - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Grimoire, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Application Shell (FR1-FR7c)**
- FR1: User can view application in multi-panel layout with navigation ribbon (left panel, middle panel, right panel)
- FR2: User can collapse/expand left and right panels
- FR3: User can navigate between app sections via ribbon icons
- FR4: User can resize panels by dragging dividers
- FR5: User can open multiple sessions in a tab system (one session = one tab maximum, sub-agent conversations open as additional tabs)
- FR6: User can switch between open session tabs (clicking already-open session focuses existing tab)
- FR7: User can drag a tab to panel border to split view
- FR7a: System displays confirmation dialog when user closes tab with Working session
- FR7b: User can close tab with Idle session without confirmation
- FR7c: System terminates all child processes gracefully on application quit

**Application Lifecycle (FR8-FR19)**
- FR8: System displays loading screen with app logo during startup
- FR9: System verifies Claude Code installation on startup
- FR10: System verifies CLAUDE_CONFIG_DIR environment configuration on startup
- FR11: System displays modal error with quit/retry if config directory setup fails
- FR12: System verifies authentication credentials on startup
- FR13: User can use the application offline for non-CC operations
- FR14: System indicates online/offline status clearly
- FR15: System checks for updates on launch and prompts user when available
- FR16: User can choose to update now, skip version, or defer update reminder
- FR17: System persists user preferences and application state across restarts
- FR17a: System queries database first on startup for fast session list display (DB-first pattern)
- FR17b: System scans CLAUDE_CONFIG_DIR folder in background after startup
- FR17c: System notifies user of sessions discovered in config folder that are not in database
- FR17d: User can sync discovered sessions into the database
- FR18: System opens to new Session ready for input on launch
- FR19: User can configure which plugin displays on startup (in settings)

**Plugin System (FR20-FR24)**
- FR20: User can view list of installed plugins in settings
- FR21: User can enable/disable individual plugins
- FR22: User can access plugin-specific settings for each plugin
- FR23: System loads only enabled plugins on startup
- FR24: Core plugins use the same architecture as future community plugins

**Session Management (FR25-FR32b)**
- FR25: User can view list of all CC sessions from CLAUDE_CONFIG_DIR folder (app data path)
- FR26: User can select a session to view its conversation
- FR27: User can create a new session (requires folder selection when initiated from within app)
- FR28: User can see which sessions have active child processes (visual indicator)
- FR28a: [REMOVED - No persistent instances to disconnect with request-response model]
- FR28b: [REMOVED - No persistent instances to disconnect with request-response model]
- FR29: User can see session metadata (date, project, duration, folder path)
- FR29a: System displays folder path below session name in session list
- FR29b: System displays warning icon on sessions whose folder no longer exists
- FR30: User can archive sessions
- FR31: User can toggle visibility of archived sessions
- FR32: System displays empty/new session state when no session selected
- FR32a: System builds sub-agent index when session loads, containing path, parent reference, and label for each sub-agent
- FR32b: System updates sub-agent index when new sub-agents are discovered after response

**Conversation Display (FR33-FR42)**
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

**Session Information (FR43-FR46)**
- FR43: User can view session information in right panel (context-dependent view)
- FR43a: Right panel shows session info/events when viewing a conversation
- FR43b: Right panel shows file edit history when viewing a file
- FR43c: Right panel shows folder tree when folder tree view is active
- FR44: User can see token usage for the session
- FR45: User can see token consumption per message (if available from CC data)
- FR46: User can see all metadata available from Claude Code session files

**Session Interaction (FR47-FR60)**
- FR47: User can type messages in chat input at bottom of conversation view
- FR48: User can paste multi-line content into chat input
- FR49: User can send message to spawn/resume CC child process
- FR50: User can see CC responses displayed after process completion
- FR51: User can interact with any session (historical or new) via chat input
- FR52: System generates Session UUID on first user input (before CC spawn)
- FR53: System saves session even if CC spawn fails (preserves user input and errors)
- FR54: [REMOVED - Process exits naturally after each response, no Pending state]
- FR55: System spawns new child process when user sends message (request-response model)
- FR55a: [REMOVED - On-send spawn instead]
- FR55b: [REMOVED - No timeout needed]
- FR55c: [REMOVED - No timeout needed]
- FR55d: [REMOVED - No timeout needed]
- FR55e: [REMOVED - No timeout needed]
- FR56: System maintains session ID mapping to child processes
- FR57: User can abort a running CC process
- FR58: System displays "Aborted" message in conversation when user aborts
- FR59: User can resume aborted session by typing new message
- FR60: Chat input displays placeholder "Type anything to continue..." on started sessions

**CC Integration (FR61-FR67b)**
- FR61: System spawns CC child processes with CLAUDE_CONFIG_DIR environment variable for isolation
- FR62: System spawns CC with session ID argument for session continuity
- FR63: System passes user input to CC child process as terminal input
- FR64: System reads session file after process exit and renders new messages in conversation view
- FR65: System tracks session ID for each spawned CC instance
- FR66: System supports resuming any existing session by ID
- FR67: System displays actionable error in conversation when CC fails to spawn
- FR67a: System uses unified conversation loader for both main sessions and sub-agent conversations
- FR67b: System determines conversation type (main vs sub-agent) from file path, not loader logic
- FR67c: System captures session ID from stream init message (not from file system)
- FR67d: System captures user message UUIDs from stream for checkpoint capability
- FR67e: System stores session metadata (tokens, cost) to database during streaming
- FR67f: System tracks session lineage via forked_from_session_id when rewinding
- FR67g: System can hide forked-from sessions via is_hidden flag
- FR67h: User can rewind conversation from any user message via hover action (except first message)
- FR67i: System hides chat input when viewing sub-agent conversation tab

**Folder Management (FR68-FR77)**
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

**Folder Tree - Right Panel (FR78-FR84)**
- FR78: User can view full file tree of active session's folder in right panel
- FR79: System respects .gitignore when building folder tree (excludes node_modules, etc.)
- FR80: User can expand/collapse folders in file tree
- FR81: User can use "Collapse All" / "Expand All" buttons in file tree header
- FR82: User can click any file to open file preview in middle panel tab
- FR83: System displays change indicator (color + count) on files modified by AI
- FR84: System bubbles up change indicators to parent folders (if any descendant has changes)

**Search Feature (FR85-FR90)**
- FR85: User can access expandable search bar in session list panel header
- FR86: User can access expandable search bar in folder hierarchy panel header
- FR87: System filters list instantly per keystroke (no confirmation needed)
- FR88: System supports fuzzy matching on session name, folder path, session ID, git branch
- FR89: System supports comma-separated terms as OR logic (e.g., "dev,marketing")
- FR90: User can collapse search bar by clicking outside or clicking search icon again

**Pinning (FR91-FR94)**
- FR91: User can pin any session (pinned sessions appear at top of session list)
- FR92: User can pin root folders only (pinned folders appear at top of folder hierarchy)
- FR93: System reveals pin icon on hover (top-left of item)
- FR94: User can toggle pin state by clicking pin icon

**File Edit Tracking (FR95-FR98)**
- FR95: System tracks all AI file edits with session ID, timestamp, tool type, and line range
- FR96: User can view file edit history in right panel when viewing a file (not conversation)
- FR97: System displays file edits from all sessions that modified that file (cross-session)
- FR98: User can click file edit event to open the session that made that edit

### Non-Functional Requirements

**Performance**
- NFR1: App startup < 3 seconds (faster than opening terminal + typing `claude`)
- NFR2: Session load (100+ messages) < 1 second (instant-feel navigation)
- NFR3: Sub-agent expansion < 100ms (perceived as instant)
- NFR4: Child spawn/resume < 500ms (no waiting after hitting Enter)
- NFR5: Response display with minimal delay after process completion
- NFR6: Panel resize/collapse instant (no UI jank)
- NFR7: Tab switching instant (no reload delay)

**Reliability**
- NFR8: Zero session data loss under any circumstance
- NFR9: User input preserved even if CC spawn fails
- NFR10: Application state persists across crashes/restarts
- NFR11: Graceful degradation when offline (read-only operations work)
- NFR12: Application restarts to last known good state
- NFR13: Open tabs/sessions restored on restart
- NFR14: No corruption of session files or preferences
- NFR15: Clear error messaging when recovery needed
- NFR16: Child process failures don't crash the main application
- NFR17: Orphaned child processes cleaned up on app quit
- NFR18: Memory usage remains stable during long sessions

**Integration**
- NFR19: Reads session files from CLAUDE_CONFIG_DIR folder (platform-specific app data path)
- NFR20: Spawns CC with --session-id and -p arguments (request-response mode)
- NFR21: Passes user message to CC child process via -p argument
- NFR22: Reads session JSONL file after process exit for conversation rendering
- NFR23: CLAUDE_CONFIG_DIR isolation prevents config conflicts (per-process env var)
- NFR24: File watcher monitors CLAUDE_CONFIG_DIR folder for new/updated sessions
- NFR25: Session list updates automatically when new sessions detected
- NFR26: Changes to session files reflected in real-time (if session is open)
- NFR27: Respects system dark/light mode (if applicable to UI framework)
- NFR28: Proper app lifecycle (quit, minimize, background behavior)

### Additional Requirements

**From Architecture - Starter Template & Setup**
- AR1: Use electron-vite with react-ts template as starter
- AR2: Technology stack: React + TypeScript + Tailwind CSS v4 + Radix UI + Zustand + SQLite (better-sqlite3) + Zod + Vitest
- AR3: Database location at ~/.grimoire/grimoire.db
- AR4: Schema version tracking with recreate-on-change for MVP

**From Architecture - State Management**
- AR5: SQLite for persistent data (sessions, settings, plugin config)
- AR6: Zustand for runtime UI state (panel visibility, selected tab, transient state)
- AR7: Plain objects in main process for child process registry and watcher status

**From Architecture - IPC & Communication**
- AR8: Typed contextBridge via shared types (GrimoireAPI interface)
- AR9: IPC channels follow namespace:action pattern (e.g., sessions:list, sessions:spawn)
- AR10: Zod validation at IPC boundary (renderer → main only)
- AR11: Polling with 1-2 second interval for data fetching (MVP pattern)

**From Architecture - Plugin System**
- AR12: Static imports with folder convention for MVP (no dynamic runtime loading)
- AR13: Plugins organized under plugins/ directory with main/renderer/shared structure
- AR14: Plugin loader statically imports enabled plugins

**From Architecture - Spawn Child System**
- AR15: 3-state instance machine: Idle → Working → Idle (or Idle → Working → Error → Idle)
- AR16: [REMOVED - No timeouts needed with request-response model]
- AR17: [REMOVED - On-send spawn instead of first-keystroke]
- AR18: Error categorization: Network/transient (auto-retry 2x), Spawn failure (show immediately), Claude error (show in chat), Crash/fatal (terminate, show error)

**From Architecture - Stream Communication**
- AR19: NDJSON stream-json protocol via CC CLI with --include-partial-messages
- AR20: Stream state management for text and tool call assembly
- AR21: Response tracking with status (sending, streaming, complete, error)
- AR22: Handle known issue: final result event may not emit, use stop_reason instead

**From Architecture - Sub-Agent Index**
- AR23: In-memory sub-agent index with agentId, path, parentId, parentMessageUuid, agentType, label
- AR24: Index populated on session load, updated during streaming, discarded on app quit

**From Architecture - Data Patterns**
- AR25: Hybrid session ID management: .claude folder is truth, DB adds metadata
- AR26: DB-first startup pattern: query DB first, background scan folder, flag discrepancies
- AR27: Unified conversation loader handles both main and sub-agent conversations
- AR28: Snake_case in DB, camelCase in TypeScript with transform functions

**From Architecture - Project Structure**
- AR29: Feature-based folder organization with colocated tests
- AR30: Plugins kept flat (2-3 levels max)
- AR31: Shared UI extracted only when second consumer appears

**From Architecture - Database Schema**
- AR32: Sessions table with id, folder_path, created_at, updated_at, last_accessed_at, archived, is_pinned
- AR33: Folders table with path, is_pinned, last_accessed_at
- AR34: File_edits table with id, file_path, session_id, timestamp, tool_type, line_start, line_end
- AR35: Settings table with key, value, updated_at

**From UX Design - Visual Design**
- UX1: Dark-first design with purple accent color (hsl 270, 60%, 55%)
- UX2: Color system with base, elevated, hover backgrounds
- UX3: System fonts (system-ui stack) for native feel
- UX4: 8px base spacing unit with defined scale (xs through 2xl)

**From UX Design - Core Components**
- UX5: Ribbon navigation (48px fixed, left edge)
- UX6: Collapsible panels with door button toggle
- UX7: Tab bar for multi-session management
- UX8: Message bubbles (User, Claude, Tool, Sub-Agent variants)
- UX9: Event Timeline with chat-style items (no icons, token counts)
- UX10: Status indicators with 3-state visual mapping (Idle, Working, Error - color bar + icon + animation)

**From UX Design - Interaction Patterns**
- UX11: Zero-click to first action principle (cursor in input on new session)
- UX12: Progressive disclosure (summary first, detail on click)
- UX13: Inline expansion preferred over modals
- UX14: Keyboard navigation throughout (Tab, Enter, Escape, Arrow keys)
- UX15: Minimal animation (150-200ms transitions, instant tab switch)

**From UX Design - Panel Layout**
- UX16: Left panel 280px default (sessions list or folder hierarchy)
- UX17: Right panel 300px default (info/events/files tabs)
- UX18: Middle panel flex (conversation view)
- UX19: Minimum window dimensions 800x600px

### FR Coverage Map

| FR Range | Epic | Description |
|----------|------|-------------|
| FR1-FR7c | Epic 1 | Application Shell - multi-panel layout, tabs, ribbon |
| FR8-FR19 | Epic 4 | Application Lifecycle - startup, verification, persistence |
| FR20-FR24 | Epic 7 | Plugin System - settings, enable/disable |
| FR25-FR32b | Epic 2a | Session List & Basic Display |
| FR33-FR42 | Epic 2b | Conversation Rendering - bubbles, tools, sub-agents |
| FR43-FR46 | Epic 2c | Session Info & Timeline |
| FR47-FR53, FR57-FR60 | Epic 3a | Chat Input & Basic Send |
| FR55-FR56, FR61-FR67b | Epic 3b | CC Integration & Instance Management |
| FR68-FR77 | Epic 5a | Folder Hierarchy |
| FR78-FR84 | Epic 5b | File Tree & Change Indicators |
| FR85-FR90 | Epic 6 | Search Feature |
| FR91-FR94 | Epic 6 | Pinning |
| FR95-FR98 | Epic 6 | File Edit Tracking |

**Detailed FR to Epic Mapping:**

- FR1: Epic 1 - Multi-panel layout with ribbon
- FR2: Epic 1 - Collapse/expand panels
- FR3: Epic 1 - Ribbon navigation
- FR4: Epic 1 - Resizable panel dividers
- FR5: Epic 1 - Tab system for sessions
- FR6: Epic 1 - Tab switching
- FR7: Epic 1 - Tab drag to split view
- FR7a: Epic 1 - Confirmation on close Working tab
- FR7b: Epic 1 - Close Idle session without confirm
- FR7c: Epic 1 - Graceful process termination on quit
- FR8: Epic 4 - Loading screen
- FR9: Epic 4 - CC installation verification
- FR10: Epic 4 - CLAUDE_CONFIG_DIR verification
- FR11: Epic 4 - Modal error on config failure
- FR12: Epic 4 - Auth verification
- FR13: Epic 4 - Offline capability
- FR14: Epic 4 - Online/offline indicator
- FR15: Epic 4 - Update check on launch
- FR16: Epic 4 - Update options (now/skip/defer)
- FR17: Epic 4 - State persistence
- FR17a: Epic 4 - DB-first startup
- FR17b: Epic 4 - Background folder scan
- FR17c: Epic 4 - Discovered sessions notification
- FR17d: Epic 4 - Sync discovered sessions
- FR18: Epic 4 - Open to new session on launch
- FR19: Epic 4 - Configure startup plugin
- FR20: Epic 7 - View plugin list
- FR21: Epic 7 - Enable/disable plugins
- FR22: Epic 7 - Plugin-specific settings
- FR23: Epic 7 - Load only enabled plugins
- FR24: Epic 7 - Core plugin architecture
- FR25: Epic 2a - View session list
- FR26: Epic 2a - Select session to view
- FR27: Epic 2a - Create new session
- FR28: Epic 2a - Active process indicator
- FR28a: [REMOVED - No persistent instances with request-response model]
- FR28b: [REMOVED - No persistent instances with request-response model]
- FR29: Epic 2a - Session metadata display
- FR29a: Epic 2a - Folder path in session list
- FR29b: Epic 2a - Orphaned session warning
- FR30: Epic 2a - Archive sessions
- FR31: Epic 2a - Toggle archived visibility
- FR32: Epic 2a - Empty/new session state
- FR32a: Epic 2a - Sub-agent index on load
- FR32b: Epic 2a - Sub-agent index update
- FR33: Epic 2b - Message bubbles
- FR34: Epic 2b - Tool call visual distinction
- FR35: Epic 2b - Expand tool calls
- FR36: Epic 2b - Sub-agent nested display
- FR37: Epic 2b - Expand sub-agent
- FR37a: Epic 2b - Open sub-agent in tab (button)
- FR37b: Epic 2b - Open sub-agent in tab (timeline)
- FR37c: Epic 2b - Sub-agent tab styling
- FR37d: Epic 2b - Sub-agent tab label format
- FR38: Epic 2b - Error indicators
- FR39: Epic 2b - Scroll conversations
- FR40: Epic 2b - Navigation map
- FR41: Epic 2b - Thinking indicator
- FR42: Epic 2b - Loading CC indicator
- FR43: Epic 2c - Session info in right panel
- FR43a: Epic 2c - Info/events for conversation
- FR43b: Epic 2c - File edit history for file
- FR43c: Epic 2c - Folder tree view
- FR44: Epic 2c - Token usage display
- FR45: Epic 2c - Per-message token count
- FR46: Epic 2c - Full metadata display
- FR47: Epic 3a - Chat input
- FR48: Epic 3a - Multi-line paste
- FR49: Epic 3a - Send message
- FR50: Epic 3a - Real-time streaming display
- FR51: Epic 3a - Interact with any session
- FR52: Epic 3a - UUID generation
- FR53: Epic 3a - Save on spawn failure
- FR54: [REMOVED - Process exits naturally, no Pending state]
- FR55: Epic 3b - Spawn new process on message send (request-response model)
- FR55a: [REMOVED - On-send spawn instead]
- FR55b: [REMOVED - No timeout needed]
- FR55c: [REMOVED - No timeout needed]
- FR55d: [REMOVED - No timeout needed]
- FR55e: [REMOVED - No timeout needed]
- FR56: Epic 3b - Session-to-process mapping
- FR57: Epic 3a - Abort process
- FR58: Epic 3a - Aborted message display
- FR59: Epic 3a - Resume aborted session
- FR60: Epic 3a - Placeholder text
- FR61: Epic 3b - CLAUDE_CONFIG_DIR spawn
- FR62: Epic 3b - Session ID argument
- FR63: Epic 3b - Pass input to CC
- FR64: Epic 3b - Capture NDJSON stream
- FR65: Epic 3b - Track session ID
- FR66: Epic 3b - Resume by session ID
- FR67: Epic 3b - Spawn error display
- FR67a: Epic 3b - Unified conversation loader
- FR67b: Epic 3b - Conversation type from path
- FR67c: Epic 3b - Session ID from stream
- FR67d: Epic 3b - Checkpoint UUIDs from stream
- FR67e: Epic 2a - Session metadata storage (also Epic 3b for capture)
- FR67f: Epic 2a - Session forking lineage
- FR67g: Epic 2a - Hidden session flag
- FR67h: Epic 2b - Rewind UI on user messages
- FR67i: Epic 2b - Sub-agent tab read-only
- FR68: Epic 5a - Folder picker for new session
- FR69: Epic 5a - Implicit folder from CLI
- FR70: Epic 5a - Folder hierarchy view
- FR71: Epic 5a - Expand/collapse folders
- FR72: Epic 5a - Session count on folders
- FR73: Epic 5a - Filter by folder click
- FR74: Epic 5a - Folder path in session list
- FR75: Epic 5a - Orphaned session warning
- FR76: Epic 5a - Orphaned folder warning
- FR77: Epic 5a - Relocate orphaned folder
- FR78: Epic 5b - File tree in right panel
- FR79: Epic 5b - Respect .gitignore
- FR80: Epic 5b - Expand/collapse file tree
- FR81: Epic 5b - Collapse/Expand all buttons
- FR82: Epic 5b - Click file to preview
- FR83: Epic 5b - AI change indicator
- FR84: Epic 5b - Bubble up indicators
- FR85: Epic 6 - Session search bar
- FR86: Epic 6 - Folder search bar
- FR87: Epic 6 - Instant filter
- FR88: Epic 6 - Fuzzy matching
- FR89: Epic 6 - OR logic with comma
- FR90: Epic 6 - Collapse search bar
- FR91: Epic 6 - Pin sessions
- FR92: Epic 6 - Pin root folders
- FR93: Epic 6 - Pin icon on hover
- FR94: Epic 6 - Toggle pin state
- FR95: Epic 6 - Track AI file edits
- FR96: Epic 6 - File edit history view
- FR97: Epic 6 - Cross-session file edits
- FR98: Epic 6 - Click edit to open session

## Epic List

### Epic 1: Project Bootstrap & Core Shell
**User Outcome:** Launch Grimoire and see the Obsidian-inspired interface with ribbon navigation, collapsible panels, and a tab system ready to hold sessions.

**FRs Covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR7a, FR7b, FR7c (10 FRs)

**ARs Covered:** AR1-AR7, AR28-AR31, AR32-AR35, UX1-UX7, UX14-UX19

---

### Epic 2a: Session List & Basic Display
**User Outcome:** Browse all CC sessions from CLAUDE_CONFIG_DIR and select one to view its details.

**FRs Covered:** FR25, FR26, FR27, FR28, FR29, FR29a, FR29b, FR30, FR31, FR32, FR32a, FR32b (12 FRs)

**ARs Covered:** AR23-AR27

---

### Epic 2b: Conversation Rendering
**User Outcome:** View conversation as message bubbles with tool calls and sub-agents clearly displayed and expandable.

**FRs Covered:** FR33, FR34, FR35, FR36, FR37, FR37a, FR37b, FR37c, FR37d, FR38, FR39, FR40, FR41, FR42 (14 FRs)

**ARs Covered:** UX8, UX12, UX13

---

### Epic 2c: Session Info & Timeline
**User Outcome:** See session metadata, token usage, and navigate via event timeline in the right panel.

**FRs Covered:** FR43, FR43a, FR43b, FR43c, FR44, FR45, FR46 (7 FRs)

**ARs Covered:** UX9

---

### Epic 3a: Chat Input & Basic Send
**User Outcome:** Type messages in chat input, send them, and see responses appear in the conversation.

**FRs Covered:** FR47, FR48, FR49, FR50, FR51, FR52, FR53, FR57, FR58, FR59, FR60 (11 FRs)

**ARs Covered:** UX11

---

### Epic 3b: CC Integration & Instance Management
**User Outcome:** Spawn CC instances, stream responses in real-time, and manage instance lifecycle with request-response model.

**FRs Covered:** FR55, FR56, FR61, FR62, FR63, FR64, FR65, FR66, FR67, FR67a, FR67b (11 FRs)

**ARs Covered:** AR15-AR22, UX10

---

### Epic 4: Application Lifecycle & Persistence
**User Outcome:** Grimoire starts reliably, verifies CC is configured correctly, shows clear errors if something's wrong, and remembers open sessions and preferences.

**FRs Covered:** FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR17a, FR17b, FR17c, FR17d, FR18, FR19 (16 FRs)

**NFRs Covered:** NFR8-NFR18

---

### Epic 5a: Folder Hierarchy
**User Outcome:** View folders containing sessions in a hierarchical tree and filter sessions by clicking a folder.

**FRs Covered:** FR68, FR69, FR70, FR71, FR72, FR73, FR74, FR75, FR76, FR77 (10 FRs)

---

### Epic 5b: File Tree & Change Indicators
**User Outcome:** Browse project files in the right panel with AI-change indicators showing which files were modified.

**FRs Covered:** FR78, FR79, FR80, FR81, FR82, FR83, FR84 (7 FRs)

---

### Epic 6: Search, Pinning & File Edit Tracking
**User Outcome:** Search for sessions using fuzzy matching, pin favorites for quick access, and track AI file edits across all sessions.

**FRs Covered:** FR85, FR86, FR87, FR88, FR89, FR90, FR91, FR92, FR93, FR94, FR95, FR96, FR97, FR98 (14 FRs)

---

### Epic 7: Plugin System & Settings
**User Outcome:** Configure plugins and adjust settings to customize Grimoire's behavior.

**FRs Covered:** FR20, FR21, FR22, FR23, FR24 (5 FRs)

**ARs Covered:** AR12-AR14

---

## Epic Summary

| Epic | Title | FRs | Complexity |
|------|-------|-----|------------|
| 1 | Project Bootstrap & Core Shell | 10 | Low |
| 2a | Session List & Basic Display | 12 | Medium |
| 2b | Conversation Rendering | 14 | Medium |
| 2c | Session Info & Timeline | 7 | Low |
| 3a | Chat Input & Basic Send | 11 | Medium |
| 3b | CC Integration & Instance Mgmt | 11 | Medium |
| 4 | Application Lifecycle & Persistence | 16 | Medium |
| 5a | Folder Hierarchy | 10 | Low |
| 5b | File Tree & Change Indicators | 7 | Low |
| 6 | Search, Pinning & File Tracking | 14 | Low |
| 7 | Plugin System & Settings | 5 | Low |
| **Total** | | **117** | |

---

## Epic 1: Project Bootstrap & Core Shell

### Story 1.1: Project Scaffold with Electron-Vite

As a **developer**,
I want **a fully configured Electron project with the required tech stack**,
So that **I have a solid foundation to build Grimoire's features upon**.

**Acceptance Criteria:**

**Given** the developer runs the project initialization commands
**When** the project is created with electron-vite react-ts template
**Then** the project structure matches the Architecture specification
**And** Tailwind CSS v4 is configured with dark-first color system (purple accent hsl 270, 60%, 55%)
**And** Radix UI primitives are installed (@radix-ui/react-dialog, dropdown-menu, tooltip, scroll-area, tabs)
**And** Zustand is configured for UI state management
**And** SQLite (better-sqlite3) is set up with database at ~/.grimoire/grimoire.db
**And** Zod is available for IPC validation
**And** Vitest is configured with jsdom environment for renderer tests
**And** the initial database schema is created (sessions, folders, file_edits, settings tables)
**And** `npm run dev` launches the Electron app successfully
**And** `npm run validate` (tsc + vitest + lint) passes

---

### Story 1.2: Core Shell Layout with Ribbon and Panels

As a **user**,
I want **to see an Obsidian-inspired interface with ribbon and panels**,
So that **I have a familiar, organized workspace for managing Claude Code sessions**.

**Acceptance Criteria:**

**Given** the user launches Grimoire
**When** the main window opens
**Then** a vertical ribbon (48px fixed width) is displayed on the left edge
**And** the ribbon contains icon buttons for app sections (Sessions active by default)
**And** a left panel (280px default) is displayed next to the ribbon
**And** a middle panel (flex) fills the remaining space
**And** a right panel (300px default) is displayed on the right edge
**And** each panel has a topbar with door button toggle

**Given** the user clicks the door button on the left panel
**When** the panel collapses
**Then** the panel slides closed (200ms ease-out)
**And** the middle panel expands to fill the space
**And** the door button remains accessible in the middle panel topbar

**Given** the user drags a panel divider
**When** they release the mouse
**Then** the panel resizes to the new width
**And** minimum widths are enforced (left: 240px, right: 260px, middle: 400px)

**Given** the user hovers over a ribbon icon
**When** the tooltip appears
**Then** it displays the section name

---

### Story 1.3: Tab System for Sessions

As a **user**,
I want **to open multiple sessions in tabs**,
So that **I can work with several conversations simultaneously**.

**Acceptance Criteria:**

**Given** the user is viewing the main interface
**When** a session is opened
**Then** a new tab appears in the tab bar at the top of the middle panel
**And** the tab displays the session name (or "New Session" for unsaved)
**And** clicking the tab switches to that session's content

**Given** a session is already open in a tab
**When** the user clicks that session in the session list
**Then** the existing tab is focused (not duplicated)

**Given** the user hovers over a tab
**When** the close button (×) becomes visible
**Then** clicking × closes the tab

**Given** the user clicks × on a tab with an Idle session (FR7b)
**When** the tab closes
**Then** no confirmation is required

**Given** the user clicks × on a tab with a Working session (FR7a)
**When** the confirmation dialog appears
**Then** the user can choose to close anyway or cancel
**And** if closed, the child process is terminated gracefully

**Given** the user clicks the + button in the tab bar
**When** a new tab opens
**Then** it shows an empty session ready for input

**Given** the user quits the application (FR7c)
**When** there are active child processes
**Then** all child processes are terminated gracefully before the app closes

---

## Epic 2a: Session List & Basic Display

### Story 2a.1: Session Scanner and Database Sync

As a **user**,
I want **Grimoire to discover all my Claude Code sessions automatically**,
So that **I can see my complete session history without manual import**.

**Acceptance Criteria:**

**Given** the CLAUDE_CONFIG_DIR contains session folders with .jsonl files
**When** Grimoire scans the directory
**Then** all session files are discovered and parsed
**And** session metadata is extracted (id, folder_path, created_at, updated_at)
**And** session records are stored in the SQLite sessions table
**And** existing sessions are updated, not duplicated

**Given** a session is loaded for viewing
**When** the conversation file is parsed
**Then** a sub-agent index is built containing agentId, path, parentId, parentMessageUuid, agentType, label (FR32a)
**And** the index enables fast lookup of sub-agent conversations

**Given** the unified conversation loader is called (AR27)
**When** loading a main session or sub-agent conversation
**Then** the same loader handles both cases
**And** conversation type is determined from file path (FR67b)

**Given** a session folder path no longer exists on disk
**When** the session is displayed
**Then** the session record is flagged as orphaned in the database

---

### Story 2a.2: Session List Component

As a **user**,
I want **to see all my sessions in an organized list**,
So that **I can quickly find and select the session I want to work with**.

**Acceptance Criteria:**

**Given** the user views the left panel with Sessions view active
**When** sessions are loaded from the database
**Then** sessions are displayed as a scrollable list
**And** each session item shows: name/summary, folder path below name (FR29a), relative timestamp
**And** sessions are sorted by last_accessed_at descending (most recent first)

**Given** a session has an active child process (FR28)
**When** displayed in the list
**Then** a ⚡ icon appears indicating connected state
**And** Working state shows green color bar with `···` animation

**Given** a session's folder no longer exists (FR29b)
**When** displayed in the list
**Then** a ⚠️ warning icon appears
**And** the folder path shows red tint

**Given** the user clicks a session in the list (FR26)
**When** the session is selected
**Then** the conversation loads in the middle panel
**And** the session is marked as last_accessed_at = now

---

### Story 2a.3: Session Management Actions

As a **user**,
I want **to create, archive, and manage my sessions**,
So that **I can organize my Claude Code work effectively**.

**Acceptance Criteria:**

**Given** the user wants to create a new session (FR27)
**When** initiated from within the app
**Then** a folder picker dialog appears (FR68)
**And** selecting a folder creates a new session associated with that folder
**And** the new session opens in a new tab

**Given** the user right-clicks a session or opens the 3-dot menu
**When** selecting "Archive" (FR30)
**Then** the session is marked as archived in the database
**And** the session is hidden from the default list view

**Given** archived sessions exist
**When** the user toggles "Show archived" (FR31)
**Then** archived sessions appear in the list with visual distinction
**And** toggling off hides them again

---

### Story 2a.4: Empty and New Session States

As a **user**,
I want **clear visual feedback when no session is selected or when starting fresh**,
So that **I understand the app state and know how to proceed**.

**Acceptance Criteria:**

**Given** no session is selected (FR32)
**When** the middle panel is displayed
**Then** an empty state message appears: "Select a session or start a new one"
**And** a prominent "New Session" button is visible

**Given** the user starts a new session
**When** the new session tab opens
**Then** the conversation area is empty
**And** the input box is auto-focused (UX11)
**And** the placeholder text says "Type your message..."

**Given** a session is being streamed with sub-agents
**When** new sub-agents are discovered (FR32b)
**Then** the sub-agent index is updated in real-time
**And** new sub-agents appear in the conversation as they are created

---

### Story 2a.5: Session Forking Database Support

As a **system**,
I want **to track session lineage and hidden status**,
So that **rewind operations preserve history while keeping the UI clean**.

**Acceptance Criteria:**

**Given** the database schema (FR67f)
**When** a session is forked via rewind
**Then** the new session record includes `forked_from_session_id` pointing to the parent
**And** the parent session is marked with `is_hidden = 1` (FR67g)

**Given** the session list is displayed
**When** loading sessions from database
**Then** sessions with `is_hidden = 1` are excluded from the default list
**And** the hidden sessions remain accessible via "Show all sessions" toggle (optional, can defer)

**Given** a session has `forked_from_session_id` set
**When** viewing the session info panel
**Then** the lineage is available for display (optional enhancement)

---

### Story 2a.6: Session Metadata Storage

As a **user**,
I want **to see token usage and cost in the Info panel**,
So that **I can track my Claude Code usage**.

**Acceptance Criteria:**

**Given** the database has `session_metadata` table (FR67e)
**When** a session streams responses
**Then** the system captures token counts and cost from the stream
**And** stores them in `session_metadata` table

**Given** a session has metadata stored
**When** viewing the session info panel
**Then** total input tokens, output tokens, and estimated cost are displayed
**And** the format is: "Tokens: 12.5k in / 8.2k out" and "Est. Cost: $0.42"

**Given** metadata is being captured during streaming
**When** the response completes
**Then** the session_metadata record is updated with cumulative totals
**And** the info panel reflects the updated values

---

## Epic 2b: Conversation Rendering

### Story 2b.1: Message Bubble Components

As a **user**,
I want **to see conversation messages as distinct visual bubbles**,
So that **I can easily follow the dialogue between myself and Claude**.

**Acceptance Criteria:**

**Given** a conversation is loaded
**When** the messages are rendered (FR33)
**Then** user messages appear as right-aligned bubbles with accent-muted background and accent border
**And** Claude messages appear as left-aligned bubbles with elevated background and subtle border
**And** each bubble has rounded corners (bottom-right smaller for user, bottom-left smaller for Claude)

**Given** messages are displayed
**When** viewing timestamps
**Then** timestamps appear below each bubble in muted text
**And** format is relative for recent ("2 min ago") and absolute for older ("Jan 15, 14:32")

**Given** a conversation has many messages (FR39)
**When** the user scrolls
**Then** the conversation area scrolls smoothly
**And** scroll position is preserved when switching back to this tab

**Given** a session is loaded
**When** the conversation renders
**Then** the view auto-scrolls to the most recent message

---

### Story 2b.2: Tool Call Display

As a **user**,
I want **to see tool calls as distinct visual elements**,
So that **I can understand what actions Claude performed and inspect their details**.

**Acceptance Criteria:**

**Given** a conversation contains tool calls (FR34)
**When** rendered in the conversation
**Then** tool calls appear as compact cards with tool-specific background (blue-tinted)
**And** tool cards have blue left border and monospace font
**And** tool cards are visually distinct from regular message bubbles

**Given** a tool call is displayed (collapsed by default)
**When** the user views it
**Then** it shows: tool name + brief summary (e.g., "Read src/api/routes/index.ts")
**And** a chevron indicates expandable state

**Given** the user clicks a collapsed tool call (FR35)
**When** it expands
**Then** full input parameters are displayed
**And** full output/result is displayed
**And** clicking again collapses it back

**Given** a tool call failed (FR38)
**When** displayed in the conversation
**Then** a red left border and error background tint indicate failure
**And** error message is visible in collapsed state
**And** expanding shows full error details

---

### Story 2b.3: Sub-Agent Display

As a **user**,
I want **to see sub-agent spawns as collapsible nested conversations**,
So that **I can understand what each agent did without losing context**.

**Acceptance Criteria:**

**Given** a conversation contains sub-agent spawns (FR36)
**When** rendered in the conversation
**Then** sub-agents appear as distinct bubbles with purple-tinted background and purple left border
**And** collapsed state shows: [A] icon + agent name + status badge (Running/Done/Error)

**Given** the user hovers over a collapsed sub-agent bubble
**When** the [↗] button becomes visible
**Then** clicking [↗] opens the sub-agent in a dedicated tab (FR37a)

**Given** the user clicks a collapsed sub-agent bubble (FR37)
**When** it expands inline
**Then** a summary of the sub-agent conversation is displayed
**And** the [↗] button remains visible for opening in dedicated tab
**And** clicking the header collapses it back

**Given** a sub-agent is opened in a dedicated tab (FR37c, FR37d)
**When** the tab is displayed
**Then** the tab has a purple-tinted background (CSS class .tab--subagent)
**And** the tab label format is "{agentType}-{shortId}" (e.g., "Explore-a8b2")
**And** the full sub-agent conversation is displayed with the same UI as main sessions

**Given** the user clicks a sub-agent event in the timeline (FR37b)
**When** the action completes
**Then** the sub-agent opens in a dedicated tab (not inline scroll)

---

### Story 2b.4: Navigation and Loading States

As a **user**,
I want **to navigate long conversations easily and see clear loading feedback**,
So that **I can find specific points in the conversation and know when Claude is working**.

**Acceptance Criteria:**

**Given** a conversation has many events (FR40)
**When** the right panel shows the Events tab
**Then** a navigation map displays one-line summaries for each event
**And** user events are right-aligned, system events are left-aligned
**And** clicking an event scrolls the conversation to that point (300ms ease-out)

**Given** the user sends a message and waits for response (FR41)
**When** Claude is processing
**Then** a non-persistent "thinking" indicator appears (animated dots or pulse)
**And** the indicator disappears when response starts streaming

**Given** the user sends a message to an inactive session (FR42)
**When** the CC child process is spawning
**Then** a "Loading Claude Code..." indicator appears
**And** the indicator shows subtle animation (fade pulse)
**And** the indicator transitions to thinking once connected

**Given** a sub-agent is currently running
**When** displayed in collapsed state
**Then** an animated `···` indicator shows activity
**And** status badge shows "Running"

---

### Story 2b.5: Rewind UI on User Messages

As a **user**,
I want **to rewind a conversation from any of my messages**,
So that **I can explore different conversation paths without losing history**.

**Acceptance Criteria:**

**Given** a user message bubble is displayed (not the first message) (FR67h)
**When** the user hovers over the message
**Then** a [↺] rewind icon appears in the top-right corner of the bubble

**Given** the first user message in a conversation
**When** the user hovers over it
**Then** no rewind icon appears (no prior checkpoint to rewind to)

**Given** the user clicks the [↺] rewind icon
**When** the modal opens
**Then** a "Rewind Conversation" modal appears with darkened overlay
**And** the modal contains a text area (auto-focused) for the new message
**And** Cancel and Send buttons are displayed

**Given** the rewind modal is open
**When** the user clicks outside the modal, presses Escape, or clicks Cancel
**Then** the modal closes without any action

**Given** the rewind modal is open with text entered
**When** the user clicks Send
**Then** the system calls `sessions:rewind` IPC with checkpoint UUID and new message
**And** a loading state appears on the Send button
**And** on success: modal closes, new forked session becomes active
**And** on error: error message displays in the modal

---

### Story 2b.6: Sub-Agent Tab Read-Only

As a **user** viewing a sub-agent conversation,
I want **a read-only view without chat input**,
So that **I understand this is a historical view, not an interactive session**.

**Acceptance Criteria:**

**Given** a sub-agent conversation is opened in a tab (FR67i)
**When** the tab type is `subagent`
**Then** the chat input area at the bottom is hidden completely
**And** the conversation view expands to fill the available space

**Given** a main session tab is active
**When** switching between main session and sub-agent tabs
**Then** the input area appears/disappears appropriately based on tab type

---

## Epic 2c: Session Info & Timeline

### Story 2c.1: Right Panel with Tab Views

As a **user**,
I want **a right panel with switchable views**,
So that **I can access session info, event timeline, or file tree based on my current need**.

**Acceptance Criteria:**

**Given** the user is viewing a conversation (FR43a)
**When** the right panel is visible
**Then** the topbar shows tabs: [Info] [Events] [Files]
**And** the door button [🚪] is on the right side of the topbar
**And** clicking a tab switches the panel content

**Given** the user is viewing a file (FR43b)
**When** the right panel is visible
**Then** the Files tab is auto-selected
**And** the panel shows file edit history for that file

**Given** the folder tree view is active (FR43c)
**When** the right panel is visible
**Then** the Files tab shows the folder tree of the session's project

**Given** the user clicks the door button
**When** the panel collapses
**Then** the panel slides closed (200ms ease-out)
**And** the door button remains accessible in the middle panel topbar
**And** clicking again reopens the panel

---

### Story 2c.2: Session Info View

As a **user**,
I want **to see detailed metadata about the current session**,
So that **I can understand the session's context, duration, and resource usage**.

**Acceptance Criteria:**

**Given** the Info tab is selected (FR43)
**When** a session is loaded
**Then** the following metadata is displayed:
- Session ID
- Folder path (clickable to reveal in Finder)
- Created date/time
- Last updated date/time
- Session duration (calculated from first to last message)

**Given** token usage data is available from session_metadata table (FR44, FR67e)
**When** displayed in the Info view
**Then** total input tokens are shown (format: "12.5k in")
**And** total output tokens are shown (format: "8.2k out")
**And** estimated cost is shown (format: "Est. Cost: $0.42")
**And** the model name is displayed if available

**Given** a session is streaming and metadata updates (FR67e)
**When** the Info view is open
**Then** token counts and cost update in real-time as the stream progresses

**Given** per-message token data is available from CC (FR45)
**When** the user views the Info panel
**Then** a breakdown of token consumption per message is available
**And** displayed as a collapsible section

**Given** additional metadata exists in CC session files (FR46)
**When** the Info view loads
**Then** all available metadata is displayed in a structured format
**And** unknown fields are shown in a "Raw Metadata" collapsible section

---

### Story 2c.3: Event Timeline View

As a **user**,
I want **a condensed timeline of all events in the session**,
So that **I can quickly scan what happened and jump to any point in the conversation**.

**Acceptance Criteria:**

**Given** the Events tab is selected
**When** the timeline loads
**Then** events are displayed as chat-style bubbles (UX9)
**And** no icons are shown (per design decision - text is sufficient)
**And** user events are right-aligned
**And** system events (Claude, tools, sub-agents) are left-aligned

**Given** an event is displayed in the timeline
**When** viewing the event bubble
**Then** a one-line summary is shown (e.g., "Read routes/index.ts", "I need to refactor...")
**And** token count is displayed like a timestamp (e.g., "3.4k")
**And** timestamp is shown below the bubble

**Given** a sub-agent event appears in the timeline
**When** displayed
**Then** it shows agent type + short ID (e.g., "Explore-a8b2")
**And** purple-tinted background matches sub-agent bubble styling
**And** clicking opens sub-agent in dedicated tab (not inline scroll)

**Given** the user clicks a non-sub-agent event in the timeline
**When** the click is registered
**Then** the conversation view scrolls smoothly (300ms ease-out) to that event
**And** the event is briefly highlighted in the conversation
**And** the timeline item shows active/selected state

**Given** the user scrolls the conversation manually
**When** the scroll position changes
**Then** the corresponding event in the timeline is highlighted
**And** the timeline auto-scrolls to keep the active event visible

---

## Epic 3a: Chat Input & Basic Send

### Story 3a.1: Chat Input Component

As a **user**,
I want **a chat input area to compose and send messages**,
So that **I can communicate with Claude Code naturally**.

**Acceptance Criteria:**

**Given** a session is open in the middle panel (FR47)
**When** the conversation view loads
**Then** a chat input area is displayed at the bottom
**And** the input has a send button [→] on the right
**And** the input auto-expands as text is entered (up to max height)

**Given** a new session is opened (UX11)
**When** the session tab becomes active
**Then** the input box is automatically focused (zero-click principle)
**And** the user can start typing immediately

**Given** an existing session is selected
**When** the session loads
**Then** the input is NOT auto-focused (user must click to engage)
**And** the conversation scrolls to the latest message

**Given** the user is typing in the input (FR48)
**When** they press Shift+Enter
**Then** a new line is inserted
**And** the input expands to accommodate multiple lines

**Given** the user is typing in the input
**When** they press Enter (without Shift)
**Then** the message is sent
**And** the input is cleared

**Given** a session has been started (has messages) (FR60)
**When** the input is empty
**Then** the placeholder text shows "Type anything to continue..."

**Given** a new session (no messages)
**When** the input is empty
**Then** the placeholder text shows "Type your message..."

---

### Story 3a.2: Message Send Flow

As a **user**,
I want **my messages to be sent and persisted reliably**,
So that **I never lose my input even if something goes wrong**.

**Acceptance Criteria:**

**Given** the user types in a new session (no UUID yet) (FR52)
**When** they send the first message
**Then** a Session UUID is generated before CC spawn
**And** the session is created in the database with this UUID

**Given** the user sends a message (FR49)
**When** the send action triggers
**Then** the user message appears immediately in the conversation
**And** the message is persisted to the session
**And** the CC child process spawn is initiated

**Given** the user can interact with any session (FR51)
**When** selecting a historical session and typing
**Then** the message is sent to resume that session
**And** the conversation continues seamlessly

**Given** the CC spawn fails (FR53)
**When** an error occurs
**Then** the user's message is still saved in the session
**And** an error message is displayed in the conversation
**And** the user can retry by sending another message

**Given** a message is sent successfully
**When** waiting for response
**Then** the thinking indicator appears
**And** the send button is disabled until response completes or user aborts

---

### Story 3a.3: Response Streaming Display

As a **user**,
I want **to see Claude's responses appear in real-time**,
So that **I can follow along as Claude thinks and responds**.

**Acceptance Criteria:**

**Given** CC is generating a response (FR50)
**When** tokens stream in
**Then** the response appears character-by-character in a Claude message bubble
**And** a cursor blink animation indicates active streaming
**And** the bubble grows as content is added

**Given** response is streaming
**When** content extends beyond the visible area
**Then** the conversation auto-scrolls smoothly to show new content
**And** scrolling is not jarring or jumpy

**Given** the user manually scrolls up during streaming
**When** they are reading earlier content
**Then** auto-scroll pauses to not interrupt reading
**And** a "Jump to latest" indicator appears
**And** clicking the indicator resumes auto-scroll

**Given** streaming completes
**When** the final token arrives
**Then** the cursor animation stops
**And** the message bubble shows complete state
**And** the input box is re-enabled for next message

---

### Story 3a.4: Abort and Resume

As a **user**,
I want **to abort a running process and resume later**,
So that **I can stop unwanted operations and continue when ready**.

**Acceptance Criteria:**

**Given** CC is processing a request (FR57)
**When** the user clicks the abort button (or presses Escape)
**Then** the running CC process is terminated
**And** streaming stops immediately

**Given** a process is aborted (FR58)
**When** the abort completes
**Then** an "Aborted" message is displayed in the conversation
**And** the message has distinct styling (muted, italic)
**And** the session state transitions to Idle

**Given** a session was aborted (FR59)
**When** the user types a new message
**Then** the session resumes normally
**And** a new CC process spawns with the session ID
**And** conversation continues from where it was aborted

**Given** the abort button is displayed
**When** no process is running
**Then** the abort button is hidden or disabled
**And** the send button is shown instead

---

## Epic 3b: CC Integration & Instance Management

### Story 3b.1: CC Child Process Spawning

As a **user**,
I want **Grimoire to spawn Claude Code processes correctly**,
So that **my sessions work seamlessly with proper isolation and continuity**.

**Acceptance Criteria:**

**Given** the user sends a message to a session (FR61)
**When** CC needs to be spawned
**Then** the child process is created with CLAUDE_CONFIG_DIR environment variable set
**And** CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=1 is set for rewind support
**And** this provides isolation from other CC instances

**Given** a session has an existing ID (FR62, FR66)
**When** spawning CC for that session
**Then** the --resume argument is passed with the session UUID
**And** CC resumes the existing conversation

**Given** the user sends a message (FR63)
**When** CC is spawned
**Then** the spawn uses `-p --input-format stream-json --output-format stream-json --verbose --replay-user-messages --dangerously-skip-permissions`
**And** the user message is sent via stdin as JSON (not CLI argument)
**And** stdin is closed after sending the message

**Given** CC is spawned (FR56, FR65)
**When** the process starts
**Then** the session ID is captured from the stream init message (FR67c)
**And** the session ID is mapped to the child process in the registry
**And** the mapping enables tracking which process belongs to which session

---

### Story 3b.2: NDJSON Stream Parser

As a **user**,
I want **CC output to be parsed and displayed in real-time**,
So that **I see properly formatted messages, tool calls, and results as they stream**.

**Acceptance Criteria:**

**Given** CC is running and producing output (FR64)
**When** NDJSON events arrive on stdout
**Then** each line is parsed as a JSON object in real-time
**And** events are processed based on their type (system, user, assistant, result)

**Given** the first message arrives (type: system, subtype: init) (FR67c)
**When** the init event is received
**Then** the session_id is captured from the message
**And** the session is associated with this ID (no file reading needed)

**Given** user messages arrive with --replay-user-messages (FR67d)
**When** a user message event is received
**Then** the uuid field is captured as a checkpoint/rewind point
**And** checkpoints are stored for potential rewind operations

**Given** assistant messages are streaming
**When** assistant content events arrive
**Then** the UI updates incrementally as content arrives
**And** tool calls are displayed as they execute

**Given** cost/token data is included in the stream (FR67e)
**When** costUSD or token fields are present
**Then** the metadata is captured and stored to session_metadata table
**And** the info panel can display cumulative totals

**Given** the stream ends with a result message
**When** the result event (subtype: success) arrives
**Then** the session returns to Idle state
**And** no file reading is needed (all data came from stream)

**Given** the unified conversation loader is used (FR67a)
**When** loading conversation data at startup sync
**Then** the same loader handles both main sessions and sub-agent conversations
**And** conversation type is determined from file path structure (FR67b)
**And** file reading is only used during startup sync, not during active sessions

---

### Story 3b.3: Instance State Machine

As a **user**,
I want **clear feedback about what CC is doing**,
So that **I understand the session state and can act accordingly**.

**Acceptance Criteria:**

**Given** the 3-state instance machine (AR15)
**When** a session instance changes state
**Then** transitions follow: Idle → Working → Idle (normal flow)
**And** Error state can be reached from Working: Idle → Working → Error → Idle

**Given** the user sends a message (FR55)
**When** the message is sent
**Then** a new CC child process is spawned
**And** the session transitions to Working state
**And** the UI shows green indicator with animation

**Given** CC completes processing
**When** the response is fully received
**Then** the child process exits naturally
**And** the session transitions to Idle state
**And** no idle process remains running

**Given** CC fails to spawn (FR67)
**When** an error occurs
**Then** the session transitions to Error state
**And** an actionable error message is displayed in the conversation
**And** the error includes a retry option
**And** the session returns to Idle after error is acknowledged

---

### Story 3b.4: Request-Response Process Model

As a **user**,
I want **each message to spawn a fresh process that exits after response**,
So that **system resources are used efficiently without idle processes**.

**Acceptance Criteria:**

**Given** the user sends a message (FR55)
**When** the send action triggers
**Then** a new CC child process spawns
**And** the process runs to completion
**And** the process exits naturally after response
**And** no idle process remains running

**Given** a CC process completes
**When** the response is fully received
**Then** the session returns to Idle state
**And** no timeout management is needed
**And** the next message will spawn a fresh process

**Given** the user wants to continue a session
**When** they type and send a new message
**Then** a fresh CC process spawns with the session ID
**And** CC resumes the conversation context automatically
**And** the response streams back normally

---

## Epic 4: Application Lifecycle & Persistence

### Story 4.1: Loading Screen and Startup Verification

As a **user**,
I want **Grimoire to start reliably with clear feedback**,
So that **I know the app is loading and any issues are clearly communicated**.

**Acceptance Criteria:**

**Given** the user launches Grimoire (FR8)
**When** the app starts
**Then** a loading screen appears with the Grimoire logo
**And** startup progress is indicated (subtle animation)

**Given** the app is starting (FR9)
**When** verifying Claude Code installation
**Then** the system checks if `claude` command is available
**And** if not found, an error modal appears with installation instructions

**Given** the app is starting (FR10, FR11)
**When** verifying CLAUDE_CONFIG_DIR configuration
**Then** the system checks if the directory exists and is writable
**And** if setup fails, a modal error appears with quit/retry options

**Given** the app is starting (FR12)
**When** verifying authentication
**Then** the system checks if CC credentials are valid
**And** if auth fails, a modal appears with instructions to authenticate

**Given** all verifications pass
**When** startup completes
**Then** the loading screen transitions to the main UI
**And** total startup time is < 3 seconds (NFR1)

---

### Story 4.2: Offline Mode and Status Indication

As a **user**,
I want **to use Grimoire offline for browsing history**,
So that **I can review past sessions even without internet**.

**Acceptance Criteria:**

**Given** the user has no internet connection (FR13)
**When** using Grimoire
**Then** read-only operations work (browse sessions, view conversations)
**And** attempting to send messages shows appropriate error

**Given** network status changes (FR14)
**When** going online or offline
**Then** a status indicator updates in the UI (subtle, non-intrusive)
**And** the indicator shows current connectivity state

**Given** the user is offline
**When** trying to spawn CC
**Then** a clear message explains that internet is required
**And** the message suggests checking connectivity

---

### Story 4.3: Update Checking

As a **user**,
I want **to be notified of updates without interruption**,
So that **I can keep Grimoire current when convenient**.

**Acceptance Criteria:**

**Given** the app launches (FR15)
**When** checking for updates
**Then** a background check occurs without blocking the UI
**And** if an update is available, a non-modal notification appears

**Given** an update is available (FR16)
**When** the notification is shown
**Then** the user can choose: "Update Now", "Skip This Version", or "Remind Me Later"
**And** "Update Now" downloads and installs the update
**And** "Skip This Version" ignores this specific version permanently
**And** "Remind Me Later" dismisses and checks again next launch

---

### Story 4.4: State Persistence and Restoration

As a **user**,
I want **Grimoire to remember my workspace state**,
So that **I can continue exactly where I left off**.

**Acceptance Criteria:**

**Given** the user has preferences and state (FR17)
**When** quitting the app
**Then** preferences are saved (panel sizes, settings)
**And** open tabs are saved
**And** window position and size are saved

**Given** the app starts (NFR10, NFR12, NFR13)
**When** loading persisted state
**Then** the window restores to previous position/size
**And** previously open tabs are restored
**And** the last active tab is focused

**Given** the app crashed previously
**When** restarting
**Then** the app restores to last known good state
**And** no data is lost (NFR8)
**And** a subtle notification indicates recovery if applicable

---

### Story 4.5: DB-First Startup with Background Sync

As a **user**,
I want **fast session list loading**,
So that **I can start working immediately without waiting for folder scans**.

**Acceptance Criteria:**

**Given** the app starts (FR17a)
**When** loading the session list
**Then** the database is queried first for immediate display
**And** sessions appear within milliseconds

**Given** the database has loaded (FR17b)
**When** startup continues
**Then** CLAUDE_CONFIG_DIR folder is scanned in background
**And** this scan does not block the UI

**Given** background scan completes (FR17c)
**When** new sessions are discovered that aren't in the database
**Then** a notification appears: "X new sessions found"
**And** the notification is non-intrusive

**Given** new sessions were discovered (FR17d)
**When** the user clicks the notification or sync action
**Then** discovered sessions are added to the database
**And** the session list updates to include them

---

### Story 4.6: Default Startup State

As a **user**,
I want **Grimoire to be ready for work immediately on launch**,
So that **I can start a new session with zero friction**.

**Acceptance Criteria:**

**Given** the app launches successfully (FR18)
**When** the main UI appears
**Then** a new session tab is open by default
**And** the cursor is in the input box (zero-click)
**And** the user can start typing immediately

**Given** the user has configured startup preferences (FR19)
**When** specifying a default plugin/view
**Then** that plugin's view is shown on startup instead
**And** the setting is accessible in Settings > General

---

## Epic 5a: Folder Hierarchy

### Story 5a.1: Folder Selection for New Sessions

As a **user**,
I want **to associate sessions with project folders**,
So that **my sessions are organized by project context**.

**Acceptance Criteria:**

**Given** the user creates a new session from within the app (FR68)
**When** initiating the new session
**Then** a folder picker dialog appears
**And** the user must select a folder before proceeding
**And** the session is associated with the selected folder path

**Given** the user launches Grimoire via CLI with a path (FR69)
**When** running `grimoire <path>` or from OS context menu
**Then** the folder is implicitly set to the provided path
**And** no folder picker appears
**And** new sessions use this folder automatically

---

### Story 5a.2: Folder Hierarchy View

As a **user**,
I want **to see my session folders in a tree structure**,
So that **I can navigate my projects hierarchically**.

**Acceptance Criteria:**

**Given** the user switches to Folders view in the left panel (FR70)
**When** the view loads
**Then** folders containing sessions are displayed as a tree
**And** the tree shows the folder hierarchy structure

**Given** a folder has subfolders with sessions (FR71)
**When** viewing the hierarchy
**Then** a chevron [▶] indicates expandable folders
**And** clicking the chevron expands to show nested folders
**And** clicking again collapses the folder

**Given** folders are displayed (FR72)
**When** viewing a folder item
**Then** a session count badge shows (direct + recursive count)
**And** format is "(12)" showing total sessions in that subtree

**Given** the user clicks a folder name (FR73)
**When** the click is registered
**Then** the session list filters to show only sessions in that folder
**And** the folder shows active/selected styling

---

### Story 5a.3: Folder Path Display and Orphaned Warnings

As a **user**,
I want **to see folder context and be warned about missing folders**,
So that **I understand where sessions belong and can fix broken references**.

**Acceptance Criteria:**

**Given** sessions are displayed in the list (FR74)
**When** viewing a session item
**Then** the folder path is displayed below the session name
**And** the path is shown in muted text

**Given** a session's folder no longer exists on disk (FR75)
**When** displayed in the session list
**Then** a ⚠️ warning icon appears next to the session
**And** the folder path shows red tint

**Given** a folder in the hierarchy no longer exists (FR76)
**When** displayed in the folder tree
**Then** a ⚠️ warning icon replaces the folder icon
**And** the folder shows red tint styling

**Given** an orphaned folder is selected (FR77)
**When** the user opens the context menu
**Then** a "Relocate folder" option is available
**And** clicking opens a folder picker to select new location
**And** all sessions are updated to the new folder path

---

## Epic 5b: File Tree & Change Indicators

### Story 5b.1: Project File Tree

As a **user**,
I want **to browse the project files for the current session**,
So that **I can see the codebase structure and navigate to files**.

**Acceptance Criteria:**

**Given** a session is loaded (FR78)
**When** the Files tab is selected in the right panel
**Then** the full file tree of the session's folder is displayed
**And** the tree shows files and folders hierarchically

**Given** the project has a .gitignore file (FR79)
**When** building the file tree
**Then** ignored patterns are respected (node_modules, dist, .git, etc.)
**And** ignored files/folders are not shown in the tree

**Given** the file tree is displayed (FR80)
**When** viewing folders
**Then** chevrons indicate expandable folders
**And** clicking expands/collapses the folder contents

**Given** the file tree header (FR81)
**When** viewing the Files panel
**Then** "Collapse All" [⊟] button collapses all folder nodes
**And** "Expand All" [⊞] button expands all folder nodes

---

### Story 5b.2: File Preview and Change Indicators

As a **user**,
I want **to preview files and see which ones the AI modified**,
So that **I can quickly review AI changes in context**.

**Acceptance Criteria:**

**Given** the file tree is displayed (FR82)
**When** the user clicks a file
**Then** a file preview opens in a new tab in the middle panel
**And** the file content is displayed with syntax highlighting

**Given** the AI modified files in this session (FR83)
**When** viewing the file tree
**Then** modified files show a change indicator (accent color badge)
**And** the badge shows the edit count (e.g., "2" for two edits)

**Given** a folder contains modified files (FR84)
**When** viewing the folder in the tree
**Then** the change indicator bubbles up to the parent folder
**And** parent shows sum of all descendant changes
**And** this continues up to the root

**Given** a file has changes
**When** hovering over the change indicator
**Then** a tooltip shows "X AI edits in this session"

---

## Epic 6: Search, Pinning & File Edit Tracking

### Story 6.1: Session and Folder Search

As a **user**,
I want **to quickly find sessions and folders by searching**,
So that **I can locate what I need without scrolling through long lists**.

**Acceptance Criteria:**

**Given** the session list is displayed (FR85)
**When** the user clicks the 🔍 icon in the panel header
**Then** an expandable search bar appears
**And** the input is auto-focused

**Given** the folder hierarchy is displayed (FR86)
**When** the user clicks the 🔍 icon
**Then** an expandable search bar appears for folder search

**Given** the user types in the search bar (FR87)
**When** characters are entered
**Then** the list filters instantly per keystroke (no debounce)
**And** matching items are shown, non-matching are hidden

**Given** search is active (FR88)
**When** searching
**Then** fuzzy matching works on: session name, folder path, session ID, git branch
**And** partial matches are included

**Given** the user enters comma-separated terms (FR89)
**When** searching (e.g., "dev,marketing")
**Then** OR logic is applied
**And** items matching any term are shown

**Given** the search bar is expanded (FR90)
**When** the user clicks outside or clicks 🔍 again
**Then** the search bar collapses
**And** if search text exists, filter is cleared
**And** full list is restored

---

### Story 6.2: Pinning Sessions and Folders

As a **user**,
I want **to pin my favorite sessions and folders**,
So that **I can access frequently used items quickly**.

**Acceptance Criteria:**

**Given** a session is displayed in the list (FR91)
**When** the user hovers over it
**Then** a 📌 pin icon appears (muted) on the left
**And** clicking the pin icon pins the session

**Given** a session is pinned
**When** viewing the session list
**Then** pinned sessions appear at the top of the list
**And** the pin icon is always visible (accent color)
**And** clicking again unpins the session

**Given** root folders in the hierarchy (FR92)
**When** hovering over a root folder
**Then** a 📌 pin icon appears
**And** nested folders cannot be pinned (only root level)

**Given** a folder is pinned
**When** viewing the folder hierarchy
**Then** pinned folders appear at the top
**And** the pin icon shows accent color

**Given** pin icons (FR93, FR94)
**When** not hovered and not pinned
**Then** the pin icon is hidden
**When** hovered and not pinned
**Then** the pin icon appears (muted)
**When** pinned
**Then** the pin icon is always visible (accent color)

---

### Story 6.3: File Edit Tracking

As a **user**,
I want **to see all AI edits to any file across all sessions**,
So that **I can understand the history of changes and trace back to the session that made them**.

**Acceptance Criteria:**

**Given** the AI makes file edits during a session (FR95)
**When** an Edit, Write, or NotebookEdit tool completes
**Then** the edit is tracked in the file_edits database table
**And** tracked data includes: file_path, session_id, timestamp, tool_type, line_start, line_end

**Given** a file is open in preview (FR96)
**When** the right panel shows the Files tab
**Then** file edit history is displayed instead of folder tree
**And** the view shows all edits to this specific file

**Given** file edit history is displayed (FR97)
**When** viewing the list
**Then** edits from ALL sessions that modified this file are shown
**And** edits are grouped by date (Today, Yesterday, Earlier)
**And** each edit shows: tool type, line range, session name, timestamp

**Given** an edit event in the history (FR98)
**When** the user clicks the event
**Then** the session that made the edit opens in a new tab
**And** the conversation scrolls to the tool call that made the edit

---

## Epic 7: Plugin System & Settings

### Story 7.1: Settings Dialog with Plugin List

As a **user**,
I want **to view and manage installed plugins**,
So that **I can customize which features are active in Grimoire**.

**Acceptance Criteria:**

**Given** the user opens Settings (FR20)
**When** navigating to the Plugins section
**Then** a list of installed plugins is displayed
**And** each plugin shows: name, description, enabled status

**Given** the plugin list is displayed (FR21)
**When** the user toggles a plugin's enabled switch
**Then** the plugin is enabled or disabled
**And** changes take effect on next app restart
**And** a note indicates restart may be required

**Given** system loads on startup (FR23)
**When** plugins are initialized
**Then** only enabled plugins are loaded
**And** disabled plugins are completely skipped

**Given** core plugins exist (FR24)
**When** viewing the plugin architecture
**Then** core plugins (Sessions) use the same structure as future community plugins
**And** the architecture supports future extensibility

---

### Story 7.2: Plugin-Specific Settings

As a **user**,
I want **to configure individual plugin settings**,
So that **I can customize each plugin's behavior to my preferences**.

**Acceptance Criteria:**

**Given** a plugin has configurable settings (FR22)
**When** the user clicks the settings gear icon for that plugin
**Then** a plugin-specific settings panel opens
**And** the panel shows all available settings for that plugin

**Given** the Sessions plugin settings
**When** viewing configuration options
**Then** available settings include:
- Sub-agent default view (Collapsed/Expanded)
- Tool call display (Summary/Full)
- Show token counts (On/Off)

**Given** plugin settings are changed
**When** the user modifies a value
**Then** changes are saved to the database
**And** changes apply immediately where possible
**And** changes requiring restart show a notification
