# Klicker live target evaluation adapter plan

## Goal

Run Klicker's 20 synthetic FineCo ground-truth cases through the real local
Klicker chat route, then judge the captured answers with the merged shared
DeepEval framework. Keep the local Chat LiteLLM proxy connected directly to the
developer Azure Foundry and preserve the distinction between target quality,
judge transport, source delivery, and deployment.

## Package and authority

- Ceremony: full path; the package crosses authentication, a product/evaluator
  seam, model cost, and a local-to-Azure data boundary.
- Plan artifact:
  `project/2026-09-01-klicker-live-target-evaluation-adapter-plan.md`.
- Klicker branch: `rs/klicker-live-target-evaluation` from merged `origin/v3`
  commit `72096fafe`.
- Evaluation framework: consume the merged gitlink commit `2a75632`; do not
  change the private evaluator repository in this package.
- Authority after human approval: commit the reviewed plan first; make local
  source and documentation edits; run repository-native checks and reviews;
  create local commits; start and stop this worktree's namespaced devrouter
  runtime; use local seeded participant/chat state; and run one bounded
  synthetic round with combined target and judge spend capped at USD 1.
- Withheld: push or PR publication, merge, deployment, secret or permission
  mutation, real participant or course data, production or staging target
  writes, cluster connectivity, and any remote MCP tunnel unless the user
  explicitly authorizes that separate action after the local adapter is proven.
  Integration of the stale `docs/chatbot-hitl-config-roadmap` branch is also
  excluded.
- Success terminal: reviewed local commits with offline adapter tests passing,
  one target-only local canary captured, one bounded 20-case FineCo query run
  producing exactly 20 structural records, and one semantic-similarity judge
  run producing exactly 20 metric records with zero judge transport errors.
  Metric failures remain valid quality findings and do not prevent execution
  completion. Exact target/judge receipts, final review, and verified runtime
  cleanup are also required.
- Parked terminal: if the expected FineCo retrieval binding is unavailable,
  finish the adapter, tests, reviews, local transport canary, and cleanup, then
  record `delivery_pending` with the missing retrieval authority/environment.
  This is an explicit blocked delivery state, not a successful quality run.
- Boundary owner: self.
- Pause: a non-local adapter URL, missing seeded participation, unavailable
  direct developer Foundry route, missing FineCo retrieval binding, forecast
  cost above USD 1, any real-data requirement, or a need for cluster access.

## Research

- Evidence: PR #5712 and evaluator MR !50 are merged. The evaluator can load all
  20 FineCo cases, preserve `tutor`/`explainer`, enforce the expected
  `EXPERT_df_fineco_expert` tool, and judge through strict single-attempt
  LiteLLM calls.
- Evidence: Klicker's participant chat route requires a `participant_token`
  cookie, a published chatbot, course participation, disclaimer acceptance,
  per-turn thread/message identifiers, selected model, and selected mode. It
  returns an AI SDK UI message stream and persists completed messages including
  tool calls.
- Evidence: the messages endpoint returns only completed messages owned by the
  authenticated participant and chatbot. The adapter can therefore drain the
  stream and read the persisted assistant message instead of duplicating the
  browser's stream parser.
- Evidence: the local LiteLLM config exposes direct `gpt-5.6-luna` through the
  generic `UPSTREAM_OPENAI_BASE_URL` and `UPSTREAM_OPENAI_API_KEY` boundary.
  The previously verified developer Foundry path works on the UZH VPN.
- Decision: classify the target as a chatbot/multi-turn agent, but make the
  first run isolated single-turn cases because the existing FineCo dataset is
  20 single-turn goldens.
- Decision: keep the existing judge model and FineCo dataset. Do not add
  DeepEval tracing or Confident AI in this package because either would add a
  new external data flow. Run one evaluation round; findings are reported, not
  fixed by weakening metrics or goldens.
- Decision: add no product endpoint. Use a Klicker-owned loopback-only
  OpenAI-compatible adapter that drives the existing authenticated participant
  APIs and returns standard Chat Completions records to the unchanged evaluator.
- Decision: run both the zero-dependency Node adapter and the shared evaluator
  on the host. The adapter binds to `127.0.0.1` and drives the namespaced
  devrouter HTTPS Chat and GraphQL routes. This keeps the target key and
  evaluator endpoint on one loopback network namespace while the application
  and LiteLLM remain inside the devcontainer.
