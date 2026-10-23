# Live quiz response limit for free-text questions

## Approval summary

**Why and what changes?** Lecturers want students to add several answers to one
free-text question while a live quiz block runs, for example to grow a word
cloud. Today the student app locks a question after one response and the
response worker drops repeats from identified participants. This package adds a
**response limit** to free-text elements (default 1, maximum 10). In a standard
live quiz, a participant may send up to that many distinct responses. Only the
first response earns points. Evaluation gains a **respondent** count next to the
existing response count, and labels stop calling response counts
"participants".

**What stays unchanged?** Elements without a limit, or with limit 1, behave
exactly as today on every path. Assessment-mode live quizzes, practice quizzes,
microlearnings, and group activities ignore the limit. No database migration;
the limit lives in element options JSON. Persisted results keep their meaning.

**What could change the decision?** Anonymous participants are capped only on
their device, as single responses are today. Server rejections stay invisible to
students because response-api answers before the worker runs. Limited responses commit admission, results and first-response scoring in one
Redis script; lost replies are retried by message ID without double counting. The worker edits overlap the
idle open stack #5901 → #5902 → #5918; whichever lands second rebases. No new
rate limiting.

**How will we know it is done?** Unit tests for atomic admission and counting,
a Playwright scenario with a limit of 3, and browser screenshots of the editor,
the student flow, and the evaluation counts.

**What does approval authorize?** An executable batch: implementation in this
worktree, local commits, pushes of this stack's three task branches including
`--force-with-lease` pushes when restacking or rebasing them, and a three-layer
draft stacked PR against `v3`. Marking ready, merging, deployment, and any push
to branches outside this stack stay withheld.

## Execution details

### Settled decisions

| Decision | Ruling |
| --- | --- |
| Shape | Repeated responses over time up to a cap (not several fields in one response) |
| Activity scope | Standard live quiz only |
| Element types | Free text only |
| Setting home | Element option `responseLimit`, a sibling of `restrictions`, edited next to max length; the editor states it applies only in standard live quizzes |
| Values | Absent or 1 means today's behaviour; the field suggests 3 when raised; maximum 10 |
| Points | First accepted response only (participation, correctness, timing bonus, leaderboard, XP) |
| Counts | `participants`/`total` keep meaning responses; add a respondent count; percentages stay relative to responses |
| Anonymous | Device-side cap only; the client sends an `isFirstResponse` flag the worker trusts for anonymous messages only |
| Rate limiting | None new; anonymous gap and over-cap task runs recorded as a follow-up |
| Student flow | First accepted response marks the question answered for block navigation; input stays enabled until the limit or block end; field clears; own earlier responses (this device) and "n of m" shown; no edit or delete; draft autosave continues while open; timer expiry submits a valid draft |
| Duplicates | Same worker results hash from the same participant is dropped and does not use up the limit; device blocks it for anonymous participants |
| Normalization | Unchanged here; the case mismatch is a separate fix |

Domain terms **Response**, **Response limit**, and **Respondent** are recorded in
`CONTEXT.md`.

### Evidence and binding contracts

- Server dedup today: `apps/hatchet-worker-response-processor/src/processors/processor.ts:126-140` (`hexists` on `lq:{quiz}:i:{instance}:responses`, identified participants only). The FREE_TEXT branch writes results, `responseHashes`, `participants`, the `:responses` marker, then points (`processor.ts:387-463`).
- The response-api standard handler pushes a Hatchet event with a fresh `messageId` and returns 200 before processing (`apps/response-api/src/index.ts:93-157`). The authenticated task is durable with 3 retries.
- Redis info is seeded at block activation; FREE_TEXT copies `restrictions` and `solutions` from `elementData.options` (`packages/graphql/src/services/liveQuizzes.ts:1251-1261`).
- Block results read `info`, `responseHashes`, `responses`, `results` and filter only the `participants` key (`packages/util/src/blocks.ts:62-112`); `total = participants`.
- Free-text evaluation sums `results.total + anonymousResults.total` (`packages/graphql/src/services/stacks.ts` `computeFreeTextEvaluation`); `EvaluationFooter.tsx:68-77` labels it "total participants"; cockpit `numOfParticipants` is the minimum of instance totals (`liveQuizzes.ts:1007-1042`).
- PWA lock and navigation: `QuestionArea.tsx` `onSubmit` (159-199), `onExpire` (201-233), FREE_TEXT branch of `answerQuestion` (335-362), `allowedMaxIndex` and `disabledInput` (518-558); `useRemainingInstances.ts`; `storageHelpers.ts`; `FreeTextQuestion.tsx` disables on `existingResponse`.
- Element option plumbing: `packages/types/src/index.ts` (`ElementOptionsFreeText`), `packages/graphql/src/schema/element.ts` (`OptionsFreeTextInput`), `schema/elementData.ts` (`FreeTextElementOptions`), `lib/validateAndProcessElementOptions.ts` (FREE_TEXT case rebuilds the stored object, so the new field must be added there).

