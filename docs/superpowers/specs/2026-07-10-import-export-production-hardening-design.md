# Import/export production hardening design

## Status

Approved on 2026-07-10 for implementation on the existing import/export feature
branch. The implementation will use a safety-first hybrid: production controls and
correctness first, with focused decomposition as each behavior is changed.

## Goal

Make element package import/export safe for production while preserving didactic
content and scoring behavior, keeping imports private and reviewable, and providing
an executable deployment and rollback path.

## Non-goals

- Do not transfer tags. Tags are owner-local and are excluded from the package
  contract, previews, imports, exports, and duplicate fingerprints.
- Do not transfer participant responses, activity instances, analytics, grading
  history, item statistics, difficulty, discrimination, reliability, validity, or
  calibration data.
- Do not preserve source element IDs, database IDs, ownership, permissions,
  sharing state, or source status.
- Do not fetch arbitrary external media on the server.
- Do not build a general remote-media ingestion or sanitization service.
- Do not make duplicate warnings block an import.
- Do not add a new runtime dependency unless an existing platform primitive cannot
  satisfy a verified requirement.
- Do not promise compatibility with pre-release version 3 packages. Version 3 is
  frozen only after this hardening work is complete.
- Do not change intended XP, points, or leaderboard policy. Calculation fixes only
  restore valid grading behavior.

## Domain vocabulary

- **Element**: the private authored source resource, not an `ElementInstance`
  published into an activity.
- **Answer collection**: an owner-scoped reusable set of entries used by selection
  and case-study elements.
- **Package**: a strict ZIP archive containing a manifest, element payloads,
  required answer collections, and eligible first-party media.
- **Didactic payload**: student-visible content plus explanations, solutions,
  feedback, scoring settings, normalized answer pools, and eligible media identity.
- **Didactic fingerprint**: a versioned SHA-256 hash of the normalized didactic
  payload. It excludes names, status, tags, owners, permissions, IDs, timestamps,
  and answer-collection history.
- **First-party media**: media whose origin and `MediaFile` record are verified
  against the configured Klicker storage account.
- **External media**: media that would load automatically from any other origin.
- **Import receipt**: the durable idempotency record that consumes a validation
  token and records the selected package refs and created resource IDs.
- **Staged media record**: an explicit record of an import-owned blob that may need
  cleanup if the import does not commit.

## Product and authorization decisions

- All GraphQL operations continue to require an authenticated full-access `User`.
- Import creates new private resources owned by the importing user.
- Imported elements always enter `REVIEW` regardless of source status.
- Export requires `ADMIN` or `OWNER` on every selected element and each required
  answer collection. `WRITE` alone does not authorize portable redistribution of
  questions, solutions, or media.
- Missing and unauthorized objects remain indistinguishable to callers.
- Export UI copy reminds authors that packages contain solutions and may contain
  copyrighted material; authorization in Klicker is not a licensing grant.
- Duplicate detection is owner-scoped and advisory. It is never an authorization
  or automatic-reuse decision.
- Import/export is described as content portability, not psychometric item-bank
  interchange. Imported items are uncalibrated copies requiring lecturer review.

## Package contract

Version 3 remains the current package version, but its pre-release schema is
tightened before it is declared stable.

### Structural rules

- A package contains at least one and at most 100 elements.
- A package contains at most 50 answer collections, 100 media files, 5,000 answer
  entries in total, and 2,000 entries in any one collection.
- The package is at most 10 MiB; each bundled media file is at most 5 MiB.
- Every manifest warning is a member of a bounded server-defined enum. Warning
  codes are deduplicated and limited to 200 entries per package.
- Package refs reject JavaScript-reserved keys such as `__proto__`, `prototype`,
  and `constructor`.
- Every package-media URL must refer to exactly one declared manifest entry, and
  every declared media entry must be used or explicitly reported as unused.
- Source answer-collection version is not part of the portable contract. Every
  imported collection begins at version 1.
- Type-inapplicable answer-collection fields are rejected rather than ignored.
- ZIP paths are canonical, relative, unique, and declared. Data-descriptor ZIP
  entries remain unsupported and are rejected consistently by code and docs.

