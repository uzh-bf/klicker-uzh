# Biology chatbot: a small course-support prototype

## Approval summary

Current material selection: the user chose synthetic material only. Three
original teaching notes now support the prepared cases; external manuals are
deferred. This stage can qualify coaching and qualitative interpretation, but
cannot establish exact vendor-software procedure accuracy. The synthetic draft
is configured with one exact scoped local MCP binding and a separate biology
corpus. Thirty-five focused tests passed; direct signed HTTP checks retrieved
biology and finance material separately, crossed chatbot/KB pairs returned
401, and repeated startup left one binding. The runtime is stopped and zero
model calls occurred. The model/provider route and spend cap remain unresolved;
the user approved the next evaluation in principle, while the exact route and
cap are pending asynchronous confirmation. The current source-delivery
terminal is the reviewed local synthetic retrieval package prepared for the
approved draft-PR step; scientific and model qualification are subsequent.

Help biology students use PyMOL, CLC, and GraphPad Prism, understand papers and figures, and reason about their own experimental outputs. Start by configuring the existing course chatbot with a biology help mode, versioned teaching sources, and six synthetic examples. Reuse the existing image attachment and conversation flow. No protein viewer, scientific editor, raw-data analysis, or new tool integration is proposed.

Interpretation means discussing an exported plot or screenshot with its legend, units, and the student's question. The assistant distinguishes observations, possible explanations, and what the evidence cannot establish. It does not calculate fits from pixels or write report sections and captions.

The prototype can demonstrate behavior before private materials arrive. Course-specific usefulness requires later staff validation with approved materials. Teams tab embedding is required for eventual delivery, but current login and cookie behavior need qualification: a course PIN enrolls an authenticated participant; it does not authenticate them. The existing participant cookie uses SameSite=Lax, so a cross-site Teams iframe may not receive it. No authentication redesign or broad cookie-policy change is approved.

The user approved proceeding with this configuration-first prototype on 2026-09-09 and subsequently authorized a disposable local environment and synthetic chatbot configuration without model calls. Local preparatory artifacts, scoped source work, configuration and focused runtime verification are authorized. Source review and draft PR preparation are approved now. The route-qualification stop below remains binding for new material mismatches. Model-use authority remains unresolved. Private processing, deployments, Teams tenant configuration, access for 20 students, and merge need separate approval; human review remains required before merge. Use a verified institution-approved provider only; CHF100 is the provisional total future inference ceiling, not permission to spend or a sufficiency estimate.

## Execution details

### Synthetic retrieval connection

The user authorized an optional synthetic document file for the existing local
retriever, connection to the biology draft, and retrieval/citation verification
without inference. The native executor owns the bounded loader and focused
tests; main owns synthetic data, integration, runtime and binding qualification.
Default finance fixtures and authentication must remain unchanged when the
file option is absent. A configured invalid file must fail rather than silently
fall back. Citation metadata must identify the actual selected document.

The user approved the narrow local authentication extension on 2026-09-09.
Main owns auth, seed ownership, identity-based corpus selection and runtime proof.
The executor owns independent synthetic boundary tests. An optional ignored
project/_local/local-mcp-fixture.json explicitly records the additional chatbot,
owner, course, KB, mode and document file. Retaining it makes runtime restarts
repeatable. Missing explicit files or invalid configurations fail closed.
Default Benibot bindings and signed-token requirements stay intact. Startup
may attach only the exact configured draft after owner/course/mode validation.
No production authentication behavior or model calls change.

Local retrieval implementation now passes 35 focused tests. Signed HTTP checks
proved separate finance and biology corpora and rejected crossed chatbot/KB
pairs. A repeated managed startup succeeded; guarded database readback verified
one exact biology binding, DRAFT status and zero conversations. No inference
occurred. Evidence is in ignored project/_local/biology-http-result.json and
biology-binding-result.json. Browser citation rendering and model quality remain
unverified. Claude advisor hit its session limit. AGY returned no review because headless
command permission was denied. The GLM fallback completed its isolated synthetic review with no blocking
defects. Main accepted one missing failure-path test finding and added focused
owner/course/status/mode rollback tests; all four passed. Full-package delivery review remains
separate from this completed local retrieval qualification.
The exact Devsy workspace rs-biology-chatbot-prototype-pla is freshly Stopped;
all three default-rs-19884 containers exited and there are zero exact routes.


