#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly ORGANIZATION='uzh-bf'
readonly REPOSITORY='uzh-bf/klicker-uzh'
readonly DEFAULT_BRANCH='v3'
readonly RUNNER_GROUP='public-pr-arm64'
readonly WORKFLOW_PATH='.github/workflows/public-pr-playwright-shards.yml'
readonly WORKFLOW_REF="${REPOSITORY}/${WORKFLOW_PATH}@refs/heads/${DEFAULT_BRANCH}"
readonly API_VERSION='2026-03-10'
readonly CONFIRMATION='LOCK PUBLIC PR RUNNER GROUP'

MODE=''
TOKEN=''
GROUP_ID=''
REPOSITORY_ID=''
GROUP_JSON=''
REPOSITORIES_JSON=''
RUNNERS_JSON=''

usage() {
  printf '%s\n' \
    'Lock and verify the public-pr-arm64 organization runner group.' \
    '' \
    'Usage:' \
    '  reconcile-public-pr-arm64-runner-group.sh --check' \
    '  reconcile-public-pr-arm64-runner-group.sh --apply' \
    '' \
    'Modes:' \
    '  --check  Read the live policy and fail if it differs. Makes no changes.' \
    '  --apply  Replace repository access with only uzh-bf/klicker-uzh and restrict' \
    '           workflow access to the v3 public Playwright reusable workflow.' \
    '' \
    'Authentication:' \
    '  Use a short-lived fine-grained token with organization Self-hosted runners' \
    '  read permission for --check or write permission for --apply, plus repository' \
    '  Metadata read permission. Set GH_TOKEN for non-interactive use or enter the' \
    '  token at the hidden prompt. The token is never written to disk.' \
    '' \
    'This script does not create, move, restart, register, or remove runners.'
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  TOKEN=''
  unset TOKEN GH_TOKEN
}

trap cleanup EXIT

parse_args() {
  (($# == 1)) || die 'select exactly one of --check or --apply'
  case "$1" in
    --check)
      MODE='check'
      ;;
    --apply)
      MODE='apply'
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      die 'select exactly one of --check or --apply'
      ;;
  esac
}

require_tools() {
  local tool
  for tool in gh jq; do
    command -v "$tool" >/dev/null 2>&1 || die "required tool is missing: ${tool}"
  done
}

read_token() {
  if [[ -n "${GH_TOKEN:-}" ]]; then
    TOKEN=$GH_TOKEN
    unset GH_TOKEN
    return
  fi

  [[ -t 0 && -r /dev/tty ]] ||
    die 'GH_TOKEN is required when no interactive terminal is available'
  printf 'Short-lived GitHub token: ' >/dev/tty
  IFS= read -r -s TOKEN </dev/tty
  printf '\n' >/dev/tty
  [[ -n "$TOKEN" ]] || die 'the GitHub token is empty'
}

github_api() {
  local method=$1 endpoint=$2
  shift 2
  GH_TOKEN=$TOKEN gh api \
    --method "$method" \
    -H 'Accept: application/vnd.github+json' \
    -H "X-GitHub-Api-Version: ${API_VERSION}" \
    "$endpoint" "$@"
}

