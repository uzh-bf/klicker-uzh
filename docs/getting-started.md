---
type: Guide
title: Getting Started
description: Toolchain, first-time setup, infrastructure bring-up, dev-server paths, and the exact failure signatures a fresh clone produces.
timestamp: '2026-07-07'
tags:
  - environment
  - onboarding
---

# Getting Started

**The one thing to get right first: use pnpm 11.** A stale pnpm major (e.g. a Volta shim serving 9.x because `VOLTA_FEATURE_PNPM` is unset) will install successfully but **silently rewrite `pnpm-lock.yaml`** (~380-line churn). Run `pnpm --version` and confirm `11.x` before installing; if the lockfile got churned, `git checkout pnpm-lock.yaml` and reinstall with pnpm 11.

## Toolchain (verified 2026-07-07)

Aligned to Node `24.16.0` and pnpm `11.5.0` across the entire workspace, including the self-contained devcontainer. Pinned in root `package.json`: `volta.node = 24.16.0`, `volta.pnpm = 11.5.0`, `packageManager = pnpm@11.5.0`.

## Onboarding Paths

You can set up the environment in two ways:

### Path A: Self-contained Devcontainer (Recommended)

Clone-and-run via a self-contained devcontainer — no Infisical, no external EduID, no `/etc/hosts` edits needed. The container runs all core apps via `turbo dev` and houses all dependencies (Postgres, Redis, MailHog, Hatchet).

1. **Start the container:**
   ```bash
   devpod up .            # builds image, starts services, installs, builds, seeds, runs dev
   devpod ssh klicker-uzh # shell inside the container
   ```
2. **Accessing the apps:**
   - **Mode 1 (Plain localhost fallback):** Exposed directly on host ports after starting devcontainer (`devpod up .` or via VS Code) without devrouter: Student PWA at `http://localhost:3001`, Lecturer UI at `http://localhost:3002` (login: `lecturer`/`abcd`).
   - **Mode 2 (devrouter overlay):** Routes local traffic over HTTPS: `https://manage.klicker.localhost` (or `https://manage.klicker.<workspace>.localhost` for parallel workspaces). Requires:
     1. Start devrouter on host (`devrouter up && devrouter tls install`).
     2. Start the devcontainer via devrouter command line for automatic overlay injection and token plumbing:
        ```bash
        dev workspace up <branch-name>
        ```
        _(Or for manual startup: `WORKSPACE=<slug> DEVCONTAINER_COMPOSE_OVERLAY=docker-compose.devrouter.yml devpod up .`)_.
     3. Register the application routes:
        ```bash
        for a in api auth pwa manage control olat-api response-api lti chat db; do devrouter app run "$a"; done
        # linked worktree variant:
        for a in api auth pwa manage control olat-api response-api lti chat db; do devrouter app run "$a" --workspace <slug>; done
        ```
3. **Logs:** The dev servers auto-start inside the container. View logs via `tail -f /tmp/dev.log`.

### Path B: Host-based Setup (Legacy)

Runs all services on your host machine. Needs Traefik (`*.klicker.com` reverse proxy), mkcert, `/etc/hosts` configurations, and Infisical for secret injection.

```bash
pnpm --version        # must print 11.x
pnpm install          # ~20s cold; peer warnings are pre-existing
pnpm run build        # 21 turbo tasks, ~1.5min; needs NO secrets
pnpm run check        # typecheck — only passes AFTER build (generated artifacts)
```

Order matters: on a fresh clone, `pnpm run check` fails in ~19 packages until `pnpm run build` has produced the Prisma client, GraphQL codegen output, and package dists. Git hooks depend on the same state: pre-commit runs `check:all`, pre-push runs `build` — both fail hard without `node_modules` and a prior build.

## Failure signatures (fresh clone / wrong state)

