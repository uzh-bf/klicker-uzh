# Chatbot Knowledge Graph Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let lecturers assign many existing PDF/URL resources to one chatbot, explicitly build `klickeruzh:<chatbot UUID>` through the external Hatchet pipeline, and let authorized lecturers and course participants inspect the published FalkorDB graph through an interactive UZH-styled viewer.

**Architecture:** PostgreSQL owns graph configuration, selection revisions, build attempts, and the publication gate. The existing general Hatchet worker snapshots all selected resources, gives private blobs one-hour read-only SAS URLs, triggers one external `course-kg-ingestion` run, and monitors it with the existing one-minute singleton cron. A new server-only package exposes three fixed read operations over the official FalkorDB Node client. GraphQL serves lecturer configuration/preview; `apps/chat` serves participants through `withChatbotAuth`. Both use the same publication guard and normalized DTOs. Cytoscape.js is loaded only when the graph workspace opens.

**Tech Stack:** Prisma 6/PostgreSQL, Pothos GraphQL, Hatchet TypeScript SDK, Azure Blob SAS, `falkordb@6.6.2`, React 19/Next.js 15, `cytoscape@3.34.0`, `@uzh-bf/design-system`, Vitest, and `npx agent-browser`.

## Global Constraints

- Treat `docs/superpowers/specs/2026-07-20-chatbot-knowledge-graph-visualization-design.md` as the approved source of truth and keep `project/2026-07-15-pr-5174-kb-poc-plan.md` unchanged.
- Do not replace or unregister the existing S5 `ingest-kb-resource` task. Remove only its current UI trigger; retain its service, GraphQL mutation, generated operation, webhook path, and legacy monitor support.
- One chatbot has at most one graph; one resource belongs to at most one chatbot graph; a graph can contain resources from multiple KB collections owned by the chatbot owner.
- Compute the external graph name as `klickeruzh:${chatbotId}`. Never accept or persist a user-editable graph name.
- A graph is readable only when `status === READY`, `builtRevision !== null`, and `builtRevision === selectionRevision`.
- The external pipeline never calls a Klicker webhook. The existing signed internal webhook remains only for legacy resource attempts.
- Keep `KB_INGESTION_TIMEOUT_SECONDS` with default `3600`, the one-minute singleton monitor, and the current one-hour exact-blob SAS behavior and future-size comment.
- Browsers never receive FalkorDB credentials, Cypher, SAS URLs, embeddings, vectors, internal ingestion metadata, or private blob download links.
- No API accepts arbitrary Cypher. Expose only overview, search, and one-hop-neighborhood operations with the approved limits.
- Use direct imports and `next/dynamic(..., { ssr: false })` for the heavy viewer. Keep Cytoscape instances and transient positions in refs; keep serializable graph data in reducer state backed by `Map`/`Set` lookups.
- Use delegated lecturer login for browser verification. Invoke the browser as `npx agent-browser`, never as the global binary.
- Make each task green before committing. Do not combine unrelated cleanup with this feature.

---

### Task 1: Add shared graph contracts and the server-only package shell

**Files:**

