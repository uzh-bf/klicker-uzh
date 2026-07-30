# KlickerUZH

KlickerUZH supports teaching and learning activities while separating the data needed to operate those activities from optional secondary processing.

## Language

**Learning Analytics (LA)**:
Derived metrics, visualizations, personalization signals, and exports produced to understand or improve learning. LA excludes ordinary activity operation, evaluation, feedback, and grading.
_Avoid_: Analytics

**LA opt-out**:
A participant's course-specific choice that prevents their activity data from being used in dedicated LA computation or shown in dedicated LA outputs. It does not prevent normal participation, activity evaluation, feedback, or grading.
_Avoid_: Course opt-out, data opt-out

When an LA opt-out takes effect, all of that participant's past and future course activity is excluded from subsequent LA calculations. Existing aggregate results are not recalculated solely because of the opt-out; they are replaced the next time the applicable LA calculation runs.

Any existing student-level LA output for the participant is hidden immediately when the opt-out takes effect.

**De-identified LA row**:
A report-scoped learner row labeled generically, such as "Student 1." It cannot be matched across reports and contains only coarse LA metrics. Safeguards minimize but cannot guarantee against identification from a lecturer's outside knowledge.
_Avoid_: Anonymous student, pseudonymous student row, participant profile

De-identified LA rows exclude direct identifiers, stable labels, free text, exact timestamps, item-by-item response sequences, rare attributes, narrow filters, and other combinations that materially increase identification risk. Lecturers must not attempt to identify a participant or combine LA with other data for that purpose.

**LA disclosure threshold**:
Student-level LA rows and filtered breakdowns are available only when at least five LA-included participants remain in the displayed group. Below five, the output is suppressed or replaced by a safe aggregate that does not enable identification.
_Avoid_: Small-group exception

**LA participation choice**:
A neutral, course-specific choice shown when a participant joins or next enters an LA-enabled course. Neither option is preselected. The explanation presents the benefits for participants and lecturers, the activity data used for LA, what lecturers can see, and what is explicitly excluded. The participant can decide later and join or use the course without making a choice.
_Avoid_: Consent checkbox, acceptance

Participants can change their LA participation choice at any time within the course.

After a participant opts back into LA, only activity created from that point onward becomes LA-eligible. Activity excluded by an earlier opt-out remains excluded from later calculations.

A material disclosure change requires a new choice and excludes activity until that choice is made. Renewed inclusion starts at the new acknowledgement time; editorial changes do not create a new disclosure version or require another choice.

**LA coverage**:
Whether a participant permitted LA throughout the selected analysis period. Coverage is complete when LA was permitted for the whole period and partial when it was permitted for only part of it. Coverage does not describe whether the participant completed every activity.

The current whole-course performance view uses the course start date as the
analysis-period boundary. A participant is complete only when their current
inclusion began no later than that boundary; missing or unfinished activities
do not change coverage.
_Avoid_: Partial participant, complete participant

LA reports and exports can filter for complete coverage within their selected period. Every aggregate or data point reports its effective sample size after applying LA eligibility, coverage filters, and the metric's own inclusion rule. The LA disclosure threshold applies to that effective sample size.

Lecturer dashboards include both complete and partial eligible coverage by default and display the effective sample size. LA exports default to complete coverage for the selected period and offer an explicit option to include partial coverage.

Lecturers see no separate count or student-level status for participants who declined LA or have not decided. LA outputs show only their effective sample size and explain that it can vary because of eligibility, coverage, and metric-specific inclusion.

**Course LA status**:
The lecturer-controlled setting that enables or disables dedicated LA for a course. Lecturers may change it after course creation. Disabling it stops LA calculation, hides LA, and deletes dedicated LA results while retaining operational course data.
_Avoid_: Student consent, course consent

New courses start with LA disabled. The lecturer must deliberately enable it after seeing an explanation of its benefits, data use, and responsibilities.

At feature rollout, existing courses also move to LA disabled and their dedicated LA results are removed. A lecturer must explicitly re-enable LA before further calculations; students without a recorded choice are then prompted on their next course entry.

A course status change does not erase participant LA choices or the disclosure version they acknowledged. If the lecturer re-enables LA, the recorded participant choices remain in force; participants are asked again only if the disclosure has materially changed.

A course-level disabled period does not make ordinary course activity ineligible for later LA. When LA is re-enabled, dedicated LA results can be recomputed from retained operational data wherever the participant's own LA choice permits it.

Students are not shown an LA participation choice while course LA is disabled. After LA is enabled, students without a recorded choice see the neutral disclosure and choice the next time they enter that course. Their activity remains excluded from LA until they make a choice.

The choice does not block course access. A student may decide later, remains excluded from LA in the meantime, and sees a persistent course-level reminder until choosing.
