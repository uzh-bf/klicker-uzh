# Final-review tool canary and OpenCodeReview qualification

## Goal and non-goals

- Problem: the manual final-review workflow passes its plain-completion
  preflight, then fails before the first real tool-bearing review request can
  produce tokens or tool calls.
- Goal: fail fast on the actual OpenRouter tool contract, upgrade the manual
  path to the qualified OpenCodeReview release, and preserve the existing
  review/status semantics.
- Non-goals: change the working low-cost draft reviewer, narrow OpenRouter to a
  provider, add a dependency, change branch protection, merge, deploy, modify
  secrets or Infisical profiles, or remove a branch or worktree.

## Execution contract

- Authority: the user's goal authorizes this worktree, included-path edits,
  temporary synthetic qualification, local commits, required read-only review
  gates, a normal push to `origin/rs/final-review-tool-canary`, draft PR
  creation/update, and exact-head CI monitoring.
- Withheld: merge, ready-for-review transition, branch-protection changes,
  secret access or mutation, Infisical/profile setup, deployment, provider
  narrowing, and branch/worktree removal.
- Execution and boundary owner: main session. Workflow control, secret
  handling, provider behavior, and status finalization are one coupled slice.
- Terminal before merge: a draft PR targeting `v3` has exact-head CI accounted
  for and the integrated final review passes. Hosted `/final-review` and
  `/final-review-stack` proof remains explicitly pending.
- Pause: stop if the fake-endpoint probe contradicts the release assumptions,
  correctness requires an excluded path or provider pin, or `origin/v3`
  advances with material overlap in an included contract.

## Identity and baseline

- Plan: `project/2026-08-29-final-review-tool-canary-plan.md` until the draft PR
  supplies its number.
- Branch: `rs/final-review-tool-canary`.
- Worktree: `trees/rs-final-review-tool-canary`.
- Target: `origin/v3`.
- Baseline: `05d379714738d6dca124bc973d81b4bd0206258e`.
- Package: one ordinary regression-fix PR.

## Evidence and decision

