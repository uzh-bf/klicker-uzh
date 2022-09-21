# Install dependencies only when needed
FROM node:18-alpine AS deps

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json ./

RUN npm install


# Rebuild the source code only when needed
FROM node:18-alpine AS builder

WORKDIR /app

ARG NODE_ENV production
ENV NODE_ENV $NODE_ENV

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build && npm prune --omit dev


# Production image, copy all the files and run next
FROM node:18-alpine AS runner

WORKDIR /app

ARG NODE_ENV production
ENV NODE_ENV $NODE_ENV

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

USER nodejs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "dist/index.js"]
