#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_WRAPPER="$REPO_ROOT/util/_run_klicker_eval.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

fail() {
  echo "[test-klicker-eval-wrapper] FAIL: $*" >&2
  exit 1
}

write_file() {
  local path="$1"
  local content="$2"

  mkdir -p "$(dirname "$path")"
  printf '%s\n' "$content" >"$path"
}

assert_line() {
  local expected="$1"
  local path="$2"

  grep -Fqx -- "$expected" "$path" ||
    fail "missing '$expected' in $path"
}

FAKE_BIN="$TEST_ROOT/bin"
FAKE_REPO="$TEST_ROOT/repo"
OPERATOR_LOG="$TEST_ROOT/operator.log"
CHILD_LOG="$TEST_ROOT/child.log"
mkdir -p "$FAKE_BIN"

write_file "$FAKE_BIN/rs-infisical-operator" '#!/usr/bin/env bash
printf "%s\n" "$@" >"$KLICKER_TEST_OPERATOR_LOG"
if [ -n "${KLICKER_TEST_OPERATOR_STATUS:-}" ]; then
  printf "%s\n" "synthetic operator stdout"
  printf "%s\n" "synthetic operator stderr" >&2
  exit "$KLICKER_TEST_OPERATOR_STATUS"
fi
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--" ]; then
    shift
    if [ "${KLICKER_TEST_EMPTY_SECRET:-false}" = "true" ]; then
      export LITELLM_API_KEY=""
    else
      export LITELLM_API_KEY="synthetic-test-key"
    fi
    exec "$@"
  fi
  shift
done
exit 2'

write_file "$FAKE_BIN/node" '#!/usr/bin/env bash
if [ "${1:-}" = "-e" ]; then
  printf "%s" "synthetic-target-key"
  exit 0
fi
if [ "${1:-}" = "$KLICKER_TEST_ADAPTER_SCRIPT" ]; then
  trap "printf \"%s\\n\" stopped >\"$KLICKER_TEST_ADAPTER_STOP_MARKER\"; exit 0" TERM INT
  printf "%s\\n" "KLICKER_EVAL_TARGET_PORT=41234"
  while :; do sleep 1; done
fi
exit 2'

write_file "$FAKE_BIN/uv" '#!/usr/bin/env bash
for name in LITELLM_API_BASE EVAL_MODEL EVAL_MODEL_CAPABILITY_MODEL EVAL_REASONING_EFFORT EVAL_JUDGE_SINGLE_ATTEMPT EVAL_METRICS_PATH EVAL_TOOLS_PATH GT_ROOT_DIR DEFAULT_GT_DIR TOOL_PROFILE EVAL_API_MODE EVAL_ENDPOINT_URL EVAL_MODELS_URL EVAL_STREAM AGENT_ID; do
  printf "%s=%s\n" "$name" "${!name-}" >>"$KLICKER_TEST_CHILD_LOG"
done
printf "EVAL_API_KEY_PRESENT=%s\n" "${EVAL_API_KEY:+yes}" >>"$KLICKER_TEST_CHILD_LOG"
printf "PARTICIPANT_USERNAME_PRESENT=%s\n" "${KLICKER_EVAL_PARTICIPANT_USERNAME:+yes}" >>"$KLICKER_TEST_CHILD_LOG"
printf "PARTICIPANT_PASSWORD_PRESENT=%s\n" "${KLICKER_EVAL_PARTICIPANT_PASSWORD:+yes}" >>"$KLICKER_TEST_CHILD_LOG"
if [[ -v EVAL_MODEL_CAPABILITY_MODEL ]]; then
  printf "EVAL_MODEL_CAPABILITY_MODEL_STATE=set\n" >>"$KLICKER_TEST_CHILD_LOG"
else
  printf "EVAL_MODEL_CAPABILITY_MODEL_STATE=unset\n" >>"$KLICKER_TEST_CHILD_LOG"
