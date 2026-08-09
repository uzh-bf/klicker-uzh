#!/usr/bin/env bash
set -euo pipefail

print_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] -- <command> [args...]

Description:
  Runs Infisical with the specified environment and command.

Options:
  --env ENVIRONMENT     Target environment: dev, dev-assessment, dev-playwright, dev-cleverreach, stg, prd (required)
  -h, --help            Show this help message and exit

Example:
  $(basename "$0") --env stg -- pnpm run build
  $(basename "$0") pnpm run build --env dev
EOF
}

ENV=""
ARGS=()

# --- Parse args (in any order) ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --env)
            ENV="$2"
            shift 2
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            ARGS+=("$1")
            shift
            ;;
    esac
done

# --- Validate environment ---
case "$ENV" in
    "dev"|"dev-assessment"|"dev-playwright"|"dev-cleverreach"|"stg"|"prd")
        echo "🎯 Target environment: $ENV"
        ;;
    "")
        echo "❌ Missing --env argument."
        echo ""
        print_help
        exit 1
        ;;
    *)
        echo "❌ Invalid environment '$ENV'."
        echo ""
        print_help
        exit 1
        ;;
esac

# --- Ensure a command is provided ---
if [[ ${#ARGS[@]} -eq 0 ]]; then
    echo "❌ No command provided."
    echo ""
    print_help
    exit 1
fi

# --- Select Infisical project ---
ROOT_DIR=$(git rev-parse --show-toplevel)
CONFIG_FILE="$ROOT_DIR/.infisical.json"
PROJECT_ID=$(jq -r '.workspaceId' "$CONFIG_FILE")

echo "🔐 Running in Infisical environment: $ENV (Project: $PROJECT_ID)"
echo "▶️ Command: ${ARGS[*]}"

# --- Execute command with secrets ---
infisical run --watch --env="$ENV" --project-config-dir="$CONFIG_FILE" --projectId="$PROJECT_ID" -- "${ARGS[@]}"
