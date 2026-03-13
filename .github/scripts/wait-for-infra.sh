#!/bin/bash

set -euo pipefail

TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-120}"
CHECK_INTERVAL="${CHECK_INTERVAL:-3}"
SERVICES_INPUT='postgres redis_exec redis_assessment redis_cache hatchet'

require_option_value() {
  local option_name="$1"
  local option_value="${2-}"

  case "$option_value" in
    ''|--*)
      printf 'Missing value for %s\n' "$option_name" >&2
      exit 1
      ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --services)
      require_option_value "$1" "${2-}"
      SERVICES_INPUT="$2"
      shift 2
      ;;
    --help)
      cat <<'EOF'
Usage: .github/scripts/wait-for-infra.sh [--services "svc1 svc2"]
EOF
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

SERVICES_INPUT="$(printf '%s' "$SERVICES_INPUT" | tr ',' ' ')"

check_tcp() {
  local label="$1"
  local port="$2"

  if ! nc -z localhost "$port" 2>/dev/null; then
    printf '%s is not running on port %s\n' "$label" "$port"
    return 1
  fi

  printf '%s is running on port %s\n' "$label" "$port"
}

check_hatchet() {
  if ! curl -s -f http://localhost:8888/healthz >/dev/null 2>&1; then
    printf '%s\n' 'Hatchet HTTP is not ready on port 8888'
    return 1
  fi

  if ! nc -z localhost 7077 2>/dev/null; then
    printf '%s\n' 'Hatchet gRPC is not ready on port 7077'
    return 1
  fi

  printf '%s\n' 'Hatchet is ready (HTTP: 8888, gRPC: 7077)'
}

check_proxy() {
  local ready=true

  check_tcp 'Proxy HTTP' 80 || ready=false
  check_tcp 'Proxy HTTPS' 443 || ready=false

  if ! $ready; then
    return 1
  fi

  printf '%s\n' 'Proxy is ready (ports 80, 443)'
}

check_compose_service_running() {
  local service_name="$1"
  local running_services="$2"

  if ! grep -Fxq "$service_name" <<<"$running_services"; then
    printf 'Proxy compose service %s is not running\n' "$service_name" >&2
    return 1
  fi
}

need_postgres=false
need_redis_exec=false
need_redis_assessment=false
need_redis_cache=false
need_hatchet=false
need_proxy=false
proxy_compose_services=''

for service in $SERVICES_INPUT; do
  case "$service" in
    postgres)
      need_postgres=true
      ;;
    redis_exec)
      need_redis_exec=true
      ;;
    redis_assessment)
      need_redis_assessment=true
      ;;
    redis_cache)
      need_redis_cache=true
      ;;
    hatchet)
      need_hatchet=true
      ;;
    reverse_proxy_docker|reverse_proxy_macos|reverse_proxy_wsl)
      need_proxy=true
      proxy_compose_services+=" $service"
      ;;
    proxy)
      need_proxy=true
      ;;
  esac
done

elapsed=0

printf 'Waiting for infrastructure services (%s) (timeout: %ss)...\n' "$SERVICES_INPUT" "$TIMEOUT_SECONDS"

while [[ $elapsed -lt $TIMEOUT_SECONDS ]]; do
  all_up=true
  running_compose_services=''

  if $need_postgres; then
    check_tcp 'PostgreSQL' 5432 || all_up=false
  fi

  if $need_redis_exec; then
    check_tcp 'Redis exec' 6379 || all_up=false
  fi

  if $need_redis_assessment; then
    check_tcp 'Redis assessment' 6381 || all_up=false
  fi

  if $need_redis_cache; then
    check_tcp 'Redis cache' 6380 || all_up=false
  fi

  if $need_hatchet; then
    check_hatchet || all_up=false
  fi

  if $need_proxy; then
    if [[ -n "$proxy_compose_services" ]]; then
      running_compose_services="$(docker compose ps --services --status running 2>/dev/null || true)"
      for proxy_service in $proxy_compose_services; do
        check_compose_service_running "$proxy_service" "$running_compose_services" || all_up=false
      done
    fi

    check_proxy || all_up=false
  fi

  if $all_up; then
    printf '%s\n' 'Selected infrastructure services are ready.'
    exit 0
  fi

  sleep "$CHECK_INTERVAL"
  elapsed=$((elapsed + CHECK_INTERVAL))
  printf 'Still waiting... (%s seconds elapsed)\n' "$elapsed"
done

printf '%s\n' 'Timeout waiting for infrastructure services.'
exit 1
