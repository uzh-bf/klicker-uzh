# 34. Evidence eligibility gates live response examples

## Status

Accepted

## Context

An approved response example can remain pedagogically useful across graph
rebuilds, but it must not stay active after its factual support becomes invalid
or inaccessible.

## Decision

An approved example remains live while its referenced chunks keep the expected
hashes and remain authorized and verifiable. A removed, changed, unauthorized,
or unverifiable chunk excludes the example from prompt and dynamic delivery and
marks the same mutable record `Needs review`. A graph rebuild with unchanged
supporting chunks leaves the example live. Generation may propose a replacement
but never overwrites lecturer content.

## Consequences

- Evidence changes fail closed without introducing example revisions.
- Graph maintenance alone does not interrupt valid examples.
- Runtime selection must enforce evidence eligibility.
