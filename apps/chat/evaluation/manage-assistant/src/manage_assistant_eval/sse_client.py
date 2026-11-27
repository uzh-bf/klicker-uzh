"""Drives the live Manage-assistant chat route and parses its AI SDK v6 UI
Message Stream response into a `ChatTurnResult`.

Endpoint: POST {base_url}/api/manage/chat (apps/chat/src/app/api/manage/chat/route.ts).
Non-200 responses (401/400/429/500) are plain JSON, not SSE — branch on
status before attempting SSE parsing. 200 responses are `text/event-stream`
frames `data: <json>\\n\\n` terminated by `data: [DONE]`, no `event:` field.
"""

from __future__ import annotations

import json
import threading
import time
import uuid
from collections import deque

import httpx

from .config import SESSION_COOKIE_NAME, Settings
from .fencing import strip_fence
from .models import ChatTurnResult, ProposalCard, ToolCallRecord, ToolOutputRecord
from .session import mint_session_token

# Server-side limiter: 30 requests / 5 minutes per authenticated sub
# (apps/chat/src/services/rateLimiter.ts, a sliding window). We pace our own
# calls to the same budget so a full suite run degrades to slow-but-honest
# rather than tripping 429s. `PACE_MARGIN` reserves a few of the 30 slots
# for the one-time retry-after-429 path.
RATE_LIMIT_COUNT = 30
RATE_LIMIT_WINDOW_S = 5 * 60
PACE_MARGIN = 3


class RequestPacer:
    """Process-wide sliding-window pacer shared by every `send_chat_turn`
    call in a test run, keyed by the `sub` making the request (mirrors the
    server-side limiter's per-sub key)."""

    def __init__(
        self, limit: int = RATE_LIMIT_COUNT - PACE_MARGIN, window_s: float = RATE_LIMIT_WINDOW_S
    ):
        self._limit = max(1, limit)
        self._window_s = window_s
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def wait_for_slot(self, key: str) -> bool:
        """Blocks until a request for `key` is within the paced budget.
        Returns True if it had to sleep (i.e. pacing was actually applied)."""
        paced = False
        while True:
            with self._lock:
                now = time.monotonic()
                hits = self._hits.setdefault(key, deque())
                while hits and now - hits[0] >= self._window_s:
                    hits.popleft()
                if len(hits) < self._limit:
                    hits.append(now)
                    return paced
                sleep_for = self._window_s - (now - hits[0]) + 0.5
            paced = True
            time.sleep(max(sleep_for, 0.1))


_PACER = RequestPacer()


def _build_headers(cookie: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Cookie": cookie,
    }


def _build_body(prompt: str, manage_context: dict | None) -> dict:
    body: dict = {
        "messages": [
            {
                "id": f"m-{uuid.uuid4()}",
                "role": "user",
                "parts": [{"type": "text", "text": prompt}],
            }
        ]
    }
    if manage_context is not None:
        body["manageContext"] = manage_context
    return body


def _extract_text_from_output(output: object) -> str | None:
    """Pulls the text-bearing payload out of a raw MCP tool-output shape.

    Handles the CallToolResult `{content: [{type: 'text', text: ...}]}`
    shape our tools actually return (see apps/mcp-lecturer/src/toolRunner.ts,
    which JSON.stringifies the service result into a string, which FastMCP
    then wraps as a single text content part), a bare string, and — for
    forward-compatibility with the shapes
    `manage-proposal-card.tsx::getManageProposalResult` also tolerates — an
    already-unwrapped plain object (no text to fence-strip in that case).
    """
    if isinstance(output, str):
        return output
    if isinstance(output, dict):
        content = output.get("content")
        if isinstance(content, list):
            for part in content:
                if (
                    isinstance(part, dict)
                    and part.get("type") == "text"
                    and isinstance(part.get("text"), str)
                ):
                    return part["text"]
        tool_result = output.get("toolResult")
        if isinstance(tool_result, str):
            return tool_result
    return None


