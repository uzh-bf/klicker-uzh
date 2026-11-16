#!/usr/bin/env bash
set -euo pipefail
# Trusted toolchain closure, including registry integrity for transitive packages.
control_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tool_prefix="${RUNNER_TEMP:?}/klicker-devrouter-locked"
mkdir -p "$tool_prefix"
cp "$control_root/.github/toolchains/devrouter/package.json" "$control_root/.github/toolchains/devrouter/package-lock.json" "$tool_prefix/"
(cd "$tool_prefix" && npm ci --ignore-scripts --no-audit --no-fund --workspaces=false)
# The runtime's host-executable guard excludes node_modules bin directories.
# Keep the locked install intact and expose only its executable through a clean
# sibling directory, as the global-prefix installer does.
test -x "$tool_prefix/node_modules/.bin/devrouter"
mkdir -p "$tool_prefix/bin"
ln -sfn ../node_modules/.bin/devrouter "$tool_prefix/bin/devrouter"
echo "$tool_prefix/bin" >> "${GITHUB_PATH:?}"
echo "KLICKER_DEVROUTER_BIN=$tool_prefix/bin/devrouter" >> "${GITHUB_ENV:?}"
