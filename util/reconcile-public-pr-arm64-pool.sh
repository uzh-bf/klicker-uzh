#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly RECONCILER_REVISION='3cdfdf8bd1c9d188b86b6d6e1e3cfd9587940e95'
readonly RECONCILER_SHA256='44f4003f34a1de7f82cc4e3c8626fd5c537aa133856114d4efd5014d69a53ddc'
readonly RECONCILER_URL="https://raw.githubusercontent.com/uzh-bf/klicker-uzh/${RECONCILER_REVISION}/util/reconcile-hetzner-arm64-runner-host.sh"
readonly REMOTE_RECONCILER='/root/reconcile-hetzner-arm64-runner-host.sh'
readonly CONFIRMATION='RECONCILE PUBLIC PR RUNNER POOL'

MODE=''
HOST_A=''
HOST_B=''
IDENTITY_FILE=''
TEMP_DIR=''
PAYLOAD_FILE=''
SSH_ARGS=()

usage() {
  printf '%s\n' \
    'Check or optimize the two existing public PR ARM64 runner hosts.' \
    '' \
    'Usage:' \
    '  reconcile-public-pr-arm64-pool.sh --check --host-a HOST --host-b HOST [--identity FILE]' \
    '  reconcile-public-pr-arm64-pool.sh --apply --host-a HOST --host-b HOST [--identity FILE]' \
    '' \
    'Options:' \
    '  --host-a HOST    Host for public-pr-arm64-01 through -04.' \
    '  --host-b HOST    Host for public-pr-arm64-05 through -08.' \
    '  --identity FILE  Optional SSH private key.' \
    '' \
    '--check streams a checksum-verified payload to both hosts and makes no' \
    'persistent remote change. --apply first checks both idle hosts, asks once,' \
    'then installs bounded telemetry, pre-pulls CI images, updates hook settings,' \
    'and restarts the existing runner services. No GitHub token is required.'
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '\n==> %s\n' "$*"
}

cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    case "$TEMP_DIR" in
      /tmp/public-pr-arm64-reconcile.* | /var/folders/*/public-pr-arm64-reconcile.*)
        rm -rf -- "$TEMP_DIR"
        ;;
      *)
        printf 'Refusing to remove unexpected temporary path: %s\n' "$TEMP_DIR" >&2
        ;;
    esac
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
  for tool in bash curl scp ssh; do
    command -v "$tool" >/dev/null 2>&1 || die "required local tool is missing: ${tool}"
  done
  if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
    die 'sha256sum or shasum is required'
  fi
}

configure_ssh_args() {
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

checksum_file() {
  local file=$1
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  else
    shasum -a 256 "$file" | awk '{print $1}'
  fi
}

download_payload() {
  local actual_checksum
  TEMP_DIR=$(mktemp -d -t public-pr-arm64-reconcile.XXXXXX)
  PAYLOAD_FILE="${TEMP_DIR}/reconcile-hetzner-arm64-runner-host.sh"
  log 'Downloading the pinned host reconciler'
  curl -fsSL "$RECONCILER_URL" -o "$PAYLOAD_FILE"
  actual_checksum=$(checksum_file "$PAYLOAD_FILE")
  [[ "$actual_checksum" == "$RECONCILER_SHA256" ]] ||
    die 'host reconciler checksum does not match the pinned revision'
  bash -n "$PAYLOAD_FILE"
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

remote_check() {
  local host=$1 ssh_user=$2 slot=$3 remote_command='bash -s -- --check'
  [[ "$slot" == 'a' || "$slot" == 'b' ]] || die 'invalid host slot'
  if [[ "$ssh_user" == 'runner-admin' ]]; then
    remote_command='sudo -n bash -s -- --check'
  fi
  log "Checking ${host} (slot ${slot})"
  # Host and user are validated; the command is selected from fixed strings.
  # shellcheck disable=SC2029
  ssh "${SSH_ARGS[@]}" "${ssh_user}@${host}" \
    "${remote_command} --host-slot ${slot}" <"$PAYLOAD_FILE"
}

upload_payload() {
  local host=$1 ssh_user=$2 remote_temp
  log "Installing the verified host reconciler on ${host}"
  if [[ "$ssh_user" == 'root' ]]; then
    scp "${SSH_ARGS[@]}" "$PAYLOAD_FILE" "root@${host}:${REMOTE_RECONCILER}"
    # Every interpolated value is a fixed path or checksum.
    # shellcheck disable=SC2029
    ssh "${SSH_ARGS[@]}" "root@${host}" \
      "chmod 0700 '${REMOTE_RECONCILER}' && printf '%s  %s\\n' '${RECONCILER_SHA256}' '${REMOTE_RECONCILER}' | sha256sum -c -"
    return
  fi

  remote_temp=$(ssh "${SSH_ARGS[@]}" "runner-admin@${host}" \
    'mktemp /home/runner-admin/reconcile-runner.XXXXXX')
  [[ "$remote_temp" =~ ^/home/runner-admin/reconcile-runner\.[A-Za-z0-9]+$ ]] ||
    die "unexpected temporary path returned by ${host}"
  scp "${SSH_ARGS[@]}" "$PAYLOAD_FILE" "runner-admin@${host}:${remote_temp}"
  # The temporary path is constrained above; other values are fixed.
  # shellcheck disable=SC2029
  ssh "${SSH_ARGS[@]}" "runner-admin@${host}" \
    "sudo -n install -m 0700 -o root -g root '${remote_temp}' '${REMOTE_RECONCILER}' && rm -f -- '${remote_temp}' && printf '%s  %s\\n' '${RECONCILER_SHA256}' '${REMOTE_RECONCILER}' | sudo -n sha256sum -c -"
}

remote_apply() {
  local host=$1 ssh_user=$2 slot=$3 remote_command
  remote_command="${REMOTE_RECONCILER} --apply --host-slot ${slot}"
  if [[ "$ssh_user" == 'runner-admin' ]]; then
    remote_command="sudo -n ${remote_command}"
  fi
  log "Optimizing ${host} (slot ${slot})"
  # Host, user, slot, and remote command are validated or fixed.
  # shellcheck disable=SC2029
  printf '%s\n' 'RECONCILE PUBLIC PR RUNNER HOST' |
    ssh "${SSH_ARGS[@]}" "${ssh_user}@${host}" "$remote_command"
}

prompt_confirmation() {
  local response
  printf '%s\n' \
    '' \
    'This changes both existing public-PR hosts but does not reset or register runners.' \
    "Host A: ${HOST_A} (public-pr-arm64-01 through -04)" \
    "Host B: ${HOST_B} (public-pr-arm64-05 through -08)" >/dev/tty
  IFS= read -r -p "Type exactly: ${CONFIRMATION}: " response </dev/tty
  [[ "$response" == "$CONFIRMATION" ]] || die 'confirmation did not match'
}

main() {
  local host_a_user host_b_user
  parse_args "$@"
  require_local_tools
  configure_ssh_args
  download_payload
  host_a_user=$(select_ssh_user "$HOST_A")
  host_b_user=$(select_ssh_user "$HOST_B")
  remote_check "$HOST_A" "$host_a_user" a
  remote_check "$HOST_B" "$host_b_user" b

  if [[ "$MODE" == 'check' ]]; then
    log 'Both public PR runner hosts passed the read-only checks'
    exit 0
  fi

  prompt_confirmation
  upload_payload "$HOST_A" "$host_a_user"
  upload_payload "$HOST_B" "$host_b_user"
  remote_apply "$HOST_A" "$host_a_user" a
  remote_apply "$HOST_B" "$host_b_user" b
  remote_check "$HOST_A" "$host_a_user" a
  remote_check "$HOST_B" "$host_b_user" b
  log 'Both public PR runner hosts match the optimized configuration'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
