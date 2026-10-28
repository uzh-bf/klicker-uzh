# Direct chat API and Catalyst local adoption

> Proposed `v3-ai` restacking and full-parity readiness work is specified in the [follow-up roadmap](./2026-10-29-chat-api-v3-ai-restack-roadmap.md). The user approved its finite source-readiness batch on 2026-10-29; this document retains the original scope and historical acceptance record.

## Approval summary

Connect the Klicker browser to the new public chat API and the existing Catalyst tutoring engine, without adding a temporary model-execution bridge to the old Next route. The user approved refreshing the API against current admission, history, prompts and credits, integrating scoped Python authorization there, and testing that final path locally. Reuse the existing foundation and browser scenarios. The final local acceptance must use the actual chat API, Prisma persistence and pinned Catalyst/Mastra runtime, with deterministic provider and CodeAPI-compatible transports. This does not prove real Python, guest termination or model teaching quality.

Keep participant access, published-chatbot eligibility, effective Tutor mode, canonical conversations, turn claims and usage/credits in the public host. Catalyst remains stateless for canonical history and owns the model/tool loop; CodeAPI owns execution. The existing Next endpoints remain the ordinary default while direct browser routing is explicitly disabled. The Python pilot stays default-off, text-only, one attempt per admitted turn, fixed Python/default profile, no files, bounded input/output, five-second guest request and no retries. Required course tools may not be silently omitted to enable this Python-only pilot.

Approval mode: executable batch. Authority is the user's latest “approved” response to the direct-API proposal: source changes, scoped independent reviews, synthetic local runtime creation/start/test/stop, commits, ordinary task-branch pushes and draft PR updates/creation on existing remotes. No ready/merge, force push, branch/data deletion, publication, secret provisioning/read-scope expansion, cluster access, paid-provider call or environment rollout. Local runs may diagnose, repair and reverify within this synthetic boundary; no artificial one-shot acceptance lease is added. Preserve other tasks' runtimes and retained databases.

Terminal: reviewed source drafts following the existing foundation → host API → browser migration order, applicable checks and hosted-CI evidence, actual local enabled/disabled browser acceptance through the final API/engine path, and verified shutdown of owned runtimes. If a required external capability is unavailable, finish independent work and record the exact blocker and unproved boundary.

## Execution details

### Existing sources and ownership

Public target is `v3`, fetched baseline `cac6bbf4dcd2caa973737abfe25d19d144069c42`. Public foundation PR #5126 has source `e4bd19d1fc400a463ce431de85014cbea3d7c67a`; canonical gateway contract continuation is `461607724c41e2e521cc5303ba3c960b013785f9` in existing `trees/rs/chat-engine-contract-gateway-mode`. Its public ordinal v1 schema is already consumed by Catalyst. Do not mutate that historical commit, invent v2, rewrite history or publish private engine code in the public repository.

Catalyst PR #144 at `b373f92fd72bc602927f8364c09b53fde82a0a9e` contains the default-off Python adapter and merged Mastra1.77 runtime. It has strict typing/build,80 synthetic tutoring tests, canonical public conformance and completed independent source/interaction reviews. Reuse those unchanged checks. The public legacy Python prototype PR #6717 at `0ee29c223dba1bee911c65cdc74e4163156b98ec` supplies scenarios and fixture techniques only; do not copy its production execution adapter into the current Next route or close/retarget it.

Main owns integration, policy decisions, runtime secrets, source writes and final proof. A planner critiques this frozen plan read-only. Bounded source/test workers may own only disjoint settled paths after the interface is fixed. No competing owner or service is created. Artifacts remain under `project/`; private reviews and receipts stay in ignored `project/_local/reviews/`. Runtime/provider/forge observations never enter tracked plans or PR descriptions.

### Primitive impact

| Primitive | Disposition | Owner and invariant |
| --- | --- | --- |
| Admitted chat turn | Reuse | Host authenticates participant, published bot/course membership, owner AI approval, disclaimer, effective mode/model and budget before generation. |
| Canonical conversation and accounting | Reuse | Host checks thread/parent ownership, claims a turn before provider work, persists ordered results and finalizes usage/credits once. Stop/error/unknown usage remain explicit. |
| Host prompt and model policy | Reuse | Preserve current effective mode/compiler and registry; lecturer/student text cannot select credentials, routes or execution scope. |
| Bounded Python execution | Compose | Host mints the exact short-lived capability after Tutor admission; Catalyst verifies and executes at most once. |
| Engine selection | Reuse | Deployment chooses one compatible engine; no retry, failover or version negotiation. Browser never receives service credentials. |

