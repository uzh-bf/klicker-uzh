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
    FAKE_STATE="${ROLE_STATE:-${TEMP_DIR}/state}" \
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

make_role_map() {
  jq -n '{runners: [range(1;9) | . as $id | {
    id: $id, name: ("public-pr-arm64-0" + ($id|tostring)),
    host: (if $id <= 4 then "synthetic-a" else "synthetic-b" end),
    state: (if ([1,2,5,6]|index($id)) != null then "active" else "held" end),
    roles: (if $id == 1 or $id == 5 then ["build","shard"]
      elif $id == 2 or $id == 6 then ["shard"] else [] end),
    priorCustomLabels: ["docker","public-pr-arm64","playwright","keep-me"]
  }]}' >"${TEMP_DIR}/roles.json"
}

expect_role_check() {
  ROLE_STATE="${TEMP_DIR}/roles-check"
  make_role_map
  run_policy roles-exact --check-roles "${TEMP_DIR}/roles.json" >"${TEMP_DIR}/roles-check.out"
  if grep -Eq '^(PUT|PATCH|POST|DELETE) ' "${ROLE_STATE}.calls"; then
    fail 'role check made an API mutation'
  fi
  unset ROLE_STATE
}

expect_role_apply() {
  ROLE_STATE="${TEMP_DIR}/roles-apply"
  make_role_map
  printf 'APPLY PUBLIC PR RUNNER ROLES\n' |
    run_policy roles-apply --apply-roles "${TEMP_DIR}/roles.json" --receipt "${TEMP_DIR}/receipt.jsonl" >"${TEMP_DIR}/roles-apply.out"
  jq -e 'index("keep-me") != null and index("playwright-build") != null and
    index("playwright-shard") != null and index("Linux") == null' "${ROLE_STATE}.labels-1" >/dev/null ||
    fail 'build runner labels were not replaced with preserved custom labels'
  jq -e 'index("keep-me") != null and index("playwright-build") == null and
    index("playwright-shard") != null' "${ROLE_STATE}.labels-2" >/dev/null ||
    fail 'shard runner received an incorrect role'
  [[ ! -f "${ROLE_STATE}.labels-3" ]] || fail 'unchanged held runner was written'
  jq -se '.[0].phase == "captured" and (.[0].map.runners | length) == 8 and
    .[-1].phase == "complete"' "${TEMP_DIR}/receipt.jsonl" >/dev/null || fail 'receipt is incomplete'
  if grep -Ev '^(GET |PUT /orgs/uzh-bf/actions/runners/[1-8]/labels$)' "${ROLE_STATE}.calls"; then
    fail 'role apply mutated group policy or an unrelated target'
  fi
  # The unchanged map checks desired labels after application, without rewriting priors.
  run_policy roles-apply --check-roles "${TEMP_DIR}/roles.json" >/dev/null
  unset ROLE_STATE
}

expect_role_map_rejection() {
  local mutation
  for mutation in \
    '.runners[1].roles = ["build","shard"]' \
    '.runners[1].roles = []' \
    '.runners[2].roles = ["shard"]' \
    '.runners[1].id = 1' \
    '.runners[1].host = "synthetic-c"' \
    '.runners[1].roles = ["unknown"]' \
    '.runners[1].name = "foreign-runner"' \
    '.runners[1].id = 99' \
    'del(.runners[7])'; do
    make_role_map
    jq "$mutation" "${TEMP_DIR}/roles.json" >"${TEMP_DIR}/invalid.json"
    ROLE_STATE="${TEMP_DIR}/invalid-state"
    if run_policy roles-apply --apply-roles "${TEMP_DIR}/invalid.json" --receipt "${TEMP_DIR}/invalid-receipt.jsonl" >"${TEMP_DIR}/invalid.out" 2>&1; then
      fail "invalid role map accepted: ${mutation}"
    fi
    [[ ! -f "${TEMP_DIR}/invalid-receipt.jsonl" ]] || fail 'invalid map opened a write receipt'
    if [[ -f "${ROLE_STATE}.calls" ]] && grep -Eq '^(PUT|PATCH|POST|DELETE) ' "${ROLE_STATE}.calls"; then
      fail 'invalid role map caused an API write'
    fi
  done
  # A malformed role invocation must never fall through to group-policy apply.
  unset ROLE_STATE
  rm -f -- "${TEMP_DIR}/state"
  if printf 'LOCK PUBLIC PR RUNNER GROUP\n' |
    run_policy drift --apply-roles '' --receipt "${TEMP_DIR}/empty-map.receipt" >"${TEMP_DIR}/empty-map.out" 2>&1; then
    fail 'empty role-map path was accepted'
  fi
  [[ ! -f "${TEMP_DIR}/state" ]] || fail 'role mode fell through to group-policy writes'
  unset ROLE_STATE
}

