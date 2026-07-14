---
type: Testing Guide
title: Testing
description: Which test level to use when, what runs safely without services, the two e2e stacks and their seeds, and the CI test matrix.
timestamp: '2026-07-14'
tags:
  - testing
  - ci
---

# Testing

**There is no component-test layer.** Coverage is pure-function vitest at the bottom and full-stack e2e at the top — nothing in between (no @testing-library/react, no Cypress component testing). Don't look for one, and don't assume a React component is covered unless an e2e spec exercises it.

## Which level for which change

| Change                                                     | Test level                                                                                 | Command                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Pure logic (grading, util, export, word-cloud, chat logic) | package vitest — **safe without any services**                                             | `pnpm --filter @klicker-uzh/grading test` (etc.)                                                   |
| GraphQL services/resolvers                                 | `packages/graphql` vitest — needs REAL Postgres + Redis + Hatchet + `HATCHET_CLIENT_TOKEN` | `pnpm --filter @klicker-uzh/graphql test:local` (one-command bootstrap: `test/run-tests-local.sh`) |
| UI / user flows                                            | Playwright e2e (new specs); Cypress only for legacy maintenance                            | see routing below                                                                                  |

**Never run root `pnpm run test:run` blind** — the turbo fan-out includes Cypress, which needs a running, seeded stack. The graphql vitest config forces `pool: forks, singleFork: true` (serialized specs sharing DB state) — don't parallelize it.

## Two e2e stacks, one selector convention

**Playwright is the primary suite — all new e2e specs land there.** The Cypress suite is a frozen parity suite pending removal: touch it only to keep existing specs green, never to add coverage. Both still run in CI until the removal actually happens, so both stacks stay documented below.

Both frameworks click the same `data-cy` attributes ([Frontend Conventions](./frontend-conventions.md)). Specs are letter-prefixed for run order (`A-login-workflow` … `X-review-workflow`; Playwright adds `Y-chat` with no Cypress counterpart).

|               | Cypress (`cypress/`)                                               | Playwright (`playwright/`)                                 |
| ------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Stack scripts | root `dev:test` / `start:test`                                     | `dev:playwright` / `start:playwright`                      |
| Infisical env | `dev-cypress`                                                      | `dev-playwright`                                           |
| Seed          | own `seedDatabase()` task in `cypress.config.ts`                   | own `seedDatabase()` in `global-setup.ts` (once, wipes DB) |
| CI            | 8-way `cypress-split` (draft PRs) / Cypress Cloud (non-draft + v3) | official Playwright container, 8-way shard, all PRs        |

The three seed paths (dev `seedTEST.ts`, Cypress, Playwright) are **independent** — a fixture added to one does not exist in the others ([Data & Migrations](./data-and-migrations.md)). `*:raw` script variants skip Infisical on both sides. `_run_app_dependencies.sh` with no args (or `local`/`dev`/`playwright`) applies the schema with `prisma:push` without forcing a reset; the `test`/`cypress` argument is the Cypress-specific **reset** path.

Import/export tests must set `IMPORT_EXPORT_ENABLED=true` explicitly. The shared local test wrapper also sets `IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY=true`, so Playwright's preview-flag matrix proves both visible and hidden entry points. Devcontainers set `IMPORT_EXPORT_PACKAGE_STORAGE=local` explicitly for clarity; development/test runtimes also default an omitted value to local storage. The isolation fixture rejects an explicit Azure selection so tests cannot delete non-local targets.

