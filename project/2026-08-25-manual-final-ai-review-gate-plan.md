# Manual final AI review gate

## Goal and non-goals

- Problem: the inexpensive continuous OpenCodeReview pass is useful throughout
  draft iteration, but it should not be the only AI review evidence before a
  pull request merges.
- Decision: keep automatic DeepSeek reviews on every pull request head and add
  an exact `/final-review` command that runs a separate Gemini 3.7 Flash review
  with high reasoning against the current head.
- Decision: the merge status attests that the final review completed and was
  published for the current head. Findings remain advisory and are verified,
  fixed, or rebutted through the normal PR babysitting loop.
- Non-goals: merge or mark PR #5530 ready, change branch protection in this PR,
  run a full `rs-production-readiness` audit, execute PR-head code, add an
  application dependency, or change deployment behavior.

## Execution contract

- Authority: the user's approved design authorizes this plan, local
  implementation and verification, conventional commits, a normal push, and a
  draft PR. PR #5530 merged while this package was being prepared, so delivery
  moves to the replacement branch and PR recorded below.
- Withheld: force push, merge, ready-for-review transition, deployment,
  worktree removal, and GitHub branch-protection mutation.
- Execution owner and boundary owner: main session. Privileged workflow,
  authorization, secret, status, and integration logic stay coupled here.
- Terminal: the replacement draft PR contains the committed implementation,
  focused verification and required reviews pass, the remote head matches the
  local head, and post-merge live-proof and activation steps are explicit.
- Pause: stop for a failed reasoning-wire proof, a promotion contract that
  cannot be validated without a broad bypass, a required force push or new
  credential, or a material expansion of the external data boundary.

## Plan identity

- Plan: `project/2026-08-25-manual-final-ai-review-gate-plan.md`.
- Historical plan: `project/2026-08-24-open-code-review-plan.md`.
- Branch: `rs/manual-final-ai-review-gate`.
- Worktree: `trees/rs-open-code-review-background`.
- Target: current `origin/v3` at `1ef0b5f737`; the replacement branch was
  rebuilt directly on this baseline without force-pushing.
