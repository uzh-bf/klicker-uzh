# Question pool label preview

Lecturers can opt in to a course-specific preview for a scored single-choice or KPRIM question in the question pool. Selecting an item for preview explicitly requests model processing. Show the observed first-attempt full-credit count, denominator, rate and difficulty band alongside the estimated difficulty and Bloom level. Keep the source-free model prompts consistent with the exam rubric.

## Implementation and acceptance

1. Look up the current element revision and selected course on the server. Verify permission to inspect keyed question content and course results. Scope first-attempt aggregates to the course and compatible question version. Report absence of attempts explicitly.
2. Project only the question, choices, key and format to the configured inference service. Preserve raw forecasts. Apply the full format-specific correction only for a privately configured Finance I course identity. Other courses use raw forecasts. Report missing model estimates separately from available observations. Keep preview results transient.
3. Provide the preview from the lecturer question pool with explicit course and question selection. Invalidate stale results on selection changes. Verify off-by-default behavior, course isolation, missing observations, unavailable estimates and a successful synthetic response. Existing elements, assignments and grading retain their current semantics.

## Progress

The question pool now offers the preview for SC and KPRIM. Course managers can request an estimate for a question they may read. The service counts one first scored response per participant and activity instance. The model receives the item projection and rubric. Only configured Finance I course identities select the calibrated template.

The server and client passed type checks. Focused tests exercised scoped aggregates, permission denial, missing estimates, format-specific forecasts and course-specific calibration. Local browser checks covered the opt-in control, course selection, the empty state and the successful layout with a synthetic model response.
