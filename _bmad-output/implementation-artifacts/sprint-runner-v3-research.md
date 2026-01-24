# Sprint Runner v3 Optimization Research

## Executive Summary

This document analyzes the proposed sprint-runner v3 optimization approach against the current implementation. The v3 approach moves setup work from subagents to a Python orchestrator using `--prompt-system-append` to inject pre-computed context, reducing token waste and improving consistency.

**Key Finding:** The optimization is sound and well-architected. All 8 commands can be successfully adapted. However, there are additional optimizations beyond those mentioned, and several risks need mitigation.

---

## Part 1: Per-Command Analysis

### 1. SPRINT-CREATE-STORY

**Purpose:** Create story file from epic requirements (no project discovery in sprint mode)

**Current Workflow (BMAD create-story):**
```
Step 1: Determine target story (reads sprint-status.yaml)
Step 2: Load and analyze core artifacts (invoke discover_inputs protocol)
Step 3: Architecture analysis for developer guardrails
Step 4: Web research for latest technical specifics
Step 5: Create comprehensive story file
Step 6: Update sprint status and finalize
```

**Steps to REMOVE (will be injected):**
- Step 1: Story discovery from sprint-status.yaml (orchestrator provides story_keys)
- Step 2: Full discover_inputs protocol (discovery files injected via prompt-system)
- Step 3: Architecture analysis (injected)
- Step 4: Web research for tech details (pre-computed by orchestrator)
- Step 6: Sprint status update (orchestrator handles this)

**Steps to ADD (new sprint-runner requirements):**
- Add instruction: "Project context, epic files, and previous story intelligence have been pre-injected into your context. See `<file_injections>` section"
- Add instruction: "For multi-story batches (comma-separated story_keys), process each story sequentially and log start/end for each"
- Add instruction: "Output TECH-SPEC DECISION clearly: `[TECH-SPEC-DECISION: REQUIRED]` or `[TECH-SPEC-DECISION: SKIP]`"
- Add logging requirement using orchestrator.sh with task IDs: setup, analyze, generate, write, validate

**Specific Files/Context Needed for Injection:**
- Project-context.md (from planning-artifacts/)
- Epic file(s) containing target stories (identified by story_keys)
- Previous story file (if story_num > 1)
- Last 5 git commits (for pattern analysis)
- Architecture files (from architecture sharded directory)
- Web research results for critical libraries

**Reporting/Output Requirements:**
- TECH-SPEC-DECISION marker (critical for orchestrator parsing)
- Story file written to: `{implementation_artifacts}/sprint-{story_key}.md`
- All logging via orchestrator.sh with metrics (sections:N, lines:N, files:1)

**Risks:**
- Multi-story batching requires sequential processing with individual logging
- Tech-spec decision marker is critical--missing it causes orchestrator to default to REQUIRED
- Story file must not exist yet (backlog status)

---

### 2. SPRINT-CREATE-STORY-DISCOVERY

**Purpose:** Parallel discovery for story context (runs alongside create-story)

**Current State:** This is a VARIANT not in standard BMAD, created specifically for sprint-runner

**Relationship to BMAD:** No direct BMAD equivalent; uses create-story's discovery approach but isolated

**Steps to REMOVE:**
- N/A (new command structure)

**Steps to ADD:**
- Add instruction: "This runs in PARALLEL with sprint-create-story. Both complete, then results are merged"
- Add instruction: "Output discovery file to: `{implementation_artifacts}/sprint-{story_key}-discovery-story.md`"
- Add multi-story sequential processing requirement

**Specific Files/Context Needed:**
- Project-context.md (same as create-story)
- Story files from implementation-artifacts (the ones being created in parallel)
- Git repository structure and recent patterns

**Reporting/Output Requirements:**
- Discovery file path: `{implementation_artifacts}/sprint-{story_key}-discovery-story.md`
- Logging via orchestrator.sh with task IDs: setup, explore, write

