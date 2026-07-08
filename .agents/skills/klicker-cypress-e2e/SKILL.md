---
name: klicker-cypress-e2e
description: Maintain and debug the LEGACY Cypress E2E suite for KlickerUZH (frozen pending removal — write NEW specs with klicker-playwright-e2e instead), including GitHub Actions debugging via gh.
metadata:
  version: '1.2.0'
  argument-hint: <spec-path|pr-number|run-id>
---

# KlickerUZH Cypress E2E

**The Cypress suite is legacy** — the repo has switched to Playwright as the primary e2e framework, and this suite is frozen pending removal. Do NOT add new specs here; write them with `klicker-playwright-e2e`. Use this skill only to keep the existing suite green.

Use this skill when you need to:

- fix or stabilize existing Cypress specs under `cypress/`
- stabilize flaky E2E interactions
- reproduce and debug GitHub Actions Cypress failures using `gh`
- make UI code testable when using `@uzh-bf/design-system`

## Repo map

- Specs: `cypress/cypress/e2e/**/*.cy.ts`
- Helpers: `cypress/cypress/e2e/helpers.ts`
- Custom Cypress commands: `cypress/cypress/support/commands.ts`
  - includes `cy.selectOption()`, `cy.seed()`, `cy.cleanup()`, login helpers, etc.
- Cypress config/tasks: `cypress/cypress.config.ts`
- CI workflow: `.github/workflows/cypress-testing.yml`

## Local runs (Cypress-only)

Run from repo root.

Start Cypress dependencies and the Cypress app stack first:

```bash
./_run_app_dependencies.sh test
pnpm run dev:test
```

```bash
# GUI
pnpm --filter @klicker-uzh/cypress test

# headless (all specs)
pnpm --filter @klicker-uzh/cypress test:run

# headless (single spec)
pnpm --filter @klicker-uzh/cypress test:run:one -- cypress/cypress/e2e/<spec>.cy.ts
```

Notes:

- The non-`*:raw` scripts use `./util/_run_with_infisical.sh --env dev-cypress`.
- If you already have env vars exported (or Infisical isn’t available), use `test:raw` / `test:run:raw`.

## Debugging GitHub Actions failures (gh)

```bash
# show PR checks (find failing workflow / job)
gh pr checks <pr-number> --repo uzh-bf/klicker-uzh

# list workflow runs for a branch
gh run list --repo uzh-bf/klicker-uzh \
  --workflow "Klicker automated testing with cypress" \
  --branch <branch>

# inspect a run
gh run view <run-id> --repo uzh-bf/klicker-uzh
gh run view <run-id> --repo uzh-bf/klicker-uzh --log-failed

# download artifacts (screenshots/videos)
gh run download <run-id> --repo uzh-bf/klicker-uzh --dir /tmp/klicker-cypress-run
```

After you identify the failing spec path in logs, reproduce locally with `test:run:one`.

## CI mass-failure triage workflow (Cypress Cloud + GH)

Use this when failures explode across many specs (for example, fail count rising continuously in Cypress Cloud).

### 1) Monitor run completion first

```bash
# quick status of the two key checks on a PR
gh pr checks <pr-number> --json name,bucket,state,description,link \
  --jq '.[] | select(.name=="cypress-run-cloud" or .name=="cypress: default-group (merge)") | [.name,.bucket,.state,(.description//"-"),.link] | @tsv'

# inspect cypress workflow job/step state
gh run view <run-id> --json jobs \
  --jq '.jobs[] | select(.name=="cypress-run-cloud") | {status,conclusion,steps:[.steps[]|{n:.number,name:.name,status:.status,conclusion:.conclusion}]}'
```

Important: `gh run view --log-failed` and `--job ... --log` only work after the run/job has completed.

### 2) Capture logs immediately after completion

```bash
gh run view <run-id> --log-failed > /tmp/cypress-run-<run-id>-failed.log
gh run view <run-id> --job <job-id> --log > /tmp/cypress-run-<run-id>-job-<job-id>.log
```

### 3) Classify failure signatures

```bash
rg -n "Failed to load static props|unhandled promise rejection|Y\\.prefetch|_next/static/chunks/main" \
  /tmp/cypress-run-<run-id>-failed.log /tmp/cypress-run-<run-id>-job-<job-id>.log
```

