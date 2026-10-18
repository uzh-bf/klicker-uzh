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
ROLE_MAP=''
ROLE_MAP_PATH=''
RECEIPT=''
RECEIPT_OPEN=false
ROLES_COMPLETE=false

usage() {
  printf '%s\n' \
    'Lock and verify the public-pr-arm64 organization runner group.' \
    '' \
    'Usage:' \
    '  reconcile-public-pr-arm64-runner-group.sh --check' \
    '  reconcile-public-pr-arm64-runner-group.sh --apply' \
    '  reconcile-public-pr-arm64-runner-group.sh --check-roles PRIVATE_MAP.json' \
    '  reconcile-public-pr-arm64-runner-group.sh --apply-roles PRIVATE_MAP.json --receipt NEW_PRIVATE.jsonl' \
    '' \
    'Modes:' \
    '  --check  Read the live policy and fail if it differs. Makes no changes.' \
    '  --apply  Replace repository access with only uzh-bf/klicker-uzh and restrict' \
    '           workflow access to the v3 public Playwright reusable workflow.' \
    '  --check-roles  Verify the complete role map and locked group without writes.' \
    '  --apply-roles  Change only role labels after a separately approved drain.' \
    '                 Requires complete prior custom labels and a new private receipt.' \
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
  if [[ "$RECEIPT_OPEN" == true && "$ROLES_COMPLETE" != true ]]; then
    printf '{"phase":"stopped","verified":false,"recovery":"operator-required"}\n' >&3
    printf 'Role batch unverified. Keep dispatch paused; use the private receipt for approved recovery.\n' >&2
  fi
  TOKEN=''
  unset TOKEN GH_TOKEN
}

trap cleanup EXIT

