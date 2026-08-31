# Klicker evaluation integration repair plan

## Goal

Make Klicker's synthetic FineCo ground truth consumable by the shared evaluation
framework, and make the Azure OpenAI judge work through the restricted LiteLLM
route without weakening secret, retry, or evidence boundaries.

## Plan identity and authority

- Klicker branch: `rs/klicker-evaluation-repair`
- Klicker worktree:
  `trees/rs/klicker-evaluation-repair`
- Klicker base: `origin/v3` at
  `5a21988fb1b4acd285d60d3c41f481f0a96be892`
- Evaluation branch: `rs/klicker-integration-repair`
- Evaluation worktree:
  `/Users/rschlae/Git/ai/evaluation/trees/rs/klicker-integration-repair`
- Evaluation base: `origin/main` at
  `95d566fb26aec82bb01a98240fbb42d6564929ca`
- User-approved terminal condition: scoped source repairs, repository-native
  checks, required reviews, local commits, and a bounded live judge smoke test
  only after values-free model visibility succeeds.
- Withheld: push, pull or merge request creation, merge, deployment, secret or
  permission mutation, tunnel or cluster-connectivity repair, real course data,
  and a live Klicker target write.

The dirty primary Klicker checkout, the stale `trees/eval-submodule` worktree,
and the dirty evaluation primary checkout are outside this plan. They will not
be integrated, rebased, cleaned, or modified.

## Verified findings

- Lena's surviving Klicker branch is `origin/eval-submodule`. Pull request
  #5190 merged an earlier submodule integration; pull request #5543 closed
  without merge. Her evaluation merge requests !10, !28, and !37 are merged,
  and their source branches no longer exist.
- Current Klicker `v3` pins evaluation commit `86e4b978`, which is not on the
  current evaluation default branch. The wrapper references
  `klicker_chatbot.yaml`, but that metrics file never existed in the inspected
  history.
- The wrapper injects the broad `dev` environment, overwrites caller model
  settings, and requests the generic `gpt-5.6-luna` alias. The restricted
  Klicker key can use namespaced aliases such as
  `klickeruzh/azure/gpt-5.6-luna-high` instead.
- DeepEval recognizes the base Luna model but not the namespaced deployment
  alias. The current proxy model therefore loses strict structured-output
  capability and falls back to untyped JSON parsing.
- All 20 synthetic FineCo cases load, but all warn because their expected
  `EXPERT_df_fineco_expert` tool is absent. Their `tutor` or `explainer` mode is
  also dropped before the QA artifact is evaluated.
- The evaluator's target clients speak OpenAI Responses or Chat Completions.
  Klicker's current chat endpoint is an authenticated AI-SDK UI stream with
  product-specific thread, message, model, and mode fields. An eval-only judge
  run is not a Klicker target-quality run.
- The restricted secret profile is authenticated and can read the mapped
  LiteLLM key. The current Headscale host failed DNS resolution before any
  request or model cost occurred.
- Evaluation focused baseline: 137 tests pass. Offline integration baseline:
  20 cases load, 20 unknown-tool warnings occur, and no chat mode reaches the
  normalized QA artifact.

## Settled contracts

### Generic evaluator model capability

`EVAL_MODEL` remains the exact deployment alias sent to LiteLLM. The optional
`EVAL_MODEL_CAPABILITY_MODEL` identifies an explicit, known DeepEval model whose
capability, pricing, and temperature metadata apply to that alias. Unknown
capability models fail before a provider request. The evaluator does not infer
product names or provider aliases.

`EVAL_JUDGE_SINGLE_ATTEMPT=true` disables OpenAI client retries for the judge.
Invalid Boolean values fail before a request. The Klicker wrapper enables this
by default while allowing an explicit caller override.

### Ground-truth projection and ownership

The evaluator accepts `chat_mode` or `mode` at the top level or in Markdown
frontmatter, normalizes only `tutor` and `explainer`, and preserves the result
in generated QA artifacts. Invalid values fail clearly.

The FineCo expert-tool definition belongs beside Klicker's synthetic
evaluation assets. The shared evaluator's default tool catalogue remains
product-neutral.

### Wrapper and target boundary

The wrapper uses the restricted `klicker-uzh-stg` operator profile and maps only
`PIPELINES_LITELLM_API_KEY` to `LITELLM_API_KEY`. It supplies safe defaults for
the namespaced judge, its capability model, the existing shared metrics,
Klicker's tool definition and ground-truth root, and the single-attempt policy.
Native caller overrides remain effective, and the framework's `.env` is not
loaded.

