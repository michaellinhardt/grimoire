#!/bin/bash
set -e

# Usage: ./orchestrator.sh <epic_id> <story_id> <command> <task_id> <status>
# status: "start" or "end"

EPIC_ID="$1"
STORY_ID="$2"
COMMAND="$3"
TASK_ID="$4"
STATUS="$5"
OUTPUT_FILE="./docs/sprint-runner.csv"

if [[ -z "$EPIC_ID" || -z "$STORY_ID" || -z "$COMMAND" || -z "$TASK_ID" || -z "$STATUS" ]]; then
    echo "Usage: $0 <epic_id> <story_id> <command> <task_id> <status>" >&2
    exit 1
fi

if [[ "$STATUS" != "start" && "$STATUS" != "end" ]]; then
    echo "Error: status must be 'start' or 'end'" >&2
    exit 1
fi

TIMESTAMP=$(date +%s)
echo "${TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${TASK_ID},${STATUS}" >> "$OUTPUT_FILE"
