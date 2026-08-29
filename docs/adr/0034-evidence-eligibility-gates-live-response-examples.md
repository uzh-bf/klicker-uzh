# 34. Evidence eligibility gates live response examples

## Status

Accepted

## Context

An approved response example can remain pedagogically useful across graph
rebuilds, but it must not stay active after its factual support becomes invalid
or inaccessible.

## Decision

An approved example remains live only when the chatbot has exactly one enabled,
non-deleted knowledge base and every evidence reference resolves to a live
resource in that knowledge base. The resource ID and active content hash must
match the captured lineage, and the ideal answer must contain exactly the
renderer-visible citation indexes represented by its evidence references.

Stored `evidenceEligible` values are hints, not authority. Owner reads and
runtime loading recalculate eligibility from current resources. A removed,
changed, foreign, unauthorized, or unverifiable resource excludes the example
and moves the same mutable record to `Needs review`. Reconciliation locks the
chatbot before the response-example set, clears reviewer fields, and refreshes
the complete set digest once. A valid unchanged read performs no writes.

A graph rebuild with unchanged supporting resources leaves the example live.
Generation may propose a replacement but never overwrites lecturer content.

## Consequences

- Evidence changes fail closed without introducing example revisions.
- Graph maintenance alone does not interrupt valid examples.
- Zero or multiple enabled knowledge-base bindings fail closed.
- Runtime selection rechecks current evidence and projects the selected content
  from the same database-statement snapshot before returning an example.
