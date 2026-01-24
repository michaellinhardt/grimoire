---
title: 'Tech-Spec: {story_key}'
story_key: '{story_key}'
created: '{date}'
status: 'ready-for-dev'
tech_stack: []
files_to_modify: []
code_patterns: []
test_patterns: []
---

# Tech-Spec: {title}

**Story Key:** {story_key}
**Created:** {date}
**Status:** ready-for-dev

---

## Overview

### Problem Statement

{problem_statement}

### Solution

{solution}

### Scope

**In Scope:**
{in_scope}

**Out of Scope:**
{out_of_scope}

---

## Context for Development

### Codebase Patterns

{codebase_patterns}

### Files to Reference

| File | Purpose |
| ---- | ------- |
{files_table}

### Technical Decisions

{technical_decisions}

---

## Implementation Plan

### Tasks

{tasks}

### Task Format

Each task follows this structure:
```
- [ ] Task N: Clear action description
  - File: `path/to/file.ext`
  - Action: Specific change to make
  - Notes: Any implementation details
```

---

## Acceptance Criteria

{acceptance_criteria}

### Format

All acceptance criteria use Given/When/Then format:
```
- [ ] AC N: Given [precondition], when [action], then [expected result]
```

---

## Additional Context

### Dependencies

{dependencies}

### Testing Strategy

{testing_strategy}

### Notes

{notes}

---

## Validation Checklist

Before this tech-spec is considered ready:

### Ready for Development Standard
- [ ] ACTIONABLE: Every task has clear file path AND specific action
- [ ] LOGICAL: Tasks ordered by dependency (lowest level first)
- [ ] TESTABLE: All ACs use Given/When/Then format
- [ ] COMPLETE: No placeholders, no "TBD", no "TODO"
- [ ] SELF-CONTAINED: A fresh agent can implement without reading conversation history

### Specific Checks
- [ ] Files to Reference table is populated with real paths
- [ ] Codebase Patterns section matches actual project patterns
- [ ] Implementation tasks are numbered and sequenced
- [ ] Dependencies section lists any required prior work
- [ ] Testing Strategy specifies test types and locations

### Disaster Prevention
- [ ] No task requires "figure out" or "research" - all decided upfront
- [ ] No ambiguous instructions that could be interpreted multiple ways
- [ ] Scope boundaries are explicit (what NOT to do)
