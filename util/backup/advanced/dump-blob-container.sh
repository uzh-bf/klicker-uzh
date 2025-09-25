#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------------------
# HELP
# -------------------------------------------------------------------
print_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Description:
  Backup Azure Blob Storage containers with encryption and checksum validation.

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

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"

DUMP_DIR="$REPO_ROOT/util/backup/dumps/blob/$ACCOUNT_NAME/container/$CONTAINER_NAME"
WORK_DIR="$DUMP_DIR/$TIMESTAMP"

ARCHIVE_FILE="$DUMP_DIR/dump-$TIMESTAMP.tar.gz"
ENCRYPTED_FILE="$ARCHIVE_FILE.gpg"
CHECKSUM_FILE="$ENCRYPTED_FILE.sha256"

# -------------------------------------------------------------------
# PREP
# -------------------------------------------------------------------
mkdir -p "$DUMP_DIR" "$WORK_DIR"

# Ensure cleanup of temp files if script exits unexpectedly
cleanup() {
    rm -rf "$WORK_DIR"
    rm -f "$ARCHIVE_FILE"
}
trap cleanup EXIT

# -------------------------------------------------------------------
# DOWNLOAD BLOBS
# -------------------------------------------------------------------
az storage blob download-batch \
    --account-name "$ACCOUNT_NAME" \
    --source "$CONTAINER_NAME" \
    --destination "$WORK_DIR" \
    --auth-mode login

# -------------------------------------------------------------------
# CREATE TAR ARCHIVE (relative paths, avoids absolute path issue)
# -------------------------------------------------------------------
tar -czf "$ARCHIVE_FILE" -C "$DUMP_DIR" "$TIMESTAMP"

# -------------------------------------------------------------------
# ENCRYPT
# -------------------------------------------------------------------
gpg --batch --yes \
    --passphrase "$BACKUP_ENCRYPTION_KEY" \
    --cipher-algo AES256 \
    --symmetric \
    --output "$ENCRYPTED_FILE" \
    "$ARCHIVE_FILE"

ln -sf "$(basename "$ENCRYPTED_FILE")" "$DUMP_DIR/latest"

# -------------------------------------------------------------------
# GENERATE CHECKSUM
# -------------------------------------------------------------------
checksum=$(shasum -a 256 $ENCRYPTED_FILE | awk '{print $1}') 
echo "$checksum $(basename $ENCRYPTED_FILE)" > "$CHECKSUM_FILE"
ln -sf "$(basename "$CHECKSUM_FILE")" "$DUMP_DIR/latest.sha256"

# -------------------------------------------------------------------
# DONE
# -------------------------------------------------------------------
echo "✅ Backup complete:"
echo "   Encrypted: $(basename $ENCRYPTED_FILE)"
echo "   Checksum : $(basename $CHECKSUM_FILE)"
