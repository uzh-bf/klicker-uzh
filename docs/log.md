# Log

## 2026-08-31

- **Correction**: LiveQuiz CODE receipt creation now serializes with block
  closure, quiz end rejects active blocks and in-flight grading, and Redis
  projection rejects stale block executions before writing results,
  leaderboards, or XP.
- **Correction**: LiveQuiz CODE bonus timing now uses the first correct response,
  stale/missing cache execution markers remain recoverable, and WebSocket
  authentication follows the same origin/mode-specific cookie selection as
  HTTP while retaining explicit bearer precedence.
- **Update**: participant polling failures expose a retry action; focused CODE
  service/export tests and real routed authoring, Live Quiz placement/start, and
  participant rendering were reverified.

## 2026-08-28

- **Update**: course-linked LiveQuiz blocks now support one CODE element for permanent participants with active course Participation. CODE receipts bind the block execution, finalize into `LiveQuizResponse`, project idempotent cockpit/gamification counters, recover cache failures without grading twice, and remain unsupported for course-less quizzes, temporary participants, mixed blocks, groups, and templates.
- **Update**: Manage/PWA authoring and participant receipt flows, assessment response rendering, pseudonymized export handling, lifecycle tests, browser expectations, and the matching CODE skills now document the LiveQuiz path.

## 2026-07-30

- **Security**: activity edits now accept persistent instance IDs only from the exact activity and recheck the scope transactionally; group-activity clue replacement happens after that fence in the same transaction. CODE submission lookup normalizes missing, wrong-type, foreign-course, unavailable, and inactive-participation cases.
- **Update**: CODE authoring and runtime share test-ID and aggregate-weight constraints, provider throttling preserves the ordinary grading-attempt budget, and finalized responses carry trusted correctness for daily and course Analytics.
- **Security**: CODE final review now binds element autosaves to the authenticated lecturer, permission-scopes template type preflights, and enforces JSON breadth before traversal expansion. The matching frontend, GraphQL, domain-model, and agent-skill contracts document those boundaries.
- **Update**: [GraphQL API layer](./graphql-api-layer.md) and [async workers](./async-and-workers.md) document CODE rate-limit deferral, due-only recovery, transactional status fencing without an aggregate submission ledger, one shared post-grading persistence tail, and the dedicated asynchronous submission contract.
- **Update**: the CODE implementation plan records Slice 7 hardening, bounded local concurrency evidence, contract consolidation, exact-review closure, and the remaining external CodeAPI staging/load and pilot-package gates.

## 2026-07-29

- **Creation**: [ADR 0003](./adr/0003-use-klicker-codeapi-principal-source.md) records that Klicker-minted CodeAPI tokens use a dedicated `klicker_jwt` principal source through an environment-configurable allow-list.
- **Update**: [domain model](./domain-model.md), [GraphQL API layer](./graphql-api-layer.md), [frontend conventions](./frontend-conventions.md), and [testing](./testing.md) now document the implemented CODE contracts, safe lecturer/participant projections, authoring boundary, focused checks, and devcontainer build caveats.
- **Update**: [architecture overview](./architecture-overview.md) and [testing](./testing.md) document the server-only CodeAPI trust boundary, separate public/hidden execution, short-lived asymmetric identity, shared JSON limits, process-group output/timeout enforcement, sanitized exact JSON grading, and service-free verification.
- **Update**: [domain model](./domain-model.md), [GraphQL API layer](./graphql-api-layer.md), [async workers](./async-and-workers.md), and [testing](./testing.md) document the participant-owned CODE receipt, expiring worker claims, recovery task, transactional exactly-once response side effects, subscription/poll fallback, and database-backed lifecycle tracer.
- **Update**: [frontend conventions](./frontend-conventions.md) and [testing](./testing.md) document the PWA CODE receipt state machine, participant-scoped recovery, terminal-state monotonicity, practice-quiz-only submission gate, completion-only advancement, failed retry, participant-safe feedback, and its real-app Playwright tracer.
- **Update**: [GraphQL API layer](./graphql-api-layer.md), [frontend conventions](./frontend-conventions.md), and [testing](./testing.md) document CODE microlearning submission, finalized participant readback, participant-scoped evaluation storage, public-only participant results, authorized public/hidden instructor aggregates, and the routed Playwright/agent-browser proof.

## 2026-07-23

