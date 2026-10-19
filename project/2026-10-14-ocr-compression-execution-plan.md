# OCR compression execution repair

## Approval summary

This package repairs compression churn and oversized rendered review groups in
OCR 1.13.0. The compressor currently appends summaries to the immutable review
prompt and retains history without reserving that prompt's context cost. Keep
original instructions intact, maintain one compressible rolling summary, include
evicted tool evidence in the next summary and split oversized rendered groups
without excluding selected files.

Build the patched executable from immutable upstream source with its existing
Go 1.26.9 toolchain and dependency checksums. Verify the source archive, apply
only the checked-in patch, run the affected race tests, and record source, patch
and executable provenance. Fail closed rather than fall back to an unpatched
binary. Installer and patch changes invalidate earlier review-policy evidence.

The October 19 refresh integrates current `v3` into the existing PR and preserves
its current models, maximum reasoning, 200,000-token prompt ceiling, 16,384-token
completion cap, manual concurrency two, billable token accounting, ten-million
individual range ceiling, stack ceilings, deadlines, retry/resume rules and full
coverage requirements. Current context, cache, live-progress, cost and advisor
changes remain intact. Draft reviews retain their existing released executable;
the patched executable is used only by manual individual and stack jobs.

The user authorized refreshing the existing PR: integrate, resolve conflicts,
correct stale documentation and verified feedback, run offline qualification and
configured reviews, commit, push and update the PR description. It is already
ready; retain that state. This refresh grants no merge, deployment, settings,
review-thread messages, new monitor or paid review replay. Completion is a
reviewed source refresh published to the same PR with precise verification and
pending hosted gates. Live complete-review acceptance remains post-merge work
requiring its own authority and exact-head prerequisites.

## Execution details

Approval mode: executable batch. Execution mode: standard (exact runtime model
identity unavailable). One cohesive existing full-path package in `project/`.
Worktree `trees/final-review-compression`; branch `rs/final-review-compression`.
Target `v3`; refresh target `8b37dd56368f0edfd7b1ea06431c3d0816a20c79`.
Original repair head `102094bda85c0c8820dc3f7cb05cf1ed9e0cdc5b`.

### Binding contracts

- Pin upstream `1672852136fc87748249d22bce0819f33419ea79` and the verified
  archive; preserve the license. Upstream 1.13.1 has identical compression source
  but other semantic changes, so upgrading it is outside this refresh.
- Preserve original system/user messages, one rolling summary in compressible
  history, intact recent assistant/tool rounds, and evicted calls/results in the
  next summarization input. Empty or failed compression preserves history;
  oversized summaries fail without discarding unsummarized evidence.
- Reserve frozen prompt and summary tokens, retaining whole rounds within half
  the remaining warning budget. Split multi-file groups by deterministic halves
  before dispatch using rendered rules, plan wrappers and existing maximum plan
  output reservations. Keep each selected path exactly once; oversized singletons
  still fail. No change to the reviewed algorithm patch is planned.
- Bound download to two minutes, individual checks/extraction/patching to thirty
  seconds, race tests and build to ten minutes each, and installer steps to
  twenty-five minutes. Run one existing 200,000-token offline preview per manual
  attempt, as current `v3` requires. Earlier two-preview instructions are retired.
- Preserve current final-review evidence identity, PR/plan context and diagnostics.
  Add the installer and patch to policy identity; do not restore older fields or
  settings when resolving conflicts. Existing advisor tooling is independent.

### Ownership and verification

Main owns integration, conflicts, trust/provenance decisions, tests, documentation
and Git/PR effects. A read-only explorer verifies the old feedback against source;
no competing writer owns these paths. The algorithm remains tightly coupled to
its immutable patch and installer, so implementation stays with main.

Reuse earlier planner and algorithm-review evidence while the patch is unchanged;
review the refreshed integrated range after verification. The existing source,
workflow, qualification and mock-provider tests are the acceptance seams. Extend
only consequential provenance or integration regressions where current tests
leave a real gap; do not pin documentation or incidental strings.

