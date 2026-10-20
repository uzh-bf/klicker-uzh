# Bounded capture consumer integration

## Approval summary

Connect the generic framework's bounded conversation capture to the existing
evaluation budget leases. Update the private framework pin to merged revision
`33fac627cb691813a777181c428d40c4355ea45f`. Add a small Python admission adapter
and a local process interface in the existing Node budget module. The framework
continues to own capture, replay, normalized artifacts and later assessment.
The consumer continues to own its monetary ledger and provider spend guard.
This targets the prepared provider-direct, supplied-text diagnostic, not the
application's authenticated chat target or live retrieval.

This is the approved source-only continuation, ending at one verified draft PR
against `v3`. Local commits, reviews, ordinary branch push and draft creation are
included. Merge, readiness transition, deployment, application startup, private
source transmission, new or extended allowances and paid target/judge calls are
excluded. Only temporary synthetic ledgers and loopback HTTP fixtures may run.
The default budget limits, existing ledger schema and application capture remain
unchanged. There is no new runner, gateway, capture loop, metric or corpus.

The important risks are admitting a request without an active turn, clearing an
uncertain turn after failure, losing acknowledgement of a committed finish,
hiding cleanup errors, and treating a lease as proof of provider pricing or
routing. Offline integration must exercise the
real process and ledger boundary. Source delivery does not establish real-provider
qualification, generated-answer quality or learner benefit.

## Execution details

Repository: KlickerUZH. Target: `v3` at
`d6eac932f336407de4b77d6ec31ae0e0d7c38219`.
Branch: `enhance/bounded-capture-consumer`.
Worktree: `trees/bounded-capture-consumer`. Artifacts root: `project/`.
Execution mode: standard. Approval mode: executable batch. Boundary owner: self.
The earlier [assessment plan](2026-10-18-explainer-assessment-readiness-plan.md)
remains historical context; its private evidence is outside this source package.

### Primitive impact and ownership

| Primitive | Disposition | Contract |
| --- | --- | --- |
| Evaluation allowance | Reuse | No initialization, reset, schema change or raised limit in the adapter. |
| Run and turn admission | Compose | A task-owned Node child holds the existing run lease and owns each turn token; Python supplies a framework context-manager factory. |
| Conversation observation | Reuse | The pinned framework alone runs finite visible-text capture; the consumer adds no replay or scoring logic. |

This is a local adapter over accepted ownership, not a new product primitive or
durable backend. No ADR is needed. A new listener, persistent service, ledger
format, allowance policy or duplicated orchestration reopens scope.

### Binding contracts

The existing budget module gains an explicit local admission-session CLI mode.
It validates the existing ledger and expected policy identity, refuses an
exhausted or uncertain budget, and acquires its existing live run lease before
reporting readiness. Requests are newline-delimited `begin`, `finish` or `close`.
Replies are newline-delimited `ready`, `ok` or `error <code>`. Process commands
serially, bound buffered input to 64 bytes and replies to 128 bytes, and reject
unknown commands, overlapping begin and repeated finish. Only the child owns
the token. EOF and normal closure release the run lease. Failure or cancellation
before durable finish retains active-turn uncertainty and all reservations.
Durable finish is the commit point: lost acknowledgement is a terminal session
failure with no retry or further admission, but the committed ledger may already
be clear. Reservations remain retained in either case.
An abnormal process kill can leave a stale durable lock; it must never recover
or reset that lock automatically.

The Python library is a context manager plus callable admission factory. Require
exact equality with the configured model and positive output bound before
admission. The caller selects these from the qualified policy; the guard checks
its policy-listed model and maximum bound independently. A mismatch consumes no
turn. The adapter uses bounded IPC waits,
strips inherited Node execution options and credentials from the child environment,
and never suppresses capture or cleanup errors. Retain IPC/admission failures in
the outer session so the framework's exception capture cannot hide them. Surface
those failures on exit, combining capture and cleanup errors without request
text. Bound shutdown waits and reap or terminate only the owned child.
Before yielding it waits for the
child's successful turn admission. Only successful context exit finishes a turn.
Finishing checks run ownership, the same active token and a positive reservation
increase over that turn's admission baseline. An earlier turn cannot satisfy
this requirement. Provider-direct
capture has no application credits, so finishing records zero additional credits.
No provider-dollar reservation is refunded.

No command accepts arbitrary code, credentials, prompts, responses or an allowance
initializer. The existing guard still validates model, native output bounds,
policy identity and conservative monetary reservation before upstream dispatch.
The caller must use that exact guard, retain its qualified provider policy and
persist artifacts privately only after the outer admission context closes.
The adapter alone does not establish those provider or custody requirements.

### Delivery and ownership

Delegation Map: the single integration slice belongs once to `main`.
Main owns integration, the Python adapter, tests, docs, CI and forge effects.
A configured executor owns the settled budget-session addition in
`evaluation/evaluation-budget.mjs` after plan hardening. Main retains the
cross-language seam and private evidence; no child receives course material.
Acceptance: real lease ownership, counted turns, retained reservations and
uncertainty, first-failure stop and cleanup through synthetic process/HTTP tests.

