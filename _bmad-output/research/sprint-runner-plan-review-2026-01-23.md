# Sprint Runner Implementation Plan - Adversarial Review

**Date:** 2026-01-23
**Reviewer:** BMAD Master
**Document Reviewed:** sprint-runner-implementation-plan-2026-01-23.md

---

## 1. Summary

**Overall Assessment:** NEEDS CHANGES

**Issue Counts:**
- CRITICAL: 2
- HIGH: 4
- MEDIUM: 5
- LOW: 3

The implementation plan is generally well-structured and covers most requirements, but has several significant issues that would cause implementation failures or deviations from the requirements if not addressed.

---

## 2. Issues Found

### CRITICAL-1: Missing Tech Spec File Path in Prompts

**Severity:** CRITICAL
**Location:** Step 4 - prompts/tech-spec-review.md (line 608)
**Description:** The tech-spec-review.md prompt references `tech-spec-{{story_key}}.md` but the change request and current implementation use the naming convention `tech-spec-{story_key}.md` without the double braces in some places. More critically, the actual tech spec filename convention is not defined anywhere in the change request - this could lead to mismatched file references.
**Recommendation:** Verify the exact tech spec naming convention from the create-tech-spec workflow and ensure ALL prompts use consistent naming. The prompt shows `tech-spec-{{story_key}}.md` but the discovery prompt at line 569 also uses this - need to confirm this matches the actual create-tech-spec workflow output.

### CRITICAL-2: Parallel Execution Mechanism Undefined

**Severity:** CRITICAL
**Location:** Step 12 (C9) - lines 976-1103
**Description:** The plan uses `<parallel>` tags but admits in the Notes section (line 1419) that "The `<parallel>` tag is conceptual - implementation may use Task tool with multiple concurrent calls or similar mechanism depending on the runtime." This is a fundamental architectural decision that is NOT resolved. The change request assumes parallel execution is possible but the Task tool capability is not verified.
**Recommendation:** BEFORE implementing, verify Task tool supports concurrent spawning. If not, the entire parallel execution strategy must be redesigned. This is a blocker - do NOT proceed with C9 until parallel capability is confirmed. Alternative: Use sequential execution with discovery files generated FIRST, then passed to create step.

---

### HIGH-1: Discovery File Naming Inconsistency

**Severity:** HIGH
**Location:** Step 4 prompts vs Change Request
**Description:** The implementation plan uses `{story_key}-discovery-story.md` (with curly braces for variable) but the change request explicitly states (line 247): `2a.1-discovery-story.md` - using dot notation for story keys. The plan also shows `{{story_key}}` with double braces as template variables. Need to verify story key format (e.g., `2a.1` vs `2a-1`).
**Recommendation:** Clarify that story_key uses dot notation (e.g., `2a.1`) and update all examples to be consistent. Ensure shell scripts and prompts handle dots in filenames correctly.

### HIGH-2: Change 11 Lists Non-Existent File

**Severity:** HIGH
**Location:** Change Request line 261, Implementation Plan Step 7
**Description:** Change 11 in the requirements says review agents receive `{story_id}-discovery-project-level.md` but this file is NEVER generated anywhere. The implementation plan correctly generates `{story_id}-discovery-story.md` and `{story_id}-discovery-tech.md`, but the "project-level" discovery file does not exist. The plan handles this by injecting project-context.md INTO the discovery files, but this differs from the requirement.
**Recommendation:** Update the change request to reflect the actual implementation (project context injected into discovery files) OR clarify that `discovery-project-level.md` was renamed to the injection approach. The current plan is actually BETTER than the requirement, but this discrepancy should be documented.

### HIGH-3: Step Numbering Conflict

**Severity:** HIGH
**Location:** Step 9-14 vs Current instructions.md structure
**Description:** The current `instructions.md` has Step 0 for batch size, then Steps 1-6. The implementation plan adds a new Step 0 for project context, creating ambiguity. The plan also renumbers steps (2, 2b, 3, 3b, 4) which conflicts with the existing structure (Steps 1-6 in current instructions.md).
**Recommendation:** Create a complete step renumbering table showing:
- Current steps: 0 (batch), 1-6
- New steps: 0 (context+cleanup), 1 (init+select), 2/2b (create-story), 3/3b (create-tech-spec), 4 (dev+review), 5 (error recovery), 6 (batch tracking)

