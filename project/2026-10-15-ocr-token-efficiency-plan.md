# OCR cache forwarding and bounded concurrency

## Approval summary

The OCR adapter currently drops provider cache affinity and cached-input usage.
Manual reviews also inherit the engine's eight concurrent groups. This package
preserves conversation affinity, makes cache usage observable, and qualifies an
explicit concurrency of two with an unmodified released binary and a synthetic
provider. Lower concurrency limits simultaneous work; it may increase elapsed
time and does not guarantee lower total usage or review completion.

Keep OCR 1.13.0, the existing model and reasoning settings, 200,000-token manual
prompts, all aggregate budgets, selected-file coverage, finding criteria,
filtering, resume rules, and incomplete-result rejection. Cached input remains
included in prompt and aggregate tokens. Cache affinity improves the chance of
reuse; offline tests cannot establish live cache hits or savings.

The user requested configuration improvements and then approved proceeding.
Approval mode: executable batch. Authority covers source changes, synthetic
offline qualification, local commits and ordinary task-branch push. The user
subsequently requested commit, push and a draft PR against `v3`; this includes
the existing automatic paid draft-review workflow triggered by opening the PR.
Separate manual paid reviews, live provider experiments, merge, marking ready,
deployment, engine patches and human notifications are outside this batch.
Terminal: reviewed implementation and offline evidence on the pushed task branch
with a draft PR against `v3`. Main owns integration and acceptance.

## Execution details

### Context and research

- Repository: `uzh-bf/klicker-uzh`; branch: `rs/ocr-token-efficiency`.
- Worktree: `trees/ocr-token-efficiency`; target: `v3`, baseline
  `17ab59640b19efd85e8d3a503de4e2ee0a74c5a5` after fetch and live branch readback.
  The primary `v3-ai` checkout is clean, 18 behind its own upstream and
  517 ahead / 13 behind `origin/v3`; it is not the implementation target.
- Artifacts root: existing `project/`. No PR yet.
- Baseline: 159 adapter, individual and stack tests pass with host Node 24.17.0.
  They use built-in modules and synthetic providers, with no application runtime.
