# Adaptive Learning Simulation Summary

Deterministic Phase 11 evidence generated from production runtime helpers and canonical preset defaults.

Assumptions: seed 11021; 50 learners per level for canonical product profiles; 60 seconds per item.

## Engineering Regression Thresholds

| Common metric                                             |         Required |
| --------------------------------------------------------- | ---------------: |
| Exact level agreement (overall)                           |           >= 70% |
| Same-or-adjacent agreement (overall and populated levels) |           >= 95% |
| Exact level agreement (populated levels)                  |           >= 60% |
| Mean absolute level error                                 |    <= 0.35 bands |
| Absolute signed per-level bias                            |    <= 0.50 bands |
| Unexpected node/pool/insufficient fallbacks               |                0 |
| Determinism                                               | identical replay |

| Pool profile                         | Interior classified | Total cap | Max exposure | P95 exposure |   Mean length |
| ------------------------------------ | ------------------: | --------: | -----------: | -----------: | ------------: |
| Target (5 items per leaf-level cell) |              >= 15% |    <= 90% |       <= 90% |       <= 80% | <= 99% of cap |
| Rich (10 items per leaf-level cell)  |              >= 25% |    <= 80% |       <= 60% |       <= 45% | <= 99% of cap |

These are deterministic code-regression baselines for the six-band synthetic model. They are not psychometric validation or permission to use outcomes in a real course.

## Feasibility Boundary

The former 90% interior-classification gate was mathematically incompatible with the shipped two-root, 50-item cap. Six equal bands over theta [-3, 3] are 1.2 wide. At exactly 25% of a band from a boundary, z = 1.28 requires SE <= 0.234375. Even with ideal c = 0 items at maximum information a^2 / 4 = 0.36, one root needs at least 51 responses; two roots need at least 102. Guessing makes the requirement stricter.

The former 40% synthetic maximum-exposure gate was also not a valid minimum-bank invariant. The target bank has 120 items and the observed mean length is about 48, so average exposure is already about 40% before information-based concentration. The real-course pilot still requires TOTAL_QUESTION_CAP <= 25% and maximum exposure <= 40%; meeting those gates requires a course-calibrated bank and may require more than ten items per cell or an approved algorithm/profile change.

## Canonical Product Profiles

| Profile                     | Pool   | Exact | Adjacent | Interior classified | Total cap | Max / P95 exposure | Mean items / cap | Regression |
| --------------------------- | ------ | ----: | -------: | ------------------: | --------: | -----------------: | ---------------: | ---------- |
| canonical-placement-target  | TARGET | 83.7% |   100.0% |               15.7% |     88.3% |      86.7% / 76.0% |      47.743 / 50 | PASS       |
| canonical-placement-rich    | RICH   | 85.0% |   100.0% |               26.9% |     78.7% |      57.7% / 45.0% |      46.843 / 50 | PASS       |
| canonical-diagnostic-target | TARGET | 77.3% |   100.0% |               18.3% |     84.3% |      86.3% / 78.0% |      49.077 / 50 | PASS       |
| canonical-diagnostic-rich   | RICH   | 81.0% |   100.0% |               26.4% |     79.0% |      47.7% / 42.0% |      48.667 / 50 | PASS       |

## Failing Regressions

All canonical engineering regression gates pass.

## Stress Evidence

| Scenario                                      | Category               | Classified | Pre-cap classified | Total cap | Exact | Mean items |
| --------------------------------------------- | ---------------------- | ---------: | -----------------: | --------: | ----: | ---------: |
| stress-overlay-short-form                     | STRESS_OVERLAY         |       0.0% |               0.0% |    100.0% | 81.9% |     36.000 |
| stress-overlay-long-form                      | STRESS_OVERLAY         |      51.4% |              51.4% |     48.6% | 91.7% |     72.847 |
| stress-discrimination-configured-1.2-true-0.8 | DISCRIMINATION_SWEEP   |      20.8% |              16.7% |     79.2% | 72.2% |     49.139 |
| stress-discrimination-configured-1.2-true-1.0 | DISCRIMINATION_SWEEP   |      12.5% |              11.1% |     87.5% | 81.9% |     49.486 |
| stress-discrimination-configured-1.2-true-1.2 | DISCRIMINATION_SWEEP   |      12.5% |              12.5% |     87.5% | 81.9% |     49.417 |
| stress-discrimination-configured-1.2-true-1.5 | DISCRIMINATION_SWEEP   |      23.6% |              22.2% |     76.4% | 86.1% |     48.417 |
| stress-difficulty-adjacent-shift-0-percent    | DIFFICULTY_SHIFT_SWEEP |      12.5% |              12.5% |     87.5% | 81.9% |     49.417 |
| stress-difficulty-adjacent-shift-10-percent   | DIFFICULTY_SHIFT_SWEEP |      16.7% |              16.7% |     83.3% | 81.9% |     48.917 |
| stress-difficulty-adjacent-shift-20-percent   | DIFFICULTY_SHIFT_SWEEP |      20.8% |              20.8% |     79.2% | 87.5% |     48.597 |
| stress-item-type-numerical                    | ITEM_TYPE_SWEEP        |      26.4% |              23.6% |     73.6% | 88.9% |     48.083 |
| stress-item-type-sc                           | ITEM_TYPE_SWEEP        |       0.0% |               0.0% |    100.0% | 79.2% |     50.000 |
| stress-item-type-mc                           | ITEM_TYPE_SWEEP        |       1.4% |               1.4% |     98.6% | 86.1% |     49.903 |
| stress-item-type-kprim                        | ITEM_TYPE_SWEEP        |       6.9% |               6.9% |     93.1% | 88.9% |     49.708 |
| stress-item-type-free-text                    | ITEM_TYPE_SWEEP        |      26.4% |              23.6% |     73.6% | 88.9% |     48.083 |
| stress-pool-sparse                            | POOL_SIZE_SWEEP        |       0.0% |               0.0% |      0.0% | 62.5% |     24.000 |
| stress-pool-target                            | POOL_SIZE_SWEEP        |      12.5% |              12.5% |     87.5% | 81.9% |     49.417 |
| stress-pool-rich                              | POOL_SIZE_SWEEP        |      22.2% |              22.2% |     77.8% | 84.7% |     48.708 |

The JSON artifact contains resolved configuration, profile-aware regression gates, preset aggregates, level/root/boundary strata, exposure, terminal failure reasons, and losslessly encoded nullable learner traces.

## Bayesian IRT v2 Release Evidence