### Per-element option rules

The raw `options: record<unknown>` trust boundary is replaced by a discriminated
schema for each of the nine element types. Canonical option invariants and shared
domain constants live in a neutral element-domain module. Normal authoring and the
package contract both depend on that module; the general domain layer never imports
from import/export code.

- Selection input counts are positive integers within the available pool.
- Choice indices and solution refs are unique, non-negative integers and reference
  existing choices or entries.
- Single-choice packages contain exactly one correct choice, multiple-choice
  packages contain at least one correct choice, and KPRIM packages contain exactly
  four choices while preserving KPRIM scoring semantics.
- Numerical solutions validate every exact value and range, require finite numbers,
  enforce ordered bounds, and remain within configured restrictions.
- Free-text solutions validate every string, reject empty normalized solutions,
  and require a positive integer maximum length when that restriction is present.
- Case-study criteria have unique non-reserved IDs, finite ordered bounds, positive
  steps, and valid solution ranges. Every selected case item has exactly one
  solution for every criterion.
- All normalized grading results must be finite and within `[0, 1]`.

Export validates the canonical payload before creating a package. A legacy element
that the current importer cannot accept is reported as non-portable during export
preview rather than producing a package that fails re-import.

## Service architecture

The existing GraphQL schema remains stable where possible. The large service is
split behind a thin facade into focused modules:

- **element domain**: canonical per-type option normalization/invariants and shared
  scoring constants used by normal authoring and package validation.
- **contract**: package schemas, version, limits, ref validation, warning/error
  enums, and calls into the neutral element-domain invariants.
- **archive**: bounded ZIP creation/parsing, path validation, and declared-file
  accounting.
- **fingerprints**: pure canonicalization and hashing over database/package values.
- **preview**: permission checks, bounded metadata lookup, package summaries,
  external-media warnings, and duplicate lookup.
- **export**: portable-source validation, media selection, package assembly,
  storage, and download metadata.
- **import**: token validation, selected dependency resolution, media staging,
  idempotent transaction, and result mapping.
- **cleanup**: deletion driven only by explicit media-staging and package-artifact
  records.
- **facade**: the current public service functions used by GraphQL resolvers.

Shared canonicalization and media-URL traversal utilities have one implementation.
Filename sanitization and error classification are likewise centralized. Tests are
split by module instead of growing the existing monolithic test files.

## Export flow

1. Check the backend feature gate, full-access user scope, and `ADMIN`/`OWNER`
   permission for all selected elements and required answer collections.
2. Load the complete authored payload in bounded database queries.
3. Validate every source element through the same per-type package invariants used
   by import.
4. Perform one bounded media metadata pass per operation and share it between
   warnings and size estimation. Final export revalidates current state rather than
   trusting stale preview data; preview is rate- and concurrency-limited.
5. Bundle only verified first-party media with supported content types and known
   size/hash. SVG remains unsupported until a sanitizer exists.
6. Report inaccessible, unsupported, or external media without making a browser or
   server request to that origin.
7. Build and revalidate the strict archive, enforce the exact final byte cap, and
   upload it to private package storage.
8. Return a short-lived read-only SAS URL. Blob metadata and the browser request use
   `Cache-Control: private, no-store`.

Export links are keyed by the complete export revision, not merely element ID and
version, so status or other transferable changes cannot reuse stale packages.

## Upload and validation flow

Import packages are uploaded through an authenticated backend streaming endpoint,
not a write SAS. A prepare mutation creates a caller-owned package-artifact record
and returns a short-lived, single-purpose upload capability bound to that artifact,
user, expiry, and byte limit. The endpoint:

- verifies the upload capability and the same full-access user identity as GraphQL;
- accepts only the configured manage origins and `application/zip`, without relying
  on ambient cookies as the sole CSRF defense;
- applies the upload rate limit before accepting bytes;
- aborts the stream after 10 MiB plus protocol overhead;
- writes only to the artifact's private package target;
- deletes partial or oversized blobs;
- records the final size and SHA-256 on the artifact;
- returns an artifact identifier, never a storage credential.

