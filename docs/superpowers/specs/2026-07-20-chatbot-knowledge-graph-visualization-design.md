# Chatbot Knowledge Graph Visualization Design

Date: 2026-07-20

Status: approved in conversation on 2026-07-20

Related records:

- `project/2026-07-15-pr-5174-kb-poc-plan.md`
- `docs/superpowers/specs/2026-07-20-external-kb-hatchet-bridge-design.md`

## Goal

Give lecturers and students an interactive visualization of the knowledge graph
used by a chatbot. Lecturers configure and preview the graph from the existing
Chatbot Details screen. Course participants inspect the published graph from the
existing chat application.

Each chatbot owns one external FalkorDB graph named
`klickeruzh:<chatbot UUID>`. A graph can contain many PDF or public-URL resources,
but each `KBResource` can belong to at most one chatbot graph.

The browser never connects to FalkorDB directly. Klicker queries the external
FalkorDB service from the server over the Redis/RESP protocol and exposes only
authorized, bounded, normalized graph data.

## Approved Product Model and Terminology

The existing schema distinguishes a knowledge-base collection (`KB`) from the
PDFs and URLs it contains (`KBResource`). In product conversation, “multiple KBs”
referred to multiple PDF/URL resources, possibly selected from different `KB`
collections.

The approved relationship is:

```text
Course 1 ── * Chatbot 1 ── 1 ChatbotKnowledgeGraph 1 ── * KBResource
                                                        * ── 1 KB
```

Rules:

- A chatbot belongs to one course, as it does today.
- A chatbot has at most one knowledge graph.
- A graph can use many resources from any KB collection owned by the chatbot's
  lecturer.
- A resource can be assigned to at most one chatbot graph.
- Only the lecturer who owns the chatbot can change its graph configuration.
- Students can inspect a successfully published graph but cannot change its
  resources or trigger a rebuild.
- The external graph name is derived from the stable chatbot UUID and is never
  editable.

## Evolution of the Existing KB POC

The existing KB pages remain responsible for creating KB collections, uploading
files, registering public URLs, and deleting unassigned resources.

The graph build lifecycle moves from the KB resource row to the chatbot:

- Remove the per-resource **Ingest** action from the KB management UI.
- Add one **Build/Rebuild knowledge graph** action to Chatbot Details.
- One build sends every currently selected resource to one external workflow.
- Graph-level state becomes authoritative for publication and visualization.

The existing S5 `ingest-kb-resource` implementation and the historical project
plan are not rewritten or erased. The task can remain registered for backward
compatibility while the new chatbot flow adds a graph-level task and reuses the
existing external-Hatchet, SAS, polling, and correlation building blocks.

Existing per-resource ingestion status and external-run fields can remain during
the POC migration. The new graph flow does not rely on those fields to authorize
or publish a chatbot graph. Removing the legacy fields is a later cleanup.

## Lecturer Experience

Add a Knowledge Graph section to the existing Chatbot Details screen. A full
chatbot creation workflow is not part of this feature.

The section contains:

- A resource picker grouped by the lecturer's KB collections.
- Resource title and PDF/URL type.
- Assignment availability for each resource.
- Resources assigned to another chatbot shown disabled with an explanation.
- The number of selected resources.
- **Save selection**.
- A build-quality selector with `balanced` as the default and `quality` and
  `fast` as alternatives.
- **Build/Rebuild knowledge graph**.
- Current build/publication status, external run progress, last successful build
  timestamp, and sanitized failure information.
- An interactive preview when the current selection revision has been built
  successfully.

Saving a changed selection immediately makes the previously built graph
unavailable to students. This prevents content from a removed resource from
remaining visible while the new resource selection awaits a rebuild.

An assigned resource cannot be deleted directly. The lecturer first removes it
from the chatbot selection. The graph then becomes unpublished until a rebuild
succeeds. Deleting a KB collection is similarly rejected while it contains an
assigned resource.

## Student and Lecturer Chat Experience

Both lecturer and student launches ultimately use `apps/chat`, so the graph uses
one shared chat experience and the existing participant/course authorization
path.

Add a **Chat / Knowledge graph** switch to the compact chat header. The graph
opens as a dedicated workspace rather than sharing the conversation column.

The graph workspace contains:

