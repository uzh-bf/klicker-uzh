FROM docker.io/library/node:20.18.1-alpine AS base


FROM base AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@9.15.4 turbo@2.1.0

COPY . .

RUN turbo prune --scope=@klicker-uzh/audit --docker


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN apk update

RUN npm i -g --ignore-scripts pnpm@9.15.4 turbo@2.1.0

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --frozen-lockfile --ignore-scripts

ARG NODE_ENV="production"

COPY --from=deps /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/audit


FROM base AS runtime
WORKDIR /app

ARG NODE_ENV="production"

RUN npm i -g --ignore-scripts pnpm@9.15.4 turbo@2.1.0

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm i --frozen-lockfile --prod --ignore-scripts

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/apps/audit/dist/ /app/apps/audit/dist/

USER nodejs

EXPOSE 7080

CMD ["node", "/app/apps/audit/dist/index.js"]