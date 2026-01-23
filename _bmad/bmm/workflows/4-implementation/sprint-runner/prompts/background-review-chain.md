# Background Review Chain

You are running a background review chain. This is a "fire and forget" fix-up task that runs in parallel with the main workflow.

## Parameters
- **Review type**: {{review_type}} (story-review or tech-spec-review)
- **Stories**: {{story_keys}}
- **Prompt file**: {{prompt_file}}
- **Starting at**: review-2

## Instructions

1. **Run review-2**:
   - Load the prompt from {{prompt_file}}
   - Substitute `{{review_attempt}}` = 2
   - Substitute `{{story_key}}` = {{story_keys}}
   - Execute the review for all stories
   - Log start/end using: `_bmad/scripts/orchestrator.sh <epic_id> <story_id> {{review_type}}-2 workflow start/end`

2. **Check results**:
   - Parse the result for critical issues
   - If NO critical issues found → exit successfully
   - If critical issues remain → continue to step 3

3. **Run review-3** (only if review-2 found critical issues):
   - Load the prompt from {{prompt_file}}
   - Substitute `{{review_attempt}}` = 3
   - Substitute `{{story_key}}` = {{story_keys}}
   - Execute the review for all stories
   - Log start/end using: `_bmad/scripts/orchestrator.sh <epic_id> <story_id> {{review_type}}-3 workflow start/end`

4. **Exit**:
   - If review-3 still has critical issues, log a warning but exit anyway
   - Do NOT loop further (max 2 iterations in this chain: review-2 and review-3)

## CRITICAL RULES

1. **Do NOT update sprint-status.yaml** - You are only fixing files, not changing status
2. **Do NOT block or signal the main flow** - You run independently
3. **Use Haiku model** - You are spawned with model: "haiku"
4. **Log all reviews** - Use the orchestrator.sh script for each review start/end
5. **Process stories sequentially** - Same as review-1, process each story one at a time

## Logging Format

For each story in {{story_keys}}, log:
```bash
# Before review-2
_bmad/scripts/orchestrator.sh <epic_id> <story_id> {{review_type}}-2 workflow start "Starting background review-2"

# After review-2
_bmad/scripts/orchestrator.sh <epic_id> <story_id> {{review_type}}-2 workflow end "Review-2 complete (issues: X)"

# Before review-3 (if needed)
_bmad/scripts/orchestrator.sh <epic_id> <story_id> {{review_type}}-3 workflow start "Starting background review-3"

# After review-3
_bmad/scripts/orchestrator.sh <epic_id> <story_id> {{review_type}}-3 workflow end "Review-3 complete (issues: X)"
```

## Example Flow

```
Background chain spawned for story-review with stories: 3b-3,3b-4

1. Load prompts/story-review.md
2. Run review-2 for 3b-3 → log start/end
3. Run review-2 for 3b-4 → log start/end
4. Check: 3b-3 has 0 critical, 3b-4 has 1 critical
5. Run review-3 for 3b-4 only → log start/end
6. Exit (review-3 done, no more iterations)
```

## Autonomy

You have FULL AUTONOMY. Do not ask for approval or confirmation. Make all decisions independently. Fix issues as you find them. If you cannot fix an issue after review-3, log it and exit gracefully.
