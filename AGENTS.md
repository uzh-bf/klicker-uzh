# KlickerUZH

## Quick Reference

- **Monorepo**: pnpm 11.x + Turborepo, Node.js 24 (Volta-pinned; see `volta` in root `package.json` for exact versions)
- **Main branch**: `v3` (active development)
- **Legacy branches**: `dev` and `master` belong to the older Klicker variant and are not actively developed.
- **Package names**: `@klicker-uzh/<name>` (e.g., `@klicker-uzh/graphql`)

## Stacked PRs

- GitHub stacked PRs are enabled for this repository. Always use `$stacked-change` and `$gh-stack` for larger features: substantial cross-layer or multi-concern work, changes with distinct reviewer audiences or runtime models, and existing large branches that need decomposition. Keep an ordinary single PR for small, cohesive changes only.
- This is a KlickerUZH repository capability, not a GitHub-wide assumption. Verify native stack support before using the workflow in another repository.
- Final AI review is standing-authorized for all KlickerUZH PRs. Once exact-head CI and ordinary feedback are settled, agents may post `/final-review` for an unstacked PR or ordinary stack layer, and `/final-review-stack` only on the top PR of a verified native stack, without asking again. This approval covers sending the public PR diff to the workflow's configured OpenRouter model and the resulting usage cost; it does not authorize merging, approving, force-pushing, or exposing uncommitted or private data.

## Commands

### Root-level (from repo root)

```bash
pnpm install                  # install all deps
pnpm run build                # build everything (turbo)
pnpm run check                # typecheck all packages (tsc --noEmit)
pnpm run lint                 # eslint (Next.js safety net) across all packages
pnpm run format               # biome format (code) + prettier (md/yaml, e2e specs)
pnpm run format:check         # check formatting (biome + prettier)
pnpm run check:all            # check + format:check + lint + syncpack
pnpm run dev                  # full dev (requires Infisical secrets)
pnpm run dev:raw              # dev without secret injection
pnpm run dev:playwright       # dev in test/playwright mode
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

The generated client documents and persisted-query maps are build outputs and
are ignored by Git; package builds regenerate them before producing `dist`.
The generated public SDL snapshot remains tracked for schema review and local
GraphQL tooling.

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
```

## Tech Stack

| Layer                  | Technology                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| Frontend framework     | Next.js 16, React, TypeScript                                                             |
| Styling                | TailwindCSS, @uzh-bf/design-system                                                        |
| GraphQL server         | GraphQL Yoga + Pothos schema builder                                                      |
| GraphQL client         | Apollo Client                                                                             |
| ORM                    | Prisma 7 (PostgreSQL)                                                                     |
| Caching                | Redis (ioredis)                                                                           |
| Workflow orchestration | Hatchet (workers for async processing)                                                    |
| Auth                   | Edu-ID (OIDC), magic links, LTI, delegated login                                          |
| Build                  | Turborepo + Rollup                                                                        |
| Test                   | Vitest (unit), Playwright (E2E)                                                           |
| Format + lint          | Biome (code fmt+lint), Prettier (md/yaml + playwright specs), ESLint (Next.js safety net) |

## GraphQL Workflow

Code-first with **Pothos** in `packages/graphql/src/`. After changing types/resolvers (`src/graphql/`) or `.graphql` ops (`src/graphql/ops/`), regenerate with `pnpm --filter @klicker-uzh/graphql generate` (codegen is required — ops are stale otherwise). Op-name prefixes: `Q` query, `M` mutation, `S` subscription, `F` fragment. Package builds regenerate the ignored typed documents and persisted-query maps; the generated public SDL snapshot at `packages/graphql/src/public/schema.graphql` remains tracked for review and local GraphQL tooling.

## Database Workflow

Prisma split-schema under `packages/prisma/src/prisma/schema/`. After editing a `.prisma` file: `pnpm run prisma:migrate` (creates/applies the migration and explicitly regenerates the TypeScript client), then `pnpm run prisma:sync` (mirrors model files into `apps/analytics` while preserving its Python generator and datasource), then rebuild dependents. Update GraphQL types/resolvers if the change affects the API. Prisma 7 reset and migration commands do not seed automatically; use the explicit setup or seed command for local fixtures.

## Auth Model

