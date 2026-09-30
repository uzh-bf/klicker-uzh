# 33. Approved examples use model-invoked search

## Status

Accepted

## Context

Hybrid delivery needs a way to select full examples without injecting the
entire approved set into every request. Automatic selection on every turn would
add retrieval cost and could inject irrelevant behavior guidance.

## Decision

The bounded mode prompt contains a response-example summary that tells the
model when and how to search. The model invokes the authenticated
`search_response_examples` tool using the current question. The first release
uses parameterized PostgreSQL full-text search with the question weighted above
the ideal answer. Results require an exact chatbot-and-mode match, approved
status, and currently eligible evidence. Ties are ordered by rank, update time,
and stable ID. Ranking, current-evidence validation, and result projection use
one database statement so a concurrent edit cannot mix example versions.

Search accepts at most 4,000 characters and returns at most three complete
examples within 24,000 serialized characters. It skips examples that do not fit
instead of truncating them. Example citations use a separate example-source
namespace and are not current-answer citations. Rewriting changes only exact
renderer citation nodes and preserves citation-shaped code, math, and links.
The first release omits the whole skill when a set exceeds 200 examples.

Full search results are model-only. The participant stream and stored chat
message receive an opaque tool-completion status without questions, ideal
answers, or source anchors.

No match returns no full example. A loading or evidence-reconciliation failure
omits both the summary and tool while the ordinary chat turn continues. A later
search failure returns an empty result marked as degraded. Neither failure mode
substitutes another chatbot, mode, or source scope. An examples-excluded run
keeps the same tool schema with an empty implementation that reads no examples.

## Consequences

- Turns that do not need an example incur no example-search request.
- Full-example selection is observable and evaluable.
- Example delivery remains optional behavior guidance rather than a hard chat
  dependency.
- PostgreSQL provides bounded lexical ranking without adding a vector provider
  before retrieval quality demonstrates that one is needed.
