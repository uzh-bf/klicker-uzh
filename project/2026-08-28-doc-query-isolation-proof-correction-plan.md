# Doc Query isolation proof correction plan

## Goal

Correct the staging Doc Query isolation verifier so overlapping course topics do
not produce false cross-knowledge-base failures. Publish a reviewed pull request
against `v3-ai` without running another live proof or changing runtime state.

## Non-goals

- Do not change scope-token signing, MCP invocation, tenant filters, bindings,
  configuration, secrets, cluster state, data, or production.
- Do not include a live manifest, knowledge-base identifiers, chatbot
  identifiers, retrieved content, or credential values in the repository.
- Do not merge the pull request or rerun staging retrieval proof in this package.

## Execution contract

- Authority: Edit, test, review, commit, push the feature branch, create or
  update its pull request, wait for exact-head CI, and mark it ready when green.
- Withheld: Upstream integration, merge, deployment, secret access, runtime or
  cluster action, data or configuration changes, live proof, cleanup, and PRD.
- Execution owner: Current task.
- Boundary owner: Current task.
- Terminal: A ready pull request targeting `v3-ai`, with exact-head CI green and
  the required independent reviews accepted.
- Pause: Stop if the diff crosses the proof helper, its tests, this plan, or the
  adjacent chat-platform documentation; if target drift requires integration;
  or if a reviewer finds unresolved isolation or custody risk.

## Plan identity

- Branch: `fix/doc-query-isolation-proof`
- Target: `v3-ai`
- Plan: `project/2026-08-28-doc-query-isolation-proof-correction-plan.md`
- The source package includes the previously reviewed proof custody and
  lifecycle protections together with this source-specific isolation
  correction.

## Decisions

- Problem: The verifier used one combined reference-and-content haystack for
  both positive retrieval and negative isolation evidence. Banking and Finance
  II legitimately discusses portfolio theory, so a shared topical phrase was
  not proof of a foreign corpus result.
- Evidence: The failed receipt identifies the first isolation failure only.
  Static course descriptors show the supposedly foreign topic belongs to the
  tested course. The reviewed service contract independently applies the signed
  `kb_id` after caller filters and rejects trusted-filter overrides.
- Decision: Positive evidence may match returned references or chunk content.
  Negative isolation evidence may match only stable markers in returned
  `source.reference` values.
- Decision: Rename all work-package-coded script, test, environment, lock,
  client, fixture, and description names to purpose-based Doc Query proof names.
- Risk: Reference-marker uniqueness remains an operator-owned manifest
  property. The manifest field name, documentation, and synthetic regressions
  make that boundary explicit; a future live manifest still needs review.
- ADR: Not required. This is a reversible regression correction to an
  operational verifier, not a new architecture or product decision.
- Primitive impact: None. No user-facing capability or lifecycle changes.

## Planning review

- Route: Native planner launch failed before work because its configured role
  was routed to an unsupported GLM effort. A clean-context Sol continuity
  planner completed with `DONE_WITH_CONCERNS`.
- Accepted: Use `forbidReferences`, preserve positive reference-and-content
  matching, add asymmetric regressions, rename every coded identifier, document
  the manifest rule, and keep every custody and lifecycle path unchanged.
- Accepted concern: Publish with an explicit feature-branch ref because the
  local branch tracks the target branch; never use a bare push.

## Delegation map

| Workstream                   | Owner          | Dependency                | Acceptance                                                    |
| ---------------------------- | -------------- | ------------------------- | ------------------------------------------------------------- |
| Proof correction             | main           | Reviewed inherited helper | Focused and package checks pass                               |
| Slice simplification         | simplifier     | Committed correction      | No behavior-changing reduction                                |
| Isolation and custody review | slice-reviewer | Committed correction      | All findings resolved or rejected with evidence               |
| Integrated readiness         | final-reviewer | Final committed range     | Correctness, maintainability, security, and architecture pass |

Execution-tier skip reason: The marker semantics, secret-custody invariants,
branch integration, and final delivery are coupled on the critical path.

## Test portfolio

| Contract                 | Obligation        | Stable seam        | Distinct failure                                                          |
| ------------------------ | ----------------- | ------------------ | ------------------------------------------------------------------------- |
| Positive evidence        | Extend existing   | `runProofMatrix`   | Chunk-only positive marker is missed                                      |
| Overlapping topics       | Extend existing   | `runProofMatrix`   | Shared chunk text falsely fails isolation                                 |
| Foreign source reference | Add regression    | `runProofMatrix`   | Foreign reference is not detected                                         |
| Manifest migration       | Add regression    | `validateManifest` | Legacy broad marker field is accepted                                     |
| Custody and lifecycle    | Preserve existing | `superviseProof`   | Output, environment, receipt, lock, signal, or timeout contract regresses |

## Slice: make isolation evidence source-specific

- Route: main.
- Do: Rename the helper and test to purpose-based names and replace internal
  coded identifiers with `DOC_QUERY_PROOF_*` names.
- Do: Replace `foreign.forbidAny` with required
  `foreign.forbidReferences`. Match those markers only against normalized
  source references while preserving positive reference-and-content matching.
- Do: Add the test obligations above and one concise documentation paragraph
  under scoped knowledge-base retrieval.
- Check: Focused Vitest, Chat typecheck, full Chat Vitest, formatter checks,
  `git diff --check`, a scoped coded-name search, and staged data hygiene.
- Commit: `fix(chat): make isolation proof source-specific`.

## Delivery

- Run the simplifier and the data-integrity slice reviewer on the immutable
  correction commit, preserving existing proof-custody reviews where content is
  unchanged.
- Resolve findings, rerun affected checks, then run one integrated final review
  over the complete branch range.
- Fetch before publication. Stop rather than merge or rebase if target drift
  requires integration.
- Push explicitly to `fix/doc-query-isolation-proof`, open a draft pull request
  against `v3-ai`, update the whole-branch evidence, and mark it ready only when
  exact-head CI is terminal green.

## Progress

- Status: Source-reference-only correction implemented and accepted by the
  slice reviewer.
- Completed: False-positive classification, current-base worktree, continuity
  planning review, purpose-based naming, reviewed proof custody and lifecycle
  protections, asymmetric marker logic, regression coverage, and wiki
  documentation, transport retry refusal, canonical UUID cardinality checks,
  strict legacy-manifest refusal, and the accepted simplifier reductions.
- Current branch: Plan commit over the recorded `origin/v3-ai@edae58628`
  baseline. The remote target has since advanced by one deployment-annotation
  commit; no integration has occurred.
- Fresh checks: Node syntax passed; Biome passed for the helper and test;
  Prettier passed for the plan and wiki; focused Vitest passed 19/19 under
  pinned Node 24; `git diff --check` passed.
- Environment gap: Exact-worktree `devrouter ensure` stopped before creating a
  runtime because the current target's devcontainer defines
  `postCreateCommand` without `waitFor`. The host fallback cannot build all
  internal workspaces, so Chat TypeScript and full-suite collection remain for
  exact-head CI rather than being claimed as local passes.
- Review: The configured simplifier and slice-reviewer routes rejected their
  configured effort before reading the task. Trusted Luna continuity passes
  completed instead. The simplifier's safe reductions were applied; the risk
  reviewer accepted the correction after transport-retry, strict-manifest, and
  UUID-canonicalization findings were resolved.
- Remaining: Final review, target integration decision, explicit push, pull
  request, exact-head CI, and ready state.
- Required delivery layer: Ready pull request. Achieved layer: Verified local
  correction.
- Next action: Obtain integrated final review, then request the one-time target
  integration authority required by the deployment-only target drift.
