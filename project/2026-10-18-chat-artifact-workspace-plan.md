# Chat artifact surface and code workspace

## Approval summary

Give learners an explicit way to open code and practice cards beside Chat, switch between opened cards and the knowledge graph, and return without losing their work. Narrow screens and embedded layouts use an accessible fullscreen view. Cards stay inline until opened; a streaming answer never opens the workspace or moves focus.

The host owns working code and restores it from tab session storage. A single mounted controller per card preserves execution and unsent practice answers when moving between views. The practice service retains submission, expiry and archive authority. Run output, unsent practice answers, opened-card lists and active views remain in page memory. There is no new editor dependency, server persistence, model-context projection or automatic sharing.

Approval starts an **executable batch**: two layers added on top of the open W2 stack in its existing worktree, implementation, synthetic local verification, configured reviews, ordinary task-branch pushes and draft PR delivery. W2 and W2b land together as one stack, only after the user approves the merge. Merging, marking ready, releases, deployment, infrastructure, shared-environment activation and paid model calls remain withheld.

Acceptance requires independently green layers, browser proof that movement preserves state and avoids duplicate submission, scoped code restoration, accessible fullscreen interaction, and a screenshot gallery. Independent tabs and app-owned `noopener` openings start fresh. External opener-created or duplicated tabs may copy drafts, and browser recovery can restore them; tab-session retention is not secure erasure. Real OLAT and physical-device qualification remain separate.

## Execution details

### Context, authority and prerequisites

