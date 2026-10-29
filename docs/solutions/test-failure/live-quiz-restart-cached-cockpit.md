---
module: live-quiz-evaluation
date: 2026-10-07
problem_type: test_failure
severity: medium
symptoms:
  - 'Restart verification opens an evaluation without reveal controls.'
root_cause: A cached active cockpit block remains visible before the restarted scheduled-block query completes.
tags: [live-quiz, evaluation, apollo, playwright]
---

# Restart verification can click a cached block control

## Problem

The restart regression in [the evaluation PR](https://github.com/uzh-bf/klicker-uzh/pull/4920)
aborted a quiz, started it again and clicked the cockpit's next-block control.
The resulting evaluation had no reveal switches. The trace showed a successful
`StartLiveQuiz` followed by `DeactivateLiveQuizBlock`, rather than activation.

## What did not work

Cockpit visibility and a 500 ms delay did not establish fresh block state.
Apollo could render the previous active block while the restarted cockpit query
was still pending. The same control therefore performed the opposite transition.

## Solution

The [existing restart regression](../../../playwright/tests/O1-live-quiz-core.spec.ts)
observes completed `StartLiveQuiz` and `GetCockpitQuiz` responses, checks the
original block is scheduled and waits for the play control. It then verifies
`ActivateLiveQuizBlock` returned that block as active. The evaluation must carry
a changed activation timestamp and the same question before checking default-off
solution and explanation content.

## Why this works

These assertions establish the server transition and the UI action separately.
The producing Chromium run passes all 40 serial live-quiz scenarios. No application
change was needed for this reproduced failure.

## Prevention

For a lifecycle control whose action depends on cached state, verify the fresh
state and expected mutation. Do not replace transition evidence with a longer
delay. Reveal persistence is separately checked through rendered content after
polling, question navigation and reload within the same activation.