fi
printf "ARG=%s\n" "$@" >>"$KLICKER_TEST_CHILD_LOG"
if [ "${KLICKER_TEST_EXEC_RUNNER:-false}" = "true" ]; then
  expected_framework="$KLICKER_TEST_REPO_ROOT/evaluation/framework"
  [ "${1:-}" = "run" ] || exit 2
  [ "${2:-}" = "--project" ] || exit 2
  [ "${3:-}" = "$expected_framework" ] || exit 2
  [ "${4:-}" = "$expected_framework/scripts/_run_eval.sh" ] || exit 2
  [ "${5:-}" = "--no-dotenv" ] || exit 2
  exec "$4"
fi'

chmod +x "$FAKE_BIN/node" "$FAKE_BIN/rs-infisical-operator" "$FAKE_BIN/uv"
write_file "$FAKE_REPO/evaluation/framework/scripts/_run_eval.sh" '#!/usr/bin/env bash
printf "%s\n" "synthetic eval stdout"
printf "%s\n" "synthetic eval stderr" >&2
exit "${KLICKER_TEST_RUNNER_STATUS:-99}"'
chmod +x "$FAKE_REPO/evaluation/framework/scripts/_run_eval.sh"
write_file "$FAKE_REPO/evaluation/framework/data/input/metrics/metrics.yaml" 'metrics: []'
write_file "$FAKE_REPO/evaluation/data/metrics/klicker_fineco_semantic_similarity.yaml" 'metrics: []'
write_file "$FAKE_REPO/evaluation/data/tools/klicker_fineco.yaml" 'tools: []'
write_file "$FAKE_REPO/evaluation/data/canaries/klicker_local_mcp.json" '{}'
mkdir -p "$FAKE_REPO/evaluation/data/ground_truth/klicker_fineco"
mkdir -p "$FAKE_REPO/util" "$FAKE_REPO/apps/chat/scripts"
cp "$SOURCE_WRAPPER" "$FAKE_REPO/util/_run_klicker_eval.sh"
chmod +x "$FAKE_REPO/util/_run_klicker_eval.sh"
WRAPPER="$FAKE_REPO/util/_run_klicker_eval.sh"

env -i \
  LITELLM_API_BASE='https://litellm.example.test' \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" -- --mode eval --qa-file synthetic-qa.json

assert_line '--profile' "$OPERATOR_LOG"
assert_line 'klicker-uzh-stg' "$OPERATOR_LOG"
assert_line 'PIPELINES_LITELLM_API_KEY=LITELLM_API_KEY' "$OPERATOR_LOG"
[ "$(grep -cx -- '--map' "$OPERATOR_LOG")" -eq 1 ] ||
  fail 'operator must receive exactly one secret mapping'
assert_line 'LITELLM_API_BASE=https://litellm.example.test' "$CHILD_LOG"
assert_line 'EVAL_MODEL=klickeruzh/azure/gpt-5.6-luna-high' "$CHILD_LOG"
assert_line 'EVAL_MODEL_CAPABILITY_MODEL=gpt-5.6-luna' "$CHILD_LOG"
assert_line 'EVAL_REASONING_EFFORT=high' "$CHILD_LOG"
assert_line 'EVAL_JUDGE_SINGLE_ATTEMPT=true' "$CHILD_LOG"
assert_line "EVAL_METRICS_PATH=$FAKE_REPO/evaluation/framework/data/input/metrics/metrics.yaml" "$CHILD_LOG"
assert_line "EVAL_TOOLS_PATH=$FAKE_REPO/evaluation/data/tools/klicker_fineco.yaml" "$CHILD_LOG"
assert_line "GT_ROOT_DIR=$FAKE_REPO/evaluation/data/ground_truth/klicker_fineco" "$CHILD_LOG"
assert_line "DEFAULT_GT_DIR=$FAKE_REPO/evaluation/data/ground_truth/klicker_fineco" "$CHILD_LOG"
assert_line 'TOOL_PROFILE=catalog_expert_v1' "$CHILD_LOG"
assert_line 'ARG=--no-dotenv' "$CHILD_LOG"
assert_line 'ARG=--mode' "$CHILD_LOG"
assert_line 'ARG=eval' "$CHILD_LOG"
assert_line 'ARG=--qa-file' "$CHILD_LOG"
assert_line 'ARG=synthetic-qa.json' "$CHILD_LOG"

