---
type: Solution
title: A scroll-smooth ancestor makes streamed auto-scroll fall behind
description: CSS scroll-behavior turns the thread viewport's programmatic "auto" scroll into an animation that every streamed chunk restarts, so the viewport never reaches the bottom.
module: chat
date: 2026-09-16
problem_type: test_failure
severity: medium
symptoms:
  - 'The bottom-gap assertion in the streamed-answer citation test receives a large value instead of <= 1.'
  - 'The retained scroll diagnostics show scrollTop frozen while scrollHeight keeps growing.'
  - 'The bottom gap grows over the run instead of shrinking, and never reaches the tolerance.'
root_cause: The viewport carried CSS scroll-smooth while @assistant-ui re-issued scrollTo({behavior: "auto"}) on every content growth; CSS scroll-behavior resolves that "auto" to an animated scroll, and each streamed chunk restarted the animation from the current position.
tags: [playwright, chat, scroll, streaming, flaky-tests, assistant-ui]
---

# A scroll-smooth ancestor makes streamed auto-scroll fall behind

## Problem

The chat thread viewport tracked an answer while it streamed. Its class list
included `scroll-smooth`:

```text
flex min-h-0 flex-1 ... items-center scroll-smooth bg-inherit ...
```

`ThreadPrimitive.Viewport` from `@assistant-ui/react` owns the follow
behavior. On `thread.runStart` it calls `scheduleScrollToBottom("auto")`, and
its content `ResizeObserver` re-issues `scrollTo({ top: scrollHeight, behavior:
<stored> })` on every growth. The stored behavior is still `"auto"` for the
whole run.

Per the CSSOM View spec, a `scrollTo` with `behavior: "auto"` resolves to the
computed value of `scroll-behavior` on the scrolling box. With
`scroll-smooth` set, `"auto"` therefore means an **animated** scroll. Each
streamed chunk changed `scrollHeight` and restarted the animation from the
current position, so the viewport fell progressively further behind instead of
following the answer.

## Evidence

The failing test is `Y-chat.spec.ts` "Chatbot Source Citations › Citations and
source cards render on a live streamed answer" (run
[35006375990](https://github.com/uzh-bf/klicker-uzh/actions/runs/35006375990),
shard 4 of 8). It asserts a bottom gap of at most 1px and received 532 (533 on
retry).

The test attaches its own `stream-scroll-diagnostics` sample array, which
isolates the mechanism without re-running anything:

- `scrollTop` freezes at `329` for the last 9.7s of the run while
  `scrollHeight` grows from `908` to `1436`.
- The bottom gap runs `33 → 72 → 108 → 196 → 532`; it frequently increases,
  which is impossible while an auto-scroll is keeping up.
- Zero of the 26 samples are within the 1px tolerance.
- The scroll deltas are 1–3px at a ~16.6ms cadence: the signature of an
  animation, not of a user scroll.

A reduced Chromium probe that mirrors the library's exact auto-scroll path
(`runStart` schedules `"auto"`, the resize observer re-issues the stored
behavior, and `handleScroll` maintains `isAtBottom`) separates the two
variables:

| viewport CSS              | max bottom gap during growth | settled gap |
| ------------------------- | ---------------------------- | ----------- |
| `scroll-behavior: smooth` | 3823px                       | 345px       |
| `scroll-behavior: auto`   | 84px                         | **0px**     |

The same probe shows `behavior: "instant"` is immune even with
`scroll-smooth` set, because `"instant"` bypasses `scroll-behavior`.

## What did not work

Widening the assertion timeout does not help. The failure is not slowness: the
animation is restarted by every chunk, so the gap can grow without bound for as
long as the answer streams.

Treating this as a test-only artifact is also wrong. A reader watching a long
streamed answer was genuinely being left behind at the same rate; the assertion
merely detected it.

## Solution and prevention

The thread viewport does not set `scroll-smooth`. Explicit smooth scrolling is
still requested per call where it is wanted (citation chips use
`scrollIntoView({ behavior: 'smooth' })`), and the history rail still forces an
instant reposition because its scroll spy depends on a settled position within
a short navigation lock.

When a library drives a scroll programmatically with `behavior: "auto"`, do
not set `scroll-behavior` on that scroller. `"auto"` means "follow the CSS
default", not "instant", so `scroll-smooth` silently upgrades every
programmatic scroll in the subtree to an animation. Request smooth motion per
call instead, or use `"instant"` where the position must settle immediately.
