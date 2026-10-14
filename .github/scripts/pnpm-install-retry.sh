#!/usr/bin/env bash
set -euo pipefail

# A restored pnpm store can miss, and dependency build scripts download native
# runtime binaries from third-party hosts (sharp's libvips archive is fetched
# from GitHub Releases). A single transient 5xx there fails an entire Playwright
# wave because every shard installs from the same cold store. Installation is
# idempotent, so retry a bounded number of times with backoff and let only a
# persistent failure stay fatal.

attempts="${PNPM_INSTALL_ATTEMPTS:-3}"
delay_seconds="${PNPM_INSTALL_RETRY_DELAY_SECONDS:-15}"

attempt=1
while [ "$attempt" -le "$attempts" ]; do
  if pnpm install "$@"; then
    exit 0
  else
    status=$?
  fi

  if [ "$attempt" -eq "$attempts" ]; then
    echo "::error::pnpm install failed after ${attempts} attempts (exit ${status})" >&2
    exit "$status"
  fi

  echo "::warning::pnpm install attempt ${attempt}/${attempts} failed (exit ${status}); retrying in ${delay_seconds}s" >&2
  sleep "$delay_seconds"
  delay_seconds=$(( delay_seconds * 2 ))
  attempt=$(( attempt + 1 ))
done
