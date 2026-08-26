# AI review lifecycle and stacked final attestation

## Goal and non-goals

- Problem: the low-cost reviewer is valuable during draft iteration, but it
  keeps generating feedback after a pull request is otherwise ready. The
  exact-head final review then restarts cold after every accepted fix. Together
  with full CI reruns, this can keep an agent in an unbounded review loop.
- Goal: make AI review a bounded lifecycle: cheap discovery while draft, a
  frozen ready state, one manually triggered strong review, descendant-aware
  remediation attestation, and terminal finding dispositions.
- Goal: review every layer of a native GitHub stack against its parent and add
  one holistic review of the cumulative change and the stack topology.
- Goal: let `rs-babysit-pr` defer useful non-blocking work to the configured
  tracker without treating ticketed residuals as merge blockers.
- Non-goals: merge or publish either implementation package, mutate branch
  protection, deploy anything, execute pull-request code, create live ClickUp
  tasks, hardcode a ClickUp destination into a generic skill, or turn either AI
  model into an authority on merge readiness.

## Execution contract

- Current authority: the user approved this plan. Create or reuse clean task
  worktrees, make the scoped changes in both repositories, run repository-native
  checks and required specialist reviews, update `Progress`, and create local
  conventional commits.
- Withheld after plan approval: pushes, pull-request creation, ready-for-review
  transitions, merges, branch-protection changes, deployments, live OpenRouter
  qualification calls, live ClickUp writes, publication of the shared skill,
  force pushes, and worktree or branch removal.
- Execution owner and boundary owner: main session. The privileged
  `pull_request_target` workflows, status semantics, external-provider
  boundary, tracker authority, and cross-repository contract remain coupled in
  one owner.
- Terminal: both local packages are committed on clean task branches; focused
  tests, repository checks, slice reviews, and integrated final review pass;
  the plan records exact commit identities and the withheld live-proof steps.
- Pause: stop at any failed execution gate below, any need for broader GitHub
  permissions, an unavailable official stack API, an unbounded or undocumented
  diagnostics path, a new secret, a force push, or an external action outside
  this authority.

## Plan identity

- Plan: `project/2026-08-25-ai-review-lifecycle-plan.md`.
- Primary repository: `uzh-bf/klicker-uzh`.
- Branch: `rs/ai-review-lifecycle`.
- Worktree: `trees/rs-ai-review-lifecycle`.
- Planning baseline: `origin/v3` at
  `5ffc6a6d2bc4b12f6f38b5119718a7545e039256`.
- Fresh remote check: `origin/v3` is now at
  `de103a52d982a29af72022069ad668bc68f84094`; this task branch is seventeen
  commits behind and sixty commits ahead. Rebase, merge, and publication remain
  outside the approved authority.
- Historical inputs:
  `project/2026-08-24-open-code-review-plan.md` and
  `project/2026-08-25-manual-final-ai-review-gate-plan.md`.
- Coordinated repository: the dotfiles repository at
  `/Users/roland/.homesick/repos/dotfiles`, current default branch `master` at
  `origin/master`. Its primary checkout is dirty and contains a user-authored
  `rs-babysit-pr` currency rule that must be semantically preserved. Resolve a
  separate task branch and worktree under that repository's own instructions
  before editing it.
- Pull requests: none. The proposed delivery is one ordinary KlickerUZH PR and
  one separate shared-skill PR because they have different repositories,
  consumers, and publication boundaries.

## Current evidence and planning disposition

- The pinned OpenCodeReview workflow already reviews a stacked layer from the
  merge base of its immediate PR base to its exact head. Cheap per-layer review
  therefore works today, including on drafts.
- The cheap workflow runs on every ready-PR synchronization as well. Its
  30-minute job timeout, concurrency `2`, and 540-second model timeout have
  produced avoidable timeout and late-feedback behavior on substantive PRs.
- The current `/final-review` path is exact-head, least-privilege, fail-closed,
  and blocker-advisory. Its default-branch eligibility rule excludes every
  upper layer of a stack.
- The native `repos/{owner}/{repo}/stacks` endpoint is live for this repository
  and returns ordered PR numbers, refs, and head SHAs. Its PR entries currently
  omit usable base refs, so membership order alone is not trusted. The helper
  must fetch every PR and verify base/head edges and Git ancestry separately.
- Prior empirical review found useful correctness and deployment findings from
  DeepSeek, but imperfect category and severity calibration. Total usage so far
  cost about USD 2.40, which supports retaining it for draft discovery rather
  than promoting it to a merge authority.
