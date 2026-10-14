# Course Chat Citation Page Display and Ingestion Version Reconciliation

- Date: 2026-09-14
- Status: draft for approval; planning-stage specialist pass blocked by an account usage limit (see Planning stage)
- Plan branch: `rs/chat-citation-page-ranges` targeting `v3-audit` (the staging integration line)
- Plan worktree: `trees/chat-citation-page-ranges`
- Related prior art: [Course Chat Citation Reliability Roadmap](2026-08-31-chat-citation-reliability-roadmap.md) (unmerged, absent from `v3`, `v3-ai` and `v3-audit`; this plan does not change it)
- Ground truth: [Chat Platform](../docs/chat-platform.md), [ADR 0004](../docs/adr/0004-chat-citations-from-tool-call-parts.md)

## Approval summary

The staging Financial Economics chatbot answers with citations such as `[1, p. 6–7]`. The chat UI recognizes only `[n]` and `[n–m]`, so that marker stays literal text and the answer shows no citation chip at all. The source card below the answer shows a single page (`p. 6`) although the retrieval payload already carries 20 chunks spanning pages 6 to 89. Lecturer personas in staging ask for `Titel, S. 8–18`-style citations; the platform prompt overrides that instruction in prose, but the UI parser never accepted the result.

This plan makes the UI tolerate a labelled page detail inside a marker, so the chip renders as a plain number and existing and historical messages stop showing dead bracket text. It derives a real page range from the retrieved chunks of each source and shows it on the source card, its tooltip, and its navigation anchor. A second, parked package would fix an ingestion version-fence defect that rejected one re-ingestion attempt during the earlier staging repair.

Unchanged: citation numbering, source ordering and dedupe, the per-message registry, the card's navigation contract, the tool-fallback chunk view, every historical message payload, and the lecturer personas themselves.

Decision to weigh: the tolerant parser accepts a labelled page detail only, so `[1, p. 6–7]`, `[1, pp. 10–12]` and `[1, S. 8-18]` become chips while `[1, 2]`, `[1, 6–7]` and every other bracket list stay literal. The measured reason is in Verified problem evidence. Anything still unrecognized keeps rendering as plain text, exactly as today.

Done means: unit tests cover each changed rule, local browser captures show a page-range card with page-free chips, and after the user merges and staging redeploys the Financial Economics thread shows a chip where the dead text is today.

Approval now requests: the plan itself, the local commits, the branch push, and a draft pull request. Withheld: merge, deployment, the staging persona edit, every production change, and force pushes.

## Execution details

### Scope

- **Execution owner and model:** the main session acts as orchestrator and pushes slices to executors, keeping the marker grammar and page-semantics decisions.
- **Boundary owner:** `self`.
- **Authority granted:** this plan file, slice commits, ordinary non-force push of `rs/chat-citation-page-ranges`, draft PR creation and updates, the local runtime for verification, and browser captures.
- **Authority withheld:** merge into `v3-audit` (a user action), staging or production deployment, any write to the staging chatbot personas or other course data, PRD changes, protected or force pushes, and branch or worktree cleanup.
- **Terminal:** Package A is integrated on `rs/chat-citation-page-ranges` with green chat checks, browser evidence, and a draft PR; merged-result verification then waits on the user's merge and staging redeploy. Package B stays parked unless the user extends the approval.
- **Pause:** a pause is required if a capture shows the range displacing a single page, if the parser change would rewrite text that is already unwrapped on reload of historical threads in a way the tests do not predict, or if staging acceptance on the merged revision fails.

### Verified problem evidence

**1. Marker grammar mismatch, the visible defect.**

- `apps/chat/src/lib/markdown/remarkCitationMarkers.ts` matches only `\[\d{1,2}\]` and `\[\d{1,2}[ \t]*[–—][ \t]*\d{1,2}\]`; the exec regex has the same shape. A page detail after a comma never matches, so no link node and no `CitationChip` is produced.
- The live assistant message `6c1431a4-a981-4379-b09c-7649c792ce12` in thread `dec42332-262f-49d0-bddb-f56f198b5213` contains both `[1, p. 6–7]`, which is dead text, and `[1]`, which renders a chip.
- The chatbot `FinEco Tutor` (`27c3f981-f4f6-4c03-9723-9cb495255bc1`) carries an explicit `CITATION FORMATTING` block in its persona: `BAD: filename.pdf, S. 8-18`, `GOOD: Vorlesung 5 – Risk Measures, S. 8–18`, and `Always include the page numbers when available`. The model therefore writes a number and a page together, and the marker is where it puts them. This is systemic: 16 staging chatbots embed citation guidance, and `packages/prisma-data/src/data/data/tutorMode.txt` and `explainerMode.txt` carry the same instruction for seeded bots.

