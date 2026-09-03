---
name: klicker-playwright-e2e
description: Create, refactor, run, and debug Playwright E2E tests for KlickerUZH. Use when working in playwright/tests, fixing flaky Klicker Playwright specs, debugging local or GitHub Actions Playwright failures, or adjusting Playwright CI.
---

# KlickerUZH Playwright E2E

Use this skill for Klicker-specific Playwright work. Combine it with `playwright-best-practices` when generic Playwright API guidance is needed.

## Repo Map

- Active specs: `playwright/tests/**/*.spec.ts`
- User-moved/reference specs: `playwright/example` (do not touch unless explicitly asked)
- Playwright config: `playwright/playwright.config.ts`
- Shared fixtures: `playwright/util/fixtures.ts`
- Common workflow helpers: `playwright/util/workflow.ts`
- Activity helpers: `playwright/util/fixtures/activities.ts`
- Element helpers: `playwright/util/fixtures/elements.ts`
- Action-menu helpers: `playwright/util/actions.ts`

## Coverage And Parity Rules

- Preserve test count and test intent. Do not skip, merge, delete, or weaken tests to make the suite pass faster.
- Treat `playwright/tests` as the active suite. Ignore `playwright/example` for active parity unless the user says otherwise.
- Keep duplicate-title suffixes such as `[2]` when Playwright needs unique titles.
- Prefer behavior-preserving helper extraction over broad rewrites.
- Keep explicit Playwright assertions when they document important state; do not collapse them for brevity.

Useful check:

```bash
pnpm playwright:host -- --list --project=chromium
rg -n "test\\(" playwright/tests
```

## Local Test Setup

Run every local Playwright command from a **host shell** at the repository root.
The host launcher reconciles the exact devrouter workspace, maps all app URLs
and the worktree database, installs host-only Playwright dependencies and
browsers when missing, and then runs the browser on the host. The applications,
workers, and data services remain inside the devcontainer.

```bash
# list active Chromium tests without executing them
pnpm playwright:host -- --list --project=chromium

# focused specs
pnpm playwright:host -- --project=chromium tests/O-live-quiz.spec.ts

# full active Chromium suite
pnpm playwright:host -- --project=chromium

# inspect the resolved workspace without exposing credentials
pnpm playwright:host -- --print-env
```

Do not run `playwright test`, package-local raw scripts, browser installation,
or the host launcher through `devrouter exec` or a DevPod shell. The Playwright
config rejects direct local invocations before global setup, and the
devcontainer cannot store Playwright browser binaries. GitHub Actions is the
explicit exception and keeps running in the official Playwright container.

The launcher starts the full devrouter profile, including response-api and both
Hatchet workers. Ensure the response processor is not running with
`ASSESSMENT_MODE=true` when validating live quiz mode.

For `apps/chat` app-router recovery, authenticate the browser with a seeded
participant before exercising `/<chatbotId>` routes. Both a malformed ID and a
well-formed missing chatbot should assert the branded 404 and its response
status; an unexpected route failure must be fault-injected only in an
uncommitted local proof, restored before commit, and asserted against the
branded `error.tsx` retry/return surface without exposing the server error
text. Keep the `/noLogin` assertion focused on the login action and concise
return copy, not a raw redirect URL.

For chat settings coverage, seed credits through the existing `setCredits`
helper rather than mocking the credits route. A zero-credit response keeps the
chatbot's allow-listed models visible and preserves the selected usage class.
The runtime may choose only an allowed same-class fallback; when none exists,
it denies the turn instead of switching classes. Assert the neutral model-
availability notice in the sidebar-enabled mobile layout outside the closed
drawer. Set the viewport before `visitChat`; embedded chat already owns its
compact `EmbeddedCreditsBar` and should not receive the sidebar mobile bar.

For chat welcome coverage, assert that the chatbot name and selected mode
description are visible before clicking a starter. Starter clicks populate the
composer without sending; assert the value contains no square-bracket template
placeholder, then edit the value before sending. The initial mode descriptions
are passed with the chatbot shell so this journey should not wait for a second
render of the starter grid.

