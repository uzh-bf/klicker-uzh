---
title: Production deployment
sidebar_label: Production deployment
---

# Plan a production instance

**A fresh production install still needs operator-written provisioning for the first lecturer, transactional email templates and required reference data.** There is no supported one-command bootstrap for these in this source revision. Resolve these gaps before committing to a deployment; a successful schema migration alone is not a usable instance.

This page is a source-derived deployment runbook for `v3-ai`, not a tested production installer. Commands are marked **config-derived**: their paths and scripts exist in the repository, but this guide has not executed a fresh production rollout. No sample UZH secrets or external service access are supplied.

## 1. Decide the deployment boundary

Use a dedicated domain such as `klicker.example.org`, with subdomains for `manage`, `pwa`, `auth`, `api` and `response-api`; add `control` or other apps as needed. This matches the shared-cookie and redirect model more closely than unrelated domains or subpath hosting. Provide:

- DNS, valid HTTPS certificates and a reverse proxy/ingress with WebSocket support
- PostgreSQL, including migration permissions, backups and a separate runtime identity where practical
- Three separately configured Redis endpoints for execution, assessment execution and cache/pub-sub
- A Hatchet deployment with persistent state, a tenant/client token, and network access from the backend, Response API and workers
- Azure Blob media storage and an SMTP service if those workflows are offered
- A secret manager, a container registry/build system and an operator responsible for upgrades and restore tests

