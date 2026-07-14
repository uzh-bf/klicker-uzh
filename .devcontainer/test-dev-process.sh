#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
. .devcontainer/dev-process.sh

test_dir="$(mktemp -d)"
state_file="$test_dir/state"
log_file="$test_dir/log"
pattern="klicker-dev-process-test-$$"
managed_pid=""
foreign_pid=""

cleanup() {
  [ -n "$managed_pid" ] && kill -KILL -- "-$managed_pid" 2>/dev/null || true
  [ -n "$foreign_pid" ] && kill -KILL -- "-$foreign_pid" 2>/dev/null || true
  [ -n "$foreign_pid" ] && wait "$foreign_pid" 2>/dev/null || true
  rm -rf "$test_dir"
}
trap cleanup EXIT

export KLICKER_DEV_STATE_FILE="$state_file"
export KLICKER_DEV_LOG_FILE="$log_file"
export KLICKER_DEV_PROCESS_PATTERN="$pattern"
export KLICKER_DEV_TERM_TIMEOUT_SECONDS=1
export KLICKER_DEV_KILL_TIMEOUT_SECONDS=2

stop_managed_for_test() {
  local pgid="$1"
  local attempt

  kill -KILL -- "-$pgid" 2>/dev/null || true
  for ((attempt = 1; attempt <= 20; attempt += 1)); do
    klicker_process_group_alive "$pgid" || return 0
    sleep 0.1
  done
  echo "test process group $pgid did not stop" >&2
  return 1
}

command="exec -a $pattern sleep 300"
klicker_reconcile_dev_process "$command" "100-1" &
first_reconcile=$!
klicker_reconcile_dev_process "$command" "100-1" &
second_reconcile=$!
wait "$first_reconcile"
wait "$second_reconcile"
read -r first_pid _ _ <"$state_file"
managed_pid="$first_pid"
[ "$(pgrep -fc -- "$pattern")" = "1" ]

klicker_reconcile_dev_process "$command" "100-1"
read -r matching_pid matching_pgid matching_fingerprint <"$state_file"
[ "$matching_pid" = "$first_pid" ]

printf '%s %s\n' "$matching_pid" "$matching_pgid" >"$state_file"
if klicker_reconcile_dev_process "$command" "100-1" 2>"$test_dir/missing-fingerprint.err"; then
  echo "state without a fingerprint was incorrectly accepted" >&2
  exit 1
fi
grep -Fq "Invalid dev-process state while an unowned process is running" "$test_dir/missing-fingerprint.err"
kill -0 "$matching_pid"
printf '%s %s %s\n' "$matching_pid" "$matching_pgid" "$matching_fingerprint" >"$state_file"

export KLICKER_DEV_HEALTH_URLS=http://127.0.0.1:1
export KLICKER_DEV_HEALTH_ATTEMPTS=1
klicker_reconcile_dev_process "$command" "100-1"
read -r recovered_pid _ _ <"$state_file"
[ "$recovered_pid" != "$first_pid" ]
if klicker_process_alive "$first_pid"; then
  echo "unhealthy owned process group survived reconciliation" >&2
  exit 1
fi
managed_pid="$recovered_pid"
first_pid="$recovered_pid"
unset KLICKER_DEV_HEALTH_URLS KLICKER_DEV_HEALTH_ATTEMPTS

klicker_reconcile_dev_process "$command" "200-1"
read -r changed_pid _ _ <"$state_file"
[ "$changed_pid" != "$first_pid" ]
if klicker_process_alive "$first_pid"; then
  echo "old process group survived a fingerprint change" >&2
  exit 1
fi
managed_pid="$changed_pid"

stop_managed_for_test "$managed_pid"
printf '999999 999999 200-1\n' >"$state_file"
klicker_reconcile_dev_process "$command" "300-1"
read -r stale_replacement_pid _ _ <"$state_file"
[ "$stale_replacement_pid" != "999999" ]
managed_pid="$stale_replacement_pid"

term_ignoring_command="trap 'exit 0' TERM; bash -c 'trap \"\" TERM; exec -a $pattern sleep 300' & wait"
klicker_reconcile_dev_process "$term_ignoring_command" "350-1"
read -r term_ignoring_pid _ _ <"$state_file"
managed_pid="$term_ignoring_pid"
klicker_reconcile_dev_process "$command" "360-1"
if klicker_process_group_alive "$term_ignoring_pid"; then
  echo "TERM-ignoring child survived process-group replacement" >&2
  exit 1
fi
read -r managed_pid _ _ <"$state_file"

stop_managed_for_test "$managed_pid"
managed_pid=""
rm -f "$state_file"

setsid bash -c "exec -a $pattern sleep 300" >/dev/null 2>&1 </dev/null &
foreign_pid=$!
printf '%s %s %s\n' "$foreign_pid" "$foreign_pid" "400-1" >"$state_file"
if klicker_reconcile_dev_process "$command" "400-1"; then
  echo "foreign process was incorrectly accepted" >&2
  exit 1
fi
kill -0 "$foreign_pid"

echo "dev-process reconciliation tests passed"
