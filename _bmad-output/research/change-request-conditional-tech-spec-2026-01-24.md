# Change Request: Conditional Tech-Spec with Create-Story Decision

**Date:** 2026-01-24
**Requested By:** Teazyou
**Status:** Pending Implementation
**Priority:** High

---

## 1. Executive Summary

Modify the sprint-runner workflow to make tech-spec generation conditional based on the create-story subagent's assessment. The create-story phase will now evaluate whether a technical specification is necessary (or overkill) for each story and communicate this decision to the orchestrator. Additionally, remove all tech-discovery parallel logic and allow the tech-spec subagent to perform its own discovery inline.

---

## 2. Current State Analysis

### 2.1 Current Flow

```
Step 2: CREATE-STORY (PARALLEL)
├── create-story.md (CREATE MODE) ──────────────┐
└── create-story-discovery.md (DISCOVERY MODE) ─┴─► Wait for both

Step 2b: STORY-REVIEW (SEQUENTIAL)
└── story-review.md (max 3 attempts)

Step 3: CREATE-TECH-SPEC (PARALLEL) ← ALWAYS RUNS
├── create-tech-spec.md (CREATE MODE) ──────────────┐
└── create-tech-spec-discovery.md (DISCOVERY MODE) ─┴─► Wait for both

Step 3b: TECH-SPEC-REVIEW (SEQUENTIAL)
└── tech-spec-review.md (max 3 attempts)

Step 4: DEV + CODE-REVIEW
```

### 2.2 Current Files Involved

| File | Purpose |
|------|---------|
| `prompts/create-story.md` | Creates story file, outputs discovery file |
| `prompts/create-story-discovery.md` | Parallel discovery for story |
| `prompts/create-tech-spec.md` | Creates tech spec, outputs discovery file |
| `prompts/create-tech-spec-discovery.md` | Parallel discovery for tech-spec |
| `instructions.md` | Orchestrator logic (Steps 2, 2b, 3, 3b) |

### 2.3 Problems with Current Approach

1. **Wasted Effort**: Simple stories (bug fixes, config changes) still go through full tech-spec process
2. **Redundant Discovery**: Tech-spec has parallel discovery that duplicates work create-tech-spec already does
3. **No Flexibility**: All stories treated equally regardless of complexity

---

## 3. Proposed Changes

### 3.1 New Flow

```
Step 2: CREATE-STORY (PARALLEL)
├── create-story.md (CREATE MODE + TECH-SPEC DECISION) ─┐
└── create-story-discovery.md (DISCOVERY MODE) ─────────┴─► Wait for both
│
├─► Parse output for: [TECH-SPEC-DECISION: REQUIRED] or [TECH-SPEC-DECISION: SKIP]
└─► Store tech_spec_needed = true if ANY story requires it

Step 2b: STORY-REVIEW (SEQUENTIAL)
└── story-review.md (max 3 attempts)

Step 3: CREATE-TECH-SPEC (SINGLE - CONDITIONAL)  ← ONLY IF tech_spec_needed == true
└── create-tech-spec.md (CREATE MODE + INLINE DISCOVERY)
    - No parallel discovery
    - Subagent does its own discovery

Step 3b: TECH-SPEC-REVIEW (SEQUENTIAL - CONDITIONAL)  ← ONLY IF tech_spec_needed == true
└── tech-spec-review.md (max 3 attempts)

Step 4: DEV + CODE-REVIEW
```

### 3.2 Decision Keyword Format

The create-story subagent will output a clearly parseable decision line:

```
[TECH-SPEC-DECISION: REQUIRED]
```
or
```
[TECH-SPEC-DECISION: SKIP]
```

**Parsing Rules:**
- Look for `[TECH-SPEC-DECISION:` followed by `REQUIRED]` or `SKIP]`
- Case-insensitive matching
- Must be on its own line (can have leading/trailing whitespace)
- If not found, default to `REQUIRED` (fail-safe)

### 3.3 Batch Decision Logic

For paired stories (e.g., 3a-1 and 3a-2):

| Story 1 Decision | Story 2 Decision | Batch Result |
|------------------|------------------|--------------|
| REQUIRED | REQUIRED | Run tech-spec for BOTH |
| REQUIRED | SKIP | Run tech-spec for BOTH |
| SKIP | REQUIRED | Run tech-spec for BOTH |
| SKIP | SKIP | Skip tech-spec entirely |

**Rule: If ANY story requires tech-spec, run tech-spec for ALL stories in the batch.**