### HIGH-4: orchestrator.sh Doesn't Match CSV Format in Dashboard Context

**Severity:** HIGH
**Location:** Step 1 - orchestrator.sh (lines 73-90)
**Description:** The script outputs CSV but the implementation plan doesn't specify what happens to the EXISTING orchestrator.md content. The change request says "No header in file" but existing orchestrator.md files have markdown content. Running the script would append CSV to markdown, corrupting the file.
**Recommendation:** Add explicit instruction to:
1. Check if orchestrator.md exists with markdown content
2. If so, back it up as `orchestrator-backup-{timestamp}.md`
3. Create fresh orchestrator.md for CSV
4. OR: Use a different filename like `orchestrator.csv` to distinguish from legacy format

---

### MEDIUM-1: Missing Error Handling in Shell Scripts

**Severity:** MEDIUM
**Location:** Step 1-3 - All shell scripts
**Description:** Shell scripts lack `set -e` or error handling. If `stat` fails on both macOS and Linux syntax, the script continues silently.
**Recommendation:** Add:
```bash
set -e  # Exit on error
```
And explicit error handling for critical operations.

### MEDIUM-2: project-context-injection.sh Doesn't Verify Context File Age

**Severity:** MEDIUM
**Location:** Step 3 - project-context-injection.sh (lines 155-209)
**Description:** The script checks if project-context.md exists but doesn't verify it was generated AFTER the discovery file. Race condition: if project context is stale, it gets injected anyway.
**Recommendation:** Add timestamp check or document that Step 0 MUST complete before discovery phase runs.

### MEDIUM-3: Story Pairing Logic Incomplete

**Severity:** MEDIUM
**Location:** Step 13 (C10) - lines 1106-1221
**Description:** The pairing logic extracts epic from story key using example "2a.1" -> epic "2a", but doesn't handle edge cases:
- What if story key is "1-1-some-name"? (dash vs dot notation)
- What if first story is last of epic? (correctly handled)
- What if batch_size=1 but code still checks for second_story?
**Recommendation:** Add explicit parsing rule: "Epic is everything before the LAST dot or dash-separated segment" with examples:
- `2a.1` -> epic `2a`
- `1-1-login` -> epic `1`
- `1.2` -> epic `1`

### MEDIUM-4: Review Attempt Counter Scope Unclear

**Severity:** MEDIUM
**Location:** Step 12 (C9) - story_review_attempt, tech_spec_review_attempt
**Description:** The plan introduces separate review attempt counters but doesn't specify if they reset between stories in a paired batch. If processing 2a.1 and 2a.2, does story_review_attempt reset to 1 for each story or carry over?
**Recommendation:** Explicitly state: "Review attempt counters (story_review_attempt, tech_spec_review_attempt, review_attempt) are PER-STORY and reset to 1 at the start of each story's review phase."

### MEDIUM-5: Cleanup Logic May Delete In-Progress Work

**Severity:** MEDIUM
**Location:** Step 10 (C12) - lines 883-917
**Description:** The cleanup instruction says "Delete all completed story files" but relies on reading sprint-status.yaml for "done" status. If the yaml is corrupted or out of sync, cleanup could delete wrong files. Also, the condition "stories_completed == 0 AND this is first iteration" is vague.
**Recommendation:**
1. Define "first iteration" more precisely (e.g., `first_loop_iteration` boolean set once at Step 0)
2. Add safety: Only delete files older than 24 hours, or require explicit user confirmation for cleanup
3. Log ALL deleted files before deletion

---

### LOW-1: Model Routing Parameter Name Inconsistency

**Severity:** LOW
**Location:** Step 8 (C3) - line 819
**Description:** Uses `model_param = "haiku"` but the exact parameter name for Task tool is unverified. Should it be `model`, `model_name`, or `subagent_type`?
**Recommendation:** Verify Task tool parameter name. Current instructions.md uses `subagent_type="general-purpose"` (line 288).

### LOW-2: Missing Prompt File for generate-project-context