- OpenRouter documents strict JSON Schema output for its OpenAI-compatible chat
  endpoint. `provider.require_parameters: true` is required to exclude
  providers that would ignore the structured-output contract. Node 24 provides
  `fetch`; no SDK or repository dependency is needed.
- The required planning specialist returned `DONE_WITH_CONCERNS`. This plan
  accepts its attestation-chain, lower-layer invalidation, terminal-disposition,
  compact-metadata, and generated-promotion recommendations. Its statement that
  `writing-for-agents` was unavailable is rejected: that skill is available and
  informed this plan's state and completion contracts.

## Review lifecycle

| Phase | Entry | Automated behavior | Exit |
| --- | --- | --- | --- |
| Draft discovery | PR is draft | DeepSeek reviews each draft head against its immediate base. A ready transition cancels any in-flight cheap run. | PR becomes ready and the last cheap run is terminal or cancelled. |
| Ready freeze | PR is ready | Snapshot all existing feedback, classify it, and batch accepted fixes into at most one push for that head. Cheap review no longer starts. | CI and existing feedback are settled, or a real blocker needs a decision. |
| Full final snapshot | Authorized collaborator posts `/final-review` or `/final-review-stack` | `z-ai/glm-5.3` performs one complete blocker-only review of an immutable single-PR or stack snapshot. A clean run records an evidence-bound success status without a PR comment. | A complete report or trusted clean marker and status exist, or the run fails closed. |
| Remediation attestation | A verified final blocker is fixed on a descendant head | The same manual command verifies the cumulative remediation delta against the complete root review instead of starting another cold review when the bounded contract holds. | Current-head attestation succeeds, a cold review is required, or the round cap stops automation. |
| Ready | CI is green and all findings are terminal | No more review-triggered pushes occur. | Human chooses whether to merge. |

The commands remain manual. `rs-babysit-pr` must never post either final-review
command on the user's behalf. When all preconditions are satisfied but the
command is absent, the monitor reports a human gate with the exact command and
stops its automatic mutation loop.

`final-ai-review` and `final-ai-stack-review` mean that the configured review
completed for the recorded snapshot. Finding count does not control those
statuses. A genuinely clean run intentionally emits no PR review body: the
individual status description is `z-ai/glm-5.3 final review clean; evidence=<64-
hex evidence digest>`, and the stack status description is
`z-ai/glm-5.3 stack review clean; evidence=<64-hex evidence digest>`. The
individual evidence digest covers the PR range, review mode, root review,
stack identity, dispositions, and policy. The stack evidence digest covers
the ordered layer identities, topology identity, exact range, dispositions,
and policy. Each clean run also creates an immutable GitHub check with a
versioned, base64url metadata marker. The marker binds the clean status to the
exact reviewed paths, rename aliases, workflow run, trusted workflow commit,
and review plan. Current success detection accepts either a finding-bearing
report or one of these verified clean markers. Unrelated forward-only base
movement can preserve a clean result only when it is bounded, safe, and
disjoint from the reviewed paths; otherwise a new review is required. The
generated staging-promotion workflow may use its separate documented `Verified
generated staging promotion` no-report exemption. Merge readiness is the
composition of current review evidence, green required CI, and terminally
dispositioned findings.

## Full review and descendant attestation

Every complete review creates one immutable root snapshot `S` with:

- a schema version, review identifier, scope kind, policy digest, model and
  structured-output schema digest;
- the exact base, head, or ordered stack-head identities and expected range;
- a compact canonical identity manifest embedded as base64url metadata in the
  report, plus the hash of the larger sanitized prompt manifest;
- deterministic finding IDs, warnings, coverage state, elapsed time, and usage
  counters when the pinned tools expose them through documented outputs; and
- the top-level workflow run URL and status context.

The report stays human-readable and below GitHub's comment limit. Large file
lists, patches, descriptions, and model prompts are not embedded in comments.
Unknown warnings, partial manifests, report overflow, stale identities, or
missing required usage evidence fail closed.

After a blocker fix produces descendant head `H`, the same command selects an
incremental attestation only when all of these hold:

- the PR or ordered stack membership, repository, refs, and ultimate base ref
  match the root review;
- `H` descends from `S`; for a stack, each changed layer descends from its root
  head and every upper layer contains the current parent head;
- policy, model, schema, and provider-boundary digests are unchanged;
- a trusted disposition record binds every root finding ID exactly once; and
- the cumulative `S..H` remediation is no larger than 20 paths and 1,000
  changed lines and contains only declared finding repairs plus their tests,
  documentation, or generated companions.

