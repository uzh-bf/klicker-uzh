#!/usr/bin/env bash
# Restarts the local LTI service with environment overrides, or restores it.
# Run inside the devcontainer:
#   devrouter exec . -- bash playwright/lti-harness/restart-lti.sh LTI_DEV_MODE=false
#   devrouter exec . -- bash playwright/lti-harness/restart-lti.sh
#
# The dev stack runs the service under nodemon with the container environment.
# With NAME=value arguments, this stops that process and starts the same
# command with the same environment plus the overrides; nodemon then waits for
# a file change. Overrides always apply to the original environment, not to
# an earlier override. Without arguments, it stops any override and touches the
# build output, so nodemon restarts the original process.
set -euo pipefail

for override in "$@"; do
  if [[ ! "$override" =~ ^[A-Z][A-Z0-9_]*=.*$ ]]; then
    echo "usage: $0 [NAME=value ...]" >&2
    exit 2
  fi
done

lti_dir="$(cd "$(dirname "$0")/../.." && pwd)/apps/lti"
override_log=/tmp/lti-override.log

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

# nodemon keeps the original container environment, also while an override
# runs, so overrides always start from that environment
nodemon_pid=""
for pid in $(pgrep -f 'nodemon.js -w dist/ --exec node ./dist/index.js' || true); do
  if [[ "$(readlink "/proc/$pid/cwd")" == "$lti_dir" ]]; then nodemon_pid="$pid"; fi
done
pids="$(lti_pids)"
if [[ -z "$nodemon_pid" || -z "$pids" ]]; then
  echo "no running LTI service found in $lti_dir" >&2
  exit 1
fi

if [[ $# -gt 0 ]]; then
  mapfile -d '' -t environment <"/proc/$nodemon_pid/environ"
  # shellcheck disable=SC2086 # one pid per word
  kill $pids
  while [[ -n "$(lti_pids)" ]]; do sleep 0.2; done
  cd "$lti_dir"
  # setsid detaches the override from this shell, so it outlives the exec;
  # env applies the overrides after the copied environment
  setsid env -i "${environment[@]}" "$@" node ./dist/index.js \
    >"$override_log" 2>&1 </dev/null &
else
  # shellcheck disable=SC2086 # one pid per word
  kill $pids
  while [[ -n "$(lti_pids)" ]]; do sleep 0.2; done
  touch "$lti_dir/dist/index.js"
fi

wait_for_port
pid="$(lti_pids | head -n 1)"
echo "LTI service pid $pid runs with:"
tr '\0' '\n' <"/proc/$pid/environ" | grep -E '^LTI_' | grep -vE 'PASS|KEY=' | sort
