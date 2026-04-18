# @klicker-uzh/mcp

FastMCP v3 server that exposes KlickerUZH features as MCP tools for LLM clients (Claude Desktop, Cursor, the `apps/chat` tutor chatbot).

Thin adapter over the KlickerUZH GraphQL API. No learning logic lives here — see `PLAN.md` for the principle.

## Requirements

- Python 3.12 (pinned via `.python-version`)
- [uv](https://docs.astral.sh/uv/) package manager
- A running KlickerUZH backend at `APP_ORIGIN_API`

## Local dev

```bash
# from apps/mcp
uv sync

# run tests + type-check + lint
uv run pytest
uv run pyright
uv run ruff check

# boot the server (defaults: 0.0.0.0:7079/mcp)
uv run python -m klicker_mcp.main
```

Or from the repo root via Turborepo:

```bash
pnpm --filter @klicker-uzh/mcp test
pnpm --filter @klicker-uzh/mcp check
pnpm --filter @klicker-uzh/mcp dev
```

## Env vars

| Var | Default | Purpose |
| --- | --- | --- |
| `MCP_HOST` | `0.0.0.0` | Bind host |
| `MCP_PORT` | `7079` | Bind port |
| `MCP_PATH` | `/mcp` | HTTP mount path |
| `LOG_LEVEL` | `INFO` | Log level |
| `APP_ORIGIN_API` | `http://localhost:3000` | KlickerUZH GraphQL endpoint origin |
| `APP_SECRET` | — | HS256 secret used for JWT verification (must match backend) |
| `MCP_ORIGIN` | _(unset)_ | Public URL of this server; required for OAuth mode |
| `MCP_UPSTREAM_CLIENT_ID` | _(unset)_ | Pre-registered client id for the `apps/auth` bridge |
| `MCP_UPSTREAM_CLIENT_SECRET` | _(unset)_ | Secret paired with the client id |
| `MCP_UPSTREAM_AUTHORIZE_URL` | _(unset)_ | Typically `${APP_ORIGIN_AUTH}/api/mcp/authorize` |
| `MCP_UPSTREAM_TOKEN_URL` | _(unset)_ | Typically `${APP_ORIGIN_AUTH}/api/mcp/token` |
| `MCP_UPSTREAM_ISSUER` | _(unset)_ | Optional JWT `iss` claim to require |
| `MCP_STORAGE_URL` | _(unset)_ | Redis URL for OAuth code/refresh-token storage (empty = in-memory) |

When all `MCP_UPSTREAM_*` vars are unset, the server starts in pass-through
mode: MCP clients send a raw `Authorization: Bearer <jwt>` header themselves,
which the server forwards verbatim to the GraphQL backend. That is the
default for local dev and CI.

## Health check

`GET /health` returns `{"status": "ok", "version": "<pkg-version>"}`. The
Helm chart's liveness + readiness probes target this path.

## Local access via Traefik

With the local reverse proxy + mkcert certs in place, the server is reachable
at `https://mcp.klicker.com` — the wildcard `*.klicker.com` cert covers this
host already. Add `127.0.0.1 mcp.klicker.com` to `/etc/hosts` if you haven't
already configured the full `*.klicker.com` set.

## Status

See `PLAN.md` for the iteration tracker.