: >"$CHILD_LOG"
env -i \
  EVAL_MODEL='caller/model' \
  EVAL_MODEL_CAPABILITY_MODEL='gpt-5.4-mini' \
  EVAL_JUDGE_SINGLE_ATTEMPT='false' \
  EVAL_METRICS_PATH='evaluation/framework/data/input/metrics/metrics.yaml' \
  EVAL_TOOLS_PATH='evaluation/data/tools/klicker_fineco.yaml' \
  GT_ROOT_DIR='evaluation/data/ground_truth/klicker_fineco' \
  DEFAULT_GT_DIR='evaluation/data/ground_truth/klicker_fineco' \
  LITELLM_API_BASE='https://caller.example.test' \
  TOOL_PROFILE='caller-profile' \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode query --tool-profile explicit-profile

assert_line 'EVAL_MODEL=caller/model' "$CHILD_LOG"
assert_line 'EVAL_MODEL_CAPABILITY_MODEL=gpt-5.4-mini' "$CHILD_LOG"
assert_line 'EVAL_JUDGE_SINGLE_ATTEMPT=false' "$CHILD_LOG"
assert_line 'EVAL_METRICS_PATH=evaluation/framework/data/input/metrics/metrics.yaml' "$CHILD_LOG"
assert_line 'EVAL_TOOLS_PATH=evaluation/data/tools/klicker_fineco.yaml' "$CHILD_LOG"
assert_line 'GT_ROOT_DIR=evaluation/data/ground_truth/klicker_fineco' "$CHILD_LOG"
assert_line 'DEFAULT_GT_DIR=evaluation/data/ground_truth/klicker_fineco' "$CHILD_LOG"
assert_line 'LITELLM_API_BASE=https://caller.example.test' "$CHILD_LOG"
assert_line 'TOOL_PROFILE=caller-profile' "$CHILD_LOG"
assert_line 'ARG=--tool-profile' "$CHILD_LOG"
assert_line 'ARG=explicit-profile' "$CHILD_LOG"

: >"$CHILD_LOG"
env -i \
  EVAL_MODEL='caller/model-with-own-metadata' \
  EVAL_MODEL_CAPABILITY_MODEL='' \
  LITELLM_API_BASE='https://caller.example.test' \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode eval --qa-file synthetic-qa.json

assert_line 'EVAL_MODEL=caller/model-with-own-metadata' "$CHILD_LOG"
assert_line 'EVAL_MODEL_CAPABILITY_MODEL=' "$CHILD_LOG"
assert_line 'EVAL_MODEL_CAPABILITY_MODEL_STATE=unset' "$CHILD_LOG"

: >"$CHILD_LOG"
status=0
env -i \
  KLICKER_TEST_EMPTY_SECRET='true' \
  LITELLM_API_BASE='https://litellm.example.test' \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode eval >"$TEST_ROOT/empty-key.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "empty mapped key returned $status instead of 1"
assert_line 'Error: mapped LITELLM_API_KEY is missing or empty' "$TEST_ROOT/empty-key.out"
[ ! -s "$CHILD_LOG" ] || fail 'empty mapped key must not invoke uv'

: >"$CHILD_LOG"
status=0
env -i \
  KLICKER_TEST_OPERATOR_STATUS='73' \
  LITELLM_API_BASE='https://litellm.example.test' \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode eval \
  >"$TEST_ROOT/operator-failure.stdout" \
  2>"$TEST_ROOT/operator-failure.stderr" || status=$?

[ "$status" -eq 73 ] || fail "operator failure returned $status instead of 73"
assert_line 'synthetic operator stdout' "$TEST_ROOT/operator-failure.stdout"
assert_line 'synthetic operator stderr' "$TEST_ROOT/operator-failure.stderr"
[ ! -s "$CHILD_LOG" ] || fail 'operator failure must not invoke uv'

