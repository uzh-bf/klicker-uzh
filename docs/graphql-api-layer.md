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

Knowledge-base detail polling exposes only each resource's latest ingestion run, loaded with the resource list in `packages/graphql/src/services/knowledge.ts:getKb`. Full attempt history is a separate `getKbResourceIngestionRuns` query: it checks resource ownership, returns at most the five newest runs, and is requested only when the lecturer expands that resource. Do not nest full history under the polled parent list or expose the unbounded ledger.

Knowledge-base/chatbot binding uses `getKbChatbotBindings`, `attachKbToChatbot`, and `detachKbFromChatbot`. The query and mutations are owner-scoped, attach/detach require full-access scope, and `packages/graphql/src/services/knowledge.ts` locks both owner rows before replacing a binding. Attach atomically enables the one selected link and reconciles exactly the `tutor` and `explainer` KB MCP configurations; detach disables those configurations when no enabled link remains.

## Subscriptions

Field filters over the shared pubSub: `schema/subscription.ts:feedbackCreated` pipes `ctx.pubSub.subscribe('feedbackCreated')` through a `liveQuizId` filter; the publishing side is a service (`services/feedbacks.ts`). Frontends consume via `subscribeToMore` with the generated `S*Document`.

## Worked feature traces

Read-only feature end-to-end: commit `ff61d9bc7` (#4951) — new object type, two query fields, service function, ops + committed codegen, manage page, i18n. Schema-change + mutation + heavy vitest variant: `38c92d035` (#4958). Step-by-step walkthrough: [Developing a Feature](./developing-a-feature.md).
