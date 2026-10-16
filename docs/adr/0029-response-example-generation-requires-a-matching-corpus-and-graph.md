# 29. Response-example generation requires a matching corpus and graph

## Status

Accepted

## Context

Automatically generated response examples promise to represent a chatbot's
actual ingested knowledge and knowledge graph. Falling back to corpus-only or
model knowledge when either input is unavailable would silently weaken that
promise and could produce unsupported examples.

## Decision

A chatbot is eligible for response-example generation only when it has an
enabled knowledge base and a published knowledge graph whose manifest matches
the active ingested corpus. Missing or mismatched inputs make the chatbot not
eligible, with the unmet prerequisite visible to its owner. Generation has no
fallback to generic model knowledge or a partial source set.

## Consequences

- Every generated candidate has one evidence boundary that can be explained
  and reproduced.
- Chatbots without a matching corpus and graph receive no generated candidates.
- Corpus and graph publication need a shared, verifiable identity contract
  before generation can be implemented.
