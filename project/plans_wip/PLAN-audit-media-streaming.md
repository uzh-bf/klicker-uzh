# Bounded audit media-policy enumeration

## Goal and scope

Remove the global reference Map from `activeAssessmentMediaReferences` while
preserving content-address integrity and each assessment scope's retention
horizon. Scope: GraphQL's internal Hatchet service, audit media-policy tests,
and the matching operational documentation. No Prisma schema, GraphQL API,
auth, UI/i18n, scoring, seed, deployment, or retention-calendar change.

## Approach

- Keep the existing keyset pages (100 scopes, 250 baseline events).
- Validate canonical envelopes and blob-name/content-hash binding, then yield
  each reference immediately. Do not keep global deduplication state.
- Repeated references are deliberate: the immutable media store verifies the
  hash and extends monotonically. Each scope retains its own completion anchor;
  an active scope must not lose its rolling horizon to a completed scope.
- Document that renewal counters count references, not unique blobs, and that
  bounded memory trades extra idempotent storage reads for removal of the Map.

## Verification slices

1. Regression tests for first-yield laziness, bounded page queries/cursors,
   duplicates across scopes, per-scope horizons, and malformed evidence.
2. Monotonic policy tests for duplicate references in either horizon order and
   integrity conflicts. Update the DB integration assertion to expect references
   rather than global uniqueness, without weakening its persistence checks.
3. Focused tests, typechecks, format, scoped build, independent review. Do not
   mutate retained databases or claim remote CI without publishing.

## Progress

- Planning: selected direct streaming, no new configuration or schema.
- Implemented direct yielding with stateless content-address validation; updated
  the integration expectation and documented reference-count metrics/read costs.
- Verified: 94 audit tests and 14 focused GraphQL tests pass; audit and GraphQL
  typechecks pass. Independent read-only review found no P1/P2 findings in this fix.
- PostgreSQL integration remains unrun: the existing DB is not disposable. No
  database guard bypass, migration, reset, deployment, or push was performed.
- Scoped build: 12/12 successful (8 cached), with existing GraphQL Rollup warnings.
  Source formatting and diff whitespace checks pass; generated files are unchanged.
- After approval, provisioned new marked `klicker_test`/`klicker_test_shadow`
  databases using the repository bootstrap helper. Retained DB untouched.
- Schema push alone reproduced two missing-CHECK failures. Full guarded migration
  replay corrected the setup: audit 106/106, GraphQL audit 23/23, response processor
  integration 26/26 passed. No seed or external service was needed.
