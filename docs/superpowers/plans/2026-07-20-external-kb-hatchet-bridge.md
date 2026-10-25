---
type: Implementation Plan
title: External KB Hatchet Bridge Implementation Plan
description: Implement the POC bridge from Klicker resource ingestion to an external Hatchet workflow.
timestamp: '2026-07-20'
tags:
  - kb
  - hatchet
  - ingestion
---

# External KB Hatchet Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing KB POC so one resource and a user-selected speed mode are dispatched through Klicker's existing local Hatchet task to a workflow on a separately configured Hatchet instance, then monitored by one local minute cron until the existing signed webhook advances the UI to `READY` or `FAILED`.

**Architecture:** GraphQL atomically creates a latest-attempt UUID and queues the unchanged local `ingest-kb-resource` task. That task keeps its current privacy-safe log, creates a temporary blob read SAS only when required, and uses a lazy second Hatchet SDK client to start or recover the external run. PostgreSQL stores only the latest attempt/run metadata. A non-overlapping local `monitor-kb-ingestions` cron discovers all active runs from PostgreSQL, checks them sequentially through the external SDK, and calls Klicker's existing signed webhook with the attempt UUID as a stale-write guard.

**Tech Stack:** TypeScript 5.6, Node.js 24, Prisma 6/PostgreSQL, Pothos GraphQL, React/Next.js/Apollo, `@hatchet-dev/typescript-sdk` 1.9.4, `@azure/storage-blob` 12.25.0, Vitest 3.2, Helm/Kubernetes, pnpm/Turborepo.

## Global Constraints

- Preserve the implementation record in `project/2026-07-15-pr-5174-kb-poc-plan.md`. This is a follow-on bridge, not a rewrite of that plan.
- Do not remove or replace the S5 `KB ingestion dispatch stub` log in `packages/hatchet/src/index.ts`. The external dispatch happens after that awaited log.
- Trigger exactly one external source: the resource whose row-level Ingest button was clicked.
- Use the stable KB UUID as `course_id`, the stable resource UUID as `source_id`, and `klickeruzh:<KB UUID>` as `falkordb_graph_name`.
- Keep `upload_markdown` and `export_to_falkordb` fixed to `true`.
- Keep KB containers private. Do not change media-library visibility or move KB blobs into media containers.
- Mint blob-scoped read-only, HTTPS-only SAS URLs for one hour with five minutes of clock-skew allowance. Include the approved comment that the duration may need adjustment for larger files or slower workflows.
- Do not persist or log SAS URLs, access keys, Hatchet tokens, webhook secrets, or raw external SDK errors.
- Normalize URL resources through the shared public-HTTP URL guard at registration and immediately before dispatch. Reject credentials and local/private/reserved literal destinations; deployment testing must also prove DNS and redirect egress controls in the external namespace.
- Do not change the external Python workflow and do not require it to call Klicker's webhook.
- Store only the latest attempt/run metadata; do not add an ingestion-history table, outbox, or webhook inbox.
- Default speed mode to `balanced` in the UI and do not persist it as a KB resource preference.
- Use one cron sweep per minute, not one sleeping or scheduled task per resource.
- Default `KB_INGESTION_TIMEOUT_SECONDS` to `3600`; reject a present non-positive or non-integer value at general-worker startup.
- Keep external addresses, workflow name, and credentials environment-configured. Do not hard-code Kubernetes namespaces, service names, tenant IDs, or tokens.
- Use `apply_patch` for hand-authored edits, Prettier for formatting, and conventional commits after each independently green task.
- Do not modify dependencies outside the exact additions listed in Task 4.

---

## File Structure

### New files

- `packages/prisma/src/prisma/schema/migrations/20260720120000_kb_external_ingestion_bridge/migration.sql` — nullable latest-attempt columns on `KBResource`.
- `packages/util/src/kbWebhook.ts` — server-safe, byte-exact webhook signing helper shared by GraphQL and the worker.
- `packages/util/test/kbWebhook.test.ts` — signing contract tests independent of GraphQL/database setup.
- `packages/hatchet/src/kbIngestion.ts` — external-client configuration, SAS generation, exact payload creation, retry recovery, webhook sending, and singleton sweep logic.
- `packages/hatchet/test/kbIngestion.test.ts` — deterministic bridge and sweeper tests with mocked Azure/Hatchet/HTTP boundaries.
- `packages/hatchet/vitest.config.ts` — node Vitest configuration matching other server packages.

### Modified files

- `packages/prisma/src/prisma/schema/knowledge.prisma` — `ingestionAttemptId`, `externalWorkflowRunId`, and `externalWorkflowStartedAt`.
- `apps/analytics/prisma/schema/knowledge.prisma` — ignored local mirror refreshed by `pnpm run prisma:sync`; verify it but do not stage it.
- `packages/util/src/index.ts` — export the shared signing helper.
- `packages/graphql/src/services/knowledgeWebhooks.ts` — import/re-export the helper and require matching attempt IDs.
- `packages/graphql/test/knowledgeWebhooks.test.ts` — current/stale attempt transition coverage.
- `packages/types/src/hatchet.ts` — speed-mode type and attempt-correlated local task input.
- `packages/graphql/src/schema/knowledge.ts` — `KBSpeedMode` enum mapped to lowercase internal values.
- `packages/graphql/src/schema/mutation.ts` — required `speedMode` argument on `ingestKbResource`.
- `packages/graphql/src/graphql/ops/MIngestKbResource.graphql` — generated-client mutation variable.
- `packages/graphql/src/services/knowledge.ts` — new attempt claim, metadata clearing/rollback, and enriched local task payload.
- `packages/graphql/test/knowledge.test.ts` — mode mapping, attempt metadata, rollback, and race assertions.
- `packages/hatchet/src/index.ts` — retain the S5 log, invoke the bridge, add final-failure handling, and register the singleton sweep.
- `packages/hatchet/package.json` and `pnpm-lock.yaml` — exact direct dependencies/test script required by the worker package.
- `apps/hatchet-worker-general/src/index.ts` — worker-only timeout validation before connections start.
- `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx` — per-resource speed selector and selected mutation value.
- `packages/i18n/messages/en.ts` and `packages/i18n/messages/de.ts` — selector labels/options.
- `apps/hatchet-worker-general/.env.example` — local placeholders for the external Hatchet, timeout, webhook, and storage configuration.
- `turbo.json` — global environment allow-list.
- `deploy/charts/klicker-uzh-v3/values.yaml` — non-secret external bridge values and the 3600-second default.
- `deploy/charts/klicker-uzh-v3/templates/cm-hatchet-workers.yaml` — general-worker non-secret environment mapping.
- `project/2026-07-15-pr-5174-kb-poc-plan.md` — append follow-on implementation evidence only after verification; do not rewrite S5.
- Draft PR #5182 body/comment — whole-branch summary, configuration checklist, test evidence, and screenshots.

