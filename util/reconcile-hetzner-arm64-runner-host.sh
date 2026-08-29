#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly RUNNER_USER='github-runner'
readonly RUNNER_BASE_DIR='/opt/actions-runner'
readonly STATE_DIR='/etc/actions-runner-bootstrap'
readonly LOCK_FILE='/run/lock/actions-runner-reconcile.lock'
readonly HOOK_DIR='/usr/local/libexec/actions-runner'
readonly TELEMETRY_SCRIPT="${HOOK_DIR}/telemetry"
readonly START_HOOK="${HOOK_DIR}/job-started"
readonly COMPLETE_HOOK="${HOOK_DIR}/job-completed"
readonly CONFIRMATION='RECONCILE PUBLIC PR RUNNER HOST'
readonly -a PREPULL_IMAGES=(
  'mcr.microsoft.com/playwright:v1.58.2-noble'
  'postgres:15'
  'redis:7'
  'ghcr.io/hatchet-dev/hatchet/hatchet-lite-dev:v0.101.0'
)

MODE=''
HOST_SLOT=''
CURRENT_STAGE='initial validation'
DRIFT_COUNT=0
EXPECTED_NAMES=()

usage() {
  printf '%s\n' \
    'Reconcile one existing public PR ARM64 runner host.' \
    '' \
    'Usage:' \
    '  reconcile-hetzner-arm64-runner-host.sh --check --host-slot a|b' \
    '  reconcile-hetzner-arm64-runner-host.sh --apply --host-slot a|b' \
    '' \
    'Host allocation:' \
    '  a  public-pr-arm64-01 through public-pr-arm64-04' \
    '  b  public-pr-arm64-05 through public-pr-arm64-08' \
    '' \
    '--check validates the host and reports drift without changing persistent' \
    'files or services. --apply installs bounded job telemetry, pre-pulls the' \
    'pinned CI images, updates each runner .env, and restarts the four idle' \
    'runner services. It never resets, removes, or re-registers a runner.'
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '  %s\n' "$*"
}

on_error() {
  local exit_code=$?
  printf '\nReconciliation stopped during: %s\n' "$CURRENT_STAGE" >&2
  printf 'No runner reset or registration change was attempted.\n' >&2
  exit "$exit_code"
}

trap on_error ERR

parse_args() {
  while (($# > 0)); do
    case "$1" in
      --check | --apply)
        [[ -z "$MODE" ]] || die 'select exactly one mode'
        MODE=${1#--}
        shift
        ;;
      --host-slot)
        (($# >= 2)) || die '--host-slot requires a value'
        HOST_SLOT=$2
        shift 2
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        die "unknown option: $1"
        ;;
    esac
  done

  [[ -n "$MODE" ]] || die 'select --check or --apply'
  [[ "$HOST_SLOT" == 'a' || "$HOST_SLOT" == 'b' ]] ||
    die '--host-slot must be a or b'
}

set_expected_names() {
  local slot=$1 first index
  EXPECTED_NAMES=()
  case "$slot" in
    a) first=1 ;;
    b) first=5 ;;
    *) die 'host slot must be a or b' ;;
  esac
  for ((index = first; index < first + 4; index++)); do
    EXPECTED_NAMES+=("$(printf 'public-pr-arm64-%02d' "$index")")
  done
}

state_file_value() {
  local file=$1 key=$2
  awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$file"
}

write_file_from_stdin() {
  local mode=$1 owner=$2 group=$3 destination=$4
  local parent name temporary
  parent=$(dirname -- "$destination")
  name=$(basename -- "$destination")
  [[ -d "$parent" && ! -L "$parent" ]] || die "invalid managed parent: ${parent}"
  temporary=$(mktemp "${parent}/.${name}.XXXXXX")
  if ! cat >"$temporary" ||
    ! chmod "$mode" "$temporary" ||
    ! chown "$owner:$group" "$temporary" ||
    ! mv -Tf -- "$temporary" "$destination"; then
    rm -f -- "$temporary"
    die "could not write managed file: ${destination}"
  fi
}

