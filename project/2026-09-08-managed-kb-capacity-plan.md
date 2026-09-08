# Managed knowledge-base capacity

## Approval summary

Support larger managed resource inventories with a global limit of 1,000 resources and a nullable administrator-controlled storage allowance on each KB. Preserve the 500 MiB default, individual 25 MiB source bound, ownership checks and reservation accounting. Aggregate byte metrics must serialize values above 2 GiB accurately in Manage.

The user approved these source changes and native review as part of the managed-resource migration. This slice delivers capacity only. It does not register legacy resources, change retrieval, enable new source types, grant lecturer quota-editing rights or modify a live environment. Source delivery remains a draft until human review and merge approval.

Completion requires focused quota and worker tests, generated schema equivalence, safe byte serialization, package checks and independent source review. A later adoption implementation must establish truthful provenance and lifecycle independently; increased limits do not establish migrated content.

## Execution details

### Contracts and ownership

Main owns the shared capacity policy, GraphQL/worker integration, migration generation, verification and delivery. A native executor supplied the nullable field and shared helper; main completed the connected behavior. The source target is v3-ai, using the existing feat/kb-managed-adoption worktree.

KB.storageLimitMiB is nullable. Null uses 500 MiB. Overrides are positive signed-32-bit integers; conversion to bytes must remain a safe integer. The same resolver drives admission, metrics and worker measured-size reconciliation. Unknown sizes retain conservative reservations. Each source remains independently bounded to 25 MiB.

Five aggregate byte fields become GraphQL Float and reject invalid integer values. Counts and individual resource bytes remain Int. GraphQL clients and the public SDL are generated from the source schema.

Use one generated additive migration and keep the analytics schema mirror equivalent. The standard local create-only command encountered unrelated baseline drift; generate the exact change by comparing baseline and edited Prisma model folders. Never reset retained data or fold unrelated drift into this migration.

### Verification

Extend existing GraphQL integration coverage for scoped allowance, unchanged defaults, reservations above 2 GiB and denial after returning to the default. Check the generated scalar serialization above 2 GiB. Extend worker tests for admission under default and enlarged limits. Reuse existing concurrency and tombstone coverage. Do not pin copy or documentation text.

Run typechecks, schema generation, scoped formatting and repository pre-commit checks. Host-only runtime-policy tests execute on host Node24; container toolchains execute inside the exact disposable task runtime. Native simplification and data-integrity slice review follow the committed change; integrated final review belongs to the completed delivery package.

### Boundaries

Source commits and ordinary draft delivery are approved. Human merge, deployment, live quota changes and data migration remain separate actions. Private cohort manifests and experimental evidence stay outside public Git history. No new dependency or infrastructure ownership is introduced. This reversible capacity field does not require a separate ADR; changed resource provenance/lifecycle would require its own decision record.

## Progress

2026-09-08: native planning review approved the capacity contract and staged adoption investigation. Capacity implementation, generated migration and public SDL are complete locally. Prisma and shared types build; GraphQL and worker typechecks pass. GraphQL integration tests pass65; worker tests pass35. GraphQL tests emit missing-Redis warnings in the minimal profile, so this is contract evidence, not full runtime health. The migration applied only to marked local klicker_test. Host policy checks pass68 tests. The broad check passed 38 of 40 tasks; simultaneous Prisma generation failed on a missing generated model, and the SDL check detected the intended unstaged change. Serialized Prisma build and typechecks subsequently passed. Staging the generated SDL followed by GraphQL generation, schema equivalence and typecheck passed. Source formatting, lint, dependency consistency and Prisma mirror checks pass. Independent source review and visual verification remain pending. No staging or production writes, source publication or merge occurred.
