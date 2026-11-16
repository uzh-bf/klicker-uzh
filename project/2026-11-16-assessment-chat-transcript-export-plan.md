# Assessment chat transcripts through the assessment export

## Approval summary

Two deliveries with different deadlines:

- **Notice (before the exam, 16 Dec).** Students of an assessment-enabled course see a chatbot notice saying their conversations are stored with their identity and released to the assessment staff. Regular chatbots keep the anonymised-only notice. This ships on the exam stack and does not depend on #6253.
- **Export and viewer (before grading starts).** Lecturers request the transcripts of an exam chatbot through the attested assessment export of #6253. A Hatchet task in the general worker builds a ZIP with an overview file and one JSON file per student. The lecturer downloads it from the export dialog. A generic viewer page opens any one student JSON locally and shows the visible text of every message with its status markers, for example during the exam review.

The disclosure stays at version `v1`; its text is updated in place because no release branch has ever carried it.

Approval mode: executable batch. Terminal condition: the notice layer on the exam stack and #6913 carry their slices with host-runnable unit tests and green CI on their exact heads; local browser evidence, or the named blocker (the local devcontainer does not start). Merging, deployment and the exam chatbot configuration stay separately gated.

### Decisions

| Decision | Ruling |
| --- | --- |
| Export path | Through the assessment export of #6253 (user, 2026-11-16); #6878 closed |
| #6253 integration | Merged with `v3-ai` (`c2738e6d5c`); its receipt migration is regenerated with the transcript columns, still one migration (user, 2026-11-16). No release branch, including the staging source `v3-adaptive-learning`, contains it |
| Download | Asynchronous ZIP from a Hatchet task in the general worker; overview plus one JSON per student (user, 2026-11-16) |
| Viewer | Generic page importing one student JSON locally (user, 2026-11-16) |
| Disclosure | Keep `v1`, update the text; assessment and regular chatbots carry different student notices (user, 2026-11-16) |

### Open choices with recommendations

| Question | Recommendation |
| --- | --- |
| Where the ZIP waits | A `bytea` column on a small artifact table in the same migration, cleared at expiry. The transcripts already live in this database, so no new storage location, secret or container is needed. Blob storage would add an infrastructure step per environment and share an account with knowledge-base files |
| Retention and repeat downloads | Downloadable for 7 days; every download is recorded; an hourly cron clears expired artifacts and marks stale requests failed |
| Exam chatbot without a disclaimer | In assessment mode the chat refuses a chatbot that has no disclaimer attached, so no student can start without the notice. The exam configuration attaches a new disclaimer |
| Entry notice | `assessmentDataSharingNotice` names chatbot conversations among the data released to assessment staff |
| ZIP library | Add `fflate` to `packages/graphql` |
| Viewer location | Standalone page `/transcript-viewer` for any signed-in lecturer, outside the `ai-beta` chatbots area |
| Fallback if the asynchronous path is not deployable by grading time | Ask then; options are a synchronous attested `CHATBOT` download (about 100 students fit the existing 60 s and 10 MB limits) or a one-off approved export |

## Execution details

### Authority

- User instructions (2026-11-16): close #6878; merge `v3-ai` into #6253 and amend its migration; build the asynchronous ZIP, the viewer and the notice texts; the exam stack keeps #6886, #6888, #6895 and #6885.
- Granted: local implementation, commits and pushes to `enhance/assessment-chat-transcript-export`, to `rs/dpo-course-exports` for the migration and receipt model, and to a notice layer on the exam stack; draft PR creation and updates.
- Withheld: merging, marking ready, deployment, live configuration, paid model calls.

### Current state

