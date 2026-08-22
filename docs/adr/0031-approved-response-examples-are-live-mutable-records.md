# 31. Approved response examples are live mutable records

## Status

Accepted

## Context

Immutable revisions and separate draft and live states would provide rollback
and audit history, but they would also add lifecycle and interface complexity
before lecturers have used the workflow.

## Decision

The first version stores each approved response example as one mutable record.
Initial approval makes it available to normal chatbot runs. Later owner edits
change the live example immediately. Candidate generation never overwrites an
approved example. Consumers that require reproducibility capture the example
content and a digest in their own immutable run artifact.

## Consequences

- Lecturer corrections take effect without a second publication action.
- The first version has no example rollback or revision history.
- A later revision model will require an explicit migration if operating
  experience demonstrates the need.
