# U4 — verified model pricing and Luna-only base class

Roadmap:
[`project/2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md`](2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md).
The existing M1 stack is open as GitHub stack #5476 through U3 PR #5490. This
user-directed final layer extends that same stack.

## Goal

Make every stored chat-registry input/output rate match the verified current
Azure Global Standard short-context rate, and make `gpt-5.6-luna` the only
`BASE` model in every built-in and repository-declared deployment registry.
Preserve the existing same-class participant-credit fallback contract by making
Luna the current registry's fallback model. Run the finished layer in the exact
task worktree and leave the Codex in-app Browser ready for the user's local
validation.

## Non-goals

- No cached-input, cache-write, long-context, classifier, or embedding pricing
  schema. The current registry and `calcCost` contract store only one input and
  one output rate per selected model.
- No per-routed-step attribution for Auto Mode and no change to the Auto V2
  routing policy.
- No LiteLLM provider-failure fallback change. In particular, the separate Sol
  to GPT-5.1 upstream fallback remains untouched.
- No Prisma, GraphQL schema, generated operation, user-facing tier label, model
  preference, allow-list, or prompt change.
- No ready marking, merge, deployment, live-cluster action, PR closure, cleanup,
  branch/worktree deletion, or second writer.

## Execution contract

- **Owner**: this roadmap task is the sole topology owner and sole writer in
  `trees/feat-chatbot-lecturer-config-phase0`.
- **Approval**: Gate 1 approval authorizes the new branch, plan and implementation
  commits, repository-native checks, Ox Alpha review passes, push of the new
  branch, one draft PR based on U3 PR #5490, append to GitHub stack #5476, one
  CI watcher, exact-worktree devrouter startup, and in-app Browser validation.
- **Withheld**: ready marking, merge, deployment, live traffic, cluster access,
  PR closure, reordering or rebasing existing stack layers, force-push, cleanup,
  deletion, and every unrelated roadmap item.
- **Boundary owner**: this roadmap orchestrator owns the branch, stack append,
  integration, evidence, and plan `Progress`. Reviewers are read-only and use
  the user-required Ox Alpha route.
- **Terminal**: the fifth draft layer is published at an independently green,
  reviewed head; stack #5476 includes it above #5490; CI is accounted for; the
  exact local runtime is retained under the user's validation lease; and an
  in-app Browser tab is ready. Then stop before every withheld action.
- **Runtime lease**: retain the exact worktree runtime only for the user's
  requested validation. Revisit the lease at the next handoff or after the user
  reports validation complete; do not stop it in this execution terminal.
- **Pause**: only for a different pricing basis, a request to represent cached
  or long-context pricing, a cross-class fallback, an unavailable Luna
  deployment alias, an Ox-only review route with no usable host, a runtime that
  cannot start without a new data boundary, or another withheld action.

## Plan identity and topology

- Plan: `project/2026-08-24-chatbot-u4-model-registry-policy-plan.md`
- Planned branch: `rs/chatbot-u4-model-registry-policy`
- Worktree: `trees/feat-chatbot-lecturer-config-phase0`
- Accepted base: U3 published head
  `8b17ba74bacb4824cb5f8ff77c44ded76a8cb5c5`
- Parent layer: open PR #5490, `rs/chatbot-u3-usage-lanes`
- Remote stack: GitHub stack #5476, PR #5460 -> #5475 -> #5480 -> #5490
- Planned package: one cohesive fifth layer above #5490
- Delivery title: `fix(chat): align model rates and base class`

The roadmap normally keeps one stack at four or fewer layers. The user has
explicitly requested this final layer on the current stack. Keeping registry
policy, deployment declarations, fallback selection, tests, and documentation
in one independently green package avoids a state where the sole base model is
absent or carries a stale rate in one consumer. No existing layer is reordered
or rewritten.

## Research

### Questions and sources

| Question | Evidence | Disposition |
| --- | --- | --- |
| What price basis matches the UZH deployment? | Azure Retail Prices API Global Standard token meters, checked 2026-08-24; Azure and OpenAI GPT-5.6 launch pricing | Use Azure Global Standard short-context input/output USD per one million tokens |
| Is the deployed Luna alias real? | Current `ai-infrastructure/deployment` main exposes `klickeruzh/azure/gpt-5.6-luna` | Use that exact alias in STG and PRD values |
| Can the registry represent every Azure meter? | Both registry schemas and `calcCost` accept only `cost.input` and `cost.output` | Verify every stored pair; record cached and long-context dimensions as unsupported rather than inventing values |
| What price applies to Auto? | Auto is a router; the accepted current generation mix is 90% Luna and 10% Sol, while selected-model accounting cannot attribute routed steps | Round the weighted 0.68/4.08 generation rate to the accepted 1/5 accounting pair and document the mix, refresh trigger, and excluded classifier/embedding overhead |

