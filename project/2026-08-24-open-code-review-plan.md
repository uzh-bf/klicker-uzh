# OpenCodeReview advisory PR review

## Goal and non-goals

- Problem: Add an initial advisory OpenCodeReview workflow for pull requests in KlickerUZH.
- Decision: Use the OpenCodeReview GitHub Action with OpenRouter's OpenAI-compatible API and `deepseek/deepseek-v4-flash-0731`.
- Non-goals: Create GitHub secrets or variables, change branch protection, push, open a PR, add pnpm dependencies, add a local agent plugin, or activate a live workflow.

## Execution contract

- Authority: The user's request authorizes the local workflow preparation, verification, and one local commit.
- Withheld: GitHub settings changes, secret creation, push, PR creation, branch-protection changes, and live activation.
- Boundary owner: self.
- Terminal: One committed workflow file with static verification complete; activation remains pending the repository secret and merge to `v3`.
- Pause: Stop if the model endpoint, model slug, or privileged workflow boundary changes.

## Plan identity

- Branch: `rs/open-code-review`
- Worktree: `trees/rs-open-code-review`
- Target: `v3`
- PR: none
- Related draft: the untracked primary-checkout draft at `.github/workflows/check-ocr-review.yml`; it remains untouched.

## Research

- Evidence: OpenCodeReview's official action checks out the trusted base, fetches PR-head objects, and reviews the diff without materializing or executing PR code.
- Evidence: The upstream workflow uses `pull_request_target` for fork secret access and requires `contents: read` plus `pull-requests: write`.
- Evidence: OpenRouter documents `https://openrouter.ai/api/v1/chat/completions`, Bearer authentication, the exact model slug `deepseek/deepseek-v4-flash-0731`, and the `reasoning` request object.
- Evidence: The upstream `v1.9.10` tag resolves to commit `66120291271b2e605e420e9f11fbd6448f06163f`; the annotated tag object is not used as the Action pin.
- Limitation: The OpenCodeReview npm postinstall downloads the native executable and checksum from GitHub release assets. Pinning the Action and CLI versions does not eliminate that residual supply-chain dependency.
- Planning review: The native planner returned `DONE_WITH_CONCERNS`; its concerns are accepted as residual risks below.

## Risk and controls

- Risk: `pull_request_target` has access to secrets and a write-capable GitHub token. Control: pin the Action to the resolved commit, keep the workflow free of checkout/build/test steps, and grant only `contents: read` and `pull-requests: write`.
- Risk: Fork PRs can consume the OpenRouter key. Control: use a dedicated OpenRouter key restricted to this model and a bounded budget; do not reuse production credentials.
- Risk: Review artifacts and logs may retain model output. Control: set `upload_artifacts: 'false'`; workflow logs remain a residual GitHub Actions retention surface.
- Risk: AI findings are noisy and non-authoritative. Control: keep the job advisory and do not add it to required checks in this slice.

## Primitive and ADR disposition

- Product primitives: none affected; this changes repository automation only.
- ADR gate: not triggered. The workflow does not establish an application or public product contract. Reconsider if the review becomes a required release gate or introduces a durable external data-retention policy.

## Skill routing

- `rs-sliced-development-workflow`: full path because the change crosses secrets, fork trust, third-party execution, and a write-token boundary.
- Planning: native read-only planner completed before this plan.
- Implementation: main session; the slice is security-sensitive and indivisible.
- Slice review: required for the privileged workflow and external LLM data boundary.
- Final review: required after the committed slice and fresh verification.

## Test portfolio

| Risk or behavior | Obligation | Primary evidence | Distinct failure protected |
| --- | --- | --- | --- |
| Fork PR trigger and privileged boundary | none | Static workflow review plus upstream action source | A forked PR receives secrets or executes PR code |
| OpenRouter model and authentication wiring | none | YAML parse/format check and key-name inspection | Wrong endpoint, protocol, model, or secret mapping |
| Comment posting behavior | none | Upstream action contract; no local reimplementation | Duplicate or missing comments caused by local glue |

## Slice S1: prepare the advisory workflow

- Route: main.
- Acceptance: Only `.github/workflows/check-ocr-review.yml` changes; the workflow uses `pull_request_target`, the resolved Action commit, `ocr_version: '1.9.10'`, OpenRouter's endpoint and model slug, `OPENROUTER_API_KEY`, OpenRouter-native disabled reasoning, least-privilege permissions, sticky/incremental comments, and no artifact upload.
- Check: Repository-native YAML formatting/checks where available, YAML parse, `git diff --check`, staged-path audit, and static security review.
- Commit: `ci: add advisory OpenCodeReview PR review`

## Progress

- Status: plan reviewed; implementation pending.
- Completed: fresh `origin/v3` baseline, upstream/OpenRouter research, dedicated worktree, planning review.
- Remaining: create workflow, verify, run slice review, commit, run final review.
- Delivery: local commit only; live activation is pending.
