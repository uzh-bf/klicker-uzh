# Repair request parser and schema validation dependencies

## Approval summary

Prepare one draft against `v3-ai` that removes the reported vulnerable body-parser and Zod versions from application images. Preserve request validation, GraphQL schema, authorization, MCP tool contracts and Hatchet workflow behavior. Update body-parser within each existing major, migrate direct Zod consumers from 3 to 4.6.6, and update only the same-major integration dependencies necessary for Zod 4. Do not force a Zod 4 implementation into a dependency that only supports Zod 3.

The human approved this executable draft-preparation batch on 24 October 2026. Local commits, ordinary task-branch push and one draft PR are authorized. Ready, merge, rollout, Sonar dispositions, credentials and application model calls are outside this source package. The separately approved exact Sonar issue dispositions have their own private receipt and browser owner.

Completion requires a reviewed coherent draft, native lockfile/install/check/build evidence and behavior tests. Any unavailable browser or image proof remains explicitly pending. No deployment or production-readiness claim follows from draft delivery.

## Execution details

Baseline `b865fad566065ef36902282118f2552aebb62472`, target `v3-ai`, branch `fix/parser-zod-security`, worktree `trees/dependency-parser-zod-repair`. Execution mode: standard, full path. Primary checkout is preserved. Artifacts use the existing `project/` root. Main owns dependencies, integration, effects and final proof. One read-only explorer maps source migration seams; planner hardens this plan before implementation. Settled source edits may be delegated with disjoint ownership.

### Evidence and contracts

Official Zod migration guide: https://zod.dev/v4/changelog . Security references: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 and https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828 . Pothos integration: https://pothos-graphql.dev/docs/plugins/zod . Registry metadata was checked on 24 October 2026.

Targets: body-parser 1.20.9 and 2.4.0, Zod 4.6.6, Pothos plugin-zod 4.3.2. Hatchet 1.22.0 is the first existing-major SDK release declaring Zod 4 support and avoids the additional optional integration peers of later versions. MCP 1.32.0 already declares Zod 4 compatibility and stays pinned unless a demonstrated defect requires its patch. Align every direct Hatchet consumer and peer floor if that update is necessary. Existing SDK majors, Node 24.21.0, pnpm 12.11.2, public schemas, migration files and canonical hash protocol remain preserved.

Retain the 14-day strict supply-chain policy. Add only reviewed exact-version release-age exceptions necessary for named fixes. Inspect native regenerated lockfile changes, all workspace importers and runtime dependency edges. No hand-edited lockfile or blanket policy relaxation. Unrelated version churn is discarded through package-manager regeneration.

### Ownership and slices

1. Main: commit this hardened plan, baseline frozen install and smallest validation tests. No application server for source-only checks.
2. Executor for source compatibility; main for manifests/workspace/lock: update four direct Zod consumers (`apps/chat`, `apps/mcp-lecturer`, `apps/mcp-student`, `packages/graphql`) and necessary same-major Pothos/Hatchet adapters. Extend existing tests for changed record/default/error/constraint behavior. Preserve accepted payloads, rejected payloads, output shape and generated GraphQL SDL. Main integrates only changes justified by the migration. Possible files are existing TS sources/tests in those four consumers, existing Hatchet source/type adapters if the SDK typecheck proves them necessary, direct Hatchet manifests, `pnpm-workspace.yaml`, `pnpm-lock.yaml` and `.syncpackrc.mjs` only if native checks require alignment.
3. Main: run frozen install, focused validation/MCP/GraphQL/Hatchet tests, native type/lint/check/build, and inspect runtime dependency closure. Simplifier and risk slice review cover the committed complete implementation range. One independent integrated final review covers complete branch before finished delivery; reuse unchanged source reviews only within their actual boundary.
4. Main: ordinary push and draft PR with accurate verification limits. Run actual local browser smoke if schema changes affect a browser contract, using existing synthetic local material, no inference or environment writes. Image proof must come from actual scan receipts; a draft skip is not scan acceptance. Do not ready the PR merely to obtain scan evidence.

