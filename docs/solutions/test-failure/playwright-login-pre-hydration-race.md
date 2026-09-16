---
type: Solution
title: Login helpers must wait for client hydration
description: Gate student password logins on a client-only Next.js node so fills cannot land before the page bundle takes over the form.
module: playwright
date: 2026-09-16
problem_type: test_failure
severity: high
symptoms:
  - 'A student login times out on the homepage assertion although the credentials are correct.'
  - 'The failure screenshot shows the empty login form with required-field validation errors on both inputs.'
  - 'The trace contains no GraphQL request for the login mutation.'
root_cause: The login helpers filled the server-rendered login form before the client bundle hydrated, so React never saw the values and the submit then failed client-side validation without sending a request.
tags: [playwright, hydration, nextjs, login, flaky-tests]
---

# Login helpers must wait for client hydration

## Problem

`loginStudentPassword` (`playwright/util/workflow.ts`) and the two student
login fixtures (`playwright/util/fixtures.ts`, `playwright/util/fixtures/auth.ts`)
reached the PWA login page with `waitUntil: 'commit'` and filled the form
immediately. The login form is part of the server-rendered HTML, so it is
already visible, enabled and editable while the client bundle is still loading.
On a cold dev server that window is wide enough for the fills to land before
React takes over the form.

Values typed in that window never reach the component state. React attaches to
a DOM whose inputs already contain text while its state still holds the initial
empty values, and the inputs then fall back to empty. Submitting validates that
empty state, so the required-field check fails and no login request is ever
sent. The test times out waiting for `homepage`.

## Evidence

The failure is [run 35004685541](https://github.com/uzh-bf/klicker-uzh/actions/runs/35004685541),
job `104506460175`, shard 1 of 8, in `P-microlearning.spec.ts` "Verify that
future microlearnings are not shown to students". Both the attempt and retry 1
failed on the same assertion, the `homepage` visibility check at the end of the
login helper.

The retained trace settles the mechanism:

- The password fill finished about 6 ms before the click was attempted, and the
  click was then retried once because the element was reported `not stable`.
  The retried click landed roughly 180 ms later.
- `#__next-route-announcer__`, the node Next.js mounts from a client-only
  effect, first appears in the snapshot taken about 1 ms before that click
  landed. The fills therefore preceded hydration by roughly 0.2 s.
- The page never issues the login request. The network log holds 26 `GET`
  entries and no GraphQL call.
- The final DOM snapshots hold `value=""` for both inputs, and the failure
  screenshot shows the required-field validation errors.

A reduced local probe using this repository's React 19, Playwright and Chromium
reproduces the shape: when the fills precede a delayed hydration, the submit
handler sees empty values and the required-field errors appear with empty
inputs; waiting for a client-created node first submits the real credentials.

## What did not work

Widening timeouts does not address this. The form is already visible and
editable, so no Playwright auto-wait in the fill or click path observes the
missing interactivity; the helper needs a hydration gate, not a longer deadline.

The LTI cookie repair in
`docs/solutions/integration/stale-lti-cookie-login-loop.md` is unrelated: no
request is ever sent, so the cookie path is not involved. Two other CI failures
that were initially grouped with this one are different defects and were not
fixed here: a chat viewport scroll assertion in `Y-chat.spec.ts` and a
disabled-state assertion in `V-template.spec.ts`.

## Solution and prevention

`waitForClientHydration` in `playwright/util/authSession.ts` waits for
`#__next-route-announcer__` before the student password login touches the form.
Next.js mounts that element from a client-only effect and never server-renders
it, so its presence proves the page bundle is running. The pages router renders
it as a `p` and the app router as a `div`, so the helper matches on the id
alone.

Three shared helpers call it before filling: `loginStudentPassword` and its
fixture in `playwright/util/fixtures.ts`, and `useStudentContextFixture`.
Lecturer logins are unaffected because they authenticate with an injected
session cookie instead of this form.

When adding a helper that drives a server-rendered form, wait for a node the
client creates before interacting. Do not reintroduce bare fill-then-submit
sequences against the login page, and do not treat "the element is visible" as
proof that the page is interactive.
