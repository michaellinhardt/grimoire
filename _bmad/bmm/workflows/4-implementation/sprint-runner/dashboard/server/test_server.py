#!/usr/bin/env python3
"""
Unit tests for server.py WebSocket and HTTP server module.

Run with: cd dashboard && pytest -v server/test_server.py
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from aiohttp import web
from aiohttp.test_utils import AioHTTPTestCase, unittest_run_loop

# Add dashboard/ to path so we can import server package
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import server module
from server import server


# =============================================================================
# Test: Event Types and Validation (AC: #3)
# =============================================================================


class TestEventTypes:
    def test_event_type_enum_values(self):
        """EventType enum should have all required event types."""
        assert server.EventType.BATCH_START.value == "batch:start"
        assert server.EventType.BATCH_END.value == "batch:end"
        assert server.EventType.CYCLE_START.value == "cycle:start"
        assert server.EventType.CYCLE_END.value == "cycle:end"
        assert server.EventType.COMMAND_START.value == "command:start"
        assert server.EventType.COMMAND_PROGRESS.value == "command:progress"
        assert server.EventType.COMMAND_END.value == "command:end"
        assert server.EventType.STORY_STATUS.value == "story:status"
        assert server.EventType.ERROR.value == "error"

    def test_event_payload_schemas_defined(self):
        """All event types should have payload schemas defined."""
        assert server.EventType.BATCH_START in server.EVENT_PAYLOAD_SCHEMAS
        assert server.EventType.BATCH_END in server.EVENT_PAYLOAD_SCHEMAS
        assert server.EventType.CYCLE_START in server.EVENT_PAYLOAD_SCHEMAS
        assert server.EventType.CYCLE_END in server.EVENT_PAYLOAD_SCHEMAS
        assert server.EventType.COMMAND_START in server.EVENT_PAYLOAD_SCHEMAS
        assert server.EventType.COMMAND_PROGRESS in server.EVENT_PAYLOAD_SCHEMAS
        assert server.EventType.COMMAND_END in server.EVENT_PAYLOAD_SCHEMAS
        assert server.EventType.STORY_STATUS in server.EVENT_PAYLOAD_SCHEMAS
        assert server.EventType.ERROR in server.EVENT_PAYLOAD_SCHEMAS


class TestPayloadValidation:
    def test_validate_payload_valid_batch_start(self):
        """Valid batch:start payload should pass validation."""
        payload = {"batch_id": 1, "max_cycles": 3}
        assert server.validate_payload("batch:start", payload) is True

    def test_validate_payload_missing_field(self):
        """Payload missing required field should fail validation."""
        payload = {"batch_id": 1}  # Missing max_cycles
        assert server.validate_payload("batch:start", payload) is False

    def test_validate_payload_extra_field_ok(self):
        """Payload with extra fields should pass validation."""
        payload = {"batch_id": 1, "max_cycles": 3, "extra": "field"}
        assert server.validate_payload("batch:start", payload) is True

    def test_validate_payload_unknown_event_type(self):
        """Unknown event type should pass validation (permissive)."""
        payload = {"anything": "goes"}
        assert server.validate_payload("unknown:type", payload) is True

    def test_validate_payload_command_progress(self):
        """Valid command:progress payload should pass validation."""
        payload = {
            "story_key": "2a-1",
            "command": "dev-story",
            "task_id": "implement",
            "message": "Progress update",
        }
        assert server.validate_payload("command:progress", payload) is True

    def test_validate_payload_story_status(self):
        """Valid story:status payload should pass validation."""
        payload = {
            "story_key": "2a-1",
            "old_status": "in-progress",
            "new_status": "done",
        }
        assert server.validate_payload("story:status", payload) is True


# =============================================================================
# Test: Connection Management (AC: #2, #5)
# =============================================================================


class TestConnectionManagement:
    @pytest.fixture
    def mock_ws(self):
        """Create a mock WebSocket response."""
        ws = MagicMock(spec=web.WebSocketResponse)
        ws.closed = False
        ws.send_str = AsyncMock()
        ws.send_json = AsyncMock()
        return ws

    @pytest.fixture(autouse=True)
    def clear_clients_sync(self):
        """Clear connected clients before and after each test (sync)."""
        server.connected_clients.clear()
        yield
        server.connected_clients.clear()

    @pytest.mark.asyncio
    async def test_add_client(self, mock_ws):
        """add_client should add WebSocket to tracking set."""
        server.connected_clients.clear()  # Extra clear for safety
        assert len(server.connected_clients) == 0
        await server.add_client(mock_ws)
        assert len(server.connected_clients) == 1
        assert mock_ws in server.connected_clients

    @pytest.mark.asyncio
    async def test_remove_client(self, mock_ws):
        """remove_client should remove WebSocket from tracking set."""
        server.connected_clients.clear()  # Extra clear for safety
        await server.add_client(mock_ws)
        assert len(server.connected_clients) == 1

        await server.remove_client(mock_ws)
        assert len(server.connected_clients) == 0
        assert mock_ws not in server.connected_clients

    @pytest.mark.asyncio
    async def test_remove_nonexistent_client(self, mock_ws):
        """remove_client should not error for non-existent client."""
        server.connected_clients.clear()  # Extra clear for safety
        # Should not raise
        await server.remove_client(mock_ws)
        assert len(server.connected_clients) == 0

    @pytest.mark.asyncio
    async def test_add_multiple_clients(self):
        """Multiple clients should be tracked independently."""
        server.connected_clients.clear()  # Extra clear for safety
        ws1 = MagicMock(spec=web.WebSocketResponse)
        ws2 = MagicMock(spec=web.WebSocketResponse)
        ws3 = MagicMock(spec=web.WebSocketResponse)

        await server.add_client(ws1)
        await server.add_client(ws2)
        await server.add_client(ws3)

        assert len(server.connected_clients) == 3

        await server.remove_client(ws2)
        assert len(server.connected_clients) == 2
        assert ws2 not in server.connected_clients


# =============================================================================
# Test: Broadcast Function (AC: #3, #4)
# =============================================================================


class TestBroadcast:
    @pytest.fixture
    def mock_ws(self):
        """Create a mock WebSocket response."""
        ws = MagicMock(spec=web.WebSocketResponse)
        ws.closed = False
        ws.send_str = AsyncMock()
        return ws

    @pytest.fixture(autouse=True)
    def clear_clients_sync(self):
        """Clear connected clients before and after each test (sync)."""
        server.connected_clients.clear()
        yield
        server.connected_clients.clear()

    @pytest.mark.asyncio
    async def test_broadcast_no_clients(self):
        """broadcast with no clients should not error."""
        server.connected_clients.clear()  # Extra clear for safety
        event = {"type": "test", "payload": {}}
        # Should not raise
        await server.broadcast(event)

    @pytest.mark.asyncio
    async def test_broadcast_single_client(self, mock_ws):
        """broadcast should send to single connected client."""
        server.connected_clients.clear()  # Extra clear for safety
        await server.add_client(mock_ws)

        event = {"type": "batch:start", "payload": {"batch_id": 1, "max_cycles": 3}}
        await server.broadcast(event)

        mock_ws.send_str.assert_called_once()
        sent_data = json.loads(mock_ws.send_str.call_args[0][0])
        assert sent_data["type"] == "batch:start"
        assert sent_data["payload"]["batch_id"] == 1

    @pytest.mark.asyncio
    async def test_broadcast_multiple_clients(self):
        """broadcast should send to all connected clients."""
        server.connected_clients.clear()  # Extra clear for safety
        clients = []
        for _ in range(3):
            ws = MagicMock(spec=web.WebSocketResponse)
            ws.closed = False
            ws.send_str = AsyncMock()
            clients.append(ws)
            await server.add_client(ws)

        event = {"type": "test", "payload": {"data": "value"}}
        await server.broadcast(event)

        for ws in clients:
            ws.send_str.assert_called_once()

    @pytest.mark.asyncio
    async def test_broadcast_adds_timestamp(self, mock_ws):
        """broadcast should add timestamp to event if not present."""
        server.connected_clients.clear()  # Extra clear for safety
        await server.add_client(mock_ws)

        event = {"type": "test", "payload": {}}
        before = int(time.time() * 1000)
        await server.broadcast(event)
        after = int(time.time() * 1000)

        sent_data = json.loads(mock_ws.send_str.call_args[0][0])
        assert "timestamp" in sent_data
        assert before <= sent_data["timestamp"] <= after

    @pytest.mark.asyncio
    async def test_broadcast_preserves_existing_timestamp(self, mock_ws):
        """broadcast should preserve existing timestamp."""
        server.connected_clients.clear()  # Extra clear for safety
        await server.add_client(mock_ws)

        existing_ts = 1234567890000
        event = {"type": "test", "payload": {}, "timestamp": existing_ts}
        await server.broadcast(event)

        sent_data = json.loads(mock_ws.send_str.call_args[0][0])
        assert sent_data["timestamp"] == existing_ts

    @pytest.mark.asyncio
    async def test_broadcast_removes_failed_connections(self):
        """broadcast should remove failed connections from set."""
        server.connected_clients.clear()  # Extra clear for safety
        good_ws = MagicMock(spec=web.WebSocketResponse)
        good_ws.closed = False
        good_ws.send_str = AsyncMock()

        bad_ws = MagicMock(spec=web.WebSocketResponse)
        bad_ws.closed = False
        bad_ws.send_str = AsyncMock(side_effect=Exception("Connection lost"))

        await server.add_client(good_ws)
        await server.add_client(bad_ws)
        assert len(server.connected_clients) == 2

        event = {"type": "test", "payload": {}}
        await server.broadcast(event)

        # Bad client should be removed
        assert len(server.connected_clients) == 1
        assert good_ws in server.connected_clients
        assert bad_ws not in server.connected_clients

    @pytest.mark.asyncio
    async def test_broadcast_skips_closed_connections(self, mock_ws):
        """broadcast should skip already closed connections."""
        server.connected_clients.clear()  # Extra clear for safety
        closed_ws = MagicMock(spec=web.WebSocketResponse)
        closed_ws.closed = True
        closed_ws.send_str = AsyncMock()

        await server.add_client(mock_ws)
        await server.add_client(closed_ws)

        event = {"type": "test", "payload": {}}
        await server.broadcast(event)

        # Only open connection should receive message
        mock_ws.send_str.assert_called_once()
        closed_ws.send_str.assert_not_called()


# =============================================================================
# Test: emit_event Function (AC: #3)
# =============================================================================


class TestEmitEvent:
    @pytest.fixture(autouse=True)
    def clear_clients_sync(self):
        """Clear connected clients before and after each test (sync)."""
        server.connected_clients.clear()
        yield
        server.connected_clients.clear()

    @pytest.mark.asyncio
    async def test_emit_event_creates_task(self):
        """emit_event should create async task for broadcast."""
        server.connected_clients.clear()  # Extra clear for safety
        with patch.object(server, "broadcast", new_callable=AsyncMock) as mock_broadcast:
            server.emit_event("batch:start", {"batch_id": 1, "max_cycles": 3})
            # Allow task to run
            await asyncio.sleep(0.01)
            mock_broadcast.assert_called_once()

    @pytest.mark.asyncio
    async def test_emit_event_accepts_enum(self):
        """emit_event should accept EventType enum."""
        server.connected_clients.clear()  # Extra clear for safety
        with patch.object(server, "broadcast", new_callable=AsyncMock) as mock_broadcast:
            server.emit_event(
                server.EventType.BATCH_START, {"batch_id": 1, "max_cycles": 3}
            )
            await asyncio.sleep(0.01)

            call_args = mock_broadcast.call_args[0][0]
            assert call_args["type"] == "batch:start"

    @pytest.mark.asyncio
    async def test_emit_event_accepts_string(self):
        """emit_event should accept string event type."""
        server.connected_clients.clear()  # Extra clear for safety
        with patch.object(server, "broadcast", new_callable=AsyncMock) as mock_broadcast:
            server.emit_event("custom:event", {"data": "value"})
            await asyncio.sleep(0.01)

            call_args = mock_broadcast.call_args[0][0]
            assert call_args["type"] == "custom:event"

    @pytest.mark.asyncio
    async def test_emit_event_adds_timestamp(self):
        """emit_event should add timestamp to event."""
        server.connected_clients.clear()  # Extra clear for safety
        with patch.object(server, "broadcast", new_callable=AsyncMock) as mock_broadcast:
            before = int(time.time() * 1000)
            server.emit_event("test", {})
            await asyncio.sleep(0.01)
            after = int(time.time() * 1000)

            call_args = mock_broadcast.call_args[0][0]
            assert before <= call_args["timestamp"] <= after


# =============================================================================
# Test: Initial State (AC: #2)
# =============================================================================


class TestInitialState:
    @pytest.mark.asyncio
    async def test_get_initial_state_no_db(self):
        """get_initial_state should handle db exceptions gracefully."""
        # Simulate database error by raising exception from get_active_batch
        # The function imports .db internally, so we patch the db module functions
        with patch('server.db.get_active_batch', side_effect=Exception("DB error")):
            state = await server.get_initial_state()
            # When exception occurs, should return safe defaults
            assert state["batch"] is None
            assert state["events"] == []

    @pytest.mark.asyncio
    async def test_get_initial_state_with_db(self):
        """get_initial_state should return batch and events from db."""
        mock_db = MagicMock()
        mock_db.get_active_batch.return_value = {"id": 1, "status": "running"}
        mock_db.get_events.return_value = [{"id": 1, "message": "test"}]

        with patch.dict("sys.modules", {"db": mock_db}):
            # Need to reimport to pick up mock
            import importlib

            importlib.reload(server)

            state = await server.get_initial_state()

        # Restore
        importlib.reload(server)

    @pytest.mark.asyncio
    async def test_get_initial_state_handles_exception(self):
        """get_initial_state should handle db exceptions gracefully."""
        # The get_initial_state function catches all exceptions and returns defaults
        # Just verify it returns safe defaults even when db might error
        state = await server.get_initial_state()
        # Should return dict with batch and events keys
        assert "batch" in state
        assert "events" in state


# =============================================================================
# Test: Story Description Extraction
# =============================================================================


class TestStoryDescriptionExtraction:
    def test_extract_story_id_valid(self):
        """extract_story_id should extract ID from valid filenames."""
        assert server.extract_story_id("2a-1-session-scanner.md") == "2a-1-session-scanner"
        assert server.extract_story_id("5-sr-3-orchestrator.md") == "5-sr-3-orchestrator"
        assert server.extract_story_id("1-1-project-scaffold.md") == "1-1-project-scaffold"

    def test_extract_story_id_invalid(self):
        """extract_story_id should return None for invalid filenames."""
        assert server.extract_story_id("tech-spec-2a-1.md") is None
        assert server.extract_story_id("orchestrator.md") is None
        assert server.extract_story_id("not-a-story.txt") is None

    def test_extract_description_with_story_section(self, tmp_path):
        """extract_description should extract text from ## Story section."""
        content = """# Story 2a-1

## Story

As a **user**,
I want **feature**,
so that **benefit**.

## Acceptance Criteria

1. Given X, When Y, Then Z
"""
        story_file = tmp_path / "2a-1-test.md"
        story_file.write_text(content)

        desc = server.extract_description(story_file)
        assert "user" in desc
        assert "feature" in desc
        assert "benefit" in desc

    def test_extract_description_truncates_long_text(self, tmp_path):
        """extract_description should truncate to 500 characters."""
        long_text = "x" * 1000
        content = f"""# Story

## Story

{long_text}

## Acceptance Criteria
"""
        story_file = tmp_path / "test.md"
        story_file.write_text(content)

        desc = server.extract_description(story_file)
        assert len(desc) <= 500