The attestation reviews the cumulative `S..H` delta, verifies all prior
dispositions, and for stacks reruns the structured topology pass. The limits
are conservative initial safety bounds, not performance targets.

A cold full review is mandatory after non-descendant history, force push or
rebase, stack membership/order/ref changes, missing or untrusted dispositions,
exceeded bounds, or new dependency, permission, workflow, schema, migration,
provider, retention, authentication, data-boundary, architecture, or public
contract scope.

Ultimate-base advancement alone does not invalidate unchanged head-scoped
evidence. Record a cheap mergeability, conflict, required-check, and overlap
check. Preserve evidence for forward-only unrelated movement, run targeted
evidence for material overlap, and require a cold review only when merged
behavior or a reviewed contract changed.

## Finding classification and terminal disposition

Classification describes impact; disposition describes completion. A finding
is not terminal merely because it was called a blocker, follow-up, or rejected.

| Class | Use when | Terminal only when |
| --- | --- | --- |
| Blocker | Verified correctness, security, data, contract, or operational failure makes the advertised change unsafe to merge. | The fix is pushed, verified, replied to, and its thread is resolved. |
| Follow-up | The work is useful but not required for the current contract, or would expand scope, authority, or blast radius. | An authorized task exists in the configured tracker, its public-safe reference is posted, and the thread is resolved. |
| Rejected | The finding is false, duplicate, stale, speculative, or outside the stated change. | Evidence is posted and the thread is resolved. |

The trusted disposition record uses a small versioned machine-readable marker
authored by a collaborator with calculated `write` or `admin` permission. It
binds the root review ID and every finding ID to `fixed`, `follow-up`, or
`rejected`, with only public-safe commit, comment, or tracker references. The
workflow ignores markers from untrusted authors and any ambiguous duplicate.

For KlickerUZH, follow-ups compose the existing ClickUp task primitive. Create
a task only when an existing source task or destination list makes the target
unambiguous and the active authority permits the external write. Never guess a
list and never fall back to GitHub Issues. If authority or destination is
missing, batch one human decision; the item remains non-terminal.

`parked` is reserved for a genuine decision blocker. It becomes a reported
`blocked` stop, not an indefinite monitoring state. Ticketed follow-ups do not
block merge readiness.

## Bounded remediation policy for `rs-babysit-pr`

- Capture all current-head feedback before changing code. Verify and classify
  every item, then push accepted changes once for that captured head.
- Count every head-changing action after ready against a two-round autonomous
  budget, including CI fixes and platform branch updates. Retries without code
  changes do not count.
- Treat the default 12-tick monitor watch budget as an explicit read-only remote
  observation cap. Reaching it is a blocked stop or a fresh invocation; it is
  independent of the two-round head-changing budget.
- After two rounds, do not make another automatic head change. A new verified
  blocker produces one batched human decision with the recommended fix. An
  explicitly authorized exceptional batch is recorded and consumes one round;
  another blocker stops again.
- Late non-blocking suggestions become authorized follow-ups or evidence-backed
  rejections. They never trigger another push or full CI run.
- A known automated review is complete only from a terminal current-head run or
  current-head report. Earlier-head activity and open-ended "reviewing" signals
  do not block readiness forever.

For a native stack, per-layer readiness still requires that layer's CI and
feedback to be terminal. Whole-stack readiness additionally requires a current
`final-ai-stack-review` attestation on the verified top snapshot. The monitor
reports the top PR and exact manual command regardless of which layer it was
asked to watch.

## Native stack contract

`/final-review` accepts an unstacked default-base PR or one verified native
stack member and reviews only that layer's immediate range. The normal cheap
review continues to cover every draft layer this way.

`/final-review-stack` is accepted only on the verified top PR. A one-layer
result directs the caller to `/final-review`. The stack helper must:

1. Resolve ordered membership through GitHub's native stacks endpoint, then
   fetch each PR separately.
2. Require open, ready, same-repository PRs; a single linear order; exact
   parent-head to child-base ref equality; and corresponding Git ancestry.
3. Fetch exact head objects without checking out or executing PR content and
   derive per-layer paths and statistics from immutable Git ranges.
4. Freeze the ordered layer PR numbers, refs, head SHAs, ultimate base ref,
   merge base, tree identities, path statistics, and bounded sanitized titles
   and descriptions.
5. Re-resolve every head and edge immediately before publication.

The strong stack run contains two independent passes:

- one cumulative OCR code review from the ultimate-base merge base to the top
  head; and