- A degree-ranked overview of at most 250 nodes and 500 edges.
- Pan, zoom, node dragging, fit, and reset controls.
- A restrained UZH data-visualization palette and node-type legend.
- Server-backed search across the complete graph.
- A desktop detail panel and mobile bottom sheet.
- Ready/build metadata without exposing FalkorDB details.

Interactions:

- Clicking a node selects it and shows its label, type, description/content,
  source references, degree, and safe properties.
- Double-clicking a node fetches and expands its bounded one-hop neighborhood.
- An **Expand connections** button provides a keyboard- and touch-accessible
  alternative to double-click.
- Clicking an edge shows its type and safe relationship properties.
- Search focuses a loaded node or loads the matching node's neighborhood.

Cytoscape.js is used directly from a React client component. A React wrapper is
not required. The initial layout uses the built-in CoSE layout. Expansion keeps
existing coordinates and arranges only newly loaded nodes around the selected
node.

Because a canvas graph is not inherently accessible, search results and the
loaded-node list use normal DOM buttons. Keyboard users can select a result,
inspect its detail panel, and invoke **Expand connections** without manipulating
the canvas. Selection and load changes are announced through an accessible live
region.

On mobile, the approved design keeps the current compact chat header, places the
Chat/Graph switch below it, and uses a draggable-style bottom detail sheet. On
desktop, the existing conversation sidebar, settings/credits section, and footer
remain in place.

## UZH Visual Language

The visualization extends the existing chat and management UI rather than
introducing a separate visual system.

- UZH blue (`#0028a5`) is the primary action and selected-node color.
- UZH blue, red, yellow, and grey tints distinguish node kinds.
- Node labels, borders, shapes, and a legend reinforce color so color is never
  the only distinction.
- Existing card, border, radius, typography, spacing, header, sidebar, and footer
  patterns are retained.
- Controls use the existing `@uzh-bf/design-system` components where suitable.
- Focus styles, target sizes, and contrast follow the existing UZH application
  conventions.

Approved design sketches cover the desktop chat workspace, mobile chat
workspace, and lecturer configuration/preview. They were generated as a
deterministic HTML/CSS companion during design review; this document records the
behavioral and visual decisions so implementation does not depend on a
machine-local artifact.

## Data Model

Add a one-to-one graph model and an optional graph assignment on `KBResource`.
Exact Prisma naming can follow generator conventions, but the intended shape is:

```prisma
enum ChatbotKnowledgeGraphStatus {
  EMPTY
  DIRTY
  QUEUED
  PROCESSING
  READY
  FAILED
}

enum KBIngestionSpeedMode {
  BALANCED
  QUALITY
  FAST
}

model ChatbotKnowledgeGraph {
  id        String  @id @default(uuid()) @db.Uuid
  chatbot   Chatbot @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  chatbotId String  @unique @db.Uuid

  resources KBResource[]

  status            ChatbotKnowledgeGraphStatus @default(EMPTY)
  statusMessage     String?
  selectionRevision Int                         @default(0)
  builtRevision     Int?

  activeAttemptId       String?   @db.Uuid
  activeBuildRevision   Int?
  externalWorkflowRunId String?
  externalStartedAt     DateTime?
  lastBuiltAt           DateTime?
  lastBuildSpeedMode    KBIngestionSpeedMode?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
}

model KBResource {
  // existing fields

  knowledgeGraph   ChatbotKnowledgeGraph? @relation(fields: [knowledgeGraphId], references: [id], onDelete: SetNull)
  knowledgeGraphId String?                  @db.Uuid

  @@index([knowledgeGraphId])
}
```

Add the inverse optional relation to `Chatbot`.

The graph record is created lazily when the lecturer first saves a selection.
Existing chatbots therefore require no eager backfill and initially have no
published graph.

The external graph name is always computed as
`klickeruzh:${chatbotKnowledgeGraph.chatbotId}`. It is not stored in PostgreSQL.

## Selection Revisions and Publication Gate

`selectionRevision` increments whenever the assigned resource-ID set changes.
`builtRevision` records the revision most recently completed successfully.

A graph is available to a browser only when all conditions hold:

```text
status == READY
AND builtRevision != null
AND builtRevision == selectionRevision
```

This equality is the core stale-content guard.

If a lecturer edits the selection during an active build, the active build can
finish but cannot publish the new selection accidentally. The monitor compares
`activeBuildRevision` with the current `selectionRevision`:

