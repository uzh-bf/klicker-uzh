# Dev container image for klicker-uzh (monorepo).
# glibc base (bookworm) for painless Prisma/esbuild/sharp native binaries — the
# prod images can stay Alpine, the dev image favors fewer surprises. (GOTCHAS #7)
FROM node:24.21.0-bookworm-slim

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    UV_PYTHON="3.12"

ARG DEBIAN_FRONTEND=noninteractive

# Runtime tools: git (repo ops), openssl/ca-certificates (Prisma + TLS),
# procps (process matching), util-linux (flock/setsid), curl (healthchecks).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git openssl ca-certificates procps util-linux curl \
    && rm -rf /var/lib/apt/lists/*

# Match the analytics image and CI so the repository-wide lint gate works in
# the self-contained development environment.
COPY --from=ghcr.io/astral-sh/uv:0.11.12 /uv /uvx /bin/

# Optional additional trust root for managed cloud HTTPS proxies. Empty locally.
ARG KLICKER_EXTRA_CA_PEM=""
RUN if [ -n "$KLICKER_EXTRA_CA_PEM" ]; then \
      printf '%s\n' "$KLICKER_EXTRA_CA_PEM" > /usr/local/share/ca-certificates/klicker-cloud-proxy.crt \
      && update-ca-certificates; \
    fi
ENV NODE_USE_SYSTEM_CA=1

# Install pnpm with npm (not corepack — signature verification can fail on a
# pinned Node). Mirror the repo's packageManager pin. (GOTCHAS #8)
RUN npm install -g pnpm@11.5.0

# Use a stable path for the machine-local store mounted by Compose. (GOTCHAS #9)
RUN pnpm config set store-dir "$PNPM_HOME/.pnpm-store"

WORKDIR /workspaces/klicker-uzh
