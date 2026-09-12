# Element video embedding button

## Goal

Let lecturers insert a supported YouTube or Kaltura video from the toolbar of
an Element's main content editor, without requiring them to know the underlying
Markdown syntax.

## Non-goals

- Do not add a new `Element` type or persistence field.
- Do not add video controls to answer options, explanations, or activity
  descriptions in this slice.
- Do not upload or proxy video files, change player behavior, or broaden the
  existing provider allowlist.

## Design contract

- **Domain vocabulary:** this edits the source `Element.content` Markdown. An
  `ElementInstance` continues to receive the existing content snapshot when it
  is placed or updated in an activity.
- **Comparable feature:** mirror the image action in
  `apps/frontend-manage/src/components/common/ContentInput.tsx`; insert the
  renderer's shipped `[video](URL)` Markdown convention.
- **Layer footprint:** `packages/markdown` exports its existing URL parser;
  `frontend-manage` adds an opt-in toolbar control and URL form;
  `packages/i18n` adds matching English and German copy; the existing
  Playwright video-embed spec covers the authoring flow. Prisma, GraphQL,
  shared domain types, and codegen are out of scope.
- **Auth:** unchanged. The existing element manipulation mutations retain
  their user authentication and object-level WRITE permission checks.
- **Gamification / async:** no impact on points, XP, leaderboards, Hatchet, or
  publication scheduling.
- **UI surface:** lecturer-side Element creation/editing in `frontend-manage`.
  The toolbar trigger, URL field, and insertion action receive `data-cy` hooks.
- **Test evidence:** focused TypeScript/format checks, the existing Markdown
  package tests, the updated Playwright spec (when the local stack is
  available), and browser screenshots of the empty, invalid, and successful
  insertion states.
- **Seeds/fixtures:** no additions; the existing delegated lecturer fixture and
  video constants are sufficient.

## Slices

1. Export the existing centralized video URL parser.
2. Add the opt-in toolbar control and inline URL entry panel.
3. Enable it for `ElementContentInput` and add bilingual copy.
4. Extend the existing end-to-end video embed test.
5. Verify, review, and record evidence.

## Progress

- 2026-08-23: Mapped the authoring and rendering flows. Confirmed the feature
  is UI-only and selected the existing image-toolbar pattern.
- 2026-08-23: Added the opt-in toolbar control, centralized URL validation and
  normalization, bilingual copy, and Playwright authoring coverage.
- 2026-08-23: Browser harness verification found and resolved nested-button
  markup, repeated-insert replacement, a persistent mobile tooltip, and narrow
  toolbar overflow. Verified invalid input, YouTube + Kaltura insertion,
  desktop/mobile layouts, and English/German labels; evidence is under
  `project/plans_archive/assets/element-video-embedding-button/`.
- 2026-08-23: Independent review added the missing expanded-state relationship
  and automatic URL-field focus for keyboard and screen-reader users. Refreshed
  the invalid-input and combined YouTube/Kaltura screenshots after inspecting
  their rendered pixels.
- 2026-08-23: `pnpm run check:all`, `pnpm run build`, the Markdown package's 34
  tests, focused TypeScript checks, formatting, and Playwright discovery pass.
  The real authenticated Playwright scenario was not executed because the
  existing local routing stack owns the host HTTP/Postgres ports; the shipped
  component flow was exercised in a temporary browser harness instead.
