#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
readonly SCRIPT_DIR
readonly HOST_SCRIPT="${SCRIPT_DIR}/reconcile-hetzner-arm64-runner-host.sh"
TEMP_DIR=''

cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf -- "$TEMP_DIR"
  fi
}

trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

main() {
  local telemetry_hook started_hook completed_hook rendered_env streamed_help
  bash -n "$HOST_SCRIPT"
  if ! streamed_help=$(bash -s -- --help <"$HOST_SCRIPT" 2>&1); then
    fail "host reconciler cannot run from stdin: ${streamed_help}"
  fi
  grep -Fq 'Reconcile one existing public PR ARM64 runner host.' <<<"$streamed_help" ||
    fail 'stdin execution did not invoke the host reconciler entrypoint'
  # shellcheck disable=SC1090,SC1091
  source "$HOST_SCRIPT"

  set_expected_names a
  [[ "${EXPECTED_NAMES[*]}" == \
    'public-pr-arm64-01 public-pr-arm64-02 public-pr-arm64-03 public-pr-arm64-04' ]] ||
    fail 'host A allocation differs'
  set_expected_names b
  [[ "${EXPECTED_NAMES[*]}" == \
    'public-pr-arm64-05 public-pr-arm64-06 public-pr-arm64-07 public-pr-arm64-08' ]] ||
    fail 'host B allocation differs'

  TEMP_DIR=$(mktemp -d -t runner-host-reconcile-test.XXXXXX)
  telemetry_hook="${TEMP_DIR}/telemetry"
  started_hook="${TEMP_DIR}/started"
  completed_hook="${TEMP_DIR}/completed"
  render_telemetry_script >"$telemetry_hook"
  render_hook started >"$started_hook"
  render_hook completed >"$completed_hook"
  shellcheck "$telemetry_hook" "$started_hook" "$completed_hook"
  grep -Fq '/usr/bin/timeout --signal=KILL 5s' "$started_hook" ||
    fail 'started hook is not bounded'
  grep -Fq "'started'" "$started_hook" || fail 'started hook event differs'
  grep -Fq "'completed'" "$completed_hook" || fail 'completed hook event differs'

  printf '%s\n' \
    'EXISTING_VALUE=preserved' \
    'ACTIONS_RUNNER_HOOK_JOB_STARTED=/old/start' \
    'ACTIONS_RUNNER_HOOK_JOB_COMPLETED=/old/end' >"${TEMP_DIR}/existing.env"
  rendered_env=$(render_runner_env "${TEMP_DIR}/existing.env")
  [[ "$(grep -Fc 'EXISTING_VALUE=preserved' <<<"$rendered_env")" == '1' ]] ||
    fail 'unmanaged runner environment values were not preserved'
  [[ "$(grep -Fc "ACTIONS_RUNNER_HOOK_JOB_STARTED=${START_HOOK}" <<<"$rendered_env")" == '1' ]] ||
    fail 'started hook setting was not replaced exactly once'
  [[ "$(grep -Fc "ACTIONS_RUNNER_HOOK_JOB_COMPLETED=${COMPLETE_HOOK}" <<<"$rendered_env")" == '1' ]] ||
    fail 'completed hook setting was not replaced exactly once'
  printf '%s\n' "$rendered_env" >"${TEMP_DIR}/current.env"
  [[ "$(render_runner_env "${TEMP_DIR}/current.env")" == "$rendered_env" ]] ||
    fail 'runner environment rendering is not idempotent'

  if grep -Eq 'docker (system prune|volume prune)|config\.sh remove|svc\.sh uninstall|userdel|rm -rf' "$HOST_SCRIPT"; then
    fail 'host reconciler contains a forbidden destructive operation'
  fi
  [[ "${#PREPULL_IMAGES[@]}" == '4' ]] || fail 'pre-pull image set differs'
  printf 'PASS: runner host reconciliation\n'
}

main "$@"
