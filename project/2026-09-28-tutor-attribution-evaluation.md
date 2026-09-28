# Tutor assistance-attribution evaluation

Date: 28 September 2026. Status: candidate rejected; baseline prompt templates restored. Independent
semantic assessment confirmed rejection; final package review is pending.

## Question and evidence boundary

Can a small feedback procedure improve attribution of visible help while
preserving correct feedback, explanations and learner control? The accepted
[plan](2026-09-28-tutor-attribution-evaluation-plan.md) defines the gate before
outputs. The earlier [prompt comparison](2026-09-28-tutor-prompt-feedback-comparison.md)
and local live run are exposed regression evidence, not this experiment's holdout.

The experiment uses synthetic finance conversations, fixed direct
`gpt-5.6-luna`, requested low reasoning and the local `KB_doc_query` fixture.
Application request logs verified that deployment and effort during warmup.
One completed canary verified tool use, marker response and persisted output;
its usage is included in the shared budget. This is not a comparison with the
prior Azure run or a measurement of learning effectiveness.

## Frozen inputs

The sole candidate was frozen before the independent corpus author began the
reserved scenarios. Its author did not revise it after seeing corpus outputs.
The corpus contains six development regressions, four reserved scenarios and
two controls: 32 turns per pass, twice per arm, for 128 planned comparison turns.
There are six English and six German cases. Manual semantic assessment is
unblinded and uncalibrated; there is no teacher adjudication or automated judge.

- Corpus SHA-256: `a63bf46f5d7ac3347ad0e520ee3e0c06018c060ac0d4bf858260a2316096c2da`.
- Rubric SHA-256: `ea3c8163cbedc676aae99bd34263c36b7feef66423b3863911ecc0bbb22731a8`.
- Baseline Tutor: `602e6d6ec6f37630ba8c40a7e20fb7bf1c1bfccf0d496927a6820da90ac4b9f5`.
- Candidate Tutor: `f5a246140e3125d169cc9bf91545d562376d7fa0b11addbc0ae59f6840e3a983`.
- Baseline Quizzer: `8c52d36cbb15fbb19d00c4c60ffa2eeb47f5e97ef7e924678b8965d2d37cf5ac`.
- Candidate Quizzer: `89bb3370e570132d2806b3b7806f868027ba925433bc32ca4a9b8b84d5727020`.

The small source candidate identifies shown work and supplied assistance before
naming a strength, qualifies each criterion at first mention, and limits claims
from a bare result to that result. No explanation, stop, retry or checkpoint
threshold policy is intentionally changed. The baseline templates were restored after the candidate failed the local gate.

### Reproducible candidate clauses

These replace the assistance-attribution sentences in the existing feedback
bullet (Tutor) and cycle-count bullet (Quizzer), respectively; surrounding
policies remain the baseline versions recorded in the plan.

**mode-tutor.hbs**

> Before naming a strength, identify what the student showed and what answer, method, or hint you already supplied for that task. State correctness and visible help together at the first mention: an accurate repetition follows the worked explanation; an answer reached after a hint used that hint. Describe new reasoning by the concrete step shown. A correct result without working supports a claim about that result only; independent understanding remains unestablished.

**mode-quizzer.hbs**

> Before writing each strength in a snapshot or checkpoint, identify its supporting attempt and the answer, method, or hint supplied for that criterion. State the observed success and that help together: repeating an explanation follows the worked solution; solving after a hint used that hint. Describe new reasoning by the concrete step shown. Qualify each criterion separately when support differs. A correct result without working supports a claim about that result only; missing help history leaves independence unknown.

## Results and decision

**Reject the candidate and retain the baseline prompts.** Both arms completed
64/64 submitted turns, covering 24 case-repeats each. The candidate still credits
copied work and claims understanding without sufficient evidence. A reduction
in reserved-case attribution failures does not override the critical development
gate. One candidate hinted-answer trajectory also lacks its intended support:
the assistant declined to give a hint before the fixed learner turn claimed to
use one. This support-premise invalidity extends the plan's explicit
different-question trigger; either invalid or failed treatment leaves rejection
unchanged. Keep it in planned coverage and do not count it as a pass.

