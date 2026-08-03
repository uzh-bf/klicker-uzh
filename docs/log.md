# Log

## 2026-08-01

- **Independent-review remediation**: Adaptive first-save drafts now carry a stable UUID through the supported element mutations, and the unique assignment token makes lost-response retries return exactly one committed element while rejecting changed request bodies. Post-commit element-list refresh is best effort. Calibration exports use persisted run leases and run-specific artifact prefixes so reclaimed stale workers cannot publish or delete the replacement run. Scale links are capped at 1,000 anchors and load calibrations in 500-row batches for exact in-memory pair validation.
- **Implementation**: Final adaptive code-boundary hardening makes supported first-save element assignment one atomic GraphQL transaction, replaces the submission-time IRT switchboard with one correlated typed estimator transition and common persistence sequence, and centralizes strict enabled-root weight validation/normalization across package, GraphQL, reachability, runtime, and Manage preview callers. Assignment failures are localized without hiding unknown server errors, numerically underflowed enabled weights fail closed, and the initial-assignment switch has a programmatic accessible name.
- **Maintainability**: The adaptive Prisma schema, integration-test registries/support, and deterministic seed fixtures are split into bounded domain-focused files. Test registrars remain discoverable through the two canonical `*.test.ts` entry points, and the adaptive CI action is pinned by commit SHA.
- **Verification**: All 198 adaptive package tests, 69 Manage tests, and 81 database-backed adaptive GraphQL tests pass. A clean PostgreSQL database applies all 193 migrations, Prisma sync/generation pass, two serial real-browser authoring journeys pass, and direct browser inspection verifies atomic first-save assignment and its accessible switch. `pnpm run check:all` and all 22 production build targets pass; diff-scoped OpenGrep reports zero findings (with parser warnings only in unchanged workflow expressions).
- **Measurement gate**: The deterministic IRT release suite passes its 198 core tests, 33 v1 simulations, 33 v2/statistics tests, three performance tests, report validation, and determinism check. No configured v2 promotion threshold passes, so `IRT_V2_DIAGNOSTIC` remains correctly fail-closed; this result must not be weakened or exposed as a user-facing simulator.

## 2026-07-30

- **Implementation**: Competence-tree authoring now distinguishes the labelled **Add root competence** and **Add subcompetence** commands, selects and focuses every new node, and retains Duplicate solely as a copy operation. Empty assignment tables link to the existing element library, while supported element creation offers an optional pre-save tree/leaf/level assignment with an explicit **Create element and assign** outcome. The original two-write recovery was replaced on 2026-08-01 by one atomic server mutation.
- **Verification**: The five-scenario adaptive Chromium workflow passes from a clean seed, covering the explicit root/child controls, focus behavior, tree-to-element navigation, first-save mapping failure/retry, semantic assignment table, quiz publication, and student/cohort results. Manage unit tests and typechecks pass; desktop and 390 px browser QA confirms the adaptive mapping section has no horizontal overflow and records the hierarchy and first-save assignment states under `project/screenshots/adaptive-learning-final/`.
- **Implementation**: Final adaptive release hardening splits the GraphQL runtime, configuration, cohort, and competence-tree services into bounded acyclic modules; removes misleading cohort lifecycle fields; closes non-owner course-link count leakage; and keeps participant numerical precision aligned with the canonical integer element contract. The independent final-review remediation preserves `MASTERY`/`NEAREST` result meaning, recovers committed restarts after a lost mutation response, preserves unknown elapsed time, adds stable archive-oriented course-history retention, and replaces the assignment grid with a semantic responsive table.
- **Verification**: Thirteen Chromium tests pass together across `Z-adaptive-learning.spec.ts` and `Z-adaptive-learning-release.spec.ts`. They cover rollout gating, depth-5 cross-course reuse, real validation-failure mapping recovery, semantic assignment-table behavior, all five valid element types, zero-answer resume/start-over and lost-response recovery, unknown timing, publication and revocation, permission non-enumeration, stale/concurrent duplicate rejection, mapping-rule-specific bilingual level-band results, retained course deletion, fixed five-person and ten-person releases, and singleton/complementary-cell suppression. Focused tests, all workspace typechecks, Prettier, Syncpack, container lint, generated GraphQL contracts, and all 22 production build targets pass. Production-clone SLO evidence, deployment rehearsal, legacy audit, real-course psychometric validation, retention approval, and named rollout signoffs remain open.

## 2026-07-14

