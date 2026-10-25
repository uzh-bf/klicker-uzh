# 36. Candidate generation uses the platform base model

## Status

Accepted

## Context

Candidate generation needs a predictable first implementation. Reusing each
chatbot's runtime model or lecturer-provided credential would add model
qualification and background-delegation paths before the workflow has proved
useful.

## Decision

The first release uses one version-pinned, platform-managed generation base
model for every eligible chatbot. The generation job records that model and
fails when it is unavailable. Candidate generation does not use the chatbot's
runtime model or any lecturer-provided credential.

## Consequences

- The platform owns candidate-generation cost and provider configuration.
- BYOK chatbots need no model-compatibility check or background credential
  delegation for candidate generation.
- Generated style may differ from a chatbot's runtime model, so lecturer review
  remains the acceptance boundary.
