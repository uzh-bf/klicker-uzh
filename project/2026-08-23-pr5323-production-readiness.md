# Production readiness — PR #5323 (gate learning analytics with GrowthBook)

**Scope:** `feat/growthbook-learning-analytics`, base `v3@35142c81a` → head `bbb07d7ed` (+479/−250, 29 files, 4 commits). Open, unmerged. Unit of evaluation: the system as it exists after merge.
**Audit date:** 2026-08-23 · **Method:** `$rs-production-readiness` — 8 dimension workers (final-reviewer grade, xhigh effort, read-only). 7 complete reports + 1 synthesized partial. Wave two not needed (zero candidate blockers).
**Shared brief:** `project/_local/reviews/2026-08-23-pr5323-readiness-brief.md`

## Verdict

**ready-with-conditions**

The fail-closed invariant holds in every path traced: the flag registry is `false`-only, missing/unusable GrowthBook config initializes an empty payload with no fetch, SDK failures swallow to `false`, and an unrecognized `NEXT_PUBLIC_ENV` disables evaluation entirely — analytics controls render visible-but-inert and no route or API boundary was weakened (the change is explicitly a product-rollout control, and direct `/analytics` routes keep their normal auth). There are no DB migrations, no new durable state, and no PII crossing the SDK boundary as shipped. The conditions are not about the flag gate itself but about regressions and silent-failure surfaces the PR introduces around it: the Layout error-condition tightening can hard-block the whole app on transient profile-query errors for users who previously degraded gracefully, the rollout is operationally dark end-to-end (no operator-visible signal anywhere between browser SDK and dashboards), permanently-disabled controls ship with no explanation to lecturers who can never enable them, and the React provider bypasses the package's own attribute sanitizer. All four are cheap, well-scoped fixes; none individually risks outage or data loss if merged, which is why this is conditions rather than not-ready.

## Prior gates

| gate | artifact | status |
| --- | --- | --- |
| `$code-review` | none found for `bbb07d7ed` | missing |
| `$thermo-nuclear-code-quality-review` | none found for `bbb07d7ed` | missing |
| `$security-review` | none found for `bbb07d7ed` | missing |
| per-slice reviews / `-combined-final` | none found for `bbb07d7ed` | missing |
| UX lens (`$web-design-guidelines` / `$impeccable`) | applied statically inside this audit's UX worker; live-browser pass deferred | partial |

Note: the PR description records passing maintainability review, `check:all`, unit tests, builds, and Playwright test discovery at the current head, but no standing-gate artifact exists in `_local/reviews/`. Required GitHub checks on `bbb07d7ed` could not be verified from the repo (network commands out of scope) — the normal preflight owns that.

## Findings

