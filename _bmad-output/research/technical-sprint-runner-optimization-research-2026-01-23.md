# Technical Research: Sprint-Runner Workflow Optimization

**Research Date:** 2026-01-23
**Project:** grimoire
**Researcher:** Claude (Technical Research Workflow)
**Focus:** Accelerating BMAD sprint-runner workflow without compromising code quality

### Improving Review Agent ( steps skip )

the review is done by a new sub agent. not the same, it will receive
  the project-level discovery file, however does it still going to do the
  specific-level discovery ?

  To be clear, im using create-story and ask to review instead of create,
  it works, but does it redo the specific-level discovery ?

  Im considering to ask the first run of create-story, the one who
  create, to save a file about the discovery to pass it to the review
  version, with the instruction to avoid any discovery, since he have 2
  files.

  Would it works ?

⏺ 🧙 Direct answers:

  Yes. The workflow has no "skip discovery if reviewing" logic. A new subagent
   running create-story in review mode will redo:

  - Epic parsing for this story
  - Previous story learnings
  - Git analysis
  - Architecture verification

  Even though the create agent just did this.
  Would your solution work?
  Yes, it would work.

  create-story (CREATE mode):
    1. Does full discovery
    2. Creates story file
    3. NEW: Saves discovery to story-2a-3-discovery.md

  create-story (REVIEW mode, new subagent):
    Receives: project-discovery.md + story-2a-3-discovery.md
    Prompt: "All discovery pre-loaded. Skip discovery steps. Just review."
    1. Reads both files
    2. Skips steps 2-4
    3. Reviews story against provided context

  ---
  What to save in story-X-discovery.md

  **Story 2a-3 Discovery Cache**

  Story Requirements (from epics)
  - User story statement
  - Acceptance criteria
  - Technical requirements

  Previous Story Learnings (from 2a-2)
  - Files created
  - Patterns used
  - Dev notes

  Architecture Relevance
  - Applicable patterns
  - Constraints for this story

  Git Context
  - Recent relevant commits

  ---
  Time Savings
  ┌────────────────────────────┬──────────────────────────┐
  │       Without cache        │        With cache        │
  ├────────────────────────────┼──────────────────────────┤
  │ Review discovery: ~3-4 min │ Review discovery: ~0 min │
  └────────────────────────────┴──────────────────────────┘
  Pass both files + explicit "skip discovery" instruction = works.

❯ is there other step I should instruct to skip for the review agent,
  create-story (review mode) but also for tech-spec in review mode which
  use the same process. Check their file and give an instruction set for
  both of them, which ask to skip the steps not relevant to this review
  mode

