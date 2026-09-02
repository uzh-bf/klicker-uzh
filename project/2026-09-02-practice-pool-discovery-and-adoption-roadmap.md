# Practice Pool Discovery and Adoption Roadmap

- **Status:** Approved for local execution of W1 — Promote the Practice Pool at
  the course entry point
- **Date:** 2026-09-02
- **Approved branch baseline:** `origin/v3` at
  `72096fafe50827c3ea3f50465f0a76d492e0a4c2`
- **Resolved target:** `origin/v3` at
  `7f55d17e03035a54d966f80655d90a6f2282f22a`, five commits ahead of the
  approved branch baseline
- **Branch:** `rs/practice-pool-discovery`
- **Worktree:** `trees/practice-pool-discovery`
- **Execution owner:** Main session
- **Delivery boundary:** Local implementation, verification, review, and commits
  are approved. Upstream integration, push, PR creation, merge, and deployment
  remain separately withheld.

## Goal

Make the existing course Practice Pool the primary entry point on the practice
quiz overview, while preserving access to individual practice quizzes. Then
improve repeat discovery and lecturer distribution without adding pressure,
opaque personalization claims, or participant-level surveillance.

The first delivery should make the Practice Pool's benefit understandable in
one glance: it combines material from the course and orders practice using
spaced repetition.

## Execution contract

- **Ceremony:** Full path because the package changes participant-facing
  behavior, authenticated eligibility, lecturer-facing labels, and the LTI
  public entry point.
- **Authority:** Edit the task worktree, run repository-native checks, start and
  stop the exact local verification runtime, capture browser evidence, dispatch
  required read-only reviews, update this plan, and create local commits.
- **Terminal:** The exact local branch head is ready for a PR on its approved
  baseline: planned behavior is implemented, checks and browser verification
  pass, required reviews are resolved, the runtime is stopped, and Progress is
  current.
- **Boundary owner:** `self`.
- **Withheld:** Do not merge or rebase `origin/v3`, push, create or update a PR,
  merge, deploy, write analytics, or touch production.
- **Pause:** Stop only for a material product or authorization change, an
  unavailable required verification environment, or evidence that the accepted
  behavior cannot be implemented safely on the approved baseline.

The task branch is currently five commits behind the resolved `origin/v3`
target. Those commits touch i18n but not the planned practice-pool source.
Upstream integration is not authorized. Per the repository integration cadence,
first make the package pass on the approved baseline, then report drift and
request one integration pass.

## Primitive impact

| Primitive or composition | Disposition | Contract delta |
| --- | --- | --- |
| `PracticeQuiz` | Reuse | Individual published quizzes remain directly available. |
| Course Practice Pool | Compose | It becomes the primary course-overview choice for eligible participants. |
| Authenticated `Participant` | Reuse | The promotion renders only for this existing role; authorization does not change. |
| Practice quiz overview | Extend | The shared learner and LTI entry point no longer redirects when exactly one quiz exists. |

## ADR gate

No ADR is required. The package composes existing primitives and changes a
reversible presentation default. A new Practice Pool identity, authorization
rule, scheduler contract, or analytics data shape would reopen the ADR gate.

## Current v3 evidence

- The participant overview currently lists individual quizzes only in
  [`overview.tsx`](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/practiceQuizzes/overview.tsx).
  Its server-side redirect bypasses the overview when exactly one quiz exists.
- The existing course Practice Pool is already available at
  `/course/{courseId}/practice` in
  [`practice.tsx`](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/practice.tsx).
- The GraphQL service creates a course-level practice quiz with spaced
  repetition and selects up to 25 stacks in
  [`courses.ts`](../packages/graphql/src/services/courses.ts).
- Access to the course Practice Pool is restricted to an authenticated
  `Participant` in
  [`query.ts`](../packages/graphql/src/schema/query.ts). Anonymous and temporary
  users may still use individual published practice quizzes.
- The lecturer course header, LTI link flow, and LTI documentation already
  distribute the practice quiz overview URL. Improving this one page therefore
  improves the existing entry point rather than creating a parallel flow.
