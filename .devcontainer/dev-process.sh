#!/usr/bin/env bash
set -euo pipefail

klicker_process_alive() {
  local state

  kill -0 "$1" 2>/dev/null || return 1
  state="$(ps -o stat= -p "$1" 2>/dev/null | tr -d ' ')"
  [[ "$state" != Z* ]]
}

klicker_process_owned() {
  local pid="$1"
  local pgid="$2"
  local fingerprint="$3"
  local actual_pgid

  [ -r "/proc/$pid/environ" ] || return 1
  actual_pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')"
  [ "$actual_pgid" = "$pgid" ] || return 1
  [ "$pgid" = "$pid" ] || return 1
  tr '\0' '\n' <"/proc/$pid/environ" | grep -Fqx "KLICKER_DEV_PROCESS_MARKER=$fingerprint"
}

klicker_process_group_alive() {
  local pgid="$1"

  ps -eo pgid=,stat= | awk -v expected="$pgid" '
    $1 == expected && $2 !~ /^Z/ { found = 1 }
    END { exit(found ? 0 : 1) }
  '
}

klicker_dev_runtime_healthy() {
  local health_urls="${KLICKER_DEV_HEALTH_URLS:-}"
  local attempts="${KLICKER_DEV_HEALTH_ATTEMPTS:-2}"
  local attempt
  local status
  local url
  local healthy

  [ -z "$health_urls" ] && return 0

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    healthy=true
    for url in $health_urls; do
      status="$(curl -sS -o /dev/null --connect-timeout 1 --max-time 3 -w '%{http_code}' -- "$url" 2>/dev/null || true)"
      if ! [[ "$status" =~ ^[1-4][0-9][0-9]$ ]]; then
        healthy=false
        break
      fi
    done
    [ "$healthy" = true ] && return 0
    [ "$attempt" -lt "$attempts" ] && sleep 1
  done

  return 1
}

klicker_stop_process_group() {
  local pid="$1"
  local pgid="$2"
  local term_timeout="${KLICKER_DEV_TERM_TIMEOUT_SECONDS:-15}"
  local kill_timeout="${KLICKER_DEV_KILL_TIMEOUT_SECONDS:-5}"
  local attempt

  kill -TERM -- "-$pgid" 2>/dev/null || true
  for ((attempt = 1; attempt <= term_timeout; attempt += 1)); do
    if ! klicker_process_group_alive "$pgid"; then
      wait "$pid" 2>/dev/null || true
      return 0
    fi
    sleep 1
  done

  kill -KILL -- "-$pgid" 2>/dev/null || true
  for ((attempt = 1; attempt <= kill_timeout; attempt += 1)); do
    if ! klicker_process_group_alive "$pgid"; then
      wait "$pid" 2>/dev/null || true
      return 0
    fi
    sleep 1
  done

  echo "[post-start] Could not stop owned dev process group $pgid." >&2
  return 1
}

klicker_reconcile_dev_process() (
  local command="$1"
  local fingerprint="$2"
  local state_file="${KLICKER_DEV_STATE_FILE:-/tmp/klicker-dev-process.state}"
  local log_file="${KLICKER_DEV_LOG_FILE:-/tmp/dev.log}"
  local process_pattern="${KLICKER_DEV_PROCESS_PATTERN:-turbo run dev}"
  local lock_file="${state_file}.lock"
  local pid=""
  local pgid=""
  local stored_fingerprint=""
  local extra=""
  local attempt

  mkdir -p "$(dirname "$state_file")" "$(dirname "$log_file")"
  exec 9>"$lock_file"
  if ! /usr/bin/flock -w 30 9; then
    echo "[post-start] Timed out waiting for dev-process reconciliation lock." >&2
    return 1
  fi

  if [ -f "$state_file" ]; then
    read -r pid pgid stored_fingerprint extra <"$state_file" || true
    if ! [[ "$pid" =~ ^[1-9][0-9]*$ ]] ||
      ! [[ "$pgid" =~ ^[1-9][0-9]*$ ]] ||
      [ -n "$extra" ]; then
      if pgrep -f -- "$process_pattern" >/dev/null 2>&1; then
        echo "[post-start] Invalid dev-process state while an unowned process is running; refusing to start or kill it." >&2
        return 1
      fi
      rm -f "$state_file"
    elif klicker_process_alive "$pid"; then
      if ! klicker_process_owned "$pid" "$pgid" "$stored_fingerprint"; then
        echo "[post-start] Dev-process state points at an unowned process; refusing to kill it." >&2
        return 1
      fi
      if [ "$stored_fingerprint" = "$fingerprint" ] && klicker_dev_runtime_healthy; then
        echo "[post-start] Owned dev servers already match this runtime (PID $pid)."
        return 0
      fi

      if [ "$stored_fingerprint" = "$fingerprint" ]; then
        echo "[post-start] Owned dev runtime is unhealthy; restarting process group $pgid."
      else
        echo "[post-start] Runtime identity changed; restarting owned dev process group $pgid."
      fi
      klicker_stop_process_group "$pid" "$pgid"
      rm -f "$state_file"
    else
      rm -f "$state_file"
    fi
  fi

  if pgrep -f -- "$process_pattern" >/dev/null 2>&1; then
    echo "[post-start] Found an unowned dev process; refusing to start a duplicate or kill it." >&2
    return 1
  fi

  echo "[post-start] Starting owned dev servers (logs: $log_file)..."
  env KLICKER_DEV_PROCESS_MARKER="$fingerprint" \
    setsid bash -c "$command" 9>&- >"$log_file" 2>&1 </dev/null &
  pid=$!
  pgid="$pid"

  for ((attempt = 1; attempt <= 10; attempt += 1)); do
    if klicker_process_owned "$pid" "$pgid" "$fingerprint"; then
      printf '%s %s %s\n' "$pid" "$pgid" "$fingerprint" >"${state_file}.tmp.${BASHPID}"
      mv "${state_file}.tmp.${BASHPID}" "$state_file"
      echo "[post-start] Owned dev process group started (PID $pid)."
      return 0
    fi
    if ! klicker_process_alive "$pid"; then
      echo "[post-start] Dev process exited during startup; see $log_file." >&2
      return 1
    fi
    sleep 1
  done

  klicker_stop_process_group "$pid" "$pgid" || true
  echo "[post-start] Could not verify ownership of the new dev process; stopped it." >&2
  return 1
)