- Equal on success: set `builtRevision`, `lastBuiltAt`, and `READY`.
- Different on success: clear the active attempt and set `DIRTY`.
- Equal on failure: clear the active attempt and set `FAILED`.
- Different on failure: clear the active attempt and set `DIRTY`, because the
  failed run no longer represents the current selection.

The fixed FalkorDB graph may contain an older or partially rebuilt version while
the publication gate is closed. Klicker never serves it until the current
revision succeeds.

## Lecturer GraphQL API

Add owner-scoped operations conceptually equivalent to:

- `getChatbotKnowledgeGraphConfig(chatbotId)`
- `getAvailableChatbotKnowledgeGraphResources(chatbotId)`
- `updateChatbotKnowledgeGraphResources(chatbotId, resourceIds)`
- `rebuildChatbotKnowledgeGraph(chatbotId, speedMode)`
- Lecturer overview, search, and neighborhood reads for the preview.

Selection updates run in one transaction:

1. Verify that the chatbot exists and belongs to the current user.
2. Verify every resource exists and belongs to the same user.
3. Reject duplicate IDs and resources assigned to another graph.
4. Compare the normalized ID set with the stored assignment.
5. If it changed, update assignments and increment `selectionRevision`. With no
   active attempt, set `EMPTY` or `DIRTY`; with an active attempt, preserve its
   visible run status while the revision mismatch still closes publication.
6. Return the complete graph configuration.

The service must not silently steal a resource from another graph.

## Build Dispatch

Add a local Hatchet task for graph-level builds, for example
`build-chatbot-knowledge-graph`. The existing resource-level S5 task remains
intact for compatibility but is not triggered by the new UI.

The rebuild mutation:

1. Verifies chatbot ownership.
2. Requires at least one selected resource.
3. Rejects a second build while one is active.
4. Generates a new attempt UUID.
5. Atomically claims the graph as `QUEUED`, recording the current selection
   revision, selected speed, and attempt UUID while clearing prior active-run
   metadata.
6. Dispatches the graph-level local Hatchet task with a self-contained snapshot
   of the selected resources.
7. Conditionally rolls the claim back to `DIRTY` or `FAILED` if local dispatch
   fails, without overwriting a newer selection or attempt.

The local task retains privacy-safe logs and triggers one run on the separate
external Hatchet service. The payload is:

```json
{
  "course_id": "<chatbot UUID>",
  "sources": [
    {
      "source_id": "<KB resource UUID>",
      "source_url": "<public URL or temporary read SAS URL>"
    }
  ],
  "upload_markdown": true,
  "export_to_falkordb": true,
  "falkordb_graph_name": "klickeruzh:<chatbot UUID>",
  "speed_mode": "balanced"
}
```

The `sources` array contains all resources assigned to the claimed revision.
`course_id` uses the chatbot UUID even though the external workflow field retains
its historic name. This prevents artifact collisions when a course contains
multiple chatbots.

The attempt UUID is attached as external Hatchet `additionalMetadata`, together
with the chatbot ID where useful for operations. It is not added to the Python
workflow input.

Before creating a run, a retry searches external runs by attempt metadata. This
recovers a run accepted during an ambiguous network response. Conditional
persistence and best-effort cancellation retain the current bridge's
latest-attempt protections.

## Blob Source Access

Public URL resources are passed through unchanged and must be reachable by the
external pipeline.

For blob resources, the local Hatchet worker generates a blob-scoped Azure SAS
URL immediately before external dispatch:

- read-only permission
- HTTPS-only protocol
- exact-blob scope
- five-minute clock-skew allowance
- one-hour validity

The SAS URL is not stored in PostgreSQL or logged. The existing nearby code
comment remains: the one-hour duration may need adjustment for larger files or
slower ingestion workflows in future modifications.

## Singleton External Status Monitor

The external workflow does not call a Klicker webhook.

Keep one local cron task, `monitor-kb-ingestions`, running once per minute with
single-run concurrency. It discovers all incomplete work from PostgreSQL. During
the migration it may check both legacy resource attempts and new chatbot graph
attempts in one sweep; no per-resource or per-graph sleeping monitor tasks are
created.

For graph attempts, map external status as follows:

