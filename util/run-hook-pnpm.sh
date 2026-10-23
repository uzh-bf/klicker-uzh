#!/usr/bin/env bash
# Runs one root pnpm script from a Git hook when this checkout has its own
# dependency install. Devcontainer checkouts keep node_modules in container
# volumes, so the host copy stays empty; host pnpm would then fail its
# verifyDepsBeforeRun check, and installing on the host would build a second,
# platform-specific dependency tree. Those checkouts skip the step with a
# notice instead: required CI runs the same checks and build on every push.
set -euo pipefail

script="${1:?usage: run-hook-pnpm.sh <root pnpm script>}"

# The Playwright host launcher installs only its own filtered dependency tree
# and stamps it with a marker. A later full install rewrites .modules.yaml,
# which then becomes newer than the marker.
filtered_marker=node_modules/.playwright-host-filtered-install

# Launcher runs that predate the marker leave filtered installs unmarked.
# pnpm records whether the last install ran with a filter in its workspace
# state file, so that flag is authoritative for those markerless installs.
workspace_state=node_modules/.pnpm-workspace-state-v1.json

if [[ -f node_modules/.modules.yaml ]]; then
  if [[ ! -f "$filtered_marker" || node_modules/.modules.yaml -nt "$filtered_marker" ]] &&
    ! grep -q '"filteredInstall": *true' "$workspace_state" 2>/dev/null; then
    exec pnpm run "$script"
  fi
  echo "⚠ Only the Playwright host launcher's filtered install exists in this checkout — skipping 'pnpm run ${script}'. Required CI enforces it; see docs/getting-started.md to run it in the container."
  exit 0
fi

echo "⚠ No dependency install in this checkout (devcontainer checkouts keep it in the container) — skipping 'pnpm run ${script}'. Required CI enforces it; see docs/getting-started.md to run it in the container."
