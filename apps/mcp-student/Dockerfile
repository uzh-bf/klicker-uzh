FROM docker.io/library/node:24.16.0-alpine AS base


FROM base AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat
# pnpm 12 needs native setup for direct child-process execution on Alpine.
RUN npm i -g --ignore-scripts pnpm@12.11.2 turbo@2.10.11 \
 && node "$(npm root -g)/pnpm/install.js"

COPY . .

RUN turbo prune --scope=@klicker-uzh/mcp-student --docker


FROM base AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN npm i -g --ignore-scripts pnpm@12.11.2 turbo@2.10.11 \
 && node "$(npm root -g)/pnpm/install.js"

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY --from=deps /app/out/full/ .
RUN pnpm run build --filter=@klicker-uzh/mcp-student


FROM base AS runtime
WORKDIR /app

RUN npm i -g --ignore-scripts pnpm@12.11.2 \
 && node "$(npm root -g)/pnpm/install.js"

COPY --from=deps /app/out/json/ .
COPY --from=deps /app/out/pnpm* .

RUN pnpm install --prod --frozen-lockfile --ignore-scripts

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/packages/grading/dist/ /app/packages/grading/dist/
COPY --from=builder /app/packages/feature-flags/dist/ /app/packages/feature-flags/dist/
COPY --from=builder /app/packages/graphql/dist/ /app/packages/graphql/dist/
COPY --from=builder /app/packages/doc-query-client/dist/ /app/packages/doc-query-client/dist/
COPY --from=builder /app/packages/prisma/dist/ /app/packages/prisma/dist/
COPY --from=builder /app/packages/types/dist/ /app/packages/types/dist/
COPY --from=builder /app/packages/util/dist/ /app/packages/util/dist/
COPY --from=builder /app/apps/mcp-student/dist/ /app/apps/mcp-student/dist/

USER nodejs

ENV NODE_ENV=production \
    MCP_STUDENT_HOST=0.0.0.0 \
    MCP_STUDENT_PORT=7080

EXPOSE 7080

CMD ["node", "/app/apps/mcp-student/dist/index.js"]
