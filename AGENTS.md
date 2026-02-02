# AGENTS.md

This repository is a **pnpm + Turborepo monorepo** for **KlickerUZH v3**.

## Repo layout

- `apps/*` — deployable apps/services (frontends, backend services, Azure Functions)
- `packages/*` — shared libraries (e.g. `graphql`, `prisma`, `util`)
- `cypress/` — end-to-end tests

## Tooling / prerequisites

- **Node.js 20** (see `package.json` `engines` / `volta`)
- **pnpm 10.x** (repo is pinned to `pnpm@10.15.0`)

## Common commands (run from repo root)

- Install dependencies: `pnpm install`
- Format: `pnpm run format` / Check: `pnpm run format:check`
- Lint: `pnpm run lint`
- Typecheck (CI-style): `pnpm run check`
- Build: `pnpm run build`

## Running a single workspace

Use filters:

- `pnpm --filter <workspace> <script>` (example: `pnpm --filter @klicker-uzh/graphql build`)

## Dev notes

Some dev scripts load secrets via `./util/_run_with_infisical.sh` (e.g. `pnpm run dev`). Avoid starting long-running dev servers or anything requiring credentials unless explicitly requested.

## Apps & URLs

Local development uses Traefik to route `*.klicker.com` hostnames to apps running on the host (see `util/traefik/rules_docker.yaml` / `util/traefik/rules_wsl.yaml`).

| URL                                         | App / code                                  | Local port | Notes                            |
| ------------------------------------------- | ------------------------------------------- | ---------: | -------------------------------- |
| https://pwa.klicker.com                     | Student PWA (`apps/frontend-pwa`)           |       3001 |                                  |
| https://manage.klicker.com                  | Lecturer UI (`apps/frontend-manage`)        |       3002 |                                  |
| https://control.klicker.com                 | Mobile controller (`apps/frontend-control`) |       3003 |                                  |
| https://chat.klicker.com                    | Chat UI (`apps/chat`)                       |       3004 |                                  |
| https://auth.klicker.com                    | Auth UI (`apps/auth`)                       |       3010 |                                  |
| https://api.klicker.com                     | Backend / GraphQL (`apps/backend-docker`)   |       3000 | GraphQL endpoint: `/api/graphql` |
| https://assessment.klicker.com              | Assessment PWA (same service as PWA)        |       3001 |                                  |
| https://assessment-api.klicker.com          | Assessment API (same service as API)        |       3000 |                                  |
| https://response-api.klicker.com            | Response API (`apps/response-api`)          |       7078 |                                  |
| https://response-api-assessment.klicker.com | Response API (assessment)                   |       7078 |                                  |

If Traefik is not used, the apps are still reachable directly via `http://localhost:<port>`, but the `*.klicker.com` domains better mirror production cookie/domain behavior.

## Factory skills (AI assistance)

This repo includes Factory skills under `.factory/skills/` (mirrored in `.github/skills/`).

- `agent-browser` — browser automation for UI verification (see `.factory/skills/agent-browser/SKILL.md`).
- `web-design-guidelines` — UI/UX/accessibility review (see `.factory/skills/web-design-guidelines/SKILL.md`).
- `vercel-react-best-practices` — React/Next performance guidance (see `.factory/skills/vercel-react-best-practices/SKILL.md`).

### Using agent-browser to verify changes

Use `agent-browser` when changes affect browser behavior and need real UI validation, especially:

- Auth/login/redirect/cookie-domain changes
- UI/UX changes (layout, navigation, forms)
- Cross-app flows (e.g. manage ↔ auth, pwa ↔ auth)
- Browser-only behavior (localStorage, service worker/PWA, media queries)

**Screenshots are required** (snapshots alone miss visual regressions). Take a screenshot before and after the action you’re verifying and review it with the `Read` tool.

Prereqs: the app is running locally in **dev mode** and the database is **seeded**.

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

- Usernames: `testuser1`–`testuser50` (enrolled in course **Testkurs**)
- Password: `abcdabcd`

Additional seeded participants exist (`testuser51`–`testuser52`), but they are not enrolled in any course by default.

### Example: delegated login (Manage)

Note: on the first screen, **“Delegated Access” is disabled until the Terms checkbox is checked**.

```bash
agent-browser open https://manage.klicker.com
agent-browser screenshot /tmp/klicker-manage-01.png --full
agent-browser snapshot -i -c

# 1) Check the Terms checkbox (if needed)
# 2) Click “Delegated Access”
# 3) Fill username/password and submit
# (Use the @e* refs from the latest snapshot output)

agent-browser wait --load domcontentloaded
agent-browser screenshot /tmp/klicker-manage-02.png --full
agent-browser get url
agent-browser close
```

These credentials are intended for local seeded dev environments only.

## Change hygiene

- Keep changes small and follow existing patterns in the touched app/package.
- Don’t add/update dependencies (or churn lockfiles) unless required for the task.
- Never commit secrets (tokens, `.env` files, credentials).
