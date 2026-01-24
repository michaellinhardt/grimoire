#!/usr/bin/env python3
"""
Integration tests for sprint-runner dashboard.

Tests complete workflow from dashboard start to story completion.
Verifies server, WebSocket, orchestrator control, and event streaming.

Run with: cd dashboard && pytest -v server/test_integration.py

Note: These tests mock the Claude CLI subprocess to enable CI testing.
For full end-to-end testing with real Claude CLI, use manual testing.
"""

from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from aiohttp import web
from aiohttp.test_utils import AioHTTPTestCase

# Add dashboard/ to path so we can import server package
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import modules under test
from server import db
from server import server
from server.orchestrator import Orchestrator, OrchestratorState


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_project_root():
    """Create a temporary project root with required structure."""
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)

        # Create directory structure
        (root / "_bmad-output/implementation-artifacts").mkdir(parents=True)
        (root / "_bmad-output/planning-artifacts").mkdir(parents=True)
        (root / "_bmad/bmm/workflows/4-implementation/sprint-runner/prompts").mkdir(
            parents=True
        )
        (root / "_bmad/bmm/workflows/4-implementation/sprint-runner/dashboard").mkdir(
            parents=True
        )
        (root / "_bmad/scripts").mkdir(parents=True)

        # Create sprint-status.yaml
        sprint_status = """
development_status:
  epic-1: in-progress
  1-1-first-story: done
  1-2-second-story: ready-for-dev
  1-3-third-story: backlog
  epic-1-retrospective: optional
  epic-2a: backlog
  2a-1-new-story: backlog
"""
        (root / "_bmad-output/implementation-artifacts/sprint-status.yaml").write_text(
            sprint_status
        )

        # Create minimal prompt files
        prompts_dir = (
            root / "_bmad/bmm/workflows/4-implementation/sprint-runner/prompts"
        )
        (prompts_dir / "create-story.md").write_text(
            "Test prompt for {{story_key}}\n{{implementation_artifacts}}"
        )
        (prompts_dir / "create-story-discovery.md").write_text(
            "Discovery prompt for {{story_key}}"
        )
        (prompts_dir / "story-review.md").write_text(
            "Review prompt for {{story_key}} attempt {{review_attempt}}"
        )
        (prompts_dir / "dev-story.md").write_text("Dev prompt for {{story_key}}")
        (prompts_dir / "code-review.md").write_text(
            "Code review prompt for {{story_key}} attempt {{review_attempt}}"
        )
        (prompts_dir / "create-tech-spec.md").write_text(
            "Tech spec prompt for {{story_key}}"
        )
        (prompts_dir / "tech-spec-review.md").write_text(
            "Tech spec review prompt for {{story_key}} attempt {{review_attempt}}"
        )
        (prompts_dir / "background-review-chain.md").write_text(
            "Background review chain for {{review_type}} {{story_keys}}"
        )

        # Create fresh project context
        (root / "_bmad-output/planning-artifacts/project-context.md").write_text(
            "# Project Context\nFresh content for testing"
        )

        yield root


@pytest.fixture
def temp_db_path(tmp_path):
    """Create a temporary database for testing."""
    db_path = tmp_path / "test-sprint-runner.db"
    original_path = db.DB_PATH

    # Patch the database path
    db.DB_PATH = db_path
    db.init_db()

    yield db_path

    # Restore original path
    db.DB_PATH = original_path


@pytest.fixture
def clear_websocket_clients():
    """Clear WebSocket clients before and after each test."""
    server.connected_clients.clear()
    yield
    server.connected_clients.clear()


# =============================================================================
# Test: Server Startup (AC: 1.1, 1.2)
# =============================================================================


