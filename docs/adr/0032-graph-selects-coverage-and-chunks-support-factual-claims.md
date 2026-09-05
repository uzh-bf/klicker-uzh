# 32. The graph selects coverage; chunks support factual claims

## Status

Accepted

## Context

Knowledge-graph nodes and edges are useful for selecting concepts and
relationships, but treating graph assertions as independent evidence would make
generated answers difficult to reproduce and could preserve unsupported claims.

## Decision

Response-example generation uses the knowledge graph to select concepts,
relationships, and coverage. Every factual claim in an ideal reply resolves to
exact chunks from the matching ingested corpus. A factual claim supported only
by a graph node or edge makes the candidate invalid.

## Consequences

- The corpus-to-graph manifest must preserve chunk lineage.
- Lecturer review can trace factual claims to the ingested material.
- Graph structure can expand coverage without becoming a second factual source.
