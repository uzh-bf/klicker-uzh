# KB Backend Module Plan

## Summary
Build the Klicker knowledge-base backend as a clean GraphQL/control-plane module around the new `KB*` Prisma schema. Klicker owns catalog state, resource metadata, links to courses/chatbots, refresh policies, and webhook dispatch/receipt. External services own scraping, parsing, chunking, vector-store writes, and knowledge-graph processing.

The backend should follow existing conventions in `packages/graphql`: Pothos object/input definitions in `schema/*.ts`, business logic in `services/*.ts`, root fields in `query.ts` / `mutation.ts`, operation documents in `graphql/ops`, and generated `ops.ts` / persisted-query artifacts through GraphQL codegen.

## Locked Decisions
1. Model names and enums use the `KB` prefix.
2. Resource kinds are fixed by Klicker backend logic: `DOCUMENT`, `WEBSITE`, `SNIPPET`, `KLICKER_OBJECT`.
3. Metadata is Klicker-defined typed JSON, not lecturer-defined metadata schemas.
4. V1 authorization is owner-only for KBs; course/chatbot links are consumer/visibility links, not permission grants.
5. Klicker does not parse, scrape, ingest, embed, or generate graph data.
6. Resource CRUD emits webhooks to the ingestion pipeline.
7. Catalog changes can also emit webhooks to the knowledge-graph service when graph inclusion rules say the resource is graph-relevant.
8. Incoming webhooks update only control-plane state: statuses, progress, freshness, metrics, external IDs, and website subresources.
9. Graph node/edge data and graph APIs belong to a separate knowledge-graph service.

## Module Boundaries

### Klicker KB Backend Owns
- `KB`, `KBResource`, `KBWebsiteSubresource`, `KBIngestionRun`, `KBCourse`, `KBChatbot` CRUD.
- Source identifiers for all fixed resource kinds.
- Typed KB/resource metadata validation.
- Resource refresh/freshness state.
- Graph inclusion policy and graph inclusion evaluation.
- Outgoing resource CRUD webhook dispatch to ingestion and graph services.
- Incoming ingestion status webhooks.
- Idempotency and retry visibility for webhooks.

### Ingestion Pipeline Owns
- URL crawling/scraping.
- Document download/parsing.
- Snippet normalization/chunking.
- Klicker-object content extraction if the source is a Klicker object identifier.
- Chunk creation/deletion.
- Vector-store writes/deletes.
- Derived ingestion metrics.

### Knowledge Graph Service Owns
- Graph extraction and storage.
- Graph node/edge APIs.
- Graph visualization data.
- Graph-specific processing based on catalog resource events and/or ingestion outputs.

## Schema Follow-Up

The current `KB*` schema is the right control-plane base, but the backend implementation should add a small follow-up migration before webhook logic is built.

### Add Resource Deletion State
Add soft deletion to `KBResource`:

- `deletedAt DateTime?`
- `deletedById String? @db.Uuid`
- optional relation to `User` for `deletedBy`

Reason: resource deletion must be durable long enough for webhook retry and external cleanup. Hard deletion can happen later through a cleanup job after external services acknowledge deletion.

### Add Webhook Event Ledger
Add `KBWebhookEvent`:

- `id String @id @default(uuid()) @db.Uuid`
- `eventId String @unique`
- `direction KBWebhookDirection`
- `eventType String`
- `status KBWebhookStatus`
- `destination KBWebhookDestination`
- `payload Json`
- `attempts Int @default(0)`
- `lastError String? @db.Text`
- `lastAttemptAt DateTime?`
- `deliveredAt DateTime?`
- `kbId String? @db.Uuid`
- `resourceId String? @db.Uuid`
- `ingestionRunId String? @db.Uuid`
- timestamps

Enums:
- `KBWebhookDirection`: `OUTGOING`, `INCOMING`
- `KBWebhookStatus`: `PENDING`, `DELIVERED`, `FAILED`, `IGNORED`
- `KBWebhookDestination`: `INGESTION`, `GRAPH`

Reason: the CRUD webhook approach needs idempotency, retry tracking, and debugging without overloading `KBIngestionRun`.

### Add Graph Inclusion Policy
Add first-class graph inclusion fields:

