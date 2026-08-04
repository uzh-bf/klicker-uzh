FROM docker.io/library/node:24.16.0-alpine AS base


FROM base AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/mcp-lecturer ./apps/mcp-lecturer
COPY packages/prisma ./packages/prisma

RUN turbo prune --scope=@klicker-uzh/mcp-lecturer --docker


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN npm i -g --ignore-scripts pnpm@11.5.0 turbo@2.5.6

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY --from=deps /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/mcp-lecturer


FROM base AS runtime
WORKDIR /app

RUN npm i -g --ignore-scripts pnpm@11.5.0

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm install --prod --frozen-lockfile --ignore-scripts

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/apps/mcp-lecturer/dist/ /app/apps/mcp-lecturer/dist/
COPY --from=builder /app/packages/prisma/dist/ /app/packages/prisma/dist/

USER nodejs

ENV NODE_ENV=production \
    MCP_LECTURER_HOST=0.0.0.0 \
    MCP_LECTURER_PORT=7081

EXPOSE 7081

CMD ["node", "/app/apps/mcp-lecturer/dist/index.js"]
