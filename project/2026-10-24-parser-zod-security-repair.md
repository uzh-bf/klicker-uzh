# Repair request parser and schema validation dependencies

## Approval summary

Prepare one draft against `v3-ai` that removes the reported vulnerable body-parser and Zod versions from application images. Preserve request validation, GraphQL schema, authorization, MCP tool contracts and Hatchet workflow behavior. Update body-parser within each existing major, migrate direct Zod consumers from 3 to 4.6.6, and update only the same-major integration dependencies necessary for Zod 4. Do not force a Zod 4 implementation into a dependency that only supports Zod 3.

The human approved this executable draft-preparation batch on 24 October 2026. Local commits, ordinary task-branch push and one draft PR are authorized. Ready, merge, rollout, Sonar dispositions, credentials and application model calls are outside this source package. The separately approved exact Sonar issue dispositions have their own private receipt and browser owner.

Completion requires a reviewed coherent draft, native lockfile/install/check/build evidence and behavior tests. Any unavailable browser or image proof remains explicitly pending. No deployment or production-readiness claim follows from draft delivery.

## Execution details

Baseline `b865fad566065ef36902282118f2552aebb62472`, target `v3-ai`, branch `fix/parser-zod-security`, worktree `trees/dependency-parser-zod-repair`. Execution mode: standard, full path. Primary checkout is preserved. Artifacts use the existing `project/` root. Main owns dependencies, integration, effects and final proof. One read-only explorer maps source migration seams; planner hardens this plan before implementation. Settled source edits may be delegated with disjoint ownership.

### Evidence and contracts

Official Zod migration guide: https://zod.dev/v4/changelog . Security references: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 and https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828 . Pothos integration: https://pothos-graphql.dev/docs/plugins/zod . Registry metadata was checked on 24 October 2026.

