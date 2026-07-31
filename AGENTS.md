# KlickerUZH

## Quick Reference

- **Monorepo**: pnpm 11.x + Turborepo, Node.js 24 (Volta-pinned; see `volta` in root `package.json` for exact versions)
- **Main branch**: `v3`
- **Package names**: `@klicker-uzh/<name>` (e.g., `@klicker-uzh/graphql`)

## Commands

### Root-level (from repo root)

```bash
pnpm install                  # install all deps
pnpm run build                # build everything (turbo)
pnpm run check                # typecheck all packages (tsc --noEmit)
pnpm run lint                 # eslint across all packages
pnpm run format               # prettier --write
pnpm run format:check         # prettier --check
pnpm run check:all            # check + format:check + lint + syncpack
pnpm run dev                  # full dev (requires Infisical secrets)
pnpm run dev:raw              # dev without secret injection
pnpm run dev:test             # dev in test/cypress mode
```

### Workspace-filtered

```bash
pnpm --filter @klicker-uzh/graphql build
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/graphql test
```

### Database (Prisma)

```bash
pnpm run prisma:migrate       # create + apply migration (dev)
pnpm run prisma:setup         # reset DB + push schema + seed
pnpm run prisma:reset         # reset DB (skip seed)
pnpm --filter @klicker-uzh/prisma prisma:seed  # seed explicitly
pnpm run prisma:studio        # open Prisma Studio
pnpm run prisma:sync          # sync schema to apps/analytics
```

The commands above are the legacy host/Infisical path. In the self-contained DevPod, the environment is already injected: use `pnpm --filter @klicker-uzh/prisma run prisma:reset:raw --force`, then `pnpm --filter @klicker-uzh/prisma run prisma:push:raw`, then `pnpm --filter @klicker-uzh/prisma-data run seed:raw` for a full destructive reset and reseed.

### GraphQL codegen

```bash
pnpm --filter @klicker-uzh/graphql generate   # one-shot codegen
pnpm --filter @klicker-uzh/graphql dev        # watch mode (codegen + rollup)
```

### Tests

```bash
pnpm run test:run             # vitest across all packages
pnpm --filter @klicker-uzh/graphql test       # single package
```

## Repo Layout

```
apps/
  auth/                    # Auth UI (port 3010)
  backend-docker/          # Main backend + GraphQL API (port 3000)
  chat/                    # AI chat UI (port 3004)
  frontend-control/        # Mobile controller (port 3003)
  frontend-manage/         # Lecturer UI (port 3002)
  frontend-pwa/            # Student PWA (port 3001)
  response-api/            # Response API (port 7078)
  hatchet-worker-general/  # General Hatchet worker
  hatchet-worker-response-processor/  # Response processing worker
  analytics/               # Analytics service
  olat-api/                # LMS integration REST API
  lti/                     # LTI integration
  office-addin/            # Office add-in
  docs/                    # Documentation site
packages/
  prisma/                  # Prisma schema + migrations
  prisma-data/             # Seed data
  graphql/                 # GraphQL schema (Pothos), resolvers, codegen, ops
  grading/                 # Scoring + XP logic
  types/                   # Shared TS types
  util/                    # Common utilities
  i18n/                    # Internationalization
  shared-components/       # Shared React components
  markdown/                # Markdown renderer
  hatchet/                 # Hatchet task definitions
  next-config/             # Shared Next.js config
  transactional/           # Transactional email templates
cypress/                   # E2E tests
```

## Tech Stack

| Layer                  | Technology                                            |
| ---------------------- | ----------------------------------------------------- |
| Frontend framework     | Next.js 16, React, TypeScript                         |
| Styling                | TailwindCSS, @uzh-bf/design-system                    |
| GraphQL server         | GraphQL Yoga + Pothos schema builder                  |
| GraphQL client         | Apollo Client                                         |
| ORM                    | Prisma 7 (PostgreSQL)                                 |
| Caching                | Redis (ioredis)                                       |
| Workflow orchestration | Hatchet (workers for async processing)                |
| Auth                   | Edu-ID (OIDC), magic links, LTI, delegated login      |
| Build                  | Turborepo + Rollup                                    |
| Test                   | Vitest (unit), Cypress (E2E)                          |
| Formatting             | Prettier (no semi, single quotes, trailing comma es5) |

