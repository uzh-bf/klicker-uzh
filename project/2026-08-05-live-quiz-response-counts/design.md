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
response API for one element instance and successfully recorded by the tracking
write. The response API attempts to record a received marker before handing the
event to Hatchet. Tracking is best-effort so an unavailable metric store never
rejects a participant response; such a failure can temporarily undercount
received responses. A later Hatchet enqueue failure normally remains visible as
received-but-not-processed work.

`numOfResponsesProcessed` is the number of response events successfully
incorporated into live results. For regular quizzes, this happens after the
response processor's atomic Redis processing script claims the marker and
applies the result commands. For assessment quizzes, it happens after the
assessment aggregation task succeeds, not merely after the response row is
stored.

The difference between the two values is an operational signal, not a strict
queue-depth metric. It can include work that is still queued as well as invalid,
duplicate, rejected, or failed responses that were accepted at ingress but not
incorporated into results. Best-effort tracking failures can also make either
value lower than the corresponding pipeline activity.

## Architecture

### Tracking

Store retry-safe markers in the quiz's execution Redis instance, using the same
regular-versus-assessment Redis selection as the existing execution data:

- one received-response set per element instance;
- one processed-response set per element instance;
- the regular response `messageId` or assessment `correlationId` as the set
  member.

Redis set cardinality supplies the count. The response processor builds the
aggregation commands without sending them, then one Redis script claims the
processed member before applying those commands with `redis.pcall`. This keeps
concurrent or retried execution from applying non-idempotent scoring, results,
or leaderboard updates twice, including when a successful Redis reply is lost.
The new keys remain under the existing `lq:<quiz-id>:i:<instance-id>:*`
namespace. They stay persistent while the instance is active. Block closure
starts one-day retention on the canonical instance-info key before scanning the
instance namespace; each tracking write atomically reads that TTL, adds its
member, and mirrors remaining retention. A missing info key applies the same
one-day safety retention.

Received-marker failures remain best effort at ingress. Processing-script
command errors are logged and accepted after the processed marker is claimed;
connection-level script failures throw so Hatchet can retry safely, while
tracking-retention errors are logged without replaying applied aggregation.

### Cockpit query

Extend GraphQL `ElementInstance` with nullable integer fields:

- `numOfResponsesReceived`
- `numOfResponsesProcessed`

`getCockpitQuiz` reads the two set cardinalities for every instance in started
blocks and attaches them to that instance. Instances in scheduled blocks return
`null` for both fields, so the UI can distinguish “not started” from a started
element with zero answers. Instances in active and executed blocks return
explicit integer values, defaulting missing Redis keys to zero.

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
- A received-marker Redis failure is logged and ingress continues; operational
  counts can therefore undercount during a tracking outage.
- A Hatchet enqueue failure leaves a received marker without a processed marker.
- A processing-script command error is logged after the processed marker is
  claimed and does not trigger a retry that could replay partial aggregation.
- A connection-level processing-script failure throws so Hatchet can retry; if
  Redis completed the script, the marker makes that retry a no-op.
- Worker retries do not increase either count for the same tracking identifier.
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
