# Klicker public documentation through catalog, ingestion, and Doc Query

## Goal

- Problem: The Manage assistant can search only the documentation snapshot
  bundled with its release. It cannot retrieve newly published KlickerUZH help
  pages or reliably match semantic paraphrases.
- Outcome: Build a conservative public website catalog, ingest it through the
  production-shaped ingestion pipeline, expose it through the existing
  multi-tenant Doc Query service, and replace local search as the primary
  retrieval path only after a paired quality and isolation gate passes.
- Product constraint: Keep one Manage assistant. Preserve question drafting,
  signed proposals, lecturer tools, conversation state, citations, source
  links, and failure isolation.
- Fallback: Keep the deterministic documentation manifest and static navigator
  as the bounded outage and media fallback. Do not claim live web browsing.

## Non-goals

- Live website fetching during an assistant turn.
- Course material, participant content, or any private data in the public-docs
  collection.
- A second assistant, a new Doc Query service implementation, or a new vector
  database.
- Production ingestion, production deployment, direct cluster changes, or new
  cluster connectivity.
- Modifying, rebasing, or publishing the existing two-PR Klicker stack during
  the source-ready phase.

## Plan identity and current state

- Coordinating repository: `/Users/rschlae/Git/klicker/klicker-uzh`
- Coordinating branch: `rs/manage-assistant-public-doc-query`
- Coordinating worktree:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/manage-assistant-public-doc-query`
- Root commit: exact PR #5754 head
  `56c9f13c2d9b0b6326f9861e4a687ea4409515fa`.
- Existing stack: PR #5753 provides the deterministic documentation manifest;
  PR #5754 provides local documentation search. PR #5754 is currently
  conflicting. This plan does not alter either branch or create a third PR.
- Target hint: the existing stack ultimately targets `v3-ai`. Integrating it
  with current `origin/v3-ai` is a separately authorized one-time operation.
- Control checkout: the primary Klicker checkout has unresolved user changes.
  It remains untouched. All other repository primary checkouts are also dirty
  or stale and remain read-only.
- Remote-state evidence was refreshed on 2026-09-04. Authoritative source bases
  are recorded in the worktree table below.

## September 6 verification checkpoint

The installed devrouter 0.0.55 passed the earlier configuration-drift repair;
the repository pin remains 0.0.51. The exact task runtime used profile
`chat,manage`, workspace `rs-manage-assistant-public-doc-q`, and the approved
non-secret Blob port override 10023. Guarded repair reported ready with no
drift and no container recreation. Auth returned HTTP 200, and seeded
delegated login reached the Manage question pool.

The behavior-only cleanup now also removes four prompt-wording-only tests.
It retains synthetic context preservation, signed proposal fields, machine
protocol fencing, model selection, and capability filtering. The four focused
Chat files passed all 45 tests. Chat and Playwright typechecks passed. Scoped
Biome and Prettier checks passed; the unchanged welcome component still has
its pre-existing array-index-key lint finding. Production prompts are unchanged.
These checks do not establish model obedience or browser acceptance.

Browser verification reached the assistant's delayed shell. The app log then
reported backend exit 137; task cgroup counters showed two OOM kills and a
peak near 8.16 GB, supporting memory pressure without identifying each kill.
A serialized runtime retry was started after compiler checks finished.
On continuation its process was gone, and Docker reported the former task
container absent. Devrouter reported every task service missing with five
stale routes. This task did not remove those containers. Recreation and its
effect on retained synthetic data require clarification before another startup.

The browser session is closed. Exact-owner managed stop failed closed with
`Managed stop cannot prove the complete retained service population.` Runtime
release is not verified; no guard bypass or data deletion was attempted.
Browser source cards,
fallback, drafting, and the focused host Playwright run remain incomplete.
The six changed files remain uncommitted. No publication, upstream integration,
secret operation, ingestion, or tenant activation occurred. Fresh remote refs
show this branch has no upstream and is 134 commits ahead of and 37 behind
remote default `v3`; that drift does not authorize integration.

### Confirmed reset and recreation attempt

The user confirmed another complete OrbStack reset and authorized fresh stack
startup. One managed `chat,manage` ensure recreated the exact task container
`b7ce10912ad8bc0f28a5a0f41979504fe8ce8f5eca24c809aa6ab824efd385cf`
and its dependencies. Internal Auth, Chat, Manage, PWA, and lecturer endpoint
readiness passed. During reconciliation a later hook selected `full`; final
routed Chat readiness timed out with HTTP 502 and the candidate rolled back.
No browser acceptance ran against this candidate.

Readback reported generated-configuration drift, stopped app processes and
Redis services, and healthy retained Postgres, Hatchet, and Azurite services.
One guarded repair refused with `Repair requires a persisted degraded managed
runtime.` The app log ended with the managed shutdown; it did not establish
another memory failure. Exact managed stop also refused with `Managed stop
requires unchanged recorded resources and configuration.` The retained base
services and five stale routes therefore remain unreleased; no keep-running
lease or successful shutdown is claimed. Continue only after
the lifecycle-state mismatch is resolved; do not edit global state, bypass
guards, or retry the same failed path without new evidence.

## Product primitive impact

| Product primitive | Disposition | Contract delta | Preserved behavior |
| --- | --- | --- | --- |
| Manage documentation guidance | Reuse and extend | Add website-backed freshness, canonical source authority, semantic retrieval, and an honest degraded mode | One assistant, existing source cards, localized help, and media links |
| Question drafting and signed proposal | Reuse | None | Draft, revise, review, confirm, and open remain unchanged |
| Lecturer tools | Reuse | None | Existing authentication, tool visibility, and degraded behavior remain independent of public docs |
| Assistant conversation | Reuse | None | Current turn and reset behavior remain unchanged |

The public-docs tenant is an implementation surface, not a new product
primitive.

## Architecture decision

### Catalog and ingestion

- Add catalog `klicker_docs_public_web` from the public
  `https://www.klicker.uzh.ch/sitemap.xml`.