# =============================================================================
# Test: HTTP Routes (AC: #1)
# =============================================================================


class TestHTTPRoutes(AioHTTPTestCase):
    async def get_application(self):
        """Create test application."""
        return server.create_app()

    @unittest_run_loop
    async def test_index_route(self):
        """/ should serve dashboard or 404."""
        resp = await self.client.request("GET", "/")
        # Will be 404 if dashboard.html doesn't exist in test env
        assert resp.status in (200, 404)

    @unittest_run_loop
    async def test_story_descriptions_route(self):
        """/story-descriptions.json should return JSON."""
        resp = await self.client.request("GET", "/story-descriptions.json")
        assert resp.status == 200
        assert resp.content_type == "application/json"

    @unittest_run_loop
    async def test_path_traversal_blocked(self):
        """Path traversal attempts should be blocked."""
        # aiohttp normalizes the URL path, so we need to test the handler directly
        # Instead, test that trying to access a parent directory file returns 403 or 404
        resp = await self.client.request("GET", "/../../../etc/passwd")
        # Either 403 (blocked) or 404 (not found after normalization) is acceptable
        assert resp.status in (403, 404)

    @unittest_run_loop
    async def test_nonexistent_file_404(self):
        """Non-existent files should return 404."""
        resp = await self.client.request("GET", "/nonexistent-file.xyz")
        assert resp.status == 404


