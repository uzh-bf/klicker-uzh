# Learning Analytics prototype review and first-iteration contract

Date: 2026-09-05. Scope: the local DPO review artifact and a German student guide. No production implementation or release is performed by this package.

## Evidence boundary

Remote refs were refreshed. The source checkout is `v3`, tracking `origin/v3`, at `86fc70c77f756827d55ea9d0afc5cac3344630cf`, zero commits ahead and eight behind the remote default branch. The upstream diff does not change the inspected analytics service, lecturer analytics components, student timeline, or analytics schema. Source inspection establishes code behavior, not production deployment or configuration.

The separate chatbot worktree is at `c6975f8fef49c1b34dcdb515515fdfd716e5d1d6`. Its ADRs and plan describe the older capability design, not the new first-iteration policy. No live student records, conversations, or production exports were read. Existing synthetic specimen files remain examples of data shape; they are not evidence that disclosure controls execute.

This work stays in the established ignored `project/_local/2026-09-03-dpo-package-v2/` review package, shared with the ongoing consent prototype. It is intentionally not committed or mixed with application source. Main-session ownership is deliberate: evidence, wording, and the unresolved personal-insights boundary are tightly coupled. The independent acceptance checks are source-to-copy traceability, comparison of the lecturer and student examples, and browser verification of the prototype and guide.

## Product boundary

The user clarified that the group-only boundary applies to in-tool lecturer LA views and their API responses, not to research downloads. Research exports may retain participant-level records, including learning-activity and analytical records, with identifying details removed or replaced and an explicit prohibition on attempted re-identification, including linkage for that purpose. Students' own private insights remain a proposed benefit. This does not eliminate personal processing internally. Identifier removal and a prohibition on re-identification do not by themselves establish anonymity; export safeguards remain subject to the separate research review.

| Product primitive | Disposition | Contract and owner | Consumers |
| --- | --- | --- | --- |
| Participant LA choice | Extend | One global explicit yes/no; no initial answer; prospective eligibility periods; repeated off/on supported. Participant controls it. | Private insights, group aggregation, settings, all activity sources |
| Course analytics availability | Reuse | Course owner can pause new lecturer reports; does not override a participant's no or create cross-course linkage. Private insights are proposed to remain independent of this switch. | Lecturer reports |
| Private learning insights | Extend | Authenticated owner-only access to new eligible activity summaries. No lecturer retrieval or export of these personal views. | Student guide and proposed student dashboard |
| Group report release | Extend | Server creates and checks group-only output for in-tool LA; no person rows, stable person keys, hidden person payloads, or individual drill-down. | Lecturer LA UI and its stored report snapshots |
| Research use and assessment results | Reuse | Separate purposes and controls. Research downloads may contain participant-level records under research eligibility, identifier handling and the no-re-identification rule. LA yes alone does not authorize research export; identifiable assessment results retain their separate permission boundary. | Existing research/assessment prototype dialogs |

The private LA dashboard is proposed, not present as described in current `v3`. If “no individual data” means no personal LA processing anywhere, omit that dashboard and motivate participation through better teaching and group-level feedback only. Do not call a personal dashboard anonymous.

## Findings and improvements