The local reference uses PostgreSQL 15, Redis 7 and Hatchet Lite Dev `v0.101.0`; these are development reference versions, not a production compatibility or capacity certification. In particular, do not publish the development Hatchet image/dashboard or its default credentials as a production service. Follow [Hatchet's self-hosting documentation](https://docs.hatchet.run/self-hosting) for its deployment requirements and confirm SDK/server compatibility for your selected release.

Keep databases, Redis, Hatchet control interfaces and internal MCP services off the public internet. Provide persistent storage for execution Redis and Hatchet, not just PostgreSQL: accepted or in-flight activity work can exist outside the application database.

## 2. Build for your own origins

The checked-in `.env.production`/`.env.prd` files and published UZH frontend images contain UZH URLs. **Next.js embeds `NEXT_PUBLIC_*` values at build time.** Changing a container's runtime environment does not retarget an already-built browser bundle. Build your own frontend images from one pinned commit.

Before building, prepare non-secret, operator-owned production configuration for every selected frontend in an isolated build checkout. Replace the corresponding `apps/<app>/.env.production` contents there, as the repository's image workflows do. Review every value, including API, response, auth, chat, image/avatar, telemetry and optional integration destinations. Do not commit deployment secrets or pass them as Docker build arguments. Keep server secrets out of the build context and inject them only at runtime.

Important build settings:

| Setting                                                                                            | Meaning                                                                                                                                               |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                                                                              | Browser-reachable HTTPS GraphQL URL, including `/api/graphql`                                                                                         |
| `NEXT_PUBLIC_API_URL_SSR`                                                                          | Server-side API URL used by frontends; the supplied value uses a UZH cluster service name. Treat every `NEXT_PUBLIC_*` value as public, even this one |
| `NEXT_PUBLIC_AUTH_URL`, `NEXT_PUBLIC_PWA_URL`, `NEXT_PUBLIC_MANAGE_URL`, `NEXT_PUBLIC_CONTROL_URL` | Origins of your apps                                                                                                                                  |
| `NEXT_PUBLIC_ADD_RESPONSE_URL`                                                                     | PWA response destination, normally `https://response-api.klicker.example.org/AddResponse`                                                             |
| `NEXT_PUBLIC_CHAT_URL`, assessment and LTI URLs                                                    | Explicitly configure only the integrations you intend to expose; review the UI if omitted                                                             |
| `BLOB_STORAGE_ACCOUNT_URL`                                                                         | Public media host used by the shared Next image allowlist; configure it in each applicable frontend build                                             |
| `NEXT_PUBLIC_AVATAR_BASE_PATH`, `NEXT_PUBLIC_IMAGE_BASE_PATH`                                      | Static asset locations; provide your own copied/hosted assets or review the remaining external dependency                                             |
| `NEXT_PUBLIC_MATOMO_*`                                                                             | Telemetry destinations; remove UZH tracking configuration or replace with your own                                                                    |
| `NEXT_PUBLIC_ENV`                                                                                  | Deployment classification; use `production` for production                                                                                            |

Preserve the literal `NEXT_PUBLIC_CHAT_URL=$APP_ORIGIN_CHAT` mapping in Manage's production file if building with the current Dockerfile: its build explicitly checks for that line. Set `APP_ORIGIN_CHAT` according to your deployment. This assertion is not a generic runtime configuration mechanism.

Config-derived image build examples, from the repository root after configuration review:

```bash
docker build -f apps/backend-docker/Dockerfile -t klicker-backend:selfhost .
docker build -f packages/prisma/Dockerfile -t klicker-migrator:selfhost .
docker build -f apps/frontend-manage/Dockerfile -t klicker-manage:selfhost .
```

Build the other required app/worker Dockerfiles from the same root context and commit. Use immutable release tags or digests in your deployment. The names above are local examples, not published images. Root `docker-compose.build.yml` helps enumerate builds but is neither a runtime Compose stack nor a complete list of optional AI images.

For a source build instead of Docker, use the exact Node/pnpm pins in root `package.json` (currently Node `24.21.0`, pnpm `11.5.0`). Config-derived commands are `pnpm install --frozen-lockfile` and `pnpm run build`. That root build builds the monorepo, not a production supervisor: you still need to run and configure individual services. Do not use `pnpm run dev`, which is a development wrapper with institutional secret injection.

Source: [Manage Dockerfile](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/apps/frontend-manage/Dockerfile), [image workflow](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/.github/workflows/v3_frontend-manage-docker-prd.yml), [Next configuration](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/packages/next-config/index.js).

## 3. Configure runtime services

There is no complete production `.env.example`; existing examples contain local defaults. This is a core checklist, not permission to copy those defaults into production.

| Runtime setting                                                                                   | Consumers / contract                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV=production`                                                                             | Application processes. Development/test modes relax protections and are not a way to enable missing production features                                                                          |
| `DATABASE_URL`                                                                                    | Backend, Auth, workers and other database consumers; migration image needs it as well                                                                                                            |
| `APP_SECRET`                                                                                      | Strong random signing secret shared consistently by cooperating Auth/backend/response/worker services. Never use example values                                                                  |
| `APP_ORIGIN_API`, `APP_ORIGIN_AUTH`, `APP_ORIGIN_PWA`, `APP_ORIGIN_MANAGE`, `APP_ORIGIN_CONTROL`  | Canonical origins: scheme + host, no application path. Additional LTI/assessment origins when enabled; several token issuers depend on exact matches                                             |
| `COOKIE_DOMAIN`                                                                                   | Parent domain shared by the intended apps, e.g. `.klicker.example.org`; include no scheme/path                                                                                                   |
| `APP_MANAGE_SUBDOMAIN`, `APP_STUDENT_SUBDOMAIN`, `APP_CONTROL_SUBDOMAIN`                          | Backend's origin-based cookie selection. Match your actual hosts; defaults assume `manage`, `pwa`, `control`                                                                                     |
| `NEXTAUTH_URL`                                                                                    | Auth's externally reachable origin                                                                                                                                                               |
| `AUTH_LECTURER_ALLOWED_HOSTS`, `AUTH_STUDENT_ALLOWED_HOSTS`, `AUTH_PWA_HOSTS`                     | Auth redirect host allowlists. Configure your own hosts; assessment participants use their assessment host                                                                                       |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASS`, `REDIS_TLS`                                             | Ordinary execution Redis                                                                                                                                                                         |
| `REDIS_ASSESSMENT_HOST`, `REDIS_ASSESSMENT_PORT`, `REDIS_ASSESSMENT_PASS`, `REDIS_ASSESSMENT_TLS` | Assessment execution Redis                                                                                                                                                                       |
| `REDIS_CACHE_HOST`, `REDIS_CACHE_PORT`, `REDIS_CACHE_PASS`, `REDIS_CACHE_TLS`                     | Cache/pub-sub Redis; all cooperating replicas must use the same service                                                                                                                          |
| `HATCHET_CLIENT_TOKEN`, `HATCHET_CLIENT_HOST_PORT`, `HATCHET_CLIENT_TLS_STRATEGY`                 | Backend, Response API and both workers. Use the same intended Hatchet tenant and compatible task versions                                                                                        |
| `HATCHET_API_URL`                                                                                 | HTTP API endpoint used for scheduling and management; newer client tokens may embed it. Verify that this endpoint and the gRPC endpoint target the same installation, without printing the token |
| `CORS_ALLOWED_ORIGINS`                                                                            | Response API comma-separated exact browser origins, including the assessment PWA on its separate deployment                                                                                      |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`                              | SMTP transport for backend mail                                                                                                                                                                  |
| `EMAIL_SECURE`, `EMAIL_STARTTLS`                                                                  | SMTP booleans parsed as the literal string `true`; do not substitute chart-like names such as `EMAIL_PASSWORD` or `EMAIL_REQUIRE_TLS`                                                            |

A healthy Hatchet worker connection proves the gRPC path, not HTTP scheduling. Test publication and delayed work as well as immediate responses.

**Redis TLS trap:** current clients use JavaScript truthiness for `REDIS_*_TLS`. The string `false` is nonempty and **enables TLS**. Leave the variable unset/empty for a non-TLS endpoint; set it nonempty only for an actual TLS endpoint. This differs from the SMTP booleans.

Auth derives its session-cookie domain by removing the first hostname label from `NEXTAUTH_URL`; for `auth.klicker.example.org` that is `klicker.example.org`. `COOKIE_DOMAIN` is used by other application cookies, so keep both contracts aligned. Auth supports secure cookies based on the configured HTTPS transport, with an explicit `AUTH_SECURE_COOKIES` override. Keep production HTTPS and secure-cookie settings consistent. Configure CORS at the edge as well: the current GraphQL Express middleware reflects the supplied origin with credentials, so it is not an application-origin allowlist. Do not use a wildcard public credentialed policy as your security boundary.

Runtime examples and readers: [backend](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/apps/backend-docker/src/index.ts), [cookie selection/CORS](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/apps/backend-docker/src/app.ts), [Auth model](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/docs/auth-model.md), [SMTP transport](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/packages/graphql/src/services/email.ts), [Hatchet client](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/packages/hatchet/src/client.ts).

### Media storage

Current `v3-ai` media uploads use Azure Blob Storage:

- `BLOB_STORAGE_ACCOUNT_NAME` and `BLOB_STORAGE_ACCESS_KEY` on the backend
- Optional `BLOB_STORAGE_ACCOUNT_URL` for the public account endpoint; otherwise the code uses `https://<account>.blob.core.windows.net`
- Optional `BLOB_STORAGE_INTERNAL_ACCOUNT_URL` for server-side access; browsers must still reach the public endpoint

The backend creates a container named after the lecturer's user ID with public blob-read access, issues a short-lived write SAS, and stores the public URL in `MediaFile.href`. The browser uploads directly using the Azure SDK. Configure Blob CORS for your exact Manage origin, required PUT/GET/HEAD requests and Azure upload headers, and test a real browser upload. The account must permit the code's public-blob model and container creation. **Media-library uploads are not private course-document storage.** Do not place confidential material in a publicly readable media container.

Keep the public URL stable: element content and activity snapshots can contain absolute media URLs. Copying objects to a new account/provider does not rewrite those references. Back up both objects and database records.

A separate S3 capability is being developed for the core media library. It is **not available merely by following this guide or using the legacy v1/v2 MinIO settings**. Do not set guessed S3 variables on an unmodified v3 deployment. Optional knowledge-base source handling and generation artifacts have separate Azure-specific integrations; a media adapter does not imply they become provider-neutral.

Source: [getFileUploadSas](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/packages/graphql/src/services/elements.ts), [media browser upload](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/apps/frontend-manage/src/components/common/MediaLibrary.tsx), [endpoint resolution](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/packages/util/src/blobStorage.ts).

## 4. Migrate, then bootstrap accounts and reference data

1. Provision a clean PostgreSQL database and verify the target identity without printing its connection string
2. Apply the migration history from the exact application release before starting the new applications/workers
3. Provision the first lecturer and email templates using an operator-reviewed, non-destructive procedure; see the current gaps below
4. Start dependencies, workers and applications, then run the acceptance checklist in [Operations](./operations.md#first-run-acceptance)

Config-derived migration command for a source checkout with dependencies installed and `DATABASE_URL` securely injected:

```bash
pnpm --filter @klicker-uzh/prisma run prisma:deploy:raw
```

This executes `prisma migrate deploy`; it does not seed users or email templates. Alternatively run the dedicated migration image built from `packages/prisma/Dockerfile` with only the target `DATABASE_URL`. The backend runtime image does not contain the migration CLI. Do not substitute `prisma:setup`, `prisma:reset`, `prisma:push`, development migrations, or the full development seed on retained data. Root `prisma:deploy` is an Infisical wrapper, not the portable command above.

### First lecturer: known provisioning gap

- With an approved Edu-ID registration, Auth can create lecturer accounts through its provider flow. Configure your own client ID, discovery URL, client secret and registered callback; the code expects Edu-ID-specific claims and is not a generic plug-and-play OIDC integration
- Without Edu-ID, delegated credentials are available. They authenticate a `User.shortname` against a related `UserLogin` bcrypt hash with the intended access scope. **The repository does not supply a supported production first-lecturer CLI or setup wizard**
- To omit Edu-ID, leave `EDUID_CLIENT_SECRET` entirely **unset**. An empty string still registers the provider. The current login page may still show an Edu-ID button; hiding/relabeling it is a separate UI adaptation

Do not use the local seed to create the first real account: it installs known credentials and elevated sample settings. An operator provisioning implementation must deliberately create a `User` with unique email/shortname and a nested `UserLogin` with a securely supplied, bcrypt-hashed password (the application uses cost 12). For the initial owner, explicitly choose `ACCOUNT_OWNER`: the schema defaults to `READ_ONLY`, and an existing owner is required to administer delegated logins. Ordinary lecturers need the `USER` role, not `ADMIN`. Keep optional entitlement/AI flags off and leave first-login onboarding enabled. Review and test this against the release's schema. There is no safe copy-paste SQL recipe in this guide. This missing idempotent bootstrap is follow-on implementation work, not a completed installation step.

### Email templates: known provisioning gap

Participant activation and magic-link emails need `ParticipantAccountActivation` and `MagicLinkRequested` rows in `EmailTemplate`. SQL schema migrations do not populate them. The repository contains `seedEmailTemplates(prisma)` and transactional template sources, but no supported standalone production bootstrap command; the transactional `update-templates*` scripts currently refer to an absent `src/scripts/deploy.ts`.

Use those sources to implement/review an idempotent template-only provisioning step, rather than running the full fixture seed. `RandomizedGroupCreationFailure` is another template needed for the corresponding group notifications. Missing templates or SMTP errors can leave a created account without a delivered message; a UI success response is not a mail-delivery test. Do not describe activation email as a complete login-enforcement policy: ordinary participant password login does not check `isEmailValid` in this revision.

Sources: [Auth implementation](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/apps/auth/src/pages/api/auth/%5B...nextauth%5D.ts), [user schema](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/packages/prisma/src/prisma/schema/user.prisma), [email template helper](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/packages/prisma-data/src/data/seedEmailTemplates.ts), [transactional scripts](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/packages/transactional/package.json).

Reference data is required for a usable core installation, not just cosmetic sample content. Scored live-quiz finalization with at least three qualifying participants dereferences the fixed rank-achievement IDs `5`, `6` and `7`; missing rows can fail quiz finalization. Participant levels and the default catalog collection also come from seeding outside the SQL migration history. Review the narrow [reference-data helpers](https://github.com/uzh-bf/klicker-uzh/tree/v3-ai/packages/prisma-data/src/data); do not run `seedTEST.ts` or its user/course fixtures. The existing `seedAchievements` and `seedLevels` exports are building blocks, not standalone CLI commands. Review their data and preserve the expected IDs; a future self-host bootstrap should provision this reference data idempotently with the owner and templates. Source: [live-quiz finalization](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/packages/graphql/src/services/liveQuizzes.ts).

## 5. Adapt the application chart, or own your orchestration

`deploy/charts/klicker-uzh-v3` is a useful application manifest reference, not a complete infrastructure chart. It creates no PostgreSQL/Redis/Hatchet infrastructure and no application Secrets. Templates reference externally provisioned Secrets named from the release fullname, such as `-secret-auth`, `-secret-backend-graphql`, `-secret-hatchet-worker-general` and `-secret-growthbook`. Read the rendered manifests for the complete set; values named `email`, `blobStorage` or `eduId` alone do not create them.

The chart still has an internal `klicker-uzh-v2` name and an older `appVersion`. Pin `global.imageTag` or individual image tags rather than trusting that fallback. Replace UZH hosts, image repositories, scaling and external-secret assumptions. Many optional workloads, including chat/LTI/assessment, are rendered without a universal `enabled` switch; do not invent `chat.enabled=false` and assume they disappear. Review or adapt the templates before using a minimal deployment.

Config-derived, non-deploying inspection command once you have prepared your own values file:

```bash
helm template selfhost deploy/charts/klicker-uzh-v3 \
  --values /path/to/your-reviewed-values.yaml > /tmp/klicker-selfhost.yaml
```

Inspect the rendered workloads, ingress hosts, image references, Secret names, security contexts, storage and optional integrations before applying anything. `deploy/env-uzh-prd` is an example of UZH's environment, not a portable values file to apply unchanged.

The migration Job is an **ArgoCD PreSync hook**, not a Helm pre-install/pre-upgrade hook. It targets only `DATABASE_URL` from the backend-graphql Secret; if you operate a separate assessment database, explicitly migrate that database too. With ArgoCD, pre-provision its Secret and any selected PriorityClass before the first sync. Without ArgoCD, explicitly run and wait for migrations before the application rollout; a plain `helm upgrade --install` does not supply that ordering contract. Retain failed-job logs. Schema migrations can run while the old app is still live, so upgrades require compatible expand/contract changes or a planned maintenance window.

### Optional services and feature gates

Ordinary live quizzes, practice quizzes, microlearnings and group activities do not require a Catalyst entitlement in this source line. Advanced capabilities can require account entitlement/approval, user beta preference, GrowthBook rollout flags **and** working external services. These are independent gates.

For a core deployment, keep optional AI/KB producers disabled and omit their credentials. Explicitly set `KB_INGESTION_WORKER_DISABLED=true` where the general worker is not connected to ingestion. Avoid partial `KB_GRAPH_*` configuration: it can make worker startup require the complete graph integration. Do not enable fake development flags in production to bypass these checks.

GrowthBook is not needed for the ordinary core workflows; missing configuration gives fail-closed defaults for the gated features. The unmodified Helm templates may still reference a GrowthBook Secret, so adapt the deployment manifests even if the runtime service is unused. Review [feature flags](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/docs/feature-flags.md), [standard activity scope](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/docs/adr/0037-standard-activity-formats.md), [chat architecture](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/docs/chat-platform.md), and the [general worker example](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/apps/hatchet-worker-general/.env.example) before adding these capabilities.
