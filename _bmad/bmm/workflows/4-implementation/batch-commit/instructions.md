# Batch Commit - Archive and Commit Completed Stories

<critical>This workflow archives completed artifacts and commits all story-related changes.</critical>
<critical>Operates with graceful degradation - commit what we can, log failures, never halt.</critical>

---

## Input Parameters

This workflow accepts:
- `story_ids`: Comma-separated list of story IDs (e.g., "3a-1,3a-2") - REQUIRED
- `epic_id`: Epic identifier (auto-derived from story_ids if not provided) - OPTIONAL

When invoked by sprint-runner, these are passed as subagent parameters.
When invoked standalone, parse from command arguments.

---

## Workflow Steps

<step n="1" goal="Initialize and parse parameters">
  <action>Log: "Starting batch-commit workflow"</action>

  <check if="story_ids provided">
    <action>Parse story_ids into list (split by comma, trim whitespace)</action>
    <action>Store: story_list = [parsed story IDs]</action>
  </check>

  <check if="story_ids NOT provided">
    <output>ERROR: story_ids parameter is required. Provide comma-separated story IDs.</output>
    <action>Exit workflow</action>
  </check>

  <check if="epic_id NOT provided">
    <action>Extract epic_id from first story_id (everything BEFORE last dash)</action>
    <comment>Example: "3a-1" -> epic "3a", "2b-3" -> epic "2b"</comment>

    <check if="multiple epics detected in story_list">
      <action>Collect unique epic prefixes</action>
      <action>Set epic_id = comma-joined epics (e.g., "3a,3b")</action>
    </check>
  </check>

  <action>Log: "Processing stories: [story_list], epic: [epic_id]"</action>
  <action>Go to Step 2</action>
</step>

<step n="2" goal="Archive completed artifacts">
  <action>Log: "Starting artifact archival phase"</action>

  <!-- Ensure archive directory exists -->
  <action>Check if {archived_artifacts}/ directory exists</action>
  <check if="directory missing">
    <action>Create directory: {archived_artifacts}/</action>
    <action>Log: "Created archive directory"</action>
  </check>

  <!-- Process each story -->
  <for-each story in="story_list">
    <action>Log: "Processing artifacts for story: [story]"</action>

    <!-- Find and archive story artifacts -->
    <action>Find files in {implementation_artifacts}/ matching patterns:</action>
    <patterns>
      - {story}.md (main story file)
      - {story}-*.md (associated artifacts like tech-specs)
    </patterns>

    <for-each file in="matched_files">
      <check if="file matches *-discovery-*.md pattern">
        <action>DELETE file (discovery files are intermediate, not archived)</action>
        <action>Log: "DELETED discovery file: [file]"</action>
      </check>

      <check else>
        <action>MOVE file to {archived_artifacts}/</action>
        <action>Log: "ARCHIVED: [file] -> {archived_artifacts}/"</action>
      </check>

      <on-error>
        <action>Log: "WARNING: Failed to process [file]: [error]"</action>
        <action>Continue to next file</action>
      </on-error>
    </for-each>
  </for-each>

  <!-- Clean up any remaining discovery files (safety sweep) -->
  <action>Find all *-discovery-*.md files in {implementation_artifacts}/</action>
  <for-each file in="discovery_files">
    <check if="file matches any story in story_list">
      <action>DELETE file</action>
      <action>Log: "DELETED remaining discovery file: [file]"</action>
    </check>
  </for-each>

  <action>Log: "Artifact archival phase complete"</action>
  <action>Go to Step 3</action>
</step>

