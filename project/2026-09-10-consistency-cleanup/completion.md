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