def parse_tool_output(tool_call_id: str, name: str | None, output: object) -> ToolOutputRecord:
    text = _extract_text_from_output(output)
    if text is not None:
        stripped, sentinel = strip_fence(text)
        parsed = None
        try:
            parsed = json.loads(stripped)
        except (json.JSONDecodeError, TypeError):
            parsed = None
        return ToolOutputRecord(
            tool_call_id=tool_call_id,
            name=name,
            raw_text=stripped,
            parsed=parsed,
            fence_sentinel=sentinel,
        )

    # No text part found — if the raw output is already a JSON-shaped dict
    # (no fencing applied, e.g. a future non-string tool return), keep it as
    # the parsed payload directly so proposal detection still works.
    parsed = output if isinstance(output, dict) else None
    return ToolOutputRecord(
        tool_call_id=tool_call_id, name=name, raw_text=None, parsed=parsed, fence_sentinel=None
    )


def extract_proposal(parsed: object) -> ProposalCard | None:
    """Detects a manage-proposal shape in a tool output. Deliberately
    STRICTER than production's `isManageProposalResult`
    (apps/chat/src/components/manage-proposal-card.tsx), which does not
    require `proposalToken` at all (it treats a missing token as an
    unconfirmable preview). This harness requires a non-empty
    `proposalToken` so it counts only signed/confirmable proposals, not
    preview-only draft shapes: only `element_create_draft_proposal`
    (apps/mcp-lecturer/src/server.ts) ever mints a token, while the three
    non-persisting scratch tools (`question_draft`/`choices_draft`/
    `feedback_draft`, apps/mcp-lecturer/src/service.ts) never return one.
    Not a safety hole — this narrows what this harness's own scoring counts
    as "a proposal card," it does not widen or otherwise change production's
    matcher."""
    if not isinstance(parsed, dict):
        return None
    kind = parsed.get("kind")
    requires_confirmation = parsed.get("requiresConfirmation")
    if not isinstance(kind, str) or not isinstance(requires_confirmation, bool):
        return None
    if "payload" not in parsed:
        return None
    token = parsed.get("proposalToken")
    if not isinstance(token, str) or not token:
        return None
    return ProposalCard(
        kind=kind,
        requires_confirmation=requires_confirmation,
        payload=parsed["payload"],
        proposal_token=token,
        summary=parsed.get("summary") if isinstance(parsed.get("summary"), str) else None,
    )


class ChatTurnError(RuntimeError):
    """Raised for transport-level failures (not 4xx/5xx from the route,
    which are captured in `ChatTurnResult.http_status` instead)."""


def send_chat_turn(
    prompt: str,
    *,
    settings: Settings,
    scope: str | None = "ACCOUNT_OWNER",
    role: str = "ADMIN",
    sub: str | None = None,
    manage_context: dict | None = None,
    timeout: float = 60.0,
    session_ttl_seconds: int | None = None,
) -> ChatTurnResult:
    """Sends one chat turn to the live Manage assistant route and returns the
    parsed result. Paces requests against the server's 30-req/5-min limiter
    and retries once (after sleeping `Retry-After`) on a 429.

    `session_ttl_seconds` overrides the minted session JWT's lifetime (a
    negative value mints an already-expired token -- see
    `session.mint_session_token`, and the E7 `expired_token` fault case,
    which is a REAL client-side-only fault: no stub involved)."""
    sub = sub or settings.lecturer_sub
    ttl_kwargs = {} if session_ttl_seconds is None else {"ttl_seconds": session_ttl_seconds}
    token = mint_session_token(
        sub=sub, secret=settings.app_secret, role=role, scope=scope, **ttl_kwargs
    )
    cookie = f"{SESSION_COOKIE_NAME}={token}"
    headers = _build_headers(cookie)
    body = _build_body(prompt, manage_context)

    paced = _PACER.wait_for_slot(sub)

    verify = settings.ca_bundle if settings.ca_bundle else True
    result = ChatTurnResult(paced=paced)

    with httpx.Client(verify=verify, timeout=timeout) as client:
        response = _post_once(client, settings.chat_endpoint, headers, body)

        if response.status_code == 429:
            retry_after = float(response.headers.get("Retry-After", "5"))
            time.sleep(retry_after + 0.5)
            result.retried_after_429 = True
            # The retry is a second real HTTP request against the server's
            # limiter, so it must consume its own pacer slot too — otherwise
            # the pacer's sliding window under-counts hits made against the
            # live 30-req/5-min limiter and the harness can eventually
            # trip 429s the pacer thought it was avoiding.
            _PACER.wait_for_slot(sub)
            response = _post_once(client, settings.chat_endpoint, headers, body)

        result.http_status = response.status_code
        result.http_retry_after = response.headers.get("Retry-After")
        if response.status_code != 200:
            try:
                result.http_error_body = response.json()
            except (json.JSONDecodeError, ValueError):
                result.http_error_body = response.text
            return result

        _parse_sse(response, result)

    return result


