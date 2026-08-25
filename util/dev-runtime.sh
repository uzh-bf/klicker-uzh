#!/usr/bin/env bash
set -euo pipefail

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
ROOT="${KLICKER_DEV_RUNTIME_ROOT:-$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)}"
STATE_DIR="${KLICKER_DEV_RUNTIME_STATE_DIR:-$ROOT/.devcontainer/.runtime}"
GENERATION_FILE="$STATE_DIR/generation"
REPAIR_REQUEST_FILE="$STATE_DIR/next-repair-request"
DEPENDENCY_STAMP_FILE="$ROOT/node_modules/.klicker-dependency-fingerprint"
NEXT_APPS=(auth chat frontend-control frontend-manage frontend-pwa)
# Authentication rejects this valid synthetic nested route before any database
# lookup, so the handler must return JSON 401 even when no seed data exists.
CHAT_PROBE_URL='http://localhost:3004/api/chatbots/00000000-0000-4000-8000-000000000000/threads'
STALE_STATUS=20
WAITING_STATUS=21
UNEXPECTED_STATUS=22

die() {
  echo "[dev-runtime] ERROR: $*" >&2
  exit 1
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || die "Required command is unavailable: $1"
}

hash_stream() {
  sha256sum | awk '{print $1}'
}

emit_file_identity() {
  local file="$1"
  local relative digest

  [ -f "$file" ] || die "Required fingerprint input is missing: $file"
  relative="${file#"$ROOT/"}"
  digest="$(sha256sum "$file")"
  digest="${digest%% *}"
  printf 'file\0%s\0sha256\0%s\0' "$relative" "$digest"
}

dependency_files() {
  local relative

  for relative in package.json pnpm-lock.yaml pnpm-workspace.yaml; do
    [ -f "$ROOT/$relative" ] || die "Required dependency input is missing: $relative"
    printf '%s\n' "$ROOT/$relative"
  done

  find "$ROOT/apps" "$ROOT/packages" \
    -mindepth 2 -maxdepth 2 -type f -name package.json -print |
    LC_ALL=C sort
}

dependency_fingerprint() {
  {
    printf 'format\0klicker-dependencies-v1\0'
    while IFS= read -r file; do
      emit_file_identity "$file"
    done < <(dependency_files)
  } | hash_stream
}

git_head() {
  if [ -n "${KLICKER_DEV_RUNTIME_GIT_HEAD:-}" ]; then
    printf '%s\n' "$KLICKER_DEV_RUNTIME_GIT_HEAD"
    return
  fi

  git -C "$ROOT" rev-parse HEAD
}

next_structure_paths() {
  local app route_root

  for app in "${NEXT_APPS[@]}"; do
    for route_root in "$ROOT/apps/$app/src/app" "$ROOT/apps/$app/src/pages"; do
      [ -d "$route_root" ] || continue
      find "$route_root" -type f -print
    done
  done | LC_ALL=C sort
}

next_configuration_files() {
  local app app_root

  for app in "${NEXT_APPS[@]}"; do
    app_root="$ROOT/apps/$app"
    find "$app_root" -maxdepth 2 -type f \
      \( -name 'next.config.*' -o -name 'package.json' -o \
      -name 'tsconfig*.json' -o -name 'proxy.*' -o -name 'middleware.*' \) \
      -print
  done | LC_ALL=C sort -u
}

runtime_fingerprint() {
  local head path

  head="$(git_head)"
  [[ "$head" =~ ^[a-fA-F0-9]{40,64}$ ]] || die "Git HEAD is not a commit digest."

  {
    printf 'format\0klicker-dev-runtime-v1\0'
    printf 'git-head\0%s\0' "$head"
    printf 'dependencies\0%s\0' "$(dependency_fingerprint)"
    printf 'node\0%s\0' "$(node --version)"
    printf 'pnpm\0%s\0' "$(pnpm --version)"
    emit_file_identity "$SCRIPT_PATH"
    while IFS= read -r path; do
      printf 'route-path\0%s\0' "${path#"$ROOT/"}"
    done < <(next_structure_paths)
    while IFS= read -r path; do
      emit_file_identity "$path"
    done < <(next_configuration_files)
  } | hash_stream
}

