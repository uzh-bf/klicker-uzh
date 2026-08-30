# Peer Instruction for LiveQuiz

## Goal

Add a complete formative Peer Instruction sequence to standard LiveQuizzes:
participants answer a frozen block individually, discuss their reasoning,
answer the same questions again, and compare the paired group evaluations
before a lecturer debrief.

The capability must support every established answerable LiveQuiz question
type, work when prepared during editing or invoked spontaneously during
delivery, preserve the existing scoring of initial answers, and keep revised
answers entirely outside scoring, gamification, assessment, and durable
participant history.

## Non-goals and authority

- No grades, points, XP, achievements, leaderboards, access consequences,
  reminders, discussion chat, group formation, AI debrief, mastery model, or
  analytics feed.
- No support for assessment-enabled LiveQuizzes. `CONTENT` remains display-only,
  and `FLASHCARD` remains outside the answerable LiveQuiz contract.
- No durable participant pairs, correlated response export, raw response
  history, or reuse of the correlated-export persistence work.
- No Catalyst entitlement or private-service dependency for the core sequence.
  Optional future AI debrief, semantic free-text clustering, or cross-session
  analytics remains a separate capability and contract.
- No upstream integration, ready-for-review transition, merge, deployment,
  production proof, live-data action, or worktree/branch cleanup.

Gate 1 approval authorizes the execution orchestrator to make the local edits,
run repository-native checks, create conventional local commits, create the
second stack branch, push exactly the two validated stack branches to `origin`,
and open or update exactly two draft PRs through native GitHub stacks. Execution
must pause at Gate 2 after the foundation validates and before teaching-UX work
starts. Gate 2 does not expand the withheld actions above.

## Execution contract

- **Execution owner:** the main session is the package execution orchestrator.
  It owns decomposition, migration generation, integration, review
  disposition, verification, stack management, draft publication, and this
  plan's `Progress` updates.
- **Boundary owner:** the user rules on Gate 1 and Gate 2 and separately
  authorizes any withheld external action.
- **Working model:** substantial slices may use the plan's named native
  execution or review routes. The main session keeps architecture, privacy,
  data-integrity, scoring, and cross-system decisions.
- **Terminal condition:** both stack layers are committed, verified, reviewed,
  pushed, and published as draft PRs, with exact evidence recorded here. Merge,
  deployment, production proof, and cleanup remain pending separate decisions.

## Plan identity

- Plan: `project/2026-08-30-peer-instruction-livequiz-plan.md`
- Repository: `klicker-uzh`
- Worktree: `trees/peer-instruction-livequiz`
- Bottom branch: `rs/peer-instruction-livequiz` targeting `v3`
- Top branch: `rs/peer-instruction-livequiz-ux` targeting the bottom branch
- Planning base: `origin/v3` at `cd7426e3c59dbd8a63208a0afb162427918d9367`
- PRs: not yet opened
- Planning review:
  `project/_local/reviews/2026-08-30-peer-instruction-livequiz-planner.md`

## Research and evidence

- [University intrinsic and social gamification research](./2026-08-30-university-intrinsic-social-gamification-research.md)
  identifies Peer Instruction as the strongest university-specific next
  direction because it builds reasoning, peer explanation, and visible
  conceptual change without relying on extrinsic rewards.
- The current LiveQuiz response path aggregates standard responses in Redis and
  applies scoring through the response worker. It has no initial/revised phase,
  paired cohort, or retained comparison snapshot.
- The existing evaluation dispatcher already provides type-specific evaluation
  semantics. Peer Instruction can reuse those semantics, but it needs a new
  role-filtered projection because the current lecturer/HMAC payload is not a
  safe participant or projected-view boundary.
- The current control flow already has a lecturer-controlled gap after a block
  closes and before another block activates. That is the spontaneous invocation
  window.
- No component-test layer exists. The package should extend the existing
  GraphQL test suites and the `O1-live-quiz-core` and
  `O2-live-quiz-collaboration` Playwright journeys.

## Settled product contract

