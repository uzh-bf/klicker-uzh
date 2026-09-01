#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRAMEWORK_ROOT="$REPO_ROOT/evaluation/framework"
FRAMEWORK_RUNNER="$FRAMEWORK_ROOT/scripts/_run_eval.sh"

if [ "${1:-}" = "--" ]; then
  shift
fi

LOCAL_TARGET=false
EVAL_ARGS=()
for arg in "$@"; do
  if [ "$arg" = "--local-target" ]; then
    LOCAL_TARGET=true
  else
    EVAL_ARGS+=("$arg")
  fi
done
set -- "${EVAL_ARGS[@]}"

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

cd "$REPO_ROOT"

if [ "$LOCAL_TARGET" = true ] && [ -z "${EVAL_METRICS_PATH:-}" ]; then
  EFFECTIVE_METRICS_PATH="$REPO_ROOT/evaluation/data/metrics/klicker_fineco_semantic_similarity.yaml"
else
  EFFECTIVE_METRICS_PATH="${EVAL_METRICS_PATH:-$FRAMEWORK_ROOT/data/input/metrics/metrics.yaml}"
fi
EFFECTIVE_TOOLS_PATH="${EVAL_TOOLS_PATH:-$REPO_ROOT/evaluation/data/tools/klicker_fineco.yaml}"
EFFECTIVE_GT_ROOT_DIR="${GT_ROOT_DIR:-$REPO_ROOT/evaluation/data/ground_truth/klicker_fineco}"
EFFECTIVE_DEFAULT_GT_DIR="${DEFAULT_GT_DIR:-$REPO_ROOT/evaluation/data/ground_truth/klicker_fineco}"
EFFECTIVE_LOCAL_GT_DIR="${KLICKER_EVAL_GT_DIR:-$EFFECTIVE_DEFAULT_GT_DIR}"