- Risk: local Benibot currently exposes the deterministic `KB_doc_query` tool,
  not `EXPERT_df_fineco_expert`. The adapter can prove auth, mode, persistence,
  and target transport locally, but the 20-case FineCo quality run must stop
  unless a synthetic FineCo fixture or explicitly authorized remote FineCo MCP
  binding provides the expected tool without exposing real course data.
- Decision: keep the documented KB transport canary in a separate synthetic
  fixture/allowlist with an explicit `canary` source tag. It never appears in
  the FineCo ground-truth lookup, evaluator query set, QA output, or metric run.

## Primitive impact

| Product primitive | Disposition | Contract delta | Compositions and consumers | Evidence or ruling |
| --- | --- | --- | --- | --- |
| Participant authentication and course participation | reuse | none | GraphQL login, chat API guards, local seeded participant | Existing cookie and participation guards remain authoritative. |
| Chatbot publication and disclaimer | reuse | none | Chatbot lookup, participant access, local acceptance | Adapter must satisfy the same gates as the UI. |
| Chat thread and message lifecycle | reuse | none | Thread creation, chat turn claim, completed-message readback | One new thread per case preserves isolation. |
| Chat mode | reuse | none | FineCo frontmatter, chat request, persisted assistant metadata | Captured mode must equal `tutor` or `explainer` for every case. |
| Chat model selection | reuse | none | Direct local Luna option, local LiteLLM, developer Foundry | First target run bypasses Auto so embeddings and Sol are not prerequisites. |

## Delegation map

| Workstream | Slices | Owner | Dependency | Acceptance |
| --- | --- | --- | --- | --- |
| Adapter contract | A | main | approved plan | Focused unit/contract tests and exact local API evidence |
| Wrapper and documentation | B | main; secret and process ownership are critical-path coupled | A | Wrapper fake-runtime tests, shell syntax, formatting |
| Runtime proof | C | main | A and B | Devrouter proof, target canary, bounded query-eval receipt, cleanup |

All three slices stay in the main session because authentication, secret
injection, process ownership, and runtime evidence are critical-path coupled.

## Test portfolio

| Consequential behavior or risk | Obligation | Primary seam | Existing protection | Distinct failure caught |
| --- | --- | --- | --- | --- |
| Adapter is loopback-only and bearer-protected | add new | adapter HTTP contract | none | Another host or unauthenticated caller can drive participant chat. |
| Local participant auth, participation, publication, and disclaimer gates are not bypassed | add new | fake Klicker API contract plus one local canary | route-level app tests | Adapter invents an eval-only bypass or continues after a failed gate. |
| Each case uses the ground-truth mode without expected-answer leakage | add new | ground-truth projection unit test | evaluator mode loader tests | Tutor/explainer is dropped or the target sees the expected answer. |
| Synthetic KB canary cannot enter FineCo output | add new | adapter fixture-source test | none | Transport evidence contaminates the quality dataset or metric results. |
| One thread and turn are isolated per case | add new | adapter orchestration test | chat lifecycle tests | Prior answers leak into another golden or retries duplicate a turn. |
| Completed persisted answer and tool calls become one Chat Completion result | add new | adapter readback conversion test | evaluator Chat Completion tests | Partial streams, failed turns, or missing tools are reported as success. |
| Wrapper preserves existing judge boundaries and cleans up the adapter | extend existing | shell fake-runtime test | `util/test-klicker-eval-wrapper.sh` | Child failure is masked, a listener survives, or credentials reach logs. |
| Wrapper works when shared Git config reports a bare repository | add new | shell fake-worktree test | none | Git-based root discovery makes the approved worktree unusable. |
| Local Chat uses the direct developer Foundry through local LiteLLM | no new committed test | values-free runtime receipt | prior one-case transport proof | OpenRouter, shared LiteLLM, or an unintended provider path is mistaken for acceptance. |
| FineCo target quality uses the expected expert retrieval tool | no new committed test | 20-case structural receipt | ground-truth/tool validation | A transport-only local MCP result is mislabeled as FineCo quality. |

## Slice A: authenticated local target adapter

