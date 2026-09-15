# 35. Klicker retains response-example lineage, not source copies

## Status

Accepted

## Context

Copying source excerpts or pinning complete corpus and graph snapshots would
make historical reconstruction easier, but would turn Klicker into another
course-content store with separate authorization, deletion, and freshness
obligations.

## Decision

Klicker stores source and chunk identifiers, expected hashes, and citation
anchors for response examples. Review resolves the current authorized chunks.
Historical source bodies are not copied into Klicker. Source-bearing generation
scratch exists only while its job is active and is deleted when the job
finishes. Missing or changed evidence follows ADR 0034 and moves the example to
`Needs review`.

## Consequences

- Source authorization and deletion remain with the knowledge system.
- Historical source reconstruction is unavailable after evidence changes.
- Failed jobs cannot be reconstructed from retained source-bearing scratch.
