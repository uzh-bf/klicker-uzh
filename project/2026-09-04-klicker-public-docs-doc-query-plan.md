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

- Add dedicated tenant path `/mcp/klicker-public-docs` with exactly one tool,
  `klicker_docs_doc_query`.
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
   containing one tool and its prompt. Register only that tenant's mount and
   token environment reference.
4. Preserve all existing tenant files and the pinned service image.
5. Prove rendered inventory, collection allowlist, network policy, tenant path,
   one-tool visibility, and image/runtime compatibility with focused tests.
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
8. Prove the public path lists exactly one tool; public and course tokens reject
   cross-use; and generic `doc_query` plus a known legacy expert are unavailable
   through the public path.

### B2 public-docs Manage integration

This slice starts only after the retrieval and isolation evaluation passes.

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
- `/mcp/klicker-public-docs` exposes exactly one tool and rejects cross-tenant
  credentials in both directions.
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
- [x] Reached reviewed local source commits for the dedicated ingestion
  project, STG deployment manifests, and values-free STG secret projection.
- [ ] The catalog source is implemented and passes static and full test suites,
  but its required model-backed no-ingestion build is blocked because the
  authenticated self-hosted LiteLLM endpoint is unreachable from this host and
  no approved tunnel is listening at `127.0.0.1:14000`. The failed artifact has
  zero successful classifications, zero model calls, and zero cost.
- [ ] The local Klicker B2 source remains intentionally untouched because this
  plan starts it only after the separately authorized STG ingestion and
  retrieval-isolation evaluation pass.
- [ ] Reach source-ready local commits across all five repositories.
- [ ] Request the separate publication and activation authority.
