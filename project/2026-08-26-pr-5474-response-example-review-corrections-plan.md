# Response-example review corrections — PRs #5474 and #5498

## Plan identity

- Date: 2026-08-26
- Ceremony: full path
- Status: executing K1 Gate 2 evidence under the approved full-path goal
- Plan: `project/2026-08-26-pr-5474-response-example-review-corrections-plan.md`
- Historical design:
  [chatbot response-example design](./2026-08-21-chatbot-response-example-design.md)
- Historical implementation ledger:
  [chatbot response examples implementation plan](./2026-08-21-chatbot-response-examples-implementation-plan.md)
- Repository: `uzh-bf/klicker-uzh`
- Worktree: `trees/chatbot-response-examples-design`
- Current branch: `feat/response-examples-foundation`
- Target branch: `v3-ai`
- Existing stack: PR #5474 `feat/response-examples-foundation` -> `v3-ai`,
  then PR #5498 `feat/response-examples-review` ->
  `feat/response-examples-foundation`
- GitHub stack: #5503; its two-layer topology remains unchanged
- Execution mode: guided because K1 changes a migration, owner-authorized API,
  stale-write behavior, and the shared Markdown validation boundary

## Goal

Correct the existing K1 foundation and K2 lecturer-review layers so they are a
small, accurate, and merge-ready foundation for response examples. Preserve
the accepted first-release product model while fixing migration provenance,
stale edits, state transitions, citation semantics, parser complexity, and
misleading source wording.

The package ends with the two existing branches rebased onto the selected
`v3-ai` base, independently green, reviewed, pushed to their existing remote
branches, and represented by current browser and CI evidence. It does not
merge, deploy, activate runtime use, or begin K3.

## Non-goals

- No second set, held-out set, variants, rubric, criteria model, teaching
  profile, content taxonomy, language or locale field, conversation history,
  revision history, or reviewer roles.
- No behavior tag or structured multi-dimensional behavior model. Keep the one
  intuitive response-style selection already exposed to lecturers.
- No source reassignment, source excerpts, automated semantic-support judge,
  AI rewrite, replay, or conflict-merge editor.
- No pagination for the 40-example pilot and no general search or filtering
  redesign.
- No K3 runtime delivery, K4 evaluation implementation, KB/KG integration,
  deactivate/reactivate workflow, or production candidate generation.
- No Test & Teach implementation. The later lecturer-only save-from-preview
  slice remains independent and writes to the same candidate queue.
- No changes to `v3-ai`, PR #5092, the sibling `v3-ai` worktree, the chatbot
  HITL stack, deployment, secrets, live data, or production systems.

## Execution contract

- Boundary owner: user
- Execution owner: this main session as integration owner
- Autonomy: Gate 1 approval authorizes stack recovery and K1 through its
  evidence gate. K2 starts only after the user accepts the K1 Gate 2 evidence.
- Gate 1 authority: create local recovery refs for the two published heads;
  repair only stale local `gh-stack` tracking; check out remote stack #5503;
  rebase the two existing branches onto the selected `origin/v3-ai`; resolve
  routine conflicts; edit in-scope files; generate repository-native
  artifacts and one Prisma migration in the task runtime; run checks; dispatch
  required read-only specialists; update this plan's `Progress`; and create
  scoped local commits.
- Gate 2 authority after acceptance: correct K2, run browser verification,
  update documentation and `Progress`, complete final reviews, and push only
  `origin/feat/response-examples-foundation` and
  `origin/feat/response-examples-review` with stack-aware
  `--force-with-lease` protection. Update only PRs #5474 and #5498, preserve
  their open non-draft state, and wait once for their resulting CI.
- Local stack repair: create non-pushed recovery refs for the current K1 and K2
  remote heads, run `gh stack unstack --local`, then
  `gh stack checkout 5498`. The command must not unstack, relink, reorder, or
  otherwise change GitHub stack #5503.
- Withheld: remote unstacking or relinking, topology changes, mutation of
  `v3-ai` or PR #5092, stack merge or queue, CI retry, branch or recovery-ref
  deletion, worktree deletion, deployment, cluster access, secret access,
  live data, live model calls, runtime activation, K3, and Test & Teach.
- Terminal: `pr_ready` after both corrected remote heads match the reviewed
  local heads, layer checks pass, browser screenshots are current, required
  reviews are dispositioned, PR descriptions describe the corrected branches,
  and corrected-head CI is green.