Validation resolves the caller-owned artifact, re-downloads the bounded package
from trusted package storage, verifies its recorded SHA-256, parses the strict ZIP,
validates every schema and cross-reference, and returns a preview plus a signed
token. The token contains the user ID, artifact ID, package hash, expiry, and a
cryptographically random `jti`.

Development/test local storage canonicalizes paths before enforcing the owner
prefix and uses the same signed capability checks. Local package routes are never
unauthenticated path capabilities, and local storage remains disabled in production.

Preview rendering never loads external media. Auto-loading external media is shown
as a blocked placeholder with an omission warning. Ordinary user-activated links
remain text/links and are not fetched during preview.

## Import and idempotency flow

1. Check the feature gate and full-access user scope.
2. Verify token signature, user, artifact, package hash, and normalized selected
   refs. A valid signature and matching owner are checked even when the token is
   expired so completed retries can be recovered safely.
3. Reject an empty selection and derive only the answer collections required by
   selected elements.
4. Compute the selection digest and resolve the receipt by unique `jti`:
   - return a `COMPLETE` receipt for the same owner, package hash, and selection
     digest even if the token has since expired;
   - reject any receipt whose owner, package hash, or selection digest differs;
   - return `IMPORT_IN_PROGRESS` for an actively leased `PENDING` receipt;
   - require an unexpired token before inserting a new `PENDING` receipt or claiming
     an expired lease for safe recovery.
5. For new or recoverable work, revalidate the package and enforce total write
   budgets without creating storage or domain side effects.
6. Reserve or claim the `PENDING` receipt and operation lease before any media copy.
   Only the lease owner may stage blobs or start the domain transaction. A recovered
   lease first reconciles/deletes staging records left by the prior attempt.
7. Create explicit staging rows before copying each eligible media blob to its final
   importer-owned location. Imported package media carries its verified SHA-256.
8. Start one bounded database transaction and condition it on the owned receipt
   lease.
9. Create required answer collections and map returned entries by their unique
   values or explicit stable refs, never by insertion order.
10. Create selected elements with new IDs, private ownership, `REVIEW` status, no
    tags, normalized options, and resolved media/collection refs.
11. Transition the receipt to `COMPLETE`, store created IDs, and finalize
    staged-media records in the same transaction.
12. After commit, refresh the element list. A refresh failure is reported as a
    warning after successful import and cannot make the import retryable.

If the transaction fails, known final blobs are deleted best-effort. A scheduled
cleanup queries stale staging rows and deletes only their exact blob targets. It
never enumerates unrelated storage containers.

Package artifacts expire after 24 hours. Each user may have at most 10 unexpired
package artifacts and 100 MiB of unexpired package bytes across imports and exports.
The prepare/export operation rejects work that would exceed either quota. Cleanup
runs hourly, and an externally configured Azure lifecycle rule removes package-
container blobs after 48 hours as defense in depth. Partial and oversized uploads
are removed during the failed request; valid abandoned artifacts are bounded by the
quota and cleanup SLA. Application cleanup remains authoritative and record-scoped.

External auto-loading media URLs are removed during canonical import and replaced
with a non-loading omission marker. The preview lists every affected element before
confirmation.

## Fingerprints and asynchronous work

Fingerprint algorithm version is persisted alongside each fingerprint. Version 1
is assigned only after the final canonical semantics below are implemented.

The element didactic fingerprint includes:

- type, student-visible content, explanation, normalized options, feedback,
  solutions, base-point setting, and points multiplier;
- normalized answer-pool values and selected solution values;
- verified bundled-media SHA-256 identities.

It excludes name, source/import status, tags, owner, permissions, package refs,
database IDs, timestamps, filenames, collection name/description/version, and
storage URLs.

Media SHA-256 is stored once on `MediaFile`. Import can populate it from the verified
manifest. Existing media receives hashes through a bounded Hatchet backfill. No
request-time path downloads media to calculate a fingerprint. If a referenced
first-party media record lacks a hash, the element fingerprint and its version stay
null until backfill completes; duplicate detection may omit that warning and never
falls back to live network-dependent identity.

