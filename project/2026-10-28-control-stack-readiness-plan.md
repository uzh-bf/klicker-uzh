# Control stack conflict resolution and merge readiness

## Approval summary

The user explicitly requested fixing conflicts on the existing Control stack and making it ready to merge for later staging tests. Preserve the six existing PRs, branch names/order, existing behavior and all authorship/history. This session is the sole published-stack owner. Another session retains native/iPad qualification at a different worktree; its branch, runtime and seventeen local edits are excluded.

Approach: merge the exact current origin/v3-ai target into the bottom branch, then merge each refreshed lower branch into its existing upper branch, bottom-up. This preserves old remote heads as ancestors and avoids a history rewrite. Resolve the demonstrated .devcontainer/post-start.sh conflict at the native-shell layer, preserving target process supervision and the shell's routed native-development origin. Do not rebase or move the checked-out local v3-ai branch owned by another worktree. Checkpoint all original layer refs before cascading updates. Keep the existing native stack object and PR URLs. No new layer, branch deletion, unstack, reorder, merge/queue or deployment.

Authority: source edits/commits, existing task-branch publication, checks/reviews, and readiness are authorized by the current request. No actual merge, deployment, signing/certificate changes, branch deletion, protection bypass, provider reconfiguration, new human review request, or production access. Canonical gh stack push uses explicit force-with-lease guards even for fast-forward updates: prove each old remote head is an ancestor before calling it and refuse any non-fast-forward update. If the provider requires an actual history rewrite, stop that publication branch and request named authority after completing independent work.

Terminal: conflicts cleared against the ultimate target, every layer independently validated at its final head, required CI and final stack AI review settled, remaining human requirements reported, existing PRs marked ready if any are draft, and an exact-head merge-readiness report. This prepares a later staging decision and does not deploy. If external CI/review capability blocks readiness, report the exact unsatisfied gate without claiming ready.

## Execution details

One worktree: trees/control-stack-ready-6540, existing published top branch enhance/control-audience-feedback. Base target snapshot: d786ffbe2b2e5750bdd5c5de7c9da871cbe80580. Native local follow-up at trees/review-control-stack-6539 remains untouched; it is not silently inserted into the published six layers. Main owns all branch navigation, conflict resolution, integration and publication. No competing stack writer or active local layer checkout was found.

Preserve stack order: PR6536 delayed aggregation -> PR6537 Control API -> PR6538 projection sync -> PR6509 Control redesign -> PR6539 iOS shell -> PR6686 audience feedback/embedding removal. All six local tips equal their remote heads. The direct adjacent-parent merges are clean; merge-tree against the ultimate target conflicts only in .devcontainer/post-start.sh at the final two layers. Existing lower checks include canceled runs and Sonar/final-AI gaps; do not infer readiness from the top layer. Current PR6686 is already non-draft and new CI is running on its unchanged old head.

1. Capture layer heads/target and recovery refs; verify metadata/local/remote topology. One independent plan critique before source integration. Keep plan documentation with the implementing stack rather than a new docs-only PR.
2. Merge target and propagate lower heads sequentially using ordinary merge commits without deleting or rewriting original commits. Read each conflict's original intent in all parents; resolve only required semantic regions. Generate any lockfile only with repository tooling if its merge actually needs it; no dependency version upgrades.
3. Run required local checks inside a separate task-owned container, and host browser tests via canonical launcher against only that task runtime when needed. Never rewrite the active iPad runtime's node_modules or reseed its database. Use current installed CLI help and version-matched docs for runtime setup. Keep each layer independently checkable; shared fixes belong in their lowest owning layer.
4. Review exact integration/resolution hunks independently for process lifecycle, routing/security and preservation of source contracts. Reuse unchanged UI/source review evidence where valid; new visible changes require real responsive/locale captures. Run shell syntax, existing post-start/process contracts, type/lint/build and relevant live-quiz/Control checks. No new test solely mirroring a clean merge; extend an existing regression only for a reproduced consequential defect.
5. Before canonical stack publication, re-read remote heads and prove all pushes are fast-forward. Refuse remote movement or changed topology; preserve recovery refs and report any competing writer. Use only stack-aware push, no raw force command, skip-hooks or CI bypass.
6. Read each layer's actual exact-head check results; retry only diagnosed transient terminal failures once, otherwise fix source at the owning layer. Use one supported blocking watcher per run. Request the repository-authorized /final-review-stack only on the verified top after ordinary gates settle; no human review notification. Disposition findings and one focused correction if necessary. Stop the exact task runtime after final checks; preserve the other session's runtime.