### Source packages and delivery order

Keep the existing public foundation and follow-on ownership; PR #5126 is not widened into the complete consumer migration. Native stack topology remains foundation, host API/policy surface, browser direct routing/qualification. Source packages can be prepared as dependent drafts while their predecessors await separate landing authority. Do not create independent competing API foundations.

1. **Refresh foundation.** Integrate canonical gateway continuation and current v3 into the existing foundation line with merge history preserved; resolve only actual conflicts and current build contracts. Preserve exact canonical v1 schemas, public/default engine and fail-closed tool seam. Refresh package versions/tooling from the target without arbitrary upgrades. Verify contract/API/default-engine tests and builds on supported Node24 before dependent implementation. Update existing foundation readiness evidence through its established PR source line, without marking ready or merging.

2. **Current host services and direct Python admission.** Extend `apps/chat-api` on the foundation as its own coherent host package. Move the current framework-neutral account/credit/transaction, conversation/disclaimer and prompt/model/mode implementations into API-owned modules rather than copying policy. The old Next import paths become narrow compatibility re-exports of the same implementation until cutover; they do not invoke Catalyst. Avoid a new generic repository abstraction or shared package unless source inspection establishes that API subpath exports cannot safely serve the two concrete consumers. Preserve comments and templates with their owning code. Add explicit public subpath/build entries and preserve separately importable pure client helpers where needed; never bundle Prisma or filesystem imports into browser code.

   Reuse current host authentication semantics through transport adapters: JWT subject, published chatbot, live course and participation; exact thread/chatbot/participant ownership. Reuse owner AI approval, effective standard/custom modes and model registry, participant fallback and account usage, turn claim/attempt/finalize services, disclaimer and existing ordered message/tool history. Keep prompt compilation, course context, answer style/tone and source/citation behavior authoritative. Add the existing conversation/read/write endpoint surface required by the selected browser flow. Preserve idempotent creation, feedback ordering, credit initialization/reset and canonical message IDs. Do not adopt the new server-authoritative-history PR #5676 in parallel or override its owner; consume current host behavior and record that separate dependency.

   The new HTTP surface uses a deployment-owned exact origin allowlist, credentialed CORS and mutation Origin/CSRF validation, bounded bodies and existing ownership/rate-limit policy. No wildcard origins or browser-provided private token/destination. Generation readiness checks the exact deployment-configured engine identity, compatible contract and requested capabilities; accepting any v1 manifest is insufficient. Reconcile gateway field names against the canonical pin. Preserve allowRegeneration as explicit intentional regeneration, distinct from replay of an identical claimed turn. Carry answer style/tone preferences through the compiler. Reject unsupported document pages and any handoffSource request before a turn claim; do not silently strip them. Preserve supported image behavior only where the selected engine manifest declares it. Any admission-to-stream failure after claiming a turn must mark that claim failed and leave subsequent recovery possible.

   Add API-owned default-off CodeAPI configuration/signing and tests. The signer owns fixed endpoint/trust configuration and a private Ed25519 key supplied at runtime; it issues only the already accepted external:klicker tenant/subject/context/run/chatbot/JTI/iat/nbf/exp shape, lifetime≤120seconds. It admits only explicit allowlisted Tutor bots after normal host admission. Descriptor is exactly catalyst-codeapi/run_python with fixed bounded schema. Ordinary required tools cannot be dropped; mixed-tool requests stay held until qualified dispatcher work. The model supplies only bounded code. Preserve engine one-attempt and process-local replay limits; no distributed guarantee is asserted. No real secret is provisioned or read.

