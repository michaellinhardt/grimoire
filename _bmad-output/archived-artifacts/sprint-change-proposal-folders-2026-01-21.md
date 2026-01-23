# Sprint Change Proposal: Folder-Session Integration

**Date:** 2026-01-21
**Author:** Teazyou (facilitated by Correct Course workflow)
**Status:** Pending Approval

---

## Section 1: Issue Summary

### Problem Statement

Claude Code sessions are immutably bound to directories. Sessions are stored at `~/.claude/projects/[encoded-path]/` with strict locality - a session created in one directory cannot be accessed from another. Grimoire's current design treats sessions as standalone entities without folder awareness.

### Discovery Context

This constraint was discovered during a brainstorming session researching Claude Code's session storage mechanics. Key findings documented in `_bmad-output/analysis/brainstorming-session-folders-2026-01-21.md`.

### Evidence

- **Session Storage:** `~/.claude/projects/[encoded-path]/sessions-index.json`
- **Path Encoding:** Simple `/` → `-` replacement
- **Canonical Reference:** `projectPath` field stores actual (unencoded) path
- **Strict Locality:** `claude --resume` shows NO sessions from other projects

### Impact Without Change

- No way to organize sessions by project/folder
- No folder tree view for file changes made by AI
- No cross-session file tracking (which sessions edited which files)
- Session list lacks context about where work happened
- Cannot leverage folder as natural organizing principle

---

## Section 2: Impact Analysis

### Epic Impact

**Status:** N/A - No epics exist yet. Changes will be incorporated when epics are created via `create-epics-and-stories` workflow.

### Story Impact

**Status:** N/A - No stories exist yet.

### Artifact Conflicts

#### PRD Impact

| Area                          | Impact Level | Change Required                                 |
| ----------------------------- | ------------ | ----------------------------------------------- |
| Session Management (FR25-32)  | Moderate     | Add folder path display, orphan warnings        |
| Session Creation (FR27)       | Moderate     | Require folder selection for in-app new session |
| Session Information (FR43-46) | Moderate     | Right panel context switching                   |
| New: Folder Management        | **Addition** | 10 new FRs (FR68-77)                            |
| New: Folder Tree              | **Addition** | 7 new FRs (FR78-84)                             |
| New: Search Feature           | **Addition** | 6 new FRs (FR85-90)                             |
| New: Pinning                  | **Addition** | 4 new FRs (FR91-94)                             |
| New: File Edit Tracking       | **Addition** | 4 new FRs (FR95-98)                             |

**Total:** 31 new functional requirements, 5 modified requirements

#### Architecture Impact

| Area                  | Impact Level | Change Required                                       |
| --------------------- | ------------ | ----------------------------------------------------- |
| Session data model    | Moderate     | Add `folder_path`, `is_pinned`, `last_accessed_at`    |
| Database schema       | Moderate     | Add `folders` table, `file_edits` table               |
| IPC channels          | Moderate     | Add 12 new channels for folder/search/file operations |
| Project structure     | Addition     | Add 12 new renderer components, 4 new main services   |
| TypeScript interfaces | Addition     | Add `Folder`, `FolderTreeNode`, `FileEdit` types      |

#### UX Design Impact

| Area                       | Impact Level | Change Required                                 |
| -------------------------- | ------------ | ----------------------------------------------- |
| Left Panel                 | Moderate     | Add Folders view toggle, folder hierarchy       |
| Right Panel                | Moderate     | Add Files tab (folder tree + file edit history) |
| Session List Item          | Minor        | Add folder path display, orphan warning         |
| New: Folder Hierarchy Item | **Addition** | New component                                   |
| New: Folder Tree           | **Addition** | New component                                   |
| New: Search Bar            | **Addition** | New component                                   |
| New: Pin Button            | **Addition** | New component                                   |
| New: File Edit History     | **Addition** | New component                                   |

### Technical Impact

