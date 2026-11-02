# W9b: keep ordinary evidence in graph-assisted document search

## Approval summary

**Why and what changes?** The October 19 GraphRAG pilot appeared to show a
cross-document retrieval miss. An offline re-fusion of the saved captures showed
that the ordinary search had already returned the other named documents. They
were lost afterwards. `combineGraphSearchDocuments` in
`apps/chat/src/services/graphAssistedDocQuery.ts` flattens the provider's
source-grouped payload source by source, ranks original and graph-hinted
passages together, and cuts the result to 12 passages and 16,000 characters.
Staging responses carry no per-chunk rank, so the first document fills the
slots. Ordinary chat sends the whole original payload, so graph mode currently
gives the model less evidence than ordinary chat.

This package changes the fusion rule in one slice:

1. The fused result keeps every original source and chunk, in the original
   provider order and grouping, unchanged from what ordinary chat sends.
2. Graph-hinted passages that the original lacks are appended within a fixed
   headroom: **6 passages and 8,000 characters** (recommended default; your
   decision).
3. Those additions are chosen in rank order: by per-chunk `global_rank` when
   every chunk of the hinted search carries a finite number, otherwise by
   round-robin across its sources in provider order. This stops one document
   from taking the whole headroom.

The pilot's cutting and joint ranking of original passages disappear, so the old
"reserve the first three original passages" step and the reciprocal-rank fusion
are no longer needed.

**What stays unchanged?** Ordinary document search, the graph-hint query,
passage identity and deduplication, the "never infer identity from a filename"
rule, the 100-passage parse limit, authorization and KB scope. Citation groups
for original passages look as in ordinary chat; additions follow as trailing
groups, and adjacent additions from one source share a group. No graph, generator or provider change. No
question decomposition: that stays conditional on a reviewed case set.

**What could change the decision?**

- Graph mode now sends the original payload plus at most 6 passages and 8,000
  characters, so model input in graph mode grows. That is more than today, which
  sends at most 16,000 characters total.
- Round-robin is a heuristic. Staging does not confirm that the provider lists
  sources by relevance and chunks by score. `global_rank` exists only in
  development responses, so development and staging pick additions differently
  until AI infrastructure exposes it. That request is a message for you to send.
- Existing tests that pin the 12/16,000 budget and the reserve step are
  deliberately rewritten.

**How will we know it is done?** Unit tests on synthetic payloads show that all
original passages are kept, that additions respect the headroom, rank ordering
and the round-robin fallback, and that the activity chip and source cards for
the original passages match ordinary chat. The chat type check, the focused
test file and the commit hooks' checks pass in the container, and the docs
contract matches the code.

**What does approval authorize?** An executable batch:

- the slice below;
- local commits and pushes to `rs/w9b-rank-preserving-selection`;
- a draft PR into `v3-ai`.

Withheld: merge, marking ready, staging deployment, paid evaluation runs,
messages to AI infrastructure, and any change to the private pilot harness.

## Execution details

### Evidence and binding contracts

- **Fusion.** `combineGraphSearchDocuments` (`graphAssistedDocQuery.ts:163-235`):
  - reserves the first three original passages (`:200-204`);
  - ranks with reciprocal-rank fusion over flattened positions (`:174-187`);
  - caps the result at 12 passages and 16,000 characters (`:194`);
  - emits contiguous source groups (`:215-221`).
- **Ordinary path.** When fusion is unusable, the caller returns the original
  payload unchanged, with no Klicker-side passage cap. `passages()` refuses
  payloads over 100 passages (`:101`).
- **Rank fields.** Development responses carry `score`/`global_rank` on chunks
  and `aggregate_rank` on sources (`:117-124`). `passageKey` strips them when a
  resource identifier exists, so identity and deduplication do not depend on
  position or rank.
- **Docs contract.** `docs/chat-platform.md:1174-1180` describes the `fused`
  outcome, the old budget, the protected first three passages and contiguous
  groups. It must change in the same PR. `fused` will mean that at least one
  passage was added. `expansion_unusable` will also cover a hinted search that
  added nothing new. The diagnostics enum stays unchanged.
- **Source UI.** `countDocQueryDocuments` (`normalizeSources.ts:135-157`) and
  `normalizeDocumentsModeSources` (`:554-631`) count and render source groups.
  Keeping the original grouping limits the extra groups to added passages.
- **Private evidence.** `offline-union-check.py` and its output live in the
  gitignored pilot folder of `rs/graphrag-teaching-eval`. No course text or
  capture enters tests or this repository.
- **Relevant decisions.** ADR 0009 (KB owns two derived projections) and ADR 0032
  (graph selects coverage, chunks support factual claims).

### Selection rule

1. Parse both searches with the existing `passages()`. Keep it as the shared
   parser.