- `KB.graphEnabled Boolean @default(false)`
- `KB.graphResourceKinds KBResourceKind[] @default([])`
- `KBResource.graphInclusion KBGraphInclusionMode @default(INHERIT)`

Enum:
- `KBGraphInclusionMode`: `INHERIT`, `INCLUDE`, `EXCLUDE`

Default policy:
- `graphEnabled = false`
- `graphResourceKinds = []`
- For course KBs, the host can enable graph mode and set default kinds to `[DOCUMENT]`.

Inclusion helper:

```ts
function isResourceIncludedInGraph(kb, resource) {
  return (
    resource.graphInclusion === 'INCLUDE' ||
    (resource.graphInclusion === 'INHERIT' &&
      kb.graphEnabled &&
      kb.graphResourceKinds.includes(resource.kind))
  )
}
```

Keep `KB.externalGraphId` as an optional pointer only. Do not add graph node/edge tables.

## Backend Files

Add:
- `packages/graphql/src/schema/knowledge.ts`
- `packages/graphql/src/services/knowledge.ts`
- `packages/graphql/src/services/knowledgeMetadata.ts`
- `packages/graphql/src/services/knowledgeWebhooks.ts`
- `packages/graphql/src/graphql/ops/QGetKBs.graphql`
- `packages/graphql/src/graphql/ops/QGetKB.graphql`
- `packages/graphql/src/graphql/ops/MCreateKB.graphql`
- `packages/graphql/src/graphql/ops/MUpdateKB.graphql`
- `packages/graphql/src/graphql/ops/MDeleteKB.graphql`
- `packages/graphql/src/graphql/ops/MCreateKBResource.graphql`
- `packages/graphql/src/graphql/ops/MUpdateKBResource.graphql`
- `packages/graphql/src/graphql/ops/MDeleteKBResources.graphql`
- `packages/graphql/src/graphql/ops/MUpdateKBRefreshPolicy.graphql`
- `packages/graphql/src/graphql/ops/MUpdateKBResourceRefreshPolicy.graphql`
- `packages/graphql/src/graphql/ops/MLinkKBCourse.graphql`
- `packages/graphql/src/graphql/ops/MUnlinkKBCourse.graphql`
- `packages/graphql/src/graphql/ops/MLinkKBChatbot.graphql`
- `packages/graphql/src/graphql/ops/MUnlinkKBChatbot.graphql`

Update:
- `packages/graphql/src/index.ts` to import `./schema/knowledge.js`.
- `packages/graphql/src/schema/query.ts` to register KB query fields.
- `packages/graphql/src/schema/mutation.ts` to register KB mutations.
- `apps/backend-docker` HTTP routing to expose incoming webhook endpoints.
- `turbo.json` `globalEnv` for webhook configuration variables.

## GraphQL Types

Define Pothos enums from Prisma enums:
- `KBStatus`
- `KBResourceStatus`
- `KBResourceKind`
- `KBWebsiteStrategy`
- `KBRefreshMode`
- `KBRefreshScope`
- `KBMetadataProfile`
- `KBIngestionTrigger`
- `KBIngestionStatus`
- `KBGraphInclusionMode`

Object refs:
- `KB`
- `KBResource`
- `KBWebsiteSubresource`
- `KBIngestionRun`
- `KBCourse`
- `KBChatbot`
- `KBWebhookEvent` if exposed to the UI for debugging

Input refs:
- `CreateKBInput`
- `UpdateKBInput`
- `CreateKBResourceInput`
- `UpdateKBResourceInput`
- `KBRefreshPolicyInput`
- `KBResourceRefreshPolicyInput`
- `KBResourceFilterInput`

JSON fields:
- Expose `metadata`, `settings`, `stats`, and webhook `payload` as `Json`.
- Validate JSON shape in services, not in GraphQL scalar logic.

## Query API

Add user-authenticated query fields:

- `getKBs: [KB!]`
  - Returns KBs owned by `ctx.user.sub`, ordered by `updatedAt desc`.
  - Include lightweight counts and linked consumer summaries.

- `getKB(id: String!): KB`
  - Owner-only.
  - Include resources, website subresources for selected/expanded resources, recent ingestion runs, linked courses, and linked chatbots.