write_atomic() {
  local path="$1"
  local value="$2"
  local temporary

  mkdir -p "$(dirname "$path")"
  temporary="$(mktemp "${path}.tmp.XXXXXX")"
  printf '%s\n' "$value" >"$temporary"
  mv "$temporary" "$path"
}

read_generation() {
  local generation=0

  if [ -f "$GENERATION_FILE" ]; then
    IFS= read -r generation <"$GENERATION_FILE" || true
  fi
  [[ "$generation" =~ ^[0-9]+$ ]] || die "Runtime generation is invalid."
  printf '%s\n' "$generation"
}

valid_next_app() {
  local candidate="$1"
  local app

  for app in "${NEXT_APPS[@]}"; do
    [ "$candidate" = "$app" ] && return 0
  done
  return 1
}

probe_url() {
  case "$1" in
    auth) echo 'http://localhost:3010/' ;;
    chat) echo "$CHAT_PROBE_URL" ;;
    frontend-control) echo 'http://localhost:3003/login' ;;
    frontend-manage) echo 'http://localhost:3002/login' ;;
    frontend-pwa) echo 'http://localhost:3001/login' ;;
    *) return 1 ;;
  esac
}

# Chat proves its nested dynamic API route graph through the authentication
# contract above. The other apps prove their static route table through a
# committed shell page that renders HTML without database content, so a 404
# there can never be a legitimate data-driven miss.
probe_mode() {
  case "$1" in
    chat) echo 'auth-json' ;;
    auth | frontend-control | frontend-manage | frontend-pwa)
      echo 'html-shell'
      ;;
    *) return 1 ;;
  esac
}

request_repair() {
  local app="$1" generation pending updated

  valid_next_app "$app" || die "Unsupported Next.js repair target: $app"
  require_tool flock
  mkdir -p "$STATE_DIR"
  exec 9>"$STATE_DIR/lock"
  flock -w 10 9 || die "Timed out waiting for the runtime-state lock."

  generation="$(read_generation)"
  updated="$app"
  if [ -s "$REPAIR_REQUEST_FILE" ]; then
    while IFS= read -r pending; do
      valid_next_app "$pending" ||
        die "Invalid pending repair target: $pending."
      [ "$pending" = "$app" ] || updated="$updated"$'\n'"$pending"
    done <"$REPAIR_REQUEST_FILE"
  fi
  write_atomic "$REPAIR_REQUEST_FILE" "$updated"
  write_atomic "$GENERATION_FILE" "$((generation + 1))"
  echo "[dev-runtime] Requested one full .next repair for $app."
}

stamp_dependencies() {
  mkdir -p "$ROOT/node_modules"
  write_atomic "$DEPENDENCY_STAMP_FILE" "$(dependency_fingerprint)"
}

ensure_dependencies() {
  local current expected=""

  current="$(dependency_fingerprint)"
  if [ -f "$DEPENDENCY_STAMP_FILE" ]; then
    IFS= read -r expected <"$DEPENDENCY_STAMP_FILE" || true
  fi

  if [ "$current" = "$expected" ]; then
    echo '[dev-runtime] Dependency volume matches the current workspace.'
    return
  fi

  echo '[dev-runtime] Dependency inputs changed; running frozen pnpm install.'
  (cd "$ROOT" && pnpm install --frozen-lockfile --prefer-offline)
  write_atomic "$DEPENDENCY_STAMP_FILE" "$current"
}

remove_next_dir() {
  local target="$1"
  local allowed=false app next_dir

  for app in "${NEXT_APPS[@]}"; do
    next_dir="$ROOT/apps/$app/.next"
    if [ "$target" = "$next_dir" ] || [ "$target" = "$next_dir/dev" ]; then
      allowed=true
      [ ! -L "$next_dir" ] || die "Refusing symlinked Next.js cache: $next_dir"
      [ ! -L "$target" ] || die "Refusing symlinked Next.js cache: $target"
      break
    fi
  done

  [ "$allowed" = true ] || die "Refusing unexpected cache target: $target"
  [ -e "$target" ] || return 0
  rm -rf -- "$target"
  echo "[dev-runtime] Removed generated cache: ${target#"$ROOT/"}"
}

