"""Unit tests for the structured-telemetry helper in ``src.log``.

These don't touch the database — they just assert the JSON shape emitted to
stdout, since that's the contract the Hatchet worker relies on when surfacing
per-script timing in the dashboard.
"""

from __future__ import annotations

import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.log import script_entry, script_exit  # noqa: E402


def _capture(capsys):
    out = capsys.readouterr().out.strip().splitlines()
    return [json.loads(line) for line in out if line.strip()]


def test_script_entry_shape(capsys):
    started = script_entry(
        script="src.scripts.0_initial_participant_analytics",
        mode="incremental",
        scope_size=3,
        window_since="2026-04-06",
    )
    lines = _capture(capsys)
    assert len(lines) == 1
    entry = lines[0]
    assert entry["phase"] == "entry"
    assert entry["script"] == "src.scripts.0_initial_participant_analytics"
    assert entry["mode"] == "incremental"
    assert entry["scope_size"] == 3
    assert entry["window_since"] == "2026-04-06"
    assert isinstance(started, float)


def test_script_exit_shape_and_elapsed_monotonic(capsys):
    started = script_entry(
        script="src.scripts.1_initial_aggregated_analytics",
        mode="full",
        scope_size=None,
        window_since=None,
    )
    time.sleep(0.01)
    script_exit(
        script="src.scripts.1_initial_aggregated_analytics",
        started=started,
        rows_written=42,
    )
    lines = _capture(capsys)
    assert len(lines) == 2
    exit_line = lines[1]
    assert exit_line["phase"] == "exit"
    assert exit_line["script"] == "src.scripts.1_initial_aggregated_analytics"
    assert exit_line["rows_written"] == 42
    assert isinstance(exit_line["elapsed_s"], float)
    assert exit_line["elapsed_s"] > 0


def test_script_exit_accepts_null_rows_written(capsys):
    started = script_entry(
        script="src.scripts.99_mark_analytics_valid",
        mode="finalize",
        scope_size=1,
        window_since=None,
    )
    script_exit(
        script="src.scripts.99_mark_analytics_valid",
        started=started,
        rows_written=None,
    )
    lines = _capture(capsys)
    assert lines[1]["rows_written"] is None


def test_script_exit_extras_merged(capsys):
    started = script_entry(
        script="src.scripts.8_initial_chat_analytics",
        mode="incremental",
        scope_size=5,
        window_since="2026-04-06",
    )
    script_exit(
        script="src.scripts.8_initial_chat_analytics",
        started=started,
        rows_written=12,
        windows_processed=4,
    )
    lines = _capture(capsys)
    assert lines[1]["windows_processed"] == 4
    assert lines[1]["rows_written"] == 12
