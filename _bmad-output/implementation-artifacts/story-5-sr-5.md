# Story 5-SR-5: WebSocket Real-Time Events

Status: ready-for-dev

## Story

As an **operator**,
I want **real-time events pushed to the dashboard**,
so that **I can monitor sprint progress without polling or page refresh**.

## Acceptance Criteria

1. **Given** the server starts, **When** initializing, **Then** both HTTP and WebSocket servers run on the same port via aiohttp **And** WebSocket endpoint is available at `/ws`

2. **Given** a dashboard connects via WebSocket, **When** the connection is established, **Then** the server tracks the connection in a set **And** initial state is sent (current batch status, recent events)

3. **Given** events occur in the orchestrator, **When** state changes, **Then** events are emitted to all connected WebSocket clients with the following event types:
   - `batch:start` - `{ batch_id, max_cycles }`
   - `batch:end` - `{ batch_id, cycles_completed, status }`
   - `cycle:start` - `{ cycle_number, story_keys }`
   - `cycle:end` - `{ cycle_number, completed_stories }`
   - `command:start` - `{ story_key, command, task_id }`
   - `command:progress` - `{ story_key, command, task_id, message }`
   - `command:end` - `{ story_key, command, task_id, status, metrics }`
   - `story:status` - `{ story_key, old_status, new_status }`
   - `error` - `{ type, message, context }`

4. **Given** multiple dashboards are connected, **When** events are emitted, **Then** all connected clients receive the event **And** events are delivered within 500ms of occurrence

5. **Given** a WebSocket connection drops, **When** the disconnect is detected, **Then** the connection is removed from the tracking set **And** no errors occur from attempting to send to closed connections

## Tasks / Subtasks

- [ ] Task 1: Migrate server.py from http.server to aiohttp (AC: 1)
  - [ ] 1.1 Create new server.py based on aiohttp with async handlers
  - [ ] 1.2 Implement HTTP route for `/` serving dashboard.html
  - [ ] 1.3 Implement HTTP route for `/story-descriptions.json` (dynamic)
  - [ ] 1.4 Implement HTTP routes for whitelisted data files (sprint-status.yaml, orchestrator.md)
  - [ ] 1.5 Add WebSocket route at `/ws` using `aiohttp.web.WebSocketResponse`
  - [ ] 1.6 Configure server to run HTTP + WebSocket on same port (default 8080)

- [ ] Task 2: Implement WebSocket connection management (AC: 2, 5)
  - [ ] 2.1 Create global `connected_clients: set[web.WebSocketResponse]` to track connections
  - [ ] 2.2 Implement connection handler that adds to set on connect
  - [ ] 2.3 Implement disconnect detection with removal from set
  - [ ] 2.4 Add try/except wrapper around all WebSocket sends to handle closed connections
  - [ ] 2.5 Clean up stale connections on any send failure

- [ ] Task 3: Implement initial state transmission on connect (AC: 2)
  - [ ] 3.1 On new connection, query db.get_active_batch() for current batch status
  - [ ] 3.2 Query db.get_events() for recent events (last 50)
  - [ ] 3.3 Send initial state message: `{ type: "init", payload: { batch, events } }`
  - [ ] 3.4 Handle case when no active batch exists (send null batch)

- [ ] Task 4: Implement broadcast function for orchestrator integration (AC: 3, 4)
  - [ ] 4.1 Create `async def broadcast(event: dict)` function
  - [ ] 4.2 Serialize event to JSON string once
  - [ ] 4.3 Iterate over connected_clients set and send to each
  - [ ] 4.4 Use asyncio.gather for parallel send to all clients
  - [ ] 4.5 Remove failed connections from set during broadcast
  - [ ] 4.6 Add timestamp to each event before broadcast

- [ ] Task 5: Define event type constants and validation (AC: 3)
  - [ ] 5.1 Create EVENT_TYPES enum/constants for all event types
  - [ ] 5.2 Create payload validation schemas for each event type
  - [ ] 5.3 Implement `emit_event(event_type: str, payload: dict)` helper
  - [ ] 5.4 Validate payload matches expected schema before broadcast

