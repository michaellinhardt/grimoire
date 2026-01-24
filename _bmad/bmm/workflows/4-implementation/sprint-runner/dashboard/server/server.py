#!/usr/bin/env python3
"""
Enhanced Dashboard Server with WebSocket Support

Serves dashboard files, provides dynamic story description extraction,
and supports real-time WebSocket events for live dashboard updates.

Features:
- Serves static files from dashboard/ directory
- Dynamically generates story-descriptions.json from story files
- Serves sprint-status.yaml and orchestrator files from implementation-artifacts
- WebSocket endpoint at /ws for real-time event streaming
- Connection tracking and broadcast functionality
- Heartbeat/ping-pong for connection health

Usage:
    cd /path/to/grimoire/_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard
    python3 server.py

Then open: http://localhost:8080/dashboard.html
WebSocket: ws://localhost:8080/ws
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import time
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import yaml
from aiohttp import web, WSMsgType

from .shared import PROJECT_ROOT, ARTIFACTS_DIR, FRONTEND_DIR
from .settings import get_settings

# =============================================================================
# WebSocket Connection Management (AC: #2, #5)
# =============================================================================

# Global WebSocket connection tracking
connected_clients: set[web.WebSocketResponse] = set()

# Lock for thread-safe client set modifications
_clients_lock = asyncio.Lock()


async def add_client(ws: web.WebSocketResponse) -> None:
    """Add a WebSocket client to the tracking set."""
    async with _clients_lock:
        connected_clients.add(ws)
        print(f"WebSocket client connected. Total clients: {len(connected_clients)}")


async def remove_client(ws: web.WebSocketResponse) -> None:
    """Remove a WebSocket client from the tracking set."""
    async with _clients_lock:
        connected_clients.discard(ws)
        print(f"WebSocket client disconnected. Total clients: {len(connected_clients)}")


# =============================================================================
# Event Types and Validation (AC: #3)
# =============================================================================


class EventType(str, Enum):
    """WebSocket event types for real-time updates."""

    # Batch events
    BATCH_START = "batch:start"
    BATCH_END = "batch:end"
    BATCH_WARNING = "batch:warning"

    # Cycle events
    CYCLE_START = "cycle:start"
    CYCLE_END = "cycle:end"

    # Command events
    COMMAND_START = "command:start"
    COMMAND_PROGRESS = "command:progress"
    COMMAND_END = "command:end"

    # Story events
    STORY_STATUS = "story:status"

    # Error events
    ERROR = "error"

    # Context events (from Story 5-SR-4)
    CONTEXT_CREATE = "context:create"
    CONTEXT_REFRESH = "context:refresh"
    CONTEXT_COMPLETE = "context:complete"

    # Ping/Pong for connection health
    PONG = "pong"


# Payload schemas for validation
EVENT_PAYLOAD_SCHEMAS: dict[str, set[str]] = {
    # Batch events
    EventType.BATCH_START: {"batch_id", "max_cycles"},
    EventType.BATCH_END: {"batch_id", "cycles_completed", "status"},
    EventType.BATCH_WARNING: {"batch_id", "message", "warning_type"},
    # Cycle events
    EventType.CYCLE_START: {"cycle_number", "story_keys"},
    EventType.CYCLE_END: {"cycle_number", "completed_stories"},
    # Command events
    EventType.COMMAND_START: {"story_key", "command", "task_id"},
    EventType.COMMAND_PROGRESS: {"story_key", "command", "task_id", "message"},
    EventType.COMMAND_END: {"story_key", "command", "task_id", "status"},
    # Story events
    EventType.STORY_STATUS: {"story_key", "old_status", "new_status"},
    # Error events
    EventType.ERROR: {"type", "message"},
    # Context events
    EventType.CONTEXT_CREATE: {"story_key", "context_type"},
    EventType.CONTEXT_REFRESH: {"story_key", "context_type"},
    EventType.CONTEXT_COMPLETE: {"story_key", "context_type", "status"},
    # Pong (no required fields - just acknowledgement)
    EventType.PONG: set(),
}


def validate_payload(event_type: str, payload: dict[str, Any]) -> bool:
    """
    Validate that payload contains required fields for the event type.

    Args:
        event_type: The event type string
        payload: The payload dictionary

    Returns:
        True if payload is valid, False otherwise
    """
    required_fields = EVENT_PAYLOAD_SCHEMAS.get(event_type)
    if required_fields is None:
        # Unknown event type - allow any payload
        return True
    return required_fields.issubset(payload.keys())


# =============================================================================
# Broadcast Function (AC: #3, #4)
# =============================================================================


async def broadcast(event: dict[str, Any]) -> None:
    """
    Broadcast event to all connected WebSocket clients.

    Args:
        event: Event dictionary with 'type' and 'payload' keys

    Events are delivered in parallel to all clients. Failed connections
    are automatically removed from the tracking set.
    """
    if not connected_clients:
        return

    # Add timestamp if not present
    if "timestamp" not in event:
        event["timestamp"] = int(time.time() * 1000)

    message = json.dumps(event)

    # Send to all clients in parallel, collect failures
    async with _clients_lock:
        if not connected_clients:
            return

        clients_snapshot = list(connected_clients)

    tasks = []
    client_list = []

    for ws in clients_snapshot:
        if not ws.closed:
            tasks.append(ws.send_str(message))
            client_list.append(ws)

    if not tasks:
        return

    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Remove failed connections
    failed = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            failed.append(client_list[i])

    if failed:
        async with _clients_lock:
            for ws in failed:
                connected_clients.discard(ws)
        print(f"Removed {len(failed)} failed connections")


def emit_event(event_type: str | EventType, payload: dict[str, Any]) -> None:
    """
    Emit WebSocket event to all connected clients.

    This is a synchronous wrapper that schedules the broadcast.

    Args:
        event_type: Event type (string or EventType enum)
        payload: Event payload dictionary
    """
    if isinstance(event_type, EventType):
        event_type = event_type.value

    # Validate payload (warning only, still send)
    if not validate_payload(event_type, payload):
        print(
            f"Warning: Invalid payload for event type {event_type}: {payload}",
            file=sys.stderr,
        )

    event = {
        "type": event_type,
        "payload": payload,
        "timestamp": int(time.time() * 1000),
    }

    try:
        asyncio.create_task(broadcast(event))
    except RuntimeError as e:
        # No event loop running - log for debugging
        print(f"Warning: Event '{event_type}' not sent (no event loop): {e}", file=sys.stderr)


# =============================================================================
# Initial State (AC: #2)
# =============================================================================


def normalize_db_event_to_ws(event: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize a database event record to WebSocket event format.

    DB events have flat structure with fields like:
    - id, batch_id, story_id, command_id, timestamp, event_type,
    - epic_id, story_key, command, task_id, status, message, payload_json

    WebSocket events have structure:
    - type: event type string
    - timestamp: milliseconds since epoch
    - payload: dict with event-specific fields

    Args:
        event: Database event record as dict

    Returns:
        WebSocket-formatted event dict
    """
    event_type = event.get("event_type", "")

    # Prefer stored payload_json if available (complete reconstruction)
    if event.get("payload_json"):
        try:
            payload = json.loads(event["payload_json"])
            return {
                "type": event_type,
                "timestamp": event.get("timestamp", 0),
                "payload": payload,
            }
        except json.JSONDecodeError:
            pass  # Fall through to manual extraction

    # Build payload from DB fields based on event type (legacy fallback)
    payload: dict[str, Any] = {}

    # Common fields for command events
    if event_type.startswith("command:"):
        payload["story_key"] = event.get("story_key", "")
        payload["command"] = event.get("command", "")
        payload["task_id"] = event.get("task_id", "")
        if event_type == "command:progress":
            payload["message"] = event.get("message", "")
        elif event_type == "command:end":
            payload["status"] = event.get("status", "")
    elif event_type.startswith("batch:"):
        payload["batch_id"] = event.get("batch_id")
        if event_type == "batch:end":
            payload["cycles_completed"] = event.get("cycles_completed", 0)
            payload["status"] = event.get("status", "")
        elif event_type == "batch:warning":
            payload["message"] = event.get("message", "")
            payload["warning_type"] = "unknown"
    elif event_type.startswith("cycle:"):
        payload["cycle_number"] = event.get("cycle_number", 0)
        # Note: story_keys and completed_stories not available in legacy events
    elif event_type.startswith("story:"):
        payload["story_key"] = event.get("story_key", "")
        payload["old_status"] = event.get("old_status", "")
        payload["new_status"] = event.get("new_status", "")
    elif event_type.startswith("context:"):
        payload["story_key"] = event.get("story_key", "")
        payload["context_type"] = event.get("context_type", "")

    # Include any message if present
    if "message" in event and event["message"]:
        payload["message"] = event["message"]

    return {
        "type": event_type,
        "timestamp": event.get("timestamp", 0),
        "payload": payload,
    }


