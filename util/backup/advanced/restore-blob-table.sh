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

# -------------------------------------------------------------------
# CONFIG
# -------------------------------------------------------------------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

PROJECT_ID="6ae965bb-3cf8-4d44-9658-9cd4d58f754c"
BACKUP_ENCRYPTION_KEY="$(infisical secrets get BACKUP_ENCRYPTION_KEY \
    --projectId="$PROJECT_ID" --env=prd --plain)"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"

DUMP_DIR="$REPO_ROOT/util/backup/dumps/blob/$ACCOUNT_NAME/table/$TABLE_NAME"
ENCRYPTED_FILE="$DUMP_DIR/latest"
CHECKSUM_FILE="$DUMP_DIR/latest.sha256"
DECRYPTED_FILE="$DUMP_DIR/dump-latest.json"

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
