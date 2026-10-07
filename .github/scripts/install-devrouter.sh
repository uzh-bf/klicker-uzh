#!/usr/bin/env bash
set -euo pipefail

# CI needs profile planning only; this installation never configures a router.
# Keep the reviewed tool release aligned with .devrouter.yml. During an upgrade
# this release may lead that pin: CI runs the installer from the trusted v3
# control checkout, so it must reach v3 before .devrouter.yml can require it.
tool_prefix="${RUNNER_TEMP:?}/klicker-devrouter"
npm install --global --prefix "$tool_prefix" --ignore-scripts --no-audit --no-fund '@devrouter/cli@0.2.0'
echo "$tool_prefix/bin" >> "${GITHUB_PATH:?}"
echo "KLICKER_DEVROUTER_BIN=$tool_prefix/bin/devrouter" >> "${GITHUB_ENV:?}"
