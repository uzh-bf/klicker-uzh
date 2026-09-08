#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_WRAPPER="$REPO_ROOT/util/_run_klicker_eval.sh"
BASH_BIN="$BASH"
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
CHILD_LOG="$TEST_ROOT/child.log"
INFISICAL_LOG="$TEST_ROOT/infisical.log"
mkdir -p "$FAKE_BIN"
ln -s "$BASH_BIN" "$FAKE_BIN/bash"

REAL_NODE="$(command -v node)"
write_file "$FAKE_BIN/node" '#!/usr/bin/env bash
if [[ "${1:-}" = */read-klicker-eval-config.mjs ]]; then
  exec "'"$REAL_NODE"'" "$@"
fi
if [ -n "${KLICKER_TEST_HELPER_LOG:-}" ]; then
  if [ "${1:-}" = "-e" ]; then
    helper="KEYGEN"
  elif [ "${1:-}" = "$KLICKER_TEST_ADAPTER_SCRIPT" ]; then
    helper="ADAPTER"
  else
    helper="OTHER"
  fi
  for name in AZURE_OPENAI_API_KEY AZURE_OPENAI_BASE_URL UPSTREAM_OPENAI_API_KEY UPSTREAM_OPENAI_BASE_URL OPENAI_API_KEY LITELLM_API_KEY KLICKER_EVAL_PARTICIPANT_USERNAME KLICKER_EVAL_PARTICIPANT_PASSWORD KLICKER_EVAL_TARGET_KEY; do
    printf "%s_%s_PRESENT=%s\n" "$helper" "$name" "${!name:+yes}" >>"$KLICKER_TEST_HELPER_LOG"
  done
fi
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
for name in AZURE_OPENAI_API_KEY AZURE_OPENAI_BASE_URL UPSTREAM_OPENAI_API_KEY UPSTREAM_OPENAI_BASE_URL OPENAI_API_KEY LITELLM_API_KEY JUDGE_KEY JUDGE_URL PIPELINES_LITELLM_API_KEY INFISICAL_TOKEN; do
  printf "%s_PRESENT=%s\n" "$name" "${!name:+yes}" >>"$KLICKER_TEST_CHILD_LOG"
done
printf "EVAL_API_KEY_PRESENT=%s\n" "${EVAL_API_KEY:+yes}" >>"$KLICKER_TEST_CHILD_LOG"
printf "PARTICIPANT_USERNAME_PRESENT=%s\n" "${KLICKER_EVAL_PARTICIPANT_USERNAME:+yes}" >>"$KLICKER_TEST_CHILD_LOG"
printf "PARTICIPANT_PASSWORD_PRESENT=%s\n" "${KLICKER_EVAL_PARTICIPANT_PASSWORD:+yes}" >>"$KLICKER_TEST_CHILD_LOG"
if [ "${EVAL_MODEL_CAPABILITY_MODEL+x}" = x ]; then
  printf "EVAL_MODEL_CAPABILITY_MODEL_STATE=set\n" >>"$KLICKER_TEST_CHILD_LOG"
else
  printf "EVAL_MODEL_CAPABILITY_MODEL_STATE=unset\n" >>"$KLICKER_TEST_CHILD_LOG"
fi
printf "ARG=%s\n" "$@" >>"$KLICKER_TEST_CHILD_LOG"
if [ "${KLICKER_TEST_EXEC_RUNNER:-false}" = "true" ]; then
  expected_framework="$KLICKER_TEST_REPO_ROOT/evaluation/framework"
  [ "${1:-}" = "run" ] || exit 2
  [ "${2:-}" = "--frozen" ] || exit 2
  [ "${3:-}" = "--project" ] || exit 2
  [ "${4:-}" = "$expected_framework" ] || exit 2
  [ "${5:-}" = "$expected_framework/scripts/_run_eval.sh" ] || exit 2
  [ "${6:-}" = "--no-dotenv" ] || exit 2
  exec "$5"
fi'

write_file "$FAKE_BIN/git" '#!/usr/bin/env bash
if [ "${1:-}" = "init" ] && [ "${2:-}" = "--bare" ] && [ -n "${3:-}" ]; then
  mkdir -p "$3"
  exit 0