| Finding | Evidence / consequence | Prototype or documentation response |
| --- | --- | --- |
| Individual rates remain in current analytics | `packages/graphql/src/graphql/ops/QGetCoursePerformanceAnalytics.graphql` selects `participantPerformances` and `participantActivityPerformances`, including participant identifiers. | Explicitly mark the prototype as target behavior. First iteration requires removing these fields from lecturer responses, not simply removing table headings. |
| Current UI exposes individual rows and a CSV path | `apps/frontend-manage/src/components/analytics/performance/TotalStudentPerformancePlot.tsx` renders first/last/total error rates per numbered student and sets a CSV filename. `StudentActivityPerformance.tsx` shows per-student activity data. | Replace in-tool views with activity-group summaries. Keep participant-level downloads behind the separate research export controls, not a bypass through the LA table. |
| Group-looking charts receive individual payloads | `getCourseActivityAnalytics` in `packages/graphql/src/services/analytics.ts` returns `participantCourseAnalytics`. The activity query selects personal activity dimensions. | Grouping must happen on the server. Inspect GraphQL/JSON, tooltips, CSV, caches, and hidden state in the implementation acceptance test. |
| Five participants was presented as sufficient protection | Old prototype showed an example threshold of five without a full release rule. | Remove a numeric guarantee from student copy. Describe suppression, coarse reports and comparison checks together. Threshold still requires a decision and validation. |
| Metrics lacked a population and attempt definition | “34 of 42” could conflate course membership with LA eligibility; generic correct-rate cards had no attempt basis. | Show rounded activity-level first/last attempt summaries and identify the population as included activities. Add a suppressed row and limitations. |
| Students were given almost no reason to participate | Shared LA choice described only what lecturers receive. | Explain private exercise insights as the target benefit, retain equal yes/no choices, and link a detailed student guide with synthetic examples. |
| Current benefits and future ambitions were mixed | Student timeline exists, but is a points/XP chart. Topic-level mastery/recommendations are not established by it. | Separate existing timeline, proposed private activity insights, and later topic features. Do not make existing points feedback conditional on new LA consent. |
| Chat absence was too absolute in earlier reasoning | Current `packages/prisma-data/src/scripts/2026-06-16_analyze_chatbot_usage.ts` selects content and implements topic clustering. The separate stack has a governed report plan. | State that exploratory tooling exists, but no reviewed student/lecturer topic-cluster product was verified. Exclude chat-content analysis from the first iteration. |
| Research copy promised no identifying details despite transcript exports | Structured identifier replacement does not remove identifying free text. | Say account identifiers are removed/replaced and free text needs special safeguards, consistently with the existing transcript warning. |
| Withdrawal copy protected every computed aggregate indiscriminately | A small or otherwise identifying aggregate is not safe merely because it was computed before withdrawal. | Preserve only released group reports that passed disclosure checks; stop pending contributions and delete personal derivatives. No promise to recompute released reports. |
| A redundant boundary paragraph survived the prior merge | The shared template repeated the course/optional-use distinction after the acknowledgement was updated. | Remove the repeated paragraph. |
| Lecturer course switch had no observable behavior | Static checked checkbox did not update label or explain pause behavior. | Wire the prototype switch to a clear new-report status; retain existing synthetic report and state that private insights are separate. |

## Source-to-description map

| What is described | Current evidence | First-iteration delta |
| --- | --- | --- |
| Starts, completions, repetitions | `QGetCoursePerformanceAnalytics.graphql`: `activityProgresses`; `packages/prisma/src/prisma/schema/analytics.prisma` | Apply effective eligibility before calculation; disclose group output only. |
| First, last and overall answer outcomes | Same query: `activityPerformances`, `instancePerformances`; analytics schema fields document the attempt basis | Use fixed activity scope for the first release, not arbitrary per-person filters or rare individual items. |
| Daily/weekly activity | `QGetCourseActivityAnalytics.graphql`; `getCourseActivityAnalytics` | Prefer closed weekly intervals and limited approved views; no individual vectors delivered to the client. |
| Exercise feedback | `aggregateInstanceFeedbacks` and `computeActivityInstanceFeedbacks` in `packages/graphql/src/services/analytics.ts` | Grouped ratings only, suppression applies; no free-text excerpts. |
| Student's existing personal timeline | `apps/frontend-pwa/src/pages/insights/timeline.tsx`; `TimelineCourse.tsx`; `TimelineCourseChart.tsx` | Retain points/XP behavior independently; new private LA exercise progress is separately proposed. |
| Individual lecturer error rows | `TotalStudentPerformancePlot.tsx`; `useTotalStudentPerformanceHistogram.ts`; `StudentActivityPerformance.tsx`; analytics query/service | Remove UI, payloads and CSV paths from LA. Histogram bins must be server-produced, broad, and protected if included later. |
| Chat topic analysis | Current dated script above; separate `trees/chatbot-learning-analytics/project/2026-08-12-chatbot-learning-analytics-plan.md` | Defer content analysis, cluster assignments and any transcript export from the first LA iteration. Research conversation exports remain a separate proposal. |
| Eligibility and withdrawal | No `learningAnalyticsChoice` or `researchDataUse` fields found in current primary schema. Older stack requires an eligibility adapter. | Prototype choices and deletion messages do not prove backend enforcement. Build and verify enforcement before activating this copy. |

## Proposed group-report contract

The first release should aggregate across a course activity and a fixed completed reporting period. Group by the learning activity, not by named students, inferred ability labels, demographic traits, or a saved roster. Lecturer reports must not retain group membership lists. Personal processing needed to form statistics remains governed; a group-only output does not make the source database anonymous.

For an activity's completion rate, use distinct eligible participants who started that activity during the eligible reporting scope as the denominator. Completed is a subset of those starters. Never divide by the course roster and imply it is the consenting population. Never reveal participation choices by publishing a roster minus opt-out count.

