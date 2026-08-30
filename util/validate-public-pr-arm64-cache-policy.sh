#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
readonly SCRIPT_DIR
REPOSITORY_ROOT=$(cd -- "${SCRIPT_DIR}/.." && pwd)
readonly REPOSITORY_ROOT
readonly PUBLIC_WORKFLOW="${REPOSITORY_ROOT}/.github/workflows/public-pr-playwright-shards.yml"
readonly WARM_WORKFLOW="${REPOSITORY_ROOT}/.github/workflows/warm-public-pr-arm64-cache.yml"
readonly PNPM_KEY="key: \${{ runner.os }}-\${{ runner.arch }}-pnpm-store-\${{ hashFiles('**/pnpm-lock.yaml') }}"
readonly TURBO_KEY="key: \${{ runner.os }}-\${{ runner.arch }}-turbo-\${{ hashFiles('**/pnpm-lock.yaml', 'turbo.json') }}-\${{ github.ref_name }}"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

count_literal() {
  local file=$1 literal=$2 count
  count=$(grep -Fc "$literal" "$file" || true)
  printf '%s\n' "$count"
}

[[ -f "$PUBLIC_WORKFLOW" ]] || fail 'public Playwright workflow is missing'
[[ -f "$WARM_WORKFLOW" ]] || fail 'cache-warming workflow is missing'

[[ "$(count_literal "$PUBLIC_WORKFLOW" 'uses: actions/cache/restore@v4')" == '3' ]] ||
  fail 'public workflow must contain only its three restore-only cache actions'
if grep -Eq 'uses: actions/cache(@|/save@)' "$PUBLIC_WORKFLOW"; then
  fail 'public workflow must never save a GitHub Actions cache'
fi

[[ "$(count_literal "$WARM_WORKFLOW" 'uses: actions/cache@v4')" == '2' ]] ||
  fail 'trusted cache warmer must own exactly two read/write cache actions'
grep -Fq 'runs-on: ubuntu-24.04-arm' "$WARM_WORKFLOW" ||
  fail 'cache warmer must run on a trusted GitHub-hosted ARM64 runner'
if grep -Eq '^[[:space:]]*(pull_request|pull_request_target):' "$WARM_WORKFLOW"; then
  fail 'cache warmer must never run for pull-request events'
fi
if grep -Fq 'group: public-pr-arm64' "$WARM_WORKFLOW"; then
  fail 'cache warmer must never target the public self-hosted runner group'
fi

[[ "$(count_literal "$PUBLIC_WORKFLOW" "$PNPM_KEY")" == '2' ]] ||
  fail 'public workflow pnpm cache keys changed unexpectedly'
[[ "$(count_literal "$WARM_WORKFLOW" "$PNPM_KEY")" == '1' ]] ||
  fail 'cache warmer pnpm cache key does not match the public workflow'
[[ "$(count_literal "$PUBLIC_WORKFLOW" "$TURBO_KEY")" == '1' ]] ||
  fail 'public workflow Turbo cache key changed unexpectedly'
[[ "$(count_literal "$WARM_WORKFLOW" "$TURBO_KEY")" == '1' ]] ||
  fail 'cache warmer Turbo cache key does not match the public workflow'

printf 'PASS: public PR ARM64 cache policy\n'