fi
if [ "${1:-}" = "-C" ] && [ "${3:-}" = "rev-parse" ] && [ "${4:-}" = "HEAD" ]; then
  printf "%s\\n" "synthetic-framework-revision"
  exit 0
fi
exit 2'

write_file "$FAKE_BIN/infisical" '#!/usr/bin/env bash
for name in EVAL_API_KEY LITELLM_API_BASE LITELLM_API_KEY JUDGE_KEY JUDGE_URL \
  AZURE_OPENAI_API_KEY AZURE_OPENAI_BASE_URL UPSTREAM_OPENAI_API_KEY \
  UPSTREAM_OPENAI_BASE_URL OPENAI_API_KEY PIPELINES_LITELLM_API_KEY \
  KLICKER_EVAL_PARTICIPANT_USERNAME KLICKER_EVAL_PARTICIPANT_PASSWORD KLICKER_EVAL_TARGET_KEY; do
  [ -z "${!name:+present}" ] || exit 87
done
if [ "${1:-}" = "--version" ]; then
  printf "%s\n" "infisical version ${KLICKER_TEST_INFISICAL_VERSION:-0.43.129}"
  exit 0
fi
if [ -n "${KLICKER_TEST_INFISICAL_LOG:-}" ]; then
  printf "%s\n" "$*" >>"$KLICKER_TEST_INFISICAL_LOG"
fi
if [ -n "${KLICKER_TEST_INFISICAL_STATUS:-}" ] && [ "$KLICKER_TEST_INFISICAL_STATUS" != "0" ]; then
  printf "%s\n" "synthetic infisical failure" >&2
  exit "$KLICKER_TEST_INFISICAL_STATUS"
fi
if [ -n "${KLICKER_TEST_EMPTY_SECRET:-}" ]; then
  exit 0
fi
if [ "${3:-}" = "JUDGE_URL" ]; then
  printf "%s" "https://judge.example.test"
else
  printf "%s" "synthetic-test-key"
fi
exit 0'

chmod +x "$FAKE_BIN/node" "$FAKE_BIN/uv" "$FAKE_BIN/git" "$FAKE_BIN/infisical"
TEST_PATH="$FAKE_BIN:$(dirname "$(command -v bash)"):/usr/bin:/bin"
# Minimal path for the missing-CLI case: it must contain no infisical, so it
# cannot reuse TEST_PATH (the bash directory may itself ship a real CLI).
MIN_BIN="$TEST_ROOT/min-bin"
mkdir -p "$MIN_BIN"
ln -s "$BASH_BIN" "$MIN_BIN/bash"
ln -s "$(command -v dirname)" "$MIN_BIN/dirname"
NO_INFISICAL_BIN="$TEST_ROOT/no-infisical-bin"
mkdir -p "$NO_INFISICAL_BIN"
ln -s "$FAKE_BIN/node" "$NO_INFISICAL_BIN/node"
ln -s "$FAKE_BIN/uv" "$NO_INFISICAL_BIN/uv"
ln -s "$FAKE_BIN/git" "$NO_INFISICAL_BIN/git"
ln -s "$BASH_BIN" "$NO_INFISICAL_BIN/bash"
ln -s "$(command -v dirname)" "$NO_INFISICAL_BIN/dirname"
NO_INFISICAL_PATH="$NO_INFISICAL_BIN:/usr/bin:/bin"
if PATH="$TEST_PATH" command -v rs-infisical-operator >/dev/null 2>&1; then
  fail 'portable wrapper test path must not contain rs-infisical-operator'