- Pause: local stack repair would contact or change GitHub; the selected
  `v3-ai` base changes again before mutation; conflict resolution changes
  response-example product semantics; a new package or external dependency is
  required; Prisma cannot express the final migration without manual SQL; a
  second migration becomes necessary; K1 evidence fails Gate 2; a required
  runtime or specialist is terminally unavailable; or scope expands beyond
  the two existing layers.

## Review disposition

| Review theme | Decision for this package | Reason |
| --- | --- | --- |
| Separate teaching, development, and held-out sets | defer | The accepted first release has one canonical set. Evaluation without examples is an examples-excluded baseline, not generalization proof. |
| Immutable revisions, locale, content kinds, variants, rubrics, and team roles | defer | These change the settled product model without helping the initial lecturer workflow prove value. |
| Honest citation semantics and bounded parsing | do now | The current name overclaims semantic grounding and the custom grammar is a correctness, maintenance, and CPU risk. |
| Optimistic concurrency, transitions, input bounds, and database typing | do now | These protect live mutable records without adding version history or workflow machinery. |
| Production-like Test & Teach workflow | follow-up | A later lecturer-only save action can reuse the corrected candidate queue without coupling participant data or AI rewrite. |

Keep the uniqueness rule for one question per chatbot mode in the first
release. Multiple accepted answer variants remain outside this product model.
Keep `reviewedById` as current-state lineage; durable reviewer audit history
belongs with a future revision or team-review model.

## Settled contract

- One canonical response-example set belongs to one chatbot.
- Normal chatbot use may later receive approved examples as context.
  Evaluation uses the same examples as references while excluding them from
  model input and is reported as an examples-excluded baseline.
- Approved examples remain mutable and immediately live. Edits use compare and
  set with the row's `updatedAt`; they do not create revisions.
- The existing response-style choices remain. Store them as a Prisma enum so
  the database and GraphQL contract cannot drift.
- Bound `chatMode` to 100 characters, `studentMessage` to 4,000 characters,
  and `referenceAnswer` to 20,000 characters at the shared input contract.
- Rename the current check to `hasCompleteEligibleCitationParity`. It proves
  that all stored evidence is eligible and that the rendered citation markers
  exactly match the stored citation indexes. It does not prove factual or
  semantic support.
- Server transition rules are authoritative:
  - `CANDIDATE` and `NEEDS_REVIEW`: approve, edit and approve, or reject
  - `APPROVED`: edit and approve
  - `REJECTED`: no action; terminal
- The GraphQL response exposes server-computed action flags and complete
  citation-parity state. K2 does not duplicate those rules.
- Keep existing mutation names and `ResponseExampleSet` return values. Add
  required `expectedUpdatedAt: Date!` only to edit-and-approve. A mismatch
  returns `RESPONSE_EXAMPLE_STALE_UPDATE` through `extensions.code` and leaves
  content, state, reviewer fields, and digest unchanged.
- Source cards describe evidence lineage. They may show the citation anchor,
  identifiers, hash, and eligibility, but must state that source content is not
  shown and must not imply that an excerpt was loaded.

## Product primitive impact

| Primitive | Disposition | Contract change | Consumers |
| --- | --- | --- | --- |
| Response-example set | reuse | Deterministic digest remains the one current-state fingerprint | owner API, later runtime and evaluation |
| Approved response example | extend | Database-typed style, bounded input, compare-and-set edits, explicit terminal rejection | owner API, lecturer review UI |
| Evidence lineage | clarify | Complete eligible citation parity replaces the inaccurate grounding claim | approval contract, review UI |
| Review workflow | extend | Server-computed actions and stale-edit recovery | Manage UI |
| Examples-excluded baseline | reuse later | Same approved cases, no examples in evaluated input, no held-out claim | deferred K4 |

No new product primitive is created or retired.

## ADR gate

- No new ADR is required. ADR 0028 keeps one set with run-scoped roles; ADR
  0031 keeps live mutable records without revisions; ADR 0034 gates runtime on
  evidence eligibility; ADR 0035 retains lineage rather than source copies;
  ADR 0036 selects the platform base model.
- Correct existing ADR or design wording only where it implies semantic
  grounding, source excerpts, locale scope, or a behavior tag that the product
  does not provide.
- Reopen the ADR gate only if implementation requires revisions, another set,
  a new datastore, a new package, manual migration SQL, or a different runtime
  or evaluation role.

## Skill routing

- `rs-sliced-development-workflow`: owns plan approval, slices, commits,
  reviews, verification, and finish evidence.
