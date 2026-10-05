# Tutor attribution experiment: revised fixtures and numerical controls

## Outcome

The candidate is **rejected** and the existing Tutor and Quizzer prompts
remain byte-for-byte unchanged. The third authorized attempt (retry3) ran the
full baseline arm and 54 of 64 candidate turns. It then stopped on a request
timeout, which the fixed rule treats as an uncertain request.

The candidate fails three gate conditions independently of the missing turns:

- **Coverage:** incomplete. Both control cases have no candidate receipts.
- **Development attribution:** four unsupported understanding or independence
  claims remain, on the copied bond and copied time-value cases. The baseline
  shows the same four.
- **Numerical correctness:** both candidate repeats of the copied bond case
  claim 1,027.80 CHF against a reference of 1,027.75 CHF (tolerance 0.01).

Reserved cases improved only slightly: 5 of 8 candidate trajectories fail,
against 6 of 7 valid baseline trajectories. Both arms pass the hinted numeric
bond case when the help is visible. Neither arm separates a supplied worked
example from the learner's new CAPM step.

## Verification and failure boundary

Earlier attempts are preserved as failed ledgers:

- The first canary failed with an upstream 401 because the LiteLLM service lacked the
  injected key.
- Retry1 was rejected with 403 `AI_FEATURES_DISABLED` before any model call.
  The seed leaves `User.aiFeaturesEnabled` false for the lecturer, so every
  reseeded local runtime needs that flag set before Chat admits requests.
- Retry2 lost its host virtual machine when the disk filled. Its one submission
  stays permanently uncertain.

Retry3 ran `gpt-5.6-luna` at low reasoning effort on the direct Luna
deployment, with two repeats per arm. Per-request runtime logs prove model, deployment, effort, mode and
compiled system-prompt hash for every counted turn. The prompt loader caches
templates in process memory, so switching arms required a full runtime restart;
one canary turn spent on the cached baseline prompt is recorded, not scored.

The retry3 ledger holds 122 submissions and 0.243 credits, reconciled against
the application database, under the 160-turn cap and 3-credit ceiling. The
timed-out submission completed on the server, but its flag stays uncertain and
no further calls were made.

The main session scored every trajectory against the frozen rubrics and
numerical sidecar. A separate read-only reviewer independently assessed all 30
failed, invalid and sampled passing cells. It agreed on 28. It reclassified one
baseline cell as invalid because the reply revealed the answer before the
retry. It also flagged one inconsistent baseline pass, which was corrected to
an omission. Neither change affects the rejection.

Both arms often answered English prompts in German. No rubric criterion covers
response language, so this drift is recorded but not scored.

The runtime was stopped after the run; no task containers remain. Receipts,
scoring packets and scores stay outside Git.

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

The candidate was frozen before the separate corpus author started and was not
applied before retry3. The author could read the old corpus and behavioral
requirements but not the new candidate. The reserved cases are now spent;
a future candidate needs fresh reserved cases. False fixed learner statements
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
lines remain identical. The following clauses record the exact rejected
variant; it was applied only to the local runtime during the candidate arm.

### mode-tutor.hbs

```text
- Before giving feedback, check the result against the task inputs and course material, including any numerical calculation. Describe the correctness of the result separately from evidence about how the student reached it. For each strength, compare the student's visible contribution with explanations, methods, answers, and hints already provided for that same criterion. A matching answer or explanation shows that the student followed the supplied help; identify a new reasoning step only when the student actually shows one beyond that help. State that evidence and its assistance together in the first feedback sentence. If working or help history is absent, say what can be checked and leave independent reasoning unknown. Name a gap only when visible evidence supports it, then give one proportionate next step.
```

### mode-quizzer.hbs

```text
- After every completed practice attempt, check the result against the question inputs and retrieved material, including any numerical calculation. Give brief, criterion-specific feedback before moving on. Describe result correctness separately from evidence about the student's reasoning. Compare each proposed strength with the student's visible work and earlier hints, methods, or answers for that same criterion. Credit only the new step actually shown; describe a matching supplied explanation or answer as following that help, with the assistance stated at first mention. If working or help history is absent, leave independence unknown. Identify a gap only when the visible evidence supports it; a sound answer needs no invented weakness. Give one proportionate next step.
```

## Remaining work

None for this experiment. A future attempt needs a new candidate that addresses
copied-work overclaims and the separation of supplied examples from new steps,
a new authorization and a fresh ledger. Fix the seed's `aiFeaturesEnabled` gap
separately. No ready transition, merge, release or deployment is part of this
work.
