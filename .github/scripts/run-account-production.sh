#!/usr/bin/env bash
set -euo pipefail

if [ "${GITHUB_ACTIONS:-}" != true ] || [ "${CI:-}" != true ]; then
  echo 'Use pnpm playwright:host -- --production for local account tests.' >&2
  exit 1
fi

ROOT="$(pwd)"
node - <<'NODE'
const fs = require('node:fs')
const { REQUIRED_ACCOUNT_SPECS } = require('./.github/scripts/account-production-report.cjs')
const { productionSpecs } = require('./.github/scripts/get-shard-files.js')
const manifest = JSON.parse(fs.readFileSync('playwright/profiles.json'))
const files = fs.readdirSync('playwright/tests').filter(file => file.endsWith('.spec.ts')).sort()
require('node:assert/strict').deepEqual(productionSpecs(manifest, files).sort(), [...REQUIRED_ACCOUNT_SPECS])
fs.writeFileSync('account-production-specs.json', JSON.stringify(REQUIRED_ACCOUNT_SPECS))
NODE
mapfile -t SPECS < <(node -e 'for (const file of require("./account-production-specs.json")) console.log(`tests/${file}`)')

PIDS=()
cleanup() {
  local pid
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  for pid in "${PIDS[@]}"; do wait "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM
for app in backend-docker auth frontend-pwa frontend-manage; do
  node util/production-standalone.mjs start "$app" > "$ROOT/account-production-$app.log" 2>&1 &
  PIDS+=("$!")
done

node util/production-standalone.mjs ready
for pid in "${PIDS[@]}"; do kill -0 "$pid"; done

PLAYWRIGHT_JSON_OUTPUT_NAME="$ROOT/account-production-inventory.json" \
  pnpm --filter @klicker-uzh/playwright exec playwright test \
  --project=chromium --reporter=json --list "${SPECS[@]}"
PLAYWRIGHT_JSON_OUTPUT_NAME="$ROOT/account-production-result.json" \
  pnpm --filter @klicker-uzh/playwright exec playwright test \
  --project=chromium --reporter=json --retries=0 "${SPECS[@]}"
for pid in "${PIDS[@]}"; do kill -0 "$pid"; done
