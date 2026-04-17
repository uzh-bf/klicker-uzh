# Unified Discussion Platform Plan (Course Q&A + Future Live Q&A Migration)

## 1. Objective

Build a generalized discussion platform whose shipped alpha surface is intentionally narrow: **Course Q&A** now, with broader learning-scoped and live-quiz scope reuse added later without redesign.

Core requirements:

- v1 user-facing alpha scope is limited to `COURSE` and evaluated-surface `PRACTICE_STACK`.
- backend/domain model may retain broader dormant capacity (`COURSE`, `LIVE_QUIZ`, and additional scope types) for later follow-up work.
- course view in alpha shows only course-space threads; linked live-quiz aggregation is explicitly deferred.
- broader scope activation must happen through a later follow-up workstream with its own validation matrix.
- legacy live feedback system remains active in v1 (no breaking change).

## Current Status (2026-04-13)

- Course Q&A alpha is implemented on branch `course-qa`.
- The hidden course-level rollout gate is now implemented in code via `Course.isCourseQARolloutEnabled`, alongside the existing runtime/settings booleans `isCourseQAEnabled` and `isCourseQAAnonymousEnabled`.
- No separate global runtime feature-flag layer was added for this phase.
- Current live dev verification baseline for `Testkurs` (`7c12e44e-d083-4acf-845e-4c34aaff6b49`) is:
  - `isCourseQARolloutEnabled = true`
  - `isCourseQAEnabled = true`
  - `isCourseQAAnonymousEnabled = true`
- Real-domain validation on `https://pwa.klicker.com` has verified:
  - direct `/qa` behavior for enabled and disabled states
  - enrolled read/write and upvote behavior
  - unauthorized denial on an enabled course
  - anonymous-vs-identified embed behavior
  - tampered-embed fail-closed behavior
  - course-page `Course Q&A` discoverability in the rollout-on/runtime-on state
- Lecturer-side verification remains externally blocked because `https://manage.klicker.com` is still misrouted to Jobeye, and even the localhost fallback redirects there after delegated login.
- Remaining major blockers are the lecturer-side routing issue, the unavailable DB-backed GraphQL integration-test environment, the still-pending stack-only alpha surface work, and the deferred live-feedback migration work.

## Approved Alpha Design State

Implemented in code now:

- Separate hidden course-level rollout gate boolean in the DB.
- `isCourseQAEnabled` and `isCourseQAAnonymousEnabled` remain the runtime/settings booleans after rollout is unlocked.
- No separate global feature-flag layer is introduced for this phase.
- Three-state rollout model:
  1. rollout gate `false`: no Q&A-related UI in Manage or PWA; direct routes fail closed
  2. rollout gate `true` + `isCourseQAEnabled = false`: lecturer/admin UI visible, students still cannot use Q&A
  3. rollout gate `true` + `isCourseQAEnabled = true`: full alpha behavior

Approved next alpha surface work (not yet implemented):

- `COURSE`: always visible and always writable for enrolled participants; course feed shows only `COURSE` threads
- `PRACTICE_STACK`: the only learning-scoped discussion surface for alpha; used for both practice and microlearning; shown only on evaluated/result surfaces; not visible during answering; reachable only from the evaluated stack surface; full history visible there; shown on every evaluated revisit
- not in alpha: `PRACTICE_ELEMENT`, `PRACTICE_QUIZ`, `LIVE_QUIZ` migration UI, or aggregating stack threads into the course feed
- Identity model remains unchanged for this phase:
  - normal PWA discussion is logged-in participants only
  - anonymous remains embed-only

### Deferred Post-Alpha Re-Expansion Targets

These remain part of the broader discussion-platform capacity, but they are not active alpha scope and must be reintroduced deliberately later:

- `PRACTICE_QUIZ` entry points
- `PRACTICE_ELEMENT` entry points
- linked `LIVE_QUIZ` aggregation into course-facing feeds or overview surfaces
- lecturer-facing live-feedback migration/discoverability UI for new discussion surfaces

Any reintroduction of these surfaces must be handled as explicit follow-up work after alpha validation, with updated product wording, GraphQL contract changes where needed, and dedicated verification coverage.

---

## 2. Product Decisions (Locked)

- Moderation in v1: **not included**.
- Anonymous posting: **embed-only**.
- Reactions: **thumbs-up only**, no downvote.
- Threading depth: **one level only** (thread -> replies).
- Realtime: **no subscriptions** in v1 (poll/refetch only).
- Gamification: **event hooks only** in v1 (no points/xp changes yet).
- Scope model: **structured + server-validated**.

---

## 3. Scope and Non-Goals

### In scope

