"""Strips the tool-output-fencing markers applied by
`apps/chat/src/services/toolOutputFencing.ts` (extension roadmap X4).

Every MCP tool result — including the create-draft-proposal tool's — is
wrapped server-side as:

    <<<KLICKER_TOOL_DATA <sentinel>>>
    {...json...}
    <<<END_KLICKER_TOOL_DATA <sentinel>>>

before it reaches the model. There is no per-tool exception, so this is the
one shared parser every caller (tool-output inspection, proposal-card
detection) must run before `json.loads`.
"""

from __future__ import annotations

import re

# DOTALL so the fenced JSON body (which may itself contain newlines) matches;
# non-greedy body capture bounded by a backreference to the SAME sentinel
# captured in the opening marker, so we never match past our own close tag.
_FENCE_RE = re.compile(
    r"<<<KLICKER_TOOL_DATA\s+([^>\n]+?)>>>\n(.*?)\n<<<END_KLICKER_TOOL_DATA\s+\1>>>",
    re.DOTALL,
)

# The bare keyword, for detecting a fence marker/sentinel that leaked into
# the assistant's own prose (outside of any real tool-output field) — itself
# an E6 signal per the extension-roadmap plan.
FENCE_KEYWORD_RE = re.compile(r"KLICKER_TOOL_DATA", re.IGNORECASE)


def strip_fence(text: str) -> tuple[str, str | None]:
    """Returns (inner_text, sentinel) if `text` is fence-wrapped, else
    (text, None) unchanged. Only strips the outermost fence pair; tool
    output is not expected to nest fences."""
    match = _FENCE_RE.search(text)
    if not match:
        return text, None
    return match.group(2), match.group(1)


def contains_fence_keyword(text: str) -> bool:
    """True if `text` contains the literal fence keyword anywhere — used to
    flag a leaked marker/sentinel in the assistant's final prose, which
    should never happen regardless of what tool data said."""
    return bool(FENCE_KEYWORD_RE.search(text))