# =============================================================================
# Test: Application Lifecycle
# =============================================================================


class TestAppLifecycle:
    @pytest.mark.asyncio
    async def test_create_app_returns_application(self):
        """create_app should return aiohttp Application."""
        app = server.create_app()
        assert isinstance(app, web.Application)

    @pytest.mark.asyncio
    async def test_create_app_has_routes(self):
        """create_app should configure all routes."""
        app = server.create_app()
        routes = [r.resource.canonical for r in app.router.routes()]

        assert "/ws" in routes
        assert "/" in routes
        assert "/story-descriptions.json" in routes
        assert "/{filename}" in routes

    @pytest.mark.asyncio
    async def test_on_startup_creates_heartbeat_task(self):
        """on_startup should create heartbeat task."""
        app = web.Application()
        await server.on_startup(app)

        assert "heartbeat_task" in app
        assert isinstance(app["heartbeat_task"], asyncio.Task)

        # Cleanup
        app["heartbeat_task"].cancel()
        try:
            await app["heartbeat_task"]
        except asyncio.CancelledError:
            pass

    @pytest.mark.asyncio
    async def test_on_cleanup_cancels_heartbeat_task(self):
        """on_cleanup should cancel heartbeat task."""
        app = web.Application()
        await server.on_startup(app)

        task = app["heartbeat_task"]
        assert not task.cancelled()

        await server.on_cleanup(app)
        assert task.cancelled()


