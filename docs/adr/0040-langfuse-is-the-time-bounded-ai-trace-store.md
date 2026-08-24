# 40. Langfuse is the comprehensive, time-bounded AI observability trace store

- **Status:** Proposed — 2026-08-23

## Context

Operational debugging, Auto analysis, tool-call diagnosis, usage attribution,
and quality improvement require one joined record of an AI request. Splitting
content traces across application logs and provider-specific systems would make
that record incomplete. Full prompts, responses, retrieval results, and tool
calls are also personal and potentially sensitive data; indefinite retention or
routine research access would be disproportionate.

The current chat integration cannot serve as evidence for this decision because
the repository documents an OpenTelemetry major-version mismatch that prevents
chat spans from reaching Langfuse.

## Decision

Langfuse is the only comprehensive AI observability trace store. Product chat
history remains separate product state. A joined trace includes
prompts, responses, retrieval and tool activity, token consumption, selected
model, provider profile, cost estimate, stable product resource identifiers,
and terminal outcome. Credentials, authorization headers, gateway capability
tokens, vault handles, and unnecessary direct identifiers are removed before
export.

Raw traces have an automatic 180-day retention schedule. A chatbot, binding, or
user deletion immediately tombstones the affected identifiers so the data
cannot be used for support, quality improvement, or research. Asynchronous jobs
then request Langfuse deletion and verify completion within seven days. Manual
purging is a repair path, not the normal retention mechanism.

A small named and audited platform-operations role may access raw traces for
support and proactive quality improvement. Researchers do not receive routine
Langfuse access. Approved UZH research receives a purpose-specific minimized,
de-identified where possible, or protected pseudonymous export with its own
purpose, access, retention, and deletion contract. External institutional
tenants are quality-improvement-only unless a separate institutional decision
changes that policy. Trace or export data is never used to train a model.

Before BYOK content tracing is enabled, the responsible institutional owners
must document the legal basis, purposes, processor terms, access ownership,
retention, research-export boundary, and deletion verification. Provider Notice
acknowledgement does not satisfy this gate.

## Consequences

- BYOK cannot launch until end-to-end trace export, secret redaction, cost
  attribution, retention, access control, and deletion verification are proven.
- Product deletion needs durable trace indexes and deletion jobs; a hidden
  retention window in Langfuse is not proof that records were deleted.
- Full tracing is intentionally more privacy-invasive than metadata-only
  logging, so access reviews, purpose controls, and automatic deletion are
  first-version requirements.
- Research exports remain separate governed datasets and do not inherit the raw
  trace store's access model.

## References

- [Langfuse data masking](https://langfuse.com/docs/observability/features/masking)
- [Langfuse data retention](https://langfuse.com/docs/data-platform/features/data-retention)
