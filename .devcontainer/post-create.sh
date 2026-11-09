#!/usr/bin/env bash
# Prepare application prerequisites without resetting retained database contents.
# Fresh disposable databases require explicit initialization for this invocation.
set -euo pipefail
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$SCRIPT_ROOT/.devcontainer/recover-bootstrap.sh" "$@"