### 3.4 Decision Guidance for Create-Story

Add to `create-story.md` prompt:

```markdown
## TECH-SPEC DECISION

After creating the story, you MUST evaluate whether a technical specification is needed.

**Output one of these lines (REQUIRED - orchestrator parses this):**
- `[TECH-SPEC-DECISION: REQUIRED]` - Tech spec needed
- `[TECH-SPEC-DECISION: SKIP]` - Tech spec is overkill

**Decision Guidelines:**

SKIP tech-spec when:
- Bug fixes with clear root cause
- Configuration changes only
- Documentation updates
- Single-file edits with obvious implementation
- Simple refactors (rename, move, extract)
- Copy/paste from existing patterns

REQUIRE tech-spec when:
- New features with multiple components
- Multi-file changes with dependencies
- API changes (new endpoints, schema changes)
- Architectural changes or new patterns
- Complex business logic
- Integration with external systems
- Changes affecting multiple layers (UI + API + DB)

When in doubt, choose REQUIRED. Quality over speed.
```

### 3.5 Tech-Discovery Removal

**Remove entirely:**
- `prompts/create-tech-spec-discovery.md` file
- Parallel execution of tech-spec-discovery in Step 3
- Project context injection for `*-discovery-tech.md` files

**Modify `create-tech-spec.md`:**
- Remove rule preventing subagent from doing discovery
- Remove reference to discovery file output
- Allow subagent to perform inline discovery as part of workflow

---

## 4. File Changes Summary

### 4.1 Files to Modify

| File | Changes |
|------|---------|
| `prompts/create-story.md` | Add TECH-SPEC DECISION section with guidelines and required output |
| `prompts/create-tech-spec.md` | Remove discovery file output requirement, remove restriction on discovery |
| `instructions.md` | Add decision parsing after Step 2, make Step 3/3b conditional, remove tech-discovery parallel |

### 4.2 Files to Delete

| File | Reason |
|------|--------|
| `prompts/create-tech-spec-discovery.md` | No longer needed - tech-spec does its own discovery |

### 4.3 Files Unchanged

| File | Reason |
|------|--------|
| `prompts/create-story-discovery.md` | Story discovery still runs in parallel |
| `prompts/story-review.md` | No changes |
| `prompts/tech-spec-review.md` | No changes (only runs conditionally) |
| `prompts/dev-story.md` | No changes |
| `prompts/code-review.md` | No changes |

---

## 5. Detailed Specifications

### 5.1 Modifications to `prompts/create-story.md`

**Add after the CHECKLIST ENFORCEMENT section (around line 65):**

```markdown
---

## TECH-SPEC DECISION (MANDATORY OUTPUT)

After completing all checks and saving the story file, you MUST evaluate whether a technical specification is necessary for this story.

**OUTPUT REQUIREMENT - Include this line in your final output:**

If tech-spec IS needed:
```
[TECH-SPEC-DECISION: REQUIRED]
```

If tech-spec is OVERKILL:
```
[TECH-SPEC-DECISION: SKIP]
```

**Decision Guidelines:**

SKIP tech-spec (simple/straightforward):
- Bug fixes with clear, isolated root cause
- Configuration or environment changes
- Documentation-only updates
- Single-file changes with obvious implementation path
- Copy/paste patterns from existing similar code
- Simple refactors (rename, move, extract method)
- Adding/removing feature flags
- Updating dependencies with no code changes

REQUIRE tech-spec (complex/multi-faceted):
- New features involving multiple files or components
- API changes (new endpoints, request/response changes)
- Database schema modifications
- Architectural decisions or new patterns
- Complex business logic with multiple branches
- Integration with external services or systems
- Changes spanning multiple layers (UI + backend + data)
- Performance optimizations requiring analysis
- Security-sensitive implementations

**DEFAULT TO REQUIRED** - When uncertain, choose REQUIRED. Quality over speed.

The orchestrator will parse this decision to determine whether to run the tech-spec phase.
```

### 5.2 Modifications to `prompts/create-tech-spec.md`

**Remove lines 31-40 (discovery file output requirement):**

```markdown
ADDITIONAL OUTPUT REQUIREMENT:
After creating the tech spec, save a discovery file to:
{{implementation_artifacts}}/{{story_key}}-discovery-tech.md

The discovery file MUST contain:
- Technical Context: Key file paths, component dependencies, patterns to follow
- Implementation Decisions: Why certain approaches were chosen
- Risk Areas: Potential issues to watch for during implementation
- Testing Strategy: What tests are needed and where
```