- `getKBResources(kbId: String!, filter: KBResourceFilterInput): [KBResource!]`
  - Owner-only.
  - Filter by query, kind, status, graph inclusion, and deletion state.
  - Default excludes `deletedAt != null`.

- `getKBIngestionRuns(kbId: String!, resourceId: String, limit: Int): [KBIngestionRun!]`
  - Owner-only.
  - Useful for status panels and debugging.

- `getKBWebhookEvents(kbId: String!, resourceId: String, limit: Int): [KBWebhookEvent!]`
  - Optional admin/debug query. Can be omitted from the first UI pass if not needed.

## Mutation API

Add user-authenticated mutations:

- `createKB(input: CreateKBInput!): KB`
  - Sets owner to `ctx.user.sub`.
  - Validates `metadata` and `settings` against `metadataProfile`.
  - Emits no external webhook because no resource changed.

- `updateKB(id: String!, input: UpdateKBInput!): KB`
  - Owner-only.
  - Validates metadata/settings.
  - If graph policy changes, emit graph catalog update events for affected graph-included resources.

- `deleteKB(id: String!): Boolean`
  - Owner-only.
  - Soft-delete or hard-delete decision should be explicit before implementation.
  - If hard-deleting, emit `resource.deleted` events for all active resources first and mark webhook events.

- `createKBResource(kbId: String!, input: CreateKBResourceInput!): KBResource`
  - Owner-only.
  - Validates fixed-kind source fields.
  - Creates `KBResource`.
  - Creates `KBIngestionRun(trigger: RESOURCE_CREATED, status: QUEUED)`.
  - Sends ingestion webhook `resource.created`.
  - Sends graph webhook `catalog.resource.created` if graph-included.

- `updateKBResource(resourceId: String!, input: UpdateKBResourceInput!): KBResource`
  - Owner-only via parent KB.
  - Validates fixed-kind source fields.
  - Detects processing-relevant changes.
  - If processing-relevant fields changed, creates `KBIngestionRun(trigger: RESOURCE_UPDATED, status: QUEUED)` and sends ingestion webhook `resource.updated`.
  - Sends graph webhook `catalog.resource.updated` if graph inclusion applies or changed.

- `deleteKBResources(resourceIds: [String!]!): Boolean`
  - Owner-only for all resources.
  - Sets `deletedAt`, status `DISABLED`, and optionally `deletedById`.
  - Creates `KBIngestionRun(trigger: RESOURCE_UPDATED, status: QUEUED)` or a deletion-specific event row.
  - Sends ingestion webhook `resource.deleted`.
  - Sends graph webhook `catalog.resource.deleted` if graph-included before deletion.

- `updateKBRefreshPolicy(kbId: String!, input: KBRefreshPolicyInput!): KB`
  - Owner-only.
  - Validates mode/scope/interval/cron combinations.
  - Does not trigger immediate ingestion unless explicitly requested later.

- `updateKBResourceRefreshPolicy(resourceId: String!, input: KBResourceRefreshPolicyInput!): KBResource`
  - Owner-only via parent KB.
  - Validates override.
  - Recomputes `nextRefreshAt` if applicable.

- `linkKBCourse(kbId: String!, courseId: String!): KB`
  - Owner-only KB.
  - Verify the user owns or can administer the course using existing sharing helpers where applicable.

- `unlinkKBCourse(kbId: String!, courseId: String!): KB`
  - Owner-only KB.

- `linkKBChatbot(kbId: String!, chatbotId: String!, isEnabled: Boolean, priority: Int): KB`
  - Owner-only KB.
  - Verify chatbot ownership.

- `unlinkKBChatbot(kbId: String!, chatbotId: String!): KB`
  - Owner-only KB.

- `dispatchKBResourceWebhook(resourceId: String!, destination: KBWebhookDestination): KBWebhookEvent`
  - Optional admin/manual retry mutation; can be deferred if no UI needs it.

## Fixed Resource Validation

Use service-level validation in `knowledge.ts` / `knowledgeMetadata.ts`, preferably with `zod`.

Common:
- `title` required and non-empty.
- `metadata` must match Klicker-owned typed shape.
- `refreshMode` rules:
  - `INHERIT`: no interval/cron required.
  - `MANUAL`: no automatic `nextRefreshAt`.
  - `INTERVAL`: `refreshIntervalMinutes > 0`.
  - `CRON`: `refreshCron` required.
  - `DISABLED`: clears automatic refresh.