## GraphQL Workflow

Code-first with **Pothos** in `packages/graphql/src/`. After changing types/resolvers (`src/graphql/`) or `.graphql` ops (`src/graphql/ops/`), regenerate with `pnpm --filter @klicker-uzh/graphql generate` (codegen is required — ops are stale otherwise). Op-name prefixes: `Q` query, `M` mutation, `S` subscription, `F` fragment. The public schema definition is generated at [packages/graphql/src/public/schema.graphql](packages/graphql/src/public/schema.graphql).

## Database Workflow

Prisma split-schema under `packages/prisma/src/prisma/schema/`. After editing a `.prisma` file: `pnpm run prisma:migrate` (creates/applies the migration and explicitly regenerates the TypeScript client), then `pnpm run prisma:sync` (mirrors model files into `apps/analytics` while preserving its Python generator and datasource), then rebuild dependents. Update GraphQL types/resolvers if the change affects the API. Prisma 7 reset and migration commands do not seed automatically; use the explicit setup or seed command for local fixtures.

## Auth Model

- **Lecturers**: Edu-ID (OIDC) or delegated login via `apps/auth`
- **Participants**: magic link, LTI, username/password, temporary (anonymous)
- JWT tokens; GraphQL resolvers enforce three-layer auth: authenticate -> authorize -> execute

## Local Dev Setup

### Self-contained devcontainer (recommended)

Clone-and-run via a self-contained devcontainer — no Infisical/Doppler, no EduID, no `/etc/hosts` edits. The container owns the whole stack (Node 24 + pnpm toolchain, Postgres, 3× Redis, MailHog, Hatchet) and runs **all core apps in ONE container** via `turbo dev`. Run pnpm/prisma/tests **inside the container**, never on the host.

```bash
devrouter ensure .
```

The same command starts and proves primary and linked checkouts. Use `devrouter exec . -- <command...>` for one-shot commands or the exact DevPod ID printed by `ensure` for an interactive shell.

The dev servers auto-start in the background (`devrouter exec . -- tail -f /tmp/dev.log`; first compile takes ~1min). Host-side `devrouter ensure` owns lifecycle reconciliation and delivers its matching process helper to the exact validated container. The stack runs every routed app plus the two Hatchet workers (no worker route); analytics, Office add-in, and docs remain outside it. See `.devcontainer/README.md`.