| External status | Graph action                                    |
| --------------- | ----------------------------------------------- |
| `QUEUED`        | keep `QUEUED`                                   |
| `RUNNING`       | set `PROCESSING` if the attempt remains current |
| `COMPLETED`     | apply the selection-revision publication rules  |
| `FAILED`        | apply the selection-revision failure rules      |
| `CANCELLED`     | apply the selection-revision failure rules      |

If elapsed time exceeds `KB_INGESTION_TIMEOUT_SECONDS`, attempt external
cancellation and apply the same failure rules. The default remains `3600`
seconds.

One failed status lookup is logged without aborting the remainder of the sweep.
The next minute retries any attempt that remains active.

The monitor can continue using Klicker's signed internal status-transition
endpoint if required by the existing worker/backend boundary. This is an
internal Klicker call; the separate external workflow never receives the webhook
URL or secret.

## FalkorDB Server Adapter

Create a small server-only adapter shared by the GraphQL backend and `apps/chat`.
It owns:

- One reusable official Node.js FalkorDB client per process.
- Strict environment parsing.
- Read-only Cypher query construction.
- Query timeouts and result limits.
- External-node/edge normalization.
- Connection shutdown for tests and process termination.

The adapter is never imported by a client component. The UI consumes only
serializable DTOs.

Use scoped configuration:

| Variable                       | Purpose                                            | Secret                |
| ------------------------------ | -------------------------------------------------- | --------------------- |
| `KB_FALKORDB_HOST`             | External FalkorDB service host or full cluster DNS | no                    |
| `KB_FALKORDB_PORT`             | RESP port, normally `6379`                         | no                    |
| `KB_FALKORDB_USERNAME`         | Optional database username                         | environment-dependent |
| `KB_FALKORDB_PASSWORD`         | Optional database password                         | yes                   |
| `KB_FALKORDB_TLS`              | Strict boolean TLS setting                         | no                    |
| `KB_FALKORDB_QUERY_TIMEOUT_MS` | Read-query timeout, default `5000`                 | no                    |

Hostnames, namespace names, credentials, and environment-specific TLS behavior
are deployment configuration and are never hard-coded.

Add variable names to Turbo's global environment allow-list and the relevant
example configuration. Real credentials remain in Infisical/Kubernetes secrets.

## Server Read Boundaries

There are two authorized server entry points:

- The GraphQL backend serves the lecturer management preview after verifying
  chatbot ownership.
- `apps/chat` serves participants through the existing `withChatbotAuth` guard,
  which verifies chatbot existence and course participation.

Both entry points call the same server adapter and apply the same publication
gate before querying FalkorDB.

The participant API is conceptually:

```text
GET /api/chatbots/:chatbotId/knowledge-graph?operation=overview
GET /api/chatbots/:chatbotId/knowledge-graph?operation=search&q=...
GET /api/chatbots/:chatbotId/knowledge-graph?operation=neighbors&nodeId=...
```

Equivalent route splitting is acceptable if it improves Next.js validation,
but no endpoint accepts a user-supplied Cypher statement.

## Normalized Read Contract

The browser contract is:

```ts
type GraphNode = {
  id: string
  labels: string[]
  kind: string
  displayLabel: string
  summary?: string
  content?: string
  degree: number
  sourceReferences: Array<{
    resourceId: string
    title: string
  }>
}

type GraphEdge = {
  id: string
  source: string
  target: string
  type: string
  label: string
  properties: Record<string, string | number | boolean>
}

type GraphResponse = {
  chatbotId: string
  builtRevision: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  truncated: boolean
}
```

FalkorDB internal IDs are valid only for the published revision. The client does
not persist them across reloads or rebuilds. Every request returns
`builtRevision`; a mismatched revision clears client state rather than mixing
nodes from different builds.

Fixed operations:

- **Overview:** degree-ranked maximum of 250 nodes and 500 connecting edges.
- **Search:** parameterized full-graph search with at most 20 results.
- **Neighborhood:** bounded one-hop expansion with at most 100 additional nodes
  and 200 edges.

Search text and node identifiers are validated and passed as query parameters.
The server constructs every Cypher statement.

## Property Normalization and Data Minimization

The graph schema originates in the external pipeline, so one central mapping
normalizes common property names:

- Display label: `name`, `title`, `entity`, then a generated fallback.
- Kind: `entity_type`, then the first FalkorDB label.
- Content: `description`, `summary`, `content`, then `text`.
- Source identity: `source_id`, resolved back to `KBResource` metadata.