`DOCUMENT`:
- Requires either `mediaFileId`, `externalResourceId`, or another storage identifier supported by the implementation.
- Does not accept website/snippet/Klicker-object fields.
- File upload/SAS is out of this backend pass unless explicitly added.

`WEBSITE`:
- Requires `websiteUrl`.
- Requires `websiteStrategy`.
- `SCRAPE_SUBSITES` may carry sitemap/subsite status once reported by ingestion.
- `REFERENCE_ONLY` should still be sent to ingestion/graph as a catalog reference if needed, but ingestion must not scrape content.

`SNIPPET`:
- Requires `snippetText`.
- Server derives `snippetCharacterCount`.
- No website/document/internal FK fields.

`KLICKER_OBJECT`:
- Requires exactly one of:
  - `elementId`
  - `practiceQuizId`
  - `liveQuizId`
  - `microLearningId`
  - `groupActivityId`
  - `answerCollectionId`
  - `mediaFileId`
- Verify object ownership/access before linking.

## Metadata Validation

Klicker defines metadata profiles in code, not in the database.

Implement profile validators for:
- `COURSE_KB`
- `AI_BUDDY`
- `AI_INFRA`

Typed values live in `packages/types/src/kb.ts` and are registered as Prisma JSON types. Backend validation should enforce:
- allowed `studyLevel` values.
- allowed `scope` values.
- strings for faculty/department/language/course ids.
- arrays for audience/tags/retrieval tags.
- no arbitrary top-level fields except `custom` if deliberately supported.

The reusable UI package can still receive generic metadata schema props. `frontend-kb` maps Klicker metadata profiles to UI field definitions.

## Webhook Dispatch

Create `knowledgeWebhooks.ts` with a small dispatcher abstraction.

Environment variables:
- `KB_INGESTION_WEBHOOK_URL`
- `KB_INGESTION_WEBHOOK_SECRET`
- `KB_GRAPH_WEBHOOK_URL`
- `KB_GRAPH_WEBHOOK_SECRET`
- `KB_WEBHOOK_TIMEOUT_MS`
- `KB_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`

Add all used variables to `turbo.json` `globalEnv`.

Outgoing behavior:
1. Build payload from the persisted KB/resource state.
2. Create `KBWebhookEvent(status: PENDING, direction: OUTGOING)`.
3. Sign payload with HMAC SHA-256.
4. Send HTTP `POST`.
5. Mark event `DELIVERED` or `FAILED`.
6. If dispatch fails, keep catalog mutation committed and expose failure through `KBWebhookEvent` / run status.

Headers:
- `X-Klicker-Event-Id`
- `X-Klicker-Event-Type`
- `X-Klicker-Timestamp`
- `X-Klicker-Signature`

Signature input:
- `${timestamp}.${rawBody}`

Signature:
- `hex(hmacSha256(secret, signatureInput))`

## Outgoing Ingestion Events

Event types:
- `resource.created`
- `resource.updated`
- `resource.deleted`

Payload:

```ts
type KBIngestionResourceEvent = {
  eventId: string
  eventType: 'resource.created' | 'resource.updated' | 'resource.deleted'
  occurredAt: string
  kb: {
    id: string
    metadataProfile: string
    metadata: unknown
    externalNamespaceId?: string | null
    externalVectorStoreId?: string | null
  }
  resource: {
    id: string
    kind: string
    title: string
    metadata: unknown
    refreshPolicy: unknown
    source: {
      url?: string | null
      text?: string | null
      mediaFileId?: string | null
      externalResourceId?: string | null
      klickerObject?: {
        type: string
        id: string | number
      } | null
    }
  }
  ingestionRun?: {
    id: string
    trigger: string
  }
}
```

The ingestion pipeline decides what to scrape, parse, chunk, index, update, or remove based on the event and source identifier.

## Outgoing Graph Events

Event types:
- `catalog.resource.created`
- `catalog.resource.updated`
- `catalog.resource.deleted`

Payload should mirror the catalog/resource parts of the ingestion payload and add:

```ts
graph: {
  graphEnabled: boolean
  graphIncluded: boolean
  externalGraphId?: string | null
}
```