**Routing:** [devrouter](https://github.com/rschlaefli/devrouter) ≥ 0.0.35 fronts the stack over the shared `devnet` network. One-time host setup must happen **before** the container starts:

```bash
devrouter setup --yes # Traefik + devnet + mkcert CA
```

One command owns DevPod identity, the Git metadata mount, aliases, runtime proof, and route reconciliation for either checkout kind. Do not use bare `devpod up`, manual `WORKSPACE`, or per-app `--workspace` route loops:

```bash
devrouter ensure .                    # existing primary or linked checkout
devrouter workspace up <branch-name>  # create and start a new worktree
```

Primary-checkout apps use `https://{app}.klicker.localhost`; linked-worktree apps use `https://{app}.klicker.<workspace>.localhost`. Postgres for host tooling is at `db.klicker[.<workspace>].localhost:5432` (`sslmode=require sslnegotiation=direct`). The primary checkout also keeps the fixed localhost ports in [Repo Layout](#repo-layout). Login as `lecturer`/`abcd` (see test credentials below). Env in `.devcontainer/devcontainer.env` (committed, dev-only — no real secrets).

**Media uploads and Blob CORS:** the manage media library uploads directly from the browser to Azure Blob Storage with a SAS URL. The storage account's Blob service CORS must allow the actual local origin (`https://manage.klicker.localhost` or `https://manage.klicker.<workspace>.localhost`), not only production origins such as `https://manage.klicker.com`. For a dedicated dev storage account, use dev-only localhost rules; keep production storage accounts exact.

### Legacy host-based stack

Traefik reverse proxy serves the apps on `*.klicker.com` domains (needs `/etc/hosts` entries + mkcert certs; Docker Compose runs Postgres, Redis, Traefik, Hatchet-lite). Without Traefik, hit `http://localhost:<port>` directly — per-app ports are in [Repo Layout](#repo-layout). The `*.klicker.com` domains better mirror production cookie/domain behavior.

| URL                                         | App                          | Port |
| ------------------------------------------- | ---------------------------- | ---: |
| https://pwa.klicker.com                     | Student PWA                  | 3001 |
| https://manage.klicker.com                  | Lecturer UI                  | 3002 |
| https://control.klicker.com                 | Controller                   | 3003 |
| https://chat.klicker.com                    | Chat                         | 3004 |
| https://auth.klicker.com                    | Auth                         | 3010 |
| https://api.klicker.com                     | Backend/GraphQL              | 3000 |
| https://assessment.klicker.com              | Assessment PWA (same as PWA) | 3001 |
| https://assessment-api.klicker.com          | Assessment API (same as API) | 3000 |
| https://response-api.klicker.com            | Response API                 | 7078 |
| https://response-api-assessment.klicker.com | Response API (assessment)    | 7078 |

### Test credentials (local seeded DB only)

- Lecturer: username `lecturer`, password `abcd` (delegated login)
- Students: `testuser1`-`testuser50`, password `abcdabcd` (enrolled in "Testkurs")
- Additional: `testuser51`-`testuser52` exist but are not enrolled in any course by default

## Code Conventions

- **TypeScript strict mode** everywhere
- **Functional components** with hooks only (no class components)
- **Component naming**: PascalCase files, `function` keyword for component declarations
- **Prettier**: no semicolons, single quotes, trailing comma es5, 2-space indent
- Plugins: `prettier-plugin-organize-imports` + `prettier-plugin-tailwindcss`
- **Imports**: use `@` and `~` path aliases
- **GraphQL ops**: import from `@klicker-uzh/graphql`
- **State**: Apollo Client for server state, React hooks for local state
- **Styling**: TailwindCSS utilities only, `twMerge` for conditional classes

## Pre-commit / Pre-push

- **pre-commit** (husky): runs `pnpm run check:all` (typecheck + format:check via lint-staged + lint + syncpack)
- **pre-push**: runs `pnpm run build`
- lint-staged checks: `prettier --check` on all staged files

## Important Notes

- **Task tracking**: ClickUp is the product source of truth (roadmap, releases, what the team plans against); GitHub Issues is the tracker for agent-facing engineering work. See [Agent skills](#agent-skills).
- Dev scripts use `./util/_run_with_infisical.sh` for secret injection. Avoid starting dev servers unless explicitly asked.
- If you add or rename an Infisical-managed env var/secret, also update `turbo.json` `globalEnv` so Turborepo sees it during task execution and cache invalidation.
- Never commit secrets, `.env` files, or credentials. **This repo is public** — anything committed on any branch, once pushed, is permanent public history that deleting the file later does not remove.
- **Data hygiene before every commit.** Review staged content (`git diff --cached`, and open any staged data file) for secrets _and_ real personal data — participant/student names, email addresses, matriculation/Studi-IDs, raw response exports, course rosters. Be especially wary of bulk data files (`.csv`, `.json`, `.sql` dumps): these are the highest-risk carriers and are easy to sweep in with `git add .`. Real course-data pulls belong outside the repo (add a `.gitignore` rule); if such data must be versioned, it goes in a private location with direct identifiers removed first. Pseudonymous ids (participant UUIDs) are lower-risk but still get the same scrutiny. When in doubt, do not commit — ask.
- Keep changes small, follow existing patterns in the touched app/package.
- Don't add/update dependencies unless required for the task.
- Feature branches from `v3`. Conventional commits preferred.
- **Keep this file high-level.** Facts, gotchas, and architectural decisions live in the engineering wiki at [docs/index.md](docs/index.md) — update the matching page as you work (per the `klicker-wiki-maintenance` skill), rather than growing this overview.

## Engineering Wiki

Ground truth for working on this codebase is the agent-facing wiki at **[docs/index.md](docs/index.md)** (not to be confused with `apps/docs`, the user-facing site). Read the relevant page before working in an unfamiliar area, and keep it current — **any PR that changes behavior must update the affected wiki pages in `docs/` and relevant skills in `.agents/skills/` within the same PR.** The former `project/CODEBASE_NOTES.md` is a retired pointer stub.

Retrospective fixes and durable lessons live in `docs/solutions/`; check them before re-deriving a solved problem.

## Agent skills

### Issue tracker

GitHub Issues on `uzh-bf/klicker-uzh`, driven with the `gh` CLI, for agent-facing engineering work — wayfinder maps, triage queues, specs. ClickUp stays the product source of truth and keeps its links in PR descriptions. See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md), which also carries the wayfinding operations: sub-issues for tickets, native issue dependencies for blocking, and the frontier query.

Issues are as public as commits. The data-hygiene rule in [Important Notes](#important-notes) applies to issue bodies and comments too.

### Triage labels

The five canonical roles, each label string equal to its name; `wontfix` predates this setup and is reused. See [docs/agents/triage-labels.md](docs/agents/triage-labels.md).

### Domain docs

Single-context: one root `CONTEXT.md` plus `docs/adr/`, both created lazily by `/domain-modeling` and neither present yet. The [engineering wiki](docs/index.md) remains the first stop. See [docs/agents/domain.md](docs/agents/domain.md).

## AI Assistance (Skills)

Skills live in `.agents/skills/` (the canonical location); `.claude/skills` and `.github/skills` symlink to it, so Claude Code and GitHub stay in sync. Task-shaped `klicker-*` skills cover the feature lifecycle — environment diagnosis (`klicker-environment-doctor`), design (`klicker-feature-design`), API (`klicker-graphql-api`), schema/data (`klicker-data-model`), UI (`klicker-frontend-ui`), testing/verification (`klicker-testing-verification`), e2e (`klicker-cypress-e2e`, `klicker-playwright-e2e`), and wiki upkeep (`klicker-wiki-maintenance`); the routing table lives in [docs/index.md](docs/index.md).

- **`agent-browser`** — **mandatory** verification for any change touching frontend apps, shared components, styling, i18n text, frontend-facing GraphQL ops, or auth/redirect/cookie flows. Open the page and confirm with before/after screenshots; don't rely on "the logic looks correct". Run via `npx agent-browser`, and log in with **delegated** access, not Edu-ID (credentials under [Test credentials](#test-credentials-local-seeded-db-only)). Full workflow + Traefik troubleshooting: [.agents/skills/agent-browser/SKILL.md](.agents/skills/agent-browser/SKILL.md).
- **`web-design-guidelines`** — UI/UX/accessibility review ([SKILL.md](.agents/skills/web-design-guidelines/SKILL.md)).
- **`vercel-react-best-practices`** — React/Next performance guidance ([SKILL.md](.agents/skills/vercel-react-best-practices/SKILL.md)).

<!-- devrouter -->

## devrouter

This repository uses [devrouter](https://github.com/rschlaefli/devrouter) for local dev routing.
All apps and dependencies are declared in `.devrouter.yml`.

Full reference (config schema, docker requirements, env injection, commands):
`.agents/skills/devrouter/SKILL.md`

Quick validation sequence:

- Managed devcontainer consumer images contain no devrouter package or helper; `devrouter ensure` delivers the matching helper at runtime.
- `devrouter up`
- `devrouter tls install` (required when repo defines tcp/postgres apps)
- `devrouter app ls --repo .`
- Primary or linked devcontainer checkout: `devrouter ensure . --json`
- Host/docker runtime app only: `devrouter app run <host-app> --repo . --yes`
- `devrouter ls`
<!-- /devrouter -->
