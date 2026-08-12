---
name: klicker-testing-verification
description: Choose the right test level and verify changes before a KlickerUZH PR. Use when deciding what to test, running tests locally, interpreting test failures, or assembling pre-PR verification evidence (typecheck, build, targeted tests, browser screenshots) for any change in this repository.
---

# KlickerUZH Testing & Verification

Facts about the test landscape: [docs/testing.md](../../../docs/testing.md). This skill is the procedure.

## Route the change

| You changed…                                 | Run                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic in grading/util/export/word-cloud | `pnpm --filter @klicker-uzh/<pkg> test` — safe with no services                                                                                                                             |
| Chat app logic (`apps/chat`)                 | `pnpm --filter @klicker-uzh/chat test:run` — the package has no plain `test` script; CI runs the suite via `test-chat.yml`, but still run it locally before claiming verification           |
| `packages/graphql` services/schema           | `pnpm --filter @klicker-uzh/graphql test:local` — one-command bootstrap (real Postgres + Redis + Hatchet); serialized, don't parallelize                                                    |
| Auth adapter against shared Prisma client    | `pnpm --filter @klicker-uzh/auth test:prisma-adapter` — guarded, disposable local PostgreSQL only                                                                                           |
| UI or user flows                             | e2e — use `klicker-playwright-e2e`                                                                                                                                                          |
| React component appearance/behavior only     | there is **no component-test layer** — verify in the browser (below) and rely on e2e if a flow covers it                                                                                    |
| Office Add-in source, build, or manifest     | Run its `check`, `lint`, `test`, `build:docs`, `verify:docs`, and `validate` scripts; use a stubbed Office API for browser UI checks and sideload the manifest in PowerPoint before release |

Never run root `pnpm run test:run` blind — the graphql vitest config forces `pool: forks, singleFork: true` (serialized specs sharing DB state).

For OpenAI-compatible chat stream changes, run
`apps/chat/test/openai-chat-streaming.test.ts` before the full chat suite. The
fixture uses injected OpenAI-compatible SSE with a sparse first tool-call index
and proves public tool-call/finish conversion without a model key; it does not
replace a real-upstream staging smoke test.

For provider-option changes that must serialize through both OpenAI transports,
also run the focused provider-options fixture:

```bash
pnpm --filter @klicker-uzh/chat exec vitest run test/openai-provider-options.test.ts test/openai-chat-streaming.test.ts
```

It checks the turn-scoped `metadata.session_id` and thread-stable
`prompt_cache_key` on Chat Completions and Responses request bodies. This is
local serialization evidence only; it does not prove deployed routing or
provider cache hits.

For aggregate gateway cost evidence, run the pure synthetic contract from
`packages/prisma-data`:

```bash
pnpm exec tsx src/scripts/lib/aggregateCostReconciliation.test.ts
pnpm exec tsx src/scripts/lib/litellmCostSource.test.ts
```

The first command covers aggregate reconciliation; the second covers the
team-scoped, paginated LiteLLM request contract. The report mode in
`src/scripts/2026-06-16_analyze_chatbot_usage.ts` uses a half-open UTC window
and secret-backed read-only Langfuse/LiteLLM access. It counts positive-cost
generations and fails closed when cache buckets, scope, model/count parity, or
cost reconciliation are incomplete. Never infer cache tokens from price drift
and never report this aggregate mode as exact course allocation or Azure invoice
proof.

For chat conversation-rendering changes, `playwright/util/chat.ts` supports
`textChunks` and `chunkDelayMs` to deliver separate deltas through a browser
`ReadableStream`; `pauseAfterTextChunk` holds the stream at a deterministic
intermediate state until the test releases it. Use that seam to test the assistant
row while it is still streaming, and capture DOM identity around feedback clicks
when the bug concerns remounts or flicker. A passing final-text assertion alone
does not prove that the conversation stayed mounted.

Direct checks for `auth`, `chat`, `frontend-control`, `frontend-manage`, and `frontend-pwa` generate ignored Next route types first through each app's `check` script. Do not hand-edit or commit `next-env.d.ts`; keep it ignored and included by `tsconfig.json`. The three PWA apps use `tsconfig.check.json` only for raw package checks so stale `.next/dev/types` cannot duplicate fresh Pages Router validators. Next builds use the canonical `tsconfig.json`; Next 16 filters development validators on its production typecheck path. Auth and Chat use their main config for both checks and builds.

