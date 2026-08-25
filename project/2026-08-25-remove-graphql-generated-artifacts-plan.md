# Remove conflict-prone GraphQL build outputs

## Research

- `Problem:` Generated GraphQL outputs are tracked alongside handwritten schema and operation sources, causing repeated merge conflicts.
- `Evidence:` `packages/graphql/codegen.ts` generates `ops.ts`, `ops.schema.json`, `public/schema.graphql`, `public/client.json`, and `public/server.json`. The package build runs codegen before Rollup, and Rollup copies `public/*` into `dist`.
- `Evidence:` Frontends consume `@klicker-uzh/graphql/dist/client.json`; the backend consumes `@klicker-uzh/graphql/dist/server.json`. The four runtime/build outputs do not need Git history for image correctness.
- `Evidence:` `ops.schema.json` has no repository consumer. `public/schema.graphql` is the reviewable SDL snapshot and is consumed by GraphQL tooling, so it remains tracked for now.
- `Decision:` Remove and ignore `ops.ts`, `ops.schema.json`, `public/client.json`, and `public/server.json`. Keep `public/schema.graphql` tracked until CI can provide equivalent schema-diff review and tooling input.
- `Risk:` Ignored persisted-query maps remain runtime-critical. Every GraphQL package build must generate them before consumers build.

## Authority

- `Granted:` Create a repo-local worktree and branch, edit the in-scope source, documentation, skills, ignore rules, and lockfile, run repository-native local checks, and create local conventional commits.
- `Withheld:` Push, open or update a PR, merge, deploy, publish, delete the worktree or branch, and change cluster or external service state.
- `Boundary owner:` self.

## Delegation Map

- `S1 — build ownership and tracked outputs:` `main`; no dependency. Acceptance: a clean package check and build regenerate the four ignored outputs, omit `ops.schema.json`, and leave the tracked schema unchanged.
- `S2 — repository guidance:` `main`; depends on S1. Acceptance: authoritative docs, AGENTS.md, and relevant skills no longer instruct contributors to commit ignored outputs and describe the persisted-map contract accurately.
- `S3 — integrated verification:` `main`; depends on S1 and S2. Acceptance: focused GraphQL checks, formatting, wiki validation, and diff hygiene pass; CI/image build paths remain source-complete.
- `Execution-tier skip reason:` The slices are tightly coupled through codegen, package scripts, tracked schema behavior, and documentation policy; delegation would cost more than direct integration.

## Implementation

### S1 — Move build outputs out of Git

- `Do:` Add exact ignore rules for the four non-reviewable GraphQL outputs.
- `Do:` Remove the four tracked outputs from the branch.
- `Do:` Stop generating the unused `ops.schema.json` output and remove its dedicated codegen dependency.
- `Do:` Make the GraphQL package check run codegen first, then fail when generation changes the tracked schema snapshot before running TypeScript.
- `Do:` Make direct GraphQL package tests run codegen first so they also work from a clean checkout.
- `Check:` Run direct GraphQL check and build from the output-absent state. Inspect `dist/ops.js`, `dist/client.json`, `dist/server.json`, and `dist/schema.graphql`; confirm no `ops.schema.json` is produced.
- `Commit:` `refactor(graphql): build generated client artifacts`

### S2 — Align guidance and tooling

- `Do:` Update `AGENTS.md`, the GraphQL architecture/API/feature pages, and the environment/testing/GraphQL skills to distinguish tracked sources and generated build outputs.
- `Do:` Correct the GraphQL Inspector schema path to the tracked public schema snapshot.
- `Do:` Preserve the rule that operation documents and schema changes require codegen, while generated client/server maps are not committed.
- `Check:` Search authoritative docs and skills for obsolete instructions to commit all GraphQL outputs; run the wiki validator and format checks.
- `Commit:` `docs(graphql): document generated artifact ownership`

### S3 — Finish integrated verification

- `Do:` Re-run focused checks after documentation integration and inspect the complete diff for scope, secret, and personal-data hygiene.
- `Check:` Run GraphQL check/build, relevant formatting and wiki validation, and `git diff --check`. Record any container-only or full-root checks that remain unrun.
- `Terminal:` Local branch contains the approved source, build, and guidance changes with verified focused checks. Delivery remains pending until separately authorized.

## Progress

- `Conflict repair:` Merging the current `v3` produced three modify/delete conflicts in generated artifacts. Keep `ops.ts`, `public/client.json`, and `public/server.json` deleted; the merged `QUserProfile.graphql` source regenerates them.
- `Discovered gap:` The package build, check, CI test, and image paths already generate the artifacts, but direct `test` and `test:watch` package commands did not. Add package lifecycle generation barriers and validate tests from an output-absent state.
- `Verification:` From an output-absent checkout, direct test and watch setup, package check/build, and the exact `build:test` path regenerate the required files. Tracked-only backend and manage image builds contain the generated server and client maps in their final package outputs.
- `Review disposition:` A reported `build:test` ordering failure did not reproduce: the exact command succeeds because its nested package build generates before Rollup. Keep that pre-existing script unchanged and add only the missing direct test lifecycle barriers.
- `Delivery:` Branch update, merge, and deployment remain pending until verification and the applicable authority gates complete.
