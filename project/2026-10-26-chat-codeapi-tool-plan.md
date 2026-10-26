# Tutor Python tool implementation

## Approval summary

Add a bounded native Python tool beside the existing calculator for explicitly selected Tutor chatbots. The tool is disabled by default and produces text results through the existing tool display. Reuse the admitted chat turn, conversation persistence, usage accounting and five-step model budget. The calculator remains available for arithmetic.

This executable batch derives from the approved prototype findings and supersedes the implementation proposal in the earlier text-tracer plan. Current repository instructions select `v3`; the earlier `v3-ai` base and dedicated UI proposal are stale. The existing roadmap and client-foundation branches retain their evidence and ownership. No migration, shared package, dependency, lecturer control, file feature, notebook, general egress or custom renderer is included.

The principal risks are unauthorized or repeated execution, unbounded transport/output, misleading execution status and incorrect cancellation claims. The server owns identity, policy, endpoint and signing key. The model supplies code only. Local acceptance uses generated keys, synthetic fixtures, deterministic model output and fake transport; it proves no deployed trust, real Python execution or guest reaping.

The user authorized implementation, scoped reviews, tests, local commits, ordinary task-branch push and a draft PR. Terminal: a reviewed, tested source package targeting `v3`, with documented verification limits. Marking ready, merging, publication, live secret/trust/network configuration, provider calls and deployment require their own authority. Activation remains disabled until those later gates pass.

## Execution details

### Context and ownership

Repository: `uzh-bf/klicker-uzh`; target `v3`, baseline `256e461610e5055251863239d770ad0089e69713`. Branch `enhance/chat-codeapi-tool`, worktree `trees/chat-codeapi-tool`, artifact root `project/`. Execution mode: standard (runtime model identity is not reported). Main owns implementation and integration because trust and transport decisions are coupled. A trusted explorer owns only existing route-test/browser-seam discovery; Claude advises on the frozen plan and reviews the integrated committed package. No other branch is modified.

Prior owners: `trees/chat-codeapi-roadmap/project/2026-08-23-klicker-chat-codeapi-roadmap.md`, `trees/codeapi-client-foundation/project/2026-08-30-codeapi-client-foundation-plan.md`, and `trees/rs/chat-codeapi-text-tracer/project/2026-09-05-chat-codeapi-text-tracer-plan.md`. Prototype findings live in CodeAPI's `docs/project/2026-10-25-klicker-codeapi-prototype-findings.md`. Preserve PR #5142 (CODE grading) and PR #5676 (authoritative history); neither implements this tool.

### Binding contracts

Add `apps/chat/src/lib/server/codeapiTool.ts` and `apps/chat/test/codeapi-tool.test.ts`; extend the existing admitted chat route, its nearest focused route test and `persistedAssistantContent.ts` with its existing test suite. Compose `run_python` after participant/access/disclaimer/model/turn admission, in effective Tutor mode only. A collision with an existing tool omits Python rather than overwriting it. Reserve one invocation synchronously before asynchronous work; no automatic retry or durable exactly-once promise. Preview/manage routes remain unchanged.

Configuration names: `CHAT_CODEAPI_ENABLED` (only `true` enables), `CHAT_CODEAPI_PILOT_CHATBOT_IDS` (JSON string array; empty denies), `CHAT_CODEAPI_BASE_URL`, `CHAT_CODEAPI_JWT_ISSUER`, `CHAT_CODEAPI_JWT_AUDIENCE`, `CHAT_CODEAPI_JWT_KEY_ID`, `CHAT_CODEAPI_JWT_PRIVATE_KEY` (Ed25519 PKCS8), `CHAT_CODEAPI_TENANT_ID`. Parse lazily; disabled or invalid configuration adds no tool and needs no secret. Recheck the gate at execution. Add these names to `turbo.json` globalEnv and document them in `docs/chat-platform.md`. No actual environment values or chart activation are included.