- New generalized discussion backend domain.
- Course Q&A UI in PWA and Manage.
- Scope-filtered views and aggregated course overview.
- Embed mode with signed token model.
- Anonymous embed posting with strict server-side controls.
- Future migration hooks for live quiz compatibility.

### Out of scope (v1)

- Realtime pub/sub discussions.
- Reputation economy.
- Auto-moderation/AI abuse filtering (only preconditions and hook points).
- Replacing existing live feedback UI in v1.

---

## 4. Domain Model

### 4.1 Enums

Add:

- `DiscussionSpaceType`
  - `COURSE`
  - `LIVE_QUIZ`
- `DiscussionScopeType`
  - `COURSE`
  - `PRACTICE_QUIZ`
  - `PRACTICE_STACK`
  - `PRACTICE_ELEMENT`
  - `LIVE_QUIZ`
  - `LIVE_BLOCK`
  - `LIVE_INSTANCE`
  - `EXTERNAL_BLOCK`
- `DiscussionEventType`
  - `THREAD_CREATED`
  - `THREAD_DELETED`
  - `REPLY_CREATED`
  - `REPLY_DELETED`
  - `THREAD_UPVOTED`
  - `REPLY_UPVOTED`
  - `ANON_RATE_LIMITED`

### 4.2 New models

#### `DiscussionSpace`

- Root boundary for discussions.
- Fields:
  - `id Int @id @default(autoincrement())`
  - `spaceType DiscussionSpaceType`
  - `courseId String? @db.Uuid`
  - `liveQuizId String? @db.Uuid`
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
- Constraints:
  - unique one COURSE space per course
  - unique one LIVE_QUIZ space per quiz
  - exactly one identity field based on `spaceType` (DB check + service guard)
- Relations:
  - `course`, `liveQuiz`, `scopes`, `threads`, `events`

#### `DiscussionScope`

- Scoped context inside a space.
- Fields:
  - `id Int @id @default(autoincrement())`
  - `spaceId Int`
  - `scopeType DiscussionScopeType`
  - `scopeKey String`
  - `scopeLabel String`
  - optional ref columns for known contexts:
    - `practiceQuizId String? @db.Uuid`
    - `stackId Int?`
    - `instanceId Int?`
    - `liveBlockId Int?`
    - `externalSource String?`
    - `externalRef String?`
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
- Constraints:
  - unique `(spaceId, scopeKey)`

#### `DiscussionThread`

- Top-level post.
- Fields:
  - `id Int @id @default(autoincrement())`
  - `spaceId Int`
  - `scopeId Int`
  - `content String`
  - `isAnonymous Boolean @default(false)`
  - `authorParticipantId String? @db.Uuid`
  - `authorFingerprintHash String?`
  - `upvotes Int @default(0)`
  - `replyCount Int @default(0)`
  - `lastActivityAt DateTime @default(now())`
  - `isDeleted Boolean @default(false)`
  - `deletedAt DateTime?`
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
- Relations:
  - `space`, `scope`, `authorParticipant`, `replies`, `votes`

#### `DiscussionReply`

- One-level reply to a thread.
- Fields:
  - `id Int @id @default(autoincrement())`
  - `threadId Int`
  - `spaceId Int`
  - `content String`
  - `isAnonymous Boolean @default(false)`
  - `authorParticipantId String? @db.Uuid`
  - `authorFingerprintHash String?`
  - `upvotes Int @default(0)`
  - `isDeleted Boolean @default(false)`
  - `deletedAt DateTime?`
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
- Relations:
  - `thread`, `space`, `authorParticipant`, `votes`

#### `DiscussionThreadVote`

- Participant-only idempotent upvote state for thread.
- Fields:
  - `threadId Int`
  - `participantId String @db.Uuid`
  - `createdAt DateTime @default(now())`
- Constraints:
  - composite primary key / unique `(threadId, participantId)`

#### `DiscussionReplyVote`

- Participant-only idempotent upvote state for reply.
- Fields:
  - `replyId Int`
  - `participantId String @db.Uuid`
  - `createdAt DateTime @default(now())`
- Constraints:
  - composite primary key / unique `(replyId, participantId)`

#### `DiscussionEvent`

- Event hook table for analytics/gamification and future abuse workflows.
- Fields:
  - `id Int @id @default(autoincrement())`
  - `spaceId Int`
  - `scopeId Int?`
  - `threadId Int?`
  - `replyId Int?`
  - `participantId String? @db.Uuid`
  - `eventType DiscussionEventType`
  - `metadata Json?`
  - `createdAt DateTime @default(now())`

### 4.3 Existing model updates

Update:

