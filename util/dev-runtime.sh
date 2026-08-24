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
CHAT_STALE_STATUS=20
CHAT_WAITING_STATUS=21
CHAT_UNEXPECTED_STATUS=22

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

request_repair() {
  local app="$1"
  local generation

  valid_next_app "$app" || die "Unsupported Next.js repair target: $app"
  require_tool flock
  mkdir -p "$STATE_DIR"
  exec 9>"$STATE_DIR/lock"
  flock -w 10 9 || die "Timed out waiting for the runtime-state lock."

  generation="$(read_generation)"
  write_atomic "$REPAIR_REQUEST_FILE" "$app"
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
  (cd "$ROOT" && pnpm install --frozen-lockfile)
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
  local app repair_target=""

  for app in "${NEXT_APPS[@]}"; do
    remove_next_dir "$ROOT/apps/$app/.next/dev"
  done

  if [ -f "$REPAIR_REQUEST_FILE" ]; then
    IFS= read -r repair_target <"$REPAIR_REQUEST_FILE" || true
    valid_next_app "$repair_target" || die "Invalid pending repair target."
    remove_next_dir "$ROOT/apps/$repair_target/.next"
    rm -f "$REPAIR_REQUEST_FILE"
  fi
}

classify_chat_response() {
  local status="$1"
  local content_type="${2,,}"

  if [ "$status" = '401' ] && [[ "$content_type" == application/json* ]]; then
    echo "ready: HTTP $status $content_type"
    return 0
  fi
  if [ "$status" = '404' ] && [[ "$content_type" == text/html* ]]; then
    echo "stale: HTTP $status $content_type"
    return "$CHAT_STALE_STATUS"
  fi

  echo "unexpected: HTTP $status ${content_type:-unknown-content-type}"
  return "$CHAT_UNEXPECTED_STATUS"
}

probe_chat() {
  local response status content_type

  require_tool curl
  if ! response="$(curl --silent --show-error --output /dev/null \
    --write-out $'%{http_code}\t%{content_type}' \
    --connect-timeout 2 --max-time 15 --noproxy '*' \
    "$CHAT_PROBE_URL" 2>/dev/null)"; then
    echo 'waiting: Chat is not accepting connections'
    return "$CHAT_WAITING_STATUS"
  fi

  status="${response%%$'\t'*}"
  content_type="${response#*$'\t'}"
  classify_chat_response "$status" "$content_type"
}

wait_for_chat() {
  local attempt observation status=0 last_observation=''
  local stale_count=0 unexpected_count=0

  require_tool sleep
  echo '[dev-runtime] Waiting for the Chat route contract...'
  for ((attempt = 1; attempt <= 90; attempt++)); do
    status=0
    observation="$(probe_chat)" || status=$?
    if [ "$observation" != "$last_observation" ]; then
      echo "[dev-runtime] $observation"
      last_observation="$observation"
    fi

    case "$status" in
      0)
        echo '[dev-runtime] Chat route contract is ready.'
        return 0
        ;;
      "$CHAT_STALE_STATUS")
        stale_count=$((stale_count + 1))
        unexpected_count=0
        ;;
      "$CHAT_WAITING_STATUS")
        stale_count=0
        unexpected_count=0
        ;;
      "$CHAT_UNEXPECTED_STATUS")
        stale_count=0
        unexpected_count=$((unexpected_count + 1))
        ;;
      *)
        die "Chat probe returned unsupported status $status."
        ;;
    esac

    if [ "$attempt" -ge 10 ] && [ "$stale_count" -ge 5 ]; then
      echo '[dev-runtime] Confirmed stale Chat route state.' >&2
      return "$CHAT_STALE_STATUS"
    fi
    if [ "$attempt" -ge 10 ] && [ "$unexpected_count" -ge 3 ]; then
      echo '[dev-runtime] Chat returned a stable unexpected response; no cache was removed.' >&2
      return "$CHAT_UNEXPECTED_STATUS"
    fi
    [ "$attempt" -eq 90 ] || sleep 1
  done

  echo '[dev-runtime] Chat did not satisfy its route contract within 90 seconds.' >&2
  return 1
}

doctor_chat() {
  local observation status=0

  observation="$(probe_chat)" || status=$?
  if [ "$status" -eq 0 ]; then
    echo "[dev-runtime] Chat healthy: $observation"
    return 0
  fi

  echo "[dev-runtime] ERROR: Chat unhealthy: $observation" >&2
  if [ "$status" -eq "$CHAT_STALE_STATUS" ]; then
    echo '[dev-runtime] Run devrouter ensure . on the host to apply the bounded repair.' >&2
  else
    echo '[dev-runtime] No cache was removed. Inspect /tmp/dev.log for the application failure.' >&2
  fi
  return 1
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
  util/dev-runtime.sh classify-chat-response <status> <content-type>
  util/dev-runtime.sh probe-chat
  util/dev-runtime.sh wait-chat
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
    classify-chat-response)
      [ "$#" -eq 3 ] || die "classify-chat-response requires status and content type."
      classify_chat_response "$2" "$3"
      ;;
    probe-chat)
      [ "$#" -eq 1 ] || die "probe-chat takes no arguments."
      probe_chat
      ;;
    wait-chat)
      [ "$#" -eq 1 ] || die "wait-chat takes no arguments."
      wait_for_chat
      ;;
    doctor)
      [ "$#" -eq 1 ] || die "doctor takes no arguments."
      doctor_chat
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
