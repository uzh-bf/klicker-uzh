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
  version: <semver>         # required for dev -V / dev upgrade
project:
  name: <string>            # optional
apps:
  - name: <string>          # unique within repo
    kind: app | dependency   # optional, default: app
    dependencies:            # optional
      - app: <other-name>

    # if kind=app:
    host: <name>.localhost
    protocol: http | tcp
    runtime: host | docker

    # if kind=app and runtime=host (protocol must be http):
    hostRun:
      command: <string>
      cwd: <string>          # relative to repo root, must not escape it
      portTimeout: 120       # seconds, optional
      strategy:
        type: auto
        denyPorts: [80, 443, 5432]
        allowPortRange: "1024-65535"

    # if kind=app and runtime=docker:
    docker:
      service: <string>
      internalPort: <number>
      composeFiles: [<string>]  # relative to repo root
      router: <string>          # optional

    # if kind=app and protocol=tcp:
    tcpProtocol: postgres    # required; runtime must be docker

    # if kind=dependency:
    runtime: docker
    docker:
      service: <string>
      composeFiles: [<string>]  # relative to repo root
```

Validation rules:

- `kind=app`: `host` must end with `.localhost`
- `kind=app`: `runtime=host` supports `protocol=http` only
- `kind=app`: `protocol=tcp` requires `runtime=docker` and `tcpProtocol=postgres`
- `kind=dependency`: must use `runtime=docker` and does not allow routed fields (`host`/`protocol`/`tcpProtocol`/`hostRun`/`docker.internalPort`/`docker.router`)
- Unknown keys rejected (strict schema)

## Docker compose requirements

- **Healthcheck required**: every dependency service must define a `healthcheck`. `docker compose up --wait` blocks until healthy; without one, wait returns immediately.
- **No published ports**: services must not publish host ports for devrouter-owned ports (80, 443, 5432). Avoid publishing ports at all -- devrouter handles routing via Traefik.
- **Postgres credentials**: use `POSTGRES_USER=prisma`, `POSTGRES_PASSWORD=prisma`, `POSTGRES_DB=prisma` and create a `shadow` database. devrouter injects `DATABASE_URL` / `SHADOW_DATABASE_URL` with these fixed credentials.
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

When a host app depends on a TCP/Postgres Docker service, `dev app run` and `dev app exec` inject:

| Variable              | Value                                                                   |
| --------------------- | ----------------------------------------------------------------------- |
| `<UPPER_NAME>_HOST`   | `localhost`                                                             |
| `<UPPER_NAME>_PORT`   | random mapped port                                                      |
| `DATABASE_URL`        | `postgres://prisma:prisma@localhost:<port>/prisma` (postgres deps only) |
| `SHADOW_DATABASE_URL` | `postgres://prisma:prisma@localhost:<port>/shadow` (postgres deps only) |

Host apps also receive `PORT` (random free port), `HOSTNAME=0.0.0.0`, `HOST=0.0.0.0`.

`dev app exec --env-map TARGET=SOURCE` applies deterministic alias mapping after dependency env injection (for example `DATABASE_URI=DATABASE_URL`).

## Secret manager interop (Infisical/Doppler)

- Prefer argv-safe command forms. Do not wrap `infisical run` or `doppler run` in `sh -lc` unless shell expansion is strictly required.
- Canonical Infisical migrate command:
  `dev app exec <app> --yes --env-map DATABASE_URI=DATABASE_URL -- infisical run --projectId <id> --env=<env> -- pnpm payload migrate`
- Canonical Infisical seed command:
  `dev app exec <app> --yes --env-map DATABASE_URI=DATABASE_URL -- infisical run --projectId <id> --env=<env> -- pnpm payload seed`
- Canonical env probe command (run before migrate/seed):
  `dev app exec <app> --yes --env-map DATABASE_URI=DATABASE_URL -- printenv DATABASE_URL DATABASE_URI DB_HOST DB_PORT SHADOW_DATABASE_URL`
- Canonical Doppler migrate command:
  `dev app exec <app> --yes --env-map DATABASE_URI=DATABASE_URL -- doppler run -- pnpm payload migrate`
- Precedence best practice: avoid defining local `DATABASE_URL` / `DATABASE_URI` in Infisical/Doppler when you expect devrouter local DB injection.
- Precedence best practice: store remote/prod URLs under non-conflicting names (for example `PROD_DATABASE_URL`) and map intentionally in app config/scripts.
- Precedence best practice: if secret manager must define `DATABASE_URL`, run the env probe and verify values before any migration/seed.
- Avoid pre-wrapper DB assignments such as `DATABASE_URI=... <wrapper> run -- ...`; wrapper-managed env may override those values.
- Safe host-run override pattern when wrapper also defines `DATABASE_URI`:
  `infisical run --projectId <id> --env=<env> -- env DATABASE_URI=${DATABASE_URL:?missing DATABASE_URL} pnpm dev`
