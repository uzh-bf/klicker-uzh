---
name: devrouter
description: Work with devrouter for local dev routing (HTTP + TCP/Postgres + dependency-only Docker services)
user-invocable: false
---

# devrouter

Local dev routing via a shared Traefik reverse proxy. Provides stable `*.localhost` hostnames for HTTP apps and TCP/Postgres multiplexing on shared ports (80, 443, 5432).

## How it works

- Shared Traefik router owns host ports 80 (HTTP), 443 (HTTPS), 5432 (Postgres TCP).
- Per-repo config: `.devrouter.yml` (single source of truth).
- Global runtime artifacts: `~/.config/devrouter` (never edit manually).
- Hostnames must end with `.localhost` (lowercase alphanumeric + hyphens only).

## `.devrouter.yml` entry schema

```yaml
version: 1
devrouter:
  version: <semver> # required for devrouter -V / devrouter upgrade
project:
  name: <string> # optional
apps:
  - name: <string> # unique within repo
    kind: app | dependency # optional, default: app
    dependencies: # optional
      - app: <other-name>
        envMap: # optional; maps target env var name -> per-dep source var name
          DATABASE_URL: <UPPER_DEP_NAME>_URL

    # if kind=app:
    host: <name>.localhost
    protocol: http | tcp
    runtime: host | docker | proxy

    # if kind=app and runtime=proxy (protocol http or tcp):
    upstream: 127.0.0.1:3000 # already-running port to route to; no lifecycle/deps
    # Loopback (127.0.0.1/localhost) -> host.docker.internal (a published host
    # port). A non-loopback name is passed verbatim and resolved over devnet —
    # so a devcontainer container ON devnet (with a network alias) can be fronted
    # by NAME with NO published host port: upstream: <alias>:3000. This is the
    # collision-free way to run many apps at once (each its own *.localhost).
    # upstream may use the ${WORKSPACE} placeholder (e.g. ${WORKSPACE}-app:3000)
    # to target a per-workspace devcontainer alias — substituted with the resolved
    # workspace token at runtime. See "Workspace isolation" below. Do NOT put
    # ${WORKSPACE} in `host` (rejected); the host is auto-namespaced.
    # Managed `ensure` requires every HTTP/TCP upstream to begin with the exact
    # resolved workspace/project alias prefix before DevPod or route mutation.
    #
    # proxy + tcp (front a DB in an externally-managed container, e.g. a
    # devcontainer's Postgres on devnet) — no per-DB host port:
    #   protocol: tcp
    #   tcpProtocol: postgres        # selects shared entrypoint :5432
    #   upstream: <db-alias>:5432    # devnet alias of the DB container
    # Requires `devrouter tls install` (SNI is read from the TLS ClientHello). Connect
    # with direct-SSL so the ClientHello carries SNI, e.g.:
    #   psql "host=db.<app>.localhost port=5432 sslmode=require sslnegotiation=direct ..."

    # if kind=app and runtime=host (protocol must be http):
    hostRun:
      command: <string>
      cwd: <string> # relative to repo root, must not escape it
      portTimeout: 120 # seconds, optional
      strategy:
        type: auto
        denyPorts: [80, 443, 5432]
        allowPortRange: '1024-65535'

    # if kind=app and runtime=docker:
    docker:
      service: <string>
      internalPort: <number>
      composeFiles: [<string>] # relative to repo root
      router: <string> # optional

    # if kind=app and protocol=tcp:
    tcpProtocol: postgres # required; runtime must be docker OR proxy

    # if kind=dependency:
    runtime: docker
    docker:
      service: <string>
      composeFiles: [<string>] # relative to repo root
```

Validation rules:

