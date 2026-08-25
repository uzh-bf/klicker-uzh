---
type: Guide
title: Getting Started
description: Toolchain, first-time setup, infrastructure bring-up, dev-server paths, and the exact failure signatures a fresh clone produces.
timestamp: '2026-08-12'
tags:
  - environment
  - onboarding
---

# Getting Started

**The one thing to get right first: use pnpm 11.** A stale pnpm major (e.g. a Volta shim serving 9.x because `VOLTA_FEATURE_PNPM` is unset) will install successfully but **silently rewrite `pnpm-lock.yaml`** (~380-line churn). Run `pnpm --version` and confirm `11.x` before installing; if the lockfile got churned, `git checkout pnpm-lock.yaml` and reinstall with pnpm 11.

## Toolchain (verified 2026-07-07)

Aligned to Node `24.16.0` and pnpm `11.5.0` across the entire workspace, including the self-contained devcontainer. Pinned in root `package.json`: `volta.node = 24.16.0`, `volta.pnpm = 11.5.0`, `packageManager = pnpm@11.5.0`.

The workspace TypeScript baseline is `~6.0.3` across all packages, including `apps/office-addin`. The Office Add-in uses the browser/bundler contract (`target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `noEmit`) and explicitly loads the `office-js` global types required by TypeScript 6. No syncpack exception is needed.

Code-quality tooling (config-derived) runs on the host and in CI, never baked into the devcontainer image. **Biome** (`biome.json`) is the formatter and general linter for code (TS/JS/JSON/CSS) with the house style (no semicolons, single quotes, `es5` trailing commas, 2-space indent, line width 80) and import organization via its assist; it **excludes** `playwright/` (Biome mangles Playwright `test.describe.serial()` chains), which **Prettier** formats along with all Markdown/YAML. **ESLint** stays only as the Next.js safety net (`pnpm run lint` via Turbo, per-app `eslint .`). **Knip** (`knip.json`) reports unused files/deps/exports; **Gitleaks** (`.gitleaks.toml`) scans for secrets. In CI, formatting, types, syncpack, and Gitleaks are **blocking**; Biome lint and Knip are **advisory** during the migration.

Compiler settings follow the code's runtime and build owner:

| Role                                       | Compiler contract                                                                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js application                        | `target: ES2017`, `module: ESNext`, `moduleResolution: Bundler`, `jsx: react-jsx`, and the Next TypeScript plugin                                                                   |
| Emitted Node application or library        | `module: NodeNext`; use incremental build info only when the build owner preserves outputs and matching state atomically, and emit declarations only for packages that publish them |
| Browser or bundler-owned source            | Bundler resolution; source-only packages use `module: preserve` and `noEmit`                                                                                                        |
| Node-only script source                    | `module: NodeNext` with `noEmit`; the runtime transpiler owns execution                                                                                                             |
| Check-only config extending an emit config | `noEmit`; disable inherited declarations when declaration portability is outside the check's purpose, and keep incremental state separate from the emitting build                   |

The workspace does not use TypeScript project references or `tsc -b`, so `composite` is not a package-role marker. Emitted packages use `incremental` only when their build preserves outputs and matching state atomically; Prisma's Rollup build deliberately does not because it deletes `dist` while TypeScript's parallel build-start hook may read its cache. Separate compiler invocations also use separate build-info files: no-output checks cannot overwrite emit state, and Export's library and CLI Rollup builds own distinct caches. Do not choose `NodeNext` or `Bundler` by package location alone: choose it based on whether TypeScript/Node must resolve the emitted runtime imports or another bundler owns that job.

## Onboarding Paths

You can set up the environment in two ways:

### Path A: Self-contained Devcontainer (Recommended)

Clone-and-run via a self-contained devcontainer — no Infisical, no external EduID, no `/etc/hosts` edits needed. The container runs every routed app plus the two Hatchet workers through one `turbo dev` task set and houses all dependencies (Postgres, Redis, MailHog, Hatchet).

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
     3. Those namespaced hosts only work because `allowedDevOrigins` in `packages/next-config/index.js` is `['**.localhost']` in development (and `undefined` in production) — Next's implicit `*.localhost` matches a single label only. If that glob ever stops covering a worktree host, the symptom is an app that serves HTML but never hydrates, with no obvious error.
3. **Logs:** The dev servers auto-start inside the container. View logs via `devrouter exec . -- tail -f /tmp/dev.log`.

For OpenRouter-backed Chat, follow the host-side `rs-infisical-operator`
workflow in [AGENTS.md](../AGENTS.md). Use only seeded or synthetic content;
do not copy credentials into the repository or use raw Infisical injection.

`post-start.sh` keeps Klicker's environment and origin setup local. Host-side `devrouter ensure` delivers its matching process helper to the exact validated container, then invokes the adapter. Released devrouter `0.0.35` records its owned process group and fingerprints the workspace, command, adapter bytes, and declared non-secret origin environment in `/tmp/devrouter-process-klicker-dev.state`; an exact repeat is idempotent, stale owned groups are replaced boundedly, and unknown processes are never killed.

Devrouter owns generic process lifecycle and HTTP readiness. `ensure` verifies all ten routes and can spend one container recreate when an exact workspace is alive but an application remains unhealthy, including after a production build replaces live Next.js output.

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

1. **Full path**: `pnpm run dev` — injects secrets via `util/_run_with_infisical.sh` (requires an authenticated Infisical CLI; validates env names `dev`, `dev-assessment`, `dev-playwright`, `dev-cleverreach`, `stg`, `prd`) and serves via Traefik on `*.klicker.com` (needs `/etc/hosts` entries + mkcert certs; mirrors production cookie/domain behavior).
2. **Localhost path (no secrets)**: `pnpm run dev:raw` — hit apps directly: backend 3000, pwa 3001, manage 3002, control 3003, chat 3004, auth 3010, response-api 7078.

Compose infra needs no secrets; the app dev servers are the secret consumers. Database seeding: `pnpm run prisma:setup` (reset + push + seed — destructive, only on test-seeded state). Seeded test credentials are documented in the [AGENTS.md test-credentials section](../AGENTS.md) — never copy the values into other documents.

## Agent addendum

- **Never start dev servers unprompted** ([AGENTS.md](../AGENTS.md) rule). Skills that need a running app say so explicitly and own the cleanup (`./_down.sh`).
- **Browser verification**: always `npx agent-browser`, never bare `agent-browser` — a global install conflicts with Volta's Node shim and fails with "Could not execute command".
- **Turbo persistent dev tasks must set `"cache": false`** in [turbo.json](../turbo.json); otherwise Turbo can replay stale `EADDRINUSE` logs from a previous failed `dev:test` run while nothing is actually listening.
- **Any non-`NEXT_PUBLIC_` env var an app must see when started through a turbo task (`dev`, `build`, `test`) has to be listed in `turbo.json` `globalEnv`**, or task runs and cache invalidation won't see it. This is not limited to Infisical-managed secrets: Turborepo runs in strict env mode here (no `envMode` or `globalPassThroughEnv` key), so an unlisted var is stripped from the task environment even when the container shell exports it — including vars set in `.devcontainer/devcontainer.env`. Symptom: `process.env.YOUR_VAR` is `undefined` inside the app while `echo $YOUR_VAR` in the same container prints a value. Two things legitimately bypass this rule: `NEXT_PUBLIC_*` vars are picked up by turbo's Next.js framework inference, and Next loads `.env`/`.env.local` itself. The production image is **not** a bypass — only its runtime entrypoint (`node apps/chat/server.js`) is turbo-free, while its build stage runs `pnpm run build` → `turbo run build`, so anything inlined at build time (`next.config.ts` reads, values baked into the standalone bundle) still needs a `globalEnv` entry even when the Dockerfile declares a matching `ARG`. Confirm a var is listed with `pnpm exec turbo run dev --filter=<pkg> --dry=json | jq '.globalCacheInputs.environmentVariables.specified.env'`. In the per-task `environmentVariables` block, `specified.env` and `configured` are empty because this repo declares no per-task `env`; framework-inferred `NEXT_PUBLIC_*` vars show up under `inferred`.

### Klicker chatbot evaluation

Run the external evaluation framework from the main repository with:

```bash
pnpm run eval:klicker -- --mode eval --limit 20
```

The root-owned wrapper (`util/_run_klicker_eval.sh`) injects the `dev` Infisical environment without
watch mode, selects the local `gpt-5.6-luna` judge with high reasoning effort, and passes
`evaluation/framework/data/input/metrics/klicker_chatbot.yaml` through the framework's `--metrics`
option. Additional arguments are forwarded unchanged. It does not start LiteLLM; recreate that
container through Infisical if its upstream credentials are absent.