---

## Task 1: Add Latest-Attempt Persistence

**Files:**

- Modify: `packages/prisma/src/prisma/schema/knowledge.prisma`
- Create: `packages/prisma/src/prisma/schema/migrations/20260720120000_kb_external_ingestion_bridge/migration.sql`
- Generate locally (ignored): `apps/analytics/prisma/schema/knowledge.prisma`

- [x] **Step 1: Confirm the new fields are absent**

Run:

```bash
rg -n "ingestionAttemptId|externalWorkflowRunId|externalWorkflowStartedAt" packages/prisma/src/prisma/schema/knowledge.prisma
```

Expected: exit code 1 and no matches.

- [x] **Step 2: Extend `KBResource` with the approved nullable fields**

Add after `ingestedAt`:

```prisma
  ingestionAttemptId       String?   @db.Uuid
  externalWorkflowRunId    String?
  externalWorkflowStartedAt DateTime?
```

Keep them nullable so existing rows and the first deployment migrate without a backfill.

- [x] **Step 3: Add the additive SQL migration**

Create the exact migration:

```sql
ALTER TABLE "public"."KBResource"
ADD COLUMN "ingestionAttemptId" UUID,
ADD COLUMN "externalWorkflowRunId" TEXT,
ADD COLUMN "externalWorkflowStartedAt" TIMESTAMP(3);
```

Do not edit the already-applied `20260715213657_kb_poc_schema` migration.

- [x] **Step 4: Regenerate and mirror the schema**

Run:

```bash
pnpm --filter @klicker-uzh/prisma generate
pnpm run prisma:sync
pnpm --filter @klicker-uzh/prisma check
```

Expected: Prisma generation and TypeScript checks pass; `apps/analytics/prisma/schema/knowledge.prisma` contains the same three fields.

- [x] **Step 5: Verify migration application against the disposable/local database**

Run:

```bash
pnpm --filter @klicker-uzh/prisma prisma:deploy:raw
```

Expected: migration `20260720120000_kb_external_ingestion_bridge` applies successfully. Use a disposable database if the current local database must not be mutated.

- [x] **Step 6: Commit Task 1**

```bash
git add packages/prisma/src/prisma/schema/knowledge.prisma packages/prisma/src/prisma/schema/migrations/20260720120000_kb_external_ingestion_bridge/migration.sql
git commit -m "feat(kb): track latest external ingestion attempt"
```

---

## Task 2: Share the Webhook Signer and Correlate Transitions

**Files:**

- Create: `packages/util/src/kbWebhook.ts`
- Create: `packages/util/test/kbWebhook.test.ts`
- Modify: `packages/util/src/index.ts`
- Modify: `packages/graphql/src/services/knowledgeWebhooks.ts`
- Modify: `packages/graphql/test/knowledgeWebhooks.test.ts`

- [x] **Step 1: Write the failing shared signing tests**

Cover:

```ts
const rawBody = Buffer.from('{"resourceId":"abc"}')

expect(
  signKBIngestionWebhook({
    rawBody,
    secret: 'secret',
    timestamp: 1_721_488_400,
  })
).toEqual({
  'x-kb-timestamp': '1721488400',
  'x-kb-signature': createHmac('sha256', 'secret')
    .update(Buffer.concat([Buffer.from('1721488400.'), rawBody]))
    .digest('hex'),
})
```

Also prove that two bodies with the same decoded JSON but different raw bytes produce different signatures.

Run:

```bash
pnpm --filter @klicker-uzh/util exec vitest run test/kbWebhook.test.ts
```

Expected: FAIL because `kbWebhook.ts` does not exist.

- [x] **Step 2: Move the byte-exact helper without changing its API**

Implement `packages/util/src/kbWebhook.ts` with the current `Buffer.concat`, timestamp header, and HMAC-SHA256 hex behavior. Export it from `packages/util/src/index.ts`.

In `knowledgeWebhooks.ts`, replace the local implementation with:

```ts
import { signKBIngestionWebhook } from '@klicker-uzh/util'

export { signKBIngestionWebhook } from '@klicker-uzh/util'
```

Keep `timingSafeEqual` local to verification.

- [x] **Step 3: Make the webhook payload attempt-correlated**

Extend the parsed payload:

```ts
type KBIngestionWebhookPayload = {
  resourceId: string
  ingestionAttemptId: string
  status: 'PROCESSING' | 'READY' | 'FAILED'
  statusMessage?: string
}
```

Validate both UUIDs with the existing UUID pattern. Add the attempt guard to the single atomic update:

```ts
where: {
  id: payload.resourceId,
  ingestionAttemptId: payload.ingestionAttemptId,
  status: { in: allowedSources },
}
```

