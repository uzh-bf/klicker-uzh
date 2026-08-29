#!/usr/bin/env bash

set -euo pipefail

case "${1:-}" in
  --value)
    [ "$#" -eq 2 ] \
      || { echo "::error::pause guard --value requires exactly one value"; exit 1; }
    value="$2"
    ;;
  --live)
    [ "$#" -eq 1 ] \
      || { echo "::error::pause guard --live accepts no value"; exit 1; }
    : "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
    # Read through the API instead of reusing `${{ vars.* }}`: Actions resolves
    # contexts before a running job can observe a later operator change.
    value="$(
      gh api --paginate --slurp \
        "/repos/${GITHUB_REPOSITORY}/actions/variables?per_page=30" \
        --jq '[.[].variables[] | select(.name == "STG_PROMOTION_PAUSED") | .value][0] // ""'
    )"
    ;;
  *)
    echo "::error::pause guard requires --value or --live"
    exit 1
    ;;
esac

case "$value" in
  '') ;;
  false) ;;
  true)
    echo "::error::staging promotion is paused by STG_PROMOTION_PAUSED"
    exit 1
    ;;
  *)
    echo "::error::STG_PROMOTION_PAUSED must be exactly true, false, or unset"
    exit 1
    ;;
esac
