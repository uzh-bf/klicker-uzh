#!/usr/bin/env bash
# Restore application prerequisites without changing retained database contents.
set -euo pipefail
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_ROOT/recover-bootstrap.sh"
