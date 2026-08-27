---
type: API Layer
title: GraphQL API Layer
description: Pothos code-first schema, the three-layer authorization pattern, service contract, operation naming, and the codegen ritual.
timestamp: '2026-08-27'
tags:
  - backend
  - graphql
---

# GraphQL API Layer

> **Migration in flight (2026-07):** a dual GraphQL→tRPC migration is open as PR #5132 (not yet merged) — a tRPC API in `packages/api` mounted at `/api/trpc` beside `/api/graphql`, with frontends moving to React Query app by app. This page describes current reality and stays authoritative until that PR merges; before extending the API surface, check the PR's status and which surface your target app uses. Staged doc/skill changes: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

**The pattern to copy exactly: resolvers are one-liners; authorization is three explicit, named layers.** Protected single-object fields in `packages/graphql/src/schema/` compose the same three pieces — declare the role with `t.withAuth(...)`, check object-level permission with `withPermission(...)`, and let the service do the work. Multi-object batch fields are the explicit exception described below. Deviating from these shapes (inline logic in resolvers, unbounded service checks) is the number-one review flag.

## Three-layer authorization

1. **Role/scope gate — `t.withAuth(scopeObject)`.** Scope objects are defined once near the top of `packages/graphql/src/schema/mutation.ts` (and mirrored in `query.ts`): `asUser`, `asUserFullAccess`, `asUserSessionExec`, `asUserOwner`, `asParticipant`, `asTemporaryParticipant`, `asAdmin`. Their semantics come from `packages/graphql/src/builder.ts` auth scopes: `authenticated` (logged in, not OTP), `role` (USER also passes for ADMIN; PARTICIPANT is exact), `scope` (a ladder — `ACCOUNT_OWNER > FULL_ACCESS > SESSION_EXEC > READ_ONLY`, a login with a higher scope passes lower requirements), `catalyst`. `defaultStrategy: 'all'`; failure throws `GraphQLError('Unauthorized')`. The former `asUserWithCatalyst` shorthand was removed when the three activity formats became standard (ADR 0037); gate such fields with `asUserFullAccess` and keep the `catalyst` scope for surfaces that genuinely require the paid tier.
2. **Object-level permission — `withPermission(argsToCheck, PermissionLevel, resolver)`** (`packages/graphql/src/services/sharing.ts:withPermission`). Maps resolver args to a `PermissionCheck` (one of `courseId | liveQuizId | practiceQuizId | microLearningId | groupActivityId | elementId | answerCollectionId | catalogCollectionId`) and a required `PermissionLevel`. **On failure it returns `null` instead of throwing** — clients see a null field, not an error. A multi-object batch field cannot use this single-selector wrapper: gate the field with `t.withAuth(...)`, then perform a bounded service query and an explicit permission check for every unique object before mutation. Return per-object outcomes instead of collapsing the batch to one nullable field.
3. **Derived-permission lookup — `checkAccess`** (same file): resolves ownership and sharing grants (`DerivedPermission`) for the target object.

Worked examples: `deleteCourse` in `mutation.ts` (asUser + ADMIN permission on
courseId, plus a nullable boolean that preserves the existing behavior when
omitted), `controlCourse` in `query.ts` (EXECUTE), `getLiveQuizSummary` (READ).
Existing fields use `t.withAuth(...)` exclusively — follow them rather than
inventing `authScopes` variants.

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

The package build runs this generation before Rollup. Commit the handwritten operation/schema sources and the generated `src/public/schema.graphql` SDL snapshot; do not commit `src/ops.ts` or `src/public/{client,server}.json`, which are ignored build outputs. Frontends import typed documents from `@klicker-uzh/graphql/dist/ops`, and outside dev/test the backend only executes hashes present in `server.json` (see [Architecture Overview](./architecture-overview.md)). A missing generation step fails in two distinct ways: typecheck errors for missing documents or runtime persisted-query rejection for an unknown hash.

### Participant data-use API

`selfDataUse` is the only GraphQL read for participant research and
learning-analytics choices. It requires an authenticated `PARTICIPANT` login
and returns exactly the six current-state `Participant` fields: the two
Boolean choices, their choice timestamps, and disclosure versions. The generic
`Participant` object does not expose any of these fields, so public profiles and
lecturer-facing queries cannot reveal them.

`setResearchConsent` and `setLearningAnalyticsConsent` are separate participant
mutations. Each accepts only a Boolean `consent`; the server records disclosure
version `v1`. The mutations retain current state only. Same-value requests with
recorded `v1` metadata are no-ops; otherwise the server records the new choice
timestamp and disclosure version. Learning-analytics changes use PostgreSQL
`clock_timestamp()` and the global advisory gate after a bounded `SET LOCAL
lock_timeout`; research changes do not take that gate.

