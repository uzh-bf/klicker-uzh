#!/bin/bash
set -e
shopt -s nullglob

SOURCE_DIR="${1:-./packages/prisma/src/prisma/schema}"
DEST_DIR="${2:-./apps/analytics/prisma/schema}"

for file in "$SOURCE_DIR"/*.prisma; do
  filename=$(basename "$file")
  if [ "$filename" != "js.prisma" ] && [ "$filename" != "datasource.prisma" ]; then
    cp "$file" "$DEST_DIR/$filename"
  fi
done