**2. Measured false-positive risk for a tolerant parser.**

- Across 118,090 staging chat messages, the multi-item bracket form is dominated by math coordinates: `[0, 1]` (1,168), `[0, 2]` (514), `[0, 3]`, `[2, 3]`, `[0, b]`, `[0, \pi]`, `[1, 2, 3]`, `[10, 20, 30, 40, 50]`. Unlabeled ranges such as `[8, 12]` and `[0, 60]` appear in the same family.
- No staging marker uses a labelled page form yet, because the suffix writes it in prose. The labelled form is therefore both the form the model actually emits and the only one that cannot collide with mathematics.
- Decision: accept a labelled page detail only. This is a measured exclusion, not a preference.

**3. Page range is available and currently discarded.**

- The `KB_doc_query` result in that message reports one `documents`-mode source with `chunk_count` 20 and chunk pages `[6,12,7,13,17,15,84,17,7,83,18,10,37,63,87,30,85,63,87,89]`.
- Each chunk carries `chunk_id`, `content`, `page_number` and `labeled_page_number`, mirrored by `DocQueryChunk` in `apps/chat/src/lib/sources/docQueryResult.ts`.
- `apps/chat/src/lib/sources/normalizeSources.ts` reads only `rawChunks[0]` through `getFirstChunk`, so the card, its tooltip, the dedupe key and the `#page=` anchor all see the first chunk page only.
- That key set is the whole payload contract. There is no relevance score, no rank, and no per-chunk citation eligibility, so a min to max page union over the chunks is a lossless summary of what the UI already receives. The example above yields `6–89`.
- This range is a retrieval envelope over the returned chunks, not a contiguous cited passage. Copy on the card must not imply that every page inside the range was used.

**4. Ingestion version fence, Package B.**

- The ingestion API refuses a resource version at or below `max(desired_resource_version, deletion_fence)` with `409 invalid_version` and "The resource version must increase monotonically." (`modules/ingestion-api/src/ingestion_api/state.py`).
- Klicker claims `resource.resourceVersion + 1` without reconciling the service's desired version. `packages/hatchet/src/kbIngestionApi.ts` exposes `acceptResource`, `deleteResource` and `getOperation` only, so the worker cannot read the service's current version before claiming.
- Live history for the affected resource shows an external failure at version 6 with no matching `KBIngestionRun` row, and a Klicker-side `DISPATCH_REJECTED` at Klicker version 4. The two version histories have drifted; one environment attempted a version Klicker never recorded.
- The service already offers `GET /v1/resources/{external_resource_id}?project=`.

### Approach

The UI owns page display for the source cards, and the marker owns only the citation number. A marker may carry a labelled page detail that the UI drops; cards gain a range computed from every retrieved chunk of that source.

Marker grammar for slice 1: a marker is a bracketed number or contiguous number range, optionally followed by a comma and a labelled page detail. The detail is a page label from a fixed set, that is `p.`, `pp.`, `p`, `pp`, `page`, `pages`, `S.`, `S`, `s.`, `s`, `Seite`, `Seiten`, `Kap.` or `Kapitel`, followed by either a plain number or a numeric range using the dash variants already accepted (`-`, `–`, `—`). A bare number or numeric range with no label is not a page detail. The chip label remains the citation number alone.

Page semantics for slice 2: `page` keeps its meaning as the navigation anchor and becomes the lowest physical page across the source's chunks; `pageEnd` is the highest physical page and is set only when it exceeds `page`. Refined during slice 2: `labeledPage` becomes the lowest integer label across the chunks — not the first chunk's label — because a range must describe the whole envelope, and the first chunk is ordered by relevance rather than by page; `labeledPageEnd` is set only when every chunk label is a plain integer and the extremes differ. A label set that is not all-numeric keeps the first label alone, exactly as before. Display prefers a labeled range, then a physical range, then today's single-page fallbacks (a single physical page is still never displayed as a label). Navigation keeps using the lowest retrieved page, so `#page=` stays anchored at the start of the retrieved material.

