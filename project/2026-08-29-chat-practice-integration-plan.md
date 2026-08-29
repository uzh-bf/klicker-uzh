# Chat practice capability integration adapter

## Goal

Create an isolated compatibility branch that proves how the course-chatbot
Quizzer composes with the existing lecturer-authored practice flow and the
retrieval-backed personal-card flow.

The adapter must preserve the fixed course, retrieval, citation, attachment,
and language contracts. It must make question and card provenance explicit,
without changing the parallel Quizzer or student-generation branches.

## Non-goals

- Do not merge, rebase, push, amend, or otherwise mutate any source branch.
- Do not integrate current `origin/v3` or `origin/v3-ai` into this sandbox.
- Do not change Prisma, GraphQL, migrations, authentication, grading,
  gamification, workers, lecturer-practice submission, or personal-generation
  service behavior in the adapter range.
- Do not start a devcontainer, application server, browser, model call,
  database, MCP service, or other local runtime.
- Do not create a pull request or claim runtime or browser readiness.

## Plan identity and pinned inputs

- Repository: `uzh-bf/klicker-uzh`
- Branch: `rs/chat-practice-integration`
- Worktree: `trees/chat-practice-integration`
- Adapter base: `9fc0d52f6ccbf53fa2c1b909ceb045ce5582cb42`
  (`fix(personal-elements): retain grounded source references`)
- Published student-stack top for comparison:
  `cce6e445134f6130b0a32d5dcb4e9f826c8354dd`
- Fixed language/course policy input:
  `86e8ac2e13c77e90a9bcd45d0f6b5f03fff18eed`
- Quizzer input: `4d94e86b905e9b4a6d0a1d42b894e513363420ec`
- Quizzer semantic range: `5896ca9eb..4d94e86b9`, based on `86e8ac2e1`
- Refreshed target snapshots at planning time:
  `origin/v3` `05d379714738d6dca124bc973d81b4bd0206258e` and
  `origin/v3-ai` `bedc6a8556b07e2603d7c34178cb1dbe06e7891c`
- AI Buddy policy reference: deployment `origin/main`
  `82e9a7dc6be415106a0241a6b357f51e2b793ee2`, read only.

Only the exact committed SHA `9fc0d52` is an input. The corresponding student
worktree has newer uncommitted parallel edits; they are explicitly excluded.

## Execution contract

The current main session owns all slices because prompt ordering, tool
ordering, answer safety, and UI provenance share one critical integration
seam. No implementation child owns files.

The approved terminal is a clean, unpublished local branch with local commits,
static verification receipts, required read-only reviews, and an exact
downstream replay contract. No upstream is configured.

Repository pnpm checks run only inside a container. The user explicitly
excluded local runtime use, so those checks and browser verification are
recorded as skipped rather than passed. This package may not claim end-to-end
or runtime readiness.

Stop and return to the user if implementation requires a change to GraphQL,
Prisma, personal-generation services, auth, grading, gamification, workers,
practice submission, source branch refs, runtime use, push, or upstream
integration.

## Source reconciliation strategy

A direct branch merge is prohibited. A read-only merge-tree check from mutual
base `59e57481057a601a8fdb1e57208ca6392e20068b` showed unrelated conflicts in
CI, deployment, devcontainer, repository instructions, and Playwright files.

Instead, replay only the policy and Quizzer application changes onto the pinned
student top:

1. Apply the merged policy commit `86e8ac2` and preserve the fixed compiler
   order: attachment context, course scope/grounding, citations, language.
2. Replay the Quizzer commits from `5896ca9` through `4d94e86`, resolving only
   approved Chat, test, i18n, ADR, and wiki paths.
3. Exclude Quizzer project-history artifacts and GraphQL comment/test changes.
4. Resolve the shared route, runtime, message rendering, citation, test, docs,
   and translation files by contract rather than choosing one side wholesale.
5. Add adapter-only capability composition, provenance, tests, documentation,
   and plan receipts after the replayed source is coherent.

The adapter range is `9fc0d52..HEAD`. Inherited GraphQL/schema history before
that base is a student-stack dependency, not an adapter change.

## AI Buddy policy comparison