**Additional Optimizations Discovered:**
- **Codebase mapping cache:** Pre-scan project structure and create a file/folder index for faster discovery
  - Pros: Significantly speeds up exploration phase
  - Cons: Index can become stale between runs
  - Risk: LOW
  - Recommendation: IMPLEMENT (index expires after 24h, regenerate if stale)

- **Pattern library:** Cache common code patterns by language/framework from git history
  - Pros: Reduces need to search codebase for patterns
  - Cons: Requires pattern extraction infrastructure
  - Risk: MEDIUM (pattern library accuracy)
  - Recommendation: SKIP for v3 (complex, can add in v4)

---

### 3. SPRINT-STORY-REVIEW

**Purpose:** Review story quality and completeness (blocking review before tech-spec phase)

**Current State:** Variant of code-review, adapted for story review (not adversarial)

**From BMAD:** Uses code-review's structure but different focus (stories not code)

**Steps to REMOVE:**
- Story creation logic
- Discovery file reading (injected)
- Epic requirement discovery

**Steps to ADD:**
- Add instruction: "Story and discovery files pre-injected in context. See `<file_injections>`"
- Add instruction: "Multi-story batching: review each story sequentially"
- Add instruction: "Output format: Critical issues found -> [CRITICAL-ISSUES-FOUND: YES/NO]"
- Add logging requirement for each story (sequential within batch)

**Specific Files/Context Needed:**
- Story files (for review batch)
- Discovery files (for story-discovery-story.md)
- Project context

**Reporting/Output Requirements:**
- CRITICAL-ISSUES-FOUND marker (determines if background review chain spawns)
- Logging with task IDs: setup, analyze, fix, validate
- Per-story logging (critical for batch tracking)

**Additional Optimizations Discovered:**
- **Review checklist injection:** Include context-specific checklist in prompt (architecture violations, security issues)
  - Pros: Ensures consistent review focus
  - Cons: Static checklist may miss context-specific issues
  - Risk: LOW
  - Recommendation: IMPLEMENT (checklist is already in instructions.xml, just inject it)

---

### 4. SPRINT-CREATE-TECH-SPEC

**Purpose:** Create technical specification for story (includes inline discovery)

**Current State:** Not in standard BMAD yet; conceptually similar to create-story but tech-focused

**Steps to REMOVE:**
- Full discovery phase (discovery files injected)
- Project context loading (injected)
- Architecture loading (injected)

**Steps to ADD:**
- Add instruction: "All context pre-injected. Perform INLINE discovery only as needed for technical decisions"
- Add instruction: "Multi-story sequential processing with individual logging"
- Add instruction: "Output tech-spec file to: `{implementation_artifacts}/sprint-tech-spec-{story_key}.md`"

**Specific Files/Context Needed:**
- Story file (to understand scope)
- Discovery file (technical details already found)
- Project context
- Architecture files

**Reporting/Output Requirements:**
- Tech-spec file path: `{implementation_artifacts}/sprint-tech-spec-{story_key}.md`
- Logging with task IDs: setup, discover, generate, write, validate
- Per-story logging for batch processing

---

### 5. SPRINT-TECH-SPEC-REVIEW

**Purpose:** Review tech-spec quality and completeness

**Current State:** Variant, similar to story-review but focused on technical specs

**Steps to REMOVE:**
- Tech-spec creation logic
- Discovery process (already complete)

**Steps to ADD:**
- Add instruction: "Tech-spec and story files pre-injected. Review for technical completeness"
- Add instruction: "Multi-story sequential processing"
- Add instruction: "Output: [CRITICAL-ISSUES-FOUND: YES/NO]"

**Specific Files/Context Needed:**
- Tech-spec files
- Story files
- Architecture files (for compliance checking)

**Reporting/Output Requirements:**
- CRITICAL-ISSUES-FOUND marker
- Logging with task IDs: setup, analyze, fix, validate

---

### 6. SPRINT-DEV-STORY

**Purpose:** Implement story code based on story and tech-spec (all context injected)

**From BMAD:** Adapts dev-story workflow

