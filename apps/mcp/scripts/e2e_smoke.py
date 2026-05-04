"""End-to-end smoke test for the KlickerUZH MCP server.

Exercises `fastmcp.Client` -> HTTP transport -> running MCP server ->
backend GraphQL -> seeded Prisma DB. Every in-process unit test mocks the
backend at the GraphQL boundary, so none covers the wiring this script
validates: OAuth / pass-through auth header flow, Traefik routing, persisted
ops, and the newly-added analytics tools.

Run from `apps/mcp/`:

    uv run python scripts/e2e_smoke.py

Env overrides:
    MCP_SMOKE_URL   override the default https://mcp.klicker.com/mcp
    APP_SECRET      HS256 secret; must match the backend (default "abcd")

Exits 0 on all-green, nonzero on any failure. Prints one line per check with
[PASS] / [FAIL] / [SKIP] and a final summary.
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
import traceback
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import httpx
import jwt
from fastmcp import Client

# Seeded IDs — mirrors packages/prisma-data/src/data/constants.ts + seedTEST.ts.
# Kept inline because this script is run from a Python venv and the TS source
# is not importable.
PARTICIPANT_ID_0 = "6f45065c-667f-4259-818c-c6f6b477eb48"  # testuser1
USER_ID_TEST = "76047345-3801-4628-ae7b-adbebcfe8821"  # lecturer
COURSE_ID_TEST = "7c12e44e-d083-4acf-845e-4c34aaff6b49"  # Testkurs

DEFAULT_URL = "https://mcp.klicker.com/mcp"
FALLBACK_URL = "http://localhost:7079/mcp"
EXPECTED_TOOL_COUNT = 38


def mint_jwt(
    *,
    sub: str,
    role: str,
    secret: str,
    extra: dict[str, Any] | None = None,
    ttl_seconds: int = 3600,
) -> str:
    now = int(time.time())
    claims: dict[str, Any] = {"sub": sub, "role": role, "iat": now, "exp": now + ttl_seconds}
    if extra:
        claims.update(extra)
    return jwt.encode(claims, secret, algorithm="HS256")


@dataclass
class SmokeReport:
    passes: list[str] = field(default_factory=list)
    failures: list[tuple[str, str]] = field(default_factory=list)
    skips: list[tuple[str, str]] = field(default_factory=list)

    def record_pass(self, name: str, detail: str = "") -> None:
        self.passes.append(name)
        suffix = f" — {detail}" if detail else ""
        print(f"[PASS] {name}{suffix}")

    def record_fail(self, name: str, reason: str) -> None:
        self.failures.append((name, reason))
        print(f"[FAIL] {name} — {reason}")

    def record_skip(self, name: str, reason: str) -> None:
        self.skips.append((name, reason))
        print(f"[SKIP] {name} — {reason}")


async def run_check(
    report: SmokeReport,
    name: str,
    fn: Callable[[], Awaitable[str]],
) -> Any:
    """Run `fn()` and report PASS with its returned detail, FAIL on exception."""
    try:
        detail = await fn()
    except AssertionError as err:
        report.record_fail(name, f"assertion: {err}")
        return None
    except Exception as err:
        report.record_fail(name, f"{type(err).__name__}: {err}")
        traceback.print_exc()
        return None
    report.record_pass(name, detail)
    return detail


def tool_data(result: Any) -> Any:
    """Extract structured data from a FastMCP CallToolResult."""
    data = getattr(result, "data", None)
    if data is not None:
        return data
    structured = getattr(result, "structured_content", None)
    if isinstance(structured, dict) and "result" in structured:
        return structured["result"]
    return structured


async def probe_health(url: str) -> tuple[str, httpx.Response]:
    """GET /health on the MCP origin. Returns (resolved_base_url, response).

    If the default URL fails to connect (Traefik down, TLS issues), falls
    back to http://localhost:7079/mcp and prints a warning.
    """
    base = url.rsplit("/mcp", 1)[0] if url.endswith("/mcp") else url
    health_url = f"{base}/health"
    async with httpx.AsyncClient(verify=False, timeout=5.0) as client:
        try:
            resp = await client.get(health_url)
            return url, resp
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadError) as err:
            if url == DEFAULT_URL:
                print(f"[WARN] {health_url} unreachable ({type(err).__name__}: {err}); falling back to {FALLBACK_URL}")
                fb_base = FALLBACK_URL.rsplit("/mcp", 1)[0]
                resp = await client.get(f"{fb_base}/health")
                return FALLBACK_URL, resp
            raise


async def smoke() -> int:
    url = os.environ.get("MCP_SMOKE_URL", DEFAULT_URL)
    secret = os.environ.get("APP_SECRET", "abcd")
    # Local dev uses mkcert-signed certs; disable verification when targeting
    # an https://*.klicker.com host so the script works out of the box.
    verify_tls = not url.startswith("https://") or "klicker.com" not in url

    report = SmokeReport()

    # --- Check 1: /health ----------------------------------------------------
    try:
        url, health_resp = await probe_health(url)
    except Exception as err:
        report.record_fail("01 GET /health", f"{type(err).__name__}: {err}")
        return _finish(report)

    async def check_health() -> str:
        assert health_resp.status_code == 200, f"HTTP {health_resp.status_code}"
        body = health_resp.json()
        assert body.get("status") == "ok", f"body={body!r}"
        return f"status=ok version={body.get('version')}"

    await run_check(report, "01 GET /health", check_health)

    print(f"[INFO] using MCP url: {url}")

    participant_jwt = mint_jwt(sub=PARTICIPANT_ID_0, role="PARTICIPANT", secret=secret)
    lecturer_jwt = mint_jwt(
        sub=USER_ID_TEST,
        role="USER",
        secret=secret,
        extra={
            "email": "lecturer@df.uzh.ch",
            "catalystInstitutional": True,
            "catalystIndividual": True,
        },
    )

    # --- Participant-scoped session -----------------------------------------
    async with Client(url, auth=participant_jwt, verify=verify_tls) as p_client:
        # Check 2
        async def check_list_tools() -> str:
            tools = await p_client.list_tools()
            assert len(tools) >= EXPECTED_TOOL_COUNT, f"got {len(tools)} tools, expected >= {EXPECTED_TOOL_COUNT}"
            return f"{len(tools)} tools"

        await run_check(report, "02 list_tools (participant)", check_list_tools)

        # Check 3
        async def check_whoami() -> str:
            res = await p_client.call_tool("whoami", {})
            data = tool_data(res) or {}
            assert data.get("authenticated") is True, f"not authenticated: {data!r}"
            self_ = data.get("self") or {}
            assert self_.get("id") == PARTICIPANT_ID_0, f"wrong sub: {self_!r}"
            return f"role={self_.get('role')} id={self_.get('id')}"

        await run_check(report, "03 whoami (participant)", check_whoami)

        # Check 4
        async def check_courses() -> str:
            res = await p_client.call_tool("list_my_courses", {})
            courses = tool_data(res) or []
            assert isinstance(courses, list), f"not a list: {type(courses).__name__}"
            ids = [c.get("id") for c in courses if isinstance(c, dict)]
            assert COURSE_ID_TEST in ids, f"Testkurs ({COURSE_ID_TEST}) not in {ids!r}"
            return f"{len(courses)} courses"

        await run_check(report, "04 list_my_courses includes Testkurs", check_courses)

        # Check 5
        first_pq_id: str | None = None

        async def check_practice_quizzes() -> str:
            nonlocal first_pq_id
            res = await p_client.call_tool("list_practice_quizzes", {})
            groups = tool_data(res) or []
            assert isinstance(groups, list), f"not a list: {type(groups).__name__}"
            # Shape: [{id, displayName, practiceQuizzes: [{id, displayName}]}]
            for group in groups:
                if not isinstance(group, dict):
                    continue
                for quiz in group.get("practiceQuizzes") or []:
                    qid = quiz.get("id") if isinstance(quiz, dict) else None
                    if qid:
                        first_pq_id = qid
                        break
                if first_pq_id:
                    break
            return f"{len(groups)} course groups, first_pq_id={first_pq_id}"

        await run_check(report, "05 list_practice_quizzes", check_practice_quizzes)

        # Checks 6, 7, 8, 11 depend on first_pq_id. If none, skip with a note.
        first_stack_id: int | None = None

        if first_pq_id is None:
            msg = "no practice quiz available in seed"
            report.record_skip("06 get_practice_quiz(first-PQ)", msg)
            report.record_skip("07 bookmark_stack ON", msg)
            report.record_skip("08 bookmark_stack OFF", msg)
            report.record_skip("11 get_my_srs_state(first-PQ)", msg)
        else:
            # Check 6
            async def check_practice_quiz() -> str:
                nonlocal first_stack_id
                res = await p_client.call_tool("get_practice_quiz", {"id": first_pq_id})
                pq = tool_data(res) or {}
                stacks = pq.get("stacks") or []
                assert len(stacks) >= 1, f"no stacks on pq {first_pq_id}: {pq!r}"
                first_stack = stacks[0] if isinstance(stacks[0], dict) else {}
                sid = first_stack.get("id")
                assert isinstance(sid, int), f"stack id not int: {sid!r}"
                first_stack_id = sid
                return f"{len(stacks)} stacks, first_stack_id={first_stack_id}"

            await run_check(report, "06 get_practice_quiz(first-PQ)", check_practice_quiz)

            if first_stack_id is None:
                msg = "no stack id resolved from first PQ"
                report.record_skip("07 bookmark_stack ON", msg)
                report.record_skip("08 bookmark_stack OFF", msg)
            else:
                stack_id = first_stack_id

                # Check 7
                async def check_bookmark_on() -> str:
                    res = await p_client.call_tool(
                        "bookmark_stack",
                        {"stack_id": stack_id, "course_id": COURSE_ID_TEST, "bookmarked": True},
                    )
                    bookmarks = tool_data(res) or []
                    assert isinstance(bookmarks, list), f"not list: {bookmarks!r}"
                    assert stack_id in bookmarks, f"{stack_id} not in {bookmarks!r}"
                    return f"bookmarks now include {stack_id}"

                await run_check(report, "07 bookmark_stack ON", check_bookmark_on)

                # Check 8
                async def check_bookmark_off() -> str:
                    res = await p_client.call_tool(
                        "bookmark_stack",
                        {"stack_id": stack_id, "course_id": COURSE_ID_TEST, "bookmarked": False},
                    )
                    bookmarks = tool_data(res) or []
                    assert isinstance(bookmarks, list), f"not list: {bookmarks!r}"
                    assert stack_id not in bookmarks, f"{stack_id} still in {bookmarks!r} — DB may be polluted"
                    return f"bookmarks no longer include {stack_id}"

                await run_check(report, "08 bookmark_stack OFF", check_bookmark_off)

            # Check 11
            async def check_srs() -> str:
                res = await p_client.call_tool("get_my_srs_state", {"practice_quiz_id": first_pq_id})
                rows = tool_data(res) or []
                assert isinstance(rows, list), f"not list: {type(rows).__name__}"
                return f"{len(rows)} srs rows"

            await run_check(report, "11 get_my_srs_state(first-PQ)", check_srs)

        # Check 9
        async def check_performance() -> str:
            res = await p_client.call_tool("get_my_performance", {"course_id": COURSE_ID_TEST})
            perf = tool_data(res) or {}
            assert isinstance(perf, dict), f"not dict: {type(perf).__name__}"
            # Shape: {id, firstErrorRate, firstPerformance, lastErrorRate,
            # lastPerformance, totalErrorRate, totalPerformance}.
            expected = {"firstErrorRate", "lastErrorRate", "totalErrorRate"}
            assert expected.issubset(perf.keys()), f"missing expected perf keys; got {sorted(perf.keys())!r}"
            return f"keys={sorted(perf.keys())}"

        await run_check(report, "09 get_my_performance(Testkurs)", check_performance)

        # Check 10
        async def check_activity_perf() -> str:
            res = await p_client.call_tool("get_my_activity_performance", {"course_id": COURSE_ID_TEST})
            rows = tool_data(res) or []
            assert isinstance(rows, list), f"not list: {type(rows).__name__}"
            return f"{len(rows)} activity perf rows"

        await run_check(report, "10 get_my_activity_performance(Testkurs)", check_activity_perf)

        # Check 12
        async def check_mistakes() -> str:
            res = await p_client.call_tool("get_my_mistakes", {"limit": 10})
            page = tool_data(res) or {}
            rows = page.get("rows") or page.get("items") or []
            if isinstance(page, list):
                rows = page
            bad = [
                r
                for r in rows
                if isinstance(r, dict) and r.get("lastResponseCorrectness") not in {"WRONG", "PARTIAL", None}
            ]
            assert not bad, f"rows with correctness outside WRONG/PARTIAL: {bad!r}"
            return f"{len(rows)} rows, all wrong/partial"

        await run_check(report, "12 get_my_mistakes correctness invariant", check_mistakes)

        # Check 13
        async def check_course_analytics_weekly() -> str:
            res = await p_client.call_tool(
                "get_my_course_analytics",
                {"course_id": COURSE_ID_TEST, "timeframe": "WEEKLY"},
            )
            rows = tool_data(res) or []
            assert isinstance(rows, list), f"not list: {type(rows).__name__}"
            off = [r for r in rows if isinstance(r, dict) and r.get("type") != "WEEKLY"]
            assert not off, f"non-WEEKLY rows leaked through: {off!r}"
            return f"{len(rows)} weekly rows"

        await run_check(
            report,
            "13 get_my_course_analytics(WEEKLY) filter invariant",
            check_course_analytics_weekly,
        )

        # Check 14
        async def check_weak_topics() -> str:
            res = await p_client.call_tool("get_weak_topics", {"course_id": COURSE_ID_TEST, "limit": 5})
            rows = tool_data(res) or []
            assert isinstance(rows, list), f"not list: {type(rows).__name__}"
            assert len(rows) <= 5, f"{len(rows)} > limit 5"
            # weakest-first: accuracy should be non-decreasing.
            prev_acc: float | None = None
            for r in rows:
                if not isinstance(r, dict):
                    continue
                total = r.get("totalCount") or 0
                correct = r.get("correctCount") or 0
                acc = (correct / total) if total else 0.0
                if prev_acc is not None:
                    assert acc >= prev_acc - 1e-9, f"order violated: {acc} < previous {prev_acc} in {rows!r}"
                prev_acc = acc
            return f"{len(rows)} topics, sorted weakest-first"

        await run_check(report, "14 get_weak_topics sort order", check_weak_topics)

        # Check 15
        async def check_mastery_map() -> str:
            res = await p_client.call_tool("get_mastery_map", {"course_id": COURSE_ID_TEST})
            rows = tool_data(res) or []
            assert isinstance(rows, list), f"not list: {type(rows).__name__}"
            for r in rows:
                assert isinstance(r, dict), f"row not dict: {r!r}"
                assert set(r.keys()) == {"topic", "mastery", "coverage"}, f"unexpected keys {sorted(r.keys())!r}"
            return f"{len(rows)} topics with exact shape"

        await run_check(report, "15 get_mastery_map reshape", check_mastery_map)

        # Check 16
        async def check_recent_activity() -> str:
            res = await p_client.call_tool("get_my_recent_activity", {"limit": 5})
            rows = tool_data(res) or []
            assert isinstance(rows, list), f"not list: {type(rows).__name__}"
            return f"{len(rows)} activity entries"

        await run_check(report, "16 get_my_recent_activity shape", check_recent_activity)

    # --- Lecturer-scoped session --------------------------------------------
    async with Client(url, auth=lecturer_jwt, verify=verify_tls) as l_client:
        # Check 17
        # The backend `Self` query returns null for role=USER (it only
        # resolves Participant rows), so `authenticated=False` with no GraphQL
        # errors is the expected outcome for a lecturer. A GraphQL `errors`
        # key — or a network failure — would indicate the JWT was rejected
        # upstream and IS a real failure signal.
        async def check_lecturer_whoami() -> str:
            res = await l_client.call_tool("whoami", {})
            data = tool_data(res) or {}
            if data.get("errors"):
                raise AssertionError(f"backend rejected lecturer JWT: {data['errors']!r}")
            if data.get("authenticated") is True:
                self_ = data.get("self") or {}
                return f"authenticated role={self_.get('role')}"
            return f"Self→null for USER role (expected); reason={data.get('reason')!r}"

        await run_check(report, "17 whoami (lecturer)", check_lecturer_whoami)

        # Check 18
        async def check_list_my_questions() -> str:
            res = await l_client.call_tool("list_my_questions", {})
            page = tool_data(res) or {}
            elements = page.get("elements")
            if elements is None and isinstance(page, list):
                elements = page
            assert isinstance(elements, list), f"elements not a list: {page!r}"
            return f"{len(elements)} questions (numOfElements={page.get('numOfElements')})"

        await run_check(report, "18 list_my_questions (lecturer)", check_list_my_questions)

    return _finish(report)


def _finish(report: SmokeReport) -> int:
    total = len(report.passes) + len(report.failures) + len(report.skips)
    print()
    print(
        f"Summary: {len(report.passes)} passed, {len(report.failures)} failed, "
        f"{len(report.skips)} skipped ({total} checks total)"
    )
    if report.failures:
        print("Failures:")
        for name, reason in report.failures:
            print(f"  - {name}: {reason}")
    return 0 if not report.failures else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(smoke()))