Package preview computes duplicate identity from the canonical as-imported payload,
including external-media omission, `REVIEW` normalization, and the absence of tags.
The stored row and the package therefore use the same didactic representation.

An individual element mutation can recompute its DB-only fingerprint synchronously
after the authored write. Before an answer-collection transaction commits, one
database update marks all linked element fingerprints/version fields null. The
service then enqueues bounded post-commit refresh work. If enqueue or Hatchet fails,
the persisted dirty marker remains eligible for the resumable backfill. Storage or
Hatchet failure cannot roll back or misreport a successful authoring mutation.

Backfill jobs select null or mismatched fingerprint versions, process bounded
chunks, are idempotent, expose progress/failure metrics, and can resume safely.
There is no lazy request-time backfill.

## Data model changes

- Add `importFingerprintVersion` alongside the nullable fingerprint on `Element`
  and `AnswerCollection`; index owner, version, and fingerprint for lookup.
- Add nullable `contentHash` to `MediaFile` and index it only if query evidence
  requires the index.
- Add `ElementImportReceipt` with unique `jti`, owner, package hash, selection
  digest, `PENDING`/`COMPLETE` state, operation lease/expiry, created result IDs,
  and timestamps. Completed receipts are retained for 30 days.
- Add a package-artifact model for caller-owned import uploads and generated exports,
  including exact storage target, direction, state, size/hash, and expiry.
- Add an import-media staging model containing operation/token ID, owner, exact
  container/blob target, content hash, state, and expiry.

The migration remains additive and nullable so application rollback is safe. A new
additive migration is created by default; the existing branch migration is amended
only after verifying it is absent from every environment's Prisma migration table.
The migration is deployed before code begins reading the new fields. Index creation
is chosen based on staging table sizes; large production indexes use a non-blocking
operational migration rather than an unqualified blocking `CREATE INDEX`.

## Error contract and observability

All import/export failures expose stable server-defined codes with localized EN/DE
messages and one recovery action. Raw Apollo, Azure, Prisma, Redis, or ZIP messages
are never displayed to users.

Separate codes cover permission, feature disabled, rate limit, rate-limit backend
unavailable, upload too large, package missing/expired, malformed archive, unsupported
version, invalid element options, unsafe refs, total resource limit, media omission,
token expiry/replay, and infrastructure failure.

Structured metrics/logs include operation, user-safe correlation ID, package counts
and bytes, duration, result/error code, retry/replay outcome, staged-media cleanup,
and fingerprint-backfill progress. They exclude authored content, solutions, URLs,
filenames, tag names, and participant data.

## Frontend interaction design

The workflow uses an explicit state machine:

`idle -> uploading -> validating -> reviewing -> importing -> success | error`

- Upload and validation are cancellable and guarded by request generation so stale
  responses cannot replace newer state.
- The dropzone is disabled outside `idle`/recoverable `error` states and reports
  rejected files through `onDropRejected`.
- Final import is non-dismissible once submitted because no server cancellation
  contract exists.
- Mutation success is final. A subsequent list-refresh failure produces a warning,
  closes/locks the import, and cannot offer a duplicate retry.
- Review summaries update from selected elements and show only their required answer
  collections.
- Bulk controls provide select all, select none, and exclude advisory duplicates.
- The review exposes correct answers, ranges, criteria, feedback, base points,
  multiplier, answer-pool contents, media omissions, and the uncalibrated-copy
  consequence.
- Packages at maximum supported cardinality render one responsive list rather than
  duplicate mobile/desktop trees.
- The upload control, row switches, preview buttons, progress messages, and modal
  focus behavior have explicit accessible names and live status.
- Status badges meet WCAG AA contrast and do not use hover affordances when inert.
- The toolbar wraps/stacks at 320 px and 375 px in EN and DE.
- Terminology is consistently “Import elements” and “Export selected elements.”
- EN/DE strings use native orthography, ICU pluralization, and actionable errors.

## Feature gates and configuration

- `IMPORT_EXPORT_ENABLED` is the backend master gate for upload, preview, export,
  validation, and import. It defaults to false in production.