load_live_state() {
  local repository_json groups_json group_count

  repository_json=$(github_api GET "/repos/${REPOSITORY}") ||
    die 'repository metadata lookup failed'
  [[ "$(jq -nr --argjson document "$repository_json" \
    '$document.full_name // empty')" == "$REPOSITORY" ]] ||
    die 'repository metadata returned an unexpected repository'
  [[ "$(jq -nr --argjson document "$repository_json" \
    '$document.private')" == 'false' ]] ||
    die 'the selected repository must be public'
  [[ "$(jq -nr --argjson document "$repository_json" \
    '$document.default_branch // empty')" == "$DEFAULT_BRANCH" ]] ||
    die "the repository default branch must be ${DEFAULT_BRANCH}"
  REPOSITORY_ID=$(jq -nr --argjson document "$repository_json" \
    '$document.id // empty')
  [[ "$REPOSITORY_ID" =~ ^[0-9]+$ ]] || die 'repository metadata has no numeric id'

  github_api GET "/repos/${REPOSITORY}/contents/${WORKFLOW_PATH}" \
    -f "ref=refs/heads/${DEFAULT_BRANCH}" >/dev/null ||
    die "${WORKFLOW_PATH} does not exist on refs/heads/${DEFAULT_BRANCH}"

  groups_json=$(github_api GET "/orgs/${ORGANIZATION}/actions/runner-groups" \
    -f per_page=100 -f page=1) || die 'runner-group listing failed'
  [[ "$(jq -nr --argjson document "$groups_json" \
    '$document.total_count // 0')" -le 100 ]] ||
    die 'more than 100 runner groups exist; pagination support is required'
  group_count=$(jq -n --argjson document "$groups_json" --arg name "$RUNNER_GROUP" \
    '[$document.runner_groups[] | select(.name == $name)] | length')
  [[ "$group_count" == '1' ]] || die 'the exact runner group must exist once'
  GROUP_JSON=$(jq -nc --argjson document "$groups_json" --arg name "$RUNNER_GROUP" \
    '$document.runner_groups[] | select(.name == $name)')
  GROUP_ID=$(jq -nr --argjson document "$GROUP_JSON" '$document.id // empty')
  [[ "$GROUP_ID" =~ ^[0-9]+$ ]] || die 'runner group has no numeric id'
  [[ "$(jq -nr --argjson document "$GROUP_JSON" \
    '$document.default // false')" == 'false' ]] ||
    die 'the default runner group cannot be managed by this script'
  [[ "$(jq -nr --argjson document "$GROUP_JSON" \
    '$document.inherited // false')" == 'false' ]] ||
    die 'the runner group is inherited and cannot be managed here'
  [[ "$(jq -nr --argjson document "$GROUP_JSON" \
    '$document.workflow_restrictions_read_only // false')" == 'false' ]] ||
    die 'workflow restrictions are read-only for this runner group'

  REPOSITORIES_JSON=$(github_api GET \
    "/orgs/${ORGANIZATION}/actions/runner-groups/${GROUP_ID}/repositories" \
    -f per_page=100 -f page=1) || die 'runner-group repository listing failed'
  [[ "$(jq -nr --argjson document "$REPOSITORIES_JSON" \
    '$document.total_count // 0')" -le 100 ]] ||
    die 'more than 100 selected repositories exist; refusing partial policy validation'

  RUNNERS_JSON=$(github_api GET \
    "/orgs/${ORGANIZATION}/actions/runner-groups/${GROUP_ID}/runners" \
    -f per_page=100 -f page=1) || die 'runner-group runner listing failed'
  [[ "$(jq -nr --argjson document "$RUNNERS_JSON" \
    '$document.total_count // 0')" -le 100 ]] ||
    die 'more than 100 runners exist; refusing partial membership validation'
}

print_live_state() {
  local repositories workflows runners online busy

  repositories=$(jq -nr --argjson document "$REPOSITORIES_JSON" \
    '$document | [.repositories[].full_name] | sort | join(",")')
  workflows=$(jq -nr --argjson document "$GROUP_JSON" \
    '$document | [.selected_workflows[]?] | sort | join(",")')
  runners=$(jq -nr --argjson document "$RUNNERS_JSON" \
    '$document | [.runners[].name] | sort | join(",")')
  online=$(jq -n --argjson document "$RUNNERS_JSON" \
    '$document | [.runners[] | select(.status == "online")] | length')
  busy=$(jq -n --argjson document "$RUNNERS_JSON" \
    '$document | [.runners[] | select(.busy == true)] | length')

  printf '%s\n' \
    'Runner-group policy:' \
    "  Organization: ${ORGANIZATION}" \
    "  Group: ${RUNNER_GROUP} (${GROUP_ID})" \
    "  Visibility: $(jq -nr --argjson document "$GROUP_JSON" '$document.visibility // "missing"')" \
    "  Allows public repositories: $(jq -nr --argjson document "$GROUP_JSON" '$document.allows_public_repositories // false')" \
    "  Restricted to workflows: $(jq -nr --argjson document "$GROUP_JSON" '$document.restricted_to_workflows // false')" \
    "  Selected repositories: ${repositories:-none}" \
    "  Selected workflows: ${workflows:-none}" \
    "  Runners: ${runners:-none}" \
    "  Runner status: ${online} online, ${busy} busy"
}