| Area | Ruling |
| --- | --- |
| Sequence | Initial answer, external peer discussion, revised answer, comparison, lecturer debrief. |
| Scope | Standard LiveQuiz only; all answerable types: SC, MC, KPRIM, FREE_TEXT, NUMERICAL, SELECTION, and CASE_STUDY. |
| Invocation | A block can be prepared while editing or invoked for the most recently closed block. Another block activation closes the spontaneous window. |
| Lecturer control | The lecturer confirms the sequence and controls discussion, revision start, revision close, and reveal. There are no automatic thresholds or phase timers. |
| Attempts | One pedagogical revised run per block execution. One technical replacement may use the same frozen block; a second failure abandons the sequence. |
| Cohort | Only identities with both initial and revised answers contribute to either aggregate panel. Revised-only submissions are counted separately and remain unscored. |
| Timing | Discussion is untimed. Revision inherits the original block time limit. |
| Display | Reuse question-type evaluation renderers labelled `Initial` and `Revised`; place them together on wide screens and sequentially on narrow screens. No universal improvement score. |
| Reveal | Discussion omits correctness, solutions, and explanations. Reveal uses the frozen configured solution/explanation where available, otherwise a neutral debrief prompt. |
| Privacy | Lecturer receives complete aggregates. Participant/projected distributions are suppressed below three paired responses. Raw free-text aggregates remain lecturer-only. |
| Participant record | The participant can see their own initial and revised answers during the session. No individual pair, answer history, or mastery state is retained by the platform. |
| Cancellation | Keep the initial run and its existing scoring, discard the partial revised comparison, and continue the quiz. |
| Ownership | The complete sequence is public and ungated. Catalyst may later add optional computation, but cannot own its lifecycle, pairing, comparison, authorization, or teaching surfaces. |

## Primitive impact

| Primitive | Disposition | Contract delta |
| --- | --- | --- |
| Standard LiveQuiz | Extend | Add one lecturer-controlled formative sequence after a closed block; assessment mode remains unchanged and rejects these actions. |
| ElementBlock | Extend | Store the preparation default and the minimum durable lifecycle/run state for one bound execution and one technical replacement. |
| ElementInstance | Extend | Retain one anonymous, type-specific initial/revised comparison snapshot and counts; never retain participant pairs. |
| LiveQuiz response processing | Extend | Collect short-lived pairing input during initial runs and process revisions in a separate non-scoring namespace. |
| Peer Instruction projection | Create | Serve one canonical comparison with server-derived lecturer, participant, and projected-view filtering. |
| Gamification and assessment | Reuse unchanged | Initial scoring keeps current behavior. Revision cannot write points, XP, achievements, leaderboards, grades, access state, or durable assessment responses. |
| Catalyst | Reuse unchanged | No entitlement or private service is required. Optional future computation may consume the public aggregate contract without weakening the standard sequence. |

## ADR gate

[ADR 0045](../docs/adr/0045-peer-instruction-transient-pairing.md) records
the hard-to-reverse identity, persistence, scoring, atomicity, viewer-access,
and public-ownership boundary. [ADR 0006](../docs/adr/0006-public-catalyst-capability-floor.md)
records the corresponding public capability floor. Stop and reassess if
implementation would require durable participant identity, correlated response
rows, a different privacy purpose, Catalyst entitlement, or private services
for the core sequence.

## Data protection by design and by default

| Principle | Default and measure |
| --- | --- |
| Data minimization | Collect only a quiz/execution-scoped pairing identity and the answer values required to form the paired aggregate. No names, emails, participant foreign keys, or learning profile enter the feature state. |
| Purpose limitation | Use transient data only to pair the two runs, form the debrief comparison, and let the participant see their own session answers. Do not reuse it for analytics, mastery, personalization, or gamification. |
| Storage limitation | Keep pairing tokens and response maps in Redis with a non-renewing 24-hour hard limit and earlier lifecycle deletion. Persist only anonymous aggregate snapshots and counts. |
| Access limitation | Derive lecturer, participant, and projected roles server-side. Require `EXECUTE` for actions and authenticated `READ` for the lecturer comparison. HMAC access never upgrades to lecturer access. |
| Privacy by default | Suppress participant/projected distributions below three paired responses. Never expose free-text aggregate strings outside the lecturer projection. |
| Integrity | Issue unguessable anonymous tokens on the server, scope every namespace to quiz/block/execution/attempt/phase/instance, and accept one response per transient identity and question. |
| Accuracy | Compute both panels from the same identity intersection and label paired and unpaired counts explicitly. Do not synthesize an improvement score across incompatible question types. |
| Transparency | Explain the sequence, paired cohort, unpaired count, suppression state, and formative-only effect in the UI without implying grading or permanent tracking. |
| User control | The lecturer explicitly starts every phase and may cancel. Participants choose whether to submit a revision; revised-only submissions remain formative and unpaired. |

