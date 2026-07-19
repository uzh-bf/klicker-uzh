# Log

## 2026-07-19

- **Update**: final Escape Room hardening centralizes attempt/hint/reset ownership, makes reset atomic, serializes GraphQL and LiveQuiz grading with post-claim state checks, preserves Escape Room LiveQuiz templates, aligns edit/reset/QR controls with permissions, and splits the large regression modules along mode boundaries.

- **Update**: the lecturer and student Escape Room tutorials now cover Practice Quiz, Microlearning, Group Activity, Live Quiz blocks, shared group attempts, QR print/decoy setup, camera fallback, monitoring, and reset behavior. The Docusaurus production build passes; existing unrelated link and anchor warnings remain.

- **Update**: [getting-started](./getting-started.md) and the environment-doctor skill record the required `/AddResponse` suffix for LiveQuiz submissions in every local routing mode.

- **Update**: [auth-model](./auth-model.md), [testing](./testing.md), and the Playwright E2E skill document participant-cookie forwarding during PWA SSR and exact-workspace browser routing overrides used by the verified Escape Room suite.

- **Update**: [getting-started](./getting-started.md), [frontend-conventions](./frontend-conventions.md), and [testing](./testing.md) document the runtime-owned TypeScript compiler matrix, explicit Next.js build-validation config, isolated incremental-cache ownership, and check-only declaration trap. The matching verification procedure and solution notes preserve the required checks.

## 2026-07-18

- **Update**: [getting-started](./getting-started.md) pins released devrouter `0.0.35`; the managed-process fingerprint now includes the exact adapter bytes and declared non-secret origin environment as well as workspace and command identity.

- **Update**: [getting-started](./getting-started.md) now uses checkout-agnostic `devrouter ensure .`, runtime-delivered process supervision, durable exact-worktree ownership, and a self-contained uv/Python lint toolchain for both primary and linked devcontainers.

- **Update**: [frontend-conventions](./frontend-conventions.md), [testing](./testing.md), and [ci-and-deployment](./ci-and-deployment.md) document the mixed Next.js bundler contract: Turbopack for all development/test builds and auth/chat production, with Webpack retained only for PWA production builds until the planned Serwist migration.

## 2026-07-16

- **Update**: [data-and-migrations](./data-and-migrations.md) documents the safe production batch-seed workflow and the isolated Summer School portfolio command.

## 2026-07-15

- **Update**: [frontend-conventions](./frontend-conventions.md) and [testing](./testing.md) document valid-DOM video-link rendering, the supported YouTube/Kaltura forms, and editor/mobile overflow coverage.

## 2026-07-14

- **Update**: [getting-started](./getting-started.md) now delegates generic devcontainer process supervision to the packaged devrouter `0.0.30` helper. Klicker retains only its application command and environment setup; cold and warm exact-worktree startup, all ten routes, and delegated login were verified.

- **Update**: [getting-started](./getting-started.md) now pins published devrouter `0.0.29` and records the live fault-recovery proof: an HTTP 500 from stale Next.js development output triggers one bounded DevPod recreate, restores all ten routes, and returns to stable warm reuse.

## 2026-07-13

- **Update**: [getting-started](./getting-started.md) now pins published devrouter `0.0.28`, records the ten-route linked-worktree proof, documents the single `turbo dev` task set that prevents duplicate backend/PWA starts, and distinguishes static base-Compose doctor warnings from merged-overlay runtime proof. Devrouter's generated repository skill and refreshable AGENTS section were updated in the same change.

- **Update**: [getting-started](./getting-started.md) and the environment-doctor skill now make `devrouter workspace ensure .` the canonical linked-worktree startup path. The devcontainer overlay preserves host Git metadata, and `post-start.sh` reconciles only its fingerprinted process group.

- **Update**: Escape Room configuration now rejects non-integer or out-of-range game times and hint penalties before database access in all four modes; the shared five-second grace policy is used by GraphQL and response-api.
- **Update**: LiveQuiz Escape Rooms now enforce server-owned stage order for participant content, answers, and hints, and participant clients resynchronize after attempt start and stage completion.
- **Update**: Escape Room runtime hardening now expires incorrect-response counters, resets participant response state when an attempt scope changes, awaits dashboard resets, reports initial progress-query failures, and protects QR print data with schema-level element permission checks.
- **Update**: [async-and-workers](./async-and-workers.md), [domain-model](./domain-model.md), and [graphql-api-layer](./graphql-api-layer.md) now document the 02:00 UTC prune schedule, all-enrolled roster semantics, configuration limits, LiveQuiz stage masking, and QR print authorization.

## 2026-07-11