Sign a fresh JWT only during admitted execution: EdDSA/kid/typ, iss/aud, stable tenant-scoped pseudonymous sub derived from the authorized participant, tenant_id, principal_source `external:klicker`, versioned auth_context_hash including chatbot scope, iat/nbf/exp and fresh jti. Lifetime 120 seconds. The dedicated key is never shared with APP_SECRET, participant or MCP tokens. No added logs/traces contain tokens, code, result text or identity. The existing conversation retains bounded code/results under its current access and retention policy; the model receives the bounded result as untrusted tool content. Live provisioning must settle the applicable disclosure and dedicated trust owner before activation.

Model input is only nonempty Python code, at most 16 KiB UTF-8. POST `/v1/exec` with fixed `lang: python`, `files: []`, guest timeout 5000 milliseconds and `X-CodeAPI-Expected-Profile: default`. Endpoint is server configuration: HTTPS or an internal Kubernetes `.svc`/`.svc.cluster.local` HTTP origin only; reject URL credentials, path prefixes, query and fragment. No model-selected endpoint, files, runtime, identity or credentials.

Transport deadline is 30 seconds including signing/fetch/body, connected to request and SDK AbortSignals. Reject redirects. Cap response at 128 KiB while reading and cancel the reader on abort/oversize. Validate the flat current response and optional exit fields; return only bounded typed status, exit code, stdout/stderr and truncation flags. Strip file/session/storage references. Outputs are at most 16 KiB UTF-8 each. Nonzero/signal/failure status means Python failure; missing exit status is unknown/completed, never success. HTTP/auth/overload/transport/shape failures return safe categories without raw service error bodies. Transport cancellation never claims remote process termination. Generated files are unsupported and never surfaced.

Update only the affected fixed output policy if it currently prohibits all execution claims: permit claims backed by actual tool results. Use the existing generic renderer. The current persistence mapper retains raw rejected tool arguments: add a Python-specific sanitizer that keeps only validated bounded code and replaces malformed/oversized arguments with a structured rejection marker, preserving other tools. Raw model argument deltas still follow the existing model-output budget in the live stream; the 16 KiB retained-input guarantee applies to persisted conversation content, not pre-validation streamed deltas. Python errors are typed normal results, avoiding generic `isError` redaction.

### Primitive impact and data defaults

Compose existing chatbot capability policy, admitted assistant tool call and conversation-owned result; reuse usage accounting. No new durable identity or data model. Default amount and processing are zero while disabled; admitted calls carry code and pseudonymous scope only. Retention and access follow the existing conversation. No analytics or export is added. The pilot provides calculation assistance, makes no grading decision and creates no new research/training purpose. Existing participant rights and deletion ownership remain with the conversation service. Live provider/trust/privacy acceptance is deferred to activation rather than implied by synthetic proof.

### Slices and acceptance

1. Bounded adapter and turn composition (main): implement the named module/test, route wiring, configuration names and affected fixed-policy change. Acceptance: generated-key claim verification, zero-dispatch denied policy, collision, concurrent one-call reservation, request bounds, typed failures, output/reader bounds and cancellation with deterministic fake transport. Extend the existing route fixture to verify admission and argument binding.
2. Integration and delivery (main): run the chat suite, relevant installed type/lint/format checks and required checks/build in the container. Use deterministic full AI SDK tool-turn evidence and existing persistence coverage. Inspect the full diff for simplification; complete configured slice/final reviews, correct verified findings and deliver an ordinary draft PR. Any browser-only contract change requires a local browser check with synthetic data. Pure non-rendered checks alone never imply deployed or browser acceptance.

### Test portfolio

| Risk | Obligation | Primary seam |
| --- | --- | --- |
| Unauthorized/duplicate dispatch or wrong signed identity | Add new | Real SDK callback with generated keys and intercepted fake fetch; current route preflight fixture |
| Bad wire/status, unbounded output or stalled body | Add new in same suite | Callback with controlled responses/streams, explicit guest/profile request assertions |
| Caller abort and deadline | Add new in same suite | Controlled abortable fetch/reader; no guest reaping claim |
| Tool-result/prompt integration | Extend existing only where affected | Actual SDK deterministic turn, persisted result mapper including oversized multibyte rejected input, and current system prompt compiler |
| Default-off compatibility | Extend existing checks | Current route tests, chat test suite, unchanged schema/dependencies |

