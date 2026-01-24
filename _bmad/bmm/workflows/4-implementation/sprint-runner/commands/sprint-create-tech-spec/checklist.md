# Sprint Create Tech-Spec - Validation Checklist

This checklist validates that the tech-spec meets the **Ready for Development** standard and is suitable for autonomous implementation by a dev agent.

---

## Pre-Execution Checks

- [ ] Story file content available in `<file_injections>`
- [ ] Discovery file content available (if exists)
- [ ] Project context injected
- [ ] Story key(s) parsed correctly

---

## Context Loading (Step 1: Setup)

- [ ] Story requirements extracted from injected content
- [ ] Acceptance criteria parsed
- [ ] Tasks/subtasks identified
- [ ] Project patterns noted from project-context
- [ ] Architecture constraints identified

---

## Discovery Phase (Step 2: Discover)

- [ ] Technical gaps identified (not covered by injected discovery)
- [ ] Codebase exploration performed ONLY for gaps
- [ ] Tech stack documented
- [ ] Code patterns captured
- [ ] Files to modify identified
- [ ] Test patterns noted

---

## Generation Phase (Step 3: Generate)

### Overview Section
- [ ] Problem statement is clear and specific
- [ ] Solution is concise (1-2 sentences)
- [ ] In-scope items are explicit
- [ ] Out-of-scope items prevent scope creep

### Context for Development
- [ ] Codebase patterns match actual project
- [ ] Files to Reference table has real paths
- [ ] Technical decisions are documented

### Implementation Plan
- [ ] Tasks are numbered and sequenced
- [ ] Each task has specific file path
- [ ] Each task has clear action
- [ ] Dependencies flow correctly (lowest level first)

### Acceptance Criteria
- [ ] All ACs use Given/When/Then format
- [ ] Happy path covered
- [ ] Error handling addressed
- [ ] Edge cases considered

### Additional Context
- [ ] Dependencies listed
- [ ] Testing strategy defined
- [ ] Notes capture risks and limitations

---

## Ready for Development Standard (Step 5: Validate)

### Core Requirements
- [ ] **ACTIONABLE**: Every task has clear file path AND specific action
- [ ] **LOGICAL**: Tasks ordered by dependency (lowest level first)
- [ ] **TESTABLE**: All ACs use Given/When/Then format
- [ ] **COMPLETE**: No placeholders, no "TBD", no "TODO"
- [ ] **SELF-CONTAINED**: A fresh agent can implement without reading conversation history

### Disaster Prevention
- [ ] No task requires "figure out" or "research"
- [ ] No ambiguous instructions
- [ ] Scope boundaries are explicit

---

## Output Verification

- [ ] File saved to: `_bmad-output/implementation-artifacts/sprint-tech-spec-{story_key}.md`
- [ ] All frontmatter fields populated
- [ ] Status set to `ready-for-dev`
- [ ] Checklist completed message output
- [ ] Tech spec created message with filename output

---

## Logging Verification

- [ ] setup start logged
- [ ] setup end logged
- [ ] discover start logged
- [ ] discover end logged (with files count)
- [ ] generate start logged
- [ ] generate end logged (with sections count)
- [ ] write start logged
- [ ] write end logged (with lines count)
- [ ] validate start logged
- [ ] validate end logged

---

## Multi-Story Processing (if applicable)

- [ ] Each story processed sequentially
- [ ] Isolation maintained between stories
- [ ] Individual logging for each story
- [ ] All tech specs created with correct filenames

---

_Validated by sprint-create-tech-spec command on {date}_
