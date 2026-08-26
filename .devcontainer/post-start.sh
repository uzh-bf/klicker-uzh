#!/usr/bin/env bash
# devrouter:managed devcontainer
# Invoked by host-side `devrouter ensure` after it validates the exact container.
# Launches every routed app plus both workers through the delivered helper.
set -euo pipefail
cd /workspaces/klicker-uzh

# Re-source the canonical env (DevPod truncates env_file values at '='), then the
# runtime Hatchet token written by post-create (if any). (GOTCHAS #1)
set -a
# shellcheck source=/dev/null
. /workspaces/klicker-uzh/.devcontainer/devcontainer.env
# shellcheck source=/dev/null
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
  export NEXT_PUBLIC_ADD_RESPONSE_URL=http://localhost:7078/AddResponse
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
  export NEXT_PUBLIC_ADD_RESPONSE_URL=https://response-api.klicker.${WORKSPACE}.localhost/AddResponse
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

# Profile selection (devrouter >= 0.0.36). DEVROUTER_PROFILE is injected by
# `devrouter ensure --profile <name>`; empty means the config default (`full`).
# The profile is part of the process fingerprint so switching profiles replaces
# the owned turbo process group instead of mixing two app sets.
: "${DEVROUTER_PROFILE:=full}"
export DEVROUTER_PROFILE
echo "[post-start] Profile: ${DEVROUTER_PROFILE}"

: "${DEVROUTER_PROCESS_HELPER:?Run devrouter ensure to start this managed application process.}"

export DEVROUTER_PROCESS_FINGERPRINT_ENV='APP_ORIGIN_API,APP_ORIGIN_AUTH,APP_ORIGIN_PWA,APP_ORIGIN_MANAGE,APP_ORIGIN_CONTROL,APP_ORIGIN_ASSESSMENT_API,APP_ORIGIN_ASSESSMENT_PWA,APP_ORIGIN_LTI,APP_ORIGIN_CHAT,APP_MANAGE_SUBDOMAIN,APP_STUDENT_SUBDOMAIN,APP_CONTROL_SUBDOMAIN,NEXTAUTH_URL,COOKIE_DOMAIN,NEXT_PUBLIC_API_URL,NEXT_PUBLIC_AUTH_URL,NEXT_PUBLIC_MANAGE_URL,NEXT_PUBLIC_PWA_URL,NEXT_PUBLIC_ASSESSMENT_URL,NEXT_PUBLIC_CONTROL_URL,NEXT_PUBLIC_ADD_RESPONSE_URL,NEXT_PUBLIC_CHAT_URL,CORS_ALLOWED_ORIGINS,AUTH_LECTURER_ALLOWED_HOSTS,AUTH_STUDENT_ALLOWED_HOSTS,NODE_EXTRA_CA_CERTS,DEVROUTER_PROFILE'

# Map the profile(s) to turbo dev filters. api + auth are needed by every
# profile; workers only run where response ingestion is routed (live-quiz/full).
# The MCP fixture stays always-on (cheap, and seeded chat depends on it).
# NOTE: one turbo --filter flag per package — this turbo version treats a quoted
# comma list as a single literal package name.
# DEVROUTER_PROFILE may be a merged selection (e.g. "chat,pwa", canonicalized
# sorted by devrouter); match on contained profile names, not the exact string.
# READINESS_APPS lists the Next apps the profile starts, so the dev-runtime
# readiness contract only probes servers that are actually running.
case ",${DEVROUTER_PROFILE}," in
  *,full,*)
    DEV_TURBO_FILTERS=''
    READINESS_APPS='auth chat frontend-control frontend-manage frontend-pwa'
    ;;
  *,live-quiz,*)
    DEV_TURBO_FILTERS='--filter=@klicker-uzh/backend-docker --filter=@klicker-uzh/auth --filter=@klicker-uzh/frontend-pwa --filter=@klicker-uzh/frontend-control --filter=@klicker-uzh/response-api --filter=@klicker-uzh/hatchet-worker-general --filter=@klicker-uzh/hatchet-worker-response-processor'
    READINESS_APPS='auth frontend-control frontend-pwa'
    ;;
  *)
    DEV_TURBO_FILTERS='--filter=@klicker-uzh/backend-docker --filter=@klicker-uzh/auth'
    READINESS_APPS='auth'
    for profile_name in $(echo "${DEVROUTER_PROFILE}" | tr ',' ' '); do
      case "${profile_name}" in
        manage) DEV_TURBO_FILTERS="${DEV_TURBO_FILTERS} --filter=@klicker-uzh/frontend-manage"; READINESS_APPS="${READINESS_APPS} frontend-manage" ;;
        pwa) DEV_TURBO_FILTERS="${DEV_TURBO_FILTERS} --filter=@klicker-uzh/frontend-pwa"; READINESS_APPS="${READINESS_APPS} frontend-pwa" ;;
        chat) DEV_TURBO_FILTERS="${DEV_TURBO_FILTERS} --filter=@klicker-uzh/chat"; READINESS_APPS="${READINESS_APPS} chat" ;;
        control) DEV_TURBO_FILTERS="${DEV_TURBO_FILTERS} --filter=@klicker-uzh/frontend-control"; READINESS_APPS="${READINESS_APPS} frontend-control" ;;
        olat-api) DEV_TURBO_FILTERS="${DEV_TURBO_FILTERS} --filter=@klicker-uzh/olat-api" ;;
        lti) DEV_TURBO_FILTERS="${DEV_TURBO_FILTERS} --filter=@klicker-uzh/lti-service" ;;
        response-api) DEV_TURBO_FILTERS="${DEV_TURBO_FILTERS} --filter=@klicker-uzh/response-api" ;;
        *)
          echo "[post-start] WARNING: unknown profile component '${profile_name}', ignoring." >&2
          ;;
      esac
    done
    # Canonical order for stable logs; dev-runtime probes each app independently.
    READINESS_APPS=$(printf '%s\n' ${READINESS_APPS} | sort -u | tr '\n' ' ' | sed 's/ $//')
    ;;
