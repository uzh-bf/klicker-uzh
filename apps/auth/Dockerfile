FROM docker.io/library/node:18-alpine AS base

ARG NODE_ENV production
ENV NODE_ENV $NODE_ENV

FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g pnpm turbo

COPY . .

RUN turbo prune --scope=@klicker-uzh/auth --docker


FROM base AS installer
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g pnpm turbo

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

RUN pnpm i --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/auth


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/auth/next.config.js .
COPY --from=installer /app/apps/auth/package.json .

COPY --from=installer --chown=nextjs:nodejs /app/apps/auth/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/auth/.next/static ./apps/auth/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/auth/public ./apps/auth/public

CMD node apps/auth/server.js