- `Course`:
  - `isCourseQAEnabled Boolean @default(false)`
  - `isCourseQAAnonymousEnabled Boolean @default(false)`
  - relation to `DiscussionSpace` (course space)
- `LiveQuiz`:
  - relation to `DiscussionSpace` (live quiz space)
- `Participant`:
  - relations for authored threads/replies, votes, events

---

## 5. Scope Key Canonicalization

All keys are generated and validated server-side. The alpha ships with exactly
three canonical key shapes, enforced by `isSupportedCourseScopeKey` in
`packages/graphql/src/services/discussions.ts`.

### Course space keys (alpha)

- course-level: `course:{courseId}`
- stack: `stack:{stackId}` — activity-agnostic; the server resolves the stack
  across `course.stacks`, `practiceQuiz.stacks`, and `microLearning.stacks`,
  which is why a single scope type (`PRACTICE_STACK`) covers both practice
  quizzes and microlearnings.
- external block: `ext:{externalSource}:{externalRef}` — only reachable from a
  signed embed token; not creatable from the in-app PWA surface.

### Deferred post-alpha keys

Any finer-grained breakdown (per-quiz, per-element, per-instance) and the
live-quiz family (`lq:*`) remain deferred until a post-alpha re-expansion
workstream with its own plan and validation matrix.

---

## 6. GraphQL Contract (v1 course-focused)

### 6.1 Inputs/Types

Add types in a new `schema/discussions.ts`:

- `DiscussionSpaceType`, `DiscussionScopeType`, `DiscussionSort`
- `DiscussionSpaceInput`
  - `spaceType`
  - `courseId?`
  - `liveQuizId?`
- `DiscussionScopeInput`
  - `scopeType`
  - known ref fields
  - external source/ref
- output types:
  - `DiscussionScope`
  - `DiscussionScopeSummary`
  - `DiscussionThread`
  - `DiscussionReply`
  - `DiscussionThreadPage`
    - includes `canPostAnonymously`
    - includes `isAccessible`
  - `CourseDiscussionOverview`
  - `CourseDiscussionEmbeddingInfo`

### 6.2 Queries

Course-facing v1:

- `courseDiscussionScopes(courseId: String!): [DiscussionScopeSummary!]!`
- `courseDiscussionThreads(courseId: String!, scopeKey: String, sort: DiscussionSort, limit: Int, cursor: String, embedToken: String): DiscussionThreadPage!`
- `courseDiscussionOverview(courseId: String!, sort: DiscussionSort, limit: Int, cursor: String): CourseDiscussionOverview!`

Embed support:

- `getCourseDiscussionEmbeddingInfo(courseId: String!, scope: DiscussionScopeInput!, scopeLabel: String, allowAnonymous: Boolean, expiresInHours: Int): CourseDiscussionEmbeddingInfo!`

### 6.3 Mutations

- `createCourseDiscussionThread(input: CreateCourseDiscussionThreadInput!): DiscussionThread`
- `createCourseDiscussionReply(input: CreateCourseDiscussionReplyInput!): DiscussionReply`
- `toggleCourseDiscussionThreadUpvote(threadId: Int!, upvote: Boolean!): DiscussionThread`
- `toggleCourseDiscussionReplyUpvote(replyId: Int!, upvote: Boolean!): DiscussionReply`
- `deleteCourseDiscussionThread(threadId: Int!): Boolean!`
- `deleteCourseDiscussionReply(replyId: Int!): Boolean!`

Course settings extension:

- extend `updateCourseSettings` to accept:
  - `isCourseQAEnabled`
  - `isCourseQAAnonymousEnabled`

### 6.4 v1 compatibility note

- Existing live feedback queries/mutations/subscriptions remain unchanged.
- v1 does not introduce live-quiz public GraphQL entry points for new discussion model.
- v1 course-facing queries and overview remain course-only; linked live-quiz aggregation is deferred to a later follow-up contract and verification cycle.

---

## 7. Service Layer Design

Create `services/discussions.ts` (generalized core) and keep thin course-facing wrappers.

### 7.1 Core responsibilities

- resolve/create spaces
- resolve/create scopes
- enforce space access checks
- enforce embed token checks
- create thread/reply
- toggle vote idempotently
- write events
- build alpha-safe course overview aggregation

### 7.2 Space access checks

#### COURSE space

- participant role: must have `Participation(courseId, participantId)`
- lecturer/admin: existing `withPermission(... courseId ...)` checks

#### LIVE_QUIZ space (future)

- aligned with existing live quiz gating:
  - pin cookie
  - assessment checks
  - temporary participant handling

### 7.3 Anonymous embed writes

Allowed only if all pass:

