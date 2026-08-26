# KlickerUZH Context

The shared vocabulary for this repository. Every term here has one meaning
across all apps and packages, and code, plans, issues, and reviews use these
words rather than synonyms. Where the domain is easy to misread, the entry says
what the term is **not**.

This file stays high-level. Area-specific depth belongs in [docs/](docs/), and
the reasoning behind a decision belongs in an ADR under [docs/adr/](docs/adr/).

## People

**User**: Someone who authors and runs teaching content — a lecturer, an
assistant, or an administrator. Users own courses and elements, sign in through
`apps/auth`, and work in the manage and control interfaces. A user is never
called a participant, even when they preview a participant view.

**Participant**: Someone who answers content — a student. Participants live in
their own table with their own login mechanisms and never hold permissions on
courses or elements. "Student" is acceptable in user-facing copy; code and
plans say participant.

**Temporary participant**: A participant created for a single live quiz under a
pseudonym, with no durable account. Anything that assumes a persistent identity
must exclude them explicitly.

**Participation**: One participant's membership in one course. It is the
carrier for course-scoped participant state — leaderboard entry, activity
progress, and assessment identity — none of which belongs on the global
participant account.

## Courses

**Course**: The container a user creates and participants join. Its
`authType` decides how they get in: a **PIN course** admits anyone holding the
numeric pin code, while an **SSO course** admits only people arriving through
SWITCH edu-ID.

**Assessment course**: A course whose participant results are used as formal
assessment records and grade-matching inputs (`isAssessmentEnabled`). It is a
mode of an ordinary course, not a separate type, and it changes what identity
the system keeps and what it will attest to.

**Course invitation**: A pending or accepted invitation addressed to one email
for one course. An invitation is only ever auto-accepted against a **verified
SWITCH edu-ID linked affiliation address**, never against an address a
participant typed into their own profile. That is what makes the invitation
address usable as evidence of who someone is.

## Content

The four content models are the most misread part of this codebase. They form a
chain from reusable definition to what one participant actually sees.

**Element**: The reusable, versioned definition of a single piece of content —
a question, a flashcard, or a content slide. It is owned by a user, lives in
their library independently of any course, and is never answered directly.

**Element instance**: A copy of an element placed inside one activity. It
carries its own results and its own frozen copy of the element's content, so
editing the original element never rewrites what participants already answered.

**Element stack**: The unit a participant is shown and submits at once — one or
more element instances presented together. Practice quizzes, microlearnings,
and group activities are built from stacks.

**Element block**: A live-quiz-only grouping that a user activates and closes
from the control interface, with its own time limit and execution counter.
Blocks are not stacks; only live quizzes have them.

**Personal element**: An element (flashcard, later a question) owned by a
Participant and visible only to them. It is practiced with the same
spaced-repetition scheduling as lecturer elements but never appears in another
student's practice. _Avoid_: student flashcard, user card.

**Lecturer element**: An element owned by a lecturer and placed into a course
activity. Students reach it only through published activities. _Avoid_: course
element, official element (both blur the distinction between the element and
its placement).

**Candidate element**: A generated element shown in the chat that the student
has not saved yet. It becomes a personal element only through an explicit save.
_Avoid_: draft (that word names publication and element editing states).

**Card plan**: The list of proposed personal elements the chatbot presents
after retrieving material on the requested topic, which the student approves
before any element is generated. _Avoid_: outline, proposal.

**Origin**: How an element's content came to exist: AI-generated or authored by
a person. Who owns it is a separate fact. _Avoid_: source (that word names
citations).

**Source-linked personal card**: A participant-owned card that keeps bounded
citation metadata for the course chunks used during generation. Source links
let the participant inspect the material; they do not claim correctness,
entailment, or course-team review. _Avoid_: verified card, validated card.

**Activity**: The umbrella for the four things a course can run — **live
quiz**, **practice quiz**, **microlearning**, and **group activity**. Use the
specific name whenever the statement is only true of one of them.

**Publication status**: The lifecycle an activity moves through — `DRAFT`,
`SCHEDULED`, `PUBLISHED`, `ENDED`, `GRADED`, `TEMPLATE`. It governs whether an
activity can be edited, run, or seen by participants, and is distinct from an
element's own `DRAFT`/`REVIEW`/`READY` authoring status.

## Results and gamification

**Points**: What a participant earns for answering within an activity, subject
to correctness and multipliers. Points are activity-scoped and are what
assessment reporting reads.

**Experience points (XP)**: A separate, account-level progression score that
drives levels and achievements. Points and XP are never used
interchangeably; a change to one is not a change to the other.

**Leaderboard entry**: A participant's score in one scope — course-wide or a
single live quiz. Leaderboards exist only where gamification is enabled for the
course.

## Identity and attestation

