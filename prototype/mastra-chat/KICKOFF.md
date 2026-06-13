# Build-session kickoff

Concrete command sequence to provision the environment, then launch the build
loop in a session rooted in this worktree. Complements `SETUP.md` (the why/what)
with the how. Adjust names to your local setup; never create a `.env` file —
inject secrets via Infisical.

## A. Provision (run once, from the repo root)

1. **Start local dependencies + seed** (local mode; answer yes to `prisma:setup`):
   `./_run_app_dependencies.sh`
   This brings up Postgres, Redis, Traefik, Hatchet and seeds the working DB
   (`postgres://klicker-prod:klicker@localhost:5432/klicker-prod`).

2. **Copy the seeded DB into an isolated prototype DB** (so prototype tables and
   any destructive-edit experiments never touch the working seed):
   - `PGPASSWORD=klicker createdb -h localhost -U klicker-prod klicker-mastra-proto`
   - `PGPASSWORD=klicker pg_dump -h localhost -U klicker-prod klicker-prod | PGPASSWORD=klicker psql -h localhost -U klicker-prod klicker-mastra-proto`

3. **Enable pgvector** on the copy (reuse the `pgvector` sibling worktree's setup
   if it already scripts this):
   - `PGPASSWORD=klicker psql -h localhost -U klicker-prod klicker-mastra-proto -c 'CREATE EXTENSION IF NOT EXISTS vector;'`

4. **Confirm `doc_query` reachability** — have the AI-infra `doc_query` MCP URL +
   key ready in Infisical; a quick curl/handshake before S1 saves time.

## B. Secrets the build session needs (via Infisical injection)

Map these to your Infisical entries and inject them into the build session's
shell (e.g. with the repo's `./util/_run_with_infisical.sh` wrapper). Do not
hardcode, do not `.env`.

- Model API key + base URL (the floor — nothing runs without it)
- `doc_query` MCP URL + key
- `DATABASE_URL` pointing at `klicker-mastra-proto`
- Langfuse keys
- `APP_SECRET`

## C. Launch the build loop

Open a Claude Code session whose working directory is **this worktree**
(`.claude/worktrees/chat-mastra-prototype`), with the secrets from (B) injected,
then give it this prompt:

> Build the Mastra chat prototype in `prototype/mastra-chat/` per
> `project/plans_wip/PLAN-chat-mastra-prototype.md`, slice by slice S0→S7.
> The environment is provisioned (copied seeded DB at `klicker-mastra-proto`,
> Infisical secrets injected, `doc_query` reachable). After each slice:
> typecheck against the installed Mastra packages, then e2e-validate with the
> assistant-ui harness + `agent-browser` (before/after screenshots), and record
> an adopt / adopt-with-changes / drop verdict in the §5 feature matrix.
> Run S0.5's two SQL queries early and let the thread-length result gate S5.
> Keep the prototype standalone (own `package.json`, pinned Mastra versions),
> out of the main pnpm workspace. Self-pace with a loop; ping me when blocked.

## D. First validations to expect

- S0: behaviour parity on a seeded thread; a forced primary-model error falls
  back cleanly; the harness reads creditsUsed / modelId / chatMode /
  reasoningEffort off the stream finish.
- S0.5: branch-usage % and thread-length distribution recorded (the latter
  decides whether S5 is built).
