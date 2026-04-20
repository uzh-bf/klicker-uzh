"""Reusable `ToolAnnotations` presets for the three behaviour classes we ship.

Centralising the shapes prevents the 38 decoration sites from drifting on the
repeated hint fields. `openWorldHint` is `False` for everything — we only touch
the KlickerUZH backend.
"""

from __future__ import annotations

from mcp.types import ToolAnnotations

READ_ONLY: ToolAnnotations = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
)
"""Read tool: no mutation, repeated calls return equivalent data."""

IDEMPOTENT_WRITE: ToolAnnotations = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=False,
)
"""Toggle / rating / flag: repeated calls converge on the same server state."""

CUMULATIVE_WRITE: ToolAnnotations = ToolAnnotations(
    readOnlyHint=False,
    destructiveHint=False,
    idempotentHint=False,
    openWorldHint=False,
)
"""Each call produces a new row (response submission, Q&A post, confusion
signal, question creation)."""

__all__ = ["CUMULATIVE_WRITE", "IDEMPOTENT_WRITE", "READ_ONLY"]
