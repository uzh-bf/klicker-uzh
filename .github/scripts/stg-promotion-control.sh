#!/usr/bin/env bash

set -euo pipefail

fail() {
  echo "::error::$*" >&2
  exit 1
}

check_pause_value() {
  case "$1" in
    '') ;;
    false) ;;
    true)
      fail 'staging promotion is paused by STG_PROMOTION_PAUSED'
      ;;
    *)
      fail 'STG_PROMOTION_PAUSED must be exactly true, false, or unset'
      ;;
  esac
}

require_repository() {
  : "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
}

require_live_unpaused() {
  require_repository
  local value

  # Read through the API instead of reusing `${{ vars.* }}`: Actions resolves
  # contexts before a running job can observe a later operator change.
  value="$(
    gh api --paginate --slurp \
      "/repos/${GITHUB_REPOSITORY}/actions/variables?per_page=30" \
      --jq '[.[].variables[] | select(.name == "STG_PROMOTION_PAUSED") | .value][0] // ""'
  )"
  check_pause_value "$value"
}

list_workflow_promotions() {
  [ "$#" -eq 1 ] || fail 'promotion listing requires the expected base branch'
  require_repository

  local expected_base="$1"
  local repository_owner="${GITHUB_REPOSITORY%%/*}"

  [[ "$expected_base" =~ ^[A-Za-z0-9_.-]+$ ]] \
    || fail 'expected promotion base must be a Docker-safe branch name'

  gh api --paginate --slurp \
    "/repos/${GITHUB_REPOSITORY}/pulls?state=open&per_page=100" \
    | jq -r \
      --arg base "$expected_base" \
      --arg owner "$repository_owner" \
      --arg repository "$GITHUB_REPOSITORY" \
      '.[][] |
       select(
         .base.ref == $base and
         (.head.ref | startswith("chore/promote-stg-")) and
         .head.repo.full_name == $repository and
         .head.repo.owner.login == $owner
       ) |
       .number'
}

retire_open_promotions() {
  [ "$#" -eq 1 ] \
    || fail 'promotion retirement requires the expected base branch'
  require_repository
  local expected_base="$1"
  local auto_merge list_output number
  local -a leftovers=() numbers=()

  list_output="$(list_workflow_promotions "$expected_base")"
  while IFS= read -r number; do
    [ -n "$number" ] && numbers+=("$number")
  done <<<"$list_output"

  for number in "${numbers[@]}"; do
    [ -n "$number" ] || continue
    auto_merge="$(
      gh pr view "$number" --json autoMergeRequest \
        --jq '.autoMergeRequest != null'
    )"
    case "$auto_merge" in
      true)
        require_live_unpaused
        gh pr merge "$number" --disable-auto
        ;;
      false) ;;
      *) fail "could not determine auto-merge state for promotion PR #${number}" ;;
    esac

    require_live_unpaused
    gh pr close "$number" --delete-branch \
      --comment 'Retired by the staging promotion single-writer guard.'
  done

  list_output="$(list_workflow_promotions "$expected_base")"
  while IFS= read -r number; do
    [ -n "$number" ] && leftovers+=("$number")
  done <<<"$list_output"
  [ "${#leftovers[@]}" -eq 0 ] \
    || fail "open same-repository promotion PRs targeting ${expected_base} remain after retirement: ${leftovers[*]}"
}