| Exact error                                                                     | Cause                                                                                    | Fix                                                            |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `sh: run-p: command not found` + `husky - pre-commit script failed`             | `node_modules` missing                                                                   | `pnpm install` (pnpm 11)                                       |
| `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`                                    | pnpm 11 found `node_modules` from another pnpm major; headless shell can't confirm purge | `pnpm install --config.confirmModulesPurge=false`              |
| `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` … `"overrides" configuration doesn't match` | `CI=true` forces frozen install after a wrong-major pnpm rewrote the lockfile            | `git checkout pnpm-lock.yaml`, non-frozen install with pnpm 11 |
| `Bind for :::5432 failed: port is already allocated`                            | another stack holds the host port (also seen on 6379, 7077/8888, 80/443)                 | `lsof -nP -iTCP:5432 -sTCP:LISTEN`, stop the other stack       |
| ~19 packages fail `pnpm run check` on fresh clone                               | generated artifacts missing                                                              | `pnpm run build` once, then check                              |

## Infrastructure (Docker Compose)

`docker compose config` resolves **without any secrets** (verified) — inline defaults cover the infra layer. Services and host ports from [docker-compose.yml](../docker-compose.yml):

| Service                                | Port(s)          | Role                                                     |
| -------------------------------------- | ---------------- | -------------------------------------------------------- |
| postgres                               | 5432             | primary DB                                               |
| redis_exec                             | 6379             | live-quiz execution state                                |
| redis_assessment                       | 6381             | assessment execution state                               |
| redis_cache                            | 6380             | response cache + pub/sub                                 |
| mailhog                                | 1025 / 8025 (UI) | local SMTP sink                                          |
| hatchet                                | 7077 / 8888 (UI) | workflow engine                                          |
| reverse_proxy_docker / \_macos / \_wsl | 80 / 443 / 8090  | Traefik (`*.klicker.com`) — pick the variant for your OS |
| litellm                                | 4000             | chat model proxy                                         |

Two traps:

- **The compose project name derives from the directory name.** A git worktree therefore gets its own parallel container/volume set — but the same host ports. Only one stack variant can run per machine.
- **`_run_app_dependencies.sh` is interactive and self-destructing for agents.** It has two `confirm` prompts, a foreground `docker compose logs -f`, and `trap cleanup INT TERM HUP EXIT` that runs `./_down.sh` — a headless agent running it will hang, then tear down the stack it just started on shell exit. Headless path: run its steps individually (`./util/sync-schema.sh` → certs on macOS → `docker compose up -d <services>` → `.github/scripts/wait-for-infra.sh` → hatchet token → `prisma:push`).

## Running the apps (config-derived — not executed in the wiki engagement; verify on your machine)

Two paths, depending on whether you have Infisical access:

1. **Full path**: `pnpm run dev` — injects secrets via `util/_run_with_infisical.sh` (requires an authenticated Infisical CLI; validates env names `dev`, `dev-assessment`, `dev-cypress`, `dev-playwright`, `dev-cleverreach`, `stg`, `prd`) and serves via Traefik on `*.klicker.com` (needs `/etc/hosts` entries + mkcert certs; mirrors production cookie/domain behavior).
2. **Localhost path (no secrets)**: `pnpm run dev:raw` — hit apps directly: backend 3000, pwa 3001, manage 3002, control 3003, chat 3004, auth 3010, response-api 7078.

Compose infra needs no secrets; the app dev servers are the secret consumers. Database seeding: `pnpm run prisma:setup` (reset + push + seed — destructive, only on test-seeded state). Seeded test credentials are documented in the [AGENTS.md test-credentials section](../AGENTS.md) — never copy the values into other documents.

## Agent addendum

- **Never start dev servers unprompted** ([AGENTS.md](../AGENTS.md) rule). Skills that need a running app say so explicitly and own the cleanup (`./_down.sh`).
- **Browser verification**: always `npx agent-browser`, never bare `agent-browser` — a global install conflicts with Volta's Node shim and fails with "Could not execute command".
- **Turbo persistent dev tasks must set `"cache": false`** in [turbo.json](../turbo.json); otherwise Turbo can replay stale `EADDRINUSE` logs from a previous failed `dev:test` run while nothing is actually listening.
- **New Infisical-managed env vars must also be listed in `turbo.json` `globalEnv`**, or task runs and cache invalidation won't see them.
