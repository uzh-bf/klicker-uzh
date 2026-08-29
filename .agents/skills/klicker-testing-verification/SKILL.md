---
name: klicker-testing-verification
description: Choose the right test level and verify changes before a KlickerUZH PR. Use when deciding what to test, running tests locally, interpreting test failures, or assembling pre-PR verification evidence (typecheck, build, targeted tests, browser screenshots) for any change in this repository.
---

# KlickerUZH Testing & Verification

Facts about the test landscape: [docs/testing.md](../../../docs/testing.md). This skill is the procedure.

## Route the change

| You changed…                                                                      | Run                                                                                                                                                                                         |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic in grading/util/export/word-cloud and feature-flags core/Node adapters | `pnpm --filter @klicker-uzh/<pkg> test` — safe with no services                                                                                                                             |
| Chat app logic (`apps/chat`)                                                      | `pnpm --filter @klicker-uzh/chat test:run` — the package has no plain `test` script; CI includes it in `test-unit.yml`, but still run it locally before claiming verification               |
| `packages/graphql` services/schema                                                | `pnpm --filter @klicker-uzh/graphql test:local` — one-command bootstrap (real Postgres + Redis + Hatchet); serialized, don't parallelize                                                    |
| Auth adapter against shared Prisma client                                         | `pnpm --filter @klicker-uzh/auth test:prisma-adapter` — guarded, disposable local PostgreSQL only                                                                                           |
| React/browser feature-flag behavior                                               | browser verification with `npx agent-browser@0.32.2`; use e2e when a user flow covers it                                                                                                    |
| UI or user flows                                                                  | e2e — use `klicker-playwright-e2e`                                                                                                                                                          |
| React component appearance/behavior only                                          | there is **no component-test layer** — verify in the browser (below) and rely on e2e if a flow covers it                                                                                    |
| Office Add-in source, build, or manifest                                          | Run its `check`, `lint`, `test`, `build:docs`, `verify:docs`, and `validate` scripts; use a stubbed Office API for browser UI checks and sideload the manifest in PowerPoint before release |
| Prisma seed reconciliation                                                        | `pnpm --filter @klicker-uzh/prisma-data test` — Node test runner through the package's existing `tsx` toolchain                                                                             |

For the manage-list `All` page size, the focused browser evidence must cover
the finite-to-All-to-50 state transition and explicit selection. A 200-record
fixture is a bounded acceptance probe: verify the rendered count, batch-modal
usability, and returned mutation count; do not infer production performance or
atomicity from it.

Never run root `pnpm run test:run` blind — the graphql vitest config forces `pool: forks, singleFork: true` (serialized specs sharing DB state).

The focused `knowledge.test.ts`, `knowledgeIngestion.test.ts`, and `knowledgeWebhooks.test.ts` suites use real PostgreSQL but deliberately stub or avoid Hatchet, so they can verify owner-scoped binding replacement, MCP configuration, attempt-ledger, platform-refresh idempotency, current-attempt list projection, and serving-state transitions without a client token. Keep the full GraphQL suite on `test:local`.

For KB deletion changes, add real-PostgreSQL coverage for owner-hidden tombstones and KB-first create/delete races, plus Hatchet unit coverage for the exact external delete request, operation fencing, empty-serving cutover, ticket expiry, blob-before-row ordering, and idempotent maintenance retry.

For KB quota changes, use real PostgreSQL for exact 100-resource/500-MiB boundaries, concurrent reservations, ticket conversion, tombstone retention, and cleanup release. Use Hatchet tests for persisted KB-scope mismatch and locked URL replacement accounting (`usage - old size + observed size`) before dispatch.

For KB pagination and bulk operations, use real PostgreSQL for tied keyset order, malformed/owner/filter-mismatched cursors, status changes between resource pages, exact grouped metrics, tombstone hiding, deterministic lock order, all-or-nothing active/foreign guards, input bounds, and independent post-commit dispatch failure. The KB UI has no component-test layer; use the real delegated-login browser for EN/DE desktop catalog and detail flows. Mobile layout is not a Manage-app priority.

For the lecturer AI gate, verify the GrowthBook `ai-beta` flag and the live `User.aiFeaturesEnabled` entitlement independently, including fail-closed missing-account behavior and no entitlement query while the flag is off. Every lecturer KB service entry point and Manage chatbot operation returns `AI_BETA_ACCESS_REQUIRED` when the gate is closed; participant chatbot discovery and worker-only KB settlement stay available. Toggle `KB_INGESTION_DISABLED` at call time and prove it blocks upload-ticket issue, URL creation, and ingestion while leaving deletion available. Browser proof covers top-level AI navigation for an enabled lecturer and direct-route denial for a disabled one.

