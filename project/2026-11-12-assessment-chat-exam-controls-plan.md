# Assessment chat: exam conversation rules

## Approval summary

The course lead answered the exam conversation questions (2026-11-12). The assessment chat becomes a basic exam chatbot:

- Each student has one conversation per chatbot. It reopens after a reload or a new login.
- Students cannot edit a sent message, ask for a new answer, branch, start a second conversation, delete the conversation or attach files.
- After a broken or stopped answer, the student types the question again. The conversation stays one linear thread, and the broken answer is marked incomplete in the export.
- Invigilators announce the end; the lecturer export (#6878) runs right after. No automatic close.

All rules apply only in assessment mode (`CHAT_ASSESSMENT_MODE=true`). Like the assessment PWA, the regular chat refuses chatbots of assessment-enabled courses, and the assessment chat already refuses all others.

Approval mode: executable batch. Terminal condition: a third stack layer (draft PR on `enhance/assessment-chat-deploy`, added to native stack #6893) with server tests for every rule and local browser evidence, or a named blocker. Deployment and live chatbot configuration stay separately gated.

### Decisions

| Decision | Ruling |
| --- | --- |
| Where the rules apply | Assessment mode only. The regular chat refuses chatbots of courses with `isAssessmentEnabled` (user, 2026-11-12) |
| Attachments | Off in assessment mode (user, 2026-11-12) |
| Delivery | Third layer of stack #6893 (user, 2026-11-12) |
| Resend after a broken answer | The student retypes the message as a new turn. Retry buttons are hidden; the server refuses regeneration and sets the parent of every new turn itself |
| Enforcement | Server-side in every route; the UI only hides controls |

### Rulings on the open questions (user, 2026-11-12)

| Question | Ruling |
| --- | --- |
| Exam course | A separate exam course. The regular chat refusing assessment-course chatbots therefore removes no semester chatbot |
| Failed answers | In assessment mode keep a `FAILED` marker row even with lifecycle writes off, so the export marks the answer failed |
| Model history | In assessment mode the server builds the model history from the stored conversation |

## Execution details

### Authority

- User instructions (2026-11-12): apply the course lead's answers; rules only in assessment mode, assessment chatbots only on the assessment chat and vice versa; attachments off; third stack layer.
- Granted on approval: local implementation, local devcontainer runtime with synthetic data, local commits, pushes to the task branch, a draft PR stacked on #6888 and linked into stack #6893 with base `v3-ai` at the bottom.
- Withheld: merging, marking ready, deployment, live chatbot configuration, paid model calls.

### Current state (`enhance/assessment-chat-deploy`)

- Threads: `POST /api/chatbots/[chatbotId]/threads` and the chat route's no-`threadId` path both call `ThreadService.createThread` (`apps/chat/src/services/threads.ts:40`); `DELETE .../threads/[threadId]` deletes; `ChatThread` has no unique key on participant and chatbot.
- First load renders no thread; threads are created lazily on the first message, and nothing reopens an existing one.
- Chat route (`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`): the client supplies `parentId`, `sourceMessageId` (edit) and `allowRegeneration` (reload). `claimChatTurn` skips its sibling check when regeneration is allowed, which creates a branch. The failed and stopped callouts and the action bar retry through Reload.
- Attachments: `images` and `documentPages` request fields, plus document text inlined into the user message.
- `getChatbotOr404` (`apps/chat/src/lib/server/apiGuards.ts:381`) is the single participant gate; owner preview and export use their own owner checks.
- History returns only COMPLETED messages. A stopped answer is COMPLETED with a `chat-stopped` part; a failed answer stays FAILED.

### Test portfolio

| Risk or behavior | Obligation | Seam |
| --- | --- | --- |
| One thread per student and chatbot in assessment mode, including two concurrent creates; the existing thread is returned with `created: false` | add new | `ThreadService.createThread` unit test plus one case in the existing Postgres integration suite |
| An error path in the chat route never deletes a reused thread | add new | chat route test: existing thread plus forced MCP discovery failure |
| Delete is refused (409) in assessment mode; rename and regular mode unchanged; the first message's automatic rename shows no participation notice | add new | thread route test, `chatStore` test |
| Turns stay linear: normal second turn; retype after a failed answer with lifecycle writes on and off; retype after a refusal before the claim with a client-only parent id; stop then immediate send; edit, regeneration and reused user ids refused | add new | chat route tests asserting the stored parent chain, with `hasBranches === false` through the export orderer |
| Two tabs: a second turn while one is in progress gets 409; an abandoned in-progress row older than the bound does not block | add new | Postgres integration test |
| A failed save of the student's question fails the turn | add new | chat route test |
| Images and document pages refused in assessment mode | add new | chat route test |
| Regular mode refuses assessment-course chatbots; assessment mode keeps refusing the rest | extend existing | `assessment-mode.test.ts` gating tests |

### Slices

1. **Gate.** `getChatbotOr404` filters `isAssessmentEnabled: false` in regular mode. Update the gating tests. The PWA embed exchange still issues a session for an assessment-course chatbot; the drawer then shows not found. Record that in the PR.
2. **One conversation.** In assessment mode `ThreadService.createThread` takes `pg_advisory_xact_lock` on participant and chatbot inside its transaction, returns the oldest existing thread or creates the first, and reports `{ thread, created }`. The chat route records `createdThreadId` only when `created` is true and never discards a thread in assessment mode. Delete returns 409; rename stays allowed. The layout passes `assessment` to the client: on load the runtime loads the thread list and switches to the existing thread; when a create returns an existing thread the client switches to it instead of adding an empty entry; the sidebar, thread list and new-chat buttons are hidden.
3. **Linear turns.** In assessment mode, inside the `claimChatTurn` transaction, the server takes a thread-scoped advisory lock and returns 409 while the thread has an in-progress answer younger than the route's `maxDuration` plus a margin. It derives the tip as the newest leaf of the stored parent tree and uses it as the parent of the new user message, ignoring the client's `parentId`. It refuses `allowRegeneration`, `sourceMessageId` and a reused user message id (409). A failed save of the question fails the turn, as for e-learning threads. A failed answer leaves a `FAILED` row, and the model history is built from the stored path to the tip. Edit, reload, branch picker and the retry buttons of the failed and stopped callouts are hidden.
4. **No attachments.** In assessment mode the chat route refuses `images` and `documentPages`; the composer gets `maxImageAttachments={0}` and `allowDocumentAttachments={false}`. Pasted text stays allowed.
5. **Proof.** Local assessment chat with the mock model and `CHAT_TURN_LIFECYCLE_WRITES_ENABLED` as in production. Reload and a new login reopen the thread; a second tab cannot fork it or send in parallel; a stop and a forced failure (mock LiteLLM stopped mid-run) are followed by a retyped turn. With #6878 merged into a throwaway local branch, the export shows one linear thread with the broken answer marked. The regular chat refuses the assessment chatbot. Screenshots in the PR. If the mock cannot be made to fail, the failure case rests on the route tests and the gap is stated.

### Recovery

- If hiding a control needs changes in the shared assistant-ui primitives beyond props, keep the server refusal and report the visible control as a gap.
- If deriving the tip under the lock conflicts with the existing claim flow, stop slice 3 and report before changing `claimChatTurn` for regular mode.
- A review finding that changes the auth surface stops that slice for a decision.

### Separately gated (not in this batch)

- Exam chatbot setup: a new chatbot in a dedicated assessment course (no rehearsal threads), GPT-5.6 Sol, Tutor off.
- Load-harness reruns need a fresh fixture, because each virtual student may now hold only one thread.
- Reply to the course lead: confirm the rules, attachments off, and that an invigilator querying the chatbot for a student must use that student's session or the turns are not in the export.

## Progress

- 2026-11-12: plan drafted from the code map of the stack head. Independent critique returned CHANGES (15 items), all accepted: server-derived parent from the stored tree instead of the client's id, a thread-scoped lock with a 409 for parallel turns and an age bound for abandoned rows, no thread deletion on error paths, client switch to the reused thread, rename left allowed and 409 instead of 403, failed question saves fail the turn, history and failed-answer handling raised as decisions, document-text detection dropped, export proof through a local merge of #6878. User approved the batch with the three recommended rulings. Next: Slice 1.
- 2026-11-12: Slice 1 (gate) done: regular chat refuses assessment-course chatbots.
- 2026-11-12: Slice 2 (one conversation) done: locked create-or-reuse, no discard in assessment mode, delete 409, client reopens the thread, thread list and new-chat hidden. The sidebar stays for settings and credits.
- 2026-11-12: Slice 3 (linear turns) done: the claim stores the question under the server-derived tip, 409 for parallel turns, FAILED marker kept, history built from storage, edit, reload and branch controls hidden. Integration tests ran against local Postgres.
- 2026-11-12: Slice 4 (no attachments) done: route refuses images and document pages, composer attachments off. Next: Slice 5 (browser proof).