**Superseded on 2026-09-17.** A cited source card no longer shows the retrieved envelope. `extractCitedPages` (`apps/chat/src/lib/markdown/remarkCitationMarkers.ts`) reads the labelled page detail the answer itself carries, and `formatCitedPageRanges` (`apps/chat/src/lib/sources/sourceDisplay.ts`) renders only the smallest ranges covering exactly those pages: an answer citing pages 6 and 7 shows `S. 6–7`, not the `2–95` span of every chunk retrieval happened to return. `getPageEnvelope` keeps its derivation for navigation, and the published span no longer reaches a card at all. **Narrowed again on 2026-09-20.** `getSourcePageRange` shows a page only when the answer named one or when every retrieved chunk agreed on one publisher label, so a citing answer without a page detail shows a single label or no line instead of the spread; the compact `SourceRow` of the embedded and narrow layouts now receives `citedPageRanges` exactly as the card grid does. `page`, `pageEnd` and the `#page=` anchor still use the lowest retrieved page. See [Chat Platform](../docs/chat-platform.md). The envelope semantics above are kept for the record.

### Slices

**Slice 1 — tolerant citation markers.**

- Scope: `apps/chat/src/lib/markdown/remarkCitationMarkers.ts`, `apps/chat/test/citation-markers.test.ts`, one clarifying sentence in `apps/chat/src/prompts/citation-contract.hbs` stating that the marker carries only the number while page, title and URL belong to the application's source cards, and the matching sentence in `docs/chat-platform.md`.
- Acceptance: `pnpm --filter @klicker-uzh/chat test:run` green, with new cases proving `[1, p. 6–7]`, `[1, pp. 10-12]`, `[1, S. 8—18]`, `[1, Kapitel 7]` and `[2–4, S. 10–12]` become chip links carrying only the index, while `[0, 1]`, `[1, 2]`, `[2, ]`, `[0, \pi]`, `[1, 2, 3]`, `[1, 6–7]`, a descending range, a range wider than the source cap, an unterminated `[1, p. 6` and a marker inside a real link keep today's literal behaviour.
- Commit: `fix(chat): accept labelled page detail inside citation markers`.

**Slice 2 — page ranges on source cards.**

- Scope: `apps/chat/src/lib/sources/types.ts`, `normalizeSources.ts`, `sourceDisplay.ts`, their tests, and the range semantics paragraph in `docs/chat-platform.md`.
- Acceptance: chat tests green with new cases for a multi-chunk document source, a single-page source that still renders one page, a labeled numeric range, a non-numeric label that stays single, and a source whose extremes tie; the existing tool-fallback chunk tests stay green untouched.
- Commit: `fix(chat): show retrieved page ranges on source cards`.

**Slice 3 — local end-to-end verification.**

- Scope: extend the synthetic provider `apps/chat/scripts/local-mcp-server.mjs` so its deterministic document returns two chunks on consecutive pages, then drive the documented local path in the chat app with `$rs-build-screenshot-gallery`.
- Acceptance: before and after captures of one answer showing a page-free citation chip and a ranged source card, plus the card's click target and the tooltip line; the local check uses the repository's documented `devrouter ensure . --profile chat,ai,mcp` path.
- Commit: `test(chat): give the local citation fixture a page range`, with the screenshots carried in the pull request description rather than the repository.

### ADR gate and documentation

No new ADR. ADR 0004 already owns the decision that citations derive from `doc_query` tool-call parts; this plan changes rendering detail inside that decision, not the decision. The ADR gate re-arms if the marker grammar becomes a model-facing contract with its own versioning, or if page semantics move server-side. `docs/chat-platform.md` does need the two sentence-level updates named in the slices, because it currently documents the marker grammar as `[n]` and `[n–m]` only.

### Test portfolio

| Behaviour at risk | Existing evidence | Obligation | Seam | Slice |
| --- | --- | --- | --- | --- |
| A marker with a labelled page detail renders a chip | none | new cases | `test/citation-markers.test.ts` | 1 |
| Math and bracket lists stay literal | partially, via no-match cases | new regression cases | same file | 1 |
| Page range derived from all chunks | first-chunk only | new cases | `test/normalize-sources.test.ts` | 2 |
| Range display, single page, fallbacks | single page | extended cases | `test/source-display.test.ts` | 2 |
| Tool-fallback chunk pages unchanged | present | keep green | `test/doc-query-result.test.ts` | 2 |

