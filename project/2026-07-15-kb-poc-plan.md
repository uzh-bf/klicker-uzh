# KB Management POC — Plan

Caveman form. Junior-executable. Read whole plan before slice 1.

## Plan Identity

- Plan: `project/2026-07-15-kb-poc-plan.md`
- Branch: `kb-poc` (worktree `trees/kb-poc`), base + target: `v3` (@ `e05743901`)
- PR: TBD (draft PR carries this plan first, then slices)
- History:
  - [PR #5078](https://github.com/uzh-bf/klicker-uzh/pull/5078) — full-scale KB control-plane prototype (`codex/kb-management-ui` → `v3-ai`). Too large for MVP. This POC supersedes it as the mergeable path. Reference only — do NOT cherry-pick wholesale.
  - Review of 5078: `project/2026-07-07_pr5078_kb_review.md` on the 5078 branch — catalog of its bugs/gaps. POC avoids them by design (see Decisions).
  - `project/KB_PLAN.md` (merged, `03ca4aaa5`) — older plan, KB UI inside `frontend-manage`. **Superseded**: product decision = separate app.

## Goal

Thin end-to-end tracer for knowledge base management:

1. Data model (slim) — reviewable on its own.
2. Separate lecturer app `apps/frontend-kb` (port 3005, `kb.klicker.com`).
3. File upload to Azure Blob Storage (SAS pattern).
4. "Ingest" button → Hatchet task (simulated external ingestion service).
5. Signed webhook updates resource status.
6. Nice UX: auto-refresh (polling), status badges, empty/loading states.

## Non-Goals (POC)

- No real ingestion/vector/graph service. Hatchet task SIMULATES one.
- No chat-runtime consumption of KBs.
- No website/snippet/klicker-object resources. Files only.
- No metadata profiles, graph settings, refresh scheduling, chatbot/course links.
- No deploy workflows, Helm chart, image builds. Local dev only.
- No Playwright/Cypress E2E (data-cy attrs mandatory anyway, tests later).
- No generic component package (`packages/kb-management` from 5078 dropped — UI lives in the app).

## Decisions (veto window: before slice 1 merges)

| # | Decision | Why |
|---|---|---|
| D1 | Separate app `apps/frontend-kb`, Pages Router, modeled on `frontend-manage` | User direction. Manage = proven lecturer auth+Apollo template. Supersedes KB_PLAN.md in-manage approach. |
| D2 | Target `v3` (not `v3-ai`) | User direction: branch from v3. |
| D3 | Model names `KB`, `KBResource` — same as 5078, slim fields | Future convergence with 5078 learnings cheap. |
| D4 | Worker never touches DB. Status updates ONLY via signed webhook | Preserves production topology: ingestion will be external service. Tracer must exercise webhook path. |
| D5 | Webhook receiver = express route in `backend-docker`, handler in `packages/graphql` | Needs Prisma; mirrors 5078 shape (`handleKBIngestionWebhook`), which was reviewed as sound. |
| D6 | Private blob containers, per-user (`kb-<userId>`), blob-scoped SAS | 5078/media-library flaw: public-read containers, container-scoped SAS. KB docs are private data. |
| D7 | DB row created AFTER upload confirmed (2 mutations) | Media-library flaw: row-before-upload orphans rows on failed PUT. |
| D8 | Auto-refresh via Apollo `pollInterval`, not subscriptions | Subscriptions plumbed but unused repo-wide (0 `useSubscription` call sites). Polling = proven pattern (`cockpit.tsx:57` etc.). |
| D9 | `Int sizeBytes`, not `BigInt` | 5078 bot finding: BigInt JSON serialization crash. 25MB cap fits Int. |
| D10 | No webhook inbox table (POC) | Idempotency via status-transition guard instead. Inbox = hardening later. |

## Grill Findings / Blockers Discovered in Research

- **BLOCKER**: backend JWT middleware only reads lecturer cookie when request `Origin` contains `manage` or `control` — `apps/backend-docker/src/app.ts:84-99`. `kb.klicker.com` silently unauthenticated. 5078 never fixed this (its wired app cannot auth). Slice 2 fixes it.
- **BLOCKER**: `apps/auth` rejects redirect hosts not in allowlist — `apps/auth/src/lib/constants.ts:21-27` (`DEFAULT_LECTURER_HOSTS` / `AUTH_LECTURER_ALLOWED_HOSTS`). kb hosts must be added.
- Repo HMAC examples are NOT timing-safe (`apps/auth/src/pages/api/discourse.ts:37` uses `!==`). Do not copy. Use `crypto.timingSafeEqual` with length guard.
- Media-library upload flow reusable but flawed (public containers, row-before-upload, no delete, no size/type validation). Copy pattern, fix flaws (D6, D7).
- `apps/chat` is participant-facing, no Apollo — wrong template. Use `frontend-manage` for auth/Apollo/i18n, `chat` for Dockerfile/eslint reference.

## Research (evidence, file:line — v3 @ e05743901)

### Blob upload (media library pattern)

- Flow: mutation mints SAS → browser PUTs direct to Azure. Backend never sees bytes.
- SAS mint service: `packages/graphql/src/services/elements.ts:1109-1168` (`getFileUploadSas`). Creds `StorageSharedKeyCredential` from env; `generateBlobSASQueryParameters`, 15 min expiry.
- Frontend PUT: `apps/frontend-manage/src/components/common/MediaLibrary.tsx:67-79` — `new BlobServiceClient(uploadSasURL)` → `getBlockBlobClient().uploadData(file, { blockSize: 4MB })`.
- Dropzone: `MediaLibrary.tsx:93-124` (react-dropzone).
- Resolver: `packages/graphql/src/schema/mutation.ts:1585-1595`; return type `FileUploadSAS` in `packages/graphql/src/schema/user.ts:100-115`.
- Env: `BLOB_STORAGE_ACCOUNT_NAME`, `BLOB_STORAGE_ACCESS_KEY` (used `elements.ts:1113-1120`; helm `deploy/charts/klicker-uzh-v2/values.yaml:31-33`).
- SDK `@azure/storage-blob` v12.25.0 in both `packages/graphql` and `apps/frontend-manage`.
- Flaws to NOT copy: container `access: 'blob'` = public read (`elements.ts:1127`); Prisma row created before PUT (`elements.ts:1152`); no delete anywhere; no size/type validation.

### Hatchet

- Client singleton: `packages/hatchet/src/client.ts:9` (`HATCHET_CLIENT_TOKEN`, `HATCHET_CLIENT_HOST_PORT`).
- Tasks defined in `prepareHatchetTasks()`: `packages/hatchet/src/index.ts:12`, return dict `:291-307`. Simplest template: `create-audit-log-entry` block `:41-58`.
- Types mirrored: `packages/types/src/hatchet.ts:96-138` (`PreparedHatchetTasks`).
- Trigger from resolver: `ctx.tasks.<name>.runNoWait([...])` — example `packages/graphql/src/services/courses.ts:1416`. Context wiring: `apps/backend-docker/src/index.ts:106-114`, `packages/graphql/src/lib/context.ts:33-35`.
- Worker: `apps/hatchet-worker-general/src/index.ts:60-143` auto-registers all tasks from `prepareHatchetTasks` (unless `HATCHET_WORKFLOWS` env restricts). No new worker app needed.
- Local dev: hatchet-lite in docker compose. Gotcha (memory): run worker WITHOUT `tsx --watch` — watch mode kills workers ("workflow not found").

### Webhook receiver

- backend-docker HTTP surface today: only `/healthz` + `/api/graphql` (`apps/backend-docker/src/app.ts:190-194`). Express app `:40`.
- 5078's route shape (mirror this): `express.raw({ type: 'application/json', limit })` → pass rawBody string + headers to `handleKBIngestionWebhook({ prisma, rawBody, headers })` exported from `@klicker-uzh/graphql`, return `{statusCode, body}`.
- 5078's verified-sound crypto (reimplement slim): HMAC-SHA256 over `` `${timestamp}.${rawBody}` ``, `crypto.timingSafeEqual` + length guard, 300s timestamp tolerance.

### App scaffold

- Lecturer auth template: `apps/frontend-manage/src/components/Layout.tsx:24-36` (`useQuery(UserProfileDocument)`, redirect `/login` when unauthenticated); `login.tsx:4-25` redirects to `NEXT_PUBLIC_AUTH_URL?redirectTo=...`.
- Apollo: `apps/frontend-manage/src/lib/apollo.ts` — `credentials: 'include'`, header `x-graphql-yoga-csrf: 'true'`, error-link redirect on `Unauthorized`, SSR hydration helpers.
- Cookie domain auto-covers `kb.klicker.com`: `deriveCookieDomainFromURL` strips first label (`packages/util/src/auth.ts:97-111`).
- Ops live centrally: `packages/graphql/src/graphql/ops/*.graphql` → codegen → apps import `@klicker-uzh/graphql/dist/ops`.
- `pnpm-workspace.yaml` + `turbo.json`: glob-based, no change for new app. `turbo.json` `globalEnv` needs any NEW env var names.
- Dockerfile template: `apps/chat/Dockerfile` (turbo prune pattern). POC: include file, no CI build (non-goal).
- Polling precedent: `apps/frontend-control/src/pages/session/[id].tsx:68` (1s), `apps/frontend-manage/src/pages/quizzes/[id]/cockpit.tsx:57` (2s), `evaluation.tsx:17` (5s).
- data-cy on interactive elements — Playwright `testIdAttribute: 'data-cy'` (`playwright/playwright.config.ts:41`).
- CI: `check-types.yml`/`check-lint.yml` are change-detection based (no hardcoded app list on v3). Hardcoded lists: `.github/workflows/v3_build-fallback.yml:8-21` `paths-ignore` (add `apps/frontend-kb/**`), `test-playwright.yml:104-125` artifact paths (skip — no E2E in POC).
- Local routing (all needed for `kb.klicker.com` / devcontainer):
  - `.devrouter.yml:19-92` — add kb app entry, upstream port 3005.
  - `.devcontainer/docker-compose.devrouter.yml:9-27` — add `kb.klicker.localhost` extra_hosts (plain + workspace-suffixed).
  - `util/traefik/rules_docker.yaml` — router + service → `host.docker.internal:3005`; mirror `util/traefik/rules_wsl.yaml`.
  - `docs/getting-started.md:41-46` — add `kb` to devrouter loop + port list.

## Architecture (POC loop)

```
Browser (kb.klicker.com:3005)
  │ 1. MRequestKbFileUpload ──► GraphQL: validate type/size, mint blob-scoped SAS (no DB row)
  │ 2. PUT bytes ─────────────► Azure Blob (private container kb-<userId>)
  │ 3. MConfirmKbFileUpload ──► GraphQL: create KBResource (UPLOADED)
  │ 4. MIngestKbResource ─────► GraphQL: status=QUEUED, ctx.tasks.ingestKBResource.runNoWait
  │                                            │
  │                              Hatchet worker (simulated ingestion, NO DB access)
  │                                │ POST /api/webhooks/kb-ingestion (HMAC signed)
  │                                ▼ PROCESSING … sleep ~5s … READY | FAILED
  │ 5. poll QGetKb (2s while active) ◄── backend-docker route → knowledgeWebhooks service → status update
```

Status lifecycle: `UPLOADED → QUEUED → PROCESSING → READY | FAILED`. Re-ingest allowed from `READY`/`FAILED`/`UPLOADED`.

## Data Model (slice 1 deliverable — copy this)

New file `packages/prisma/src/prisma/schema/knowledge.prisma`:

```prisma
enum KBResourceStatus {
  UPLOADED
  QUEUED
  PROCESSING
  READY
  FAILED
}

model KB {
  id          String  @id @default(uuid()) @db.Uuid
  name        String
  description String?

  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  ownerId String @db.Uuid

  resources KBResource[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
}

model KBResource {
  id String @id @default(uuid()) @db.Uuid

  title            String
  originalFilename String
  mimeType         String
  sizeBytes        Int
  blobName         String
  blobHref         String

  status        KBResourceStatus @default(UPLOADED)
  statusMessage String?
  ingestedAt    DateTime?

  kb   KB     @relation(fields: [kbId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  kbId String @db.Uuid

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([kbId, status])
}
```

Plus `user.prisma`: add `kbs KB[]` relation on `User`.

Deliberately absent vs 5078 (add later, not now): resource kinds, website/snippet fields, graph fields, metadata profiles, counts, refresh scheduling, ingestion-run table, webhook inbox, course/chatbot link tables, soft delete.

## Env Vars (new)

| Var | Where | Value (dev) |
|---|---|---|
| `KB_WEBHOOK_SECRET` | backend-docker + hatchet-worker-general | dev-only literal in `.devcontainer/devcontainer.env`; Infisical elsewhere. Webhook returns 503 (no detail) when unset. |
| `KB_WEBHOOK_URL` | hatchet-worker-general | `http://localhost:3000/api/webhooks/kb-ingestion` — valid because dev worker runs on the same host/devcontainer as backend-docker. If the worker ever runs as its own container (`docker-compose.build.yml`), use the backend service hostname instead. |
| `APP_KB_SUBDOMAIN` | backend-docker | default `kb` (origin-gate check) |
| `NEXT_PUBLIC_KB_URL` | apps/auth (redirect), frontend-kb env files | `https://kb.klicker.com` |

All new names → `turbo.json` `globalEnv`. Reuse existing `BLOB_STORAGE_ACCOUNT_NAME`/`BLOB_STORAGE_ACCESS_KEY` (same storage account, new containers).

## Skill Routing

- Browser verification: `agent-browser` skill, delegated login (`lecturer`/`abcd`), per repo CLAUDE.md. Mandatory for every UI slice.
- Review: per-slice review subagent + simplification subagent (rubric in `$rs-sliced-development-workflow` references).
- Finish: `$rs-mr-description-writer`, `$security-review`, `$thermo-nuclear-code-quality-review`.

## Slices

Rules for every slice: implement → verify (commands below) → review subagent → simplify subagent → update `Progress` → commit ONLY that slice's files (conventional message given). i18n: user-visible strings go to `packages/i18n/messages/en.ts` + `de.ts` (`kb.*` keys) as they appear. Interactive elements get `data-cy`.

Apollo rule (every UI mutation): pass `refetchQueries: [{ query: <matching query document> }]` to `useMutation` (pattern: `apps/frontend-manage/src/pages/quizzes/[id]/cockpit.tsx:106,115`, `MediaLibrary.tsx:81`). Without it the UI never reflects the change and every browser Check fails while the backend is fine.

Prisma accessor gotcha: model `KB` generates client accessor `ctx.prisma.kB` (lowercased first letter). Not a typo.

### S1 — Data model

- Do: add `knowledge.prisma` (verbatim above) + `User.kbs` relation. Run `pnpm run prisma:migrate` (name `kb_poc_schema`), `pnpm run prisma:sync`, regenerate client.
- Check: `pnpm run prisma:migrate` applies cleanly; new tables visible in `pnpm run prisma:studio`; `pnpm --filter @klicker-uzh/prisma build` green; `apps/analytics` schema mirror updated. (`pnpm run prisma:setup` also works but WIPES + reseeds the whole dev DB — only use it when that is acceptable.)
- Commit: `feat(packages/prisma): add slim KB and KBResource models for KB POC`
- STOP after commit: this slice is the "review the data model" gate. Push, request review on the draft PR before continuing.

### S2 — Auth gate + app shell + routing (end-to-end login tracer)

- Do:
  - `apps/backend-docker/src/app.ts:84-99`: extend lecturer-cookie origin check with `APP_KB_SUBDOMAIN ?? 'kb'` (same style as manage/control checks).
  - `apps/auth/src/lib/constants.ts:21-27`: add kb hosts (mirror every manage entry: `kb.klicker.com`, `kb.klicker.localhost`, localhost:3005 variants).
  - Scaffold `apps/frontend-kb`: Pages Router. Copy from `frontend-manage`: `package.json` (trim deps; port 3005; name `@klicker-uzh/frontend-kb`), `next.config.mjs` (drop PWA), `tsconfig.json`, tailwind/postcss config, `src/lib/apollo.ts`, `_app.tsx`, `login.tsx`, minimal `Layout` with `UserProfileDocument` guard. Env files (`.env.development` etc.) with `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_URL`, `NEXT_PUBLIC_KB_URL`. Dockerfile from `apps/chat` (rename filters). Index page: "Knowledge Bases" heading + logged-in user email.
  - Routing: `.devrouter.yml`, `.devcontainer/docker-compose.devrouter.yml`, `util/traefik/rules_docker.yaml` + `rules_wsl.yaml`, `docs/getting-started.md` (see Research → App scaffold for exact locations).
  - `turbo.json` globalEnv: `APP_KB_SUBDOMAIN`, `NEXT_PUBLIC_KB_URL`.
- Check: `pnpm install` clean; `pnpm --filter @klicker-uzh/frontend-kb check` green; agent-browser: open kb app → redirected to auth → delegated login `lecturer`/`abcd` → back on kb page, user shown. Screenshot.
- Commit: `feat(apps/frontend-kb): scaffold lecturer KB app with auth and local routing`

### S3 — KB CRUD (end-to-end)

- Do:
  - Service `packages/graphql/src/services/knowledge.ts`: `getUserKbs`, `getKb` (owner-scoped, throws/null on foreign), `createKb(name, description?)`, `deleteKb(id)`. Every function asserts ownership. Shared helper, use everywhere:
    ```ts
    async function getOwnedKbOrThrow(ctx, id: string) {
      const kb = await ctx.prisma.kB.findUnique({ where: { id } })
      if (!kb || kb.ownerId !== ctx.user.sub) throw new GraphQLError('KB not found')
      return kb
    }
    ```
  - Pothos types `packages/graphql/src/schema/knowledge.ts` (`KB`, `KBResource`); wire into query/mutation builders. Do NOT expose `blobName`/`blobHref` on the GraphQL `KBResource` type — internal infrastructure detail, UI never needs it (no download feature in POC).
  - Ops: `QGetUserKbs.graphql`, `QGetKb.graphql`, `MCreateKb.graphql`, `MDeleteKb.graphql`. Run `pnpm --filter @klicker-uzh/graphql generate`.
  - UI: KB list (cards or table), each KB links to detail page `/[id]` (Next.js `Link`; detail page itself built in S4 — placeholder page with KB name is enough here), create dialog (name + description), delete with confirm dialog (`@uzh-bf/design-system` Modal — no `window.confirm`), empty state WITH create CTA (5078 flaw: empty state hid the create button).
- Check: `pnpm --filter @klicker-uzh/graphql test` (add vitest cases: create/list/delete + foreign-owner denial); agent-browser: create KB, see it listed, delete it, empty state shows CTA. Screenshots.
- Commit: `feat(kb): knowledge base CRUD across graphql and frontend-kb`

### S4 — File upload to blob storage (end-to-end)

- Do:
  - Service: `requestKbFileUpload(kbId, fileName, contentType, sizeBytes)` — assert KB ownership; validate contentType against allowlist const (`application/pdf`, `text/plain`, `text/markdown`) and `sizeBytes <= 25 * 1024 * 1024`; ensure PRIVATE container `kb-<userId>` (`createIfNotExists()` with NO access option); blob name `<uuid>.<ext>`; blob-scoped SAS, `BlobSASPermissions.parse('cw')`, 15 min. NO DB row here.
  - Service: `confirmKbFileUpload(kbId, blobName, title, originalFilename, mimeType, sizeBytes)` — validate blobName shape (uuid.ext) to prevent path tricks; check `blobClient.exists()` server-side and reject if the blob was never uploaded (a client could otherwise confirm without uploading); then create `KBResource` status `UPLOADED`.
  - Service: `deleteKbResource(id)` — `blobClient.deleteIfExists()` THEN row delete. `deleteKb` extended: delete all resource blobs, then KB row (cascade). Server-side blob clients (exists/delete) are built with `StorageSharedKeyCredential` + `BlobServiceClient` from `BLOB_STORAGE_ACCOUNT_NAME`/`BLOB_STORAGE_ACCESS_KEY` (same construction as `elements.ts:1113-1125`) — NOT with the upload SAS (it has no delete permission).
  - Ops: `MRequestKbFileUpload`, `MConfirmKbFileUpload`, `MDeleteKbResource`; regenerate.
  - UI: KB detail page `pages/[id].tsx` — dropzone (react-dropzone, pattern `MediaLibrary.tsx:67-124`), resource table (title, size, status badge, updated), per-row delete. Upload errors surfaced (toast), not swallowed.
- Check: vitest: validation rejects bad mime/size/foreign KB; agent-browser: upload PDF → appears as UPLOADED; upload .exe → clean error; delete removes row. Verify blob exists then gone (Azure/Azurite or storage explorer; if local storage unavailable, document manual check in PR). Screenshots.
- Commit: `feat(kb): file upload to private blob storage with confirm-after-upload flow`

### S5 — Ingestion trigger via Hatchet

- Do:
  - Task `ingest-kb-resource` in `packages/hatchet/src/index.ts` (copy `create-audit-log-entry` block `:41-58`; add to return dict `:291-307` + `packages/types/src/hatchet.ts`). Input `{ resourceId, kbId, blobName, containerName, title }` — payload self-contained so worker needs no DB. Webhook target comes ONLY from `KB_WEBHOOK_URL` env, never from task input.
  - Handler (simulated ingestion, HTTP only — D4): POST signed webhook `PROCESSING` → sleep 5s → POST `READY` (or `FAILED` with message when title contains `fail` — deterministic failure path for demos/tests).
  - Signing helper in worker: HMAC-SHA256 hex over `` `${timestamp}.${rawBody}` ``, headers `x-kb-timestamp` + `x-kb-signature`, secret `KB_WEBHOOK_SECRET`, target `KB_WEBHOOK_URL` (env).
  - Service: `ingestKbResource(id)` — ownership; allowed from `UPLOADED`/`READY`/`FAILED`; set `QUEUED`; `ctx.tasks.ingestKBResource.runNoWait(...)`. If task push fails: revert to previous status + surface error (5078 flaw: dispatch failures silently dropped).
  - Op `MIngestKbResource`; run `pnpm --filter @klicker-uzh/graphql generate`. UI: "Ingest" button per row (disabled while QUEUED/PROCESSING).
  - Env wiring: `KB_WEBHOOK_URL`, `KB_WEBHOOK_SECRET` → worker env files, `.devcontainer/devcontainer.env`, `turbo.json` globalEnv.
- Check: worker registers task (start WITHOUT `tsx --watch` — watch kills Hatchet workers, see project memory); click Ingest → status QUEUED in UI; worker log shows webhook POSTs firing (endpoint 404s until S6 — that's expected, log it).
- Commit: `feat(kb): hatchet ingestion task and ingest trigger mutation`

### S6 — Webhook status updates (loop closes)

- Do:
  - `packages/graphql/src/services/knowledgeWebhooks.ts`: export `handleKBIngestionWebhook({ prisma, rawBody, headers })` → `{statusCode, body}`. Re-export it from the package barrel `packages/graphql/src/index.ts` (otherwise the `@klicker-uzh/graphql` import in `app.ts` fails at build). Verify: secret configured (503 generic if not), timestamp within 300s, HMAC via `crypto.timingSafeEqual` with length guard (do NOT copy `discourse.ts:37` `!==` compare). Parse payload `{ resourceId, status: PROCESSING|READY|FAILED, statusMessage? }`, allow-list status values, transition guard (PROCESSING only from QUEUED/PROCESSING; READY/FAILED only from QUEUED/PROCESSING — stale/duplicate events → 200 no-op). Set `ingestedAt` on READY.
  - Route in `apps/backend-docker/src/app.ts`: `app.post('/api/webhooks/kb-ingestion', express.raw({ type: 'application/json', limit: '1mb' }), ...)` — mirror 5078's route shape (see Research → Webhook receiver).
- Check: vitest on `handleKBIngestionWebhook`: valid sig OK; bad sig 401; stale timestamp 401; bad status 400; illegal transition no-op; missing secret 503. Live: click Ingest → watch UPLOADED→QUEUED→PROCESSING→READY in DB (`pnpm run prisma:studio`) and via curl'd query; upload file titled `fail-test` → FAILED with message.
- Commit: `feat(kb): signed ingestion webhook updating resource status`

### S7 — UX polish + auto-refresh

- Do:
  - Polling: KB detail query — single approach, no mixing: `useQuery(GetKbDocument, { variables, pollInterval: anyActive ? 2000 : 0 })` where `anyActive` = any resource `QUEUED`/`PROCESSING` from the previous result. Do NOT also call `startPolling`/`stopPolling` (repo has zero call sites; conditional `pollInterval` is enough — Apollo restarts polling when the option changes).
  - Status badges: color + label per status (UPLOADED gray, QUEUED amber, PROCESSING amber+spinner, READY green, FAILED red with statusMessage tooltip), loading skeletons, empty states with CTA, toasts on upload/ingest/delete, disabled states during mutations.
  - Responsive pass: usable at 375px width (5078 flaw: mobile broken). i18n keys complete (en + de). `data-cy` on all interactive elements.
- Check: agent-browser full walkthrough: login → create KB → upload → ingest → watch badge flip live without manual reload → fail-path → delete. Screenshots desktop + mobile, EN + DE. These screenshots go in PR body.
- Commit: `enhance(apps/frontend-kb): status badges, live polling, and responsive polish`

### S8 — CI/dev wiring + finish

- Do:
  - `.github/workflows/v3_build-fallback.yml:8-21`: add `- 'apps/frontend-kb/**'` to paths-ignore.
  - Verify CI typechecking: change-detection `check-types.yml` must build `@klicker-uzh/graphql` before dependents typecheck; if `TS2307 dist` errors appear, fix the workflow build list (see AGENTS.md "New packages need a check-types.yml entry" learning).
  - `docs/getting-started.md`: kb app in port list + dev loop (if not done in S2).
  - Run `pnpm run check:all` at root; fix strays.
- Check: full CI green on PR.
- Commit: `ci: wire frontend-kb into build-fallback and dev docs`
- Then finish gate (below).

## Finish Gate (after S8)

1. `$security-review` subagent on branch (webhook, SAS, authz surfaces). Handle or defer findings explicitly.
2. `$thermo-nuclear-code-quality-review` maintainability pass.
3. Independent final branch review (external agent per workflow defaults).
4. PR body via `$rs-mr-description-writer`: whole-branch summary, verification evidence, screenshots (S7), manual-verify checklist (Azure CORS config on storage account is out-of-repo — document), open items.
5. Mark PR ready only after user approval. Never merge without explicit user approval.

## Verification Loop (once, before S2)

- Full stack: devcontainer or local docker compose (Postgres, Redis, hatchet-lite, Traefik) + `pnpm run dev:raw` scoped to needed apps. Multistack DNS gotcha: shared devnet `postgres` alias collides across worktree stacks — pin /etc/hosts (see project memory).
- Blob storage: needs real Azure creds (`BLOB_STORAGE_ACCOUNT_NAME`/`ACCESS_KEY` via Infisical) or Azurite (`mcr.microsoft.com/azure-storage/azurite`) — if Azurite, account URL construction must honor `AZURITE`-style endpoint override; keep it simple: use the real dev storage account if available, else add compose service + note. Decide in S4, document choice in Progress.
- Browser: agent-browser, delegated login `lecturer`/`abcd`.

## Independent Plan Review

- Reviewer: `droid exec --model glm-5.2` (pre-approved external reviewer), 2026-07-15, full plan text.
- Findings: 12 (2 MAJOR, 10 MINOR). All 12 accepted and integrated:
  1. MAJOR missing Apollo `refetchQueries` guidance → global Apollo rule added to Slices section.
  2. MAJOR `KB_WEBHOOK_URL=localhost` breaks if worker containerized → caveat added to env table (dev worker runs alongside backend, so localhost is correct for the supported paths).
  3. S5 missing codegen command → added.
  4. Polling API ambiguity (pollInterval vs start/stopPolling) → single conditional-`pollInterval` approach specified.
  5. Server-side blob delete needs shared-key client, not SAS → construction spelled out in S4.
  6. `prisma:setup` is destructive → S1 check switched to non-destructive verify + warning.
  7. Unused `webhookUrl?` task input → removed; env is sole source.
  8. `getOwnedKBOrThrow` referenced code on inaccessible branch → helper inlined in S3.
  9. `blobHref`/`blobName` leaked via GraphQL type → excluded from Pothos type in S3.
  10. Barrel export for `handleKBIngestionWebhook` missing → added to S6.
  11. No list→detail navigation step → added to S3.
  12. `confirmKbFileUpload` trusts client → server-side `blobClient.exists()` check added to S4.

## Progress

- [ ] S1 data model — pending
- [ ] S2 auth gate + shell + routing — pending
- [ ] S3 KB CRUD — pending
- [ ] S4 upload + blob — pending
- [ ] S5 hatchet trigger — pending
- [ ] S6 webhook status — pending
- [ ] S7 UX polish — pending
- [ ] S8 CI wiring + finish — pending

Worktree: `trees/kb-poc` (repo `klicker-uzh`, branch `kb-poc`). Cleanup after merge: `git worktree remove trees/kb-poc && git worktree prune` (needs approval).

## Next Steps After POC (explicitly out of scope)

Real ingestion service contract (replace simulated worker), webhook inbox + outbox hardening, resource kinds (website/snippet), chat-runtime KB consumption, deploy workflows + helm, E2E tests, KB sharing/roles.
