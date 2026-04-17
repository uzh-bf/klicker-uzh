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

## Status

See `PLAN.md` for the iteration tracker. The server is under active POC development.
