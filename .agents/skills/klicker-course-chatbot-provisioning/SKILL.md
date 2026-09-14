---
name: klicker-course-chatbot-provisioning
description: Provision and publish KlickerUZH course chatbots end to end — course-material knowledge bases from files or websites, chatbot configuration, two-tier publication with a credit policy, OLAT LTI embed links, and layered E2E verification. Use when preparing a course chatbot for PRD/STG, ingesting course materials or websites into a chatbot KB, requesting or approving chatbot publication, setting chatbot credit policies, or verifying a published chatbot through API, DB readback, or browser.
---

# KlickerUZH Course Chatbot Provisioning

Delivery loop: **resolve → build KB → configure → publish → embed → prove**. Every phase ends on a receipt: ids, statuses, flags, and counts. Receipts stay values-free — session tokens, secrets, and participant content never enter logs or chat.

Production data changes only through the mutations named here and the two scoped DB writes in Disclaimer and Publish. Anything broader needs its own explicit authority.

## Resolve targets

Per course: the owning account, the course row, and the source materials.

- Resolve the account by course ownership in the DB, not by the requested email domain. Functional accounts may live on `@bf.uzh.ch` when a request says `@df.uzh.ch`; the account that owns the current-semester course is the right one. Query `User` by email, then `Course` by `ownerId`.
- The account needs `aiFeaturesEnabled = true`; publication re-reads the flag live. When it is false, flip it first with the admin `SetAiFeatures` mutation.
- Reuse the account's current-semester course. Create one only when absent (semester window, language, notification email).
- One account may own prior-semester bots — leave them untouched; match existing bots by exact name before creating.

**Done when** every course maps to a verified `userId` + `courseId` and the account is AI-capable.

## Build the KB

- `CreateKb` per course (name `<Course> <Semester>`).
- Files: `RequestKbFileUpload` (fileName, contentType, sizeBytes) → PUT the bytes to `<account>/<container>/<blob>?<sas>` from the response (header `x-ms-blob-type: BlockBlob`) → `ConfirmKbFileUpload` (blobName, title, mimeType, sizeBytes, materialType `COURSE_CONTENT`).
- Websites: `CreateKbUrlResource` (kbId, url, title, materialType) — ingestion fetches the page itself.
- `IngestAllKbResources`, then poll `GetKbResources` until every resource is `READY`. Script-sized PDFs take minutes; poll around 5 s and keep the flow idempotent so a rerun skips already-present titles.

**Done when** the resource count matches the source set and every status is `READY`.

## Configure the chatbot

- `CreateChatbot` bound to the courseId.
- `UpdateChatbotStandardModeConfig`: tutor + explainer + quizzer, courseName, subjectDomain, languageOfInstruction.
- `UpdateChatbotModelPolicy`: `allowedModelIds: ['auto']`, modelSelection off.
- `AttachKbToChatbot`.

`languageOfInstruction` follows the materials: German-taught courses keep `de` even when the course row says `en` — the course row drives only the PWA locale prefix of the embed link.

**Done when** a readback shows the three modes, the auto allow-list, and the KB binding.

## Disclaimer (publication gate)

`RequestChatbotPublication` fails with `CHATBOT_DISCLAIMER_REQUIRED` until a disclaimer is linked.

- German-language bots use Swiss German with real umlauts (ü/ä/ö); transliterations (ue/ae/oe) fail the standard.
- `SaveChatbotDisclaimer(chatbotId, expectedDisclaimerId, title, introText)`: `null` on first save; on conflict refetch the current id — the expected id is a compare-and-set.
- Disclaimers are editable only while DRAFT or REJECTED. After PUBLISHED, a content fix is a scoped `ChatbotDisclaimer` UPDATE of title/introText by disclaimer id, under explicit authority.

**Done when** the disclaimer is linked and the intro text carries the umlauts the language requires.

## Publish (two-tier) with credit policy

1. Course account: `RequestChatbotPublication(id, useCase, expectedStudentCount, proposedCredits)` → `PENDING_APPROVAL`.
2. The deployed API is flat-only: the request sets initial = reset = max = proposedCredits and keeps the configured reset period. A daily-refresh policy (for example 3 initial / 1 per day / 3 max) needs a scoped DB write between request and approval: lock the row `FOR UPDATE`, guard on `status = 'PENDING_APPROVAL'`, set `creditResetAmount` and `creditResetPeriod = 'DAILY'`, and receipt before/after.
3. Admin account: `ApproveChatbotPublication` → `PUBLISHED` (stamps `publishedAt` once).

**Done when** the DB readback shows `PUBLISHED`, `publishedAt` set, and the exact credit tuple.

## OLAT embed link

`https://lti.klicker.uzh.ch?redirectTo=` + URL-encoded `https://pwa.klicker.uzh.ch/{course.language}/course/{courseId}/chatbot/{chatbotId}?embed=true`

The LTI app authenticates the OLAT launch and appends the participant JWT to the target. A GET without a launch answers `401 NO_LTIK_OR_IDTOKEN_FOUND` — that is the liveness contract. A working embed is proven only by a real launch from OLAT.

**Done when** one encoded link per chatbot exists.

## Prove it end to end

Layered, cheapest first; claim E2E only after a real browser turn.

1. **DB readback** (authoritative): status, publishedAt, credit tuple, standardModeConfig modes, disclaimer umlauts, courseId, KB resources READY. Read-only transaction with `statement_timeout`.
2. **API as owner**: `GetChatbotsInfo` for the account.
3. **Browser** (@Browser plugin or `npx agent-browser`): owner preview `https://chat.klicker.uzh.ch/preview/{chatbotId}` — disclaimer renders with umlauts, all three modes selectable, one real tutor question returns an answer with sources, quizzer emits a question, and `usageSummary.lastActivityAt` advances on readback.
4. **Participant + OLAT**: the real launch from the OLAT course is the acceptance event; it is user-side.

**Done when** every reachable layer has a receipt and the OLAT launch is either observed or named as the open gap.

## Mechanics

- **Endpoint**: `https://backend-sls.klicker.uzh.ch/api/graphql` (PRD; same flow on STG with the STG host and profile). APQ only: send `operationName` + `variables` + `extensions.persistedQuery.sha256Hash`; raw documents are rejected. Resolve the deployed commit (deployment PR or image tag), then hash each op from the ops directory at that commit with the `__typename`-adding transform the client applies — hashes drift with every deploy.
- **Sessions**: mint JWTs with `APP_SECRET` (HS256, short expiry). Claims: `{ sub: userId, email, role: USER|ADMIN, catalystInstitutional: true, catalystIndividual: false, scope: FULL_ACCESS }` — the catalyst claim is mandatory for chatbot ops (`AI_BETA_ACCESS_REQUIRED` without it). Send as cookie `next-auth.session-token=<jwt>`, origin `https://manage.klicker.uzh.ch`, header `x-graphql-yoga-csrf: true`. Mint with `sub: user.userId ?? user.id`.
- **Secrets and DB**: `rs-infisical-operator --profile klicker-prd run --map APP_SECRET=APP_SECRET --map DATABASE_URL=DATABASE_URL -- <cmd>`. DB via psycopg3 (`sslmode=require`); reads in read-only transactions, writes in guarded `FOR UPDATE` transactions.
- **Response shapes**: data keys are camelCase per operation (for example `data.getUserKbsConnection`) — destructure per op, and rerun flows idempotently instead of unwinding partial state.