- `rs-stacked-change` with `gh-stack`: owns local tracking repair, unchanged
  two-layer topology, rebasing, stack-safe pushing, and Gates 1-4.
- `rs-model-routing`: owns implementation and review routes.
- `rs-local-runtime-lifecycle`: required when the DevPod/devrouter runtime
  starts, verifies, hands off, or stops.
- `rs-mr-description-writer`: required before the two existing PR descriptions
  are updated.
- `agent-browser`: engineering browser verification. Codex Browser remains the
  visual collaboration path for later user review.
- `writing-for-agents` is unavailable in this environment. This plan follows
  the repository's existing agent-executable format directly.

## Research

### Current authoritative snapshot

| Item | Current evidence | Consequence |
| --- | --- | --- |
| `origin/v3-ai` | `332e044f34a1a5a0c8be00075795d8b3a19e7397`; sibling `trees/v3-ai-sync` is clean and exactly synchronized | The base-reconciliation dependency is resolved. This task still must not mutate the sibling worktree or branch. |
| Current task head | K1 at `31054ed57`, clean; 0 behind and 13 ahead of current `origin/v3-ai` | K1 corrections and the final owner-boundary/documentation dispositions are committed locally; K2 remains on its preserved pre-correction ref until Gate 2 acceptance. |
| PR #5474 | remote K1 head `eef688e0fa4b4d34ad00a02f1d8a65509d5c7189`; base has moved and GitHub merge state is recalculating | Treat the old head and CI as historical only. |
| PR #5498 | remote K2 head `3d54fbdbee5378212e65ff97bccf6dbc87f8ceba`; currently conflicting | Restack after K1 is rebased and corrected. |
| GitHub stack #5503 | remote order is K1 then K2 with the expected PRs and published heads | Preserve this topology. |
| Local `gh-stack` metadata | repaired for local stack work; no remote topology mutation | Keep the existing K1 -> K2 order and use stack-aware force-with-lease only at the final publication boundary. |

### Code findings

- `packages/util/src/citations.ts` is a roughly 2,000-line second Markdown
  grammar with an avoidable repeated suffix scan and an open CodeQL discrepancy
  around alternate HTML comment termination.
- `packages/markdown` already owns `unified`, `remark-parse`, `remark-math`, and
  the citation-marker AST transformer. Its `./citations` entry can be kept
  React-free and consumed by GraphQL as a workspace dependency.
- The renderer normalizes Markdown before parsing. Validation must use that
  same normalization, Remark parser, math settings, and marker transformer;
  matching regexes are not sufficient.
- The current service serializes owner mutations but does not compare the
  editor's observed version. It also permits a broader rejection path than the
  UI exposes.
- Current source cards carry lineage values, not source excerpts. Runtime use
  remains blocked until later KB integration can resolve readable current
  source content.

### Planning-stage specialist

- Reviewer: native planner, read-only
- Scope: this complete correction plan, existing stack topology, migration
  provenance, AST package boundary, API compatibility, transitions, and
  authority gates
- Report:
  `project/_local/reviews/2026-08-26-response-example-review-corrections-planning-stage.md`
- Verdict: `DONE_WITH_CONCERNS`
- Accepted: final data and API contract belongs in K1; K2 owns only the
  lecturer workflow; one K1 migration replaces both current migration deltas;
  the custom scanner is deleted rather than patched; the React-free Markdown
  citations subpath becomes the shared parser; K1 receives a mandatory Gate 2;
  local-only stack tracking repair is explicit authority.
- Verified correction: the review initially observed an active sibling base,
  but fresh readback now proves `v3-ai` is clean and synchronized at the
  revision above. The remaining pre-execution blocker is Gate 1 approval for
  local stack repair and rebase.

### Limitations

- No implementation or corrected-head check has run. Old CI cannot prove the
  rebased correction.
- Local synthetic fixtures prove product behavior, not KB source freshness,
  model quality, deployment, or production activation.
- PR #5092 remains outside this package even though it targets `v3`.

## Stack topology

Provider: GitHub. Base: selected current `origin/v3-ai`. Mode: guided.

| Layer | Branch and PR | Correction ownership | Activation | Risk and size guard |
| --- | --- | --- | --- | --- |
| K1 | `feat/response-examples-foundation`, PR #5474 | this plan, final Prisma schema and one migration, analytics mirror, shared citation AST contract, owner API, transitions, concurrency, generated artifacts, contract docs and service tests | inert; no production candidate source | high; pause if the correction adds more than 600 substantive human lines, needs a second migration, or creates a new product surface |
| K2 | `feat/response-examples-review`, PR #5498 | lecturer UI, i18n, local synthetic review fixture, focused browser journey and screenshots | inert outside local fixtures | medium; expected net deletion because the custom parser and compatibility migration leave K2 |

