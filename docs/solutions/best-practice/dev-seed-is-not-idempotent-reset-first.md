---
module: prisma-data
date: 2026-07-27
problem_type: best_practice
severity: medium
tags:
  - dev-seed
  - prisma
  - devcontainer
  - idempotency
  - eval-harness
---

# The Dev Seed Is Not Idempotent — Reset Before Reseeding

## Context

`pnpm --filter @klicker-uzh/prisma-data run seed:raw` (`seed:test` +
`seed:assessment-course`) is not safe to re-run on a database that already has
base data. Against an already-seeded DB it fails partway with
`P2002 UniqueConstraintViolation` on `modelName: 'Account'`
(`packages/prisma-data/src/data/seedTEST.ts`) — but only _after_ its delete
phase has already run.

The failure is therefore worse than a no-op: each attempt wipes existing rows
and then dies before recreating the later ones, leaving a **half-seeded**
database (elements present, zero courses). Retrying reproduces it exactly, so
the state looks stable rather than broken, and `Element` rows deleted by the
wipe phase do not come back.

This is easy to misread as an application bug. It surfaced as seven confident
failures in the manage-assistant eval harness
(`evaluation/manage-assistant`) that read exactly like model regressions —
including four hard-gate prompt-injection "failures" — when the real cause was
that the seed had left the DB with no courses and no injection-payload
elements.

## Guidance

Do not re-run the seed on top of existing data. Reset first, exactly as
`.devcontainer/post-create.sh` does:

```bash
pnpm --filter @klicker-uzh/prisma exec prisma migrate reset --skip-seed --force \
  && pnpm --filter @klicker-uzh/prisma exec prisma db push
pnpm --filter @klicker-uzh/prisma-data run seed:raw
```

Use `seed:raw`, not `seed`, inside the devcontainer: `seed` goes through
`util/_run_with_infisical.sh`, which needs `jq` and real secrets that the
self-contained devcontainer deliberately does not have.

Two consequences worth remembering:

- **The base seed deletes `Element` rows.** Anything that seeds its own
  elements (the eval harness's E6 injection payloads, ad-hoc fixtures) must be
  seeded _after_ the base seed, never before, or it is silently destroyed while
  its owning `User` row survives — which makes readiness probes that only check
  for the user report a ready environment.
- **Fixture-dependent test suites should assert their fixtures exist**, not
  assume them. A suite that blames the model (or the code) for a missing
  fixture is worse than one that refuses to run. `evaluation/manage-assistant`
  now checks both base courses and its own payload elements before running, for
  exactly this reason.