- `POST /api/data-exports/assessment` (`apps/backend-docker/src/app.ts:144-227`) requires the management origin and the `x-graphql-yoga-csrf` header and calls `downloadAssessmentExport` (`packages/graphql/src/services/assessmentExports.ts`), which checks role, login scope and course ADMIN, writes a single-use `PENDING` receipt, re-checks access under `FOR SHARE`, builds a CSV and records `RELEASED`.
- General-worker tasks: `prepareHatchetTasks` in `packages/hatchet/src/index.ts`, handler types in `packages/types/src/hatchet.ts`, handlers exported from `packages/graphql/src/index.ts`, fake task wiring in `packages/graphql/test/helpers.ts`. Course deletion is the template (persist, `ctx.hatchet.events.push`, mark failure only on the final retry); course duplication shows the stale-job cron sweep.
- Chat notice: `chat.disclaimer.dataProtectionText`, rendered by `apps/chat/src/components/disclaimer-modal.tsx` only when the chatbot has a `disclaimerId`; acceptance is keyed on the disclaimer id. `Chatbot` has no assessment flag; the discriminator is `chatbot.course.isAssessmentEnabled`. The management preview `ChatbotDisclaimerPreview.tsx` has three callers.
- The transcript builder exports the text parts of each message and lists attachments by type only; exam chats refuse attachments (#6895).

### Test portfolio

| Risk or behavior | Obligation | Seam |
| --- | --- | --- |
| Only a course ADMIN with a full login scope can request, poll and download; a foreign, expired or failed export is refused; a chatbot outside an assessment-enabled course is refused | add new | host-runnable unit tests of the request and download guards with a stubbed client; one integration case in CI |
| A transcript request never reaches the CSV path | add new | route dispatch unit test |
| Receipt moves `PENDING` → `READY`; a non-final retry leaves it `PENDING`, the final retry records `FAILED`, a stale request is swept to `FAILED`; the request id is single-use | add new | handler and sweep unit tests |
| The per-student JSON carries every thread in stored order with branch, incomplete and failed markers and no reasoning or tool internals; the overview lists roster gaps | replace/consolidate | `chatTranscriptExport.test.ts` (HTML tests replaced) |
| ZIP entries are the overview plus one JSON per roster entry, named from the participant id and an index with no path characters | add new | handler test unzipping the archive |
| The viewer schema accepts an exported file and rejects anything else | add new | schema unit test in `@klicker-uzh/types` |
| Assessment-course chatbots select the identified notice, regular ones the anonymised notice; assessment mode refuses a chatbot without a disclaimer | add new | variant-selection unit test (message key, not copy) and route test |

### Slices

**Delivery A: notice (exam stack, new layer on #6895).**

1. The disclaimer GET returns `assessment: chatbot.course.isAssessmentEnabled`; the modal and the management preview pick the identified or anonymised notice by that flag. The preview's callers get the flag through the chatbot query. In assessment mode the chat refuses a chatbot without a disclaimer. `assessmentDataSharingNotice` names chatbot conversations.

**Delivery B: export and viewer (#6253 and #6913).**

2. **Receipt and migration** (`rs/dpo-course-exports`). Add `chatbotId`, `artifactExpiresAt` and a `READY` status (shared with the research receipt, unused there), an artifact table with the ZIP bytes, and a download table recording each download. Regenerate the one migration with `prisma migrate diff` between the pre-change and post-change schemas so it sorts after the current migrations; sync the analytics schema. Timebox one hour; if it cannot be produced on the host, stop and report.
3. **Request.** `POST /api/data-exports/assessment-transcripts` with its own schema returns 202 and the export id. It reuses the role, login-scope and ADMIN checks and single-use handling, validates the chatbot (same course, assessment-enabled), writes the receipt and pushes `{exportId}`; a failed push marks the receipt `FAILED`. New error codes join `knownCodes`.
4. **Task.** The handler re-checks the requester's `DerivedPermission`, the course flag and the chatbot's course, builds the per-student JSON and overview, zips them with sanitized names, enforces size caps, stores the artifact and moves the receipt to `READY` with `updateMany where status = PENDING`. It returns only `{success}` and logs no content; failure is recorded on the final retry. An hourly cron clears expired artifacts and fails stale requests.
5. **Status and download.** `GET /api/data-exports/assessment-transcripts/:exportId` with the same origin and header guards returns the status, or the ZIP once ready, after repeating every check and refusing expired artifacts; each download is recorded. No GraphQL type is needed.
6. **Management UI.** The export dialog on the assessment results page offers the chatbot, the updated attestation text, polling while the job runs, and the download through fetch and an object URL.
7. **Viewer.** The per-student schema with `formatVersion` lives in `@klicker-uzh/types`. The `/transcript-viewer` page reads one file with `file.text()`, validates it, and renders student turns as plain text and assistant turns as markdown without remote images or links. The unused HTML transcript code is removed.
8. **Proof.** Host unit tests; CI on each exact head; browser evidence once the devcontainer starts, otherwise the gap is stated in the PRs.

### Recovery

- Migration generation fails on the host: stop slice 2, report, and leave the rest of delivery B waiting; delivery A continues.
- Database integration tests run only in CI while the devcontainer is broken; that is stated in the PRs.
- A finding that changes who can download stops that slice for a decision.

## Progress

- 2026-11-16: transcript builder moved from #6878 into this layer; #6878 closed. `v3-ai` merged into #6253 (`c2738e6d5c`) and this branch. Council critique returned CHANGES (13 items); accepted: notice split out as delivery A, assessment discriminator and disclaimer prerequisite, separate transcript route, download guards and recorded downloads, retry-aware failure and stale sweep, migration timebox, database storage instead of blob storage, accurate "visible text" wording, viewer schema in `@klicker-uzh/types` with safe rendering, ungated viewer page, sanitized entry names, named touch points, host-runnable guard tests, entry notice. Next: the user's choices above, then slice 1 and slice 2.