async def get_initial_state() -> dict[str, Any]:
    """
    Get current batch status and recent events for new connections.

    Returns:
        Dict with 'batch' (current batch or None) and 'events' (recent events)

    Events are filtered to the current batch if one exists, and normalized
    to WebSocket event format for frontend consistency.
    """
    try:
        from .db import get_active_batch, get_events_by_batch

        batch = get_active_batch()

        # Filter events by current batch for relevant initial state
        if batch:
            db_events = get_events_by_batch(batch["id"])
            # Limit to last 50 events, most recent first for display
            db_events = list(reversed(db_events[-50:]))
        else:
            db_events = []

        # Normalize DB events to WebSocket format
        events = [normalize_db_event_to_ws(e) for e in db_events]

        return {"batch": batch, "events": events}
    except ImportError:
        # db module not available
        return {"batch": None, "events": []}
    except Exception as e:
        print(f"Error getting initial state: {e}", file=sys.stderr)
        return {"batch": None, "events": []}


# =============================================================================
# WebSocket Handler (AC: #1, #2, #5)
# =============================================================================


async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    """
    Handle WebSocket connections.

    - Adds client to tracking set on connect
    - Sends initial state immediately
    - Handles incoming messages (for future extensions)
    - Removes client from tracking set on disconnect
    """
    settings = get_settings()
    ws = web.WebSocketResponse(heartbeat=float(settings.websocket_heartbeat_seconds))
    await ws.prepare(request)

    # Add to tracking set
    await add_client(ws)

    try:
        # Send initial state
        initial_state = await get_initial_state()
        await ws.send_json({"type": "init", "payload": initial_state})

        # Handle incoming messages
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                # Handle client messages if needed (future extension)
                try:
                    data = json.loads(msg.data)
                    # Currently no client->server messages defined
                    # Could add: ping, subscribe to specific events, etc.
                    if data.get("type") == "ping":
                        await ws.send_json({"type": "pong"})
                except json.JSONDecodeError:
                    pass
            elif msg.type == WSMsgType.ERROR:
                print(f"WebSocket error: {ws.exception()}", file=sys.stderr)
                break
            elif msg.type == WSMsgType.CLOSE:
                break

    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"WebSocket handler error: {e}", file=sys.stderr)
    finally:
        # Remove from tracking on disconnect
        await remove_client(ws)

    return ws