- **Creation**: [ADR 0001](./adr/0001-separate-code-submission-lifecycle.md) records the separate CODE receipt lifecycle and idempotent finalization into the normal graded response.
- **Creation**: [ADR 0002](./adr/0002-keep-grading-assertions-outside-the-sandbox.md) records that expected outputs and grading decisions remain in Klicker rather than entering the untrusted sandbox.

## 2026-07-20

- **Update**: [getting-started](./getting-started.md) now records that the vanilla Office Add-in follows the TypeScript 6 workspace baseline with explicit Office global types. [testing](./testing.md) and the `klicker-testing-verification` procedure cover its URL tests, build, deployment parity, manifest, browser, and PowerPoint host checks.

## 2026-07-19

- **Update**: [data-and-migrations](./data-and-migrations.md) and [testing](./testing.md) document Prisma 7 adapter ownership, split JavaScript/Analytics datasource ownership, explicit generation and seeding, removal of the TypeScript namespace patch, and the guarded Auth adapter compatibility check. Matching data-model, environment-doctor, and verification procedures were updated in the same change.

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

## 2026-07-11

- **Update**: [getting-started](./getting-started.md), [data-and-migrations](./data-and-migrations.md), [frontend-conventions](./frontend-conventions.md), and [testing](./testing.md) document the TypeScript 6 workspace baseline, the separate Office Add-in exception, Prisma generation compatibility guard, explicit path mapping, and compiler-upgrade verification surfaces. Matching procedure was added to `klicker-data-model` and `klicker-testing-verification`.

## 2026-07-10

- **Update**: [chat-platform](./chat-platform.md), [testing](./testing.md), and [ci-and-deployment](./ci-and-deployment.md) documented the initial Next 16 single-Webpack strategy, superseded by the mixed-bundler update on 2026-07-18. They also cover the standalone image contract, generated PWA artifacts, and framework-upgrade verification boundary. The testing-verification skill now matches the eight Playwright CI shards.

- **Update**: [auth-model](./auth-model.md) documents validated login return targets for manage, PWA, and chat. Manage accepts only its configured origin. PWA accepts its configured origin plus the configured chat origin. Malformed and untrusted targets fall back to the application root.

- **Update**: [frontend-conventions](./frontend-conventions.md) and [getting-started](./getting-started.md) document deterministic Next.js route-type generation: app checks run `next typegen`, generated `next-env.d.ts` stays ignored, both route-type directories stay in the Next-owned config, and PWA app check configs omit duplicate dev validators from raw `tsc`. Matching procedure added to `klicker-testing-verification`.

## 2026-07-08

- **Update**: [frontend-conventions](./frontend-conventions.md) updated with Markdown link interception behavior and Kaltura PlaykitJs bypass player details.

## 2026-07-07

- **Update**: migration-in-flight banners added to [graphql-api-layer](./graphql-api-layer.md), [architecture-overview](./architecture-overview.md) (GraphQL→tRPC, PR #5132), and [chat-platform](./chat-platform.md) (AI-SDK→Mastra, PRs #5126/#5129) — pages stay authoritative until those PRs merge.

- **Update**: [testing](./testing.md) and [index](./index.md) reframed for the Cypress→Playwright switch — Playwright is the primary suite for new specs, Cypress is a frozen legacy suite pending removal (both still run in CI). Matching routing updates in the `klicker-testing-verification` and `klicker-cypress-e2e` skills. Migration roadmap: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

- **Update**: [index](./index.md) skill-routing section expanded with the seven new `klicker-*` skills.

- **Creation**: frontend + ops pages — [frontend-conventions](./frontend-conventions.md), [chat-platform](./chat-platform.md), [testing](./testing.md), [ci-and-deployment](./ci-and-deployment.md), [developing-a-feature](./developing-a-feature.md). Absorbed the remaining `project/CODEBASE_NOTES.md` sections; Playwright authoring/CI gotchas moved to the `klicker-playwright-e2e` skill.

- **Creation**: backend pages — [domain-model](./domain-model.md), [graphql-api-layer](./graphql-api-layer.md), [data-and-migrations](./data-and-migrations.md), [async-and-workers](./async-and-workers.md), [auth-model](./auth-model.md). Absorbed the GraphQL/data, export-package, and LTI entries from `project/CODEBASE_NOTES.md`.

- **Creation**: initial bundle — [index](./index.md), [getting-started](./getting-started.md), [architecture-overview](./architecture-overview.md). Evidence base: `project/docs/WIKI_BOOTSTRAP_BRINGUP.md` (executed bring-up) and `project/docs/WIKI_BOOTSTRAP_INVENTORY.md` (repo archaeology).