- The global PWA home already links to the general Practice Pool. Its wording
  and behavior are outside the first delivery because this roadmap targets the
  clearer course-context entry point.

## Product decision

Reuse the existing `PracticeQuiz`, course Practice Pool, and `Participant`
authorization primitives. The new top treatment is presentation and
composition, not a new product primitive. Do not change the scheduler, stack
selection, scoring, schema, authentication, or authorization.

On the course practice quiz overview:

1. Show a prominent semantic link to the course Practice Pool when at least one
   published practice quiz exists and the current user is an authenticated
   `Participant`.
2. Omit the Practice Pool promotion for every other user state. Do not show a
   disabled control that leads to an authorization dead end.
3. Keep the individual practice quizzes below the promotion under a distinct
   heading.
4. Remove the one-quiz redirect so eligible participants can discover the
   Practice Pool. The overview remains useful for non-participants because it
   still exposes the individual quiz.
5. Preserve the existing zero-quiz empty state and do not promote an empty
   pool.

Recommended copy:

| Element | German | English |
| --- | --- | --- |
| Title | Gezielt mit Spaced Repetition üben | Practice with spaced repetition |
| Supporting text | Bis zu 25 Fragensets aus allen Übungs-Quizzes. Deine bisherigen Antworten können die Reihenfolge beeinflussen. | Up to 25 question sets from all practice quizzes. Your previous answers can influence the order. |
| Action | Übungspool starten | Start Practice Pool |
| List heading | Einzelne Übungs-Quizzes | Individual practice quizzes |

The copy says "can influence" because the interface must not promise that every
new session is personalized. It says "up to 25 question sets" to match the
stack-based service contract.

## Non-goals and non-negotiables

- Do not replace or demote access to individual practice quizzes.
- Do not add a new Practice Pool endpoint, algorithm, data model, dependency,
  notification system, or gamification mechanic.
- Do not claim a due date, optimal study time, guaranteed personalization, or
  learning improvement that the product cannot verify.
- Do not add clickstream telemetry or a participant-level lecturer dashboard in
  the first delivery.
- Keep participation optional. Do not use streak pressure, loss framing, or
  recurring reminders by default.
- Keep German and English copy paired and correct the existing German
  `Spaced Repeitition` typo when that translation is touched.

## Delegation map and implementation slice

| Workstream | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- |
| W1 — Promote the Practice Pool at the course entry point | Main session | Approved product and privacy decisions in this plan | Focused checks, authenticated browser evidence, exact diff inspection, required reviews, and local commits |
| W2 — Create a useful completion loop | Separate task (proposed) | W1 — Promote the Practice Pool at the course entry point and a ruling on fresh-session semantics | Individual and pool completion return to an accurate next action without losing or falsely resetting progress |
| W3 — Help lecturers distribute the course entry point | Separate task (proposed) | W1 — Promote the Practice Pool at the course entry point | Lecturer guidance and copied links match the participant experience without automated messages |
| A1 — Approve aggregate adoption measurement | Separate task (proposed) | A separately approved privacy purpose after W1 — Promote the Practice Pool at the course entry point | Purpose, legal basis, minimum aggregates, retention, access, transparency, and small-cohort suppression are approved before telemetry |
| A2 — Approve repeat-use measurement | Separate task (proposed) | A1 — Approve aggregate adoption measurement and evidence that aggregates are insufficient | Linkage necessity, shortest useful window, deletion, access, and participant explanation are approved before implementation |
| W4 — Run a bounded adoption pilot and choose the next intervention | Separate task (proposed) | W1 — Promote the Practice Pool at the course entry point and A1 — Approve aggregate adoption measurement if telemetry is used | A consenting-course pilot separates discovery and repeat use from learning outcomes and selects one evidence-backed follow-up |

The proposed separate tasks record roadmap topology only. They are not
authorized to launch or write in this execution.

- **Route:** `main`.
- **Execution-tier skip reason:** Critical-path coupling. The participant UI,
  role eligibility, i18n, lecturer labels, LTI guidance, test assertions, wiki,
  and relevant skill form one small shared contract in one worktree.
