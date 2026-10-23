# Lecturer toggle for student answer preferences

## Goal

A lecturer can turn off the student answer-style and tone choices for one
chatbot, so every student on that chatbot gets the same answers. The choices
stay on by default. Builds on ADR 0054 (uzh-bf/klicker-uzh#6648).

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

1. `feat/chat-answer-style` (#6648, existing): student answer style and tone.
2. `feat/chat-answer-preferences-toggle` (new): the lecturer switch end to end.
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

- Done: both stack layers are implemented and pushed. #6648 holds the student
  answer format and tone; #6669 holds the lecturer switch with one generated
  migration. The live answer-style evaluation passed within its approved cap.
- Done (2026-10-22): #6648 is up to date with `v3`, CI passed and the final
  AI review found no actionable findings. #6669 merged the updated #6648.
- Open: on #6669, SonarCloud fails its maintainability gate on cognitive
  complexity in the chat route handler, `settings-panel.tsx` and
  `ChatbotDetails.tsx`. The maintainer decides whether to refactor or accept
  it; the final AI review for #6669 waits for that decision.
- Open: `T-chatbot-authoring.spec.ts` runs only in CI, because the `ai-beta`
  flag is enabled only in CI's test-mode backend.
- Next: merge #6648 first, then #6669, both with maintainer approval.
- Follow-up, not built: adjusting answer depth from quiz results needs a data
  protection review first.
