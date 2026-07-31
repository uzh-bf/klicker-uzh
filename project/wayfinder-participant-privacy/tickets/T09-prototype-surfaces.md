# T09 — Identify which surfaces need a prototype

Label: `wayfinder:grilling`
Parent: [MAP.md](../MAP.md)
Status: open
Assignee:
Blocked by: —

## Question

Part of this map's destination is knowing **where prototyping is needed** — which
participant-facing surfaces cannot be settled by discussion and need something concrete
to react to before implementation commits.

Fan across the participant-facing surfaces the plan touches and decide, for each,
whether it is already clear enough to implement or needs a prototype first. Starting
candidates from the plan's Target Flows and its review notes:

- recovery setup when it lands during a running live quiz — the plan says defer, but
  what the participant actually sees is unspecified;
- the shared-device passkey warning;
- the create-account flow once random username prefill is removed;
- account linking and merge, where a participant arrives by a second route;
- the migration notice participants get at cutover.

Output: a short list naming each surface that needs a prototype and the one question
that prototype has to answer. Each becomes its own prototype ticket, graduating from the
map's fog.

Surfaces judged clear enough to implement should be recorded as such with a reason —
that record is what makes the plan implementation-ready rather than merely unblocked.

## Resolution

<!-- filled in on close -->