- **Database Migration:** Schema version bump (1 → 2), adds 2 tables
- **File System:** Need to read `.gitignore` for folder tree filtering
- **Performance:** Folder tree load on session open (paths only, lazy content)
- **State Management:** 2 new Zustand stores (`useFolderStore`, `useSearchStore`)

---

## Section 3: Recommended Approach

### Selected Path: Direct Adjustment

Add new features to existing planning documents without restructuring. Folder features become part of core Sessions plugin functionality.

### Rationale

1. **Additive, not breaking:** All changes add capabilities without removing existing functionality
2. **Aligned with Phase 1:** Folder awareness improves session management, core to MVP value
3. **Low risk:** No architectural changes required, extends existing patterns
4. **Clear scope:** 7 brainstorming decisions map directly to specific FRs and components

### Effort Estimate

| Document     | Changes                               | Effort |
| ------------ | ------------------------------------- | ------ |
| PRD          | 31 new FRs, 5 modified                | Low    |
| Architecture | Schema + types + IPC + structure      | Medium |
| UX Design    | 5 new components, 2 modified sections | Medium |

**Overall:** Medium effort, localized to planning artifacts

### Risk Assessment

| Risk                                | Likelihood | Mitigation                                  |
| ----------------------------------- | ---------- | ------------------------------------------- |
| Scope creep during implementation   | Medium     | Clear FR boundaries, defer enhancements     |
| Performance with large folder trees | Low        | .gitignore filtering, lazy loading          |
| Orphan detection edge cases         | Low        | Graceful handling, user-actionable warnings |

### Timeline Impact

No timeline impact on existing plans. These features integrate into existing Sessions plugin scope.

---

## Section 4: Detailed Change Proposals

### 4.1 PRD Changes

#### New Section: Folder Management (FR68-77)

```markdown
### Folder Management

- FR68: System requires folder selection when creating new session from within app
- FR69: System uses implicit folder from CLI argument when launched via `grimoire <path>`
- FR70: User can view hierarchical folder tree in left panel
- FR71: User can expand/collapse folder nodes in hierarchy
- FR72: User can see session count on each folder in hierarchy
- FR73: User can click folder to filter session list
- FR74: User can see folder path below session name in session list
- FR75: System displays warning icon on orphaned sessions
- FR76: System displays warning icon on orphaned folders
- FR77: User can relocate orphaned folder
```

#### New Section: Folder Tree (FR78-84)

```markdown
### Folder Tree (Right Panel)

- FR78: User can view full file tree of active session's folder
- FR79: System respects .gitignore when building folder tree
- FR80: User can expand/collapse folders in file tree
- FR81: User can use "Collapse All" / "Expand All" buttons
- FR82: User can click any file to open file preview
- FR83: System displays change indicator on AI-modified files
- FR84: System bubbles up change indicators to parent folders
```

#### New Section: Search Feature (FR85-90)

```markdown
### Search Feature

- FR85: User can access expandable search bar in session list panel
- FR86: User can access expandable search bar in folder hierarchy panel
- FR87: System filters list instantly per keystroke
- FR88: System supports fuzzy matching on session/folder metadata
- FR89: System supports comma-separated terms as OR logic
- FR90: User can collapse search bar by clicking outside or icon
```

#### New Section: Pinning (FR91-94)

```markdown
### Pinning

- FR91: User can pin any session
- FR92: User can pin root folders only
- FR93: System reveals pin icon on hover
- FR94: User can toggle pin state by clicking pin icon
```

#### New Section: File Edit Tracking (FR95-98)

```markdown
### File Edit Tracking

- FR95: System tracks all AI file edits with metadata
- FR96: User can view file edit history in right panel when viewing file
- FR97: System displays file edits from all sessions (cross-session)
- FR98: User can click file edit event to open that session
```

#### Modified: Session Management (FR25-32)

- FR27: Add "(requires folder selection when initiated from within app)"
- FR29: Add "folder path" to metadata list
- FR29a (new): Folder path display in session list
- FR29b (new): Orphan warning on sessions

#### Modified: Session Information (FR43-46)