# =============================================================================
# Heartbeat Task (AC: #5)
# =============================================================================


async def heartbeat_task() -> None:
    """
    Send periodic pings to detect dead connections.

    Runs every 30 seconds and removes connections that don't respond
    within 10 seconds.

    Note: aiohttp's WebSocketResponse with heartbeat=30.0 handles this
    automatically, but this provides additional cleanup for edge cases.
    """
    while True:
        await asyncio.sleep(30)

        if not connected_clients:
            continue

        async with _clients_lock:
            clients_snapshot = list(connected_clients)

        dead_connections = []

        for ws in clients_snapshot:
            if ws.closed:
                dead_connections.append(ws)
                continue

            try:
                # aiohttp handles ping/pong automatically with heartbeat
                # This is a backup check for closed connections
                pass
            except Exception:
                dead_connections.append(ws)

        if dead_connections:
            async with _clients_lock:
                for ws in dead_connections:
                    connected_clients.discard(ws)
            print(f"Cleaned up {len(dead_connections)} dead connections")


# =============================================================================
# Story Description Scanning
# =============================================================================


def extract_story_id(filename: str) -> Optional[str]:
    """Extract full story ID from filename like '2a-1-session-scanner.md'"""
    if filename.endswith(".md"):
        story_id = filename[:-3]
        if re.match(r"^\d+[a-z]?-[\w-]+", story_id):
            return story_id
    return None