Participant own-answer data may remain in browser session storage through the
debrief so it survives a page transition in the same session. It uses a
revision-specific key and clears when the quiz/session ends or the hard limit is
reached. It is not synchronized as learning history.

## Architecture

### Minimal persistent model

- Add a preparation boolean to `ElementBlock`, defaulting to false.
- Add an explicit Peer Instruction phase plus one nullable, validated run-state
  payload to `ElementBlock`. The payload binds the original block execution,
  technical attempt, frozen ordered instance identifiers, and revision timing.
- Add one nullable, validated comparison snapshot to `ElementInstance`. It
  carries the bound execution, paired count, unpaired revised count, and the
  type-specific initial/revised aggregates.
- Copy only the preparation preference through templates and duplication.
  Never copy lifecycle or comparison state.
- Generate exactly one additive Prisma migration, regenerate the client, and
  run Prisma sync for analytics. Do not hand-write migration SQL.
- Finalize all instance snapshots and the comparison-ready phase in one
  database transaction. A failure leaves no partial retained comparison.

### Transient pairing and revision processing

- Namespace state by quiz, block, original execution, technical attempt,
  phase, and instance.
- Keep the minimum per-identity initial answer map for every standard,
  non-assessment block until the spontaneous window closes. This makes a later
  lecturer decision possible without changing the ordinary initial result.
- Reuse existing transient identity for authenticated and temporary
  participants. Issue a server-generated, unguessable, scoped token for fully
  anonymous participants; never accept a client-selected identity.
- Freeze the original ordered instance manifest, content, and option order.
  Revision does not increment or reuse the ordinary scoring execution path.
- Register accepted revision message identifiers atomically before queue
  publication. Remove a claim after definitive publication failure. The
  dedicated revision processor records one terminal status and one response per
  identity without importing or calling scoring, gamification, assessment, or
  durable response-history helpers.
- Closing revision seals ingress, then waits for every accepted message to
  become terminal before aggregation. A bounded drain failure clears only the
  revised attempt and permits one replacement against the same initial map and
  frozen manifest. A second failure abandons Peer Instruction.
- Clear transient data on another block activation, cancellation, reset,
  successful finalization, abandonment, or the non-renewing hard limit.

### Lifecycle and projection

- Use explicit, server-validated transitions for available, discussion,
  revision-open, revision-finalizing, comparison-ready, revealed, cancelled,
  replacement-available, and abandoned states. Reject stale or repeated action
  requests idempotently.
- Actions use the existing user-session execution wrapper and `EXECUTE`
  permission. Assessment-enabled quizzes fail closed before any state change.
- Build both aggregate panels from the exact identity intersection per question
  instance. Revised-only answers increment the unpaired count and affect
  neither aggregate.
- Add a dedicated comparison projection instead of extending the existing full
  evaluation/HMAC payload. The server derives the viewer from the authenticated
  lecturer session, participant session/token, or projected-view HMAC.
- Lecturer output retains complete type-specific aggregates. Participant and
  projected output is an allowlist with cohort suppression, no raw free-text
  values, and no alternate legacy-HMAC path to restricted data.
- Reuse the configured solution and explanation only after the lecturer reveals
  them. Preserve a neutral debrief state when they do not exist.

## Related open work

| Work | Current relationship | Action in this package |
| --- | --- | --- |
| PR #5134 and draft replacements #5368/#5370–5376 — correlated response export | Different durable identity and privacy purpose | Do not depend on or reuse its persistence. Reassess only if its API contracts land on `v3`. |
| PR #5315 — response-processing counts | Potential overlap in accepted/processed accounting, currently open and dirty | Plan on current `v3`. If it lands before the relevant slice, inspect and reuse compatible current-base behavior without changing this package's privacy contract. |
| PR #5515 — student gamification | Separate package with no Peer Instruction dependency | Keep separate. Peer Instruction is available independently of course gamification and participant gamification opt-in. |

## Stack topology

| Layer | Branch and base | Complete work package | Acceptance boundary |
| --- | --- | --- | --- |
| 1 — Peer Instruction foundation | `rs/peer-instruction-livequiz` → `v3` | Plan and domain contract; one migration; transient identity and response pipeline; lifecycle/replacement state machine; atomic aggregation; dedicated role-filtered projection; cancel/reset; backend tests and wiki. The feature remains undiscoverable and preparation defaults off. | Migration count/provenance, schema equivalence and analytics sync; GraphQL codegen/tests; scoring/privacy assertions; `check:all`; build; reviews. Then Gate 2. |
| 2 — Complete teaching UX | `rs/peer-instruction-livequiz-ux` → layer 1 | Authoring/template flows; controller actions; lecturer comparison; participant revision and own answers; projected comparison; responsive layout; i18n; browser/E2E evidence and frontend/testing wiki. | Focused O1/O2 Playwright journeys; role/privacy matrix; desktop/mobile and EN/DE browser proof; `check:all`; build; final review and per-layer CI. |