- Include lecturer and participant tutorials, use cases, getting started,
  gamification, and FAQ pages.
- Exclude search, private preview, legal, terms, privacy, and development-only
  routes. Freeze and classify every normalized sitemap URL before the run.
- Ingest into dedicated collection `catalog_klicker_docs_v1` with
  `text-embedding-3-small`, 1536-dimensional vectors, standard/lowercase/
  asciifolding BM25, language detection, quality chunking, and catalog-owned
  facets.

### Multi-tenant serving

- Add dedicated tenant path `/mcp/klicker-public-docs` with one retrieval
  configuration, `klicker_docs_doc_query`. The pinned runtime also generates
  its same-tenant `klicker_docs_doc_query_chunk_topics` companion.
- Give the tenant its own transport secret and project it only to the shared
  Doc Query service and Klicker Chat.
- Keep `/mcp/klicker`, its course collection, legacy experts, and required
  scope-token contract unchanged.
- Do not treat a client-side tool allowlist as authorization. The existing
  Klicker tenant bearer can reach unrelated unscoped experts, so it is not
  suitable for Manage documentation retrieval.
- Freeze serving compatibility to deployed image
  `sha-748b5a216a9b1dcc64e2045f17b63662c9b89f14-arm@sha256:74c7398af45e99ae90a0952483179e4f43d01fc4a0231ebf08d53c1b320803e1`.
  Validate tenant configuration against that source revision and stop on a
  mismatch. Do not change the image in this package.

### Manage integration and fallback

- Expose one fenced composite `klicker_docs_doc_query` tool to the model.
- The composite tool attempts remote initialization and retrieval first. It
  invokes deterministic search on initialization failure, call failure,
  timeout, malformed output, or empty documents.
- The complete remote attempt has a hard four-second deadline. The route keeps
  its existing 60-second total deadline.
- The documentation client and lecturer client each close exactly once on
  finish, error, and abort.
- German questions may be answered in German from English source pages, but the
  assistant must not imply that German documentation exists.

## ADR gate

- Decision: Record this plan as the reversible decision owner. Do not add an
  ADR before implementation.
- Reason: The dedicated tenant and composite fallback are bounded deployment
  and application seams with ordinary source rollback. They do not change the
  domain model or durable user data.
- Re-open the ADR gate if implementation requires server-side per-token tool
  authorization, a new Doc Query source package, a new data owner, or a
  production retention contract.

## Execution and authority contract

- One approval of this plan authorizes the source-ready phase: create the four
  named cross-repository worktrees, add repository-local plans and progress,
  make scoped source and test changes, run repository-native checks and
  required reviews, create conventional local commits, generate values-free
  local evaluation artifacts, and spend at most USD 5 total on catalog
  construction, enrichment, evaluation generation, embeddings, and judging.
