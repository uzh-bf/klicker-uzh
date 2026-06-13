# Prototype execution runbook

Operational prerequisites to **build and validate** the Mastra chat prototype
(see `project/plans_wip/PLAN-chat-mastra-prototype.md` for the design). This
runbook exists because the build cannot be executed from a sandboxed agent
session — it needs a developer-rooted environment with secrets, a database, and
the local stack running.

## Why a human runs this (not the agent)

| Blocker | Detail |
| --- | --- |
| Sandbox scope | An agent session is sandboxed to one worktree; install/build/test commands in this prototype worktree need per-command sandbox-disable approval — unworkable for an unattended loop. |
| Secrets | Injected via Infisical only (no `.env` files). Infisical interactive login does not work inside the agent sandbox; a developer must run the injected commands locally. |
| LLM credential | Without a working model credential the agent cannot make a single call — no run, no e2e. |
| Database | The prototype needs a **copy** of the seeded Klicker DB (never production) to exercise branch-aware memory against real thread trees. |
| Dev stack | e2e needs the local stack (Postgres, Redis, Traefik, Hatchet) running, which the agent must not start unprompted. |

## Required secrets (via Infisical)

| Secret | Purpose | Slice |
| --- | --- | --- |
| Model API key + base URL | The OpenAI-compatible / Azure endpoint the agent calls | S0 (floor — nothing runs without it) |
| A deliberately wrong primary model id | Forces a provider error to test fallback | S0 |
| `doc_query` MCP URL + key | AI-infra retrieval server attached as a toolset | S1 |
| Copied `DATABASE_URL` | Points at the seeded-DB copy + prototype schema | S0 |
| Langfuse keys | Confirm tracing continuity alongside our token accounting | S0 / observability |
| `APP_SECRET` | Participant-token verification for the auth stub | S0 |

Never commit any of these. Never create a `.env` file — use the repo's
Infisical injection wrapper.

## Steps

1. **Copy the seeded DB.** Stand up local dependencies and seed, then snapshot
   that database into a separate prototype database (so the prototype's extra
   tables and any destructive edit experiments never touch the working seed).
   Use the repo's dependency + `prisma:setup` flow, then `pg_dump` / `createdb`
   the copy.
2. **Enable pgvector** on the prototype database (reuse the `pgvector`
   sibling worktree's setup where applicable). Keep vector columns in an
   isolated Postgres schema so they stay out of the generated Prisma client.
3. **Install the prototype** (`prototype/mastra-chat/`) as a standalone project
   with pinned Mastra versions — kept out of the main pnpm workspace to avoid
   monorepo lockfile churn during the spike.
4. **Run** the Hono service, the minimal assistant-ui harness, and Mastra
   Studio against the same engine, all pointed at the prototype DB and the live
   `doc_query` server, with secrets injected via Infisical.
5. **Validate e2e** per slice using the harness + `agent-browser` (mandatory
   per the repo's frontend-verification rule): drive a seeded thread, confirm
   streaming/reasoning/finish-metadata, retrieval, guardrails firing, skill
   loading, profile persistence, branch-aware recall, sub-agent progress, and
   the eval signal. Record the per-feature verdict.

## Measurement queries (runnable now, independent of the build)

`queries/s05-branch-usage.sql` and `queries/s05-thread-length.sql` answer the
two decision-gating questions (branch usage %, thread-length distribution)
against the copied DB. The thread-length result decides whether the
compression slice (S5) is worth building at all. These need only a DB
connection — no Mastra, no secrets beyond `DATABASE_URL`.
