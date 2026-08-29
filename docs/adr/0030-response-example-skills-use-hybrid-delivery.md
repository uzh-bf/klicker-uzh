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
contains a deterministic summary capped at 1,500 characters. It reports only
the number of currently applicable examples, their response approaches, and
instructions for using them. It never embeds full questions, ideal answers, or
source content.

Full examples remain behind an authenticated server tool and are loaded only
when the model decides that an example would help answer the current question.
PostgreSQL remains authoritative for the example set and its exact approved
content; the prompt summary and tool results are bounded projections.

## Consequences

- The chatbot receives stable guidance without carrying every full example in
  every request.
- The final prompt and tool schema participate in prompt-cache identity, so a
  changed summary or tool contract cannot reuse an incompatible cached prefix.
- Runtime behavior depends on both prompt compilation and dynamic example
  selection. The chat runtime records the authoritative set digest and the
  role-specific projection digest as telemetry context so later evaluations can
  identify the exact skill state without logging example content.
- The selection mechanism and fallback behavior require explicit contracts.