Buckets:

- prefetch/static-props crash signatures (`Failed to load static props`, `Y.prefetch`, Next chunk stack)
- broad app-level unhandled promise rejection signatures
- ordinary selector/timeout/assertion failures

### 4) Decision tree

- If prefetch/static-props signatures appear across many specs:
  - treat as middleware interception regression
  - harden middleware in all three apps:
    - `apps/frontend-manage/src/middleware.ts`
    - `apps/frontend-control/src/middleware.ts`
    - `apps/frontend-pwa/src/middleware.ts`
  - skip CSP mutation on prefetch requests (`next-router-prefetch`, `purpose=prefetch`, equivalent headers)
  - broaden matcher exclusion from selective `_next/static|_next/image|_next/data` to all `_next`
  - keep runtime `ALLOWED_FRAME_ANCESTORS` behavior (do not move back to build-time-only CSP config)
- If signatures are absent and failures are localized:
  - split by spec and fix as isolated test/app issues instead of a global middleware rollback

### 5) Post-fix validation gate

```bash
# optional fast local smoke on critical specs
pnpm --filter @klicker-uzh/cypress test:run:one --spec cypress/e2e/0-baseline-ops.cy.ts
pnpm --filter @klicker-uzh/cypress test:run:one --spec cypress/e2e/A-login-workflow.cy.ts

# CI must not show the catastrophic signature anymore
gh run view <new-run-id> --log-failed | rg -n "Failed to load static props|unhandled promise rejection|Y\\.prefetch"
```

Passing this gate means Cypress can still have isolated flakes, but no suite-wide early-collapse pattern.

## Cypress debugging cookbook

### 1) Reduce the problem

- Reproduce in a **single spec** first.
- Then reduce to a **single failing `it()`** (use `.only` locally; remove it before committing).

### 2) If you need more Cypress flags, don’t use `test:run:one`

`test:run:one` hardcodes `cypress run --spec`.

If you need extra Cypress flags (e.g. `--env`, `--browser`, `--headed`), prefer:

```bash
pnpm --filter @klicker-uzh/cypress test:run -- \
  --spec cypress/cypress/e2e/<spec>.cy.ts \
  --env CYPRESS_FAIL_FAST=false
```

Or without Infisical:

```bash
pnpm --filter @klicker-uzh/cypress test:run:raw -- \
  --spec cypress/cypress/e2e/<spec>.cy.ts \
  --env CYPRESS_FAIL_FAST=false
```

### 3) Fail-fast is enabled by default

This repo stops the run after the first failing test. Disable it when you want to see all failures:

- `--env CYPRESS_FAIL_FAST=false`

### 4) Common flake fixes used in this repo

- **Design-system selects**: use `cy.selectOption(triggerSelector, optionText)`.
- **Overlays/portals**: use `.realClick()` / `.realType()` when normal `.click()` is flaky.
- **Visibility before click**: `cy.get(...).scrollIntoView().should('be.visible')`.
- Prefer assertion retries/timeouts over arbitrary sleeps.

### 5) Datetime/date pickers: use the repo commands

- `cy.setDatetime({ cyString, deselectorString, datetime })`
- `cy.setDate({ cyString, deselectorString, date })`

These commands expect a specific `data-cy` naming scheme (see below).

## Writing a new spec (copy/paste skeleton)

This repo often uses `function () {}` (not arrow functions) so fixtures can populate `this.data`.

```ts
import messages from '../../../packages/i18n/messages/en'

describe('My new workflow', function () {
  beforeEach(function () {
    cy.fixture('my-fixture.json').then((data) => {
      this.data = data
    })
  })

  it('CLEANUP', () => {
    cy.cleanup()
    cy.seed()
  })

  it('does the thing', function () {
    cy.loginLecturer()

    cy.get('[data-cy="library"]').click()
    cy.get('[data-cy="create-question"]').click()

    // Design-system selects: prefer the repo helper
    cy.selectOption('[data-cy="select-course"]', this.data.courseName)

    cy.get('[data-cy="next-or-submit"]').click()

    // Prefer stable assertions
    cy.get('[data-cy="homepage"]').should('exist')
    cy.contains(messages.shared.generic.confirm).should('exist')
  })
})
```