| # | severity | dimension | finding | evidence | proposed action | verification |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | major | Failure modes & resilience | Reworked Layout error condition hard-blocks the whole app on any profile-query error, even while a RetryLink retry is in flight or valid cache exists; base showed cached app during background refetch failure | `Layout.tsx:62` `!dataUser?.userProfile \|\| errorUser` (was `!dataUser \|\| (!loadingUser && errorUser)`); query uses `cache-and-network`; RetryLink max 3 attempts (`lib/apollo.ts`) | Revert toward `(errorUser && !dataUser?.userProfile)` semantics so stale-cache users degrade gracefully | unverified (non-blocking) |
| 2 | major | Observability | Zero operator-visible signal for any GrowthBook failure; every failure terminus is a discarded boolean or a browser console line; likeliest misconfiguration (unset GH Actions variable → empty strings → unconfigured branch) emits literally nothing | `browserClient.ts:40-42` `.then(r => r.success).catch(() => false)`; `react.tsx:46` `void initialize()`; `contracts.ts:96` console.error only; workflows pass `${{ vars.NEXT_PUBLIC_GROWTHBOOK_*_PRD }}` which expands empty when unset | Log init outcome once per session through a watched channel (or Matomo event); warn when apiHost/clientKey absent while env ≠ development; CI guard for empty vars on prd/stg builds | unverified (non-blocking) |
| 3 | major | UX | Permanently-disabled analytics controls for free/non-catalyst lecturers who previously saw them hidden entirely — no tooltip/explanation anywhere (unlike sibling catalyst features that use Tooltip) | Always-rendered items at `Header.tsx:166`, `CourseOverviewHeader.tsx:234-243`, `EvaluationNavigation.tsx:75-76`, both action hooks; zero Tooltip usage in Header.tsx | Product decision: hide vs explain. Add Tooltip copy ("not available for your account") at minimum on header menu trigger + course overflow item | unverified (non-blocking) |
| 4 | major | Data safety | React provider sends raw attribute objects to the SDK, bypassing `sanitizeFeatureFlagAttributes`; the sanitizer is dead code on the shipped browser path while docs advertise filtering. No active leak today (Manage passes only id/actorType/role), but the contract hole invites future PII leakage | `react.tsx:37` `void growthbook.setAttributes({ ...attributes, environment })` vs sanitized wrapper at `browserClient.ts:52-57` (unused) and node.ts:88 (used); type allows arbitrary extra keys (`contracts.ts:39-46`) | Route react.tsx through the client's sanitized setter; add vitest regression asserting non-allowlisted keys drop | unverified (non-blocking) |
| 5 | minor | Failure modes | Timed-out init keeps fetching in background; late payload can flip controls disabled→enabled minutes later (safe direction only; SSE stream also stays open) | SDK 1.6.5 `promiseTimeout` note "will continue running in the background"; `refreshInstance`→`_render()` re-renders subscribers | Document eventual-consistency in docs/feature-flags.md or set `subscribeToChanges: false` | unverified |
| 6 | minor | Failure modes | Provider ignores config-object identity changes after mount — latent only (config is module-level const today) | `react.tsx:29-31` config absent from deps; `ManageFeatureFlagProvider.tsx:16-19` module const | Drop config from props or dev-warn on differing config | unverified |
| 7 | minor | Failure modes | Unrecognized `NEXT_PUBLIC_ENV` permanently disables all flags with browser-console-only signal (well-controlled today: CI derives value mechanically from ref name) | `contracts.ts:96-97`; workflow line `NEXT_PUBLIC_ENV=${{ startsWith(github.ref,'refs/tags/') && 'production' || 'staging' }}` | Covered by condition 2's signal work | unverified |
| 8 | minor | Failure modes | No error boundary in frontend-manage; a throw inside the provider stack blanks all 26 pages instead of degrading fail-closed | Repo-wide grep: zero ErrorBoundary/componentDidCatch matches; provider wraps entire layout subtree | Wrap provider subtree in small boundary rendering ungated layout (flag defaults false) | unverified |
| 9 | minor | Data safety | `publicPreview` now fully orphaned (read-orphaned by this PR; already write-orphaned before): zero readers remain, seeds still write it, GraphQL exposure retained per plan | `user.prisma:110`, `schema/user.ts:38`, consumers removed at 5 sites; ADR 0008 reserves deletion as separate decision | Mark exposure `@deprecated`; track cleanup item | unverified |
| 10 | minor | Data safety | B-spec leaves fabricated seed state (seeded microlearning flipped PUBLISHED + synthetic Element/stack created, never reverted); serial single-worker run order exposes ~26 downstream specs, bounded by next globalSetup reseed | `playwright/util/fixtures/manage.ts` prepareSeededMicroLearningEvaluation; spec afterAll restores only lecturer flag; `fullyParallel:false, workers:1` | Restore status/delete element in afterAll, or fabricate on throwaway activity | unverified |
| 11 | minor | Docs & operability | No troubleshooting/runbook entry for any new failure mode (unreachable SDK, wrong key, unknown env, CORS block); symptom→diagnosis→remedy prose absent from docs/solutions, AGENTS.md | `git grep growthbook AGENTS.md` empty; sole failure prose is generic list at `docs/feature-flags.md:224` | Add docs/solutions entry: symptom "analytics controls disabled despite targeting" + checks (env value, bundle vars present, SDK request + CORS) | unverified |
| 12 | minor | Docs & operability | On-call surface half-documented: toggle mechanics clear, no named owner, checklist step 6 abstract; verification recipe missing | `docs/feature-flags.md:260-277` checklist; ADR 0008 asserts operational ownership nowhere concretely | Name owning team in Active flags table; add one-line verify recipe (targeted lecturer sees enabled `data-cy="analytics"`) | unverified |
| 13 | minor | Docs & operability | Init timeout default (2000 ms) undocumented — operators can't predict fail-closed latency | `browserClient.ts:40` vs no timeout mention in changed docs | Document default + override in Browser adoption section | unverified |
| 14 | minor | Docs & operability | Local-dev flag story has code but no developer-facing entry point (.devcontainer README/AGENTS.md/testing.md silent; newcomer gets silently-disabled UI) | `util/_with_local_test_origins.sh:32-33` exports unreachable `growthbook.test`; mock fixture accurate in docs:136-138 | Add short "developing against feature flags" note to getting-started or feature-flags doc | unverified |
| 15 | minor | UX | Flash-of-disabled then flip-to-enabled on targeted lecturers' controls (init resolves async post-mount, ≤2 s) on every full page load | `useFeatureIsOn` starts false until init lands; init in post-mount effect | Tri-state (`undefined`=initializing) + subtle loading treatment, or accept/document the flap | unverified |
| 16 | minor | UX | Analytics bolt icon stays bright orange while menu text grays out — mixed visual signal | `Header.tsx:167` unconditional `className:{icon:'text-orange-400'}`; DS disabled styling recolors text only | Make icon class conditional on flag state | unverified |
| 17 | minor | UX | Async-evaluation toolbar button now rendered (disabled) for ALL lecturers incl. those previously shown nothing — dense task surface, product sign-off worth confirming | `EvaluationNavigation.tsx:73-76` | Confirm intent; consider hide-over-disable here specifically | unverified |
| 18 | minor | Performance | Bundle adds ~15–20 KB gzipped to shared Layout chunk across all Manage pages (small-class SDK, acceptable) | Exact pins `@growthbook/growthbook(-react)` 1.6.5; local gzip measurement of dist = 15.3 KB | None needed; noted for awareness | unverified |
| 19 | minor | Performance | One cold features-fetch per tab per session (localStorage SWR cache, 1 h fresh/4 h maxAge); possible long-lived SSE channel per tab if endpoint advertises it; warm navigations cost 0 HTTP | SDK 1.6.5 `gbFeaturesCache` localStorage; `allowStale:true` init; SSE backoff cap 5 min | If hosted plan meters connections, confirm SSE concurrency expectations | unverified |
| 20 | minor | Deploy & rollback (synthesized) | APQ hash rotation replaces UserProfile hash in server.json → stale pre-deploy bundles get PersistedQueryNotFound until browser picks up new bundle; pre-existing process property shared by every op-editing PR, no data impact | Old hash deleted, new added (`public/server.json`); backend resolves known hashes only, `allowUnpersistedOperations` dev/test-only (`app.ts:139-143`) | Deploy backend+frontend in one window; optionally retain prior hashes one cycle | unverified |
| 21 | minor | Deploy & rollback (synthesized) | Rollback itself is clean: plain revert restores prior UI exactly; GrowthBook-side flag/config is external and inert afterward; no migration to unwind; turbo.json globalEnv coverage verified present | Diff touches no prisma/migrations; `turbo.json:68-70` includes both NEXT_PUBLIC_GROWTHBOOK vars; workflows map stg/prd variables through Dockerfile ARGs | None — recorded so rollback confidence is explicit | unverified |
| 22 | minor | Data safety | Nothing durable created: client-side flag evaluation only, no sticky-bucket/payload persistence configured; backup scope unchanged | `browserClient.ts` passes no persistence-enabling options | None | unverified |
| 23 | minor | Observability | E2E mocks ensure CI always sees flag-on against a mocked SDK — a production regression evaluating permanently-false would pass green | `playwright/util/fixtures.ts:144-150` auto fixture `mockGrowthBookLearningAnalytics(page, true)` `{auto:true}` | Add one E2E without mock asserting real disabled rendering path | unverified |
| 24 | minor | UX | i18n verified clean: all consumed keys exist in both locales (checked programmatically); copy nits: ASCII "..." instead of "…", mixed-language DE values (pre-existing register) | `packages/i18n/messages/{de,en}.ts` at head | Optional copy pass | unverified |

