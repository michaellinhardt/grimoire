#!/bin/bash
set -e  # Exit on error (MEDIUM-1 Resolution)

# project-context-injection.sh - Inject project context into discovery files
# Usage: ./project-context-injection.sh <file_path>

TARGET_FILE="$1"
OUTPUT_FOLDER="${BMAD_OUTPUT:-_bmad-output}"
CONTEXT_FILE="${OUTPUT_FOLDER}/planning-artifacts/project-context.md"
HEADER="# Project Context Dump Below"

if [ -z "$TARGET_FILE" ]; then
    echo "Error: No target file specified"
    echo "Usage: ./project-context-injection.sh <file_path>"
    exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
    echo "Error: Target file does not exist: $TARGET_FILE"
    exit 1
fi

# Check if already injected
if grep -q "$HEADER" "$TARGET_FILE"; then
    echo "Already injected: $TARGET_FILE"
    exit 0
fi

# Check if project context exists
if [ ! -f "$CONTEXT_FILE" ]; then
    echo "Warning: project-context.md not found, skipping injection"
    exit 0
fi

# Append project context
cat >> "$TARGET_FILE" << EOF

$HEADER
The project context from \`${OUTPUT_FOLDER}/planning-artifacts/project-context.md\` is injected below. Do not read that file separately - use this content.

$(cat "$CONTEXT_FILE")
EOF

echo "Injected project context into: $TARGET_FILE"