### Verified rate table

All direct-model rates below are Azure Global Standard short-context USD per
one million tokens, verified 2026-08-24.

| Registry ID | Input | Output | Change |
| --- | ---: | ---: | --- |
| `auto` | 1.00 | 5.00 | Replace the stale 1.25/10 estimate with the accepted rounded blend of the 90% Luna / 10% Sol generation rate |
| `gpt-5.6-luna` | 0.20 | 1.20 | Correct the stale 1.25/10 pair |
| `gpt-5.5` | 5.00 | 30.00 | Already correct |
| `gpt-5.4` | 2.50 | 15.00 | Correct the stale 1.25/10 pair |
| `gpt-5.1` | 1.25 | 10.00 | Already correct |
| `gpt-4.1` | 2.00 | 8.00 | Already correct |
| `gpt-4.1-mini` | 0.40 | 1.60 | Already correct |

Price-source references:

- <https://azure.microsoft.com/en-us/api/retail/prices>
- <https://azure.microsoft.com/en-us/blog/gpt-5-6-now-available-in-microsoft-foundry/>
- <https://developers.openai.com/api/docs/models/gpt-5.6-luna>

## Resolved decisions

### D1 — existing price fields only

“Verify all pricing information” means every input/output pair that the current
registry persists and charges. This layer does not imply that cached inputs,
cache writes, long-context premiums, Auto classifier calls, or embeddings are
free. Those dimensions cannot be charged accurately without a wider schema and
provider-usage attribution change, which is outside this final layer.

### D2 — Auto uses a weighted accounting rate

Auto has no provider list price. The user confirms that Sol accounts for about
10% of Auto generation usage; use the remaining 90% as Luna. Weight input and
output independently:

- input: `0.9 * 0.20 + 0.1 * 5.00 = 0.68`;
- output: `0.9 * 1.20 + 0.1 * 30.00 = 4.08`.

The user accepts a stored 1/5 pair as the simple rounded accounting rate for
the 0.68/4.08 generation blend. It is an approximation, not analytical
routed-cost truth. It excludes the classifier request and embedding request
because their per-request overhead cannot be normalized into the selected
model's per-token fields without observed token ratios. Reopen the decision
when the measured Sol share materially changes, the Auto route set changes,
or routed-step usage attribution becomes available.

### D3 — Luna is the sole base model

Every parsed registry must contain exactly one `BASE` entry and its ID must be
`gpt-5.6-luna`. Luna is `fallback: true`; every current non-Luna entry is
`ADVANCED` and `fallback: false`. `Auto` remains `ADVANCED`.

Both registry consumers enforce the sole-base invariant so invalid external
JSON fails through the existing safe built-in-default path. Parity tests cover
cost, class, and fallback state across the two built-in copies and both
repository-declared deployment registries.

### D4 — fallback retains its existing meaning

The registry `fallback` flag is the participant-credit fallback used before
provider work; it is not a provider-failure fallback. When a participant has
no legacy credits, a non-fallback model may switch only to a fallback in the
same usage class and allow-list. Therefore:

- zero-credit `BASE` selection resolves to Luna and remains `BASE`;
- zero-credit `ADVANCED` selection has no current same-class fallback and is
  denied with the existing class-specific boundary;
- account-budget exhaustion never switches class; and
- LiteLLM provider-failure fallback remains unchanged.

The planning-stage Ox review proposed cross-class failure fallback and keeping
mini as the credit fallback. Both findings are declined because the live route
uses this flag only for participant-credit selection, and both alternatives
would violate the accepted no-cross-class contract in ADR 0020.

### D5 — stored model preferences remain valid

No registry ID is removed. Existing chatbot allow-lists and saved selections
remain valid. Deployment registries add Luna; they do not delete any current
model. Class assignment and accounting behavior change server-side without a
data migration.

## Primitive impact

| Primitive | U4 disposition |
| --- | --- |
| Model registry | Correct every stored price pair and enforce one Luna `BASE` entry across both consumers |
| Usage class | Preserve the two classes; change their current model membership only |
| Participant-credit fallback | Retarget the one current fallback from mini to Luna while preserving same-class selection |
| Account usage budget | Charge the selected/fallback model's updated rate to its unchanged server-derived class |
| Auto routing | Keep routing unchanged; use the accepted rounded 1/5 accounting pair derived from the 90% Luna / 10% Sol mix |
| Chatbot model policy | Preserve IDs, allow-lists, reasoning efforts, selections, and client contract |
| Deployment configuration | Add the existing Luna alias and align class, fallback, and price declarations in STG/PRD |

