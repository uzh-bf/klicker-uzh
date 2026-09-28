# Tutor attribution experiment: revised fixtures and numerical controls

## Outcome

The second experiment is **incomplete**. Its first protocol canary failed with
`chat_stream_error`; no comparison trajectory completed. The existing Tutor and
Quizzer prompts remain byte-for-byte unchanged. This result neither accepts nor
rejects the prepared candidate's teaching behavior.

The prerequisite changes are verified: local synthetic material now includes
German terminology and explanations, and a numerical reference separates
correctness, incorrect claims and missing evidence. A fresh comparison corpus
and numerical obligations are prepared for a later authorized run.

## Verification and failure boundary

- 34 focused container tests pass: 30 evaluator/numerical contracts and four
  existing document-loader/matcher contracts. Four numerical tests were added.
- Static fixture coverage passes 21 positive English/German queries, eight
  unrelated negative queries and all 12 prior corpus openers. This proves finite
  keyword coverage, not arbitrary model query recall or live grounding.
- Repository container checks pass, including 35 typecheck/build dependency
  tasks, lint, staged formatting, synchronization and policy checks. The root
  production build passes 23/23 tasks. Unchanged host Playwright infrastructure
  evidence (39 and 84 tests) is reused; no new UI behavior was introduced.
- Prerequisite simplification found no useful reduction; independent slice
  review found no threshold issues. Staged secret scanning passes; focused Opengrep reports zero findings and
  zero scanner errors.

The local runtime started successfully after host permissions were restored.
Startup recreated the LiteLLM service without the runtime-injected upstream key.
A values-free inspection confirmed the missing key; the application logged an
upstream `AuthenticationError` with HTTP 401 for the failed canary. This
confirms an authentication failure independently of the accounting stop. The app also
logged a Turbopack HMR error. No source change was made to work around either
runtime problem. Final shutdown verified all seven task containers exited and
zero exact-worktree routes; data and the worktree were retained.

The ledger contains one submitted request, zero completed turns, zero accounted
application credits, and `uncertain=true`. Zero accounted credits do **not** prove
zero provider cost. The fixed rule stops all further model calls after an
unreconciled request. No automatic retry, budget replacement, or uncertainty
clearance was performed. Comparison coverage is 0/128 planned turns; no
attribution or numerical pass rate can be computed. Auto/browser acceptance and
independent response scoring were not applicable because no candidate output
exists.

## Prepared comparison contract

The revised corpus has six exposed development regressions, four fresh reserved
cases and two controls. Its numerical sidecar contains 17 obligations over 13 assessment turns and
binds explicit inputs, units,
tolerances and answer obligations to case IDs and one-based assessment turns.
All compounding is annual; rates are decimal fractions. Currency tolerance is
0.01, and decimal-return tolerance is 0.0001. Numerical claims require semantic
annotation before machine comparison; missing required evidence stays
unassessed. `studentAnswerCorrect` labels the fixed learner claim;
`requiredAnswer` requires an assessable assistant judgment, including an explicit
endorsement of the learner's number. Silence is insufficient. Optional numerical
claims are still checked when present. A numerical match does not establish
independent reasoning.

The candidate was frozen before the separate corpus author started and was never
applied to the application. The author could read the old corpus and behavioral
requirements but not the new candidate. Fresh reserved cases remain unevaluated;
the candidate must not be tuned against them. False fixed learner statements
about hints are replaced with feedback requests tied to assistance actually
visible in the conversation. Missing intended questions or help still makes a
trajectory invalid rather than successful.

Frozen corpus SHA-256: `8060466823fa6a50867aaac0ddd2458acb924f9baa53c7ce423c9b2c794594d4`.
Numerical sidecar SHA-256: `7618cc74561da0fde7fc75181f4e604362def0f02fe0567998c3c6b8a3d2053e`.
All reference values agree with independent annual iteration, annuity or
algebraic checks. Four non-calculation assessment turns remain semantic checks.

The original gate remains fixed: complete valid coverage; zero unsupported
understanding/independence claims on critical development cases; fewer reserved
attribution failures than baseline; zero incorrect numerical claims or invented
numerical corrections on designated assessments; no new control failures.
Baseline zero reserved failures is inconclusive. Retaining a passing candidate
also requires real Auto/browser checks, including citations and reload.

## Candidate record

Baseline prompt hashes are unchanged from the first experiment:

- `mode-tutor.hbs`: baseline `602e6d6ec6f37630ba8c40a7e20fb7bf1c1bfccf0d496927a6820da90ac4b9f5`; candidate `ed3b1153e367c83701eae40ba828af4990867236c795eeed0719cb77b9f40bb4`.
- `mode-quizzer.hbs`: baseline `8c52d36cbb15fbb19d00c4c60ffa2eeb47f5e97ef7e924678b8965d2d37cf5ac`; candidate `84404e7b9a8e7a0d429b92fd90b0659167ace7602f1a51f22a6c7859d54b5c40`.

The sole candidate replaces only each mode's feedback clause; all other prompt
lines remain identical. The following clauses preserve the exact prepared
variant for a future run without activating it in product source.

### mode-tutor.hbs

```text
- Before giving feedback, check the result against the task inputs and course material, including any numerical calculation. Describe the correctness of the result separately from evidence about how the student reached it. For each strength, compare the student's visible contribution with explanations, methods, answers, and hints already provided for that same criterion. A matching answer or explanation shows that the student followed the supplied help; identify a new reasoning step only when the student actually shows one beyond that help. State that evidence and its assistance together in the first feedback sentence. If working or help history is absent, say what can be checked and leave independent reasoning unknown. Name a gap only when visible evidence supports it, then give one proportionate next step.
```

### mode-quizzer.hbs

```text
- After every completed practice attempt, check the result against the question inputs and retrieved material, including any numerical calculation. Give brief, criterion-specific feedback before moving on. Describe result correctness separately from evidence about the student's reasoning. Compare each proposed strength with the student's visible work and earlier hints, methods, or answers for that same criterion. Credit only the new step actually shown; describe a matching supplied explanation or answer as following that help, with the assistance stated at first mention. If working or help history is absent, leave independence unknown. Identify a gap only when the visible evidence supports it; a sound answer needs no invented weakness. Give one proportionate next step.
```

## Remaining work

Before another live attempt, restore the existing host-side operator injection
when starting the exact local runtime and verify upstream-key presence without
printing its value. Disposition the failed submission and authorize a retry
experiment explicitly; preserve this stopped ledger and its incomplete result.
Then validate the frozen corpus and numerical sidecar, prove both compiled
prompt variants and model settings, execute the fixed comparison, score all
outputs and obtain independent semantic assessment. Retain baseline prompts
unless every gate passes. No ready transition, merge, release or deployment is
part of this work.