- `dev app run` does not currently expose `--env-map`; if an app only accepts `DATABASE_URI`, prefer app-level fallback (`DATABASE_URI` then `DATABASE_URL`) or a small repo-local wrapper script.
- `dev doctor --repo .` warns on risky pre-wrapper DB assignments before `run --` for host apps that depend on postgres.
- Use `dev app exec --shell -- "<single command string>"` only when shell expansion is required.
- `--env-map` fails fast when SOURCE is missing so migrations do not run with partial mapping.

## Upgrade handling (required)

- Keep `.devrouter.yml` metadata `devrouter.version` aligned with the currently applied devrouter release.
- Verify versions with `dev -V` (shows installed CLI version, local repo version, and next upgrade target).
- Use `dev upgrade` to list available upgrade targets and `dev upgrade <version>` to print that target's Agent Adaptation Prompt from `upgrade-prompts/<version>.md`.
- Do not assume user-provided instructions include all required adaptation steps.
- After upgrading the CLI in a dependent repo, refresh discoverability artifacts with `dev repo agents` (or `dev init --write-agents --write-skill`).
- Re-run validation after upgrade: `dev doctor --repo .`, `dev app ls --repo .`, one representative `dev app exec` flow, and `dev ls`.

## Optional Linear workflow bootstrap

- To add Linear task-management workflow assets to a repo, run:
  - `dev init --with-linear --write-agents --write-skill`, or
  - `dev repo agents --with-linear`
- This writes `.factory/skills/linear-workflow/SKILL.md` and reference templates, plus an idempotent AGENTS section.
- On AGENTS write flows, devrouter asks for minimal Linear mapping (workspace/team/project) and stores it in a managed AGENTS block:
  - `<!-- devrouter-linear-workflow-config:start -->`
  - `<!-- devrouter-linear-workflow-config:end -->`
- In non-interactive mode, placeholder values are written and should be replaced in the next interactive session.

## Commands

- `dev init [--write-agents] [--write-skill] [--with-linear]`: print AI onboarding prompt (non-mutating by default)
- `dev -V [--repo .]`: show installed CLI version, local repo version, and next upgrade target
- `dev upgrade [version] [--repo .]`: list upgrade targets or print target Agent Adaptation Prompt
- `dev up` / `dev down`: start/stop shared Traefik router
- `dev status`: router/container/network/TLS health
- `dev doctor [--repo .]`: deep diagnostics (global + repo)
- `dev ls`: list active HTTP + TCP routes
- `dev open <name>`: open HTTP route or print TCP connection hint (matches app name, then service/container/host identities)
- `dev logs [-f]`: Traefik access logs
- `dev tls install`: install mkcert certs, enable HTTPS + TCP/SNI
- `dev repo init`: create `.devrouter.yml`
- `dev repo agents [--with-linear]`: write devrouter section in AGENTS.md + install this skill (and optional Linear workflow assets)
- `dev app add`: add/update app entry in `.devrouter.yml`
- `dev app ls`: list app entries
- `dev app run <name>`: run app with dependency lifecycle
- `dev app exec <name> [--shell] [--env-map TARGET=SOURCE] -- <cmd>`: one-shot command with resolved dep env
- `dev app rm <name>`: remove app entry

## Validation workflow

1. `dev up` -- ensure shared router is running
2. For TCP/Postgres repos: `dev tls install`
3. `dev doctor --repo .` -- check global + repo health
4. `dev app ls --repo .` -- verify entries match expectations
5. `dev app run <host-app> --repo . --yes` -- start target app with deps
6. `dev ls` -- confirm routes are exposed
7. `curl -I https://<host>.localhost` -- HTTP reachability
8. For TCP/Postgres: use `dev open <name>` for connection hint

## Runtime behavior notes

- `dev app run` auto-starts Docker dependencies, waits for health, stops them on exit.
- Host-runtime dependencies are NOT auto-started (v1).
- `kind=dependency` entries do not create routes and cannot be direct targets for `dev app run`, `dev app exec`, or `dev open`.
- `kind=dependency` services start as declared in compose (no Traefik label wiring, no random port publishing, no injected env vars).
- Postgres on shared `:5432` requires TLS/SNI (`dev tls install`). Standard app clients should use the injected random port instead.
- `dev app exec` starts deps as needed for one-shot commands and preserves argv semantics by default (`shell: false`).
- `dev app exec` stops only deps started by that exec call; already-running deps stay running.
- If exec cannot determine pre-existing running services, it leaves selected deps running to avoid non-owned teardown.
- `dev app exec --shell` is explicit and requires exactly one command string after `--`.
- Secret-manager overlap caveat: if Infisical/Doppler defines DB vars too, probe effective env (`printenv DATABASE_URL DATABASE_URI DB_HOST DB_PORT`) before migrate/seed.
