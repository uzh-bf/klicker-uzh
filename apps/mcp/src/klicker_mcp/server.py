"""FastMCP server factory for KlickerUZH.

Iteration 1 exposes only a placeholder `whoami` tool. Real identity resolution, the
GraphQL client, and the lecturer/participant tools land in subsequent iterations —
see `PLAN.md`.
"""

from __future__ import annotations

from fastmcp import FastMCP

mcp: FastMCP = FastMCP(name="klicker-uzh-mcp")


@mcp.tool
def whoami() -> dict[str, object]:
    """Return identity information for the current request.

    Placeholder: auth pass-through lands in iteration 2.
    """
    return {
        "authenticated": False,
        "iteration": 1,
        "note": "Auth plumbing is wired in iteration 2; this is a placeholder.",
    }