**Replace with:**

```markdown
DISCOVERY INSTRUCTIONS:
You are responsible for your own technical discovery. As part of creating the tech spec:
- Explore the codebase to understand existing patterns
- Identify relevant files and dependencies
- Analyze architectural constraints
- Document your findings IN the tech spec itself (not a separate file)

Do NOT create a separate discovery file. Integrate all technical context into the spec.
```

### 5.3 Modifications to `instructions.md`

#### 5.3.1 Update Available Prompts Section (lines 11-20)

**Change from:**
```markdown
Available prompts:
- `create-story.md` - CREATE MODE
- `create-story-discovery.md` - DISCOVERY MODE (parallel)
- `story-review.md` - REVIEW MODE
- `create-tech-spec.md` - CREATE MODE
- `create-tech-spec-discovery.md` - DISCOVERY MODE (parallel)
- `tech-spec-review.md` - REVIEW MODE
- `dev-story.md`
- `code-review.md`
```

**Change to:**
```markdown
Available prompts:
- `create-story.md` - CREATE MODE (includes tech-spec decision)
- `create-story-discovery.md` - DISCOVERY MODE (parallel)
- `story-review.md` - REVIEW MODE
- `create-tech-spec.md` - CREATE MODE (includes inline discovery)
- `tech-spec-review.md` - REVIEW MODE
- `dev-story.md`
- `code-review.md`

Note: create-tech-spec-discovery.md has been removed. Tech-spec discovery is now inline.
```

#### 5.3.2 Add New Variable Documentation (after line 31)

```markdown
**Tech-Spec Decision Variables:**
- `{{tech_spec_needed}}` - Boolean, true if any story in batch requires tech-spec
- `{{tech_spec_decisions}}` - Object mapping story_id to decision (REQUIRED/SKIP)
```

#### 5.3.3 Modify Step 2 (CREATE-STORY PHASE)

**Replace the section after parallel execution (around lines 248-257):**

**From:**
```xml
    <action>Wait for BOTH Task calls to complete</action>
    <!-- Subagents log their own milestones and "end" -->

    <!-- POST-PARALLEL: Inject project context -->
    <for-each story in="story_keys">
      <action>Run: _bmad/scripts/project-context-injection.sh {{implementation_artifacts}}/{{story}}-discovery-story.md</action>
    </for-each>

    <action>Log: "CREATE-STORY phase complete, discovery files enriched"</action>
    <action>Go to Step 2b (story review)</action>
```

**To:**
```xml
    <action>Wait for BOTH Task calls to complete</action>
    <!-- Subagents log their own milestones and "end" -->

    <!-- POST-PARALLEL: Inject project context into story discovery -->
    <for-each story in="story_keys">
      <action>Run: _bmad/scripts/project-context-injection.sh {{implementation_artifacts}}/{{story}}-discovery-story.md</action>
    </for-each>

    <!-- PARSE TECH-SPEC DECISIONS -->
    <action>Initialize tech_spec_needed = false</action>
    <action>Initialize tech_spec_decisions = {}</action>

    <for-each story in="story_keys">
      <action>Parse create-story output for [TECH-SPEC-DECISION: REQUIRED] or [TECH-SPEC-DECISION: SKIP]</action>

      <check if="output contains '[TECH-SPEC-DECISION: REQUIRED]' (case-insensitive)">
        <action>Set tech_spec_decisions[story] = "REQUIRED"</action>
        <action>Set tech_spec_needed = true</action>
        <action>Log: "Story [story] tech-spec decision: REQUIRED"</action>
      </check>

      <check if="output contains '[TECH-SPEC-DECISION: SKIP]' (case-insensitive)">
        <action>Set tech_spec_decisions[story] = "SKIP"</action>
        <action>Log: "Story [story] tech-spec decision: SKIP"</action>
      </check>

      <check if="no decision found in output">
        <action>Set tech_spec_decisions[story] = "REQUIRED"</action>
        <action>Set tech_spec_needed = true</action>
        <action>Log: "WARNING: No tech-spec decision found for [story], defaulting to REQUIRED"</action>
      </check>
    </for-each>

    <action>Log: "CREATE-STORY phase complete. Tech-spec needed: [tech_spec_needed]"</action>
    <action>Go to Step 2b (story review)</action>
```

#### 5.3.4 Modify Step 2b Exit (around line 299)

