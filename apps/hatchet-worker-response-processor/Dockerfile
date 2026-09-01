FROM docker.io/library/node:24.16.0-alpine AS base


FROM base AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY . .

RUN turbo prune --scope=@klicker-uzh/hatchet-worker-response-processor --docker


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --ignore-scripts

ARG NODE_ENV="production"

COPY --from=deps /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/hatchet-worker-response-processor


FROM base AS runtime
WORKDIR /app

ARG NODE_ENV="production"
ENV NODE_ENV=${NODE_ENV}

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --prod --ignore-scripts

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder --chown=nodejs:nodejs /app/packages/hatchet/dist/ /app/packages/hatchet/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/dist/ /app/packages/types/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/grading/dist/ /app/packages/grading/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/util/dist/ /app/packages/util/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/prisma/dist/ /app/packages/prisma/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/logging/dist/ /app/packages/logging/dist/
COPY --from=builder --chown=nodejs:nodejs /app/apps/hatchet-worker-response-processor/dist/ /app/apps/hatchet-worker-response-processor/dist/

USER nodejs

EXPOSE 3000

CMD node /app/apps/hatchet-worker-response-processor/dist/index.js