Continue returning `{ statusCode: 200, body: { ok: true } }` when a correctly signed stale attempt updates zero rows.

- [x] **Step 4: Update the integration fixture and add the stale-attempt regression**

Use fixed valid UUIDs for `ingestionAttemptId` and `staleAttemptId`. Store the current ID in `beforeEach`, include it in every valid payload, and add:

```ts
it('does not let a stale attempt mutate the latest ingestion', async () => {
  const request = createRequest({
    resourceId,
    ingestionAttemptId: staleAttemptId,
    status: 'READY',
  })

  await expect(
    handleKBIngestionWebhook({ prisma, ...request })
  ).resolves.toEqual({ statusCode: 200, body: { ok: true } })
  await expect(getResource()).resolves.toMatchObject({
    ingestionAttemptId,
    status: KBResourceStatus.QUEUED,
    ingestedAt: null,
  })
})
```

Add a malformed-attempt UUID test returning 400 before database mutation.

- [x] **Step 5: Run focused tests and type checks**

```bash
pnpm --filter @klicker-uzh/util exec vitest run test/kbWebhook.test.ts
pnpm --filter @klicker-uzh/util build
pnpm --filter @klicker-uzh/graphql exec vitest run test/knowledgeWebhooks.test.ts
pnpm --filter @klicker-uzh/util check
pnpm --filter @klicker-uzh/graphql check
```

Expected: all tests and checks pass; the old GraphQL export path remains usable.

- [x] **Step 6: Commit Task 2**

```bash
git add packages/util/src/kbWebhook.ts packages/util/test/kbWebhook.test.ts packages/util/src/index.ts packages/graphql/src/services/knowledgeWebhooks.ts packages/graphql/test/knowledgeWebhooks.test.ts
git commit -m "feat(kb): correlate signed ingestion callbacks"
```

---

## Task 3: Carry Speed Mode and a Fresh Attempt Through GraphQL

**Files:**

- Modify: `packages/types/src/hatchet.ts`
- Modify: `packages/graphql/src/schema/knowledge.ts`
- Modify: `packages/graphql/src/schema/mutation.ts`
- Modify: `packages/graphql/src/graphql/ops/MIngestKbResource.graphql`
- Modify: `packages/graphql/src/services/knowledge.ts`
- Modify: `packages/graphql/test/knowledge.test.ts`
- Generate: `packages/graphql/src/ops.ts`
- Generate: `packages/graphql/src/ops.schema.json`
- Generate: `packages/graphql/src/public/schema.graphql`
- Generate: `packages/graphql/src/public/client.json`
- Generate: `packages/graphql/src/public/server.json`

- [x] **Step 1: Write failing service tests for mode, metadata, rollback, and races**

Update the owned URL and BLOB expectations so the local payload contains:

```ts
{
  resourceId: resource.id,
  kbId: created.id,
  ingestionAttemptId: expect.stringMatching(UUID_PATTERN),
  speedMode: 'balanced',
  // existing discriminated resource fields remain unchanged
}
```

Add parameterized cases for `balanced`, `quality`, and `fast`. Add a case starting from a resource with old attempt/run metadata and assert that an accepted click stores a new attempt ID and clears both external fields. Extend the concurrent-click test to assert exactly one new attempt and exactly one local dispatch.

Extend failed-local-dispatch coverage so the conditional rollback restores the pre-click status, message, `ingestedAt`, attempt ID, run ID, and run start only when the new attempt is still current.

Run:

```bash
pnpm --filter @klicker-uzh/graphql exec vitest run test/knowledge.test.ts
```

Expected: FAIL because the API and payload do not yet accept the new fields.

- [x] **Step 2: Define one shared lowercase speed-mode contract**

In `packages/types/src/hatchet.ts` add:

```ts
export const kbIngestionSpeedModes = ['balanced', 'quality', 'fast'] as const
export type KBIngestionSpeedMode = (typeof kbIngestionSpeedModes)[number]
```

Add these required fields to `IngestKBResourceInputBase`:

```ts
ingestionAttemptId: string
speedMode: KBIngestionSpeedMode
```

- [x] **Step 3: Add the GraphQL enum and required mutation argument**

In `schema/knowledge.ts`, map GraphQL enum names to the lowercase internal contract:

```ts
export const KBSpeedMode = builder.enumType('KBSpeedMode', {
  values: {
    BALANCED: { value: 'balanced' },
    QUALITY: { value: 'quality' },
    FAST: { value: 'fast' },
  } as const,
})
```

In `schema/mutation.ts` require `speedMode` beside `id`. In `MIngestKbResource.graphql` use:

```graphql
mutation IngestKbResource($id: ID!, $speedMode: KBSpeedMode!) {
  ingestKbResource(id: $id, speedMode: $speedMode) {
    id
    status
  }
}
```

GraphQL itself now rejects values outside the three enum members.

- [x] **Step 4: Generate and conditionally claim the latest attempt**

Change the service signature to receive `speedMode: KBIngestionSpeedMode`. Generate one `randomUUID()` before the conditional claim. The successful claim must set:

```ts
data: {
  status: DB.KBResourceStatus.QUEUED,
  statusMessage: null,
  ingestedAt: null,
  ingestionAttemptId,
  externalWorkflowRunId: null,
  externalWorkflowStartedAt: null,
}
```

Pass `ingestionAttemptId` and `speedMode` in the local task payload. On local `runNoWait` failure, restore the complete pre-click snapshot only with:

```ts
where: {
  id: resource.id,
  status: DB.KBResourceStatus.QUEUED,
  ingestionAttemptId,
}
```

This retains the existing S5 claim/rollback behavior while preventing a stale failure from reverting a newer attempt.

- [x] **Step 5: Regenerate GraphQL and run the focused checks**

