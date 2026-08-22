FROM docker.io/library/node:24.16.0-alpine AS base


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY . .

RUN turbo prune --scope=@klicker-uzh/frontend-pwa --docker


FROM base AS installer
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

RUN pnpm i --ignore-scripts

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
ARG NEXT_PUBLIC_CHAT_URL
ARG NEXT_PUBLIC_MATOMO_URL
ARG NEXT_PUBLIC_MATOMO_ID
ARG BLOB_STORAGE_ACCOUNT_URL
ARG NEXT_PUBLIC_WITH_MAGIC_LINK
ARG NEXT_PUBLIC_ENV=production
ARG NEXT_PUBLIC_GROWTHBOOK_API_HOST
ARG NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}
ENV NEXT_PUBLIC_GROWTHBOOK_API_HOST=${NEXT_PUBLIC_GROWTHBOOK_API_HOST}
ENV NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY=${NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY}
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/frontend-pwa


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/frontend-pwa/next.config.mjs .
COPY --from=installer /app/apps/frontend-pwa/package.json .

COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend-pwa/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-pwa/.next/static ./apps/frontend-pwa/.next/static
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-pwa/public ./apps/frontend-pwa/public

ARG NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED 1

EXPOSE 3000

CMD node apps/frontend-pwa/server.js
