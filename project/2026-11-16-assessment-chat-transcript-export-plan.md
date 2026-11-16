# Assessment chat transcripts through the assessment export

## Approval summary

Two deliveries with different deadlines:

- **Notice (before the exam, 16 Dec).** Students of an assessment-enabled course see a chatbot notice saying their conversations are stored with their identity and released to the assessment staff. Regular chatbots keep the anonymised-only notice. This ships on the exam stack and does not depend on #6253.
- **Export and viewer (before grading starts).** Lecturers request the transcripts of an exam chatbot through the attested assessment export of #6253. A Hatchet task in the general worker builds a ZIP with an overview file and one JSON file per student. The lecturer downloads it once from the export dialog. The ZIP also carries a self-contained `viewer.html` that opens any one student JSON locally and shows the visible text of every message with its status markers, for example during the exam review; shipping it inside the archive keeps viewer and file format on the same version.

The disclosure stays at version `v1`; its text is updated in place because no release branch has ever carried it.

Approval mode: executable batch. Terminal condition: the notice layer on the exam stack and #6913 carry their slices with host-runnable unit tests and green CI on their exact heads; local browser evidence, or the named blocker (the local devcontainer does not start). Merging, deployment and the exam chatbot configuration stay separately gated.

### Decisions

| Decision | Ruling |
| --- | --- |
| Export path | Through the assessment export of #6253 (user, 2026-11-16); #6878 closed |
| #6253 integration | Merged with `v3-ai` (`c2738e6d5c`); its receipt migration is regenerated with the transcript columns, still one migration (user, 2026-11-16). No release branch, including the staging source `v3-adaptive-learning`, contains it |
| Download | Asynchronous ZIP from a Hatchet task in the general worker; overview plus one JSON per student (user, 2026-11-16) |
| Viewer | Self-contained `viewer.html` inside each ZIP, importing one student JSON locally (user, 2026-11-16) |
| ZIP storage | Database: an artifact table holding the archive, capped at 50 MB (user, 2026-11-16) |
| Downloads | Single download; the archive is deleted after it was streamed, and an unused archive expires after 7 days (user, 2026-11-16) |
| Exam chatbot without a disclaimer | The assessment chat refuses it (user, 2026-11-16) |
| Disclosure | Keep `v1`, update the text; assessment and regular chatbots carry different student notices (user, 2026-11-16) |

### Open choices

| Question | Recommendation |
| --- | --- |
| Entry notice | `assessmentDataSharingNotice` is live and versioned (`PARTICIPANT_DATA_USE_DISCLOSURE_VERSION`); naming chatbot conversations there needs a version bump that asks every account to renew. Pending a user ruling |
| Fallback if the asynchronous path is not deployable by grading time | Ask then; options are a synchronous attested `CHATBOT` download or a one-off approved export |

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

2. **Receipt and migration** (`rs/dpo-course-exports`). Add `chatbotId`, `artifactExpiresAt`, `READY` and `EXPIRED` statuses (shared with the research receipt, unused there) and an artifact table with the ZIP bytes. Regenerate the one migration with `prisma migrate diff` between the pre-change and post-change schemas so it sorts after the current migrations; sync the analytics schema. Timebox one hour; if it cannot be produced on the host, stop and report.
3. **Request.** `POST /api/data-exports/assessment-transcripts` with its own schema returns 202 and the export id. It reuses the role, login-scope and ADMIN checks and single-use handling, validates the chatbot (same course, assessment-enabled), writes the receipt and pushes `{exportId}`; a failed push marks the receipt `FAILED`. New error codes join `knownCodes`.
4. **Task.** The handler re-checks the requester's `DerivedPermission`, the course flag and the chatbot's course, builds the per-student JSON and overview, zips them with sanitized names, enforces size caps, stores the artifact and moves the receipt to `READY` with `updateMany where status = PENDING`. It returns only `{success}` and logs no content; failure is recorded on the final retry. An hourly cron clears expired artifacts and fails stale requests.
5. **Status and download.** `GET /api/data-exports/assessment-transcripts/:exportId` with the same origin and header guards returns the status, or the ZIP once ready, after repeating every check and refusing expired artifacts. After the archive is streamed, the artifact row is deleted and the receipt moves to `RELEASED`; a second download is refused. No GraphQL type is needed.
6. **Management UI.** The export dialog on the assessment results page offers the chatbot, the updated attestation text, polling while the job runs, and the download through fetch and an object URL.
7. **Viewer.** The per-student JSON carries a `formatVersion`. Each ZIP includes `viewer.html`, a self-contained page without external requests that opens one student JSON through a file picker, checks its format version, and renders student turns as plain text and assistant turns as escaped markdown without remote images or links. The unused HTML transcript code is removed.
8. **Proof.** Host unit tests; CI on each exact head; browser evidence once the devcontainer starts, otherwise the gap is stated in the PRs.

### Recovery

- Migration generation fails on the host: stop slice 2, report, and leave the rest of delivery B waiting; delivery A continues.
- Database integration tests run only in CI while the devcontainer is broken; that is stated in the PRs.
- A finding that changes who can download stops that slice for a decision.

## Progress

- 2026-11-16: transcript builder moved from #6878 into this layer; #6878 closed. `v3-ai` merged into #6253 (`c2738e6d5c`) and this branch. Council critique returned CHANGES (13 items); accepted: notice split out as delivery A, assessment discriminator and disclaimer prerequisite, separate transcript route, download guards and recorded downloads, retry-aware failure and stale sweep, migration timebox, database storage instead of blob storage, accurate "visible text" wording, viewer schema in `@klicker-uzh/types` with safe rendering, ungated viewer page, sanitized entry names, named touch points, host-runnable guard tests, entry notice. Next: the user's choices above, then slice 1 and slice 2.
- 2026-11-16: user rulings: database storage, single download, viewer inside the ZIP, refusal without disclaimer. Delivery A (notice, disclaimer requirement) committed on #6895 as `9c6d1aab82`. Slice 2: receipt migration regenerated with `prisma migrate diff` against the `v3-ai` schema as `20261116183000_export_receipts` (`731bb41456` on #6253). Next: slices 3 to 7 on this branch.
- 2026-11-16: slices 3 to 7 implemented on this branch. Request, status and one-time download routes (`/api/data-exports/assessment-transcripts`), service `assessmentTranscriptExports.ts`, Hatchet task `process-assessment-transcript-export` (event payload `{exportId}`) and hourly `sweep-assessment-transcript-exports`, dependency-free ZIP writer, per-student JSON (`formatVersion` 1), overview CSV, `viewer.html`, new query `assessmentExportChatbots` (course ADMIN) and the export dialog with chatbot choice and polling. The HTML transcript code is removed. Verified on the host: 48 unit tests across ZIP, builder, viewer (script run against a stub DOM), request schemas and service guards with a stubbed client. Not verified: typecheck of the service, routes, UI and Hatchet wiring (the host Prisma client and workspace types predate the schema), the database integration case, the Express route wiring, the browser flow and a real Hatchet run; these wait for CI or a working devcontainer. Known behavior: the archive is claimed and deleted before it is streamed, so a dropped download needs a new request; a closed dialog stops polling and the finished archive then expires after 7 days.
