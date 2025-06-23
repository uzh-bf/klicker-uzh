#!/bin/bash

# Thin wrapper for PROD environment. All logic lives in ../_doppler_deploy_common.sh
# See that file for full documentation.

CONFIG="prd"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../_doppler_deploy_common.sh" "$@"

# source never returns on success; if we get here, something went wrong.
exit 1
