# Live Quiz Response Counts Design

## Goal

Show lecturers how many answer submissions the response API has received and
how many have been incorporated into live results for every `ElementInstance`
in a started LiveQuiz block in the cockpit.

The counts are reported separately for every element. For example, when ten
participants answer each of three questions, every question displays ten
received and, after successful aggregation, ten processed responses. The
cockpit does not sum these into a block total.

## Non-goals

- Replacing the existing block participant count.
- Aggregating element response counts into a block total.
- Adding participant-level processing details or a response failure list.
- Persisting operational response counts in PostgreSQL.
- Changing response deduplication, scoring, XP, or leaderboard semantics.
- Adding a new subscription or changing the cockpit polling interval.

## Semantics

`numOfResponsesReceived` is the number of response events accepted by the
response API for one element instance. Ingress records the unique message or
correlation claim in a received set and maintains its numeric cardinality
before handing the event to Hatchet. Tracking has a 250 ms deadline and is
best-effort, so an unavailable metric store never rejects an answer. Retrying
the same claim does not increment the count twice, including when a client-side
timeout races a Lua script that completes in Redis.

`numOfResponsesProcessed` is the number of response events whose complete Redis
aggregation batch succeeded. The existing `results.participants` aggregate is
the processed total. A separate numeric counter records the overlap between
claims tracked by new ingress and successfully processed by the new worker.
GraphQL reports the union of the participant aggregate and tracked-but-not-yet-
processed claims. Assessment aggregation uses the same contract.

Preflight and first-command failures release the replay claim and throw for a
safe Hatchet retry. A later failure stores claim-specific reconciliation
metadata, including the applied command count, in a persistent hash. Tracking
failures after successful aggregation use the same state. Every retry checks
that hash before the age-bounded completed-claim guard, so a delayed retry
cannot replay an applied prefix. Reconciliation makes only processed nullable;
the received value remains visible.

The difference between the two values is an operational signal, not a strict
queue-depth metric. It can include work that is still queued as well as invalid,
duplicate, rejected, or failed responses that were accepted at ingress but not
incorporated into results. Best-effort ingress tracking can make received lower
than the corresponding pipeline activity; processed tracking failures remain
visible for reconciliation and can keep processed lower until repaired.

## Architecture

### Tracking

Use the execution Redis instance selected by the live quiz's regular-versus-
assessment mode:

- `lq:<quiz-id>:i:<instance-id>:responses:received` is the bounded-lifetime set
  of ingress claims, and `:received:count` mirrors its cardinality;
- `lq:<quiz-id>:i:<instance-id>:responses:processed:count` counts only
  successfully processed claims that are members of the received set;
- `lq:<quiz-id>:i:<instance-id>:responses:processed:claims` is a sorted-set
  replay guard for successfully completed message or correlation IDs within 24
  hours;
- `lq:<quiz-id>:i:<instance-id>:responses:reconciliation` is a hash of
  unresolved claim metadata. It remains persistent while the instance is
  active and expires with the underlying cache after closure.

The cockpit reports received as
`participants + max(received - processed overlap, 0)` and processed as
`participants`. This is an exact union after the readiness-gated worker-first
rollout; before ingress cutover there are no new received claims to overlap. An
unresolved reconciliation hash makes only processed unavailable (`null`).

Choice payloads must enumerate every configured choice exactly once using
unique in-range integer indices. The processing script accepts only the current
instance plus the quiz's block/quiz leaderboard and XP key families and checks
exact arity and value types before mutation. Selection and case-study payloads
must match the active instance's cached input/identifier shape. Authoring caps
selection inputs at 100, choices at 1,000, and case/item/criterion response
entries at 1,000; the Lua script also rejects more than 2,048 aggregation
commands before mutation. Real-Redis coverage includes a valid 600-command
batch and an oversized batch.

All keys remain under the existing
`lq:<quiz-id>:i:<instance-id>:*` namespace. Active counters have constant key
space, while completed replay claims trim after the bounded horizon.
Reconciliation state persists while active; if its hash cannot be written, the
negative replay fallback is also made persistent. Block closure and quiz
termination start one-day retention on all response keys. Every expiry uses
Redis's `LT` condition, so retryable cleanup can establish or shorten a TTL but
never extend it.

The Helm chart puts both regular and assessment response processors in ArgoCD
sync wave `0` and both response APIs in wave `1`. ArgoCD therefore completes
and health-checks the worker rollout before updating ingress. A response
processor becomes ready only after all active Hatchet runtimes register,
guaranteeing that every claim written by new ingress can update the overlap
counter. GraphQL and Manage may share wave `0`. Old-ingress traffic is a lower
bound until processed; after ingress cutover the union is exact. The
persisted-operation manifest
retains the previous `GetCockpitQuiz` hash while old Manage bundles drain;
GraphQL generation rebuilds that compatibility entry with
`packages/graphql/scripts/merge-persisted-query-compatibility.mjs`. This is
required so an old frontend continues to resolve its persisted operation during
the mixed-version window.

### Cockpit query

