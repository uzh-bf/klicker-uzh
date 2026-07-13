# Log

## 2026-07-13

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

## 2026-07-08

- **Update**: [testing](./testing.md) guide updated to document `Z-escape-room.spec.ts` in Playwright E2E spec list.
- **Update**: [domain-model](./domain-model.md) updated to document the generalized Escape Room Mode, configuration attributes, group activity correctness checks, reset permissions, and average stats aggregation.

## 2026-07-07

- **Update**: migration-in-flight banners added to [graphql-api-layer](./graphql-api-layer.md), [architecture-overview](./architecture-overview.md) (GraphQL→tRPC, PR #5132), and [chat-platform](./chat-platform.md) (AI-SDK→Mastra, PRs #5126/#5129) — pages stay authoritative until those PRs merge.

- **Update**: [testing](./testing.md) and [index](./index.md) reframed for the Cypress→Playwright switch — Playwright is the primary suite for new specs, Cypress is a frozen legacy suite pending removal (both still run in CI). Matching routing updates in the `klicker-testing-verification` and `klicker-cypress-e2e` skills. Migration roadmap: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

- **Update**: [index](./index.md) skill-routing section expanded with the seven new `klicker-*` skills.

- **Creation**: frontend + ops pages — [frontend-conventions](./frontend-conventions.md), [chat-platform](./chat-platform.md), [testing](./testing.md), [ci-and-deployment](./ci-and-deployment.md), [developing-a-feature](./developing-a-feature.md). Absorbed the remaining `project/CODEBASE_NOTES.md` sections; Playwright authoring/CI gotchas moved to the `klicker-playwright-e2e` skill.

- **Creation**: backend pages — [domain-model](./domain-model.md), [graphql-api-layer](./graphql-api-layer.md), [data-and-migrations](./data-and-migrations.md), [async-and-workers](./async-and-workers.md), [auth-model](./auth-model.md). Absorbed the GraphQL/data, export-package, and LTI entries from `project/CODEBASE_NOTES.md`.

- **Creation**: initial bundle — [index](./index.md), [getting-started](./getting-started.md), [architecture-overview](./architecture-overview.md). Evidence base: `project/docs/WIKI_BOOTSTRAP_BRINGUP.md` (executed bring-up) and `project/docs/WIKI_BOOTSTRAP_INVENTORY.md` (repo archaeology).
