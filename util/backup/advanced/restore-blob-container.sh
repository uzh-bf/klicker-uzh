#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------------------
# HELP
# -------------------------------------------------------------------
print_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Description:
  Restore Azure Blob Storage containers with encryption and checksum validation.

Options:
  --account NAME        Azure Storage account name (required)
  --container NAME      Azure Storage container name (required)
  -h, --help            Show this help message and exit
EOF
}

# -------------------------------------------------------------------
# PARSE ARGS
# -------------------------------------------------------------------
ACCOUNT_NAME=""
CONTAINER_NAME=""
ENVIRONMENT=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --account)
            ACCOUNT_NAME="$2"
            shift 2
            ;;
        --container)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        dev|stg|prd)
            ENVIRONMENT="$1"
            shift
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            echo "[ERROR] Unknown option: $1"
            print_help
            exit 1
            ;;
    esac
done

# Validate required args
if [[ -z "$ACCOUNT_NAME" || -z "$CONTAINER_NAME" ]]; then
    echo "[ERROR] Missing required options."
    print_help
    exit 1
fi
case "$ENVIRONMENT" in
    "dev"|"stg"|"prd")
        echo "🎯 Target environment: $ENVIRONMENT"
        ;;
    *)
        echo "ERROR: Invalid environment '$ENVIRONMENT'. Valid environments: dev, stg, prd"
        echo ""
        show_usage
        exit 1
        ;;
esac
ROOT_DIR=$(git rev-parse --show-toplevel)
if [[ "$ENVIRONMENT" == "prd" ]]; then
    CONFIG_FILE="$ROOT_DIR/.infisical_prd.json"
else
    CONFIG_FILE="$ROOT_DIR/.infisical_stg.json"
fi
PROJECT_ID=$(jq -r '.workspaceId' "$CONFIG_FILE")

# -------------------------------------------------------------------
# CONFIG
# -------------------------------------------------------------------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

BACKUP_ENCRYPTION_KEY="$(infisical secrets get BACKUP_ENCRYPTION_KEY --env=$ENVIRONMENT --projectId="$PROJECT_ID" --plain)"

DUMP_DIR="$REPO_ROOT/util/backup/dumps/blob/$ACCOUNT_NAME/container/$CONTAINER_NAME"
ENCRYPTED_FILE="$DUMP_DIR/latest"
CHECKSUM_FILE="$DUMP_DIR/latest.sha256"
DECRYPTED_FILE="$DUMP_DIR/dump-latest.tar.gz"

# =============================================================================
# PRODUCTION SAFETY CHECKS
# =============================================================================

if [[ "$ENVIRONMENT" == "prd" ]]; then
    echo ""
    echo "⚠️  PRODUCTION ENVIRONMENT DETECTED ⚠️"
    echo "======================================="
    echo ""
    echo "You are about to restore to the PRODUCTION blob storage container."
    echo "This operation will:"
    echo "  • Replace all existing production data"
    echo "  • Potentially cause service downtime"
    echo "  • Affect live users and applications"
    echo ""
    echo "Dump file: $ENCRYPTED_FILE"
    echo "Target: Production Blob Storage Container"
    echo ""

    # Require explicit confirmation
    read -p "Are you absolutely sure you want to proceed? Type 'RESTORE PRODUCTION' to confirm: " confirmation

    if [[ "$confirmation" != "RESTORE PRODUCTION" ]]; then
        echo "❌ Production restore cancelled by user"
        exit 1
    fi

    echo ""
    echo "✅ Production restore confirmed"
    echo ""

    # Additional confirmation for extra safety
    read -p "Final confirmation - type 'YES' to proceed with production restore: " final_confirmation

    if [[ "$final_confirmation" != "YES" ]]; then
        echo "❌ Production restore cancelled by user"
        exit 1
    fi

    echo ""
    echo "🚀 Proceeding with production blob storage container restore..."
    echo ""
fi

# -------------------------------------------------------------------
# CLEANUP HANDLER
# -------------------------------------------------------------------
cleanup() {
    rm -f "$DECRYPTED_FILE"
    
    if [[ -n "${EXTRACTED_DIR:-}" && -d "$EXTRACTED_DIR" ]]; then
        case "$EXTRACTED_DIR" in
            /|/bin|/boot|/dev|/etc|/lib*|/proc|/root|/sbin|/sys|/usr|/var)
                echo "[ERROR] Refusing to delete critical path: $EXTRACTED_DIR"
                exit 1
                ;;
            *)
                rm -rf -- "$EXTRACTED_DIR"
                ;;
        esac
    fi
}
trap cleanup EXIT

# -------------------------------------------------------------------
# VALIDATE CHECKSUM
# -------------------------------------------------------------------
echo "[INFO] Validating checksum..."
checksum_expected=$(shasum -a 256 "$ENCRYPTED_FILE" | awk '{print $1}') 
checksum_actual=$(cat "$CHECKSUM_FILE" | awk '{print $1}')
if [[ "$checksum_expected" != "$checksum_actual" ]]; then
    echo "[ERROR] Checksum validation failed!"
    exit 1
fi
echo "[INFO] Checksum OK."

# -------------------------------------------------------------------
# DECRYPT
# -------------------------------------------------------------------
echo "[INFO] Decrypting backup..."
gpg --batch --yes \
    --passphrase "$BACKUP_ENCRYPTION_KEY" \
    --cipher-algo AES256 \
    --decrypt "$ENCRYPTED_FILE" > "$DECRYPTED_FILE"

# -------------------------------------------------------------------
# EXTRACT
# -------------------------------------------------------------------
echo "[INFO] Extracting tarball..."
FOLDER_NAME="$(tar -tzf "$DECRYPTED_FILE" | head -1 | cut -f1 -d"/")"
EXTRACTED_DIR="$DUMP_DIR/$FOLDER_NAME"

tar -xzf "$DECRYPTED_FILE" -C "$DUMP_DIR"

# -------------------------------------------------------------------
# UPLOAD BLOBS
# -------------------------------------------------------------------
echo "[INFO] Uploading blobs to container: $CONTAINER_NAME"
az storage blob upload-batch \
    --account-name "$ACCOUNT_NAME" \
    --destination "$CONTAINER_NAME" \
    --source "$EXTRACTED_DIR" \
    --overwrite \
    --auth-mode login

# -------------------------------------------------------------------
# DONE
# -------------------------------------------------------------------
echo "✅ Restore complete and uploaded to container: $CONTAINER_NAME"