- `kind=app`: `host` must end with `.localhost`
- `kind=app`: `runtime=host` supports `protocol=http` only
- `kind=app`: `runtime=proxy` supports `protocol=http` or `protocol=tcp`, requires `upstream` (`host:port`), and forbids `hostRun`/`docker`/`dependencies` (it only registers a route to an externally-managed upstream). `protocol=tcp` additionally requires `tcpProtocol` and TLS (`devrouter tls install`)
- `kind=app`: `protocol=tcp` requires `runtime=docker` (devrouter-managed container) or `runtime=proxy` (externally-managed upstream), plus a supported `tcpProtocol` (postgres/redis/mariadb/mysql)
- `kind=dependency`: must use `runtime=docker` and does not allow routed fields (`host`/`protocol`/`tcpProtocol`/`hostRun`/`docker.internalPort`/`docker.router`)
- Unknown keys rejected (strict schema)

## Docker compose requirements

- **Healthcheck required**: every dependency service must define a `healthcheck`. `docker compose up --wait` blocks until healthy; without one, wait returns immediately.
- **No published ports**: services must not publish host ports for devrouter-owned ports (80, 443, 5432). Avoid publishing ports at all -- devrouter handles routing via Traefik.
- **Postgres credentials**: use `POSTGRES_USER=prisma`, `POSTGRES_PASSWORD=prisma`, `POSTGRES_DB=prisma` and create a `shadow` database. devrouter injects per-dep `{PREFIX}_URL` / `{PREFIX}_SHADOW_URL` with these credentials.
- **Persistent volume warning**: if postgres defaults changed on an existing volume, reconcile credentials/data or recreate volumes when safe (for example `docker compose down -v`).

Example healthcheck:

```yaml
healthcheck:
  test: ['CMD-SHELL', 'pg_isready -U prisma -d prisma']
  interval: 5s
  timeout: 3s
  retries: 20
```

## Env var injection

When a host app depends on a TCP Docker service, `devrouter app run` and `devrouter app exec` inject per-dep deterministic vars (where `{PREFIX} = dep.name.toUpperCase().replace(/-/g, "_")`):

| Variable              | Value                                                              |
| --------------------- | ------------------------------------------------------------------ |
| `{PREFIX}_HOST`       | `localhost`                                                        |
| `{PREFIX}_PORT`       | random mapped port                                                 |
| `{PREFIX}_URL`        | protocol-specific URL (postgres, redis, mysql/mariadb)             |
| `{PREFIX}_SHADOW_URL` | `postgres://prisma:prisma@localhost:<port>/shadow` (postgres only) |

Host apps also receive `PORT` (random free port), `HOSTNAME=0.0.0.0`, `HOST=0.0.0.0`.

Config-level `envMap` on dependency references aliases per-dep vars to app-expected names (for example `DATABASE_URL: DB_URL` maps the per-dep `DB_URL` to `DATABASE_URL`).

## Workspace isolation (parallel git worktrees / agents)

Run several worktrees of one repo in parallel without host/route collisions. A **workspace token** spans the DevPod id, devrouter routes, `${WORKSPACE}` proxy upstreams, and devcontainer aliases.

