# Adaptive practice quiz dry runs (simulated students)

Status: plan (2026-10-21). Nothing implemented yet.

## Goal

Let a lecturer test an adaptive practice quiz with simulated students before
real students take it. They can see how accurate the result is, how many
questions it takes and why attempts stop, and try other stop settings without
changing the quiz.

- **Run:** up to 200 simulated students against the quiz's question pool and
  settings.
- **Simulated students:** each has a true level. They answer the "ideal
  pattern" (every question up to their level right, everything above wrong),
  with an adjustable noise probability that an answer flips: right although
  above their level, or wrong although at or below it. Default 2%.
- **Stop settings:** a run can override them; the quiz itself is not changed.
- **Saved runs:** stored per quiz, compared side by side, exported as CSV.

## Non-goals

- **Production.** Available only where `ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true`
  (stg, local), the same gate as the attempt check.
- **IRT v2 (calibrated scales):** authoring is off; dry runs are IRT_V1 only.
- **No changes to quiz structure in a run:** competences, weights and the
  question pool stay as configured. Only stop settings are overridden.
- **Not part of results:** no real attempts, no cohort results, no item
  exposure counters, no calibration data.
- **No IRT response model yet:** "answers right with the model probability"
  can follow later as a second response model on the same endpoint.

## Vocabulary

- **Dry run:** one simulation of N students against one quiz.
- **Simulated student:** has a true level per competence and the noise
  probability.
- **Product names avoid "simulation":** the existing boundary test
  `adaptivePracticeQuizSimulationBoundary` forbids `adaptiveSimulation` /
  `simulateAdaptive` in the public SDL and operations, because Catalyst owns
  its research simulation harness. The product feature is called "dry run"
  (DE: «Testlauf») in the API and the UI, which keeps the boundary meaningful.

## Architecture

**Catalyst (engine) owns the simulation loop.** One request carries the quiz
snapshot plus the dry-run spec. The engine runs every simulated student
in-process with the normal IRT_V1 decision code and returns per-student
outcomes.

- **Why not the host:** looping `decide` from Klicker would mean up to
  200 × 50 = 10,000 HTTP calls per run, a background job and progress
  tracking. In-process the same run takes about a second. A local measurement
  did 60,000 decisions in 2.6 s with a 288-item pool.
- **Bounds:** students ≤ 200, students × question cap ≤ 10,000, the existing
  8 MiB request limit and the 10 s execution deadline per worker.
- **Determinism:** a seed (stored with the run) gives identical results for the
  same snapshot, spec and engine version.

### Engine endpoint `POST /adaptive/v1/dry-run` (IRT_V1)

**Request:** the validation snapshot already used by `/validate` (nodes,
levels, pool with ids, level, a, b, c, settings), plus:

```ts
dryRun: {
  students: number              // 1..200
  seed: string                  // 64 hex chars
  noiseProbability: number      // 0..0.5, flip chance per answer
  trueLevels:
    | { kind: 'FIXED'; levelId: number }
    | { kind: 'EVEN'; fromLevelId: number; toLevelId: number }
  competences: 'SAME_LEVEL' | 'INDEPENDENT'  // one true level, or one per competence
}
```

`settings` are the effective settings, with the run's overrides already
applied by the host. They stay validated by the existing schema.

**Response:** for each student:
- the true level per competence;
- the answers: pool item id, item level, correct, flipped (noise);
- the stop reason and the number of questions;
- the reported estimates per competence and overall: θ, SE, level, classified,
  coverage status.

It contains no content and no identities.

### Host (Klicker)

- **Snapshot source:** the quiz's current adaptive configuration, prepared the
  same way as for publication (`prepareStoredConfiguration`, then the V1
  snapshot builders). This works for drafts and published quizzes alike.
  Published quizzes whose config changed since publishing simulate the current
  config, which is shown in the UI.
- **Overrides (stop settings only):**
  - maximum questions;
  - classification precision (exact / ±1 / ±2);
  - confidence interval (80 / 90 / 95%);
  - minimum questions per subcompetence;
  - maximum questions per subcompetence.

  They are validated with the same rules as the quiz form. The tolerance
  probe guard applies as for publishing.
- **Persistence:** new table `AdaptivePracticeQuizDryRun`:
  - `id`, `practiceQuizId`, `configId`, `createdById`, `createdAt`;
  - `engineRevision`;
  - `spec` (Json: students, seed, noise, true levels, competences mode);
  - `effectiveSettings` (Json);
  - `summary` (Json: the aggregates below);
  - `students` (Json, ≤ 200 rows: per student true levels, outcome, answers).

  Deleting the quiz cascades. Lecturers can delete runs.
- **Aggregates (computed on the host from the response):** overall and per
  competence:
  - exact-sublevel share, within-±1 share, mean signed error in sublevels
    (bias) and mean absolute error;
  - share determined (classified);
  - questions used: mean, median, max;
  - stop reasons;
  - per true level, the distribution of reported levels (the tester's table:
    "true B2 → B2.3: 0, C1.1: 2");
  - share of answers flipped by noise;
  - items never used and the most used items.