Each final layer must be functional, reviewable, green, and safe to land alone.
The final K2 tree inherits K1 and contains no additional migration. No branch,
PR, or GitHub-stack layer is added, removed, or reordered.

## Delegation map

| Workstream | Slice | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Stack recovery | S0 | main | Gate 1 approval and clean selected base | local and remote topology agree without remote stack mutation |
| Foundation correction | K1 | main; one executor may own only the bounded Markdown citation paths | S0 | final schema, migration, parser, API, state, concurrency and tests agree |
| Lecturer workflow | K2 | one executor may own only Manage UI, i18n and Playwright paths; main integrates | K1 Gate 2 acceptance | browser-proven lecturer flow consumes the server contract |
| Finish | F1 | main | K2 | independent checks, reviews, screenshots, remote heads and CI all match |

The main session retains architecture, migration, authorization, API, conflict
resolution, integration, and final proof. K1 and K2 are sequential because K2
consumes the corrected GraphQL contract.

## Feature-wide test portfolio

| Risk or behavior | Existing protection | Obligation | Primary seam | Distinct failure |
| --- | --- | --- | --- | --- |
| Migration provenance and schema equivalence | two pre-deployment migration deltas | replace | generated Prisma migration from selected base | final schema needs two migrations, manual SQL, stale fields, or analytics drift |
| Owner state, bounds, and stale writes | database service tests and row locking | extend | `packages/graphql/test/responseExamples.test.ts` | non-owner access, invalid transition, stale overwrite, unbounded input, or failure changes digest/state |
| Citation-renderer parity | large custom scanner suite plus renderer tests | replace and reduce | focused Markdown AST tests | validation sees markers the renderer hides, misses rendered markers, or malformed input causes pathological work |
| Lecturer review journey | existing seeded local workflow | extend one journey | focused Playwright resources test | wrong actions, lost stale draft, misleading source card, or unusable EN/DE layout |
| Generated and published contract | repository codegen and CI | regenerate and verify | Prisma/GraphQL outputs, root checks, per-layer CI | source and generated artifacts differ or corrected remote heads are not green |

Do not add tests for revisions, locale, variants, held-out evaluation,
pagination, framework behavior, runtime delivery, KB retrieval, or deployment.

## Slices

### S0 — Recover local stack tracking and adopt current `v3-ai`

- Problem: the remote stack is correct, but local `gh-stack` metadata points to
  obsolete heads and trunk state.
- Route: main
- Reason kept in main: branch rewriting, conflict resolution, and recovery are
  critical-path integration work.
- Do: verify the selected base and clean worktree; create non-pushed recovery
  refs for remote K1 and K2; remove only local stack tracking; check out stack
  #5503 through PR #5498; navigate to K1; rebase K1 onto current
  `origin/v3-ai` and cascade the unchanged K2 layer; resolve routine conflicts
  without touching the sibling `v3-ai` worktree.
- Acceptance: recovery refs resolve to the published pre-correction heads;
  local topology is K1 -> K2 over the selected base; remote stack #5503 is
  unchanged; both branches are clean; every conflict resolution preserves the
  settled product contract.
- Check: `git status`, immutable ref readback, `gh stack view --json`, GitHub
  stack API readback, PR base/head readback, and exact diff inspection.
- Commit: rebase rewrites existing local commits; no new S0 content commit.
- Pause: any semantic conflict, changed remote head, dirty sibling worktree, or
  command that would mutate the remote stack.

### K1 — Correct the foundation contract

- Problem: the final schema and API are split across layers, mutable edits can
  overwrite stale state, transition semantics differ, and citation validation
  maintains a second Markdown grammar.
- Route: main integration; a bounded executor may modify only
  `packages/markdown` citation implementation/tests and the obsolete
  `packages/util` citation export/tests.
- Do: add this approved plan as K1's first new content commit; place the final
  Prisma and analytics schema in K1; replace both old migration deltas with one
  schema-tool-generated migration; make response style a database enum; add
  shared bounds, authoritative transition helpers, server-computed action and
  citation-parity fields, `expectedUpdatedAt`, and the coded stale result;
  preserve owner authorization and digest transactions; replace the custom
  scanner with the shared React-free Remark AST path; update accurate contract
  documentation and generated artifacts.
