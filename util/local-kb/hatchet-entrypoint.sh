#!/usr/bin/env bash
# Used only by the isolated local stack after its ownership preflight.
set -euo pipefail
umask 077

state="${LOCAL_KB_HATCHET_CONFIG_DIR:-/config}"
if [[ "$state" != /* || ! -d "$state" || -L "$state" ]]; then
  echo 'Hatchet requires an existing isolated configuration directory.' >&2
  exit 1
fi

case "${1:-}" in
  setup)
    # A partial setup keeps this claim so neither migrations nor token minting
    # are silently repeated after failure.
    mkdir "$state/.local-kb-setup"
    if ! ./hatchet-migrate >/dev/null 2>&1; then
      echo 'Hatchet migration failed; partial setup is retained.' >&2
      exit 1
    fi
    if ! ./hatchet-admin quickstart --skip certs --generated-config-dir "$state" --overwrite=false >/dev/null 2>&1; then
      echo 'Hatchet configuration preparation failed; partial setup is retained.' >&2
      exit 1
    fi
    if ! ./hatchet-admin authdisabled >/dev/null 2>&1; then
      echo 'The isolated stack requires the auth-disabled local Hatchet image.' >&2
      exit 1
    fi
    if [[ -e "$state/authdisabled-token" || -L "$state/authdisabled-token" ]]; then
      echo 'Refusing a preexisting local Hatchet token.' >&2
      exit 1
    fi
    if ! ./hatchet-admin token create --config "$state" --name authdisabled-default >"$state/authdisabled-token" 2>/dev/null; then
      echo 'Hatchet token preparation failed; partial setup is retained.' >&2
      exit 1
    fi
    if [[ ! -s "$state/authdisabled-token" ]]; then
      echo 'Hatchet token preparation produced no token.' >&2
      exit 1
    fi
    printf 'prepared\n' >"$state/.local-kb-setup/complete"
    ;;
  start)
    if [[ ! -f "$state/.local-kb-setup/complete" || ! -s "$state/authdisabled-token" ]]; then
      echo 'Explicit Hatchet setup must succeed before startup.' >&2
      exit 1
    fi
    exec ./hatchet-lite --config "$state"
    ;;
  *)
    echo 'Usage: hatchet-entrypoint.sh <setup|start>' >&2
    exit 2
    ;;
esac