- **GraphQL (adaptive-server):**
  - `adaptivePracticeQuizDryRuns(practiceQuizId)` (list);
  - `adaptivePracticeQuizDryRun(practiceQuizId, id)` (detail);
  - `runAdaptivePracticeQuizDryRun(practiceQuizId, input)`;
  - `deleteAdaptivePracticeQuizDryRun(practiceQuizId, id)`.

  All use `withAuth(asUser)` + `withPermission({ practiceQuizId }, ADMIN)`.
  When the testing gate is off they return `null` or `ADAPTIVE_DRY_RUN_DISABLED`.
  The run mutation is synchronous: one engine call, about a second.
- **UI (adaptive-manage-ui, frontend-manage):** a new "Dry runs (testing)"
  section on the adaptive evaluation page, next to the attempt check.
  - **Form:**
    - number of students (1–200, default 100);
    - true levels: one fixed level, or evenly spread over a level range
      (default: the whole scale);
    - same level in every competence / independent per competence;
    - noise in % (0–50, default 2);
    - stop-setting overrides, pre-filled from the quiz;
    - seed, shown and reusable ("run again with the same students").
  - **Result view:**
    - summary cards: exact %, ±1 %, bias, questions per attempt, determined %,
      early stops %;
    - a true-level × reported-level table (heatmap);
    - stop reasons and question use;
    - a per-student table that expands to its answers.
  - **Run list:** compare two runs side by side, delete a run, CSV export
    (one row per simulated student per competence, and an answers CSV like the
    attempt export).
  - **Strings:** de and en. `data-cy` hooks `adaptive-dry-run-*`.

## UI sketch (agreed 2026-10-21)

The "Dry runs" section on the adaptive evaluation page, marked "Testing only",
from top to bottom:

1. **New dry run:**
   - students (1–200);
   - true levels: evenly over a range (from–to) or one fixed level;
   - noise slider (default 2%);
   - competences: same level in all / independent;
   - seed.

   Below that, "Stop settings for this run", prefilled from the quiz: max
   questions, precision, confidence, min per subcompetence. Then the button
   "Start dry run".
2. **Run result:**
   - header: run number, students, noise, precision, date, duration;
   - metric tiles: exact sublevel, within ±1, bias in sublevels, questions per
     attempt, share determined;
   - a true × reported level table grouped by main level (green = correct,
     amber = one level off). A cell opens the sublevels (e.g. B2.3 → C1.1) and
     its students;
   - stop reasons as bars, and question use (used / never used / most used);
   - actions: Students (per-student answers), CSV, Run again (same seed).
3. **Saved runs:** a table of past runs (settings, exact, ±1, bias,
   questions). Tick two runs and use "Compare 2 runs" to see them side by
   side.

## Slices

1. **Catalyst: `/adaptive/v1/dry-run`.**
   - Contract, bounds, the ideal-pattern + noise response model, true-level
     modes, deterministic seeding.
   - Tests: determinism; noise 0 reproduces the ideal pattern (which also
     answers the "B2.3 vs C1.1" question for every level); bounds; invalid
     specs.
   - New engine image tag on stg.
2. **Host: persistence + API.**
   - Migration, the `adaptive-client` contract mirror, request building with
     overrides, aggregates (pure, unit-tested), gate, GraphQL and ops.
   - Publish guard style probe for engines without the endpoint
     (`ADAPTIVE_DRY_RUN_UNSUPPORTED`).
3. **Host: manage UI + CSV.**
   - Form, results, run list, compare, export, i18n.
   - Browser evidence on the local stack (seeded quiz, 100 students, 2% noise,
     before and after a precision override).

Slices 2 and 3 are stacked PRs on `v3-adaptive-learning`; slice 1 is a
Catalyst PR. Deploy order: engine first, then host.

## Tests and evidence

- **Catalyst:** engine unit tests and contract tests.
- **Host:**
  - aggregates and request-building unit tests;
  - an adaptive-server suite with a fake engine client (gate off → null, ADMIN
    only, overrides validated, run stored);
  - manage UI vitest for the summary and CSV.
- **Browser:** local stack with screenshots of the form, the result view and
  the CSV.

## Open questions

- Should a dry run also be available from the wizard, before the quiz is
  saved? This plan starts on the evaluation page; drafts are covered there
  once saved.
- Should flips have separate rates (lucky guess vs slip) instead of one
  symmetric noise value? This plan uses one value; the contract can grow
  `guessProbability` / `slipProbability` later.

## Progress

- 2026-10-21: UI sketch agreed (section above).
- 2026-10-21: design agreed. Engine-side loop; ideal pattern with symmetric
  noise (default 2%); stop-setting overrides only; testing environments only,
  runs saved.