- [ ] Task 6: Integrate with orchestrator.py (AC: 3, 4)
  - [ ] 6.1 Export broadcast function for import by orchestrator
  - [ ] 6.2 Add emit calls in orchestrator for batch:start/end events
  - [ ] 6.3 Add emit calls for cycle:start/end events
  - [ ] 6.4 Add emit calls for command:start/progress/end events
  - [ ] 6.5 Add emit calls for story:status transitions
  - [ ] 6.6 Add emit calls for error events

- [ ] Task 7: Add WebSocket heartbeat/ping-pong (AC: 5)
  - [ ] 7.1 Send ping frame every 30 seconds to detect dead connections
  - [ ] 7.2 Remove connection if pong not received within 10 seconds
  - [ ] 7.3 Handle client-initiated ping with automatic pong response

- [ ] Task 8: Add requirements and update documentation
  - [ ] 8.1 Update requirements.txt with aiohttp version
  - [ ] 8.2 Add websockets library if needed for any utilities
  - [ ] 8.3 Update server startup documentation

## Dev Notes

### Technical Implementation

**Target File Location:**
- Server: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py`
- Database: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/db.py` (from Story 5-SR-2)
- Orchestrator: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/orchestrator.py` (from Story 5-SR-3)

### Current server.py Analysis

The existing `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py` (relocated from `docs/server.py` by Story 5-SR-1) uses synchronous `http.server.SimpleHTTPRequestHandler` which does NOT support WebSocket. This story requires a complete migration to aiohttp for async support.

**Current Features to Preserve:**
- Dynamic `/story-descriptions.json` endpoint
- Whitelist for data files (sprint-status.yaml, orchestrator.md, orchestrator.csv)
- Path traversal security check
- Symlink creation for data files
- CORS headers (Access-Control-Allow-Origin: *)

### aiohttp Server Implementation Pattern

```python
from aiohttp import web
import json
import asyncio

# Global WebSocket connection tracking
connected_clients: set[web.WebSocketResponse] = set()

async def websocket_handler(request: web.Request) -> web.WebSocketResponse:
    """Handle WebSocket connections."""
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    # Add to tracking set
    connected_clients.add(ws)
    print(f"WebSocket client connected. Total clients: {len(connected_clients)}")

    try:
        # Send initial state
        initial_state = await get_initial_state()
        await ws.send_json({"type": "init", "payload": initial_state})

        # Handle incoming messages
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                # Handle client messages if needed
                pass
            elif msg.type == web.WSMsgType.ERROR:
                print(f"WebSocket error: {ws.exception()}")
                break

    finally:
        # Remove from tracking on disconnect
        connected_clients.discard(ws)
        print(f"WebSocket client disconnected. Total clients: {len(connected_clients)}")

    return ws


async def broadcast(event: dict) -> None:
    """Broadcast event to all connected WebSocket clients."""
    if not connected_clients:
        return

    # Add timestamp
    event["timestamp"] = int(time.time() * 1000)

    message = json.dumps(event)

    # Send to all clients in parallel, collect failures
    failed = []
    tasks = []

    for ws in connected_clients:
        if not ws.closed:
            tasks.append((ws, ws.send_str(message)))

    results = await asyncio.gather(
        *[t[1] for t in tasks],
        return_exceptions=True
    )

    # Remove failed connections
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            failed.append(tasks[i][0])

    for ws in failed:
        connected_clients.discard(ws)


async def get_initial_state() -> dict:
    """Get current batch status and recent events."""
    # Import db module
    from db import get_active_batch, get_events

    batch = get_active_batch()
    events = get_events(limit=50)

    return {
        "batch": batch,
        "events": events
    }
```

### HTTP Route Migration

```python
from aiohttp import web
from pathlib import Path
import json
import re

