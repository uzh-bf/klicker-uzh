# Transfer one activity

## Goal and scope

`packages/graphql/src/scripts/transferActivityContents.ts` transfers one
LiveQuiz, PracticeQuiz,
MicroLearning, or GroupActivity between Users, including its ElementInstances,
source Elements, and Tags. Live quizzes use ElementBlocks; the other activities
use ElementStacks. Course assignment stays unchanged, including null for a
standalone live quiz. No course ownership or participant history is migrated.

This is an operator script only: no schema, API, UI, i18n, seed, worker, or
points/XP changes. No answer-collection or media ownership transfer. Existing
direct sharing grants remain; derived permissions and access requests are
recomputed for the activity and its dependencies after all ownership writes.
Keeping the activity in the source account's course can preserve that account's
inherited access. Shared elements and tags transfer globally.

## Safety and verification

Validate type, IDs, expected ownership, destination account, and tag-name
collisions. Default dry run produces a metadata-only before snapshot bound to
the request and database. Write mode requires that exact unchanged snapshot.
All writes and post-write assertions run in one serializable transaction.
Completed-run receipts block reuse; no participant response values are logged
or written to receipts. A commit followed by a failed receipt write requires
manual database inspection; do not retry the write.

No runtime is started and no production transfer is executed. Biome and focused
TypeScript checks plus independent review cover the code change. The checkout
has an existing generated Prisma type mismatch, also reproducible on the
original activity-course script. Database-backed validation is outstanding.

## Usage (config-derived, not executed against production)

From `packages/graphql`, configure the host shell:

```bash
# LIVE_QUIZ | PRACTICE_QUIZ | MICRO_LEARNING | GROUP_ACTIVITY
export ACTIVITY_TYPE='PRACTICE_QUIZ'
export ACTIVITY_ID='ACTIVITY_UUID'
export OLD_USER_ID='CURRENT_OWNER_UUID'
export NEW_USER_ID='NEW_OWNER_UUID'

DRY_RUN=true \
  pnpm run script:prod src/scripts/transferActivityContents.ts

# After reviewing the before snapshot:
DRY_RUN=false \
  pnpm run script:prod src/scripts/transferActivityContents.ts
```

Course-ID variables are not used. Snapshots live under the gitignored
`.transfer-activity/` directory when run from `packages/graphql`.
`TRANSFER_RECEIPT_DIR` can instead point outside the repository. Keep the
before/after files private. A stale snapshot is never overwritten: review any
changes before choosing a new receipt directory and repeating the preview.
Existing receipts from other transfer scripts do not substitute for this script's dry run.

## Progress

- Added a single-activity ownership transfer that preserves course assignment.
- Added explicit read/update/permission routing for all four activity types.
- Preserved dry run, transactional verification, audit entries, and receipt handling.
- Independent review identified pending requests being discarded when the old
  owner was the only administrator. Copy requests to the new owner before
  permission recomputation removes obsolete administrator assignments.
- Biome and whitespace checks pass. Focused TypeScript checking reports only
  the previously identified generated Prisma type mismatch. No database
  execution performed.
