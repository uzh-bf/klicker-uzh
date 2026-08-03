# Adaptive IRT Redesign

- **Date:** 2026-07-31
- **Status:** Approved design
- **Product surface:** Adaptive mode of Practice Quiz
- **Initial production scope:** Formative Diagnostic only

## 1. Purpose

This design replaces the current provisional adaptive measurement model with a
defensible IRT-based model that separates:

- learner proficiency bands,
- item difficulty,
- curricular content weights,
- statistical uncertainty, and
- publication-time calibration evidence.

It preserves the existing competence-tree, Practice Quiz, permission,
publication-snapshot, anonymous cohort, and server-authoritative delivery
architecture.

The motivating evidence is
[`project/2026-07-31-adaptive-learning-psychometric-simulation-review.md`](../../../project/2026-07-31-adaptive-learning-psychometric-simulation-review.md).
The current implementation correctly recovers learners generated from its own
3PL model, but it does not support a mastery interpretation of authored item
levels. A learner with 90% success on items at or below Independent was labeled
Advanced in 35.1% of simulated attempts.

## 2. Product Decisions

The following decisions are locked:

1. Adaptive learning remains a mode of Practice Quiz.
2. Competence trees remain reusable across courses.
3. The initial production release is formative Diagnostic only.
4. Placement remains unavailable until a calibrated bank passes a separate
   psychometric review.
5. Competence-tree levels are proficiency bands on a latent theta scale.
6. Item difficulty `b` is a separate continuous parameter on that scale.
7. An author-selected item difficulty level is a blueprint category and
   provisional prior for `b`, not a mastery statement.
8. Students do not see raw theta or item parameters.
9. A cap-exhausted point estimate is not automatically a classified level.
10. Published quizzes and historical attempts retain immutable measurement
    meaning.

## 3. Goals

- Produce stable estimates for short adaptive Practice Quizzes, including
  all-correct and all-wrong response strings.
- Report proficiency bands with explicit, calibrated uncertainty.
- Estimate nested competence-tree nodes without double counting.
- Support mixed Numerical, SC, MC, KPRIM, and controlled Free Text pools.
- Make item-bank quality, calibration status, and information gaps visible
  before publication.
- Preserve scale meaning when a tree is reused across courses.
- Make uncertain and near-boundary outcomes honest in student and lecturer
  results.
- Establish deterministic simulation, pilot, monitoring, and rollback gates.

## 4. Non-Goals

- No standalone adaptive activity.
- No high-stakes placement in the initial rollout.
- No claim that proficiency means mastery of every item below a band.
- No open-ended language-production scoring.
- No multidimensional IRT model in the initial implementation.
- No online recalibration that changes item parameters during an attempt.
- No student-facing raw theta, item curves, or calibration diagnostics.
- No user-facing simulation. Synthetic scenarios and reports are internal
  engineering/CI evidence only, with no product UI, public GraphQL operation,
  user-triggered worker, or runtime report endpoint.
- No polytomous IRT model in the first validated runtime. Partial scores are
  retained for future calibration work but do not yet update theta.

## 5. Measurement Vocabulary

### 5.1 Proficiency Band

A proficiency band is a named interval on the tree's theta scale. Bands are
defined by explicit cut scores, not by automatically spacing level anchors.

For ordered levels `L_0...L_n`, each level stores:

- a display label and order,
- a lower cut score, except the first level whose lower bound is negative
  infinity, and
- a finite provisional item-difficulty prior.

The upper bound of a level is the next level's lower cut score. The last level
has positive-infinity as its upper bound.

### 5.2 Item Difficulty

Item difficulty `b` is the IRT location parameter. In a 3PL model, a learner at
`theta = b` has success probability `(1 + c) / 2`; in a 2PL model the
probability is 0.5.

The author-selected expected difficulty level:

- assigns the item to a blueprint and coverage cell,
- supplies the initial prior mean for `b`, and
- never overrides a valid calibrated `b`.

### 5.3 Calibration

A calibration is an immutable, versioned parameter set for one competence-tree
assignment and one element version. It records the measurement model,
parameters, parameter uncertainty, evidence, diagnostics, status, and scale
version.

