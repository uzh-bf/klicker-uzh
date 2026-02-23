# KlickerUZH Architecture Vault (Arc42) — PLAN

This folder (`deploy/docs/`) is an **Obsidian vault** intended to host comprehensive, repo-grounded architecture documentation for the KlickerUZH monorepo.

## Purpose

- Provide a single, navigable architecture reference for engineers and operators.
- Capture _what exists today_ (from code + deploy config), plus the intent behind key decisions.
- Serve as the basis for diagrams (Obsidian Canvas, Mermaid) and written explanations (Arc42 structure).

## Audience & public-safety (repo-committed)

These docs are committed to the repository and must be **public-safe**:

- Never include secrets (API keys, passwords, tokens, connection strings).
- Prefer placeholders for internal-only details (domains, namespaces, cluster names).
- If referencing UZH-specific values that are already present in repo configs (e.g., `deploy/env-uzh-*`), label them explicitly as **examples**.

## Documentation model (Arc42 spine)

We use an **Arc42-inspired** structure as the table of contents (“spine”), with C4-style content inside:

- **01 Context**: system context, actors, external dependencies, trust boundaries.
- **02 Constraints**: quality goals, security/privacy constraints, tech stack constraints.
- **03 Solution Strategy**: the main decomposition and “why this shape”.
- **04 Building Blocks**: one note per workload/container, plus shared packages, data stores, and external systems.
  - _Context vs Building Blocks:_ `01-Context/02-External Systems` provides a high-level summary/diagram of what touches our system. `04-Building Blocks/External/` contains the detailed per-component deep-dives. When populating content, keep 01 as a concise overview and avoid duplicating detail into it.
  - _Packages subfolder:_ `04-Building Blocks/Packages/` contains shared monorepo libraries (not deployable containers). These are intentionally kept as "shared library" building blocks to document their role and interfaces, but they do not appear on the overview canvas since they are internal to workloads.
- **05 Runtime Views**: key request/flow narratives (live quiz, assessment flow, chat flow, uploads).
- **06 Deployment Views**: Kubernetes/Helm, environments, configuration and secrets model (structure only).
- **07 Cross-cutting Concepts**: concepts spanning services (assessment split, cookies/auth, redis topology, AI keys, MCP).
- **08 ADRs**: architectural decision records.
- **09 Runbooks**: operational playbooks (local dev, release/deploy).
- **10 Risks and Technical Debt**: known risks, tech debt, and areas requiring future attention.

## Scope (this vault documents)

- Klicker workloads: auth, student/lecturer/control frontends, backend GraphQL, response-api, LTI, OLAT API, hatchet workers, analytics.
- **Assessment** split: dedicated workloads and “assessment mode” separation.
- **AI infrastructure**: chat app + supporting AI infra (LiteLLM gateway, Langfuse, Milvus, Neo4j, MCP services).
- Azure-managed services: Blob Storage, Managed Redis, Managed Postgres, Azure OpenAI.
- External systems: Edu-ID OIDC, LMS (OpenOLAT/Moodle), SMTP/email provider, Teams webhook, BetterUptime heartbeat, Hatchet orchestrator.

## Sources of truth in the repo (for later content population)

- Helm chart: `deploy/charts/klicker-uzh-v3/` (templates + default values)
- Environment overlays (examples): `deploy/env-uzh-prd/values.yaml`, `deploy/env-uzh-stg/values.yaml`
- Monorepo workloads: `apps/*` (notably `apps/backend-docker`, `apps/response-api`, `apps/chat`, `apps/lti`, workers)
- Shared packages: `packages/*` (notably `packages/graphql`, `packages/prisma`, `packages/hatchet`)
- Prisma chat/MCP schema: `packages/prisma/src/prisma/schema/chat.prisma`
- MCP tool loading + filtering: `apps/chat/src/services/mcpClients.ts`

## Conventions

### Naming and ordering

- Use numbered top-level folders to keep navigation stable.
- Use descriptive note names (Title Case). Spaces in filenames are allowed and used.

### Linking rules

- Every box in the overview canvas should link to a corresponding note.
- Notes should link back to the overview canvas where helpful.

### Git hygiene (Obsidian)

- Track `deploy/docs/.obsidian/` (pins `Overview.canvas` as the entry view).
- Avoid committing unrelated Obsidian state elsewhere in the repo (e.g., `apps/docs/docs/.obsidian/`).

