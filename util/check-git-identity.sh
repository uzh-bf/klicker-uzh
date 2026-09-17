#!/usr/bin/env bash
set -euo pipefail

fixture_name='CI fixture'
fixture_email='ci@example.invalid'
fixture_trailer="Co-authored-by: ${fixture_name} <${fixture_email}>"

fail() {
  printf 'Git identity guard failed: %s\n' "$1" >&2
  exit 1
}

check_effective_identity() {
  local author committer local_name local_email
  author=$(git var GIT_AUTHOR_IDENT)
  committer=$(git var GIT_COMMITTER_IDENT)
  local_name=$(git config --local --get user.name || true)
  local_email=$(git config --local --get user.email || true)

  [[ "$author" != "${fixture_name} <${fixture_email}> "* ]] || fail 'fixture author is active'
  [[ "$committer" != "${fixture_name} <${fixture_email}> "* ]] || fail 'fixture committer is active'
  [[ "$local_name" != "$fixture_name" ]] || fail 'fixture name is stored in repository config'
  [[ "$local_email" != "$fixture_email" ]] || fail 'fixture email is stored in repository config'
}

check_range() {
  local bad
  bad=$({
    git log --format='%H %s' --author="$fixture_email" "$@"
    git log --format='%H %s' --committer="$fixture_email" "$@"
    git log --format='%H %s' --fixed-strings --grep="$fixture_trailer" "$@"
  } | sort -u)
  if [[ -n "$bad" ]]; then
    printf 'Git identity guard failed: outgoing commits use the fixture identity:\n%s\n' "$bad" >&2
    exit 1
  fi
}

mode=${1:-current}
case "$mode" in
  current)
    check_effective_identity
    ;;
  pre-push)
    check_effective_identity
    zero=0000000000000000000000000000000000000000
    while read -r _ local_sha _ remote_sha; do
      [[ "$local_sha" != "$zero" ]] || continue
      if [[ "$remote_sha" == "$zero" ]]; then
        check_range "$local_sha" --not --remotes
      else
        # The guard stops commits from leaving the machine for the first
        # time. Commits already reachable from a remote-tracking ref were
        # scanned when they were first pushed and may legitimately reappear
        # here through merged upstream history (e.g. a v3 sync merge).
        check_range "${remote_sha}..${local_sha}" --not --remotes
      fi
    done
    ;;
  range)
    shift
    [[ "$#" -gt 0 ]] || fail 'range mode requires a Git revision range'
    range_spec=$1
    shift
    # Commits already published on the integration branches cannot be
    # rewritten, so optional --published refs and --published-glob patterns
    # exclude them from the scan. Only commits that are new relative to every
    # published integration branch must satisfy the identity contract.
    # All refs share one --not flag: repeating --not would toggle the
    # exclusion back off for every second ref.
    published_refs=()
    while [[ "$#" -gt 0 ]]; do
      case "$1" in
        --published)
          shift
          while [[ "$#" -gt 0 && "$1" != --* ]]; do
            if git rev-parse --verify -q "$1" >/dev/null 2>&1; then
              published_refs+=("$1")
            fi
            shift
          done
          ;;
        --published-glob)
          shift
          [[ "$#" -gt 0 ]] || fail '--published-glob requires a ref pattern'
          while IFS= read -r published_ref; do
            [[ -n "$published_ref" ]] || continue
            published_refs+=("$published_ref")
          done < <(git for-each-ref --format='%(refname)' "$1")
          shift
          ;;
        *)
          fail "unknown range argument: $1"
          ;;
      esac
    done
    if [[ "${#published_refs[@]}" -gt 0 ]]; then
      check_range "$range_spec" --not "${published_refs[@]}"
    else
      check_range "$range_spec"
    fi
    ;;
  *)
    fail "unknown mode: ${mode}"
    ;;
esac