- The source-ready terminal is clean reviewed local commits in data-catalog,
  data-ingestion, deployment, df-cloud, and the local Klicker B2 branch. No
  push, PR/MR, secret, ingestion, or deployment occurs before that terminal.
- Withheld: branch pushes, PR/MR creation or updates, updating the existing
  two-PR Klicker stack, secret creation or mutation, merge, protected-branch
  integration, GitOps activation, STG ingestion, production, direct cluster
  changes, secret value reads, force-push, history rewrite, and cleanup.
- Execution owner: this task is the cross-repository orchestrator. It owns
  architecture, privacy, Git, external effects, integration, and final proof.
  Executors may own only the disjoint files listed below.
- Pause on: a required source repository cannot be represented in a clean
  worktree; the pinned runtime rejects the tenant contract; a change requires
  a new server authorization mechanism; expected source or quality thresholds
  are invalid; a required reviewer reaches a terminal unavailable state with
  no equivalent continuity route; or source readiness reaches the withheld
  publication and activation boundary.

## Proposed separate activation task

After source readiness, the main task may propose one separate activation task.
It is not authorized by approval of this plan.

The later approval must explicitly cover the exact branch pushes and draft
PRs/MRs, creation of the dedicated self-hosted Infisical transport secret
without reading it back, values-free projection, each merge, GitOps STG
activation, and one catalog-to-ingestion run. The Klicker publication decision
must preserve the user's existing two-PR instruction unless the user explicitly
approves a third layer.

Before launch, require exact remote heads, green required CI, approved PRs/MRs,
rendered tenant inventory, the pinned image digest, healthy Argo reconciliation,
values-free ExternalSecret readiness, `REPLACE=0`, deletion disabled, and no
existing run, lease, lock, outbox, or collection ambiguity. Any ambiguous
dispatch or consumed internal retry stops the rollout with no replay.

## Worktrees and package boundaries

| Package | Repository, branch, worktree, and authoritative base | Source ownership | Verification | Commit boundary |
| --- | --- | --- | --- | --- |
| Cross-repository contract and B2 integration | Klicker `rs/manage-assistant-public-doc-query`; worktree `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/manage-assistant-public-doc-query`; root `56c9f13c2d9b0b6326f9861e4a687ea4409515fa` | This plan; later Chat composite-tool files only | Exact-head, worktree, focused Chat, browser, and final package checks | Approved plan commit first; later one composite-tool commit; no PR |
| Public website catalog | data-catalog `rs/klicker-public-docs-catalog`; worktree `/Users/rschlae/Git/ai/data-catalog/trees/rs/klicker-public-docs-catalog`; base `origin/main@f30e7b28ec03eac154b09d014471f28aa5b2ec76` | `input/klicker_docs_public_web/catalog.yaml`, disabled registry entry, focused tests, local plan/progress | Catalog validate; inventory/build/quality/export; focused then full pytest; Ruff; Pyrefly | One catalog/config/test commit after no-ingestion build passes |
| Dedicated ingestion project | data-ingestion `rs/klicker-public-docs-ingestion`; worktree `/Users/rschlae/Git/ai/data-ingestion/trees/rs/klicker-public-docs-ingestion`; base `origin/main@5771cab81a41512e5734166a8bf6e0a1a5842c3e` | `modules/ingestion/src/ingestion/project_configs/catalog-klicker-docs.yaml`, focused tests, local plan/progress | Facet parity; focused config tests; `poe check`; ingestion tests | One ingestion-config/test commit |
| STG ingestion and Doc Query deployment source | deployment `rs/klicker-public-docs-stg`; worktree `/Users/rschlae/Git/ai/deployment/trees/rs/klicker-public-docs-stg`; base `origin/main@14668811ab871dadb1d162961bd521b2b6f01adc` | STG project-config mirror, collection allowlist, `tenants/klicker-public-docs/*`, overlay mounts/env, focused lints, local plan/progress | Render validators; Kustomize for ingestion and Doc Query; image, runtime, tool, and tenant lints | One rendered config/test commit; no image change |
| Secret projection source | df-cloud `rs/klicker-public-docs-secret-projection`; worktree `/Users/rschlae/Git/df/df-cloud/trees/rs/klicker-public-docs-secret-projection`; base `origin/stg@b17b8a08a85f189f21c176cc35ebd092c9b34caf` | `src/apps/klicker/doc-query.ts`, `src/apps/klicker/functions.ts`, `src/apps/klicker/doc-query.test.ts`, directly affected secret tests, local plan/progress | Klicker Doc Query and secret tests; build; preview only after later push authority | One values-free secret-projection/test commit |