**From:**
```xml
  <action>Go to Step 3 (CREATE-TECH-SPEC)</action>
```

**To:**
```xml
  <check if="tech_spec_needed == true">
    <action>Go to Step 3 (CREATE-TECH-SPEC)</action>
  </check>

  <check if="tech_spec_needed == false">
    <action>Log: "All stories marked tech-spec as SKIP, proceeding directly to DEV"</action>
    <action>Go to Step 4 (DEV + CODE-REVIEW)</action>
  </check>
```

#### 5.3.5 Replace Step 3 (CREATE-TECH-SPEC PHASE)

**Replace entire Step 3 (lines 302-331):**

```xml
<step n="3" goal="CREATE-TECH-SPEC PHASE (SEQUENTIAL - CONDITIONAL)">
  <!-- This step only runs if tech_spec_needed == true -->

  <action>Log: "Starting CREATE-TECH-SPEC phase for [story_key(s)]"</action>

  <!-- SEQUENTIAL EXECUTION - One tech-spec at a time, subagent does its own discovery -->
  <for-each story in="story_keys">
    <action>Load prompt from prompts/create-tech-spec.md, substitute variables for [story]</action>
    <action>Spawn subagent with Task tool (default model)</action>
    <goal>Create tech spec with inline discovery for [story]</goal>
    <action>Wait for completion</action>
    <!-- Subagent logs milestones and "end" -->
  </for-each>

  <!-- NOTE: No tech-discovery parallel execution -->
  <!-- NOTE: No project-context injection for tech-discovery files -->

  <action>Log: "CREATE-TECH-SPEC phase complete"</action>
  <action>Go to Step 3b (tech-spec review)</action>
</step>
```

#### 5.3.6 Update Execution Summary (around lines 573-577)

**From:**
```
  3. create-tech-spec (PARALLEL):
     a. create-tech-spec (CREATE MODE) + create-tech-spec-discovery (DISCOVERY MODE)
        - TWO Task tool calls in single message (concurrent)
     b. Inject project context into discovery files
     c. tech-spec-review loop (sequential, Haiku for review 2+, max 3)
```

**To:**
```
  3. create-tech-spec (SEQUENTIAL - CONDITIONAL):
     - ONLY runs if tech_spec_needed == true (any story requires it)
     - If ALL stories marked SKIP, this phase is bypassed
     a. For each story: create-tech-spec (CREATE MODE with inline discovery)
        - SINGLE subagent per story (no parallel discovery)
        - Subagent performs its own discovery during spec creation
     b. tech-spec-review loop (sequential, Haiku for review 2+, max 3)

  Note: Tech-spec decision is made by create-story subagent based on complexity.
  Decision output: [TECH-SPEC-DECISION: REQUIRED] or [TECH-SPEC-DECISION: SKIP]
```

---

## 6. Logging Changes

### 6.1 New Log Entries

Add to sprint-runner.csv logging:

| When | Log Entry |
|------|-----------|
| After parsing decisions | `tech-spec-decision,{story_id},{REQUIRED\|SKIP}` |
| If skipping tech-spec | `tech-spec-skipped,{batch_stories},all-stories-skip` |

### 6.2 Removed Log Entries

- `tech-spec-discovery,workflow,start`
- `tech-spec-discovery,workflow,end`

---

## 7. Error Handling

### 7.1 Decision Parsing Failures

| Scenario | Response |
|----------|----------|
| No decision keyword found | Default to REQUIRED, log warning |
| Multiple conflicting keywords | Use first occurrence, log warning |
| Malformed keyword | Default to REQUIRED, log warning |

### 7.2 Conditional Skip Edge Cases

| Scenario | Response |
|----------|----------|
| Single story batch, SKIP | Skip tech-spec, go directly to dev |
| Paired batch, mixed decisions | Run tech-spec for ALL (batch rule) |
| Resuming story at ready-for-dev | Tech-spec decision already made, check if spec exists |

---

## 8. Success Criteria

1. **Create-story outputs decision**: Every create-story run outputs `[TECH-SPEC-DECISION: ...]`
2. **Orchestrator parses correctly**: Decision is captured and stored per story
3. **Batch logic works**: ANY required = all get tech-spec
4. **Skip path functional**: When all skip, Step 3/3b bypassed entirely
5. **No tech-discovery files**: System no longer creates `*-discovery-tech.md` files
6. **Tech-spec inline discovery**: Tech-spec subagent explores codebase during creation
7. **Logging accurate**: Decisions logged to CSV for analytics