### Contracts introduced

- `ElementOptionsFreeText.responseLimit?: number` (integer 1–10). Exposed on the GraphQL input and output types. Absent means 1.
- Redis info field `responseLimit` for FREE_TEXT instances in standard live quizzes only.
- A fixed set of new per-instance Redis keys under the `lq:{quiz}:i:{instance}:` prefix: a processed-message set, a set of `participantKey:hash` members, a hash of per-participant response counts, and a respondent counter outside the `:results` hash. Block-close expiry (`removeCacheEntriesBlock`, `liveQuizzes.ts:1428-1473`) and cancel/reset unlinks (`liveQuizzes.ts:2212-2218`, `2640-2652`) match by prefix, and `execution` only increments on those reset paths, so no lifecycle code changes.
- `ElementResultsOpen.respondents?: number`, written at block close for instances with a limit above 1. Older results lack it; readers fall back to `total`.
- Evaluation and cockpit expose the respondent count where present.
- response-api forwards an optional boolean `isFirstResponse`; the worker uses it only for anonymous messages.

### Atomic response commit (limit above 1)

The worker validates the block state and response and calculates the existing
free-text score before calling one Redis script. The script checks message
replay, participant/hash duplication, and the per-participant cap. It validates
key types and integer counters before writing. In one operation it records the
message and admission, response totals and hashes, and the respondent count.
Only the first identified response writes the response marker, points, XP, and
leaderboards. Eligible identified responses initialize the timing-bonus clock.
An absent anonymous first-response flag retains legacy single-response behavior.

A lost reply can be retried with the same message ID: a committed response is
recognized without applying any effect again. Script failures are thrown so
Hatchet retries. There is no separate admission rollback. Limit 1 retains its
existing pipeline behavior. This replaces the earlier split admission/undo
algorithm after review demonstrated partial-write and first-response races.

### Stack topology

```yaml
feature: live-quiz-response-limit
provider: github
base: v3
mode: progressive
layers:
  - id: 01
    name: Response limit admission in the live quiz worker
    work_package: element option, Redis seeding, atomic admission and result commit, respondent counter, block-close persistence
    depends_on: v3
    reviewer: backend / live-quiz pipeline
    attention: judgment-heavy
    reviewer_focus:
      - limit 1 path byte-identical in behaviour to today
      - admission atomic and idempotent under Hatchet retries
      - new keys expire and reset with the existing per-instance keys
    validation:
      - pnpm --filter @klicker-uzh/graphql test (new admission tests against the Redis service that test-graphql.yml already provides)
      - pnpm --filter @klicker-uzh/graphql check and build; worker and response-api build
    activation: inert (no editor UI; limit settable only through the API)
    risk: medium
    size_signal: ~300/12 (+ public SDL snapshot)
  - id: 02
    name: Respondent count in live quiz evaluation
    work_package: GraphQL exposure of respondents, evaluation footer and cockpit labels
    depends_on: 01
    reviewer: lecturer UI
    attention: judgment-heavy
    reviewer_focus:
      - labels truthful for limit 1 (respondents = responses) and above 1
      - cockpit count uses respondents where present
    validation:
      - pnpm --filter @klicker-uzh/graphql check; frontend-manage check
      - browser screenshots of evaluation footer and cockpit
    activation: complete (shows equal numbers until a limit above 1 exists)
    risk: low
    size_signal: ~150/8
  - id: 03
    name: Repeated free-text responses for students and lecturers
    work_package: element editor field, PWA open-question flow, Playwright scenario
    depends_on: 02
    reviewer: student app and lecturer UI
    attention: judgment-heavy
    reviewer_focus:
      - block navigation never traps a student
      - reload restores the open state and earlier responses
      - limit 1 flow unchanged
    validation:
      - frontend-pwa and frontend-manage check
      - Playwright O1 extension (host runner)
      - screenshot gallery: editor, student flow (n of m), evaluation word cloud
    activation: complete
    risk: medium
    size_signal: ~350/14
follow_up_stacks:
  - Normalize free-text case consistently across live and practice paths
  - Rate limiting in response-api for anonymous and over-cap traffic
```

