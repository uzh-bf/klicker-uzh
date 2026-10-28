import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { prisma } from '@klicker-uzh/prisma'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'

// Set these environment variables in the host shell before invoking script:prod.
// Course assignment is preserved, including null for standalone live quizzes.
// Shared elements and tags change owner globally. Other instances do not move.
// Existing direct sharing grants remain; answer collections/media keep ownership.
const activityTypes = [
  'LIVE_QUIZ',
  'PRACTICE_QUIZ',
  'MICRO_LEARNING',
  'GROUP_ACTIVITY',
] as const
type ActivityType = (typeof activityTypes)[number]
function activityType(): ActivityType {
  const value = process.env.ACTIVITY_TYPE
  assert(
    activityTypes.some((type) => type === value),
    'Set ACTIVITY_TYPE to LIVE_QUIZ, PRACTICE_QUIZ, MICRO_LEARNING, or GROUP_ACTIVITY'
  )
  return value as ActivityType
}
const input = {
  activityType: activityType(),
  activityId: process.env.ACTIVITY_ID ?? '',
  oldUserId: process.env.OLD_USER_ID ?? '',
  newUserId: process.env.NEW_USER_ID ?? '',
}
const dryRun = process.env.DRY_RUN !== 'false'
type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
const ownership = { id: true, ownerId: true, updatedAt: true } as const

const activitySelect = {
  ...ownership,
  courseId: true,
  status: true,
  isDeleted: true,
} as const

function readActivity(db: Transaction) {
  const args = { where: { id: input.activityId }, select: activitySelect }
  switch (input.activityType) {
    case 'LIVE_QUIZ':
      return db.liveQuiz.findUniqueOrThrow(args)
    case 'PRACTICE_QUIZ':
      return db.practiceQuiz.findUniqueOrThrow(args)
    case 'MICRO_LEARNING':
      return db.microLearning.findUniqueOrThrow(args)
    case 'GROUP_ACTIVITY':
      return db.groupActivity.findUniqueOrThrow(args)
  }
}

function updateActivityOwner(db: Transaction) {
  const args = {
    where: { id: input.activityId },
    data: { ownerId: input.newUserId },
  }
  switch (input.activityType) {
    case 'LIVE_QUIZ':
      return db.liveQuiz.update(args)
    case 'PRACTICE_QUIZ':
      return db.practiceQuiz.update(args)
    case 'MICRO_LEARNING':
      return db.microLearning.update(args)
    case 'GROUP_ACTIVITY':
      return db.groupActivity.update(args)
  }
}

function permissionTarget() {
  switch (input.activityType) {
    case 'LIVE_QUIZ':
      return { liveQuizId: input.activityId }
    case 'PRACTICE_QUIZ':
      return { practiceQuizId: input.activityId }
    case 'MICRO_LEARNING':
      return { microLearningId: input.activityId }
    case 'GROUP_ACTIVITY':
      return { groupActivityId: input.activityId }
  }
}

