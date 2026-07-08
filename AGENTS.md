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
pnpm run prisma:studio        # open Prisma Studio
pnpm run prisma:sync          # sync schema to apps/analytics
```

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

## Workflows & References

Detailed technical concepts and workflows live in the agent-facing engineering wiki at [docs/index.md](docs/index.md):

- **Tech Stack & Architecture**: see [Architecture Overview](docs/architecture-overview.md) and [Getting Started](docs/getting-started.md).
- **GraphQL APIs & Resolvers**: see [GraphQL API Layer](docs/graphql-api-layer.md).
- **Database & Prisma Schemas**: see [Data & Migrations](docs/data-and-migrations.md).
- **Authentication & Authorization**: see [Auth Model](docs/auth-model.md).
- **Coding Style & Conventions**: see [Frontend Conventions](docs/frontend-conventions.md).
- **Testing & Verification Matrix**: see [Testing](docs/testing.md).

## Local Dev Setup

### Self-contained devcontainer (recommended)

Clone-and-run via a self-contained devcontainer — no Infisical/Doppler, no EduID, no `/etc/hosts` edits. The container owns the whole stack (Node 24 + pnpm toolchain, Postgres, 3× Redis, MailHog, Hatchet) and runs **all core apps in ONE container** via `turbo dev`. Run pnpm/prisma/tests **inside the container**, never on the host.

```bash
devpod up .            # builds image, starts services, installs, builds, seeds, runs dev
devpod ssh klicker-uzh # shell inside the container
```

The dev servers auto-start in the background (`tail -f /tmp/dev.log`; first compile takes ~1min). Re-run lifecycle by hand inside the container: `bash .devcontainer/post-create.sh` / `bash .devcontainer/post-start.sh`. Covers the core apps (backend, auth, frontend-pwa/manage/control) plus olat-api, response-api, and the two Hatchet workers (Phase 2 Tier 1; workers have no port/route); All runnable apps are included (no analytics/office-addin/docs). See `.devcontainer/README.md`.

**Routing (devrouter — when available):** nothing is published on the host; [devrouter](https://github.com/rschlaefli/devrouter) (≥ 0.0.21) fronts the stack over the shared `devnet` network and routes each `*.klicker.localhost` host to the one container's internal port. One-time host setup **before** the container starts:

```bash
dev up && dev tls install                                       # Traefik + devnet + mkcert CA
for a in api auth pwa manage control olat-api response-api lti chat db; do dev app run "$a"; done
```

Apps at `https://{api,auth,pwa,manage,control,olat-api,response-api}.klicker.localhost`; Postgres for host tooling at `db.klicker.localhost:5432` (`sslmode=require sslnegotiation=direct`). Login as `lecturer`/`abcd` (see test credentials below). Env in `.devcontainer/devcontainer.env` (committed, dev-only — no real secrets).

### Test credentials (local seeded DB only)

- Lecturer: username `lecturer`, password `abcd` (delegated login)
- Students: `testuser1`-`testuser50`, password `abcdabcd` (enrolled in "Testkurs")
- Additional: `testuser51`-`testuser52` exist but are not enrolled in any course by default

## Important Notes

- Dev scripts use `./util/_run_with_infisical.sh` for secret injection. Avoid starting dev servers unless explicitly asked.
- If you add or rename an Infisical-managed env var/secret, also update `turbo.json` `globalEnv` so Turborepo sees it during task execution and cache invalidation.
- Never commit secrets, `.env` files, or credentials.
- Keep changes small, follow existing patterns in the touched app/package.
- Don't add/update dependencies unless required for the task.
- Feature branches from `v3`. Conventional commits preferred.
- **Keep this file high-level.** Facts, gotchas, and architectural decisions live in the engineering wiki at [docs/index.md](docs/index.md) — update the matching page as you work (per the `klicker-wiki-maintenance` skill), rather than growing this overview.

## Engineering Wiki

Ground truth for working on this codebase is the agent-facing wiki at **[docs/index.md](docs/index.md)** (not to be confused with `apps/docs`, the user-facing site). Read the relevant page before working in an unfamiliar area, and keep it current — any PR that changes documented behavior updates the affected pages in the same PR. The former `project/CODEBASE_NOTES.md` is a retired pointer stub.

## AI Assistance (Skills)

Skills live in `.agents/skills/` (the canonical location); `.claude/skills` and `.github/skills` symlink to it, so Claude Code and GitHub stay in sync. Task-shaped `klicker-*` skills cover the feature lifecycle — environment diagnosis (`klicker-environment-doctor`), design (`klicker-feature-design`), API (`klicker-graphql-api`), schema/data (`klicker-data-model`), UI (`klicker-frontend-ui`), testing/verification (`klicker-testing-verification`), e2e (`klicker-cypress-e2e`, `klicker-playwright-e2e`), and wiki upkeep (`klicker-wiki-maintenance`); the routing table lives in [docs/index.md](docs/index.md).

- **`agent-browser`** — **mandatory** verification for any change touching frontend apps, shared components, styling, i18n text, frontend-facing GraphQL ops, or auth/redirect/cookie flows. Open the page and confirm with before/after screenshots; don't rely on "the logic looks correct". Run via `npx agent-browser`, and log in with **delegated** access, not Edu-ID (credentials under [Test credentials](#test-credentials-local-seeded-db-only)). Full workflow + Traefik troubleshooting: [.agents/skills/agent-browser/SKILL.md](.agents/skills/agent-browser/SKILL.md).
- **`web-design-guidelines`** — UI/UX/accessibility review ([SKILL.md](.agents/skills/web-design-guidelines/SKILL.md)).
- **`vercel-react-best-practices`** — React/Next performance guidance ([SKILL.md](.agents/skills/vercel-react-best-practices/SKILL.md)).
