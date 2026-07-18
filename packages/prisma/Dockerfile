# Dedicated migration image: runs `prisma migrate deploy` against the target DB.
# Built and pushed in lockstep with the backend-docker image (same release tag) and
# executed as an ArgoCD PreSync hook Job before each rollout.
#
# Kept intentionally minimal and decoupled from the monorepo turbo build: a global
# `prisma` install (with lifecycle scripts enabled) guarantees the schema-engine
# binary is present — unlike the backend runtime image, which installs with
# `--prod --ignore-scripts` and therefore carries neither the CLI nor the engine.
#
# Prisma version MUST stay in sync with `packages/prisma` devDependency `prisma`.
# Base image pinned to match apps/backend-docker/Dockerfile for reproducibility.
FROM node:24.16.0-alpine

# Prisma engine binaries on Alpine (musl) need libc6-compat + openssl.
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Global install runs @prisma/engines postinstall → downloads the schema (migration) engine.
RUN npm install -g prisma@6.16.1

# Only the schema folder is needed; it contains datasource + models + the migrations/
# directory that `migrate deploy` applies. No generated client, no app code required.
COPY packages/prisma/src/prisma/schema ./src/prisma/schema

RUN addgroup -S nodejs -g 1001 && adduser -S prisma -u 1001
USER prisma

# `migrate deploy` reads migrations from <schema-dir>/migrations by default.
# Requires only DATABASE_URL at runtime (no shadow DB, no generators).
CMD ["prisma", "migrate", "deploy", "--schema", "src/prisma/schema"]