1. valid embed token
2. token scope is `COURSE_DISCUSSION_EMBED`
3. token binds exact `spaceType + space identity + scopeKey`
4. token has `allowAnonymous = true`
5. target course has `isCourseQAAnonymousEnabled = true`

Otherwise reject.

---

## 8. Embed Token Design

Use JWT signing (`APP_SECRET`) and strict claim matching.

Claims:

- `scope: "COURSE_DISCUSSION_EMBED"`
- `spaceType`
- `courseId?`
- `liveQuizId?` (reserved)
- `scopeKey`
- `allowAnonymous`
- `version`
- `iat`, `exp`

Validation rules:

- expired token -> reject
- mismatched space identity -> reject
- mismatched scope key -> reject
- anonymous requested without allow flag -> reject

---

## 9. Rate Limiting and Abuse Preconditions

Use Redis counters (atomic increment + TTL). Anonymous only:

- per anonymous fingerprint + scope: `1` create / `90s`
- per anonymous fingerprint + course: max `6` writes / hour
- per IP + course: max `20` writes / hour

Authenticated participant:

- per participant + course: max `60` writes / hour

Data captured for future abuse systems:

- `authorFingerprintHash` for anonymous writes (salted hash from IP + user-agent)
- event logs in `DiscussionEvent`
- explicit `ANON_RATE_LIMITED` events

---

## 10. PWA UX (v1)

### New route

- `/course/[courseId]/qa`

### Behavior

- default view: course-wide `COURSE` discussion only
- course feed does not aggregate learning-scoped stack threads in alpha
- optional scope filter: only matching scope threads
- one-level reply UI
- thumbs-up buttons only
- polling/refetch interval (no subscriptions)

### Embed mode

- `?embed=1&embedToken=<...>`
- hides non-discussion chrome
- locks scope based on token
- shows anonymous composer only when allowed

### Learning-scoped integration (approved next alpha step)

- keep `COURSE` discussion visible from the normal course surface for enrolled participants when enabled
- add context entry points only for `PRACTICE_STACK`
- use the same `PRACTICE_STACK` model for both practice and microlearning
- show stack discussion only on evaluated/result surfaces for that stack
- do not show stack discussion during answering
- keep stack discussion reachable only from the evaluated stack surface in alpha
- when opened, show the full history for that stack
- show it again on every evaluated revisit of that stack
- do not add `PRACTICE_ELEMENT` or `PRACTICE_QUIZ` entry points in this phase

---

## 11. Manage UX (v1)

### Course page

- when rollout gate is `false`: show nothing related to Course Q&A in Manage
- when rollout gate is `true`: add a `Q&A` tab in course view
- once visible, show the alpha overview for the course space only
- linked live-quiz grouping/discoverability remains deferred until the later migration/re-expansion workstream

### Course settings

- rollout gate `false`: no Q&A settings shown
- rollout gate `true`: show switches:
  - `Enable Course Q&A`
  - `Allow Anonymous in Embeds`

### Embed tooling

- rollout gate `false`: no embed tooling shown
- rollout gate `true`: embed tooling available for:
  - course scope
  - external block scope
- learning-scoped stack discussion remains in-flow only for alpha and is not part of the initial lecturer-side embed/discoverability model

---

## 12. Course Overview Aggregation Rules

For `courseDiscussionOverview(courseId)`:

1. include all threads from course space.
2. do not include linked `LIVE_QUIZ` threads in alpha.
3. defer linked live aggregation until the post-alpha re-expansion workstream with an explicit contract update and dedicated validation matrix.
4. each item carries:
   - source group label (`Course` in alpha)
   - scope label
   - space metadata

---

## 13. Migration Strategy (Live Q&A to New Platform)

### Phase A: v1 ship (no behavior change in live)

- deploy generalized discussion backend + course UI
- keep legacy live feedback untouched

### Phase B: backfill

- one-off migration job:
  - map each live feedback to `LIVE_QUIZ` space + scope
  - map feedback responses to replies
  - preserve timestamps and author mapping where available

### Phase C: dual-write (feature-flagged)

- existing live feedback mutations also write to discussion tables
- read path remains legacy for safety

### Phase D: read switch

- live quiz read UI switches to discussion model
- legacy fallback behind flag during validation window

### Phase E: decommission

- remove old live feedback read/write paths
- clean subscriptions no longer needed

---

## 14. Backfill and Dual-Write Acceptance Details

Backfill must guarantee:

- stable order by original `createdAt`
- vote counts preserved
- reply threading preserved as one-level
- unresolved/metadata mapped consistently

Dual-write must guarantee:

- idempotency for retries
- no duplicate thread/reply on transient failures
- operational metrics for mismatch detection

---

## 15. Testing Plan

