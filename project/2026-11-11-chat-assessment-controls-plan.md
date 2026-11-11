# Chat assessment readiness: lecturer export and load harness

## Approval summary

Prepare the existing chatbot for a 30-minute in-class exam with about 100 students and human grading. This batch builds the two pieces that do not depend on the course lead's pending conversation rules: a lecturer download of stored chatbot conversations and a no-cost load harness for 100 synthetic students. It also verifies, locally, that the existing assessment login reaches the chat through the existing embedded chatbot entry.

Conversation-history restrictions (one conversation, no edit/regenerate/branch, delete) and a per-chatbot attachment switch wait for the course lead's answers. They need one schema field and will follow as a separate package. Exam configuration of the production chatbot uses existing settings and is a separately approved live action.

Approval mode: executable batch. Terminal condition: two draft PRs into `v3-ai` with local verification evidence, or a named blocker.

## Execution details

### Authority

- User instruction (2026-11-11): continue with the proposed work while waiting for the course lead — read-only inventory, exam access with the fixed setup, lecturer export and the no-cost load harness, delivered as a draft PR.
- Granted: local implementation, local devcontainer runtime, synthetic data, local commits, pushes to task branches, draft PRs into `v3-ai`.
- Withheld: merging, marking ready, live chatbot configuration, deployment, staging or production load runs, paid model calls, messages to people.

### Base and target

Production chat images are tagged from `v3-ai` (`deploy/env-uzh-prd/values.yaml` on `v3` pins `v3.4.0-alpha.92`, which contains the participant reasoning switch). Recent chat PRs merge into `v3-ai`. This work is therefore based on `origin/v3-ai` (`8d116a1a25`) and targets `v3-ai`, not `v3`.

### Inventory results (2026-11-11, `origin/v3-ai`)

Existing settings already cover most of the exam setup, enforced server-side:

| Need | Existing control |
| --- | --- |
| Hide participant reasoning | Custom mode `showReasoning: false` filters the live stream and stored history. Standard modes always show reasoning, so the exam uses one custom mode. Reasoning is still computed and stored. |
| Fixed model and effort | `modelSelection: false`, one `allowedModelIds` entry, one effort per model in `allowedReasoningEffortsByModel` |
| No answer style/tone | `answerPreferencesEnabled: false` |
| No knowledge map | `knowledgeGraphVisible` / `knowledgeGraphRetrievalEnabled` off |
| No tools | Remove MCP bindings for the exam modes; calculator tool is mode-driven |
| Exam notice | `disclaimerId` (server returns 403 until accepted) |
| End of exam | Unpublishing the chatbot returns 404 to participants; threads remain stored |

Gaps that need code: per-chatbot attachment switch, server-side refusal of edit/regenerate/branch, thread create/delete limits. All wait for the course lead.

Access: the assessment build signs participant sessions into `next-auth.participant-session-token`, which the chat proxy does not read. The assessment PWA's chatbot page with `embed=true` reads that cookie, mints a short-lived exchange token with the shared `APP_SECRET`, and the chat's `/auth/pwa-embed` route checks course participation and issues a chatbot-scoped session. This existing bridge should give assessment students chat access without any auth change. Slice 1 verifies it locally.

### Test portfolio

| Risk or behavior | Obligation | Seam | Existing protection |
| --- | --- | --- | --- |
| Assessment session reaches chat through the embed bridge | none if it works; extend existing bridge test if a fix is needed | `auth/pwa-embed` route test | embed bridge unit tests |
| Only the chatbot owner can export | add new | export route handler test | none |
| Export omits reasoning (column and content parts) and prompt bodies | add new | serializer unit test | thread-markdown strips reasoning client-side |
| Export marks branches, incomplete answers and roster gaps instead of silently selecting | add new | serializer unit test with synthetic threads | none |
| CSV/HTML injection in student text | add new | serializer unit test | none in chat |
| Load harness cannot reach production or paid models by default | none | startup self-check in the script | `chatbot-turn.js` side-effect guards |

### Slices

**Slice 1 — Assessment entry to chat (rides in PR A).** Fix the production assessment PWA env: `apps/frontend-pwa/.env.assessment.prd` sets `NEXT_PUBLIC_CHAT_URL=$APP_ORIGIN_CHAT` but never defines `APP_ORIGIN_CHAT`, so the chatbot page redirects to `/error`. Add the missing origin line. Then reproduce locally:
- Start the devcontainer with the `eduid` profile and run `seed:local-eduid-link` (`.devcontainer/README.md`).
- Run the PWA with the assessment env (`ASSESSMENT_MODE=true` and the assessment chat-URL setting).
- Prepare an assessment-enabled course with an accepted invitation and a published chatbot.
- Open `/course/<id>/chatbot/<id>?embed=true`, send one turn and reload the history.
- Re-enter through the course link after clearing the chat cookies, and record the re-entry procedure. The chat's no-login page links to the regular PWA, not to the assessment build.
- Confirm that a non-participant is refused.

