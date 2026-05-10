FROM docker.io/library/node:20.19.4-alpine AS base

ARG NODE_ENV production
ENV NODE_ENV $NODE_ENV

FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@10.15.0 turbo@2.5.6

COPY . .

RUN turbo prune --scope=@klicker-uzh/chat --docker


FROM base AS installer
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@10.15.0 turbo@2.5.6

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

RUN pnpm i --ignore-scripts

ARG NODE_ENV="production"

COPY --from=builder /app/out/full/ .

ARG BLOB_STORAGE_ACCOUNT_URL
# DEBUG: capture full output of failing build so CI logs reveal which task failed
RUN set -e; \
    echo "=== node/pnpm/turbo versions ==="; \
    node --version; pnpm --version; turbo --version; \
    echo "=== free memory & disk ==="; \
    free -m 2>/dev/null || true; df -h /app 2>/dev/null || true; \
    echo "=== running pnpm run build --filter=@klicker-uzh/chat ==="; \
    pnpm run build --filter=@klicker-uzh/chat 2>&1 | tee /tmp/build.log; \
    BUILD_STATUS=$?; \
    echo "=== build exit status: $BUILD_STATUS ==="; \
    if [ "$BUILD_STATUS" -ne 0 ]; then \
      echo "=== last 200 lines of build log ==="; \
      tail -200 /tmp/build.log; \
      echo "=== individual task logs (turbo .turbo/turbo-*.log) ==="; \
      find . -name "turbo-*.log" -path "*/.turbo/*" -exec sh -c 'echo "===> $1"; cat "$1"' _ {} \; 2>/dev/null || true; \
      echo "=== state of apps/chat/.next ==="; \
      ls -la apps/chat/.next 2>&1 || echo "no .next dir"; \
      exit $BUILD_STATUS; \
    fi


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
