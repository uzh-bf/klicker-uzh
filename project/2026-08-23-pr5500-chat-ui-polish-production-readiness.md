# Production readiness — PR #5500 enhance(chat): polish conversation controls and sources

Audit invoked manually via `$rs-production-readiness` on 2026-08-23. Scope: branch `feat/chat-ui-polish`, head `8e184d149c0051bb24f35de049c02328e5bd6fa2`, base v3 (merge-base `ee5712399f`). Working material: `project/_local/reviews/2026-08-23-pr5500-chat-ui-polish-readiness-brief.md` (+ CI log excerpts under the session scratchpad).

## Verdict

**ready-with-conditions.**

No confirmed product blocker: all four deduplicated CI failure candidates verified as **test-side defects or pre-existing flakes**; the product code paths (cancel/abort, Radix dropdown wiring, composer layout, source reveal) traced clean end-to-end through app and vendored sources, data safety is unchanged (zero schema/storage/PII deltas), rollback is a trivial frontend revert, and config/secrets surface adds nothing. However, the PR **cannot merge today**: `test-playwright-status` is a required status context and is red at head, and the three Y-chat failures are real defects in this PR's own new test coverage (its stated purpose). Conditions below are mandatory before merge.

Conditions:
1. Fix the stop-cancel test harness (make the fetch mock honor `init.signal`; delete the post-cancel stream-release in the test) — Finding R1.
2. Fix the dropdown keyboard test (add `data-highlighted` settle-waits between keypresses) — Finding R2.
3. Fix the mobile-overlap test (instant scroll at measurement; assert scroll-container-relative geometry instead of cross-clip bounding-box comparison; reconcile the assertion with the documented heading-only reveal contract) — Finding R3.
4. Complete the plan record's pending manual verification (`project/plans_wip/PLAN-chat-ui-polish.md:73-76` still disclaims a running Chat stack; the audit proved the stack runnable) — Finding M6.
5. Re-run CI to green on the fixed head.

## Prior gates

| gate | artifact | status |
| --- | --- | --- |
| `$code-review` | — | missing |
| `$thermo-nuclear-code-quality-review` | — | missing |
| `$security-review` | — | missing |
| per-slice reviews | — | missing |
| `-combined-final` | — | missing |

