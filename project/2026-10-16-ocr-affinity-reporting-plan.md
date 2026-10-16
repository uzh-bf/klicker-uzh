# OCR affinity and outcome reporting

## Approval summary

Manual final reviews currently lose their configured cache-affinity key because
OCR 1.13.0 rejects the saved endpoint configuration without a URL. Restore the
complete configuration for each adapter attempt, using that attempt's loopback
URL and retaining existing policy fields. Add precise, content-free outcome and
failure diagnostics so incomplete reviews are distinguishable from identity
mismatches. Retain sanitized diagnostics for seven days and explain the separate
OCR budget and provider-cost counters. Analyze existing GitHub job metadata
before considering any further timing instrumentation.

The user approved this executable batch, including commits, ordinary task-branch
pushes, and a draft PR against `v3`. Reasoning, model/provider routing, completion
and aggregate budgets, accounting arithmetic, coverage, concurrency, deadlines,
and retry/resume behavior remain binding invariants. No paid OCR canary,
readiness change, merge, release, deployment, or infrastructure change is
included. Automatic draft-PR CI remains part of source delivery.

Acceptance requires focused workflow contract tests, an unmodified released OCR
1.13.0 binary against a synthetic provider, exact diff and data-hygiene review,
applicable independent reviews, and hosted CI/feedback disposition. Configuration
must remain private, preserve child credential isolation, and survive successive
attempts without retaining an old adapter URL. Timing evidence must distinguish
observed gaps from an unproven cause. The terminal condition is a pushed branch
with a draft PR and settled automatic CI/actionable feedback.

## Execution details

### Context and authority

- Repository/worktree: `trees/ocr-affinity-reporting`.
- Branch: `rs/ocr-affinity-reporting`; target: `v3`.
- Starting target: `2b24fbca8b45d8c695fbcd8a98dbc75eebcf1917`.
- PR: none yet.
- Execution mode: standard; main model identity is not independently exposed.
- Ceremony: full path, one cohesive workflow-reliability package.
- Boundary owner: main session. Authority: approved implementation and draft
  delivery only. Pause only for a material contract change, an exhausted required
  capability, or an unresolved unsafe configuration/coverage decision.

The earlier Astra and Claude consultations established the resolver mechanism
and reporting gaps. This plan derives implementation and checks from that
approved scope. The upstream resolver takes the first complete endpoint; it does
not merge extras from an incomplete saved configuration into environment values.
The current adapter defaults manual requests to max reasoning. The existing
budget transformation and one-resume policy are preserved verbatim.

No product primitive, public application API, or database model changes. The
configuration is an internal CI resource with a reversible source fix, so no ADR
is required. A new trust boundary or reusable credential store would reopen that
ruling. Update `docs/ci-and-deployment.md`; existing task skills remain accurate.

### Delegation Map and sequence

| Workstream | Owner | Acceptance |
| --- | --- | --- |
| Per-attempt configuration and synthetic binary proof | Main | Actual requests contain valid affinity and max reasoning across distinct adapter ports; original configuration and credentials remain protected |
| Outcome classification in the existing final-review helper | Executor | Stable status/identity rejection codes and safe CLI output; identical validation and retry decisions |
| Adapter error counters, workflow retention and accounting labels | Main | Safe counters reconcile; provider responses, attempts, budgets and cleanup results remain unchanged |
| Existing GitHub timing metadata | Main | Scoped read-only derivation, explicit unresolved attribution, no new workflow instrumentation |

Slice ownership: slice 1 belongs to main; slice 2 belongs to main for integration,
with one bounded native `executor` subtask owning only the final-review helper
and its test; slice 3 belongs to main. Slice 2 follows slice 1, and delivery
follows both. The executor never writes adapter/workflow/docs paths.

1. **Restore manual affinity.** Route: main (critical-path configuration and
   credential coupling). Extend the existing adapter command as
   `run --ocr-config <existing-private-file> -- <command>`. Atomically update only the
   existing private OCR config's endpoint URL for each child, preserve all other
   fields, and restore the original bytes and private permissions during cleanup.
   Validate before spawning; use same-directory atomic replacement. Cover setup
   failure, spawn failure, nonzero exit, SIGINT/SIGTERM and adapter-close failure.
   A sanitized restoration error fails the attempt and prevents another attempt.
   Generic `run` callers
   retain existing behavior. Keep child `HOME`, session storage and the upstream
   key boundary unchanged. Wire both manual modes. Commit:
   `fix(ci): restore manual OCR cache affinity`.
