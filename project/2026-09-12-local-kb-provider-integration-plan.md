# Complete the local KB provider integration

## Approval summary

The user approved completing a reproducible local KB stack on 2026-09-12.
Klicker must invoke each provider's supported launcher, bind its explicit
dependencies, and prove PDF ingestion and cited retrieval after a retained
restart. The previous package, PR #5887, delivered configuration and launcher
projections but retained a second, consumer-owned provider Compose assembly.
This follow-up closes that integration gap under ADR 0018.

Approval mode: executable batch. Main owns integration and acceptance. Source
changes, focused checks, reviews, ordinary pushes and a draft PR are authorized.
The current execution boundary is source-only delivery. The eventual local
journey includes setup, start, stop, retained restart, one public PDF ingestion
and synthetic questions about it; it is not authorized by the source goal alone.
No runtime activation, paid queries, ingestion submission, graph build,
deployment, production action or retained-data deletion is part of this
continuation. The user separately authorized the two provider merges below;
that approval does not authorize future merges.

Current terminal: executable provider-launcher integration with offline
verification, independent review and source-only draft publication. Future
separately authorized runtime acceptance must run the local providers and
Klicker, survive stop/resume with the same data, and produce a cited answer
retained after reload. KG and generated-question proof remain separately gated;
never infer graph support from ingestion health.

## Execution details

Branch: `rs/local-kb-provider-integration`, based on
`v3-ai@7d378475c027b820aa46ccae5781836b3bbfa8a5`, in the existing worktree
`trees/rs/generation-lifecycle-contracts`. Its preceding branch is merged and
the worktree was clean. The primary checkout contains unrelated changes.
Artifacts remain in `project/`. No database model or migration changes are needed.

Preserve ADR 0018's provider ownership. Update its transitional note only after
the consumer assembly has actually been retired. This is a full-path package
because it changes cross-system lifecycle and configuration wiring.

### Provider dependencies

