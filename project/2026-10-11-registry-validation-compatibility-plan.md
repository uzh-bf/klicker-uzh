# Validate deployed registries with the released model policy

## Approval summary

The alpha.86 image-only promotion exposed a control-source mismatch: v3 still requires GPT-5.6 Luna as the only BASE model and Auto as ADVANCED. The already-deployed registry and qualified alpha.86 image source require GPT-6 Luna as a BASE fallback and permit other BASE models. The user approved repairing validation and continuing independent ingestion-readiness work.

Backport only that released policy and the minimum compatible fallback metadata to v3's two built-in registries. Preserve all other models, registry schema, environment interfaces, deployment values, image pins and unrelated application code. Replace in-scope price/model-list fixture assertions with cross-consumer structured parity; retain consequential fallback, duplicate-ID and automatic-model rejection coverage. No new runtime-policy design or unpublished configurable-default package is absorbed.

Completion is a reproduced failing baseline, passing corrected registry/credit/fallback tests, exact diff and data-hygiene checks, committed task branch, draft PR and integrated review. Named merge, readiness, publishing and rollout authority remains separate. The existing approved two-query consumer packet remains conditional on its preflight; this source approval adds no paid or production effects.

## Execution details

Approval mode: executable batch. Target: v3 at712df2fe116199617c444e5e720cb918f5070d85. Branch: fix/registry-validation-compatibility. Worktree: trees/registry-validation-compatibility. Artifact root: project/. Execution mode: standard. This is one full-path compatibility package because the shared BASE/fallback contract crosses both consumers. No new architecture or model choices are introduced. Existing draft PR6423 targets v3-ai and retains its configurable-policy ownership.

### Ownership and slice

Main owns contract decisions, reviews, Git/forge delivery and live reads. One trusted bounded executor owns the following five source/test paths after planning review. It is not alone in the repository and must preserve other edits:

- packages/util/src/chatModelRegistry.ts: match released GPT-6 Luna required BASE/fallback and multi-BASE/Auto classification policy.
- apps/chat/src/lib/server/chatModelRegistry.ts and packages/graphql/src/services/chatbots.ts: replace only the built-in fallback entry's released identity, display metadata and cost; preserve other default entries and service logic.
- apps/chat/test/chatModelRegistry.test.ts and apps/chat/test/modelRegistryParity.test.ts: align synthetic fallback fixtures; protect rejection of missing/non-BASE/non-fallback Luna and invalid Auto structure; prove both parsers accept multiple BASE models and parse declared deployments consistently without pinning incidental costs/model lists.

One implementation slice; route executor, acceptance existing focused suites plus structured deployed-registry parsing. Main may extend an existing directly affected registry/credit test only if verification reproduces a stale policy assertion. Such an extension completes this compatibility package and is recorded before editing. No dependencies, migrations, seeds, uploads or deployment changes.

### Test portfolio

| Risk | Obligation | Existing seam and acceptance |
| --- | --- | --- |
| One consumer rejects declared deployed configuration | Extend existing parity test | Both parsers accept STG/PRD registry and agree on model identities, adapters, classes, costs and fallback capabilities. |
| Built-in fallback no longer satisfies shared policy | Extend existing registry tests | Both built-in registries parse; required GPT-6 Luna is BASE/fallback; synthetic missing/non-BASE/non-fallback cases reject. |
| Additional BASE or Auto selection bypasses guard | Extend existing structured tests | Multiple BASE accepted; Auto unique, non-reasoning and non-fallback; duplicate identities and unsafe fallback reject. |
| Credit fallback changes unintended callers | Reuse existing credit/fallback tests | Run directly affected suites after mapping; preserve zero-credit selection restrictions and allowed-model behavior. |
| Unrelated release/code or deployment changes included | No new tests | Compare every hunk against released policy; deployment tree, env keys, schema and unrelated services unchanged. |

Container-dependent tests run in a service-free network-disabled Node24 container with existing dependencies. Do not start a devcontainer/app/database or install host dependencies for this fix. If container tooling requires a scoped dependency install, pin from the repository lock and keep it outside tracked source. Full hosted checks remain necessary. No markup, routing, cookie or interaction code changes; preserve the repository's browser-verification requirement as pending if no supported Browser is connected, without claiming a visual proof.

### Continuation and gates

