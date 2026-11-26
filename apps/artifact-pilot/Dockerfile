FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/artifact-pilot/package.json apps/artifact-pilot/
RUN corepack enable && pnpm --filter @klicker-uzh/artifact-pilot install --prod --frozen-lockfile --ignore-scripts
FROM node:24.21.0-bookworm-slim
WORKDIR /workspace/apps/artifact-pilot
COPY --from=dependencies /workspace/node_modules /workspace/node_modules
COPY --from=dependencies /workspace/apps/artifact-pilot/node_modules ./node_modules
COPY apps/artifact-pilot/exercise.mjs apps/artifact-pilot/repository.mjs apps/artifact-pilot/server.mjs ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
