# 30. Response-example skills use hybrid delivery

## Status

Accepted

## Context

Compiling every approved response example into every request would consume the
prompt budget as the reviewed set grows. Loading every example dynamically
would remove the always-visible guidance that tells the chatbot when and how to
use the set.

## Decision

The response-behavior skill uses hybrid delivery. The compiled mode prompt
contains a bounded summary of the applicable approved examples. Full
examples remain in an authenticated dynamic resource and are loaded only when
needed. PostgreSQL remains authoritative for the example set and its exact
approved content; prompt and dynamic-resource representations are projections.

## Consequences

- The chatbot receives stable guidance without carrying every full example in
  every request.
- Runtime behavior depends on both prompt compilation and dynamic example
  selection, so evaluations must record their content digests.
- The selection mechanism and fallback behavior require explicit contracts.
