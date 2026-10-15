# Evaluation fixed-route guard repair

## Approval summary

The evaluation spend guard must reserve against the provider route that can
actually serve a request. A model name alone does not close an aggregator's
provider and service-tier choices. This package adds a guard-owned OpenRouter
route for OpenAI's default tier, while continuing to reject routing controls
supplied by the application. Each attempt, including retries, still consumes
the existing durable reservation before forwarding.

The existing $5 hard ceiling, text-only contract, framework interface and normal
application routing remain unchanged. Prices must conservatively include every
eligible endpoint, long-context override, cache charge and applicable fee.
Provider price filters alone do not establish that all-in bound. Dated tariff
evidence and its freshness remain an operator readiness gate; this package does
not implement automatic tariff discovery or expiry enforcement.

Approval mode: executable batch, already approved. Prepare one draft PR against
`v3`, complete the configured reviews and CI, and repeat fake-only application
qualification. The required capture proof covers a two-turn Explainer revision;
Tutor is optional additional coverage. Stop and verify the exact local runtime
afterward. Merging, marking ready, deployment and paid evaluation are withheld.
An unavailable mandatory proof blocks completed delivery, while a running check
continues through its supported watcher.

## Execution details

### Working context and authority

Branch: `fix/evaluation-fixed-route`. Target: `v3`, starting at
`29f7d68e3c56b29bf4d4baeeb1aac3a9c747d843`. PR: none yet.
Execution mode: standard. Ceremony: full path. Boundary owner: self.
The preceding [evaluator plan](2026-10-12-chatbot-evaluator-plan.md) is history.
The isolated baseline's application inputs remain frozen. Private qualification
receipts stay ignored and outside the public branch.

Authority: source edits, local commits, ordinary task-branch push, draft PR,
configured source reviews, container checks and synthetic local qualification.
Terminal: reviewed draft PR with CI disposition and mandatory zero-spend proof.
Pause: a material change to provider, cost, data boundary or approved effects;
an exhausted required review route; or a missing mandatory acceptance capability.

### Research and binding contract

Main owns provider-contract research. The current
[OpenRouter OpenAPI](https://openrouter.ai/openapi.json) declares `provider` and
`service_tier` on Responses requests. Its provider preferences support `only`,
`order`, `allow_fallbacks`, `require_parameters` and string-valued `max_price`.
The [routing guide](https://openrouter.ai/docs/guides/routing/provider-selection)
distinguishes base-provider matching from explicit service-tier opt-in.
These are request-shape contracts, not evidence that a paid request was accepted.

Add optional `fixedRoute: { type: 'openrouter', provider: 'openai' }` to version 1
pricing policies. This deliberately supports one closed adapter. Require it
for the apex `openrouter.ai` and its subdomains, normalizing a terminal DNS dot
for detection. Unrelated direct-provider policies retain their existing shape.

For this adapter, the guard injects `service_tier: 'default'` and provider
preferences selecting only and ordering `openai`, disabling fallbacks and
requiring supported parameters. Prompt and completion price ceilings derive
from the qualified model rates in USD per million tokens; the request-price
ceiling is zero. Apply this to both supported API paths. Every endpoint matched
by that base slug must fit the operator's qualified all-in rates.

Keep client `provider`, `service_tier`, alternate models and fallback controls
outside the request allowlist. Reject nested `cache_control` and `store: true`
before reservation. Deep-snapshot the policy before the guard's first async
boundary, using that snapshot for hashing, reservation, status and forwarding.

### Primitive impact

| Product primitive | Disposition | Contract delta | Consumers and evidence |
| --- | --- | --- | --- |
| Evaluation pricing policy | Extend | Explicit guard-owned closed route required for OpenRouter | Existing guard and pricing-policy validator |
| Experiment budget | Reuse | Existing monotonic $5 ceiling and per-attempt reservations | Existing ledger and runner; no new algorithm |

No ADR: this is a small, reversible extension of the existing evaluation-only
guard. A general multi-provider pricing service would reopen the architecture
and approval boundary. Client-controlled routing and a catalog subsystem are
excluded because neither is needed for the closed route.

### Feature-wide test portfolio

| Risk | Obligation | Primary seam and failure detected |
| --- | --- | --- |
| Provider or tier escapes the priced route | Extend existing | Fake HTTP guard scenario: both API paths, apex/subdomain detection and exact injected controls |
| Client introduces an unpriced modifier | Extend existing | Existing denial scenario: no upstream arrival or reservation |
| Caller changes a policy after startup | Extend existing | HTTP scenario: nested mutation cannot change prices, routing or policy identity |
| Retries exceed the shared ceiling | Extend existing | Existing durable retry scenario with fixed-route policy |
| Ledger algorithm or documentation wording | None | Reuse ledger tests; no prose assertions |

### Delegation map and slice

One integrated slice, owned by main. The executor contributes only the bounded
test changes after the contract is settled. Main owns the guard, documentation,
private pricing evidence, runtime integration and final proof. No shared writer.

Slice: close the qualified provider route end to end. Intended tracked files:
`evaluation/evaluation-spend-guard.mjs`, `evaluation/README.md`, and
`apps/chat/test/evaluation-spend-guard.test.mjs`. No new runtime module or
framework pin change. Commit the plan first, then the coherent implementation.
Apply simplifier and risk-selected slice review to the immutable implementation,
then integrated final review after verification.

Verification: container-native
`pnpm --filter @klicker-uzh/chat test:run test/evaluation-spend-guard.test.mjs`,
related existing evaluator tests, repository formatting and syntax checks.
No visible UI or browser-only contract changes, so screenshots do not apply.

Main may add the ignored harness `project/_local/qualify-fixed-route.mjs` in the
retained baseline worktree. It reuses the existing authored fixtures and real
application transport with a fake Responses upstream, synthetic in-memory keys,
and a synthetic-only ledger. Require two Explainer turns, forced retrieval on
each, exact route capture, persisted answers/tools, durable retry accounting,
and refusal beyond the ceiling. No provider credentials or paid egress.
Record the reviewed guard source and unchanged application baseline separately.

### Planning review

Planner round 1 requested explicit apex/trailing-dot detection, deep snapshot
coverage, operator-only tariff freshness and complete ownership/test obligations.
All accepted. The same planner approved round 2. The optional opposing-provider
challenge disputed price units; the published OpenAPI explicitly states USD per
million tokens, so that claim is rejected. Its incomplete captured response is
not treated as a passed gate. The required planner gate is complete.

## Progress

Plan hardening approved; implementation not started. Baseline guard suite passed
10 tests in an offline container using existing dependency volumes.
Required delivery: draft PR, mandatory fake-only proof, reviews and CI disposition.
Next: finish plan hardening, commit this plan, implement the single slice.
