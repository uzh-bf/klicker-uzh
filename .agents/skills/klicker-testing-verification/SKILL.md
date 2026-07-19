---
name: klicker-testing-verification
description: Choose the right test level and verify changes before a KlickerUZH PR. Use when deciding what to test, running tests locally, interpreting test failures, or assembling pre-PR verification evidence (typecheck, build, targeted tests, browser screenshots) for any change in this repository.
---

# KlickerUZH Testing & Verification

Facts about the test landscape: [docs/testing.md](../../../docs/testing.md). This skill is the procedure.

## Route the change

| You changed…                                                    | Run                                                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic in grading/util/export/word-cloud, or chat app logic | `pnpm --filter @klicker-uzh/<pkg> test` — safe with no services                                                                          |
| `packages/graphql` services/schema                              | `pnpm --filter @klicker-uzh/graphql test:local` — one-command bootstrap (real Postgres + Redis + Hatchet); serialized, don't parallelize |
| UI or user flows                                                | e2e — new specs go to `klicker-playwright-e2e` (primary suite); use `klicker-cypress-e2e` only to keep the frozen legacy suite green     |
| React component appearance/behavior only                        | there is **no component-test layer** — verify in the browser (below) and rely on e2e if a flow covers it                                 |

Never run root `pnpm run test:run` blind — its turbo fan-out includes Cypress, which needs a running seeded stack.

Direct checks for `auth`, `chat`, `frontend-control`, `frontend-manage`, and `frontend-pwa` generate ignored Next route types first through each app's `check` script. Do not hand-edit or commit `next-env.d.ts`; keep it ignored and included by `tsconfig.json`. The three PWA apps use `tsconfig.check.json` to exclude `.next/dev/types` from raw `tsc`; otherwise stale dev and fresh production Pages Router validators duplicate global declarations.

For Next framework or bundler changes, verify both repository-supported paths. `pnpm run build:test` uses Turbopack in all five Next apps. `pnpm run build` uses Turbopack for auth/chat and Webpack for control/manage/PWA until their service-worker integration moves to Serwist. Confirm standalone server paths for all five apps and `sw.js`, Workbox, and custom worker outputs for the three PWA apps.

The Playwright build job must tar the five `.next` trees before artifact upload and extract them in each shard. Direct artifact upload dereferences Turbopack's `.next/node_modules` symlinks and can omit transitive runtime links, producing HTTP 500 before the suite starts.

## Decide whether e2e is warranted locally

CI runs Cypress (8-way split) and Playwright (8-way shard) on almost every code PR — CI is the real e2e gate. Run e2e locally only when your change plausibly breaks a flow (new UI, changed selectors/`data-cy`, auth/redirect changes, activity lifecycle). If you do:

- You are **authorized to start the required servers for this purpose** — test stack via the e2e skills' setup instructions, plus the Hatchet general worker for publish/schedule/end flows and response-api + response processor for live-answer flows (exact triage in the e2e skills).
- Tear down afterwards (`./_down.sh`); leave the machine as you found it.
- On environment failure, switch to `klicker-environment-doctor` before blaming the test.

## Pre-PR verification checklist

Every item, in order; paste evidence (command + tail of output, screenshots) into the PR or task report:

1. `pnpm run check:all` — typecheck + format + lint + syncpack (same as pre-commit hook).
2. `pnpm run build` — same as pre-push hook; also refreshes generated artifacts.
3. Targeted tests per the routing table above — quote failures exactly; never delete/weaken a test to pass.
4. **Codegen artifacts committed** if any `.graphql` op or schema changed (`git status` must be clean after `pnpm --filter @klicker-uzh/graphql generate`).
5. **i18n pair check** if UI text changed: the key exists in BOTH `packages/i18n/messages/de.ts` and `en.ts`.
6. **Browser evidence for UI changes** — open the changed pages with `npx agent-browser` (never bare `agent-browser`), log in with delegated/test credentials (AGENTS.md), capture before/after screenshots. "The logic looks correct" does not count.

## Reporting

State what you ran, what passed, what you did NOT run and why (e.g. "no Infisical access — e2e left to CI"). An honest gap beats a fabricated green.
