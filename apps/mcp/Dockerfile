FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

COPY apps/mcp/pyproject.toml apps/mcp/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

COPY apps/mcp/src ./src
COPY apps/mcp/README.md ./README.md

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

FROM python:3.12-slim

RUN adduser --disabled-password --gecos "" --uid 1001 app

WORKDIR /app
COPY --from=builder --chown=app:app /app /app

USER app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    MCP_HOST=0.0.0.0 \
    MCP_PORT=7079

EXPOSE 7079

CMD ["python", "-m", "klicker_mcp.main"]
