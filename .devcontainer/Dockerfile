# Dev container image for klicker-uzh (monorepo).
# glibc base (bookworm) for painless Prisma/esbuild/sharp native binaries — the
# prod images can stay Alpine, the dev image favors fewer surprises. (GOTCHAS #7)
FROM node:24.16.0-bookworm-slim

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    DEBIAN_FRONTEND=noninteractive

# Runtime tools: git (repo ops), openssl/ca-certificates (Prisma + TLS),
# procps (process matching), util-linux (flock/setsid), tar (extract the
# devrouter process helper), curl (healthchecks).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git openssl ca-certificates procps util-linux tar curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm with npm (not corepack — signature verification can fail on a
# pinned Node). Mirror the repo's packageManager pin. (GOTCHAS #8)
RUN npm install -g pnpm@11.5.0

# Keep generic process ownership and restart behavior in devrouter. Extract only
# the helper so the app image does not install the CLI dependency tree.
RUN npm pack --silent '@devrouter/cli@0.0.30' \
    && tar -xzf devrouter-cli-0.0.30.tgz --strip-components=2 \
        -C /usr/local/bin package/bin/devrouter-process \
    && chmod +x /usr/local/bin/devrouter-process \
    && rm devrouter-cli-0.0.30.tgz

# Keep the pnpm store inside the image, off the bind-mounted workspace. (GOTCHAS #9)
RUN pnpm config set store-dir "$PNPM_HOME/.pnpm-store"

WORKDIR /workspaces/klicker-uzh