## Progress

Current request is the executable approval; no topology change is proposed and no new generic go-ahead is needed. Remote target and initial layer heads are in ignored baseline.json; recovery refs created. No source merge or push yet. Root goal: prepare the published Control stack for merge and later staging tests. Current batch terminal: exact-head conflict-free stack plus truthful readiness. First useful acceptance: native-shell merge against the target is clean with preserved post-start process behavior. Actual blocker: one demonstrated post-start conflict plus CI/review gates to resolve. Remaining local iPad application work belongs to its existing owner.

## Independent critique and dispositions

Claude Opus 5.5 via the configured council CLI failed before returning a review. The single AGY Gemini 3.8 Flash high fallback timed out without a schema result. The ordered GLM 5.3 Flash max fallback returned a complete read-only plan critique. Accepted its three checks: re-read the exact target before cascading and publication; bind every counted CI check to each new layer head; and actually merge and verify the final audience-feedback layer after resolving the native-shell layer. No topology or product decision changed.

The target was reverified as d786ffbe2b2e5750bdd5c5de7c9da871cbe80580 and all six remote heads matched the baseline immediately before the bottom merge. If the target moves again, record a new readiness blocker and revalidate the affected content instead of claiming currency from the earlier snapshot. Required checks must succeed on each new head; classify workflow-authorized skipped jobs separately from missing, canceled or failing required checks.

## Local verification constraint

The separate task runtime has not started. Free blob port 10023 avoids the other runtimes' bindings, but Docker reports all predefined address pools fully subnetted. No network, retained runtime, certificate or provider configuration has been removed or changed. Devrouter also reports unavailable capacity-ledger history and incomplete route evidence. These are host runtime blockers, not source failures. Preserve normal hooks and source publication gates; never bypass them to work around capacity.

## Readiness refresh and current blocker

The next remote-state refresh resolved v3-ai to 6243cf0d437fb94375a8e6536369e9f3fac096aa, twenty commits beyond the original snapshot. All six virtual merges were rechecked: the lower four remain clean; the same single post-start conflict remains at the final two layers. The prepared resolution is byte-identical against the newer target. The pending bottom merge still records the earlier snapshot and must be brought current before any readiness claim. No published layer head has moved.

The isolated host tooling is installed from the frozen lockfile. All 111 hook/profile/host-launcher contract tests pass with Node 24 and a compatible explicit host Devrouter executable; the profile shell contract passes too. This fixes the earlier missing-tooling/old-binary test failures and does not qualify application builds or browser tests.

The user-approved retained-runtime cleanup was attempted canonically and removed nothing. The second, corrected invocation is blocked by a missing retained generated Compose feature file. All original containers/network/volumes and the separate native worktree remain intact. The main session requested a specific manual-cleanup exception; no fallback mutation proceeds without that ruling.

The prepared startup conflict resolution passed an independent read-only component review with no actionable findings. This is focused source-preservation evidence only. Seven additional dependency-mount tests pass, bringing the host contract total to 118 plus the profile shell contract. The manual cleanup exception remains pending; the approved canonical removal failed twice before any resource removal.

## Approved local-runtime recovery completed

