# T02 — Measure participant login-method composition

Label: `wayfinder:task`
Parent: [MAP.md](../MAP.md)
Status: open
Assignee:
Blocked by: —

## Question

Three decisions in the plan are recorded as blocked on "four weeks of login-method
telemetry" that does not exist. Composition data that already sits in the database may
answer them without shipping anything. Establish it.

Against a production snapshot, measure:

- participants with a password vs SSO-only vs both;
- `ParticipantAccount.ssoType` distribution, and how many rows are historical `LTI1.1`;
- email coverage — how many participants have `Participant.email` set, split by
  `isSSOAccount`;
- outstanding invitations holding raw email/matriculation values;
- how many participants would have **no** usable login route under each candidate
  cutover shape.

Then judge, per decision, whether composition is sufficient or real telemetry is
genuinely required. That judgement is the ticket's real output — the numbers are
evidence for it.

**Access.** This needs a production snapshot and is the one ticket that may not be
AFK-able. If no snapshot is reachable, hand back a precise checklist of what to run and
where, rather than guessing. **Do not** copy real participant data into this repo:
report aggregates only, no identifiers, no raw exports.

## Resolution

<!-- filled in on close -->