apply_cache_policy() {
  local app repair_target

  for app in "${NEXT_APPS[@]}"; do
    remove_next_dir "$ROOT/apps/$app/.next/dev"
  done

  if [ -f "$REPAIR_REQUEST_FILE" ]; then
    while IFS= read -r repair_target; do
      valid_next_app "$repair_target" ||
        die "Invalid pending repair target: $repair_target."
      remove_next_dir "$ROOT/apps/$repair_target/.next"
    done <"$REPAIR_REQUEST_FILE"
    rm -f "$REPAIR_REQUEST_FILE"
  fi
}

classify_response() {
  local mode="$1" status="$2"
  local content_type="${3,,}"

  if [ "$mode" = 'auth-json' ]; then
    if [ "$status" = '401' ] && [[ "$content_type" == application/json* ]]; then
      echo "ready: HTTP $status $content_type"
      return 0
    fi
  elif [ "$mode" = 'html-shell' ]; then
    if [[ "$status" =~ ^[23][0-9][0-9]$ ]] &&
      [[ "$content_type" == text/html* ]]; then
      echo "ready: HTTP $status $content_type"
      return 0
    fi
    # Next.js redirect responses often have no body and no content-type; the
    # redirect itself proves the committed shell route resolved.
    if [[ "$status" =~ ^3[0-9][0-9]$ ]]; then
      echo "ready: HTTP $status redirect"
      return 0
    fi
  else
    die "Unknown probe mode: $mode."
  fi

  if [ "$status" = '404' ] && [[ "$content_type" == text/html* ]]; then
    echo "stale: HTTP $status $content_type"
    return "$STALE_STATUS"
  fi
  echo "unexpected: HTTP $status ${content_type:-unknown-content-type}"
  return "$UNEXPECTED_STATUS"
}

probe_app() {
  local app="$1" mode url response status content_type

  mode="$(probe_mode "$app")" || die "No probe contract is defined for: $app"
  url="$(probe_url "$app")" || die "No probe URL is defined for: $app"
  require_tool curl
  if ! response="$(curl --silent --show-error --output /dev/null \
    --write-out $'%{http_code}\t%{content_type}' \
    --connect-timeout 2 --max-time 15 --noproxy '*' \
    "$url" 2>/dev/null)"; then
    echo "waiting: $app is not accepting connections"
    return "$WAITING_STATUS"
  fi

  status="${response%%$'\t'*}"
  content_type="${response#*$'\t'}"
  classify_response "$mode" "$status" "$content_type"
}

wait_for_app() {
  local app="$1"
  local attempt observation status=0 last_observation=''
  local stale_count=0 unexpected_count=0

  require_tool sleep
  echo "[dev-runtime] Waiting for the $app readiness contract..."
  for ((attempt = 1; attempt <= 90; attempt++)); do
    status=0
    observation="$(probe_app "$app")" || status=$?
    if [ "$observation" != "$last_observation" ]; then
      echo "[dev-runtime] $observation"
      last_observation="$observation"
    fi

    case "$status" in
      0)
        echo "[dev-runtime] $app readiness contract is satisfied."
        return 0
        ;;
      "$STALE_STATUS")
        stale_count=$((stale_count + 1))
        unexpected_count=0
        ;;
      "$WAITING_STATUS")
        stale_count=0
        unexpected_count=0
        ;;
      "$UNEXPECTED_STATUS")
        stale_count=0
        unexpected_count=$((unexpected_count + 1))
        ;;
      *)
        die "$app probe returned unsupported status $status."
        ;;
    esac

    if [ "$attempt" -ge 10 ] && [ "$stale_count" -ge 5 ]; then
      echo "[dev-runtime] Confirmed stale $app route state." >&2
      return "$STALE_STATUS"
    fi
    if [ "$attempt" -ge 10 ] && [ "$unexpected_count" -ge 3 ]; then
      echo "[dev-runtime] $app returned a stable unexpected response; no cache was removed." >&2
      return "$UNEXPECTED_STATUS"
    fi
    [ "$attempt" -eq 90 ] || sleep 1
  done

  echo "[dev-runtime] $app did not satisfy its readiness contract within 90 seconds." >&2
  return 1
}

