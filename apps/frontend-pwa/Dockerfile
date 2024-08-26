FROM docker.io/library/node:20.17.0-alpine AS base


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@9.8.0 turbo@2.0.14

COPY . .

RUN turbo prune --scope=@klicker-uzh/frontend-pwa --docker


FROM base AS installer
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@9.8.0 turbo@2.0.14

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

# RUN pnpm i --frozen-lockfile
RUN pnpm i

ARG NODE_ENV="production"
ARG COOKIE_DOMAIN
ARG API_DOMAIN
ARG NEXT_PUBLIC_AVATAR_BASE_PATH
ARG NEXT_PUBLIC_ADD_RESPONSE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_URL_SSR
ARG NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
ARG NEXT_PUBLIC_PWA_URL
ARG NEXT_PUBLIC_MANAGE_URL
ARG NEXT_PUBLIC_CONTROL_URL
ARG NEXT_PUBLIC_MATOMO_URL
ARG NEXT_PUBLIC_MATOMO_ID
ARG BLOB_STORAGE_ACCOUNT_URL
ARG NEXT_PUBLIC_WITH_MAGIC_LINK

ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/frontend-pwa


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/frontend-pwa/next.config.js .
COPY --from=installer /app/apps/frontend-pwa/package.json .

COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend-pwa/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-pwa/.next/static ./apps/frontend-pwa/.next/static
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-pwa/public ./apps/frontend-pwa/public

ARG NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED 1

EXPOSE 3000

CMD node apps/frontend-pwa/server.js