async function snapshot(db: Transaction) {
  const activity = await readActivity(db)
  const blocks =
    input.activityType === 'LIVE_QUIZ'
      ? await db.elementBlock.findMany({
          where: { liveQuizId: activity.id },
          select: { id: true },
          orderBy: { id: 'asc' },
        })
      : []
  const stacks =
    input.activityType === 'LIVE_QUIZ'
      ? []
      : await db.elementStack.findMany({
          where: permissionTarget(),
          select: { id: true, courseId: true },
          orderBy: { id: 'asc' },
        })
  const rawInstances = await db.elementInstance.findMany({
    where:
      input.activityType === 'LIVE_QUIZ'
        ? { elementBlockId: { in: blocks.map(({ id }) => id) } }
        : { elementStackId: { in: stacks.map(({ id }) => id) } },
    select: {
      ...ownership,
      elementId: true,
      elementStackId: true,
      elementBlockId: true,
      instancePerformance: { select: { id: true } },
      instanceStatistics: true,
      results: true,
      anonymousResults: true,
      _count: {
        select: {
          liveQuizResponses: true,
          responses: true,
          detailResponses: true,
          feedbacks: true,
          corrections: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  })
  // Never write participant response values into receipts or logs.
  const instances = rawInstances.map(
    ({ results, anonymousResults, instanceStatistics, ...instance }) => {
      const {
        elementInstanceId: _id,
        createdAt: _created,
        updatedAt: _updated,
        ...statistics
      } = instanceStatistics ?? {}
      return {
        ...instance,
        resultsHash: createHash('sha256')
          .update(json([results, anonymousResults]))
          .digest('hex'),
        hasStatistics: Object.values(statistics).some(
          (n) => n !== null && n !== 0
        ),
      }
    }
  )
  const elements = await db.element.findMany({
    where: { id: { in: instances.map(({ elementId }) => elementId) } },
    select: {
      ...ownership,
      tags: { select: { id: true }, orderBy: { id: 'asc' } },
      _count: { select: { elementInstances: true } },
    },
    orderBy: { id: 'asc' },
  })
  const tags = await db.tag.findMany({
    where: { id: { in: elements.flatMap((e) => e.tags.map(({ id }) => id)) } },
    select: ownership,
    orderBy: { id: 'asc' },
  })
  return { activity, blocks, stacks, instances, elements, tags }
}

async function validate(
  db: Transaction,
  state: Awaited<ReturnType<typeof snapshot>>
) {
  await db.user.findUniqueOrThrow({
    where: { id: input.newUserId },
    select: { id: true },
  })
  assert.equal(
    state.activity.ownerId,
    input.oldUserId,
    'Unexpected activity owner'
  )
  assert(!state.activity.isDeleted, 'Cannot transfer a deleted activity')
  for (const record of [...state.instances, ...state.elements, ...state.tags]) {
    assert.equal(
      record.ownerId,
      input.oldUserId,
      `Unexpected owner for object ${record.id}`
    )
  }
  // Tag names are unique per owner. Abort instead of merging or dropping tags.
  const collisions = await db.tag.count({
    where: {
      ownerId: input.newUserId,
      name: {
        in: (
          await db.tag.findMany({
            where: { id: { in: state.tags.map(({ id }) => id) } },
            select: { name: true },
          })
        ).map(({ name }) => name),
      },
    },
  })
  assert.equal(collisions, 0, 'Destination owner has conflicting tag names')
}

function json(value: unknown) {
  return JSON.stringify(value, null, 2)
}

async function run() {
  for (const [key, value] of Object.entries(input).filter(
    ([key]) => key !== 'activityType'
  )) {
    assert(
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value),
      `Set a valid UUID for ${key}`
    )
  }
  assert.notEqual(input.oldUserId, input.newUserId, 'Owners must differ')
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required')
  // Bind receipts to both the requested transfer and the database without saving its URL.
  const hash = createHash('sha256')
    .update(json(input))
    .update(process.env.DATABASE_URL)
    .digest('hex')
  const directory = resolve(
    process.env.TRANSFER_RECEIPT_DIR ?? '.transfer-activity'
  )
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const beforeFile = resolve(directory, `${hash}_dump_before.json`)
  const afterFile = resolve(directory, `${hash}_dump_after.json`)
  assert(
    !existsSync(afterFile),
    'This transfer already has a completion receipt'
  )

  const after = await prisma.$transaction(
    async (db) => {
      const before = await snapshot(db)
      await validate(db, before)
      const receipt = json({ hash, input, state: before })
      if (existsSync(beforeFile)) {
        assert.equal(
          readFileSync(beforeFile, 'utf8'),
          receipt,
          'Preview is stale; inspect changes and use a new receipt directory'
        )
      } else {
        assert(dryRun, 'Run a dry run first to create the before snapshot')
        writeFileSync(beforeFile, receipt, { flag: 'wx', mode: 0o600 })
      }
      console.log(
        json({
          dryRun,
          ...input,
          courseId: before.activity.courseId,
          instances: before.instances.length,
          elements: before.elements.length,
          tags: before.tags.length,
          elementsUsedElsewhere: before.elements
            .filter(
              (e) =>
                e._count.elementInstances >
                before.instances.filter((i) => i.elementId === e.id).length
            )
            .map((e) => e.id),
          beforeFile,
        })
      )
      if (dryRun) return null

      await updateActivityOwner(db)
      await db.elementInstance.updateMany({
        where: { id: { in: before.instances.map(({ id }) => id) } },
        data: { ownerId: input.newUserId },
      })
      await db.element.updateMany({
        where: { id: { in: before.elements.map(({ id }) => id) } },
        data: { ownerId: input.newUserId },
      })
      await db.tag.updateMany({
        where: { id: { in: before.tags.map(({ id }) => id) } },
        data: { ownerId: input.newUserId },
      })
      // The permission helper removes requests assigned to former admins before
      // redistributing them. Preserve a copy for the new owner first, including
      // standalone live quizzes whose old owner was the only administrator.
      const pendingRequests = await db.accessRequest.findMany({
        where: {
          objectAdminOrOwnerId: input.oldUserId,
          userId: { not: input.newUserId },
          OR: [
            permissionTarget(),
            { elementId: { in: before.elements.map(({ id }) => id) } },
          ],
        },
      })
      if (pendingRequests.length > 0) {
        await db.accessRequest.createMany({
          data: pendingRequests.map(
            ({
              id: _id,
              createdAt: _created,
              updatedAt: _updated,
              ...request
            }) => ({
              ...request,
              objectAdminOrOwnerId: input.newUserId,
            })
          ),
          skipDuplicates: true,
        })
      }
      // Ownership satisfies any pending requests made by the new owner.
      await db.accessRequest.deleteMany({
        where: {
          userId: input.newUserId,
          OR: [
            permissionTarget(),
            { elementId: { in: before.elements.map(({ id }) => id) } },
          ],
        },
      })
      // Recompute for all users, including inherited access from the existing course.
      // This also refreshes element and answer-collection permissions.
      await recomputeDerivedPermissions(
        { ...permissionTarget(), updateAccessRequests: true },
        db
      )
      await db.auditLogEntry.createMany({
        data: [
          {
            objectType: input.activityType,
            objectId: input.activityId,
          },
          ...before.elements.map(({ id }) => ({
            objectType: 'ELEMENT' as const,
            objectId: String(id),
          })),
        ].map((object) => ({
          ...object,
          type: 'OWNER_TRANSFERRED' as const,
          sourceUserId: input.oldUserId,
          targetUserId: input.newUserId,
          message:
            'Operator script transferred activity content; course assignment preserved.',
        })),
      })

      const result = await snapshot(db)
      const expected = structuredClone(before)
      expected.activity.ownerId = input.newUserId
      for (const item of [
        ...expected.instances,
        ...expected.elements,
        ...expected.tags,
      ])
        item.ownerId = input.newUserId
      // updatedAt is expected to change; all captured relationships/counts must stay intact.
      const comparable = (value: unknown) =>
        JSON.stringify(value, (key, item) =>
          key === 'updatedAt' ? undefined : item
        )
      assert.equal(
        comparable(result),
        comparable(expected),
        'Post-transfer verification failed'
      )
      return result
    },
    { isolationLevel: 'Serializable', timeout: 500000 }
  )

  if (after) {
    console.log('Transfer committed; writing completion receipt.')
    try {
      writeFileSync(afterFile, json({ hash, input, state: after }), {
        flag: 'wx',
        mode: 0o600,
      })
    } catch (error) {
      throw new Error(
        `Transfer COMMITTED, but receipt could not be saved to ${afterFile}. Do not rerun the write; inspect the database and retain the before snapshot.`,
        { cause: error }
      )
    }
    console.log(`Transfer committed and verified. Receipt: ${afterFile}`)
  } else
    console.log(
      'Dry run complete. Review the before snapshot, then rerun with DRY_RUN=false.'
    )
}

try {
  await run()
} finally {
  await prisma.$disconnect()
}
