FROM docker.io/library/node:24.21.0-alpine AS base

# The pinned Node tag ships Alpine packages and an npm whose vendored dependency
# tree carry fixable HIGH/CRITICAL advisories (openssl 3.5.7, tar, undici,
# brace-expansion, ip-address). "apk add" never upgrades a package that the base
# image already installed, so the OS packages and npm are upgraded explicitly.
# Every stage inherits this layer, including the scanned runtime image.
RUN apk upgrade --no-cache \
 && npm i -g --ignore-scripts npm@11.19.1

FROM base AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.25.0 turbo@2.10.11

COPY . .

RUN turbo prune --scope=@klicker-uzh/backend-docker --docker


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.25.0 turbo@2.10.11

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --ignore-scripts

ARG NODE_ENV="production"

COPY --from=deps /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/backend-docker


FROM base AS runtime
WORKDIR /app

ARG NODE_ENV="production"

RUN npm i -g --ignore-scripts pnpm@11.25.0 turbo@2.10.11

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --prod --ignore-scripts

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/packages/prisma/dist/ /app/packages/prisma/dist/
COPY --from=builder /app/packages/grading/dist/ /app/packages/grading/dist/
COPY --from=builder /app/packages/graphql/dist/ /app/packages/graphql/dist/
COPY --from=builder /app/packages/types/dist/ /app/packages/types/dist/
COPY --from=builder /app/packages/util/dist/ /app/packages/util/dist/
COPY --from=builder /app/packages/hatchet/dist/ /app/packages/hatchet/dist/
COPY --from=builder /app/apps/backend-docker/dist/ /app/apps/backend-docker/dist/

USER nodejs

EXPOSE 3000

CMD node /app/apps/backend-docker/dist/index.js
