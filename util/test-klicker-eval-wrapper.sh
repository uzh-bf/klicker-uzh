#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRAPPER="$REPO_ROOT/util/_run_klicker_eval.sh"
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

write_file "$FAKE_BIN/git" '#!/usr/bin/env bash
[ "${1:-}" = "rev-parse" ] || exit 2
[ "${2:-}" = "--show-toplevel" ] || exit 2
printf "%s\n" "$KLICKER_TEST_REPO_ROOT"'

write_file "$FAKE_BIN/rs-infisical-operator" '#!/usr/bin/env bash
printf "%s\n" "$@" >"$KLICKER_TEST_OPERATOR_LOG"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--" ]; then
    shift
    exec "$@"
  fi
  shift
done
exit 2'

write_file "$FAKE_BIN/uv" '#!/usr/bin/env bash
for name in LITELLM_API_BASE EVAL_MODEL EVAL_MODEL_CAPABILITY_MODEL EVAL_REASONING_EFFORT EVAL_JUDGE_SINGLE_ATTEMPT EVAL_METRICS_PATH EVAL_TOOLS_PATH GT_ROOT_DIR DEFAULT_GT_DIR TOOL_PROFILE; do
  printf "%s=%s\n" "$name" "${!name-}" >>"$KLICKER_TEST_CHILD_LOG"
done
printf "ARG=%s\n" "$@" >>"$KLICKER_TEST_CHILD_LOG"'

chmod +x "$FAKE_BIN/git" "$FAKE_BIN/rs-infisical-operator" "$FAKE_BIN/uv"
write_file "$FAKE_REPO/evaluation/framework/scripts/_run_eval.sh" '#!/usr/bin/env bash
exit 99'
chmod +x "$FAKE_REPO/evaluation/framework/scripts/_run_eval.sh"

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
assert_line 'LITELLM_API_BASE=https://caller.example.test' "$CHILD_LOG"
assert_line 'TOOL_PROFILE=caller-profile' "$CHILD_LOG"
assert_line 'ARG=--tool-profile' "$CHILD_LOG"
assert_line 'ARG=explicit-profile' "$CHILD_LOG"

: >"$CHILD_LOG"
env -i \
  EVAL_MODEL='caller/model-with-own-metadata' \
  LITELLM_API_BASE='https://caller.example.test' \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode eval --qa-file synthetic-qa.json

assert_line 'EVAL_MODEL=caller/model-with-own-metadata' "$CHILD_LOG"
assert_line 'EVAL_MODEL_CAPABILITY_MODEL=' "$CHILD_LOG"

MISSING_REPO="$TEST_ROOT/missing-repo"
mkdir -p "$MISSING_REPO"
status=0
env -i \
  PATH="$FAKE_BIN:$PATH" \
  KLICKER_TEST_REPO_ROOT="$MISSING_REPO" \
  KLICKER_TEST_OPERATOR_LOG="$OPERATOR_LOG" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode eval >"$TEST_ROOT/missing.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "missing submodule returned $status instead of 1"
assert_line "Error: evaluation framework is not initialized at $MISSING_REPO/evaluation/framework" "$TEST_ROOT/missing.out"
assert_line 'Run: git submodule update --init --checkout evaluation/framework' "$TEST_ROOT/missing.out"

NO_OPERATOR_BIN="$TEST_ROOT/no-operator-bin"
mkdir -p "$NO_OPERATOR_BIN"
cp "$FAKE_BIN/git" "$NO_OPERATOR_BIN/git"
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

echo '[test-klicker-eval-wrapper] PASS'