- one direct OpenRouter topology review over the bounded manifest, deterministic
  path-overlap data, layer intent, and normalized cumulative-review coverage.

The topology call uses `z-ai/glm-5.3` with high reasoning, strict JSON Schema,
`provider.require_parameters: true`, and fail-closed parsing. It reviews layer
boundaries, dependency order, cross-layer integration, and coverage; the helper
validates graph correctness deterministically. Findings are assigned from exact
layer deltas. Findings touching multiple layers are marked cross-layer rather
than forced onto one owner.

One consolidated report is published on the top PR without inline comments.
Any partial pass, malformed result, stale edge, cleanup failure, or unknown
coverage warning prevents success.

Every relevant member event, including synchronize, edited base, draft
transition, close, and reopen, re-resolves the stack. A changed lower-layer head
must set a newer `final-ai-stack-review` state on the top SHA even when that SHA
has not changed; status evaluation always selects the latest matching context.
Clean stack evidence is accepted only from the matching immutable clean-evidence
check, whose digest includes canonical reviewed paths and rename aliases. Native
stack landing may preserve the same code identities while PR topology changes,
but that behavior is not yet qualified. Stack evidence is pre-merge procedural
evidence until a controlled landing proves the exact survival rules.

## Security, data, cost, and reliability controls

- Keep `pull_request_target` code on the trusted default branch. Fetch PR-head
  Git objects only as review data; never checkout, install, build, test, or
  execute PR-head content.
- Treat PR metadata, source, diffs, comments, documentation, and model output as
  untrusted instructions. Accepted ADRs, tests, and documentation remain
  evidence of intended behavior and must be consulted before recommending a
  contract change.
- Preserve least-privilege job permissions. Clean-evidence readers have
  `checks: read`; only finalizers have `checks: write`. Install the pinned OCR
  CLI before exposing a mode-`0600` ephemeral key config, remove it on every
  exit path, do not upload raw artifacts, and never log request bodies, tokens,
  or private tracker content.
- Keep DeepSeek on drafts because observed value and cost justify it. Use one
  cumulative strong code pass and one topology pass per stack, not one strong
  pass per layer by default.
- Use `z-ai/glm-5.3` for the manually triggered final code and topology passes.
  This replaces the previously planned Gemini final route at the user's
  explicit request; the new OpenRouter route remains unqualified live until a
  separately authorized, costed continuation.
- Serialize running final-status writers with the shared
  `final-ai-status-lock` and `cancel-in-progress: false`. GitHub still permits
  only one pending run per concurrency group and may replace an older pending
  run, so exact-head, status-target, and provenance revalidation remains the
  safety mechanism for every writer.
- Bind generated staging-promotion evidence to the exact workflow definitions
  at both the trusted policy commit and the promoted target commit. The
  repository-owned clean-status verifier also rechecks this no-report
  exemption instead of treating its status text alone as sufficient evidence.
- Bound the stack topology provider request to one megabyte after removing
  derivation-only patch operations from the serialized manifest, and request at
  most 4,096 output tokens. A mixed-case-safe code-unit path comparator is
  shared by manifest emission and metadata validation.
- Set the first cheap-review trial to concurrency `4`, a 45-minute job timeout,
  and a 480-second model timeout. Expose only documented, bounded counters,
  terminal state, elapsed time, and token totals. If the pinned action has no
  supported diagnostics output, omit diagnostics rather than parsing internal
  files or reimplementing the reviewer.
- Do not add a generated-promotion skip to cheap review. Verified promotions
  are ready PRs and the general draft-only rule already excludes them.

## Product primitive impact

| Primitive | Change | Owner and consumers | Invariant |
| --- | --- | --- | --- |
| Review snapshot | Extend one PR head to a versioned single-PR or stack identity manifest. | Trusted GitHub helper; final workflows and babysit agents. | Evidence names immutable Git identities and a policy digest. |
| Review phase | Add draft discovery, ready freeze, full final, remediation attestation, and ready. | GitHub workflows and `rs-babysit-pr`. | Only draft discovery is automatic; final review remains manual. |
| Finding disposition | Separate blocker/follow-up/rejected classification from fixed/ticketed/rebutted completion. | Review helpers, comments, and babysit journal. | Model labels never decide merge readiness. |
| Deferred work item | Compose the repository-configured issue tracker. | `rs-babysit-pr`; ClickUp in KlickerUZH. | No task without explicit authority and an unambiguous destination. |
| Merge readiness | Admit ticketed residuals and current descendant attestation. | `rs-babysit-pr` and human merger. | Green CI and zero non-terminal verified blockers remain required. |

