# Chat Image Attachment Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents are available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop eager-loading full historical image payloads in chat threads, show tiny inline previews instead, lazy-load the original image only on explicit interaction, preserve edit/regenerate flows, and fix stable attachment ordering plus root-message attachment carry-over.

**Architecture:** Persist three attachment layers for new messages: full image, tiny preview, and description. Historical thread loads return preview-only attachment DTOs ordered by persisted `position`; full images are rehydrated on demand through an authenticated message-level attachment endpoint and cached in session state. Current-turn model input remains full-image based; prior-turn model context remains description-only. In the delivered implementation, preview bytes are generated server-side before persistence so the `/chat` POST only carries full image bytes and avoids oversized JSON request bodies in dev.

**Tech Stack:** Next.js App Router, React 19, Zustand, Prisma/Postgres, Tailwind, `@uzh-bf/design-system`, Vitest for new pure-helper tests, `sharp` for server-side preview generation, `npx agent-browser` for frontend verification.

---

## Scope And Simplifications

- Included: history payload slimming, preview persistence, lazy full-image hydration, stable ordering, root-edit attachment preservation, regenerate/edit hydration.
- Excluded from this plan: image-description credit accounting leak, server-side enforcement of `supportsImageAttachments`, and preview backfill for legacy rows. Those should be follow-up patches so this work stays focused.
- Use a message-level hydration endpoint instead of one request per attachment. A message already caps at 3 images, and edit/regenerate want the full set anyway.
- Backfill `position` in the migration.
- Do not backfill `imagePreviewBase64` in SQL. Legacy attachments without previews render a neutral placeholder tile in history, but still lazy-load the original image successfully.
- Keep local unsaved image rendering independent from persisted previews. Pending/local messages may still use locally generated previews or full-image fallbacks for same-session UX, but that data is no longer part of the `/chat` request contract.

## Target Files

- Modify: `packages/prisma/src/prisma/schema/chat.prisma` - add preview + ordering fields.
- Create: `packages/prisma/src/prisma/schema/migrations/<timestamp>_add_chat_attachment_preview_and_position/migration.sql` - schema change + `position` backfill.
- Modify: `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` - persist ordered attachments with previews, keep live-send full-image behavior, keep prior-turn description-only prompt injection.
- Modify: `apps/chat/src/app/api/chatbots/[chatbotId]/threads/[threadId]/messages/route.ts` - return preview-only history DTOs, never `imageBase64`.
- Create: `apps/chat/src/app/api/chatbots/[chatbotId]/threads/[threadId]/messages/[messageId]/attachments/route.ts` - authenticated lazy hydration endpoint for one message's full attachments.
- Modify: `apps/chat/src/lib/api/types.ts` - separate outbound attachment payloads from history DTOs and hydrated client attachments.
- Modify: `apps/chat/src/stores/chatStore.ts` - add `ensureFullImageAttachments(...)` action and merge hydrated data into both `allMessages` and active path state.
- Modify: `apps/chat/src/hooks/useChatResponse.ts` - send full images for current turn; hydrate historical preview-only attachments before resend/regenerate when needed.
- Modify: `apps/chat/src/hooks/useThreadManagement.ts` - fix root-message edit attachment carry-over and preserve ordering.
- Modify: `apps/chat/src/lib/attachments/imageAttachmentAdapter.ts` - keep local preview generation/fallback for same-session UX only; do not make preview bytes part of the `/chat` transport contract.
- Create: `apps/chat/src/lib/server/imagePreview.ts` - generate persisted tiny previews server-side before attachment persistence.
- Create: `apps/chat/src/lib/attachments/attachmentUi.ts` - centralize inline preview/openability rules for persisted versus local attachments.
- Modify: `apps/chat/src/components/thread.tsx` - replace large historical renders with tiny previews and use hydration-aware open/edit/regenerate flow.
- Create: `apps/chat/src/components/message-attachments.tsx` - focused inline preview renderer.
- Create: `apps/chat/src/components/thread-image-viewer-modal.tsx` - modal/lightbox that lazy-loads full images and shows retry state.
- Create: `apps/chat/src/lib/attachments/attachmentState.ts` - pure helper functions for ordering, hydration merging, and edit-message source resolution.
- Create: `apps/chat/vitest.config.ts` - minimal chat-package test harness.
- Create: `apps/chat/test/attachment-state.test.ts` - pure helper coverage.
- Create: `apps/chat/test/chat-response-hydration.test.ts` - resend/regenerate hydration and request-payload coverage.
- Create: `apps/chat/test/chat-store-hydration.test.ts` - store hydration merge/dedup/source-id coverage.
- Create: `apps/chat/test/message-attachment-behavior.test.ts` - persisted/local attachment UI behavior coverage.
- Create: `apps/chat/test/image-preview.test.ts` - server-side preview generation coverage.
- Create: `apps/chat/test/image-attachment-adapter.test.ts` - local adapter preview/fallback coverage.
- Create: `apps/chat/test/message-editing.test.ts` - root-edit attachment carry-over coverage.
- Create: `apps/chat/test/history-attachment-serialization.test.ts` - history DTO never includes full image data.
- Modify: `apps/chat/package.json` - add minimal `test:run` and `test:watch` scripts plus Vitest dev dependency.