### Verification

- Static: `pnpm --filter @klicker-uzh/chat test:run`, then the repository's `pnpm run check:all`.
- Local runtime: one chat turn through the synthetic `doc_query` provider, checked in the browser for the chip, the card range, the tooltip and the card link.
- Staging: after the user merges and staging redeploys, the same Financial Economics thread must show a chip where `[1, p. 6–7]` is today and a ranged card. This is a user-gated acceptance step.

### Planning stage

The planning-stage specialist pass is **blocked, not skipped**. A read-only `planner` child was dispatched on this frozen draft and terminated immediately with an account usage limit ("You've hit your usage limit ... try again at Sep 20th, 2026 10:36 AM"). Per the routing continuity rules that is a capability blocker on this client, not a plan approval. Two consequences are recorded rather than hidden:

- This draft has not had an independent adversarial pass. The first action when capacity returns is to run that pass on this exact draft and record the verdict here.
- The two riskiest claims were instead checked directly against staging data rather than left as opinion: the marker grammar against 118,090 real messages, and the page-range source against a real retrieval payload.

### Working context

- The primary checkout is a dirty control checkout on `v3`; leave its unrelated changes alone. All work happens in `trees/chat-citation-page-ranges`.
- `origin/v3` and `origin/v3-audit` differ widely across chat files, so work is based on `origin/v3-audit` at `cb1599d9a5`, the staging integration line.
- Marker and page grammar live in one place per layer. The persisted-payload reader and the live reader must not drift.
- Values-free throughout: no course text, no production payloads, and no secrets in commits, tests, captures or the pull request.

## Package B — ingestion version reconciliation (parked)

Real work with a live failure behind it, and not part of the citation change. It needs its own branch, pull request, review and evidence. Its contract: add a bounded `getResource` read to the Klicker ingestion client, reconcile the claimed version against the service's desired version before claiming, and record the reconciled version on the ingestion run. Acceptance is a re-ingestion of one already-ingested resource that succeeds on the first attempt without a manual version bump, plus both version histories agreeing afterwards.

It stays parked because it changes a cross-service protocol and because the citation work is what the staging demo needs.

## Follow-ups deliberately outside this plan

- The staging personas still ask for `Titel, S. 8–18`-style citations. They are course data, not source, so changing them is a separate gated edit. The platform contract overrides them, the UI now tolerates them, and no model emission depends on the fix.
- `apps/backend-docker/Dockerfile` copies `packages/doc-query-client/dist` twice, at lines 55 and 57. Harmless, unrelated, and best folded into whatever next touches that file.
- The citation reliability roadmap remains unmerged and unmodified.
- The shared renderer keeps an older marker grammar. `packages/util/src/citations.ts` carries its own
  `splitCitationMarkers`/`remarkCitationMarkers`, re-exported by `packages/markdown/src/citations.ts`, and it
  accepts a plain `[n]` only: both `[2–4]` and `[1, p. 6–7]` stay literal there. Measured during slice 3
  with one render test against the shared `Markdown` component and `withCitationLinks`: `A supported statement
  [1, p. 6–7].` renders as untouched text. Chat answers do not use that module — `apps/chat/src/components/markdown-text.tsx`
  registers the chat-local parser — so the gap belongs to the one surface that does,
  `apps/frontend-manage/src/components/resources/chatbots/ChatbotResponseExampleReview.tsx`, which renders saved
  response examples for lecturers. Aligning the two grammars is a separate change on the manage surface, and it
  would also make ranges visible there for the first time, which is a behaviour change for lecturers. It stays out
  of this plan.

## Progress

- Status: Package A delivered as draft PR #6045 (head `4170c2bf30`). Slices 1-3 are committed, local
  browser verification passed at the integrated head, and the branch is pushed. See the delivery record
  below for the base integration, the evidence refresh and the one inherited check failure.
- Completed: investigation, plan approval, staging measurements, slice 1 (tolerant markers, 22 new cases),
  slice 2 (page envelope on cards and tooltips, 18 new cases), slice 3 (fixture page range plus local browser
  verification), `pnpm run check:all` (44/44 tasks) and the chat suite (1332 passed | 33 skipped).