## ADR gate

No ADR is required while both AI statuses remain procedural and advisory. This
plan and `docs/ci-and-deployment.md` own the current workflow contract. Re-arm
the ADR gate before making either status a required branch-protection context,
treating remediation attestations as authoritative merge evidence, making task
creation mandatory or default, or changing provider, retention, data-boundary,
or stack-landing semantics.

## Open execution gates

| Gate | Acceptance | Stop condition |
| --- | --- | --- |
| G1 Native stack API | Capture the endpoint, Actions-token permissions, response schema, pagination, and sanitized one-, two-, and four-layer fixtures. Cross-check every member with PR data and Git ancestry. | The official endpoint is unavailable, needs broader permissions, or would require hand-built topology inference. |
| G2 Cheap diagnostics | The pinned action exposes a documented output or manifest containing bounded counters, terminal state, elapsed time, and token usage. | Omit diagnostics; do not parse undocumented temporary files or add a second reviewer. Core draft-only behavior may continue. |
| G3 OpenRouter wire | A dummy-token local capture proves strict JSON Schema, high reasoning, `provider.require_parameters: true`, bounded sanitized input, and no token leakage. Malformed and partial output fail closed. | Any required field is dropped, credentials appear in output, or unsupported providers can ignore the schema. |
| G4 Contract freeze | Commands, statuses, metadata schemas, finding IDs, disposition record, round semantics, and cold-review triggers are fixed and tested. | Do not edit the shared skill until this contract is stable. |
| G5 Live qualification | Controlled post-merge runs prove draft cancellation, stack snapshot invalidation, descendant attestation, report publication, and native landing behavior. | Keep all statuses procedural and out of branch protection. |

## Skill routing, research, and delegation

- `rs-sliced-development-workflow`: full path because the package crosses
  privileged workflows, secrets, an external provider, stack topology, and a
  shared agent authority contract.
- `rs-model-routing`: the native read-only planner completed before this plan.
  Main owns security-sensitive implementation. A bounded executor may prepare
  synthetic qualification fixtures after the contract freezes.
- `rs-product-primitives`: the primitive changes are recorded above.
- `rs-stacked-change` and `gh-stack`: define the reviewed topology. The
  implementation itself remains one ordinary KlickerUZH PR.
- `writing-for-agents` and, during substantive shared-skill restructuring,
  `skill-creator`: keep the babysit state machine, authority envelope, and stop
  conditions explicit and scenario-testable.
- OpenRouter research used the official structured-output and provider-routing
  documentation. Exact runtime request shape remains gated by G3.

| Workstream | Route | Acceptance boundary |
| --- | --- | --- |
| S1 draft discovery | main | Privileged trigger, cancellation, and provider use remain in one owner. |
| S2 individual attestation | main | Status, disposition, and descendant-history invariants are security-sensitive. |
| S3 stack attestation | main | Native API, Git identities, provider call, and publication race stay coupled. |
| S4 qualification assets | bounded executor after G4 | Synthetic fixtures and offline evaluator have a disjoint write set and no live calls. |
| S5 shared babysit state machine | main in a separate dotfiles worktree | Changes external-write authority and merge-readiness semantics. |

Each substantive committed Klicker slice receives a simplifier and a
security/architecture slice reviewer in parallel. The qualification slice uses
a reliability lens. The shared-skill slice receives an independent
scenario-based review. One trusted final reviewer checks both exact committed
ranges and their cross-repository contract after fresh verification.

## Feature-wide test portfolio

| Consequential behavior | Obligation | Primary seam | Distinct failure protected |
| --- | --- | --- | --- |
| Cheap review runs only in draft and ready cancels in-flight work | focused workflow/helper tests | event classifier and concurrency configuration | late cheap comments restart ready-state work |
| Existing single-PR final review and promotion exemption remain valid | retain and extend tests | current final helper | stack work regresses the proven path |
| Full versus incremental attestation selection is deterministic | focused fixtures | pure snapshot and delta policy | a stale or expanded change inherits old evidence |
| Finding IDs and trusted dispositions bind exactly once | positive and adversarial fixtures | report/disposition parser | untrusted or ambiguous comments satisfy blockers |
| Latest status supersedes older success on the same SHA | focused status-history tests | status selector | lower-layer drift leaves a stale green stack status |
| Stack identity is exact | one-, two-, and four-layer fixtures plus malformed/fork/draft/cycle/drift cases | stack resolver and Git ancestry validator | membership order is mistaken for trusted topology |
| Cumulative and topology passes are both complete | parser and publication tests | OCR manifest plus strict OpenRouter schema | partial coverage publishes success |
| Topology findings name valid owners | overlap and multi-layer fixtures | exact per-layer delta index | findings are attached to the wrong layer |
| Tracker residuals are terminal only after an authorized task exists | scenario review | generic babysit state machine | a guessed list or missing ticket silently clears feedback |
| Two-round cap stops autonomous pushes | scenario review | babysit journal and stop rules | review and CI cycles continue indefinitely |
| PR-head content is never executed | static trust-boundary review | workflow refs, shell inputs, and permissions | untrusted code gains secret or write-token execution |

