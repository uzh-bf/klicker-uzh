# Dev container image for klicker-uzh (monorepo).
# glibc base (bookworm) for painless Prisma/esbuild/sharp native binaries — the
# prod images can stay Alpine, the dev image favors fewer surprises. (GOTCHAS #7)
FROM node:20-bookworm-slim

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    DEBIAN_FRONTEND=noninteractive

# Runtime tools: git (repo ops), openssl/ca-certificates (Prisma + TLS),
# procps (pgrep for the post-start dev-server guard), curl (healthchecks).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git openssl ca-certificates procps curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm with npm (not corepack — signature verification can fail on a
# pinned Node). Mirror the repo's packageManager pin. (GOTCHAS #8)
RUN npm install -g pnpm@10.15.0

# Keep the pnpm store inside the image, off the bind-mounted workspace. (GOTCHAS #9)
RUN pnpm config set store-dir "$PNPM_HOME/.pnpm-store"

WORKDIR /workspaces/klicker-uzh
