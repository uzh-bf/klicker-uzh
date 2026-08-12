# Local Chat MCP Fixture

## Goal

- Problem: Benibot's test seed enables a `doc_query` MCP server at
  `http://localhost:1417/mcp`, but the self-contained development environment
  starts nothing there.
- Decision: Add one deterministic, read-only MCP fixture to the existing Chat
  package and start it inside the app container. Keep the existing seeded URL,
  add no dependency, and make no production configuration change. Complete the
  same local test package by upgrading its LiteLLM simulation to the current
  Auto V2 router used for Klicker in the AI deployment repository.
- Package: Full-path stacked package on `rs/chat-local-mcp-fixture-clean`, based
  on `rs/chat-ux-conversation-polish` while draft PR #5363 remains open.

## Planning Review

- Review: capable read-only planner completed on 2026-08-12.
- Accepted: start and health-check MCP before Chat; add read-only annotations;
  keep this package separate from PR #5363; document the direct-model smoke
  test and Auto Mode limitation.
- Follow-up review: the widened Auto V2 slice received a planning-stage review
  on 2026-08-12. The correction pass approved the explicit target mapping,
  fallback, fail-closed routing matrix, OpenRouter trust boundary, and browser
  completion gate.

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

## Slice: Local Auto V2 routing

- Route: main.
- Budget skip reason: critical-path coupling across LiteLLM configuration,
  OpenRouter model capabilities, the live Chat tool loop, and runtime log
  evidence.
- Test obligation: no new automated test. Configuration validation, controlled
  runtime routing probes, and the real Browser tool journey exercise the
  consequential seams without adding a mock of LiteLLM internals.
- Do:
  - Pin
    `ghcr.io/berriai/litellm-database:v1.96.2@sha256:80e5e92bdcca246cd4153d451e5f75b65e19c7e39c46cc88a38bed4b65cc5836`.
  - Mirror the deployed Klicker Auto V2 policy through the local generic
    OpenRouter boundary: Luna low classifier, Luna medium/high/xhigh for
    SIMPLE/MEDIUM/COMPLEX, Sol medium for REASONING, and
    `openai/text-embedding-3-small` for semantic matching.
  - Set `session_affinity: false`, `adaptive: false`, no escalation keywords,
    a four-second classifier timeout, semantic keyword matching with threshold
    `0.55`, and the exact deployed Klicker SIMPLE/COMPLEX/REASONING corpus.
  - Keep Auto on Chat Completions, retain the existing generic upstream
    credential boundary, and retarget the local Sol fallback from the removed
    low-effort alias to Sol medium -> GPT-5.1.
  - Document the extra classifier and embedding requests, latency/cost, and
    OpenRouter data boundary in the runbook, devcontainer docs, wiki, testing
    guidance, and this package's existing change log.
- Check:
  - Resolve the pinned image for the host architecture and validate Compose,
    YAML, formatting, wiki, agent instructions, and secret hygiene.
  - Call the embedding alias and every Luna/Sol target alias directly with its
    configured effort.
  - Send exact SIMPLE, COMPLEX, and REASONING corpus prompts and require
    `cause=semantic_keyword_match` with the expected target in LiteLLM logs.
  - Send a non-corpus prompt and require `cause=llm_classifier` with the
    expected tier. Classifier or embedding failure, heuristic fallback, or a
    mismatched model fails this gate even if an answer is returned.
  - Browser: Auto invokes `KB_doc_query`, renders a non-empty final answer and
    source, and preserves the tool result, answer, and source after reload. An
    empty post-tool step fails the package.
- Commit: `chore(chat): align local Auto Mode routing`.

## Progress

- Planning-stage review: done.
- MCP implementation: complete locally.
- MCP verification: protocol, managed lifecycle, Chat suite, root checks, build,
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
- Auto V2 implementation: complete locally. LiteLLM 1.96.2 runs from the pinned
  multi-platform digest and exposes every classifier, embedding, and tier alias.
- Auto V2 verification: direct target calls and the 1,536-dimension embedding
  call passed. Runtime logs proved semantic SIMPLE -> Luna medium, COMPLEX ->
  Luna xhigh, REASONING -> Sol medium, and LLM-classified MEDIUM -> Luna high,
  with no classifier, embedding, or heuristic-fallback warning. In the real
  Browser, Auto called `KB_doc_query`, rendered a non-empty answer containing
  `KLICKER_LOCAL_MCP_OK` and the source card, and preserved all three after
  reload.
- Auto V2 simplifier and intermediate review: done in parallel on commit
  `def434085`. Both approved the implementation after identifying this stale
  remaining-work line; no config, runtime, security, or maintainability change
  was requested.
- Integrated final review: reopened for the widened exact branch head.
- Remaining: complete exact-head integrated final review, then stop before push
  or PR update unless separately authorized.
