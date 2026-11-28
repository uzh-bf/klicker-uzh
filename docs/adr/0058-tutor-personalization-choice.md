# 58. Tutor personalization uses one account-level student choice

## Status

Proposed. The design is decided; the legal basis, the notice text, the
retention period for the memory and whether the account disclosure version
changes await confirmation by the controller. The pilot is switched on only
after that confirmation.

## Context

The Tutor could give better help if it knew what a student has already
practised in the course and remembered how earlier conversations went.
[ADR 0054](./0054-student-answer-style-layer.md) removed a self-rated
knowledge level and named the follow-up: depth should follow evidence from the
platform, and that follow-up needs its own data-protection review and
decision. It also kept student settings in browser storage and said that
server-side storage needs a new decision. This is that decision.

Sending a learner's results and stored notes about them to the model provider
is a new purpose. Three existing mechanisms looked reusable and are not:

- The account-level Learning Analytics choice
  ([ADR 0023](./0023-global-learning-analytics-choice-and-course-gate.md))
  covers de-identified group reports for lecturers. Its processing is switched
  off and course activation does not exist yet.
- The chatbot disclaimer acceptance records that a notice was shown. It is not
  a data-use choice, and the account's choices have one canonical writer with
  no parallel chat store.
- Browser storage cannot hold a choice record: it does not follow the student
  across devices and can reset in embedded views.

## Decision

- **One purpose, one choice, one lecturer switch.** Personalization covers two
  uses: a per-turn summary of the student's course results, and a stored
  memory of their learning progress in the course. One student choice and one
  per-chatbot lecturer switch (default off) each cover both. The choice is
  independent of Research participation, the Learning Analytics choice, the
  privacy-policy acknowledgement and the chatbot disclaimer. None of them
  implies it.
- **Three states.** Unanswered, yes, no. Only a recorded yes makes a student
  eligible. The initial state is stored as unanswered; a database default is
  not a recorded decision. An explicit no is recorded with its time and notice
  version.
- **Account-level, in the canonical record.** The choice lives with the
  existing data-use choices, is written only by the canonical data-use writer
  and appears in its change history. It stays outside the account completion
  check, so it never blocks account or chat use.
- **Offered where it is used.** The chatbot shows the offer once per account,
  with yes and no at equal visual weight. An answer ends the offer for good.
  "Decide later" leaves the choice unanswered and is remembered in the browser
  only. A control in the chat settings and on the
  data-use page changes the choice at any time.
- **Eligibility is checked on every turn and fails closed.** The learner
  context, which is the results summary plus the memory, is sent only in Tutor
  mode and only when all three hold: a completed account data-use notice, the
  lecturer switch on, and a recorded yes. If any check fails or is uncertain,
  the standard Tutor runs with an unchanged prompt and nothing is written to
  memory. Guests are eligible on the same terms: a guest is a persisted
  participant with a stable identity per course, and the chat shows them the
  account notice.
- **Memory lives in Catalyst behind a public contract.** Following
  [ADR 0006](./0006-public-catalyst-capability-floor.md), public KlickerUZH
  owns the choice, the lecturer switch, eligibility, the interface and the
  contract; the memory service owns storage and the computation, reads no
  KlickerUZH table and knows nothing about the interface. Without the service,
  personalization works with the results summary alone: no notes are kept, and
  the settings and the notice do not mention them. Memory is used only when
  the service is configured, the chatbot owner holds the Catalyst entitlement,
  and the student's yes was recorded under the notice version that describes
  the notes. The record is keyed by a keyed hash of the participant id and is
  limited to fixed categories: topics worked on and how it went, recurring
  difficulties, and the stated learning goal. It holds no transcripts.
- **Memory is inferred, so the student controls it.** The student can read and
  delete it at any time and keep personalization on. Deleting also works while
  the account data-use notice awaits a new acknowledgement. Changing the choice
  follows the other data-use choices and needs the current notice acknowledged
  first; until then nothing is used and nothing new is written.
- **Opting out stops the use in the same write as the choice.** That write
  also raises the participant's memory epoch and records a forget request in a
  table that does not depend on the participant row. Every call to the service
  carries the epoch, and the service never returns a record with an older one.
  A background task sends the request within minutes and retries until the
  service confirms it; a deletion the student starts in the chat is sent at
  once.
  Account deletion records a forget-everything request in the same
  transaction.
- **Course-bound use.** The account-wide yes does not combine data across
  courses. A chatbot receives results and memory from its own course only. The
  results summary covers practice quizzes and microlearnings, never live
  quizzes or assessments.
- **Nothing reaches lecturers.** They see neither the learner context nor who
  said yes.
- **Learner context stays out of traces.** The chat route's tracing records
  neither model inputs nor outputs; that setting becomes a requirement, and it
  covers the step that writes memory.

## Considered options

- **Reuse the Learning Analytics choice.** Rejected: a different purpose with
  different recipients, and its processing is switched off.
- **A per-chatbot choice on the participant-and-chatbot record.** Finer-grained
  and confined to the chat schema. Rejected: a second store for a data-use
  choice that the data-use page would not show, against the one-writer rule.
- **A browser-only setting, as in ADR 0054.** Rejected: not reliable enough to
  carry this choice.
- **A separate choice for memory.** Rejected in favour of one flag for
  students and lecturers. Whether one choice is specific enough for both uses
  is part of the open confirmation.
- **Memory in the KlickerUZH database.** Simpler and transactional with the
  choice. Rejected: memory is a Catalyst capability, and public keeps only the
  contract.

## Consequences

- The choice, its change history, the lecturer switch, the memory epoch and
  the forget requests are public schema; the memory record lives in the
  service's own database.
- Deletion across two systems is not atomic. The choice is the single point of
  truth: once it is no, nothing is read or written, whatever the service still
  holds until the deletion is confirmed.
- A student must complete the account data-use notice before opting in. The
  chat shows that notice at entry, for registered accounts and guests.
- A yes covers every course whose lecturer enabled personalization. If
  students ask for finer control, a per-chatbot pause can narrow it as a
  preference without becoming a second choice record.
- Writing memory needs an extra model call per completed Tutor reply, made and
  paid by the service, so the student's credits are not charged.
- ADR 0054 stands otherwise: answer format and tone stay browser-only, and a
  self-rated knowledge level stays removed.
