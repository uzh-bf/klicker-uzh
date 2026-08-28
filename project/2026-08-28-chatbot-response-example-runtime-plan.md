# Response-example runtime skill plan

## Plan identity

- Date: 2026-08-28
- Ceremony: full path
- Status: approved for local execution
- Branch: `feat/chatbot-response-example-runtime`
- Target: `v3-ai`
- Baseline: `609000ea9626e3fef2e713768ca2a796cac2f9a4`
- PR: none yet
- Program plan: [Chatbot Test & Teach ground-truth plan](./2026-08-28-chatbot-test-and-teach-ground-truth-plan.md)

## Goal

Make approved, currently grounded response examples available to normal
participant chat as a bounded hybrid skill: a deterministic prompt summary and
an exact chatbot-and-mode search tool. Keep the seam reusable for the owner
preview and the later examples-excluded baseline.

## Non-goals

- Do not capture or generate examples.
- Do not implement the owner-preview integration before PR #5633 is merged.
- Do not implement baseline runs, evaluation export, or DeepEval.
- Do not add a vector provider, schema migration, source copies, or a second
  canonical set.
- Do not push, publish a PR, merge, deploy, invoke a model, or inspect live
  course data.

## Execution contract

- Execution owner: current main session as execution orchestrator.
- Boundary owner: self.
- Authority: local source and documentation edits, repository-native checks,
  browser proof only if a visible UI changes, required read-only reviews, and
  local commits.
- Withheld: upstream integration, push, PR publication, merge, release,
  deployment, runtime activation, live model calls, secret access, and
  staging or production data.
- Terminal: the complete K6 package is committed, locally verified, reviewed,
  and ready for a separately authorized push and PR.
- Pause: current evidence cannot be resolved from the enabled KB; the change
  needs a vector provider or unbounded prompt content; or participant auth,
  persistence, credits, or source-retrieval behavior must change.

## Decisions

- Keep the first implementation small. Use one server-only response-example
  runtime module in the chat app and shared pure projection helpers in the util
  package. Do not introduce a new workspace package or a broad execution
  kernel before a second runtime consumer exists.
- Keep owner review transactions in GraphQL. Extend them with current-source
  validation, and expose the same pure eligibility rules to chat.
- Treat a source as current only when an enabled chatbot KB contains a live
  resource whose ID and `activeContentSha256` match the stored source lineage.
  `evidenceEligible` remains a captured hint and never overrides current state.
- Reconcile invalid approved rows to `NEEDS_REVIEW` and refresh the complete
  set digest under the existing chatbot/set locks. Runtime is fail closed: it
  excludes an uncertain example and continues the turn without the skill if
  loading or reconciliation fails.
- The prompt summary contains counts and response-approach guidance only. Full
  questions and ideal answers are available only through the model-invoked
  search tool.
- Narrow through the existing set, mode, and status index, then rank the
  eligible candidate IDs with bounded PostgreSQL full-text search. This keeps
  the first release scalable without a vector provider or schema migration.
- K6 wires participant chat only. The reusable assembly function accepts an
  explicit included or excluded role so PR #5633 and K7 can adopt it without
  changing the data contract.

## Primitive impact

- Response-example set: reuse; digest stays canonical.
- Response example: reuse; current eligibility can change live status to
  `NEEDS_REVIEW`.
- Evidence lineage: extend as a current authorization and hash check without
  copying source content.
- Response-example skill: create as a projection only; no new stored model.

## ADR gate

- Update ADR 0030 with the deterministic summary contract.
- Update ADR 0033 to describe bounded deterministic PostgreSQL full-text
  ranking instead of an unavailable semantic service.
- Update ADR 0034 with current KB-resource validation and reconciliation.
- No new ADR is required. Reopen the gate for another canonical set, a vector
  provider, participant-facing controls, durable source copies, or unbounded
  prompt delivery.

## Delegation map

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| K6.1 current eligibility | main | foundation schema | active, changed, deleted, wrong-KB, citation, transition, and digest tests |
| K6.2 pure projection | main | K6.1 contract | deterministic summary, ranking, caps, exact mode, and excluded-role tests |
| K6.3 participant integration | executor; main integrates | K6.1 and K6.2 | route keeps auth, persistence, credits, and MCP behavior while adding the bounded tool and prompt |
| K6.4 final docs and proof | main | all code slices | focused checks, full repository check, required reviews, exact diff, clean commits |

## Feature test portfolio

| Risk or behavior | Stable seam | Test obligation | Owner |
| --- | --- | --- | --- |
| stale or foreign evidence leaks | GraphQL DB fixture | changed hash, missing resource, wrong KB, disabled KB | K6.1 |
| status and digest diverge | GraphQL transaction fixture | approved to needs-review and digest refresh | K6.1 |
| prompt grows with full answers | pure projection | strict item and character bounds; no ideal answer in summary | K6.2 |
| search escapes chatbot or mode | server loader plus pure ranking | exact scope, deterministic ties, max three | K6.2 |
| baseline later receives examples | pure assembly | excluded role returns no summary and no tool | K6.2 |
| participant behavior regresses | chat route tests | unchanged auth, MCP failure, persistence, and credits | K6.3 |
| loader failure blocks chat | chat route test | warning plus ordinary continuation without example skill | K6.3 |

## Slices

### K6.1 — Current eligibility and reconciliation

- Problem: stored evidence eligibility becomes stale after KB content changes.
- Do: add shared pure validation and extend the owner service with current
  enabled-KB resource lookup, transactional reconciliation, and digest refresh.
- Check: focused util and GraphQL integration tests.
- Commit: `fix(chat): validate current response-example evidence`.

### K6.2 — Bounded hybrid projection

- Problem: the model needs stable guidance without receiving every full answer.
- Do: add deterministic summary, exact-scope ranking, citation namespacing,
  included/excluded assembly, and a server loader contract.
- Check: pure unit tests for all boundaries and failure cases.
- Commit: `feat(chat): add the response-example runtime skill`.

### K6.3 — Participant chat integration

- Problem: approved examples do not yet influence normal chatbot answers.
- Do: load the included projection after MCP discovery; append its summary;
  register the server-bound search tool; preserve prompt-cache identity,
  participant state, credits, and existing tools.
- Check: route tests and focused chat checks. No browser check is required
  because this package changes no rendered UI.
- Commit: `feat(chat): use response examples in participant chat`.

### K6.4 — Durable contract and finish

- Problem: ADRs still describe the larger semantic-search design.
- Do: update ADRs and both plan Progress sections; run final verification,
  simplification, risk review, and integrated final review; address findings.
- Check: docs validation, repository check, exact range inspection, secret and
  personal-data staged-content check.
- Commit: `docs(chat): document response-example runtime delivery` plus any
  verified review correction commit.

## Progress

- Status: executing K6.1 from the exact `v3-ai` baseline.
- Completed: remote-state gate, clean purpose-based worktree, approved program
  plan transfer, current source seam mapping, and package-plan narrowing.
- Review note: the configured cross-provider advisor was unavailable because
  the organization disabled Claude Code subscription access. The trusted main
  session therefore selected the smaller no-new-package design; the required
  Sol final review remains armed.
- Next: commit both approved plans, then implement current eligibility.
