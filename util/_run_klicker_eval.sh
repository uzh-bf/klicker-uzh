#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"

if [ "${1:-}" = "--" ]; then
  shift
fi

cd "$REPO_ROOT"

exec infisical run --env=dev -- \
  env -u VIRTUAL_ENV \
  EVAL_MODEL=gpt-5.6-luna \
  EVAL_REASONING_EFFORT=high \
  uv run --project evaluation/framework \
  evaluation/framework/scripts/_run_eval.sh \
  --metrics evaluation/framework/data/input/metrics/klicker_chatbot.yaml \
  "$@"