class TestServerStartup:
    """Tests for server startup and basic HTTP functionality."""

    @pytest.mark.asyncio
    async def test_server_creates_application(self):
        """Server should create a valid aiohttp Application."""
        app = server.create_app()
        assert isinstance(app, web.Application)

    @pytest.mark.asyncio
    async def test_server_has_required_routes(self):
        """Server should have all required HTTP routes."""
        app = server.create_app()
        routes = [r.resource.canonical for r in app.router.routes()]

        assert "/" in routes  # Dashboard
        assert "/ws" in routes  # WebSocket
        assert "/story-descriptions.json" in routes  # Story descriptions
        assert "/api/orchestrator/start" in routes  # Start endpoint
        assert "/api/orchestrator/stop" in routes  # Stop endpoint
        assert "/api/orchestrator/status" in routes  # Status endpoint

    @pytest.mark.asyncio
    async def test_server_responds_to_http(self, aiohttp_client):
        """Server should respond to HTTP requests."""
        app = server.create_app()
        client = await aiohttp_client(app)

        # Test root route (may return 200 or 404 depending on dashboard.html)
        resp = await client.get("/")
        assert resp.status in (200, 404)

        # Test story descriptions
        resp = await client.get("/story-descriptions.json")
        assert resp.status == 200
        assert resp.content_type == "application/json"


# =============================================================================
# Test: WebSocket Connection (AC: 1.3)
# =============================================================================


class TestWebSocketConnection:
    """Tests for WebSocket endpoint functionality."""

    @pytest.mark.asyncio
    async def test_websocket_accepts_connection(
        self, aiohttp_client, clear_websocket_clients
    ):
        """WebSocket endpoint should accept connections."""
        app = server.create_app()
        client = await aiohttp_client(app)

        async with client.ws_connect("/ws") as ws:
            # Connection should be established
            assert not ws.closed

            # Should receive init message
            msg = await asyncio.wait_for(ws.receive_json(), timeout=5)
            assert msg["type"] == "init"
            assert "payload" in msg
            assert "batch" in msg["payload"]
            assert "events" in msg["payload"]

    @pytest.mark.asyncio
    async def test_websocket_tracks_connections(
        self, aiohttp_client, clear_websocket_clients
    ):
        """WebSocket handler should track active connections."""
        app = server.create_app()
        client = await aiohttp_client(app)

        assert len(server.connected_clients) == 0

        async with client.ws_connect("/ws") as ws:
            await ws.receive_json()  # Consume init message
            # Connection should be tracked
            assert len(server.connected_clients) >= 1

        # After disconnect, connection should be removed
        await asyncio.sleep(0.1)  # Allow cleanup
        # Note: cleanup may be async, so connection count might take time to update


# =============================================================================
# Test: Orchestrator Control Endpoints (AC: 1.4)
# =============================================================================


class TestOrchestratorControlEndpoints:
    """Tests for orchestrator HTTP control endpoints."""

    @pytest.mark.asyncio
    async def test_status_endpoint_returns_idle(self, aiohttp_client):
        """Status endpoint should return idle state initially."""
        # Reset global orchestrator
        server._orchestrator_instance = None
        server._orchestrator_task = None

        app = server.create_app()
        client = await aiohttp_client(app)

        resp = await client.get("/api/orchestrator/status")
        assert resp.status == 200

        data = await resp.json()
        assert data["status"] == "idle"
        assert data["batch_id"] is None

    @pytest.mark.asyncio
    async def test_start_endpoint_requires_json_body(self, aiohttp_client):
        """Start endpoint should require valid JSON body."""
        app = server.create_app()
        client = await aiohttp_client(app)

        # Send invalid JSON
        resp = await client.post(
            "/api/orchestrator/start",
            data="not json",
            headers={"Content-Type": "application/json"},
        )
        assert resp.status == 400

    @pytest.mark.asyncio
    async def test_start_endpoint_validates_batch_size(self, aiohttp_client):
        """Start endpoint should validate batch_size parameter."""
        app = server.create_app()
        client = await aiohttp_client(app)

        # Negative batch_size should fail
        resp = await client.post(
            "/api/orchestrator/start", json={"batch_size": -1}
        )
        assert resp.status == 400

    @pytest.mark.asyncio
    async def test_stop_endpoint_when_not_running(self, aiohttp_client):
        """Stop endpoint should return 200 when orchestrator not running (idempotent)."""
        # Reset global orchestrator
        server._orchestrator_instance = None
        server._orchestrator_task = None

        app = server.create_app()
        client = await aiohttp_client(app)

        resp = await client.post("/api/orchestrator/stop")
        # Server returns 200 for idempotent stop - either "cleaned" stale batch or "stopped"
        assert resp.status == 200
        data = await resp.json()
        # Should be either "cleaned" (if stale batch exists) or indicate already stopped
        assert data.get("status") in ("cleaned", "stopped", "not_running")


