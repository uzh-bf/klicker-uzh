FROM docker.io/library/node:20-alpine AS base


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@8.14.1 turbo@1.11.3

COPY . .

RUN turbo prune --scope=@klicker-uzh/frontend-manage --docker


FROM base AS installer
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@8.14.1 turbo@1.11.3

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

RUN pnpm i --frozen-lockfile

ARG NODE_ENV="production"
ARG COOKIE_DOMAIN
ARG API_DOMAIN
ARG NEXT_PUBLIC_AVATAR_BASE_PATH
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_URL_SSR
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_PWA_URL
ARG NEXT_PUBLIC_MANAGE_URL
ARG NEXT_PUBLIC_CONTROL_URL
ARG NEXT_PUBLIC_MATOMO_URL
ARG NEXT_PUBLIC_MATOMO_ID
ARG BLOB_STORAGE_ACCOUNT_URL

ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/frontend-manage


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/frontend-manage/next.config.js .
COPY --from=installer /app/apps/frontend-manage/package.json .

COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend-manage/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-manage/.next/static ./apps/frontend-manage/.next/static
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-manage/public ./apps/frontend-manage/public

ARG NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED 1

EXPOSE 3000

CMD node apps/frontend-manage/server.js