- Acceptance: the selected base reaches the final schema through exactly one
  K1 migration and K2 has none; no manual SQL or legacy-row update remains;
  response style cannot contain an unknown database value; all allowed and
  forbidden transitions match the settled table; stale edits leave state and
  digest unchanged; API failures use coded errors; the validator and renderer
  share one normalization and AST path; bracket-heavy, deep, math, code, link,
  HTML, and `--!>` comment cases complete inside the normal unit-test timeout;
  owner and non-owner behavior remains correct.
- Check: generate Prisma migration inside the isolated task runtime; apply from
  the selected base; run migration status/diff, Prisma generation and sync,
  analytics-schema equivalence, GraphQL codegen, focused Markdown and database
  service tests, package checks, root format/check, generated-diff inspection,
  and data-hygiene diff review.
- Commit: `docs(project): plan response-example review corrections`, then one
  minimal `fix(chatbot): harden response-example review contract` commit.
- Reviews: one simplifier on the code commit, then one slice reviewer over the
  complete corrected K1 range with data-integrity, authorization, public API,
  architecture, parser-security, and migration-provenance lenses.
- Gate 2: report the immutable K1 head, selected base, one-migration evidence,
  owner/state/concurrency tests, parser parity/adversarial evidence, generated
  cleanliness, size, and review dispositions. K2 requires explicit user
  acceptance.

### K2 — Align the lecturer review workflow

- Problem: the UI duplicates server semantics, cannot protect a stale editor,
  and can imply that lineage identifiers are readable source content.
- Route: bounded executor for Manage UI, EN/DE strings, local seed, and focused
  Playwright paths; main integrates and verifies.
- Do: consume server-computed action and citation-parity fields; send the
  editor's observed `updatedAt`; on stale response keep the lecturer's draft
  open, refetch current server state, and require close/reopen before a new
  save attempt; keep the Slate-based rich response editor and existing
  response-style and chat-mode dropdowns; remove the K2 compatibility
  migration and custom-parser footprint; label cards as evidence lineage and
  state that source content is not shown.
- Acceptance: available actions match the server contract; approved examples
  remain editable; rejected examples are terminal; stale save never silently
  overwrites and does not discard typed content; question, answer, mode, and
  style bounds are clear; citation rendering remains Markdown-based; EN and DE
  layouts are understandable at desktop and mobile widths; cards make no
  source-excerpt or semantic-grounding claim.
- Check: Manage type/lint/build, GraphQL operation generation, focused component
  or utility checks only where behavior needs them, one Playwright journey for
  candidate/approve/edit/reject/stale states, and manual `agent-browser`
  verification at EN desktop and DE mobile plus one stale-edit state. Capture
  screenshots with route and exact revision.
- Commit: one minimal `fix(manage): align response-example review workflow`
  commit.
- Reviews: one simplifier and one slice reviewer over the K2 correction with
  stale-state, accessibility, source-honesty, and plan-compliance lenses.

### F1 — Verify and publish the corrected existing stack

- Problem: old green checks and screenshots do not prove the rebased heads.
- Route: main
- Do: run layer-specific checks at K1 and K2; inspect human and generated diff
  size; run the integrated final reviewer from selected base through K2; apply
  accepted corrections on their owning layer and restack; stop and verify the
  exact task runtime after final runtime-dependent evidence; push only the two
  named branches through stack-aware force-with-lease; update the two existing
  PR descriptions; wait once for corrected-head CI.
- Acceptance: both PRs retain the approved bases and open non-draft state;
  remote heads equal reviewed local heads; K1 and K2 are independently green;
  CodeQL and Sonar findings on changed code are resolved; screenshots match the
  final K2 head; no remote stack topology, merge, deploy, runtime, or live-data
  mutation occurred.
- Check: immutable Git and GitHub readback, per-layer repository checks,
  browser evidence, required review reports, PR descriptions, corrected-head
  CI, and final data-hygiene inspection.
- Commit: only evidence-driven corrections on their owning layer; no separate
  evidence-only commit unless repository-native artifacts require it.

## Review routing

- The K1 and K2 code commits each receive one dedicated simplifier.
- K1 receives one risk-selected slice reviewer covering migration provenance,
  schema equivalence, owner authorization, state/data integrity, public API,
  AST package boundary, and parser security.
- K2 receives one risk-selected slice reviewer covering stale-state behavior,
  lecturer UX, accessibility, and source honesty.
- The main session verifies and dispositions every finding before accepting it.
  Reports stay under ignored `project/_local/reviews/`.