fi
write_file "$FAKE_REPO/evaluation/framework/scripts/_run_eval.sh" '#!/usr/bin/env bash
printf "%s\n" "synthetic eval stdout"
printf "%s\n" "synthetic eval stderr" >&2
exit "${KLICKER_TEST_RUNNER_STATUS:-99}"'
chmod +x "$FAKE_REPO/evaluation/framework/scripts/_run_eval.sh"
write_file "$FAKE_REPO/evaluation/framework/data/input/metrics/metrics.yaml" 'metrics: []'
write_file "$FAKE_REPO/evaluation/data/metrics/klicker_fineco_semantic_similarity.yaml" 'metrics: []'
write_file "$FAKE_REPO/evaluation/data/tools/klicker_fineco.yaml" 'tools: []'
write_file "$FAKE_REPO/evaluation/data/canaries/klicker_local_mcp.json" '{}'
write_file "$FAKE_REPO/synthetic-qa.json" '{"synthetic":true}'
mkdir -p "$FAKE_REPO/evaluation/data/ground_truth/klicker_fineco"
mkdir -p "$FAKE_REPO/util" "$FAKE_REPO/apps/chat/scripts"
cp "$SOURCE_WRAPPER" "$FAKE_REPO/util/_run_klicker_eval.sh"
cp "$REPO_ROOT/util/read-klicker-eval-config.mjs" "$FAKE_REPO/util/"
write_file "$FAKE_REPO/evaluation/config.local.json" '{"schemaVersion":1,"infisical":{"domain":"https://secrets.example.test","projectId":"test-project","environment":"test","path":"/judge"},"judge":{"baseUrlSecret":"JUDGE_URL","apiKeySecret":"JUDGE_KEY"}}'
chmod +x "$FAKE_REPO/util/_run_klicker_eval.sh"
WRAPPER="$FAKE_REPO/util/_run_klicker_eval.sh"

HELP_REPO="$TEST_ROOT/help-repo"
mkdir -p "$HELP_REPO/util"
cp "$SOURCE_WRAPPER" "$HELP_REPO/util/_run_klicker_eval.sh"
chmod +x "$HELP_REPO/util/_run_klicker_eval.sh"
EMPTY_BIN="$TEST_ROOT/empty-bin"
mkdir -p "$EMPTY_BIN"

: >"$CHILD_LOG"
: >"$INFISICAL_LOG"
env -i \
  PATH="$EMPTY_BIN" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
  "$BASH_BIN" "$HELP_REPO/util/_run_klicker_eval.sh" --help \
  >"$TEST_ROOT/help.out" 2>&1

[ -s "$TEST_ROOT/help.out" ] || fail 'help must produce usage output'
[ ! -s "$CHILD_LOG" ] || fail 'help must not invoke the evaluator'
[ ! -s "$INFISICAL_LOG" ] || fail 'help must not invoke Infisical'

assert_parser_rejection() {
  local name="$1"
  shift
  local status=0

  : >"$CHILD_LOG"
  : >"$INFISICAL_LOG"
  env -i \
    PATH="$NO_INFISICAL_PATH" \
    KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
    KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
    KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
    "$WRAPPER" "$@" >"$TEST_ROOT/$name.out" 2>&1 || status=$?

  [ "$status" -eq 1 ] || fail "$name must fail before execution"
  [ ! -s "$CHILD_LOG" ] || fail "$name must not invoke the evaluator"
  [ ! -s "$INFISICAL_LOG" ] || fail "$name must not invoke Infisical"
}

assert_parser_rejection invalid-mode --mode unsupported
assert_parser_rejection missing-mode --mode
assert_parser_rejection local-target-eval --local-target --mode eval
assert_parser_rejection unknown-option --unknown-option
assert_parser_rejection missing-qa-file --mode eval --qa-file
assert_parser_rejection missing-gt-dir --mode query --gt-dir
assert_parser_rejection missing-metrics --mode eval --metrics
assert_parser_rejection missing-safety-file --mode safety --safety-file


assert_parser_rejection unreadable-qa-file \
  --mode eval --qa-file "$TEST_ROOT/missing-qa.json"
assert_parser_rejection unreadable-gt-dir \
  --mode query --gt-dir "$TEST_ROOT/missing-gt-dir"
assert_parser_rejection unreadable-metrics \
  --mode eval --metrics "$TEST_ROOT/missing-metrics.yaml"
assert_parser_rejection unreadable-safety-file \
  --mode safety --safety-file "$TEST_ROOT/missing-safety.json"

: >"$CHILD_LOG"
status=0
env -i \
  EVAL_METRICS_PATH="$TEST_ROOT/missing-target-metrics.yaml" \
  EVAL_ENDPOINT_URL='https://target.example.test/v1/chat/completions' \
  EVAL_API_KEY='synthetic-target-key' \
  PATH="$NO_INFISICAL_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode query \
  >"$TEST_ROOT/query-without-metrics.out" 2>&1 || status=$?

[ "$status" -eq 0 ] || fail "target-only query with missing metrics returned $status"
assert_line "EVAL_METRICS_PATH=$TEST_ROOT/missing-target-metrics.yaml" "$CHILD_LOG"

