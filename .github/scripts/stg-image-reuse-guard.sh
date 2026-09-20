#!/usr/bin/env bash

# Input-fingerprint reuse guard for the staging image publication (R3).
#
# A publication may adopt an image another commit already built and scanned
# only when every build input is identical. The fingerprint of those inputs is
# computed by image-input-fingerprint.cjs and published as a registry tag on
# the digest it built, so the tag itself is the record of "this fingerprint was
# qualifies by this digest". This script only resolves that tag:
#
#   MODE=check  does <image>:fp-<fingerprint> exist, and if so what digest
#   MODE=adopt  publishes that digest under the immutable full-SHA tag
#   MODE=write  publishes the digest under that fingerprint tag after a build
#
# Every reuse-capable publication also writes a reuse record when REUSE_RECORD
# names a path: whether this run adopted an already-qualified digest or built
# one, and under which fingerprint tag. The publication uploads that record next
# to the digest, because the release manifest has to say which targets a release
# adopted instead of rebuilding, and the promoter may not infer that from a
# fingerprint tag a rebuild overwrites with its own digest.
#
# Nothing here decides eligibility; the workflow only calls it for a target the
# trusted inventory marks reusable, and an unresolved registry answer fails the
# step instead of guessing.

set -euo pipefail

: "${MODE:?MODE must be check, adopt or write}"
: "${IMAGE:?IMAGE must be set}"
: "${TAG:?TAG must be the fingerprint tag}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT must be set}"
: "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY must be set}"

reference="${IMAGE}:${TAG}"

# An empty digest is recorded as such: 'adopted=false' means this publication
# built the image itself, and the digest it built reaches the manifest through
# the tag instead.
write_record() {
  local adopted="$1"
  local digest="$2"
  if [[ -z "${REUSE_RECORD:-}" ]]; then
    return 0
  fi
  printf '{"adopted":%s,"digest":"%s","schemaVersion":1,"tag":"%s"}\n' \
    "${adopted}" "${digest}" "${TAG}" >"${REUSE_RECORD}"
}

case "${MODE}" in
  adopt)
    : "${DIGEST:?DIGEST must be set for MODE=adopt}"
    : "${SHA:?SHA must be set for MODE=adopt}"
    if [[ ! "${DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]]; then
      echo "::error::refusing to adopt a non-digest ${DIGEST}" >&2
      exit 1
    fi
    immutable="${IMAGE}:${SHA}"
    docker buildx imagetools create --tag "${immutable}" "${IMAGE}@${DIGEST}"
    readback="$(docker buildx imagetools inspect "${immutable}" 2>&1)"
    observed="$(printf '%s\n' "${readback}" | awk '$1 == "Digest:" { print $2; exit }')"
    if [[ "${observed}" != "${DIGEST}" ]]; then
      echo "::error::${immutable} reads back as ${observed:-nothing} instead of ${DIGEST}" >&2
      exit 1
    fi
    printf 'adopt=true\n' >>"${GITHUB_OUTPUT}"
    write_record true "${DIGEST}"
    {
      printf '### Adopted a qualified image\n\n'
      printf 'Fingerprint tag: `%s`\n\n' "${reference}"
      printf 'Immutable tag: `%s`\n\n' "${immutable}"
      printf '%s\n' 'The inputs are unchanged, so this publication reuses the already-qualified digest and the scan leg re-judges that exact digest.'
    } >>"${GITHUB_STEP_SUMMARY}"
    ;;
  write)
    : "${DIGEST:?DIGEST must be set for MODE=write}"
    if [[ ! "${DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]]; then
      echo "::error::refusing to publish fingerprint tag ${reference} for a non-digest ${DIGEST}" >&2
      exit 1
    fi
    docker buildx imagetools create --tag "${reference}" "${IMAGE}@${DIGEST}"
    write_record false "${DIGEST}"
    {
      printf '### Published input fingerprint\n\n'
      printf 'Tag: `%s`\n\n' "${reference}"
      printf 'Digest: `%s`\n' "${DIGEST}"
    } >>"${GITHUB_STEP_SUMMARY}"
    ;;
  check)
    set +e
    inspect_output="$(docker buildx imagetools inspect "${reference}" 2>&1)"
    inspect_status=$?
    set -e
    if [[ "${inspect_status}" -eq 0 ]]; then
      digest="$(printf '%s\n' "${inspect_output}" | awk '$1 == "Digest:" { print $2; exit }')"
      if [[ ! "${digest}" =~ ^sha256:[0-9a-f]{64}$ ]]; then
        echo "::error::registry returned no canonical digest for ${reference}" >&2
        exit 1
      fi
      printf 'adopt=true\n' >>"${GITHUB_OUTPUT}"
      printf 'digest=%s\n' "${digest}" >>"${GITHUB_OUTPUT}"
      write_record true "${digest}"
      {
        printf '### Adopted a qualified image\n\n'
        printf '%s\n\n' "Fingerprint tag \`${reference}\` already exists."
        printf '%s\n' "Digest: \`${digest}\`"
      } >>"${GITHUB_STEP_SUMMARY}"
      exit 0
    fi
    if [[ "${inspect_output}" == "ERROR: ${reference}: not found" ||
      "${inspect_output}" == "ERROR: failed to solve: ${reference}: not found" ]]; then
      printf 'adopt=false\n' >>"${GITHUB_OUTPUT}"
      write_record false ''
      {
        printf '### Build required\n\n'
        printf '%s\n' "No image is published under \`${reference}\`; the inputs are unchanged but no qualified image exists yet."
      } >>"${GITHUB_STEP_SUMMARY}"
      exit 0
    fi
    echo "::error::could not determine whether ${reference} exists; refusing to rebuild or adopt an uncertain fingerprint" >&2
    printf '%s\n' "${inspect_output}" >&2
    exit 1
    ;;
  *)
    echo "::error::unsupported MODE ${MODE}; expected check, adopt or write" >&2
    exit 1
    ;;
esac
