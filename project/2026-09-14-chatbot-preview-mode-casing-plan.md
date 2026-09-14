# Chatbot owner-preview mode casing fix

Frozen work-item contract for the delegated task on branch
`rs/chatbot-preview-mode-casing`. Commit this file verbatim as part of the
work-item plan commit; do not edit the section between the item markers.

<!-- item:start -->
## W1 - Accept stored custom mode keys in the owner preview chat route

Outcome: an owner-preview chat request resolves mode keys exactly like the
participant route, so a custom mode stored with a mixed-case key such as
`Ethik-Rollenspiel` works in the preview instead of failing with HTTP 400.

Defect: `apps/chat/src/app/api/manage/chatbots/[chatbotId]/preview/chat/route.ts`
applies `.transform((value) => value.toLowerCase())` to `selectedMode` inside
`previewOptionsSchema` before calling `resolveRequestedChatMode`. That helper in
`apps/chat/src/lib/server/effectiveChatModes.ts` matches a stored key exactly
first and only case-folds standard modes (`tutor`, `quizzer`, `explainer`).
Case-folding first destroys mixed-case custom keys: the exact match fails, the
standard-mode branch does not apply, and `Object.hasOwn(modeOptions, selectedMode)`
rejects the request as an unsupported mode. The participant route
`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` passes the raw value
and does not have this defect.

Required behavior:

- `selectedMode` reaches `resolveRequestedChatMode` unmodified; no case folding
  happens in the preview request schema.
- A custom mode stored as `Ethik-Rollenspiel` resolves when the preview client
  sends that exact stored key.
- Resolution parity: for the same input the preview route and the participant
  route resolve to the same mode. A lowercase variant of a custom key does not
  resolve on either route, matching the existing resolver contract in
  `apps/chat/test/effective-chat-modes.test.ts`; do not extend the resolver.
- Standard-mode case variants (`Tutor`, `TUTOR`) keep resolving to `tutor`.
- An unknown mode still returns HTTP 400 with the existing error shape.
- Every downstream mode-keyed lookup (mode configuration, MCP scope) receives
  the canonical stored key.

Acceptance checks:

- A regression test at the cheapest seam that observes the defect passes with a
  mixed-case custom mode key and fails against the pre-fix transform; record the
  red and green runs.
- A parity check shows identical resolution results for the same inputs on the
  preview and participant paths: `Ethik-Rollenspiel`, `ethik-rollenspiel`,
  and `Tutor`.
- The chat app test suite for the touched area, plus lint and type checks for
  the touched package, pass.
- `git grep -n "toLowerCase" -- "apps/chat/src/app/api/manage/chatbots/[chatbotId]/preview/"`
  finds no remaining case folding in the preview route.

Non-goals and boundaries:

- Do not change stored mode keys, resolver semantics, or the participant route.
- Do not add compatibility branches for unreleased contracts.
- No STG or PRD writes, no chatbot configuration changes, no deployment.
- The current live workaround, a lowercase stored mode key, stays valid while
  the fix is developed.
<!-- item:end -->