parse_args() {
  if [[ "${1:-}" == '--check-roles' && $# == 2 ]]; then
    MODE='check-roles'
    ROLE_MAP_PATH=$2
    return
  fi
  if [[ "${1:-}" == '--apply-roles' && $# == 4 && "${3:-}" == '--receipt' ]]; then
    MODE='apply-roles'
    ROLE_MAP_PATH=$2
    RECEIPT=$4
    return
  fi
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
  if [[ "$MODE" == *-roles ]]; then
    jq -e '.total_count == (.runner_groups | length)' <<<"$groups_json" >/dev/null ||
      die 'incomplete runner-group response'
  fi
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
  local response confirmation=${1:-$CONFIRMATION}
  printf '\n%s\n' "${2:-This replaces runner-group access with one repository and one workflow.}" >&2
  printf 'Type exactly: %s: ' "$confirmation" >&2
  if [[ -t 0 && -r /dev/tty ]]; then
    IFS= read -r response </dev/tty
  else
    IFS= read -r response
  fi
  [[ "$response" == "$confirmation" ]] || die 'confirmation did not match; no changes were made'
}

apply_policy() {
  local repositories_payload quarantine_payload

  require_confirmation
  # Deny every workflow until both access restrictions are installed.
  quarantine_payload=$(jq -nc --arg name "$RUNNER_GROUP" \
    '{name: $name, visibility: "selected", allows_public_repositories: false,
      restricted_to_workflows: true, selected_workflows: []}')
  github_api PATCH "/orgs/${ORGANIZATION}/actions/runner-groups/${GROUP_ID}" \
    --input - <<<"$quarantine_payload" >/dev/null ||
    die 'could not disable workflow access; no further policy updates attempted'

  repositories_payload=$(jq -nc --argjson repository_id "$REPOSITORY_ID" \
    '{selected_repository_ids: [$repository_id]}')
  github_api PUT "/orgs/${ORGANIZATION}/actions/runner-groups/${GROUP_ID}/repositories" \
    --input - <<<"$repositories_payload" >/dev/null ||
    die 'runner-group repository policy update failed; workflow access remains disabled'

  github_api PATCH "/orgs/${ORGANIZATION}/actions/runner-groups/${GROUP_ID}" \
    -f "name=${RUNNER_GROUP}" \
    -f visibility=selected \
    -F allows_public_repositories=true \
    -F restricted_to_workflows=true \
    -f "selected_workflows[]=${WORKFLOW_REF}" >/dev/null ||
    die 'runner-group workflow policy update failed; verify policy with --check before retrying'
}

load_role_map() {
  ROLE_MAP=$(jq -ce '
    def valid_label: type == "string" and length > 0 and length <= 255;
    select(keys == ["runners"] and (.runners | type == "array" and length == 8)) |
    select(all(.runners[];
      keys == ["host","id","name","priorCustomLabels","roles","state"] and
      (.id | type == "number" and . > 0 and floor == .) and
      (.name | type == "string") and
      (.host | type == "string" and test("^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")) and
      (.priorCustomLabels | type == "array" and all(.[]; valid_label) and
        (map(ascii_downcase) | length == (unique|length))) and
      ((.state == "active" and (.roles == ["shard"] or .roles == ["build","shard"])) or
       (.state == "held" and .roles == [])))) |
    select((.runners | map(.id) | unique | length) == 8) |
    select((.runners | map(.name) | unique | length) == 8) |
    select((.runners | map(.host) | unique | length) == 2) |
    select(all(.runners | group_by(.host)[];
      [ .[] | select(.roles | index("build")) ] | length == 1)) |
    .runners |= map(. + {desiredCustomLabels:
      ((.priorCustomLabels | map(select((ascii_downcase != "playwright-build") and
        (ascii_downcase != "playwright-shard")))) +
      (.roles | map("playwright-" + .)) | sort)}) |
    .runners |= sort_by(.id)
  ' "$ROLE_MAP_PATH") || die 'invalid or incomplete role map'
}

validate_role_targets() {
  local live_identity map_identity
  policy_is_exact || die 'role operations require an already locked runner-group policy'
  jq -e '.total_count == (.runners | length)' <<<"$RUNNERS_JSON" >/dev/null ||
    die 'incomplete runner membership response'
  jq -e '.total_count == (.repositories | length)' <<<"$REPOSITORIES_JSON" >/dev/null ||
    die 'incomplete repository policy response'
  live_identity=$(jq -c '[.runners[] | {id,name}] | sort_by(.id)' <<<"$RUNNERS_JSON")
  map_identity=$(jq -c '[.runners[] | {id,name}] | sort_by(.id)' <<<"$ROLE_MAP")
  [[ "$live_identity" == "$map_identity" ]] || die 'role map identity differs from exact group membership'
  jq -e --argjson map "$ROLE_MAP" '
    all(.runners[]; . as $runner |
      ($map.runners[] | select(.id == $runner.id)) as $entry |
      $runner.status == (if $entry.state == "active" then "online" else "offline" end))
  ' <<<"$RUNNERS_JSON" >/dev/null || die 'active/held runner status differs from role map'
}

read_runner_labels() {
  local id=$1 document
  document=$(github_api GET "/orgs/${ORGANIZATION}/actions/runners/${id}/labels") ||
    die 'runner-label lookup failed'
  jq -e '
    (.labels | type == "array") and .total_count == (.labels | length) and
    all(.labels[]; (.name | type == "string" and length > 0) and
      (.type == "custom" or .type == "read-only")) and
    ([.labels[].name | ascii_downcase] | length == (unique | length)) and
    ([.labels[] | select(.type == "read-only") | .name | ascii_downcase] |
      index("linux") != null and index("arm64") != null) and
    ([.labels[] | select(.type == "custom") | .name | ascii_downcase] |
      index("docker") != null and index("public-pr-arm64") != null and index("playwright") != null)
  ' <<<"$document" >/dev/null || die 'incomplete or incompatible runner-label response'
  jq -c '[.labels[] | select(.type == "custom") | .name] | sort' <<<"$document"
}

check_role_labels() {
  local id expected actual
  for id in $(jq -r '.runners[].id' <<<"$ROLE_MAP"); do
    expected=$(jq -c --argjson id "$id" '.runners[] | select(.id == $id) | .desiredCustomLabels' <<<"$ROLE_MAP")
    actual=$(read_runner_labels "$id") || die 'role label verification failed'
    [[ "$actual" == "$expected" ]] || die 'runner labels differ from the complete desired role map'
  done
}

require_idle_roles() {
  jq -e 'all(.runners[]; .busy == false)' <<<"$RUNNERS_JSON" >/dev/null ||
    die 'every pool runner must be idle; do not interrupt assigned jobs'
}

apply_role_labels() {
  local id prior desired actual group_id=$GROUP_ID repository_id=$REPOSITORY_ID
  require_idle_roles
  # Capture every complete prior set before the first API write.
  for id in $(jq -r '.runners[].id' <<<"$ROLE_MAP"); do
    prior=$(jq -c --argjson id "$id" '.runners[] | select(.id == $id) | .priorCustomLabels | sort' <<<"$ROLE_MAP")
    actual=$(read_runner_labels "$id") || die 'prior runner-label capture failed'
    [[ "$actual" == "$prior" ]] || die 'prior custom labels differ from role map; no labels changed'
  done
  require_confirmation 'APPLY PUBLIC PR RUNNER ROLES' \
    'This changes only scheduling role labels. Approved dispatch pause, drain, host-state proof and one operator are required.'
  # Never overwrite a prior receipt, including through a symlink.
  [[ ! -e "$RECEIPT" && ! -L "$RECEIPT" ]] || die 'receipt path already exists'
  set -o noclobber
  exec 3>"$RECEIPT" || die 'receipt must be a new writable private file'
  set +o noclobber
  RECEIPT_OPEN=true
  jq -nc --arg organization "$ORGANIZATION" --argjson groupId "$GROUP_ID" --argjson map "$ROLE_MAP" \
    '{phase:"captured",organization:$organization,groupId:$groupId,map:$map}' >&3 || die 'receipt capture failed'
  for id in $(jq -r '.runners[].id' <<<"$ROLE_MAP"); do
    load_live_state
    validate_runner_membership
    validate_role_targets
    require_idle_roles
    [[ "$GROUP_ID" == "$group_id" && "$REPOSITORY_ID" == "$repository_id" ]] || die 'policy target changed during role apply'
    prior=$(jq -c --argjson id "$id" '.runners[] | select(.id == $id) | .priorCustomLabels | sort' <<<"$ROLE_MAP")
    desired=$(jq -c --argjson id "$id" '.runners[] | select(.id == $id) | .desiredCustomLabels' <<<"$ROLE_MAP")
    actual=$(read_runner_labels "$id") || die 'pre-write label read failed'
    [[ "$actual" == "$prior" ]] || die 'concurrent label change detected; no further writes attempted'
    [[ "$prior" != "$desired" ]] || continue
    jq -nc --argjson runnerId "$id" '{phase:"write-started",runnerId:$runnerId}' >&3 || die 'receipt write failed'
    github_api PUT "/orgs/${ORGANIZATION}/actions/runners/${id}/labels" \
      --input - <<<"$(jq -nc --argjson labels "$desired" '{labels:$labels}')" >/dev/null ||
      die 'label write failed or outcome unknown; no further writes attempted'
    actual=$(read_runner_labels "$id") || die 'post-write label read failed'
    [[ "$actual" == "$desired" ]] || die 'post-write labels differ; no further writes attempted'
    jq -nc --argjson runnerId "$id" '{phase:"verified",runnerId:$runnerId}' >&3 || die 'receipt write failed'
  done
  load_live_state
  validate_runner_membership
  validate_role_targets
  require_idle_roles
  [[ "$GROUP_ID" == "$group_id" && "$REPOSITORY_ID" == "$repository_id" ]] || die 'policy target changed during final readback'
  check_role_labels
  printf '{"phase":"complete","verified":true}\n' >&3 || die 'receipt completion failed'
  ROLES_COMPLETE=true
}

main() {
  parse_args "$@"
  require_tools
  if [[ "$MODE" == *-roles ]]; then
    load_role_map
  fi
  read_token
  load_live_state
  validate_runner_membership
  if [[ "$MODE" == *-roles ]]; then
    validate_role_targets
    if [[ "$MODE" == 'check-roles' ]]; then
      check_role_labels
    else
      apply_role_labels
    fi
    printf '\n==> Complete runner role policy verified\n'
    exit 0
  fi
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