## Fast Failure Triage

- `net::ERR_CONNECTION_REFUSED`: the routed app is down, not a selector issue. Run `pnpm playwright:host -- --print-env` and inspect `devrouter exec . -- tail -f /tmp/dev.log` first.
- `ECONNREFUSED 127.0.0.1:7078`: `response-api` is not running.
- Hatchet `workflow not found`: the relevant Hatchet worker is not registered/running, often `hatchet-worker-general` for scheduled tasks.
- Sudden Firefox/WebKit execution: Playwright is running all configured projects. Pass `--project=chromium` or keep non-Chromium projects commented in config if Chromium-only is desired.
- UI mode does not automatically mean tests execute; prefer CLI runs for verification and use UI mode only for interactive debugging.
- A passing `CLEANUP` followed by immediate failures often means frontend apps or auth URLs are unavailable after setup.

Before blaming a test, probe the apps:

```bash
pnpm playwright:host -- --print-env
devrouter exec . -- tail -n 100 /tmp/dev.log
```

## Klicker Helper Patterns

Prefer existing helpers before adding new ones.

Action menus:

- Use `openActionMenuByTestId(page, triggerTestId, expectedActionTestId?)` for repeated Radix dropdown or menubar portals.
- Use `chooseActionByTestId(page, triggerTestId, actionTestId)` for generic action menus.
- Use `expectActionMenuItems(page, triggerTestId, { visible, hidden })` for permission matrices.
- Keep `chooseActivityAction(page, type, name, actionTestId)` for activity list actions.
- Avoid direct `await page.getByTestId(\`actions-...\`).click()` in shared/flaky flows.

Editors and selects:

- Use `fillEditorField` and `verifyEditorField` for Slate/rich-text fields.
- Use direct `toHaveValue` for ordinary inputs; do not wrap simple fields just for symmetry.
- Use `switchElementType` and `setElementStatus` for element modal dropdowns when applicable.
- Prefer `selectOption` from repo helpers for design-system selects.

Live quiz/student flows:

- Keep Playwright-only session complexity when it handles real browser behavior: PWA storage restore, participant cookies, response API cookies, PIN cookies, temporary participants, and gamified account prompts.
- Use the shared gamified prompt helper when available: accept the gamified live quiz dialog, log in with student credentials if redirected, then wait for `student-submit-answer`.
- Return to the student PWA home deterministically with `page.goto('/')` and `homepage` visibility instead of fragile `header-home` click loops.

Permission matrices:

- Use small row helpers and data arrays for owner, READ, EXECUTE, WRITE, ADMIN, and revoked checks.
- Preserve every action assertion when refactoring. Move repeated mechanics into helpers, not test meaning.

Cleanup dialogs:

- Some delete confirmations show optional response/started-instance buttons. Click those only if visible; otherwise proceed when the main confirmation is enabled.

## Authoring Gotchas

- **Fixture wiring**: when exposing a helper as a fixture, do not reference the fixture name from inside its own `test.extend` initializer — import the helper under a different name and bind it there, otherwise fixture resolution can fail and the Testing UI stops discovering tests. (`playwright/util/fixtures.ts`)
- **CLEANUP first**: workflow specs put `test('CLEANUP', cleanupTest)` at module scope before the `describe`, so filtered and spec-local runs still reset and seed the DB. (`playwright/util/cleanup.ts`)
- **Rich-text blur before `add-new-answer`**: blur the editor first by clicking `insert-question-title`; without it the new answer slot may not appear and `scrollIntoViewIfNeeded` times out. (`playwright/util/fixtures/elements.ts`)
- **Verify after reorder**: never click a `FastField`-wrapped `ContentInput` when verifying content after a `move()` — use `scrollIntoViewIfNeeded` + `toContainText` only; clicking can trigger a stale re-render showing the previous value. (`playwright/util/fixtures/elements.ts`)
- **react-select**: target the inner `<input>` via `#container-id input` for `.fill()`/`.press()`/visibility assertions — typing against the wrapper does not work. (`playwright/tests/K-elements-selection.spec.ts`)
- **localforage**: Playwright creates a fresh context per test, so IndexedDB does not carry across tests. Serial workflows depending on previous PWA answers must snapshot/restore localforage — and direct QR links may need restoration on the `https://pwa.klicker.com` origin, not `127.0.0.1`. (`playwright/util/workflow.ts`)
- **PIN-cookie bridges**: clear test-side PIN cookie bridges wherever a spec clears cookies, or later direct-link checks bypass the expected PIN form via a stale `live-quiz-pin-*` cookie. (`playwright/tests/O2-live-quiz-collaboration.spec.ts`)
- **Shardable serial workflows**: the timing-aware CI sharder assigns complete spec files. Split a long serial workflow only at a boundary where the new file can reset and seed its own database state. Repeated setup is expected when the files may land on different shards; never rely on spec-file execution order.

