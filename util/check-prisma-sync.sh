#!/bin/bash
set -e

DEST_DIR="./apps/analytics/prisma/schema"
TEMP_DIR=$(mktemp -d)

# cleanup on exit
trap 'rm -rf "$TEMP_DIR"' EXIT

# Run the real sync into a temp dir, then diff against the destination
"$(dirname "$0")/sync-schema.sh" "./packages/prisma/src/prisma/schema" "$TEMP_DIR"

# The SQLAlchemy analytics runtime has no Prisma generator. Its datasource file
# remains Analytics-owned so the mirrored schema is self-contained for review.
if [ ! -f "$DEST_DIR/datasource.prisma" ]; then
  echo "Missing Analytics-owned schema file: $DEST_DIR/datasource.prisma"
  echo "Restore it from git; 'pnpm run prisma:sync' does not generate Analytics-owned files."
  exit 1
fi
cp "$DEST_DIR/datasource.prisma" "$TEMP_DIR/datasource.prisma"

if ! diff -q "$TEMP_DIR" "$DEST_DIR" > /dev/null; then
  echo "Prisma sync drift detected! Please run 'pnpm run prisma:sync' locally and commit the changes."
  diff -u "$TEMP_DIR" "$DEST_DIR" || true
  exit 1
else
  echo "Prisma schemas are in sync."
fi