Existing individual analytics reads apply the learning-analytics predicate in
their source queries. A participant result is returned only when the current
choice is true, all choice metadata is present, and the course's
`analyticsLastComputedAt` is strictly newer than
`Participant.learningAnalyticsChoiceAt`. `learningAnalyticsChoiceAt` is a
revision/race/freshness watermark for this read gate, not a cutoff on activity
history. Withdrawal excludes individual rows immediately; a newly recorded
choice remains hidden until a successful recomputation makes the course marker
strictly later than that choice. Aggregate and canonical outputs are
unaffected. Aggregate outputs follow their normal recomputation schedule and
are not recomputed immediately when the choice changes. The read paths use a
repeatable database snapshot while resolving eligible participant IDs, so
withdrawn or not-yet-recomputed individual rows never reach the response for
that snapshot. They also require a current `Participation` row for the same
course and participant; leaderboard opt-out does not remove learning-analytics
data. Archived courses expose no individual rows while their aggregate outputs
remain available.

### Learning analytics coordinator API

`Course.analyticsStatus` exposes the public state needed by a caller:
`areAnalyticsValid`, `analyticsLastComputedAt`, `analyticsFinalizedAt`, and
`chatAnalyticsValidAt` (`packages/graphql/src/schema/course.ts:CourseAnalyticsStatus`).
`Course.isLearningAnalyticsEnabled` exposes the course product control.
`setCourseLearningAnalyticsEnabled` requires a full-access lecturer with
`ADMIN` permission on the course. A state change takes the shared global and
exclusive course advisory locks, records a database-time invalidation marker,
and invalidates every published analytics marker without deleting or computing
analytics in the GraphQL request. An idempotent request returns the course
without invalidation.

`recomputeCourseAnalytics` accepts `INCREMENTAL`, `FINALIZE`, or `FULL` and
requires a full-access user with `ADMIN` permission on the course. The global
`recomputeLearningAnalyticsBatch` mutation accepts an explicit course-ID list
and requires the `ADMIN` role (`packages/graphql/src/schema/mutation.ts`). Both
operations enqueue the public Hatchet coordinator. The public coordinator
dispatches Hatchet workflows and owns scheduling, selection, bounded fan-out,
locking, and product-state transitions; the private analytics engine owns the
business computation. No analytics computation runs in the GraphQL request.

All course-level analytics reads require both
`isLearningAnalyticsEnabled` and `areAnalyticsValid`. The individual activity
read also applies the same conditions through its owning course. A public run
invalidates an enabled course before private computation, so a failed or
cancelled run cannot expose a partial result. Start captures a transient
database-time fence after the public locks are held; completion under those locks
publishes no marker if a current member's choice time is at or after the fence.
That fence is public control metadata and is never sent through the private `v1`
engine contract. Individual participant rows add
the current consent and metadata checks; aggregate rows remain governed by the
course-level status and normal recomputation schedule. The nightly selector
keyset-pages candidate course IDs before checking the current page's
memberships. It forces full mode when a membership choice is at or after the
course marker (equality is fail-safe), or when the marker is missing, for either
a `true` or `false` transition, and prioritizes those dirty-choice courses ahead
of ordinary recomputation. The relevant gates are in
`packages/graphql/src/services/analytics.ts` (`getCourseActivityAnalytics`,
`getCourseWeeklyActivity`, `getCoursePerformanceAnalytics`, and
`getActivityAnalytics`).

The LA-P3 lecturer surface uses the additive
`getCourseActivityAnalyticsV2`, `getCoursePerformanceAnalyticsV2`, and
`getCourseLearningAnalyticsExportV2` fields. It does not request the legacy V1
fields. The V1 schema definitions and operations remain byte-identical and
dormant so existing consumers keep their contract.

The V2 disclosure builder applies a minimum cell size of five after participant
eligibility filtering. It never returns counts from one through four. Weekly
periods and activities receive ordinal indices only after suppressed cells have
been removed. Percentages are rounded to ten-point steps. Each student report
freshly randomizes report-local `Student N` labels, so a label is not stable
between views or exports. The backend builds the JSON and CSV exports from the
same fixed whitelist: schema version, effective participant count, student
label, completed activity count, and mean completion percentage. V2 never
returns identifiers, email addresses, free text, exact timestamps, stable
activity IDs, item sequences, or rare attributes. It has no quiz-level,
item-level, daily, weekday, activity-detail, or course-comparison disclosure.
These controls make the output de-identified, not guaranteed anonymous
(`packages/graphql/src/lib/learningAnalyticsOutputV2.ts`).

Coordinator dispatch remains default-off. The service only prepares or enqueues
work when `LEARNING_ANALYTICS_COORDINATOR_ENABLED` is exactly `true`, and batch
preparation requires the explicitly configured
`LEARNING_ANALYTICS_BATCH_IN_FLIGHT_LIMIT` value. Public batches remain globally
serialized while their bounded parallel lanes process independent courses, and
same-course workflows remain serialized; see [Async & Workers](./async-and-workers.md)
for the UTC schedule, lane limit, and deadline behavior.