render_telemetry_script() {
  # These expressions are intentionally emitted for the installed hook.
  # shellcheck disable=SC2016
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    '' \
    'set -Eeuo pipefail' \
    '' \
    'event=${1:-unknown}' \
    'safe() {' \
    '  printf '\''%s'\'' "$1" | LC_ALL=C tr -cd '\''A-Za-z0-9._/@:-'\'' | cut -c1-160' \
    '}' \
    'epoch=$(date +%s)' \
    'load_1m=$(awk '\''{print $1}'\'' /proc/loadavg)' \
    'memory_available_kb=$(awk '\''/^MemAvailable:/ {print $2}'\'' /proc/meminfo)' \
    'docker_disk_percent=$(df -P /var/lib/docker | awk '\''NR == 2 {gsub(/%/, "", $5); print $5}'\'')' \
    '/usr/bin/logger -p user.info -t actions-runner-telemetry -- "event=$(safe "$event") epoch=${epoch} runner=$(safe "${RUNNER_NAME:-unknown}") repository=$(safe "${GITHUB_REPOSITORY:-unknown}") workflow=$(safe "${GITHUB_WORKFLOW:-unknown}") job=$(safe "${GITHUB_JOB:-unknown}") run_id=$(safe "${GITHUB_RUN_ID:-unknown}") attempt=$(safe "${GITHUB_RUN_ATTEMPT:-unknown}") load_1m=${load_1m:-unknown} memory_available_kb=${memory_available_kb:-unknown} docker_disk_percent=${docker_disk_percent:-unknown}"' \
    'exit 0'
}

render_hook() {
  local event=$1
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    '' \
    'set -u' \
    "/usr/bin/timeout --signal=KILL 5s '${TELEMETRY_SCRIPT}' '${event}' >/dev/null 2>&1 || true" \
    'exit 0'
}

render_runner_env() {
  local existing_file=$1
  if [[ -f "$existing_file" ]]; then
    grep -Ev '^ACTIONS_RUNNER_HOOK_JOB_(STARTED|COMPLETED)=' "$existing_file" || true
  fi
  printf 'ACTIONS_RUNNER_HOOK_JOB_STARTED=%s\n' "$START_HOOK"
  printf 'ACTIONS_RUNNER_HOOK_JOB_COMPLETED=%s\n' "$COMPLETE_HOOK"
}

expected_digest() {
  local kind=$1
  case "$kind" in
    telemetry) render_telemetry_script ;;
    started) render_hook started ;;
    completed) render_hook completed ;;
    *) die "unknown managed file kind: ${kind}" ;;
  esac | sha256sum | awk '{print $1}'
}

managed_file_matches() {
  local path=$1 kind=$2 mode=$3
  [[ -f "$path" && ! -L "$path" ]] || return 1
  [[ "$(stat -c '%U:%G:%a' "$path")" == "root:root:${mode}" ]] || return 1
  [[ "$(sha256sum "$path" | awk '{print $1}')" == "$(expected_digest "$kind")" ]]
}

validate_platform() {
  local architecture cpu_count memory_kb available_kb
  [[ "$(id -u)" == '0' ]] || die 'run as root or through sudo -n'
  architecture=$(uname -m)
  [[ "$architecture" == 'aarch64' || "$architecture" == 'arm64' ]] ||
    die "expected ARM64, found ${architecture}"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "$ID" == 'ubuntu' && ("$VERSION_ID" == '24.04' || "$VERSION_ID" == '26.04') ]] ||
    die "expected Ubuntu 24.04 or 26.04, found ${ID} ${VERSION_ID}"
  cpu_count=$(nproc)
  ((cpu_count >= 16)) || die "expected at least 16 vCPUs, found ${cpu_count}"
  memory_kb=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
  ((memory_kb >= 30 * 1024 * 1024)) || die 'expected at least 30 GB RAM'
  available_kb=$(df -Pk / | awk 'NR == 2 {print $4}')
  ((available_kb >= 20 * 1024 * 1024)) || die 'expected at least 20 GB free disk'
}

validate_firewall() {
  local rules normalized unexpected
  command -v ufw >/dev/null 2>&1 || die 'UFW is missing'
  ufw status | grep -Fxq 'Status: active' || die 'UFW is inactive'
  ufw status verbose | grep -Fq 'Default: deny (incoming), allow (outgoing)' ||
    die 'UFW must deny incoming traffic by default'
  rules=$(ufw status numbered)
  normalized=$(sed -nE 's/^\[[[:space:]]*[0-9]+\][[:space:]]*//p' <<<"$rules" |
    sed -E 's/[[:space:]]+/ /g; s/[[:space:]]+$//')
  [[ -n "$normalized" ]] || die 'UFW has no SSH ingress rule'
  unexpected=$(grep -Ev \
    '^(OpenSSH|22/tcp)( \(v6\))?[[:space:]]+ALLOW( IN)?[[:space:]]+Anywhere( \(v6\))?$' \
    <<<"$normalized" || true)
  [[ -z "$unexpected" ]] || die 'UFW permits non-SSH ingress'
}

