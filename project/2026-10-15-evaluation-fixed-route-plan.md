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
`29f7d68e3c56b29bf4d4baeeb1aac3a9c747d843`.
PR: [6542](https://github.com/uzh-bf/klicker-uzh/pull/6542), draft.
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
| Multiline review context corrupts workflow outputs | Extend existing | Execute the workflow serializer; round-trip multiline values and delimiter collisions without injected output keys |
| Dependency preparation never exits | None | Bounded real generation/build and repository preparation must exit successfully; emitted artifacts alone are insufficient |

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

### Approved continuation

The user additionally approved local startup repair, the review-workflow output
repair, Explainer-first qualification and checkpoint synchronization. Executor
owns `.github/workflows/check-ocr-review.yml` and the existing
`.github/scripts/final-ai-review.test.js` protocol coverage. Main owns runtime
diagnosis, integration, publication and the sanitized checkpoint sync.
Conditional build-only repairs may touch `packages/prisma/rollup.config.js` or
`util/dev-runtime.sh` after reproducing the cause. Preserve the full frozen
application SHA and record any such patch separately from the guard revision.

Keep the trusted-base checkout in the `pull_request_target` review workflow.
The draft's repaired workflow cannot activate before separate base-branch
integration authority. Accept focused protocol verification and exact-head CI
disposition; report that check as blocked if the trusted base still has the bug.
Do not weaken the policy boundary to make the draft check pass.

Only Tutor coverage is optional. SDK retry accounting and admission refusal
remain mandatory, either through unchanged qualifying evidence or the repeated
application proof. Stop the exact runtime and verify zero routes after success
or failure. Synchronize the sanitized checkpoint through the existing approved
private sync job and verify the receiving revision even if qualification blocks.

### Planning review

Planner round 1 requested explicit apex/trailing-dot detection, deep snapshot
coverage, operator-only tariff freshness and complete ownership/test obligations.
All accepted. The same planner approved round 2. The optional opposing-provider
challenge disputed price units; the published OpenAPI explicitly states USD per
million tokens, so that claim is rejected. Its incomplete captured response is
not treated as a passed gate. The required planner gate is complete.

## Progress

Plan hardening approved. The implementation closes the default-tier route,
snapshots policy inputs and rejects unqualified cache/storage controls.
The executor's first contract checks reproduced the missing behavior, followed
by a passing integrated run: 47 tests across guard, target and trajectory suites
in an offline container. Biome and Prettier checks passed; pre-existing Biome
advisories remain. Focused Opengrep reported no findings in the changed
executable files. No new dependency, module, schema or framework pin change.
Substantive implementation size: 235 added and 33 removed lines; plan and
documentation excluded. Test delta: two new contract tests, existing retry and
denial cases extended, duplicate draft tests consolidated before commit.

Draft PR created. The simplifier's unused test-helper options were removed;
the affected guard suite passed again. Slice review and integrated final review
passed with no findings at the reporting threshold. This metadata-only progress
update reuses the reviewed source range. The standalone synthetic admission check passed; full
application qualification remains an incomplete mandatory gate. No paid
acceptance or answer-quality claim follows from this package's source checks.
Next: finish source review and exact-head CI disposition; retain the draft until
the mandatory application proof can be completed.