Input fingerprint: `223c7e3f02efd224fdbc5ebacc26e869f92fd2933e4556b39f5d29d5ab7919d4`. Evidence: `RELEASE`; estimator: `IRT_V2_EAP_GRID_1`; policy: 1.

| Threshold | Classified | Required roots | Accuracy when classified | Bias upper 95% | RMSE upper 95% | Coverage 95% interval | Exposure / retake / sampled pairwise overlap | Release |
| --------: | ---------: | -------------: | -----------------------: | -------------: | -------------: | --------------------- | -------------------------------------------: | ------- |
|      0.80 |     100.0% |         100.0% |                    33.3% |          0.039 |          1.469 | 31.7% - 34.1%         |                        26.3% / 0.0% / 100.0% | BLOCKED |
|      0.90 |      36.0% |          37.6% |                    85.9% |          0.024 |          0.733 | 59.8% - 62.2%         |                      87.8% / 100.0% / 100.0% | BLOCKED |
|      0.95 |      19.1% |          19.3% |                    97.1% |          0.017 |          0.599 | 62.6% - 65.1%         |                      98.0% / 100.0% / 100.0% | BLOCKED |

No candidate threshold passes all reviewed release gates. Broad IRT v2 Diagnostic release remains blocked; the simulation does not silently lower any gate.