## Chunk 1: Test Harness And Attachment State Helpers

### Task 1: Add A Minimal `apps/chat` Test Harness

**Files:**
- Modify: `apps/chat/package.json`
- Create: `apps/chat/vitest.config.ts`
- Create: `apps/chat/test/attachment-state.test.ts`
- Create: `apps/chat/test/message-editing.test.ts`
- Create: `apps/chat/test/history-attachment-serialization.test.ts`
- Create: `apps/chat/src/lib/attachments/attachmentState.ts`

- [ ] Step 1: Add `vitest` to `apps/chat/package.json` devDependencies, matching repo convention as closely as possible.
- [ ] Step 2: Add `test:run` as `vitest run` and `test:watch` as `vitest`.
- [ ] Step 3: Add `apps/chat/vitest.config.ts` with a minimal Node-oriented config so pure TS helpers can be tested without introducing a full browser test harness.
- [ ] Step 4: Create `apps/chat/src/lib/attachments/attachmentState.ts` with only pure helpers:
  - `mergeHydratedAttachments(...)`
  - `sortAttachmentsByPosition(...)`
  - `getEditedMessageSource(...)`
  - `buildHistoryAttachmentDto(...)`
- [ ] Step 5: Write failing tests for those helpers first.

```ts
expect(
  sortAttachmentsByPosition([
    { id: 'b', position: 1 },
    { id: 'a', position: 0 },
  ])
).toEqual([
  { id: 'a', position: 0 },
  { id: 'b', position: 1 },
])
```

```ts
expect(
  getEditedMessageSource({
    editedMessageId: 'root-user',
    messages: [{ id: 'root-user', role: 'user', imageAttachments: [{ id: 'att-1' }] }],
  })?.imageAttachments
).toHaveLength(1)
```

- [ ] Step 6: Run `pnpm --filter @klicker-uzh/chat test:run`. Expected: tests fail because helper behavior is not implemented yet.
- [ ] Step 7: Implement the minimal helper logic.
- [ ] Step 8: Run `pnpm --filter @klicker-uzh/chat test:run`. Expected: all new tests pass.
- [ ] Step 9: Commit with `git commit -m "test(chat): add attachment helper test harness"`.

## Chunk 2: Persistence And History API

### Task 2: Extend `ChatAttachment` For Ordering And Tiny Previews

**Files:**
- Modify: `packages/prisma/src/prisma/schema/chat.prisma`
- Create: `packages/prisma/src/prisma/schema/migrations/<timestamp>_add_chat_attachment_preview_and_position/migration.sql`

- [ ] Step 1: Add `position Int` to `ChatAttachment`.
- [ ] Step 2: Add `imagePreviewBase64 String?` to `ChatAttachment`.
- [ ] Step 3: Replace `@@index([messageId])` with `@@index([messageId, position])` or add the composite index alongside the existing one if Prisma requires both.
- [ ] Step 4: Write the migration so existing rows get deterministic `position` values based on `createdAt, id`.
- [ ] Step 5: Keep `imagePreviewBase64` nullable so legacy attachments stay readable without an expensive image backfill.

