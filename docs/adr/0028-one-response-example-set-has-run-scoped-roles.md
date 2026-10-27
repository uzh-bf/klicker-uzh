# 28. One response-example set has run-scoped roles

## Status

Accepted

## Context

Lecturers should correct one set of generated response examples. Normal chatbot
use should receive those examples as context, while evaluation should withhold
them and use the same approved answers as references. Maintaining separate
runtime and evaluation sets would add review work before that distinction has
shown value.

## Decision

An approved response example can have two run-scoped roles:

- A normal chatbot run receives the example through its response-behavior
  skill.
- An evaluation run excludes the response-example skill from its input and
  judges the resulting answer against the approved example.

Evaluation reports must identify the examples-excluded configuration. Such a
run evaluates the chatbot without response-example context; it does not prove
the quality or generalization of the normal chatbot configuration that receives
the examples. The model, mode, scaffolding, corpus, graph, retrieval settings,
and registered tools stay unchanged between normal and examples-excluded runs.
The evaluation projection removes the summary and makes the unchanged example
search tool return no example content. Each run captures the current
example-set content and its digest as its immutable input artifact.

## Consequences

- Lecturers maintain one reviewed set of examples.
- The first evaluation answers whether retrieval and the model can reproduce
  the desired response without example context.
- Evaluation remains reproducible without requiring application-level example
  revisions.
- Evaluating the normal chatbot configuration against unseen examples remains
  a separate future capability.