merge_verified_promotion() {
  [ "$#" -eq 4 ] \
    || fail 'merge-verified requires PR number, verified head SHA, short release SHA, and expected base branch'
  require_repository

  local pr_number="$1"
  local verified_head="$2"
  local short_sha="$3"
  local expected_base="$4"
  local expected_head_ref="chore/promote-stg-${short_sha}"
  local repository_owner="${GITHUB_REPOSITORY%%/*}"
  local attempts="${STG_PROMOTION_MERGE_ATTEMPTS:-12}"
  local delay="${STG_PROMOTION_MERGE_DELAY_SECONDS:-20}"
  local attempt auto_delete base cross_repository head head_owner head_ref
  local head_repository merge_result merge_state mergeable pr_json state status

  [[ "$pr_number" =~ ^[0-9]+$ ]] || fail 'promotion PR number must be numeric'
  [[ "$verified_head" =~ ^[0-9a-f]{40}$ ]] \
    || fail 'verified promotion head must be a 40-character lowercase SHA'
  [[ "$short_sha" =~ ^[0-9a-f]{7,40}$ ]] \
    || fail 'short release SHA must contain 7 to 40 lowercase hexadecimal characters'
  [[ "$expected_base" =~ ^[A-Za-z0-9_.-]+$ ]] \
    || fail 'expected promotion base must be a Docker-safe branch name'
  [[ "$attempts" =~ ^[1-9][0-9]*$ ]] \
    || fail 'STG_PROMOTION_MERGE_ATTEMPTS must be a positive integer'
  [[ "$delay" =~ ^[0-9]+$ ]] \
    || fail 'STG_PROMOTION_MERGE_DELAY_SECONDS must be a non-negative integer'

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    pr_json="$(
      gh pr view "$pr_number" \
        --json state,mergeable,mergeStateStatus,headRefOid,headRefName,baseRefName,headRepository,headRepositoryOwner,isCrossRepository
    )"
    state="$(jq -r '.state' <<<"$pr_json")"
    head="$(jq -r '.headRefOid' <<<"$pr_json")"
    head_ref="$(jq -r '.headRefName' <<<"$pr_json")"
    base="$(jq -r '.baseRefName' <<<"$pr_json")"
    head_repository="$(jq -r '.headRepository.nameWithOwner // ""' <<<"$pr_json")"
    head_owner="$(jq -r '.headRepositoryOwner.login // ""' <<<"$pr_json")"
    cross_repository="$(jq -r '.isCrossRepository' <<<"$pr_json")"
    mergeable="$(jq -r '.mergeable' <<<"$pr_json")"
    merge_state="$(jq -r '.mergeStateStatus' <<<"$pr_json")"

    [ "$head" = "$verified_head" ] \
      || fail "promotion PR #${pr_number} head changed from verified ${verified_head} to ${head}"
    [ "$head_ref" = "$expected_head_ref" ] \
      || fail "promotion PR #${pr_number} head branch changed from ${expected_head_ref} to ${head_ref}"
    [ "$base" = "$expected_base" ] \
      || fail "promotion PR #${pr_number} base changed from ${expected_base} to ${base}"
    if [ "$cross_repository" != 'false' ] \
      || [ "$head_repository" != "$GITHUB_REPOSITORY" ] \
      || [ "$head_owner" != "$repository_owner" ]; then
      fail "promotion PR #${pr_number} is no longer owned by ${GITHUB_REPOSITORY}"
    fi

    status="$(
      gh api --paginate --slurp \
        "/repos/${GITHUB_REPOSITORY}/commits/${verified_head}/statuses?per_page=100" \
        --jq '[.[][] | select(.context == "final-ai-review")] | first | [.state, .description] | @tsv'
    )"
    [ "$status" = $'success\tVerified generated staging promotion' ] \
      || fail "promotion PR #${pr_number} no longer has its exact verification status"

    case "$state" in
      MERGED)
        echo "::notice::promotion of ${short_sha} merged"
        return 0
        ;;
      CLOSED)
        fail "promotion PR #${pr_number} was closed before merge"
        ;;
      OPEN) ;;
      *) fail "promotion PR #${pr_number} has unexpected state ${state}" ;;
    esac

    if [ "$mergeable" = 'CONFLICTING' ] \
      || [ "$merge_state" = 'DIRTY' ] \
      || [ "$merge_state" = 'BEHIND' ]; then
      fail "promotion PR #${pr_number} is ${mergeable}/${merge_state} and requires a new promotion run"
    fi

    if [ "$mergeable" = 'MERGEABLE' ] && [ "$merge_state" = 'CLEAN' ]; then
      auto_delete="$(
        gh api "/repos/${GITHUB_REPOSITORY}" --jq '.delete_branch_on_merge'
      )"
      [ "$auto_delete" = 'true' ] \
        || fail 'repository must enable automatic head-branch deletion before staging promotion'
      require_live_unpaused
      merge_result="$(
        gh api --method PUT \
          "/repos/${GITHUB_REPOSITORY}/pulls/${pr_number}/merge" \
          -f "sha=${verified_head}" \
          -f merge_method=squash \
          -f "commit_title=chore(deploy): promote ${short_sha} to stg [skip ci]"
      )"
      jq -e '.merged == true' >/dev/null <<<"$merge_result" \
        || fail "GitHub did not synchronously merge promotion PR #${pr_number}"
      echo "::notice::promotion of ${short_sha} merged"
      return 0
    fi

    echo "attempt ${attempt}: waiting for mergeable promotion PR #${pr_number} (${state}/${mergeable}/${merge_state})"
    [ "$attempt" -eq "$attempts" ] || sleep "$delay"
  done

  fail "promotion PR #${pr_number} did not become synchronously mergeable"
}

case "${1:-}" in
  --value)
    [ "$#" -eq 2 ] \
      || fail 'pause control --value requires exactly one value'
    check_pause_value "$2"
    ;;
  --live)
    [ "$#" -eq 1 ] \
      || fail 'pause control --live accepts no value'
    require_live_unpaused
    ;;
  --retire-open-promotions)
    shift
    retire_open_promotions "$@"
    ;;
  --merge-verified)
    shift
    merge_verified_promotion "$@"
    ;;
  *)
    fail 'promotion control requires --value, --live, --retire-open-promotions, or --merge-verified'
    ;;
esac
