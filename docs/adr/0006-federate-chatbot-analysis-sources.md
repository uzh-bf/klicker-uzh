# ADR-0006: Federate chatbot analysis sources

## Status

Accepted

## Context

Chatbot learning analytics needs application facts and, later, model-routing and
observability facts. PostgreSQL already records conversations and feedback,
LiteLLM records provider routing and spend, and Langfuse records traces and
observations. Copying every provider call into Klicker would create a third
ledger whose synchronization, correction, access, retention, and withdrawal
behaviour would need to be maintained.

The sources do not necessarily have complete one-to-one coverage. Auxiliary
model calls and missing traces must not be silently attributed to a student
exchange.

## Decision

The learning-analytics capability keeps each fact in its authoritative system
and joins facts for a purpose-bound analysis run.

PostgreSQL is authoritative for conversations, ratings, and analysis
eligibility. LiteLLM is authoritative for actual routed model, spend, and cache
usage. Langfuse is authoritative for traces and observations. Analysis outputs
record source provenance, join coverage, ambiguity, and unmatched records.

Klicker does not persist a duplicate provider-call ledger. Telemetry enrichment
is a later package and cannot become a prerequisite for the initial
database-backed descriptive report.

## Considered options

- Persisting each call in Klicker would simplify individual queries, but would
  duplicate LiteLLM and Langfuse and create another personal-data lifecycle.
- A dedicated analytics warehouse could support larger workloads later, but is
  unnecessary before the source contracts and analysis value are validated.
- Treating Langfuse as the sole source would omit authoritative application
  ratings and would make basic reporting depend on trace completeness.

## Consequences

- Cross-system reports must expose join quality instead of assuming complete
  attribution.
- Source-specific access and retention controls continue to apply.
- A future warehouse or materialized dataset requires a new decision covering
  synchronization, purpose isolation, withdrawal, and deletion.