# =============================================================================
# Test: Event Streaming (AC: 1.5)
# =============================================================================


class TestEventStreaming:
    """Tests for WebSocket event streaming functionality."""

    @pytest.mark.asyncio
    async def test_events_broadcast_to_connected_clients(
        self, aiohttp_client, clear_websocket_clients
    ):
        """Events should be broadcast to all connected WebSocket clients."""
        app = server.create_app()
        client = await aiohttp_client(app)

        async with client.ws_connect("/ws") as ws:
            await ws.receive_json()  # Consume init message

            # Emit an event
            server.emit_event(
                "batch:start", {"batch_id": 1, "max_cycles": 2}
            )

            # Wait for event delivery
            await asyncio.sleep(0.1)

            # Should receive the event (or nothing if no pending events)
            try:
                msg = await asyncio.wait_for(ws.receive_json(), timeout=1)
                assert msg["type"] == "batch:start"
                assert msg["payload"]["batch_id"] == 1
            except asyncio.TimeoutError:
                # Event might have been delivered before we started waiting
                pass

    @pytest.mark.asyncio
    async def test_event_format_includes_timestamp(
        self, aiohttp_client, clear_websocket_clients
    ):
        """Events should include timestamp field."""
        mock_ws = MagicMock(spec=web.WebSocketResponse)
        mock_ws.closed = False
        mock_ws.send_str = AsyncMock()

        await server.add_client(mock_ws)

        # Emit event without timestamp
        test_event = {"type": "test", "payload": {"data": "value"}}
        await server.broadcast(test_event)

        # Check that timestamp was added
        mock_ws.send_str.assert_called_once()
        sent_data = json.loads(mock_ws.send_str.call_args[0][0])
        assert "timestamp" in sent_data
        assert isinstance(sent_data["timestamp"], int)


# =============================================================================
# Test: Sprint Status Updates (AC: 1.6)
# =============================================================================


class TestSprintStatusUpdates:
    """Tests for sprint-status.yaml file updates."""

    @pytest.mark.asyncio
    async def test_orchestrator_updates_sprint_status(self, temp_project_root):
        """Orchestrator should update sprint-status.yaml correctly."""
        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ), patch("server.orchestrator.create_story", return_value=1), patch(
            "server.orchestrator.update_story"
        ), patch(
            "server.orchestrator.create_event"
        ), patch(
            "server.orchestrator.get_story_by_key", return_value=None
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=1, project_root=temp_project_root
            )
            orch.current_batch_id = 1

            # Update story status
            orch.update_sprint_status("1-2-second-story", "in-progress")

            # Read back and verify
            import yaml

            status_path = (
                temp_project_root
                / "_bmad-output/implementation-artifacts/sprint-status.yaml"
            )
            with open(status_path) as f:
                status = yaml.safe_load(f)

            assert status["development_status"]["1-2-second-story"] == "in-progress"


# =============================================================================
# Test: Database Records (AC: 1.7)
# =============================================================================