3. **Direct browser and local qualification.** Extend the existing browser API client/request configuration and managed test launcher behind the existing migration design's off-by-default selection. A selected client sends credentials directly to chat-api; it does not call a new Next proxy or execute a second model loop. Move endpoint selection coherently for the chosen conversation flow, retaining ordinary Next behavior with the flag off. Add runtime public API URL injection and explicit bootstrap401 handling as needed; service/provider/private signing credentials never enter UI props, bundles or browser storage.

   Extend the current managed chat profile/process declarations or a scoped opt-in integration profile and launcher with concrete readiness and dependency bindings. New API port3005 and selected engine port3015 avoid their default collision. Keep required profile/CI runtime-contract tests in sync. Use canonical `devrouter ensure/exec/stop` for the exact qualification checkout. Create only a fresh marked disposable database/runtime, or reuse an exactly owned test runtime with its data contract verified; never reset retained or shared databases. Use existing synthetic seed identities and task-owned chat resources with ownership-checked cleanup.

   Public fixtures own a deterministic Responses/provider endpoint and CodeAPI-compatible TLS endpoint. They verify execution signatures/claims/profile/request limits, return nonce-derived results and require that the model consumes the actual tool result. They never evaluate Python or forward to paid providers. Generate the Ed25519 signing key in memory and inject it into the API child only. Generate the TLS key separately in the fixture supervisor and retain it only in that TLS server. The private Catalyst process receives only the public signing key and fixture CA certificate. Public certificates/verification keys/generation bindings may be recorded in ignored receipts; private keys/tokens/code/personal data may not be logged or saved. Reuse the existing fixture certificate and status conventions.

   The real private Catalyst runtime stays outside public source/images. The local operator harness starts its exact verified source in an isolated pinned Node container on the owned local network and stops it on every outcome. Bind API CHAT_ENGINE_URL to Catalyst on port3015 with the matching synthetic service token. Set Catalyst CATALYST_ENGINE_MCP_EXECUTION_URL to its own /v1/tools/codeapi endpoint. Bind its CodeAPI base URL to the isolated HTTPS fixture origin without a path; ordinary HTTP/container host aliases must not bypass the adapter's URL validation. Bind the selected Catalyst deployment provider URL and synthetic key to the deterministic Responses fixture. Bind all endpoints, public verification key and exact engine identity to the same managed profile, source and test generation. Test-only service/provider authentication may use explicit synthetic fixture credentials confined to this isolated test configuration; production configuration must not accept those defaults. Public receipts contain only nonsecret endpoints, certificates, public key and generation/source binding. There is no production secret or network-trust change. Qualify this process/transport handshake before investing in browser assertions; if canonical runtime or ownership cannot support it, record the capability gap rather than bypassing lifecycle management.

### Exact extraction and package destinations

Foundation stays in the existing API, default engine and contract packages with their build/workflow contracts and original plan. The host package owns `apps/chat-api/src/host/`, preserving the following relative paths from `apps/chat/src/`. Move implementations with comments preserved; old locations become explicit exports through `@klicker-uzh/chat-api/host/<path>`.

- `lib/config/answerStyles.ts`
- `lib/config/mode-descriptions.ts`
- `lib/config/prompts.ts`
- `lib/config/reasoning.ts`
- `lib/config/toolNames.ts`
- `lib/server/answerStyleInstructions.ts`
- `lib/server/chatModelRegistry.ts`
- `lib/server/citationInstructions.ts`
- `lib/server/courseContextInstructions.ts`
- `lib/server/coursePolicyInstructions.ts`
- `lib/server/effectiveChatModes.ts`
- `lib/server/inputContextInstructions.ts`
- `lib/server/languageInstructions.ts`
- `lib/server/outputFormatInstructions.ts`
- `lib/server/persistedAssistantContent.ts`
- `lib/server/promptTemplates.ts`
- `lib/server/systemPromptCompiler.ts`
- `lib/sources/normalizeSources.ts`
- `lib/sources/sourceUrl.ts`
- `lib/sources/types.ts`
- `lib/toolOutput.ts`
- `services/accountUsage.ts`
- `services/credits.ts`
- `services/disclaimers.ts`
- `services/threads.ts`
- `utils/creditPeriods.ts`
- `utils/transactions.ts`