- Route: main.
- Do: add a zero-dependency Node adapter under `apps/chat/scripts/`. Bind only
  to `127.0.0.1`, require an ephemeral bearer token,
  expose `/v1/models` and `/v1/chat/completions`, log in through the local
  GraphQL participant mutation, accept the disclaimer, create one thread per
  case, submit the normal chat body, drain the UI stream, and read the completed
  message by its known assistant ID.
- Do: require exactly one OpenAI user message. Resolve its exact question with
  a one-to-one lookup against the selected FineCo ground-truth directory;
  reject missing and duplicate questions. Project only `question` and the
  resolved `tutor`/`explainer` mode from frontmatter. Never send or log expected
  answers, source citations, judge credentials, participant tokens, or raw
  tool outputs. Generate all thread/message IDs inside the adapter. Return
  answer text and tool names in one non-streaming Chat Completions result.
- Do: support the single documented KB transport prompt through a separate
  synthetic canary fixture tagged `canary`. Keep it outside the FineCo lookup
  and reject any attempt to include it in evaluator query or judge outputs.
- Do: bound completed-message polling by elapsed deadline and interval. Require
  the known assistant message ID, exact persisted chat mode, exact persisted
  `gpt-5.6-luna` model ID, a non-empty answer, and valid tool-call names before
  reporting success.
- Do: fail closed on non-local Klicker origins, unknown/ambiguous questions,
  unsupported modes, incomplete/failed message lifecycle, tool extraction
  errors, or target model mismatch.
- Check: focused adapter tests cover the corresponding test-portfolio rows;
  chat package check and test suite pass.
- Commit: `test(evaluation): add authenticated local chat target adapter`.
- Risk gate: authentication, data flow, and cross-system seam. Run one
  simplifier and one slice reviewer on the immutable commit.

## Slice B: wrapper, evaluator handoff, and documentation

- Route: main.
- Do: replace Git-based repository-root discovery with resolution from the
  wrapper's own file path. Extend `pnpm eval:klicker` with an explicit
  local-target mode that starts the host adapter, supplies only the ephemeral
  target key through process environment, preserves the existing restricted
  judge profile and single-attempt policy, propagates child status/stdout/
  stderr, and always closes the loopback listener.
- Do: pin `EVAL_API_MODE=chat-completions`, `EVAL_STREAM=false`, the loopback
  `EVAL_ENDPOINT_URL` and `EVAL_MODELS_URL`, and
  `AGENT_ID=gpt-5.6-luna`. Keep the adapter and evaluator co-located on the
  host; the adapter reaches only the exact namespaced devrouter HTTPS origins.
- Do: preserve the existing judge-only `eval` mode and caller overrides. Do not
  place Azure or participant credentials in arguments, files, logs, or the
  evaluator environment.
- Do: add
  `evaluation/data/metrics/klicker_fineco_semantic_similarity.yaml` containing
  only the existing `semantic_similarity` metric contract and pass it through
  `EVAL_METRICS_PATH`/`--metrics`. Do not modify the shared evaluator defaults.
- Do: document the local-only target boundary in `evaluation/README.md`,
  `docs/testing.md`, `docs/chat-platform.md`, and
  `.agents/skills/klicker-testing-verification/SKILL.md`; cover the difference
  between deterministic MCP transport and FineCo quality, direct Foundry
  injection via the operator, VPN requirement, one-round default, and cleanup.
- Check: wrapper fake-runtime tests include the current `core.bare=true`
  worktree condition, host/container reachability, pinned evaluator variables,
  child status propagation, cleanup, shell syntax, relevant format/check/docs
  gates, and no secret or personal-data diff.
- Commit: `enhance(evaluation): run local Klicker target captures`.
- Risk gate: secret injection and process lifecycle. Run one simplifier and one
  slice reviewer on the immutable commit.

## Slice C: bounded end-to-end proof

- Route: main.
- Do: use `rs-infisical-operator` with the existing `klicker-dev` profile to map
  developer Azure key/base values only into the exact devrouter startup
  process. Run `devrouter ensure` against the absolute worktree path with the
  `chat,ai,mcp` profile, select direct
  `gpt-5.6-luna`, and verify the local LiteLLM listener and exact provider path
  without printing values.