Use existing versions and tools. Container-dependent checks run in a task-owned container; no production connectivity, credentials or existing runtime mutation. Record exact runtime lifecycle if a managed runtime is needed. Validate staged content for secrets and environment-derived data before every commit/push/PR update. Public artifacts contain source/synthetic facts only; private receipts stay in ignored `project/_local/reviews/2026-10-26-codeapi-tool/`.

## Progress

Approval: executable batch authorized in this conversation. HTTPS fetch succeeded; SSH agent refusal is a transport issue, not missing repository access. Primary checkout remains untouched. Open-PR inventory found grading/history work only. Current AI SDK docs confirm forwarding AbortSignal through tool execution; installed AI SDK 7.0.52 and jose 5.9.4 remain authoritative for version-specific types. Plan advisory review pending. Implementation not yet started.

Planner round 1: REVISE; accepted the source-verified finding that execution validation alone does not bound stored tool input. Added a Python-specific persisted argument sanitizer and zero-dispatch/bounded-retention acceptance. Other tools remain byte-compatible.
Planner round 2: APPROVED after the focused correction. Existing `account-usage-route.test.ts` is the route admission seam. New source changes remain non-rendered; no custom UI is included. Main continues the approved package through draft delivery.

Claude plan consultation: DONE_WITH_CONCERNS, no source-package blocker. Accepted explicit nbf and real HTTP-200 guest timeout status, stable versioned pseudonymous subject, per-turn tool closure, static description and preserved MCP-only grounding names. Source inspection confirms non-null runner status means failure. Known service extension fields are stripped, not forwarded. Kept files: [] as a valid explicit no-input contract. Safe typed nonexecution outcomes remain visible; the generic done chip indicates callback completion, while result.kind carries execution outcome. The proposed isError split was declined because it erases actionable safe categories on reload. The 30-second deadline remains the approved transport bound; the route's maxDuration is unchanged and no hosted-duration guarantee is claimed. Activation must use trust-table mode, declare required worker-prefix policy when multiple entries exist, and validate the effective external:klicker tenant namespace. No live trust settings changed.

Source verification: 43 focused adapter/persistence/calculator checks pass in a network-disabled Linux container. Installed TypeScript passes for the new adapter, its tests and the persistence seam. The focused Opengrep scan reports no findings; Biome passes with one existing untouched route warning. Full route/package verification is pending workspace dependency build completion; no live acceptance is claimed. Tests use the actual SDK callback and a deterministic two-step model, generated keys and fake transport.

Draft delivery: PR #6717 targets v3. The source diff is one cohesive adapter package (no stack); substantive source/test/config delta is 1234 lines before the accepted test-only simplification. Simplifier found no justified production reduction; removed duplicate assertions and merged equivalent invalid-response test callbacks without reducing scenario coverage. Exact task runtime is stopped with zero routes; isolated tests use no environment services. Route/full-package checks remain pending; hosted CI owns required whole-repository gates.

Offline source-built route acceptance now passes. Its paired prompt suite exposed an obsolete assertion that pinned the previous execution-prohibition prose; removed that wording-only test, keeping existing fixed-layer composition checks. This correction adds only the affected existing system-prompt-compiler test path; no new behavior or authority. Broader checks continue in an isolated disposable source build.

Full chat unit acceptance: 881 tests pass, 21 intentionally skipped, using the committed source in an isolated offline container after building its existing prerequisite packages. Slice risk review found no other source defect and raised the root Turbo private-key allowlist. Repository instructions require that name in globalEnv; this package supplies no key value or CI/deployment injection. Before any activation, inject the signing key only into the chat runtime/pod, never a root build/test/CI process. The name is not authority to broaden the credential's scope. Integrated final review and hosted checks remain pending.

Integration correction: scope retained-argument sanitation to a turn that actually owns the native Python tool. The mapper defaults to preserving existing tools, including a third-party MCP tool with the same name when native composition declines a collision. This preserves the accepted collision contract; no new capability or authority.
