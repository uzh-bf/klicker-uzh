---
type: Testing Guide
title: Test coverage measurement
description: Separate unit, integration, browser and journey evidence; a source-mapped Chromium pilot and a staged rollout plan.
timestamp: '2026-10-14'
tags:
  - testing
  - ci
  - coverage
---

# Test coverage measurement

## Recommendation

Keep coverage as a **risk-discovery signal**, split by runtime, package and test
layer. First make denominators explicit, then baseline representative journeys.
Do not introduce an arbitrary percentage gate, combine incompatible percentages,
or interpret executed code as evidence that its behavior was asserted.

This proposal complements [the testing guide](testing.md) and the
[behavior-first test hygiene review, PR #6516](https://github.com/uzh-bf/klicker-uzh/pull/6516).
It adds a small, isolated browser experiment, not a replacement for existing tests.

## What exists in Klicker

Inspected `v3-ai` commit `be6ae67368b3249dc01c2284bd6a8d66812a062d`:

- pnpm/Turbo workspace with five main Next applications, Node services and shared
  packages. Next is **16.3.4**, Playwright resolves to **1.58.2**, and Vitest plus
  its V8 provider are pinned to **3.2.4**. Next production commands use Turbopack.
- `.github/workflows/test-unit.yml` already requests V8 LCOV for **chat, auth,
  grading, markdown and util**. Auth separates unit, handler-integration and
  built-HTTP projects; the built-HTTP project is run separately without coverage.
  The PWA's Node-runner tests execute without LCOV in this workflow.
- `.github/workflows/test-graphql.yml` produces separate GraphQL V8 LCOV. Its
  real-service integration execution must remain serialized and disposable.
- Auth explicitly includes `src/**` and excludes `src/types/**`; several other
  Vitest configs rely on defaults. Importantly, **Vitest 3.2.4 defaults to
  `coverage.all: true`**. Current/latest documentation describing imported-only
  defaults must not be applied retroactively. Explicit source globs should make
  the package denominators stable across future upgrades.
- `sonar-coverage-inputs.cjs` verifies producer revision/tree receipts and rewrites
  LCOV paths. Its current producer lookup is PR-only; branch analysis has no PR
  producers. A successful test status or a Sonar scan does not imply coverage was
  imported. Browser results in this prototype are deliberately not imported.
- The ordinary Playwright config discovers **49 active spec files** under
  `playwright/tests`, uses Chromium, one worker by default, global disposable DB
  cleanup/seed, `data-cy` selectors and one retry in CI. File counts are inventory,
  not executed cases or requirements. Specs frequently create additional pages
  and contexts through shared fixtures for lecturer/participant workflows.
- CI builds real Next production runtimes via `playwright-next-runtime.mjs` and
  uses trusted `v3` actions and profile-aware whole-spec sharding. Local host runs
  use the devrouter development stack. Those build flavors are not comparable
  baselines. The actual current caller does allow drafts into the execution
  envelope; its trusted selector decides full/selected/skip.
- No browser JS collector is wired into that suite. Existing auth navigation,
  persisted state and route behavior are useful initial slices, but login helper
  execution alone cannot establish auth-server or authorization coverage.

## Four different questions

| Evidence                           | Denominator and use                                                                                   | Important blind spot                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Unit/integration source coverage   | Eligible executable statements, lines, functions and branch outcomes in a declared package source set | Mocks, weak assertions and untested outcomes can still execute lines                                                       |
| Browser JS coverage                | Code emitted to the browser and observed by the collector, remapped to original client sources        | SSR, RSC server code, API/resolvers, workers and unvisited/lazy bundles are not measured automatically                     |
| Server process coverage during E2E | Explicit Node service processes, their child processes and eligible built/source modules              | The Playwright test runner's own coverage is not application-server coverage                                               |
| Journey/requirement coverage       | Named behaviors, roles, states, negative paths and externally meaningful outcomes with assertions     | A code percentage cannot tell whether enrollment, access denial, recovery, accessibility or grading correctness was tested |

Lines and statements answer different execution questions; functions indicate
entry, and branches indicate distinguishable outcomes in the selected coverage
model. Report numerator/denominator as well as percentages. For example, ten
covered lines in a loaded ten-line module say nothing about an unloaded
thousand-line route. Sum compatible counts over a deduplicated source universe;
never average package percentages. Keep changed-code views next to absolute
uncovered counts and risk, not as a substitute for them.

Use mutation tests or a targeted fault injection for high-risk pure logic when a
high coverage number looks reassuring but assertion strength is unclear. Keep
fault injection bounded and reversible, and never run destructive experiments
against retained data. There is no coverage-driven test deletion proposal here.

## Collection options and current compatibility

### Chromium V8: selected for this prototype

[Playwright's Coverage API](https://playwright.dev/docs/api/class-coverage) is
Chromium-only and collects JavaScript function/block ranges. Start before the
first navigation, set `resetOnNavigation: false` when a journey crosses reloads,
and stop before the page closes. Each page needs its own collector; popups and
explicit `browser.newContext()` pages are not captured by a fixture that wraps
only the default `page`. Service workers and workers require a separate strategy.
This pilot intentionally has one page, blocks service workers and makes no
cross-browser coverage claim.

Use production source maps with the exact compiled asset. The collector reads
maps from the local build, checks executed JS against that build, flattens indexed
maps, admits a narrow first-party source namespace, and checks mapped original
source content against the checkout. A missing auth-page mapping fails the
measurement rather than reporting a vendor-only success. Missing map counts and
excluded script/source counts remain visible in each summary.

[Next's source-map option](https://nextjs.org/docs/app/api-reference/config/next-config-js/productionBrowserSourceMaps)
also makes maps serveable and increases build cost. The existing shared config
already enables maps for `NEXT_PUBLIC_ENV=staging`; this prototype does not alter
that policy. Its auth-only flag additionally requires real CI, production mode
and synthetic fixture mode. Normal production defaults remain unchanged. The
coverage build directly invokes the app builder outside Turbo, preventing an
instrumented/test flavor from contaminating a normal application cache entry.
Never deploy or upload this disposable build or its maps.

The Playwright example uses `v8-to-istanbul`. This pilot instead uses the
[AST-aware converter](https://github.com/AriPerkkio/ast-v8-to-istanbul), with Acorn
and Istanbul's coverage-map merger. All four direct dev dependencies already
existed at these locked versions transitively. This avoids treating every source
line, including blank/non-executable lines, as an executable statement. Still,
its input AST is **compiled JS**: SWC/minification/tree shaking and map fidelity
can change branch/function identity relative to unit coverage. V8 also has
limitations around default arguments and code after a throw. Do not merge this
pilot's branch data into the Vitest baseline merely because both emit an
Istanbul-shaped result.

### Istanbul instrumentation: viable follow-up, not the first change

[babel-plugin-istanbul](https://github.com/istanbuljs/babel-plugin-istanbul) inserts
counters and can support multiple browser engines if the application exposes
those counters. That changes the compilation/runtime being tested, needs
collection from every page/context, and needs an isolated build flag plus
source-map-chain validation. Modern [Next 16 Turbopack supports Babel configs](https://nextjs.org/docs/app/api-reference/turbopack),
while retaining SWC for internal transforms; the older blanket statement that
Babel always disables SWC is specific to webpack. A generic webpack Istanbul
loader recipe therefore is not a drop-in for this repository. Third-party SWC
plugins also need exact compiler-ABI validation. None is introduced here.

### Server-side E2E coverage: a separate workstream

Node's [NODE_V8_COVERAGE](https://nodejs.org/docs/latest-v24.x/api/cli.html#node_v8_coveragedir)
and [c8](https://github.com/bcoe/c8) can collect/report application-server V8
execution without a browser. Set coverage on the actual backend/Next/worker
processes, not only on the Playwright runner. Plan graceful shutdown/flush,
per-process and per-shard output, server source maps, generated-code exclusions
and startup/background-job attribution. Distinguish activity caused by tests from
startup and asynchronous workers. Never instrument the production deployment or
claim browser counters measure GraphQL authorization.

## Isolated prototype and reproduction

The experimental `test-playwright-coverage.yml` workflow runs on changes to its
pilot/config files and can be manually dispatched once present on the repository's
default workflow ref. It is a separate hosted job with read-only repository
permission, no credentials, database, paid model, cache writes or deployment.
The normal E2E selector, retries, assertions and gates are unchanged.

It runs the actual production-built auth UI with a synthetic anonymous session
response. The browser permits only the local auth origin. Two fresh contexts
compare (1) landing and disabled login controls, and (2) checkbox activation,
control enablement, reload persistence, reversal and disabled controls. Neither
flow clicks login or contacts Edu-ID. This is a browser UI measurement, **not an
end-to-end authentication test**.

The workflow is the canonical executable recipe in the matching official
Playwright 1.58.2 container:

```sh
pnpm install --frozen-lockfile
pnpm --filter @klicker-uzh/playwright test:coverage-tools
pnpm --recursive --filter='@klicker-uzh/auth^...' --workspace-concurrency=4 run build
KLICKER_BROWSER_COVERAGE=1 pnpm --filter @klicker-uzh/auth build:test
KLICKER_BROWSER_COVERAGE=1 pnpm --filter @klicker-uzh/playwright exec playwright test --config=coverage.config.ts
```

The job supplies synthetic auth environment values; `build:test` itself sets
production and fixture mode. Do not spoof CI flags or run this in a local
container to bypass the repository's host-only browser policy. Local Node-only
collector tests are safe without a browser. A supported host production-mode
entry point is a later usability improvement, not an unverified command here.

Only `playwright/test-results/coverage-pilot-summary/*.json` is uploaded, for
seven days, after both tests succeed. Summaries contain the exact commit, build
ID, browser version, source hashes, relative paths, uncovered line numbers,
metrics and collection diagnostics. Raw V8 entries, bundle source, maps, traces,
HTML, screenshots, sessions and network bodies are never uploaded.

**Denominator:** mapped eligible source portions in **loaded** browser chunks,
limited to auth, shared-components, i18n and util source paths. Excluded: server
APIs/SSR, generated/unmapped code, type/test files, framework/vendor modules,
other applications, unloaded modules and workers. This is neither all-auth nor
whole-monorepo coverage. The report includes source files actually measured so
reviewers can inspect the denominator rather than trusting a headline number.

### Measured result

Pending the first hosted run. Do not treat the collector unit-test fixture as an
application coverage baseline. Exact-commit, numerical findings will be recorded
here after the actual browser run completes.

## Rollout plan and acceptance criteria

1. **Stabilize existing package denominators.** Inventory which unit/integration
   suites actually run per CI selection; declare source include/exclude policies,
   generated-code exclusions and provider versions for each. Keep explicit
   uncovered-file inclusion in the pinned Vitest 3 configuration. Validate a
   never-imported eligible file remains uncovered. Record skipped, missing,
   failed and zero-coverage states distinctly.
2. **Validate this pilot.** Require both journeys to pass, exact build/source
   identity, a mapped auth page and meaningful uncovered outcomes. Review a few
   source locations against the UI interactions and compare landing versus
   reload. Record cold build and collection cost before scaling. Keep any
   compiler/remapper mismatch a visible limitation or failure, not a hidden
   exclusion used to improve the percentage.
3. **Integrate representative existing journeys.** Choose auth, lecturer quiz
   authoring and participant answering/recovery slices by risk. Extend the common
   context/page factories so coverage starts before the first navigation for
   every page, including popup/multi-role pages; prove coverage survives closing
   and reloads. Preserve the real assertions and disposable seeds. Attach an
   explicit behavior matrix to each slice; include denial/error/recovery and
   accessibility cases. Run this as an opt-in lane before the full suite.
4. **Make CI aggregation trustworthy.** Extend the trusted `v3` build/artifact
   contract through its own reviewed rollout. Candidate branches cannot change
   trusted actions merely by editing their local copies. Add an explicit
   coverage build flavor/cache key, exact source/map receipts, unique
   shard/test/attempt identities, completeness validation and source-hash-based
   union. Preserve failed/first-attempt diagnostics separately; never let retries
   inflate success or merge incompatible builds. For an all-client denominator,
   enumerate eligible emitted modules including unvisited chunks and mark those
   zero; record tree-shaken source separately rather than pretending it executed.
5. **Add server coverage independently.** Pilot one Node API service with
   deterministic requests and a verified flush, then workers/Next SSR where
   useful. Keep per-service attribution. Add Node-runner coverage for PWA pure
   logic separately if it closes a meaningful gap.
6. **Publish useful baselines before gates.** Show package/runtime/layer,
   numerators, denominators, uncovered risky files, journey gaps and flake/cost
   evidence. Repair/verify Sonar branch-producer ingestion separately. Consider
   LCOV import only after mapping/deduplication parity is demonstrated; maintain
   browser/server reports even if a combined view is later offered. Establish
   ownership and a representative run window, then choose justified
   changed-code policies with explicit exemptions. No universal 80% target.

A useful outcome is a missing assertion or risk-focused test, not a larger
percentage. Coverage is one input to review alongside behavior contracts,
production incidents, mutation evidence and test reliability.

## Primary references

- [Playwright JavaScript coverage API](https://playwright.dev/docs/api/class-coverage)
- [V8 precise function/block coverage model](https://v8.dev/blog/javascript-code-coverage)
- [Vitest coverage guidance](https://vitest.dev/guide/coverage.html), with
  [pinned 3.2.4 defaults](https://github.com/vitest-dev/vitest/blob/v3.2.4/packages/vitest/src/defaults.ts)
- [Next production browser maps](https://nextjs.org/docs/app/api-reference/config/next-config-js/productionBrowserSourceMaps)
  and [Turbopack/Babel compatibility](https://nextjs.org/docs/app/api-reference/turbopack)
- [AST V8 remapping and limitations](https://github.com/AriPerkkio/ast-v8-to-istanbul)
- [Istanbul Babel plugin](https://github.com/istanbuljs/babel-plugin-istanbul)
- [Node 24 coverage environment variable](https://nodejs.org/docs/latest-v24.x/api/cli.html#node_v8_coveragedir)
  and [c8 source-map/all-files reporting](https://github.com/bcoe/c8)

Research checked 2026-10-14. Latest documentation can describe a newer major;
repository versions and actual compiled behavior take precedence.
