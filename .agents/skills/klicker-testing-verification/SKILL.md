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
| Prisma seed reconciliation                                      | `pnpm --filter @klicker-uzh/prisma-data test` — Node test runner through the package's existing `tsx` toolchain                          |
| `packages/graphql` services/schema                              | `pnpm --filter @klicker-uzh/graphql test:local` — one-command bootstrap (real Postgres + Redis + Hatchet); serialized, don't parallelize |
| UI or user flows                                                | e2e — new specs go to `klicker-playwright-e2e` (primary suite); use `klicker-cypress-e2e` only to keep the frozen legacy suite green     |
| React component appearance/behavior only                        | there is **no component-test layer** — verify in the browser (below) and rely on e2e if a flow covers it                                 |

Never run root `pnpm run test:run` blind — its turbo fan-out includes Cypress, which needs a running seeded stack.

The focused `knowledge.test.ts`, `knowledgeIngestion.test.ts`, and `knowledgeWebhooks.test.ts` suites use real PostgreSQL but deliberately stub or avoid Hatchet, so they can verify owner-scoped binding replacement, MCP configuration, attempt-ledger, platform-refresh idempotency, current-attempt list projection, and serving-state transitions without a client token. Keep the full GraphQL suite on `test:local`.

For KB deletion changes, add real-PostgreSQL coverage for owner-hidden tombstones and KB-first create/delete races, plus Hatchet unit coverage for the exact external delete request, operation fencing, empty-serving cutover, ticket expiry, blob-before-row ordering, and idempotent maintenance retry.

For KB quota changes, use real PostgreSQL for exact 100-resource/500-MiB boundaries, concurrent reservations, ticket conversion, tombstone retention, and cleanup release. Use Hatchet tests for persisted KB-scope mismatch and locked URL replacement accounting (`usage - old size + observed size`) before dispatch.

For KB pagination and bulk operations, use real PostgreSQL for tied keyset order, malformed/owner/filter-mismatched cursors, status changes between resource pages, exact grouped metrics, tombstone hiding, deterministic lock order, all-or-nothing active/foreign guards, input bounds, and independent post-commit dispatch failure. The KB UI has no component-test layer; use the real delegated-login browser for EN/DE desktop/390 px catalog and detail flows.

For the interim KB gate, exercise every KB service entry point with a non-preview real-PostgreSQL user and verify `KB_PREVIEW_ACCESS_REQUIRED`. Toggle `KB_INGESTION_DISABLED` at call time and prove it blocks upload-ticket issue, URL creation, and ingestion while leaving deletion available. Browser proof covers preview/non-preview navigation plus direct-route denial in both locales.

For KB file-upload browser proof, use the managed DevPod's routed Azurite service. Upload a synthetic PDF/TXT/MD fixture through the real hidden `[data-cy="kb-file-input"]`, then verify the resource row, exact size, and cleared upload reservation. The browser flow must cover ticket issue, Blob PUT, and confirmation; a CORS preflight may supplement it, but never print the SAS query. This proves local upload and confirmation only, not external ingestion acceptance.

For maintenance recovery, prove a stale `QUEUED` UPSERT with no external operation id re-dispatches the same stored attempt id, young/in-flight/tombstoned/DELETE rows are excluded, and a repeated sweep creates no replacement run. Source-gateway coverage uses real PostgreSQL to prove the exact version, non-tombstoned BLOB, digest, and QUEUED/PROCESSING predicate before Blob access; direct resolver tests cover loopback/private/link-local/IPv6 rejection without external network.

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

For KB graph lifecycle changes, use real PostgreSQL for quota-lock and settlement tests, pure tests for the W1 result/cost contracts, and Hatchet unit tests for provider-status reconciliation. A provider `COMPLETED` response without a versioned result must be asserted as fail-closed; it is not evidence of publication or cost settlement.

## Reporting

State what you ran, what passed, what you did NOT run and why (e.g. "no Infisical access — e2e left to CI"). An honest gap beats a fabricated green.
