# Adaptive IRT Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the provisional level-anchor/MLE adaptive model with a versioned, calibrated, Bayesian IRT model that produces honest Diagnostic Practice Quiz results while preserving all legacy attempts and publication snapshots.

**Architecture:** Add an `IRT_V2_EAP_GRID_1` estimator path beside the current `IRT_V1` path. Pure scale, posterior, composite, and selection logic lives in `@klicker-uzh/adaptive-learning`; Prisma stores immutable scale/calibration/publication versions and attempt estimator identity; GraphQL owns permissions, publication, dispatch, and redaction; existing Manage/PWA surfaces gain calibrated and uncertain states without creating a new activity type.

**Tech Stack:** Node.js 24, pnpm 11, TypeScript 5.6, Vitest, Prisma 6/PostgreSQL, Pothos GraphQL, Next.js 15 pages router, React 19, `@uzh-bf/design-system`, Recharts, Playwright.

## Global Constraints

- Adaptive learning remains `PracticeQuizMode.ADAPTIVE`; no standalone activity is introduced.
- Scale and item calibration ownership stays on the reusable competence tree;
  courses link to approved versions and contribute only pseudonymous cohort
  evidence for DIF/drift checks.
- Competence trees keep the existing maximum depth constant of 5; assignments
  target leaves, and enabled sibling weights determine hierarchical allocation.
- The initial student-facing v2 preset is formative `DIAGNOSTIC`; `PLACEMENT` remains blocked.
- Existing pools and attempts remain `IRT_V1` and retain their current computation and rendering.
- Every v2 pool and attempt snapshots its scale, calibration, estimator, classification policy, and effective weights.
- Runtime responses and exposure counters never recalibrate or mutate item
  parameters; new calibration evidence creates a reviewed immutable version for
  future publications only.
- V2 participant and cohort reporting use the latest completed eligible
  attempt; `PracticeQuiz.resetTimeDays` governs retake cooldown, start-over
  abandons only an in-progress attempt, and calibration uses only first exposure
  to each exact item version.
- The estimator implementation identifier is `IRT_V2_EAP_GRID_1`; a future
  posterior, grid, likelihood, or stopping change receives a new identifier
  rather than silently changing this implementation.
- Competence-tree levels are explicit theta bands; an assignment level is only a blueprint category and provisional `b` prior.
- Cut scores require independent standard-setting approval; synthetic
  simulations cannot approve a scale, and cross-version trends require an
  approved anchor-based linking/equating artifact.
- Simulation is an internal engineering verification harness only. It runs in
  package tests and CI/release workflows; it has no Manage/PWA UI, public
  GraphQL operation, user-triggered worker, runtime endpoint, or user-visible
  report/status. Users cannot start simulations or inspect their artifacts.
- V2 reporting and routing both use the same EAP posterior; no unregularized final MLE is used.
- V2 Diagnostic scoring uses calibrated Numerical/Free Text 2PL and SC/MC/KPRIM fixed-`c` 3PL items.
- MC/KPRIM partial scores remain feedback data but do not update the first dichotomous v2 theta model.
- All five item types are graded server-side into the existing canonical
  `score` in `[0,1]` plus `correct` flag; the v2 dichotomous likelihood consumes
  only `correct`, while calibration exports retain the canonical score/category.
- Numerical percent, decimal, fraction, Unicode-minus, grouping, and range
  normalization remains the single server-owned implementation; client input
  can never provide score or correctness.
- Free Text is limited to short controlled-answer matching through the existing
  normalized solution evaluator; open language production is not treated as an
  IRT-scored item.
- V2 never converts a capped or exhausted point estimate into a classified level.
- The weighted overall result is labeled an overall proficiency profile, not a
  separately calibrated latent trait; root and nested results remain visible.
- Participant GraphQL payloads never expose theta, item parameters, solutions, calibration metadata, or raw posterior grids.
- Calibration datasets contain pseudonymous scoring facts only and never raw Free Text content or participant identity.
- English and German copy change together.
- No dependency is added for runtime posterior computation; validate the TypeScript implementation against an external reference fixture.
- Every task ends with focused tests and an intentional commit.

---

### Task 1: Explicit Scale And Calibration Primitives

**Files:**

- Create: `packages/adaptive-learning/src/scale.ts`
- Create: `packages/adaptive-learning/src/calibration.ts`
- Create: `packages/adaptive-learning/src/policy.ts`
- Create: `packages/adaptive-learning/test/scale.test.ts`
- Create: `packages/adaptive-learning/test/calibration.test.ts`
- Create: `packages/adaptive-learning/test/policy.test.ts`
- Modify: `packages/adaptive-learning/src/index.ts`
- Modify: `packages/adaptive-learning/package.json`

**Interfaces:**

- Produces:

```ts
export type ExplicitAdaptiveLevel = {
  id: number
  label: string
  order: number
  lowerBound: number
  upperBound: number
  itemDifficultyPrior: number
}

export type AdaptiveScaleDefinition = {
  priorMean: number
  priorStandardDeviation: number
  gridMin: number
  gridMax: number
  gridStep: number
  classificationPolicyVersion: number
  levels: ExplicitAdaptiveLevel[]
}

export type AdaptiveClassificationPolicy = {
  version: number
  credibleMass: number
  candidateProbabilityThresholds: readonly number[]
  minimumProbabilityThreshold: number
}

export type AdaptiveCalibrationStatus =
  | 'PROVISIONAL'
  | 'PILOT'
  | 'CALIBRATED'
  | 'FLAGGED'
  | 'RETIRED'

export type AdaptiveItemModel = 'TWO_PL' | 'THREE_PL_FIXED_C'

export type AdaptiveItemCalibration = {
  id: string
  status: AdaptiveCalibrationStatus
  model: AdaptiveItemModel
  discrimination: number
  difficulty: number
  guessing: number
  elementVersion: number
}

export function validateAdaptiveScale(scale: AdaptiveScaleDefinition): string[]

export function levelForTheta(
  theta: number,
  levels: ExplicitAdaptiveLevel[]
): ExplicitAdaptiveLevel | null

export function resolveEffectiveItemParameters(input: {
  calibration: AdaptiveItemCalibration | null
  elementVersion: number
  provisionalDifficulty: number
  provisionalDiscrimination?: number
  itemType: AdaptiveItemType
  choiceCount?: number | null
}): {
  model: AdaptiveItemModel
  discrimination: number
  difficulty: number
  guessing: number
  contributesToDiagnosticEstimate: boolean
}
```

- Consumes: `DEFAULT_DISCRIMINATION`, `MAX_ABSOLUTE_THETA`,
  `MAX_DISCRIMINATION`, and `deriveGuessingParameter` from `core.ts`.

- [ ] **Step 1: Write failing scale tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  levelForTheta,
  validateAdaptiveScale,
  type AdaptiveScaleDefinition,
} from '../src/scale.js'

const scale: AdaptiveScaleDefinition = {
  priorMean: 0,
  priorStandardDeviation: 1,
  gridMin: -6,
  gridMax: 6,
  gridStep: 0.1,
  classificationPolicyVersion: 1,
  levels: [
    {
      id: 1,
      label: 'Foundation',
      order: 0,
      lowerBound: Number.NEGATIVE_INFINITY,
      upperBound: -1.5,
      itemDifficultyPrior: -3,
    },
    {
      id: 2,
      label: 'Independent',
      order: 1,
      lowerBound: -1.5,
      upperBound: 1.5,
      itemDifficultyPrior: 0,
    },
    {
      id: 3,
      label: 'Advanced',
      order: 2,
      lowerBound: 1.5,
      upperBound: Number.POSITIVE_INFINITY,
      itemDifficultyPrior: 3,
    },
  ],
}

describe('explicit adaptive scale', () => {
  it('maps exact lower cuts into the higher band', () => {
    expect(validateAdaptiveScale(scale)).toEqual([])
    expect(levelForTheta(-1.5, scale.levels)?.label).toBe('Independent')
    expect(levelForTheta(1.5, scale.levels)?.label).toBe('Advanced')
  })

  it('rejects gaps, overlaps, invalid priors, and unordered levels', () => {
    const invalid = structuredClone(scale)
    invalid.levels[1]!.lowerBound = -1.4
    expect(validateAdaptiveScale(invalid)).toContain(
      'Level bands must be contiguous.'
    )
  })
})
```

In `policy.test.ts`, assert the exact v1 credible mass/candidate thresholds,
reject unsorted, duplicate, non-finite, below-minimum, or out-of-range
thresholds, and prove callers cannot mutate the exported policy object.

- [ ] **Step 2: Write failing calibration tests**

```ts
it('uses only approved exact-version calibrations for Diagnostic', () => {
  expect(
    resolveEffectiveItemParameters({
      calibration: {
        id: 'calibration-1',
        status: 'CALIBRATED',
        model: 'TWO_PL',
        discrimination: 1.1,
        difficulty: 0.35,
        guessing: 0,
        elementVersion: 4,
      },
      provisionalDifficulty: 0,
      itemType: 'NUMERICAL',
    })
  ).toMatchObject({
    difficulty: 0.35,
    contributesToDiagnosticEstimate: true,
  })
})

it.each(['PROVISIONAL', 'PILOT', 'FLAGGED', 'RETIRED'] as const)(
  'excludes %s parameters from Diagnostic estimation',
  (status) => {
    const resolved = resolveEffectiveItemParameters({
      calibration: {
        id: `calibration-${status}`,
        status,
        model: 'TWO_PL',
        discrimination: 1.2,
        difficulty: 0,
        guessing: 0,
        elementVersion: 1,
      },
      provisionalDifficulty: 0,
      itemType: 'NUMERICAL',
    })
    expect(resolved.contributesToDiagnosticEstimate).toBe(false)
  }
)
```

- [ ] **Step 3: Run tests and confirm missing-module failures**

```bash
pnpm --filter @klicker-uzh/adaptive-learning exec vitest run test/scale.test.ts test/calibration.test.ts test/policy.test.ts
```

Expected: failure because `scale.ts`, `calibration.ts`, and `policy.ts` do not
exist.

- [ ] **Step 4: Implement scale validation and band mapping**

Implement validation with these exact invariants:

```ts
const ordered = scale.levels.slice().sort((a, b) => a.order - b.order)
if (ordered.length < 2) errors.push('At least two levels are required.')
if (!(scale.priorStandardDeviation > 0)) {
  errors.push('Prior standard deviation must be positive.')
}
if (!(scale.gridMin < scale.gridMax) || !(scale.gridStep > 0)) {
  errors.push('The posterior grid must be increasing.')
}
if (
  !Number.isInteger(scale.classificationPolicyVersion) ||
  scale.classificationPolicyVersion < 1
) {
  errors.push('A supported classification policy version is required.')
}
for (let index = 0; index < ordered.length; index++) {
  const level = ordered[index]!
  if (level.order !== index) errors.push('Level order must be contiguous.')
  if (index > 0 && level.lowerBound !== ordered[index - 1]!.upperBound) {
    errors.push('Level bands must be contiguous.')
  }
}
```

`levelForTheta` uses lower-inclusive, upper-exclusive bands and returns the last
band for positive infinity only when the input is finite.

Require positive unique level IDs and non-empty labels. The prior mean, all
finite internal cuts, and all item-difficulty priors must lie inside the grid.
Require `(gridMax - gridMin) / gridStep` to be integral within a scale-aware
floating-point tolerance and cap the grid at 2,001 points. Task 2 constructs
points as `gridMin + index * gridStep` and assigns the final endpoint exactly to
`gridMax`; it never grows an array through unchecked repeated addition.

Add a code-owned `ADAPTIVE_CLASSIFICATION_POLICY_V1` with `credibleMass = 0.9`,
candidate thresholds `[0.8, 0.9, 0.95]`, and minimum threshold `0.8`. Validate
that masses/thresholds are finite, strictly between zero and one, sorted, and
not below the minimum. Authors can select neither the policy implementation nor
its thresholds.

- [ ] **Step 5: Implement calibration resolution**

Use `CALIBRATED` as the only Diagnostic-scoring status. Validate finite
parameters, `a > 0`, `0 <= c < 1`, and the package bounds. Enforce
Numerical/Free Text as 2PL with `c = 0`; enforce SC/MC/KPRIM as fixed-`c` 3PL
with `c = deriveGuessingParameter({ type, choiceCount })` for the exact
published element version. For a provisional item, return
`a = provisionalDiscrimination ?? 1.2`, the level prior as `b`, the
server-derived `c`, and `contributesToDiagnosticEstimate: false`. Diagnostic
never substitutes this provisional `a` for an approved item calibration.
Require the exact published element version as input and reject a calibration
from any other version. Reject unsupported deserialized item types, require an
exact choice count for SC/MC/KPRIM, and require exactly four statements for
KPRIM.

- [ ] **Step 6: Export modules and include tests in package scripts**

Add:

```ts
export * from './calibration.js'
export * from './policy.js'
export * from './scale.js'
```

Update `test` so the new focused tests run in the standard package gate.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter @klicker-uzh/adaptive-learning test
pnpm --filter @klicker-uzh/adaptive-learning check
git add packages/adaptive-learning
git commit -m "feat(adaptive): add explicit scale and calibration primitives"
```

Expected: all adaptive package unit tests and type checks pass.

---

### Task 2: EAP Posterior And Deterministic Composite

**Files:**

- Create: `packages/adaptive-learning/src/posterior.ts`
- Create: `packages/adaptive-learning/src/composite.ts`
- Create: `packages/adaptive-learning/src/classification.ts`
- Create: `packages/adaptive-learning/test/posterior.test.ts`
- Create: `packages/adaptive-learning/test/composite.test.ts`
- Create: `packages/adaptive-learning/test/classification.test.ts`
- Create: `packages/adaptive-learning/test/fixtures/eap-reference.json`
- Create: `packages/adaptive-learning/test/fixtures/eap-reference-provenance.md`
- Create: `packages/adaptive-learning/scripts/generateEapReference.ts`
- Modify: `packages/adaptive-learning/src/index.ts`
- Modify: `packages/adaptive-learning/package.json`