- Roadmap: [browser coding exercises](2026-10-17-browser-coding-exercises-roadmap.md), Artifact surface and W2b. This plan preserves those decisions.
- Planning worktree: `trees/rs/coding-tutor-execution-plan`, branch `rs/coding-tutor-execution-plan`, roadmap baseline `db6a06b87bc26010caee31288dadb5ddc2e591e4`. Keep this draft uncommitted until approval. Preserve its unrelated stale untracked W2 plan.
- Source baseline: `75b643814d8098d9a99c91a5569523619cd3e9fc` in `trees/browser-code-playground`.
- Prerequisite stack: [runtime policy #6586](https://github.com/uzh-bf/klicker-uzh/pull/6586) → [playground #6587](https://github.com/uzh-bf/klicker-uzh/pull/6587) → [shared runner #6589](https://github.com/uzh-bf/klicker-uzh/pull/6589). These stay open and unmerged; W2b stacks on top of them (user ruling, 2026-10-19).
- Worktree: the W2 stack's existing `trees/browser-code-playground`, because one native stack must own one worktree. Target `v3-ai` through native stack #6588. Native stack support was confirmed through the GitHub stacks API on 2026-10-18.
- Execution mode: `standard` (exact main-model identity unavailable). Ceremony: full path. Boundary owner: main session. No existing W2b review is reused.
- Terminal: verified draft delivery with native integrated final review, available exact-head draft CI and feedback addressed. Keep both W2b PRs draft. Ready-only forge checks and the single final stack review over all five layers are deferred until the user marks W2b ready; this terminal is not merge readiness or deployment acceptance.

Before creating the execution branches, fetch, verify that the local W2 branches match their remotes, and branch layer 4 from the current W2 top `rs/browser-code-runner-package`. Compare its code to these source seams. W2 feedback corrections land in their introducing W2 layer and merge upward into the W2b layers; a changed contract returns for plan correction.

### Delivery topology

| Layer | Branch | Complete outcome | Incremental review focus |
| --- | --- | --- | --- |
| 4 | `rs/chat-code-workspace` | Code workspace, graph switcher, controlled editor and scoped restoration | Instance ownership, storage isolation and accessibility |
| 5 | `rs/chat-practice-workspace` | Practice joins the same surface with preserved answers and one submission owner | Practice lifecycle and integrated switching |

One topology writer and one worktree. Both kinds are required to finish W2b. Estimate 850–1,400 substantive lines overall, excluding tests and generated artifacts; use size as a diagnostic, not a target. The two layers become layers 4 and 5 of stack #6588. Each tip builds and verifies independently. Corrections belong in their introducing layer and propagate without unapproved force-pushes.

### Source evidence and primitive impact

References below are relative to the source baseline, and must be checked against the landed W2 implementation.

- `apps/chat/src/components/message-parts.tsx:275` supplies tool parts; `tool-fallback.tsx:171` drops `toolCallId`. Carry the existing identity through the rendering seam.
- `packages/code-runner/src/react.tsx:42` owns source, run phase, result and handle; cleanup stops execution. Controlled source alone cannot preserve runs across a remount.
- `packages/code-runner/src/bridge.ts:70` allows one active run per page. Preserve that contract.
- `student-practice-quiz-card.tsx:196` owns answer, timing, submission and archive state. Its submit handler at `:304` needs a synchronous in-flight guard. The shared answer hook initializes on mount; avoid changing it.
- `knowledge-graph/ChatKnowledgeGraphPanel.tsx:23` owns dialog/focus behavior and conditionally mounted graph content. Preserve graph state while sharing the shell.
- `assistant.tsx:606` and `:638` have separate sidebar and embedded layouts; ownership must sit above them. `owner-preview-assistant.tsx:343` has a separate runtime and memory-only conversations.
- Participant layout and preview page already resolve authenticated identity. Use these owners for local namespaces; never derive identity from stored credentials.
- `playwright/tests/Y-chat-code-card.spec.ts:393` expects reload loss; replace that obsolete assertion. Its WebKit nested-frame case uses the same origin and does not prove third-party LMS storage/authentication.

| Product concept | Disposition | Contract |
| --- | --- | --- |
| Conversation branch | Compose | Selected ancestry controls visible artifacts; returning can recover local edits |
| Working code | Extend local editing | Host-owned mutable source, tab-scoped restoration, no automatic transmission |
| Run evidence | Reuse | Browser-reported output stays local and distinct from edited source |
| Practice response | Reuse | Explicit submission, expiry and archive semantics stay authoritative |

The artifact surface is presentation composition, not a new durable product primitive. The first implementation commit adds **code workspace** and **working code** to `CONTEXT.md`. Update `docs/chat-platform.md` for local ownership, storage and preview limitations. Reference ADR 0052 for isolation; no new execution-trust ADR is needed unless implementation exposes a material new decision.

### Identity and visible behavior

Artifact identity is the completed tool call's `toolCallId`, namespaced by verified actor scope, chatbot and thread/conversation. Carry message ancestry separately. Participant, guest and preview scopes must not collide. A server-derived opaque scope key grants no authority and contains no credential.

Register only valid completed code/practice results. Preserve existing pending, invalid and failed states. Repeated registration is idempotent; a changed result under the same identity cannot silently replace edited code or reset answers.

Cards start inline. Explicit Open moves the single interactive instance into the workspace and leaves an inline chip. Closing returns the selected card inline. Switching to another card or graph restores the previous card inline while retaining its mounted state. The switcher lists the enabled graph in nonembedded layouts and previously opened artifacts, newest by creation order; reopening does not reorder entries. Lists and active selections stay in page memory. Preserve explicit graph entry behavior without adding the graph option to embedded Chat.

### Stable ownership and lifecycle

Use a page-owned provider above message and layout branches. It owns descriptors, scope, opened history, active view and working code. Each artifact has exactly one mounted controller. Keep a stable portal container and move that container between inline and workspace slots; changing a portal target and remounting its subtree does not satisfy preservation. When a branch is absent, park its retained content outside focus and accessibility navigation. Strict Mode cleanup and tool-group disclosure must not discard or duplicate it.

Preserve editor selection/scroll, runner handle/phase/output, practice answers/timing/pending submission/archive disclosure, and graph viewport/filter/selection state. Switching, closing, resizing or changing branches does not cancel runs. Explicit Stop/Reset, another Run, owner invalidation, deletion and page teardown keep their existing disposal semantics. An old run's output must not be relabelled as belonging to newer edited code.

On branch change, hide artifacts outside selected ancestry and close an absent active view; keep local state for explicit reopening on return. Thread changes close the active workspace and use a separate namespace. Successful thread deletion clears that thread's entries and persisted code through the existing deletion path; failed deletion preserves them. Owner/access invalidation disposes the previous scope and stops its runners before the next scope renders.

Owner preview uses the same presentation. Its memory-only conversation IDs can be reused after reload, so add a page-generation namespace and do not attach stale drafts to new preview calls. State the limitation: preview history is unavailable after reload. Preview gains no participant practice authorization.

### Working code and storage

Make `CodeRunner` controlled with source and change callback; Reset calls the callback with the starter. Its mounted instance continues to own execution state. Preserve the textarea, code bound, browser qualification and effective mode admission. Historical code cards remain editable/runnable when admitted.

Persist only working code in a versioned envelope scoped to the verified owner, chatbot, conversation, tool call, profile and starter identity. Validate before restoring. Do not write initial starter state over a saved edit while hydration is pending. Persist neither results, tool payloads, run handles, practice answers nor workspace navigation.

Catch storage read/write, parse, quota and policy errors. Fall back to page memory with a visible reload-loss notice; never evict edited entries silently or clear unrelated storage. Reload restores matching code, leaves the workspace closed and does not rerun code. Notices distinguish tab-saved code, memory fallback, volatile results/answers and preview-history limits.

Session storage can be copied into an opener-created tab. Independent tabs and verified app-owned `noopener` openings start from the starter. External opener-created tabs and browser Duplicate Tab may copy drafts; preserve that copy rather than deleting legitimate same-tab work. This qualifies the roadmap's universal new-tab wording and is explicit in the approval request. Reload, same-tab full navigation away and return, and embedded-frame recreation restore matching scoped code where the browser retains the storage partition.

Never clear drafts merely because a new document loaded. Neither `window.opener`, navigation type nor a session-storage marker proves tab freshness. Browser restore-closed-tab and session recovery may recover state. Namespace cleanup removes application entries, without promising irreversible or cryptographic erasure. Do not add local storage, server tab registries or cross-tab broadcasts. Validate these browser distinctions with synthetic fixtures; failure blocks the corresponding claim.

### Practice and accessibility

Keep one practice controller and the existing server API. Preserve supported answer types, response construction, timing, feedback and archive behavior. Add a synchronous in-flight guard and check current expiry at activation. Moving during submission causes no second request, automatic retry or cancellation. Failure preserves the answer for explicit retry; do not claim exactly-once processing across uncertain transport outcomes. Expired and missing-expiry history stays locked; opening never refreshes a question reference.

Desktop is a labelled complementary region. Narrow and embedded Open uses a labelled fullscreen dialog, back-to-chat control, contained focus, inert background, Escape and focus restoration. Reuse the graph's accessible pattern in one shell. Explicit Open may move focus; streaming registration never does. Restore focus to the launcher chip or a stable conversation control when it disappeared. Graph Ask continues to fill the composer without sending.

### Feature-wide test portfolio

| Independent risk | Obligation | Primary seam | Failure detected |
| --- | --- | --- | --- |
| Wrong identity, ancestry or storage restoration | Add new | `apps/chat/test/artifact-workspace-state.test.ts` | Cross-owner/thread collisions, stale envelopes, non-idempotent registration, storage failure |
| Movement remounts state or duplicates controls | Extend existing | `Y-chat-code-card.spec.ts` | Lost edits/runs/answers during open/switch/close/resize/branch changes |
| Reload and fresh tabs contradict the lifetime contract | Replace/consolidate | Replace current reload-loss case in the same spec | Hydration overwrite, same-tab loss, copied-opener misclassification, preview collision |
| Practice submits twice or bypasses expiry | Extend existing | Workspace scenarios in code-card browser spec; reuse adapter tests | Repeated activation during delayed response, hidden-card expiry |
| Graph/focus regressions | Extend existing | `Y-chat-knowledge-graph.spec.ts` | Lost graph state, broken Ask, focus escape/restore, streaming focus movement |
| Automatic code disclosure | Extend existing | Synthetic edited marker plus unrelated message request interception | Local edits enter outgoing message/model context |
| Runner isolation and limits | None new | Existing package/manifest/protocol tests and real-run browser cases | Reuse W2 coverage against the controlled runner |
| Prose, glossary, translations | None | Formatting, locale review and screenshots | No wording snapshots or content-count tests |

### Ownership and slices

Main owns topology, cross-surface identity/lifecycle decisions and final proof. One executor may own each settled follow-up interval; no concurrent writers operate this stack.

| Slice | Owner/route | Dependency and acceptance |
| --- | --- | --- |
| S1 — open code without losing state | Main; critical-path coupling | W2 landing + human approval; single mounted controller survives movement and graph switching |
| S2 — restore and isolate working code | Executor | S1 interface settled; scoped restore/fallback/deletion and preview tests |
| S3 — move live practice safely | Executor | Independently verified layer 4; answer retention and one in-flight submit |
| S4 — integrated delivery | Main; integration/external-effects owner | All portfolio rows, reviews, gallery and exact-head CI |

**S1, layer 4.** Add `apps/chat/src/components/artifact-workspace.tsx` (provider, stable placement, anchor and switcher) and `artifact-workspace-state.ts` (scope, registration, selection and storage transitions). These are the only new implementation modules. Extend `CONTEXT.md`; `apps/chat/src/components/{assistant,tool-fallback,code-card,owner-preview-assistant}.tsx`; `components/knowledge-graph/ChatKnowledgeGraphPanel.tsx`; `packages/code-runner/src/react.tsx`; `packages/i18n/messages/{en,de}.ts`; the existing code-card and graph Playwright specs. Deliver controlled code, Open/chip/close, graph switching, fullscreen and preview layout as one working path. Add the glossary in the first implementation commit. Verify edit/run/move/return/close and breakpoint transitions with one editor/controller. Stop for duplicate-mount design or new runtime/editor dependency. Commit: `enhance(chat): open code in a shared workspace`.

**S2, layer 4.** Extend S1 modules plus `apps/chat/src/app/[chatbotId]/layout.tsx`, `app/preview/[chatbotId]/page.tsx`, `src/stores/chatStore.ts`, existing host components, locales, `docs/chat-platform.md` and code-card browser spec. Add the single named state-test file. Wire owner scope, branch visibility, restoration, successful-deletion cleanup, preview generation and notices. Check matching reload, independent/noopener tabs, copied opener state, same-tab navigation/return, frame recreation, reused call IDs, owner/guest/preview separation, malformed/quota-denied storage and branch return. Stop if a new auth endpoint or authorization contract is needed. Commit: `enhance(chat): preserve working code within its tab`. Verify complete layer 4 before starting layer 5.

**S3, layer 5.** Extend `student-practice-quiz-card.tsx`, `tool-fallback.tsx`, workspace modules, locales, docs and code-card spec. Preserve the mounted practice controller and add the bounded submission/expiry guards. Test choice and free-text retention, delayed submit with movement/repeated activation, hidden expiry, stale server reply, feedback and explicit retry. Stop for API/schema/grading changes. Commit: `enhance(chat): open practice in the shared workspace`.

**S4, both layers.** Complete verification and layer-specific corrections in named files. `playwright/util/chat.ts` may be extended only for a missing synthetic stream/branch fixture. No separate tests-only layer. Run simplification and risk review on committed substantive slices, then native integrated final review. Write per-layer descriptions and gallery; ordinary pushes and verified draft PRs complete this batch. Forge final-stack review rejects drafts and belongs to a separately authorized readiness step. Keep unrelated W2 changes out of W2b.

### Verification and completion

Use the repository's installed checks, host forge CLI and host Playwright launcher. Container-dependent checks run through `devrouter exec <worktree> --`; start only the required local profile under the runtime lifecycle skill. No paid model calls: use synthetic fixtures and mocked streams.

- Package `@klicker-uzh/code-runner`: check and its declared tests.
- Chat: check, focused tests then relevant full suite, production build, and required repository precommit checks.
- Host: existing `pnpm playwright:host --` wrapper with code-card and graph specs; use the release matrix for WebKit/Firefox. Reuse unchanged isolation evidence; rerun affected real execution cases.

| Environment | Required evidence |
| --- | --- |
| Chromium/WebKit desktop | Python/R execution, movement during run, historical card, graph/branch return, reload/fallback/independent-noopener tabs/copied opener state/same-tab return |
| Narrow Chromium/WebKit | Inline default, fullscreen, keyboard, back/Escape, focused editor and breakpoint transitions |
| Synthetic nested frame, both engines | Host-frame storage/fallback plus isolated runner; no embedded graph switcher |
| Firefox | Workspace editing/storage and practice; execution unavailable with no runner |
| Preview and assistive technology | Same layout, isolated preview generations; keyboard and screen-reader switcher/dialog/focus behavior |

Check availability of the W1 temporary harness before reuse. Same-origin WebKit evidence stays labelled as such; a local third-party frame needs a supported synthetic auth route or a recorded limitation. No claim of real OLAT, physical-device or secure-erasure qualification follows. Missing required browser or screen-reader evidence blocks completed verification.

Capture relevant EN/DE desktop split, narrow and embedded fullscreen, code output, practice pending/submitted/archived, storage fallback and preview. Use `rs-build-screenshot-gallery` for provenance/inspection and `rs-mr-description-writer` for each layer's screenshot table. Source-only verification and CI remain distinct from deployment.

After the final runtime-dependent check, stop the exact workspace and verify provider state and routes. Keep both W2b PRs draft and check the available draft CI at each exact tip. Native integrated review is required for this delivery. Record forge final-stack review and other ready-only checks as pending until the user marks W2b ready; one `/final-review-stack` then covers all five layers, and the whole stack lands only on the user's merge approval. No merge-ready claim, merge, release or enablement follows automatically.

## Progress

- 2026-10-18: Draft derived during takeover. Read-only planner constructed source-grounded recommendations at W2 source `75b643814d`; main retained the lifecycle, opener-cloning and preview limitations. W2 follow-up fixes remain in their own stack. No W2b execution, new worktree, branch, commit, push or PR has begun.
- Planner hardening round 1: REVISE. Both findings accepted: distinguish verified draft delivery from ready-only forge review, and preserve same-tab storage while disclosing copied-tab exceptions. Correction round pending. Next: planner challenge and main disposition, then present the plan for conditional execution approval.

- Main accepted planner storage correction: no navigation-based clearing; qualify fresh-tab guarantee for independent and app-owned noopener tabs. External copying and browser recovery remain disclosed limitations requiring approval of this plan. Official storage behavior checked against [MDN sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage).

- Planner hardening round 2: APPROVED at SHA256 `404ca924333ce1fc752252b7427cf5173d4dde8f8c72ed126e409738d8ed3368` before this progress-only entry. Report: `project/_local/reviews/2026-10-18-chat-artifact-workspace-plan-hardening.md`.
- 2026-10-18: User approved conditional execution of this reviewed plan, including its two-layer draft stack and tab-copying limitation. W2 landing in `v3-ai` remains the prerequisite. Merge, deployment and shared activation remain withheld. No W2b implementation has started; resume from the landed capabilities without requesting the same approval again.
- 2026-10-19: User ruling: do not land W2 on its own. W2 plus W2b is the done boundary; W2b becomes layers 4 and 5 of stack #6588 in `trees/browser-code-playground`, one final stack review runs at the end, and nothing merges until the user approves. This supersedes the W2-landing prerequisite and the separate `trees/chat-artifact-workspace` worktree. No new planner pass: the change is a user-ruled topology and authority amendment, and the product design is unchanged.
- 2026-10-19: S2 deviation: owner preview stays memory-only with no storage, and its code cards state that preview edits are lost on reload. This replaces the page-generation namespace; the learner-visible behaviour is equivalent. Participant scope is a server-derived opaque key passed from the chatbot layout.
- 2026-10-19: S2 reviews. Simplifier: no change. Risk review: nothing blocking. A browser test now covers closing the workspace when its branch is hidden and restoring the edit on return (all three engines). Synthetic Chromium and WebKit evidence confirms: a `noopener` tab starts from the starter, an opener-created tab copies the draft, same-tab navigation away and back restores it, and a recreated same-origin Chat frame restores it. Deviation: the storage envelope keeps the full starter code as its identity. That code is already shown in the same conversation, tab and origin; a digest would add a hash without changing who can read the entry. Entries of a previous owner stay in tab storage after a same-tab owner switch but cannot be restored by the new owner, consistent with the disclosed "removal is not erasure" limit. The code-card note now says changes stay in the tab only when tab saving works.
- 2026-10-19: Integrated final review over both W2b layers: nothing blocking; four findings accepted. Added a browser test that edited code never reaches the next chat request, and a 390px test for the fullscreen dialog (modal, Escape, back to chat, focus restored). Registration is now stable across scope changes, so the previous thread's anchors cannot re-register into the new scope. The docs no longer call working code "drafts". Still open: no screen-reader pass has been run; the plan names it as required evidence before verification counts as complete.