DASHBOARD_DIR = Path(__file__).parent
PROJECT_ROOT = DASHBOARD_DIR.parent.parent.parent.parent.parent  # Up to project root
ARTIFACTS_DIR = PROJECT_ROOT / '_bmad-output' / 'implementation-artifacts'

routes = web.RouteTableDef()

@routes.get('/')
async def index(request: web.Request) -> web.Response:
    """Serve dashboard.html"""
    dashboard_path = DASHBOARD_DIR / 'dashboard.html'
    if dashboard_path.exists():
        return web.FileResponse(dashboard_path)
    return web.Response(status=404, text="Dashboard not found")


@routes.get('/story-descriptions.json')
async def story_descriptions(request: web.Request) -> web.Response:
    """Generate story descriptions dynamically."""
    descriptions = await scan_artifacts()
    return web.json_response(descriptions)


@routes.get('/{filename}')
async def serve_file(request: web.Request) -> web.Response:
    """Serve whitelisted data files."""
    filename = request.match_info['filename']

    ALLOWED_FILES = {'sprint-status.yaml', 'orchestrator.md', 'orchestrator.csv'}

    if filename not in ALLOWED_FILES:
        # Try serving from dashboard directory
        filepath = DASHBOARD_DIR / filename
        if filepath.exists() and filepath.is_file():
            return web.FileResponse(filepath)
        return web.Response(status=404, text="File not found")

    # Try artifacts first, then dashboard dir
    filepath = ARTIFACTS_DIR / filename
    if not filepath.exists():
        filepath = DASHBOARD_DIR / filename
    if not filepath.exists():
        return web.Response(status=404, text=f"File not found: {filename}")

    content = filepath.read_text(encoding='utf-8')
    content_type = 'text/plain'
    if filename.endswith('.yaml'):
        content_type = 'application/x-yaml'
    elif filename.endswith('.json'):
        content_type = 'application/json'

    return web.Response(
        text=content,
        content_type=content_type,
        headers={'Access-Control-Allow-Origin': '*'}
    )
```

### WebSocket Event Types

```python
from enum import Enum

class EventType(str, Enum):
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


def emit_event(event_type: EventType, payload: dict) -> None:
    """Emit WebSocket event to all connected clients."""
    event = {
        "type": event_type.value,
        "payload": payload
    }
    asyncio.create_task(broadcast(event))
```

### Event Payload Schemas

| Event Type | Payload Schema |
|------------|----------------|
| `batch:start` | `{ batch_id: int, max_cycles: int \| "all" }` |
| `batch:end` | `{ batch_id: int, cycles_completed: int, status: "completed" \| "stopped" \| "error" }` |
| `cycle:start` | `{ cycle_number: int, story_keys: string[] }` |
| `cycle:end` | `{ cycle_number: int, completed_stories: string[] }` |
| `command:start` | `{ story_key: string, command: string, task_id: string }` |
| `command:progress` | `{ story_key: string, command: string, task_id: string, message: string }` |
| `command:end` | `{ story_key: string, command: string, task_id: string, status: string, metrics?: object }` |
| `story:status` | `{ story_key: string, old_status: string, new_status: string }` |
| `error` | `{ type: string, message: string, context?: object }` |

### Orchestrator Integration Points

The orchestrator.py (Story 5-SR-3) needs to import and call the emit function at these points:

```python
# In orchestrator.py
from server import emit_event, EventType

# At batch start
emit_event(EventType.BATCH_START, {
    "batch_id": batch_id,
    "max_cycles": max_cycles
})

# At cycle start
emit_event(EventType.CYCLE_START, {
    "cycle_number": cycle_number,
    "story_keys": story_keys
})

# When spawning a command
emit_event(EventType.COMMAND_START, {
    "story_key": story_key,
    "command": command_name,
    "task_id": current_task_id
})

# During command execution (NDJSON progress)
emit_event(EventType.COMMAND_PROGRESS, {
    "story_key": story_key,
    "command": command_name,
    "task_id": current_task_id,
    "message": progress_message
})

