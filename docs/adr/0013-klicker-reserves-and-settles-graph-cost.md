---
type: Decision Record
title: Klicker reserves and settles graph cost
description: Enforce semester and per-build monetary limits without storing billing details.
timestamp: '2026-08-10'
tags:
  - backend
  - knowledge-base
---

# 13. Klicker reserves and settles graph cost

Status: Accepted (2026-08-10)

Klicker owns a non-sensitive monetary quota for each lecturer and semester,
stored as a currency plus integer minor units. Before graph dispatch, Klicker
atomically reserves a conservative estimated maximum and rejects work that
would exceed either the remaining semester quota or the per-build maximum.
Catalyst reports actual metered cost against the graph build id; Klicker uses
that id as the settlement key, records the actual amount idempotently, and
releases the unused reservation.

Reservation prevents concurrent builds from overspending a shared quota while
settlement avoids charging every build at its worst-case estimate. The cost
calculation version and provider usage evidence must remain auditable because
model pricing can change. Billing-account details are not part of this ledger;
the beta maintains that sensitive association externally for UZH-issued keys,
while BYOK lecturers are billed by their own provider. Quota controls apply to
both paths.

Graph-derived Klicker-element generation uses the same owner-semester quota.
Each initial question or flashcard provider dispatch and every flashcard retry
has an append-only spend row keyed by its durable dispatch UUID. The beta uses a
versioned fixed price for each dispatch class: reserve before dispatch, validate
deterministic coordinates, claim immediately before the external call, settle
after accepted or exactly recovered provider work, and never redispatch a claimed
attempt. A claim is released only before provider contact or after its recovery
grace expires and an exact provider lookup proves that no matching run exists.
Review and publication events are state transitions on the same generation build
and do not create additional spend.