Run affected upstream `llmloop` and `agent` race suites plus the actual installer
in a disposable existing build image. Re-run repository review/stack/adapter,
workflow-gate, updater and direct-invocation checks. Verify current prompt,
concurrency, budget and accounting settings against target source. Use native
formatting, syntax, diff and staged secret/data checks. No application runtime,
UI or screenshot work applies. No DevPod/devrouter runtime is required.

The prior synthetic five-file experiment completed all files with eighteen main
turns both before and after. Requests fell from 48 to 29, compression requests
from 29 to 10 and simulated adapter tokens from 950,694 to 614,024. These are
historical offline measurements with an unchanged engine patch; they do not
establish current live savings or complete provider review acceptance.

## Progress

- Original implementation: four repair commits, historical exact-head CI passed.
  Earlier plan and independent algorithm review remain evidence for the unchanged
  patch. Previous temporary monitor expired; no monitor is claimed active.
- Refresh: current `v3` integrated and pushed; conflicts resolved by retaining
  both current policy tests and the installer/patch invalidation cases, plus the
  current CI guide and compression-engine guidance.
- Initial refreshed integration check: 151 tests passed, zero failures.
- Fresh verification: 286 host checks passed with one optional binary skip;
  the actual patched executable then passed all six keyless runner tests in a
  network-disabled container. Both affected upstream Go race suites and the
  actual installer/build/provenance check passed. The patch digest is unchanged.
- Formatting, syntax and diff checks pass. Two pre-existing advisory Biome errors
  remain in unchanged helper callbacks; scoped Opengrep found no findings but
  partially analyzed the large existing helper. Staged Gitleaks passed.
- Refreshed contract: planner approved. Independent integrated final review
  passed on refresh commit `10295e6830`; no qualifying findings. Source and
  verification remain unchanged by this progress update. Hosted CI is pending;
  no new application or paid-provider acceptance claimed.
