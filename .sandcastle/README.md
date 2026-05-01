# Sandcastle (agentic sandboxing)

[Sandcastle](https://github.com/mattpocock/sandcastle) (`@ai-hero/sandcastle`) wraps Claude Code in an isolated Docker sandbox so we can dispatch agentic tasks against a copy of this repo without touching the developer's working tree.

## When to use it

| Tool                                                        | Use for                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| IDE Claude Code (`.claude/skills/`, `.factory/skills/`)     | Interactive edits with full host access.                                          |
| GitHub `@claude` mention (`.github/workflows/claude.yml`)   | PR-driven Claude tasks triggered from issues / PR comments.                       |
| **Sandcastle** (`pnpm sandcastle` / `pnpm sandcastle:exec`) | Hands-off batch tasks (renames, codemods, doc sweeps) where HEAD must stay clean. |

## Quickstart

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pnpm sandcastle --task "Add a JSDoc header to packages/util/src/index.ts."
```

First run also needs the sandbox image to exist:

```bash
docker build -t klicker-sandcastle:local .sandcastle
```

## Flags

| Flag                     | Effect                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `--task <text>` / `-t`   | Inline task; substituted into `{{TASK}}` of `prompt.md`. Defaults to `SANDCASTLE_TASK` env or smoke test text.                   |
| `--prompt <file>` / `-p` | Use a different prompt file (defaults to `.sandcastle/prompt.md`).                                                               |
| `--branch <name>`        | Commit on a named branch (`branchStrategy: { type: 'branch', branch: '...' }`).                                                  |
| `--head`                 | Write directly to HEAD (faster, less safe).                                                                                      |
| `--with-services`        | Attach the sandbox to the local docker-compose `klicker-uzh_klicker` network and forward DB / Redis / Hatchet / OpenAI env vars. |
| `--reuse`                | (Reserved) Future hook for `createSandbox()` reuse across multiple runs.                                                         |

Default branch strategy is `merge-to-head`: agent commits land on a temp branch and merge back into HEAD only on success.

## Services mode

For tasks that need a live database, Redis, or Hatchet, the local compose stack must already be up so the network exists:

```bash
pnpm dev    # or: docker compose up -d postgres redis_exec redis_cache hatchet
pnpm sandcastle:exec --with-services --task "Connect to DATABASE_URL and print the first 5 table names. Do not modify any files."
```

`pnpm sandcastle:exec` wraps `pnpm sandcastle` with `./util/_run_with_infisical.sh --env dev`, so the runner sees real Infisical-injected secrets to forward into the sandbox.

## Secrets

- Most agent tasks need only `ANTHROPIC_API_KEY`. Set it in your shell or in `.sandcastle/.env` (gitignored).
- Never commit `.sandcastle/.env` or `.sandcastle/.env.local`.
- `--with-services` mode forwards an explicit allowlist of klicker env vars; nothing else from the host environment leaks into the sandbox.

## Caching

The runner bind-mounts the host pnpm store (`$PNPM_STORE_PATH` or `~/.local/share/pnpm`) into the sandbox, so `pnpm install --frozen-lockfile` is fast on subsequent runs (~30-60 s vs ~3-6 min cold).

## CI

Intentionally not wired up yet. The existing `.github/workflows/claude.yml` covers PR-driven Claude tasks; a future workflow can call `pnpm sandcastle` for scheduled or batch automation.
