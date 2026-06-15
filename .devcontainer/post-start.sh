#!/usr/bin/env bash
# Runs on every container start. Launches the core apps (turbo dev) in the
# background so they are reachable through devrouter without a manual step.
set -euo pipefail
cd /workspaces/klicker-uzh

# Re-source the canonical env (DevPod truncates env_file values at '='), then the
# runtime Hatchet token written by post-create (if any). (GOTCHAS #1)
set -a
. /workspaces/klicker-uzh/.devcontainer/devcontainer.env
[ -f /workspaces/klicker-uzh/.devcontainer/.hatchet.env ] && . /workspaces/klicker-uzh/.devcontainer/.hatchet.env
set +a

# No-TTY pnpm hardening (see post-create.sh). (GOTCHAS #18)
export CI=true
export npm_config_verify_deps_before_run=false

# Double-start guard. The dev command runs `turbo run dev`, so the supervisor
# shows as "turbo run dev" in ps.
if pgrep -f "turbo run dev" >/dev/null 2>&1; then
  echo "[post-start] Dev servers already running."
  exit 0
fi

echo "[post-start] Starting core apps in the background (logs: /tmp/dev.log)..."
# PHASE 1: only backend + auth + frontend-pwa/manage/control (NOT response-api,
# hatchet workers, chat, lti, analytics, ...). Bypass the Infisical wrapper that
# the root `dev` script uses — the container owns its env. Fully detach so the
# DevPod agent pipe is released (else `devpod up` hangs). (GOTCHAS #2)
DEV_CMD='pnpm exec turbo run dev \
  --filter=@klicker-uzh/backend-docker \
  --filter=@klicker-uzh/auth \
  --filter=@klicker-uzh/frontend-pwa \
  --filter=@klicker-uzh/frontend-manage \
  --filter=@klicker-uzh/frontend-control \
  --concurrency 30'
setsid bash -c "$DEV_CMD" >/tmp/dev.log 2>&1 </dev/null &
disown 2>/dev/null || true

cat <<'EOF'
[post-start] Apps (via devrouter; first compile can take a minute):
[post-start]   API     -> https://api.klicker.localhost
[post-start]   Auth    -> https://auth.klicker.localhost
[post-start]   PWA     -> https://pwa.klicker.localhost
[post-start]   Manage  -> https://manage.klicker.localhost   (login: lecturer / abcd)
[post-start]   Control -> https://control.klicker.localhost
[post-start] Routes  -> on the host: for a in api auth pwa manage control db; do dev app run "$a"; done
[post-start] Logs    -> tail -f /tmp/dev.log
EOF
