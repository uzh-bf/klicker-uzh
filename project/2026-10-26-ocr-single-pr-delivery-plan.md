# OCR runtime and caller delivery in one PR

## Approval summary

Ship future runtime corrections and their immutable caller adoption in one PR. The user explicitly requested this instead of the recurring source-then-adoption pair. Commit the runtime first, then pin that full commit in a later commit of the same PR. The final candidate must contain exactly the runtime described by the pin; any later runtime correction requires a new runtime commit and a refreshed pin.

Approval mode: executable batch. This package adopts the already-reviewed planning fix, updates the repository and shared operator guidance, and adds offline CI checks. It includes ordinary commits and pushes and one draft PR against `v3`. Shared skill changes are committed locally in the canonical dotfiles checkout; a default-branch push is separate. Merge, readiness, live settings, private activation, publishing tags and provider replays remain outside this package.

The transition deliberately pins the reviewed pre-merge runtime commit from the preceding fix. Its manifest and assets exactly match the merged runtime. A fresh bare-repository probe successfully fetched that commit after squash merge and source-branch deletion. This proves present retrieval, not indefinite forge retention. CI explicitly fetches the exact pin before local object reads, while the donor contract checks verified manifest equality. No runtime or review-policy implementation changes are needed.

Models, maximum reasoning, budgets, accounting, retries, concurrency, timeouts, credentials, trusted source separation and publication admission retain their current contracts. Runtime identity, trusted policy and review head remain separate. Post-merge verification still checks source parity and pin availability before ordinary live acceptance.

## Execution details

Execution mode: standard; full path covers the CI/source-distribution seam. Main owns documentation, ADR, canonical shared skill, integration and delivery. The configured executor owns only the caller pin, ordinary CI pin fetch and existing controller test. Planner approved after exact-pin acquisition and the canonical runtime guide were included. Source simplification, seam review and integrated final review cover the final committed package.

1. Extend ordinary codebase CI to parse the donor's fixed-namespace full-SHA caller reference and fetch that exact commit from the fixed public origin with credential-free Git environment, no tags, no ref destination, no shallow-boundary change and no execution of fetched code. Reject malformed pins before fetching and verify the fetched object is a commit.
2. Extend the existing donor caller contract to compare current verified runtime-manifest identity with the pinned verified release. Existing asset-tamper coverage already verifies bytes. Exercise fetch argument/environment boundaries with synthetic subprocesses and the existing stock/publisher contracts. The selected pre-merge pin exercises a commit absent from a fresh checkout's normal ancestry.
3. Update ADR 0055, the canonical runtime guide and CI guide. Update the shared `rs-ocr` entry point and GitHub reference, keeping GitLab conditional on its separately qualified exact-revision retrieval and publisher. Preserve the portable model-facing skill.
4. Review staged source for secrets and real-environment data, run focused offline checks, commit/push and open one draft PR. Verify producing CI and current ordinary feedback available during this session; no persistent watcher is implied. Live activation remains unproven until source merge and an ordinary eligible review.

## Verification

| Boundary | Evidence |
| --- | --- |
| Detached pin retrieval | Fresh isolated host Git probe with the pin initially absent, fixed-origin full-SHA fetch and commit readback |
| No stale runtime selected | Existing donor contract compares verified current and selected manifest digests; the old pin fails, the reviewed transition pin passes |
| CI fetch input and environment | Existing controller test executes parsed workflow logic with synthetic subprocesses; hostile ref rejected before dispatch, fixed origin/SHA and bounded clean-environment Git calls retained |
| Review policy and stock behavior | Current central caller, stock/publisher, adapter, tool and final-controller contracts with synthetic providers |
| Shared skill | Skill validation, staged canonical sources, Claude-view sync and check, scoped local commit |

## Working context and progress

Repository `uzh-bf/klicker-uzh`, target `v3` at `6df4a47f68c3070e0b35b50befb0e6d16e5a817d`; existing worktree `trees/rs/ocr-shared-runtime`, branch `enhance/ocr-single-pr-delivery`. Shared skill source is `~/.agents/skills/rs-ocr`, projected into canonical dotfiles; unrelated dotfiles changes remain untouched.

- User approval recovered from the current one-PR delivery request. Source branch created cleanly from `v3`.
- Planner approved the exact-pin fetch, manifest comparison, pre-merge transition pin and documentation scope. Implementation is complete; 71 affected contracts pass with zero skips, including the stock binary. The old pin fails specifically on verified manifest mismatch.
- The shared `rs-ocr` procedure is validated, its generated Claude view is current, and the two-file change is committed locally in canonical dotfiles. It is not pushed. Repository source review and hosted CI are next.
- First useful acceptance is a fresh checkout resolving the pre-merge pin and passing manifest parity. This package ends at reviewed draft delivery; it does not claim runtime deployment or GitLab live support.
