# Lecturer toggle for student answer preferences

## Goal

A lecturer can turn off the student answer-style and tone choices for one
chatbot, so every student on that chatbot gets the same answers. The choices
stay on by default. Builds on ADR 0054 ([student preferences PR](https://github.com/uzh-bf/klicker-uzh/pull/6648)).

## Decisions

- One per-chatbot switch covers both answer style and tone:
  `Chatbot.answerPreferencesEnabled Boolean @default(true)`. Existing chatbots
  keep the choices on.
- When the switch is off, the chat route ignores `answerStyle` and
  `answerTone` from the request and compiles with Balanced and Neutral, so the
  prompt and its cache key equal today's default prompt. The server enforces
  this; hiding the controls is only the visible part.
- Students' stored choices stay in their browser and apply again if the
  lecturer turns the switch back on.

## Stack

1. `feat/chat-answer-style` ([student preferences](https://github.com/uzh-bf/klicker-uzh/pull/6648), existing): student answer style and tone.
2. `feat/chat-answer-preferences-toggle` ([lecturer switch](https://github.com/uzh-bf/klicker-uzh/pull/6669)): the lecturer switch end to end.
   - Prisma field plus one generated migration.
   - GraphQL: expose the field on `Chatbot` and add it to the chatbot settings
     mutation used by `ChatbotDetails`; regenerate codegen.
   - Manage: a switch next to model selection with DE/EN copy.
   - Chat: `/api/chatbots/[id]` returns the flag; the store keeps it; the
     sidebar and embedded header hide both selects when off; the chat route
     forces the defaults when off.
   - Tests: route test that a disabled chatbot compiles the default prompt
     whatever the body says; Playwright for hidden selects and the request
     result; manage toggle save.
   - Docs: ADR 0054 decision update, `docs/chat-platform.md`.

## Verification

Container check, lint and unit tests; Playwright chat and manage specs on the
host launcher; browser screenshots of the manage switch and the hidden chat
controls.

## Progress

- Implemented and pushed both layers: [student preferences](https://github.com/uzh-bf/klicker-uzh/pull/6648)
  and the [lecturer switch](https://github.com/uzh-bf/klicker-uzh/pull/6669), with
  one generated migration. Integrated `v3` at
  `996794ab05ff4fc6355843739c5f5d9c002e5aec` to resolve the conflicts after the
  document-review, sharing-notice and seed-prompt changes landed.
- Fixed at `09f3a88016`: changing the lecturer switch clears stale save
  success and errors. The existing authoring test covers the saved-to-unsaved
  transition. The embedded test waits for a successful settings response and
  loaded credits before asserting that the preference controls are absent.
- Independent final source review at `09f3a88016` found no executable-source
  defects. Its sole finding was the ADR's stale no-schema-change statement;
  the correction distinguishes browser preferences from the persisted
  lecturer-owned switch. No simplification was needed for the two small fixes.
- Verification: [student-layer CI](https://github.com/uzh-bf/klicker-uzh/pull/6648/checks)
  passed codebase checks, unit tests, all eight Playwright shards and SonarCloud
  at `41e4d2a0cf`. The executable corrections built successfully at
  `09f3a88016`. Their authoring and embedded regressions must pass in the
  [lecturer-layer CI](https://github.com/uzh-bf/klicker-uzh/pull/6669/checks)
  for the final source state. The existing gallery covers
  the unchanged chat layouts. Fresh manual captures of the manage switch and
  saved-feedback transition are unavailable.
- Outstanding: SonarCloud reports pre-existing cognitive complexity in the
  chat route, settings panel and lecturer details. Maintainer disposition or a
  broader behavior-preserving refactor is still required. Finish the hosted
  checks and Final AI review, leaving the stack unmerged as requested. Any
  later authorized landing should use the top lecturer-switch PR so the native
  stack lands together.

Follow-up, not built: adapting answer depth from quiz results requires its own
data-protection review.
