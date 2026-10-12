# Improve course-chatbot learning quality from anonymous usage evidence

## Approval summary

The Informatik und Wirtschaft HS26 chatbot is used for targeted explanations, course
organisation, summaries and revision. The reviewed explanations often resolve misconceptions
well. The strongest improvement opportunities are access to relevant retrieved material,
honest summary coverage, and completing a requested task without repeated permission prompts.

The current source has a reproduced citation-admission problem: the first 12 unique sources
consume the entire answer's citation allowance, including later refined searches. Start by
verifying the effective deployed configuration, then improve the smallest responsible layer:
citation admission and evidence presentation for retrieval misses,
shared task instructions for incomplete or delayed work, and quiz guidance only where a
controlled case demonstrates a remaining defect. Preserve existing course boundaries,
source citations, direct answers, uncertainty, hints and assistance-attribution rules.

The user approved execution through a draft PR on 12 October 2026. This batch delivers
verified source changes and a draft PR, with synthetic evaluation under a predeclared budget.
Merge, release, deployment, live prompt edits, corpus changes and infrastructure changes
remain separate actions. No production transcript will become a test fixture or leave its
approved analysis boundary.

Completion means that the selected failure cases improve against an equivalent baseline,
critical control cases remain valid, and coverage and delivery claims match actual evidence.
The main uncertainty is historical attribution: current source and full stored retrieval
results do not establish the exact prompt, model-visible context or deployed code used for
every reviewed answer. Resolve that before claiming a root cause or a live fix.

## Execution details

### Scope and working context

- Approval mode: **executable batch**, explicitly approved through draft PR delivery.
- Boundary owner: main session. Execution mode: `standard` because the runtime identifies
  the main model as GPT-6 without the exact solo-allowlisted model ID.
- Repository/worktree: `klicker-uzh`, `trees/chatbot-learning-quality`.
- Branch/target: `docs/chatbot-learning-quality` → `v3`.
- Fresh source baseline: `df2bfa41d8753c04af2f07f185b78d842cbdcd92`, fetched 12 October 2026.
  The task worktree isolates all changes; the primary checkout is not modified.
- Related historical provisioning plan:
  [native course-chatbot setup](2026-08-14-informatik-und-wirtschaft-klicker-plan.md).
  Its old worktree contains unrelated untracked work and is not reused for this package.