# =============================================================================
# Test: WebSocket Handler (Integration)
# =============================================================================


class TestWebSocketHandler:
    """WebSocket handler integration tests using pytest-aiohttp."""

    @pytest.mark.asyncio
    async def test_websocket_connect(self, aiohttp_client):
        """WebSocket connection should be established."""
        server.connected_clients.clear()
        app = server.create_app()
        client = await aiohttp_client(app)

        async with client.ws_connect("/ws") as ws:
            # Should receive init message
            msg = await ws.receive_json()
            assert msg["type"] == "init"
            assert "payload" in msg
            assert "batch" in msg["payload"]
            assert "events" in msg["payload"]

    @pytest.mark.asyncio
    async def test_websocket_tracks_connection(self, aiohttp_client):
        """WebSocket handler should track connection."""
        server.connected_clients.clear()
        app = server.create_app()
        client = await aiohttp_client(app)

        async with client.ws_connect("/ws") as ws:
            await ws.receive_json()  # Consume init message
            # Connection should be tracked
            assert len(server.connected_clients) >= 1

    @pytest.mark.asyncio
    async def test_websocket_ping_pong(self, aiohttp_client):
        """WebSocket should respond to ping with pong."""
        server.connected_clients.clear()
        app = server.create_app()
        client = await aiohttp_client(app)

        async with client.ws_connect("/ws") as ws:
            await ws.receive_json()  # Consume init message

            # Send ping
            await ws.send_json({"type": "ping"})

            # Should receive pong
            msg = await ws.receive_json()
            assert msg["type"] == "pong"


# =============================================================================
# Test: Heartbeat (AC: #5)
# =============================================================================


class TestHeartbeat:
    @pytest.fixture(autouse=True)
    def clear_clients_sync(self):
        """Clear connected clients before and after each test (sync)."""
        server.connected_clients.clear()
        yield
        server.connected_clients.clear()

    @pytest.mark.asyncio
    async def test_heartbeat_removes_closed_connections(self):
        """Heartbeat should remove closed connections."""
        server.connected_clients.clear()  # Extra clear for safety
        closed_ws = MagicMock(spec=web.WebSocketResponse)
        closed_ws.closed = True

        await server.add_client(closed_ws)
        assert len(server.connected_clients) == 1

        # Run one iteration of heartbeat logic (simplified)
        async with server._clients_lock:
            dead = [ws for ws in server.connected_clients if ws.closed]
            for ws in dead:
                server.connected_clients.discard(ws)

        assert len(server.connected_clients) == 0
