FROM docker.io/library/node:18-alpine AS base


FROM base AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g pnpm@8.6.12 turbo@1.10.12

COPY . .

RUN turbo prune --scope=@klicker-uzh/backend-docker --docker


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g pnpm@8.6.12 turbo@1.10.12

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --frozen-lockfile --ignore-scripts

ARG NODE_ENV="production"

COPY --from=deps /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/backend-docker


FROM base AS runtime
WORKDIR /app

ARG NODE_ENV="production"

RUN npm i -g pnpm@8.6.12 turbo@1.10.12

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --frozen-lockfile --prod --ignore-scripts

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

RUN mkdir -p /app/apps/backend-docker/dist

COPY --from=builder /app/apps/backend-docker/dist/ /app/apps/backend-docker/dist/

USER nodejs

EXPOSE 3000

CMD node /app/apps/backend-docker/dist/index.js
