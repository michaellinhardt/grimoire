---
stepsCompleted: [1, 2, 3]
inputDocuments: ['requests/03.brainstorm.folders.md']
session_topic: 'Full-scope folder-session integration for Grimoire'
session_goals: 'Comprehensive decisions on folder features for UI, architecture, edge cases - ready for course-change propagation'
selected_approach: 'AI-Recommended'
techniques_used: ['Constraint Mapping', 'Morphological Analysis', 'Custom Decision Protocol']
ideas_generated:
  [
    'Folder Selection UX',
    'Data Model',
    'Right Panel Folder Tree',
    'Left Panel Folder Hierarchy',
    'Session Filtering',
    'File History Tracking',
    'Pinning Feature'
  ]
context_file: 'requests/03.brainstorm.folders.md'
---

# Brainstorming Session Results

**Facilitator:** Teazyou
**Date:** 2026-01-21
**Topic:** Full-scope folder-session integration for Grimoire

## Executive Summary

This brainstorming session produced comprehensive decisions for integrating folder management into Grimoire. Claude Code ties sessions to directories, and Grimoire must embrace this model while providing superior UX for folder navigation, session organization, and file change tracking.

**Key Insight:** Sessions are immutably bound to folders (Claude Code design). Grimoire cannot have "floating" sessions - every session MUST have a folder.

---

## Research Findings: Claude Code Session/Folder Mechanics

**Key Findings from Sub-Agent Investigation:**

1. **Session Storage:** `~/.claude/projects/[encoded-path]/sessions-index.json` with JSONL conversation files
2. **Path Encoding:** Simple `/` → `-` replacement (e.g., `/Users/teazyou/dev/grimoire` → `-Users-teazyou-dev-grimoire`)
3. **Session Locality is STRICT:** Sessions bound to directories - `claude --resume` from different folder shows NO sessions from other projects
4. **Canonical Reference:** `projectPath` field in sessions-index.json stores the actual (unencoded) path
5. **Subagent Architecture:** Each subagent = separate JSONL under `/sessionId/subagents/agent-[id].jsonl`
6. **File History:** Per-session, keyed by content hash (not filename)

**Critical Edge Cases:**

- Session migration when moving projects requires manual `projectPath` update
- Unicode/non-ASCII paths may have normalization issues (NFD vs NFC on macOS)
- Forked sessions don't have explicit parent link in data

---

## Constraint Mapping

### Hard Constraints (Must Work With)

| Constraint                         | Source              | Impact                                              |
| ---------------------------------- | ------------------- | --------------------------------------------------- |
| Sessions bound to directories      | Claude Code design  | Cannot have "floating" sessions without folder      |
| Path encoding: `/` → `-`           | Claude Code storage | Must use same encoding or maintain mapping          |
| `sessions-index.json` is canonical | Claude Code         | Should read from this, not re-scan directories      |
| Must spawn CC in correct `cwd`     | Claude Code         | Folder path must be stored and used at spawn time   |
| `CLAUDE_CONFIG_DIR` isolation      | PRD requirement     | Each CC instance gets isolated config               |
| Sub-agents stored hierarchically   | Claude Code         | Must traverse `/sessionId/subagents/` for full tree |

### Soft Constraints (Flexible)

| Constraint                     | Source    | Flexibility                                     |
| ------------------------------ | --------- | ----------------------------------------------- |
| Grimoire's own session storage | PRD       | Can extend beyond CC's structure                |
| UI panel layout                | UX design | Left/right panel usage is design choice         |
| Folder selection timing        | UX design | Can be at session start, on-demand, or implicit |
| Filtering mechanism            | UX design | Fuzzy search, tree navigation, or both          |

### Opportunities (Constraints We Can Leverage)

| Opportunity                          | Source    | Potential                                                   |
| ------------------------------------ | --------- | ----------------------------------------------------------- |
| `projectPath` is canonical reference | CC data   | Can display clean paths, not encoded strings                |
| File history keyed by hash           | CC design | Can track renames without losing history                    |
| Sessions-index has rich metadata     | CC data   | Can show branch, message count, dates without parsing JSONL |
| Subagent paths are predictable       | CC design | Can build full conversation tree from file structure        |

---

## Decision Summary

### Decision 1: Folder Selection UX

**Decision:** Mandatory folder selection with entry-point awareness

| Entry Point                             | Behavior                                                            |
| --------------------------------------- | ------------------------------------------------------------------- |
| CLI `grimoire .`                        | Implicit folder from cwd, session starts immediately                |
| OS context menu "Open with Grimoire"    | Implicit folder from clicked path, session starts immediately       |
| In-app "New Session"                    | Shows folder picker first, THEN session starts                      |
| App opened directly (no folder context) | Shows session list, user must create new session with folder picker |

**Rationale:** Cannot have sessions without folders (Claude Code constraint). CLI/context menu users already "chose" their folder. In-app users need explicit selection.

---

### Decision 2: Data Model

**Decision:** Grimoire DB as primary + Claude Code as validation

**Data structure in Grimoire DB:**

```typescript
interface GrimoireSession {
  sessionId: string // UUID (generated by Grimoire or discovered from CC)
  folderPath: string // Canonical path (from CC's projectPath or user selection)
  createdAt: Date
  lastAccessedAt: Date
  isArchived: boolean
  isPinned: boolean // NEW: pinning feature
  uiState: object // Collapsed panels, scroll position, etc.
}
```

**Reconciliation rules:**