## Feature-wide test portfolio

| Consequential behavior | Test disposition |
| --- | --- |
| Every built-in model has the same cost, class, and fallback in chat and GraphQL copies | Extend `modelRegistryParity.test.ts` |
| STG and PRD expose the same registry IDs and exact stored price/class/fallback values | Extend `modelRegistryParity.test.ts` |
| Every parsed registry has Luna as its sole `BASE` entry | Add focused registry-schema assertions for both consumers |
| Auto cannot be classified as `BASE` | Preserve and integrate the existing invariant |
| Current Luna is the only fallback; no current ADVANCED fallback exists | Extend parity/policy assertions |
| Zero-credit Luna remains `BASE` and reaches provider work | Update the route regression |
| Zero-credit ADVANCED model does not cross to Luna | Preserve and update the route regression |
| A chatbot allow-list that omits Luna cannot receive it as fallback | Preserve the allow-list regression with reclassified models |
| Updated rates calculate exact rounded credits for Luna and one unchanged model | Update the focused route/accounting assertions |
| Existing model IDs and saved allow-list values remain accepted | Extend registry selection coverage; no new persistence test fixture |
| Auto's 1/5 pair records the accepted rounded 90% Luna / 10% Sol generation blend | Pin the calculation and rounded result in registry parity coverage; preserve existing Auto route tests |
| Finished branch runs locally and a direct Luna turn completes | Exact devrouter producing run plus in-app Browser evidence |

No live pricing lookup runs in tests. Repository tests pin the verified dated
values so ordinary CI remains deterministic; the documentation records how to
refresh them.

## Delegation Map

| Workstream | Slices | Owner | Dependency and acceptance |
| --- | --- | --- | --- |
| Registry contract and integration | P, S1, S2, S3 | main | One writer; accepted plan; focused and repository checks green |
| Planning and review | P, S1, S3 | Ox Alpha read-only passes | Sanitized repository paths, contract, commit ranges, and values-free evidence only |
| Runtime and Browser proof | S3 | main | Exact worktree runtime; seeded/synthetic content only; user-requested keep-running lease |

Main-session execution is required because the registry policy, fallback
semantics, stack topology, runtime custody, and final integration are one
critical path. A second writer would violate the active stack ownership rule.

## Slices and commits

### P — approved plan and branch checkpoint

- Create `rs/chatbot-u4-model-registry-policy` from the exact U3 published head
  after rechecking remote and local topology.
- Commit this approved plan and the roadmap note that records the explicit
  fifth-layer exception.
- Check: exact branch/base, clean diff, staged secret and personal-data review.
- Commit: `docs(project): add U4 registry policy plan`.

### S1 — one enforced registry policy

- Update both registry schemas and built-in copies with the sole-Luna `BASE`
  invariant, Luna fallback, current classes, and verified rates.
- Extend focused registry and parity tests to compare price, class, fallback,
  deployment ID, and consumer behavior.
- Update route tests for Luna BASE fallback, ADVANCED denial, allow-list
  isolation, and exact updated cost calculation.
- Keep current IDs, reasoning capabilities, API adapters, and model-selection
  behavior unchanged.
- Check: focused chat tests and GraphQL package typecheck.
- Commit: `fix(chat): enforce Luna base model policy`.
- Review: Ox Alpha simplifier and one Ox Alpha slice review over the immutable
  P..S1 range, covering accounting, registry fallback, same-class isolation,
  external-JSON compatibility, and duplication between consumers.

### S2 — deployment declarations and durable evidence

- Align STG and PRD model registries and fallback IDs; add the verified existing
  `klickeruzh/azure/gpt-5.6-luna` direct entry.
- Update `.devcontainer/devcontainer.env` fallback ID and stale comments.
- Update ADR 0020 with the Luna-only base membership, same-class participant
  fallback, dated price basis, Auto accounting approximation, and unrepresented
  price dimensions.
- Update `docs/chat-platform.md` and the roadmap state. Remove the stale claim
  that deployments do not expose direct Luna.
- Check: registry parity tests, YAML/Markdown formatting, and exact diff review.
- Commit: `docs(chat): align registry pricing policy`.

### S3 — integration, review, publication, and local validation

- Run focused tests, package checks, `pnpm run check:all`, affected builds, and
  the full pre-push build in the exact Node 24 DevPod. Run no GraphQL generation
  because this layer does not change the public schema or operations.
- Run one Ox Alpha integrated final review over the accepted U3 head through
  the verified U4 head. Apply only verified in-scope corrections and rerun
  affected checks.