### Slices

All slices are owned by the main session (solo mode).

1. **Layer 01 — admission.** Files: `packages/types/src/index.ts`, `packages/graphql/src/schema/element.ts`, `schema/elementData.ts`, `lib/validateAndProcessElementOptions.ts` (plus its validator), `services/liveQuizzes.ts` (FREE_TEXT info seeding, standard mode only), new `packages/util/src/liveQuizResponseAdmission.ts` (atomic response commit script with a typed wrapper used by the worker), `packages/util/src/blocks.ts` (read the respondent key, write `respondents`), `apps/response-api/src/index.ts`, `apps/hatchet-worker-response-processor/src/processors/processor.ts`, new `packages/graphql/test/liveQuizResponseAdmission.test.ts`, public SDL snapshot. Acceptance: admission tests pass; builds green.
2. **Layer 02 — counts.** Files: `packages/graphql/src/schema/evaluation.ts`, `services/stacks.ts` (free-text evaluation), `services/liveQuizzes.ts` (cockpit count: the active block reads raw `:results.participants` at 1023-1043 and must read the respondent key; closed blocks use persisted `respondents`), the free-text evaluation op/fragment, `apps/frontend-manage/src/components/evaluation/EvaluationFooter.tsx`, `components/liveQuiz/cockpit/LiveQuizBlock.tsx`, `packages/i18n/messages/{de,en}.ts`. Acceptance: checks green; screenshots.
3. **Layer 03 — authoring and student flow.** Files: `apps/frontend-manage/src/components/elements/manipulation/{options/FreeTextOptions.tsx,types.ts,useElementFormInitialValues.ts,useValidationSchema.ts,helpers.ts}`, `packages/graphql/src/graphql/ops/FElementDataWithoutSolutions.graphql` (shared with practice, microlearning, and group-activity ops), `apps/frontend-pwa/src/pages/session/[id].tsx` (passes `isAssessmentEnabled` down and sends `isFirstResponse`), `components/liveQuiz/{LiveQuizQuestionColumn.tsx,QuestionArea.tsx,storageHelpers.ts}`, `components/hooks/useRemainingInstances.ts`, `packages/shared-components/src/questions/FreeTextQuestion.tsx` (takes the effective limit as an explicit prop and never reads `options.responseLimit`, because practice, microlearning, and group activities share it). The effective limit comes from one small helper in `components/liveQuiz/` (new `responseLimit.ts` with its `responseLimit.test.ts`) and is 1 whenever the quiz is in assessment mode, i18n, `playwright/tests/O1-live-quiz-core.spec.ts` and its fixture data. Acceptance: Playwright scenario and screenshot gallery.

### Test portfolio

| Risk | Obligation | Seam | Existing protection | Failure it catches |
| --- | --- | --- | --- | --- |
| Admission over-accepts, double-counts, or loses on retry | add new | `liveQuizResponseAdmission` against the CI Redis in `packages/graphql/test` | none | cap exceeded, duplicate counted, retry counted twice, wrong first flag, failure before mutation or a lost reply corrupting totals or first-response scoring |
| Assessment quiz shows the open input | add new | `tsx --test` unit test in `apps/frontend-pwa` for the effective-limit helper (assessment mode, missing option, limit above 1) | none; assessment live quizzes have no Playwright coverage | limit leaks into assessment mode |
| Limit 1 behaviour regresses | extend existing | Playwright O1 free-text scenario | O1 free-text + word cloud steps | single-response lock or results change |
| Student trapped or locked early | add new | Playwright O1, limit-3 scenario | none | cannot advance, input disabled before cap, reload loses open state |
| Respondent count wrong or missing | add new | admission tests (counter) plus Playwright evaluation assertion on the count value | none | respondents equals responses when limit > 1 |
| Option not persisted | none | covered by the Playwright authoring step | element option tests | — |

No tests pin labels or copy.

### Verification and runtime

- Unit and type checks run inside the devcontainer (`devrouter ensure .`); Playwright runs on the host with `node util/run-playwright-host.mjs`.
- Browser evidence through `$rs-build-screenshot-gallery` for layers 02 and 03.
- The devrouter runtime for this worktree is stopped at the end unless the user keeps it.

### Review and finish

Solo mode: end-of-package simplification and final review by the main session or
a delegated final reviewer, recorded in `Progress`. `/final-review-stack` on the
top PR after exact-head CI settles (standing-authorized by `AGENTS.md`).