- **Identity**: each managed linked worktree stores a local token in Git metadata plus a durable owner record in the repository's Git common directory. The record survives linked-worktree removal and binds the exact path to its DevPod ID. First use reuses an exact-path DevPod or derives a sanitized branch/path slug. Later flags or `DEVROUTER_WORKSPACE` may repeat the identity but cannot rename it. Ambiguous identities fail closed. The primary checkout remains non-namespaced.
- **When active**: hosts auto-namespace (`web.localhost` → `web.<ws>.localhost`), `${WORKSPACE}` in `upstream` is substituted with the token, and the docker `router` key is suffixed per workspace. Managed `ensure` rejects every HTTP/TCP proxy upstream outside that exact alias namespace before it mutates DevPod or routes. The runtime config is computed in memory only — the committed `.devrouter.yml` is never rewritten.
- **TLS**: namespaced hosts (`web.<ws>.localhost`) are not covered by the `*.localhost` wildcard; devrouter auto-extends the mkcert cert SANs for active hosts when TLS is enabled.
- **devcontainer integration**: managed scaffolds list the base compose file, then `${localEnv:DEVCONTAINER_COMPOSE_OVERLAY:docker-compose.default.yml}`; custom repositories may keep another default overlay. Selecting `.devcontainer/docker-compose.devrouter.yml` for linked worktrees must pass `WORKSPACE` and `DEVROUTER_WORKSPACE` across the combined base/overlay config and bind-mount `${DEVROUTER_GIT_COMMON_DIR}` to the same absolute app-container path. The app exposes `${WORKSPACE}-app`; the proxy uses `upstream: ${WORKSPACE}-app:<port>`.
- **Lifecycle**: after one-time `setup`, use `ensure .` for both primary and linked checkouts; never branch manually on checkout kind or use live verify as startup. `stop .` is non-destructive; `stop . --delete` is explicit exact-owner cleanup without worktree removal; and `exec . -- <command...>` runs one-shot commands only in the exact running DevPod. Never substitute raw `devpod up`, `stop`, or `delete`: they bypass devrouter's machine-global ownership lock. `workspace up` creates linked worktrees; destructive worktree removal and GC remain ledger-scoped. Dirty or locked full down fails before side effects.
- **Managed process identity**: `ensure` executes an exact captured adapter snapshot. Default reuse includes command argv, workspace, and adapter SHA-256. Set `DEVROUTER_PROCESS_FINGERPRINT_ENV` only to comma-separated non-secret environment names whose values affect runtime identity; secret-like names are rejected and raw values are never persisted.
- **Route state**: the versioned Traefik dynamic file is authoritative for both metadata and rendering. JSON is a compatibility mirror; valid headerless generations migrate automatically, while corrupt canonical metadata fails closed.
- **Cleanup**: `workspace cleanup --repo . --inactive-for 30d --json` is a report-only, no-`--yes` report for managed linked workspaces. It joins ownership (`present|missing|locked|conflict`), DevPod registration, runtime (`running|stopped|busy|not-found|absent|unknown`), checkout, route, advisory activity, and integration evidence without mutating DevPod, routes, ownership, Git, Docker, applications, worktrees, or branches. Local DevPod list/status checks always run; `--check-merged` alone enables read-only origin and matching GitHub/GitLab checks. Treat `not-found` as stale runtime after Docker pruning; busy, unavailable, or conflicting evidence suppresses destructive suggestions. Explicit `gc`/`down` can remove exact stale registration only after expected-ID `NotFound` proof and ownership revalidation. GC never removes Git worktrees, branches, or prune state. Git has no worktree-removal hook.
- **Sizing**: `--measure-size` adds per-workspace storage consumption to that report and stays read-only, but it walks each worktree and runs `docker ps` / `docker inspect --size`, so leave it off when you only need the evidence states. Each row reports reclaimable `worktree` and `containerWritable` bytes, non-reclaimable `imageShared` bytes, and a `reclaimable` total of the first two. `imageShared` covers image layers shared with other containers and overlaps across rows, so never sum it. Attribution is the workspace's own app container; sibling compose services such as a database are excluded. Any untrustworthy figure reports `unknown` with a reason rather than zero, and a workspace with no container reports a measured `0`.
- **Boundary**: workspace commands require Git. Normal config, app, status, and doctor flows remain usable from a `.devrouter.yml` folder without `.git`.

## Secret manager interop (Infisical/Doppler)

- Config-based SM integration: set `secretManager.command` in `.devrouter.yml` (include trailing `--`). devrouter wraps commands and re-injects dep env vars after the SM boundary.
- `secretManager.defaultEnv`: optional fallback environment for `{env}` template in command string.
- `{env}` template placeholder: `secretManager.command: "infisical run --env {env} --"` resolved at runtime. `--env <env>` CLI flag overrides `defaultEnv`.
- Example config:
  ```yaml
  secretManager:
    command: infisical run --env {env} --
    defaultEnv: dev
  ```
