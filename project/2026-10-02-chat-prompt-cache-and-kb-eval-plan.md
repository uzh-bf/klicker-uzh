# Chat prompt caching and KB-grounded router evaluation

## Approval summary

**Why and what changes?** Production Auto requests carry 14,000–24,000
prompt tokens, but only 28–36% of them are read from Azure's prompt cache.
Under auto-router v2, prompt tokens are about three quarters of the cost of a
MEDIUM answer. The first DeepEval comparison of v1 and v2 also could not
separate the routers: bare questions without the chatbot context, judged for
semantic similarity, put both at a median of 0.9.

This plan has two parts:

- Part A makes Klicker's chat requests cache-friendly. It moves per-turn
  context behind the conversation history, keeps the tool list constant,
  derives `prompt_cache_key` from the thread rather than the whole prompt,
  and keeps the two calls of one answer on the same model through LiteLLM's
  existing router session affinity. The target is a cache rate above 70% on
  follow-up turns that stay on the same model family (Luna or Sol). The
  overall rate depends on how often v2 switches families between turns,
  which A1 measures.
- Part B evaluates both routers on the real staging chatbot path with a real
  knowledge base. It uses a second registry model for v2, KB-grounded
  questions, a fact-checklist rubric and a blind pairwise judge.

**What stays unchanged?** Answer content, grounding rules, citation behaviour,
the router tier maps and production routing. Production stays on v1.

**What could change the decision?**

- Azure charges for cache writes on GPT-5.6 and later. Higher reuse should
  outweigh this, but the write rate is not yet known. A1 measures it before
  any change, and A5 compares writes with reads.
- LiteLLM already pins a session to its first routed model when
  `session_affinity` is on and the request carries `metadata.session_id`.
  We turned it off for every tenant on 2026-08-12 (ai/deployment 7eedc965) to
  measure the cost of classifying every request. We recommend a turn-scoped
  id: one per assistant answer, so both calls of an answer share a model and
  each new question is classified again. A thread-scoped id would freeze the
  first question's tier for an hour, because escalation keywords are off.
  Re-enabling affinity for the `klickeruzh` routers is a staging
  infrastructure change that needs its own approval.
- The staging KB documents go to Azure through staging LiteLLM, which is the
  normal staging data path. Ground-truth answers written from those documents
  must not be committed to this public repository unless the material is
  public or synthetic.

**How will we know it is done?**

- `observe.py` reports cache rate by turn position and call step, before and
  after Part A, on staging traffic from a scripted multi-turn conversation.
- A paired v1-vs-v2 report on the staging KB set gives win rate and a
  bootstrap CI that either excludes zero or shows the routers are equivalent.

**What does approval authorize?** Implementation of Parts A and B on task
branches, draft PRs into `v3-ai`, staging values changes, and evaluation runs
against staging with the staging keys. Separately, the user has already
authorized merging #6330 into `v3-ai` with a merge commit once all checks
pass, and promoting it to staging through the `v3-ai` -> `v3-audit` sync PR,
also with a merge commit.

This plan also asks for two conditional merges, needed because A5, B3's
canary and B6 run against staging:

1. The Part A PR (A2, A3 and the Klicker half of A4) and #6360:
   merge each into `v3-ai` with a merge commit, once exact-head CI and the
   final AI review pass.
2. Then merge the `v3-ai` -> `v3-audit` sync PR with a merge commit, once its
   checks pass, to put them on staging.

If either condition fails, only the dependent staging steps wait. The
terminal condition is the A5 and B6 reports recorded in this plan. Still
withheld: the ai/deployment affinity change (A4 gateway half), production
changes, and committing real course material.

## Execution details

### Evidence

Request layout today (Responses API, stateless, full history resent per
turn; `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`):

1. `tools`, sorted by name (`lib/server/promptCacheIdentity.ts`).
2. `instructions` = compiled system prompt (about 3,500 tokens for tutor mode
   with `doc_query`), followed by per-turn blocks
   (route.ts ≈1425–1443): page/chat context, eLearning snapshot (includes an
   `observedAt` timestamp), practice candidates (re-ranked each tutor turn)
   and the response-example summary.
3. `input` = prior user and assistant text, then the new user message.
4. Step 0 forces `doc_query`; step 1 resends everything plus the tool result.

Cache breakers, by expected impact:

| # | Breaker | Effect |
| - | ------- | ------ |
| 1 | Per-turn blocks at the end of `instructions` | Any change invalidates the cached history behind them; practice candidates change on almost every tutor turn |
| 2 | Router session affinity is off (ai/deployment 7eedc965) and Klicker sends no `metadata.session_id` | Step 0 and step 1 of one answer classify the same user ask, but the LLM classifier can still disagree, so they may land on different models with separate caches; step 1 also pays a second classifier call |
| 3 | `prompt_cache_key` hashes the full per-turn instructions | Consecutive turns of one thread get different keys, so Azure spreads them across cache shards |
| 4 | Practice tool registered only when candidates exist (route.ts ≈1343) | The tool list, which is the very start of the prefix, changes between turns |
| 5 | No `previous_response_id`; prior tool results dropped from history | Expected; history stays append-only text, so it can still cache |

