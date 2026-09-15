# Course video import lane: gated deployment and database steps

Parent plan `project/2026-09-14-course-chatbot-video-import-plan.md`, slices S1 and S2. Drafted 2026-09-14 on
branch `rs/course-video-import-plan`. Status 2026-09-15: S1 executed on STG only (MR !581, merge `8c0c01e266`,
`app-up` changed the `backend-graphql` ExternalSecret alone); S3 is delivered on STG (deployment MR !878 ->
`9a106c0d5a`, pins MR !877 -> `661c716e`, doc-query v0.13.0). S4 item 1-2 is done: the producer merged
(`1ef6a0b7`), the STG digests were promoted (PR #124 -> `b3cfa52a`) and the one-recording proof passed on STG
(job `stg-ingestion-source-proof-20260915`, published `ingestion_source.json`, policy digest verified against
the tracked descriptor). S4 item 3 (PRD promotion) onward, and S2, remain not started and separately gated.
Update 2026-09-15: S4 item 3 is now done too — PR #125 promoted the same digests to PRD, ArgoCD
`app-video-processing` is `Synced` at `bfdccd7a` in `argo` on both clusters, and the
one-recording proof passed on PRD as well (job `prd-ingestion-source-proof-20260915`, published
35 597 B, 7 eligible / 3 quarantined / 0 excluded, same policy digest). Item 4 and the item 5
`--activate` write are blocked on blob data-plane read access for the operator identity, recorded
in the parent plan's progress. Item 5 is the only PRD corpus write this lane makes.

## Correction: the `KB` row uses `authType = 'bearer'`

The parent plan's `authType = 'scope_token'` is wrong for the deployed runtime. In
`apps/chat/src/services/mcpClients.ts`, `applyDocQueryAuthHeaders` throws
`Doc Query transport authentication is invalid` unless `authType === 'bearer'` and `authSecret` is set; it
then sends `Authorization: Bearer <decrypted secret>` plus `X-Doc-Query-Scope-Token`. The same guard is on
`origin/v3` and `origin/v3-ai`, and `packages/prisma/src/prisma/schema/chat.prisma:318` documents only
`'bearer' | 'basic' | 'none' | 'custom'`. A `scope_token` row is inert (refused by `canLoadMCPServer` in
`apps/chat/src/services/mcpScope.ts`). Stale `scope_token` text remains in
`packages/prisma-data/src/data/seedMCPServers.ts:14,37,154` and `docs/data-and-migrations.md:235`. The server
name is `'KB'` (`DOC_QUERY_MCP_SERVER_NAME`; `KB_MCP_SERVER_NAME` at
`packages/graphql/src/services/knowledge.ts:62`).

## STEP S1 - scope-signing keys on the backend-graphql workload

`packages/graphql/src/services/docQuerySources.ts` mints the ES256 scope token through
`@klicker-uzh/doc-query-client` (`packages/doc-query-client/src/docQueryScopeToken.ts`), which reads
`DOC_QUERY_SCOPE_PRIVATE_KEY`, `DOC_QUERY_SCOPE_KID`, `DOC_QUERY_SCOPE_ISSUER`, and `DOC_QUERY_SCOPE_AUDIENCE`
from the process environment. Those names currently reach the chat workload only. Exact files:

- `deploy/charts/klicker-uzh-v3/templates/cm-chat.yaml:33-35` projects the three non-secret names from
  `.Values.chat.docQueryScope` (defaults at `deploy/charts/klicker-uzh-v3/values.yaml:235-238`).
- `deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml:371-381` gives the backend-graphql container
  `envFrom`: `config-global`, `config-backend-graphql`, `…-secret-backend-graphql`.
- `deploy/env-uzh-stg/values.yaml` and `deploy/env-uzh-prd/values.yaml` set no `docQueryScope` block today.
- `/Users/rschlae/Git/ai/df-cloud-image-pins/src/apps/klicker/functions.ts`: `chatSecretNames` (~448-471)
  already projects the four names into `app-klicker-klicker-uzh-v2-secret-chat`; `backendGraphqlSecretNames`
  (~379-387) does not.

YAML to mirror, STG then PRD: one addition to `backendGraphqlSecretNames`. No chart change is needed, because
the Secret is already consumed by `envFrom`.

```ts
…[
  'DOC_QUERY_SCOPE_PRIVATE_KEY',
  'DOC_QUERY_SCOPE_KID',
  'DOC_QUERY_SCOPE_ISSUER',
  'DOC_QUERY_SCOPE_AUDIENCE',
].map((secretName) => convertExternalSecret(secretName)),
```

Optional chart parity: mirror the three non-secret names in `cm-backend-graphql.yaml` from a new
`backendGraphql.docQueryScope` block, rendered exactly as `cm-chat.yaml:33-35` renders them. A later `envFrom`
source wins for duplicate keys, so the Secret keeps the effective values, and the private key must never
appear in a ConfigMap. Rendered Secret: `app-klicker-klicker-uzh-v2-secret-backend-graphql`; its namespace is
inferred from `…stg-klicker.svc.cluster.local` and is unverified.

Infisical, names only: project `klicker-uzh` (`PROJECT_SLUGS_APPS.klicker` in
`/Users/rschlae/Git/ai/df-cloud-image-pins/src/apps/klicker/config.ts`), environment `stg` then `prd`, remote
keys equal to the four variable names above. `DOC_QUERY_JWT_TOKEN_KLICKER` stays outside the chart secret
boundary and is used only at S2 time
(`/Users/rschlae/Git/ai/deployment/project/2026-08-14-doc-query-tenant-secret-delivery-current-base-plan.md:80`).
The folder path inside the Infisical project is unverified.

Verification: a scope-matched read through `getKbImportedSources` (`QGetKbImportedSources.graphql`,
`packages/graphql/src/schema/query.ts:1565`, `packages/graphql/src/services/knowledge.ts:1035`) returns
non-degraded, meaning neither `Knowledge base retrieval is not configured` nor `Imported sources could not be
loaded`, and the existing chat doc-query corpus proof still passes
(`apps/chat/scripts/stg-doc-query-proof.mjs`, then `apps/chat/scripts/prd-doc-query-proof.mjs`; each enforces
its own corpus counts). Values are never committed or printed.

## STEP S2 - register the `KB` ChatbotMCPServer row

`getKbMcpServerOrThrow` resolves exactly one global row by `name = 'KB'` requiring `isActive`
(`packages/graphql/src/services/knowledge.ts:566`). The unique index is `ChatbotMCPServer_name_key` on
`("name")`, created by
`packages/prisma/src/prisma/schema/migrations/20250921094251_chatbot_mcp_credits_enhancements/migration.sql:66`,
so `ON CONFLICT ("name")` is the idempotency anchor. Row contract: `url` = STG
`http://mcp-doc-query.stg-doc-query.svc.cluster.local:1417/mcp/klicker`
(`apps/chat/scripts/stg-doc-query-proof.mjs:22-23`), PRD
`http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker`
(`packages/prisma-data/src/scripts/doc-query-cohort-activation.ts:8-12`); `authType = 'bearer'`;
`isActive = true`; `authSecret` = the encrypted transport bearer.

`authSecret` must be encrypted by the application boundary, not by SQL: `encrypt()`/`safeEncrypt()` from
`@klicker-uzh/util` (`packages/util/src/crypto.ts`, AES-256-GCM keyed by the environment `APP_SECRET`).
`safeDecrypt` passes non-ciphertext through unchanged, so a plaintext insert would be sent as-is and fail at
the transport instead of failing loudly at write. Safest concrete option: encrypt in-process.
`packages/prisma-data/src/scripts/doc-query-cohort-activation-run.ts:641-679` shows the reviewed pattern (read
`DOC_QUERY_JWT_TOKEN_KLICKER` from the operator-injected environment, encrypt once, delete it from the process
environment, write only `authSecret`); that runner also switches MCP configs and cohorts, so use a minimal
guarded upsert instead, with the ciphertext bound as a parameter:

```sql
INSERT INTO "ChatbotMCPServer" (id, name, description, url, "authType", "authSecret", "passChatbotId", parameters, "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'KB', 'managed-by:course-video-import', :url, 'bearer', :encryptedBearer, false, '{}'::jsonb, true, now(), now())
ON CONFLICT ("name") DO UPDATE SET url = EXCLUDED.url, "authType" = EXCLUDED."authType",
  "authSecret" = EXCLUDED."authSecret", "isActive" = EXCLUDED."isActive", "updatedAt" = now();
```

Do not run the repo seed against STG/PRD while this row must hold: `seedMCPServers.ts:252-266` reconciles an
existing `KB` row to `http://localhost:1417/mcp`, `scope_token`, and a null `authSecret`.

Values-free readback:
```sql
SELECT name, url, "authType", "isActive", ("authSecret" IS NOT NULL) AS auth_secret_present
FROM "ChatbotMCPServer" WHERE name = 'KB';
```

Rollback: deactivate first, and delete only when no `ChatbotMCPConfig` references the row (`mcpServerId` is
`ON DELETE CASCADE`); deactivation is fail-closed, because `getKbMcpServerOrThrow` then throws
`Knowledge base retrieval is not configured`.

```sql
UPDATE "ChatbotMCPServer" SET "isActive" = false, "updatedAt" = now() WHERE name = 'KB';
DELETE FROM "ChatbotMCPServer" WHERE name = 'KB';
```

## STEP S3 - the scope-guarded inventory tool on STG and PRD

Both environments already run the standalone mcp-doc-query lineage, pinned at
`sha-a44d0bebc4d89f71e69862179087e60d0712d858-arm@sha256:81516c4c837755330d93b944adeb97d30916adb8c3a449fcc2475596594fc41c`
(= `origin/main` on 2026-09-14). That revision predates the scope-guarded companion tool, so the
service does not expose `doc_query_sources` and `getKbImportedSources` stays degraded even once S1
and S2 are done. The tool is generated only for a config with `token_scope`; the deployed Klicker
tenant configs (`pipelines/{stg,prd}-doc-query/doc-query/tenants/klicker/doc_query.yaml`) already
declare it with `claim: kb_id`, `filter_field: kb_id`, `required: true` and a per-environment ES256
key, so no configuration change is needed - only a newer image.

Gated actions, in order:

1. Merge mcp-doc-query MR !84 (`rs/kb-source-inventory` = `f54e10f`, `d8be6cf` plus a merge of
   `origin/main`; pipeline green, no review notes) into `main`.
2. Cut a release. The pin lint enforces tag shape and within-group equality only; that a pin sits
   on a release commit is a review-time fact, so record the release in the deployment MR.
3. Bump the pins and let ArgoCD sync:
   - `pipelines/prd-doc-query/doc-query/deployment.yaml` and `deployment-spot.yaml`
   - `pipelines/stg-doc-query/doc-query/deployment.yaml` and `deployment-spot.yaml`
   - `pipelines/stg-klicker/doc-query/kustomization.yaml` (last bumped to the v0.7.2-era
     `sha-4fc395d…`; the lint keeps this group separate from the shared STG overlay)
   - `.gitlab-ci.yml` (the tool-config loader pin; the lint treats it as its own group, but it is
     meant to be the STG candidate image)
   Run `python3 pipelines/lint/doc_query_image_pin_lint.py` before pushing; it also scans for pins
   outside the registered list.
4. Values-free readback: the deployed server lists `doc_query_sources`, and after S1 + S2
   `getKbImportedSources` returns non-degraded for a scope-matched KB.

## STEP S4 - producer revision with the ingestion-source policy, then the pilot import

The deployed `video-processing` revision predates the publication change and carries no policy
path (`VIDEO_PROCESSING_INGESTION_SOURCE_POLICY`), so a job finalizes and publishes nothing, and
the import fails closed with `published_source_missing` after an already-paid processing run.
The configuration for it is prepared but not released: klicker-uzh-video-ai draft PR #123
(`rs/video-ingestion-source-contract`, head `0bd22bf`) pins the submitted job id as the run
identity, publishes `artifacts/<job_id>/learning_units/ingestion_source.json` after the result
finalizes, copies the tracked descriptors to `/opt/ingestion-policies`, and names
`informatik_und_wirtschaft_hs26_eligibility_v1.json` in `deploy/base/worker-configmap.yaml`.

Gated actions, in order:

1. Merge PR #123. Publication is best-effort by contract: a missing or non-canonical descriptor
   leaves the video job successful and skips only the source, so the merge alone changes no
   processing behavior.
2. Bump the STG digest pins in `deploy/stg/kustomization.yaml` to the CI-built images for that
   merge (the repository's `deploy(...)` promotion pattern) and let ArgoCD sync. Prove it on STG
   with one recording: the job completes and the source object exists under
   `artifacts/<job_id>/learning_units/ingestion_source.json`.
3. Only after that STG proof, promote the same revision to PRD (`deploy/prd/kustomization.yaml`
   digests).
4. Run the pilot import from the data-ingestion checkout with the PRD environment from the plan's
   S4 runbook: `ingestion-cli video-import lecture --video <recording> --course structured-products`.
   Check the receipts (job status and reuse, source counts against the binding's policy digest,
   inventory counts, `prepared_count == eligible_unit_count`, stable `target_fingerprint`, and
   `quarantine_decisions` when units were held back).
5. Re-run the same command with `--activate`: the exact-count corpus write, the first write this
   lane makes to PRD.

## Authority

S1 (STG, then PRD) is a deployment and secret-delivery change; S2 (STG, then PRD) is a live database write.
S3 is a merge, a release and the doc-query pins. S4 is a producer merge, two promotions and a paid
video-processing run, followed by the PRD corpus write in the activation.
Each needs separate explicit approval per environment; neither is implied by the other. Values are read
through the restricted operator path only and must never be committed, printed, logged, or pasted into a
receipt. This drafting task executed none of it.
