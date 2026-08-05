## 2026-08-03

- **Update**: PR #5109 integrated the current `v3-ai` base (TypeScript 6, Prisma
  7, Biome/Knip/Gitleaks quality gates). Under TypeScript 6, `apps/mcp-lecturer`
  and `apps/mcp-student` needed `baseUrl` dropped and `"types": ["node"]` set
  explicitly — the emitting build config no longer picks up `@types/node`
  automatically, and only the check config was masking it via `vitest.config.ts`.
  `apps/mcp-student` also needed a `with { type: 'json' }` import attribute for
  `@klicker-uzh/graphql/dist/client.json` under `module: NodeNext`.
  `@assistant-ui/react-ai-sdk` stays pinned at `1.3.7`: `1.3.26` moved its runtime
  types to `@assistant-ui/core`/`@assistant-ui/store` and no longer depends on
  `@assistant-ui/react` at all, so `useChatRuntime`'s `AssistantRuntime` stops
  matching the provider from `@assistant-ui/react@0.12.10`. That version also has
  an undeclared `assistant-stream` dependency, which only resolves through pnpm's
  hoisted store — an incremental `pnpm add` can leave it unhoisted and break the
  Turbopack build until a `pnpm install --force`.
  The PR's earlier 148/148 evaluator pass and green CI predate this base merge.

## 2026-08-01

- **Update**: [chat-platform](../chat-platform.md) records the Manage assistant's
  scoped single-element lookup and SC/MC option-feedback consistency guardrails.
  The upgraded DeepEval 4.1.5 evaluator using direct `gpt-5.6-luna` now has a
  measured 148/148 `OVERALL: PASS` baseline; details remain in
  `evaluation/manage-assistant/README.md`.

## 2026-07-29

- **Update**: [testing](../testing.md) and the `klicker-playwright-e2e` skill document the opt-in Firefox/WebKit assistant release matrix. Ordinary Playwright CI remains Chromium-only; cross-browser release evidence must use production builds and matching Playwright browser binaries.

- **Update**: [chat-platform](../chat-platform.md) records the Manage route's Next-middleware bypass, one-request per-pod memory guard and retryable 503 contract, explicit request deadlines, server-side UI-message trust boundary, production-standalone memory evidence, and 200 MiB request / 400 MiB limit for staging and production Chat pods.

## 2026-07-28

- **Update**: [chat-platform](../chat-platform.md) documents the Manage assistant's 16 MiB streamed request boundary, generic 413/400 behavior, auth/rate-limit-before-read order, and Manage-only two-image cap; participant chat remains at three images.

- **Update**: [frontend-conventions](../frontend-conventions.md) records that both assistant drawers implement the shared portalled-modal, focus-containment, and page-isolation contract. [testing](../testing.md) records the dedicated PWA course-chat drawer and entry-fallback Playwright coverage.

- **Update**: [testing](../testing.md) and the Manage-assistant eval README now define E7 through explicit assistant-text and transport/UI channels. Route-level 401/429 checks require the exact safe public response and visible recoverable generic UI; silence or merely leak-free malformed output no longer passes.

## 2026-07-27

- **Update**: [auth-model](../auth-model.md) records the Manage-assistant system prompt's new no-disclosure rule for the tool-output fence markers and sentinel, why it is not redundant with the fencing itself, and the before/after E6 measurement that motivated it.

- **New**: [solutions/best-practice/dev-seed-is-not-idempotent-reset-first](../solutions/best-practice/dev-seed-is-not-idempotent-reset-first.md) — `seed:raw` fails `P2002` on `Account` against an already-seeded DB _after_ its delete phase, leaving a half-seeded database; reset first, and seed harness-owned elements after the base seed, never before.

## 2026-07-26

- **Update**: [testing](../testing.md) documents the lecturer MCP's `smoke:negative` authZ/negative-path script alongside the existing `smoke:local` happy path, and the new `test-mcp-lecturer` CI workflow (Postgres-only: unit tests, migrate + `seed:test`, boot the built server, run both smokes).

## 2026-07-25

- **Update**: [frontend-conventions](../frontend-conventions.md) and [chat-platform](../chat-platform.md) document the Manage assistant's portalled modal boundary: the dialog stays outside the inert, assistive-technology-hidden page root.

- **Update**: [auth-model](../auth-model.md) documents the lecturer MCP's current internal JWT trust chain, confirms that it is not OAuth-exposed, and records the boundaries that an external MCP authorization design must address.

## 2026-07-23

- **Update**: [getting-started](../getting-started.md) documents that the devcontainer stack now also starts the lecturer MCP server (`apps/mcp-lecturer`, port 7081, no route) so the manage assistant always finds its tools without a manual step.
