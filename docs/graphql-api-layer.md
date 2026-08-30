---
type: API Layer
title: GraphQL API Layer
description: Pothos code-first schema, the three-layer authorization pattern, service contract, operation naming, and the codegen ritual.
timestamp: '2026-08-25'
tags:
  - backend
  - graphql
---

# GraphQL API Layer

> **Migration in flight (2026-07):** a dual GraphQL→tRPC migration is open as PR #5132 (not yet merged) — a tRPC API in `packages/api` mounted at `/api/trpc` beside `/api/graphql`, with frontends moving to React Query app by app. This page describes current reality and stays authoritative until that PR merges; before extending the API surface, check the PR's status and which surface your target app uses. Staged doc/skill changes: `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

**The pattern to copy exactly: resolvers are one-liners; authorization is three explicit, named layers.** Protected single-object fields in `packages/graphql/src/schema/` compose the same three pieces — declare the role with `t.withAuth(...)`, check object-level permission with `withPermission(...)`, and let the service do the work. Multi-object batch fields are the explicit exception described below. Deviating from these shapes (inline logic in resolvers, unbounded service checks) is the number-one review flag.
Owner-only aggregates such as `KB` enforce their persisted owner relation at the service boundary because they have no sharing primitive. Resolvers still delegate immediately rather than implementing authorization or business logic inline.

## Three-layer authorization

1. **Role/scope gate — `t.withAuth(scopeObject)`.** Scope objects are defined once near the top of `packages/graphql/src/schema/mutation.ts` (and mirrored in `query.ts`): `asUser`, `asUserFullAccess`, `asUserSessionExec`, `asUserOwner`, `asParticipant`, `asTemporaryParticipant`, `asAdmin`. Their semantics come from `packages/graphql/src/builder.ts` auth scopes: `authenticated` (logged in, not OTP), `role` (USER also passes for ADMIN; PARTICIPANT is exact), `scope` (a ladder — `ACCOUNT_OWNER > FULL_ACCESS > SESSION_EXEC > READ_ONLY`, a login with a higher scope passes lower requirements), `catalyst`. `defaultStrategy: 'all'`; failure throws `GraphQLError('Unauthorized')`. The former `asUserWithCatalyst` shorthand was removed when the three activity formats became standard (ADR 0037); gate such fields with `asUserFullAccess` and keep the `catalyst` scope for surfaces that genuinely require the paid tier.
2. **Object-level permission — `withPermission(argsToCheck, PermissionLevel, resolver)`** (`packages/graphql/src/services/sharing.ts:withPermission`). Maps resolver args to a `PermissionCheck` (one of `courseId | liveQuizId | practiceQuizId | microLearningId | groupActivityId | elementId | answerCollectionId | catalogCollectionId`) and a required `PermissionLevel`. **On failure it returns `null` instead of throwing** — clients see a null field, not an error. A multi-object batch field cannot use this single-selector wrapper: gate the field with `t.withAuth(...)`, then perform a bounded service query and an explicit permission check for every unique object before mutation. Return per-object outcomes instead of collapsing the batch to one nullable field.
3. **Derived-permission lookup — `checkAccess`** (same file): resolves ownership and sharing grants (`DerivedPermission`) for the target object.

### Optional feature-entitlement gate

A backend-enforced feature entitlement is an additional service-entry
condition, not a replacement or shortcut for the three authorization layers.
Use the centralized fail-closed evaluator (currently
`packages/graphql/src/lib/featureFlags.ts:requireFeatureFlagAccess`) before the
protected service reads feature data. It receives only the authenticated
Klicker user ID, actor type, and role; missing evaluators, false results, or SDK
failures return a generic `FORBIDDEN`. A true result only permits the normal
role/scope and resource-permission contract to continue. Browser evaluation is
never trusted for API access. See
[ADR 0038](./adr/0038-backend-enforced-feature-entitlements.md).

`PermissionCheck` has no KB key because knowledge bases are not shareable aggregates. KB schema fields use the appropriate `t.withAuth(...)` scope, then every service query or mutation resolves the KB through `ownerId: ctx.user.sub` or an equivalent persisted owner relation before reading or mutating it. Do not add a fake permission mapping or widen KB sharing to make its resolver look like a course resolver.

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

`getUserKbsConnection` and `getKbResources` are owner-scoped cursor connections with a maximum page size of 50 and exact `totalCount`. KBs use `(updatedAt DESC, id DESC)`; resources use immutable `(createdAt DESC, id DESC)` so operation polling cannot move rows between pages. Opaque cursors are bound to the owner and normalized search/filter set and reject malformed, foreign, or mismatched reuse. Resource page and count predicates reassert the live, non-deleted owned parent relation after the initial authorization check. Search runs server-side across KB name/description or resource title/filename/URL, with resource type and current-operation-status filters. `getKb` returns metadata and exact derived usage/consumer metrics rather than an unbounded child list. The former unbounded `getUserKbs` field and the misleading nested `KB.resources` field are not exposed; callers use the bounded connections.