2. A new helper used only by the fusion orders the hinted search.
   - **Ranked:** when every chunk has `typeof global_rank === 'number'` with a
     finite value, sort stably by `(global_rank, provider flat index)`.
   - **Round-robin:** otherwise, interleave the provider's source entries in
     provider order, with chunks in provider order. A lane that runs out drops
     out and the longer lanes continue. Lanes are never merged by reference or
     title.
   - **Duplicates:** a passage repeated within the hinted search keeps its first
     occurrence after ordering.
3. Selected passages = all original passages, then hinted passages whose
   `passageKey` is absent from the original. Additions are admitted in the
   ordered sequence until 6 passages or 8,000 added characters. A passage that
   would exceed the character headroom is skipped, and admission continues with
   later passages.
4. Emit the original payload's sources unchanged, then the additions as
   contiguous groups in admission order.
5. Outcome:
   - `fused` only when at least one passage was added;
   - otherwise `expansion_unusable`, and the original is returned unchanged.

### Test portfolio

| Risk                                                                                              | Obligation                                                                                                                                                       | Seam                                                                                          | Distinct failure                                                    |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Original passages are dropped; old budget, reserve, resumed-group and duplicate-only expectations | replace/consolidate (`test.ts:360-379`, `:381-406`, `:408-429`, `:447-477`; the duplicate-only case now expects the original unchanged and `expansion_unusable`) | `combineGraphSearchDocuments`, original with more than 12 passages and over 16,000 characters | fused output lacks an original passage                              |
| Additions exceed headroom                                                                         | add new                                                                                                                                                          | same, many hinted-only passages                                                               | more than 6 added passages or over 8,000 added characters           |
| Grouped hinted search without ranks lets one source take the headroom                             | add new                                                                                                                                                          | same, synthetic two-source hinted payload                                                     | additions all from the first source                                 |
| Ranked hinted search ignores `global_rank`; mixed or invalid ranks are not treated as unranked    | add new                                                                                                                                                          | same, ranked payload plus one mixed-rank payload                                              | wrong addition order, or crash or ranked path on mixed ranks        |
| Original source cards or chip differ from ordinary chat                                           | add new                                                                                                                                                          | the fusion output through `normalizeSourcesFromParts` and `countDocQueryDocuments`            | count or cards for original groups differ from the unfused original |
| Identity, top-level field dropping, parse failures and outcomes regress                           | extend existing                                                                                                                                                  | remaining unchanged tests, including `:431-445`                                               | existing assertions fail                                            |

### Delegation map

| Workstream  | Slice | Owner | Acceptance                       |
| ----------- | ----- | ----- | -------------------------------- |
| Fusion rule | 1     | main  | all portfolio rows; checks below |

**Slice 1 — keep original evidence and append ranked graph additions.**

- Route: main. Execution-tier skip reason: critical-path coupling (one function,
  its tests and its docs contract).
- Files:
  - `apps/chat/src/services/graphAssistedDocQuery.ts`;
  - `apps/chat/test/graph-assisted-doc-query.test.ts`;
  - `docs/chat-platform.md`.
- Commits: one implementation commit with tests, plus the docs update in the
  same commit or a second one.

### Verification

Run each check in the container:

- `devrouter exec . -- pnpm --filter @klicker-uzh/chat check`
- `devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run test/graph-assisted-doc-query.test.ts`
- The commit hooks' equivalents: Biome check on the two touched TypeScript
  files, Prettier check on the docs page, and the chat build before push.
  Hooks that cannot run on the host are run in the container and reported.

No browser check is needed, because no rendered UI or browser contract changes.
The private offline check can optionally be re-run with the new rule; its output
stays out of Git.

### Follow-ups outside this package

- Ask AI infrastructure to expose `global_rank` on staging and production. This
  is your message to send.
- Apply the same rule to the private W9 harness before its next run. Then run the
  reviewed comparison of 20–30 cases, which needs separate paid admission.
- Question decomposition, only if that comparison shows a remaining gap.

## Progress

- Status: delivered. #6613 merged into `v3-ai` as `ad826af393` on 2026-10-19.
- Evidence: the focused fusion suite passes (37 tests). Biome reports no errors
  on the touched files, and Prettier passes on the docs page. The dev container
  could not start because the host's Docker network address pools are
  exhausted, so these checks ran on the host with the primary checkout's
  dependencies. A host-side chat type check showed no errors in the touched
  files; the full chat type check and build are left to CI.
- Test delta: 3 added (round-robin, rank order, source cards), 4 rewritten for the new rule, the rest unchanged.
- Branch: `rs/w9b-rank-preserving-selection` from `origin/v3-ai` at `f45f6ca714`.
- Planner: pass 2 asked for revisions to two named tests and the outcome docs
  line, both applied. Pass 1 asked for a revision with three blocking findings: the budget
  rule displaced original passages, the test command was wrong, and existing
  budget tests would break. All three are addressed above. The should-fix
  findings are resolved by keeping the original grouping, adding rank semantics,
  updating the docs contract and naming hook checks.
- Next action: rerun the matched W9 comparison with the new selection under
  the adoption plan protocol. That run needs its own approval.