The user approved exact manual deletion of the stopped PR6677 containers/private network after canonical teardown failed. That deletion succeeded: all 53 volumes, source and branch were retained; its provider registration remains stale. The user separately approved recovery of only the failed readiness task registration. Devsy removed that registration, canonical stop completed, and the exact task runtime is now executing its initial bootstrap/build on the freed subnet with blob port 10023. No journal file was manually edited; the separate iPad worktree retains its same seventeen edits/diff digest and seven routes.

The latest target is 3d6a945b83ff05e8afa3e1ece86ead3576af3ed7. Refresh merge simulation before publication; the pending bottom merge still has the original target parent and will need a source-preserving refresh after its first validated commit. No Git head has been published by this task.

## Current terminal capability blocker

The exact approved manual cleanup succeeded and all prior volumes/source were preserved. Task-only registration recovery also succeeded. The isolated provider bootstrap/build and five local readiness probes passed, but devrouter rejected the candidate at route publication with `Retained stop generation changed. Candidate runtime was rolled back.` The supported guard stops dependent hooks/publication; no bypass, tooling change or journal edit is authorized. Canonical stop is finalizing the task environment. No source commit or published head changed. See the ignored runtime-cleanup-and-recovery-result.md and producing-run logs for exact local evidence and retained resources.

## Lifecycle diagnosis and correction

The user requested proceeding with repair of the generation mismatch. The old CLI captured an own hostPortDeclarationsSha256 property with value undefined when no managed host-port declaration exists; validation omitted that property on persistence, making its later deep comparison fail. An already-built corrected CLI conditionally omits the property before capture. A frozen task-local copy is being used with its existing pinned dependencies, preserving the same ownership/generation checks and changing no global installation, runtime policy or journal files manually. A synthetic round-trip reproduces the old mismatch and verifies the corrected shape still rejects a changed source.

## Current source integration and validated feedback corrections

The first hook's 42 typecheck tasks passed. A separately launched utility regression passed all five cases but overlapped a formatter dispatch, which the lifecycle controller correctly rejected. No commit was made. With the plan preserved and no user/unstaged changes, the clean pending merge was replaced by a direct merge of the recorded current target 3d6a945b83ff05e8afa3e1ece86ead3576af3ed7. Runtime commands now run strictly sequentially.

The read-only feedback triage rejected the invalid GraphQL-list warning, already-filtered-block complaint and null-chart warning, and kept speculative WS/style work advisory. Valid corrections will stay in existing owning layers: failed delayed aggregation must reject before cache expiry, with benign reactivation skips; feedback data must match the current quiz; post-save refresh failure must not report mutation failure; the feedback window needs the missing compound index. The focused aggregation regression file is packages/graphql/test/liveQuizBlockAggregation.test.ts. The top layer may add one tool-generated ConfusionTimestep(liveQuizId, createdAt) index migration and the existing mirrored schema, without relation or API changes. Regression/browser evidence and independent code review are required for these corrections.

## Integrated local state

The lower five layers are committed at target 3d6a945b83ff05e8afa3e1ece86ead3576af3ed7. Every original remote tip remains an ancestor; normal hooks passed independently at each layer. The top is merged in the index with feedback identity/refetch corrections and one generated compound-index migration; no published branch has moved. Thirteen focused GraphQL tests and five utility aggregation tests pass. The index was generated by installed Prisma schema diff and applied/verified only on the guarded disposable task database.

Canonical host browser preparation exposed an inherited dev:test liveness mismatch: the post-start worker guard accepts compiled node workers, while dev:test runs tsx source workers. Both workers connected, but the strict startup proof correctly rejects that process shape. Use the supported --ci-runtime path for production-build qualification; do not weaken liveness or silently count the failed launch as a browser pass. The independent integrated review is checking immutable top tree 5f9b978a31cd69058a8b22abd2efc1a0e0b0b52e and all lower layer ranges. Remote v3-ai reverified unchanged.
