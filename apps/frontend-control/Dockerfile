FROM docker.io/library/node:18-alpine AS base


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@8.6.12 turbo@1.10.12

COPY . .

RUN turbo prune --scope=@klicker-uzh/frontend-control --docker


FROM base AS installer
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@8.6.12 turbo@1.10.12

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

RUN pnpm i --frozen-lockfile

ARG NODE_ENV="production"
ARG COOKIE_DOMAIN
ARG API_DOMAIN
ARG NEXT_PUBLIC_AVATAR_BASE_PATH
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_API_URL_SSR
ARG NEXT_PUBLIC_PWA_URL
ARG NEXT_PUBLIC_MANAGE_URL
ARG NEXT_PUBLIC_CONTROL_URL
ARG NEXT_PUBLIC_MATOMO_URL
ARG NEXT_PUBLIC_MATOMO_ID
ARG BLOB_STORAGE_ACCOUNT_URL

ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/frontend-control


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/frontend-control/next.config.js .
COPY --from=installer /app/apps/frontend-control/package.json .

COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend-control/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-control/.next/static ./apps/frontend-control/.next/static
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-control/public ./apps/frontend-control/public

ARG NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED 1

EXPOSE 3000

CMD node apps/frontend-control/server.js
