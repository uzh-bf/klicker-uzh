# Preserve incomplete flashcard publication through explicit lifecycle transitions

## Approval summary

A lecturer can explicitly publish the usable part of an incomplete flashcard
bank. Today its database claim, dispatch correlation and recovery after a
rejected dispatch live in different modules. The existing tests verify mocked
redispatch and uncertain-dispatch recovery, but do not establish database
fencing under concurrent publication requests or a superseded attempt.

This package groups those three existing writes in one flashcard publication
lifecycle module and proves their current behavior with a disposable database.
The extraction preserves every predicate, field update, error and caller
response. Provider calls stay with orchestration. Publication still requires
explicit acknowledgement and does not create, settle or release spend. The
existing outer synchronization error handler has a narrower fence than the
correlation write; tests will characterize that distinction without changing it.

No new product behavior, schema, dependency, provider request policy,
cancellation, expiry, retry accounting or ordinary Element save behavior is
proposed. A stale local write can lose its fence after a provider effect;
this package does not promise exactly-once provider execution.

Approval authorizes the extraction, synthetic database tests in an independent
disposable task runtime, native checks, required reviews, local commits,
ordinary task-branch push and a draft PR against v3-ai. Completion means the
three writers have one owner, existing behavior and race outcomes are tested,
and the exact runtime is stopped. Merge, deployment, retained database reset
and worktree deletion remain separate actions. A discovered behavior defect
or required policy change pauses this plan before changing that contract.

## Execution details

### Baseline and scope

Base: origin/v3-ai at c939ab348a67f1ffa4db5e97f9da3b3bf2e8d6da.
Worktree: trees/rs/flashcard-publication-transitions.
Branch: rs/flashcard-publication-transitions. Draft PR target: v3-ai.
This is the next bounded generation portion of W4 — lifecycle services in
project/2026-09-03-v3-ai-pre-release-improvement-roadmap.md on the roadmap
owner branch rs/v3-ai-production-readiness. The main consolidation session
owns boundary reconciliation. KB/KG, response-example, participant-practice
and release work retain their existing owners.

The previous packages delivered leases, initial completion and start-failure
ordering. This package owns a distinct explicit-publication transition group;
it does not reopen their helpers or add another general lifecycle abstraction.
ADR 0017 keeps publication events on the existing build without new spend.

| Current writer | Contract to retain |
| --- | --- |
| flashcardGenerationPersistence.ts:claimIncompleteFlashcardPublication | Owned build in AWAITING_INCOMPLETE_PUBLICATION only; atomically moves to PUBLISHING_INCOMPLETE, records actor/time and fresh dispatch attempt, clears old event/run correlation. A miss throws CONCURRENT_MODIFICATION. |
| flashcardGeneration.ts:dispatchIncompletePublication rejection branch | Reset only matching owner, PUBLISHING_INCOMPLETE status, lease token and dispatch attempt with both event and run absent. Clear publication actor/time/attempt and return to awaiting. Preserve its silent no-op behavior on a miss. |
| flashcardGeneration.ts:dispatchIncompletePublication correlation write | Match owner, publishing status, token and dispatch attempt. Persist event or recovered run and synchronized time. A miss throws CONCURRENT_MODIFICATION. |

Move only these writes to packages/graphql/src/services/flashcardPublicationLifecycle.ts.
Choose direct named functions for claim, undispatched recovery and correlation;
accept only the data needed for their existing predicates and updates. Keep
claim's random UUID and timestamp generation semantics. Preserve the current
callers' error propagation and getFlashcardGenerationBuild return behavior.
The acknowledgement, owned-build lookup, entitlement and pinned start-manifest
checks stay in publishIncompleteFlashcardGeneration. The provider search,
dispatch and uncertain-result classification stay in dispatchIncompletePublication.
Check all imports/callers before removing the old exported claim; do not add
compatibility wrappers when no caller needs one. Keep saveGeneratedFlashcards
and the remaining synchronization writers unchanged.