### 15.1 Unit/service tests

- space creation uniqueness constraints
- scope key generation and validation
- course access validation
- anonymous embed validation (valid/invalid/expired token)
- rate-limit enforcement
- one-level reply enforcement
- upvote toggle idempotency
- course overview aggregation includes linked live spaces only

### 15.2 Integration tests (GraphQL)

- create/list thread and reply
- scoped filtering behavior
- settings-gated anonymous behavior
- embed token mismatch rejection
- delete permissions

### 15.3 Migration tests

- backfill from sample legacy feedback dataset
- dual-write consistency checks
- linked live space aggregation visible on course overview
- standalone live quiz remains isolated

### 15.4 Cypress E2E

- lecturer enables course Q&A
- participants post and upvote
- stack-scoped evaluated context works
- embed anonymous flow works with limits
- manage overview remains course-only in alpha

---

## 16. Rollout and Enablement

Current branch reality:

- Course Q&A is now exercised through the approved course-level rollout model:
  - `Course.isCourseQARolloutEnabled`
  - `Course.isCourseQAEnabled`
  - `Course.isCourseQAAnonymousEnabled`
- The hidden rollout gate is already implemented in code and unlocks the lecturer-visible-but-student-disabled intermediate state.

Approved alpha rollout model:

1. Keep a separate hidden course-level rollout gate boolean in the DB.
2. Use a three-state rollout model:
   - rollout gate `false`: no Q&A UI in Manage or PWA; direct routes fail closed
   - rollout gate `true` + `isCourseQAEnabled = false`: lecturer/admin UI visible, students still cannot use Q&A
   - rollout gate `true` + `isCourseQAEnabled = true`: full alpha behavior
3. Keep `isCourseQAAnonymousEnabled` as the runtime embed-anonymity setting once rollout is unlocked.
4. Do not add a separate global feature-flag layer for this phase.

---

## 17. Risks and Mitigations

### Risk: anonymous abuse in embed contexts

- strict token-bound writes
- strict Redis throttling
- hashed fingerprint storage

### Risk: migration data mismatch

- backfill dry-run and reconciliation report
- dual-write audit counters and alarms

### Risk: performance degradation in overview aggregation

- index `(spaceId, scopeId, lastActivityAt)`
- cursor pagination
- group labels computed server-side once per page

---

## 18. Deliverables and Tracking

This document started as the implementation plan and now also tracks actual branch progress, verification status, and remaining follow-up work.

When implementation starts, expected first PR order:

1. Prisma schema + migration + generated client updates.
2. GraphQL schema/services + tests.
3. PWA course Q&A pages/components.
4. Manage course Q&A tab + settings + embed modal.
5. Migration tooling and live-feedback follow-up controls.

---

## Progress

### Implemented (Backend Foundation)

- Added Prisma discussion domain in `packages/prisma/src/prisma/schema/discussion.prisma`:
  - enums: `DiscussionSpaceType`, `DiscussionScopeType`, `DiscussionEventType`
  - models: `DiscussionSpace`, `DiscussionScope`, `DiscussionThread`, `DiscussionReply`, `DiscussionThreadVote`, `DiscussionReplyVote`, `DiscussionEvent`
- Extended core models for integration:
  - `Course`: `isCourseQAEnabled`, `isCourseQAAnonymousEnabled`, `discussionSpace`
  - `LiveQuiz`: `discussionSpace`
  - `Participant`: authored thread/reply, vote, and event relations
- Added SQL migration scaffold:
  - `packages/prisma/src/prisma/schema/migrations/20260205120000_discussion_platform_v1/migration.sql`
  - includes enums, tables, indexes, FKs, course setting columns, and a DB `CHECK` constraint to enforce valid `DiscussionSpace` identity mapping (`COURSE` vs `LIVE_QUIZ`).

### Implemented (GraphQL + Service Layer)

- Added generalized discussion service:
  - `packages/graphql/src/services/discussions.ts`
  - includes:
    - generalized space/scope resolution (`COURSE` + `LIVE_QUIZ` compatible)
    - server-side canonical scope-key generation + validation
    - course access checks for participant and lecturer/admin roles
    - embed JWT generation/verification with strict space/scope binding
    - anonymous embed-only write enforcement
    - Redis-based write throttling (anonymous + participant) and `ANON_RATE_LIMITED` event logging
    - thread/reply create, vote toggles, soft delete
    - course overview aggregation plus future-capable live-quiz handling that W2 must narrow to the approved alpha surface
- Added GraphQL schema types:
  - `packages/graphql/src/schema/discussions.ts`
  - enums, inputs, thread/reply/page/overview/embedding types
