#!/usr/bin/env bash

set -Eeuo pipefail

readonly PROVISIONER_REVISION='22778fd666b73a8316f77dc5641897c1dc4e3251'
readonly PROVISIONER_SHA256='5cf9a89d8350882bf8713815e0779003431746dd7d5e7f01ea279949801040c7'
readonly PROVISIONER_URL="https://raw.githubusercontent.com/uzh-bf/klicker-uzh/${PROVISIONER_REVISION}/util/provision-hetzner-arm64-runner.sh"
readonly REMOTE_PROVISIONER='/root/provision-hetzner-arm64-runner.sh'

MODE=''
HOST_A=''
HOST_B=''
IDENTITY_FILE=''
TEMP_DIR=''
GITHUB_TOKEN=''

usage() {
  cat <<'EOF'
Provision eight public-PR ARM64 GitHub Actions runner processes on two fresh VMs.

Usage:
  provision-public-pr-arm64-pool.sh --check --host-a HOST --host-b HOST [--identity FILE]
  provision-public-pr-arm64-pool.sh --apply --host-a HOST --host-b HOST [--identity FILE]

Modes:
  --check          Validate the local tools and both remote VM platforms. No
                   remote files or services are changed.
  --apply          Provision public-pr-arm64-01 through -04 on host A and
                   public-pr-arm64-05 through -08 on host B.

Options:
  --host-a HOST    Fresh CAX41 ARM64 VM reached through its IPv4 address or DNS name.
  --host-b HOST    Second fresh CAX41 ARM64 VM.
  --identity FILE  Optional SSH private key passed to ssh and scp.
  -h, --help       Show this help.

Prerequisites:
  - Ubuntu 24.04 or 26.04 ARM64 with root SSH-key access.
  - 16 vCPUs, at least 30 GB RAM, at least 20 GB free local disk.
  - A provider firewall allowing inbound SSH only, preferably from your IP.
  - The public-pr-arm64 organization runner group already selects only the
    intended public repositories.
  - Runner names public-pr-arm64-01 through -08 do not already exist in GitHub.
  - The VMs contain no private source, private-network access, or secrets.

Apply prompts once for a short-lived GitHub token with organization
Self-hosted runners read/write permission. The token stays in process memory,
is sent only through SSH terminals to the remote provisioner, and is never
placed in command arguments or files. Revoke it after provisioning.
EOF
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '\n==> %s\n' "$*"
}