⏺ Answer: Yes.

  ---
  create-story Steps Analysis
  Step: 1
  Description: Determine target story
  Create Mode: ✅ Run
  Review Mode (with cache): ✅ Run (needs to find story)
  ────────────────────────────────────────
  Step: 2
  Description: Load and analyze core artifacts (discover_inputs)
  Create Mode: ✅ Run
  Review Mode (with cache): ❌ SKIP
  ────────────────────────────────────────
  Step: 3
  Description: Architecture analysis
  Create Mode: ✅ Run
  Review Mode (with cache): ❌ SKIP
  ────────────────────────────────────────
  Step: 4
  Description: Web research
  Create Mode: ✅ Run
  Review Mode (with cache): ❌ SKIP
  ────────────────────────────────────────
  Step: 5
  Description: Create story file
  Create Mode: ✅ Run
  Review Mode (with cache): ⚠️ MODIFY (review, not create)
  ────────────────────────────────────────
  Step: 6
  Description: Update sprint status
  Create Mode: ✅ Run
  Review Mode (with cache): ✅ Run (if status changes)
  ---
  tech-spec Steps Analysis
  Step: 1.0
  Description: Check for WIP
  Create Mode: ✅ Run
  Review Mode (with cache): ✅ Run (finds existing spec)
  ────────────────────────────────────────
  Step: 1.1
  Description: Greet and ask
  Create Mode: ✅ Run
  Review Mode (with cache): ❌ SKIP
  ────────────────────────────────────────
  Step: 1.2
  Description: Quick orient scan
  Create Mode: ✅ Run
  Review Mode (with cache): ❌ SKIP
  ────────────────────────────────────────
  Step: 1.3
  Description: Ask informed questions
  Create Mode: ✅ Run
  Review Mode (with cache): ❌ SKIP
  ────────────────────────────────────────
  Step: 1.4-1.5
  Description: Capture understanding, init WIP
  Create Mode: ✅ Run
  Review Mode (with cache): ❌ SKIP
  ────────────────────────────────────────
  Step: 2.1
  Description: Load current state
  Create Mode: ✅ Run
  Review Mode (with cache): ✅ Run (load existing spec)
  ────────────────────────────────────────
  Step: 2.2
  Description: Execute investigation
  Create Mode: ✅ Run
  Review Mode (with cache): ❌ SKIP
  ────────────────────────────────────────
  Step: 2.3
  Description: Document technical context
  Create Mode: ✅ Run
  Review Mode (with cache): ❌ SKIP
  ────────────────────────────────────────
  Step: 3
  Description: Generate spec
  Create Mode: ✅ Run
  Review Mode (with cache): ❌ SKIP (already exists)
  ────────────────────────────────────────
  Step: 4
  Description: Review
  Create Mode: ✅ Run
  Review Mode (with cache): ✅ Run
  ---
  Instruction Set for create-story (Review Mode)

  REVIEW MODE INSTRUCTIONS:

  You have received pre-computed discovery:
  - project-discovery.md (project-level context)
  - story-{key}-discovery.md (story-specific context)

  SKIP THESE STEPS ENTIRELY:
  - Step 2 (Load and analyze core artifacts) - USE PROVIDED FILES
  - Step 3 (Architecture analysis) - ALREADY IN DISCOVERY FILES
  - Step 4 (Web research) - NOT NEEDED FOR REVIEW

  EXECUTE THESE STEPS:
  - Step 1: Identify the target story file to review
  - Step 5: REVIEW (not create) the story file for:
    - Completeness against acceptance criteria
    - Alignment with architecture (from discovery files)
    - Missing technical requirements
    - Quality of Dev Notes section
  - Step 6: Update sprint status only if issues found

  OUTPUT: List of issues found (CRITICAL/HIGH/MEDIUM/LOW) or "NO CRITICAL
  ISSUES FOUND"

  ---
  Instruction Set for tech-spec (Review Mode)

  REVIEW MODE INSTRUCTIONS:

  You have received pre-computed discovery:
  - project-discovery.md (project-level context)
  - story-{key}-discovery.md (story-specific context)
  - tech-spec file already exists at:
  {implementation_artifacts}/tech-spec-{story-key}.md

  SKIP THESE STEPS ENTIRELY:
  - Step 1.1-1.5 (Greet, orient scan, questions, capture, init WIP) - SPEC
  EXISTS
  - Step 2.2 (Execute investigation) - USE PROVIDED FILES
  - Step 2.3 (Document technical context) - ALREADY DOCUMENTED
  - Step 3 (Generate spec) - SPEC EXISTS

  EXECUTE THESE STEPS:
  - Step 1.0: Locate existing tech-spec file
  - Step 2.1: Load the existing tech-spec
  - Step 4: REVIEW the tech-spec for:
    - Completeness (all tasks have file paths and actions)
    - Logical ordering (dependencies respected)
    - Testable ACs (Given/When/Then format)
    - Alignment with story requirements (from discovery files)
    - No placeholders or TBDs

  OUTPUT: List of issues found (CRITICAL/HIGH/MEDIUM/LOW) or "NO CRITICAL
  ISSUES FOUND"

  ---
  Summary
  ┌───────────────────────┬──────────────────────┬─────────────────────┐
  │         Agent         │    Steps to Skip     │    Steps to Run     │
  ├───────────────────────┼──────────────────────┼─────────────────────┤
  │ create-story (review) │ 2, 3, 4              │ 1, 5 (as review), 6 │
  ├───────────────────────┼──────────────────────┼─────────────────────┤
  │ tech-spec (review)    │ 1.1-1.5, 2.2, 2.3, 3 │ 1.0, 2.1, 4         │
  └───────────────────────┴──────────────────────┴─────────────────────┘

### Pre-load discovery

