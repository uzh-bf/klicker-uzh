# Knowledge Base Catalog v1 (Native-First, Pipeline-Integrated)

## Summary
Build a native Klicker knowledge-base catalog in the existing stack, with owner-only access in v1, manual ingestion triggers, pipeline-owned refresh execution, and many-to-many KB-chatbot schema while enforcing one active KB per chatbot at runtime.

Also include a documented "adapt external tool" track, but not as the primary v1 path.

## Locked Decisions
1. Build strategy: native-first in Klicker, while documenting external-tool variants.
2. Access control v1: owner-only.
3. Entry input v1: URL entries (website URL, PDF/blob URL) plus inline text entries; no direct PDF upload yet.
4. Ingestion trigger v1: manual only.
5. Monitoring model: entry-level refresh policy only; websites support `DAILY|WEEKLY|MONTHLY|YEARLY`, PDF/text use `NONE`.
6. KB-chatbot data model: many-to-many.
7. Runtime behavior v1: max one active KB per chatbot.
8. Milvus collection ID ownership: Klicker defines immutable UUID per KB.
9. Ingestion status tracking: pipeline callback webhook to Klicker.

## Implementation Plan

### 1. Data Model (Prisma)
1. Add `KnowledgeBase` model in `packages/prisma/src/prisma/schema/`.
2. Add `KnowledgeBaseEntry` model.
3. Add join model `ChatbotKnowledgeBase`.
4. Add `KnowledgeBaseSyncJob` model.
5. Extend `User` and `Chatbot` relations in:
   - `packages/prisma/src/prisma/schema/user.prisma`
   - `packages/prisma/src/prisma/schema/chat.prisma`

### 2. GraphQL API (Backend)
1. Add new GraphQL resource types in `packages/graphql/src/schema/resource.ts`:
   - `KnowledgeBase`, `KnowledgeBaseEntry`, `KnowledgeBaseSyncJob`, related enums.
2. Add query fields in `packages/graphql/src/schema/query.ts`:
   - `getKnowledgeBases`
   - `getKnowledgeBase(id)`
   - `getKnowledgeBaseEntries(knowledgeBaseId)`
   - `getKnowledgeBaseSyncJobs(knowledgeBaseId, limit, cursor?)`
3. Add mutation fields in `packages/graphql/src/schema/mutation.ts`:
   - `createKnowledgeBase`, `updateKnowledgeBase`, `deleteKnowledgeBase`
   - `createKnowledgeBaseEntry`, `updateKnowledgeBaseEntry`, `deleteKnowledgeBaseEntry`
   - `attachKnowledgeBaseToChatbot`, `detachKnowledgeBaseFromChatbot`, `setActiveKnowledgeBaseForChatbot`
   - `triggerKnowledgeBaseSync(knowledgeBaseId, entryId?)`
4. Add service layer in `packages/graphql/src/services/knowledgeBases.ts`:
   - owner-only guards.
   - entry validation rules.
   - manual trigger only; create sync job row then call pipeline webhook.
5. Add GraphQL ops files in `packages/graphql/src/graphql/ops/` and regenerate artifacts in implementation phase.

### 3. Pipeline Integration Contract
1. Outbound trigger from GraphQL service:
   - `POST ${KB_PIPELINE_TRIGGER_URL}`.
   - Payload includes `eventId`, `jobId`, `knowledgeBaseId`, `collectionId`, `entryId`, `entryType`, `source`, `refreshInterval`, `requestedBy`.
   - Signed header `X-Klicker-Signature` using HMAC SHA-256 and `KB_PIPELINE_TRIGGER_SECRET`.
2. Inbound callback endpoint in backend app:
   - Add express route in `apps/backend-docker/src/app.ts`:
     - `POST /api/webhooks/knowledge-base-sync`.
   - Verify HMAC via `KB_PIPELINE_CALLBACK_SECRET`.
   - Idempotent upsert by `eventId`.
   - Update `KnowledgeBaseSyncJob` and denormalized entry sync state.
3. Callback payload (required fields):
   - `eventId`, `jobId`, `status`, `knowledgeBaseId`, optional `entryId`, optional `error`, optional `stats`.
4. Failure handling:
   - Invalid signature: `401`.
   - Unknown `jobId` with known `eventId`: idempotent `200`.
   - Unknown `jobId` and unknown `eventId`: `404` + structured error log.

### 4. Chat Runtime Integration
1. Keep MCP/RAG architecture intact; only add active KB context.
2. In `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`:
   - Load active KB attachment and collection ID.
   - Pass collection ID as additional request header for MCP calls.
3. In `apps/chat/src/services/mcpClients.ts`:
   - Extend header builder to accept optional dynamic header `X-KB-Collection-Id`.
4. Runtime constraint:
   - API rejects chat requests when multiple active KB attachments exist (defensive check), even though DB/index should prevent it.

