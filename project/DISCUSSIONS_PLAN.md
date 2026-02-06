# Unified Discussion Platform Plan (Course Q&A + Future Live Q&A Migration)

## 1. Objective

Build a generalized discussion platform that ships first as **Course Q&A** and is explicitly designed to absorb existing **Live Quiz Q&A** later without redesign.

Core requirements:

- v1 user-facing scope is course-focused.
- backend model supports both `COURSE` and `LIVE_QUIZ` spaces from day one.
- course view can aggregate:
  - threads created in course space
  - threads created in linked live-quiz spaces (`liveQuiz.courseId == courseId`)
- live quizzes without a course remain supported via standalone `LIVE_QUIZ` spaces.
- legacy live feedback system remains active in v1 (no breaking change).

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
  - `REPLY_CREATED`
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

All keys are generated server-side and immutable.

### Course space keys

- course-level: `course:{courseId}`
- practice quiz: `pq:{practiceQuizId}`
- practice stack: `pq:{practiceQuizId}:stack:{stackId}`
- practice instance: `pq:{practiceQuizId}:stack:{stackId}:instance:{instanceId}`
- external block: `ext:{externalSource}:{externalRef}`

### Live-quiz space keys (future migration)

- quiz-level: `lq:{liveQuizId}`
- block-level: `lq:{liveQuizId}:block:{blockId}`
- instance-level: `lq:{liveQuizId}:block:{blockId}:instance:{instanceId}`

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
  - `CourseDiscussionOverview`
  - `CourseDiscussionEmbeddingInfo`

### 6.2 Queries

Course-facing v1:

- `courseDiscussionScopes(courseId: String!): [DiscussionScopeSummary!]!`
- `courseDiscussionThreads(courseId: String!, scopeKey: String, sort: DiscussionSort, limit: Int, cursor: String, includeLinkedLiveQuizSpaces: Boolean = true, embedToken: String): DiscussionThreadPage!`
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
- build course overview aggregation

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

- default view: course-wide aggregated overview
- optional scope filter: only matching scope threads
- one-level reply UI
- thumbs-up buttons only
- polling/refetch interval (no subscriptions)

### Embed mode

- `?embed=1&embedToken=<...>`
- hides non-discussion chrome
- locks scope based on token
- shows anonymous composer only when allowed

### Practice quiz integration

- add context entry points for:
  - quiz-level scope
  - stack-level scope
  - element-level scope
- context page only shows scoped threads

---

## 11. Manage UX (v1)

### Course page

- add a new `Q&A` tab in course view
- show grouped overview by source:
  - `Course`
  - `Live Quiz: <name>` (linked live quiz spaces, when data exists)

### Course settings

- switches:
  - `Enable Course Q&A`
  - `Allow Anonymous in Embeds`

### Embed tooling

- new embedding modal for course discussion links
- supports generating links for:
  - course scope
  - practice scopes
  - external block scope

---

## 12. Course Overview Aggregation Rules

For `courseDiscussionOverview(courseId)`:

1. include all threads from course space.
2. include all threads from live-quiz spaces where `liveQuiz.courseId == courseId`.
3. exclude all standalone live-quiz spaces (`courseId IS NULL`).
4. each item carries:
   - source group label (`Course` or `Live Quiz: {displayName}`)
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
- practice quiz scoped context works
- embed anonymous flow works with limits
- manage overview grouping by source labels

---

## 16. Rollout and Flags

Use feature flags:

- `discussion_platform_enabled`
- `discussion_course_ui_enabled`
- `discussion_live_dual_write_enabled`
- `discussion_live_read_enabled`

Rollout order:

1. backend models + APIs behind flags
2. course UI internal testing
3. staged rollout to selected courses
4. migration rehearsal in staging
5. live dual-write opt-in

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

## 18. Deliverables (Planning Artifact Only)

This document defines implementation-ready work but does **not** execute code changes.

When implementation starts, expected first PR order:

1. Prisma schema + migration + generated client updates.
2. GraphQL schema/services + tests.
3. PWA course Q&A pages/components.
4. Manage course Q&A tab + settings + embed modal.
5. Migration tooling and dual-write flags (behind disabled defaults).

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
    - course overview aggregation with source labels (`Course`, `Live Quiz: <name>`)
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
  - from practice quiz page with preselected practice-quiz scope (`apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`)
- Added initial Manage-side Q&A tab:
  - `apps/frontend-manage/src/components/courses/CourseDiscussionOverview.tsx`
  - wired into course tabs (`apps/frontend-manage/src/pages/courses/[id]/index.tsx`)
  - includes grouped discussion overview + embed-link generation UI
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
  - course overview aggregation (includes linked live-quiz spaces, excludes standalone live-quiz spaces)

### Environment/Verification Notes

- Automated validation is currently blocked in this worktree because dependencies are not installed:
  - `pnpm --filter @klicker-uzh/prisma generate` fails (`prisma: command not found`)
  - `pnpm --filter @klicker-uzh/graphql check` fails (`tsc: command not found`)
  - `pnpm --filter frontend-pwa check` fails (`tsc: command not found`)