validate_runner_membership() {
  local expected actual
  expected=$(printf 'public-pr-arm64-%02d\n' {1..8} | sort)
  actual=$(jq -nr --argjson document "$RUNNERS_JSON" \
    '$document.runners[].name' | sort)
  [[ "$actual" == "$expected" ]] || die 'runner-group membership must be exactly public-pr-arm64-01 through -08'
}

policy_is_exact() {
  local expected_repositories expected_workflows

  expected_repositories=$(jq -nc --arg repository "$REPOSITORY" '[$repository]')
  expected_workflows=$(jq -nc --arg workflow "$WORKFLOW_REF" '[$workflow]')

  [[ "$(jq -nr --argjson document "$GROUP_JSON" \
    '$document.visibility // empty')" == 'selected' ]] &&
    [[ "$(jq -nr --argjson document "$GROUP_JSON" \
      '$document.allows_public_repositories // false')" == 'true' ]] &&
    [[ "$(jq -nr --argjson document "$GROUP_JSON" \
      '$document.restricted_to_workflows // false')" == 'true' ]] &&
    [[ "$(jq -nc --argjson document "$GROUP_JSON" \
      '[$document.selected_workflows[]?] | sort')" == "$expected_workflows" ]] &&
    [[ "$(jq -nc --argjson document "$REPOSITORIES_JSON" \
      '[$document.repositories[].full_name] | sort')" == "$expected_repositories" ]]
}

require_confirmation() {
  local response
  printf '\nThis replaces runner-group access with one repository and one workflow.\n' >&2
  printf 'Type exactly: %s: ' "$CONFIRMATION" >&2
  if [[ -t 0 && -r /dev/tty ]]; then
    IFS= read -r response </dev/tty
  else
    IFS= read -r response
  fi
  [[ "$response" == "$CONFIRMATION" ]] || die 'confirmation did not match; no changes were made'
}

apply_policy() {
  local repositories_payload

  require_confirmation
  github_api PATCH "/orgs/${ORGANIZATION}/actions/runner-groups/${GROUP_ID}" \
    -f "name=${RUNNER_GROUP}" \
    -f visibility=selected \
    -F allows_public_repositories=true \
    -F restricted_to_workflows=true \
    -f "selected_workflows[]=${WORKFLOW_REF}" >/dev/null ||
    die 'runner-group workflow policy update failed'

  repositories_payload=$(jq -nc --argjson repository_id "$REPOSITORY_ID" \
    '{selected_repository_ids: [$repository_id]}')
  github_api PUT "/orgs/${ORGANIZATION}/actions/runner-groups/${GROUP_ID}/repositories" \
    --input - <<<"$repositories_payload" >/dev/null ||
    die 'runner-group repository policy update failed'
}

main() {
  parse_args "$@"
  require_tools
  read_token
  load_live_state
  validate_runner_membership
  print_live_state

  if policy_is_exact; then
    printf '\n==> Runner-group policy is locked to KlickerUZH and the v3 public Playwright workflow\n'
    exit 0
  fi

  if [[ "$MODE" == 'check' ]]; then
    die 'runner-group policy differs from the required locked policy'
  fi

  apply_policy
  load_live_state
  validate_runner_membership
  print_live_state
  policy_is_exact || die 'post-apply policy readback differs from the required locked policy'
  printf '\n==> Runner-group policy lock completed and verified\n'
}

main "$@"