- Wired queries:
  - `courseDiscussionScopes`
  - `courseDiscussionThreads`
  - `courseDiscussionOverview`
  - `getCourseDiscussionEmbeddingInfo`
  - in `packages/graphql/src/schema/query.ts`
- Wired mutations:
  - `createCourseDiscussionThread`
  - `createCourseDiscussionReply`
  - `toggleCourseDiscussionThreadUpvote`
  - `toggleCourseDiscussionReplyUpvote`
  - `deleteCourseDiscussionThread`
  - `deleteCourseDiscussionReply`
  - in `packages/graphql/src/schema/mutation.ts`
- Extended course settings mutation/service to support:
  - `isCourseQAEnabled`
  - `isCourseQAAnonymousEnabled`
  - in `packages/graphql/src/schema/mutation.ts` and `packages/graphql/src/services/courses.ts`
- Exposed new course settings fields on GraphQL `Course` type (`packages/graphql/src/schema/course.ts`).

### Implemented (Initial Frontend Integration)

- Added new PWA route:
  - `apps/frontend-pwa/src/pages/course/[courseId]/qa.tsx`
  - includes:
    - thread listing with scope/source labels
    - one-level reply rendering
    - thread/reply creation (including embed-token forwarding and optional anonymous toggle in embed context)
    - thumbs-up toggles on threads/replies
    - scope filtering and polling-based refresh (no subscriptions)
    - embed layout mode (`embedded`) support
- Added entry points into course Q&A:
  - from course overview page (`apps/frontend-pwa/src/pages/course/[courseId]/index.tsx`)
  - from practice quiz page with preselected learning scope (`apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`), which W2 must narrow to the approved `PRACTICE_STACK` alpha surface
- Added initial Manage-side Q&A tab:
  - `apps/frontend-manage/src/components/courses/CourseDiscussionOverview.tsx`
  - wired into course tabs (`apps/frontend-manage/src/pages/courses/[id]/index.tsx`)
  - includes overview + embed-link generation UI, with overview scope still to be narrowed to course-only alpha behavior in W2
- Extended Manage course settings modal to control course Q&A settings:
  - `apps/frontend-manage/src/components/courses/modals/CourseManipulationModal.tsx`
  - wired update mutation variables in `apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx`

### Implemented (Stability + Test Coverage)

- Hardened backend service behavior in `packages/graphql/src/services/discussions.ts`:
  - fixed discussion lookups to avoid invalid `findUnique` filter patterns on soft-delete flags
  - added safer request header handling for anonymous fingerprint/rate-limiting paths when request headers are missing
- Improved PWA Q&A behavior in `apps/frontend-pwa/src/pages/course/[courseId]/qa.tsx`:
  - fixed thread query behavior so linked live-quiz scopes are still readable in filtered views
  - prevented new thread creation in unsupported live-space scopes (while still allowing replies on existing threads)
  - ensured scope labels sent to backend are clean scope labels (not UI-composed labels with source suffixes)
  - skipped unnecessary course-info query in embedded mode
- Improved Manage embed generation in `apps/frontend-manage/src/components/courses/CourseDiscussionOverview.tsx`:
  - embed link generation is now constrained to course-space scopes
  - added safe fallback to default course scope when no persisted course scope exists yet
- Added backend integration tests in `packages/graphql/test/discussions.test.ts` covering:
  - thread/reply creation flow
  - idempotent upvote toggling for threads and replies
  - anonymous embed token scope mismatch rejection
  - current course overview aggregation behavior, which W2 must narrow to course-only alpha coverage and later re-expand under explicit follow-up tests
- Added follow-up hardening in `packages/graphql/src/services/discussions.ts`:
  - explicit `THREAD_DELETED` and `REPLY_DELETED` event logging
  - `DiscussionThreadPage.canPostAnonymously` and `DiscussionThreadPage.isAccessible`
  - fail-closed handling for invalid/tampered embed scope requests
  - explicit inaccessible result for unauthorized non-embed viewers
  - embed generation now clamps anonymous capability to the course setting
  - embed thread creation validates token binding before persisting new scopes
- Hardened PWA discussion UX in `apps/frontend-pwa/src/pages/course/[courseId]/qa.tsx`:
  - explicit disabled-course notice
  - explicit access-denied notice for inaccessible views
  - anonymous controls only render when the embed is actually allowed to post anonymously
  - fixed reply pluralization
- Hardened Manage embed UX in `apps/frontend-manage/src/components/courses/CourseDiscussionOverview.tsx`:
  - removed render-time state mutation
  - disabled anonymous embed control when the course-level anonymous setting is off
  - aligned reply-count pluralization with i18n