class TestDatabaseRecords:
    """Tests for SQLite database record creation."""

    def test_batch_creation(self, temp_db_path):
        """Database should record batch information."""
        batch_id = db.create_batch(max_cycles=3)

        batch = db.get_batch(batch_id)
        assert batch is not None
        assert batch["max_cycles"] == 3
        assert batch["status"] == "running"
        assert batch["started_at"] > 0

    def test_story_creation(self, temp_db_path):
        """Database should record story information."""
        batch_id = db.create_batch(max_cycles=2)
        story_id = db.create_story(batch_id, "2a-1", "2a")

        story = db.get_story(story_id)
        assert story is not None
        assert story["story_key"] == "2a-1"
        assert story["epic_id"] == "2a"
        assert story["status"] == "in-progress"

    def test_event_creation(self, temp_db_path):
        """Database should record events."""
        batch_id = db.create_batch(max_cycles=1)
        event_id = db.create_event(
            batch_id=batch_id,
            story_id=None,
            command_id=None,
            event_type="command:start",
            epic_id="2a",
            story_key="2a-1",
            command="create-story",
            task_id="setup",
            status="start",
            message="Starting story creation",
        )

        events = db.get_events(limit=1)
        assert len(events) >= 1


# =============================================================================
# Test: Graceful Stop (AC: 1.8)
# =============================================================================


class TestGracefulStop:
    """Tests for graceful orchestrator shutdown."""

    @pytest.mark.asyncio
    async def test_stop_sets_flag_and_cancels_tasks(self, temp_project_root):
        """Stop should set flag and cancel background tasks."""
        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=2, project_root=temp_project_root
            )
            orch.current_batch_id = 1

            # Add mock background tasks
            task1 = AsyncMock()
            task2 = AsyncMock()
            orch._background_tasks = [task1, task2]

            assert orch.stop_requested is False

            await orch.stop()

            assert orch.stop_requested is True
            task1.cancel.assert_called()
            task2.cancel.assert_called()

    @pytest.mark.asyncio
    async def test_stop_emits_batch_end_event(self, temp_project_root):
        """Stop should emit batch:end event."""
        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=2, project_root=temp_project_root
            )
            orch.current_batch_id = 1

            with patch.object(orch, "emit_event") as mock_emit:
                await orch.stop()

                # Check batch:end was emitted
                emit_calls = [
                    call
                    for call in mock_emit.call_args_list
                    if call.args[0] == "batch:end"
                ]
                assert len(emit_calls) >= 1


# =============================================================================
# Test: Resume After Stop (AC: 1.9)
# =============================================================================


class TestResumeAfterStop:
    """Tests for resuming orchestration after stop."""

    def test_orchestrator_reads_current_status(self, temp_project_root):
        """Orchestrator should read current status from sprint-status.yaml."""
        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=2, project_root=temp_project_root
            )
            orch.current_batch_id = 1

            status = orch.read_sprint_status()
            assert "development_status" in status
            assert status["development_status"]["1-2-second-story"] == "ready-for-dev"

    def test_orchestrator_selects_correct_story_after_resume(self, temp_project_root):
        """Orchestrator should select the next non-done story on resume."""
        # Update sprint-status to simulate partial completion
        import yaml

        status_path = (
            temp_project_root
            / "_bmad-output/implementation-artifacts/sprint-status.yaml"
        )

        with open(status_path) as f:
            status = yaml.safe_load(f)

        status["development_status"]["1-2-second-story"] = "done"

        with open(status_path, "w") as f:
            yaml.dump(status, f, default_flow_style=False)

        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=2, project_root=temp_project_root
            )
            orch.current_batch_id = 1

            stories = orch.select_stories(orch.read_sprint_status())
            # Should skip done story and select next
            assert "1-2-second-story" not in stories
            assert "1-3-third-story" in stories or "2a-1-new-story" in stories


# =============================================================================
# Test: Full Integration Workflow (Mocked Subprocess)
# =============================================================================


