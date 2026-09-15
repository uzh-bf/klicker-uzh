# Audit media MIME compatibility

## Goal

Allow assessment audit capture of existing images served as
`application/octet-stream` only when file-signature detection matches the
`MediaFile.type` referenced by the assessment's ElementInstance snapshot.

## Scope and non-goals

- Only `packages/audit` capture, its dependency, tests, and documentation.
- Keep the streamed original bytes and existing hash/length/immutability checks.
- Keep the version-1 evidence contract unchanged: `mimeType` remains the matched
  image type. Separate source-type provenance requires a versioned follow-up.
- No upload/rendering changes, database migration, auth changes, scoring,
  gamification, frontend/i18n, Hatchet scheduling, cloud or Argo CD changes.
- Exact MIME matches retain existing behavior. Concrete mismatches, unknown
  signatures, and generic non-image files remain rejected. Signature detection
  is not full decoding or a security scan.

## Verification and delivery

1. Add a failing capture regression using synthetic image bytes.
2. Add bounded-memory file detection before immutable persistence.
   Verify rejection and temporary-file cleanup.
3. Run focused tests, audit typecheck/build and runtime import, then independent
   review. No new seeds or environment startup needed.
4. Draft PR to `v3-audit`; no deployment. Staging image-baseline, submission and
   owner-export verification remains required after deployment.

## Progress

- Confirmed source download succeeds after the separate manual Azure RBAC fix;
  source metadata is generic while the database declares JPEG.
- Regression failed before the fix with `Klicker media MIME type changed during
  capture`; final focused suite: 27 passed. Full audit suite: 103 passed, 12
  skipped because two integration suites refused the unverified disposable DB.
- Audit typecheck/build passed. Repository check/build attempted but not green
  (check-format/GraphQL and Chat build failures); standalone GraphQL TypeScript
  check passed after builds refreshed artifacts. No guard bypass or DB reset.
- Independent review identified the v1 compatibility risk of a provenance field;
  removed that schema change. Final review reports no P1/P2 findings.
- No cloud, Argo CD, source-media, database, frontend or deployment changes.
