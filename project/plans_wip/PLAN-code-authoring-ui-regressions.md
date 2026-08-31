# CODE authoring UI regressions

> **Scope note (2026-08-31):** The original activity-support boundary below
> described this focused UI repair. Live Quiz support was added afterward and
> is governed by [PLAN-code-live-quiz-support.md](PLAN-code-live-quiz-support.md).

## Goal

Keep the CODE test Visibility and Weight controls in separate hit areas, and
verify that a CODE element can still be authored as the only `Element` in a
Practice Quiz or Microlearning `ElementStack`.

## Non-goals

- Do not enable additional activity types as part of this UI-only slice. Live
  Quiz support is tracked separately; Group Activities and activity templates
  remain unsupported.
- Do not allow CODE in mixed or multi-element stacks.
- Do not change grading, submission, authorization, gamification, schema, or
  worker behavior.

## Design

- **Domain vocabulary:** the lecturer edits an `Element`; publication creates an
  `ElementInstance`. CODE remains the single element in a Practice Quiz or
  Microlearning `ElementStack`.
- **Layer footprint:** `frontend-manage` CODE authoring layout and the existing
  Manage Playwright spec only.
- **Auth:** unchanged; the existing lecturer-authoring permissions apply.
- **Gamification:** unchanged.
- **Async:** unchanged; no CodeSubmission or Hatchet behavior is involved.
- **UI:** preserve existing English/German strings and `data-cy` hooks. Make the
  select fill its grid track instead of using the design-system default width.
- **Test evidence:** reproduce the overlap from control bounds, add a Playwright
  assertion for the Weight click target, run Manage/Playwright checks, and
  capture routed browser screenshots at desktop and narrow viewports.
- **Seeds/fixtures:** no committed fixture changes; create a disposable local
  CODE element for browser proof and manual handoff.

## Slices

1. Add the focused failing Playwright assertion.
2. Constrain the Visibility field to its grid track.
3. Verify Practice Quiz and Microlearning insertion plus responsive layout.

## Progress

- 2026-08-27: Reproduced a 52 px overlap: Visibility occupied 240 px in a
  176 px track and covered the left side of Weight.
- 2026-08-27: Confirmed a CODE-only stack can be inserted into both supported
  activity wizards; a disposable local Practice Quiz also persisted
  successfully.
- 2026-08-27: Constrained the Visibility field to its responsive grid track and
  added a Playwright regression that checks both geometry and the Weight hit
  target.
- 2026-08-27: Focused Manage and Playwright typechecks, formatting, CODE policy
  tests, Playwright discovery, and `git diff --check` passed. The Playwright
  runtime could not launch because the devcontainer lacks its Chromium binary;
  the root `check:all` also exposed an unrelated Analytics Python 3.14/pandas
  source-build failure because no compiler is installed.
- 2026-08-27: Routed browser verification passed at 1280 px (176 px Visibility,
  112 px Weight, 12 px gap, Weight owns its click target) and 900 px (controls
  stacked at the full 378 px row width). Recreated `Sample Code Question` in the
  isolated local database for manual testing.
