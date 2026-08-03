# Adaptive Learning Psychometric Simulation Review

- **Date:** 2026-07-31
- **Scope:** Current adaptive runtime and the seeded three-level adaptive
  Practice Quiz
- **Verdict:** The implementation recovers an average learner under its own 3PL
  assumptions, but it does **not** reliably recover the mastery interpretation
  that a learner should be highly likely to answer all items at or below their
  level correctly.

## Executive Conclusion

The current implementation uses an item's selected competence-tree level as an
IRT difficulty parameter. With the seeded `NEAREST` mapping, the three item
difficulties are:

| Authored level | Difficulty (`b`) | Result band |
| --- | ---: | --- |
| Foundation | -3.0 | theta < -1.5 |
| Independent | 0.0 | -1.5 <= theta < 1.5 |
| Advanced | 3.0 | theta >= 1.5 |

In the implemented 3PL model, a learner whose ability equals the item difficulty
does not have a high probability of answering correctly. At `theta = b`, the
probability is `(1 + c) / 2`: 50% for Numerical and Free Text, 62.5% for
four-option SC, and approximately 53% for four-option MC and KPRIM.

This creates two different meanings of "Independent":

1. **Current statistical meaning:** a learner around `theta = 0`, with only
   50-62.5% expected success on Independent items.
2. **Requested didactic meaning:** a learner with high success on Foundation
   and Independent items, but low success on Advanced items.

The first meaning is recovered well. The second is systematically estimated
upward and is not dependable.

## Method

The simulation called the production functions directly:

- `prepareAdaptiveRuntime`
- `advanceAdaptiveRuntime`
- `probability`
- the production MLE estimator, standard-error calculation, routing, root
  weighting, classification, and stopping rules

The fixture reproduced the current test seed:

- two root competences with weights 3:2
- one enabled leaf per root
- a depth-5 path under the first root
- Foundation, Independent, and Advanced levels
- ten items per root and level
- two each of SC, MC, KPRIM, Numerical, and Free Text
- `a = 1.2`
- type-derived guessing parameters
- 60-question total cap and 30-question leaf cap
- `z = 1.28`, an intended 80% classification interval
- `topInformationRatio = 0.8`

The run contained **83,000 deterministic Monte Carlo attempts**:

- 26,000 model-recovery attempts across 13 theta values
- 20,000 mastery-profile attempts across the three levels
- 15,000 Independent mastery sensitivity attempts
- 18,000 heterogeneous-root attempts
- 4,000 all-correct, all-wrong, and guessing stress attempts

The existing production-shaped simulation suite also passed all 33 tests. That
suite correctly describes its gates as engineering regression checks rather
than psychometric validation.

## Model Recovery

Responses in this section were generated from the exact 3PL model assumed by
the estimator.

| True theta | True band | Mean estimate | Bias | RMSE | Correct band | 80% interval coverage | All roots classified | Mean questions |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| -2.50 | Foundation | -2.506 | -0.006 | 0.520 | 93.30% | 88.75% | 69.75% | 27.5 |
| -2.00 | Foundation | -2.066 | -0.066 | 0.640 | 81.05% | 79.95% | 38.70% | 35.1 |
| -1.60 | Foundation | -1.565 | +0.035 | 0.675 | 53.95% | 65.95% | 26.75% | 38.6 |
| -1.40 | Independent | -1.324 | +0.076 | 0.659 | 61.80% | 65.20% | 25.00% | 38.5 |
| -1.00 | Independent | -0.833 | +0.167 | 0.588 | 87.60% | 72.75% | 37.45% | 32.4 |
| -0.50 | Independent | -0.366 | +0.134 | 0.460 | 98.15% | 88.20% | 67.20% | 21.5 |
| **0.00** | **Independent** | **-0.029** | **-0.029** | **0.351** | **99.75%** | **92.30%** | **84.55%** | **16.1** |
| +0.50 | Independent | +0.362 | -0.138 | 0.439 | 98.60% | 88.50% | 63.85% | 22.5 |
| +1.00 | Independent | +0.875 | -0.125 | 0.575 | 86.55% | 72.50% | 29.85% | 35.3 |
| +1.40 | Independent | +1.329 | -0.071 | 0.643 | 61.20% | 65.10% | 19.75% | 41.2 |
| +1.60 | Advanced | +1.595 | -0.005 | 0.646 | 56.75% | 67.50% | 21.55% | 41.7 |
| +2.00 | Advanced | +2.083 | +0.083 | 0.610 | 82.70% | 74.35% | 36.10% | 37.8 |
| +2.50 | Advanced | +2.571 | +0.071 | 0.428 | 97.30% | 92.45% | 68.45% | 30.0 |

