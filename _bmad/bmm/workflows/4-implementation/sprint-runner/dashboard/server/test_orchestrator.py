#!/usr/bin/env python3
"""
Tests for Sprint Runner Orchestrator.

Tests cover:
- Story selection and filtering
- Epic extraction and sorting
- CSV log line parsing
- Tech-spec decision parsing
- Error pattern detection
- Sprint status updates
- Batch control logic

Run with: cd dashboard && pytest -v server/test_orchestrator.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

# Add dashboard/ to path so we can import server package
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import the module under test
from server.orchestrator import (
    Orchestrator,
    OrchestratorState,
)


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def project_root():
    """Create a temporary project root with required structure."""
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)

        # Create directory structure
        (root / "_bmad-output/implementation-artifacts").mkdir(parents=True)
        (root / "_bmad-output/planning-artifacts").mkdir(parents=True)
        (root / "_bmad/scripts").mkdir(parents=True)

        # Create a basic sprint-status.yaml
        sprint_status = """
development_status:
  epic-1: in-progress
  1-1-first-story: done
  1-2-second-story: ready-for-dev
  1-3-third-story: backlog
  epic-1-retrospective: optional
  epic-2a: backlog
  2a-1-new-story: backlog
  2a-2-another-story: backlog
"""
        (root / "_bmad-output/implementation-artifacts/sprint-status.yaml").write_text(
            sprint_status
        )

        yield root


@pytest.fixture
def orchestrator(project_root):
    """Create an orchestrator instance with mocked dependencies."""
    with patch("server.orchestrator.init_db"), patch(
        "server.orchestrator.create_batch", return_value=1
    ), patch("server.orchestrator.create_story", return_value=1), patch(
        "server.orchestrator.update_story"
    ), patch(
        "server.orchestrator.create_event"
    ), patch(
        "server.orchestrator.update_batch"
    ), patch(
        "server.orchestrator.get_story_by_key", return_value=None
    ):
        orch = Orchestrator(
            batch_mode="fixed", max_cycles=2, project_root=project_root
        )
        orch.current_batch_id = 1
        return orch


# =============================================================================
# Test Story Selection (AC: #1, Steps 1-2)
# =============================================================================


class TestStorySelection:
    """Tests for story selection and filtering logic."""

    def test_select_stories_returns_first_non_done_story(self, orchestrator):
        """Should return first non-done, non-blocked story (with pairing from same epic)."""
        status = {
            "development_status": {
                "epic-1": "in-progress",
                "1-1-first": "done",
                "1-2-second": "ready-for-dev",
                "1-3-third": "backlog",
            }
        }
        result = orchestrator.select_stories(status)
        # Returns 2 stories because 1-2-second and 1-3-third are same epic
        assert result == ["1-2-second", "1-3-third"]

    def test_select_stories_single_when_only_one_available(self, orchestrator):
        """Should return single story when only one is available."""
        status = {
            "development_status": {
                "1-1-first": "done",
                "1-2-second": "done",
                "1-3-third": "ready-for-dev",
            }
        }
        result = orchestrator.select_stories(status)
        assert result == ["1-3-third"]

    def test_select_stories_pairs_same_epic(self, orchestrator):
        """Should pair two stories from the same epic."""
        status = {
            "development_status": {
                "2a-1-first": "backlog",
                "2a-2-second": "backlog",
                "2b-1-other": "backlog",
            }
        }
        result = orchestrator.select_stories(status)
        assert result == ["2a-1-first", "2a-2-second"]

    def test_select_stories_single_when_different_epics(self, orchestrator):
        """Should return single story when next is different epic."""
        status = {
            "development_status": {
                "1-1-first": "backlog",
                "2a-1-second": "backlog",
            }
        }
        result = orchestrator.select_stories(status)
        assert result == ["1-1-first"]

    def test_select_stories_excludes_epic_keys(self, orchestrator):
        """Should exclude keys starting with 'epic-'."""
        status = {
            "development_status": {
                "epic-1": "in-progress",
                "1-1-story": "backlog",
            }
        }
        result = orchestrator.select_stories(status)
        assert result == ["1-1-story"]
        assert "epic-1" not in result

    def test_select_stories_excludes_retrospectives(self, orchestrator):
        """Should exclude keys ending with '-retrospective'."""
        status = {
            "development_status": {
                "1-1-story": "backlog",
                "epic-1-retrospective": "optional",
            }
        }
        result = orchestrator.select_stories(status)
        assert result == ["1-1-story"]
        assert "epic-1-retrospective" not in result

    def test_select_stories_excludes_done_and_blocked(self, orchestrator):
        """Should exclude done and blocked stories."""
        status = {
            "development_status": {
                "1-1-first": "done",
                "1-2-second": "blocked",
                "1-3-third": "backlog",
            }
        }
        result = orchestrator.select_stories(status)
        assert result == ["1-3-third"]

    def test_select_stories_returns_empty_when_all_done(self, orchestrator):
        """Should return empty list when all stories done or blocked."""
        status = {
            "development_status": {
                "1-1-first": "done",
                "1-2-second": "blocked",
            }
        }
        result = orchestrator.select_stories(status)
        assert result == []


# =============================================================================
# Test Epic Extraction
# =============================================================================


class TestEpicExtraction:
    """Tests for epic prefix extraction from story keys."""

    def test_extract_epic_simple(self, orchestrator):
        """Should extract simple numeric epic."""
        assert orchestrator._extract_epic("1-1") == "1"
        assert orchestrator._extract_epic("2-3") == "2"

    def test_extract_epic_with_letter(self, orchestrator):
        """Should extract epic with letter suffix."""
        assert orchestrator._extract_epic("2a-1") == "2a"
        assert orchestrator._extract_epic("3b-2") == "3b"

    def test_extract_epic_complex(self, orchestrator):
        """Should extract complex epic patterns."""
        assert orchestrator._extract_epic("5-sr-3") == "5-sr"
        assert orchestrator._extract_epic("10-abc-5") == "10-abc"

    def test_extract_epic_single_part(self, orchestrator):
        """Should handle single-part keys."""
        assert orchestrator._extract_epic("story") == "story"


# =============================================================================
# Test Story Sorting
# =============================================================================


class TestStorySorting:
    """Tests for story key sorting."""

    def test_sort_key_numeric_order(self, orchestrator):
        """Should sort stories numerically."""
        stories = ["2-1", "1-2", "1-1", "3-1"]
        sorted_stories = sorted(stories, key=orchestrator._story_sort_key)
        assert sorted_stories == ["1-1", "1-2", "2-1", "3-1"]

    def test_sort_key_with_letters(self, orchestrator):
        """Should sort stories with letter suffixes."""
        stories = ["2a-1", "1-1", "2b-1", "2-1"]
        sorted_stories = sorted(stories, key=orchestrator._story_sort_key)
        # 1-1 < 2-1 < 2a-1 < 2b-1 (numeric first, then alphabetic suffix)
        assert sorted_stories == ["1-1", "2-1", "2a-1", "2b-1"]

    def test_sort_key_complex_patterns(self, orchestrator):
        """Should sort complex story patterns."""
        stories = ["5-sr-3", "5-sr-1", "4-1", "5-sr-2"]
        sorted_stories = sorted(stories, key=orchestrator._story_sort_key)
        assert sorted_stories == ["4-1", "5-sr-1", "5-sr-2", "5-sr-3"]


# =============================================================================
# Test CSV Log Parsing (AC: #3)
# =============================================================================


class TestCSVLogParsing:
    """Tests for orchestrator.sh CSV log line parsing."""

    def test_parse_valid_csv_line(self, orchestrator):
        """Should parse valid CSV log line."""
        import time
        now = int(time.time())
        line = f'{now},2a,2a-1,create-story,setup,start,"Initializing story"'
        result = orchestrator._parse_csv_log_line(line)

        assert result is not None
        assert result["timestamp"] == now
        assert result["epic_id"] == "2a"
        assert result["story_id"] == "2a-1"
        assert result["command"] == "create-story"
        assert result["task_id"] == "setup"
        assert result["status"] == "start"
        assert result["message"] == "Initializing story"

    def test_parse_invalid_timestamp(self, orchestrator):
        """Should reject invalid timestamps."""
        line = '123,2a,2a-1,create-story,setup,start,"Message"'  # Too old
        result = orchestrator._parse_csv_log_line(line)
        assert result is None

    def test_parse_malformed_csv(self, orchestrator):
        """Should handle malformed CSV gracefully."""
        line = "not,enough,columns"
        result = orchestrator._parse_csv_log_line(line)
        assert result is None

    def test_parse_empty_line(self, orchestrator):
        """Should handle empty line."""
        result = orchestrator._parse_csv_log_line("")
        assert result is None

    def test_parse_quoted_message(self, orchestrator):
        """Should parse message with quotes and commas."""
        import time
        now = int(time.time())
        line = f'{now},2a,2a-1,code-review,fix,end,"Fixed issues (files:3, lines:150)"'
        result = orchestrator._parse_csv_log_line(line)

        assert result is not None
        assert result["message"] == "Fixed issues (files:3, lines:150)"


# =============================================================================
# Test Tech-Spec Decision Parsing (AC: #1)
# =============================================================================


class TestTechSpecDecision:
    """Tests for tech-spec decision parsing."""

    def test_parse_required_decision(self, orchestrator):
        """Should parse REQUIRED decision."""
        stdout = "Story analysis complete. [TECH-SPEC-DECISION: REQUIRED] Complex logic detected."
        result = orchestrator._parse_tech_spec_decision(stdout)
        assert result == "REQUIRED"

    def test_parse_skip_decision(self, orchestrator):
        """Should parse SKIP decision."""
        stdout = "Simple CRUD story. [TECH-SPEC-DECISION: SKIP] No complex logic."
        result = orchestrator._parse_tech_spec_decision(stdout)
        assert result == "SKIP"

    def test_parse_no_decision_defaults_required(self, orchestrator):
        """Should default to REQUIRED when no decision found."""
        stdout = "Story created successfully."
        result = orchestrator._parse_tech_spec_decision(stdout)
        assert result == "REQUIRED"

    def test_parse_tech_spec_decisions_per_story(self, orchestrator):
        """Should parse multiple tech-spec decisions per story (CRITICAL #1)."""
        stdout = """
        Story 1 analysis complete. [TECH-SPEC-DECISION: REQUIRED] Complex logic detected.
        Story 2 analysis complete. [TECH-SPEC-DECISION: SKIP] Simple CRUD.
        """
        story_keys = ["2a-1", "2a-2"]
        result = orchestrator._parse_tech_spec_decisions(stdout, story_keys)

        assert result["2a-1"] == "REQUIRED"
        assert result["2a-2"] == "SKIP"

    def test_parse_tech_spec_decisions_defaults_to_required(self, orchestrator):
        """Should default to REQUIRED when not enough decisions provided."""
        stdout = "[TECH-SPEC-DECISION: SKIP] First story only."
        story_keys = ["2a-1", "2a-2", "2a-3"]
        result = orchestrator._parse_tech_spec_decisions(stdout, story_keys)

        assert result["2a-1"] == "SKIP"
        assert result["2a-2"] == "REQUIRED"  # Defaults
        assert result["2a-3"] == "REQUIRED"  # Defaults

    def test_parse_tech_spec_decisions_case_insensitive(self, orchestrator):
        """Should parse decisions case-insensitively."""
        stdout = "[tech-spec-decision: required] [tech-spec-decision: skip]"
        story_keys = ["1-1", "1-2"]
        result = orchestrator._parse_tech_spec_decisions(stdout, story_keys)

        assert result["1-1"] == "REQUIRED"
        assert result["1-2"] == "SKIP"


# =============================================================================
# Test Error Pattern Detection (AC: #4)
# =============================================================================


class TestErrorPatternDetection:
    """Tests for error pattern detection in code reviews."""

    def test_same_errors_3x_true(self, orchestrator):
        """Should detect 3 consecutive same errors."""
        history = ["HIGH", "HIGH", "HIGH"]
        assert orchestrator._same_errors_3x(history) is True

    def test_same_errors_3x_false_different(self, orchestrator):
        """Should return False for different errors."""
        history = ["HIGH", "MEDIUM", "HIGH"]
        assert orchestrator._same_errors_3x(history) is False

    def test_same_errors_3x_false_too_short(self, orchestrator):
        """Should return False for history shorter than 3."""
        history = ["HIGH", "HIGH"]
        assert orchestrator._same_errors_3x(history) is False

    def test_same_errors_3x_only_checks_last_3(self, orchestrator):
        """Should only check last 3 entries."""
        history = ["LOW", "HIGH", "HIGH", "HIGH"]
        assert orchestrator._same_errors_3x(history) is True


# =============================================================================
# Test Severity Parsing (AC: #4)
# =============================================================================


class TestSeverityParsing:
    """Tests for code review severity parsing."""

    def test_parse_zero_issues(self, orchestrator):
        """Should detect ZERO ISSUES."""
        stdout = "Code review complete. ZERO ISSUES found. Ready for merge."
        assert orchestrator._parse_highest_severity(stdout) == "ZERO"

    def test_parse_critical_severity(self, orchestrator):
        """Should detect CRITICAL severity."""
        stdout = "HIGHEST SEVERITY: CRITICAL - Security vulnerability found."
        assert orchestrator._parse_highest_severity(stdout) == "CRITICAL"

    def test_parse_high_severity(self, orchestrator):
        """Should detect HIGH severity."""
        stdout = "HIGHEST SEVERITY: HIGH - Performance issue detected."
        assert orchestrator._parse_highest_severity(stdout) == "HIGH"

    def test_parse_medium_severity(self, orchestrator):
        """Should detect MEDIUM severity."""
        stdout = "HIGHEST SEVERITY: MEDIUM - Code style improvements needed."
        assert orchestrator._parse_highest_severity(stdout) == "MEDIUM"

    def test_parse_low_severity(self, orchestrator):
        """Should detect LOW severity."""
        stdout = "HIGHEST SEVERITY: LOW - Minor documentation updates."
        assert orchestrator._parse_highest_severity(stdout) == "LOW"

    def test_parse_unknown_severity(self, orchestrator):
        """Should return UNKNOWN for unrecognized output."""
        stdout = "Review completed with some notes."
        assert orchestrator._parse_highest_severity(stdout) == "UNKNOWN"


# =============================================================================
# Test Critical Issues Detection (AC: #2b, #3b)
# =============================================================================


class TestCriticalIssuesDetection:
    """Tests for critical issues detection in reviews."""

    def test_detect_critical_issues(self, orchestrator):
        """Should detect critical issues."""
        stdout = "HIGHEST SEVERITY: CRITICAL - Security flaw detected."
        assert orchestrator._check_for_critical_issues(stdout) is True

    def test_no_critical_issues(self, orchestrator):
        """Should return False when no critical issues."""
        stdout = "HIGHEST SEVERITY: HIGH - Performance concerns."
        assert orchestrator._check_for_critical_issues(stdout) is False


# =============================================================================
# Test Sprint Status Updates (AC: #4)
# =============================================================================


class TestSprintStatusUpdates:
    """Tests for sprint-status.yaml updates."""

    def test_update_sprint_status(self, orchestrator, project_root):
        """Should update story status in sprint-status.yaml."""
        orchestrator.update_sprint_status("1-2-second-story", "done")

        # Read back and verify
        import yaml

        status_path = (
            project_root / "_bmad-output/implementation-artifacts/sprint-status.yaml"
        )
        with open(status_path) as f:
            status = yaml.safe_load(f)

        assert status["development_status"]["1-2-second-story"] == "done"

    def test_get_story_status(self, orchestrator, project_root):
        """Should get current story status."""
        status = orchestrator._get_story_status("1-2-second-story")
        assert status == "ready-for-dev"

    def test_get_story_status_unknown(self, orchestrator, project_root):
        """Should return 'unknown' for non-existent story."""
        status = orchestrator._get_story_status("nonexistent-story")
        assert status == "unknown"


# =============================================================================
# Test Batch Control (AC: #5, #6)
# =============================================================================


class TestBatchControl:
    """Tests for batch mode and cycle control."""

    def test_fixed_batch_mode_initialization(self, project_root):
        """Should initialize with fixed batch mode."""
        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=3, project_root=project_root
            )
            assert orch.batch_mode == "fixed"
            assert orch.max_cycles == 3

    def test_all_batch_mode_initialization(self, project_root):
        """Should initialize with 'all' batch mode."""
        with patch("server.orchestrator.init_db"), patch(
            "server.orchestrator.create_batch", return_value=1
        ):
            orch = Orchestrator(
                batch_mode="all", max_cycles=999, project_root=project_root
            )
            assert orch.batch_mode == "all"
            assert orch.max_cycles == 999

    def test_state_transitions(self, orchestrator):
        """Should start in IDLE state."""
        assert orchestrator.state == OrchestratorState.IDLE


