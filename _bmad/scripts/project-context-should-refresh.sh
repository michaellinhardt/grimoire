#!/bin/bash
set -e  # Exit on error (MEDIUM-1 Resolution)

# =============================================================================
# DEPRECATED: Story 5-SR-4 (2026-01-24)
# =============================================================================
# This shell script has been replaced by Python implementation in:
#   _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py
#
# The Python implementation provides:
#   - check_project_context_status() -> "missing" | "expired" | "fresh"
#   - create_project_context() -> blocking creation when missing
#   - refresh_project_context_background() -> non-blocking refresh when expired
#
# Key behavioral difference: This script DELETES the file when expired.
# The Python implementation does NOT delete - it starts a background refresh
# while the existing (stale) file remains available for subagents.
#
# This script is kept for backwards compatibility but should not be used.
# =============================================================================

# project-context-should-refresh.sh - Check if project context needs regeneration
# Returns: exit 0 (TRUE/needs refresh), exit 1 (FALSE/no refresh needed)
# If refresh needed, deletes existing file to force regeneration

OUTPUT_FOLDER="${BMAD_OUTPUT:-_bmad-output}"
CONTEXT_FILE="${OUTPUT_FOLDER}/planning-artifacts/project-context.md"
MAX_AGE_HOURS=24

# Check if file exists
if [ ! -f "$CONTEXT_FILE" ]; then
    echo "TRUE: project-context.md does not exist"
    exit 0
fi

# Check file age (in seconds)
FILE_AGE=$(($(date +%s) - $(stat -f %m "$CONTEXT_FILE" 2>/dev/null || stat -c %Y "$CONTEXT_FILE" 2>/dev/null)))
MAX_AGE_SECONDS=$((MAX_AGE_HOURS * 3600))

if [ "$FILE_AGE" -gt "$MAX_AGE_SECONDS" ]; then
    echo "TRUE: project-context.md is older than ${MAX_AGE_HOURS} hours"
    rm -f "$CONTEXT_FILE"
    exit 0
fi

echo "FALSE: project-context.md is fresh (${FILE_AGE}s old, max ${MAX_AGE_SECONDS}s)"
exit 1