- Commits on `rs/chat-citation-page-ranges`: `c2c8a80882`, `158bab1544`, `ed31ee997f`, `55bab1f035`, plus the
  delivery commit that records this update.
- Local verification (2026-09-15, revision 55bab1f035, devrouter profile `chat,ai,mcp` with synthetic fixtures):
  the doc_query tool call returned `KLICKER_LOCAL_MCP_OK`; the source card and its tooltip showed `p. 1-2`
  derived from both retrieved chunks; a reload kept the tool result, the answer, the chip and the card; and a
  page-labelled marker `[1, p. 1-2]` rendered a citation chip instead of literal marker text.
- Verification gaps: the synthetic fixture returns no source URL, so the `#page=1` anchor is covered by unit
  tests only; the live model refuses the labelled form because its citation contract asks for number-only
  markers, so the labelled marker was exercised with one locally seeded synthetic message; only the English
  locale was captured.
- Environment: the earlier session blockers (unwritable git index, escalation rejections, the half-built
  runtime) are resolved. The local stack resolves `postgres` to the `mcp_postgres` fixture database, so the
  reachable local chatbot is `Local MCP Tutor` (`c84f1a72-6e35-4d9b-a0c8-2f7e5b3d1a96`); the seeded Benibot id
  404s there by design, which is what looked like a broken chatbot during the first verification attempt.
- Required gates: the planning-stage planner pass and the specialist reviews remain unavailable until capacity
  returns (account usage limit). Slices were verified by tests, diff inspection and browser evidence instead;
  this plan records that gap rather than claiming a review.
- Delivery layer: source commits, branch push and draft pull request. Merge, deployment, the staging persona
  edit and Package B stay withheld.
- Remaining: the user's merge, then staging acceptance on the merged revision, where the Financial Economics
  thread must show a chip where `[1, p. 6-7]` is today and a ranged source card.
- Next action: hand over for merge; after the staging redeploy, recheck that thread.

## Delivery record (2026-09-15)

- Draft pull request: https://github.com/uzh-bf/klicker-uzh/pull/6045, base `v3-audit`, head
  `rs/chat-citation-page-ranges` at `4170c2bf30`. Merge-commit convention; not squashed.
- Base integration: `origin/v3-audit` moved twice during delivery and was merged both times. The first
  merge brought the logging PRs (`1b368fb255` and its parents), whose trees had temporarily older chat
  content; the second brought `408e1e44d8` ("synchronize latest v3-ai into v3-audit"), which restored it.
  The branch therefore matches the base for every file it does not own: `apps/chat/src/components/tool-fallback.tsx`
  has no diff against `origin/v3-audit`, and `normalizeSources.ts` still exports `countDocQueryDocuments`
  and `parseDocQueryPayload`. The branch delta against the base is exactly the eleven files named in the
  slice commits plus this plan.
- Automated review (OpenCodeReview, run 34960296041) raised three findings, all inside the new code and all
  fixed at `4170c2bf30`: the marker regex accepted a bare comma such as `[1,]` and silently ate it; the page
  envelope spread an unbounded chunk array into `Math.min`/`Math.max`; and the chunk-shape guard was duplicated.
  The fixes make the page label mandatory inside the optional detail group, replace the two spreads with single-pass
  loops, and share one `isChunkRecord` guard.
- Automated review round 2 (OpenCodeReview, run 34963072999, head `4170c2bf30`) raised three further findings.
  Two were accepted and fixed at `bff07373c4`: the regex never accepted the bare `S`/`s` label that this plan's
  approved grammar lists, so `[1, S 8]` stayed literal while `[1, p 8]` became a chip, and the alternative now
  carries `s` with two cases covering it; and `labels[lowestIndex] ?? labels[0]` in `getPageEnvelope` was
  unreachable because `numberedLabels` already proves a non-empty, all-finite label set, so the fallback is gone.
  The third finding is not adopted: it asks that the start label always come from the lowest-page chunk, but the
  page semantics above deliberately take `labeledPage` as the lowest integer label across the chunks so the label
  interval describes the retrieved envelope. `page` is a physical-page anchor in a different coordinate system
  (a label may be `Kapitel IV`), so binding the two would drop or invert the label range it exists to express.
  Verified after the fixes: chat suite 1357 passed | 33 skipped, and `pnpm exec tsc --noEmit -p apps/chat/tsconfig.json`
  exits 0.
