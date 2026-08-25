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
- Changing response validation, deduplication, scoring, XP, or leaderboards.
- Adding a new subscription or changing the cockpit polling interval.

## Semantics

`numOfResponsesReceived` is the number of response events accepted by the
response API for one element instance and successfully recorded by the numeric
received counter. The response API increments that counter before handing the
event to Hatchet. Tracking is best-effort so an unavailable metric store never
rejects a participant response; such a failure can temporarily undercount
received responses. During the key-shape transition, the cockpit also includes
the legacy received-set cardinality, so old and new ingress instances remain
visible without writing new unbounded sets. Assessment admission continues to
use its existing participant and database uniqueness boundary, while this
metric counts accepted transport events before that downstream boundary.

`numOfResponsesProcessed` is the number of response events whose complete Redis
aggregation command batch succeeded. For regular quizzes, the atomic processing
script claims a bounded replay identifier, applies the result commands, and
increments the numeric processed counter only when no command reports an error.
Assessment aggregation uses the same contract. A partial command failure
releases the replay claim and does not increment the processed counter, so the
worker can throw and Hatchet can retry. Commands that already applied can still
be repeated by that retry and require reconciliation. Tracking-command failures
are logged separately as best-effort metric errors.

The difference between the two values is an operational signal, not a strict
queue-depth metric. It can include work that is still queued as well as invalid,
duplicate, rejected, or failed responses that were accepted at ingress but not
incorporated into results. Best-effort tracking failures can also make either
value lower than the corresponding pipeline activity.

## Architecture

### Tracking

Use the execution Redis instance selected by the live quiz's regular-versus-
assessment mode. New writes use numeric counters and an age-trimmed replay
claim:

- `lq:<quiz-id>:i:<instance-id>:responses:received:count` is a numeric counter
  incremented once for each accepted ingress event;
- `lq:<quiz-id>:i:<instance-id>:responses:processed:count` is a numeric counter
  incremented only after a complete aggregation command batch succeeds;
- `lq:<quiz-id>:i:<instance-id>:responses:processed:claims` is a sorted-set
  replay claim for message IDs or correlation IDs. Scores are claim timestamps,
  and members older than the 24-hour replay horizon are trimmed before each
  claim. The key uses the shorter remaining instance-info TTL after closure;
- `lq:<quiz-id>:i:<instance-id>:responses:processed` remains the legacy replay
  set during the worker rollout and is read only for compatibility and the
  initial processed-counter baseline.

The received and processing scripts update their counters and retention in
Redis Lua. Processing initializes a missing processed counter from the legacy
processed-set cardinality once, checks both the age-trimmed claims and the
legacy set, and records each new claim with its own timestamp. Partial command
errors return an explicit failed aggregation outcome, release the claim, and
leave the processed counter unchanged. The worker throws so Hatchet can retry
instead of acknowledging a response that may have been only partially applied.
Because commands before the failure may already have run, the retry path can
repeat non-idempotent updates and remains a reconciliation signal rather than
an exactly-once guarantee for partial batches. Connection-level script failures
still throw so Hatchet can retry.

The legacy received set
`lq:<quiz-id>:i:<instance-id>:responses:received` is read-only compatibility
input while old response-api instances drain. The cockpit adds its cardinality
to the new received counter. New code never appends to that set. For processed
responses, the new counter takes precedence once initialized; otherwise the
legacy processed-set cardinality is used as the opaque pre-cutover baseline.

All keys remain under the existing
`lq:<quiz-id>:i:<instance-id>:*` namespace. Active counters have constant key
space, while sorted-set replay claims trim members after the bounded horizon and
expire with the latest claim. Block closure and quiz termination start one-day
retention on instance-info keys before expiring the response keys, so late
scripts cannot recreate persistent tracking keys.

The rollout must deploy GraphQL before new ingress, drain old response
processor replicas before initializing processed counters, and then run only
the new processors. This is required because an old processor can claim and
aggregate without incrementing the new processed counter.

### Cockpit query

Extend GraphQL `ElementInstance` with nullable integer fields:

- `numOfResponsesReceived`
- `numOfResponsesProcessed`

`getCockpitQuiz` reads the new counters plus the legacy bridge for every
instance in started blocks and attaches them to that instance. Instances in
scheduled blocks return `null` for both fields, so the UI can distinguish “not
started” from a started element with zero answers. Instances in active and
executed blocks return explicit integer values, defaulting missing Redis keys to
zero. Malformed or unavailable count reads degrade the cockpit counts to
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

> Question name — Received 12 · Processed 10

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

- `apps/response-api`: record received response identifiers.
- `apps/hatchet-worker-response-processor`: record identifiers after successful
  regular or assessment aggregation.
- `packages/graphql`: expose element-instance fields, attach Redis cardinalities,
  update the cockpit operation, and regenerate checked-in GraphQL artifacts.
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
- A received-counter Redis failure is logged and ingress continues; operational
  counts can therefore undercount during a tracking outage.
- A Hatchet enqueue failure leaves a received marker without a processed marker.
- A processing-script command error is logged as an aggregation failure after
  the replay claim is released; it does not increment the processed counter and
  triggers a worker retry that can replay partial aggregation.
- A connection-level processing-script failure throws so Hatchet can retry; if
  Redis completed the script, the replay claim makes that retry a no-op.
- Worker retries do not increase the processed counter for the same tracking
  identifier within the bounded replay horizon.
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
