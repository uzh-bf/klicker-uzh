# T08 — Assemble the DPO decision package

Label: `wayfinder:task`
Parent: [MAP.md](../MAP.md)
Status: open
Assignee:
Blocked by: T03

## Question

Two rows of the plan's decision table go to the same person and are best answered from
one document rather than two conversations:

- **Privacy policy and re-consent** — "update policy before first notice; re-consent if
  DPO requires it";
- **Retention durations** — "replace placeholder ranges with concrete values before
  rollout", covering assessment identity, challenges, claim contacts, and backups.

Produce the package the DPO rules on. It needs to state, in terms a data-protection
officer can act on without reading the plan: which personal-data categories the migration
adds, changes, and stops retaining; where each is stored and for how long under the
current placeholders; what the proposed concrete durations are and why; and which changes
plausibly require re-consent rather than a policy update.

Depends on [Confirm the target data model holds under Prisma 7](T03-target-model-prisma7.md)
because the data categories can only be enumerated once the target model is confirmed.

**The DPO's ruling is out of scope for this map** — this ticket closes when the package is
ready to send, not when it comes back. Because the ruling has the longest external lead
time of anything here, this ticket is worth pulling forward as soon as T03 closes rather
than leaving to last.

## Resolution

<!-- filled in on close -->
