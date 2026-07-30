---
type: API Layer
title: GraphQL API Layer
description: Pothos code-first schema, the three-layer authorization pattern, service contract, operation naming, and the codegen ritual.
timestamp: '2026-07-07'
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

Learning analytics adds a second boundary after normal object authorization:
`setCourseLearningAnalyticsEnabled` requires course `ADMIN`, while all four
lecturer analytics services check `Course.isLearningAnalyticsEnabled` before
reading derived analytics or operational response/feedback data
(`packages/graphql/src/schema/mutation.ts:setCourseLearningAnalyticsEnabled`;
`packages/graphql/src/lib/learningAnalytics.ts:isLearningAnalyticsRolloutEnabled`).
Keep this service-level gate when adding a new analytics query so another API
surface cannot bypass it.

Participant choice uses a separate self-only API surface:
`getOwnLearningAnalyticsChoice` and `setOwnLearningAnalyticsChoice` both require
the exact `PARTICIPANT` role and derive the participant ID from the authenticated
context. They return a dedicated object containing only course ID, status, and
whether the disclosure is current; LA choice fields are not exposed on the
general `Participation` GraphQL type. The service query returns `null` while the
rollout or course control is disabled, and the mutation serializes choice
changes with the course toggle before updating the snapshot/history and applying
participant-level deletion
(`packages/graphql/src/services/participants.ts:getOwnLearningAnalyticsChoice`;
`packages/graphql/src/services/participants.ts:setOwnLearningAnalyticsChoice`).

Analytics queries that aggregate operational detail rows apply the same current
status, disclosure-version, and prospective inclusion-time boundary before
counting responses or feedback. They select response metadata only, never the
response body, and omit free-text elements from LA entirely. Reads of
participant-level derived rows also require a currently eligible participation;
activity aggregates expose their persisted effective participant count
(`packages/graphql/src/services/analytics.ts:filterEligibleLearningAnalyticsActivity`;
`packages/graphql/src/services/analytics.ts:getActivityAnalytics`).

Lecturer output applies one shared privacy policy after eligibility and coverage
filters. Any course view, metric, filtered breakdown, or row table with fewer
than five contributing participants is suppressed; low counts are returned as
`null`, not exposed to explain why a view is hidden. The remaining row table
contains only a fresh report-local `Student N` label, complete/partial coverage,
completed-activity count, and completion rounded to ten-percentage-point steps.
It has no stable participant identifier, activity identifier, score, response
content, or free text. The dedicated `getLearningAnalyticsExport` query reuses
that service policy, defaults to complete coverage, re-applies the threshold
after coverage filtering, and assigns fresh labels for the CSV
(`packages/graphql/src/lib/learningAnalyticsOutput.ts`;
`packages/graphql/src/services/analytics.ts:getLearningAnalyticsExport`).
Legacy breakdowns without a report-local effective N are not part of this
boundary; the weekday activity distribution was removed instead of exposing a
course-level aggregate as though its N applied to every point.

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
