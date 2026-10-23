# S3-compatible core media storage

## Goal
Allow an OSS deployment to host the public media library on Azure (unchanged default) or an S3-compatible service, using a typed upload capability and official server-only SDK adapters.

## Scope and design
- Domain: lecturer User-owned MediaFile objects; public image URLs embedded in Element content and published snapshots
- Layers: GraphQL service/schema/operation, Manage media library transport/error state, image allow-list, Helm environment, tests and operator documentation
- Auth: retain asUserFullAccess; server generates owner namespace and random object name
- No Prisma migration, gamification or Hatchet changes
- No private KB/Catalyst artifact portability, bucket provisioning, URL rewriting, data migration, merge or deployment
- Separate provider-neutral requestMediaUpload mutation; preserve legacy Azure getFileUploadSas contract
- Existing permanent hrefs stay valid while new uploads use the selected provider
- S3 credentials use the official SDK chain; signed PUT descriptor includes only the object-scoped bearer URL and required headers

## Research and choice
Flydrive has no official Azure driver; unstorage exposes KV operations rather than direct signed browser-upload capabilities; TweedeGolf supports both providers but still exposes provider-specific signing options and its current package pulls all provider SDKs. A narrow application-owned capability adapter is simpler for the actual requirements. Detailed sources and deployment limits belong in docs/media-storage.md.

## Verification
- Pure contract tests: default Azure/legacy SAS, awaited creation, S3 signing/content type/session token, custom endpoint/path-style, stable href, URL/key/config rejection
- Browser transport unit tests: exact PUT body/headers, omitted cookies, errors
- Next image configuration unit tests: exact host/port/path, Azure preservation, invalid config
- GraphQL codegen + schema, package typecheck/build, formatting and CI
- Actual delegated-login browser upload requires a provisioned disposable stack and isolated storage emulator; do not use production credentials or data. Record unavailable evidence explicitly rather than imply a live upload was tested.

## Progress
- 2026-10-14: inspected v3-ai storage flows and official library/provider documentation; approved core-media boundary; implementation in progress

- 2026-10-14: core implementation complete; Azure legacy API and new neutral API separated for rolling deployment; 7 adapter tests, 11 real-schema authorization/persistence tests, 9 browser/image-config tests and 3 Helm render tests pass. GraphQL dependency build/codegen, regenerated public SDL, full GraphQL and Manage typechecks, changed-file formatting/lint and syncpack pass. The independent review findings (literal URL prefixes and legacy SAS wording) are resolved. Dependency lock policy is preserved. Manage production build/bundle inspection and exact-head hosted CI are tracked in the draft PR; real delegated-login browser/provider smoke and the full local service-backed suite remain explicit acceptance gaps.
