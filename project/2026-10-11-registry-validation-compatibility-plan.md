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

Planning: derived from the Astra-approved production roadmap and explicit October11 implementation instruction. Baseline forge unit38156141969 reproduces collection failure; local reproduction pending. Required scoped planning challenge pending. No source changes yet. Native broad production goal remains BLOCKED and is not replaced.