- Use `envMap` on dependency references to alias per-dep vars to app-expected names:
  ```yaml
  dependencies:
    - app: db
      envMap:
        DATABASE_URL: DB_URL
        DIRECT_URL: DB_URL
        SHADOW_DATABASE_URL: DB_SHADOW_URL
  ```
- Prefer argv-safe command forms. Do not wrap `infisical run` or `doppler run` in `sh -lc` unless shell expansion is strictly required.
- Canonical Infisical migrate command:
  `devrouter app exec <app> --yes -- infisical run --projectId <id> --env=<env> -- pnpm payload migrate`
- Canonical env probe command (run before migrate/seed):
  `devrouter app exec <app> --yes -- printenv DB_URL DB_HOST DB_PORT DB_SHADOW_URL`
- Canonical Doppler migrate command:
  `devrouter app exec <app> --yes -- doppler run -- pnpm payload migrate`
- Precedence best practice: avoid defining per-dep var names in Infisical/Doppler when you expect devrouter local DB injection.
- Precedence best practice: store remote/prod URLs under non-conflicting names (for example `PROD_DATABASE_URL`) and map intentionally via `envMap`.
- Precedence best practice: if secret manager must define DB vars, run the env probe and verify values before any migration/seed.
- Use `devrouter app exec --shell -- "<single command string>"` only when shell expansion is required.
- `envMap` fails fast when source var is missing so migrations do not run with partial mapping.

## Upgrade handling (required)

- Keep `.devrouter.yml` metadata `devrouter.version` aligned with the currently applied devrouter release.
- Verify versions with `devrouter -V` (shows installed CLI version, local repo version, and next upgrade target).
- Use `devrouter upgrade` to list available upgrade targets and `devrouter upgrade <version>` to print that target's Agent Adaptation Prompt from `upgrade-prompts/<version>.md`.
- Do not assume user-provided instructions include all required adaptation steps.
- After upgrading the CLI in a dependent repo, refresh discoverability artifacts with `devrouter repo agents` (or `devrouter init --write-agents --write-skill`).
- Re-run validation after upgrade: `devrouter doctor --repo .`, `devrouter app ls --repo .`, one representative `devrouter app exec` flow, and `devrouter ls`.

## Commands

- `devrouter init [--write-agents] [--write-skill]`: print AI onboarding prompt (non-mutating by default)
- `devrouter -V [--repo .]`: show installed CLI version, local repo version, and next upgrade target
- `devrouter upgrade [version] [--repo .]`: list upgrade targets or print target Agent Adaptation Prompt
- `devrouter setup --yes [--repo .] [--json]`: first-run machine setup plus structured diagnostics
- `devrouter ensure [path] [--open] [--json]`: canonical startup/reconciliation for primary and linked checkouts
- `devrouter stop [path] [--delete] [--json]`: stop the exact DevPod and remove exact routes; `--delete` explicitly deletes its ownership-proven data without removing the checkout
- `devrouter exec [path] -- <command...>`: literal one-shot command inside the exact running DevPod
- `devrouter up` / `devrouter down`: start/stop shared Traefik router
- `devrouter status`: router/container/network/TLS health
- `devrouter doctor [--repo .]`: deep diagnostics (global + repo)
- `devrouter ls`: list active HTTP + TCP routes
- `devrouter open <name>`: open HTTP route or print TCP connection hint (matches app name, then service/container/host identities)
- `devrouter logs [-f]`: Traefik access logs
- `devrouter tls install`: install mkcert certs, enable HTTPS + TCP/SNI
- `devrouter repo init`: create `.devrouter.yml`
- `devrouter repo inspect [--json]`: inspect package, scripts, compose services, env names, devcontainer, devrouter config, and agent guidance for onboarding
- `devrouter repo devcontainer write --dry-run --json`: plan conservative Node/pnpm/Postgres devcontainer/devrouter scaffold files without writing
- `devrouter repo devcontainer write --yes`: write managed Node/pnpm/Postgres devcontainer/devrouter scaffold files when no custom-file conflicts exist
- `devrouter repo devcontainer verify --json`: emit read-only onboarding evidence for PRs
- `devrouter repo devcontainer verify --live --yes --json`: deprecated compatibility verification after `ensure`; never use as startup
- `devrouter repo agents`: write devrouter section in AGENTS.md + install this skill
- `devrouter app add`: add/update app entry in `.devrouter.yml`
- `devrouter app ls`: list app entries
- `devrouter app run <name> [--env <env>] [--workspace <slug>]`: run app with dependency lifecycle (--env overrides SM defaultEnv; --workspace overrides the per-workspace token)
- `devrouter app exec <name> [--shell] [--env <env>] [--workspace <slug>] -- <cmd>`: one-shot command with resolved dep env
- `devrouter app rm <name> [--keep-config]`: remove app entry (`--keep-config` frees only the live route/hostname, leaves `.devrouter.yml` untouched)
- `devrouter workspace up <branch> [--path <dir>] [--no-devpod] [--open]`: create a worktree and start/prove it unless create-only mode is requested
- `devrouter workspace ensure [path] [--open] [--json]`: compatibility alias of `devrouter ensure`
- `devrouter workspace ls [--json]`: list ownership, Git, DevPod, route, path, and branch evidence
- `devrouter workspace cleanup [--repo .] [--inactive-for 30d] [--check-merged] [--measure-size] [--json]`: report-only cleanup evidence and exact guarded suggestions; no `--yes` or apply mode
- `devrouter workspace stop <workspace|branch>`: stop DevPod and routes; preserve checkout, owner record, and data
- `devrouter workspace down <workspace|branch> [--keep-worktree]`: delete runtime/routes and optionally remove the clean worktree and record
- `devrouter workspace gc [--json] [--yes]`: report missing owners by default; apply exact eligible cleanup with `--yes`