doctor() {
  local app observation status=0 unhealthy=0
  local any_stale=false any_unexpected=false

  for app in "${NEXT_APPS[@]}"; do
    status=0
    observation="$(probe_app "$app")" || status=$?
    if [ "$status" -eq 0 ]; then
      echo "[dev-runtime] $app healthy: $observation"
      continue
    fi

    unhealthy=1
    echo "[dev-runtime] ERROR: $app unhealthy: $observation" >&2
    if [ "$status" -eq "$STALE_STATUS" ]; then
      any_stale=true
    else
      any_unexpected=true
    fi
  done

  if [ "$any_stale" = true ]; then
    echo '[dev-runtime] Run devrouter ensure . on the host to apply the bounded repair.' >&2
  fi
  if [ "$any_unexpected" = true ]; then
    echo '[dev-runtime] No cache was removed. Inspect /tmp/dev.log for the application failure.' >&2
  fi
  return "$unhealthy"
}

start_runtime() {
  local expected_fingerprint="$1"
  local expected_generation="$2"
  shift 2

  [ "${1:-}" = '--' ] || die "start requires -- before the runtime command."
  shift
  [ "$#" -gt 0 ] || die "start requires a runtime command."
  [[ "$expected_fingerprint" =~ ^[a-fA-F0-9]{64}$ ]] ||
    die "Expected runtime fingerprint is invalid."
  [[ "$expected_generation" =~ ^[0-9]+$ ]] ||
    die "Expected runtime generation is invalid."
  [ "$expected_fingerprint" = "$(runtime_fingerprint)" ] ||
    die "Runtime inputs changed before process start; rerun devrouter ensure."
  [ "$expected_generation" = "$(read_generation)" ] ||
    die "Runtime generation changed before process start; rerun devrouter ensure."

  ensure_dependencies
  apply_cache_policy
  exec "$@"
}

usage() {
  cat <<'EOF'
Usage:
  util/dev-runtime.sh fingerprint
  util/dev-runtime.sh dependency-fingerprint
  util/dev-runtime.sh generation
  util/dev-runtime.sh stamp-dependencies
  util/dev-runtime.sh ensure-dependencies
  util/dev-runtime.sh request-repair <next-app>
  util/dev-runtime.sh start <fingerprint> <generation> -- <command> [args...]
  util/dev-runtime.sh classify-response <auth-json|html-shell> <status> <content-type>
  util/dev-runtime.sh probe-app <next-app>
  util/dev-runtime.sh wait-app <next-app>
  util/dev-runtime.sh doctor
EOF
}

main() {
  require_tool sha256sum
  require_tool awk
  require_tool find
  require_tool sort
  require_tool mktemp

  case "${1:-}" in
    fingerprint)
      runtime_fingerprint
      ;;
    dependency-fingerprint)
      dependency_fingerprint
      ;;
    generation)
      read_generation
      ;;
    stamp-dependencies)
      stamp_dependencies
      ;;
    ensure-dependencies)
      ensure_dependencies
      ;;
    request-repair)
      [ "$#" -eq 2 ] || die "request-repair requires one app name."
      request_repair "$2"
      ;;
    start)
      [ "$#" -ge 5 ] || die "start requires identity and a command."
      shift
      start_runtime "$@"
      ;;
    classify-response)
      [ "$#" -eq 4 ] || die "classify-response requires mode, status, and content type."
      classify_response "$2" "$3" "$4"
      ;;
    probe-app)
      [ "$#" -eq 2 ] || die "probe-app requires one app name."
      probe_app "$2"
      ;;
    wait-app)
      [ "$#" -eq 2 ] || die "wait-app requires one app name."
      wait_for_app "$2"
      ;;
    doctor)
      [ "$#" -eq 1 ] || die "doctor takes no arguments."
      doctor
      ;;
    --help|-h)
      usage
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
