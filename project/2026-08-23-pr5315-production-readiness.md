# Production readiness — PR 5315 live-quiz per-element response counts

Date: 2026-08-23 · Scope: [PR 5315](https://github.com/uzh-bf/klicker-uzh/pull/5315) head `0527dceb3ac0a4435e2e20e627e0aabf9444aa38` (`audit-pr5315`) targeting `v3` · Merge-base `30d2906ffd` · 26 files, +2157/−53 · Method: 8 read-only dimension workers (reviewer tier, xhigh effort), static analysis against pinned SHAs; wave-two verification not run (zero candidate blockers reported; budget used 8 of max 16).

## Verdict

**ready-with-conditions.**

No dimension found a blocker: ingestion, scoring, and schema contracts hold, the feature is diagnostic-only by construction, and the best-effort guarantee is honored on every write path. But the PR cannot merge as-is (three conflicts, one against a deliberate repo guard), it ships one genuinely new reliability trade-off that four workers independently flagged (throw-on-error aggregation feeding non-idempotent retries), and the audit ran entirely without a live instance — the dedicated DevPod stack failed to start twice, so no behavioral claim below was observed at runtime. The conditions name what must be settled before/at merge; none require redesign.

## Prior gates

| gate | artifact | status |
| --- | --- | --- |
| `$code-review` | none for this scope | **missing** |
| `$thermo-nuclear-code-quality-review` | none | **missing** |
| `$security-review` | none | **missing** |
| Per-slice reviews | none | **missing** |
| `-combined-final` (light path) | none | **missing** |
| Specialized gates for unchanged surfaces | — | not applicable |

Context: the author reports an independent review at commit `7e9c98e`; HEAD is two commits later. Worker inspection confirms both intervening commits are `style(manage)`-only, consistent with the author's claim that review scope was not invalidated. Missing standing-gate artifacts remain an observation, not a stop.

## Findings

Severity as judged by the orchestrator from worker evidence; "unverified" means no wave-two reproduction (none was owed — no candidate blockers). Corroboration counts how many independent workers surfaced the same root cause.

| severity | dimension | finding | evidence | proposed action | verification |
| --- | --- | --- | --- | --- | --- |
| major | deploy/failure/data/perf ×4 | Processors convert previously swallowed Redis pipeline-command errors into thrown errors; Hatchet retries (1 anon / 3 durable) then replay a **non-atomic** pipeline (`processor.ts:74` "pipeline (not atomic)") containing non-idempotent `HINCRBY :results` increments → partial-fail+retry can double-count scores/participants; persistent fail can drop a response the student already saw acknowledged 200 (new vs v3, which swallowed and never retried) | `apps/hatchet-worker-response-processor/src/processors/processor.ts:676-687` throw on `aggregationErrors.length > 0`; tail re-throw `:740`; `assessmentProcessor.ts:606-618`; retries `src/index.ts:15,30,51,73`; v3 baseline `v3:…processor.ts:669` ignored exec result | Make aggregation atomic (`multi()`/Lua) or gate replay behind an idempotency marker (HSETNX messageId) before merge — or consciously accept and document the trade-off (old behavior silently *lost* partials; new behavior trades that for retry storms) | unverified (4× corroborated, verbatim source quoted) |
| major | failure/deploy/data/obs ×5 | Cockpit count resolution throws away the entire authorized query on any single Redis SCARD/pipeline error; with 2 s polling a transient Redis blip blanks the whole lecturer cockpit (participants, feedback, QA) exactly when they need it — regression vs v3 graceful degradation, and contradicts the feature's own best-effort contract | `packages/graphql/src/services/liveQuizzes.ts:1023,1030-1040` rethrow sites; `cockpit.tsx:53-59` 2 s poll | Wrap count pipeline in try/catch; degrade per-element to `null` (schema fields already nullable, UI already handles absence) | unverified (5× corroborated) |
| major | deploy | No feature flag: indicator goes live for all lecturers on deploy; worst case cosmetic exposure | no flag/env surface in diff; `query.ts:561-565` serves to everyone passing EXECUTE | Consciously confirm full-population rollout intended | unverified |
| major | deploy | Deploy-order dependency: frontend-manage must not serve before the GraphQL API, or `GetCockpitQuiz` fails validation (shipped op selects the new fields) and the cockpit dies for the window; reverse mix is safe (additive nullable fields) | `packages/graphql/src/public/server.json` op hash `ee88f9d6…` embeds the two fields | Record "deploy graphql API before frontend-manage" in merge/deploy notes | unverified |
| major | perf | Tracking sets never expire when the canonical info key exists without TTL — its normal state during an active block; abandoning a quiz mid-block leaks them permanently (bounded ~1 MB/quiz, cumulative across semesters) | Lua script `packages/util/src/liveQuizResponseTracking.ts:9-13`: `-1` falls through with no EXPIRE; `endLiveQuiz` does no sweep | Add an `else` branch applying the TTL constant when TTL = −1; add unit test for the −1 case | unverified (2× corroborated) |
| major | perf/security | Regular-path received-recording executes before any credential check — mere cookie presence is checked later; anonymous spam mints set members and inflates lecturer-visible counts during a live lecture | `apps/response-api/src/index.ts:160,172-196` track before `:198-201` auth-presence computation | Move tracking after the cookie-presence check | unverified |
| major | obs | The info-key-missing skip branch produces **no log at all** — processed>received divergence becomes forensically invisible; worst observability gap in the change | `response-api/src/index.ts:181` `if (instanceInfoExists === 1) { … }` with no else | Add one warn/info log with liveQuizId/instanceId | unverified |
| major | obs | No metrics/alerting infra hooked anywhere; the documented "operational signal" (received−processed divergence) has no consumer — detection requires a human staring at the cockpit | repo-wide grep: no prometheus/statsd/otel on the response path; docs claim `docs/async-and-workers.md:60` | Accept and record as gap, or expose cardinalities via scrapeable endpoint/periodic log | unverified |
| major | obs | Frontend discards all GraphQL errors from the cockpit poll (no `error` handling, no Sentry/error boundary in frontend-manage) → failed polls silently render stale last-good numbers as live | `cockpit.tsx:49-67`; grep found no error wiring | Surface poll errors (toast/banner + retry); follow-up global Apollo error link | unverified |
| major | failure | Received-recorded-before-enqueue leaves permanent received-but-not-processed phantoms on enqueue failure, unmonitored; assessment path compensates with audit event, regular path does not | `response-api/src/index.ts:179-182` vs push at `:212` outside try | Mirror the assessment audit pattern; alert threshold optional | unverified |
| major | obs | `/healthz` returns unconditional OK (pre-existing); worker exposes no HTTP health at all — half-degraded Redis invisible to probes | `response-api/src/index.ts` healthz untouched by diff; worker `index.ts` startup-only logging | Follow-up: make healthz ping Redis; document worker health = Hatchet heartbeat | unverified |

Minor findings (all unverified unless noted; condensed):

| severity | dimension | finding (condensed) | action |
| --- | --- | --- | --- |
| minor | deploy | Naive merge resurrects `docs/log.md` against AGENTS.md guard ("must never be created or restored"); the +8 lines are a pure changelog duplicate of the async-and-workers section — resolving as deleted loses zero unique content | Resolve modify/delete as **deleted** |
| minor | deploy | Root cause of that resurrection: `.agents/skills/klicker-wiki-maintenance/SKILL.md:41` still instructs agents to append `log.md` entries — will keep reproducing across future PRs | Fix the skill instruction |
| minor | deploy | Content conflicts `packages/util/src/index.ts` (alphabetical reorder + new export; wrong resolution = loud build failure) and `docs/async-and-workers.md` | Union-merge; CI polices misses |
| minor | deploy | Rollback leaves orphaned `lq:*:responses:*` keys (≤24 h normally; indefinite only in the abandoned-quiz leak above); harmless to reverted system, memory-only | One runbook line: SCAN/DELETE after revert |
| minor | deploy | Assessment ingest skips the instance-existence gate the regular path applies; Lua −2 branch then creates 24 h-capped keys for ended instances (asymmetric with the perf worker's pre-auth finding) | Align gates or accept |
| minor | failure | TTL races: info key expiring mid-lecture freezes counters presented as live (no staleness indication); narrow wrong-TTL windows self-heal ≤24 h | Optional: re-arm info key on active reads |
| minor | failure/perf | Ingestion gains 2 sequential awaited Redis RTTs (EXISTS + EVAL) on the hottest student-facing path with no timeout bound; doc slightly overstates "does not delay" | Fold EXISTS into the script; reword doc |
| minor | config | `LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS` hardcoded compile-time constant consumed by 5 call sites across 4 images; ops cannot tune per env without redeploy | Acceptable; env-read + turbo.json globalEnv only if tuning wanted |
| minor | config | Lua −1 fall-through also means a failed block-close retention leaves keys persistent indefinitely, indistinguishable-by-log from by-design persistence | Note in runbook; see major leak fix |
| minor | config (conf 50) | Sets expire (not delete) at block close; stale members may survive ≤24 h into a re-executed block reusing instance ids → overcount on re-runs; premise unconfirmed empirically | Product decision; DEL at start path if reset wanted |
| minor | data | Backup coverage unknown-in-repo: bundled chart defaults AOF on/RDB off, but authoritative prod Redis config is out-of-repo; key loss matters little (diagnostic, self-healing) | Confirm prod persistence once; record answer in docs |
| minor | data | PII exposure incremental and low: members are random UUID (regular) / MD5 pseudonym (assessment), both already persisted elsewhere with longer retention; no new identifier class enters Redis | Optional MD5→SHA-256 hardening note |
| minor | data | After mid-lecture Redis restore, tracking keys end stale/partial but nothing functionally breaks; re-answer window via rolled-back dedup hashes is pre-existing, merely newly *visible* through the counter | Document expected weirdness |
| minor | obs | Processor processed-tracking failures logged well with ids (strongest part); response-api uses bare `console.*`; block-close throw includes blockId but not liveQuizId | Consistency pass; add liveQuizId |
| minor | ux ×7 (static fallback) | First-load failure strands page on perpetual spinner (inherited pattern); no staleness cue; persistent received>processed renders identical to transient lag; space-less element names can overflow link column; hover-only `title` (touch users get nothing, nearby code uses Tooltip); no thousands separators ("1234"); SR phrasing passive without row context | All polish-grade; batch as follow-up |
| minor | docs | Doc section unusually accurate (every checked claim matched code, incl. idempotency-across-retries and cleanup ordering); residual imprecisions: "known instance" wording (assessment unconditional), "does not delay" | Two-sentence doc tweaks |
| minor | docs | No operator runbook for divergence interpretation or orphan-key cleanup; honest sizing: deferrable for a diagnostic surface | 3-line runbook addition nice-to-have |

Positive verifications worth recording: read path is one batched pipeline (no N+1); poll multiplication bounded (~60 cmds/s worst case per open tab, pre-existing interval); write amplification ≈6–8 O(1) Redis commands per response, trivially within capacity; best-effort contract holds on all write paths (tracking failures can never fail ingestion/aggregation); Playwright selectors preserved verbatim plus one stable new selector; aria-label/title structurally incapable of drifting; scheduled-element omission and `0 / 0` rendering correct end to end; committed design artifacts match repo convention; no secrets, no new env vars, no dependency additions, no migration.

## Not checked

Every declared coverage gap, with reasons:

- **No runtime verification of anything** — the dedicated routed DevPod stack for branch `audit-pr5315` failed to start twice (DevPod agent timeout, then 502 on all routes after retry); stopped and freed. All findings are static analysis against pinned SHAs. A working instance would let a future run observe the cockpit indicator, inject Redis faults, and confirm the double-count scenario empirically.
- **UX rendered-behavior checks** — login flow, screenshots, actual overflow at narrow widths, real screen-reader announcements, invalid-quiz-id path; static fallback applied ($web-design-guidelines + $impeccable named as applied lenses).
- **Codegen regeneration** (`pnpm --filter @klicker-uzh/graphql generate` reproduction) — writes build outputs; workers relied on internal consistency of the four committed artifacts instead (they are mutually consistent).
- **Production/staging Redis persistence config** — governed by env-resolved config outside the repo; parity argued from bundled chart defaults.
- **Hatchet SDK internal replay/durability semantics** — reasoned from registered retry counts and code shape, not vendored SDK source.
- **Deep authorization matrix** (cross-course probing of `QGetCockpitQuiz`) — security-review territory; only the EXECUTE-permission wrapper and published-quiz filter were shallow-verified.
- **Block re-execution with instance-id reuse** — would need driving a live instance; confidence held at 50.
- **GitHub CI run logs** beyond the check-name/conclusion summary.
- **Whether GraphQL Yoga logs thrown resolver errors server-side**, and deployment-manifest health probe wiring for stg/prd.

## Handoffs

Findings that belong to other gates, recorded not investigated:

- **$security-review**: `console.log("Pushing event …", message)` persists full outbound payloads including forwarded `participant_token` cookie values in plaintext logs (pre-existing, immediately adjacent to new code); correlationKey/JWT validation depth; authorization matrix beyond the EXECUTE gate; the pre-auth tracking-write vector above.
- **$code-review**: test quality/scope of the new +190/+45 test files; generated-artifact staleness check; the two content-conflict resolutions as ordinary merge hygiene.
- **$thermo-nuclear-code-quality-review**: duplicated tracking blocks across the two processors; `console.*` vs structured logger inconsistency in response-api.
- **Merge/code gate (immediate)**: resolve `docs/log.md` as deleted (guard violation otherwise); union-merge `packages/util/src/index.ts`; resolve `docs/async-and-workers.md`.
- **Skill maintenance**: `.agents/skills/klicker-wiki-maintenance/SKILL.md` step instructing `log.md` appends contradicts current repo policy and caused the resurrection — fix in the same change or a follow-up.