```bash
pnpm --filter @klicker-uzh/graphql generate
pnpm --filter @klicker-uzh/graphql exec vitest run test/knowledge.test.ts test/knowledgeWebhooks.test.ts
pnpm --filter @klicker-uzh/types check
pnpm --filter @klicker-uzh/graphql check
```

Expected: all mode/attempt/race tests pass and generated operation types expose `KbSpeedMode`.

- [x] **Step 6: Commit Task 3**

Stage the hand-written and generated GraphQL artifacts reported by `git status`, then:

```bash
git commit -m "feat(kb): add correlated speed-aware ingestion attempts"
```

---

## Task 4: Implement the External Hatchet Dispatch Bridge

**Files:**

- Create: `packages/hatchet/src/kbIngestion.ts`
- Create: `packages/hatchet/test/kbIngestion.test.ts`
- Create: `packages/hatchet/vitest.config.ts`
- Modify: `packages/hatchet/package.json`
- Modify: `pnpm-lock.yaml`

- [x] **Step 1: Add only the worker package's direct runtime/test dependencies**

Add exact versions already used by the monorepo:

```json
{
  "dependencies": {
    "@azure/storage-blob": "12.25.0",
    "@klicker-uzh/util": "workspace:*"
  },
  "devDependencies": {
    "vitest": "~3.2.4"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Run:

```bash
pnpm install
```

Expected: only the `@klicker-uzh/hatchet` importer changes in `pnpm-lock.yaml`; no package version upgrades.

- [x] **Step 2: Add the node Vitest configuration and failing contract tests**

Mirror `packages/util/vitest.config.ts`. In `kbIngestion.test.ts`, mock the SDK boundary, Prisma calls, clock, and webhook fetch. Add failing tests for:

- absent timeout returns 3600;
- `0`, negative, decimal, non-numeric, and whitespace-only present timeouts throw;
- the dedicated external Hatchet env names populate `token`, `host_port`, `api_url`, nested `tls_config.tls_strategy`, and workflow name;
- URL input is unchanged;
- BLOB SAS is scoped to the exact container/blob, has `sp=r`, `spr=https`, starts five minutes before the fixed clock, and expires one hour after it;
- payload equality for all agreed Python fields and exactly one `sources` entry;
- `additionalMetadata` contains only the attempt-correlation key/value added by Klicker;
- an existing persisted run ID prevents lookup/trigger;
- a run found by attempt metadata is persisted without triggering a duplicate;
- a new `runNoWait` result is persisted with its ID/start time;
- losing the attempt-guard update causes best-effort cancellation;
- neither logger calls nor thrown user-facing errors contain a SAS URL or raw SDK error.

Run:

```bash
pnpm --filter @klicker-uzh/hatchet test
```

Expected: FAIL because `kbIngestion.ts` does not exist.

- [x] **Step 3: Implement strict environment parsing and the lazy client**

Export `getKBIngestionTimeoutSeconds(env = process.env)` and `validateKBIngestionWorkerConfig(env = process.env)`. The latter calls the parser but does not instantiate a client.

Export a lazy `getExternalHatchetClient()` that initializes `HatchetClient` only on first dispatch/sweep with:

```ts
HatchetClient.init({
  token,
  host_port: hostPort,
  api_url: apiUrl,
  tls_config: { tls_strategy: tlsStrategy },
})
```

Require the five dedicated external Hatchet variables. Accept only `tls`, `mtls`, or `none`. Do not read the local `HATCHET_*` variables as fallback.

- [x] **Step 4: Implement exact source URL and payload construction**

Use these named constants:

```ts
const KB_BLOB_SAS_CLOCK_SKEW_MS = 5 * 60 * 1000
const KB_BLOB_SAS_VALIDITY_MS = 60 * 60 * 1000
// This duration may need adjustment for larger files or slower ingestion workflows in future modifications.
```

For BLOB input, build a `StorageSharedKeyCredential`, obtain the selected blob client's URL, and append `generateBlobSASQueryParameters` with `BlobSASPermissions.parse('r')`, `SASProtocol.Https`, `startsOn`, and `expiresOn`. For URL input, return `sourceUrl` unchanged.

Build exactly:

```ts
{
  course_id: input.kbId,
  sources: [{ source_id: input.resourceId, source_url: sourceUrl }],
  upload_markdown: true,
  export_to_falkordb: true,
  falkordb_graph_name: `klickeruzh:${input.kbId}`,
  speed_mode: input.speedMode,
}
```

Never log or persist `sourceUrl`.

- [x] **Step 5: Implement idempotent external dispatch**

Export `dispatchKBIngestion(input, dependencies)` and use this order:

1. Read the resource by ID and exit if its attempt ID differs or its status is not `QUEUED`/`PROCESSING`.
2. Return the stored `externalWorkflowRunId` if present.
3. Call `client.runs.list` with the configured workflow name, `additionalMetadata: { klickerKBIngestionAttemptId: input.ingestionAttemptId }`, `onlyTasks: false`, `includePayloads: false`, `limit: 1`, and `since: new Date(resource.updatedAt.getTime() - KB_BLOB_SAS_CLOCK_SKEW_MS)`.
4. If a matching row exists, use `workflowRunExternalId` and `new Date(row.createdAt)` without calling `runNoWait`.
5. Otherwise create the source URL and call:

```ts
const run = await client.runNoWait(workflowName, payload, {
  additionalMetadata: {
    klickerKBIngestionAttemptId: input.ingestionAttemptId,
  },
})
const runId = await run.getWorkflowRunId()
```

6. Persist the run ID and start time with `updateMany` guarded by resource ID, current attempt ID, active local status, and `externalWorkflowRunId: null`. For a new run, capture the start time immediately before `runNoWait`; for a recovered run, use its returned `createdAt`.
7. If that update affects zero rows, call `client.runs.cancel({ ids: [runId] })` best-effort and return without mutating the resource.

The attempt-metadata lookup is the retry recovery for an accepted run whose first response/persistence was ambiguous. Do not add an outbox in this POC.

- [x] **Step 6: Make errors retryable but privacy-safe**

Let configuration, Azure, and SDK failures throw so local Hatchet applies its configured retries. Log only a stable category plus resource/KB/attempt identifiers. Do not interpolate `error.message` into the UI status or any log that could contain a URL/token.

- [x] **Step 7: Run bridge tests and package checks**

```bash
pnpm --filter @klicker-uzh/hatchet test
pnpm --filter @klicker-uzh/hatchet check
pnpm --filter @klicker-uzh/hatchet build
```

Expected: all bridge tests pass and Rollup includes `kbIngestion.js` through the `index.ts` export/import graph.

- [x] **Step 8: Commit Task 4**

```bash
git add packages/hatchet/src/kbIngestion.ts packages/hatchet/test/kbIngestion.test.ts packages/hatchet/vitest.config.ts packages/hatchet/package.json pnpm-lock.yaml
git commit -m "feat(kb): dispatch selected resources to external Hatchet"
```

---

## Task 5: Register Final-Failure Handling and the Singleton Sweeper

**Files:**

- Modify: `packages/hatchet/src/kbIngestion.ts`
- Modify: `packages/hatchet/test/kbIngestion.test.ts`
- Modify: `packages/hatchet/src/index.ts`
- Modify: `apps/hatchet-worker-general/src/index.ts`

- [x] **Step 1: Add failing signed-webhook and sweep tests**

Test `sendKBIngestionStatus` with a fixed clock and secret. Assert the POST body contains:

```json
{
  "resourceId": "<resource UUID>",
  "ingestionAttemptId": "<attempt UUID>",
  "status": "PROCESSING"
}
```

Assert `content-type: application/json`, the exact shared signature headers, and rejection on non-2xx responses.

Add sweep cases for every SDK status:

| External    | Expected local webhook action   |
| ----------- | ------------------------------- |
| `QUEUED`    | none                            |
| `RUNNING`   | `PROCESSING`                    |
| `COMPLETED` | `READY`                         |
| `FAILED`    | `FAILED` with sanitized message |
| `CANCELLED` | `FAILED` with sanitized message |

Add timeout coverage using a configured value different from 3600: a non-terminal run older than the limit gets `runs.cancel({ ids: [runId] })` and then a `FAILED` webhook even if cancellation rejects. Add multiple resources and prove one status-query or webhook failure does not stop later rows.

Run:

```bash
pnpm --filter @klicker-uzh/hatchet test
```

Expected: FAIL because status posting/sweeping is not implemented.

- [x] **Step 2: Implement the shared signed webhook sender**

Serialize the payload once to `Buffer`, sign those exact bytes with `signKBIngestionWebhook`, and POST the same bytes to `KB_WEBHOOK_URL`. Require `KB_WEBHOOK_URL` and `KB_WEBHOOK_SECRET` only when sending. Return no response body to callers and throw a generic error for non-2xx responses.

The final local dispatch failure reports:

```ts
{
  status: 'FAILED',
  statusMessage: 'The external ingestion workflow could not be started.',
}
```

The webhook attempt guard makes a delayed local failure a no-op after a newer click.

- [x] **Step 3: Implement one sequential database-driven sweep**

Query only rows matching:

```ts
where: {
  status: { in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING] },
  ingestionAttemptId: { not: null },
  externalWorkflowRunId: { not: null },
  externalWorkflowStartedAt: { not: null },
}
```

Process with `for ... of`, not `Promise.all`. For each row:

1. Fetch `client.runs.get_status(runId)`.
2. If `COMPLETED`, `FAILED`, or `CANCELLED`, report the mapped terminal status.
3. If `QUEUED`/`RUNNING` exceeds the configured timeout, cancel best-effort and report `FAILED` with `External ingestion timed out.`
4. Otherwise report `PROCESSING` only for `RUNNING`; leave `QUEUED` unchanged.
5. Catch/log a sanitized per-resource category and continue.

Checking terminal status before timeout prevents a completed run from being mislabeled when a sweep occurs just after the duration boundary.

- [x] **Step 4: Retain S5 and register both local tasks**

In `packages/hatchet/src/index.ts`, keep this log unchanged in place:

```ts
await ctx.logger.info('KB ingestion dispatch stub', {
  resourceId: input.resourceId,
  kbId: input.kbId,
  type: input.type,
})
```

Immediately after it, call `dispatchKBIngestion`. Keep `retries: 3`. Add an `onFailure` handler with its own retries that calls the signed failure reporter for the same input/attempt.

Register:

```ts
const monitorKBIngestions = hatchet.task({
  name: 'monitor-kb-ingestions',
  onCrons: ['* * * * *'],
  concurrency: {
    expression: '"monitor-kb-ingestions"',
    maxRuns: 1,
    limitStrategy: ConcurrencyLimitStrategy.CANCEL_NEWEST,
  },
  fn: async () => monitorActiveKBIngestions(),
})
```

Return `monitorKBIngestions` from `prepareHatchetTasks`; the general worker's existing dynamic selection then registers it automatically. Do not add it to the GraphQL-context `PreparedHatchetTasks` interface because GraphQL never triggers the cron directly.

- [x] **Step 5: Validate timeout only in the actual general worker process**

At the beginning of `main()` in `apps/hatchet-worker-general/src/index.ts`, call `validateKBIngestionWorkerConfig()` before Redis clients are created. This intentionally validates the timeout at worker startup while preserving lazy external-client configuration.

Do not validate in `prepareHatchetTasks()`: the GraphQL backend also calls that function to obtain task declarations, and external worker configuration must not prevent the API from starting.

- [x] **Step 6: Test the declaration and worker startup behavior**

Add a lightweight mocked `hatchet.task` assertion or exported declaration constants proving:

- cron is exactly `* * * * *`;
- concurrency expression is constant;
- `maxRuns` is 1;
- strategy is `CANCEL_NEWEST`;
- local dispatch logging occurs before bridge dispatch;
- final-failure webhook carries the same attempt ID.

Run:

```bash
pnpm --filter @klicker-uzh/hatchet test
pnpm --filter @klicker-uzh/hatchet check
pnpm --filter @klicker-uzh/hatchet-worker-general check
```

Expected: all tests/checks pass. A process started with `KB_INGESTION_TIMEOUT_SECONDS=abc` exits during startup; an absent value resolves to 3600.

- [x] **Step 7: Commit Task 5**

```bash
git add packages/hatchet/src/kbIngestion.ts packages/hatchet/test/kbIngestion.test.ts packages/hatchet/src/index.ts apps/hatchet-worker-general/src/index.ts
git commit -m "feat(kb): monitor external ingestion runs with one cron"
```

---

## Task 6: Add the Per-Click Speed Selector

**Files:**

- Modify: `packages/kb-management/src/components/KnowledgeBaseResourceList.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

