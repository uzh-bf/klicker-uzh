#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

cd "$REPO_ROOT"

export COOKIE_DOMAIN=.klicker.localhost

export NEXT_PUBLIC_PWA_URL=https://pwa.klicker.localhost
export NEXT_PUBLIC_CHAT_URL=https://chat.klicker.localhost
export NEXT_PUBLIC_AVATAR_BASE_PATH="https://sos-ch-dk-2.exo.io/klicker-prod/avatars"

# devrouter injects POSTGRES_HOST/POSTGRES_PORT for tcp dependencies.
# Align with current local postgres credentials in this repo.
if [ "${POSTGRES_PORT:-}" != "" ]; then
  export DATABASE_URL="postgres://klicker-prod:klicker@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT}/klicker-prod"
  export SHADOW_DATABASE_URL="postgres://klicker-prod:klicker@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT}/shadow"
fi

exec pnpm --filter @klicker-uzh/chat dev