Representative migration logic:

```sql
ALTER TABLE "ChatAttachment" ADD COLUMN "position" INTEGER;
ALTER TABLE "ChatAttachment" ADD COLUMN "imagePreviewBase64" TEXT;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "messageId"
      ORDER BY "createdAt" ASC, id ASC
    ) - 1 AS rn
  FROM "ChatAttachment"
)
UPDATE "ChatAttachment" a
SET "position" = ranked.rn
FROM ranked
WHERE ranked.id = a.id;

ALTER TABLE "ChatAttachment" ALTER COLUMN "position" SET NOT NULL;
CREATE INDEX "ChatAttachment_messageId_position_idx"
ON "ChatAttachment" ("messageId", "position");
```

- [ ] Step 6: Run `pnpm run prisma:migrate`. Expected: a new migration is created and applied locally.
- [ ] Step 7: Run `pnpm --filter @klicker-uzh/prisma generate`. Expected: Prisma client updates cleanly.
- [ ] Step 8: Run `pnpm run prisma:sync`. Expected: analytics schema copy stays in sync.
- [ ] Step 9: Run `pnpm --filter @klicker-uzh/chat check`. Expected: no type errors from the schema change alone.
- [ ] Step 10: Commit with `git commit -m "feat(chat): persist ordered attachment previews"`.

### Task 3: Persist Preview Data On Send And Strip Full Images From History Loads