The fixed Klicker layers already contain the strongest reusable AI Buddy
rules: latest non-trivial-message language lock, isolation from retrieved/tool
language, one-language replies, Swiss High German spelling, same-language
free-text retrieval, course-only scope, retrieved-content instruction
isolation, privacy-safe tool queries, insufficient-evidence handling, and
safety precedence.

Do not duplicate these rules in Tutor, Explainer, or Quizzer personas. Keep the
personas limited to learning behavior, interaction flow, output shape, and a
short response check.

The personal-card pipeline's accepted first version forces retrieval for every
non-empty turn when `doc_query` exists. This adds cost and may search on a turn
that the fixed course policy later refuses as unrelated. The student plan and
ADR 0027 already record that deterministic trade-off. This adapter preserves
it unchanged and does not weaken the response-scope refusal.

## Product primitives

| Primitive | Disposition | Adapter contract |
| --- | --- | --- |
| Effective chat mode | Reuse | Quizzer remains a standard capability-gated mode with restricted `doc_query`. |
| Lecturer-authored practice | Compose | The existing answer-safe tool is available in Tutor and Quizzer; lookup, submission, grading, and ownership stay unchanged. |
| Personal-card generation | Reuse | Eligibility remains retrieval capability plus feature flag plus credits, independent of mode name. |
| Practice provenance | Strengthen presentation | Distinguish AI-generated prose questions, course-team practice cards, and AI-generated personal-card candidates without persisted state. |

## ADR gate

No new ADR is required because the adapter adds no owner, storage model,
external system, or irreversible data flow.

Append a dated amendment to ADR 0021. Preserve its historical Stage 1
limitation, then record that Quizzer can compose existing lecturer-practice and
personal-card capabilities when their independent gates are satisfied. Link
ADR 0027 for plan-first retrieval-backed cards and ADR 0042 for durable source
snapshots.

## Slices

### S0 — Freeze the integration boundary

- Create only the named branch, worktree, plan, and local review receipt.
- Confirm exact base, ignored `trees/`, no upstream, no merge commit, and clean
  source worktrees.
- Acceptance: the adapter starts at `9fc0d52`; source refs retain their pinned
  SHAs; no runtime is touched.

### S1 — Reconcile modes and fixed prompt policy

- Reconcile effective-mode resolution, restricted Quizzer retrieval,
  server-authoritative empty mode sets, settings/layout consumption, and the
  fixed compiler layers.
- Improve Tutor and Explainer only at the persona layer.
- Make Quizzer source-aware: generated prose questions identify themselves as
  AI-generated; structured course-team cards are never relabelled as generated;
  personal-card requests follow their dedicated plan-first tools.
- Acceptance: hidden modes cannot be crafted into requests; Quizzer fails
  closed without `doc_query`; custom modes and explicit disables survive; the
  fixed language/course policy is compiled once in the defined order.

### S2 — Compose route and runtime capabilities

- Preserve `PersonalElementsProvider`, plan approval/status callbacks, tool
  ordering, leases, prompt-cache identity, nested credit accounting, and
  terminal stream handling.
- Add lecturer practice for `tutor` and `quizzer` only.
- Preserve capability-based personal-card eligibility in Tutor, Explainer,
  Quizzer, and eligible custom modes.
- Preserve personal-card renderers, hidden internal selector tools,
  duplicate-prose suppression, retrieval-unavailable rendering, and Quizzer's
  unavailable-mode action guards.
- Acceptance: route order is effective mode/MCP, Quizzer retrieval gate,
  lecturer practice, persona plus bounded runtime data, personal-generation
  flow data, then fixed platform contracts at the final model-input boundary.

### S3 — Make provenance explicit and document the adapter

- Add a localized course-team provenance label to structured practice cards.
- Add a localized AI-generated, source-linked, not-reviewed label to personal
  card candidates while preserving the source references from `9fc0d52`.
- Union Quizzer and personal-card i18n keys. German copy uses Swiss spelling.
- Add the mode/capability matrix and provenance rules to `docs/chat-platform.md`.
- Amend ADR 0021 and record exact receipts in this plan.
- Acceptance: all three origins are explicit without changing persisted data.

## Conflict-resolution contracts

- `RuntimeProvider.tsx`: keep personal plan callbacks/provider and take
  Quizzer's authoritative effective-mode handling.
