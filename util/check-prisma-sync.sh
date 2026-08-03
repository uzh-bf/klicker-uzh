#!/bin/bash
set -e

DEST_DIR="./apps/analytics/prisma/schema"
TEMP_DIR=$(mktemp -d)

# cleanup on exit
trap 'rm -rf "$TEMP_DIR"' EXIT

# Run the real sync into a temp dir, then diff against the destination
"$(dirname "$0")/sync-schema.sh" "./packages/prisma/src/prisma/schema" "$TEMP_DIR"

# Copy Analytics-owned schema files to the temp dir to avoid diff mismatch.
# Analytics owns these files, so a missing one is a real failure the check must
# report clearly instead of passing over or failing with a raw cp error.
for filename in py.prisma datasource.prisma; do
  if [ ! -f "$DEST_DIR/$filename" ]; then
    echo "Missing Analytics-owned schema file: $DEST_DIR/$filename"
    echo "Restore it from git; 'pnpm run prisma:sync' does not generate Analytics-owned files."
    exit 1
  fi
  cp "$DEST_DIR/$filename" "$TEMP_DIR/$filename"
done

# The migrator image (packages/prisma/Dockerfile) pins the Prisma CLI by literal
# version; it must equal the packages/prisma devDependency or `migrate deploy`
# runs with a mismatched engine (this drift shipped once — see ADR-0001).
DOCKERFILE_PIN=$(grep -oE 'prisma@[0-9]+\.[0-9]+\.[0-9]+' ./packages/prisma/Dockerfile | head -1 | cut -d@ -f2)
DEVDEP_PIN=$(node -p "require('./packages/prisma/package.json').devDependencies.prisma")
if [ "$DOCKERFILE_PIN" != "$DEVDEP_PIN" ]; then
  echo "Prisma version drift: packages/prisma/Dockerfile pins prisma@$DOCKERFILE_PIN but packages/prisma/package.json devDependency is $DEVDEP_PIN."
  echo "Update the Dockerfile pin to match (and re-verify the migrator image by running it)."
  exit 1
fi

if ! diff -q "$TEMP_DIR" "$DEST_DIR" > /dev/null; then
  echo "Prisma sync drift detected! Please run 'pnpm run prisma:sync' locally and commit the changes."
  diff -u "$TEMP_DIR" "$DEST_DIR" || true
  exit 1
else
  echo "Prisma schemas are in sync."
fi