For Next framework or bundler changes, verify both repository-supported paths. `pnpm run build:test` uses Turbopack in all five Next apps. `pnpm run build` uses Turbopack for auth/chat and Webpack for control/manage/PWA until their service-worker integration moves to Serwist. Confirm standalone server paths for all five apps and `sw.js`, Workbox, and custom worker outputs for the three PWA apps.

The Playwright build job must tar the five `.next` trees before artifact upload and extract them in each shard. Direct artifact upload dereferences Turbopack's `.next/node_modules` symlinks and can omit transitive runtime links, producing HTTP 500 before the suite starts.

## Decide whether e2e is warranted locally

CI runs Playwright (8-way shard) on almost every code PR — CI is the real e2e gate. Run e2e locally only when your change plausibly breaks a flow (new UI, changed selectors/`data-cy`, auth/redirect changes, activity lifecycle). If you do:

- You are **authorized to start the required servers for this purpose** — test stack via the e2e skills' setup instructions, plus the Hatchet general worker for publish/schedule/end flows and response-api + response processor for live-answer flows (exact triage in the e2e skills).
- Tear down afterwards (`./_down.sh`); leave the machine as you found it.
- On environment failure, switch to `klicker-environment-doctor` before blaming the test.

For Chat model-picker or LiteLLM routing changes, treat the local proxy as a
separate proof gate: after `devrouter ensure .`, check LiteLLM liveness and the
chat credits payload before browser interaction. The local Auto Mode maps to
LiteLLM's `complexity-router` and routes through the GPT-5.6 Luna/Sol aliases —
a local-only tier map that the deployments do not ship, so never report local
routing as production behaviour ([docs/chat-platform.md](../../../docs/chat-platform.md)).
Without `UPSTREAM_OPENAI_API_KEY`, stop at picker/error-state verification and
report the live-answer gap explicitly.

## Pre-PR verification checklist

Every item, in order; paste evidence (command + tail of output, screenshots) into the PR or task report:

1. `pnpm run check:all` — typecheck + format + lint + syncpack + AGENTS.md validation + Prisma-sync validation (same as pre-commit hook). The Prisma package check regenerates its client before typechecking, so it is safe from a clean checkout.
2. `pnpm run build` — same as pre-push hook; also refreshes generated artifacts.
3. Targeted tests per the routing table above — quote failures exactly; never delete/weaken a test to pass.
4. **Codegen artifacts committed** if any `.graphql` op or schema changed (`git status` must be clean after `pnpm --filter @klicker-uzh/graphql generate`).
5. **i18n pair check** if UI text changed: the key exists in BOTH `packages/i18n/messages/de.ts` and `en.ts`.
6. **Browser evidence for UI changes** — open the changed pages with `npx agent-browser@0.32.2` (never bare `agent-browser`), log in with delegated/test credentials (AGENTS.md), capture before/after screenshots. "The logic looks correct" does not count.

For TypeScript or other compiler/toolchain upgrades, root `check:all` includes the Playwright compiler through its package `check` script. Also run `pnpm run build:test` and the Docs production build; those surfaces remain outside the root check. Use direct package `tsc --noEmit -p tsconfig.json` commands only to isolate a Playwright failure. When a check config extends a declaration-emitting config, verify the resolved compiler options: `noEmit` does not disable declaration portability analysis, so the check may also need explicit `declaration: false` and `declarationMap: false`. Incremental checks must use a different `tsBuildInfoFile` from the emitting build.

For a Prisma major or driver-adapter change, also run a frozen install; Prisma generate/check/build; local `*:raw` reset, push, migrate, diff, deploy, and explicit-seed command smokes as applicable; the guarded Auth adapter round-trip; both root build modes; relevant database-backed tests; and the Analytics Python generation/image build. Run destructive commands only against the isolated DevPod database and state every CI-only gap.

The Office Add-in is a browser application bundled by Rollup. Its package check must use the workspace TypeScript version, `moduleResolution: Bundler`, `noEmit`, and explicit `types: ["office-js"]`. `build:docs` regenerates and replaces the deployable directory; `verify:docs` must then prove exact parity. Browser checks with an Office API stub verify the UI state machine only. Persistence, multi-instance behavior, and embedded evaluation rendering still require a real PowerPoint sideload.

## Reporting

State what you ran, what passed, what you did NOT run and why (e.g. "no Infisical access — e2e left to CI"). An honest gap beats a fabricated green.
