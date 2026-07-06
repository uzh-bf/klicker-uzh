#!/bin/bash
set -e

DEST_DIR="./apps/analytics/prisma/schema"
TEMP_DIR=$(mktemp -d)

# cleanup on exit
trap 'rm -rf "$TEMP_DIR"' EXIT

# Run the real sync into a temp dir, then diff against the destination
"$(dirname "$0")/sync-schema.sh" "./packages/prisma/src/prisma/schema" "$TEMP_DIR"

# Copy analytics-specific py.prisma to the temp dir if it exists to avoid diff mismatch
if [ -f "$DEST_DIR/py.prisma" ]; then
  cp "$DEST_DIR/py.prisma" "$TEMP_DIR/py.prisma"
fi

if ! diff -q "$TEMP_DIR" "$DEST_DIR" > /dev/null; then
  echo "Prisma sync drift detected! Please run 'pnpm run prisma:sync' locally and commit the changes."
  diff -u "$TEMP_DIR" "$DEST_DIR" || true
  exit 1
else
  echo "Prisma schemas are in sync."
fi
