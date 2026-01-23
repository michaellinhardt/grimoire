#!/bin/bash
set -e  # Exit on error (MEDIUM-1 Resolution)

# orchestrator.sh - Log sprint-runner events in CSV format
# Usage: ./orchestrator.sh <epic_id> <story_id> <command> <result>
# Example: ./orchestrator.sh epic-1 2a.1 dev-story start

EPIC_ID="$1"
STORY_ID="$2"
COMMAND="$3"
RESULT="$4"
OUTPUT_FILE="${BMAD_OUTPUT:-_bmad-output}/implementation-artifacts/orchestrator.md"

# Get Unix timestamp
TIMESTAMP=$(date +%s)

# Append CSV line
echo "${TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${RESULT}" >> "$OUTPUT_FILE"
