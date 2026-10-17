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
  TEMP_DIR=$(cd "$TEMP_DIR" && pwd -P)
  telemetry_hook="${TEMP_DIR}/telemetry"
  started_hook="${TEMP_DIR}/started"
  completed_hook="${TEMP_DIR}/completed"
  render_telemetry_script >"$telemetry_hook"
  render_hook started >"$started_hook"
  render_hook completed >"$completed_hook"
  shellcheck "$telemetry_hook" "$started_hook" "$completed_hook"

  local unit policy bootstrap_unit mount profile
  unit="${TEMP_DIR}/runner.service"
  render_runner_service public-pr-arm64-05 '' >"$unit"
  policy=$(awk -F= '/^(Restart|RestartSec|StartLimitIntervalSec|StartLimitBurst|OOMPolicy)=/ {print}' "$unit")
  [[ "$policy" == $'StartLimitIntervalSec=600\nStartLimitBurst=3\nRestart=on-failure\nRestartSec=60\nOOMPolicy=stop' ]] ||
    fail 'managed service does not bound recovery after an OOM failure'
  bootstrap_unit=$(bash -c '
    source "$1"
    PROFILE=public-pr
    RUNNER_DIR=/opt/actions-runner/public-pr-arm64-05
    render_runner_service "" actions.runner.uzh-bf.public-pr-arm64-05.service
  ' bash "${SCRIPT_DIR}/provision-hetzner-arm64-runner.sh")
  [[ "$bootstrap_unit" == "$(cat "$unit")" ]] || fail 'provisioning and reconciliation unit policies differ'
  for mount in '' /mnt/HC_Volume_fixture; do
    for profile in public-pr trusted; do
      bootstrap_unit=$(bash -c '
        source "$1"
        PROFILE=$2
        RUNNER_DIR=/opt/actions-runner/public-pr-arm64-05
        render_runner_service "$3" actions.runner.uzh-bf.public-pr-arm64-05.service
      ' bash "${SCRIPT_DIR}/provision-hetzner-arm64-runner.sh" "$profile" "${mount:+RequiresMountsFor=$mount}")
      policy=current
      [[ "$profile" != 'trusted' ]] || policy=legacy
      [[ "$bootstrap_unit" == "$(render_runner_service public-pr-arm64-05 "$mount" "$policy")" ]] ||
        fail 'bootstrap changed a trusted unit or lost the managed mount requirement'
    done
  done
  # These command and filesystem adapters are consumed by the sourced reconciler.
  # shellcheck disable=SC2329,SC2034
  (
    EXPECTED_NAMES=(public-pr-arm64-05 public-pr-arm64-06 public-pr-arm64-07)
    readonly fixture_dir="${TEMP_DIR}/services"
    mkdir "$fixture_dir"
    runner_unit_path() { printf '%s/%s.service\n' "$fixture_dir" "$1"; }
    runner_service_mount() { printf ''; }
    stat() {
      [[ "$1" == '-c' && "$2" == '%U:%G:%a' ]] || return 2
      printf 'root:root:644\n'
    }
    systemctl() {
      local name=${2:-}
      name=${name#actions.runner.uzh-bf.}
      name=${name%.service}
      case "$1" in
        show)
          case "$4" in
            FragmentPath) runner_unit_path "$name" ;;
            DropInPaths)
              [[ "${fixture_show_failure:-0}" != '1' ]] || return 1
              printf '%s' "${fixture_drop_in:-}" ;;
            ActiveState)
              case "$name" in
                *05) printf active ;;
                *06) printf '%s' "${fixture_held_state:-inactive}" ;;
                *07) printf failed ;;
                *) return 2 ;;
              esac ;;
            UnitFileState)
              if [[ "$name" == *06 ]]; then printf disabled; else printf enabled; fi ;;
            *) return 2 ;;
          esac ;;
        daemon-reload | restart) printf '%s\n' "$*" >>"${fixture_dir}/commands" ;;
        is-active) [[ "$3" == *05.service ]] ;;
        *) return 2 ;;
      esac
    }
    pgrep() { [[ "${fixture_busy:-0}" == '1' ]]; }
    write_file_from_stdin() { cat >"$4"; }
    for name in "${EXPECTED_NAMES[@]}"; do
      render_runner_service "$name" '' legacy >"$(runner_unit_path "$name")"
    done
    capture_runner_service_states
    configure_runner_services
    for name in "${EXPECTED_NAMES[@]}"; do
      cmp -s "$(runner_unit_path "$name")" <(render_runner_service "$name" '') ||
        fail 'reconciliation did not converge the legacy service policy'
    done
    [[ "$(cat "${fixture_dir}/commands")" == 'daemon-reload' ]] ||
      fail 'unit policy reconciliation changed runner activation'
    : >"${fixture_dir}/commands"
    configure_runner_services
    [[ ! -s "${fixture_dir}/commands" ]] || fail 'service-policy reconciliation is not idempotent'

    RUNNER_ENV_CHANGED_NAMES=("${EXPECTED_NAMES[@]}")
    restart_runners
    [[ "$(cat "${fixture_dir}/commands")" == $'daemon-reload\nrestart actions.runner.uzh-bf.public-pr-arm64-05.service' ]] ||
      fail 'hook reconciliation restarted an inactive or disabled service'
    : >"${fixture_dir}/commands"
    RUNNER_ENV_CHANGED_NAMES=(public-pr-arm64-06)
    restart_runners
    [[ "$(cat "${fixture_dir}/commands")" == 'daemon-reload' ]] ||
      fail 'unchanged active service was restarted'

    render_runner_service public-pr-arm64-05 '' legacy >"$(runner_unit_path public-pr-arm64-05)"
    : >"${fixture_dir}/commands"
    fixture_busy=1
    if (configure_runner_services) >/dev/null 2>&1; then fail 'busy host accepted a unit mutation'; fi
    [[ ! -s "${fixture_dir}/commands" ]] || fail 'busy host ran a systemd mutation'
    cmp -s "$(runner_unit_path public-pr-arm64-05)" <(render_runner_service public-pr-arm64-05 '' legacy) ||
      fail 'busy host rewrote a unit'
    fixture_busy=0
    fixture_held_state=active
    if (configure_runner_services) >/dev/null 2>&1; then fail 'changed activation state was accepted'; fi
    fixture_held_state=activating
    if (capture_runner_service_states) >/dev/null 2>&1; then fail 'transitional service state was accepted'; fi
    fixture_held_state=inactive
    fixture_drop_in=/unmanaged/policy.conf
    if (configure_runner_services) >/dev/null 2>&1; then fail 'unmanaged drop-in was accepted'; fi
    fixture_drop_in=''
    fixture_show_failure=1
    if (configure_runner_services) >/dev/null 2>&1; then fail 'unreadable unit properties were accepted'; fi
    fixture_show_failure=0
    printf '\nEnvironment=UNRECOGNIZED\n' >>"$(runner_unit_path public-pr-arm64-05)"
    if (configure_runner_services) >/dev/null 2>&1; then fail 'unknown unit policy was accepted'; fi
    [[ ! -s "${fixture_dir}/commands" ]] || fail 'refused mutation changed systemd state'
  )
  [[ "$START_HOOK" == *.sh && "$COMPLETE_HOOK" == *.sh ]] ||
    fail 'job hooks must use a runner-recognized script extension'
  grep -Fq 'job-started.sh' <<<"$START_HOOK" || fail 'started hook path differs'
  grep -Fq 'job-completed.sh' <<<"$COMPLETE_HOOK" || fail 'completed hook path differs'
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

  ln -s "${TEMP_DIR}/existing.env" "${TEMP_DIR}/symlink.env"
  ln "${TEMP_DIR}/existing.env" "${TEMP_DIR}/hardlink.env"
  mkfifo "${TEMP_DIR}/fifo.env"
  ln -s "$TEMP_DIR" "${TEMP_DIR}/alias"
  local unsafe_path
  for unsafe_path in symlink.env hardlink.env fifo.env alias/current.env; do
    if render_runner_env "${TEMP_DIR}/${unsafe_path}" >"${TEMP_DIR}/rejected.out" 2>/dev/null; then
      fail "unsafe environment accepted: ${unsafe_path}"
    fi
    [[ ! -s "${TEMP_DIR}/rejected.out" ]] || fail 'unsafe input exposed environment contents'
  done

  if grep -Eq 'docker (system prune|volume prune)|config\.sh remove|svc\.sh uninstall|userdel|rm -rf' "$HOST_SCRIPT"; then
    fail 'host reconciler contains a forbidden destructive operation'
  fi
  [[ "${#PREPULL_IMAGES[@]}" == '4' ]] || fail 'pre-pull image set differs'
  printf 'PASS: runner host reconciliation\n'
}

main "$@"
