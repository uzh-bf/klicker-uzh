#!/bin/bash
set -e

SOURCE_DIR="./packages/prisma/src/prisma/schema"
DEST_DIR="./apps/analytics/prisma/schema"
TEMP_DIR=$(mktemp -d)

# cleanup on exit
trap 'rm -rf "$TEMP_DIR"' EXIT

# Sync schemas to the temp dir
for file in "$SOURCE_DIR"/*.prisma; do
  filename=$(basename "$file")
  if [ "$filename" != "js.prisma" ]; then
    cp "$file" "$TEMP_DIR/$filename"
  fi
done

# Copy analytics-specific py.prisma to the temp dir if it exists to avoid diff mismatch
if [ -f "$DEST_DIR/py.prisma" ]; then
  cp "$DEST_DIR/py.prisma" "$TEMP_DIR/py.prisma"
fi

# Diff the temp dir against the destination directory
if ! diff -q "$TEMP_DIR" "$DEST_DIR" > /dev/null; then
  echo "Prisma sync drift detected! Please run 'pnpm run prisma:sync' locally and commit the changes."
  diff -u "$TEMP_DIR" "$DEST_DIR" || true
  exit 1
else
  echo "Prisma schemas are in sync."
fi