### 5.4 Classification

A node is classified only when the posterior probability of one proficiency
band reaches the configured classification probability threshold after minimum
content evidence is satisfied.

A point estimate and a classified band are different concepts.

## 6. Scale Model

### 6.1 Versioned Scale

Introduce an immutable `CompetenceTreeScaleVersion` owned by one competence
tree. It contains:

- version number and lifecycle status,
- prior mean and standard deviation,
- numerical integration range and resolution,
- ordered level labels,
- explicit cut scores,
- provisional item-difficulty priors,
- classification policy version,
- creation actor and timestamp, and
- optional superseded-version reference.

Once referenced by a published pool or attempt, the scale version cannot be
edited. Changes create a new version.

### 6.2 Initial Prior

The initial operational prior is standard normal:

```text
theta ~ Normal(0, 1)
```

The prior is versioned with the scale. Research validation may approve a
different prior for a subject or population, but a course author cannot change
it as an ordinary quiz setting.

### 6.3 Explicit Cut Scores

Automatic `NEAREST` and `MASTERY` geometry is removed from the production
Diagnostic contract. Existing mapping helpers remain only for migration and
legacy attempt rendering.

Cut scores are:

- established through content standard-setting and pilot evidence,
- stored in the scale version,
- immutable for that version, and
- included in publication snapshots.

Changing a cut score creates a new scale version and requires revalidation of
the bank.

## 7. Item Response Models

### 7.1 First Validated Runtime

The first validated runtime supports dichotomous responses:

| Element type         | IRT model          | Guessing parameter                                     |
| -------------------- | ------------------ | ------------------------------------------------------ |
| Numerical            | 2PL                | `c = 0`                                                |
| Controlled Free Text | 2PL                | `c = 0`                                                |
| SC                   | 3PL with fixed `c` | Exact random full-correct probability                  |
| MC                   | 3PL with fixed `c` | Exact random full-correct response-pattern probability |
| KPRIM                | 3PL with fixed `c` | Exact random full-correct response-pattern probability |

For MC and KPRIM, only a fully correct response updates the dichotomous IRT
likelihood. The canonical partial score is still stored and shown in ordinary
feedback. This limitation is explicit and instrumented for a future
polytomous-model decision.

### 7.2 Provisional Parameters

Before calibration:

- `a = 1.2`,
- `b` equals the selected level's provisional difficulty prior, and
- `c` follows the fixed response-format rule.

Provisional items cannot contribute to a validated Diagnostic classification.
They may be delivered as field-test items in Research mode, where their
responses are excluded from the reported theta update.

### 7.3 Calibrated Parameters

A calibrated parameter set may provide item-specific `a` and `b`. The first
validated model keeps `c` fixed by response format because estimating item-level
3PL lower asymptotes requires substantially stronger evidence and model
identification.

Parameter bounds, uncertainty, and fit gates are enforced by calibration
validation, not silently clamped at runtime.

## 8. Calibration Lifecycle

Each calibration has one status:

- `PROVISIONAL`: author prior only; not eligible for Diagnostic scoring.
- `PILOT`: empirical estimate exists but has not passed all release gates.
- `CALIBRATED`: approved for the referenced scale version and Diagnostic use.
- `FLAGGED`: retained for audit but excluded from new pools.
- `RETIRED`: no longer delivered; historical snapshots remain valid.

The calibration record includes:

- tree, scale version, assignment, element id, and element version,
- model type and model implementation version,
- `a`, `b`, and fixed or estimated `c`,
- parameter standard errors or posterior intervals,
- response and participant counts,
- fit statistics and warning codes,
- course-level DIF and drift diagnostics,
- calibration job and dataset version,
- reviewer/approval actor, and
- creation and approval timestamps.

No universal response-count threshold is hard-coded as proof of calibration.
Simulation and fit gates depend on the model, parameter distribution, pool, and
population. The UI reports evidence counts, but `CALIBRATED` requires the
versioned policy to pass.

## 9. Cross-Course Reuse And Scale Stability

Calibration is scoped to the competence-tree assignment and scale version,
rather than globally to the source element. The same element can measure
different constructs when assigned to different trees.