**Interfaces:**

```ts
export type AdaptivePosterior = {
  points: number[]
  probabilities: number[]
  mean: number
  variance: number
  standardDeviation: number
  credibleLower: number
  credibleUpper: number
  bandProbabilities: Array<{
    levelId: number
    probability: number
  }>
}

export type AdaptiveScoredItem = {
  id: number | string
  model: AdaptiveItemModel
  calibrationId: string
  discrimination: number
  difficulty: number
  guessing: number
}

export type AdaptiveScoredResponse = {
  item: AdaptiveScoredItem
  correct: boolean
}

export function estimateEapPosterior(input: {
  responses: AdaptiveScoredResponse[]
  scale: AdaptiveScaleDefinition
  credibleMass: number
}): AdaptivePosterior

export function combineWeightedPosteriors(input: {
  entries: Array<{
    key: string
    posterior: AdaptivePosterior
    weight: number
  }>
  scale: AdaptiveScaleDefinition
  credibleMass: number
}): AdaptivePosterior

export function classifyPosterior(input: {
  posterior: AdaptivePosterior
  scale: AdaptiveScaleDefinition
  probabilityThreshold: number
  evidenceSatisfied: boolean
  evidenceReachable: boolean
  calibratedCoverageSatisfied: boolean
  integritySatisfied: boolean
  terminalReason: AdaptiveRuntimeStopReason | null
}): {
  status:
    | 'CLASSIFIED'
    | 'BETWEEN_LEVELS'
    | 'INSUFFICIENT_EVIDENCE'
    | 'POOL_LIMITED'
  levelId: number | null
  probability: number
  leadingLevelIds: number[]
}
```

- [ ] **Step 1: Add EAP recovery and extreme-string tests**

```ts
it('recovers the trusted reference posterior', () => {
  const posterior = estimateEapPosterior(reference.input)
  expect(posterior.mean).toBeCloseTo(reference.output.discrete.mean, 6)
  expect(posterior.standardDeviation).toBeCloseTo(
    reference.output.discrete.standardDeviation,
    6
  )
  expect(posterior.mean).toBeCloseTo(reference.output.continuous.mean, 2)
})

it.each([
  { correct: true, direction: 1 },
  { correct: false, direction: -1 },
])('keeps uniform response strings finite', ({ correct, direction }) => {
  const posterior = estimateEapPosterior({
    scale,
    credibleMass: 0.9,
    responses: items.map((item) => ({ item, correct })),
  })
  expect(Number.isFinite(posterior.mean)).toBe(true)
  expect(Number.isFinite(posterior.standardDeviation)).toBe(true)
  expect(Math.sign(posterior.mean)).toBe(direction)
  expect(posterior.mean).toBeGreaterThan(scale.gridMin)
  expect(posterior.mean).toBeLessThan(scale.gridMax)
})
```

The reference fixture must be produced once from a standalone script that
implements the discrete grid literally and independently, then cross-checks it
with adaptive-Simpson continuous quadrature over the same finite grid domain.
It imports no production probability, scale, posterior, or summarization code.
Freeze prior-only, mixed 2PL/3PL, asymmetric, extreme-correct, extreme-wrong,
and cut-boundary cases. Commit numeric input/output plus provenance, formula,
generator command, Node/pnpm versions, tolerances, fixture SHA-256, and
generator-source SHA-256. CI verifies both checksums without regenerating the
fixture implicitly.

- [ ] **Step 2: Add probability-classification tests**

```ts
it('abstains when no band reaches the approved probability', () => {
  const decision = classifyPosterior({
    posterior: posteriorWithBandMass([0.05, 0.72, 0.23]),
    scale,
    probabilityThreshold: 0.8,
    evidenceSatisfied: true,
    evidenceReachable: true,
    calibratedCoverageSatisfied: true,
    integritySatisfied: true,
    terminalReason: null,
  })
  expect(decision).toEqual({
    status: 'BETWEEN_LEVELS',
    levelId: null,
    probability: 0.95,
    leadingLevelIds: [2, 3],
  })
})
```

- [ ] **Step 3: Add composite tests**

```ts
it('combines root posteriors without counting descendants again', () => {
  const combined = combineWeightedPosteriors({
    scale,
    credibleMass: 0.9,
    entries: [
      { key: 'root-a', posterior: normalPosterior(-2, 0.4), weight: 3 },
      { key: 'root-b', posterior: normalPosterior(2, 0.4), weight: 2 },
    ],
  })
  expect(combined.mean).toBeCloseTo(-0.4, 2)
  expect(combined.probabilities.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1)
})
```

- [ ] **Step 4: Run the failing tests**

```bash
pnpm --filter @klicker-uzh/adaptive-learning exec vitest run test/posterior.test.ts test/composite.test.ts test/classification.test.ts
```

Expected: failure because the posterior and composite modules do not exist.

- [ ] **Step 5: Implement log-space EAP**

Build grid points from `gridMin` through `gridMax`, including both endpoints.
For each point:

```ts
const logPrior =
  -0.5 * Math.pow((theta - priorMean) / priorStandardDeviation, 2)
const logLikelihood = responses.reduce((sum, response) => {
  return sum + stableBernoulliLogLikelihood(theta, response)
}, 0)
```

Do not call the v1 `probability()` helper, because its optional defaults and
probability clamping are incompatible with calibrated v2 likelihoods. Validate
non-empty calibration IDs, required finite `a/b/c`, supported bounds, and
model/guessing compatibility before evaluation. Compute correct/incorrect 2PL
and 3PL log likelihoods with stable log-sigmoid/log-add-exp identities; never
form `log(1 - p)` from a rounded probability.

Normalize with log-sum-exp. Derive mean/variance from the normalized truncated
discrete mass; zero responses return the normalized grid prior. Compute
equal-tail credible bounds through the generalized inverse discrete CDF using
the explicit `credibleMass`. Point-level mapping remains lower-inclusive and
maps an exact cut to the higher level, while posterior probability on a grid
atom exactly equal to a cut is split equally between its adjacent bands to
avoid grid-alignment bias. All band probabilities must sum to one.

- [ ] **Step 6: Implement deterministic weighted convolution**

Validate every posterior and weight before filtering zero-weight entries.
Reject empty input, duplicate keys, all-zero/negative/non-finite weights,
mismatched point/probability lengths, non-canonical grids, negative/non-finite
probabilities, and zero probability totals. Normalize weights using
maximum-weight scaling, sort entries by stable root key, map weighted root mass
onto adjacent composite bins while preserving the first moment, and convolve
probability masses. Renormalize after each convolution and derive summary
fields through the same posterior summarizer used by EAP with the explicitly
passed `credibleMass`. Do not use `Math.random`.

Test every input permutation, proportional weight scaling, normalization,
single-root exact identity, and mean preservation within `1e-12`. The expected
independent-root variance is `sum(normalizedWeight^2 * posterior.variance)`;
the accepted discretization difference is bounded by
`positiveEntryCount * maximumGridInterval^2 / 4 + 1e-12`.

- [ ] **Step 7: Implement classification precedence**

Reject invalid thresholds/posteriors and throw an integrity error when
`integritySatisfied` is false; integrity failures never become a result label.
`ABANDONED` never classifies. Both `CLASSIFIED` and `BETWEEN_LEVELS` require
minimum evidence. With those guards:

1. return `CLASSIFIED` when one band reaches the snapshotted threshold,
2. return `BETWEEN_LEVELS` when exactly two unambiguously leading adjacent
   bands reach the threshold in combination,
3. return `POOL_LIMITED` when calibrated coverage is missing or required
   evidence is explicitly unreachable, and
4. return `INSUFFICIENT_EVIDENCE` for remaining capped/early states.

A cap or pool exhaustion reason alone does not prove evidence is unreachable;
the v2 runtime supplies that fact explicitly. A capped attempt with sufficient
evidence and adjacent-band mass remains `BETWEEN_LEVELS`. Use an exhaustive
switch over every terminal reason; `CLASSIFIED` with no qualifying posterior
band is an invalid state, while `ALL_ROOTS_CLASSIFIED` may still yield an
uncertain overall composite.

Never select a level from the posterior mean as a fallback. Add tests for
non-adjacent leading bands, three-way ties, exact-cut symmetry, exact-threshold
inclusion, false evidence with high mass, abandonment, every terminal reason,
reachability/coverage distinctions, and integrity failure. `probability` is the
winning-band mass for `CLASSIFIED`, combined adjacent-band mass for
`BETWEEN_LEVELS`, and zero for the remaining internal decisions; GraphQL maps
non-classifying zero to `null`.

- [ ] **Step 8: Verify and commit**

```bash
pnpm --filter @klicker-uzh/adaptive-learning test
pnpm --filter @klicker-uzh/adaptive-learning check
git add packages/adaptive-learning
git commit -m "feat(adaptive): add Bayesian posterior estimation"
```

---

### Task 3: Hierarchical EAP Runtime And Selection

**Files:**

- Create: `packages/adaptive-learning/src/selectionV2.ts`
- Create: `packages/adaptive-learning/src/estimator.ts`
- Create: `packages/adaptive-learning/src/runtimeV2.ts`
- Create: `packages/adaptive-learning/test/selectionV2.test.ts`
- Create: `packages/adaptive-learning/test/estimatorVersion.test.ts`
- Create: `packages/adaptive-learning/test/runtimeV2.test.ts`
- Create: `packages/adaptive-learning/test/runtimeV2.performance.test.ts`
- Modify: `packages/adaptive-learning/src/runtime.ts`
- Modify: `packages/adaptive-learning/src/index.ts`
- Modify: `packages/adaptive-learning/package.json`

**Interfaces:**

```ts
export type AdaptiveMeasurementVersion = 'IRT_V1' | 'IRT_V2_EAP_GRID_1'

export function resolveAdaptiveEstimator(
  version: AdaptiveMeasurementVersion
): AdaptiveEstimator

export function assertSupportedEstimatorVersion(
  version: string
): asserts version is AdaptiveMeasurementVersion

export type AdaptiveV2PoolItem = AdaptiveRuntimePoolItem & {
  model: AdaptiveItemModel
  calibrationId: string | null
  contributesToEstimate: boolean
}

export type AdaptiveV2Estimate = {
  nodeId: number | null
  posterior: AdaptivePosterior | null
  responseCount: number
  classifiedLevelId: number | null
  classificationProbability: number | null
}

export type AdaptiveV2ResultStatus =
  | 'CLASSIFIED'
  | 'BETWEEN_LEVELS'
  | 'INSUFFICIENT_EVIDENCE'
  | 'POOL_LIMITED'
  | 'RESEARCH_ONLY'

export function expectedPosteriorInformation(input: {
  posterior: AdaptivePosterior
  item: AdaptiveV2PoolItem
}): number

export function prepareAdaptiveV2Runtime(input: {
  nodes: AdaptiveRuntimeNode[]
  scale: AdaptiveScaleDefinition
  pool: AdaptiveV2PoolItem[]
  settings: AdaptiveRuntimeSettings
}): PreparedAdaptiveV2Runtime

export function advanceAdaptiveV2Runtime(input: {
  attemptId: string
  runtime: PreparedAdaptiveV2Runtime
  responses: AdaptiveRuntimeResponse<AdaptiveV2PoolItem>[]
}): AdaptiveV2Decision
```

- [ ] **Step 1: Add posterior-information tests**

Assert that expected information is the posterior-mass-weighted item
information and that a calibrated item near the posterior receives a higher
score than a distant item.

- [ ] **Step 2: Add hierarchy and no-double-counting tests**

```ts
it('estimates each node from its descendant responses exactly once', () => {
  const result = advanceAdaptiveV2Runtime({
    attemptId: 'attempt-1',
    runtime: depthFiveRuntime(),
    responses: responsesOnTwoLeaves(),
  })
  expect(result.estimates.nodes.get(leafA)?.responseCount).toBe(2)
  expect(result.estimates.nodes.get(parent)?.responseCount).toBe(4)
  expect(result.estimates.nodes.get(root)?.responseCount).toBe(4)
  expect(result.estimates.overall.responseCount).toBe(4)
})
```

- [ ] **Step 3: Add content-allocation tests**

Cover:

- no-evidence roots and leaves first,
- minimum evidence before information optimization,
- weights normalized among enabled siblings,
- effective leaf weight equals the path-weight product,
- leaf/root/ancestor caps,
- selected item's leaf posterior is used,
- provisional Research items do not update theta, and
- Research satisfies calibrated anchor quotas/connectivity before randomized
  field-test inclusion and returns the exact administration probability/design
  version,
- Diagnostic rejects non-calibrated scoring pools.

- [ ] **Step 4: Add stopping tests**

```ts
it('does not classify a capped point estimate below the probability threshold', () => {
  const decision = runToCap(uncertainBoundaryRuntime())
  expect(decision.stopReason).toBe('TOTAL_QUESTION_CAP')
  expect(decision.resultStatus).toBe('BETWEEN_LEVELS')
  expect(decision.estimates.overall.classifiedLevelId).toBeNull()
})
```

- [ ] **Step 5: Run tests and confirm missing-module failures**

```bash
pnpm --filter @klicker-uzh/adaptive-learning exec vitest run test/selectionV2.test.ts test/estimatorVersion.test.ts test/runtimeV2.test.ts
```

- [ ] **Step 6: Implement v2 selection**

Selection order is:

1. missing leaf minimum evidence,
2. largest effective-weight allocation deficit,
3. largest weighted posterior-variance contribution,
4. calibrated anchor/connectivity deficit in Research mode,
5. randomized bounded provisional field-test deficit in Research mode,
6. posterior expected information within the selected leaf, and
7. deterministic randomesque selection among eligible top candidates.