- FR43: Change to "context-dependent view"
- FR43a-c (new): Right panel shows session info / file events / folder tree based on context

### 4.2 Architecture Changes

#### Database Schema (Version 2)

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  folder_path TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_accessed_at INTEGER,
  archived INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0
);

CREATE TABLE folders (
  path TEXT PRIMARY KEY,
  is_pinned INTEGER DEFAULT 0,
  last_accessed_at INTEGER
);

CREATE TABLE file_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  tool_type TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

#### New IPC Channels

```typescript
// Request channels
'sessions:pin'
'sessions:relocateFolder'
'folders:list'
'folders:pin'
'folders:getTree'
'folders:exists'
'fileEdits:list'
'fileEdits:bySession'
'search:sessions'
'search:folders'

// Event channels
'instance:fileEdited'
'session:folderMissing'
'folder:changed'
```

#### New Components

**Renderer:**

- FolderHierarchy.tsx, FolderHierarchyItem.tsx
- FolderTree.tsx, FolderTreeNode.tsx
- FileEditHistory.tsx
- SearchBar.tsx
- PinButton.tsx
- OrphanWarning.tsx

**Main:**

- folder-service.ts
- folder-tree-builder.ts
- file-edit-tracker.ts
- search-service.ts

**Stores:**

- useFolderStore.ts
- useSearchStore.ts

### 4.3 UX Design Changes

#### Left Panel Structure

- Add Sessions/Folders view toggle in topbar
- Add expandable search bar
- Sessions view: Show folder path below session name
- Folders view: Hierarchical tree with session counts

#### Right Panel Structure

- Add "Files" tab alongside Info and Events
- Files tab shows: Folder tree (when viewing conversation) OR File edit history (when viewing file)

#### New Components

1. **Folder Hierarchy Item:** Tree node with chevron, folder icon, path, session count, pin support
2. **Folder Tree:** Obsidian-like file explorer with change indicators
3. **Search Bar:** Expandable inline search with instant filtering
4. **Pin Button:** Hover-reveal pin icon pattern
5. **File Edit History:** Timeline of AI edits to a file across sessions

---

## Section 5: Implementation Handoff

### Change Scope Classification

**Classification:** Minor-to-Moderate

- Can be implemented directly by development team
- No fundamental replan required
- Changes are additive to existing architecture

### Handoff Recipients

| Role                   | Responsibility                                  |
| ---------------------- | ----------------------------------------------- |
| Development Team       | Implement changes per this proposal             |
| Epic Creation Workflow | Incorporate folder features when creating epics |

### Implementation Sequence

1. **Update PRD** with new FRs (this proposal)
2. **Update Architecture** with schema, types, IPC, structure
3. **Update UX Design** with new components and panel structures
4. **Run create-epics-and-stories** to generate implementation epics

### Success Criteria

- [ ] PRD contains all 31 new FRs
- [ ] Architecture schema includes folders and file_edits tables
- [ ] UX Design documents all new component specifications
- [ ] Epic creation workflow picks up folder features

### Next Steps

1. Apply all changes to planning documents
2. Run `/bmad:bmm:workflows:create-epics-and-stories` to create implementation plan
3. Begin implementation per generated epics/stories

---

## Appendix: Source Document

All decisions in this proposal derive from:
`_bmad-output/analysis/brainstorming-session-folders-2026-01-21.md`

| Decision                                | Proposal Section                     |
| --------------------------------------- | ------------------------------------ |
| Decision 1: Folder Selection UX         | FR68-69                              |
| Decision 2: Data Model                  | Architecture schema                  |
| Decision 3: Right Panel Folder Tree     | FR78-84, Folder Tree component       |
| Decision 4: Left Panel Folder Hierarchy | FR70-77, Folder Hierarchy component  |
| Decision 5: Search Feature              | FR85-90, Search Bar component        |
| Decision 6: File History Tracking       | FR95-98, File Edit History component |
| Decision 7: Pinning Feature             | FR91-94, Pin Button component        |
