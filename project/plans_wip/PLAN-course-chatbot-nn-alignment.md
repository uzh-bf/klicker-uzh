# Course ↔ Chatbot N:N alignment plan

## Goal

Implement a **Course↔Chatbot many-to-many** relationship with relation properties and move chat access to **explicit course-scoped routes/APIs**.

Decisions already made:
- Chat access requires explicit **course context** in URL/API.
- Credits + disclaimer acceptance remain **shared per (participantId, chatbotId)** across courses.

## Current state (code)

- Prisma:
  - `Chatbot.courseId` (1:N) and `Course.chatbots`.
  - `ChatThread` and `ChatUsageCredits` are keyed by `(participantId, chatbotId)`.
- Chat app:
  - Routes: `/<chatbotId>` and `/<chatbotId>/threads/<threadId>`.
  - APIs: `/api/chatbots/<chatbotId>/*` infer course via `chatbot.courseId`.
- Manage GraphQL:
  - `Chatbot.courses` is already exposed as a list (currently built from `course`).
- OLAT API:
  - Course chatbot listing uses `Chatbot.courseId`.

## Relationship model variants (requested)

### Variant 1 — Minimal link + presentation (recommended)

**Use when**: credits/disclaimer remain chatbot-scoped; per-course policy overrides are not needed.

**Schema**:
- New join model `CourseChatbot` with composite key (`courseId`, `chatbotId`).
- Properties:
  - `isEnabled` (bool)
  - `sortOrder` (int)
  - `isDefault` (bool) *or* `Course.defaultChatbotId`
  - Optional display overrides: `displayNameOverride`, `descriptionOverride`
  - `createdAt`, `updatedAt`

**Data moved to relation**:
- Association only (replace `Chatbot.courseId`).
- Optional presentation overrides (name/description).

### Variant 2 — Policy overrides on the relation (not compatible with chosen shared credits/disclaimer)

**Use when**: credit/disclaimer/model policy should differ per course.

**Schema**: Variant 1 + overrides:
- Credit policy override fields (initial/reset/max + resetPeriod).
- Disclaimer override (course-specific disclaimer).
- Optional model selection overrides.

**Data moved to relation**:
- Portions of `Chatbot` configuration become course-contextual.
- Would require credits/disclaimer acceptance to become course-scoped.

### Variant 3 — CourseChatbotContext id (optional if threads need course scoping)

**Use when**: threads should be course-scoped without changing message keys everywhere.

**Schema**:
- `CourseChatbot` has UUID `id` + unique `(courseId, chatbotId)`.
- `ChatThread` (and optionally `ChatUsageCredits`) refer to `courseChatbotId`.

**Data moved to relation**:
- Same as Variant 1 initially; the `id` becomes the stable context handle.

## Routing/API alignment (explicit course context)

### Target chat routes
- `/course/<courseId>/chatbot/<chatbotId>`
- `/course/<courseId>/chatbot/<chatbotId>/threads/<threadId>`

### Target APIs
- `/api/courses/<courseId>/chatbots/<chatbotId>`
- `/api/courses/<courseId>/chatbots/<chatbotId>/credits`
- `/api/courses/<courseId>/chatbots/<chatbotId>/disclaimer`
- `/api/courses/<courseId>/chatbots/<chatbotId>/threads/*`
- `/api/courses/<courseId>/chatbots/<chatbotId>/chat`

### Guard logic
- Verify chatbot exists.
- Verify link exists: `(courseId, chatbotId)` in `CourseChatbot`.
- Verify `Participation(courseId, participantId)`.

## Threads: scope decision

- **Option A (keep shared)**: `ChatThread` and `ChatUsageCredits` remain keyed by `(participantId, chatbotId)`.
- **Option B (course-scoped)**: add `courseId` (or `courseChatbotId`) to `ChatThread` and filter by course; migrate existing threads.

## Migration plan (high-level)

1. Add `CourseChatbot` model (Variant 1 recommended).
2. Backfill link rows from existing `Chatbot.courseId`.
3. Update OLAT API and Manage GraphQL to use link table.
4. Add course-scoped chat routes/APIs; keep legacy `/<chatbotId>` routes as temporary redirects if needed.
5. (Optional) remove `Chatbot.courseId` once all callers are migrated.

## Open questions

1. Choose relation model variant (default: Variant 1).
2. Should `CourseChatbot.isDefault` or `Course.defaultChatbotId` define the default chatbot?
3. Should threads remain shared across courses (Option A) or be course-scoped (Option B)?
