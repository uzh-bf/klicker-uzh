# Component Catalog

High-level catalog of the main components shown in [Overview.canvas](Overview.canvas).

Legend:

- **Type**: `workload` (runs as a container), `data` (storage/cache), `external` (3rd-party system/service), `package` (shared monorepo library)
- **Runs in node pool**: `klicker` / `assessment` / `ai infra` for AKS workloads; `—` for external/managed/library components

| Component                                                                                                                                         | Type     | Repo path (if in this repo)              | Runs in node pool |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------- | ----------------- |
| [Auth](<04-Building Blocks/Workloads/Klicker/Auth.md>)                                                                                            | workload | `apps/auth`                              | klicker           |
| [Frontend PWA](<04-Building Blocks/Workloads/Klicker/Frontend PWA.md>)                                                                            | workload | `apps/frontend-pwa`                      | klicker           |
| [Frontend Manage](<04-Building Blocks/Workloads/Klicker/Frontend Manage.md>)                                                                      | workload | `apps/frontend-manage`                   | klicker           |
| [Frontend Control](<04-Building Blocks/Workloads/Klicker/Frontend Control.md>)                                                                    | workload | `apps/frontend-control`                  | klicker           |
| [Backend GraphQL](<04-Building Blocks/Workloads/Klicker/Backend GraphQL.md>)                                                                      | workload | `apps/backend-docker`                    | klicker           |
| [Response API](<04-Building Blocks/Workloads/Klicker/Response API.md>)                                                                            | workload | `apps/response-api`                      | klicker           |
| [LTI](<04-Building Blocks/Workloads/Klicker/LTI.md>)                                                                                              | workload | `apps/lti`                               | klicker           |
| [OLAT API](<04-Building Blocks/Workloads/Klicker/OLAT API.md>)                                                                                    | workload | `apps/olat-api`                          | klicker           |
| [Hatchet Worker - General](<04-Building Blocks/Workloads/Klicker/Hatchet Worker - General.md>)                                                    | workload | `apps/hatchet-worker-general`            | klicker           |
| [Hatchet Worker - Response Processor](<04-Building Blocks/Workloads/Klicker/Hatchet Worker - Response Processor.md>)                              | workload | `apps/hatchet-worker-response-processor` | klicker           |
| [Analytics](<04-Building Blocks/Workloads/Klicker/Analytics.md>)                                                                                  | workload | `apps/analytics`                         | klicker           |
| [Frontend PWA - Assessment](<04-Building Blocks/Workloads/Assessment/Frontend PWA - Assessment.md>)                                               | workload | `apps/frontend-pwa`                      | assessment        |
| [Backend GraphQL - Assessment](<04-Building Blocks/Workloads/Assessment/Backend GraphQL - Assessment.md>)                                         | workload | `apps/backend-docker`                    | assessment        |
| [Response API - Assessment](<04-Building Blocks/Workloads/Assessment/Response API - Assessment.md>)                                               | workload | `apps/response-api`                      | assessment        |
| [Hatchet Worker - Response Processor - Assessment](<04-Building Blocks/Workloads/Assessment/Hatchet Worker - Response Processor - Assessment.md>) | workload | `apps/hatchet-worker-response-processor` | assessment        |
| [Chat](<04-Building Blocks/Workloads/AI Infra/Chat.md>)                                                                                           | workload | `apps/chat`                              | ai infra          |
| [LiteLLM Gateway](<04-Building Blocks/Workloads/AI Infra/LiteLLM Gateway.md>)                                                                     | workload | —                                        | ai infra          |
| [Langfuse](<04-Building Blocks/Workloads/AI Infra/Langfuse.md>)                                                                                   | workload | —                                        | ai infra          |
| [Milvus](<04-Building Blocks/Workloads/AI Infra/Milvus.md>)                                                                                       | workload | —                                        | ai infra          |
| [Neo4j](<04-Building Blocks/Workloads/AI Infra/Neo4j.md>)                                                                                         | workload | —                                        | ai infra          |
| [MCP - Doc Query (RAG)](<04-Building Blocks/Workloads/AI Infra/MCP - Doc Query (RAG).md>)                                                         | workload | —                                        | ai infra          |
| [MCP - Skills](<04-Building Blocks/Workloads/AI Infra/MCP - Skills.md>)                                                                           | workload | —                                        | ai infra          |
| [Azure Database for PostgreSQL](<04-Building Blocks/Data Stores/Azure Database for PostgreSQL.md>)                                                | data     | —                                        | —                 |
| [Azure Cache for Redis](<04-Building Blocks/Data Stores/Azure Cache for Redis.md>)                                                                | data     | —                                        | —                 |
| [Azure Blob Storage](<04-Building Blocks/Data Stores/Azure Blob Storage.md>)                                                                      | data     | —                                        | —                 |
| [Azure OpenAI](<04-Building Blocks/Data Stores/Azure OpenAI.md>)                                                                                  | data     | —                                        | —                 |
| [Edu-ID OIDC](<04-Building Blocks/External/Edu-ID OIDC.md>)                                                                                       | external | —                                        | —                 |
| [LMS - OpenOLAT and Moodle](<04-Building Blocks/External/LMS - OpenOLAT and Moodle.md>)                                                           | external | —                                        | —                 |
| [SMTP Email Provider](<04-Building Blocks/External/SMTP Email Provider.md>)                                                                       | external | —                                        | —                 |
| [Microsoft Teams Webhook](<04-Building Blocks/External/Microsoft Teams Webhook.md>)                                                               | external | —                                        | —                 |
| [BetterUptime Heartbeat](<04-Building Blocks/External/BetterUptime Heartbeat.md>)                                                                 | external | —                                        | —                 |
| [Hatchet Orchestrator](<04-Building Blocks/External/Hatchet Orchestrator.md>)                                                                     | external | —                                        | —                 |
| [GraphQL](<04-Building Blocks/Packages/GraphQL.md>)                                                                                               | package  | `packages/graphql`                       | —                 |
| [Prisma](<04-Building Blocks/Packages/Prisma.md>)                                                                                                 | package  | `packages/prisma`                        | —                 |
| [Hatchet](<04-Building Blocks/Packages/Hatchet.md>)                                                                                               | package  | `packages/hatchet`                       | —                 |
| [Grading](<04-Building Blocks/Packages/Grading.md>)                                                                                               | package  | `packages/grading`                       | —                 |
| [I18n](<04-Building Blocks/Packages/I18n.md>)                                                                                                     | package  | `packages/i18n`                          | —                 |
| [Shared Components](<04-Building Blocks/Packages/Shared Components.md>)                                                                           | package  | `packages/shared-components`             | —                 |
| [Markdown](<04-Building Blocks/Packages/Markdown.md>)                                                                                             | package  | `packages/markdown`                      | —                 |
| [Types](<04-Building Blocks/Packages/Types.md>)                                                                                                   | package  | `packages/types`                         | —                 |
| [Util](<04-Building Blocks/Packages/Util.md>)                                                                                                     | package  | `packages/util`                          | —                 |
| [Prisma Data (Seeds)](<04-Building Blocks/Packages/Prisma Data (Seeds).md>)                                                                       | package  | `packages/prisma-data`                   | —                 |
| [Transactional](<04-Building Blocks/Packages/Transactional.md>)                                                                                   | package  | `packages/transactional`                 | —                 |
| [Next Config](<04-Building Blocks/Packages/Next Config.md>)                                                                                       | package  | `packages/next-config`                   | —                 |
| [Office Add-in](<04-Building Blocks/Workloads/Klicker/Office Add-in.md>)                                                                          | workload | `apps/office-addin`                      | —                 |

> Note: the Assessment workloads are deployment variants of the same codebase as the Klicker workloads (different config/env vars; often the same Docker images), see `07-Cross-cutting Concepts/01-Assessment vs Non-assessment Split.md`.