## Slice S1: bound cheap review to draft discovery

- Paths: `.github/workflows/check-ocr-review.yml`; add focused pure tests only
  if event-state behavior cannot be demonstrated statically.
- Behavior: add `ready_for_review` so workflow-level concurrency cancels an
  in-flight draft run, add `converted_to_draft` so draft review resumes, and
  guard the model job with `draft == true`. Opened-ready and ready
  synchronizations skip the model.
- Behavior: trial concurrency `4`, 45-minute job timeout, and 480-second model
  timeout. Add bounded diagnostics only if G2 passes.
- Check: event matrix, YAML parse/format, pinned-action and permission audit,
  `git diff --check`, staged secret/data inspection, then simplifier and
  security-focused slice review.
- Commit: `ci(ocr): bound cheap review to draft discovery`.

## Slice S2: attest remediated individual final-review heads

- Paths: `.github/workflows/check-ocr-final-review.yml`,
  `.github/scripts/final-ai-review.js`, its focused tests, and
  `.github/open-code-review/final-review-rules.json`.
- Behavior: preserve the default-base path and generated-promotion exemption;
  safely extend `/final-review` to a verified native stack member after G1.
- Behavior: add deterministic finding IDs, compact snapshot metadata, trusted
  disposition parsing, latest-status semantics, and full-versus-incremental
  selection with the cold-review triggers above.
- Behavior: make the strong prompt blocker-only. Repository content is never
  obeyed as instructions, but accepted ADRs, tests, and documentation are
  contract evidence.
- Check: existing tests plus full/incremental, digest, ancestry, bounds,
  untrusted disposition, duplicate, stale status, base-advance, and report-limit
  fixtures; JSON parse; workflow trust review; `git diff --check`; staged
  hygiene; simplifier and architecture/security slice review.
- Commit: `ci(ocr): attest remediated final review heads`.

## Slice S3: add native stack final attestation

- Paths: add a focused dependency-free stack helper and test module; extend the
  final-review workflow and rule/config files without turning the existing
  helper into the sole home for stack-specific logic.
- Behavior: implement the exact stack contract, `/final-review-stack`,
  cumulative OCR pass, strict topology call, compact manifest marker, prompt
  manifest digest, top-PR report, and `final-ai-stack-review` status. Bounded
  remediation attestation carries one validated OCR range per changed layer,
  then combines those results before the topology pass.
- Behavior: re-resolve before publication and reset the top status on any
  member drift. One-layer, fork, draft, malformed, cyclic, unsynchronized, or
  stale stacks fail closed with actionable guidance.
- Check: G1 and G3 probes; valid one-, two-, and four-layer fixtures; wrong
  ultimate base, duplicate/cycle, malformed API, lower drift, unrelated and
  material base movement, non-descendant remediation, HTTP/finish reason,
  strict schema, owner validation, warnings, usage, cleanup, per-layer OCR
  aggregation, and overflow failures; static no-PR-head-execution review; simplifier and
  architecture/security slice review.
- Commit: `ci(ocr): add native stack final attestation`.

## Slice S4: qualification assets and operator documentation

- Paths: synthetic fixtures and a dependency-free offline evaluator under the
  existing `.github/open-code-review/` or helper-test area, plus
  `docs/ci-and-deployment.md` and this plan's `Progress`.
- Behavior: include at least eight public-safe fixtures covering true blockers,
  false-blocker traps, contract evidence, prompt injection, and valid/invalid
  stack topology. Do not copy private PR or ClickUp content.
- Metrics: first-trigger success, runtime and GitHub Action minutes, schema
  validity, three-run repeatability, false blockers against adjudicated
  expectations, and available token/cost totals.
- Boundary: implementation adds fixtures and the offline evaluator only. Live
  OpenRouter qualification and any acceptance thresholds require a later,
  explicitly costed continuation.
