FROM docker.io/library/node:24.21.0-alpine AS base

# See apps/backend-docker/Dockerfile: patched Alpine packages and npm for every
# stage, including any scanned runtime image.
RUN apk upgrade --no-cache \
 && npm i -g --ignore-scripts npm@11.19.1


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

# pnpm 12 needs native setup for direct child-process execution on Alpine.
RUN npm i -g --ignore-scripts pnpm@12.11.2 turbo@2.10.11 \
 && node "$(npm root -g)/pnpm/install.js"

COPY . .

RUN turbo prune --scope=@klicker-uzh/frontend-manage --docker


FROM base AS installer
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@12.11.2 turbo@2.10.11 \
 && node "$(npm root -g)/pnpm/install.js"

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

RUN pnpm i --ignore-scripts

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
ARG NEXT_PUBLIC_CHAT_URL
ARG NEXT_PUBLIC_MATOMO_URL
ARG NEXT_PUBLIC_MATOMO_ID
ARG BLOB_STORAGE_ACCOUNT_URL
ARG NEXT_PUBLIC_ENV=production
ARG NEXT_PUBLIC_GROWTHBOOK_API_HOST
ARG NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY
ENV NEXT_PUBLIC_ENV=${NEXT_PUBLIC_ENV}
ENV NEXT_PUBLIC_GROWTHBOOK_API_HOST=${NEXT_PUBLIC_GROWTHBOOK_API_HOST}
ENV NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY=${NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY}
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/out/full/ .
COPY --from=builder /app/apps/frontend-manage/.env.production /app/apps/frontend-manage/.env.production
# Next.js inlines the assistant target during this build. Both deployment
# workflows replace .env.production first, so fail instead of silently hiding
# the launcher when either environment loses the mapping.
RUN grep -qx 'NEXT_PUBLIC_CHAT_URL=$APP_ORIGIN_CHAT' apps/frontend-manage/.env.production
COPY --from=builder /app/util/deployment-build-env.mjs /app/util/deployment-build-env.mjs
ARG KLICKER_PREVIEW_BUILD_ENV_JSON
ARG KLICKER_DEPLOYMENT_BUILD_ENV_JSON
RUN node util/deployment-build-env.mjs --app frontend-manage -- pnpm run build --filter=@klicker-uzh/frontend-manage

# Next traces its webpack serializer into the standalone tree although the
# generated server consumes the already serialized build configuration.
RUN node -e 'const fs = require("fs"); const root = "apps/frontend-manage/.next/standalone/node_modules/.pnpm"; for (const name of fs.readdirSync(root)) if (name.startsWith("serialize-javascript@")) fs.rmSync(root + "/" + name, { recursive: true });'


FROM base AS runner
WORKDIR /app

# Standalone servers run Node directly; package managers are build tools.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/frontend-manage/next.config.mjs .
COPY --from=installer /app/apps/frontend-manage/package.json .

COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend-manage/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-manage/.next/static ./apps/frontend-manage/.next/static
COPY --from=installer --chown=nextjs:nodejs --chmod=550 /app/apps/frontend-manage/public ./apps/frontend-manage/public

ARG NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED 1

EXPOSE 3000

CMD node apps/frontend-manage/server.js
