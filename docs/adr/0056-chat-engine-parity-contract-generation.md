# 56. Full participant parity uses an explicit chat-engine contract generation

Status: Accepted; implementation and conformance qualification pending

## Context

[ADR 0005](./0005-versioned-chat-engine-boundary.md) establishes the public host
and versioned engine boundary. Its initial Python-only pilot and later-consumer
restriction cannot carry the participant workflows required for the `v3-ai`
integration. The current participant path supports ordinary image attachments
and a separate allowance of current document-page images. It also supplies
model-only tool projections while streaming and saving the original results,
as established by [ADR 0004](./0004-chat-citations-from-tool-call-parts.md).

The `v1` contract has one global three-image allowance and no separate tool
projection semantics. Widening those meanings in place would make existing
conformance claims ambiguous. Sending descriptions or collages instead of
current document pixels would drop supported behavior.

## Decision

Introduce explicit ordinal generation `v2` in the existing public contract
package. Distinguish the total allowance of three ordinary image originals from
up to ten current-turn document pages. Preserve the supported original page
pixels for the current reply, their transient lifetime, and existing saved
textual summaries. Apply the approved bounded reply context without deleting
the saved conversation or trimming system instructions.

Carry model-only tool projections separately from original tool output. Engines
use the projection for model input; original output retains its browser and
persistence meaning. A model-only projection must not leak into streamed or
persisted results merely because the host and engine cross HTTP.

Both the public default engine and Catalyst retain strict `v1` service during
the transition and independently pass canonical `v2` conformance before the
host selects `v2`. The host explicitly selects a single configured generation;
there is no automatic negotiation, downgrade, backend retry or failover.

The public host continues to own identity, scope, model policy, attachment
preparation, trusted learning context, tool discovery and capabilities,
conversation persistence and accounting. Engines receive only approved tools
and scoped execution capabilities for a deployment-owned dispatcher. Required
scope or credential failures remain closed. The Python capability remains
independently default-off and cannot replace ordinary course tools.

This decision supersedes ADR 0005's later-consumer and Python-only rollout
restriction and extends its generation contract. Its remaining ownership,
credential, tracing and deployment-selection decisions continue to apply.
Direct participant routing remains default-off; source qualification does not
authorize hosted activation or deployment.

## Consequences

An explicit generation costs coordinated public/default/Catalyst compatibility
work and separate conformance evidence. It keeps historical `v1` consumers
predictable while making full participant workflows testable behind the same
boundary. Dropping an existing workflow, changing ownership or silently
substituting a lower-fidelity attachment path reopens the decision. Routine
field names and implementation details belong to the public schema and its
behavioral conformance tests.