Under the model's own definition, the requested central example passes:
a true `theta = 0` learner is labeled Independent in 99.75% of attempts.

The result is much weaker near level boundaries. Learners only 0.1 theta units
to either side of a boundary receive the correct band in approximately 54-62%
of attempts. The nominal 80% intervals cover the true value only 65-68% of the
time near those boundaries.

## Mastery Recovery

The main mastery profile used:

- 90% correctness for all items at or below the learner's level
- above-level correctness equal to guessing plus 10% of the remaining
  probability

| Intended level | Mean theta | Foundation label | Independent label | Advanced label | All roots classified | Mean questions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Foundation | -1.438 | 41.92% | **58.08%** | 0.00% | 18.78% | 43.4 |
| Independent | +1.316 | 0.00% | **64.90%** | **35.10%** | 26.17% | 45.1 |
| Advanced | +2.595 | 0.00% | 9.92% | **90.08%** | 99.98% | 20.9 |

The current estimator therefore does not preserve the intended mastery levels:

- Most Foundation-mastery learners are moved up to Independent.
- More than one third of Independent-mastery learners are moved up to Advanced.
- The asymmetry favors the top band because a high probability at `b = 0`
  implies a theta close to or beyond the `+1.5` result boundary.

### Independent-Level Sensitivity

| Correct at/below Independent | Above-level knowledge | Mean theta | Independent label | Advanced label | All roots classified | Mean questions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 80% | 20% above guessing | +0.918 | 78.13% | 21.83% | 68.83% | 31.4 |
| 85% | 15% above guessing | +1.117 | 71.73% | 28.27% | 48.17% | 37.8 |
| 90% | 10% above guessing | +1.325 | 65.10% | 34.90% | 26.40% | 45.2 |
| 95% | 5% above guessing | +1.507 | 54.93% | 45.07% | 7.20% | 52.3 |
| 100% | 0% above guessing | +1.632 | **17.90%** | **82.10%** | 0.03% | 59.5 |

Paradoxically from a mastery perspective, becoming more consistently correct
on all Foundation and Independent items increases the probability of an
Advanced result, even while the learner remains unable to answer Advanced
items.

## Root Aggregation

The configured 3:2 root weighting behaves arithmetically as implemented.

| Root abilities | Expected weighted theta | Mean overall theta | Independent label |
| --- | ---: | ---: | ---: |
| -2.0, +2.0 | -0.4 | -0.405 | 96.47% |
| +2.0, -2.0 | +0.4 | +0.426 | 96.37% |
| -1.0, 0.0 | -0.6 | -0.508 | 93.97% |
| 0.0, +1.0 | +0.4 | +0.345 | 99.43% |

This confirms the aggregation code, but not the didactic validity of averaging
opposing competences into one level. The propagated standard error also assumes
independent root estimates and does not include a heterogeneity penalty.

With mastery-style opposing roots, the asymmetry in recovered root theta becomes
visible:

- Foundation/Advanced roots produce mean root estimates `-1.434` and `+2.570`,
  and an overall theta of `+0.168`.
- Advanced/Foundation roots produce `+2.563` and `-1.408`, and an overall theta
  of `+0.974`.