| Threshold | Failed gate                                                         | Actual | Required |
| --------: | ------------------------------------------------------------------- | -----: | -------- |
|      0.80 | rmseUpper95                                                         |  1.469 | <= 0.5   |
|      0.80 | credibleCoverageLower95                                             |  0.317 | >= 0.85  |
|      0.80 | classifiedBandAccuracyLower95                                       |  0.322 | >= 0.9   |
|      0.80 | sampledMaximumPairwiseFormOverlapRate                               |  1.000 | <= 0.9   |
|      0.80 | stratum:band:Foundation:credibleCoverageLower95                     |  0.042 | >= 0.85  |
|      0.80 | stratum:band:Foundation:absoluteBiasUpper95                         |  1.692 | <= 0.1   |
|      0.80 | stratum:band:Foundation:rmseUpper95                                 |  1.750 | <= 0.5   |
|      0.80 | stratum:band:Foundation:classifiedBandAccuracyLower95               |  0.000 | >= 0.9   |
|      0.80 | stratum:band:Independent:rmseUpper95                                |  0.649 | <= 0.5   |
|      0.80 | stratum:band:Advanced:credibleCoverageLower95                       |  0.052 | >= 0.85  |
|      0.80 | stratum:band:Advanced:absoluteBiasUpper95                           |  1.680 | <= 0.1   |
|      0.80 | stratum:band:Advanced:rmseUpper95                                   |  1.736 | <= 0.5   |
|      0.80 | stratum:band:Advanced:classifiedBandAccuracyLower95                 |  0.000 | >= 0.9   |
|      0.80 | stratum:root:1:credibleCoverageLower95                              |  0.515 | >= 0.85  |
|      0.80 | stratum:root:1:rmseUpper95                                          |  1.494 | <= 0.5   |
|      0.80 | stratum:root:1:classifiedBandAccuracyLower95                        |  0.322 | >= 0.9   |
|      0.80 | stratum:root:6:credibleCoverageLower95                              |  0.520 | >= 0.85  |
|      0.80 | stratum:root:6:rmseUpper95                                          |  1.485 | <= 0.5   |
|      0.80 | stratum:root:6:classifiedBandAccuracyLower95                        |  0.322 | >= 0.9   |
|      0.80 | stratum:item-type:NUMERICAL:credibleCoverageLower95                 |  0.356 | >= 0.85  |
|      0.80 | stratum:item-type:NUMERICAL:rmseUpper95                             |  1.201 | <= 0.5   |
|      0.80 | stratum:item-type:NUMERICAL:classifiedBandAccuracyLower95           |  0.551 | >= 0.9   |
|      0.80 | stratum:item-type:SC:credibleCoverageLower95                        |  0.302 | >= 0.85  |
|      0.80 | stratum:item-type:SC:absoluteBiasUpper95                            |  0.130 | <= 0.1   |
|      0.80 | stratum:item-type:SC:rmseUpper95                                    |  1.487 | <= 0.5   |
|      0.80 | stratum:item-type:SC:classifiedBandAccuracyLower95                  |  0.415 | >= 0.9   |
|      0.80 | stratum:item-type:MC:credibleCoverageLower95                        |  0.335 | >= 0.85  |
|      0.80 | stratum:item-type:MC:absoluteBiasUpper95                            |  0.105 | <= 0.1   |
|      0.80 | stratum:item-type:MC:rmseUpper95                                    |  1.308 | <= 0.5   |
|      0.80 | stratum:item-type:MC:classifiedBandAccuracyLower95                  |  0.504 | >= 0.9   |
|      0.80 | stratum:item-type:KPRIM:credibleCoverageLower95                     |  0.336 | >= 0.85  |
|      0.80 | stratum:item-type:KPRIM:rmseUpper95                                 |  1.294 | <= 0.5   |
|      0.80 | stratum:item-type:KPRIM:classifiedBandAccuracyLower95               |  0.522 | >= 0.9   |
|      0.80 | stratum:item-type:FREE_TEXT:credibleCoverageLower95                 |  0.356 | >= 0.85  |
|      0.80 | stratum:item-type:FREE_TEXT:rmseUpper95                             |  1.204 | <= 0.5   |
|      0.80 | stratum:item-type:FREE_TEXT:classifiedBandAccuracyLower95           |  0.551 | >= 0.9   |
|      0.80 | stratum:course-cohort:COHORT_A:credibleCoverageLower95              |  0.310 | >= 0.85  |
|      0.80 | stratum:course-cohort:COHORT_A:rmseUpper95                          |  1.480 | <= 0.5   |
|      0.80 | stratum:course-cohort:COHORT_A:classifiedBandAccuracyLower95        |  0.313 | >= 0.9   |
|      0.80 | stratum:course-cohort:COHORT_B:credibleCoverageLower95              |  0.307 | >= 0.85  |
|      0.80 | stratum:course-cohort:COHORT_B:rmseUpper95                          |  1.479 | <= 0.5   |
|      0.80 | stratum:course-cohort:COHORT_B:classifiedBandAccuracyLower95        |  0.313 | >= 0.9   |
|      0.80 | stratum:course-cohort:COHORT_C:credibleCoverageLower95              |  0.309 | >= 0.85  |
|      0.80 | stratum:course-cohort:COHORT_C:rmseUpper95                          |  1.478 | <= 0.5   |
|      0.80 | stratum:course-cohort:COHORT_C:classifiedBandAccuracyLower95        |  0.313 | >= 0.9   |
|      0.80 | stratum:theta-cell:Foundation:0:-2.9:credibleCoverageLower95        |  0.000 | >= 0.85  |
|      0.80 | stratum:theta-cell:Foundation:0:-2.9:absoluteBiasUpper95            |  2.236 | <= 0.1   |
|      0.80 | stratum:theta-cell:Foundation:0:-2.9:rmseUpper95                    |  2.243 | <= 0.5   |
|      0.80 | stratum:theta-cell:Foundation:0:-2.9:classifiedBandAccuracyLower95  |  0.000 | >= 0.9   |
|      0.80 | stratum:theta-cell:Foundation:1:-2.6:credibleCoverageLower95        |  0.000 | >= 0.85  |
|      0.80 | stratum:theta-cell:Foundation:1:-2.6:absoluteBiasUpper95            |  1.966 | <= 0.1   |
|      0.80 | stratum:theta-cell:Foundation:1:-2.6:rmseUpper95                    |  1.977 | <= 0.5   |
|      0.80 | stratum:theta-cell:Foundation:1:-2.6:classifiedBandAccuracyLower95  |  0.000 | >= 0.9   |
|      0.80 | stratum:theta-cell:Foundation:2:-2.3:credibleCoverageLower95        |  0.000 | >= 0.85  |
|      0.80 | stratum:theta-cell:Foundation:2:-2.3:absoluteBiasUpper95            |  1.683 | <= 0.1   |
|      0.80 | stratum:theta-cell:Foundation:2:-2.3:rmseUpper95                    |  1.698 | <= 0.5   |
|      0.80 | stratum:theta-cell:Foundation:2:-2.3:classifiedBandAccuracyLower95  |  0.000 | >= 0.9   |
|      0.80 | stratum:theta-cell:Foundation:3:-2:credibleCoverageLower95          |  0.000 | >= 0.85  |
|      0.80 | stratum:theta-cell:Foundation:3:-2:absoluteBiasUpper95              |  1.431 | <= 0.1   |
|      0.80 | stratum:theta-cell:Foundation:3:-2:rmseUpper95                      |  1.451 | <= 0.5   |
|      0.80 | stratum:theta-cell:Foundation:3:-2:classifiedBandAccuracyLower95    |  0.000 | >= 0.9   |
|      0.80 | stratum:theta-cell:Foundation:4:-1.7:credibleCoverageLower95        |  0.212 | >= 0.85  |
|      0.80 | stratum:theta-cell:Foundation:4:-1.7:absoluteBiasUpper95            |  1.157 | <= 0.1   |
|      0.80 | stratum:theta-cell:Foundation:4:-1.7:rmseUpper95                    |  1.187 | <= 0.5   |
|      0.80 | stratum:theta-cell:Foundation:4:-1.7:classifiedBandAccuracyLower95  |  0.000 | >= 0.9   |
|      0.80 | stratum:theta-cell:Independent:0:-1.2:credibleCoverageLower95       |  0.716 | >= 0.85  |
|      0.80 | stratum:theta-cell:Independent:0:-1.2:absoluteBiasUpper95           |  0.803 | <= 0.1   |
|      0.80 | stratum:theta-cell:Independent:0:-1.2:rmseUpper95                   |  0.868 | <= 0.5   |
|      0.80 | stratum:theta-cell:Independent:1:-0.6:credibleCoverageUpper95       |  0.951 | <= 0.95  |
|      0.80 | stratum:theta-cell:Independent:1:-0.6:absoluteBiasUpper95           |  0.398 | <= 0.1   |
|      0.80 | stratum:theta-cell:Independent:1:-0.6:rmseUpper95                   |  0.554 | <= 0.5   |
|      0.80 | stratum:theta-cell:Independent:2:0:credibleCoverageUpper95          |  1.000 | <= 0.95  |
|      0.80 | stratum:theta-cell:Independent:3:0.6:absoluteBiasUpper95            |  0.379 | <= 0.1   |
|      0.80 | stratum:theta-cell:Independent:3:0.6:rmseUpper95                    |  0.526 | <= 0.5   |
|      0.80 | stratum:theta-cell:Independent:4:1.2:credibleCoverageLower95        |  0.732 | >= 0.85  |
|      0.80 | stratum:theta-cell:Independent:4:1.2:absoluteBiasUpper95            |  0.765 | <= 0.1   |
|      0.80 | stratum:theta-cell:Independent:4:1.2:rmseUpper95                    |  0.827 | <= 0.5   |
|      0.80 | stratum:theta-cell:Advanced:0:1.7:credibleCoverageLower95           |  0.264 | >= 0.85  |
|      0.80 | stratum:theta-cell:Advanced:0:1.7:absoluteBiasUpper95               |  1.137 | <= 0.1   |
|      0.80 | stratum:theta-cell:Advanced:0:1.7:rmseUpper95                       |  1.166 | <= 0.5   |
|      0.80 | stratum:theta-cell:Advanced:0:1.7:classifiedBandAccuracyLower95     |  0.000 | >= 0.9   |
|      0.80 | stratum:theta-cell:Advanced:1:2:credibleCoverageLower95             |  0.000 | >= 0.85  |
|      0.80 | stratum:theta-cell:Advanced:1:2:absoluteBiasUpper95                 |  1.400 | <= 0.1   |
|      0.80 | stratum:theta-cell:Advanced:1:2:rmseUpper95                         |  1.417 | <= 0.5   |
|      0.80 | stratum:theta-cell:Advanced:1:2:classifiedBandAccuracyLower95       |  0.000 | >= 0.9   |
|      0.80 | stratum:theta-cell:Advanced:2:2.3:credibleCoverageLower95           |  0.000 | >= 0.85  |
|      0.80 | stratum:theta-cell:Advanced:2:2.3:absoluteBiasUpper95               |  1.675 | <= 0.1   |
|      0.80 | stratum:theta-cell:Advanced:2:2.3:rmseUpper95                       |  1.686 | <= 0.5   |
|      0.80 | stratum:theta-cell:Advanced:2:2.3:classifiedBandAccuracyLower95     |  0.000 | >= 0.9   |
|      0.80 | stratum:theta-cell:Advanced:3:2.6:credibleCoverageLower95           |  0.000 | >= 0.85  |
|      0.80 | stratum:theta-cell:Advanced:3:2.6:absoluteBiasUpper95               |  1.955 | <= 0.1   |
|      0.80 | stratum:theta-cell:Advanced:3:2.6:rmseUpper95                       |  1.963 | <= 0.5   |
|      0.80 | stratum:theta-cell:Advanced:3:2.6:classifiedBandAccuracyLower95     |  0.000 | >= 0.9   |
|      0.80 | stratum:theta-cell:Advanced:4:2.9:credibleCoverageLower95           |  0.000 | >= 0.85  |
|      0.80 | stratum:theta-cell:Advanced:4:2.9:absoluteBiasUpper95               |  2.230 | <= 0.1   |
|      0.80 | stratum:theta-cell:Advanced:4:2.9:rmseUpper95                       |  2.236 | <= 0.5   |
|      0.80 | stratum:theta-cell:Advanced:4:2.9:classifiedBandAccuracyLower95     |  0.000 | >= 0.9   |
|      0.80 | stratum:cut-distance:NEAR_CUT:credibleCoverageLower95               |  0.515 | >= 0.85  |
|      0.80 | stratum:cut-distance:NEAR_CUT:confidentMisclassificationRateUpper95 |  0.695 | <= 0.01  |
|      0.80 | stratum:cut-distance:INTERIOR:credibleCoverageLower95               |  0.317 | >= 0.85  |
|      0.80 | stratum:cut-distance:INTERIOR:rmseUpper95                           |  1.469 | <= 0.5   |
|      0.80 | stratum:cut-distance:INTERIOR:classifiedBandAccuracyLower95         |  0.322 | >= 0.9   |
|      0.90 | rmseUpper95                                                         |  0.733 | <= 0.5   |
|      0.90 | credibleCoverageLower95                                             |  0.598 | >= 0.85  |
|      0.90 | classifiedBandAccuracyLower95                                       |  0.844 | >= 0.9   |
|      0.90 | classificationRateLower95                                           |  0.358 | >= 0.8   |
|      0.90 | requiredRootClassificationRateLower95                               |  0.365 | >= 0.75  |
|      0.90 | maximumTestOverlapRate                                              |  1.000 | <= 0.9   |
|      0.90 | sampledMaximumPairwiseFormOverlapRate                               |  1.000 | <= 0.9   |
|      0.90 | stratum:band:Foundation:credibleCoverageLower95                     |  0.463 | >= 0.85  |
|      0.90 | stratum:band:Foundation:absoluteBiasUpper95                         |  0.682 | <= 0.1   |
|      0.90 | stratum:band:Foundation:rmseUpper95                                 |  0.847 | <= 0.5   |
|      0.90 | stratum:band:Foundation:classifiedBandAccuracyLower95               |  0.517 | >= 0.9   |
|      0.90 | stratum:band:Independent:credibleCoverageLower95                    |  0.825 | >= 0.85  |
|      0.90 | stratum:band:Independent:rmseUpper95                                |  0.551 | <= 0.5   |
|      0.90 | stratum:band:Advanced:credibleCoverageLower95                       |  0.482 | >= 0.85  |
|      0.90 | stratum:band:Advanced:absoluteBiasUpper95                           |  0.653 | <= 0.1   |
|      0.90 | stratum:band:Advanced:rmseUpper95                                   |  0.791 | <= 0.5   |
|      0.90 | stratum:band:Advanced:classifiedBandAccuracyLower95                 |  0.555 | >= 0.9   |
|      0.90 | stratum:root:1:credibleCoverageLower95                              |  0.756 | >= 0.85  |
|      0.90 | stratum:root:1:rmseUpper95                                          |  0.771 | <= 0.5   |
|      0.90 | stratum:root:1:classifiedBandAccuracyLower95                        |  0.834 | >= 0.9   |
|      0.90 | stratum:root:6:credibleCoverageLower95                              |  0.748 | >= 0.85  |
|      0.90 | stratum:root:6:rmseUpper95                                          |  0.816 | <= 0.5   |
|      0.90 | stratum:root:6:classifiedBandAccuracyLower95                        |  0.815 | >= 0.9   |
|      0.90 | stratum:item-type:NUMERICAL:credibleCoverageLower95                 |  0.356 | >= 0.85  |
|      0.90 | stratum:item-type:NUMERICAL:rmseUpper95                             |  1.204 | <= 0.5   |
|      0.90 | stratum:item-type:NUMERICAL:classifiedBandAccuracyLower95           |  0.782 | >= 0.9   |
|      0.90 | stratum:item-type:SC:credibleCoverageLower95                        |  0.302 | >= 0.85  |
|      0.90 | stratum:item-type:SC:absoluteBiasUpper95                            |  0.135 | <= 0.1   |
|      0.90 | stratum:item-type:SC:rmseUpper95                                    |  1.486 | <= 0.5   |
|      0.90 | stratum:item-type:SC:classifiedBandAccuracyLower95                  |  0.525 | >= 0.9   |
|      0.90 | stratum:item-type:MC:credibleCoverageLower95                        |  0.335 | >= 0.85  |
|      0.90 | stratum:item-type:MC:absoluteBiasUpper95                            |  0.102 | <= 0.1   |
|      0.90 | stratum:item-type:MC:rmseUpper95                                    |  1.306 | <= 0.5   |
|      0.90 | stratum:item-type:MC:classifiedBandAccuracyLower95                  |  0.794 | >= 0.9   |
|      0.90 | stratum:item-type:KPRIM:credibleCoverageLower95                     |  0.336 | >= 0.85  |
|      0.90 | stratum:item-type:KPRIM:rmseUpper95                                 |  1.294 | <= 0.5   |
|      0.90 | stratum:item-type:KPRIM:classifiedBandAccuracyLower95               |  0.747 | >= 0.9   |
|      0.90 | stratum:item-type:FREE_TEXT:credibleCoverageLower95                 |  0.356 | >= 0.85  |
|      0.90 | stratum:item-type:FREE_TEXT:rmseUpper95                             |  1.204 | <= 0.5   |
|      0.90 | stratum:item-type:FREE_TEXT:classifiedBandAccuracyLower95           |  0.782 | >= 0.9   |
|      0.90 | stratum:course-cohort:COHORT_A:credibleCoverageLower95              |  0.606 | >= 0.85  |
|      0.90 | stratum:course-cohort:COHORT_A:rmseUpper95                          |  0.721 | <= 0.5   |
|      0.90 | stratum:course-cohort:COHORT_A:classifiedBandAccuracyLower95        |  0.847 | >= 0.9   |
|      0.90 | stratum:course-cohort:COHORT_B:credibleCoverageLower95              |  0.584 | >= 0.85  |
|      0.90 | stratum:course-cohort:COHORT_B:rmseUpper95                          |  0.753 | <= 0.5   |
|      0.90 | stratum:course-cohort:COHORT_B:classifiedBandAccuracyLower95        |  0.807 | >= 0.9   |
|      0.90 | stratum:course-cohort:COHORT_C:credibleCoverageLower95              |  0.576 | >= 0.85  |
|      0.90 | stratum:course-cohort:COHORT_C:rmseUpper95                          |  0.748 | <= 0.5   |
|      0.90 | stratum:course-cohort:COHORT_C:classifiedBandAccuracyLower95        |  0.842 | >= 0.9   |
|      0.90 | stratum:theta-cell:Foundation:0:-2.9:credibleCoverageLower95        |  0.295 | >= 0.85  |
|      0.90 | stratum:theta-cell:Foundation:0:-2.9:absoluteBiasUpper95            |  0.799 | <= 0.1   |
|      0.90 | stratum:theta-cell:Foundation:0:-2.9:rmseUpper95                    |  0.938 | <= 0.5   |
|      0.90 | stratum:theta-cell:Foundation:0:-2.9:classifiedBandAccuracyLower95  |  0.877 | >= 0.9   |
|      0.90 | stratum:theta-cell:Foundation:1:-2.6:credibleCoverageLower95        |  0.400 | >= 0.85  |
|      0.90 | stratum:theta-cell:Foundation:1:-2.6:absoluteBiasUpper95            |  0.759 | <= 0.1   |
|      0.90 | stratum:theta-cell:Foundation:1:-2.6:rmseUpper95                    |  0.953 | <= 0.5   |
|      0.90 | stratum:theta-cell:Foundation:1:-2.6:classifiedBandAccuracyLower95  |  0.630 | >= 0.9   |
|      0.90 | stratum:theta-cell:Foundation:2:-2.3:credibleCoverageLower95        |  0.439 | >= 0.85  |
|      0.90 | stratum:theta-cell:Foundation:2:-2.3:absoluteBiasUpper95            |  0.692 | <= 0.1   |
|      0.90 | stratum:theta-cell:Foundation:2:-2.3:rmseUpper95                    |  0.847 | <= 0.5   |
|      0.90 | stratum:theta-cell:Foundation:2:-2.3:classifiedBandAccuracyLower95  |  0.284 | >= 0.9   |
|      0.90 | stratum:theta-cell:Foundation:3:-2:credibleCoverageLower95          |  0.466 | >= 0.85  |
|      0.90 | stratum:theta-cell:Foundation:3:-2:absoluteBiasUpper95              |  0.703 | <= 0.1   |
|      0.90 | stratum:theta-cell:Foundation:3:-2:rmseUpper95                      |  0.868 | <= 0.5   |
|      0.90 | stratum:theta-cell:Foundation:3:-2:classifiedBandAccuracyLower95    |  0.011 | >= 0.9   |
|      0.90 | stratum:theta-cell:Foundation:4:-1.7:credibleCoverageLower95        |  0.587 | >= 0.85  |
|      0.90 | stratum:theta-cell:Foundation:4:-1.7:absoluteBiasUpper95            |  0.568 | <= 0.1   |
|      0.90 | stratum:theta-cell:Foundation:4:-1.7:rmseUpper95                    |  0.753 | <= 0.5   |
|      0.90 | stratum:theta-cell:Foundation:4:-1.7:classifiedBandAccuracyLower95  |  0.000 | >= 0.9   |
|      0.90 | stratum:theta-cell:Independent:0:-1.2:credibleCoverageLower95       |  0.599 | >= 0.85  |
|      0.90 | stratum:theta-cell:Independent:0:-1.2:absoluteBiasUpper95           |  0.551 | <= 0.1   |
|      0.90 | stratum:theta-cell:Independent:0:-1.2:rmseUpper95                   |  0.730 | <= 0.5   |
|      0.90 | stratum:theta-cell:Independent:1:-0.6:credibleCoverageUpper95       |  0.967 | <= 0.95  |
|      0.90 | stratum:theta-cell:Independent:1:-0.6:absoluteBiasUpper95           |  0.339 | <= 0.1   |
|      0.90 | stratum:theta-cell:Independent:2:0:credibleCoverageUpper95          |  0.975 | <= 0.95  |
|      0.90 | stratum:theta-cell:Independent:3:0.6:credibleCoverageUpper95        |  0.957 | <= 0.95  |
|      0.90 | stratum:theta-cell:Independent:3:0.6:absoluteBiasUpper95            |  0.356 | <= 0.1   |
|      0.90 | stratum:theta-cell:Independent:4:1.2:credibleCoverageLower95        |  0.669 | >= 0.85  |
|      0.90 | stratum:theta-cell:Independent:4:1.2:absoluteBiasUpper95            |  0.503 | <= 0.1   |
|      0.90 | stratum:theta-cell:Independent:4:1.2:rmseUpper95                    |  0.692 | <= 0.5   |
|      0.90 | stratum:theta-cell:Advanced:0:1.7:credibleCoverageLower95           |  0.584 | >= 0.85  |
|      0.90 | stratum:theta-cell:Advanced:0:1.7:absoluteBiasUpper95               |  0.604 | <= 0.1   |
|      0.90 | stratum:theta-cell:Advanced:0:1.7:rmseUpper95                       |  0.788 | <= 0.5   |
|      0.90 | stratum:theta-cell:Advanced:0:1.7:classifiedBandAccuracyLower95     |  0.002 | >= 0.9   |
|      0.90 | stratum:theta-cell:Advanced:1:2:credibleCoverageLower95             |  0.566 | >= 0.85  |
|      0.90 | stratum:theta-cell:Advanced:1:2:absoluteBiasUpper95                 |  0.597 | <= 0.1   |
|      0.90 | stratum:theta-cell:Advanced:1:2:rmseUpper95                         |  0.765 | <= 0.5   |
|      0.90 | stratum:theta-cell:Advanced:1:2:classifiedBandAccuracyLower95       |  0.006 | >= 0.9   |
|      0.90 | stratum:theta-cell:Advanced:2:2.3:credibleCoverageLower95           |  0.412 | >= 0.85  |
|      0.90 | stratum:theta-cell:Advanced:2:2.3:absoluteBiasUpper95               |  0.680 | <= 0.1   |
|      0.90 | stratum:theta-cell:Advanced:2:2.3:rmseUpper95                       |  0.818 | <= 0.5   |
|      0.90 | stratum:theta-cell:Advanced:2:2.3:classifiedBandAccuracyLower95     |  0.309 | >= 0.9   |
|      0.90 | stratum:theta-cell:Advanced:3:2.6:credibleCoverageLower95           |  0.353 | >= 0.85  |
|      0.90 | stratum:theta-cell:Advanced:3:2.6:absoluteBiasUpper95               |  0.713 | <= 0.1   |
|      0.90 | stratum:theta-cell:Advanced:3:2.6:rmseUpper95                       |  0.828 | <= 0.5   |
|      0.90 | stratum:theta-cell:Advanced:3:2.6:classifiedBandAccuracyLower95     |  0.779 | >= 0.9   |
|      0.90 | stratum:theta-cell:Advanced:4:2.9:credibleCoverageLower95           |  0.363 | >= 0.85  |
|      0.90 | stratum:theta-cell:Advanced:4:2.9:absoluteBiasUpper95               |  0.773 | <= 0.1   |
|      0.90 | stratum:theta-cell:Advanced:4:2.9:rmseUpper95                       |  0.871 | <= 0.5   |
|      0.90 | stratum:cut-distance:NEAR_CUT:credibleCoverageLower95               |  0.586 | >= 0.85  |
|      0.90 | stratum:cut-distance:NEAR_CUT:confidentMisclassificationRateUpper95 |  0.235 | <= 0.01  |
|      0.90 | stratum:cut-distance:INTERIOR:credibleCoverageLower95               |  0.598 | >= 0.85  |
|      0.90 | stratum:cut-distance:INTERIOR:rmseUpper95                           |  0.732 | <= 0.5   |
|      0.90 | stratum:cut-distance:INTERIOR:classifiedBandAccuracyLower95         |  0.844 | >= 0.9   |
|      0.95 | rmseUpper95                                                         |  0.599 | <= 0.5   |
|      0.95 | credibleCoverageLower95                                             |  0.626 | >= 0.85  |
|      0.95 | classificationRateLower95                                           |  0.202 | >= 0.8   |
|      0.95 | requiredRootClassificationRateLower95                               |  0.184 | >= 0.75  |
|      0.95 | maximumExposureRate                                                 |  0.980 | <= 0.9   |
|      0.95 | maximumTestOverlapRate                                              |  1.000 | <= 0.9   |
|      0.95 | sampledMaximumPairwiseFormOverlapRate                               |  1.000 | <= 0.9   |
|      0.95 | stratum:band:Foundation:credibleCoverageLower95                     |  0.501 | >= 0.85  |
|      0.95 | stratum:band:Foundation:absoluteBiasUpper95                         |  0.575 | <= 0.1   |
|      0.95 | stratum:band:Foundation:rmseUpper95                                 |  0.669 | <= 0.5   |
|      0.95 | stratum:band:Foundation:classifiedBandAccuracyLower95               |  0.768 | >= 0.9   |
|      0.95 | stratum:band:Advanced:credibleCoverageLower95                       |  0.497 | >= 0.85  |
|      0.95 | stratum:band:Advanced:absoluteBiasUpper95                           |  0.586 | <= 0.1   |
|      0.95 | stratum:band:Advanced:rmseUpper95                                   |  0.678 | <= 0.5   |
|      0.95 | stratum:band:Advanced:classifiedBandAccuracyLower95                 |  0.784 | >= 0.9   |
|      0.95 | stratum:root:1:credibleCoverageLower95                              |  0.770 | >= 0.85  |
|      0.95 | stratum:root:1:rmseUpper95                                          |  0.660 | <= 0.5   |
|      0.95 | stratum:root:6:credibleCoverageLower95                              |  0.768 | >= 0.85  |
|      0.95 | stratum:root:6:rmseUpper95                                          |  0.679 | <= 0.5   |
|      0.95 | stratum:item-type:NUMERICAL:credibleCoverageLower95                 |  0.356 | >= 0.85  |
|      0.95 | stratum:item-type:NUMERICAL:rmseUpper95                             |  1.204 | <= 0.5   |
|      0.95 | stratum:item-type:NUMERICAL:classifiedBandAccuracyLower95           |  0.782 | >= 0.9   |
|      0.95 | stratum:item-type:SC:credibleCoverageLower95                        |  0.302 | >= 0.85  |
|      0.95 | stratum:item-type:SC:absoluteBiasUpper95                            |  0.134 | <= 0.1   |
|      0.95 | stratum:item-type:SC:rmseUpper95                                    |  1.489 | <= 0.5   |
|      0.95 | stratum:item-type:SC:classifiedBandAccuracyLower95                  |  0.000 | >= 0.9   |
|      0.95 | stratum:item-type:MC:credibleCoverageLower95                        |  0.335 | >= 0.85  |
|      0.95 | stratum:item-type:MC:absoluteBiasUpper95                            |  0.105 | <= 0.1   |
|      0.95 | stratum:item-type:MC:rmseUpper95                                    |  1.308 | <= 0.5   |
|      0.95 | stratum:item-type:MC:classifiedBandAccuracyLower95                  |  0.000 | >= 0.9   |
|      0.95 | stratum:item-type:KPRIM:credibleCoverageLower95                     |  0.336 | >= 0.85  |
|      0.95 | stratum:item-type:KPRIM:rmseUpper95                                 |  1.294 | <= 0.5   |
|      0.95 | stratum:item-type:KPRIM:classifiedBandAccuracyLower95               |  0.000 | >= 0.9   |
|      0.95 | stratum:item-type:FREE_TEXT:credibleCoverageLower95                 |  0.356 | >= 0.85  |
|      0.95 | stratum:item-type:FREE_TEXT:rmseUpper95                             |  1.205 | <= 0.5   |
|      0.95 | stratum:item-type:FREE_TEXT:classifiedBandAccuracyLower95           |  0.782 | >= 0.9   |
|      0.95 | stratum:course-cohort:COHORT_A:credibleCoverageLower95              |  0.626 | >= 0.85  |
|      0.95 | stratum:course-cohort:COHORT_A:rmseUpper95                          |  0.603 | <= 0.5   |
|      0.95 | stratum:course-cohort:COHORT_B:credibleCoverageLower95              |  0.612 | >= 0.85  |
|      0.95 | stratum:course-cohort:COHORT_B:rmseUpper95                          |  0.598 | <= 0.5   |
|      0.95 | stratum:course-cohort:COHORT_C:credibleCoverageLower95              |  0.614 | >= 0.85  |
|      0.95 | stratum:course-cohort:COHORT_C:rmseUpper95                          |  0.609 | <= 0.5   |
|      0.95 | stratum:theta-cell:Foundation:0:-2.9:credibleCoverageLower95        |  0.317 | >= 0.85  |
|      0.95 | stratum:theta-cell:Foundation:0:-2.9:absoluteBiasUpper95            |  0.704 | <= 0.1   |
|      0.95 | stratum:theta-cell:Foundation:0:-2.9:rmseUpper95                    |  0.768 | <= 0.5   |
|      0.95 | stratum:theta-cell:Foundation:1:-2.6:credibleCoverageLower95        |  0.434 | >= 0.85  |
|      0.95 | stratum:theta-cell:Foundation:1:-2.6:absoluteBiasUpper95            |  0.631 | <= 0.1   |
|      0.95 | stratum:theta-cell:Foundation:1:-2.6:rmseUpper95                    |  0.716 | <= 0.5   |
|      0.95 | stratum:theta-cell:Foundation:1:-2.6:classifiedBandAccuracyLower95  |  0.817 | >= 0.9   |
|      0.95 | stratum:theta-cell:Foundation:2:-2.3:credibleCoverageLower95        |  0.461 | >= 0.85  |
|      0.95 | stratum:theta-cell:Foundation:2:-2.3:absoluteBiasUpper95            |  0.586 | <= 0.1   |
|      0.95 | stratum:theta-cell:Foundation:2:-2.3:rmseUpper95                    |  0.673 | <= 0.5   |
|      0.95 | stratum:theta-cell:Foundation:2:-2.3:classifiedBandAccuracyLower95  |  0.359 | >= 0.9   |
|      0.95 | stratum:theta-cell:Foundation:3:-2:credibleCoverageLower95          |  0.519 | >= 0.85  |
|      0.95 | stratum:theta-cell:Foundation:3:-2:absoluteBiasUpper95              |  0.584 | <= 0.1   |
|      0.95 | stratum:theta-cell:Foundation:3:-2:rmseUpper95                      |  0.686 | <= 0.5   |
|      0.95 | stratum:theta-cell:Foundation:3:-2:classifiedBandAccuracyLower95    |  0.000 | >= 0.9   |
|      0.95 | stratum:theta-cell:Foundation:4:-1.7:credibleCoverageLower95        |  0.643 | >= 0.85  |
|      0.95 | stratum:theta-cell:Foundation:4:-1.7:absoluteBiasUpper95            |  0.441 | <= 0.1   |
|      0.95 | stratum:theta-cell:Foundation:4:-1.7:rmseUpper95                    |  0.551 | <= 0.5   |
|      0.95 | stratum:theta-cell:Foundation:4:-1.7:classifiedBandAccuracyLower95  |  0.000 | >= 0.9   |
|      0.95 | stratum:theta-cell:Independent:0:-1.2:credibleCoverageLower95       |  0.745 | >= 0.85  |
|      0.95 | stratum:theta-cell:Independent:0:-1.2:absoluteBiasUpper95           |  0.352 | <= 0.1   |
|      0.95 | stratum:theta-cell:Independent:0:-1.2:rmseUpper95                   |  0.514 | <= 0.5   |
|      0.95 | stratum:theta-cell:Independent:1:-0.6:credibleCoverageUpper95       |  0.953 | <= 0.95  |
|      0.95 | stratum:theta-cell:Independent:1:-0.6:absoluteBiasUpper95           |  0.240 | <= 0.1   |
|      0.95 | stratum:theta-cell:Independent:2:0:credibleCoverageUpper95          |  0.957 | <= 0.95  |
|      0.95 | stratum:theta-cell:Independent:3:0.6:absoluteBiasUpper95            |  0.255 | <= 0.1   |
|      0.95 | stratum:theta-cell:Independent:4:1.2:credibleCoverageLower95        |  0.769 | >= 0.85  |
|      0.95 | stratum:theta-cell:Independent:4:1.2:absoluteBiasUpper95            |  0.345 | <= 0.1   |
|      0.95 | stratum:theta-cell:Independent:4:1.2:rmseUpper95                    |  0.513 | <= 0.5   |
|      0.95 | stratum:theta-cell:Advanced:0:1.7:credibleCoverageLower95           |  0.630 | >= 0.85  |
|      0.95 | stratum:theta-cell:Advanced:0:1.7:absoluteBiasUpper95               |  0.478 | <= 0.1   |
|      0.95 | stratum:theta-cell:Advanced:0:1.7:rmseUpper95                       |  0.585 | <= 0.5   |
|      0.95 | stratum:theta-cell:Advanced:0:1.7:classifiedBandAccuracyLower95     |  0.000 | >= 0.9   |
|      0.95 | stratum:theta-cell:Advanced:1:2:credibleCoverageLower95             |  0.587 | >= 0.85  |
|      0.95 | stratum:theta-cell:Advanced:1:2:absoluteBiasUpper95                 |  0.520 | <= 0.1   |
|      0.95 | stratum:theta-cell:Advanced:1:2:rmseUpper95                         |  0.623 | <= 0.5   |
|      0.95 | stratum:theta-cell:Advanced:1:2:classifiedBandAccuracyLower95       |  0.000 | >= 0.9   |
|      0.95 | stratum:theta-cell:Advanced:2:2.3:credibleCoverageLower95           |  0.412 | >= 0.85  |
|      0.95 | stratum:theta-cell:Advanced:2:2.3:absoluteBiasUpper95               |  0.628 | <= 0.1   |
|      0.95 | stratum:theta-cell:Advanced:2:2.3:rmseUpper95                       |  0.715 | <= 0.5   |
|      0.95 | stratum:theta-cell:Advanced:2:2.3:classifiedBandAccuracyLower95     |  0.376 | >= 0.9   |
|      0.95 | stratum:theta-cell:Advanced:3:2.6:credibleCoverageLower95           |  0.373 | >= 0.85  |
|      0.95 | stratum:theta-cell:Advanced:3:2.6:absoluteBiasUpper95               |  0.659 | <= 0.1   |
|      0.95 | stratum:theta-cell:Advanced:3:2.6:rmseUpper95                       |  0.733 | <= 0.5   |
|      0.95 | stratum:theta-cell:Advanced:3:2.6:classifiedBandAccuracyLower95     |  0.883 | >= 0.9   |
|      0.95 | stratum:theta-cell:Advanced:4:2.9:credibleCoverageLower95           |  0.356 | >= 0.85  |
|      0.95 | stratum:theta-cell:Advanced:4:2.9:absoluteBiasUpper95               |  0.724 | <= 0.1   |
|      0.95 | stratum:theta-cell:Advanced:4:2.9:rmseUpper95                       |  0.785 | <= 0.5   |
|      0.95 | stratum:cut-distance:NEAR_CUT:credibleCoverageLower95               |  0.725 | >= 0.85  |
|      0.95 | stratum:cut-distance:NEAR_CUT:confidentMisclassificationRateUpper95 |  0.062 | <= 0.01  |
|      0.95 | stratum:cut-distance:INTERIOR:credibleCoverageLower95               |  0.626 | >= 0.85  |
|      0.95 | stratum:cut-distance:INTERIOR:rmseUpper95                           |  0.598 | <= 0.5   |

