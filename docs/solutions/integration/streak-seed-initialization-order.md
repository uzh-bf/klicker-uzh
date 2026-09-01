---
type: Solution
title: Keep Seeded Study Streaks Initialized Across Startup Ordering
description: Repair active seeded streak participations when the boot migration and development seed run in either order.
module: gamification
date: 2026-08-24
problem_type: integration
severity: medium
symptoms:
  - 'Active seeded students saw no streak progress while practicing.'
  - 'Five eligible responses did not update the home or course streak.'
root_cause: 'The one-time boot migration ran before the development seed recreated active Testkurs participations, leaving their streak tracking timestamps null.'
tags:
  - study-streak
  - prisma
  - development-seed
  - boot-migration
---

# Seeded streak participations must survive boot-migration ordering

## Problem

The student gamification flow correctly derives a private streak from existing
response records, but it intentionally suppresses streak status when
`studyStreakTrackingStartedAt` is null. The local `Testkurs` seed creates active
leaderboard participations, so those students are opted in but appeared to have
no streak at all.

## Symptoms

The practice page had no progress message, and the home and course pages stayed
at zero after five flashcard responses. A separately initialized student worked,
which initially made the response reconciliation path look suspect.

## What Didn't Work

Inspecting only the response rows did not explain the difference between test
accounts. The decisive check counted active Testkurs participations with and
without a tracking timestamp; the missing state was on the participation rows,
not in the response records.

## Solution

`apps/backend-docker/src/migration.ts:initializeActiveStudyStreaks` is reused by
a second one-time repair migration. It covers active participations in enabled,
non-assessment courses that are still within their course end date, and only
fills null timestamps. `packages/prisma-data/src/data/seedTEST.ts:seedTest`
initializes the same field when creating Testkurs participations and repairs
existing active seeded rows with a Prisma `updateMany`.

Both paths use the current time as the tracking boundary. They therefore start a
new run without historical backfill and preserve any existing streak state.

## Why This Works

The active `Participation` row is the existing leaderboard opt-in boundary.
Once its tracking timestamp exists, the existing self-status query exposes the
remaining daily responses, the response path reconciles the fifth response, and
the existing PWA reads show the resulting one-day streak.

## Prevention

The repair migration covers databases where the original boot migration has
already been recorded. The seed update covers the opposite ordering, where the
development seed runs after backend startup. The focused GraphQL streak tests,
the local migration count check, and the browser flow from zero through five
responses now exercise the affected boundary.
