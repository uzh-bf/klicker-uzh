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

1. Start dependencies: `./_run_app_dependencies.sh` (from repo root)
2. Start Playwright app stack: `pnpm run dev:playwright`
3. Run all tests:

```bash
# with Infisical secrets (recommended)
pnpm --filter @klicker-uzh/playwright test:run

# without Infisical (env vars already exported)
pnpm --filter @klicker-uzh/playwright test:run:raw
```

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