- **Do:** Implement W1 — Promote the Practice Pool at the course entry point as
  one tracer-bullet slice across the existing overview route and its existing
  distribution surfaces.
- **Check:** Run the PWA, Manage, i18n, docs/wiki, and Playwright static checks;
  then verify the changed participant and non-participant states in the browser.
- **Commit:** Commit this approved plan first. Commit the complete implementation
  slice only after its baseline verification passes. Commit review corrections
  separately only when they materially improve the accepted slice.
- **Review sequence:** Implementation commit; parallel simplifier and
  eligibility/LTI slice review; verified corrections; fresh package
  verification; integrated final review.

## Test portfolio

| Consequential behavior | Existing evidence | Test obligation | Primary seam | Distinct failure protected |
| --- | --- | --- | --- | --- |
| An eligible participant sees the pool with one published quiz | Existing serial state after publishing `data.running.nameNew` | Extend existing | Direct overview navigation in the existing student solve test | `open-practice-pool` or `open-practice-quiz-${data.running.nameNew}` is missing because the redirect or role check hides the overview |
| An eligible participant sees the pool with multiple published quizzes | Existing serial state after publishing `data.manipulation.name` and its duplicate | Extend existing | Direct overview navigation in the first manipulation student test | `open-practice-pool`, `open-practice-quiz-${data.manipulation.name}`, or the duplicate quiz link is missing |
| A lecturer non-Participant never receives a pool link | Existing lecturer preview workflow opens the published running quiz | Extend existing | Direct overview navigation before the preview | `open-practice-pool` is visible to a lecturer while the individual quiz link is unavailable |
| Zero published quizzes retain the empty state | Existing serial state after hard-deleting the running quiz while the future quiz remains unpublished | Extend existing | Direct overview navigation in the existing student visibility test | `practice-quiz-overview-empty` or the warning is missing, or `open-practice-pool` is visible |
| Individual quiz links remain available | Existing one- and multi-quiz student flows | Extend existing | `playwright/tests/Q-practice-quiz.spec.ts` | Promotion replaces rather than complements specific quizzes |
| German and English copy stay paired | Repository i18n checks | No new test | `packages/i18n/messages/de.ts` and `en.ts` | One locale silently falls back or keeps inaccurate stack wording |
| Lecturer and LTI links keep the same destination | Existing source contract and documentation examples | No new test | Manage source and LTI documentation diff | Adoption copy accidentally changes routing or permissions |

## Work packages

### W1 — Promote the Practice Pool at the course entry point

- **Priority:** First delivery
- **Packaging:** One cohesive v3 PR after separate push and PR approval
- **Outcome:** Eligible participants see the course Practice Pool as the primary
  choice, understand why it is useful, and can still choose a specific quiz.

Scope:

- Add the semantic promotional link, supporting copy, and individual-quiz
  subheading to the PWA overview.
- Use the generated `SelfDocument` result and require
  `self.role === UserRole.Participant` before rendering the link. While that
  query is loading, errors, or has no `self`, omit the promotion. A participant
  token or course token alone is never eligibility evidence.
- Remove the one-quiz redirect and retain the zero-quiz empty state.
- Implement the promotion as a standalone semantic `next/link`. Do not use or
  modify `LinkButton.tsx`, and leave the existing individual quiz links
  unchanged.
- Update the existing lecturer-facing course link label and LTI documentation
  so the distributed course entry point is described as "Practice Pool &
  quizzes" rather than only "Practice quizzes".
- Update both Manage labels: `linkLTIPracticeQuizzesLabel` and
  `practiceQuizList`. Update `lti_integration.mdx` to recommend the combined
  entry point and to state that its overview remains available with one quiz.
- Record the overview contract in `docs/frontend-conventions.md`, update the
  matching `klicker-frontend-ui` skill guidance, and create the required
  `docs/log/` entry.
- Leave the global PWA home Practice Pool unchanged.
- Add stable selectors for the Practice Pool link and the individual quiz list.

Acceptance checks:

- An authenticated participant sees the promotion with one quiz and with
  multiple quizzes; the link opens `/course/{courseId}/practice`.