- [Mistral prompt caching](https://docs.mistral.ai/studio/conversations/advanced/prompt-caching)
  documents `prompt_cache_key` and `usage.prompt_tokens_details.cached_tokens`.
  Current documentation was retrieved through Context7 and the official site.
- [OCR 1.13.0 affinity](https://github.com/alibaba/open-code-review/blob/v1.13.0/internal/llm/sessionkey.go)
  derives bounded conversation keys from session, task and a scope digest, and
  expands `{ocr_session_key}` in `extra_body`. Its scope component contains no
  raw file path. A direct canary does not perform this expansion.
- The latest upstream release is still 1.13.0. Its temporary darwin/arm64 binary
  matches the published SHA-256 checksum. Qualify that release; do not use the host's older OCR 1.11.1
  or change the global installation.

No application primitive, schema, authentication boundary or public API changes.
No ADR is required: the existing adapter and provider contract remain in place.
Update the existing CI guide for the durable cache/accounting/scheduling contract.
No browser evidence applies to this CI-only package.

### Sequence and ownership

Main owns both slices. A read-only planner checks this bounded package before
implementation; final simplification and integrated self-review cover correctness,
maintainability, source/configuration security and the approved scope. Reviews
cannot authorize external effects. Reuse passing checks for unchanged source.

Delegation map: slice 1 — main; slice 2 — main. The read-only planner challenges
the complete plan. Synthetic qualification precedes accepting configuration.

1. **Preserve conversation cache settings and usage.** Extend
   `.github/scripts/ocr-mistral-adapter.cjs` and its existing test file, plus
   `final-ai-review.js`, its existing tests and `check-ocr-review.yml`.
   Configure OCR affinity for manual individual, manual stack and automatic
   draft reviews. Keep direct tool canaries free of unresolved templates.
   Configure the template in OCR-specific config, not shared direct requests.
   Accept cache keys matching `[A-Za-z0-9_-]{1,64}`; reject malformed keys and
   unresolved templates before provider fetch. Forward validated nonnegative integral cache
   counters no greater than valid prompt usage. Omitted, malformed and reported
   zero cache usage remain distinguishable. Never subtract cached tokens from
   existing totals or copy arbitrary provider usage fields. Extend aggregate
   diagnostics with cache counters and availability counts only; no request
   text, cache keys, paths, arguments, reasoning, credentials or provider errors.
   Commit as a focused fix with regression protection.
2. **Qualify and bound manual concurrency.** Use a gitignored synthetic harness
   `project/_local/reviews/2026-10-15-ocr-token-efficiency/qualify.cjs`, with
   `receipts.json` beside it, against the
   checksum-verified released binary. Compare concurrency 8, 2 and 1 for
   complete coverage, observed simultaneous calls, aggregate usage and budget
   stopping. Require identical selected and completed path sets across 8/2/1
   and eight independently runnable groups. Measure main-request peak separately
   from auxiliary requests: two must be at most two and lower than eight.
   Require the existing validator to reject incomplete or over-budget results.
   Missing or inconclusive evidence blocks the concurrency edit. When these
   checks pass, set `--concurrency 2` on both manual
   command paths in `check-ocr-final-review.yml`. Extend the existing executable
   workflow-command test for full, incremental and resume forms. Preserve draft
   concurrency four. Record any reactive-budget overshoot; do not call the cap
   strict or weaken publication to accept it. Update `docs/ci-and-deployment.md`
   with these semantics and the offline/live evidence boundary. Commit this
   scheduling change separately.

No new tracked modules, test suites, dependencies, prompt projections or rule
changes. The plan and existing guide are the only documentation deliverables.
The synthetic harness and its receipts stay gitignored. Pause only for a material
scope/data/cost change or an unavailable capability needed for acceptance;
complete independent authorized work first.

### Test portfolio and delivery

| Consequential behavior | Existing protection | Test obligation / seam |
| --- | --- | --- |
| Cache key reaches the fixed provider while invalid input stays bounded | Request translation and loopback tests | Extend existing: serialized requests and rejection-before-fetch; direct canary omits template |
| Cache metadata cannot reduce review budgets or leak arbitrary fields | Response normalization and aggregate diagnostics tests | Extend existing: positive/zero/missing/invalid cache data, unchanged totals, redaction and serialized diagnostics |
| OCR expands per-conversation keys; concurrent work stays bounded | Released binary qualification and executed workflow-command tests | Extend existing command assertions; add new gitignored binary experiment |
| Complete coverage and clean gating survive scheduling changes | Individual/stack parser, budget and resume tests | None: run existing suites and validator against synthetic budget outputs |

Run the three baseline Node suites and offline qualification evaluator. Use the
primary checkout's installed formatters against explicit worktree paths, syntax checks and
`git diff --check`; run relevant installed static analysis and distinguish
pre-existing findings. Record hook-skipped whole-app checks separately from
passing focused checks. Required hosted CI supplies the repository-wide checks
when the hook reports that this isolated checkout has no dependency install.
Do not start an application/container solely for CI scripts. Inspect every hunk,
staged secrets/personal data and production-derived facts before each commit.
Keep a single cohesive draft PR with the repository's description skill, report
offline results and limitations, and do not request reviewers or start OCR.

## Progress

- Planning check: native read-only planner approved the revised scope. Accepted
  findings cover automatic paid draft reviews, measurable concurrency acceptance,
  direct-canary template omission and exact verification limitations.
- Status: both source slices implemented and verified; publication in progress.
- Completed: cache config, validated forwarding, safe cache counters, explicit
  manual concurrency two, existing test extensions and guide update. Test delta:
  three regression tests added; existing configuration/command checks extended.
- Verification: 183 Node tests pass, including the adapter, individual/stack,
  update guard and qualification suites; the evaluator accepts all eight synthetic
  fixtures. Six released-binary experiments pass. Complete runs select and finish
  identical paths at peaks 8/2/1 and equal total usage. Exhausted runs are rejected;
  the synthetic overrun falls with lower concurrency. All 17 requests of each
  complete run carry expanded keys across nine conversations, and cache counters
  reconcile without changing aggregate usage. Receipts and harness are local in
  `project/_local/reviews/2026-10-15-ocr-token-efficiency/`.
- Formatting, syntax, diff hygiene and Gitleaks pass. Biome checking retains two
  pre-existing `useIterableCallbackReturn` errors in unchanged code. Opengrep
  reports zero findings across the two executable files, with a partial parse of
  an unchanged regular expression in `final-ai-review.js`; this is limited evidence.
  Whole-application checks and hosted CI have not run.
- Final simplification and integrated working-tree self-review: done; no further
  abstraction or unrelated cleanup warranted. The review covered cache accounting,
  fixed-provider forwarding, redaction, canary separation, all manual command
  forms, coverage and budget refusal. This is not independent committed-range or
  hosted-CI evidence. Target `v3` readback remains the baseline above.
- Required delivery: committed task branch and draft PR. Achieved: verified local
  implementation and prepared PR text. Git permissions have been restored and
  the user explicitly requested publication. Source and target remain unchanged,
  so the passing verification above is reused. No upstream binary patch or
  application runtime was used.
- Next: commit the plan and two coherent source slices, push normally and open
  the authorized draft against `v3`. No PR exists yet.
