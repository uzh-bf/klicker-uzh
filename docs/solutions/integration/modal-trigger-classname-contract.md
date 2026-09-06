---
module: markdown
date: 2026-09-06
problem_type: integration
severity: medium
symptoms:
  - Image expansion control loses its size and position inside a modal trigger.
root_cause: Radix trigger prop merging expects a string className, while the design-system Button accepts a className object.
tags: [accessibility, radix, modal, design-system, mobile]
---

# Image expansion loses its trigger styling

## Problem

The image expansion control in shared Markdown rendered below the image and
smaller than intended, despite specifying an absolute position and a 44px target.
This affected participant questions and lecturer previews.

## What did not work

Increasing `Button`'s `className.root` did not fix the rendered control. The
installed design-system `Modal` composes its trigger through Radix `asChild`.
That composition merges `className` as a string. The design-system `Button`
instead consumes an object whose `root` property holds those classes.

## Solution

[ImgWithModal](../../../packages/markdown/src/ImgWithModal.tsx) supplies a native
`button` with a string `className` as the modal trigger. The inline image remains
a sibling of that button. This preserves positioning, the touch target and
independent image expansion within selectable answer content.

The component also supplies a localized accessible name and restores focus to
the expansion button when the modal closes. The modal body explicitly receives
focus because this design-system modal suppresses its default initial autofocus.

## Prevention

Check the rendered trigger when composing components with different prop
contracts; JSX classes alone do not prove their effect. The practice browser
checks in [Z-pwa-mobile-polish](../../../playwright/tests/Z-pwa-mobile-polish.spec.ts)
measure the target and exercise keyboard open, Escape close, focus return and
unchanged answer selection. Inspect the corresponding screenshots for position.