- Re-verification at the integrated head `4170c2bf30`: chat suite 1355 passed | 33 skipped (the three bare-comma
  regressions included); browser run against the rebuilt local stack confirmed the citation chip and a source card
  reading "Source 1: Portfolio diversification / p. 1-2". A DOM read at that head shows the marker paragraph ending
  in the chip (`<sup>` carrying one anchor to `#src-...-1`) and the source card labelled `p. 1-2`.
- Evidence refresh: all eight captures were retaken at `4170c2bf30` and published as PR attachments; the receipt
  is `project/_local/chat-citation-page-ranges-gallery/uploads.json`. The cited-answer frame was recaptured as a
  close-up of the cited message, because the first refresh had reused the thread-overview frame byte for byte.
  The synthetic labelled-marker row used for one capture was inserted into the local `klicker_test` fixture
  database and deleted again; the thread holds only its six real messages.
- Inherited check failure, not ours: `pnpm run check:server-console` exits 1 on three pre-existing calls in
  `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` (lines 1288, 1432) and
  `packages/graphql/src/services/knowledge.ts` (line 1074). None of those files is touched by this branch; the
  check arrived with the logging PRs on `v3-audit` and is absent from `.github/workflows/check.yml`. The other
  twelve `check:all` tasks pass individually.
- Local runtime: the base merge left the running dev stack unable to resolve the new `@klicker-uzh/logging`
  package, so the chat, PWA and API processes returned 500. Repair was a container-native `pnpm install`, a
  cleared `apps/*/.next` build cache and a `touch apps/backend-docker/dist/index.js` to restart nodemon.
  `devrouter ensure` still cannot reconcile this workspace because `rs-ai-entitlements` holds azurite's fixed
  host port 127.0.0.1:10003. After the last runtime-dependent check the stack was released with
  `devrouter stop .`, which stopped DevPod `rs-chat-citation-page-ranges` and freed its four routes; the worktree
  and runtime data are intact, and `devrouter ensure .` starts it again when the next browser check needs it.
- Third base integration: `origin/v3-audit` advanced again during review and was merged as `d5ac249b78`. The
  only conflict was `apps/chat/scripts/local-mcp-server.mjs`: the base had extracted the document-to-source
  mapping into `apps/chat/scripts/local-mcp-documents.mjs` with a single-chunk mapper and its own
  `apps/chat/test/local-mcp-documents.test.mjs` pinning that shape. The refactor is kept and the slice-3
  capability moved into the helper: a document with `continuation` text now emits a second chunk one page later
  with `labeled_page_number` on both chunks, and a document without it still emits exactly one chunk as the base
  test requires. `validateDocument` passes an optional bounded `continuation` string through so the file-backed
  fixture can exercise the same path as the in-process one. A focused case in the base test file covers the
  two-chunk range. Verified at `d5ac249b78`: chat suite 1387 passed | 33 skipped and
  `pnpm exec tsc --noEmit -p apps/chat/tsconfig.json` exits 0.
- Merge-head re-verification: the local stack could not be restarted for a second browser run because
  `devrouter ensure` refuses to start while the `rs-custom-chat-modes` workspace holds azurite's fixed host port
  `127.0.0.1:10003`, and stopping another workspace is out of scope here. The merged fixture was therefore
  re-checked directly instead of through the browser: the real `SYNTHETIC_DOCUMENTS` from the merged
  `local-mcp-server.mjs`, mapped through the merged helper, yield two chunks per document labelled `1` and `2`
  (physical pages 1 and 2). The rendered path is unchanged since the last browser run at `4170c2bf30` apart from
  the marker-regex widening and a removed unreachable fallback, both covered by unit cases.

## Progress record (superseded, 2026-09-14)