**Severity:** LOW
**Location:** Step 9 (C8) - lines 852-870
**Description:** Step 0 spawns a subagent for generate-project-context but this prompt is INLINE in the instructions.md modification, not extracted to a prompt file. Inconsistent with C2's goal of extracting all prompts.
**Recommendation:** Either:
1. Accept this as an exception (it's a setup step, not a main workflow)
2. Create `prompts/generate-project-context.md` for consistency

### LOW-3: Testing Strategy References Non-Existent Dashboard

**Severity:** LOW
**Location:** Part 4 Testing Strategy
**Description:** References "dashboard.html must be updated to parse CSV format" but this dashboard update is NOT part of the implementation plan. It's a dependency that could cause the CSV format to be useless if dashboard isn't updated.
**Recommendation:** Either:
1. Add dashboard update as a follow-up task
2. Include dashboard update in this implementation plan
3. Document that CSV format can be parsed by standard tools even without dashboard update

---

## 3. Completeness Matrix

| Change ID | Description | Fully Covered? | Notes |
|-----------|-------------|----------------|-------|
| **C1** | Restructure orchestrator.md for CSV | PARTIAL | Script is complete but migration from existing format not addressed |
| **C2** | Extract Subagent Prompts to Files | YES | All 8 files specified with full content |
| **C3** | Model Routing (Haiku for Reviews 2+) | YES | Annotations in prompts, logic in orchestrator |
| **C4** | Quality Gate Checklists | YES | Embedded in create-story.md and create-tech-spec.md |
| **C5** | Discovery File Generation | YES | Output requirements in prompts |
| **C6** | Project Context Refresh Script | YES | Full script provided |
| **C7** | Project Context Injection Script | YES | Full script provided |
| **C8** | Step 0 - Project Context Generation | YES | Substep 0a defined |
| **C9** | Parallel Creation + Discovery | PARTIAL | Depends on undefined parallel mechanism |
| **C10** | Story Pairing (2 Stories Per Cycle) | PARTIAL | Logic present but edge cases unclear |
| **C11** | Discovery File for Review Agents | PARTIAL | Project-level discovery file discrepancy |
| **C12** | Cleanup Before First Loop | YES | Substep 0b defined |
| **C13** | Early Exit on Repeated Errors | YES | Logic defined with error_history tracking |

**Coverage Summary:** 10/13 fully covered, 3/13 partially covered

---

## 4. Recommendations

### Before Implementation

1. **BLOCKER: Resolve parallel execution mechanism**
   - Verify Task tool supports concurrent calls
   - If not, redesign C9 to use sequential-then-pass pattern
   - Document the chosen approach in implementation plan

2. **Clarify step numbering**
   - Provide complete before/after step structure table
   - Ensure no step number collisions

3. **Address orchestrator.md migration**
   - Define what happens to existing markdown content
   - Add backup/migration logic to orchestrator.sh or Step 0

### During Implementation

4. **Add error handling to shell scripts**
   - `set -e` for fail-fast behavior
   - Explicit error messages for common failures

5. **Test story key parsing**
   - Verify epic extraction works for all naming conventions
   - Add explicit examples in Step 1 (story selection)

### After Implementation

6. **Update dashboard.html**
   - Either add to this plan or create follow-up task
   - CSV format is useless without parser

7. **Conduct integration test**
   - Run single story through new flow
   - Verify all discovery files created
   - Verify project context injection works
   - Verify Haiku routing activates on review 2+

---

## 5. Final Verdict

**VERDICT: NEEDS CHANGES**

The implementation plan is 75-80% ready for execution but has two CRITICAL issues that must be resolved before proceeding:

1. **Parallel execution mechanism is undefined** - Cannot implement C9 without knowing if Task tool supports concurrency
2. **Tech spec file naming needs verification** - Mismatched filenames will cause workflow failures

Additionally, the HIGH-severity issues around orchestrator.md migration and step numbering conflicts should be resolved to prevent confusion during implementation.

**Recommended Action:** Address CRITICAL-1 and CRITICAL-2, then HIGH-3 (step numbering) before beginning implementation. The remaining issues can be fixed during implementation.

---

**Review Completed:** 2026-01-23
**Reviewer:** BMAD Master (Adversarial Mode)