Move the existing `apps/chat/src/prompts/*.hbs` assets verbatim to `apps/chat-api/src/host/prompts/`. Keep template loading module-relative to the API-owned promptTemplates module, never process.cwd(). Its Rollup build copies assets alongside compiled host modules. The package exposes explicit host subpaths without importing the HTTP entrypoint; pure config/source-normalization exports must not load Prisma, filesystem, HTTP listeners or server configuration. Next treats the package as an external server package and traces its owned built prompt assets into standalone output. Verify both installed API and Next standalone asset resolution before calling extraction complete.

Extend existing API runtime/auth.ts with transport-neutral admission; keep old apiGuards.ts as a NextResponse adapter preserving publication/course checks. Add named API runtime/codeapi.ts and focused tests for admission/signing. Extend existing API app, policy, stream, client, readiness and runtime services for current host behavior. No generic repository or separate shared package is introduced.

Browser changes use existing hook/store/client configuration, app-shell runtime injection, relevant bootstrap/conversation call sites and Playwright chat scenarios. Extend .devrouter.yml, profile resolver/post-start/runtime contract and util/run-playwright-host.mjs for the opt-in integration profile. Name the local-only fixture supervisor `util/chat-api-qualification-fixtures.mjs` and the external-engine launcher `util/run-chat-api-qualification.mjs`; both serve this final consumer path. New host HTTP/Prisma integration tests live in apps/chat-api/src/app.integration.test.ts. Update the owning foundation ADR for this explicitly approved default-off Tutor issuer addition; retain its other engine separation decisions.

### Test portfolio

| Behavior/risk | Obligation and primary seam | Acceptance |
| --- | --- | --- |
| Current auth, effective modes/model/owner/budget policy | Extend existing host/API policy tests | Denials precede claim/provider/tool work; default path unchanged. |
| Turn replay, concurrency and usage/credit integrity | Reuse existing account integration tests; add API→Prisma integration | Duplicate/concurrent turns do not repeat provider execution or debit; known completed usage charged once, unknown remains unknown. |
| Scope isolation, fixed Python limits and disabled gate | Add focused host signer/admission tests; reuse Catalyst suite | Wrong participant/bot/run/mode, disabled config and missing trust cause zero execution; concurrent Python calls reserve once. |
| Current history, prompts and visible stream behavior | Extend existing conversion/stream tests | Branch ownership, stored tool results, answer preferences, Stop/error terminal and reload preserved; unsupported capabilities fail before generation. |
| Direct browser/API/real engine composition | Extend existing opt-in browser harness | Success result consumed/displayed/persisted; reload no new call/debit; disabled, non-Tutor and unallowlisted requests cause zero CodeAPI calls; Stop transport cancellation and later recovery; bounded errors/concurrent reservation. |
| Runtime ownership and local-only data boundary | Extend existing launcher/lifecycle tests; actual producing-run receipts | Exact source/seed/engine/fixture binding, no external provider, no secret logs/files, bounded run and all owned processes/routes stopped. |

Use installed repo-native formatter/linter/types/tests and pinned Node/pnpm inside containers. Reuse unchanged passing evidence and canonical461607724 schemas. No prose/seed snapshots or tests tied to incidental demo contents. Screenshots are required for any changed visible UI, with relevant locale/viewports and synthetic data; a pure endpoint-selection change still requires browser contract proof and explicitly states screenshot relevance. Integrated final review must cover host auth/data/lifecycle, engine and browser seams. Prior component reviews remain valid for unchanged source.

### Recovery and stopping

Source failures are repaired within the approved batch and reverified at the affected seam; no force push or branch/data deletion. Runtime failures preserve evidence and stop the exact owned process/source through canonical lifecycle commands. A source revert or disabled migration/CodeAPI gate restores ordinary behavior; this batch does not deploy either state. Real Python, guest reaping, paid model quality and production rollout retain separate acceptance/authority. A hostedCI infrastructure blocker does not imply source failure or waive that required delivery gate; publish honest drafts and preserve the exact blocker.

## Progress