The table below records main-session semantic assessment, with the independent
check confirming every reviewed case disposition. A case-repeat fails attribution if any designated response overcredits
understanding/independent reasoning or attributes supplied work to the learner.
Correctness-only feedback is not an understanding claim. Claims of having
applied or recognized a method from a literal copy count as unsupported evidence;
a later qualification does not erase that earlier claim. This interpretation
is reported explicitly because semantic judgments can differ.

| Planned case-repeats | Baseline attribution failures | Candidate attribution failures | Candidate invalid |
| -------------------- | ----------------------------: | -----------------------------: | ----------------: |
| Development          |                          4/12 |                           4/12 |              1/12 |
| Reserved             |                           2/8 |                            1/8 |               0/8 |
| Controls             |                           1/4 |                            1/4 |               0/4 |

Critical unsupported-understanding/reasoning claims occurred in 2/12 development
case-repeats on baseline and 4/12 on candidate. The required candidate count was
zero. These counts are descriptive observations, not estimated population rates.
The denominator includes invalid cases; zero recorded failures never means all
cases passed. All four preserved-behavior control case-repeats in each arm
corrected the error, allowed the alternative method, or respected explanation
and pause as applicable. Attribution weaknesses within a control remain counted.

| Breakdown                    | Baseline attribution failures | Candidate attribution failures |
| ---------------------------- | ----------------------------: | -----------------------------: |
| Tutor                        |                          3/18 |                           5/18 |
| Quizzer                      |                           4/6 |                            1/6 |
| English                      |                          2/12 |                           3/12 |
| German                       |                          5/12 |                           3/12 |
| Copied explanation           |                           2/4 |                            4/4 |
| Copy plus meaning question   |                           0/2 |                            0/2 |
| Hint                         |                           2/4 |              0/4 (one invalid) |
| Bare answer                  |                           0/2 |                            0/2 |
| Paraphrase                   |                           0/4 |                            0/4 |
| Worked help then transfer    |                           0/2 |                            0/2 |
| Mixed support                |                           2/2 |                            1/2 |
| Correction/retry/alternative |                           1/2 |                            1/2 |
| Explanation/pause            |                           0/2 |                            0/2 |

### Evidence that determines rejection

- **Copied bond pricing, candidate repeats 1 and 2, turn 2:** credits the learner
  with the supplied method and cash-flow setup without acknowledging the copy.
  One response invents a refinement; the other invents another incorrect price
  after the initial model calculation was already wrong.
- **Copied time value, candidate repeats 1 and 2, turn 2:** credits summarizing or
  recognizing the mechanism, while the learner literally repeated the model's
  explanation. Neither response identifies the reused help.
- **Mixed-support Quizzer, candidate repeat 2, turn 5:** explicitly claims the
  learner understood both concepts, although one response was a bare choice and
  the other followed a hint. Baseline repeat 2 similarly calls a bare selection
  independently derived at turns 2 and 5.
- **Bare-answer Tutor, both repeats in both arms:** confirms the correct number
  and supplies a derivation without asking for the learner's working. This is a
  rubric failure separate from unsupported-understanding claims.
- **Transfer arithmetic:** the supplied answer CHF 981.92 is correctly rounded
  from CHF 981.9198183. Both baseline repeats and candidate repeat 2 invent an
  arithmetic correction. This is a diagnostic accuracy issue separate from
  assistance attribution.

Independent assessment covers every main-scored rubric failure and four apparent
passes spanning both languages and modes. It confirmed all 23 failure/invalid dispositions and all four apparent passes.
One dimension was corrected: a bare answer labeled independently derived is
unsupported reasoning evidence, while the visible assistance was accurately
reported. This does not change the aggregate attribution count. The reviewer
confirmed rejection and verified the arithmetic. Remaining passes were assessed
by the main session only. These reserved scenarios are now exposed and must
not be described as held out in a later tuning round.

## Execution and limitations

The comparison used 128 submissions, plus one initial canary and one post-review
protocol canary: **130/160 submitted turns**, **0.248203/3 application credits**,
no failed requests, no retries, and no uncertain accounting remaining. Credits
are application units, not a dollar-cost claim. Both comparison arms used the
configured direct deployment and requested low reasoning on all 128 requests.
Compiled prompt fingerprints were:

