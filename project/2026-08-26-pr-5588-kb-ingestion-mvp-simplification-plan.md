---
type: Execution Plan
title: Deliver HTML knowledge-base ingestion through the existing provider
description: Add the missing HTML resource-upsert seam, keep Klicker as a thin dispatcher, and make signed callbacks the normal completion path.
timestamp: '2026-08-26'
tags:
  - knowledge-base
  - ingestion
  - hatchet
  - mvp
---

# Deliver HTML knowledge-base ingestion through the existing provider

Status: approved and in execution

## Plan identity

| Item | Value |
| --- | --- |
| Primary repository | `uzh-bf/klicker-uzh` |
| Klicker target | `v3-ai` at `2c8eac5627a0d506c1a3c832afdd8635fbb48783` |
| Klicker worktree | `trees/rs/kb-ingestion-pinned-lookup` |
| Klicker branch | `rs/kb-ingestion-pinned-lookup` |
| Existing draft PR | [#5588](https://github.com/uzh-bf/klicker-uzh/pull/5588) |
| Current PR head | `56bf4e8605cf62827d1c701eb3aef459e5f5f115`, three commits ahead and 21 commits behind the current target before the approved one-time merge |
| Completed correction to retain | Node 24 pinned-DNS callback compatibility and focused regression coverage |
| Provider repository | `ai/data-ingestion` at `origin/main@d23d41f6ce933ae72c8f3e4090e4978e0fa9ba28` |
| Deployment repository | `ai/deployment` at `origin/main@363900882fb2ceb21aade25ebc091b35b41acd40` |
| Superseded plan | `project/2026-08-26-kb-ingestion-pinned-lookup-plan.md`; its completed evidence is retained in Progress |

## Goal

Deliver a working staging MVP tomorrow in which a lecturer adds a small public HTML URL to a knowledge base, Klicker submits that URL to the deployed data-ingestion Resource API, data-ingestion owns the complete processing and indexing workflow, and Klicker reaches terminal state primarily from the signed result webhook.

Klicker remains a thin application-side bridge. Its Hatchet task validates and submits the resource descriptor, records the provider operation, and repairs known delivery gaps. It does not call or configure web-scraping, and it does not scrape, parse, chunk, embed, or index content.

## Tomorrow critical path

This is achievable in one working day only if repository toolchains are already usable, merge decisions happen promptly, and CI plus image publication do not queue for long.

| Stage | Working estimate | External dependency |
| --- | --- | --- |
| Provider and Klicker source slices, focused tests, and reviews | 3–5 hours | Existing environments and private Python package are available |
| Provider merge CI and immutable image publication | 1–2 hours | Separate merge authority and healthy GitLab runners |
| Deployment pins/policy plus Klicker exact-head CI | 2–4 hours | Provider image digests exist; GitLab and GitHub queues are healthy |
| Staging reconciliation and one synthetic proof | 30–60 minutes | Separate rollout/live authority and matching deployed revisions |

The fastest safe sequence implements the provider and Klicker source slices in parallel, but merges and staging rollout remain ordered.

## Resource API boundary and pragmatic MVP compromise

Klicker sends data-ingestion one Resource API request whose source is the original public URL. The request also carries MIME, display, size, and digest integrity metadata required by the deployed contract; it does not carry the page body. Klicker has no direct web-scraping API, credential, configuration, or network dependency.

Contract preservation is a hard gate. The MVP does not change Resource API request or response models, required digest semantics, idempotency keys, durable outbox behavior, operation-status responses, webhook events, or serving-identity fields. Any implementation that needs one of those changes exceeds this plan and returns for a new decision.

Inside data-ingestion, the resource-upsert workflow currently stores and verifies exact source bytes but parses only PDF and plain text. Its canonical URL parsing path already handles HTML. The MVP closes that internal provider gap by routing verified HTML URL resources through the canonical data-ingestion URL parser. Which deployed extraction service data-ingestion uses behind its own boundary remains an implementation detail of data-ingestion.

The current provider implementation may fetch the URL once to establish the accepted snapshot and again during canonical HTML extraction. The source SHA proves the accepted response, while extraction may observe a later response. A changing page can therefore produce parsed text that is not byte-for-byte represented by the accepted source SHA.

The two identities remain explicit. The expected, observed, candidate, and serving SHA values remain the first-fetch raw HTML digest. `ParseResult.content_hash` remains the second-fetch scraped-markdown hash. Existing PDF and plain-text parsing continues to use the snapshot digest as its parse content hash.

This compromise is acceptable only for tomorrow's synthetic staging proof. It is documented, tested, and excluded from production promotion. The later production design should let the scraping service process the immutable accepted snapshot, or return a verifiable content identity that the provider can settle atomically.

## MVP architecture and ownership

```text
Manage UI / GraphQL transaction
        |
        | creates the KB resource attempt
        v
Klicker Hatchet dispatch task
        |
        | submits resource URL plus required integrity metadata once
        v
data-ingestion Resource API -> outbox -> provider Hatchet resource-upsert
        |
        | fetch/verify resource -> parse HTML -> chunk -> embed -> index
        v
signed webhook -> Klicker ingestion state and serving identity

Overdue fallback only:
Klicker monitor -> provider operation API after a five-minute grace period
```

| Concern | Owner in the MVP |
| --- | --- |
| Lecturer request, quota, resource version, and visible status | Klicker |
| Durable application command dispatch and crash-window recovery | Klicker Hatchet |
| Source acceptance, scraping, parsing, chunking, embedding, and indexing | data-ingestion and its Hatchet workers |
| Normal completion notification | Signed provider webhook |
| Missed or delayed callback recovery | Overdue-only Klicker reconciliation |

## Non-goals

- No second scraper or ingestion engine in Klicker.
- No direct Klicker integration with a web-scraping service.
- No provider API schema change, new queue, new service, or new dependency.
- No removal of URL preflight, public-address validation, DNS pinning, digest verification, source-size limits, callback authentication, or operation correlation.
- No database migration, GraphQL contract change, Manage UI redesign, or new navigation behavior.
- No knowledge-graph or question-generation activation.
- No recursive crawling, broad MIME expansion, cancellation redesign, production hardening programme, or production rollout.
- No real course data, secret access, manual retries, cleanup, deletion, or graph work in the staging proof.

## Evidence and resolved decisions

- The provider requires `content_sha256` when `POST /v1/resources` accepts a source. Klicker must keep its URL preflight and hash for this MVP.
- `modules/ingestion/src/ingestion/source_snapshot.py` verifies and stores exact bytes, then accepts only `application/pdf` and `text/plain`; HTML currently fails with `unsupported_snapshot_mime`.
- `modules/ingestion/src/ingestion/steps/parsing/step.py:parse_url` already sends non-PDF URLs through `uzh-web-scraping-client`. The resource-upsert path does not call it.
- Deployment pins both ingestion images to source `d23d41f6...` and permits only PDF/plain text for the Klicker producer. Both the source image pins and producer policy must advance before HTML can work.
- Klicker uses one PDF/plain-text MIME set for blobs, URLs, request headers, and persisted-source reconstruction. HTML support must split policy by source kind and reject HTML blobs both initially and on retry reconstruction.
- Klicker currently polls every active operation every minute despite receiving signed callbacks. The MVP polls only operations at least five minutes old and rotates the bounded poll window on the same five-minute cadence.
- The maintenance workflow already repairs the transaction-to-dispatch crash window with the stable ingestion-attempt ID. It remains unchanged.
- Existing operation, resource-version, and digest correlation plus atomic terminal-state updates remain unchanged.
- The failed RFC plain-text staging fixture is retained and is not retried during source implementation.

## Product primitive impact

| Primitive | Action | MVP impact |
| --- | --- | --- |
| Knowledge base and resource | Extend | A lecturer can add an HTML URL; quota, ownership, and lifecycle stay unchanged |
| Ingestion attempt and serving identity | Reuse | No schema or lifecycle expansion |

## ADR gate

No ADR is required for the reversible staging MVP because it does not change the public Resource API or add a durable domain concept. The known two-fetch limitation is recorded here and in data-ingestion documentation. Any production design that changes digest ownership, accepts provider-computed identity, or processes immutable HTML snapshots through a new service contract reopens the ADR gate.

## Execution contract

- Execution owner: the task that receives approval for this plan acts as the cross-repository execution orchestrator.
- Approval of this plan authorizes the named source, test, documentation, and plan edits; repo-local worktrees and `rs/` branches; repository-native checks; required bounded reviews; local conventional commits; normal feature-branch pushes; draft PR/MR creation or update; exact-head CI readback; and marking a change ready only after its review and CI gates pass.
- No action above occurs before approval. Published history is updated normally; no force-push is authorized.
- Klicker may integrate fresh `origin/v3-ai` with a normal non-destructive merge before edits. A conflict or material semantic change returns control to the user.
- The provider and Deployment repositories each receive one repo-local worktree from a fresh remote default branch. Existing unrelated dirty primary checkouts are never used for implementation.
- Boundary owner: `self`. No child owns cross-repository sequencing, architecture, external effects, or final claims.
- Withheld: merge, protected-branch push, force-push, image publication outside normal repository CI, secret access or writes, deployment, Argo sync, cluster access or mutation, staging proof, retry, cleanup, deletion, and every production action.
- Phase-one terminal: provider and Klicker source changes have immutable reviewed heads, terminal exact-head CI, accurate draft/ready descriptions, and the Deployment change is prepared as far as immutable provider image pins allow.
- The provider merge and image build are a separate authority gate. After those images exist, the same approved package may resume only after the user names the next action or grants the merge/rollout sequence.
- Pause conditions: unexpected provider contract or schema change; source beyond the named paths; inability to build both provider images from one source ref; a merge conflict requiring a product or architecture ruling; or any need to cross a withheld boundary.

## Skill and review routing

- `$rs-product-primitives` fixes ownership at the product boundary: Klicker owns lecturer-visible state; data-ingestion owns content processing.
- `$rs-build-ai-systems-on-hatchet` requires one owner per concern, stable idempotency, and explicit callback/reconciliation semantics. It rules out a second ingestion workflow in Klicker.
- `$rs-sliced-development-workflow` owns the full-path package, commit boundaries, test portfolio, reviews, and PR/MR finish gates.
- `$rs-model-routing` owns all specialist routes. Repository content is values-free and contains no credentials or personal data before dispatch.
- Each substantive committed slice receives a simplifier. Provider HTML parsing, Klicker URL/SSRF handling, and callback/reconciliation each receive one risk-selected slice review. One final reviewer inspects each complete provider MR, Deployment MR, and Klicker PR before that package is presented as ready. The main task then verifies exact refs and ordering across repositories.

## Planning review disposition

The required read-only planner blocked the first draft because it incorrectly assumed the Resource API's resource-upsert path already used web scraping for HTML. That finding is accepted. This plan now adds the smallest provider source slice and advances immutable images with the producer policy.

The planner's MIME-policy split, persisted-retry rejection test, five-minute rotation, and fresh-base findings are also accepted. Its recommendation to drop HTML is rejected because the user explicitly requires HTML for tomorrow's MVP. Its suggestion that a future plan approval cannot authorize normal feature-branch push is not adopted: this plan names that reversible delivery action prospectively, while no push is authorized before the user approves the plan.

## Delegation map

| Work item | Owner | Depends on | Acceptance |
| --- | --- | --- | --- |
| Provider HTML resource-upsert seam | Main | User approval and fresh provider base | Verified HTML URL reaches data-ingestion's canonical URL parser; provider tests pass |
| Klicker URL-only HTML policy | Main | Fresh Klicker target integration | HTML URL accepted; HTML blob and retry reconstruction rejected; pinning retained |
| Klicker webhook-primary reconciliation | Main | Fresh Klicker target integration | Fresh operations excluded; overdue operations reconcile on five-minute rotation |
| Provider and Klicker documentation | Main | Matching source slices | Wiki text states ownership and temporary two-fetch limitation |
| Deployment image and MIME policy | Native executor | Provider merge ref and immutable image digests | Both images use one reviewed source ref; Klicker allows exactly three MIME types |
| Cross-repository integration and delivery | Main | All available immutable heads | Exact-head review, CI, descriptions, and sequence are coherent |

The provider and Klicker source slices stay in the main task because they define the cross-system data-integrity contract. The Deployment slice belongs to one native executor after the execution owner refreshes its path reservation; the main task retains publication, sequencing, and acceptance.

## Feature-wide test portfolio

| Behavior or risk | Existing evidence | Planned obligation | Proof |
| --- | --- | --- | --- |
| Node 24 pinned lookup supports `all: true` and scalar form | Focused PR #5588 regression | Retain unchanged | Hatchet tests return the validated public IPv4 in both requested shapes |
| Provider rejects altered accepted bytes before parsing | Existing snapshot digest tests | Reuse and keep ahead of HTML branch | Digest mismatch never enters HTML parsing |
| Verified HTML source uses the provider URL path | Missing | Add focused provider test | Canonical URL parsing receives the accepted URL, resource identity, metadata, and cleaning config |
| Provider refuses HTML blobs | Missing | Add focused provider source-kind test | `text/html` with `source_kind: blob` fails before URL parsing |
| Raw source and scraped content retain distinct identities | Missing | Add focused differing-hash test | First-fetch SHA remains operation/serving identity; scraped-markdown hash remains `ParseResult.content_hash` |
| Provider resource-upsert can complete with HTML | Missing | Add one workflow-level test with a synthetic parser result | Parsed artifact and inactive-candidate path accept HTML without live services |
| Public HTML URL reaches the provider contract | Missing | Add focused Klicker test | Prepared source has `kind: url`, `text/html`, exact size/SHA, and original URL |
| URL redirects retain SSRF pinning | Existing tests | Reuse; extend only if the source-kind split changes the seam | Every redirect is normalized, resolved, and pinned before fetch |
| Uploaded and reconstructed HTML blobs remain unsupported | Missing after policy split | Add focused assertions | Blob preparation and persisted-source reconstruction reject `text/html` |
| Signed webhook settles a correlated operation | Existing GraphQL route tests | Reuse, do not duplicate | Existing callback tests remain green |
| Fresh operations avoid routine polling | Missing | Add focused monitor test | Operation younger than five minutes causes no provider status request |
| Missed callback still converges | Existing monitor transition tests | Adapt to overdue timestamp and five-minute slot | Overdue operation is polled and settles atomically |
| Deployment source and policy are exact | Validator checks source identity but not final HTML set | Extend focused validator | API and worker pins share the provider ref; Klicker allows PDF, plain text, and HTML only |

No UI, GraphQL, or database test is added because those contracts do not change. The authenticated Manage UI flow is proven once after a separately authorized staging rollout.

## Slice 0: Reconcile bases and preserve the published fix

- Problem: PR #5588 contains the necessary Node 24 fix but is one Klicker target commit behind, while the provider and Deployment primary checkouts contain unrelated work.
- Decision: Widen PR #5588 rather than stack another Klicker PR. Create fresh repo-local worktrees for provider and Deployment work.
- Risk: Rebasing published PR history would require a force-push. Use a normal target merge if update is still needed; stop if that produces semantic conflicts.
- Do: Fetch all three remotes, rerun freshness gates, record exact refs and dirty-state ownership, then create or reuse only the named task worktrees.
- Check: Fresh targets are ancestors of new heads; primary checkouts remain untouched; the existing Node 24 focused/full Hatchet tests still pass.
- Commit: `docs(kb): plan HTML ingestion MVP` when execution starts.
- Route: Main.
- Acceptance: The three implementation surfaces have clean ownership and current bases without rewriting published history.

## Slice 1: Add HTML to the deployed provider resource-URL path

- Problem: `parse_source_snapshot` rejects HTML even though the request already entered data-ingestion through the supported Resource API URL contract.
- Decision: After exact snapshot integrity and MIME checks pass, route `text/html` to data-ingestion's existing canonical URL parsing seam only when `event.source_kind` is `url`. Preserve PDF and plain-text branches unchanged. Add no dependency or provider API field.
- Risk: The current internal implementation can fetch the URL a second time. Keep the accepted snapshot and observed SHA unchanged, stamp provider parser provenance in parsed metadata, and document that parsed text can differ if the page changes. Do not present it as production-grade exact-byte parsing.
- Do: In a fresh `data-ingestion` worktree on `rs/kb-ingestion-html-resource-upsert`, make the narrow parsing change in `modules/ingestion/src/ingestion/source_snapshot.py`; add focused tests in `modules/ingestion/tests/test_source_snapshot.py` and the closest existing resource-upsert workflow test.
- Check: Red-before-green focused tests; `uv run poe test-ingestion`; `uv run poe check`; exact diff; no external scrape or credential use.
- Commit: `enhance(ingestion): support HTML resource snapshots`.
- Route: Main, then simplifier and data-integrity/cross-system slice review on the immutable commit.
- Acceptance: A verified synthetic HTML resource URL produces a canonical data-ingestion parse artifact and can continue through resource-upsert; altered bytes and HTML blobs fail before URL parsing; operation/serving SHA and parsed-content hash retain their distinct documented meanings; `modules/ingestion-api`, outbox, status, and webhook contracts have no semantic diff.

## Slice 2: Allow HTML only for Klicker URL sources

- Problem: Klicker rejects HTML before the provider receives it, and one shared allowlist cannot safely distinguish uploads from URLs.
- Decision: Split MIME policy by source kind. Keep blobs at PDF/plain text. Add HTML only to URL preparation, the URL fetch `Accept` header, and URL reconstruction validation.
- Risk: URL preparation is an SSRF boundary. Do not change normalization, public IPv4 validation, address pinning, redirect limits, timeouts, source-size enforcement, or digest calculation.
- Do: Refine `packages/hatchet/src/kbIngestionApi.ts`; extend `packages/hatchet/test/kbIngestionApi.test.ts` at the existing private request/source-preparation and reconstruction seams.
- Check: Focused red-before-green tests; full Hatchet tests; package check/build; affected-file formatting/lint; exact diff.
- Commit: `enhance(kb): allow HTML URL ingestion`.
- Route: Main, then simplifier and SSRF/data-integrity slice review.
- Acceptance: HTML URLs preserve original URL, MIME, exact byte count, and SHA; uploaded or reconstructed HTML blobs fail; all pinning regressions stay green.

## Slice 3: Make callbacks normal and polling exceptional

- Problem: Polling every active operation every minute duplicates the signed callback path; removing polling entirely would strand missed callbacks.
- Decision: Keep the webhook unchanged as primary. Run the monitor every five minutes, select only operations whose `externalOperationStartedAt` is at least five minutes old, and rotate the bounded window using five-minute slots.
- Risk: A wrong cutoff or slot calculation can strand operations or repeatedly select one subset. Use the injected clock and retain existing count, wraparound, concurrency, correlation, and atomic transition behavior.
- Do: Update `packages/hatchet/src/kbIngestion.ts`, only the ingestion cron in `packages/hatchet/src/index.ts`, focused monitor tests in `packages/hatchet/test/kbIngestion.test.ts`, and any exact cron assertion.
- Check: Fresh, overdue, wraparound, and terminal-transition tests; existing callback tests; full Hatchet tests/check/build/format/lint.
- Commit: `refactor(kb): reconcile only overdue ingestions`.
- Route: Main, then simplifier and cross-system reliability slice review.
- Acceptance: A normal callback-driven operation is not polled during the grace period; an overdue operation still converges to the same correlated state.

## Slice 4: Document the ownership and MVP limitation

- Problem: Klicker docs describe minute polling and PDF/plain-text support only; provider docs do not describe HTML resource-upsert or its temporary two-fetch behavior.
- Decision: Update only the relevant worker/resource-workflow sections in each repository.
- Do: Update `docs/async-and-workers.md` in Klicker and the closest resource-upsert workflow page in data-ingestion. State the Resource API URL boundary, one processing owner, no direct Klicker/web-scraping integration, callback-primary settlement, overdue fallback, URL-only HTML, both content identities, and the possible two-fetch staging limitation.
- Check: Documentation matches tested constants and metadata; repository formatters pass.
- Commit: `docs(ingestion): document HTML resource identity` in data-ingestion and `docs(kb): describe ingestion MVP ownership` in Klicker, each after its repository's source slice.
- Route: Main.
- Acceptance: A maintainer can identify the real processing worker, the reason for Klicker's preflight, and the production limitation without reading this plan.

## Slice 5: Advance provider images and Klicker producer policy together

- Problem: Deployment currently pins source `d23d41f6...` and rejects HTML for Klicker. A policy-only change would admit work that the deployed worker cannot complete.
- Decision: After a separately authorized provider merge produces immutable images, update both ingestion image pins to that one source ref and add HTML to the exact Klicker MIME set in the same Deployment MR.
- Risk: Accidental changes to callbacks, credentials, source kinds, limits, or other producers would expand scope.
- Do: In a fresh Deployment worktree on `rs/kb-ingestion-html-activation`, edit only `ingestion/stg-generic/kustomization.yaml`, `ingestion/stg-generic/producer-registry/klicker.yaml`, and focused source/MIME expectations in `ingestion/stg-generic/validate_render.py`.
- Check: Focused render validator and applicable repository checks; immutable registry digest readback; exact three-path diff.
- Commit: `enhance(ingestion): activate Klicker HTML URLs`.
- Route: Native executor after reservation refresh, followed by simplifier on the immutable commit. Main owns publication, sequencing, and acceptance.
- Acceptance: API and worker images share the reviewed provider source ref; the rendered Klicker producer permits exactly PDF, plain text, and HTML; every other field is unchanged.

## Slice 6: Integrate, review, and prepare delivery

- Problem: The three changes have an execution dependency, and source CI is not live proof.
- Decision: Use three ordinary cross-repository changes, not a rewritten native stack. Merge and rollout order is provider, Deployment, then Klicker.
- Do: Run exact-head checks; complete one final review for each complete repository package; apply verified findings within the correction budget; update whole-branch descriptions; monitor exact-head CI; mark ready only when review and CI pass. After provider images and Deployment pins exist, the main task performs a values-free integration check of exact refs and ordering.
- Check: No unresolved actionable feedback; terminal required CI; mergeability against current targets; descriptions state dependencies and the separately gated staging proof.
- Commit: Corrections use the smallest accurate conventional type; final plan receipt uses `docs(kb): record HTML ingestion verification` if needed.
- Route: Main.
- Acceptance: Each change is independently reviewable, dependencies are explicit, and no source/CI result is presented as deployed behavior.

## Merge and rollout sequence

Each row is a separate authority gate.

| Order | Change | Why it comes here | Stop condition |
| --- | --- | --- | --- |
| 1 | data-ingestion HTML resource-upsert MR | Produces the worker behavior and immutable images | Exact-head CI/review pass; ask before merge |
| 2 | Deployment image/policy MR | Makes the capable provider active before Klicker submits HTML | Exact-head CI/review pass; ask before merge/sync |
| 3 | Klicker PR #5588 | Enables lecturer HTML URL submission and overdue-only fallback | Exact-head CI/review pass; ask before merge/rollout |
| 4 | One synthetic staging proof | Proves the real Manage UI, provider workflow, callback, serving identity, and retrieval path | Ask for the bounded live action |

## Staging proof gate

This plan does not authorize the proof. After all three changes are merged, images are published, and staging reconciliation is confirmed, request one explicit approval to:

1. Create one synthetic knowledge-base URL resource through the authenticated Manage UI using a small, stable public HTML page with non-personal text.
2. Observe values-free identifiers and state for the Klicker attempt, provider operation/workflow, signed callback, serving version/digest, and terminal `READY` state.
3. Verify one retrieval result from the indexed resource without enabling graphs or question generation.
4. Retain the synthetic resource for user inspection by default. Do not delete it unless cleanup is separately approved.

Stop without retry if submission fails, HTML is rejected, callback correlation fails, deployed revisions do not match the reviewed heads, the agreed synthetic cost ceiling is exceeded, or real user data appears.

## Delivery boundaries

- A green PR or MR proves source and CI only. It does not prove desired state, deployed revision, provider execution, database settlement, serving identity, or user-visible readiness.
- Merge, image publication beyond normal CI, deployment, Argo sync, cluster action, staging proof, retry, cleanup, deletion, and production remain separately authorized.
- Production promotion is explicitly blocked until the two-fetch HTML compromise is replaced or accepted through a new reviewed production plan.

## Progress

- 2026-08-26: The user approved this plan for execution through reviewed, published source heads and terminal exact-head CI. Merge, deployment, staging proof, retries, cleanup, deletion, graph work, and production remain withheld.
- 2026-08-26: Remote refs were refreshed before execution. `origin/v3-ai` advanced to `2c8eac5627a0d506c1a3c832afdd8635fbb48783`; the published Klicker branch is 21 commits behind and three commits ahead. The approved one-time non-destructive target merge remains the next Klicker integration step. `origin/dev` has unrelated substantial drift and is not part of the approved target.
- 2026-08-26: The Node 24 pinned-lookup failure was reproduced before correction. PR #5588 now returns the validated IPv4 in Node's requested callback shape.
- 2026-08-26: The focused/full Hatchet run passed 105 tests; Hatchet type-check, build, affected-file formatting, and the original security-aware review passed. The failed RFC staging fixture was not retried.
- 2026-08-26: Fresh research confirmed the provider's accepted Resource API contract and its existing generic web-scraping client.
- 2026-08-26: Planning review found that resource-upsert itself still rejects HTML. The initial policy-only draft was discarded.
- 2026-08-26: This corrected plan adds the minimal provider HTML seam, immutable image/policy activation, URL-only Klicker support, callback-primary settlement, and no graph work.
- 2026-08-26: The corrected planner cross-check returned `DONE_WITH_CONCERNS`. All actionable corrections were accepted: URL-only provider enforcement, separate raw/scraped identities, one Deployment executor, separate docs commits, and one final review per repository package.
- 2026-08-27: Klicker now accepts `text/html` only for URL sources while blobs remain PDF/plain text. The original URL, observed MIME, byte count, SHA-256 digest, redirect-by-redirect public IPv4 validation, and pinned lookup are unchanged. Commit `8d36dec85` passed the Node 24 Hatchet suite, package check, build, and changed-file formatting.
- 2026-08-27: The signed callback is now the normal completion path. Commit `bf19362e0` runs reconciliation every five minutes, filters to operations at least five minutes old, and retains the bounded 32-row rotating window, concurrency of eight, and all correlation guards. The full Node 24 Hatchet suite passes 108/108.
- 2026-08-27: Klicker documentation and the data-model skill now describe the Resource API ownership boundary and overdue-only fallback at `90ce25b4e`. The task runtime is retained only for this active package until final verification finishes.
- 2026-08-27: The configured Gemini simplifier and slice-reviewer routes failed before inspection with an external credit-limit response. The required same-scope continuity reviews were dispatched once on trusted Luna. No implementation or authority boundary changed.
- 2026-08-27: The callback reliability review found that provider-request latency counted toward the grace period. Commit `0eb04d125` now records the external start time only after provider acceptance; the same reviewer returned `DONE` after 108/108 Node 24 Hatchet tests, package check/build, and Biome.
- 2026-08-27: data-ingestion commit `69e5e7126d143275d611ff9a603768c815e7c992` accepts verified `text/html` only for URL resources, preserves raw and parsed content identities, and documents the staging-only two-fetch limitation. The focused suite passed 45/45, the earlier unchanged-code full suite passed 1529 tests with 60 skipped, and `uv run --frozen poe check` passed.
- 2026-08-27: Deployment commit `6f6c3181` adds `text/html` to Klicker's exact STG producer MIME set and pins that set in `validate_render.py`. Rendering and validation passed for 36 documents. `kustomization.yaml` and both provider image pins remain unchanged until immutable artifacts exist, so this slice is source-prepared but not deployable or final-review-ready.
- 2026-08-27: `origin/dev` is 62 commits ahead of its merge base with this branch, but it is a legacy non-target branch. The approved target remains `v3-ai`; no `dev` merge or rebase was performed.
- 2026-08-27: The final Klicker review found one low-severity timing inconsistency in deletion reconciliation. Commit `b19079703` now records the deletion start time after provider acceptance, matching resource upsert; the Node 24 Hatchet suite remains green at 108/108 with package check, build, and Biome passing.
- 2026-08-27: Provider source head `69e5e7126d143275d611ff9a603768c815e7c992` is published as draft MR !126, and Deployment source head `6f6c3181858fa4d4fc76f1b1b54bcbc565002ae2` is published as draft MR !693. Both remain unmerged; immutable provider image pins and all rollout actions remain withheld.
