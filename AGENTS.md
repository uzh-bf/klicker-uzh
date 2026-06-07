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
- **AGENTS.md is a living document.** When you discover a non-obvious pattern, gotcha, or architectural decision during work, add it to the Codebase Learnings section below before the task is marked complete. Keep entries concise (1-2 sentences) with the file path where the pattern applies. Remove entries that become outdated (e.g., if a pattern is refactored away).

## Codebase Learnings

- **Prisma Decimal nullish check**: `Decimal` fields are objects, not numbers. `Decimal(0)` is truthy, so never use truthy checks for Decimal-to-number conversions -- always use `!= null`. (`packages/graphql/src/`)
- **Chat app auth guard pattern**: Route handlers in `apps/chat/src/app/api/chatbots/` use a 3-step auth pattern: `getParticipantId` -> `getChatbotOr404` -> `requireParticipation`. The composed helper `withChatbotAuth(req, chatbotId)` in `apps/chat/src/lib/server/apiGuards.ts` handles the standard `{ courseId: true }` case. Use it for new routes; only fall back to individual guards when you need a custom chatbot `select`.
- **Feature flag guards**: Don't combine feature flags with data-dependent counts (e.g., `privatePreview && numChatbots > 0`). The flag alone should gate visibility; combining with counts creates chicken-and-egg problems.
- **Zustand store error handling**: Async actions in zustand stores must set fallback state in `catch` blocks, not just log. Otherwise the UI stays in loading/broken state on network errors. (`apps/chat/src/stores/`)
- **Test environment caveats**: `pnpm run test:run` triggers Cypress which needs a running DB + seeded data. `pnpm --filter @klicker-uzh/graphql test` needs `HATCHET_CLIENT_TOKEN`. For verifying non-DB changes locally, target specific packages (e.g., `pnpm --filter @klicker-uzh/grading test`, `pnpm --filter @klicker-uzh/util test`).
- **PR review triage**: Copilot/CodeRabbit/SonarCloud flag many false positives. Always check if guards/fallbacks already exist before "fixing" reported issues. Confirm with the actual code, not the bot summary.
- **agent-browser via npx**: Always use `npx agent-browser` instead of bare `agent-browser`. Global install conflicts with Volta's Node shim and fails with "Could not execute command".
- **LTI launch target resolver contract**: Launch targets are resolved in strict precedence `custom claim (klicker_redirect_to)` -> `query redirectTo`; no env fallback is used in resolver logic. Validation fails closed on the first present invalid source and enforces URL hostname exact/subdomain checks against `COOKIE_DOMAIN` and `DF_DOMAIN` (never substring matching). (`apps/lti/src/launchTarget.ts`)
- **CSP frame-ancestors via ingress, not middleware**: Pages Router apps (manage, pwa, control) must NOT use Next.js middleware for CSP -- it breaks `_next/data` routes in production builds (known Next.js bug). CSP `frame-ancestors` is set at the reverse proxy layer: HAProxy ingress annotations in K8s (`haproxy.org/response-set-header`), Traefik `customResponseHeaders` middleware in local dev. (`deploy/charts/klicker-uzh-v3/templates/ingress-*.yaml`, `util/traefik/rules_docker.yaml`)
- **Cypress CI signal timing**: `cypress: default-group (merge)` can report an increasing failed-test count while `cypress-run-cloud` is still in progress; wait for `cypress-run-cloud` completion before expecting downloadable GitHub job logs. (`.github/workflows/cypress-testing.yml`)
- **Infisical + Turbo env sync**: Any Infisical-managed env var used by tasks must be listed in `turbo.json` `globalEnv`; otherwise task runs/cache behavior can become stale or inconsistent across environments.
- **Participant email uniqueness across auth modes**: Prisma enforces `Participant @@unique([email, isSSOAccount])`, so the same normalized email can exist once as manual and once as SSO. To block new cross-mode duplicates, account creation must explicitly check normalized email collisions in service logic. (`packages/graphql/src/services/accounts.ts`)
- **Helm v3 secrets are external**: `deploy/charts/klicker-uzh-v3/` deployments reference `envFrom.secretRef` names, but the chart currently defines no `Secret` manifests; secrets must be provisioned out-of-band with matching names. (`deploy/charts/klicker-uzh-v3/templates/`)
- **Production rollout strategy**: Do not use `Recreate` for production web/API Deployments; PDBs do not protect against Deployment-driven scale-downs, so slow image pulls can leave services with zero endpoints. Use `RollingUpdate` in `deploy/env-uzh-prd/values.yaml`, with `maxUnavailable: 0` only for singleton services and `1` for multi-replica services.
- **Edited chat image hydration needs a stable source id**: Edited branch messages in `apps/chat` get fresh local message ids, so image hydration must distinguish the local target message id from the persisted source message id (`attachmentSourceMessageId`) when fetching and merging attachments. (`apps/chat/src/hooks/useThreadManagement.ts`, `apps/chat/src/stores/chatStore.ts`)
- **Assistant UI chat drop targets**: `ComposerPrimitive.AttachmentDropzone` must wrap both normal and edit chat composer roots; it owns the drag/drop capture handlers that prevent native browser file navigation, while Klicker-specific limits stay in local composer code. (`apps/chat/src/components/thread.tsx`)
- **Deployed chat model registries default attachment support off**: `apps/chat` loads `CHAT_MODEL_REGISTRY_JSON` via `chatModelRegistry.ts`, where omitted `supportsImageAttachments` values default to `false`; if deployment values override the built-in registry, each image-capable model must set the flag explicitly in `deploy/env-uzh-*/values.yaml` or the attach button disappears.
- **OpenAI Responses storage and tool calls**: GPT-5.5 via the OpenAI Responses API can reference prior response items across tool-call steps; with `store: false`, LiteLLM/Azure can return "item not found" for those references. Keep `CHAT_OPENAI_STORE_RESPONSES=true` in shared/staged deployments that use Responses-compatible OpenAI backends, while local OpenRouter-style setups can leave it false. (`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`, `deploy/env-uzh-*/values.yaml`)
- **Embedded PWA messaging trust boundary**: For embedded PWA pages, use a parent-initiated `postMessage` handshake to capture `event.origin` and avoid `'*'` target origins; do not add a second per-platform messaging allowlist in page code. Embedding permission remains enforced separately by ingress `frame-ancestors`. (`apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`, `deploy/charts/klicker-uzh-v3/templates/ingress-frontend-pwa.yaml`)
- **Local embed harness target**: `util/embed-harness/` is for local verification only and should target the branch-local PWA (`http://127.0.0.1:3101/...`), not `https://pwa.klicker.com/...`, because production CSP / `frame-ancestors` blocks localhost embedding. (`util/embed-harness/`)
- **Chat PWA login redirects**: `apps/chat/src/app/noLogin/page.tsx` must pass an absolute chat URL to the PWA login `redirect_to`; a relative chatbot path makes the PWA redirect to its own domain and 404. Local chat dev also needs ignored local env values for the backend `APP_SECRET` and `DATABASE_URL` so participant cookies verify and Prisma can load chatbot data.
- **Capacitor copied web assets and typecheck**: `apps/frontend-pwa` uses `.next` as Capacitor `webDir`; `cap sync/copy` writes ignored Next standalone sources into native asset folders, so keep `android/app/src/main/assets/public` and `ios/App/App/public` excluded from the PWA `tsconfig.json`.
- **Capacitor release allowlist**: Keep `server.allowNavigation` environment-specific in `apps/frontend-pwa/capacitor.config.ts`. Store builds must not include local `.com` hosts anywhere in generated native `capacitor.config.json`, because `apps/frontend-pwa/scripts/checkCapacitorRelease.mjs` rejects those artifacts before release.
- **Native push token storage**: `packages/prisma/src/prisma/schema/participant.prisma` stores native push devices with raw `token` plus unique SHA-256 `tokenHash`; do not add a unique index on raw FCM/APNs token text, because token length is unbounded enough to be a poor database index key.
- **Capacitor native UI and SSR**: In `apps/frontend-pwa`, derive Capacitor-native availability after mount (for example in `useEffect`) and keep native APIs in effects or user actions. Rendering native-only UI from `Capacitor.getPlatform()` during SSR/client initial render can create hydration mismatches.
- **Native push local state**: Keep Capacitor push opt-in/token localStorage keys scoped by participant id in `apps/frontend-pwa/src/lib/nativePush.ts`; global opt-in state can make the next participant on a shared device inherit notification consent.
- **Offline practice asset manifest**: `packages/graphql/src/services/practiceQuizzes.ts` only admits `http(s)` and single-slash root-relative media URLs into download manifests. Include assets from rendered markdown fields such as element content, explanations, choice values/feedback, and case descriptions; never add custom-scheme or filesystem URLs.
- **Offline practice storage scope**: Downloaded practice snapshots include solutions, so `apps/frontend-pwa/src/lib/offlinePracticeStorage.ts` keeps files under participant-scoped paths and removes the old quiz directory before saving a new revision. Do not move snapshots back to a global index or leave old revisions behind.
- **Chat Vitest alias resolution**: `apps/chat/vitest.config.ts` mirrors the app `@/*` alias from `apps/chat/tsconfig.json`; keep this in sync when adding client tests for modules that import from `@/src/...`.

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

**Always run `agent-browser` via `npx`** (avoids Volta/global-install issues):

```bash
npx agent-browser <command>
```

If the browser executable is missing on a new machine, run once:

```bash
npx agent-browser install
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
