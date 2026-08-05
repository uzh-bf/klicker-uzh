# Student Chat v3 — Final Production-Readiness Report

- **Date:** 2026-08-03
- **Scope:** the full 4-PR stack `v3...claude/chat-v3-4-polish` at head `894e3f0b9`
  ([#5248](https://github.com/uzh-bf/klicker-uzh/pull/5248) reskin →
  [#5249](https://github.com/uzh-bf/klicker-uzh/pull/5249) runtime upgrade →
  [#5250](https://github.com/uzh-bf/klicker-uzh/pull/5250) citations →
  [#5251](https://github.com/uzh-bf/klicker-uzh/pull/5251) polish); 118 files, +12 831/−1 852.
- **Method:** five independent read-only review lenses (correctness, security,
  deployment, tests/CI, documentation) run as parallel subagents over the diff,
  plus live verification against the running devcontainer stack and the full
  browser matrix recorded the same day in
  [#5251's review comment](https://github.com/uzh-bf/klicker-uzh/pull/5251#issuecomment-5168622995).
  Every P1/P2 finding below was re-verified by the orchestrating session against
  the actual code, the installed dependencies, or the deploy values before being
  recorded; findings that did not verify were dropped or corrected.

## Verdict

**READY WITH FIXES.** No data-loss, security, or availability blocker was found
in the shipped code paths that production traffic will exercise on day one. Two
P1 items must land before (or together with) the merge — one config/code
mismatch that silently degrades lecturer model configuration, and the missing CI
wiring for the chat unit-test suite. Four P2 defects should be fixed in-stack or
immediately after. The rollout itself needs the short ops checklist below,
because two of the risks live in config outside this repository.

| Lens | Verdict |
| --- | --- |
| Correctness | READY WITH FIXES (1× P2, 3× P3) |
| Security | READY (4× P3, all seven check areas clean) |
| Deployment | READY WITH FIXES (1× P1, 2× P2, 4× P3) |
| Tests / CI | READY WITH FIXES (1× P1, 6× P2, 4× P3) |
| Documentation | wiki NOT READY (fixed in this branch); docs site had no chat content (added in this branch) |

## P1 — must fix before or with merge

### P1-1. Backend/chat model-registry split-brain: lecturers can enable a model students can never use

Verified. This stack adds `auto` (deployment `complexity-router`) and
`gpt-5.6-luna` to `DEFAULT_CHAT_MODEL_REGISTRY` in
`packages/graphql/src/services/chatbots.ts:49-70`. `CHAT_MODEL_REGISTRY_JSON` is
rendered **only** into the chat pod's ConfigMap
(`deploy/charts/klicker-uzh-v3/templates/cm-chat.yaml:17`); the backend pod
never receives it, so the lecturer-facing registry always falls back to the
built-in default. In production the manage picker will therefore offer
"GPT-5.6 Luna", the allow-list mutation will accept it, and the chat pod —
whose deployed registry (`deploy/env-uzh-prd/values.yaml:216-292`) has no such
id — silently filters it out and resolves automatic selection to the fallback
mini model. No error, no log, no UI signal. The same split-brain also works in
the opposite direction: the backend default has never offered the deployed
`gpt-5.1/5.4/5.5`, so lecturers cannot allow-list the models production actually
ships.

**Fix (pick one):** (a) drop `gpt-5.6-luna` from the backend default registry
(it is a local-simulation model; `auto` can stay — it exists in both deployed
registries); or (b) durably: mount `CHAT_MODEL_REGISTRY_JSON` from the same
`.Values.chat.modelRegistry` source into the backend ConfigMap so both pods
share one registry. (b) also unblocks lecturers from enabling the 5.x models.
A regression guard belongs with either fix: one vitest asserting the id set and
effort lists of `packages/graphql/.../chatbots.ts` and
`apps/chat/src/lib/server/chatModelRegistry.ts` agree.

### P1-2. The entire `apps/chat` vitest suite never runs in CI

Verified: no workflow under `.github/workflows/` references `test:run` or
`@klicker-uzh/chat`; the six `test-*` workflows cover grading, graphql,
markdown, olat-api, util, and Playwright only. This stack triples the chat suite
(25 files / 210 tests, including the guards that a raw upstream error body —
potentially carrying a bearer token — is never persisted or rendered, the
citation normalizer edge cases, and the rating coordinator). `check-types`
compiles these tests but never executes them, so their protection is advisory:
a regression merges green. The gap predates the stack (9 unrun files on `v3`),
but the stack makes this suite its primary correctness evidence.

**Fix:** add `.github/workflows/test-chat.yml` modeled on `test-markdown.yml`
with changed-paths
`^(apps/chat/|packages/i18n/|packages/prisma/|package\.json|pnpm-lock\.yaml|…)`,
prisma client generation first, then
`pnpm --filter @klicker-uzh/chat test:run`.

## P2 — fix in-stack or immediately after go-live

### P2-1. Cancelling a multi-step turn wipes the partial answer and rewrites its credits to ~0

Verified end to end: in `ai@7.0.37`, aborting a stream runs `onAbort`, closes
the controller, and the downstream event processor's `flush` still dispatches
`onEnd` whenever at least one step completed — with a null usage object and
completed steps only (verified in the installed dist,
`stream-text` abort path + `flush` short-circuit at `recordedSteps.length === 0`).
In `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`, `onEnd`
(`:1250`) has no `sawAbort` guard on its persistence block (`:1298-1374`) or its
credit block (`:1377-1391`) — only the success telemetry checks `!sawAbort`
(`:1393`). Scenario: a student in a tool-enabled mode stops generation while the
answer streams after a completed tool step. `onAbort` correctly persists the
partial text and charges the summed per-step cost; `onEnd` then overwrites the
row with completed steps only (the streamed text vanishes — after a pure
tool-call first step the student's answer becomes an empty bubble on reload),
rewrites `creditsUsed` to ≈0 in the message metadata, and double-charges
`imageDescriptionCost` on image turns.

**Fix:** `if (sawAbort) return` at the top of `onEnd` (optionally after the
`stream.finish` log line), mirroring the existing telemetry guard.

### P2-2. Assistant-avatar fallback 400s for any chatbot without an avatar

Verified in code: `apps/chat/src/components/thread.tsx:1260/:1275` fall back to
`'/user-solid.svg'` while `unoptimized={Boolean(chatbotAvatar)}`
(`:1265/:1280`) is `false` exactly in that branch, so the request goes through
`/_next/image`, and `packages/next-config/index.js` never sets
`dangerouslyAllowSVG` — Next's optimizer rejects SVG with a 400. Every seeded
and staging chatbot has an avatar, so no environment exercised this branch;
production chatbots without one render a broken image per message (twice per
message, both breakpoints). The `/user-solid.svg` middleware bypass added at
`middleware.ts:22` only covers direct requests, not the optimizer URL.

**Fix:** make both `<Image>` instances unconditionally `unoptimized`, matching
how `app-sidebar.tsx:108` already handles `/KlickerLogo.png`.

### P2-3. Production is the only environment running the new Langfuse span wrapper

Verified in deploy values: staging sets `chat.telemetry.enabled: false`
(`deploy/env-uzh-stg/values.yaml:168-169`), production has **no**
`chat.telemetry` key, and `cm-chat.yaml` defaults `$chatTelemetryEnabled` to
`true` — so the per-request `startActiveObservation` wrapper added at
`route.ts:1637-1641` executes only in prd, against the Langfuse exporter that is
already known not to export (OTel peer mismatch, `docs/chat-platform.md`). A
synchronous throw in that path would 500 every chat request in production while
staging stays green.

**Fix:** add `telemetry: { enabled: false }` to the `chat:` block of
`deploy/env-uzh-prd/values.yaml` until the OTel 2.x bump lands — cost-free,
since no trace currently reaches Langfuse anyway.

### P2-4. Five shipped surfaces are protected only by one-off manual browser evidence

From the test lens (spot-checked): (a) the answer caption — the e2e stream mock
emits `finish` without `messageMetadata`, so mode/effort/credits caption and the
thread-row mode chip are asserted nowhere; (b) rendered error/truncation
callouts (`data-cy="chat-message-error"` appears in no spec — a renderer
regression would show an empty bubble with green CI); (c) rating persistence
across reload (the only code feeding a stored vote back into the UI is
unexercised); (d) the feedback route's cross-participant 404 guard (also flagged
independently by the security lens); (e) reasoning-effort selection end to end —
the test named "Reasoning effort selector is wired up" asserts only that the
settings panel is visible. Each has a concrete one-test fix listed in the lens
output; together they are a half-day of Playwright work.

## P3 — polish and deferred (tracked, not blocking)

| # | Finding | Anchor | Note |
| --- | --- | --- | --- |
| 1 | `formatCredits` strips significant zeros: a 10-credit message renders as "1" (verified: `toFixed(0)` → `replace(/0+$/,'')`) | `apps/chat/src/components/thread.tsx:85-94` | Real bug, low reachability at today's per-turn costs; fix is `replace(/\.?0+$/,'')` on the fractional tail only |
| 2 | `loadCredits` drops `creditsLoaded` on every refresh; one failed fetch hides the credits footer for the session | `apps/chat/src/stores/settingsStore.ts:201-210` | Also causes a footer remount flicker per turn |
| 3 | Dead `data-cy` fallback: `dataCy + '-attach-input' \|\| '…'` — precedence makes the fallback unreachable | `apps/chat/src/components/thread.tsx:806/:820` | Test-tooling only |
| 4 | `SAFE_TOOL_ERROR` redaction constant duplicated in the live and persisted paths | `apps/chat/src/lib/toolOutput.ts:1`, `lib/server/persistedAssistantContent.ts:13` | Import one from the other |
| 5 | Langfuse trace id seeded from a client-supplied message id (attribution pollution only; no read-back path) | `apps/chat/src/lib/server/langfuseTracing.ts:22` | Prefix with participant/chatbot ids if rating→score writes ever land |
| 6 | 13 `minimumReleaseAgeExclude` entries have aged past the 14-day quarantine and can be pruned | `pnpm-workspace.yaml:13-31` | Check advisories for `ai@7.0.37` / `@assistant-ui/react@0.14.27` first |
| 7 | ~200 new German strings have zero automated locale coverage (ICU shape/placeholder parity is hand-verified only) | `packages/i18n/messages/de.ts` | One cheap vitest walking en/de key trees would pin it |
| 8 | `playwright/timings.json` still weights Y-chat at 120 s after the spec nearly doubled | `playwright/timings.json:29` | Refresh from the next full CI run |
| 9 | Live-streamed citations are untested (all six citation e2e tests seed persisted threads) | `playwright/util/chat.ts:329-340` | Extend `makeStreamBody` with tool events |
| 10 | Devcontainer comment claims model-policy parity with prod but pins `CHAT_PRIMARY_MODEL_ID=auto` (prod: `gpt-5.5`) | `.devcontainer/devcontainer.env:112-115` | Correct the comment; the divergence is deliberate |

## Rollout checklist (config outside this repo — verify before deploy)

1. **Apply `20260721193705_chat_message_rating` before rolling the image.**
   Old-pods-on-new-schema is safe (nullable additive column); new-pods-on-old-
   schema makes every rating write 500 with a UI that silently reverts the vote.
   The chart has no migration job — this is a manual pre-step.
2. **Confirm the deployed LiteLLM proxy version** in `stg-litellm`/`prd-litellm`
   is at least as new as the locally validated `v1.88.1`; AI SDK 7 sends
   Responses-API fields an older proxy may reject with a 400 for every request.
3. **Check `-secret-chat` exports `LANGFUSE_BASE_URL`** (the SDK v4 ignores the
   old `LANGFUSE_HOST`; a stale key silently retargets the SaaS endpoint).
4. **Decide P1-1's fix** (backend registry) and, if (b), extend the backend
   ConfigMap in the same release.
5. **Apply P2-3** (`telemetry.enabled: false` in prd values) unless the OTel
   bump ships first.
6. **After rollout, check the `stream.finish` logs once** for
   `reasoningTokensIncludedInOutput: false` — if it appears, reasoning-model
   turns are systematically undercharged (flagged by the security lens; the
   route already instruments it).
7. **Live-verify the two new deployed model routes once on staging** (`auto` via
   the complexity router, plus one direct reasoning model) — no automated test
   covers a real model call by design (documented no-key verification limit).

## Stack/process state (as of this evaluation)

- **#5251's main CI never ran on head `894e3f0b9`** — GitHub recomputes the PR
  as `mergeable=false/dirty`, and a conflicted PR gets no merge ref for
  `pull_request` workflows. This is provably phantom: a fresh fetch shows base
  `claude/chat-v3-3-citations` 0 ahead / head 20 ahead and
  `git merge-tree --write-tree` clean. Remedy without churning the branch:
  close/reopen the PR (or toggle the base) to force a recompute; alternatively
  the flag clears as the stack merges bottom-up.
- The "failing" checks on #5249/#5250 are stale cancelled check-runs from
  2026-08-01 plus the known SonarCloud whole-diff gate; #5248 is fully green.
- Live stack on the evaluation head is healthy (chat 307→login unauthenticated,
  API/PWA 200); the full 17-screenshot browser matrix from the same day is in
  the PR review comment.
- Known, explicitly out-of-scope items (tracked elsewhere): the `doc_query`
  citation producer is not connected in any environment (integration handoff
  exists); branch selection does not survive reload (own issue);
  Langfuse OTel export blocked by a peer mismatch (documented).

## Documentation outcome (this branch)

The documentation lens rated the wiki NOT READY (a contradicted Auto tier map,
a missing-CI claim, a stale migration banner, and seven completeness gaps) and
found **zero** lecturer/student-facing chat content on the docs site. Both are
addressed by the commits on this branch (`claude/chat-v3-5-docs`); the
remaining deferred docs items — privacy-statement AI paragraph (needs the
legal owner), use-case page rewrite (needs product sign-off), FAQ entries —
are listed with proposed wording in the lens output and should be scheduled
separately.