| Mode    | Baseline       | Candidate      |
| ------- | -------------- | -------------- |
| Tutor   | `cbd624291de4` | `84e1cb897d4c` |
| Quizzer | `be2dc892f2c9` | `b136b658f582` |

The direct alias has zero configured retries and no configured fallback. Provider
internal model revisions remain uncontrolled. Baseline preceded candidate;
there was no randomization or blinded/calibrated judge. The deterministic fixture
content does not make model-selected retrieval queries deterministic. Several
German queries returned no usable material, causing refusals or unsupported
explanations. Those responses can suppress observable attribution errors without
improving feedback, which limits the apparent Quizzer improvement. A candidate
CAPM paraphrase also contains an ambiguous beta reference that can attribute
beta to diversifiable risk. That accuracy concern sits outside the attribution
count and is interpretation-sensitive; it does not affect rejection. The retained
baseline still has attribution and invented-arithmetic defects.

Before comparison, the harness was corrected to require retrieval on each first
turn while allowing later turns to use existing conversation context. Learner
inputs, candidate and rubrics stayed frozen. A code review during the runs found
that the harness also needed equality checks for stream/persisted usage and
retrieval call identity. Those fixes have synthetic regression coverage and
passed a separate real-app protocol canary. The earlier 128 comparison turns
verified tool name/completion but did **not** compare tool IDs. A read-only
reconciliation of all 128 saved usage values found zero disagreements with their
receipts; it does not retroactively prove streamed call identity.

The candidate failed before Auto acceptance, so no candidate Auto/browser
acceptance run was performed. This package changes the evaluation harness and
scenario data; it retains the original production prompt templates. Earlier
browser evidence is context, not proof of this candidate's acceptance. No UI
rendering or interaction code changes require a screenshot gallery.

## Next improvements supported by these findings

1. Improve the deterministic fixture's bilingual query coverage, then validate
   hint/scenario validity before drawing behavioral conclusions. Keep production
   retrieval changes separate.
2. Evaluate a feedback procedure that checks the origin of each claimed strength
   against the actual visible attempt and supplied help. A stronger wording rule
   alone has not proved sufficient; any durable learner state needs separate
   design and data-protection review.
3. Add independent numerical checks to the evaluation rubric so correct student
   calculations cannot be labeled wrong without detection. Keep numeric accuracy
   separate from attribution and do not introduce prose-matching tests.
4. Test checkpoint timing and criterion-specific support with new reserved
   trajectories. The current reserved cases are exposed, and this experiment does
   not establish reliable timing, production grounding or learning effectiveness.

## Verification and delivery

The final harness passes **26 focused Vitest tests**, covering ancestry,
stream/persisted text, retrieval identity/completion, sanitized receipts,
accounting disagreement, interruption uncertainty and preserved single-turn API.
The post-review real-app canary passed the stronger identity/accounting checks,
returned the expected synthetic marker, and persisted its answer and tool result.

Repository typecheck, lint and policy checks passed in the container. Both
Playwright infrastructure suites ran on the host (39 and 84 passed); the root
aggregate cannot run unchanged in the container because those commands require
host execution. Hooks use these equivalent split checks. Staged formatting,
Git identity and secret/data hygiene are checked before commits. Focused Opengrep
reported no findings in the two evaluation scripts. Simplification removed a
duplicate budget guard and repeated test scaffolding without removing assertions.

Root build passed all 23 tasks after stopping the owned dev process and
preserving conflicting generated dev types outside compiler inputs. Slice review
confirmed both accounting and retrieval-identity fixes. Independent semantic assessment confirmed rejection. Draft [PR #6319](https://github.com/uzh-bf/klicker-uzh/pull/6319) contains the
package. Integrated final review passed with no findings through
the configured continuity fallback. GitHub automatic code review
failed on provider authentication before reviewing any files; this is a delivery
blocker, not a code-review pass. See the PR for current exact-head CI and
final-review status. The exact task runtime is stopped: seven owned containers
exited, the app mount matches the task checkout, and its routes are absent.
Volumes and worktree are retained. No merge or
deployment is part of this package.