Preserve the existing server-generated attempt/order hash for deterministic
replay. Add exposure eligibility as an input predicate; persistence supplies
actual exposure counts and prior-attempt overlap later. Within the approved
high-information candidate set, prefer underused and previously unseen exact
item versions; never repeat an item within one attempt.

Research uses the attempt hash as a deterministic PRNG seed to randomize
field-test inclusion inside the selected content stratum. Return and persist the
known conditional administration probability and collection-design version so
offline calibration can account for the design.

- [ ] **Step 7: Implement v2 estimates and stopping**

Build evidence per node from unique node paths, calculate EAP for each node,
combine top-level roots only, and classify with posterior band mass. Roots gate
completion; nested leaves are reported when their own threshold is reached.

- [ ] **Step 8: Add fail-closed estimator dispatch**

Keep all current `core.ts` and v1 runtime behavior as the `IRT_V1` compatibility
contract. `runtime.ts` dispatches through `resolveAdaptiveEstimator`; v2
estimation remains in `runtimeV2.ts`. Unknown versions and attempts whose pool,
scale, or estimator versions disagree throw `AdaptiveRuntimeConfigurationError`
before item delivery or response persistence.

- [ ] **Step 9: Verify performance, tests, and commit**

```bash
pnpm --filter @klicker-uzh/adaptive-learning test
pnpm --filter @klicker-uzh/adaptive-learning test:performance
pnpm --filter @klicker-uzh/adaptive-learning check
git add packages/adaptive-learning
git commit -m "feat(adaptive): add hierarchical EAP runtime"
```

Expected: v1 tests remain unchanged and v2 performance stays within the current
runtime test budget for a 60-item, depth-5 fixture.

---

### Task 4: Internal Versioned Simulation And V2 Release Gates

**Files:**

- Create: `packages/adaptive-learning/scripts/internalSimulation.ts`
- Modify: `packages/adaptive-learning/test/simulationHarness.ts`
- Create: `packages/adaptive-learning/test/internalSimulation.test.ts`
- Create: `packages/adaptive-learning/test/irtV2Simulation.test.ts`
- Create: `packages/adaptive-learning/scripts/simulationV2Scenarios.ts`
- Create: `packages/adaptive-learning/scripts/simulationV2Gates.ts`
- Modify: `packages/adaptive-learning/scripts/simulationScenarios.ts`
- Modify: `packages/adaptive-learning/scripts/simulationGates.ts`
- Modify: `packages/adaptive-learning/scripts/simulationReport.ts`
- Modify: `packages/adaptive-learning/scripts/generateSimulationReport.test.ts`
- Modify: `packages/adaptive-learning/reports/simulation-summary.md`
- Modify: `packages/adaptive-learning/reports/simulation-report.json`
- Modify: `packages/adaptive-learning/package.json`

**Interfaces:**

```ts
export type AdaptiveV2SimulationMetrics = {
  learnerCount: number
  classifiedCount: number
  abstainedCount: number
  classificationRate: number
  classificationRateLower95: number
  requiredRootClassificationRate: number
  requiredRootClassificationRateLower95: number
  meanBias: number
  absoluteBiasUpper95: number
  rmse: number
  rmseUpper95: number
  credibleCoverage: number
  credibleCoverageLower95: number
  credibleCoverageUpper95: number
  classifiedBandAccuracy: number
  classifiedBandAccuracyLower95: number
  nonAdjacentConfidentErrorRate: number
  nonAdjacentConfidentErrorRateUpper95: number
  forcedClassificationCount: number
  unexpectedFallbackCount: number
  medianQuestionCount: number
  meanQuestionCount: number
  p95QuestionCount: number
  medianDurationSeconds: number
  p95DurationSeconds: number
  stopReasons: Record<string, number>
  maximumExposureRate: number
  maximumTestOverlapRate: number
  strata: Array<{
    key: string
    learnerCount: number
    classificationRate: number
    classificationRateLower95: number
    classifiedBandAccuracy: number
    classifiedBandAccuracyLower95: number
    nonAdjacentConfidentErrorRate: number
    nonAdjacentConfidentErrorRateUpper95: number
    credibleCoverage: number
    credibleCoverageLower95: number
    credibleCoverageUpper95: number
  }>
}

export type AdaptiveV2ReleasePolicy = {
  version: number
  classificationPolicyVersion: number
  credibleMass: number
  candidateProbabilityThresholds: readonly number[]
  minimumProbabilityThreshold: number
  minimumSimulatedLearnersPerRequiredStratum: number
  minimumHoldoutLearnersPerMajorStratum: number
  minimumHoldoutLearnersPerDifGroup: number
  minimumInteriorClassificationRate: number
  minimumRequiredRootClassificationRate: number
  cutNeighborhoodWidth: number
  maximumExposureRate: number
  maximumTestOverlapRate: number
  maximumMedianDurationSeconds: number
  maximumP95DurationSeconds: number
}

export type AdaptiveV2SimulationReport = {
  schemaVersion: 1
  inputFingerprint: string
  estimatorVersion: 'IRT_V2_EAP_GRID_1'
  policyVersion: number
  seed: string
  thresholdResults: Array<{
    probabilityThreshold: number
    metrics: AdaptiveV2SimulationMetrics
    gates: Array<{
      name: string
      passed: boolean
      actual: number
      required: string
    }>
    passed: boolean
  }>
  approvedProbabilityThreshold: number | null
  passed: boolean
}

export function fingerprintAdaptiveSimulationInput(...)
export function runAdaptiveV2Simulation(...): AdaptiveV2SimulationReport

export function evaluateV2ReleaseGates(
  metrics: AdaptiveV2SimulationMetrics,
  policy: AdaptiveV2ReleasePolicy
): Array<{ name: string; passed: boolean; actual: number; required: string }>

export function evaluateEmpiricalReleaseGates(
  metrics: AdaptiveV2SimulationMetrics,
  policy: AdaptiveV2ReleasePolicy
): Array<{ name: string; passed: boolean; actual: number; required: string }>
```

This module is developer-facing validation code. Only package tests, report
scripts, and CI/release commands may import the scenario runner. Production
GraphQL services, Next.js applications, Hatchet workers, and participant
runtime code must not import or expose it. `scripts/internalSimulation.ts`
contains the fingerprint, metric reduction, gate predicates, and scenario
runner and is not exported from the package entry point or production bundle.
It must not register a runtime endpoint or persist simulated learner data.

- [ ] **Step 1: Port the seed-shaped model-recovery scenarios**

Reproduce the current two-root, 3:2-weight, depth-5, mixed-type, 60-item seed
fixture and theta grid from the psychometric review. Extend the existing
harness with estimator version, explicit scale, per-root/per-leaf abilities,
and response-profile strategy; do not create a second incompatible harness.
Move the deterministic fingerprint, scenario runner, metric reduction, and
gate evaluation into `scripts/internalSimulation.ts`; tests/report scripts may
add richer trace formatting around that internal kernel. Do not export it from
`src/index.ts` or import it from production code.

- [ ] **Step 2: Add misspecification and boundary scenarios**

Include:

- theta values immediately below and above each explicit cut,
- 80/20, 85/15, 90/10, 95/5, and deterministic threshold response patterns,
- incorrect provisional `b`,
- true `a` values 0.8, 1.0, 1.2, and 1.5,
- item drift and adjacent-band mislabeling,
- heterogeneous root abilities and nested leaf abilities,
- all-correct/all-wrong/guessing,
- all five item types separately and mixed,
- calibrated/provisional contamination,
- connected/disconnected anchor banks and randomized Research administration
  with known inclusion probabilities, and
- repeated attempts under cooldown, latest-result selection, overlap control,
  and first-exposure calibration filtering, and
- sparse, target, and rich banks.

- [ ] **Step 3: Encode the approved gates**

The gate implementation checks:

```ts
const gates = [
  metrics.absoluteBiasUpper95 <= 0.1,
  metrics.rmseUpper95 <= 0.5,
  metrics.credibleCoverageLower95 >= 0.85,
  metrics.credibleCoverageUpper95 <= 0.95,
  metrics.classifiedBandAccuracyLower95 >= 0.9,
  metrics.nonAdjacentConfidentErrorRateUpper95 <= 0.01,
  metrics.classificationRateLower95 >= policy.minimumInteriorClassificationRate,
  metrics.requiredRootClassificationRateLower95 >=
    policy.minimumRequiredRootClassificationRate,
  metrics.forcedClassificationCount === 0,
  metrics.unexpectedFallbackCount === 0,
  metrics.maximumExposureRate <= policy.maximumExposureRate,
  metrics.maximumTestOverlapRate <= policy.maximumTestOverlapRate,
  metrics.medianDurationSeconds <= policy.maximumMedianDurationSeconds,
  metrics.p95DurationSeconds <= policy.maximumP95DurationSeconds,
  metrics.strata.every(
    (stratum) =>
      stratum.learnerCount >=
        policy.minimumSimulatedLearnersPerRequiredStratum &&
      stratum.classifiedBandAccuracyLower95 >= 0.9 &&
      stratum.nonAdjacentConfidentErrorRateUpper95 <= 0.01 &&
      stratum.credibleCoverageLower95 >= 0.85 &&
      stratum.credibleCoverageUpper95 <= 0.95
  ),
]
```

Boundary scenarios separately require abstention when the approved
misclassification limit cannot be met. Cap/exhaustion scenarios require zero
forced classified labels. Report every gate overall and by band, root, item
type, course cohort, and cut-distance stratum. Cut-neighborhood width, exposure,
overlap, and formative duration limits live in the immutable policy input, not
hidden constants.

Policy v1 uses at least 1,000 simulated learners in every required band/root,
item-type, course-cohort, and cut-distance stratum, a lower 95% classification
rate bound of at least `0.80` away from cut neighborhoods, and a lower 95%
required-root classification rate of at least `0.75`. Gate accuracy on its
lower 95% bound (`>= 0.90`), non-adjacent confident error on its upper 95% bound
(`<= 0.01`), and credible coverage with its confidence interval contained in
`[0.85, 0.95]`. Bias and RMSE use deterministic bootstrap 95% bounds against
their limits. Every required stratum must pass independently; an aggregate pass
cannot hide a failed stratum. Near-cut strata have no minimum classification
rate but retain misclassification/abstention gates.

Empirical validation uses separately approved minima of at least 200 holdout
learners per major band/root/boundary stratum and 100 per predeclared DIF group;
these are policy values, not claims that response count alone proves
calibration. Insufficient empirical power blocks broad Diagnostic release and
is reported explicitly rather than silently falling back to synthetic results.
`evaluateEmpiricalReleaseGates` applies those empirical minima while retaining
the same confidence-bound accuracy, error, coverage, bias, abstention,
exposure, and duration gates.

Evaluate all code-owned candidate thresholds and set
`approvedProbabilityThreshold` to the lowest candidate at or above the policy
minimum whose complete gate set passes. If none passes, the internal release
suite fails and v2 cannot be released. The selected threshold becomes part of
the reviewed, code-owned classification-policy version; no course author or
other user can run the suite, inspect its traces, or override the result.

- [ ] **Step 4: Run the failing v2 simulation**

```bash
pnpm --filter @klicker-uzh/adaptive-learning exec vitest run test/irtV2Simulation.test.ts
```

Expected: local/CI failures identify parameter, pool, or threshold combinations that do
not meet the approved gates. Do not weaken gates to make the initial synthetic
suite pass; mark non-shipping profiles explicitly.

- [ ] **Step 5: Generate deterministic report artifacts**

Upgrade the existing report to schema version 3. Preserve all v1 evidence and
add v2 resolved scenarios, nullable learner traces, metrics, and gates. The
Markdown summarizes model recovery, cut neighborhoods, classification accuracy
conditional on classification, abstention, exposure, and length.

The input fingerprint includes the fixture scale/cuts/grid/prior, estimator and
policy versions, simulated item identities and parameters, hierarchy/weights,
evidence minima, caps, exposure policy, scenario set, and deterministic seed.
Any change invalidates the earlier internal report and CI regenerates it. This
fingerprint is release evidence for the estimator/policy implementation, not a
user-visible or per-quiz publication record.

Add package scripts:

```json
{
  "test:simulation:v2": "vitest run test/irtV2Simulation.test.ts",
  "test:performance": "vitest run test/runtime.performance.test.ts test/runtimeV2.performance.test.ts",
  "test:irt-v2:release": "run-s test test:simulation test:simulation:v2 test:simulation:report test:performance"
}
```

- [ ] **Step 6: Verify determinism and commit**

```bash
pnpm --filter @klicker-uzh/adaptive-learning test:irt-v2:release
git add packages/adaptive-learning/reports
pnpm --filter @klicker-uzh/adaptive-learning test:simulation:report
git diff --exit-code -- packages/adaptive-learning/reports
git add packages/adaptive-learning
git commit -m "test(adaptive): gate Bayesian IRT simulations"
```

---

### Task 5: Persist Immutable Scale, Calibration, And Estimator Versions

**Files:**

- Modify: `packages/prisma/src/prisma/schema/competence.prisma`
- Modify: `packages/prisma/src/prisma/schema/course.prisma`
- Modify: `packages/prisma/src/prisma/schema/user.prisma`
- Modify: `packages/prisma/src/prisma/schema/element.prisma`
- Create: `packages/prisma/src/prisma/schema/migrations/20260731120000_adaptive_irt_v2_records/migration.sql`
- Create: `packages/prisma/src/prisma/schema/migrations/20260731121000_adaptive_irt_v2_backfill/migration.sql`
- Create: `packages/prisma/src/prisma/schema/migrations/20260731122000_adaptive_irt_v2_constraints/migration.sql`
- Modify: `packages/prisma/src/prisma/schema/js.prisma`
- Modify: `apps/analytics/prisma/schema/competence.prisma`
- Modify: `apps/analytics/prisma/schema/course.prisma`
- Modify: `apps/analytics/prisma/schema/element.prisma`
- Modify: `apps/analytics/prisma/schema/user.prisma`
- Modify: `docs/adaptive-learning.md`