Extend GraphQL `ElementInstance` with nullable integer fields:

- `numOfResponsesReceived`
- `numOfResponsesProcessed`

`getCockpitQuiz` reads the new counters, legacy bridge, participant aggregate,
and reconciliation markers for every instance in started blocks and attaches
them to that instance. Instances in
scheduled blocks return `null` for both fields, so the UI can distinguish “not
started” from a started element with zero answers. Instances in active and
executed blocks return explicit integer values, defaulting missing Redis keys to
zero. An unresolved reconciliation marker makes only the processed value
`null`. Malformed or unavailable count reads degrade all cockpit counts to
`null`.

The existing `numOfParticipants` calculation and field remain unchanged because
they answer a different question: how many participants have processed answers
for every element in the block.

The existing cockpit query continues polling every two seconds. No realtime
subscription is added.

### Lecturer UI

The live quiz cockpit block card keeps its block label, status, participant
count, questions, and countdown. For every element in an active or executed
block, the element row adds a compact response status with localized labels:

> Question name — [inbox] 12 → [double-check] 10

The visible pill is icon-led; its accessible label and tooltip use the localized
“Received: 12 · Processed: 10” text. During reconciliation, the valid received
value remains visible and processed renders as an en dash.

Elements in scheduled blocks do not display response status. Each status gets a
stable `data-cy` selector containing the element-instance ID for end-to-end
coverage. English and German messages are added through the existing `next-intl`
catalogs.

The element list uses one shared two-column layout: element names and their
links occupy the flexible left column, while the received and processed values
occupy a right-aligned, content-sized column. This keeps every status aligned
independently of the element-name length. Long names may wrap in the left
column, the status stays on one line, and scheduled elements reserve an empty
right-hand cell so row alignment remains stable without displaying counts.

## Layer Footprint

- `apps/response-api`: record the ingress claim and received count before
  handing the response to asynchronous processing.
- `apps/hatchet-worker-response-processor`: atomically claim replay identifiers
  and increment the received/processed overlap after successful regular or
  assessment aggregation.
- `packages/graphql`: expose element-instance fields, read numeric counters plus
  the participant aggregate and reconciliation state, update the cockpit
  operation, and regenerate checked-in GraphQL artifacts.
- `apps/frontend-manage`: render the response status on cockpit block cards.
- `packages/i18n`: add English and German labels.
- `playwright`: extend the existing live quiz lifecycle coverage.
- `docs`: document the received/processed execution signal and its limitations.

No Prisma schema, seed, fixture, `packages/types`, or Hatchet workflow definition
change is required.

## Authorization and Domain Effects

The data remains available only through `cockpitQuiz`, which already requires an
authenticated lecturer with `EXECUTE` permission on the LiveQuiz. No new auth
scope or permission is introduced.

The counters have no gamification effect. They do not award points or XP and do
not change leaderboard data.

## Error Handling

- Missing tracking keys for an element in a started block are interpreted as
  zero.
- A received-counter Redis failure or the 250ms tracking deadline is logged and
  ingress continues; operational counts can therefore undercount during a
  tracking outage.
- A Hatchet enqueue failure leaves a received claim outside the participant
  aggregate.
- A processing-script preflight or first-command failure is logged as an
  aggregation failure after the replay claim is released; it does not increment
  the processed counter and triggers a worker retry.
- A processing-script failure after an earlier command succeeds stores the
  applied count and errors in the reconciliation hash, returns
  `reconciliation_required`, and keeps the Hatchet task failed without
  repeating already-applied commands on retry or after the normal claim
  horizon.
- A connection-level processing-script failure throws so Hatchet can retry; if
  Redis completed the script, the replay claim makes that retry a no-op.
- Worker retries do not increase results or the overlap counter for the same
  completed tracking identifier within the bounded replay horizon, and
  unresolved identifiers remain blocked by reconciliation state until repair
  or post-closure retention expiry.
- Duplicate standard submissions can legitimately increase received without
  processed because regular-response deduplication currently happens in the
  worker.
- Assessment duplicates rejected before enqueue do not increase received.

## Verification

1. Add focused tests for the element-level query behavior: scheduled element
   fields are `null`, started elements with no submissions report zero, and each
   instance receives only its own counts.
2. Verify regular and assessment processors claim processed markers inside the
   atomic processing script, apply each aggregation command once, accept and
   log per-command errors, and retry connection-level script failures safely.
3. Regenerate GraphQL operations and verify the generated schema, operation
   types, and persisted-operation manifests are committed.
4. Extend the existing Playwright live quiz workflow to assert that the lecturer
   cockpit shows separate received and processed counts for each element after
   student submissions.
5. Run targeted package checks, repository formatting/type/lint checks, and the
   production build.
6. Run the real local stack, validate the cockpit in a browser in English and
   German, and capture desktop screenshots for the draft pull request.

## Delivery

This is one cohesive operational-reporting change and will be delivered as a
normal draft pull request from `feat/live-quiz-response-counts` targeting `v3`.
It does not require a stacked pull request.
