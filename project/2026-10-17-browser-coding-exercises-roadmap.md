# Browser coding practice and generated exercises

## Approval summary

Give learners an editable Python or R exercise inside Chat: run locally, inspect the result, then explicitly ask their configured assistant for feedback. Build a useful playground first, qualify authored exercises next, and add AI generation after the exercise contract works. Generated exercises include a task, starter, rubric, reference solution and tests, validated in their declared browser runtime before use.

Start with **W1 — browser runtime qualification**: synthetic proof for both languages, isolation, package compatibility and iframe behaviour. The first product uses native Chat cards. MCP Apps is a later portability adapter; CodeAPI is an explicit later option for unsupported workloads. The earliest useful pilot uses authored exercises, avoiding a dependency on generation quality.

This is **direction-only planning**, not an approved executable batch. Planning covers local documents and review. A later execution approval names finite work items and delivery layers. Commits, publication, merges, releases, infrastructure, deployment and learner activation remain withheld.

Success is an observable edit → run → selected evidence → feedback loop, followed by validated, frozen exercises. Browser results remain learner-controlled evidence, not trusted grades. Material gates cover personal-data processing, study exposure, funded feedback/generation and server execution. Fake-provider source proof does not qualify real-model feedback. Real OLAT compatibility needs separately authorized live proof. Capabilities preserve configured teaching conditions; adding them carries no promise of adoption or learning impact.

## Identity and working context

