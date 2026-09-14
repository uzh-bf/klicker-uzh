#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
readonly SCRIPT_DIR
readonly POOL_SCRIPT="${SCRIPT_DIR}/reconcile-public-pr-arm64-pool.sh"
readonly HOST_SCRIPT="${SCRIPT_DIR}/reconcile-hetzner-arm64-runner-host.sh"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

main() {
  bash -n "$POOL_SCRIPT"
  # shellcheck disable=SC1090,SC1091
  source "$POOL_SCRIPT"

  MODE=''
  HOST_A=''
  HOST_B=''
  parse_args --check --host-a 192.0.2.10 --host-b 192.0.2.11
  [[ "$MODE" == 'check' && "$HOST_A" == '192.0.2.10' && "$HOST_B" == '192.0.2.11' ]] ||
    fail 'two-host arguments were not parsed'
  [[ "$RECONCILER_REVISION" =~ ^[0-9a-f]{40}$ ]] || fail 'revision is not immutable'
  [[ "$RECONCILER_SHA256" =~ ^[0-9a-f]{64}$ ]] || fail 'checksum is invalid'
  [[ "$(checksum_file "$HOST_SCRIPT")" == "$RECONCILER_SHA256" ]] ||
    fail 'pinned checksum differs from the committed host payload'
  grep -Fq "${RECONCILER_REVISION}/util/reconcile-hetzner-arm64-runner-host.sh" \
    <<<"$RECONCILER_URL" || fail 'download URL is not pinned to the payload commit'
  if grep -Eq 'GH_TOKEN|GITHUB_TOKEN|runner-registration|config\.sh' "$POOL_SCRIPT"; then
    fail 'pool reconciler unexpectedly handles GitHub credentials or registration'
  fi
  printf 'PASS: public PR ARM64 pool reconciliation\n'
}

main "$@"
