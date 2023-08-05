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

ARG NODE_ENV="production"
ARG NEXTAUTH_URL
ARG EDUID_CLIENT_ID
ARG EDUID_WELL_KNOWN
ARG NEXT_PUBLIC_EDUID_ID
ARG NEXT_PUBLIC_DEFAULT_REDIRECT

ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


# Production image, copy all the files and run next
FROM node:18-alpine AS runner

WORKDIR /app

ARG NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]