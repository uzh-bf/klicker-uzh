# Local Chat MCP Fixture

## Goal

- Problem: Benibot's test seed enables a `doc_query` MCP server at
  `http://localhost:1417/mcp`, but the self-contained development environment
  starts nothing there.
- Decision: Add one deterministic, read-only MCP fixture to the existing Chat
  package and start it inside the app container. Keep the existing seeded URL,
  add no dependency, and make no production configuration change.
- Package: Full-path stacked package on `rs/chat-local-mcp-fixture-clean`, based
  on `rs/chat-ux-conversation-polish` while draft PR #5363 remains open.

## Planning Review

- Review: capable read-only planner completed on 2026-08-12.
- Accepted: start and health-check MCP before Chat; add read-only annotations;
  keep this package separate from PR #5363; document the direct-model smoke
  test and Auto Mode limitation.

## Slice: Local MCP tracer bullet

- Route: main.
- Budget skip reason: critical-path coupling across MCP transport, devcontainer
  lifecycle, seeded chatbot configuration, OpenRouter/LiteLLM, and browser
  proof.
- Test obligation: no new automated test. The existing source normalization,
  tool rendering, and persistence suites cover the stable application seams;
  this package adds direct MCP protocol and real-browser integration evidence.
- Do:
  - Add one stateless Streamable HTTP MCP server exposing only `doc_query`.
  - Return deterministic synthetic content with `KLICKER_LOCAL_MCP_OK` and one
    source in both text and structured MCP output.
  - Bind to loopback, bound request/query size, validate Host, and declare the
    tool read-only, non-destructive, idempotent, and closed-world.
  - Start it through the delivered devrouter process helper, prove `/health`,
    then start the application stack.
  - Update agent instructions, environment docs, Chat wiki, testing skill, and
    change log.
- Check:
  - Syntax, formatting, shell syntax, AGENTS validation, and secret scan.
  - SDK-client initialize/list/call plus invalid-input rejection.
  - Managed process start/reuse and health.
  - Full Chat Vitest suite, root `check:all`, and root build.
  - Browser: direct GPT-5.6 Luna calls `KB_doc_query`, renders the exact marker
    and source card, and preserves all three after reload.
  - Browser: record Auto Mode's actual tool-call and follow-up behavior without
    claiming final synthesis when its second step is empty.
- Commit: `chore(chat): add local MCP test fixture`.

## Progress

- Planning-stage review: done.
- Implementation: complete locally.
- Verification: protocol, managed lifecycle, Chat suite, root checks, build,
  direct-model browser path, Auto Mode behavior, and reload persistence passed
  or were characterized as described above.
- Plan commit: `939ec6dd7`.
- Implementation commit: `b854a3bcb`.
- Review-fix commit: `ed14f51d6`.
- Simplifier: done — approved with no justified net reduction.
- Intermediate review: done — no actionable correctness, security, lifecycle,
  cross-system, or verification findings.
- Integrated final review: completed with one medium runtime-identity finding
  and one low history-ordering finding. Both were fixed before publication:
  the fixture source hash now forces managed replacement, and this clean stack
  commits the reviewed plan first.
- Remaining: final verification readback and publication only when requested.