validate_runner_installation() {
  local name state_file runner_dir service stored_name stored_profile stored_group
  local expected_services actual_services

  id "$RUNNER_USER" >/dev/null 2>&1 || die "runner user is missing: ${RUNNER_USER}"
  [[ -d "$STATE_DIR" && ! -L "$STATE_DIR" ]] || die 'managed state directory is missing'
  [[ "$(stat -c '%U:%G:%a' "$STATE_DIR")" == 'root:root:700' ]] ||
    die 'managed state directory has unsafe ownership or mode'
  command -v docker >/dev/null 2>&1 || die 'Docker is missing'
  systemctl is-active --quiet docker || die 'Docker is inactive'
  systemctl is-enabled --quiet actions-runner-disk-cleanup.timer ||
    die 'runner disk-cleanup timer is not enabled'
  systemctl is-active --quiet actions-runner-disk-cleanup.timer ||
    die 'runner disk-cleanup timer is not active'

  expected_services=$(printf 'actions.runner.uzh-bf.%s.service\n' "${EXPECTED_NAMES[@]}" | sort)
  actual_services=$(find /etc/systemd/system -maxdepth 1 -type f \
    -name 'actions.runner.uzh-bf.public-pr-arm64-*.service' -printf '%f\n' | sort)
  [[ "$actual_services" == "$expected_services" ]] ||
    die 'this host must contain exactly its four allocated public PR runner services'

  for name in "${EXPECTED_NAMES[@]}"; do
    state_file="${STATE_DIR}/${name}.env"
    runner_dir="${RUNNER_BASE_DIR}/${name}"
    service="actions.runner.uzh-bf.${name}.service"
    [[ -f "$state_file" && ! -L "$state_file" ]] || die "state file is missing: ${name}"
    [[ "$(stat -c '%U:%G:%a' "$state_file")" == 'root:root:600' ]] ||
      die "state file has unsafe ownership or mode: ${name}"
    stored_name=$(state_file_value "$state_file" RUNNER_NAME)
    stored_profile=$(state_file_value "$state_file" PROFILE)
    stored_group=$(state_file_value "$state_file" RUNNER_GROUP)
    [[ "$stored_name" == "$name" && "$stored_profile" == 'public-pr' &&
      "$stored_group" == 'public-pr-arm64' ]] || die "managed state differs: ${name}"
    [[ -d "$runner_dir" && ! -L "$runner_dir" ]] || die "runner directory is missing: ${name}"
    [[ "$(stat -c '%U:%G' "$runner_dir")" == "${RUNNER_USER}:${RUNNER_USER}" ]] ||
      die "runner directory ownership differs: ${name}"
    [[ -f "${runner_dir}/.runner" && -f "${runner_dir}/.credentials" ]] ||
      die "runner registration files are missing: ${name}"
    systemctl is-enabled --quiet "$service" || die "runner service is disabled: ${name}"
    systemctl is-active --quiet "$service" || die "runner service is inactive: ${name}"
  done

  if pgrep -u "$RUNNER_USER" -f 'Runner.Worker' >/dev/null 2>&1; then
    die 'a runner job is active; wait for all four jobs to finish before reconciling'
  fi
}

check_reconciliation_state() {
  local name runner_env image
  DRIFT_COUNT=0

  managed_file_matches "$TELEMETRY_SCRIPT" telemetry 755 || {
    info "Drift: ${TELEMETRY_SCRIPT}"
    ((DRIFT_COUNT += 1))
  }
  managed_file_matches "$START_HOOK" started 755 || {
    info "Drift: ${START_HOOK}"
    ((DRIFT_COUNT += 1))
  }
  managed_file_matches "$COMPLETE_HOOK" completed 755 || {
    info "Drift: ${COMPLETE_HOOK}"
    ((DRIFT_COUNT += 1))
  }

  for name in "${EXPECTED_NAMES[@]}"; do
    runner_env="${RUNNER_BASE_DIR}/${name}/.env"
    if [[ ! -f "$runner_env" || -L "$runner_env" ]] ||
      [[ "$(grep -Fxc "ACTIONS_RUNNER_HOOK_JOB_STARTED=${START_HOOK}" "$runner_env" || true)" != '1' ]] ||
      [[ "$(grep -Fxc "ACTIONS_RUNNER_HOOK_JOB_COMPLETED=${COMPLETE_HOOK}" "$runner_env" || true)" != '1' ]]; then
      info "Drift: ${runner_env} hook settings"
      ((DRIFT_COUNT += 1))
    fi
  done

  for image in "${PREPULL_IMAGES[@]}"; do
    if ! docker image inspect "$image" >/dev/null 2>&1; then
      info "Missing image: ${image}"
      ((DRIFT_COUNT += 1))
    fi
  done
}

