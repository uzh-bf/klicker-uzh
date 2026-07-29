---
type: Feature Architecture
title: Course Discussions
description: Course-scoped Q&A data, access, contextual UI surfaces, embeds, and verification.
timestamp: '2026-07-29'
tags:
  - discussions
  - graphql
  - frontend
---

# Course Discussions

Course Discussions provides gated Q&A inside a course and its learning contexts. The primary participant experience is contextual: a desktop rail beside course or activity content and a collapsed in-page disclosure on mobile. The `/course/[courseId]/qa` page remains the fallback and embed host, not the normal navigation target (`apps/frontend-pwa/src/components/course/ResponsiveDiscussionRail.tsx:ResponsiveDiscussionRail`, `apps/frontend-pwa/src/pages/course/[courseId]/qa.tsx:CourseDiscussionPage`).

## Feature gates

All read and write services require both `Course.isCourseQARolloutEnabled` and `Course.isCourseQAEnabled`. `Course.isCourseQAAnonymousEnabled` independently permits anonymous embed posting; it does not bypass the first two gates (`packages/prisma/src/prisma/schema/course.prisma:Course`, `packages/graphql/src/services/discussions/access.ts:isCourseDiscussionEnabled`).

The rollout flag controls whether Manage and participant surfaces are available. The runtime flag is the course-level kill switch while preserving stored discussion data. Course settings expose the runtime and anonymous-posting choices only after rollout is enabled (`apps/frontend-manage/src/components/courses/modals/CourseManipulationModal.tsx:CourseManipulationModal`).

## Data and scopes

Each course has at most one `DiscussionSpace`. A space contains:

- `COURSE` scopes for course-wide conversation.
- `PRACTICE_STACK` scopes for practice and microlearning element stacks.
- `EXTERNAL_BLOCK` scopes created for signed embeds.

Scopes are unique by `(spaceId, scopeKey)`. Threads and replies are soft-deleted, retain denormalized vote/reply counts, and write lifecycle events. Participant votes are unique per thread or reply (`packages/prisma/src/prisma/schema/discussion.prisma:DiscussionSpace`, `packages/prisma/src/prisma/schema/discussion.prisma:DiscussionScope`, `packages/prisma/src/prisma/schema/discussion.prisma:DiscussionThread`).

`packages/graphql/src/services/discussions.ts` is the public service facade. Scope canonicalization and persistence live in `services/discussions/scopes.ts`; model normalization and presentation enrichment live in `services/discussions/model.ts` (`packages/graphql/src/services/discussions.ts:courseDiscussionThreads`, `packages/graphql/src/services/discussions/scopes.ts:canonicalizeScope`, `packages/graphql/src/services/discussions/model.ts:mapThreads`).

## Access and capabilities

`resolveCourseDiscussionReadContext` is the shared read gate. It validates the course flags, actor, supported scope, evaluated-stack access, external-embed restriction, and exact embed binding before a query reads threads (`packages/graphql/src/services/discussions/read-context.ts:resolveCourseDiscussionReadContext`).

- Enrolled participants can read and post identified content.
- Course users need at least `READ` for participant-style reads and `WRITE` for the lecturer overview or embed generation.
- A participant can access a stack scope only after responding to every element in that non-empty stack.
- Participant-style external-scope reads and posts require a valid embed token; the lecturer overview can read them with course `WRITE` permission.
- Anonymous reads or writes require a token bound to the current discussion space, course, and scope. Anonymous writes additionally require the token claim and course setting.

These rules are implemented by `getCourseAccessActor`, `canParticipantAccessDiscussionScope`, `resolveCourseDiscussionReadContext`, and the `courseDiscussionOverview` service (`packages/graphql/src/services/discussions/access.ts:getCourseAccessActor`, `packages/graphql/src/services/discussions/access.ts:canParticipantAccessDiscussionScope`, `packages/graphql/src/services/discussions/queries.ts:courseDiscussionOverview`).

The thread-page response returns derived posting capabilities instead of raw identity data. GraphQL discussion objects do not expose `authorParticipantId` or fingerprint hashes (`packages/graphql/src/schema/discussions.ts:DiscussionThreadPageObject`, `packages/graphql/src/schema/discussions.ts:DiscussionThread`).

## API shape

The GraphQL surface contains:

- `courseDiscussionThreads` for one scope and `courseDiscussionOverview` for the lecturer's grouped course view.
- Thread/reply creation, identified upvotes, and soft deletion by an identified author or a course user with `WRITE`. Anonymous authors have no identity-based self-delete capability. Thread deletion blanks the thread, soft-deletes its replies, and resets `replyCount`; reply deletion blanks that reply and decrements the count (`packages/graphql/src/services/discussions/interactions.ts:deleteCourseDiscussionThread`, `packages/graphql/src/services/discussions/interactions.ts:deleteCourseDiscussionReply`).
- Separate persisted operations for external-block and course-wide embed generation.

Resolvers delegate to the discussion service facade (`packages/graphql/src/schema/query.ts:courseDiscussionThreads`, `packages/graphql/src/schema/mutation.ts:createCourseDiscussionThread`). Any schema or operation change requires the normal GraphQL generation ritual documented in [GraphQL API Layer](./graphql-api-layer.md).

Participant views poll the first scope page every 30 seconds. The Manage overview polls its first page every 20 seconds. After a successful load-more action, each view stops polling and retains the loaded snapshot until it is remounted or explicitly refreshed (`apps/frontend-pwa/src/components/course/useCourseDiscussion.ts:useCourseDiscussion`, `apps/frontend-manage/src/components/courses/CourseDiscussionOverview.tsx:CourseDiscussionOverview`).