status=0
env -i \
  KLICKER_TEST_EXEC_RUNNER='true' \
  KLICKER_TEST_RUNNER_STATUS='0' \
  LITELLM_API_BASE='https://litellm.example.test' \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode eval \
  >"$TEST_ROOT/runner-success.stdout" \
  2>"$TEST_ROOT/runner-success.stderr" || status=$?

[ "$status" -eq 0 ] || fail "successful eval runner returned $status"
assert_line 'synthetic eval stdout' "$TEST_ROOT/runner-success.stdout"
assert_line 'synthetic eval stderr' "$TEST_ROOT/runner-success.stderr"

status=0
env -i \
  KLICKER_TEST_EXEC_RUNNER='true' \
  KLICKER_TEST_RUNNER_STATUS='74' \
  LITELLM_API_BASE='https://litellm.example.test' \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode eval \
  >"$TEST_ROOT/runner-failure.stdout" \
  2>"$TEST_ROOT/runner-failure.stderr" || status=$?

[ "$status" -eq 74 ] || fail "eval runner failure returned $status instead of 74"
assert_line 'synthetic eval stdout' "$TEST_ROOT/runner-failure.stdout"
assert_line 'synthetic eval stderr' "$TEST_ROOT/runner-failure.stderr"

assert_missing_input() {
  local variable="$1"
  local expected="$2"
  local missing_path="$TEST_ROOT/missing-$variable"
  local status=0

  : >"$CHILD_LOG"
  env -i \
    "$variable=$missing_path" \
    LITELLM_API_BASE='https://litellm.example.test' \
    PATH="$FAKE_BIN:$PATH" \
    KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
    KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
    KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
    "$WRAPPER" --mode eval >"$TEST_ROOT/missing-input.out" 2>&1 || status=$?

  [ "$status" -eq 1 ] || fail "$variable preflight returned $status instead of 1"
  assert_line \
    "Error: $variable must point to a readable $expected: $missing_path" \
    "$TEST_ROOT/missing-input.out"
  [ ! -s "$CHILD_LOG" ] || fail "$variable preflight must not invoke uv"
}

assert_missing_input EVAL_METRICS_PATH file
assert_missing_input EVAL_TOOLS_PATH file
assert_missing_input GT_ROOT_DIR directory
assert_missing_input DEFAULT_GT_DIR directory

MISSING_REPO="$TEST_ROOT/missing-repo"
mkdir -p "$MISSING_REPO"
mkdir -p "$MISSING_REPO/util"
cp "$SOURCE_WRAPPER" "$MISSING_REPO/util/_run_klicker_eval.sh"
chmod +x "$MISSING_REPO/util/_run_klicker_eval.sh"
status=0
env -i \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$MISSING_REPO/util/_run_klicker_eval.sh" --mode eval >"$TEST_ROOT/missing.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "missing submodule returned $status instead of 1"
assert_line "Error: evaluation framework is not initialized at $MISSING_REPO/evaluation/framework" "$TEST_ROOT/missing.out"
assert_line 'Run: git submodule update --init --checkout evaluation/framework' "$TEST_ROOT/missing.out"

NO_OPERATOR_BIN="$TEST_ROOT/no-operator-bin"
mkdir -p "$NO_OPERATOR_BIN"
status=0
env -i \
  PATH="$NO_OPERATOR_BIN:/usr/bin:/bin" \
  LITELLM_API_BASE='https://litellm.example.test' \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  "$WRAPPER" --mode eval >"$TEST_ROOT/operator.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "missing operator returned $status instead of 1"
assert_line 'Error: rs-infisical-operator is required for the restricted Klicker evaluation profile' "$TEST_ROOT/operator.out"

status=0
env -i \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  "$WRAPPER" --mode eval >"$TEST_ROOT/base-url.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "missing base URL returned $status instead of 1"
assert_line 'Error: LITELLM_API_BASE must point to the approved LiteLLM proxy' "$TEST_ROOT/base-url.out"

