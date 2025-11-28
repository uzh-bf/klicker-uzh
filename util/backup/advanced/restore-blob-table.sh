#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------------------
# HELP
# -------------------------------------------------------------------
print_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Description:
  Restoure Azure Blob Storage tables with encryption and checksum validation.

Options:
  --account-name NAME        Azure Storage account name (required)
  --account-key KEY          Azure Storage account key (required)
  --table NAME               Azure Storage table name (required)
  -h, --help                 Show this help message and exit
EOF
}

# -------------------------------------------------------------------
# PARSE ARGS
# -------------------------------------------------------------------
ACCOUNT_NAME=""
ACCOUNT_KEY=""
TABLE_NAME=""
ENVIRONMENT=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --account-name)
            ACCOUNT_NAME="$2"
            shift 2
            ;;
        --account-key)
            ACCOUNT_KEY="$2"
            shift 2
            ;;
        --table-name)
            TABLE_NAME="$2"
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
if [[ -z "$ACCOUNT_NAME" || -z "$ACCOUNT_KEY" || -z "$TABLE_NAME" ]]; then
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
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"

DUMP_DIR="$REPO_ROOT/util/backup/dumps/blob/$ACCOUNT_NAME/table/$TABLE_NAME"
ENCRYPTED_FILE="$DUMP_DIR/latest"
CHECKSUM_FILE="$DUMP_DIR/latest.sha256"
DECRYPTED_FILE="$DUMP_DIR/dump-latest.json"

# =============================================================================
# PRODUCTION SAFETY CHECKS
# =============================================================================

if [[ "$ENVIRONMENT" == "prd" ]]; then
    echo ""
    echo "⚠️  PRODUCTION ENVIRONMENT DETECTED ⚠️"
    echo "======================================="
    echo ""
    echo "You are about to restore to the PRODUCTION blob storage table."
    echo "This operation will:"
    echo "  • Replace all existing production data"
    echo "  • Potentially cause service downtime"
    echo "  • Affect live users and applications"
    echo ""
    echo "Dump file: $ENCRYPTED_FILE"
    echo "Target: Production Blob Storage Table"
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
    echo "🚀 Proceeding with production blob storage table restore..."
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
# UPLOAD BLOBS
# -------------------------------------------------------------------
RESTORE_SCRIPT="$REPO_ROOT/util/backup/lib/restore_blob_table.py"

python3 "$RESTORE_SCRIPT" \
  --account-name $ACCOUNT_NAME \
  --account-key $ACCOUNT_KEY \
  --table-name $TABLE_NAME \
  --input $DECRYPTED_FILE

# -------------------------------------------------------------------
# DONE
# -------------------------------------------------------------------
echo "✅ Backup complete:"
echo "   Encrypted: $(basename $ENCRYPTED_FILE)"
echo "   Checksum : $(basename $CHECKSUM_FILE)"
