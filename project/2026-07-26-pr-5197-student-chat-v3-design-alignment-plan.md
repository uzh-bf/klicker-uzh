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
- ADRs in force: 0001 (locale cookie), 0002 (rating field), 0003 (framework
  upgrade). New: [0004](../docs/adr/0004-chat-citations-from-tool-call-parts.md)
  (citation contract, S7).

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
  because both read message content parts. → ADR 0004.
- D5 Citation markers: model writes `[n]`; n = 1-based index over the deduped,
  first-appearance-ordered source list across the message's doc_query calls.
  Out-of-range or sourceless `[n]` stays plain text.
- D6 Activity chips replace the collapsed chip label only; expanded raw
  args/result panel stays (transparency + debugging).
- D7 Composer hint shows the disclaimer sentence only. Superseded during the S6
  adjustment pass: the planned credit-cost segment ("1 credit per message") was
  dropped, and its i18n key with it, because `calcCost` prices each answer from
  input/output tokens — the per-message cost varies by model and exchange
  length, so the flat claim was wrong. The credits surfaces already carry the
  honest variable-cost copy next to the balance it applies to.

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
  citation chip renders + popover; the four doc_query activity-chip states and
  their icon gating, per S4 review F1 — existing `Y-chat.spec.ts` tool cases
  use generic tool names only; composer hint visible); wiki
  `docs/chat-platform.md` citation-display section; ADR
  `docs/adr/0004-chat-citations-from-tool-call-parts.md`; plan Progress final;
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
  + 20 unit tests (79/79 chat suite green in container). Implement finding:
  @ai-sdk/mcp without outputSchema returns the raw MCP CallToolResult envelope
  as `result` — normalizer unwraps envelope (structuredContent preferred, then
  text content JSON) in addition to plain object/string payloads. Next: S1
  review+simplify subagents, then S2.
- 2026-07-26 S2 done: `sources-section.tsx` (QUELLEN/SOURCES header, numbered
  doc-card grid + media-card row, url cards link out, anchors
  `src-<msgid>-<n>`, data-cy attrs) wired into AssistantMessage;
  `chat.sources.*` i18n en+de. Verified: browser via seeded doc_query thread
  (testuser24) — desktop en+de 1440x900, mobile 390x844, no-tool control shows
  no section, logo intact, no console errors (screenshots in session
  scratchpad s2/); chat check (typegen+tsc) clean; vitest 79/79; prettier
  clean; routes restored (health 200). Next: S2 review+simplify, then S3.
- 2026-07-26 S2 adjustments: review found unmemoized normalize on every
  streamed token → fingerprint-keyed useMemo (parts ref never stable);
  simplify accepted: merged media label branches, rel noopener noreferrer,
  readonly parts param (spread removed); declined isMedia prop plumbing.
  A11y note deferred to S3: index badge aria-hidden, add AT-visible source
  number when citation anchors land. Verified: tsc+typegen clean, 79/79,
  lint clean on touched files, browser a11y snapshot shows SOURCES · 3 region
  + 3 cards post-change (screenshot capture flaky in daemon; snapshot is the
  evidence). Torn-write lesson: in-container prettier --write while dev
  watcher reads → turbopack caches parse error; remedy touch the file.
- 2026-07-26 S3 done: remark plugin `remarkCitationMarkers` (mdast text-node
  visitor → `#cite-n` links; code/links skipped structurally) + CitationChip
  (button-in-sup, tooltip w/ title/page/excerpt/goToSource, click scrolls to
  card anchor, no hash change) intercepted in markdown-text `a` override;
  `useMessageSources` hook + MessageSourcesContext (AssistantMessage provides,
  SourcesSection + chips consume — normalize runs once per message);
  sr-only source numbers on cards (S2 a11y item); `chat.citations.*` en+de.
  17 new tests (96/96). Env incident: turbopack EMFILE crash (3 concurrent
  stacks) → `devrouter ensure .` reconciled; DB re-seeded → thread re-seeded
  w/ [1][2][7] markers, JWT re-minted, scripts deleted. Browser evidence
  (a11y snapshots; CDP screenshot capture hangs in this daemon): en+de chips
  "Source/Quelle n: <title>" with correct a11y names, [7] stays literal,
  hover tooltip "kapitel-4.pdf p. 4 Go to source", click = no nav/hash, no
  fresh console errors, health 200. Gotcha confirmed: disclaimer dialog
  animate-out never unmounts in headless tab → reload after accept.
  Next: S3 review+simplify, then S4.