### 5. Manage UI
1. Add resources page:
   - `apps/frontend-manage/src/pages/resources/knowledgeBases.tsx`.
2. Add resources components:
   - `apps/frontend-manage/src/components/resources/KnowledgeBases.tsx`
   - subcomponents for list, details, entry form, attachment management, sync jobs.
3. Add header menu item (privatePreview-gated like chatbots):
   - `apps/frontend-manage/src/components/common/Header.tsx`.
4. UX flow:
   - create KB.
   - add entries (Website URL / PDF URL / Text).
   - configure entry refresh interval.
   - attach KB to chatbot.
   - manually trigger sync and monitor status timeline.
5. i18n:
   - add keys in `packages/i18n/messages/en.ts` and `packages/i18n/messages/de.ts`.

### 6. Deferred v1.1+ Items
1. Direct PDF upload in KB UI by extending existing SAS flow.
2. Sharing support by integrating KB into permission/object-sharing framework.
3. Multi-active KB retrieval for chatbot once RAG supports querying multiple collections.

## Public API and Interface Changes
1. New Prisma models and enums: `KnowledgeBase`, `KnowledgeBaseEntry`, `ChatbotKnowledgeBase`, `KnowledgeBaseSyncJob`, plus related enums.
2. New GraphQL types, queries, and mutations for KB CRUD, entry CRUD, attachments, and manual sync.
3. New HTTP webhook endpoint:
   - `POST /api/webhooks/knowledge-base-sync`.
4. New environment variables:
   - `KB_PIPELINE_TRIGGER_URL`
   - `KB_PIPELINE_TRIGGER_SECRET`
   - `KB_PIPELINE_CALLBACK_SECRET`
   - `KB_PIPELINE_REQUEST_TIMEOUT_MS` (defaulted in code)

## External Tool Variant Track (Documented, Not Primary)
1. OpenMetadata
   - Fit: strong metadata/catalog platform, broad connectors.
   - Tradeoff: likely broader and heavier than v1 needs.
2. Backstage Catalog
   - Fit: extensible entity model and plugin ecosystem.
   - Tradeoff: strong for internal developer portals; higher setup overhead for this use case.
3. CKAN
   - Fit: mature open-data catalog.
   - Tradeoff: oriented to dataset publishing, less aligned with chatbot KB attachment workflows.
4. Dify
   - Fit: built-in knowledge-base and RAG workflows.
   - Tradeoff: overlaps heavily with your dedicated ingestion pipeline and existing chatbot architecture.
5. Directus
   - Fit: fast admin UI on custom tables.
   - Tradeoff: core domain logic still must be implemented in Klicker.

## Test Cases and Scenarios
1. Prisma/data integrity:
   - create/update/delete KB and entries.
   - enforce one active KB per chatbot.
   - immutable `collectionId`.
2. GraphQL auth/validation:
   - owner-only access to KBs and entries.
   - reject invalid entry payload combinations.
   - reject non-`NONE` refresh intervals for PDF/TEXT.
3. Manual sync trigger:
   - mutation creates sync job and sends webhook payload.
   - network failure transitions job to failed state with error.
4. Callback webhook:
   - valid signature updates job/entry status.
   - duplicate callback `eventId` is idempotent.
   - invalid signature returns `401` and no mutation.
5. Chat runtime:
   - when KB attached, MCP request includes `X-KB-Collection-Id`.
   - when no active KB attached, header omitted and request still works.
6. Frontend:
   - create/edit/delete KB and entry flows.
   - attach/detach and active-assignment behavior on chatbot.
   - sync status timeline refresh and error rendering.
7. End-to-end:
   - KB created, entry added, manual sync triggered, callback marks success, chatbot asks question with attached KB context.
8. Regression:
   - existing chatbots, catalog, answer collections, and media library workflows remain unaffected.

## Assumptions and Defaults
1. Pipeline supports callback webhook with stable `jobId` and `eventId`.
2. Pipeline accepts Klicker-owned `collectionId` UUID as target collection key.
3. URL reachability/content parsing are pipeline responsibilities, not validated deeply by Klicker.
4. Owner-only v1 intentionally excludes sharing flows.
5. Refresh scheduling execution is fully pipeline-owned; Klicker stores policy metadata only.
6. Direct PDF upload is explicitly out of v1 and planned as follow-up.

## Next Steps
1. Create Prisma schema plus migration for `KnowledgeBase`, `KnowledgeBaseEntry`, `ChatbotKnowledgeBase`, and `KnowledgeBaseSyncJob`.
2. Add GraphQL queries/mutations and service layer for KB CRUD, attachments, and manual sync trigger.
3. Implement pipeline trigger and callback webhook endpoint with HMAC verification and idempotency.
4. Build the Manage UI under `/resources/knowledgeBases` and wire chatbot attachment controls.