Staging gateway (ai/deployment `litellm/stg-generic/config.yaml`, read
2026-10-03): v2 maps SIMPLE to `gpt-6-luna-high` and MEDIUM, COMPLEX and
REASONING to `gpt-6.1-sol-low`, `-medium` and `-high`. Each alias has exactly
one entry, and all Luna aliases share one Azure deployment, as do all Sol
aliases; they differ only in reasoning effort. Router state uses Redis. So a
tier switch between turns breaks the cache only when it crosses Luna and Sol,
assuming reasoning effort is not part of Azure's cache key. A1 checks that
assumption.

Azure rules (Microsoft Learn, "Prompt caching", read 2026-10-02): exact-prefix
match of at least 1,024 tokens; caches are per deployment; GPT-5.6 and later
support `prompt_cache_key`, explicit `prompt_cache_breakpoint` blocks and
`prompt_cache_options.ttl: 30m`; cache writes are billed on those models;
about 15 requests per minute per key and prefix before misses rise.

### Part A: prompt caching

- **A1 Measure.** Production: aggregate cache rate by router, tier and call
  step, plus `cache_write_tokens`; no turn position, because production
  requests carry no thread id today. Staging: a scripted conversation from
  one synthetic participant, sent serially with realistic gaps of 1–5
  minutes. Join its spend-log rows by caller key and timestamp order to get
  turn position, call step and same versus switched model (Luna or Sol
  family, and effort within a family). Extend `observe.py` with a
  `--script-run` mode for this join and add a cache-write price to its cost.
  Run it only after #6330 has put v2 on staging, and record the router per
  run. Acceptance: a baseline table recorded in this plan.
- **A2 Stable prefix.** Keep everything that is fixed per chatbot, mode or
  thread in `instructions`: the compiled prompt, the response-example
  summary and the eLearning grounding policy text. Move only per-turn data
  (page or chat context, the eLearning snapshot with `observedAt`, and the
  practice candidates) into one `developer`-role context message placed
  directly before the new user message. That message is never persisted and
  never replayed in history. The authority order from `compileSystemPrompt`
  is unchanged for the static text. Register the practice tool by chatbot or
  course capability, so the tool set is constant within a thread, and have
  it refuse when a turn has no candidates. Acceptance:
  - unit test that turn N+1's request equals turn N's request up to the end
    of the previous assistant message (tools, instructions and history);
  - unit test that an MCP discovery failure does not silently change the
    static prefix, or is logged when it does;
  - chat browser check that practice, page context and eLearning grounding
    still work.
- **A3 Cache key.** Derive `prompt_cache_key` from chatbot, mode, deployment
  and thread, not from the full instructions. Hash the thread id with a
  domain-separated seed so the raw id never leaves Klicker, as the closed
  draft #5365 (`origin/rs/chat-turn-affinity-cache`, `openaiProviderOptions.ts`)
  did. The key's deployment part is the router alias, so Luna and Sol calls
  share it harmlessly. A thread produces about two calls per answer, far
  below the 15 per minute limit. A pure thread key stops new threads from
  reusing the chatbot's cached static prefix. If A1 shows many single-turn
  threads, use `chatbot + mode + (thread hash mod k)` instead. Acceptance:
  unit test for key stability across turns of one thread.
- **A4 Same model per answer.** Use LiteLLM's complexity-router session
  affinity rather than a Klicker-side pin.
  - Klicker: on the default route, send `metadata.session_id` as the existing
    pseudonymous Langfuse trace id of the assistant message. It is constant
    for both calls of one answer and changes on the next answer. #5365 has
    this helper and its tests; port it.
  - ai/deployment (separate approval): set `session_affinity: true` and
    `session_affinity_ttl_seconds` on the two `klickeruzh` routers in staging
    only. LibreChat tenants keep affinity off. The central migration test
    asserts false for every v2 router, so it must change deliberately to an
    allow-list of tenants.
  - LiteLLM namespaces the pin by caller key and router, so Klicker ids cannot
    collide with LibreChat conversation ids. Affinity is skipped when router
    `plugins` are set; none are today.
  - Use a short TTL (a few minutes), since each id covers one answer. Pin
    state lives in the router cache; confirm it uses the configured Redis so
    every staging replica sees the pin.
  - Acceptance: in staging spend logs, both calls of each scripted answer
    report the same model with cause `session_affinity_pin` on step 1, and the
    next question is classified afresh.
  - #5365 was closed because adding cache changes would confound the
    affinity-off measurement. That measurement was then moved to the
    ai/deployment cost audit (5eb65fdb, 014e59e0). A1 records a fresh
    baseline first, so this change is measured against current traffic.
