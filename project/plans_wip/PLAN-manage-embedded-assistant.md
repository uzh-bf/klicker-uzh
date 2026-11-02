# Manage embedded assistant

## Goal

Add the same bottom-right embedded chat pattern to `apps/frontend-manage`, but back it with a lecturer assistant instead of a course chatbot. The assistant should understand the current Manage page and use a Klicker MCP toolset to draft or create teaching objects such as questions, answer choices, feedback, and practice quizzes.

## Key difference from student course chat

- Student PWA chat is scoped to an existing `Chatbot` attached to a course and participant context.
- Manage chat is scoped to the authenticated lecturer and the current Manage surface. It should not require `Chatbot.courseId`, because `Chatbot` is currently course-bound in Prisma.
- Manage write tools must be preview-first. The assistant can draft a mutation, but the lecturer confirms before anything is persisted or published.

## Recommended first slice

1. Reuse the widget shell pattern from the PWA integration:
   - bottom-right assistant avatar bubble
   - desktop popover panel around 430-460px wide
   - mobile bottom sheet
   - iframe to the chat app in `?embed=true&surface=manage`
2. Add a Manage context bridge:
   - `source: 'manage'`
   - `surface`: `question-pool`, `element-editor`, `course-dashboard`, `activity-creation`, `evaluation`
   - current `courseId`, `elementId`, `activityId`, selected tags, active filters, draft title/content where available
3. Add a dedicated chat runtime route for the lecturer assistant:
   - not `/:chatbotId`
   - authenticated with the existing Manage lecturer session
   - fixed assistant identity/name/avatar in v1
   - separate thread namespace, e.g. `assistantKind = 'manage'`
4. Start with read and draft tools:
   - `klicker_manage_course_list`
   - `klicker_manage_element_search`
   - `klicker_manage_element_get`
   - `klicker_manage_question_draft`
   - `klicker_manage_choices_draft`
   - `klicker_manage_feedback_draft`
5. Add write tools only behind confirmation:
   - `klicker_manage_element_create_draft`
   - `klicker_manage_element_update_draft`
   - `klicker_manage_practice_quiz_create_draft`

## Tool approval model

Write-capable tools should return a proposed mutation envelope first:

```json
{
  "kind": "element.create",
  "summary": "Create a single-choice question in Draft status",
  "payload": {
    "type": "SC",
    "content": "...",
    "options": { "choices": [] },
    "status": "DRAFT"
  },
  "requiresConfirmation": true
}
```

The UI then renders a confirmation card with `Preview`, `Edit in form`, and `Create draft`. The actual write request should use a normal Manage GraphQL mutation with the lecturer session, not a hidden autonomous backend write. This keeps authorization, validation, notifications, and audit behavior aligned with existing Manage flows.

## Implementation phases

1. **UI shell only**: add a disabled/feature-flagged Manage assistant widget to `Layout.tsx` so every Manage page can host it without page-by-page wiring.
2. **Context bridge**: collect route, query params, selected course/activity/element ids, and minimal editor draft metadata; never send secrets or full private datasets by default.
3. **Lecturer assistant route**: add chat app route/runtime for `surface=manage`, reusing assistant-ui thread/composer, but with lecturer auth and no course chatbot lookup.
4. **Read/draft MCP**: expose safe read tools plus draft-generation tools. Validate all inputs with Zod.
5. **Confirmation UI**: render write proposals as assistant-ui tool UI cards and only execute persisted writes after a lecturer click.
6. **E2E validation**: open Manage question pool locally, ask for an MC question draft, confirm a draft creation, verify it appears in the question pool and remains `DRAFT`.

## Open decisions

- Whether Manage assistant threads belong in the current chat database tables with a nullable `chatbotId`, or in separate `AssistantThread` tables.
- Whether the lecturer assistant should be globally available or course-selectable in v1.
- Whether confirmation actions should execute via Manage GraphQL directly from the iframe parent, or through a chat route that delegates to GraphQL with the lecturer session.
