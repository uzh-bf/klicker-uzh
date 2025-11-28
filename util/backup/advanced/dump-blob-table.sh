#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------------------
# HELP
# -------------------------------------------------------------------
print_help() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Description:
  Backup Azure Blob Storage tables with encryption and checksum validation.

Options:
  --account-name NAME        Azure Storage account name (required)
  --account-key KEY          Azure Storage account key (required)
  -h, --help                 Show this help message and exit
EOF
}

# -------------------------------------------------------------------
# PARSE ARGS
# -------------------------------------------------------------------
ACCOUNT_NAME=""
ACCOUNT_KEY=""
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
if [[ -z "$ACCOUNT_NAME" || -z "$ACCOUNT_KEY" ]]; then
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

TABLE_NAMES=$(az storage table list \
  --account-name $ACCOUNT_NAME \
  --auth-mode login  --query "[].name" \
  -o tsv)
for TABLE_NAME in $TABLE_NAMES; do
    DUMP_DIR="$REPO_ROOT/util/backup/dumps/blob/$ACCOUNT_NAME/table/$TABLE_NAME"
    WORK_DIR="$DUMP_DIR/$TIMESTAMP"

    ARCHIVE_FILE="$DUMP_DIR/dump-$TIMESTAMP.json"
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
    DUMP_SCRIPT="$REPO_ROOT/util/backup/lib/dump_blob_table.py"

    python3 "$DUMP_SCRIPT" \
    --account-name $ACCOUNT_NAME \
    --account-key $ACCOUNT_KEY \
    --table-name $TABLE_NAME \
    --output $ARCHIVE_FILE

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
done