Both are usually labeled Independent, but the second arrangement is labeled
Advanced in 16.27% of attempts because the higher-weight root is Advanced.

## Stopping And Uncertainty

A returned level label is not the same as a confident classification.

For the 90% Independent mastery profile:

- 100% of reportable attempts receive a point-estimate level label.
- only 26.17% stop because all roots are classified
- 47.96% stop at a node/leaf cap
- 25.87% stop at the total question cap
- the mean length is 45.1 questions and the 95th percentile is 60

The current result presentation can therefore show "Independent" or "Advanced"
even when the classification interval never fit within a band. This distinction
must be visible to students and lecturers if such results are retained.

The nominal 80% Wald interval is not uniformly calibrated. Coverage near the
two band boundaries is only about 65-68%. Likely contributors are:

- repeated classification checks after every response
- adaptive item selection
- unregularized final maximum-likelihood estimates
- theta clamping to `[-3, 3]`
- treating authored `a`, `b`, and `c` as known

## Extreme Cases

| Response behavior | Mean theta | Result | Mean questions |
| --- | ---: | --- | ---: |
| Always correct | +3.000 | 100% Advanced | 19.6 |
| Always wrong | -3.000 | 100% Foundation | 16.6 |
| Pure type-derived guessing | -2.991 | 99.7% Foundation | 17.0 |

The all-correct and all-wrong MLEs hit the configured theta boundaries. Their
finite Wald standard errors should not be interpreted as well-calibrated
uncertainty at those bounds.

## Code Findings Explaining The Results

1. `probability` implements a 3PL item response model with the authored level
   theta used directly as `b`.
2. Final results use unregularized maximum likelihood. Routing separately uses
   a prior centered at zero.
3. SC, MC, and KPRIM guessing parameters are inferred from option count rather
   than calibrated from response data.
4. MC and KPRIM partial scores are reduced to incorrect unless the score is
   exactly 1.
5. A point-estimate level is assigned after four responses even when its
   interval crosses a level boundary.
6. Root classification does not guarantee that the weighted overall interval
   fits inside one overall level band.

## Production Assessment

The current behavior is acceptable only if the product explicitly defines a
level as an IRT location and authors understand that a same-level item is
answered correctly only about 50% above guessing. That is not the mastery
meaning stated for this feature and is unlikely to match a lecturer's intuition
when assigning an element to Foundation, Independent, or Advanced.

On the stated didactic requirement, the result logic is **not production ready
for consequential classification**. It can be used as an exploratory practice
estimate only with clear uncertainty and non-mastery wording.

## Required Decisions And Changes

1. Define the construct before changing thresholds:
   - keep IRT difficulty semantics and rename/explain the authoring control, or
   - make competence-tree levels mastery thresholds and transform/calibrate
     item difficulties accordingly.
2. If mastery is intended, define a target same-level success probability and
   derive item difficulty by type instead of setting `b` equal to the level
   anchor.
3. Calibrate `a`, `b`, and `c` from pilot response data before using results for
   placement or high-stakes decisions.
4. Use a stable small-sample estimator such as MAP/EAP or a documented Bayesian
   model for final reporting, not only for routing.
5. Separate `provisional band` from `classified band` in the API and UI. Do not
   present a cap-exhausted point label as equally certain.
6. Replace or calibrate ordinary repeatedly inspected Wald intervals and add
   simulation gates for boundary coverage.
7. Define a partial-credit response model for MC and KPRIM instead of converting
   every non-perfect response to zero.
8. Add the mastery profiles in this report as permanent regression scenarios
   once the intended construct is approved.

## Reproduction

The maintained simulation suite was verified with:

```bash
pnpm --filter @klicker-uzh/adaptive-learning test:simulation
```

Result: 33 tests passed. The additional seed-shaped Monte Carlo run used a
fixed PRNG seed and the production runtime functions directly; no database,
GraphQL, or UI approximation was involved.
