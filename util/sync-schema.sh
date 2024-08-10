#!/bin/bash

SOURCE_DIR="../packages/prisma/src/prisma/schema"
DEST_DIR="../apps/analytics/prisma/schema"

for file in "$SOURCE_DIR"/*.prisma; do
  filename=$(basename "$file")
  if [ "$filename" != "js.prisma" ]; then
    cp "$file" "$DEST_DIR/$filename"
  fi
done
