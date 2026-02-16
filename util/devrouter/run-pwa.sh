#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

cd "$REPO_ROOT"

export COOKIE_DOMAIN=.klicker.localhost
export API_DOMAIN=api.klicker.localhost

export APP_ORIGIN_API=https://api.klicker.localhost
export APP_ORIGIN_PWA=https://pwa.klicker.localhost
export APP_ORIGIN_ASSESSMENT_API=https://api.klicker.localhost
export APP_ORIGIN_ASSESSMENT_PWA=https://pwa.klicker.localhost
export APP_ORIGIN_AUTH=https://auth.klicker.localhost
export APP_ORIGIN_MANAGE=https://manage.klicker.localhost
export APP_ORIGIN_CONTROL=https://control.klicker.localhost
export APP_ORIGIN_LTI=https://lti.klicker.localhost
export APP_ORIGIN_CHAT=https://chat.klicker.localhost

export NEXT_PUBLIC_API_URL=https://api.klicker.localhost/api/graphql
export NEXT_PUBLIC_API_URL_SSR=https://api.klicker.localhost/api/graphql
export NEXT_PUBLIC_PWA_URL=https://pwa.klicker.localhost
export NEXT_PUBLIC_ASSESSMENT_URL=https://pwa.klicker.localhost
export NEXT_PUBLIC_ASSESSMENT_API_URL=https://api.klicker.localhost

exec pnpm --filter @klicker-uzh/frontend-pwa dev