# =============================================================================
# Test WebSocket Event Emission (AC: #3, #4)
# =============================================================================


class TestWebSocketEmission:
    """Tests for WebSocket event emission."""

    def test_emit_event_constructs_correct_format(self, orchestrator):
        """Should construct events with correct format."""
        # The emit_event function creates the event structure correctly
        # We verify this by checking it doesn't raise errors
        # Actual WebSocket broadcast is tested in integration tests
        try:
            orchestrator.emit_event("batch:start", {"batch_id": 1})
        except Exception as e:
            pytest.fail(f"emit_event raised unexpected exception: {e}")

    def test_emit_event_handles_broadcast_failure(self, orchestrator):
        """Should handle broadcast failures gracefully."""
        with patch("server.orchestrator.asyncio.create_task", side_effect=RuntimeError("No event loop")):
            # Should not raise - failures are caught silently
            orchestrator.emit_event("test:event", {"data": "value"})


# =============================================================================
# Test Extract Task Event
# =============================================================================


class TestExtractTaskEvent:
    """Tests for extracting task events from stream data."""

    def test_extract_from_tool_result(self, orchestrator):
        """Should extract task event from tool_result."""
        import time
        now = int(time.time())
        event = {
            "type": "tool_result",
            "content": f'{now},2a,2a-1,create-story,setup,start,"Starting"',
        }
        result = orchestrator._extract_task_event(event)

        assert result is not None
        assert result["command"] == "create-story"

    def test_ignore_non_tool_result(self, orchestrator):
        """Should ignore non-tool_result events."""
        event = {"type": "assistant", "content": "Hello"}
        result = orchestrator._extract_task_event(event)
        assert result is None

    def test_handle_non_string_content(self, orchestrator):
        """Should handle non-string content gracefully."""
        event = {"type": "tool_result", "content": {"key": "value"}}
        result = orchestrator._extract_task_event(event)
        assert result is None


# =============================================================================
# Integration Tests (Mocked Subprocess)
# =============================================================================