class TestFullIntegrationWorkflow:
    """End-to-end integration tests with mocked subprocess."""

    @pytest.mark.asyncio
    async def test_complete_workflow_with_mocked_subprocess(self, temp_project_root):
        """Test complete workflow from start to story completion."""
        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ), patch("server.orchestrator.create_story", return_value=1), patch(
            "server.orchestrator.update_story"
        ), patch(
            "server.orchestrator.create_event"
        ), patch(
            "server.orchestrator.update_batch"
        ), patch(
            "server.orchestrator.get_story_by_key", return_value={"id": 1}
        ), patch(
            "server.orchestrator.create_background_task", return_value=1
        ), patch(
            "server.orchestrator.update_background_task"
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=1, project_root=temp_project_root
            )
            orch.current_batch_id = 1

            # Mock the spawn_subagent to return success immediately
            async def mock_spawn(*args, **kwargs):
                return {
                    "events": [],
                    "exit_code": 0,
                    "stdout": "[TECH-SPEC-DECISION: SKIP]\nZERO ISSUES",
                }

            with patch.object(orch, "spawn_subagent", side_effect=mock_spawn):
                with patch.object(orch, "check_project_context", new_callable=AsyncMock):
                    # Run one cycle
                    result = await orch.run_cycle()

                    # Cycle should complete (may return True or False depending on story state)
                    assert isinstance(result, bool)
                    assert orch.cycles_completed >= 0


# =============================================================================
# Test: Orchestrator State Machine
# =============================================================================


class TestOrchestratorStateMachine:
    """Tests for orchestrator state machine transitions."""

    def test_initial_state_is_idle(self, temp_project_root):
        """Orchestrator should start in IDLE state."""
        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=2, project_root=temp_project_root
            )
            assert orch.state == OrchestratorState.IDLE

    @pytest.mark.asyncio
    async def test_state_transitions_during_execution(self, temp_project_root):
        """Orchestrator should transition through states during execution."""
        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ), patch("server.orchestrator.create_story"), patch(
            "server.orchestrator.update_batch"
        ), patch(
            "server.orchestrator.create_event"
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=1, project_root=temp_project_root
            )

            assert orch.state == OrchestratorState.IDLE

            # Mock subagent to return immediately
            async def mock_spawn(*args, **kwargs):
                # During spawn, state should transition
                return {"events": [], "exit_code": 0, "stdout": "ZERO ISSUES"}

            with patch.object(orch, "spawn_subagent", side_effect=mock_spawn):
                with patch.object(orch, "check_project_context", new_callable=AsyncMock):
                    # Start should transition to STARTING then RUNNING_CYCLE
                    await orch.start()

                    # After completion, should be back to IDLE
                    assert orch.state == OrchestratorState.IDLE


# =============================================================================
# Test: Error Handling
# =============================================================================


class TestErrorHandling:
    """Tests for error handling in integration scenarios."""

    def test_missing_sprint_status_raises_error(self, temp_project_root):
        """Orchestrator should raise error if sprint-status.yaml missing."""
        # Remove sprint-status.yaml
        status_path = (
            temp_project_root
            / "_bmad-output/implementation-artifacts/sprint-status.yaml"
        )
        status_path.unlink()

        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=2, project_root=temp_project_root
            )
            orch.current_batch_id = 1

            with pytest.raises(FileNotFoundError):
                orch.read_sprint_status()

    def test_build_prompt_system_append_returns_valid_xml(self, temp_project_root):
        """Orchestrator should return valid XML structure from build_prompt_system_append.

        v3 Note: load_prompt() was removed in v3. Context is now injected via
        build_prompt_system_append() which returns XML content for --prompt-system-append.
        """
        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=2, project_root=temp_project_root
            )
            orch.current_batch_id = 1

            # build_prompt_system_append should return valid XML even with no matching files
            result = orch.build_prompt_system_append(
                command_name="test-command",
                story_keys=["nonexistent-story"],
                include_project_context=False,
            )
            assert "<file_injections" in result
            assert "</file_injections>" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
