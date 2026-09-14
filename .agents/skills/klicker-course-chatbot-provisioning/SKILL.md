---
name: klicker-course-chatbot-provisioning
description: Provision and publish KlickerUZH course chatbots end to end — course-material knowledge bases from files or websites, chatbot configuration, revision-based publication with a credit policy, OLAT LTI embed links, and layered E2E verification. Use when preparing a course chatbot for PRD/STG, ingesting course materials, websites, or lecture recordings into a chatbot KB, saving or submitting a chatbot revision, approving a chatbot revision, setting chatbot credit policies, or verifying a published chatbot through API, DB readback, or browser.
---

# KlickerUZH Course Chatbot Provisioning

Delivery loop: **resolve → build KB → configure → publish → embed → prove**. Every phase ends on a receipt: ids, statuses, flags, and counts. Receipts stay values-free — session tokens, secrets, and participant content never enter logs or chat.

Production data changes only through the mutations named here; on the revision-based flow a fresh provision needs no direct DB writes at all. Anything broader needs its own explicit authority.

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

Videos use the imported lane instead — see Add videos (imported lane).

**Done when** the resource count matches the source set and every status is `READY`.

## Add videos (imported lane)

Content reaches a KB through one of two lanes. **App-added**: lecturer uploads or URLs produce `KBResource` rows (PDF/plain text/HTML only) with the full app lifecycle — status, replacement, deletion, storage quota. **Imported**: operator-side chunks written straight into the doc-query store; no `KBResource` row, so no app-side status, retry, deletion, or quota, and Manage lists them read-only via `getKbImportedSources`. Videos belong on the imported lane — the app-added lane's content types reject video.

One command in the data-ingestion checkout carries a local recording through the lane:

```bash
ingestion-cli video-import lecture --video <file> --course <slug> [--asr-language de] [--activate]
```

- The course binding is committed at `modules/ingestion-cli/src/ingestion_cli/course_targets/<slug>.yaml`: Klicker course, chatbot and KB identity, the target project config, and the eligibility policy the producer must have applied. Every course chatbot has one; `course_targets/README.md` covers adding a course. Environment: `VIDEO_PROCESSING_SERVICE_URL`, `VIDEO_PROCESSING_API_KEY`, `VIDEO_PROCESSING_STORAGE_ACCOUNT_URL` (or `..._CONNECTION_STRING`), container `VIDEO_PROCESSING_STORAGE_CONTAINER` (default `video-processing`), plus `KLICKER_MILVUS_URI` and `KLICKER_MILVUS_TOKEN` for the target config.
- The job id is `{kb_id}--{lecture_slug}` and the slug derives from the file name. Submission is idempotent on bytes and options; different bytes under an existing id are refused with 409, so a rerun resumes the same job instead of overwriting evidence.
- The service must publish `artifacts/<job_id>/learning_units/ingestion_source.json`: `video_ingestion_source.v1`, canonical JSON, units joined to the result and the review projection with producer dispositions. A package processed before that publication exists fails closed with `published_source_missing`; a source naming another job, video hash, or policy fails closed before anything is written.
- The import guards run inside the lane: `export_included=false` is excluded, `needs_review=true` is quarantined until a recorded decision, units with missing timestamps are rejected, citations fall back to video name plus timestamp when `slide_number` is null, and embedding text is composed from visual context, summary and transcript. Preparation stays local (receipts, zero vector writes); only `--activate` writes the corpus, exact-count, with replay and rollback seams.
- Receipts to check: service job status and reuse, source counts against the binding's policy digest, inventory source/eligible/excluded/quarantined counts, `prepared_count == eligible_unit_count`, a `target_fingerprint` that stays stable for the environment, then the activation count. A quarantined unit the course team wants in becomes a producer-side eligibility change (`clear_review`) and a re-import with a bumped `--resource-version`; the abandoned candidate stays inactive.
- Verify from the Klicker side: the imported-sources section lists the lecture with chunk counts, then an owner-preview retrieval question cites the video by name and timestamp. Inventory honesty: scans are bounded (`incomplete` and `unidentifiedChunks` are flags, not errors) and zero rows can mean the producer still stamps `chatbot_id` ahead of the `kb_id` rename.

**Done when** the lecture shows in the inventory, retrieval cites it with timestamps, and the receipts exist: job status, source unit counts, prepared receipt, activation count.

## Configure the chatbot

- `CreateChatbot` bound to the courseId.
- Read current state with `GetChatbotsInfoWithAuthoringRevisions` — it returns `status`, `revisionStatus`, `revisionVersion`, and the current knowledge-graph flags.
- `AttachKbToChatbot` (the operation is named `AttachKbToChatbot`, no M prefix, whatever the ops filename suggests).
- Modes, model policy, disclaimer, credits, and metadata are revision fields, not standalone mutations (since v3.4.0-alpha.77): one `SaveChatbotRevision(chatbotId, expectedRevisionVersion, input)` carries `standardModeConfig` (tutor + explainer + quizzer, courseName, subjectDomain, languageOfInstruction), `modelPolicy` (`allowedModelIds: ['auto']`, modelSelection off), `disclaimer`, `creditPolicy`, `metadata`, and `knowledgeGraphPolicy`.

`languageOfInstruction` follows the materials: German-taught courses keep `de` even when the course row says `en` — the course row drives only the PWA locale prefix of the embed link.

**Done when** a readback shows the three modes, the auto allow-list, and the KB binding.

## Disclaimer (publication gate)