Eval mode consumes an existing QA artifact. Query modes require a verified
OpenAI-compatible target. This plan does not invent an adapter for Klicker's
authenticated AI-SDK route.

### Submodule publication order

Local proof may use a command-scoped local submodule URL override. No local
filesystem path enters `.gitmodules` or a commit. A Klicker gitlink to the local
evaluation commit is not remotely consumable until that evaluation commit is
published through the configured GitLab repository. Evaluation publication
must precede any Klicker publication; both actions are withheld here.

## Delegation map

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| Evaluation framework contract | `executor`, then main-session verification | Evaluation baseline | Focused and full pytest, Ruff format and lint, exact diff, local commit |
| Klicker integration | Main session | Committed evaluation slice | Fake-runner wrapper contract, shell syntax, ground-truth validation, docs checks, exact diff, local commit |
| Offline and live proof | Main session | Both committed slices | One-call fake-proxy proof, 20-case offline proof, fail-closed values-free live gate, integrated reviews |

Repository mapping remains in the main session because it is complete. The
private-repository boundary and critical-path coupling make another exploration
dispatch more costly than the remaining read-only work.

## Slice A: evaluation framework contract

- Add explicit capability-model configuration while preserving the outgoing
  alias.
- Add environment-controlled single-attempt judge behavior.
- Preserve normalized chat mode in generated QA records.
- Add mapped, unmapped, invalid, sync, async, retry, and ground-truth tests.
- Document the new environment and ground-truth contracts.
- Run focused tests, the full test suite, Ruff format checking, and Ruff lint.
- Inspect and commit only the evaluation-owned files.

Risk gate: the slice crosses provider-capability and artifact-data contracts.
Run a simplifier and one slice reviewer after the immutable local commit.

## Slice B: Klicker integration

- Add a Klicker-owned FineCo tool catalogue.
- Replace the wrapper's broad secret injection and invalid model or metrics
  defaults with the settled restricted contract.
- Fail clearly when the operator or private submodule is unavailable.
- Add a no-network fake-runner shell test for defaults, caller overrides,
  forwarded arguments, and missing-submodule behavior.
- Update the submodule gitlink to the committed evaluation slice and prove it
  locally with a command-scoped local URL override.
- Correct `evaluation/README.md`, `docs/getting-started.md`, and the Klicker
  testing skill. Keep reserved OKF index and log paths absent.
- Run shell, formatting, OKF, link, and ground-truth checks; inspect and commit
  only planned files.

Risk gate: the slice crosses secret injection and a private cross-repository
gitlink. Run a simplifier and one slice reviewer after the immutable commit.

## Slice C: proof and finish

- Load all 20 FineCo cases with zero unknown-tool warnings and prove that their
  mode survives into normalized QA records.
- Outside both repositories, create one synthetic expected-answer QA record and
  a one-metric semantic-similarity configuration.
- Run eval mode against a local fake OpenAI-compatible judge. Assert exactly one
  standard `/v1/chat/completions` request, strict `json_schema`, the exact
  deployment alias, and no `/parse`. Repeat with a transient failure and assert
  one attempt.
- Recheck restricted operator status and permissions without values. Probe
  `/v1/models` only through the existing route. If the required namespaced model
  is visible and single-call cardinality is proven, run at most the same one-case
  and one-metric judge evaluation live. Record only non-content status, model,
  timing, and usage evidence.
- If DNS, authentication, model visibility, retry safety, or call cardinality
  fails, skip the paid call and report that no model request was made.
- Label the self-baseline as judge-transport proof, not Klicker target quality.
  Full target `query-eval` remains blocked until a verified endpoint,
  authentication, and `selectedMode` transport contract exists.
- Run the integrated final reviewer after both slice reviews and corrections.

## Acceptance

- No secret values, real participant data, or real course content enter output
  or commits.
- The exact namespaced Luna alias uses strict JSON schema through standard Chat
  Completions and never the unsupported parse endpoint.
- Judge retries are disabled for the bounded smoke path.
- All 20 synthetic FineCo cases validate with their expected tool and retain
  `tutor` or `explainer` mode.
- The wrapper preserves caller overrides, uses the restricted profile, and
  fails clearly when its private dependency is absent.
- Source, offline tests, local submodule proof, live judge transport, and live
  Klicker target quality remain separate evidence layers.
- Both branches end with scoped local commits. Publication and all other
  withheld actions remain unperformed.

## Progress

- Plan hardened by the required planner through three review rounds.
- Planner verdict: approved.
- Implementation: not started.
