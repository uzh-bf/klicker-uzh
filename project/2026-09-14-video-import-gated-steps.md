# Course video import lane: gated deployment and database steps

Parent plan `project/2026-09-14-course-chatbot-video-import-plan.md`, slices S1 and S2. Drafted 2026-09-14 on
branch `rs/course-video-import-plan`; nothing here has been executed.

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

## Authority

S1 (STG, then PRD) is a deployment and secret-delivery change; S2 (STG, then PRD) is a live database write.
Each needs separate explicit approval per environment; neither is implied by the other. Values are read
through the restricted operator path only and must never be committed, printed, logged, or pasted into a
receipt. This drafting task executed none of it.
