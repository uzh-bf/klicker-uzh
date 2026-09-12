---
module: frontend-manage
date: 2026-08-13
problem_type: test_failure
severity: medium
symptoms:
  - 'Playwright times out clicking next-or-submit or back-activity-creation because the element-library toolbar intercepts the pointer event.'
  - 'Later assertions report missing activity rows or duplicate controls after the wizard navigation did not complete.'
root_cause: >-
  The Manage page rendered the element library with h-full below a fixed-height
  activity wizard in the same flex column, so the two regions overlapped.
tags: [playwright, frontend-manage, flex-layout, activity-wizard, ci]
---

# Activity wizard overlaps the element library

## Problem

The activity-creation wizard and the element library share the Manage
question-pool page. In [PR #5381](https://github.com/uzh-bf/klicker-uzh/pull/5381),
the Playwright suite exposed a layout collision across several shards: wizard
navigation controls were visually present but the element-library toolbar was
on top of their hit area.

## Symptoms

The failing traces reported pointer-event interception by
`button[data-cy="create-question"]` or the element-library panel when tests
clicked `next-or-submit` or `back-activity-creation`. Downstream failures were
consequences of the wizard remaining on the wrong step.

## What Didn't Work

Increasing click timeouts, adding waits, or weakening the Playwright locators
would only hide the collision. The existing tests already provide coverage for
the affected journeys, so no duplicate regression test was added.

## Solution

The shared wizard wrapper in
`apps/frontend-manage/src/components/activities/ActivityCreation.tsx:219` is
content-sized at desktop (`md:h-auto`), keeps its intentional minimum height,
and is `shrink-0` so its navigation cannot be compressed by the parent flex
column.

The question-pool content region in `apps/frontend-manage/src/pages/index.tsx:307`
and its inner list region at `apps/frontend-manage/src/pages/index.tsx:389` use
`min-h-0 flex-1`. This lets the list consume only the space remaining below the
wizard and scroll within that region instead of occupying the wizard's space.

## Why This Works

`Layout` places the page children in a flex column with a definite desktop
height. A child with `h-full` requests that whole height even when the wizard
has already consumed space above it. `min-h-0 flex-1` makes the library a
shrinkable remainder, while the content-sized, non-shrinking wizard preserves
the actual height of each activity type, including settings steps that are
taller than the old fixed wrapper.

## Prevention

- Treat pointer-event interception in a wizard as a layout defect before adding
  waits or locator workarounds.
- When a page stacks a variable-height header or wizard above a scrollable
  region, use a non-shrinking content-sized header and `min-h-0 flex-1` for the
  remainder.
- Re-run the full Playwright matrix after the fix. Local browser execution
  remained unavailable in this run because the isolated devcontainer could not
  complete its seed step due to a database credential mismatch; the local route
  returned `502 Bad Gateway`.
