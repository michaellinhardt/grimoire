#!/usr/bin/env python3
"""
Sprint Runner Orchestrator - Deterministic workflow automation.

Implements the workflow defined in instructions.md without LLM interpretation.
Spawns Claude CLI subagents and parses NDJSON output streams.

Usage:
    python orchestrator.py          # Run 2 cycles (default)
    python orchestrator.py 3        # Run 3 cycles
    python orchestrator.py all      # Run until all stories done
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import io
import json
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, AsyncGenerator, Optional

import logging
import subprocess
from xml.sax.saxutils import escape as xml_escape

import yaml

# Module-level logger
logger = logging.getLogger(__name__)

# Imports from sibling modules (Story 5-SR-2 and 5-SR-5)
from .settings import get_settings

try:
    from .db import (
        init_db,
        create_batch,
        update_batch,
        get_active_batch,
        create_story,
        update_story,
        get_story,
        get_story_by_key,
        create_command,
        update_command,
        create_event,
        create_background_task,
        update_background_task,
    )
except ImportError:
    # Stubs for development before dependencies are complete
    def init_db() -> None:
        pass

    def create_batch(**kwargs: Any) -> int:
        return 1

    def update_batch(**kwargs: Any) -> None:
        pass

    def get_active_batch() -> Optional[dict]:
        return None

    def create_story(**kwargs: Any) -> int:
        return 1

    def update_story(**kwargs: Any) -> None:
        pass

    def get_story(**kwargs: Any) -> Optional[dict]:
        return None

    def get_story_by_key(**kwargs: Any) -> Optional[dict]:
        return None

    def create_command(**kwargs: Any) -> int:
        return 1

    def update_command(**kwargs: Any) -> None:
        pass

    def create_event(**kwargs: Any) -> int:
        return 1

    def create_background_task(**kwargs: Any) -> int:
        return 1

    def update_background_task(**kwargs: Any) -> None:
        pass


# WebSocket broadcast - import from server module (Story 5-SR-5)
try:
    from .server import broadcast, emit_event as server_emit_event, EventType
    _websocket_available = True
except ImportError:
    _websocket_available = False

    async def broadcast(event: dict) -> None:
        """Broadcast stub when server module not available."""
        pass


async def broadcast_websocket(message: str) -> None:
    """Broadcast message to all connected WebSocket clients."""
    if _websocket_available:
        try:
            event = json.loads(message)
            await broadcast(event)
        except (json.JSONDecodeError, Exception):
            pass


class OrchestratorState(Enum):
    """State machine for orchestrator lifecycle."""

    IDLE = "idle"  # Not running
    STARTING = "starting"  # Initializing batch
    RUNNING_CYCLE = "running"  # Executing workflow steps
    WAITING_CHILD = "waiting"  # Subprocess active
    STOPPING = "stopping"  # Graceful shutdown in progress


class Orchestrator:
    """
    Main orchestrator for sprint-runner workflow automation.

    Implements the exact workflow defined in instructions.md:
    - Step 0: Project context check
    - Step 1: Read sprint-status.yaml, select stories
    - Step 2: Create-story + discovery (parallel)
    - Step 2b: Story-review with background chain
    - Step 3: Create-tech-spec (conditional)
    - Step 3b: Tech-spec-review with background chain
    - Step 4: Dev-story + code-review loop
    - Step 4c: Batch-commit
    - Step 6: Cycle tracking and batch completion
    """

    def __init__(
        self,
        batch_mode: str = "fixed",
        max_cycles: Optional[int] = None,
        project_root: Optional[Path] = None,
    ):
        """
        Initialize the orchestrator.

        Args:
            batch_mode: "fixed" for limited cycles, "all" for infinite
            max_cycles: Maximum cycles for "fixed" mode (defaults from settings)
            project_root: Project root path (defaults to cwd)
        """
        self.batch_mode = batch_mode
        # Use settings default if not specified
        if max_cycles is None:
            max_cycles = get_settings().default_max_cycles
        self.max_cycles = max_cycles
        self.project_root = project_root or Path.cwd()

        # State tracking
        self.state = OrchestratorState.IDLE
        self.stop_requested = False
        self.cycles_completed = 0

        # Current execution context
        self.current_batch_id: Optional[int] = None
        self.current_story_keys: list[str] = []
        self.tech_spec_needed = False
        self.tech_spec_decisions: dict[str, str] = {}

        # Error tracking for code-review loop
        self.error_history: dict[str, list[str]] = {}

        # Background tasks for graceful shutdown (HIGH #2)
        self._background_tasks: list[asyncio.Task] = []

    async def start(self) -> None:
        """Start the orchestrator main loop."""
        self.state = OrchestratorState.STARTING

        # Initialize database
        init_db()

        # Create new batch
        self.current_batch_id = create_batch(
            max_cycles=self.max_cycles if self.batch_mode == "fixed" else 999
        )

        self.emit_event(
            "batch:start",
            {
                "batch_id": self.current_batch_id,
                "max_cycles": self.max_cycles if self.batch_mode == "fixed" else None,
                "batch_mode": self.batch_mode,
            },
        )

        # Step 0: Project context check
        await self.check_project_context()

        # Copy project context for this batch
        context_copied = self.copy_project_context()
        if not context_copied:
            self.emit_event(
                "batch:warning",
                {
                    "batch_id": self.current_batch_id,
                    "warning": "Project context not available - proceeding without context",
                },
            )
            # Continue anyway - agents can function without project context

        self.state = OrchestratorState.RUNNING_CYCLE

        # Main loop
        while not self.stop_requested:
            success = await self.run_cycle()

            if not success:
                # All stories done or blocked
                break

            if self.batch_mode == "fixed" and self.cycles_completed >= self.max_cycles:
                self.emit_event(
                    "batch:end",
                    {
                        "batch_id": self.current_batch_id,
                        "cycles_completed": self.cycles_completed,
                        "status": "completed",
                    },
                )
                break

        # Finalize batch
        update_batch(
            batch_id=self.current_batch_id,
            ended_at=int(time.time()),
            cycles_completed=self.cycles_completed,
            status="stopped" if self.stop_requested else "completed",
        )

        self.state = OrchestratorState.IDLE

    async def stop(self) -> None:
        """Request graceful shutdown with child process termination (HIGH #2)."""
        self.stop_requested = True
        # Terminate any active child processes
        for task in self._background_tasks:
            task.cancel()
        self.emit_event("batch:end", {"batch_id": self.current_batch_id, "status": "stopped"})

    # =========================================================================
    # Step 0: Project Context Check (Story 5-SR-4)
    # =========================================================================

    def _get_context_max_age_seconds(self) -> int:
        """Get project context max age from settings."""
        return get_settings().project_context_max_age_hours * 3600

    def _get_injection_warning_threshold(self) -> int:
        """Get injection warning threshold in bytes from settings."""
        return get_settings().injection_warning_kb * 1024

    def _get_injection_error_threshold(self) -> int:
        """Get injection error threshold in bytes from settings."""
        return get_settings().injection_error_kb * 1024

    def copy_project_context(self) -> bool:
        """
        Copy project-context.md to sprint-project-context.md for injection.

        Called once at batch start to ensure all agents in a sprint batch
        receive identical, frozen context.

        Returns:
            True if copy succeeded, False if copy fails for any reason.
        """
        source = self.project_root / "_bmad-output/planning-artifacts/project-context.md"
        dest = self.project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"

        try:
            # Ensure destination directory exists
            dest.parent.mkdir(parents=True, exist_ok=True)
        except (OSError, PermissionError) as e:
            self.emit_event(
                "context:copy_failed",
                {
                    "source": str(source),
                    "reason": f"Failed to create destination directory: {e}",
                    "message": "Could not create directory for sprint-project-context.md",
                },
            )
            return False

        try:
            # Read source content
            content = source.read_text(encoding="utf-8")
        except FileNotFoundError:
            self.emit_event(
                "context:copy_failed",
                {
                    "source": str(source),
                    "reason": "Source file does not exist",
                    "message": "project-context.md not found - agents will not have project context",
                },
            )
            return False
        except (OSError, PermissionError) as e:
            self.emit_event(
                "context:copy_failed",
                {
                    "source": str(source),
                    "reason": f"Failed to read source file: {e}",
                    "message": "Could not read project-context.md",
                },
            )
            return False

        try:
            # Write content to destination (overwrites existing file)
            dest.write_text(content, encoding="utf-8")
        except (OSError, PermissionError) as e:
            self.emit_event(
                "context:copy_failed",
                {
                    "source": str(source),
                    "reason": f"Failed to write destination file: {e}",
                    "message": "Could not write sprint-project-context.md",
                },
            )
            return False

        self.emit_event(
            "context:copied",
            {
                "source": str(source),
                "destination": str(dest),
                "message": "Project context copied for sprint batch",
            },
        )
        return True

    def cleanup_batch_files(self, story_keys: list[str]) -> int:
        """
        Move completed story artifacts to archived-artifacts folder.

        Scans implementation-artifacts/ for files matching any of the provided
        story keys and moves them to archived-artifacts/. Creates the archive
        directory if it doesn't exist.

        Args:
            story_keys: List of story keys to match files for (e.g., ["2a-1", "2a-2"])

        Returns:
            Count of files successfully moved.
        """
        import shutil

        impl_artifacts = self.project_root / "_bmad-output/implementation-artifacts"
        archive_dir = self.project_root / "_bmad-output/archived-artifacts"

        # Early return if no story keys or source dir doesn't exist
        if not story_keys:
            self.emit_event(
                "cleanup:complete",
                {
                    "files_moved": 0,
                    "story_keys": [],
                    "message": "Cleanup complete: 0 files archived (no story keys provided)",
                },
            )
            return 0

        if not impl_artifacts.exists():
            self.emit_event(
                "cleanup:complete",
                {
                    "files_moved": 0,
                    "story_keys": story_keys,
                    "message": "Cleanup complete: 0 files archived (source directory missing)",
                },
            )
            return 0

        # Create archive directory
        try:
            archive_dir.mkdir(parents=True, exist_ok=True)
        except (OSError, PermissionError) as e:
            self.emit_event(
                "cleanup:error",
                {
                    "error": f"Failed to create archive directory: {e}",
                    "message": "Cannot proceed with cleanup",
                },
            )
            self.emit_event(
                "cleanup:complete",
                {
                    "files_moved": 0,
                    "story_keys": story_keys,
                    "message": "Cleanup complete: 0 files archived (archive directory creation failed)",
                },
            )
            return 0

        # Collect files to move (using set to deduplicate)
        files_to_move: set[Path] = set()
        for story_key in story_keys:
            story_key_lower = story_key.lower()
            for file_path in impl_artifacts.iterdir():
                if file_path.is_file() and story_key_lower in file_path.name.lower():
                    files_to_move.add(file_path)

        # Move files
        files_moved = 0
        for file_path in sorted(files_to_move, key=lambda p: p.name.lower()):
            dest = archive_dir / file_path.name
            try:
                shutil.move(str(file_path), str(dest))
                files_moved += 1
                self.emit_event(
                    "cleanup:file_moved",
                    {
                        "source": str(file_path),
                        "destination": str(dest),
                        "file_name": file_path.name,
                    },
                )
            except (OSError, PermissionError, shutil.Error) as e:
                self.emit_event(
                    "cleanup:file_error",
                    {
                        "file": str(file_path),
                        "error": str(e),
                        "message": f"Failed to move {file_path.name}",
                    },
                )
                # Continue processing other files

        self.emit_event(
            "cleanup:complete",
            {
                "files_moved": files_moved,
                "story_keys": story_keys,
                "message": f"Cleanup complete: {files_moved} files archived",
            },
        )

        return files_moved

    def check_project_context_status(self) -> str:
        """
        Check the status of project-context.md file.

        Returns:
            "missing" - file does not exist
            "expired" - file exists but is older than 24 hours
            "fresh" - file exists and is less than 24 hours old
        """
        context_path = (
            self.project_root / "_bmad-output/planning-artifacts/project-context.md"
        )

        if not context_path.exists():
            return "missing"

        file_mtime = context_path.stat().st_mtime
        current_time = time.time()
        age_seconds = current_time - file_mtime

        if age_seconds > self._get_context_max_age_seconds():
            return "expired"

        return "fresh"

    async def check_project_context(self) -> None:
        """
        Check and refresh project context if needed (Step 0).

        Behavior:
        - missing: Create context (BLOCKING - wait for completion)
        - expired: Refresh in background (NON-BLOCKING - continue immediately)
        - fresh: Log status and skip
        """
        status = self.check_project_context_status()

        if status == "missing":
            # Missing: spawn and WAIT (blocking)
            await self.create_project_context()
        elif status == "expired":
            # Expired: spawn in BACKGROUND (non-blocking)
            await self.refresh_project_context_background()
        else:
            # Fresh: log and skip
            self.emit_event(
                "context:fresh",
                {"message": "Project context is fresh, skipping regeneration"},
            )

    async def create_project_context(self) -> None:
        """
        Create project context (BLOCKING - waits for completion).

        Used when project-context.md is missing. The orchestrator
        will wait for this to complete before continuing the loop.
        """
        self.emit_event("context:create", {"status": "starting"})

        # Log event to database
        create_event(
            batch_id=self.current_batch_id,
            story_id=None,
            command_id=None,
            event_type="context:create",
            epic_id="system",
            story_key="context",
            command="generate-project-context",
            task_id="context",
            status="create",
            message="Creating project context (blocking)",
        )

        prompt = self._generate_context_prompt()
        await self.spawn_subagent(prompt, "generate-project-context", wait=True)

        self.emit_event("context:create", {"status": "complete"})

    async def refresh_project_context_background(self) -> None:
        """
        Refresh project context in background (NON-BLOCKING - returns immediately).

        Used when project-context.md exists but is expired. The orchestrator
        continues immediately while the refresh happens in the background.
        """
        # Create background task record in database
        task_id = create_background_task(
            batch_id=self.current_batch_id,
            story_key="system",
            task_type="project-context-refresh",
        )

        # Log event to database
        create_event(
            batch_id=self.current_batch_id,
            story_id=None,
            command_id=None,
            event_type="context:refresh",
            epic_id="system",
            story_key="context",
            command="generate-project-context",
            task_id="context",
            status="refresh",
            message="Starting background context refresh",
        )

        # Emit immediate WebSocket event
        self.emit_event(
            "context:refresh",
            {"task_id": task_id, "status": "started"},
        )

        # Spawn background task (fire and forget)
        asyncio.create_task(self._run_background_context_refresh(task_id))

        # Return immediately - main loop continues

    async def _run_background_context_refresh(self, task_id: int) -> None:
        """
        Background task that actually runs the context refresh.

        Updates the background_tasks record and emits completion event when done.
        """
        try:
            prompt = self._generate_context_prompt()
            await self.spawn_subagent(prompt, "generate-project-context", wait=True)

            # Update background task record
            update_background_task(
                task_id,
                status="completed",
                completed_at=int(time.time()),
            )

            # Emit completion event
            self.emit_event(
                "context:complete",
                {"task_id": task_id, "status": "completed"},
            )

        except Exception as e:
            # Update background task with error status
            update_background_task(
                task_id,
                status="error",
                completed_at=int(time.time()),
            )
            # Log error but don't crash - this is background work
            self.emit_event(
                "context:error",
                {"task_id": task_id, "status": "error", "error": str(e)},
            )

    async def _run_background_task(
        self, task_type: str, prompt: str, is_background: bool
    ) -> None:
        """Run a background task and track completion."""
        try:
            task_id = create_background_task(
                batch_id=self.current_batch_id,
                story_key=",".join(self.current_story_keys),
                task_type=task_type,
            )

            await self.spawn_subagent(prompt, task_type, wait=True)

            update_background_task(
                task_id,
                status="completed",
                completed_at=int(time.time()),
            )

            self.emit_event(
                "background:complete",
                {"task_id": task_id, "task_type": task_type, "status": "completed"},
            )

        except asyncio.CancelledError:
            # Task was cancelled during shutdown
            pass
        except Exception as e:
            self.emit_event(
                "background:error",
                {"task_type": task_type, "status": "error", "error": str(e)},
            )

    def _generate_context_prompt(self) -> str:
        """Generate the project context refresh prompt."""
        return f"""AUTONOMOUS MODE - Generate fresh project context.

Run the workflow: /bmad:bmm:workflows:generate-project-context

CRITICAL: Do NOT read project-context.md first - it may have been deleted.
Run the workflow to generate a fresh copy.

Output the file to: {self.project_root}/_bmad-output/planning-artifacts/project-context.md
"""

    # =========================================================================
    # Step 1: Sprint Status Reading and Story Selection (AC: #1)
    # =========================================================================

    def read_sprint_status(self) -> dict:
        """Read and parse sprint-status.yaml."""
        status_path = (
            self.project_root / "_bmad-output/implementation-artifacts/sprint-status.yaml"
        )
        if not status_path.exists():
            raise FileNotFoundError(f"sprint-status.yaml not found at {status_path}")
        with open(status_path, "r") as f:
            return yaml.safe_load(f)

    def select_stories(self, status: dict) -> list[str]:
        """Select next 1-2 stories for processing (Step 1)."""
        dev_status = status.get("development_status", {})

        # Filter: exclude epic-* and *-retrospective
        stories = [
            key
            for key in dev_status.keys()
            if not key.startswith("epic-") and not key.endswith("-retrospective")
        ]

        # Filter: exclude done and blocked
        available = [
            key for key in stories if dev_status[key] not in ("done", "blocked")
        ]

        # Sort numerically
        available.sort(key=self._story_sort_key)

        if not available:
            return []

        # Pairing logic: try to pair 2 stories from same epic
        first = available[0]
        first_epic = self._extract_epic(first)

        for story in available[1:]:
            if self._extract_epic(story) == first_epic:
                return [first, story]

        return [first]

    def _extract_epic(self, story_key: str) -> str:
        """
        Extract epic prefix from story key.

        Examples:
            "2a-1" -> "2a"
            "2a-1-first" -> "2a"
            "3b-2" -> "3b"
            "5-sr-3" -> "5-sr"
            "5-sr-3-python-orchestrator" -> "5-sr"
        """
        # Match pattern: digit + optional letter + optional letter-suffix, then dash + story number
        # Examples: "2a-1", "5-sr-3", "2a-1-some-name"
        match = re.match(r"^(\d+[a-z]?(?:-[a-z]+)?)-\d+", story_key)
        if match:
            return match.group(1)
        # Fallback: split on last dash
        parts = story_key.rsplit("-", 1)
        return parts[0] if len(parts) > 1 else story_key

    def _story_sort_key(self, key: str) -> tuple:
        """Sort key for numeric story ordering."""
        # Patterns: 1-1, 2-3, 2a-1, 3b-2, 5-sr-3
        match = re.match(r"^(\d+)([a-z]?(?:-[a-z]+)?)-(\d+)", key)
        if match:
            major = int(match.group(1))
            suffix = match.group(2) or ""
            story_num = int(match.group(3))
            return (major, suffix, story_num)
        return (999, "", 999)

    # =========================================================================
    # Claude CLI Spawning (AC: #2)
    # =========================================================================

    async def spawn_subagent(
        self,
        prompt: str,
        prompt_name: str = "unknown",
        wait: bool = True,
        is_background: bool = False,
        model: Optional[str] = None,
        prompt_system_append: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Spawn Claude CLI subagent.

        Args:
            prompt: The prompt text to send via stdin
            prompt_name: Name for logging
            wait: If True, await completion
            is_background: If True, track in background_tasks table
            model: Optional model override (e.g., 'haiku')
            prompt_system_append: Optional content to append to system prompt via
                --prompt-system-append flag. Used for context injection (default: None).

        Returns:
            Dict with 'events' list, 'exit_code', 'stdout' (only if wait=True)
        """
        args = ["claude", "-p", "--output-format", "stream-json"]

        # Model override for review-2+ (uses Haiku)
        if model:
            args.extend(["--model", model])

        # Prompt system append for context injection (Story A-2)
        if prompt_system_append:
            args.extend(["--prompt-system-append", prompt_system_append])

        self.state = OrchestratorState.WAITING_CHILD

        process = await asyncio.subprocess.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=os.environ.copy(),
            cwd=str(self.project_root),
        )

        # Send prompt via stdin with error handling (CRITICAL #2)
        try:
            if process.stdin:
                process.stdin.write(prompt.encode())
                await process.stdin.drain()
                process.stdin.close()
        except (BrokenPipeError, ConnectionResetError, OSError) as e:
            print(f"Error sending prompt to Claude CLI: {e}")
            if process.returncode is None:
                process.kill()
            raise

        if wait:
            results: list[dict] = []
            stdout_content = ""

            async for event in self._parse_ndjson_stream(process):
                results.append(event)
                self._handle_stream_event(event)

                # Accumulate stdout for tech-spec decision parsing
                if event.get("type") == "assistant":
                    content = event.get("message", {}).get("content", [])
                    for block in content:
                        if block.get("type") == "text":
                            stdout_content += block.get("text", "")

            await process.wait()
            self.state = OrchestratorState.RUNNING_CYCLE

            return {
                "events": results,
                "exit_code": process.returncode,
                "stdout": stdout_content,
            }
        else:
            # Fire and forget
            if is_background:
                task = asyncio.create_task(
                    self._run_background_task(prompt_name, prompt, is_background)
                )
                self._background_tasks.append(task)
                task.add_done_callback(self._background_tasks.remove)
            self.state = OrchestratorState.RUNNING_CYCLE  # Reset state (MEDIUM #1)
            return {}

    # =========================================================================
    # NDJSON Stream Parsing (AC: #3)
    # =========================================================================

    async def _parse_ndjson_stream(
        self, process: asyncio.subprocess.Process
    ) -> AsyncGenerator[dict, None]:
        """Parse NDJSON from subprocess stdout."""
        if not process.stdout:
            return

        while True:
            line = await process.stdout.readline()
            if not line:
                break

            line_str = line.decode().strip()
            if not line_str:
                continue

            try:
                event = json.loads(line_str)
                yield event
            except json.JSONDecodeError:
                # Skip malformed lines
                pass

    def _extract_task_event(self, event: dict) -> Optional[dict]:
        """Extract task-id event from tool_result content."""
        if event.get("type") != "tool_result":
            return None

        content = event.get("content", "")
        if not isinstance(content, str):
            return None

        # Look for CSV log lines
        for line in content.split("\n"):
            parsed = self._parse_csv_log_line(line)
            if parsed:
                return parsed

        return None

    def _parse_csv_log_line(self, line: str) -> Optional[dict]:
        """Parse orchestrator.sh CSV log line."""
        # Format: timestamp,epicID,storyID,command,task-id,status,"message"
        try:
            reader = csv.reader(io.StringIO(line))
            row = next(reader)
            if len(row) >= 7:
                timestamp = int(row[0])
                # Dynamic timestamp validation (MEDIUM #2): allow past year to 1 hour in future
                now = int(time.time())
                if now - 31536000 <= timestamp <= now + 3600:
                    return {
                        "timestamp": timestamp,
                        "epic_id": row[1],
                        "story_id": row[2],
                        "command": row[3],
                        "task_id": row[4],
                        "status": row[5],
                        "message": row[6],
                    }
        except (ValueError, StopIteration, csv.Error):
            pass
        return None

    # =========================================================================
    # Database Event Logging (AC: #3, #4)
    # =========================================================================

    def _handle_stream_event(self, event: dict) -> None:
        """Handle stream event: log to database and emit WebSocket."""
        task_info = self._extract_task_event(event)

        if task_info:
            # Log to database - derive event_type from status
            event_type = "command:start" if task_info["status"] == "start" else "command:end"
            create_event(
                batch_id=self.current_batch_id,
                story_id=None,  # Would need DB lookup for story record ID
                command_id=None,
                event_type=event_type,
                epic_id=task_info["epic_id"],
                story_key=task_info["story_id"],
                command=task_info["command"],
                task_id=task_info["task_id"],
                status=task_info["status"],
                message=task_info["message"],
            )

            # Emit WebSocket event
            ws_type = "command:start" if task_info["status"] == "start" else "command:end"
            self.emit_event(
                ws_type,
                {
                    "story_key": task_info["story_id"],
                    "command": task_info["command"],
                    "task_id": task_info["task_id"],
                    "message": task_info["message"],
                },
            )

    # =========================================================================
    # WebSocket Event Emission (AC: #3, #4)
    # =========================================================================

    def emit_event(self, event_type: str, payload: dict) -> None:
        """Emit WebSocket event to all connected clients."""
        event = {
            "type": event_type,
            "payload": payload,
            "timestamp": int(datetime.now().timestamp() * 1000),
        }

        try:
            asyncio.create_task(broadcast_websocket(json.dumps(event)))
        except Exception:
            # No connected clients or broadcast failed - continue anyway
            pass

    # =========================================================================
    # Sprint Status Updates (AC: #4)
    # =========================================================================

    def update_sprint_status(self, story_key: str, new_status: str) -> None:
        """Update story status in sprint-status.yaml."""
        status_path = (
            self.project_root / "_bmad-output/implementation-artifacts/sprint-status.yaml"
        )

        with open(status_path, "r") as f:
            data = yaml.safe_load(f)

        old_status = data.get("development_status", {}).get(story_key)

        if "development_status" not in data:
            data["development_status"] = {}
        data["development_status"][story_key] = new_status

        with open(status_path, "w") as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)

        # Emit WebSocket event
        self.emit_event(
            "story:status",
            {
                "story_key": story_key,
                "old_status": old_status,
                "new_status": new_status,
            },
        )

        # Update database
        ended_at = int(time.time()) if new_status in ("done", "blocked") else None
        story_record = get_story_by_key(story_key=story_key, batch_id=self.current_batch_id)
        if story_record:
            update_story(story_id=story_record["id"], status=new_status, ended_at=ended_at)

    def _get_story_status(self, story_key: str) -> str:
        """Get current status of a story from sprint-status.yaml."""
        status = self.read_sprint_status()
        return status.get("development_status", {}).get(story_key, "unknown")

    # =========================================================================
    # Prompt System Append (Story A-1)
    # =========================================================================

    def build_prompt_system_append(
        self,
        command_name: str,
        story_keys: list[str],
        include_project_context: bool = True,
        include_discovery: bool = False,
        include_tech_spec: bool = False,
        additional_files: Optional[list[str]] = None,
    ) -> str:
        """
        Build the --prompt-system-append content for a subagent.

        Scans for files matching story IDs, deduplicates, and generates
        XML injection format. Files are read fresh at each call (no caching).

        Args:
            command_name: Name of the command being executed (for logging)
            story_keys: List of story keys to match files for
            include_project_context: Include sprint-project-context.md
            include_discovery: Include discovery files for the stories
            include_tech_spec: Include tech-spec files for the stories
            additional_files: Explicit additional file paths to include

        Returns:
            Complete XML string ready for --prompt-system-append.
            Returns valid XML with empty file_injections if no files match.

        Raises:
            ValueError: If injection size exceeds 150KB
        """
        files_to_inject: list[tuple[str, str]] = []  # (relative_path, content)
        seen_paths: set[str] = set()

        def add_file(path: Path) -> None:
            """Add file to injection list if not already seen. Silently skips unreadable files."""
            if not path.exists() or not path.is_file():
                return
            # Convert to relative path for XML
            try:
                rel_path = str(path.relative_to(self.project_root))
            except ValueError:
                rel_path = str(path)
            if rel_path not in seen_paths:
                seen_paths.add(rel_path)
                # CRITICAL FIX: Handle file read errors gracefully (Issue #1)
                try:
                    content = path.read_text()
                    files_to_inject.append((rel_path, content))
                except (OSError, UnicodeDecodeError, PermissionError):
                    # Silently skip unreadable files (binary, locked, encoding issues)
                    pass

        # AC9: File ordering - collect files in specific order:
        # 1. Project context, 2. Story files, 3. Discovery files, 4. Tech-spec files, 5. Additional files

        # Step 1: Project context (if requested)
        if include_project_context:
            ctx_path = self.project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"
            add_file(ctx_path)

        # Scan and categorize files from implementation-artifacts
        # Use sets during collection to prevent duplicate file reads (Issue #2)
        impl_artifacts = self.project_root / "_bmad-output/implementation-artifacts"
        story_file_paths: set[Path] = set()
        discovery_file_paths: set[Path] = set()
        tech_spec_file_paths: set[Path] = set()

        if impl_artifacts.exists():
            for story_key in story_keys:
                story_key_lower = story_key.lower()
                for file_path in impl_artifacts.iterdir():
                    if not file_path.is_file():
                        continue
                    filename_lower = file_path.name.lower()
                    if story_key_lower not in filename_lower:
                        continue

                    # Categorize by type (using sets prevents duplicates from multi-story matching)
                    is_discovery = "discovery" in filename_lower
                    is_tech_spec = "tech-spec" in filename_lower

                    if is_discovery:
                        discovery_file_paths.add(file_path)
                    elif is_tech_spec:
                        tech_spec_file_paths.add(file_path)
                    else:
                        story_file_paths.add(file_path)

        # Step 2: Add story files (sorted for deterministic output - Issue #4)
        for file_path in sorted(story_file_paths, key=lambda p: p.name.lower()):
            add_file(file_path)

        # Step 3: Add discovery files (when include_discovery=True)
        if include_discovery:
            for file_path in sorted(discovery_file_paths, key=lambda p: p.name.lower()):
                add_file(file_path)

        # Step 4: Add tech-spec files (when include_tech_spec=True)
        if include_tech_spec:
            for file_path in sorted(tech_spec_file_paths, key=lambda p: p.name.lower()):
                add_file(file_path)

        # Step 5: Additional explicit files
        if additional_files:
            for file_path_str in additional_files:
                file_path = Path(file_path_str)
                if not file_path.is_absolute():
                    file_path = self.project_root / file_path_str
                add_file(file_path)

        # Log discovery results for debugging (Issue #6)
        if not files_to_inject:
            self.emit_event(
                "injection:empty",
                {
                    "command": command_name,
                    "story_keys": story_keys,
                    "message": "No files matched for injection - check story keys and file paths",
                },
            )

        # Generate XML output
        xml_parts: list[str] = [
            '<file_injections rule="DO NOT read these files - content already provided">'
        ]
        for rel_path, content in files_to_inject:
            # Escape quotes in path attribute to prevent XML breakage (Issue #5)
            safe_path = rel_path.replace('"', '&quot;')
            xml_parts.append(f'  <file path="{safe_path}">')
            xml_parts.append(content)
            xml_parts.append('  </file>')
        xml_parts.append('</file_injections>')

        result = '\n'.join(xml_parts)

        # Size monitoring with threshold checks
        size_bytes = len(result.encode('utf-8'))
        error_threshold = self._get_injection_error_threshold()
        warning_threshold = self._get_injection_warning_threshold()
        if size_bytes > error_threshold:
            raise ValueError(
                f"Injection size ({size_bytes} bytes) exceeds maximum "
                f"({error_threshold} bytes). "
                f"Consider reducing included files for command '{command_name}'."
            )
        if size_bytes > warning_threshold:
            self.emit_event(
                "injection:warning",
                {
                    "command": command_name,
                    "size_bytes": size_bytes,
                    "threshold_bytes": warning_threshold,
                    "message": f"Injection size ({size_bytes} bytes) exceeds warning threshold",
                },
            )

        return result

    def _capture_git_status(self) -> str:
        """Capture current git status for injection into sprint-commit."""
        try:
            result = subprocess.run(
                ["git", "status"],
                cwd=str(self.project_root),
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                return xml_escape(result.stdout)
            else:
                error_msg = f"Error capturing git status (exit {result.returncode}): {result.stderr}"
                logger.warning(error_msg)
                return xml_escape(error_msg)
        except subprocess.TimeoutExpired:
            error_msg = "Error capturing git status: command timed out after 10 seconds"
            logger.warning(error_msg)
            return xml_escape(error_msg)
        except (subprocess.SubprocessError, OSError) as e:
            error_msg = f"Error capturing git status: {e}"
            logger.warning(error_msg)
            return xml_escape(error_msg)

    # =========================================================================
    # Main Orchestration Loop (AC: #1, #5, #6)
    # =========================================================================

    async def run_cycle(self) -> bool:
        """
        Run one orchestration cycle.

        Returns:
            True if more cycles can run, False if all stories done/blocked
        """
        status = self.read_sprint_status()
        story_keys = self.select_stories(status)

        if not story_keys:
            self.emit_event(
                "batch:end",
                {
                    "batch_id": self.current_batch_id,
                    "cycles_completed": self.cycles_completed,
                    "status": "all_done",
                },
            )
            return False

        self.current_story_keys = story_keys
        self.emit_event(
            "cycle:start",
            {"cycle_number": self.cycles_completed + 1, "story_keys": story_keys},
        )

        # Register stories in database
        for story_key in story_keys:
            epic_id = self._extract_epic(story_key)
            create_story(
                batch_id=self.current_batch_id,
                story_key=story_key,
                epic_id=epic_id,
            )

        current_status = status["development_status"].get(story_keys[0], "backlog")

        # Step 2: CREATE-STORY phase
        if current_status == "backlog":
            await self._execute_create_story_phase(story_keys)
            await self._execute_story_review_phase(story_keys)

            if self.tech_spec_needed:
                await self._execute_tech_spec_phase(story_keys)
                await self._execute_tech_spec_review_phase(story_keys)
        elif current_status == "review":
            # Skip directly to code-review (don't re-run dev-story) (HIGH #1)
            pass

        # Step 4: DEV + CODE-REVIEW (handles both ready-for-dev AND review statuses)
        for story_key in story_keys:
            if self.stop_requested:
                break
            await self._execute_dev_phase(story_key)

        # Step 4c: Batch commit
        completed = [k for k in story_keys if self._get_story_status(k) == "done"]
        if completed:
            await self._execute_batch_commit(completed)

        self.cycles_completed += 1
        self.emit_event(
            "cycle:end",
            {"cycle_number": self.cycles_completed, "completed_stories": completed},
        )

        return True

    async def _execute_create_story_phase(self, story_keys: list[str]) -> None:
        """Step 2: Create-story + discovery in parallel using sprint-* commands."""
        story_keys_str = ",".join(story_keys)
        epic_id = self._extract_epic(story_keys[0])

        # Build prompt system append for create-story (project_context only, no discovery yet)
        create_injection = self.build_prompt_system_append(
            command_name="sprint-create-story",
            story_keys=story_keys,
            include_project_context=True,
            include_discovery=False,
            include_tech_spec=False,
        )

        # Build prompt system append for discovery (project_context only)
        discovery_injection = self.build_prompt_system_append(
            command_name="sprint-create-story-discovery",
            story_keys=story_keys,
            include_project_context=True,
            include_discovery=False,
            include_tech_spec=False,
        )

        # Build prompts with story keys and epic id
        create_prompt = f"Story keys: {story_keys_str}\nEpic ID: {epic_id}"
        discovery_prompt = f"Story keys: {story_keys_str}\nEpic ID: {epic_id}"

        # Spawn in parallel with injections
        create_task = asyncio.create_task(
            self.spawn_subagent(
                create_prompt,
                "sprint-create-story",
                prompt_system_append=create_injection,
            )
        )
        discovery_task = asyncio.create_task(
            self.spawn_subagent(
                discovery_prompt,
                "sprint-create-story-discovery",
                prompt_system_append=discovery_injection,
            )
        )

        create_result, discovery_result = await asyncio.gather(
            create_task, discovery_task
        )

        # Parse tech-spec decisions per story (CRITICAL #1)
        self.tech_spec_needed = False
        self.tech_spec_decisions = {}
        stdout = create_result.get("stdout", "")

        self.tech_spec_decisions = self._parse_tech_spec_decisions(stdout, story_keys)
        for decision in self.tech_spec_decisions.values():
            if decision == "REQUIRED":
                self.tech_spec_needed = True

        # Run project-context-injection.sh on discovery files
        for story_key in story_keys:
            discovery_file = (
                self.project_root
                / "_bmad-output/implementation-artifacts"
                / f"sprint-{story_key}-discovery-story.md"
            )
            if discovery_file.exists():
                await self._run_shell_script(
                    "_bmad/scripts/project-context-injection.sh", str(discovery_file)
                )

    async def _execute_story_review_phase(self, story_keys: list[str]) -> None:
        """Step 2b: Story review with background chain using sprint-story-review command."""
        story_keys_str = ",".join(story_keys)
        epic_id = self._extract_epic(story_keys[0])

        # Build injection with project_context and discovery files
        injection = self.build_prompt_system_append(
            command_name="sprint-story-review",
            story_keys=story_keys,
            include_project_context=True,
            include_discovery=True,
            include_tech_spec=False,
        )

        # Build prompt with story keys, epic id, and review attempt
        prompt = f"Story keys: {story_keys_str}\nEpic ID: {epic_id}\nReview attempt: 1"

        result = await self.spawn_subagent(
            prompt,
            "sprint-story-review",
            prompt_system_append=injection,
        )

        has_critical = self._check_for_critical_issues(result.get("stdout", ""))

        if has_critical:
            # Spawn background review chain with same injection
            chain_injection = self.build_prompt_system_append(
                command_name="sprint-story-review",
                story_keys=story_keys,
                include_project_context=True,
                include_discovery=True,
                include_tech_spec=False,
            )
            chain_prompt = f"Story keys: {story_keys_str}\nEpic ID: {epic_id}\nReview attempt: 2\nBackground chain: true"
            asyncio.create_task(
                self.spawn_subagent(
                    chain_prompt,
                    "sprint-story-review-chain",
                    is_background=True,
                    model="haiku",
                    prompt_system_append=chain_injection,
                )
            )

    async def _execute_tech_spec_phase(self, story_keys: list[str]) -> None:
        """Step 3: Create tech-spec using sprint-create-tech-spec command."""
        story_keys_str = ",".join(story_keys)
        epic_id = self._extract_epic(story_keys[0])

        # Build injection with project_context and discovery files
        injection = self.build_prompt_system_append(
            command_name="sprint-create-tech-spec",
            story_keys=story_keys,
            include_project_context=True,
            include_discovery=True,
            include_tech_spec=False,
        )

        # Build prompt with story keys and epic id
        prompt = f"Story keys: {story_keys_str}\nEpic ID: {epic_id}"

        await self.spawn_subagent(
            prompt,
            "sprint-create-tech-spec",
            prompt_system_append=injection,
        )

    async def _execute_tech_spec_review_phase(self, story_keys: list[str]) -> None:
        """Step 3b: Tech-spec review with background chain using sprint-tech-spec-review command."""
        story_keys_str = ",".join(story_keys)
        epic_id = self._extract_epic(story_keys[0])

        # Build injection with project_context, discovery, and tech_spec files
        injection = self.build_prompt_system_append(
            command_name="sprint-tech-spec-review",
            story_keys=story_keys,
            include_project_context=True,
            include_discovery=True,
            include_tech_spec=True,
        )

        # Build prompt with story keys, epic id, and review attempt
        prompt = f"Story keys: {story_keys_str}\nEpic ID: {epic_id}\nReview attempt: 1"

        result = await self.spawn_subagent(
            prompt,
            "sprint-tech-spec-review",
            prompt_system_append=injection,
        )

        has_critical = self._check_for_critical_issues(result.get("stdout", ""))

        if has_critical:
            # Spawn background review chain with same injection
            chain_injection = self.build_prompt_system_append(
                command_name="sprint-tech-spec-review",
                story_keys=story_keys,
                include_project_context=True,
                include_discovery=True,
                include_tech_spec=True,
            )
            chain_prompt = f"Story keys: {story_keys_str}\nEpic ID: {epic_id}\nReview attempt: 2\nBackground chain: true"
            asyncio.create_task(
                self.spawn_subagent(
                    chain_prompt,
                    "sprint-tech-spec-review-chain",
                    is_background=True,
                    model="haiku",
                    prompt_system_append=chain_injection,
                )
            )

    async def _execute_dev_phase(self, story_key: str) -> None:
        """Step 4: Dev-story + code-review loop using sprint-dev-story command."""
        # Update status to in-progress
        self.update_sprint_status(story_key, "in-progress")
        epic_id = self._extract_epic(story_key)

        # Build injection with project_context, discovery, and tech_spec files
        injection = self.build_prompt_system_append(
            command_name="sprint-dev-story",
            story_keys=[story_key],
            include_project_context=True,
            include_discovery=True,
            include_tech_spec=True,
        )

        # Build prompt with story key and epic id
        prompt = f"Story key: {story_key}\nEpic ID: {epic_id}"

        await self.spawn_subagent(
            prompt,
            "sprint-dev-story",
            prompt_system_append=injection,
        )

        # Code review loop
        await self._execute_code_review_loop(story_key)

    async def _execute_code_review_loop(self, story_key: str) -> str:
        """Execute code-review loop until done or blocked using sprint-code-review command."""
        review_attempt = 1
        error_history: list[str] = []
        epic_id = self._extract_epic(story_key)
        settings = get_settings()

        while review_attempt <= settings.max_code_review_attempts:
            # Use Haiku for review after threshold
            model = "haiku" if review_attempt >= settings.haiku_after_review else None

            # Build injection with project_context, discovery, and tech_spec files
            injection = self.build_prompt_system_append(
                command_name="sprint-code-review",
                story_keys=[story_key],
                include_project_context=True,
                include_discovery=True,
                include_tech_spec=True,
            )

            # Build prompt with story key, epic id, and review attempt
            prompt = f"Story key: {story_key}\nEpic ID: {epic_id}\nReview attempt: {review_attempt}"

            result = await self.spawn_subagent(
                prompt,
                f"sprint-code-review-{review_attempt}",
                model=model,
                prompt_system_append=injection,
            )
            stdout = result.get("stdout", "")

            severity = self._parse_highest_severity(stdout)
            error_history.append(severity)

            # Exit conditions
            if severity == "ZERO":
                self.update_sprint_status(story_key, "done")
                return "done"

            if review_attempt >= 3:
                if self._same_errors_3x(error_history):
                    self.update_sprint_status(story_key, "blocked")
                    return "blocked"
                if severity not in ("CRITICAL",):
                    self.update_sprint_status(story_key, "done")
                    return "done"

            review_attempt += 1

        # Hard limit reached
        self.update_sprint_status(story_key, "blocked")
        return "blocked"

    async def _execute_batch_commit(self, completed_stories: list[str]) -> None:
        """Step 4c: Batch commit using sprint-commit command."""
        story_ids_str = ",".join(completed_stories)
        epic_id = self._extract_epic(completed_stories[0])

        # Capture git status for injection
        git_status_output = self._capture_git_status()
        git_status_xml = f"""<git_status>
  <instruction>This is the result of `git status` executed immediately before spawning this agent. Use this to understand the current state of the working directory and what files need to be committed.</instruction>
  <output>
{git_status_output}
  </output>
</git_status>"""

        # Build injection with story files for File List extraction
        injection = self.build_prompt_system_append(
            command_name="sprint-commit",
            story_keys=completed_stories,
            include_project_context=False,
            include_discovery=False,
            include_tech_spec=False,
        )

        # Append git status to injection
        full_injection = injection + "\n" + git_status_xml

        # Validate combined injection size
        size_bytes = len(full_injection.encode('utf-8'))
        error_threshold = self._get_injection_error_threshold()
        warning_threshold = self._get_injection_warning_threshold()
        if size_bytes > error_threshold:
            raise ValueError(
                f"Injection size ({size_bytes} bytes) exceeds maximum "
                f"({error_threshold} bytes) for command 'sprint-commit'."
            )
        if size_bytes > warning_threshold:
            self.emit_event(
                "injection:warning",
                {
                    "command": "sprint-commit",
                    "size_bytes": size_bytes,
                    "threshold_bytes": warning_threshold,
                    "message": f"Injection size ({size_bytes} bytes) exceeds warning threshold",
                },
            )

        # Build prompt with story keys and epic id
        prompt = f"Story keys: {story_ids_str}\nEpic ID: {epic_id}"

        await self.spawn_subagent(
            prompt,
            "sprint-commit",
            prompt_system_append=full_injection,
        )

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _check_for_critical_issues(self, stdout: str) -> bool:
        """Check if output indicates critical issues.

        Supports two marker formats:
        - 'HIGHEST SEVERITY: CRITICAL' (used by code-review)
        - '[CRITICAL-ISSUES-FOUND: YES]' (used by story-review, tech-spec-review)
        """
        return ("HIGHEST SEVERITY: CRITICAL" in stdout or
                "[CRITICAL-ISSUES-FOUND: YES]" in stdout)

    def _parse_highest_severity(self, stdout: str) -> str:
        """Parse highest severity from code-review output."""
        if "ZERO ISSUES" in stdout:
            return "ZERO"
        if "HIGHEST SEVERITY: CRITICAL" in stdout:
            return "CRITICAL"
        if "HIGHEST SEVERITY: HIGH" in stdout:
            return "HIGH"
        if "HIGHEST SEVERITY: MEDIUM" in stdout:
            return "MEDIUM"
        if "HIGHEST SEVERITY: LOW" in stdout:
            return "LOW"
        return "UNKNOWN"

    def _same_errors_3x(self, history: list[str]) -> bool:
        """Check if last 3 error patterns are the same."""
        if len(history) < 3:
            return False
        return history[-1] == history[-2] == history[-3]

    def _parse_tech_spec_decisions(self, stdout: str, story_keys: list) -> dict:
        """Parse tech-spec decisions for each story from stdout (CRITICAL #1)."""
        decisions = re.findall(r'\[TECH-SPEC-DECISION: (REQUIRED|SKIP)\]', stdout, re.IGNORECASE)
        result = {}
        for i, story_key in enumerate(story_keys):
            if i < len(decisions):
                result[story_key] = decisions[i].upper()
            else:
                result[story_key] = "REQUIRED"  # Default
        return result

    def _parse_tech_spec_decision(self, stdout: str) -> str:
        """Parse tech-spec decision from output (legacy single-story)."""
        if "[TECH-SPEC-DECISION: SKIP]" in stdout:
            return "SKIP"
        return "REQUIRED"

    async def _run_shell_script(self, script_path: str, *args: str) -> None:
        """Run a shell script."""
        full_path = self.project_root / script_path
        if not full_path.exists():
            return

        process = await asyncio.subprocess.create_subprocess_exec(
            str(full_path), *args, cwd=str(self.project_root)
        )
        await process.wait()


def main() -> None:
    """Main entry point with argument parsing."""
    parser = argparse.ArgumentParser(
        description="Sprint Runner Orchestrator - Automated workflow execution"
    )
    parser.add_argument(
        "batch_size",
        nargs="?",
        default="2",
        help='Number of cycles to run, or "all" for continuous (default: 2)',
    )
    args = parser.parse_args()

    if args.batch_size.lower() == "all":
        batch_mode = "all"
        max_cycles = 999
    else:
        batch_mode = "fixed"
        try:
            max_cycles = int(args.batch_size)
        except ValueError:
            print(f"Invalid batch_size: {args.batch_size}. Use a number or 'all'.")
            return

    orchestrator = Orchestrator(batch_mode=batch_mode, max_cycles=max_cycles)
    asyncio.run(orchestrator.start())


if __name__ == "__main__":
    main()
