"""Structured telemetry for analytics pipeline scripts.

Each script emits a single-line JSON dict at ``entry`` and ``exit`` to stdout.
The native Hatchet Python worker forwards those lines through its process
logs, so they remain available without a separate telemetry dependency.

Shape::

    {"phase": "entry", "script": "...", "mode": "...", "scope_size": ..., "window_since": ...}
    {"phase": "exit",  "script": "...", "elapsed_s": ..., "rows_written": ..., ...}

``rows_written`` is nullable — analytics scripts that don't call
``bulk_upsert`` (e.g. clustering that writes via SQL DDL, or the ``s99``
validity-marker script) pass ``None`` and that stays intentional rather than
fabricating a fake count.
"""

import json
import time
from typing import Any


def script_entry(
    *,
    script: str,
    mode: str,
    scope_size: int | None,
    window_since: str | None,
) -> float:
    """Emit an entry log line and return a ``perf_counter`` start timestamp.

    Pair the returned value back into ``script_exit(..., started=...)``.
    """
    print(
        json.dumps(
            {
                "phase": "entry",
                "script": script,
                "mode": mode,
                "scope_size": scope_size,
                "window_since": window_since,
            }
        ),
        flush=True,
    )
    return time.perf_counter()


def script_exit(
    *,
    script: str,
    started: float,
    rows_written: int | None = None,
    **extras: Any,
) -> None:
    """Emit an exit log line with ``elapsed_s`` computed from ``started``.

    ``extras`` lets callers attach script-specific context (e.g. window
    counts) without modifying this helper — the extras land at the top level
    of the JSON dict next to ``elapsed_s`` and ``rows_written``.
    """
    print(
        json.dumps(
            {
                "phase": "exit",
                "script": script,
                "elapsed_s": round(time.perf_counter() - started, 3),
                "rows_written": rows_written,
                **extras,
            }
        ),
        flush=True,
    )