- Check: fixture schema tests, evaluator self-tests, docs format, repository
  check suite, staged hygiene, simplifier, and reliability-focused review.
- Commit: `test(ocr): add final review qualification fixtures`.

## Slice S5: bound the shared babysit state machine

- Repository: dotfiles, in a fresh task worktree from current `origin/master`.
  Do not edit, clean, stash, or copy the dirty primary checkout. Semantically
  replay and preserve its user-authored rule that unrelated base movement does
  not invalidate unchanged head-scoped evidence.
- Paths: `agent-resources/agent-skills/rs-babysit-pr/SKILL.md` and its platform
  command reference only when native-stack discovery requires it.
- Behavior: add the lifecycle, terminal dispositions, generic configured-tracker
  composition, one push per captured head, two-round cap, manual final-review
  gate, stack-aware top status, and true `blocked` stop for unresolved authority
  or judgment.
- Check: blocker fixed/resolved; follow-up ticketed and ready; rejected with
  evidence; no task without authority/destination; one batch per head;
  two-round stop; ticketed residual readiness; unrelated base preservation; and
  top-stack manual gate. Run the skill validator, `git diff --check`, staged
  hygiene, and one independent scenario review. Avoid brittle prose snapshots.
- Commit: `fix(rs-babysit-pr): bound final review remediation`.
- Coordination: after S5, update this plan's `Progress` with the exact dotfiles
  commit in one small local Klicker coordination commit.

## Finish gate and delivery

- Run focused Node tests, JSON/YAML parsing, the G3 dummy-token capture, static
  permissions and trusted-base review, `git diff --check`, and staged secret and
  personal-data inspection.
- Run `pnpm run check:all` inside the Klicker devcontainer. No application
  runtime or browser verification is required because the package changes only
  CI policy, tests, documentation, and a shared agent skill.
- Run the required slice reviews and one integrated final reviewer over both
  exact committed ranges after all corrections and fresh checks.
- Update `Progress` with checks, review dispositions, commit SHAs, and every
  withheld live-proof item. Stop with local commits; do not push or create PRs.

## Post-implementation continuation

With separate authority, publish the two packages and perform G5 on controlled
draft, unstacked, and native-stack PRs. Prove ready-event cancellation, manual
authorization, lower-layer invalidation without a top-SHA change, descendant
attestation, finding disposition, and native landing behavior. Observe several
real runs before proposing any parameter retune or branch-protection context.

## Progress

- Status: implementation, corrections, and local verification are complete on
  both task branches. The clean-evidence correction series and the final
  digest simplification are committed with green focused suites. Publication
  to a PR is authorized by the user; merge and live qualification remain
  withheld.
- Delivered: draft reviews stay cheap and non-blocking; manual final review is
  the merge gate; native-stack reviews reconstruct the verified layer path,
  preserve cumulative findings and topology, and attest bounded repairs across
  any changed layer. Reports bind current head, workflow run, trusted policy
  checkout, manifest, disposition digest, and exact review range. Metadata
  markers are canonical base64url payloads (`final-ai-review/v4` and
  `final-ai-stack-review/v3`). Finalization protects newer invalidation
  statuses, and review concurrency serializes running status writers with the
  supported `group` and `cancel-in-progress: false` fields while stale writers
  still fail closed. Generated promotion no-report evidence is independently
  reverified, and topology requests now discard derivation-only patch
  operations and enforce request/output budgets. Babysitting now
  paginates all relevant GitHub surfaces and stops after a 12-tick default
  watch budget without creating another continuation.
- Correction commits: KlickerUZH `307fa5dcb`, `49f6611cd`, `f5718ae15`,
  `7bc1d6abf`, `58a485f13`, `ca234d351`, `51dda1954`, `72ca104f1`,
  `1c28fa75b`, `33571b172`, `66541c7b7`, `0b5adb907`, and `e38a0db09`;
  clean-evidence series `bb5245a55`, `eefccce6e`, `29b511e7f`,
  `0970ed8c4`, `bda464e39`, `6047592fa`, and simplification
  `d8afc59ec`; dotfiles `01c4f10`, `9032b1b`, `cf970a4`, `d2d7a88`,
  `daf165d`, `5454d0e`, `a9b2c57`, and `ab9abcb`. The Klicker worktree
  has only this plan update pending; the dotfiles worktree is clean.