- Date: 2026-10-17. Audience: a human approving direction, then an execution owner working without this conversation.
- Repository: `uzh-bf/klicker-uzh`. Planning branch: `rs/coding-tutor-execution-plan`; worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/coding-tutor-execution-plan`. No roadmap PR.
- Parent: [server-execution plan](2026-10-17-coding-tutor-execution-plan.md). This roadmap supersedes its proposed learner execution sequence. Its server controls remain background for **W7 — explicit server execution**, subject to fresh qualification.
- Source baselines: `origin/v3` = `0f222786e86c625c7bfbff594a952de770d15ac5`; `origin/v3-ai` = `30dd39c6528c686b221bb040285c55149addd5ee`. Source presence is not deployment evidence.
- Target: `v3-ai` for **W2 — local editable playground** through **W5 — controlled pilot qualification**, by user ruling of 2026-10-17 after the W1 receipt. These items are ordinary PRs into `v3-ai`, which holds the required capability, guard and card seams; `v3` changes reach it through the automated sync, and production releases are tagged from `v3-ai`, so a merge there reaches production with the next release (corrected 2026-10-18). Later items confirm their base at start. Do not backport seams to `v3` or cherry-pick around a promotion hop.

Execution mode is `standard`: main runtime model identity is unknown. Main session owns synthesis and security decisions. No roadmap-orchestrator assignment exists. Reuse this planning worktree. Future approved packages use purpose-named `rs/` branches and repository-local `trees/` worktrees, reusing matching owners where present. One stack occupies one worktree with one topology/application writer. Independent research and review may run in parallel. Each item derives its own sliced-development plan; this roadmap does not prewrite its slices.

## Verified source and prior art

Evidence is pinned above; refresh moving prerequisites at execution.

| Finding | Evidence and implication |
| --- | --- |
| Native interactive cards exist. | `v3-ai:apps/chat/src/components/message-parts.tsx:278` renders registered tool UI or fallback. `components/student-practice-quiz-card.tsx:137-189` supports existing answer types, not code. Reuse the presentation seam. |
| Practice routing is Tutor-only and target-dependent. | `v3-ai:apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:1327,1368` gates discovery/registration on `tutor`. The practice adapter/card are absent from inspected `v3`. Preserve custom personas instead of switching modes to obtain tools. |
| Cards do not establish model follow-up context. | `v3-ai:apps/chat/src/hooks/useChatResponse.ts:123-146` serializes text. **W3 — selected run feedback** needs an explicit owned-evidence projection. |
| Ownership/ancestry already have seams. | `v3-ai:packages/prisma/src/prisma/schema/chat.prisma:111-160` owns threads by participant/chatbot and stores message parents/content. `apps/chat/src/services/threads.ts:164-176` deletes owned threads. Extend this lifecycle rather than create another conversation store. |
| Identity/history readiness is a prerequisite. | `v3-ai:apps/chat/src/lib/server/apiGuards.ts:210-291` checks active account, issuer, algorithm, expiry and role. [PR 5676 — server-authoritative history](https://github.com/uzh-bf/klicker-uzh/pull/5676) is open against `v3`, head `0bf19a28a673758cc193f09d4dca704c3caf2a0c`; open is not merged acceptance. |
| Browser coding and bundle contracts are absent in inspected scope. | `v3-ai:packages/prisma/src/prisma/schema/element.prisma:9-19` has no CODE type. Searches of `apps/chat/src` and its manifest found no Pyodide, webR or MCP Apps host wiring. This is a bounded absence claim. |
| Adjacent drafts are not completed dependencies. | [PR 5483 — retrieval-backed practice cards](https://github.com/uzh-bf/klicker-uzh/pull/5483), head `678b8be86e34cf3cea92e57cf09e3beee0607a58`, is draft on a practice branch. [PR 5142 — CODE questions and asynchronous grading](https://github.com/uzh-bf/klicker-uzh/pull/5142), head `ca4e14ae4e0812cd1bcf086c9888b9bc4ec02082`, is draft against `v3`. Reuse selectively; do not import formal grading. |

Read [Chat platform](../docs/chat-platform.md). Inspect historical `project/plans_future/PLAN-chat-code-execution-tool.md` on the CODE branch and `/Users/rschlae/Git/klicker/klicker-uzh/trees/chat-codeapi-roadmap/project/2026-08-23-klicker-chat-codeapi-roadmap.md`. The latter covers model-triggered server execution; coordinate its writer, without inheriting old runtime claims or its orchestration assignment. Student-MCP response persistence was outside this inventory. No deployment or production-data investigation was performed for this roadmap.

## Binding decisions — do not re-litigate

These combine user direction and routine design rulings. A material departure returns to the user before dependent implementation.

1. **Browser first.** Pyodide for Python and webR for R, each qualified independently. Run calls neither a model nor CodeAPI. Unsupported packages show a limitation; no automatic backend fallback. Native Chat UI precedes MCP Apps. Firefox shows local execution as unavailable until a re-qualified Firefox closes its worker CSP gaps (user ruling, 2026-10-17); no Firefox server fallback or accepted egress risk.
2. **Formative practice.** Tests provide correctness observations; rubrics guide feedback. Browser tests/reference/results are inspectable and forgeable. No grades, points, gradebook writes, hidden-test promise or participant classification.
3. **Frozen exercise.** Objective, task, language, starter, input/output contract, rubric, tests, reference, validation fixtures, sources, provenance and runtime-profile hash share one version identity. Attempts bind that version. Repairs create a new draft/version.
4. **Preserve teaching conditions.** Shared capability/evidence plumbing must retain configured persona, hint and solution-disclosure policy. Neutral names remain neutral. Exposure changes require **A2 — study rollout policy**.
5. **Local by default.** Working code and runs stay on the learner's device, with no autosave to the server, keystroke upload or source/output telemetry. Working code may persist in the browser tab's session storage, so it survives a reload and ends when the tab closes (user ruling, 2026-10-18). Keeping it longer on the device waits on **A1 — learner-data processing**. An explicit feedback action previews and shares one immutable snapshot. Runtime observations and model interpretation remain distinguishable.

### Primitive impact

| Product primitive | Disposition | Owner, delta and composition |
| --- | --- | --- |
| Chatbot mode capability | Extend | Platform/lecturer policy admits actions and qualified profiles; learners cannot expand privileges. Composes with custom personas, onboarding and tool registration. Evidence: existing effective-mode policy and chat route. |
| Conversation branch | Extend | Existing participant/thread ownership governs shared evidence, ancestry, deletion/export. Sibling branches grant no implicit scope. Evidence: `chat.prisma` and history prerequisite. |
| Exercise | Create | Chat-scoped formative record with immutable versions and validation state; distinct from a mutable draft or assessment element. Bank adoption waits for a concrete second consumer. |
| Code attempt | Create | Learner-owned immutable source snapshot and run records. Edits create another attempt; shared records inherit conversation lifecycle. Used by playground, tests and feedback. |
| Run evidence | Create | One run's profile/source hash/status/bounded output. Host-controlled provenance distinguishes browser-reported and server-verified execution. Neither an assistant claim nor an authoritative score. |

Rubrics/tests belong to exercise versions. Editors, workers and MCP envelopes are delivery mechanisms, not additional product primitives. Artifacts are a delivery surface over these primitives and the existing practice response; see **Artifact surface**.

## Shared contracts

### Runtime and bridge

Use a credential-free isolated execution context outside application session-cookie scope, or an experimentally verified equivalent. A same-origin worker alone is insufficient. Pass code and synthetic exercise data, never credentials, MCP access, conversation history or arbitrary host callbacks. Validate bridge source/origin or dedicated port, protocol version, shape, size, attempt ID and generation; ignore unsolicited/stale messages.

Pin self-hosted runtime assets and finite package manifests by hash. Qualification must prove no program-controlled data egress, including fetch/XHR/WebSocket, navigation and attacker-controlled URLs to the asset host. Asset loading is restricted bootstrap, not general networking. The primary candidate is an opaque-origin sandboxed frame with no application credentials and a terminable worker. Evaluate prefetched immutable assets or a manifest-bound broker accepting fixed asset IDs only, with worker-level CSP denying arbitrary networking; prove loader compatibility rather than prescribing a speculative CSP recipe. Check document and worker policy separately, cookie-domain reach, credentials on asset requests, unexpected browser APIs and requests carrying arbitrary query/path/body values. If isolation cannot enforce this, stop adapter adoption and return a concrete alternative or explicit risk decision. Replacing `fetch` in JavaScript is not a security boundary. Do not silently relax this contract to credential-only egress denial.

Use clean interpreter state per run, one active run per card and finite code/output/message/wall-time/artifact bounds. Stop/timeout destroys the worker and execution context; reset creates another. Late results cannot overwrite newer attempts. Browser CPU/memory controls have residual limits: report observed recovery without promising hard OS memory isolation. Initial output is escaped text; plots/files/HTML are later format expansions.

### Evidence and feedback

Snapshot exact source/hash, language/profile hash, optional exercise version, run ID, status and capped stdout/stderr/test observations. Unknown, stopped, timed out and failed remain distinct. User code cannot elevate the host-assigned provenance label.

Sharing requires explicit preview/confirmation, account and bot access, owned thread and validated selected ancestry. Persist an immutable snapshot, then construct bounded model context from the owned record. Retry is idempotent; changed replay payload conflicts. Authenticated browser claims remain `browser-reported`, since the learner controls the client. Initial sharing is account-only; preserve ordinary guest chat and permitted local playground access. Guest persistence requires **A1 — learner-data processing**.

Treat code/output/tests/references as untrusted data, unable to alter policy, tool permissions, recipients or runtime. Feedback reports evidence, criteria and a next step, admits missing evidence and follows the configured persona. Generic code feedback can precede exercises; rubric feedback requires a frozen bundle. Never invent test results.

Deletion immediately removes evidence from authorized reads and future projection. Physical erasure, exports, caches, backups and third-party traces require a deletion/expiry design before real data. No raw code, output, prompts, filenames or run bodies in logs.

### Artifact surface

"Artifact" is the engineering name for a presentation contract, not a product primitive. Learners see each kind's own name, such as "Code" or "Practice". The kinds are the code exercise, the live practice quiz card, the planned candidate element and, later, media such as audio. Each kind keeps its own durable record: a code attempt at share, a practice response at submit, a personal element at save.

- **Identity.** An assistant tool call in a thread creates the artifact. Its ID is that call's `toolCallId`.
- **Anchor.** The inline card stays in the thread as the record and fallback. An explicit "Open" shows it in the right-hand area and leaves a chip inline. A new artifact never opens by itself or moves focus.
- **Right-hand area.** One area shows one view at a time and is shared with the knowledge-graph panel. A header switcher lists the graph, where it is enabled and the layout is not embedded, and the artifacts opened in this thread, newest first. Switching keeps each view's state, and closing returns to chat only. The opened list and the active view live in page memory.
- **Narrow screens and embedded LMS.** The code and practice cards stay inline by default, with a fullscreen takeover and a back-to-chat control. Fullscreen follows the graph panel's accessible dialog pattern.
- **Data boundary.** Learner edits never enter model context or message data automatically. Only an explicit share, submit or save sends content to the server, and that action creates the kind's own record. The surface stores nothing durable, and download is a local export. Which artifact is open is not sent to the model; **W3 — selected run feedback** decides any projection.
- **Working code.** A page-level store keyed by artifact ID holds working code, so layout changes, card switches and branch switches never lose edits. It persists in tab session storage (binding decision 5). Code artifacts from older messages stay editable and runnable; kinds with server-owned expiry, such as the practice quiz, keep their own lock.
- **Library.** The contract follows assistant-ui's interactable artifact pattern without adopting it: `toolCallId` identity, an inline trigger and a panel sharing one instance, and the open artifact as app state. assistant-ui 0.15.1 ships the pattern as `unstable_`, and it attaches every user edit to the next message and to thread history, which breaks binding decision 5. Reopen when the API is stable and edits can stay in the browser.

### Exercise qualification and generation

Use closed, bounded structured schemas. The model supplies content, never endpoints or execution privileges. Semantic checks bind test/rubric IDs, objective, input/output contract, packages and limits. Run reference, tests and validation fixtures inside the same isolation as learner code.

Require reference and known-correct alternatives to pass, and representative incorrect solutions to fail expected criteria. Finite fixtures demonstrate useful coverage, not general correctness. A changed runtime/package hash invalidates validation. Invalid candidates never offer Solve.

Workflow: draft → schema/semantic validation → target-runtime qualification → freeze → present → attempt → local tests → optional feedback. Start with one structured generation call and at most two repairs under an overall deadline/budget. Exhaustion rejects the draft. Browser-local receipts are browser-reported. Curated reusable fixtures get a controlled browser-harness receipt against identical assets; neither is formal grading certification.

Dynamic candidates can qualify in the learner's isolated runner before Solve, without a new hosted browser service. Reference/tests sent there are not secret. If this cannot meet reliability requirements, return the changed architecture/cost decision rather than silently adding infrastructure.

The explicit Generate action discloses and authorizes local candidate validation plus sharing bounded candidate diagnostics for the stated repair budget. This is separate from running or sharing a learner attempt. The server issues an owned workflow/candidate ID and content hash, bound to participant, current conversation branch and runtime-profile hash. The browser may return only that binding, a validation-status enum, failed test/criterion IDs and capped diagnostic text from candidate validation; no learner solution, unrelated state or host data. Treat diagnostics as untrusted model input. Server-owned lifecycle state, repair counters, deadline and idempotency survive retry/reconnect; a browser report cannot reset them or acquire controlled-harness provenance. An account-wide admission window/cap also limits creation of new drafts, so forged failures cannot evade spend limits by changing draft IDs. Browser-qualified readiness applies only to its owning participant and version/profile. Cross-participant reuse or future bank adoption requires a controlled-harness receipt. Missing/stale validation or disconnect leaves Solve unavailable. After reload, explicit Retry resumes the same unexpired owned workflow, or reports expiry; it never silently regenerates or repairs.

### Data defaults

Collect only explicitly shared evidence needed for feedback. Local state expires with the page/session. Sharing sends the selected snapshot to the chatbot's configured model-provider route; generation similarly sends permitted objective/course context and disclosed candidate diagnostics. Resolve the actual provider, processing geography, telemetry and retention from deployment configuration before approval; do not assume one provider across local, staging and production. Shared evidence is owner/service-only; no new lecturer/research access by default. Controller-approved purpose, notice, retention, export/deletion and research reuse remain **A1 — learner-data processing** decisions. Contextual English copy explains local versus shared actions and the model recipient. Formative labels and versioned corrections address accuracy/fairness; purpose-separated access and values-free measurements address minimisation/confidentiality/accountability. Disclaimer acceptance, course membership and study eligibility remain separate.

## Priority and sequence

| Priority | Item | Dependency and boundary |
| --- | --- | --- |
| P0 | **W1 — browser runtime qualification** | No source dependency; reviewed synthetic proof/prerequisite receipt. |
| P1 | **W2 — local editable playground** | After **W1 — browser runtime qualification**; draft source, capability off. |
| P1 | **W2b — artifact surface and code workspace** | After **W2 — local editable playground**; reworks the live practice quiz card without changing its default inline behaviour. |
| P1 | **W3 — selected run feedback** | After **W2 — local editable playground**, plus qualified identity/history. |
| P1 | **W4 — authored exercises and rubric feedback** | After **W3 — selected run feedback**; frozen authored fixtures. Pure contract research may overlap. |
| P1 | **W5 — controlled pilot qualification** | After **W4 — authored exercises and rubric feedback**; earliest useful pilot, live effects gated. |
| P2 | **W6 — generated exercise workflow** | After **W4 — authored exercises and rubric feedback**; pilot learning is useful, not a technical blocker. |
| P3 | **W7 — explicit server execution** | After **W3 — selected run feedback**; new backend separately gated. |
| P3 | **W8 — portable MCP Apps adapter** | After **W4 — authored exercises and rubric feedback**, with second-host need. |
| Deferred | **W9 — formal assessment decision** | Separate purpose/validity decision, informed by pilot evidence. |

Each source item below targets the base named in Identity and working context, has one application/topology writer and the execution owner as boundary owner. Proposed stacks are at most two independently checked layers, in one worktree each. Source terminal after implementation approval means reviewed draft PRs with `pr_ready` evidence, kept draft; merge/release/live proof are separate. Priority grants no execution authority.

## Work items

### W1 — browser runtime qualification

**Do:** Build a throwaway synthetic two-origin/frame harness in a fresh `/private/tmp` directory, using supported host browser tooling. Qualify both engines, exact versions, minimal compatible package sets, licences, asset hashes, bundle size and warm/cold startup. Prove restricted bootstrap, isolation, destructive Stop/reset and a no-SharedArrayBuffer path. Test LMS-shaped nested frames; actual OLAT headers remain a live gate.

Write `project/_local/reviews/browser-runtime-qualification.md` with exact harness path/commands, manifests, network evidence and per-adapter pass/fail across Chromium, Firefox and WebKit, including the mobile-shaped frame path. Identify exact identity, mode, card/history and embed prerequisites on `v3`, their owners and non-duplicating landing proposal, including sync-conflict handling for newer `v3-ai` seams. No prerequisite merge is implied. If the target lacks a required seam with no authorized landing path, return one concrete target/dependency decision before product work. Changing target is material; branch existence alone cannot select it.

**Check:** Both languages run deterministic and allowed-library fixtures. Infinite loops stop/reset. Forged/stale bridge messages, program egress, credential access and excess output fail safely. Restart the browser and reproduce two clean runs with the receipt's exact command. A failed language/isolation assumption returns a revised proposal before dependent adoption; never silently use CodeAPI.

**Context/authority/terminal:** Reuse planning worktree; future discovery approval allows the synthetic harness/receipt only. Required terminal `reviewed`, including explicit failures. No product source PR, paid model, live LMS, installation or infrastructure change. Priority P0; no dependency. Release-note impact: none.

### W2 — local editable playground

**Do:** Add an accessible native code card: editable source, qualified language/profile selection, Run, Stop, reset and truthful bounded output/status. Extend `apps/chat/src/components/message-parts.tsx` / card registration and server-owned mode capability policy. Introduce only runner/bridge modules justified by **W1 — browser runtime qualification** under `apps/chat/src`. No global editor framework/settings wizard. Volatile drafts show loss-on-navigation behaviour; local runs upload no learner payload.

Reuse approved custom-mode welcome/starter fields for neutral coding entry points and a short local-versus-feedback explanation. Starter selection inserts editable content without sending or executing it. Pilot content/exposure still requires **A2 — study rollout policy**.

**Check:** New focused `playwright/` spec covers edit/run/stop/reset, unavailable profile, flooding, stale completion, reload and nested frame. Network observations show only approved bootstrap assets. Check keyboard/narrow-screen use, loading/errors and disabled modes. Run Chat check/test commands and host browser spec; supply real screenshot gallery.

**Context/topology/terminal:** `trees/browser-code-playground`: `rs/browser-code-policy` (profile, bridge and capability contract) → `rs/browser-code-playground` (UI/browser proof). Default off, standard source terminal. W1 resolved this gate: base `v3-ai`, broker adapter, Chromium and WebKit qualified, Firefox unavailable. Open W2 requirements from the receipt: fresh interpreter state or a proven reset per run, a per-run deadline, a cap on bridge `csp` messages, and an HTTPS re-check of secure-context APIs. Asset publication/live activation consumes **A4 — execution infrastructure**. Priority P1. Release claim after release: edit/run supported code locally.

### W2b — artifact surface and code workspace

**Do:** Build the **Artifact surface** with two kinds: the code card and the live practice quiz card. Add the right-hand area and its switcher shared with the knowledge-graph panel, the explicit Open with its inline chip, fullscreen on narrow and embedded layouts, and the working-code store in tab session storage. Make `CodeRunner` in `packages/code-runner` controlled, so the host owns working code. The practice card keeps its server-owned submit, expiry and archive behaviour; only its presentation moves. Keep the accessible textarea; the editor-library decision reopens in **W4 — authored exercises and rubric feedback**. Add the learner terms "code workspace" and "working code" to `CONTEXT.md` with the first commit.

**Check:** Extend the code card browser spec: open, switch between code, practice and graph, close, and branch switches that keep edits. A reload restores working code within the tab, and a new tab starts from the starter. Check keyboard and screen-reader use of the switcher and fullscreen, and that focus never moves when an artifact arrives during streaming. A practice answer submitted from the inline card or the panel posts once, and expired history items stay locked. Qualify session storage in the W1 nested-frame harness on Chromium and WebKit, including the embedded LMS frame; where storage is unavailable, working code falls back to page memory and the card says so. Owner preview uses the same layout. Provide a screenshot gallery for the desktop split, mobile fullscreen and embedded views.

**Context/topology/terminal:** Target `v3-ai`, one worktree, probably two layers: the surface with the code workspace, then the practice card move. The practice card's default inline behaviour stays unchanged for existing learners, so no migration is needed. Depends on **W2 — local editable playground** reaching its base. Where "Ask for feedback" lives in the workspace is decided in **W3 — selected run feedback**. Standard source terminal. Priority P1. Release claim after release: open a code exercise or practice question beside the chat and switch between it and the graph.

### W3 — selected run feedback

**Do:** Preview/share one frozen run, then discuss it. Reuse qualified identity/ancestry; extend `packages/prisma/src/prisma/schema/chat.prisma`, `apps/chat/src/services/threads.ts`, authenticated route family and `useChatResponse.ts`. Choose the smallest owned-record representation; generate any migration with repo tooling. Implement idempotent sharing, bounded untrusted context, deletion/export and account-only persistence. Feedback has no invented rubric.

**Check:** Extend `apps/chat/test/thread-messages-route.test.ts`, `threads.test.ts` and prerequisite-owned projection tests. Reject cross-account/bot, sibling ancestry, deleted source, changed replay and forged provenance. Browser edit-after-run still shares the selected source; reload restores it. Duplicate share yields one logical feedback request. Output injection cannot expand permissions. Run affected checks, browser proof and gallery.

Source acceptance uses a fake model provider. Real feedback quality remains unqualified until a separately authorized synthetic model evaluation under **A7 — feedback qualification and funding**, including evidence accuracy, persona/disclosure compliance and output-injection cases. A working mocked loop is not qualified tutoring.

**Context/topology/terminal:** `trees/code-run-feedback`: `rs/code-run-evidence` (owned records/projection/deletion) → `rs/code-run-feedback` (share UI/tutor integration). Standard source terminal, off. Depends on **W2 — local editable playground**. W1 resolved the base (`v3-ai`, strong guard present). Server-authoritative history is still only PR 5676 into `v3`; plan its arrival through the `v3` → `v3-ai` sync before dependent history work. Real collection also needs **A1 — learner-data processing**; synthetic implementation is independent. Priority P1. Release claim after release: ask the assistant about a selected run.

### W4 — authored exercises and rubric feedback

**Do:** Add closed bundle schema, immutable version/hash, validation receipt, task/starter/tests UI and criterion-linked feedback, using authored synthetic fixtures. Keep this chat-scoped; do not change `ElementType`, quiz scoring or the question bank. Put the small contract/validator under `apps/chat/src/lib`, consumed through existing card/chat seams. Reuse compatible practice interaction without its Tutor-only mode assumption.

**Check:** Python/R fixtures accept correct alternatives and reject representative wrong solutions with exact criterion/test IDs. Reject failed reference, inconsistent tests, missing IDs, forbidden packages and profile mismatch. Shared bundles survive reload without rubric drift; edits create versions. Verify persona-specific disclosure separately from common evidence accuracy. Add semantic/contract and browser solve/run/share/retry tests with synthetic fixtures; no wording snapshots. Run checks and gallery.

Rubric-feedback source acceptance also uses the fake provider. **A7 — feedback qualification and funding** gates the synthetic real-model rubric/criterion evaluation and any claim that feedback is qualified.

**Context/topology/terminal:** `trees/coding-exercise-feedback`: `rs/coding-exercise-contract` (schema, validation/version lifecycle) → `rs/coding-exercise-feedback` (learner flow/rubric feedback). Standard source terminal, off. The complete item depends on **W3 — selected run feedback**. Contract research may overlap after **W2 — local editable playground**, without shared writes; this does not create an extra bank model, local-only pilot or source stack ahead of the feedback prerequisite. Priority P1. Release claim after release: practise with executable checks and criterion-linked feedback.

### W5 — controlled pilot qualification

**Do:** Qualify the authored loop before generation complexity. One package covers synthetic standalone/embed acceptance, persona/capability parity, English notices, limits, values-free metrics and reversible enable/disable recipe. Reuse existing rollout/analytics mechanisms; no new assignment or surveillance platform.

**Check:** Synthetic learner solves, shares, reloads, branches and deletes; deleted evidence cannot be read/projected. Check keyboard/mobile and nested frame. A separately authorized live batch proves actual OLAT launch/headers/auth, pinned assets and kill switch. Distinguish source/CI, desired state, deployed revision, health and functional acceptance. Compare server-enforced per-chatbot/per-mode capability admission, exercise/test version hashes, runtime-profile hashes and available actions across configured study conditions; custom modes need not become Tutor. Follow the repository-declared `v3` → `v3-ai` → `v3-audit` chain and refresh deployment-source/kill-switch receipts, never stale historical branch names. No raw code/output metrics. Local browser reports are forgeable and unobserved until shared; they cannot silently become learning-outcome measures.

**Context/terminal:** `rs/coding-practice-pilot` in `trees/coding-practice-pilot`; small flag/recipe changes ride with this package. Synthetic terminal `reviewed`, plus draft source PR if needed. Live terminal only when explicitly approved: `live_proven` for exact targets/rollback. **GATED on A1 — learner-data processing, A2 — study rollout policy, A4 — execution infrastructure and A7 — feedback qualification and funding before real learners, publication or activation.** Depends on **W4 — authored exercises and rubric feedback**. Priority P1. Pilot-only release claim; later generation requires requalification.

### W6 — generated exercise workflow

**Do:** Generate from an objective and permitted course context through a native AI SDK authoring tool/workflow in the existing route. Use the shared draft/validate/freeze contract, pending/rejected/ready card and server-owned budgets. The isolated browser qualifies candidate reference/tests. No model-written validation receipt, unbounded repair agent or new workflow framework.

**Check:** Fake-provider tests cover malformed/semantically invalid drafts, bad reference, over-permissive tests, cancellation, duplicate delivery, stale profiles, expired/reloaded workflows, unauthorized diagnostics and exhausted repair across reconnects. Only qualified versions offer Solve. Browser tests run candidates in both engines. A separately funded synthetic model evaluation checks task/rubric/test coherence and leakage; until run, real-model quality is explicitly unqualified.

**Context/topology/terminal:** `trees/generated-coding-exercises`: `rs/coding-exercise-generation` (bounded draft workflow) → `rs/generated-coding-exercises` (qualification UI/full loop). Standard source terminal with fake-provider/runtime evidence, off. Depends on **W4 — authored exercises and rubric feedback**. **GATED on A3 — generation budget before paid qualification/live generation.** Live exposure also consumes pilot gates. Priority P2. Release claim needs model/runtime qualification: generate coding practice with validated tests/rubric.

### W7 — explicit server execution

**Do:** For a concrete unsupported browser workload, qualify current CodeAPI language/package support, issuer-bound trust, shared admission, no-general-egress isolation, cancellation, output limits/logging and deletion. Reuse the parent plan and existing client selectively. Keep the attempt contract; only server-owned execution earns server-verified provenance. Never upgrade browser claims or auto-fallback.

**Check:** Synthetic ownership/retry/budget/trust/egress and unsupported-language tests, values-free logs and deletion receipts. Live acceptance binds exact deployed images and full flow, under separate authority. Server-side R requires independent support proof.

**Context/terminal:** `rs/chat-server-execution` in `trees/chat-server-execution`, target `v3`; separate linked CodeAPI/infra package only for a verified gap, never a cross-repository stack. Standard source terminal; live terminal separately named. **GATED on A4 — execution infrastructure, including explicit server workload/trust/capacity/data scope, before backend implementation.** Depends on **W3 — selected run feedback**. Priority P3. Release claim only for live-proven named workloads.

### W8 — portable MCP Apps adapter

**Do:** Reuse exercise/attempt/evidence contracts in a second host. Qualify protocol/renderer first; add resource handling and bounded view-to-host actions. MCP context updates replace view context, not durable history or automatic feedback. Keep selected evidence host-owned; no generic remote HTML renderer or broad tool bridge.

**Check:** Resource metadata/MIME, CSP, resize, origin spoofing, allowed actions, declines, duplicate share, reload and lost context. Complete solve/run/share in each named host with real browser evidence. Unsupported versions/permissions fail unavailable, not privileged.

**Context/topology/terminal:** `trees/coding-exercise-mcp-apps`: `rs/coding-exercise-app-contract` (resource/actions) → `rs/coding-exercise-app-host` (renderer/integration), target `v3`; another repository gets a linked package. Standard source terminal plus host evidence, deployment separate. **GATED on A5 — second-host product scope before starting.** Depends on **W4 — authored exercises and rubric feedback**. Priority P3. Release claim needs each host's live proof.

### W9 — formal assessment decision

**Do/check:** A bounded decision compares trusted reruns, protected tests, lecturer-reviewed rubrics, reliability, moderation/appeal, accessibility and assessment records. Reconcile the CODE-question branch instead of adding competing grading. Deliver a reviewed purpose/owner/trust-model/go-no-go recommendation on a purpose-named planning branch under `project/`, no decision-only PR. Implementation needs new scope/authority.

**Gate/terminal:** **GATED on A6 — assessment purpose before starting.** Informed by **W5 — controlled pilot qualification**. Priority deferred; terminal `reviewed` decision, no release claim.

## Eventual decision gates

No unresolved choice blocks this roadmap's shape. These rulings block only named future effects.

| Gate | Options and recommendation | Hard stop |
| --- | --- | --- |
| **A1 — learner-data processing** | Controller selects purpose, actual model-provider/data route and recipients, notice, retention, access/export/deletion and research reuse. Recommend local defaults, explicit sharing under conversation retention only if confirmed appropriate, no new staff/research access. Guest persistence needs its own identity/lifetime ruling. Keeping working code on the device beyond the tab (local storage with an expiry) is a planned binding-decision-5 amendment; it also needs a Chat sign-out hook and an expiry that runs without the app being reopened. | Before real collection in **W3 — selected run feedback** and consumers; synthetic source work independent. |
| **A2 — study rollout policy** | Study owner decides timing/equivalent capabilities, assignment, matched authored/generated tasks and valid outcome measures. Recommend matched authored tasks first and a versioned protocol amendment before exposure; browser-reported local test results alone are not trusted learning-outcome evidence. | Before study activation in **W5 — controlled pilot qualification**, or adding capabilities to it. |
| **A3 — generation budget** | Choose funded provider/model, permitted data, numerical request/credit/deadline caps and pilot ceiling. Recommend one draft plus at most two repairs under one overall cap; missing configuration disables generation. | Paid evaluation/live generation in **W6 — generated exercise workflow**. Fake-provider work independent. |
| **A4 — execution infrastructure** | Approve exact static runner origin/publication/ownership first. Server execution later needs a separate explicit workload, issuer, limits/capacity, data boundary, environment and rollback ruling. | Publication/live effects in **W2 — local editable playground** and **W5 — controlled pilot qualification**; backend implementation in **W7 — explicit server execution**. Browser approval does not cover CodeAPI. |
| **A5 — second-host product scope** | Name host/protocol, consumers, audience and owner. Recommend deferring until portability has a concrete user. | **W8 — portable MCP Apps adapter**. |
| **A6 — assessment purpose** | Decide whether assessed work is pursued and name its accountable owner. Recommend formative-only until validity/trusted execution are established. | **W9 — formal assessment decision**. |
| **A7 — feedback qualification and funding** | Select the permitted model/provider/data route, numerical evaluation/usage ceiling and who funds feedback. Recommend reuse of existing Chat accounting, with a bounded synthetic qualification for generic and rubric feedback under each configured persona. Keep this allocation distinct from exercise generation. | Paid feedback evaluation or live feedback in **W3 — selected run feedback**, **W4 — authored exercises and rubric feedback** and **W5 — controlled pilot qualification**. Fake-provider source proof remains independent. |

## Execution and boundary evidence

At each approved start, refresh host refs/forge heads and repo instructions, derive the item plan and harden it internally. Do not merge prerequisites as a discovery shortcut. `git show <pinned-ref>:<path>` reads newer source without changing checkout. Keep target/prerequisite drift distinct.

Planning needs no runtime. Later use only needed devrouter profiles and the runtime lifecycle skill. Container: `devrouter exec . -- pnpm --filter @klicker-uzh/chat check` and `devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run`. Host browser: `pnpm playwright:host -- <item-owned-spec>`. Use scoped `devrouter ensure . --profile <needed-profile> --json` only when behaviour requires the app. No paid upstream or retained-database mutation for synthetic checks. Stop exact runtime after its final dependent check unless explicitly retained.

Each source boundary supplies exact heads/diff, package checks, consequential negative tests, risk/final reviews, draft PR links and a real browser screenshot gallery for visible changes. Generate migrations with repo tooling. Fixtures are synthetic; tests cover behaviour/structured contracts, not prose. Public artifacts/reviews/CI contain no production data, including counts, identifiers or bot attributes.

### Feature-wide test portfolio

This portfolio owns maintained coverage. Item plans identify exact files/commands and their Delegation Map, then extend or consolidate this coverage rather than creating another suite for every workflow stage. New independent risks require explicit disposition in the plan; a phase change alone does not justify repeated checks.

| Independent risk | Obligation and owner | Primary seam and reusable evidence |
| --- | --- | --- |
| Isolation, bridge spoofing, resource bounds and recovery | **Add new** in **W2 — local editable playground**, using the disposable proof from **W1 — browser runtime qualification**. | Parameterized Python/R runtime/bridge harness; one focused browser spec for actual execution and Stop/reset. Reused by all later items against unchanged profiles. |
| Ownership, projection, replay and deletion | **Extend existing** in **W3 — selected run feedback**. | Thread/message route, service and history tests; one end-to-end share/reload/delete path extends the playground spec. |
| Exercise semantics, version and runtime binding | **Add new** in **W4 — authored exercises and rubric feedback**. | Pure schema/semantic tests plus controlled runtime fixtures. Extend the existing browser spec for solve/test/share; do not duplicate runtime isolation tests. |
| Evidence-based feedback and persona/disclosure policy | **Extend existing** trajectory/evaluation coverage in **W3 — selected run feedback** and **W4 — authored exercises and rubric feedback**. | Fake-provider contract fixtures for source acceptance; separately funded synthetic model evaluation under **A7 — feedback qualification and funding**. No assertion that mocked prose proves pedagogy. |
| Bounded generation, validation handoff and repair lifecycle | **Add new** in **W6 — generated exercise workflow**. | Fake-provider workflow/diagnostic-transport tests; extend the shared browser spec with one complete generated-candidate path. Reuse authored bundle tests. |
| Browser access, responsive interaction and pilot parity | **Extend existing** browser spec across **W2 — local editable playground** through **W6 — generated exercise workflow**; **none** new solely for **W5 — controlled pilot qualification** when existing coverage suffices. | One maintained interaction matrix and screenshot gallery. Pilot acceptance adds actual OLAT/environment receipts; rerun only changed contracts or environments. |

**W7 — explicit server execution** and **W8 — portable MCP Apps adapter** add genuinely different execution/host seams. Their future plans must extend this portfolio with those bounded risks before implementation; they do not copy the native-browser suites wholesale.

Expert review records proven delivery here: `reviewed`, `pr_ready`, `merged`, `released`, `live_proven` stay distinct. Source completion grants no later live action. Within a future finite approved batch, continue dependency-clear named items without another generic confirmation; only material scope/authority changes return to the user.

### Known traps

| Symptom | Cause → remedy |
| --- | --- |
| R cannot interrupt gracefully in an LMS frame. | Missing cross-origin isolation → qualify no-SharedArrayBuffer operation with destructive Stop/reset. Local frames do not prove actual OLAT headers. |
| Desktop packages fail in the card. | WASM/ABI differences → qualify exact finite profiles, not general PyPI/CRAN compatibility. |
| Visible old output is absent from feedback. | Card persistence is not model projection → use the owned path in **W3 — selected run feedback**. MCP context updates also do not create history. |
| Custom teaching behaviour changes. | Tutor-only tool reuse changed mode → extend capability plumbing while retaining persona/disclosure policy. |
| A passing reference hides a broken task. | Reference-only validation misses over-permissive tests → include correct alternatives and known-wrong fixtures; revalidate profile changes. |

## Official documentation and limits

Checked 2026-10-17; exact versions are qualification outputs, never floating product dependencies.

- [Pyodide workers](https://pyodide.org/en/stable/usage/webworker.html) describe module workers/separate context; [package loading](https://pyodide.org/en/stable/usage/loading-packages.html) covers compatible builds. Neither establishes application isolation.
- [webR 0.6 communication](https://docs.r-wasm.org/webr/v0.6.0/communication.html) distinguishes SharedArrayBuffer/PostMessage, interruption limits and worker closure; [packages](https://docs.r-wasm.org/webr/v0.6.0/packages.html) describes WASM requirements.
- [Web workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) expose network APIs and their own CSP considerations, so egress/isolation need executable proof.
- [MCP Apps context updates](https://apps.extensions.modelcontextprotocol.io/api/interfaces/app.McpUiUpdateModelContextRequest.html) replace earlier view context without triggering follow-up. This informs the later adapter.

## Progress

- 2026-10-17: Public-source/prior-art inventory and Claude advisory completed. Draft ready for native planner challenge. No product implementation, runtime qualification, paid exercise evaluation, source delivery or live activation occurred under this roadmap. Direction and future execution remain unapproved.
- 2026-10-17: Native Astra planner approved the corrected roadmap, binding its verdict to content hash `793c4a535c78b640cf34af4b74cb151ca211ac9cb507ed2fcbe116d2fa429d0b` before this progress-only entry. Claude advice was verified and dispositioned; details are in `project/_local/reviews/2026-10-17-browser-coding-exercises-plan-hardening.md`. Direction/execution approval remains pending. Immediate recommendation: approve **W1 — browser runtime qualification** only. Markdown formatting and whitespace checks passed; no app runtime was needed for planning.
- 2026-10-17: **W1 — browser runtime qualification** reached `reviewed` under an explicit finite discovery approval. The receipt is `project/_local/reviews/browser-runtime-qualification.md`, with a synthetic harness in a session temp directory, two identical clean runs and an approved slice review. Findings:
  - Pyodide 314.0.7 and webR 0.6.0 run in an opaque-origin sandboxed frame without SharedArrayBuffer, including nested and mobile-sized frames.
  - The manifest-broker adapter meets the strict egress contract on Chromium and WebKit.
  - The asset-origin adapter leaks query strings to the asset host on every engine.
  - Firefox 146 workers leak via `EventSource` and `FontFace` despite CSP, and JavaScript API removal does not close the gap.
  - Required seams for W2 and W3 exist on `v3-ai` but not on `v3`.

  Returned decisions: Firefox handling, and the target branch before W2/W3 topology. Routine records: `'unsafe-eval'` in the R runner only, and webR GPL-3.0 distribution duties for A4. No product source, commit, publication or live effect occurred.
- 2026-10-17: User rulings after the W1 receipt: Firefox shows local execution as unavailable for now (re-qualify later with the W1 harness on a stock release), and W2–W5 target `v3-ai`. W2 still needs its own execution approval.
- 2026-10-17: W2 execution plan drafted and hardened: [2026-10-17-w2-browser-code-playground-plan.md](2026-10-17-w2-browser-code-playground-plan.md). One planner challenge returned REVISE with 18 findings, which were applied. Departures from this roadmap:
  - the bridge protocol moves to layer 2
  - the policy is a platform-owned per-mode column rather than part of `customModeConfig`
  - W2 ships core profiles only

  Planning only; awaiting execution approval.
- 2026-10-18: W2 is implemented as the stack #6586 → #6587 → #6589 into `v3-ai`; the last layer moves the runner and editor into `packages/code-runner`. The PRs are in review. A grilling session with the user then settled the **Artifact surface** and added **W2b — artifact surface and code workspace**:
  - a thin local contract shaped like assistant-ui's artifact pattern, with interactables evaluated and deferred
  - the code and practice cards on the surface from the start
  - explicit Open, and one right-hand area shared with the graph through a switcher
  - inline-first with fullscreen on narrow and embedded layouts
  - working code in tab session storage; longer device storage waits on A1

  Corrected the production statement: releases are tagged from `v3-ai`. Telling the model which artifact is open moved to W3.