No mcp-doc-query source worktree is planned. Create one only if the pinned image
cannot express the dedicated tenant, and stop for a revised architecture first.

## Delivery slices

### Public website catalog

1. Create the data-catalog worktree from its recorded base.
2. Freeze the normalized sitemap inventory. Classify every URL exactly once as
   included or excluded with a reason. Fail on unknown classes, off-domain
   redirects, duplicates, or excluded content.
3. Add `input/klicker_docs_public_web/catalog.yaml` and a disabled
   `input/catalog_refresh.yaml` entry.
4. Validate and run inventory, build, quality review, and export review without
   ingestion. Inspect `build_report.json`; a schema-valid result with defaulted
   LLM output or suspiciously missing content does not pass.
5. Run focused and full repository checks, review, and commit.

### Dedicated ingestion project

1. Create the data-ingestion worktree from its recorded base.
2. Add only
   `modules/ingestion/src/ingestion/project_configs/catalog-klicker-docs.yaml`
   and its focused tests.
3. Verify collection name, dimensions, embedding model, BM25, language,
   chunking, and read-only facet parity against the sibling catalog worktree.
4. Do not edit deployment mirrors or run ingestion in this package.
5. Run focused and package checks, review, and commit.

### STG ingestion and multi-tenant deployment source

1. Create the deployment worktree from its recorded base.
2. Mirror the ingestion project config into
   `ingestion/stg-generic/project-configs.yaml` and add
   `catalog_klicker_docs_v1` only to `ingestion/stg-generic/cm.yaml`.
3. Add `pipelines/stg-doc-query/doc-query/tenants/klicker-public-docs/`
   containing one retrieval configuration and its prompt. Register only that
   tenant's mount and token environment reference.
4. Preserve all existing tenant files and the pinned service image.
5. Prove rendered inventory, collection allowlist, network policy, tenant path,
   the exact retrieval-plus-companion runtime inventory, and image/runtime
   compatibility with focused tests.
6. Run repository checks, review, and commit. Do not deploy.

### df-cloud secret projection source

1. Create the df-cloud worktree from its recorded `origin/stg` base.
2. Declare the new secret key without creating or reading its value.
3. Project it only to the shared Doc Query service and the Klicker Chat secret.
4. Add values-free tests proving exact recipient names and absence from other
   workloads and production unless separately intended.
5. Run focused tests and build, review, and commit. Do not push or preview.

### Controlled STG catalog-to-ingestion run

This slice belongs to the proposed separate activation task.

1. Verify publication, deployment, secret, tenant, and empty-state receipts.
2. Use a fresh run ID, `REPLACE=0`, deletion disabled, and zero manual retries.
3. Run the complete data-catalog refresh so data-catalog dispatches
   data-ingestion exactly once.
4. Accept only first-attempt terminal completion. Never replay an ambiguous or
   internally retried dispatch.
5. Verify build, gate, apply, per-source, event, collection, schema, BM25, and
   public-source receipts.

### Retrieval and isolation evaluation

This slice starts only after the controlled STG run passes.

1. Generate a candidate corpus from the public docs, then review and freeze at
   least 24 balanced English/German in-scope cases with expected facts and
   canonical URLs, plus at least six no-result, injection, excluded-path, and
   isolation cases before generating candidate answers.
2. Keep cases beside the catalog config. Keep generated outputs and judge
   reports under ignored local evidence paths.
3. Use the existing Klicker DeepEval route with no Confident AI, no new
   tracing, one bounded iteration, and the USD 5 package-wide ceiling.
4. Run direct collection sanity and real MCP `tools/list` and `tools/call`
   through the multi-tenant public path. Do not establish a new port-forward or
   cluster connection.
5. Compare the same cases with the deterministic search baseline.
6. Require at least 90% grounded-fact and expected-source success, zero
   material unsupported claims, every safety/no-result/isolation case passing,
   improvement on every predeclared deterministic-search gap, and no material
   regression on baseline-passing core cases.
