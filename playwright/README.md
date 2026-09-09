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

Install Devrouter on the host; it is not a workspace dependency. The launcher
ignores `node_modules` executable directories, reports the selected absolute
path and version, and rejects a CLI older than `.devrouter.yml` before runtime
reconciliation. When multiple global installations exist, set
`KLICKER_DEVROUTER_BIN` to the intended executable's absolute path. It never
installs or upgrades the host CLI automatically.

CI installs its reviewed Devrouter release separately for read-only profile
planning. It continues to run Playwright in the official container without
starting Devrouter infrastructure.

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

## Fast local iterations

Explicit spec paths automatically select the union of their entries in
`profiles.json`. Broad runs and filters that cannot be resolved safely use the
`playwright` runtime profile, which excludes optional AI and email services.
Override inference with `--runtime-profile` before Playwright arguments.

Use one worker per runtime: specs share seeded identities and database-wide resets.
Concurrent shards require separate worktrees and complete isolated runtimes,
including PostgreSQL, Redis, Hatchet and report directories. A second browser
worker or a cloned database alone does not provide that isolation.

Normal runs clean and seed the synthetic database. `--preserve-database` is only
for debugging an existing baseline; it is not clean-run acceptance evidence.

### Seed snapshots (opt-in)

Clean runs normally clean and seed the synthetic database on every reset.
Optionally, set `KLICKER_PLAYWRIGHT_SEED_SNAPSHOT=1` to capture the seeded
baseline into the git-ignored `playwright/.cache/seed-snapshot/` directory
after a successful seed; later runs, including the per-spec `CLEANUP` resets,
then restore that baseline in a single PostgreSQL transaction on the disposable
`klicker_test` database instead of deleting and re-inserting every row. The
launcher passes the exact Postgres container to the helper; it never connects
to another database.

Snapshotting stays opt-in because, measured on the reference host, a restore is
not faster than the normal cleanup and seed reset — it is retained for its
exact-baseline guarantee, not as a speed feature. Restore is refused in CI,
under `--preserve-database`, and whenever the cache key no longer binds the
Prisma schema, migrations, seed implementation, seed constants, lockfile,
PostgreSQL major version, timezone and year, or when the live schema
fingerprint drifted. Those runs fall back to the normal cleanup and seed path.
A restore that fails mid-flight aborts the run instead of continuing on partial
state. Delete the cache directory to force a fresh capture; a new snapshot is
captured automatically after the next successful clean seed.

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