- Extended seed/helper support in `packages/prisma-data/src/data/helpers.ts` and `packages/prisma-data/src/data/seedTEST.ts` so validation courses can explicitly set:
  - `isCourseQARolloutEnabled`
  - `isCourseQAEnabled`
  - `isCourseQAAnonymousEnabled`
- Enabled seeded `Testkurs` for validation:
  - seed now sets all three Course Q&A booleans to `true`
  - live dev DB row was updated during validation to avoid waiting for a reseed

### Implemented (W1 Hidden Rollout Gate + Visibility Model)

- Added `Course.isCourseQARolloutEnabled` to the Prisma schema in `packages/prisma/src/prisma/schema/course.prisma` plus migration `20260413120000_course_qa_rollout_gate`.
- Hardened discussion backend gating in `packages/graphql/src/services/discussions.ts` so discussion reads/writes/embed generation now fail closed unless both:
  - `isCourseQARolloutEnabled = true`
  - `isCourseQAEnabled = true`
- Exposed the rollout gate in GraphQL course surfaces:
  - `packages/graphql/src/schema/course.ts`
  - `packages/graphql/src/graphql/ops/QGetSingleCourse.graphql`
  - `packages/graphql/src/graphql/ops/QGetCourseOverviewData.graphql`
  - `packages/graphql/src/graphql/ops/QGetBasicCourseInformation.graphql`
  - `packages/graphql/src/graphql/ops/FPracticeQuizDataWithoutSolutions.graphql`
- Updated Manage visibility so Course Q&A tab/settings only appear when the rollout gate is enabled:
  - `apps/frontend-manage/src/pages/courses/[id]/index.tsx`
  - `apps/frontend-manage/src/components/courses/modals/CourseManipulationModal.tsx`
- Updated PWA visibility so Course Q&A discoverability is hidden when rollout is off and direct `/qa` access fails closed in that state:
  - `apps/frontend-pwa/src/pages/course/[courseId]/index.tsx`
  - `apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`
  - `apps/frontend-pwa/src/pages/course/[courseId]/qa.tsx`
- Added a backend regression test covering rollout-off fail-closed behavior in `packages/graphql/test/discussions.test.ts`.

### Environment/Verification Notes

- Green verification completed:
  - `pnpm --filter @klicker-uzh/prisma build`
  - `pnpm --filter @klicker-uzh/graphql check`
  - `pnpm --filter @klicker-uzh/frontend-pwa check`
  - `pnpm --filter @klicker-uzh/frontend-manage check`
  - `pnpm --filter @klicker-uzh/prisma-data exec tsx --eval ...prepareCourse(...)...` confirming the helper propagates both course-Q&A booleans into `create` and `update`
- Real-domain runtime validation completed on `https://pwa.klicker.com` with screenshots for:
  - enrolled user sees enabled Course Q&A
  - unauthorized user sees explicit denial on an enabled course
  - enrolled thread creation, reply creation, and upvote flow
  - anonymous-enabled embed vs identified-only embed behavior
  - tampered embed fail-closed access denial
  - course-page `Course Q&A` entry visible in the rollout-on/runtime-on state
- Lecturer-side runtime validation findings:
  - `http://localhost:3002` serves the correct Klicker lecturer auth page
  - after delegated login, the flow redirects to `https://manage.klicker.com/en`
  - that host still resolves to Jobeye, so lecturer-side verification is blocked even with the localhost fallback
- Still blocked:
  - DB-backed GraphQL integration tests time out because the local integration DB/test environment is unavailable
  - `https://manage.klicker.com` is misrouted to the unrelated Jobeye app, so lecturer-side validation on the requested real domain is still blocked
  - rollout-off and rollout-on/runtime-off runtime matrix evidence is still pending because the verification run was interrupted before the DB state-flip checks were executed
- Approved next-alpha surface decisions status:
  - W1 rollout gate is implemented and committed
  - W2 stack-only practice/microlearning surface is implementation-complete
    (activity-agnostic `stack:{stackId}` scope key, entry points on evaluated
    practice stacks and microlearning evaluation results, gated on the Q&A
    rollout + runtime flags); runtime verification on real domains still
    pending

### Document Links

- Primary plan: `project/DISCUSSIONS_PLAN.md`
- Verification runbook: `project/DISCUSSIONS_TESTING_PLAN.md`

### Remaining Major Work

- `W1` Hidden rollout gate state-matrix verification + lecturer-side unblock
- `W2` Stack-only alpha surface implementation + validation
- `W3` Remaining verification + DB-backed integration test unblock
- `W4` Live Feedback Migration Path
- `W5` Rollout + Operations
- `W6` Deferred Scope Re-Expansion (post-alpha)

---

