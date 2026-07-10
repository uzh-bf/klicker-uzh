# Generic Example: Nested Diagnostic Practice Quiz

This example illustrates the planning method without relying on a particular institution, repository, or private prototype.

## Request

> Turn an existing practice quiz into an adaptive diagnostic mode. Questions map to a reusable competence tree with up to five levels of nesting. Show students one result line with uncertainty, plus results for all competences.

## Domain Decisions

- Keep `PracticeQuiz` as the activity and add `STANDARD` / `ADAPTIVE` modes.
- Store reusable competence trees separately from quiz-specific configuration.
- Treat depth-1 nodes as root competences and deeper nodes as subcompetences.
- Assign each question to one leaf and one proficiency level.
- Let a quiz disable nodes/items and override root weights without mutating the tree.
- Snapshot the effective pool when publishing because source questions remain editable.

## Correct Hierarchical Computation

Assume one response belongs to this path:

```text
Communication
└── Written communication
    └── Formal reports
```

The response contributes to estimates for all three nodes. Each node is estimated from all responses in its subtree.

Do not compute the root by averaging the two child estimates. Pool the underlying item responses directly at the root. Small child estimates are noisy and may have different sample sizes.

For root competences `k = 1..K`, normalize curricular weights so `sum(w_k) = 1` and compute:

```text
overall_theta = sum(w_k * theta_k)
overall_se = sqrt(sum(w_k^2 * se_k^2))
```

This standard-error propagation assumes root response sets are disjoint. Do not add subcompetence estimates to the overall result; their responses already contributed to their root and would be counted twice.

## One Honest Result Chart

Use response order on the x-axis and the weighted overall estimate on the y-axis. Render proficiency level bands instead of raw theta labels and use the standard error to create an estimated-range ribbon.

Delay the first point until every enabled root has evidence. Otherwise, renormalizing weights over only observed roots creates an artificial jump when a new competence appears.

The final point, result badge, stored final estimate, and textual summary must come from one server computation. Show the nested final node results below the chart as an expandable outline. Do not add one line per node and do not connect unrelated nodes as if they formed a time series.

## Implementation Slices

1. Tree schema, validation, ownership, course reuse, and permissions.
2. Adaptive quiz config, readiness, and immutable publication pool.
3. Server-authoritative attempts, grading, hierarchy estimates, and participant-safe serialization.
4. Production-shaped simulation and response-normalization gates.
5. Host-product tree editor, element mapping, and adaptive branch in the existing quiz wizard.
6. Participant runtime, one-line result trajectory, nested profile, and lecturer aggregates.
7. Feature-flagged pilot, calibration, observability, legacy cleanup, and broad rollout.

Each slice ends with targeted service or package tests. UI slices add localization, accessibility, real browser screenshots, and payload inspection.