The resource connection includes only the run identified by each row's stored `ingestionAttemptId`, which is the lecturer's current operation. A signed platform refresh appends its own historic ledger row without changing that projection or its status filter. Full attempt history remains the separate owner-checked `getKbResourceIngestionRuns` query: it returns at most the five newest runs and is requested only from the inspector. Do not nest full history under the polled connection or expose the unbounded ledger.

Knowledge-base/chatbot binding uses `getKbChatbotBindings`, `attachKbToChatbot`, and `detachKbFromChatbot`. The query and mutations are owner-scoped, attach/detach require full-access scope, and `packages/graphql/src/services/knowledge.ts` locks both owner rows before replacing a binding. Attach atomically enables the one selected link and reconciles exactly the `tutor` and `explainer` KB MCP configurations; detach disables those configurations when no enabled link remains.

Every lecturer knowledge-base service entry point and both Manage chatbot operations start with `packages/graphql/src/lib/manageAiFeatureGate.ts:assertManageAiEnabled`. The gate requires the GrowthBook `ai-beta` flag and the current `User.aiFeaturesEnabled` entitlement, returns `AI_BETA_ACCESS_REQUIRED` when either condition is closed, and reads the account after the flag so access withdrawal takes effect on the next request. Participant `courseChatbots` queries and worker-only knowledge-graph settlement remain outside this lecturer management gate. The separate `assertKbIngestionEnabled` kill switch reads `KB_INGESTION_DISABLED` at call time and blocks only upload-ticket issue, URL-resource creation, and Ingest/Retry/Re-ingest with `KB_INGESTION_DISABLED`; reads, upload confirmation, deletion, and chatbot binding remain available while ingestion is disabled.

The graph lifecycle has two additional gates. `KB_GRAPH_DISABLED=true` blocks graph opt-in and rebuild mutations, while `KB.knowledgeGraphEnabled` is required before a build can reserve quota or be served to chatbot students. The worker rechecks both gates and a complete `RESERVED` cost ledger, including its linked quota identity, immediately before starting the external run; it claims `dispatchClaimedAt` before the provider call, and an accepted-but-uncorrelated run is held for review rather than externally retried. An unstarted gated build fails closed and releases its ordinary reservation, while an incomplete pre-accounting row is held for review. An accepted-but-uncorrelated build keeps the active KB build slot fenced, and a rebuild mutation refuses to start a second external run; that hold is a waiting state rather than an operator task, because `packages/hatchet/src/kbGraphIngestion.ts:resolveAmbiguousKBGraphDispatch` asks the provider again on every graph-monitor tick and either correlates the recovered run or, once the provider definitively reports no run for that build id, releases the reservation and frees the slot as an ordinary `KB_GRAPH_DISPATCH_FAILED`. `setKbKnowledgeGraphEnabled` validates the cost configuration before enabling a KB. Rebuild reserves the configured estimate in minor currency units under the owner-semester quota lock, and the external monitor never publishes from provider status alone: `settleKbKnowledgeGraphResult` accepts only a W1-versioned terminal result whose build, KB, owner, run, source digest, graph name, artifact, currency, bounded counters, and metering match the reservation. A valid success settles and publishes; a valid non-success result with metering settles actual usage without publishing; an unmetered non-success releases only an ordinary `RESERVED` build. A timed-out success may publish only after settlement atomically confirms no newer build and a matching current KB digest; stale or superseded late results settle usage without publication. Settlement is fenced by `KBGraphBuild.costStatus` and cleanup claims; invalid results become `NEEDS_HUMAN_REVIEW` and retain the reservation. The config query selects the newest graph attempt for lifecycle and cost fields, while it resolves `isStale` only from a verified successful published build, so a held or charged rebuild remains visible without changing the served pointer. The lecturer config reports persisted quota-currency/limit drift as unavailable and keeps historical build-cost currency separate from quota display.

The element-generation API exposes SC, MC, KPRIM, and flashcards as peer Klicker elements over one `ElementGenerationBuild` lifecycle. `elementGenerationCapabilities.configured` requires both the dedicated Hatchet/Blob runtime and complete fixed-price configuration. Initial generation and flashcard retries reserve the shared `KBGraphQuota` under its owner-semester lock, persist one `ElementGenerationSpend` per durable dispatch UUID, finish deterministic runtime validation, and only then claim immediately before the provider call. Acceptance or exact-run recovery settles the spend. Concurrent use of one client idempotency key returns the committed build without another reservation. Definite pre-claim failure releases atomically with terminal build state. An accepted-but-not-yet-visible attempt is never redispatched: its claim stays fenced for 15 minutes, after which an exact provider lookup may release it only when no matching run exists. Review and incomplete-publication events do not reserve cost. Provider success without the required output artifact is terminal instead of polled forever, and buffered artifact reads request at most 10 MiB plus one byte before rejecting oversized output.

