# Bounded coding assistance in course chat

Planning successor: [browser coding practice roadmap](2026-10-17-browser-coding-exercises-roadmap.md).
It supersedes this document's proposed learner execution sequence. Retain this
plan as background for later explicit server execution; neither document grants
implementation or live authority.

## Approval summary

Add learner-controlled coding support using existing chat and CodeAPI services. Improve neutral onboarding first, then let an authenticated learner run a saved Python snippet and discuss its verified output. Execution is optional and off by default. Compared research conditions receive identical capabilities while preserving their different pedagogical prompts. Ordinary chat, grading and model charging retain their contracts.

This adds an admission point for arbitrary untrusted code. It requires separate authorization, cross-site request protection, shared compute limits, durable attempt ownership, sandbox isolation and hostile-output handling. Text-only display does not prevent hidden file storage; upstream export suppression and cleanup must be proved.

The first proposed approval is discovery-only: identify exact identity, embedded-session and history prerequisites, then return a revised implementation batch. Dependent implementation stops there. The later batch uses synthetic content and Python only; R needs separate qualification. Real learners, research activation, retention, issuer trust, secret writes, image publication, infrastructure, merges and deployments remain separate decisions. This planning request authorizes none of those effects.

Later success means a synthetic learner can run a snippet once, reload its truthful outcome and discuss it without crossing account or branch boundaries. Negative tests cover forged identity, cross-site requests, duplicate dispatch, unsupported languages, unsafe output and deletion races. This plan establishes no deployed safety or readiness claim.

## Execution details

### Identity, scope and authority

- Plan branch: `rs/coding-tutor-execution-plan`; artifact root: `project/`.
- Proposed application target: `v3`, the repository-declared development target. Planning baseline: `0f222786e86c625c7bfbff594a952de770d15ac5`.
- Additional application capability evidence: `v3-ai` at `618e94fb129403351b222482f39a78889655c9eb`. That branch contains newer custom-mode and identity work which is not assumed to exist on `v3`.
- CodeAPI source baseline: `main` at `880c3822e0986043d99b0d75c12f45e7703c9614` in `uzh-bf/code-interpreter`.
- Approval mode: **discovery-only first batch, proposed and not yet approved**. Current authority covers investigation, this uncommitted plan and its review only. Slices 2–5 describe the intended later package and require a revised implementation approval after slice 1.
- Boundary owner and integration owner: main session. No PR exists for this plan.
- First-batch terminal: an updated prerequisite receipt and revised, planner-reviewed implementation batch presented to the user. No source implementation, push or PR in that batch. The intended later terminal is synthetic qualification and reviewed draft application/CodeAPI PRs; capability remains off. Cross-repository PRs are linked dependencies, not a native stack spanning repositories. No plan-only PR.
- Pause only the dependent work for a material change in language, execution privileges, data purpose, retention, cost, target branch or public contract. Existing publication/release/infrastructure gates remain explicit.

This is a bounded integration security design, not a repository-wide security assessment. No production records, counts, identifiers, bot configuration, transcripts, or deployment observations belong in this document or its reviews. Source findings and proposed controls are not confirmed live vulnerabilities.

### Existing work and dependencies

