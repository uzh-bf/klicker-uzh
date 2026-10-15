# Promote approved custom-mode knowledge-base binding to production

## Approval summary

Prepare production promotion of [#6247](https://github.com/uzh-bf/klicker-uzh/pull/6247) through the existing release route. Staging acceptance and exact fixture cleanup are complete. Approved custom modes inherit retrieval, approval controls and disabled overrides hold, required retrieval fails closed, and the Knowledge UI passes. Empty synthetic KBs leave populated-document grounding untested; the original five-attempt allowance is exhausted.

Recommend a follow-up alpha from `v3-ai`, with deployment configuration on `v3`. The full release delta includes #6491's entitlement backfill. It also needs the staged whitespace-aware backfill and draft-model eligibility corrections, which are absent from the release source. The open alpha.88 proposals #6522/#6523 predate this feature and remain owned elsewhere. Resolve that release reservation before preparation. Promoting the entire staging tree would carry unrelated adaptive and audit work.

Success requires a fixed reviewed candidate, populated-KB grounding and isolation proof, migration/recovery preflight, exact published image digests, and verified rollout and acceptance. Proposed new limits are five STG POST attempts and two production attempts, counting failures. Two synthetic documents and bounded ingestion/review allowances are specified below; none is authorized yet.

Approval mode: executable batch for phase 1 only. On 15 October 2026 the user approved preparing the two staged corrections, refreshed tests and documentation, ordinary task-branch commits/pushes, and a draft PR into `v3-ai`. All later phases remain proposed. Source and sync merges, release merge, tag publication, production merge/deployment, shared-environment synthetic writes and rollback retain named gates. Existing owners retain their proposals; peer notifications and reviewer requests remain outside scope.

## Execution details

### Verified starting point and release scope

Snapshot: 15 October 2026, after host `git fetch --prune origin` and forge reads. Re-resolve these identities before execution; branch names and proposed versions can move.

| Layer | Recorded evidence | Consequence |
| --- | --- | --- |
| Feature | #6247 merged into `v3-ai` as `e2ac86f836c3fe78986f9ac51316d1e76bdd2556`; current `origin/v3-ai` is that commit. | Source integration of the original feature is complete. |
| Staging integration | #6533 merged as `9616a2152b79a9f184e410c2dc586a5c7328d5b2`, including corrections `72100f09a270571e0d1cabd92cd579d4b3051f9c` and `93837d312ae32ec814749e53276daf9197e21fb2`. | Neither correction is an ancestor of the current release source. |
| Accepted staging candidate | `a246a91eae1861480b5d364664f4501af7bded0b`, also current `origin/stg-release` and `origin/v3-adaptive-learning`. Its full push CI and automatic promotion evidence passed. | Acceptance belongs to this candidate; the release candidate will need an explicit equivalence assessment. |
| Production desired configuration | `origin/v3` is `8757713aaf8d93b4c67a64909a2074e965202f33`. Its checked-in production pins reference alpha.87. Its `deploy/` tree equals current `v3-ai`. | These are source facts, not current production runtime proof. No deployment parity repair is currently established as necessary. |
| Existing release work | [#6522](https://github.com/uzh-bf/klicker-uzh/pull/6522), alpha.88 release, is open at `5a9816cab962b16a47542628f1b4e93cf9287cbd`; [#6523](https://github.com/uzh-bf/klicker-uzh/pull/6523), its production promotion, is open at `967f568440f074ad8ca31d96cafe682caf84259b`. The feature is absent from #6522; the alpha.88 tag lookup returned 404. | Neither proposal currently delivers #6247. Their owners and approvals remain separate. |

Follow [ADR 0051](../docs/adr/0051-ai-releases-tag-v3-ai-with-deploy-parity.md): application images come from a tag on `v3-ai`; production renders `deploy/` on `v3`. The older RC/reset-staging approach is superseded. No merge of `v3-ai` or the staging branch into `v3` is required merely to ship application images.

Use the next available alpha after the existing release reservation; do not preassign a tag. Prefer leaving #6522/#6523 with their current owners and scope. Reusing them for this larger release needs an explicit owner decision and refreshed approval. Create no competing release or deployment PR while that decision is unresolved.

The staged tree contains substantially more than this feature. Port only the two reviewed corrections to `v3-ai` in one ordinary source PR, preserving their behavior and including relevant tests. Do not merge `v3-adaptive-learning` or `v3-audit` back into `v3-ai`. This is a minimal source correction, not a branch-topology change. Review the complete release delta from the actual prior production tag, including #6491's cost-center entitlement backfill; a release cannot be approved as a #6247-only patch.

### Contracts to preserve

Use [ADR 0050](https://github.com/uzh-bf/klicker-uzh/blob/e2ac86f836c3fe78986f9ac51316d1e76bdd2556/docs/adr/0050-per-mode-retrieval-scope-and-kb-attachment.md) as the existing product contract. This promotion introduces no new product primitive or public API removal.

- Participant eligibility follows approved custom-mode configuration. The intended authenticated owner-preview exception remains separate from participant access.
- Approved custom modes inherit the required Tutor/Explainer KB binding. Enabled exact bindings retain precedence; disabled exact overrides stay disabled through replacement.
- Quizzer keeps its restricted document-query capability gate. A declared required binding that cannot resolve returns `503 REQUIRED_MCP_UNAVAILABLE` before provider work; unbound ordinary modes keep their documented behavior.
- Preserve one-server/one-normalized-KB scope, account ownership and data isolation. Draft model selection and save policy must agree without granting runtime AI approval or changing saved-model exceptions.
- Keep the Knowledge UI and deprecated public field compatible. Preserve existing feature-switch values and model registry policies; promotion does not authorize feature activation or chatbot publication.

### Evidence reuse and remaining validation gaps

The feature final review ran in [38653463095](https://github.com/uzh-bf/klicker-uzh/actions/runs/38653463095). The integration final review ran in [38713124765](https://github.com/uzh-bf/klicker-uzh/actions/runs/38713124765), with complete selected coverage and two verified rejected style findings. The latter is complete coverage with rejected findings, not zero findings. A later queued review was cancelled before paid execution after the external merge; it provides no additional coverage.

Reuse unchanged source evidence: focused binding and required-MCP tests, 57 synthetic migration cases with rollback and idempotence, 23 focused API tests, draft-model browser save/reload proof, seed idempotence, and passing type, lint and build checks. Existing browser screenshots cover the changed authoring UI. New tests must cover a consequential changed obligation rather than duplicate these checks or pin prose.

| Gap | Required evidence before its gate can clear | Owner and gate |
| --- | --- | --- |
| Release source differs from accepted staging integration | Port the whitespace-aware tier backfill and additive `advancedModelConfigurationEntitled` projection/UI correction with their focused tests. Compare the resulting KB/mode/model-policy paths against accepted staging, explaining every semantic difference. Review the whole candidate delta and required current checks. | Source executor; blocks release readiness. |
| Populated-document grounding and KB isolation | Under a new explicitly approved allowance, use two dedicated synthetic KBs with distinct facts. In at most five additional short POST attempts, verify inherited retrieval returns the intended source, replacement reads only the replacement KB, and no unrelated synthetic KB is disclosed. Judge source/tool evidence as well as the answer. Any failed or rejected POST consumes an attempt. | Main on STG; blocks release readiness. Original five attempts remain exhausted. |
| Production migration and recovery suitability | Privately verify the actual prior deployed tag, migration ledger/checksums, pending migration inventory, backup/PITR availability and restore procedure. Rehearse the exact pending migrations on a disposable representative synthetic database. | Main and release operator; blocks tag and deployment admission. |
| Exact release binaries and configuration | Required CI and applicable reviews on fixed release/source heads; actual tag-to-commit proof; every rendered production image and migrator resolved to a published digest; compatible normalized values and both actual registry consumers; Helm lint/render and evaluated deploy parity. | Release and deployment owners; blocks production promotion merge. |
| Production runtime and end-to-end acceptance | After separately approved rollout, prove desired revision, successful normal migration, ready workloads and actual image IDs; perform a separately approved bounded synthetic production canary and guarded cleanup. | Main/operator; blocks completion. |

STG acceptance is not proof of populated-course retrieval quality, long-duration reliability, production capacity, Firefox, physical devices or assistive technology. For this bounded binding correction, targeted Chromium interaction and relevant locale/mobile evidence can be reused. Extra platform, load or long-soak work is not a new mandatory audit unless the fixed release delta changes those contracts or a concrete failure arms it. No production-specific acceptance is currently claimed.

### Migration and recovery conditions

The current `v3.4.0-alpha.87..v3-ai` source range adds one migration, `20261013120000_ai_tier_from_cost_center`, introduced by #6491. Its intended data-only effect is to retain advanced access for existing accounts with a nonblank cost center. The staging correction aligns whitespace handling with the application predicate. This does not authorize publishing private impact counts or account attributes.

Determine the actual production baseline and applied checksum before editing or admitting that migration. If it has not been applied in an environment that must retain its ledger, the reviewed corrected SQL may remain the single pending migration. If the historical SQL has already been applied, stop the dependent source/release branch and design a separately reviewed forward repair; do not rewrite an applied migration or automatically revoke advanced access. Preserve legitimate subsequent account edits. Additional pending migrations discovered from the real release baseline need explicit review before publication.

The PreSync hook uses the primary GraphQL database secret. Verify whether the assessment backend uses that same database; a separate assessment database needs its own proven migration path before promotion. Rehearse compatibility while the previous application version remains live.

The release operator must record a recent recoverable backup/PITR point, retention window, restoration access, responsible operator, and tested restore procedure privately before promotion. Application rollback requires a prevalidated prior image/configuration pair that can run against the resulting schema and data. Restore parsed values together with compatible image pins. Backfills are not undone by image rollback; data repair is a reviewed compensating forward migration. Database restoration, manual SQL, replay, migration resolution and rollback execution require separate named approval.

### Bounded correction scope

The source phase owns these existing paths, taken from the two reviewed corrections. No new executable file, dependency, migration identifier or module is proposed. This new plan is the sole new tracked deliverable at this stage.

| Correction | Existing paths and disposition |
| --- | --- |
| Backfill predicate | Carry the whitespace change in `packages/prisma/src/prisma/schema/migrations/20261013120000_ai_tier_from_cost_center/migration.sql`, subject to the applied-checksum gate, and its affected comment in `packages/graphql/src/services/accounts.ts`. |
| Additive entitlement projection | Carry `packages/graphql/src/services/chatAccountUsage.ts`, `packages/graphql/src/schema/resource.ts`, `packages/graphql/src/graphql/ops/QGetChatAccountUsage.graphql`, and generated public `packages/graphql/src/public/schema.graphql`. Regenerate ignored client documents normally. |
| Model selection and regression | Carry `apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx`, `packages/graphql/test/chatAccountUsage.test.ts`, and `playwright/tests/T-chatbot-authoring.spec.ts`. |
| Repeatable synthetic test setup | Carry the entitlement reset in `playwright/global-setup.ts` for its existing synthetic users. It is necessary to make the draft-model regression reliable on retained test databases; this is the sole planned fixture change. No product/demo seed cleanup is included. |
| Affected documentation | Carry only the semantic clarification in `docs/adr/0050-per-mode-retrieval-scope-and-kb-attachment.md`. Update the existing binding and AI-tier plan statuses generically; do not copy historical real-environment facts from them. |

The retained verification receipt is `trees/kb-binding-staging-sync/project/_local/reviews/2026-10-15-sync-migration-whitespace-verification.json`: it records 57 temporary-table cases, JavaScript-trim parity and rollback/idempotence. The exact runnable synthetic harness was recovered during source preparation into ignored local review artifacts. Reuse it for temporary-table JavaScript-trim parity and idempotence verification; no maintained test file is added.

### Production image evidence limitation

At the recorded source, 15 per-image `v3_*-prd.yml` workflows publish 16 ARM repositories, including the backend migrator. They do not upload an aggregate production digest manifest or scan receipts. The staging promoter's manifest and scans qualify its staging digests, not separately rebuilt production images. A green publisher wrapper alone is insufficient.

At the actual tag, enumerate every publisher and successful push leg, bind its run/source SHA to that tag, and read each published tag's immutable digest and platform from the registry. Cross-check every rendered workload and derived migrator reference; account for published targets outside this chart. Record this read-only evidence without adding a workflow. Missing production scan receipts remain an explicit limitation: before promotion, obtain separately approved bounded scan evidence for the actual release digests or a human decision accepting that gap. No scan-policy or runner change is included.

### Proposed sequence and authority gates

Execution owner: main, with a native `executor` for the enumerated public-source correction and configured reviews when implementation is approved. Main retains migration integrity, external effects and integration decisions. Boundary owner: self. No new monitor is required for this planning task. The completed staging heartbeat stays stopped.

Delegation Map (all phases are proposed):

| Phase | Accountable owner | Dependency and acceptance |
| --- | --- | --- |
| 1. Source proposal | Main; native `executor` owns only the enumerated patch/tests | Existing evidence and checksum decision; reviewed ordinary source PR, unmerged. |
| 2. STG qualification | Main | Separately authorized source and forward-sync merges plus new fixture/cost allowance; source-bound populated-KB proof and cleanup. |
| 3. Release publication | Main | Phase 2, reserved-release decision and private preflight; reviewed release merge and separately approved tag yield verified production images. |
| 4. Deployment proposal | Main | Phase 3 and image-gap disposition; reviewed atomic deployment PR with recovery evidence, unmerged. |
| 5. Rollout/acceptance | Main with designated release operator | Explicit production merge/deployment and bounded canary authority; runtime, acceptance and cleanup proof. |

1. **Prepare a release candidate.** After approval of source preparation, create an ordinary `v3-ai`-based correction branch and source PR for the two missing corrections. Reuse the accepted semantic changes and tests, omit unrelated staging/audit changes and retain only the test-fixture reset named above, and resolve material differences explicitly. Inventory the complete release delta and pending migrations. Update the existing [binding plan](https://github.com/uzh-bf/klicker-uzh/blob/e2ac86f836c3fe78986f9ac51316d1e76bdd2556/project/2026-09-21-chatbot-kb-custom-mode-binding-plan.md) only where the carried behavior or status changes. Preserve existing source owners and the reserved release sequence. Acceptance: reviewed candidate proposal with exact range, CI, test and migration obligations, no merge.
2. **Close the STG gap.** First obtain named authority to merge the exact reviewed correction PR into `v3-ai` and its identified normal forward-sync PR into the currently configured `v3-adaptive-learning` source, after their required CI/reviews pass. Preserve ancestry with normal matched-head sync merges. These approvals precede qualification; phase 3 merges only the later release-metadata PR. Use the existing configured forward route, not reverse integration or a topology change. A changed route or inability to establish candidate equivalence stops this phase. After explicit fixture, ingestion and new five-attempt approval, qualify the fixed candidate's relevant application behavior through the existing staging process, without changing topology or resetting shared staging. Recheck its promotion receipt, runtime revision and relevant image digests; explain any broader integration delta. Ingest at most two synthetic text documents of at most 2 KiB each, one ingestion attempt per document; no paid ingestion retry. Run the populated synthetic-KB cases above, preserve runtime approval/model policies, delete only exact task-owned rows and owned ingestion/index/blob artifacts with ownership guards, verify absence, and close the browser. Acceptance: source-bound grounding/isolation evidence and cleanup. Stop at five attempts or on a capability/data-isolation failure; no retries beyond the cap.
3. **Prepare and publish the release.** Release-metadata merge and tag publication need distinct named authority; source/sync integration belongs to phase 2. Settle the existing alpha.88 owner decision first. Use `pnpm run release:alpha:dry`, then the repository generator `pnpm run release:alpha -- --skip.tag` on an approved release-preparation branch; `.versionrc.js` owns version targets and changelog generation. Obtain required exact-head CI, full final AI coverage under the then-published policy, applicable human reviews and resolved actionable feedback. Reuse valid complete evidence; allow one required final-review attempt per materially changed source, release or deployment head/policy, under the existing individual 6M ceiling. Partial coverage, terminal provider failure or exhaustion stops that dependent review; no budget escalation or blind retry is included. After approved merge, verify the actual merged source commit, required push checks and tag identity before separately approved tag publication. Acceptance: exact production binaries built from that fixed reviewed tag, not just a green release PR.
4. **Prepare the atomic production promotion.** In a `v3`-based deployment PR, update only the required production image pins and any proven coupled deploy configuration. Keep staging references and activation values intact. Read current required branch rules; verify actual producing checks, review coverage, rendered migrator and every application target/digest. Evaluate parity against the exact image source, not a skipped green check. Existing staging manifest receipts do not establish production image publication. Acceptance: reviewable deployment PR plus private migration, recovery and runtime preflight receipts. Merge remains gated.
5. **Roll out and validate.** Only a separate explicit production decision may authorize the matched-head deployment PR merge and resulting normal Argo reconciliation/migration. Confirm that merge can trigger rollout automatically; there is no harmless intermediate production-merge step. Verify merged desired state, actual Argo revision, normal PreSync migrator completion and ready workloads with expected digest IDs. With separately included synthetic-write/cost authority, permit at most two short production POST attempts, counting every failure or rejection: approved inherited retrieval and required-binding rejection using owned configuration only. Verify participant approval rejection and Knowledge UI through bounded non-provider checks, then exact-owned fixture/artifact cleanup. Completion requires all layers plus cleanup; any failed condition stops the dependent action and asks for the exact recovery decision.

No production MCP server mutation is part of a failure test. No credential refresh, new connection, runner/provider/cost-policy change, model substitution, human reviewer request or peer notification is included. Existing connections may support authorized preflight; unavailable access is reported instead of repaired automatically. A terminal provider failure or exhausted final-review budget is checkpointed without another paid attempt.

### Verification portfolio and documentation disposition

| Risk | Existing seam | Maintained-test obligation and operational evidence |
| --- | --- | --- |
| Approval, inheritance and required retrieval | `apps/chat/test/effective-chat-modes.test.ts`, `apps/chat/test/required-mcp-route.test.ts`, `packages/graphql/test/knowledge.test.ts` | **None**: reuse existing suites; rerun affected paths. Distinct live obligation: bounded populated-KB grounding/isolation. |
| Draft/save entitlement drift | `packages/graphql/test/chatAccountUsage.test.ts`, `playwright/tests/T-chatbot-authoring.spec.ts`, `playwright/global-setup.ts` | **Extend existing** by carrying the reviewed projection/save regression and repeat-seed reset, preserving runtime approval. |
| Backfill correctness | Retained synthetic receipt identified above; migration SQL | **None** proposed: reuse the recovered exact harness on disposable synthetic tables; no new maintained test or fixture portfolio. |
| Image/configuration mismatch | Existing `.github/scripts/deploy-parity.cjs`, candidate `apps/chat/test/modelRegistryParity.test.ts`, Helm render and publisher run evidence | **None**: use actual candidate consumers and rendered inputs. New operational evidence is exact-tag registry digests and scan-gap disposition. |
| Failed producer appears successful | Final-review counters/coverage, publisher push legs, migrator status and bounded canary outputs | **None**: inspect actual producing evidence. Wrappers and skipped jobs cannot clear gates. |

This portfolio is frozen for the proposed package. A slice may not independently add tests, fixtures or a harness beyond the named changes; a concrete new consequential regression requires updating this plan before that addition.

Existing ADRs 0050 and 0051 already settle behavior and release topology; no new ADR is proposed. Re-arm the ADR gate for changed binding semantics, public field removal or release topology. Update `docs/ci-and-deployment.md` only if an approved delivery change alters its actual mechanism; this plan makes no mechanism change. A source correction that changes UI uses the existing screenshot workflow with reviewed synthetic evidence and preserved PR screenshot/CodeRabbit sections. Release preparation generates its changelog through the repository tool. No raw runtime data, identifiers, credentials or private query findings enter repository artifacts or review prompts.

### Workspace and planning research

Implementation workspace: `trees/kb-binding-release-alignment`, branch `fix/kb-binding-release-alignment`, based on `v3-ai` commit `e2ac86f836c3fe78986f9ac51316d1e76bdd2556`; artifacts root `project/`. The production deployment target resolves to `v3` under ADR 0051; application correction/release PRs target `v3-ai`. No new stack or topology is proposed. Preserve the completed feature/staging worktrees and their deleted remote upstreams.

Planning evidence uses committed repository contracts, host forge metadata, and sanitized synthetic acceptance summaries. The read-only release mapper owns workflow/source mapping; main owns candidate containment, authority, private evidence boundaries and the plan. External documentation research is unnecessary because no delivery mechanism is being changed. Version-sensitive CLI use during execution must still use the repository-pinned toolchain and current documented commands.

## Progress

Phase 1 source preparation is complete pending ordinary commit, integrated final review and draft delivery. Both corrections match the reviewed staging code. Fresh verification: 23 focused API tests; the recovered 57-case temporary-table JavaScript-trim/idempotence harness; one canonical Chromium selection/save/reload regression; and the installed changed-path pattern scan with no findings. The five historical local synthetic captures were inspected, their exact uploaded bytes verified, and their existing project URLs rendered successfully. No new paid model turn or shared-environment fixture was used.

Package: one cohesive correction PR into `v3-ai`, based on `e2ac86f836c3fe78986f9ac51316d1e76bdd2556`. The approved plan and implementation travel in the same first coherent commit: the required GraphQL schema check compares the working snapshot against the index, so the intentional additive schema change must be staged with its implementation. Earlier plan-only hook attempts made no commits. The initial runtime preparation failure was resolved without source, dependency or configuration changes. Final required hooks, review and hosted CI status are recorded in the ignored review receipt and draft description.

The remaining production-promotion phases are proposed only. This batch ends at the source draft PR. Merge, tag publication, shared-environment validation and production deployment retain their named gates.

Planning review: APPROVED by the configured native planner after one correction round. Accepted changes clarified full release scope and test allowances, ordered source integration before staging qualification, named correction paths/owners, and froze the test portfolio. Main also verified production image-evidence limitations and migration coverage. The optional opposing-provider pass was rejected before execution by automatic approval review and remains unpassed. Detailed provenance and arbitration are in ignored `project/_local/reviews/2026-10-15-kb-binding-production-plan-hardening.md`. No required review remains for this planning deliverable; execution gates remain outstanding.