The additive cost-accounting migration requires a disable/drain → migrate → deploy → re-enable rollout wherever element generation has previously run. New code refuses to synchronize, review, publish, or retry a nonterminal build whose `costAccountingVersion` is not `1`; disabling and draining before migration prevents an old pod from creating another unreserved row during a rolling deployment. Helm fails closed unless the native graph workflow, graph-artifact production, shared graph quota values, element dispatch prices, and dedicated runtime coordinates are all configured.

Knowledge-base deletion is an immediate visibility change, not synchronous storage removal. Resource and whole-KB delete mutations lock the parent KB first, retain owner-attributed tombstones, create explicit `DELETE` runs, and queue external deletion after commit. Whole-KB deletion also disables its chatbot links and KB MCP configurations. Upload-ticket issue, confirmation, URL creation, and deletion use the same parent lock so no live child can appear beneath a tombstoned KB; queue failure records only an opaque retry state and never restores visibility.

`deleteKbResources` accepts 1–50 unique resource UUIDs from one owned KB. It locks the parent and sorted child ids, rejects the whole selection when any row is missing, foreign, or active, creates one independently retryable delete run per row in a single transaction, and dispatches each operation only after commit. A post-commit dispatch failure does not roll back sibling tombstones; W5 maintenance retries the correlated failed dispatch.

The same parent lock serializes quota allocation. A KB permits 100 retained-or-reserved resources and 500 MiB of retained-or-reserved bytes. Upload requests reserve their exact count and bytes, confirmation consumes the matching reservation, and URL creation reserves one resource plus the conservative 25 MiB unknown-size claim before the worker measures its exact size. Mutation failures use stable `KB_RESOURCE_LIMIT_REACHED`, `KB_STORAGE_LIMIT_REACHED`, and `KB_UPLOAD_TICKET_MISMATCH` codes. Klicker derives ingestion `kb_id` only from owner-checked persisted relations; platform-side validation against a registered per-project set remains a separate deployment gate.

The authenticated source gateway in `packages/graphql/src/services/knowledgeSourceGateway.ts:handleKBSourceGateway` intentionally uses one system-to-system `KB_SOURCE_GATEWAY_KEY`, not an end-user or per-owner credential. A caller holding that key and an exact resource id/version can read any tenant's eligible live BLOB source; the gateway derives the owner container from the persisted KB relation and requires a non-tombstoned resource with a digest in `QUEUED` or `PROCESSING` before Blob Storage access. Treat key exposure as an all-tenant source-read incident and do not describe this boundary as caller-owner authorization.

`packages/prisma/src/prisma/schema/knowledge.prisma:KB.owner` still uses `onDelete: Cascade`. There is no current user hard-delete path, but a future account-deletion or GDPR workflow must drain every KB through the tombstone/external/blob cleanup lifecycle before deleting the User; relying on the database cascade would remove the reconciliation rows and orphan external or Blob state.

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

## Chatbot response examples

`getChatbotResponseExamples` uses `t.withAuth(asUser)`. The
`approveResponseExample`, `editAndApproveResponseExample`, and
`rejectResponseExample` mutations require `t.withAuth(asUserFullAccess)`, so
read-only and session-execution delegated logins cannot modify examples. The
service also scopes every lookup through
`set.chatbot.ownerId = ctx.user.sub`, so another lecturer receives `null` even
if they know the chatbot or example UUID. The mutations return the refreshed set
and digest; they do not create candidates or change evidence eligibility.

The service keeps the lifecycle in one transaction: approve, edit-and-approve,
or reject the current row, then recompute the set digest. Client operations are
`QGetChatbotResponseExamples`, `MApproveResponseExample`,
`MEditAndApproveResponseExample`, and `MRejectResponseExample`.

The response payload exposes the chatbot's available `chatModes`, the
`studentMessage`, Markdown `referenceAnswer`, and `responseStyle` for each
example. It also exposes server-computed action flags and
`hasCompleteEligibleCitationParity`; approval requires every cited index to
have an eligible lineage row. Edit-and-approve requires the row's
`expectedUpdatedAt` value, so stale lecturer forms fail with a coded conflict
instead of overwriting a newer edit. The canonical citation parser lives in
`@klicker-uzh/util/citations` and follows the renderer's Markdown AST semantics,
including exclusions for code, links, math, and HTML.
`@klicker-uzh/markdown/citations` is a compatibility re-export.

## Subscriptions

Field filters over the shared pubSub: `schema/subscription.ts:feedbackCreated` pipes `ctx.pubSub.subscribe('feedbackCreated')` through a `liveQuizId` filter; the publishing side is a service (`services/feedbacks.ts`). Frontends consume via `subscribeToMore` with the generated `S*Document`.

## Worked feature traces

Read-only feature end-to-end: commit `ff61d9bc7` (#4951) — new object type, two query fields, service function, ops + codegen, manage page, i18n. Schema-change + mutation + heavy vitest variant: `38c92d035` (#4958). Step-by-step walkthrough: [Developing a Feature](./developing-a-feature.md).