- [Scraping !33](https://gitlab.uzh.ch/ai-infrastructure/services/web-scraping/-/merge_requests/33)
  merged; squash `717beac8`, merge `24db1f13`, pipeline passed.
- [Retrieval !79](https://gitlab.uzh.ch/ai-infrastructure/mcp/mcp-doc-query/-/merge_requests/79)
  merged as `9d24dec1`; pipeline passed.
- [Ingestion !136](https://gitlab.uzh.ch/ai-infrastructure/services/data-ingestion/-/merge_requests/136)
  merged as `faad999f8a96cb9d2a25acc10fcda1d563197ac5`; exact-head
  pipeline 663180 passed at `1fa272b7dd1e05c40abbae40e11fc95ccdc39e24`.
- [Document Processing !78](https://gitlab.uzh.ch/ai-infrastructure/services/doc-processing/-/merge_requests/78)
  merged as `494c30c368313bcd9fc7953c3ec152c8ceea553a`; exact-head
  pipeline 663179 passed at `42c9f4f2cd5318bc0cf103e374f674307a2a4881`.

Both launcher merges were verified on current provider main refs. ADR 0018's
merge prerequisite is satisfied, but the backing-service ownership gap below
must be resolved before dependent consumer implementation. Do not silently move
provider branches. The ingestion local branch differs from its
remote in unrelated Office processing work and must be preserved.

### Implementation sequence and ownership

1. Main reconciles provider contracts and freezes bindings. Extend existing
   isolated configuration with explicit non-secret endpoint and port allocations,
   private configuration references and source revisions. Keep secrets out of
   plan output. Separate setup prerequisites from worker-start prerequisites.
2. A bounded executor implements settled command projection and its existing
   contract tests. Main integrates execution in preparation and application
   connection wiring. Remove obsolete provider Compose code only once the
   supported invocation path replaces it. Preserve operation locks, identity
   checks, partial-failure receipts and retained stop semantics.
3. Main verifies the source invocation contracts, runs focused checks, obtains
   independent review and publishes the source-only draft PR. Runtime checks
   remain explicitly pending rather than being inferred from unit tests.
4. After separate runtime approval, verify setup/start/stop/resume and the PDF
   citation journey. Graph generation requires its own explicit approval;
   supported prerequisites alone do not authorize a build.

### Contracts to resolve before dependent edits

Ingestion owns its backing services and creates them during setup. Document
Processing must have separate Hatchet and database dependencies: ingestion's
documented integration is HTTP-only and explicitly prohibits sharing its
Hatchet token or database. The merged Document Processing facade accepts
explicit connections but does not manage those backing services. Its legacy
full-stack script is not an instance-bound setup/start/status/stop interface.
Resolve that provider capability before claiming a complete consumer lifecycle.
Ingestion workers require Document Processing and scraping. A single flat
provider order cannot represent all phases. Start must never run migrations,
seed, rotate credentials or silently retry work.

Document Processing requires an explicit JSON configuration; the old projection
omits it. Ingestion setup requires a state DSN, model/scraping URLs and backing
ports, whereas start requires prepared identity plus optional worker activation.
Retrieval requires the actual Milvus URI and model endpoint. Provider facades
must receive configuration through their supported interfaces.

Verified launcher details for the next binding pass: ingestion's global
`--strict` precedes the verb. Setup and start require `--source-revision`;
status and stop do not. Deployment inputs belong to setup, while retained start
uses identity plus `--workers` to activate previously prepared workloads. Do
not copy setup flags into start or run setup implicitly. Document Processing
setup/start both need the explicit JSON `--config`; its isolated backing ports
are separate from ingestion's ports. Retrieval validates `MILVUS_URI` and
`OPENAI_BASE_URL` through its supported child environment. These are observed
contracts, not completed consumer wiring or live proof. The current projection
is intentionally blocked and must not be labelled executable yet.

Confirm host-versus-container addressing for callback, source Blob, Hatchet,
model access and retrieval. Do not reuse host loopback as a container address.
Confirm project-config import and image/source revision compatibility. Preserve
signed KB scoping, inactive-resource filtering and original citation provenance.

### Binding evidence to incorporate into the frozen specification

The ingestion registry contains both images tagged with merged revision
`faad999f8a96cb9d2a25acc10fcda1d563197ac5`. Its worker digest is
`sha256:a22ca74f5b9d4140ea088e1023c3b0c1ce4757d116181da7291d204d4f2d5678`;
its API digest is
`sha256:da118197548a7beb2b10817fade42f7d4e61d6b69e879a2fdfbbe77a44d7551a`.
Both use the existing `cr.gitlab.uzh.ch/ai-infrastructure/services/data-ingestion`
repository, with `ingestion-worker` and `ingestion-api` image names respectively.
These are registry tag-to-digest receipts, not local image or OCI-label proof.
The provider launcher requires installed immutable images and exact matching
`org.opencontainers.image.revision` labels; retain that preflight and never
silently pull an image or accept the previous `69fa7f92` images.

The provider owns the ingestion collection name:
`local_cli_ingestion_<instance with hyphens replaced by underscores>`.
Its schema is `ingestion_state_<instance with non-alphanumeric characters
replaced by underscores>`. Consumer project import, retrieval configuration and
the allow-list must agree with these provider identities instead of retaining
the old hardcoded `klicker_course_materials_v1` collection. Preserve KB scope
and active-resource filters within that collection. This is a fresh isolated
configuration, not a migration or reinterpretation of retained collections.

Host-facing provider APIs remain loopback listeners. Container callers use
`host.docker.internal` plus the allocated published port, without replacing
native DNS with `host-gateway`. Retrieval's host process uses loopback for
Milvus and the published model gateway. Klicker keeps its own database,
Hatchet, Redis and Blob storage; only provider-owned backing moves behind
provider launchers. Callback and source-gateway addresses must reach Klicker's
published backend, not the removed shared-network `klicker` alias. The exact
port input schema and model/backend publication remain to be frozen before
implementation; no generated configuration is executable at this checkpoint.

### Concrete allocation and phase contract

Fresh launcher configuration takes one required `ports` object instead of
independently supplied endpoint URLs. Every value is an integer in 1024–65535,
globally distinct and disjoint from retained allocations. Derive observations
and service URLs from these values, without implicit port selection.

```text
klicker: backend, model, blob
ingestion: api, dispatcher, hatchetHttp, hatchetGrpc, postgres,
           azurite, milvus, milvusHealth, milvusAttu
docProcessing: api, postgres, hatchetHttp, hatchetGrpc
scraping: api, crawl4ai, postgres
retrieval: api
```

Only Klicker's backend, model gateway and source Blob service need new
loopback publications: app:3000, litellm:4000 and blob:10000. Its database,
Hatchet and Redis stay private. Preserve existing browser Devrouter routes and
Blob CORS. No global routes or Docker DNS overrides are added.

For allocated port `p`, container-to-host bases use
`http://host.docker.internal:p`; host-to-host bases use `http://127.0.0.1:p`.
Ingestion uses the former for scraping, DP and Klicker's model gateway (`/v1`).
Klicker uses the former for ingestion and retrieval. Retrieval uses the latter
for Milvus and the model gateway (`/v1`). The source-gateway origin is Klicker's
published backend base; its completion webhook appends
`/api/webhooks/kb-ingestion`. Provider source Blob URLs use the published Blob
base plus `/klickerdev`; Klicker's internal URL remains
`http://blob:10000/klickerdev`. Do not conflate this with ingestion's separate
artifact Azurite. No DP-to-ingestion webhook is needed: the ingestion parsing
client submits extraction jobs and waits for their terminal state.

Setup writes private configuration once, initializes Klicker-owned backing and
invokes each provider setup with its explicit inputs. Retrieval setup validates
configuration without requiring running Milvus or models. Start/resume brings
up scraping and DP workers, Klicker's callback/source backend and model service,
then ingestion with `start --workers`, then retrieval. The managed profile starts
Klicker's application processes together with its required backend and model
gateway; applications starting is not retrieval readiness. The dependency graph
describes functional prerequisites, not a strict process startup order. Resume
never invokes setup. Stop reverses provider dependencies and uses
provider stop contracts; scraping may remove containers but retains volumes.
Partial failure receipts retain exact successful steps without automatic retry.

### Delegation map and test portfolio

Main owns unresolved cross-system binding, lifecycle integration and final
acceptance. After planner hardening, one bounded executor owns pure command
projection and configuration validation in `provider-commands.mjs`,
`provider-launcher-contract.mjs`, `isolated-config.mjs` and their existing tests.
Main owns the dependent `local-configuration.mjs`, `managed-configuration.mjs`,
`backing-compose.mjs`, `preparation.mjs` and `util/local-kb-stack.mjs` integration
and matching existing tests. `test-fixtures.mjs` supplies the explicit synthetic
port/image input shared by five existing test modules during schema conversion;
it has no runtime caller. Remove obsolete provider Compose modules only when
their execution callers have been replaced. Update ADR0018's transition note
and the existing local KB guide only when the implementation makes them stale.
No separate PR, extra execution owner or provider source modification is planned.

1. Command/configuration slice: extend existing tests to protect exact provider
   flags, port and source validation, private configuration references, collection
   agreement and host/container URL separation. Acceptance is pure Node tests
   with synthetic inputs; no services are required.
2. Executable lifecycle slice: replace obsolete Compose assertions with injected
   runner tests for phase order, setup-once, retained resume, partial failures,
   ownership checks and observational status. Preserve existing retained-state
   tests and failure receipts. Acceptance is the focused local-KB Node suite.
3. Integrated delivery: dedicated simplifier and cross-system slice review on
   committed implementation, followed by final review over the whole package.
   Publish one draft against `v3-ai`; do not merge or mark ready. Real networking,
   image-label, PDF, citation and restart proof remain explicitly unverified.

### Verification and reviews

Reuse the existing local-stack tests for isolation, source/configuration drift,
one-shot setup, partial failures and retained shutdown. Replace Compose-shape
assertions with invocation-boundary behavior where the implementation changes.
Extend existing tests for phase ordering, required bindings and malformed status;
avoid duplicate tests for prose or implementation structure.

Run independent simplification and risk review on substantive committed slices,
then integrated final review. Later authorized runtime proof must show actual
workers, ingestion completion, retrieval and citation persistence; offline tests
cannot substitute. Leave retained data intact. No runtime is activated by the
current source-only verification package.

## Progress

Current correction: the two simplifier findings are applied (direct configuration
construction and shared port fixture). The slice review identified missing
retrieval environment on observations/stop and a development DSN in plan output;
both are corrected with existing contract-test coverage. Setup now forwards its
verified Docker context. The startup wording above now distinguishes process
startup from functional dependency readiness; no backend/application split is
needed to start the prerequisites for ingestion. All 68 focused tests pass.
The canonical profile is `ai,chat,manage`. Corrections await their commit,
same-reviewer verification, integrated final review and draft publication.
No live provider, ingestion, model or graph proof has been performed.

### Historical checkpoints (newest first)

Implementation committed as `e43856859a0e66de2e5cc9deeb2a11c8b3c20233` after
normal hooks: redacted gitleaks, 40 package checks, formatting, lint, syncpack
and 68 local-KB tests passed. Azurite's public development account key has a
line-local documented scan exception. The exact checks-only `email` runtime
was stopped through Devrouter; container `96efd534b27f` is exited and stop
reports zero freed routes. No application/AI process or external provider ran.
Sagan (`01a095e8-2678-7e33-bb2e-cca474ab37c7`) is simplifying this range;
Dirac (`01a095e8-2715-7d63-8011-7d2350ecbeb1`) is reviewing its risk seams.
Both start at `a73299c45b49d4d235b73d5bb9a9a29e365cd603` exclusively.
Main independently verified Devrouter's canonical profile is `ai,chat,manage`;
that correction is uncommitted and passes preparation tests 19/19. Integrate
verified review findings before the correction commit and final review.

Private configuration generation no longer creates unused MinIO, Crawl4AI or
document-callback credentials, provider database setup SQL, or obsolete provider
environment blocks. Its public entrypoint requires provider bindings; the
remaining base generator is private. Retrieval requires an explicit collection.
Tests now exercise that public entrypoint; two obsolete duplicate contract tests
were removed, leaving 68/68 passing. ADR 0018 and the local-stack guide describe
the launcher execution path and retain the unqualified-runtime boundary.
Next: exact diff/data hygiene, required commit checks, then the configured
simplifier and risk-review pair followed by integrated final review and draft
publication. No implementation commit or PR exists yet.

The six obsolete provider Compose renderers and their renderer-specific tests
are removed. Remaining fixture revisions are synthetic, not historical image
pins. The declarative graph now separates provider backing from Klicker backing;
provider state records identify launcher-owned roots rather than invented Docker
volume names. The remaining offline suite passes 70/70. No runtime, data,
branches or worktrees were deleted. Source removal is recoverable through Git.

The CLI plan no longer imports or emits consumer-owned provider Compose
assemblies or selects them through obsolete image-revision constants. It emits
provider launcher commands plus Klicker's own backing configuration. Provider
source preflight now uses NUL-delimited Git status and permits only the ignored
`.venv/` directory alongside a clean pinned source tree. Ignored `.env` and
other ignored/untracked files still reject qualification. This is source-custody
evidence, not installed-dependency verification. Focused CLI checks pass 10/10.
The old renderer modules and declarative ownership graph still need reconciliation
before final review; their remaining references must not become runtime claims.

Provider status now invokes supported launchers, validates instance/revision and
returns only sanitized preparation, endpoint and shutdown evidence. It never
promotes endpoint health to AI qualification. Provider Docker commands are bound
to the already-verified local context. Explicit start/resume now start scraping
and document processing, then Klicker with the `manage,chat,ai` profile, then
ingestion workers and retrieval. Stop validates provider identity, stops in
reverse order and checks stopped evidence before stopping Klicker/backing.
Setup remains separate and failed lifecycle claims remain retained.
These are source changes only; no provider runtime was activated. Remaining:
retire old configuration projections/ownership claims, reconcile installed
Python environments with source preflight, finish contract coverage, then
commit checks and independent reviews before draft publication. The provider
backing-port loopback correction remains a separate source-scope item.

The setup execution path now writes provider-specific private configuration and
invokes each supported provider setup launcher after Klicker-only backing setup.
It validates the selected local Docker context, captures diagnostics, rejects
malformed/mismatched preparation output, records successful steps and preserves
the setup claim after failure. The overall prepared receipt requires matching
provider setup evidence. Consumer backing no longer contains provider containers
or provider migrations. The full offline suite passed 77/77 before the additional
malformed-output guard; its affected preparation suite then passed 19/19.
No runtime was activated. The subsequent lifecycle integration is recorded above.
Also reconcile source preflight with installed ignored Python environments:
the existing all-ignored-files cleanliness check may reject the `.venv` needed
by the launchers' frozen/no-sync invocation. Do not infer installed dependencies
or full runtime readiness from the offline suite.

The persisted source contract now takes required `ports` and immutable `images`
instead of user-supplied endpoint URLs. Schema `isolated-local-kb.provider-config.v2`
rederives bindings during readback and rejects URL/image drift. Provider command
generation consumes those persisted bindings; the old unbound command fallback
has been removed. Klicker's generated application/model/blob publications use
only the allocated loopback ports. Existing tests were updated to the actual
contract, including replacement of obsolete unbound-input assertions. The full
offline suite passes 76/76; no runtime was started and no commit has been made.
Next: select the private provider renderer in setup and replace the old Compose
execution with phase-aware launcher execution and retained ownership receipts.
The derived legacy dependency graph and removed-provider assembly references are
still transitional and must be reconciled before any executable/readiness claim.

The next source-only continuation added private provider configuration rendering:
separate API/worker inputs, provider-owned database/artifact endpoints, isolated
DP backing configuration, host-side retrieval mappings and one derived collection.
The existing setup writer now takes the retrieval collection from its generated
project instead of independently assuming it. Signed KB scope and active-resource
filtering remain intact. The complete existing local-KB suite passes 77/77;
after the setup-writer change, its affected 18/18 tests also pass. Biome has no
errors and only a pre-existing informational diagnostic in preparation.
These changes remain uncommitted, and the new renderer is not yet selected by
the persisted configuration/lifecycle caller. Next independent source work is
that schema and lifecycle conversion, followed by retiring the old assembly and
required committed-range reviews. The provider loopback correction still awaits
the separately requested source-scope approval; no runtime was started.

2026-09-12 continuation: remote refresh confirms Klicker target remains
`21ef2e9818b3e50e592fca3db8bdd9e22f8df524`. The uncommitted port validator
now parses retained endpoint URLs instead of extracting numbers from arbitrary
URL paths; malformed or unsupported endpoints fail closed. The existing focused
suite passes 32/32, focused Biome passes, and `git diff --check` passes.

Fresh ingestion `origin/main@e1b386dc5bb96276a0bb8c958ae8fef03ce00210`
reveals a binding prerequisite: `compose.e2e.yaml` publishes Postgres, Azurite,
Hatchet and Milvus ports without a host address. The strict launcher's
`compose.local-state.yaml` adds retained volumes but does not restrict these
publications. API/dispatcher loopback bindings do not protect backing services.
The approved local-only exposure must not silently become all-interface
publication. No provider or runtime was started. Request a bounded provider-owned
source correction for strict-instance loopback publications and focused rendering
coverage; legacy E2E behavior stays unchanged. Provider source changes and its
later merge are outside this consumer-only plan. Consumer lifecycle integration
and live proof remain incomplete; preserve all existing uncommitted work.

Current implementation checkpoint: plan commit `a73299c45b` passed the normal
container-backed hooks (40 package checks, lint, formatting, syncpack and 70
local-KB tests). The exact validation runtime was stopped afterward; its
container was exited and the worktree had zero routes. No external provider
was started and no model request was made.

The first uncommitted source slice adds pure explicit-port bindings and bound
setup/start/status/stop command generation. Executor Hume
(`01a095b8-c789-76c1-9d3a-eb8a0f6a74e5`) owned only the isolated-config helper
and its tests; main implemented the command consumer and independently verified
the combined result. Tests pass 32/32; Biome reports no errors, only informational
style diagnostics. The former projection remains temporarily available while
the lifecycle caller is converted. This is incomplete integration, not an
executable-stack or publication claim. Next: integrate bindings into persisted
configuration and private environment generation, then replace lifecycle calls,
remove the obsolete provider assembly and complete committed-range reviews.

The same planner, Popper (`01a09422-1565-7d33-a33d-3281a60dcc24`), returned
APPROVED on the concrete allocation, phase and source-delivery specification.
Baseline `node --test util/local-kb/provider-commands.test.mjs
util/local-kb/isolated-config.test.mjs` passes 26/26 on installed Node 24.17.0.
No executable source changes have landed. The optional AGY consultation is
unpassed: its catalog invocation emitted sandbox state-write errors and the
subsequent help invocation produced no usable interface documentation. Do not
treat catalog availability as a completed review or repair its configuration.
Required native planner approval is complete; slice and final reviews remain.

The initial plan commit was attempted with normal hooks. The staged redacted
gitleaks scan passed, but the commit stopped because no workspace app container
is running for this exact worktree. The hook's `devrouter exec` does not start
one. No commit was created and no hook was bypassed. The plan is staged;
implementation remains unstarted until its required initial commit and checks
can run. Starting the validation container is outside the source-only envelope.

The integration branch was fast-forwarded to `7d378475c0` for the corrected
container-backed Git hooks and current KB behavior. No local source edits or
runtime operations were included. Planner Popper completed provider interface
readback using the existing scraping and retrieval launcher worktrees. All
three HTTP providers bind loopback; ingestion workloads run in containers.
Current Docker documentation establishes Desktop host-service DNS and Linux
bridge addressing, but not this exact loopback connection. The planner approved
a separate permission question for one synthetic loopback-listener/container
request using the intended consumer networking, no provider activation or data,
no image pull, and unconditional cleanup of only the probe-owned resources.
Success proves only this workstation's reachability; failure allows no retry,
listener widening or bridge implementation. The user authorized that probe,
which passed on the `orbstack` Docker context using installed `node:24-alpine`
on the default bridge: `host.docker.internal` reached a host `127.0.0.1`
ephemeral listener and returned the exact synthetic marker. Exit status was
zero; listener closure and absence of the probe container were verified.
No provider service, image pull, ingestion or model call occurred. This proves
only the tested OrbStack default-bridge route, not Linux or the ingestion
provider's separate Compose network. The latter remains future live evidence.
The user approved continued source integration after this result.

Fresh remote readback found `v3-ai@21ef2e9818`, one unrelated OLAT registration
commit ahead of this branch. Preserve the recorded implementation baseline;
this drift does not require another integration. The ingestion provider's
`origin/main:compose.local-workers.yaml` has no `extra_hosts` override and uses
its prepared provider-owned network. Do not add a `host-gateway` override that
would change the DNS route proven by the probe. Complete image and caller-facing
address bindings remain prerequisite to the final plan challenge.

2026-09-12 current dependency receipt: Doc Processing
[MR !79](https://gitlab.uzh.ch/ai-infrastructure/services/doc-processing/-/merge_requests/79)
merged through the user's auto-merge setting as
`1667e167980dd17f27d364f0c6ef758a7b9015b9`, confirmed on `origin/main`.
Exact source head `57bbd974ae803f9f577909e69ac5c42c741f7562` passed pipeline
663257 and 57 synthetic launcher tests. Claude's focused final correction
review returned pass with no findings; its result has the required schema
fields and no extra keys. The accepted interrupted-binding-capture bug is
corrected. Automatic adoption of ambiguously provisioned containers and stop
before backing verification remain deliberately excluded by the approved
custody contract. GitLab removed the remote source branch during merge; the
local branch, worktree and data were preserved. No runtime was activated.
The provider prerequisite is now satisfied. Next: finalize concrete consumer
configuration and phase-order bindings, complete the existing planner gate,
then replace consumer-owned provider Compose with supported launcher calls.
The historical receipts below do not describe current dependency state.

Current receipt: the user approved the scoped Claude consultation, which
completed before implementation. Doc Processing's isolated backing lifecycle is
now published at `76b4a254ada92ca1c77ccbed01239624a0045a70` in
[draft MR !79](https://gitlab.uzh.ch/ai-infrastructure/services/doc-processing/-/merge_requests/79).
Its 51 synthetic lifecycle tests pass; pipeline 663228 has passing unit/type
jobs and a running Hatchet CPU E2E job. Simplification completed with one
verified redundant check; ownership review and integrated final review remain
pending. This supersedes the older blocked-consultation and no-implementation
receipts below. No runtime was activated. Consumer implementation still waits
for the reviewed provider contract and its separately authorized merge.

The user approved the source-only Doc Processing backing lifecycle extension.
Its clean existing worktree is now on `rs/local-backing-lifecycle`, based on
`main@494c30c368313bcd9fc7953c3ec152c8ceea553a`; the old branch is preserved.
Existing launcher tests pass 36/36 using the installed Python environment;
pytest could not write its optional cache under the sandbox. No service ran.
Planner Halley (`01a0951a-ec75-7eb1-8c86-5dcef1e58509`) completed construction:
optional isolated backing configuration, separate instance-owned Compose
resources, one-shot setup/token preparation, prepared-only start, observational
status and retained stop. External connection mode stays unchanged.
The required Claude architecture consultation was rejected by automatic
approval review because private source transmission to that destination needs
specific approval. Do not bypass the rejection with an indirect route. Complete
the frozen provider plan and its hardening after the source-sharing decision.
No provider implementation has been written or published.

Both approved merges completed and were verified on provider main refs:
ingestion `faad999f8` and Document Processing `494c30c36`, with pipelines
663180 and 663179 successful. The foreground watcher exited successfully;
no scheduled monitor exists. Local provider worktrees were preserved.
Contract reconciliation found the separate Document Processing backing-service
gap described above. Planner Popper (`01a09422-1565-7d33-a33d-3281a60dcc24`)
completed the bounded clarification with DONE_WITH_CONCERNS. The retained report
is `_local/reviews/2026-09-12-doc-processing-backing-contract.md`. It confirms
that optional instance-bound Doc Processing backing lifecycle is a provider
capability extension, not existing consumer wiring. Ask for that source-only
extension before implementing it; preserve external-connection mode and retain
separate future merge/runtime gates. No consumer implementation or runtime
mutation has occurred.

Historical sequence:

The user explicitly authorized both provider merges on 2026-09-12. Both are
ready and have squash auto-merge configured after GitLab-required conflict-free
rebases: ingestion `1fa272b7` / pipeline 663180 and Document Processing
`42c9f4f2` / pipeline 663179. Both pipelines are running; no merge is yet
confirmed. This supersedes the merge-approval request below. No source integration
or runtime action has occurred. A scheduled follow-up was rejected by automatic
approval review; no heartbeat was created. Use the single foreground watcher.

2026-09-12: remote refs refreshed and clean follow-up branch created. Planner
Popper completed read-only construction; its ownership, dependency-order,
networking and explicit-configuration concerns are incorporated above. No source
implementation or runtime action has occurred. Baseline command/configuration
tests passed 26/26. The planner challenge returned REVISE: provider merges must
precede dependent implementation, phase/configuration decisions need completion,
slice ownership needs an explicit map, and retained acceptance must compare
the same resource before and after restart. This draft is not an approved
implementation specification. Next: obtain the named ready/CI/merge sequence
for the two provider dependencies, then finish contract binding and plan review.
Retained acceptance will ingest and retrieve, stop and confirm shutdown, resume
without setup or re-ingestion, retrieve the same resource, and verify its citation
after reload with unchanged resource identity and storage.

Source-only continuation: both provider MRs have no discussion entries. Ingestion
pipeline 661896 has zero jobs, no YAML error, and skipped status; the cause of
the skip is not established. Its predecessor pipeline 661542 passed all eleven
jobs, including E2E and both image builds, at `78d44033`. Launcher scripts are
unchanged between that head and `6f0911f0`, but nineteen other files changed
(Office document handling), so that green predecessor does not prove the full
current MR head. Preserve the remote branch and reconcile those changes against
main before requesting any merge. Document Processing remains reviewed in its
description with passing pipeline 662692 and no new discussion feedback.