- Existing [PR #6531](https://github.com/uzh-bf/klicker-uzh/pull/6531) stays open;
  merge and live activation remain separately gated.


## Compression telemetry follow-up

### Approval summary

The user approved adding sanitized compression counts and estimated context sizes,
qualifying the new telemetry offline, and checking it during the next normal
substantive review. This follow-up exposes compression activity without changing
its algorithm, thresholds, prompts, file selection, model, reasoning, budgets,
accounting, deadlines, retries or resume behavior. The patched engine emits fixed
compression lifecycle records containing only outcome labels and nonnegative
estimates. The adapter validates those records before live-log output, retains
bounded aggregate counters in existing diagnostics, and prints an explicit
compression summary alongside cost reporting. Missing telemetry remains unknown;
draft released binaries are not represented as instrumented.

Verification uses the existing repeated-compression Go tests, adapter tests and
synthetic mock-provider stress experiment. It checks immutable instructions,
rolling evidence, complete coverage, accurate totals, malformed-log rejection and
unchanged process/usage results. Telemetry write failures remain informational.
No application runtime or paid replay is required. Draft PR delivery is authorized;
merge, readiness and a new paid canary remain separate actions. Post-merge live
qualification should accompany the next normal substantive review. The three
findings from the previous live canary are triaged read-only; their application
fixes belong to their owning PR, outside this telemetry source change.

### Execution details

Approval mode: executable batch. Execution mode: standard (exact main model ID
is unavailable). Reuse trees/final-review-compression on branch
rs/ocr-compression-telemetry from v3 e8aa3c94579b42f8f54f8a6a1a69a6e5f48187dc.
Continue this existing plan in project/; no new root or plan file.

Ownership: main owns engine instrumentation and adapter integration, verification,
Git/PR effects and final proof. These coupled producer/parser/receipt semantics
remain main-owned. One read-only explore child triages the three public canary
findings independently. A planner hardens this derived scope, the simplifier and
risk reviewer inspect the committed telemetry range, and configured integrated
final review follows local checks.

Test portfolio:
- Extend existing upstream compression tests for exact lifecycle outcomes and
  before/after estimates, repeated summaries and silent disabled/no-work paths.
- Extend existing adapter progress/summary/runner tests for strict bounded parsing,
  secret sentinel rejection, complete/unknown receipt labeling, sink failure and
  unchanged child exit/usage. No extra content-pinning tests.
- Reuse the existing synthetic provider stress fixture and actual installer for
  repeated compression and full selected-file coverage; record offline estimates
  as synthetic, never provider pricing or live savings.

One implementation slice: .github/open-code-review/ocr-compression.patch,
.github/scripts/ocr-mistral-adapter.cjs and its existing test file,
docs/ci-and-deployment.md, plus this plan's progress. Touch the installer only if
its existing patch-derived version identity needs a verified correction; no new
module or dependency is planned. The existing installer reruns affected Go race
suites and rebuilds provenance using the changed patch digest.

Acceptance: keyless Go race suites and real patched executable stress pass; valid
telemetry reaches filtered live logs and seven-day diagnostics with correct
counts and estimates, malformed/untrusted strings are suppressed, unknown remains
unknown, all selected files complete, and settings/accounting/retry diffs are zero.
Native formatting/syntax/hygiene/secret checks, exact diff review and configured
reviews precede ordinary push and one draft PR against v3. No application runtime,
UI change or screenshot applies.

### Progress

- Remote-state gate passed; primary clean, task branch starts at current v3.
- Main is settling the fixed telemetry protocol and existing receipt seam.
- Canary triage owner: explore child Archimedes, immutable canary head
  523e085b61f68fffdee4af22f506435058a2f6c7; no application writes.
- Next: planner, one telemetry slice, local qualification, reviews and draft PR.


### Telemetry protocol and receipt contract

Fixed producer records: a version-one marker when the runner is constructed;
started plus the input context estimate immediately before each eligible
compression request; finished with outcome rebuilt, unchanged, failed or
cancelled and the input/returned-snapshot estimates. Disabled/no-work paths do
not create attempts. A rebuilt background snapshot can be superseded or discarded;
these are computation counters, never application or savings claims. Each finish
record is self-contained and concurrent attempts aggregate without path IDs.

The parser accepts only anchored records with bounded safe nonnegative integers
and fixed enums. It marks malformed fixed-prefix records, counter overflow,
unfinished starts and truncated stderr unavailable/incomplete. A version marker,
fully drained stream and balanced lifecycle establish zero or complete observed
telemetry; absent markers (including released draft binaries) remain unknown.
Context estimates sum only rebuilt input/returned snapshots and are labelled as
snapshot estimates, separate from usage, billable tokens and USD. Mixed adapter
lifetimes report unavailable unless every expected row has valid complete
compression telemetry; this never changes cost completeness or publication.

For commandRun only, capture the settled usage snapshot in onClose and persist it
exactly once after bounded stderr drain and progress finalization, including
configuration/spawn failure and signal cleanup. Preserve serve/stop persistence
before listener closure, all shutdown bounds and exit behavior.

Delegation Map: main owns the single telemetry implementation and its producer,
parser, runner-receipt and summary tests; gate dependency is planner approval,
acceptance is the stated keyless suites and source/settings checks. Explore owns
the independent read-only canary triage. The configured simplifier, risk reviewer
and final reviewer own their immutable committed-range passes. Stop at reviewed
ordinary push and draft PR; record live proof as pending the next normal review.

Verification fixture: /private/tmp/olat-efficiency-compression-probe.cjs, existing
five-file synthetic provider. Run in the existing disposable build image with
network disabled, OLAT_PROBE_ADAPTER pointing to this adapter and
OLAT_PROBE_BINARY pointing to the freshly built patched executable, using
node <fixture> --max-tokens 4000. Adapt only its private harness to collect the
new progress records and compare attempts with actual synthetic summarization
calls. No new repository fixture/module is needed. Run actual installer/races
first; then the existing focused native runner contract and synthetic experiment.
Test obligations are extend existing for upstream compression lifecycle, parser
privacy, aggregate consistency/unknown states, runner late-stderr/signal/drain
cleanup and heartbeat behavior; none for prose or provenance wording. Existing
coverage and usage invariants remain the stress experiment's assertions.

Planner round one: REVISE; accepted all four concrete findings. This section
defines snapshot outcomes, explicit receipt ordering, incomplete-telemetry cases,
ownership and the existing fixture. Installer changes remain unnecessary.

Planner round two: APPROVED. Proceed with the approved telemetry slice.