- No promotion appears with zero quizzes or for anonymous, temporary,
  lecturer, and other non-`Participant` states.
- Self-query loading, error, and missing-self states fail closed without using
  token presence as a substitute.
- Individual quizzes remain available with one and multiple quizzes.
- The interaction uses a semantic link without nesting an active button inside
  an active link.
- German and English render correctly without overflow at mobile and desktop
  widths.
- Keyboard focus is visible, the accessible name is specific, and the mobile
  target is at least 44 by 44 pixels.
- Focused frontend checks and the relevant Playwright scenario pass.
- Browser evidence includes authenticated participant screenshots for the
  eligible one-quiz and multiple-quiz states, plus representative ineligible
  and empty states. Delegated lecturer login is not valid evidence for the
  eligible state.
- The lecturer/LTI label and documentation point to the unchanged overview URL.

`pr_ready` for W1 — Promote the Practice Pool at the course entry point means
the local exact head has passed focused checks, browser verification, diff
inspection, and the required local reviews. It does not mean a branch was
pushed or a PR was created.

### W2 — Create a useful completion loop

- **Priority:** Next retention improvement
- **Dependency:** W1 — Promote the Practice Pool at the course entry point
- **Outcome:** Finishing a practice session leads back to a meaningful course
  practice choice instead of the generic application home.

W2 — Create a useful completion loop is not executable until its session
semantics are resolved. First establish whether a completed course pool can
start a fresh selection immediately, how answered stacks affect that selection,
and whether progress is reset or resumed. Then choose the completion action:

- Recommended safe default: return to the course practice overview.
- Add "Start another round" only if a fresh round and its progress behavior are
  proven and clearly communicated.

Acceptance checks must cover individual-quiz and course-pool completion,
reload and back navigation, repeated starts, mobile layout, and keyboard use.

### W3 — Help lecturers distribute the course entry point

- **Priority:** Parallel follow-up after the first delivery
- **Dependency:** W1 — Promote the Practice Pool at the course entry point
- **Outcome:** Lecturers can intentionally share one course link that presents
  both spaced-repetition practice and individual quizzes.

After the first label correction, add concise lecturer guidance for where to
place the link, such as weekly course materials and exam-preparation sections.
Provide optional invitation copy that explains the learner benefit without
promising a learning outcome. Do not send automated notifications.

Acceptance checks must confirm that copied access and LTI links still resolve
to the overview, permissions remain unchanged, and the guidance matches the
participant experience.

### A1 — Approve aggregate adoption measurement

- **Priority:** Privacy gate before aggregate telemetry
- **Dependency:** W1 — Promote the Practice Pool at the course entry point
- **Outcome:** A separately approved measurement design can answer whether the
  entry point is discovered without exposing participant behavior.

Before implementation, document the purpose, legal basis, minimum event list,
retention, access, transparency, and small-cohort suppression rule. Prefer
course-week aggregate counts such as eligible overview views, pool starts, and
individual quiz starts. Do not expose identities or raw event trails to
lecturers. W1 — Promote the Practice Pool at the course entry point ships
without waiting for this gate.

### A2 — Approve repeat-use measurement

- **Priority:** Separate privacy gate before linked behavior
- **Dependency:** A1 — Approve aggregate adoption measurement
- **Outcome:** Any measurement of returning use has an explicit necessity and
  governance decision.

Repeat-use analysis requires linking actions over time, even if identifiers are
pseudonymous. Treat that as a separate data shape. Approve it only if aggregate
counts and voluntary qualitative feedback cannot answer the adoption question.
Define the shortest useful linkage window, deletion behavior, access, and
participant explanation before implementation.

### W4 — Run a bounded adoption pilot and choose the next intervention

- **Priority:** Evidence-led expansion
- **Dependencies:** W1 — Promote the Practice Pool at the course entry point
  and, if telemetry is used, A1 — Approve aggregate adoption measurement
- **Outcome:** One or a few consenting courses reveal whether discovery,
  understanding, and repeat use improve before broader product investment.

Evaluate adoption separately from learning outcomes. Combine approved
aggregate measures with voluntary, low-burden feedback from participants and
lecturers. Do not infer that non-use means a student lacks motivation or needs
remediation.