### Stub content rule (Phase 1)

During scaffolding, notes are stubs and contain only:

1. A level-1 heading matching the filename
2. An optional `> TODO: content` marker

## Overview canvas (`Overview.canvas`)

The vault entrypoint is `deploy/docs/Overview.canvas` (opened by the Obsidian workspace by default). It provides a single high-level architecture overview.

### Canvas groups (nested)

- **External Systems** (left)
- **Azure** (center)
  - **AKS Cluster**
    - **Node Pool: klicker**
    - **Node Pool: assessment**
    - **Node Pool: AI infra**
  - **Azure Managed Services** (inside Azure, outside AKS)

### Canvas nodes (file notes)

Nodes in the canvas correspond to the stub notes created in this phase:

- External systems (notes in `04-Building Blocks/External/`): Edu-ID OIDC, LMS, SMTP provider, Teams webhook, BetterUptime heartbeat, Hatchet orchestrator
- Azure managed services (notes in `04-Building Blocks/Data Stores/`): Postgres, Redis, Blob Storage, **Azure OpenAI** (`04-Building Blocks/Data Stores/Azure OpenAI.md`)
- Workloads:
  - Klicker: Auth, PWA, Manage, Control, Backend GraphQL, Response API, LTI, OLAT API, Hatchet workers, Analytics
  - Assessment: Assessment PWA, Assessment Backend, Assessment Response API, Assessment Response Processor
  - AI infra: Chat, LiteLLM, Langfuse, Milvus, Neo4j, MCP services (Doc Query / Skills)

### Canvas edges (high-level)

Edges are intentionally coarse in Phase 1 (no labels, no protocol detail). They capture:

- Frontends → Backend GraphQL (and assessment equivalents)
- Backend → data stores (Postgres/Redis/Blob)
- Response API → Hatchet orchestrator → workers
- Chat → LiteLLM Gateway → Azure OpenAI; Chat → Langfuse; LiteLLM Gateway → Langfuse; Chat → MCP services; MCP Doc Query → Milvus/Neo4j
- Auth ↔ Edu-ID; LTI/OLAT API ↔ LMS
- Backend → notification integrations (SMTP/Teams/BetterUptime)

## Important content notes (for Phase 2+)

- **Assessment workloads are deployment variants of the same codebase** (often the same Docker images; sometimes separate image repositories/tags for the same app). Each Assessment workload note should cross-reference `07-Cross-cutting Concepts/01-Assessment vs Non-assessment Split.md` to avoid implying separate codebases.
- **10-Risks and Technical Debt** was added as an additional arc42 section. Populate with known tech debt items (assessment split complexity, auth model evolution, etc.) during Phase 3.

## Progress

Last updated: 2026-02-20

- [x] Phase 1 — Scaffolding (folders, stub notes, overview canvas)
- [x] Phase 2 — Populate building blocks (navigation + deployment views + workloads)
  - [x] Navigation MOCs (`00-Start Here`, `00-Component Catalog`, `00-Glossary`)
  - [x] Deployment views (`06-Deployment Views/*`)
  - [x] Core workloads (`04-Building Blocks/Workloads/**`)
    - [x] Backend GraphQL (+ assessment variant)
    - [x] Response API (+ assessment variant)
    - [x] Hatchet workers (general + response processor + assessment variant)
    - [x] Frontends + auth + integrations (PWA/Manage/Control/Auth/LTI/OLAT API)
    - [x] Analytics
  - [x] AI infra interfaces (`04-Building Blocks/Workloads/AI Infra/**`) — out-of-repo components (LiteLLM, Langfuse, Milvus, Neo4j, MCP servers) documented to extent possible from this repo
- [x] Phase 3 — Runtime views + cross-cutting concepts + risks/tech debt
- [ ] Phase 4 — Additional canvases + ADRs

## Roadmap

1. **Phase 1 (completed):** scaffold folders + stub notes + overview canvas wiring.
2. **Phase 2 (next):** populate navigation + container/workload notes from code + Helm templates and document "what runs where".
3. **Phase 3 (later):** add runtime views + key cross-cutting concepts + trust boundaries + risks/tech debt (and ADRs as needed).
4. **Phase 4 (later):** add additional canvases (deployment view, data view, auth/session view, AI/MCP view) and keep the overview readable.
