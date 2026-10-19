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
- Refresh: current `v3` integrated in progress; conflicts resolved by retaining
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
- Refreshed contract: planner approved. Final integrated review and push pending;
  no new application or paid-provider acceptance claimed.
- Existing [PR #6531](https://github.com/uzh-bf/klicker-uzh/pull/6531) stays open;
  merge and live activation remain separately gated.