: >"$CHILD_LOG"
: >"$INFISICAL_LOG"
status=0
env -i \
  EVAL_ENDPOINT_URL='https://target.example.test/v1/chat/completions' \
  EVAL_API_KEY='synthetic-target-key' \
  PATH="$NO_INFISICAL_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
  "$WRAPPER" \
  >"$TEST_ROOT/default-query.out" 2>&1 || status=$?

[ "$status" -eq 0 ] || fail "default query returned $status"
assert_line 'ARG=--no-dotenv' "$CHILD_LOG"
[ ! -s "$INFISICAL_LOG" ] || fail 'default query must not invoke Infisical'

: >"$CHILD_LOG"
status=0
env -i \
  EVAL_ENDPOINT_URL='https://target.example.test/v1/chat/completions' \
  EVAL_API_KEY='synthetic-target-key' \
  PATH="$NO_INFISICAL_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode=query \
  >"$TEST_ROOT/equals-mode.out" 2>&1 || status=$?

[ "$status" -eq 0 ] || fail "normalized mode returned $status"
assert_line 'ARG=--mode' "$CHILD_LOG"
assert_line 'ARG=query' "$CHILD_LOG"

: >"$CHILD_LOG"
: >"$INFISICAL_LOG"
status=0
env -i \
  EVAL_ENDPOINT_URL='https://target.example.test/v1/chat/completions' \
  EVAL_API_KEY='synthetic-target-key' \
  PATH="$NO_INFISICAL_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
  "$WRAPPER" --check --mode query --agent-id synthetic-model \
  >"$TEST_ROOT/check-query.out" 2>&1 || status=$?

[ "$status" -eq 0 ] || fail "offline query check returned $status"
[ -s "$TEST_ROOT/check-query.out" ] || fail 'offline check must produce diagnostics'
[ ! -s "$CHILD_LOG" ] || fail 'offline check must not invoke the evaluator'
[ ! -s "$INFISICAL_LOG" ] || fail 'offline check must not invoke Infisical'

status=0
env -i PATH="$NO_INFISICAL_PATH" \
  EVAL_ENDPOINT_URL=https://target.example.test EVAL_API_KEY=synthetic-target-key \
  "$WRAPPER" --check --mode query >"$TEST_ROOT/missing-model.out" 2>&1 || status=$?
[ "$status" -ne 0 ] || fail 'offline query check must reject a missing model'
env -i PATH="$NO_INFISICAL_PATH" \
  EVAL_ENDPOINT_URL=https://target.example.test EVAL_API_KEY=synthetic-target-key \
  AGENT_ID=synthetic-model "$WRAPPER" --check --mode query >/dev/null

for invalid_args in '--limit nope' '--concurrency 0' '--query-timeout 0' '--eval-mode invalid'; do
  : >"$INFISICAL_LOG"
  status=0
  # Each fixture contains exactly one flag and one deliberately invalid value.
  env -i PATH="$TEST_PATH" KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
    "$WRAPPER" --mode eval $invalid_args >"$TEST_ROOT/invalid-semantic.out" 2>&1 || status=$?
  [ "$status" -ne 0 ] || fail 'invalid semantic argument must fail'
  [ ! -s "$INFISICAL_LOG" ] || fail 'invalid semantic argument must not fetch secrets'
done

: >"$CHILD_LOG"
: >"$INFISICAL_LOG"
status=0
env -i \
  LITELLM_API_BASE='https://litellm.example.test' \
  PATH="$NO_INFISICAL_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
  "$WRAPPER" --check --mode eval \
  >"$TEST_ROOT/check-eval.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "offline judge check returned $status"
[ -s "$TEST_ROOT/check-eval.out" ] || fail 'offline judge check must produce diagnostics'
[ ! -s "$CHILD_LOG" ] || fail 'offline judge check must not invoke the evaluator'
[ ! -s "$INFISICAL_LOG" ] || fail 'offline judge check must not invoke Infisical'

env -i \
  LITELLM_API_BASE='https://litellm.example.test' \
  LITELLM_API_KEY='synthetic-test-key' \
  PATH="$TEST_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
  "$WRAPPER" -- --mode eval --qa-file synthetic-qa.json

