#!/usr/bin/env bash
set -euo pipefail

print_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] -- <command> [args...]

Description:
  Runs Infisical with the specified environment and command.

Options:
  --env ENVIRONMENT     Target environment: dev, dev-assessment, dev-cypress, dev-cleverreach, stg, prd (required)
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
    "dev"|"dev-assessment"|"dev-cypress"|"dev-cleverreach"|"stg"|"prd")
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
if [[ "$ENV" == "prd" ]]; then
    PROJECT_ID="742d8433-d76f-414f-aeeb-73a47b8edbbc"
else
    PROJECT_ID="4766eb9c-c0a2-413c-9673-6cffc42b541c"
fi

echo "🔐 Running in Infisical environment: $ENV (Project: $PROJECT_ID)"
echo "▶️ Command: ${ARGS[*]}"

# --- Execute command with secrets ---
infisical run --env="$ENV" --projectId="$PROJECT_ID" -- "${ARGS[@]}"