### Delegation Map and sequence

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| 1 — characterize and extract publication transitions | executor | Main provisions and proves the independent disposable runtime first. | Existing mocked orchestration tests plus real-database claim/fence matrix pass before and after the mechanical extraction; exact diff preserves contracts. |
| 2 — integrate and deliver the reviewed package | main | Accepted executor output and required slice reviews. | Native checks, required simplifier and risk review, integrated final review, draft PR readback and runtime shutdown evidence. |

Main retains architecture, provider/data boundaries and publication authority.
The executor owns the new lifecycle module, the two existing callers and
packages/graphql/test/flashcardPublicationLifecycle.integration.test.ts,
plus only necessary behavior assertions in questionGenerationLifecycle.test.ts.
No worker delegates or publishes. Main owns the coupled finish because its
external actions and review integration cannot be delegated to the writer.

### Verification

Use the existing real Prisma disposable-client and guarded database patterns.
Before any database mutation, main provisions the exact independent task
runtime through devrouter and proves the restricted login and marked database.
Use test-owned synthetic records and owner-scoped cleanup. Reuse existing
accounting fixture helpers; mock only external runtime/configuration seams.
No production test switches, exported private orchestration or mock endpoints.

Characterize the existing public publication entrypoint and its recovery path
before moving writes. Test at least: one winner for two concurrent claims;
foreign owner and wrong status rejected; exact actor and fresh attempt stored;
definitive undispatched failure restores awaiting and clears only the existing
fields; known event/run prevents that reset; uncertain dispatch keeps the same
attempt; recovered run correlates to that attempt; token/attempt/status/owner
changes reject correlation and prevent recovery from overwriting the newer
state. Include post-acquisition races with barriers before the conditional SQL
write; initial authorization rejection cannot stand in for stale-writer proof.
A correlation miss throws CONCURRENT_MODIFICATION, but the public polling
path catches it and can write FAILED using only build id and lease token.
When owner, status or attempt changes while the token stays the same, record
both the rejected correlation and this existing outer failure result. A
replacement token blocks both writes. Do not assert that every correlation
miss leaves the whole build unchanged, and pause before changing this policy.

Reach the uncertain-dispatch correlation branch with two unsuccessful run
searches, a WORKFLOW_DISPATCH_UNCERTAIN publication error, then a third search
returning the recovered run, matching the existing lifecycle test. A run found
immediately takes a separate synchronization writer outside this extraction.
To test known event/run protection on reset, introduce correlation after
dispatch begins and before reset SQL; prepopulating it may bypass dispatch.

Assert drafts, spend records and quota remain unchanged through publication
claim/recovery/correlation. This is not an accounting release path.

Each barrier releases independently of the blocked writer, uses bounded cleanup
and treats timeout as harness failure. Test through public orchestration when
it observes a consequential external effect; use direct transition calls for
remaining database predicate combinations after the extraction. Keep tests
behavioral and small; retain existing redispatch and uncertain-recovery cases
instead of reproducing them in another mocked suite. Record baseline and
post-extraction commands/results separately, without committing a broken state.

Confirm finite Vitest selection with list --filesOnly; invoke the GraphQL test
script with filenames and no extra --. Run the new suite and existing lifecycle,
lease, dispatch, accounting and start-failure suites where affected. Generate
GraphQL and verify the public SDL remains unchanged, then run package checks,
formatting/lint and the repository-required build/checks. Node/pnpm/Prisma run
inside the exact container; host-only validators and Git remain on the host.
Serialize generation/build commands to avoid inconsistent generated output.
Browser verification is inapplicable: no frontend, GraphQL operation or auth
contract changes. No live provider call is needed.

