# 38. Live-quiz response-count migration and reconciliation

- **Status:** Accepted — 2026-08-25
- **Context:** [ADR 0003](./0003-promote-stg-via-release-annotation-write-back.md)

## Context

The lecturer cockpit needs per-element received and processed response counts
without changing answer admission or result aggregation. The rollout overlaps
old and new response APIs and workers, and result aggregation contains
non-idempotent Redis increments that cannot safely be replayed after a partial
write.

## Decision

Use the existing per-instance `results.participants` value as the processed
total. New ingress also records each accepted `messageId` or assessment
`correlationId` in the received set and maintains a numeric received counter.
The new worker increments a processed-overlap counter only when that same claim
was recorded by new ingress. The cockpit reports the set union:

`participants + max(tracked received - tracked processed overlap, 0)`

This distinguishes old processed traffic from new traffic that is still queued
or rejected. During the compatibility window, GraphQL adds the numeric overlap
to the actual intersection of the received-claim and legacy-processed sets;
cardinalities alone are not treated as proof that two cohorts overlap. The Helm
chart assigns both response-processing workers to ArgoCD
sync wave `0` and both response APIs to wave `1`. ArgoCD waits for the regular
and assessment workers to be healthy before updating ingress. Each response
processor becomes ready only after all active Hatchet runtimes register, so a
running process cannot prematurely satisfy the gate. GraphQL and Manage may
deploy in wave `0` because their fields are additive and nullable. Before
ingress cutover, traffic accepted by an old response API is a lower bound until
it is processed; after the enforced worker-first gate and ingress cutover, the
union converges exactly.

The received Lua script writes the claim set and counter atomically. Repeating
the same claim does not increment twice. A timeout can therefore complete in
Redis and still be retried safely. Tracking remains best effort and never
rejects a participant response.

The processing script validates the complete command batch before mutation and
restricts targets to the current instance and current quiz leaderboard/XP key
families. Choice payloads must enumerate every configured choice exactly once
with unique in-range integer indices. Selection and case-study payloads must
match cached instance identifiers and sizes. Domain validation caps authored
selection inputs at 100, choices at 1,000, and case/item/criterion response
entries at 1,000; the script independently rejects batches above 2,048 commands
before mutation. A real-Redis regression covers a valid 600-command batch and
an oversized batch.

A failure before any aggregation command succeeds releases the replay claim so
Hatchet can retry. A failure after a non-idempotent command succeeds writes a
claim-specific entry to the reconciliation hash containing the applied command
count and error details. Successful aggregation followed by tracking failure
uses the same state. The worker keeps the task failed, and every retry checks
the reconciliation hash before the age-bounded replay claim, so the partial
batch cannot replay after the normal 24-hour claim horizon. Reconciliation
entries remain persistent while the instance is active and expire only with
the underlying instance data after block/quiz retention starts, unless an
operator repairs them earlier. The cockpit preserves the received count and
reports only processed as `null` while any reconciliation entry remains.

If the reconciliation hash cannot be written, the script falls back to a
negative replay marker and removes that sorted set's TTL while the instance is
active. Cleanup later establishes the normal post-closure retention. This keeps
the fallback replay barrier beyond the completed-claim horizon without making
participant metadata permanent after quiz closure.

Completed replay claims retain a 24-hour horizon. Block and quiz cleanup apply
Redis `EXPIRE ... LT` to instance, counter, claim, compatibility, and
reconciliation keys, so retries can establish or shorten retention but never
extend it. The end-live-quiz retry path does not repeat end side effects.

The persisted-operation manifest retains the previous `GetCockpitQuiz` hash
while older Manage bundles drain. The compatibility entry is rebuilt after
GraphQL generation by
`packages/graphql/scripts/merge-persisted-query-compatibility.mjs` and is
removed only in a deliberate follow-up.

## Consequences

Counts remain meaningful during the ordered rollout and exact after ingress
cutover. Duplicate ingress attempts and completed worker retries do not inflate
counts. Partial aggregation is operationally visible without risking replay.
The rollout has an explicit worker-before-ingress gate, and unresolved
reconciliation data shares the same post-closure retention boundary as the
underlying live-quiz cache.