Implementation begins with a read-only inspection of a real generated graph to
confirm exact property names and fixture values. The mapping is then locked in
unit fixtures rather than spread through UI code.

Do not return arbitrary raw properties. Explicitly remove or reject:

- embeddings and vectors
- binary values
- internal ingestion metadata
- credentials or SAS-like URLs
- nested values outside the DTO contract
- excessive strings beyond the configured content cap

Source references show resource titles and available page/reference metadata.
The POC does not grant direct downloads of private blob sources. A future
authorized download flow can be designed separately.

## Client State and Cytoscape Behavior

The reusable client-only viewer accepts a data-fetching interface so the same
component can use GraphQL in lecturer management and the Next route in chat.

Client rules:

- Deduplicate nodes and edges by their response IDs.
- Ignore a neighborhood response if its built revision differs from current
  state.
- A successful search focuses an existing node or loads its neighborhood.
- Single-click uses Cytoscape's single-tap event.
- Double-click uses Cytoscape's normalized double-tap event and does not also
  execute the delayed single-click behavior twice.
- Existing node positions remain stable after expansion.
- The detail panel and graph selection stay synchronized.
- Closing the detail panel deselects the node.
- Fit and reset are explicit controls rather than automatic disruptive zooms.

If an already-open graph becomes dirty or starts rebuilding, the next read
returns an unavailable response. The client clears graph data and renders the
same unavailable/updating state as a fresh load.

## Failure Semantics

- No graph or no selected resources: `EMPTY`; viewer unavailable.
- Changed selection not yet built: `DIRTY`; viewer unavailable.
- Active build: `QUEUED` or `PROCESSING`; viewer unavailable.
- External failure, cancellation, or timeout: `FAILED`; viewer unavailable and
  lecturer sees a sanitized reason.
- Local dispatch failure: conditional rollback without overwriting a newer
  attempt or selection.
- FalkorDB connection/authentication/query failure: temporary unavailable state
  with Retry; PostgreSQL graph status is unchanged.
- FalkorDB graph key missing despite `READY`: temporary unavailable state,
  operational log, and lecturer-visible diagnostic without leaking connection
  details.
- Search with no result: empty result state without changing the overview.
- Bounded response truncation: response marks `truncated`; UI explains that the
  overview shows the most connected concepts.
- Empty selection after a previously successful build: set `EMPTY` and deny
  reads. The old external FalkorDB graph may remain physically present during
  the POC but is unreachable through Klicker.

No external SDK error, Cypher statement, FalkorDB credential, SAS URL, storage
key, Hatchet token, or webhook secret is returned to a browser or written to
normal application logs.

## Deployment Wiring

The GraphQL backend and chat deployment receive the FalkorDB host/port/TLS
configuration and credentials. They must be able to resolve the external
FalkorDB service across Kubernetes namespaces.

The general Hatchet worker continues to receive the external Hatchet client,
blob storage, timeout, and internal webhook configuration established by the
bridge. It does not need browser-facing endpoints.

Network policy should permit only the required Klicker server workloads to reach
the FalkorDB RESP service. FalkorDB is not exposed to browsers through an ingress
for this feature.

Local development can use a port-forward or local FalkorDB container and the
same environment variables. The app must fail with an explicit unavailable
state when the optional graph service is not configured; unrelated chat features
continue to work.

## Verification Strategy

### Database and GraphQL integration

- One graph per chatbot.
- Many resources per graph and at most one graph per resource.
- Owner validation for chatbot and all resources.
- Conflict instead of silent reassignment.
- Assigned-resource and containing-KB deletion rejection.
- Normalized set comparison and revision increments.
- No revision increment for an unchanged set.
- Empty-selection publication closure.
- Atomic build claim and duplicate-click protection.
- Stale selection and attempt guards.

### Build bridge

- One payload containing every selected PDF/URL.
- `course_id` and `falkordb_graph_name` derived from chatbot UUID.
- Balanced default and quality/fast mapping.
- Exact-resource read-only SAS generation.
- Public URL pass-through.
- Attempt metadata lookup and run-ID recovery.
- Conditional run-ID persistence and best-effort cancellation after a lost
  guard.
- Sanitized final failures.

### Singleton monitor

