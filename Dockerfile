FROM docker.io/library/node:18-alpine AS base

RUN npm i -g pnpm turbo


FROM base AS builder
RUN apk add --no-cache libc6-compat
RUN apk update

WORKDIR /app

COPY . .

RUN turbo prune --scope=@klicker-uzh/auth --docker


FROM base AS installer
RUN apk add --no-cache libc6-compat
RUN apk update

WORKDIR /app

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm* .

RUN ls
RUN pnpm i --frozen-lockfile