- Chat `route.ts`: use the shared mode/MCP resolver; fetch disabled rows for
  shadowing; add practice in Tutor and Quizzer; compile policy before passing
  the effective prompt and combined tools to personal generation.
- `citationInstructions.ts`: retain citation numbering and legacy bracket
  precedence only. General retrieval policy belongs in
  `coursePolicyInstructions.ts`; per-card evidence stays pipeline-enforced.
- `message-parts.tsx`: combine personal renderers and internal-tool behavior
  with unavailable-mode retry/edit guards. The lecturer-practice tool remains
  a visible structured card.
- `required-mcp-route.test.ts`: union existing student mocks and Quizzer
  effective-binding/fail-closed coverage; keep lecturer-practice composition
  in `retrieval-route-wiring.test.ts`.
- `de.ts` and `en.ts`: union namespaces before adding provenance copy.

## Verification portfolio

| Risk | Source protection | Planned check | Runtime status |
| --- | --- | --- | --- |
| Quizzer appears without restricted retrieval | Effective-mode and required-MCP tests | Preserve and extend cases | Test execution skipped |
| Fixed language/course policy is lost or duplicated | Compiler, citation, language tests | Preserve ordered markers and precedence | Test execution skipped |
| Lecturer question leaks answers or reaches wrong modes | Practice adapter plus route wiring | Tutor/Quizzer yes; Explainer/custom no; submission unchanged | Test execution skipped |
| Personal cards become mode-gated | Card-generation and route wiring | Explainer and Quizzer remain capability-based | Test execution skipped |
| Runtime/UI integration drops one renderer | Runtime and message-parts tests | Preserve provider, internal tools, cards, and guards | Test execution skipped |
| Provenance is misleading | Rendering and locale parity tests | Explicit three-origin copy; Swiss German | Test execution skipped |
| Adapter drags unrelated history | Git inspection | Path allowlist, no merges, no upstream, pinned source refs | Static check required |

Permitted static checks are `git diff --check`, conflict-marker search,
adapter path inspection, merge-commit inspection, upstream inspection, source
ref comparison, and manual source/test contract review. Container-dependent
pnpm checks and browser/model evidence remain outstanding.

## Downstream integration contract

1. A downstream target must contain `9fc0d52` or a reviewed patch-equivalent
   personal-card stack, including durable source-reference retention.
2. Replay only adapter commits after `9fc0d52`; do not merge this synthetic
   branch wholesale into an unrelated target.
3. A target containing only `cce6e445` is incompatible until the
   source-reference fix lands or is applied equivalently.
4. If upstream rewrites commits, compare touched paths and observable contracts;
   ancestry or matching commit messages alone are insufficient.
5. Re-resolve route/prompt/UI overlaps on the eventual stable head, then run
   container tests and browser verification before opening a delivery pull
   request.
6. This adapter must not move either source ref. If another workstream advances
   one, record the new head and compare its changed paths without integrating
   it into this branch.
7. During static verification the local student-generation branch advanced to
   `ae99c0b7e675f83161ffee649c38d7207e5855a1`. It remains a descendant of the
   frozen `9fc0d52` input. Its three new citation-hardening commits have no
   changed path in common with this adapter, so downstream integration can
   apply both lines on a fresh stable head without importing one into the
   other here.
8. Before final review that branch advanced again to
   `de0fccc9e3ab45fb28266a449a4593dd28363255`. Its two additional source-
   identity sanitization commits remain descendants of the frozen input and
   still have zero changed-path overlap with this adapter. The published
   student ref remains `cce6e445`; neither local nor remote ref was moved by
   this worktree.
9. During final review the local branch advanced again to
   `de9012814f7ef8f337ad40344ff56623f9fce25f`. Its additional source-metadata
   closure commit remains a descendant of the frozen input and has zero
   changed-path overlap with this adapter. The published ref remains
   `cce6e445`; downstream integration must still reconcile the latest stable
   student head rather than treating this synthetic adapter as current.

## Review gates

- Planning: native `planner`, status `DONE_WITH_CONCERNS`; accepted with the
  explicit no-runtime verification gap above.
- After the substantive prompt/route integration slice: run one read-only
  `simplifier` and one answer-safety/cross-system `slice-reviewer` in parallel.
- After provenance: run one provenance-focused `slice-reviewer` if that work is
  not already covered by the immutable slice review.
