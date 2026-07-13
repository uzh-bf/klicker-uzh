---
type: API Layer
title: GraphQL API Layer
description: Pothos code-first schema, the three-layer authorization pattern, service contract, operation naming, and the codegen ritual.
timestamp: '2026-07-13'
tags:
  - backend
  - graphql
---

# GraphQL API Layer

> **Migration in flight (2026-07):** a dual GraphQL→tRPC migration is open as PR #5132 (not yet merged) — a tRPC API in `packages/api` mounted at `/api/trpc` beside `/api/graphql`, with frontends moving to React Query app by app. This page describes current reality and stays authoritative until that PR merges; before extending the API surface, check the PR's status and which surface your target app uses. Staged doc/skill changes: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

**The pattern to copy exactly: resolvers are one-liners; authorization is three explicit, named layers.** Every protected field in `packages/graphql/src/schema/` composes the same three pieces — declare the role with `t.withAuth(...)`, check object-level permission with `withPermission(...)`, and let the service do the work. Deviating from this shape (inline logic in resolvers, hand-rolled permission checks) is the number-one review flag.

## Three-layer authorization

1. **Role/scope gate — `t.withAuth(scopeObject)`.** Scope objects are defined once near the top of `packages/graphql/src/schema/mutation.ts` (and mirrored in `query.ts`): `asUser`, `asUserFullAccess`, `asUserSessionExec`, `asUserOwner`, `asUserWithCatalyst`, `asParticipant`, `asTemporaryParticipant`, `asAdmin`. Their semantics come from `packages/graphql/src/builder.ts` auth scopes: `authenticated` (logged in, not OTP), `role` (USER also passes for ADMIN; PARTICIPANT is exact), `scope` (a ladder — `ACCOUNT_OWNER > FULL_ACCESS > SESSION_EXEC > READ_ONLY`, a login with a higher scope passes lower requirements), `catalyst`. `defaultStrategy: 'all'`; failure throws `GraphQLError('Unauthorized')`.
2. **Object-level permission — `withPermission(argsToCheck, PermissionLevel, resolver)`** (`packages/graphql/src/services/sharing.ts:withPermission`). Maps resolver args to a `PermissionCheck` (one of `courseId | liveQuizId | practiceQuizId | microLearningId | groupActivityId | elementId | answerCollectionId | catalogCollectionId`) and a required `PermissionLevel`. **On failure it returns `null` instead of throwing** — clients see a null field, not an error.
3. **Derived-permission lookup — `checkAccess`** (same file): resolves ownership and sharing grants (`DerivedPermission`) for the target object.

Reusable competence trees are not entries in the generic sharing tables. Their equivalent object-level policy is centralized in `packages/graphql/src/services/competenceTreeManagement.ts`: owner-only edits, linked-course read access, course `WRITE` for links, and element `READ` for assignments and duplication. A linked-course reader receives tree-owned assignment metadata needed for quiz setup, but not element content/options/solutions and not generic element access. Root resolvers remain one-line delegates, and all competence-tree mutations use `asUserFullAccess`.

Adaptive learning remains on the existing PracticeQuiz contract. `createPracticeQuiz` and `editPracticeQuiz` accept optional `mode` / `adaptiveConfig` arguments, so old clients remain standard by omission. `adaptivePracticeQuizPreview` uses `asUser` plus `withPermission(..., WRITE, ...)`; READ collaborators receive `null`. `adaptivePracticeQuizSetupPreview` validates an unsaved config against a writable, adaptive-enabled course and accessible tree, while `practiceQuizPublicationPreview` authorizes the quiz executor and returns a fresh readiness result plus named root nodes. Configuration writes additionally verify that the competence tree is linked to the selected course and that the caller has course `WRITE` access. Readiness issues expose stable codes and typed parameters so clients localize them without parsing server prose. Element mapping uses a narrow assignment mutation instead of replacing an entire tree snapshot. Archive/restore is owner-only; archived or referenced trees remain queryable where active history requires them.

