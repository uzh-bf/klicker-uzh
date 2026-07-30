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
