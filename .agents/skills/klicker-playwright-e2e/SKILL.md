---
name: klicker-playwright-e2e
description: Create, translate, refactor, run, and debug Playwright E2E tests for KlickerUZH. Use when working in playwright/tests, comparing Cypress and Playwright parity, fixing flaky Klicker Playwright specs, debugging local or GitHub Actions Playwright failures, adjusting Playwright CI, or preserving Cypress-to-Playwright coverage without reducing test cases.
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
- Cypress source specs: `cypress/cypress/e2e/**/*.cy.ts`

## Coverage And Parity Rules

- Preserve test count and test intent. Do not skip, merge, delete, or weaken tests to make the suite pass faster.
- Treat `playwright/tests` as the active suite. Ignore `playwright/example` for active parity unless the user says otherwise.
- Compare against Cypress by spec and workflow, not just raw LOC. Playwright can be longer when it needs explicit browser/session/cookie handling.
- Keep duplicate-title suffixes such as `[2]` when Playwright needs unique titles.
- Prefer behavior-preserving helper extraction over broad rewrites.
- Keep explicit Playwright assertions when they document important state; Cypress chains may look shorter only because retries are implicit.

Useful parity checks:

```bash
volta run pnpm --filter @klicker-uzh/playwright exec playwright test --list --project=chromium
rg -n "it\\(|test\\(" cypress/cypress/e2e playwright/tests
```

## Local Test Setup

Run from repo root. Use Volta when Node/pnpm versions are confusing.

```bash
docker compose down -v
./_run_app_dependencies.sh test
pnpm run dev:test
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
./util/_run_with_infisical.sh --env dev-cypress pnpm --filter @klicker-uzh/hatchet-worker-general dev
```

Ensure the response processor is not running with `ASSESSMENT_MODE=true` when validating live quiz mode.

## Fast Failure Triage

- `net::ERR_CONNECTION_REFUSED http://127.0.0.1:3002/`: the app server is down, not a selector issue. Check `pnpm run dev:test` and service readiness first.
- `ECONNREFUSED 127.0.0.1:7078`: `response-api` is not running.
- Hatchet `workflow not found`: the relevant Hatchet worker is not registered/running, often `hatchet-worker-general` for scheduled tasks.
- Sudden Firefox/WebKit execution: Playwright is running all configured projects. Pass `--project=chromium` or keep non-Chromium projects commented in config if Chromium-only is desired.
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

- Use `openActionMenuByTestId(page, triggerTestId, expectedActionTestId?)` for repeated/portal-backed menus.
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

## CI Notes

- For Chromium-only CI, run with `--project=chromium`.
- To avoid browser install hangs, prefer the Playwright Docker image matching the lockfile-resolved Playwright version, such as `mcr.microsoft.com/playwright:v<version>-noble`, and remove the separate browser install step.
- In GitHub job containers, service dependencies are reached by service hostnames, not localhost: `postgres`, `redis_exec`, `redis_cache`, `redis_assessment_exec`, and `hatchet`.
- App URLs can still be `127.0.0.1:<port>` when the apps run in the same job container as Playwright.
- If Postgres logs `role "root" does not exist`, a startup/reset path is connecting without the intended `DATABASE_URL`. Ensure every DB-touching step gets the explicit CI database URL.
- Make service wait scripts configurable by host/port env vars; keep localhost defaults for non-container local runs.

## Validation

For refactors, run:

```bash
volta run pnpm exec prettier --check playwright/util/actions.ts playwright/tests/<changed-spec>.spec.ts
volta run pnpm --filter @klicker-uzh/playwright exec tsc --noEmit --project tsconfig.json
volta run pnpm --filter @klicker-uzh/playwright exec playwright test --list --project=chromium
```

Only run browser specs when the local stack is up. If endpoints are down, report that runtime validation was not possible instead of producing noisy connection-refused failures.