Responses from linked courses may contribute to calibration only when:

- the tree owner has enabled calibration use,
- the response is associated with the same immutable element and scale
  versions,
- only pseudonymous scoring facts enter the calibration dataset,
- free-text response content and participant identity are excluded, and
- course-level DIF and parameter drift are evaluated.

Anchor items connect scale versions and course cohorts. A scale version cannot
be declared comparable with another version without enough approved anchors or
an explicit linking/equating analysis.

## 10. Bayesian Estimation

### 10.1 EAP Posterior

Replace the unregularized final MLE and separate routing MAP estimator with one
Expected A Posteriori posterior implementation.

For every reporting node:

```text
posterior(theta | responses)
  proportional to
prior(theta) * product(item response likelihoods)
```

The runtime computes likelihoods in log space over a fixed, versioned
quadrature grid, normalizes with log-sum-exp, and derives:

- posterior mean,
- posterior variance and standard deviation,
- central credible interval,
- probability mass in every proficiency band, and
- posterior expected item information.

The initial implementation uses a grid that extends beyond the display range so
that uniform response strings do not collapse to a reporting boundary. Chart
normalization may clamp visually; estimation may not silently clamp theta.

EAP was selected because it remains finite for uniform response patterns and
provides posterior uncertainty directly. Bock and Mislevy's CAT simulations
describe the estimator and the relationship between posterior standard
deviation and measurement error:
<https://hdl.handle.net/11299/101546>.

### 10.2 Estimator Version

Every publication pool and attempt stores a measurement-model implementation
version. An attempt uses one version from start to completion. Deployment or
rollback cannot switch estimators mid-attempt.

### 10.3 Response Propagation

Each response contributes once to:

- its assigned leaf,
- each ancestor on its immutable published node path, and
- no unrelated node.

A parent posterior is computed from the pooled responses of all descendant
leaves. Parent estimates are not formed by averaging child level labels or
child point estimates.

## 11. Weights And Overall Composite

### 11.1 Hierarchical Content Weights

Weights are normalized among enabled siblings:

- root weights define top-level curricular importance,
- nested weights define desired content allocation within their parent, and
- quiz overrides may change enabled nodes and weights before publication.

The effective leaf allocation weight is the product of normalized sibling
weights along its path.

Weights control blueprint allocation. They do not modify item likelihoods.

### 11.2 Overall Result

The overall result is a weighted composite of independent top-level competence
posteriors. It is not presented as an additional latent construct.

The runtime creates the composite distribution through deterministic discrete
convolution of weighted root posterior grids. From that distribution it derives
the overall mean, credible interval, and band probabilities.

Only top-level roots enter the composite. Adding descendant estimates again
would double count their responses.

The UI calls this result the **overall proficiency profile** and always keeps
the top-level and nested competence results available.

## 12. Classification And Stopping

### 12.1 Minimum Evidence

Before a node may be classified:

- every enabled leaf under the required root meets its minimum response count,
- the root meets its minimum total response count,
- every response used for classification comes from a calibrated item, and
- no integrity or model-version error is present.

### 12.2 Band Probability

For each node and overall composite, the runtime sums posterior mass within each
explicit level band.

Diagnostic uses a hidden preset threshold rather than an ordinary author knob.
Research and shadow runs evaluate `0.80`, `0.90`, and `0.95`. The initial
Diagnostic release uses the lowest threshold that passes every release gate,
and it may never be lower than `0.80`:

```text
classified when max(P(theta in band | responses)) >= approved threshold
```

Research mode may compare thresholds, but a published Diagnostic snapshots the
approved value.

### 12.3 Stop Rules

The attempt stops when the first applicable condition is met:

1. every required top-level competence is classified,
2. the total question cap is reached,
3. all eligible items are exhausted,
4. node or leaf caps prevent further evidence, or
5. an integrity/configuration failure makes continuation unsafe.

Leaf classifications are reported when available but do not all gate quiz
completion. Requiring every nested leaf to classify would make deep trees
unbounded in practice. Readiness and minimum-evidence rules still guarantee
that every enabled leaf receives evidence.

### 12.4 Uncertain Outcomes

When a non-classification stop fires:

