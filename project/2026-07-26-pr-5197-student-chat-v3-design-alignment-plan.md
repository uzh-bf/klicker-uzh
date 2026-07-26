# Student Chat v3 — Design Alignment + Citation Display Plan

Third-phase plan on the same branch/PR. Align apps/chat with the Student Chat v3
design mockups (`Student Chat v3.html` + jsx set) while keeping every feature
already built and verified. Core new capability: nice source/citation display
parsed from tool-result JSON.

## Plan identity

- Plan: `project/2026-07-26-pr-5197-student-chat-v3-design-alignment-plan.md` (this file)
- Branch: `claude/student-chat-v3-design-3459db` (continue; do not branch off)
- Target: `v3`, PR: [#5197](https://github.com/uzh-bf/klicker-uzh/pull/5197) (draft — keep draft)
- History: `project/2026-07-19-student-chat-v3-reskin-plan.md` (done),
  `project/2026-07-23-student-chat-v3-production-readiness-plan.md` (done, finish-gated)
- ADRs in force: 0001 (locale cookie), 0002 (rating field). New: 0003 (citation contract, S7).

## Goal

- Problem: assistant answers show raw tool-call chips + JSON. Design mockups show
  friendly activity chips, numbered source cards ("QUELLEN"), inline citation
  chips with hover previews, composer hint, timestamps.
- Goal: implement the source/citation display system + the smaller design
  alignment items. Keep all shipped features.
- Non-goals: concept graph sidebar, inline quiz (Übungsfrage), video thumbnails
  with real stills, mode-switcher dropdown redesign, dark mode, moving the
  legal line, doc-query service changes (separate repo — phase 2 design only).

## Decisions (made autonomously 2026-07-26, user may veto)

- D1 Keep segmented mode switcher; skip design's dropdown pill. Built, tested,
  a11y-verified. Dropdown adds nothing functional.
- D2 Keep header identity (avatar + chatbot name) and sidebar structure. Skip
  design's course-code sidebar header — chat is chatbot-scoped, no course data.
- D3 Keep `KlickerLogo.png` sidebar-footer logo exactly as shipped (explicit
  user instruction; mockup text-logo ignored).
- D4 Sources derive client-side from persisted tool-call parts. No DB schema
  change, no new persisted field. Live streaming + history render identically
  because both read message content parts. → ADR 0003.
- D5 Citation markers: model writes `[n]`; n = 1-based index over the deduped,
  first-appearance-ordered source list across the message's doc_query calls.
  Out-of-range or sourceless `[n]` stays plain text.
- D6 Activity chips replace the collapsed chip label only; expanded raw
  args/result panel stays (transparency + debugging).
- D7 Composer hint shows disclaimer sentence always; credit-cost segment only
  when credits are enabled for the chatbot.

## Research (done)

- R1 doc_query response contract — read from `~/Git/ai/mcp-doc-query/src/pipeline.py`
  (run_query, DocumentsModeSource):
  - answer mode (default): `{ answer, sources_used, sources: [{ expert,
    source_url, source_type, file_name, page_number, labeled_page_number? }] }`
    — values may be the literal string `"N/A"`. No excerpt text.
  - documents mode: `{ mode: "documents", summary, sources: [{ reference,
    reference_type, source_type, expert_id, chunks: [{ content, page_number,
    labeled_page_number }], title?, description? }] }` — has chunk text.
  - Klicker seed: MCP server `KB` → tool namespaced `KB_doc_query`
    (`packages/prisma-data/src/data/seedMCPServers.ts`).
- R2 Current pipeline: tool results already persisted in assistant message
  content parts (`persistedAssistantContent.ts`) and streamed live
  (`useChatResponse.ts` tool-output-available). Nothing extra to persist.
- Limitation: answer mode has no excerpts → hover previews show
  title/page/type/url only. Excerpts in answer mode = phase 2 (doc-query repo).

## Citation system — phase 2 (future, not this branch)

- doc-query: add short `excerpt` per source in answer mode; stable `source_id`;
  media metadata (video timestamps, image refs) for typed media cards.
- klicker: signed URLs to open course-material sources; video deep links;
  hover previews with real excerpt quotes; eval harness asserting [n] markers
  ground in returned sources (rs-docquery-retrieval-test pattern).
- Contract stays: UI renders whatever `sources` normalizer yields; richer JSON
  upgrades display without another UI rework.

## Environment + verification recipe

- Reuse DevPod `claude-student-chat-v3-design-34` (running). `devrouter ensure .`
  only if unhealthy. Chat URL:
  `https://chat.klicker.claude-student-chat-v3-design-34.localhost/8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f`
- Browser: agent-browser, participant `testuser24`, JWT mint recipe in the
  2026-07-23 plan (mint in-container, delete helper, never commit).
- Typecheck/tests in container:
  `devrouter exec . -- bash -lc 'cd /workspaces/klicker-uzh && pnpm --filter @klicker-uzh/chat check'`
  (+ `test`). Never run check mid-browser-verification (typegen 404s routes;
  remedy: touch route files, not `devrouter ensure`).
- No `UPSTREAM_OPENAI_API_KEY` in DevPod → live model output not verifiable.
  Seed assistant messages with realistic doc_query tool-call parts (Playwright
  `seedThread` helper or direct API/DB with proper parentId linkage) to verify
  rendering.
- Playwright on host per `klicker-playwright-e2e` + host-run memory.
- Commits from host worktree: `--no-verify` (no root node_modules for husky);
  real checks run in container. Data-hygiene grep before every commit.
- German copy: informal Du (capitalized), Swiss ss, en/de key parity enforced.

## Slices

### S1 — Source contract + normalizer (lib only)

- Do: `apps/chat/src/lib/sources/types.ts` (`ChatSource`: id, index, type
  'document'|'link'|'video'|'image', title, page?, labeledPage?, url?,
  excerpt?, meta?) + `normalizeSources.ts`: extract from a message's tool-call
  parts (match `*_doc_query` names, parse string-or-object results, both
  response modes, drop "N/A", dedupe by url|file+page, first-appearance order,
  cap 12). Pure functions.
- Check: vitest unit tests (answer mode, documents mode, string JSON, garbage,
  empty, dedupe, cap) — `pnpm --filter @klicker-uzh/chat test` in container.
- Commit: `feat(chat): add source normalization from doc-query tool results`

### S2 — Sources section under assistant answers

- Do: `sources-section.tsx`: "QUELLEN · N"/"SOURCES · N" divider header, grid
  of numbered cards (01-badge, title, page/chapter line, type icon; url type →
  link out; video type → play icon + timestamp text). Wire into
  `AssistantMessageParts` after parts, before metadata. i18n keys en/de.
  data-cy `chat-sources-section`, `chat-source-card`.
- Check: container check+test; seed thread w/ doc_query tool part; agent-browser
  screenshots desktop+mobile, en+de.
- Commit: `feat(chat): render typed source cards under assistant answers`

### S3 — Inline citation chips + hover preview

- Do: transform `[n]` in assistant markdown (only when normalized sources
  exist and 1<=n<=count) into sup citation chip; hover/focus popover with
  source title, page, type, url hint; click scrolls to source card
  (`#src-<msgid>-<n>`). Keep streaming-safe (transform per render, no state).
  Graceful fallback otherwise.
- Check: unit test transform; browser check seeded message with `[1]`/`[2]`
  markers incl. hover preview screenshot; keyboard focus check.
- Commit: `feat(chat): render inline numbered citations with source previews`

### S4 — Friendly activity chips

- Do: label map in tool-fallback: `*_doc_query` → t('chat.tools.searchedCourseMaterial')
  (+ `· keine Treffer` variant when normalizer yields 0 sources from a
  completed result), search icon, pill styling per design (subtle bg/border).
  Unknown tools keep formatToolName. Expanded panel unchanged.
- Check: browser: chip label/style for seeded doc_query call (hit + no-hit),
  unknown tool fallback via existing tests.
- Commit: `enhance(chat): show friendly activity chips for known tools`

### S5 — Citation prompt contract (server)

- Do: prompts config addendum (system prompt suffix when chatbot has RAG/MCP
  tools): instruct citing doc_query-grounded statements as `[n]` in source
  order, continue numbering across calls, no fabricated citations.
- Check: unit test prompt assembly with/without tools; live model deferred (no
  key) — record boundary in Progress + PR.
- Commit: `enhance(chat): instruct models to emit numbered source citations`

### S6 — Composer hint + timestamps

- Do: hint line under composer (standalone, non-embedded): disclaimer sentence
  + `· 1 Credit pro Nachricht` when credits enabled (i18n en/de, reuse credits
  store). Relative timestamp (next-intl relative format of createdAt) right-
  aligned in assistant action row. Optional: user-bubble top-right corner 4px
  detail if trivial.
- Check: browser en+de, desktop+mobile screenshots; embedded mode unchanged.
- Commit: `enhance(chat): add composer disclaimer hint and message timestamps`

### S7 — E2E + wiki + ADR + PR finish

- Do: Playwright spec additions (sources section renders from seeded tool part;
  citation chip renders + popover; composer hint visible); wiki
  `docs/chat-platform.md` citation-display section; ADR
  `docs/adr/0003-chat-citations-from-tool-parts.md`; plan Progress final;
  PR #5197 body update (rs-mr-description-writer); final security +
  maintainability gates.
- Check: host Playwright run vs worktree stack; container check:all-equivalents;
  fresh browser matrix screenshots into PR.
- Commit: `test(chat): cover source and citation rendering end to end` +
  `docs(chat): document citation display contract` (split as appropriate)

## Slice execution contract

Per slice: opus implement subagent → fastest verification → progress update →
commit → opus review subagent (rubric: references/review-rubric.md) + separate
simplify subagent on the exact commit → integrate accepted findings → re-verify
→ adjustment commit. One slice at a time. Max 8 concurrent subagents.

## Progress

- 2026-07-26: plan written; research R1/R2 done; slices pending. Next: commit
  plan, then S1.
- 2026-07-26 S1 done: `apps/chat/src/lib/sources/{types,normalizeSources}.ts`
  + 23 unit tests (79/79 chat suite green in container). Implement finding:
  @ai-sdk/mcp without outputSchema returns the raw MCP CallToolResult envelope
  as `result` — normalizer unwraps envelope (structuredContent preferred, then
  text content JSON) in addition to plain object/string payloads. Next: S1
  review+simplify subagents, then S2.
