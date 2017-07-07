#!/bin/sh
set -e

# embed environment variables
SENTRY=${SENTRY:-null}
LOGROCKET=${LOGROCKET:-null}

echo "Replacing environment variables..."
sed -i 's;__SENTRY__;"$SENTRY";g' ./src/lib/env.js
sed -i 's;__LOGROCKET__;"$LOGROCKET";g' ./src/lib/env.js

echo "Building application sources..."
yarn run build

# execute the main command
exec "$@"