### Product behavior and boundaries

One course-scoped biology help persona, labelled Biology Lab Help, should compose existing chat modes and platform policies. Use the existing operator setup route, subject to qualification in the isolated synthetic environment. Preserve course policy, image context, source access and the intended label. The user approved retaining generic Tutor starter buttons on 2026-09-09; supply biology starters in the staff guide. If another required contract cannot be preserved, present that concrete limitation. Do not silently substitute a standard Explainer mode or create a new global standard mode, persistence entity, or Writing Coach policy.

Three copyable staff-guide starter tasks: “Help me perform a step in my software”; “Help me understand this paper figure”; “Help me interpret this result”. No biology-specific starter buttons or new authoring UI are required.

For software help ask for product edition/version when it affects steps, describe one short sequence and why, cite the relevant permitted manual section, and acknowledge missing evidence. Exact course versions are unknown; pin fixture versions explicitly instead of guessing CLC edition. Cover all three tools with equal minimum coverage.

For interpretation request an exported image, relevant caption/legend, axes and units where applicable, experimental context, and the student's question. Ask only for missing details. Give direct worked explanations for teaching examples; for assessed interpretation begin with the learner's observation, then discuss alternatives and limitations. Never invent labels, numerical measurements, fit parameters, significance, causal conclusions, or hidden raw data. Explicitly label qualitative interpretation. Unreadable or inadequate evidence should produce a targeted clarification, not a confident answer. Source citations do not independently prove scientific correctness.

Only interpret existing approved experimental instructions; exclude designing or optimizing wet-lab protocols. Also exclude project-file parsers, raw tables, fitting/statistical calculation, desktop automation, generated scientific images, protein viewing, autonomous web search, bespoke tool plugins, and submission-ready writing. Writing Coach owns report/rubric/caption feedback.

### Shared contracts and evidence

Baseline origin/v3: cbcede79718e8e60ff04d3f8376ab6a3f4bb64ed, refreshed 2026-09-09. Primary checkout v3 was behind 43 and dirty. Dedicated branch: rs/biology-chatbot-prototype-plan. Worktree: /Users/rschlae/Git/klicker/klicker-uzh/trees/rs/biology-chatbot-prototype-plan. It tracks origin/v3 and started at zero commits ahead/behind. Use it, not the primary or other owners' trees.

| Product primitive | Disposition | Contract and owner |
| --- | --- | --- |
| Course chatbot and chat mode | Compose | Existing platform policy and course authorization remain authoritative; teaching staff own biology guidance and availability. No new shared-mode semantics. |
| Course sources | Reuse | Staff select versioned permitted manuals/papers/instructions; retain source locators and course isolation. Participant uploads are never promoted automatically. |
| Participant attachment and conversation | Reuse | Existing participant/thread ownership and history carry images and explanations. Reuse only after actual image-context and reload behavior passes. |
| Interpretation | Presentation within a conversation | No standalone analysis object, numerical service, or shared artifact library. |
| AI usage authorization and publication approval | Reuse | Distinct existing gates; neither a Teams tab nor possession of a PIN bypasses them. |

Source pointers: docs/chat-platform.md (prompt hierarchy and participant entry), docs/adr/0041-chatbot-trusted-pilot-boundary.md (soft budgets and separate pilot authority), apps/chat/src/proxy.ts:5 (frame ancestors and token), apps/chat/src/hooks/useEmbedded.ts:5 (embed=1 UI), packages/graphql/src/services/courses.ts:51 (course PIN), packages/graphql/src/services/accounts.ts:24 (participant cookie settings). These are source contracts, not deployed evidence.

