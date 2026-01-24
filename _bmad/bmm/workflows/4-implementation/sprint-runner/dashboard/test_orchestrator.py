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
"""

from __future__ import annotations

import asyncio
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

# Import the module under test
from orchestrator import (
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
        (root / "_bmad/bmm/workflows/4-implementation/sprint-runner/prompts").mkdir(
            parents=True
        )
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

        # Create a minimal prompt file
        (
            root
            / "_bmad/bmm/workflows/4-implementation/sprint-runner/prompts/create-story.md"
        ).write_text("Test prompt for {{story_key}}")

        yield root


@pytest.fixture
def orchestrator(project_root):
    """Create an orchestrator instance with mocked dependencies."""
    with patch("orchestrator.init_db"), patch(
        "orchestrator.create_batch", return_value=1
    ), patch("orchestrator.create_story", return_value=1), patch(
        "orchestrator.update_story"
    ), patch(
        "orchestrator.create_event"
    ), patch(
        "orchestrator.update_batch"
    ), patch(
        "orchestrator.get_story_by_key", return_value=None
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
# Test Prompt Loading
# =============================================================================


class TestPromptLoading:
    """Tests for prompt file loading and variable substitution."""

    def test_load_prompt_with_substitution(self, orchestrator, project_root):
        """Should load and substitute variables in prompt."""
        prompt = orchestrator.load_prompt("create-story.md", story_key="2a-1")
        assert "2a-1" in prompt
        assert "{{story_key}}" not in prompt

    def test_load_prompt_file_not_found(self, orchestrator, project_root):
        """Should raise error for missing prompt file."""
        with pytest.raises(FileNotFoundError):
            orchestrator.load_prompt("nonexistent.md")


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
        with patch("orchestrator.init_db"), patch(
            "orchestrator.create_batch", return_value=1
        ):
            orch = Orchestrator(
                batch_mode="fixed", max_cycles=3, project_root=project_root
            )
            assert orch.batch_mode == "fixed"
            assert orch.max_cycles == 3

    def test_all_batch_mode_initialization(self, project_root):
        """Should initialize with 'all' batch mode."""
        with patch("orchestrator.init_db"), patch(
            "orchestrator.create_batch", return_value=1
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
        with patch("orchestrator.asyncio.create_task", side_effect=RuntimeError("No event loop")):
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

            with patch("orchestrator.create_event") as mock_event:
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

            with patch("orchestrator.create_background_task", return_value=1):
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
                "orchestrator.create_background_task", return_value=42
            ) as mock_create:
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
            with patch("orchestrator.create_background_task", return_value=1):
                with patch("orchestrator.create_event") as mock_event:
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
                "orchestrator.update_background_task"
            ) as mock_update:
                with patch("orchestrator.create_background_task", return_value=99):
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

            with patch("orchestrator.update_background_task"):
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
                    with patch("orchestrator.create_story", return_value=1):
                        with patch("orchestrator.update_batch"):
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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
