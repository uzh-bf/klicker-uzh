# 5. Separate live-quiz response identity policies

- **Status:** Accepted — 2026-08-12
- **Context:** [PR #5134](https://github.com/uzh-bf/klicker-uzh/pull/5134), [ADR-0007](./0007-correlated-live-quiz-response-boundary.md)

## Context

Assessment responses and standard correlated responses both need durable rows, but they have opposite identity requirements. Assessment evidence must remain attributable to a participant for grading, corrections, audit, and result access. A standard correlated teaching export must preserve answer grouping while allowing the account or browser association to be destroyed. Writing a logged-in correlated response directly with `participantId` would make that later unlinking impossible.

`TemporaryLeaderboardEntry` is not a general anonymous identity. It is a visible gamification projection with a pseudonym, avatar, and mutable score. Correlated collection is incompatible with gamification, so making that row own correlated responses would couple a privacy boundary to presentation state that is absent in correlated quizzes.

## Decision

Live-quiz responses use a mode-specific owner:

- Standard `AGGREGATED_ANONYMOUS` quizzes create no durable individual response rows.
- Assessment responses are owned by `Participant` and retain `participantId` for their complete audit and correction lifecycle.
- Standard `CORRELATED_EXPORT` responses are owned by a quiz-scoped `LiveQuizRespondent`, including responses submitted by logged-in participants. They never store `participantId` on the durable response.

`LiveQuizRespondent` is a minimal pseudonymous grouping key scoped to one `LiveQuiz.publicationGeneration`. While a correlated quiz accepts responses, a separate `LiveQuizRespondentBinding` maps that key to exactly one credential source: either a participant account or a hashed anonymous respondent credential. The binding is not part of the retained response dataset.

The binding enforces both directions of the mapping under concurrent admission:

- one active binding per respondent;
- exactly one of `participantId` or `verificationSecretHash` is set;
- one participant account maps to at most one respondent per quiz generation; and
- one anonymous credential hash maps to at most one respondent per quiz generation.

Participant and anonymous create-or-resolve operations use those generation-scoped unique constraints as the authoritative concurrency boundary. Anonymous tokens carry both `liveQuizId` and `publicationGeneration`; a token from an earlier generation is rejected even if its client-side cookie has not expired.

Anonymous browser continuity uses an opaque signed token in an HttpOnly, Secure, SameSite=Lax cookie named for the live quiz. The token and cookie have the same bounded lifetime and are never reused across quiz generations. The server stores only its hash in the active binding. If storage is blocked or cleared, the browser can receive a new respondent and the export may contain a split row; it never falls back to a durable device fingerprint.

`TemporaryLeaderboardEntry` remains specific to gamified pseudonym participation and is not merged with `LiveQuizRespondent`. If non-gamified public pseudonyms become a future requirement, they may be modeled as an optional presentation profile over a respondent; they do not change response ownership.

## Consequences

- Assessment attribution, corrections, and audit exports remain unchanged and identifiable.
- Logged-in and anonymous correlated respondents have the same retained data shape and export namespace.
- Database and service invariants must prevent `participantId` ownership in standard correlated mode and `respondentId` ownership in assessment mode.
- A correlated response inherits its generation through its respondent. Pending receipts persist the generation directly so admission, settlement, and finalization can fence one execution independently of later publications.
- The current compatibility shape, where `LiveQuizRespondent` contains leaderboard fields and temporary pseudonyms may create two rows with the same UUID, must be removed before correlated publication is enabled.