Both layers may exceed the stack size diagnostic. They remain the smallest safe
work packages: the foundation is one inseparable scoring/privacy/data-plane
contract, and the top is one complete teaching journey. Do not split tests,
persistence, or public privacy into a third layer.

## Delegation map

| Slice | Owner or route | Dependency | Acceptance boundary |
| --- | --- | --- | --- |
| S0 — Persist the reviewed plan | Main | Gate 1 approval | Plan, research, ADR, CONTEXT, branch/base, and authority boundary are committed without implementation. |
| S1 — Minimum persistent model | Main | S0 | One generated additive migration; analytics sync; default-off preparation; no durable identity; schema and domain docs agree. |
| S2 — Transient pairing and revision processor | Main | S1 | Duplicate/concurrent tests prove one response per identity, complete drain accounting, one replacement, hard cleanup, and zero scoring or durable response writes. |
| S3 — Lifecycle, aggregation, and projection | Main | S2 | GraphQL integration tests cover permissions, phases, all supported types, identical paired cohorts, atomic finalization, threshold, HMAC, and free-text fail-closed behavior. Gate 2 follows. |
| S4 — Authoring and lecturer/controller loop | Native executor, authoring/control paths | S3 and Gate 2 approval | Preparation survives create/edit/template/duplication; controller owns transitions; cockpit reconnects to persisted phase; lecturer browser evidence passes. |
| S5 — Participant and projected journey | Native executor, PWA/comparison paths | S4 | Revision uses separate session keys; own answers remain visible; suppression and narrow layout pass browser and O1/O2 checks. |
| S6 — Integrated package verification | Main | Accepted S4 and S5 | Reviews are dispositioned, complete stack checks pass, Progress records exact evidence, and exactly two draft PRs are published. |

Main-session skip reason for S1–S3: privacy, scoring, migration, worker, and
atomic-finalization seams are tightly coupled and remain the execution
orchestrator's architecture and data-integrity responsibility. S4 and S5 are
serial to avoid cross-surface contract drift; each executor receives a disjoint
write scope and cannot alter the settled server contract.

## Feature-wide test portfolio

| Risk or behavior | Obligation | Primary seam | Distinct failure caught |
| --- | --- | --- | --- |
| Existing initial scoring is unchanged | Extend existing | GraphQL/worker integration | Revision grants or removes points, XP, achievements, leaderboard state, grades, or access. |
| Pairing is scoped and transient | Add | Redis/state tests | A token crosses quiz/execution boundaries, is client-selected, is logged/persisted, or survives cleanup. |
| Revision ingestion is idempotent | Add | Response API and processor concurrency tests | Retries or concurrent events create duplicate revised answers or inconsistent drain counts. |
| Finalization is complete and atomic | Add | Service/database integration | A close omits accepted work or persists only some instance snapshots. |
| Cohorts are comparable | Add | Table-driven aggregation tests | Initial and revised panels use different identities, or revised-only answers affect an aggregate. |
| All supported types retain their semantics | Extend existing | Evaluation dispatcher/projection tests | SC, MC, KPRIM, FREE_TEXT, NUMERICAL, SELECTION, or CASE_STUDY is mis-aggregated; CONTENT/FLASHCARD is treated as answerable. |
| Privacy is role-derived and fail-closed | Add | GraphQL projection tests | Requested roles, HMAC, small cohorts, or free text reveal lecturer-only data. |
| Lifecycle is recoverable and bounded | Add | State-machine tests | Stale actions reopen phases, reconnect loses state, or more than one replacement becomes possible. |
| Prepared and spontaneous invocation both work | Extend existing | O1 LiveQuiz core | Preparation is copied incorrectly, spontaneous scope escapes the latest block, or time limit/order changes. |
| Complete multi-participant journey works | Extend existing | O2 collaboration | Paired/unpaired counts, own answers, suppression, reveal, cancel, or reconnect diverges across surfaces. |
| Responsive and accessible comparison is usable | Add browser proof | Controller/manage/PWA/projected UI | Initial/Revised becomes unreadable, misordered, or inaccessible on narrow screens or in one locale. |

