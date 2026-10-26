# Manage overview and detail UX review

## Scope and evidence

- Scope: question library and live-quiz creation introduction; activity overview and activity details; course overview and course details. Desktop only. Supplied screenshots are illustrative inspiration, not current-state evidence.
- Source: refreshed `origin/v3` at `fbc5f4fcc2ffa1c8d25695679823134985c5a8d8`. The primary checkout is eight commits behind and dirty with unrelated work. Reviewed activity/course files have no diff against this remote source. No upstream integration occurred.
- Browser: existing release-verification checkout at that same commit, `/Users/rschlae/Git/klicker/klicker-uzh/trees/rs/v3-production-release`, through `https://manage.klicker.rs-v3-production-release.localhost/`. This is checkout provenance, not an independent build-revision attestation.
- Method: single evaluator, code inspection plus Codex in-app browser screenshots on macOS. English; 1280×720 initial viewport, 1024×768 and 1440×900 comparisons. Browser engine version was not captured. Severity is provisional. Code and visual inspection stayed together because findings required immediate cross-checking of the same surface.
- Evidence: screenshots are retained in this task's conversation, not committed. The runtime contains one synthetic library element, three seeded courses, and no activities. Populated activity rows and activity details are therefore code-only. German, permission variants, loading failures and populated leaderboards were not visually verified.

This is a focused improvement review, not a complete heuristic or accessibility audit. The usability and visual-hierarchy lenses from `ux-heuristics` and `refactoring-ui` guided observations. No overall numeric score is assigned: missing populated activity states and unmeasured contrast would make it misleading.

## Delta from the earlier library work

The [question-library roadmap](2026-08-23-question-library-ux-audit-and-roadmap.md) records the merged stack and remains the source for historical dispositions.

Confirmed visually in this pass: four activity buttons occupy one row on desktop; Create Element fills the sidebar width and stays above the filters; it becomes secondary during creation; element action buttons are named; the creation-mode element row is compact; no visible Activities/Elements subtitles compete with the content. These are strengths to preserve.

Other merged changes, including failure recovery, debounce, cancellation recovery, type guidance and batch operations, retain their previous evidence; they were not fully retested here. Desktop German label completion remains the previously parked item, not a new finding. Mobile compatibility and the separately owned tour work remain outside this review.

## Findings and small improvements

Severity: 1 cosmetic; 2 minor usability friction; 3 major task failure; 4 task blocked. No major task failure was demonstrated in the exercised states.

### Confirmed in the browser

| Finding | Severity and evidence | Smallest useful change |
| --- | --- | --- |
| Course details misalign labels when Notification Email is absent | **2.** Open the seeded Testkurs at 1024×768 or 1440×900. Course Language appears in the Notification Email value column; English starts the next row. `apps/frontend-manage/src/pages/courses/[id].tsx:221` places labels and nullable/raw values directly into a two-column grid. A missing value contributes no grid cell. This breaks label/value association. | Give every value its own element. Render an em dash or localized “Not set” for an absent email. Keep each label/value pair intact at all widths. |
| Course overview gives destructive and administrative actions excessive prominence | **2.** At 1280×720, every course has visible comment, archive and red delete icons, while opening a course has no explicit link affordance. The accessibility tree contains unnamed nested buttons. `components/courses/CourseListButton.tsx:79` wraps the row and its child buttons in a Button; the comment action starts at line 128. This weakens hierarchy and control semantics. | Use a course-title link with sibling actions. Put archive/delete in a labeled More actions menu; provide a label and tooltip for comments. Keep the existing confirmations and permission rules. |
| Course details devote too much space to settings and leaderboard instructions | **2.** At 1024×768, the page retains the three-column metadata region and a side-by-side activity/leaderboard split. The leaderboard's multi-sentence information box pushes actual results farther down. `pages/courses/[id].tsx:175,275` and `components/courses/IndividualLeaderboard.tsx:193`. This is a hierarchy problem, not demonstrated horizontal overflow. | First shorten the permanent leaderboard message. Put export guidance next to Download as CSV and retain the zero-point inclusion rule as contextual help. Then consider a collapsed Course information section for infrequently used settings; keep title, participants and joining controls visible. |
| Empty course activity tabs look like warnings but offer no next action | **2.** Testkurs → Live Quizzes shows an orange “No live quizzes available” bar beneath Calendar, QR Code, LTI and Legend controls. `components/courses/LiveQuizList.tsx:78` renders an ordinary empty list as a warning. | Use a neutral empty state with a clear route to create an activity. Preserve the course context only if the existing wizard supports that contract. Confirm equivalent behavior across the other activity types. |
| The first wizard step still spends substantial space on repeated instructions | **1.** Library → Create live quiz at 1024×768 shows a paragraph above Name plus a large use-case/documentation panel. `components/activities/creation/liveQuiz/LiveQuizInformationStep.tsx:54,69`. The compact library rows below are working, but the introduction consumes more space than the input. | Keep one short use-case sentence and the Name field. Put lecturer/student documentation in an expandable Help area. Keep essential validation visible and supporting help keyboard accessible. |