For a first/last correctness comparison, use the same eligible participant-item pairs observed in the reporting scope. For each participant, calculate the fraction of those items answered correctly on the first and last eligible attempt; then average equally across participants. A participant with one attempt contributes that same outcome to both columns. Do not count missing answers as incorrect or import pre-opt-in attempts. Explain that the difference is descriptive, not proof of mastery, treatment effect or learning gain. This participant-weighted definition is a proposal and may differ from current response-weighted aggregates; do not silently reuse them. Round only after calculation and disclosure checks. The HTML examples are illustrative, not recomputed source data.

No “low performer” segments are needed initially. If a later histogram is useful, return only protected broad bin counts and no records behind a bin. Averages alone do not solve disclosure: a homogeneous group, extreme value, single dominant contributor, overlapping periods or complementary totals may reveal a person.

The in-tool LA output gate must consider distinct contributors, rare outcomes, homogeneity, dominance, other released cells, external context, and historical reports. Suppress unsafe outputs or coarsen them. Do not show exact small counts, minima/maxima, individual rates, person keys, free text, or an overall total that reconstructs a withheld cell. No arbitrary filter combinations or refreshes that isolate one new contributor. This projection restriction does not apply to separate research exports: those may contain participant-level records and must enforce the research purpose, eligibility, access and identifier-handling controls instead.

Recommend evaluating a starting floor of ten distinct contributors per released group, with outcome/dominance checks and complementary suppression. This is an engineering proposal, not a safe-harbor threshold or a DPO ruling. Until a concrete release policy passes a contextual identifiability assessment, fail closed and do not claim “truly anonymous.” The student-facing wording stays practical and describes what is shown and withheld.

The technical reason for checking combinations rather than only identifiers is consistent with the [ICO guidance on assessing identifiability](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/how-do-we-ensure-anonymisation-is-effective/): singling out, linkage and inference depend on the data and available context. This is technical supporting guidance, not a determination of the law applicable to UZH.

## Choice, withdrawal and storage

Global LA consent is separate from course report availability, research use, leaderboard participation, and assessment processing. Accepting the account notice does not supply an LA yes. Unknown is a temporary form state only; account submission requires a choice. No student is listed as an opt-out to lecturers.

Compute only within effective yes intervals. At withdrawal, prevent new ingestion and recheck queued work and not-yet-released reports. Delete personal LA derivatives, pending contribution records, caches and owner-only insights through the documented deletion path. Retain course-operational answers according to their separate purpose. Existing group reports may remain only where the release assessment supports non-identifiability. They are not automatically recomputed; unsafe old reports need separate remediation rather than being grandfathered by wording.

On re-enabling, start from new events. Do not reconstruct a deleted private LA dashboard from operational history or include activity during the opt-out period. Course report pauses do not widen or reset consent. The proposed private-insight service is independent of the lecturer switch. Actual retention periods, deletion turnaround and backup handling still need owners and rules; the prototype must not invent durations.

## Later chat analysis

The current script already performs exploratory lexical clustering, so “no clustering exists” would be inaccurate. What remains unproven is a released, pedagogically valid, consent-enforced topic product. Topic frequency does not measure misconception, mastery, motivation or tutor quality.

A future student-informed expansion could process eligible conversation content and return only reviewed broad course themes, protected distinct-contributor counts, and coverage/unclassified rates. No quotes, snippets, raw transcripts, rare generated topic labels, per-student assignments or reusable participant identifiers belong in lecturer LA reports. Generated labels themselves need disclosure review. Inspect cluster stability and classification errors before using the result to guide teaching. This requires a separately explained content-processing scope; the first-iteration yes must not silently expand to it.

The old `0005-purpose-bound-chatbot-learning-analytics.md` ADR allowed restricted row-level analysis exports and per-purpose/course linkage. Preserve separation of purposes, prospective LA eligibility and governed research exports. Remove participant-level rows from in-tool lecturer LA views, not from the separate research export capability. Global participant LA choice does not authorize cross-course profile building in lecturer LA. The `0006-federate-chatbot-analysis-sources.md` source-ownership decision remains useful, but provider telemetry joins are outside this first iteration. These ADRs were inspected, not rewritten or applied to production.

## Data protection design pass