- Create: `packages/types/src/knowledgeGraph.ts`
- Modify: `packages/types/src/index.ts`
- Create: `packages/knowledge-graph/package.json`
- Create: `packages/knowledge-graph/tsconfig.json`
- Create: `packages/knowledge-graph/rollup.config.js`
- Create: `packages/knowledge-graph/src/config.ts`
- Create: `packages/knowledge-graph/src/index.ts`
- Create: `packages/knowledge-graph/test/config.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: FalkorDB environment variables and Prisma graph status names.
- Produces: browser-safe `KnowledgeGraphNode`, `KnowledgeGraphEdge`, `KnowledgeGraphResponse`, and strict server configuration helpers.

- [ ] **Step 1: Write the shared DTOs.**

  Add the exact serializable contract below and export it from `packages/types/src/index.ts`:

  ```ts
  export type KnowledgeGraphSourceReference = {
    resourceId: string
    title: string
    reference?: string
  }

  export type KnowledgeGraphNode = {
    id: string
    labels: string[]
    kind: string
    displayLabel: string
    summary?: string
    content?: string
    degree: number
    sourceReferences: KnowledgeGraphSourceReference[]
  }

  export type KnowledgeGraphEdge = {
    id: string
    source: string
    target: string
    type: string
    label: string
    properties: Record<string, string | number | boolean>
  }

  export type KnowledgeGraphResponse = {
    chatbotId: string
    builtRevision: number
    nodes: KnowledgeGraphNode[]
    edges: KnowledgeGraphEdge[]
    truncated: boolean
  }
  ```

- [ ] **Step 2: Scaffold `@klicker-uzh/knowledge-graph`.**

  Follow the existing Rollup/TypeScript package shape. Pin `falkordb` to `6.6.2`; add workspace dependencies on `@klicker-uzh/prisma` and `@klicker-uzh/types`; add `vitest ~3.2.4` and the same Rollup/TypeScript tooling versions used by `packages/hatchet`.

- [ ] **Step 3: Write failing strict-environment tests.**

  Cover required host, positive integer port, optional username/password, strict `true|false` TLS, default query timeout `5000`, invalid/unsafe timeout values, and absence of secrets from thrown messages.

  ```ts
  expect(
    getKnowledgeGraphConfig({
      KB_FALKORDB_HOST: 'falkordb.ingestion.svc.cluster.local',
      KB_FALKORDB_PORT: '6379',
      KB_FALKORDB_TLS: 'true',
    })
  ).toEqual({
    host: 'falkordb.ingestion.svc.cluster.local',
    port: 6379,
    username: undefined,
    password: undefined,
    tls: true,
    queryTimeoutMs: 5000,
  })
  ```

- [ ] **Step 4: Run the test and confirm it fails for the missing implementation.**

  Run: `pnpm --filter @klicker-uzh/knowledge-graph exec vitest run test/config.test.ts`

  Expected: FAIL because `getKnowledgeGraphConfig` is not implemented/exported.

- [ ] **Step 5: Implement strict parsing.**

  Export `KnowledgeGraphConfig`, `getKnowledgeGraphConfig(env = process.env)`, and constants for the default timeout and response limits. Reject whitespace-only hosts, non-integer ports outside `1..65535`, TLS values other than `true` or `false`, and non-positive query timeouts.

- [ ] **Step 6: Install and verify.**

  Run:

  ```bash
  pnpm install
  pnpm --filter @klicker-uzh/types build
  pnpm --filter @klicker-uzh/knowledge-graph test
  pnpm --filter @klicker-uzh/knowledge-graph check
  ```

  Expected: all commands pass and `pnpm-lock.yaml` contains exactly `falkordb@6.6.2` for the new package.

- [ ] **Step 7: Commit.**

  ```bash
  git add packages/types packages/knowledge-graph pnpm-lock.yaml
  git commit -m "feat(kg): add shared graph contracts"
  ```

---

### Task 2: Add the chatbot graph persistence model and migration

**Files:**

- Modify: `packages/prisma/src/prisma/schema/knowledge.prisma`
- Modify: `packages/prisma/src/prisma/schema/chat.prisma`
- Create: `packages/prisma/src/prisma/schema/migrations/20260720150000_chatbot_knowledge_graph/migration.sql`
- Generated: `packages/prisma/src/prisma/client/**`
- Synced: `apps/analytics/prisma/schema/**`

**Interfaces:**

- Consumes: existing `Chatbot`, `KBResource`, and legacy resource ingestion fields.
- Produces: one graph row per chatbot, optional exclusive resource assignment, revisions, and graph-level build state.

- [ ] **Step 1: Add Prisma enums and relations exactly as approved.**

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
    chatbot   Chatbot @relation(fields: [chatbotId], references: [id], onDelete: Cascade, onUpdate: Cascade)
    chatbotId String  @unique @db.Uuid

    resources KBResource[]

    status            ChatbotKnowledgeGraphStatus @default(EMPTY)
    statusMessage     String?
    selectionRevision Int                         @default(0)
    builtRevision     Int?

    activeAttemptId       String? @db.Uuid
    activeBuildRevision   Int?
    externalWorkflowRunId String?
    externalStartedAt     DateTime?
    lastBuiltAt           DateTime?
    lastBuildSpeedMode    KBIngestionSpeedMode?

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([status])
  }
  ```

  Add `knowledgeGraph ChatbotKnowledgeGraph?` to `Chatbot`. Add nullable `knowledgeGraphId` and the `SetNull` relation/index to `KBResource`. Do not remove any legacy `KBResourceStatus` or external-run column.

- [ ] **Step 2: Write the additive SQL migration.**

  The migration must create both enums, create `ChatbotKnowledgeGraph`, add nullable `KBResource.knowledgeGraphId`, add the unique chatbot index and status/resource indexes, and add cascade-to-chatbot plus set-null-to-resource foreign keys. It must not update or backfill existing rows.

- [ ] **Step 3: Validate without resetting the database.**

  Run:

  ```bash
  pnpm --filter @klicker-uzh/prisma exec prisma validate
  pnpm --filter @klicker-uzh/prisma generate
  pnpm run prisma:sync
  pnpm --filter @klicker-uzh/prisma check
  ```

  Expected: Prisma validates and generated clients expose `chatbotKnowledgeGraph`; no reset command is run.

- [ ] **Step 4: Commit.**

  ```bash
  git add packages/prisma apps/analytics/prisma
  git commit -m "feat(kg): persist chatbot graph lifecycle"
  ```

---

### Task 3: Implement owner-scoped selection and deletion guards

**Files:**

- Create: `packages/graphql/src/services/chatbotKnowledgeGraphs.ts`
- Create: `packages/graphql/test/chatbotKnowledgeGraphs.test.ts`
- Modify: `packages/graphql/src/services/knowledge.ts`
- Modify: `packages/graphql/src/schema/knowledge.ts`
- Create: `packages/graphql/src/schema/chatbotKnowledgeGraph.ts`
- Modify: `packages/graphql/src/schema/query.ts`
- Modify: `packages/graphql/src/schema/mutation.ts`
- Modify: `packages/graphql/src/index.ts`

**Interfaces:**

- Consumes: authenticated `ContextWithUser`, chatbot ownership, all owner KB collections/resources.
- Produces: graph configuration, grouped resource availability, atomic selection updates, and assigned-resource deletion rejection.

- [ ] **Step 1: Write failing integration tests for the lifecycle contract.**

  Add cases for:

  - a missing graph returning an `EMPTY`, revision-0 configuration;
  - lazy graph creation on first save;
  - selection from multiple owned KBs;
  - duplicate IDs rejected before mutation;
  - foreign chatbot/resource rejected as not found;
  - a resource assigned to another chatbot rejected instead of stolen;
  - normalized unchanged sets not incrementing `selectionRevision`;
  - changed sets incrementing exactly once and closing publication;
  - changed selection during `QUEUED`/`PROCESSING` preserving the active visible status but creating a revision mismatch;
  - empty selection setting `EMPTY`;
  - assigned resource deletion and containing-KB deletion rejected.

- [ ] **Step 2: Run the tests and confirm the service is missing.**

  Run: `pnpm --filter @klicker-uzh/graphql exec vitest run test/chatbotKnowledgeGraphs.test.ts`

  Expected: FAIL on missing imports/behavior.

- [ ] **Step 3: Implement the ownership and revision transaction.**

  Normalize IDs with a duplicate check and sorted comparison. Lock the owned chatbot graph row and selected resources during the transaction. The decisive status update must follow this rule:

  ```ts
  const selectionChanged = !sameIdSet(currentIds, requestedIds)
  const nextRevision = selectionChanged
    ? graph.selectionRevision + 1
    : graph.selectionRevision
  const hasActiveAttempt = graph.activeAttemptId !== null

  const nextStatus = hasActiveAttempt
    ? graph.status
    : requestedIds.length === 0
      ? DB.ChatbotKnowledgeGraphStatus.EMPTY
      : selectionChanged
        ? DB.ChatbotKnowledgeGraphStatus.DIRTY
        : graph.status
  ```

  Update all assignments in the same transaction. Never disconnect a row based only on client input; scope disconnects to the current graph ID.

- [ ] **Step 4: Add read models and schema fields.**

  Expose:

  - `getChatbotKnowledgeGraphConfig(chatbotId: ID!)`;
  - `getAvailableChatbotKnowledgeGraphResources(chatbotId: ID!)` grouped by KB;
  - `updateChatbotKnowledgeGraphResources(chatbotId: ID!, resourceIds: [ID!]!)`.

  Include assignment chatbot ID/name in availability results so another chatbot's resources can be rendered disabled. Do not expose external graph credentials or SAS data.

- [ ] **Step 5: Guard deletion.**

  In the existing locked transactions, reject `deleteKbResource` when `knowledgeGraphId !== null` and reject `deleteKb` when any child resource has an assignment. Keep existing active-ingestion and bounded blob deletion behavior intact.

- [ ] **Step 6: Verify and commit.**

  Run:

  ```bash
  pnpm --filter @klicker-uzh/graphql exec vitest run test/chatbotKnowledgeGraphs.test.ts test/knowledge.test.ts
  pnpm --filter @klicker-uzh/graphql check
  ```

  Expected: tests and typecheck pass.

  ```bash
  git add packages/graphql
  git commit -m "feat(kg): manage chatbot graph resources"
  ```

---

### Task 4: Add graph-level build claiming and the external Hatchet dispatch

**Files:**

- Modify: `packages/types/src/hatchet.ts`
- Modify: `packages/graphql/src/services/chatbotKnowledgeGraphs.ts`
- Modify: `packages/graphql/src/schema/chatbotKnowledgeGraph.ts`
- Modify: `packages/graphql/src/schema/mutation.ts`
- Create: `packages/hatchet/src/kbGraphIngestion.ts`
- Modify: `packages/hatchet/src/kbIngestion.ts`
- Modify: `packages/hatchet/src/index.ts`
- Create: `packages/hatchet/test/kbGraphIngestion.test.ts`
- Modify: `packages/graphql/test/chatbotKnowledgeGraphs.test.ts`

**Interfaces:**

- Consumes: one immutable selection snapshot and existing external Hatchet/SAS configuration.
- Produces: one local `build-chatbot-knowledge-graph` task and one external run containing every selected resource.

- [ ] **Step 1: Define the self-contained task input.**

  ```ts
  export type BuildChatbotKnowledgeGraphInput = JsonObject & {
    graphId: string
    chatbotId: string
    attemptId: string
    selectionRevision: number
    speedMode: KBIngestionSpeedMode
    resources: Array<
      | {
          resourceId: string
          title: string
          type: 'BLOB'
          blobName: string
          containerName: string
        }
      | {
          resourceId: string
          title: string
          type: 'URL'
          sourceUrl: string
        }
    >
  }
  ```

  Add `buildChatbotKnowledgeGraph` to `PreparedHatchetTasks`. Preserve `ingestKBResource` unchanged.

- [ ] **Step 2: Write failing GraphQL build-claim tests.**

  Cover no selected resources, foreign chatbot, all three speed modes, a fresh attempt UUID, snapshot completeness, `QUEUED` claim, `activeBuildRevision`, duplicate-click protection, and conditional local-dispatch failure handling (`FAILED` for the still-current revision and `DIRTY` for a changed revision).

- [ ] **Step 3: Write failing Hatchet bridge tests.**

  Cover this exact external payload shape:

  ```ts
  expect(payload).toEqual({
    course_id: chatbotId,
    sources: [
      { source_id: pdfResourceId, source_url: expect.stringContaining('sig=') },
      { source_id: urlResourceId, source_url: publicUrl },
    ],
    upload_markdown: true,
    export_to_falkordb: true,
    falkordb_graph_name: `klickeruzh:${chatbotId}`,
    speed_mode: 'balanced',
  })
  ```

  Also test exact-blob read-only HTTPS SAS scope, no SAS persistence/logging, retry recovery by attempt metadata, conditional run-ID persistence, and best-effort cancellation when the persistence guard is lost.

- [ ] **Step 4: Run focused tests and confirm failure.**

  ```bash
  pnpm --filter @klicker-uzh/graphql exec vitest run test/chatbotKnowledgeGraphs.test.ts
  pnpm --filter @klicker-uzh/hatchet exec vitest run test/kbGraphIngestion.test.ts
  ```

  Expected: FAIL for the missing mutation/task/bridge.

- [ ] **Step 5: Implement atomic claiming in GraphQL.**

  `rebuildChatbotKnowledgeGraph(chatbotId, speedMode)` must conditionally claim only an inactive graph, record `activeAttemptId`, `activeBuildRevision`, `lastBuildSpeedMode`, clear prior external active-run metadata, and pass the full resource snapshot to `runNoWait`. If dispatch throws, update only the same attempt/revision: clear active fields and set `FAILED` while the claimed revision remains current, or `DIRTY` if selection changed. Return a sanitized `GraphQLError`; do not restore an old `READY` state.

- [ ] **Step 6: Implement graph dispatch by reusing existing bridge primitives.**

  Export only the narrow reusable helpers required from `kbIngestion.ts` (external client/config, source URL generation, run recovery, and best-effort cancellation). Keep the nearby comment stating that one-hour SAS validity may need adjustment for larger files or slower workflows.

  Add external metadata keys for the attempt ID and chatbot ID. Do not add them to the Python workflow input.

- [ ] **Step 7: Register the task without altering S5.**

  Add `build-chatbot-knowledge-graph` with three retries. Its `onFailure` conditionally marks the current graph attempt `FAILED`, or `DIRTY` when the selection revision changed. Continue returning both the legacy task and the new task from `prepareHatchetTasks`.

- [ ] **Step 8: Verify and commit.**

  ```bash
  pnpm --filter @klicker-uzh/types build
  pnpm --filter @klicker-uzh/hatchet test
  pnpm --filter @klicker-uzh/hatchet check
  pnpm --filter @klicker-uzh/graphql exec vitest run test/chatbotKnowledgeGraphs.test.ts
  pnpm --filter @klicker-uzh/graphql check
  ```

  Expected: all pass, including existing `packages/hatchet/test/kbIngestion.test.ts`.

  ```bash
  git add packages/types packages/graphql packages/hatchet
  git commit -m "feat(kg): dispatch chatbot graph builds"
  ```

---

### Task 5: Extend the one-minute singleton monitor to graph attempts

**Files:**

- Modify: `packages/hatchet/src/kbGraphIngestion.ts`
- Modify: `packages/hatchet/src/kbIngestion.ts`
- Modify: `packages/hatchet/src/index.ts`
- Modify: `packages/hatchet/test/kbGraphIngestion.test.ts`
- Modify: `packages/hatchet/test/kbIngestion.test.ts`

**Interfaces:**

- Consumes: active legacy resource attempts and active graph attempts discovered in PostgreSQL.
- Produces: one non-overlapping cron sweep with revision-safe graph state transitions.

- [ ] **Step 1: Write the full graph transition matrix as failing tests.**

  Test `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`, timeout, lookup failure continuation, conditional attempt guards, and two success branches:

  ```ts
  const publishable = graph.activeBuildRevision === graph.selectionRevision

  // completed current revision -> READY + builtRevision + lastBuiltAt
  // completed stale revision   -> DIRTY, never publish
  ```

  Test failure/cancellation similarly: current revision becomes `FAILED`; stale revision becomes `DIRTY`. Every terminal transition clears active attempt/run fields.

- [ ] **Step 2: Assert the cron remains singleton and one-minute.**

  Extend the declaration test to keep:

  ```ts
  expect(definition.onCrons).toEqual(['* * * * *'])
  expect(definition.concurrency).toMatchObject({ maxRuns: 1 })
  ```

- [ ] **Step 3: Run and confirm failure.**

  Run: `pnpm --filter @klicker-uzh/hatchet exec vitest run test/kbGraphIngestion.test.ts test/kbIngestion.test.ts`

  Expected: graph monitor cases fail; legacy cases remain green.

- [ ] **Step 4: Implement one resilient sweep.**

  Keep `monitor-kb-ingestions` as the only cron. Have it call the legacy resource monitor and graph monitor in the same task. Each graph attempt catches/logs its own lookup/transition failure and lets the loop continue. Use `getKBIngestionTimeoutSeconds`, default `3600`, and cancel timed-out external runs best-effort.

- [ ] **Step 5: Verify and commit.**

  ```bash
  pnpm --filter @klicker-uzh/hatchet test
  pnpm --filter @klicker-uzh/hatchet check
  git add packages/hatchet
  git commit -m "feat(kg): monitor chatbot graph builds"
  ```

---

### Task 6: Implement the bounded read-only FalkorDB adapter

**Files:**

- Create: `packages/knowledge-graph/src/client.ts`
- Create: `packages/knowledge-graph/src/publication.ts`
- Create: `packages/knowledge-graph/src/queries.ts`
- Create: `packages/knowledge-graph/src/normalize.ts`
- Modify: `packages/knowledge-graph/src/index.ts`
- Create: `packages/knowledge-graph/test/fixtures/exampleLectureGraph.ts`
- Create: `packages/knowledge-graph/test/client.test.ts`
- Create: `packages/knowledge-graph/test/normalize.test.ts`
- Create: `packages/knowledge-graph/test/queries.test.ts`
- Create: `packages/knowledge-graph/test/publication.test.ts`

**Interfaces:**

- Consumes: strict Falkor config, published chatbot graph metadata, and known resource IDs/titles.
- Produces: fixed `overview`, `search`, and `neighbors` functions returning only shared DTOs.

- [ ] **Step 1: Inspect the existing real example graph read-only.**

  With the external FalkorDB service port-forwarded/configured, run:

  ```bash
  REDISCLI_AUTH="$KB_FALKORDB_PASSWORD" redis-cli --no-auth-warning -h "$KB_FALKORDB_HOST" -p "$KB_FALKORDB_PORT" GRAPH.RO_QUERY klickeruzh:example-lecture "MATCH (n) RETURN labels(n), properties(n) LIMIT 10"
  REDISCLI_AUTH="$KB_FALKORDB_PASSWORD" redis-cli --no-auth-warning -h "$KB_FALKORDB_HOST" -p "$KB_FALKORDB_PORT" GRAPH.RO_QUERY klickeruzh:example-lecture "MATCH (a)-[r]->(b) RETURN type(r), properties(r), properties(a), properties(b) LIMIT 10"
  ```

  Add `--tls` when `KB_FALKORDB_TLS=true`. Record only sanitized representative labels/property keys in `exampleLectureGraph.ts`; replace URLs with `https://example.test/document.pdf` and remove vectors, credentials, signatures, and document content unrelated to the test.

- [ ] **Step 2: Write failing config/client lifecycle tests.**

  Mock `FalkorDB.connect` and prove one client per process, `socket.tls`, `socket.connectTimeout`, optional credentials, error listener registration, test reset/close, and `roQuery(..., { TIMEOUT: queryTimeoutMs })`. No code path may call `graph.query`.

- [ ] **Step 3: Write failing fixed-query tests.**

  Assert:

  - overview asks for at most 251 nodes and 501 edges so truncation can be detected before returning 250/500;
  - search is parameterized, validates non-empty text at at most 100 characters, and returns at most 20 nodes;
  - neighbors accepts only a decimal Falkor internal node ID and returns at most 100 additional nodes/200 edges;
  - user values never appear inside Cypher strings;
  - every query uses `roQuery` and the configured timeout.

  Use two bounded reads where needed: one to select node IDs/degrees and a second parameterized read for edges among those IDs.

- [ ] **Step 4: Write failing normalization/data-minimization tests.**

  Lock the central property precedence:

  ```ts
  const displayLabel = firstString(properties, ['name', 'title', 'entity'])
  const kind =
    firstString(properties, ['entity_type']) ?? labels[0] ?? 'Concept'
  const content = firstString(properties, [
    'description',
    'summary',
    'content',
    'text',
  ])
  ```

  Test source resolution from `source_id`, content truncation, deterministic fallbacks, scalar-only edge properties, and rejection/removal of keys or values containing embedding/vector, password/secret/token, internal ingestion metadata, binary/nested values, and SAS-like query parameters (`sig`, `se`, `sp`, `sv`).

- [ ] **Step 5: Implement the reusable connection and fixed reader.**

  Use the official API exactly:

  ```ts
  const client = await FalkorDB.connect({
    username: config.username,
    password: config.password,
    socket: {
      host: config.host,
      port: config.port,
      tls: config.tls,
      connectTimeout: config.queryTimeoutMs,
    },
  })
  const graph = client.selectGraph(`klickeruzh:${chatbotId}`)
  const result = await graph.roQuery<Row>(cypher, {
    params,
    TIMEOUT: config.queryTimeoutMs,
  })
  ```

  Export no raw client and no generic query function.

- [ ] **Step 6: Implement the shared publication guard.**

  `getPublishedKnowledgeGraph(prisma, chatbotId)` must select the graph plus assigned resource IDs/titles and reject unless the three-part publication predicate is true. Return only internal server context: chatbot ID, built revision, computed graph name, and source metadata.

- [ ] **Step 7: Verify and commit.**

  ```bash
  pnpm --filter @klicker-uzh/knowledge-graph test
  pnpm --filter @klicker-uzh/knowledge-graph check
  pnpm --filter @klicker-uzh/knowledge-graph build
  git add packages/knowledge-graph
  git commit -m "feat(kg): add bounded FalkorDB reader"
  ```

---

### Task 7: Expose lecturer preview reads and generate the GraphQL contract

**Files:**

- Modify: `packages/graphql/package.json`
- Modify: `packages/graphql/src/services/chatbotKnowledgeGraphs.ts`
- Modify: `packages/graphql/src/schema/chatbotKnowledgeGraph.ts`
- Modify: `packages/graphql/src/schema/query.ts`
- Create: `packages/graphql/src/graphql/ops/QGetChatbotKnowledgeGraphConfig.graphql`
- Create: `packages/graphql/src/graphql/ops/MUpdateChatbotKnowledgeGraphResources.graphql`
- Create: `packages/graphql/src/graphql/ops/MRebuildChatbotKnowledgeGraph.graphql`
- Create: `packages/graphql/src/graphql/ops/QGetChatbotKnowledgeGraphOverview.graphql`
- Create: `packages/graphql/src/graphql/ops/QSearchChatbotKnowledgeGraph.graphql`
- Create: `packages/graphql/src/graphql/ops/QGetChatbotKnowledgeGraphNeighbors.graphql`
- Modify: `packages/graphql/test/chatbotKnowledgeGraphs.test.ts`
- Generated: `packages/graphql/src/ops.ts`
- Generated: `packages/graphql/src/public/schema.graphql`
- Generated: `packages/graphql/src/public/*.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: owner authorization, publication guard, and the fixed FalkorDB reader.
- Produces: typed configuration/build operations and owner-only preview reads for Apollo clients.

- [ ] **Step 1: Add the server package dependency.**

  Add `@klicker-uzh/knowledge-graph: workspace:*` to GraphQL dependencies. It remains server-side; generated operation types contain only DTO scalars/objects.

- [ ] **Step 2: Add failing owner/publication tests.**

  Mock the reader and verify owner-only access, rejection of unrelated lecturers, no reader call for `EMPTY`, `DIRTY`, `QUEUED`, `PROCESSING`, `FAILED`, or revision mismatch, built-revision propagation, bounded search/neighborhood arguments, and sanitized temporary-unavailable errors.

- [ ] **Step 3: Implement three explicit preview fields.**

  Add:

  - `getChatbotKnowledgeGraphOverview(chatbotId: ID!)`;
  - `searchChatbotKnowledgeGraph(chatbotId: ID!, query: String!)`;
  - `getChatbotKnowledgeGraphNeighbors(chatbotId: ID!, nodeId: ID!)`.

  Each field verifies chatbot ownership before calling the shared publication guard/reader. Do not add an operation enum or a Cypher argument.

- [ ] **Step 4: Add exact client operations and regenerate.**

  Each read operation selects `chatbotId`, `builtRevision`, `truncated`, all node fields/source references, and all edge fields/properties. Configuration selects selected IDs, grouped available resources, assignment chatbot metadata, status/message, revisions, current external run ID, selected speed, and timestamps.

  Run:

  ```bash
  pnpm install
  pnpm --filter @klicker-uzh/graphql generate
  pnpm --filter @klicker-uzh/graphql exec vitest run test/chatbotKnowledgeGraphs.test.ts
  pnpm --filter @klicker-uzh/graphql check
  ```

  Expected: generated schema has the new fields and no arbitrary query field.

- [ ] **Step 5: Commit.**

  ```bash
  git add packages/graphql pnpm-lock.yaml
  git commit -m "feat(kg): expose lecturer graph API"
  ```

---

### Task 8: Build the reusable accessible Cytoscape viewer

**Files:**

- Modify: `packages/shared-components/package.json`
- Create: `packages/shared-components/src/knowledgeGraph/knowledgeGraphState.ts`
- Create: `packages/shared-components/src/knowledgeGraph/KnowledgeGraphDetails.tsx`
- Create: `packages/shared-components/src/knowledgeGraph/KnowledgeGraphViewer.tsx`
- Create: `apps/chat/test/knowledge-graph-state.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: a data-fetching interface returning `KnowledgeGraphResponse` for overview/search/neighbors.
- Produces: a client-only UZH viewer reusable by manage and chat without importing FalkorDB code.

- [ ] **Step 1: Pin Cytoscape and define the fetcher.**

  Add `cytoscape: 3.34.0` to `@klicker-uzh/shared-components`. Define:

  ```ts
  export type KnowledgeGraphDataSource = {
    overview: () => Promise<KnowledgeGraphResponse>
    search: (query: string) => Promise<KnowledgeGraphResponse>
    neighbors: (nodeId: string) => Promise<KnowledgeGraphResponse>
  }
  ```

- [ ] **Step 2: Write reducer tests before the component.**

  Cover node/edge deduplication by ID, revision mismatch replacing all state, same-revision neighborhood merging, selected node/edge synchronization, close-to-deselect, search result focus, loading/error/retry states, and stale async response suppression.

- [ ] **Step 3: Run and confirm failure.**

  Run: `pnpm --filter @klicker-uzh/chat exec vitest run test/knowledge-graph-state.test.ts`

  Expected: FAIL because the reducer does not exist.

- [ ] **Step 4: Implement the pure state reducer.**

  Keep state serializable as arrays/IDs. Build `Map`/`Set` indexes inside merge helpers for O(1) deduplication. If `incoming.builtRevision !== current.builtRevision`, replace the graph instead of merging.

- [ ] **Step 5: Implement Cytoscape lifecycle and interaction semantics.**

  Initialize once in an effect with a `cyRef`, built-in CoSE layout, UZH palette, labels/shapes, pan/zoom/drag, and `multiClickDebounceTime: 250`. Use `onetap` for delayed single selection and `dbltap` for expansion. Store Cytoscape and transient positions in refs; destroy the instance and remove handlers on unmount.

  Expansion must add only new elements, preserve existing positions with `preset`, and position new nodes around the selected node before a subset layout. Fit/reset occur only from explicit buttons.

- [ ] **Step 6: Add the DOM-accessible interaction layer.**

  Include a labeled search form, normal DOM search-result and loaded-node buttons, selected node/edge detail view, keyboard/touch `Expand connections`, type legend with color plus shape/text, live region announcements, 44px touch targets, mobile bottom sheet, desktop side panel, truncation explanation, unavailable state, temporary error with Retry, and reduced-motion-safe behavior.

- [ ] **Step 7: Verify package boundaries and commit.**

  ```bash
  pnpm install
  pnpm --filter @klicker-uzh/chat exec vitest run test/knowledge-graph-state.test.ts
  pnpm --filter @klicker-uzh/shared-components check
  pnpm --filter @klicker-uzh/chat check
  git add packages/shared-components apps/chat/test/knowledge-graph-state.test.ts pnpm-lock.yaml
  git commit -m "feat(kg): add interactive graph viewer"
  ```

---

### Task 9: Add lecturer configuration, rebuild controls, and preview

**Files:**

- Create: `apps/frontend-manage/src/components/resources/chatbots/ChatbotKnowledgeGraphPanel.tsx`
- Create: `apps/frontend-manage/src/components/resources/chatbots/ChatbotKnowledgeGraphPreview.tsx`
- Modify: `apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx`
- Modify: `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx`
- Modify: `packages/graphql/src/graphql/ops/QGetKb.graphql`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:**

- Consumes: generated GraphQL configuration/build/read operations and the shared viewer.
- Produces: lecturer-only resource assignment/build UI on existing Chatbot Details; KB pages become resource-management-only.

- [ ] **Step 1: Remove only the per-resource ingestion controls.**

  Remove `IngestKbResourceDocument`, per-row speed state/select, ingest button, and ingest toasts from `KnowledgeBaseResourceList.tsx`. Keep status display, deletion, file upload, URL creation, the legacy GraphQL mutation file, and legacy worker task. Show a graph-assignment badge and disable deletion for assigned resources using the extended `QGetKb` assignment fields.

- [ ] **Step 2: Build a separate graph panel instead of enlarging `ChatbotDetails.tsx`.**

  The panel owns its query/mutations and renders:

  - KB-grouped checkboxes;
  - selected count;
  - another-chatbot assignment disabled with name/reason;
  - Save selection;
  - speed selector with `balanced` initial value plus `quality` and `fast`;
  - Build/Rebuild button;
  - status, sanitized message, active external run progress, and last successful build;
  - preview only when publication predicate is true.

  Changed local selection must not imply publication. After Save, refetch the configuration; changed revisions immediately replace the preview with the dirty/unavailable state.

- [ ] **Step 3: Lazy-load the preview.**

  `ChatbotKnowledgeGraphPreview.tsx` must use:

  ```ts
  const KnowledgeGraphViewer = dynamic(
    () =>
      import(
        '@klicker-uzh/shared-components/src/knowledgeGraph/KnowledgeGraphViewer'
      ),
    { ssr: false }
  )
  ```

  Construct the viewer data source with `ApolloClient.query({ fetchPolicy: 'network-only' })`. Keep it memoized by chatbot ID and current built revision.

- [ ] **Step 4: Add English/German strings and stable selectors.**

  Add all visible management/KB strings to i18n. Add `data-cy` values for the panel, resource checkboxes, Save, speed mode, Rebuild, status, preview, search, and Retry.

- [ ] **Step 5: Regenerate and typecheck.**

  ```bash
  pnpm --filter @klicker-uzh/graphql generate
  pnpm --filter @klicker-uzh/kb-management check
  pnpm --filter @klicker-uzh/frontend-manage check
  pnpm --filter @klicker-uzh/i18n check
  ```

  Expected: all pass and `ChatbotDetails.tsx` contains only the panel integration, not viewer implementation details.

- [ ] **Step 6: Commit.**

  ```bash
  git add apps/frontend-manage packages/kb-management packages/graphql packages/i18n
  git commit -m "feat(manage): configure chatbot knowledge graphs"
  ```

---

### Task 10: Add the participant-authorized chat graph API

**Files:**

- Modify: `apps/chat/package.json`
- Create: `apps/chat/src/lib/server/knowledgeGraph.ts`
- Create: `apps/chat/src/app/api/chatbots/[chatbotId]/knowledge-graph/route.ts`
- Create: `apps/chat/test/knowledge-graph-route.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `withChatbotAuth`, shared publication guard, fixed FalkorDB reader.
- Produces: one participant API route with three validated operations and no Cypher surface.

- [ ] **Step 1: Add the server package dependency and failing route tests.**

  Add `@klicker-uzh/knowledge-graph: workspace:*` to chat. Mock auth/publication/reader boundaries and test unauthorized, non-participant, no graph/dirty/active/failed, overview success, search validation, numeric node ID validation, temporary Falkor failure, and response sanitization.

- [ ] **Step 2: Run and confirm failure.**

  Run: `pnpm --filter @klicker-uzh/chat exec vitest run test/knowledge-graph-route.test.ts`

  Expected: FAIL because the route/service does not exist.

- [ ] **Step 3: Implement input parsing and authorization inside the route.**

  Parse only:

  ```ts
  const operation = z.enum(['overview', 'search', 'neighbors'])
  const searchQuery = z.string().trim().min(1).max(100)
  const nodeId = z.string().regex(/^\d+$/)
  ```

  Call `withChatbotAuth(req, chatbotId)` before the publication guard or Falkor reader. Return `409` with a safe status code for unpublished graphs, `503` for a temporary database/read failure, and `200` with `KnowledgeGraphResponse` on success. Log operational context without connection strings, queries, source URLs, credentials, or raw SDK errors.

- [ ] **Step 4: Verify and commit.**

  ```bash
  pnpm install
  pnpm --filter @klicker-uzh/chat exec vitest run test/knowledge-graph-route.test.ts
  pnpm --filter @klicker-uzh/chat check
  git add apps/chat pnpm-lock.yaml
  git commit -m "feat(chat): serve authorized knowledge graphs"
  ```

---

### Task 11: Integrate the graph workspace into the existing chat UI

**Files:**

- Create: `apps/chat/src/app/[chatbotId]/graph/page.tsx`
- Create: `apps/chat/src/components/knowledge-graph/ChatKnowledgeGraphWorkspace.tsx`
- Create: `apps/chat/src/components/knowledge-graph/ChatKnowledgeGraphViewer.tsx`
- Create: `apps/chat/src/components/knowledge-graph/ChatGraphModeSwitch.tsx`
- Modify: `apps/chat/src/components/assistant.tsx`
- Modify: `apps/chat/src/components/app-sidebar.tsx`
- Create: `apps/chat/test/knowledge-graph-api-client.test.ts`

**Interfaces:**

- Consumes: participant graph API, `authedFetch`, current chatbot route, shared viewer.
- Produces: Chat/Knowledge graph switch and full graph workspace while preserving current chat/sidebar/footer behavior.

- [ ] **Step 1: Write the API-client tests.**

  Cover URL encoding for search, decimal neighbor IDs, `409` unpublished mapping, `503` retryable mapping, auth headers through `authedFetch`, and successful DTO decoding.

- [ ] **Step 2: Add a route-aware workspace switch.**

  Use `usePathname()` to derive graph mode from `/${chatbotId}/graph`. The Chat option links to `/${chatbotId}` and Knowledge graph links to `/${chatbotId}/graph`. Keep the existing compact mobile header, desktop sidebar, settings/credits, disclaimer gate, participation gate, and footer.

- [ ] **Step 3: Lazy-load Cytoscape only in graph mode.**

  `ChatKnowledgeGraphViewer.tsx` dynamically imports the shared viewer with `ssr: false`. `ChatKnowledgeGraphWorkspace` creates a stable data source around:

  ```text
  /api/chatbots/:chatbotId/knowledge-graph?operation=overview
  /api/chatbots/:chatbotId/knowledge-graph?operation=search&q=...
  /api/chatbots/:chatbotId/knowledge-graph?operation=neighbors&nodeId=...
  ```

  Do not import `@klicker-uzh/knowledge-graph` from a client component; use only shared DTO types and the HTTP contract.

- [ ] **Step 4: Match the approved responsive UZH design.**

  Desktop: existing sidebar, full graph canvas, right detail panel, visible Chat/Knowledge graph mode control, controls/legend/search. Mobile: compact chat header, mode switch immediately below it, canvas filling remaining height, and bottom detail sheet. Preserve UZH blue `#0028a5` as selection/action color and use red/yellow/grey tints with non-color labels/shapes.

- [ ] **Step 5: Verify unit/type checks and commit.**

  ```bash
  pnpm --filter @klicker-uzh/chat exec vitest run test/knowledge-graph-api-client.test.ts test/knowledge-graph-route.test.ts test/knowledge-graph-state.test.ts
  pnpm --filter @klicker-uzh/chat check
  git add apps/chat
  git commit -m "feat(chat): add knowledge graph workspace"
  ```

---

### Task 12: Wire FalkorDB configuration through local examples, Turbo, and Helm

**Files:**

- Modify: `turbo.json`
- Modify: `apps/backend-docker/.env.example`
- Modify: `apps/chat/.env.local.example`
- Modify: `deploy/charts/klicker-uzh-v3/values.yaml`
- Modify: `deploy/charts/klicker-uzh-v3/templates/cm-backend-graphql.yaml`
- Modify: `deploy/charts/klicker-uzh-v3/templates/cm-chat.yaml`
- Modify: `project/CODEBASE_NOTES.md`

**Interfaces:**

- Consumes: external FalkorDB Kubernetes DNS/port/TLS/credentials provisioned per environment.
- Produces: identical scoped runtime configuration for GraphQL and chat; no browser/public ingress.

- [ ] **Step 1: Add all six environment names to Turbo and examples.**

  ```text
  KB_FALKORDB_HOST
  KB_FALKORDB_PORT
  KB_FALKORDB_USERNAME
  KB_FALKORDB_PASSWORD
  KB_FALKORDB_TLS
  KB_FALKORDB_QUERY_TIMEOUT_MS
  ```

  Example defaults: port `6379`, TLS `false`, timeout `5000`; leave credentials clearly non-secret/example-only. Do not commit actual cluster names or credentials.

- [ ] **Step 2: Add one Helm values block and both ConfigMap projections.**

  Put non-secrets under a shared `knowledgeGraph.falkordb` values block. Project host, port, TLS, and query timeout into both backend GraphQL and chat ConfigMaps. Existing external secrets named `*-secret-backend-graphql` and `*-secret-chat` receive username/password out-of-band through Infisical/Kubernetes; do not add Secret manifests to this chart.

- [ ] **Step 3: Record the deployment boundary.**

  Add a concise Codebase Notes entry: Falkor credentials must exist in both external secrets; only backend GraphQL/chat need network access to the cross-namespace RESP service; no Falkor ingress is part of this feature.

- [ ] **Step 4: Render and check.**

  Run:

  ```bash
  helm template klicker deploy/charts/klicker-uzh-v3 > /tmp/klicker-kg-chart.yaml
  rg -n "KB_FALKORDB_(HOST|PORT|TLS|QUERY_TIMEOUT_MS)" /tmp/klicker-kg-chart.yaml
  pnpm --filter @klicker-uzh/backend-docker check
  pnpm --filter @klicker-uzh/chat check
  ```

  Expected: each non-secret variable appears once in the GraphQL ConfigMap and once in the chat ConfigMap; password is absent from rendered ConfigMaps.

- [ ] **Step 5: Commit.**

  ```bash
  git add turbo.json apps/backend-docker/.env.example apps/chat/.env.local.example deploy/charts/klicker-uzh-v3 project/CODEBASE_NOTES.md
  git commit -m "chore(kg): wire FalkorDB configuration"
  ```

---

### Task 13: Run the complete automated verification and self-review

**Files:**

- Modify only if verification exposes a defect in files already listed above.

**Interfaces:**

- Consumes: complete branch implementation.
- Produces: formatted, typed, tested, statically reviewed branch with no placeholders or server/client boundary leaks.

- [ ] **Step 1: Run focused tests first.**

  ```bash
  pnpm --filter @klicker-uzh/knowledge-graph test
  pnpm --filter @klicker-uzh/hatchet test
  pnpm --filter @klicker-uzh/graphql exec vitest run test/chatbotKnowledgeGraphs.test.ts test/knowledge.test.ts test/knowledgeIngestion.test.ts
  pnpm --filter @klicker-uzh/chat test:run
  ```

  Expected: all pass; legacy S5 tests remain green.

- [ ] **Step 2: Run generated-code, format, type, lint, and static-analysis checks.**

  ```bash
  pnpm --filter @klicker-uzh/graphql generate
  pnpm run format
  pnpm run check
  pnpm run lint
  pnpm run format:check
  opengrep scan --config auto
  ```

  Expected: generated files are stable on a second `generate`, checks pass, and no high-confidence security finding remains. If `opengrep` is unavailable, record that explicitly instead of silently skipping it.

- [ ] **Step 3: Review the whole target-branch diff.**

  ```bash
  git status --short
  git diff --check origin/kb-poc...HEAD
  git diff --stat origin/kb-poc...HEAD
  git log --oneline origin/kb-poc..HEAD
  rg -n "TODO|TBD|PLACEHOLDER|example\.test|sig=|KB_FALKORDB_PASSWORD" packages/knowledge-graph packages/graphql packages/hatchet apps/chat apps/frontend-manage packages/shared-components deploy turbo.json
  ```

  Expected: clean status after any fixes; no accidental placeholder, committed credential, SAS URL, arbitrary Cypher endpoint, client import of `@klicker-uzh/knowledge-graph`, or removal of `ingest-kb-resource`.

- [ ] **Step 4: Reconcile every approved invariant.**

  Manually trace and record evidence for: exclusive assignment, three-part publication gate, stale completion, duplicate build, conditional rollback, one-minute singleton monitoring, timeout `3600`, all-resource payload, chatbot-derived graph name, exact-blob SAS, owner/participant auth, bounded read limits, revision reset in client state, and no private download path.

- [ ] **Step 5: Commit any verification-only fixes separately.**

  Use a conventional message scoped to the actual correction; do not create an empty verification commit.

---

### Task 14: Verify the complete flow in real browsers and the external services

**Files:**

- Create locally for PR evidence: `/tmp/klicker-kg-screenshots/manage-desktop-en.png`
- Create locally for PR evidence: `/tmp/klicker-kg-screenshots/manage-desktop-de.png`
- Create locally for PR evidence: `/tmp/klicker-kg-screenshots/chat-desktop.png`
- Create locally for PR evidence: `/tmp/klicker-kg-screenshots/chat-mobile.png`
- Do not commit screenshots unless the repository's existing PR process requires it.

**Interfaces:**

- Consumes: local Klicker stack, external Hatchet client configuration, external FalkorDB connection, one real PDF and one public URL.
- Produces: user-visible and cross-system evidence for the draft PR.

- [ ] **Step 1: Start the normal local stack without a destructive reset.**

  ```bash
  ./_run_app_dependencies.sh
  pnpm run dev
  ```

  Do not pass `test`/`cypress`; do not run Prisma reset. Confirm the general worker registers both `ingest-kb-resource` and `build-chatbot-knowledge-graph`, plus the current one-minute `monitor-kb-ingestions` listener.

- [ ] **Step 2: Use delegated lecturer login and configure a graph.**

  Open the manage app through the project's normal local route with `npx agent-browser --session kg-lecturer`. Log in with delegated lecturer credentials (`lecturer` / `abcd`). On Chatbot Details, select at least one real PDF and one public URL from owned KBs, save, choose `balanced`, and rebuild.

- [ ] **Step 3: Correlate the external build.**

  Confirm:

  - the graph row is `QUEUED` with attempt/revision;
  - one local task is accepted;
  - one external `course-kg-ingestion` run has every selected source;
  - `course_id` is the chatbot UUID;
  - `falkordb_graph_name` is `klickeruzh:<chatbot UUID>`;
  - its run ID is persisted;
  - the one-minute monitor advances to `PROCESSING`, then `READY`;
  - `builtRevision === selectionRevision`.

- [ ] **Step 4: Verify lecturer interactions and locales.**

  At 1440x1000, verify resource availability, Save/Rebuild states, status, preview, node click, edge click, double-click expansion, keyboard `Expand connections`, search, pan/zoom, fit, reset, truncation copy, and Retry. Repeat the configuration/status surface in German. Capture both manage screenshots.

- [ ] **Step 5: Verify participant desktop and mobile.**

  Log in through the normal participant flow with `testuser1` / `abcdabcd`, open the chatbot, switch Chat -> Knowledge graph, and repeat select/search/expand/detail interactions. Capture 1440x1000 desktop and iPhone 14 mobile states. Verify 44px targets, bottom detail sheet, live-region/DOM controls, and no console errors.

  Representative commands after navigation:

  ```bash
  npx agent-browser --session kg-student set viewport 1440 1000
  npx agent-browser --session kg-student snapshot -i
  npx agent-browser --session kg-student screenshot /tmp/klicker-kg-screenshots/chat-desktop.png
  npx agent-browser --session kg-student set device "iPhone 14"
  npx agent-browser --session kg-student screenshot /tmp/klicker-kg-screenshots/chat-mobile.png
  npx agent-browser --session kg-student errors
  ```

- [ ] **Step 6: Verify immediate stale-content closure.**

  While the participant graph is open, change the lecturer selection and save. On the participant's next read/retry, confirm the canvas clears and shows unavailable/updating. Rebuild successfully and confirm a fresh revision replaces, rather than merges with, old client state.

- [ ] **Step 7: Stop only processes/forwards started for this verification.**

  Close both browser sessions and stop the local dev processes and port-forwards opened in this task. Do not kill unrelated user processes.

---

### Task 15: Independently review, push, and open the draft PR to `kb-poc`

**Files:**

- Modify only to address accepted review findings.
- Update: the draft PR body/comment with full-branch summary, verification, environment requirements, and screenshots.

**Interfaces:**

- Consumes: verified current branch and the full `origin/kb-poc...HEAD` diff.
- Produces: reviewed remote branch and draft PR targeting `kb-poc`; no merge.

- [ ] **Step 1: Request an independent final branch review.**

  Have a separate reviewer inspect the complete `origin/kb-poc...HEAD` diff for publication-gate races, authorization, source/SAS leakage, bounded query safety, client/server imports, maintainability, and UI accessibility. Integrate accepted findings one at a time; explicitly record any evidence-backed deferrals.

- [ ] **Step 2: Run the required strict maintainability review.**

  Invoke `$thermo-nuclear-code-quality-review` before marking the PR ready for merge. For this draft, fix critical/high-confidence findings and document lower-priority deferrals. Do not merge.

- [ ] **Step 3: Confirm branch and remote scope.**

  ```bash
  git status --short
  git branch --show-current
  git log --oneline origin/kb-poc..HEAD
  git diff --stat origin/kb-poc...HEAD
  ```

  Expected: clean worktree on `feat/kb-poc-management-ui`; the history/body includes the whole branch against `kb-poc`, including the earlier KB bridge work and this graph feature.

- [ ] **Step 4: Push and create or update the draft PR.**

  ```bash
  git push -u origin feat/kb-poc-management-ui
  gh pr create --draft --base kb-poc --head feat/kb-poc-management-ui --title "feat(chat): add chatbot knowledge graph visualization" --body-file /tmp/klicker-kg-pr-body.md
  ```

  If a PR for this head already exists, update its full body with `gh pr edit` instead of creating a duplicate. The body must cover architecture, selection/publication semantics, external Hatchet/Falkor configuration, tests, real smoke evidence, known POC limits, and all four screenshots.

- [ ] **Step 5: Check the draft PR and CI.**

  ```bash
  gh pr view --web=false
  gh pr checks --watch
  ```

  Expected: PR base is `kb-poc`, state is draft, screenshots render, and checks are reported. Fix branch-caused failures; report unrelated/external failures with links and evidence. Do not mark ready or merge without explicit user approval.
