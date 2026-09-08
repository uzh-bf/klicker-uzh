# Restore post-integration acceptance checks

## Approval summary

Repair the CI setup failures found after integrating the RAG display changes into `v3-ai`. Restore lecturer MCP disposable-database wiring and OLAT container dependency setup. Reproduce the Chat streaming-scroll and Single Choice editing failures before changing their behavior.

Preserve database safety guards, strict dependency verification, existing chat history and citation contracts. Do not add dependencies, migrations, change deployment configuration, or integrate newer `v3` changes.

The user approved these further fixes. Authority covers local implementation, isolated synthetic verification, ordinary task-branch commits and push, and a reviewed draft PR against `v3-ai`. Merge, protected pushes, deployments, cluster changes, connectivity setup and deletion of retained data remain outside this package.

Completion requires successful focused setup and browser acceptance, independent applicable reviews, and draft publication. Missing required runtime evidence means `delivery_pending`, not acceptance. The main session owns execution and boundary decisions.

## Execution details

### Baseline and evidence

Worktree: `trees/rs/rag-integration-repairs`; branch: `rs/rag-integration-repairs`; target: `v3-ai`. Baseline is `35fec95491ee014e7462a90e9c32e78d7619c9f9`. Remote refs refreshed on September 8; target matches baseline. Default `v3` comparison is 153 ahead and 2 behind; this does not authorize integration.

The MCP workflow resets `klicker-prod` without provisioning the guarded disposable database. OLAT skips installation for mounted host dependencies and fails strict workspace verification. Chat fails its streaming bottom-distance assertion before final sources arrive. Single Choice feedback editing fails before a subsequent persistence test. Browser root causes remain unproven.

### Ownership and verification portfolio

| Slice | Owner | Acceptance and test obligation |
| --- | --- | --- |
| MCP disposable setup | executor | Extend appropriate existing workflow contracts after inspecting them. Preserve guard tests. Verify provisioning order, consistent downstream URLs, failure propagation and helper/init path filters; prove reset, seed, readiness and both smoke commands. |
| OLAT isolated runner | executor, serially after MCP | Preserve strict dependency verification. Repair install/mount seam and launcher status handling. Prove setup success, deliberate test-service failure, correct exit status and cleanup of only the uniquely named disposable Compose project. Extend the stable launcher contract where missing. |
| Browser regressions | main, with existing explore diagnosis | Reproduce ordered Single Choice file using fresh synthetic fixtures; distinguish independent failure from cascade. Preserve Chat bottom-follow, final-source placement and reload/history assertions. Reuse existing behavioral tests; no speculative edits or assertion weakening. |
| Integration and delivery | main | Inspect exact diff and independent checks; complete applicable committed-slice risk review and simplification, then integrated final review before draft publication. |

MCP uses `.github/scripts/provision-disposable-postgres.sh` and retains its `klicker-prod` bootstrap connection. Destructive operations use marked `klicker_test`, with `klicker_test_shadow` where required. No guard changes are allowed.

OLAT must return the `test` service's actual exit status and clean up on failure. It must not stop another runtime. Its workflow skips draft PRs, so draft creation cannot substitute for isolated local execution.

Main retains browser fixes because their root causes are unresolved. Stop the exact task runtime after verification; never use broad cleanup. No external model credentials or real course data are needed.

### Sequence and boundaries

Commit this approved plan separately, then commit each verified repair slice. Use one cohesive CI-unblocking package, not a stack of partial repairs. Missing capability, newly required data access, architecture changes or authority beyond the summary are pause conditions. Routine failing checks continue the approved correction loop.

No product primitive or ADR change is planned: this restores established contracts. A changed product or data contract reopens that decision. Use sliced-development and model-routing skills for ownership and reviews, runtime lifecycle and repository testing skills for actual runtime proof. No new knowledge document is required unless diagnosis reveals a durable non-obvious lesson.

## Review provenance

Planner Newton reviewed the frozen scope in two rounds. Round one requested stronger OLAT exit/cleanup proof, complete MCP wiring protection, explicit local proof despite draft CI skips, and the full ordered browser regression sequence. All four findings were accepted and incorporated. Round two returned `DONE — VERDICT APPROVED`.

Optional cross-provider challenge has not run in this resumed turn; availability remains unverified. Required native gates remain intact.

## Progress

Planning complete; no implementation edits or new runtime checks yet. Existing explorer owns bounded browser diagnosis. Next: executor repairs MCP wiring while main prepares synthetic browser reproduction. Required delivery: reviewed draft PR. Achieved: clean task branch and approved plan. Live staging deployment and post-merge staging acceptance remain unverified and separate.