1. On startup: Load Grimoire DB → show sessions instantly (DB-first)
2. Background scan CC: For each CC session...
   - If session NOT in Grimoire DB → add as "discovered" (prompt user to sync)
   - If session IN Grimoire DB but `folderPath` differs → update to CC's `projectPath`
   - If session IN Grimoire DB but NOT in CC → mark as "orphaned"

**Moved folder handling:** If folder doesn't exist, Grimoire detects and offers "Relocate folder" action.

---

### Decision 3: Right Panel - Folder Tree

**Decision:** Full file tree with change indicators

**Design:**

- Full file tree with collapse/expand (like Obsidian)
- Global actions: "Collapse All" / "Expand All" buttons in panel header
- Respect `.gitignore` to avoid scanning `node_modules` etc.
- Load full tree structure on session open (paths only, not file contents)
- File content/preview loaded lazily on click

**Change indicators:**

- Files modified by AI show color change + edit count number
- Folders bubble up: if ANY descendant has changes, folder shows indicator
- No badge icon, just color + count

**Interactions:**
| Action | Result |
|--------|--------|
| Click folder | Toggle expand/collapse |
| Click any file | Open file preview in middle panel tab |
| Right-click file | Future: context menu |

---

### Decision 4: Left Panel - Folder Hierarchy

**Decision:** Hierarchical tree with collapsible roots and session counts

**Design:**

- Root folders = folders with sessions where no ancestor has sessions
- Each root is collapsible, showing subfolder tree when expanded
- Session counts shown at each level (direct + recursive)
- Sessions displayed with folder path below session name

**Session list display format:**

```
┌─────────────────────────┐
│ Session 1               │
│ /path/folder            │
├─────────────────────────┤
│ Session 2               │
│ ⚠️ /path/folder         │  ← folder doesn't exist (orphaned)
└─────────────────────────┘
```

**Orphaned folder handling:**

- Folder that no longer exists → red border + warning icon in folder tree
- Session whose folder doesn't exist → warning icon in session list

**Interactions:**
| Action | Result |
|--------|--------|
| Click folder chevron | Expand/collapse subfolder tree |
| Click folder name | Filter session list to this folder |
| Click session | Open session in middle panel |

---

### Decision 5: Search Feature

**Decision:** Unified expandable search bar with instant fuzzy filtering

**UX flow:**

1. Search icon (🔍) visible in panel header
2. Click icon → expands into search bar inline
3. Type keywords → instant filtering (per keystroke, no confirm)
4. Erase text → items reappear
5. Click outside or icon again → collapse search bar

**Search behavior:**
| Input | Matches |
|-------|---------|
| `grimoire` | Any metadata containing "grimoire" |
| `dev,marketing` | Metadata containing "dev" OR "marketing" (comma = OR) |
| `abc-123` | Session ID match |
| `/Users/tea` | Folder path match |

**Searchable fields:**
| Panel | Searchable fields |
|-------|-------------------|
| Session list | Session name/summary, folder path, session ID, git branch |
| Folder hierarchy | Folder path, session names within folder |

---

### Decision 6: File History Tracking

**Decision:** Track AI edits with cross-session visibility

**Visual indicator:**

- Color change + count number on file/folder (no badge icon)
- Same behavior on click whether modified or not (opens file preview)

**Right panel context switching:**

- When viewing a **conversation** → shows session info/events
- When viewing a **file** → shows file edit history (all AI edits)

**Cross-session tracking:**

- File edited by AI in Session A and Session B → both edits appear in file's event panel
- Click an edit event → opens the session that made that edit
- Possible because CC only runs through Grimoire (all edits tracked)

**Data structure:**

```typescript
interface FileEdit {
  filePath: string
  sessionId: string // Which session made this edit
  timestamp: Date
  toolType: 'Edit' | 'Write' | 'NotebookEdit'
  lineRange?: { start: number; end: number }
}
```

---

### Decision 7: Pinning Feature (NEW)

**Decision:** Pinnable items across three locations

| Location          | What can be pinned | Behavior                       |
| ----------------- | ------------------ | ------------------------------ |
| Session list      | Any session        | Pinned sessions at top of list |
| Folder hierarchy  | Root folders only  | Pinned folders at top of list  |
| Middle panel tabs | Any tab            | (Already in PRD)               |

**Pin UX:**

- Hover reveals pin icon (top-left of item)
- Click to toggle pin
- Pinned items stay at top of their respective lists

---

## Deferred Items (Not Decided)

| Item                             | Reason                                                      |
| -------------------------------- | ----------------------------------------------------------- |
| Folder Picker UI component       | Implementation detail - could be native OS dialog or custom |
| Unicode path normalization       | Needs technical investigation                               |
| Detailed file edit history UI/UX | To be refined during implementation                         |

---

## Impact on Existing PRD

This brainstorm introduces new features and modifications that need propagation:

**New Functional Requirements:**

- Folder selection mandatory on new session
- Folder path displayed in session list
- Left panel folder hierarchy view
- Right panel folder tree (separate from session info)
- Search feature for session list and folder hierarchy
- Pinning for sessions and root folders
- File change tracking with cross-session visibility
- Orphaned folder detection and warning

**Modified Functional Requirements:**

- FR25-32 (Session Management): Add folder path display, orphan warnings
- FR43-46 (Session Information): Right panel context switches between session info and file info
- Right panel: Now has multiple views (session info, folder tree, file events)

**New Non-Functional Requirements:**

- Performance: Full tree load with .gitignore respect
- Data integrity: Cross-session file edit tracking

---

## Next Steps

Use `/bmad:bmm:workflows:correct-course` to propagate these decisions to:

1. PRD - New functional requirements
2. Architecture - Data model changes, new components
3. UX Design - New panels, search UX, pinning UX
4. Epics & Stories - New feature stories