2. **Explain outcomes and preserve diagnostic evidence.** Route: main integration
   plus native `executor` for the helper/test subset. Extend the existing
   helper with bounded result/coverage and rejection records. Separate terminal
   status errors from actual identity failures without admitting any result
   previously rejected. Add fixed adapter error classes, including combined
   length/no-tool responses. Assign source rejection codes at validation branches;
   never parse exception prose. Keep diagnostics separate from provider-facing
   errors: length/no-tool still returns `required_tool_call_missing`, and
   length/task_done still returns `truncated_completion`. Preserve all HTTP/retry
   behavior and raw-error suppression. Preserve the two-line `plan-ocr-resume`
   stdout protocol and JSON-only `merge-ocr-resume` stdout; report to stderr. Change only sanitized diagnostic artifact retention to seven days,
   leaving rejected-result artifacts at one day. Label the current budget basis
   alongside provider usage and estimated USD. Commit:
   `enhance(ci): clarify OCR outcomes and diagnostics`.
3. **Finish and deliver.** Route: main (external effects and final proof). Analyze existing workflow/job timestamps read-only;
   use private derived evidence for the user-facing conclusion and document only
   the general diagnostic method. Integrate any required corrections, run final
   review, push, open the draft, and settle automatic CI/actionable feedback.

### Named files

Write scope:

- `.github/scripts/ocr-mistral-adapter.cjs`
- `.github/scripts/ocr-mistral-adapter.test.cjs`
- `.github/scripts/final-ai-review.js`
- `.github/scripts/final-ai-review.test.js`
- `.github/workflows/check-ocr-final-review.yml`
- `.github/workflows/check-ocr-review.yml`
- `docs/ci-and-deployment.md`
- `project/2026-10-16-ocr-affinity-reporting-plan.md`

This plan is the only new tracked file. Existing stack consumers use the shared
helper and workflow, so stack-helper files are verification inputs, not writes.
Do not introduce a new reporting module, external dependency, workflow job, or
application runtime. Temporary synthetic qualification scripts belong outside
tracked source.

### Verification portfolio

| Consequential risk | Obligation and primary seam | Existing protection / distinct failure |
| --- | --- | --- |
| Resolver silently discards affinity | `extend existing`: adapter CLI lifecycle test; actual released binary mock qualification | Config-object tests miss incomplete endpoint resolution; verify expanded affinity and max reasoning on the wire |
| Configuration clobber or stale URL across attempts | `extend existing`: CLI lifecycle test | Preserve existing bytes/policy, private mode and cleanup on child/setup failure; two different adapter ports |
| Partial resume mislabeled or accidentally accepted | `extend existing`: final-review CLI/result contract tests | Existing lineage and coverage tests stay; statuses get distinct codes with identical rejection decisions |
| Diagnostic leakage or duplicate error counts | `extend existing`: adapter response/failure tables | Only fixed enums/numbers; timeout/disconnect races counted once; raw text never emitted |
| Accounting or retry changes | `none`: reuse existing budget/resume/cost and workflow-shell tests | No new arithmetic or retry policy; missing usage remains unknown and failure spend remains in estimates |
| Retention, labels and timing method | `none`: focused workflow/schema/format checks and metadata readback | Verify fixed sanitized paths at seven days, raw failures one day; explain unknown timing causes |

Released-binary acceptance is blocking: verify the release checksum and version,
produce synthetic resumable partial coverage, and resume the actual session on a
second adapter port with retained storage. Assert expanded valid affinity, max
reasoning, fresh endpoint/token, valid lineage and coverage, and restored config
after each attempt. A missing binary or failed resume proof blocks acceptance.

Use dependency-free Node workflow checks on the host with repo-pinned Node 24.
No container-dependent application test or build is required by these surfaces.
The Git hooks are inspected for the matching scoped route; report any required
container check that cannot be performed. Formatting uses the installed tools.
Before each commit inspect staged content for secrets, personal data, real
environment facts, unrelated hunks and misleading comments.

### Review and delivery

Planner hardening precedes the plan commit. Each substantive slice receives the
configured simplifier and applicable scoped correctness/privacy/configuration
review. Review immutable committed ranges. The integrated final review covers
correctness, plan compliance, maintainability and credential/diagnostic privacy;
no broad security assessment. Preserve existing human merge requirements and
request no human reviewers. Use the standard draft description and PR monitor.

## Progress

- Approved scope: user executable batch; plan hardening approved after one correction round.
- Active work: baseline and configuration reproduction.
- Completed: remote refresh, target resolution and clean worktree creation.
- Tests: baseline 192/192 passes on pinned Node 24; released-binary reproduction confirms absent affinity with max reasoning preserved.
- Planning review: APPROVED; accepted explicit config lifecycle, actual resume proof, safe diagnostic protocols and exact ownership requirements.
- Required delivery: task push and draft PR; achieved: local worktree only.
- Remaining: both implementation slices, timing evidence, independent reviews,
  draft delivery and automatic CI/feedback.