Only dispatch graph events when:
- the KB graph policy is enabled and the resource is included, or
- an update changes graph inclusion from included to excluded or excluded to included, or
- the event is a deletion of a previously graph-included resource.

The graph service decides whether it can act immediately or must wait for ingestion outputs.

## Incoming Ingestion Webhooks

Add HTTP endpoint in `apps/backend-docker`, not GraphQL:

- `POST /api/webhooks/kb-ingestion`

Incoming event types:
- `resource.processing_started`
- `resource.processing_progress`
- `resource.processing_succeeded`
- `resource.processing_failed`
- `resource.subresources_updated`
- `kb.metrics_updated`

Rules:
- Verify HMAC signature against `KB_INGESTION_WEBHOOK_SECRET`.
- Reject invalid signature with `401`.
- Reject stale timestamp with `401`.
- Use `eventId` idempotency through `KBWebhookEvent`.
- Unknown resource/KB should return `404` unless the event id was already processed.
- Never create resources from incoming webhook payloads; resources must originate from catalog CRUD.

Updates allowed:
- `KBResource.status`
- `KBResource.progress`
- `KBResource.statusDetail`
- freshness timestamps
- `externalResourceId`
- `externalIndexId`
- hashes
- counts
- website subresources
- `KB` aggregate metrics
- `KBIngestionRun.status`, timestamps, stats, errors

## Ingestion Run Semantics

`KBIngestionRun` is a local control-plane attempt record, not proof that Klicker is doing ingestion.

Create runs for:
- resource created
- processing-relevant resource update
- resource deletion
- manual retry/redispatch
- later scheduled refreshes

Status transitions:
- `QUEUED`: created locally before webhook dispatch.
- `RUNNING`: incoming `processing_started`.
- `SUCCEEDED`: incoming `processing_succeeded`.
- `FAILED`: outgoing dispatch failed permanently or incoming `processing_failed`.
- `CANCELLED` / `SKIPPED`: reserved for later service events.

If webhook dispatch fails immediately:
- mark `KBWebhookEvent` as `FAILED`.
- either keep `KBIngestionRun` as `QUEUED` for retry or mark `FAILED` with dispatch error. Recommended v1 default: mark `FAILED` and expose manual retry.

## Access Control

Owner-only v1:
- All KB queries/mutations filter by `KB.ownerId = ctx.user.sub`.
- Resource access goes through parent KB ownership.
- Webhook endpoints authenticate by HMAC, not user session.

Course links:
- Verify the user owns or has admin/write access to the target course before linking.
- Do not grant KB access to other users through course links.

Chatbot links:
- Verify `Chatbot.ownerId = ctx.user.sub`.
- Do not grant KB access through chatbot links.

No changes in v1:
- `Permission`
- `DerivedPermission`
- `AccessRequest`
- catalog assignments
- activity/audit log object types

## Error Handling

Service functions should return `null` only where existing GraphQL convention expects nullable objects for not found/unauthorized cases. Validation failures should throw clear `Error` / `GraphQLError` messages.

Recommended messages:
- `Knowledge base not found`
- `Resource not found`
- `Invalid KB metadata`
- `Invalid KB resource metadata`
- `Invalid resource source for kind`
- `Exactly one Klicker object reference is required`
- `Webhook dispatch failed`

Webhook endpoint responses:
- `200`: accepted or duplicate already processed.
- `400`: malformed payload.
- `401`: invalid signature/timestamp.
- `404`: referenced KB/resource/run does not exist.
- `500`: unexpected processing error.

## GraphQL Operations

Generate operations for `frontend-kb`:
- `QGetKBs`
- `QGetKB`
- `QGetKBResources`
- `MCreateKB`
- `MUpdateKB`
- `MDeleteKB`
- `MCreateKBResource`
- `MUpdateKBResource`
- `MDeleteKBResources`
- `MUpdateKBRefreshPolicy`
- `MUpdateKBResourceRefreshPolicy`
- `MLinkKBCourse`
- `MUnlinkKBCourse`
- `MLinkKBChatbot`
- `MUnlinkKBChatbot`

Run GraphQL codegen after adding these:

```bash
pnpm --filter @klicker-uzh/graphql generate
```

