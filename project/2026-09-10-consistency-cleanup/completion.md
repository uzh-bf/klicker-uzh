# B0 source preparation receipt — cutover not approved

Observed 2026-09-10, Europe/Zurich. User authorized local implementation, tests and ordinary draft publication. No shared-branch merge, live write, release, SQL application or feature enablement was performed by this task.

## Evidence and separate verdicts

| Dimension                       | Verdict                                       | Evidence / remaining gate                                                                                                                                                                                                                                              |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SOURCE_CLEANUP                  | PREPARED                                      | Normal merge of stable 492e5f1e into maintenance 5cb1e445, then published maintenance correction 1d85533; conflicts zero. Shared refs await cutover. Later stable 880987ff incident change is not silently accepted.                                                   |
| Migration preservation          | VERIFIED for inspected source and PRD clients | 195 source files unchanged; primary and assessment ledgers each 193 successful/2 rolled back/0 unfinished; incident SQL has no missing/checksum differences. Authoring revision migration remains pending on both. Analytics independent client ledger not yet proven. |
| PRD_HANDOVER                    | BLOCKED                                       | Authoritative df-cloud draft selects v3-ai with autosync false; STG-only preview 181 unchanged. PRD exact preview, current three-way semantic acceptance, containment and operator approval missing.                                                                   |
| STG_HANDOVER                    | PREPARED                                      | Fail-closed selector patch; intended v3-audit. Live selector remains v3-ai, enabled true; Argo remains stg-release. Exact audit artifact receipt and shared source integration pending.                                                                                |
| CORE_HEALTH                     | PREPARED / partial live evidence              | Concurrent operator-owned worker repair completed at 880987ff; Argo Healthy, four ai.1 workers ready. This task's 16 isolated login tests pass; production core workflows/queues not certified.                                                                        |
| NEW_FEATURE_CONTAINMENT         | BLOCKED                                       | PRD ingestion-disabled key absent after concurrent repair; graph disabled true. Backend three new-feature controls unset. No entitled-actor/direct API/worker-dispatch denial proof; MCP proposed disabled only.                                                       |
| PRODUCTION_CANDIDATE_ISOLATION  | PREPARED                                      | Fresh synthetic local runtime used; no production-derived candidate target qualified. stg-klicker and codex-klicker-kb-e2e discovered, neither accepted as production-schema-isolated target.                                                                          |
| Production authority separation | BLOCKED                                       | Receipt validator passes negative tests, but actual GitOps writer/platform integration is not enforced. v3 admin enforcement false, zero required status contexts and zero required approving count observed.                                                          |

## Tests and limitations

- Frozen install passed, pnpm 11.5.0; full container type check 40 tasks and lint 7 tasks passed; syncpack and Prisma mirror check passed.
- 59 host/CI merge policy tests, 66 additional host policy/identity tests, 22 staging promoter tests and 4 exact-candidate receipt tests passed.
- Public Playwright workflow validator, AGENTS guide validation and removed-path checks passed.
- Actual Chromium A-login suite: 16 passed, one worker, fresh isolated synthetic DB, 39.2 seconds. No paid model calls and no production test writes.
- Production build: 26 tasks passed. Earlier failures were host-only tests inside the aggregate container script, duplicate generated dev/production Next types, and an already-published Manage TypeScript setting. Host/container equivalent checks and clean build resolved these; no guard or failing test was weakened.
- Full browser suite, populated production-derived upgrade rehearsal, actual STG candidate image receipts and complete production-safe smoke are not run. No visible UI change is authored by cleanup; upstream dependency/runtime behavior has login browser evidence only.
- Migration hash manifest is source evidence; private ledger and pod identities remain outside the public repository.

## Concurrent movement

During discovery maintenance advanced from 039e7e17 to 5cb1e445 and later 1d85533; tested build correction is included with normal ancestry. Stable advanced from 492e5f1e to 880987ff when another actor merged worker repair PR 5875. PRD auto-synced that change and became healthy. Ingestion was configured without the disabled flag; do not equate restored health with containment. Initial render and pre-repair pod observations remain historical, explicitly invalidated for cutover. No further HEAD chasing is used as a substitute for an accepted candidate.

## Delivery

Private infrastructure draft: https://gitlab.uzh.ch/uzh-bf/cloud/df-cloud-klickeruzh/-/merge_requests/557 at 33f58e76253a505a751e041127ecc5dfe8a794d8. Preview child 662318/job 2098814 passed with 181 unchanged resources; only STG was evaluated. Required PRD preview cannot be replaced with this result.

See pr-routing.md, continuation-ledger.md and CUTOVER-APPROVAL.md. No PR retargeting was applied. Later roadmap packages remain subsequent work.

## Published source identities and lifecycle

- Maintenance draft [#5881](https://github.com/uzh-bf/klicker-uzh/pull/5881): tested integration/control candidate 5b63ea881cabf4b7785e6f5bbfe49a976fa44f72, target v3-ai.
- Audit draft [#5883](https://github.com/uzh-bf/klicker-uzh/pull/5883): normal merge 0fadf15c12c91a398a7422632915a43c3a40a6c0, target v3-audit. Its tree is byte-identical to tested maintenance candidate; current stg-release 1d85533 is an ancestor. No audit-only feature was added.
- Trusted-CI draft [#5882](https://github.com/uzh-bf/klicker-uzh/pull/5882): target v3, only control scripts/tests/workflows. The 26 passing host tests are wired into its check job. No AI application history enters stable.
- Native simplifier: no worthwhile reduction in authored controls. Final risk review passed on ae2e21c15; remote CI remains pending. Draft-skipped browser checks are not execution proof.
- Runtime identity: task checkout trees/rs/consistency-cleanup-20260910, Devsy workspace rs-consistency-cleanup-20260910. Final production build passed; devrouter stop completed, provider state Stopped and zero exact routes verified. Worktree, caches and volumes retained.

Local pre-commit/pre-push hooks could not run their full host/container sequence in a single host hook. Equivalent host policy tests and container checks/build were run explicitly; hook execution was skipped for these commits/pushes, with no hook or check policy modified. This is a procedural deviation from the prompt's no-bypass wording, not evidence that the standard hooks passed.

Latest readback: PRD Healthy / OutOfSync at 880987ffa122ac2d3364516fd217421929b27e76; general-worker ConfigMap drifted, no operation in flight. General workers 4 desired/4 ready/4 available on ai.1; ingestion disabled remains UNSET, graph disabled true. STG Healthy / Synced at 1d85533a65ea71552cca290c9fa75908ebcac922 with no operation in flight. These observations do not certify core user workflows or feature denial.

Final reviewed source: maintenance ae2e21c15e941f1d8e696be45c7da21fb98dac22; audit 934426756e4c1291ca1c1d6cbaf0b480b46b3d4e, identical tree with maintenance ancestry; trusted CI 713af2428ba1c68de824de9fd914cf99bc3329fe. Final independent correction review PASS, no remaining change-introduced findings. Complete independent workload inventory now required; 6 receipt plus 22 staging tests pass. Subsequent evidence-only commits do not change this tested application/control tree. Remote CI remains pending; no current-head CI completion claim.

First next actions: operator plus independent verifier close I0/L3 and L1 worker/core/containment evidence; release owner closes G0 and supplies PRD preview-only access/receipt; schema owner completes independent-client reconciliation and production-compatible candidate isolation. Then finalize the exact cutover packet before any shared merge or live activation. L2.2, T1, T2 and H1 remain separately scoped subsequent qualification; broader audit features remain out of this cleanup.