def extract_description(filepath: Path) -> Optional[str]:
    """Extract text between ## Story and next ## heading"""
    try:
        content = filepath.read_text(encoding="utf-8")

        story_match = re.search(
            r"^##\s+Story[^\n]*\n(.*?)(?=^##\s|\Z)", content, re.MULTILINE | re.DOTALL
        )

        if story_match:
            description = story_match.group(1).strip()
            description = re.sub(r"\*\*([^*]+)\*\*", r"\1", description)
            description = re.sub(r"\n+", " ", description)
            description = description[:500]
            return description

        lines = content.split("\n")
        for i, line in enumerate(lines):
            if line.startswith("# "):
                desc_lines = []
                for j in range(i + 1, min(i + 10, len(lines))):
                    if lines[j].strip() and not lines[j].startswith("#"):
                        desc_lines.append(lines[j].strip())
                    elif lines[j].startswith("#"):
                        break
                if desc_lines:
                    return " ".join(desc_lines)[:500]

        return None
    except Exception as e:
        print(f"Error reading {filepath}: {e}", file=sys.stderr)
        return None


async def scan_artifacts() -> dict[str, str]:
    """Scan artifacts directory and extract all story descriptions"""
    descriptions: dict[str, str] = {}

    if not ARTIFACTS_DIR.exists():
        print(f"Artifacts directory not found: {ARTIFACTS_DIR}", file=sys.stderr)
        return descriptions

    for filepath in ARTIFACTS_DIR.glob("*.md"):
        filename = filepath.name

        if filename.startswith("tech-spec-"):
            continue
        if filename in ("orchestrator.md", "sprint-status.yaml", "index.md"):
            continue

        story_id = extract_story_id(filename)
        if story_id:
            description = extract_description(filepath)
            if description:
                descriptions[story_id] = description
                print(f"Extracted: {story_id}", file=sys.stderr)

    return descriptions


# =============================================================================
# HTTP Route Handlers (AC: #1)
# =============================================================================


async def index_handler(request: web.Request) -> web.Response:
    """Serve dashboard.html"""
    dashboard_path = FRONTEND_DIR / "index.html"
    if dashboard_path.exists():
        return web.FileResponse(dashboard_path)
    return web.Response(status=404, text="Dashboard not found")


async def story_descriptions_handler(request: web.Request) -> web.Response:
    """Generate and send story descriptions JSON"""
    descriptions = await scan_artifacts()
    return web.json_response(
        descriptions, headers={"Access-Control-Allow-Origin": "*"}
    )


# =============================================================================
# Orchestrator Control Handlers (Story 5-SR-6)
# =============================================================================

# Global orchestrator instance (lazy initialization)
_orchestrator_instance: Optional["Orchestrator"] = None
_orchestrator_task: Optional[asyncio.Task] = None


async def orchestrator_start_handler(request: web.Request) -> web.Response:
    """
    Start the orchestrator with specified batch size.

    POST /api/orchestrator/start
    Body: { "batch_size": number | "all" }
    """
    global _orchestrator_instance, _orchestrator_task

    try:
        data = await request.json()
    except json.JSONDecodeError:
        return web.Response(status=400, text="Invalid JSON body")

    batch_size = data.get("batch_size", 2)

    # Check if already running
    if _orchestrator_instance and _orchestrator_instance.state.value != "idle":
        return web.Response(status=409, text="Orchestrator is already running")

    try:
        from .orchestrator import Orchestrator

        if batch_size == "all":
            _orchestrator_instance = Orchestrator(batch_mode="all", max_cycles=999)
        else:
            try:
                max_cycles = int(batch_size)
                if max_cycles < 1:
                    return web.Response(status=400, text="batch_size must be positive")
                _orchestrator_instance = Orchestrator(batch_mode="fixed", max_cycles=max_cycles)
            except (ValueError, TypeError):
                return web.Response(status=400, text="Invalid batch_size")

        # Start orchestrator in background
        _orchestrator_task = asyncio.create_task(_orchestrator_instance.start())

        return web.json_response(
            {"status": "started", "batch_size": batch_size},
            headers={"Access-Control-Allow-Origin": "*"},
        )

    except ImportError as e:
        return web.Response(status=500, text=f"Orchestrator module not available: {e}")
    except Exception as e:
        return web.Response(status=500, text=f"Failed to start orchestrator: {e}")


