# Practice Quiz AI Disclosure Placement Design

## Goal

Ask participants about external AI processing before a Practice Quiz starts when
the quiz contains semantic free-text rubric feedback. Do not interrupt a
participant after they have submitted an answer.

## Considered placements

Three placements were considered:

1. **Start-action modal (selected):** keep the quiz overview compact and open the
   disclosure when the participant selects **Start**.
2. **Inline overview disclosure:** make the complete notice permanently visible,
   at the cost of adding substantial text to every affected overview.
3. **Course-entry disclosure:** ask earlier and less often, but separate the
   decision from the feature and quiz that will use external processing.

The start-action modal gives the decision immediate context, reuses the existing
interaction, and preserves the current Practice Quiz overview.

## Participant flow

The Practice Quiz payload already identifies free-text elements that have semantic
evaluation configured. When **Start** is selected:

1. A quiz without any such element starts immediately.
2. Lecturer previews and temporary participants start without a disclosure because
   they cannot use participant semantic evaluation.
3. A registered participant who already accepted or declined the current disclosure
   version starts immediately.
4. A registered participant without a decision sees the non-dismissible disclosure
   modal in the participant app's interface language.
5. Both **Accept** and **Decline** persist the decision and then start the quiz.
   Declining retains the deterministic exact-answer fallback and disables external
   semantic evaluation.

The decision remains participant-wide for the disclosure version, matching the
existing persistence model. A new disclosure version requires a new decision at the
next affected Practice Quiz start.

## API and component boundaries

The public semantic capability response will expose the authenticated participant's
nullable decision for its current disclosure version. Lecturer and other
non-participant callers receive no participant decision. The existing mutation
continues to persist acceptance or refusal.

`PracticeQuiz` derives whether any stack contains semantic rubric feedback and owns
the start gate. `PracticeQuizOverview` delegates its Start action instead of setting
the first stack directly. `SemanticEvaluationConsentModal` moves to this quiz-level
boundary and uses the normal EN/DE participant i18n namespace.

The element-level hook no longer owns disclosure decisions, and
`PracticeQuizElement` no longer opens a modal after submission. Server-side consent
enforcement remains unchanged: a missing or declined decision can never authorize an
external evaluator request, even if the UI state is stale or bypassed.

## Error and fallback behavior

The quiz does not start until an undecided participant's decision mutation succeeds.
The modal stays open and shows an inline error when persistence fails. Existing
decisions do not depend on current evaluator availability; this prevents a recovered
service from processing an answer without a prior decision.

If server-side enforcement nevertheless reports missing consent during an answer
flow, the response remains inside KlickerUZH and the existing honest unavailable
state is shown. The after-answer disclosure modal is not restored as a fallback.

## Verification

Focused GraphQL tests will cover a nullable current-version decision and the existing
versioned persistence behavior. Browser and Playwright verification will cover:

- an unaffected quiz starting directly;
- an affected quiz showing the disclosure before its first question;
- both acceptance and refusal continuing into the quiz;
- no disclosure after answer submission;
- a saved decision preventing repeat prompts;
- renewed prompting after a disclosure-version change; and
- participant-locale copy at desktop and mobile widths.