The historical [native execution proposal](https://github.com/uzh-bf/klicker-uzh/blob/832579e56b082d4b7de749bcd8d717a2aed2433c/project/plans_future/PLAN-chat-code-execution-tool.md) proposed model-triggered execution. The local CodeAPI tutor roadmap at `trees/chat-codeapi-roadmap/project/2026-08-23-klicker-chat-codeapi-roadmap.md` also covers server-owned history, transport, plots and uploads. Treat its decisions as history and coordinate its application writer lane; this plan does not overwrite it or infer its approval.

Learner-triggered execution is an intentional alternative to that model-triggered first release. Preserve reusable JWT/transport and history work, but do not rebase, merge or duplicate another owner's branch. Slice 1 is explicitly discovery-only: inspect the authoritative-history work and [LTI session recovery PR](https://github.com/uzh-bf/klicker-uzh/pull/6414), identify the exact prerequisite commits/packages, owners and proposed landing path on `v3`, and stop for revised-plan approval. The receipt must distinguish source presence, required merge authority and runnable synthetic acceptance. Do not copy the older cookie-only guard or promote an entire integration branch to obtain it. Custom onboarding similarly consumes existing custom-mode authoring once available on the target. No dependent implementation starts with unidentified prerequisites.

Source evidence, inspected read-only:

| Source | Consequence for this plan |
| --- | --- |
| `v3-ai:apps/chat/src/lib/server/effectiveChatModes.ts:313` and `components/thread.tsx:751` | Custom-mode welcome messages and starter prompts are existing product extension points. Starters insert text without sending it. |
| `v3-ai:apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:1327` | Practice discovery and registration are Tutor-only. Do not enable a different standard mode to obtain that tool for a custom persona. |
| `v3-ai:apps/chat/src/hooks/useChatResponse.ts:123` | Follow-up serialization includes text parts, not generic historical tool results. Persisting a run card alone does not provide trusted model context. |
| `v3-ai:apps/chat/src/lib/server/apiGuards.ts` and `test/thread-messages-route.test.ts` | Reuse the central identity/publication/course checks, then add owned thread, source message and active-branch checks. Existing history tests mock the guard and do not prove complete execution authorization. |
| `v3-ai:apps/chat/src/services/rateLimiter.ts:1` | The existing in-memory limiter is per-pod and best-effort. It cannot be the compute budget's hard backstop. |
| `CodeAPI:service/src/config.ts:11` and `service/src/service/router.ts:187` | The current `/exec` mapping supports Python, JS/TS and Bash; an unmapped language is rejected. R is not a qualified capability. |
| `CodeAPI:service/src/auth/librechat-jwt.ts`, `session-key.ts`, `execution-manifest-claims.ts` | Issuer-bound JWT trust, authenticated identity and signed execution/egress claims exist. Configuration and deployed enforcement still need separate qualification. |
| `CodeAPI:service/src/service/router.ts:267`, `workers.ts:287`, `session-ownership.ts:5` | Executions have output sessions and may return files. A read-cache expiry does not prove physical deletion. |
| `CodeAPI:service/src/service/router.ts:284`, `middleware/auth.ts:55` | The execution/auth call chain includes identifying log metadata. A bounded values-free logging check is a pilot prerequisite, not an assumed completed control. |

### Product primitives and data flow

| Product primitive | Disposition | Owner and contract |
| --- | --- | --- |
| Approved chatbot persona | Reuse | Lecturer-owned pedagogy; onboarding and execution availability must not silently replace its teaching strategy. |
| Conversation branch | Extend | Participant-owned persisted ancestry becomes the authority for code and eligible prior results. Client history is a hint. |
| Code run | Create | A learner-initiated, independently admitted attempt with a durable outcome. It is not a fabricated model tool call or a grading result. |
| Execution policy | Compose | Platform-owned capability admission, per-mode allowlist, quotas and sandbox policy; participants cannot enable it. |

```text
Learner's Run action
  -> Chat origin: identity + CSRF + published bot + owned source/branch
  -> durable run admission + shared limits
  -> server-only CodeAPI adapter + short-lived scoped JWT
  -> isolated stateless sandbox with bounded privileges
  -> validated, capped plain-text result stored by Chat
  -> authorized run card / bounded untrusted evidence for a later tutor turn
```

There is no browser-to-CodeAPI connection and no model-to-sandbox execution tool in this batch. The model cannot mint tokens, choose a deployment, add files, enable networking, expand quotas or trigger runs. An explicit future agent tool would consume the same admission service under a separate reviewed policy.

### Security contracts

#### Admission and identity

Use the shared participant identity resolver on the actual implementation target, once the slice-1 prerequisite gate is satisfied. The initial capability is account-only; anonymous/guest execution and owner-preview execution are unavailable. Preserve ordinary guest chat. Every create/read/context request rechecks active account identity, publication, course access, ownership and validated ancestry. Creating a run additionally requires enabled execution policy and available admission capacity. Reading an existing result does not require the create switch. `Participation.isActive` remains a leaderboard preference and is never an access decision. Do not invent research assignment from course membership.

Accept only a saved source message, selected persisted branch-tip ID, deterministic code-block locator, expected code hash and a new logical attempt identifier. Derive executable bytes and Python language from server-owned content. Walk parent links from the requested tip, requiring every node to belong to the owned thread, with no missing parent, cycle or incomplete source. The source must be on this ancestry; an owned sibling outside it is ineligible. There is no global persisted active-branch pointer: “active” means this request's validated selected ancestry. Two tabs may select different owned tips independently; choosing another owned branch is allowed and does not mutate the other tab. A run binds its admitted tip and source permanently. A later result read/projection needs both on the newly selected ancestry. Switching branches during a run hides an ineligible result without cancelling it; returning to its ancestry restores access. Refuse changed hashes, incomplete streamed answers, unsupported fences and deleted sources. There is no unsaved editor, arbitrary URL, input file, runtime-session hint, bridge-worker selector, custom endpoint, shell option or client-supplied participant/tenant in this MVP.

Choose one CSRF contract for both account cookie and scoped-token transports: require POST with `application/json`, `Origin` exactly equal to the configured Chat origin, and the non-simple header `X-Chat-Code-Run: 1`. Reject missing/foreign/opaque origins, simple forms and cross-origin credentialed requests before reservation; do not enable CORS or preflight approval for this route. The fixed header is not a secret or a replacement for authentication. No extra CSRF nonce transport is proposed. Send requests through the existing same-origin authenticated-fetch path; scoped bearer tokens retain their chatbot/course binding and raw account bearer tokens remain unsupported. OLAT authorizes framing, not execution by the parent page. Its frame makes its own Chat-origin request. Verify standalone, partitioned-cookie and supported scoped-token fallback cases in a real browser before a pilot. An unsupported transport leaves Run unavailable rather than weakening this contract. Treat target/proxy origin as trusted configuration, not a caller header.

Mint short-lived asymmetric CodeAPI JWTs server-side using a dedicated issuer/key/audience/principal-source binding. Use the existing external-source contract, not a new arbitrary source string or a forwarded participant session token. Derive opaque identity from authenticated context; transmit no name or email. Bind admission to the owning course/bot/thread/run in Chat even when CodeAPI's storage boundary is per authenticated user. Reject untrusted key, algorithm, audience, source and issuer combinations. Missing trust/configuration disables execution rather than falling back to a weaker provider, local mode or another profile.

#### Duplicate calls, budgets and lifecycle

A logical click creates one durable `ChatCodeRun` linked to its owned thread and immutable source message. A retry uses the same attempt ID and canonical payload; reusing an ID with different content conflicts. A deliberate rerun uses a new ID, including when the code is unchanged. A disabled button is feedback, not duplicate protection.

Use the existing PostgreSQL database as the sole authoritative admission store; no Redis counter is authoritative for this feature. In one transaction take transaction-scoped advisory locks for platform, course and account in that fixed order, check outstanding reservation rows and the rolling admission window, and insert the content-bearing `ChatCodeRun` plus an operational `ChatCodeRunLease`. A unique `(participantId, attemptId)` rejects cross-thread/payload reuse; a matching replay returns the original state. The locks serialize capacity checks across replicas. Reject admission on database failure. Proposed synthetic limits are one active run per account, two per course and five admissions per minute per account; require an explicit nonzero platform cap even locally.

The durable lifecycle distinguishes pending, dispatch-claimed, success, program failure, timeout, service failure and indeterminate remote outcome. The request handler alone claims a pending lease with a compare-and-set before its single outbound call. No worker takes over a dispatch claim. A crash before the claim is recoverable as “not dispatched”; a crash after it is indeterminate even if no bytes left the process. An ambiguous network failure or response/persistence loss never causes automatic resubmission. Responses update only an existing matching run/lease; no completion path upserts deleted content. No cancellation button or remote-cancellation claim is promised.

The application recovery owner is one scheduled Hatchet task, `chatCodeRunRecovery`, using row locks/skip-locked batches; it reconciles leases, never executes code. It closes expired unclaimed admissions and retains claimed permits until authenticated remote terminal-and-cleanup evidence or an enforceable absolute remote deadline plus cleanup grace. CodeAPI must accept a trusted absolute deadline derived from admission, reject expired calls before enqueue, propagate it unchanged through queue/manifest/backend, refuse delayed starts and bound runtime and cleanup to it. The existing `/exec` and default 300-second job budget do not satisfy this contract. The synchronous HTTP wait is at most 35 seconds; reserve through a separately enforced ten-second cleanup grace and clock-skew margin. Do not advertise these numbers as available behavior until qualified. Disconnected clients, delayed requests, restarts and late completions do not move the deadline. Before that enforceable contract exists, real admission is disabled. An unexpected breach quarantines this principal and retains the minimal lease pending explicit stop evidence rather than silently releasing capacity; this exceptional retention is a pilot decision.

Proposed synthetic ceilings: 16 KiB UTF-8 code, five seconds of code runtime, 35 seconds total request budget including queueing, 32 KiB each stdout/stderr and 128 KiB total response. Enforce streaming transport limits before full JSON decoding and storage, as well as worker-side output, memory, process and temporary-disk limits. Freeze effective sandbox limits and queue/cold-start assumptions during qualification; do not copy a runtime cap into a claim about queue time. Raising these limits or spending real compute requires a named pilot ruling.

#### Sandbox, networking and artifacts

Code remains arbitrary hostile input, whether written by the learner or the model. Do not treat static code filtering, language selection, a prompt instruction or approval of a snippet as isolation. Before any real content is admitted, prove the exact deployed microVM/sandbox, signed manifest, least-privilege identity, temporary filesystem and outbound network policy. Sandbox code must not receive Chat/database/signing credentials or reach cloud metadata, internal services or other executions. Runtime package installation, broad network access, host mounts, callback/tool-call sockets, remote bridges and hosted apps are outside this capability.

Keep CodeAPI's `default`/stateless profile explicit with expected-profile checking; never silently fall back to `stateful`. Python-only is an application allowlist, not evidence of deployment capability. Do not run R through Bash as a workaround. R requires a separate pinned runtime/package and isolation qualification before being advertised.

No input uploads, downloads, plots or generated-file UI are included. Code may still try to write output files. The CodeAPI prerequisite must enforce a trusted per-principal text-only policy while retaining bounded ephemeral scratch. Select it from verified issuer/principal context, never a caller body flag. Bind zero output/upload privileges in `execution-manifest-claims.ts` and `sandbox-egress.ts`; enforce them at `egress-ledger-script.ts`/`egress-gateway.ts` before object PUT and at the actual backend artifact-export seam before returning a result. The legacy backend seam is `api/src/job.ts` (`uploadGeneratedFiles`); the native seam is `packages/code/src/native-process.ts`. Slice 1 selects the intended backend and freezes its cleanup/test path; an unidentified backend blocks slice 2. Worker result mapping in `service/src/workers.ts` is too late to prove suppression. Do not use the global `Number(...) || 50` output default as a zero-files switch. Qualification must observe attempted object writes and scratch cleanup, not just `files: []`. If suppression cannot be enforced, the real-content pilot stays blocked until a separately approved artifact-retention/deletion design replaces it. Preserve other consumers' capabilities.

#### Results, model context and privacy

Validate the upstream result schema and distinguish program exceptions, resource timeouts, service unavailability, truncation and unknown outcomes. Display code and stdout/stderr as escaped plain text; do not interpret HTML, SVG, Markdown links, terminal escape sequences or tool-like instructions from program output. Return no upstream storage/session IDs, credentials, headers, private URLs or stack traces to the browser. Render a truthful supported-language label and resource-limit notice.

For follow-up questions, reconstruct the request's validated selected ancestry server-side and fetch only its authorized completed runs. Project at most the newest two eligible results within a 4 KiB UTF-8 aggregate context budget, with explicit truncation/provenance. Disabling new execution does not disable this retained-result projection; a separate publication/access denial or deletion does. Treat output as untrusted evidence, never privileged instructions. Client-supplied run IDs, output or synthetic tool messages cannot establish verification. Preserve ordinary chat's existing history contract outside this bounded execution projection. Prompt injection can still affect an explanation; fencing is defense in depth, not proof that the model obeys policy. The model has no execution authority in this batch.

Run records contain the minimum source locator/hash, admitted tip, policy version, attempt identity, lifecycle, timestamps, bounded result and resource outcome. Avoid another full source-code copy. A code hash is linkable personal data, not anonymization. Source/thread/account/course deletion removes content-bearing runs through the database cascade immediately. A completion updates an existing row only, so it cannot recreate deleted content. The separate lease has no cascading content-owner foreign key: it retains only opaque quota bucket references, attempt/dispatch state, deadline and minimal remote cleanup locator. This remains linkable operational personal data. Deletion strips any optional content linkage and marks its result permanently suppressed; cleanup cannot restore it. The recovery task owns this state across restart and after any owner deletion. Purge normal leases after proven cleanup/deadline and the 60-second admission window, whichever is later. Exceptional unproven cleanup uses the quarantine path above; approve its retention/response policy before a pilot. No code, hash, stdout or stderr belongs in the lease. A rerun creates another attempt rather than rewriting the original.

Never emit code, stdout/stderr, names, emails, bearer material, code hashes, stable user/bot/thread/run IDs or upstream session IDs to application/provider logs, metrics labels or public review artifacts. Validate the execution call chain, including queues, traces, errors and cleanup. Use synthetic content and locally generated test credentials for the intended external-principal path; do not use CodeAPI's special synthetic principal, which bypasses some normal logging. Capture success, rejection, program/service failure and disconnect paths. Keep only bounded non-identifying status/class/duration/byte counters. No new external telemetry or content evaluation destination is authorized.

### Focused abuse cases and release evidence

These are design risks, not confirmed vulnerabilities. Priority assumes an authenticated malicious learner and a possible hostile web origin. Neither is assumed to control signing keys, infrastructure or the host.

| Abuse path | Priority and impact | Required control and discriminating check |
| --- | --- | --- |
| Forge a message, thread, mode, run ID or result | High: another learner's data or false verification | Owned persisted ancestry and immutable bytes; cross-account, cross-course, sibling-branch and forged-history tests make zero dispatches. |
| Trigger paid runs through an embedded/cookie-authenticated browser | High: unwanted compute and data processing | Same-origin POST plus CSRF proof; hostile origin/form/parent-window tests fail before reservation or dispatch. |
| Borrow another service's JWT provenance | High: cross-service authority | Issuer/key/audience/source binding; wrong-entry tests fail while existing consumers' valid tokens retain their contracts. |
| Exhaust compute or duplicate a run across replicas | High: availability and cost | Shared reservations, bounded requests and idempotency; concurrent duplicate requests dispatch once, new deliberate attempts remain possible. |
| Escape sandbox or use network/tool callbacks | High impact; likelihood depends on unverified deployment | Privilege-denied manifest and infrastructure proof; isolated synthetic negative tests for network, credentials, callbacks and cross-run state. |
| Persist hidden files despite text-only UI | High: undisclosed storage, retention and exfiltration | Per-principal artifact suppression plus deletion evidence; synthetic file-writing code creates no durable exported object. |
| Inject active output or instructions into UI/model context | High for browser execution; medium for explanation integrity | Plain-text rendering and server-owned bounded projection; active-content, escape and instruction fixtures neither execute nor grant authority. |
| Lose a response, delete a source, or end an HTTP request mid-run | Medium/high: duplicate work, orphan data or false status | Durable uncertain outcome, no blind retry, deletion fences and permit reconciliation; fault-injection tests prove terminal semantics. |

### Data-protection decisions

Defaults proposed for approval: collect only code already submitted to the conversation and bounded results; process it only for requested learning support; expose it only to its authorized learner and necessary server identities; retain Chat run records under the controller-approved conversation policy. CodeAPI scratch, queue/result caches, owner metadata, backups and logs need separately verified bounded retention. Cache expiry is not erasure.

Walk of the nine design principles:

- Transparency: explain the sandbox and possible later model use beside Run; version the notice. Existing chat disclosure does not automatically cover a new processor/data path.
- Lawfulness: controller approves the learning-support purpose, processor boundary and basis before real data; this plan makes no legal-compliance determination.
- Fairness: execution is optional and clearly labeled; no automatic grading or requirement to consent to unrelated research.
- Purpose limitation: support learning only; research/export/training is separate and honors applicable consent. Research opt-out does not itself revoke ordinary learning access.
- Minimization: no profiles, files, full-transcript transfer to CodeAPI, extra source copy or content telemetry.
- Accuracy: visible outcomes, code provenance, distinct infrastructure/program errors and immutable earlier attempts.
- Storage limitation: inherit an approved Chat retention policy, enforce deletion across copies and prove the text-only upstream lifetime before a real-content pilot.
- Integrity/confidentiality: scoped authorization, isolation, protected keys, encrypted authenticated transport and least privilege.
- Accountability: named application and CodeAPI owners, policy version, private acceptance receipts, deletion evidence and rollback authority.

The controller's retention period, notice/basis and processor approval are unresolved live-release decisions. Synthetic implementation can proceed after approval without inventing those rulings.

### Delivery slices and ownership

Proposed topology: one application feature package and one linked CodeAPI prerequisite package on normal task branches. A later R runtime is a separate capability package. No branch merges, native-stack operations or infrastructure ownership transfers are authorized by this document.

#### Delegation Map

Each slice has one accountable owner. A named role is a proposed later dispatch, not task-creation authority. Main retains security choices, private configuration, integration and external effects. The initial approval frontier contains slice 1 only; slices 2–5 are conditional on revised-plan approval.

| Slice | Owner, dependencies and scope | Acceptance and commit boundary |
| --- | --- | --- |
| 1. Freeze compatible prerequisites | `main`; discovery only. Reconcile exact target identity/embed/history/custom-mode packages and CodeAPI backend/export/cleanup path. | Exact immutable prerequisite heads, owners, target-state checks and proposed landing authority. Update this plan and repeat the planner check for changed scope. Stop for human approval before implementation. No source edits, bot setting changes, commits, push or PR. |
| 2. Prove a text-only CodeAPI principal | `main`; depends on 1 and revised implementation approval. Extend existing verified-principal, manifest, egress, deadline, backend-export and logging seams listed below. | Intended external principal with local test keys, zero durable object exports, enforced remote deadline/cleanup, no callbacks/general egress and values-free logs across failure/disconnect. Existing consumers retain their contracts. One linked CodeAPI prerequisite package. |
| 3. Admit, persist and recover runs | `main`; depends on 1 and revised approval; fake-first work may precede 2, but no real adapter acceptance before 2. Own schema, admission, dispatch, recovery, deletion and verified projection. | One schema-aware additive migration for `ChatCodeRun` and `ChatCodeRunLease`; atomic PostgreSQL admission and unique attempts; crash/restart/delete/late-response checks. Capability off; no live credentials or service required. |
| 4. Complete Run and reload | `executor` on the trusted bounded route; depends on stable slice-3 API/DTO and revised approval. Own named component/transport integration only, with no policy changes. | Visible immutable snippet and plain-text result, supported-language/error labels, keyboard/double-click/reload/branch behavior; synthetic fake and model capture prove later explanation. Deletion and disabled-create behavior are reflected immediately. Main integrates the role's result. |
| 5. Integrate and hand off disabled | `main`; depends on 2–4. Target freshness, synthetic qualification, documentation, configured reviews and draft delivery. | Focused package checks, negative test portfolio and real browser evidence; final review. Linked draft application/CodeAPI PRs with synthetic/public evidence only, capability off. No merge, release or deployment. |

#### Bounded path inventory

Application slice 3 extends `packages/prisma/src/prisma/schema/chat.prisma` and the existing participant relation in `participant.prisma`, with analytics mirrors in `apps/analytics/prisma/schema/`. One migration directory under `packages/prisma/src/prisma/schema/migrations/` is named by the schema-aware generator, not invented in advance. Add `apps/chat/src/lib/server/codeExecution.ts` (admission/adapter/projection), `apps/chat/src/app/api/chatbots/[chatbotId]/threads/[threadId]/runs/route.ts` (create/list), and `packages/hatchet/src/chatCodeRunRecovery.ts` (lease-only recovery). Register the latter through existing `packages/hatchet/src/index.ts` and `apps/hatchet-worker-general/src/index.ts`. Extend `apps/chat/src/services/threads.ts`, the existing thread-message history route/DTO and `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` for authorized history/projection. Reuse, rather than fork, central `apiGuards.ts` and prerequisite history validation. New authority helpers beyond these files need a revised path decision.

Application slice 4 extends `apps/chat/src/components/markdown-text.tsx`, `components/thread.tsx`, `hooks/useChatResponse.ts` and the existing authenticated-fetch client; add only `apps/chat/src/components/code-run-result.tsx`. No separate editor or new execution service is planned. Slice 5 extends `docs/chat-platform.md` and `.agents/skills/klicker-course-chatbot-provisioning/SKILL.md` only where the contract changes, and adds `docs/adr/learner-initiated-code-runs.md` for the durable identity/lifecycle decision. Source tests and browser fixtures are bounded by the portfolio below.

CodeAPI slice 2 extends existing `service/src/auth/librechat-jwt.ts`, `auth/principal.ts`, `middleware/auth.ts`, `config.ts`, `execution-manifest-claims.ts`, `sandbox-egress.ts`, `service/router.ts`, `types/service.ts`, `workers.ts`, `sandbox-dispatch.ts`, `egress-ledger-script.ts` and `egress-gateway.ts`. The chosen backend may require `service/src/sandbox-backend/lambda-microvm.ts`, `packages/code/src/native-process.ts` and `api/src/job.ts` for deadlines/export/ephemeral cleanup; slice 1 must narrow this list to the actual path before implementation approval. Do not add an auth service, alter shared global defaults, or edit unrelated backend paths. Add no new production module unless slice 1 shows that an existing seam cannot hold this policy and the revised plan names it.

If a prerequisite already satisfies a control, reuse its passing evidence and do not rebuild it. One application writer at a time. Recovery, deletion and artifact enforcement belong to main in slices 3, 3 and 2 respectively; they are not unowned follow-ups.

### Test portfolio and qualification

| Obligation | Existing protection to reuse | Test classification and primary seam |
| --- | --- | --- |
| Same-persona onboarding and published entry | Existing custom-mode, LTI and course-header coverage on its owning branch | **Extend existing** `apps/chat/test/effective-chat-modes.test.ts` only if integration behavior changes; otherwise **none**. No exact prose assertions. Assignment-policy implementation is not in this package. |
| Owned code/result and selected-ancestry authorization | Central identity, thread history and authoritative-history work | **Add new** `apps/chat/test/code-runs-route.test.ts`: account/guest, publication, course, source hash, missing/cyclic/foreign parents, sibling tip, deletion and real guard integration. Shared ancestry tests remain with their owning prerequisite. |
| CSRF and embed transport | Account/scoped-token transport coverage | **Extend existing** `apps/chat/test/chat-scoped-token-transport.test.ts`; **add new** route cases in `code-runs-route.test.ts` and browser cases in `playwright/tests/chat-code-runs.spec.ts`. Cover both transports, hostile origin/forms/header omission and zero reservation/dispatch. |
| JWT provenance, sandbox privileges, deadline and artifacts | CodeAPI JWT/manifest/egress/session/timeout tests | **Extend existing** `service/src/auth/librechat-jwt.test.ts`, `execution-manifest.test.ts`, `egress-ledger.test.ts`, `egress-gateway.test.ts`, `service/exec-timeout.test.ts`, `request-disconnect.test.ts`, `sandbox-dispatch.test.ts` and the slice-1-selected backend tests. Test external-principal local credentials, delayed enqueue/expiry, denied callback/network/object PUT and scratch removal. No new backend test file before the prerequisite receipt names it. |
| Shared quotas, duplicate attempts and lifecycle recovery | Existing in-memory limiter is insufficient | **Add new** `apps/chat/test/code-execution.integration.test.ts` against disposable PostgreSQL and `packages/hatchet/src/chatCodeRunRecovery.test.ts`. Race multiple clients/replicas; inject crashes before transaction, after reservation, after claim, after send and after response; check unavailable store, payload conflicts, delete → restart → late completion and permit invariants. |
| Bounded hostile responses | CodeAPI timeout and Chat output-fencing coverage | **Add new** `apps/chat/test/code-execution.test.ts` and `code-run-result.test.tsx`: transport-byte/schema caps, active markup/ANSI/instructions, failure classes and unknown outcome. Use the same synthetic adapter fixtures, not another simulator. |
| Persistence, branch changes, kill switch and trusted follow-up | Existing history DTO/output rendering | **Extend existing** `apps/chat/test/thread-messages-route.test.ts`, `threads.test.ts` and `tool-output-fencing.test.ts`; **add new** cases to the named browser spec. Capture the next model request. Disable during a run, then complete/reload/follow-up: no new admission; authorized old results still display/project. Two tabs, unrelated ancestry and deletion must exclude results. |
| Privacy and other consumers | Source deletion, CodeAPI ownership/logging tests | **Extend existing** `service/src/execution-log.test.ts`, `logger.test.ts`, `session-ownership.test.ts` and selected backend export tests, plus named run integration tests. Observe success/failure/disconnect logs and pre-mapping storage side effects under the real external-principal path with synthetic bytes. Verify other consumers keep artifact support. No **replace/consolidate** test work proposed. |

Use repository-native container commands once an approved implementation actually requires a runtime. Do not start an app or container to validate this plan. During implementation, use the isolated synthetic CodeAPI fake first; production CodeAPI calls and real-content probes are not test prerequisites for source work. Browser verification must cover English and German, desktop and narrow mobile, supported embedded account transport, default-off, pending, success, program error, timeout, unavailable and unknown outcome. Capture only synthetic screenshots through the screenshot-gallery workflow.

Before any pilot, obtain separate authority for exact deployment/issuer trust, secrets, network paths and funded capacity. Then prove current image digests, actual isolation/egress/artifact policy, key rotation, cache/object cleanup and end-to-end request deadlines against synthetic traffic in the named environment. A historic receipt, source test, healthy pod or merged PR is not interchangeable with that proof.

### Research conditions, rollout and rollback

Use identical neutral entry controls, starters, execution policy, runtimes, model/budget policy and source availability across any compared conditions. Keep the pedagogical persona as the intended difference. Do not add a common hint ladder or compulsory prediction step that overrides it. Record onboarding and execution as distinct versioned exposures; a before/after usage change alone does not establish causality.

Start with synthetic Python qualification, not a promise of a supported R course. R deployment and required packages remain a separately approved service capability. Artifact rendering, files, stateful notebooks, agent-initiated execution, automated repair loops, hosted apps and assessment grading remain out of scope.

Rollback is a server-side create-admission kill switch. Already-dispatched work retains deadlines, permits and cleanup ownership; hiding UI does not release them. Authorized retained results remain readable and eligible for bounded model projection while publication/account/course/ancestry access remains valid. Deletion or access revocation still blocks both. Schema rollback is not destructive: retain additive records under the approved policy rather than dropping data. Operational leases survive owner-content deletion only for the bounded cleanup/quarantine contract above.

### Research sources and limitations

Primary guidance consulted for the proposed controls: [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html), and [LLM prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/). They guide controls; they do not certify this integration or determine institutional legal obligations.

Source capability and current deployment remain separate. No fresh sandbox, network, processor, retention or release attestation was performed for this planning task. No learner content or production records are needed by the planner or public artifacts. A public-browser review of an unpublished complete plan is not assumed authorized; Astra is the requested native planner.

## Progress

- Status: planner-approved proposal; planning and focused source inspection only. Implementation has not started.
- Active scope: present this design and its security acceptance conditions.
- Completed: source/dependency inventory, existing-plan reconciliation, product/lifecycle proposal and bounded abuse-case analysis.
- Required layer: reviewed uncommitted plan. Achieved: Astra-approved plan after two rounds.
- Source verification: pinned baselines above; no runtime-dependent checks run or needed for this document.
- Test delta: none; substantive implementation size: zero.
- Review: Astra round 1 returned REVISE; all seven source-verified findings accepted. Same reviewer approved round 2. Optional Gemini high pass returned no terminal verdict before the CLI print timeout and is unpassed; it adds no assurance. No active implementation child or PR exists.
- Next action: present the discovery-only first batch and intended later implementation; prerequisite heads and live-release rulings remain explicit gates.
