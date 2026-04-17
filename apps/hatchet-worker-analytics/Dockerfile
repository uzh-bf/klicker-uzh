# Dedicated image for the analytics Hatchet worker. Unlike the general worker
# (alpine, Node-only) this one needs Python 3.12 + uv + the apps/analytics
# source because the recompute-learning-analytics handler shells out to the
# Python pipeline via child_process.spawn.
#
# Base stays on node:20-slim (Debian) rather than alpine because sentence-
# transformers / torch / hdbscan wheels have first-class support there.

FROM docker.io/library/node:20.19.4-slim AS base


FROM base AS deps
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN npm i -g --ignore-scripts pnpm@10.15.0 turbo@2.5.6

COPY . .

RUN turbo prune --scope=@klicker-uzh/hatchet-worker-analytics --docker


FROM base AS builder
WORKDIR /app

RUN npm i -g --ignore-scripts pnpm@10.15.0 turbo@2.5.6

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --ignore-scripts

ARG NODE_ENV="production"

COPY --from=deps /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/hatchet-worker-analytics


# Python + uv stage: prepare the analytics app with its virtual environment baked in.
# Everything under /app/apps/analytics will be copied into the final runtime image.
FROM base AS python-deps
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        python3.12 \
        python3.12-venv \
        python3-pip \
        build-essential && \
    rm -rf /var/lib/apt/lists/*

# uv from the official standalone installer, pinned for reproducible builds.
ARG UV_VERSION=0.11.6
ADD https://astral.sh/uv/${UV_VERSION}/install.sh /tmp/uv-install.sh
RUN sh /tmp/uv-install.sh && rm /tmp/uv-install.sh
ENV PATH="/root/.local/bin:${PATH}"

# Copy only what's needed for the Python install. We grab the prisma schema
# mirror straight from the source tree (the analytics app's .gitignore skips
# the mirror, so sync-schema.sh must have been run on the builder machine OR
# we must copy the main schema now and run sync here).
COPY apps/analytics/pyproject.toml apps/analytics/uv.lock /app/apps/analytics/
COPY apps/analytics/src /app/apps/analytics/src/
COPY apps/analytics/prisma /app/apps/analytics/prisma/
COPY packages/prisma/src/prisma/schema /app/packages/prisma/src/prisma/schema/
COPY util/sync-schema.sh /app/util/sync-schema.sh

WORKDIR /app
RUN bash util/sync-schema.sh

WORKDIR /app/apps/analytics
RUN uv sync --frozen --no-dev

# Prisma client generation doesn't need a real DB — pass a placeholder URL.
RUN DATABASE_URL="postgres://placeholder:placeholder@localhost:5432/placeholder" \
    uv run prisma generate --schema=prisma/schema


FROM base AS runtime
WORKDIR /app

ARG NODE_ENV="production"

# The runtime needs Python + uv for the handler's subprocess path.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        python3.12 \
        python3.12-venv && \
    rm -rf /var/lib/apt/lists/*

RUN npm i -g --ignore-scripts pnpm@10.15.0 turbo@2.5.6

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --prod --ignore-scripts

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# uv binary + prebuilt analytics venv from the python-deps stage.
COPY --from=python-deps /root/.local /home/nodejs/.local
COPY --from=python-deps /app/apps/analytics /app/apps/analytics

# Compiled worker + the monorepo packages it imports at runtime.
COPY --from=builder /app/packages/hatchet/dist/ /app/packages/hatchet/dist/
COPY --from=builder /app/packages/graphql/dist/ /app/packages/graphql/dist/
COPY --from=builder /app/packages/prisma/dist/ /app/packages/prisma/dist/
COPY --from=builder /app/packages/types/dist/ /app/packages/types/dist/
COPY --from=builder /app/packages/util/dist/ /app/packages/util/dist/
COPY --from=builder /app/packages/grading/dist/ /app/packages/grading/dist/
COPY --from=builder /app/apps/hatchet-worker-analytics/dist/ /app/apps/hatchet-worker-analytics/dist/

RUN chown -R nodejs:nodejs /app/apps/analytics /home/nodejs/.local

USER nodejs
ENV PATH="/home/nodejs/.local/bin:${PATH}"
# Default that the handler reads. Mirrors the WORKDIR of the python-deps stage.
ENV ANALYTICS_CWD=/app/apps/analytics

EXPOSE 3000

CMD ["node", "/app/apps/hatchet-worker-analytics/dist/index.js"]
