# Vorkurs turn-scoped routing and cost accounting

## Goal

Send one pseudonymous routing key per assistant response and one stable
pseudonymous prompt-cache key per thread. Extend the existing usage report to
reconcile aggregate Langfuse and LiteLLM evidence so the cost effect of
disabling gateway affinity can be measured without storing per-call data in
Klicker.

## Non-goals

- No `ChatModelCall` table, per-call model/cost fields, or schema migration.
- No prompt, model-registry, credits, MCP, or answer-quality change.
- No secret values, raw prompts, personal data, or raw production exports in
  the repository.
- No push, merge, cluster action, STG/PRD rollout, paid canary, or production
  claim in this branch.
- No exact course/chatbot gateway-cost allocation; only aggregate
  team/window/model reconciliation is supported.

## Plan identity

- Plan: `project/2026-08-11-chat-turn-affinity-cache-plan.md`
- Branch: `rs/chat-turn-affinity-cache`
- Worktree: `trees/chat-turn-affinity-cache`
- Target: `v3`
- Paired deployment branch: `rs/klicker-turn-affinity`
- Paired deployment plan: `2026-08-11-klicker-affinity-off-plan.md`
- Base: `origin/v3` at `0d7b4e46126f2f01931f07deccbd719ad0c163a5`

## Research

- `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` already receives
  `assistantMessageId`, resolves or creates `currentThreadId`, and has one
  `providerOptions.openai` object shared by all `streamText` tool-loop calls.
- AI SDK `7.0.52` and OpenAI provider `4.0.30` serialize OpenAI `metadata`,
  `promptCacheKey`, and cache-read/cache-write usage details for both provider
  paths. The installed source was checked because Context7 is unavailable.
- `assistantMessageId` is generated for every assistant response. The thread
  is stable across turns, so the two identifiers provide the required
  turn/thread distinction without persistence.
- The existing report uses stored `creditsUsed` and rough visible-text token
  estimates. It has no external Langfuse/LiteLLM aggregate reader.
- The deployment base currently enables gateway affinity everywhere. The
  paired deployment change will make the disabled policy explicit before any
  rollout; the app still sends metadata so controlled later experiments can
  observe the routing key.

## Decisions

- `metadata.session_id` is the deterministic pseudonymous trace id derived
  from `assistantMessageId`, reusing the existing Langfuse message-id helper.
  It is the same for every internal call in one response and changes on the
  next response.
- `promptCacheKey` is a domain-separated deterministic hash of the verified
  owning thread id. The raw thread id is never sent to the provider. Omit the
  cache key if thread ownership cannot be established.
- The provider-options helper is pure and receives identifiers as arguments;
  the route owns authentication, thread lookup, and provider selection.
- External cost evidence is grouped by UTC window, environment, team, and
  routed model. Credits remain a separate product-ledger column.
- Cache algebra is valid only when source fields are present and mutually
  exclusive: `uncached = input - cached - cacheWrite`. Negative buckets,
  missing required coverage, count drift, or cost drift make reconciliation
  incomplete rather than inferred.
- The report keeps its existing local-only path. An explicit reconciliation
  mode reads credentials from the runtime environment and never writes them.

## Test portfolio

| Risk or behavior | Existing evidence | Obligation and seam | Owning slice |
| --- | --- | --- | --- |
| Same-turn tool-loop calls share one session key and cache key | Sparse streamed-tool fixture proves the provider path | Extend the synthetic OpenAI fetch fixture and inspect every request body | Runtime |
| Next assistant response reclassifies while the thread cache key stays stable | No current protection | Add pure provider-options table cases | Runtime |
| Missing thread ownership does not leak a raw id or invent a cache key | Route has ownership checks but no provider-option assertion | Add a pure helper case | Runtime |
| Aggregate cache/cost reconciliation rejects incomplete or inconsistent data | No current external-ledger parser | Add synthetic parser/reconciler tests through existing `tsx`; no dependency | Accounting |
| Existing product report remains usable without external credentials | Current report path | Extend existing report path without changing credits semantics; run package checks | Accounting |

## Slices

### Slice 1 — Reviewed plan

**Do:** Commit this plan as the first commit on the branch.

**Check:** Only this plan is staged; primary-checkout user files are outside
the worktree and cannot enter the commit.

**Commit:** `docs(project): add turn affinity and cost accounting plan`

### Slice 2 — Turn-scoped provider options

**Do:** Add the pure OpenAI provider-options helper, pass its values through the
route's existing `providerOptions.openai` block, and extend the synthetic
stream fixture. Preserve reasoning, response-store, tool, and telemetry
options.

**Check:** Assert same-turn tool-loop request bodies share one session id and
cache key; different assistant ids produce different session ids; same thread
produces the same cache key; missing ownership omits only the cache key. Run
the focused test before and after the change, then the chat suite and package
check.

**Commit:** `enhance(chat): add turn-scoped routing and prompt cache keys`

### Slice 3 — Aggregate ledger reconciliation

**Do:** Add a small pure parser/reconciler under
`packages/prisma-data/src/scripts/lib/`, synthetic tests, and an explicit
report mode in `2026-06-16_analyze_chatbot_usage.ts`. Read Langfuse and LiteLLM
aggregates with native `fetch`; keep host, key, and project values in the
runtime environment. Add separate report fields for credits, gateway spend,
cache buckets, counts, coverage, and reconciliation status.

**Check:** Synthetic success, absent cache-write data, negative algebra, wrong
team/window/model set, generation-count drift, and cost-tolerance drift all
behave as specified. Run the script package checks and inspect output schemas
without using real prompts or production data.

**Commit:** `enhance(prisma-data): reconcile chatbot gateway cost aggregates`

### Slice 4 — Wiki and verification contract

**Do:** Update the relevant chat/testing wiki pages, the verification skill,
and a new dated log entry with the provider-option contract, disabled-affinity
cost experiment, synthetic evidence boundary, and STG/PRD gates.

**Check:** Run focused tests, full chat tests, prisma-data checks, repository
checks, and the data-hygiene review. Review the complete branch after all
changes.

**Commit:** `docs(chat): document turn routing and cost evidence`

## Manual gates

- First prove serialized request fields locally, then verify STG metadata and
  aggregate ingestion with the deployment policy applied through the approved
  GitOps path.
- Compare matched seven-day UTC windows before and after affinity is disabled,
  holding image, model catalog, environment, team scope, weekday mix, and
  unrelated routing changes constant where possible. Report request and
  generation counts, routed-model distribution, input/output/cache buckets,
  cache-read rate, total spend, and average cost per assistant response.
- STG and PRD rollout, secret-backed queries, paid measurement, merge, and
  production claims each require separate approval. Local/CI evidence does not
  prove route selection, cache hits, Langfuse ingestion, Azure billing, or
  answer quality.

## Planning-stage review

- Reviewer: configured Codex planner, read-only, current repositories.
- Result: `DONE_WITH_CONCERNS`.
- Accepted findings: two independent packages; explicit `session_affinity:
  false` in deployment; remove inactive TTL; keep correlation headers; fail
  closed on incomplete cache algebra; use aggregate rather than exact
  course-level cost.

## Progress

- [x] Reconciled live refs and dirty primary checkouts.
- [x] Created clean worktree from current `origin/v3`.
- [x] Completed the revised planning-stage review.
- [ ] Commit this plan.
- [ ] Implement runtime options.
- [ ] Implement aggregate reconciliation.
- [ ] Update durable documentation and complete final reviews.

## Next Steps

1. Commit this plan, then implement the runtime slice.
2. Keep deployment rollout and cost measurement at their explicit approval
   gates.
