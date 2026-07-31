# T03 — Confirm the target data model holds under Prisma 7

Label: `wayfinder:research`
Parent: [MAP.md](../MAP.md)
Status: open
Assignee:
Blocked by: T01

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

## Resolution

<!-- filled in on close -->