Current Discovery Overhead

  Each subagent currently does its own discovery:
  - Reads project structure
  - Scans architecture docs
  - Finds relevant files
  - Understands patterns

  With your workflow, that's 10+ discovery phases per story:
  - create-story (1) + story-review (up to 3)
  - create-tech-spec (1) + tech-spec-review (up to 3)
  - dev-story (1)
  - code-review (up to 3+)

  Estimated discovery time: 2-5 minutes per agent = 20-50 minutes per story
  just on discovery


### Pre computed context strategy

  Pre-computed Context Strategy

  Tier 1: Project Context (Once per execution)

  What to capture:
  - Project structure summary
  - Architecture decisions
  - Tech stack & patterns
  - Key file locations
  - Coding conventions

  Why once per execution: This rarely changes during a sprint run. Generate it
   at Step 0 before the loop starts.

  File: {implementation_artifacts}/sprint-context.md

  Tier 2: Story Context (Once per story)

  What to capture:
  - Files this story will likely touch
  - Related test files
  - Component dependencies
  - Relevant existing code snippets

  Why per story: Each story affects different parts of the codebase. Generate
  this after create-story completes.

  File: {implementation_artifacts}/story-{key}-context.md

  ---

  another question, if i generate a file context.md with the discovery
  inside + a copy of the project context. Then i initiate the subagent,
  giving this file as first prompt and instruct to not do discovery and
  not load project context since its already in context.md, will it work
  ? will it save time ?

⏺ 🧙 Direct answer, Teazyou:

  Yes, it will work. Yes, it will save time.

  ---
  Why It Works

  Workflows are just instructions. If your subagent prompt says:

  "All project context is pre-loaded in context.md below.
  DO NOT run discovery steps. DO NOT load project-context.md.
  Use the context provided and proceed directly to
  [generation/implementation]."

  The agent will obey. The discovery steps aren't hard-coded - they're
  instructions the agent can skip when told to.

  ---
  Time Saved
  ┌────────────────────────┬────────────┐
  │  Discovery Eliminated  │ Time Saved │
  ├────────────────────────┼────────────┤
  │ create-story discovery │ ~3-5 min   │
  ├────────────────────────┼────────────┤
  │ tech-spec discovery    │ ~2-4 min   │
  ├────────────────────────┼────────────┤
  │ dev-story discovery    │ ~1-2 min   │
  ├────────────────────────┼────────────┤
  │ Per story total        │ ~6-11 min  │
  └────────────────────────┴────────────┘
  ---
  Potential Pitfalls
  Risk: Context.md too large → crowds working memory
  Mitigation: Keep it concise: summaries, not full file dumps
  ────────────────────────────────────────
  Risk: Stale context after story A modifies files
  Mitigation: Regenerate context.md per story OR per 2-3 stories
  ────────────────────────────────────────
  Risk: Agent still tries discovery anyway
  Mitigation: Be explicit: "SKIP steps 1-2, go directly to step 3"
  ---
  Recommended context.md Structure

 - Sprint Context (Pre-computed)

  Project Overview
  - Name: {project_name}
  - Tech stack: {languages, frameworks}

  Architecture Summary
  - {key decisions, patterns}

  File Structure
  - {relevant directories and their purpose}

  Coding Patterns
  - {naming conventions, patterns to follow}

  Current Sprint Focus
  - Epic: {current epic}
  - Stories: {story A, story B}

  Project Context (copied)
  {contents of project-context.md}

  Keep it under 2000 tokens - enough to inform, not enough to bloat.

### Method 1: Model Routing (Haiku for Reviews)

**What it is:** Use faster/cheaper models (Haiku) for tasks that don't require deep reasoning, while reserving Opus/Sonnet for complex implementation.

**Validation:** Anthropic's production system uses Opus 4 lead agent managing Sonnet 4 subagents, achieving **90.2% improvement** on research evaluations while reducing costs.

**Evidence for your workflow:**
- Haiku 4.5 achieves **90% of Sonnet 4.5's coding performance** at 4-5x the speed
- Review tasks (story-review, tech-spec-review, code-review) are pattern-matching, not creative synthesis

**Recommended routing:**