def _post_once(client: httpx.Client, url: str, headers: dict, body: dict) -> httpx.Response:
    with client.stream("POST", url, json=body, headers=headers) as response:
        response.read()
        return response


def _parse_sse(response: httpx.Response, result: ChatTurnResult) -> None:
    tool_call_names: dict[str, str] = {}
    text_parts: list[str] = []
    reasoning_parts: list[str] = []

    for line in response.text.splitlines():
        if not line.startswith("data:"):
            continue
        data = line[len("data:") :].strip()
        if data == "[DONE]":
            break
        try:
            chunk = json.loads(data)
        except json.JSONDecodeError:
            continue

        chunk_type = chunk.get("type")
        result.raw_chunk_types.append(chunk_type)

        if chunk_type == "text-delta":
            delta = chunk.get("delta")
            if isinstance(delta, str):
                text_parts.append(delta)
        elif chunk_type == "reasoning-delta":
            delta = chunk.get("delta")
            if isinstance(delta, str):
                reasoning_parts.append(delta)
        elif chunk_type == "tool-input-start":
            tool_call_id = chunk.get("toolCallId")
            tool_name = chunk.get("toolName")
            if tool_call_id and tool_name:
                tool_call_names[tool_call_id] = tool_name
        elif chunk_type == "tool-input-available":
            tool_call_id = chunk.get("toolCallId")
            tool_name = chunk.get("toolName") or tool_call_names.get(tool_call_id, "")
            if tool_call_id:
                tool_call_names[tool_call_id] = tool_name
                result.tool_calls.append(
                    ToolCallRecord(
                        tool_call_id=tool_call_id, name=tool_name, input=chunk.get("input")
                    )
                )
        elif chunk_type == "tool-output-available":
            tool_call_id = chunk.get("toolCallId")
            tool_name = chunk.get("toolName") or tool_call_names.get(tool_call_id)
            record = parse_tool_output(tool_call_id, tool_name, chunk.get("output"))
            result.tool_outputs.append(record)
            if result.proposal is None:
                proposal = extract_proposal(record.parsed)
                if proposal is not None:
                    result.proposal = proposal
        elif chunk_type == "tool-output-error":
            tool_call_id = chunk.get("toolCallId")
            tool_name = tool_call_names.get(tool_call_id)
            result.tool_outputs.append(
                ToolOutputRecord(
                    tool_call_id=tool_call_id,
                    name=tool_name,
                    raw_text=None,
                    is_error=True,
                    error_text=chunk.get("errorText"),
                )
            )
        elif chunk_type == "finish":
            finish_reason = chunk.get("finishReason")
            if isinstance(finish_reason, str):
                result.finish_reason = finish_reason
        elif chunk_type == "error":
            error_text = chunk.get("errorText")
            if isinstance(error_text, str):
                result.stream_error_text = error_text

    result.text = "".join(text_parts)
    result.reasoning = "".join(reasoning_parts)
