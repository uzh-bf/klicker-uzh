#!/bin/bash
set -e

DEST_DIR="./apps/analytics/prisma/schema"
TEMP_DIR=$(mktemp -d)

# cleanup on exit
trap 'rm -rf "$TEMP_DIR"' EXIT

# Run the real sync into a temp dir, then diff against the destination
"$(dirname "$0")/sync-schema.sh" "./packages/prisma/src/prisma/schema" "$TEMP_DIR"

# Copy Analytics-owned schema files to the temp dir to avoid diff mismatch.
for filename in py.prisma datasource.prisma; do
  cp "$DEST_DIR/$filename" "$TEMP_DIR/$filename"
done

if ! diff -q "$TEMP_DIR" "$DEST_DIR" > /dev/null; then
  echo "Prisma sync drift detected! Please run 'pnpm run prisma:sync' locally and commit the changes."
  diff -u "$TEMP_DIR" "$DEST_DIR" || true
  exit 1
else
  echo "Prisma schemas are in sync."
fi