The existing image description template requests visible text and chart details (apps/chat/src/prompts/image-description.hbs). Do not assume the conversational model receives the original pixels; qualify the actual description path before accepting result interpretation. If it loses necessary information, first try better supplied context or a clearer crop. A vision-routing change is a separately reviewed shared-platform change, not an automatic prototype enhancement.

Writing Coach's separate proposal is at trees/proposal-writing-coach/project/writing-coach/RESEARCH_PROPOSAL.md. Reuse its eventual mode seam only when compatible; do not depend on its implementation to build biology guidance. Chemistry's worktree remains untouched. No new glossary term or hard-to-reverse architecture decision is required; no ADR now. Identity/data-ownership changes would re-arm that decision review.

### Materials, privacy, providers, and cost

Develop and verify only with permitted public text and synthetic figures. Public availability alone is not reuse permission. Maintain a small source manifest: title, edition/version, stable URL/locator, rights basis, selected purpose, staff reviewer. Do not download entire proprietary manuals or put private teaching material in this public repository.

Eventually accept student-owned exported outputs only after a responsible course/data owner classifies them and approves the actual processing route. De-identification alone does not establish permission for unpublished research. Private assignments and student images remain separate from shared public examples. No raw content in telemetry, training datasets, review reports, or general analytics; verify actual behavior rather than promise it from a prompt.

Before private processing, record purpose, responsible owner and institutional processing basis; provider/subprocessors and region; content/image-description paths; access roles; deletion and retention across chat, attachments, logs, backups and provider systems. Exact retention is an owner decision, not guessed here. No new teacher transcript access or profiling. Preserve learner correction/deletion controls and communicate limitations. These cover transparency, purpose, lawful processing, minimization, fairness, accuracy, storage, confidentiality, and accountability; unresolved institutional choices block private processing, not the synthetic prototype.

No model calls are approved in this planning task. Future authorized inference uses the approved text/image path without provider fallback. Count image description, main response, tools, and any routing calls in the CHF100 ceiling. Measure actual per-case cost and project usage from observed turns. Account monthly budgets are soft; require a provider cap or verified bounded admission/stop mechanism with concurrency allowance before a trial. If unavailable, no claim of a hard cap and no trial. Limit spending to the explicitly authorized amount and stop before exhausting it.

### Teams qualification

The requested endpoint is embedded chat in a Teams tab, with separate existing participant login and course-PIN enrollment. No Microsoft SSO is planned. The normal participant login path must work first, followed by reopening the tab. Do not assume an external browser login shares cookies with Teams.

Microsoft's tab requirements cover HTTPS, frame ancestors, tab initialization and authentication constraints: https://learn.microsoft.com/en-us/microsoftteams/platform/tabs/how-to/tab-requirements (checked 2026-09-09; Context7 also queried official TeamsJS). Distinguish a tenant's existing website-tab facility from a custom app tab before choosing any integration. No tenant setting is changed here.

Staff qualification later must check actual required Teams clients, approved origins, login/reopen, blocked third-party cookies, session expiry, logout, reload and cross-course denial. Teams embedding remains a named unresolved delivery dependency. A standalone browser is useful for prototype verification, not completion of the Teams requirement. If secure embedding needs cookie/auth changes, new SDK/dependency, or a custom Teams app, stop and propose that exact shared-platform change to the senior owner. Do not silently relax SameSite, broaden allowed origins, or substitute a link.

### Junior work and senior boundaries

One cohesive configuration-first package, not one PR per tool or test. Reuse the dedicated biology branch; no stack needed unless later approved platform changes are required. Keep the plan and fixtures with any eventual implementation package, not a standalone plan PR.