Named new files: `evaluation/adapters/budget_admission.py`,
`evaluation/tests/test_budget_admission.py` and this plan. Existing changed files:
`evaluation/evaluation-budget.mjs`, `evaluation/README.md`,
`.github/workflows/check.yml` and the `evaluation/framework` gitlink. Update
the existing pin assertion in `util/test-klicker-eval-integration.py` too.
Do not extend the ordinary query launcher or create a standalone capture script.

### Test portfolio and verification

| Consequential risk | Obligation and primary seam |
| --- | --- |
| Admission bypass, overlapping run, exhausted allowance or model/bound mismatch | Add new synthetic process/ledger tests of the public Python context and existing budget exports; no framework dependency in normal CI. |
| Failed, interrupted or unreserved turn becomes reusable | Add new context failure/EOF/IPC failure cases proving retained reservations, pre-finish uncertainty and post-finish lost-ack failure with no later admitted send. |
| Framework capture is not wired to the guard | Add new opt-in integration in the same file using the actual pinned API, Node guard and a fake loopback provider. Check native bounds, replay, request ceiling, first-failure stop, swallowed admission errors and ledger state. Ordinary CI skips the private dependency; explicit integration mode fails if unavailable. |
| Existing budget or launcher compatibility changes | Obligation: none; rerun existing contracts without duplicate parser or prose tests. |

Use Python 3.12 and Node 24 in one-shot containers, with external networking
disabled. Loopback fixtures remain available. No managed application runtime or
browser is needed: no UI, cookies, auth or browser contract changes. Run focused
tests first, then formatting, static analysis and applicable existing contracts.
Keep private-framework integration evidence separate from public CI coverage.
Source/data hygiene precedes each commit. Reviews cover correctness, data
integrity, the local process boundary and maintainability. No broader security
assessment is included.

Run `python -m pytest -q evaluation/tests/test_budget_admission.py` for public
consumer contracts. Repeat with `KLICKER_EVAL_FRAMEWORK_INTEGRATION=1` and the
pinned framework's `src` on `PYTHONPATH` for mandatory local integration. Missing
framework access fails that explicit run. Both must pass for draft completion.
Existing coverage uses the chat Vitest budget/guard/trajectory files and
`bash util/test-klicker-eval-wrapper.sh`, through their installed runners.

Research uses the installed framework source and current Node documentation for
line-oriented subprocess lifecycle. The configured advisor checks the integration
choice before implementation. Required planner hardening precedes the plan commit;
the slice receives simplification and risk review, then integrated final review.

## Progress

The native planner approved the derived plan in round two after five verified
contract corrections. Claude's architecture consultation completed; its app
target warning is resolved by the explicit guard-direct diagnostic boundary.
Its additional HTTP routes were rejected in favor of local stdio. The optional
AGY planning opinion was unavailable because authentication failed. The private
planning report records provenance and arbitration. OpenCodex readiness passed.

The framework prerequisite is merged and exact post-merge CI passed. The existing
69 importer tests pass offline. Initial attempts to invoke Vitest files through
Node's test runner and pytest tests through bare unittest used the wrong test
tools; neither is source failure. Their installed runners remain required.
Source is delivered in draft [PR 6641](https://github.com/uzh-bf/klicker-uzh/pull/6641).
The bounded
executor added the budget-session interface; main integrated the Python context,
the merged framework pin, existing integration pin assertion, docs and CI.
The closed protocol was reduced from an initial queue-based draft to raw serial
stdin iteration. Main reproduced and fixed acceptance of an unterminated frame.

All 22 consumer tests pass with the real pinned framework explicitly enabled,
including both native API paths, replay, first-failure stopping and lost-finish
acknowledgement. The 69 existing importer tests pass. Ordinary public mode
passes its consumer contracts and explicitly skips four private-framework cases.
The 43 existing budget/trajectory tests and wrapper suite pass. Ruff, formatting,
focused Biome and Opengrep
checks pass; only existing nonblocking Biome advice remains. All verification
uses synthetic temporary state in one-shot containers with external networking
disabled. No application runtime, paid call or real ledger mutation occurred.

Test delta: one new synthetic consumer module with 22 tests, including four
private-framework integration cases; no existing test removed or weakened.
The simplifier found no justified reduction. Risk review identified a hidden
cleanup failure after rejection; main reproduced it, gave failed cleanup a
distinct child exit status and retained both exceptions. Focused verification
closed that finding. Integrated final review of the complete range through
`a3d690b9041a9027dd7520f6acb8c6001b8981ee` passed with no remaining finding.
That progress-only head subsequently passed ordinary CI. A final forge-feedback
sweep then found a low-severity startup-error inconsistency: a failed process
spawn escaped as raw OSError. Main reproduced it and normalized startup I/O
failure to the adapter's existing error category, without consuming a turn.
The exit-code mapping was also made explicit with equivalent if/else branches.
Focused final-review verification of this correction is tracked in the PR.

Substantive package size excluding project artifacts: 887 added, 7 removed lines.
The single package is independently functional, reviewable and testable; it adds
no default live effect. Hosted CI is rechecked after the corrective push; the
draft PR description and exact-head checks hold its authoritative disposition.
The manual repository final-review gate requires a ready PR and remains a later
authority boundary. No ready transition, merge, deployment or paid execution is
included in this source delivery.
