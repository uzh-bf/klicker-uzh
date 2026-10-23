---
type: Solution
title: A newer live-quiz draft disappears during an earlier response
description: Distinguish identical pending responses from newer drafts before serializing expiry submissions.
module: live-quiz-pwa
date: 2026-10-23
problem_type: logic
severity: medium
symptoms:
  - 'A newer valid draft is absent after the block expires.'
root_cause: A pending promise keyed only by element instance also coalesced distinct drafts.
tags: [live-quiz, free-text, concurrency, response-limit]
---

# A newer live-quiz draft disappears during an earlier response

## Problem

Repeated free-text questions stay editable while a response is pending. A
participant can send draft A, type B, and reach the block deadline before A
finishes. Expiry must preserve the valid draft within the response limit.

## Symptoms

The first response succeeds, but expiry closes the input without sending B.
Checks for preserving typed text and sharing Send with expiry can each pass
while their combined flow still loses the newer draft.

## What Didn't Work

Sharing every pending promise for the same element instance prevented a
duplicate A. It also treated B as the same response. Preserving B when A's
reply clears the form did not change that expiry behavior.

## Solution

The pending record carries its input and promise. Identical drafts share the
promise. A distinct repeated free-text draft waits for it and then re-enters
the response path. See
[QuestionArea.tsx](../../../apps/frontend-pwa/src/components/liveQuiz/QuestionArea.tsx#L360)
and [the implementation PR](https://github.com/uzh-bf/klicker-uzh/pull/6680).

## Why This Works

The stored promise includes
[pending-state cleanup](../../../apps/frontend-pwa/src/components/liveQuiz/QuestionArea.tsx#L385),
so a waiting caller continues after the earlier entry is removed. The next
response reloads persisted history and checks duplication, the response limit,
and first-response status. Single-response and assessment flows keep their
existing promise sharing.

## Prevention

The native-deadline cases in
[O1-live-quiz-core.spec.ts](../../../playwright/tests/O1-live-quiz-core.spec.ts)
cover automatic submission, an identical pending response, and a newer draft
typed during a pending response. The last case holds A through expiry, then
verifies B is sent once, the response list reaches its cap, and the input closes.
