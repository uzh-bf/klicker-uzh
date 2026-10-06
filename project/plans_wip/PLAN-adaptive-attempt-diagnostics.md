# Adaptive attempt diagnostics (testing environments)

## Goal

Let a lecturer debug how each adaptive practice quiz attempt was evaluated:

- an **attempts table** in the adaptive evaluation: pseudonymous codes,
  completion time, answer count, overall and per-competence result, and a
  **quality rating** (good / check / unreliable) with its reasons
- an **attempt detail** view: every answer with the item, its level and
  difficulty, correctness, the competence estimate before and after the
  answer, and why the question was asked
- **CSV export** of all attempts (summary + answers) and of one attempt
  (including the replay)

## Non-goals

- **Production.** Students are told that instructors see only anonymous group
  results. The whole feature is available only where
  `ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true` (stg, local), the same gate as the
  student testing box. Production keeps the promise unchanged.
- No usernames, emails, matriculation numbers or participant UUIDs in the UI
  or the CSV.
- No Catalyst change and no exact engine decision trace (phase, leaf,
  routing θ). Those are derived on the host; an exact trace can follow later.
- No Prisma change, no new snapshot table, no Hatchet task.
- IRT v2 (Bayesian) attempts: summary rows only (rating "not available"). v2
  authoring is disabled.

## Design answers

- **Domain vocabulary:**
  - `PracticeQuiz` (mode ADAPTIVE) and its published adaptive runtime
    (`loadAdaptiveRuntime`);
  - `AdaptivePracticeQuizAttempt` with its `AdaptivePracticeQuizResponse` rows
    (pool item, correct, score, `overallThetaAfter`) and final
    `AdaptivePracticeQuizEstimate` rows per node;
  - `PracticeQuizAdaptivePoolItem` (difficulty, discrimination, guessing,
    level, node path);
  - a `Participant` is referenced only through a pseudonymous code.
- **Layer footprint:**
  - `packages/adaptive-server`: a new diagnostics service, schema types and
    query fields, ops;
  - `packages/graphql`: codegen output and the tracked SDL snapshot;
  - `packages/adaptive-manage-ui`: an attempts tab in the evaluation, the
    detail view and the CSV builder;
  - `packages/adaptive-i18n` (de + en).

  No Prisma change.
- **Auth:**
  - both queries use `t.withAuth(asUser)` +
    `withPermission({ practiceQuizId }, PermissionLevel.ADMIN)`, exactly like
    `adaptivePracticeQuizCohortResults`;
  - the detail query resolves the attempt and checks that it belongs to that
    `practiceQuizId`;
  - when the testing gate is off, both fields return `null` and the tab is not
    rendered.
- **Pseudonymous codes:**
  - attempt code = first 8 hex characters of `sha256("attempt:" + attemptId)`;
  - participant code = the same over `participationId`, so retakes group
    together;
  - they are stable, not reversible in practice, and carry no identity fields.
- **Gamification:** none. **Async:** none. The replay runs on demand in the
  request, one attempt at a time.
- **UI surface:** `frontend-manage` adaptive evaluation page, new
  "Attempts (testing)" section. New strings in de and en, new
  `data-cy` hooks `adaptive-attempts-*`.
- **Test evidence:**
  - unit tests for the rating, the pseudonymous codes and the CSV
    serialization;
  - an adaptive-server suite with the runtime fixture for the read model and
    the gate (gate off → null);
  - manage UI vitest;
  - browser screenshots of the table, the detail view and a downloaded CSV on
    the local stack.
- **Seeds/fixtures:** existing runtime fixtures. No new seed data.

## Data per attempt

**Summary row (stored data only, no engine call):**
- attempt code, participant code, attempt number, completed time, stop reason,
  answers;
- overall: level, certainty, range, determined;
- per competence: level, range, determined, answers, weight share;
- rating with its reasons.

**Answer rows (stored data; the replay columns come from the detail
query):**
- order, competence › subcompetence, element title, item level, difficulty,
  discrimination, guessing, correct, score;
- distance from the item level to the final competence estimate, in levels;
- overall θ after the answer (stored);
- **replay** (detail only):
  - competence estimate, range and level after the answer, from the engine
    `decide` on the answer prefix;
  - phase (coverage or precision);
  - distance from the item to the competence estimate before the answer;
  - `replayMatches`: whether the replayed next item equals the item actually
    served.

**Final nodes:** estimate, range, certainty, determined, answers, coverage
status, weight share. The same shape as the student result.

## Replay (host-side, exact estimates)

- The engine is stateless. For answer k, the host calls `decide` with the
  attempt's first k−1 answers. The response gives the engine's own estimates
  before answer k and the item it would serve next. The first call is with
  no answers.
- If that item equals the served item k, the attempt replays exactly under the
  current engine. If not, the engine version changed since the attempt; the
  row is marked "replay differs" and the estimates are still shown.
- **Phase** is derived from answer counts with the published
  `minQuestionsPerLeaf`: coverage while the item's subcompetence has fewer than
  the minimum, otherwise precision. It is labelled "derived".
- **Cost:** at most `answers + 1` decide calls per attempt. They run
  sequentially with the existing busy retry, only for the detail view and the
  single-attempt CSV, never for "export all".

## Quality rating (summary, stored data only)

The thresholds below are initial values, kept as constants and shown in
the UI help.

| Signal | Check | Unreliable |
|---|---|---|
| Precision | overall not determined and width certainty MEDIUM | width certainty LOW |
| Person fit: standardized log-likelihood `lz` of all answers at the final competence θ (3PL with the pool item parameters, discrimination default 1.2) | `lz < −1.64` in any competence | `lz < −2.33` in any competence |
| Targeting: share of answers more than 3 levels from the final competence estimate | > 30 % | > 50 % |
| Edges: a competence estimate at the θ clamp, or in levels without published items | any | — |
| Coverage: a competence with < 4 answers | any | — |

The rating is the worst signal: no signal → good. Each triggered signal adds
a short reason, e.g. "Answers in FUNCIONES are inconsistent (lz −2.6)".

## Slices (stacked PRs on `v3-adaptive-learning`)

1. **Server read model + rating.**
   - Diagnostics service: summary rows, answer rows without the replay, final
     nodes, pseudonymous codes, the rating (pure, unit-tested), the gate.
   - GraphQL `adaptivePracticeQuizAttemptDiagnostics(practiceQuizId)` (list)
     and `adaptivePracticeQuizAttemptDiagnostic(practiceQuizId, attemptCode)`
     (detail without the replay).
   - Ops, codegen, tests.
2. **Replay.** Prefix `decide` calls, phase derivation, `replayMatches`, and
   the replay fields on the detail query. Tests with a fake engine client,
   mirroring the existing engine transport tests.
3. **Manage UI + CSV.**
   - An attempts table with rating badges, a reason tooltip and filters
     (rating, competence).
   - A detail view: final nodes, then the answers table with the replay
     columns.
   - CSV: "Export all attempts" (summary + answers, two files or one combined
     file with a `row_type` column) and "Export this attempt".
     UTF-8 with BOM, `;`-safe quoting.
   - i18n de/en, data-cy hooks, browser evidence.

## Progress

- 2026-10-06: design agreed with the user. Testing environments only;
  pseudonymous codes; host-side replay; lecturer evaluation.
