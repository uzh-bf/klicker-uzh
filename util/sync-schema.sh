#!/bin/bash

# Mirror the Prisma schema from the TypeScript side into apps/analytics for
# local reference. The Python analytics app no longer *generates* from these
# files — `sqlacodegen` introspects the live dev DB instead (see
# `apps/analytics/src/models.py` and the `generate` script in
# `apps/analytics/package.json`). The copy here is kept around so anyone
# reviewing analytics code can read the authoritative schema without hopping
# between packages.

SOURCE_DIR="./packages/prisma/src/prisma/schema"
DEST_DIR="./apps/analytics/prisma/schema"

for file in "$SOURCE_DIR"/*.prisma; do
  filename=$(basename "$file")
  if [ "$filename" != "js.prisma" ]; then
    cp "$file" "$DEST_DIR/$filename"
  fi
done