expect_role_failures() {
  local scenario
  make_role_map
  for scenario in roles-policy-drift roles-denied roles-incomplete-membership roles-incomplete-labels roles-busy roles-stale-prior \
    roles-concurrent roles-write-failure roles-readback-failure roles-readback-mismatch; do
    ROLE_STATE="${TEMP_DIR}/${scenario}"
    if printf 'APPLY PUBLIC PR RUNNER ROLES\n' |
      run_policy "$scenario" --apply-roles "${TEMP_DIR}/roles.json" --receipt "${ROLE_STATE}.receipt" >"${ROLE_STATE}.out" 2>&1; then
      fail "${scenario} reported verified success"
    fi
    if [[ -f "${ROLE_STATE}.receipt" ]]; then
      jq -se '.[0].phase == "captured" and .[-1].phase == "stopped" and
        .[-1].recovery == "operator-required" and all(.[]; .phase != "complete")' "${ROLE_STATE}.receipt" >/dev/null ||
        fail "${scenario} did not record the unverified recovery state"
      [[ -f "${ROLE_STATE}.labels-1" ]] || fail "${scenario} did not exercise a partial batch"
      [[ ! -f "${ROLE_STATE}.labels-5" ]] || fail "${scenario} continued after an unsafe write"
    elif grep -Eq '^(PUT|PATCH|POST|DELETE) ' "${ROLE_STATE}.calls"; then
      fail "${scenario} wrote labels before prior-state validation"
    fi
  done
  # An existing receipt must survive unchanged, and confirmation is separate from group apply.
  for scenario in roles-receipt-exists roles-confirmation; do
    ROLE_STATE="${TEMP_DIR}/${scenario}"
    printf 'preserve-receipt\n' >"${ROLE_STATE}.receipt"
    if printf 'LOCK PUBLIC PR RUNNER GROUP\n' |
      run_policy "$scenario" --apply-roles "${TEMP_DIR}/roles.json" --receipt "${ROLE_STATE}.receipt" >"${ROLE_STATE}.out" 2>&1; then
      fail 'group confirmation authorized a label change'
    fi
    [[ "$(cat "${ROLE_STATE}.receipt")" == 'preserve-receipt' ]] || fail 'prior receipt was overwritten'
    if [[ "$scenario" == 'roles-receipt-exists' ]]; then
      if printf 'APPLY PUBLIC PR RUNNER ROLES\n' |
        run_policy "$scenario" --apply-roles "${TEMP_DIR}/roles.json" --receipt "${ROLE_STATE}.receipt" >"${ROLE_STATE}.out" 2>&1; then
        fail 'existing receipt allowed label writes'
      fi
      [[ "$(cat "${ROLE_STATE}.receipt")" == 'preserve-receipt' ]] || fail 'prior receipt was overwritten'
    fi
    if grep -Eq '^(PUT|PATCH|POST|DELETE) ' "${ROLE_STATE}.calls"; then
      fail 'confirmation or receipt failure caused an API write'
    fi
  done
  ROLE_STATE="${TEMP_DIR}/roles-special-receipt"
  ln -s /dev/null "${ROLE_STATE}.receipt"
  if printf 'APPLY PUBLIC PR RUNNER ROLES\n' |
    run_policy roles-special-receipt --apply-roles "${TEMP_DIR}/roles.json" --receipt "${ROLE_STATE}.receipt" >"${ROLE_STATE}.out" 2>&1; then
    fail 'a special-file symlink discarded the required receipt'
  fi
  if grep -Eq '^(PUT|PATCH|POST|DELETE) ' "${ROLE_STATE}.calls"; then
    fail 'a special receipt path allowed label writes'
  fi
  unset ROLE_STATE
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
  expect_role_check
  expect_role_apply
  expect_role_map_rejection
  expect_role_failures
  printf 'PASS: runner-group policy reconciliation\n'
}

main "$@"