Submit fails with `CHATBOT_DISCLAIMER_REQUIRED` until the revision carries a disclaimer.

- German-language bots use Swiss German with real umlauts (ü/ä/ö); transliterations (ue/ae/oe) fail the standard.
- The disclaimer is a revision input: `input.disclaimer = { expectedDisclaimerId, title, introText }` — `null` on first save; on conflict refetch the current id, the expected id is a compare-and-set.
- Editing a PUBLISHED bot is a new revision (save → submit → approve); no post-publish DB write is needed. While a revision is pending on a published bot, the live config keeps serving.

**Done when** the disclaimer is linked and the intro text carries the umlauts the language requires.

## Publish (revision flow) with credit policy

1. Course account: `SaveChatbotRevision` — see Configure. The response returns the new `revisionVersion`; thread it into the next call.
2. Course account: `SubmitChatbotRevision(chatbotId, expectedRevisionVersion, useCase, expectedStudentCount)` → `PENDING_APPROVAL`. Submit re-reads `aiFeaturesEnabled` on the owner live and validates the complete revision.
3. Admin account: `ApproveChatbotRevision(id, expectedRevisionVersion)` → `PUBLISHED` (stamps `publishedAt` once, copies the revision into live data).

The credit policy is a first-class revision input — `input.creditPolicy = { creditInitialCredits, creditResetAmount, creditResetPeriod, creditMaxCredits }` — so a daily-refresh policy (for example 3 initial / 1 per day / 3 max) is passed as data. The pre-alpha.77 flat-only workaround (scoped `creditResetAmount`/`creditResetPeriod` DB UPDATE between request and approval) applies only to deployments older than v3.4.0-alpha.77.

**Done when** the DB readback shows `PUBLISHED`, `publishedAt` set, and the exact credit tuple.

## OLAT embed link

`https://lti.klicker.uzh.ch?redirectTo=` + URL-encoded `https://pwa.klicker.uzh.ch/{course.language}/course/{courseId}/chatbot/{chatbotId}`

The LTI app authenticates the OLAT launch and appends the participant JWT to the target. A GET without a launch answers `401 NO_LTIK_OR_IDTOKEN_FOUND` — that is the liveness contract. A working embed is proven only by a real launch from OLAT.

**Done when** one encoded link per chatbot exists.

## Prove it end to end

Layered, cheapest first; claim E2E only after a real browser turn.

1. **DB readback** (authoritative): status, revisionStatus null, publishedAt, credit tuple, standardModeConfig modes, disclaimer umlauts, courseId, KB resources READY. Read-only transaction with `statement_timeout`.
2. **API as owner**: `GetChatbotsInfo` for the account.
3. **Browser** (@Browser plugin or `npx agent-browser`): owner preview `https://chat.klicker.uzh.ch/preview/{chatbotId}` — disclaimer renders with umlauts, all three modes selectable, one real tutor question returns an answer with sources, quizzer emits a question, and `usageSummary.lastActivityAt` advances on readback.
4. **Participant + OLAT**: the real launch from the OLAT course is the acceptance event; it is user-side.

**Done when** every reachable layer has a receipt and the OLAT launch is either observed or named as the open gap.

## Mechanics

- **Endpoint**: `https://backend-sls.klicker.uzh.ch/api/graphql` (PRD; same flow on STG with the STG host and profile). APQ only: send `operationName` + `variables` + `extensions.persistedQuery.sha256Hash`; raw documents are rejected. Resolve the deployed commit before hashing anything: PRD pins `backendGraphql.image.tag` in `deploy/env-uzh-prd/values.yaml` on `origin/v3`; map the tag to its commit and hash each op from the ops directory at that commit with the `__typename__`-adding transform the client applies. A hash covers the operation name, its document, and every fragment it spreads — renaming an operation or editing a fragment it uses changes it even when the op file itself is untouched. A mid-flow `PersistedQueryNotFound` means the deployment moved: re-resolve, recompute, rerun idempotently. The revision flow above applies from v3.4.0-alpha.77 (`b203d19000`); older deployments still serve the two-tier ops — resolve first, then pick the flow.
- **Sessions**: mint JWTs with `APP_SECRET` (HS256, short expiry). Claims: `{ sub: userId, email, role: USER|ADMIN, catalystInstitutional: true, catalystIndividual: false, scope: FULL_ACCESS }` — the catalyst claim is mandatory for chatbot ops (`AI_BETA_ACCESS_REQUIRED` without it). Send as cookie `next-auth.session-token=<jwt>`, origin `https://manage.klicker.uzh.ch`, header `x-graphql-yoga-csrf: true`. Mint with `sub: user.userId ?? user.id`.
- **Secrets and DB**: `rs-infisical-operator --profile klicker-prd run --map APP_SECRET=APP_SECRET --map DATABASE_URL=DATABASE_URL -- <cmd>`. DB via psycopg3 (`sslmode=require`); reads in read-only transactions, writes in guarded `FOR UPDATE` transactions.
- **Response shapes**: data keys are camelCase per operation (for example `data.getUserKbsConnection`) — destructure per op, and rerun flows idempotently instead of unwinding partial state.
- **Videos**: `video-processing` (PRD `app-video-processing`) turns one video into `result.json` and, on a revision that configures `VIDEO_PROCESSING_INGESTION_SOURCE_POLICY`, the published `learning_units/ingestion_source.json` the imported lane consumes; embedding, retrieval, permissions, and chatbot answering stay on the Klicker/df side. VLM spend is metered and alert-capped; weigh per-lecture VLM cost as part of the import decision.