## Roadmap and status

The feature is implemented as draft stack [#6681](https://github.com/uzh-bf/klicker-uzh/pull/6680) against `v3`. The existing draft PRs and their current checks are authoritative for publication and CI state.

| Item | Scope | State |
| --- | --- | --- |
| Layer 01, [#6678](https://github.com/uzh-bf/klicker-uzh/pull/6678) | Element option, atomic response commit, respondent counter and persistence | Implemented; local regression tests and builds pass |
| Layer 02, [#6679](https://github.com/uzh-bf/klicker-uzh/pull/6679) | Respondent count in evaluation and cockpit | Implemented; typechecks and browser count evidence pass |
| Layer 03, [#6680](https://github.com/uzh-bf/klicker-uzh/pull/6680) | Editor, template reuse, repeated response and timer flow | Implemented; local typechecks, unit checks and browser interaction evidence pass; automated O1 coverage runs in CI |
| Final stack AI review | `/final-review-stack` on the top PR | Requires every layer open and ready; marking ready remains withheld |
| Readiness, merge, deployment | Human decisions | Withheld |

Follow-up packages remain outside this approval: consistent free-text case normalization; response-api rate limiting for anonymous and over-cap traffic; and a server-side anonymous cap if a device/session identity is introduced.

## Progress

- Approval: executable batch approved on 2026-10-22. Target `v3` was integrated once at `996794ab05ff4fc6355843739c5f5d9c002e5aec` to satisfy required freshness; subsequent target movement alone does not trigger another integration. All three layers remain drafts; ready, merge and deployment are withheld.
- Implementation: all three planned layers and takeover corrections are committed to their owning branches. Current publication and CI results are tracked on the linked PRs; no duplicate PR or worktree is needed.
- Backend correction: one prevalidated Redis script replaces admission plus pipeline plus undo. Message replay cannot duplicate a committed response; first response alone increments respondents and scoring. Temporary leaderboard IDs and timing-bonus eligibility retain their existing semantics. Blank limited responses return a terminal validation result before admission starts.
- Compatibility correction: existing persisted GraphQL documents remain unchanged. Additive operations expose the live-quiz limit and respondents; the installed generator comparison retained all 321 baseline operation hashes. Missing cache respondent counters retain legacy fallback semantics.
- Frontend correction: template extraction preserves the limit, validation messages can render inline, and the cap is shared through the browser-safe types package. The countdown persists after completing both questions and navigating back; expiry submits an open valid draft and closes all inputs. Send and expiry share one pending submission per instance; late responses cannot clear another question, and blank limited responses never consume a slot. Successful first responses update completion even after navigating away, and a pending reply preserves any newer draft.
- Local verification: 12 real-Redis tests, 4 effective-limit unit tests, 3 synthetic template extraction cases, types/util builds, GraphQL checks, worker check/build and both frontend typechecks passed. PWA ESLint has no errors; existing warnings remain. Focused Opengrep and staged Gitleaks scans passed.
- Browser evidence: original editor, anonymous/identified submissions, duplicate, reload, navigation, scoring and count checks remain applicable. The timed two-question scenario additionally passed natural expiry with one automatic draft submission and disabled input after returning. Desktop/mobile captures are embedded in the top PR with source provenance.
- Test delta: the original admission test file now protects complete commit/replay and failed pre-write validation; its cleanup is isolated to its own synthetic keys. The effective-limit test file remains. O1 retains cap-three coverage and adds whitespace rejection, timed navigation/autosubmit, and a Send-in-flight expiry case and delayed first-response navigation to a third question. Date-only mocking preserves native timers after CI exposed an incomplete full-clock jump. No tests pin prose or fixture contents.
- Review: the original package used solo self-review. The takeover used a configured simplifier and focused backend/frontend slice reviewers plus the configured integrated final-review route. The simplifier's integer-validation reduction was accepted; the backend reviewer confirmed atomicity and identified the terminal blank-input correction. Review artifacts stay in the existing ignored review directory, with later gate results recorded in the handoff and PR evidence.
- Runtime: local browser sessions were closed and the exact task runtime stopped after local verification. The retained synthetic quiz data is available for a later authorized check. Runtime identity and stop evidence belong in the handoff.
- Next action: finish current review/CI dispositions using the existing heads and watchers. Required cancelled duplicate checks may be rerun when the real run is terminal and still leaves a required failure. Once checks and reviews are settled, report the draft stack's readiness; the final stack workflow waits for the user's ready decision.