**Current dev-story steps:**
```
Step 1: Find next ready story and load it
Step 2: Load project context and story information
Step 3: Detect review continuation
Step 4: Mark story in-progress
Step 5: Implement task following red-green-refactor
Step 6-8: Author tests, run validations, mark task complete
Step 9: Story completion and mark for review
Step 10: Completion communication
```

**Steps to REMOVE:**
- Step 1: Story discovery (orchestrator provides story_key)
- Step 2: Project context loading (injected)
- Step 4: Sprint-status marking (orchestrator handles)

**Steps to ADD:**
- Add instruction: "All context pre-injected: story file, tech-spec, project context, discovery file. See `<file_injections>`"
- Add instruction: "Do NOT attempt to read files from disk--use injected content"
- Add instruction: "Log progress with orchestrator.sh using task IDs"

**Specific Files/Context Needed:**
- Story file
- Tech-spec file (if exists)
- Project context
- Discovery file
- Previous story file (for learnings)

**Reporting/Output Requirements:**
- Story status updated to "review" when complete
- Logging with task IDs: setup, implement, tests, lint, validate
- Dev Agent Record updated with implementation notes

---

### 7. SPRINT-CODE-REVIEW

**Purpose:** Code review with automatic fixes (up to 10 attempts per story)

**From BMAD:** Adapts code-review workflow (already adversarial)

**Current code-review steps:**
```
Step 1: Load story and discover changes
Step 2: Build review attack plan
Step 3: Execute adversarial review
Step 4: Present findings and fix them
Step 5: Update story status
```

**Steps to REMOVE:**
- Step 1 (git discovery part): Story and context already injected
- File discovery: Code changes are in the injected story files

**Steps to MODIFY:**
- Step 1: Skip file reading from disk, use injected story context
- Step 3: Still analyze git changes but with injected story context as baseline

**Steps to ADD:**
- Add instruction: "Story file and implementation context pre-injected. Focus on adversarial code review"
- Add instruction: "Log review attempts with attempt number in command field: code-review-{attempt_num}"
- Add instruction: "Output format: HIGHEST SEVERITY line + Issues count (orchestrator parses this)"

**Specific Files/Context Needed:**
- Story file (with Dev Agent Record -> File List showing actual files)
- Project context (coding standards)
- Architecture files (compliance checking)
- Previous code-review findings (from story file)

**Reporting/Output Requirements:**
- HIGHEST SEVERITY: {CRITICAL|HIGH|MEDIUM|LOW|ZERO ISSUES}
- Issues: X CRITICAL, X HIGH, X MEDIUM, X LOW
- Logging with attempt number: command="code-review-{review_attempt}"
- Story status updated to "done" only if ZERO ISSUES

**Additional Optimizations Discovered:**
- **Previous review findings injection:** Include past findings (from Review Follow-ups section) to prevent re-finding same issues
  - Pros: Focuses review on new issues, faster iterations
  - Cons: May miss variations of previous issues
  - Risk: LOW
  - Recommendation: IMPLEMENT (already tracked in story file, just inject it)

- **Model-specific tuning:** Use different prompt emphasis for Haiku vs default model
  - Pros: Optimize for each model's strengths
  - Cons: Requires testing to validate
  - Risk: MEDIUM
  - Recommendation: SKIP for v3 (can optimize later)

---

### 8. SPRINT-COMMIT

**Purpose:** Smart git commit by story IDs (NEW command, not in BMAD)

**Steps to IMPLEMENT:**
1. Run `git status` to find modified/staged files
2. Filter to files related to current batch story IDs (by filename pattern matching)
3. If file relation unclear, investigate file contents
4. Stage only related files
5. Commit with appropriate message
6. Archive completed story artifacts

**Specific Instructions:**
- Add instruction: "Story IDs for batch: {{story_ids}}"
- Add instruction: "Only commit files related to these stories"
- Add instruction: "Ignore unrelated changes--skip them"
- Add instruction: "Use commit message format: `feat({epic_id}): implement stories {story_ids}`"