- preserve posterior summaries and band probabilities,
- set classified level to null,
- return the two leading adjacent bands when their combined mass explains the
  uncertainty,
- use `BETWEEN_LEVELS`, `INSUFFICIENT_EVIDENCE`, or `POOL_LIMITED` result
  language, and
- never convert the posterior mean into an equally confident final label.

CAT classification near cut scores naturally requires more information. The
runtime may abstain rather than manufacture certainty. Research on CAT
classification stopping likewise distinguishes precision and maximum-length
decisions: <https://pmc.ncbi.nlm.nih.gov/articles/PMC5978606/>.

## 13. Item Selection

Selection is server-authoritative and operates in three stages.

### 13.1 Content Constraint

Choose an active root and leaf using:

1. missing minimum evidence,
2. deficit from the effective hierarchical allocation weight,
3. contribution of the node's posterior variance to the overall composite,
4. leaf and ancestor question caps, and
5. required field-test allocation in Research mode.

This preserves content validity before statistical optimization.

### 13.2 Posterior Information

For each eligible item in the selected leaf, compute expected information:

```text
E[I_i(theta)] = sum(posterior_mass(theta_k) * I_i(theta_k))
```

This replaces point-estimate information targeting and uses the selected
leaf/root posterior rather than a different root-wide estimate for every leaf.

### 13.3 Exposure Control

Select randomly from the approved high-information candidate set, subject to:

- item exposure ceiling,
- pool-utilization deficit,
- attempt-level non-repetition,
- immutable pool eligibility, and
- deterministic replay/audit data.

Content balancing, information targeting, and exposure control are separate CAT
responsibilities and must be validated together:
<https://pmc.ncbi.nlm.nih.gov/articles/PMC5968224/>.

## 14. Authoring Experience

### 14.1 Element Assignment

The existing pre-save assignment remains available for supported element types.
The author selects:

- competence tree,
- assignable subcompetence leaf,
- expected item difficulty level, and
- type-specific settings such as Numerical percent input.

The UI labels the level field **Expected item difficulty** and explains it in a
tooltip as an initial estimate used until calibration. It does not display `b`
to normal authors.

### 14.2 Calibration Status

Every assignment shows one status with an accessible icon and label:

- Provisional
- Pilot
- Calibrated
- Flagged
- Retired

Normal authors see evidence counts and actionable readiness messages. Tree
owners in Research mode can open parameter curves, intervals, fit, exposure,
DIF, drift, and calibration-history details.

### 14.3 Item-Bank Map

The competence-tree editor and adaptive quiz setup add an item-bank map that
shows:

- calibrated item locations across theta,
- proficiency cut scores,
- information coverage across the scale,
- counts by leaf, level blueprint, and item type,
- overexposed and underused items,
- provisional or flagged items, and
- gaps that block Diagnostic publication.

The existing coverage matrix remains as the content-blueprint view; it is no
longer treated as proof of psychometric readiness.

## 15. Publication Readiness

Diagnostic publication is blocked unless:

- one approved scale version is selected,
- every scoring pool item has an approved calibration for that scale and exact
  element version,
- each required leaf satisfies content minimums,
- test information is adequate across each reportable band and around each cut
  score,
- the configured caps and pool satisfy deterministic information/reachability
  checks,
- the configured duration and exposure ceilings satisfy the approved runtime
  policy that passed the internal release simulation suite,
- no calibration is flagged or stale, and
- all existing structural, permission, grading, and snapshot checks pass.

Research mode may publish provisional items, but:

- it is clearly marked as non-classifying,
- provisional responses are excluded from reported theta,
- students receive ordinary practice feedback rather than a proficiency band,
  and
- the course must be explicitly enabled for calibration collection.

## 16. Student Experience

### 16.1 Before And During

- The activity remains a Practice Quiz.
- The introduction calls it an adaptive diagnostic practice quiz.
- No live theta or proficiency band is shown.
- Progress represents completed blueprint coverage and evidence collection,
  never a false percentage of a fixed test length.
- Resume and start-over preserve the estimator and scale versions.

### 16.2 Result

The result page contains:

1. an overall response-order trajectory using posterior mean and a credible
   ribbon,