- [x] **Step 1: Establish the browser validation path before editing UI**

Read `.agents/skills/agent-browser/SKILL.md` completely. Confirm that the real manage app can be reached after:

```bash
./_run_app_dependencies.sh
pnpm run dev
```

Use delegated local credentials `lecturer` / `abcd`; do not use Edu-ID. Record the working route, normally `http://manage.klicker.com/resources/knowledgeBases` or the direct local manage port when routing is unavailable.

- [x] **Step 2: Add localized labels with exact EN/DE parity**

Add keys:

```ts
speedModeLabel
speedModeBalanced
speedModeQuality
speedModeFast
```

English: `Speed`, `Balanced`, `Quality`, `Fast`.

German: `Geschwindigkeit`, `Ausgewogen`, `Qualität`, `Schnell`.

- [x] **Step 3: Render one controlled selector per resource row**

Import generated `KbSpeedMode` and the design-system `Select`. Keep a per-resource state map whose missing value resolves to `KbSpeedMode.Balanced`. Render three items and stable selectors. Compose `Select` with a sibling native label because design-system 4.1.6 `SelectField` does not forward its ID or ARIA labeling to the Radix combobox trigger:

```ts
data={{ cy: `kb-speed-mode-${resource.id}` }}
```

Use item selectors `kb-speed-mode-balanced`, `kb-speed-mode-quality`, and `kb-speed-mode-fast`. Disable the selector while that resource is active or while any row mutation is in flight, matching the current Ingest button behavior.

