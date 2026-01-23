# Change Request: Batch Commit Workflow

**Date:** 2026-01-24
**Requested By:** Teazyou
**Status:** Pending Implementation
**Priority:** High

---

## 1. Executive Summary

Refactor the sprint-runner workflow to relocate the cleanup phase from initialization (Step 0b) to end-of-cycle, and enhance it with automated git commit capabilities. This creates a unified "batch-commit" workflow that archives artifacts and commits all changes related to completed stories in a single atomic operation.

---

## 2. Current State Analysis

### 2.1 Sprint-Runner Architecture

The sprint-runner (`_bmad/bmm/workflows/4-implementation/sprint-runner/`) currently operates as follows:

```
Step 0: Initialize
  ├── 0a: Check/refresh project context
  ├── 0b: CLEANUP (first iteration only) ← TO BE RELOCATED
  └── 0c: Determine batch size (cycles)

Step 1: Select next 1-2 stories (same epic pairing)
Step 2: CREATE-STORY phase (parallel)
Step 2b: STORY-REVIEW phase (sequential)
Step 3: CREATE-TECH-SPEC phase (parallel)
Step 3b: TECH-SPEC-REVIEW phase (sequential)
Step 4: DEV + CODE-REVIEW phase (sequential per story)
Step 5: Error recovery
Step 6: Cycle tracking and next iteration
```

### 2.2 Current Cleanup Behavior (Step 0b)

- Runs ONLY on first iteration (`is_first_iteration` flag)
- Spawns BMAD Master subagent
- Deletes:
  - All `*-discovery-*.md` files
  - Completed story files (status = "done" in sprint-status.yaml)
  - Completed tech-spec files for done stories
- Preserves:
  - `sprint-status.yaml`
  - Files for stories NOT in "done" status
  - `sprint-runner.csv` (log file)

### 2.3 Problems with Current Approach

1. **No Git Commits**: Changes accumulate without version control checkpoints
2. **Cleanup Timing**: Cleaning at start means previous run's artifacts are lost before archival
3. **No Audit Trail**: Completed work is deleted without preservation
4. **Manual Commits Required**: User must manually commit after sprint-runner batches

---

## 3. Proposed Changes

### 3.1 New Workflow: batch-commit

**Location:** `_bmad/bmm/workflows/4-implementation/batch-commit/`

**Purpose:** Archive completed artifacts and commit all story-related changes after each cycle.

**Trigger Points:**
1. Automatically called by sprint-runner after Step 4 completes (end of each cycle)
2. Standalone invocation with story IDs as parameters

### 3.2 Workflow Phases

#### Phase 1: Archive Artifacts

| Action | Details |
|--------|---------|
| Source | `_bmad-output/implementation-artifacts/` |
| Destination | `_bmad-output/archived-artifacts/` |
| File Matching | By story ID pattern: `{story_id}*.md`, `{story_id}-*.md` |
| Discovery Files | DELETE (not archive) - intermediate files |

**Example for stories 3a-1, 3a-2:**
- Archive: `3a-1.md`, `3a-1-response-streaming-display.md`, `3a-2.md`, `3a-2-abort-resume.md`
- Delete: `3a-1-discovery-story.md`, `3a-1-discovery-tech.md`, `3a-2-discovery-story.md`, `3a-2-discovery-tech.md`

#### Phase 2: Git Commit

| Action | Details |
|--------|---------|
| Stage Code Files | All modified/untracked code files (trusting sprint-runner isolation) |
| Stage Artifacts | Archived artifact files matching story IDs |
| Stage Log | `./docs/sprint-runner.csv` |
| Commit Message | `feat({epic}): implement stories {story_1}, {story_2}` |

**Commit Message Examples:**
- Two stories: `feat(3a): implement stories 3a-1, 3a-2`
- Single story: `feat(3a): implement stories 3a-3`
- Cross-epic (edge case): `feat(3a,3b): implement stories 3a-4, 3b-1`

### 3.3 Sprint-Runner Modifications

#### Remove from Step 0b:
- Remove cleanup logic entirely
- Keep `is_first_iteration` flag for other purposes if needed, or remove

#### Add new Step 4c (after Step 4, before Step 5):

```xml
<step n="4c" goal="BATCH-COMMIT PHASE">
  <action>Log: "Starting batch-commit for completed stories"</action>

  <action>Collect story_keys from current cycle</action>
  <action>Extract epic_id from story_keys</action>

  <action>Spawn subagent with batch-commit workflow</action>
  <subagent-params>
    story_ids: [list of completed story IDs]
    epic_id: extracted epic identifier
  </subagent-params>

  <action>Wait for completion</action>
  <action>Log: "Batch-commit complete"</action>

  <action>Go to Step 5 (error recovery) or Step 6 (cycle tracking)</action>
</step>
```

### 3.4 Standalone Invocation

**Command:** `/bmad:bmm:workflows:batch-commit`

**Arguments:**
- `story_ids` (required): Comma-separated list of story IDs (e.g., "3a-1,3a-2")
- `epic_id` (optional): Auto-derived from story_ids if not provided

