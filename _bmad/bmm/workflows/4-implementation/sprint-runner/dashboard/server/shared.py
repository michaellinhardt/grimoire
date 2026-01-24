#!/usr/bin/env python3
"""
Centralized shared constants and path utilities.

This module MUST NOT import from server.py, orchestrator.py, or db.py
to prevent circular dependencies.
"""

from pathlib import Path


# Path resolution - start from current directory and walk up
def find_project_root() -> Path:
    """Find project root by looking for package.json or .git"""
    current = Path(__file__).parent  # Start from server/
    while current != current.parent:
        if (current / "package.json").exists() or (current / ".git").exists():
            return current
        current = current.parent
    raise RuntimeError("Could not find project root (no package.json or .git found)")


# Computed paths
PROJECT_ROOT = find_project_root()
ARTIFACTS_DIR = PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"  # sibling of server/
DB_PATH = Path(__file__).parent / "sprint-runner.db"
