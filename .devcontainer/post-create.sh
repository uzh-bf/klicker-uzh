#!/usr/bin/env bash
# Prepare application prerequisites without resetting retained database contents.
# Fresh disposable databases require explicit initialization for this invocation.
set -euo pipefail
case "${KLICKER_LOCAL_KB_RUNTIME_ONLY:-0}" in
  0|1) ;;
  *) echo '[post-create] ERROR: invalid isolated runtime mode.' >&2; exit 1 ;;
esac
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$SCRIPT_ROOT/.devcontainer/recover-bootstrap.sh" "$@"