- Hosted stack run
  [33256498452](https://github.com/uzh-bf/klicker-uzh/actions/runs/33256498452)
  passed `ocr llm test`, then all 25 selected review items failed immediately
  with HTTP 404 responses, zero tokens, and zero tool calls.
- The current manual jobs pin OpenCodeReview 1.9.10 and hardcode a provider
  order. The working draft path is separate and stays unchanged.
- OpenCodeReview
  [v1.11.0](https://github.com/alibaba/open-code-review/releases/tag/v1.11.0)
  removes forced tool choice from its review filter, preserves provider
  reasoning across turns, separates a 16,384 completion cap, and defaults to
  two review rounds.
- OpenRouter automatically selects tool-capable providers when requests carry
  tools. The manual path therefore omits provider order and preserves fallback.
- The required planner returned `DONE_WITH_CONCERNS`. Its accepted report is
  stored under `project/_local/reviews/`.
- The trusted advisor checkpoint was unavailable because its OAuth token had
  expired. No weaker route substitutes for it.
- Product primitives are unaffected. The ADR gate remains closed because this
  reuses the existing provider, credential, trigger, status, and data boundary.

## Design contract

- Upgrade only the two manual jobs to OpenCodeReview 1.11.0.
- Pass `--effort low` to every manual `ocr review` invocation so the OCR
  upgrade stays at one review round. Keep `reasoning.effort: high` for
  OpenRouter.
- Replace `ocr llm test` with one shared `verify-openrouter-tools` command in
  `final-ai-review.js`.
- The canary sends fixed public text, the configured model and reasoning, and
  one no-side-effect function tool with an exact forced tool choice. It accepts
  only the expected tool name and constant arguments and never executes it.
- The canary receives the key through standard input, applies a bounded timeout,
  and never prints the key, prompt, choices, tool arguments, raw metadata, or
  model content. Failure output is limited to bounded allowlisted status,
  provider, and error fields.
- Both manual jobs run the same canary after creating the mode-0600 ephemeral
  config and before any review fan-out.
- Final review publication, clean-evidence handling, status behavior, stack
  topology logic, and the draft review workflow remain unchanged.

## Scope

| Path | Purpose |
| --- | --- |
| `.github/workflows/check-ocr-final-review.yml` | Pin OCR, invoke the canary, and retain one review round |
| `.github/scripts/final-ai-review.js` | Shared canary request, validation, sanitized diagnostics, and CLI command |
| `.github/scripts/final-ai-review.test.js` | Canary, configuration, and workflow-source regression tests |
| `docs/ci-and-deployment.md` | Operator behavior and hosted-proof boundary |
| This plan | Durable execution and evidence record |

`final-ai-stack-review.js`, its test, and
`.github/workflows/check-ocr-review.yml` remain excluded unless direct evidence
shows the shared helper cannot serve the stack path.

## Test portfolio

| Contract | Obligation | Primary seam | Failure protected |
| --- | --- | --- | --- |
| Automatic provider fallback and high reasoning | extend | OCR config test | Provider order returns or reasoning drops |
| Canary request and structured success | add | Pure request builder plus injected fetch | Canary passes without the expected tool call |
| Sanitized provider failure | add | Error normalizer | Raw content, controls, key, or unbounded text reaches logs |
| Malformed success and secret leakage | add | Response validator and CLI rendering | HTTP 200 is mistaken for tool success or the key is echoed |
| Both manual jobs use one canary and OCR 1.11.0 | extend | Workflow-source test | One job keeps the weak preflight, wrong version, or two-round default |
| Exact OCR wire shape | add qualification probe | Fake local OpenAI-compatible endpoint | Release assumptions differ from the real CLI request |
| Real provider behavior | post-merge proof | Manual individual and stack commands | Unit-safe code still fails against hosted OpenRouter/OCR |

## Slice S1: public-safe canary and manual integration

- Route: main. Execution-tier delegation is skipped because the workflow,
  secret, provider, and status boundaries are tightly coupled.
- First qualify OCR 1.11.0 against a temporary fake endpoint and synthetic
  one-file diff. Require the captured request to include the configured model,
  high reasoning, tools, `max_completion_tokens: 16384`, no provider order,
  and exactly one review round.
- Implement the canary, upgrade and constrain the manual workflow, extend the
  focused tests, and update operator documentation.
- Acceptance: all focused tests pass, YAML parses, changed files format cleanly,
  every diff hunk belongs to the scope, the draft reviewer is byte-identical to
  the baseline, and the immutable slice clears simplifier plus cross-system and
  security review.
- Commit: `ci(final-review): add tool-bearing OpenRouter canary`.

## Verification and review gates

- Run the individual and stack helper Node test suites.
- Parse the workflow YAML. Run repository Biome on changed JavaScript and
  Prettier on changed YAML and Markdown in the managed repository environment.
- Run `git diff --check`, inspect the exact changed-path list, and scan staged
  content for credentials and personal data.
- After the substantive commit, run one `simplifier` and one `slice-reviewer`
  in parallel over the immutable range. The slice review covers secret
  leakage, cross-system request compatibility, and unchanged status semantics.
- Apply only verified findings and rerun affected checks.
- Run one `final-reviewer` over the complete committed package after fresh
  verification.
- Push normally, create a draft PR, update its complete description, verify
  remote-head equality, and account for exact-head CI.

## Post-merge proof

After separate merge authorization and merge to `v3`:

1. Trigger `/final-review` on an eligible public-safe ready PR. Record canary
   success, OCR 1.11.0, nonzero review activity, cleanup, publication or clean
   evidence, and terminal status.
2. Trigger `/final-review-stack` on an eligible public-safe stack top. Record
   the same evidence for cumulative code review and topology review.

Only this hosted evidence proves that the trusted `pull_request_target`
workflow and current OpenRouter provider route work together.

## Progress

- Status: planner-reviewed plan prepared; implementation pending.
- Completed: fresh authoritative baseline, hosted failure reconciliation,
  upstream release/source qualification, OpenRouter endpoint inspection,
  local credential-boundary check, baseline tests, and native planning review.
- Limitations: trusted advisor unavailable due expired OAuth; local live
  OpenRouter request unavailable without changing the approved secret setup.
- Remaining: commit this plan, run the fake-endpoint probe, implement and
  verify S1, complete required reviews, publish the draft PR, and account for
  exact-head CI. Both post-merge commands remain pending.
