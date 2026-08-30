# Final AI Review Publication Diagnostics Plan

## Goal

- Problem: OpenCodeReview can complete successfully while the trusted final-review publisher rejects its free-form finding content. The result file then disappears with the hosted runner, so the exact malformed syntax cannot be diagnosed or replayed.
- Evidence: [PR #5593](https://github.com/uzh-bf/klicker-uzh/pull/5593) produced `Finding 1 has an invalid confidence score` twice in [workflow run 33304066293](https://github.com/uzh-bf/klicker-uzh/actions/runs/33304066293). The producer succeeded, the publisher failed, and the run retained no artifact.
- Decision: Preserve only the exact JSON files already consumed by a failed publisher in one-day, purpose-named workflow artifacts. Exclude stderr, credentials, configuration, manifests, per-layer range files, and every other runner file.
- Goal: Deliver a minimal `v3`-targeted CI tooling pull request that makes a future publisher rejection diagnosable without changing review, publication, or status semantics.
- Non-goals: Relax the finding parser, change the reviewer model or prompt, rerun a paid review, modify the lecturer-management feature stack, integrate the roadmap branch, merge this tooling pull request, deploy, or clean up unrelated worktrees.

## Execution Contract

- Execution owner: This main session owns implementation, integration, verification, required reviews, publication of the tooling branch, and the draft pull request.
- One-time approval: The user approved preparing, validating, committing, pushing, and opening this separate `v3`-targeted tooling pull request.
- Authority: Edit only the named tooling worktree, make scoped local commits, push `rs/final-review-publication-diagnostics`, and open one draft pull request against `v3`.
- Withheld: Merge or ready transition; `/final-review` or `/final-review-stack`; paid model usage; upstream integration; deployment; destructive cleanup; and any change to [PR #5593](https://github.com/uzh-bf/klicker-uzh/pull/5593), [PR #5614](https://github.com/uzh-bf/klicker-uzh/pull/5614), [PR #5619](https://github.com/uzh-bf/klicker-uzh/pull/5619), or `docs/chatbot-hitl-config-roadmap`.
- Terminal: A reviewed draft pull request targets `v3`, its exact head is pushed, its description and this plan are current, and the task stops before merge.
- Boundary owner: `self`.
- Pause: Stop for material target overlap, discovery of non-public payload input, a required permission or helper redesign, terminal reviewer failure, or a failed hook, push, or pull-request creation that cannot be safely retried.

## Plan Identity

- Plan: `project/2026-08-30-final-review-publication-diagnostics-plan.md` until a pull-request number exists.
- Branch: `rs/final-review-publication-diagnostics`.
- Worktree: `trees/rs/final-review-publication-diagnostics`.
- Target: `v3` at baseline `6135b55c56e3f25ff56d178c11e8ac184aea587f`.
- Pull request: Not created yet. Rename this plan to include its number after creation.
- Related history: `project/2026-08-25-ai-review-lifecycle-plan.md` established the current manual review lifecycle. This package fixes a diagnostic gap in that recently merged behavior.

## Research

- Evidence: OpenCodeReview 1.11.0 models finding `content` as free-form text. The repository validator requires exact `Confidence`, `Autofix`, and `Motivating line` syntax.
- Evidence: The workflow logs result JSON only when the OCR producer fails. A publisher failure occurs after cleanup and has no capture step.
- Evidence: The individual publisher consumes `final-ai-review-result.json`. The stack publisher consumes the combined `final-ai-stack-code-result.json` and `final-ai-stack-topology-result.json`.
- Evidence: GitHub documents that signed-in users with repository read access can download workflow artifacts. For this public repository, treat the artifacts as public output. The configured action supports a single-file path, `if-no-files-found: error`, and a minimum one-day retention.
- Decision: Retain the exact publisher inputs, not a sanitized summary. A summary could omit the missing, reordered, or malformed free-form syntax needed for faithful parser replay.
- Risk: The artifacts are effectively public for one day. This is proportionate only because their inputs are public pull-request diffs, public review context, and model output intended for publication.
- Check: Upload no stderr, OpenRouter configuration, secret, stack manifest, incremental range directory, or wildcard directory.
- Limitation: This branch cannot prove the hosted failure path. `pull_request_target` executes trusted default-branch workflow code, so live proof remains post-merge and separately authorized.

## Product and Architecture Dispositions

- Product primitives: None. This package changes only CI diagnostics and does not alter a user, participant, chatbot, or publication contract.
- `CONTEXT.md`: No update; domain vocabulary is unchanged.
- ADR gate: Negative. One-day diagnostics extend an existing public-output path and are easy to reverse. Reconsider an ADR for non-public inputs, longer retention, broader access, automatic replay, or a durable sanitization policy.
- Wiki: Update `docs/ci-and-deployment.md`. The configured baseline has no `docs/index.md` or `docs/log/`, so do not bootstrap either.
- Skill: No repository-local skill currently owns manual final-review behavior. No skill update is required.
- Solution capture: Add one `docs/solutions/integration/` entry because the producer-versus-publisher evidence gap required non-obvious investigation.

## Skill Routing

- `diagnosing-bugs`: Keep the failed producer and publisher stages distinct and add the missing evidence loop before changing parser behavior.
- `rs-sliced-development-workflow`: Full-path plan, immutable slice reviews, focused verification, commits, and draft pull-request finish.
- `rs-model-routing`: Native planner, simplifier, risk-selected slice reviewer, and integrated final reviewer.
- `klicker-wiki-maintenance`: Keep the CI guide aligned with behavior and avoid creating absent wiki structures.
- `rs-compound`: Capture the incident-derived integration lesson in `docs/solutions/`.
- `rs-mr-description-writer`: Produce the final whole-branch pull-request description.

## Planning Review

- Specialist: Native Codex `planner`, read-only, over the baseline and proposed artifact boundary.
- Status: `DONE_WITH_CONCERNS`.
- Accepted: Exact one-day artifacts are the smallest faithful diagnostic. Include only the publisher inputs, make public readability explicit, and keep hosted proof pending.
- Accepted: No helper code or new permissions are needed. Incremental stack review retains only the combined code result rather than per-layer intermediates.
- Accepted: Treat the package as full path because it changes trusted CI behavior and diagnostic exposure.

## Delegation Map

| Workstream | Slices | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Plan contract | S0 | `main` | Reviewed plan and user approval | Committed plan records authority, exposure risk, tests, slices, gates, and progress |
| Publisher diagnostics | S1 | `main` | S0 | Exact failure-only artifact wiring and source-level workflow tests pass |
| Operator knowledge | S2 | `main` | S1 contract | CI guide and one solution document match the implementation |
| Review and draft delivery | S3 | `main` plus required read-only specialists | S1-S2 committed | Required reviews pass; exact branch is pushed; draft pull request targets `v3` |

- Execution-tier skip reason: Security-sensitive CI seam and critical-path coupling. Keep all writable work in the main session.

## Test Portfolio

| Consequential risk | Existing protection | Obligation | Primary seam | Distinct failure | Owner |
| --- | --- | --- | --- | --- | --- |
| Individual publisher input disappears | Workflow source tests cover manual jobs | Extend existing | `.github/scripts/final-ai-review.test.js` | Wrong condition, order, path, retention, or action pin | S1 |
| Stack publisher evidence is incomplete | Stack workflow source tests cover job wiring | Extend existing | `.github/scripts/final-ai-stack-review.test.js` | Missing code or topology result | S1 |
| Artifact includes unsafe runner data | No publisher-failure artifact exists | Extend existing | Exact upload-step source assertions | Stderr, config, manifest, range directory, or wildcard path enters the artifact | S1 |
| Review or status semantics change | Existing individual and stack helper suites | None; retain | Existing helper suites | Diagnostic wiring changes review, publication, or finalization behavior | S1 |
| Workflow syntax is invalid | Repository formatting and source parsing | No new test; verify | YAML parse, focused Prettier, `git diff --check` | Invalid YAML or formatting | S1 |

## Slices

### S0 — Freeze the execution contract

- Route: `main`.
- Acceptance: This plan contains the approved authority boundary, exposure decision, test portfolio, slices, review gates, and initial `Progress`.
- Do: Commit the reviewed plan before implementation.
- Check: Inspect the plan diff and repository status.
- Commit: `docs(project): add final-review diagnostics plan`.

### S1 — Retain rejected publisher inputs

- Route: `main`.
- Acceptance: Both publisher steps are followed by failure-only uploads of exactly their consumed JSON files, with one-day retention and hard failure when an expected file is absent.
- Do: Reuse the repository's pinned `actions/upload-artifact` SHA. Give individual and stack artifacts purpose-based names containing the run ID and attempt.
- Do: Preserve existing job failure and final-status semantics. Add no permission, helper, wildcard, stderr, config, manifest, or per-layer range upload.
- Test obligation: Extend the two existing workflow-source suites at their current stable seam.
- Check: Run both dependency-free Node suites, YAML parsing, focused Prettier, and `git diff --check`.
- Commit: `ci(ocr): retain rejected final-review payloads`.
- Post-slice gate: Dispatch one `simplifier` and one security/correctness `slice-reviewer` in parallel over the immutable implementation commit.

### S2 — Document the diagnostic boundary

- Route: `main`.
- Acceptance: Operator documentation states the failure trigger, exact included and excluded files, public-read exposure, one-day retention, offline-only replay, and post-merge live-proof boundary.
- Do: Update `docs/ci-and-deployment.md` and add `docs/solutions/integration/opencodereview-publisher-rejection-payloads.md`.
- Test obligation: None; documentation describes the tested workflow contract.
- Check: Focused Prettier and `git diff --check`.
- Commit: `docs(solutions): explain final-review publisher diagnostics`.
- Slice review: Not required because this slice is documentation-only and preserves the already reviewed implementation contract.

### S3 — Verify, review, and publish a draft pull request

- Route: `main` plus one native `final-reviewer`.
- Acceptance: Fresh focused checks pass over the complete committed package; final review clears correctness, plan compliance, maintainability, security, and artifact exposure; exact branch is pushed and a draft pull request targets `v3`.
- Do: Account for every changed path, inspect staged data for secrets and personal data, compute substantive size, and name the isolated CI-unblock packaging-floor exemption.
- Do: Push only `rs/final-review-publication-diagnostics`, open a draft pull request titled `ci(ocr): retain rejected publisher payloads`, then rename this plan to include the pull-request number and update `Progress` and the pull-request body.
- Check: Read back the exact remote head, target branch, draft state, changed paths, checks, and pull-request body.
- Commit: Metadata-only plan rename and progress update after the pull-request number exists.

## Verification and Finish Gates

- Run `node --test .github/scripts/final-ai-review.test.js .github/scripts/final-ai-stack-review.test.js`.
- Parse `.github/workflows/check-ocr-final-review.yml` with the available YAML parser.
- Run focused Prettier over changed Markdown, YAML, and JavaScript test files, then `git diff --check`.
- Keep normal pre-commit and pre-push hooks active. If a hook requires the container toolchain, run its repository-equivalent checks there and record the split.
- No browser, application runtime, GraphQL codegen, migration, or end-to-end check applies.
- Apply one simplifier and one security/correctness slice reviewer to S1. Apply one integrated final reviewer to the complete committed package.
- Run `rs-compound` solution capture before the final review.
- Stop before merge. Hosted artifact proof, paid review replay, feature-stack merge, and deployment remain separate authorities.

## Progress

- Status: S1 is committed and verified; its required specialist gates are blocked before inspection by the current encrypted task transport.
- Completed: Fresh remote-state gate; clean worktree from `origin/v3`; root-cause diagnosis; current GitHub artifact contract check; native planning review; S0 plan commit `1adaf5a14`; S1 commit `b5aff4c8c` with failure-only individual and stack artifact wiring and source assertions.
- Remaining: S1 specialist gates; S2 documentation; integrated verification and final review; push and draft pull request; plan rename and final evidence readback.
- Latest verified commit: `b5aff4c8c5de6a4582e8b60db68bc6ea46207de7`. Both focused Node suites pass `90/90`; the workflow parses as YAML; changed content passes `git diff --check`; focused Prettier passes, with an unrelated pre-existing whole-file mismatch preserved in the stack test.
- Required delivery layer: Reviewed draft pull request against `v3`.
- Achieved delivery layer: Clean local task branch and worktree.
- Unresolved required gates: The native `simplifier` and `slice-reviewer`, followed by their same-model generic continuity attempts, all failed before work with `unreadable_encrypted_agent_task`. Integrated final review, push, and draft pull-request evidence remain later gates.
- Active children: None.
- Next action: Use a separately approved native ChatGPT fallback for the two blocked S1 gates, or resume after the plaintext task transport is repaired.
