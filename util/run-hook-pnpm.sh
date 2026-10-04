#!/usr/bin/env bash
# Runs one root pnpm script from a Git hook when this checkout has its own
# dependency install. Devcontainer checkouts keep node_modules in container
# volumes, so the host copy stays empty; host pnpm would then fail its
# verifyDepsBeforeRun check, and installing on the host would build a second,
# platform-specific dependency tree. Those checkouts skip the step with a
# notice instead: required CI runs the same checks and build on every push.
set -euo pipefail

script="${1:?usage: run-hook-pnpm.sh <root pnpm script>}"

if [[ -f node_modules/.modules.yaml ]]; then
  exec pnpm run "$script"
fi

echo "⚠ No dependency install in this checkout (devcontainer checkouts keep it in the container) — skipping 'pnpm run ${script}'. Required CI enforces it; see docs/getting-started.md to run it in the container."
