# T03 — Confirm the target data model holds under Prisma 7

Label: `wayfinder:research`
Parent: [MAP.md](../MAP.md)
Status: open
Assignee:
Blocked by: T10

## Question

The plan's **Target Data Model** (line ~174) was designed against the stack as it stood
in June 2026. `v3` now runs Prisma 7. Does the target model still express what it
intends?

Check specifically the constructs the 2026-07-06 review added, since they are the most
schema-sensitive:

- unique recovery-code hashes;
- recovery file public ids;
- lookup-hash key ids;
- separate keyrings for assessment lookup hashes and external identities;
- the `ParticipantExternalIdentity` model the plan introduces;
- the existing `@@unique([email, isSSOAccount])` trap and how the target model resolves it.

For each, confirm it is expressible in Prisma 7 as written, and flag anything where
Prisma 7 changed defaults, uniqueness handling, or client generation in a way the plan
did not anticipate. Note also whether `prisma:sync` into `apps/analytics` still behaves
as the plan's migration steps assume.

This is a feasibility check, not a redesign. If something does not work, record what
breaks and the options — do not pick one; that becomes its own ticket.

Blocked on [Fold the verifiable-credential email surface into the plan](T10-verifiable-credential-emails.md)
rather than on T01, which closed: confirming the target model is worth doing once, and
the credential surface may add to what it has to express.

Concrete inputs from [the claim re-verification](T01-reverify-codebase-claims.md):

- Prisma 7 moved connection config out of the schema — `datasource.prisma` no longer
  declares `url` or `shadowDatabaseUrl`, so the plan's migration steps cannot assume a
  shadow database is configured where they left it.
- The Pothos generator's `clientOutput` is now `./client.js` rather than a package
  specifier, which matters if the target model adds Pothos-exposed types.
- `prisma:sync` demonstrably still runs and still mirrors new models into
  `apps/analytics` — `VerifiableCredential` arrived there complete with its raw
  `subjectEmail`. Treat that as the worked example when checking the plan's assumption.

## Resolution

<!-- filled in on close -->
