#!/bin/bash
set -e

# =============================================================================
# DEPRECATED: Story 5-SR-8 (2026-01-24)
# =============================================================================
# This shell script CSV event logger has been replaced by Python implementation in:
#   _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py
#   _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py
#
# The Python implementation provides:
#   - SQLite database storage (events table) instead of CSV
#   - Real-time WebSocket event broadcasting
#   - Structured event types with payload validation
#   - Integration with dashboard UI for live monitoring
#
# Event logging is now handled by:
#   - orchestrator.py: emit_event() function for WebSocket broadcast
#   - db.py: create_event() function for database persistence
#
# This script is kept for backwards compatibility with any remaining
# subagent prompts that may reference it, but should not be used.
# New implementations should use the Python event system.
# =============================================================================

# Sprint Runner Event Logger (DEPRECATED)
# Usage: ./orchestrator.sh <epic_id> <story_id> <command> <task_id> <status> <message>
#
# Parameters:
#   epic_id   - Epic identifier (e.g., "2b", "3a")
#   story_id  - Story identifier (e.g., "2b-6", "3a-1")
#   command   - Workflow command (e.g., "create-story", "dev-story")
#   task_id   - Task phase from taxonomy (e.g., "setup", "implement", "validate")
#   status    - Event status: "start" or "end"
#   message   - Descriptive message (required, max 150 chars)
#
# Output format (CSV, 7 columns):
#   timestamp,epicID,storyID,command,task-id,status,"message"
#
# See task-taxonomy.yaml for valid task IDs per command.
#
# NOTE: This script still works but logs to CSV only. For real-time
# dashboard updates, use the Python orchestrator instead.

EPIC_ID="$1"
STORY_ID="$2"
COMMAND="$3"
TASK_ID="$4"
STATUS="$5"
MESSAGE="$6"
OUTPUT_FILE="./docs/sprint-runner.csv"

# Validate required parameters
if [[ -z "$EPIC_ID" || -z "$STORY_ID" || -z "$COMMAND" || -z "$TASK_ID" || -z "$STATUS" ]]; then
    echo "Usage: $0 <epic_id> <story_id> <command> <task_id> <status> <message>" >&2
    exit 1
fi

if [[ "$STATUS" != "start" && "$STATUS" != "end" ]]; then
    echo "Error: status must be 'start' or 'end'" >&2
    exit 1
fi

if [[ -z "$MESSAGE" ]]; then
    echo "Error: message is required" >&2
    exit 1
fi

# Truncate message if exceeds 150 chars
MAX_LENGTH=150
if [[ ${#MESSAGE} -gt $MAX_LENGTH ]]; then
    echo "Warning: message truncated to $MAX_LENGTH chars" >&2
    MESSAGE="${MESSAGE:0:$MAX_LENGTH}"
fi

# CSV escape function (RFC 4180 compliant)
# - Replace newlines with space
# - Escape double quotes as ""
# - Wrap in double quotes
csv_escape_message() {
    local str="$1"
    # Replace newlines and carriage returns with space
    str="${str//$'\n'/ }"
    str="${str//$'\r'/ }"
    # Escape double quotes by doubling them
    str="${str//\"/\"\"}"
    # Return quoted string
    echo "\"$str\""
}

TIMESTAMP=$(date +%s)
ESCAPED_MESSAGE=$(csv_escape_message "$MESSAGE")

echo "${TIMESTAMP},${EPIC_ID},${STORY_ID},${COMMAND},${TASK_ID},${STATUS},${ESCAPED_MESSAGE}" >> "$OUTPUT_FILE"