No standing-gate artifact exists for this scope in `project/_local/reviews/` (only an unrelated PR #5323 brief). Missing applicable artifacts are recorded as observations; their lenses belong to their owning gates, not this audit. Specialized gates whose surfaces this diff does not trigger (migration/deploy-infra reviews, backend security) are not applicable.

## Findings

Verification legend: wave-two verifier verdicts on deduplicated candidates. Non-candidate findings enter as unverified per protocol.

| severity | dimension | finding | evidence | proposed action | verification |
| --- | --- | --- | --- | --- | --- |
| major | failure modes / deploy / docs / ux | **R1 — Stop-cancel CI failure is test-side**: the e2e mock replaces `window.fetch` and never references `init.signal`, so `abort()` cannot interrupt the mocked stream; worse, the test releases the paused stream after cancelling, forcing normal completion ⇒ announcer correctly says "Answer complete." | `playwright/util/chat.ts:470` (`window.fetch = async (input, init) => {` — zero `signal` references); `Y-chat.spec.ts:613-620` (Enter then `__releaseMockChatStream()`); `useChatResponse.ts:709-711` vs `:713/:775` ('stopped' only on AbortError) | Make the mock abort-aware (reject parked pull + error controller on abort); delete the release block in the test. Optional hardening: record 'stopped' when `signal.aborted` even if `finish` arrived | **confirmed** (static causal chain reproduces the exact CI output) |
| major | failure modes / docs / ux | **R2 — Mode-dropdown keyboard CI failure is a test-timing race**: Radix Select 2.2.6 defers highlight via `setTimeout(focusFirst)` after ArrowDown; the test presses Enter back-to-back, hitting the still-focused checked item (Tutor is both first and checked in seed order) and re-committing it | vendored `dist/index.mjs:479-497` (`setTimeout(() => focusFirst(candidateNodes))`), `:883-888` (SELECTION_KEYS→handleSelect), `:334-338` (positioned auto-focus of checked item); `Y-chat.spec.ts:1661-1663` (no sync between presses); wiring correct: `mode-switcher.tsx:52-55`, `settingsStore.ts:127` | Add settle-waits: assert `data-highlighted=""` on Tutor after open, then on Explainer after ArrowDown, then Enter. Upstream 2.3.7 has identical logic — no version escape hatch | **confirmed** |
| major | ux / performance / deploy | **R3 — Mobile-overlap CI failure measures mid-animation across a clip boundary and asserts a contract the design replaced**: viewport carries `scroll-smooth`; the test sets `scrollTop` and reads `boundingBox()` immediately (no settle); Playwright rects don't apply ancestor clipping; the composer is an in-flow flex sibling outside the scroller, so visual overlap is geometrically impossible. Also: `playwright.config.ts:48-51` comment claims CSS animations are disabled but passes only `--lang=en-US` | `Y-chat.spec.ts:2829-2846`; `thread.tsx:305,309,337` (`scroll-smooth … overflow-y-scroll` scroller; `'relative shrink-0 …'` sibling); `sources-section.tsx:153-161` (heading-only reveal by design); config comment-vs-reality | Instant-scroll at measurement + assert against viewport fold instead of composer box; align the assertion with the documented reveal contract (product/QA consciously accept heading-only reveal); implement or remove the config comment's promise (`reducedMotion: 'reduce'` would also have prevented this) | **confirmed** ((a) smooth-scroll timing proven available & unmitigated, likely operative; (b) clip-boundary premises true, decisive role inferred — separating them needs the retained CI trace/video, not fetched) |
| major (pre-existing) | failure modes (shard 8) | **Shard-8 batch-sharing failure is unrelated to this PR**: attempt 1 timed out on the NR element's action menu after creating both fixed-title fixture questions; retry re-created them ⇒ strict-mode violation on duplicate `MC Title Test 2 (Version 1)` | `MA-elements-operations.spec.ts:1955-1976` (fixed titles from `fixtures/questions.json:100`); `util/fixtures/elements.ts:441-495` (bare create, no guard); shard8 log lines 270-272/305-307 quoted in verifier report; PR diff clean of manage-app and this spec | Handoff to e2e-stability owners: unique titles per retry or delete-before-create; separately investigate attempt-1's NR click timeout | **confirmed** (spec last touched by merged #5423; mechanism fully established intra-run) |
| minor | failure modes | Embedded participants get no recovery affordance once `autoScroll={isRunning}` disengages (standalone has ThreadScrollToBottom; embedded renders neither) | `thread.tsx:341` (`{!embedded && <ThreadScrollToBottom />}`) | Render the pill in embedded where space allows, or record accepted limitation | unverified |
| minor | failure modes / performance | Source-reveal decision snapshots `isAtBottom` once at first terminal render; can silently skip the heading reveal in edge timing; effect can also fire on history restores when bottom-anchored | `sources-section.tsx:149-151,158-161` | Read `isAtBottom` inside the layout effect; optionally suppress non-live-run reveals | unverified |
| minor | failure modes | `'incomplete'` arm of `showSources` is unreachable under the external-store adapter (converter hard-codes the error slot); failed-tool turns degrade consistently (citations and sources fail together, never diverge) | `thread.tsx:1531-1534`; vendored `external-store-thread-runtime-core.js:130`; `normalizeSources.ts:118-129` | Correct the comment; no functional change | unverified |
| minor | failure modes / docs | Change entrenches reliance on assistant-ui internals (`isAtBottom`) and the adapter's cancel/resync ordering; exact-pinned today, upgrade hazard tomorrow | `sources-section.tsx:1,149`; `useChatResponse.ts:728-733` vs vendored resync `setTimeout(0)` | Add both seams to the upgrade checklist in `docs/chat-platform.md` | unverified |
| minor | data safety | `selectedMode/model/reasoningEffort` persist unscoped in localStorage `settings-storage` across sessions/chatbots on shared devices — enum-like preferences only, no PII, store untouched by this PR, revalidated per chatbot on load | `settingsStore.ts:310-317` (byte-identical at merge-base) | Backlog: per-chatbot scoping if product wants it | unverified (pre-existing) |
| minor | docs / operability | Plan record's final entry claims no running Chat stack existed; audit provisioned and served the stack — the pending manual pass would likely have caught R1–R3 locally | `project/plans_wip/PLAN-chat-ui-polish.md:73-76` | Complete the pending browser/focused-run pass and update the record before merge (**condition 4**) | unverified |
| minor | docs / operability | No runbook guidance exists for diagnosing the three new failure modes (announcer-after-cancel, Radix highlight races, boundingBox-across-clip); wiki otherwise consistent — nothing shipped inaccurate | repo-wide grep of `docs/` + skills; `AGENTS.md:260` rule satisfied for accuracy | When R1–R3 land, capture reusable lessons in `docs/solutions/test-failure/` or the traps section of `docs/chat-platform.md` | unverified |
| minor | observability | Repeating `[Langfuse SDK] TypeError: Cannot read properties of undefined (reading 'name')` (~10s cadence) crashes in vendored `@langfuse/otel` span post-processing (`span.instrumentationScope.name === "ai"` on spans lacking the field); files outside the diff; gated by `CHAT_ENABLE_AI_TELEMETRY` (declared in turbo.json, unset locally ⇒ enabled-by-default); expected keys (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASEURL`) absent from repo env files | scratchpad worker evidence (vendored chunk line quoted); `turbo.json:109`; classification corroborated independently by config + docs workers | Handoff to ops owners: either provide local keys or set `CHAT_ENABLE_AI_TELEMETRY=false` in shared dev workspaces; upstream SDK robustness issue | unverified (pre-existing) |
| minor | observability | Nothing client-side logs/traces the cancel path or mode-change events — production regressions of R1/R2's product counterparts would be invisible until users report | grep over apps/chat/src for cancel/mode tracking hooks | Add spans/events on cancel + mode commit when telemetry is next touched | unverified |
| minor | performance | Client bundle gains the `@radix-ui/react-select` positioning/select semantics (dep already pinned; internals dedupe with tooltip/assistant-ui); `useThreadViewport` adds zero new bytes; no measured delta (build not run) | `apps/chat/package.json:26` (unchanged); `mode-switcher.tsx:3` sole importer | Capture first-load-JS delta from next build stats | unverified |
| minor | performance | Y-chat growth (+382 lines) compounds an inherently serial suite (`workers: 1`, shared-participant `deleteMany` in `beforeEach`); new tests add no new anti-pattern (deterministic gated streaming, zero `waitForTimeout`) | `playwright.config.ts:14-18`; `util/chat.ts:132`; `util/chat.ts:447-543` | If shard time hurts, lever is per-worker participant IDs, not restructuring | unverified |
| minor | ux | After a run completes, composer growth (long text/attachment) doesn't re-pin an at-bottom reader to the new bottom; manual scroll needed | `thread.tsx:303` (`autoScroll={isRunning}` false post-run by design; no resize observer re-pins) | Optional polish: on composer height change, if previously at bottom, scroll to bottom once | unverified |
| minor | config | Dev `.env.*` files pin the production avatar bucket (`NEXT_PUBLIC_AVATAR_BASE_PATH` → klicker-prod) — read-only public GETs; operational coupling only. Pre-existing | `apps/chat/.env.development:3` et al. | Handoff-grade; consider dev-scoped bucket | unverified (pre-existing) |

## Not checked

Every declared coverage gap, with reasons:

- **Live UX drive on the provisioned instance** (first-run, mobile composer-overlap reproduction, keyboard dropdown on-device, citation navigation): the workspace's DevPod went down twice during the audit (mid-UX-worker, again after re-provision; `DevPod 'feat-chat-ui-polish' is not running` at close). Mitigation: CI executed the full 86-test deterministic suite at head (mouse-path selection, streamed-answer source behavior, header/composer suites green), and the static web-design-guidelines + impeccable-lens review passed clean. Residual: subjective feel, real-screen-reader behavior, and the exact mid-animation measurement remain unobserved live.
- **Live reproduction of R1–R3 locally** (planned orchestrator-owned window): blocked by the same DevPod outage; the wave-two static proofs stand without it. The retained CI trace/video artifacts (which would separate R3's cause (a) from (b) definitively) were not fetched.
- **Exact client-bundle delta**: requires running `next build`; outside read-only scope.
- **Shard-8 attempt-1 root cause** (why the NR action menu didn't appear within 15s): beyond establishing the leftover-row mechanism; owned by spec owners.
- **Langfuse env wiring end-to-end**: two successive workers hit tool-permission denials before completing; remaining evidence is the vendored crash site, key-name enumeration, and the `CHAT_ENABLE_AI_TELEMETRY` gate. The observability dimension is therefore **partially covered** — health-endpoint depth (`/api/health` coverage of upstreams) and abort-path telemetry checks are inferred from code reads only.
- **Commits landing after head `8e184d1`**: head-only audit per scope.
- **Upstream issue trackers** for known assistant-ui/Radix issues: deliberately skipped; vendored sources were decisive.

## Handoffs

Findings that belong to other gates:

- **`$code-review` / functional e2e owners**: implement fixes R1–R3 (all are edits to `playwright/util/chat.ts`, `Y-chat.spec.ts`, optionally `playwright.config.ts`). The audit's fix sketches are starting points; the owning gates own the change.
- **E2E stability owners** (pre-existing, not this PR): `MA-elements-operations.spec.ts` batch-sharing idempotency (unique titles per retry or delete-before-create) and the attempt-1 NR action-menu timeout.
- **Ops / backend observability owners**: Langfuse telemetry loop (silent tracing loss; dev-workspace noise) — decide keys-on vs flag-off; plus the missing cancel/mode-change client telemetry.
- **Accessibility gate**: Radix Select emits `aria-selected` only while an item holds DOM focus (`dist/index.mjs:851-852`), so assistive-tech announcement lags the deferred highlight; upstream-inherent (2.3.7 identical). Document as accepted or guard at app level deliberately.
- **Product/QA sign-off**: the heading-only source-reveal contract on mobile (design intent per `docs/chat-platform.md:239-243` and `sources-section.tsx` comment) should be consciously accepted, after which R3's assertion is rewritten to match design rather than vice versa.
- **Standing gates**: `$code-review`, `$thermo-nuclear-code-quality-review`, `$security-review`, and the combined-final outcome review have no artifacts for this scope; route accordingly after the test fixes land.
- **Repo hygiene**: `.agents/skills/impeccable/SKILL.md` referenced by this audit's UX lens does not exist in the repo skills directory (only global-scope skills were found) — reconcile the AGENTS.md reference or install the skill locally.
- **Workspace lifecycle**: the audit workspace's DevPod stopped twice during the audit (root cause outside this scope — possibly host resource pressure from 12+ concurrent workspaces); a courtesy `devrouter ensure` was issued at close. Worth watching if it recurs.

---

*Method/budget note: 8 dimension charters dispatched across 11 reviewer-tier xhigh agent runs (3 interrupted by tool-permission denials or turn limits and replaced with scoped finishers); 4 wave-two verifiers (stop-cancel, dropdown-keyboard, shard-8, mobile-overlap) — 15 specialist runs total within the 16 cap. One targeted single-agent chase remains unused.*