## User interface placement

`CourseDiscussionPanel` is the shared participant renderer and `useCourseDiscussion` owns its query, posting, capabilities, and pagination. `CourseDiscussionThreadCard` owns reply and vote interactions per thread (`apps/frontend-pwa/src/components/course/CourseDiscussionPanel.tsx:CourseDiscussionPanel`, `apps/frontend-pwa/src/components/course/CourseDiscussionThreadCard.tsx:CourseDiscussionThreadCard`).

The panel is integrated into:

- The course overview beside course contents on desktop.
- A practice stack after evaluation.
- Microlearning evaluation with one contextual stack selector.
- The fallback and embed `/qa` route.

The integration points are `CourseOverview`, `ElementStack`, `MicrolearningEvaluation`, and `CourseDiscussionPage` (`apps/frontend-pwa/src/pages/course/[courseId]/index.tsx:CourseOverview`, `apps/frontend-pwa/src/components/practiceQuiz/ElementStack.tsx:ElementStack`, `apps/frontend-pwa/src/pages/course/[courseId]/microLearnings/[id]/evaluation.tsx:MicrolearningEvaluation`, `apps/frontend-pwa/src/pages/course/[courseId]/qa.tsx:CourseDiscussionPage`).

Manage exposes a permission-gated Q&A tab. Discussion triage is primary; the course/external embed-link generator is a secondary disclosure (`apps/frontend-manage/src/pages/courses/[id]/index.tsx:CourseOverviewPage`, `apps/frontend-manage/src/components/courses/CourseDiscussionOverview.tsx:CourseDiscussionOverview`, `apps/frontend-manage/src/components/courses/CourseDiscussionEmbedGenerator.tsx:CourseDiscussionEmbedGenerator`).

## Embed security

Embed links carry a signed, expiring capability for one existing space and scope. New links put the bearer token in the URL fragment. The PWA captures it once, removes it from browser history before querying, uses POST for token-bearing GraphQL operations, and applies `no-referrer`. Legacy query tokens are accepted only for transition and cleaned immediately (`docs/adr/0001-course-discussion-embed-bearer-transport.md:Decision`, `apps/frontend-pwa/src/pages/course/[courseId]/qa.tsx:CourseDiscussionPage`, `apps/frontend-pwa/src/lib/apollo.ts:createIsomorphLink`).

Tokens default to 48 hours and are capped at 14 days. They are stateless and cannot be revoked individually; disabling course Q&A is the available whole-course kill switch (`packages/graphql/src/services/discussions/embeds.ts:getCourseDiscussionEmbeddingInfo`, `docs/adr/0001-course-discussion-embed-bearer-transport.md:Consequences`).

Anonymous posting derives a salted hash from the trusted request IP, course, and user agent. The hash is stored on the anonymous thread or reply. Redis fixed-window limits allow one post per scope fingerprint per 90 seconds, six per course fingerprint per hour, and 20 per course IP per hour; the IP limit uses the raw request IP in an expiring Redis key. Identified participants can post 60 times per course per hour. Persisted rate-limit events contain reason, limit, and TTL but not the raw IP (`packages/graphql/src/services/discussions/embeds.ts:hashAnonymousFingerprint`, `packages/graphql/src/services/discussions/embeds.ts:enforceAnonymousRateLimits`, `packages/graphql/src/services/discussions/embeds.ts:enforceParticipantRateLimit`, `packages/graphql/src/services/discussions/posting.ts:createCourseDiscussionThread`).

## Verification

The DB-backed integration registrar composes suites for content/concurrency, rate limits, gates/embed access, deletion policy, and scopes (`packages/graphql/test/discussions/content-and-concurrency.suite.ts:registerContentAndConcurrencySuite`, `packages/graphql/test/discussions/anonymous-rate-limits.suite.ts:registerAnonymousRateLimitsSuite`, `packages/graphql/test/discussions/gates-and-embed-access.suite.ts:registerGatesAndEmbedAccessSuite`, `packages/graphql/test/discussions/deletion-policy.suite.ts:registerDeletionPolicySuite`, `packages/graphql/test/discussions/scopes.suite.ts:registerScopesSuite`).

**Config-derived:** `test:local` provisions the real Postgres/Redis/Hatchet test environment but currently assumes the general worker's ignored `dist/` output already exists. Build that prerequisite first:

```bash
pnpm --filter @klicker-uzh/hatchet-worker-general build
pnpm --filter @klicker-uzh/graphql test:local
```

The four existing Cypress journeys cover course integration, evaluated practice scopes, embeds, and rollout gates (`cypress/cypress/e2e/Y-course-qa-course-workflow.cy.ts:Course Q&A course-level workflows`, `cypress/cypress/e2e/Y-course-qa-practice-workflow.cy.ts:Course Q&A practice workflow`, `cypress/cypress/e2e/Y-course-qa-embed-workflow.cy.ts:Course Q&A embed workflow`, `cypress/cypress/e2e/Y-course-qa-rollout-gates-workflow.cy.ts:Course Q&A rollout-gate workflow`). Cypress is legacy coverage; new end-to-end scenarios should follow the Playwright-first policy in [Testing](./testing.md).

Any UI change still requires real browser verification across desktop and mobile. Embed changes also require a separate unauthenticated browser session so participant cookies cannot mask capability errors.

## Current boundary

The current model has no answered, resolved, or pinned thread state and no realtime subscription. Delete services are implemented, but participant and lecturer deletion/moderation controls are not yet exposed in the UI. Do not infer those capabilities from the presence of generated delete operations.