- `IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY` defaults to true in staging/production. When
  enabled, access additionally requires the existing `User.privatePreview` flag;
  setting it false after the canary opens the feature to all eligible lecturers.
- An authenticated GraphQL capability field returns whether the current user may
  use import/export. The frontend renders entry points from that runtime capability;
  it does not use a compile-time `NEXT_PUBLIC` flag. Backend checks remain
  authoritative on every operation.
- The backend names are listed in `turbo.json` and provided by v2/v3 Helm
  configuration.
- `IMPORT_EXPORT_TOKEN_SECRET` is provisioned to every backend/assessment process
  that can validate tokens.
- Azure package/media configuration is provisioned to the backend and general
  worker that performs backfill/cleanup.
- Cleanup of already-staged/package data remains active when user-facing operations
  are disabled. Startup requires package/token configuration only when user-facing
  operations or maintenance work requiring that configuration is enabled.
- Default per-user limits use a 15-minute window: 30 export previews/exports, 30
  uploads, 30 validations, and 5 imports. Operators may lower these values; raising
  them requires a measured staging load test.
- The assessment backend keeps import/export disabled because this is a lecturer
  authoring feature. Token/storage configuration is not required by a process whose
  user-facing and maintenance responsibilities are both disabled.
- Secret rotation restarts every process that consumes the rotated import/export
  secret. Immutable production image tags use `IfNotPresent`; mutable staging tags
  may continue to use `Always`.
- The committed Helm templates and external v3 secret contract are rendered and
  asserted in CI.

## Layer footprint

- Prisma schema, migration, generated client, analytics schema sync where required.
- `packages/grading` numerical calculation and invariant tests.
- `packages/graphql` schemas, services, upload route support, GraphQL operations,
  scripts, generated schema/ops, unit and DB-backed tests.
- `packages/hatchet` and the general worker for bounded backfill and cleanup tasks.
- `apps/backend-docker` for authenticated capped upload routing and startup checks.
- `apps/frontend-manage` for gates, state machine, review UI, accessibility, and
  browser behavior.
- `packages/i18n` for paired EN/DE copy.
- v2/v3 Helm, `turbo.json`, CI/preflight/backfill scripts, and operational config.
- Playwright fixtures/specs, with a dedicated import/export spec instead of further
  growing the general element-operations file.
- Engineering wiki pages for package behavior, domain/migrations, GraphQL/auth,
  async workers, frontend conventions, testing, and deployment.

## Verification design

### Pure logic

- Per-type valid/invalid option matrices for all nine element types.
- Property/boundary tests proving grading fractions are finite and in `[0, 1]`.
- Numerical lower/upper zero, negative zero, one-sided, exact/range, and restriction
  tests.
- Case-study duplicate/missing/reordered/reserved-ID and slider-boundary tests.
- Canonical fingerprint determinism and algorithm-version fixtures.
- ZIP path, flag, CRC, declared/actual size, file-count, warning/ref, and fuzz cases.

### GraphQL and database

- Export-import-export normalized equivalence for all nine element types.
- Representative grading equivalence before and after each round trip.
- Stable answer-entry remapping with deliberately shuffled database return order.
- Permission matrix for element and answer-collection ownership/ADMIN/WRITE.
- Concurrent and sequential token replay, lost-response retry, changed-selection
  replay, and receipt rollback.
- Maximum 5,000-entry package timing, transaction, WAL, and rollback behavior in a
  production-like database.
- Media staging cleanup after validation, transaction, and process-failure points.
- Zero Azure calls while an authoring transaction is open.
- Slow/failing Azure and high-fan-out answer-collection refresh behavior.

### Browser and end-to-end

- Happy-path export/import and private-copy isolation.
- Every element family, shared dependencies, duplicate warnings, selected subsets,
  external/unsupported media, and collection contents beyond the summary limit.
- Delayed upload/validation/import, concurrent file attempts, cancellation, token
  expiry, rate limiting, committed import plus failed refresh, and invalid drops.
- Keyboard-only flow, named switches/buttons, modal focus entry/return, live status,
  axe, and contrast.
