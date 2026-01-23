# Code Review Subagent Prompt

## Variables
- `{{story_key}}` - The story identifier
- `{{implementation_artifacts}}` - Path to implementation artifacts folder
- `{{review_attempt}}` - Current review attempt number

---

## Prompt

AUTONOMOUS MODE - No human available to answer questions. Make all decisions yourself.

Run the workflow: /bmad:bmm:workflows:code-review

Target story: {{story_key}}
Story file: {{implementation_artifacts}}/{{story_key}}.md
Review attempt: {{review_attempt}}

CRITICAL INSTRUCTIONS:
- You MUST make all decisions autonomously. No one will answer questions.
- Perform adversarial code review as the workflow instructs.
- If you find ANY issues (CRITICAL, HIGH, MEDIUM, or LOW severity):
  - FIX THEM AUTOMATICALLY (choose option 1 "Fix them automatically" when prompted)
  - Do NOT create action items
  - Do NOT change story status to "done"
  - Keep story status as "review" so another review pass happens
- ONLY if you find ZERO issues:
  - Mark story status as "done" in sprint-status.yaml
  - Update story file status to "done"
- Do NOT ask for confirmation. Fix everything you find.

IMPORTANT: After fixing issues, the story stays in "review" status for another review pass.

MANDATORY OUTPUT FORMAT - At the end of your review, clearly state:
- "HIGHEST SEVERITY: CRITICAL" or "HIGHEST SEVERITY: HIGH" or "HIGHEST SEVERITY: MEDIUM" or "HIGHEST SEVERITY: LOW" or "ZERO ISSUES"
- Include counts: "Issues: X CRITICAL, X HIGH, X MEDIUM, X LOW"
- This determines the re-review logic

DECISION RULES:
- If the workflow asks "What should I do with these issues?" -> ALWAYS choose option 1 "Fix them automatically"
- If the workflow asks for approval -> proceed without approval, you have full authority.
- Never wait for human input. You ARE the decision maker.
- Be thorough in finding issues. The goal is quality, not speed.

---

## Logging Instructions

You MUST log your progress using the orchestrator script. Use the Bash tool to run:

```bash
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "result_message"
```

**Required logs:**
1. Log milestones as you complete them (see list below)
2. ALWAYS log "end" as your FINAL action before terminating

**Milestone logs for this workflow:**
- `review-complete` - After code review analysis is done
- `issues-fixed` - If you fixed issues (or `zero-issues` if none found)
- `end` - ALWAYS log this as your final action

**Example:**
```bash
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "review-complete"
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "issues-fixed"
./_bmad/scripts/orchestrator.sh {{epic_id}} {{story_id}} {{command}} "end"
```

**CRITICAL:** Failure to log "end" will break duration tracking in the dashboard.

---

## Model Routing
- Review 1: general-purpose
- Review 2+: haiku