**Interfaces:**

Add Prisma enums:

```prisma
enum AdaptiveMeasurementVersion {
  IRT_V1
  IRT_V2_EAP_GRID_1
}

enum AdaptiveScaleVersionStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  ACTIVE
  REJECTED
  SUPERSEDED
}

enum AdaptiveScaleLinkStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  REJECTED
  SUPERSEDED
}

enum AdaptiveItemCalibrationStatus {
  PROVISIONAL
  PILOT
  CALIBRATED
  FLAGGED
  RETIRED
}

enum AdaptiveItemModel {
  TWO_PL
  THREE_PL_FIXED_C
}

enum AdaptiveCalibrationExportStatus {
  REQUESTED
  RUNNING
  READY
  FAILED
  EXPIRED
}

enum AdaptiveEmpiricalValidationStatus {
  SUBMITTED
  APPROVED
  REJECTED
  SUPERSEDED
}

enum AdaptiveResultStatus {
  CLASSIFIED
  BETWEEN_LEVELS
  INSUFFICIENT_EVIDENCE
  POOL_LIMITED
  RESEARCH_ONLY
}
```

Add models `CompetenceTreeScaleVersion`, `CompetenceTreeScaleLevel`,
`CompetenceTreeScaleApproval`, `CompetenceTreeScaleLink`,
`AdaptiveItemCalibration`, `PracticeQuizAdaptivePublication`,
`AdaptiveCalibrationExportRequest`, and
`AdaptivePracticeQuizEmpiricalValidation`.

- [ ] **Step 1: Write the schema models**

Use these required identities:

```prisma
model CompetenceTreeScaleVersion {
  id String @id @default(uuid()) @db.Uuid
  version Int
  status AdaptiveScaleVersionStatus @default(DRAFT)
  priorMean Float @default(0)
  priorStandardDeviation Float @default(1)
  gridMin Float @default(-6)
  gridMax Float @default(6)
  gridStep Float @default(0.1)
  classificationPolicyVersion Int @default(1)
  tree CompetenceTree @relation(fields: [treeId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  treeId String @db.Uuid
  levels CompetenceTreeScaleLevel[]
  calibrations AdaptiveItemCalibration[]
  createdBy User? @relation(fields: [createdById], references: [id], onDelete: SetNull, onUpdate: Cascade)
  createdById String? @db.Uuid
  supersedesVersionId String? @db.Uuid
  submittedForReviewAt DateTime?
  createdAt DateTime @default(now())
  @@unique([treeId, version], map: "ctsv_tree_version_key")
  @@unique([treeId, id], map: "ctsv_tree_id_key")
}

model CompetenceTreeScaleLevel {
  id Int @id @default(autoincrement())
  order Int
  label String
  lowerBound Float?
  itemDifficultyPrior Float
  scaleVersion CompetenceTreeScaleVersion @relation(fields: [scaleVersionId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  scaleVersionId String @db.Uuid
  sourceLevelId Int?
  @@unique([scaleVersionId, order], map: "ctsl_scale_order_key")
}
```

`CompetenceTreeScaleApproval` stores a strict standard-setting evidence summary
(method/version, panel size, date, cut-level rationale codes, artifact
checksum/opaque private key), reviewer, decision, and timestamp. The reviewer
must be an authorized psychometric/admin actor and cannot be the scale creator.
A scale moves `DRAFT -> IN_REVIEW -> APPROVED -> ACTIVE`; structural validation
alone cannot approve it, and only `APPROVED` can become `ACTIVE`.

`CompetenceTreeScaleLink` joins an older and newer scale version with exact
anchor calibration identities, linking/equating method and implementation
version, aggregate fit/uncertainty metrics, artifact checksum, lifecycle status,
and independent reviewer. The newer scale also stores
`supersedesVersionId`. Results across scale versions are comparable only through
an `APPROVED` link.

`AdaptiveItemCalibration` must include scale version, source assignment,
element version, calibration version, model, status, `a/b/c`, parameter
uncertainty, response/participant counts, JSON diagnostics, dataset version,
model implementation version, approval actor/timestamp, and immutable audit
timestamps. Add composite identities for
`[treeId, scaleVersionId, assignmentId, elementId, elementVersion, version]`
so a calibration cannot cross a tree, scale, assignment, or element version.

`PracticeQuizAdaptivePublication` is the immutable header for one materialized
pool version. It includes config/tree identity, monotonically increasing
publication version, estimator implementation, scale reference, cut-score
snapshot, prior/grid snapshot, classification policy snapshot, hierarchical
weight snapshot, evidence minima, total/root/node/leaf caps, candidate-set and
randomization policy, exposure ceiling, overlap/retake policy, Research
anchor/field-test allocation policy, complete stopping-policy version, rollout
policy version, publication actor/time, and superseded/unpublished timestamps.
Pool items and attempts reference this header; there is at most one active
header per config.

`AdaptiveCalibrationExportRequest` stores tree/scale/requester identity, status,
opaque artifact key, checksum, row count, creation/expiry timestamps, and a
non-sensitive failure code. The artifact key is worker-only and is never
returned by GraphQL.

`AdaptivePracticeQuizEmpiricalValidation` stores the exact bank/config
fingerprint, scale/estimator/policy identity, predeclared calibration and
holdout dataset versions/checksums, disjoint-split proof, aggregate and
per-stratum holdout metrics/confidence bounds, status, artifact checksum,
submitter, independent approver, and timestamps. It stores no participant rows
or learner traces. Diagnostic publication references one matching `APPROVED`
record. Internal synthetic simulation artifacts are not database records and
are not exposed to users.

Add `AdaptivePracticeQuizItemExposure` as a mutable operational counter
separate from immutable pool rows. It is keyed by publication and pool item,
stores served/answered counts, and is updated transactionally; it contains no
participant identity.

- [ ] **Step 2: Add version references**

Add nullable `scaleVersionId`, `measurementVersion`, and selected calibration
policy version to `PracticeQuizAdaptiveConfig`. Add
`isAdaptiveLearningCalibrationEnabled @default(false)` to `Course` as a
separate Research/calibration-collection rollout gate; the existing adaptive
learning course flag remains the general delivery gate.

Add the publication id plus calibration/model/version snapshots to
`PracticeQuizAdaptivePoolItem`; copy publication, estimator, scale, and policy
identity to attempts. Add creator, reviewer, and export-request relations to
`User` for scale, linking, calibration, empirical validation, and exports; add
exact element-version calibration/anchor relations to `Element`.

Add to attempt/estimate/response persistence:

```prisma
resultStatus AdaptiveResultStatus?
finalBandProbability Float?
credibleLower Float?
credibleUpper Float?
bandProbabilities Json?
overallCredibleLowerAfter Float?
overallCredibleUpperAfter Float?
overallBandProbabilitiesAfter Json?
administrationProbability Float?
collectionDesignVersion Int?
isCalibrationAnchor Boolean @default(false)
```

Keep legacy theta/standard-error columns for `IRT_V1` and compatibility.

- [ ] **Step 3: Write the additive migration**

`20260731120000_adaptive_irt_v2_records` creates enums, records, nullable
references, indexes, and non-destructive relations only. Historical scale,
publication, calibration, pool, and attempt relations use `RESTRICT` or
`NO ACTION`; deleting a mutable tree/config must never cascade into measurement
audit history after publication.

- [ ] **Step 4: Write guarded backfills**

`20260731121000_adaptive_irt_v2_backfill` must:

1. create one `DRAFT` scale version per existing tree,
2. calculate explicit cuts from each tree's current mapping rule,
3. copy old item anchors into `itemDifficultyPrior`,
4. create `PROVISIONAL` exact assignment/element-version calibration rows from
   existing author priors without claiming empirical evidence,
5. create one `IRT_V1` publication header for each currently materialized
   legacy pool and connect its pool rows and attempts,
6. leave every existing config/pool/attempt on `IRT_V1`, and
7. reject non-finite source ranges, missing element versions, duplicate active
   pools, or non-contiguous level orders before changing data.

For `NEAREST`, use:

```text
anchor(order) = thetaMin + span * order / max(levelCount - 1, 1)
lower(order > 0) = midpoint(anchor(order - 1), anchor(order))
```

For `MASTERY`, use:

```text
anchor(order) = thetaMin + span * order / levelCount
lower(order > 0) = anchor(order)
```

- [ ] **Step 5: Add validated constraints**

`20260731122000_adaptive_irt_v2_constraints` adds preflight validation, `CHECK`
constraints, composite same-tree/version foreign keys, and required references
after backfill. Follow the repository's `NOT VALID` then `VALIDATE CONSTRAINT`
pattern before making references non-null. Check positive prior SD/grid step,
increasing grid, an approved validation threshold in `[0.8,1)`, finite positive
`a`, finite `b`, `0 <= c < 1`, non-negative counts, one active scale per tree,
and one active publication per config through partial unique indexes. Add
same-tree/from-to ordering constraints for links, creator-reviewer separation,
disjoint calibration/holdout dataset identities, and composite foreign keys
from publication to its exact empirical validation. The internal simulation
suite remains code/CI evidence and has no Prisma model or publication foreign
key.

- [ ] **Step 6: Sync, replay, and verify**

```bash
pnpm run prisma:sync
pnpm --filter @klicker-uzh/prisma check
pnpm --filter @klicker-uzh/prisma build
```

Run the repository migration replay procedure from the
`klicker-data-model` skill against:

- a clean PostgreSQL database, and
- a populated fixture containing NEAREST and MASTERY trees plus v1 attempts.

Expected: no drift; old attempts remain `IRT_V1`; every tree receives one
provisional scale with preserved geometry; every legacy pool/attempt resolves
through an immutable v1 publication; no provisional calibration is
Diagnostic-eligible.

- [ ] **Step 7: Document and commit**

Update `docs/adaptive-learning.md` with scale/calibration ownership, legacy
dispatch, and migration semantics.

```bash
git add packages/prisma apps/analytics docs/adaptive-learning.md
git commit -m "feat(adaptive): persist versioned IRT scales"
```

---

### Task 6: Scale And Calibration Management API

**Files:**

- Create: `packages/graphql/src/services/competenceTreeCalibration.ts`
- Create: `packages/graphql/src/services/competenceTreeCalibrationCommands.ts`
- Create: `packages/graphql/src/services/competenceTreeCalibrationReadModels.ts`
- Create: `packages/graphql/src/services/competenceTreeCalibrationRepository.ts`
- Create: `packages/graphql/src/services/competenceTreeCalibrationArtifact.ts`
- Create: `packages/graphql/src/services/competenceTreeCalibrationExport.ts`
- Create: `packages/graphql/src/schema/competenceTreeCalibration.ts`
- Create: `packages/graphql/test/competenceTreeCalibration.test.ts`
- Create: `packages/graphql/test/competenceTreeCalibrationExport.test.ts`
- Create: `packages/graphql/test/adaptiveEmpiricalValidation.test.ts`
- Modify: `packages/graphql/test/competenceTreeManagement.test.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizArchitecture.test.ts`
- Modify: `packages/graphql/src/services/adaptiveLearningAccountClosure.ts`
- Modify: `packages/graphql/test/adaptiveLearningAccountClosure.test.ts`
- Modify: `packages/graphql/src/types/app.ts`
- Modify: `packages/graphql/src/index.ts`
- Modify: `packages/types/src/hatchet.ts`
- Modify: `packages/hatchet/src/index.ts`
- Create: `packages/graphql/src/graphql/ops/MCreateCompetenceTreeScaleVersion.graphql`
- Create: `packages/graphql/src/graphql/ops/MSubmitCompetenceTreeScaleForReview.graphql`
- Create: `packages/graphql/src/graphql/ops/MReviewCompetenceTreeScale.graphql`
- Create: `packages/graphql/src/graphql/ops/MActivateCompetenceTreeScaleVersion.graphql`
- Create: `packages/graphql/src/graphql/ops/MSubmitCompetenceTreeScaleLink.graphql`
- Create: `packages/graphql/src/graphql/ops/MReviewCompetenceTreeScaleLink.graphql`
- Create: `packages/graphql/src/graphql/ops/MImportAdaptiveItemCalibrations.graphql`
- Create: `packages/graphql/src/graphql/ops/MApproveAdaptiveItemCalibration.graphql`
- Create: `packages/graphql/src/graphql/ops/MSubmitAdaptiveEmpiricalValidation.graphql`
- Create: `packages/graphql/src/graphql/ops/MReviewAdaptiveEmpiricalValidation.graphql`
- Create: `packages/graphql/src/graphql/ops/MRequestAdaptiveCalibrationExport.graphql`
- Create: `packages/graphql/src/graphql/ops/QAdaptiveCalibrationExportRequest.graphql`
- Create: `packages/graphql/src/graphql/ops/QCompetenceTreeCalibration.graphql`
- Create: `packages/graphql/src/graphql/ops/MSetCourseAdaptiveCalibrationCollectionEnabled.graphql`
- Modify: `packages/graphql/src/schema/query.ts`
- Modify: `packages/graphql/src/schema/mutation.ts`
- Modify: `packages/graphql/src/schema/competenceTree.ts`
- Modify: `packages/graphql/src/schema/course.ts`
- Modify: `packages/graphql/test/run-tests-local.sh`
- Modify: `turbo.json`

**Interfaces:**

