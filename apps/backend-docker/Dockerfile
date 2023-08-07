FROM docker.io/library/node:18-alpine AS base

ARG NODE_ENV production
ENV NODE_ENV $NODE_ENV

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

RUN pnpm i --frozen-lockfile

ARG NODE_ENV="production"

COPY --from=deps /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/backend-docker


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps/backend-docker/dist ./dist

ARG NODE_ENV="production"

EXPOSE 3000

CMD node /app/dist/index.js
