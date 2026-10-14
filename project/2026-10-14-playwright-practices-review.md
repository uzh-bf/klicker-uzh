# Playwright practice review and implementation pilot

Date: 2026-10-14. Baseline: `v3-ai` at
`be6ae67368b3249dc01c2284bd6a8d66812a062d`. Package range `~1.58.0`, lockfile
resolution **1.58.2**. Sources below were checked on this date; newer documentation
may describe APIs beyond the installed version. No dependency upgrade is proposed.

## Recommendation and relationship to existing work

Keep the current production-built, real-service Playwright suite. Improve it in
small behavior-preserving slices, beginning with observable wizard transitions and
retaining the evidence from successful retries. Pair AI-assisted generation with
explicit product contracts and a review gate that cannot repair failures by
weakening the test.

This is the implementation follow-on to [draft #6516](https://github.com/uzh-bf/klicker-uzh/pull/6516),
which already proposes the general behavior-first hygiene procedure, inventory,
review rubric, and corrections to stale draft-CI/test-count guidance. Prefer that
PR first, then reconcile the small additive skill change here. This PR does not
copy its inventory or general audit. Coverage measurement and static analysis are
separate proposals; neither source coverage nor a green retry is evidence of
behavioral completeness.

## General practice and repository assessment

| Practice                                                | Inspected state                                                                                                                                                                                                                                                  | Recommendation                                                                                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Assert user-visible behavior                            | Strong end-to-end lifecycle, role/permission, reload, keyboard/focus, and streamed UI contracts exist. Some translated tests retain Cypress-style assertion adapters                                                                                             | Preserve those contracts; use native web-first assertions in new code. Do not rewrite working wrappers just for appearance                                                                 |
| Prefer observable waits                                 | 583 `waitForTimeout(` text matches in 27 of 49 active spec files. No `networkidle` match in active specs. `selectOption` in `playwright/util/fixtures/activities.ts` also sleeps before immediate candidate checks                                               | Pilot one wizard boundary, then diagnose high-frequency helper races using failed-attempt evidence. These static matches are leads, not 583 proven flakes                                  |
| Use stable locators                                     | `testIdAttribute: 'data-cy'` is an intentional application/test contract; newer tests also use roles and labels. Long flows contain XPath ancestry and `.first()` fallbacks                                                                                      | Prefer role/name for meaningful semantics and scoped test IDs for repeatable rows. Replace structural selectors only after verifying uniqueness and preserving behavior                    |
| Isolate tests and data                                  | Fresh browser contexts, disposable-database guard, seeded roles and reusable fixture helpers are strengths. Eight files contain serial declarations; entire specs are sharded. Global/per-spec cleanup and shared fixed fixture identities constrain parallelism | Keep current serial boundaries until a feature has worker-owned accounts/data and independent setup/cleanup. Never enable `fullyParallel` as a mechanical optimization                     |
| Separate authentication setup from authentication proof | `authSession.ts` signs synthetic JWTs; helpers bridge origins and some workflows retain IndexedDB between tests                                                                                                                                                  | Reuse existing fixtures for non-login journeys. Keep dedicated sign-in, cookie/PIN, denial and reload checks. Do not treat fast fixture login as SSO/authentication coverage               |
| Diagnose retries, do not hide them                      | CI retries once; traces use `retain-on-failure`, screenshots only on failure. JSON/HTML/JUnit exist and flaky outcomes are summarized. Diagnostics upload was conditional on job failure, losing retained artifacts after a green retry                          | Keep retry count unchanged. Upload the existing bounded diagnostics on flaky outcomes; measure first-attempt outcomes separately                                                           |
| Type-check and lint browser tests                       | Playwright has a package TypeScript check, but 9 active specs contain `@ts-nocheck`. Root checks do not give those files full type guarantees                                                                                                                    | Convert one isolated helper/spec at a time. Consider targeted no-floating-promises/Playwright lint rules with an explicit legacy baseline; do not enable a huge blocking lint gate at once |
| Check browser/runtime relevance                         | Production Next standalone artifacts and runtime profiles are verified in CI. Chromium is the normal project; Firefox/WebKit are opt-in release projects                                                                                                         | Retain production-stack proof and add other browsers only for agreed high-risk contracts. Keep mobile viewport/keyboard checks distinct from cross-browser execution                       |

Inventory method: count text patterns in tracked `playwright/tests/**/*.spec.ts`,
excluding `playwright/example`. Counts describe source, not executed cases, runtime
coverage, or failure probability. The pilot removes seven waits; the other 576
remain outside this change. No spec, case, permission assertion, selector policy,
retry budget, or fixture setup is removed.

Key inspected files: `playwright/playwright.config.ts`, `playwright/global-setup.ts`,
`playwright/util/{fixtures,workflow,authSession}.ts`,
`playwright/util/fixtures/{activities,auth}.ts`,
`playwright/tests/O1-live-quiz-core.spec.ts`, the `Y-*` browser contracts,
`.github/workflows/{test-playwright,public-pr-playwright-shards,check}.yml`,
`.github/actions/playwright-shard/action.yml`, and the existing Playwright skills.

## AI-assisted practice

The [official test agents](https://playwright.dev/docs/test-agents) divide work into
planning, generation and repair. That is useful structure, not a replacement for
an independent expected-behavior specification. Their version-pinned
[1.58.2 healer](https://github.com/microsoft/playwright/blob/v1.58.2/packages/playwright/src/agents/playwright-test-healer.agent.md)
allows unresolved failures to become `test.fixme`; adopt no automatic healing
policy with that permission. Product bugs must stay visible.

For Klicker, give an agent the actor, disposable fixture, relevant existing spec,
expected outcomes, denial/recovery cases, permitted files, and commands. Require
inspection of the live application before inventing locators. Review the scenario
plan before generating a broad diff; then review what regression each assertion
would detect. Repair should distinguish an infrastructure outage, stale selector,
data collision, and genuine product regression before editing anything.

[Playwright CLI](https://github.com/microsoft/playwright-cli) and
[Playwright MCP](https://github.com/microsoft/playwright-mcp) are complementary:
the maintainers describe CLI/skills as more context-efficient for coding agents
and MCP as useful for richer persistent exploration. This is a vendor positioning
claim, not a benchmark of Klicker. The repository already has CLI/browser skills;
keep that setup rather than install another external skill collection. Review
versioned definitions during upgrades and retain explicit tool/data boundaries.

The added [authoring contract](../docs/playwright-authoring.md) makes these checks
repeatable. The vendored generic waiting guide also replaces its contradictory
`networkidle` example with an observable UI assertion.

## Draft implementation and behavior parity

### Wizard pilot

`O1-live-quiz-core.spec.ts` changes only two existing adjacent wizard tests:

| Journey                          | Before                                                                   | Draft replacement                                                                                         | Existing behavior retained                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Add/delete blocks                | Three 500-ms sleeps between name, description, settings and block editor | Wait for display-name field, then course selector; existing auto-retrying block count waits for editor    | Cancel/reopen, one/many selection labels, add to existing/new blocks, exact content, deletion and final block count             |
| Create quiz and inspect settings | Four 500-ms sleeps around Next/Back transitions                          | Identify description/settings by their own fields; verify name, display name and description survive Back | Required-field disabled checks, course/gamification/multiplier selection, advanced settings, and all later assertions unchanged |

Next/Back controls are reused across steps, so their click actionability alone is
not the postcondition. The inspected wizard components mount step-specific fields;
these field contracts are the proposed readiness signals. Existing assertions are
preserved in order. New value checks strengthen the already exercised Back path.
The change does not prove a reliability improvement until execution evidence is
available; 3.5 seconds of removed fixed delays is not a measured wall-clock saving.

### Retain passed-on-retry evidence

The existing summary helper writes a numeric `flaky-count` to the trusted
`GITHUB_OUTPUT` file. The existing diagnostics upload runs after failure or a
nonzero count, excluding cancellation. Names, paths and one-day retention remain
unchanged. Tests cover nested flaky outcomes, stable/skipped/failed outcomes,
missing/malformed reports, output isolation, and action wiring. No new workflow,
credential, reporting service, or paid model call is introduced.

The action and helper at trusted `v3` commit
`b0816ed467609ce7d056a31e405a293aa7fabdbe` had the same failure-only retention gap
when inspected. Both hosted and public routes execute that trusted action, so a
candidate PR cannot demonstrate its own orchestration change in production CI.
Rollout requires normal reviewed promotion to `v3`, then synthetic artifact
inspection. Do not alter the trusted action reference to obtain a green canary.

## Prioritized follow-on plan

| Priority | Bounded slice and proposed reviewer                                                          | Acceptance evidence                                                                                                                                                                                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | CI maintainer: land/reconcile #6516 guidance; review this retention delta                    | Exact-head run plan distinguishes executed, skipped and reused evidence; after trusted promotion a synthetic fail-then-pass retains failed-attempt trace/JSON, stable runs add none, failing runs still retain diagnostics; artifact privacy inspected                                                               |
| P1       | Live-quiz maintainer: run and review this wizard pilot                                       | Complete O1 serial workflow passes on production-built Chromium; no unexpected skips or removed contracts. Repeat the full file with its prerequisites and zero retries on a supported disposable host. Temporarily block one step transition and require the new state assertion to fail before restoring/rerunning |
| P1       | Test maintainer: one observed helper race, starting with `selectOption` if traces support it | Register/await the actual menu option state, preserve all supported widget variants and behavior; regression examples include delayed appearance and ambiguous matches. No blanket helper rewrite or fallback proliferation                                                                                          |
| P2       | Feature owner: one independent workflow's fixture/type cleanup                               | Typed fixtures with teardown, no new `ts-nocheck`, setup works in isolation and alongside peers. Remove shared ordering only after independent data ownership is proved                                                                                                                                              |
| P2       | CI/test maintainers: incremental browser lint and measurement                                | New/changed tests reject missing awaits and avoid new hard waits; baseline debt remains explicit. Record first-attempt failure rate per executed case, retry count, duration and exact revision over a representative run window                                                                                     |
| P3       | Release owner: risk-based browser/device expansion                                           | Select real supported-browser risks such as cookies, storage, drag/drop, focus and downloads; run Firefox/WebKit against production-built stack, not a token all-browser smoke with no meaningful assertions                                                                                                         |

Stop expanding a slice when its expected behavior is uncertain or it exposes a
product/runtime defect. Report that defect; do not increase timeouts, skip the
case, change expectations, or weaken a denial/accessibility check to force green.
No percentage-coverage threshold, automatic healing, or broad test deletion is
part of this proposal.

## Verification record and limits

Local checks and exact-head hosted CI results are recorded in the PR description.
The cloud checkout has no supported devrouter/Docker host stack. Its Playwright
host-boundary policy is respected: no fake CI variables, raw container browser
execution, or destructive database setup was used. Local application/browser,
root aggregate checks and full build are not claimed from focused script tests.

Draft status does **not** imply skipped Playwright. At the inspected baseline,
`test-playwright.yml` sends open drafts to the trusted execution envelope; actual
selection comes from its plan and rollout controls. A fresh inspection of
[run 38627934384](https://github.com/uzh-bf/klicker-uzh/actions/runs/38627934384)
for unrelated draft #6525 found all eight hosted shard steps and the status gate
successful. That confirms the workflow interpretation, not this pilot's behavior
or a zero-flake rate. #6516 already corrects stale skill/wiki claims to the contrary.

## Primary sources

- [Best practices](https://playwright.dev/docs/best-practices): user-visible contracts, locators, web-first assertions, tracing and linting
- [Actionability](https://playwright.dev/docs/actionability) and [Page API](https://playwright.dev/docs/api/class-page#page-wait-for-load-state): action checks are not application postconditions; `networkidle` is discouraged for tests
- [Fixtures](https://playwright.dev/docs/test-fixtures), [authentication](https://playwright.dev/docs/auth), and [parallelism](https://playwright.dev/docs/test-parallel): explicit setup/teardown and state ownership
- [Retries](https://playwright.dev/docs/test-retries) and [trace viewer](https://playwright.dev/docs/trace-viewer): first-attempt vs flaky outcomes, serial retry behavior and diagnostic evidence
- [Test agents](https://playwright.dev/docs/test-agents) and [version-pinned healer instructions](https://github.com/microsoft/playwright/blob/v1.58.2/packages/playwright/src/agents/playwright-test-healer.agent.md): inspect the actual repair policy before adopting it
- [Official CLI](https://github.com/microsoft/playwright-cli) and [MCP](https://github.com/microsoft/playwright-mcp): interaction choices and security boundaries
