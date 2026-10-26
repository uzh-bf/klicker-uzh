#!/usr/bin/env bash
# Restarts the local LTI service with LTI_DEV_MODE=<true|false>.
# Run inside the devcontainer:
#   devrouter exec . -- bash playwright/lti-harness/set-lti-dev-mode.sh false
#
# The dev stack runs the service under nodemon with the container environment.
# For `false`, this stops that process and starts the same command with the
# same environment except LTI_DEV_MODE. nodemon then waits for a file change.
# For `true`, it stops the override and touches the build output, so nodemon
# restarts the original process.
set -euo pipefail

mode="${1:-}"
if [[ "$mode" != "true" && "$mode" != "false" ]]; then
  echo "usage: $0 <true|false>" >&2
  exit 2
fi

lti_dir="$(cd "$(dirname "$0")/../.." && pwd)/apps/lti"
override_log=/tmp/lti-dev-mode-override.log

lti_pids() {
  local pid
  for pid in $(pgrep -f '^node ./dist/index.js$' || true); do
    if [[ "$(readlink "/proc/$pid/cwd")" == "$lti_dir" ]]; then
      echo "$pid"
    fi
  done
}

wait_for_port() {
  for _ in $(seq 1 30); do
    if (exec 3<>/dev/tcp/127.0.0.1/4000) 2>/dev/null; then return 0; fi
    sleep 0.5
  done
  echo "LTI service did not listen on port 4000" >&2
  return 1
}

pids="$(lti_pids)"
if [[ -z "$pids" ]]; then
  echo "no running LTI service found in $lti_dir" >&2
  exit 1
fi
source_pid="$(echo "$pids" | head -n 1)"

if [[ "$mode" == "false" ]]; then
  environ="$(mktemp)"
  cp "/proc/$source_pid/environ" "$environ"
  # shellcheck disable=SC2086 # one pid per word
  kill $pids
  while [[ -n "$(lti_pids)" ]]; do sleep 0.2; done
  cd "$lti_dir"
  # setsid detaches the override from this shell, so it outlives the exec
  setsid xargs -0 -a "$environ" sh -c \
    'exec env -i "$@" LTI_DEV_MODE=false node ./dist/index.js' _ \
    >"$override_log" 2>&1 </dev/null &
else
  # shellcheck disable=SC2086 # one pid per word
  kill $pids
  while [[ -n "$(lti_pids)" ]]; do sleep 0.2; done
  touch "$lti_dir/dist/index.js"
fi

wait_for_port
rm -f "${environ:-}"
pid="$(lti_pids | head -n 1)"
echo "LTI service pid $pid runs with $(tr '\0' '\n' <"/proc/$pid/environ" | grep '^LTI_DEV_MODE=' | tail -n 1)"
