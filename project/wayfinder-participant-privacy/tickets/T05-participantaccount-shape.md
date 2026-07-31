# T05 — Decide the ParticipantAccount migration shape

Label: `wayfinder:grilling`
Parent: [MAP.md](../MAP.md)
Status: open
Assignee:
Blocked by: —

## Question

Open decision from the plan's table. Owner: Engineering. The plan's own recommendation is
"keep facade during migration, remove in cleanup slice", and the data it says is needed is
"count references and code paths depending on `ParticipantAccount`".

This is the one open decision answerable from the codebase alone — no telemetry, no DPO.

Establish the reference count and the shape of the dependency: which resolvers, services,
seeds, tests, and frontend queries read or write `ParticipantAccount`, and which of them
care about its identity rather than just its data. Then rule on the migration shape.

Relevant known facts, already established and not to be re-derived. All re-confirmed at
`7812fa71ce` by [the claim re-verification](T01-reverify-codebase-claims.md):

- `resolveOrCreateParticipantForLti` resolves by `ssoId` and then by `Participant.email`,
  and **both run before the `allowCreate` gate** — so `allowCreate: false` constrains
  account creation only, never resolution. Documented in `docs/auth-model.md`; the gate
  is still at `accounts.ts:742`, after the `ssoId` lookup and the email lookup at `:662`.
- `ssoType` is a free-form `String` defaulting to `"LTI1.1"`
  (`participant.prisma:30`), so the default no longer describes reality for new rows.
  Changing it needs a migration.
- Historical `ssoType = 'LTI1.1'` rows were deliberately left untouched by PR #5260.
- **New:** `participant.prisma:44` carries `@@unique([participantId, ssoType])`, so a
  participant can hold at most one account per `ssoType`. Whatever replaces the free-form
  string inherits that constraint, and any backfill has to avoid colliding on it.
- **New:** the model already has affiliation support the plan's Data Model section never
  recorded — `type` (`"sso"` / `"affiliation"`), `isPrimary`, and `isVerified` at
  `participant.prisma:34-36`, with indexes at `:46-47`. The reference count this ticket
  asks for has to include the affiliation paths in `apps/auth/src/lib/helpers.ts`, not
  just the LTI ones.

Unblocked: T01 closed, and nothing in its answer changed what this ticket asks.

## Resolution

<!-- filled in on close -->