## Slices and review gates

### S0 — Commit the product contract and execution plan

- Commit the research, ADRs 0006 and 0045, ADR index, and CONTEXT definition as
  the resolved product-contract commit.
- Commit the reviewed execution plan separately before implementation.
- Inspect the staged diff for secrets, personal data, unrelated hunks, and
  accurate links.
- Commits: `docs(live-quiz): define public Peer Instruction boundary`, then
  `docs(project): plan Peer Instruction for LiveQuiz`.

### S1 — Add the minimum persistent model

- Add the default-off preparation field, typed lifecycle/run-state contract,
  and per-instance comparison snapshot.
- Generate one Prisma migration with the repository tool; regenerate the
  client; run analytics schema sync. Never hand-edit SQL.
- Ensure templates and duplication copy only preparation, while reset and
  cancellation clear runtime/comparison state.
- Update ADR 0045 as needed, `docs/domain-model.md`, and
  `docs/data-and-migrations.md`.
- Check migration count, generated provenance, schema equivalence, retained
  operations, analytics mirror, Prisma/package checks, and focused tests.
- Commit: `feat(live-quiz): add Peer Instruction state model`.
- Review the immutable slice with one simplifier and one slice reviewer covering
  data integrity, privacy, migration discipline, and compatibility.

### S2 — Add transient pairing and non-scoring revision processing

- Collect minimum initial pairing maps for standard blocks, issue scoped
  anonymous tokens, and implement the separate revision namespace and worker.
- Add accepted/terminal accounting, sealed-ingress drain, cleanup, and one
  technical replacement without touching the initial map.
- Prove revised responses cannot reach existing scoring, gamification,
  assessment, or durable response-history helpers.
- Update `docs/async-and-workers.md` and the relevant data-flow wiki section.
- Check focused response API/worker/Redis tests, concurrent duplicate events,
  hard cleanup, replacement, and unchanged initial scoring.
- Commit: `feat(live-quiz): process transient Peer Instruction revisions`.
- Review the immutable slice with one simplifier and one slice reviewer covering
  data integrity, privacy, concurrency, idempotency, and failure recovery.

### S3 — Add lifecycle actions, atomic aggregation, and safe projection

- Add permission-checked state transitions, latest-closed-block guard,
  assessment exclusion, close/finalize/cancel/reset, and reconnect projection.
- Reuse type-specific evaluation semantics to aggregate the paired identity
  intersection and persist all snapshots atomically.
- Add the dedicated role-derived comparison projection with threshold and raw
  free-text restrictions. Do not widen the legacy HMAC payload.
- Regenerate GraphQL operations/schema and update
  `docs/graphql-api-layer.md`.
- Check `pnpm --filter @klicker-uzh/graphql test:local`, table-driven type
  coverage, authorization/HMAC tests, atomic-failure tests, codegen,
  `pnpm run check:all`, and `pnpm run build`.
- Commit: `feat(live-quiz): expose private Peer Instruction comparisons`.
- Review the immutable slice with one simplifier and one slice reviewer covering
  correctness, privacy, authorization, architecture, and atomicity.
- Publish or update the bottom draft PR only after its committed content and
  reviews pass. Record exact SHA, commands, and any CI gap.

### Gate 2 — Foundation acceptance

Pause after S3. Present the bottom branch's exact SHA, migration provenance,
test/build evidence, review dispositions, target drift, and draft-PR state. Ask
the user to approve starting the teaching UX. Do not treat a timeout, local
success, or draft publication as Gate 2 approval.

### S4 — Add authoring and lecturer/controller workflow

- Create the top branch from the accepted bottom layer through native GitHub
  stack tooling.
- Add preparation to create/edit/template/duplication flows without copying
  runtime state.
- Add prepared and spontaneous controller actions, latest-block eligibility,
  explicit discussion/revision/close/reveal/cancel controls, reconnect states,
  paired/unpaired counts, and lecturer comparison.
- Add i18n and accessible phase/status language. Update
  `docs/frontend-conventions.md`.
- Check focused frontend packages plus delegated-login browser proof for
  prepared and spontaneous flows, reconnect, cancellation, replacement, and
  lecturer comparison in English and German.
- Commit: `feat(live-quiz): add Peer Instruction teaching controls`.
- Run one simplifier. Run a slice reviewer if implementation crosses the
  server contract or introduces a concrete accessibility/privacy risk.