<step n="3" goal="Stage files for commit">
  <action>Log: "Starting git staging phase"</action>

  <!-- Initialize tracking -->
  <action>Set staged_files = []</action>
  <action>Set staging_errors = []</action>

  <!-- Stage code files (all modified/untracked code) -->
  <action>Run: git status --porcelain</action>
  <action>Parse output for modified/untracked files</action>

  <for-each file in="git_status_files">
    <!-- Skip BMAD internal files that shouldn't be committed -->
    <check if="file is in {implementation_artifacts}/ AND NOT in {archived_artifacts}/">
      <action>Skip file (active implementation artifacts)</action>
      <action>Continue to next file</action>
    </check>

    <!-- Skip files that match .gitignore patterns -->
    <check if="file matches common ignore patterns (node_modules, venv, .git, etc.)">
      <action>Skip file</action>
      <action>Continue to next file</action>
    </check>

    <action>Run: git add "[file]"</action>

    <on-success>
      <action>Append file to staged_files</action>
    </on-success>

    <on-error>
      <action>Append "[file]: [error]" to staging_errors</action>
      <action>Log: "WARNING: Failed to stage [file]: [error]"</action>
      <action>Continue to next file</action>
    </on-error>
  </for-each>

  <!-- Stage archived artifacts -->
  <action>Run: git add "{archived_artifacts}/"</action>
  <on-error>
    <action>Log: "WARNING: Failed to stage archived artifacts: [error]"</action>
  </on-error>

  <!-- Stage sprint-runner log -->
  <action>Run: git add "{sprint_runner_log}"</action>
  <on-error>
    <action>Log: "WARNING: Failed to stage sprint-runner.csv: [error]"</action>
  </on-error>

  <!-- Check if anything was staged -->
  <action>Run: git diff --cached --name-only</action>

  <check if="no files staged">
    <action>Log: "WARNING: No files to commit. Skipping commit phase."</action>
    <action>Go to Step 5 (summary)</action>
  </check>

  <action>Log: "Staged [count] files for commit"</action>
  <action>Go to Step 4</action>
</step>

<step n="4" goal="Create git commit">
  <action>Log: "Starting commit phase"</action>

  <!-- Build commit message -->
  <action>Format story_ids for message (e.g., "3a-1, 3a-2")</action>

  <check if="single story in story_list">
    <action>Set commit_message = "feat({epic_id}): implement stories {story_id}"</action>
  </check>

  <check if="multiple stories in story_list">
    <action>Set commit_message = "feat({epic_id}): implement stories {story_id_1}, {story_id_2}"</action>
  </check>

  <!-- Execute commit -->
  <action>Run: git commit -m "{commit_message}"</action>

  <on-success>
    <action>Log: "Commit successful: {commit_message}"</action>
    <action>Run: git log --oneline -1 to capture commit hash</action>
    <action>Store: commit_hash = [result]</action>
  </on-success>

  <on-error>
    <action>Log: "ERROR: Git commit failed: [error]"</action>
    <action>Log: "Files remain staged for manual commit"</action>
    <action>Set commit_hash = "FAILED"</action>
  </on-error>

  <action>Go to Step 5</action>
</step>

<step n="5" goal="Generate summary">
  <action>Log: "Batch commit workflow complete"</action>

  <output>
**Batch Commit Summary**

Stories processed: {story_list}
Epic: {epic_id}

**Archival:**
- Files archived: [count]
- Discovery files deleted: [count]

**Git Commit:**
- Status: [SUCCESS/FAILED/SKIPPED]
- Commit: {commit_hash}
- Message: {commit_message}
- Files committed: [count]

**Warnings/Errors:**
{staging_errors if any, otherwise "None"}
  </output>
</step>

---

## Error Handling Philosophy

This workflow follows a "commit what we can" approach:

| Scenario | Response |
|----------|----------|
| No files to commit | Log warning, skip commit, report in summary |
| Git add fails for a file | Log error, skip file, continue with others |
| Git commit fails | Log error, leave files staged, end workflow |
| Archive directory missing | Create it, continue |
| File move fails | Log error, skip file, continue |

**Never leave the repository in an inconsistent state.**

---

## Commit Message Format

```
feat({epic_id}): implement stories {story_ids}

Examples:
- feat(3a): implement stories 3a-1, 3a-2
- feat(3a): implement stories 3a-3
- feat(3a,3b): implement stories 3a-4, 3b-1  (cross-epic, rare)
```

---

## Standalone Usage

When invoked directly (not from sprint-runner):

```
/batch-commit 3a-1,3a-2
/batch-commit 3a-3
```

The workflow will:
1. Parse story IDs from arguments
2. Auto-derive epic from story IDs
3. Execute archive and commit phases
4. Report summary

<critical>BEGIN: Parse parameters and start Step 1.</critical>
