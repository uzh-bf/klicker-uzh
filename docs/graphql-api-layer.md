---
type: API Layer
title: GraphQL API Layer
description: Pothos code-first schema, the three-layer authorization pattern, service contract, operation naming, and the codegen ritual.
timestamp: '2026-07-22'
tags:
  - backend
  - graphql
---

# GraphQL API Layer

> **Migration in flight (2026-07):** a dual GraphQL→tRPC migration is open as PR #5132 (not yet merged) — a tRPC API in `packages/api` mounted at `/api/trpc` beside `/api/graphql`, with frontends moving to React Query app by app. This page describes current reality and stays authoritative until that PR merges; before extending the API surface, check the PR's status and which surface your target app uses. Staged doc/skill changes: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

**The pattern to copy exactly: resolvers are one-liners; authorization is three explicit, named layers.** Every protected field in `packages/graphql/src/schema/` composes the same three pieces — declare the role with `t.withAuth(...)`, check object-level permission with `withPermission(...)`, and let the service do the work. Deviating from this shape (inline logic in resolvers, hand-rolled permission checks) is the number-one review flag.

## Three-layer authorization

1. **Role/scope gate — `t.withAuth(scopeObject)`.** Legacy root scope objects live near the top of `packages/graphql/src/schema/mutation.ts` and `query.ts`; cohesive feature modules define the same small constants next to their root registrations. Common shapes include `asUser`, `asUserFullAccess`, `asUserSessionExec`, `asUserOwner`, `asUserWithCatalyst`, `asParticipant`, `asTemporaryParticipant`, and `asAdmin`. Their semantics come from `packages/graphql/src/builder.ts` auth scopes: `authenticated` (logged in, not OTP), `role` (USER also passes for ADMIN; PARTICIPANT is exact), `scope` (a ladder — `ACCOUNT_OWNER > FULL_ACCESS > SESSION_EXEC > READ_ONLY`, a login with a higher scope passes lower requirements), `catalyst`. `defaultStrategy: 'all'`; failure throws `GraphQLError('Unauthorized')`.
2. **Object-level permission — `withPermission(argsToCheck, PermissionLevel, resolver)`** (`packages/graphql/src/services/sharing.ts:withPermission`). Maps resolver args to a `PermissionCheck` (one of `courseId | liveQuizId | practiceQuizId | microLearningId | groupActivityId | elementId | answerCollectionId | catalogCollectionId`) and a required `PermissionLevel`. **On failure it returns `null` instead of throwing** — clients see a null field, not an error.
3. **Derived-permission lookup — `checkAccess`** (same file): resolves ownership and sharing grants (`DerivedPermission`) for the target object.

Runtime feature capabilities add a service-owned layer when process configuration and persisted user state must participate. Element import/export exposes `canUseElementImportExport` to authenticated users (restricted scopes receive `false`) and repeats its authoritative assertion as the first statement of every public operation. Because the capability is fetched with the global user profile, its resolver fails closed to `false` on a private-preview lookup failure and logs no exception text; operation-level assertions remain strict and return the stable infrastructure code instead of silently granting or downgrading access. The schema's full-access guard remains in place; the service check is defense in depth and provides the kill switch/private-preview/assessment decision.

`packages/graphql/src/schema/elementImportExport.ts` owns the feature's Pothos types, authorization scopes, root-field registrations, and boundary-size guards. Keep import/export fields out of the monolithic `query.ts` and `mutation.ts`; the feature module registers them with `builder.queryFields` and `builder.mutationFields`, while resolvers remain one-line service delegations.

Element import validation keeps large relation data normalized in its public response. `packages/graphql/src/schema/elementImportExport.ts:ElementImportPackagePreviewElement` exposes an answer-collection ref and selected integer IDs, while the full entry values appear once in the top-level answer-collection objects requested by `packages/graphql/src/graphql/ops/MValidateElementImportPackage.graphql`. Its options use the nine-member Pothos union in `packages/graphql/src/schema/elementImportPreviewOptions.ts`; the operation must keep exhaustive inline fragments so generated clients receive a `__typename`-discriminated union rather than `Json`/`any`. Choice correctness is nullable because packages without a sample solution have no scoring key. Do not re-add per-element pool/value fields: 100 elements may legally share one 2,000-entry pool, so repetition would create response-size amplification.