7. Across at least 20 successful STG calls, require p95 remote retrieval at or
   below three seconds and no call above the four-second deadline. Separate
   cold and warm evidence.
8. Prove the public path lists exactly the retrieval tool and its generated
   `_chunk_topics` companion; public and course tokens reject cross-use; and
   generic `doc_query` plus a known legacy expert are unavailable through the
   public path.

### B2 public-docs Manage integration

Source implementation may proceed after the pinned runtime contract is verified
locally. Live acceptance still waits for the separately authorized ingestion
and retrieval-isolation evaluation.

1. Work only in the local B2 branch. Leave PR #5754 and its worktree untouched.
2. Replace primary local search with the fenced remote-first composite tool.
   Retain deterministic search for bounded failure and media lookup.
3. Add the four-second timeout, output validation, canonical source handling,
   and exact-once lifecycle behavior.
4. Update capability copy, environment declarations, `turbo.json`, focused
   tests, and durable docs made inaccurate by the change.
5. Run Chat tests, typecheck, lint, formatting, risk review, and commit locally.
6. Do not create a third PR or update the two existing PRs. Publication
   topology remains a later explicit decision.

### Browser and integrated readiness proof

1. Start only the B2 worktree's owned `chat,ai,mcp` runtime with seeded or
   synthetic data and approved values-free secret injection.
2. Use mandatory `agent-browser` verification for English and German help,
   source cards, media fallback, remote outage and empty fallback, unchanged
   question drafting, desktop, and compact layouts.
3. Add focused Playwright coverage only if an important browser-only behavior
   lacks a stable existing seam.
4. Stop the exact runtime and verify it stopped.
5. Run per-repository native checks, data-hygiene review, required slice
   reviews, and one integrated final review across all local heads.
6. Reach the source-ready terminal and request the separate publication and
   activation authority.

## Feature-wide test portfolio

| Behavior | Existing evidence | New obligation | Stable seam | Distinct failure | Owner |
| --- | --- | --- | --- | --- | --- |
| Public URL admission | Generic catalog validation, inventory, crawl, exclusion, and URL-safety tests | Freeze every normalized sitemap URL with one inclusion or exclusion reason | Catalog input and immutable inventory | Private, legal, search, dev, duplicate, redirected, or unknown URLs enter the corpus | Public website catalog |
| Catalog-to-ingestion parity | Existing facet-sync and ingestion config tests | Pin collection, taxonomy, dimensions, BM25, and facets across source config | Ingestion project config and facet-sync script | Catalog facets or vector/search schema drift before dispatch | Dedicated ingestion project |
| Deployed collection schema | Existing ingestion receipts and collection checks | Prove non-empty documents, vectors, BM25, canonical URLs, and public-only content | Ingestion receipt and direct collection sanity | A green dispatch produced the wrong or empty collection | Controlled STG run |
| Tenant isolation | Existing multi-tenant mounts and course scope contract | Exactly one public tool; both tokens reject cross-use; legacy experts unavailable | MCP `tools/list` and `tools/call` on both tenant paths | Client filtering hides excess authority or tokens cross boundaries | STG deployment and evaluation |
| Composite fallback and lifecycle | Existing deterministic search and lecturer close tests | Remote init, call, timeout, malformed, and empty results fall back by four seconds; both clients close exactly once | Composite-tool and Manage route tests | Model-selected remote retrieval loses docs help or leaks clients | B2 Manage integration |
| Source normalization and grounding | Existing `_doc_query` citation normalization | Accepted results carry canonical URLs and fenced document text | Tool-result normalization and frozen cases | Sources disappear, wrong URLs surface, or retrieved text becomes instructions | Evaluation and B2 integration |
| Unchanged question drafting | Existing proposal schema, review, confirmation, and route tests | Run draft-revise-confirm fixtures with remote success and every fallback class | Existing proposal contracts | Documentation integration breaks the primary authoring workflow | B2 Manage integration |
| Browser behavior | Existing Manage assistant journeys | Verify localized help, source cards, fallback, drafting, desktop, and compact states | Manage UI through `agent-browser` | Correct server behavior is unusable or misleading in the embedded UI | Browser proof |

## Verification commands and evidence

### Public website catalog

