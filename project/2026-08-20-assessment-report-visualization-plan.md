# Assessment report comparison visualization

## Plan identity

- Plan: `project/2026-08-20-assessment-report-visualization-plan.md`
- Branch: `fix/assessment-report-visualization`
- Base: fresh `origin/v3` at `9f38b4e9a`
- Worktree: `trees/assessment-report-visualization`
- Target: `v3`
- PR: not opened
- Topology: one cohesive full-path PR; no stack unless a later ruling adds a
  new data or privacy contract

## Authority, terminal state, and pause conditions

- Authority: the user requested this plan artifact and the named local
  planning workflow. That authorizes the reversible local planning work,
  implementation work named by a later plan approval, repository-native
  checks, local commits, and browser evidence. It does not authorize pushing,
  opening or merging a PR, deployment, or production changes.
- Terminal state: the branch is locally ready for a draft PR after all slices,
  checks, browser evidence, documentation updates, and the integrated final
  review pass. Push and PR creation remain separate decisions.
- Pause and re-plan if implementation would publish an observed cohort maximum,
  add an exact rank or peer-score aggregate, change the percentile definition,
  add a V2 snapshot field, or otherwise change the public privacy contract.
- Pause before implementation if the required browser/runtime path cannot be
  established. Record the exact missing evidence instead of treating a build
  or static render as UI proof.

## Goal and non-goals

### Goal

Make the peer-comparison visualization in both the participant report export
and the public verified-credential page understandable and visually stable.
The result must distinguish the course's available points from participant
performance, explain the percentile in plain language, and remain honest about
the privacy-merged data that the credential snapshot contains.

### Non-goals

- Do not expose the highest score achieved by the comparison cohort.
- Do not expose raw peer scores, peer identifiers, exact rank, or a new peer
  aggregate field.
- Do not change `AssessmentReportSnapshotV1`, its hash, issuance behavior,
  GraphQL operations, or the minimum comparison privacy thresholds.
- Do not replace the grouped data with a normal curve, kernel-density curve,
  or an interpolated line that assumes a distribution inside a merged range.
- Do not redesign the rest of the verified-credential portal or assessment
  scoring calculations.

## Research and findings

### Repository evidence

- `packages/graphql/src/services/assessmentReports.ts` creates ten coarse
  score intervals, merges adjacent intervals until each displayed group has
  at least three participants, and extends the final displayed range to
  `availableTotalPoints`.
- `packages/types/src/assessmentReport.ts` stores only the cohort size,
  integer percentile, and privacy-merged `{ binStart, binEnd, count }` values.
  It does not store peer-level scores or positions inside a range.
- `apps/frontend-pwa/src/components/insights/assessmentResults/histogram.ts`,
  `exportReport.ts`, and `pages/verify/index.tsx` currently use numeric range
  widths for the visual bar widths. A sparse high-end range therefore receives
  disproportionate visual weight.
- The attached sample PDF was treated as evidence only, not as an instruction
  source. Its final range is `1,578–5,260` with 18 participants, while earlier
  ranges are 526 points wide. It demonstrates the visual defect but does not
  prove that 5,260 is the cohort's observed maximum.

### Product and privacy findings

- The honest first iteration is a categorical chart of **privacy-grouped score
  ranges**, not a continuous histogram. Every published range gets one equal
  visual slot; height continues to encode participant count.
- A true empirical cumulative distribution would not require normality, but
  the current snapshot cannot locate peer scores inside a merged range. A
  smooth or interpolated curve would invent precision.
- The participant's exact score is already available in the report. Highlight
  the containing privacy range rather than drawing an exact vertical score line
  through a categorical chart.
- The existing percentile formula is inclusive (`score <= participantScore`)
  and rounded to the nearest integer. Preserve ties and that definition.
- A separate 0–100 percentile ruler can show the participant's relative
  position without adding any new data. The adjacent text remains the source
  of truth for screen readers and users who do not parse the visual marker.

### Planning-stage specialist review

The native Sol planner reviewed the complete plan direction and returned
`DONE_WITH_CONCERNS`. Its accepted changes are included here:

- explicitly define equal-width categorical slots and the highlighted
  containing range;
- keep the available-total endpoint and reject an observed-max field;
- add the percentile ruler boundary behavior at 0 and 100;
- preserve V1 snapshots and make no backend/schema change;
- use a fresh task worktree rather than the stale `assessment-report-polish`
  worktree;
- make documentation, browser evidence, and runtime shutdown part of the
  acceptance boundary.

