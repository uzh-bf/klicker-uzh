#!/usr/bin/env bash
# Runs on every container start. Launches the core apps (turbo dev) in the
# background so they are reachable through devrouter without a manual step.
set -euo pipefail
cd /workspaces/klicker-uzh

# Re-source the canonical env (DevPod truncates env_file values at '='), then the
# runtime Hatchet token written by post-create (if any). (GOTCHAS #1)
set -a
. /workspaces/klicker-uzh/.devcontainer/devcontainer.env
[ -f /workspaces/klicker-uzh/.devcontainer/.hatchet.env ] && . /workspaces/klicker-uzh/.devcontainer/.hatchet.env
set +a

# Detect if devrouter routing is active (via mkcert CA mount) or fallback to plain localhost ports
if [ ! -s /etc/devrouter/mkcert-rootCA.pem ]; then
  echo "[post-start] devrouter not detected (no cert mount). Falling back to localhost port-based URLs."
  export APP_ORIGIN_API=http://localhost:3000
  export APP_ORIGIN_AUTH=http://localhost:3010
  export APP_ORIGIN_PWA=http://localhost:3001
  export APP_ORIGIN_MANAGE=http://localhost:3002
  export APP_ORIGIN_CONTROL=http://localhost:3003
  export APP_ORIGIN_ASSESSMENT_API=http://localhost:3000
  export APP_ORIGIN_ASSESSMENT_PWA=http://localhost:3001
  export APP_ORIGIN_LTI=http://localhost:4000
  export APP_ORIGIN_CHAT=http://localhost:3004
  export NEXTAUTH_URL=http://localhost:3010
  export COOKIE_DOMAIN=localhost
  export NEXT_PUBLIC_API_URL=http://localhost:3000/api/graphql
  export NEXT_PUBLIC_AUTH_URL=http://localhost:3010
  export NEXT_PUBLIC_MANAGE_URL=http://localhost:3002
  export NEXT_PUBLIC_PWA_URL=http://localhost:3001
  export NEXT_PUBLIC_ASSESSMENT_URL=http://localhost:3001
  export NEXT_PUBLIC_CONTROL_URL=http://localhost:3003
  export NEXT_PUBLIC_ADD_RESPONSE_URL=http://localhost:7078
  export NEXT_PUBLIC_CHAT_URL=http://localhost:3004
  export CORS_ALLOWED_ORIGINS=http://localhost:3001
  export NODE_EXTRA_CA_CERTS=""
elif [ -n "${WORKSPACE:-}" ]; then
  echo "[post-start] Namespacing URLs for workspace: $WORKSPACE"
  export APP_ORIGIN_API=https://api.klicker.${WORKSPACE}.localhost
  export APP_ORIGIN_AUTH=https://auth.klicker.${WORKSPACE}.localhost
  export APP_ORIGIN_PWA=https://pwa.klicker.${WORKSPACE}.localhost
  export APP_ORIGIN_MANAGE=https://manage.klicker.${WORKSPACE}.localhost
  export APP_ORIGIN_CONTROL=https://control.klicker.${WORKSPACE}.localhost
  export APP_ORIGIN_ASSESSMENT_API=https://api.klicker.${WORKSPACE}.localhost
  export APP_ORIGIN_ASSESSMENT_PWA=https://pwa.klicker.${WORKSPACE}.localhost
  export APP_MANAGE_SUBDOMAIN=manage.klicker.${WORKSPACE}.localhost
  export APP_STUDENT_SUBDOMAIN=pwa.klicker.${WORKSPACE}.localhost
  export APP_CONTROL_SUBDOMAIN=control.klicker.${WORKSPACE}.localhost
  export NEXTAUTH_URL=https://auth.klicker.${WORKSPACE}.localhost
  export COOKIE_DOMAIN=klicker.${WORKSPACE}.localhost
  export NEXT_PUBLIC_API_URL=https://api.klicker.${WORKSPACE}.localhost/api/graphql
  export NEXT_PUBLIC_AUTH_URL=https://auth.klicker.${WORKSPACE}.localhost
  export NEXT_PUBLIC_MANAGE_URL=https://manage.klicker.${WORKSPACE}.localhost
  export NEXT_PUBLIC_PWA_URL=https://pwa.klicker.${WORKSPACE}.localhost
  export NEXT_PUBLIC_ASSESSMENT_URL=https://pwa.klicker.${WORKSPACE}.localhost
  export NEXT_PUBLIC_CONTROL_URL=https://control.klicker.${WORKSPACE}.localhost
  export NEXT_PUBLIC_ADD_RESPONSE_URL=https://response-api.klicker.${WORKSPACE}.localhost
  export CORS_ALLOWED_ORIGINS=https://pwa.klicker.${WORKSPACE}.localhost
  export AUTH_LECTURER_ALLOWED_HOSTS=manage.klicker.${WORKSPACE}.localhost,127.0.0.1:3002
  export AUTH_STUDENT_ALLOWED_HOSTS=pwa.klicker.${WORKSPACE}.localhost,127.0.0.1:3001
  export APP_ORIGIN_LTI=https://lti.klicker.${WORKSPACE}.localhost
  export NEXT_PUBLIC_CHAT_URL=https://chat.klicker.${WORKSPACE}.localhost
  export APP_ORIGIN_CHAT=https://chat.klicker.${WORKSPACE}.localhost