---

## 9. Testing Scenarios

### 9.1 Decision Output Tests

**Test 1: Simple bug fix story**
- Create story for obvious bug fix
- Verify output contains `[TECH-SPEC-DECISION: SKIP]`

**Test 2: Complex feature story**
- Create story for multi-component feature
- Verify output contains `[TECH-SPEC-DECISION: REQUIRED]`

**Test 3: Missing decision (edge case)**
- Manually test with prompt that doesn't output decision
- Verify orchestrator defaults to REQUIRED

### 9.2 Orchestrator Flow Tests

**Test 4: Single story SKIP**
- Run sprint-runner with 1 simple story
- Verify tech-spec phase is skipped
- Verify dev-story runs directly after story-review

**Test 5: Paired stories both SKIP**
- Run sprint-runner with 2 simple stories from same epic
- Verify tech-spec phase skipped for both
- Verify dev-story runs for both

**Test 6: Paired stories mixed decisions**
- Run sprint-runner with 1 simple + 1 complex story
- Verify tech-spec runs for BOTH stories (batch rule)

**Test 7: Paired stories both REQUIRED**
- Run sprint-runner with 2 complex stories
- Verify tech-spec runs for both (normal flow)

### 9.3 Tech-Spec Discovery Tests

**Test 8: No discovery file created**
- Run create-tech-spec
- Verify no `*-discovery-tech.md` file exists
- Verify tech context is in the spec itself

**Test 9: Subagent explores codebase**
- Run create-tech-spec for story requiring file analysis
- Verify spec contains accurate file paths from exploration

---

## 10. Rollback Plan

If issues arise:

1. **Restore create-story.md**: Remove tech-spec decision section
2. **Restore create-tech-spec.md**: Add back discovery file output
3. **Restore instructions.md**: Revert to parallel tech-discovery, remove conditional logic
4. **Restore create-tech-spec-discovery.md**: Undelete the file
5. **Clear state**: Remove any `tech_spec_needed` variables from active sessions

---

## 11. Migration Notes

### 11.1 Existing Stories

- Stories already in `ready-for-dev` status will proceed normally
- Stories in `backlog` will get new create-story with decision output
- No migration of existing data needed

### 11.2 Discovery File Cleanup

After implementation, existing `*-discovery-tech.md` files can be:
- Left in place (batch-commit will archive them)
- Manually deleted (they're intermediate files)

---

## Appendix A: Decision Keyword Grammar

```
TECH_SPEC_DECISION := '[TECH-SPEC-DECISION:' WHITESPACE DECISION ']'
DECISION := 'REQUIRED' | 'SKIP'
WHITESPACE := ' '*

Examples:
[TECH-SPEC-DECISION: REQUIRED]
[TECH-SPEC-DECISION: SKIP]
[TECH-SPEC-DECISION:REQUIRED]
[TECH-SPEC-DECISION:  SKIP  ]

Parsing (regex):
/\[TECH-SPEC-DECISION:\s*(REQUIRED|SKIP)\s*\]/i
```

## Appendix B: Updated Sprint-Runner Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 0: Initialize                                              │
│   0a: Project context check                                     │
│   0b: Determine cycles                                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Select stories (1-2 from same epic)                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: CREATE-STORY (PARALLEL)                                 │
│   ├── create-story.md ────────► [TECH-SPEC-DECISION: X]        │
│   └── create-story-discovery.md                                 │
│                                                                 │
│   Parse decisions → tech_spec_needed = (any REQUIRED?)          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2b: STORY-REVIEW (SEQUENTIAL)                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
         tech_spec_needed?           tech_spec_needed?
              TRUE                        FALSE
                    │                       │
                    ▼                       │
┌───────────────────────────────┐          │
│ Step 3: CREATE-TECH-SPEC      │          │
│   (SEQUENTIAL per story)      │          │
│   - Inline discovery          │          │
│   - No parallel discovery     │          │
└───────────────────────────────┘          │
                    │                       │
                    ▼                       │
┌───────────────────────────────┐          │
│ Step 3b: TECH-SPEC-REVIEW     │          │
│   (SEQUENTIAL per story)      │          │
└───────────────────────────────┘          │
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: DEV + CODE-REVIEW (SEQUENTIAL per story)                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4c: BATCH-COMMIT                                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 5/6: Error recovery / Cycle tracking                       │
└─────────────────────────────────────────────────────────────────┘
```
