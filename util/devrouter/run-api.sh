#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

cd "$REPO_ROOT"

export COOKIE_DOMAIN=.klicker.localhost
export API_DOMAIN=api.klicker.localhost
export APP_STUDENT_SUBDOMAIN=pwa
export APP_MANAGE_SUBDOMAIN=manage
export APP_CONTROL_SUBDOMAIN=control

export APP_ORIGIN_API=https://api.klicker.localhost
export APP_ORIGIN_PWA=https://pwa.klicker.localhost
export APP_ORIGIN_ASSESSMENT_API=https://api.klicker.localhost
export APP_ORIGIN_ASSESSMENT_PWA=https://pwa.klicker.localhost
export APP_ORIGIN_AUTH=https://auth.klicker.localhost
export APP_ORIGIN_MANAGE=https://manage.klicker.localhost
export APP_ORIGIN_CONTROL=https://control.klicker.localhost
export APP_ORIGIN_LTI=https://lti.klicker.localhost

# devrouter injects POSTGRES_HOST/POSTGRES_PORT for tcp dependencies.
# Align with current local postgres credentials in this repo.
if [ "${POSTGRES_PORT:-}" != "" ]; then
  export DATABASE_URL="postgres://klicker-prod:klicker@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT}/klicker-prod"
  export SHADOW_DATABASE_URL="postgres://klicker-prod:klicker@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT}/shadow"
fi

exec pnpm --filter @klicker-uzh/backend-docker dev