esac
export READINESS_APPS

# The test seed connects Benibot's Tutor and Explainer modes to this local,
# read-only MCP fixture. Keep it in the app container so the seeded
# http://localhost:1417/mcp endpoint remains valid in every workspace. Prove
# readiness before starting Chat so its first request cannot miss the fixture.
MCP_FIXTURE_SHA256=$(sha256sum apps/chat/scripts/local-mcp-server.mjs)
MCP_FIXTURE_SHA256=${MCP_FIXTURE_SHA256%% *}
"$DEVROUTER_PROCESS_HELPER" ensure \
  --name klicker-local-mcp \
  --match 'apps/chat/scripts/local-mcp-server.mjs' \
  --log /tmp/local-mcp.log \
  -- node apps/chat/scripts/local-mcp-server.mjs "$MCP_FIXTURE_SHA256"

# Keep startup bounded: this fixture check must not delay managed-app readiness.
for attempt in $(seq 1 20); do
  if curl --fail --silent --show-error http://localhost:1417/health >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 20 ]; then
    echo '[post-start] ERROR: local MCP fixture did not become healthy.' >&2
    exit 1
  fi
  sleep 1
done

# Run the profile's apps (or everything for `full`) without Infisical. Devrouter
# owns generic locking, process-group identity, and bounded replacement; this
# repository owns only the application command and environment above.
start_managed_runtime() {
  local runtime_fingerprint runtime_generation

  runtime_fingerprint="$(bash ./util/dev-runtime.sh fingerprint)"
  runtime_generation="$(bash ./util/dev-runtime.sh generation)"
  if [ -n "${DEV_TURBO_FILTERS}" ]; then
    # shellcheck disable=SC2086 # intentional word splitting of filter flags
    "$DEVROUTER_PROCESS_HELPER" ensure \
      --name klicker-dev \
      --match 'turbo run dev' \
      --log /tmp/dev.log \
      -- bash ./util/dev-runtime.sh start "$runtime_fingerprint" "$runtime_generation" \
      -- pnpm exec turbo run dev ${DEV_TURBO_FILTERS}
  else
    "$DEVROUTER_PROCESS_HELPER" ensure \
      --name klicker-dev \
      --match 'turbo run dev' \
      --log /tmp/dev.log \
      -- bash ./util/dev-runtime.sh start "$runtime_fingerprint" "$runtime_generation" \
      -- pnpm run dev:container
  fi
}

start_managed_runtime

# Probe the profile's Next apps' readiness contract. 20 is the confirmed
# stale-route signature from util/dev-runtime.sh; any other failure fails closed
# without cache cleanup. Collect every stale app first so one managed restart
# repairs them together instead of restarting once per app. The app list comes
# from READINESS_APPS (profile-scoped) rather than every Next app, because a
# profile intentionally does not start the rest.
STALE_NEXT_APPS=()
run_readiness_pass() {
  local app status=0

  STALE_NEXT_APPS=()
  for app in ${READINESS_APPS}; do
    status=0
    bash ./util/dev-runtime.sh wait-app "$app" || status=$?
    if [ "$status" -eq 20 ]; then
      STALE_NEXT_APPS+=("$app")
    elif [ "$status" -ne 0 ]; then
      echo "[post-start] ERROR: $app failed semantic readiness; no cache cleanup was attempted." >&2
      echo '[post-start] Inspect /tmp/dev.log for the application failure.' >&2
      return "$status"
    fi
  done

  if [ "${#STALE_NEXT_APPS[@]}" -gt 0 ]; then
    echo "[post-start] Confirmed stale Next.js route state: ${STALE_NEXT_APPS[*]}." >&2
    return 20
  fi
  return 0
}