fi

# No-TTY pnpm hardening (see post-create.sh). (GOTCHAS #18)
export CI=true
export npm_config_verify_deps_before_run=false

# Double-start guard. The dev command runs `turbo run dev`, so the supervisor
# shows as "turbo run dev" in ps.
if pgrep -f "turbo run dev" >/dev/null 2>&1; then
  echo "[post-start] Dev servers already running."
  exit 0
fi

echo "[post-start] Starting apps in the background (logs: /tmp/dev.log)..."
# PHASE 1 core: backend + auth + frontend-pwa/manage/control.
# PHASE 2 Tier 1: + olat-api & response-api (routed) + the two hatchet workers
# (no port/route — they consume the hatchet event queue). Still NOT chat/lti/
# analytics. Bypass the Infisical wrapper the root `dev` script uses — the
# container owns its env. Fully detach so the DevPod agent pipe is released
# (else `devpod up` hangs). (GOTCHAS #2)
DEV_CMD='pnpm exec turbo run dev \
  --filter=@klicker-uzh/backend-docker \
  --filter=@klicker-uzh/auth \
  --filter=@klicker-uzh/frontend-pwa \
  --filter=@klicker-uzh/frontend-manage \
  --filter=@klicker-uzh/frontend-control \
  --filter=@klicker-uzh/olat-api \
  --filter=@klicker-uzh/response-api \
  --filter=@klicker-uzh/lti-service \
  --filter=@klicker-uzh/chat \
  --filter=@klicker-uzh/hatchet-worker-general \
  --filter=@klicker-uzh/hatchet-worker-response-processor \
  --concurrency 30'
setsid bash -c "$DEV_CMD" >/tmp/dev.log 2>&1 </dev/null &
disown 2>/dev/null || true

if [ -s /etc/devrouter/mkcert-rootCA.pem ]; then
  cat <<EOF
[post-start] Apps (via devrouter; first compile can take a minute):
[post-start]   API          -> ${APP_ORIGIN_API}
[post-start]   Auth         -> ${APP_ORIGIN_AUTH}
[post-start]   PWA          -> ${APP_ORIGIN_PWA}
[post-start]   Manage       -> ${APP_ORIGIN_MANAGE}   (login: lecturer / abcd)
[post-start]   Control      -> ${APP_ORIGIN_CONTROL}
[post-start]   OLAT API     -> https://olat-api.${COOKIE_DOMAIN}  (/health, /api-docs; bearer OLAT_API_KEY)
[post-start]   Response API -> ${NEXT_PUBLIC_ADD_RESPONSE_URL}
[post-start]   LTI Service  -> ${APP_ORIGIN_LTI}
[post-start]   Chat         -> ${NEXT_PUBLIC_CHAT_URL} (requires UPSTREAM_OPENAI_API_KEY)
[post-start]   Workers      -> hatchet-worker-general + -response-processor (no URL; consume hatchet queue)
[post-start] Routes  -> on the host: for a in api auth pwa manage control olat-api response-api lti chat db; do devrouter app run "\$a"${WORKSPACE:+ --workspace ${WORKSPACE}}; done
[post-start] Logs    -> tail -f /tmp/dev.log
EOF
else
  cat <<'EOF'
[post-start] Apps (plain localhost; first compile can take a minute):
[post-start]   API          -> http://localhost:3000
[post-start]   Auth         -> http://localhost:3010
[post-start]   PWA          -> http://localhost:3001
[post-start]   Manage       -> http://localhost:3002   (login: lecturer / abcd)
[post-start]   Control      -> http://localhost:3003
[post-start]   OLAT API     -> http://localhost:3030  (/health, /api-docs; bearer OLAT_API_KEY)
[post-start]   Response API -> http://localhost:7078
[post-start]   LTI Service  -> http://localhost:4000
[post-start]   Chat         -> http://localhost:3004 (requires UPSTREAM_OPENAI_API_KEY)
[post-start]   Workers      -> hatchet-worker-general + -response-processor (no URL; consume hatchet queue)
[post-start] Logs    -> tail -f /tmp/dev.log
EOF
fi
