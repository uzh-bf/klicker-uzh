#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
	echo "Usage: $0 <command> [args...]" >&2
	exit 1
fi

export COOKIE_DOMAIN='127.0.0.1'
export API_DOMAIN="$COOKIE_DOMAIN"

# Chat's anonymous-guest path derives persona ids and signs guest tokens from
# these two values. `next build` bakes NODE_ENV=production into the bundle, so
# a built Chat app refuses the APP_SECRET-derived fallback regardless of the
# runtime NODE_ENV. Fixed dev fixtures, not credentials.
export CHAT_GUEST_SEED='playwright-chat-guest-seed'
export APP_CHAT_GUEST_SECRET='playwright-chat-guest-secret'

export APP_ORIGIN_API='http://127.0.0.1:3000'
export APP_ORIGIN_PWA='http://127.0.0.1:3001'
export APP_ORIGIN_MANAGE='http://127.0.0.1:3002'
export APP_ORIGIN_CONTROL='http://127.0.0.1:3003'
export APP_ORIGIN_LTI='http://127.0.0.1:4000'
export APP_ORIGIN_AUTH='http://127.0.0.1:3010'
export APP_ORIGIN_CHAT='http://127.0.0.1:3004'
export APP_ORIGIN_ASSESSMENT_API="$APP_ORIGIN_API"
export APP_ORIGIN_ASSESSMENT_PWA="$APP_ORIGIN_PWA"

export NEXT_PUBLIC_API_URL="$APP_ORIGIN_API/api/graphql"
export NEXT_PUBLIC_API_URL_SSR="$NEXT_PUBLIC_API_URL"
export NEXT_PUBLIC_ADD_RESPONSE_URL='http://127.0.0.1:7078/AddResponse'
export NEXT_PUBLIC_PWA_URL="$APP_ORIGIN_PWA"
export NEXT_PUBLIC_MANAGE_URL="$APP_ORIGIN_MANAGE"
export NEXT_PUBLIC_CONTROL_URL="$APP_ORIGIN_CONTROL"
export NEXT_PUBLIC_AUTH_URL="$APP_ORIGIN_AUTH"
export NEXT_PUBLIC_LTI_URL="$APP_ORIGIN_LTI"
export NEXT_PUBLIC_CHAT_URL="$APP_ORIGIN_CHAT"
export NEXT_PUBLIC_ASSESSMENT_URL="$APP_ORIGIN_ASSESSMENT_PWA"
export NEXT_PUBLIC_ASSESSMENT_API_URL="$APP_ORIGIN_ASSESSMENT_API"
export NEXT_PUBLIC_GROWTHBOOK_API_HOST='https://growthbook.test'
export NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY='sdk-test'
export GROWTHBOOK_API_HOST="http://127.0.0.1:${GROWTHBOOK_TEST_PORT:-4010}"
export GROWTHBOOK_CLIENT_KEY='sdk-test'
export GROWTHBOOK_ENV='test'
export GROWTHBOOK_REFRESH_INTERVAL_MS='250'
# Test builds load .env.production, which enables the production Matomo sites.
# Set-but-empty values take precedence over Next's .env files and keep test
# runs from reporting synthetic page views as real visits.
export NEXT_PUBLIC_MATOMO_URL=''
export NEXT_PUBLIC_MATOMO_SITE_ID=''

export NEXTAUTH_URL="$APP_ORIGIN_AUTH"
export AUTH_STUDENT_ALLOWED_HOSTS='127.0.0.1:3001'
export AUTH_LECTURER_ALLOWED_HOSTS='127.0.0.1:3002,127.0.0.1:3003'
export AUTH_PWA_HOSTS='127.0.0.1:3000'

# The devcontainer's CI-parity Playwright runtime serves the same production
# builds behind devrouter's routed hostnames (https://<app>.<domain>), so the
# host browser reaches each app the way it does in development. CI leaves this
# unset and keeps the loopback origins above.
if [ -n "${KLICKER_TEST_ROUTED_DOMAIN:-}" ]; then
	routed_host() { echo "$1.${KLICKER_TEST_ROUTED_DOMAIN}"; }
	export COOKIE_DOMAIN="$KLICKER_TEST_ROUTED_DOMAIN"
	export API_DOMAIN="$COOKIE_DOMAIN"

	export APP_ORIGIN_API="https://$(routed_host api)"
	export APP_ORIGIN_PWA="https://$(routed_host pwa)"
	export APP_ORIGIN_MANAGE="https://$(routed_host manage)"
	export APP_ORIGIN_CONTROL="https://$(routed_host control)"
	export APP_ORIGIN_LTI="https://$(routed_host lti)"
	export APP_ORIGIN_AUTH="https://$(routed_host auth)"
	export APP_ORIGIN_CHAT="https://$(routed_host chat)"
	export APP_ORIGIN_ASSESSMENT_API="$APP_ORIGIN_API"
	export APP_ORIGIN_ASSESSMENT_PWA="$APP_ORIGIN_PWA"

	export NEXT_PUBLIC_API_URL="$APP_ORIGIN_API/api/graphql"
	export NEXT_PUBLIC_API_URL_SSR="$NEXT_PUBLIC_API_URL"
	export NEXT_PUBLIC_ADD_RESPONSE_URL="https://$(routed_host response-api)/AddResponse"
	export NEXT_PUBLIC_PWA_URL="$APP_ORIGIN_PWA"
	export NEXT_PUBLIC_MANAGE_URL="$APP_ORIGIN_MANAGE"
	export NEXT_PUBLIC_CONTROL_URL="$APP_ORIGIN_CONTROL"
	export NEXT_PUBLIC_AUTH_URL="$APP_ORIGIN_AUTH"
	export NEXT_PUBLIC_LTI_URL="$APP_ORIGIN_LTI"
	export NEXT_PUBLIC_CHAT_URL="$APP_ORIGIN_CHAT"
	export NEXT_PUBLIC_ASSESSMENT_URL="$APP_ORIGIN_ASSESSMENT_PWA"
	export NEXT_PUBLIC_ASSESSMENT_API_URL="$APP_ORIGIN_ASSESSMENT_API"

	export NEXTAUTH_URL="$APP_ORIGIN_AUTH"
	export CORS_ALLOWED_ORIGINS="$APP_ORIGIN_PWA"
	export AUTH_STUDENT_ALLOWED_HOSTS="$(routed_host pwa)"
	export AUTH_LECTURER_ALLOWED_HOSTS="$(routed_host manage),$(routed_host control)"
	export AUTH_PWA_HOSTS="$(routed_host api)"
fi

unset EDUID_CLIENT_SECRET

exec "$@"