- **Update**: Adaptive cohort reporting now materializes one typed aggregate-only snapshot per fixed five-participant release/policy, selects canonical attempts in bounded batches, invalidates snapshots on erasure, bulk-persists estimates, and emits privacy-safe lifecycle, retry, integrity, publication, sharing, cohort, and course-gate events. The operations runbook defines dashboards, alert thresholds, and an alert-firing drill.
- **Update**: Phase 12/13 hardening adds full-form depth-5 tree reconciliation, durable element-mapping recovery, shared unsaved-navigation guards, accessible responsive authoring/results, bounded tree catalogs, split acyclic service facades with architecture guards, and an opt-in maximum-shape database benchmark harness.
- **Update**: [adaptive-learning](./adaptive-learning.md), [adaptive-learning-operations](./adaptive-learning-operations.md), and [data-and-migrations](./data-and-migrations.md) now record the Phase 11 canonical preset source, removal of four inert settings, five-item product blueprint, structural Research publication gate, runtime coverage semantics, deterministic exposure hashing, profile-aware simulation regressions, six-band feasibility bound, unchanged real-course pilot gates, and two-expert standard-setting protocol.
- **Verification**: A clean PostgreSQL 17 database applies all 189 migrations and the populated Phase 10 repair rehearsal passes after 184 prior migrations. The five-scenario production-built Chromium journey covers six participants, fixed five-person release, mapping and transient-query recovery, missing-duration withholding, bilingual results, and mobile layout. The generated deterministic report covers 21 scenarios and 2,424 learner traces; all four canonical target/rich engineering profiles pass their declared regression baselines. These local checks do not satisfy the production-sized SLO, teacher-agreement, cap, exposure, fairness, privacy-owner, or operational pilot gates.

## 2026-07-13

- **Update**: [data-and-migrations](./data-and-migrations.md), [adaptive-learning](./adaptive-learning.md), and [adaptive-learning-operations](./adaptive-learning-operations.md) now document the Phase 10 lock order, bounded transaction retry, quiz/course/history retention, participant erasure boundary, `RESTRICT` tree ownership, audited idempotent account transfer, forward runtime repair, validated constraints, aggregate preflight, and named deployment/backup/forward-fix responsibilities.
- **Verification**: The adaptive Phase 10 rehearsal applies 184 prior migrations, a populated malformed fixture, and all three forward migrations on PostgreSQL 17. Runtime, retry, rollout, and account-closure suites cover real lock blocking, both race orders, more-than-five-second lock survival, stable retry exhaustion, direct database retention, owner transfer, and participant erasure. Timed staging backup/restore and named-human approval remain external release evidence.
- **Update**: [adaptive-learning](./adaptive-learning.md) and [adaptive-learning-operations](./adaptive-learning-operations.md) now document the Phase 9 field-aware k=5 serializer, explicit suppression reasons, privacy-safe anomaly telemetry, tree-owner publication reauthorization, linked-course manager execution, tree/archive/delete and revocation locking, locale-aware completion-duration reporting, and immutable-snapshot takedown semantics. Broad cohort release remains blocked until Phase 13 persists stable release snapshots.
- **Verification**: Nineteen table-driven privacy tests and 72 focused GraphQL privacy, schema, runtime, readiness, publication, archive/delete, revocation, and permission tests pass. GraphQL/Manage/PWA/Playwright checks, generated contracts, production builds, a five-test Chromium workflow with released/withheld/minimum-sample, German-formatting, and mobile assertions, responsive screenshots, and a 1,074-rule OpenGrep scan also pass.
- **Update**: [adaptive-learning](./adaptive-learning.md), [adaptive-learning-operations](./adaptive-learning-operations.md), [graphql-api-layer](./graphql-api-layer.md), [data-and-migrations](./data-and-migrations.md), and [testing](./testing.md) now record the Phase 7 production hardening: enrollment/derived-permission metadata access, fixed five-participant cohort releases, hidden lifecycle counts, immutable post-attempt republishing, terminal stop-reason backfill, diagnostic timing semantics, and retry-safe four-item Playwright evidence.
- **Verification**: PostgreSQL 17 passes a clean 184-migration replay and a populated pre-runtime upgrade covering `TOTAL_QUESTION_CAP`, `CLASSIFIED`, `INSUFFICIENT_DATA`, and `ABANDONED`. All 79 focused adaptive/competence-tree GraphQL tests, 32 package tests, 19 production-runtime simulations, the 10,000-item guardrail, all 22 sequential production build tasks, and the five-test Chromium journey pass. OpenGrep reports no finding across 210 applicable rules; real browser screenshots show the question timer, a four-point student level-band result, and five released lecturer results after a sixth student completes.
- **Creation**: [adaptive-learning-operations](./adaptive-learning-operations.md) defines the default-off course rollout gate, reversible rollback behavior, anonymous pilot/calibration metrics, privacy thresholds, real-course go/no-go gates, support triage, ownership transfer, and the read-only staging/production legacy-data decision procedure.
- **Update**: [adaptive-learning](./adaptive-learning.md), [graphql-api-layer](./graphql-api-layer.md), [data-and-migrations](./data-and-migrations.md), and [testing](./testing.md) document the Phase 7 rollout flag, localized readiness issue contract, canonical-response diagnostics, curated migration, administrative permission checks, and focused integration/Playwright coverage.
- **Implementation**: [adaptive-learning](./adaptive-learning.md) now documents the completed Phase 6 student experience inside the existing PracticeQuiz route: intro and honest upper-bound progress, zero-answer resume and atomic restart, policy-authorized retakes, permission-derived lecturer preview, all five accessible response controls, server-served submissions, durable classified/incomplete results, one normalized uncertainty trajectory, level bands, a depth-5 profile, English/German copy, and a race-free embed-ready handshake.
- **Verification**: The PWA production build, 32 package tests plus 11 runtime and 9 configuration PostgreSQL integration tests, frontend/type/schema checks, participant-safe payload inspection, and real browser workflows pass. Desktop and 390 px screenshots cover intro, every item type, resume/start-over, classified and insufficient results, depth-5 expansion, and German localization; the embed reports `completed`, `currentStep: 5`, and upper-bound `totalSteps: 12` without console errors.
- **Review**: Browser and independent review fixes cover zero-answer resume, optional depth-5 leaf children, mutation/query races, sparse trajectory endpoints, completed-evidence consistency, retake and shared-preview capability, per-question focus/scroll, and answer-control semantics. A confidence-based recommendation was removed because uncertainty is not evidence of low competence. Automated cross-layer Playwright coverage and the controlled pilot remain Phase 7 gates.

