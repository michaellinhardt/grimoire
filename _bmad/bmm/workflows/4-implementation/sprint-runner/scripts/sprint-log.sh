#!/bin/bash
# Sprint Runner v3 - Direct Subagent Logging Script
#
# Usage: sprint-log.sh '{"epic_id":"2a","story_id":"2a-1","command":"create-story","task_id":"setup","status":"start","message":"Initializing"}'
#
# Required JSON fields: epic_id, story_id, command, task_id, status
# Optional JSON fields: message, metrics, attempt
#
# Outputs:
#   stdout: CSV format for orchestrator parsing
#           Format: timestamp,epicID,storyID,command,task-id,status,"message"
#           Timestamp is Unix epoch seconds (compatible with orchestrator)

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
# For the log file, we sanitize newlines to spaces
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

# Generate Unix epoch timestamp (seconds since 1970-01-01)
TIMESTAMP=$(date +%s)

# Output CSV to stdout for orchestrator parsing
# Format: timestamp,epicID,storyID,command,task-id,status,"message"
#
# CSV escaping rules:
# 1. The message field is always quoted
# 2. Double quotes within the message are escaped by doubling them ("")
# 3. Newlines are replaced with \n literal for CSV compatibility
# 4. Other fields are output as-is (they should not contain special chars)

# Get the raw message with proper escaping for CSV using jq
# - Replace newlines with literal \n
# - Escape double quotes by doubling them
# - Wrap the result in double quotes
CSV_MESSAGE=$(jq -r '
    (.message // "")
    | gsub("\r\n"; "\\n")
    | gsub("\n"; "\\n")
    | gsub("\r"; "\\n")
    | gsub("\""; "\"\"")
' <<< "$JSON")

# Output CSV line to stdout
echo "${TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${TASK_ID},${STATUS},\"${CSV_MESSAGE}\""