- 2026-07-26 S3 adjustments (review+simplify on fda37e0d1): accepted —
  ancestor-chain skip flag in `walk(node, insideSkipped)` so markers nested
  deeper inside link labels (e.g. `[**see [1]**](url)`) stay literal;
  `SKIPPED_PARENT_TYPES` trimmed to link/linkReference (code is a leaf value
  in mdast, documented); `resolveCitationSource` folded into
  normalizeSources.ts (single-function file deleted); `Translate` type in
  sourceDisplay.ts retyped `ReturnType<typeof useTranslations<never>>`
  (reasoning.ts precedent) instead of `any`-based signature; 3 new tests
  (nested-link-label skip, leading-marker end-to-end via
  parseCitationHref→resolveCitationSource, `[0]` resolves to no source).
  Declined: folding useMessageSources into provider (hook is reused/testable
  seam). Evidence: 99/99 chat tests in-container, `check` clean, routes
  touched post-typegen, health 200. Next: S4 friendly activity chips.
- 2026-07-26 S4 done: doc_query chips get friendly localized labels. Pure
  exported `getDocQueryChipState({toolName,isRunning,isFailed,result,isError})`
  → running|done|doneEmpty|failed (doneEmpty = completed, non-error, result
  present, `normalizeSourcesFromParts` empty), memoized in ToolFallback and
  mapped to one `chat.tools.*` key each; SearchIcon on doc_query chips when
  not running/failed (spinner + error icons keep precedence). Unknown tools
  keep formatToolName. New keys en+de: searchingCourseMaterial,
  searchedCourseMaterial, searchedCourseMaterialEmpty,
  searchCourseMaterialFailed. 6 new tests (105/105 in-container), chat
  `check` clean. Env: chat dev had OOM-crashed mid-slice → `devrouter
  ensure .` (DB wiped again). Browser evidence on seeded 4-chip thread
  (hit / no-hit / unknown tool / failed doc_query): en = "Searched course
  materials", "… · no results", "Used list documents", "Failed to search
  course materials"; de = "Kursmaterialien durchsucht", "… · keine Treffer",
  "list documents verwendet", "Kursmaterialien konnten nicht durchsucht
  werden"; DOM check confirms lucide-search only on the two doc_query
  success chips, circle-alert on the failed one, none on the unknown tool.
  Sources section + citation chips still correct on the same message.
  Console clean apart from pre-existing Langfuse/Radix-describedby noise.
  Next: S4 review+simplify, then S5 prompt contract.