Commit generated:
- `packages/graphql/src/ops.ts`
- `packages/graphql/src/ops.schema.json`
- `packages/graphql/src/public/schema.graphql`
- `packages/graphql/src/public/client.json`
- `packages/graphql/src/public/server.json`

## Frontend Integration Notes

The backend should return data in a shape that `apps/frontend-kb` can map into `@klicker-uzh/kb-management` props.

Mapping examples:
- `KB` -> `KnowledgeBaseSummary`
- `KBResource` -> `KnowledgeResource`
- `KBWebsiteSubresource` -> `WebsiteSubsiteSummary`
- `KBIngestionRun` -> `IngestionRunSummary`

Do not move package-specific UI types into the backend. Keep the GraphQL API domain-oriented and map in `frontend-kb`.

Graph tab:
- Remains demo-only or calls the future graph service.
- KB backend should not expose graph nodes/edges.

## Implementation Order

1. Add schema follow-up migration for soft deletion, webhook ledger, and graph inclusion policy.
2. Regenerate Prisma client.
3. Add typed JSON extensions if webhook payload/status JSON needs stronger types.
4. Add `schema/knowledge.ts` GraphQL object/input/enum refs.
5. Import `schema/knowledge.ts` from `packages/graphql/src/index.ts`.
6. Add `services/knowledgeMetadata.ts`.
7. Add `services/knowledgeWebhooks.ts`.
8. Add `services/knowledge.ts` with owner guards, validation, CRUD, links, refresh policies, and webhook dispatch calls.
9. Register query fields in `schema/query.ts`.
10. Register mutation fields in `schema/mutation.ts`.
11. Add incoming webhook endpoint in `apps/backend-docker`.
12. Add GraphQL operation files for `frontend-kb`.
13. Run codegen and checks.
14. Wire `apps/frontend-kb` from demo data to GraphQL data.

## Test Plan

### Schema and Codegen
- `pnpm --filter @klicker-uzh/prisma generate`
- `pnpm --filter @klicker-uzh/graphql generate`
- `pnpm --filter @klicker-uzh/prisma check`
- `pnpm --filter @klicker-uzh/graphql check`

### Service Validation
Add focused tests if practical for:
- KB metadata profile validation.
- resource metadata validation.
- fixed-kind source validation.
- graph inclusion helper.
- refresh policy validation.
- owner-only guards.

### Webhook Tests
Test with mocked HTTP server or service-level dispatcher mock:
- create resource emits ingestion CRUD event.
- update with processing-relevant fields emits update event.
- update with display-only fields does not emit ingestion event unless graph inclusion changed.
- delete emits ingestion delete and graph delete when applicable.
- dispatch failure records `KBWebhookEvent(status: FAILED)`.
- incoming duplicate event id is idempotent.
- invalid signature returns `401` and writes no state.

### GraphQL Scenarios
- user can list only owned KBs.
- user can create/update/delete own KB.
- user cannot read/update another user's KB.
- user can create each fixed resource kind with valid input.
- invalid kind-specific source combinations are rejected.
- course/chatbot links require ownership/access.
- refresh policies update expected fields.

### Frontend Verification
After GraphQL wiring in `frontend-kb`:
- app loads KB list from backend.
- selecting KB/resource works.
- resource create/update/delete flows update the table.
- status/progress updates from mocked incoming webhook appear in UI.
- desktop and mobile views verified with `npx agent-browser`.

## Deferred Items
1. Actual ingestion pipeline implementation.
2. Graph service implementation and graph tab wiring.
3. Direct document upload/SAS flow.
4. Scheduled refresh executor.
5. Webhook retry worker/backoff.
6. Sharing/catalog permission integration.
7. Audit/activity log integration.
8. Hard-delete cleanup job for soft-deleted resources after external acknowledgment.

## Open Implementation Defaults
1. Use owner-only access checks in service functions rather than adding KB to generic sharing tables.
2. Use HMAC SHA-256 signatures for all webhook traffic.
3. Use `KBWebhookEvent` as the durable idempotency and delivery log.
4. Use soft deletion for resources so external cleanup can be retried.
5. Dispatch ingestion and graph webhooks independently; one service failing should not hide the other service's dispatch result.
6. Treat graph inclusion as first-class catalog state, not as generic metadata.