- Status: approved and executing. Slices 1 and 2 implemented and green; slice 3 blocked on the local runtime.
- Active slice: 3, blocked (see Blockers).
- Completed: investigation, plan draft, user approval, staging measurements for both slices, slice 1 (tolerant markers, 22 new cases), slice 2 (page envelope on cards and tooltips, 18 new cases), full chat suite green after both slices (1332 passed | 33 skipped).
- Remaining: slice 3 local browser verification with captures, `pnpm run check:all` on the host path, the two slice commits, branch push, draft pull request.
- Latest verified commit: none of the two slices is committed yet; both are verified by the chat suite, the type check and diff inspection.
- Required gates: planner pass (armed and blocked by the account usage limit), simplifier per substantive slice, final review at package level. All three specialist routes are unavailable until capacity returns, so slices 1 and 2 were verified by direct tests and diff inspection instead; the plan records that gap rather than claiming a review.
- Host environment note: homebrew `node` 26.8.1 is first on `PATH` on this host and hangs the workflow validator that `check:playwright-ci` runs (a heredoc-executed `node` never returns), so the repository's pre-commit `check:all` failed on that task for every commit. The task passes in 2.5 seconds with the repository-pinned node 24 first on `PATH`. No source change is needed for this; the container-backed hook path runs the pinned toolchain.
- Delivery layer: source changes only so far. Merge and deployment are the user's.
- Blockers, verified again on 2026-09-14 (third consecutive goal turn):
  - Git is unwritable from this session: `git add` still fails with `index.lock: Operation not permitted`, and the
    sandbox protects `.git` even though the worktree sits inside the writable root.
  - Every escalated command is rejected by the approval reviewer with HTTP 412, because its own provider account
    (`rolandschlaefli-34c0ed`) is suspended for billing at fireworks.ai. That closes the only route to an
    unsandboxed `git`, `devrouter` or Infisical command.
  - The local runtime is half-built and unreachable. `docker ps` works inside the sandbox, and it shows the
    workspace's `app`, `litellm`, `redis_*`, `azurite` and `mcp_postgres` containers up, while `postgres` and
    `hatchet` exited with code 1 after an interrupted `ensure` shut Postgres down (`pg_ctl: server does not shut
    down`). Traefik answers 404 for `chat.klicker.rs-chat-citation-page-ranges.localhost` and lists no HTTP router
    for the workspace, so no browser can reach the app. `devrouter ensure` now fails with "Could not prove
    lifecycle worker incarnation", because the sandbox denies `ps`; the earlier queued repair exited with
    "Repair requires a persisted degraded managed runtime", and devrouter's own state file still reads
    `phase: recovering`.
  - Consequence: the three remaining deliverables — the slice commits, the branch push with its draft pull request,
    and slice 3's browser captures — cannot be produced from this session. The tree is intact, and everything that
    can be checked without an unsandboxed command is green.
- Checks on the current tree: `check:lint`, `check:syncpack`, `check:agents-md`, `check:git-identity`,
  `check:git-hooks`, `check:removed-doc-artifacts`, `check:prisma-sync`, `check:playwright-ci`,
  `check:playwright-host` and `check:local-kb` all exit 0, plus the chat suite (1332 passed | 33 skipped), the
  chat type check, the markdown package suite (48 passed), Biome on the eight changed code files and Prettier on
  both changed documents. Only `check:format` remains unprovable here, because `lint-staged` needs to write the git
  index; its two underlying checks were run directly instead.

### Delivery recipe (needs an unsandboxed shell)

Run from `trees/chat-citation-page-ranges` with the repository's pinned Node 24 first on `PATH` and
`KLICKER_GIT_HOOK_RUNTIME=host`, because homebrew's Node 26 hangs the `check:playwright-ci` validator the
pre-commit hook runs:

```bash
export PATH="/Users/rschlae/.volta/tools/image/node/24.17.0/bin:$PATH"
export KLICKER_GIT_HOOK_RUNTIME=host
git commit -m "fix(chat): accept labelled page detail inside citation markers"   # slice 1 is already staged
git add apps/chat/src/lib/sources apps/chat/test/normalize-sources.test.ts apps/chat/test/source-display.test.ts docs/chat-platform.md
git commit -m "fix(chat): show retrieved page ranges on source cards"            # slice 2
git add apps/chat/scripts/local-mcp-server.mjs
git commit -m "test(chat): give the local citation fixture a page range"         # slice 3
git add docs/project/2026-09-14-chat-citation-page-ranges-plan.md
git commit -m "docs(chat): record citation page plan progress"
pnpm run check:all
git push -u origin rs/chat-citation-page-ranges
```

Then the draft pull request with the inline screenshot table, and slice 3's local browser run
(`devrouter ensure . --profile chat,ai,mcp` with the runtime repaired first).

- Next action: once the reviewer account is restored or an unsandboxed shell runs the recipe, pick up at the push,
  then finish slice 3's browser verification.
