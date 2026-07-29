---
name: klicker-testing-verification
description: Choose the right test level and verify changes before a KlickerUZH PR. Use when deciding what to test, running tests locally, interpreting test failures, or assembling pre-PR verification evidence (typecheck, build, targeted tests, browser screenshots) for any change in this repository.
---

# KlickerUZH Testing & Verification

Facts about the test landscape: [docs/testing.md](../../../docs/testing.md). This skill is the procedure.

## Route the change

| You changed…                                                    | Run                                                                                                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic in grading/util/export/word-cloud, or chat app logic | `pnpm --filter @klicker-uzh/<pkg> test` — safe with no services                                                                                                                             |
| `packages/graphql` services/schema                              | `pnpm --filter @klicker-uzh/graphql test:local` — one-command bootstrap (real Postgres + Redis + Hatchet); serialized, don't parallelize                                                    |
| Auth adapter against shared Prisma client                       | `pnpm --filter @klicker-uzh/auth test:prisma-adapter` — guarded, disposable local PostgreSQL only                                                                                           |
| UI or user flows                                                | e2e — new specs go to `klicker-playwright-e2e` (primary suite); use `klicker-cypress-e2e` only to keep the frozen legacy suite green                                                        |
| React component appearance/behavior only                        | there is **no component-test layer** — verify in the browser (below) and rely on e2e if a flow covers it                                                                                    |
| Office Add-in source, build, or manifest                        | Run its `check`, `lint`, `test`, `build:docs`, `verify:docs`, and `validate` scripts; use a stubbed Office API for browser UI checks and sideload the manifest in PowerPoint before release |

Never run root `pnpm run test:run` blind — its turbo fan-out includes Cypress, which needs a running seeded stack.

Direct checks for `auth`, `chat`, `frontend-control`, `frontend-manage`, and `frontend-pwa` generate ignored Next route types first through each app's `check` script. Do not hand-edit or commit `next-env.d.ts`; keep it ignored and included by `tsconfig.json`. The three PWA apps use `tsconfig.check.json` only for raw package checks so stale `.next/dev/types` cannot duplicate fresh Pages Router validators. Next builds use the canonical `tsconfig.json`; Next 16 filters development validators on its production typecheck path. Auth and Chat use their main config for both checks and builds.

For CODE contract, policy, or sandbox-client work, the fast service-free baseline is:

```bash
pnpm --filter @klicker-uzh/util exec vitest run \
  test/codeElements.test.ts \
  test/codeApi.test.ts
pnpm --filter @klicker-uzh/graphql exec vitest run \
  test/codeElementPolicy.test.ts \
  test/codeGraphqlContract.test.ts \
  test/validateCodeOptions.test.ts
```

For `codeApi.ts`, ensure the two generated-runner tests did not skip. If the devcontainer has no Python, run the focused suite from `packages/util` with an isolated interpreter:

```bash
uv run --no-project --python 3.12 -- \
  node node_modules/vitest/vitest.mjs run test/codeApi.test.ts
```

The runner tests cover pass/error/timeout behavior plus direct file-descriptor flooding and descendant-process cleanup. Do not send a live request until the CodeAPI deployment accepts `klicker_jwt`; once enabled, require distinct public/hidden sessions and retain no hidden output or session identifiers.

For CODE receipt, worker, or finalization changes, run the serialized database-backed lifecycle tracer:

```bash
pnpm --filter @klicker-uzh/graphql exec vitest run \
  test/codeSubmissions.test.ts
```

Require active-receipt convergence, durable pending state after enqueue failure, participant-scoped readback, duplicate delivery, retry after failure and commit, expired and unexpired claims, exhausted retries, `FAILED` retry, concurrent participant finalization, separate instance/participant aggregates, microlearning closure, public-only participant test results, public/hidden instructor aggregates, and exactly-once response/statistics/spaced-repetition/points/XP/leaderboard/timeline assertions. Mock only the sanitized CodeAPI executor result at this seam; runner and hostile-response behavior belongs to the service-free client suite. UI slices still require routed browser/e2e proof.

Manage CODE browser proof must select CODE through `select-question-type`, assert `code-options` renders without a CodeMirror console error, and confirm `student-element-preview` includes public test names but no hidden test names. In a practice-quiz or microlearning wizard, mixed CODE selection must disable the combined-stack action while the separate-stack action remains enabled.

