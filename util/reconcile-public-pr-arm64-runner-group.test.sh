#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
readonly SCRIPT_DIR
readonly POLICY_SCRIPT="${SCRIPT_DIR}/reconcile-public-pr-arm64-runner-group.sh"
readonly FAKE_GH="${SCRIPT_DIR}/test-fixtures/runner-group-policy/gh"

TEMP_DIR=''

cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    rm -rf -- "$TEMP_DIR"
  fi
}

trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

make_fake_gh() {
  TEMP_DIR=$(mktemp -d -t runner-group-policy-test.XXXXXX)
  mkdir -p "${TEMP_DIR}/bin"
  [[ -x "$FAKE_GH" ]] || fail "fixture is not executable: ${FAKE_GH}"
  ln -s "$FAKE_GH" "${TEMP_DIR}/bin/gh"
}

run_policy() {
  local scenario=$1
  shift
  FAKE_SCENARIO=$scenario \
    FAKE_STATE="${TEMP_DIR}/state" \
    GH_TOKEN='test-token' \
    PATH="${TEMP_DIR}/bin:${PATH}" \
    "$POLICY_SCRIPT" "$@"
}

expect_check_success() {
  run_policy exact --check >"${TEMP_DIR}/exact.out"
  grep -Fq 'policy is locked to KlickerUZH' "${TEMP_DIR}/exact.out" ||
    fail 'exact policy did not report success'
}

expect_check_failure() {
  local scenario=$1 expected=$2
  if run_policy "$scenario" --check >"${TEMP_DIR}/${scenario}.out" 2>"${TEMP_DIR}/${scenario}.err"; then
    fail "${scenario} unexpectedly passed"
  fi
  grep -Fq "$expected" "${TEMP_DIR}/${scenario}.err" ||
    fail "${scenario} did not report ${expected}"
}

expect_apply_success() {
  rm -f -- "${TEMP_DIR}/state"
  printf 'LOCK PUBLIC PR RUNNER GROUP\n' |
    run_policy drift --apply >"${TEMP_DIR}/apply.out"
  grep -Fq 'policy lock completed and verified' "${TEMP_DIR}/apply.out" ||
    fail 'apply did not report verified success'
  [[ "$(cat "${TEMP_DIR}/state")" == 'after' ]] || fail 'apply did not execute both writes'
}

main() {
  bash -n "$POLICY_SCRIPT"
  make_fake_gh
  expect_check_success
  expect_check_failure extra-repository 'policy differs'
  expect_check_failure extra-workflow 'policy differs'
  expect_check_failure inherited 'runner group is inherited'
  expect_check_failure read-only 'workflow restrictions are read-only'
  expect_check_failure missing-runner 'membership must be exactly'
  expect_apply_success
  local scenario expected_state
  for scenario in disable-failure repository-failure enable-failure; do
    rm -f -- "${TEMP_DIR}/state"
    if printf 'LOCK PUBLIC PR RUNNER GROUP\n' |
      run_policy "$scenario" --apply >"${TEMP_DIR}/${scenario}.out" 2>&1; then
      fail "${scenario} unexpectedly succeeded"
    fi
    case "$scenario" in
      disable-failure) expected_state=before ;;
      repository-failure) expected_state=disabled ;;
      enable-failure) expected_state=repositories ;;
    esac
    [[ "$(cat "${TEMP_DIR}/state" 2>/dev/null || printf before)" == "$expected_state" ]] ||
      fail "${scenario} continued past its failed access update"
  done
  printf 'PASS: runner-group policy reconciliation\n'
}

main "$@"