- Delivery: [draft PR #6483](https://github.com/uzh-bf/klicker-uzh/pull/6483)
  contains the implementation and this plan. It remains a draft while verification finishes.

The global skill is a separate requested deliverable in the canonical dotfiles checkout:
`agent-resources/agent-skills/rs-chatbot-quality-iteration/`. Its content is generic and
contains no course identifiers, transcripts or production measurements.

### Evidence, method and limitations

The earlier qualitative review screened opening questions in 232 nonempty conversations
and examined 35 selected conversations at varying depth, plus recorded exceptions. It
included short explanations, longer study tasks, different modes and selected source checks.
It was purposeful sampling, not a random accuracy audit. Long responses that were truncated
in the analyst view were not fully assessed. Known operator acceptance text was excluded
from conclusions about student needs; the provenance of all remaining traffic is unverified.

A fresh read-only aggregate check at **12 October 2026, 15:59 Europe/Zurich** found:

| Measure | Observed value | Interpretation |
| --- | ---: | --- |
| User messages | 669 | Includes questions and continuation/retry messages |
| Nonempty conversations | 234 | More activity arrived after the qualitative sample |
| Distinct sending participants | 151 | Application senders, not a verified student-only cohort |
| Created conversations / empty conversations | 247 / 13 | Creation alone is not use |
| Assistant records / records with visible text | 671 / 665 | Six blank records; all have stored lifecycle `COMPLETED` |
| Assistant records containing doc-query / tool errors | 668 / 5 | Tool calls and exceptions do not by themselves measure answer quality |
| Tutor / Quizzer / Explainer user messages | 552 / 80 / 37 | Practice also occurs in Tutor mode |

Do not derive enrolment adoption, satisfaction, learning gains, error-free delivery, or
population correctness from these numbers. Student-level themes and individual trajectories
are intentionally absent from this document. Topic categories overlap: organisation,
summaries/notes, programming/computational thinking, digital data/databases, and practice
with economic/information-system applications.

Stored content was inspected in memory with profile fields and hidden reasoning excluded.
The report uses paraphrases and aggregates. Source identifiers were used only inside the
scoped read to reconstruct message ancestry; raw records and participant labels are not
included here. Follow-up analysis should keep sibling regenerations separate rather than
flattening the entire thread into a chronological transcript.

### Findings and discriminating checks

| Finding | Confirmed evidence and consequence | Attribution and next check |
| --- | --- | --- |
| Relevant material is difficult to access | A chapter request failed, while a later title-rich request succeeded. Stored results sometimes contained the requested chapter despite refusal. | Current code keeps overflow text visible but makes it uncitable after 12 admitted identities. Verify the historical deployed contract; wording and expansion also changed. |
| Broad results crowd out the requested source | In one number-only request, 14 of 20 returned entries came from the introductory lecture and none from the requested chapter. A refined call returned that chapter at position 6; the later successful call returned it at position 3 with a longer excerpt. | Verify distinct-source grouping, ordering and clipping at the model boundary. Do not infer that the chapter needs reingestion. |
| Summary completion is overstated | An extended summary exchange claimed completion, then acknowledged relying on partial excerpts and unverified coverage. | Reproduce with a known requested item set and one unavailable source. Compare delivered items with the final claim. |
| Execution and concision drift | Repeated acknowledgements delayed a requested summary; a compact editing request expanded the notes. | Evaluate immediate delivery, instruction retention and requested depth before adding persistent task state. |
| Quiz design/feedback can confuse | A short sequence repeated the correct-option position with weak distractors. A later self-correction mischaracterised initially reasonable feedback. | Do not label the initial feedback a wrong grade. Test feedback consistency, plausible distractors and varied positions over a larger synthetic set. |
| Delivery evidence is incomplete | Six stored assistant records lack visible text despite `COMPLETED`; five records contain tool errors. | Inspect lifecycle, terminal cause and deployed revision. Stored blanks alone do not establish what the UI displayed or a current regression. |
| Administrative answers vary with evidence | Later answers correctly cite submission and eligibility rules from the introductory lecture; early answers sometimes could not locate them. | Establish source availability at the time. Check freshness and exact supporting passages before changing course content. |

For the inspected retrieval sequence, stored JSON text was approximately 79–96 thousand
characters per call. These are character counts, not token counts or proof of the model's
input size. All inspected source entries had a reference field. A reference field alone
does not prove a usable numbered citation reached generation.

The earlier quiz interpretation was corrected on full-turn inspection. This is a useful
analysis control: neither model praise nor its later apology is an authoritative grading
label. Likewise, chapter-summary completeness must be checked independently of the bot's
own retrospective description.

### Current implementation and existing work

Source-only retrieval inspection used `mcp-doc-query` `origin/main` at
`9964560a05c8189a749c6132082a14e6600bf721`. The local checkout's old guidance names `dev`,
but fresh upstream guidance names `main`; upstream source is the evidence baseline.
This inspection does not establish the deployed retrieval revision.

- `src/pipeline.py:3400–3538` builds and orders document-mode source groups and reports
  counts of returned sources/chunks. Those counts do not represent complete course coverage.
- `src/pipeline.py:2609–2695` already implements scoped source inventory with pagination,
  `truncated` and `unidentified_chunks` diagnostics. `src/mcp_server.py:894–941` exposes it
  only for token-scoped configurations and describes management-UI use. Reuse it for an
  authorised inventory check; do not assume it is an available student-facing tool or
  complete when scan truncation is reported.
- `src/components/candidate_selector.py` reserves reranker candidates using scope and
  priority metadata. Ranking changes affect more than this course and require evidence
  at that service boundary; do not globally tune these defaults from one conversation.

Chat-side source mapping at the pinned Klicker baseline establishes:

- [Citation normalization](../apps/chat/src/lib/sources/normalizeSources.ts) admits at most
  12 distinct citation identities in first-appearance order across all doc-query calls in
  an assistant message (`MAX_SOURCES`, lines 5 and 76–137). Video ranges/pages participate
  in identity; different excerpts from one recording can consume separate slots.
- [Model projection](../apps/chat/src/lib/server/citationInstructions.ts), lines 57–113,
  keeps the full sources and text but assigns `citation_index: null` to overflow. The
  [citation contract](../apps/chat/src/prompts/citation-contract.hbs) prohibits citing them.
  A later search cannot displace the first call's admitted identities. The 240-character
  source-card excerpt limit is display-only; it is **not model-context truncation**.
- [Existing projection tests](../apps/chat/test/citation-model-output.test.ts), lines
  217–243, explicitly protect the overflow/null behavior and stable indices across calls.
  This is a deliberate existing contract with a newly demonstrated user consequence,
  not a missing conditional or evidence that the model cannot read the source text.
- [Prompt compiler](../apps/chat/src/lib/server/systemPromptCompiler.ts), line 133 onward,
  places course policy, output, citation and language contracts after mode guidance.
  [Course grounding](../apps/chat/src/prompts/course-grounding.hbs) already says retrieval
  is partial. [Quizzer](../apps/chat/src/prompts/mode-quizzer.hbs) already governs one-question
  feedback, hints/retries, continuation and qualified progress snapshots. Add only rules
  demonstrated to be missing; preserve their precedence.
- [Feedback evidence](../apps/chat/src/lib/server/feedbackEvidence.ts), line 135 onward,
  already adds assistance/precision reminders before the final language reminder.
  [Chat request history](../apps/chat/src/hooks/useChatResponse.ts), lines 201–215, is
  active-branch plain text supplied by the client; the current
  [chat route](../apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts) maps it directly
  and applies a five-step tool limit. There is no demonstrated need in this package for
  new learner memory or a rewrite of history ownership.
- Existing hydration, persisted-content, tool-output, fallback and required-MCP tests cover
  several error paths. The source review found no route-level model stub proving that an
  empty model completion cannot persist as a successful answer. Confirm this gap against
  the execution baseline before adding the narrow lifecycle regression.

#### Synthetic reproduction of citation starvation

Question: can an otherwise useful later source remain uncitable solely because earlier
results consumed the registry? The local diagnostic executed the actual pinned
`normalizeSourcesFromParts` and `sourceCitationIndices` functions with synthetic inputs.
It used the installed TypeScript compiler to load those pure modules; no app runtime,
model request, database or production payload was part of the experiment.

| Synthetic case | Observed result |
| --- | --- |
| 20 distinct sources; useful source at position 16 | 12 admitted; useful source has null citation index |
| Same first call; a refined second call returns one new useful source at rank 1 | Still 12 admitted; second call has zero citable sources |
| Fresh assistant turn; useful source at position 3 | Useful source receives index 3 |

The probe exited successfully and corroborates the existing overflow test. It proves the
current source behavior, not the exact historical model input or that every refusal had
this cause. Stored failure/success sequences are consistent with this mechanism. Prioritize
the citation admission contract before corpus reingestion, a model upgrade, or broad ranking
changes. Full-source visibility and citable-source availability must be measured separately.

Reuse the existing
[Tutor feedback comparison](2026-09-28-tutor-prompt-feedback-comparison.md) and
[Tutor quality work](2026-10-01-tutor-prompt-quality-roadmap.md). They already address
assistance attribution, precision, quiz hint/retry behavior and language drift. Their
earlier synthetic results do not prove current production behavior, and their exposed
cases are regression cases rather than fresh holdouts.

The open [reasoning-effort correction](https://github.com/uzh-bf/klicker-uzh/pull/6473)
and [model-policy configuration](https://github.com/uzh-bf/klicker-uzh/pull/6423) can change
evaluation conditions. Record whether their behavior is present; do not silently combine
their model-policy changes with an answer-quality candidate. They are dependencies to
check, not PRs owned by this task.

### Product contracts and ownership

| Existing primitive | Disposition | Contract and owner |
| --- | --- | --- |
| Knowledge source and citation | Extend | Separate bounded citation admission from the visible-card preview limit; retain stable source identity, KB scope, numbering and reload behavior |
| Conversation and answer | Extend | Chat must make completion/partial coverage claims match the work delivered; existing thread/branch ownership remains unchanged |
| Tutor/Explainer/Quizzer mode | Reuse | Shared mode policy owns pedagogy; course facts belong to course material rather than platform prompts |
| Terminal turn outcome | Reuse | Existing runtime owns completion, failure and retry semantics; historical blanks require attribution before proposing new states |

No schema, new service, durable learner model, analytics pipeline, or provider is proposed.
Update the existing Chat citation documentation with the revised overflow contract during
implementation; an ADR is not required for this bounded correction. New persistent coverage state, a new
student-facing source-enumeration capability, or a changed trust boundary would require a
separate product/architecture decision before implementation.

### Proposed sequence and acceptance

The main session owns scope, privacy, historical attribution, candidate selection and final
evidence. A bounded source worker owns each settled code slice; one writer owns each path.
The retrieval service remains a separately owned repository. If the diagnosis requires
changes there, derive its bounded plan and delivery target before implementation rather
than extending the Klicker branch across repositories implicitly.

#### Delegation map

| Slice | Owner / route | Dependency and acceptance |
| --- | --- | --- |
| 1 — Baseline and attribution | Main / main | Privacy and unresolved design remain with the main session; frozen cases/configuration or an explicit inconclusive result |
| 2 — Citable evidence | Native executor / executor | Slice 1 freezes the bounded contract; deterministic citation and student-path checks pass |
| 3 — Task completion | Native executor / executor | Slice 2 isolates residual generation failures; paired synthetic cases improve without control regressions |
| 4 — Integrated comparison and delivery | Main / main | Slices 1–3 provide evidence; main owns integration, privacy review and draft delivery |

Routing selects a trusted native child for private source; no production content is
delegated. Slices 2 and 3 run serially because they share evaluation conditions. The main
session retains slices 1 and 4 for privacy, unresolved decisions and critical-path coupling.

1. **Freeze a reproducible baseline.** Record current effective prompt/config, model/effort,
   corpus metadata and deployed revision where available. Trace one retrieved-but-unusable
   source and one missing-source case through the model-facing projection. Attribute blank
   records with existing lifecycle evidence. Produce synthetic cases for confirmed patterns.
   Freeze case/repeat allocation, scoring rubrics, targeted improvement thresholds and the
   latency/cost/tool-growth guardrails below before candidate tuning. Record the existing
   evaluator's multi-turn/tool-projection support; an unfaithful prompt-only driver cannot
   accept a cross-tool citation fix.
   Acceptance: each high-priority finding has a responsible layer or a named unresolved check;
   controls distinguish insufficient corpus from lost evidence and current source from history.

2. **Make relevant evidence citable.** Separate citation registration from the source-card
   preview cap. Recommend stable append-only indices for the bounded accepted result set,
   while keeping a compact card preview and making every cited item reachable. Freeze the
   maximum accepted per-turn source/result budget from the baseline before changing it;
   keep the chosen citation ceiling at or below 99, compatible with the current two-digit
   marker and link parser. A higher ceiling requires a separately reviewed parser decision.
   no unbounded payload or citation registry is proposed. If that budget is exhausted,
   expose the limitation honestly rather than implying the material is absent. Preserve
   indices across searches and reload; do not reorder or recycle already assigned numbers.
   Likely files: `normalizeSources.ts`, `citationInstructions.ts`, `citation-contract.hbs`,
   `useMessageSources.ts`, `sources-section.tsx`, `citation-chip.tsx`,
   `remarkCitationMarkers.ts`, their existing citation tests, and `docs/chat-platform.md`.
   Extend the existing lesson in `docs/solutions/logic/retrieval-results-are-not-citation-counts.md`
   with the distinction between visible retrieval text and citation capacity.
   Change query formulation or ranking only for residual failures after this correction.
   Acceptance: a source beyond the old 12-entry limit and a new source in a refined search
   are both citable and reachable in the UI; the highest admitted index, the first overflow
   source, range-expansion bound and cited-card navigation after reload behave consistently.
   Title/number/follow-up variants reach supporting
   evidence; missing evidence still produces calibrated uncertainty. Service
   ranking or metadata changes are conditional on a reproduced service-level defect.

3. **Complete study tasks with accurate coverage.** Adjust existing shared prompt templates
   only where paired evaluation supports the change. Begin an actionable task immediately;
   retain requested length and scope; distinguish requested, covered, partial and unavailable
   items before claiming completion. Start with existing conversation state. Keep targeted
   direct answers and valid refusals. Test quiz consistency and distractors alongside existing
   attribution/hint controls; change quiz guidance only for a reproduced residual failure.
   Intended edit region: the applicable existing mode/course-grounding prompt and its
   compiler inputs, with synthetic evaluation in the existing harness. Do not change the
   shared language reminder, source authority or model policy as incidental cleanup.
   Acceptance: no unsupported all-complete claim, no avoidable acknowledgement loop, and no
   regression in the existing learning controls. Persistent task state is not preapproved.

4. **Compare, review and prepare delivery.** Run the frozen synthetic baseline/candidate set
   with identical model, corpus, tool configuration and history policy. Independently inspect
   decisive failures and reserve cases. Deliver source, updated plan, focused verification,
   aggregate evaluation results and a draft PR. Stop before merge or live changes.
   Acceptance: targeted defects improve, critical controls have zero new failures, invalid
   runs remain visible, and remaining limitations are recorded without a population accuracy
   or learning-effectiveness claim.

Each accepted implementation outcome is one coherent commit boundary. Slice 1 is diagnosis
and fixture design; it may determine that an existing fix needs release verification rather
than another code change. Do not implement every proposed remedy simply because it appears
in this plan.

### Verification portfolio

| Consequential behavior | Obligation and primary seam | Failure distinguished |
| --- | --- | --- |
| Evidence/reference survival | **Extend existing** `apps/chat/test/{normalize-sources,citation-model-output,citation-markers,citation-registry,citation-chip,source-display}.test.ts` and `playwright/tests/Y-chat.spec.ts`; exercise cross-search/reload UI | Visible tool evidence is uncitable because earlier results consumed display-linked slots |
| Chapter variants and absent-source control | **Extend existing** evaluation target `apps/chat/scripts/klicker-evaluation-target.mjs` through its supported input contract; private synthetic cases, no new repository file | Wording sensitivity versus fabricated coverage |
| Multi-part completion and concise editing | **Extend existing** multi-turn comparison described in the Tutor feedback comparison, after verifying its history/tool support | Unfinished task declared complete or request replaced by promises |
| Feedback, hints, language and direct answers | **None** initially: reuse existing synthetic controls and `apps/chat/test/feedback-evidence.test.ts`; admit a new synthetic case only for a reproduced uncovered failure with a frozen rubric | A local improvement damages established teaching behavior |
| Empty/error terminal behavior | **None** initially: inspect `apps/chat/test/chat-response-hydration.test.ts` and terminal route evidence; a reproduced route-level gap requires a bounded follow-up implementation ruling | Completed empty output versus explicit failure/retry |

No new repository files are proposed beyond this plan. Synthetic evaluation inputs and
results use the existing approved private evaluation location. Slice 1 records exact
existing harness commands and case locations before generation. If those seams cannot
faithfully represent the required histories or model-facing tool results, report the
missing capability and propose its smallest bounded extension; do not add a new harness
or broaden this portfolio implicitly. A finding may close without a test or source edit.

Do not pin generated wording, prompt prose, production messages, or seed contents in unit
tests. Deterministic tests cover serialization, scoping and lifecycle invariants; model
evaluation covers semantic behavior. Browser verification is required for any changed
interaction/rendering path and for final student-path acceptance, with synthetic accounts
and the repository's screenshot procedure where visible UI changes occur.

Reuse the existing evaluation target and private evaluation infrastructure instead of
installing a new framework. Proposed experimental cap: **120 generated assistant turns
and US$5 provider spend**, whichever is reached first, including retries and invalid runs.
The evaluation operator must be able to enforce the cap before starting. Freeze the exact
case/repeat allocation and supported model/effort with the baseline. Use the deployed
student model for acceptance; isolate one pinned model for causal comparison if Auto would
otherwise vary. Any additional route, production probe, hosted transcript reporting or
larger budget needs a separate ruling. Keep actual student conversations out of evaluation.

For each selected generation failure, allocate three matched baseline/candidate repeats
and require the candidate to pass at least two, with a strictly better pass count than the
baseline. Deterministic citation cases must all pass. Critical controls have zero new
failures across valid runs; invalid runs never count as passing or disappear from totals.
Compare median end-to-end task latency and provider cost per completed task, with ceilings
of 1.25× and 1.20× the matched baseline respectively, and at most one additional retrieval
call per task. These are package guardrails, not population-performance claims. Freeze
the scoring rubric and denominator for each measure before tuning; report missing telemetry
as unassessed and do not waive a failed guardrail to fit the candidate.

If the current effective baseline cannot be frozen, faithful multi-turn evaluation is
unavailable, or the spend/turn cap prevents the frozen comparison, quality acceptance is
**inconclusive**. Deliver the available diagnostic/source evidence and the exact missing
check. Unknown historical deployment attribution remains unknown even when a current
controlled comparison passes.

Use a development/regression set plus fresh reserved synthetic cases. Once viewed for
tuning, reserved cases become regressions. Do not lower acceptance criteria to fit a
candidate. Compare semantic task success and supported claims, not answer length alone.
Long-summary latency/cost and tool-call growth are guardrails, not evidence of correctness.

### Release, recovery and boundaries

Approval covers local implementation, tests, review, ordinary task-branch pushes
and draft PR delivery. It does not authorize production DB writes, KB reingestion, live
prompt/model changes, cluster connectivity, infrastructure changes, merge or deployment.
Current work makes no such changes. No monitoring automation or messages to people are needed.

Recover source changes with an ordinary revert. Before any later live config apply, capture
the exact reviewed before-state through the existing guarded operator workflow and verify
the after-state and rollback target. For a release, verify the deployed revision separately
and run synthetic student-path acceptance; a merged PR is not a live-quality receipt.

### Progress and review provenance

#### Execution baseline and evaluation ruling — 12 October 2026

The desired production manifest pins `v3.4.0-alpha.86` with three Chat replicas and
`lifecycleWritersEnabled: false`. These are repository configuration facts, not a fresh
cluster rollout receipt. The schema defaults `ChatMessage.lifecycleStatus` to `COMPLETED`,
while `services/accountUsage.ts` gates lifecycle attempts on
`CHAT_TURN_LIFECYCLE_WRITES_ENABLED`. Therefore, a historical blank row labelled
`COMPLETED` is insufficient evidence of successful terminal delivery. Its exact provider
outcome, historical deployed prompt and displayed UI remain unverified. No lifecycle or
infrastructure change is included in this package.

The deterministic candidate contract is frozen at **99 unique citation identities per
assistant message**, appended in first-appearance order across searches. The separate
initial preview contains at most **12 cited cards**. Remaining cited and uncited cards
stay available in the existing disclosure. The model receives all original source text;
identity 100 and later receive null citation indices. This ceiling matches the existing
two-digit marker parser and does not increase retrieval payload size or the tool-step limit.

The existing runner is `apps/chat/scripts/run-tutor-trajectories.mjs`, using
`klicker-evaluation-target.mjs` and `tutor-trajectory.mjs`. It does preserve real reply
history and verifies persisted results, but it cannot yet accept this complete comparison:

- Its source-metadata receipt independently stops at 12 sources and deduplicates by
  reference/title rather than the application's citation identity. It cannot establish
  whether later sources survived the actual model-facing projection.
- It accepts Tutor and Quizzer cases, not Explainer cases. The deterministic local MCP
  fixture also does not reproduce broad retrieval followed by a useful refined result.
- Its shared ledger counts submitted turns before requests, but tracks application
  credits after completion and explicitly allows one in-flight overshoot. It does not
  enforce the approved hard US$5 provider-spend limit.

**Generation-quality acceptance is inconclusive; zero assistant turns were generated.**
No generation case allocation or tuning run began. Mode, task-completion, concision and
quiz prompts remain unchanged. The citation overflow instruction changes only the
deterministic source contract; tests and browser checks cannot establish better generated
answers or satisfy the model latency/cost guardrails.

The smallest follow-up is to extend those existing runner/fixture seams with evidence from
the actual bounded citation mapping, Explainer support and a pre-request provider-cost reservation
that accounts for all model/tool steps. Qualify the pinned current model and fixed effort,
then freeze development/reserved/control cases and three matched repeats under the
existing 120-turn/US$5 caps. This is a proposed follow-up, not an implicit new harness or
permission to use another provider. No course content should be copied into fixtures.

#### Delivery progress

- Slice 1: source baseline and attribution investigation complete; historical generation
  and UI outcomes remain unknown. The existing evaluator cannot accept the frozen
  comparison under the approved provider-cost cap; see the ruling above.
- Slice 2: implemented in `11ae42d363`, with assertion consolidation and formatting in
  `125254c30d`. The focused container suite passed **164 tests across eight files**;
  Chat route generation and TypeScript checking passed. All **21 local source-citation
  browser tests** passed, including desktop English, reload and mobile German. All
  **120 chat browser tests** passed in CI on `11ae42d363`; subsequent edits affect only
  test consolidation, formatting and documentation. Manual browser inspection confirmed
  99 retained cards, 12 initially visible cards and citation 99 opening its disclosure,
  focusing the correct card and retaining its expected synthetic URL.
- Slice 3: conditional prompt tuning was not started because paired generation acceptance
  is unavailable. No task-completion, concision, mode or quiz instruction changed.
- Slice 4: [draft PR #6483](https://github.com/uzh-bf/klicker-uzh/pull/6483) is open.
  Final integrated review and final-head CI are recorded in the PR. Chat lint passed
  with 20 pre-existing warnings; Chat and Playwright type checks, focused Biome checks
  and explicit-config Prettier checks passed. The first CI formatter
  failure was corrected using repository formatters. OpenCodeReview failed with provider
  HTTP 402 on all three requests, producing no review; no billing or provider configuration
  was changed. Greptile reported no actionable issue on the initial implementation head.
- Slice review: **PASS**, no correction-level findings. Simplification removed one
  redundant normalizer test while retaining the stronger cross-search case and browser
  coverage. Reports: `_local/reviews/2026-10-12-chatbot-citation-cap-slice-review.md` and
  `_local/reviews/2026-10-12-chatbot-citation-cap-simplifier.md`.
- Planning review: **APPROVED** after one correction round. Native planner confirmed the
  revised ownership, test obligations, parser-compatible citation ceiling and comparison
  thresholds. Local report: `_local/reviews/2026-10-12-chatbot-learning-quality-planner.md`.
- Optional external rival/TypeSafe advice was skipped because the draft contains private,
  production-derived findings; native review and source checks preserve that boundary.
- Global skill: created and locally committed as `f5830ad` in canonical dotfiles; not pushed.
  Frontmatter and shared invocation-policy/link checks pass. An independent
  synthetic forward test exposed invented time boundaries and inferred exercise state;
  both received narrow corrections. Final validation and staged secret/whitespace checks pass.
  Local report: `_local/reviews/2026-10-12-chatbot-quality-skill-forward-test.md`.
  The skill is discoverable
  through the existing global symlink.
- A task-local runtime was started for verification. Its optional authenticated MCP fixture
  failed startup; after stopping that runtime, the smaller Chat-only profile passed the
  synthetic browser checks. Final runtime shutdown and provider-state verification are
  delivery obligations recorded in the PR. No production state was changed.
- Packaging: one cohesive citation correction, tests and documentation; no independent
  capability or second delivery layer is bundled. No new dependency, schema or service.
- Next action: complete the integrated review, final-head CI and screenshot publication,
  update the draft and release the task-local runtime. Merge and live effects retain
  separate authority; generated-answer quality remains explicitly inconclusive.
