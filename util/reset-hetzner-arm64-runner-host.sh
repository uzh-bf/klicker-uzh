#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly ORGANIZATION='uzh-bf'
readonly REPOSITORY='uzh-bf/klicker-uzh'
readonly ADMIN_USER='runner-admin'
readonly RUNNER_USER='github-runner'
readonly RUNNER_DIR='/opt/actions-runner'
readonly CURRENT_STATE_DIR='/etc/actions-runner-bootstrap'
readonly CURRENT_STATE_FILE="${CURRENT_STATE_DIR}/bootstrap.env"
readonly LEGACY_STATE_DIR='/etc/klicker-runner'
readonly LEGACY_STATE_FILE="${LEGACY_STATE_DIR}/bootstrap.env"
readonly CURRENT_SSH_HARDENING='/etc/ssh/sshd_config.d/00-actions-runner-hardening.conf'
readonly LEGACY_SSH_HARDENING='/etc/ssh/sshd_config.d/00-klicker-runner-hardening.conf'
readonly LOCK_FILE='/run/lock/actions-runner-bootstrap.lock'

MODE='plan'
TARGET_PROFILE=''
CURRENT_STAGE='initial validation'
SOURCE_STATE_FILE=''
MANAGED_RUNNER_NAME=''
LEGACY_STATE_PRESENT='false'
FIREWALL_STATUS='unknown'

usage() {
  cat <<'EOF'
Reset one dedicated runner VM for the generic organization runner provisioner.

Usage:
  reset-hetzner-arm64-runner-host.sh --target-profile PROFILE
  reset-hetzner-arm64-runner-host.sh --check --target-profile PROFILE
  reset-hetzner-arm64-runner-host.sh --apply --target-profile PROFILE

Modes:
  no mode             Print the cleanup plan. Makes no changes.
  --check             Validate the host and cleanup boundary. Makes no changes
                      and performs no network access.
  --apply             Interactively remove the old runner installation.

Options:
  --target-profile    public-pr or trusted. The subsequent provision command
                      must use the same profile.
  -h, --help          Show this help.

Apply removes the GitHub runner service, runner credentials and work directory,
the github-runner user, Docker packages and all local Docker data. It retains
runner-admin, SSH hardening, root and admin SSH keys, UFW, OpenSSH, sudo, and
unattended upgrades. It supports only the local 80 GB disk configuration.

This is not compromise recovery and does not securely erase deleted disk
blocks. Do not use it if untrusted code may have run or compromise is suspected.
For a public-pr target, do not use it if the VM has ever received repository,
organization, environment, or external secrets, private data, or private source.
Rebuild that VM instead.
EOF
}

log() {
  printf '\n==> %s\n' "$*"
}

info() {
  printf '    %s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  local failed_line=${1:-unknown}

  if ((BASH_SUBSHELL > 0)); then
    exit "$exit_code"
  fi
  printf '\nCleanup stopped during: %s (line %s)\n' "$CURRENT_STAGE" "$failed_line" >&2
  printf 'The cleanup is rerunnable; correct the reported condition and run --check again.\n' >&2
  exit "$exit_code"
}

trap 'on_error "$LINENO"' ERR

require_tty() {
  [[ -r /dev/tty ]] || die 'interactive apply requires a terminal'
}

prompt_line() {
  local prompt=$1
  local value

  require_tty
  printf '%s: ' "$prompt" >/dev/tty
  IFS= read -r value </dev/tty
  printf '%s' "$value"
}

require_confirmation() {
  local explanation=$1
  local phrase=$2
  local response

  printf '\n%s\n' "$explanation" >/dev/tty
  response=$(prompt_line "Type exactly: ${phrase}")
  [[ "$response" == "$phrase" ]] || die 'confirmation did not match'
}

