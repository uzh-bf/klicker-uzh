# 33. Approved examples use model-invoked search

## Status

Accepted

## Context

Hybrid delivery needs a way to select full examples without injecting the
entire approved set into every request. Automatic selection on every turn would
add retrieval cost and could inject irrelevant behavior guidance.

## Decision

The bounded mode prompt contains a response-example summary that tells the
model when and how to search. The model invokes an authenticated semantic search
using the current turn, chatbot, mode, and locale. Search returns a capped set
of applicable approved examples, and the selection remains visible in tool
traces. The prompt summary describes categories, topics, and search cues rather
than enumerating the full set. Selection requires an exact mode-and-locale
match. No match returns no full example. A loader failure also continues the
turn with the summary, mode scaffolding, knowledge retrieval, and ordinary
tools while recording degraded selection; it never substitutes another scope
or chatbot.

## Consequences

- Turns that do not need an example incur no example-search request.
- Full-example selection is observable and evaluable.
- Example delivery remains optional behavior guidance rather than a hard chat
  dependency.