LOCAL_STOP_MARKER="$TEST_ROOT/local-adapter-stopped"
git init --bare "$TEST_ROOT/bare.git" >/dev/null 2>&1
: >"$CHILD_LOG"
env -i \
  GIT_DIR="$TEST_ROOT/bare.git" \
  GIT_WORK_TREE="$TEST_ROOT/not-a-worktree" \
  LITELLM_API_BASE='https://litellm.example.test' \
  KLICKER_EVAL_API_ORIGIN='https://api.klicker.localhost' \
  KLICKER_EVAL_CHAT_ORIGIN='https://chat.klicker.localhost' \
  KLICKER_EVAL_PARTICIPANT_USERNAME='synthetic-participant' \
  KLICKER_EVAL_PARTICIPANT_PASSWORD='synthetic-password' \
  KLICKER_TEST_ADAPTER_SCRIPT="$FAKE_REPO/apps/chat/scripts/klicker-evaluation-target.mjs" \
  KLICKER_TEST_ADAPTER_STOP_MARKER="$LOCAL_STOP_MARKER" \
  KLICKER_TEST_EXEC_RUNNER='true' \
  KLICKER_TEST_RUNNER_STATUS='0' \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --local-target --mode query --limit 1

assert_line 'EVAL_API_MODE=chat-completions' "$CHILD_LOG"
assert_line 'EVAL_ENDPOINT_URL=http://127.0.0.1:41234/v1/chat/completions' "$CHILD_LOG"
assert_line 'EVAL_MODELS_URL=http://127.0.0.1:41234/v1/models' "$CHILD_LOG"
assert_line 'EVAL_STREAM=false' "$CHILD_LOG"
assert_line 'AGENT_ID=gpt-5.6-luna' "$CHILD_LOG"
assert_line "EVAL_METRICS_PATH=$FAKE_REPO/evaluation/data/metrics/klicker_fineco_semantic_similarity.yaml" "$CHILD_LOG"
assert_line 'EVAL_API_KEY_PRESENT=yes' "$CHILD_LOG"
assert_line 'PARTICIPANT_USERNAME_PRESENT=' "$CHILD_LOG"
assert_line 'PARTICIPANT_PASSWORD_PRESENT=' "$CHILD_LOG"
[ -s "$LOCAL_STOP_MARKER" ] || fail 'local adapter must stop after a successful child run'
if grep -Fq -- 'synthetic-target-key' "$OPERATOR_LOG" "$CHILD_LOG"; then
  fail 'ephemeral target key must not be written to logs'
fi

rm -f "$LOCAL_STOP_MARKER"
: >"$CHILD_LOG"
status=0
env -i \
  LITELLM_API_BASE='https://litellm.example.test' \
  KLICKER_EVAL_API_ORIGIN='https://api.klicker.localhost' \
  KLICKER_EVAL_CHAT_ORIGIN='https://chat.klicker.localhost' \
  KLICKER_EVAL_PARTICIPANT_USERNAME='synthetic-participant' \
  KLICKER_EVAL_PARTICIPANT_PASSWORD='synthetic-password' \
  KLICKER_TEST_ADAPTER_SCRIPT="$FAKE_REPO/apps/chat/scripts/klicker-evaluation-target.mjs" \
  KLICKER_TEST_ADAPTER_STOP_MARKER="$LOCAL_STOP_MARKER" \
  KLICKER_TEST_EXEC_RUNNER='true' \
  KLICKER_TEST_RUNNER_STATUS='74' \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --local-target --mode query --limit 1 \
  >"$TEST_ROOT/local-failure.stdout" \
  2>"$TEST_ROOT/local-failure.stderr" || status=$?

[ "$status" -eq 74 ] || fail "local child failure returned $status instead of 74"
[ -s "$LOCAL_STOP_MARKER" ] || fail 'local adapter must stop after a failed child run'

echo '[test-klicker-eval-wrapper] PASS'