Root outcome: a Tutor uses bounded Python through the final browser→public chat API→Catalyst path. Authorized terminal: reviewed source drafts, local synthetic browser acceptance and verified shutdown, with exact CI state; no merge/deploy. User approved this revised direct-API approach to avoid a throwaway legacy generation bridge. First acceptance is an authenticated HTTP request to the actual API, backed by real disposable Prisma data for an eligible Tutor and owned thread. The pinned real Catalyst must consume a nonce-derived CodeAPI fixture result, produce a valid terminal event, and persist the canonical answer with known usage charged once. An identical replay produces zero new model calls, tool calls or debit. Disabled/ineligible turns produce zero CodeAPI calls. Injected database stubs or manifest-only checks do not satisfy this gate. Verify owned process shutdown before browser expansion; final browser acceptance remains required.

Current: the focused independent plan correction is approved. The first critique confirmed package order and requested explicit process/key bindings, extraction/asset ownership, regeneration/failure handling and real HTTP/Prisma acceptance. Those corrections are incorporated for its focused re-review. Foundation target integration is resolved. Canonical schema source is unchanged. Contract, default engine and API focused checks/builds pass on pinned Node24 with current Prisma; workspace dependency consistency passes. Current pin policy is authoritative. Host extraction and final runtime acceptance remain pending. The active stack checkout is trees/chat-api-catalyst-adoption on rs/chat-api-foundation-refresh. The older gateway checkout and its stale host dependency data are preserved; container verification is reused for the identical source. Main is the sole implementation writer; no managed runtime has started, no secret scope changed and no live execution occurred. Detailed operational evidence belongs only in the ignored review directory.


### Review-feedback correction continuation

Correct confirmed cold-readiness coalescing, persisted text segmentation across tool calls, partial-frame progress and final-frame closure in the existing engine client and stream modules. Keep the default engine's deployment provider origin, smoke response consumption and local environment passthrough consistent with their configured contracts. These remain source-only repairs within the approved package.

The conformance runner's expectation of reading an abort terminal after aborting its fetch transport is invalid; its injected test does not establish real HTTP cancellation. The user approved the reviewed source-only correction to that in-process result contract. Do not replace it with a fabricated terminal event or treat the existing injected conformance result as real HTTP proof. Preserve the separate actual browser/API/Prisma/pinned-Catalyst acceptance and its explicit guest-execution limitations. No ready/merge, release, deployment or secret expansion is authorized.


### Approved conformance transport correction

The user approved replacing the suite's in-process `abortStream` result with `transportCancelled: true`. Preserve the v1 wire schemas and independent engine abort-event checks. Require a valid nonterminal SSE event, reject already completed or terminal streams, cancel the native fetch transport under finite bounds, and release the owned reader on every outcome. Real loopback HTTP must observe premature response closure before fixture teardown. The existing Catalyst test consumer serves its actual app through its existing Node adapter with deterministic runners. No engine production change, dependency, paid call, secret expansion, ready/merge or deployment is included.

Main owns the public runner, test corrections, stack integration and final local proof. A bounded executor owns only the existing private conformance consumer script. First acceptance reproduces the old runner's failure over real HTTP. Continue through contract/default/host checks, immutable public/private revision qualification, independent review, the actual local browser/API/Prisma/Catalyst composition, reviewed source drafts and exact owned-runtime shutdown. Preserve prior evidence and explicitly withdraw the earlier injected abort-terminal transport claim.


### Approved complete API and engine readiness continuation

The user approved source-backed review replies/resolutions, conditional readiness of the public host-policy and browser layers, and automated final stack review, then expanded the batch to source readiness of the complete chat API, shared contract, default engine and Catalyst integration. Preserve the existing native stack and v1 wire protocol. Correct reproduced foundation locale adaptation, prefixed engine URL conformance and pre-stream user-message persistence; keep current host claim/failure handling authoritative after composition. Declare already-used Node ambient types and constrain declaration generation to production source while retaining test typechecking. Correct only the affected historical prompt and merge-order guidance.

Extend the existing private portable TypeScript CI job to execute the canonical immutable public contract and existing native-HTTP Catalyst consumer. Publish the ordinary public candidate first, qualify that exact source privately, then update its existing workflow pin and provenance digests together. Portable CI and GitHub/OCR coverage remain distinct. Required account capability and human review gates remain blocking; no merge, release, deployment, secret expansion, paid-provider/real guest call or cluster operation is authorized.

