---
type: API Layer
title: GraphQL API Layer
description: Pothos code-first schema, the three-layer authorization pattern, service contract, operation naming, and the codegen ritual.
timestamp: '2026-07-27'
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

`getUserKbsConnection` and `getKbResources` are owner-scoped cursor connections with a maximum page size of 50 and exact `totalCount`. KBs use `(updatedAt DESC, id DESC)`; resources use immutable `(createdAt DESC, id DESC)` so operation polling cannot move rows between pages. Opaque cursors are bound to the owner and normalized search/filter set and reject malformed, foreign, or mismatched reuse. Resource page and count predicates reassert the live, non-deleted owned parent relation after the initial authorization check. Search runs server-side across KB name/description or resource title/filename/URL, with resource type and latest-ingestion-status filters. `getKb` returns metadata and exact derived usage/consumer metrics rather than an unbounded child list. The former unbounded `getUserKbs` field and the misleading nested `KB.resources` field are not exposed; callers use the bounded connections.

The resource connection includes only each row's latest ingestion run. Full attempt history remains the separate owner-checked `getKbResourceIngestionRuns` query: it returns at most the five newest runs and is requested only from the inspector. Do not nest full history under the polled connection or expose the unbounded ledger.

Knowledge-base/chatbot binding uses `getKbChatbotBindings`, `attachKbToChatbot`, and `detachKbFromChatbot`. The query and mutations are owner-scoped, attach/detach require full-access scope, and `packages/graphql/src/services/knowledge.ts` locks both owner rows before replacing a binding. Attach atomically enables the one selected link and reconciles exactly the `tutor` and `explainer` KB MCP configurations; detach disables those configurations when no enabled link remains.

Knowledge-base deletion is an immediate visibility change, not synchronous storage removal. Resource and whole-KB delete mutations lock the parent KB first, retain owner-attributed tombstones, create explicit `DELETE` runs, and queue external deletion after commit. Whole-KB deletion also disables its chatbot links and KB MCP configurations. Upload-ticket issue, confirmation, URL creation, and deletion use the same parent lock so no live child can appear beneath a tombstoned KB; queue failure records only an opaque retry state and never restores visibility.

`deleteKbResources` accepts 1–50 unique resource UUIDs from one owned KB. It locks the parent and sorted child ids, rejects the whole selection when any row is missing, foreign, or active, creates one independently retryable delete run per row in a single transaction, and dispatches each operation only after commit. A post-commit dispatch failure does not roll back sibling tombstones; W5 maintenance retries the correlated failed dispatch.

The same parent lock serializes quota allocation. A KB permits 100 retained-or-reserved resources and 500 MiB of retained-or-reserved bytes. Upload requests reserve count and bytes, confirmation consumes the matching reservation, and URL creation reserves a count before its byte size is measured by the worker. Mutation failures use stable `KB_RESOURCE_LIMIT_REACHED`, `KB_STORAGE_LIMIT_REACHED`, and `KB_UPLOAD_TICKET_MISMATCH` codes. Klicker derives ingestion `kb_id` only from owner-checked persisted relations; platform-side validation against a registered per-project set remains a separate deployment gate.

## Subscriptions

Field filters over the shared pubSub: `schema/subscription.ts:feedbackCreated` pipes `ctx.pubSub.subscribe('feedbackCreated')` through a `liveQuizId` filter; the publishing side is a service (`services/feedbacks.ts`). Frontends consume via `subscribeToMore` with the generated `S*Document`.

## Worked feature traces

Read-only feature end-to-end: commit `ff61d9bc7` (#4951) — new object type, two query fields, service function, ops + committed codegen, manage page, i18n. Schema-change + mutation + heavy vitest variant: `38c92d035` (#4958). Step-by-step walkthrough: [Developing a Feature](./developing-a-feature.md).