`playwright/tests/MA-import-export.spec.ts` owns the package UI browser suite, with its focused fixture, support, and case modules under `playwright/tests/import-export/` and request-isolation cleanup in `playwright/util/fixtures/importExportArtifacts.ts`. Its round-trip case exercises the real export/upload/validate/import path, selection-aware answer collections, bulk selection, full answer-pool and didactic review, then runs `AxeBuilder` against the import modal for WCAG 2 A/AA plus 2.1/2.2 AA rules and captures the English desktop review. Separate cases hold both import commit/refresh and export link/blob network phases open, reject a nullable import result, cancel a held validation to assert abort/stale-generation handling and focus return, exercise all nine didactic renderers, and verify German review at 375 px and 320 px without horizontal overflow. The 100-element case replaces the preview five times with 5,000 top-level entries, including 100 elements sharing one 2,000-entry pool, asserts lazy closed pools plus duplicate bulk action, records response-to-interactive against a 2 s budget and bulk toggle against a 500 ms budget, and attaches the measured JSON. `packages/graphql/test/importExportPreviewShape.test.ts` separately proves that the public schema and generated operation expose the pool once, selected IDs without repeated values, all nine option fragments, and no preview `any`. `packages/graphql/test/elementImportPreviewOptions.test.ts` executes the Pothos union for every concrete type, including nullable no-key choice correctness, feedback, nested case-study scoring, and a Unicode numerical placeholder.

The feature's pure trust-boundary suites are `packages/graphql/test/elementDomain.test.ts` (all-nine canonical valid/invalid matrix, including slider-reachable case-study solutions), `packages/graphql/test/importExportErrors.test.ts` (closed codes and redaction), `packages/graphql/test/importExportPackageContract.test.ts` (version-3 schemas, canonical paths, reserved refs, warnings, and per-resource counts), `packages/graphql/test/importExportMediaReferences.test.ts` (type-aware CommonMark image/link classification, non-loading omission, and plain scoring-string preservation), `packages/graphql/test/elementImportToken.test.ts` (strict artifact-token framing/binding), and `packages/graphql/test/zip.test.ts` (strict archive metadata plus deterministic mutation/truncation cases). Aggregate import/export limits, the 5,000-entry load boundary, exact media closure, and media alias rejection live in `packages/graphql/test/elementImportExportPackageBoundaries.test.ts`. `elementImportExactlyOnce.test.ts`, `elementImportDurableTransaction.test.ts`, `elementImportReceiptOrchestration.test.ts`, and `elementImportPackagedMedia.test.ts` own the receipt/replay/commit-final/transaction/media failure seams; provider/CAS behavior and the database-backed artifact-cleanup/lease-turnover races live in the focused `importExportMedia*.test.ts` and `importExportPersistence.test.ts` files. Broader database/storage compatibility remains in the split `elementImportExport*.test.ts` suites; user-visible package workflow, HTTP boundaries, external-request blocking, and permissions belong to `playwright/tests/MA-import-export.spec.ts`.

For authoring specifics, helper patterns, and failure triage, use the skills — `klicker-cypress-e2e` and `klicker-playwright-e2e` ([.agents/skills/](../.agents/skills/)) — rather than duplicating their content here.

## E2E environment dependencies

- Tests that **publish, schedule, or end activities** need the Hatchet **general worker** running on top of the test stack — otherwise mutations fail with `workflow not found`. The worker needs `DATABASE_URL` pointed at the test DB ([Async & Workers](./async-and-workers.md)).
- **Live-quiz response tests** additionally need `response-api` + the response processor with the same `APP_SECRET`/Redis/Postgres settings — otherwise the UI accepts answers that never reach cockpit/evaluation.
- Cypress `cy.loginStudent()`/`cy.loginStudentPassword()` clear localforage by default; continuation tests that rely on stored answers pass `{ preserveClientState: true }`.

## CI matrix

Path-filtered unit workflows: `test-grading`, `test-util` (package-only, no services), `test-graphql` (spins Postgres ×2 + hatchet-lite + Redis), `test-olat-api` (docker compose test stack). Playwright tests use a path-scoped filter and compile once in a `build-and-compile` job before running the 8 shards. That build job also runs `test:run` for `@klicker-uzh/backend-docker`, `@klicker-uzh/frontend-manage`, and `@klicker-uzh/hatchet-worker-general` before uploading its artifacts. All path-skipped workflows report through `-status` gates to satisfy branch protection. Cypress CI signal quirk: the merge-group check can show a rising failed count while `cypress-run-cloud` is still in progress — wait for cloud completion before reading logs.

**Git hooks run no tests** (pre-commit = `check:all`, pre-push = `build`). The expectation before a PR: `check:all` + build + targeted vitest for touched logic + browser evidence for UI changes; CI is the real e2e gate.
