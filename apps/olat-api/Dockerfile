FROM docker.io/library/node:26.8-alpine AS base

# See apps/backend-docker/Dockerfile: patched Alpine packages and npm for every
# stage, including any scanned runtime image.
RUN apk upgrade --no-cache \
 && npm i -g --ignore-scripts npm@11.19.1


FROM base AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.10.11

COPY . .

RUN turbo prune --scope=@klicker-uzh/olat-api --docker


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.10.11

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --ignore-scripts

ARG NODE_ENV="production"

COPY --from=deps /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/olat-api


FROM base AS runtime
WORKDIR /app

ARG NODE_ENV="production"

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.10.11

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

# See apps/backend-docker/Dockerfile: the install, the toolchain teardown and
# the cache removal share one RUN so no build state lands in a committed layer.
RUN pnpm i --prod --ignore-scripts \
 && npm rm -g --ignore-scripts pnpm turbo \
 && rm -rf /root/.cache/pnpm /root/.local/share/pnpm /root/.npm

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/packages/prisma/dist/ /app/packages/prisma/dist/
COPY --from=builder /app/packages/types/dist/ /app/packages/types/dist/
COPY --from=builder /app/apps/olat-api/dist/ /app/apps/olat-api/dist/
COPY --from=builder /app/apps/olat-api/static /app/apps/olat-api/static/

USER nodejs

EXPOSE 3000

CMD node /app/apps/olat-api/dist/index.js
