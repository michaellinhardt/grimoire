#!/usr/bin/env python3
"""
Configurable settings for Sprint Runner.

Settings are persisted to JSON file and loaded on startup.
API endpoints allow runtime modification.
"""

from __future__ import annotations
import json
import logging
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Optional

# Settings file location (same directory as this module)
SETTINGS_FILE = Path(__file__).parent / "settings.json"

logger = logging.getLogger(__name__)


@dataclass
class Settings:
    """All configurable sprint-runner settings."""

    # From orchestrator.py
    project_context_max_age_hours: int = 24
    injection_warning_kb: int = 100
    injection_error_kb: int = 150
    default_max_cycles: int = 2
    max_code_review_attempts: int = 10
    haiku_after_review: int = 2

    # From server.py
    server_port: int = 8080
    websocket_heartbeat_seconds: int = 30
    default_batch_list_limit: int = 20

    def to_dict(self) -> dict[str, Any]:
        """Convert settings to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Settings":
        """Create Settings from dictionary, ignoring unknown keys."""
        known_fields = {f.name for f in cls.__dataclass_fields__.values()}
        filtered = {k: v for k, v in data.items() if k in known_fields}
        return cls(**filtered)


# Module-level settings instance (singleton pattern)
_settings: Optional[Settings] = None


def _load_settings() -> Settings:
    """Load settings from file or return defaults."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, 'r') as f:
                data = json.load(f)
            return Settings.from_dict(data)
        except json.JSONDecodeError as e:
            logger.warning(
                f"Corrupt settings.json detected: {e}. Using defaults. "
                f"Consider removing or fixing: {SETTINGS_FILE}"
            )
        except OSError as e:
            logger.warning(f"Could not read settings.json: {e}. Using defaults.")
    return Settings()


def _save_settings(settings: Settings) -> None:
    """Persist settings to file."""
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings.to_dict(), f, indent=2)


def get_settings() -> Settings:
    """Get current settings (lazy initialization)."""
    global _settings
    if _settings is None:
        _settings = _load_settings()
    return _settings


def _validate_setting(key: str, value: Any) -> None:
    """Validate setting value type and range."""
    # Type validation
    int_fields = {
        'project_context_max_age_hours', 'injection_warning_kb', 'injection_error_kb',
        'default_max_cycles', 'max_code_review_attempts', 'haiku_after_review',
        'server_port', 'websocket_heartbeat_seconds', 'default_batch_list_limit'
    }

    if key in int_fields:
        if not isinstance(value, int):
            raise ValueError(f"Setting '{key}' must be an integer, got {type(value).__name__}")

        # Range validation
        if value < 0:
            raise ValueError(f"Setting '{key}' must be non-negative, got {value}")

        # Specific range checks
        if key == 'server_port' and not (1 <= value <= 65535):
            raise ValueError(f"Setting 'server_port' must be 1-65535, got {value}")
        if key == 'injection_warning_kb' and value < 1:
            raise ValueError(f"Setting 'injection_warning_kb' must be at least 1")
        if key == 'injection_error_kb' and value < 1:
            raise ValueError(f"Setting 'injection_error_kb' must be at least 1")


def update_settings(**kwargs: Any) -> Settings:
    """Update specific settings and persist."""
    global _settings
    current = get_settings()

    for key, value in kwargs.items():
        if not hasattr(current, key):
            raise ValueError(f"Unknown setting: {key}")
        _validate_setting(key, value)
        setattr(current, key, value)

    _save_settings(current)
    return current


def reset_settings() -> Settings:
    """Reset all settings to defaults."""
    global _settings
    _settings = Settings()
    _save_settings(_settings)
    return _settings