- **Lecturers**: Edu-ID (OIDC) or delegated login via `apps/auth`
- **Participants**: magic link, LTI, username/password, temporary (anonymous)
- JWT tokens; GraphQL resolvers enforce three-layer auth: authenticate -> authorize -> execute

### Participation state boundary

`Participation.isActive` is a **leaderboard opt-in flag**, not an enrollment,
course-access, or security flag. Toggling it changes leaderboard inclusion only;
it must never be used to grant or revoke assessment, course, or chatbot access.
Use the endpoint-specific authorization and invitation/account rules instead.
See [Domain Model](docs/domain-model.md) for the canonical explanation.

## Local Dev Setup

### Self-contained devcontainer (recommended)

Clone-and-run via a self-contained devcontainer — no Infisical/Doppler, no EduID, no `/etc/hosts` edits. The container owns the whole stack (Node 24 + pnpm toolchain, Postgres, 3× Redis, MailHog, Hatchet) and runs **all core apps in ONE container** via `turbo dev`. Run pnpm, Prisma, and unit tests **inside the container**. Playwright is the exception: always run `pnpm playwright:host -- <args>` from the host against the routed container stack. Never invoke Playwright or install its browsers through `devrouter exec`, a DevPod shell, or another local container; CI keeps its existing official Playwright container path.

```bash
devrouter ensure .
```

The same command starts and proves primary and linked checkouts. Use `devrouter exec . -- <command...>` for one-shot commands or the exact DevPod ID printed by `ensure` for an interactive shell.

The dev servers auto-start in the background (`devrouter exec . -- tail -f /tmp/dev.log`; first compile takes ~1min). Host-side `devrouter ensure` owns lifecycle reconciliation and delivers its matching process helper to the exact validated container. The default `full` profile runs every routed app plus the two Hatchet workers (no worker route); `devrouter ensure . --profile <name>[,<name>]` selects exact app/service/process unions (e.g. `chat`, `ai`, `mcp`, `chat,ai,mcp` - see `.devcontainer/README.md`). Analytics, Office add-in, and docs remain outside this stack.

#### OpenRouter-backed local chat

Infisical authentication and secret injection must run from a host shell
outside the Codex sandbox. Do not run Infisical
inside `devrouter exec`, the DevPod, or a container. Use the restricted
`rs-infisical-operator` as the only repository-supported injection path. Inject
the upstream key only at runtime, never into a file or the shell history:

```bash
rs-infisical-operator --profile <profile> status
rs-infisical-operator --profile <profile> permissions
rs-infisical-operator --profile <profile> run \
  --map OPENROUTER_API_KEY=UPSTREAM_OPENAI_API_KEY -- \
  env UPSTREAM_OPENAI_BASE_URL=https://openrouter.ai/api/v1 \
  devrouter ensure <checkout-path> --profile chat,ai,mcp --json
```

If the host-side operator profile or login is missing, stop and complete the
operator setup outside the sandbox. Do not substitute raw `infisical run`,
copy the key into a file, or pass it through chat, arguments, or logs.

If LiteLLM is already running without those variables, stop the exact linked
checkout with `devrouter stop <checkout-path>` and rerun the injection command;
`ensure` does not replace environment variables inside an existing service
container. Verify key presence only in the exact LiteLLM service with the
values-free host-side check in
[the OpenRouter local Chat solution](docs/solutions/integration/openrouter-local-chat-runtime.md).
Use only seeded or synthetic test content because OpenRouter is an external
upstream and the Azure-specific chatbot disclaimer does not describe this
local path.

Local Auto Mode is selected by `CHAT_PRIMARY_MODEL_ID=auto`. Chat sends the
`auto-router` deployment to LiteLLM at `http://litellm:4000`; LiteLLM classifies
the request with the current Auto V2 policy in `util/litellm/config.yaml`.
Classification uses Luna low; semantic corpus matching uses
`openai/text-embedding-3-small`; SIMPLE, MEDIUM, and COMPLEX route to Luna
medium, high, and xhigh; REASONING routes to Sol medium. LiteLLM then forwards
all three request types through OpenRouter's OpenAI-compatible endpoint;
OpenRouter supplies the selected models but does not make the routing decision.
This adds one classifier request and, for semantic matching, one embedding
request to the same external OpenRouter data boundary. It therefore adds local
latency and usage cost. LiteLLM falls back from Sol medium to `gpt-5.1` on an
upstream failure. Separately, zero-credit fallback remains within the selected
usage class. Chat can select allow-listed Luna for a BASE selection before
calling LiteLLM; current ADVANCED selections such as Auto are denied while no
ADVANCED fallback is allow-listed.