cleanup() {
  GITHUB_TOKEN=''
  unset GITHUB_TOKEN
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf -- "$TEMP_DIR"
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

parse_args() {
  while (($# > 0)); do
    case "$1" in
      --check | --apply)
        [[ -z "$MODE" ]] || die 'select exactly one mode'
        MODE=${1#--}
        shift
        ;;
      --host-a)
        (($# >= 2)) || die '--host-a requires a value'
        HOST_A=$2
        shift 2
        ;;
      --host-b)
        (($# >= 2)) || die '--host-b requires a value'
        HOST_B=$2
        shift 2
        ;;
      --identity)
        (($# >= 2)) || die '--identity requires a value'
        IDENTITY_FILE=$2
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
  [[ -n "$HOST_A" && -n "$HOST_B" ]] || die '--host-a and --host-b are required'
  [[ "$HOST_A" != "$HOST_B" ]] || die 'host A and host B must differ'
  [[ "$HOST_A" =~ ^[A-Za-z0-9.-]+$ ]] || die 'host A must be an IPv4 address or DNS name'
  [[ "$HOST_B" =~ ^[A-Za-z0-9.-]+$ ]] || die 'host B must be an IPv4 address or DNS name'
  if [[ -n "$IDENTITY_FILE" ]]; then
    [[ -f "$IDENTITY_FILE" && -r "$IDENTITY_FILE" ]] ||
      die 'the SSH identity file is not a readable regular file'
  fi
}

require_local_tools() {
  local tool
  for tool in bash curl expect scp ssh; do
    command -v "$tool" >/dev/null 2>&1 || die "required local tool is missing: ${tool}"
  done
}

ssh_args() {
  SSH_ARGS=(
    -o BatchMode=yes
    -o ConnectTimeout=15
    -o ServerAliveInterval=15
    -o ServerAliveCountMax=4
    -o StrictHostKeyChecking=accept-new
  )
  if [[ -n "$IDENTITY_FILE" ]]; then
    SSH_ARGS+=(-i "$IDENTITY_FILE")
  fi
}

remote_platform_check() {
  local host=$1
  local ssh_user=$2
  local remote_shell='bash -s'

  if [[ "$ssh_user" == 'runner-admin' ]]; then
    remote_shell='sudo -n bash -s'
  fi

  log "Checking ${host}"
  # The remote shell is selected from the two fixed values above.
  # shellcheck disable=SC2029
  ssh "${SSH_ARGS[@]}" "${ssh_user}@${host}" "$remote_shell" <<'REMOTE_CHECK'
set -Eeuo pipefail

architecture=$(uname -m)
[[ "$architecture" == 'aarch64' || "$architecture" == 'arm64' ]] || {
  printf 'ERROR: expected ARM64, found %s\n' "$architecture" >&2
  exit 1
}

. /etc/os-release
[[ "$ID" == 'ubuntu' && ("$VERSION_ID" == '24.04' || "$VERSION_ID" == '26.04') ]] || {
  printf 'ERROR: expected Ubuntu 24.04 or 26.04, found %s %s\n' "$ID" "$VERSION_ID" >&2
  exit 1
}

cpu_count=$(nproc)
((cpu_count >= 16)) || {
  printf 'ERROR: expected at least 16 vCPUs, found %s\n' "$cpu_count" >&2
  exit 1
}

memory_kb=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)
((memory_kb >= 30 * 1024 * 1024)) || {
  printf 'ERROR: expected at least 30 GB RAM\n' >&2
  exit 1
}

available_kb=$(df -Pk / | awk 'NR == 2 {print $4}')
((available_kb >= 20 * 1024 * 1024)) || {
  printf 'ERROR: expected at least 20 GB free local disk\n' >&2
  exit 1
}

[[ -s /root/.ssh/authorized_keys ]] || {
  printf 'ERROR: root has no authorized SSH keys\n' >&2
  exit 1
}

printf 'Platform: %s %s %s\n' "$ID" "$VERSION_ID" "$architecture"
printf 'Resources: %s vCPUs, %s kB RAM, %s kB disk available\n' \
  "$cpu_count" "$memory_kb" "$available_kb"
REMOTE_CHECK
}

select_ssh_user() {
  local host=$1

  if ssh "${SSH_ARGS[@]}" "root@${host}" true >/dev/null 2>&1; then
    printf 'root\n'
  elif ssh "${SSH_ARGS[@]}" "runner-admin@${host}" 'sudo -n true' >/dev/null 2>&1; then
    printf 'runner-admin\n'
  else
    die "neither root nor runner-admin SSH access works for ${host}"
  fi
}

download_provisioner() {
  TEMP_DIR=$(mktemp -d -t public-pr-arm64-pool.XXXXXX)
  local destination="${TEMP_DIR}/provision-hetzner-arm64-runner.sh"
  local actual_checksum

  log 'Downloading the pinned remote provisioner'
  curl -fsSL "$PROVISIONER_URL" -o "$destination"
  if command -v sha256sum >/dev/null 2>&1; then
    actual_checksum=$(sha256sum "$destination" | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    actual_checksum=$(shasum -a 256 "$destination" | awk '{print $1}')
  else
    die 'sha256sum or shasum is required to verify the provisioner'
  fi
  [[ "$actual_checksum" == "$PROVISIONER_SHA256" ]] ||
    die 'the downloaded provisioner checksum does not match the pinned revision'
  bash -n "$destination"
}

upload_provisioner() {
  local host=$1
  local ssh_user=$2
  local source="${TEMP_DIR}/provision-hetzner-arm64-runner.sh"
  local remote_temp

  log "Uploading the verified provisioner to ${host}"
  if [[ "$ssh_user" == 'root' ]]; then
    scp "${SSH_ARGS[@]}" "$source" "root@${host}:${REMOTE_PROVISIONER}"
    # Every interpolated value is a fixed path or checksum declared above.
    # shellcheck disable=SC2029
    ssh "${SSH_ARGS[@]}" "root@${host}" \
      "chmod 0700 '${REMOTE_PROVISIONER}' && printf '%s  %s\\n' '${PROVISIONER_SHA256}' '${REMOTE_PROVISIONER}' | sha256sum -c -"
    return
  fi

  remote_temp=$(ssh "${SSH_ARGS[@]}" "runner-admin@${host}" \
    'mktemp /home/runner-admin/provision-runner.XXXXXX')
  [[ "$remote_temp" =~ ^/home/runner-admin/provision-runner\.[A-Za-z0-9]+$ ]] ||
    die "unexpected temporary path returned by ${host}"
  scp "${SSH_ARGS[@]}" "$source" "runner-admin@${host}:${remote_temp}"
  # The temporary path is constrained by the expression above; other values
  # are fixed paths or checksums declared by this script.
  # shellcheck disable=SC2029
  ssh "${SSH_ARGS[@]}" "runner-admin@${host}" \
    "sudo -n install -m 0700 -o root -g root '${remote_temp}' '${REMOTE_PROVISIONER}' && rm -f -- '${remote_temp}' && printf '%s  %s\\n' '${PROVISIONER_SHA256}' '${REMOTE_PROVISIONER}' | sudo -n sha256sum -c -"
}

check_runner() {
  local host=$1
  local ssh_user=$2
  local runner_name=$3
  local remote_command

  remote_command="${REMOTE_PROVISIONER} --check --profile public-pr --runner-name ${runner_name}"
  if [[ "$ssh_user" == 'runner-admin' ]]; then
    remote_command="sudo -n ${remote_command}"
  fi
  # Host, user, and runner name are validated or fixed by this script.
  # shellcheck disable=SC2029
  ssh "${SSH_ARGS[@]}" "${ssh_user}@${host}" "$remote_command"
}

apply_runner() {
  local host=$1
  local ssh_user=$2
  local runner_name=$3
  local identity=${IDENTITY_FILE:--}

  log "Provisioning ${runner_name} on ${host}"
  check_runner "$host" "$ssh_user" "$runner_name"

  # The single-quoted program is Tcl for expect and expands only in expect.
  # shellcheck disable=SC2016
  printf '%s\n' "$GITHUB_TOKEN" | \
    ORCHESTRATOR_HOST="$host" \
    ORCHESTRATOR_SSH_USER="$ssh_user" \
    ORCHESTRATOR_RUNNER_NAME="$runner_name" \
    ORCHESTRATOR_IDENTITY="$identity" \
    ORCHESTRATOR_REMOTE_PROVISIONER="$REMOTE_PROVISIONER" \
    expect -c '
    set timeout 1200
    set token [gets stdin]
    set host $env(ORCHESTRATOR_HOST)
    set ssh_user $env(ORCHESTRATOR_SSH_USER)
    set runner_name $env(ORCHESTRATOR_RUNNER_NAME)
    set identity $env(ORCHESTRATOR_IDENTITY)
    set remote_provisioner $env(ORCHESTRATOR_REMOTE_PROVISIONER)

    set ssh_args [list \
      -o BatchMode=yes \
      -o ConnectTimeout=15 \
      -o ServerAliveInterval=15 \
      -o ServerAliveCountMax=4 \
      -o StrictHostKeyChecking=accept-new]
    if {$identity ne "-"} {
      lappend ssh_args -i $identity
    }

    set remote_command "$remote_provisioner --apply --profile public-pr --runner-name $runner_name"
    if {$ssh_user eq "runner-admin"} {
      set remote_command "sudo -n $remote_command"
    }
    set command [concat [list ssh -tt] $ssh_args [list "$ssh_user@$host" $remote_command]]
    spawn {*}$command
    set main_spawn_id $spawn_id

    expect {
      -re {Confirm Hetzner ARM64/Ubuntu.*\(yes/no\):[[:space:]]*$} {
        send -- "yes\r"
        exp_continue
      }
      -re {Confirm this persistent host.*\(yes/no\):[[:space:]]*$} {
        send -- "yes\r"
        exp_continue
      }
      -re {Short-lived GitHub token.*permission:[[:space:]]*$} {
        log_user 0
        send -- "$token\r"
        expect -re {Type exactly: APPLY RUNNER BOOTSTRAP:[[:space:]]*$}
        log_user 1
        send -- "APPLY RUNNER BOOTSTRAP\r"
        exp_continue
      }
      -re {Type exactly: APPLY RUNNER BOOTSTRAP:[[:space:]]*$} {
        send -- "APPLY RUNNER BOOTSTRAP\r"
        exp_continue
      }
      -re {Type exactly after the test succeeds: ADMIN LOGIN VERIFIED:[[:space:]]*$} {
        set verify_command [concat [list ssh] $ssh_args \
          [list "runner-admin@$host" "sudo -n true"]]
        spawn -noecho {*}$verify_command
        expect eof
        set verify_result [wait]
        if {[lindex $verify_result 3] != 0} {
          puts stderr "ERROR: runner-admin SSH verification failed"
          exit 1
        }
        set spawn_id $main_spawn_id
        send -- "ADMIN LOGIN VERIFIED\r"
        exp_continue
      }
      timeout {
        puts stderr "ERROR: provisioning timed out for $runner_name on $host"
        exit 1
      }
      eof {
        set wait_result [wait]
        set exit_status [lindex $wait_result 3]
        set token ""
        exit $exit_status
      }
    }
  '
}

verify_host() {
  local host=$1
  shift
  local runner_names=("$@")
  local units=()
  local runner_name

  for runner_name in "${runner_names[@]}"; do
    units+=("actions.runner.uzh-bf.${runner_name}.service")
  done

  log "Verifying ${host}"
  # Service names are generated only from the fixed runner allocation.
  # shellcheck disable=SC2029
  ssh "${SSH_ARGS[@]}" "runner-admin@${host}" \
    "sudo -n systemctl is-active ${units[*]} && sudo -n systemctl is-enabled ${units[*]} && sudo -n systemctl is-active docker && sudo -n systemctl is-enabled actions-runner-disk-cleanup.timer"
}

prompt_apply_confirmation() {
  local response

  cat >/dev/tty <<EOF

This provisions eight persistent runner processes on two disposable public-PR
hosts. Untrusted public PR code must never receive secrets, private source, or
private-network access. Existing runner names 01 through 08 must be removed
from GitHub before continuing.

Host A: ${HOST_A} (public-pr-arm64-01 through -04)
Host B: ${HOST_B} (public-pr-arm64-05 through -08)
EOF
  IFS= read -r -p 'Type exactly: PROVISION PUBLIC PR RUNNER POOL: ' response </dev/tty
  [[ "$response" == 'PROVISION PUBLIC PR RUNNER POOL' ]] ||
    die 'confirmation did not match; no remote changes were made'

  IFS= read -r -s -p \
    'Short-lived GitHub token with organization Self-hosted runners read/write permission: ' \
    GITHUB_TOKEN </dev/tty
  printf '\n' >/dev/tty
  [[ -n "$GITHUB_TOKEN" ]] || die 'GitHub token is required'
  [[ "$GITHUB_TOKEN" =~ ^[A-Za-z0-9_-]+$ ]] || die 'GitHub token has an unexpected format'
}

main() {
  local host_a_user host_b_user

  parse_args "$@"
  require_local_tools
  ssh_args
  host_a_user=$(select_ssh_user "$HOST_A")
  host_b_user=$(select_ssh_user "$HOST_B")
  remote_platform_check "$HOST_A" "$host_a_user"
  remote_platform_check "$HOST_B" "$host_b_user"

  if [[ "$MODE" == 'check' ]]; then
    log 'Both hosts passed the read-only platform checks'
    exit 0
  fi

  prompt_apply_confirmation
  download_provisioner
  upload_provisioner "$HOST_A" "$host_a_user"
  upload_provisioner "$HOST_B" "$host_b_user"

  apply_runner "$HOST_A" "$host_a_user" public-pr-arm64-01
  apply_runner "$HOST_B" "$host_b_user" public-pr-arm64-05

  apply_runner "$HOST_A" runner-admin public-pr-arm64-02
  apply_runner "$HOST_A" runner-admin public-pr-arm64-03
  apply_runner "$HOST_A" runner-admin public-pr-arm64-04
  apply_runner "$HOST_B" runner-admin public-pr-arm64-06
  apply_runner "$HOST_B" runner-admin public-pr-arm64-07
  apply_runner "$HOST_B" runner-admin public-pr-arm64-08

  verify_host "$HOST_A" \
    public-pr-arm64-01 public-pr-arm64-02 public-pr-arm64-03 public-pr-arm64-04
  verify_host "$HOST_B" \
    public-pr-arm64-05 public-pr-arm64-06 public-pr-arm64-07 public-pr-arm64-08

  GITHUB_TOKEN=''
  unset GITHUB_TOKEN
  log 'All eight public PR runners are active and enabled'
  printf 'Revoke the short-lived GitHub token now.\n'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