2. the classified overall proficiency band when the threshold was reached,
3. otherwise an explicit between-level or insufficient-evidence state,
4. the nested competence profile with classified and uncertain nodes,
5. confidence wording without raw theta, and
6. formative next steps linked to weaker or uncertain competences.

The final chart endpoint, stored result, level card, and nested profile all use
the same posterior computation.

## 17. Lecturer Experience

The anonymous results view adds:

- classified-band distribution,
- uncertain/between-level distribution,
- top-level and nested competence distributions,
- stop-reason and test-length distributions,
- uncertainty summaries,
- release cohort size and policy version, and
- calibrated-bank health and exposure summaries.

Existing fixed-release cohorts, small-bucket suppression, and complementary-cell
suppression remain mandatory.

Calibration diagnostics are restricted to the tree owner and authorized
calibration operations. Course collaborators receive readiness summaries but
not participant-level response data or raw calibration datasets.

## 18. Data And Privacy

Calibration input contains only:

- pseudonymous calibration subject id,
- immutable tree/scale/assignment/element/model versions,
- response category or canonical score,
- correctness,
- elapsed time when policy permits, and
- course cohort key for drift/DIF analysis.

It excludes:

- participant id, username, email, or study identifier,
- raw Free Text response content,
- course rosters,
- element solutions, and
- unrelated activity responses.

Calibration exports are generated outside the public repository and follow the
repository's safe database scripting and data-retention rules.

## 19. Permissions

- Tree owners manage scale versions and submit calibration candidates.
- Only an authorized calibration worker or administrative review path can mark
  a calibration `CALIBRATED`.
- Course-linked readers may consume an approved scale and see readiness
  summaries.
- Linking a tree to a course does not grant access to calibration datasets.
- Quiz owners cannot edit raw parameters in Diagnostic mode.
- Research overrides require tree ownership, course write access, and the
  course rollout flag.
- Participant APIs continue to redact theta, item parameters, solutions, and
  calibration metadata.

All permission boundaries require positive and negative service tests.

## 20. Publication, Attempts, And Rollback

The publication snapshot adds:

- scale version id,
- cut-score snapshot,
- model implementation version,
- calibration id and version for every item,
- classification threshold and policy version, and
- effective content-weight snapshot.

An active attempt never follows mutable source calibration rows.

Rollback rules:

- a feature flag can block new v2 attempts,
- existing attempts continue with their snapshotted estimator version,
- unpublication blocks resume and submit through the existing emergency path,
- no deployment rewrites historical results,
- a superseded scale or calibration affects only newly published pools, and
- migration rollback does not delete calibration or scale audit records.

## 21. Migration

### 21.1 Existing Trees

For each existing tree:

1. create a provisional scale version,
2. preserve its current band geometry by converting its active mapping rule into
   explicit cut scores,
3. preserve current level anchors as provisional item-difficulty priors,
4. mark every existing assignment `PROVISIONAL`, and
5. retain legacy mapping fields only for historical rendering until all old
   attempts are version-dispatched.

This migration preserves historical meaning; it does not claim existing
parameters are calibrated.

### 21.2 Existing Published Pools And Attempts

Existing published pools keep estimator version `IRT_V1`. Their attempts and
results continue through the legacy computation and rendering path.

New v2 Diagnostic publication is blocked until the selected scale and item bank
pass calibration readiness. There is no silent conversion of an active
published quiz to the new estimator.

## 22. Verification

### 22.1 Unit And Property Tests

- Posterior normalization and log-space stability.
- EAP recovery against a trusted external reference.
- 2PL and fixed-c 3PL response probabilities.
- All-correct, all-wrong, and pure-guessing estimates remain finite.
- Explicit band mass and cut-score edge behavior.
- Deterministic composite convolution.
- No response is counted twice in one node or composite.
- Hierarchical weight normalization and allocation.
- Provisional items never update validated Diagnostic estimates.
- Estimator/version immutability across resume and deployment.

### 22.2 Internal Simulation Matrix

The deterministic production-shaped matrix covers:

