---
type: Solution
title: Content video embeds collapse without the native aspect-ratio utility
description: Explains why the legacy Tailwind aspect-ratio plugin removed the native video utility and how the responsive embed contract is protected.
timestamp: '2026-08-29'
module: markdown
date: 2026-08-29
problem_type: runtime_error
severity: medium
symptoms:
  - 'Embedded content videos render as very wide, shallow frames on participant devices.'
  - 'The generated application CSS does not contain the aspect-video utility used by the embed wrapper.'
root_cause: 'The legacy Tailwind aspect-ratio plugin suppresses Tailwind v4 native aspect-ratio utilities in the PWA, Manage, and Control builds.'
tags:
  - tailwind
  - video-embed
  - responsive-layout
---

# Content video embeds collapse without the native aspect-ratio utility

## Problem

Markdown video embeds rely on the wrapper's `aspect-video` class to establish
their height before the iframe fills that box
(`packages/markdown/src/VideoEmbed.tsx:10`). The PWA, Manage, and Control builds
loaded the legacy `@tailwindcss/aspect-ratio` plugin alongside Tailwind v4, so
their generated CSS omitted the native utility. The iframe kept its full width
but fell back to a shallow browser-default height on participant devices.

## Symptoms

- Embedded YouTube and Kaltura players appeared much wider than 16:9.
- The wrapper still contained `aspect-video`, but the deployed CSS contained no
  matching rule.
- Markdown rendering tests passed because they checked markup rather than the
  browser's computed layout.

## What Didn't Work

The iframe's `h-full w-full` classes could not recover the intended dimensions.
Without an explicit height on the wrapper, percentage height had no 16:9 box to
fill. Keeping the legacy plugin while relying on Tailwind's native class also
left the generated CSS unchanged.

## Solution

Use Tailwind v4's native utilities in the three applications that consume the
shared Markdown renderer. Their stylesheets now import Tailwind directly and do
not load the legacy aspect-ratio plugin
(`apps/frontend-pwa/src/globals.css:1`,
`apps/frontend-manage/src/globals.css:1`, and
`apps/frontend-control/src/globals.css:1`). Remove the corresponding unused
package dependencies while retaining Auth's separate plugin usage.

Protect the browser contract in
`playwright/tests/0-video-embed.spec.ts:42`: the Manage element editor and the
mobile PWA live-quiz flow measure the rendered iframe boxes and require a 16:9
ratio within rounding tolerance.

## Why This Works

Tailwind v4 emits the native `aspect-video` rule for the shared wrapper. That
rule gives the wrapper a stable 16:9 height at every responsive width, and the
iframe's existing full-size classes fill the resulting box.

## Prevention

Keep legacy aspect-ratio plugins out of applications that rely on Tailwind v4
native aspect utilities. Preserve the rendered bounding-box assertion when
changing Markdown embeds, Tailwind plugins, or application CSS entry points.