- One integrated final reviewer examines the committed range from selected
  `origin/v3-ai` through final K2 after all local verification and before push.

## Verification and final evidence

- Migration: exactly one schema-tool-generated K1 migration, none in K2, no
  avoidable model change, no manual SQL, final Prisma/analytics schema
  equivalence, and clean migration diff/status from selected base.
- Service: owner/non-owner reads and mutations; every transition; terminal
  rejection; stale and duplicate updates; bounds; unavailable mode; citation
  parity; digest stability after failures; cascade and current digest behavior.
- Markdown: compact AST parity matrix for prose, links, code, math, HTML and
  malformed structures; alternate comment termination; invalid indexes;
  bracket-heavy, deep, and maximum-size input under the normal test timeout.
- UI: one production-like local flow using synthetic examples; EN desktop, DE
  mobile, and stale-edit evidence; loading, empty, error, candidate, approved,
  `Needs review`, rejected, complete parity, and incomplete parity states.
- Repository: package checks, root format/check/build appropriate to each
  layer, Prisma and GraphQL generated artifacts, no unrelated formatter or
  lockfile changes, and staged-content review for secrets, personal data, or
  source content.
- Forge: exact PR bases and heads, unchanged GitHub stack #5503, open non-draft
  state, current descriptions, independently green corrected-head CI, CodeQL,
  and Sonar. A retry remains a separate user boundary.
- Runtime: use the existing DevPod/devrouter route; establish the preview URL
  before K2 browser work; do not stop sibling runtimes; stop and verify the
  exact task runtime after final checks unless the user explicitly leases it.

## Follow-up boundary

After this package reaches `pr_ready`, propose two separate plans rather than
extending this stack:

1. Lecturer-only Test & Teach: save a question and response from chatbot
   preview into the same candidate queue. No participant data, AI rewrite, or
   replay.
2. K3 runtime activation: only after KB integration can resolve current
   readable source content and the product has explicit deactivate/reactivate
   semantics.

Neither follow-up is authorized by this plan.

## Progress

- Status: K1 correction findings and risk review are complete locally; awaiting explicit Gate 2 user acceptance before K2
- Completed: external review analysis; focused correction scope; fresh Git,
  GitHub PR, GitHub stack, sibling-worktree, and local-stack evidence; planning
  specialist review; complete correction plan; local stack tracking repair;
  recovery refs; K1 and K2 rebase onto the selected `v3-ai` base
- Current base: `origin/v3-ai` at
  `332e044f34a1a5a0c8be00075795d8b3a19e7397`; sibling `v3-ai` worktree is clean
  and synchronized
- Pre-correction published heads: K1
  `eef688e0fa4b4d34ad00a02f1d8a65509d5c7189`; K2
  `3d54fbdbee5378212e65ff97bccf6dbc87f8ceba`
- Rebased local heads before correction: K1 `ec254bea755bfa3a3d9a93b760aa9ad715643444`;
  K2 `3b54dfb36cf747f4063341ea1bc85e4ade6aa67d`
- Corrected local K1 head: `a86d5ae96` (`docs(project): update k1 gate head`, recording the final Gate 2 evidence atop the corrected implementation)
- Active slice: K1 Gate 2 evidence and risk review
- Plan commit: `c525e6c60 docs(project): plan response-example review corrections`
- K1 evidence: focused Markdown citation tests pass, including 100,000 unmatched
  brackets and 5,000 nested blockquotes; focused response-example GraphQL
  contract and service tests pass, including every transition, rejected edit,
  stale-write invariants, and all input bounds; Markdown and GraphQL package
  checks pass; Prisma schema validation passes; generated GraphQL artifacts are
  current; the database migration status is up to date in the task runtime. The
  root pre-commit hook passes with 29/29 Turbo tasks; Node 26 emits the
  repository's existing Node 24 engine warning.
- Review continuity: configured K1 specialist routes failed before launch with
  `unreadable_encrypted_agent_task`; the generic continuity risk review is
  recorded at
  `project/_local/reviews/2026-08-26-k1-risk-review-fallback.md`. All four
  findings, including the documentation and non-owner edit follow-ups, were
  applied and reverified over immutable K1 range
  `332e044f34a1a5a0c8be00075795d8b3a19e7397..a86d5ae96`.
- Next: obtain the required K1 Gate 2 acceptance before starting K2.
- Delivery pending: K1 Gate 2 acceptance, K2 correction, corrected branch push, PR updates,
  corrected-head CI, merge, deployment, runtime activation, K3, and Test & Teach