## CI Notes

- For Chromium-only CI, run with `--project=chromium`.
- Assign every active spec to the smallest sufficient profile in `playwright/profiles.json`. Each spec must appear exactly once; missing, stale, or duplicate entries fail `pnpm check:playwright-ci`. Both Playwright workflows pass each shard's canonical profile union through `devrouter profile plan`, the repository-owned `playwright/runtime-contract.yml`, and `util/playwright-profile-runtime.mjs`. The trusted planner may assign a candidate-only spec to `full`; the adapter resolves a trusted `full` union through the explicit `playwright` Devrouter profile, which contains every CI-supported app but none of the local-only optional services or processes. Keep that path fail closed, keep app-to-Turbo and endpoint mappings in the contract, and retain the adapter's exact binding-key and safe-literal checks. A caller checkout where all three profile-runtime files are absent may use the explicit legacy full-stack startup so open PRs created before the migration remain runnable; a partially present profile runtime must fail closed. Job service containers remain static because GitHub creates them before workflow steps.
- The Playwright CI cache contract is versioned and architecture-specific. It includes the lockfile, workspace and Turbo configuration, tracked package manifests, Node/pnpm versions, the synthetic build-environment schema, and the digest-pinned Playwright image. The trusted `v3` seed workflow is the only cache writer; hosted and public-PR jobs restore pnpm and `.turbo` state without saving it. Public PR restore remains disabled until an explicit global or exact-canary control is enabled, and any miss or unavailable cache must leave the normal build path valid. Read `playwright-build-telemetry`, shard telemetry, and the hosted `playwright-queue-telemetry` artifact before attributing a speed change to caching; these artifacts contain only route, cache, timing, task-count, runner, and status metadata.
- Specs that publish, schedule, start, or end activities must include `live-quiz` in their manifest profile so both Hatchet workers run. Do not rely on another spec in the same timing-balanced shard to supply this dependency.
- The public ARM64 pool is one backend of the pinned `public-pr-playwright-shards.yml` execution envelope. A hosted preparation job computes one trusted route and one canonical selector plan; the hosted and public build/shard jobs consume that same plan, so backend choice cannot change the selected tests, profiles, shard count, artifacts, or status semantics. The execution jobs call the trusted `v3` composite actions remotely; candidate code supplies source and tests but cannot replace the orchestration action. Ready PRs always run all eight shards. Drafts remain full and hosted until `PUBLIC_PR_PLAYWRIGHT_SMART_DRAFT_ENABLED=true` or the exact `PUBLIC_PR_PLAYWRIGHT_SMART_DRAFT_CANARY_PR` enables selection; enabled drafts use one to four timing-balanced shards and fall back to hosted when the public rollout is unavailable. Forks, bots, private repositories, pushes, malformed event or policy data, and disabled smart routing remain hosted full; an inconsistent explicit route hint rejects the invocation. `PUBLIC_PR_ARM64_PLAYWRIGHT_FORCE_HOSTED_CANARY_PR` forces one exact PR to hosted execution. Public jobs must use read-only contents permission, receive no secrets, not publish service ports, and not persist checkout credentials; every shard needs a run-specific Hatchet volume. Preserve all result artifact names when changing either path. Keep the route-neutral concurrency group only on the caller's reusable-workflow job; the called workflow defines no concurrency, and `test-playwright-status` remains outside that group. After every public container checkout, trust only the exact `GITHUB_WORKSPACE`; wildcard safe-directory rules are forbidden.
- The trusted preparation step emits a `playwright-selector-shadow` artifact for draft pull-request transitions without changing execution. It reads selector code, profiles, timings, and the relevance manifest from trusted `v3`, while the candidate checkout is data only. A draft plan may select relevant specs and one to four balanced shards; a ready plan is always full. The artifact is not a correctness gate and never allocates the `public-pr-arm64` group. Treat unknown, global, malformed, missing-history, or missing-manifest input as a full-suite fallback. Do not enable draft-selective execution until ten representative shadow comparisons show no unexplained missed failures and the later backend-neutral rollout canary passes.
- Keep the `public-pr-arm64` runner group restricted to `uzh-bf/klicker-uzh` and `uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3`. Changing the workflow path or trusted branch requires updating that organization policy before rollout. A pull-request branch cannot prove changes to this reusable workflow on the restricted group; prove its shared logic on the hosted route first, then require a direct `v3` public run after merge.
- The Playwright caller uses the short `@v3` ref, which GitHub records as `refs/heads/v3`; keep the full `@refs/heads/v3` spelling for the organization runner-group policy and trusted composite action refs. The full spelling in the reusable-workflow caller creates a zero-job workflow run. The trusted cache seed marks only its exact checked-out workspace as a Git safe directory before reading repository metadata inside its container.
- To avoid browser install hangs, prefer the Playwright Docker image matching the lockfile-resolved Playwright version, such as `mcr.microsoft.com/playwright:v<version>-noble`, and remove the separate browser install step.
- In GitHub job containers, service dependencies are reached by service hostnames, not localhost: `postgres`, `redis_exec`, `redis_cache`, `redis_assessment_exec`, and `hatchet`.
- App URLs can still be `127.0.0.1:<port>` when the apps run in the same job container as Playwright.
- If Postgres logs `role "root" does not exist`, a startup/reset path is connecting without the intended `DATABASE_URL`. Ensure every DB-touching step gets the explicit CI database URL — and GitHub service `pg_isready` health checks must pass `-U` and `-d` for the same reason.
- Make service wait scripts configurable by host/port env vars; keep localhost defaults for non-container local runs. The Playwright container may lack `nc` — use `.github/scripts/wait-for-services.sh`'s `check_tcp` helper instead of raw `nc -z`.
- `util/_create_hatchet_token_test.sh` must keep its Hatchet HTTP API fallback: the Playwright container has no Docker, so the Docker token path only works for local compose runs.
- `turbo run start:test` is a persistent server task — keep it uncached and persistent in `turbo.json`, or CI replays startup logs instead of starting real processes. Keep `start:test:ci` owned by `.github/scripts/wait-for-services.sh -- <test command>`; splitting startup and test execution into separate steps leaves tests navigating to dead ports.
- Pass the same test `DATABASE_URL`, Redis hosts, and app origins to the **build** step as to runtime — Next.js public env is baked during `next build`. Service connection vars (e.g. `REDIS_ASSESSMENT_HOST`, `HATCHET_CLIENT_HOST_PORT`) must be listed in `turbo.json` `globalEnv` or `turbo run start:test` won't pass them through and apps fall back to checked-in localhost defaults.

## Validation

For refactors, run:

```bash
volta run pnpm exec prettier --check playwright/util/actions.ts playwright/tests/<changed-spec>.spec.ts
volta run pnpm --filter @klicker-uzh/playwright exec tsc --noEmit --project tsconfig.json
pnpm playwright:host -- --list --project=chromium
```

The type and format checks can run in the devcontainer; the Playwright command
cannot. If the host launcher cannot prove the routed stack, report that runtime
validation was not possible instead of bypassing the boundary.