The seeded Benibot exposes a deterministic local `doc_query` MCP tool in Tutor
and Explainer modes. `post-start.sh` runs it at `http://localhost:1417/mcp`;
its source is `apps/chat/scripts/local-mcp-server.mjs` and its log is
`/tmp/local-mcp.log`. Keep `Auto Mode` selected, then test the complete path in
Chat with: “Use the local MCP tool to test the integration.
Search for `portfolio diversification` and tell me the exact marker it
returns.” A successful turn calls `KB_doc_query` and shows
`KLICKER_LOCAL_MCP_OK` in a non-empty final answer plus the synthetic source
card. Reload the thread and require the tool result, answer, and source to
remain visible. Use the direct `GPT-5.6 Luna` option only when isolating the
router from the model/tool integration.

**Routing:** [devrouter](https://github.com/rschlaefli/devrouter) ≥ 0.0.46 fronts the stack over the shared `devnet` network. Version 0.0.42 does not enforce post-create lifecycle ordering for managed adapters, 0.0.44 serializes shared TLS refresh, 0.0.45 assigns collision-safe identities to parallel DevPod and Devsy worktrees, and 0.0.46 queues parallel provider transitions fairly with visible wait progress and fail-closed detached-state recovery. One-time host setup must happen **before** the container starts:

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

### Authenticated load-test login

- Keep participant credential values only in Infisical. Do not put them in this file, repository files, command arguments, logs, or chat.
- The approved operator profile is `klicker-dev`; it intentionally maps to Infisical project `klicker-uzh-dev` in environment `dev`. Inject the allowlisted names directly into the child process:

  ```bash
  rs-infisical-operator --profile klicker-dev run \
    --map KLICKER_TESTSTUDENT_USERNAME=KLICKER_PARTICIPANT_USERNAME_OR_EMAIL \
    --map KLICKER_TESTSTUDENT_PASSWORD=KLICKER_PARTICIPANT_PASSWORD \
    -- k6 run util/load-test/chatbot-auth.js
  ```

- Set the target-specific `KLICKER_BASE_URL` and `KLICKER_API_URL` in the child environment. Normal login also requires `KLICKER_ALLOW_LOGIN=true`; PRD additionally requires `KLICKER_ALLOW_PRODUCTION=true`.
- Use `KLICKER_PARTICIPANT_TOKEN` instead when an already-issued token is supplied. Never print or persist either the token or the injected credential values.

## Code Conventions

- **TypeScript strict mode** everywhere
- **Functional components** with hooks only (no class components)
- **Component naming**: PascalCase files, `function` keyword for component declarations
- **Biome** (code): no semicolons, single quotes, trailing comma es5, 2-space indent, line width 80; imports organized via Biome assist (`organizeImports`)
- **Prettier**: Markdown/YAML plus the `playwright/` e2e specs (Biome excludes those dirs)
- Tailwind class sorting is not auto-enforced (deferred; previously `prettier-plugin-tailwindcss`)
- **Imports**: use `@` and `~` path aliases
- **GraphQL ops**: import from `@klicker-uzh/graphql`
- **State**: Apollo Client for server state, React hooks for local state
- **Styling**: TailwindCSS utilities only, `twMerge` for conditional classes

## Pre-commit / Pre-push

- **pre-commit** (husky): a staged `gitleaks` secret scan (skipped with a notice when the binary isn't installed; CI enforces it), then `pnpm run check:all` (typecheck + format:check via lint-staged + lint + syncpack)
- **pre-push**: runs `pnpm run build`
- lint-staged: Biome on staged code files, Prettier on staged Markdown/YAML and `playwright/` specs

## Important Notes

- **Task tracking**: ClickUp is the source of truth; GitHub Issues are not actively used.
- Dev scripts use `./util/_run_with_infisical.sh` for secret injection. Avoid starting dev servers unless explicitly asked.
- If you add or rename an Infisical-managed env var/secret, also update `turbo.json` `globalEnv` so Turborepo sees it during task execution and cache invalidation.
- Never commit secrets, `.env` files, or credentials. **This repo is public** — anything committed on any branch, once pushed, is permanent public history that deleting the file later does not remove.
- **Data hygiene before every commit.** Review staged content (`git diff --cached`, and open any staged data file) for secrets _and_ real personal data — participant/student names, email addresses, matriculation/Studi-IDs, raw response exports, course rosters. Be especially wary of bulk data files (`.csv`, `.json`, `.sql` dumps): these are the highest-risk carriers and are easy to sweep in with `git add .`. Real course-data pulls belong outside the repo (add a `.gitignore` rule); if such data must be versioned, it goes in a private location with direct identifiers removed first. Pseudonymous ids (participant UUIDs) are lower-risk but still get the same scrutiny. When in doubt, do not commit — ask.
- Keep changes small, follow existing patterns in the touched app/package.
- Don't add/update dependencies unless required for the task.
- Feature branches from `v3`. Conventional commits preferred.
- **Keep this file high-level.** Durable, non-obvious engineering knowledge lives in [docs/](docs/); architectural decisions are recorded as ADRs in [docs/adr/](docs/adr/). Update the matching page or ADR when a change makes it inaccurate or introduces a durable contract that the code does not explain, rather than growing this overview.

## Engineering Wiki

[docs/](docs/) is the selective, agent-facing OKF v0.1 engineering wiki for working on this codebase (not to be confused with `apps/docs`, the user-facing site). It contains durable knowledge that is non-obvious from the source: top-level area guides explain _what_ and _how_, [docs/adr/](docs/adr/) records _why_, and `docs/solutions/` captures reusable lessons from resolved problems. Preserve concept frontmatter and use descriptive filenames, direct links, and repository search. The OKF index and log paths (`docs/index.md`, `docs/log.md`, and `docs/log/`) are intentionally absent and must never be created or restored because they duplicate directory discovery and Git history.

Read the relevant pages before working in an unfamiliar area. Update `docs/` and the relevant skills in `.agents/skills/` in the same PR when a change makes existing guidance inaccurate or introduces a durable contract that the code does not explain. A behavior change does not require a ceremonial documentation edit. The former `project/CODEBASE_NOTES.md` is a retired pointer stub.

## AI Assistance (Skills)

Skills live in `.agents/skills/` (the canonical location); `.claude/skills` and `.github/skills` symlink to it, so Claude Code and GitHub stay in sync. Task-shaped `klicker-*` skills cover the feature lifecycle — environment diagnosis (`klicker-environment-doctor`), design (`klicker-feature-design`), API (`klicker-graphql-api`), schema/data (`klicker-data-model`), UI (`klicker-frontend-ui`), testing/verification (`klicker-testing-verification`), e2e (`klicker-playwright-e2e`), and wiki upkeep (`klicker-wiki-maintenance`).

- **`agent-browser`** — **mandatory** verification for any change touching frontend apps, shared components, styling, i18n text, frontend-facing GraphQL ops, or auth/redirect/cookie flows. Open the page and confirm with before/after screenshots; don't rely on "the logic looks correct". Run via `npx agent-browser`, and log in with **delegated** access, not Edu-ID (credentials under [Test credentials](#test-credentials-local-seeded-db-only)). Full workflow + Traefik troubleshooting: [.agents/skills/agent-browser/SKILL.md](.agents/skills/agent-browser/SKILL.md).
- **`web-design-guidelines`** — UI/UX/accessibility review ([SKILL.md](.agents/skills/web-design-guidelines/SKILL.md)).
- **`vercel-react-best-practices`** — React/Next performance guidance ([SKILL.md](.agents/skills/vercel-react-best-practices/SKILL.md)).

<!-- devrouter -->

## Agent skills

### Issue tracker

Issues and specs live in ClickUp, reached through the `clickup_*` MCP tools; GitHub Issues are not used. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles keep their default names and are applied as ClickUp tags. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one shared `CONTEXT.md` at the root plus `docs/adr/`, with no context map. See `docs/agents/domain.md`.

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
- Managed selective profile: `devrouter ensure . --profile <name> --json`
- Host/docker runtime app only: `devrouter app run <host-app> --repo . --yes`
- `devrouter ls`
- Managed devcontainer source configs with `postCreateCommand` and a managed post-start adapter must set `waitFor` exactly to `postCreateCommand` or `postStartCommand`; generated managed configs preserve lifecycle fields and change only `runServices`.
<!-- /devrouter -->
