# Escape Room — Per-attempt numbers and mistake feedback (W4)

- **Status:** rulings N1–N5 settled 2026-11-20; executable
- **Roadmap:** W4 of [the classroom escape rooms roadmap](2026-11-07-classroom-escape-rooms-plan.md), cards D and F. It builds on the shared scoring rules (W2, W7), the dashboard insights and debrief (W3a), and the Group Activity session clock (W3b).
- **Approval mode:** executable batch under the roadmap approval of 2026-11-08 (cards A–F), the reorder of 2026-11-14 ("Live Quiz first: W7, W3", with Live Quiz mistake feedback following in W4), and the user's "Plan W4" of 2026-11-20. Rulings N1–N5 of 2026-11-20, all as recommended.
- **Goal:** each player or team gets its own numbers on a numerical Escape Room stage and is graded against its own solution. A wrong answer that matches a typical mistake shows targeted feedback. The debrief counts each mistake per stage.
- **Branch:** `codex/escape-room-numbers` on top of `codex/escape-room-group-session` (#6907). It is added to native stack 5228 as its top layer.
- **Ceremony tier:** full path. The server evaluates formulas that lecturers type, and a new rendering step sits on every participant read path of an escape stage.

## Card D pre-check (2026-11-20)

The lecturer's engine derives each file's numbers from a hash of the team seed and the file id. Each file draws its own values. No file reuses another file's numbers. Element-level variables therefore cover the format, and activity-level variables are not needed.

Observed authoring shape, which the design mirrors:

- Variables are drawn as an integer from a range times a step, as a uniform value in a range, or picked from a list. Values are rounded to a step.
- Derived values are arithmetic formulas over the variables.
- The solution is one formula with an absolute tolerance.
- Each typical mistake has a key, a label, feedback text, a value formula and a tolerance. A mistake whose range overlaps the solution's range is dropped for that seed.
- The debrief counts mistakes by key.

The lecturer's materials stay outside the repository; tests use synthetic fixtures.

## Current state

- The numerical element stores `options` as JSON: unit, accuracy, restrictions, `solutionRanges`, `exactSolutions` (`ElementOptionsNumerical`, `packages/types/src/index.ts`). `processElementData` (`packages/util/src/elements.ts`) copies content, explanation and options into each instance's `elementData` when an activity is created.
- `gradeQuestionNumerical` (`packages/grading`) already grades a bound of exactly 0 correctly and has tests for it. The fix landed in #6714, so the roadmap's zero-bound item needs no work.
- **Practice Quiz and Microlearning:** a stage answer runs through `respondToElementStack`. The stack's prepare and finalize steps write `EscapeRoomAttempt.stageOutcomes` (`stageKey`, `wrongAttempts`, `outcome`). While a stage stays open, the response returns only the stack status.
- **Group Activity:** a wrong answer throws `ESCAPE_ROOM_LOCKOUT`, whose extensions carry `lockoutRemainingSeconds` and `attemptsLeft`. The PWA shows these in its incorrect-answer notice.
- **Live Quiz:** solutions are cached in Redis at block activation (`liveQuizzes.ts`). The Response API grades from that cache and replies with JSON on a wrong answer.
- Participant payloads come from `getPracticeQuizData`, the microlearning equivalent, and `getGroupActivityDetails` with `maskLockedGroupEscapeRoomStages`. The shared `ElementDataWithoutSolutions` fragment carries content and explanation. Eight operations outside escape rooms rely on it.
- Per-question statistics are written for every participant answer, escape stages included. `skipTracking` is set only for the owner preview, and it also skips response records, XP, the leaderboard and the timeline (`stacks.ts`, `respondToQuestion`), so it is not a statistics switch. Group Activity writes instance `results` unconditionally.
- Grading and evaluation read the instance's `elementData` directly, and `respondToElement` receives no attempt. Microlearning's `getPreviousStackEvaluation` and bookmarks return the instance's content, explanation and solution ranges once a stage closes.
- Both stage-outcome parsers (`escapeRoomRules.ts` in grading, `escapeRoomStageOutcomes.ts` in graphql) rebuild each record from a field allowlist, so an unknown field is dropped on the next write.
- `processElementData` (`packages/util`) runs before the instance exists, and the PWA imports the util index, so anything it imports reaches the frontends.
- Live Quiz stage outcomes are written to Postgres by the Response API; its cache prefers `exactSolutions` over ranges.
- `packages/grading` depends only on `remeda`, declares no `exports` map and builds one Rollup entry. `packages/util` imports it, and the frontends import util. `mathjs` 11.9.1 is pinned in `packages/graphql`. The Response API depends on grading but not on graphql.

## Rulings (user, 2026-11-20)

The user chose the recommendation for every ruling: fixed numbers outside per-attempt play with mistake feedback only in escape stages (N1, N2), the full editor section (N3), standing approval of local re-seeds of `klicker_test` during W4 (N4), and the evaluator in `packages/graphql` (N5).

- **N1 — Parametrized elements outside per-attempt play.** Per-attempt numbers apply to escape stages in Practice Quiz, Microlearning and Group Activity. The same element can also sit in a normal activity or a Live Quiz block.
  - **Recommended:** activity creation draws one fixed set of numbers per instance and writes the result into the instance like a normal numerical question. Everyone in that activity sees the same numbers. Grading, statistics, the Live Quiz cache and evaluation work unchanged, and the element stays reusable.
  - **Alternative:** reject parametrized elements outside those three escape modes, with a validation error at activity creation.
- **N2 — Mistake feedback outside escape rooms.**
  - **Recommended:** feedback and mistake counts only in escape stages of all four modes. Non-escape activities keep today's evaluation.
  - **Alternative:** also show feedback in normal Practice Quiz and Microlearning answers. This changes the evaluation views shared by every numerical question.
- **N3 — Authoring.**
  - **Recommended:** a "Variables and mistakes" section in the Manage numerical editor, covering variables, derived values, the solution formula with tolerance, and the mistake list. The server validates on save, and a preview shows three sample draws.
  - **Alternative:** mistakes in the editor now, variables only through the GraphQL input, with the editor part following later. This is smaller, but lecturers cannot author per-attempt numbers themselves.
- **N5 — Where the formula evaluator lives.** Live Quiz numbers are fixed per instance (N1), and the Response API only needs to match an answer against precomputed ranges.
  - **Recommended:** the evaluator, draws and rendering live in `packages/graphql`, which already pins `mathjs` 11.9.1. The pure range matcher goes into the `packages/grading` index for the Response API. No new dependency, no subpath export, and `mathjs` cannot reach the frontends. This departs from the roadmap's design rule, which puts the evaluator in `packages/grading` with `mathjs`.
  - **Alternative:** as in the roadmap: `mathjs` in `packages/grading` behind a new `./parametrization` export and a second Rollup entry. Needed only if a later package (per-player numbers in Live Quiz) must evaluate formulas outside the GraphQL service.
- **N4 — Database re-seeds during W4 verification.** The DB-backed GraphQL suites empty the shared local database (`klicker_test`).
  - **Recommended:** approve re-seeding the local disposable database (`klicker_test`) as often as W4 verification needs it.
  - **Alternative:** keep asking per occasion. Each re-seed then pauses the batch.

## Scope

In:

- **Parametrization on the numerical element (card D).** Variables, derived values, the solution formula with tolerance, and mistakes with key, label, feedback, value formula and tolerance. Mistakes also work without variables, with constant values.
- **Per-attempt rendering.** Each variable draws from a hash of attempt id, element id and variable name. Prompt and explanation placeholders are rendered with the element's number format. The solution and mistake ranges are computed for that attempt.
- **Grading and feedback** in all four modes. Per-attempt numbers cover Practice Quiz, Microlearning and Group Activity; Live Quiz uses the fixed numbers from N1.
- **Debrief:** per-stage mistake counts by label on the dashboard, the projector and the CSV export.
- **Manage editor and preview (N3).**
- **PWA:** mistake feedback in the incorrect-answer notices of the overlay, the group stack and the Live Quiz controls.
- **Docs:** `apps/docs` escape-room tutorials, plus the engineering wiki page on escape rooms.

Out:

- per-player numbers in Live Quiz (roadmap: later)
- activity-level shared variables
- teammates seeing the submitter's feedback (they see the counted mistake on the dashboard only)
- non-escape mistake feedback, unless N2 says otherwise
- anonymous teams (W5)
- practice reopen (W6)

## Decisions

- **Data lives in element options, so there is no migration.** `ElementOptionsNumerical` gains optional `parametrization` (variables, derived values, solution, number format) and `mistakes`.
- **Seed from the attempt, per variable (departs from card D's wording).** Card D says each attempt stores a seed and values derive from the seed and the variable name. Instead of a stored seed column, each variable draws from a hash of `<attemptId>:<elementId>:<variableName>`. This keeps the card's per-name derivation, keeps values stable when variables are reordered, and keeps activity-level variables addable later. A reset deletes the attempt (`escapeRooms.ts`), so the next attempt gets fresh numbers.
- **Instances carry concrete numbers (N1).**
  - `processElementData` stays unchanged in `packages/util`. The GraphQL server callers (activity creation through `getActivityInstanceConnectOrCreate`, element create and version update, templates, account import) pass its result through a renderer that draws one fixed set of numbers from a random seed. No instance id exists at that point, and these numbers only need to be fixed, not reproducible. The drawn values are stored in `elementData`.
  - The renderer writes concrete content, explanation and `solutionRanges` into `elementData` and clears `exactSolutions`, because the Live Quiz cache prefers exact solutions.
  - The raw templates stay under `elementData.options.parametrization` for per-attempt rendering. `parametrization` is added only to the lecturer `Element` type, never to the shared `NumericalElementOptions` type, and a test checks that no participant operation selects it. Production serves persisted operations only.
  - Every existing consumer keeps working unchanged: grading, statistics, evaluation, the Live Quiz cache, duplication and templates. Owner preview grades against these instance numbers.
- **Shared code home (N5, as recommended).** `packages/graphql/src/lib/numericalParametrization.ts` holds the allowlisted evaluator, seeded draws and `renderNumericalElementData`. `matchNumericalMistake` is a pure range matcher in the `packages/grading` index, used by GraphQL and the Response API. Under the N5 alternative, the first module moves to `packages/grading/src/parametrization.ts` behind an `exports` map entry `./parametrization` and a second Rollup input.
- **Evaluator allowlist.**
  - Allowed: constant, symbol, operator, parenthesis and function nodes.
  - Symbols must be declared variables, earlier derived values, `pi` or `e`.
  - Operators: `+ - * / ^`, unary minus and unary plus.
  - Functions: `abs`, `round`, `floor`, `ceil`, `min`, `max`, `sqrt`, `exp`, `log`, `log10`.
  - Everything else is rejected when the element is saved. That includes assignments, accessors, matrices, strings and `import`.
  - Results must be finite numbers. A draw that produces a non-finite value fails validation on save, which checks 20 sample seeds.
- **Seeded draws.** A seeded mulberry32 generator over an FNV-1a hash of `"<attemptId>:<elementId>"` (both are short public-domain algorithms). Variable kinds: integer range with step, uniform range rounded to a step, and pick from a list.
- **Placeholders.**
  - `{{name}}` in content and explanation renders the value with the decimals the variable or derived value declares.
  - Grouping follows the element's number format, apostrophe (`12'345`, default) or comma (`12,345`). Resolvers have no participant locale, and the content is authored in one language anyway.
  - An unknown placeholder fails validation on save.
- **Per-attempt plumbing.** The attempt-rendered `elementData` is passed through `respondToElementStack` → `respondToElement` → `respondToQuestion`, and through `updateAndGradeResponse`, so grading and the closed-stage evaluation use the attempt's own ranges.
- **Masking and leaks.**
  - Stages are rendered per attempt in every participant read path: `getPracticeQuizData`, the microlearning read, `getPreviousStackEvaluation`, bookmarked stacks and `getGroupActivityDetails`.
  - Without an attempt, a parametrized stage shows no numbers, matching the masking that is already in place. Slice 3 confirms each mode's pre-start view.
  - The explanation of an open stage is nulled in the resolver, so the shared fragment stays unchanged.
  - The seed, formulas, derived values and mistake ranges never reach a participant payload.
- **Mistake matching.**
  - On a wrong answer, `matchNumericalMistake` returns the first mistake whose range contains the answer, after dropping mistakes that overlap the solution.
  - The stage outcome entry gains `mistakes: string[]` with the keys in order. Keys are prefixed with the element id, because a Practice Quiz stage is a whole stack that can hold several numerical elements. Both outcome parsers and record types learn the field, so later writes keep it.
  - A wrong bonus answer records no mistake; the bonus stage has one try and no feedback loop.
  - Feedback returns this way in each mode:
    - Practice Quiz and Microlearning: `StackFeedback.mistake { label, feedback }`
    - Group Activity: a `mistake` object in the `ESCAPE_ROOM_LOCKOUT` and `ESCAPE_ROOM_REVEALED` extensions
    - Live Quiz: a `mistake` object in the Response API's wrong-answer and reveal JSON
  - A matched mistake still counts as a wrong answer, so penalties and lockout apply as configured.
- **Statistics.** A parametrized escape stage skips only the instance results and statistics update in every mode, because they would mix different numbers. A new narrow option does this; `skipTracking` stays owner-only. Response records, points, XP, the leaderboard and the timeline are still written. Group Activity gets the same skip for its instance `results` write. Stages without variables keep statistics; mistakes are recorded in addition.
- **Live Quiz.** Block activation caches the instance's mistake ranges next to its solutions. The Response API matches mistakes on the wrong and reveal paths and records the keys in the attempt's stage outcomes (Postgres, `writeOutcome`). The shared debrief reads them like the other modes.
- **Debrief.**
  - `getEscapeRoomStageResults` carries the mistake keys.
  - The per-stage aggregate adds `mistakes: [{ key, label, count }]` plus an unmatched wrong count. Labels come from the instance's `elementData`, so later element edits do not relabel past runs.
  - The dashboard stage table and the projector debrief list the counts. The CSV export gains a per-stage mistakes column.

## Slices

1. **Shared core.** Types in `packages/types`; evaluator, draws and rendering in `packages/graphql` (N5); the matcher in `packages/grading`; `mistakes` in both outcome record types and parsers. Tests:
   - the allowlist rejects each forbidden node kind
   - the same attempt gives the same values, two attempts differ, and reordering variables keeps values
   - non-finite results are rejected
   - an overlapping mistake is dropped
   - matching picks the right key at range edges
   - an outcome record with mistakes survives a parse and write round trip in both parsers
2. **Element input and instance rendering (GraphQL).** Create and edit inputs with save-time validation, concrete numbers at every server caller of `processElementData`, and lecturer-only exposure of the templates. Tests:
   - invalid formulas and unknown placeholders are refused on save
   - a normal activity instance contains concrete numbers, no exact solutions, and templates that no participant operation selects
   - editing an unrelated element field keeps the parametrization
   - duplication and templates keep the parametrization

   The draft PR opens after this slice.
3. **Per-attempt play in Practice Quiz, Microlearning and Group Activity.** Rendering in every participant read path, the per-attempt plumbing into grading and evaluation, mistake matching and feedback, outcome keys, and the narrow statistics skip. Tests:
   - two players or groups see different values and are graded against their own; the closed-stage evaluation shows the attempt's own ranges
   - payloads of open stages contain no explanation, formulas, derived values, mistake ranges or seed
   - the right mistake key is recorded and survives a later hint and skip
   - parametrized stages write no instance statistics but still write response records, points and XP; non-parametrized stages keep statistics
4. **Live Quiz mistake feedback.** The activation cache, Response API matching on the wrong and reveal paths, and the outcome keys. Tests:
   - Response API wrong answers return the matched feedback and record the key
   - the existing claim, close-gate and deduplication tests still pass
5. **Debrief and Manage.** Mistake counts in the progress service, the dashboard, the projector and the CSV. The numerical editor section (N3) with a lecturer query that validates the draft and returns three sample draws as its preview. Check whether template extraction needs the new fields; element options are copied as a whole, so likely not. Test: the progress aggregate counts mistakes per stage from synthetic outcomes in all four modes.
6. **PWA, docs, end to end.**
   - Mistake feedback in the three incorrect-answer notices.
   - Tutorial and wiki updates.
   - Extended Playwright escape specs: two students see different numbers in a Practice Quiz escape room, one matched mistake shows its feedback, and the dashboard counts it. A group stage shows mistake feedback.
   - Screenshot gallery, and the draft PR description.

## Test portfolio

| Risk | Obligation | Seam |
| --- | --- | --- |
| Formula evaluation escapes the allowlist | add new | `packages/grading` unit tests |
| Solutions, formulas or explanations leak before a stage closes | add new | GraphQL participant read tests, three modes |
| Players graded against someone else's numbers | add new | GraphQL service test with two attempts |
| Wrong mistake attributed or statistics mixed | add new | grading matching tests plus GraphQL service tests |
| Live Quiz wrong path diverges | extend existing | Response API escape tests |
| Zero solution bound misgraded | none | already covered by `packages/grading` tests since #6714 |
| Existing numerical questions change | extend existing | current element and grading tests stay green; one instance test without parametrization |
| Classroom flow regresses end to end | extend existing | Playwright escape specs |
| Copy and layout | none | browser screenshots |

## Verification

- **Container:**
  - `check` for grading, types, util, graphql, response-api, frontend-manage and frontend-pwa
  - Biome on changed files
  - `packages/grading` and Response API unit tests
  - escape-room GraphQL suites, run before the browser checks, then a re-seed (N4)
  - no migration
- **Host:** the escape-room Playwright suite through the host launcher.
- **Browser:**
  - the editor section with preview
  - two students with different numbers
  - mistake feedback in the Practice Quiz overlay, the group stack and Live Quiz
  - dashboard and projector mistake counts
  - desktop plus one mobile capture of the PWA
- **Bundle:** confirm that `packages/util` and `packages/grading` import no `mathjs`, and that the frontend builds gained none.
- **Review:** one independent review of the integrated layer, with the evaluator and leak paths as explicit lenses.

## Authority

Granted:

- local commits and pushing `codex/escape-room-numbers`
- a draft PR on top of #6907, added to stack 5228
- the PR description and synthetic screenshots
- adding `mathjs` 11.9.1 to `packages/grading`, only under the N5 alternative (approved in the roadmap)
- re-seeding the local disposable database (`klicker_test`) during W4 verification (N4)

Withheld:

- marking ready, reviewer requests, merge, deployment
- force-pushes of lower layers
- contacting the lecturer, committing the lecturer's materials

## Recovery and terminal condition

- A slice that fails verification is fixed or reverted before the next one starts.
- A needed change in a lower layer is recorded as a gap and stays out of this layer.
- If a frontend build still pulls in `mathjs`, the import that carries it is removed before the slice is committed.
- The batch ends when:
  - the draft PR exists on top of #6907 with screenshots
  - its checks have run
  - the Playwright and GraphQL results are recorded in Progress
  - remaining gaps are listed

## Progress

- 2026-11-20: card D pre-check done; the lecturer's files share no numbers. Drafted after mapping numerical grading, the three escape adapters, participant reads, statistics, the editor and the W3 debrief.
- 2026-11-20: independent critique (planner) returned REVISE with 12 findings; load-bearing claims checked in source. Accepted: narrow statistics skip instead of `skipTracking`; random fixed draw at the GraphQL callers instead of an instance-id seed inside `processElementData`; `mathjs` kept out of `packages/util`; evaluator home raised as ruling N5; `mistakes` added to both outcome parsers; per-attempt plumbing into grading, `getPreviousStackEvaluation` and bookmarks; Live Quiz outcomes are in Postgres and reveal also returns the mistake, exact solutions cleared; per-variable hashing and the card D departure stated; `parametrization` only on the lecturer type with an operation test; element-level number format instead of an unavailable participant locale; element-prefixed mistake keys, instance labels, no bonus mistakes, edit-preserves test. Preview kept as one lecturer query in slice 5 instead of a separate slice 2 query.
- 2026-11-20: rulings N1–N5 settled as recommended.
- 2026-11-20: slices 1–4 committed (evaluator, authoring and instances, per-attempt play in Practice Quiz, Microlearning and Group Activity, Live Quiz mistakes in the Response API).
- 2026-11-20: slice 5 done. The progress service counts mistakes per stage with instance labels; the dashboard stage table and the closed projector list them. The projector hides the counts until the debrief, because labels can hint at answers. The editor gains a third solution type, "Formula", with variables, derived values, the solution formula and the number format; typical mistakes work with every solution type. `previewNumericalElement` validates the draft and returns three draws. Departures: the CSV export has one row per participant and no per-stage columns, so the counts stay on the dashboard and projector. Creating a template from an activity rebuilds form values from participant-facing instance data, which has no templates, so it keeps that instance's fixed numbers. Checked in the browser: create, preview, save, reopen.