The v2 scenario catalog contains 40 executed profiles across model recovery, boundaries, misspecification, hierarchy, item types, calibration, Research collection, retakes, and pool sizes. Only 24 compact canonical traces are retained; all 7002 canonical outcomes contribute to the aggregate and stratum metrics.

EXECUTED means that a probe completed and its declared invariant was evaluated; it is not a psychometric pass. Production-routed near-cut strata, injected-DIF detection, cap, and exhaustion checks are included in the blocking gate table above.

| Scenario                             | Category         | Learners |   Bias |  RMSE | Coverage | Classified | Execution |
| ------------------------------------ | ---------------- | -------: | -----: | ----: | -------: | ---------: | --------- |
| canonical-depth-five-mixed           | MODEL_RECOVERY   |      144 | -0.019 | 0.704 |    74.3% |      66.7% | EXECUTED  |
| cut-sides                            | BOUNDARY         |     1000 | -0.012 | 0.547 |    85.7% |      48.2% | EXECUTED  |
| cap-abstention                       | BOUNDARY         |      144 | -0.078 | 0.673 |    73.6% |      66.7% | EXECUTED  |
| pool-exhaustion-abstention           | BOUNDARY         |      144 | -0.017 | 0.683 |    77.8% |      66.0% | EXECUTED  |
| response-80-20                       | MISSPECIFICATION |      144 |  0.514 | 1.160 |    52.8% |      67.4% | EXECUTED  |
| response-85-15                       | MISSPECIFICATION |      144 |  0.642 | 1.198 |    50.7% |      70.8% | EXECUTED  |
| response-90-10                       | MISSPECIFICATION |      144 |  0.796 | 1.053 |    48.6% |      72.9% | EXECUTED  |
| response-95-5                        | MISSPECIFICATION |      144 |  1.060 | 1.161 |    31.9% |      68.8% | EXECUTED  |
| response-deterministic-threshold     | MISSPECIFICATION |      144 |  1.191 | 1.193 |     0.0% |      33.3% | EXECUTED  |
| incorrect-provisional-b              | MISSPECIFICATION |      144 |  0.256 | 0.716 |    75.7% |      68.8% | EXECUTED  |
| true-a-0.8                           | MISSPECIFICATION |      144 | -0.124 | 0.829 |    65.3% |      62.5% | EXECUTED  |
| true-a-1                             | MISSPECIFICATION |      144 |  0.037 | 0.717 |    77.1% |      66.7% | EXECUTED  |
| true-a-1.2                           | MISSPECIFICATION |      144 |  0.003 | 0.617 |    84.0% |      70.8% | EXECUTED  |
| true-a-1.5                           | MISSPECIFICATION |      144 |  0.045 | 0.684 |    79.9% |      64.6% | EXECUTED  |
| item-drift                           | MISSPECIFICATION |      144 | -0.301 | 0.764 |    70.1% |      65.3% | EXECUTED  |
| item-type-dif-sc                     | MISSPECIFICATION |     1152 | -0.052 | 0.662 |    79.1% |      66.0% | EXECUTED  |
| course-cohort-dif                    | MISSPECIFICATION |     1152 | -0.188 | 0.720 |    75.9% |      68.1% | EXECUTED  |
| adjacent-band-mislabel               | MISSPECIFICATION |      144 | -0.240 | 0.588 |    83.3% |      78.5% | EXECUTED  |
| heterogeneous-root-abilities         | HIERARCHY        |      144 |  0.033 | 0.575 |    62.5% |      75.7% | EXECUTED  |
| heterogeneous-leaf-abilities         | HIERARCHY        |      144 |  0.019 | 0.671 |    77.8% |      66.7% | EXECUTED  |
| all-correct                          | BOUNDARY         |      144 |  3.654 | 4.186 |     0.0% |     100.0% | EXECUTED  |
| all-wrong                            | BOUNDARY         |      144 | -3.762 | 4.281 |     0.0% |     100.0% | EXECUTED  |
| guessing-only                        | BOUNDARY         |      144 | -3.558 | 4.113 |     5.6% |     100.0% | EXECUTED  |
| item-type-numerical                  | ITEM_TYPE        |      144 |  0.028 | 1.258 |    68.8% |      63.2% | EXECUTED  |
| item-type-sc                         | ITEM_TYPE        |      144 |  0.008 | 1.562 |    52.1% |      77.1% | EXECUTED  |
| item-type-mc                         | ITEM_TYPE        |      144 | -0.089 | 1.287 |    59.7% |      57.6% | EXECUTED  |
| item-type-kprim                      | ITEM_TYPE        |      144 | -0.023 | 1.431 |    47.9% |      68.1% | EXECUTED  |
| item-type-free_text                  | ITEM_TYPE        |      144 | -0.043 | 1.222 |    70.1% |      60.4% | EXECUTED  |
| item-type-mixed                      | ITEM_TYPE        |      144 |  0.047 | 0.665 |    79.2% |      68.1% | EXECUTED  |
| calibrated-provisional-contamination | CALIBRATION      |      144 | -0.015 | 0.701 |    80.6% |      61.8% | EXECUTED  |
| research-connected-anchors           | RESEARCH         |        0 |   null |  null |     null |       null | EXECUTED  |
| research-disconnected-anchors        | RESEARCH         |        0 |   null |  null |     null |       null | EXECUTED  |
| research-known-inclusion-probability | RESEARCH         |        0 |   null |  null |     null |       null | EXECUTED  |
| retake-cooldown                      | RETAKE           |        0 |   null |  null |     null |       null | EXECUTED  |
| retake-latest-result                 | RETAKE           |        0 |   null |  null |     null |       null | EXECUTED  |
| retake-overlap-control               | RETAKE           |        0 |   null |  null |     null |       null | EXECUTED  |
| first-exposure-calibration           | RETAKE           |        0 |   null |  null |     null |       null | EXECUTED  |
| pool-sparse                          | POOL_SIZE        |      144 | -0.301 | 1.150 |    53.5% |      43.1% | EXECUTED  |
| pool-target                          | POOL_SIZE        |      144 | -0.028 | 0.694 |    75.7% |      63.9% | EXECUTED  |
| pool-rich                            | POOL_SIZE        |      144 | -0.040 | 0.418 |    85.4% |      90.3% | EXECUTED  |