```ts
export type AdaptiveCalibrationArtifact = {
  schemaVersion: 1
  treeId: string
  scaleVersionId: string
  datasetVersion: string
  datasetChecksum: string
  calibrationJobId: string
  generatedAt: string
  modelImplementationVersion: string
  diagnosticsPolicyVersion: number
  calibrations: Array<{
    assignmentId: number
    elementVersion: number
    model: 'TWO_PL' | 'THREE_PL_FIXED_C'
    discrimination: number
    difficulty: number
    guessing: number
    discriminationStandardError: number | null
    difficultyStandardError: number | null
    responseCount: number
    participantCount: number
    diagnostics: {
      policyVersion: number
      fitStatus: 'PASS' | 'WARN' | 'FAIL'
      difStatus: 'PASS' | 'WARN' | 'FAIL'
      driftStatus: 'PASS' | 'WARN' | 'FAIL'
      fitStatistic: number | null
      difEffect: number | null
      driftEffect: number | null
      holdoutLogLoss: number | null
      codes: string[]
    }
  }>
}

export function createCompetenceTreeScaleVersion(...)
export function submitCompetenceTreeScaleForReview(...)
export function reviewCompetenceTreeScale(...)
export function activateCompetenceTreeScaleVersion(...)
export function submitCompetenceTreeScaleLink(...)
export function reviewCompetenceTreeScaleLink(...)
export function submitAdaptiveItemCalibrationCandidates(...)
export function approveAdaptiveItemCalibration(...)
export function submitAdaptiveEmpiricalValidation(...)
export function reviewAdaptiveEmpiricalValidation(...)
export function requestAdaptiveCalibrationExport(...)
export const handleAdaptiveCalibrationExport: HatchetHandlers['handleAdaptiveCalibrationExport']
export const handleAdaptiveCalibrationExportCleanup: HatchetHandlers['handleAdaptiveCalibrationExportCleanup']
export const handleAdaptiveEmpiricalValidation: HatchetHandlers['handleAdaptiveEmpiricalValidation']
```

- [ ] **Step 1: Add permission-first failing tests**

Cover:

- owner can create a draft scale,
- owner can submit standard-setting evidence but cannot approve their own
  scale, scale link, calibration, or empirical validation,
- only an authorized independent reviewer can approve a scale/link/empirical
  validation, and only an approved scale can become active,
- linked-course writer cannot mutate the tree scale,
- read-only owner cannot mutate,
- tree owner can submit a candidate but cannot mark it `CALIBRATED`,
- only `asAdmin` or the authorized calibration worker can approve a candidate,
- linked-course readers see approved scale/readiness summaries only,
- quiz collaborators cannot read raw parameters or request exports,
- non-owner cannot request or download calibration facts,
- Research override requires tree ownership, course write access, and the
  course calibration-collection gate,
- account closure/ownership transfer preserves tree-owned scale/calibration
  history, nulls non-owning audit actors according to retention policy, and
  invalidates outstanding export URLs,
- import rejects foreign-tree assignment ids,
- import rejects element-version mismatch,
- assignment/calibration operations reject elements the actor cannot access,
- scale submission rejects missing/invalid standard-setting evidence;
  activation rejects invalid cuts/priors or absent approval but does not pretend
  the item bank is calibrated,
- calibration approval rejects flagged diagnostics or a policy-gate failure,
- cross-version trend queries reject absent/unapproved equating links,
- empirical validation rejects overlapping calibration/holdout subject scopes,
  mismatched fingerprints, insufficient strata, or failed confidence-bound
  gates,
- active/published scale cannot be edited, and
- import never accepts raw participant ids or Free Text content.

- [ ] **Step 2: Add artifact validation**

Use Zod already present in GraphQL. Apply `.strict()` at every object level and
reject unknown fields including `participantId`, `response`, `email`,
`username`, and raw Free Text values. Validate model-specific `c`, parameter
bounds, evidence counts, diagnostics policy version, model implementation
version, and exact tree/scale/assignment/element versions. Diagnostics use the
allow-listed typed shape above with finite numeric values and registered codes;
do not persist or echo arbitrary JSON keys or messages from an import.

Define equally strict standard-setting, equating, and empirical-validation
artifacts. Empirical metadata must prove a predeclared disjoint
calibration/holdout split and contain aggregate/per-stratum metrics with sample
counts and confidence bounds only. Raw learner rows are never accepted through
these mutations.

- [ ] **Step 3: Implement transactional management**

Expose `competenceTreeCalibration.ts` as the public facade. Keep commands,
read-model projections, repository locking, artifact validation, and export
selection in the focused modules above. Register only the facade from the
GraphQL schema and add it to the architecture test.

Use existing competence-tree ownership and `FULL_ACCESS` conventions. Reuse
the owner lock from `competenceTreeRepository.ts`. Lock tree, scale, assignment,
and calibration rows before version creation, activation, candidate submission,
or approval. Scale/link/empirical review uses an authorized actor distinct from
the creator/submitter. Activation supersedes the previous active scale only
after structural validation and standard-setting approval pass. Course linkage
never grants owner operations.

- [ ] **Step 4: Add Pothos types and operations**

Expose to authorized owners:

- scale id/version/status,
- level cuts and provisional difficulty priors,
- calibration status/evidence/diagnostic codes,
- standard-setting approval, scale-link comparability, and empirical holdout
  status/evidence summaries,
- item curve parameters only in Research/calibration views,
- candidate submission and administrative approval as separate mutations, and
- export request/status metadata with a short-lived authorized download URL.

Do not return dataset rows through GraphQL and do not add any of these fields
to participant runtime types.

- [ ] **Step 5: Implement the allow-listed export job**

The request mutation creates an `AdaptiveCalibrationExportRequest` and enqueues
`adaptive-calibration-export` through Hatchet. The worker handler:

1. re-authorizes the immutable tree/scale request,
2. pages records using the batching pattern in
   `adaptivePracticeQuizCohort.ts`,
3. derives the subject id with a server-side HMAC scoped to tree plus dataset
   version, stable across linked courses within that export but unlinkable
   across unrelated trees/datasets; derive the cohort key separately, then use
   the publication's predeclared split-policy HMAC to assign each subject to
   calibration or holdout before any outcome analysis,
4. selects only those pseudonyms, immutable versions, canonical
   score/category, correctness, permitted elapsed time, anchor role,
   conditional administration probability, collection-design version, and
   pseudonymous course cohort key,
5. keeps only the participant's first exposure to each exact assignment and
   element version so Research feedback/retakes cannot contaminate calibration,
6. never selects participant identity, raw response JSON, Free Text content,
   solutions, or rosters,
7. writes disjoint versioned calibration and sealed-holdout compressed NDJSON
   artifacts plus manifests to a private/encrypted Azure Blob container, stores
   only opaque keys/checksums/row counts, and prevents the owner calibration
   download from accessing the sealed holdout,
8. marks failures with a non-sensitive code.

Use the existing Azure SDK dependency. Add narrowly named
`ADAPTIVE_CALIBRATION_EXPORT_*` and
`ADAPTIVE_CALIBRATION_PSEUDONYM_HMAC_KEY` environment variables to `turbo.json`;
document their Infisical ownership later in Task 12. Signed download access is
owner/admin-only, short-lived, audited, and unavailable after expiry. Tests
prove pseudonym stability within one dataset, rotation across scopes, and
absence of raw database ids.

The calibration artifact is owner/reviewer accessible; the sealed holdout is
available only to the authorized empirical-validation worker/reviewer. Split
policy/version and both manifest checksums are immutable before calibration
candidate submission.

`handleAdaptiveEmpiricalValidation` runs in the authorized worker context,
opens the sealed holdout plus the separately governed predeclared criterion
reference, replays the frozen estimator/policy, and persists only aggregate
overall/per-stratum metrics and confidence bounds. The public repository,
GraphQL API, tree owner, and quiz collaborator never receive criterion or
holdout subject rows. Independent review is still required before status
`APPROVED`.

For Numerical and Free Text, export only canonical score/correctness, never the
normalized or raw entered value. Choice response categories may be exported
only as index/category codes against the immutable element version, without
choice text or answer keys.

Register a daily idempotent cleanup task that deletes expired blobs before
marking requests `EXPIRED`. Retry deletion safely, alert on retention failures,
and ensure a failed cleanup never issues a fresh download URL.

- [ ] **Step 6: Generate and test**

First change `run-tests-local.sh` from forwarding only `${1:-}` to
`pnpm test "$@"`, with the zero-argument path still running the complete suite.
This makes every focused multi-file command in this plan execute all listed
files.

```bash
pnpm --filter @klicker-uzh/graphql generate
pnpm --filter @klicker-uzh/graphql test:local -- competenceTreeCalibration.test.ts competenceTreeCalibrationExport.test.ts adaptiveEmpiricalValidation.test.ts competenceTreeManagement.test.ts adaptiveLearningAccountClosure.test.ts adaptivePracticeQuizArchitecture.test.ts
pnpm --filter @klicker-uzh/hatchet check
pnpm --filter @klicker-uzh/graphql check
```

Expected: permission, strict-artifact, first-exposure export, transaction,
expiry, and redaction tests pass; codegen leaves only intentional artifacts.

- [ ] **Step 7: Commit**

```bash
git add packages/graphql packages/types packages/hatchet turbo.json
git commit -m "feat(adaptive): manage IRT scales and calibrations"
```

---

### Task 7: V2 Configuration, Readiness, And Publication

**Files:**

- Modify: `packages/graphql/src/services/adaptivePracticeQuizConfigPreparation.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizConfigViews.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizReadinessTypes.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizReadiness.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizReachability.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizPublication.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizPublicationAuthorization.ts`
- Modify: `packages/graphql/src/schema/adaptivePracticeQuiz.ts`
- Modify: `packages/graphql/src/schema/mutation.ts`
- Modify: `packages/graphql/src/index.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizConfig.test.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizReadiness.test.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizzes.test.ts`
- Create: `packages/graphql/test/adaptivePracticeQuizSimulationBoundary.test.ts`

**Interfaces:**

Extend `AdaptivePracticeQuizConfigInput` with:

```ts
scaleVersionId?: string
```

The public input never accepts an estimator implementation string. Existing
configs without a scale stay `IRT_V1`; selecting a v2 scale through the
calibrated workflow causes the server to snapshot the one supported
`IRT_V2_EAP_GRID_1` implementation.

Add readiness codes:

```ts
ADAPTIVE_V2_SCALE_REQUIRED
ADAPTIVE_V2_SCALE_NOT_ACTIVE
ADAPTIVE_V2_CALIBRATION_MISSING
ADAPTIVE_V2_CALIBRATION_VERSION_MISMATCH
ADAPTIVE_V2_CALIBRATION_FLAGGED
ADAPTIVE_V2_RESEARCH_ANCHORS_REQUIRED
ADAPTIVE_V2_RESEARCH_DESIGN_DISCONNECTED
ADAPTIVE_V2_INFORMATION_GAP
ADAPTIVE_V2_CUT_SCORE_UNREACHABLE
ADAPTIVE_V2_EMPIRICAL_VALIDATION_REQUIRED
ADAPTIVE_V2_EMPIRICAL_VALIDATION_STALE
ADAPTIVE_V2_EMPIRICAL_VALIDATION_FAILED
ADAPTIVE_V2_PLACEMENT_UNAVAILABLE
```

- [ ] **Step 1: Add failing configuration tests**

Assert:

- v1 config remains valid without a scale id,
- v2 Diagnostic requires an active scale,
- unapproved standard-setting evidence or a missing empirical holdout approval
  blocks Diagnostic,
- v2 Placement always returns `ADAPTIVE_V2_PLACEMENT_UNAVAILABLE`,
- v2 Research permits provisional items but is non-classifying and requires the
  separate course calibration-collection gate,
- two linked courses can publish against the same reusable tree/scale while
  keeping course-specific readiness and DIF cohort keys,
- ordinary authors cannot override raw `a/b/c` or classification threshold,
- no config/start/submit request can provide an estimator version,
- v2 fixes attempt selection to `LATEST_COMPLETED` and rejects a conflicting
  legacy policy,
- scale/tree mismatch is rejected, and
- publication rejects stale, foreign, inaccessible, or unsupported element
  snapshots even when an assignment id exists,
- cross-version trend/result comparison remains disabled without an approved
  scale link,
- config locking prevents changing model or scale after an attempt.

- [ ] **Step 2: Add calibrated readiness tests**

Build fixtures for missing, pilot, calibrated, flagged, stale-element-version,
cut-score-gap, sparse-information, and passing banks. Assert exact issue codes
and structured parameters.

- [ ] **Step 3: Implement v2 effective pool resolution**

For each assignment:

1. resolve the exact element version,
2. resolve the selected scale level and provisional prior,
3. resolve the latest approved calibration for that exact assignment/version,
4. determine model and Diagnostic eligibility,
5. apply structural enablement and quiz overrides, and
6. compute information across the scale/cut grid.

Do not fall back from a stale calibration to a different element version.
The existing `CoverageMatrix` remains the content-blueprint check and is not
treated as psychometric readiness.

- [ ] **Step 4: Implement readiness gates**

Diagnostic `ready` requires every effective scoring item to be calibrated and
all approved deterministic information/reachability gates to pass. The
classification threshold comes from the immutable code-owned policy version
that passed the internal simulation suite before deployment; there is no
per-quiz simulation state, trigger, report, or readiness code.

Diagnostic also requires an independently `APPROVED` empirical validation with
the same fingerprint/policy, predeclared disjoint calibration/holdout data, and
all overall/per-stratum confidence-bound gates passing. A synthetic simulation
can never substitute for standard-setting or pilot holdout evidence.

Research reports provisional items and information gaps as expected
non-classifying diagnostics, and fails authorization unless the actor owns the
tree, can write the course, and the course calibration-collection flag is
enabled. It also requires calibrated anchor coverage connecting every enabled
root/leaf and scale band, plus a versioned randomized field-test design with
bounded inclusion probabilities. Research cannot collect a publishable
calibration dataset from provisional-only or disconnected pools.

- [ ] **Step 5: Enforce the internal-only simulation boundary**

Do not add a simulation/bank-validation GraphQL query or mutation, Hatchet task,
Prisma request model, frontend operation, readiness field, or runtime import.
Add `adaptivePracticeQuizSimulationBoundary.test.ts` to inspect the public
schema and package imports and assert that it contains no simulation trigger,
status, seed, trace, metric, report checksum, or bank-validation operation.
Also assert that ordinary authors, tree owners, course owners, participants,
and admins cannot invoke simulation through GraphQL because no such operation
exists. Internal engineers run Task 4's package scripts or CI workflow only.

