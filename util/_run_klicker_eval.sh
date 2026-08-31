#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
FRAMEWORK_ROOT="$REPO_ROOT/evaluation/framework"
FRAMEWORK_RUNNER="$FRAMEWORK_ROOT/scripts/_run_eval.sh"

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ ! -x "$FRAMEWORK_RUNNER" ]; then
  echo "Error: evaluation framework is not initialized at $FRAMEWORK_ROOT" >&2
  echo "Run: git submodule update --init --checkout evaluation/framework" >&2
  exit 1
fi

if ! command -v rs-infisical-operator >/dev/null 2>&1; then
  echo "Error: rs-infisical-operator is required for the restricted Klicker evaluation profile" >&2
  exit 1
fi

if [ -z "${LITELLM_API_BASE:-}" ]; then
  echo "Error: LITELLM_API_BASE must point to the approved LiteLLM proxy" >&2
  exit 1
fi

DEFAULT_EVAL_MODEL='klickeruzh/azure/gpt-5.6-luna-high'
EFFECTIVE_EVAL_MODEL="${EVAL_MODEL:-$DEFAULT_EVAL_MODEL}"
if [ "$EFFECTIVE_EVAL_MODEL" = "$DEFAULT_EVAL_MODEL" ]; then
  EFFECTIVE_CAPABILITY_MODEL="${EVAL_MODEL_CAPABILITY_MODEL:-gpt-5.6-luna}"
else
  EFFECTIVE_CAPABILITY_MODEL="${EVAL_MODEL_CAPABILITY_MODEL:-}"
fi

EVAL_ENV=(env -u VIRTUAL_ENV)
if [ -z "$EFFECTIVE_CAPABILITY_MODEL" ]; then
  EVAL_ENV+=(-u EVAL_MODEL_CAPABILITY_MODEL)
fi
EVAL_ENV+=(
  "LITELLM_API_BASE=$LITELLM_API_BASE"
  "EVAL_MODEL=$EFFECTIVE_EVAL_MODEL"
  "EVAL_REASONING_EFFORT=${EVAL_REASONING_EFFORT:-high}"
  "EVAL_JUDGE_SINGLE_ATTEMPT=${EVAL_JUDGE_SINGLE_ATTEMPT:-true}"
  "EVAL_METRICS_PATH=${EVAL_METRICS_PATH:-$FRAMEWORK_ROOT/data/input/metrics/metrics.yaml}"
  "EVAL_TOOLS_PATH=${EVAL_TOOLS_PATH:-$REPO_ROOT/evaluation/data/tools/klicker_fineco.yaml}"
  "GT_ROOT_DIR=${GT_ROOT_DIR:-$REPO_ROOT/evaluation/data/ground_truth/klicker_fineco}"
  "DEFAULT_GT_DIR=${DEFAULT_GT_DIR:-$REPO_ROOT/evaluation/data/ground_truth/klicker_fineco}"
  "TOOL_PROFILE=${TOOL_PROFILE:-catalog_expert_v1}"
)
if [ -n "$EFFECTIVE_CAPABILITY_MODEL" ]; then
  EVAL_ENV+=("EVAL_MODEL_CAPABILITY_MODEL=$EFFECTIVE_CAPABILITY_MODEL")
fi

cd "$REPO_ROOT"

exec rs-infisical-operator --profile klicker-uzh-stg run \
  --map PIPELINES_LITELLM_API_KEY=LITELLM_API_KEY -- \
  "${EVAL_ENV[@]}" \
  uv run --project "$FRAMEWORK_ROOT" \
  "$FRAMEWORK_RUNNER" \
  --no-dotenv \
  "$@"
