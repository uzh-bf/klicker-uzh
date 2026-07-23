FROM ghcr.io/astral-sh/uv:0.11.6 AS uv

FROM docker.io/library/python:3.12.11-slim-bookworm AS builder

COPY --from=uv /uv /bin/uv

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app/apps/analytics

COPY apps/analytics/pyproject.toml apps/analytics/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project


FROM docker.io/library/python:3.12.11-slim-bookworm AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libgomp1 && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 10001 analytics && \
    useradd --system --uid 10001 --gid analytics --home-dir /app/apps/analytics analytics

WORKDIR /app/apps/analytics

COPY --from=builder --chown=10001:10001 /app/apps/analytics/.venv .venv
COPY --chown=10001:10001 apps/analytics/src src
COPY --chown=10001:10001 apps/analytics/prisma prisma

ENV HATCHET_CLIENT_WORKER_HEALTHCHECK_ENABLED=true \
    HATCHET_CLIENT_WORKER_HEALTHCHECK_PORT=8001 \
    PATH="/app/apps/analytics/.venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1

EXPOSE 8001

USER analytics

CMD ["python", "-m", "src.hatchet_worker"]