- [ ] **Step 6: Snapshot v2 publication identity**

Within the existing publication transaction, lock the selected scale and exact
calibration rows, create the immutable `PracticeQuizAdaptivePublication`
header, then create its pool rows. Copy:

- scale version and explicit cuts,
- measurement implementation version,
- classification threshold fixed by the internally simulation-gated,
  code-owned classification policy plus its version/credible mass,
- calibration id/model/`a/b/c`,
- anchor/field-test role and planned administration probability,
- item and element versions,
- hierarchical effective weights, and
- whether the item contributes to the estimate,
- evidence minima and total/root/node/leaf caps,
- candidate-set, randomization, exposure, overlap, and retake settings,
- Research anchor/field-test allocation and collection-design version, and
- predeclared calibration/holdout split-policy version, and
- exact selection/stopping policy versions.

Retain all current source authorization, row locks, immutable pool behavior,
immediate-publication restriction, and attempt lock. Reject Placement and
uncalibrated Diagnostic publication. Never replace or delete a v1 publication
that has attempts; a newly materialized pool receives a new publication
version. The publication header also references the exact passed bank
validation and approved empirical validation, and verifies both fingerprints
again while holding publication locks.

- [ ] **Step 7: Test, generate, and commit**

```bash
pnpm --filter @klicker-uzh/graphql generate
pnpm --filter @klicker-uzh/graphql test:local -- adaptivePracticeQuizConfig.test.ts adaptivePracticeQuizReadiness.test.ts adaptivePracticeQuizzes.test.ts
pnpm --filter @klicker-uzh/hatchet check
pnpm --filter @klicker-uzh/graphql check
git add packages/graphql packages/types packages/hatchet
git commit -m "feat(adaptive): publish calibrated IRT pools"
```

---

### Task 8: Runtime Version Dispatch And Research Shadow Path

**Files:**

- Create: `packages/graphql/src/services/adaptivePracticeQuizEstimatorVersions.ts`
- Create: `packages/graphql/src/services/adaptivePracticeQuizRuntimeV2.ts`
- Create: `packages/graphql/src/services/adaptivePracticeQuizShadow.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizRuntimeData.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizRuntime.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizCommands.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizRepository.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizEvents.ts`
- Modify: `packages/graphql/src/schema/adaptivePracticeQuizRuntime.ts`
- Modify: `packages/graphql/src/graphql/ops/MSubmitAdaptivePracticeQuizResponse.graphql`
- Modify: `packages/graphql/test/adaptivePracticeQuizRuntime.test.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizEvents.test.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizRepository.test.ts`

**Interfaces:**

```ts
export type LoadedAdaptiveRuntime =
  | { measurementVersion: 'IRT_V1'; algorithm: PreparedAdaptiveRuntime }
  | {
      measurementVersion: 'IRT_V2_EAP_GRID_1'
      algorithm: PreparedAdaptiveV2Runtime
    }

export function advanceLoadedAdaptiveRuntime(input: {
  attemptId: string
  runtime: LoadedAdaptiveRuntime
  responses: AdaptiveRuntimeResponse[]
}): AdaptiveRuntimeDecisionV1 | AdaptiveV2Decision
```

- [ ] **Step 1: Add dispatch and immutability tests**

Cover:

- v1 pool starts and resumes through unchanged v1 code,
- v2 pool starts through EAP,
- v1 and v2 share the same server-side canonical grading for Numerical, SC,
  MC, KPRIM, and Free Text,
- Numerical decimal/fraction/percent normalization is deterministic and rejects
  ambiguous, non-finite, disabled-percent, and out-of-range input,
- requests cannot submit `score` or `correct`,
- resume preserves the active attempt/publication, start-over abandons only an
  in-progress attempt, and a completed retake obeys `resetTimeDays`,
- attempt version wins over newly edited configuration,
- model/scale mismatch fails closed,
- no request field can choose the estimator,
- concurrent duplicate submit remains idempotent/rejected as today, and
- concurrent starts/submits increment exposure exactly once,
- exposure ceilings and prior-attempt overlap affect only eligible selection
  and never alter item parameters or posterior likelihoods,
- non-finite posterior state rolls back the submit transaction.

- [ ] **Step 2: Add Research behavior tests**

Research attempts:

- may deliver provisional field-test items,
- exclude them from theta updates,
- maintain calibrated anchor coverage for design identifiability,
- persist their canonical score/category,
- persist anchor role, conditional administration probability, and collection
  design version,
- return `RESEARCH_ONLY`,
- never set `finalLevelId`, and
- emit no student-facing proficiency result.

The submit mutation may return ordinary per-response practice feedback only
after that response is durably scored. Reuse the existing safe feedback
projection and allow correctness, canonical score, and authored feedback for
the submitted answer; omit answer keys, sample solutions, item parameters, and
future-item data. Calibration export eligibility uses only the participant's
first exposure to the exact item version.

- [ ] **Step 3: Add shadow-comparison tests**

For eligible v1 research attempts, compute v2 in shadow without changing
delivery or result. Emit aggregate-safe differences:

```ts
{
  type: 'adaptive_irt_shadow_computed',
  publicationId,
  scaleVersionId,
  differenceBucket,
  v1LevelOrder,
  v2LeadingLevelOrder,
}
```

Operational serialization must not contain participant identity, response
content, attempt id, or item solutions.

- [ ] **Step 4: Implement versioned runtime loading**

Load by immutable publication and attempt identity, then load snapshotted
scale/calibration/model fields from that publication's pool rows. Validate
every v2 pool row before preparing the runtime. Keep v1 conversion helpers
unchanged and move v2 conversion into the new adapter. Load every effective
runtime setting exclusively from the publication header; mutable quiz config,
tree weights, policy constants, and current calibration rows are never runtime
fallbacks for an existing attempt.

`adaptivePracticeQuizEstimatorVersions.ts` is the only GraphQL dispatcher:

- `IRT_V1` calls the frozen current MLE/MAP and legacy mapping behavior,
- `IRT_V2_EAP_GRID_1` calls EAP, explicit cuts, posterior routing, and
  probability classification, and
- unknown or internally inconsistent versions fail closed before delivery or
  persistence.

Load row-locked publication exposure counters and the participant's prior exact
assignment/version exposures before selection. Supply exposure eligibility,
pool-utilization deficit, and retake-overlap penalty to the package selector.
Increment `servedCount` only when a newly selected item is durably assigned as
`nextPoolItem`, and increment `answeredCount` only with the corresponding
response. Resume/replay paths never increment either counter.

- [ ] **Step 5: Persist posterior summaries atomically**

On each successful v2 submit, store:

- overall posterior mean/SD and credible bounds,
- overall band-probability JSON,
- node posterior summaries,
- classified level only when threshold reached,
- classification probability,
- result status and stop reason, and
- next server-selected pool item.

Reuse the existing serializable transaction/retry boundary.

Validate integrity before evaluating a normal stop. For a valid runtime, v2
stopping order is: all required roots classified, total cap, pool exhaustion,
then node/leaf caps. An integrity/configuration failure aborts continuation and
cannot produce a classification. Every non-classification terminal reason
retains posterior summaries but stores `finalLevelId = null`.

- [ ] **Step 6: Test and commit**

```bash
pnpm --filter @klicker-uzh/graphql test:local -- adaptivePracticeQuizRuntime.test.ts adaptivePracticeQuizRepository.test.ts adaptivePracticeQuizEvents.test.ts
pnpm --filter @klicker-uzh/graphql check
git add packages/graphql
git commit -m "feat(adaptive): dispatch Bayesian runtime versions"
```

---

### Task 9: Participant And Anonymous Cohort Result Contracts

**Files:**

- Modify: `packages/graphql/src/services/adaptivePracticeQuizParticipantViews.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizParticipantQueries.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizCohortAggregation.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizCohort.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizPrivacy.ts`
- Modify: `packages/graphql/src/schema/adaptivePracticeQuizRuntime.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizRuntimeSchema.test.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizPrivacy.test.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizzes.test.ts`
- Modify: `packages/graphql/src/graphql/ops/FAdaptivePracticeQuizAttemptState.graphql`
- Modify: `packages/graphql/src/graphql/ops/QAdaptivePracticeQuizResult.graphql`
- Modify: `packages/graphql/src/graphql/ops/QAdaptivePracticeQuizCohortResults.graphql`

**Interfaces:**

Replace v2 confidence inference with:

```ts
export type AdaptiveResultClassification =
  | 'CLASSIFIED'
  | 'BETWEEN_LEVELS'
  | 'INSUFFICIENT_EVIDENCE'
  | 'POOL_LIMITED'
  | 'RESEARCH_ONLY'

export type AdaptiveResultView = {
  classification: AdaptiveResultClassification
  levelLabel: string | null
  leadingLevelLabels: string[]
  classificationProbability: number | null
  position: number | null
  lowerPosition: number | null
  upperPosition: number | null
}
```

- [ ] **Step 1: Add participant redaction tests**

The participant-facing adaptive attempt/result object types and the generated
participant operations must not contain fields matching:

```ts
;[
  'theta',
  'standardError',
  'posterior',
  'bandProbabilities',
  'difficulty',
  'discrimination',
  'guessing',
  'calibrationId',
  'scaleVersionId',
  'solution',
]
```

Normalized chart positions, student-safe classification probability, and level
labels are allowed. Owner-only calibration schema types may use psychometric
field names, but participant resolvers cannot return or resolve them.

- [ ] **Step 2: Add result-state tests**

Assert exact payloads for:

- classified,
- between adjacent levels,
- insufficient evidence,
- pool limited,
- Research-only,
- nested classified/uncertain mix,
- v1 legacy result, and
- v2 trajectory with credible bounds whose endpoint exactly matches the stored
  overall final summary/classification.

- [ ] **Step 3: Implement versioned serialization**

Keep the current v1 serializer for old attempts. For v2:

- use explicit snapshotted bands,
- map credible bounds to chart positions,
- include a level label only for classified nodes,
- expose up to two leading adjacent labels for uncertainty,
- expose classification probability as the winning-band mass for `CLASSIFIED`,
  the combined adjacent-band mass for `BETWEEN_LEVELS`, and `null` otherwise,
- use the stored result status, and
- produce the trajectory from stored posterior summaries.

For `RESEARCH_ONLY`, return no position, interval, probability, or leading
level. Return the safe submitted-response feedback contract from Task 8
separately from the proficiency result.

- [ ] **Step 4: Extend anonymous cohort aggregation**

Add released counts for classified, between-level, insufficient, pool-limited,
and Research-only outcomes. Include nested distributions only after current
small-cell and complementary suppression. Do not expose mean theta or raw
probabilities.

For v2, personal results and each fixed cohort release select the latest
completed eligible attempt at the release watermark. Persist that policy in the
publication and cohort snapshot; do not recompute an old release when a learner
later retakes. Calibration selection remains first exact-item exposure and is
independent of result selection.

Keep releases partitioned by scale version. Trend/comparison views may combine
versions only when an approved direct linking/equating path exists; otherwise
show separate labeled releases and an explicit non-comparable state.

- [ ] **Step 5: Generate, test, and commit**

```bash
pnpm --filter @klicker-uzh/graphql generate
pnpm --filter @klicker-uzh/graphql test:local -- adaptivePracticeQuizRuntimeSchema.test.ts adaptivePracticeQuizPrivacy.test.ts adaptivePracticeQuizzes.test.ts
pnpm --filter @klicker-uzh/graphql check
git add packages/graphql
git commit -m "feat(adaptive): expose honest Bayesian results"
```

---

### Task 10: Manage Scale, Calibration, And Item-Bank UX

**Files:**

- Create: `apps/frontend-manage/src/components/resources/competenceTrees/ScaleVersionPanel.tsx`
- Create: `apps/frontend-manage/src/components/resources/competenceTrees/CalibrationStatus.tsx`
- Create: `apps/frontend-manage/src/components/resources/competenceTrees/ItemBankMap.tsx`
- Create: `apps/frontend-manage/src/components/resources/competenceTrees/itemBankMap.ts`
- Create: `apps/frontend-manage/test/itemBankMap.test.ts`
- Modify: `apps/frontend-manage/src/components/resources/competenceTrees/CompetenceTreeEditor.tsx`
- Modify: `apps/frontend-manage/src/components/resources/competenceTrees/MetadataEditor.tsx`
- Modify: `apps/frontend-manage/src/components/resources/competenceTrees/LevelEditor.tsx`
- Modify: `apps/frontend-manage/src/components/resources/competenceTrees/AssignmentTable.tsx`
- Modify: `apps/frontend-manage/src/components/resources/competenceTrees/CoverageMatrix.tsx`
- Modify: `apps/frontend-manage/src/components/elements/manipulation/adaptive/AdaptiveMappingFields.tsx`
- Modify: `apps/frontend-manage/src/components/elements/manipulation/adaptive/types.ts`
- Modify: `apps/frontend-manage/src/components/activities/creation/WizardLayout.tsx`
- Modify: `apps/frontend-manage/src/components/activities/creation/practiceQuiz/AdaptivePracticeQuizSetupStep.tsx`
- Modify: `apps/frontend-manage/src/components/activities/creation/practiceQuiz/AdaptiveAssignmentPreview.tsx`
- Modify: `apps/frontend-manage/src/components/activities/creation/practiceQuiz/AdaptiveReadinessPanel.tsx`
- Modify: `apps/frontend-manage/src/components/activities/creation/practiceQuiz/PracticeQuizSettingsStep.tsx`
- Modify: `apps/frontend-manage/src/components/activities/creation/practiceQuiz/adaptiveReadinessIssue.ts`
- Modify: `apps/frontend-manage/src/components/courses/modals/PracticeQuizPublishingModal.tsx`
- Modify: `packages/graphql/src/graphql/ops/FCompetenceTreeData.graphql`
- Modify: `packages/graphql/src/graphql/ops/FCompetenceTreeSummaryData.graphql`
- Modify: `packages/graphql/src/graphql/ops/FAdaptivePracticeQuizPreviewData.graphql`
- Modify: `packages/graphql/src/graphql/ops/FAdaptivePracticeQuizReadinessData.graphql`
- Modify: `packages/graphql/src/graphql/ops/QPracticeQuizPublicationPreview.graphql`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:**