## Next Work (Implementation Backlog)

### W1: Hidden Rollout Gate State-Matrix Verification + Lecturer-Side Unblock

- Complete runtime evidence for all three rollout states:
  - rollout off
  - rollout on + runtime off
  - rollout on + runtime on
- Verify both Manage and PWA visibility rules against that matrix.
- Unblock lecturer-side verification by fixing `manage.klicker.com` routing or establishing a stable lecturer-only fallback host that does not redirect into Jobeye after login.
- Exit criteria (pass/fail):
  - pass: rollout gate cleanly separates hidden, admin-configurable, and fully enabled states with screenshot evidence
  - fail: any Q&A UI remains visible when rollout gate is off, or lecturer-side verification cannot be completed due to host/routing issues

### W2: Stack-Only Alpha Surface Implementation + Validation

- Keep the course feed as `COURSE` only.
- Add learning-scoped entry points only for `PRACTICE_STACK`.
- Reuse `PRACTICE_STACK` for both practice and microlearning.
- Show stack discussion only on evaluated/result surfaces, not during answering.
- Keep stack discussion reachable only from the evaluated stack surface in alpha.
- Validate the resulting UX and access model on real domains once implemented.
- Exit criteria (pass/fail):
  - pass: stack discussion appears only in the approved post-evaluation contexts and course feed remains course-only
  - fail: stack threads leak into the course feed or discussion is visible during answering

### W3: Remaining Verification + DB-Backed Integration Test Unblock

- Complete the still-open scenario coverage from `DISCUSSIONS_TESTING_PLAN.md` after W2 is in place.
- Re-run DB-backed discussion integration tests once the local test DB is available.
- Corroborate UI evidence with backend/data checks where the testing plan requires it.
- Exit criteria (pass/fail):
  - pass: remaining scenario coverage has evidence and the DB-backed test environment is green
  - fail: required scenarios remain unexecuted, or the DB-backed integration environment stays unavailable

### W4: Live Feedback Migration Path

- Implement backfill job from legacy live feedback to `DiscussionSpaceType.LIVE_QUIZ`.
- Implement dual-write in legacy feedback service:
  - `packages/graphql/src/services/feedbacks.ts`
- Add reconciliation metrics and mismatch reporting for:
  - counts
  - ordering
  - vote totals
  - reply linkage
  - author linkage where available
- Exit criteria (pass/fail):
  - pass: dry-run is repeatable and reconciliation output is deterministic
  - fail: non-deterministic mapping or unresolved mismatch classes remain

### W5: Rollout + Operations

- Keep rollout explicitly alpha and course-selective through the course booleans.
- Add monitoring and alert checks:
  - discussion write/read errors
  - unexpected denial/error rates
  - anonymous rate-limit spikes
- Add rollback instructions per rollout phase.
- Exit criteria (pass/fail):
  - pass: operational playbook approved and rollback rehearsed
  - fail: rollout cannot be safely operated or reverted

### W6: Deferred Scope Re-Expansion (Post-Alpha)

- Reintroduce deferred scope entry points only after `W1` to `W5` alpha work is validated.
- Evaluate and, if approved, add back:
  - `PRACTICE_QUIZ` entry points
  - `PRACTICE_ELEMENT` entry points
  - linked `LIVE_QUIZ` aggregation into course-facing feed/overview surfaces
  - lecturer-facing migration/discoverability UI for new live discussion surfaces
- Update GraphQL/service contracts explicitly rather than reusing alpha-only behavior by default.
- Extend the testing plan with a dedicated follow-up validation matrix for any reintroduced scope.
- Exit criteria (pass/fail):
  - pass: every reintroduced surface has explicit product wording, implementation scope, and dedicated verification coverage
  - fail: deferred scopes leak back into the product without an explicit follow-up contract and test matrix

### Coverage and Scope

- Workstream acceptance checks included in this backlog: `W1` to `W6`.
- UI/browser verification scope is tracked in:
  - `project/DISCUSSIONS_TESTING_PLAN.md`
  - scenarios `QA-001` to `QA-012`
- Backend corroboration scope includes:
  - data integrity checks
  - access and token guardrail checks
  - anonymous rate-limit enforcement checks
- Any post-alpha reintroduction of deferred scopes requires a dedicated follow-up validation matrix beyond `QA-001` to `QA-012`.

### Assumptions and Defaults

- Documentation reflects current branch state at update time.
- The browser runbook has been partially executed already; see `DISCUSSIONS_TESTING_PLAN.md` for current scenario status.
- `agent-browser` is the primary browser verification tool and screenshot evidence is mandatory.
- If the environment is not ready (Node/dependencies/services), execution is deferred but the plan remains valid.