assert_line 'LITELLM_API_BASE=https://litellm.example.test' "$CHILD_LOG"
assert_line 'LITELLM_API_KEY_PRESENT=yes' "$CHILD_LOG"
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
assert_line "ARG=$FAKE_REPO/synthetic-qa.json" "$CHILD_LOG"

[ ! -s "$INFISICAL_LOG" ] || fail 'caller-provided judge key must not invoke the infisical CLI'

: >"$CHILD_LOG"
: >"$INFISICAL_LOG"
env -i \
  LITELLM_API_BASE='https://litellm.example.test' \
  PATH="$TEST_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
  "$WRAPPER" -- --mode eval --qa-file synthetic-qa.json

assert_line 'secrets get JUDGE_KEY --plain --silent --expand=false --include-imports=false --recursive=false --secret-overriding=false --telemetry=false --log-level=error --domain https://secrets.example.test --projectId test-project --env test --path /judge' "$INFISICAL_LOG"
assert_line 'LITELLM_API_KEY_PRESENT=yes' "$CHILD_LOG"

: >"$CHILD_LOG"
env -i \
  EVAL_MODEL='caller/model' \
  EVAL_MODEL_CAPABILITY_MODEL='gpt-5.4-mini' \
  EVAL_JUDGE_SINGLE_ATTEMPT='false' \
  EVAL_METRICS_PATH='evaluation/framework/data/input/metrics/metrics.yaml' \
  EVAL_TOOLS_PATH='evaluation/data/tools/klicker_fineco.yaml' \
  GT_ROOT_DIR='evaluation/data/ground_truth/klicker_fineco' \
  DEFAULT_GT_DIR='evaluation/data/ground_truth/klicker_fineco' \
  EVAL_ENDPOINT_URL='https://target.example.test/v1/chat/completions' \
  EVAL_API_KEY='synthetic-target-key' \
  TOOL_PROFILE='caller-profile' \
  PATH="$NO_INFISICAL_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode query --tool-profile explicit-profile

assert_line 'EVAL_MODEL=caller/model' "$CHILD_LOG"
assert_line 'EVAL_MODEL_CAPABILITY_MODEL=gpt-5.4-mini' "$CHILD_LOG"
assert_line 'EVAL_JUDGE_SINGLE_ATTEMPT=false' "$CHILD_LOG"
assert_line "EVAL_METRICS_PATH=$FAKE_REPO/evaluation/framework/data/input/metrics/metrics.yaml" "$CHILD_LOG"
assert_line "EVAL_TOOLS_PATH=$FAKE_REPO/evaluation/data/tools/klicker_fineco.yaml" "$CHILD_LOG"
assert_line "GT_ROOT_DIR=$FAKE_REPO/evaluation/data/ground_truth/klicker_fineco" "$CHILD_LOG"
assert_line "DEFAULT_GT_DIR=$FAKE_REPO/evaluation/data/ground_truth/klicker_fineco" "$CHILD_LOG"
assert_line 'LITELLM_API_BASE=' "$CHILD_LOG"
assert_line 'EVAL_ENDPOINT_URL=https://target.example.test/v1/chat/completions' "$CHILD_LOG"
assert_line 'EVAL_API_KEY_PRESENT=yes' "$CHILD_LOG"
assert_line 'LITELLM_API_KEY_PRESENT=' "$CHILD_LOG"
assert_line 'TOOL_PROFILE=caller-profile' "$CHILD_LOG"
assert_line 'ARG=--tool-profile' "$CHILD_LOG"
assert_line 'ARG=explicit-profile' "$CHILD_LOG"

: >"$CHILD_LOG"
env -i \
  EVAL_MODEL='caller/model-with-own-metadata' \
  EVAL_MODEL_CAPABILITY_MODEL='' \
  LITELLM_API_BASE='https://caller.example.test' \
  LITELLM_API_KEY='synthetic-test-key' \
  PATH="$TEST_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode eval --qa-file synthetic-qa.json

assert_line 'EVAL_MODEL=caller/model-with-own-metadata' "$CHILD_LOG"
assert_line 'EVAL_MODEL_CAPABILITY_MODEL=' "$CHILD_LOG"
assert_line 'EVAL_MODEL_CAPABILITY_MODEL_STATE=unset' "$CHILD_LOG"