```bash
uv run catalog-automation validate --catalog input/klicker_docs_public_web/catalog.yaml
uv run catalog-automation inventory --catalog input/klicker_docs_public_web/catalog.yaml --run-id <frozen-run-id>
uv run catalog-automation build --run-dir output/klicker_docs_public_web/<frozen-run-id>
uv run catalog-automation quality-review --run-dir output/klicker_docs_public_web/<frozen-run-id>
uv run catalog-automation export-review --run-dir output/klicker_docs_public_web/<frozen-run-id>
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run pyrefly check
```

### Dedicated ingestion project

```bash
uv run python scripts/sync_catalog_facets.py --check
uv run pytest modules/ingestion/tests/test_config.py modules/ingestion/tests/test_sync_catalog_facets.py -q
uv run poe check
uv run poe test-ingestion
```

### STG deployment source

```bash
python ingestion/stg-generic/validate_render.py
kustomize build ingestion/stg-generic
kustomize build pipelines/stg-doc-query/doc-query
python -m unittest pipelines.lint.test_doc_query_image_pin_lint pipelines.lint.test_doc_query_runtime_manifest_lint pipelines.lint.test_doc_query_tool_config_lint
```

Add and run one focused tenant-inventory test if the existing lints do not prove
the exact one-tool public tenant contract.

### df-cloud secret projection source

```bash
pnpm --filter @uzh-df/df-cloud-apps-klicker run test:doc-query
pnpm run build
```

Run any directly affected secret-delivery test added beside
`src/apps/klicker/doc-query.test.ts`. A GitLab branch preview belongs to the
later publication task.

### B2 public-docs Manage integration

```bash
pnpm --filter @klicker-uzh/chat test:run -- test/docs-search.test.ts test/manage-chat-route.test.ts test/manage-assistant-runtime.test.ts
pnpm --filter @klicker-uzh/chat check
pnpm --filter @klicker-uzh/chat lint
pnpm run format:check
```

Use `rs-docquery-retrieval-test` for collection sanity and real MCP retrieval.
Use the existing private Klicker evaluation harness for the paired DeepEval
run. Do not add a hosted evaluation service or dependency.

## Review routing

- Run one simplifier after each substantive committed package. It evaluates
  complexity only and cannot substitute for correctness review.
- Run one security and cross-system slice review for the deployment tenant,
  secret projection, activation contract, isolation evidence, and composite
  loader.
- Run one integrated final review after all local source heads and browser
  evidence are complete.
- The configured Claude advisor and opposing-provider challenge both failed
  before review with
  `Failed to authenticate: OAuth session expired and could not be refreshed`.
  Record that limitation; do not present it as successful independent review.
- Native planner hardening ran three rounds. It required the dedicated tenant,
  pinned runtime, composite fallback, source-ready stop, exclusive repository
  ownership, full test portfolio, exact worktrees and checks, numeric latency
  gate, and a distinct local B2 branch. All findings are incorporated. The
  final round returned `REVISE` only for the B2 branch isolation now resolved;
  the three-round correction budget is exhausted. Record the result as
  `review_deadlock`; no `APPROVED` verdict is fabricated. The user reviewed and
  explicitly approved the corrected plan on 2026-09-04.

## Acceptance

- Every public sitemap URL is classified exactly once, and no excluded or
  off-domain page reaches the collection.
- The real catalog pipeline dispatches the real ingestion pipeline exactly once
  in the later authorized activation task.
- `catalog_klicker_docs_v1` contains non-empty public Klicker documents with
  the declared vector and BM25 schema and canonical source URLs.
- `/mcp/klicker-public-docs` exposes exactly the configured retrieval tool and
  its generated same-tenant companion, and rejects cross-tenant credentials in
  both directions. Klicker exposes only the retrieval tool to the model.
- The frozen paired evaluation meets the grounding, source, safety, isolation,
  baseline, and latency gates without weakening failed expectations.
- Remote failure reaches deterministic fallback within four seconds and leaves
  question drafting, conversation, and lecturer tools usable.
- English and German browser journeys show useful answers and honest source
  provenance without implying German source pages exist.
- All source packages are clean, locally committed, reviewed, and values-free.
  Nothing is pushed or deployed.

## Rollback

- Before publication: discard the unpushed local commits only after separate
  cleanup approval; the existing two-PR stack remains untouched.
