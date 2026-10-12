# PLAN: doc-query scoped MCP integration (Scope Token + Knowledge Sources)

Date: 2026-07-12

Status: DRAFT FOR REVIEW. Planning only. No implementation, no migration, no seed change.

## Identity

| Field | Value |
| --- | --- |
| Plan | `project/plans_future/PLAN-doc-query-scoped-mcp-integration.md` |
| Repository | `klicker-uzh` (branch `v3`) |
| Worktree | `trees/doc-query-scoped-mcp` (branch `docs/doc-query-scoped-mcp-plan`) |
| Parent plan | deployment `project/2026-07-12-mr-287-producer-neutral-runtime-config-plan-v2.md` (worktree `deployment/trees/doc-query-runtime-config-dev`) |
| Builds on | **PR #5078** `feat(kb): add knowledge base management control plane` (OPEN, `codex/kb-management-ui` → `v3-ai`) — KB Prisma models, GraphQL CRUD, webhook receiver, `frontend-kb` app |
| Supersedes in part | `project/KB_PLAN.md` and PR #5078's outgoing-ingestion-webhook mechanics (see "Relationship to KB_PLAN.md and PR #5078") |
| Adjacent PRs | #5109 (manage assistant; touches the same chat route, targets `v3-ai`), #5116 (FalkorDB graph — consumer of PR #5078's GRAPH webhooks, untouched here), #4932 (merged; dynamic MCP tools foundation) |
| Depends on | PR #5078 merge (or explicit fallback, Open Question 5), `mcp-doc-query` v3 adapter release (umbrella Slice 2), `data-ingestion` resource API (umbrella Slice 4), deployment dynamic workload (umbrella Slice 6) |

## Summary

Klicker chatbots will query one shared, deployment-configured doc-query MCP endpoint through a
single stable tool (`doc_query`). Tenant isolation moves from per-course static tool configs to a
short-lived signed **Scope Token** (ES256 JWT with a **`kb_id`** claim) that Klicker mints per
chat request; doc-query verifies it and injects a mandatory `kb_id` retrieval filter server-side.
The scope unit is the **Knowledge Base** from PR #5078 (`KB`/`KBResource`/`KBChatbot` control
plane), not the chatbot: chunks are stamped with the KB they belong to, so re-linking a KB to a
different chatbot never requires re-ingestion. Lecturers manage **Knowledge Sources**
(`KBResource` rows: uploads and URLs) in the PR #5078 KB manager; Klicker submits them to the
producer-neutral data-ingestion resource API; ingestion is asynchronous with signed status
webhooks plus polling repair. Klicker builds no vector store, no chunking, no embeddings, and
never chooses a Milvus collection.

> **Scope pivot: CONFIRMED by user ruling 2026-07-12** (umbrella "User rulings" 5, amending D2).
> With a first-class KB entity linked many-to-many to chatbots (`KBChatbot`), `chatbot_id`
> stamping would make KB↔chatbot re-linking impossible without re-ingest; therefore claim =
> `kb_id`, chunk metadata = `kb_id`, v3 block `token_scope`. Also ruled: Milvus partition-key
> tenancy on `kb_id` from day one (umbrella D9 amendment — platform-side; Klicker still never
> names collections).

## Current state (verified, file:line)

Chat and MCP:

- Chat loop: `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` — participant cookie auth
  via `withChatbotAuth` (line 667; `apps/chat/src/lib/server/apiGuards.ts:86-113` checks
  `Participation` for the chatbot's course), loads `Chatbot` + `mcpConfigurations` (lines
  791-806), aggregates tools (line 882), `streamText(..., stopWhen: stepCountIs(5))` (line 1269).
- MCP clients: `apps/chat/src/services/mcpClients.ts` — one client per server **per request**
  (`createMCPClient` at line 144; `new StreamableHTTPClientTransport(new URL(server.url),
  { requestInit: { headers } })` at lines 155-158, via `@ai-sdk/mcp@0.0.13` /
  `@modelcontextprotocol/sdk@1.17.5`).
  `createAuthHeaders(server, chatbotId)` (line 90) supports `bearer|basic|custom|none` static auth
  plus the optional **plain-text `Chatbot-ID` header** (`passChatbotId`/`chatbotIdHeader`, lines
  98-103) — the only chatbot context sent today, unsigned and spoofable by any client that can
  reach the pod. Tool filtering `isToolAllowed` (lines 178-192, empty allowlist = allow all);
  renaming `toSafeToolName` → `KB_doc_query` (lines 56-85).
- Known drift: `apps/chat/src/components/tools-ui/rag-tool-ui.tsx:18` matches `'KB.doc_query'`
  (dot), but `toSafeToolName` emits `KB_doc_query` (underscore) — the RAG tool card is likely not
  rendering for MCP results.