| Principle | Measure or boundary in this draft | Evidence still needed before release |
| --- | --- | --- |
| Transparency | Linked student guide, concrete views, current versus proposed status | Final shipped screens and data flows match the guide |
| Lawfulness | Separate purpose choices; no LA default answer; no new legal-basis assertion | DPO/controller ruling and effective eligibility enforcement |
| Fairness | Equal yes/no, unchanged core access, benefits stated without grade promises | Exercise no/yes/withdrawal across all clients |
| Purpose limitation | Separate private insight, group reporting, research and assessment | No cross-purpose/cross-course joins or bypass exports |
| Minimisation | Activity-level summaries, no person rows to lecturer clients, no chat content initially | API/network/export inspection and source selection audit |
| Accuracy | Explicit denominator and attempt basis, missing not wrong, descriptive limits | Metric fixtures including repeated attempts and eligibility windows |
| Storage limitation | Delete personal derivatives; retain only cleared group reports | Set retention periods and verify deletion through queues/caches/backups |
| Confidentiality | Owner-only private insights; approved group projection for lecturers | Authorization tests, storage and export access checks |
| Accountability | Recorded source map, release-policy gaps and synthetic examples | Named owners and retained release/withdrawal evidence |

Default amount: new eligible exercise outcomes and progress only. Default processing: no LA until explicit yes; research remains its separate existing proposal. Default retention: no invented duration; personal derivatives must have an enforced lifecycle. Default accessibility in LA: personal insights to their owner, approved groups to lecturers. Research downloads may contain participant-level records under their separate controls. No research data class is selected by default. The existing LA specimen illustrates group values only; it does not limit the research export contract or demonstrate a participant-level LA research export implementation.

## Verification and publication boundary

### Downloadable example worksheets

The [student guide attachment section](learning-analytics-students.html#beispieldateien) links three synthetic Excel files. These are review artifacts, not live backend exports:

- [Research records](outputs/consent-la-download-examples/forschung-beispieldaten.xlsx): existing synthetic quiz/practice CSV records, a flattened subset of the chat JSON and a proposed participant/course projection of `ParticipantCourseAnalytics` and `ParticipantPerformance`. Four fabricated LA rows illustrate individual research records without enabling individual lecturer LA views. Field names from existing fixtures remain unchanged.
- [Assessment results](outputs/consent-la-download-examples/assessment-beispieldaten.xlsx): the exact eight CSV columns and three synthetic result rows, with identifiers stored as text and point totals checked against their components.
- [Lecturer LA groups](outputs/consent-la-download-examples/la-gruppenbericht-beispiel.xlsx): the guide's synthetic rounded metrics and a suppressed row without hidden underlying values. This illustrates the in-tool view, not the broader permitted research export.

All workbooks explain provenance and current/proposed status on a notes sheet. No real data was accessed. Original CSV/JSON fixtures and their manifests remain unchanged. The existing research group fixture's older example threshold is not reused for the new lecturer group workbook. The workbook builder uses the bundled artifact tool; application dependencies and source remain untouched.

Attachment verification: all nine worksheets rendered and inspected. Saved XLSX files were reopened to check exact assessment headers and values, identifier and selection text, numeric LA values and formatting, suppressed blank cells, and absence of hidden worksheets. The attachment section was browser-checked at 1200 px and 390 px, with no horizontal overflow on mobile. All three links resolve to local files; the research link was exercised. No browser errors were reported, and the isolated browser was closed. These artifacts remain in the existing ignored shared review package; no publication was performed.

The browser pass covers initial LA disclosure and no default answer, no/yes plus acknowledgement gating, independent explanatory accordions, group-only lecturer examples, course-switch state, guide links, research data-class defaults, and desktop/mobile overflow. The guide and prototype use the same synthetic report values. This is review evidence for the artifact, not backend privacy proof.

Completed verification: isolated `agent-browser` session at 1200 × 1000 and 390 × 844; inspected before/after screenshots. The desktop signup frame measures 1055 px. All three flows start with the LA section open, zero selected LA answers, research allowed and submit disabled. Both yes and no enable submit only with acknowledgement; unchecking acknowledgement disables it again. All four explanatory accordions remain open together. No research data class is initially selected. The lecturer course switch updates its label and pause message. The guide link resolves locally, its section links resolve, no browser errors were reported, and the guide and signup document have no horizontal overflow at the tested widths. Inline JavaScript parses and document IDs are unique. The isolated browser was closed after verification.

Screenshots: `/tmp/dpo-before-student-guide.png`, `/tmp/dpo-account-desktop-after.png`, `/tmp/dpo-account-mobile.png`, `/tmp/dpo-la-groups-after.png`, `/tmp/dpo-student-guide-desktop.png`, `/tmp/dpo-student-guide-mobile.png`. No backend runtime or live-data test was run.

Before publishing as live student documentation, implement the private dashboard or remove its promise; retire individual payloads from in-tool lecturer LA and route participant-level research downloads through their separate controls; validate disclosure protection and withdrawal; settle retention and the private-insight/course-switch boundary. The source application, original export specimens and PR stack are unchanged by this prototype review.