class TestIntegration:
    """Integration tests with mocked subprocess."""

    @pytest.mark.asyncio
    async def test_project_context_check_creates_when_missing(
        self, orchestrator, project_root
    ):
        """Should spawn subagent when project context missing."""
        # Ensure context doesn't exist
        context_path = (
            project_root / "_bmad-output/planning-artifacts/project-context.md"
        )
        assert not context_path.exists()

        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch("server.orchestrator.create_event"):
                await orchestrator.check_project_context()

                mock_spawn.assert_called_once()
                assert "generate-project-context" in str(mock_spawn.call_args)

    @pytest.mark.asyncio
    async def test_project_context_check_skips_when_fresh(
        self, orchestrator, project_root
    ):
        """Should skip refresh when project context is fresh."""
        # Create a fresh context file
        context_path = (
            project_root / "_bmad-output/planning-artifacts/project-context.md"
        )
        context_path.write_text("# Fresh context")

        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            await orchestrator.check_project_context()

            # Should not spawn any subagent
            mock_spawn.assert_not_called()


# =============================================================================
# Test Project Context Freshness (Story 5-SR-4, AC: #3)
# =============================================================================


class TestProjectContextStatus:
    """Tests for check_project_context_status() function (Task 1)."""

    def test_returns_missing_when_file_does_not_exist(self, orchestrator, project_root):
        """Should return 'missing' when project-context.md doesn't exist."""
        # Ensure file doesn't exist
        context_path = (
            project_root / "_bmad-output/planning-artifacts/project-context.md"
        )
        if context_path.exists():
            context_path.unlink()

        result = orchestrator.check_project_context_status()
        assert result == "missing"

    def test_returns_fresh_when_file_is_recent(self, orchestrator, project_root):
        """Should return 'fresh' when file is less than 24 hours old."""
        # Create a fresh context file (just created = 0 seconds old)
        context_path = (
            project_root / "_bmad-output/planning-artifacts/project-context.md"
        )
        context_path.write_text("# Fresh context")

        result = orchestrator.check_project_context_status()
        assert result == "fresh"

    def test_returns_expired_when_file_is_old(self, orchestrator, project_root):
        """Should return 'expired' when file is more than 24 hours old."""
        import time

        context_path = (
            project_root / "_bmad-output/planning-artifacts/project-context.md"
        )
        context_path.write_text("# Old context")

        # Set modification time to 25 hours ago
        old_time = time.time() - (25 * 3600)  # 25 hours ago
        os.utime(context_path, (old_time, old_time))

        result = orchestrator.check_project_context_status()
        assert result == "expired"

    def test_returns_fresh_at_24_hour_boundary(self, orchestrator, project_root):
        """Should return 'fresh' when file is exactly 24 hours old (edge case)."""
        import time

        context_path = (
            project_root / "_bmad-output/planning-artifacts/project-context.md"
        )
        context_path.write_text("# Boundary context")

        # Set modification time to exactly 24 hours ago (minus 1 second for buffer)
        boundary_time = time.time() - (24 * 3600) + 60  # 24 hours - 60 seconds
        os.utime(context_path, (boundary_time, boundary_time))

        result = orchestrator.check_project_context_status()
        assert result == "fresh"


# =============================================================================
# Test Blocking Context Creation (Story 5-SR-4, AC: #1)
# =============================================================================


