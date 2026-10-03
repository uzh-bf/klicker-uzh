# Show retrieved chunks and reliable source references

Draft delivery: [RAG chunk display and stable citations](https://github.com/uzh-bf/klicker-uzh/pull/5831).

## Approval summary

### Progress — acceptance and finalization, 2026-09-08

The user inspected and accepted the expanded synthetic example in Browser.
Head `e3e4357dfa3aa29fd3c7c693f40fa37230639ac3` passes hosted CI, including
all eight browser-test shards. Local acceptance covers origin preservation,
page labels, disclosure, Unicode boundaries, desktop, mobile German and reload.
Chat build, all 35 package checks and seven lint tasks pass; the host-only
CI contract passes separately on the host. This is persisted-display proof,
not live model retrieval or staging acceptance.

Finalization folds one discovered launcher defect into this same package:
an explicit preservation request must fail before setup if CI markers or a
missing launcher marker make preservation unavailable. Malformed reserved
local options must likewise fail before runtime effects. The executor owns
the launcher and its synthetic host tests; main owns integration and review.
This restores the approved preservation intent without changing ordinary setup.

The fresh acceptance workspace `trees/rs/rag-clean-acceptance`, provider
`rs-rag-clean-acceptance`, is verified Stopped with zero routes after the user's
inspection. Data is retained; no deletion is authorized. The task source branch
remains `rs/rag-chunk-display`, targeting `v3`. Remaining gates are the bounded
launcher correction review, fresh hosted checks, ready status and final AI
review. Marking ready after verification and CI pass is approved; merge and
deployment remain outside this finalization scope. Earlier progress below is
historical where it conflicts with this entry.

### Progress — PR readiness, 2026-09-08

The user approved continuing source readiness and merging the separate
[Devrouter CI prerequisite](https://github.com/uzh-bf/klicker-uzh/pull/5834).
It merged to `v3` as `1a270f33053e12d56df6e4536133753edcaae636`.
The RAG task integrates that exact target to obtain the trusted CI installer;
the only conflict selects the approved Devrouter minimum 0.0.59.
All 62 host CI contracts pass after integration. Fresh hosted verification
remains pending; no RAG merge or deployment is authorized by this continuation.

Before integration, published Devrouter 0.0.59 started the exact task's Chat
profile with ready status and zero drift. In-app Browser inspection confirmed
the saved synthetic conversation, seven disclosed passages, fourteen source
groups, origin links and page labels, and unchanged citations after reload.
Managed shutdown verified the provider Stopped and zero routes, preserving
data. This is local persisted-display proof, not live retrieval or staging proof.
The integration has not yet repeated runtime-dependent verification.

The earlier hosted failures occurred before application tests: the trusted
`v3` workflow installed Devrouter 0.0.55 while the RAG branch required 0.0.57.
The prerequisite fixes both the base minimum and trusted installer at 0.0.59.
Existing implementation reviews remain applicable to unchanged RAG behavior.
Review suggestions to assume nullable error fields lack a supplied producer
contract; creating a missing view during database preservation would introduce
an unrequested setup write. Neither suggestion was applied. Remaining style
and performance suggestions are not yet dispositioned.

### Current acceptance status

Source-only draft delivery is complete at implementation head
`16a47ebad03dc5504da4d113bb3cda94671045a6`. Simplification, bounded slice review,
and integrated final review pass with all accepted findings resolved. Corrections
remove an unused panel helper, reject encoded ingestion paths, and progressively
reveal source groups in batches of five without changing citation numbering.

After the corrections, 100 source/retrieval tests, 35 chip/retrieval tests,
Chat and Playwright typechecks, formatting, and both browser regressions pass.
Separate agent-browser inspection confirms progressive disclosure through all
fourteen groups. Desktop/mobile screenshots were inspected. The exact task
runtime is verified Stopped with zero routes; data and the worktree are retained.
Target mergeability against fetched `v3` passes without integrating unrelated
changes. Hosted checks and human review remain prerequisites before merge.
No staging deployment or live retrieval proof is claimed. The entries below
record earlier verification and recovery states, not active delivery blockers.

Both focused host browser tests pass through the explicit Chat-profile,
preserve-database launcher path. The larger-result test proves shared citation
numbering across two documents-mode calls, disclosure from five to seven chunks,
and inspectable groups beyond the twelve-citation cap, before and after reload.
The original test also passes with desktop and mobile German/reduced-motion
coverage. These are synthetic persisted-message UI checks, not live retrieval
or staging deployment proof.

The launcher defaults remain unchanged. Its new explicit local-only options
skip global reset/seed but do not suppress selected specs' own fixture writes.
Fresh verification passed 608 Chat tests (21 skipped), the Playwright typecheck,
all 35 package checks, lint and other container-native repository guards, and
all 62 host CI/Devrouter contract tests. The combined check command cannot run
the host-only Devrouter contract in the container; equivalent checks ran on
their required sides. The unchanged application build passed all 23 tasks.
Source review, commit, and draft publication remain pending. Historical
recovery entries below describe earlier states, not current blockers.

### Recovery checkpoint, 2026-09-07 evening

Follow-up root cause is confirmed: a Git subprocess remained in the preparation
group after Turbo exited and drained naturally within one second. The reviewed
local Devrouter correction `4906119` allows at most ten 0.1-second natural-drain
checks, retaining cancellation and persistent-child rejection. Linux process
reconciliation tests now pass in the exact RAG container, including the new
drain regression and existing cancellation/persistent-child cases.

Controlled Chat-only recovery passes with ready status, zero drift, and no
recreation. All eight retained container IDs and named/anonymous volume
identities match the preflight; six selected containers run, while LiteLLM and
MailHog remain stopped. The ineffective consumer `--no-daemon` change and its
assertion were removed, restoring both runtime scripts to the branch baseline.
The repository runtime-helper suite passes in the container.

Required agent-browser inspection now passes on the existing persisted synthetic
conversation after normal test-participant login: keyboard tool expansion,
full-passage disclosure, exact origin query/fragment, two groups/three chunks,
unchanged citation 1, reload, and mobile reduced-motion rendering without
horizontal overflow. Screenshots inspected at `/tmp/rag-chunks-expanded.png`
and `/tmp/rag-chunks-mobile.png`. No database reset or upstream model request
was needed. This does not cover the remaining larger-result acceptance matrix:
more than five chunks, multiple documents-mode calls, and groups past the
twelve-citation cap. RAG source review and draft publication remain pending.
Managed shutdown completed after these checks and freed all four task routes;
the exact provider is Stopped. Browser session `rag-acceptance` is closed.
The host Playwright launcher still requests the default full profile and its
global setup resets the database. Before the remaining matrix, use a reviewed
scoped profile/fixture path; do not run that reset as incidental verification.

Installed Devrouter and latest published release both verify as 0.0.57.
The local stopped-profile recovery candidate now includes cancellation fencing
in commit `df0eed3` in the existing Devrouter recovery worktree. All 1,119
Vitest tests, TypeScript, Biome, build, package smoke, staged secret scan and
commit hooks pass. The same independent final reviewer cleared the correction.
Linux process tests remain skipped on macOS.

Controlled `ensure --repair --profile chat` reached the selected Chat preparation
without replaying the full-profile seed guard. All nine selected dependency
build tasks passed from cache. Startup nevertheless failed with `Preparation
for 'klicker-dev' left running children; a synchronous foreground command is
required.` The rollback retained diagnostic containers. A subsequent process
identity snapshot showed only init, sleep, and the diagnostic ps process; it
does not establish which child triggered the guard because cleanup ran first.
The next investigation must capture process identity at that failure boundary,
not assume disabling Turbo's daemon fixed it or relax the guard. Exact managed
stop completed; source-path ownership is present, provider state is Stopped,
and route count is zero. No browser acceptance, reset, deployment, or staging change
ran in this continuation. RAG implementation remains uncommitted.

The Chat tool badge currently reports an empty search when retrieval returned material that cannot become a citation card. Participants also cannot inspect all retrieved chunks. The proposed repair separates retrieval status from citation availability and shows readable chunks grouped by source, with full-text disclosure, a document name, an available original URL, and each chunk's supplied page or timestamp.

Existing numbered citations must keep their meaning after reload. Previously excluded sources will therefore appear as unnumbered chunk groups, not enter the historical citation sequence. Missing names receive a neutral label. Missing public origins remain explicitly unavailable; links are never inferred from document text or internal ingestion addresses. Supplied website anchors remain intact. PDF and video jump links require verified locator semantics.

This is one source-only package against `v3`. It changes no model provider, database schema, authorization, source ownership, or corpus. Approval permits isolated implementation, focused tests, synthetic local browser verification, independent reviews, commits, an ordinary task-branch push, and a draft PR. It does not permit merging, release promotion, deployment, staging data repair, or cluster changes.

Success means the reproduced false-empty case is fixed; every returned chunk remains inspectable; supplied origins are preserved safely; and existing citation associations survive local persistence and reload. The terminal condition is a verified draft PR. Missing upstream metadata will be reported separately, not disguised as a successful provenance repair.

## Execution details

### Working context and authority

- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`.
- Worktree: `trees/rs/rag-chunk-display`; branch: `rs/rag-chunk-display`.
- Target: `v3`, selected by the repository declaration and the preceding isolated Chat repair scope. No existing PR selects a different base.
- Baseline: `b8a3e9f04d02b90165c4647c52a179c1ab7c632a`, equal to fetched `origin/v3` when created.
- Compared staging source: `654621094c63b977937202269c210edc0af1e8c2`; its source normalizer matches the target baseline.

The primary checkout has unrelated changes and is 29 commits behind `origin/v3`; leave it and all older citation worktrees untouched. In particular, the dirty `rs/citation-origin-v3` worktree is not this package. Its historical plan provides context, not permission to move its files.

Authority: the user approved the full expanded-display sequence and requested an active goal on 2026-09-07. Terminal: verified source-only draft PR. Boundary owner: self. Pause for a changed citation contract, new data access or provider, unavailable required verification/review, or separately gated external action. Ordinary implementation delivery is not a new approval gate.

### Findings and reproduction

1. **False empty result:** `getDocQueryChipState` in `apps/chat/src/components/tool-fallback.tsx` counts `normalizeSourcesFromParts` output. The normalizer drops an internal-reference source without a usable title. A synthetic exact-deployed-source Node harness returned one retrieved source and one chunk, zero normalized sources, and `doneEmpty`. The user-visible staging conversation shows the same contradictory badge beside an answer citing retrieved material.
2. **Missing origin and chunk detail:** documents-mode normalization reads `reference` but not `source_url`. A second synthetic fixture with an internal reference, public `source_url`, and two chunks loses the public URL and retains only the first excerpt. Both direct and structured MCP envelopes parse in this reproduction. The current expanded panel shows a query and source hint, not a chunk list. Its argument reader recognizes only `query`; verify producer argument aliases before widening it.

These checks isolate consumer defects. They do not prove that the current indexed staging record contains a public origin. The scoped ingestion-source investigation remains separate from live metadata and corpus repair.

### Primitive impact

| Product primitive | Disposition | Contract and consumers |
| --- | --- | --- |
| Chat source citation | Reuse | Preserve derivation from persisted tool parts, eligibility, identity, deduplication, and message-wide numbering. |
| Retrieved course material | Compose | Expose already returned chunks and metadata in the tool panel without changing retrieval or access. |
| KB resource | Reuse | Display an accepted public origin when supplied; never convert an upload gateway into participant access. |

No new durable product object is introduced. ADR 0004 remains unchanged because derivation and persistence do not change. Update `docs/chat-platform.md`: its existing expanded-panel contract becomes inaccurate.

### Result, identity, and link contracts

Use one result interpretation for badge and panel: running, explicit failure, recognized successful payload, explicitly empty source collection, or unknown/unreadable. A nonempty collection containing unreadable entries must not become an empty search. Bound decoding of direct, JSON-string, text-envelope, and structured-envelope forms; preserve envelope and payload errors. Support `question` and the existing `query` argument. Keep non-RAG tools unchanged.

Do not use the deduplicated, capped global citation list as the retrieval count or chunk list. Preserve legacy citation eligibility and identity even when improving display labels or navigation. Previously excluded groups stay unnumbered. Associate numbered groups with existing message-context citation IDs; never start a new citation sequence inside each tool call. Results beyond the citation cap remain inspectable without invented numbers.

Use stable tool-call/source/chunk occurrence identity for presentation when canonical identifiers are absent. Never use a translated fallback title as identity. Retain each chunk's own content and locator; source-level first-chunk metadata does not describe later chunks.

Prefer a validated external `source_url` over a safe external `reference` for navigation only. Reject unsafe schemes, credentials, internal/private transport targets, and ingestion endpoints. Preserve the submitted URL's query and fragment. Do not derive origins or trusted names from chunk body text. Show an explicit unavailable state for missing provenance.

Show supplied page labels and timestamp ranges. `page_number` must have verified physical, one-based semantics before it generates a PDF jump link; otherwise display the supplied locator without claiming navigation. Use structured `start_sec`/`end_sec` as seconds only under the supported retrieval contract. Generate PDF or video jump links only for known media and supported locators, separately from the original source link. Do not overwrite an authoritative website anchor. Unknown semantics degrade to display-only metadata, not guessed deep links.

Render chunk bodies as escaped plain text with readable wrapping and disclosure for long passages. Full text must remain available. Avoid raw JSON and internal endpoints in participant-facing RAG fallback/error states. Preserve keyboard disclosure, collapsed-panel inertness, focus visibility, reduced motion, and bounded initial rendering for large results.

### Delegation and implementation slice

| Slice | Owner | Bounded assistance | Acceptance |
| --- | --- | --- | --- |
| Repair retrieval status and expose complete chunks | Main | Trusted explore maps producer metadata; executor owns the chunk component and its behavior checks after main supplies settled inputs. Main retains normalization, identity, safe links, and integration because those contracts are coupled. | Focused suites, Chat build/check, synthetic browser matrix and reload, committed-range simplification and risk review, integrated final review. |

One cohesive slice and one draft PR; do not create separate checkpoint PRs. Use the existing Chat components, translations, and test tooling without dependencies. Read the applicable assistant-ui, browser, testing, and runtime-lifecycle instructions before implementation or runtime use. Stop the exact local runtime after verification unless explicitly retained by the user.

### Verification portfolio

| Consequential behavior | Obligation and primary seam |
| --- | --- |
| Retrieved material is not classified empty because citation metadata is absent | Extend `apps/chat/test/tool-fallback-doc-query.test.ts`: success, explicit empty, unknown, running, error precedence, supported envelopes, and query aliases. |
| Origins and identities remain safe and stable | Extend `apps/chat/test/normalize-sources.test.ts`: missing titles, distinct uploads, supplied origin versus internal reference, mixed named/unnamed sources and multiple calls without citation shifts. |
| Chunk-specific locators yield only supported links | Extend `apps/chat/test/source-display.test.ts`: physical/printed pages, seconds/ranges, original queries/fragments, unavailable metadata, unsafe/internal URLs. |
| All chunks are inspectable and retain citation associations through reload | Extend the existing `Chatbot Source Citations` block in `playwright/tests/Y-chat.spec.ts`. Reuse its synthetic persisted-message helpers in an isolated local test database; widen the documents fixture for optional titles, origins, and timestamp ranges. Verify disclosure/full text, multiple chunks/calls, citation cap, unnamed groups, and reload. |

Use the existing Playwright block for mounted behavior instead of adding a DOM test environment or duplicate fixture. Browser acceptance covers mobile/desktop, EN/DE, long text, keyboard expansion/collapse, focus, and reload. Local tests prove reconstruction from locally persisted synthetic messages, not model-generated persistence or deployed staging behavior. No live model calls or staging database writes are required.

Run package-native focused tests and Chat build/check in the configured container; run Playwright on the host against that exact test runtime. Inspect the final diff for unrelated edits and data hygiene. Commit the substantive slice, run simplifier and a risk review covering identity/URL exposure, then integrate corrections and run the final independent review before draft publication.

### Research and limitations

This is a repository-contract repair, not an external framework migration. Main-source probes and a trusted read-only producer map supply the implementation evidence. Consult current framework documentation only when implementation depends on framework-specific APIs. Missing producer metadata may require a separately scoped upstream repair or reingestion; this package does neither.

### Review and progress

Native planner reviewed draft v1 and requested explicit historical numbering, result validity, identity/locator semantics, and existing browser seams. All findings were accepted in v2. The planner approved v2 with the existing Playwright fixture instead of a new mounted-test fixture. The optional opposing-provider challenge failed before work because the CLI rejected its required model/effort selection; it is not a passed review.

Investigation and plan review are complete for the Chat correction. The user approved execution and the goal is active. Source implementation and isolated-runtime preparation are next; verification, reviews, and draft publication remain. Staging acceptance remains pending a separately authorized deployment.

### Execution checkpoint, 2026-09-07

#### Current progress after acceptance audit

The user approved managed startup repair without another database reset.
Latest-release verification through host `gh release view` confirms Devrouter
v0.0.57, matching the installed CLI. The task's `.devrouter.yml` now declares
0.0.57. Both intervening adaptation prompts were inspected. Foreground
preparation now passes `--no-daemon` to Turbo, with a command-contract regression
in `util/test-dev-runtime.sh`; the synthetic runtime-helper suite passes.
This is a candidate repair, not successful application proof.

The next `ensure --profile chat` still fails during retained recovery of the
old full profile, before the revised Chat preparation executes. Managed
`exec` remains blocked. Source inspection confirms Playwright cleanup deletes
courses/users, cascading to Chatbot and ChatbotMCPConfig, while retaining the
standalone KB server. The authenticated seed guard therefore cannot pass on
that test baseline. No guard relaxation or database mutation was performed.
The exact runtime is verified Stopped with zero routes after this attempt.
Profile resolution itself passes and selects Chat/API/Auth/PWA without MCP.

Delivery is pending. Implementation remains uncommitted at plan commit
`683608d167cb9c51385b1ef4bce0a256a6c173ce`; no PR exists. Ref refresh
confirms the task tracks `origin/v3`, one commit ahead and one behind.
No target integration is currently required by the source diff.

Reuse the recorded passing full build, package checks, Chat tests, and
desktop/mobile persisted-browser proof for unchanged source. The acceptance
audit confirms three remaining panel obligations: disclosure beyond five
chunks, shared numbering across multiple documents-mode calls, and inspectable
groups beyond the twelve-citation cap. Extend the existing synthetic browser
fixture for these cases and repeat them after reload. The separate required
agent-browser inspection has not run. Slice and final review remain unstarted.

Fresh host verification passed all 27 dependency-free tests across the
Playwright profile runtime, host launcher, and Git identity guard. Bounded
Opengrep analysis ran 210 rules on the five changed RAG source files with zero
findings. Whitespace validation passed.

Managed Chat-profile startup failed with `Preparation for 'klicker-dev' left
running children; a synchronous foreground command is required.` Its rollback
then hit `Authenticated fixture startup failed; no credentials logged` in the
stored full profile. A focused container test invocation was rejected with
`Lifecycle transition is blocked.` These failures occurred with installed
Devrouter 0.0.57. No new reset, seed repair, process-guard bypass, or runtime
configuration edit was performed. Managed stop was requested for the exact
task source path; final stopped-state verification is recorded below.

Managed stop completed successfully. `devsy workspace status` confirms
`rs-rag-chunk-display` is `Stopped`; managed shutdown reports zero routes freed.
The worktree and synthetic runtime data are preserved.

The next executable acceptance step requires repaired managed lifecycle.
Do not repeat database resets as a substitute for that repair. The main session
retains implementation ownership after the prior executor's bounded failure;
the read-only acceptance audit is complete and its child is closed. Earlier
checkpoint paragraphs below are historical, not current gate status.

Implementation is present, uncommitted, in this task worktree: dedicated chunk groups, full-text disclosure, safe origin navigation, chunk-specific video timestamps, neutral unavailable states, and legacy citation identity preservation. Added regression coverage for unnamed retrieval status, nested errors, question arguments, safe URLs, timestamp navigation, and persisted chunk disclosure/reload. No staging mutation or deployment occurred.

Fresh verification: Chat Vitest passed 608 tests (21 integration tests skipped); root package check passed all 35 Turbo tasks; focused Biome and Prettier formatting passed. Root check:all did not pass as one combined command: its host-only Devrouter profile test cannot run inside the container. The isolated profile test passed all 11 tests on the host. Remaining lint/build and browser verification are not complete.

Browser evidence from the earlier run exists under ignored playwright/test-results, and the expanded screenshot was inspected. After adding keyboard coverage, rerunning through the host launcher failed during managed post-start with `Authenticated fixture startup failed; no credentials logged`. Devrouter reported degraded lifecycle drift. Subsequent lint/build commands were blocked by that transition. The exact task runtime is being stopped through devrouter; no raw container repair or deletion is authorized or performed. Resume by resolving that exact lifecycle, running remaining checks and browser matrix, then committing and completing the required reviews before draft publication.

Remote refresh: task branch tracks origin/v3 and is one commit ahead and one behind it. The target moved to 7c73ed231c; no upstream merge or rebase was performed. The goal remains active and the source-only draft PR terminal condition is not yet achieved.

Managed stop subsequently succeeded for rs-rag-chunk-display and reported all 10 task routes freed. Worktree and runtime data were preserved. Browser re-entry must first prove managed startup; do not treat the generic bootstrap failure as a diagnosed credential defect.

Follow-up diagnosis: exact-container read-only metadata confirms one local KB server with bearer authentication and zero ChatbotMCPConfig rows. The seed ownership assertion fails; it requires two specific Benibot mode configurations. Playwright uses a separate chatbot and baseline, so its persisted fixture is not the dev MCP seed. A requested chat-only recovery still executes the stored full-profile post-start first and fails at this guard. No guard bypass, credential output, database reset, or seed repair was performed. The next decision is whether to authorize a reset/reseed of this task's isolated synthetic database or repair the launcher/profile lifecycle separately. Added mobile German/reduced-motion browser variant remains unverified. Managed stop is again in progress after this recovery attempt.

Final recovery checkpoint: managed stop completed successfully; exact application container state is exited and task route count is zero. Diff whitespace validation passes. The same local runtime blocker has persisted across three goal turns; further runtime verification requires the requested synthetic-database reset approval or a separately scoped lifecycle repair. Goal is blocked pending that decision; implementation, required reviews, and draft publication are not complete.

The user subsequently approved the isolated database reset and reseed. After managed startup reached the known guard, the exact owned container ran the repository-native Prisma reset, schema push/generate, and seed:raw sequence against its validated local postgres service. All commands exited successfully; the seed recreated KB tutor and explainer configurations. Synthetic conversations were removed as approved. Source files, staging, and other worktrees were untouched. Managed full-profile readiness is being re-established before verification resumes.

Managed full-profile recovery now passes with healthy services, running MCP/application processes, and no drift. Lint passed all seven tasks. The host Playwright dependency refresh passed with the exact pnpm 11.5.0 binary and frozen lockfile; the Volta wrapper previously selected incompatible configuration. Run managed commands serially: devrouter exec also holds the lifecycle lock, so concurrent ensure is rejected. Full build is in progress; Chat compilation and its production route generation have passed, but aggregate build completion and browser matrix are not yet proven.

Verification after recovery: full build passed all 23 tasks. The focused host Playwright test passed in 15.3 seconds, covering desktop, persisted reload, keyboard expansion, full passage disclosure, original URL and citation identity, and mobile German with reduced motion. Desktop and mobile screenshots were inspected. Run the host launcher with Node 24.16.0 prepended to the existing PATH, preserving provider discovery; replacing PATH hides the supported Devsy executable. Managed stop is completing; the exact application container is already exited. Required slice/final reviews, remaining acceptance audit, commit, and draft PR remain pending. No further reset or staging action is required for the verified evidence.