### Code-confirmed behavior needing populated visual checks

| Finding | Evidence and consequence | Recommendation |
| --- | --- | --- |
| Activities search and recovery lag behind the library | `components/activities/overview/ActivityListSearch.tsx:22` updates the applied search only on Enter, except when clearing. `pages/activities.tsx:114` does not consume query errors; line 303 identifies “no activities” without considering search. `ActivityList.tsx:36` consequently uses first-use copy for a search with no matches. The unnamed sort button was also observed in the browser; `ActivityListSorting.tsx:55`. | Reuse the established library behavior: debounce, clear-search recovery, distinguish empty/search/filter/error states, and label the sort-direction control. Verify against a populated fixture before declaring these interactions fixed. |
| Activity details initially reserve a large pane for comments | `components/activities/overview/details/ActivityDetailsModal.tsx:71` initializes no element selection. Lines 104–125 split the modal into content and a comments/preview pane, reaching half-and-half at xl. The title is generic Activity Details, while the activity name is inside the information panel. Not visually confirmed because no activity exists in this fixture. | First inspect a populated activity. Candidate: show the activity name in the dialog header and use explicit Preview/Comments tabs, with a clear initial preview or selection prompt. Avoid a new drawer architecture unless the existing split proves inadequate. |
| Activity row density and keyboard semantics deserve the same treatment as the library | `components/activities/overview/ActivityListEntry.tsx:137` uses a padded card with title, counts and metadata rows; line 150 opens details through a clickable div. Name editing is a clickable icon. These controls lack native link/button behavior in this component. Visual density was not assessed with populated data. | Convert navigation and rename controls to semantic, named controls. Evaluate one compact summary row with title, readable status, course and counts; keep secondary metadata in details. Do not remove lifecycle information needed to distinguish scheduled, running and ended activities. |

Course search is a conditional opportunity, not a demonstrated problem with three courses. Add a simple title filter only if lecturers commonly manage enough courses to make scanning slow. Do not turn the course picker into a dashboard merely to fill the screen.

## Recommended order and acceptance checks

| Package | Outcome and estimate | Check |
| --- | --- | --- |
| Course metadata alignment | Correct missing-value rendering. Roughly 30–60 minutes if the current fixture remains available. | At 1024×768 and 1440×900, with and without Notification Email, every value remains beside its label. Verify English and German. |
| Activity search and control parity | Apply the library's existing feedback patterns. Roughly half a day if reusable behavior and focused fixtures are available. | Search without Enter; clear a no-hit query; reset filters; simulate a list-query failure; recover without losing search. Verify sort names and keyboard access. |
| Course action and empty-state polish | Quieter row actions and a useful empty activity tab. Roughly half a day including browser checks. | Open a course by keyboard; inspect labeled row actions; ensure archive/delete still require their existing safeguards; verify empty tabs for permitted and read-only users. |
| Course and wizard information density | Reduce permanent explanatory text using existing disclosure components. Roughly half a day after agreeing what remains visible. | At 1024×768, activity content remains prominent, all help is available by keyboard, and required state/validation stays visible. |
| Populated activity details follow-up | Validate the code-only proposals before implementation. Roughly 1–2 hours with an existing populated fixture. | Inspect draft, scheduled and ended activities, a long title, several blocks, comments, preview selection and a read-only activity at both desktop widths. |

These are proposed source changes, not an approved implementation plan. A small cohesive PR per selected concern is sufficient; no stack or new abstraction is needed for the first fix.

## Implementation notes and remaining evidence

Use the repository's devrouter and browser-verification instructions. Preserve the established HTTPS localhost domains. These checks need only synthetic local lecturer/course/activity data and no paid model keys. Obtain an existing populated fixture or approval for fixture creation before validating the activity-detail proposals. Do not alter the release-verification database merely to complete this review.

Capture fresh before/after screenshots at 1024×768 and 1440×900. Check English and German through the normal locale UI. Do not claim accessibility conformance from this review; the control findings are targeted semantic observations.

Environment notes: the first in-app browser call failed and a later call succeeded. A separate agent-browser 0.32.2 session reached the authentication terms gate and was not used to accept terms. The in-app browser already held a local lecturer session. Initial devrouter metadata inspection required host permissions. The existing release-verification runtime belongs to another task; this review did not start, reconfigure, stop or take ownership of it. No application source, account records or course/activity data were changed.