prompt_confirmation() {
  local response
  printf '\nThis updates telemetry hooks, runner .env files, and local Docker images.\n' >&2
  printf 'Type exactly: %s: ' "$CONFIRMATION" >&2
  if [[ -t 0 && -r /dev/tty ]]; then
    IFS= read -r response </dev/tty
  else
    IFS= read -r response
  fi
  [[ "$response" == "$CONFIRMATION" ]] || die 'confirmation did not match'
}

acquire_lock() {
  command -v flock >/dev/null 2>&1 || die 'flock is required'
  install -d -m 0755 -o root -g root /run/lock
  exec 9>"$LOCK_FILE"
  flock --nonblock 9 || die 'another runner reconciliation is active'
}

install_hooks() {
  install -d -m 0755 -o root -g root "$HOOK_DIR"
  render_telemetry_script | write_file_from_stdin 0755 root root "$TELEMETRY_SCRIPT"
  render_hook started | write_file_from_stdin 0755 root root "$START_HOOK"
  render_hook completed | write_file_from_stdin 0755 root root "$COMPLETE_HOOK"
}

configure_runner_envs() {
  local name runner_dir runner_env temporary
  for name in "${EXPECTED_NAMES[@]}"; do
    runner_dir="${RUNNER_BASE_DIR}/${name}"
    runner_env="${runner_dir}/.env"
    if [[ -e "$runner_env" ]]; then
      [[ -f "$runner_env" && ! -L "$runner_env" ]] ||
        die "runner environment file is invalid: ${name}"
    fi
    temporary=$(mktemp "${runner_dir}/.env.reconcile.XXXXXX")
    if ! render_runner_env "$runner_env" >"$temporary" ||
      ! chmod 0644 "$temporary" ||
      ! chown root:root "$temporary" ||
      ! mv -Tf -- "$temporary" "$runner_env"; then
      rm -f -- "$temporary"
      die "runner environment could not be updated: ${name}"
    fi
  done
}

prepull_images() {
  local image
  for image in "${PREPULL_IMAGES[@]}"; do
    docker pull "$image"
  done
}

restart_runners() {
  local name service
  systemctl daemon-reload
  for name in "${EXPECTED_NAMES[@]}"; do
    service="actions.runner.uzh-bf.${name}.service"
    systemctl restart "$service"
    systemctl is-active --quiet "$service" || die "runner did not restart: ${name}"
  done
}

print_summary() {
  info "Host slot: ${HOST_SLOT}"
  info "Runners: ${EXPECTED_NAMES[*]}"
  info "Docker root: $(docker info --format '{{.DockerRootDir}}')"
  info "Disk: $(df -h /var/lib/docker | awk 'NR == 2 {print $3 " used, " $4 " available (" $5 ")"}')"
  info "Telemetry: journalctl -t actions-runner-telemetry"
}

main() {
  parse_args "$@"
  set_expected_names "$HOST_SLOT"
  validate_platform
  validate_firewall
  validate_runner_installation
  check_reconciliation_state
  print_summary

  if [[ "$MODE" == 'check' ]]; then
    if ((DRIFT_COUNT == 0)); then
      printf '\n==> Runner host already matches the optimized configuration\n'
    else
      printf '\n==> Runner host is eligible; %s managed item(s) need reconciliation\n' "$DRIFT_COUNT"
    fi
    exit 0
  fi

  prompt_confirmation
  acquire_lock
  CURRENT_STAGE='pre-apply idle validation'
  validate_runner_installation
  CURRENT_STAGE='telemetry hook installation'
  install_hooks
  CURRENT_STAGE='runner hook configuration'
  configure_runner_envs
  CURRENT_STAGE='CI image pre-pull'
  prepull_images
  CURRENT_STAGE='runner service restart'
  restart_runners
  CURRENT_STAGE='post-apply verification'
  check_reconciliation_state
  ((DRIFT_COUNT == 0)) || die 'post-apply configuration still differs'
  print_summary
  printf '\n==> Runner host optimization completed and verified\n'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