For KB file-upload browser proof, use the managed DevPod's routed Azurite service. Upload a synthetic PDF/TXT/MD fixture through the real hidden `[data-cy="kb-file-input"]`, then verify the resource row, exact size, and cleared upload reservation. The browser flow must cover ticket issue, Blob PUT, and confirmation; a CORS preflight may supplement it, but never print the SAS query. This proves local upload and confirmation only, not external ingestion acceptance.

For maintenance recovery, prove a stale `QUEUED` UPSERT with no external operation id re-dispatches the same stored attempt id, young/in-flight/tombstoned/DELETE rows are excluded, and a repeated sweep creates no replacement run. Source-gateway coverage uses real PostgreSQL to prove the exact version, non-tombstoned BLOB, digest, and QUEUED/PROCESSING predicate before Blob access; direct resolver tests cover loopback/private/link-local/IPv6 rejection without external network.

For OpenAI-compatible chat stream changes, run
`apps/chat/test/openai-chat-streaming.test.ts` before the full chat suite. The
fixture uses injected OpenAI-compatible SSE with a sparse first tool-call index
and proves public tool-call/finish conversion without a model key; it does not
replace a real-upstream staging smoke test.

For OpenAI-compatible request-policy or prompt-cache changes, run
`apps/chat/test/openai-cache-policy.test.ts` and
`apps/chat/test/prompt-cache-identity.test.ts` after the streaming fixture;
see [docs/testing.md](../../../docs/testing.md#which-level-for-which-change)
for contract details and evidence boundaries.

For chat conversation-rendering changes, `playwright/util/chat.ts` supports
`textChunks` and `chunkDelayMs` to deliver separate deltas through a browser
`ReadableStream`; `pauseAfterTextChunk` holds the stream at a deterministic
intermediate state until the test releases it. Use that seam to test the assistant
row while it is still streaming, and capture DOM identity around feedback clicks
when the bug concerns remounts or flicker. A passing final-text assertion alone
does not prove that the conversation stayed mounted.

For the active-branch chat history rail, keep the projection contract in
`apps/chat/test/history-rail.test.ts`: adjacent user/assistant messages form one
turn, orphan messages remain standalone, complete text is preserved for the
popover, and reasoning/tool/error parts never become rail landmarks. Verify
navigation in the browser at desktop and mobile widths. The browser check must
cover the bounded desktop tick rail ("md" and up) and the mobile history-trigger
dialog flow below "md", complete-text hover/focus popovers that are
hidden otherwise, click/focus behavior, current-entry highlighting, rapid
second-target navigation, collapsed tool groups remaining closed, and the
matching EN/DE labels; a local environment without an upstream model key can
still prove the rail's error-state rendering and navigation, but not
model-backed reasoning or tool content.

For chat Markdown or KaTeX streaming changes, `apps/chat/src/components/markdown-text.tsx`
uses the dependency-free `src/lib/markdown/streamingMath.ts` scanner to hide only unmatched
math tails while a text part is running. The browser contract must pause before a closing
delimiter, assert that preceding prose remains visible while raw delimiters, partial formula
text, and `.katex-error` remain absent, then release the stream and assert the complete KaTeX
node, surrounding Markdown, and stable assistant-row identity. Keep persisted multiline display
math coverage as well: a final formula count alone does not prove that prose or links after the
formula were not consumed by malformed fences.

For message-presentation changes, include a heading-rich answer and both explicit
and silent streamed failures in the focused browser contract: headings should
remain hierarchical and proportional, while failed assistant turns should not
expose reload, rating, or relative-time metadata alongside their dedicated retry
callout.

Direct checks for `auth`, `chat`, `frontend-control`, `frontend-manage`, and `frontend-pwa` generate ignored Next route types first through each app's `check` script. Do not hand-edit or commit `next-env.d.ts`; keep it ignored and included by `tsconfig.json`. The three PWA apps use `tsconfig.check.json` only for raw package checks so stale `.next/dev/types` cannot duplicate fresh Pages Router validators. Next builds use the canonical `tsconfig.json`; Next 16 filters development validators on its production typecheck path. Auth and Chat use their main config for both checks and builds.

For browser-facing `NEXT_PUBLIC_*` deployment changes, verify both the STG and
PRD build inputs. Next.js snapshots those values into the browser bundle at
build time, so a runtime ConfigMap or pod restart cannot repair an omitted
value. Keep environment-specific mappings in the app's `.env.stg` and
`.env.prd` files and add a build failure when silently omitting the value would
withdraw a user-facing surface.

For Next framework or bundler changes, verify both repository-supported paths. `pnpm run build:test` uses Turbopack in all five Next apps. `pnpm run build` uses Turbopack for auth/chat and Webpack for control/manage/PWA until their service-worker integration moves to Serwist. Confirm standalone server paths for all five apps and `sw.js`, Workbox, and custom worker outputs for the three PWA apps.

The Playwright build job must tar the five `.next` trees before artifact upload and extract them in each shard. Direct artifact upload dereferences Turbopack's `.next/node_modules` symlinks and can omit transitive runtime links, producing HTTP 500 before the suite starts. Each shard restores the generated GraphQL client map from `packages/graphql/dist/client.json` before tests because Turbo cache hits do not restore generated source files.

## Decide whether e2e is warranted locally

CI runs Playwright (8-way shard) on almost every code PR — CI is the real e2e gate. Run e2e locally only when your change plausibly breaks a flow (new UI, changed selectors/`data-cy`, auth/redirect changes, activity lifecycle). If you do:

- You are **authorized to start the required servers for this purpose** — test stack via the e2e skills' setup instructions, plus the Hatchet general worker for publish/schedule/end flows and response-api + response processor for live-answer flows (exact triage in the e2e skills).
- Tear down afterwards (`./_down.sh`); leave the machine as you found it.
- On environment failure, switch to `klicker-environment-doctor` before blaming the test.

For Chat model-picker or LiteLLM routing changes, treat the local proxy as a
separate proof gate: after `devrouter ensure .`, check LiteLLM liveness and the
chat credits payload before browser interaction. The local Auto Mode maps to
LiteLLM's Auto V2 `complexity-router`: require direct embedding and target-model
probes, then inspect logs for the expected `semantic_keyword_match` or
`llm_classifier` cause and routed model. A successful answer after a classifier
or embedding failure is only heuristic fallback and does not prove Auto V2.
The local aliases and generic upstream differ from deployment infrastructure,
so never report local routing as live production behaviour
([docs/chat-platform.md](../../../docs/chat-platform.md)).
For Auto reasoning, use the Responses endpoint and omit a request-level effort:
require the routed target alias to retain its configured effort, a reasoning
summary part to reach the Chat stream, and the reasoning-effort selector to
remain absent for Auto. Staging/production compatibility remains unproven until
an authorized staging smoke covers Responses storage, tool continuation, and
reasoning against the deployed LiteLLM router.
Without `UPSTREAM_OPENAI_API_KEY`, stop at picker/error-state verification and
report the live-answer gap explicitly.

For the seeded local MCP smoke test, verify
`http://localhost:1417/health`, keep `Auto Mode` selected in Benibot, and send
the prompt recorded in `AGENTS.md`. Require a completed
`KB_doc_query` chip, the `KLICKER_LOCAL_MCP_OK` marker, and the synthetic source
card in a non-empty final answer both before and after reloading the thread.
During the live stream, a completed tool chip may precede answer text, but the
source section must stay absent for the assistant message's entire running
state, including after answer text begins. A terminal incomplete or aborted
tool-only turn must still expose valid completed sources after reload.
Use direct `GPT-5.6 Luna` only to isolate the router from the model/tool path.

For source citation presentation changes, the browser pass must verify that
source cards keep the source name and locator visible while excerpts stay in
hover/focus tooltips, and that inline citation chips expose the same preview
content plus their existing navigation hint. Keep touch verification scoped to
the compact card and existing URL/in-page citation actions because Radix
tooltips do not provide a separate tap disclosure contract.

Personal-element changes add focused Vitest coverage for the retrieval-before-
plan contract, the five-card cap, bounded cited-chunk normalization, typed
generation failures, approval/replay claims, idempotent saves, and
expected-version revision conflicts. Browser verification must use the seeded
local MCP fixture and cover the plan, candidate save join, reload, unsaved
revision, saved revision, and direct PWA practice route. The Chat capability
flag must be tested both disabled (creation tools hidden) and enabled; saved
card paths remain available in either state. A green GraphQL or chat check does
not prove the browser state or the external model path.

Grounded personal-element generation also needs deterministic tests for
structured abstention, missing locators, evidence-protocol leakage, grouped and
disjoint page ranges, exact web anchors, labelled-versus-physical page display,
unsafe-link suppression, legacy-source normalization, and the absence of source
bodies from persisted references. Revision tests must prove that a successful
generated revision replaces content and references together, while insufficient
evidence leaves both unchanged. Browser proof must show the same grouped
references on the Chat candidate and saved-card views, keep unavailable sources
visible without a link, and hide practice references until the answer is
revealed.

## Pre-PR verification checklist

Every item, in order; paste evidence (command + tail of output, screenshots) into the PR or task report:

1. `pnpm run check:all` — typecheck + format + lint + syncpack + AGENTS.md validation + Prisma-sync validation (same as pre-commit hook). The Prisma package check regenerates its client before typechecking, so it is safe from a clean checkout.
2. `pnpm run build` — same as pre-push hook; also refreshes generated artifacts.
3. Targeted tests per the routing table above — quote failures exactly; never delete/weaken a test to pass.
4. **Codegen verified** if any `.graphql` op or schema changed: run `pnpm --filter @klicker-uzh/graphql generate`, confirm the ignored typed documents and persisted-query maps exist, and confirm the tracked `packages/graphql/src/public/schema.graphql` has no unstaged generated diff.
5. **i18n pair check** if UI text changed: the key exists in BOTH `packages/i18n/messages/de.ts` and `en.ts`.
6. **Browser evidence for UI changes** — open the changed pages with `npx agent-browser@0.32.2` (never bare `agent-browser`), log in with delegated/test credentials (AGENTS.md), capture before/after screenshots. "The logic looks correct" does not count.

For Hatchet deployment endpoint changes, render the target environment's Helm chart and inspect every generated `HATCHET_API_URL`. Separately confirm that the configured HTTP API service and the secret-backed gRPC host belong to the same active Hatchet installation. A connected worker validates only gRPC; it does not prove that programmatic scheduled runs can reach the HTTP API.

For a staging source-branch or image-tag change, render the target environment's Helm chart from the exact branch ArgoCD will track and inspect every workload image tag. After an authorized sync, verify `Synced` and `Healthy` independently, then inspect non-ready pods for image-pull failures, restarts, and memory termination. A green image build or successful ArgoCD sync does not prove runtime readiness. See [CI & Deployment](../../../docs/ci-and-deployment.md#staging-promotion).

For a Node ESM service that TypeScript emits without bundling, import the emitted module with Node after compilation. Source checks and Vitest can resolve package directories that the production Node ESM loader rejects. The student MCP package build includes this check for its Apollo-backed GraphQL client.

For TypeScript or other compiler/toolchain upgrades, root `check:all` includes the Playwright compiler through its package `check` script. Also run `pnpm run build:test` and the Docs production build; those surfaces remain outside the root check. Use direct package `tsc --noEmit -p tsconfig.json` commands only to isolate a Playwright failure. When a check config extends a declaration-emitting config, verify the resolved compiler options: `noEmit` does not disable declaration portability analysis, so the check may also need explicit `declaration: false` and `declarationMap: false`. Incremental checks must use a different `tsBuildInfoFile` from the emitting build.

For a Prisma major or driver-adapter change, also run a frozen install; Prisma generate/check/build; local `*:raw` reset, push, migrate, diff, deploy, and explicit-seed command smokes as applicable; the guarded Auth adapter round-trip; both root build modes; relevant database-backed tests; and the Analytics Python generation/image build. Run destructive commands only against the isolated DevPod database and state every CI-only gap.

The Office Add-in is a browser application bundled by Rollup. Its package check must use the workspace TypeScript version, `moduleResolution: Bundler`, `noEmit`, and explicit `types: ["office-js"]`. `build:docs` regenerates and replaces the deployable directory; `verify:docs` must then prove exact parity. Browser checks with an Office API stub verify the UI state machine only. Persistence, multi-instance behavior, and embedded evaluation rendering still require a real PowerPoint sideload.

For KB graph lifecycle changes, use real PostgreSQL for quota-lock and settlement tests, including a valid metered non-success result that settles without publishing, the dispatch-claim ambiguity hold, and matching/stale/newer-build late-success reconciliation; apply the current migration to a disposable database before the seam tests. Use pure tests for the W1 result/cost contracts, PostgreSQL integer bounds, and quota-configuration drift; and use Hatchet unit tests for provider-status reconciliation and complete reservation identity before dispatch. A provider `COMPLETED` response without a versioned result must be asserted as fail-closed; it is not evidence of publication or cost settlement.

## Reporting

State what you ran, what passed, what you did NOT run and why (e.g. "no Infisical access — e2e left to CI"). An honest gap beats a fabricated green.
