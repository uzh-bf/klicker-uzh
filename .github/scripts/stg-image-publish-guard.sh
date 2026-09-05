#!/usr/bin/env bash

set -euo pipefail

: "${IMAGE:?IMAGE must be set}"
: "${SHA:?SHA must be set}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT must be set}"
: "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY must be set}"

ref="${IMAGE}:${SHA}"

set +e
inspect_output="$(docker buildx imagetools inspect "${ref}" 2>&1)"
inspect_status=$?
set -e

if [[ "${inspect_status}" -eq 0 ]]; then
  digest="$(printf '%s\n' "${inspect_output}" | awk '$1 == "Digest:" { print $2; exit }')"
  if [[ ! "${digest}" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    echo "::error::registry returned no canonical digest for ${ref}" >&2
    exit 1
  fi

  printf 'publish=false\n' >>"${GITHUB_OUTPUT}"
  printf 'digest=%s\n' "${digest}" >>"${GITHUB_OUTPUT}"
  {
    printf '### Reused staging image\n\n'
    printf '%s\n\n' "The full-SHA tag \`${ref}\` already exists."
    printf '%s\n' "Registry digest: \`${digest}\`"
  } >>"${GITHUB_STEP_SUMMARY}"
  exit 0
fi

if [[ "${inspect_output}" == "ERROR: ${ref}: not found" ]]; then
  printf 'publish=true\n' >>"${GITHUB_OUTPUT}"
  {
    printf '### Publish staging image\n\n'
    printf '%s\n' "No existing full-SHA tag was found for \`${ref}\`; the build will publish it."
  } >>"${GITHUB_STEP_SUMMARY}"
  exit 0
fi

echo "::error::could not determine whether ${ref} exists; refusing to rebuild an uncertain tag" >&2
printf '%s\n' "${inspect_output}" >&2
exit 1