- `ItemBankMap` consumes only owner-safe scale/calibration/readiness data.
- Normal assignment forms continue to submit tree, leaf, expected difficulty
  level, enabled state, and type-specific settings; they do not submit raw
  parameters.

- [ ] **Step 1: Add pure item-bank-map tests**

Test conversion of explicit cuts, calibrated item positions, flagged items,
missing cut neighborhoods, and exposure categories into chart data. Keep this
logic out of React components.

- [ ] **Step 2: Update element mapping language**

Rename the visible level field to `Expected item difficulty`. Add a tooltip that
states it is the initial estimate used until calibration. Replace visible raw
`a/b/c` values for normal authors with `CalibrationStatus`. Keep the
pre-first-save assignment workflow for Numerical, SC, MC, KPRIM, and Free Text;
unsupported element types never show competence-tree controls.

In `MetadataEditor`, remove editable theta range, legacy mapping rule, and
default discrimination from the normal workflow. Move explicit bands/cuts and
provisional priors into `ScaleVersionPanel`; keep legacy values read-only only
when rendering `IRT_V1` history.

- [ ] **Step 3: Add scale-version panel**

Owners can:

- inspect draft/active/superseded versions,
- create a draft from current levels,
- edit draft cuts and priors with numeric controls,
- attach strict standard-setting evidence and submit for independent review,
- inspect scale-link/equating and empirical holdout approval status,
- export calibration facts,
- import a strict calibration artifact, and
- activate only when backend validation passes.

Locked/linked readers receive a read-only readiness summary.
Scale creators never receive reviewer controls for their own submissions.
Creating a competence or nested subcompetence continues to use explicit plus
actions at the intended parent (up to depth 5); duplicate remains a separate
copy action.

- [ ] **Step 4: Add the item-bank map**

Use Recharts already present. Render:

- one horizontal theta axis,
- vertical cut-score lines,
- item marks colored by calibration status and shaped by element type,
- an information-coverage overlay,
- accessible table fallback, and
- no nested cards.

Add `data-cy` hooks for scale selector, cut score, calibration status, import,
export, and each blocking gap. Stable cross-layer selectors are:

```text
adaptive-calibration-status-{assignmentId}
adaptive-item-bank-map
adaptive-research-non-classifying
```

Keep `CoverageMatrix` as the content-blueprint view only and label it
accordingly; it must not imply calibration readiness.

- [ ] **Step 5: Integrate calibrated readiness**

The adaptive wizard must:

- default new v2 quizzes to Diagnostic,
- require an active scale,
- show standard-setting and empirical holdout approval alongside deterministic
  calibration and information-coverage readiness,
- show calibrated/provisional/flagged counts,
- remove Placement from selectable presets and render it as unavailable in
  legacy/edit contexts,
- explain Research non-classification, and
- map every new backend issue code to paired English/German copy.

`PracticeQuizSettingsStep` and `WizardLayout` expose only the selected scale
and approved presets, not z thresholds, mapping rules, default `a`, or raw
parameters. `PracticeQuizPublishingModal` re-fetches mode-specific readiness,
blocks stale Diagnostic publication, and requires an explicit Research
non-classifying/data-collection confirmation.
No simulation action, status, metrics, report, seed, or trace appears anywhere
in Manage. Disable publication only for user-actionable calibration,
information-coverage, standard-setting, empirical-validation, or configuration
readiness failures.

- [ ] **Step 6: Verify Manage**

```bash
pnpm --filter @klicker-uzh/frontend-manage test:run
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-manage build
```

Run `npx agent-browser` against the real Manage app at desktop and mobile
viewports. Verify create/edit assignment, draft scale, calibration import error,
item-bank gaps, passing readiness, linked read-only tree, and German copy.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend-manage packages/i18n
git commit -m "feat(manage): add calibrated item-bank workflow"
```

---

### Task 11: Student Bayesian Result Experience

**Files:**

- Modify: `apps/frontend-pwa/src/components/practiceQuiz/adaptive/AdaptivePracticeQuiz.tsx`
- Modify: `apps/frontend-pwa/src/components/practiceQuiz/adaptive/AdaptivePracticeQuizIntro.tsx`
- Modify: `apps/frontend-pwa/src/components/practiceQuiz/adaptive/AdaptivePracticeQuizQuestion.tsx`
- Modify: `apps/frontend-pwa/src/components/practiceQuiz/adaptive/AdaptivePracticeQuizResult.tsx`
- Modify: `apps/frontend-pwa/src/components/practiceQuiz/adaptive/AdaptiveResultTrajectoryChart.tsx`
- Modify: `apps/frontend-pwa/src/components/practiceQuiz/adaptive/AdaptiveCompetenceProfile.tsx`
- Create: `apps/frontend-pwa/src/components/practiceQuiz/adaptive/AdaptiveNextSteps.tsx`
- Modify: `packages/adaptive-learning/src/presentation.ts`
- Modify: `packages/adaptive-learning/test/presentation.test.ts`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:**

- Consumes the participant-safe `AdaptiveResultClassification` GraphQL
  contract from Task 9.
- Preserves v1 result rendering for legacy attempts.

- [ ] **Step 1: Add presentation tests**

Cover:

- classified band,
- between two adjacent levels,
- insufficient evidence,
- pool limited,
- Research-only,
- nested mixed states,
- credible trajectory ribbon, and
- no level label synthesized from a position,
- classified versus uncertain formative next-step copy.

- [ ] **Step 2: Replace confidence heuristics with classification states**

`AdaptivePracticeQuizResult` switches explicitly on `classification`. It must
not infer classification from stop reason, position, or interval width.
Add stable selectors `adaptive-result-state-{state}` for `CLASSIFIED`,
`BETWEEN_LEVELS`, `INSUFFICIENT_EVIDENCE`, `POOL_LIMITED`, and
`RESEARCH_ONLY`.

- [ ] **Step 3: Update trajectory chart**

Keep one overall line over response order with a credible ribbon. Each point is
the deterministic weighted convolution of top-level competence posteriors, so
competences and nested subcompetences contribute through the approved
hierarchical weights without double counting. Bands come from explicit
snapshot boundaries and the axis uses student-safe normalized band positions,
not theta. Add an accessible description/table and ensure null early points do
not connect across missing evidence.

- [ ] **Step 4: Update nested profile**

Each node shows:

- classified level,
- between-level labels, or
- an explicit evidence limitation.

Do not connect unrelated nodes into a line or hide uncertain leaves behind the
overall composite.

Add formative next steps that distinguish lower classified bands from uncertain
evidence: suggest further practice for a classified weaker competence and
another attempt/more evidence for an uncertain competence. Use competence names
and existing Practice Quiz/course navigation only; do not diagnose a learner,
rank them against peers, or treat an uncertain estimate as a weakness.

- [ ] **Step 5: Update intro and progress**

V2 Diagnostic copy explains adaptive evidence collection without promising a
fixed length. Research copy explains that no proficiency classification will be
returned. `AdaptivePracticeQuizQuestion` replaces “Question N, at most M” with
completed evidence/blueprint coverage language; it never exposes live theta, a
live level, or a false fixed-length percentage.

Before starting, disclose that submitted answers are final/no-backtracking,
resume continues the same versioned attempt, start-over abandons current
progress, retakes follow the Practice Quiz cooldown, and results are formative
rather than placement decisions. Research additionally states what
pseudonymous scoring/elapsed-time facts may be used for calibration, that raw
Free Text/Numerical entries and identity are excluded, the applicable retention
notice/link, and that no proficiency result is produced.

Research renders the safe per-response feedback from Task 8 after submission
and a non-classifying completion summary. It never renders the trajectory,
level-band result, answer key, or sample solution.

- [ ] **Step 6: Verify PWA**

```bash
pnpm --filter @klicker-uzh/adaptive-learning test
pnpm --filter @klicker-uzh/frontend-pwa check
pnpm --filter @klicker-uzh/frontend-pwa build
```

Use `npx agent-browser` with a seeded participant to verify v1 legacy,
classified, between-level, insufficient, pool-limited, and Research-only
results in English/German at desktop/mobile sizes. Confirm no overlap and no
root horizontal overflow.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend-pwa packages/adaptive-learning packages/i18n
git commit -m "feat(pwa): present Bayesian adaptive results"
```

---

### Task 12: Lecturer Cohort, Calibration Diagnostics, And Operations

**Files:**

- Create: `apps/frontend-manage/src/components/evaluation/adaptive/AdaptiveCalibrationHealth.tsx`
- Modify: `apps/frontend-manage/src/components/evaluation/adaptive/AdaptivePracticeQuizEvaluation.tsx`
- Modify: `apps/frontend-manage/src/components/evaluation/adaptive/AdaptiveCompetenceDistributions.tsx`
- Modify: `apps/frontend-manage/src/components/evaluation/adaptive/AdaptivePilotMetrics.tsx`
- Modify: `apps/frontend-manage/src/components/evaluation/adaptive/types.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizDiagnostics.ts`
- Modify: `packages/graphql/src/services/adaptivePracticeQuizEvents.ts`
- Modify: `packages/graphql/src/schema/adaptivePracticeQuizRuntime.ts`
- Modify: `packages/graphql/src/graphql/ops/QAdaptivePracticeQuizCohortResults.graphql`
- Modify: `packages/graphql/test/adaptivePracticeQuizEvents.test.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizPrivacy.test.ts`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`
- Modify: `docs/adaptive-learning-operations.md`

**Interfaces:**

- Anonymous cohort fields remain governed by
  `ADAPTIVE_PRIVACY_MIN_CELL_SIZE` and fixed-release snapshots.
- Calibration health is owner-only and contains aggregate item evidence, not
  participant-level records.

- [ ] **Step 1: Add privacy and event tests**

Assert that new classification, exposure, drift, and calibration metrics obey
small-cell/complementary suppression and that operational events contain no
participant identity or raw response.

- [ ] **Step 2: Extend evaluation summaries**

Add classified, between-level, insufficient, pool-limited, and Research-only
distributions. Keep nested competence distributions and stop/test-length
summaries.

- [ ] **Step 3: Add calibration-health view**

Show:

- calibrated/pilot/provisional/flagged counts,
- parameter uncertainty warnings,
- fit/DIF/drift codes,
- exposure ceiling and underuse,
- model/scale/policy versions, and
- last approved calibration timestamp,
- standard-setting/empirical approval provenance, and
- scale-link comparability status for historical trends.

Use accessible tables and restrained charts; no participant rows.
Use `data-cy="adaptive-evaluation-bank-health"` for the owner-only surface.
Course collaborators receive the readiness summary without item parameters,
dataset links, or calibration history.

- [ ] **Step 4: Add operational metrics and alerts**

Document and emit counters for starts, completions, abstention, classification,
length, exposure, estimator failures, stale calibration, and shadow
differences, plus calibration export queue age/failure/expiry. Add alert
conditions from the design specification. The internal simulation suite reports
gate regressions only in CI/release tooling; it emits no user-visible runtime
status or queue metrics. Document the v2 start kill switch, the separate course
calibration-collection flag, the dedicated export-storage secrets, rollback
without historical rewrites, and the owner/admin audit trail.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @klicker-uzh/graphql test:local -- adaptivePracticeQuizEvents.test.ts adaptivePracticeQuizPrivacy.test.ts
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-manage build
git add apps/frontend-manage packages/graphql packages/i18n docs/adaptive-learning-operations.md
git commit -m "feat(adaptive): add calibration health monitoring"
```

Use browser verification for suppressed/released cohorts, owner calibration
health, English/German, and mobile/desktop.

---

### Task 13: Seeds, End-To-End Evidence, Documentation, And Rollout Gate

**Files:**