parse_args() {
  while (($# > 0)); do
    case "$1" in
      --apply)
        [[ "$MODE" == 'plan' ]] || die 'choose only one mode'
        MODE='apply'
        shift
        ;;
      --check)
        [[ "$MODE" == 'plan' ]] || die 'choose only one mode'
        MODE='check'
        shift
        ;;
      --target-profile)
        (($# >= 2)) || die '--target-profile requires a value'
        TARGET_PROFILE=$2
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

  [[ "$TARGET_PROFILE" == 'public-pr' || "$TARGET_PROFILE" == 'trusted' ]] ||
    die '--target-profile must be public-pr or trusted'
}

validate_platform() {
  local architecture os_id os_version

  architecture=$(uname -m)
  [[ "$architecture" == 'aarch64' || "$architecture" == 'arm64' ]] ||
    die "unsupported architecture ${architecture}; expected ARM64"
  [[ -r /etc/os-release ]] || die '/etc/os-release is missing'
  os_id=$(awk -F= '$1 == "ID" {gsub(/"/, "", $2); print $2}' /etc/os-release)
  os_version=$(awk -F= '$1 == "VERSION_ID" {gsub(/"/, "", $2); print $2}' /etc/os-release)
  [[ "$os_id" == 'ubuntu' ]] || die "unsupported OS ${os_id:-unknown}; expected Ubuntu"
  [[ "$os_version" == '24.04' || "$os_version" == '26.04' ]] ||
    die "unsupported Ubuntu version ${os_version:-unknown}; expected 24.04 or 26.04"
}

assert_regular_or_absent() {
  local path=$1

  [[ ! -e "$path" && ! -L "$path" ]] && return 0
  [[ -f "$path" && ! -L "$path" ]] || die "managed path is not a regular file: ${path}"
}

assert_directory_or_absent() {
  local path=$1

  [[ ! -e "$path" && ! -L "$path" ]] && return 0
  [[ -d "$path" && ! -L "$path" ]] || die "managed path is not a directory: ${path}"
}

state_value() {
  local file=$1 key=$2
  awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$file"
}

validate_state_file() {
  local file=$1 reset_ready runner_name repository organization storage mount scope group

  assert_regular_or_absent "$file"
  [[ -f "$file" ]] || die "managed state is missing: ${file}"
  [[ "$(stat -c '%U:%G:%a' "$file")" == 'root:root:600' ]] ||
    die "managed state has unexpected ownership or mode: ${file}"

  reset_ready=$(state_value "$file" RESET_READY)
  if [[ "$reset_ready" == 'true' ]]; then
    [[ "$file" == "$CURRENT_STATE_FILE" ]] || die 'reset marker is in the legacy state path'
    [[ "$(state_value "$file" TARGET_PROFILE)" == "$TARGET_PROFILE" ]] ||
      die 'the existing reset marker targets a different profile'
    [[ "$(state_value "$file" ADMIN_USER)" == "$ADMIN_USER" ]] ||
      die 'the reset marker contains an unexpected admin user'
    [[ "$(state_value "$file" STORAGE_MODE)" == 'local' ]] ||
      die 'the reset marker does not describe local storage'
    [[ -z "$(state_value "$file" VOLUME_MOUNT)" ]] ||
      die 'the reset marker unexpectedly names an attached volume'
    MANAGED_RUNNER_NAME=''
    return 0
  fi

  [[ "$file" == "$LEGACY_STATE_FILE" ]] ||
    die 'only a reset marker is accepted in the generic state path'
  runner_name=$(state_value "$file" RUNNER_NAME)
  [[ "$runner_name" =~ ^klicker-arm64-runner-0[1-5]$ ]] ||
    die 'managed state contains an unexpected runner name'
  repository=$(state_value "$file" REPOSITORY)
  organization=$(state_value "$file" ORGANIZATION)
  [[ "$repository" == "$REPOSITORY" ]] ||
    die 'managed state belongs to another repository'
  [[ -z "$organization" || "$organization" == "$ORGANIZATION" ]] ||
    die 'managed state belongs to another organization'
  [[ -n "$repository" || -n "$organization" ]] ||
    die 'managed state has no recognized repository or organization owner'
  storage=$(state_value "$file" STORAGE_MODE)
  mount=$(state_value "$file" VOLUME_MOUNT)
  [[ -z "$storage" || "$storage" == 'local' ]] ||
    die 'attached-volume runners are not supported by this cleanup script'
  [[ -z "$mount" ]] || die 'attached-volume runners are not supported by this cleanup script'
  scope=$(state_value "$file" REGISTRATION_SCOPE)
  [[ -z "$scope" || "$scope" == 'repository' || "$scope" == 'organization' ]] ||
    die 'managed state contains an unexpected registration scope'
  group=$(state_value "$file" RUNNER_GROUP)
  [[ -z "$group" || "$group" == 'klicker-trusted-arm64' ]] ||
    die 'managed state contains an unexpected runner group'
  MANAGED_RUNNER_NAME=$runner_name
}

validate_state_directory() {
  local directory=$1 unexpected

  assert_directory_or_absent "$directory"
  [[ -d "$directory" ]] || return 0
  [[ "$(stat -c '%U:%G:%a' "$directory")" == 'root:root:700' ]] ||
    die "managed state directory has unexpected ownership or mode: ${directory}"
  unexpected=$(find "$directory" -mindepth 1 -maxdepth 1 ! -name bootstrap.env -print -quit)
  [[ -z "$unexpected" ]] || die "managed state directory contains an unexpected file: ${unexpected}"
}

discover_state() {
  local current_exists='false' legacy_exists='false'

  validate_state_directory "$CURRENT_STATE_DIR"
  validate_state_directory "$LEGACY_STATE_DIR"
  [[ -e "$CURRENT_STATE_FILE" || -L "$CURRENT_STATE_FILE" ]] && current_exists='true'
  [[ -e "$LEGACY_STATE_FILE" || -L "$LEGACY_STATE_FILE" ]] && legacy_exists='true'
  if [[ "$current_exists" == 'true' && "$legacy_exists" == 'true' ]]; then
    validate_state_file "$LEGACY_STATE_FILE"
    LEGACY_STATE_PRESENT='true'
    SOURCE_STATE_FILE=$CURRENT_STATE_FILE
  elif [[ "$current_exists" == 'true' ]]; then
    SOURCE_STATE_FILE=$CURRENT_STATE_FILE
  elif [[ "$legacy_exists" == 'true' ]]; then
    SOURCE_STATE_FILE=$LEGACY_STATE_FILE
    LEGACY_STATE_PRESENT='true'
  else
    die 'no recognized managed runner state exists; refusing to clean an unmanaged host'
  fi
  validate_state_file "$SOURCE_STATE_FILE"
  if [[ "$SOURCE_STATE_FILE" == "$CURRENT_STATE_FILE" ]] &&
    [[ "$(state_value "$SOURCE_STATE_FILE" RESET_READY)" != 'true' ]]; then
    die 'a generic runner cannot be reassigned with this one-time legacy reset; rebuild it'
  fi
}

validate_admin_access() {
  local admin_home admin_rule root_keys='/root/.ssh/authorized_keys'

  id "$ADMIN_USER" >/dev/null 2>&1 || die "${ADMIN_USER} does not exist"
  admin_home=$(getent passwd "$ADMIN_USER" | awk -F: '{print $6}')
  [[ "$admin_home" == "/home/${ADMIN_USER}" ]] || die "${ADMIN_USER} has an unexpected home"
  [[ -s "${admin_home}/.ssh/authorized_keys" &&
    ! -L "${admin_home}/.ssh/authorized_keys" ]] ||
    die "${ADMIN_USER} has no safe authorized_keys file"
  [[ -s "$root_keys" && ! -L "$root_keys" ]] ||
    die 'root has no safe authorized_keys file'
  admin_rule="/etc/sudoers.d/${ADMIN_USER}"
  assert_regular_or_absent "$admin_rule"
  [[ -f "$admin_rule" ]] || die "${ADMIN_USER} sudoers rule is missing"
  command -v visudo >/dev/null 2>&1 || die 'visudo is required'
  visudo -cf "$admin_rule" >/dev/null || die "${ADMIN_USER} sudoers rule is invalid"
}

validate_ssh_hardening_file() {
  local file=$1

  assert_regular_or_absent "$file"
  [[ ! -f "$file" ]] && return 0
  [[ "$(stat -c '%U:%G:%a' "$file")" == 'root:root:644' ]] ||
    die "managed SSH hardening has unexpected ownership or mode: ${file}"
  if [[ "$(wc -l <"$file" | tr -d ' ')" != '5' ]] ||
    ! grep -Fxq 'PasswordAuthentication no' "$file" ||
    ! grep -Fxq 'KbdInteractiveAuthentication no' "$file" ||
    ! grep -Fxq 'PermitRootLogin no' "$file" ||
    ! grep -Fxq 'AllowTcpForwarding no' "$file" ||
    ! grep -Fxq 'X11Forwarding no' "$file"; then
    die "managed SSH hardening differs from the expected content: ${file}"
  fi
}

validate_ssh_hardening() {
  validate_ssh_hardening_file "$CURRENT_SSH_HARDENING"
  validate_ssh_hardening_file "$LEGACY_SSH_HARDENING"
  [[ -f "$CURRENT_SSH_HARDENING" || -f "$LEGACY_SSH_HARDENING" ]] ||
    die 'no recognized SSH hardening file exists'
  /usr/sbin/sshd -t
}

expected_runner_units() {
  [[ -n "$MANAGED_RUNNER_NAME" ]] || return 0
  printf '%s\n' \
    "actions.runner.uzh-bf-klicker-uzh.${MANAGED_RUNNER_NAME}.service" \
    "actions.runner.uzh-bf.${MANAGED_RUNNER_NAME}.service"
}

is_expected_runner_unit() {
  local actual=$1 candidate

  while IFS= read -r candidate; do
    [[ "$actual" == "$candidate" ]] && return 0
  done < <(expected_runner_units)
  return 1
}

validate_runner_units() {
  local path unit

  while IFS= read -r path; do
    [[ -n "$path" ]] || continue
    unit=$(basename -- "$path")
    is_expected_runner_unit "$unit" || die "unrecognized runner unit exists: ${path}"
    assert_regular_or_absent "$path"
  done < <(find /etc/systemd/system -maxdepth 1 \
    \( -name 'actions.runner.uzh-bf-klicker-uzh.*.service' -o \
    -name 'actions.runner.uzh-bf.*.service' \) -print)

  if [[ -e "${RUNNER_DIR}/.service" || -L "${RUNNER_DIR}/.service" ]]; then
    assert_regular_or_absent "${RUNNER_DIR}/.service"
    unit=$(<"${RUNNER_DIR}/.service")
    is_expected_runner_unit "$unit" || die 'runner service marker contains an unexpected unit'
  fi
}

validate_managed_paths() {
  local path unexpected

  assert_directory_or_absent "$RUNNER_DIR"
  assert_directory_or_absent /var/lib/docker
  assert_directory_or_absent /var/lib/containerd
  for path in "$RUNNER_DIR" /var/lib/docker /var/lib/containerd /etc/docker; do
    [[ -d "$path" ]] || continue
    [[ "$(findmnt -rn --mountpoint "$path" -o TARGET || true)" != "$path" ]] ||
      die "managed local path is a mount point: ${path}"
  done

  assert_directory_or_absent /etc/docker
  if [[ -d /etc/docker ]]; then
    unexpected=$(find /etc/docker -mindepth 1 -maxdepth 1 ! -name daemon.json -print -quit)
    [[ -z "$unexpected" ]] || die "unmanaged Docker configuration exists: ${unexpected}"
  fi
  assert_regular_or_absent /etc/docker/daemon.json
  if [[ -f /etc/docker/daemon.json ]]; then
    command -v jq >/dev/null 2>&1 || die 'jq is required to validate Docker configuration'
    jq -e '
      . == {
        "data-root": "/var/lib/docker",
        "log-driver": "json-file",
        "log-opts": {"max-size": "50m", "max-file": "3"}
      }
    ' /etc/docker/daemon.json >/dev/null ||
      die 'Docker daemon.json contains unmanaged configuration'
  fi

  assert_directory_or_absent /etc/systemd/system/docker.service.d
  if [[ -d /etc/systemd/system/docker.service.d ]]; then
    unexpected=$(find /etc/systemd/system/docker.service.d -mindepth 1 -maxdepth 1 \
      ! -name '10-klicker-runner-volume.conf' \
      ! -name '10-actions-runner-volume.conf' -print -quit)
    [[ -z "$unexpected" ]] || die "unmanaged Docker service override exists: ${unexpected}"
  fi
}

package_installed() {
  dpkg-query -W -f='${db:Status-Abbrev}' "$1" 2>/dev/null | grep -q '^ii'
}

validate_docker_packages() {
  local docker_binary docker_provider package

  for package in docker-ce docker-ce-cli containerd.io podman-docker; do
    ! package_installed "$package" || die "unsupported container package is installed: ${package}"
  done
  if command -v docker >/dev/null 2>&1; then
    docker_binary=$(readlink -f "$(command -v docker)")
    docker_provider=$(dpkg-query -S "$docker_binary" 2>/dev/null | awk -F: 'NR == 1 {print $1}')
    [[ "$docker_provider" == 'docker.io' || "$docker_provider" == 'docker-cli' ]] ||
      die 'docker exists but is not provided by a managed Ubuntu package'
  fi
}

validate_firewall() {
  local firewall_rules normalized_rules unexpected_rules

  command -v ufw >/dev/null 2>&1 || die 'UFW is missing'
  if ufw status | grep -Fxq 'Status: inactive'; then
    FIREWALL_STATUS='inactive; apply will replace its rules with SSH-only ingress'
    return 0
  fi
  ufw status | grep -Fxq 'Status: active' || die 'UFW returned an unexpected status'
  ufw status verbose | grep -Fq 'Default: deny (incoming), allow (outgoing)' ||
    die 'UFW does not deny inbound traffic by default'
  firewall_rules=$(ufw status numbered)
  normalized_rules=$(sed -nE \
    's/^\[[[:space:]]*[0-9]+\][[:space:]]*//p' <<<"$firewall_rules" |
    sed -E 's/[[:space:]]+/ /g; s/[[:space:]]+$//')
  [[ -n "$normalized_rules" ]] || die 'UFW has no inbound SSH rule'
  unexpected_rules=$(grep -Ev \
    '^(OpenSSH|22/tcp)( \(v6\))?[[:space:]]+ALLOW( IN)?[[:space:]]+Anywhere( \(v6\))?$' \
    <<<"$normalized_rules" || true)
  [[ -z "$unexpected_rules" ]] ||
    die "UFW contains a non-SSH rule: ${unexpected_rules//$'\n'/, }"
  FIREWALL_STATUS='active with SSH-only ingress'
}

is_reset_ready() {
  [[ "$(state_value "$SOURCE_STATE_FILE" RESET_READY)" == 'true' ]]
}

validate_reset_ready_state() {
  local path

  is_reset_ready || return 0
  ! id "$RUNNER_USER" >/dev/null 2>&1 || die "${RUNNER_USER} still exists after reset"
  [[ ! -e "$RUNNER_DIR" && ! -L "$RUNNER_DIR" ]] || die "${RUNNER_DIR} still exists after reset"
  ! command -v docker >/dev/null 2>&1 || die 'Docker still exists after reset'
  for path in /var/lib/docker /var/lib/containerd /etc/docker; do
    [[ ! -e "$path" && ! -L "$path" ]] || die "${path} still exists after reset"
  done
  [[ -f "$CURRENT_SSH_HARDENING" && ! -f "$LEGACY_SSH_HARDENING" ]] ||
    die 'SSH hardening was not migrated to the generic path'
  [[ -z "$(find /etc/systemd/system -maxdepth 1 \
    \( -name 'actions.runner.uzh-bf-klicker-uzh.*.service' -o \
    -name 'actions.runner.uzh-bf.*.service' \) -print -quit)" ]] ||
    die 'a runner unit still exists after reset'
  for path in \
    /usr/local/sbin/actions-runner-disk-cleanup \
    /usr/local/sbin/klicker-runner-disk-cleanup \
    /etc/systemd/system/actions-runner-disk-cleanup.service \
    /etc/systemd/system/actions-runner-disk-cleanup.timer \
    /etc/systemd/system/klicker-runner-disk-cleanup.service \
    /etc/systemd/system/klicker-runner-disk-cleanup.timer; do
    [[ ! -e "$path" && ! -L "$path" ]] || die "runner maintenance asset remains: ${path}"
  done
}

local_check() {
  ((EUID == 0)) || die 'run this script as root or with sudo'
  validate_platform
  discover_state
  validate_admin_access
  validate_ssh_hardening
  validate_runner_units
  validate_managed_paths
  validate_docker_packages
  validate_firewall
  validate_reset_ready_state
  is_reset_ready || validate_package_removal_plan
}

print_plan() {
  cat <<EOF
Runner host cleanup plan (read-only):
  Source state: ${SOURCE_STATE_FILE}
  Existing runner: ${MANAGED_RUNNER_NAME:-already reset}
  Target profile: ${TARGET_PROFILE}
  Remove: runner service, ${RUNNER_USER}, ${RUNNER_DIR}, Docker packages and local Docker data
  Preserve: ${ADMIN_USER}, SSH keys and hardening, UFW, OpenSSH, sudo, OS updates
  Firewall: ${FIREWALL_STATUS}
  Storage: local 80 GB disk only

No changes were made. Cleanup does not securely erase disk blocks and cannot
recover a compromised host. Run with --check first, then --apply only if the
trust confirmations in --help are true.
EOF
}

acquire_mutation_lock() {
  CURRENT_STAGE='exclusive runner maintenance lock'
  command -v flock >/dev/null 2>&1 || die 'flock is required'
  install -d -m 0755 -o root -g root /run/lock
  exec 9>"$LOCK_FILE"
  flock --nonblock 9 || die 'runner provisioning or cleanup is already active'
}

configure_ssh_only_firewall() {
  [[ "$FIREWALL_STATUS" != 'active with SSH-only ingress' ]] || return 0

  CURRENT_STAGE='SSH-only firewall configuration'
  ufw --force reset >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow OpenSSH >/dev/null
  ufw --force enable >/dev/null
  validate_firewall
  [[ "$FIREWALL_STATUS" == 'active with SSH-only ingress' ]] ||
    die 'UFW did not become active with SSH-only ingress'
}

confirm_cleanup_boundary() {
  local response

  response=$(prompt_line 'The old GitHub runner record is removed and no job is running (yes/no)')
  [[ "$response" == 'yes' ]] || die 'remove the runner record and stop all jobs before cleanup'
  response=$(prompt_line 'This VM has never run untrusted code and no compromise is suspected (yes/no)')
  [[ "$response" == 'yes' ]] ||
    die 'cleanup cannot restore trust; rebuild the VM before reusing it'
  if [[ "$TARGET_PROFILE" == 'public-pr' ]]; then
    response=$(prompt_line 'This VM has never received repository, organization, environment, or external secrets, private data, or private source (yes/no)')
    [[ "$response" == 'yes' ]] ||
      die 'deleted secrets may be recoverable; rebuild the VM before public PR use'
  fi
  require_confirmation \
    "This permanently deletes the runner workspace, credentials, Docker images, containers, volumes, and build cache." \
    'RESET ACTIONS RUNNER HOST'
}

stop_services() {
  local running_containers='' unit

  CURRENT_STAGE='runner and cleanup service shutdown'
  while IFS= read -r unit; do
    [[ -n "$unit" ]] || continue
    [[ -e "/etc/systemd/system/${unit}" ||
      -L "/etc/systemd/system/multi-user.target.wants/${unit}" ]] || continue
    systemctl disable --now "$unit"
    ! systemctl is-active --quiet "$unit" || die "runner service remained active: ${unit}"
  done < <(expected_runner_units)

  for unit in \
    actions-runner-disk-cleanup.timer \
    actions-runner-disk-cleanup.service \
    klicker-runner-disk-cleanup.timer \
    klicker-runner-disk-cleanup.service; do
    systemctl disable --now "$unit" 2>/dev/null || true
    ! systemctl is-active --quiet "$unit" || die "cleanup service remained active: ${unit}"
  done

  if command -v docker >/dev/null 2>&1 &&
    { systemctl is-active --quiet docker.service || systemctl is-active --quiet docker.socket; }; then
    running_containers=$(docker ps -q)
    [[ -z "$running_containers" ]] ||
      die 'Docker still has running containers; stop the job and rerun cleanup'
  fi
  systemctl stop docker.service docker.socket 2>/dev/null || true
  ! systemctl is-active --quiet docker.service || die 'Docker service remained active'
  ! systemctl is-active --quiet docker.socket || die 'Docker socket remained active'
  if id "$RUNNER_USER" >/dev/null 2>&1 && pgrep -u "$RUNNER_USER" >/dev/null 2>&1; then
    die "${RUNNER_USER} still has running processes after service shutdown"
  fi
}

remove_systemd_assets() {
  local unit

  CURRENT_STAGE='systemd runner asset removal'
  while IFS= read -r unit; do
    [[ -n "$unit" ]] || continue
    rm -f -- \
      "/etc/systemd/system/${unit}" \
      "/etc/systemd/system/multi-user.target.wants/${unit}"
  done < <(expected_runner_units)
  rm -f -- \
    /etc/systemd/system/actions-runner-disk-cleanup.service \
    /etc/systemd/system/actions-runner-disk-cleanup.timer \
    /etc/systemd/system/klicker-runner-disk-cleanup.service \
    /etc/systemd/system/klicker-runner-disk-cleanup.timer \
    /etc/systemd/system/timers.target.wants/actions-runner-disk-cleanup.timer \
    /etc/systemd/system/timers.target.wants/klicker-runner-disk-cleanup.timer \
    /usr/local/sbin/actions-runner-disk-cleanup \
    /usr/local/sbin/klicker-runner-disk-cleanup \
    /etc/needrestart/conf.d/actions_runner_services.conf
  systemctl daemon-reload
}

validate_package_removal_plan() {
  local package removal_plan unexpected
  local -a installed_packages=()

  for package in docker.io docker-cli containerd runc; do
    package_installed "$package" && installed_packages+=("$package")
  done
  ((${#installed_packages[@]} > 0)) || return 0

  removal_plan=$(LC_ALL=C apt-get -s purge -y "${installed_packages[@]}")
  unexpected=$(awk '/^(Remv|Purg) / {print $2}' <<<"$removal_plan" |
    grep -Ev '^(docker\.io|docker-cli|containerd|runc)$' || true)
  [[ -z "$unexpected" ]] ||
    die "Docker package removal would also remove unmanaged packages: ${unexpected//$'\n'/, }"
}

remove_runner_and_docker() {
  local package
  local -a installed_packages=()

  CURRENT_STAGE='runner account and data removal'
  if id "$RUNNER_USER" >/dev/null 2>&1; then
    userdel "$RUNNER_USER"
  fi
  rm -rf -- "$RUNNER_DIR"

  CURRENT_STAGE='Docker package removal'
  validate_package_removal_plan
  for package in docker.io docker-cli containerd runc; do
    package_installed "$package" && installed_packages+=("$package")
  done
  if ((${#installed_packages[@]} > 0)); then
    export DEBIAN_FRONTEND=noninteractive
    LC_ALL=C apt-get purge -y "${installed_packages[@]}"
  fi

  CURRENT_STAGE='Docker data removal'
  rm -rf -- /var/lib/docker /var/lib/containerd /etc/docker
  rm -f -- \
    /etc/systemd/system/docker.service.d/10-actions-runner-volume.conf \
    /etc/systemd/system/docker.service.d/10-klicker-runner-volume.conf
  if [[ -d /etc/systemd/system/docker.service.d ]] &&
    [[ -z "$(find /etc/systemd/system/docker.service.d -mindepth 1 -print -quit)" ]]; then
    rmdir /etc/systemd/system/docker.service.d
  fi
  systemctl daemon-reload
}

write_file_from_stdin() {
  local mode=$1 destination=$2
  local destination_dir destination_name temporary_file

  destination_dir=$(dirname -- "$destination")
  destination_name=$(basename -- "$destination")
  install -d -m 0755 -o root -g root "$destination_dir"
  temporary_file=$(mktemp "${destination_dir}/.${destination_name}.XXXXXX")
  if ! cat >"$temporary_file" ||
    ! chmod "$mode" "$temporary_file" ||
    ! chown root:root "$temporary_file" ||
    ! mv -Tf -- "$temporary_file" "$destination"; then
    rm -f -- "$temporary_file"
    die "managed file could not be written: ${destination}"
  fi
}

preserve_generic_hardening() {
  CURRENT_STAGE='generic SSH hardening migration'
  if [[ ! -f "$CURRENT_SSH_HARDENING" ]]; then
    write_file_from_stdin 0644 "$CURRENT_SSH_HARDENING" <"$LEGACY_SSH_HARDENING"
  fi
  rm -f -- "$LEGACY_SSH_HARDENING"
  /usr/sbin/sshd -t
  systemctl reload ssh.service
  /usr/sbin/sshd -t
}

write_reset_marker() {
  CURRENT_STAGE='reset-ready state recording'
  install -d -m 0700 -o root -g root "$CURRENT_STATE_DIR"
  write_file_from_stdin 0600 "$CURRENT_STATE_FILE" <<EOF
RESET_READY=true
TARGET_PROFILE=${TARGET_PROFILE}
ADMIN_USER=${ADMIN_USER}
STORAGE_MODE=local
VOLUME_MOUNT=
EOF
  rm -f -- "$LEGACY_STATE_FILE"
  if [[ -d "$LEGACY_STATE_DIR" ]]; then
    rmdir "$LEGACY_STATE_DIR"
  fi
  LEGACY_STATE_PRESENT='false'
}

apply_cleanup() {
  if is_reset_ready; then
    acquire_mutation_lock
    configure_ssh_only_firewall
    if [[ "$LEGACY_STATE_PRESENT" == 'true' ]]; then
      rm -f -- "$LEGACY_STATE_FILE"
      rmdir "$LEGACY_STATE_DIR"
      LEGACY_STATE_PRESENT='false'
    fi
    log 'Runner host is already reset and ready for provisioning'
    return 0
  fi

  acquire_mutation_lock
  confirm_cleanup_boundary
  configure_ssh_only_firewall
  stop_services
  remove_systemd_assets
  remove_runner_and_docker
  preserve_generic_hardening
  write_reset_marker

  SOURCE_STATE_FILE=$CURRENT_STATE_FILE
  MANAGED_RUNNER_NAME=''
  local_check
  log 'Runner host cleanup completed'
  info "The host is ready for provision-hetzner-arm64-runner.sh --apply --profile ${TARGET_PROFILE}."
  info 'UFW, SSH hardening, runner-admin, SSH keys, sudo, and OS updates were preserved.'
  info 'The deleted runner and Docker data cannot be recovered by this script.'
}

main() {
  parse_args "$@"
  local_check
  print_plan

  case "$MODE" in
    plan)
      ;;
    check)
      log 'Offline cleanup checks passed; no changes were made'
      ;;
    apply)
      apply_cleanup
      ;;
  esac
}

main "$@"
