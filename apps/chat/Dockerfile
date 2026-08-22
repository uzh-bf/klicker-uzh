FROM docker.io/library/node:24.16.0-alpine AS base

ARG NODE_ENV production
ENV NODE_ENV $NODE_ENV

FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY . .

RUN turbo prune --scope=@klicker-uzh/chat --docker


FROM base AS installer
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

RUN pnpm i --ignore-scripts

ARG NODE_ENV="production"
ARG NEXT_PUBLIC_ENV=production
ARG NEXT_PUBLIC_GROWTHBOOK_API_HOST
ARG NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}
ENV NEXT_PUBLIC_GROWTHBOOK_API_HOST=${NEXT_PUBLIC_GROWTHBOOK_API_HOST}
ENV NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY=${NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY}

COPY --from=builder /app/out/full/ .

ARG BLOB_STORAGE_ACCOUNT_URL
RUN pnpm run build --filter=@klicker-uzh/chat


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/chat/next.config.ts .
COPY --from=installer /app/apps/chat/package.json .

COPY --from=installer --chown=nextjs:nodejs /app/apps/chat/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/chat/.next/static ./apps/chat/.next/static
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/chat/public ./apps/chat/public

ARG NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED 1

EXPOSE 3000

CMD node apps/chat/server.js