The semantic table and text explanation remain mandatory because the chart is
meaningful content, not merely decoration. See the [Web Interface
Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

## Presentation contract

### Grouped score distribution

- Label the chart as “Score distribution by grouped ranges” or the equivalent
  localized wording. Do not call it a continuous histogram.
- Give every published range one equal-width categorical slot.
- Keep bar height proportional to `count`.
- Keep the exact numeric range visible under the chart and in the existing
  accessible table.
- Highlight exactly the bin selected by the existing clamped,
  last-bin-inclusive membership logic.
- Add a short note that displayed ranges are privacy-grouped and may span
  different numbers of available points.
- Keep the course endpoint labeled as “Available points” or “Course maximum,”
  never “Maximum achieved.”

### Percentile ruler and copy

- Render a horizontal 0–100% ruler with a marker at the stored integer
  percentile. Clamp the marker visually so 0 and 100 remain inside the track.
- The marker is supportive, not the only explanation. The semantic text must
  state the same value and meaning.
- English headline: “About {percentile}% of the comparison group scored the
  same as or lower than you.”
- English explanation: “This rounded percentage includes your own result and
  all tied scores.”
- German headline: “Etwa {percentile} % der aktiven Teilnehmenden in der
  Vergleichsgruppe erzielten gleich viele oder weniger Punkte als du.”
- German explanation: “Dieser gerundete Anteil schliesst dein eigenes Ergebnis
  und alle gleichen Punktzahlen ein.”
- Show the comparison-group size using the existing `cohortSize`, for example
  “Comparison group: 24 participants.”
- If the marker is decorative beside equivalent text, mark it decorative for
  assistive technology while retaining the chart description and table.

### Data and compatibility contract

- Keep the minimum cohort size of 10 and the minimum displayed count of 3.
- Keep `availableTotalPoints` as the stored endpoint. Do not derive or publish
  the observed cohort maximum.
- Keep `AssessmentReportSnapshotV1`, its hash, parser, issuance, and public
  verification schema unchanged.
- Existing and newly issued V1 snapshots must render with the new categorical
  presentation without migration or backfill.
- Preserve exact range order, range endpoints, counts, and the accessible table
  contents. Only presentation and explanatory copy change.

## Primitive impact

| Existing primitive | Disposition | Reason |
|---|---|---|
| Verified assessment report | Extend presentation only | The credential remains an immutable server-computed V1 snapshot. |
| Peer comparison | Clarify existing contract | The same cohort size, percentile, and grouped ranges are presented more honestly. |
| Public verification | Preserve | The page gets the same chart and text semantics as the export. |
| Assessment scoring | No change | Scores and available totals remain produced by existing aggregation code. |

No new product primitive, schema field, ADR, or GraphQL operation is required.

## Feature-wide test portfolio

| Risk or behavior | Existing protection | Obligation | Primary seam | Distinct failure caught |
|---|---|---|---|---|
| Inclusive percentile and ties | Existing comparison-service tests | Extend existing | `buildAssessmentReportComparison` unit tests | A tie is excluded or the wording no longer matches `<=`. |
| Nearest-integer percentile rounding | No explicit non-integral case | Extend existing | GraphQL service test | A fractional percentage is truncated or rounded inconsistently. |
| Privacy thresholds and count conservation | Existing cohort/bin tests | Extend or consolidate existing | GraphQL service tests | Comparison leaks below 10, emits a group below 3, or loses participants. |
| Available-total endpoint | Existing sparse-range fixture | Extend existing | GraphQL service test | A data-derived observed maximum enters the V1 contract. |
| Equal categorical geometry | Current Playwright expects unequal widths | Replace assertion | Export SVG and verification DOM | A numeric tail range becomes visually dominant again. |
| Export/verification parity | Existing credential lifecycle coverage | Extend existing | Focused Playwright specification | The two public surfaces disagree on width, range, highlight, or copy. |
| Percentile ruler semantics | None | Add assertions to focused browser test | Verification page and exported report | Marker overflows at 0/100 or displays a different percentile than text. |
| Print and responsive layout | Existing one-page PDF checks | Extend existing | Focused Playwright plus browser screenshots | The new ruler or labels cause an extra A4 page or mobile overflow. |
| Accessibility and localization | Existing table and role checks | Extend existing browser evidence | `agent-browser`, EN and DE | Meaning is available only visually, or German/English surfaces diverge. |

No new backend test suite is needed. The stable comparison-service seam is
stronger evidence than duplicating the same assertions through GraphQL wiring.

## Delegation map

| Slice | Owner | Dependency | Acceptance boundary |
|---|---|---|---|
| S1 — preserve comparison semantics | Native executor | None | Focused GraphQL tests pass with inclusive ties, rounding, thresholds, sparse merging, endpoint, and count integrity. |
| S2 — render one comparison consistently | Native executor; main owns integration | S1 | Export and verification use equal slots, shared selection, percentile ruler/copy, accessible table, and one-page A4 output. |
| S3 — document and prove integrated result | Main session | S1 and S2 | Wiki/log updates, root checks/build, browser screenshots, runtime shutdown, and final review are complete. |

S2 crosses the UI/public-contract seam. After its commit, run exactly one
`simplifier` and one `slice-reviewer` in parallel over the same immutable range.
The reviewer lenses are correctness, privacy presentation, visualization, and
accessibility. S3 is documentation and final proof; its execution-tier skip
reason is critical-path coupling.

## Slices

### S1 — preserve comparison semantics

**Outcome:** the existing V1 comparison contract is protected by focused
regression coverage before presentation changes land.

**Do:** change only `packages/graphql/test/assessmentReports.test.ts`. Extend
or consolidate the existing tests for tied scores, a non-integral rounded
percentage, the minimum cohort and minimum displayed count, sparse trailing
ranges, count conservation, and the final endpoint remaining
`availableTotalPoints`.

**Do not:** change `assessmentReports.ts`, `assessmentScores.ts`, V1 types,
hashing, issuance, GraphQL schema, or generated code.

**Check:** run the focused GraphQL test file in the task runtime and inspect the
diff for test-only scope.

**Commit:** `test(graphql): cover assessment comparison semantics`

### S2 — render one comparison consistently

**Outcome:** the participant sees the same privacy-grouped distribution and
percentile explanation in the exported report and public verification page.

**Do:**

- update the shared histogram geometry in `histogram.ts` to use equal
  categorical slots while retaining range membership logic;
- update `exportReport.ts` to render equal-width bars, the highlighted range,
  the percentile ruler, localized explanatory text, and the existing table;
- update `verify/index.tsx` with the same geometry, marker semantics, text,
  chart description, and table behavior;
- touch `SuspendedAssessmentResults.tsx` only if the current inputs or range
  copy require it;
- update the English and German assessment-report messages;
- update the focused credential-verification Playwright helper/specification to
  assert equal widths within a small tolerance, exactly one highlighted range,
  matching ranges/counts/copy on both surfaces, ruler endpoints, and A4 output.

**Do not:** change V1 types, service logic, GraphQL operations, codegen, or
the stored snapshot shape.

**Check:** run PWA checks, the focused credential-verification Playwright
specification, and browser evidence with synthetic fixtures. Capture English
and German desktop/mobile verification screenshots and the exported report.

**Review:** dispatch the simplifier and slice-reviewer in parallel after the
commit. Integrate only verified findings; rerun the focused checks after any
correction.

**Commit:** `enhance(frontend-pwa): clarify assessment comparison visualization`

### S3 — document and prove the integrated result

**Outcome:** the behavior is recorded for future maintainers and the complete
package has repository-native and live UI evidence.

**Do:**

- update `docs/frontend-conventions.md` with the categorical chart, percentile
  ruler, table, V1 compatibility, and privacy boundary;
- update the relevant `klicker-frontend-ui` skill guidance if the shared
  report pattern is now a maintained UI convention;
- add `docs/log/2026-08-20-assessment-report-visualization.md` with the
  problem, accepted design, and evidence boundary;
- update this plan's `Progress` section after each meaningful milestone.

**Check:** run focused GraphQL and PWA tests, formatting, `pnpm run check:all`,
and `pnpm run build` inside the task runtime. Use `npx agent-browser` for the
final English/German desktop/mobile pass and keep screenshots synthetic. Read
the exact runtime logs that produced the verified browser state. Stop and
verify the exact runtime after the final runtime-dependent check.

**Review:** run the integrated native `final-reviewer` over the complete
committed range before describing the package as ready or opening a PR.

**Commit:** `docs: document assessment comparison visualization`

## Verification and delivery gate

The package is complete only when all of the following are true:

- the unequal-range fixture renders equal-width bars in both standalone
  HTML/PDF and public verification within a small pixel tolerance;
- the range order, counts, selected range, percentile, copy, and ruler agree
  across both surfaces;
- the accessible table remains present and exact;
- counts sum to `cohortSize`, every displayed count is at least 3, and the
  comparison remains absent below 10 participants;
- old and new V1 snapshots render without migration;
- the three-bin and ten-bin reports remain one A4 page in English and German;
- browser evidence covers the changed report and verification states at desktop
  and mobile sizes;
- `check:all`, build, focused tests, formatting, and final review pass;
- the exact task runtime is stopped and its stopped state is verified.

Push, PR creation, merge, deployment, and production verification are outside
this plan's authority.

## Progress

- Status: S1 complete; S2 implementation in progress.
- Completed: repository freshness check, current code/PDF review, Sol planner
  pass, fresh task worktree creation, S1 comparison semantics tests and focused
  GraphQL verification (8 tests passing).
- Remaining: S2 shared visual implementation and browser
  proof; S3 documentation, full checks, runtime shutdown, and final review.
- Latest evidence: task branch is based on `origin/v3` `9f38b4e9a`; primary
  checkout remains dirty but untouched.
- Slice review: not required yet — S1 is a test-only slice; S2 review will run
  after its immutable commit range is complete.
- Delivery: required layer is a local branch ready for a draft PR; achieved
  layer is the plan artifact only.
- Next action: implement S2 frontend visualization and percentile presentation.
