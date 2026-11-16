# Mistral draft and final OCR routing

## Approval summary

The user requested GLM 5.3 Flash at maximum reasoning through Mistral for
draft reviews and GLM 5.3 at maximum reasoning through Mistral for final
reviews. Final and advisor requests already use `zai-glm-5-3`; preserve that
route. Draft requests move to `zai-glm-5-3-flash` and use `MISTRAL_API_KEY`.
OpenRouter is no longer a credential prerequisite for the active review jobs.

Mistral documents Flash at USD 0.15 input, 0.03 cached input and 0.50 output
per million tokens. Keep existing cost formulas, coverage semantics, native
history restoration, token ceilings, concurrency, timeouts and retry decisions.
Price and model identity must follow the selected route in receipts and summaries.
The legacy OpenRouter profile remains usable for historical diagnostic checks.

Approval mode: executable batch. Source edits, synthetic verification, configured
source review, commits, ordinary pushes and draft PRs are authorized. Deliver
one shared-engine PR against Klicker `v3`, then one Catalyst adopter PR against
`main` pinned to that immutable public engine commit. The earlier activation
approval applies after the matching Catalyst source is merged and its Mistral
secret is available. This package does not merge its new PRs or trigger extra
paid reviews. Context7 remains separately disabled in Catalyst.

## Execution details

- Reuse Klicker worktree `trees/rs/ocr-stack-evidence`, new branch
  `rs/ocr-mistral-draft`, baseline `f2edd0afcbdc36a687d4df4564bda75b67e475eb`.
- Reuse Catalyst worktree `trees/rs/ocr-adoption`, new branch
  `rs/ocr-mistral-adoption`, baseline `744654a444204a61b1793b8a24f8557c90b9c5ea`.
- Full-path package, standard execution. Main owns public adapter/runner wiring,
  integration, credentials and publication. A trusted executor owns the
  disjoint private adopter source/test/doc change, then receives the public
  commit for its final pin update. Reviewers receive exact committed ranges.
  Private source stays on trusted routes.
- Extend the fixed provider registry with `mistral-flash`, retaining `mistral`
  for full GLM. Preserve the
  existing final profile and native Mistral message semantics. Reject a different
  response model and non-max draft effort. Emit content-free route/model
  identity on new receipts. Identity-free legacy receipts mean full GLM only;
  mismatched or mixed model receipts cannot produce complete or partial prices.
- Wire the draft adapter selector, model constant, CLI secret input, summary
  subprocess and cost-report reader to that profile and Mistral secret. Combined
  summaries identify Flash and full GLM without claiming separate provider
  quotas. Keep advisor accounting and application limits separate.
- Update only the relevant CI guide and roadmap state. Keep `ocr-reviewer`
  portable and unchanged. No application runtime or browser check applies.
- Catalyst updates its immutable engine pin, provider admission, synthetic
  fixtures and guide together. The activation opt-in remains exact `true`;
  credentials remain absent from candidate execution and diagnostics.

### Slices and delegation map

1. Main implements `.github/scripts/ocr-mistral-adapter.cjs`, its existing test,
   `.github/scripts/ocr-draft-review.cjs`, its existing test,
   `.github/workflows/check-ocr-review.yml`, its assertions in
   `.github/scripts/ocr-self-update-guard.test.cjs`, `docs/ci-and-deployment.md`
   and the existing advisor roadmap. Acceptance is the focused public suites.
2. Trusted executor owns the existing Catalyst launcher, test, workflow and CI
   guide plus an addendum to its existing adoption plan. Acceptance is its eight
   controller contracts and the unchanged pinned runner/broker suites. The final
   immutable engine pin depends on slice 1's committed public source. Return
   the patch and checks; no commits, pushes, activation or paid calls by the child.
3. Main verifies both results, completes configured reviews, publishes the
   engine commit and both ordinary draft PRs, then stops before merge or live
   qualification. No application or credential-provisioning work is included.

### Verification and review

Extend existing synthetic tests for exact endpoint/model/max effort, native
thinking/tool calls and index removal, prefix/compressed replay (including
omitted reasoning), conversation isolation, ambiguous/missing history rejection,
wrong-model rejection and child credential isolation. Extend pricing/summary
tests for Flash cache rates, incomplete or mismatched receipts, and absent,
complete and missing advisor usage. Extend the existing adopter workflow tests.
No new final/advisor tests are required where their unchanged contracts suffice.
Run existing individual/stack final-review contracts to prove the final route
remains GLM 5.3 max. Use repository formatters, staged secret/data checks and
focused static checks. No live inference is needed for source qualification.

Run one planner challenge before implementation, simplifier/risk review on the
committed public slice, and integrated final review before completed delivery.
Reuse final-route proof where source is unchanged. One correction round per
review contract. Final hosted reviews remain draft-gated. Published draft PRs
state their dependent engine pin and any pending hosted CI.

## Progress

- Provider model cards and Context7 documentation checked on 2026-10-23.
  Flash model availability, tool calling and structured outputs are documented;
  exact max-effort acceptance will remain live-unqualified until a normal run.
- Both previous OCR source packages were squash-merged.
- Planner round one: revisions accepted for receipt identity, explicit native
  replay coverage, all runner selectors and deterministic ownership.

- Planner round two: APPROVED. Implemented fixed `mistral-flash` routing and
  model-bound pricing; final/advisor remain on `mistral`. Synthetic public suites
  passed 256 tests with one optional binary fixture skipped; that fixture passed
  separately against checksum-verified OCR 1.13.0 and mock providers. Three
  workflow contracts passed. Biome formatting, Prettier and focused Opengrep
  passed (zero findings); existing Biome advisory warnings remain. No app runtime.
- Simplifier accepted: remove a redundant mock Response JSON round-trip and use
  explicit provider/model pairs in the existing concurrent replay test. Both
  cases pass. Package size is 573 substantive code/test/config lines, mostly
  parameterizing existing history scenarios; one cohesive provider migration.

- Independent risk and final source reviews passed without findings. Claude
  weekly limit and AGY file-access failure required configured GLM continuity
  for the public final pass; verbatim schema-valid output remains ignored locally.
- Public delivery: [draft PR #6685](https://github.com/uzh-bf/klicker-uzh/pull/6685).
  Engine consumers pin source commit `42baf5b5a83a5ba4a517642ffce0013d96647e10`;
  later changes only simplify tests and record progress. Hosted CI is pending.
