# Measure and bound knowledge-graph build cost

Date: 2026-09-21
Scope: cost reservation, metering and settlement for KB graph builds.
Parent: [knowledge graph quality roadmap](2026-09-12-kg-quality-roadmap.md), W1 diagnostics and W12 operational quality.

## Approval summary

The current credit-limit approach is fragile in three concrete ways: staging records no real usage, every build reserves one flat configured estimate regardless of corpus size, and a truthful cost above that estimate would invalidate an otherwise successful result. The ledger and contract already support measured settlement, so the recommended direction is to finish that design rather than replace it.

Report real per-component usage from the generator, bound settlement by the configured per-build maximum instead of the estimate, make the reservation estimate size-aware, and calibrate it from observed builds. Separately, let quota-limit raises take effect without a hand-coordinated ledger row change, and give held reservations a reviewed release path.

Accepting this direction authorizes the source packages below. It does not authorize merge, deployment, paid evaluation runs, or any change to element-generation spends. This plan records work packages and decisions; each package still gets a bounded implementation slice.

## Evidence and current state

Inspected on 2026-09-21 against the live staging ledger and `origin/v3-ai` source. Staging served `v3-audit` head `5d63a342344b` with cost configuration `stg-canary-v1`.

| Verified finding                                                                                                                                                                     | Consequence and source anchor                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every settled staging build carries `metering_source: "configured_pricing"` with one component (`course-kg-balanced`, provider `configured-pricing`), all token counters `0`, `request_count: 1`, and `amount_minor_units: 100` — exactly the configured standard estimate. | The recorded actual is the estimate echoed back, not a measurement. `packages/graphql/src/services/kbGraphContract.ts` defines the schema; the values were read from builds `f8a45b8d`, `3d792ad8` and `ea4dacd0`. |
| `validateKbGraphTerminalResult` rejects any result whose `metered_cost.amount_minor_units` exceeds `estimatedMinorUnits`. `maxCostMinorUnits` is only used to validate the configured estimates. | A truthful provider-reported cost above the flat estimate fails contract validation (`KB_GRAPH_RESULT_CONTRACT_INVALID`) and pushes a successful build to `NEEDS_HUMAN_REVIEW`. This contradicts [ADR 0013](../docs/adr/0013-klicker-reserves-and-settles-graph-cost.md), which names the per-build maximum as the bound. |
| `getKBGraphEstimate` returns one configured constant per quality tier. The build already pins `sourceContentDigest` and a build-local source snapshot before dispatch. | A one-page KB and a five-hundred-page KB reserve the same amount. Corpus size is available at reservation time but unused. `packages/graphql/src/services/knowledgeGraphCost.ts`. |
| Settlement decrements `reservedMinorUnits` by the estimate and increments `settledMinorUnits` by the metered amount; the schema already stores per-build input, output and embedding token counters plus the structured `meteredCost` JSON. | The Klicker side consumes real metering without schema work. `packages/graphql/src/services/knowledgeGraphAccounting.ts`, `packages/prisma/src/prisma/schema/knowledge.prisma`. |
| `ensureLockedKBGraphQuota` fails every build when the ledger row's `limitMinorUnits` differs from the configured `semesterQuotaMinorUnits`. | A quota change cannot be deployed ahead of or behind its row update without failing all builds in the window. `packages/graphql/src/services/kbGraphQuota.ts`. |
| A failed contract result holds its reservation indefinitely: build `0d6108f6` is `NEEDS_HUMAN_REVIEW` with 100 minor units reserved and no release path. | Failed accounting strands quota headroom until manual database intervention. |

## Work packages

### P1 — Provider-reported metering

Owner: generator engineer; Klicker contract owner reviews. Dependency: none — the consumer side already accepts this shape. Size: small–medium.

The generator's terminal result carries `metering_source: "provider_reported"` with one component per model and stage actually used (extraction, cleaning, embedding), each with input, output and embedding token counts, `request_count`, and an `amount_minor_units` computed from the same versioned pricing table identified by `pricing_version`. A real generation always consumes tokens, so a `provider_reported` component with every counter at zero is rejected. `configured_pricing` remains only as an explicit development and canary fallback, visible in diagnostics, never silently substituted for missing telemetry. Failed runs report partial usage where the provider exposes it.

Completion: one staging build records nonzero token counters and a component breakdown that reflects the stages actually run; the settled amount diverges from the estimate when usage differs; contract tests cover the zero-token rejection and the fallback disclosure.

### P2 — Bound settlement by the per-build maximum

Owner: Klicker backend. Dependency: P1 makes real costs observable, but the ceiling fix can land first. Size: small.

Validation compares the metered amount against `maxCostMinorUnits`, passed into the result expectation alongside the estimate. Three outcomes replace the single estimate ceiling:

1. Actual at or below the estimate: settle the actual amount, as today.
2. Actual above the estimate but at or below the maximum: settle the actual amount and record a `COST_OVERRUN` signal for observability. This is a calibration input, not a human-review state.
3. Actual above the maximum: fail closed with a dedicated `KB_GRAPH_RESULT_COST_EXCEEDED` code and `NEEDS_HUMAN_REVIEW`.

Quota semantics: admission continues to require remaining quota at or above the estimate, and remaining quota may go negative by at most `maxCostMinorUnits - estimatedCostMinorUnits` per in-flight build. A negative remaining balance blocks new builds until settlement true-ups. The alternative — reserving the full per-build maximum for every build — stays ADR-compliant but reduces concurrent headroom; it is recorded below as an explicit decision rather than silently chosen.