- Do: if LiteLLM is already running without the approved upstream injection,
  stop this exact worktree before restart. Do not run Chat type generation while
  the stack is active.
- Do: run offline tests first, then one target-only synthetic canary. Require
  authenticated thread/message persistence, exact chat mode, one completed
  answer, and expected tool evidence. Invoke it directly against the adapter
  and store only a local canary receipt; do not run it through the FineCo
  evaluator query path.
- Do: classify the seeded `KB_doc_query` canary only as synthetic transport
  evidence. Park the FineCo quality run unless
  `EXPERT_df_fineco_expert` is already reachable through an authorized binding;
  do not request or establish a tunnel in this package and do not substitute
  the seeded tool.
- Do: calculate a pessimistic combined reserve before each paid phase. Include
  the canary, up to five target model steps per case, the 4,096 output-token
  ceiling, and one judge call per case. Pin both target and judge rates to USD
  0.20 per million input tokens and USD 1.20 per million output tokens from the
  checked-in Chat registry and evaluator capability metadata.
- Do: make retry multiplicity reproducible. AI SDK `ai@7.0.52` defaults
  `streamText` to two retries, so reserve three target attempts per model step.
  Set and test `num_retries: 0` on the local LiteLLM direct
  `gpt-5.6-luna` deployment, making the maximum 15 upstream target attempts per
  case. Keep `EVAL_JUDGE_SINGLE_ATTEMPT=true`; its checked-in client seam sets
  `max_retries=0`, so reserve one judge attempt per metric record. Runtime
  preflight must verify these exact versions/settings and park before calls on
  any mismatch.
- Do: the canary fixture has a committed finite response-size bound.
  A FineCo expert binding is eligible only when its contract supplies a verified
  finite per-result input/tool-output ceiling. Start a phase only when that
  ceiling yields a full reserved worst-case cost within the remaining USD 1;
  otherwise park before the first phase call. Observed or average retrieval
  size never substitutes for this pre-call bound.
- Do: split the eligible 20-case work into one `query` invocation, structural/
  tool/cost inspection, and only then one `eval` invocation using the dedicated
  one-metric file. Concurrency is one and judge retries remain disabled.
- Do: report structural pass rate, semantic-similarity distribution, per-case
  failures, target and judge request counts, observed usage where the existing
  runtime exposes it, reserved worst-case usage/cost separately, and latency.
  If exact target usage is not exposed, label it unavailable rather than infer
  it from judge usage. Do not change metrics, thresholds, or goldens in response.
- Check: exact runtime/source receipt, adapter shutdown, `devrouter stop` for
  the absolute worktree, provider state `stopped`, zero exact routes, and no
  adapter listener. Run repository-native verification and integrated final
  review over the complete committed package.
- Commit: only source/docs/progress updates; generated QA and result artifacts
  stay ignored and local.

## Planning-stage specialist

- Planner: three hardening rounds completed. The final `REVISE` requested
  numeric price/retry values and enforcement sources; those values are now
  recorded above from checked-in metadata and the pinned AI SDK source. The
  three-round limit prevents another planner pass, so this final correction is
  explicitly unreviewed rather than represented as an approved verdict. Record
  this capped state as `review_deadlock` until the user accepts the disclosed
  gap or requests a fresh planning review.
- Opposing-provider public-contract challenge: unavailable; Claude returned
  OAuth 401 because its access token is expired. This optional pass is recorded
  fail-open and does not replace the trusted planner.
- Human ruling at approval: accept one round with the existing judge and
  dataset; defer tracing/Confident AI; authorize combined target/judge spend up
  to USD 1. Any remote FineCo MCP tunnel remains a separate future approval.

## Progress

- Status: `review_deadlock` at the three-round limit; awaiting human approval.
  No application source edited.
- Completed: merged source/forge reconciliation, exact evaluator gitlink
  verification, auth/stream/persistence mapping, direct Foundry boundary map,
  three planner rounds, and optional rival-route attempt.
- Remaining: human approval, plan-first commit, Slices A-C, reviews, local proof.
- Delivery layer required: reviewed local commits and bounded local runtime
  evidence. Achieved: plan draft only.
- Next: present the hardened plan and its disclosed review gap for approval.
