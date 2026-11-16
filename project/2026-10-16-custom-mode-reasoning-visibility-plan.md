# Participant reasoning visibility for custom modes

## Approval summary

Participants currently receive the model's reasoning summary for every chat mode: it streams as a "Reasoning" block and stays in an expandable panel after reload. For a lecturer-authored custom mode, especially a role-play persona, the summary can paraphrase the hidden persona instructions and private scenario facts, and in a graded setting it gives students a hint channel.

Each custom mode gets a `showReasoning` choice. Absent or false hides reasoning from participants, so existing custom modes stop showing it once deployed. Lecturers opt in per mode in the existing custom-mode editor, and the opt-in goes through the existing save, submit and approve revision workflow. Standard modes (Tutor, Explainer, Quizzer) and legacy stored modes keep showing reasoning. The server enforces the choice for the participant stream, its finish metadata and the thread-history endpoint; hiding it only in the UI is not enough. The pending-turn dots still show that a reply is progressing.

Unchanged: reasoning effort and the provider request (`reasoningSummary: 'auto'` stays), model input (client history is text-only), server-side persistence of the summary, telemetry, and the owner preview, which always shows reasoning.

The main risks are a missed leak path and an accidental reveal through an omitted field. Route-level tests cover the stream, metadata and history paths, and a parser test covers omission, clearing and tolerant reads. Browser screenshots show the participant view during streaming and after reload.

Approval covers implementation, local verification, ordinary task-branch pushes and one draft PR into `v3-ai`. Deployment, changes to staging or production configuration, marking ready, merging and reviewer requests stay withheld.

## Execution details

### Contract and working context

- Approval mode: executable batch. The requesting session set the scope; the user ruled on 16 October 2026 that the control lives per custom mode and that an unset choice hides reasoning.
- Execution mode: solo; the main session owns implementation, end-of-package simplification and final review.
- Worktree `trees/chat-hide-participant-reasoning`, branch `fix/chat-hide-participant-reasoning`, base `origin/v3-ai` at `a12bd82605`.

### Product behavior

- `ChatbotCustomMode.showReasoning?: boolean` is stored only when true. On write, omission keeps the stored choice, `null` or `false` hides, and a non-boolean is rejected. On tolerant read, anything but an explicit `true` hides.
- `isParticipantReasoningVisible(customModeConfig, mode)` decides per turn from the live approved config: standard, legacy and unset modes show; an approved custom mode shows only when opted in; a `cm_` key that is no longer approved stays hidden.
- Participant chat route: `sendReasoning` follows the policy, and finish metadata returns `reasoningContent: null` when hidden.
- Thread-history route: when hidden, stored `reasoning` content parts and `reasoningContent` are dropped from the response. `reasoningEffort` remains because it is not reasoning text.
- Persistence: reasoning stays stored server-side, so a later opt-in reveals earlier turns and analytics keep their input. The history route reads the live config, so switching a mode to hidden also hides its earlier turns.
- Manage: a switch per custom mode in the editor, plus the choice in the setup summary and the publication review.

### Primitive impact

| Product primitive | Disposition | Contract delta | Consumers |
| --- | --- | --- | --- |
| Custom mode | extend | New `showReasoning` policy field; default hidden changes existing custom modes | Authoring editor, revision review, participant chat, history |
| Participant transcript | reuse | Reasoning parts omitted per mode policy | Chat stream, history reload |
| Owner preview | reuse | None | Preview route |
| Reasoning effort | reuse | None | Model selection, provider request |

### Test portfolio

| Risk | Obligation | Seam |
| --- | --- | --- |
| Stream or metadata leaks reasoning for a hidden mode | add new | Chat route harness (`account-usage-route.test.ts`) |
| History reload leaks stored reasoning | add new | `thread-messages-route.test.ts` |
| Owner preview loses reasoning | extend existing | `owner-preview-route.test.ts` |
| Omitted or malformed field reveals reasoning | add new | `chatbotCustomModeConfig.test.ts` |

### Verification

Package tests for util and chat, repository `check:all`, then browser screenshots of the participant view during streaming and after reload for a hidden custom mode, with a standard-mode control.

## Progress

- Status: implemented and verified on the task branch; final review found no blocking issue. Draft PR pending.
