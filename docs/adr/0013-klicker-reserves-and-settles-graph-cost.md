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

Failed graph builds release their reservation and consume no lecturer quota,
even when the provider reports partial usage. The build's `actualCostMinorUnits`
is the user quota charge; its `meteredCost` and token counters retain provider
usage for diagnostics. A late provider success rejected as stale is a failed
build under the same rule. This policy does not automatically refund historical
settlements or resolve holds with ambiguous provider evidence.

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

Question builds may additionally use an optional server-owned native provider
budget. `KB_QUESTION_NATIVE_BUDGET_POLICY` supplies the existing worker policy:
version 1, a positive decimal-string USD limit, per-token prompt/completion
price ceilings keyed by model route, and an output-token ceiling. No default
USD amount or tariff is supplied. Decimal spelling is bounded to 256 characters
and an exponent magnitude of 1000; amounts are normalized without binary floats.
Invalid configured policy rejects new admission before product credits or
provider contact. Flashcards and historical builds retain their existing path.

Each new question build records an explicit budget mode in its existing
configuration JSON. A budgeted build freezes its normalized policy and native
output destination for its lifetime, including idempotent recovery and explicit
retry. Missing or corrupt budgeted metadata and destination drift reject further
dispatch or evidence acceptance. Metadata-absent historical builds retain their
original manifest normalization; new builds use the current worker defaults.
The client cannot choose this policy. Changing or removing the server template
does not rewrite existing builds. Settled builds remain readable after output
configuration changes; an explicit retry still checks the bound destination
before reserving another product spend.

Deployment must pair this application with a worker whose normalized manifest
includes `question_library_snapshot: null`, even for new unbudgeted builds.
Control new admission across the paired rollout and rollback, and finish
historical in-flight builds with their original manifest interpretation before
changing workers. Omitting the budget setting keeps new builds unbudgeted;
an empty configured value is invalid.

The chart's optional `backendGraphql.elementGeneration.nativeBudgetPolicy`
value delivers this JSON to the GraphQL backend. Null omits the environment
setting. Every other value is emitted, including empty maps, so malformed
configuration fails request admission rather than silently disabling the
budget. It does not prevent process startup or affect accepted builds using
their frozen policy. Flashcards share the admission hold, not this dollar policy.
The slot-specification switch is also frozen before a new question build's
first reservation; retries and evidence reconstruction reuse its stored value.
Historical null values omit that optional field.

New question and flashcard builds and explicit retries additionally require the
per-actor `question-generation-admission` feature decision. Its default is false; absent,
stale or erroring evaluation denies new work before credit reservation or
provider dispatch. A release that should keep admission open must configure
that flag for the intended actors before deploying this code. Existing builds,
including an idempotent start returning a prior build, retain their polling,
review, save and settlement paths. The existing `question-generation` and AI
access gates remain required for those operations. The admission hold includes
flashcards because they share the question worker.
Do not close the shared access gate to drain accepted work.

Flag decisions use the existing authenticated actor attributes and refresh
asynchronously. Closing admission is not an atomic cutoff: previously admitted
requests can still reserve or dispatch. Before changing workers, verify the
closed decision across serving instances and account for requests accepted on
the previous payload. Finish all nonterminal question and flashcard stages,
including waiting review and publication, and reconcile reserved or uncertain product/native
exposure. A quiet queue, elapsed refresh interval or a flag write alone is not
proof of drain. If these facts cannot be established, hold the rollout. Retain
the existing worker for accepted builds until their manifest interpretation no
longer needs it; do not restore an older worker against incompatible new-format
builds during rollback. Live flag changes and rollout remain operator decisions.

Product credits remain separate from provider-dollar exposure. The worker's
existing durable ledger retains settled, pending and unknown usage for the
same build and output location; an application retry cannot create a fresh
budget or ledger. Admission relies on the declared price/reservation assumptions,
not an upstream wallet or final-invoice guarantee. Enabling a policy, qualifying
actual routes/prices and running paid generation remain operational decisions.

A revision request for one generated question runs as a one-slot child build and
spends one `ELEMENT_REVISION` dispatch. Its price is the question price divided
by the requested count of the parent build, rounded up (`ceil(build price /
requested count)`), so revising a slot never costs more than generating it.

Native budget accounting for individual revision children is not yet qualified.
A child currently inherits its parent's budgeted configuration marker, but its
revision payload does not carry `budget_policy`. That marker is therefore not
evidence of a capped revision run. Keep `ELEMENT_REVISION_WORKER_ENABLED`
disabled wherever budgeted parent builds can be revised, including after the
server budget setting is removed: existing parents retain their frozen policy.
Do not strip the inherited marker or reopen legacy retries to work around this
limitation. Enabling budgeted revisions requires a separately qualified child
accounting contract and worker evidence for manifests combining `budget_policy`
with `emit_slot_specifications`. This is an operational release hold, not an
additional runtime guard; the original-build and retry guarantees above do not
establish revision-child accounting.
