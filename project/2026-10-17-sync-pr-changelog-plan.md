# Deterministic changelogs for maintained sync PRs

## Approval summary

The maintained forward-sync PRs currently start with boilerplate and retain later human or agent rewrites. Replace their entire description with a controller-owned changelog generated from the exact target, source and sync-head commits. The body will contain revision links, the subjects and links of imported commits, and a file-level record of merge resolutions and additional sync-branch commits. Commit subjects remain existing Git metadata; the automation will neither paraphrase them nor request model output.

Refresh descriptions when the source, target or sync head changes. The next maintenance run will replace existing descriptions, including prose and screenshot sections. Report discussion and verification in chat, existing checks, or separately authorized PR comments. Document that agents leave maintained sync-PR bodies to the controller; this adds no messaging authority.

Conflict summaries will use Git's remerge diff for two-parent merges and ordinary diffs for separate sync-branch fixes. These identify affected paths and commits; they cannot explain intent. Additional sync-branch commits will be identified separately because ancestry alone cannot prove they fix conflicts. Unsupported merge shapes or missing evidence will be reported explicitly.

Approval starts one finite source-change package: implement, verify, commit, push the task branch and open a draft PR into v3, then finish the configured source reviews and CI monitoring. Merging, marking ready, dispatching a writing workflow and rewriting currently open sync PRs before this controller reaches v3 remain separate actions. Delivery ends with the reviewed draft and its check results, with activation still pending the merge.

## Execution details

### Working context and authority

