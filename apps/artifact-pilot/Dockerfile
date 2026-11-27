FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/artifact-pilot/package.json apps/artifact-pilot/
RUN corepack enable && pnpm --filter @klicker-uzh/artifact-pilot install --prod --frozen-lockfile --ignore-scripts
FROM node:24.21.0-bookworm-slim AS styles-check
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/artifact-pilot/package.json apps/artifact-pilot/
RUN corepack enable && pnpm --filter @klicker-uzh/artifact-pilot install --frozen-lockfile --ignore-scripts
COPY apps/artifact-pilot/generate-styles.mjs apps/artifact-pilot/starter-style.mjs apps/artifact-pilot/styles.css apps/artifact-pilot/
COPY apps/frontend-manage/src/globals.css apps/frontend-manage/src/globals.css
WORKDIR /workspace/apps/artifact-pilot
RUN node generate-styles.mjs --check
FROM node:24.21.0-bookworm-slim
WORKDIR /workspace/apps/artifact-pilot
COPY --from=dependencies /workspace/node_modules /workspace/node_modules
COPY --from=dependencies /workspace/apps/artifact-pilot/node_modules ./node_modules
COPY apps/artifact-pilot/exercise.mjs apps/artifact-pilot/repository.mjs apps/artifact-pilot/server.mjs apps/artifact-pilot/starter-style.mjs apps/artifact-pilot/styles.css ./
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
