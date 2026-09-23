---
type: Integration Guide
title: Adaptive Catalyst Integration
description: Build and verify the adaptive feature from a pinned private Catalyst checkout.
---

# Adaptive Catalyst integration

Adaptive learning is owned by `uzh-bf/klicker-uzh-catalyst`. Klicker consumes seven explicitly selected workspace packages through the `external/catalyst` Git submodule. The gitlink pins an exact reviewed commit; no registry release or floating branch resolution is involved.

## Checkout

A developer needs read access to Catalyst, then runs `git submodule update --init external/catalyst` before installing dependencies. Use the repository's Node and pnpm versions. Do not add all Catalyst apps to the Klicker workspace: only the seven `adaptive-*` package paths listed in `pnpm-workspace.yaml` are part of this build.

Public CI needs a dedicated read-only credential for Catalyst. The public repository's `GITHUB_TOKEN` cannot read another private repository. Do not reuse deployment credentials or make the private checkout available to untrusted fork code. The draft integration is not merge-ready until the checkout credential and trusted-branch CI policy are configured. The manual adaptive migration rehearsal expects `CATALYST_READ_TOKEN` in a protected `catalyst-integration` environment; configure required reviewers before adding the token. General build, test, and image workflows still need private-checkout support in their trusted execution envelope. Do not enable credentials in untrusted pull-request jobs.

## Ownership

Catalyst owns the adaptive algorithm, competence-tree and quiz services, GraphQL field/schema factories and operations, database fragments and migrations, seed fixtures, lecturer and student UI, translations, and feature tests. Klicker owns the canonical database/client, authenticated context, shared UI controls, page routes, course/activity lifecycle integration, and worker registration.

The server receives host schema references and element commands through explicit factories. Host GraphQL imports in the server package are type-only. Next transpiles the UI source packages; the GraphQL Rollup build bundles the server source package. Host typechecking must pass: the Rollup TypeScript transform is not a substitute for typechecking.

## Database composition

`packages/prisma/prisma.config.ts` composes the host schema and Catalyst fragments into an ignored sibling `.adaptive-schema` directory. The generator's relative client output remains unchanged. Composition performs no database operation and preserves migration names and SQL bytes. A collision or unknown generated migration fails rather than deleting files.

When creating a new host migration, promote the generated migration directory from the composed output into the host source migrations directory before the next composition. Adaptive-owned migrations belong in Catalyst. Never rename an applied migration while moving it between repositories.

The migration image copies both repositories' schema fragments and migrations into its build context and uses its standalone Prisma configuration. It does not install the workspace or compose files at runtime. Analytics uses the same fragments with its Python generator. Its local `pnpm --filter @klicker-uzh/analytics generate` command composes `prisma/.adaptive-schema` before generating the client; the Docker image instead copies the fragments into its self-contained schema directory.

## Verification

Catalyst standalone checks cover the kernel, simulations, reporting policy, schema composer, and source-package boundaries. Server and UI packages require Klicker's generated client and GraphQL types; a standalone kernel check does not validate those integrations.

Run the repository's guarded disposable-database test workflow for adaptive GraphQL tests. The public test entry points load Catalyst's suites with the existing Klicker fixtures. The three adaptive Playwright entry points likewise load Catalyst-owned scenarios. Run service tests only against an explicitly disposable database.

Host code generation, GraphQL/frontend/seed typechecks, and GraphQL/lecturer/student production builds pass in isolated validation. The 59 migrated UI helper tests and 16 database-guard tests pass. Builds emit bundle/page-size and missing-message warnings. Before merging, still require migration rehearsal, full adaptive service integration tests, and authenticated browser verification of authoring, student attempts/results/retakes, and lecturer evaluation. Existing demo or user data must not be reset for these checks.

The imported source is Klicker commit `493cf936c0225f9a4f3947513ea8943d9bd2863a`; Catalyst records the path-by-path ownership inventory and preserves the AGPL license.
