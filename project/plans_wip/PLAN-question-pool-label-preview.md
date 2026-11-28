# Question pool label preview

Lecturers can opt in to a course-specific preview for a scored single-choice or KPRIM question in the question pool. Selecting an item for preview explicitly requests model processing. Show the observed first-attempt full-credit count, denominator, rate and difficulty band alongside the estimated difficulty and Bloom level. Keep the source-free model prompts consistent with the exam rubric.

## Implementation and acceptance

1. Look up the current element revision and selected course on the server. Verify permission to inspect keyed question content and course results. Scope first-attempt aggregates to the course and compatible question version. Report absence of attempts explicitly.
2. Project only the question, choices, key and format to the configured inference service. Preserve raw forecasts. Apply the full format-specific correction only for a privately configured Finance I course identity. Other courses use raw forecasts. Report missing model estimates separately from available observations. Keep preview results transient.
3. Provide the preview from the lecturer question pool with explicit course and question selection. Invalidate stale results on selection changes. Verify off-by-default behavior, course isolation, missing observations, unavailable estimates and a successful synthetic response. Existing elements, assignments and grading retain their current semantics.

## Progress

The question pool now offers the preview for SC and KPRIM. Course managers can request an estimate for a question they may read. The service counts one first scored response per participant and activity instance. The model receives the item projection and rubric. Only configured Finance I course identities select the calibrated template.

The server and client passed type checks. Focused tests exercised scoped aggregates, permission denial, missing estimates, format-specific forecasts and course-specific calibration. Local browser checks covered the opt-in control, course selection, the empty state and the successful layout with a synthetic model response.

## Roadmap for lecturer ratings

**Next milestone.** Add optional, blind lecturer annotation to the preview. A lecturer’s rating is useful for reviewing an item even when it leads to no change in model predictions. Keep automatic course-wide adjustments in the offline pilot.

Fable 5.2 and Gemini 4 Neon agreed on that sequence. Fable emphasized measuring disagreement between lecturers before attributing disagreement to the model. Neon identified a separate failure mode. If every prediction falls in one band, moving the whole band closer to the course median can improve average error while leaving the model unable to distinguish easy and hard questions. The pilot needs to test both.

### What the lecturer rates

- Record ratings against the course, format, question family and exact question revision. Give reviewers the wording, options, answer key and rubric. Reveal AI estimates and observed outcomes after they submit. Allow either rating to be skipped.
- For D1–D5, ask which range best describes the share of students in that course expected to earn full credit on their first attempt. Show the format-specific ranges and explain that KPRIM requires all four judgments to be correct. Keep lecturer D, model D and observed full-credit rate with its denominator separately identifiable. Lecturer ratings never update the fitted probability correction.
- For Bloom, ask which cognitive process is necessary to earn full credit given what was taught. Score exact agreement and inspect the confusion matrix, especially remember versus understand. Defer any automatic Bloom remapping. A uniform shift between taxonomy levels has no established instructional interpretation.

### Sampling and validation

Use one deterministic sampler for blind lecturer ratings. Select ten distinct SC families and ten distinct KPRIM families per course, or every eligible family when fewer exist. Group by source lineage and normalized keyed duplicates within each format. On each pick, maximize the number of uncovered lecturer tags, then the minimum stem word-set distance to an already selected family, then newly covered words. Resolve remaining ties by the stable family key. Pin the assignments when the session starts. This sampling rule runs without forecasts, response data or embeddings.

Revisit selection only if a blinded study with real lecturers on fresh courses shows a prespecified, meaningful improvement in held-out difficulty and Bloom predictions at the same rating workload. Use the planned EmbeddingGemma 2 vectors for that comparison and split by family. [Question revision embeddings](PLAN-question-revision-embeddings.md) has a separate Azure Spot batch delivery plan.

Reserve a separate random audit sample within topics before choosing the diverse examples for fitting. Count audit ratings and second ratings in the workload shown to the lecturer. Keep all revisions and near duplicates of a family on one side. Where topics are sampled at different rates, weight the audit back to the course pool and report the denominators by course and format. A diverse review queue answers which examples to show a lecturer. A representative audit answers how the approach performs across their pool.

### Pilot decisions

1. **Test the review workflow.** Begin with two or three courses and record completion, time per format, skips and uncovered topics. Double-rate a small shared subset within each course. If only one lecturer is available, use a delayed repeat and report it as within-rater consistency. Expand to more courses or families when estimates remain too imprecise. The proposed budgets set workload and have no standing as validation thresholds.
2. **Test D adjustments offline.** Freeze the unadjusted forecast, a course-median baseline, the candidate rule and the audit split before scoring. Compare paired band error, exact agreement, predicted-band spread and ability to rank difficulty. Where response counts support it, check lecturer and model D against empirical first-attempt difficulty. Keep SC and KPRIM results separate. Historical suggestions can identify disagreements worth studying but cannot estimate their frequency.
3. **Decide whether to offer an adjustment.** Require repeatable lecturer ratings and a meaningful gain over both baselines on unseen families, with an uncertainty interval for the paired gain. Compare model–lecturer disagreement with rater–rater disagreement, and check separately for harm on hard items and individual courses. A quarter-band mean error reduction is a proposed target to agree before the pilot. An inconclusive audit keeps annotation and the original estimate available. A positive audit warrants testing a reversible, explicitly enabled course suggestion. It does not authorize changes to student grading or automatic activation.

The private sampler’s five-fit/three-holdout minimum is adequate for exercising the workflow. A single one-band error changes mean absolute error by one third of a band on three audit items. That split cannot justify promoting a correction into the question pool.

## Blind rating sessions

The first annotation milestone offers up to ten SC and ten KPRIM families per lecturer and course. Operators enable pilot courses by passing their UUIDs as a JSON array in `LECTURER_RATING_COURSE_IDS_JSON` to the backend. An empty list disables entry. Finance I and Banking & Insurance use this same setting independently of the Finance I probability correction.

A course manager can review current keyed revisions used in that course's activities and accessible in their question pool. Sampling groups related copies and equivalent keyed items by format, then favors uncovered tags and distinct wording. A saved session pins the selected revisions. Missing permissions, removed activity membership or changed questions make those assignments unavailable. Small pools contribute all eligible families up to the limit.

The reviewer sees the wording, options and key. D and Bloom can be rated independently. Saving both blank records an explicit skip. Reopening the session restores progress and permits changes to the reviewer's own annotations. Only assignment references, revision, family fingerprint and human ratings are stored. The preview and grading paths do not consume these ratings. Any cross-family adjustment is still an offline research decision.