- theta grid across interiors and both sides of every cut score,
- all supported item types and realistic mixed pools,
- sparse, target, and rich banks,
- parameter recovery error and parameter drift,
- type and course DIF,
- heterogeneous root and leaf abilities,
- deep trees and unequal hierarchical weights,
- all-correct, all-wrong, guessing, and patterned responses,
- exposure and pool overlap,
- cap, exhausted, and uncertain outcomes,
- repeated attempts and retake policies, and
- provisional field-test contamination rejection.

This matrix is executable only through package tests and CI/release scripts.
It is not part of Manage or PWA, is not callable through public GraphQL or a
user-triggered worker, and does not expose reports, traces, metrics, seeds, or
statuses to any product user.

### 22.3 Initial Release Gates

The v2 Diagnostic candidate must satisfy all of these in the internal
deterministic simulation suite and separately in pilot holdout data:

- absolute theta bias no greater than `0.10` in band interiors,
- RMSE no greater than `0.50` in band interiors,
- 90% credible-interval empirical coverage between 85% and 95% by major theta
  stratum,
- at least 90% correct band assignment among classified learners away from cut
  neighborhoods,
- no more than 1% confidently wrong assignments by more than one adjacent band,
- near-cut learners abstain rather than exceeding the approved
  misclassification rate,
- zero forced classified labels after cap or pool exhaustion,
- zero unexpected node-cap, foreign-item, replay, or insufficient-root
  fallbacks,
- configured maximum item exposure and test-overlap limits pass,
- median and 95th-percentile length remain within the approved formative time
  budget, and
- every metric is reported overall and by proficiency band, root competence,
  item type, course cohort, and boundary-distance stratum.

The exact cut neighborhood and exposure limits are part of the immutable
calibration-policy version rather than hidden constants.

### 22.4 Service And Browser Verification

- Permission and publication negative tests.
- Immutable parameter and cut-score snapshot tests.
- Concurrent submit/resume/unpublish tests.
- Generated GraphQL contract checks proving participant redaction.
- Playwright journeys for Provisional, Pilot, Calibrated, Flagged, uncertain,
  between-level, and classified states.
- English/German desktop and mobile screenshots.
- Accessibility checks for charts, status icons, nested profile navigation, and
  non-color uncertainty cues.

## 23. Observability

Record aggregate, privacy-safe metrics for:

- starts, completions, abandons, and stop reasons,
- classified and abstained rates,
- posterior uncertainty and test length,
- item exposure and pool utilization,
- calibration-version usage,
- unexpected estimator/integrity failures,
- parameter drift and fit warnings, and
- result changes between candidate estimator versions in shadow mode.

Alerts fire for:

- any foreign/stale item submission accepted,
- missing calibration or scale snapshots,
- non-finite posterior state,
- exposure ceiling breach,
- sudden classification-rate shift,
- cut-neighborhood misclassification regression, or
- a calibration worker publishing an unapproved parameter set.

## 24. Rollout

### Phase A: Research And Shadow

- Build versioned scales, calibrations, EAP, and shadow computation.
- Collect pseudonymous field-test evidence.
- Compare v1 and v2 without exposing v2 levels to students.

### Phase B: Pilot Diagnostic

- Enable selected courses with calibrated banks.
- Use formative language and explicit uncertainty.
- Run internal synthetic checks, sealed-holdout validation, and operational
  monitoring without exposing simulation controls or artifacts in the product.

### Phase C: Validated Diagnostic

- Require all release gates, accessibility, privacy, operations, and external
  psychometric sign-off on calibration policy.
- Make v2 the default only for newly published Diagnostic pools.

### Phase D: Placement Evaluation

- Design a separate high-stakes classification policy.
- Revalidate cut scores, item bank, exposure, retake, and misclassification
  consequences.
- Enable Placement only after independent psychometric approval.

## 25. Design Rationale

This design deliberately favors calibrated abstention over frequent but
misleading labels. The primary product-quality metric is not how often the
system returns a level; it is how rarely it returns a confident wrong level,
while keeping quiz length acceptable.

It also treats adaptive delivery as a complete CAT system. Content balancing,
item information, exposure control, estimation, stopping, calibration,
publication integrity, and result language are one contract rather than
independent options.