## Frontend testability (especially with @uzh-bf/design-system)

### Rules of thumb

1. **Every user interaction Cypress performs must have a stable hook**.
   - Prefer `data-cy` over text selectors.
   - Put the hook on the element that actually receives the click/type.
2. **Prefer fixing the UI (adding hooks) over making tests brittle**.
3. **Avoid dynamic/translatable selector values** unless the test imports the same constants.
   - If you must include dynamic parts (e.g. names), prefer IDs/slugs (no spaces) over display strings.

### Design system patterns (how to add hooks)

The design system commonly accepts a `data` prop with a `{ cy: string }` shape that becomes a `data-cy="..."` attribute in the DOM.

**Portal/overlay rule:** for Select/Dropdown/Tabs, make sure both the trigger and the overlay items are tagged (often via `items[].data.cy`).

#### Button

```tsx
<Button data={{ cy: 'create-question' }} />
```

#### FormikSelectField / Select-like components

Make the trigger selectable, and also tag items (portals/overlays).

```tsx
<FormikSelectField
  data={{ cy: 'select-course' }}
  items={courses.map((c) => ({
    label: c.displayName,
    value: c.id,
    data: { cy: `select-course-${c.displayName}` },
  }))}
/>
```

Why: the repo’s `cy.selectOption('[data-cy="select-course"]', '<text>')` first looks for
`[data-cy="select-course-<text>"]` (and then falls back to partial matches / role="option").

#### Dropdown (menus)

```tsx
<Dropdown
  data={{ cy: `user-group-actions-${group.name}` }}
  items={[
    {
      id: 'delete-group',
      label: 'Delete',
      onClick: onDelete,
      data: { cy: `delete-group-${group.name}` },
    },
  ]}
/>
```

#### Modal actions

```tsx
<Modal
  dataPrimaryAction={{ cy: 'confirm-leave-group' }}
  dataSecondaryAction={{ cy: 'cancel-leave-group' }}
/>
```

#### Text inputs

Some design-system form fields accept `data-cy` directly (common in this repo):

```tsx
<FormikTextField data-cy="insert-practice-quiz-name" name="name" />
```

#### Checkbox

```tsx
<Checkbox data={{ cy: 'select-all-activities' }} />
```

#### NumberField

```tsx
<NumberField data={{ cy: 'block-time-limit' }} />
```

#### Tabs

```tsx
<Tabs
  tabs={[
    {
      id: 'tab-features-overview',
      value: 'features-overview',
      label: '...',
      data: { cy: 'tab-features-overview' },
    },
  ]}
>
  <TabContent value="features-overview">...</TabContent>
</Tabs>
```

#### Date/Datetime pickers (required `data-cy` sub-structure)

If Cypress needs to set a date/time through the picker UI, ensure these elements exist:

- `data-cy="<base>"` (the input/trigger)
- `data-cy="<base>-calendar"` (calendar grid container)
- `data-cy="<base>-next-month"` / `data-cy="<base>-previous-month"` (month navigation)
- `data-cy="<base>-hours"` / `data-cy="<base>-minutes"` (time inputs, for datetime)

Then the tests can call:

```ts
cy.setDatetime({
  cyString: '<base>',
  deselectorString: '<some-stable-click-target>',
  datetime: {
    monthDelta: 1,
    day: 15,
    hour: 9,
    minute: 5,
    validation: '15.01.2026',
  },
})
```

### Debugging UI ↔ Cypress mismatches

- If `cy.get('[data-cy="..."]')` fails: search the frontend for that selector and confirm it is still rendered.
- If clicks don’t open overlays (Select/Dropdown): ensure the `data-cy` is applied to the actual trigger element; use `.realClick()` when needed.
- If select options aren’t found: ensure options/items have `data: { cy: ... }` so they are selectable even when rendered in a portal.

## Definition of done

- New/updated spec is deterministic (no random sleeps; stable selectors).
- Local run for the affected spec passes.
- If a CI-only failure existed, you can explain root cause (services vs flake vs selector vs timing) and the fix addresses it.
