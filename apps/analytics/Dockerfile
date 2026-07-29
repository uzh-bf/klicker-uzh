FROM ghcr.io/astral-sh/uv:0.11.12 AS uv

FROM python:3.12

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY --from=uv /uv /uvx /bin/
COPY apps/analytics/pyproject.toml apps/analytics/uv.lock ./

RUN uv sync --frozen --no-dev --no-install-project

COPY apps/analytics/ .
COPY packages/prisma/src/prisma/schema/*.prisma prisma/schema/
RUN rm prisma/schema/js.prisma prisma/schema/datasource.prisma
COPY apps/analytics/prisma/schema/datasource.prisma prisma/schema/datasource.prisma

RUN uv run --no-sync prisma generate