**Assessment participation identity**: The given name, surname, and
matriculation number tied to one person's participation in one assessment
course. It is asserted by that person's verified SWITCH edu-ID login, may be
incomplete when edu-ID does not release an attribute, and belongs to neither
ordinary-course participation nor the global participant account.

**Credential subject email**: The email address a credential names as its
subject. It is always the accepted course-invitation address, never the address
a participant sets on their own profile — the invitation address carries edu-ID
provenance, the profile address is unvalidated and freely editable.

**Invitation roster identity**: Identity information supplied by an assessment
course's invitation or roster. It stays distinct from the identity edu-ID
asserts, so that matches, missing values, and conflicts between the two remain
visible rather than being silently resolved.

**Public credential verification**: The bearer-token page that verifies an
assessment credential. Its public projection contains only the student's full
name; it never contains an email address or a matriculation number.

**Catalyst**: The capability tier attached to a user, either institutional
(derived from edu-ID affiliation) or individual (subscribed). It gates feature
limits and capacities, and is a property of the user rather than of any course.

**Feature entitlement**: An account-level condition for using a
rollout-controlled capability. It is additional to role, scope, and resource
permissions and never replaces them.

**Delegated login**: Signing in as a user through a `UserLogin` record with a
scope, rather than through edu-ID. The scope becomes the session's authority
and is enforced field-by-field in the API layer.

## Boundary rules

- Participant-editable values never gain provenance by sitting next to verified
  claims. Where something must be attested, it comes from the verified source
  or it is absent.
- Assessment participation identity is retained only for assessment
  participation and is nullable everywhere else. The manage interface does not
  display it; assessment exports and the student's own credential download are
  its intended consumers.
- The edu-ID release approval covers the email, unique ID, surname, and given
  name claims as required, plus matriculation number and the linked-affiliation
  claims as desired. Assessment identity consumes only the name and
  matriculation claims; the account and affiliation flows own the rest.
- Public projections are deliberately smaller than private ones. Widening one
  is a decision that belongs in an ADR, not in a rendering change.
- An element instance keeps its own copy of the element's data and its own
  results. Editing the source element bumps that element's version and flags
  the instance as outdated; it never rewrites what participants already saw or
  answered.

## Chatbot usage

These terms define the language for lecturer authorization, model usage, and
the two usage lanes shown for chatbot accounts.

### Authorization and lifecycle

**AI usage authorization**:
An account-level approval that requires an approved cost center and permits
both base and advanced model usage. It is separate from publication approval.
_Avoid_: base authorization, advanced authorization, per-model approval

**Publication approval**:
The per-chatbot approval that makes a chatbot reachable by students. It does
not authorize model usage by itself.
_Avoid_: usage approval, activation

### Model classes and budgets

**Usage class**:
The explicit registry classification `BASE` or `ADVANCED` for a model. It
describes the model lane and is independent of who covers the usage.
_Avoid_: funding tier, price tier

**Base model usage**:
Usage from `BASE` models. The teaching center covers a limited amount per
lecturer, but the covered amount is internal and never shown. Base usage above
that contribution remains in the base lane and may consume the authorized
paid budget.
_Avoid_: Luna usage, unlimited usage, lecturer-funded usage

**Advanced model usage**:
Usage from `ADVANCED` models. The teaching center does not cover this usage;
the account's authorized budget applies.
_Avoid_: premium usage, lecturer-funded usage

**Monthly usage budget**:
An operations-managed, account-wide configured limit for one usage class. The
limit persists until operations changes it; only used credits reset at the
Europe/Zurich month boundary. A base budget does not state how much the
teaching center covers.
_Avoid_: chatbot budget, subsidy allowance

**Usage lane**:
The lecturer-facing projection of one usage class. The UI has exactly two
lanes, base model usage and advanced model usage, each showing its configured
budget, used credits, remaining credits, and reset date. Credit figures are
estimates; the configured budget is a soft planning target and the reset date
is exact. The lanes are read-only for lecturers; operations manages the
budgets.
_Avoid_: funding lane, cost center lane

**Hidden base contribution**:
The teaching center's internal base-usage contribution. Its amount, covered
usage, remaining contribution, and settlement details are never returned to
lecturer or participant clients.
_Avoid_: free allowance, unlimited allowance, subsidy balance

### Legacy and boundary terms

**Participant usage credits**:
The existing per-participant, per-chatbot allowance. It remains separate from
the account-wide monthly usage budgets; any fallback must stay within the
same usage class.
_Avoid_: lecturer budget, account credits

**Auto model**:
The automatic model choice, classified as `ADVANCED` for the MVP until every
routed billable step can be attributed to a usage class.
_Avoid_: base fallback, unclassified model

**Class exhaustion**:
The state in which one class has reached its monthly budget. It disables only
that class, never triggers an automatic cross-class switch, and exposes a
class-specific denial code at the participant API boundary.
_Avoid_: chatbot exhaustion, global lockout