- Modify: `packages/prisma-data/src/data/seedTEST.ts`
- Modify: `playwright/tests/Z-adaptive-learning.spec.ts`
- Modify: `playwright/tests/Z-adaptive-learning-release.spec.ts`
- Modify: `playwright/util/adaptive-release-fixtures.ts`
- Create: `playwright/util/accessibility.ts`
- Modify: `playwright/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `docs/adaptive-learning.md`
- Modify: `docs/adaptive-learning-operations.md`
- Modify: `packages/adaptive-learning/reports/simulation-summary.md`
- Modify: `packages/adaptive-learning/reports/simulation-report.json`
- Modify: `.github/workflows/test-adaptive-learning.yml`
- Add screenshots under: `project/screenshots/adaptive-learning-irt-v2/`

**Interfaces:**

- The seed provides separate immutable v1 legacy, v2 Research, v2 calibrated
  Diagnostic, and v2 uncertain/cut-boundary fixtures.

- [ ] **Step 1: Extend deterministic seed data**

Create:

- an active three-band scale version,
- deterministic test-only standard-setting and empirical-holdout approval
  records,
- calibrated exact-version pool items spanning interiors and both cut scores,
- provisional Research field-test items,
- one legacy v1 published quiz,
- one v2 Research quiz,
- one publish-ready v2 Diagnostic quiz,
- classified and uncertain historical attempts for anonymous evaluation, and
- a participant with no prior v2 attempt for live E2E delivery.

Do not fabricate production-like claims in seed calibration diagnostics; label
all data as deterministic test fixtures.
Update `playwright/util/adaptive-release-fixtures.ts` so tests create explicit
scale versions, exact-version provisional/calibrated items, immutable
publication headers, and each v2 result state without reaching into mutable
legacy config fields.

- [ ] **Step 2: Add Playwright authoring and publication journeys**

Cover:

- create element and assign expected difficulty before first save,
- submit scale standard-setting evidence and enforce independent approval,
- inspect calibration state,
- reject provisional Diagnostic publication,
- import/activate fixture calibration,
- reject a stale empirical-validation fingerprint after changing a weight or
  cap,
- require a matching approved empirical holdout artifact,
- require the course calibration-collection gate for Research,
- publish calibrated Diagnostic,
- block Placement, and
- publish Research as non-classifying, and
- verify that no simulation trigger, status, report, seed, metrics, or traces
  are present in the authoring or publication UI.

- [ ] **Step 3: Add Playwright participant journeys**

Cover:

- v1 legacy result unchanged,
- v2 resume and duplicate-submit integrity,
- start-over/cooldown/latest-completed retake semantics and immutable fixed
  cohort releases,
- all five supported item types,
- classified result,
- between-level result,
- pool-limited/insufficient result,
- Research-only completion,
- Research per-response feedback without an answer key,
- English/German, and
- desktop/mobile.

- [ ] **Step 4: Add lecturer/privacy journeys**

Cover:

- suppressed small cohort,
- released fixed cohort,
- uncertain outcome buckets,
- nested competence distributions,
- calibration-health owner access,
- linked-course reader redaction, and
- no raw posterior/parameter fields in participant network payloads.

Capture the competence-tree library/editor and item-bank map, element
pre-first-save assignment, adaptive Practice Quiz setup/readiness/publication,
participant intro/question/result states, anonymous cohort results, and
owner-only calibration health at representative desktop/mobile viewports.

Add direct `axe-core` dev dependency pinned to `4.11.4` and a small Playwright
helper that injects `axe.min.js` and fails on serious/critical violations. Run it
on each changed authoring, question, result-state, cohort, and calibration
surface. Also test keyboard-only operation/focus order, visible focus after
modal transitions, chart/table screen-reader names, status meaning without
color, heading hierarchy, and 200% zoom/reflow. Do not waive violations without
an evidence-backed documented rationale.

```bash
pnpm --filter @klicker-uzh/playwright add --save-dev --save-exact axe-core@4.11.4
```

- [ ] **Step 5: Run complete verification**

```bash
pnpm run check:all
pnpm run build
pnpm --filter @klicker-uzh/adaptive-learning test:irt-v2:release
pnpm --filter @klicker-uzh/graphql test:local
pnpm --filter @klicker-uzh/playwright test:run:raw -- tests/Z-adaptive-learning.spec.ts tests/Z-adaptive-learning-release.spec.ts --project=chromium
opengrep scan --config auto
```

Expected:

- all commands pass,
- generated GraphQL and Prisma artifacts are committed,
- v2 simulation artifacts are deterministic,
- participant schema redaction tests pass,
- screenshots show no overlap/overflow, and
- the working tree contains no generated drift.

Update `.github/workflows/test-adaptive-learning.yml` to run
`test:irt-v2:release`, regenerate the schema-v3 simulation report, and fail on
`git diff --exit-code packages/adaptive-learning/reports`.

- [ ] **Step 6: Complete strict review and rollout record**

Run `$thermo-nuclear-code-quality-review` against the final branch. Resolve
accepted findings or record explicit evidence-backed deferrals in the PR.

Update docs with:

- scale/calibration operations,
- field-test data handling,
- version dispatch and rollback,
- monitoring and alerts,
- pilot entry/exit criteria,
- Placement-disabled policy, and
- incident response for estimator/calibration failures.

- [ ] **Step 7: Commit final evidence**

```bash
git add packages/prisma-data playwright pnpm-lock.yaml docs packages/adaptive-learning/reports .github/workflows/test-adaptive-learning.yml project/screenshots/adaptive-learning-irt-v2
git commit -m "test(adaptive): verify calibrated IRT rollout"
```

Do not push or mark the PR ready until the user explicitly requests publication
and the v2 Diagnostic pilot gates pass.

---

### Task 14: Retire Or Quarantine The Legacy Standalone Adaptive Assessment

**Files:**

- Create: `packages/prisma/src/scripts/auditLegacyAdaptiveAssessment.ts`
- Modify: `packages/prisma/package.json`
- Modify: `packages/prisma-data/src/data/seedTEST.ts`
- Modify: `packages/graphql/test/adaptivePracticeQuizArchitecture.test.ts`
- Modify: `docs/adaptive-learning.md`
- Conditional after approved zero-data preflight:
  `packages/prisma/src/prisma/schema/migrations/20260731123000_remove_legacy_adaptive_assessment/migration.sql`
- Conditional after approved zero-data preflight:
  `packages/prisma/src/prisma/schema/adaptive.prisma`
- Conditional after approved zero-data preflight:
  `packages/prisma/src/prisma/schema/course.prisma`
- Conditional after approved zero-data preflight:
  `packages/prisma/src/prisma/schema/element.prisma`
- Conditional after approved zero-data preflight:
  `packages/prisma/src/prisma/schema/participant.prisma`
- Conditional after approved zero-data preflight:
  `packages/prisma/src/prisma/schema/user.prisma`
- Conditional after approved zero-data preflight:
  `apps/analytics/prisma/schema/adaptive.prisma`
- Conditional after approved zero-data preflight:
  `apps/analytics/prisma/schema/course.prisma`
- Conditional after approved zero-data preflight:
  `apps/analytics/prisma/schema/element.prisma`
- Conditional after approved zero-data preflight:
  `apps/analytics/prisma/schema/participant.prisma`
- Conditional after approved zero-data preflight:
  `apps/analytics/prisma/schema/user.prisma`

- [ ] **Step 1: Add a no-surface architecture guard**

Assert that no GraphQL field, frontend route, navigation item, or seed-visible
activity exposes the legacy `AdaptiveAssessment` standalone activity. The only
supported product surface is adaptive `PracticeQuiz`.

- [ ] **Step 2: Remove legacy seed creation**

Delete `seedTestkursAdaptiveAssessment`, its attempt helpers, and related legacy
fixture types/calls. Keep only competence-tree/adaptive-Practice-Quiz fixtures
from Task 13. Verify that no test depends on the standalone seed.

- [ ] **Step 3: Add a count-only preflight**

Following `df-safe-database-scripting`, create a read-only script that reports
only row counts for every legacy table and checks foreign-key dependencies. It
must refuse mutation, never print identifiers or response content, and support
the repository's normal Infisical-injected `DATABASE_URL`.

Run it against each deployed environment only with explicit user/operations
approval. Do not copy any production rows into the repository.

- [ ] **Step 4: Resolve the retention branch explicitly**

- If every deployed environment is confirmed empty and the data owner approves
  deletion, add the conditional migration that drops legacy tables/enums,
  remove `adaptive.prisma` and relations from Prisma/analytics schemas, sync,
  and replay the full migration history.
- If any rows exist or approval is absent, do not drop them. Document the data
  owner, retention/legal basis, deletion date, and access controls; keep the
  tables unreachable and exclude them from all new exports, analytics, seeds,
  and adaptive Practice Quiz code. Open a separate approved archival/deletion
  migration before broad rollout.

This branch is intentionally fail-closed: an unknown data state never becomes
an implicit destructive migration.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @klicker-uzh/prisma check
pnpm --filter @klicker-uzh/prisma build
pnpm --filter @klicker-uzh/graphql test:local -- adaptivePracticeQuizArchitecture.test.ts
pnpm run prisma:sync
pnpm run check:all
pnpm run build
pnpm --filter @klicker-uzh/playwright test:run:raw -- tests/Z-adaptive-learning.spec.ts tests/Z-adaptive-learning-release.spec.ts --project=chromium
opengrep scan --config auto
git add packages/prisma packages/prisma-data apps/analytics packages/graphql/test/adaptivePracticeQuizArchitecture.test.ts docs/adaptive-learning.md
git commit -m "chore(adaptive): retire standalone assessment residue"
```

The production rollout record must contain either the approved zero-data
migration evidence or the signed quarantine/retention decision.

---

## Requirement Traceability

| Requirement or review finding                                  | Implemented by                        |
| -------------------------------------------------------------- | ------------------------------------- |
| Adaptive remains a Practice Quiz mode                          | Global constraint; Tasks 7, 10, 11    |
| Reusable competence trees across courses                       | Tasks 5, 6, 7                         |
| Nested competences to depth 5 with weights/coverage            | Tasks 3, 7, 10                        |
| Intuitive create/subcompetence actions                         | Task 10                               |
| Assign supported elements before first save                    | Tasks 10, 13                          |
| Numerical, SC, MC, KPRIM, Free Text only                       | Tasks 1, 7, 8, 13                     |
| Server-owned numeric/canonical normalization                   | Tasks 1, 8                            |
| Explicit proficiency bands distinct from item `b`              | Tasks 1, 5, 10                        |
| Empirical `a`, type-derived fixed `c`, immutable calibration   | Tasks 1, 5, 6                         |
| Independent standard-setting and scale linking/equating        | Tasks 5, 6, 9, 10                     |
| EAP, hierarchy, weighted overall posterior, honest uncertainty | Tasks 2, 3, 9, 11                     |
| Quiz preview, node/item enablement, quiz weights               | Tasks 7, 10                           |
| Anonymous overall/root/nested cohort results                   | Tasks 9, 12                           |
| Student level bands and one combined credible trajectory       | Tasks 9, 11                           |
| Formative, non-stigmatizing next steps                         | Task 11                               |
| Owner/admin/course/participant permission boundaries           | Tasks 6, 7, 9, 12                     |
| Calibration privacy and safe export                            | Tasks 5, 6, 8                         |
| Versioned publication, resume, rollback, legacy compatibility  | Tasks 5, 7, 8, 13                     |
| Internal-only simulation and exposure verification             | Global constraint; Tasks 4, 7, 13     |
| Disjoint pilot holdout validation with confidence-bound gates  | Tasks 4, 5, 6, 7                      |
| Identifiable randomized Research collection and retake policy  | Tasks 3, 6, 7, 8, 9                   |
| Placement withheld; Research non-classifying                   | Global constraint; Tasks 7, 8, 10, 11 |
| Production verification, monitoring, screenshots, rollout      | Tasks 12, 13                          |
| Student disclosure and accessibility verification              | Tasks 11, 13                          |
| Legacy standalone activity removed or formally quarantined     | Task 14                               |

---

## Dependency Order

```text
Task 1 scale/calibration primitives
  -> Task 2 posterior/composite
  -> Task 3 v2 runtime
  -> Task 4 simulation gates
  -> Task 5 persistence/migration
  -> Task 6 management API
  -> Task 7 readiness/publication
  -> Task 8 runtime dispatch/shadow
  -> Task 9 participant/cohort contracts
  -> Task 10 Manage UX
  -> Task 11 PWA result UX
  -> Task 12 lecturer/operations
  -> Task 13 E2E and rollout evidence
  -> Task 14 legacy retirement/quarantine
```

Tasks 10 and 11 may be implemented in parallel only after Task 9's generated
GraphQL contract is stable. Task 12 may begin after Tasks 7 and 9.

## Verification Matrix

| Change                   | Required evidence                                                      |
| ------------------------ | ---------------------------------------------------------------------- |
| Pure IRT computation     | Focused Vitest, external EAP fixture, property/extreme tests           |
| Runtime routing/stopping | V1 regression, v2 hierarchy, caps, probability classification          |
| Internal simulation      | CI-only deterministic replay/report; no public API or product surface  |
| Standard-setting/holdout | Independent approvals, disjoint split, confidence-bound stratum gates  |
| Prisma                   | Clean replay, populated upgrade, schema sync, no drift                 |
| Permissions/privacy      | Positive and negative GraphQL service tests, schema redaction          |
| Publication              | Immutable exact-version scale/calibration snapshot tests               |
| Participant flow         | Playwright live submit/resume/result plus browser screenshots          |
| Lecturer flow            | Fixed-release suppression tests and owner-only calibration diagnostics |
| Rollout                  | Shadow comparison, monitoring, rollback rehearsal, strict final review |

## Production Rollout Sequence

1. **Research and shadow:** deploy schema/API/runtime behind the v2 start kill
   switch; independently approve/activate the standard-set Research scale;
   enable calibration collection only for approved owner/course pairs; use
   connected calibrated anchors plus randomized field tests, run
   `IRT_V2_EAP_GRID_1` in shadow, and publish no student proficiency labels.
2. **Independent validation:** preserve the predeclared calibration/holdout
   split, import externally reviewed calibrations, approve any required scale
   link, run the internal synthetic suite in CI plus sealed-holdout gates, and
   record independent psychometric decisions. No simulation control or report
   is exposed in the product.
3. **Calibrated Diagnostic pilot:** complete privacy and rollback rehearsals,
   then enable selected courses. Monitor
   abstention, classification rates/accuracy proxies, exposure, drift, errors,
   and duration.
4. **Diagnostic production release:** require all CI, browser, accessibility,
   migration-replay, operational, and psychometric sign-off evidence; keep the
   kill switch and immutable attempt dispatch; expand course access gradually.
5. **Placement remains out of scope:** do not enable it through this plan. It
   requires a separate high-stakes policy, cut-score validation, exposure and
   retake controls, misclassification analysis, and independent psychometric
   approval.

The code is deployable after Task 14, but `IRT_V2_EAP_GRID_1` is not
production-approved for Diagnostic labels until the pilot gates and external
psychometric sign-off are recorded. A release failure disables new v2 starts;
it does not rewrite, downgrade, or switch active attempts.

## Commit Strategy

Each task is one reviewable commit. Do not squash locally while implementation
is in progress; the final PR may use the repository's normal squash-merge
policy. Never stage unrelated existing working-tree changes.

## First Execution Slice

Start with Tasks 1 and 2 only. They deliver a pure, deterministic Bayesian
measurement kernel with no database or UI blast radius. Review its API,
numerical stability, and reference agreement before building persistence or
runtime behavior on top of it.