**Example Usage:**
```
/batch-commit 3a-1,3a-2
/batch-commit 3a-3
```

---

## 4. File Association Strategy

### 4.1 Code Files

**Strategy:** Commit ALL modified/untracked code-related files.

**Rationale:** Sprint-runner operates in isolation. All code changes during a cycle are attributable to the stories being processed.

**File Detection:**
```bash
git status --porcelain
```

**Exclusions (do not commit):**
- Files in `.git/`
- Files matching `.gitignore`
- Files in `node_modules/`, `venv/`, etc. (standard ignores)

### 4.2 Artifact Files

**Strategy:** Match by story ID pattern.

**Patterns for story `3a-1`:**
- `3a-1.md` (main story file)
- `3a-1-*.md` (associated artifacts like tech-specs)
- `*-3a-1-*.md` (prefixed artifacts)

### 4.3 Discovery Files

**Strategy:** Delete, do not archive or commit.

**Patterns:**
- `*-discovery-story.md`
- `*-discovery-tech.md`

---

## 5. Error Handling

### 5.1 Scenarios and Responses

| Scenario | Response |
|----------|----------|
| No files to commit | Log warning, skip commit, continue |
| Git add fails | Log error, attempt partial add, continue |
| Git commit fails | Log error, leave files staged, end workflow |
| One story blocked, one complete | Commit complete story's files only |
| Archive destination missing | Create directory, continue |
| File move fails | Log error, skip file, continue |

### 5.2 Graceful Degradation

The workflow follows a "commit what we can" philosophy:
1. Attempt all operations
2. Log failures but don't halt
3. Provide summary of what succeeded/failed
4. Never leave repo in inconsistent state

---

## 6. Integration Points

### 6.1 Sprint-Runner Integration

**Modified Files:**
- `_bmad/bmm/workflows/4-implementation/sprint-runner/instructions.md`

**Changes:**
1. Remove Step 0b cleanup logic
2. Add Step 4c batch-commit invocation
3. Update execution summary documentation

### 6.2 New Workflow Files

**Create:**
- `_bmad/bmm/workflows/4-implementation/batch-commit/workflow.yaml`
- `_bmad/bmm/workflows/4-implementation/batch-commit/instructions.md`
- `.claude/commands/bmad/bmm/workflows/batch-commit.md`

### 6.3 Manifest Updates

**Update:**
- `_bmad/_config/workflow-manifest.csv` (add batch-commit entry)

---

## 7. Success Criteria

1. **Automated Commits**: Each sprint-runner cycle produces a git commit
2. **Clean Artifacts**: Discovery files deleted, story artifacts archived
3. **Audit Trail**: Archived artifacts preserved in `archived-artifacts/`
4. **Standalone Usage**: Workflow callable independently with story IDs
5. **Graceful Failures**: Errors logged but don't halt execution
6. **Consistent Messages**: Commit messages follow `feat({epic}): implement stories {ids}` format

---

## 8. Testing Scenarios

### 8.1 Happy Path
- Run sprint-runner with 2 stories from same epic
- Verify artifacts archived
- Verify discovery files deleted
- Verify commit created with correct message
- Verify sprint-runner.csv included

### 8.2 Single Story
- Run sprint-runner with 1 story (last of epic)
- Verify single-story commit message format

### 8.3 Blocked Story
- One story completes, one blocked
- Verify only completed story's files committed

### 8.4 Standalone Invocation
- Call batch-commit directly with story IDs
- Verify same behavior as automated invocation

### 8.5 No Changes
- Run when no files modified
- Verify graceful skip (no empty commit)

---

## 9. Rollback Plan

If issues arise:
1. Revert sprint-runner to use Step 0b cleanup (restore from git)
2. Remove batch-commit workflow files
3. Remove manifest entry
4. Manual commits resume as before

---

## 10. Implementation Estimate

**Components:**
1. batch-commit workflow (instructions.md, workflow.yaml) - New
2. Sprint-runner modifications (instructions.md) - Edit
3. Claude command file (batch-commit.md) - New
4. Manifest update (workflow-manifest.csv) - Edit

**Dependencies:** None (self-contained within BMAD)

---

## Appendix A: Proposed Directory Structure

```
_bmad/bmm/workflows/4-implementation/
├── sprint-runner/
│   ├── instructions.md          # MODIFIED: Remove 0b, add 4c
│   ├── workflow.yaml
│   └── prompts/
│       └── ... (unchanged)
└── batch-commit/                 # NEW
    ├── instructions.md
    └── workflow.yaml

.claude/commands/bmad/bmm/workflows/
└── batch-commit.md              # NEW
```

## Appendix B: Commit Message Grammar

```
feat({epic_id}): implement stories {story_id_1}[, {story_id_2}]

Where:
- epic_id: Short epic identifier (e.g., "3a", "2b")
- story_id: Full story identifier (e.g., "3a-1", "3a-2")

Examples:
- feat(3a): implement stories 3a-1, 3a-2
- feat(3a): implement stories 3a-3
- feat(3a,3b): implement stories 3a-4, 3b-1  # rare cross-epic case
```