- EN/DE at desktop, 375 px, and 320 px with 0/1/many plural forms.
- Maximum-cardinality review with bulk selection and acceptable render latency.

### Release evidence

- `pnpm run check:all`
- `pnpm run build`
- GraphQL generation with a clean generated-artifact diff
- `pnpm --filter @klicker-uzh/grading test`
- `pnpm --filter @klicker-uzh/graphql test:local`
- targeted Playwright import/export spec against a real seeded local stack
- `opengrep scan --config auto`
- rendered v2/v3 Helm assertions
- browser screenshots for EN/DE desktop/mobile review, loading, error, and success
  states

## Deployment and rollback

Before deployment, operators confirm external facts that this repository cannot
prove: whether the existing branch migration reached any environment, the contents
of externally provisioned v3 secrets, Azure CORS/lifecycle/private-container policy,
the Hatchet workflow allowlist, the owner and command path for `prisma migrate
deploy`, and the external log/metric platform used for the soak. The runbook names
an owner and captures evidence for each item.

1. Deploy the additive migration and required secrets/configuration with both feature
   gates disabled.
2. Deploy backend, workers, and frontend with the gates still disabled.
3. With the master gate disabled, run the committed infrastructure preflight. It
   verifies schema, secrets, storage read/write/delete, SAS download, cache/CORS,
   Redis, Hatchet registration, and cleanup without invoking user operations.
4. Run media-hash and fingerprint-version backfills. Verify expected counts, no
   request-time backfill, and zero stale versions.
5. Enable the master gate in private-preview-only mode and mark the named staging
   lecturers with the existing `User.privatePreview` flag. Run the authenticated
   round-trip canary covering capped upload, validation, import, export, download,
   and cleanup, then complete browser evidence.
6. Soak while monitoring scoring mismatches, replay attempts, duplicate-on-retry,
   transaction latency, database/WAL growth, Azure ingress/storage, preview rate
   limits, backfill failures, and cleanup deletions.
7. Enable named production private-preview users for a seven-day canary, then set
   private-preview-only to false for general availability only after the exit
   criteria below remain satisfied. The staging soak lasts at least 48 hours.

Rollback sets the backend master gate to false. The runtime capability hides the UI
without a frontend rebuild, and every backend operation fails closed. The additive
schema remains compatible with the previous application. No backfill deletes source
content, and package cleanup is independent of authored resources.

## Production exit criteria

- No unresolved P1, P2, or P3 finding from the import/export review unless the
  approved non-goals above explicitly exclude it.
- All release-evidence commands are green.
- All nine element types demonstrate normalized payload and grading equivalence.
- No import can produce a non-finite or out-of-range score.
- No storage call occurs inside an authoring database transaction.
- Identical import retries create exactly one resource set and return one result.
- Partial and oversized uploads are deleted during the failed request. Valid
  abandoned artifacts stay within the 10-artifact/100-MiB per-user quota and no
  artifact remains past its 24-hour TTL plus two cleanup intervals.
- Cleanup can delete only blobs named by feature-owned staging/package records.
- The deployment preflight and backfill commands exist, are documented, and have
  completed successfully in staging and production canary environments.
- EN/DE desktop/mobile keyboard and accessibility evidence is attached to the final
  branch/PR review.
- A final thermo-nuclear maintainability review has no unresolved blocker; deferred
  lower-severity findings have explicit rationale.

## Implementation sequence

1. Restore a green baseline and add fail-closed feature gates.
2. Extract and harden the package contract; fix grading invariants.
3. Add data-model support and stable answer-entry mapping.
4. Extract pure fingerprints and remove live storage work from authored writes.
5. Add bounded asynchronous backfill and explicit staging cleanup.
6. Add capped authenticated upload, idempotent receipts, resource budgets, and
   stable errors.
7. Harden archive/media behavior, caching, preview throttling, and external-media
   handling.
8. Rebuild the frontend workflow, review surface, accessibility, responsive layout,
   and localization.
9. Complete Helm/config/scripts/wiki updates.
10. Run the full verification matrix, independent final review, staging soak, and
    production canary gate.