- After final static verification: run one integrated `final-reviewer`.

## Progress

- 2026-08-29: User approved the isolated local adapter goal. Runtime, push, PR,
  upstream integration, source-branch mutation, and cleanup remain withheld.
- 2026-08-29: Remote refs refreshed. The unrelated primary checkout remains
  dirty and 1 commit ahead / 127 behind `origin/v3`; it is read-only.
- 2026-08-29: Product-primitive, AI Buddy policy, Quizzer, lecturer-practice,
  personal-card, and direct-merge conflict reviews completed.
- 2026-08-29: Mandatory planner returned `DONE_WITH_CONCERNS`; `9fc0d52` and
  path-restricted semantic replay were accepted. Container tests are excluded
  by the approved no-runtime boundary and will be reported as skipped.
- 2026-08-29: S0 worktree and branch created from exact `9fc0d52`; no upstream
  is configured.
- 2026-08-29: S0 completed and the plan was committed. The frozen policy and
  Quizzer commits were replayed without moving either source ref; conflicts
  preserved graph/context, personal-card, and unavailable-mode behavior.
- 2026-08-29: S1-S3 implementation composed Tutor and Quizzer course-team
  practice, fixed the Quizzer pre-lookup retrieval gate, retained capability-
  based personal cards, improved all three personas, and added explicit
  localized provenance plus ADR/wiki updates.
- 2026-08-29: The parallel student-generation branch independently advanced
  from `9fc0d52` to `ae99c0b7e`. Read-only comparison confirmed ancestry and
  zero changed-path overlap with this adapter; no source ref was moved here.
- 2026-08-29: The required simplifier role was unavailable because its routed
  model rejected the configured reasoning effort. A fresh trusted
  `gpt-5.6-sol` read-only fallback found one P3 prompt duplication; the
  redundant wording was removed without changing the structured-card rule.
- 2026-08-29: The required slice-reviewer route was unavailable for the same
  routing reason. A fresh trusted `gpt-5.6-sol` read-only fallback found one P2
  prompt-privilege issue: untrusted candidate fields followed the fixed
  platform contracts. Candidate fields are now bounded and JSON-encoded in a
  delimiter-safe runtime data block before the fixed attachment, course,
  citation, and language layers. Adversarial source coverage records the
  intended ordering and escaping contract.
- 2026-08-29: Slice review also recorded a non-blocking inherited UI gap: the
  structured practice card still contains English loading, error, and
  navigation strings. A separate i18n change with browser verification is
  required for a fully German structured-practice experience.
- 2026-08-29: Before final review the parallel student branch advanced again
  from `ae99c0b7e` to `de0fccc9e`. The two new source-identity sanitization
  commits remain path-disjoint from the adapter. Current target snapshots are
  `origin/v3` `bb495a1b2` and `origin/v3-ai` `4b85e616b`; no integration was
  performed. The adapter is 180 commits ahead and 23 behind current
  `origin/v3` because it deliberately retains the pinned synthetic base.
- 2026-08-29: Exact-head static verification passed at `d8f02bdb6`: clean
  worktree, exact `9fc0d52` merge base, no merge commits, no upstream, no
  conflict markers, clean diff check, allowed paths only, and no adapter delta
  in GraphQL, Prisma, or personal-card generation. The staged gitleaks scan
  reported no leaks. Pnpm, browser, model, database, and MCP checks remain
  skipped under the approved no-runtime boundary.
- 2026-08-29: The configured native final-review route was unavailable because
  the dispatcher paired an unsupported reasoning effort with its model. A
  fresh trusted `gpt-5.6-sol` read-only fallback requested three corrections:
  the stale encoded-id assertion (fixed in `2aaa2eec5`), untrusted raw page
  context, and accepted-plan data following the fixed contracts. Page fields
  are now bounded and encoded in a delimiter-safe data block. The route now
  applies the fixed contracts once after all card-flow data, without changing
  the personal-generation service.
- 2026-08-29: During final review the parallel student branch advanced again
  to `de9012814`. Its additional source-metadata closure commit remains path-
  disjoint from the adapter. No ref was moved or integrated here.
- Status: S1-S3 source work and initial static verification complete; final-
  review corrections implemented and pending exact-head static verification.