| Work slice | Junior ownership | Senior responsibility | Acceptance |
| --- | --- | --- | --- |
| Course help with synthetic sources | Draft biology persona/starters and six public/synthetic tasks under project/biology-chatbot; configure isolated synthetic chatbot using existing authoring once implementation/runtime scope is approved | Confirm exact custom-mode and source setup route, source rights, provider boundary; approve content before model use | All three tools have a versioned cited procedure; unrelated questions and unsupported source claims handled correctly. |
| Interpret and revisit exported figures | Prepare synthetic images and expected scientific observations; reuse attachment UI; record loss of labels/units and later-turn behavior | Review scientific validity and failures; own any shared prompt/context change | Visible trends explained without invented statistics; unclear images trigger clarification; original attachment and supported context remain usable after reload and follow-up. |
| Staff qualification and Teams evidence | Run approved checks, collect values-free results and create a short staff test guide; document exact source/config/model versions | Own authentication/origin decisions, secrets, any deployment/configuration and institutional data approvals | Synthetic staff acceptance complete; Teams independently labelled pass or blocked; no student access automatically enabled. |

Execution delegation map for later approval: the receiving main session owns qualification and integration, while a human junior performs the work above. This proposal does not create another task. For any agent-assisted implementation after approval, assign bounded fixture/configuration and test edits to the native executor once paths and checks are settled; the main session retains source-route and privacy decisions.

| Workstream | Slices covered once | Agent owner and human contributor | Dependency and acceptance |
| --- | --- | --- | --- |
| Synthetic support package | Course help with synthetic sources; Interpret and revisit exported figures | main coordinates human junior; native executor eligible for bounded edits only after qualification | Qualify mode/source/image path first, then six evidence-backed cases and authorized replay. |
| Qualification and delivery evidence | Staff qualification and Teams evidence | main coordinates human junior and senior reviewer | Synthetic support package; staff scientific review and explicit pass/blocked Teams result. |

No executor is dispatched for implementation during planning. Main-session retention reason for unresolved route and privacy work is the open shared-platform decision boundary. For later bounded edits, use the configured executor under rs-model-routing, with finite paths and checks; no new peer task is implied.

The main execution owner integrates and reviews changes. Junior work is bounded to configuration/examples/tests; no auth, authorization, schema, retention, provider routing, infrastructure, or production edits. Senior human review is required before merging any source changes and before private material is introduced. Routine fixes inside approved scope do not need repeated decisions.

Expected implementation budget: about 3–5 junior working days if existing authoring/source and image paths suffice, plus scheduled senior/teaching review. Teams auth remediation is excluded from that estimate and cannot be absorbed silently. This is an estimate, not a deadline or commitment.

### Verification and stopping points

Proposed six positive cases: PyMOL manual-backed selection/display help and explanation of a synthetic structure screenshot; CLC manual-backed workflow help and interpretation of an alignment-style figure with an accompanying paper excerpt and caption (permitted public or synthetic paper fixture); Prism manual-backed fitting workflow guidance and qualitative interpretation of a synthetic kinetics plot. The CLC figure case must distinguish what the figure shows from what the paper claims and stay within the supplied evidence. Use synthetic test-owned data; no assertions pin sample wording or ordering.

| Risk | Existing protection and obligation | Passing evidence |
| --- | --- | --- |
| Mode scope and source authority | Reuse system-prompt-compiler and effective-chat-modes tests; extend only if code changes a contract | Correct course policy; source locator is valid; text in a source/image cannot override policy. |
| Image loss or unsupported interpretation | Existing image/attachment tests protect transport, not science; staff-scored model cases add missing evidence | Six positive cases accepted for scientific accuracy, usefulness, source traceability, uncertainty; no invented quantities or advice outside scope. |
| Missing or adversarial evidence | Add bounded evaluation cases rather than brittle prose snapshots | Blurred labels, missing units, insufficient source, injected image/source instructions, and a request for exact fit statistics result in safe clarification/refusal where needed. |
| Attachment isolation and replay | Reuse history-attachment-serialization and attachment tests; verify browser contract | Participant B cannot read A's image; follow-up/reload uses authorized context, no content leakage into shared sources. |
| Teams and spending | Existing embed UI/soft budget is insufficient proof | Real required Teams clients pass authentication/reload and course isolation; verified ceiling control before trial. |

