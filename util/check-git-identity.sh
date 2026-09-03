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
        check_range "${remote_sha}..${local_sha}"
      fi
    done
    ;;
  range)
    shift
    [[ "$#" -gt 0 ]] || fail 'range mode requires a Git revision range'
    check_range "$@"
    ;;
  *)
    fail "unknown mode: ${mode}"
    ;;
esac
