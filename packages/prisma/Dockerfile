# Dedicated migration image: runs `prisma migrate deploy` against the target DB.
# Built and pushed in lockstep with the backend-docker image (same release tag) and
# executed as an ArgoCD PreSync hook Job before each rollout.
#
# Kept intentionally minimal and decoupled from the monorepo turbo build: a local
# `prisma` install (with lifecycle scripts enabled) guarantees the schema-engine
# binary is present — unlike the backend runtime image, which installs with
# `--prod --ignore-scripts` and therefore carries neither the CLI nor the engine.
# The install must stay local (not `-g`): prisma.config.ts imports `prisma/config`,
# which only resolves from /app/node_modules.
#
# Prisma version MUST stay in sync with `packages/prisma` devDependency `prisma`.
# Base image pinned to match apps/backend-docker/Dockerfile for reproducibility.
FROM node:24.16.0-alpine

# Prisma engine binaries on Alpine (musl) need libc6-compat + openssl.
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Install runs @prisma/engines postinstall → downloads the schema (migration) engine.
RUN npm install prisma@7.8.0

# Prisma 7 keeps the datasource URL out of the schema: prisma.config.ts supplies it
# from DATABASE_URL and points at the schema/migrations paths (relative to /app).
COPY packages/prisma/prisma.config.ts ./prisma.config.ts

# Only the schema folder is needed; it contains datasource + models + the migrations/
# directory that `migrate deploy` applies. No generated client, no app code required.
COPY packages/prisma/src/prisma/schema ./src/prisma/schema

RUN addgroup -S nodejs -g 1001 && adduser -S -G nodejs -u 1001 prisma
USER prisma

# The CLI auto-discovers ./prisma.config.ts, which resolves the schema and reads
# migrations from <schema-dir>/migrations.
# Requires only DATABASE_URL at runtime (no shadow DB, no generators).
CMD ["npx", "prisma", "migrate", "deploy"]
