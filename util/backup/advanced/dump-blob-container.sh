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
  -h, --help            Show this help message and exit
EOF
}

# -------------------------------------------------------------------
# PARSE ARGS
# -------------------------------------------------------------------
ACCOUNT_NAME=""
ENVIRONMENT=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        dev|stg|prd)
            ENVIRONMENT="$1"
            shift
            ;;
        --account)
            ACCOUNT_NAME="$2"
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
if [[ -z "$ACCOUNT_NAME" ]]; then
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

# -------------------------------------------------------------------
# CONFIG
# -------------------------------------------------------------------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

BACKUP_ENCRYPTION_KEY="$(infisical secrets get BACKUP_ENCRYPTION_KEY --env=$ENVIRONMENT --plain)"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"

CONTAINER_NAMES=$(az storage container list \
  --account-name $ACCOUNT_NAME \
  --auth-mode login  --query "[].name" \
  -o tsv)
for CONTAINER_NAME in $CONTAINER_NAMES; do
    DUMP_DIR="$REPO_ROOT/util/backup/dumps/blob/$ACCOUNT_NAME/container/$CONTAINER_NAME"
    WORK_DIR="$DUMP_DIR/$TIMESTAMP"

    ARCHIVE_FILE="$DUMP_DIR/dump-$TIMESTAMP.tar.gz"
    ENCRYPTED_FILE="$ARCHIVE_FILE.gpg"
    CHECKSUM_FILE="$ENCRYPTED_FILE.sha256"

    # -------------------------------------------------------------------
    # PREP
    # -------------------------------------------------------------------
    # Ensure cleanup of temp files if script exits unexpectedly
    cleanup() {
        echo "Cleaning up temporary files..."
        rm -rf "$WORK_DIR"
        rm -f "$ARCHIVE_FILE"
    }
    trap cleanup EXIT

    mkdir -p "$DUMP_DIR" "$WORK_DIR"


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

    cleanup
    trap - EXIT
done