**Specific Files/Context Needed:**
- Story file list (from dev-story phase)
- Git status output
- Project structure (to determine file relevance)

**Reporting/Output Requirements:**
- Commit hash or message confirmation
- Files committed count
- Logging with task IDs: setup, stage, commit, validate

**Additional Optimizations Discovered:**
- **File pattern optimization:** Pre-compute file->story mapping during discovery phase
  - Pros: sprint-commit can definitively match files instantly
  - Cons: Requires mapping data structure
  - Risk: LOW
  - Recommendation: IMPLEMENT (cache in story file's File List)

---

## Part 2: Additional Optimizations Discovered

### Optimization 1: Discovery File Caching

**Description:** Cache discovery results across multiple uses (story-discovery files reused in review and tech-spec phases)

**Pros:**
- Reduces redundant codebase exploration
- Faster context loading for reviews
- Consistent discovery across phases

**Cons:**
- Codebase may change between phases (low probability in same batch)
- Requires cache validation

**Risk Level:** LOW

**Recommendation:** IMPLEMENT
- Reuse discovery files from step 2 (create-story-discovery) in steps 3 and 4
- Inject same discovery files rather than regenerating

---

### Optimization 2: Epic File Index

**Description:** Pre-scan epic folder and create index of which stories are in which files

**Pros:**
- Faster epic discovery and loading
- Enables batch-level optimization decisions
- Reduces file I/O

**Cons:**
- Requires index maintenance
- Index can drift if epics updated

**Risk Level:** MEDIUM

**Recommendation:** SKIP for v3
- Too much infrastructure for current phase
- Can add as performance optimization in v4

---

### Optimization 3: Architecture Decision Cache

**Description:** Cache architecture analysis results (patterns, constraints, requirements) keyed by story type

**Pros:**
- Reduce redundant architecture review steps
- Faster story creation
- More consistent architecture compliance

**Cons:**
- Architecture changes make cache stale
- Requires cache invalidation strategy

**Risk Level:** MEDIUM

**Recommendation:** SKIP for v3
- Architecture tends to be stable within a sprint
- Can implement cache-with-TTL in v4

---

### Optimization 4: Web Research Pre-Computation

**Description:** Move web research from create-story to orchestrator setup phase

**Pros:**
- Single research pass for all stories in batch
- Reduced token waste (shared context)
- Better consistency across stories

**Cons:**
- Web research is slow (10-30s per technology)
- Batch might have 2-4 stories, 2-5 techs each = expensive
- Hard to parallelize web searches

**Risk Level:** MEDIUM

**Recommendation:** IMPLEMENT WITH CACHING
- Pre-compute for known critical libraries (from architecture)
- Cache results for 24h
- Only research new/changed libraries

---

### Optimization 5: Project Context Copy & Injection

**Description:** Copy project-context.md to sprint-project-context.md and inject consistently

**Pros:**
- Ensures all agents see identical context
- Prevents accidental project-context updates during sprint
- Enables sprint-specific context additions

**Cons:**
- Adds file duplication
- Requires sync logic

**Risk Level:** LOW

**Recommendation:** IMPLEMENT
- Orchestrator.copy_project_context() creates copy at sprint start
- All injections use sprint-project-context.md
- Original project-context.md remains read-only during sprint

---

### Optimization 6: Story File Injection Order

**Description:** Optimize injection order: critical context first, then story files

**Pros:**
- Agents can fail-fast if critical context missing
- Natural reading order (context -> task)
- Better token efficiency (context cached first)

**Cons:**
- Requires specific XML structure
- No actual performance difference

**Risk Level:** LOW

**Recommendation:** IMPLEMENT
- Order in prompt-system-append:
  1. Project context
  2. Architecture files
  3. Story files
  4. Discovery files
  5. Tech-spec files

---

### Optimization 7: Batch Status Tracking in Prompt

**Description:** Inject current batch status (how many stories done, how many remain) for context awareness

**Pros:**
- Agents understand progress
- Can optimize decisions based on batch state
- Better logging/messaging

**Cons:**
- Adds small amount to prompt size
- Requires orchestrator to compute

**Risk Level:** LOW

**Recommendation:** IMPLEMENT
- Inject: `<batch_status>story_1_of_3, progress_33%</batch_status>`
- Helps agents understand urgency/scale

---

### Optimization 8: Multi-Model Strategy

**Description:** Different models for different commands (default for create-*, haiku for review-2+, opus for code-review-1)

**Pros:**
- Balances quality and speed
- Recommended practice for orchestration
- Already in instructions (review-2+ use haiku)

**Cons:**
- Requires model parameter per command
- Cost implications
- May not work for all tasks

**Risk Level:** LOW

**Recommendation:** IMPLEMENT (already in instructions.md)
- Default model for: create-story, create-story-discovery, create-tech-spec, dev-story, code-review-1
- Haiku for: story-review-2/3, tech-spec-review-2/3, code-review-2+
- This is already defined in instructions.md, just confirm in sprint commands

---

### Optimization 9: Error History Tracking

**Description:** Inject code-review error history to prevent re-fixing same issues

**Pros:**
- Code-review loop converges faster
- Avoids chasing ghosts
- Prevents repeated failures

**Cons:**
- Requires error serialization
- History can accumulate bloat

**Risk Level:** LOW

**Recommendation:** IMPLEMENT (already in dev-story workflow, just expose)
- Extract error_history from story file
- Inject into code-review prompts
- Include: past error patterns, failed fixes, suggestions

---

### Optimization 10: Task Taxonomy Injection

**Description:** Inject task-taxonomy.yaml into prompts so agents know valid task IDs without searching

**Pros:**
- Ensures correct logging
- Agents don't need to discover logging structure
- Reduces orchestrator.sh lookup time

**Cons:**
- Small file (already small)
- Minimal benefit

**Risk Level:** NONE

**Recommendation:** IMPLEMENT
- Include task-taxonomy.yaml in file_injections
- Path: `_bmad/bmm/workflows/4-implementation/sprint-runner/task-taxonomy.yaml`

---

## Part 3: Edge Cases & Risks

### Risk 1: Context Injection Size Exceeds Token Limits

**Symptom:** Prompt-system-append grows too large with 2 stories x 5 files each x 2000+ lines

**Mitigation:**
- Monitor injection size during build_prompt_system_append()
- Warn if exceeds 100KB
- Implement sharding: split large files and reference parts
- Cache large static files separately if needed

**Risk Level:** MEDIUM

**Recommendation:** Add size monitoring, implement sharding if >150KB

---

### Risk 2: File Path Resolution Issues

**Symptom:** Agents have injected file paths but try to read from disk anyway

**Mitigation:**
- Add explicit instruction: "DO NOT read any files - content is injected below"
- Use `<file_injections rule="DO NOT read...">` as in context file
- Mention file paths in instructions only for reference

**Risk Level:** HIGH

**Recommendation:** CRITICAL - emphasize in every prompt that content is injected, not on disk

---

### Risk 3: Multi-Story Logging Confusion

**Symptom:** Batch of 2 stories generates inconsistent logging (mixed story IDs, wrong epic)

**Mitigation:**
- Explicit instruction for sequential processing with per-story logging
- Example logging sequence in every multi-story prompt
- Enforce story_key parsing before processing starts

**Risk Level:** MEDIUM

**Recommendation:** Test multi-story batches extensively before release

---

### Risk 4: Tech-Spec Decision Missing

**Symptom:** Orchestrator cannot parse [TECH-SPEC-DECISION] marker, defaults to REQUIRED

**Mitigation:**
- Default behavior is correct (safe to require when unsure)
- Add validation after step 2 to confirm marker exists
- If missing, re-run create-story with explicit tech-spec decision instruction

**Risk Level:** LOW

**Recommendation:** Log warning if decision missing but proceed with default

---

### Risk 5: Project-Context.md Outdated During Sprint

**Symptom:** Sprint runs for hours, project-context.md is generated stale, agents get old context

**Mitigation:**
- Copy project-context.md at START of sprint
- All agents receive same copy (sprint-project-context.md)
- If context refresh needed, restart sprint with new copy

**Risk Level:** MEDIUM

**Recommendation:** Add background refresh job (already in instructions.md, just track completion)

---

### Risk 6: Git Commit File Matching Ambiguity

**Symptom:** sprint-commit cannot determine if file relates to story ID (generic file like "utils.py")

**Mitigation:**
- Use story file's File List as source of truth
- If file in File List, definitely commit it
- If file in git but not in File List, investigate (ask in prompt or skip)
- Conservative: only commit files explicitly listed by dev-story

**Risk Level:** MEDIUM

**Recommendation:** Implement two-phase matching: exact match File List first, then pattern match

---

### Risk 7: Review Finding Injection Creates False Positives

**Symptom:** Injecting past review findings causes agent to avoid legitimate changes, only applies tiny fixes

**Mitigation:**
- Only inject review findings as context, not restrictions
- Instruction: "Previous issues were: [...] - Ensure these are resolved, but find NEW issues too"
- Don't limit finding scope based on history

**Risk Level:** LOW

**Recommendation:** IMPLEMENT with explicit "find new issues too" instruction

---

### Risk 8: Batch Discovery Files Become Stale

**Symptom:** Codebase changes between story-discovery (step 2) and code-review (step 4), discovery is outdated

**Mitigation:**
- Discovery is read-only for agents--they can't modify it
- Developers made code changes in dev-story; discovery predates those changes
- This is actually OK--discovery describes the existing codebase context
- Add note in prompt: "Discovery file reflects codebase state BEFORE implementation"

**Risk Level:** LOW

**Recommendation:** No action needed, this is expected behavior

---

### Risk 9: Orchestrator Injection Duplicate File Paths

**Symptom:** Same file matched twice by glob patterns (e.g., "sprint-3a-1*" and "*3a-1*"), creates duplicate in injection

**Mitigation:**
- Deduplication already in build_prompt_system_append()
- Uses set() to track seen_paths
- No risk of double injection

**Risk Level:** NONE

**Recommendation:** Confirm deduplication logic (already in context file, line 154-160)

---

### Risk 10: Background Review Chain Blocks Main Flow

**Symptom:** Background task spawned but orchestrator waits for it (defeats purpose)

**Mitigation:**
- Use `run_in_background: true` parameter to spawn_subagent()
- Confirm main flow continues immediately without awaiting
- Background task updates database only, doesn't update sprint-status

**Risk Level:** MEDIUM

**Recommendation:** Add explicit comments in orchestrator code marking background vs blocking calls

---

## Part 4: Recommended Implementation Order

### Phase 1: Infrastructure (highest priority, enables everything)

1. **Update orchestrator.py with prompt-system-append infrastructure**
   - Add `build_prompt_system_append()` method
   - Update `spawn_subagent()` to accept prompt_system_append parameter
   - Add file scanning and deduplication logic

2. **Implement `copy_project_context()` method**
   - Copy project-context.md -> sprint-project-context.md at sprint start
   - Verify read/write works correctly

3. **Create custom command folder structure**
   - Create `_bmad/bmm/workflows/4-implementation/sprint-runner/commands/` directory
   - Set up folder template for all 8 commands

---

### Phase 2: Core Commands

4. **Duplicate and adapt 4 BMAD source commands**
   - Create `sprint-create-story/` from `create-story/`
   - Create `sprint-dev-story/` from `dev-story/`
   - Create `sprint-code-review/` from `code-review/`
   - Create `sprint-create-tech-spec/` (new, based on create-story pattern)

5. **Create discovery & review variants**
   - Create `sprint-story-discovery/` (parallel discovery only)
   - Create `sprint-story-review/` (review, not creation)
   - Create `sprint-tech-spec-review/` (review, not creation)
   - Create `sprint-commit/` (NEW - git commit logic)

---

### Phase 3: Orchestrator Integration

6. **Update all phase methods in orchestrator.py**
   - Phase 2 (create-story): Use sprint-create-story, pass prompt-system-append
   - Phase 2b (story-review): Use sprint-story-review, pass prompt-system-append
   - Phase 3 (create-tech-spec): Use sprint-create-tech-spec, pass prompt-system-append
   - Phase 3b (tech-spec-review): Use sprint-tech-spec-review, pass prompt-system-append
   - Phase 4 (dev-story): Use sprint-dev-story, pass prompt-system-append
   - Phase 4 (code-review): Use sprint-code-review, pass prompt-system-append
   - Phase 4c (batch-commit): Use sprint-commit

7. **Implement `cleanup_batch_files()` method**
   - Move completed files to archived-artifacts/
   - Delete discovery files (intermediate)

---

### Phase 4: Testing & Validation

8. **Integration testing**
   - Test single-story batch end-to-end
   - Test 2-story paired batch
   - Test file injection XML generation
   - Test cleanup workflow

9. **Edge case testing**
   - Large file injection (>100KB)
   - Multi-story logging consistency
   - Git commit file matching (ambiguous files)
   - Background review chain execution

10. **Performance validation**
    - Compare token usage: v2 vs v3
    - Measure injection overhead
    - Verify subagent startup time improvement

---

### Phase 5: Optimizations (optional, post-v3)

11. **Add optional optimizations (separate PRs)**
    - Codebase mapping cache (optimization #1)
    - Web research pre-computation (optimization #4)
    - Batch status injection (optimization #7)
    - Task taxonomy injection (optimization #10)
    - Error history tracking (optimization #9)

---

### Phase 6: Documentation & Cleanup

12. **Update documentation**
    - Update README.md to reflect v3 architecture
    - Update task-taxonomy.yaml if adding new tasks
    - Update sprint-runner prompts folder note (will be moved/deprecated)

13. **Cleanup (final)**
    - Remove old `prompts/` folder (or archive it)
    - Verify no dead code paths
    - Update version number in code

---

## Part 5: Command-by-Command Removal/Addition Summary

| Command | Remove | Add |
|---------|--------|-----|
| **sprint-create-story** | Story discovery, full discover_inputs, arch analysis, web research, sprint-status update | Injected context instruction, multi-story sequential, TECH-SPEC-DECISION output, logging with task IDs |
| **sprint-story-discovery** | N/A (variant) | Setup, multi-story sequential, logging |
| **sprint-story-review** | Story creation, discovery reading, epic discovery | Injected context instruction, multi-story sequential, CRITICAL-ISSUES-FOUND output, logging |
| **sprint-create-tech-spec** | Full discovery, project context, arch loading | Injected context instruction, INLINE discovery only, multi-story sequential, logging |
| **sprint-tech-spec-review** | Tech-spec creation, discovery | Injected context instruction, multi-story sequential, CRITICAL-ISSUES-FOUND output, logging |
| **sprint-dev-story** | Story discovery, context loading, sprint-status marking | Injected context instruction, explicit "use injected content", logging with task IDs |
| **sprint-code-review** | File discovery from disk | Use injected story context, logging with attempt number, HIGHEST SEVERITY output |
| **sprint-commit** | N/A (new) | Git status, file matching, selective staging, commit message, logging |

---

## Conclusion

**Viability:** The v3 optimization approach is sound and implementable. All 8 commands can be successfully adapted.

**Complexity:** Moderate (infrastructure for injection is simple, command adaptation is straightforward)

**Additional Value:** 10+ optimizations identified beyond the core v3 approach, 5 of which are recommended for v3 or short-term post-v3

**Risk Level:** Medium overall
- High-risk areas: orchestrator changes, multi-story batching, file injection size
- Mitigated by: explicit testing, conservative defaults, deduplication logic

**Next Steps:**
1. Review this analysis
2. Prioritize optimization list
3. Begin Phase 1: orchestrator infrastructure
4. Implement commands in Phase 2
5. Test thoroughly in Phase 4
