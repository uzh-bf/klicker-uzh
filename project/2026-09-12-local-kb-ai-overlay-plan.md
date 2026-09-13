# Opt-in AI for retained local KB acceptance

## Approval summary

The user approved restoring scoped registry access, adding an explicit AI
overlay, and completing one public-PDF ingestion and citation test. The local
launcher currently strips upstream credentials, so starting the infrastructure
does not enable embeddings or real retrieval. Add one optional OpenRouter mode
to the existing isolated configuration and supply its credentials only during
authorized host-side launcher execution.

Approval mode: executable batch. This package covers source implementation,
focused checks, independent reviews, normal push and draft PR, and the already
approved local acceptance journey. It does not authorize a new source merge,
production, graph generation, or deletion. Existing test data is retained.

Default configuration stays credential-free. Opt-in startup requires runtime
injection through the restricted Infisical operator. No upstream credential
may enter generated files, receipts, command arguments, or diagnostics.
Only LiteLLM receives it among containers. The trusted host launcher chain and
its initialization hook inherit the runtime environment. Public PDF content and synthetic questions may reach
the approved OpenRouter upstream; this entails ordinary model and embedding
usage. No bulk evaluation or unrelated content is included.

Completion requires reviewed source and successful PDF ingestion, cited
retrieval, and retrieval of the same retained resource after stop/resume and
browser reload. Health checks alone do not establish acceptance.

## Execution details

### Context and evidence

Repository: KlickerUZH. Target: v3-ai at
`d1e1fafadd62be82cb68273659c94ac913ea2e5b`, confirmed through GitHub and a
same-repository HTTPS fetch after the SSH signing agent failed.
Branch: `rs/local-kb-ai-overlay` in `trees/rs/generation-lifecycle-contracts`.
The preceding source branch and pristine detached acceptance checkout remain.
Artifacts remain in `project/`; the plan was committed as `54129eaa28` after
the user approved implementation-worktree startup and its normal hooks passed.

Baseline launcher tests pass 68/68. Both ingestion images from merged provider
revision `3eaee85555a01d45e425c93bb9bf058d4a782e91` were pulled and their
revision labels verified. Scoped registry access now uses the existing macOS
Keychain helper. No real AI key has been injected and no runtime has started.

### Binding contract

- Optional `aiUpstream: 'openrouter'`; omission preserves the existing resolved
  configuration shape. Reject unsupported modes. The existing preparation
  digest binds the non-secret mode, preventing retained configuration changes.
- Accept `UPSTREAM_OPENAI_API_KEY` and `UPSTREAM_OPENAI_BASE_URL` only from
  the host process. Require a nonempty key and the exact OpenRouter HTTPS API
  endpoint before setup/start/resume can claim state or activate providers.
- Compose contains name-only pass-through entries for LiteLLM, without required
  interpolation. Setup excludes LiteLLM and does not forward the key, even
  though preflight requires it; Compose must resolve unselected services without
  credentials. Stop and status likewise resolve without injected credentials. No secret
  interpolation belongs in Devcontainer configuration or workspace arguments.
- Only the managed start call receives the two additional environment names.
  Providers, backing Docker commands, app exec, status, and stop do not.
- Resume requires re-injection. Missing injection never consumes an attempt.
  Stop and status remain available without the upstream credential.

### Delegation map and slices

S1: main owns the coupled credential seam and source integration. Extend `isolated-config.mjs`,
`managed-configuration.mjs`, `docker-preflight.mjs`, `preparation.mjs`, and
`util/local-kb-stack.mjs`, plus their existing relevant tests. No provider,
data-model, dependency, or routing-policy changes are planned. Commit the
reviewed plan before implementation. Run simplification and a risk-selected
review on the committed slice. Integrated final review follows the complete
source package, including S2 documentation and applicable verification.

S2: main owns tightly coupled local runtime acceptance and updates
`docs/solutions/integration/local-kb-stack.md`. After S1 and the synthetic
transport gate pass, create a fresh detached runtime checkout at the reviewed
implementation commit; preserve the existing pristine d1e1faf checkout. Bind
that candidate and the verified provider/image pins in its input and run one
successful canonical setup before start. Start the exact isolated stack
through its canonical launcher, prove worker readiness, submit one public PDF,
and verify READY, retrieval, and a correct original-source citation. Stop and
resume without setup or re-ingestion, then verify the same resource and retained
chat/citation after reload. Preserve failures and stop before any ambiguous
replay, repair, or ownership change. Stop the exact runtime at completion unless
the user explicitly requests it remain running.

