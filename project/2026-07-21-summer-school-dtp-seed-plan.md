# Summer School 2026 DTP Seed Plan

## Goal

Seed the Summer School 2026 DTP-game points plus the `Creative Mastermind`,
`Shooting Star`, `Happiness`, and `Busy Bee` achievements from the updated
participant workbook, with the same safety contract as the portfolio round.

## Non-goals

- Do not replay Swiss Quiz, Escape Room, business-simulation, or PFM/portfolio points.
- Do not re-award achievements 18/19/20/21 from the earlier rounds.
- Do not seed points that Klicker already awards in-platform (Swiss Quiz, microlearnings).
- Do not execute production writes without a fresh explicit approval.
- Do not commit names, emails, usernames, or other participant data.

## Identity

- Plan: `project/2026-07-21-summer-school-dtp-seed-plan.md`
- Branch: `claude/summer-school-seeding-updates-978c2d`
- Target: `v3`
- PR: not created

## Evidence and decisions

- Source workbook: ignored local copy `project/_local/20260721_SS_Participants.xlsx`, 36 rows.
- Prior rounds, both replay-locked by their own `*_dump_after.json`:
  - `seedSummerSchool2026.ts` — Swiss Whiz (18), Escape Artist (19), ChocoStrategist (20).
  - `seedSummerSchoolPortfolio2026.ts` — 25,700 points + Portfolio Professional (21) ×3.
    Verified: workbook column J sums to exactly 25,700, so J/K are done.
- This round covers workbook columns L/M/N/O/P, none of which were seeded before.
- Column mapping and payload totals:

  | Column | Header | Maps to | Count / total |
  | --- | --- | --- | --- |
  | L | `DTP (ink. Präsi)` | `points_delta` (score + XP) | 26,200 across 36 |
  | M | `Award DTP` | Creative Mastermind (11) | 7 |
  | N | `Award Hapiness (Insta Takeover)` | Shooting Star (16) | 6 |
  | O | `Award Busy Bee (beide Microlearnings gemacht)` | Busy Bee (3) | empty, derived from DB |
  | P | `Award Happiness (present throughout …)` | Happiness (14) | 21 |

- Decision: column N's header is stale. Its cell literal is `Badge Shooting Start`
  for every populated row, and column P separately carries `Award Happiness`.
  Confirmed by the user: N is Shooting Star, P is Happiness.
- Decision: `(including points)` for Creative Mastermind means the DTP column L
  points go to all 36 participants alongside the 7 badges, mirroring the J/K
  portfolio round. Confirmed by the user.
- Decision: Busy Bee is derived from the database, not the workbook, because
  column O is empty and the award depends on in-platform behaviour. Rule:
  `ParticipantActivityPerformance.completion === 1` for every non-deleted
  `MicroLearning` of the course. Encoded in a committed preparation script so the
  rule is reviewable; its output is frozen into the ignored input file so the
  seed keeps its payload-hash replay safety.
- Decision: add a third round-specific script rather than generalizing the two
  audited scripts, so each round keeps its own replay lock and dump filenames.
- Workbook columns C (Swiss Quiz) and G (Microlearning) are in-platform point
  sources and are never part of a seed payload. Their new values differ from the
  July payload; that is expected and must not trigger a replay.
- ADR: none; one-off operational seed, same trade-offs as the portfolio round.

## Skill routing

- `df-safe-database-scripting`: dry-run, comparison, double-dump, replay safeguards.
- `klicker-data-model`: seed-data conventions.
- `klicker-wiki-maintenance`: document the new commands and the derivation rule.
- `verification-before-completion`: fresh evidence before completion claims.

## Slices

### Slice 1: Build and validate the ignored input

- Copy the workbook to the ignored local path; parse columns B/L/M/N/O/P with
  exact header and cell-literal assertions; fail on any unexpected value.
- Check: 36 unique usernames, 26,200 points, 7 / 6 / 21 awards, column O empty.
- Commit: none; inputs stay ignored and local.

### Slice 2: Add the DTP seed and the Busy Bee derivation

- Add `prepareSummerSchoolDTPInput2026.ts` (read-only, derives `busy_bee`).
- Add `seedSummerSchoolDTP2026.ts`, generalized from the portfolio script to a
  four-achievement `AWARDS` table; keep dry-run default, payload-bound before
  dump, replay lock, atomic transaction, and post-write verification.
- Add the three package commands; update the data/migration wiki.
- Check: Prettier, targeted typecheck.
- Commit: `chore(prisma-data): add Summer School DTP seed`

### Slice 3: Production dry-run

- Run the input preparation, then the seed command with the default dry-run.
- Check: 36 matches, 26,200 points, expected award counts, before dump written,
  zero database writes.
- Stop before `DRY_RUN=false` and report the Busy Bee count for approval.

## Progress

- Done: repository and workbook discovery; prior-round reconciliation (column J
  sum matches the 25,700 portfolio payload exactly); ignored workbook copy and
  base input generation (36 rows, 26,200 points, 7 / 6 / 21 awards); seed script,
  preparation script, package commands, wiki update; Prettier and targeted
  typecheck clean (the 106 remaining package typecheck errors are pre-existing
  and in untouched files).
- Secret access resolved. The plain `infisical` CLI is pinned to
  `inf.stg.df-app.ch` and 404s on this project in every environment; the project
  actually lives on `https://inf.prd.df-app.ch`, and `--domain` does not override
  a stored profile domain. Working path, approved by the user: a new
  `rs-infisical-operator` profile `klicker-prd` (project `klicker-uzh-dev`,
  environment `prd`, readable `DATABASE_URL`, writable none, reusing the
  `klicker-dev` machine identity). Injection verified.
- Blocked: Slice 3. Production `DATABASE_URL` targets `127.0.0.1:7432`, so a
  tunnel to the production database must be open; without it Prisma fails
  `P1001 DatabaseNotReachable`. No tunnel command is documented in this
  repository.
- Next: with the tunnel open, run

  ```bash
  rs-infisical-operator --profile klicker-prd run --map DATABASE_URL=DATABASE_URL \
    -- npx tsx src/data/prepareSummerSchoolDTPInput2026.ts
  ```

  from `packages/prisma-data`, review the reported microlearning list and Busy Bee
  count, then repeat with `src/data/seedSummerSchoolDTP2026.ts` for the dry run.