# When command completes
emit_event(EventType.COMMAND_END, {
    "story_key": story_key,
    "command": command_name,
    "task_id": current_task_id,
    "status": "success" | "error",
    "metrics": {"duration_ms": duration, "tokens": token_count}
})

# When story status changes
emit_event(EventType.STORY_STATUS, {
    "story_key": story_key,
    "old_status": old_status,
    "new_status": new_status
})
```

### Heartbeat Implementation

```python
import asyncio

async def heartbeat_task():
    """Send periodic pings to detect dead connections."""
    while True:
        await asyncio.sleep(30)  # Every 30 seconds

        dead_connections = []
        for ws in connected_clients:
            try:
                await asyncio.wait_for(ws.ping(), timeout=10.0)
            except (asyncio.TimeoutError, Exception):
                dead_connections.append(ws)

        for ws in dead_connections:
            connected_clients.discard(ws)
            try:
                await ws.close()
            except Exception:
                pass

        if dead_connections:
            print(f"Cleaned up {len(dead_connections)} dead connections")
```

### Server Startup

```python
async def create_app() -> web.Application:
    """Create and configure the aiohttp application."""
    app = web.Application()

    # Add routes
    app.router.add_get('/ws', websocket_handler)
    app.router.add_get('/', index)
    app.router.add_get('/story-descriptions.json', story_descriptions)
    app.router.add_get('/{filename}', serve_file)

    # Start heartbeat task
    app.on_startup.append(lambda app: asyncio.create_task(heartbeat_task()))

    return app


def main():
    port = 8080
    print(f"\n{'='*50}")
    print(f"Grimoire Dashboard Server (aiohttp)")
    print(f"{'='*50}")
    print(f"\nServing at: http://localhost:{port}/")
    print(f"WebSocket at: ws://localhost:{port}/ws")
    print(f"\nPress Ctrl+C to stop\n")

    web.run_app(create_app(), port=port)


if __name__ == '__main__':
    main()
```

### Project Structure Notes

- Server lives in: `_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/`
- Python 3.9+ with asyncio required
- aiohttp provides combined HTTP + WebSocket on same port
- Export `broadcast` and `emit_event` for orchestrator import
- Database queries use db.py module from Story 5-SR-2

### Dependencies

**requirements.txt additions:**
```
aiohttp>=3.9.0
pyyaml>=6.0
```

### Testing Approach

1. **Unit tests for broadcast function:**
   - Test with no connected clients (no-op)
   - Test with single client (receives message)
   - Test with multiple clients (all receive)
   - Test with failed client (removed from set)

2. **Integration tests:**
   - Start server, connect WebSocket client
   - Verify initial state received
   - Emit test event, verify client receives
   - Disconnect client, verify cleanup

3. **Manual verification:**
   - Open dashboard in browser
   - Check DevTools Network tab for WebSocket connection
   - Start orchestrator batch
   - Verify events stream in real-time

### Critical Performance Requirements

- Events delivered within 500ms of occurrence
- Use asyncio.gather for parallel broadcast to avoid sequential delays
- Connection cleanup prevents memory leaks from dead connections
- Heartbeat prevents zombie connections accumulating

### References

- [Source: epic-5-sprint-runner-dashboard.md#Story-5-SR-5] - Acceptance criteria
- [Source: epic-5-sprint-runner-dashboard-context.md#WebSocket-Real-Time-Updates] - Event format spec
- [Source: _bmad/bmm/workflows/4-implementation/sprint-runner/dashboard/server.py] - Current HTTP server to migrate from
- [Source: story-5-sr-3.md] - Orchestrator integration points
- [Source: story-5-sr-4.md] - Context event types

## Tech-Spec Decision

[TECH-SPEC-DECISION: SKIP] (standard WebSocket implementation)

This is a standard aiohttp WebSocket implementation following well-established patterns. No complex architectural decisions required beyond the patterns documented in Dev Notes.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
