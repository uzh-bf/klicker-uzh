---
module: frontend-manage
date: 2026-10-21
problem_type: runtime_error
severity: medium
symptoms:
  - 'The sample-solution switch ignores the first click after editing an answer.'
  - 'Single Choice editing leaves Save enabled when a sample solution needs a correct answer.'
root_cause: Browser scroll anchoring moves the switch between pointerdown and pointerup when the rich-text toolbar collapses on blur.
tags: [element-editor, scroll-anchoring, rich-text, pointer-events, playwright]
---

# Element editor loses a click when an answer toolbar closes

## Problem

In the question-library editor, clicking the sample-solution switch after
editing an answer could leave the switch off. The existing Single Choice edit
journey reproduced this in Chromium during the design-system v5 migration.

## Symptoms

The switch received `pointerdown` and focus. Blurring the answer editor collapsed
its toolbar, changed the modal's scroll position, and moved the switch. The
subsequent `pointerup` and `click` landed on an ancestor. The switch node stayed
mounted and its `aria-checked` value stayed false; its change handler never ran.

## What Didn't Work

Replacing Playwright's forced click with a normal click did not fix the failure.
The target was actionable before pointerdown; layout changed during the click.
Clicking neutral space first would hide that user-visible failure. A suspected
Formik reset also lacked evidence: no switch change event occurred to reset.

## Solution

The editor opts its modal content out of browser scroll anchoring with
`[overflow-anchor:none]` in
[ElementEditForm.tsx](../../../apps/frontend-manage/src/components/elements/manipulation/ElementEditForm.tsx#L211).
The control remains under the pointer when the toolbar collapses. This is scoped
to the editor's scroll container.

The correction ships in
[the design-system consumer migration](https://github.com/uzh-bf/klicker-uzh/pull/6652).

## Why This Works

Scroll anchoring adjusts the scroll offset to keep an anchor stable after
content changes. Here that adjustment displaced the pending click target.
[`overflow-anchor: none`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-anchor)
disables that adjustment in the affected container.

## Prevention

Keep the existing Single Choice edit journey's uninterrupted answer-edit to
switch-click sequence. It now uses a normal click and verifies `aria-checked`
before checking Save validation and persisting the edited question in
[F-elements-sc.spec.ts](../../../playwright/tests/F-elements-sc.spec.ts#L147).
When an actionable control ignores a click, compare pointer event targets and
scroll offsets before changing form state logic or adding extra clicks.