## Validation workflow

For devcontainer onboarding:

1. `devrouter setup --repo . --yes --json`
2. `devrouter doctor --repo . --json`
3. `devrouter repo inspect --repo . --json`
4. `devrouter repo devcontainer write --repo . --dry-run --json`
5. `devrouter repo devcontainer write --repo . --yes`
6. `devrouter repo devcontainer verify --repo . --json`
7. Start and prove either checkout kind with `devrouter ensure . --json`
8. Run seeds or migrations with `devrouter exec . -- <command...>`

For host/docker runtime apps only:

1. `devrouter setup --repo . --yes`
2. `devrouter doctor --repo .`
3. `devrouter app ls --repo .`
4. `devrouter app run <host-app> --repo . --yes`
5. `devrouter ls`
6. `curl -I https://<host>.localhost`
7. For TCP/Postgres, use `devrouter open <name>` for the connection hint.

## Runtime behavior notes

- Managed devcontainer images contain no devrouter package or helper. `devrouter ensure` delivers its matching process helper to the exact running container and invokes the repository-owned `.devcontainer/post-start.sh`; keep `.devrouter.yml` as the only consumer-side devrouter version pin.
- `devrouter app run` auto-starts Docker dependencies and waits for health. Host app runs stop auto-started docker deps on exit; docker app runs leave target services running until explicit cleanup.
- Host-runtime dependencies are NOT auto-started (v1).
- `kind=dependency` entries do not create routes and cannot be direct targets for `devrouter app run`, `devrouter app exec`, or `devrouter open`.
- `kind=dependency` services start as declared in compose (no Traefik label wiring, no random port publishing, no injected env vars).
- Postgres on shared `:5432` requires TLS/SNI (`devrouter tls install`). Standard app clients should use the injected random port instead.
- `devrouter app exec` follows the same dep lifecycle for one-shot commands and preserves argv semantics by default (`shell: false`).
- `devrouter app exec --shell` is explicit and requires exactly one command string after `--`.
- Secret-manager overlap caveat: if Infisical/Doppler defines DB vars too, probe effective env (`printenv DB_URL DB_HOST DB_PORT`) before migrate/seed.