Full-path review applies because publication fencing crosses a cross-system
seam. Commit the cohesive source/test slice; run simplifier and slice-reviewer
in parallel, then disposition their findings and rerun affected checks. Stop
the exact runtime and prove provider Stopped and zero source-matched routes.
Run one integrated final reviewer on the complete committed package. Publish
an ordinary draft PR with accurate local/hosted evidence and reconcile the
roadmap boundary. Runtime startup failure or a newly discovered non-equivalent
transition outcome pauses execution; do not reset retained data to recover.

## Progress

2026-09-08: [PR #5845 — generation failure ordering](https://github.com/uzh-bf/klicker-uzh/pull/5845) merged into v3-ai. The main session appended the merge
receipt to the existing roadmap while preserving its earlier uncommitted
progress. A delegated inventory did not return a usable artifact after a
bounded stop request and was cancelled; no findings were accepted from it.
Main inspected the publication writers, entrypoint and existing test references
at the recorded baseline. No application code changed or runtime started.
This draft awaits native planner review and then human implementation approval.

Planning review round 1: REVISE. Main accepted all three findings after
checking the outer catch and existing uncertain-recovery test: distinguish
transition and caller outcomes, make branch reachability explicit, and name
Delegation Map dependencies. Round 2 reviews those corrections. The optional
AGY rival remains unavailable from the prior headless read_file permission
denial; this is not recorded as a passed review.

Native planner round 2: APPROVED with no remaining findings. The plan is
technically reviewed; human implementation approval remains pending.

2026-09-09: User approved implementation through checks, reviews and draft PR.
Remote refs refreshed; task HEAD equals origin/v3-ai at c939ab348a. Main owns
independent runtime provisioning and identity proof; executor owns the bounded
characterization and extraction after that prerequisite. No target integration
is needed. The two prior planner rounds remain applicable.

Runtime provisioning succeeded for this exact task checkout with manage profile,
healthy base services and zero drift. The real createDisposableTestPrismaClient
probe returned DISPOSABLE_DATABASE_IDENTITY_VERIFIED. The approved executor
now owns baseline characterization and extraction. Runtime commands are
serialized; main will run broader checks after the executor returns.

### Characterization and extraction — 2026-09-09

The executor supplied a useful initial database fixture but returned the
remaining work incomplete. Main took ownership, corrected package-relative
suite selection, and expanded the finite matrix. All 18 real-database cases
passed on unchanged production source before extraction. Three initial failures
were fixture cleanup ordering after owner transfer; deleting both synthetic
owners in one scoped operation resolved them. No production fix was needed.

The three existing writes now live in flashcardPublicationLifecycle.ts.
Predicates, fields, UUID/time generation, error propagation and outer catch
remain unchanged. The six-suite focused portfolio passes 75 tests. Root
checks pass all 40 typecheck tasks plus lint, Syncpack and policy checks;
98 host validator/identity tests pass. All 26 builds pass. Test-only assertion
refinements cover stale correlation clearing and explicit caller results.
Public SDL and schemas remain unchanged. Reviews and publication are pending.

Native simplifier and data-integrity slice reviewer both returned no findings
on c939ab348a..cfc2a85011. Main verified the exact predicates, fields and caller
wiring; no source correction was required. Runtime rs-flashcard-publication-transit
is Stopped in Devsy, matched to this exact source path; devrouter reports zero
routes. The installed provider is Devsy, so its workspace list/status replaces
the unavailable legacy devpod CLI. Final review and draft publication remain.

### Draft delivery — 2026-09-09

[PR #5849 — incomplete flashcard publication transitions](https://github.com/uzh-bf/klicker-uzh/pull/5849)
is published as a draft targeting v3-ai. Native integrated final review passed
without findings on c939ab348a..73b6d5608b. The final metadata update only
records delivery and renames this plan; source verification remains applicable.
All approved implementation and local verification steps are complete. Hosted
CI and human review remain merge gates. No ready conversion, merge, deployment
or runtime/data deletion occurred. The wider lifecycle roadmap remains partial.