for ((index = 0; index < ${#EVAL_ARGS[@]}; index++)); do
  if [ "${EVAL_ARGS[$index]}" = "--gt-dir" ] && [ $((index + 1)) -lt ${#EVAL_ARGS[@]} ]; then
    gt_dir="${EVAL_ARGS[$((index + 1))]}"
    if [[ "$gt_dir" != /* ]]; then
      gt_dir="$REPO_ROOT/$gt_dir"
      EVAL_ARGS[$((index + 1))]="$gt_dir"
    fi
    EFFECTIVE_LOCAL_GT_DIR="$gt_dir"
  fi
done
set -- "${EVAL_ARGS[@]}"

require_readable_file() {
  local variable="$1"
  local path="$2"

  if [ ! -f "$path" ] || [ ! -r "$path" ]; then
    echo "Error: $variable must point to a readable file: $path" >&2
    exit 1
  fi
}

require_readable_directory() {
  local variable="$1"
  local path="$2"

  if [ ! -d "$path" ] || [ ! -r "$path" ] || [ ! -x "$path" ]; then
    echo "Error: $variable must point to a readable directory: $path" >&2
    exit 1
  fi
}

require_readable_file EVAL_METRICS_PATH "$EFFECTIVE_METRICS_PATH"
require_readable_file EVAL_TOOLS_PATH "$EFFECTIVE_TOOLS_PATH"
require_readable_directory GT_ROOT_DIR "$EFFECTIVE_GT_ROOT_DIR"
require_readable_directory DEFAULT_GT_DIR "$EFFECTIVE_DEFAULT_GT_DIR"

if [ "$LOCAL_TARGET" = true ]; then
  require_readable_directory KLICKER_EVAL_GT_DIR "$EFFECTIVE_LOCAL_GT_DIR"
  require_readable_file KLICKER_EVAL_CANARY_FILE "${KLICKER_EVAL_CANARY_FILE:-$REPO_ROOT/evaluation/data/canaries/klicker_local_mcp.json}"
fi

ADAPTER_PID=""
ADAPTER_TMP_DIR=""

TARGET_HELPER_PREFIX=(
  env
  -u AZURE_OPENAI_API_KEY
  -u AZURE_OPENAI_BASE_URL
  -u UPSTREAM_OPENAI_API_KEY
  -u UPSTREAM_OPENAI_BASE_URL
  -u OPENAI_API_KEY
  -u LITELLM_API_KEY
  -u EVAL_API_KEY
)

KEYGEN_PREFIX=(
  "${TARGET_HELPER_PREFIX[@]}"
  -u KLICKER_EVAL_API_ORIGIN
  -u KLICKER_EVAL_CHAT_ORIGIN
  -u KLICKER_EVAL_PARTICIPANT_USERNAME
  -u KLICKER_EVAL_PARTICIPANT_PASSWORD
  -u KLICKER_EVAL_TARGET_KEY
  -u KLICKER_EVAL_GT_DIR
  -u KLICKER_EVAL_CANARY_FILE
)

stop_local_target() {
  if [ -n "$ADAPTER_PID" ]; then
    kill "$ADAPTER_PID" 2>/dev/null || true
    wait "$ADAPTER_PID" 2>/dev/null || true
    ADAPTER_PID=""
  fi
}

cleanup_local_target() {
  local status=$?
  stop_local_target
  if [ -n "$ADAPTER_TMP_DIR" ]; then
    rm -rf "$ADAPTER_TMP_DIR"
    ADAPTER_TMP_DIR=""
  fi
  return "$status"
}

start_local_target() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Error: node is required for --local-target" >&2
    return 1
  fi
  for variable in \
    KLICKER_EVAL_API_ORIGIN \
    KLICKER_EVAL_CHAT_ORIGIN \
    KLICKER_EVAL_PARTICIPANT_USERNAME \
    KLICKER_EVAL_PARTICIPANT_PASSWORD; do
    if [ -z "${!variable:-}" ]; then
      echo "Error: $variable must be set for --local-target" >&2
      return 1
    fi
  done

  local target_key
  target_key="$("${KEYGEN_PREFIX[@]}" node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")" || {
    echo "Error: could not create the local evaluation target key" >&2
    return 1
  }
  if [ -z "$target_key" ]; then
    echo "Error: could not create the local evaluation target key" >&2
    return 1
  fi

  export KLICKER_EVAL_TARGET_KEY="$target_key"
  export EVAL_API_KEY="$target_key"
  export KLICKER_EVAL_GT_DIR="$EFFECTIVE_LOCAL_GT_DIR"
  export KLICKER_EVAL_CANARY_FILE="${KLICKER_EVAL_CANARY_FILE:-$REPO_ROOT/evaluation/data/canaries/klicker_local_mcp.json}"

  ADAPTER_TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/klicker-evaluation-target.XXXXXX")"
  local adapter_stdout="$ADAPTER_TMP_DIR/stdout"
  local adapter_stderr="$ADAPTER_TMP_DIR/stderr"
  "${TARGET_HELPER_PREFIX[@]}" node "$REPO_ROOT/apps/chat/scripts/klicker-evaluation-target.mjs" \
    >"$adapter_stdout" 2>"$adapter_stderr" &
  ADAPTER_PID=$!

  local port_line=""
  for _ in {1..100}; do
    if [ -s "$adapter_stdout" ]; then
      IFS= read -r port_line <"$adapter_stdout"
      break
    fi
    if ! kill -0 "$ADAPTER_PID" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  if [[ "$port_line" != KLICKER_EVAL_TARGET_PORT=* ]]; then
    echo "Error: local evaluation target did not start" >&2
    if [ -s "$adapter_stderr" ]; then
      sed -n '1,20p' "$adapter_stderr" >&2
    fi
    return 1
  fi

  LOCAL_TARGET_PORT="${port_line#KLICKER_EVAL_TARGET_PORT=}"
  if ! [[ "$LOCAL_TARGET_PORT" =~ ^[0-9]+$ ]] ||
    [ "$LOCAL_TARGET_PORT" -lt 1 ] || [ "$LOCAL_TARGET_PORT" -gt 65535 ]; then
    echo "Error: local evaluation target returned an invalid port" >&2
    return 1
  fi
}

if [ "$LOCAL_TARGET" = true ]; then
  trap cleanup_local_target EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  start_local_target || exit 1
fi

EVAL_ENV=(env -u VIRTUAL_ENV)
if [ "$LOCAL_TARGET" = true ]; then
  EVAL_ENV+=(
    -u KLICKER_EVAL_API_ORIGIN
    -u KLICKER_EVAL_CHAT_ORIGIN
    -u KLICKER_EVAL_PARTICIPANT_USERNAME
    -u KLICKER_EVAL_PARTICIPANT_PASSWORD
    -u KLICKER_EVAL_TARGET_KEY
    -u KLICKER_EVAL_GT_DIR
    -u KLICKER_EVAL_CANARY_FILE
    -u AZURE_OPENAI_API_KEY
    -u AZURE_OPENAI_BASE_URL
    -u UPSTREAM_OPENAI_API_KEY
    -u UPSTREAM_OPENAI_BASE_URL
    -u OPENAI_API_KEY
  )
fi
if [ -z "$EFFECTIVE_CAPABILITY_MODEL" ]; then
  EVAL_ENV+=(-u EVAL_MODEL_CAPABILITY_MODEL)
fi
EVAL_ENV+=(
  "LITELLM_API_BASE=$LITELLM_API_BASE"
  "EVAL_MODEL=$EFFECTIVE_EVAL_MODEL"
  "EVAL_REASONING_EFFORT=${EVAL_REASONING_EFFORT:-high}"
  "EVAL_JUDGE_SINGLE_ATTEMPT=${EVAL_JUDGE_SINGLE_ATTEMPT:-true}"
  "EVAL_METRICS_PATH=$EFFECTIVE_METRICS_PATH"
  "EVAL_TOOLS_PATH=$EFFECTIVE_TOOLS_PATH"
  "GT_ROOT_DIR=$EFFECTIVE_GT_ROOT_DIR"
  "DEFAULT_GT_DIR=$EFFECTIVE_DEFAULT_GT_DIR"
  "TOOL_PROFILE=${TOOL_PROFILE:-catalog_expert_v1}"
)
if [ -n "$EFFECTIVE_CAPABILITY_MODEL" ]; then
  EVAL_ENV+=("EVAL_MODEL_CAPABILITY_MODEL=$EFFECTIVE_CAPABILITY_MODEL")
fi

if [ "$LOCAL_TARGET" = true ]; then
  EVAL_ENV+=(
    "EVAL_API_MODE=chat-completions"
    "EVAL_ENDPOINT_URL=http://127.0.0.1:${LOCAL_TARGET_PORT}/v1/chat/completions"
    "EVAL_MODELS_URL=http://127.0.0.1:${LOCAL_TARGET_PORT}/v1/models"
    "EVAL_STREAM=false"
    "AGENT_ID=gpt-5.6-luna"
  )
fi

EVALUATOR_PREFIX=(
  env
  -u AZURE_OPENAI_API_KEY
  -u AZURE_OPENAI_BASE_URL
  -u UPSTREAM_OPENAI_API_KEY
  -u UPSTREAM_OPENAI_BASE_URL
  -u OPENAI_API_KEY
  -u LITELLM_API_KEY
)
if [ "$LOCAL_TARGET" = true ]; then
  EVALUATOR_PREFIX+=(
    -u KLICKER_EVAL_API_ORIGIN
    -u KLICKER_EVAL_CHAT_ORIGIN
    -u KLICKER_EVAL_PARTICIPANT_USERNAME
    -u KLICKER_EVAL_PARTICIPANT_PASSWORD
    -u KLICKER_EVAL_TARGET_KEY
    -u KLICKER_EVAL_GT_DIR
    -u KLICKER_EVAL_CANARY_FILE
  )
fi

EVALUATOR_COMMAND=(
  "${EVALUATOR_PREFIX[@]}"
  rs-infisical-operator
  --profile klicker-uzh-stg
  run
  --map PIPELINES_LITELLM_API_KEY=LITELLM_API_KEY
  --
  "${EVAL_ENV[@]}"
  bash
  -c
  '
    set -euo pipefail
    if [ -z "${LITELLM_API_KEY:-}" ]; then
      echo "Error: mapped LITELLM_API_KEY is missing or empty" >&2
      exit 1
    fi
    framework_root="$1"
    framework_runner="$2"
    shift 2
    exec uv run --project "$framework_root" \
      "$framework_runner" \
      --no-dotenv \
      "$@"
  '
  klicker-eval
  "$FRAMEWORK_ROOT"
  "$FRAMEWORK_RUNNER"
)

if [ "$LOCAL_TARGET" = true ]; then
  set +e
  "${EVALUATOR_COMMAND[@]}" "$@"
  status=$?
  exit "$status"
fi

exec "${EVALUATOR_COMMAND[@]}" "$@"
