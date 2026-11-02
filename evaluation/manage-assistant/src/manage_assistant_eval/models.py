"""Typed result shapes produced by `sse_client.send_chat_turn`."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolCallRecord:
    tool_call_id: str
    name: str
    input: Any = None


@dataclass
class ToolOutputRecord:
    tool_call_id: str
    name: str | None
    # Fence-stripped text, if the output carried a text-bearing part.
    raw_text: str | None
    # json.loads(raw_text) if that parsed as JSON, else None.
    parsed: Any = None
    fence_sentinel: str | None = None
    is_error: bool = False
    error_text: str | None = None


@dataclass
class ProposalCard:
    """Mirrors `ManageProposalResult`
    (apps/chat/src/components/manage-proposal-card.tsx)."""

    kind: str
    requires_confirmation: bool
    payload: Any
    proposal_token: str | None = None
    summary: str | None = None


@dataclass
class ChatTurnResult:
    text: str = ""
    reasoning: str = ""
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    tool_outputs: list[ToolOutputRecord] = field(default_factory=list)
    proposal: ProposalCard | None = None
    finish_reason: str | None = None
    raw_chunk_types: list[str] = field(default_factory=list)
    http_status: int = 0
    # Non-SSE (plain JSON) error body for non-200 responses.
    http_error_body: Any = None
    # Public Retry-After response header, retained for the route-level 429
    # degradation contract.
    http_retry_after: str | None = None
    # Mid-stream `{"type":"error","errorText":...}` frame, if any.
    stream_error_text: str | None = None
    paced: bool = False
    retried_after_429: bool = False

    @property
    def tool_names_called(self) -> list[str]:
        return [call.name for call in self.tool_calls]

    @property
    def leaked_fence_marker_in_text(self) -> bool:
        from .fencing import contains_fence_keyword

        return contains_fence_keyword(self.text)