### Verification portfolio

Extend `isolated-config.test.mjs` for invalid opt-in, default shape and renderer
confinement. Extend `docker-preflight.test.mjs` for the actual child environment,
secret-free argv and withheld failure diagnostics. Extend `preparation.test.mjs`
for pre-mutation rejection, retained mode binding and re-injected resume.
Extend `util/local-kb-stack.test.mjs` for CLI rejection before its preparation
claim. Reuse existing synthetic fixtures and avoid duplicate coverage across
these primary seams. Test obligation is none for guide wording and the manual
acceptance journey. Run
`node --test util/local-kb/*.test.mjs util/local-kb-stack.test.mjs` and focused
repository formatting checks. Browser and live ingestion evidence remains a
distinct acceptance boundary, not inferred from these tests.

### Transport evidence and verification gate

The selected runtime is Devsy 1.16.2 through Devrouter 0.0.77. Devrouter
inherits and forwards the host environment to Devsy. Devsy's Compose helper
uses the agent's environment; its generated primary-service override does not
copy sibling LiteLLM variables. The local Docker provider's agent inherits the
host environment through its local shell and SSH child (Devsy v1.16.2 commit
232bbfc14a5430799c6ded50736e0707be5f7302). Its
`WorkspaceEnv` path is unacceptable because upstream source documents that it
travels in setup argv. Verify with a synthetic sentinel before real injection.
The checked host initialization hook does not print its environment; it runs
the dependency-mount generator, local certificate copy, and cache-volume check.
The sentinel must reach LiteLLM and be absent from app/other container
environments, generated workspace/Compose/override files, lifecycle logs,
status output and preparation receipts on initial startup and retained resume.
Record only boolean results. Unsupported transport blocks
S1; do not substitute an environment file or credential-bearing argument.

## Progress

### Approved pending-ingestion recovery