: >"$CHILD_LOG"
status=0
env -i \
  LITELLM_API_BASE='https://litellm.example.test' \
  PATH="$MIN_BIN" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --mode eval >"$TEST_ROOT/missing-cli.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "missing infisical CLI returned $status instead of 1"
[ ! -s "$CHILD_LOG" ] || fail 'missing infisical CLI must not invoke uv'

: >"$CHILD_LOG"
status=0
env -i \
  LITELLM_API_BASE='https://litellm.example.test' \
  KLICKER_TEST_INFISICAL_STATUS='73' \
  PATH="$TEST_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
  "$WRAPPER" --mode eval >"$TEST_ROOT/infisical-failure.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "infisical CLI failure returned $status instead of 1"
! grep -Fq -- 'synthetic infisical failure' "$TEST_ROOT/infisical-failure.out" || fail 'CLI diagnostics must not leak'
[ ! -s "$CHILD_LOG" ] || fail 'infisical CLI failure must not invoke uv'

: >"$CHILD_LOG"
status=0
env -i \
  LITELLM_API_BASE='https://litellm.example.test' \
  KLICKER_TEST_EMPTY_SECRET='true' \
  PATH="$TEST_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
  "$WRAPPER" --mode eval >"$TEST_ROOT/empty-secret.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "empty fetched judge key returned $status instead of 1"
[ ! -s "$CHILD_LOG" ] || fail 'empty fetched judge key must not invoke uv'

status=0
env -i \
  KLICKER_TEST_EXEC_RUNNER='true' \
  KLICKER_TEST_RUNNER_STATUS='0' \
  LITELLM_API_BASE='https://litellm.example.test' \
  LITELLM_API_KEY='synthetic-test-key' \
  PATH="$TEST_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
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
  LITELLM_API_KEY='synthetic-test-key' \
  PATH="$TEST_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
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
    LITELLM_API_KEY='synthetic-test-key' \
    PATH="$TEST_PATH" \
    KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
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
  PATH="$TEST_PATH" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$MISSING_REPO/util/_run_klicker_eval.sh" --mode eval >"$TEST_ROOT/missing.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "missing submodule returned $status instead of 1"
assert_line "Error: evaluation framework is not initialized at $MISSING_REPO/evaluation/framework" "$TEST_ROOT/missing.out"
assert_line 'Run: git submodule update --init --checkout evaluation/framework' "$TEST_ROOT/missing.out"

status=0
env -i \
  KLICKER_EVAL_CONFIG=missing-config.json \
  LITELLM_API_KEY='synthetic-test-key' \
  PATH="$TEST_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  "$WRAPPER" --mode eval >"$TEST_ROOT/base-url.out" 2>&1 || status=$?

[ "$status" -eq 1 ] || fail "missing base URL returned $status instead of 1"
[ ! -s "$CHILD_LOG" ] || fail 'missing scope must not invoke the evaluator'

# Configuration resolution uses the real JSON loader and a synthetic CLI.
run_judge_case() {
  : >"$CHILD_LOG"
  : >"$INFISICAL_LOG"
  env -i PATH="$TEST_PATH" \
    KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
    KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
    KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
    "$@" "$WRAPPER" --mode eval --qa-file synthetic-qa.json
}
run_judge_case JUDGE_KEY=synthetic-source-key JUDGE_URL=synthetic-source-url \
  PIPELINES_LITELLM_API_KEY=synthetic-legacy-key INFISICAL_TOKEN=synthetic-cli-token \
  EVAL_API_KEY=synthetic-target-key OPENAI_API_KEY=synthetic-provider-key \
  KLICKER_EVAL_PARTICIPANT_PASSWORD=synthetic-password
assert_line 'LITELLM_API_BASE=https://judge.example.test' "$CHILD_LOG"
assert_line 'LITELLM_API_KEY_PRESENT=yes' "$CHILD_LOG"
assert_line 'JUDGE_KEY_PRESENT=' "$CHILD_LOG"
assert_line 'JUDGE_URL_PRESENT=' "$CHILD_LOG"
assert_line 'PIPELINES_LITELLM_API_KEY_PRESENT=' "$CHILD_LOG"
assert_line 'INFISICAL_TOKEN_PRESENT=' "$CHILD_LOG"
[ "$(wc -l <"$INFISICAL_LOG" | tr -d ' ')" -eq 2 ] || fail 'both missing settings require two scoped reads'

