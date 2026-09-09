# Import review UI

Goal: make Element import review clear and restrained using UZH blue, neutral surfaces, local Source Sans and existing design-system controls.

Scope: Manage ZIP shell, shared ZIP/Excel selection view, responsive student-preview label, paired EN/DE labels. No schema, auth, gamification, worker, duplicate-policy or import contract changes.

Implemented: compact visible copyright/review guidance with full details disclosure; contextual answer collections; neutral duplicate notice; labelled Preview, Close and Replace file actions; responsive element rows and preview; bounded dialog height. Suppress only the repeated normalized-review-status warning because guidance already covers it. Other package warnings remain visible.

Verification:

- Manage check passes (Next route generation and TypeScript).
- All 15 existing Manage tests pass.
- Biome check passes on all seven changed code/message files; git diff --check passes.
- Real agent-browser verification at 1440x1000 and 390x844: all-nine-type Excel review and successful synthetic import; ZIP export/reimport review; duplicate exclusion yields zero selection and disabled import; selection restoration; preview focus restoration; EN/DE content and details; mobile preview keyboard PageDown scrolls content (294px).
- Browser findings corrected: outer modal header clipping, sticky footer obstructing Preview, non-wrapping student-preview feedback label.
- Independent reviewer found two accessibility issues, now fixed; targeted follow-up found no actionable regressions.
- Screenshots and synthetic fixtures are in ignored output/import-ui-verification/. User-provided image is the before reference.

Environment: user approved resuming the existing import-export-elements Manage profile. Added only the missing synthetic lecturer login (dry run, create-if-absent, verified count) and imported nine synthetic fixture elements; no resets or existing-record overwrites.

Delivery: follow-up commit on the existing import-export-elements stack tip. External executor/simplifier ineligible because this worktree has no external-model opt-in.
