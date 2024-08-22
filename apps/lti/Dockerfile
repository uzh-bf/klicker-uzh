FROM docker.io/library/node:20.16.0-alpine AS base


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@9.8.0 turbo@2.0.14

COPY . .

RUN turbo prune --scope=@klicker-uzh/lti-service --docker


FROM base AS installer
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@9.8.0 turbo@2.0.14

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

RUN pnpm i --frozen-lockfile

ARG NODE_ENV="production"

COPY --from=builder /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/lti-service


FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

RUN npm i -g --ignore-scripts pnpm@9.8.0 turbo@2.0.14

COPY --from=builder /app/out/json/ .
RUN pnpm i --frozen-lockfile --prod --ignore-scripts

COPY --from=installer --chown=nodejs:nodejs /app/apps/lti/dist ./apps/lti/dist

USER nodejs

ARG NODE_ENV="production"

EXPOSE 4000

CMD ["node", "--experimental-default-type=module", "apps/lti/dist/index.js"]
