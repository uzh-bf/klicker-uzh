---
type: API Layer
title: GraphQL API Layer
description: Pothos code-first schema, the three-layer authorization pattern, service contract, operation naming, and the codegen ritual.
timestamp: '2026-09-02'
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

Runtime feature capabilities add a service-owned layer when process configuration and persisted user state must participate. Element import/export exposes `canUseElementImportExport` to authenticated users (restricted scopes receive `false`) and repeats its authoritative assertion as the first statement of every public operation. Because the capability is fetched with the global user profile, its resolver fails closed to `false` on a private-preview lookup failure and logs no exception text; operation-level assertions remain strict and return the stable infrastructure code instead of silently granting or downgrading access. The schema's full-access guard remains in place; the service check is defense in depth and provides the kill switch/private-preview/assessment decision.

`packages/graphql/src/schema/elementImportExport.ts` owns the feature's Pothos types, authorization scopes, root-field registrations, and boundary-size guards. Keep import/export fields out of the monolithic `query.ts` and `mutation.ts`; the feature module registers them with `builder.queryFields` and `builder.mutationFields`, while resolvers remain one-line service delegations.

Element import validation keeps large relation data normalized in its public response. `packages/graphql/src/schema/elementImportExport.ts:ElementImportPackagePreviewElement` exposes an answer-collection ref and selected integer IDs, while the full entry values appear once in the top-level answer-collection objects requested by `packages/graphql/src/graphql/ops/MValidateElementImportPackage.graphql`. Its options use the nine-member Pothos union in `packages/graphql/src/schema/elementImportPreviewOptions.ts`; the operation must keep exhaustive inline fragments so generated clients receive a `__typename`-discriminated union rather than `Json`/`any`. Choice correctness is nullable because packages without a sample solution have no scoring key. Do not re-add per-element pool/value fields: 100 elements may legally share one 2,000-entry pool, so repetition would create response-size amplification.

Direct media upload is a versioned two-operation authenticated contract owned by `packages/graphql/src/schema/mediaUpload.ts`. New Manage sends optional `getFileUploadSas(..., requiresFinalization: true)`, which creates an owner-bound `MediaFile` and create-only 15-minute SAS plus a one-shot `direct-upload-pending:<mediaId>` marker. Legacy callers omit the argument: they retain the old unmarked protocol only while import/export is dark, and an enabled server rejects them before creating a row or SAS so a cached client cannot bypass finalization. The production persisted-operation compatibility manifest retains the removed v3 `UserProfile`/upload queries plus the intermediate upload query during this rollout window. After Azure accepts the browser upload, full-access mutation `finalizeFileUpload(mediaFileId: ID!): Boolean!` delegates to `packages/graphql/src/services/importExportFingerprints.ts:finalizeUploadedMediaFingerprintV1`. The service rechecks the current user as owner and Azure's observed size. Supported bytes through 5 MiB receive a SHA-256; valid 5–256 MiB media becomes a current/null known export omission; missing, zero/unknown, malformed, or >256 MiB media returns `false` with its marker intact. Normal direct finalization does not scan elements: authoring locks matching dependency rows and always rejects pending/cleanup markers. Enabled authoring additionally rejects missing/stale rows, wrong owners, and malformed hashes, but accepts current/null known omissions; dark rollout compatibility accepts ordinary legacy unresolved media. An unmarked historical or previously classified media row can already be referenced, so any state transition through this endpoint instead performs one targeted active-element scan, changes only the affected fingerprint fields, and synchronously refreshes those fingerprints in the same transaction; authored element versions and modification timestamps remain unchanged. Imported-media staging applies the same targeted repair when it verifies and upgrades an existing stale hash/version pair. Finalization is idempotent: Manage retries the same `mediaFileId` through a bounded three-attempt policy, and an already-classified retry skips storage work and element repair. `userMediaFiles` always hides lifecycle rows; when import/export is enabled it returns only version-1 classified rows, while the disabled gate preserves ordinary legacy visibility until the rollout media backfill is complete. Keep finalization server-side—browser MIME metadata is not the import/export media identity.

The package upload/download REST adapter is intentionally narrower than `ContextWithUser`: package services receive only Prisma, `redisExec`, and the authenticated user, and the binary upload stream is `AsyncIterable<Uint8Array>`. Do not pass request/response objects, assessment Redis, PubSub, Hatchet, or the global task registry into this feature boundary.

Worked examples: `requestCourseDeletion` in `mutation.ts` (asUser + ADMIN
permission on courseId, plus a nullable boolean for optional draft live-quiz
cleanup), `controlCourse` in `query.ts` (EXECUTE), and `getLiveQuizSummary`
(READ).
Existing fields use `t.withAuth(...)` exclusively — follow them rather than
inventing `authScopes` variants.

## Layering contract

- `schema/*.ts` — Pothos object types plus root registrations. Legacy roots live in `query.ts`/`mutation.ts`/`subscription.ts`; cohesive feature modules may register their own fields with `builder.queryFields` or `builder.mutationFields`. Resolvers delegate immediately: `resolve: (_, args, ctx) => CourseService.requestCourseDeletion(args, ctx)`.
- `services/*.ts` — all business logic, Prisma access, Redis, pubSub publishes. Import style: `import * as XService from '../services/x.js'`.
- Context (`packages/graphql/src/lib/context.ts`): `Context` has optional `user`; `t.withAuth` narrows to `ContextWithUser` (`user.sub`, `role`, `scope`, catalyst flags) — services take `ctx` and rely on that narrowing.
- Capability-gated reads (precedent: `getChatAccountUsage` with the `ai-beta` flag) keep authorization first, then call the fail-closed helper `lib/featureFlags.ts:isFeatureFlagEnabled` before any domain data query, and return `null` when the flag is unavailable or false. Visibility gates hide results; they never replace authorization and never gate administrative mutations that must stay reachable.

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

The package build runs this generation before Rollup. Commit the handwritten operation/schema sources and the generated `src/public/schema.graphql` SDL snapshot; do not commit `src/ops.ts` or `src/public/{client,server}.json`, which are ignored build outputs. Frontends import typed documents from `@klicker-uzh/graphql/dist/ops`, and outside dev/test the backend only executes hashes present in `server.json` (see [Architecture Overview](./architecture-overview.md)). A missing generation step fails in two distinct ways: typecheck errors for missing documents or runtime persisted-query rejection for an unknown hash.

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
Activity list filtering excludes deleted activities that are only reachable
through derived access before fetching and counting, so pagination totals and
rendered rows describe the same result set.

## Subscriptions

Field filters over the shared pubSub: `schema/subscription.ts:feedbackCreated` pipes `ctx.pubSub.subscribe('feedbackCreated')` through a `liveQuizId` filter; the publishing side is a service (`services/feedbacks.ts`). Frontends consume via `subscribeToMore` with the generated `S*Document`.

## Worked feature traces

Read-only feature end-to-end: commit `ff61d9bc7` (#4951) — new object type, two query fields, service function, ops + codegen, manage page, i18n. Schema-change + mutation + heavy vitest variant: `38c92d035` (#4958). Step-by-step walkthrough: [Developing a Feature](./developing-a-feature.md).