**Refuted/non-issues** (chased and killed, recorded to stop re-litigating):

| claim | refuting evidence |
| --- | --- |
| Disabled parent dropdown might leave child links reachable | Design-system `Navigation.tsx:335` renders `MenubarContent` only when `!disabled` — content is null; Radix sets aria/data-disabled + pointer-events-none |
| Strict Mode destroy race could kill live client | `react.tsx:44-55` destroy timer cleared synchronously within same task; `reactStrictMode:true` confirmed; sound |
| Session switch (user.id change) without remount mis-targets flags | attributes memoized on `[user.id, user.role]`; setAttributes effect re-applies to live client |
| Enabled→disabled flicker after timeout | Failed refreshes never apply data; direction is disabled→enabled only |
| Flag gate weakens authorization | No API/route/auth code touched; direct routes keep normal boundaries; confirmed by file census |
| PII leaks to SDK as shipped | Sanitizer output is {actorType, environment} + conditional id/role; email/name never enter attributes (provider destructures id/role only) |

## Not checked

Every gap declared by workers, with reasons:

- **Runtime/browser behavior of head `bbb07d7ed`** — no devrouter workspace serves this unmerged head; starting servers was outside worker authority (static fallback declared by UX/performance workers). Includes: actual flash-of-disabled magnitude (condition 15), screen-reader behavior of disabled Radix menubar triggers, layout shift.
- **Deploy & rollback worker incomplete** — stopped twice by tool-permission denials despite local-only boundary; its charter was synthesized from overlapping evidence of other workers (migrations: Data safety V1; APQ rotation: F20; env wiring/workflows/turbo.json: Observability F2 + Docs verifications). Original revert-window analysis beyond F21's summary was not independently produced.
- **GitHub Actions repository variable values** (`NEXT_PUBLIC_GROWTHBOOK_*_STG/PRD`) populated or not — lives in GitHub settings, outside read-only repo scope. Condition 2 covers the failure mode either way.
- **Live GrowthBook instance state**: targeting rules, CORS configuration, SDK connection health, whether endpoint advertises SSE — external system.
- **Required GitHub checks on `bbb07d7ed`** — network commands prohibited for workers; normal preflight owns exact-head CI.
- **Org-level monitoring outside the monorepo** (e.g., externally managed Sentry) — no in-repo evidence either way; condition 2 assumes none (conservative).
- **Playwright suite execution** — requires provisioned runner stack; test logic verified by inspection only.
- **Real bundle deltas per page** — builds forbidden; weight estimated from dist measurement (confidence 75).

## Handoffs

Findings belonging to other gates:

- **Condition 1 (Layout error condition)** — correctness/regression review territory → belongs in `$code-review` scope for this PR; recommend fixing in this PR rather than deferring.
- **Conditions 3, 15, 16, 17 + copy nits (24)** — interaction/visual design quality and accessibility confirmation need a live-browser pass → `$web-design-guidelines` / `$impeccable` with `agent-browser` once a runner serves this branch.
- **Finding 4 (sanitizer bypass)** — latent contract vulnerability adjacent to code-level security review; primarily a fix-now recommendation, but its resolution should be confirmed under `$security-review`.
- **Standing-gate absence overall** — no `$code-review` / `$security-review` / combined-final artifacts exist for this head; those gates should run per their own triggers before merge.
- **Test-data hygiene (findings 10, 11)** — routine e2e maintenance; fold into normal slice review, not readiness.