Participant CODE browser proof must exercise published practice-quiz and microlearning activities with real activity queries. Cover active receipt persistence, pending reload, completion with public-only results, stale-active rejection, submitted-code recovery, cross-participant isolation, editable failure/new receipt retry, real microlearning `getPreviousStackEvaluation` readback, participant-scoped evaluation storage, and the authorized Manage public/hidden aggregate table. Use `playwright/tests/Q-code-practice-quiz.spec.ts` for deterministic receipt transitions. In the self-contained devcontainer, preserve the real backend by forwarding unmatched GraphQL operations to its container-local port with the original URL query string. For linked-worktree TLS routes, map Chromium with `PLAYWRIGHT_HOST_RESOLVER_RULES` to `host.docker.internal` and set the matching `COOKIE_DOMAIN`; mock only the external grading transition, not activity data or evaluation queries.

For Next framework or bundler changes, verify both repository-supported paths. `pnpm run build:test` uses Turbopack in all five Next apps. `pnpm run build` uses Turbopack for auth/chat and Webpack for control/manage/PWA until their service-worker integration moves to Serwist. Confirm standalone server paths for all five apps and `sw.js`, Workbox, and custom worker outputs for the three PWA apps.

The Playwright build job must tar the five `.next` trees before artifact upload and extract them in each shard. Direct artifact upload dereferences Turbopack's `.next/node_modules` symlinks and can omit transitive runtime links, producing HTTP 500 before the suite starts.

## Decide whether e2e is warranted locally

CI runs Cypress (8-way split) and Playwright (8-way shard) on almost every code PR — CI is the real e2e gate. Run e2e locally only when your change plausibly breaks a flow (new UI, changed selectors/`data-cy`, auth/redirect changes, activity lifecycle). If you do:

- You are **authorized to start the required servers for this purpose** — test stack via the e2e skills' setup instructions, plus the Hatchet general worker for publish/schedule/end flows and response-api + response processor for live-answer flows (exact triage in the e2e skills).
- Tear down afterwards (`./_down.sh`); leave the machine as you found it.
- On environment failure, switch to `klicker-environment-doctor` before blaming the test.

## Pre-PR verification checklist

Every item, in order; paste evidence (command + tail of output, screenshots) into the PR or task report:

1. `pnpm run check:all` — typecheck + format + lint + syncpack + AGENTS.md validation + Prisma-sync validation (same as pre-commit hook). The Prisma package check regenerates its client before typechecking, so it is safe from a clean checkout.
2. `pnpm run build` — same as pre-push hook; also refreshes generated artifacts.
3. Targeted tests per the routing table above — quote failures exactly; never delete/weaken a test to pass.
4. **Codegen artifacts committed** if any `.graphql` op or schema changed (`git status` must be clean after `pnpm --filter @klicker-uzh/graphql generate`).
5. **i18n pair check** if UI text changed: the key exists in BOTH `packages/i18n/messages/de.ts` and `en.ts`.
6. **Browser evidence for UI changes** — open the changed pages with `npx agent-browser@0.32.2` (never bare `agent-browser`), log in with delegated/test credentials (AGENTS.md), capture before/after screenshots. "The logic looks correct" does not count.

The root build forces `NODE_ENV=production`; direct Next package builds inside the devcontainer must set it explicitly. Stop the managed background dev process and remove only the target app's generated `.next/dev` cache before retrying a direct production build, or development validators can collide with production validators. Report Google Fonts network failures separately from compile/typecheck results.

For TypeScript or other compiler/toolchain upgrades, root `check:all` includes the Cypress and Playwright compilers through their package `check` scripts. Also run `pnpm run build:test` and the Docs production build; those surfaces remain outside the root check. Use direct package `tsc --noEmit -p tsconfig.json` commands only to isolate a Cypress or Playwright failure. When a check config extends a declaration-emitting config, verify the resolved compiler options: `noEmit` does not disable declaration portability analysis, so the check may also need explicit `declaration: false` and `declarationMap: false`. Incremental checks must use a different `tsBuildInfoFile` from the emitting build.

For a Prisma major or driver-adapter change, also run a frozen install; Prisma generate/check/build; local `*:raw` reset, push, migrate, diff, deploy, and explicit-seed command smokes as applicable; the guarded Auth adapter round-trip; both root build modes; relevant database-backed tests; and the Analytics Python generation/image build. Run destructive commands only against the isolated DevPod database and state every CI-only gap.

The Office Add-in is a browser application bundled by Rollup. Its package check must use the workspace TypeScript version, `moduleResolution: Bundler`, `noEmit`, and explicit `types: ["office-js"]`. `build:docs` regenerates and replaces the deployable directory; `verify:docs` must then prove exact parity. Browser checks with an Office API stub verify the UI state machine only. Persistence, multi-instance behavior, and embedded evaluation rendering still require a real PowerPoint sideload.

## Reporting

State what you ran, what passed, what you did NOT run and why (e.g. "no Infisical access — e2e left to CI"). An honest gap beats a fabricated green.
