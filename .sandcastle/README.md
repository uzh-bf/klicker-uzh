# Sandcastle (agentic sandboxing)

[Sandcastle](https://github.com/mattpocock/sandcastle) (`@ai-hero/sandcastle`) wraps an AI coding agent in an isolated Docker sandbox so we can dispatch agentic tasks against a copy of this repo without touching the developer's working tree. The agent here is **[opencode](https://opencode.ai) talking to [OpenRouter](https://openrouter.ai)** — Sandcastle does not use Claude Code. Any model on OpenRouter is selectable per run (Anthropic, OpenAI, Google, Meta, ...).

## When to use it

| Tool                                                        | Agent                         | Use for                                                                               |
| ----------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| IDE Claude Code (`.claude/skills/`, `.factory/skills/`)     | Claude Code on the host       | Interactive edits with full host access.                                              |
| GitHub `@claude` mention (`.github/workflows/claude.yml`)   | Claude Code in GitHub Actions | PR-driven tasks triggered from issues / PR comments.                                  |
| **Sandcastle** (`pnpm sandcastle` / `pnpm sandcastle:exec`) | **opencode + OpenRouter**     | Hands-off batch tasks (renames, codemods, doc sweeps) in a sandbox; HEAD stays clean. |

## Quickstart

```bash
export OPENROUTER_API_KEY=sk-or-v1-...
pnpm sandcastle --task "Add a JSDoc header to packages/util/src/index.ts."
```

To run against a specific GitHub issue, also provide a GitHub token that `gh` can use inside the sandbox:

```bash
export GH_TOKEN=github_pat_...
pnpm sandcastle --issue 123 --base-branch v3
```

First run also needs the sandbox image to exist:

```bash
docker build -t klicker-sandcastle:local .sandcastle
```

## Flags

| Flag                     | Effect                                                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--task <text>` / `-t`   | Inline task; substituted into `{{TASK}}` of `prompt.md`. Defaults to `SANDCASTLE_TASK` env or smoke test text.                                                 |
| `--issue <number>`       | Load GitHub issue context via `gh issue view` and use `.sandcastle/issue-prompt.md`. Defaults to branch `sandcastle/issue-<number>`.                           |
| `--prompt <file>` / `-p` | Use a different prompt file (defaults to `.sandcastle/prompt.md`, or `.sandcastle/issue-prompt.md` with `--issue`).                                            |
| `--model <id>` / `-m`    | OpenRouter model id (default `openrouter/anthropic/claude-opus-4`, overridable via `SANDCASTLE_MODEL`). See [OpenRouter models](https://openrouter.ai/models). |
| `--branch <name>`        | Commit on a named branch (`branchStrategy: { type: 'branch', branch: '...' }`).                                                                                |
| `--base-branch <ref>`    | Base a named branch on a specific ref when Sandcastle creates it. Useful with `--issue 123 --base-branch v3`.                                                  |
| `--head`                 | Write directly to HEAD (faster, less safe).                                                                                                                    |
| `--max-iterations <n>`   | Allow repeated agent iterations before stopping. Defaults to Sandcastle's default.                                                                             |
| `--with-services`        | Attach the sandbox to the local docker-compose network and forward DB / Redis / Hatchet / OpenAI env vars. Defaults to `klicker-uzh_klicker`.                  |

Default branch strategy for `--task` is `merge-to-head`: agent commits land on a temp branch and merge back into HEAD only on success. Default branch strategy for `--issue` is a named branch (`sandcastle/issue-<number>`) so issue work stays reviewable and separable.

opencode model strings follow the format `<providerId>/<modelId>`. For OpenRouter Anthropic models that's `openrouter/anthropic/claude-opus-4`, `openrouter/anthropic/claude-sonnet-4-5`, etc. Any provider available on OpenRouter (Google, OpenAI, Meta, etc.) can be selected the same way: `openrouter/google/gemini-2.5-pro`, `openrouter/openai/gpt-4.1`, ...

## Services mode

For tasks that need a live database, Redis, or Hatchet, the local compose stack must already be up so the network exists:

```bash
pnpm dev    # or: docker compose up -d postgres redis_exec redis_cache hatchet
pnpm sandcastle:exec --with-services --task "Connect to DATABASE_URL and print the first 5 table names. Do not modify any files."
```

`pnpm sandcastle:exec` wraps `pnpm sandcastle` with `./util/_run_with_infisical.sh --env dev`, so the runner sees real Infisical-injected secrets to forward into the sandbox.

If your checkout uses a different Docker Compose project name, override the network:

```bash
SANDCASTLE_DOCKER_NETWORK=sandcastle_klicker pnpm sandcastle:exec --with-services --task "List reachable services."
```

## Secrets

- Most agent tasks need only `OPENROUTER_API_KEY`. Set it in your shell or in `.sandcastle/.env` (gitignored).
- `--issue` also needs `GH_TOKEN` (or `GITHUB_TOKEN`) in your shell or `.sandcastle/.env` so the GitHub CLI inside the sandbox can read issue details. Prefer a least-privilege token.
- Never commit `.sandcastle/.env` or `.sandcastle/.env.local`.
- `--with-services` mode forwards an explicit allowlist of klicker env vars; nothing else from the host environment leaks into the sandbox.

## GitHub issues

Issue mode is deliberately single-issue and branch-based. Run `pnpm sandcastle --issue 123 --base-branch v3`, inspect the resulting `sandcastle/issue-123` branch, then push/open a draft PR from the host if the result is useful. The prompt tells the agent not to close issues automatically; issue closure should happen after human review or by a host-side runner.

## Caching

The runner bind-mounts the host pnpm store (`$PNPM_STORE_PATH` or `~/.local/share/pnpm`) into the sandbox, so `pnpm install --frozen-lockfile` is fast on subsequent runs (~30-60 s vs ~3-6 min cold).

## CI

Intentionally not wired up yet. The existing `.github/workflows/claude.yml` already handles PR-driven `@claude` requests with Claude Code; a future workflow can call `pnpm sandcastle` (opencode + OpenRouter) for scheduled or batch automation that should run in a sandbox.