run_judge_case LITELLM_API_KEY=synthetic-override
[ "$(wc -l <"$INFISICAL_LOG" | tr -d ' ')" -eq 1 ] || fail 'key override must skip key lookup'
grep -Fq 'secrets get JUDGE_URL ' "$INFISICAL_LOG" || fail 'only URL must be fetched'

write_file "$FAKE_REPO/broken.json" '{synthetic-private-sentinel'
run_judge_case KLICKER_EVAL_CONFIG=broken.json \
  LITELLM_API_BASE=https://override.example.test LITELLM_API_KEY=synthetic-override
[ ! -s "$INFISICAL_LOG" ] || fail 'complete overrides must bypass even invalid configuration'

: >"$CHILD_LOG"
: >"$INFISICAL_LOG"
env -i PATH="$TEST_PATH" KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" KLICKER_TEST_INFISICAL_LOG="$INFISICAL_LOG" \
  "$WRAPPER" --check --mode eval >"$TEST_ROOT/config-check.out"
[ ! -s "$CHILD_LOG" ] || fail 'configured offline check must not invoke uv'
[ ! -s "$INFISICAL_LOG" ] || fail 'configured offline check must not invoke Infisical'

status=0
run_judge_case KLICKER_TEST_INFISICAL_VERSION=0.42.0 >"$TEST_ROOT/version.out" 2>&1 || status=$?
[ "$status" -ne 0 ] || fail 'unsupported CLI version must fail'
[ ! -s "$INFISICAL_LOG" ] || fail 'unsupported CLI must not fetch values'

# A source name can be the canonical destination; mapping must preserve it.
write_file "$FAKE_REPO/canonical.json" '{"schemaVersion":1,"infisical":{"domain":"https://secrets.example.test","projectId":"test-project","environment":"test","path":"/judge"},"judge":{"baseUrlSecret":"JUDGE_URL","apiKeySecret":"LITELLM_API_KEY"}}'
run_judge_case KLICKER_EVAL_CONFIG=canonical.json
assert_line 'LITELLM_API_KEY_PRESENT=yes' "$CHILD_LOG"

LOCAL_STOP_MARKER="$TEST_ROOT/local-adapter-stopped"
PATH="$TEST_PATH" git init --bare "$TEST_ROOT/bare.git" >/dev/null 2>&1
: >"$CHILD_LOG"
env -i \
  GIT_DIR="$TEST_ROOT/bare.git" \
  GIT_WORK_TREE="$TEST_ROOT/not-a-worktree" \
  LITELLM_API_BASE='https://litellm.example.test' \
  LITELLM_API_KEY='synthetic-test-key' \
  KLICKER_EVAL_API_ORIGIN='https://api.klicker.localhost' \
  KLICKER_EVAL_CHAT_ORIGIN='https://chat.klicker.localhost' \
  KLICKER_EVAL_PARTICIPANT_USERNAME='synthetic-participant' \
  KLICKER_EVAL_PARTICIPANT_PASSWORD='synthetic-password' \
  AZURE_OPENAI_API_KEY='synthetic-azure-key' \
  AZURE_OPENAI_BASE_URL='https://azure.example.test' \
  UPSTREAM_OPENAI_API_KEY='synthetic-upstream-key' \
  UPSTREAM_OPENAI_BASE_URL='https://upstream.example.test' \
  KLICKER_TEST_ADAPTER_SCRIPT="$FAKE_REPO/apps/chat/scripts/klicker-evaluation-target.mjs" \
  KLICKER_TEST_ADAPTER_STOP_MARKER="$LOCAL_STOP_MARKER" \
  KLICKER_TEST_HELPER_LOG="$TEST_ROOT/helper.log" \
  KLICKER_TEST_EXEC_RUNNER='true' \
  KLICKER_TEST_RUNNER_STATUS='0' \
  PATH="$TEST_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --local-target --mode query --limit 1 \
  --gt-dir evaluation/data/ground_truth/klicker_fineco

