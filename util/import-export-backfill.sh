#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo 'Usage: ./util/import-export-backfill.sh <stg|prd>' >&2
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

ENVIRONMENT="$1"
case "$ENVIRONMENT" in
  stg | prd) ;;
  *)
    usage
    exit 1
    ;;
esac

if [[ -z "${HOME:-}" || "$HOME" != /* || ! -d "$HOME" ]]; then
  echo 'A valid absolute HOME directory is required.' >&2
  exit 1
fi

SCRIPT_DIR_LEXICAL="$(CDPATH= cd -L -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -L)"
REPO_ROOT_LEXICAL="$(CDPATH= cd -L -- "$SCRIPT_DIR_LEXICAL/.." && pwd -L)"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd -P)"

inside_path() {
  case "$1" in
    "$2" | "$2"/*) return 0 ;;
    *) return 1 ;;
  esac
}

LEXICAL_STATE_DIR="${HOME%/}/.klicker/import-export-backfill/$ENVIRONMENT"
if inside_path "$LEXICAL_STATE_DIR" "$REPO_ROOT_LEXICAL" || \
  inside_path "$LEXICAL_STATE_DIR" "$REPO_ROOT"; then
  echo 'The import/export backfill state directory must be outside the repository.' >&2
  exit 1
fi

HOME_ROOT="$(CDPATH= cd -- "$HOME" && pwd -P)"
STATE_DIR="$HOME_ROOT/.klicker/import-export-backfill/$ENVIRONMENT"
CANONICAL_ANCESTOR="$STATE_DIR"
while [[ ! -e "$CANONICAL_ANCESTOR" && ! -L "$CANONICAL_ANCESTOR" ]]; do
  CANONICAL_ANCESTOR="$(dirname -- "$CANONICAL_ANCESTOR")"
done
if [[ ! -d "$CANONICAL_ANCESTOR" ]]; then
  echo 'The import/export backfill state path is not a directory.' >&2
  exit 1
fi
CANONICAL_ANCESTOR="$(CDPATH= cd -- "$CANONICAL_ANCESTOR" && pwd -P)"
if inside_path "$CANONICAL_ANCESTOR" "$REPO_ROOT"; then
  echo 'The import/export backfill state directory must be outside the repository.' >&2
  exit 1
fi

umask 077
mkdir -p -- "$STATE_DIR"
STATE_DIR="$(CDPATH= cd -- "$STATE_DIR" && pwd -P)"

if inside_path "$STATE_DIR" "$REPO_ROOT"; then
  echo 'The import/export backfill state directory must be outside the repository.' >&2
  exit 1
fi

chmod 700 "$STATE_DIR"
MEDIA_MANIFEST="$STATE_DIR/media-progress.json"
FINGERPRINT_MANIFEST="$STATE_DIR/fingerprint-progress.json"

validate_manifest() {
  local manifest="$1"
  if [[ -e "$manifest" || -L "$manifest" ]]; then
    if [[ -L "$manifest" || ! -f "$manifest" ]]; then
      echo 'A protected backfill manifest is not a regular file.' >&2
      exit 1
    fi
    chmod 600 "$manifest"
  fi
}

run_backfill() {
  local operation="$1"
  local manifest="$2"
  local resume_manifest=''
  local status

  validate_manifest "$manifest"
  if [[ -f "$manifest" ]]; then
    resume_manifest="$manifest"
  fi

  if IMPORT_EXPORT_PROGRESS_MANIFEST_PATH="$manifest" \
    IMPORT_EXPORT_RESUME_MANIFEST_PATH="$resume_manifest" \
    pnpm --silent --filter @klicker-uzh/graphql \
      "script:import-export-$operation:$ENVIRONMENT"; then
    status=0
  else
    status=$?
  fi

  validate_manifest "$manifest"
  if [[ $status -eq 2 ]]; then
    echo "Backfill incomplete. Rerun: ./util/import-export-backfill.sh $ENVIRONMENT" >&2
  fi
  return "$status"
}

cd "$REPO_ROOT"
run_backfill 'media-hash-backfill' "$MEDIA_MANIFEST"
run_backfill 'fingerprint-backfill' "$FINGERPRINT_MANIFEST"
pnpm --silent --filter @klicker-uzh/graphql \
  "script:import-export-backfill-verify:$ENVIRONMENT"