### Test portfolio and terminal

Protect parsing acceptance/rejection, output shape and defaults, untrusted record keys, array limits, MCP schema conversion/tool registration, Pothos input validation and GraphQL SDL, and Hatchet worker/task declarations. Prefer existing behavior tests; new fixtures contain only minimal test-owned synthetic values. Do not pin human prose or generated seed contents. Native builds and typechecks cover transitive integrations. Browser evidence applies only to actual local interaction exercised. No paid/live application calls, live fixture changes, new infrastructure, broad security assessment, migration rewrite or unrelated upgrade.

Pause only a dependent branch for missing authentication, unavailable test capability, demonstrated API incompatibility requiring a material design change, or a mandatory unresolved scan; finish independent work first. Draft delivery is source preparation, separate from merge, image qualification and rollout.

### Dependency closure and concrete test decisions

Baseline `pnpm --filter @klicker-uzh/backend-docker why zod --prod` finds runtime edges through GraphQL, Pothos, Hatchet, doc-query MCP and zod-to-json-schema. Workspace-wide Zod 3 is also pinned inside Scalar and design-system packages; these are separate consumer compatibility boundaries and must not be blindly overridden. Map production closures for backend, Chat, MCP, Hatchet workers and response API separately. Lift only existing Zod 4 dependencies/compatible peers to 4.6.6; unsupported Zod 3 edges retain an explicit blocker unless a compatible same-major dependent update removes them. Do not claim all images repaired from a backend-only closure.

Major-scoped overrides are `body-parser@>=1.0.0 <1.20.9` and `body-parser@>=2.0.0 <2.4.0`. Preserve major lines. Direct Hatchet manifests are `apps/auth/package.json`, `apps/backend-docker/package.json`, `apps/hatchet-worker-general/package.json`, `apps/hatchet-worker-response-processor/package.json`, `apps/response-api/package.json`, `packages/graphql/package.json`, `packages/hatchet/package.json` and both dependency/peer declarations in `packages/types/package.json`.

Test decisions: extend existing Chat schema boundary tests for changed record/default/error behavior; extend both `apps/mcp-lecturer/test/server.test.ts` and `apps/mcp-student/test/server.test.ts` to instantiate real FastMCP tools and validate schema conversion, required fields, defaults, bounds and argument rejection without network or application calls. Extend the existing GraphQL validation tests to protect Pothos error handling independently of SDL equality. Extend existing Hatchet worker/declaration tests to construct a real SDK declaration without connecting or dispatching. Reuse existing tests unchanged where APIs remain compatible. New test files require a demonstrated gap and must be named before creation.

Delegation map: explorer owns read-only Zod source seam mapping. Source executor owns only the exact existing source/test paths enumerated in its returned map after main integrates it below. Main owns all manifests, lockfile, plan, dependency closure, public SDK adapter seams and integration. Simplifier and risk reviewer are read-only over committed source range. Main owns final evidence, Git and PR effects. Each source slice depends on the compatible dependency graph; no overlapping writers.

Acceptance commands: frozen `pnpm install --frozen-lockfile`, `pnpm exec turbo run build --filter='./packages/*'`, four consumer native tests and checks, `pnpm run check:all` with host/container split where required, `pnpm run build`, runtime `pnpm why zod --prod` for each application, and unchanged `packages/graphql/src/public/schema.graphql`. Run actual image scans only within draft-preparation authority. Draft may carry unavailable image/browser proof; installed runtime dependency closure must be verified before any repair-acceptance claim.

## Progress

- Human authority: approved executable draft preparation; all live effects withheld except separately scoped Sonar issue states.
- Baseline: source pinned, clean worktree created; frozen container install running.
- Planner: pending; source mapping running.
- Implementation, checks, reviews and draft: pending.
