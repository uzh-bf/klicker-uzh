FROM docker.io/library/node:24.16.0-alpine AS base


FROM base AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY . .

RUN turbo prune --scope=@klicker-uzh/lti-service --docker


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
RUN pnpm run build --filter=@klicker-uzh/lti-service


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .
RUN pnpm i --frozen-lockfile --prod --ignore-scripts

COPY --from=builder --chown=nodejs:nodejs /app/packages/util/dist/ ./packages/util/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/types/dist/ ./packages/types/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/prisma/dist/ ./packages/prisma/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/grading/dist/ ./packages/grading/dist/
COPY --from=builder --chown=nodejs:nodejs /app/packages/logging/dist/ ./packages/logging/dist/
COPY --from=builder --chown=nodejs:nodejs /app/apps/lti/dist ./apps/lti/dist

USER nodejs

ARG NODE_ENV="production"
ENV NODE_ENV=${NODE_ENV}

EXPOSE 4000

CMD ["node", "apps/lti/dist/index.js"]