- Discover active graph attempts from PostgreSQL.
- Map queued, running, completed, failed, and cancelled states.
- Preserve the one-minute, non-overlapping cron behavior.
- Apply the configured timeout, defaulting to `3600`.
- Prevent a completed stale revision from publishing.
- Continue after one attempt's lookup or transition fails.
- Retain legacy resource monitoring during the migration if active legacy rows
  can exist.

### FalkorDB adapter

- Strict environment parsing and reusable connection lifecycle.
- Overview, search, and neighborhood limits.
- Read-only and parameterized query construction.
- Node/edge normalization from a real graph-shaped fixture.
- Exclusion of embeddings, large values, internal metadata, and SAS-like URLs.
- Missing graph, timeout, authentication, and connection failures.
- No write-capable or arbitrary-Cypher interface.
- Built-revision propagation.

### Authorization

- Owner-only configuration and preview.
- Participant/course authorization in `apps/chat`.
- Rejection of unrelated participants and lecturers.
- No reads for `EMPTY`, `DIRTY`, `QUEUED`, `PROCESSING`, or `FAILED` graphs.
- No private blob download permission introduced by visualization.

### Browser verification

- Lecturer selects resources, saves, rebuilds, observes progress, and opens the
  interactive preview.
- Assigned resources are visibly unavailable in another chatbot.
- Student opens the graph on desktop and mobile.
- Node click, edge click, double-click expansion, accessible expansion button,
  search, pan/zoom, fit, reset, and Retry states.
- Dirtying an already-open graph invalidates the student view.
- UZH styling, keyboard focus, touch targets, labels, and contrast match the
  approved designs.
- Capture desktop/mobile lecturer and student screenshots for the draft PR.

### Production-like smoke test

1. Assign at least one real PDF and one public URL to a chatbot.
2. Explicitly rebuild with `balanced`.
3. Confirm one external Hatchet run contains all selected sources.
4. Confirm its run ID and attempt metadata are persisted.
5. Confirm the singleton monitor advances the graph state.
6. Confirm FalkorDB contains `klickeruzh:<chatbot UUID>`.
7. Confirm the graph reaches `READY` for the current selection revision.
8. Load the lecturer preview and participant chat graph.
9. Exercise selection, search, and neighborhood expansion.
10. Change the selection and confirm both views immediately stop serving the old
    graph until a successful rebuild.

## Migration and Rollout

1. Apply the additive Prisma migration.
2. Deploy server configuration and read adapter while existing chatbots have no
   graph record.
3. Deploy lecturer configuration and graph-level build flow.
4. Keep the existing monitor compatible with any legacy active resource runs.
5. Remove the per-resource Ingest action from the KB UI.
6. Deploy the chat viewer behind the graph-availability response; chat remains
   usable without FalkorDB.
7. Configure Infisical/Kubernetes environment values and network policy.
8. Run the production-like smoke test before wider use.

The rollout is additive for existing chatbots and resources. No existing chatbot
publishes a graph until its lecturer selects resources and completes a rebuild.

## Out of Scope

- A full chatbot creation workflow.
- Multiple graphs per chatbot.
- Sharing one resource across multiple chatbot graphs.
- Student editing, rebuilding, or arbitrary Cypher access.
- Direct browser-to-FalkorDB access or embedding FalkorDB Browser.
- Downloading private source files from graph details.
- Multi-hop expansion beyond the bounded one-hop POC.
- Persisting user-specific graph layouts or selections.
- Graph analytics, authoring, editing, or node deletion.
- Automatically deleting orphaned external graph keys.
- Changes to the external Python workflow's input contract.
- A transactional cross-system outbox or full build-attempt history table.
- Immediate cleanup of the legacy per-resource ingestion fields/task.

## Decision Summary

- One graph per chatbot, named `klickeruzh:${chatbotId}`.
- Many PDF/URL resources per graph; one graph maximum per resource.
- Lecturer-only configuration on existing Chatbot Details.
- Explicit full rebuild from the complete selected set.
- Saving a changed selection immediately closes publication.
- Existing one-minute Klicker monitor polls the external Hatchet service.
- Direct server-side, read-only FalkorDB access through environment configuration.
- Cytoscape.js integrated into the existing UZH chat and management UI.
- Bounded overview plus search and one-hop expansion.
- Shared normalized contract and strict authorization for both lecturer and
  participant reads.
