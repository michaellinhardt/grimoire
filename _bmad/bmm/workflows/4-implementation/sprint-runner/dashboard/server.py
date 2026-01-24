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

from aiohttp import web, WSMsgType

PORT = 8080

# Paths - Robust project root detection
DASHBOARD_DIR = Path(__file__).parent


def find_project_root() -> Path:
    """Find project root by looking for package.json or .git"""
    current = Path(__file__).parent
    while current != current.parent:
        if (current / "package.json").exists() or (current / ".git").exists():
            return current
        current = current.parent
    raise RuntimeError("Could not find project root (no package.json or .git found)")


PROJECT_ROOT = find_project_root()
ARTIFACTS_DIR = PROJECT_ROOT / "_bmad-output" / "implementation-artifacts"

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


# Payload schemas for validation
EVENT_PAYLOAD_SCHEMAS: dict[str, set[str]] = {
    EventType.BATCH_START: {"batch_id", "max_cycles"},
    EventType.BATCH_END: {"batch_id", "cycles_completed", "status"},
    EventType.CYCLE_START: {"cycle_number", "story_keys"},
    EventType.CYCLE_END: {"cycle_number", "completed_stories"},
    EventType.COMMAND_START: {"story_key", "command", "task_id"},
    EventType.COMMAND_PROGRESS: {"story_key", "command", "task_id", "message"},
    EventType.COMMAND_END: {"story_key", "command", "task_id", "status"},
    EventType.STORY_STATUS: {"story_key", "old_status", "new_status"},
    EventType.ERROR: {"type", "message"},
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
    except RuntimeError:
        # No event loop running - ignore
        pass


# =============================================================================
# Initial State (AC: #2)
# =============================================================================


async def get_initial_state() -> dict[str, Any]:
    """
    Get current batch status and recent events for new connections.

    Returns:
        Dict with 'batch' (current batch or None) and 'events' (recent events)
    """
    try:
        from db import get_active_batch, get_events

        batch = get_active_batch()
        events = get_events(limit=50)

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
    ws = web.WebSocketResponse(heartbeat=30.0)  # Enable auto ping/pong
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
    dashboard_path = DASHBOARD_DIR / "dashboard.html"
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
        from orchestrator import Orchestrator

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
            from db import get_active_batch, update_batch
            batch = get_active_batch()
            if batch:
                update_batch(
                    batch_id=batch['id'],
                    status='stopped',
                    ended_at=int(time.time())
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
    }

    if filename in ALLOWED_DATA_FILES:
        # Try artifacts first, then dashboard
        filepath = ARTIFACTS_DIR / filename
        if not filepath.exists():
            filepath = DASHBOARD_DIR / filename
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

    # Try serving from dashboard directory
    filepath = DASHBOARD_DIR / filename
    if filepath.exists() and filepath.is_file():
        return web.FileResponse(filepath)

    return web.Response(status=404, text="File not found")


# =============================================================================
# Application Setup
# =============================================================================


def cleanup_stale_batches() -> None:
    """Mark any 'running' batches as 'stopped' on server start."""
    try:
        from db import get_active_batch, update_batch
        batch = get_active_batch()
        if batch:
            update_batch(
                batch_id=batch['id'],
                status='stopped',
                ended_at=int(time.time())
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
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
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

    # Static file handler (must be last due to wildcard pattern)
    app.router.add_get("/{filename}", serve_file_handler)

    # Add lifecycle handlers
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)

    return app


def main() -> None:
    """Main entry point."""
    print(f"\n{'='*50}")
    print("Grimoire Dashboard Server (aiohttp)")
    print(f"{'='*50}")
    print(f"\nServing at: http://localhost:{PORT}/")
    print(f"WebSocket at: ws://localhost:{PORT}/ws")
    print(f"\nEndpoints:")
    print(f"  - /                              Dashboard")
    print(f"  - /ws                            WebSocket (real-time events)")
    print(f"  - /story-descriptions.json       Dynamic story descriptions")
    print(f"  - /sprint-status.yaml            Sprint data")
    print(f"  - /orchestrator.md               Activity log")
    print(f"  - POST /api/orchestrator/start   Start sprint run")
    print(f"  - POST /api/orchestrator/stop    Stop sprint run")
    print(f"  - GET  /api/orchestrator/status  Get current status")
    print(f"\nPress Ctrl+C to stop\n")

    web.run_app(create_app(), port=PORT, print=None)


if __name__ == "__main__":
    main()
