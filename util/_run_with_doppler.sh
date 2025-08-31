#!/bin/bash

# -----------------------------------------------------------------------------
# Doppler Deploy Common Helper
#
# Centralises Doppler execution logic so each environment wrapper only needs
# to set `CONFIG` (e.g. stg, prd) and invoke this script with the command
# to execute (e.g. `helmfile`, `pnpm`, `npm run dev`, etc.).
#
# Workflow:
# 1. `CONFIG` must be defined by the caller. If not, we exit with error.
# 2. Attempt to run the provided command via:
#      doppler run --config "$CONFIG" -- "$CMD" "$@"
#    On success the script exits 0.
# 3. If that fails, check if we are running from an external drive
#    (`/Volumes/*` on macOS). Keychain auth often breaks there.
#    • If on external drive:
#        a. Look for service-token file named:
#           ~/.doppler-tokens/<git-root-directory>-$CONFIG
#        b. If token exists → export DOPPLER_TOKEN and retry doppler.
#        c. If token is missing → instruct user how to create a Service Token
#           in the Doppler dashboard, suggest naming it
#           `<project>-<config>`, and where to save it; then exit 1.
#        d. You can create a Service Token in the Doppler web UI under:
#           Projects → <your project> → <config> → Access tab → "Generate Service Token".
# 4. If not on an external drive and doppler still failed, prompt the user to
#    run `doppler login` and `doppler setup`, then exit 1.
#
# All arguments after the command are passed unchanged to the command (`"$CMD"`).
# The script is `set -euo pipefail` safe – it aborts on any error or unset var.
# -----------------------------------------------------------------------------

set -euo pipefail

if [[ -z "${CONFIG:-}" ]]; then
  CONFIG="dev"
  echo "ℹ️  CONFIG not set, defaulting to 'dev' environment"
fi

# Validate parameters – we expect at least one argument (the command to run)
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <command> [args ...]" >&2
  exit 1
fi

CMD="$1"
shift  # Remove the command from positional parameters, leaving only its args

# First, try Doppler normally
if doppler settings 2>/dev/null; then
  doppler run --config "$CONFIG" -- "$CMD" "$@"
  exit 0
fi

# If that failed, resolve current path and check if we're on an external drive
CURRENT_DIR="$(command -v realpath >/dev/null 2>&1 && realpath "$PWD" || pwd -P)"
if [[ "$CURRENT_DIR" == /Volumes/* ]]; then
  echo "⚠️  Detected external drive (resolved path: $CURRENT_DIR). Attempting alternative authentication..."

  # Check for existing service token specific to this project & config
  TOKEN_FILE="$HOME/.doppler-tokens/$(basename $(git rev-parse --show-toplevel 2>/dev/null || pwd))-$CONFIG"

  if [ -f "$TOKEN_FILE" ]; then
    export DOPPLER_TOKEN="$(cat "$TOKEN_FILE")"
    doppler run --config "$CONFIG" -- "$CMD" "$@"
    exit 0
  fi

  echo "❌ No service token found for external drive usage."
  echo ""

  # Determine closest doppler.yaml to fill in project/config placeholders
  DOPPLER_YAML=""
  SEARCH_DIR="$CURRENT_DIR"
  while [[ "$SEARCH_DIR" != "/" ]]; do
    if [[ -f "$SEARCH_DIR/doppler.yaml" ]]; then
      DOPPLER_YAML="$SEARCH_DIR/doppler.yaml"
      break
    fi
    SEARCH_DIR="$(dirname "$SEARCH_DIR")"
  done

  if [[ -n "$DOPPLER_YAML" ]]; then
    DOPPLER_PROJECT="$(grep -E '^\s*project:' "$DOPPLER_YAML" | head -n1 | awk '{print $2}')"
    DOPPLER_CONFIG="$(grep -E '^\s*config:' "$DOPPLER_YAML" | head -n1 | awk '{print $2}')"
  fi

  # Guidance for the user (also echoed to terminal)
echo "To fix this, create a Service Token for project '${DOPPLER_PROJECT:-<project>}' and config '${DOPPLER_CONFIG:-<config>}' in the Doppler dashboard (https://doppler.com)."
  echo "Name the token something like '${DOPPLER_PROJECT:-<project>}-${DOPPLER_CONFIG:-<config>}' so it's clear which environment it belongs to."
  echo "Copy the token and save it into: $TOKEN_FILE"
  echo ""
  echo "Example:"
  echo "  echo 'dp.st.your_generated_token' > $TOKEN_FILE"
  echo ""
  echo "After saving the token, rerun this script."
  exit 1
else
  # Not on external drive, but doppler still failed earlier
  echo "❌ Doppler command failed. Please run 'doppler login' and 'doppler setup'"
  exit 1
fi