Synthetic acceptance: six positive cases run twice on the pinned approved model/config; every required criterion passes, and all failure cases avoid fabricated evidence and private leakage. A biology educator owns scientific scoring; an engineer owns browser/isolation proof. This is small-sample staff qualification, not evidence of improved learning or reliability across all inputs.

Use repository-native focused checks for actual changed files. If only configuration and examples change, validate their schema/source references and inspect the diff; do not start services for document checking. Relevant browser/model checks require later explicit runtime/inference scope. Reuse passing tests on unchanged contracts. Changes to shared code arm appropriate slice/final review under the existing workflow; a prompt alone cannot enforce semantic guarantees.

The original staff-ready implementation milestone remains subsequent to this
source-delivery terminal. It requires scientific and model qualification plus
an honest Teams qualification result; a blocked Teams result means the
embedded delivery remains incomplete and needs senior follow-up. Before pilot
activation, separately approve environment/deployed revision, approved
private categories/materials, provider path, cohort and participant access,
retention/deletion, effective spending control, staff acceptance, support owner
and stop procedure. No pilot starts from source readiness alone.

## Progress and review

### Historical execution checkpoint: 2026-09-09

This is a historical pre-qualification snapshot; the current result is recorded
in the opening and execution details above.

User implementation go-ahead received. Remote refs refreshed: this branch has
zero commits ahead and one behind origin/v3; the added target commit is
236ecd4fef, the shared translation context fix. No integration needed for
preparatory artifacts. Native executor readiness passed; one executor prepared
project/biology-chatbot only and is now closed. Main completed corrections,
route qualification and plan updates.

Source qualification found a concrete mismatch with the requested configuration:
packages/prisma-data/src/scripts/2026-08-23_provision_course_chatbot.ts accepts
stored custom personas, but does not establish source bindings. Manage exposes
standard-mode context, not an arbitrary persona editor. The custom-mode branch
in apps/chat/src/lib/config/suggestions.ts returns Tutor starter suggestions;
biology-specific starter buttons are not configurable today. The approved
qualification stop is reached before applying configuration. Continue only
independent synthetic artifacts; propose the exact simplified setup to the user.

Image source mapping confirms original pixels enter the current turn; later
turns receive stored image-description text. The description is capped at 1,000
output tokens. Qualitative follow-up therefore needs explicit missing-detail
handling; this is not quantitative interpretation proof.

No runtime, provider inference, database write, shared source edit, commit,
push, deployment or student pilot has occurred in this execution checkpoint.
The synthetic fixture pack is prepared in project/biology-chatbot: persona,
three pasteable starters, source pointers, six positive cases, five failure
cases and three diagrams. JSON syntax, field types, source relationships,
attachment paths, whitespace, SVG XML and the scoped secret scan passed.
Rendered diagrams were visually inspected; the Prism axis spacing and CLC
caption were corrected. Reviewer answers are excluded from model inputs.
Four failure cases are explicitly text-only policy probes; they do not test
image robustness. No model behavior or scientific acceptance is established.
The user approved generic starter presentation after the follow-up interview.
That question is closed; no further confirmation of it is needed. The existing
operator script has a prepared provision-config.json input. It writes an empty
allowed-model list and disables model selection; this does not pin a provider.
Custom-mode source bindings require the exact Biology Lab Help mode key and do
not inherit Tutor bindings. An isolated runtime target, source binding and
approved model route remain to be qualified. Runtime-independent validation is
sufficient for this checkpoint, not for a working chatbot or staff acceptance.

### Historical local runtime attempt: 2026-09-09

This is a historical bootstrap attempt; the later verified result is recorded
above.