- **Update**: QR Scan questions can now be answered across all Escape Room modes through native browser scanning or validated manual entry; exact-code grading remains server-side, malformed values fail closed, and QR placement outside Escape Room activities is rejected.
- **Update**: QR Scan owners now have printable, neutrally labeled QR sheets with request-time ephemeral decoys and a screen-only answer legend; decoys are neither persisted nor participant-visible.
- **Update**: QR Scan elements can now be authored, reopened, and duplicated; codes are generated on create/duplicate, preserved on edit, and readable only by the exact owner.
- **Update**: [domain-model](./domain-model.md) now documents the `QR_SCAN` element contract, opaque CSPRNG code storage, and participant snapshot leakage boundary.
- **Update**: LiveQuiz blocks now support Escape Room authoring and participant runtime: validated gradable element types, config/hint edit readback, explicit attempt start, attempt-scoped local progress, timer/lockout controls, charged hint reveal/restoration, and completion state.
- **Update**: the LiveQuiz cockpit now polls active Escape Room block progress, binds quiz/block identifiers to prevent cross-quiz reads, reports completed block progress, and exposes reset only with WRITE permission.
- **Update**: [async-and-workers](./async-and-workers.md) and [domain-model](./domain-model.md) now document the enforced LiveQuiz Escape Room response contract, multi-instance completion, and deterministic event deduplication.
- **Update**: [domain-model](./domain-model.md) and [graphql-api-layer](./graphql-api-layer.md) now document shared GroupActivity escape-room attempts, atomic concurrent hint penalties/restoration, retry-preserving lockouts, and structured participant errors.
- **Update**: escape room production pass on the `codex/escape-room-production` branch — practice quiz game loop fixed for server-side stack masking (escape-mode advance/retry in `PracticeQuiz.tsx`), `Z-escape-room.spec.ts` rewritten as a full 11-test workflow, and user-facing lecturer/student tutorials added to `apps/docs`. Roadmap details: `project/2026-07-10-pr-5143-escape-room-implementation-review.md`.

- **Update**: [getting-started](./getting-started.md), [data-and-migrations](./data-and-migrations.md), [frontend-conventions](./frontend-conventions.md), and [testing](./testing.md) document the TypeScript 6 workspace baseline, the separate Office Add-in exception, Prisma generation compatibility guard, explicit path mapping, and compiler-upgrade verification surfaces. Matching procedure was added to `klicker-data-model` and `klicker-testing-verification`.

## 2026-07-10

- **Update**: [chat-platform](./chat-platform.md), [testing](./testing.md), and [ci-and-deployment](./ci-and-deployment.md) documented the initial Next 16 single-Webpack strategy, superseded by the mixed-bundler update on 2026-07-18. They also cover the standalone image contract, generated PWA artifacts, and framework-upgrade verification boundary. The testing-verification skill now matches the eight Playwright CI shards.

- **Update**: [auth-model](./auth-model.md) documents validated login return targets for manage, PWA, and chat. Manage accepts only its configured origin. PWA accepts its configured origin plus the configured chat origin. Malformed and untrusted targets fall back to the application root.

- **Update**: [frontend-conventions](./frontend-conventions.md) and [getting-started](./getting-started.md) document deterministic Next.js route-type generation: app checks run `next typegen`, generated `next-env.d.ts` stays ignored, both route-type directories stay in the Next-owned config, and PWA app check configs omit duplicate dev validators from raw `tsc`. Matching procedure added to `klicker-testing-verification`.

## 2026-07-08

- **Update**: [frontend-conventions](./frontend-conventions.md) updated with Markdown link interception behavior and Kaltura PlaykitJs bypass player details.
- **Update**: [testing](./testing.md) guide updated to document `Z-escape-room.spec.ts` in Playwright E2E spec list.
- **Update**: [domain-model](./domain-model.md) updated to document the generalized Escape Room Mode, configuration attributes, group activity correctness checks, reset permissions, and average stats aggregation.

## 2026-07-07

- **Update**: migration-in-flight banners added to [graphql-api-layer](./graphql-api-layer.md), [architecture-overview](./architecture-overview.md) (GraphQL→tRPC, PR #5132), and [chat-platform](./chat-platform.md) (AI-SDK→Mastra, PRs #5126/#5129) — pages stay authoritative until those PRs merge.

- **Update**: [testing](./testing.md) and [index](./index.md) reframed for the Cypress→Playwright switch — Playwright is the primary suite for new specs, Cypress is a frozen legacy suite pending removal (both still run in CI). Matching routing updates in the `klicker-testing-verification` and `klicker-cypress-e2e` skills. Migration roadmap: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

- **Update**: [index](./index.md) skill-routing section expanded with the seven new `klicker-*` skills.

- **Creation**: frontend + ops pages — [frontend-conventions](./frontend-conventions.md), [chat-platform](./chat-platform.md), [testing](./testing.md), [ci-and-deployment](./ci-and-deployment.md), [developing-a-feature](./developing-a-feature.md). Absorbed the remaining `project/CODEBASE_NOTES.md` sections; Playwright authoring/CI gotchas moved to the `klicker-playwright-e2e` skill.

- **Creation**: backend pages — [domain-model](./domain-model.md), [graphql-api-layer](./graphql-api-layer.md), [data-and-migrations](./data-and-migrations.md), [async-and-workers](./async-and-workers.md), [auth-model](./auth-model.md). Absorbed the GraphQL/data, export-package, and LTI entries from `project/CODEBASE_NOTES.md`.

- **Creation**: initial bundle — [index](./index.md), [getting-started](./getting-started.md), [architecture-overview](./architecture-overview.md). Evidence base: `project/docs/WIKI_BOOTSTRAP_BRINGUP.md` (executed bring-up) and `project/docs/WIKI_BOOTSTRAP_INVENTORY.md` (repo archaeology).