- Completed: S1 draft-only discovery, S2 individual descendant attestation, S3
  native-stack attestation, S4 offline qualification assets and documentation,
  and S5 bounded shared babysit state-machine guidance. The implementation
  review ranges are KlickerUZH `2b83fbb49^..e38a0db09` and dotfiles
  `f09cf138^..ab9abcb`; the coordination update remains uncommitted until
  the final review dispositions are recorded.
- G1 is satisfied locally: the native stacks endpoint was probed, its missing
  base-ref limitation was recorded, and every member is cross-checked through
  PR data and Git ancestry. Valid two- and four-layer plus malformed and drift
  fixtures pass the offline contract tests. G2 remains intentionally open:
  the pinned cheap-review action exposes no documented bounded diagnostics, so
  no undocumented output parsing was added.
- G3 is satisfied for the local wire contract: dummy-token tests verify the
  high-reasoning strict schema, `provider.require_parameters`, bounded input,
  and token exclusion. No live OpenRouter qualification call was made. G4 is
  satisfied: commands, statuses, metadata, finding IDs, dispositions, round
  semantics, and cold-review triggers are fixed and covered. G5 remains
  withheld for a separately authorized post-publication qualification.
- Verification: after the final simplification, the combined Node suite
  (`final-ai-review`, `final-ai-stack-review`, and qualification suites)
  passes 79 of 79 and Biome formatting is clean on the touched file. The offline
  evaluator passes all 8 fixtures with digest
  `e553bd3adbb893f515d2a87b4a6834b864e8694e433d8fcfe9eb940ebcb2c2df`.
  `pnpm run check` passes 25 of 25 packages, and formatting, both
  `git diff --check` ranges, commit-range gitleaks scans, and the shared-skill
  validator pass. `actionlint` is unavailable. `pnpm run check:all` remains
  blocked only by the analytics lint environment: pandas 2.2.2 cannot build
  because the DevPod image has no C compiler (`cc`, `gcc`, or `clang`).
- Review routing: the configured Gemini simplifier and risk routes terminate
  at the OpenRouter provider credit limit, so the required current-range gates
  use trusted Sol (`gpt-5.6-sol`, `xhigh`) as the documented fallback. Earlier
  trusted Sol reviews found and led to fixes for provenance binding, stack-root
  and lower-layer invalidation, top-layer identity drift, consolidated report
  ranges, missing Actions read permission, incremental-root replacement, and
  shared-skill capability/platform contradictions. The latest correction pass
  additionally covers stale finalization races, disposition-aware attestation,
  historical stack-root reconstruction, safe metadata encoding, and the
  babysit watch budget.
- Review evidence: the previous current-range simplifier and risk review both found
  actionable issues. The correction pass now removes unsupported workflow
  syntax, binds promotion runs to trusted workflow definitions, makes
  promotion statuses verifiable by the babysitter, reserves every
  head-changing remediation path, canonicalizes reviewed-path ordering,
  removes dead stack plan state, and bounds topology payloads. The integrated
  final reviewer remain to be rerun over the correction commits. A read-only
  `git merge-tree` check reports a current-base conflict only in
  `docs/ci-and-deployment.md`, where the competing text is semantically
  identical. Rebase and merge remain withheld by this plan. The live API may
  not retain a removed member's closed stack record; when it does not, the
  initializer can only fail closed on the event head. This remains a G5 live
  proof item. The final simplifier finding (duplicate stack digest projector)
  was applied in `d8afc59ec`; per the user's takeover direction, no further
  per-commit reviewer loops are run — the integrated branch carries fresh
  green suites instead.
- Runtime: the exact task DevPod supported all container checks, but its
  post-start auth readiness contract failed because the task environment lacks
  the expected `.env`; no runtime or browser proof is required for this
  CI/skill-only package. Stop and verify the exact runtime after the final
  review.
- Next: commit this progress update, push the branch, and open the
  user-authorized PR against `v3`. Do not merge, deploy, write ClickUp
  tasks, alter branch protection, or delete the task worktrees; `origin/v3`
  has advanced and any rebase stays user-gated. Stop and verify the exact
  task runtime after publication.
- Simplification pass (post-PR): extracted the nine byte-identical helpers
  shared by both final-review scripts into
  `.github/scripts/final-ai-review-shared.js`, and merged
  `check-ocr-final-stack-review.yml` into `check-ocr-final-review.yml`
  as separately conditioned `*_stack` jobs sharing one trusted-policy and
  lock head. Stack provenance now points at the merged workflow path. This
  halves the always-running shared jobs per PR event; all 99 focused tests,
  Biome, and Prettier pass after the merge.
