# Story Context Quality Validation Checklist

## Sprint-Runner Optimized Validation

This checklist validates story files created by the sprint-create-story command.
Context was pre-injected via --prompt-system-append - validation focuses on output quality.

---

## CRITICAL MISSION: Validate Story Prevents LLM Developer Mistakes

### COMMON LLM MISTAKES TO PREVENT:
- **Reinventing wheels** - Creating duplicate functionality instead of reusing existing
- **Wrong libraries** - Using incorrect frameworks, versions, or dependencies
- **Wrong file locations** - Violating project structure and organization
- **Breaking regressions** - Implementing changes that break existing functionality
- **Ignoring UX** - Not following user experience design requirements
- **Vague implementations** - Creating unclear, ambiguous implementations
- **Lying about completion** - Implementing incorrectly or incompletely
- **Not learning from past work** - Ignoring previous story learnings and patterns

---

## Validation Categories

### Category 1: Story Structure Completeness

- [ ] Story header contains epic_num, story_num, story_title
- [ ] Status is set to "ready-for-dev"
- [ ] User story statement follows "As a, I want, so that" format
- [ ] Acceptance criteria are numbered and specific
- [ ] Tasks/subtasks are linked to acceptance criteria (AC: #)
- [ ] Dev Notes section populated with relevant guidance
- [ ] References section cites source documents

### Category 2: Technical Specification Quality

- [ ] Technical requirements are specific (not vague)
- [ ] Architecture compliance requirements are clear
- [ ] Library/framework versions are specified where relevant
- [ ] File structure requirements align with project conventions
- [ ] Testing requirements specify approach and coverage expectations

### Category 3: Context Utilization

- [ ] Project context patterns are reflected in Dev Notes
- [ ] Previous story learnings are incorporated (if applicable)
- [ ] Epic-level dependencies are acknowledged
- [ ] Cross-story context is considered

### Category 4: LLM Optimization

- [ ] Instructions are actionable and direct
- [ ] No excessive verbosity - every sentence adds value
- [ ] Information is well-structured (headings, bullets)
- [ ] Critical requirements are not buried in text
- [ ] No ambiguous language that could cause misinterpretation

### Category 5: Disaster Prevention

- [ ] Anti-pattern warnings included for common mistakes
- [ ] Security requirements are explicit (if applicable)
- [ ] Performance requirements are explicit (if applicable)
- [ ] Integration points are clearly identified
- [ ] Breaking change risks are noted

---

## Validation Outcome

After validation:

1. **If PASS:** Story is ready for dev-story implementation
2. **If ISSUES FOUND:** List specific issues and apply fixes
3. **Report tech-spec decision:** REQUIRED or SKIP based on complexity

---

## Tech-Spec Decision Criteria

**REQUIRED if story involves:**
- New architecture patterns
- Complex integrations
- Database schema changes
- API design
- Security-critical features
- Performance-critical features
- Multi-component coordination

**SKIP if story is:**
- Straightforward implementation
- Clear patterns from previous work
- Single-component changes
- Well-defined by acceptance criteria alone

---

## Interactive Improvement Process

If issues are found:

1. Present findings with severity (Critical / Enhancement / Optimization)
2. Apply fixes to story file
3. Re-validate after fixes
4. Confirm story is ready for dev-story

**Goal:** Create the ultimate developer implementation guide that makes flawless implementation inevitable.