Direct media upload is a versioned two-operation authenticated contract owned by `packages/graphql/src/schema/mediaUpload.ts`. New Manage sends optional `getFileUploadSas(..., requiresFinalization: true)`, which creates an owner-bound `MediaFile` and create-only 15-minute SAS plus a one-shot `direct-upload-pending:<mediaId>` marker. Legacy callers omit the argument: they retain the old unmarked protocol only while import/export is dark, and an enabled server rejects them before creating a row or SAS so a cached client cannot bypass finalization. The production persisted-operation compatibility manifest retains the removed v3 `UserProfile`/upload queries plus the intermediate upload query during this rollout window. After Azure accepts the browser upload, full-access mutation `finalizeFileUpload(mediaFileId: ID!): Boolean!` delegates to `packages/graphql/src/services/importExportFingerprints.ts:finalizeUploadedMediaFingerprintV1`. The service rechecks the current user as owner and Azure's observed size. Supported bytes through 5 MiB receive a SHA-256; valid 5–256 MiB media becomes a current/null known export omission; missing, zero/unknown, malformed, or >256 MiB media returns `false` with its marker intact. Normal direct finalization does not scan elements: authoring locks matching dependency rows and always rejects pending/cleanup markers. Enabled authoring additionally rejects missing/stale rows, wrong owners, and malformed hashes, but accepts current/null known omissions; dark rollout compatibility accepts ordinary legacy unresolved media. An unmarked historical or previously classified media row can already be referenced, so any state transition through this endpoint instead performs one targeted active-element scan, changes only the affected fingerprint fields, and synchronously refreshes those fingerprints in the same transaction; authored element versions and modification timestamps remain unchanged. Imported-media staging applies the same targeted repair when it verifies and upgrades an existing stale hash/version pair. Finalization is idempotent: Manage retries the same `mediaFileId` through a bounded three-attempt policy, and an already-classified retry skips storage work and element repair. `userMediaFiles` always hides lifecycle rows; when import/export is enabled it returns only version-1 classified rows, while the disabled gate preserves ordinary legacy visibility until the rollout media backfill is complete. Keep finalization server-side—browser MIME metadata is not the import/export media identity.

The package upload/download REST adapter is intentionally narrower than `ContextWithUser`: package services receive only Prisma, `redisExec`, and the authenticated user, and the binary upload stream is `AsyncIterable<Uint8Array>`. Do not pass request/response objects, assessment Redis, PubSub, Hatchet, or the global task registry into this feature boundary.

Worked examples: `deleteCourse` in `mutation.ts` (asUser + ADMIN permission on courseId), `controlCourse` in `query.ts` (EXECUTE), `getLiveQuizSummary` (READ). Existing fields use `t.withAuth(...)` exclusively — follow them rather than inventing `authScopes` variants.

## Layering contract

- `schema/*.ts` — Pothos object types plus root registrations. Legacy roots live in `query.ts`/`mutation.ts`/`subscription.ts`; cohesive feature modules may register their own fields with `builder.queryFields` or `builder.mutationFields`. Resolvers delegate immediately: `resolve: (_, args, ctx) => CourseService.deleteCourse(args, ctx)`.
- `services/*.ts` — all business logic, Prisma access, Redis, pubSub publishes. Import style: `import * as XService from '../services/x.js'`.
- Context (`packages/graphql/src/lib/context.ts`): `Context` has optional `user`; `t.withAuth` narrows to `ContextWithUser` (`user.sub`, `role`, `scope`, catalyst flags) — services take `ctx` and rely on that narrowing.

## Validation and errors

- Arg validation via the Pothos **Zod plugin** — pass `validate:` on args (email/regex/length examples in `mutation.ts`); issues are joined into a `GraphQLError` by the shaper in `builder.ts`.
- Service-level errors: prefer `GraphQLError` with `extensions.code` (e.g. `LIVE_QUIZ_PIN_INVALID`, `FORBIDDEN` in `services/liveQuizzes.ts`). Plain `throw new Error` exists in older code — don't add more.
- Element import/export uses the closed `ImportExportErrorCode` / `ImportExportWarningCode` GraphQL enums from `packages/graphql/src/lib/importExportErrors.ts`. Domain causes are redacted before transport, preview arrays are enum-typed, and unknown failures map to `IMPORT_EXPORT_INFRASTRUCTURE_FAILURE`; see the [Import/Export Error Contract](./import-export-error-contract.md).

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