After local verification, ordinary non-force task push and draft PR are already authorized; do not ask for another proceed. Source review occurs at the complete committed range while hosted CI runs. Main diagnoses telemetry/restore/reader/capacity readiness independently; a missing capability pauses only its affected step. Stop source publication only on unresolved policy deviation, credential/data leak or unusable required verification; keep all independent readiness work moving. No workflow retry, human notification or production repair is included.

## Progress

Planning challenge: APPROVED by the existing Astra planner. The local unmodified promotion tree reproduces the same collection-time Zod failure as unit38156141969. Implementation backports the released shared policy and only the two fallback entries.

Verification extended the owned test set to apps/chat/test/account-usage-route.test.ts after four stale model selections and one resulting queued mock response reproduced failures. The route fixture now owns its synthetic prices; model identity and observable credit guards remain covered independently of default pricing. All six focused registry/credit suites pass: 65 tests. Biome checks all six changed source/test files without fixes; diff whitespace checks pass. Test execution uses Node24.21.0 and Vitest3.2.4 in a network-disabled one-shot container, aliases the actual shared policy source, and reuses generated Prisma enum/browser bindings without database access. Full hosted CI and Browser proof remain pending.

One implementation slice is complete, with simplification, risk review and integrated final review next. Standing task push and draft PR delivery remain approved. Native broad production goal remains BLOCKED and is not replaced.

Review correction: accepted the simplifier's removal of duplicate negative-policy tests already covered through both consumers by the parity suite. Accepted the risk review's stale ADVANCED-only Auto error correction. The released ADR 0020 contains approved September/October amendments absent from v3; restore their narrow compatibility meaning in that existing ADR and CONTEXT.md rather than introducing a new policy. Capture the non-obvious promotion-source mismatch in docs/solutions/test-failure/image-promotion-registry-policy-drift.md under the existing solution convention. These are the only added documentation paths in the package. Integrated review covers them with the source correction.

Corrected final local evidence: six suites, 64 tests pass on the same Node24.21.0/Vitest3.2.4 isolated toolchain; one redundant test removed. Biome checks all six source/test paths without fixes. Existing lesson-discovery pointer in AGENTS.md already includes docs/solutions; no global instructions or memory change is needed. This is a legitimate regression follow-up to the image-only promotion, not a separate unfinished implementation fragment.

Integrated review verified a local-only regression: changing the built-in fallback without the released local wiring would request an undeclared LiteLLM deployment. Complete this existing compatibility package with util/litellm/config.yaml's exact released GPT6 Luna entry, .devcontainer/devcontainer.env's existing fallback value, the two seed allow-lists in packages/prisma-data/src/data/seedChatbots.ts and the fallback script's default in packages/prisma-data/src/scripts/2026-06-15_ensure_chatbot_fallback_model.ts. Preserve old gateway aliases and seed content otherwise; do not run seed/script or any provider request. Add one consequential local gateway-resolution regression to the existing parity suite, with no seed-content assertions. No environment interface, deployment setting or upstream credential changes. Final reviewer output used invalid confidence/autofix types despite the requested schema and is not an accepted gate; source finding was independently verified. Recheck the affected full package and require canonical structured final review at its corrected head.

Canonical final review of766949a7 passes schema validation and confirms the full compatibility behavior, with one accepted low-severity outdated local picker name in AGENTS.md; update only that affected identifier. Hosted CI additionally reproduced seven GraphQL integration failures in packages/graphql/test/manageChatbots.test.ts: active-fallback protocol fixtures still select the retired identifier. Extend only that existing affected test's active-model fixtures, preserving intentional retired-model cases and all behavioral guards. CI's formatter identified only the new solution note; run repository Prettier on it. No application implementation or live setting change is required by these corrections. Exact final hosted GraphQL and formatting results remain required.

October 12 continuation: all replacement checks except Playwright passed at a906b33f. Playwright38165269176 reproduced three failures in T-chatbot-authoring.spec.ts and Y-chat.spec.ts because active-model selectors still request the retired GPT-5.6 Luna label. Extend only those two existing specs to the released GPT-6 Luna model and protocol identity, retaining authoring persistence and reasoning-request assertions. The touched model-description test will check that the selected model exposes a visible, nonempty description rather than pinning marketing prose. The design-system picker exposes display labels, so reuse its existing selection helper instead of adding application markup for tests. Reuse passing behavioral review and local registry evidence for unchanged implementation; formatting, syntax and exact-head hosted browser checks remain required. The user's named ready/review/conditional-merge approval applies to PR6467 targeting v3. The expired deferred monitor is paused; use one supported watcher for the corrected head.