- Runtime environment warning:
  - current local Node version is `v25.4.0`, while repo engines require Node `=20`
- This means Prisma client regeneration and TypeScript compile checks still need to be executed once `node_modules` are available.

### Document Links

- Primary plan: `/Users/roland/.codex/worktrees/f125/klicker-uzh/project/DISCUSSIONS_PLAN.md`
- Verification runbook: `/Users/roland/.codex/worktrees/f125/klicker-uzh/project/DISCUSSIONS_TESTING_PLAN.md`

### Remaining Major Work

- `W1` Environment + Validation Unblock
- `W2` Feature Flag Wiring
- `W3` Live Feedback Migration Path
- `W4` End-to-End Verification
- `W5` Rollout + Operations

---

## Next Work (Implementation Backlog)

### W1: Environment + Validation Unblock

- Enforce local runtime alignment with repo requirement: Node `=20`.
- Install dependencies in the worktree.
- Run and record:
  - `pnpm --filter @klicker-uzh/prisma generate`
  - `pnpm --filter @klicker-uzh/graphql check`
  - `pnpm --filter frontend-pwa check`
  - `pnpm --filter @klicker-uzh/graphql test -- discussions.test.ts` (or repository-equivalent targeted test command)
- Exit criteria (pass/fail):
  - pass: all checks are green
  - fail: any check fails and is captured in an explicit issue list with owner and next action

### W2: Feature Flag Wiring

- Wire and enforce the following flags:
  - `discussion_platform_enabled`
  - `discussion_course_ui_enabled`
  - `discussion_live_dual_write_enabled`
  - `discussion_live_read_enabled`
- Backend gating points:
  - `/Users/roland/.codex/worktrees/f125/klicker-uzh/packages/graphql/src/schema/query.ts`
  - `/Users/roland/.codex/worktrees/f125/klicker-uzh/packages/graphql/src/schema/mutation.ts`
  - `/Users/roland/.codex/worktrees/f125/klicker-uzh/packages/graphql/src/services/discussions.ts`
- Frontend gating points:
  - `/Users/roland/.codex/worktrees/f125/klicker-uzh/apps/frontend-pwa/src/pages/course/[courseId]/qa.tsx`
  - `/Users/roland/.codex/worktrees/f125/klicker-uzh/apps/frontend-manage/src/components/courses/CourseDiscussionOverview.tsx`
  - existing entry links/tabs in already modified PWA/Manage pages
- Exit criteria (pass/fail):
  - pass: when flags are off, UI/API exposure is cleanly hidden/denied with no broken routes; when on, behavior remains as implemented
  - fail: any bypass or broken state exists when toggling flags

### W3: Live Feedback Migration Path

- Implement backfill job from legacy live feedback to `DiscussionSpaceType.LIVE_QUIZ`.
- Implement dual-write in legacy feedback service:
  - `/Users/roland/.codex/worktrees/f125/klicker-uzh/packages/graphql/src/services/feedbacks.ts`
- Add reconciliation metrics and mismatch reporting for:
  - counts
  - ordering
  - vote totals
  - reply linkage
  - author linkage where available
- Exit criteria (pass/fail):
  - pass: dry-run is repeatable and reconciliation output is deterministic
  - fail: non-deterministic mapping or unresolved mismatch classes remain

### W4: End-to-End Verification

- Execute and track the scenario matrix defined in:
  - `/Users/roland/.codex/worktrees/f125/klicker-uzh/project/DISCUSSIONS_TESTING_PLAN.md`
- Add Cypress coverage for discussion flows (currently none).
- Exit criteria (pass/fail):
  - pass: all required scenarios have evidence and pass status
  - fail: any required scenario lacks evidence or has unresolved failures

### W5: Rollout + Operations

- Define staged rollout by feature flag.
- Add monitoring and alert checks:
  - discussion write/read errors
  - unexpected denial/error rates
  - anonymous rate-limit spikes
- Add rollback instructions per rollout phase.
- Exit criteria (pass/fail):
  - pass: operational playbook approved and rollback rehearsed
  - fail: rollout cannot be safely operated or reverted

### Coverage and Scope

- Workstream acceptance checks included in this backlog: `W1` to `W5`.
- UI/browser verification scope is tracked in:
  - `/Users/roland/.codex/worktrees/f125/klicker-uzh/project/DISCUSSIONS_TESTING_PLAN.md`
  - scenarios `QA-001` to `QA-012`
- Backend corroboration scope includes:
  - data integrity checks
  - access and token guardrail checks
  - anonymous rate-limit enforcement checks

### Assumptions and Defaults

- Documentation reflects current branch state at update time.
- Verification is executed later; this update only defines the runbooks.
- `agent-browser` is the primary browser verification tool and screenshot evidence is mandatory.
- If the environment is not ready (Node/dependencies/services), execution is deferred but the plan remains valid.
