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

retire_open_promotions() {
  require_repository
  local auto_merge list_output number
  local -a leftovers=() numbers=()

  list_output="$(
    gh pr list --state open --limit 100 --json number,headRefName \
      --jq '.[] | select(.headRefName | startswith("chore/promote-stg-")) | .number'
  )"
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

  list_output="$(
    gh pr list --state open --limit 100 --json number,headRefName \
      --jq '.[] | select(.headRefName | startswith("chore/promote-stg-")) | .number'
  )"
  while IFS= read -r number; do
    [ -n "$number" ] && leftovers+=("$number")
  done <<<"$list_output"
  [ "${#leftovers[@]}" -eq 0 ] \
    || fail "open promotion PRs remain after retirement: ${leftovers[*]}"
}

merge_verified_promotion() {
  [ "$#" -eq 3 ] \
    || fail 'merge-verified requires PR number, verified head SHA, and short release SHA'
  require_repository

  local pr_number="$1"
  local verified_head="$2"
  local short_sha="$3"
  local attempts="${STG_PROMOTION_MERGE_ATTEMPTS:-12}"
  local delay="${STG_PROMOTION_MERGE_DELAY_SECONDS:-20}"
  local attempt head merge_result merge_state mergeable pr_json state

  [[ "$pr_number" =~ ^[0-9]+$ ]] || fail 'promotion PR number must be numeric'
  [[ "$verified_head" =~ ^[0-9a-f]{40}$ ]] \
    || fail 'verified promotion head must be a 40-character lowercase SHA'
  [[ "$short_sha" =~ ^[0-9a-f]{7,40}$ ]] \
    || fail 'short release SHA must contain 7 to 40 lowercase hexadecimal characters'
  [[ "$attempts" =~ ^[1-9][0-9]*$ ]] \
    || fail 'STG_PROMOTION_MERGE_ATTEMPTS must be a positive integer'
  [[ "$delay" =~ ^[0-9]+$ ]] \
    || fail 'STG_PROMOTION_MERGE_DELAY_SECONDS must be a non-negative integer'

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    pr_json="$(
      gh pr view "$pr_number" \
        --json state,mergeable,mergeStateStatus,headRefOid
    )"
    state="$(jq -r '.state' <<<"$pr_json")"
    head="$(jq -r '.headRefOid' <<<"$pr_json")"
    mergeable="$(jq -r '.mergeable' <<<"$pr_json")"
    merge_state="$(jq -r '.mergeStateStatus' <<<"$pr_json")"

    [ "$head" = "$verified_head" ] \
      || fail "promotion PR #${pr_number} head changed from verified ${verified_head} to ${head}"

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
    [ "$#" -eq 1 ] \
      || fail 'pause control --retire-open-promotions accepts no value'
    retire_open_promotions
    ;;
  --merge-verified)
    shift
    merge_verified_promotion "$@"
    ;;
  *)
    fail 'promotion control requires --value, --live, --retire-open-promotions, or --merge-verified'
    ;;
esac