Main owns public stack integration and final acceptance. Reuse prior review and synthetic browser/API/Prisma/Catalyst evidence only where its source and acceptance remain unchanged. Run affected container-native checks, independent correctness/data-integrity review and per-layer CI; then resolve only verified review findings, mark the approved public dependent layers ready and run final stack review. Return newly readied layers to draft if blocked. Preserve branches, history and retained data. Full producing-run and operational evidence remains ignored; no runtime/forge observations enter tracked artifacts.


The API and default-engine unit tasks declare workspace build prerequisites in their package-specific Turbo entries. This keeps fresh-checkout test execution ordered without broadening build requirements for unrelated workspace tests. The shared per-process PORT contract and existing explicit multi-service launcher bindings remain authoritative.


### Host-policy implementation checkpoint

The host extraction retains compatibility exports in Next and one API-owned implementation of participant/publication/course guards, current model/mode/prompt policy, credits and turn lifecycle. Prompt assets follow the owning module in built API output. Presentation-only reasoning labels remain in Next; only their shared type crosses the package boundary. The direct API rejects unsupported document-page/handoff inputs and existing course-tool bindings before claims. Its Python capability is default-off and restricted to explicit Tutor pilot configuration. Request Origin is checked before admission, and engine identity/capabilities plus returned tool and terminal identity are validated.

The current host layer is in progress and unreviewed. API-focused checks and shared Next compatibility checks have passed at their recorded private revisions. The local authenticated HTTP/Prisma/Catalyst acceptance now covers exact result consumption, canonical persistence, single usage finalization, duplicate replay and the disabled/ineligible gates. Detailed receipts remain private; browser acceptance, installed-package standalone tracing, integrated source review, hosted CI and source-draft closeout remain pending. Runtime observations and attempt-specific evidence are private under the ignored review directory. A failed local attempt is preserved and repaired within the approved synthetic debugging boundary.


### Direct browser routing checkpoint

The browser layer now selects the public API origin through a default-off server-rendered binding, carrying existing cookie credentials directly to the API for conversation, settings, credits and streaming. The managed qualification profile starts the exact local engine and fixture processes before admitting browser tests. Its worker detaches before profile reconciliation so it does not retain the lifecycle lock. The controlled fixture covers success, reload, Stop, recovery and disabled-tool behavior. Focused browser behavior and profile contracts are checked; final browser acceptance, standalone package tracing and integrated review remain open.

The host package uses the patched Handlebars release and native manifest ordering. Required dependency review on the foundation is separately blocked by the current Zod major-version policy: the advisory has no patched release within the approved major. Do not waive the check or silently perform a major upgrade. Finish independent qualification and source-draft delivery, then present the exact migration decision if it remains required. Detailed operational evidence stays in the private ignored review directory.


The local browser acceptance uses the existing participant-login mutation from the browser to obtain the ordinary HTTP-only cookie, then exercises the actual selected chat interface. This keeps authentication and cookie transport real without making an unchanged PWA login screen a prerequisite for the API migration. The PWA login UI itself remains outside this acceptance claim. No injected cookie, synthetic authentication endpoint or production authentication change is introduced.


### Local acceptance and source delivery checkpoint

The final local browser path now passes ordinary cookie authentication, direct API selection, enabled Python result consumption, reload without new execution, Stop transport cancellation, recovery and the disabled zero-dispatch gate. The actual API/Prisma/Catalyst path also passes canonical persistence, one usage charge, replay protection, owner denial, history and feedback. Existing guarded PostgreSQL tests confirm a single concurrent provider claim and atomic distinct-turn charging. These use deterministic provider/execution fixtures; real guest execution, reaping, teaching quality, hosted consumer configuration and rollout are outside this acceptance. The unchanged PWA login interface is not qualified.

The standalone Next artifact imports host routes and reads its traced prompt assets; full managed-runtime typecheck and build pass. A reproduced credentialed-stream CORS regression is corrected in the host layer with an explicit regression test. Independent integrated review and the focused correction pass cover the public host/browser source, reusing unchanged private engine evidence. The bounded service-failure case also passes with a single execution attempt and no retry. Remaining delivery checks are exact latest CI, draft descriptions and verified runtime shutdown, recorded in the private completion receipt. The original foundation dependency gate still requires an explicit Zod major-version decision; no check is waived and no major migration is included here.