Targets: body-parser 1.20.9 and 2.4.0, Zod 4.6.6, Pothos plugin-zod 4.3.2. Hatchet 1.22.0 is the first existing-major SDK release declaring Zod 4 support with its unused optional OpenAI/Claude agent integrations omitted. MCP 1.32.0 already declares Zod 4 compatibility and stays pinned unless a demonstrated defect requires its patch. Align every direct Hatchet consumer and peer floor if that update is necessary. Existing SDK majors, Node 24.21.0, pnpm 12.11.2, public schemas, migration files and canonical hash protocol remain preserved.

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
- Baseline: source pinned; frozen container install, baseline package build and focused validation passed.
- Planner: approved revised closure/test/delegation plan; source mapping completed.
- Implementation and local checks completed. Independent final source review passed with no remaining findings after the Pothos correction.
- [Draft PR #6699](https://github.com/uzh-bf/klicker-uzh/pull/6699) is open. Ready, merge and rollout remain excluded.
- Current hosted CI and actual image scan receipts remain unqualified; authenticated embed browser proof remains pending.

### Source map verified before execution

Concrete source compatibility path: `apps/chat/src/services/manageContext.ts` one-argument record becomes explicit string-key record. Custom issue constants in `apps/chat/src/lib/server/chatModelRegistry.ts`, `apps/mcp-lecturer/src/service.ts`, `packages/graphql/src/services/assessmentReports.ts`, `packages/graphql/src/services/chatbots.ts` and `packages/graphql/src/services/kbGraphContract.ts` change only if native Zod 4 checks require it. Deprecated compatible APIs remain. Existing native tests include Chat `manage-context`, `manage-chat-request`, `chatModelRegistry`, `prompt-cache-identity`, context/auth/route suites; GraphQL `assessmentReports`, `kbGraphContract`, `flashcardGenerationArtifacts`, `questionGenerationArtifacts` and `participantInvitations`; MCP `server`, `service` and `toolErrors`; Hatchet `worker-runtime` and existing task tests. Executor writes only MCP `test/server.test.ts` files for actual registration/schema-conversion coverage. Main owns all other source and dependency integration.

Baseline: frozen install and 77 citation tests passed; all 13 package build tasks passed with existing diagnostics, generated SDL unchanged. Planner revised closure/test portfolio/delegation sections and then APPROVED. Source explorer completed exact 43-importer map. Both read-only children closed. No reviewer result is dependency runtime acceptance.

Dependency decision: production backend closure verified with native `why --prod`. Exact design-system 4.1.8 archive contains no Zod reference in any shipped JS/TS source or dist, so remove only `@uzh-bf/design-system@4.1.8>zod` via pnpm's documented unused-dependency removal, never replace its pin with an incompatible major. Scalar 0.x is a separate transitive tooling boundary, outside backend runtime; retain an explicit residual if it cannot be removed within compatible dependency scope. Zod convergence override pins only ranges admitting 4.6.6. This is not a global Zod3 override.

Main verified the exact published Zod 4.6.6 archive still exports `ZodIssueCode.custom`; keep those call sites unchanged. The one-argument record is the only demonstrated direct API correction so far. Source mapping advice is verified against the selected installed version before implementation. body-parser 2.4.0 requires qs ^6.16.1; the required exact qs 6.16.1 exception was source-reviewed against 6.16.0 and has no install lifecycle scripts. No broad qs override is introduced. Optional external plan challenge was rejected by automatic approval review because it would export the unpublished plan; no retry or indirect export. Native planner approval remains valid.

Native override alignment adds existing `apps/frontend-pwa/package.json` body-parser direct pin 1.20.9; no PWA application source changes. Exact Hatchet 1.22.0 optional agent-integration edges are removed because no workspace consumer imports them. No new AI SDK major or agent capability is introduced. Keep required SDK tracing/worker dependencies and validate actual construction, builds and types.

Observed compatibility regression: full Chat suite initially passed 1656 tests but rejected two existing UUID-shaped PWA identifiers under Zod 4 RFC variant checks. Preserve the previous hexadecimal 8-4-4-4-12 acceptance with Zod 4 `guid()` at all 24 existing UUID-validation call sites in the four migrated consumers. Keep malformed-ID rejection; extend the existing PWA token test. This restores the approved API boundary rather than changing fixtures to hide the regression. New test path needed for real Pothos validation: `packages/graphql/test/input-validation.test.ts`; use the production builder and synthetic field with no database call.

Verified integrated source: all 36 importers retained; 904 dependency specifiers agree. Nine production app closures resolve only Zod 4.6.6; body-parser has only 1.20.9/2.4.0. Scalar Zod 3.24.1 remains in development tooling, outside those production closures. Full Chat 1660 passed/33 skipped; MCP lecturer 43 and student 36 passed; Hatchet 144 plus new declaration check passed; selected GraphQL 128 plus two real Pothos checks passed. All 27 native production builds passed; 41 check tasks plus GraphQL TS and element-import checks passed; schema unchanged. Lint 6 JS tasks and separately network-enabled Analytics lint passed; syncpack and focused Opengrep (210 rules, seven files, zero findings) passed. Host contracts passed with explicit installed Devrouter and pinned pnpm cache after correcting host PATH/cache prerequisites. No application model calls or real-environment writes.

Local browser verification and its precise limitations are recorded privately. It does not establish successful authenticated embed flow. No visible UI change is intended, so a screenshot gallery does not apply. No application model calls, live fixtures or environment writes are part of this package. Owned browser/runtime resources are released after checks.

Fresh worktree Husky bootstrap is absent; required check/build/format/lint/syncpack/host-contract/identity/staged-secret checks run as explicit host/container equivalents. No hook override or permission bypass. Actual image scan and hosted CI remain separate pending evidence. Existing correction draft https://github.com/uzh-bf/klicker-uzh/pull/6698 addresses an inherited CI install-contract assertion; no merge authority is inferred.

Final review correction also covers Pothos UUID options in `packages/graphql/src/schema/mutation.ts` and `packages/graphql/src/schema/elementGeneration.ts`: supply equivalent GUID schemas so existing non-RFC-variant hexadecimal IDs remain accepted. The actual Pothos regression test covers acceptance and rejection. Simplifier's single-call SDK loader cache removal accepted in both MCP tests; no assertion changes.

Final correction verification: Pothos validation integration now has three passing tests (including legacy ID acceptance), selected GraphQL contracts pass together, GraphQL TS and generation preserve SDL, and both simplified MCP server suites pass. Hosted check failure confirmed the inherited OCR install assertion covered by separate draft #6698; no retry or duplicate correction included here. Draft image jobs are skipped and are not image acceptance.

Integrated final: source range through `aa7a3d3480ada2d3dcf6e96f4f7d471c8e3d0308` reviewed in full; no remaining findings. The final progress-only edit does not change source or invalidate that review. Substantive package size before this note: 587 added / 80 removed lines excluding lockfile and plan.