- Seeds: `packages/prisma-data/src/data/seedMCPServers.ts:23-70` — server `KB` →
  `http://localhost:1417/mcp`, `authType: 'none'`, `passChatbotId: true`; configs for
  `tutor`/`explainer` with `allowedTools: ['doc_query']`. `ChatbotMCPServer`/`ChatbotMCPConfig`
  rows are seed-/DB-only; no GraphQL mutations exist for them.

Models (`packages/prisma/src/prisma/schema/chat.prisma`):

- `Chatbot` (line 96): uuid id, systemPrompts, credit*, modelSelection/allowedModelIds,
  openaiApiKey/BaseUrl (encrypted), ownerId, courseId. No knowledge-source relation.
- `ChatbotMCPServer` (line 141): unique name, url, authType, authSecret (encrypted),
  passChatbotId, chatbotIdHeader, parameters, isActive.
- `ChatbotMCPConfig` (line 164): chatbotId + mcpServerId + chatMode unique, allowedTools Json,
  priority, isEnabled.

KB control plane (PR #5078, OPEN, `codex/kb-management-ui` → `v3-ai`; verified against the branch):

- Prisma (`packages/prisma/src/prisma/schema/knowledge.prisma`, migration
  `20260426155500_kb_schema`): `KB` (uuid id, status, `metadataProfile
  COURSE_KB|AI_BUDDY|AI_INFRA`, typed JSON metadata/settings, `externalNamespaceId`/
  `externalVectorStoreId`/`externalGraphId` pointers, graph policy `graphEnabled`+
  `graphResourceKinds`, counters, `refreshIntervalMinutes`, ownerId); `KBResource` (kind
  `DOCUMENT|WEBSITE|SNIPPET|KLICKER_OBJECT`, status `KBStatus`, `externalResourceId String?`
  **written from incoming webhook payloads**, websiteUrl/strategy, snippetText, optional FK links
  to Element/quizzes/AnswerCollection/MediaFile, soft delete `deletedAt`/`deletedById`);
  `KBIngestionRun` (status `QUEUED|RUNNING|SUCCEEDED|FAILED`, startedAt/finishedAt/errorMessage);
  `KBWebhookInbox` (eventId PK idempotency ledger, payload persisted only outside production);
  `KBCourse`; `KBChatbot` (M:N, `priority`, `isEnabled`).
- GraphQL (`packages/graphql/src/services/knowledge.ts`, `schema/knowledge.ts`): owner-only
  (`asUserFullAccess` + ownerId equality) CRUD — create/update/deleteKB,
  create/update/deleteKBResource(s), refresh-policy mutations, link/unlinkKBCourse,
  link/unlinkKBChatbot, getKBs/getKB/getKBResources/getKBIngestionRuns. Typed metadata validation
  in `services/knowledgeMetadata.ts`; tests in `test/knowledge.test.ts`.
- Webhooks (`packages/graphql/src/services/knowledgeWebhooks.ts`): **outgoing** fire-and-forget
  `dispatchKBWebhook` to destinations `INGESTION` (`KB_INGESTION_WEBHOOK_URL`/`_SECRET`) and
  `GRAPH` (`KB_GRAPH_WEBHOOK_URL`/`_SECRET`), events `resource.created|updated|deleted` (+
  `catalog.*`), 5 s timeout, **no outbox/retry** (`KBWebhookEvent` ledger is listed as follow-up in
  `project/KB_BACKEND.md`, not implemented); **incoming** `POST /api/webhooks/kb-ingestion` in
  `apps/backend-docker/src/app.ts` (express.raw 2 MiB) — HMAC-SHA256 hex over
  `` `${timestamp}.${rawBody}` `` with headers `X-Klicker-Event-Id/-Event-Type/-Timestamp/
  -Signature`, 300 s tolerance (`KB_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS`), timing-safe compare,
  `KBWebhookInbox` dedup, then maps events `resource.processing_started|progress|succeeded|failed`,
  `resource.subresources_updated`, `kb.metrics_updated` onto `KBResource.status`/metadata/
  `externalResourceId` and `KBIngestionRun` status in one transaction.
- UI: reusable `@klicker-uzh/kb-management` React package + new `apps/frontend-kb` Next.js app
  (port 3005, `kb.klicker.stg.df-app.ch` in `deploy/env-uzh-stg/values.yaml`, helm templates
  included). Explicitly **out of scope in the PR**: real upload storage/SAS, any ingestion
  execution, sharing beyond owner-only.

Auth, storage, jobs:

- JWT: `packages/util/src/jwt.ts` — jose, **HS256 only** (`signJWT`/`verifyJWT`), shared
  `APP_SECRET` (also derives the AES key in `packages/util/src/crypto.ts:5-13`). No asymmetric
  keys, no JWKS, and no short-TTL service-token minting precedent anywhere — Scope Token minting
  is new code.
- Uploads: Azure Blob SAS, image-only, per-user container
  (`packages/graphql/src/services/elements.ts:1109-1168`, `getFileUploadSas`, 15-min write-only
  SAS; env `BLOB_STORAGE_ACCOUNT_NAME`/`BLOB_STORAGE_ACCESS_KEY`; `MediaFile` model).
- Hatchet: `@hatchet-dev/typescript-sdk@1.9.4`; `packages/hatchet/src/index.ts`
  (`prepareHatchetTasks`) + `apps/hatchet-worker-general` (env-selected workflows, cron
  precedent) + `apps/hatchet-worker-response-processor` (durable tasks, concurrency groups).
- No inbound webhook receiver is merged to base `v3` (only outbound Teams notifications) —
  PR #5078 adds the first one (see above).
- Ownership checks: chatbots use direct `ownerId` equality
  (`packages/graphql/src/services/chatbots.ts:341-345`); the `SharingService`/`DerivedPermission`
  system exists but chatbots do not participate.

Deployed context (from the deployment repo):

- Klicker chat connects **directly** to the doc-query pod service (not LiteLLM):
  `http://mcp-doc-query-pipeline.{stg,prd}-klicker-pipelines.svc.cluster.local:1417/mcp/`.
- Legacy: one consolidated static doc-query workload per env with per-course tool configs
  (29 files STG / 27 PRD; PRD omits vorkurs from the ConfigMap file list) on old images
  (`v0.2.5-arm` STG / `v0.3.0-arm` PRD); per-course LiteLLM aliases exist for non-Klicker
  consumers, including an unfiltered catch-all.

## Relationship to KB_PLAN.md and PR #5078

`project/KB_PLAN.md` (native KB catalog v1, merged as doc via PR #5009) is partially implemented
by **PR #5078**. This plan builds on PR #5078's control plane and replaces only the pieces that
conflict with the producer-neutral umbrella contract.

Adopted from PR #5078 (reuse as-is):

- The entire `KB*` Prisma control plane (`KB`, `KBResource`, `KBIngestionRun`, `KBWebhookInbox`,
  `KBCourse`, `KBChatbot`) — including the two state axes the umbrella demands: operation state on
  `KBIngestionRun`, serving state on `KBResource.status`. Small follow-up migration below.
- Owner-only GraphQL CRUD, typed metadata validation, and the `KBChatbot` M:N link with
  `priority`/`isEnabled` (this becomes the Scope Token resolution input).
- Incoming webhook receiver `POST /api/webhooks/kb-ingestion` + `KBWebhookInbox` idempotency
  ledger + the HMAC scheme (`X-*-Event-Id/-Event-Type/-Timestamp/-Signature`, HMAC-SHA256 over
  `` `${timestamp}.${rawBody}` ``, timing-safe compare, tolerance window). This scheme is proposed
  to the umbrella as THE canonical Operation Status Event envelope so this code lands unchanged
  (header prefix generalized to `X-Ingestion-*`, a one-line rename in the handler).
- `@klicker-uzh/kb-management` package + `apps/frontend-kb` as the lecturer UI surface (replaces
  this plan's earlier ChatbotDetails.tsx section).
- GRAPH webhook dispatch (`KB_GRAPH_WEBHOOK_URL`, consumer PR #5116) — untouched by this plan.

Superseded from PR #5078 (violates or is replaced by the umbrella contract):

- **Outgoing `dispatchKBWebhook(INGESTION, ...)` fire-and-forget CRUD webhooks** — replaced by
  synchronous calls to the producer-neutral ingestion resource API (idempotent, with operation
  ids). Push-webhooks-with-no-retry cannot carry the create/update/delete contract; the
  `KBWebhookEvent` outbox that KB_BACKEND.md defers becomes unnecessary for ingestion (the
  API + reconciliation poll covers it). `KB_INGESTION_WEBHOOK_URL`/outgoing `_SECRET` die.
- **`KBResource.externalResourceId` written from webhook payloads** — inverts the umbrella
  identity model. The External Resource ID is Klicker-owned and equals `KBResource.id`; ingestion
  derives its internal `source_id` from it and never sends an id back for Klicker to store.
  Follow-up migration drops or renames the column (no-go gate: no ingestion-internal ids stored).
- **`KB.externalVectorStoreId`/`externalNamespaceId` as Klicker-set pointers** — Klicker never
  names or selects collections; these stay null under this plan (harmless, may serve other
  metadata profiles later).

Superseded from KB_PLAN.md (unchanged from the previous revision of this plan): per-KB Milvus
collections + Klicker-owned `collectionId`; `X-KB-Collection-Id` MCP header (caller-controlled
scope — forbidden); `KB_PIPELINE_TRIGGER_URL` bespoke trigger.

Gaps PR #5078 leaves that this plan fills: blob upload flow (SAS request/finalize + digest),
ingestion API client, Source Gateway route, Scope Token minting + `scope_token` MCP auth type,
follow-up migration (version/digest columns, operation kind), reconciliation cron, event
vocabulary alignment, rag-tool-ui drift fix, seeds/cutover.

Branch note: PR #5078 targets `v3-ai`; `v3` and `v3-ai` have diverged (7/8 commits each way as of
2026-07-12), and PR #5109 touches the same chat route on `v3-ai`. Implementation slices should
branch from `v3-ai` (Open Question 6).

## Part 1 — Calling the doc-query MCP

### Endpoint and transport

- New `ChatbotMCPServer` row (name e.g. `KB-dynamic` during migration; renamed/canonicalized to
  `KB` after cutover):
  - `url`: `http://mcp-doc-query-dynamic.<env>-klicker-pipelines.svc.cluster.local:1417/mcp/`
    (per environment; cluster-internal, no public ingress).
  - `authType`: new value `scope_token` (see below). `authSecret` unused for this type.
  - `passChatbotId`: `false` — the claim replaces the header. (`Chatbot-ID` header stays supported
    for legacy servers only.)
- Transport unchanged: streamable HTTP via the existing
  `StreamableHTTPClientTransport(..., { requestInit: { headers } })`. Because the client is
  constructed per chat request, one Scope Token minted at construction covers
  initialize → tools/list → tools/call for that request within its TTL.

### Headers

| Header | Value | Source |
| --- | --- | --- |
| `Authorization` | `Bearer <scope token>` | minted per request (below) |
| `Content-Type` | `application/json` | existing default in `createAuthHeaders` |

No `Chatbot-ID`, no collection header, no api key. Anything else the model or client supplies
cannot change the scope: doc-query derives the filter exclusively from the verified claim.

### Scope Token (what we mint)

- Algorithm ES256 (jose `SignJWT`), dedicated keypair per environment — **not** `APP_SECRET`, not
  derived from it. Private key: PKCS8 PEM in env (Infisical-sourced k8s Secret), available to
  `apps/chat` only. Public key: shipped to doc-query as inline PEM + `kid` inside the
  deployment-owned v3 adapter config (two `kid` slots for rotation overlap).
- Claims:

```json
{
  "iss": "<APP origin, e.g. https://chat.klicker.uzh.ch>",
  "aud": "klicker-doc-query-<env>",
  "sub": "<opaque per-session correlation id — never the participant UUID>",
  "iat": 1234567890,
  "exp": 1234568190,
  "jti": "<uuid, audit correlation only>",
  "kb_id": "<KB.id UUID — the retrieval scope>",
  "chatbot_id": "<Chatbot.id UUID — audit only, not used for filtering>"
}
```

Scope resolution at mint time: the chat route loads the chatbot's enabled `KBChatbot` links
ordered by `priority` and takes the top one (KB_PLAN locked decision 7: max one active KB per
chatbot at runtime — enforced here as a defensive pick-one, and ideally by a partial unique index
later). **If no enabled link exists, the dynamic doc-query server is not attached to the request
at all** — no token, no tool, instead of a token with an empty scope. A future multi-KB v2 sends
`kb_ids` (array) and doc-query switches the injected filter from equality to `in`; the v3 config
block already names claim and filter field explicitly, so this is config + adapter change only.

`sub` ruled (2026-07-12): opaque per-session correlation id (e.g. a hash of the conversation id
or a per-request UUID) — participant UUIDs never leave Klicker; correlation back to the
participant happens via Klicker's own logs. No `participantId` threading into token minting.

- TTL: 5 minutes. Header `kid` set to the active key id. `jti` is not one-time-use in v1.
- Minted **after** `withChatbotAuth` has already authorized the participant for the chatbot's
  course — token issuance is downstream of Klicker authorization; doc-query trusts the claim, not
  Klicker session state.
- Streaming caveat (umbrella JWT spike): if a tool call arrives after `exp` on a long chat
  turn, the client re-creates transport/token; spike must confirm FastMCP behavior mid-stream.

### Tool contract

- Server-side tool name: `doc_query` (stable, one per environment; no per-course tools).
- Model-facing name after `toSafeToolName`: `<serverName>_doc_query` (e.g. `KB_doc_query`).
- `ChatbotMCPConfig.allowedTools`: `["doc_query"]` for both `tutor` and `explainer` modes. Do not
  leave it empty (empty = allow-all per `isToolAllowed`); if the dynamic endpoint ever grows a
  second tool, allow-all would leak it to every chatbot silently.
- Arguments (v3 adapter): `question: string` (required). No `kb_id`, no `chatbot_id`, no
  collection, no filter arguments — `filters.runtime_allowed` is `[]` in the v1 adapter, so any
  extra kwargs the model invents are rejected/ignored by doc-query, and the injected scope filter
  cannot be widened, replaced, or nulled by the caller.
- Companion tool `doc_query_chunk_topics` exists server-side under the same scope enforcement; we
  do **not** include it in `allowedTools` v1 (same policy as AI Buddy seeds, which exclude
  `*_chunk_topics`).
- Response: **`documents` mode (ruled 2026-07-12)** — raw scored chunks
  (`{sources: [{reference, reference_type, chunks: [...]}]}`); the chat model composes the
  answer (cheaper, plays to AI-SDK streaming). Consequence: RAG-card rendering against this
  sources shape must be verified in S4 (the card previously assumed the `answer`-mode shape from
  AI Buddy usage). Citation metadata comes from the allowlisted display fields; the private
  Source Gateway URL is never surfaced as a citation. The chat UI renders results via the RAG
  tool card — fix the name drift so it actually matches (see Part 2, item 8). Canary smoke
  validates retrieval quality, not the mode choice.

### mcpClients.ts changes

1. Extend `createAuthHeaders(server, context)` — signature grows from `(server, chatbotId)` to a
   context object `{ chatbotId, kbId, sessionId }`; the route resolves `kbId` from the enabled
   `KBChatbot` links (above); `sessionId` is the opaque correlation id for `sub`.
2. New `authType: 'scope_token'` branch: mint via new `signScopeToken()` util (below) and set
   `Authorization: Bearer <token>`. Existing `bearer|basic|custom|none` branches untouched.
3. Servers with `authType: 'scope_token'` are skipped entirely when `context.kbId` is undefined.
4. Mint is per client construction; no caching, no refresh loop (client lifetime ≪ TTL).

## Part 2 — What Klicker adds

### 1. Asymmetric JWT util (`packages/util`)

- `signScopeToken({ kbId, chatbotId, sessionId })` using jose `SignJWT` with ES256, reading
  env:

| Env var | Meaning |
| --- | --- |
| `DOC_QUERY_SCOPE_PRIVATE_KEY` | PKCS8 PEM, ES256 private key (secret) |
| `DOC_QUERY_SCOPE_KID` | active key id string |
| `DOC_QUERY_SCOPE_ISSUER` | token `iss` (defaults to APP origin env) |
| `DOC_QUERY_SCOPE_AUDIENCE` | token `aud`, e.g. `klicker-doc-query-stg` |

- Key generation documented (openssl / jose `generateKeyPair('ES256')`); public key handed to the
  deployment repo for the v3 adapter config. Rotation: add new key as second `kid` in deployment
  config → roll doc-query → switch Klicker `DOC_QUERY_SCOPE_PRIVATE_KEY`/`KID` → drop old key.
- Existing HS256 helpers untouched.

### 2. Prisma follow-up migration (extends PR #5078's `knowledge.prisma`)

The earlier revision of this plan defined net-new `ChatbotResource`/`IngestionWebhookEvent`
models; both are dropped. PR #5078 already provides the control plane — `KBResource.id` **is**
the External Resource ID, `KBIngestionRun` is the operation axis, `KBResource.status` +
new columns are the serving axis, `KBWebhookInbox` is the replay ledger, `deletedAt` is the
deletion fence. One follow-up migration on top of PR #5078:

```prisma
// KBResource additions (umbrella version/digest fences + blob location)
storagePath           String?  // kind DOCUMENT/SNIPPET: our blob key, never a SAS URL
contentSha256         String?  // expected digest of the current desired version
resourceVersion       Int      @default(1)  // producer-issued, monotonic per resource
activeResourceVersion Int?     // serving state: last version acked as ACTIVE
activeContentSha256   String?
errorCode             String?  // safe error code from ingestion (statusDetail stays free-text)

// KBResource removal/rename
// externalResourceId: DROP (or rename with clear echo-only semantics) — identity is
// KBResource.id, owned by Klicker; ingestion-internal ids are never stored (no-go gate).

// KBIngestionRun additions
operation           KBResourceOperation  // CREATE | UPDATE | DELETE (new enum)
externalOperationId String?  @unique     // ingestion API operation id, set on submit
resourceVersion     Int?                 // version this run is trying to activate
```

- Operation state and serving state stay separate on purpose: a failed update must display both
  "update failed" (latest `KBIngestionRun`) and "still serving v(N)"
  (`activeResourceVersion`) — the umbrella state machine.
- No provider credentials, no ingestion-internal source id, no collection name stored.
  `KB.externalVectorStoreId`/`externalNamespaceId` remain null for `COURSE_KB`.
- Kind mapping to the ingestion API v1 source kinds (`blob|url`): `DOCUMENT` → `blob` (upload
  flow below), `WEBSITE` → `url`, `SNIPPET` → `blob` (normalized text persisted as a small blob so
  versioning/digest semantics are uniform), `KLICKER_OBJECT` → **deferred** (needs a Source
  Gateway content route per object type; not in v1).

### 3. GraphQL surface (`packages/graphql`) — extend PR #5078, don't duplicate

PR #5078's `services/knowledge.ts` CRUD, owner checks, and metadata validation stay. Changes:

- **Rewire, not webhook:** `createKBResource`/`updateKBResource`/`deleteKBResources` stop calling
  `dispatchKBWebhook('INGESTION', ...)` and instead call the ingestion API client (below),
  creating a `KBIngestionRun` (with `operation` + `externalOperationId`) per submitted operation.
  `WEBSITE` resources submit directly on create/update; `DOCUMENT`/`SNIPPET` submit at finalize.
- **New upload flow** (fills the PR's declared "real upload storage/SAS" gap):
  - `requestKBResourceUpload(kbId, { fileName, mimeType, sizeBytes })` — validates MIME/size
    policy (PDF + text v1, cap aligned with the producer-registry limit, e.g. 50 MiB), creates the
    `KBResource` row (kind DOCUMENT, status QUEUED, no run yet), returns a 15-minute write-only
    Azure Blob SAS for the versioned blob key (pattern: extend `getFileUploadSas`,
    `services/elements.ts:1109-1168`, prefix `kb-resources/<kbId>/<resourceId>/v<version>`).
  - `finalizeKBResource(resourceId, { contentSha256 })` — records the client-computed digest,
    sets desired CREATE (or UPDATE with `resourceVersion + 1` on replace), calls the ingestion
    API, stores `externalOperationId`, run status QUEUED. Ingestion independently verifies the
    digest over fetched bytes, so a lying client only fails its own resource.
- **Replace** = `requestKBResourceUpload` against an existing resource id (bumps
  `resourceVersion`; same External Resource ID). A resource's `kbId` is immutable — move =
  delete + create (umbrella rule; matches chunk stamping).
- **Delete**: `deleteKBResources` keeps the PR's soft delete (`deletedAt` = fence), then calls
  ingestion delete; hard cleanup only after ingestion confirms scoped purge (existing
  KB_BACKEND.md intent).
- **New** `retryKBResourceOperation(resourceId)` — re-submits the current desired operation
  idempotently (same idempotency key semantics as the API).
- `getKBResources` already returns status; extend the type with the new serving-state fields.

### 4. Ingestion API client (server-side, `packages/graphql` service layer)

- Base URL `INGESTION_API_URL` (cluster-internal), auth `INGESTION_API_KEY` (static producer key,
  Infisical-sourced; producer id `klicker` in the deployment-owned registry).
- Calls (producer-neutral contract from the umbrella plan): create/update →
  `POST /v1/resources` with `{project_id: "klicker-course-materials", producer: "klicker",
  external_resource_id: <KBResource.id>, resource_version, scope: {kb_id: <KB.id>},
  source: {kind, url: <gateway version URL or public URL>, mime_type, display_name},
  content_sha256}`; delete → by external id + scope; status →
  `GET /v1/operations/{operationId}`.
- Klicker never sends collection names, embedding config, or workflow hints.

### 5. Source Gateway (serving blob bytes to ingestion)

Express route in `apps/backend-docker/src/app.ts` (co-located with the webhook receiver; this app
already signs service JWTs and fronts server-to-server traffic):

- `GET /api/ingestion/resources/:resourceId/versions/:version`
- Auth: static bearer key `INGESTION_GATEWAY_KEY` (held by ingestion, referenced in its producer
  registry as the credential for `source_gateway`). Reject anything else — fail closed.
- Behavior: stream the exact immutable blob for that resource version (`KBResource.storagePath`)
  from Azure Blob using the server-side credential (never expose SAS); set `Content-Type`,
  `Content-Length`, and `ETag: "<contentSha256>"`; 404/410 for unknown, soft-deleted (`deletedAt`),
  or fenced resources; enforce size cap on read.
- The URL is a **version-specific immutable fetch locator**, never identity: replacing content
  creates `/versions/<n+1>`; ingestion's digest check makes a mutated blob fail its operation.
- SSRF stance: ingestion only accepts this registered origin for `blob` sources; Klicker does not
  need its own allowlisting beyond auth.

### 6. Webhook receiver + reconciliation

- **Reuse PR #5078's route** `POST /api/webhooks/kb-ingestion` (`apps/backend-docker/src/app.ts`)
  and `handleKBIngestionWebhook` — signature verification (HMAC-SHA256 over
  `` `${timestamp}.${rawBody}` ``, timing-safe, tolerance window), `KBWebhookInbox` eventId dedup,
  and the 400/401/404/idempotent-200 matrix are already implemented and tested. Deltas:
  - Header prefix `X-Klicker-*` → `X-Ingestion-*` for inbound events (the scheme was written for
    Klicker→out dispatch; inbound events are authored by data-ingestion — proposed as the
    umbrella's canonical envelope).
  - Event payloads gain the umbrella's required fields: `operation_id` (matched against
    `KBIngestionRun.externalOperationId` — replaces the PR's Klicker-generated `ingestionRunId`
    lookup), `external_resource_id`, `resource_version`, safe `error_code`. Keep the PR's event
    vocabulary (`resource.processing_started|progress|succeeded|failed`,
    `resource.subresources_updated`, `kb.metrics_updated`).
  - State-machine hardening: duplicate/out-of-order events must not regress terminal state; only
    a `resource_version` ≥ the current `activeResourceVersion` may advance serving state
    (`activeResourceVersion`/`activeContentSha256` set on `resource.processing_succeeded`).
  - Drop the payload→`externalResourceId` write (identity inversion, see follow-up migration).
- Reconciliation: cron task in `packages/hatchet/src/index.ts` run by `hatchet-worker-general`
  (existing cron precedent) — every 5 minutes, poll `GET /v1/operations/{id}` for resources in
  QUEUED/PROCESSING older than a threshold, repair missed webhooks; mark stale operations FAILED
  with a safe error after the ingestion-side timeout.

### 7. Lecturer UI (`apps/frontend-kb` + `@klicker-uzh/kb-management`)

PR #5078 ships the KB manager UI (resource table, add-resource dialog, status badges, chatbot
linking); this plan wires the gaps instead of building a second surface in `frontend-manage`:

- Connect `AddResourceDialog` DOCUMENT flow to `requestKBResourceUpload` → browser PUT to SAS →
  `finalizeKBResource` (with client-side SHA-256) — replacing the PR's demo-data path.
- Surface both state axes in `ResourceTable`/`ResourceInspector`: latest `KBIngestionRun`
  (operation) + `activeResourceVersion` (serving) — "update failed, still serving v(N)" — plus
  safe `errorCode` and a retry action.
- Chatbot linking UI exists (`MLinkKBChatbot` with priority/isEnabled); add the "this KB is what
  the chatbot retrieves from" affordance and a warning when a chatbot has no enabled KB (its
  `doc_query` tool silently disappears).
- i18n per app conventions.

### 8. Chat-side fixes and seeds

- Fix `rag-tool-ui.tsx:18` tool-name matching to the `toSafeToolName` output (`KB_doc_query`),
  ideally by matching the suffix `_doc_query` so server renames don't break the card.
- Seed/DB: add the dynamic `ChatbotMCPServer` row + per-chatbot `ChatbotMCPConfig`
  (`allowedTools: ['doc_query']`) for migrated chatbots; keep legacy rows until per-chatbot
  cutover verification passes; rollback = row flip back.
- Capability flag (env or DB): gates resource mutations and the dynamic MCP route so the Klicker
  MR can merge before the platform pieces are live.

### What Klicker explicitly does NOT build

- No vector store, chunking, embedding, retrieval tuning (decided in the Mastra evaluation:
  retrieval stays on the AI-infra doc-query MCP; reconfirmed by the umbrella plan).
- No Milvus collection naming/selection; no ingestion-internal IDs; no Hatchet calls into the
  ingestion cluster; no per-course MCP tools or LiteLLM aliases.

## Environment variables (new, all services listed)

| Var | Service | Secret? |
| --- | --- | --- |
| `DOC_QUERY_SCOPE_PRIVATE_KEY` | chat | yes |
| `DOC_QUERY_SCOPE_KID` / `_ISSUER` / `_AUDIENCE` | chat | no |
| `INGESTION_API_URL` | backend (graphql service) | no |
| `INGESTION_API_KEY` | backend | yes |
| `INGESTION_GATEWAY_KEY` | backend (gateway route) | yes |
| `KB_INGESTION_WEBHOOK_SECRET` | backend (webhook route; **exists in PR #5078**) | yes |
| `KB_RESOURCES_CONTAINER` (+ reuse `BLOB_STORAGE_*`) | backend | no |

Removed vs PR #5078: outgoing `KB_INGESTION_WEBHOOK_URL` + its outgoing-secret use die with
`dispatchKBWebhook('INGESTION')` (replaced by the API client). `KB_GRAPH_WEBHOOK_*` and
`KB_WEBHOOK_TIMEOUT_MS`/`KB_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` stay.

Secrets provisioned out-of-band (Infisical → k8s Secrets per the deployment repo convention);
local dev gets `.env` defaults with generated throwaway keys.

## Migration of existing course chatbots

Per umbrella Slice 7; Klicker-side mechanics:

1. Inventory existing course bots (`ChatbotMCPServer`/`ChatbotMCPConfig` rows, per-course
   collections `klicker_ai_*`, source documents).
2. For each chatbot: create a `KB` (metadataProfile `COURSE_KB`) + enabled `KBChatbot` link →
   recreate sources as `KBResource` entries (re-upload or re-point URLs) → ingest into the shared
   collection (chunks stamped with the new `kb_id`) → verify scoped retrieval (positive + negative
   cross-KB probes) → flip the chatbot's MCP config rows to the dynamic server → observe → remove
   legacy rows.
3. Legacy per-course collections and static configs are removed on the deployment side only after
   the retention window and explicit approval (umbrella no-go gates apply).

## Testing and verification

- Unit: `signScopeToken` claims/kid/exp; `isToolAllowed` non-empty policy; resource state machine
  transitions incl. out-of-order webhook regression cases; digest/version monotonicity guards.
- Integration (local): docker-compose doc-query with a v3 adapter config + generated test keypair
  + local Milvus fixture — prove end-to-end: mint → initialize/list/call → scoped results; forged/
  expired/wrong-audience tokens fail; KB A's chatbot cannot retrieve KB B's content (two-fixture
  negative test); re-linking a KB to another chatbot serves the same content with no re-ingest;
  webhook signature/replay tests extend PR #5078's existing `test/knowledge.test.ts` coverage.
- Browser E2E (Playwright, existing suite): lecturer adds source → processing → ready → chat
  returns content with citation → replace fails safely (still serving old) → retry → delete →
  content no longer retrievable.
- Cross-repo contract fixture from the umbrella plan (synthetic producer + two-chatbot fixture)
  validates against the same schemas this plan implements.

## Delivery slices (Klicker repo)

0. **S0 — land the base**: PR #5078 review/merge (user-gated; it is the control-plane
   foundation), branch decision (Open Question 6). No doc-query work starts against a moving base.
1. **S1 — token + client seam**: `signScopeToken`, `authType: 'scope_token'` in `mcpClients.ts`,
   `kbId` resolution + context threading, tool-UI name fix, unit tests. Small, mergeable behind
   unused-until-seeded server rows.
2. **S2 — follow-up migration + upload flow**: version/digest/storagePath columns, drop
   `externalResourceId` write path, `KBResourceOperation` enum, `requestKBResourceUpload`/
   `finalizeKBResource`/`retryKBResourceOperation`, SAS extension, owner tests.
   Capability-flagged.
3. **S3 — ingestion client, gateway, webhook alignment, reconciliation**: API client replacing
   `dispatchKBWebhook('INGESTION')` call sites, gateway route, receiver deltas (header prefix,
   operation-id matching, state-machine hardening), Hatchet cron, integration tests with a
   stubbed ingestion API.
4. **S4 — KB manager wiring**: upload flow + two-axis status + retry in
   `kb-management`/`frontend-kb`, i18n, browser E2E against local stack.
5. **S5 — canary + migration tooling**: seed rows for the dynamic endpoint, KB-per-course
   creation + per-chatbot flip script/runbook, migration verification checklist (feeds umbrella
   Slices 6–7).

Each slice: review + simplification + tests green before the next; no production flip inside any
slice — cutover is data-driven (server rows) and separately approved.

## Open questions — ALL RULED by user 2026-07-12 (item-by-item in chat)

1. Server name: **keep `KB`**; `KB-dynamic` only during migration A/B.
2. Digest: **client-computed `contentSha256` at finalize**; ingestion re-verifies over fetched
   bytes.
3. Response mode: **`documents` now** (diverges from defer-to-canary recommendation) — RAG-card
   sources-shape verification is S4 work; canary smoke covers retrieval quality only.
4. `sub`: **opaque per-session correlation id**; participant UUIDs never reach doc-query.
5. Scope pivot: **`kb_id` CONFIRMED** (claim + chunk metadata + filter field; resolved from
   top-priority enabled `KBChatbot` link). Flat per-chatbot fallback only if PR #5078 dies.
6. Base branch: **`v3-ai`, after PR #5078 merges**.
7. `SNIPPET`: **small text blob through the same upload/digest path** (uniform versioning).

Related umbrella rulings that shape this plan: canary = STG + synthetic chatbot; LiteLLM
catch-all alias fix folded into Slice 7 (no pre-work MR); `GET /v1/resources` in v1 API; ES256;
Milvus **partition-key tenancy on `kb_id` from day one** (umbrella D9 amendment).

## No-go gates (Klicker side)

- No scope keypair shared with or derived from `APP_SECRET`.
- No caller-controllable collection, filter, or scope value on any MCP request path.
- No empty `allowedTools` for the dynamic server config.
- No SAS URLs or storage credentials sent to ingestion or stored in `KBResource`.
- No ingestion-internal source id stored (the PR #5078 `externalResourceId` write path is
  removed, not repurposed silently).
- No webhook processing without signature + ledger idempotency.
- No fire-and-forget ingestion mutation: every create/update/delete has an operation id and a
  reconciliation path.
- No production seed/DB flip without per-chatbot verification evidence and explicit approval.
