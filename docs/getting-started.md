---
type: Guide
title: Getting Started
description: Toolchain, first-time setup, infrastructure bring-up, dev-server paths, and the exact failure signatures a fresh clone produces.
timestamp: '2026-07-30'
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

Clone-and-run via a self-contained devcontainer — no Infisical, no external EduID, no `/etc/hosts` edits needed. The container runs every routed app plus the two Hatchet workers through one `turbo dev` task set and houses all dependencies (Postgres, Redis, MailHog, Azurite Blob Storage, Hatchet).

1. **Start and prove the checkout:**
   ```bash
   devrouter ensure .
   ```
   The same command owns primary and linked checkout startup. It prints the exact DevPod ID when an interactive shell is needed.
2. **Accessing the apps:**
   - **Mode 1 (Primary checkout):** Stable routes such as `https://manage.klicker.localhost` plus the fixed localhost ports. Lecturer login is `lecturer`/`abcd`.
   - **Mode 2 (linked checkout):** Routes linked-worktree traffic over HTTPS at `https://manage.klicker.<workspace>.localhost`. Requires:
     1. Install devrouter ≥ 0.0.35 and run `devrouter setup --yes` once.
     2. From an existing linked worktree, start and prove the environment with:
        ```bash
        devrouter ensure .
        ```
        Use `devrouter workspace up <branch-name>` from the main repository to create a new worktree. Do not use bare `devpod up` or manual route-token loops; `ensure` owns the persisted identity, Git mount, overlay, aliases, runtime proof, and routes together.
3. **Logs:** The dev servers auto-start inside the container. View logs via `devrouter exec . -- tail -f /tmp/dev.log`.

`post-start.sh` keeps Klicker's environment and origin setup local. Host-side `devrouter ensure` delivers its matching process helper to the exact validated container, then invokes the adapter. Released devrouter `0.0.35` records its owned process group and fingerprints the workspace, command, adapter bytes, and declared non-secret origin environment in `/tmp/devrouter-process-klicker-dev.state`; an exact repeat is idempotent, stale owned groups are replaced boundedly, and unknown processes are never killed.

Devrouter owns generic process lifecycle and HTTP readiness. `ensure` verifies all eleven routes and can spend one container recreate when an exact workspace is alive but an application remains unhealthy, including after a production build replaces live Next.js output.

The managed DevPod uses Azurite for both media and KB Blob uploads. Browsers use the routed account URL `https://blob.klicker.<workspace>.localhost/klickerdev`; GraphQL and the Hatchet workers use the workspace-specific internal Azurite alias over HTTP. `post-start.sh` configures the exact Manage origin as local Blob CORS. Production and staging keep the normal Azure account URL when the optional local URL overrides are absent.

The consumer contract is pinned once in `.devrouter.yml` at devrouter `0.0.35`. The devcontainer image contains no devrouter package or helper, and `devcontainer.json` does not run the managed adapter independently.

The image does include the repository's development toolchain: pnpm `11.5.0`, uv `0.11.12`, and the Python 3.12 selection used by analytics CI. This keeps `pnpm run check:all` reproducible inside the container.

`devrouter doctor --repo .` is the static check. `devrouter ensure .` is the runtime authority: it resolves the checkout-specific overlay and fails unless the actual container aliases, Git mount, managed process, and routes agree.

### Path B: Host-based Setup (Legacy)

Runs all services on your host machine. Needs Traefik (`*.klicker.com` reverse proxy), mkcert, `/etc/hosts` configurations, and Infisical for secret injection.

```bash
pnpm --version        # must print 11.x
pnpm install          # ~20s cold; peer warnings are pre-existing
pnpm run build        # 21 production-mode turbo tasks, ~1.5min; needs NO secrets
pnpm run check        # typecheck — only passes AFTER build (generated artifacts)
```

Order matters: on a fresh clone, `pnpm run check` fails in ~19 packages until `pnpm run build` has produced the Prisma client, GraphQL codegen output, and package dists. The root build script forces `NODE_ENV=production`, even when the devcontainer exports `NODE_ENV=development` for live apps. Direct checks for the five Next apps are self-contained with respect to Next-generated route types: each app runs `next typegen` before `tsc --noEmit`, so those ignored types do not require a prior app build. Workspace dependency builds are still required; CI builds changed packages before checking them. Git hooks depend on the same broader workspace state: pre-commit runs `check:all`, pre-push runs `build` — both fail hard without `node_modules` and the required workspace-generated artifacts.

## Failure signatures (fresh clone / wrong state)

| Exact error                                                                     | Cause                                                                                    | Fix                                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `sh: run-p: command not found` + `husky - pre-commit script failed`             | `node_modules` missing                                                                   | `pnpm install` (pnpm 11)                                        |
| `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`                                    | pnpm 11 found `node_modules` from another pnpm major; headless shell can't confirm purge | `pnpm install --config.confirmModulesPurge=false`               |
| `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` … `"overrides" configuration doesn't match` | `CI=true` forces frozen install after a wrong-major pnpm rewrote the lockfile            | `git checkout pnpm-lock.yaml`, non-frozen install with pnpm 11  |
| `Bind for :::5432 failed: port is already allocated`                            | another stack holds the host port (also seen on 6379, 7077/8888, 80/443)                 | `lsof -nP -iTCP:5432 -sTCP:LISTEN`, stop the other stack        |
| `Blob storage is not configured` in the managed DevPod                          | stale container or app process predates the Azurite environment                          | `devrouter ensure .`, then retry against the printed Blob route |
| ~19 packages fail `pnpm run check` on fresh clone                               | generated artifacts missing                                                              | `pnpm run build` once, then check                               |

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