Update `handleIngest` to send:

```ts
variables: {
  id: resource.id,
  speedMode: speedModeByResource[resource.id] ?? KbSpeedMode.Balanced,
}
```

The state may remain for the current mounted page but is never persisted to the server or resource model.

- [x] **Step 4: Verify types, formatting, and translations**

```bash
pnpm --filter @klicker-uzh/kb-management check
pnpm --filter @klicker-uzh/frontend-manage check
pnpm exec prettier --check packages/kb-management/src/components/KnowledgeBaseResourceList.tsx packages/i18n/messages/en.ts packages/i18n/messages/de.ts
```

Expected: checks pass and EN/DE `kb.*` keys remain identical.

- [x] **Step 5: Run the mandatory real browser walkthrough**

With the local dependencies, backend, local Hatchet worker, and manage app running:

1. Log in through delegated access.
2. Open an existing KB with at least two resources.
3. Confirm both selectors initially show Balanced.
4. Select Quality for one row and Fast for the other.
5. Click Ingest on only the first row.
6. Confirm the GraphQL variables contain `QUALITY` and only that resource becomes `QUEUED`.
7. Confirm the second resource is unchanged and its Fast choice is not sent.
8. Recheck at 375 px and in German.

Capture committed screenshots under:

- `project/screenshots/kb-external-ingestion-speed-en-desktop.png`
- `project/screenshots/kb-external-ingestion-speed-de-mobile.png`

- [x] **Step 6: Commit Task 6**

```bash
git add packages/kb-management/src/components/KnowledgeBaseResourceList.tsx packages/i18n/messages/en.ts packages/i18n/messages/de.ts project/screenshots/kb-external-ingestion-speed-en-desktop.png project/screenshots/kb-external-ingestion-speed-de-mobile.png
git commit -m "feat(kb): select ingestion speed per resource"
```

---

## Task 7: Wire Local and Kubernetes Configuration

**Files:**

- Modify: `apps/hatchet-worker-general/.env.example`
- Modify: `turbo.json`
- Modify: `deploy/charts/klicker-uzh-v3/values.yaml`
- Modify: `deploy/charts/klicker-uzh-v3/templates/cm-hatchet-workers.yaml`

- [x] **Step 1: Add documented local placeholders without credentials**

Add to `apps/hatchet-worker-general/.env.example`:

```dotenv
KB_INGESTION_HATCHET_CLIENT_TOKEN=__KB_INGESTION_HATCHET_CLIENT_TOKEN__
KB_INGESTION_HATCHET_CLIENT_HOST_PORT=__KB_INGESTION_HATCHET_CLIENT_HOST_PORT__
KB_INGESTION_HATCHET_API_URL=__KB_INGESTION_HATCHET_API_URL__
KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY=none
KB_INGESTION_HATCHET_WORKFLOW_NAME=__KB_INGESTION_HATCHET_WORKFLOW_NAME__
KB_INGESTION_TIMEOUT_SECONDS=3600
BLOB_STORAGE_ACCOUNT_NAME=__BLOB_STORAGE_ACCOUNT_NAME__
BLOB_STORAGE_ACCESS_KEY=__BLOB_STORAGE_ACCESS_KEY__
```