assert_line 'EVAL_API_MODE=chat-completions' "$CHILD_LOG"
assert_line 'EVAL_ENDPOINT_URL=http://127.0.0.1:41234/v1/chat/completions' "$CHILD_LOG"
assert_line 'EVAL_MODELS_URL=http://127.0.0.1:41234/v1/models' "$CHILD_LOG"
assert_line 'EVAL_STREAM=false' "$CHILD_LOG"
assert_line 'AGENT_ID=gpt-5.6-luna' "$CHILD_LOG"
assert_line "EVAL_METRICS_PATH=$FAKE_REPO/evaluation/data/metrics/klicker_fineco_semantic_similarity.yaml" "$CHILD_LOG"
assert_line "ARG=$FAKE_REPO/evaluation/data/ground_truth/klicker_fineco" "$CHILD_LOG"
assert_line 'EVAL_API_KEY_PRESENT=yes' "$CHILD_LOG"
assert_line 'PARTICIPANT_USERNAME_PRESENT=' "$CHILD_LOG"
assert_line 'PARTICIPANT_PASSWORD_PRESENT=' "$CHILD_LOG"
assert_line 'AZURE_OPENAI_API_KEY_PRESENT=' "$CHILD_LOG"
assert_line 'UPSTREAM_OPENAI_API_KEY_PRESENT=' "$CHILD_LOG"
assert_line 'KEYGEN_AZURE_OPENAI_API_KEY_PRESENT=' "$TEST_ROOT/helper.log"
assert_line 'KEYGEN_UPSTREAM_OPENAI_API_KEY_PRESENT=' "$TEST_ROOT/helper.log"
assert_line 'KEYGEN_LITELLM_API_KEY_PRESENT=' "$TEST_ROOT/helper.log"
assert_line 'KEYGEN_KLICKER_EVAL_PARTICIPANT_USERNAME_PRESENT=' "$TEST_ROOT/helper.log"
assert_line 'ADAPTER_AZURE_OPENAI_API_KEY_PRESENT=' "$TEST_ROOT/helper.log"
assert_line 'ADAPTER_UPSTREAM_OPENAI_API_KEY_PRESENT=' "$TEST_ROOT/helper.log"
assert_line 'ADAPTER_LITELLM_API_KEY_PRESENT=' "$TEST_ROOT/helper.log"
assert_line 'ADAPTER_KLICKER_EVAL_PARTICIPANT_USERNAME_PRESENT=yes' "$TEST_ROOT/helper.log"
assert_line 'ADAPTER_KLICKER_EVAL_TARGET_KEY_PRESENT=yes' "$TEST_ROOT/helper.log"
[ -s "$LOCAL_STOP_MARKER" ] || fail 'local adapter must stop after a successful child run'
if grep -Fq -- 'synthetic-target-key' "$CHILD_LOG"; then
  fail 'ephemeral target key must not be written to logs'
fi

rm -f "$LOCAL_STOP_MARKER"
: >"$CHILD_LOG"
status=0
env -i \
  LITELLM_API_BASE='https://litellm.example.test' \
  LITELLM_API_KEY='synthetic-test-key' \
  KLICKER_EVAL_API_ORIGIN='https://api.klicker.localhost' \
  KLICKER_EVAL_CHAT_ORIGIN='https://chat.klicker.localhost' \
  KLICKER_EVAL_PARTICIPANT_USERNAME='synthetic-participant' \
  KLICKER_EVAL_PARTICIPANT_PASSWORD='synthetic-password' \
  KLICKER_TEST_ADAPTER_SCRIPT="$FAKE_REPO/apps/chat/scripts/klicker-evaluation-target.mjs" \
  KLICKER_TEST_ADAPTER_STOP_MARKER="$LOCAL_STOP_MARKER" \
  KLICKER_TEST_EXEC_RUNNER='true' \
  KLICKER_TEST_RUNNER_STATUS='74' \
  PATH="$TEST_PATH" \
  KLICKER_TEST_REPO_ROOT="$FAKE_REPO" \
  KLICKER_TEST_CHILD_LOG="$CHILD_LOG" \
  "$WRAPPER" --local-target --mode query --limit 1 \
  >"$TEST_ROOT/local-failure.stdout" \
  2>"$TEST_ROOT/local-failure.stderr" || status=$?

[ "$status" -eq 74 ] || fail "local child failure returned $status instead of 74"
[ -s "$LOCAL_STOP_MARKER" ] || fail 'local adapter must stop after a failed child run'

echo '[test-klicker-eval-wrapper] PASS'