The user approved the local MinIO registry correction and one bounded recovery
of attempt C. Provider source and workload pins stay unchanged. The separately
published [MR !158](https://gitlab.uzh.ch/ai-infrastructure/services/data-ingestion/-/merge_requests/158)
corrects future local starts. For this retained attempt, verify the Quay release
label and digest, require the legacy local image reference absent, then add that
local alias and verify image-ID equality. No provider source edits or claim
rebinding are permitted. Initial ingestion credentials are part of setup;
existing document-processing credentials must not be recreated.

Extend the existing continuation with `--resume-ingestion-executor`, mutually
exclusive with the profile-resume option at both CLI and function boundaries.
Validate the root profile executor separately from the child ingestion executor:
the child's resumeExecutor must link to the original root claim. Require exact
root entries (claim, profile intent, resume-after-profile) and exact child
entries (claim, bootstrap intent, document-processing reconciliation, ingestion
intent), all matching candidate/config/context and their respective executors.

Require original bootstrap containers exited and managed application absent.
Scraping and document processing must have valid completed receipts and matching
prepared/stopped native status. Retrieval remains untouched. Ingestion must
have no completion receipt, all three native preparation states pending,
infrastructure stopped, exact private state inventory (manifest, compose-project,
project-configs), matching bound identity, no credential files, no owned
containers/networks/volumes, and no occupied bound ingestion ports. Preserve
pre-bootstrap checks and recheck immediately before setup. Boolean not-prepared
alone never qualifies recovery.

Create `setup-continuation/resume-after-ingestion` exclusively. Record claim,
bootstrap intent and ingestion intent before the corresponding effects. Invoke
the existing provider setup once, require its actual preparation success, then
write the consumer receipt exclusively and continue normal downstream setup.
On command, observation or receipt failure, retain the attempt and prohibit
re-entry or downstream execution. Preserve every predecessor receipt.

Delegation map: R1 main owns the coupled three existing source files and
integration, with the state contract above as acceptance. R2 main owns existing
test extensions until settled separable tests are assigned to a named executor;
R3 main owns approved local proof after exact-source checks and reviews.
Main retention reason is unresolved cross-system lifecycle coupling. No new
source/test modules. Extend the existing preparation tests for lineage/state
rejection, exactly-once invocation, concurrency, retained failure and downstream
ordering; provider observation tests for all-pending versus mixed/missing states
and withheld diagnostics; CLI tests for exclusive valid options and malformed
arguments. No tests pin plan wording or manual image-alias commands.

Baseline remains 81/81 passing source tests. The real acceptance journey remains
unproven. Planner Jason requested the explicit lineage, pending-state and
failure details above; the same planner approved the corrected scope.

### Approved retained setup continuation

The profile repair completed, then executor bfcd67bbbfb511e963767ec4b978d384b13978b7
stopped before bootstrap with `Repaired setup profile could not be qualified`.
The user approved correcting and continuing this exact retained prefix. Planner
Mill approved the corrected design: use exact-path workspace allocation status
`absent` and zero routes, not the workspace identity field. Preserve Docker
label checks. Explicit `--resume-executor` validates the original two-file
attempt and creates one exclusive child, never clearing its parent. Require
the known provider prefix (scraping complete, document processing reconcile,
ingestion/retrieval untouched), original exited bootstrap containers, exact
bootstrap configuration, and corrected managed bytes before effects. Write a
bootstrap intent before starting services. Missing intent alone is never proof
of absent effects: execution authority is limited to the observed failed
executor above and original candidate 8207c964. Main owns source and runtime;
executor owns existing regression tests. No new modules or generalized retry.

Runtime preflight found that installed devrouter 0.0.77 rejects the generated
empty setup profile. Fold the bounded correction into this recovery: select
the already-declared redis_exec service with no routes or managed processes.
Accept only the exact previous empty profile representation, record intent
before replacing that generated file, then revalidate with devrouter. No
other generated configuration change is permitted. This adds the existing
managed-configuration.mjs and isolated-config.test.mjs paths to R1. A synthetic
profile resolve confirmed the corrected selection has zero routes/processes.

Planner Pauli approved the continuation section before implementation. Source
slice 575f46edbd passes 76 focused tests. Its normal app hook is unavailable
because the app container is stopped; focused source checks and staged
gitleaks passed before the explicitly recorded hook bypass. Full app checks
and integrated final review remain pending. Simplifier recommended one shared
managed rendering function, accepted. Correctness review is in progress.

Correction a78d226785 passes 77 tests. Slice review found no implementation
defect. Claude final review completed on the integrated range with four
recoverable findings. Main verification confirms the ingestion Compose naming
matches the pinned provider's `compose_project` implementation; moving it into
a separate contract constant would not enforce future provider compatibility.
The suggested repeated-continuation consistency issue does not apply: an
existing continuation intent always rejects re-entry. Accepted the fsmonitor
argument alignment. Values-free preflight found the retained state root and
scraping directory at 0755; tighten those exact owned directories to 0700
before execution, as documented. Candidate source and exact legacy managed
profile passed the real read-only verifier. Full runtime acceptance remains
pending; no PDF or model call has occurred.

The user approved implementing, reviewing and executing a bounded
`continue-setup` command on retained attempt C, followed by the original
acceptance journey. The implementation branch is `rs/local-kb-setup-recovery`
in the same worktree, based on `3d31c0d9cb67f80c1ec09d0f954c555eed46e467`.
Runtime candidate remains `8207c964016b3f1c735c678e6563bfe96d604f5d`.
This correction is full-path because it crosses retained lifecycle state.
No KB product model changes; existing provider lifecycle contracts compose.

The command must preserve normal setup's exclusive claim and normal start's
requirement for complete preparation. It validates the original claim,
configuration digest, actual detached candidate, managed configuration bytes,
completed storage receipt and exact local Docker context. Recovery runs from
a separately committed clean implementation checkout; it records that code
revision, without copying code into C or changing C's claim. The operator
reviews the exact executor/candidate pair before execution.

Before effects, observe providers individually. A private completed receipt
plus matching prepared native status is skipped. A provider with matching
prepared native status and no consumer receipt may be reconciled by writing
the missing receipt exclusively. Failed observations never imply unused
state. New setup requires an absent provider state directory, absent consumer
receipt, no owned runtime resources, and no previous continuation intent.
For ingestion, check its configured deterministic Compose project for
containers, networks and volumes; retrieval must have no state or occupied
listener. Recheck before invoking setup and retain an intent before effects.
If untouched ownership cannot be established, fail without initialization.

Use one private exclusive continuation directory to prevent simultaneous or
repeated continuation. A failed continuation remains retained. Do not add a
general retry engine. Validate the entire stage classification first, then
continue in the existing dependency order. Preserve all prior receipts.
Only restore verified existing consumer bootstrap services when needed;
never rerun token creation or storage initialization. After validated provider
success, write the existing aggregate completion receipt. Managed application
initialization is allowed only when its attempt and managed runtime are
proven absent; reuse the existing initialization and completion operations.
No automatic application start or model call occurs in this command.

Delegation: R1 main owns lifecycle decisions and integration; a bounded
executor may own settled source/test changes. R2 main owns exact runtime
qualification and acceptance because it couples credentials, state and UI.
R1 source scope is util/local-kb/preparation.mjs, provider-commands.mjs,
util/local-kb-stack.mjs and their existing tests. R2 updates this plan and
docs/solutions/integration/local-kb-stack.md. No new source modules.

Test portfolio: extend preparation tests for valid partial continuation,
zero repeated completed-stage setup calls, exclusive intents, identity or
configuration drift, ambiguous state, partial application setup and failures
after effects; extend provider observation tests for individual identity and
readiness validation; extend CLI tests for pre-effect rejection. Reuse the
71 passing baseline tests. Documentation needs no content-pinning tests.
Commit the plan, implement one cohesive source slice, run focused checks,
then simplifier and slice review, integrated final review and normal draft
delivery. New merge authority is not implied. Execute only reviewed code on
C, preserve failures, and stop the exact runtime after the original proof.

- Recovery correction: attempt B never created a preparation claim. The strict
  source check rejected Python/test caches and local review artifacts in two
  provider worktrees. Preserve those worktrees and use clean detached provider
  checkouts; no cache or review-artifact deletion is needed. Planner Pauli
  approved the corrected recovery approach after identifying ingestion's
  separate sanitized subprocess environment.
- Disable bytecode writes in consumer launcher commands and the explicit
  document-processing environment. The corresponding ingestion launcher fix
  lives on `rs/local-launcher-source-cleanliness` from `origin/main@c95cfaeb`.
  Its focused regression runs a real child import and verifies no bytecode
  directory appears and unrelated ambient credentials remain excluded.
  Launcher tests pass 71/71; ingestion tests pass 18/18 and focused Ruff passes.
  These are host source checks, not full runtime acceptance.
- Ingestion binds workload image revision to launcher revision. The corrected
  provider must have matching published images before the next setup; old image
  digests cannot qualify the corrected source. No setup replay or PDF submission
  occurred during this correction.

- S1 implementation committed at `f3a372f98a63d3eda5d35a00e8b77e0232066ba2`.
  Nine source/test paths; 247 added and 21 removed substantive lines.
  Three tests added and existing configuration/restart tests extended;
  focused suite passes 71/71 in the container. Full normal pre-commit passes.
  Simplifier and GLM slice review passed on the exact committed range; their
  reports are retained under `project/_local/reviews/`.
- S2 guide committed at `5d1fd4b4a30846c9904960c107fd31c21fdabe6a`.
  Package size excluding project artifacts is 305 changed lines. There are no
  schema, dependency, or visible UI changes. Source verification does not prove
  the runtime credential transport or live ingestion path.
- Fresh isolated setup at that candidate failed during document-processing
  Hatchet token creation with `backing_command_failed`. The launcher retained
  `token_intent: true` without a client-token receipt. No replay is authorized;
  preserve the failed attempt. Backing containers were stopped and data retained.
  The underlying command stderr was discarded, so its precise cause is unknown.
- The synthetic transport probe did not reach managed AI startup. No real AI
  key was injected and no PDF submitted. PDF/citation and retained restart proof
  remain blocked on provider setup recovery and successful transport verification.
- Implementation runtime was verified stopped with zero routes, then resumed
  only for normal publication hooks. Stop it again after those checks.
- The initial final-review process ended without a recoverable report. Its one
  replacement completed on the unchanged source range with one documentation
  finding: distinguish source guarantees from unproven downstream containment.
  Accepted and corrected; the sentinel gate now explicitly checks negative
  containment. No executable source correction was requested. Main-session
  verification closes this non-behavioral correction under the review policy.
- [Draft PR #5934](https://github.com/uzh-bf/klicker-uzh/pull/5934) is published.
  Normal pre-push build passed 26/26; exact-head CI began, with Gitleaks and
  GitGuardian green at first readback. It remains draft pending acceptance.
  Target freshness confirmed
  `origin/v3-ai@f00e272adf40dd3cbe2c648935cde1d99727af59`; its 11 intervening
  commits do not overlap the changed source, so no integration was necessary.

### Prior preparation evidence

- Registry recovery and immutable image verification complete.
- Baseline source checks pass 68/68; no implementation changes yet.
- Planner James approved hardening round 2. AGY Gemini 3.8 Flash high independently
  returned APPROVED. Implementation and its reviews have not started.
- Normal pre-commit passed gitleaks, then failed: the implementation worktree
  has zero running app containers. No bypass or commit occurred. The 68 passing
  launcher tests do not replace the full container check suite.
- Runtime setup, PDF ingestion, retrieval, and retained restart remain unrun.
