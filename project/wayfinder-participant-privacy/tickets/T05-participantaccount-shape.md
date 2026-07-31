# T05 — Decide the ParticipantAccount migration shape

Label: `wayfinder:grilling`
Parent: [MAP.md](../MAP.md)
Status: open
Assignee:
Blocked by: T01

## Question

Open decision from the plan's table. Owner: Engineering. The plan's own recommendation is
"keep facade during migration, remove in cleanup slice", and the data it says is needed is
"count references and code paths depending on `ParticipantAccount`".

This is the one open decision answerable from the codebase alone — no telemetry, no DPO.

Establish the reference count and the shape of the dependency: which resolvers, services,
seeds, tests, and frontend queries read or write `ParticipantAccount`, and which of them
care about its identity rather than just its data. Then rule on the migration shape.

Relevant known facts, already established and not to be re-derived:

- `resolveOrCreateParticipantForLti` resolves by `ssoId` and then by `Participant.email`,
  and **both run before the `allowCreate` gate** — so `allowCreate: false` constrains
  account creation only, never resolution. Documented in `docs/auth-model.md`.
- `ssoType` is a free-form `String` defaulting to `"LTI1.1"`, so the default no longer
  describes reality for new rows. Changing it needs a migration.
- Historical `ssoType = 'LTI1.1'` rows were deliberately left untouched by PR #5260.

## Resolution

<!-- filled in on close -->
