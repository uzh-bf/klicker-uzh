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

Run from a host shell at the repository root. The launcher starts or reconciles
the exact devrouter workspace, resolves its namespaced routes and database, and
keeps the Playwright process and browser binaries on the host.

```bash
# run all Chromium tests
pnpm playwright:host -- --project=chromium

# run one spec
pnpm playwright:host -- --project=chromium tests/A-login.spec.ts

# inspect the resolved workspace without printing credentials
pnpm playwright:host -- --print-env
```

Direct local `playwright test` calls fail before database cleanup. Never run
Playwright or install its browsers inside the devcontainer. GitHub Actions keeps
using the official Playwright container directly.

## Useful commands

```bash
# UI / interactive mode
pnpm playwright:host -- --ui

# Headed Chromium only
pnpm playwright:host -- --headed --project=chromium

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