### S5 — Add participant and projected comparison journey

- Add revision submission through the dedicated namespace, session-scoped own
  initial/revised answers, privacy-filtered comparison, neutral suppression and
  missing-explanation states, and sequential narrow-screen layout.
- Keep raw peer free text absent from participant/projected code paths.
- Extend `O1-live-quiz-core.spec.ts` and
  `O2-live-quiz-collaboration.spec.ts`; do not create a test-only component
  layer.
- Update `docs/testing.md` and any affected frontend wiki sections.
- Check focused O1/O2 runs plus `agent-browser` screenshots for participant and
  projected states at desktop and mobile widths in English and German.
- Commit: `feat(pwa): add Peer Instruction revision and comparison`.
- Review the immutable slice with one simplifier and one slice reviewer covering
  privacy, accessibility, responsive behavior, state consistency, and plan
  compliance.

### S6 — Integrate, verify, and publish the draft stack

- Apply only verified review findings, update wiki logs, and account for every
  changed hunk against this plan.
- At each layer tip run applicable codegen, focused suites,
  `pnpm run check:all`, and `pnpm run build`; reuse only evidence from unchanged
  source and environment.
- Run the two focused Playwright journeys through the repository host launcher.
  Use `agent-browser` for the final lecturer, controller, participant, and
  projected-view matrix; retain before/after or state screenshots for the PR.
- Run one integrated final reviewer across the complete top-of-stack range.
- Inspect staged and committed content for secrets and real personal data.
- Push exactly the two branches and publish/update exactly two draft PRs through
  native GitHub stacks. Update each complete branch description only after its
  applicable review gate passes.

## Verification matrix

| Layer | Required evidence |
| --- | --- |
| Foundation | One generated migration; Prisma schema/client/analytics sync; GraphQL codegen; focused service/worker/Redis tests; `pnpm --filter @klicker-uzh/graphql test:local`; `pnpm run check:all`; `pnpm run build`; scoring and privacy assertions; slice reviews. |
| Teaching UX | Focused frontend checks; O1/O2 Playwright journeys; controller/manage/PWA/projected browser matrix; 1440x900 and 390x844; English and German; keyboard and accessible-name spot checks; `pnpm run check:all`; `pnpm run build`. |
| Integrated stack | Exact branch SHAs and target bases; exact diff inspection; per-layer CI status; final review; draft PR links; explicit remaining runtime or CI gaps. |

The implementation uses the self-contained devcontainer and exact worktree
routes. Any runtime started for a layer is stopped and verified stopped after
its final runtime-dependent check unless the user explicitly keeps it running.

## Stop conditions

Stop and return to the user if any of these becomes necessary or true:

- durable participant identity or participant-level response history;
- manual migration SQL, a second migration, or avoidable model changes;
- non-atomic partial comparison persistence;
- reuse of the existing scoring worker for revised responses;
- lecturer-level data through HMAC or raw free text outside lecturer access;
- a third stack layer or a materially different user journey;
- response-count work lands and materially changes the planned concurrency
  seam;
- target drift creates an overlapping implementation or blocks the stack.

## Progress

- **Status:** Gate 1 and the public-ownership ruling are approved; S0 is
  complete and S1 is next. No implementation, pushes, branches beyond the
  bottom branch, or PR creation has begun.
- **Completed:** university-specific research; product grilling and rulings;
  codebase seam exploration; privacy-by-design pass; current-base worktree;
  CONTEXT definition; ADR 0045 and index; native Sol planning review; accepted
  two-layer topology and corrections; public, ungated ownership ruling aligned
  with ADR 0006; product-contract commit `b1dc3d9c6`.
- **Base state:** `rs/peer-instruction-livequiz` matched `origin/v3` at
  `cd7426e3c59dbd8a63208a0afb162427918d9367` when the reviewed plan was written.
- **Planning review:** `DONE_WITH_CONCERNS — APPROVE_WITH_CHANGES`; all changes
  are incorporated, and no material product decision remains open.
- **Runtime:** the exact worktree container started, but the full application
  readiness check failed because the initial GraphQL build was killed with exit
  137 under the parallel development stack, so auth never started. Bounded
  repository commands remain available in the container. The earlier
  `gamification-roadmap` runtime is stopped and has zero devrouter routes.
- **Active children:** none after the planner is closed.
- **Next action:** commit this reviewed plan as the second S0 commit, then begin
  S1 on the current bottom branch.
