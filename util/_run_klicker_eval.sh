#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf '%s\n' \
    'Usage: util/_run_klicker_eval.sh [--] [launcher options] [framework options]' \
    '' \
    'Launcher options:' \
    '  --mode MODE, --mode=MODE  query, eval, query-eval, loadtest, routing, or safety' \
    '  --local-target             start the disposable loopback target for query modes' \
    '  --check                    report offline prerequisites without starting work' \
    '  --help, -h                 show this help without reading the framework' \
    '' \
    'Framework options are passed through with their original ordering.'
}

# Resolve help before touching the repository, checking tools, reading
# configuration, or looking up credentials. This keeps help usable in a
# checkout whose private framework submodule has not been initialized.
for initial_arg in "$@"; do
  if [ "$initial_arg" = '--help' ] || [ "$initial_arg" = '-h' ]; then
    usage
    exit 0
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRAMEWORK_ROOT="$REPO_ROOT/evaluation/framework"
FRAMEWORK_RUNNER="$FRAMEWORK_ROOT/scripts/_run_eval.sh"

# Explicit caller values win; missing judge settings come from one configured
# Infisical scope. No credentials are stored in the setup file or command argv.
JUDGE_SOURCE_NAMES=()
JUDGE_CONFIG_FIELDS=()

read_judge_config() {
  if [ -n "${LITELLM_API_BASE:-}" ] && [ -n "${LITELLM_API_KEY:-}" ]; then
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    echo 'Error: node is required to read evaluation configuration' >&2
    return 1
  fi
  local config_path="${KLICKER_EVAL_CONFIG:-$REPO_ROOT/evaluation/config.local.json}"
  if [[ "$config_path" != /* ]]; then
    config_path="$REPO_ROOT/$config_path"
  fi
  local metadata field
  if ! metadata="$(node "$SCRIPT_DIR/read-klicker-eval-config.mjs" "$config_path")"; then
    return 1
  fi
  JUDGE_CONFIG_FIELDS=()
  while IFS= read -r field; do
    JUDGE_CONFIG_FIELDS+=("$field")
  done <<< "$metadata"
  if [ "${#JUDGE_CONFIG_FIELDS[@]}" -ne 6 ]; then
    echo 'Error: invalid evaluation scope metadata' >&2
    return 1
  fi
  JUDGE_SOURCE_NAMES=("${JUDGE_CONFIG_FIELDS[4]}" "${JUDGE_CONFIG_FIELDS[5]}")
  if ! command -v infisical >/dev/null 2>&1; then
    echo 'Error: install the Infisical CLI to resolve the missing judge settings' >&2
    return 1
  fi
}

fetch_judge_setting() {
  local source="$1" destination="$2" fetched
  if ! fetched="$(infisical secrets get "$source" \
    --plain --silent --expand=false --include-imports=false \
    --recursive=false --secret-overriding=false --telemetry=false --log-level=error \
    --domain "${JUDGE_CONFIG_FIELDS[0]}" --projectId "${JUDGE_CONFIG_FIELDS[1]}" \
    --env "${JUDGE_CONFIG_FIELDS[2]}" --path "${JUDGE_CONFIG_FIELDS[3]}" \
    </dev/null 2>/dev/null)"; then
    echo "Error: Infisical lookup failed for $destination; check login, configured scope and access. CLI output was suppressed." >&2
    return 1
  fi
  if [ -z "$fetched" ] || [[ "$fetched" = *$'\n'* ]] || [[ "$fetched" = *$'\r'* ]]; then
    echo "Error: Infisical returned an empty or multiline value for $destination" >&2
    return 1
  fi
  export "$destination=$fetched"
}

resolve_judge_settings() {
  read_judge_config || return 1
  if [ "${#JUDGE_CONFIG_FIELDS[@]}" -eq 0 ]; then
    return 0
  fi
  local version
  version="$(infisical --version 2>/dev/null)" || {
    echo 'Error: could not determine the Infisical CLI version' >&2
    return 1
  }
  case "$version" in
    "infisical version 0.43."*) ;;
    *)
      echo 'Error: this launcher supports Infisical CLI 0.43.x; use that version or inject both judge variables' >&2
      return 1
      ;;
  esac
  if [ -z "${LITELLM_API_BASE:-}" ]; then
    fetch_judge_setting "${JUDGE_SOURCE_NAMES[0]}" LITELLM_API_BASE || return 1
  fi
  if [ -z "${LITELLM_API_KEY:-}" ]; then
    fetch_judge_setting "${JUDGE_SOURCE_NAMES[1]}" LITELLM_API_KEY || return 1
  fi
}


if [ "${1:-}" = "--" ]; then
  shift
fi

LOCAL_TARGET=false
CHECK_ONLY=false
MODE='query'
EVAL_ARGS=()
is_supported_mode() {
  case "$1" in
    query|eval|query-eval|loadtest|routing|safety)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

fail_mode() {
  echo "Error: unsupported evaluation mode '$1'" >&2
  echo 'Expected query, eval, query-eval, loadtest, routing, or safety.' >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  arg="$1"
  case "$arg" in
    --local-target)
      LOCAL_TARGET=true
      shift
      ;;
    --check)
      CHECK_ONLY=true
      shift
      ;;
    --mode)
      if [ "$#" -lt 2 ] || [ -z "${2:-}" ] || [[ "$2" = --* ]]; then
        echo 'Error: --mode requires a mode value' >&2
        exit 1
      fi
      MODE="$2"
      is_supported_mode "$MODE" || fail_mode "$MODE"
      EVAL_ARGS+=(--mode "$MODE")
      shift 2
      ;;
    --mode=*)
      MODE="${arg#--mode=}"
      if [ -z "$MODE" ]; then
        echo 'Error: --mode requires a mode value' >&2
        exit 1
      fi
      is_supported_mode "$MODE" || fail_mode "$MODE"
      # The pinned runner accepts a separate value only. Normalize the
      # convenience form before forwarding it.
      EVAL_ARGS+=(--mode "$MODE")
      shift
      ;;
    *)
      EVAL_ARGS+=("$arg")
      shift
      ;;
  esac
done

NEEDS_JUDGE=false
NEEDS_TARGET=true
case "$MODE" in
  eval)
    NEEDS_JUDGE=true
    NEEDS_TARGET=false
    ;;
  query-eval)
    NEEDS_JUDGE=true
    ;;
esac

if [ "$LOCAL_TARGET" = true ] && [ "$MODE" = 'eval' ]; then
  echo 'Error: --local-target cannot be used with eval mode' >&2
  exit 1
fi

set -- "${EVAL_ARGS[@]}"

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

require_environment_variable() {
  local variable="$1"

  if [ -z "${!variable:-}" ]; then
    echo "Error: $variable must be set for $MODE mode" >&2
    exit 1
  fi
}

resolve_input_path() {
  local path="$1"

  if [[ "$path" = /* ]]; then
    printf '%s' "$path"
  else
    printf '%s/%s' "$REPO_ROOT" "$path"
  fi
}

require_qa_files() {
  local value="$1"
  local path
  local part
  local rest="$value"
  local last_part=false
  local resolved=""

  while [ "$last_part" = false ]; do
    case "$rest" in
      *,*)
        part="${rest%%,*}"
        rest="${rest#*,}"
        ;;
      *)
        part="$rest"
        last_part=true
        ;;
    esac
    if [ -z "$part" ]; then
      echo 'Error: --qa-file contains an empty path' >&2
      exit 1
    fi
    require_readable_file '--qa-file' "$part"
    path="$(resolve_input_path "$part")"
    resolved="${resolved:+$resolved,}$path"
  done
  printf '%s' "$resolved"
}

validate_framework_args() {
  local index=0
  local argument_count="${#EVAL_ARGS[@]}"
  local arg
  local value
  local path

  HAS_GT_DIR_ARGUMENT=false
  HAS_SAFETY_FILE_ARGUMENT=false

  while [ "$index" -lt "$argument_count" ]; do
    arg="${EVAL_ARGS[$index]}"
    case "$arg" in
      --gt-dir|--qa-file|--metrics|--safety-file|--env|--limit|--concurrency|-c|--query-timeout|--mode|--eval-mode|--tool-profile)
        if [ $((index + 1)) -ge "$argument_count" ]; then
          echo "Error: $arg requires a value" >&2
          exit 1
        fi
        value="${EVAL_ARGS[$((index + 1))]}"
        if [ -z "$value" ] || [[ "$value" = --* ]]; then
          echo "Error: $arg requires a value" >&2
          exit 1
        fi
        case "$arg" in
          --gt-dir)
            path="$(resolve_input_path "$value")"
            EVAL_ARGS[$((index + 1))]="$path"
            EFFECTIVE_LOCAL_GT_DIR="$path"
            HAS_GT_DIR_ARGUMENT=true
            require_readable_directory '--gt-dir' "$value"
            ;;
          --qa-file)
            EVAL_ARGS[$((index + 1))]="$(require_qa_files "$value")"
            ;;
          --metrics)
            require_readable_file '--metrics' "$value"
            EFFECTIVE_METRICS_PATH="$(resolve_input_path "$value")"
            ;;
          --safety-file)
            HAS_SAFETY_FILE_ARGUMENT=true
            require_readable_file '--safety-file' "$value"
            EVAL_ARGS[$((index + 1))]="$(resolve_input_path "$value")"
            ;;
        esac
        index=$((index + 2))
        ;;
      --agent-id)
        index=$((index + 1))
        if [ "$index" -ge "$argument_count" ] || [[ "${EVAL_ARGS[$index]}" = --* ]]; then
          echo 'Error: --agent-id requires at least one value' >&2
          exit 1
        fi
        while [ "$index" -lt "$argument_count" ] && [[ "${EVAL_ARGS[$index]}" != --* ]]; do
          if [ -z "${EVAL_ARGS[$index]}" ]; then
            echo 'Error: --agent-id requires a nonempty value' >&2
            exit 1
          fi
          index=$((index + 1))
        done
        ;;
      --no-dotenv|--smoke|--all|--recursive)
        index=$((index + 1))
        ;;
      --*)
        echo "Error: unknown framework option: $arg" >&2
        exit 1
        ;;
      *)
        echo "Error: unexpected framework argument: $arg" >&2
        exit 1
        ;;
    esac
  done

  if [ "$MODE" = 'routing' ] && [ "$HAS_GT_DIR_ARGUMENT" != true ]; then
    echo 'Error: --gt-dir is required in routing mode' >&2
    exit 1
  fi
  if [ "$MODE" = 'safety' ] && [ "$HAS_SAFETY_FILE_ARGUMENT" != true ]; then
    echo 'Error: --safety-file is required in safety mode' >&2
    exit 1
  fi
}

# The runner changes into its own directory; preserve repository-relative inputs.
EFFECTIVE_METRICS_PATH="$(resolve_input_path "$EFFECTIVE_METRICS_PATH")"
EFFECTIVE_TOOLS_PATH="$(resolve_input_path "$EFFECTIVE_TOOLS_PATH")"
EFFECTIVE_GT_ROOT_DIR="$(resolve_input_path "$EFFECTIVE_GT_ROOT_DIR")"
EFFECTIVE_DEFAULT_GT_DIR="$(resolve_input_path "$EFFECTIVE_DEFAULT_GT_DIR")"
EFFECTIVE_LOCAL_GT_DIR="$(resolve_input_path "$EFFECTIVE_LOCAL_GT_DIR")"

validate_framework_args
set -- "${EVAL_ARGS[@]}"

CHECK_STATUS=0

check_tool() {
  local tool="$1"

  if command -v "$tool" >/dev/null 2>&1; then
    printf 'Tool %s: available\n' "$tool"
  else
    printf 'Tool %s: missing\n' "$tool"
    CHECK_STATUS=1
  fi
}

check_environment_variable() {
  local variable="$1"

  if [ -n "${!variable:-}" ]; then
    printf 'Variable %s: set\n' "$variable"
  else
    printf 'Variable %s: missing\n' "$variable"
    CHECK_STATUS=1
  fi
}

check_readable_file() {
  local variable="$1"
  local path="$2"

  if [ -f "$path" ] && [ -r "$path" ]; then
    printf 'Path %s: readable\n' "$variable"
  else
    printf 'Path %s: missing or unreadable\n' "$variable"
    CHECK_STATUS=1
  fi
}

check_readable_directory() {
  local variable="$1"
  local path="$2"

  if [ -d "$path" ] && [ -r "$path" ] && [ -x "$path" ]; then
    printf 'Path %s: readable\n' "$variable"
  else
    printf 'Path %s: missing or unreadable\n' "$variable"
    CHECK_STATUS=1
  fi
}

run_offline_check() {
  CHECK_STATUS=0
  printf '%s\n' 'Klicker evaluation launcher check'
  printf 'Selected mode: %s\n' "$MODE"
  printf 'Local target: %s\n' "$LOCAL_TARGET"
  printf 'Framework root: %s\n' "$FRAMEWORK_ROOT"

  if [ -x "$FRAMEWORK_RUNNER" ]; then
    printf '%s\n' 'Framework: initialized'
    if command -v git >/dev/null 2>&1; then
      local framework_revision
      framework_revision="$(git -C "$FRAMEWORK_ROOT" rev-parse HEAD 2>/dev/null || true)"
      if [ -n "$framework_revision" ]; then
        printf 'Framework revision: %s\n' "$framework_revision"
      else
        printf '%s\n' 'Framework revision: unavailable'
      fi
    else
      printf '%s\n' 'Framework revision: unavailable (git is missing)'
      CHECK_STATUS=1
    fi
  else
    printf '%s\n' 'Framework: missing or uninitialized'
    printf 'Next: git submodule update --init --checkout evaluation/framework\n'
    CHECK_STATUS=1
  fi

  check_tool uv
  if [ "$LOCAL_TARGET" = true ]; then
    check_tool node
  fi

  if [ "$NEEDS_TARGET" = true ]; then
    if [ "$LOCAL_TARGET" = true ]; then
      printf '%s\n' 'Required target variables: KLICKER_EVAL_API_ORIGIN KLICKER_EVAL_CHAT_ORIGIN KLICKER_EVAL_PARTICIPANT_USERNAME KLICKER_EVAL_PARTICIPANT_PASSWORD'
      check_environment_variable KLICKER_EVAL_API_ORIGIN
      check_environment_variable KLICKER_EVAL_CHAT_ORIGIN
      check_environment_variable KLICKER_EVAL_PARTICIPANT_USERNAME
      check_environment_variable KLICKER_EVAL_PARTICIPANT_PASSWORD
    else
      printf '%s\n' 'Required target variables: EVAL_ENDPOINT_URL EVAL_API_KEY'
      check_environment_variable EVAL_ENDPOINT_URL
      check_environment_variable EVAL_API_KEY
    fi
  fi

  if [ "$NEEDS_JUDGE" = true ]; then
    printf '%s\n' 'Required judge variables: LITELLM_API_BASE and LITELLM_API_KEY'
    if read_judge_config; then
      printf '%s\n' 'Judge configuration: supplied explicitly or scope metadata is valid'
    else
      CHECK_STATUS=1
    fi
    printf '%s\n' 'Authentication and judge access: untested (offline check)'
  else
    printf '%s\n' 'Judge variables: not required for this mode'
  fi

  if [ "$NEEDS_JUDGE" = true ]; then
    check_readable_file EVAL_METRICS_PATH "$EFFECTIVE_METRICS_PATH"
  else
    printf '%s\n' 'Path EVAL_METRICS_PATH: not required for target-only mode'
  fi
  check_readable_file EVAL_TOOLS_PATH "$EFFECTIVE_TOOLS_PATH"
  check_readable_directory GT_ROOT_DIR "$EFFECTIVE_GT_ROOT_DIR"
  check_readable_directory DEFAULT_GT_DIR "$EFFECTIVE_DEFAULT_GT_DIR"
  if [ "$LOCAL_TARGET" = true ]; then
    check_readable_directory KLICKER_EVAL_GT_DIR "$EFFECTIVE_LOCAL_GT_DIR"
    check_readable_file KLICKER_EVAL_CANARY_FILE \
      "${KLICKER_EVAL_CANARY_FILE:-$REPO_ROOT/evaluation/data/canaries/klicker_local_mcp.json}"
  fi

  if [ "$CHECK_STATUS" -eq 0 ]; then
    printf '%s\n' 'Result: offline prerequisites are present; authentication and model access remain untested.'
  else
    printf '%s\n' 'Result: prerequisites are incomplete; fix the reported items and run --check again.'
  fi
  return "$CHECK_STATUS"
}

if [ "$CHECK_ONLY" = true ]; then
  run_offline_check
  exit $?
fi

if [ ! -x "$FRAMEWORK_RUNNER" ]; then
  echo "Error: evaluation framework is not initialized at $FRAMEWORK_ROOT" >&2
  echo "Run: git submodule update --init --checkout evaluation/framework" >&2
  exit 1
fi



if [ "$NEEDS_JUDGE" = true ]; then
  require_readable_file EVAL_METRICS_PATH "$EFFECTIVE_METRICS_PATH"
fi
require_readable_file EVAL_TOOLS_PATH "$EFFECTIVE_TOOLS_PATH"
require_readable_directory GT_ROOT_DIR "$EFFECTIVE_GT_ROOT_DIR"
require_readable_directory DEFAULT_GT_DIR "$EFFECTIVE_DEFAULT_GT_DIR"

if [ "$LOCAL_TARGET" = true ]; then
  require_readable_directory KLICKER_EVAL_GT_DIR "$EFFECTIVE_LOCAL_GT_DIR"
  require_readable_file KLICKER_EVAL_CANARY_FILE "${KLICKER_EVAL_CANARY_FILE:-$REPO_ROOT/evaluation/data/canaries/klicker_local_mcp.json}"
fi

if [ "$NEEDS_TARGET" = true ]; then
  if [ "$LOCAL_TARGET" = true ]; then
    require_environment_variable KLICKER_EVAL_API_ORIGIN
    require_environment_variable KLICKER_EVAL_CHAT_ORIGIN
    require_environment_variable KLICKER_EVAL_PARTICIPANT_USERNAME
    require_environment_variable KLICKER_EVAL_PARTICIPANT_PASSWORD
  else
    require_environment_variable EVAL_ENDPOINT_URL
    require_environment_variable EVAL_API_KEY
  fi
fi

if ! command -v uv >/dev/null 2>&1; then
  echo 'Error: uv is required; install uv and prepare the pinned evaluation dependencies' >&2
  exit 1
fi

# Secret retrieval happens after all preflights so input failures never
# trigger a credential fetch.
if [ "$NEEDS_JUDGE" = true ]; then
  resolve_judge_settings
fi

# Source aliases never reach model or target children. Canonical variables
# remain available only until each child's existing environment filter applies.
for source_name in "${JUDGE_SOURCE_NAMES[@]}" PIPELINES_LITELLM_API_KEY; do
  case "$source_name" in
    LITELLM_API_BASE|LITELLM_API_KEY) ;;
    *) unset "$source_name" ;;
  esac
done

ADAPTER_PID=""
ADAPTER_TMP_DIR=""

TARGET_HELPER_PREFIX=(
  env
  -u AZURE_OPENAI_API_KEY
  -u AZURE_OPENAI_BASE_URL
  -u UPSTREAM_OPENAI_API_KEY
  -u UPSTREAM_OPENAI_BASE_URL
  -u OPENAI_API_KEY
  -u LITELLM_API_BASE
  -u LITELLM_API_KEY
  -u EVAL_API_KEY
  -u INFISICAL_TOKEN
  -u INFISICAL_CLIENT_SECRET
  -u INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET
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
  "EVAL_MODEL=$EFFECTIVE_EVAL_MODEL"
  "EVAL_REASONING_EFFORT=${EVAL_REASONING_EFFORT:-high}"
  "EVAL_JUDGE_SINGLE_ATTEMPT=${EVAL_JUDGE_SINGLE_ATTEMPT:-true}"
  "EVAL_METRICS_PATH=$EFFECTIVE_METRICS_PATH"
  "EVAL_TOOLS_PATH=$EFFECTIVE_TOOLS_PATH"
  "GT_ROOT_DIR=$EFFECTIVE_GT_ROOT_DIR"
  "DEFAULT_GT_DIR=$EFFECTIVE_DEFAULT_GT_DIR"
  "TOOL_PROFILE=${TOOL_PROFILE:-catalog_expert_v1}"
)
if [ "$NEEDS_JUDGE" = true ]; then
  export LITELLM_API_BASE LITELLM_API_KEY
fi
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
  -u INFISICAL_TOKEN
  -u INFISICAL_CLIENT_SECRET
  -u INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET
)
if [ "$NEEDS_TARGET" != true ]; then
  EVALUATOR_PREFIX+=(-u EVAL_API_KEY -u EVAL_ENDPOINT_URL -u EVAL_MODELS_URL)
fi
if [ "$NEEDS_JUDGE" != true ]; then
  EVALUATOR_PREFIX+=(-u LITELLM_API_BASE -u LITELLM_API_KEY)
fi
EVALUATOR_PREFIX+=(
  -u KLICKER_EVAL_API_ORIGIN
  -u KLICKER_EVAL_CHAT_ORIGIN
  -u KLICKER_EVAL_PARTICIPANT_USERNAME
  -u KLICKER_EVAL_PARTICIPANT_PASSWORD
  -u KLICKER_EVAL_TARGET_KEY
  -u KLICKER_EVAL_GT_DIR
  -u KLICKER_EVAL_CANARY_FILE
)

EVALUATOR_COMMAND=(
  "${EVALUATOR_PREFIX[@]}"
  "${EVAL_ENV[@]}"
  uv
  run
  --frozen
  --project
  "$FRAMEWORK_ROOT"
  "$FRAMEWORK_RUNNER"
  --no-dotenv
)

if [ "$LOCAL_TARGET" = true ]; then
  set +e
  "${EVALUATOR_COMMAND[@]}" "$@"
  status=$?
  exit "$status"
fi

exec "${EVALUATOR_COMMAND[@]}" "$@"
