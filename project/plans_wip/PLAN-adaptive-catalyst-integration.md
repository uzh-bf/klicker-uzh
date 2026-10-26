# Consume adaptive learning from Catalyst

## Scope

Move the complete adaptive product from source commit `493cf936c0225f9a4f3947513ea8943d9bd2863a` into four native draft stack layers in Catalyst, then consume seven pinned workspace packages in one public integration draft targeting `v3`. Preserve existing competence, calibration, attempt, result and reporting behavior. Preserve current host authorization, queued course deletion, transaction reuse, wizard recovery and embedded student navigation.

## Ownership

Catalyst owns the algorithm, persistence fragments and migrations, services and schema factories, operations, lecturer/student components, translations, fixtures and feature tests. Klicker retains canonical database generation, authentication and permission enforcement, routes, shared controls, mixed core model relations, activity lifecycle and worker registration. No registry release, deployment, merge or old-PR closure is in scope.

## Verification and delivery

1. Compose schemas without changing migration SQL; exercise collision and ownership guards.
2. Run standalone algorithm, reporting and package-boundary checks in Catalyst.
3. Install the consuming workspace, regenerate Prisma and GraphQL, check and build affected packages.
4. Review reconciled host behavior against both source feature and current `v3`.
5. Verify disposable-database migration/service tests and browser flows where the isolated environment permits. Record unavailable checks explicitly.
6. Inspect staged source for credentials and personal data, publish the four draft layers, pin their final commit, and open one public integration draft.

## Verification and remaining prerequisites

Frozen dependency installation, Prisma/GraphQL code generation, the GraphQL
bundle, both frontend production builds, GraphQL/frontend/seed typechecks,
59 UI helper tests and 16 database-guard unit tests pass in an isolated Node 24
container. Both Prisma schema directories remain synchronized. Initial
resolution attempts exited 137; the updated workspace importers reuse existing
lockfile package resolutions and pass pnpm frozen validation and installation.

The Catalyst dedicated adaptive-package CI passed before the final type-only
host compatibility fixes. Its migration plan records the standalone kernel,
simulation, reporting and composer results. The source migration inventory
accounts for all 463 source paths.

Database migration rehearsal, full adaptive service integration tests, and
authenticated browser checks have not run. Frontend production builds emit
bundle/page-size and missing-message warnings. Public CI requires an
appropriately scoped Catalyst read credential and a trusted execution policy;
the ordinary public repository token cannot initialize this private submodule.
The PRs remain drafts and are not declared merge-ready. The original demo
checkout and data remain unchanged.
