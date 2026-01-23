#!/bin/bash
set -e  # Exit on error

# orchestrator.sh - Log sprint-runner events in CSV format
# Usage: ./orchestrator.sh <epic_id> <story_id> <command> <step> <result>
# Example: ./orchestrator.sh epic-2a 2a.1 create-story discovery complete
#
# Duration logic: Each entry's duration = time since previous entry (in seconds)
# This represents how long the PREVIOUS task took before this one started.
# First entry always has duration=0.

EPIC_ID="$1"
STORY_ID="$2"
COMMAND="$3"
STEP="$4"
RESULT="$5"
OUTPUT_FILE="./docs/sprint-runner.csv"

# Validate arguments
if [[ -z "$EPIC_ID" || -z "$STORY_ID" || -z "$COMMAND" || -z "$STEP" || -z "$RESULT" ]]; then
    echo "Usage: $0 <epic_id> <story_id> <command> <step> <result>" >&2
    exit 1
fi

# Get Unix timestamp
TIMESTAMP=$(date +%s)

# Edge case: If file doesn't exist or is empty, first entry gets duration=0
if [[ ! -s "$OUTPUT_FILE" ]]; then
    echo "${TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${STEP},0,${RESULT}" >> "$OUTPUT_FILE"
    exit 0
fi

# Get previous entry's timestamp
PREV_TIMESTAMP=$(tail -n 1 "$OUTPUT_FILE" | cut -d',' -f1)

# Calculate duration in seconds
DURATION=$((TIMESTAMP - PREV_TIMESTAMP))

# Append new row with calculated duration (in seconds)
echo "${TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${STEP},${DURATION},${RESULT}" >> "$OUTPUT_FILE"