- Repository: /Users/rschlae/Git/klicker/klicker-uzh.
- Worktree: /Users/rschlae/Git/klicker/klicker-uzh/trees/sync-pr-changelog.
- Branch: enhance/sync-pr-changelog; target: v3, selected by repository instructions and origin/HEAD.
- Baseline: origin/v3 at 0f222786e86c625c7bfbff594a952de770d15ac5 after git fetch --prune on 2026-10-17. The untouched primary checkout is on v3-ai, 72 commits behind its upstream and 517 ahead / 34 behind origin/v3; it is not the implementation baseline.
- Artifact root: project/, the existing repository root for execution artifacts. Plan: project/2026-10-17-sync-pr-changelog-plan.md. Delivery: [draft PR #6584](https://github.com/uzh-bf/klicker-uzh/pull/6584) into v3.
- Execution mode: standard; the runtime identifies GPT-6 without an allowlisted exact model ID.
- Approval mode: executable batch. Boundary owner: main session.
- Authority: reversible preparation is authorized. Plan approval authorizes the complete implementation, ordinary task-branch delivery, configured reviews, draft PR and its CI monitoring on the existing remote.
- Terminal: coherent reviewed draft PR against v3; focused verification and applicable hosted checks settled or a concrete capability blocker documented. Activation requires merging the controller into v3.
- Pause: a material authority, data, cost or behavior change; a necessary source-history rewrite; or an exhausted required review route. Ordinary check failures and reviewer corrections remain inside the package.
- Preserve the three configured forward pairs and the existing branch advancement, conflict notices, draft/ready controls, merge and ancestry policies. Special ancestry-restoration PRs are a separate recovery workflow and retain their current operation.

### Evidence and contract

The implementation extends .github/scripts/draft-sync-prs.cjs and .github/workflows/maintain-draft-sync-prs.yml. The current controller creates prose once and never updates bodies. Its workflow runs trusted default-branch code after source push checks; it currently misses conflict-fix updates on sync branches and changes to target-only branches.

No application product primitive changes. The affected surface is repository automation and its description ownership contract. A dedicated domain object or ADR would add no useful decision beyond the local controller contract; no ADR is planned.

The new body is a fixed-format Markdown changelog with these data sections:

1. Revisions: immutable target, source and actual sync-head SHAs and comparison links. If the source tip is absent from the sync head, show that as a structured pending-source status.
2. Imported commits: every commit reachable from both the source snapshot and actual sync head, absent from the target snapshot, ordered deterministically by Git topology. Use existing subjects verbatim with safe Markdown escaping and commit links; do not infer PR associations from ambiguous metadata.
3. Merge edits: sync-only two-parent merges with nonempty remerge diffs, linked to the merge and listing affected paths. This is the difference from Git's automatic merge, including conflict resolution and other recorded merge edits; it does not prove intent. Empty remerge diffs add no entry. Octopus merges are explicitly marked unsupported for automatic resolution analysis.
4. Additional sync-branch changes: non-merge commits reachable from the sync head but neither source nor target, with subjects, links and changed paths. Avoid claiming that every such change resolved a conflict.

Take source and target snapshots once per reconciliation and refresh the actual sync-head SHA after advancing or merging the source. Imported commits are (ancestors(source) intersect ancestors(head)) minus ancestors(target). Sync-only commits are ancestors(head) minus the union of ancestors(source) and ancestors(target). Enumerate complete ancestry sets, including multiple merge bases; never use only the first API page or the source branch's first-parent history. Exclude target-only history. A source merge blocked by conflicts must not list absent source commits as imported.

Generate identical bytes for identical snapshots and Git version: no wall-clock timestamps, model calls, new prose, author identities or manual body sections. Reconcile existing and newly created PRs, including the duplicate-create recovery path. Update only when bytes differ and never change readiness. Before every body create or update, revalidate the open PR (when it exists), same-repository head and base identities, head ref and SHA, base ref, and current target branch SHA against the analyzed snapshots. Apply this to existing PRs and duplicate-create recovery; before creation revalidate the intended head and target branch snapshots. Defer closed, retargeted or moved candidates. GitHub exposes no atomic body-write lease against ref movement; a later normal maintenance run reconciles movement after the final read.

Cap the UTF-8 body at 60,000 bytes. Reserve revision links and omission records first, then fill one budget in fixed priority order: merge edits, additional changes, imported commits. Keep the displayed section order above. Render entries in deterministic order; omit an entry as a unit when it cannot fit, count all omitted commits and paths, and retain immutable comparison links. Unicode is counted after rendering; do not silently hide entries. Treat subjects and paths as untrusted text: render them as code spans with backtick-run-safe delimiters, neutralizing markup, mentions and issue cross-references; encode links, pass validated SHAs as Git arguments and never evaluate data as code.

Preserve branch advancement and the existing conflict notice before attempting an existing PR's body analysis. On analysis failure, retain its existing body, report a per-pair description error, continue independent pairs, and fail the workflow summary. For a new PR, analysis must succeed before creation; do not publish an unavailable or apparently complete placeholder. A later ordinary run retries naturally. Verify that the controller's own synchronize/check completion bounce converges with zero writes on the unchanged second reconciliation.

### Research and verification constraints

Git documentation confirms that remerge diff compares a reconstructed automatic two-parent merge with the recorded merge. It reports a delta, not semantic intent, and is empty for an unchanged clean merge:
- https://github.com/git/htmldocs/blob/gh-pages/diff-options.adoc
- https://github.com/git/htmldocs/blob/gh-pages/git-range-diff.html

A read-only check on an existing sync merge confirmed that --remerge-diff --name-only can isolate its recorded resolution paths. Use paths and commit links in the description; omit remerge insertion/deletion counts because conflict-marker removal can inflate them.

Fetch complete commit history for exact source, target and sync-head snapshots into one shared disposable bare Git analysis repository per controller run, retaining the trusted controller checkout. Use blob filtering with a controlled promisor remote and prove remerge-required objects can be fetched lazily. Measure the exact-SHA filtered path before wiring the workflow; retain the five-minute job budget only when that evidence supports it. Avoid a full-blob comparison download merely to measure it.

Execute only trusted scripts; never check out or execute code from fetched refs. Use the existing read token for history reads through scoped environment-based authentication; suppress credentials from output. Use an explicit Git environment and writable temporary HOME. Isolate system, global and local Git configuration, inherited Git configuration variables and includes; use an empty external attributes file, disable system attributes, replacement objects, external diff, textconv and hooks, and define no custom merge drivers. For remerge analysis pin GIT_ATTR_SOURCE to the recorded merge's first parent. Committed attributes may select Git's built-in merge behavior but cannot configure executable drivers. Test with a deliberately configured external merge driver and prove its executable never runs. No new dependency or write permission is required.

Do not start an application runtime for this work. These standalone CI scripts use Node's test runner, YAML parsing and disposable local Git repositories. Follow repository tooling constraints for dependency-requiring checks; do not start the development application stack merely to run script checks.

### Feature-wide test portfolio

| Consequential behavior | Existing protection | Test obligation and primary seam | Distinct failure |
| --- | --- | --- | --- |
| Imported and sync-only changes match actual ancestry | Existing controller API tests cover branch advancement and conflicts | add new: synthetic Git-history integration coverage for both defined ancestry sets, merged feature histories, multiple merge bases, pending source and target-only history | Missing source commits or target-only commits are listed as imported |
| Resolution evidence distinguishes merge edits from other changes | No current generated-body coverage | add new: synthetic clean/conflicting merge and separate-fix histories | A clean merge is called a conflict fix, or a resolution is hidden |
| Reconciliation owns bodies without changing source, target or readiness | Existing draft-sync-prs.test.cjs API fixture | extend existing: fresh PR/branch reads, body-update recording, moved-head, moved-target, retargeted, closed and duplicate-create cases | Stale or closed PRs are written, existing/conflict-blocked PRs retain stale bodies, or dry run writes |
| Sync-head and target updates wake trusted reconciliation | Existing event and workflow entrypoint tests | extend existing: parsed workflow/event contract tests | Conflict fixes never refresh, or foreign refs/events can write |
| Untrusted text, Git configuration, unsupported/missing evidence and large histories remain honest | No current rendering boundary tests | add new: structured cases for isolated configuration/driver nonexecution, escaping, Unicode, oversized entries, missing objects and analysis failure | Candidate data executes a driver, output triggers mentions, or failure publishes an apparently complete body |

Tests assert commit/path membership, structured status, write calls and repeatability using test-owned synthetic data. Do not pin headings, prose, production subjects, source files or Markdown snapshots. Reuse current protection for unchanged branch behavior rather than duplicating it.

### Ownership and slices

Main session owns design, authority, integration, workflow trust checks and final proof. One writer owns each slice. Review roles support the accountable owner and do not own implementation. Every specialist receives bounded source scope and no secrets or runtime data.

| Work | Accountable owner | Dependency | Acceptance and stop condition |
| --- | --- | --- | --- |
| Existing verification/related-creator mapping | Bounded explorer | Current upstream | Return existing test seams, event behavior and related creator paths with references; no edits |
| Slice 1 generator and its test registration | Main session after executor convergence | User plan approval | Exact named files, both ancestry sets and analysis/rendering portfolio rows pass; return diff and verification, stop before publication |
| Slice 2 controller, workflow and guidance | Main session | Accepted Slice 1 | Existing controller fixture and event portfolio rows pass; preserve all branch/readiness invariants |
| Integration, reviews and draft delivery | Main session, supported by simplifier, slice-reviewer and final-reviewer | Both slices | Complete committed package, applicable CI and actionable feedback settled; stop at draft PR |


**Slice 1: Generate the changelog from Git evidence.**
- Add .github/scripts/sync-pr-changelog.cjs and .github/scripts/sync-pr-changelog.test.cjs, named here because the existing controller needs independently verifiable Git analysis without expanding its API state-machine tests.
- Build the ancestry classification, deterministic rendering, resolution-path extraction, limits and failure handling.
- Add the focused suite to .github/workflows/check.yml.
- Verify synthetic histories and read-only rendering against existing fetched source/target/head snapshots.
- Commit the generator and CI test registration as one coherent slice. Apply simplifier review for the nontrivial graph and rendering logic.

**Slice 2: Keep maintained sync descriptions current and controller-owned.**
- Modify .github/scripts/draft-sync-prs.cjs, .github/scripts/draft-sync-prs.test.cjs and .github/workflows/maintain-draft-sync-prs.yml.
- Generate bodies at creation and after reconciliation, reread actual head metadata after mutations, update changed bodies only, and preserve dry-run zero writes. Preview generated descriptions in the manual dry-run summary.
- Extend Check codebase completion subscriptions to configured source and target branches plus exact maintained sync-head patterns. Accept same-repository sync-PR check completions as well as allowlisted branch push completions; retain exact repository, trusted v3 controller and workflow-name checks. Body edits do not trigger Check codebase, avoiding a self-trigger loop.
- Fetch exact history with read-only credentials, keeping fetched code outside execution.
- Update the draft-sync section in docs/ci-and-deployment.md and one focused rule in AGENTS.md: maintained sync descriptions belong to the controller; agents report commentary in chat, existing checks, or separately authorized comments.
- Run focused controller, generator and ancestry-guard suites, applicable direct-script/CI contract checks, syntax and formatting checks, git diff --check, and the staged secret/data inspection.
- Commit integration and accurate guidance together. Apply simplifier and focused slice-reviewer in parallel on the immutable integration range, covering event allowlists, trusted-code execution and accurate snapshot selection.

### Finish and delivery

Run the integrated final review over the full committed package for correctness, approved behavior, maintainability and focused security of Git execution and workflow event routing. Use rs-mr-description-writer for this implementation PR; the requested changelog-only format applies to maintained sync PRs, not this ordinary source PR.

Publish the task branch and create a draft PR against v3, attach it to this chat, and monitor applicable checks and actionable feedback through rs-babysit-pr. Respect required human review without requesting people. Complete only affected verification again after material corrections. This package has no application UI changes and requires no screenshot gallery.

Do not dispatch a live writing maintenance run or edit existing sync PR bodies as an activation shortcut. After the implementation is merged into v3 under separate authority, normal eligible controller runs replace current maintained sync descriptions automatically. A source revert stops the new body reconciliation but does not restore descriptions already replaced: the baseline preserves existing bodies. Restoring previous bodies requires a separately authorized recovery action; a corrected controller may regenerate them from Git evidence.

## Progress

Status: source delivery is complete in [draft PR #6584](https://github.com/uzh-bf/klicker-uzh/pull/6584); hosted CI and ordinary feedback monitoring continue under the user-requested native goal. Both simplifier and focused slice reviews pass without findings. Claude Fable 5.1 xhigh completed the plan discussion; its verified in-scope corrections are incorporated above. Claude Opus 5.5 high passed the integrated final review after one correction at e75c16f526: the target recheck precedes branch creation, and the existing race test proves no unnecessary branch write. All 18 controller tests pass after correction, with the other 29 checks reused unchanged. Both final-review results were validated against the canonical schema. The primary checkout remains untouched.

Hosted CI passed all eight required checks at 3c3f4e6dc3. The automatic OCR review completed successfully and supplied two accepted findings: require the full controller-owned branch pattern for selection, race recovery and final body validation; derive workflow branch expectations from PAIRS. Both are fixed with the existing fork/ownership and workflow contract tests extended. Fixture source SHAs now satisfy the same hexadecimal name contract. The affected controller/ancestry suites pass all 23 tests; unchanged generator/event evidence remains reusable. The follow-up commit must receive current-head CI and the standing-authorized hosted final review before monitoring closes.

Required delivery: reviewed draft PR plus check results; achieved: approved plan and committed generator. Executor 01a14b42-f5b1-78d2-a7fa-68f1251fbb17 returned no work after the main session requested convergence and was closed. It identified no missing contract or capability. The main session took ownership and completed Slice 1; this was no provider fallback or route failure. Four synthetic tests protect the defined graph, merge, size and isolation obligations. Focused integrated controller/generator/ancestry tests pass (27); script/event checks add 20 passing tests. Real recorded snapshots rendered 50 imported commits, one merge-edit record and no additional commits. The fresh HTTPS blob-filtered path completed in 6.44 seconds, supporting the existing five-minute workflow budget; the local-history path completed in 6.92 seconds. No body entries were omitted in that preview. These are repository-history observations, with no application/environment data queried.

Commits: plan 96eb0a02cc, generator 547a71b18a, controller integration f392de9960. One readiness merge at 3c36ae88d0 integrates target 405575b90f because v3 requires up-to-date PRs; its shared documentation changes were in disjoint sections and merged automatically. No source behavior changed during integration, so the 47 passing checks and slice reviews remain applicable. The package has nine paths and 1192 substantive changed lines before this final progress bookkeeping, excluding 122 project-artifact lines. It is one cohesive automation package, with no separate stack layers. Test delta: nine new behavior tests (four synthetic history tests, five controller cases), with existing event/fixture coverage extended.

Staged Gitleaks, formatting and diff checks pass. Opengrep reports no findings in the helper/tests; its controller finding is the unchanged fixed-PAIRS regular expression. Both slices received simplifier and focused risk reviews, all with no findings; their gitignored reports are in _local/reviews/2026-10-17-sync-pr-changelog-{generator,controller}-{simplifier,slice-review}.md. Generator reviews cover Git/configuration isolation; controller reviews cover workflow trust and accurate snapshot/body-update lifecycle. All review children are terminal and closed. Accepted residual race: ref movement after the final read can be reconciled only by a later eligible run, because GitHub offers no body-update lease.

Achieved delivery: complete task branch pushed to origin/enhance/sync-pr-changelog and [draft PR #6584](https://github.com/uzh-bf/klicker-uzh/pull/6584) created, attached to the chat and read back at e75c16f526. An earlier GitHub API connection failure cleared; no workaround was used. GitHub reports mergeable, with no unresolved review threads at initial inspection. Hosted checks are pending/running, so this is not a completed-CI or activation claim. The source is held after one deliberate target integration. This progress-only commit changes no tested or reviewed contract; prior checks and reviews remain valid. Next action: finish applicable hosted checks, actionable feedback and the standing-authorized hosted final review, retaining the PR as draft. No live controller run or existing-sync body edit was performed. Activation, marking ready and merge remain separate authority gates.

Planning-stage specialist: APPROVED in round 2 by the same planner child (01a14a51-cb40-7d52-b76e-979d43e56674). Round 1 requested corrections to rollback, pre-write revalidation, Git configuration isolation, limit/test precision and explicit ownership. The baseline controller and API fixture confirm those gaps; all five findings were accepted and addressed. Detailed review provenance: _local/reviews/2026-10-17-sync-pr-changelog-plan-hardening.md (gitignored). Claude discussion and dispositions: _local/reviews/2026-10-17-sync-pr-changelog-claude-plan.md (gitignored).

The supporting explorer (01a14a4d-9e41-7381-aeb8-a520622d7f9c) completed and was closed. Its test-registration, current event gaps and separate recovery/legacy creator findings agree with the source evidence above. Its suggestion to extend descriptions to ancestry-restoration PRs is outside this maintained-forward-sync package; preserve the stated boundary. Fresh baseline verification: 18 controller and ancestry tests pass on pinned Node 24.21.0 with the existing host YAML dependency. No application/container runtime was started. OpenCodex readiness reports ready; the prior scoped explorer completed successfully. The unpublished plan is not cleared for TypeSafe, so the optional Jev routing comparison is skipped and local routing policy remains decisive.
