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

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 15, React, TypeScript |
| Styling | TailwindCSS, @uzh-bf/design-system |
| GraphQL server | GraphQL Yoga + Pothos schema builder |
| GraphQL client | Apollo Client |
| ORM | Prisma 6 (PostgreSQL) |
| Caching | Redis (ioredis) |
| Workflow orchestration | Hatchet (workers for async processing) |
| Auth | Edu-ID (OIDC), magic links, LTI, delegated login |
| Build | Turborepo + Rollup |
| Test | Vitest (unit), Cypress (E2E) |
| Formatting | Prettier (no semi, single quotes, trailing comma es5) |

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

| URL | App | Port |
|---|---|---:|
| https://pwa.klicker.com | Student PWA | 3001 |
| https://manage.klicker.com | Lecturer UI | 3002 |
| https://control.klicker.com | Controller | 3003 |
| https://chat.klicker.com | Chat | 3004 |
| https://auth.klicker.com | Auth | 3010 |
| https://api.klicker.com | Backend/GraphQL | 3000 |
| https://assessment.klicker.com | Assessment PWA (same as PWA) | 3001 |
| https://assessment-api.klicker.com | Assessment API (same as API) | 3000 |
| https://response-api.klicker.com | Response API | 7078 |
| https://response-api-assessment.klicker.com | Response API (assessment) | 7078 |

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
- Never commit secrets, `.env` files, or credentials.
- Keep changes small, follow existing patterns in the touched app/package.
- Don't add/update dependencies unless required for the task.
- Feature branches from `v3`. Conventional commits preferred.

## Factory Skills (AI Assistance)

Skills are defined in `.factory/skills/` (also mirrored in `.github/skills/`). `.claude/skills` is a symlink to `.factory/skills/`, so Claude Code skills stay in sync automatically.

- `agent-browser` -- **primary verification tool for all frontend work**. Any change that could affect what users see in the browser must be verified with `agent-browser` before the task is considered complete. See `.factory/skills/agent-browser/SKILL.md` for full reference.
- `web-design-guidelines` -- UI/UX/accessibility review (see `.factory/skills/web-design-guidelines/SKILL.md`).
- `vercel-react-best-practices` -- React/Next performance guidance (see `.factory/skills/vercel-react-best-practices/SKILL.md`).

### Using agent-browser to verify changes

**MANDATORY**: Any PR or change touching frontend apps, shared components, styling, layout, or user-facing text MUST be verified with `agent-browser` before the task is marked complete. Do not rely on "the logic looks correct" -- open the page and confirm visually.

#### When to verify

Verify with `agent-browser` whenever your change touches any of:

- **Frontend apps** (`apps/frontend-pwa`, `apps/frontend-manage`, `apps/frontend-control`, `apps/chat`, `apps/auth`, `apps/office-addin`)
- **Shared components** (`packages/shared-components`, `packages/markdown`)
- **Styling / TailwindCSS** classes, design-system tokens, or layout changes
- **i18n text** (`packages/i18n`) -- confirm the rendered string is correct
- **GraphQL ops consumed by the frontend** -- verify the page still loads and displays data correctly after schema/op changes
- **Auth/login/redirect/cookie-domain** changes
- **Cross-app flows** (e.g. manage <-> auth, pwa <-> auth)
- **Browser-only behavior** (localStorage, service worker/PWA, media queries)

#### Verification workflow

1. Open the relevant page: `agent-browser open <url>`
2. **Screenshot before** the action: `agent-browser screenshot /tmp/before.png --full`
3. Perform the interaction (click, fill, navigate)
4. **Screenshot after**: `agent-browser screenshot /tmp/after.png --full`
5. Review both screenshots with the `Read` tool and compare
6. If the result does not match expectations, fix and re-verify

**Screenshots are required** -- snapshots alone miss visual regressions. Always take before/after screenshots and review them.

#### Prerequisites

The app must be running locally in **dev mode** and the database must be **seeded**.

### Troubleshooting agent-browser + Traefik

If `https://*.klicker.com` shows **502 Bad Gateway**, Traefik or the target app is not reachable.
Before running UI flows:

- Confirm Traefik is up and routing to the expected ports.
- Confirm each app is listening on its local port (3001/3002/3003/3004/3000/3010).
- If Traefik is blocked, temporarily use the documented `http://localhost:<port>` URLs.

For flaky interactions, always `agent-browser wait --load networkidle` before `find/click/fill`.
If you see `Resource temporarily unavailable (os error 35)` or `(no interactive elements)`, take a screenshot,
then retry after a short wait or reload. If the screenshot shows 502, fix the environment first.

If `agent-browser` is missing entirely:

```bash
npm i -g agent-browser
```

If the browser executable is missing on a new machine, run once:

```bash
agent-browser install
```

For automated runs, **do not use Edu-ID** (it will not work with `agent-browser`). Always use **Delegated login**:

- Username: `lecturer`
- Password: `abcd`

For Student PWA testing in local seeded dev environments, you can log in with the seeded participants (see `packages/prisma-data/src/data/seedTEST.ts`):

- Usernames: `testuser1`-`testuser50` (enrolled in course **Testkurs**)
- Password: `abcdabcd`

Additional seeded participants exist (`testuser51`-`testuser52`), but they are not enrolled in any course by default.

### Example: delegated login (Manage)

Note: on the first screen, **"Delegated Access" is disabled until the Terms checkbox is checked**.

```bash
agent-browser open https://manage.klicker.com
agent-browser screenshot /tmp/klicker-manage-01.png --full
agent-browser snapshot -i -c

# 1) Check the Terms checkbox (if needed)
# 2) Click "Delegated Access"
# 3) Fill username/password and submit
# (Use the @e* refs from the latest snapshot output)

agent-browser wait --load domcontentloaded
agent-browser screenshot /tmp/klicker-manage-02.png --full
agent-browser get url
agent-browser close
```

These credentials are intended for local seeded dev environments only.
