# @klicker-uzh/playwright

Playwright E2E test suite for KlickerUZH — equivalent of the Cypress suite in `cypress/`.

## Structure

```
playwright/
  playwright.config.ts      # Config: multi-browser, data-cy testId, globalSetup
  global-setup.ts           # DB cleanup + seed (mirrors cypress before:run hook)
  tsconfig.json
  util/
    types.ts                # TokenData type
    constants.ts            # Seeded IDs, URLs, credentials
    fixtures.ts             # Extended test object with login helpers
  tests/
    A-login.spec.ts         # Login/logout workflows (equivalent of A-login-workflow.cy.ts)
```

## Local run

From repo root:

```bash
# Start Postgres, Redis, Hatchet, Traefik, create Hatchet token, and apply Prisma schema.
# Non-interactive mode skips optional build/reset prompts; detach mode returns after setup.
KLICKER_NONINTERACTIVE=1 KLICKER_DEPENDENCIES_DETACH=1 ./_run_app_dependencies.sh playwright

# Start the app stack in local-port Playwright mode.
# Raw mode avoids Infisical and runs build:test first so instrumented backend sources are fresh.
volta run pnpm run dev:playwright:raw

# Confirm Playwright can discover the active Chromium suite.
volta run pnpm --filter @klicker-uzh/playwright exec playwright test --list --project=chromium
```

Run tests:

```bash
# with Infisical secrets
volta run pnpm --filter @klicker-uzh/playwright test:run -- --project=chromium tests/A-login.spec.ts

# without Infisical
volta run pnpm --filter @klicker-uzh/playwright test:run:raw -- --project=chromium tests/A-login.spec.ts

# full active Chromium suite
volta run pnpm --filter @klicker-uzh/playwright test:run -- --project=chromium
```

Stop Docker dependencies with `./_down.sh`.

In Codex/agent shells, prefer `volta run pnpm` or `/Users/roland/.volta/bin/pnpm`; an ambient pnpm with a different version can recreate `node_modules`. For production-like CI parity, `volta run pnpm run start:playwright` builds first and serves the `start:test` stack.

## Useful commands

```bash
# UI / interactive mode
pnpm --filter @klicker-uzh/playwright test:ui

# Headed Chromium only
pnpm --filter @klicker-uzh/playwright test:headed

# Show last HTML report
pnpm --filter @klicker-uzh/playwright show-report
```

## Writing new specs

Import the extended `test` and `expect` from `../util/fixtures.js`:

```ts
import { expect, test } from '../util/fixtures.js'

test.describe('My workflow', () => {
  test('does the thing', async ({ page, loginLecturer }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()
  })
})
```

Available fixtures (mirrors Cypress commands):

| Fixture                          | Equivalent Cypress command              |
| -------------------------------- | --------------------------------------- |
| `loginLecturer()`                | `cy.loginLecturer()`                    |
| `loginLecturerControl()`         | `cy.loginLecturerControl()`             |
| `loginFreeUser()`                | `cy.loginFreeUser()`                    |
| `loginIndividualCatalyst()`      | `cy.loginIndividualCatalyst()`          |
| `loginInstitutionalCatalyst()`   | `cy.loginInstitutionalCatalyst()`       |
| `loginInstitutionalCatalyst2()`  | `cy.loginInstitutionalCatalyst2()`      |
| `loginInstitutionalCatalyst3()`  | `cy.loginInstitutionalCatalyst3()`      |
| `loginInstitutionalCatalyst4()`  | `cy.loginInstitutionalCatalyst4()`      |
| `loginStudentPassword(username)` | `cy.loginStudentPassword({ username })` |
| `loginStudent()`                 | `cy.loginStudent()`                     |
| `logoutUser()`                   | `cy.logoutUser()`                       |

If a spec needs seeded activity stubs (live quiz / microlearning / practice quiz / group activity), import `seedActivities` from `global-setup.ts` and call it in a `test.beforeAll`.

## Selectors

All selectors use `data-cy` attributes via `page.getByTestId(...)` — the config sets `testIdAttribute: 'data-cy'`, matching the Cypress convention used throughout KlickerUZH.