| Task | Current | Recommended | Rationale |
|------|---------|-------------|-----------|
| create-story | general-purpose | Sonnet | Requires synthesis |
| story-review | general-purpose | **Haiku** | Checklist validation |
| create-tech-spec | general-purpose | Sonnet | Architectural reasoning |
| tech-spec-review | general-purpose | **Haiku** | Structural validation |
| dev-story | general-purpose | Sonnet | Implementation complexity |
| code-review | general-purpose | **Haiku** | Pattern matching |

**Implementation:** Modify your subagent prompts to specify `model: "haiku"` for review tasks.

**Expected impact:** 30-40% faster review steps (currently ~30% of total time).

---

### Method 2: Better Upfront Specs Eliminate Rework

**What it is:** "Planning first forces you and the AI onto the same page and prevents wasted cycles."

**Evidence:** Described as "waterfall in 15 minutes" - rapid structured planning that prevents review loops. The 3x review cycles happen because initial output doesn't match expectations.

**For your workflow:** Your create-story and create-tech-spec steps are doing this planning. The issue may be that specs aren't specific enough, causing reviews to find issues.

**Implementation ideas:**
1. Add explicit checklists to create-story/create-tech-spec prompts
2. Include "Definition of Done" in story template
3. Add acceptance test scenarios during story creation (before tech-spec)

**Expected impact:** 50% fewer review iterations (if specs are right the first time, you skip 2 review rounds).

How to do ->
add these instructions to your orchestrator prompts.

  ---
  For create-story (CREATE mode) - Add to prompt:

  QUALITY GATE - BEFORE OUTPUTTING THE STORY FILE:

  You MUST verify against this checklist. Fix any issues
   BEFORE saving.

  ## CRITICAL CHECKS (Block if not met):
  - [ ] User story has clear role, action, and benefit
  - [ ] ALL acceptance criteria from epics are included
  (not just some)
  - [ ] Each AC is testable with Given/When/Then format
  - [ ] Tasks cover ALL acceptance criteria (map each
  task to AC#)
  - [ ] No task is vague - each has specific file path
  or action
  - [ ] Dev Notes include: architecture patterns, file
  locations, testing approach
  - [ ] Previous story learnings included (if story_num
  > 1)
  - [ ] No placeholders or TBDs remain

  ## DISASTER PREVENTION CHECKS:
  - [ ] Identified existing code to reuse (not reinvent)
  - [ ] Specified correct libraries/versions from
  architecture
  - [ ] Noted file structure conventions to follow
  - [ ] Included regression risks if touching existing
  code

  ## LLM-OPTIMIZATION CHECKS:
  - [ ] Instructions are direct and actionable (no
  fluff)
  - [ ] Critical requirements are prominent (not buried)
  - [ ] Structure is scannable (headers, bullets,
  emphasis)

  IF ANY CHECK FAILS: Fix it before saving. Do not
  output a flawed story.

  ---
  For tech-spec (CREATE mode) - Add to prompt:

  QUALITY GATE - BEFORE OUTPUTTING THE TECH-SPEC:

  You MUST verify against this checklist. Fix any issues
   BEFORE saving.

  ## READY FOR DEVELOPMENT STANDARD:
  - [ ] ACTIONABLE: Every task has clear file path AND
  specific action
  - [ ] LOGICAL: Tasks ordered by dependency (lowest
  level first)
  - [ ] TESTABLE: All ACs use Given/When/Then format
  - [ ] COMPLETE: No placeholders, no "TBD", no "TODO"
  - [ ] SELF-CONTAINED: A fresh agent can implement
  without reading conversation history

  ## SPECIFIC CHECKS:
  - [ ] Files to Reference table is populated with real
  paths
  - [ ] Codebase Patterns section matches actual project
   patterns
  - [ ] Implementation tasks are numbered and sequenced
  - [ ] Dependencies section lists any required prior
  work
  - [ ] Testing Strategy specifies test types and
  locations

  ## DISASTER PREVENTION:
  - [ ] No task requires "figure out" or "research" -
  all decided upfront
  - [ ] No ambiguous instructions that could be
  interpreted multiple ways
  - [ ] Scope boundaries are explicit (what NOT to do)

  IF ANY CHECK FAILS: Fix it before saving. Do not
  output an incomplete spec.