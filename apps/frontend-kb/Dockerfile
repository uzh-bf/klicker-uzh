FROM docker.io/library/node:20.19.4-alpine AS base


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@10.15.0 turbo@2.5.6

COPY . .

RUN turbo prune --scope=@klicker-uzh/frontend-kb --docker


FROM base AS installer
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@10.15.0 turbo@2.5.6

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

RUN pnpm i --ignore-scripts

ARG NODE_ENV="production"
ARG COOKIE_DOMAIN
ARG API_DOMAIN
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_URL_SSR
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_PWA_URL
ARG NEXT_PUBLIC_MANAGE_URL
ARG NEXT_PUBLIC_CONTROL_URL
ARG NEXT_PUBLIC_CHAT_URL
ARG NEXT_PUBLIC_KB_URL
ARG NEXT_PUBLIC_MATOMO_URL
ARG NEXT_PUBLIC_MATOMO_ID
ARG BLOB_STORAGE_ACCOUNT_URL
ARG NEXT_PUBLIC_ENV=production
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/frontend-kb


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/frontend-kb/next.config.mjs .
COPY --from=installer /app/apps/frontend-kb/package.json .

COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend-kb/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-kb/.next/static ./apps/frontend-kb/.next/static

ARG NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED 1

EXPOSE 3000

CMD node apps/frontend-kb/server.js