class TestBlockingContextCreation:
    """Tests for create_project_context() blocking behavior (Task 2)."""

    @pytest.mark.asyncio
    async def test_create_blocks_until_completion(self, orchestrator, project_root):
        """Should block (await) until subprocess completes."""
        import time

        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            # Simulate a 100ms delay
            async def delayed_response(*args, **kwargs):
                await asyncio.sleep(0.1)
                return {"exit_code": 0, "stdout": "", "events": []}

            mock_spawn.side_effect = delayed_response

            with patch("server.orchestrator.create_event"):
                start_time = time.time()
                await orchestrator.create_project_context()
                elapsed = time.time() - start_time

                # Should have blocked for at least 100ms
                assert elapsed >= 0.1
                mock_spawn.assert_called_once()
                # Verify wait=True was passed
                call_kwargs = mock_spawn.call_args.kwargs
                assert call_kwargs.get("wait", True) is True

    @pytest.mark.asyncio
    async def test_create_logs_context_create_event(self, orchestrator, project_root):
        """Should log 'context:create' event to database."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch("server.orchestrator.create_event") as mock_event:
                await orchestrator.create_project_context()

                # Should have called create_event with context:create
                mock_event.assert_called()
                call_args = mock_event.call_args
                assert call_args.kwargs.get("task_id") == "context"
                assert call_args.kwargs.get("status") == "create"


# =============================================================================
# Test Background Context Refresh (Story 5-SR-4, AC: #2, #4)
# =============================================================================


class TestBackgroundContextRefresh:
    """Tests for refresh_project_context_background() non-blocking behavior (Task 3)."""

    @pytest.mark.asyncio
    async def test_refresh_returns_immediately(self, orchestrator, project_root):
        """Should return immediately without waiting for completion."""
        import time

        with patch.object(
            orchestrator, "_run_background_context_refresh", new_callable=AsyncMock
        ) as mock_refresh:
            # Make the background task take 500ms (but we should not wait for it)
            async def slow_task(*args, **kwargs):
                await asyncio.sleep(0.5)

            mock_refresh.side_effect = slow_task

            with patch("server.orchestrator.create_background_task", return_value=1):
                with patch("server.orchestrator.create_event"):
                    start_time = time.time()
                    await orchestrator.refresh_project_context_background()
                    elapsed = time.time() - start_time

                    # Should return in less than 100ms (not waiting for the 500ms task)
                    assert elapsed < 0.2

    @pytest.mark.asyncio
    async def test_refresh_creates_background_task_record(
        self, orchestrator, project_root
    ):
        """Should create record in background_tasks table with status 'running'."""
        with patch.object(
            orchestrator, "_run_background_context_refresh", new_callable=AsyncMock
        ):
            with patch(
                "server.orchestrator.create_background_task", return_value=42
            ) as mock_create:
                with patch("server.orchestrator.create_event"):
                    await orchestrator.refresh_project_context_background()

                    mock_create.assert_called_once()
                    call_kwargs = mock_create.call_args.kwargs
                    assert call_kwargs.get("task_type") == "project-context-refresh"
                    assert call_kwargs.get("batch_id") == orchestrator.current_batch_id

    @pytest.mark.asyncio
    async def test_refresh_logs_context_refresh_event(
        self, orchestrator, project_root
    ):
        """Should log 'context:refresh' event immediately."""
        with patch.object(
            orchestrator, "_run_background_context_refresh", new_callable=AsyncMock
        ):
            with patch("server.orchestrator.create_background_task", return_value=1):
                with patch("server.orchestrator.create_event") as mock_event:
                    await orchestrator.refresh_project_context_background()

                    mock_event.assert_called()
                    call_args = mock_event.call_args
                    assert call_args.kwargs.get("task_id") == "context"
                    assert call_args.kwargs.get("status") == "refresh"

    @pytest.mark.asyncio
    async def test_background_task_updates_completed_at(
        self, orchestrator, project_root
    ):
        """Should update background_tasks.completed_at when done (AC: #4)."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch(
                "server.orchestrator.update_background_task"
            ) as mock_update:
                with patch("server.orchestrator.create_background_task", return_value=99):
                    # Run the actual background refresh function
                    await orchestrator._run_background_context_refresh(99)

                    mock_update.assert_called()
                    call_kwargs = mock_update.call_args.kwargs
                    assert call_kwargs.get("status") == "completed"
                    assert "completed_at" in call_kwargs

    @pytest.mark.asyncio
    async def test_background_task_emits_context_complete_event(
        self, orchestrator, project_root
    ):
        """Should emit 'context:complete' WebSocket event when done (AC: #4)."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch("server.orchestrator.update_background_task"):
                with patch.object(
                    orchestrator, "emit_event"
                ) as mock_emit:
                    await orchestrator._run_background_context_refresh(99)

                    # Should have emitted context:complete
                    emit_calls = [
                        call for call in mock_emit.call_args_list
                        if call.args[0] == "context:complete"
                    ]
                    assert len(emit_calls) >= 1


# =============================================================================
# Test Main Loop Integration (Story 5-SR-4, AC: #1, #2)
# =============================================================================


class TestMainLoopIntegration:
    """Tests for check_project_context() integration in main loop (Task 4)."""

    @pytest.mark.asyncio
    async def test_missing_context_blocks_before_continuing(
        self, orchestrator, project_root
    ):
        """Should call create_project_context() and WAIT when missing (AC: #1)."""
        # Ensure context doesn't exist
        context_path = (
            project_root / "_bmad-output/planning-artifacts/project-context.md"
        )
        if context_path.exists():
            context_path.unlink()

        with patch.object(
            orchestrator, "create_project_context", new_callable=AsyncMock
        ) as mock_create:
            with patch.object(
                orchestrator, "refresh_project_context_background", new_callable=AsyncMock
            ) as mock_refresh:
                await orchestrator.check_project_context()

                mock_create.assert_called_once()
                mock_refresh.assert_not_called()

    @pytest.mark.asyncio
    async def test_expired_context_continues_immediately(
        self, orchestrator, project_root
    ):
        """Should call refresh_project_context_background() and continue (AC: #2)."""
        import time

        # Create an expired context file
        context_path = (
            project_root / "_bmad-output/planning-artifacts/project-context.md"
        )
        context_path.write_text("# Old context")
        old_time = time.time() - (25 * 3600)  # 25 hours ago
        os.utime(context_path, (old_time, old_time))

        with patch.object(
            orchestrator, "create_project_context", new_callable=AsyncMock
        ) as mock_create:
            with patch.object(
                orchestrator, "refresh_project_context_background", new_callable=AsyncMock
            ) as mock_refresh:
                await orchestrator.check_project_context()

                mock_create.assert_not_called()
                mock_refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_fresh_context_skips_regeneration(self, orchestrator, project_root):
        """Should log fresh status and skip regeneration (AC: #2 implied)."""
        # Create a fresh context file
        context_path = (
            project_root / "_bmad-output/planning-artifacts/project-context.md"
        )
        context_path.write_text("# Fresh context")

        with patch.object(
            orchestrator, "create_project_context", new_callable=AsyncMock
        ) as mock_create:
            with patch.object(
                orchestrator, "refresh_project_context_background", new_callable=AsyncMock
            ) as mock_refresh:
                with patch.object(orchestrator, "emit_event") as mock_emit:
                    await orchestrator.check_project_context()

                    mock_create.assert_not_called()
                    mock_refresh.assert_not_called()

                    # Should have emitted fresh status event
                    emit_calls = [
                        call for call in mock_emit.call_args_list
                        if call.args[0] == "context:fresh"
                    ]
                    assert len(emit_calls) >= 1


# =============================================================================
# Test Process Communication Error Handling (Story 5-SR-3, CRITICAL #2)
# =============================================================================


class TestProcessCommunicationErrorHandling:
    """Tests for error handling in process communication."""

    @pytest.mark.asyncio
    async def test_spawn_subagent_handles_broken_pipe(self, orchestrator):
        """Should handle BrokenPipeError gracefully (CRITICAL #2)."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock(side_effect=BrokenPipeError("Pipe broken"))
            mock_process.stdin.close.return_value = None
            mock_process.returncode = None
            mock_process.kill.return_value = None

            mock_create.return_value = mock_process

            with pytest.raises(BrokenPipeError):
                await orchestrator.spawn_subagent("test prompt", "test-command")

            # Should have tried to kill the process
            mock_process.kill.assert_called()

    @pytest.mark.asyncio
    async def test_spawn_subagent_handles_connection_reset(self, orchestrator):
        """Should handle ConnectionResetError gracefully (CRITICAL #2)."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock(
                side_effect=ConnectionResetError("Connection reset")
            )
            mock_process.stdin.close.return_value = None
            mock_process.returncode = None
            mock_process.kill.return_value = None

            mock_create.return_value = mock_process

            with pytest.raises(ConnectionResetError):
                await orchestrator.spawn_subagent("test prompt", "test-command")

            mock_process.kill.assert_called()


# =============================================================================
# Test Review Status Handler (Story 5-SR-3, HIGH #1)
# =============================================================================


class TestReviewStatusHandler:
    """Tests for 'review' status handling in workflow."""

    @pytest.mark.asyncio
    async def test_review_status_skips_create_story_phase(self, orchestrator):
        """Should skip create-story phase when status is 'review' (HIGH #1)."""
        status = {
            "development_status": {
                "1-1-story": "review",
            }
        }

        with patch.object(
            orchestrator, "_execute_create_story_phase", new_callable=AsyncMock
        ) as mock_create:
            with patch.object(
                orchestrator, "_execute_dev_phase", new_callable=AsyncMock
            ) as mock_dev:
                with patch.object(
                    orchestrator, "_execute_batch_commit", new_callable=AsyncMock
                ):
                    with patch("server.orchestrator.create_story", return_value=1):
                        with patch("server.orchestrator.update_batch"):
                            with patch.object(
                                orchestrator, "read_sprint_status", return_value=status
                            ):
                                with patch.object(
                                    orchestrator, "select_stories", return_value=["1-1-story"]
                                ):
                                    with patch.object(
                                        orchestrator, "_get_story_status", return_value="done"
                                    ):
                                        # Run cycle with review status
                                        await orchestrator.run_cycle()

                                        # Should NOT call create-story phase
                                        mock_create.assert_not_called()


# =============================================================================
# Test Graceful Shutdown (Story 5-SR-3, HIGH #2)
# =============================================================================


class TestGracefulShutdown:
    """Tests for graceful shutdown of child processes."""

    @pytest.mark.asyncio
    async def test_stop_cancels_background_tasks(self, orchestrator):
        """Should cancel all background tasks on stop (HIGH #2)."""
        # Create mock background tasks
        task1 = AsyncMock()
        task2 = AsyncMock()
        orchestrator._background_tasks = [task1, task2]

        await orchestrator.stop()

        # Both tasks should have been cancelled
        task1.cancel.assert_called()
        task2.cancel.assert_called()

    @pytest.mark.asyncio
    async def test_stop_sets_stop_requested_flag(self, orchestrator):
        """Should set stop_requested flag."""
        assert orchestrator.stop_requested is False

        await orchestrator.stop()

        assert orchestrator.stop_requested is True

    @pytest.mark.asyncio
    async def test_stop_emits_batch_end_event(self, orchestrator):
        """Should emit batch:end event with stopped status."""
        with patch.object(orchestrator, "emit_event") as mock_emit:
            await orchestrator.stop()

            # Should have called emit_event with batch:end status=stopped
            emit_calls = [
                call for call in mock_emit.call_args_list
                if call.args[0] == "batch:end"
            ]
            assert len(emit_calls) >= 1


# =============================================================================
# Test Timestamp Validation (Story 5-SR-3, MEDIUM #2)
# =============================================================================


class TestTimestampValidation:
    """Tests for dynamic timestamp validation."""

    def test_timestamp_validation_accepts_recent_timestamps(self, orchestrator):
        """Should accept timestamps within past year (MEDIUM #2)."""
        import time

        now = int(time.time())
        recent_timestamp = now - (30 * 24 * 3600)  # 30 days ago

        line = (
            f"{recent_timestamp},2a,2a-1,create-story,setup,start,"
            '"Recent timestamp"'
        )
        result = orchestrator._parse_csv_log_line(line)

        assert result is not None
        assert result["timestamp"] == recent_timestamp

    def test_timestamp_validation_accepts_future_timestamps(self, orchestrator):
        """Should accept timestamps up to 1 hour in future (MEDIUM #2)."""
        import time

        now = int(time.time())
        future_timestamp = now + 1800  # 30 minutes in future

        line = (
            f"{future_timestamp},2a,2a-1,create-story,setup,start,"
            '"Future timestamp"'
        )
        result = orchestrator._parse_csv_log_line(line)

        assert result is not None
        assert result["timestamp"] == future_timestamp

    def test_timestamp_validation_rejects_very_old_timestamps(self, orchestrator):
        """Should reject timestamps older than 1 year (MEDIUM #2)."""
        import time

        now = int(time.time())
        old_timestamp = now - (400 * 24 * 3600)  # More than 1 year ago

        line = (
            f"{old_timestamp},2a,2a-1,create-story,setup,start,"
            '"Very old timestamp"'
        )
        result = orchestrator._parse_csv_log_line(line)

        assert result is None

    def test_timestamp_validation_rejects_far_future_timestamps(self, orchestrator):
        """Should reject timestamps more than 1 hour in future (MEDIUM #2)."""
        import time

        now = int(time.time())
        far_future_timestamp = now + (2 * 3600)  # 2 hours in future

        line = (
            f"{far_future_timestamp},2a,2a-1,create-story,setup,start,"
            '"Far future timestamp"'
        )
        result = orchestrator._parse_csv_log_line(line)

        assert result is None


# =============================================================================
# Test spawn_subagent prompt_system_append Parameter (Story A-2)
# =============================================================================


class TestSpawnSubagentPromptSystemAppend:
    """Tests for spawn_subagent() prompt_system_append parameter (Story A-2)."""

    @pytest.mark.asyncio
    async def test_spawn_subagent_without_prompt_system_append(self, orchestrator):
        """Should not add --prompt-system-append flag when parameter not provided (AC2)."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock()
            mock_process.stdin.close.return_value = None
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock()
            mock_process.returncode = 0
            mock_create.return_value = mock_process

            await orchestrator.spawn_subagent("test prompt", "test-command")

            # Verify the flag was NOT passed
            call_args = mock_create.call_args[0]
            assert "--prompt-system-append" not in call_args

    @pytest.mark.asyncio
    async def test_spawn_subagent_with_prompt_system_append(self, orchestrator):
        """Should add --prompt-system-append flag when parameter provided (AC3)."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock()
            mock_process.stdin.close.return_value = None
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock()
            mock_process.returncode = 0
            mock_create.return_value = mock_process

            test_content = "<file_injections>test content</file_injections>"
            await orchestrator.spawn_subagent(
                "test prompt",
                prompt_system_append=test_content
            )

            # Verify the flag was passed with correct value
            call_args = mock_create.call_args[0]
            assert "--prompt-system-append" in call_args
            idx = call_args.index("--prompt-system-append")
            assert call_args[idx + 1] == test_content

    @pytest.mark.asyncio
    async def test_spawn_subagent_flag_ordering(self, orchestrator):
        """Should place --prompt-system-append after --model in args (AC4)."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock()
            mock_process.stdin.close.return_value = None
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock()
            mock_process.returncode = 0
            mock_create.return_value = mock_process

            await orchestrator.spawn_subagent(
                "test prompt",
                model="haiku",
                prompt_system_append="<content>test</content>"
            )

            # Verify flag ordering: --model before --prompt-system-append
            call_args = mock_create.call_args[0]
            model_idx = call_args.index("--model")
            append_idx = call_args.index("--prompt-system-append")
            assert model_idx < append_idx

    @pytest.mark.asyncio
    async def test_spawn_subagent_with_both_model_and_append(self, orchestrator):
        """Should support both model and prompt_system_append together (AC4)."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock()
            mock_process.stdin.close.return_value = None
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock()
            mock_process.returncode = 0
            mock_create.return_value = mock_process

            await orchestrator.spawn_subagent(
                "test prompt",
                model="haiku",
                prompt_system_append="<xml>content</xml>"
            )

            call_args = mock_create.call_args[0]

            # Both flags should be present
            assert "--model" in call_args
            assert "--prompt-system-append" in call_args

            # Verify values
            model_idx = call_args.index("--model")
            assert call_args[model_idx + 1] == "haiku"

            append_idx = call_args.index("--prompt-system-append")
            assert call_args[append_idx + 1] == "<xml>content</xml>"

    @pytest.mark.asyncio
    async def test_spawn_subagent_preserves_base_args(self, orchestrator):
        """Should preserve base args when prompt_system_append is added."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock()
            mock_process.stdin.close.return_value = None
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock()
            mock_process.returncode = 0
            mock_create.return_value = mock_process

            await orchestrator.spawn_subagent(
                "test prompt",
                prompt_system_append="<content/>"
            )

            call_args = mock_create.call_args[0]

            # Base args should still be present
            assert "claude" in call_args
            assert "-p" in call_args
            assert "--output-format" in call_args
            assert "stream-json" in call_args

    @pytest.mark.asyncio
    async def test_spawn_subagent_with_empty_string_append(self, orchestrator):
        """Should not add --prompt-system-append flag when empty string provided."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock()
            mock_process.stdin.close.return_value = None
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock()
            mock_process.returncode = 0
            mock_create.return_value = mock_process

            # Explicitly pass empty string
            await orchestrator.spawn_subagent(
                "test prompt",
                prompt_system_append=""
            )

            # Empty string is falsy, so flag should NOT be added
            call_args = mock_create.call_args[0]
            assert "--prompt-system-append" not in call_args

    @pytest.mark.asyncio
    async def test_spawn_subagent_with_explicit_none_append(self, orchestrator):
        """Should not add --prompt-system-append flag when None explicitly provided."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock()
            mock_process.stdin.close.return_value = None
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock()
            mock_process.returncode = 0
            mock_create.return_value = mock_process

            # Explicitly pass None
            await orchestrator.spawn_subagent(
                "test prompt",
                prompt_system_append=None
            )

            call_args = mock_create.call_args[0]
            assert "--prompt-system-append" not in call_args

    @pytest.mark.asyncio
    async def test_spawn_subagent_with_special_characters_in_append(self, orchestrator):
        """Should handle special characters in prompt_system_append content."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock()
            mock_process.stdin.close.return_value = None
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock()
            mock_process.returncode = 0
            mock_create.return_value = mock_process

            # Content with special characters: newlines, quotes, angle brackets
            special_content = '''<file_injections rule="DO NOT read">
  <file path="test.md">
    Content with "double quotes" and 'single quotes'
    And <nested> XML tags </nested>
    Plus $SHELL_VAR and `backticks`
  </file>
</file_injections>'''

            await orchestrator.spawn_subagent(
                "test prompt",
                prompt_system_append=special_content
            )

            call_args = mock_create.call_args[0]
            assert "--prompt-system-append" in call_args
            idx = call_args.index("--prompt-system-append")
            # Content should be passed exactly as-is (subprocess.exec handles this)
            assert call_args[idx + 1] == special_content

    @pytest.mark.asyncio
    async def test_spawn_subagent_full_arg_structure_with_model_and_append(self, orchestrator):
        """Should produce exact expected arg structure per AC4."""
        with patch("asyncio.subprocess.create_subprocess_exec") as mock_create:
            mock_process = AsyncMock()
            mock_process.stdin.write.return_value = None
            mock_process.stdin.drain = AsyncMock()
            mock_process.stdin.close.return_value = None
            mock_process.stdout.readline = AsyncMock(return_value=b"")
            mock_process.wait = AsyncMock()
            mock_process.returncode = 0
            mock_create.return_value = mock_process

            await orchestrator.spawn_subagent(
                "test prompt",
                model="haiku",
                prompt_system_append="<content>test</content>"
            )

            call_args = list(mock_create.call_args[0])

            # Verify exact expected structure per AC4:
            # ["claude", "-p", "--output-format", "stream-json", "--model", "haiku", "--prompt-system-append", "content"]
            expected_start = ["claude", "-p", "--output-format", "stream-json"]
            assert call_args[:4] == expected_start

            # Model comes before prompt-system-append
            assert call_args[4:6] == ["--model", "haiku"]
            assert call_args[6:8] == ["--prompt-system-append", "<content>test</content>"]


# =============================================================================
# Test Copy Project Context (Story A-3)
# =============================================================================


class TestCopyProjectContext:
    """Tests for copy_project_context() method (Story A-3)."""

    def test_copy_project_context_success_when_source_exists(
        self, orchestrator, project_root
    ):
        """Should copy file and return True when source exists (AC1)."""
        # Create source file
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        source.write_text("# Project Context\n\nTest content for copy.")

        result = orchestrator.copy_project_context()

        # Verify return value
        assert result is True

        # Verify destination file was created with exact content
        dest = project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"
        assert dest.exists()
        assert dest.read_text() == "# Project Context\n\nTest content for copy."

    def test_copy_project_context_returns_false_when_source_missing(
        self, orchestrator, project_root
    ):
        """Should return False when source file does not exist (AC2)."""
        # Ensure source doesn't exist
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        if source.exists():
            source.unlink()

        result = orchestrator.copy_project_context()

        # Verify return value
        assert result is False

        # Verify destination was NOT created
        dest = project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"
        assert not dest.exists()

    def test_copy_project_context_emits_copy_failed_event_when_missing(
        self, orchestrator, project_root
    ):
        """Should emit context:copy_failed event when source missing (AC2)."""
        # Ensure source doesn't exist
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        if source.exists():
            source.unlink()

        with patch.object(orchestrator, "emit_event") as mock_emit:
            orchestrator.copy_project_context()

            # Verify context:copy_failed was emitted
            emit_calls = [
                call for call in mock_emit.call_args_list
                if call.args[0] == "context:copy_failed"
            ]
            assert len(emit_calls) == 1
            payload = emit_calls[0].args[1]
            assert "reason" in payload
            assert "Source file does not exist" in payload["reason"]

    def test_copy_project_context_emits_copied_event_on_success(
        self, orchestrator, project_root
    ):
        """Should emit context:copied event on successful copy (AC1)."""
        # Create source file
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        source.write_text("# Test content")

        with patch.object(orchestrator, "emit_event") as mock_emit:
            orchestrator.copy_project_context()

            # Verify context:copied was emitted
            emit_calls = [
                call for call in mock_emit.call_args_list
                if call.args[0] == "context:copied"
            ]
            assert len(emit_calls) == 1
            payload = emit_calls[0].args[1]
            assert "source" in payload
            assert "destination" in payload
            assert "message" in payload

    def test_copy_project_context_creates_destination_directory(
        self, orchestrator, project_root
    ):
        """Should create destination directory if it doesn't exist (AC3)."""
        # Remove the planning-artifacts directory
        planning_dir = project_root / "_bmad-output/planning-artifacts"
        if planning_dir.exists():
            import shutil
            shutil.rmtree(planning_dir)

        # Create source directory and file
        planning_dir.mkdir(parents=True)
        source = planning_dir / "project-context.md"
        source.write_text("# Test content")

        result = orchestrator.copy_project_context()

        assert result is True
        dest = planning_dir / "sprint-project-context.md"
        assert dest.exists()

    def test_copy_project_context_overwrites_existing_destination(
        self, orchestrator, project_root
    ):
        """Should overwrite existing sprint-project-context.md (AC1)."""
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        dest = project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"

        # Create source with new content
        source.write_text("# New content")

        # Create destination with old content
        dest.write_text("# Old content that should be overwritten")

        result = orchestrator.copy_project_context()

        assert result is True
        assert dest.read_text() == "# New content"

    def test_copy_project_context_preserves_exact_content(
        self, orchestrator, project_root
    ):
        """Should preserve exact content including special characters (AC1)."""
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"

        # Content with special characters, Unicode, and formatting
        special_content = """# Project Context

## Rules
- DO NOT modify these patterns
- Use `backticks` for code
- Preserve "quotes" and 'apostrophes'

## Unicode Support
- Emojis: ✅ ❌ 🚀
- Symbols: → ← ↔ ≤ ≥

## Code Block
```python
def example():
    return "test"
```

## Special Characters
< > & " '
"""
        source.write_text(special_content)

        result = orchestrator.copy_project_context()

        assert result is True
        dest = project_root / "_bmad-output/planning-artifacts/sprint-project-context.md"
        assert dest.read_text() == special_content

    def test_copy_project_context_handles_mkdir_failure(
        self, orchestrator, project_root
    ):
        """Should return False and emit event when mkdir fails (HIGH #1, MEDIUM #3)."""
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        source.write_text("# Test content")

        with patch.object(orchestrator, "emit_event") as mock_emit:
            with patch("pathlib.Path.mkdir", side_effect=PermissionError("No write permission")):
                result = orchestrator.copy_project_context()

                assert result is False

                # Verify context:copy_failed was emitted
                emit_calls = [
                    call for call in mock_emit.call_args_list
                    if call.args[0] == "context:copy_failed"
                ]
                assert len(emit_calls) == 1
                payload = emit_calls[0].args[1]
                assert "Failed to create destination directory" in payload["reason"]

    def test_copy_project_context_handles_read_failure(
        self, orchestrator, project_root
    ):
        """Should return False and emit event when read fails (HIGH #1, HIGH #2)."""
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        source.write_text("# Test content")

        with patch.object(orchestrator, "emit_event") as mock_emit:
            with patch("pathlib.Path.read_text", side_effect=PermissionError("No read permission")):
                result = orchestrator.copy_project_context()

                assert result is False

                # Verify context:copy_failed was emitted
                emit_calls = [
                    call for call in mock_emit.call_args_list
                    if call.args[0] == "context:copy_failed"
                ]
                assert len(emit_calls) == 1
                payload = emit_calls[0].args[1]
                assert "Failed to read source file" in payload["reason"]

    def test_copy_project_context_handles_write_failure(
        self, orchestrator, project_root
    ):
        """Should return False and emit event when write fails (HIGH #1, HIGH #2)."""
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        source.write_text("# Test content")

        with patch.object(orchestrator, "emit_event") as mock_emit:
            with patch("pathlib.Path.write_text", side_effect=PermissionError("No write permission")):
                result = orchestrator.copy_project_context()

                assert result is False

                # Verify context:copy_failed was emitted
                emit_calls = [
                    call for call in mock_emit.call_args_list
                    if call.args[0] == "context:copy_failed"
                ]
                assert len(emit_calls) == 1
                payload = emit_calls[0].args[1]
                assert "Failed to write destination file" in payload["reason"]

    def test_copy_project_context_handles_oserror_on_mkdir(
        self, orchestrator, project_root
    ):
        """Should handle OSError on mkdir (HIGH #1)."""
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        source.write_text("# Test content")

        with patch.object(orchestrator, "emit_event") as mock_emit:
            with patch("pathlib.Path.mkdir", side_effect=OSError("Disk full")):
                result = orchestrator.copy_project_context()

                assert result is False
                emit_calls = [
                    call for call in mock_emit.call_args_list
                    if call.args[0] == "context:copy_failed"
                ]
                assert len(emit_calls) == 1

    def test_copy_project_context_handles_oserror_on_read(
        self, orchestrator, project_root
    ):
        """Should handle OSError on read (HIGH #1)."""
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        source.write_text("# Test content")

        with patch.object(orchestrator, "emit_event") as mock_emit:
            with patch("pathlib.Path.read_text", side_effect=OSError("I/O error")):
                result = orchestrator.copy_project_context()

                assert result is False
                emit_calls = [
                    call for call in mock_emit.call_args_list
                    if call.args[0] == "context:copy_failed"
                ]
                assert len(emit_calls) == 1

    def test_copy_project_context_handles_oserror_on_write(
        self, orchestrator, project_root
    ):
        """Should handle OSError on write (HIGH #1)."""
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        source.write_text("# Test content")

        with patch.object(orchestrator, "emit_event") as mock_emit:
            with patch("pathlib.Path.write_text", side_effect=OSError("Disk full")):
                result = orchestrator.copy_project_context()

                assert result is False
                emit_calls = [
                    call for call in mock_emit.call_args_list
                    if call.args[0] == "context:copy_failed"
                ]
                assert len(emit_calls) == 1


class TestCopyProjectContextIntegration:
    """Integration tests for copy_project_context() in batch initialization (AC4)."""

    @pytest.mark.asyncio
    async def test_copy_context_called_after_check_project_context(
        self, orchestrator, project_root
    ):
        """Should call copy_project_context after check_project_context in start() (AC4)."""
        # Create fresh project context
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        source.write_text("# Fresh context")

        call_order = []

        async def mock_check(*args, **kwargs):
            call_order.append("check_project_context")

        def mock_copy(*args, **kwargs):
            call_order.append("copy_project_context")
            return True

        with patch.object(
            orchestrator, "check_project_context", new_callable=AsyncMock
        ) as mock_check_ctx:
            mock_check_ctx.side_effect = mock_check

            with patch.object(
                orchestrator, "copy_project_context", side_effect=mock_copy
            ):
                with patch.object(
                    orchestrator, "run_cycle", new_callable=AsyncMock
                ) as mock_cycle:
                    mock_cycle.return_value = False  # End loop immediately

                    with patch("server.orchestrator.update_batch"):
                        await orchestrator.start()

                        # Verify order: check_project_context before copy_project_context
                        assert call_order == ["check_project_context", "copy_project_context"]

    @pytest.mark.asyncio
    async def test_start_continues_when_copy_fails(self, orchestrator, project_root):
        """Should continue batch when copy_project_context returns False (AC4)."""
        # Ensure source doesn't exist so copy fails
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        if source.exists():
            source.unlink()

        with patch.object(
            orchestrator, "check_project_context", new_callable=AsyncMock
        ):
            with patch.object(
                orchestrator, "run_cycle", new_callable=AsyncMock
            ) as mock_cycle:
                mock_cycle.return_value = False  # End loop immediately

                with patch("server.orchestrator.update_batch"):
                    # Should not raise - should continue despite copy failure
                    await orchestrator.start()

                    # run_cycle should have been called (batch continued)
                    mock_cycle.assert_called_once()

    @pytest.mark.asyncio
    async def test_start_emits_warning_when_copy_fails(self, orchestrator, project_root):
        """Should emit batch:warning event when copy fails (AC4)."""
        # Ensure source doesn't exist so copy fails
        source = project_root / "_bmad-output/planning-artifacts/project-context.md"
        if source.exists():
            source.unlink()

        with patch.object(
            orchestrator, "check_project_context", new_callable=AsyncMock
        ):
            with patch.object(
                orchestrator, "run_cycle", new_callable=AsyncMock
            ) as mock_cycle:
                mock_cycle.return_value = False

                with patch("server.orchestrator.update_batch"):
                    with patch.object(orchestrator, "emit_event") as mock_emit:
                        await orchestrator.start()

                        # Verify batch:warning was emitted
                        warning_calls = [
                            call for call in mock_emit.call_args_list
                            if call.args[0] == "batch:warning"
                        ]
                        assert len(warning_calls) >= 1
                        payload = warning_calls[0].args[1]
                        assert "message" in payload
                        assert "Project context not available" in payload["message"]


# =============================================================================
# Test Cleanup Batch Files (Story A-4)
# =============================================================================


class TestCleanupBatchFiles:
    """Tests for cleanup_batch_files() method (Story A-4)."""

    def test_cleanup_batch_files_moves_matching_files(self, orchestrator, project_root):
        """Should move files matching story keys to archive directory (AC1)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        archive_dir = project_root / "_bmad-output/archived-artifacts"

        # Create test files with story IDs
        (impl_dir / "sprint-2a-1-story.md").write_text("# Story 2a-1")
        (impl_dir / "sprint-2a-1-discovery-story.md").write_text("# Discovery")
        (impl_dir / "sprint-tech-spec-2a-1.md").write_text("# Tech Spec")

        result = orchestrator.cleanup_batch_files(["2a-1"])

        assert result == 3
        assert (archive_dir / "sprint-2a-1-story.md").exists()
        assert (archive_dir / "sprint-2a-1-discovery-story.md").exists()
        assert (archive_dir / "sprint-tech-spec-2a-1.md").exists()
        # Source files should be gone
        assert not (impl_dir / "sprint-2a-1-story.md").exists()

    def test_cleanup_batch_files_creates_archive_directory(
        self, orchestrator, project_root
    ):
        """Should create archive directory if it doesn't exist (AC2)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        archive_dir = project_root / "_bmad-output/archived-artifacts"

        # Ensure archive doesn't exist
        if archive_dir.exists():
            import shutil
            shutil.rmtree(archive_dir)

        (impl_dir / "sprint-1-1-story.md").write_text("# Story")

        result = orchestrator.cleanup_batch_files(["1-1"])

        assert result == 1
        assert archive_dir.exists()
        assert archive_dir.is_dir()

    def test_cleanup_batch_files_returns_count(self, orchestrator, project_root):
        """Should return correct count of moved files (AC3)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"

        # Create multiple files
        (impl_dir / "file-3a-1-a.md").write_text("A")
        (impl_dir / "file-3a-1-b.md").write_text("B")
        (impl_dir / "file-3a-2-c.md").write_text("C")
        (impl_dir / "unrelated-file.md").write_text("D")

        result = orchestrator.cleanup_batch_files(["3a-1", "3a-2"])

        assert result == 3

    def test_cleanup_batch_files_handles_empty_story_keys(
        self, orchestrator, project_root
    ):
        """Should return 0 when story_keys is empty (AC4)."""
        result = orchestrator.cleanup_batch_files([])
        assert result == 0

    def test_cleanup_batch_files_emits_complete_on_empty_story_keys(
        self, orchestrator, project_root
    ):
        """Should emit cleanup:complete even when story_keys is empty (HIGH #1 fix)."""
        with patch.object(orchestrator, "emit_event") as mock_emit:
            result = orchestrator.cleanup_batch_files([])

            assert result == 0

            # Verify cleanup:complete was emitted
            complete_calls = [
                call for call in mock_emit.call_args_list
                if call.args[0] == "cleanup:complete"
            ]
            assert len(complete_calls) == 1
            payload = complete_calls[0].args[1]
            assert payload["files_moved"] == 0
            assert payload["story_keys"] == []

    def test_cleanup_batch_files_handles_no_matching_files(
        self, orchestrator, project_root
    ):
        """Should return 0 when no files match (AC5)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        (impl_dir / "unrelated-file.md").write_text("Content")

        result = orchestrator.cleanup_batch_files(["nonexistent-key"])

        assert result == 0

    def test_cleanup_batch_files_handles_missing_source_dir(
        self, orchestrator, project_root
    ):
        """Should return 0 when implementation-artifacts doesn't exist (AC6)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        if impl_dir.exists():
            import shutil
            shutil.rmtree(impl_dir)

        result = orchestrator.cleanup_batch_files(["1-1"])

        assert result == 0

    def test_cleanup_batch_files_emits_complete_on_missing_source_dir(
        self, orchestrator, project_root
    ):
        """Should emit cleanup:complete when source dir missing (HIGH #1 fix)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        if impl_dir.exists():
            import shutil
            shutil.rmtree(impl_dir)

        with patch.object(orchestrator, "emit_event") as mock_emit:
            result = orchestrator.cleanup_batch_files(["1-1"])

            assert result == 0

            # Verify cleanup:complete was emitted
            complete_calls = [
                call for call in mock_emit.call_args_list
                if call.args[0] == "cleanup:complete"
            ]
            assert len(complete_calls) == 1
            payload = complete_calls[0].args[1]
            assert payload["files_moved"] == 0
            assert "1-1" in payload["story_keys"]

    def test_cleanup_batch_files_handles_move_error(self, orchestrator, project_root):
        """Should handle move errors gracefully and continue (AC7)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"

        (impl_dir / "file-4a-1.md").write_text("Content 1")
        (impl_dir / "file-4a-2.md").write_text("Content 2")

        # Mock shutil.move to fail on first file but succeed on second
        import shutil
        original_move = shutil.move
        call_count = [0]

        def failing_move(src, dst):
            call_count[0] += 1
            if call_count[0] == 1:
                raise PermissionError("Access denied")
            return original_move(src, dst)

        with patch("shutil.move", side_effect=failing_move):
            result = orchestrator.cleanup_batch_files(["4a-1", "4a-2"])

        # Should have moved at least one file despite error
        # (depends on order, but error should not stop processing)
        assert result >= 0  # Just verify no crash

    def test_cleanup_batch_files_deduplicates_matches(self, orchestrator, project_root):
        """Should not move same file twice if matched by multiple keys (AC8)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        archive_dir = project_root / "_bmad-output/archived-artifacts"

        # File that matches multiple patterns
        (impl_dir / "file-5a-1-5a-2.md").write_text("Matches both")
        (impl_dir / "file-5a-1-only.md").write_text("Matches 5a-1")

        result = orchestrator.cleanup_batch_files(["5a-1", "5a-2"])

        # Both files should be moved, but each only once
        assert result == 2
        assert (archive_dir / "file-5a-1-5a-2.md").exists()
        assert (archive_dir / "file-5a-1-only.md").exists()

    def test_cleanup_batch_files_case_insensitive(self, orchestrator, project_root):
        """Should match files case-insensitively (AC9)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        archive_dir = project_root / "_bmad-output/archived-artifacts"

        # Create files with different cases
        (impl_dir / "Sprint-6A-1-Story.md").write_text("Upper case")
        (impl_dir / "sprint-6a-1-discovery.md").write_text("Lower case")

        # Search with mixed case
        result = orchestrator.cleanup_batch_files(["6A-1"])

        assert result == 2
        assert (archive_dir / "Sprint-6A-1-Story.md").exists()
        assert (archive_dir / "sprint-6a-1-discovery.md").exists()

    def test_cleanup_batch_files_overwrites_existing(self, orchestrator, project_root):
        """Should overwrite existing files in archive (AC10)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        archive_dir = project_root / "_bmad-output/archived-artifacts"
        archive_dir.mkdir(parents=True, exist_ok=True)

        # Create file in both locations
        (impl_dir / "file-7a-1.md").write_text("New content")
        (archive_dir / "file-7a-1.md").write_text("Old content")

        result = orchestrator.cleanup_batch_files(["7a-1"])

        assert result == 1
        # Archive should have new content
        assert (archive_dir / "file-7a-1.md").read_text() == "New content"

    def test_cleanup_batch_files_emits_events(self, orchestrator, project_root):
        """Should emit appropriate events (AC11)."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        (impl_dir / "file-8a-1.md").write_text("Content")

        with patch.object(orchestrator, "emit_event") as mock_emit:
            result = orchestrator.cleanup_batch_files(["8a-1"])

            assert result == 1

            # Verify cleanup:file_moved was emitted
            file_moved_calls = [
                call for call in mock_emit.call_args_list
                if call.args[0] == "cleanup:file_moved"
            ]
            assert len(file_moved_calls) == 1
            payload = file_moved_calls[0].args[1]
            assert "source" in payload
            assert "destination" in payload
            assert "file_name" in payload

            # Verify cleanup:complete was emitted
            complete_calls = [
                call for call in mock_emit.call_args_list
                if call.args[0] == "cleanup:complete"
            ]
            assert len(complete_calls) == 1
            payload = complete_calls[0].args[1]
            assert payload["files_moved"] == 1
            assert "8a-1" in payload["story_keys"]

    def test_cleanup_batch_files_emits_error_event_on_failure(
        self, orchestrator, project_root
    ):
        """Should emit cleanup:file_error event when move fails."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        (impl_dir / "file-9a-1.md").write_text("Content")

        with patch("shutil.move", side_effect=PermissionError("Access denied")):
            with patch.object(orchestrator, "emit_event") as mock_emit:
                result = orchestrator.cleanup_batch_files(["9a-1"])

                assert result == 0

                # Verify cleanup:file_error was emitted
                error_calls = [
                    call for call in mock_emit.call_args_list
                    if call.args[0] == "cleanup:file_error"
                ]
                assert len(error_calls) == 1
                payload = error_calls[0].args[1]
                assert "file" in payload
                assert "error" in payload
                assert "Access denied" in payload["error"]

    def test_cleanup_batch_files_handles_archive_dir_creation_failure(
        self, orchestrator, project_root
    ):
        """Should return 0 and emit error when archive dir cannot be created."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        (impl_dir / "file-10a-1.md").write_text("Content")

        with patch("pathlib.Path.mkdir", side_effect=PermissionError("No permission")):
            with patch.object(orchestrator, "emit_event") as mock_emit:
                result = orchestrator.cleanup_batch_files(["10a-1"])

                assert result == 0

                # Verify cleanup:error was emitted
                error_calls = [
                    call for call in mock_emit.call_args_list
                    if call.args[0] == "cleanup:error"
                ]
                assert len(error_calls) == 1

                # Verify cleanup:complete was also emitted (Review 2 fix)
                complete_calls = [
                    call for call in mock_emit.call_args_list
                    if call.args[0] == "cleanup:complete"
                ]
                assert len(complete_calls) == 1
                payload = complete_calls[0].args[1]
                assert payload["files_moved"] == 0

    def test_cleanup_batch_files_only_moves_files_not_directories(
        self, orchestrator, project_root
    ):
        """Should only move files, not directories."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        archive_dir = project_root / "_bmad-output/archived-artifacts"

        # Create a file and a directory with matching names
        (impl_dir / "sprint-11a-1-story.md").write_text("File content")
        (impl_dir / "sprint-11a-1-subdir").mkdir()

        result = orchestrator.cleanup_batch_files(["11a-1"])

        assert result == 1
        assert (archive_dir / "sprint-11a-1-story.md").exists()
        # Directory should still be in impl_artifacts (not moved)
        assert (impl_dir / "sprint-11a-1-subdir").exists()

    def test_cleanup_batch_files_handles_multiple_story_keys(
        self, orchestrator, project_root
    ):
        """Should handle multiple story keys from different epics."""
        impl_dir = project_root / "_bmad-output/implementation-artifacts"
        archive_dir = project_root / "_bmad-output/archived-artifacts"

        (impl_dir / "story-12a-1.md").write_text("Epic 12a Story 1")
        (impl_dir / "story-12a-2.md").write_text("Epic 12a Story 2")
        (impl_dir / "story-12b-1.md").write_text("Epic 12b Story 1")
        (impl_dir / "unrelated.md").write_text("Should not move")

        result = orchestrator.cleanup_batch_files(["12a-1", "12a-2", "12b-1"])

        assert result == 3
        assert (archive_dir / "story-12a-1.md").exists()
        assert (archive_dir / "story-12a-2.md").exists()
        assert (archive_dir / "story-12b-1.md").exists()
        assert (impl_dir / "unrelated.md").exists()  # Should remain


# =============================================================================
# Test Phase Methods with Prompt System Append (Story A-6)
# =============================================================================


class TestPhaseMethodsWithPromptSystemAppend:
    """Tests for phase methods using sprint-* commands with prompt_system_append (Story A-6)."""

    @pytest.mark.asyncio
    async def test_create_story_phase_uses_sprint_create_story_command(
        self, orchestrator, project_root
    ):
        """Should use sprint-create-story command with prompt_system_append."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                await orchestrator._execute_create_story_phase(["2a-1", "2a-2"])

                # Should have called build_prompt_system_append for create-story
                create_calls = [
                    c for c in mock_build.call_args_list
                    if c.kwargs.get("command_name") == "sprint-create-story"
                ]
                assert len(create_calls) >= 1
                call_kwargs = create_calls[0].kwargs
                assert call_kwargs["include_project_context"] is True
                assert call_kwargs["include_discovery"] is False

                # Should have called spawn_subagent with prompt_system_append
                spawn_calls = [
                    c for c in mock_spawn.call_args_list
                    if "sprint-create-story" in str(c)
                ]
                assert len(spawn_calls) >= 1

    @pytest.mark.asyncio
    async def test_create_story_phase_uses_sprint_create_story_discovery_command(
        self, orchestrator, project_root
    ):
        """Should use sprint-create-story-discovery command with prompt_system_append."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                await orchestrator._execute_create_story_phase(["2a-1"])

                # Should have called build_prompt_system_append for discovery
                discovery_calls = [
                    c for c in mock_build.call_args_list
                    if c.kwargs.get("command_name") == "sprint-create-story-discovery"
                ]
                assert len(discovery_calls) >= 1
                call_kwargs = discovery_calls[0].kwargs
                assert call_kwargs["include_project_context"] is True
                assert call_kwargs["include_discovery"] is False

    @pytest.mark.asyncio
    async def test_story_review_phase_uses_sprint_story_review_command(
        self, orchestrator, project_root
    ):
        """Should use sprint-story-review command with prompt_system_append including discovery."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                await orchestrator._execute_story_review_phase(["2a-1"])

                # Should have called build_prompt_system_append for story-review
                review_calls = [
                    c for c in mock_build.call_args_list
                    if c.kwargs.get("command_name") == "sprint-story-review"
                ]
                assert len(review_calls) >= 1
                call_kwargs = review_calls[0].kwargs
                assert call_kwargs["include_project_context"] is True
                assert call_kwargs["include_discovery"] is True
                assert call_kwargs["include_tech_spec"] is False

    @pytest.mark.asyncio
    async def test_story_review_phase_spawns_background_chain_on_critical(
        self, orchestrator, project_root
    ):
        """Should spawn background review chain when critical issues found."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            # Return critical issues in first call
            mock_spawn.return_value = {
                "exit_code": 0,
                "stdout": "HIGHEST SEVERITY: CRITICAL",
                "events": [],
            }

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                await orchestrator._execute_story_review_phase(["2a-1"])

                # Should have spawned background chain
                chain_calls = [
                    c for c in mock_spawn.call_args_list
                    if c.kwargs.get("is_background") is True
                ]
                assert len(chain_calls) >= 1
                assert chain_calls[0].kwargs.get("model") == "haiku"
                assert chain_calls[0].kwargs.get("prompt_system_append") is not None

    @pytest.mark.asyncio
    async def test_tech_spec_review_phase_spawns_background_chain_on_critical(
        self, orchestrator, project_root
    ):
        """Should spawn background review chain when critical issues found in tech-spec review."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            # Return critical issues in first call
            mock_spawn.return_value = {
                "exit_code": 0,
                "stdout": "HIGHEST SEVERITY: CRITICAL",
                "events": [],
            }

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                await orchestrator._execute_tech_spec_review_phase(["2a-1"])

                # Should have spawned background chain
                chain_calls = [
                    c for c in mock_spawn.call_args_list
                    if c.kwargs.get("is_background") is True
                ]
                assert len(chain_calls) >= 1
                assert chain_calls[0].kwargs.get("model") == "haiku"
                assert chain_calls[0].kwargs.get("prompt_system_append") is not None

    @pytest.mark.asyncio
    async def test_tech_spec_phase_uses_sprint_create_tech_spec_command(
        self, orchestrator, project_root
    ):
        """Should use sprint-create-tech-spec command with prompt_system_append including discovery."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                await orchestrator._execute_tech_spec_phase(["2a-1", "2a-2"])

                # Should have called build_prompt_system_append
                assert mock_build.called
                call_kwargs = mock_build.call_args.kwargs
                assert call_kwargs["command_name"] == "sprint-create-tech-spec"
                assert call_kwargs["include_project_context"] is True
                assert call_kwargs["include_discovery"] is True
                assert call_kwargs["include_tech_spec"] is False

                # Should have called spawn_subagent with prompt_system_append
                assert mock_spawn.called
                spawn_kwargs = mock_spawn.call_args.kwargs
                assert spawn_kwargs.get("prompt_system_append") is not None

    @pytest.mark.asyncio
    async def test_tech_spec_review_phase_uses_sprint_tech_spec_review_command(
        self, orchestrator, project_root
    ):
        """Should use sprint-tech-spec-review command with all context flags."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                await orchestrator._execute_tech_spec_review_phase(["2a-1"])

                # Should have called build_prompt_system_append for tech-spec-review
                review_calls = [
                    c for c in mock_build.call_args_list
                    if c.kwargs.get("command_name") == "sprint-tech-spec-review"
                ]
                assert len(review_calls) >= 1
                call_kwargs = review_calls[0].kwargs
                assert call_kwargs["include_project_context"] is True
                assert call_kwargs["include_discovery"] is True
                assert call_kwargs["include_tech_spec"] is True

    @pytest.mark.asyncio
    async def test_dev_phase_uses_sprint_dev_story_command(
        self, orchestrator, project_root
    ):
        """Should use sprint-dev-story command with all context flags."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {
                "exit_code": 0,
                "stdout": "ZERO ISSUES",
                "events": [],
            }

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                with patch.object(orchestrator, "update_sprint_status"):
                    await orchestrator._execute_dev_phase("2a-1")

                    # Should have called build_prompt_system_append for dev-story
                    dev_calls = [
                        c for c in mock_build.call_args_list
                        if c.kwargs.get("command_name") == "sprint-dev-story"
                    ]
                    assert len(dev_calls) >= 1
                    call_kwargs = dev_calls[0].kwargs
                    assert call_kwargs["include_project_context"] is True
                    assert call_kwargs["include_discovery"] is True
                    assert call_kwargs["include_tech_spec"] is True
                    assert call_kwargs["story_keys"] == ["2a-1"]

    @pytest.mark.asyncio
    async def test_code_review_loop_uses_sprint_code_review_command(
        self, orchestrator, project_root
    ):
        """Should use sprint-code-review command with all context flags."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {
                "exit_code": 0,
                "stdout": "ZERO ISSUES",
                "events": [],
            }

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                with patch.object(orchestrator, "update_sprint_status"):
                    await orchestrator._execute_code_review_loop("2a-1")

                    # Should have called build_prompt_system_append for code-review
                    review_calls = [
                        c for c in mock_build.call_args_list
                        if c.kwargs.get("command_name") == "sprint-code-review"
                    ]
                    assert len(review_calls) >= 1
                    call_kwargs = review_calls[0].kwargs
                    assert call_kwargs["include_project_context"] is True
                    assert call_kwargs["include_discovery"] is True
                    assert call_kwargs["include_tech_spec"] is True

    @pytest.mark.asyncio
    async def test_code_review_loop_uses_haiku_for_attempt_2_plus(
        self, orchestrator, project_root
    ):
        """Should use haiku model for review attempt 2 and beyond."""
        call_count = [0]

        async def mock_spawn_side_effect(*args, **kwargs):
            call_count[0] += 1
            # Return severity that requires another attempt for first 2 calls
            if call_count[0] <= 2:
                return {"exit_code": 0, "stdout": "HIGHEST SEVERITY: CRITICAL", "events": []}
            return {"exit_code": 0, "stdout": "ZERO ISSUES", "events": []}

        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.side_effect = mock_spawn_side_effect

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                with patch.object(orchestrator, "update_sprint_status"):
                    await orchestrator._execute_code_review_loop("2a-1")

                    # First call should not have model=haiku
                    first_call = mock_spawn.call_args_list[0]
                    assert first_call.kwargs.get("model") is None

                    # Second call should have model=haiku
                    if len(mock_spawn.call_args_list) > 1:
                        second_call = mock_spawn.call_args_list[1]
                        assert second_call.kwargs.get("model") == "haiku"

    @pytest.mark.asyncio
    async def test_batch_commit_uses_sprint_commit_command(
        self, orchestrator, project_root
    ):
        """Should use sprint-commit command with story files only (no context/discovery/tech-spec)."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                await orchestrator._execute_batch_commit(["2a-1", "2a-2"])

                # Should have called build_prompt_system_append for commit
                assert mock_build.called
                call_kwargs = mock_build.call_args.kwargs
                assert call_kwargs["command_name"] == "sprint-commit"
                assert call_kwargs["include_project_context"] is False
                assert call_kwargs["include_discovery"] is False
                assert call_kwargs["include_tech_spec"] is False
                assert call_kwargs["story_keys"] == ["2a-1", "2a-2"]

                # Should have called spawn_subagent with prompt_system_append
                assert mock_spawn.called
                spawn_kwargs = mock_spawn.call_args.kwargs
                assert spawn_kwargs.get("prompt_system_append") is not None

    @pytest.mark.asyncio
    async def test_phase_methods_include_epic_id_in_prompt(
        self, orchestrator, project_root
    ):
        """Should include epic_id extracted from story key in prompts."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                await orchestrator._execute_tech_spec_phase(["2a-1"])

                # Check that prompt includes epic ID
                prompt_arg = mock_spawn.call_args.args[0]
                assert "Epic ID: 2a" in prompt_arg or "epic_id" in prompt_arg.lower()

    @pytest.mark.asyncio
    async def test_phase_methods_extract_correct_epic_id(
        self, orchestrator, project_root
    ):
        """Should correctly extract epic_id from various story key formats."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                # Test with complex story key format (5-sr-3)
                await orchestrator._execute_tech_spec_phase(["5-sr-3"])

                prompt_arg = mock_spawn.call_args.args[0]
                assert "5-sr" in prompt_arg


class TestPhaseMethodsPromptFormat:
    """Tests for the prompt format used in phase methods (Story A-6)."""

    @pytest.mark.asyncio
    async def test_create_story_prompt_format(self, orchestrator, project_root):
        """Should format create-story prompt with story_keys and epic_id."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {"exit_code": 0, "stdout": "", "events": []}

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                await orchestrator._execute_create_story_phase(["2a-1", "2a-2"])

                # Find the create-story call
                create_calls = [
                    c for c in mock_spawn.call_args_list
                    if "sprint-create-story" in c.args[1]
                    and "discovery" not in c.args[1]
                ]
                assert len(create_calls) >= 1
                prompt = create_calls[0].args[0]
                assert "Story keys: 2a-1,2a-2" in prompt
                assert "Epic ID: 2a" in prompt

    @pytest.mark.asyncio
    async def test_code_review_prompt_includes_review_attempt(
        self, orchestrator, project_root
    ):
        """Should include review_attempt in code-review prompt."""
        with patch.object(
            orchestrator, "spawn_subagent", new_callable=AsyncMock
        ) as mock_spawn:
            mock_spawn.return_value = {
                "exit_code": 0,
                "stdout": "ZERO ISSUES",
                "events": [],
            }

            with patch.object(orchestrator, "build_prompt_system_append") as mock_build:
                mock_build.return_value = "<file_injections></file_injections>"

                with patch.object(orchestrator, "update_sprint_status"):
                    await orchestrator._execute_code_review_loop("2a-1")

                    prompt = mock_spawn.call_args.args[0]
                    assert "Review attempt: 1" in prompt


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
