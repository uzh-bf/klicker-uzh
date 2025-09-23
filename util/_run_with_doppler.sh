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
#        a. Look for service-token file named (new):
#           ~/.doppler-tokens/<doppler-project>-$CONFIG
#           Fallback (legacy): ~/.doppler-tokens/<repo-root-basename>-$CONFIG
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

# Function for logging with timestamps
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Function for error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

if [[ -z "${CONFIG:-}" ]]; then
  CONFIG="dev"
  echo "ℹ️  CONFIG not set, defaulting to 'dev' environment"
fi

# Validate parameters – we expect at least one argument (the command to run)
if [[ $# -lt 1 ]]; then
  error_exit "Usage: $0 <command> [args ...]"
fi

CMD="$1"
shift  # Remove the command from positional parameters, leaving only its args

log "Attempting to run command '$CMD' with Doppler config '$CONFIG'"

# First, try Doppler normally
if doppler settings 2>/dev/null; then
  log "Doppler is properly configured, running command..."
  if ! doppler run --config "$CONFIG" -- "$CMD" "$@"; then
    error_exit "Command failed when executed via Doppler"
  fi
  log "Command completed successfully"
  exit 0
fi
# If that failed, resolve current path and check if we're on an external drive
log "Doppler authentication failed, checking for external drive..."
CURRENT_DIR="$(command -v realpath > /dev/null 2>&1 && realpath "$PWD" || pwd -P)"
if [[ "$CURRENT_DIR" == /Volumes/* ]]; then
  log "Detected external drive (resolved path: $CURRENT_DIR). Attempting alternative authentication..."

  # Determine closest doppler.yaml to derive the Doppler project/config
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
    # Prefer explicit CONFIG from env; fall back to doppler.yaml config for messaging
    DOPPLER_CONFIG_YAML="$(grep -E '^\s*config:' "$DOPPLER_YAML" | head -n1 | awk '{print $2}')"
  fi

  # Use stable token key based on Doppler project (not Git worktree/branch)
  TOKEN_KEY="${DOPPLER_PROJECT:-}"
  if [[ -z "$TOKEN_KEY" ]]; then
    # Fallback: try to derive a stable repo name from remote origin url
    ORIGIN_URL="$(git config --get remote.origin.url 2>/dev/null || true)"
    if [[ -n "$ORIGIN_URL" ]]; then
      # Extract last path segment without .git
      TOKEN_KEY="$(basename "$ORIGIN_URL" 2>/dev/null | sed 's/\.git$//')"
    else
      # Final fallback: basename of repo root (legacy, may include worktree/branch suffix)
      TOKEN_KEY="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"
    fi
  fi

  TOKEN_FILE_NEW="$HOME/.doppler-tokens/${TOKEN_KEY}-${CONFIG}"
  # Legacy pattern (pre-change): repo-root-basename + -CONFIG
  TOKEN_FILE_LEGACY="$HOME/.doppler-tokens/$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")-$CONFIG"

  # Prefer the new stable location; fall back to legacy if present
  if [ -f "$TOKEN_FILE_NEW" ]; then
    export DOPPLER_TOKEN="$(cat "$TOKEN_FILE_NEW")"
    doppler run --config "$CONFIG" -- "$CMD" "$@"
    exit 0
  elif [ -f "$TOKEN_FILE_LEGACY" ]; then
    echo "ℹ️  Using legacy token file: $TOKEN_FILE_LEGACY"
    echo "    Consider migrating it to: $TOKEN_FILE_NEW"
    export DOPPLER_TOKEN="$(cat "$TOKEN_FILE_LEGACY")"
    doppler run --config "$CONFIG" -- "$CMD" "$@"
    exit 0
  fi

  echo "No service token found for external drive usage."
  echo ""

  # Guidance for the user (also echoed to terminal)
  echo "To fix this, create a Service Token for project '${DOPPLER_PROJECT:-<project>}' and config '${CONFIG}' in the Doppler dashboard (https://doppler.com)."
  echo "Name the token something like '${DOPPLER_PROJECT:-<project>}-$CONFIG' so it's clear which environment it belongs to."
  echo "Copy the token and save it into: $TOKEN_FILE_NEW"
  echo ""
  echo "Example:"
  echo "  echo 'dp.st.your_generated_token' > $TOKEN_FILE_NEW"
  echo ""
  echo "After saving the token, rerun this script."
  error_exit "Service token required for external drive usage"
else
  # Not on external drive, but doppler still failed earlier
  error_exit "Doppler command failed. Please run 'doppler login' and 'doppler setup'"
fi