- Pull request: replacement draft PR to be created after push. Historical
  [#5530](https://github.com/uzh-bf/klicker-uzh/pull/5530) is merged.
- Package: one ordinary PR because continuous-review hardening, the manual
  review gate, and its generated-promotion exception form one review policy.

## Research and planning disposition

- OpenCodeReview v1.9.10 resolves a complete config-file endpoint before its
  `OCR_LLM_*` environment endpoint. The config path preserves `extra_body`; the
  environment path does not.
- The isolated dummy-token wire probe installed OCR v1.9.10 before creating its
  config, supplied conflicting environment values, and captured the outgoing
  request. It used the configured endpoint and model, included
  `reasoning.effort: high`, and emitted neither dummy token.
- OpenRouter currently exposes `google/gemini-3.7-flash` and documents
  `reasoning: { effort: 'high' }` for OpenAI-compatible requests.
- GitHub documents that `issue_comment` workflows run from the default branch,
  job-level permissions default unlisted permissions to none, job-level
  concurrency can cancel matching work, and `statuses: write` can update a
  commit status on an exact SHA.
- The required planner returned `DONE_WITH_CONCERNS`. Its accepted concerns are
  that the comment path cannot be proven live before merge and branch
  protection remains a separate external mutation.
- Planner refinement accepted: authorize commands through calculated repository
  permission and accept only `write` or `admin`, rather than trusting the
  event's author-association label.
- Planner refinement adapted: use a custom rule with
  `merge_system_rule: true`, which preserves OCR's language-specific rules
  while keeping the final-review policy readable and testable.
- Planner refinement adapted: invoke the pinned CLI directly. Installation
  finishes before the ephemeral secret config exists, and the repository-owned
  publisher refuses to post stale-head output.

## Review and status contract

| Event                                              | Behavior                                                                                                                                 | `final-ai-review` status                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| PR opened, synchronized, reopened, or marked ready | Keep automatic DeepSeek review. Initialize the exact head unless it is a verified generated promotion.                                   | `pending`, or `success` for a verified promotion |
| Exact `/final-review` PR comment                   | Resolve calculated commenter permission, require a non-draft PR targeting `v3`, snapshot head `H`, and serialize authorized work per PR. | `pending` on `H`                                 |
| OCR and publication complete                       | Re-fetch the PR, require the current head still equals `H`, and publish a distinct final-review report attached to `H`.                  | `success` on `H`, regardless of finding count    |
| Review, publication, or status step fails          | Preserve the workflow outcome without uploading OCR artifacts or secret values and link the status to the workflow run.                  | `failure` or `error` on `H`                      |
| Head changes during the review                     | Refuse success for `H` and require a new command. A single report attached to `H` can still land if publication races the push.           | old `H` is not successful; new head is `pending` |

- A final review is accepted only for a ready PR. Drafts continue to receive the
  inexpensive automatic reviewer.
- Repeated authorized commands serialize per PR. A duplicate skips when the
  current head already has a successful final review; if a run is active, the
  duplicate waits and retries only when that run fails. Unauthorized comments
  never enter that concurrency group and cannot cancel trusted work.
- The workflow and custom status use different names so the GitHub Actions job
  check cannot collide with `final-ai-review`.
- Branch protection is activated only after the merged workflow has passed the
  controlled live proof. Admin bypass remains unchanged unless separately
  approved.

## Security and operational controls

- Check out only the trusted default branch. Fetch PR-head Git objects as review
  data; never materialize, install, build, test, or execute PR-head content.
- Treat titles, bodies, comments, refs, diffs, and source comments as untrusted
  data. Never interpolate them into shell source.
- Sanitize the continuous review title by removing controls, collapsing
  whitespace, and limiting it to 200 Unicode code points. Label it as metadata,
  not instructions.
- Install the exact OCR CLI version before writing the OpenRouter key to a
  mode-`0600` ephemeral config. Delete that config immediately after the OCR
  process exits and never upload OCR artifacts.
- Grant each job only the permissions it needs: trusted helper checkout and PR
  reads for initialization; PR writes and statuses writes for final publication;
  no application, deployment, package, or infrastructure permissions.
- Link every custom status to its workflow run. Missing or ambiguous evidence
  fails closed.
- The final rule borrows operational lenses from `rs-production-readiness` but
  explicitly remains a single diff-led code review, not the manual eight-worker
  production-readiness audit.

## Generated staging-promotion exemption

The exemption succeeds only when all predicates match the repository-owned
promoter contract:

- same-repository, non-draft PR targeting `v3`, opened by a user with calculated
  `write` or `admin` permission;
- exact branch, title, body, one-commit message, 12-character suffix, and
  full-target-SHA relationships generated by `deploy-stg-promote.yml`;
- the sole promotion commit has the recorded PR base as its only parent;
- the head changes only `deploy/env-uzh-stg/values.yaml` and equals the base
  after replacing exactly 15 release annotations plus, when needed, the 15
  image tags with the configured staging source branch;
- the full target SHA exists and is an ancestor of the configured staging
  source branch.

Any mismatch leaves the normal final-review requirement in place. It never
widens the exemption or fails open.

## Delegation and review routing

| Workstream                                            | Owner                   | Acceptance boundary                                                     |
| ----------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| Plan, policy helper, workflows, rule, and integration | main                    | Security-sensitive critical path remains in one owner                   |
| Planning challenge                                    | native planner          | Completed `DONE_WITH_CONCERNS`; concerns dispositioned above            |
| Slice simplification and risk review                  | independent specialists | Review each substantive immutable slice before integration              |
| Integrated readiness review                           | final reviewer          | Review committed package after fresh verification                       |
| Post-merge live proof and protection activation       | separate continuation   | Requires merged default-branch workflow and explicit settings authority |

Execution-tier implementation delegation is skipped because the authorization,
secret lifecycle, status race, and exemption invariants are tightly coupled and
security-sensitive. Read-only specialist reviews remain mandatory.

## Test portfolio

| Consequential behavior                                                          | Obligation                         | Primary seam                                              | Distinct failure protected                                                        |
| ------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Untrusted title becomes bounded metadata                                        | add focused test                   | pure title normalizer                                     | workflow-command or prompt-like metadata crosses the intended boundary unbounded  |
| Only exact trusted commands can run                                             | add focused test                   | pure command plus calculated-permission policy            | outsider or approximate comment triggers privileged work                          |
| OCR config selects Gemini high reasoning without leaking the key during install | add test plus completed wire probe | pure config builder and captured HTTP request             | environment resolver silently drops reasoning or install scripts can read the key |
| Status belongs to the reviewed head                                             | add focused tests and API guards   | resolver, publisher, finalizer                            | stale review satisfies a newer head                                               |
| Final findings are delivered without controlling success                        | add focused test                   | result parser and report renderer                         | a false positive deadlocks merging or findings disappear                          |
| Promotion bypass is exact and generated                                         | add positive and negative fixtures | pure promotion contract validator plus API ancestry check | a crafted deployment PR bypasses final review                                     |
| Privileged workflow never executes PR code                                      | static review                      | workflow event, checkout ref, and shell inputs            | fork content gains secret or write-token execution                                |

## Slice 1: trusted policy helper and continuous-review hardening

- Add one dependency-free Node helper and focused tests for title normalization,
  exact command and permission checks, OCR config construction, final-result
  rendering, and status helpers.
- Replace raw title interpolation in `.github/workflows/check-ocr-review.yml`
  with the bounded, explicitly untrusted background value while preserving the
  current trigger, model, action pin, permissions, draft behavior,
  sticky/incremental settings, Dependabot exclusion, and artifact policy.
- Check: focused Node tests, JavaScript formatting/lint, workflow formatting,
  `git diff --check`, and staged secret/data inspection.
- Commit: `ci(ocr): sanitize pull request review context`.

## Slice 2: manual strong review and operational rule

- Add the trusted `issue_comment` workflow for authorization, exact-head
  status, serialized CLI execution, ephemeral config cleanup, stale-head
  suppression, final report publication, and status finalization.
- Add the merged final-review rule covering deployment/rollback, failure modes,
  data safety, observability, config/secrets, user/operator experience,
  docs/operability, and performance/capacity. Require file/line evidence,
  confidence anchors, narrow blocker language, coverage gaps, and secret names
  only.
- Check: helper tests, JSON parse, workflow static validation, exact diff and
  permission inspection, then simplifier and security-focused slice review.
- Commit: `ci(ocr): add manual final AI review`.

## Slice 3: exact promotion exemption and operator documentation

- Add initialization for every relevant PR head and the fail-closed generated
  staging-promotion validator with current and source-switch fixtures.
- Document the automatic draft reviewer, ready-PR command, exact-head reset,
  finding disposition, generated exception, external OpenRouter boundary, and
  post-merge activation sequence in `docs/ci-and-deployment.md`.
- Check: positive and negative policy tests, current promoter source cross-check,
  workflow validation, formatting, staged hygiene, simplifier, and bounded
  risk review.
- Commit: `ci(ocr): validate final review gate`.

## Finish gate and delivery

- Run all focused tests, applicable repository format/static checks,
  `git diff --check`, and staged secret/PII review. No application build is
  required because no application or package code changes.
- Run one integrated final reviewer after all corrections and fresh checks.
- Update this plan's progress, push normally, and create the replacement draft
  PR with a whole-branch title and body using `rs-mr-description-writer`.
- Confirm the remote head equals local head and account for current-head CI.

## Post-merge continuation

1. On controlled PRs, prove exact `/final-review` authorization, pending to
   success on one head, finding-independent success, unauthorized rejection,
   stale-head suppression, and the real promotion exemption.
2. With explicit settings authority, preserve the existing required checks and
   add only `final-ai-review` to `v3` branch protection. Roll back by removing
   only that context.

## Progress

- Status: reviewed implementation and corrections are committed on current
  `origin/v3`; integrated verification and the finish gate are in progress.
- Completed: fresh remote audit, normal merge of current `origin/v3`, upstream
  OCR and current OpenRouter research, production-readiness lens selection,
  required planner challenge, promotion-contract inspection, passing
  dummy-token reasoning wire probe, continuous-review hardening, trusted helper
  and tests, manual Gemini workflow, final-review rule, exact generated
  promotion exemption, and operator documentation.
- Review disposition: the first helper slice's configured Gemini specialists
  were unavailable at the provider credit boundary. Trusted fallback reviews
  found and corrected Unicode-format controls, finding-schema validation,
  Markdown confinement, partial report publication, and repeated PR fetches.
- Review disposition: the workflow slice's trusted fallback reviews found and
  corrected stale base-range success, incomplete result acceptance, duplicate
  review spend, and one unused output. OCR v1.9.10 omits
  `budget_exceeded: false`, so the verified correction requires the summary
  object and rejects `true` rather than requiring an impossible explicit false.
- Remaining: run integrated verification and the final reviewer, push normally,
  and create the replacement draft PR.
- Delivery boundary: live command proof, merge, and branch-protection activation
  remain withheld post-merge work.