async def orchestrator_stop_handler(request: web.Request) -> web.Response:
    """
    Stop the orchestrator gracefully.

    POST /api/orchestrator/stop

    If orchestrator is not running but database has an active batch,
    clean it up and return success with "cleaned" status.
    """
    global _orchestrator_instance

    if not _orchestrator_instance or _orchestrator_instance.state.value == "idle":
        # Check if database has a stale active batch that needs cleanup
        try:
            from .db import get_active_batch, update_batch
            batch = get_active_batch()
            if batch:
                update_batch(
                    batch_id=batch['id'],
                    status='stopped',
                    ended_at=int(time.time() * 1000)
                )
                print(f"Cleaned up stale batch {batch['id']} via stop handler")
                return web.json_response(
                    {"status": "cleaned", "batch_id": batch['id']},
                    headers={"Access-Control-Allow-Origin": "*"},
                )
        except Exception as e:
            print(f"Warning: Could not clean up stale batch: {e}")

        return web.Response(status=409, text="Orchestrator is not running")

    try:
        await _orchestrator_instance.stop()
        return web.json_response(
            {"status": "stopping"},
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        return web.Response(status=500, text=f"Failed to stop orchestrator: {e}")


async def orchestrator_status_handler(request: web.Request) -> web.Response:
    """
    Get current orchestrator status.

    GET /api/orchestrator/status
    """
    global _orchestrator_instance

    if not _orchestrator_instance:
        return web.json_response(
            {
                "status": "idle",
                "batch_id": None,
                "cycles_completed": 0,
                "max_cycles": 0,
            },
            headers={"Access-Control-Allow-Origin": "*"},
        )

    return web.json_response(
        {
            "status": _orchestrator_instance.state.value,
            "batch_id": _orchestrator_instance.current_batch_id,
            "cycles_completed": _orchestrator_instance.cycles_completed,
            "max_cycles": _orchestrator_instance.max_cycles,
            "current_stories": _orchestrator_instance.current_story_keys,
        },
        headers={"Access-Control-Allow-Origin": "*"},
    )


async def sprint_status_handler(request: web.Request) -> web.Response:
    """
    Get sprint status from sprint-status.yaml.

    GET /api/sprint-status

    Returns the parsed YAML content as JSON.
    """
    try:
        status_path = ARTIFACTS_DIR / "sprint-status.yaml"
        if not status_path.exists():
            return web.json_response(
                {"error": "sprint-status.yaml not found"},
                status=404,
                headers={"Access-Control-Allow-Origin": "*"},
            )

        with open(status_path, "r") as f:
            data = yaml.safe_load(f)

        return web.json_response(
            data,
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        return web.Response(status=500, text=f"Failed to read sprint status: {e}")


async def orchestrator_activity_handler(request: web.Request) -> web.Response:
    """
    Get orchestrator activity log.

    GET /api/orchestrator-status

    Returns parsed orchestrator.md activity log as JSON.
    """
    try:
        activity_path = ARTIFACTS_DIR / "orchestrator.md"
        if not activity_path.exists():
            return web.json_response(
                {"activities": [], "raw": ""},
                headers={"Access-Control-Allow-Origin": "*"},
            )

        content = activity_path.read_text(encoding="utf-8")

        # Parse basic structure - extract log entries
        # Format: each line is a log entry after the header
        lines = content.strip().split('\n')
        activities = []
        for line in lines:
            if line.strip() and not line.startswith('#'):
                activities.append(line.strip())

        return web.json_response(
            {"activities": activities, "raw": content},
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        return web.Response(status=500, text=f"Failed to read orchestrator status: {e}")


# =============================================================================
# Batch History API Handlers (Epic 5)
# =============================================================================


async def batches_list_handler(request: web.Request) -> web.Response:
    """
    List batches with pagination.

    GET /api/batches
    Query: ?limit=20&offset=0

    Response: {
        batches: [...],
        total: number
    }
    """
    settings = get_settings()
    try:
        limit = int(request.query.get("limit", str(settings.default_batch_list_limit)))
        offset = int(request.query.get("offset", "0"))
        limit = min(max(limit, 1), 100)  # Clamp between 1 and 100
        offset = max(offset, 0)
    except ValueError:
        limit = settings.default_batch_list_limit
        offset = 0

    try:
        from .db import get_connection

        with get_connection() as conn:
            # Get total count
            cursor = conn.execute("SELECT COUNT(*) FROM batches")
            total = cursor.fetchone()[0]

            # Get batches with pagination (newest first)
            cursor = conn.execute(
                """
                SELECT
                    b.id,
                    b.started_at,
                    b.ended_at,
                    b.max_cycles,
                    b.cycles_completed,
                    b.status,
                    (SELECT COUNT(*) FROM stories WHERE batch_id = b.id) as story_count
                FROM batches b
                ORDER BY b.id DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset)
            )
            rows = cursor.fetchall()

            batches = []
            for row in rows:
                batch = dict(row)
                # Calculate duration if ended
                if batch["ended_at"] and batch["started_at"]:
                    duration_ms = batch["ended_at"] - batch["started_at"]
                    batch["duration_seconds"] = duration_ms / 1000
                else:
                    batch["duration_seconds"] = None
                batches.append(batch)

        return web.json_response(
            {"batches": batches, "total": total},
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except ImportError:
        return web.json_response(
            {"batches": [], "total": 0, "error": "Database module not available"},
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except Exception as e:
        return web.Response(status=500, text=f"Database error: {e}")


async def batch_detail_handler(request: web.Request) -> web.Response:
    """
    Get single batch details with stories and stats.

    GET /api/batches/:id

    Response: {
        batch: {...},
        stories: [...],
        stats: {...}
    }
    """
    try:
        batch_id = int(request.match_info["batch_id"])
    except ValueError:
        return web.Response(status=400, text="Invalid batch ID")

    try:
        from .db import get_batch, get_stories_by_batch, get_commands_by_story, get_events_by_batch

        batch = get_batch(batch_id)
        if not batch:
            return web.Response(status=404, text="Batch not found")

        # Get stories for this batch
        stories_raw = get_stories_by_batch(batch_id)
        stories = []
        total_commands = 0

        for story in stories_raw:
            commands = get_commands_by_story(story["id"])
            total_commands += len(commands)

            # Calculate story duration
            duration_seconds = None
            if story.get("ended_at") and story.get("started_at"):
                duration_seconds = (story["ended_at"] - story["started_at"]) / 1000

            stories.append({
                "id": story["id"],
                "story_key": story["story_key"],
                "epic_id": story["epic_id"],
                "status": story["status"],
                "started_at": story["started_at"],
                "ended_at": story["ended_at"],
                "duration_seconds": duration_seconds,
                "command_count": len(commands),
                "commands": [
                    {
                        "id": cmd["id"],
                        "command": cmd["command"],
                        "task_id": cmd["task_id"],
                        "status": cmd["status"],
                        "started_at": cmd["started_at"],
                        "ended_at": cmd["ended_at"],
                    }
                    for cmd in commands
                ]
            })

        # Calculate batch stats
        duration_seconds = None
        if batch.get("ended_at") and batch.get("started_at"):
            duration_seconds = (batch["ended_at"] - batch["started_at"]) / 1000

        stats = {
            "story_count": len(stories),
            "command_count": total_commands,
            "cycles_completed": batch.get("cycles_completed", 0),
            "max_cycles": batch.get("max_cycles", 0),
            "duration_seconds": duration_seconds,
            "stories_done": sum(1 for s in stories if s["status"] == "done"),
            "stories_failed": sum(1 for s in stories if s["status"] == "failed"),
            "stories_in_progress": sum(1 for s in stories if s["status"] == "in-progress"),
        }

        return web.json_response(
            {"batch": batch, "stories": stories, "stats": stats},
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except ImportError:
        return web.Response(status=500, text="Database module not available")
    except Exception as e:
        return web.Response(status=500, text=f"Database error: {e}")


# =============================================================================
# Static File Serving
# =============================================================================


async def serve_file_handler(request: web.Request) -> web.Response:
    """Serve whitelisted data files or static files from dashboard directory"""
    filename = request.match_info["filename"]

    ALLOWED_DATA_FILES = {
        "sprint-status.yaml",
        "orchestrator.md",
        "orchestrator.csv",
        "orchestrator-sample.md",
        "sprint-runner.csv",
    }

    if filename in ALLOWED_DATA_FILES:
        # Try artifacts first, then frontend
        filepath = ARTIFACTS_DIR / filename
        if not filepath.exists():
            filepath = FRONTEND_DIR / filename
        if not filepath.exists():
            return web.Response(status=404, text=f"File not found: {filename}")

        try:
            content = filepath.read_text(encoding="utf-8")
            content_type = "text/plain"
            if filename.endswith(".yaml"):
                content_type = "application/x-yaml"
            elif filename.endswith(".json"):
                content_type = "application/json"
            elif filename.endswith(".csv"):
                content_type = "text/csv"

            return web.Response(
                text=content,
                content_type=content_type,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache",
                },
            )
        except Exception as e:
            return web.Response(status=500, text=f"Error reading file: {e}")

    # Security: Validate path doesn't escape dashboard directory
    try:
        normalized = os.path.normpath(filename)
        if normalized.startswith("..") or normalized.startswith("/"):
            return web.Response(
                status=403, text="Forbidden: Path traversal attempt blocked"
            )
    except Exception as e:
        return web.Response(status=400, text=f"Bad Request: Invalid path - {e}")

    # Try serving from frontend directory
    filepath = FRONTEND_DIR / filename
    if filepath.exists() and filepath.is_file():
        # Determine content type for static assets
        content_type = None
        if filename.endswith(".css"):
            content_type = "text/css"
        elif filename.endswith(".js"):
            content_type = "application/javascript"
        elif filename.endswith(".html"):
            content_type = "text/html"
        elif filename.endswith(".svg"):
            content_type = "image/svg+xml"
        elif filename.endswith(".png"):
            content_type = "image/png"
        elif filename.endswith(".ico"):
            content_type = "image/x-icon"

        if content_type:
            return web.FileResponse(filepath, headers={"Content-Type": content_type})
        return web.FileResponse(filepath)

    return web.Response(status=404, text="File not found")


# =============================================================================
# Application Setup
# =============================================================================


def cleanup_stale_batches() -> None:
    """Mark any 'running' batches as 'stopped' on server start."""
    try:
        from .db import get_active_batch, update_batch
        batch = get_active_batch()
        if batch:
            update_batch(
                batch_id=batch['id'],
                status='stopped',
                ended_at=int(time.time() * 1000)
            )
            print(f"Cleaned up stale batch {batch['id']}")
    except Exception as e:
        print(f"Warning: Could not clean up stale batches: {e}")


async def on_startup(app: web.Application) -> None:
    """Called on application startup."""
    # Clean up stale batches from previous server sessions
    cleanup_stale_batches()

    # Start heartbeat task
    app["heartbeat_task"] = asyncio.create_task(heartbeat_task())
    print("Started heartbeat task")


async def on_cleanup(app: web.Application) -> None:
    """Called on application cleanup."""
    # Cancel heartbeat task
    if "heartbeat_task" in app:
        app["heartbeat_task"].cancel()
        try:
            await app["heartbeat_task"]
        except asyncio.CancelledError:
            pass
        print("Stopped heartbeat task")

    # Close all WebSocket connections
    async with _clients_lock:
        for ws in list(connected_clients):
            try:
                await ws.close()
            except Exception:
                pass
        connected_clients.clear()
    print("Closed all WebSocket connections")


async def cors_preflight_handler(request: web.Request) -> web.Response:
    """Handle CORS preflight requests for API endpoints."""
    return web.Response(
        status=204,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
    )


# =============================================================================
# Settings API Handlers
# =============================================================================


async def settings_get_handler(request: web.Request) -> web.Response:
    """GET /api/settings - Retrieve all settings."""
    from .settings import get_settings
    settings = get_settings()
    return web.json_response(
        settings.to_dict(),
        headers={"Access-Control-Allow-Origin": "*"},
    )


async def settings_update_handler(request: web.Request) -> web.Response:
    """PUT /api/settings - Update settings."""
    from .settings import update_settings
    try:
        data = await request.json()
        settings = update_settings(**data)
        return web.json_response(
            settings.to_dict(),
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except ValueError as e:
        return web.Response(
            status=400,
            text=str(e),
            headers={"Access-Control-Allow-Origin": "*"},
        )
    except json.JSONDecodeError:
        return web.Response(
            status=400,
            text="Invalid JSON",
            headers={"Access-Control-Allow-Origin": "*"},
        )


def create_app() -> web.Application:
    """Create and configure the aiohttp application."""
    app = web.Application()

    # Add routes
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/", index_handler)
    app.router.add_get("/story-descriptions.json", story_descriptions_handler)

    # Orchestrator control API (Story 5-SR-6)
    app.router.add_post("/api/orchestrator/start", orchestrator_start_handler)
    app.router.add_post("/api/orchestrator/stop", orchestrator_stop_handler)
    app.router.add_get("/api/orchestrator/status", orchestrator_status_handler)
    app.router.add_options("/api/orchestrator/start", cors_preflight_handler)
    app.router.add_options("/api/orchestrator/stop", cors_preflight_handler)

    # Sprint status API
    app.router.add_get("/api/sprint-status", sprint_status_handler)
    app.router.add_options("/api/sprint-status", cors_preflight_handler)

    # Orchestrator activity API
    app.router.add_get("/api/orchestrator-status", orchestrator_activity_handler)
    app.router.add_options("/api/orchestrator-status", cors_preflight_handler)

    # Batch History API (Epic 5)
    app.router.add_get("/api/batches", batches_list_handler)
    app.router.add_get("/api/batches/{batch_id}", batch_detail_handler)
    app.router.add_options("/api/batches", cors_preflight_handler)
    app.router.add_options("/api/batches/{batch_id}", cors_preflight_handler)

    # Settings API endpoints
    app.router.add_get("/api/settings", settings_get_handler)
    app.router.add_put("/api/settings", settings_update_handler)
    app.router.add_options("/api/settings", cors_preflight_handler)

    # Static file handler (must be last due to wildcard pattern)
    # Use {filename:.*} regex pattern to match nested paths like css/styles.css
    app.router.add_get("/{filename:.*}", serve_file_handler)

    # Add lifecycle handlers
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)

    return app


def main() -> None:
    """Main entry point."""
    port = get_settings().server_port
    print(f"\n{'='*50}")
    print("Grimoire Dashboard Server (aiohttp)")
    print(f"{'='*50}")
    print(f"\nServing at: http://localhost:{port}/")
    print(f"WebSocket at: ws://localhost:{port}/ws")
    print(f"\nEndpoints:")
    print(f"  - /                              Dashboard")
    print(f"  - /ws                            WebSocket (real-time events)")
    print(f"  - /story-descriptions.json       Dynamic story descriptions")
    print(f"  - /sprint-status.yaml            Sprint data")
    print(f"  - /orchestrator.md               Activity log")
    print(f"  - POST /api/orchestrator/start   Start sprint run")
    print(f"  - POST /api/orchestrator/stop    Stop sprint run")
    print(f"  - GET  /api/orchestrator/status  Get current status")
    print(f"  - GET  /api/settings             Get settings")
    print(f"  - PUT  /api/settings             Update settings")
    print(f"\nPress Ctrl+C to stop\n")

    web.run_app(create_app(), host="0.0.0.0", port=port, print=None)


if __name__ == "__main__":
    main()