- After a later STG activation: disable the public-docs tenant binding and Chat
  secret projection through ordinary GitOps rollback. Keep the dedicated
  collection isolated from course material.
- At application level: disable the remote binding. The deterministic manifest
  and static navigator continue to provide bounded documentation help.

## Progress

- [ ] Verification checkpoint, 2026-09-05: the post-OrbStack-reset managed
  `chat,manage` startup completed with healthy dependencies and no drift.
  The Chat command ran the complete suite: 890 passed, 22 skipped. The
  synthetic manifest suite passed all 12 tests. Browser login still returned
  HTTP 404 at `/api/auth/signin`; browser acceptance remains incomplete.
  The read-only test-mapping worker failed before work with provider HTTP 400;
  its single trusted continuity worker then hit the account usage limit.
  No child result was accepted. Existing test cleanup remains uncommitted.
  Runtime shutdown completed for this exact worktree; fresh managed status
  confirms stopped services, zero active apps, and no drift. Resume by
  investigating local auth routing, finishing behavior-only
  test cleanup, and running focused browser verification. No publication or
  activation authority has changed.

- [x] Refreshed remote refs and recorded authoritative bases.
- [x] Inspected the existing Manage search, MCP client, citation, tenant,
  ingestion, secret-projection, and deployment seams.
- [x] Selected a dedicated tenant after rejecting client-only filtering as an
  authorization boundary.
- [x] Completed three native planner hardening rounds and incorporated every
  material finding.
- [x] Created the isolated local B2 branch and worktree without modifying PR
  #5754 or the dirty primary checkout.
- [x] User approved this execution plan on 2026-09-04 with a goal.
- [x] Committed the approved plan before implementation files.
- [x] Reached reviewed local source commits for the dedicated catalog,
  ingestion project, STG deployment manifests, and values-free STG secret
  projection.
- [x] Completed the catalog's real model-backed no-ingestion build: all 43
  normalized URLs were fetched, classified, and included with no failures or
  exclusions. The review refined five titles and accepted the export. Seven
  pages retain fail-closed `embedded_target_ambiguous` markers because they
  legitimately contain multiple Kaltura embeds; activation must disposition
  that coverage separately.
- [x] Verified from the exact pinned Doc Query source revision that each tenant
  retrieval configuration generates a same-tenant `_chunk_topics` companion.
  Corrected the source and acceptance contracts without changing the tenant,
  data boundary, or model-visible single-tool design.
- [x] Implemented the isolated local Klicker B2 composite tool. The initial
  source commit is `592fe82b40`; review corrections are in `de5e97a5bd`,
  `3759031143`, and `80b209347b`.
- [x] Addressed both integrated final-review findings. Deployment now keeps the
  public-docs model aliases STG-only and protects PRD with an independent
  fixture. Chat now bounds oversized remote document output to a ranked,
  whole-source prefix and falls back when no complete source fits.
- [x] Verified the final B2 source in the owned Node 24 runtime with the exact
  14-test composite-tool file, 890 passing Chat tests with 22 integration tests
  skipped, Chat typecheck, Biome, repository `check:all`, and the production
  Chat build. Deployment passed all 17 runtime-manifest unit tests and the
  actual STG and PRD Kustomize renders passed their environment-specific lints.
- [x] Completed the integrated final review with no findings across exact source
  heads `dbafa369fa` (data-catalog), `4fada0982c` (data-ingestion),
  `6831c49669` (deployment), `f2d864a821` (df-cloud), and `80b209347b`
  (Klicker implementation).
- [x] Reached clean local commits across data-catalog, data-ingestion,
  deployment, df-cloud, and Klicker. No branch was pushed and no runtime or
  secret was activated.
- [ ] Complete the local browser acceptance before declaring the source-ready
  terminal. Existing EN/DE desktop and compact screenshots cover welcome and
  layout only; source cards, fallback, and drafting still need browser proof.
  Live retrieval, ingestion, tenant isolation, secret readiness, and deployed
  runtime health remain deferred to the separately authorized activation task.
- [ ] Verify the September 5 welcome-test cleanup. Exact welcome prose and CSS
  assertions are replaced with capability-list and limits-note presence plus
  a starter that fills the composer without sending. `git diff --check` passes;
  browser execution and container checks are blocked because another runtime's
  `default-fe-df332-azurite-1` owns local port 10003. The attempted task runtime
  primary container was stopped without modifying that owner. Status readback
  reports no active apps or processes, but Redis, Postgres, and Hatchet remain
  healthy: complete runtime release is not verified. Delegated-login diagnosis
  remains unconfirmed until the isolated runtime can start.
