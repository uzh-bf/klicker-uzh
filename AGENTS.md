# KlickerUZH

## Quick Reference

- **Monorepo**: pnpm 10.x + Turborepo, Node.js 20 (Volta-pinned)
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

## Tech Stack

| Layer                  | Technology                                            |
| ---------------------- | ----------------------------------------------------- |
| Frontend framework     | Next.js 15, React, TypeScript                         |
| Styling                | TailwindCSS, @uzh-bf/design-system                    |
| GraphQL server         | GraphQL Yoga + Pothos schema builder                  |
| GraphQL client         | Apollo Client                                         |
| ORM                    | Prisma 6 (PostgreSQL)                                 |
| Caching                | Redis (ioredis)                                       |
| Workflow orchestration | Hatchet (workers for async processing)                |
| Auth                   | Edu-ID (OIDC), magic links, LTI, delegated login      |
| Build                  | Turborepo + Rollup                                    |
| Test                   | Vitest (unit), Cypress (E2E)                          |
| Formatting             | Prettier (no semi, single quotes, trailing comma es5) |

## GraphQL Workflow

Schema is defined code-first with **Pothos** in `packages/graphql/src/`.

1. Define/modify types and resolvers in `packages/graphql/src/graphql/`
2. Write `.graphql` operation files in `packages/graphql/src/graphql/ops/`
3. Run codegen: `pnpm --filter @klicker-uzh/graphql generate`
4. Codegen outputs:
   - `src/ops.ts` - typed document nodes + fragment matchers
   - `src/ops.schema.json` - introspection result
   - `src/public/schema.graphql` - SDL schema
   - `src/public/client.json` + `src/public/server.json` - persisted query IDs (SHA-256)

### Operation naming

- `Q` prefix = query (`QGetUserCourses`)
- `M` prefix = mutation (`MCreateCourse`)
- `S` prefix = subscription (`SFeedbackCreated`)
- `F` prefix = fragment (`FElementData`)

## Database Workflow

Prisma schema is split across multiple files in `packages/prisma/src/prisma/schema/`:
`analytics`, `chat`, `course`, `element`, `gamification`, `participant`, `quiz`, `resources`, `response`, `sharing`, `user`, `other`, `datasource`, `js`.

1. Edit the relevant `.prisma` file
2. `pnpm run prisma:migrate` - create + apply migration
3. `pnpm run prisma:sync` - copy schema to `apps/analytics/prisma/schema/` (excludes `js.prisma`)
4. `pnpm --filter @klicker-uzh/prisma generate` - regenerate Prisma client
5. Update GraphQL types/resolvers if schema change affects the API

## Auth Model

- **Lecturers**: Edu-ID (OIDC) or delegated login via `apps/auth`
- **Participants**: magic link, LTI, username/password, temporary (anonymous)
- JWT tokens; GraphQL resolvers enforce three-layer auth: authenticate -> authorize -> execute

## Local Dev Setup

Local dev uses Traefik reverse proxy with `*.klicker.com` custom domains (requires `/etc/hosts` entries + mkcert certs). Docker Compose runs PostgreSQL, Redis, Traefik, and Hatchet-lite.

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

Without Traefik, use `http://localhost:<port>` directly. The `*.klicker.com` domains better mirror production cookie/domain behavior.

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

- Dev scripts use `./util/_run_with_infisical.sh` for secret injection. Avoid starting dev servers unless explicitly asked.
- If you add or rename an Infisical-managed env var/secret, also update `turbo.json` `globalEnv` so Turborepo sees it during task execution and cache invalidation.
- Never commit secrets, `.env` files, or credentials.
- Keep changes small, follow existing patterns in the touched app/package.
- Don't add/update dependencies unless required for the task.
- Feature branches from `v3`. Conventional commits preferred.
- **Keep this file high-level.** Project-specific gotchas, non-obvious patterns, and architectural decisions live in [project/CODEBASE_NOTES.md](project/CODEBASE_NOTES.md) — add to it (and prune it) as you work, rather than growing this overview.

## Codebase Notes

Non-obvious patterns, per-area gotchas, and architectural decisions are collected in **[project/CODEBASE_NOTES.md](project/CODEBASE_NOTES.md)**. Check it before working in an unfamiliar area, and keep it current.

## AI Assistance (Skills)

Skills live in `.factory/skills/` (mirrored to `.github/skills/`; `.claude/skills` symlinks to `.factory/skills/`, so Claude Code stays in sync).

- **`agent-browser`** — **mandatory** verification for any change touching frontend apps, shared components, styling, i18n text, frontend-facing GraphQL ops, or auth/redirect/cookie flows. Open the page and confirm with before/after screenshots; don't rely on "the logic looks correct". Run via `npx agent-browser`, and log in with **delegated** access, not Edu-ID (credentials under [Test credentials](#test-credentials-local-seeded-db-only)). Full workflow + Traefik troubleshooting: [.factory/skills/agent-browser/SKILL.md](.factory/skills/agent-browser/SKILL.md).
- **`web-design-guidelines`** — UI/UX/accessibility review ([SKILL.md](.factory/skills/web-design-guidelines/SKILL.md)).
- **`vercel-react-best-practices`** — React/Next performance guidance ([SKILL.md](.factory/skills/vercel-react-best-practices/SKILL.md)).