**Files:**
- Modify: `apps/chat/src/lib/api/types.ts`
- Modify: `apps/chat/src/lib/attachments/imageAttachmentAdapter.ts`
- Modify: `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
- Modify: `apps/chat/src/app/api/chatbots/[chatbotId]/threads/[threadId]/messages/route.ts`
- Modify: `apps/chat/src/lib/attachments/attachmentState.ts`
- Modify: `apps/chat/test/history-attachment-serialization.test.ts`

- [ ] Step 1: Keep the `/chat` request transport on full-image payloads only so the JSON body does not grow with preview bytes.
- [ ] Step 2: Keep local adapter preview generation or fallback behavior for same-session UI only; do not depend on that preview in the request contract.
- [ ] Step 3: Add a server helper that generates `imagePreviewBase64` from `imageBase64` before `persistAttachments(...)` runs.
- [ ] Step 4: Use `sharp` server-side to resize and JPEG-encode a small preview image before persistence.
- [ ] Step 5: Update `chat/route.ts` so the live model input still uses full images from the current request. Do not replace current-turn multimodal input with descriptions.
- [ ] Step 6: Update `persistAttachments(...)` to write `imageBase64`, server-generated `imagePreviewBase64`, `imageDescription`, and zero-based `position`.
- [ ] Step 7: Update prior-attachment reads used for prompt context to `orderBy: { position: 'asc' }`.
- [ ] Step 8: Update `threads/[threadId]/messages/route.ts` so history attachments serialize only:
  - `id`
  - `type`
  - `position`
  - `imagePreviewBase64`
  - `imageDescription`
  - `hasFullImage`
- [ ] Step 9: Add a regression test that the history DTO never exposes `imageBase64`.

```ts
expect(
  buildHistoryAttachmentDto({
    id: 'att-1',
    position: 0,
    imageBase64: 'data:image/png;base64,FULL',
    imagePreviewBase64: 'data:image/png;base64,PREVIEW',
    imageDescription: 'chart screenshot',
  })
).toEqual({
  id: 'att-1',
  type: 'image',
  position: 0,
  imagePreviewBase64: 'data:image/png;base64,PREVIEW',
  imageDescription: 'chart screenshot',
  hasFullImage: true,
})
```

- [ ] Step 10: Run `pnpm --filter @klicker-uzh/chat test:run`. Expected: history DTO and server preview tests pass and no full-image field leaks.
- [ ] Step 11: Run `pnpm --filter @klicker-uzh/chat check`. Expected: request/response type changes are consistent.
- [ ] Step 12: Commit with `git commit -m "feat(chat): return lightweight attachment history"`.

## Chunk 3: Lazy Hydration And Client State

### Task 4: Add A Message-Level Full-Attachment Hydration Endpoint

**Files:**
- Create: `apps/chat/src/app/api/chatbots/[chatbotId]/threads/[threadId]/messages/[messageId]/attachments/route.ts`
- Modify: `apps/chat/src/lib/api/types.ts`
- Modify: `apps/chat/src/stores/chatStore.ts`
- Modify: `apps/chat/src/lib/attachments/attachmentState.ts`
- Modify: `apps/chat/test/attachment-state.test.ts`

- [ ] Step 1: Create a new authenticated route at `.../messages/[messageId]/attachments/route.ts`.
- [ ] Step 2: Reuse the standard chat auth flow:
  - `withChatbotAuth(req, chatbotId)`
  - `requireParticipation(participantId, courseId)`
- [ ] Step 3: Query only attachments belonging to `messageId`, `threadId`, and the current `chatbotId`.
- [ ] Step 4: Order returned attachments by `position`.
- [ ] Step 5: Return the full attachment shape needed to hydrate client state, including `imageBase64`.
- [ ] Step 6: Set `Cache-Control: private, no-store`.
- [ ] Step 7: Return `404` for missing or unauthorized records to avoid existence leaks.
- [ ] Step 8: Add a store action like `ensureFullImageAttachments(chatbotId, threadId, messageId, sourceMessageId?)` that:
  - no-ops if all attachments already have `imageBase64`
  - fetches once otherwise
  - merges hydrated attachments into both `allMessages` and active-path `messages`
  - preserves `position`
  - can fetch from an original persisted source message when the local edited branch message has a different id
  - returns the updated message
- [ ] Step 9: Add tests for merge behavior, duplicate-hydration avoidance, and ordered merge results.
- [ ] Step 10: Run `pnpm --filter @klicker-uzh/chat test:run`. Expected: hydration merge tests pass.
- [ ] Step 11: Run `pnpm --filter @klicker-uzh/chat check`. Expected: no store/type regressions.
- [ ] Step 12: Commit with `git commit -m "feat(chat): lazy-load full message attachments"`.

### Task 5: Preserve Edit And Regenerate Behavior For Historical Image Messages

**Files:**
- Modify: `apps/chat/src/hooks/useChatResponse.ts`
- Modify: `apps/chat/src/hooks/useThreadManagement.ts`
- Modify: `apps/chat/src/lib/attachments/attachmentState.ts`
- Modify: `apps/chat/test/message-editing.test.ts`
- Modify: `apps/chat/test/attachment-state.test.ts`

- [ ] Step 1: Fix the root-edit bug by resolving the edited message directly from the message list by `id`, not indirectly via `parentId`.
- [ ] Step 2: Preserve attachment order and all loaded attachment fields when creating the edited replacement message.
- [ ] Step 3: Carry a stable persisted attachment source id (for example `attachmentSourceMessageId`) on edited branch messages so hydration can fetch from the original persisted message when the local branch message has a new id.
- [ ] Step 4: In `useChatResponse.ts`, before resend/regenerate submits a message with preview-only attachments, call `ensureFullImageAttachments(...)` using the local message id for merge and the source message id for fetch when they differ.
- [ ] Step 4: Abort the action with a visible recoverable error if hydration fails; never silently drop attachments.
- [ ] Step 5: Keep same-session resends fast by using already-hydrated local full images when present.
- [ ] Step 6: Ensure same-session local image sends remain usable before persistence: local attachments without persisted ids should still render/open sensibly.
- [ ] Step 6: Add tests covering:
  - root user message edit preserves attachments
  - historical preview-only message is hydrated before resend
  - edited historical preview-only message hydrates through its persisted source message id
  - failed hydration leaves message attachments intact and signals an error path
- [ ] Step 7: Run `pnpm --filter @klicker-uzh/chat test:run`. Expected: edit, resend, and source-id hydration tests pass.
- [ ] Step 8: Run `pnpm --filter @klicker-uzh/chat check`. Expected: hook/store signatures remain type-safe.
- [ ] Step 9: Commit with `git commit -m "fix(chat): preserve attachments for edit and regenerate"`.

## Chunk 4: UI And Verification

### Task 6: Replace Large Historical Images With Tiny Previews And A Lazy-Loaded Viewer

**Files:**
- Modify: `apps/chat/src/components/thread.tsx`
- Create: `apps/chat/src/components/message-attachments.tsx`
- Create: `apps/chat/src/components/thread-image-viewer-modal.tsx`

- [ ] Step 1: Extract attachment rendering out of `thread.tsx` into `message-attachments.tsx` so the main thread component does not absorb all preview/viewer complexity.
- [ ] Step 2: Render historical attachments as tiny inline previews only.
- [ ] Step 3: Use roughly `40px` to `48px` square previews in history.
- [ ] Step 4: If `imagePreviewBase64` is missing on a legacy attachment, render a compact placeholder tile rather than a broken image.
- [ ] Step 5: Add `thread-image-viewer-modal.tsx` using the existing `@uzh-bf/design-system` modal pattern.
- [ ] Step 6: On preview click, call `ensureFullImageAttachments(...)`, open the modal immediately, and keep the preview or placeholder visible while the full image loads.
- [ ] Step 7: Add retry UI inside the modal if hydration fails.
- [ ] Step 8: Keep composer previews unchanged for unsent attachments; they are already small enough.
- [ ] Step 9: Run `pnpm --filter @klicker-uzh/chat check`. Expected: UI compiles cleanly.
- [ ] Step 10: Run `pnpm --filter @klicker-uzh/chat build`. Expected: Next build succeeds for `@klicker-uzh/chat`.
- [ ] Step 11: Commit with `git commit -m "feat(chat): show tiny history previews with lazy viewer"`.

### Task 7: Verify End To End

**Files:**
- No required new source files.
- Optional later: `cypress/e2e/chat/image-attachments.cy.ts` if the local flow proves stable enough for automation.

- [ ] Step 1: Run `pnpm --filter @klicker-uzh/chat test:run`. Expected: all new chat tests pass.
- [ ] Step 2: Run `pnpm --filter @klicker-uzh/chat check`. Expected: no TS errors.
- [ ] Step 3: Run `pnpm --filter @klicker-uzh/chat build`. Expected: successful production build.
- [ ] Step 4: Start the relevant local app stack for chat verification.
- [ ] Step 5: Use `npx agent-browser` to verify the happy path:
  - send a new message with 2-3 images
  - confirm history shows tiny previews, not large inline images
  - reload the thread and confirm previews still render
  - click a preview and confirm the full image lazy-loads in the modal
  - edit the first/root user message and confirm attachments are preserved
  - regenerate from an image-bearing message and confirm the action still works
- [ ] Step 6: Capture before/after screenshots for the changed UI states as required by repo guidance.
- [ ] Step 7: Manually verify one legacy attachment record if available:
  - preview missing renders placeholder
  - modal still loads the original image
- [ ] Step 8: If the flow is stable and worth keeping, add Cypress coverage as a follow-up, not as a blocker for this delivery.
- [ ] Step 9: Commit any final verification-safe adjustments with `git commit -m "test(chat): verify lazy attachment loading flow"`.

## Acceptance Criteria

- Historical thread loads no longer include `imageBase64`.
- Historical inline attachment UI uses tiny previews or a compact placeholder.
- Opening an attachment lazy-loads the original full image.
- Prior-turn prompt context still uses stored `imageDescription`, not historical base64 payloads.
- Current-turn model input still uses full image data.
- Attachment order is stable from persistence through render and resend.
- Editing the first/root user message preserves its attachments.
- Resend/regenerate of historical image messages hydrates full images first instead of silently dropping them.

## Recommended Commands During Implementation

- `pnpm run prisma:migrate`
- `pnpm --filter @klicker-uzh/prisma generate`
- `pnpm run prisma:sync`
- `pnpm --filter @klicker-uzh/chat test:run`
- `pnpm --filter @klicker-uzh/chat check`
- `pnpm --filter @klicker-uzh/chat build`

## Follow-Up After This Plan Lands

- Fix image-description credit accounting on `onError` and early-abort paths.
- Enforce `supportsImageAttachments` server-side.
- Decide whether legacy attachments need an offline preview backfill job.