Keep the existing `KB_WEBHOOK_URL` and `KB_WEBHOOK_SECRET`. Do not add real namespace/service addresses or secrets.

- [x] **Step 2: Add every new variable to Turbo's allow-list**

Add the six `KB_INGESTION_*` variables. `BLOB_STORAGE_*` and `KB_WEBHOOK_*` are already present; do not duplicate them.

- [x] **Step 3: Define non-secret Helm values**

Under `hatchet`, add:

```yaml
kbIngestion:
  clientHostPort: ''
  apiUrl: ''
  tlsStrategy: 'none'
  workflowName: ''
  timeoutSeconds: 3600
  webhookUrl: ''
```

Reuse the existing top-level `blobStorage.accountName`. Do not add token, webhook-secret, or access-key values to the ConfigMap section.

- [x] **Step 4: Map only non-secrets into the general-worker ConfigMap**

Add:

```yaml
KB_INGESTION_HATCHET_CLIENT_HOST_PORT:
  { { .Values.hatchet.kbIngestion.clientHostPort | quote } }
KB_INGESTION_HATCHET_API_URL: { { .Values.hatchet.kbIngestion.apiUrl | quote } }
KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY:
  { { .Values.hatchet.kbIngestion.tlsStrategy | quote } }
KB_INGESTION_HATCHET_WORKFLOW_NAME:
  { { .Values.hatchet.kbIngestion.workflowName | quote } }
KB_INGESTION_TIMEOUT_SECONDS:
  { { .Values.hatchet.kbIngestion.timeoutSeconds | quote } }
KB_WEBHOOK_URL: { { .Values.hatchet.kbIngestion.webhookUrl | quote } }
BLOB_STORAGE_ACCOUNT_NAME: { { .Values.blobStorage.accountName | quote } }
```

The existing `*-secret-hatchet-worker-general` reference must receive these keys out-of-repo through the deployment secret-management process:

- `KB_INGESTION_HATCHET_CLIENT_TOKEN`
- `KB_WEBHOOK_SECRET`
- `BLOB_STORAGE_ACCESS_KEY`

Do not create a chart-managed Secret containing those values.

- [x] **Step 5: Render and inspect the chart**

Run:

```bash
helm template klicker deploy/charts/klicker-uzh-v3 --set hatchet.kbIngestion.timeoutSeconds=3600 --set blobStorage.accountName=testaccount | rg "KB_INGESTION_|KB_WEBHOOK_URL|BLOB_STORAGE_ACCOUNT_NAME"
```

Expected: seven non-secret ConfigMap entries appear with timeout `3600`; token, secret, and access key do not appear in rendered ConfigMap data.

- [x] **Step 6: Run config checks and commit**

```bash
pnpm exec prettier --check turbo.json apps/hatchet-worker-general/.env.example deploy/charts/klicker-uzh-v3/values.yaml deploy/charts/klicker-uzh-v3/templates/cm-hatchet-workers.yaml
git diff --check
```

Then:

```bash
git add apps/hatchet-worker-general/.env.example turbo.json deploy/charts/klicker-uzh-v3/values.yaml deploy/charts/klicker-uzh-v3/templates/cm-hatchet-workers.yaml
git commit -m "chore(kb): configure external Hatchet ingestion bridge"
```

---

## Task 8: Full Verification and Cluster Smoke Test

**Files:**

- Modify after evidence exists: `project/2026-07-15-pr-5174-kb-poc-plan.md`
- Modify after review: draft PR #5182 body or comment

- [x] **Step 1: Run all targeted deterministic tests**

```bash
pnpm --filter @klicker-uzh/util exec vitest run test/kbWebhook.test.ts
pnpm --filter @klicker-uzh/graphql exec vitest run test/knowledge.test.ts test/knowledgeWebhooks.test.ts
pnpm --filter @klicker-uzh/hatchet test
```

Expected: shared signer, GraphQL/database, bridge/retry/SAS, and sweeper suites are all green.

- [x] **Step 2: Run package and application checks**

```bash
pnpm --filter @klicker-uzh/prisma check
pnpm --filter @klicker-uzh/types check
pnpm --filter @klicker-uzh/util check
pnpm --filter @klicker-uzh/hatchet check
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/hatchet-worker-general check
pnpm --filter @klicker-uzh/kb-management check
pnpm --filter @klicker-uzh/frontend-manage check
```

Expected: all focused type checks pass.

- [x] **Step 3: Run whole-repository quality gates**

```bash
pnpm run check:all
opengrep scan --config auto packages/hatchet/src/kbIngestion.ts packages/graphql/src/services/knowledge.ts packages/graphql/src/services/knowledgeWebhooks.ts packages/util/src/kbWebhook.ts
git diff --check
```

Expected: repository checks pass. Classify any repository-wide pre-existing Opengrep findings separately; no new finding may be ignored without explicit rationale.

- [x] **Step 4: Run a local end-to-end status loop**

Using mocked/local external Hatchet configuration where appropriate:

1. Trigger one resource from the real manage UI.
2. Confirm PostgreSQL stores a new attempt ID and later the external run ID/start time.
3. Confirm the local worker log still contains `KB ingestion dispatch stub` and never prints the source URL.
4. Confirm one minute sweep reports `PROCESSING` and then `READY`/`FAILED` through the HTTP webhook.
5. Confirm Apollo polling renders those states without a manual reload.
6. Confirm a stale signed callback using the previous attempt ID returns 200 but does not mutate the resource.

Capture terminal-state screenshots if they differ materially from the existing S7 screenshots.

- [ ] **Step 5: Run the real cluster smoke test after configuration is installed**