Use the pilot to select one next intervention rather than shipping a bundle:

- clarify expected session length if uncertainty is the main barrier;
- improve contextual lecturer prompts if discovery remains low;
- improve completion feedback if starts are healthy but returns are weak;
- consider progress or due-state cues only if the product can support them
  accurately and without pressure.

## Dependency order

1. Deliver W1 — Promote the Practice Pool at the course entry point.
2. In parallel, resolve W2 — Create a useful completion loop and prepare W3 —
   Help lecturers distribute the course entry point.
3. Consider A1 — Approve aggregate adoption measurement only when a pilot needs
   telemetry; do not block the user-facing improvement on analytics.
4. Invoke A2 — Approve repeat-use measurement only if aggregate evidence is
   insufficient.
5. Run W4 — Run a bounded adoption pilot and choose the next intervention,
   then fund the next change from observed barriers.

## Evidence basis and limits

Retrieval and distributed practice improve delayed retention in many learning
settings, which supports explaining the existing mechanism clearly. That
evidence does not show that a particular CTA will increase voluntary use.
Adoption therefore needs its own bounded evaluation.

- Cepeda et al. review distributed-practice effects:
  <https://pubmed.ncbi.nlm.nih.gov/16719566/>
- Yang et al. meta-analysis of classroom quizzing:
  <https://doi.org/10.1007/s10648-021-09595-9>
- Jisc code of practice for transparent and proportionate learning analytics:
  <https://www.jisc.ac.uk/guides/code-of-practice-for-learning-analytics>
- Large-scale behavioral-intervention replication caution:
  <https://pmc.ncbi.nlm.nih.gov/articles/PMC7334459/>

The roadmap therefore favors a clear benefit statement, a contextual course
entry point, lecturer distribution, and a bounded pilot. It does not assume
that efficacy automatically produces adoption or that more reminders are
better.

## Review and verification plan

- Use repository-native focused checks for the PWA, i18n, Manage label, and
  documentation changes.
- Use host Playwright against the routed development environment for the named
  browser states. Do not start a runtime for documentation-only checks.
- Inspect every changed hunk and preserve unrelated work.
- Run the review gates required by the approved execution tier at the exact
  local head. Record planner and reviewer provenance, including any continuity
  fallback.
- Stop before push, PR creation, merge, deployment, analytics writes, or any
  production action unless the user authorizes that boundary explicitly.

## Planner disposition

The native planner route failed before launch because its configured model was
unavailable. A trusted Sol planner ran through the generic continuity route and
returned `REVISE`. This roadmap adopts all required revisions: exact
eligibility, qualified stack copy, semantic linking, complete state coverage,
participant-login browser proof, first-package lecturer/LTI corrections,
unchanged global home, a decision gate for completion semantics, separate
aggregate and repeat-use privacy gates, and a local definition of `pr_ready`.

The final native Sol plan-hardening pass first returned `REVISE`. The roadmap
now separates branch baseline from target drift and withheld integration,
assigns every roadmap item once, fixes the exact participant eligibility and
fail-closed contracts, covers both Manage labels and both LTI entry modes, and
records the serial Playwright fixtures plus the exact review sequence. The same
planner then returned `DONE` with `Verdict: APPROVED`.

## Progress

- [x] Refreshed remote refs and resolved `origin/v3` as the explicit target.
- [x] Inspected the current overview, pool route, GraphQL selection and
  authorization, completion flow, translations, lecturer links, LTI docs, and
  existing test coverage.
- [x] Challenged the product and privacy plan with an independent planner and
  incorporated its revisions.
- [x] Created an isolated v3-based worktree and branch for the roadmap.
- [x] Obtain plan approval.
- [x] Record the approved branch baseline, resolved target drift, and withheld
  integration separately.
- [x] Obtain the final `APPROVED` plan-hardening verdict.
- [x] Commit the approved plan.
- [x] Implement W1 — Promote the Practice Pool at the course entry point.
- [ ] Verify and review the local exact head.
- [ ] Request separate authority for push and PR creation if desired.