## 2026-07-12

- **Implementation**: [adaptive-learning](./adaptive-learning.md) now documents the Phase 5 Manage experience: a reusable competence-tree library/editor, focused element mapping for the five supported types, an adaptive branch inside the existing four-step PracticeQuiz wizard, server-authoritative setup/publication readiness, immediate-only adaptive publication, and anonymous hierarchical cohort results under the existing evaluation route.
- **Verification**: A clean migration replay and deterministic seed produce a depth-5, cross-course tree and 15 balanced completed attempts. Generated GraphQL contracts, focused adaptive/grading/GraphQL tests, frontend typechecks, and desktop/mobile browser workflows pass. Adaptive content fits 390 px; the existing Manage desktop navigation remains wider than the viewport and is recorded as inherited global responsive debt.
- **Review**: The independent Phase 5 review found no P0 issue. Accepted findings tightened cohort results from READ to ADMIN, restricted the adaptive evaluation action to managers, made mode-switch confirmation cover the complete adaptive config, filtered course-link actions by write access, named dense editor controls, and added unsaved-change protection. The draft-time structural lock was retained as an intentional Phase 2 invariant. Backend-generated issue localization and automated Playwright coverage remain rollout gates.
- **Implementation**: [adaptive-learning](./adaptive-learning.md) now records the Phase 4 measurement gates. GraphQL and deterministic simulations share one package-owned production runtime; 19 production-shaped scenarios cover presets, form lengths, item mixes, pool sizes, noise, reachability, hierarchy and trajectory invariants. Controlled free-text and numerical boundaries are service-enforced, unscorable items no longer inflate readiness, dead adaptive shared components were removed, and the 500-node/20-level/10,000-item benchmark is documented with explicit limits on what synthetic evidence can claim.
- **Verification**: The monorepo typecheck, Prettier, Syncpack, adaptive/grading/GraphQL tests and builds, both frontend checks, database-backed adaptive lifecycle tests, and focused OpenGrep scan pass. The only root lint failure remains the unrelated existing `apps/chat` missing `eslint-plugin-react-hooks` setup.
- **Review**: Independent Phase 4 review found and verified fixes for non-contiguous MC/KPRIM choice identifiers and empty MC responses conflicting with the modeled non-empty guessing space; the remediation spot-check found no new P0-P2 regression.

## 2026-07-10

- **Implementation**: [adaptive-learning](./adaptive-learning.md) now records the independently reviewed Phase 3 server-authoritative attempt runtime: immutable-pool delivery and grading, bounded pool projections, serializable concurrency control, enforced retake policy, deterministic hierarchical routing/stopping, maximum-likelihood reporting, root-weighted uncertainty, participant-safe level bands/trajectory, anonymous cohort suppression, actionable legacy preflights, and the matching runtime integrity migration. [data-and-migrations](./data-and-migrations.md) and [graphql-api-layer](./graphql-api-layer.md) document the database and API contracts.

- **Implementation**: [adaptive-learning](./adaptive-learning.md) now documents the hardened Phase 2 adaptive PracticeQuiz contract: persisted presets and attempt policy, shared-cap/common-theta readiness, permission-protected owner preview, participant hiding before Phase 3, gamification isolation, deleted-source rejection, transactional immutable pools, immediate-only publication, cross-config database integrity, and post-attempt locking. [data-and-migrations](./data-and-migrations.md) and [graphql-api-layer](./graphql-api-layer.md) record the matching migration and API rules.

- **Update**: [adaptive-learning](./adaptive-learning.md), [graphql-api-layer](./graphql-api-layer.md), and [data-and-migrations](./data-and-migrations.md) now document the transactional competence-tree contract, cross-course access policy, structural lock, adaptive integrity migration, reviewed numerical normalization, and verified service tests.

## 2026-07-09

- **Creation**: [adaptive-learning](./adaptive-learning.md) added as the stable engineering page for competence-tree based adaptive practice quizzes, including item parameters, readiness gates, permissions/privacy boundaries, and legacy cleanup policy.

- **Update**: [testing](./testing.md) CI matrix now includes the path-filtered `test-adaptive-learning` workflow for the pure adaptive package.

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
