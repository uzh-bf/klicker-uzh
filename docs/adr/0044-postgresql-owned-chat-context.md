# 44. PostgreSQL owns chat context and current image bindings

## Status

Accepted

## Context

The Chat browser previously rebuilt model history and resent persisted image
bytes. That made presentation state part of the authorization boundary and
would give future CodeAPI executions and assets no durable active-branch seam.
The existing message parent links and image attachments already contain enough
state to establish that seam without a schema migration.

## Decision

- Each request carries one user trigger with its parent, text, and at most three
  ordered new-image or persisted-image inputs. A temporary legacy adapter reads
  only the final user item and ignores browser-supplied history.
- One participant-scoped transaction creates or exactly validates the immutable
  user trigger and its current image bindings. Persisted images are copied only
  from completed user messages in the same participant, chatbot, owner, and
  thread scope.
- PostgreSQL follows and validates only the selected parent chain. It checks at
  most 256 rows and projects the closest 64 rows for the model. A longer valid
  branch uses row 256 as an effective root and is reported as truncated.
- Model history contains persisted user and assistant text plus bounded prior
  user-image descriptions. Only current-message raw images are loaded. Generic
  persisted tool payloads remain render-only until a tool-specific projection
  proves safe replay.
- Every assistant claim, retry, failure, and finalization belongs to the exact
  completed user parent in the participant-owned thread. A retry reuses its own
  immutable image bindings and may conditionally fill only a still-missing
  description.

## Consequences

- Browser branch state remains a navigation hint, not model or authorization
  input. Invalid, foreign, cyclic, incomplete, or mutated paths and image
  references fail before provider work.
- Future CodeAPI executions and general assets must bind to this active path and
  define their own bounded, tool-specific model projections. W4 owns execution
  replay; W5 owns the general asset catalog.
- The compatibility adapter needs a dated removal follow-up after deployed
  clients use the canonical trigger request.