- 2026-07-26 S4 adjustments (review+simplify on 42ea01676): accepted —
  "no results" is now claimed only for a payload that actually parsed
  (`parseDocQueryPayload`, the former private `parsePayload`, is exported for
  this), because a cancelled call leaves the literal `'Loading...'`/
  `'Executing...'` placeholder from `hooks/useChatResponse.ts` behind as the
  result and would otherwise be labelled as an empty search — verified real
  in useChatResponse.ts:395,410, not just asserted; dropped the `useMemo`
  around the chip state (neighbouring `resultText` does heavier
  `JSON.stringify` unmemoized every render, and the memo depended on an
  undocumented referential-stability detail of the assistant-ui streaming
  path); search icon now derives from the computed state instead of
  re-deriving `!isRunning && !isFailed`; `aria-hidden` on all chip icons
  (each sits next to the chip's own text label); tightened the failed string
  for tense parity (en "Course material search failed", de "Suche in
  Kursmaterialien fehlgeschlagen"). Declined: switch→lookup-map for the label
  (loses union exhaustiveness). Deferred to S7: Playwright coverage of the
  four doc_query chip states + icon gating (review F1, e2e is S7's slice).
  Evidence: 107/107 chat tests, `check` clean, eslint clean, routes touched
  post-typegen (health 200), browser re-verified en+de with a DOM check
  showing every chip icon `aria-hidden`. Next: S5 prompt contract.
- 2026-07-26 S5 done: `lib/server/citationInstructions.ts` exports pure
  `withCitationContract(systemPrompt, toolNames)`, gated on
  `isDocQueryToolName` (the same predicate the UI uses — not "has any MCP
  tool", since only doc_query results become resolvable sources). Appends a
  short English block: bracketed `[1]`/`[2]` markers in returned-source
  order, numbering continuous across searches in one answer, never invent a
  number, no citation when not using retrieved material, and an explicit
  "these are not LaTeX" clause phrased WITHOUT referencing DEFAULT_PROMPT's
  bracket rule (a chatbot's stored prompt replaces the default entirely and
  may never mention LaTeX). Idempotent (contains-check). Wired in route.ts
  right after `toolNames` is computed, mutating `systemPrompt` so the
  existing `systemPromptLength`/`systemPromptHash` telemetry keeps describing
  what is actually sent. 8 new tests (115/115), `check` + eslint clean,
  routes touched post-typegen (health 200).
  Boundary: no `UPSTREAM_OPENAI_API_KEY` in this DevPod, so model compliance
  with the contract is UNVERIFIED — only prompt assembly is proven. Carry
  this into the PR body as a manual-verification item.
  Next: S5 review+simplify, then S6 composer hint + timestamps.
- 2026-07-26 S5 adjustments (review+simplify on 21a7fe834): accepted —
  contract now tells the model to REUSE a repeat source's original number.
  Real mismatch, not stylistic: `normalizeSourcesFromParts` skips a source it
  has already seen and never mints a second index, so "keep numbering
  continuous" alone would make the model label a repeat `[4]` when only 3
  unique sources exist, and `resolveCitationSource` renders any marker beyond
  N as literal text — exactly the case a multi-part question about one
  lecture triggers. Also dropped the idempotency guard (single call site,
  no retry path recomputes the prompt — verified in route.ts) and collapsed
  the empty/whitespace base-prompt tests into one `test.each` (both inputs
  reduce to the same `trimEnd()` branch); added a test pinning the reuse
  sentence. Declined: template literal for the contract (would embed literal
  newlines mid-sentence in the text sent to the model) and moving the module
  into `lib/config/prompts.ts` (that directory holds data records, this is
  logic). Reviewer independently confirmed the gate sees exactly the tools
  passed to `streamText` and that the mutation precedes every consumer, so
  the telemetry claim holds. Evidence: 115/115, `check` + eslint clean,
  health 200. Next: S6 composer hint + timestamps.
- 2026-07-26 S6 done: `ComposerHint` under the composer, standalone only
  (`!embedded`, same gate as ThreadScrollToBottom) — disclaimer sentence plus
  `· 1 Credit pro Nachricht` when `creditsLoaded && credits.total > 0` (no
  dedicated credits-enabled flag exists on the store or API; same gap
  credits-footer.tsx documents). Relative timestamp added to the existing
  `MessageMetadata` caption rather than a parallel element: `<time>` with ISO
  `dateTime` and an absolute-datetime `title`, rendered for every completed
  assistant message even when there is no mode/model/credits metadata (the
  caption used to return null in that case). `createdAt` needed no plumbing —
  lib/api/types.ts:226 already maps it and RuntimeProvider's convertMessage
  spreads it into assistant-ui's native `ThreadMessage.createdAt`.
  `format.relativeTime(date, new Date())` passes `now` explicitly: without it
  next-intl logs ENVIRONMENT_FALLBACK on every render.
  Evidence: 115/115 (one filtered-run failure was the known dev-recompile
  flake — direct `vitest run` and a filtered re-run both green), `check`
  clean, eslint clean on thread.tsx (only the pre-existing `<img>` warning at
  line 680, untouched region). Browser: en hint "Chatbot answers can be wrong
  — verify against your course materials. · 1 credit per message" + "1 hour
  ago" (dateTime 2026-07-26T13:39:16.681Z, title "Jul 26, 2026, 3:39 PM"); de
  "Antworten des Chatbots können falsch sein — bitte anhand Deiner
  Kursmaterialien prüfen. · 1 Credit pro Nachricht" + "vor 1 Stunde"
  (title "26.07.2026, 15:39"); `?embed=true` shows no hint (timestamp still
  present, as intended); at 390px the hint wraps to two lines with no page
  overflow. Console clean on fresh loads in both locales (earlier
  MISSING_MESSAGE/ENVIRONMENT_FALLBACK entries were stale buffer, proven by
  `console --clear` + reload = 0).
  Env limitation: agent-browser `screenshot` times out on
  `Page.captureScreenshot` in this daemon across full restarts (3rd
  occurrence this session). PR screenshots must come from host-run Playwright
  in S7, not agent-browser.
  Next: S6 review+simplify, then S7.
- 2026-07-26 Out-of-slice fix (gap I flagged during S4, carried until now):
  `isDocQueryToolName` now accepts the hash-disambiguated tool name.
  `toSafeToolName` (services/mcpClients.ts:56) appends 8 hex chars of a
  sha256 whenever the namespaced name exceeds 64 chars OR collides with
  another server's, so a chatbot with two RAG servers both exposing
  `doc_query` gets e.g. `KB_doc_query_1a2b3c4d` for the second one — which
  the old `/(^|_)doc_query$/` missed, silently dropping that server's
  sources, citations, friendly chip AND the S5 prompt contract (same
  predicate gates all four). Suffix group is `(_[0-9a-f]{8})?$`, tight enough
  that `doc_query_helper` and non-hex/wrong-length suffixes still reject.
  Not fixed: a name long enough to be truncated before the suffix
  (`withHashSuffix` slices the base at 55 chars) — needs a server name over
  ~45 chars, and no rename-safe signal survives the truncation. 3 new tests
  (117/117), eslint clean on both files.
- 2026-07-26 S6 adjustments (review+simplify on 5a6f844a4): accepted —
  (1) the credit clause is GONE from the composer hint. "1 credit per
  message" was simply false: `calcCost` in the chat route prices each answer
  from input/output tokens, and the app's own `chat.credits.costHint` already
  says "how many depends on the model and the length of the exchange". A
  student watching a 1.2-credit answer land under a "1 credit per message"
  promise reads the app as broken. Verified in route.ts:1685 before acting,
  not taken on the reviewer's word. Dropping it also retires the reviewer's
  separate complaint that `creditsLoaded && credits.total > 0` was an
  unfalsifiable stand-in for a credits-enabled flag (`creditMaxCredits Int
  @default(1)`, no disabled value exists) and the layout shift it caused.
  `chat.composer.creditCostHint` removed from en+de.
  (2) the relative timestamp now ticks: `useNow({ updateInterval: 60_000 })`
  instead of `new Date()`. A completed message only re-renders on its own
  state changes (vote, edit, branch switch), so the label used to freeze for
  as long as the student read the answer. Proven live, not asserted: label
  read "1 minute ago", then "2 minutes ago" 80s later with no reload and no
  interaction.
  (3) my own find while reading the diff, missed by both agents: `visibleParts`
  can be empty while `fullParts` is not (an answer carrying only a model id —
  chatbot with no modes, non-reasoning model, credits off), and the standalone
  aria-hidden separator span then rendered the caption as a dangling
  "— 5 minutes ago". Separator now hangs off each metadata span instead, which
  also gives screen readers the boundary cue the reviewer asked for (a11y
  finding, confidence 50) for free. Reproduced in the browser by seeding that
  exact metadata combination before and after.
  Simplify accepted: merged the separator into the visible span, trimmed the
  `createdAt` and timestamp comments to what the code cannot say itself,
  dropped the fragment around the credit separator (moot after (1)).
  Declined: single combined `useSettingsStore` selector (splitting is the
  established pattern — zustand referential equality) and extracting a shared
  credits-enabled helper (moot after (1)).
  Deferred to S7 (review F5, e2e is S7's slice): Playwright coverage of the
  hint's embedded/standalone gating, `<time dateTime>` presence, and the
  model-id-only caption case from (3).
  Evidence: 117/117, `check` clean, eslint clean on thread.tsx (only the
  pre-existing `<img>` warning), prettier clean. Browser en+de on the seeded
  thread: hint is the disclaimer sentence alone in both locales, caption
  renders `Tutor — Medium — 1 credit — ` visible / `Tutor — gpt-5 — Medium —
  1 credit — ` sr-only / `<time>` "2 hours ago" resp. "vor 2 Stunden", 0
  console errors in both. Env: touching every route file at once tripped a
  Turbopack EMFILE plus a torn read of the host-edited en.ts ("Could not
  parse module … file not found"); recovered by touching the i18n files and
  thread.tsx in-container, no `devrouter ensure` and no DB reset needed.
  Next: S7.
- 2026-07-26 S7 done. Wiki + ADR: `docs/chat-platform.md` gains a "Sources and
  citations" section (derivation from tool parts, the tool-name forms the gate
  must tolerate, the numbering rules the UI and the prompt contract must agree
  on, the parsed-payload gate behind "no results") and a Testing paragraph on
  the new e2e block; ADR is **0004**, not 0003 as this plan originally said —
  0003 was already taken by the chat framework upgrade.
  E2E: 8 new tests in `Y-chat.spec.ts` under `Chatbot Source Citations`,
  covering card order + count, dedupe across two calls, valid vs out-of-range
  `[n]`, click-without-navigation, all four chip labels + icon gating, the
  hint's standalone/embedded gate, the ISO timestamp, and the model-id-only
  caption regression from the S6 adjustment. First run was 7/8: the
  click-without-navigation test captured its URL baseline before the
  thread-select client navigation had committed, so the router's own URL
  change was attributed to the citation click — a test race, not a product
  bug (fixed with a `toHaveURL` gate). Full file green afterwards: 58 passed.
  Two product bugs found during S7, each committed separately:
  (a) answer-mode `source_url` reached the card's `href` with no scheme check
  while documents mode already gated `reference` through `isUrlLike`. React 19
  neuters `javascript:` on its own so this is hardening, not a live XSS —
  stated that way in the commit rather than overclaiming. 4 new unit tests.
  (b) a chatbot without an avatar rendered a BROKEN IMAGE on every assistant
  message: the fallback src was the build-time relative path
  `../../public/user-solid.svg`, which resolves against the thread URL and
  404s. `middleware.ts` already allowlists `/user-solid.svg`, so the intended
  path was there all along. Caught only because the PR screenshots showed it.
  Verification: chat vitest 121/121; repo `pnpm run check` 24/24 tasks;
  `pnpm run lint` 5/6 — the only failure is `@klicker-uzh/analytics`, a Python
  package whose `pandas` wheel will not build in this container and which is
  outside the devcontainer stack by design (pre-existing, unrelated).
  Playwright host-run recipe that worked, for the next session: socat proxy
  `docker run -d --name s7-pgproxy --network default-cl-b426a_default -p
  15433:5432 alpine/socat TCP-LISTEN:5432,fork,reuseaddr
  TCP:default-cl-b426a-postgres-1:5432`, then DATABASE_URL on 127.0.0.1:15433,
  NODE_EXTRA_CA_CERTS from mkcert, APP_SECRET=abcd, COOKIE_DOMAIN and URL_*
  on `klicker.claude-student-chat-v3-design-34.localhost`.
  PR screenshots came from a throwaway Playwright spec (deleted before commit,
  never staged), not agent-browser, whose CDP screenshot call still hangs in
  this daemon: desktop 1440x900 + mobile 390x844 in en and de, plus embedded.
  Next: final security + maintainability gates, then the PR body.
- 2026-07-26 Finish gates done. Security gate (subagent, range
  `1c6547a12..HEAD`, threat model "doc_query payload is untrusted input
  reaching the DOM"): no findings. It confirmed both source modes gate URLs
  through the same `isUrlLike` check, the remark plugin builds citation hrefs
  only from its own regex capture group, DOM ids come from the assistant-ui
  message id plus a loop counter, every `target="_blank"` is paired with
  `rel="noopener noreferrer"`, and the pre-existing tool-error redaction
  boundary still holds because the pipeline skips `isError` parts.
  Maintainability gate (subagent, same range): one confidence-100 finding —
  the `8` in the doc_query regex duplicated `TOOL_NAME_SUFFIX_LENGTH` in
  `services/mcpClients.ts` with no shared source of truth. Verified both
  literals and the `'use server'` constraint myself before acting; fixed by
  extracting `lib/config/toolNames.ts`. Accepted its confidence-75 finding too
  (video/image/link branches of `inferSourceType` had no test — every fixture
  was a document) and its doc-only ask for a back-pointer from
  `resolveCitationSource` to `CITATION_CONTRACT`. Recorded its low-confidence
  pre-existing note in the wiki rather than changing shipped behavior:
  `withHashSuffix` truncates the combined `server_tool` string from the end,
  so a server name over ~45 chars would push `doc_query` out of the kept
  prefix and silently disable the whole feature for that server.
  Declined nothing outright; its confidence-50 note (the prompt test pins the
  literal phrase "reuse the number") was flagged for awareness only, and its
  confidence-25 fingerprint-collision note it had already ruled out itself.
  Evidence: 127/127 chat vitest (was 121; +6 new), `tsc --noEmit` exit 0,
  eslint clean on the three changed source files, prettier clean.
  Env note: pushing from the host worktree fires the husky **pre-push** hook,
  which is a host `pnpm run build` — forbidden here because host and container
  share `node_modules`. It failed on `@klicker-uzh/lti-service#build` and
  aborted the push; use `git push --no-verify` over HTTPS. The stack was
  unharmed: chat `/` returning 404 is normal (chat is chatbot-scoped), and
  `/<chatbotId>` answered 307 to login.
  Next: PR #5197 body update, then screenshots need manual attachment.
- 2026-07-26 Post-ready round (S8–S11), user request after marking PR ready:
  automated reviews + chip wrapping + mobile-first pass + Swiss German
  orthography + mockup gap map.
  S8 Greptile triage: P2 #1 valid — root layout still used the dynamic
  bare-subpath messages import that `types/i18n.ts` exists to avoid; fixed by
  exporting `messagesByLocale` there and resolving the layout's messages from
  the same static map. P2 #2 (feedback-route Langfuse timeout) NOT applicable
  at head: the feedback route contains no Langfuse call — mirroring is
  deliberately disabled pending OTel repair (wiki "Message feedback and
  Langfuse"). Copilot review quota-blocked, nothing to triage.
  S9 chip glue, two layers, both needed: `splitCitationMarkers` strips
  spaces/tabs before a marker (newlines survive as soft breaks) AND
  `CitationChip` prefixes U+2060 WORD JOINER — an atomic inline is a legal
  UAX #14 break point even with no whitespace, so the strip alone still
  orphaned chips. 2 new unit tests + expectations updated.
  S10 responsive: document-card grid switched to
  `repeat(auto-fit, minmax(min(230px,100%),1fr))` — fewer cards stretch the
  full row, wrap only when they no longer fit, and the 100% floor prevents
  overflow under 230px (embedded). Audit found the rest already mobile-safe:
  mode switcher scrolls (`overflow-x-auto scrollbar-none`), thread paddings
  scale, the "N" circle in mobile shots is the Next.js dev-tools overlay,
  not product UI.
  S11 orthography: `withLanguageStyleContract`
  (`lib/server/languageInstructions.ts`) appended unconditionally in the chat
  route (stored prompts replace DEFAULT_PROMPT entirely, so the rule cannot
  live there — the now-redundant clause was removed from the default tutor
  prompt); phrased "when writing German" so non-German prompts are
  unaffected. 5 new tests. Model compliance UNVERIFIED (no
  UPSTREAM_OPENAI_API_KEY in this DevPod) — same boundary as the citation
  contract.
  Evidence: vitest 167/167 in-container, `tsc --noEmit` exit 0, eslint +
  prettier clean. Browser: throwaway host-run Playwright spec (deleted, never
  staged) seeded a 4-source thread with glue-case markers and shot
  1440/768/390/360 × en/de — no chip ever starts a line, no gap before
  punctuation, cards stretch on desktop and stack cleanly at 360px, no
  horizontal overflow anywhere. Recipe gotcha for reruns: select the thread
  once at desktop width, then only resize — the sidebar (and
  `chat-thread-select`) collapses below md.
  S12 gap map vs the four MAT182 mockups delivered in chat; phase-2-blocked
  items (thumbnails, transcript hover previews, durations) already tracked in
  §"Citation system — phase 2".
  Next: commit slices, push, PR body update, Greptile replies.
- 2026-07-27 improvement round (S14–S17, Opus subagents; from the S12 gap
  map): CI first — `680fee56c` anchors the display-url test regex (CodeQL
  false-positive on `startsWith('example.com')`), `1f1f9667b` excludes
  `packages/i18n/messages/**` from Sonar CPD (parallel locale catalogs read
  as duplication by construction). S14 `b5fd85929`: markdown blockquotes in
  answers restyled as amber info callouts (mockup "Merke" boxes); override
  only renders from assistant messages. S15 `3f4a7c465`: thread list shows a
  mode icon + localized label under each title (`formatModeLabel` in
  `lib/config/modes.ts`, unknown modes capitalize; 3 unit tests). S16
  `0f3805887`: branch pager fix — pager UI + `parentId` persistence already
  existed, but EditComposer bypassed the runtime edit path via
  `threadRuntime.append()`, whose public normalization collapses a null
  parentId to "last message", so root edits became new turns and the picker
  never showed. Fix routes edits through
  `messageRuntime.composer.send({ startRun: true })` (startRun forces the
  vendor change gate that cannot see kept-original attachments; app-side
  canSubmit is the real gate). Verified in browser: edit → 2/2 pager,
  prev/next switches, survives reload; vitest 170/170, tsc clean. Note: the
  worktree DB lost its seed (OOM-reap earlier) — re-seeded via
  `prisma db push --force-reset` + `seed:test` in-container. S17 `9378fbee9`:
  "Image analyzed"/"Bild analysiert" chip on replies to image-bearing turns —
  pure `parentMessageHasImageAttachment` over the chatStore message list (the
  runtime-converted message hides `imageAttachments` in `metadata.custom`),
  chip styled like the doc-query tool chips, no server changes; vitest
  175/175, browser-verified both locales against a DB-seeded image thread.
  Environment notes for reruns: `docker exec` psql seeding needs `-i` (a
  heredoc without it silently executes nothing); the chat app can crash with
  Turbopack EMFILE ("Too many open files") — kill `turbo run dev` in-container
  and re-run `devrouter ensure` from the WORKTREE directory (a `devrouter
  ensure/exec .` from the primary checkout hits the primary's stack, and the
  shared-devnet `postgres` alias collision means its post-create can reset
  this worktree's DB); `seed:assessment-course` currently fails upstream
  (P2025 in `packages/util` `recomputeDerivedPermissions`), which makes any
  full post-create lifecycle fail — `seed:test` alone suffices for chat work.
  Next: S18 round verify, review, push, PR update.
- 2026-07-27 S18 finish: Opus round review over `68edbd13d..5c097b95e` — one
  actionable finding (edit-branch fix lacked automated coverage) fixed by
  `7deb4d09f` (un-skipped the root-edit branching spec as a regression guard +
  chip assertion in the stored-attachment spec; both pass host-run, 2/2).
  Vitest 175/175 at head. `acc424981` prettier-fixes the spec (CI
  check-format caught the `--no-verify` commit). Pushed; PR body updated to
  cover the whole branch at `acc424981`. Host-run Playwright gotcha
  confirmed: node-postgres cannot cross the SNI route — socat TCP proxy into
  the compose network, then plain `DATABASE_URL` against 127.0.0.1.
  Remaining work handed off:
  [2026-07-27-student-chat-v3-follow-up-roadmap.md](./2026-07-27-student-chat-v3-follow-up-roadmap.md).