- [ ] Resolve the isolated runtime recovery boundary found on September 5.
  With explicit approval, the conflicting Azurite container was temporarily
  stopped and then restored. Startup still failed with `ENOTFOUND
  rs-manage-assistant-public-doc-q-azurite`; Docker inspection showed the task's
  Azurite container running with no attached networks. Subsequent checks and
  normal shutdown failed with `could not determine process identity for
  workspace lifecycle lock`. No manual lock or networking repair was attempted.
  The host Playwright command also aborted during pnpm's dependency-install
  preflight before executing tests. Formatting and browser acceptance remain
  unverified; task runtime cleanup remains incomplete.
- [ ] Complete acceptance after the later runtime interruption. Outside-sandbox
  Devrouter execution passed, showing the earlier process-identity failure was
  sandbox-related. After the provider queue cleared, managed stop verified all
  task services stopped. The approved repair restored the task Azurite network
  aliases and preserved its failed-transition record as a backup; a subsequent
  `chat,manage` ensure reported ready with no drift. Delegated sign-in through
  `/api/auth/signin` succeeded and the seeded lecturer reached the question pool.
  The host Playwright launcher then attempted its full profile and rolled back;
  no passing test receipt was obtained. On the next continuation, Docker showed
  neither the task container group nor the formerly conflicting container.
  Devrouter retained a failed `route-publication` transition. Their removal was
  not performed by this task; confirm ownership before recreating runtime data.
  Browser session `docs-verification` was closed.
- [ ] Recreate the isolated runtime after the confirmed OrbStack reset. The
  user identified the container removal as their reset and explicitly requested
  startup again. One `devrouter ensure . --profile chat,manage --json` command
  is queued behind other workspace operations; no duplicate startup or lock
  bypass was launched. Complete focused checks only after fresh readiness.
- [ ] Verify the expanded behavior-only test cleanup: welcome and German locale
  tests no longer pin wording or content counts, docs fallback uses synthetic
  URL-contract fixtures, and manifest determinism uses synthetic source inputs
  instead of a checked-in documentation snapshot. Changes remain uncommitted.
- [ ] Request separate publication and activation authority.

### September 6 draft-publication checkpoint

The user authorized committing and publishing this package as draft PRs/MRs for
cross-device continuation. Activation, ingestion, deployment and merging remain
outside that authorization. The existing Klicker PRs #5753 and #5754 are draft.
Supporting branches are published as data-catalog !83, data-ingestion !132,
deployment !734 and df-cloud !524. The task-local runtime recovery fix is
published as devrouter draft PR #56 at `71aa5a8d33ea8966c76705e41273cb7d3d384b5e`;
its integrated final review passes with no findings.

The task-local CLI completed the `chat,manage` ensure with ready status and no
drift, without recreating the attached runtime. That does not prove the detached
reset failure path live. The subsequent full `pnpm run check:all` encountered an
unrelated Analytics dependency failure: the reset environment selected Python
3.14 and pandas 2.2.2 could not compile without a C compiler. The producing
terminal session was lost before its overall exit status could be recovered.
Do not treat this run as a passing full check. Staged secret scanning and focused
formatting passed. Browser acceptance and exact managed shutdown still require
fresh proof. The behavior-only cleanup remains staged pending commit checks.

### September 7 transfer checkpoint

The user explicitly requested publication of all remaining work for another task
to take over, despite the verification blocker. This checkpoint skips the
blocked commit and pre-push build hooks for transfer only. Staged gitleaks and
diff whitespace checks pass; this is not a merge-readiness receipt.

The runtime retry failed before checks because another workspace owns Blob
port 10023. Recovery could not prove the complete candidate ownership. One
guarded stop failed with `Managed stop requires consistent provider and primary
container state.` Task Hatchet, Postgres and three Redis containers remain
running; app and Azurite remain Created. No other workspace was modified.
The next task must recover the exact managed runtime, finish full checks and
browser acceptance, and verify shutdown. The earlier Analytics Python/pandas
failure has not been retested. No merge, deployment or ingestion is authorized.
