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
FROM node:24.21.0-alpine

# See apps/backend-docker/Dockerfile: the pinned Node tag ships Alpine packages
# and an npm whose vendored dependency tree carry fixable HIGH/CRITICAL
# advisories, and "apk add" cannot upgrade a package the base image already
# installed.
RUN apk upgrade --no-cache \
 && npm i -g --ignore-scripts npm@11.19.1

# Prisma engine binaries on Alpine (musl) need libc6-compat + openssl.
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Install runs @prisma/engines postinstall → downloads the schema (migration) engine.
#
# Prisma 7.8.0 depends on mysql2 3.15.3 and @prisma/config on deepmerge-ts 7.1.5,
# both below their published advisory fixes, and no Prisma release carries the
# fixed versions yet. npm overrides pin them for this standalone install, so the
# overrides file is written before the install runs.
RUN printf '%s\n' \
      '{"private":true,"overrides":{"mysql2":"3.22.0","deepmerge-ts":"8.0.0"}}' \
      > package.json

# The pin stays on its own `RUN npm install prisma@` line because
# util/check-prisma-sync.sh reads it from there and fails when it drifts from the
# packages/prisma devDependency.
RUN npm install prisma@7.8.0 --no-package-lock --no-audit --no-fund

# Prisma 7 keeps the datasource URL out of the schema: prisma.config.ts supplies it
# from DATABASE_URL and points at the schema/migrations paths (relative to /app).
COPY packages/prisma/prisma.migrator.config.ts ./prisma.config.ts

# Only the schema folder is needed; it contains datasource + models + the migrations/
# directory that `migrate deploy` applies. No generated client, no app code required.
COPY packages/prisma/src/prisma/schema ./src/prisma/schema
COPY external/catalyst/packages/adaptive-persistence/src/prisma/schema/*.prisma ./src/prisma/schema/
COPY external/catalyst/packages/adaptive-persistence/src/prisma/schema/migrations ./src/prisma/schema/migrations

RUN addgroup -S nodejs -g 1001 && adduser -S -G nodejs -u 1001 prisma
USER prisma

# Invoke the local binary directly (npx would re-parse dashed args and add npm
# startup). The CLI auto-discovers ./prisma.config.ts, which resolves the schema
# and reads migrations from <schema-dir>/migrations.
# Requires only DATABASE_URL at runtime (no shadow DB, no generators).
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]