READINESS_STATUS=0
run_readiness_pass || READINESS_STATUS=$?
if [ "$READINESS_STATUS" -eq 20 ]; then
  echo "[post-start] Repairing the confirmed stale .next caches once: ${STALE_NEXT_APPS[*]}."
  for app in "${STALE_NEXT_APPS[@]}"; do
    bash ./util/dev-runtime.sh request-repair "$app"
  done
  start_managed_runtime

  READINESS_STATUS=0
  run_readiness_pass || READINESS_STATUS=$?
  if [ "$READINESS_STATUS" -ne 0 ]; then
    echo '[post-start] ERROR: The runtime remained unhealthy after its one repair attempt.' >&2
    echo '[post-start] Inspect /tmp/dev.log; no further cache cleanup was attempted.' >&2
    exit 1
  fi
elif [ "$READINESS_STATUS" -ne 0 ]; then
  exit 1
fi

# Next's development server compiles fallback dynamic routes on their first
# request. Prime the Manage course routes before a browser can request them so
# a cold Turbopack start cannot turn the first course visit into a 404. Keep
# both probes inside one short deadline so devrouter retains startup ownership.
if [[ "${APP_ORIGIN_MANAGE}" == https://* ]] &&
  [ -s /etc/devrouter/mkcert-rootCA.pem ]; then
  MANAGE_CURL_CA=(--cacert /etc/devrouter/mkcert-rootCA.pem)
else
  MANAGE_CURL_CA=()
fi

manage_probe_deadline=$((SECONDS + 60))
manage_list_ready=false
manage_course_ready=false
manage_course_path="${APP_ORIGIN_MANAGE}/courses/__devrouter_warmup"
probe_manage_route() {
  local remaining_seconds=$((manage_probe_deadline - SECONDS))
  if (( remaining_seconds <= 0 )); then
    printf '000 0'
    return
  fi

  local max_time=5
  if (( remaining_seconds < max_time )); then
    max_time=$remaining_seconds
  fi

  local probe_args=(
    --location
    --silent
    --show-error
    --max-time "$max_time"
    --output /dev/null
    --write-out '%{http_code} %{size_download}'
  )
  curl "${MANAGE_CURL_CA[@]}" "${probe_args[@]}" "$1" || true
}

manage_list_probe='000 0'
manage_course_probe='000 0'
while (( SECONDS < manage_probe_deadline )); do
  if [[ "$manage_list_ready" == false ]]; then
    manage_list_probe=$(probe_manage_route "${APP_ORIGIN_MANAGE}/courses")
    [[ "$manage_list_probe" =~ ^200\ [1-9][0-9]*$ ]] && manage_list_ready=true
  fi
  if [[ "$manage_course_ready" == false ]]; then
    manage_course_probe=$(probe_manage_route "$manage_course_path")
    [[ "$manage_course_probe" =~ ^200\ [1-9][0-9]*$ ]] && manage_course_ready=true
  fi
  [[ "$manage_list_ready" == true && "$manage_course_ready" == true ]] && break
  remaining_seconds=$((manage_probe_deadline - SECONDS))
  (( remaining_seconds > 0 )) && sleep "$remaining_seconds"
done

if [[ "$manage_list_ready" == false || "$manage_course_ready" == false ]]; then
  echo "[post-start] WARN: Manage course-route warm-up did not finish; list=${manage_list_probe} (${APP_ORIGIN_MANAGE}/courses), course=${manage_course_probe} (${manage_course_path}); leaving readiness to devrouter." >&2
fi

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
[post-start]   MCP fixture  -> http://localhost:1417/mcp (Benibot Tutor/Explainer)
[post-start]   Workers      -> hatchet-worker-general + -response-processor (no URL; consume hatchet queue)
[post-start] Lifecycle -> on the host: devrouter ensure <this-checkout>
[post-start] Logs    -> devrouter exec <this-checkout> -- tail -f /tmp/dev.log
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
[post-start]   MCP fixture  -> http://localhost:1417/mcp (Benibot Tutor/Explainer)
[post-start]   Workers      -> hatchet-worker-general + -response-processor (no URL; consume hatchet queue)
[post-start] Logs    -> devrouter exec <this-checkout> -- tail -f /tmp/dev.log
EOF
fi
