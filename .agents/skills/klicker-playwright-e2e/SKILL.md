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
volta run pnpm --filter @klicker-uzh/playwright exec playwright test --list --project=chromium
rg -n "test\\(" playwright/tests
```

## Local Test Setup

### Host-run against a running devrouter workspace (preferred)

Playwright is a black-box driver: run it from the host against the devrouter
routes. Browser binaries and node_modules come from shared host caches, so
never download browsers into a DevPod.

```bash
# auto-detects routed worktrees / plain devcontainer / host-run apps
bash util/run-host-e2e.sh --project=chromium tests/A-login.spec.ts
bash util/run-host-e2e.sh --project=chromium tests/Y-kb-management-ux.spec.ts

# inspect the resolved URL + database mapping without running anything
bash util/run-host-e2e.sh --print

# linked-workspace token override (long branch names can get truncated)
E2E_WORKSPACE=<token> bash util/run-host-e2e.sh --project=chromium <spec>
```

The runner installs only the Playwright workspace dependencies on the host,
builds `@klicker-uzh/prisma` and `@klicker-uzh/types` for global setup, maps
the application URLs and seed database to the reachable runtime, and reuses
the host browser cache. Headless runs install only the smaller Chromium shell;
a headed run needs one full Chromium installation on the host.

The seed database uses the workspace Postgres container's OrbStack host name.
Node Postgres cannot negotiate libpq direct TLS through the Traefik database
route; that route remains correct for psql and other libpq tooling.
On another Docker runtime, pass `E2E_DATABASE_URL` for a disposable database
that is reachable from the host.
Container-local dependencies stay behind the routed applications. If a future
browser journey needs direct access to another service, expose a host route for
that service instead of running Playwright inside the DevPod.

The existing global setup resets and reseeds the mapped database. Run the host
runner only against a disposable local test runtime.

### Legacy host-based stack

Run from repo root. Use Volta when Node/pnpm versions are confusing.

```bash
docker compose down -v
./_run_app_dependencies.sh
pnpm run dev:playwright
```

Run Playwright:

```bash
# list active Chromium tests without executing them
volta run pnpm --filter @klicker-uzh/playwright exec playwright test --list --project=chromium

# focused specs
volta run pnpm --filter @klicker-uzh/playwright exec playwright test --project=chromium tests/O-live-quiz.spec.ts

# full active Chromium suite
volta run pnpm --filter @klicker-uzh/playwright test -- --project=chromium
```

For live quiz answer submission, response processing, scheduled microlearnings, or Hatchet workflow failures, start the missing services explicitly:

```bash
pnpm --filter @klicker-uzh/response-api dev
pnpm --filter @klicker-uzh/hatchet-worker-response-processor dev
./util/_run_with_infisical.sh --env dev-playwright pnpm --filter @klicker-uzh/hatchet-worker-general dev
```

Ensure the response processor is not running with `ASSESSMENT_MODE=true` when validating live quiz mode.

For `apps/chat` app-router recovery, authenticate the browser with a seeded
participant before exercising `/<chatbotId>` routes. Both a malformed ID and a
well-formed missing chatbot should assert the branded 404 and its response
status; an unexpected route failure must be fault-injected only in an
uncommitted local proof, restored before commit, and asserted against the
branded `error.tsx` retry/return surface without exposing the server error
text. Keep the `/noLogin` assertion focused on the login action and concise
return copy, not a raw redirect URL.

For chat settings coverage, seed credits through the existing `setCredits`
helper rather than mocking the credits route. A zero-credit response must leave
only the fallback model available, reconcile an unavailable persisted model to
that fallback, and expose the fallback notice in the sidebar-enabled mobile
layout outside the closed drawer. Set the viewport before `visitChat`; embedded
chat already owns its compact `EmbeddedCreditsBar` and should not receive the
sidebar mobile bar.

For chat welcome coverage, assert that the chatbot name and selected mode
description are visible before clicking a starter. Starter clicks populate the
composer without sending; assert the value contains no square-bracket template
placeholder, then edit the value before sending. The initial mode descriptions
are passed with the chatbot shell so this journey should not wait for a second
render of the starter grid.

## Fast Failure Triage

- `net::ERR_CONNECTION_REFUSED http://127.0.0.1:3002/`: the app server is down, not a selector issue. Check `pnpm run dev:playwright` and service readiness first.
- `ECONNREFUSED 127.0.0.1:7078`: `response-api` is not running.
- Hatchet `workflow not found`: the relevant Hatchet worker is not registered/running, often `hatchet-worker-general` for scheduled tasks.
- Sudden Firefox/WebKit execution: Playwright is running with
  `PLAYWRIGHT_RELEASE_MATRIX=true`. Leave that variable unset for ordinary
  Chromium-only work, or pass `--project=chromium` explicitly.
- UI mode does not automatically mean tests execute; prefer CLI runs for verification and use UI mode only for interactive debugging.
- A passing `CLEANUP` followed by immediate failures often means frontend apps or auth URLs are unavailable after setup.

Before blaming a test, probe the apps:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/healthz
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3002
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3010
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
- **PIN-cookie bridges**: clear test-side PIN cookie bridges wherever a spec clears cookies, or later direct-link checks bypass the expected PIN form via a stale `live-quiz-pin-*` cookie. (`playwright/tests/O-live-quiz.spec.ts`)

## CI Notes

- For Chromium-only CI, run with `--project=chromium`.
- The Firefox/WebKit projects are an opt-in release gate. Against the
  production-built test stack, run:

  ```bash
  PLAYWRIGHT_RELEASE_MATRIX=true \
  pnpm --filter @klicker-uzh/playwright exec playwright test \
    tests/Y-manage-assistant.spec.ts \
    tests/Y-course-chat-drawer.spec.ts \
    --project=firefox --project=webkit
  ```

  Leave `PLAYWRIGHT_RELEASE_MATRIX` unset for ordinary local and CI runs.

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
volta run pnpm --filter @klicker-uzh/playwright exec playwright test --list --project=chromium
```

Only run browser specs when the local stack is up. If endpoints are down, report that runtime validation was not possible instead of producing noisy connection-refused failures.
