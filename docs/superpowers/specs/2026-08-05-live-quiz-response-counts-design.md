# Live Quiz Response Counts Design

## Goal

Show lecturers how many answer submissions the response API has received and
how many have been incorporated into live results for every started LiveQuiz
`ElementBlock` in the cockpit.

The counts are submission totals across all answerable `ElementInstance`s in a
block. For example, ten participants answering three questions produce thirty
received and, after successful aggregation, thirty processed responses.

## Non-goals

- Replacing the existing block participant count.
- Adding participant-level processing details or a response failure list.
- Persisting operational response counts in PostgreSQL.
- Changing response validation, deduplication, scoring, XP, or leaderboards.
- Adding a new subscription or changing the cockpit polling interval.

## Semantics

`numOfResponsesReceived` is the number of response events accepted by the
response API for the block's instances. The response API records a received
marker before handing the event to Hatchet. This makes enqueue failures visible
as received-but-not-processed work.

`numOfResponsesProcessed` is the number of response events successfully
incorporated into live results. For regular quizzes, this happens after the
response processor's Redis result pipeline succeeds. For assessment quizzes,
it happens after the assessment aggregation task succeeds, not merely after the
response row is stored.

The difference between the two values is an operational signal, not a strict
queue-depth metric. It can include work that is still queued as well as invalid,
duplicate, rejected, or failed responses that were accepted at ingress but not
incorporated into results.

## Architecture

### Tracking

Store retry-safe markers in the quiz's execution Redis instance, using the same
regular-versus-assessment Redis selection as the existing execution data:

- one received-response set per element instance;
- one processed-response set per element instance;
- the regular response `messageId` or assessment `correlationId` as the set
  member.

Redis set cardinality supplies the count. `SADD` makes repeated task execution
idempotent for reporting, unlike integer increments. The new keys remain under
the existing `lq:<quiz-id>:i:<instance-id>:*` namespace, so the current block
closure and quiz cleanup paths apply without a new retention mechanism.

The response API must not enqueue a response when it cannot record the received
marker. A Hatchet enqueue failure leaves the received marker in place, making
the failure observable as an unprocessed response.

### Cockpit query

Extend GraphQL `ElementBlock` with nullable integer fields:

- `numOfResponsesReceived`
- `numOfResponsesProcessed`

`getCockpitQuiz` reads the two set cardinalities for every instance in started
blocks and sums them per block. Scheduled blocks return `null` for both fields,
so the UI can distinguish “not started” from a started block with zero answers.
Active and executed blocks return explicit integer values, defaulting missing
Redis keys to zero.

The existing `numOfParticipants` calculation and field remain unchanged because
they answer a different question: how many participants have processed answers
for every element in the block.

The existing cockpit query continues polling every two seconds. No realtime
subscription is added.

### Lecturer UI

The live quiz cockpit block card keeps its block label, status, participant
count, questions, and countdown. For active and executed blocks it adds a compact
response status line with localized labels:

> Received 12 · Processed 10

Scheduled blocks do not display the response status line. The status line gets
a stable `data-cy` selector for end-to-end coverage. English and German messages
are added through the existing `next-intl` catalogs.

## Layer Footprint

- `apps/response-api`: record received response identifiers.
- `apps/hatchet-worker-response-processor`: record identifiers after successful
  regular or assessment aggregation.
- `packages/graphql`: expose block fields, aggregate Redis cardinalities, update
  the cockpit operation, and regenerate checked-in GraphQL artifacts.
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

- Missing tracking keys on a started block are interpreted as zero.
- A received-marker Redis failure rejects ingress before enqueueing, preventing
  an accepted response from becoming invisible to the metric.
- A Hatchet enqueue failure leaves a received marker without a processed marker.
- A processing or aggregation failure does not add the processed marker.
- Worker retries do not increase either count for the same tracking identifier.
- Duplicate standard submissions can legitimately increase received without
  processed because regular-response deduplication currently happens in the
  worker.
- Assessment duplicates rejected before enqueue do not increase received.

## Verification

1. Add focused tests for the block aggregation behavior: scheduled fields are
   `null`, started empty blocks report zero, and multi-instance counts are summed.
2. Verify regular and assessment processors add processed markers only after
   their final result aggregation succeeds.
3. Regenerate GraphQL operations and verify the generated schema, operation
   types, and persisted-operation manifests are committed.
4. Extend the existing Playwright live quiz workflow to assert that the lecturer
   cockpit shows the received and processed totals after student submissions.
5. Run targeted package checks, repository formatting/type/lint checks, and the
   production build.
6. Run the real local stack, validate the cockpit in a browser in English and
   German, and capture desktop screenshots for the draft pull request.

## Delivery

This is one cohesive operational-reporting change and will be delivered as a
normal draft pull request from `feat/live-quiz-response-counts` targeting `v3`.
It does not require a stacked pull request.
