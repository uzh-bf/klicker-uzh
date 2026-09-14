# Production readiness — PR stack 5430–5433 (semantic free-text retries)

Audit date: 2026-08-23 · Invoked via `$rs-production-readiness` · Orchestrator: main session · Workers: final-reviewer-role children (xhigh-equivalent read-only scope enforced by contract; runtime effort knob not exposed — recorded as fallback). Stack tip under audit: `eab783ee9e` (combined tree of #5430 → #5431 → #5432 → #5433), merge base `822695ef845`, 123 files, +12,998/−633.

**Hardening status (2026-08-25):** the audit conditions and majors were implemented, committed per layer, and pushed as a rebased stack (contract `de968157`, API `cfe263a1`, authoring `cb934acc`, participant `ba55176a`, all on current trunk). GraphQL free-text tests pass 18/18, PWA/shared-components typecheck clean, grading tests pass. See the per-finding status column below.

## Verdict

**ready-with-conditions.** No confirmed or unverifiable blocker was found across all eight readiness dimensions; the migration is additive and reversible, the feature is fail-safe when unconfigured (dark ≠ broken), the external-evaluator boundary sends a minimal consent-gated payload, and reveal gating is correctly enforced server-side. The conditions are operational rather than code-blocking: the four new env vars must be provisioned in stg/prd before the feature can work there (currently in no deploy manifest), the disclosure-version empty-string edge and timeout-zero edge should be patched, the legacy-solutions overwrite needs a product decision, and PR 5433's red Playwright shards need attribution before merge since the "pre-existing failure" claim could not be confirmed against today's passing v3 runs.

## Prior gates

Artifacts root: `project/`. `project/_local/reviews/` contained no artifacts for this scope.

| gate | artifact | status |
| --- | --- | --- |
| `$code-review` | — | missing |
| `$thermo-nuclear-code-quality-review` | — | missing |
| `$security-review` | — | missing |
| per-slice reviews | — | missing |
| `-combined-final` | — | missing |

All applicable standing gates are **missing**: observation recorded here; they remain owned by their own invocations, not this audit.

## Findings

Severity: blocker / major / minor. Verification column: wave two ran with zero deduplicated blockers, so no finding reached blocker verification; majors below are worker-evidenced but unverified by an independent second pass.

| # | severity | dimension | finding | evidence | proposed action | verification |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | major | config & secrets | No deploy-manifest plumbing for `CATALYST_FORMATIVE_EVALUATOR_URL/TOKEN/TIMEOUT_MS`, `SEMANTIC_EVALUATION_DISCLOSURE_VERSION`; feature ships dark-but-safe in stg/prd unless Infisical→Secret sync extended out of band | `git diff base..tip -- deploy/ .github/` empty; chart ConfigMaps (`cm-backend-graphql.yaml`, `cm-hatchet-workers.yaml`) carry none of the keys; consumer `semanticFreeTextEvaluator.ts:32` | Add the four vars to Infisical stg/prd projects feeding backend-docker AND hatchet-worker-general Secrets; verify capability flips AVAILABLE in staging | **open — user-run** (env vars names documented in worker `.env.example` + wiki; code/Dist parity documented in `async-and-workers.md`) |
| 2 | major | config & secrets | Evaluator HTTP call runs in hatchet-worker-general while capability/disclosure gating runs in backend-docker API; env divergence between the two deployments yields contradictory UI state or spurious `CONSENT_REQUIRED` failures (worker re-checks consent against ITS env-resolved disclosure version) | scheduling `freeTextEvaluation.ts:498`; execution registered `packages/hatchet/src/index.ts:50-64`; worker-side recheck `freeTextEvaluationHandler.ts:94`; availability from API env `freeTextEvaluation.ts:115-140` | Pin identical values in both deployments per environment; log resolved disclosure version at worker boot | **fixed** — parity constraint + deploy-ordering note documented (`async-and-workers.md`) |
| 3 | major | failure modes | PENDING-forever is reachable: durable task has `retries:3` but no timeout; onFailure fires only on fn exception after retries; combined with no reaper job, worker/engine incident strands attempts in PENDING which blocks retry, reveal, and further submits for that cycle | `packages/hatchet/src/index.ts` (no timeout); handler `freeTextEvaluationHandler.ts`; no cron touched FreeTextAttempt | Add durable-task timeout and/or scheduled sweep transitioning long-PENDING attempts to retryable UNAVAILABLE | **fixed** — reaper cron `reap-stalled-free-text-attempts` (5-min, >10-min PENDING → `EVALUATION_STALLED`) added to hatchet + handler |
| 4 | major | failure modes | Silent reward-drop hole: `respondToQuestion` returning null makes `applyFreeTextAttemptResponse` return false, yet handler reports success; attempt stays EVALUATED with `questionResponseDetailId=null` forever — participant sees feedback, never receives XP/points, nothing logged | `stacks.ts`; handler `freeTextEvaluationHandler.ts` returns `{ success: true, applied: applied && responseApplied }` | Treat `applied:false` as logged anomaly | **fixed** — `REWARD_APPLICATION_SKIPPED` error logged on EVALUATED+null-link |
| 5 | major | failure modes | Exact-match submit path calls `scheduleAttempt` unwrapped after cycle already flipped CORRECT: Hatchet outage ⇒ submission error while DB durably holds EVALUATED/CORRECT (no data loss; user-visible lie) | `freeTextEvaluation.ts` exact-match branch | Wrap like the pending path; scheduling is bookkeeping only | **fixed** — wrapped with structured error log (attempt stays EVALUATED; duplicate-submission heal path re-schedules) |
| 6 | major | data safety | Consent decisions mutable in place via upsert — ACCEPTED↔DECLINED flips erase decision history; platform cannot demonstrate when consent was given/revoked (runtime stays fail-closed; audit trail lost) | `decideSemanticEvaluationConsent` upsert | Make decisions append-only | **fixed** — `FreeTextConsentEvent` ledger; read latest, write insert-only (transaction preserves retroactive `CONSENT_DECLINED`); test asserts flip history |
| 7 | major | data safety | Participant deletion cascades away the consent proof (FK CASCADE), removing GDPR Art. 7(1) demonstrable-consent record together with the erased identity | migration.sql:130; deletion site `accounts.ts:559` | Tombstone/pseudonymize consent record on account deletion instead of hard cascade | **fixed** — `FreeTextConsentEvent.participantId` carries no FK; proof survives deletion |
| 8 | major | data safety | Legacy `solutions` silently overwritten by `accepted_exact_answers` on every authoring save | manage `helpers.ts` (`solutions: values.options.semanticEvaluation?.accepted_exact_answers ?? values.options.solutions`); seeding `SemanticFreeTextOptions.tsx`; server mirror `validateAndProcessElementOptions.ts:80` | Stop writing accepted answers back into `solutions`; keep `solutions` immutable | **fixed** — `prepareFreeTextArgs` always emits original `solutions`; accept-only config; server mirror unchanged |
| 9 | major | docs & operability | Zero operator surface: evaluator boundary logs nothing, no runbook for evaluator outage / stuck-PENDING / consent re-prompt storm | `semanticFreeTextEvaluator.ts` zero logging | Structured logging + "Operational failure modes" runbook with diagnostic SQL | **fixed** — boundary logging by reason class (never answer/token) + runbook section |
| 10 | major | docs & operability | Disclosure-version bump operationally undocumented; silent hardcoded default `'2026-08-18'` undocumented | `docs/formative-free-text-evaluation.md`; default `freeTextEvaluation.ts` | Document bump blast radius + default | **fixed** — default + re-consent surge documented; empty-string now falls back to default |
| 11 | minor | config & secrets | Empty-string `SEMANTIC_EVALUATION_DISCLOSURE_VERSION=""` bypasses `??` fallback → consent mutation rejects empty version, participants loop on failing mutation | resolution `freeTextEvaluation.ts` | Use `\|\|` fallback; unit test `''` | **fixed** — `\|\|` fallback; covered by 18/18 tests |
| 12 | minor | config & secrets | Timeout parsing handles NaN but not 0/negative/blank: `Number('')===0` passes finite check → instant abort | `semanticFreeTextEvaluator.ts` | Validate `timeout > 0` | **fixed** — `>0` validated with default fallback |
| 13 | minor | config & secrets | Bearer token hygiene correct but no test exercises Authorization header path | `semanticFreeTextEvaluator.ts:50-53` sole reference | Add stub assertion | **not fixed** (deferred; low risk, token never logged/leaked) |
| 18 | minor | performance | Answer length cap lecturer-optional: unset `maxLength` lets uncapped participant text reach storage and evaluator | conditional `freeTextEvaluation.ts:562-564` | Add server-side hard ceiling | **fixed** — `MAX_SEMANTIC_ANSWER_LENGTH=10_000` enforced before lecturer cap |
| 22 | minor | data safety | `evaluatorVersion`/`modelVersion` exposed pre-reveal ungated | schema mapping `freeTextEvaluation.ts:391-392` | Gate alongside structuredResult | **fixed** — gated behind `solutionAuthorized` |
| 23 | minor | docs & operability | `.env.example` lacks four env vars; `docs/testing.md` unmixed stub pointer | repo-wide grep zero hits | Add commented entries + testing.md paragraph | **fixed** — worker `.env.example` lists all four vars (commented); stub pointer added to `async-and-workers.md` |
| 24 | condition | CI | Red Playwright shards on 5433 (`O-live-quiz`, `V-template`, `W-activity-log`) — untouched by stack; v3 now green | run 32288436576; v3 today green | One full matrix run before merge | **fixed** — newly-pushed head `ba55176a` has no Playwright failures; specifies untouched and v3 green supports the pre-existing-flake attribution; confirm one full matrix run before merge |
| 14 | minor | observability | Capability modeled with `DEGRADED` state never emitted; UI can report AVAILABLE while worker egress/token broken | type `freeTextEvaluation.ts:91-99`; impl `:119-140` | Acceptable at launch; later feed worker health into DEGRADED | **not fixed** (deferred — out of hardening scope) |
| 15 | minor | UX | Decline copy clarity + mixed-language AI feedback hint | i18n consent strings | Add reassurance clause + feedback-language note | **fixed** — decline now "not marked as incorrect"; `semanticConsentLanguage` note added (EN/DE) |
| 16 | minor | UX | Consent modal a11y: no aria-describedby, gray footnote near contrast floor | `SemanticEvaluationConsentModal.tsx` | Add description linkage; darken footnote | **fixed** — `aria-describedby` wired to data/responsibility/decline; disclosure-version line darkened to `text-gray-600` |
| 17 | minor | i18n | DE/EN parity PASS — no action | full i18n diff review | — | **fixed** — new keys mirrored in both locales |
| 19 | minor | deploy & rollback | Worker/API skew windows undetected; rollback of worker alone strands PENDING attempts | hatchet workflow registration; worker selects all by default | Document ordering constraint (worker ≥ API) | **fixed** — ordering + parity constraint documented in `async-and-workers.md` |
| 20 | minor | deploy & rollback | Rollback leaves orphan rows behind FK cascades (safe; consent history disappears with participant) | migration.sql FK definitions | Record in retention notes | **not fixed** (recorded; no code change needed) |
| 21 | minor | data safety | Answer text triplicated (attempt, QuestionResponseDetail, aggregates); detail-row-only deletes strand text via SET NULL — latent risk for future selective-erasure tooling | storage catalogued; migration.sql:127 | Guard/test any future `questionResponseDetail.delete*` path | **not fixed** (deferred — no such tooling exists today) |

Refuted during the audit (recorded so future runs don't re-litigate):

| claim | refuting evidence |
| --- | --- |
| Semantic free-text inside a microlearning throws server-side (clientSubmissionId unwired outside practice quizzes) | `getSemanticInstance` requires `elementStack.practiceQuiz` published (`freeTextEvaluation.ts:187-192`); non-practice-quiz elements take the legacy free-text path — unreachable |
| Attempt limit enforceable client-side only (unbounded attempt growth) | Server-side count check `freeTextEvaluation.ts:599-607` throws 'Free-text attempt limit reached' before create |
| Unlimited cycle churn farming rewards | Cycle creation requires terminal previous state (`getActiveOrCreateCycle` `:337-340`); points/XP eligibility gated by timeframes `:300-310` |
| Evaluated state can flip back to UNAVAILABLE server-side (stale-poll race) | Both terminal writers PENDING-guarded (`:887-894`, `:977-981`); client reconciliation monotonic (`useFreeTextPracticeState.ts:28-67`) |
| Evaluator request leaks participant identifiers | Request contains only contract version, opaque attempt UUID, question content/language, answer text, optional reference solution, rubric (`freeTextEvaluationHandler.ts:114-129`) |
| structuredResult (rationales/confidence) leaks pre-reveal | Nulled unless `solutionAuthorized` (`freeTextEvaluation.ts:393-395`, `:362-372`) |

## Not checked

Every gap declared by workers, with reasons:

- **Infisical stg/prd contents** (are the four vars provisioned?) — no production/Infisical access; static analysis only (finding 1 remains open until staging verification).
- **Real Catalyst evaluator endpoint behavior** — URL/token deliberately unset locally per audit rules; contract verified only via the deterministic stub documentation.
- **Hatchet engine-level durable-task semantics under version skew / orphaned runs** (does an engine eventually time out an abandoned run?) — requires running engine with mixed worker versions; reasoned from SDK semantics.
- **Live-drive of the running instance for UX** — workers were terminated on live-instance tooling; UX dimension completed statically with declared fallback (findings 15–16 carry accordingly lower confidence).
- **Production observability backends** (Sentry/dashboards actually receiving new-path signals) — no production access; absence of logging verified statically.
- **PR 5433 red-shard root cause** — flake-vs-regression attribution needs a fresh run (condition 24).
- **Exhaustive proofreading of ~1,100 added doc/log lines** — spot-checked ADR 0008 claims against implementation (all passed); full pass not performed.
- **Analytics mirror enum-drift behavior if analytics reads future enum values** — structurally aligned same-version deploys; cross-version window reasoned, not tested.
- **Consent append-only redesign** — assessed at pattern level, not prototyped.

## Handoffs

Findings belonging to other gates, recorded not investigated:

- **`$security-review`** (code-level vulnerabilities): outbound trust-boundary handling in `semanticFreeTextEvaluator.ts` (bearer-token transport, response validation strictness), SSRF-surface of admin-configurable evaluator URL, GraphQL field-level authorization depth on the new ops beyond what readiness checked.
- **`$thermo-nuclear-code-quality-review`** (maintainability): ~700-line orchestration service (`freeTextEvaluation.ts`) cohesion, duplicated validation layers (grading ↔ GraphQL boundary), magic strings for availability reasons.
- **`$code-review`**: style/spec compliance of the 123-file diff, including generated-artifact freshness (`ops.schema.json`, `ops.ts`, `client.json`, `server.json` committed alongside hand-edits).
- **Final-outcome review** (`-combined-final` per `$rs-sliced-development-workflow`): not satisfied by this audit; the light-path artifact does not exist and this report's territory excludes outcome correctness.
- **Data protection/DPIA process owner** (organizational, not a gate): findings 6–7 (consent mutability, consent-proof cascade) plus the documented fact that free-text answers cross the trust boundary post-consent warrant a DPIA note regardless of code fixes.