If the bridge fails beyond configuration, record the exact failure and stop this slice: an auth change needs its own approval. A pre-exam deployment check (not this batch) must confirm the deployed assessment PWA sets `ASSESSMENT_MODE=true` at server runtime. It is not in `cm-frontend-assessment.yaml` and may live in its secret. Evidence: browser screenshots in PR A.

**Slice 2 — Lecturer conversation export (PR A).** Add an owner-only download to the existing chatbot details page in frontend-manage. The server route sits under the chat app's existing `/api/manage/chatbots/[chatbotId]/` routes. It reuses `getOwnerPreviewAccess` (same login-scope rule) but also allows `PAUSED` chatbots, so export survives an operator stop. Three separate downloads (no ZIP library exists, no new dependency):
- `index.csv`: one row per invited or participating student, reconciled against invitations and participations. It has identity (assessment name and matriculation number where captured, otherwise email or SSO ID, with missing identity marked), thread count, message count, first and last message time, attachment count, and status (`no conversation`, `one`, `several`, `incomplete answer`). Incomplete comes from message `lifecycleStatus` `IN_PROGRESS` or `FAILED`.
- `transcripts.html`: one self-contained, escaped page with an index and each thread. Messages are ordered along the `parentId` tree, with sibling branches labelled. Attachments are listed by name, not embedded.
- `conversations.json`: the same content in structured form.
- Header in each file: chatbot, course, optional time window, export timestamp, an explicit `createdAt <= exportedAt` cutoff, and the note that deleted threads are not recoverable.

Reasoning is excluded with the existing `withoutReasoningParts` plus dropping `reasoningContent`; tool internals and prompt bodies are excluded. A small CSV escaper keeps the formula-prefix guard and quoting from `packages/export/src/csv.ts`. Verification: serializer tests with synthetic threads, a route authorization test, and a browser download on the local stack.

**Slice 3 — No-cost load harness (PR B).** Start with a timeboxed prototype (30 minutes) of the model route. LiteLLM's local config is a shared read-only mount, so use a separate load-test config or compose override, not `util/litellm/config.yaml`. Test whether LiteLLM `mock_response` streams on the Responses API. If not, add a `CHAT_MODEL_REGISTRY_JSON` entry with `usesResponsesApi: false`, keeping the base fallback model valid. Add an artificial latency so streams stay open; otherwise report that concurrency is understated. If neither route works without chat code, stop and report. A chat-side fixture provider needs its own approval.
- **Seeder:** 100–125 synthetic participants in one course, with participations, accepted disclaimers and enough owner usage headroom. It reuses the marked-database guard in `packages/prisma-data`.
- **Authentication:** each virtual student gets its own embed session token minted with the dev `APP_SECRET`. This is the exam's actual transport, and it keeps Edu-ID out of the load.
- **k6 scenario:** one request per student every 45 seconds, at most 40 per student, no overlap, synchronized start, plus refresh and history reload. It records scheduled, admitted, late, missed and failed requests, first-text latency and full-response latency.
- **Targets:** local by default, with a startup self-check that refuses staging and production unless explicit flags are set. Remote runs stay unauthorized in this batch.

Files: `util/load-test/` script and README, a seeder script, and a local LiteLLM override.

### Topology

Two independent ordinary PRs into `v3-ai`: PR A (export) and PR B (load harness). They share no files, so no stack. This plan rides in PR A. The later exam-controls package (history lock, attachment switch, one migration) is a separate PR after the course lead answers.

### Recovery

- Bridge fails: report and continue with slices 2 and 3.
- The LiteLLM mock cannot be routed: deliver the seeder and k6 scenario, and report the fixture decision.
- A review finding changes the auth surface: stop that slice and ask.

## Progress

- 2026-11-11: inventory complete; base switched to `v3-ai` on evidence. Council critique returned CHANGES (10 corrections). All are accepted and folded in: the assessment chat-URL fix, the local assessment repro and re-entry check, owner auth reuse with `PAUSED` allowed, separate downloads, roster against invitations, lifecycle and branch handling, a timeboxed model-route prototype, and per-student embed tokens. The `ASSESSMENT_MODE` deployment check is recorded as a pre-exam item. Next: commit the plan, then Slice 1.
