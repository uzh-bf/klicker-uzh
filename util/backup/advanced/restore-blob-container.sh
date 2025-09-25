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

# -------------------------------------------------------------------
# CONFIG
# -------------------------------------------------------------------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

PROJECT_ID="6ae965bb-3cf8-4d44-9658-9cd4d58f754c"
BACKUP_ENCRYPTION_KEY="$(infisical secrets get BACKUP_ENCRYPTION_KEY \
    --projectId="$PROJECT_ID" --env=prd --plain)"

DUMP_DIR="$REPO_ROOT/util/backup/dumps/blob/$ACCOUNT_NAME/container/$CONTAINER_NAME"
ENCRYPTED_FILE="$DUMP_DIR/latest"
CHECKSUM_FILE="$DUMP_DIR/latest.sha256"
DECRYPTED_FILE="$DUMP_DIR/dump-latest.tar.gz"

# -------------------------------------------------------------------
# CLEANUP HANDLER
# -------------------------------------------------------------------
cleanup() {
    rm -f "$DECRYPTED_FILE"
    [[ -n "${EXTRACTED_DIR:-}" ]] && rm -rf "$EXTRACTED_DIR"
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
