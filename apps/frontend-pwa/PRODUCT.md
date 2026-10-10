# KlickerUZH Student PWA

<!-- impeccable:product-schema 1 -->

## Platform

web

This record covers the whole student PWA. Mobile browser use, installation, and
the Android app retain the web product's interaction language. Lecturer tools,
the public website, and the chat application are adjacent products.

## Users

Students use KlickerUZH during teaching sessions and when studying independently.
They need to join the right activity, practise course material, understand
feedback, and find help without learning the platform's internal structure.
Some arrive for the first time through a course link; others return directly to
an activity. Account and access requirements depend on the activity.

## Product Purpose

KlickerUZH connects participation during teaching with practice between sessions.
The student PWA provides access to course activities, feedback, and available
learning support. Success means students understand what they can do in their
course and can start the relevant activity with little preparation.

## Operating Context

Students use phones and larger screens, both directly and through learning
management systems such as OLAT. Course links and the surrounding LMS navigation
are course-specific. General student guidance must work independently of a
particular OLAT structure.

The documentation entry serves as an introduction for newcomers and a reference
for returning students. Keep essential orientation accessible in the PWA and
link detailed procedures to the public student tutorials. Account setup,
Android installation through Google Play, iPhone installation, and notification
help remain discoverable.

## Capabilities and Constraints

- Students participate in live quizzes and study with practice quizzes,
  flashcards, repetition, bookmarks, and microlearning. Course group activities
  provide another participation format. Availability depends on course content
  and access rules.
- Course chatbots provide additional learning support when published and
  accessible to the participant. The approved documentation direction includes
  an embedded way to try the actual course chatbot. Preserve its existing
  authentication, disclosure, and usage controls.
- Gamification has separate course points and account-wide XP/levels.
  Leaderboard participation is optional. Leaving a leaderboard does not revoke
  course or chatbot access, and XP can still accrue. The authoritative domain
  explanation is [the domain model](../../docs/domain-model.md).
- Learning Analytics has an accepted direction: an account-wide participant
  choice and an independent course gate must both permit eligibility. Opt-out
  removes individual derived analytics data and excludes future aggregates;
  it does not promise retroactive aggregate removal. Follow
  [the accepted analytics decision](../../docs/adr/0023-global-learning-analytics-choice-and-course-gate.md).
  The current docs prototype illustrates this direction; its disabled choice
  controls do not save a preference.
- Optional feature introductions must reflect actual course availability.
  Missing configuration is not evidence that a feature is enabled. Assessment
  contexts retain their own restrictions and guidance.

## Brand Commitments

Use the KlickerUZH name and existing product assets. The student experience stays
within the actual PWA shell and its established identity. Write practical,
direct explanations with little marketing language. Motivation comes from
showing a useful activity or explaining a concrete learning benefit.

## Evidence on Hand

The existing [PWA layout](src/components/Layout.tsx) and
[student documentation](src/pages/docs.tsx) provide implementation and content
evidence. The [docs prototype](src/pages/docs-prototype.tsx) demonstrates the
proposed introduction and conditional sections within that layout; it is a
development preview, not evidence of production availability.

The [public student tutorials](https://www.klicker.uzh.ch/student_tutorials/)
provide detailed help. Verify individual claims against current behavior before
reusing them. Prototype activity, leaderboard, and analytics examples are
illustrative rather than real student records or measured learning outcomes.

## Product Principles

1. Make the next useful learning action understandable to a first-time student.
2. Show what the student's course actually offers and preserve access boundaries.
3. Explain essential concepts briefly, with detailed help available by link.
4. Preserve informed choices about leaderboard participation and analytics.
5. Distinguish working capabilities, illustrative examples, and planned behavior.

## Open Decisions

The redesigned guide is wired into production `/docs`; live verification remains
pending. Course Learning Analytics remains hidden until its capability and
processing contracts are released. Existing account-wide choices are reachable
through account settings. A formal
product-specific accessibility conformance target has not been established in
this discussion.