- **A5 Verify.** Rerun the A1 staging script. Report the cache rate split by
  same-family and cross-family turns, with and without affinity, so the
  Klicker PR has its own proof before the ai/deployment change. Compare the
  default cache retention with `prompt_cache_options.ttl: 30m` against the
  extra write cost. Acceptance: follow-up-turn cache rate above 70% on
  same-family turns, writes reported, cost per answer recomputed with
  `analyze.py`.

### Part B: sharper KB-grounded evaluation

- **B1 Target.** Pick a staging chatbot whose KB has real documents
  (read-only DB query: KB, resource count, linked chatbots). Use a dedicated
  synthetic staging participant with credit headroom. Credentials go through
  `rs-infisical-operator`.
- **B2 Router comparison.** Staging `auto` itself now routes through
  `klickeruzh/azure/auto-router-v2` (#6330). A staging-only second registry
  model is dropped (ruling 2026-10-05): the stg/prd registry parity test
  requires the same model menu in both environments. Compare v1 and v2
  routing at the gateway with `evaluation/routing` (`bench.py`), and run the
  KB-grounded quality evaluation single-arm on staging `auto` (v2).
- **B3 Remote target.** Let `apps/chat/scripts/klicker-evaluation-target.mjs`
  accept an explicit HTTPS origin allow-list through an opt-in variable, and
  take the chatbot id from `KLICKER_EVAL_CHATBOT_ID`. Acceptance: one canary
  question returns a `KB_doc_query` call and a persisted answer from staging.
- **B4 Questions.** 25–30 questions answerable only from the chosen KB, in
  tutor and explainer mode, including multi-hop, numeric-detail and
  no-answer cases. Store them in a gitignored local directory unless the
  material is public.
- **B5 Rubric and judge.** Add a fact-checklist GEval (expected facts
  covered, contradictions, unsupported claims) and keep `faithfulness`
  against the captured `retrieval_context`. Add a blind pairwise judge
  (`evaluation/routing/src/routing_eval/pairwise.py`, reusing `bench.py`'s
  judge client) that scores A and B in both orders with a non-OpenAI judge.
- **B6 Run and report.** Two to three repeats per arm. Report win rate,
  paired bootstrap CI, major errors, time to first token and cost per answer
  from `observe.py`. Apply the decision rules in the routing skill.

### Staging rollout of v2 (#6330)

1. Settle #6330's exact-head CI (all eight Playwright shards passed in run
   37057554934; a superseded run shows a stale cancellation) and the final AI
   review.
2. Merge #6330 into `v3-ai` with a merge commit.
3. Merge the maintained `v3-ai` -> `v3-audit` draft sync PR with a merge
   commit once its checks pass. Staging builds from `v3-audit`; the staging
   promoter re-validates the head before moving `stg-release`.
4. Verify that staging chat sends `klickeruzh/azure/auto-router-v2` for Auto,
   using staging spend logs. Production stays on v1 (#6332 on `v3`).

### Delegation Map

| Workstream | Steps | Owner | Repository and target | Depends on | Acceptance |
| --- | --- | --- | --- | --- | --- |
| Staging v2 rollout | #6330 steps 1–4 | main | klicker-uzh, `v3-ai` then `v3-audit` | final AI review | spend logs show `auto-router-v2` for staging Auto |
| Measurement | A1, A5 | main (live staging and production access) | klicker-uzh #6360 branch | v2 on staging; A5 also needs A2–A4 | baseline and after tables in this plan |
| Cache-friendly requests | A2, A3, Klicker half of A4 | executor | klicker-uzh, new branch, draft PR into `v3-ai` | A1 baseline | unit tests above, `apps/chat` check and tests, browser check |
| Gateway affinity | ai/deployment half of A4 | main, after separate approval | ai/deployment, MR into `main`, staging only | Klicker half deployed to staging | migration test allow-list passes; A4 spend-log check |
| KB evaluation | B1, B4, B6 | main (staging DB and KB content) | local gitignored data plus #6360 | v2 on staging | canary and paired report |
| Eval tooling | B2, B3, B5 | executor | klicker-uzh #6360 branch (B2 staging values in the same PR) | code: none; B3 canary: B1 chatbot, #6330 and B2 merged to staging | adapter unit test, canary question, pairwise judge dry run |

Part B results are most useful after A2–A4, because the cost comparison
depends on the cache rate.

## Progress

- 2026-10-02: Investigation complete; plan drafted. Staging tunnel and
  Tailscale dropped during the investigation, so A1 and B1 are not yet run.
- 2026-10-03: A4 reworked to use LiteLLM session affinity after finding it
  was deliberately disabled on 2026-08-12, plus prior work in #5365. Tunnels
  are back, so A1 and B1 can run. #6330 CI passed; final AI review posted.