Manual deployment prerequisite (2026-07-20): the external Hatchet
host/API/TLS/workflow values and the three out-of-repo secrets have not yet
been installed in the general-worker deployment, so the real cluster smoke
test cannot run from this branch workspace. Local deterministic and real-UI
status-loop verification is complete; keep this checkbox open until deployment
configuration is available.

Configure the external Hatchet host/API/TLS/workflow values and the three secrets in the general-worker deployment. Then:

1. Upload a real PDF to its existing private `kb-<user UUID>` container.
2. Select a non-default speed once and click only that resource's Ingest button.
3. Confirm the external run input has one source, the exact KB/resource UUID mapping, fixed booleans, graph name, selected lowercase speed, and a working blob-scoped SAS.
4. Confirm the external run metadata contains the attempt UUID and the run ID/start time are stored on `KBResource`.
5. Confirm `monitor-kb-ingestions` runs once per minute without overlap and advances the UI.
6. Confirm FalkorDB contains `klickeruzh:<KB UUID>` and the resource becomes `READY`.
7. Exercise an external failure or cancellation and confirm the resource becomes `FAILED` with a sanitized message.
8. Confirm no external workflow call to Klicker's webhook is configured or required.

If cluster credentials/configuration are not yet available, mark only this step as a manual deployment prerequisite; deterministic local tests must still be complete.

- [x] **Step 6: Perform the required independent reviews**

Before publishing the final branch update:

1. Run a security-focused review of SAS scope/expiry, secret handling, webhook correlation, ownership, and logged data.
2. Run `$thermo-nuclear-code-quality-review` and resolve or explicitly defer each maintainability finding.
3. Have a separate review agent inspect the complete branch diff against `kb-poc`, with particular attention to task registration in both the backend and worker processes.
4. Re-run affected tests after accepted fixes.

- [x] **Step 7: Update the original implementation record without rewriting S5**

Append a dated follow-on progress entry to `project/2026-07-15-pr-5174-kb-poc-plan.md` that states:

- S5's existing log was retained;
- external dispatch is a separately approved follow-on bridge;
- selected-resource/speed behavior;
- one-hour private blob SAS behavior and its future-size comment;
- latest-attempt/run fields;
- singleton one-minute sweep and 3600-second timeout;
- tests, browser evidence, cluster result or explicit cluster prerequisite.

Do not edit the original S5 evidence into claiming it originally contained the external call.

- [x] **Step 8: Commit final evidence if needed**

```bash
git add project/2026-07-15-pr-5174-kb-poc-plan.md project/screenshots
git commit -m "docs(kb): record external ingestion bridge verification"
```

Skip this commit if no files changed.

---

## Task 9: Push and Update Draft PR #5182

**Files/Systems:**

- Git branch: `feat/kb-poc-management-ui`
- Target branch: `kb-poc`
- GitHub draft PR: `https://github.com/uzh-bf/klicker-uzh/pull/5182`

- [ ] **Step 1: Audit the whole branch against the target**

```bash
git status --short
git log --oneline kb-poc..HEAD
git diff --stat kb-poc...HEAD
git diff --check kb-poc...HEAD
```

Expected: worktree clean, intended commits only, and no whitespace errors.

- [ ] **Step 2: Push the complete branch**

```bash
git push origin feat/kb-poc-management-ui
```

- [ ] **Step 3: Update the draft PR as a whole-branch description**

Follow the repository's PR-writing/publishing workflow. The body or a structured comment must include:

- the full KB management POC plus this follow-on bridge, not only the latest commit;
- explicit statement that the S5 log remains;
- architecture and attempt-correlation summary;
- exact non-secret variables and the three out-of-repo secret keys;
- private SAS scope/expiry and URL-resource reachability requirement;
- deterministic test/check results;
- desktop/mobile screenshots;
- real cluster smoke result or a clearly unchecked deployment prerequisite;
- residual cross-system ambiguity and out-of-scope outbox/history work.

Keep PR #5182 in draft state. Do not merge or mark ready without explicit user approval.

- [ ] **Step 4: Check CI and address branch-caused failures**

```bash
gh pr checks 5182 --watch
```

Expected: all required checks pass. Diagnose exact logs before changing code; do not alter unrelated pre-existing failures.

---

## Final Self-Review Checklist

- [ ] No `TODO`, placeholder branch, fake success, sleep, or per-resource monitor task was introduced.
- [ ] The literal `KB ingestion dispatch stub` log still exists and precedes the external dispatch call.
- [ ] The external payload has exactly one selected source and no Klicker-only attempt field.
- [ ] The attempt UUID appears in external `additionalMetadata`, local persistence guards, and signed webhook payloads.
- [ ] Blob SAS is read-only, HTTPS-only, blob-scoped, one hour, clock-skew tolerant, and contains the approved future-file-size comment.
- [ ] No SAS URL or secret appears in application logs, database fields, screenshots, commits, or PR text.
- [ ] URL resources pass both public-destination guards; external DNS and redirect egress controls are verified before lecturer exposure.
- [ ] Only the latest attempt/run metadata is stored.
- [ ] External terminal statuses and timeout map through the signed webhook; the external workflow itself does not call Klicker.
- [ ] The sweep is database-driven, once per minute, non-overlapping, sequential, and failure-isolated.
- [ ] `KB_INGESTION_TIMEOUT_SECONDS` defaults to 3600 and invalid present values fail only the general worker's initialization.
- [ ] GraphQL backend startup does not require external Hatchet worker configuration.
- [ ] All environment variables are present in `.env.example`, Turbo, and Helm as applicable; secrets remain outside ConfigMaps.
- [ ] GraphQL codegen, Prisma generation/sync, focused tests, package checks, root checks, browser validation, and review gates are complete.
- [ ] PR #5182 still targets `kb-poc` and remains draft.
