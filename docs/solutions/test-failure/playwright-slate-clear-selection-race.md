---
type: Solution
title: Rich-text clearing can outrun Slate selection
description: Verify a bounded keyboard clear before filling another value in Slate editors.
module: playwright
date: 2026-09-08
problem_type: test_failure
severity: medium
symptoms:
  - Clearing a rich-text answer leaves Save enabled.
  - Replacing answer feedback leaves part of the previous text.
root_cause: A delete can reach Slate before its deferred selection matches the browser selection.
tags: [playwright, slate, flaky-tests]
---

# Rich-text clearing can outrun Slate selection

## Problem

Single-choice and multiple-choice creation intermittently fail after clearing
an answer. The answer remains present, so the assertion that Save becomes
disabled fails. Dependent persistence checks can then fail because creation
never completed. This has occurred on both hosted and public ARM64 CI.

## Evidence

The first failure in [the ARM64 run](https://github.com/uzh-bf/klicker-uzh/actions/runs/34257127977)
is in shard four's single-choice creation test. A local multi-editor probe
captures a fully selected browser range while Slate still has a collapsed
selection at the end of the answer when Delete arrives. Slate updates its
selection afterward. The delete has already done nothing.

Throttling only that interaction reproduces the old single-choice and
multiple-choice paths on their first iteration. The corrected helper completes
ten clears of each under the same conditions. This isolates a browser/editor
selection race; it does not implicate Next.js route discovery or runner ports.

## What did not work

Switching to `Locator.clear()` alone is insufficient. Playwright's
[clear contract](https://playwright.dev/docs/api/class-locator#locator-clear)
supports contenteditable elements, but completion is not a guarantee that this
editor has consumed the intended selection. A one-shot select-all and
Backspace also lacks an editor-empty postcondition. Retrying the whole test
can hide the symptom without fixing the interaction.

## Solution and prevention

Use `clearEditorField` from `playwright/util/fixtures/elements.ts` for Slate
fields, including the clear-before-fill path for answers and feedback. It
retries only select-all and Backspace, for up to five seconds, until the
attached field has neither `data-slate-string` nor `data-slate-void` nodes.
Checking the attached field prevents a missing editor from passing as empty.
Images currently use markdown text, which the text-node check covers. The
void-node check also rejects any non-text Slate embeds if an editor gains them.

The operation is idempotent, so a delayed selection update can settle before
the next attempt without adding fixed sleeps or replaying a save. Persistent
failure still throws. Keep the caller's save-state and persisted-content
assertions: an empty editor alone does not prove form validation or persistence.
Ordinary text inputs keep their existing `fill`, `clear` and value assertions.