User explicitly authorized disposable local setup without model calls. Main
owns runtime and database verification; these remain coupled to target safety.
The route-free mcp profile resolved workspace rs-biology-chatbot-prototype-pla
for this worktree, using Devsy container 49d64939b46b. No LiteLLM service or
application process was started. A resumed ensure reported ready with healthy
Postgres and Hatchet, but the required tsx toolchain remained absent:
`Cannot find module '/workspaces/klicker-uzh/node_modules/tsx/dist/cli.mjs'`.
The managed exec path also selected a nonexistent workspace directory; direct
exec in the source-label-verified container confirmed the missing dependency.
The prepared ignored local check never reached database operations. No biology
chatbot was configured and no model calls were made. Delivery remains pending
a correctly bootstrapped toolchain; do not treat managed ready as proof of it.
The exact runtime was stopped without deletion. Fresh Devsy status is Stopped,
all three source-verified containers are exited, and the route listing contains
zero exact-workspace routes. A runtime repair must preserve disposable-database
guards and avoid resetting retained data. Next action: restore the missing
container dependencies and complete bootstrap before rerunning the prepared
local configuration check. No new biology design decision is required.

### Historical local configuration verification: 2026-09-09

This is a historical configuration snapshot; it is superseded by the current
local retrieval qualification recorded above.

The authorized repair and configuration check passed at 13:51 UTC. Resuming
the same mcp-profile runtime and running frozen-lockfile installation succeeded.
The package-local Prisma data tsx executable was available; root-level tsx
absence was not sufficient evidence that the toolchain was missing. No source,
dependency definition or lockfile change was needed.

The ignored local check verified the restricted disposable database identity,
created synthetic course/owner records, ran the existing provisioner dry-run,
proved no chatbot was written in dry-run, applied it once, and read back exactly
one DRAFT chatbot with the supplied persona, linked disclaimer and expected
model policy. It verified zero threads and zero source bindings. No model calls
were made. One earlier local attempt created only a synthetic owner before the
course's required-PIN constraint rejected creation; that harmless local record
is retained rather than deleted without authority. The corrected fixture
supplies a PIN. Exact synthetic identifiers stay in the ignored local receipt
project/_local/biology-local-result.json.

The chatbot is configured, not scientifically qualified. Sources remain
unbound and the model/provider is not pinned. Provider-backed evaluation,
browser attachment checks and Teams acceptance remain pending. The exact
runtime is stopped, preserving the verified draft and local data. Fresh Devsy
status is Stopped, all three task containers are exited, and there are zero
exact-workspace routes. The scoped secret scan also passed. No publication,
deployment, shared application change or model inference occurred.

### Historical proposal review

Interview complete: software coaching plus paper/figure help; viewer rejected; interpretation of students' outputs included; synthetic materials now; Teams tab desired; provider/cost assumptions accepted. The independently checked final interview frontier is empty.

At that historical checkpoint, the work was proposal-only. No implementation, runtime, model test, private-material processing, commit, push, deployment or pilot had occurred. Native planner hardening: REVISE in round one, APPROVED in round two after all three findings were addressed (execution ownership, explicit route qualification, paper-figure acceptance). The optional AGY Gemini 3.8 Flash high challenge could not read the supplied draft: its response reported a denied ViewFile action, empty response, and no structured result. It supplies no review evidence. The required native review passed; source mapping limits and dispositions are recorded under project/_local/reviews.

Local retrieval checkpoint: all 35 focused checks passed. After the final rejection tests, managed stop completed and fresh Devsy status is Stopped, all three exact task containers are exited, and zero exact-workspace routes remain. The source implementation is committed locally; draft publication and model evaluation remain pending.

Source delivery checks: all 35 focused tests pass. The full hook was split between host and container: 93 host checks passed; type/lint and remaining repository checks passed after adding JavaScript overload declarations for the default boolean authenticator contract. Staged formatting, secret scanning and Git identity passed. No runtime behavior changed in this type correction. Dedicated simplifier reviewed d2b63506ba and found no worthwhile net reduction.