- Push the new branch, create one draft PR based on U3, and append it to GitHub
  stack #5476 with `gh stack link`. Do not alter existing layer order or state.
- Observe one current-head CI run with one watcher and update the draft body from
  exact evidence.
- Start or reconcile the exact worktree runtime through devrouter with the
  existing external OpenRouter local-chat boundary. Use only seeded or
  synthetic content. Validate one direct Luna turn and registry-backed model
  selection in the Codex in-app Browser, then leave the tab ready.
- Record exact checkout path, workspace identity, producing-run evidence, and
  the explicit keep-running lease in `Progress` and the terminal report.

## Review routing

The required provider is Ox Alpha. The native collaboration child path returned
`unreadable_encrypted_agent_task`; a plaintext external `combo/ox-alpha` Codex
process completed the planning pass at maximum effort. The first attempt spent
its response budget on instruction discovery and returned no verdict; the
bounded retry returned implementation-ready advice. The orchestrator verified
and dispositioned the findings above.

Future simplifier, slice-reviewer, and final-reviewer passes use
`combo/ox-alpha` or another explicit Ox Alpha host. If no Ox route returns a
usable terminal report, stop at the review gate rather than silently switching
providers.

Review prompts contain no credentials, secret values, personal data, real
participant content, or unrelated private material. Review output remains
advice and is verified against the committed diff and producing-run evidence.

## Verification commands and evidence

Run host Git, `gh`, `gh stack`, and devrouter lifecycle commands on the host.
Run Node/pnpm checks inside the exact DevPod:

- focused `apps/chat/test/chatModelRegistry.test.ts`
- focused `apps/chat/test/modelRegistryParity.test.ts`
- focused `apps/chat/test/account-usage-route.test.ts`
- `pnpm --filter @klicker-uzh/chat check`
- `pnpm --filter @klicker-uzh/graphql check`
- `pnpm --filter @klicker-uzh/chat build`
- `pnpm --filter @klicker-uzh/graphql build`
- `pnpm run check:all`
- `pnpm run build` before push
- `git diff --check`, staged diff inspection, and data hygiene before each
  commit

Browser evidence records the exact local URL, selected Luna model, one
synthetic successful turn, console/network status, and visible model-selector
state. No pricing or usage-class label is added to the participant UI; the
policy itself is proven by registry tests and the producing runtime.

## Risks and fail-closed handling

- **Stale future price**: pin a dated rate basis and refresh instructions; no
  CI network dependency.
- **Auto mix drift**: pin the accepted 90/10 generation mix and record omitted
  classifier/embedding attribution rather than claiming exact routed cost.
- **Cross-class fallback**: enforce class filtering in the existing route and
  preserve an explicit ADVANCED-denial regression.
- **External registry drift**: both consumers reject any registry whose sole
  base entry is not Luna; parity tests cover STG and PRD declarations.
- **Unavailable deployment**: the exact alias is verified on current deployment
  main; no deployment or live call is authorized here.
- **Stack drift**: checkpoint exact heads before append; stop on any remote/local
  topology mismatch.
- **Runtime residue**: keep only the exact task runtime under the user's explicit
  validation lease; do not delete or broadly prune anything.

## Progress

- 2026-08-24: freshness check confirmed clean U3 head
  `8b17ba74bacb4824cb5f8ff77c44ded76a8cb5c5`, exact remote parity, and GitHub
  stack #5476 with PRs #5460, #5475, #5480, and #5490. The branch is four
  commits behind current `origin/v3` only through its approved stack ancestry.
- 2026-08-24: official Azure sources verified all existing registry
  input/output pairs. Luna and GPT-5.4 are stale; Auto's stored estimate is not
  a direct-provider price. Current deployment main confirms the unqualified
  KlickerUZH Luna alias.
- 2026-08-24: the required Ox Alpha planning pass returned implementation-ready
  with fallback clarifications. The live route disproved its cross-class and
  mini-fallback suggestions; the accepted corrections are the dated price
  basis, explicit unsupported dimensions, Auto approximation, existing-model
  preference coverage, and LiteLLM non-goal.
- 2026-08-24: the user replaced the conservative Auto upper bound with the
  observed approximate generation mix of 90% Luna and 10% Sol. The accepted
  weighted pair is 0.68/4.08 and the user approved its simplified 1/5 registry
  rate; classifier and embedding overhead remain explicitly unrepresented.
- 2026-08-24: Gate 1 approved by the user. The U4 branch was created from the
  exact published U3 head after a fresh remote and stack check. No U4 commit,
  push, stack mutation, runtime start, merge, or deployment has occurred.
