---
title: Self-hosting overview
sidebar_label: Overview and architecture
description: What is needed to run your own KlickerUZH instance, and which deployment pieces are available today.
---

# Self-hosting KlickerUZH

KlickerUZH can be run from its open-source code, but the current v3 architecture is a multi-service application. **There is a self-contained local evaluation environment; there is not yet a turnkey, production-ready self-hosting distribution.** Production operators must provide infrastructure, build for their own domains, and complete the account/bootstrap and deployment work described below.

This guide describes the `v3-ai` source line, initially reviewed against [commit `eb6e579`](https://github.com/uzh-bf/klicker-uzh/commit/eb6e579ba3e9cb04e516a2012cc31f1714d6d257). Use the documentation, images, migrations, and configuration from the **same commit or release**. Instructions for v1/v2, including their MinIO configuration, do not apply to this architecture.

## Choose your starting point

- **Try the product or contribute:** follow [Local evaluation](./evaluation.md). This provisions disposable sample data and development services without UZH credentials
- **Run a retained instance:** read [Production deployment](./production.md), then [Operations and troubleshooting](./operations.md). These are source-derived operator instructions, not a report of a clean-room production deployment
- **Develop integrations:** consult the [engineering architecture](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/docs/architecture-overview.md) and the source of the release you deploy

The repository is published under [AGPL-3.0](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/LICENSE.md). Hosting the code does not supply access to UZH infrastructure, identity-provider registrations, commercial model services, or private external integrations.

## What runs where?

| Component                                                | Responsibility                                                            | Needed for                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| `apps/frontend-manage`                                   | Lecturer interface: elements, courses, activity management and evaluation | Lecturer workflows                       |
| `apps/frontend-pwa`                                      | Student interface, participation and practice                             | Student workflows                        |
| `apps/auth`                                              | Lecturer delegated login and optional Edu-ID/OIDC; assessment identity    | Lecturer sign-in                         |
| `apps/backend-docker`                                    | GraphQL API, authorization, subscriptions and orchestration               | All core workflows                       |
| `apps/response-api`                                      | Accepts live-quiz responses and submits processing work                   | Live quizzes                             |
| `apps/hatchet-worker-response-processor`                 | Processes responses, scoring and execution-state updates                  | Live quizzes                             |
| `apps/hatchet-worker-general`                            | Activity lifecycle, scheduled work and other background workflows         | Normal activity operation                |
| `apps/frontend-control`                                  | Optional mobile live-quiz controller                                      | Mobile control                           |
| PostgreSQL                                               | Users, courses, content, durable results and migration records            | All core workflows                       |
| Redis execution, assessment execution, and cache/pub-sub | Live state, separate assessment state, cross-process updates              | Current backend and worker configuration |
| Hatchet engine and its persistent backing store          | Workflow dispatch, retries, schedules and worker coordination             | Current backend and workers              |
| Azure Blob Storage                                       | Uploaded media; separate optional knowledge-base storage paths            | Media uploads                            |
| SMTP service                                             | Participant activation, magic links and notifications                     | Email-dependent workflows                |

The practical baseline for live teaching is Manage + PWA + Auth + backend + Response API + both workers, with PostgreSQL, the three Redis endpoints, Hatchet, mail, and media storage. This is a dependency baseline, not an automated deployment profile. Even without an assessment frontend, the current backend and general worker instantiate the assessment Redis client; do not assume that removing the assessment UI removes that dependency.

Dockerized Next.js apps and the backend serve port `3000`; Response API defaults to `7078`. Local development assigns different frontend ports. Use the relevant Dockerfile/manifest, not the development port list, when connecting containers.

### Request and data flow

1. A browser loads Manage or PWA and calls the backend at `/api/graphql`. Lecturer login passes through Auth; participant login is handled by the appropriate PWA/backend flow
2. The backend checks identity and authorization, reads/writes PostgreSQL, and uses Redis for execution state and pub/sub
3. Live responses go to Response API (`/AddResponse` for ordinary participation), then through Hatchet to the response worker. General workers handle other activity transitions and scheduled jobs
4. GraphQL subscriptions share the API path over WebSocket. Reverse proxies must pass WebSocket upgrades and keep connections alive
5. Media upload authorization comes from the backend; the browser uploads directly to Blob Storage. The database stores the resulting URL, rather than the image bytes

Source: [backend startup](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/apps/backend-docker/src/index.ts), [Response API](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/apps/response-api/src/index.ts), [worker architecture](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/docs/async-and-workers.md).

## Optional capabilities are separate projects to configure

- **Assessment:** separate PWA/backend/Response API configuration, response worker, origins, identity policy and execution Redis. Do not expose a normal teaching setup as an assessment deployment without reviewing these boundaries
- **LTI/LMS:** `apps/lti` and optional `apps/olat-api`, LMS registration, keys and the LTI service's own database configuration
- **AI chat and assistants:** `apps/chat`, model-provider credentials or an OpenAI-compatible gateway, model configuration, and applicable account/feature gates. Internal `mcp-student` and `mcp-lecturer` services support tool use; they are not public OAuth-enabled MCP endpoints
- **Knowledge bases and generation:** additional ingestion, retrieval, graph-building or element-generation services and credentials. Some referenced services live outside this repository; the local core does not provide them automatically
- **Learning analytics, Office add-in, push notifications and telemetry:** additional services, build configuration or external registrations. Analytics is not a default devcontainer app

Catalyst-related account gates are present in the public code. That does not mean every Catalyst-associated external service is included or that setting an account flag provisions it. [Production configuration](./production.md#optional-services-and-feature-gates) explains the boundary.

## Deployment artifacts: use the right ones

| Artifact                                                                            | Actual scope                                                                                              |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `.devcontainer/` + `.devrouter.yml`                                                 | Supported repository-local development/evaluation stack, with sample users and development-only settings  |
| Root `docker-compose.yml`                                                           | Host-development infrastructure and additional development services; not a hardened production installer  |
| `docker-compose.build.yml`                                                          | Image build definitions, not a running application stack; not all optional apps are listed                |
| `apps/*/Dockerfile`, `packages/prisma/Dockerfile`                                   | Individual application images and the dedicated migration image                                           |
| `deploy/charts/klicker-uzh-v3/`                                                     | Application chart used with externally managed services/secrets; requires adaptation for another operator |
| `deploy/env-uzh-*`                                                                  | UZH deployment examples with institution-specific domains, images, scaling and integrations               |
| `deploy/compose/`, `deploy/compose-traefik-proxy/`, `deploy/charts/klicker-uzh-v2/` | Legacy deployment artifacts; **not current v3 installation instructions**                                 |

The old Compose file's S3/MinIO settings do not enable S3 in current v3. Current media storage and the separately planned S3 capability are covered in [Storage](./production.md#media-storage).
