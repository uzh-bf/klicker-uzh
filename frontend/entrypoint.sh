#!/bin/sh
set -e

# run build on container startup
yarn install
yarn run build

# execute the main command
exec "$@"