### Assessment invitation API

The lecturer invitation surface is intentionally course-scoped: `assessmentParticipantInvitations`, `createAssessmentParticipantInvitations`, and `deletePendingAssessmentParticipantInvitation` all combine the USER role with course `ADMIN` permission; mutations additionally require `FULL_ACCESS` login scope (`packages/graphql/src/schema/query.ts:assessmentParticipantInvitations`, `packages/graphql/src/schema/mutation.ts:createAssessmentParticipantInvitations`). The service rejects non-assessment courses and scopes deletion by both invitation id and course id. Bulk creation returns per-row statuses plus aggregate counts so one malformed email does not discard valid rows, while unexpected database failures propagate as GraphQL errors (`packages/graphql/src/schema/participantInvitation.ts:CreateAssessmentParticipantInvitationsPayload`). Auto-acceptance requires exactly one active participant behind verified eligible accounts, preserves `Participation.isActive`, and accepted invitation metadata is immutable.

Manage reads invitation history through the single paginated field with finite `numEntries` and `offset` arguments; its payload type is `AssessmentParticipantInvitationPage`, matching the report-records precedent. The service clamps page sizes to 50 and orders by `invitedAt DESC, id DESC`, returning both the page and `totalCount`. Assessment invitation imports are limited to 200 rows at the GraphQL service boundary.

## Element batch sharing

`shareElementsBatch` grants one `PermissionLevel` to one lecturer or one user
group for multiple Elements. The mutation uses `asUserFullAccess`; the service
then rechecks every non-deleted Element and shares only those on which the
caller has `ADMIN` or `OWNER`. Exactly one of `shortnameOrEmail` and
`userGroupId` must be supplied. Sharing does not propagate access to activities;
linked answer collections receive the derived READ access required by the
permission model. Before resolving a target, the caller must control at least
one supplied non-deleted Element; otherwise the service returns uniform
unavailable outcomes without revealing target or element existence.

The service resolves the target once, deduplicates Element IDs in first-seen
order, and returns one outcome per unique ID. Missing/deleted Elements and
insufficient permissions are `SKIPPED`; unexpected transaction errors are
reported as the generic `FAILED / SHARING_FAILED`. Invalid/self users and
unavailable groups are target-level errors and produce no per-Element writes.

Each eligible Element uses its own sequential serializable transaction. The
transaction rechecks the current non-deleted state and caller `ADMIN`/`OWNER`
permission immediately before the upsert, with bounded conflict retries. A
successful transaction upserts a non-propagating direct permission, removes
matching user access requests, recomputes derived permissions, and records a
`PERMISSION_GRANTED` audit entry. Element processing has a bounded deadline
after target resolution. Permission invalidation happens after commit; an
invalidation-listener error is logged but does not turn an already committed
grant into a failed outcome. This boundary permits partial success without
exposing database errors to clients.

The management UI coordinates this mutation with `applyElementBatchOperations`.
Those are separate GraphQL mutations and are therefore non-atomic: one may
succeed or partially succeed even if the other fails. The UI must preserve and
present both result sets; there is no transaction spanning the batch edit and
batch sharing calls.

Rolling deployments also require keeping the persisted hashes used by the
previous frontend. When an existing operation needs new fields or variables,
add a newly named operation for the updated client and leave the original
operation document unchanged. Removing its old hash from `server.json` breaks
already-open clients because arbitrary GraphQL operations are disabled outside
development and test.
The `userElements` and `userActivities` list fields accept optional
`numEntries` and `offset` arguments. Finite page sizes pass both values;
omitting both returns the current filtered result without a pagination limit.
This unbounded behavior is intentional for the manage-list `All` option and
does not change endpoint-specific caps such as verification records. The
Elements operation, schema field, service signature, and generated artifacts
must change together (`packages/graphql/src/schema/query.ts:Query.userElements`,
`packages/graphql/src/services/elements.ts:getUserElements`).

## Subscriptions

Field filters over the shared pubSub: `schema/subscription.ts:feedbackCreated` pipes `ctx.pubSub.subscribe('feedbackCreated')` through a `liveQuizId` filter; the publishing side is a service (`services/feedbacks.ts`). Frontends consume via `subscribeToMore` with the generated `S*Document`.

## Worked feature traces

Read-only feature end-to-end: commit `ff61d9bc7` (#4951) — new object type, two query fields, service function, ops + codegen, manage page, i18n. Schema-change + mutation + heavy vitest variant: `38c92d035` (#4958). Step-by-step walkthrough: [Developing a Feature](./developing-a-feature.md).