Completion: the three cost outcomes are contract-tested; no successful result can be invalidated solely because its truthful cost exceeded the estimate; the overdraft bound is asserted against the quota invariants.

### P3 — Size-aware reservation estimates

At reservation time, sum the pinned serving set's content sizes — the same inputs `computeKBContentDigest` already walks — and map them to configured bands per quality tier (for example small, medium, large by characters or estimated tokens), clamped between a configured floor and `maxCostMinorUnits`. Bands ship under the existing `pricing_version` namespace so a reservation always names the estimate model that produced it. The manage UI shows the computed estimate before dispatch instead of the flat tier constant.

Completion: a one-page KB and a large KB reserve different amounts; band boundaries, empty serving sets and the maximum clamp are unit-tested; the frozen estimate and its version remain on the build row for audit.

### P4 — Calibration and estimate governance

Owner: evaluation and operations. Dependency: P1 data accumulating; P3 bands exist. Size: medium, then recurring.

A periodic read of settled `provider_reported` builds produces CHF per thousand input tokens and an estimate-coverage ratio (the share of builds whose estimate covered the actual) per tier, size band, domain policy and language. Coverage below a declared threshold — 90 percent over a rolling window is the starting proposal — triggers a recalibration review. Estimate and pricing changes ship as a new `pricing_version` with historical rows unchanged; values are never edited in place. A generator-side pre-run quote (chunk count, model routes, gleaning passes) is the most accurate future option and is deliberately deferred until this calibration shows the size model is insufficient.

Completion: the calibration report exists; a deliberately low estimate triggers the threshold in a fixture; historical builds retain their original pricing version after a table change.

### P5 — Quota-limit changes without lockstep row migration

Owner: Klicker backend. Dependency: none. Size: small–medium.

Replace the equality check between the configured `semesterQuotaMinorUnits` and the row's `limitMinorUnits` with a directional rule: a configured limit greater than or equal to the row limit is adopted transparently (a raise), while a configured limit below the row limit keeps the granted row limit and surfaces a warning instead of failing every build. Lowering a granted quota stays a deliberate administrative action. The row records the effective limit and its source so the change is auditable.

Completion: raising the staging configuration no longer requires a same-window database row update; a lowering attempt does not silently reduce a granted quota; raise, equal and lower paths are tested.

### P6 — Reviewed resolution for held reservations

Owner: Klicker backend with an operations surface. Dependency: none; pairs with the dedicated overflow code from P2. Size: small–medium.

An administrative action resolves a `NEEDS_HUMAN_REVIEW` build in one of three ways: release the reservation when the provider did no billable work, settle a measured partial cost when partial usage is evidenced, or settle the reserved amount when evidence is incomplete. Each resolution records the actor, reason and evidence reference, and duplicate resolutions are idempotent. This addresses the observed `0d6108f6` pattern, where a truncated terminal envelope left a successful generation failed and its reservation stranded.

Completion: a fixture held reservation can be released and settled with an audit record; the action is permission-gated and idempotent; the truncation case from the staging comparison is covered as a regression scenario.

## Sequencing

P1, P5 and P6 are independent and can start in parallel. P2 follows P1 in review order so real costs exist when the new outcomes land, and P3 follows P2 so an imperfect size model cannot invalidate results. P4 starts once P1 and P3 produce stratified data and then recurs. Nothing here requires a schema migration; if one becomes necessary during implementation, it gets its own slice under the repository's migration discipline.

## Decisions to settle before implementation

| Decision                                      | Recommendation                                                                                                        | Alternative and trade-off                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Overdraft versus reserving the maximum        | Reserve the estimate, validate against the maximum, allow bounded negative remaining quota that blocks new admissions | Reserve `maxCostMinorUnits` per build: simpler invariant, but every build consumes the full maximum as held headroom     |
| Where the estimate model lives                | Versioned values in the existing cost configuration alongside `pricing_version`                                        | Generator-served pre-quote: most accurate, but adds a cross-repo contract before calibration data justifies it             |
| Fallback metering in non-development targets  | `configured_pricing` only as an explicit, flagged canary fallback                                                       | Forbid it entirely outside development: cleanest accounting, but removes a controlled rollout path                          |

## Non-goals

No billing-account details enter the ledger; [ADR 0013](../docs/adr/0013-klicker-reserves-and-settles-graph-cost.md) keeps that association external. Element-generation spends keep their fixed per-dispatch pricing and are untouched. No automatic paid rebuilds, currency changes or model-routing changes follow from this plan.

## Verification strategy

Contract tests cover the three P2 cost outcomes, the zero-token `provider_reported` rejection and the currency and overflow guards. Quota tests cover raise, equal and lower configuration against an existing row, the bounded overdraft invariant and idempotent reservation release. Band tests cover P3 boundaries and the maximum clamp. Live acceptance on staging requires one build with nonzero token counters, a settled amount that diverges from its estimate, and a configuration raise that deploys without a same-window row change.

## References

- [ADR 0013 — Klicker reserves and settles graph cost](../docs/adr/0013-klicker-reserves-and-settles-graph-cost.md).
- [ADR 0017 — the graph-build ledger is canonical](../docs/adr/0017-graph-build-ledger-is-canonical.md).
- [Knowledge graph quality roadmap](2026-09-12-kg-quality-roadmap.md), W1 diagnostics and W12 operational quality.
- Staging eight-way comparison evidence: draft [PR #6234](https://github.com/uzh-bf/klicker-uzh/pull/6234).