The adaptive runtime exposes dedicated `asParticipant` start/resume/restart/submit/abandon mutations plus own-state and completed-result queries. Services derive participant identity from `ctx.user.sub`, require course participation, authorize every attempt/item transition server-side, and enforce first-completed versus latest-completed retake policy. Restart atomically abandons the active attempt and creates its replacement. The own-state query returns an active attempt first and otherwise the latest completed attempt, allowing the existing PracticeQuiz route to recover both resume and result screens. Participant question and result types are dedicated allow-listed Pothos objects rather than generic element JSON; schema contract tests prevent solution, item-parameter, theta, and standard-error fields from entering the client contract. Published adaptive quizzes appear in generic listings only for enrolled participants or permitted lecturers while their course rollout flag is enabled. Anonymous callers, unrelated participants, and lecturers without derived quiz permission cannot enumerate or directly bootstrap adaptive metadata. Lecturer cohort results require `ADMIN` permission on the practice quiz and return fixed-batch anonymous distributions plus privacy-suppressed pilot/item diagnostics; the root permission boundary has negative resolver tests. Future-dated adaptive publication remains unavailable until a durable outbox/reconciler exists. See [Adaptive Learning](./adaptive-learning.md) for routing, estimates, privacy, and publication-pool semantics.

The admin-only `setCourseAdaptiveLearningEnabled` mutation is persisted as `MSetCourseAdaptiveLearningEnabled`. The schema uses `asAdmin`, while the service rechecks the current database role, locks the course `FOR UPDATE`, audits changed values, and invalidates the course cache. Adaptive writes lock the same course row `FOR SHARE`, making disable a linearized kill switch. See [Adaptive Learning Operations](./adaptive-learning-operations.md).

Worked examples: `deleteCourse` in `mutation.ts` (asUser + ADMIN permission on courseId), `controlCourse` in `query.ts` (EXECUTE), `getLiveQuizSummary` (READ). Existing fields use `t.withAuth(...)` exclusively — follow them rather than inventing `authScopes` variants.

## Layering contract

- `schema/*.ts` — Pothos object types + root `query.ts`/`mutation.ts`/`subscription.ts`. Resolvers delegate immediately: `resolve: (_, args, ctx) => CourseService.deleteCourse(args, ctx)`.
- `services/*.ts` — all business logic, Prisma access, Redis, pubSub publishes. Import style: `import * as XService from '../services/x.js'`.
- Context (`packages/graphql/src/lib/context.ts`): `Context` has optional `user`; `t.withAuth` narrows to `ContextWithUser` (`user.sub`, `role`, `scope`, catalyst flags) — services take `ctx` and rely on that narrowing.

## Validation and errors

- Arg validation via the Pothos **Zod plugin** — pass `validate:` on args (email/regex/length examples in `mutation.ts`); issues are joined into a `GraphQLError` by the shaper in `builder.ts`.
- Service-level errors: prefer `GraphQLError` with `extensions.code` (e.g. `LIVE_QUIZ_PIN_INVALID`, `FORBIDDEN` in `services/liveQuizzes.ts`). Plain `throw new Error` exists in older code — don't add more.

## Client operations and codegen

Hand-written ops live in `packages/graphql/src/graphql/ops/*.graphql`, one per file, prefix = kind: `Q` query, `M` mutation, `S` subscription, `F` fragment (e.g. `QGetRunningLiveQuiz`, `MUpvoteFeedback`, `SFeedbackCreated`, `FActivityInfoData`).

The ritual after ANY change to ops or schema:

```bash
pnpm --filter @klicker-uzh/graphql generate
```

and **commit the regenerated outputs** (`src/ops.ts`, `src/ops.schema.json`, `src/public/schema.graphql`, `src/public/client.json`, `src/public/server.json`) in the same change. They are git-tracked and load-bearing: frontends import typed documents from `@klicker-uzh/graphql/dist/ops`, and outside dev/test the backend only executes hashes present in `server.json` (see [Architecture Overview](./architecture-overview.md)). Stale artifacts fail in two distinct ways: typecheck errors (missing document) or runtime persisted-query rejection (unknown hash).

## Subscriptions

Field filters over the shared pubSub: `schema/subscription.ts:feedbackCreated` pipes `ctx.pubSub.subscribe('feedbackCreated')` through a `liveQuizId` filter; the publishing side is a service (`services/feedbacks.ts`). Frontends consume via `subscribeToMore` with the generated `S*Document`.

## Worked feature traces

Read-only feature end-to-end: commit `ff61d9bc7` (#4951) — new object type, two query fields, service function, ops + committed codegen, manage page, i18n. Schema-change + mutation + heavy vitest variant: `38c92d035` (#4958). Step-by-step walkthrough: [Developing a Feature](./developing-a-feature.md).
