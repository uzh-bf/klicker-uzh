#!/bin/bash

# -----------------------------------------------------------------------------
# Doppler Deploy Common Helper
#
# Centralises all Doppler + Helmfile deployment logic so each environment
# wrapper only needs to set `CONFIG` (e.g. stg, prd) and invoke this script.
#
# Workflow:
# 1. `CONFIG` must be defined by the caller. If not, we exit with error.
# 2. Attempt a normal deploy via:
#      doppler run --config "$CONFIG" -- helmfile "$@"
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
# All arguments received are passed unchanged to Helmfile (`"$@"`).
# The script is `set -euo pipefail` safe – it aborts on any error or unset var.
# -----------------------------------------------------------------------------

set -euo pipefail

# Track generated secret values files for cleanup
declare -a GENERATED_SECRET_FILES=()

# Cleanup function to remove any generated .values*-SECRET.yaml files
cleanup() {
  if [[ ${#GENERATED_SECRET_FILES[@]} -gt 0 ]]; then
    for f in "${GENERATED_SECRET_FILES[@]}"; do
      if [[ -f "$f" ]]; then
        rm -f "$f"
        echo "🧹 Cleaned up $f"
      fi
    done
  fi
  # Backward compatibility: remove legacy single-file if present
  if [[ -f ".values-SECRET.yaml" ]]; then
    rm -f .values-SECRET.yaml
    echo "🧹 Cleaned up .values-SECRET.yaml"
  fi
}

# Set trap to run cleanup on script exit (success, failure, or interruption)
trap cleanup EXIT

# Generate secret values files from any values*-envsubst.yaml templates in cwd
generate_secret_values_files() {
  # Expand to empty list if no match
  shopt -s nullglob
  local templates=(values*-envsubst.yaml)

  if (( ${#templates[@]} == 0 )); then
    echo "ℹ️  No values*-envsubst.yaml templates found. Skipping secret generation."
    return 0
  fi

  for template in "${templates[@]}"; do
    # Derive suffix from template name: values[-X]-envsubst.yaml -> .values[-X]-SECRET.yaml
    local base="${template%-envsubst.yaml}"      # e.g., values or values-hatchet
    local suffix="${base#values}"                # e.g., "" or "-hatchet"
    local out=".values${suffix}-SECRET.yaml"     # e.g., .values-SECRET.yaml or .values-hatchet-SECRET.yaml

    echo "🔐 Generating $out from $template via envsubst..."
    doppler run --config "$CONFIG" -- bash -c "envsubst < \"$template\" > \"$out\""
    GENERATED_SECRET_FILES+=("$out")
  done
}

if [[ -z "${CONFIG:-}" ]]; then
  echo "CONFIG environment variable not set. Please set CONFIG before calling this script." >&2
  exit 1
fi

# First, try Doppler normally
if doppler settings 2>/dev/null; then
  echo "✅ Doppler is configured. Running helmfile with config '$CONFIG'..."
  generate_secret_values_files
  doppler run --config "$CONFIG" -- helmfile "$@"
  echo "✅ Deployment successful."
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
    echo "✅ Found service token in $TOKEN_FILE. Running helmfile with config '$CONFIG'..."
    generate_secret_values_files
    doppler run --config "$CONFIG" -- helmfile "$@"
    echo "✅ Deployment successful."
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
