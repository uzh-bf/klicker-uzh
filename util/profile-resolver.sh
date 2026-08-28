#!/usr/bin/env bash
# Pure, sourceable profile resolver for the managed devcontainer. Maps a
# canonical DEVROUTER_PROFILE selection (comma-separated, order-insensitive,
# de-duplicated by devrouter) to the exact turbo roots, readiness apps, and
# process markers post-start.sh must act on. No side effects: callers own all
# process and service changes. Fails closed on unknown components.

KLICKER_PROFILE_BACKEND_ROOT='--filter=@klicker-uzh/backend-docker'
KLICKER_PROFILE_AUTH_ROOT='--filter=@klicker-uzh/auth'
KLICKER_PROFILE_MANAGE_ROOT='--filter=@klicker-uzh/frontend-manage'
KLICKER_PROFILE_PWA_ROOT='--filter=@klicker-uzh/frontend-pwa'
KLICKER_PROFILE_CHAT_ROOT='--filter=@klicker-uzh/chat'
KLICKER_PROFILE_CONTROL_ROOT='--filter=@klicker-uzh/frontend-control'
KLICKER_PROFILE_RESPONSE_ROOT='--filter=@klicker-uzh/response-api'
KLICKER_PROFILE_WORKER_GENERAL_ROOT='--filter=@klicker-uzh/hatchet-worker-general'
KLICKER_PROFILE_WORKER_RESPONSE_ROOT='--filter=@klicker-uzh/hatchet-worker-response-processor'

# profile_wants <marker>: exit 0 when the selection selects the managed marker.
profile_wants() {
  local marker="$1" component
  case "$marker" in
    klicker-dev|klicker-local-mcp|klicker-workers) ;;
    *) return 2 ;;
  esac
  for component in $(printf '%s' "${DEVROUTER_PROFILE}" | tr ',' '\n' | sort -u); do
    case "${component}" in
      full|manage|pwa|chat|live-quiz|mcp|ai|email) ;;
      *) return 2 ;;
    esac
  done
  for component in $(printf '%s' "${DEVROUTER_PROFILE}" | tr ',' '\n' | sort -u); do
    case "${component}" in
      full) return 0 ;;
      manage|pwa|chat) [ "$marker" = klicker-dev ] && return 0 ;;
      live-quiz)
        case "$marker" in
          klicker-dev|klicker-workers) return 0 ;;
        esac
        ;;
      mcp) [ "$marker" = klicker-local-mcp ] && return 0 ;;
      ai|email) ;;
      *) return 2 ;;
    esac
  done
  return 1
}

# profile_turbo_filters: exact per-package turbo --filter flags for klicker-dev.
# 'full' starts every routed app plus both workers (turbo default: no filter).
profile_turbo_filters() {
  local filters="" component status
  profile_wants klicker-dev
  status=$?
  [ "$status" -eq 2 ] && return 2
  [ "$status" -ne 0 ] && return 0
  for component in $(printf '%s' "${DEVROUTER_PROFILE}" | tr ',' '\n' | sort -u); do
    case "${component}" in
      full) return 0 ;;
      manage) filters="${filters} ${KLICKER_PROFILE_MANAGE_ROOT}" ;;
      pwa) filters="${filters} ${KLICKER_PROFILE_PWA_ROOT}" ;;
      chat) filters="${filters} ${KLICKER_PROFILE_CHAT_ROOT} ${KLICKER_PROFILE_PWA_ROOT}" ;;
      live-quiz)
        filters="${filters} ${KLICKER_PROFILE_PWA_ROOT} ${KLICKER_PROFILE_CONTROL_ROOT} ${KLICKER_PROFILE_RESPONSE_ROOT} ${KLICKER_PROFILE_WORKER_GENERAL_ROOT} ${KLICKER_PROFILE_WORKER_RESPONSE_ROOT}"
        ;;
      mcp|ai|email) ;;
      *) return 2 ;;
    esac
  done
  printf '%s %s %s\n' "${KLICKER_PROFILE_BACKEND_ROOT}" "${KLICKER_PROFILE_AUTH_ROOT}" "${filters}" \
    | tr ' ' '\n' | awk 'NF && !seen[$0]++' | paste -sd' ' -
}

# profile_readiness_apps: runtime apps whose semantic readiness must be proven.
profile_readiness_apps() {
  local apps="" component status
  profile_wants klicker-dev
  status=$?
  [ "$status" -eq 2 ] && return 2
  [ "$status" -ne 0 ] && return 0
  for component in $(printf '%s' "${DEVROUTER_PROFILE}" | tr ',' '\n' | sort -u); do
    case "${component}" in
      full) printf 'auth chat frontend-control frontend-manage frontend-pwa response-api\n'; return 0 ;;
      manage) apps="${apps} frontend-manage" ;;
      pwa) apps="${apps} frontend-pwa" ;;
      chat) apps="${apps} chat frontend-pwa" ;;
      live-quiz) apps="${apps} frontend-control frontend-pwa response-api" ;;
      mcp|ai|email) ;;
      *) return 2 ;;
    esac
  done
  printf 'auth %s\n' "$apps" | tr ' ' '\n' | awk 'NF && !seen[$0]++' | paste -sd' ' -
}
