#!/bin/bash
# Sprint Runner v3 - Direct Subagent Logging Script
#
# Usage: sprint-log.sh '{"epic_id":"2a","story_id":"2a-1","command":"create-story","task_id":"setup","status":"start","message":"Initializing"}'
#
# Required JSON fields: epic_id, story_id, command, task_id, status
# Optional JSON fields: message, metrics, attempt
#
# Log format: [timestamp] [epic_id/story_id] [command:task_id] [status] message

# Validate JSON argument
JSON="$1"
if [ -z "$JSON" ]; then
    echo "Error: JSON argument required" >&2
    echo "Usage: sprint-log.sh '{\"epic_id\":\"...\",\"story_id\":\"...\",\"command\":\"...\",\"task_id\":\"...\",\"status\":\"...\"}'" >&2
    exit 1
fi

# Check for jq dependency
if ! command -v jq &> /dev/null; then
    echo "Error: jq is required but not installed. Install with: brew install jq" >&2
    exit 1
fi

# Validate JSON is well-formed before parsing
if ! jq -e '.' <<< "$JSON" > /dev/null 2>&1; then
    echo "Error: Invalid JSON format" >&2
    exit 1
fi

# Parse all JSON fields in a single jq call for efficiency and safety
# Using here-string to avoid echo command injection risks
PARSED=$(jq -r '[
    .epic_id // "",
    .story_id // "",
    .command // "",
    .task_id // "",
    .status // "",
    (.message // "") | gsub("\n"; " ") | gsub("\r"; "") | gsub("\t"; " ")
] | @tsv' <<< "$JSON")

# Split parsed values (tab-separated)
IFS=$'\t' read -r EPIC_ID STORY_ID COMMAND TASK_ID STATUS MESSAGE <<< "$PARSED"

# Validate required fields are present
MISSING_FIELDS=""
[ -z "$EPIC_ID" ] && MISSING_FIELDS="$MISSING_FIELDS epic_id"
[ -z "$STORY_ID" ] && MISSING_FIELDS="$MISSING_FIELDS story_id"
[ -z "$COMMAND" ] && MISSING_FIELDS="$MISSING_FIELDS command"
[ -z "$TASK_ID" ] && MISSING_FIELDS="$MISSING_FIELDS task_id"
[ -z "$STATUS" ] && MISSING_FIELDS="$MISSING_FIELDS status"

if [ -n "$MISSING_FIELDS" ]; then
    echo "Error: Missing required fields:$MISSING_FIELDS" >&2
    exit 1
fi

# Generate timestamp
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Format log entry: [timestamp] [epic_id/story_id] [command:task_id] [status] message
LOG_ENTRY="[$TIMESTAMP] [$EPIC_ID/$STORY_ID] [$COMMAND:$TASK_ID] [$STATUS] $MESSAGE"

# Resolve paths relative to script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/../dashboard"
LOG_FILE="$LOG_DIR/sprint.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Append log entry (atomic operation for single-line writes)
echo "$LOG_ENTRY" >> "$LOG_FILE"
