---
type: API Layer
title: GraphQL API Layer
description: Pothos code-first schema, the three-layer authorization pattern, service contract, operation naming, and the codegen ritual.
timestamp: '2026-08-04'
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

## Resetting an ended Live Quiz

For regular quizzes, `getLiveQuizResetSummary` and `resetLiveQuiz` require full lecturer access and activity `ADMIN` authorization (`packages/graphql/src/schema/query.ts:getLiveQuizResetSummary`, `packages/graphql/src/schema/mutation.ts:resetLiveQuiz`). That admits the activity owner and users with a derived activity `ADMIN` or `OWNER` permission; `READ`, `EXECUTE`, and `WRITE` grants are insufficient. The regular reset mutation accepts only ended, non-deleted, non-assessment quizzes. Assessment reset remains a separate operation through `resetAssessmentLiveQuiz` and keeps its course-owner/course-admin policy.

The informational summary reports four counts: responses, feedback, confusion feedback, and quiz-scoped leaderboard entries (persistent `SESSION` plus temporary entries). It also returns `eligible` and one reason: `ELIGIBLE`, `INVALID_STATE`, or `ASSESSMENT_POLICY` (`packages/graphql/src/services/liveQuizResetSummary.ts:getLiveQuizResetSummary`). An authorization miss on this nullable query returns `null`.

The mutation locks the quiz row and reloads authorization and lifecycle state inside the reset transaction (`packages/graphql/src/services/liveQuizResetTransaction.ts:executeLiveQuizReset`). It returns `SUCCESS` with the reusable draft activity or `INVALID_STATE` with no activity; outer mutation authorization failures use the standard GraphQL error path. `packages/graphql/src/services/liveQuizReset.ts:resetLiveQuiz` owns privacy-safe audit delivery and post-commit cache cleanup. Audit events carry the actor, activity, operation identifier, and outcome, but no participant-level or reward data.

Live Quiz creation/editing, course listing, and reset results all format the GraphQL `ActivityInfo` payload through `packages/graphql/src/services/liveQuizActivityInfo.ts:formatLiveQuizActivityInfo`. Callers supply their course-visibility and reviewer context so permission flags, sharing counts, and common activity fields cannot drift.

## Subscriptions

Field filters over the shared pubSub: `schema/subscription.ts:feedbackCreated` pipes `ctx.pubSub.subscribe('feedbackCreated')` through a `liveQuizId` filter; the publishing side is a service (`services/feedbacks.ts`). Frontends consume via `subscribeToMore` with the generated `S*Document`.

## Worked feature traces

Read-only feature end-to-end: commit `ff61d9bc7` (#4951) — new object type, two query fields, service function, ops + committed codegen, manage page, i18n. Schema-change + mutation + heavy vitest variant: `38c92d035` (#4958). Step-by-step walkthrough: [Developing a Feature](./developing-a-feature.md).
