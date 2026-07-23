import {
  CourseAuthType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PermissionLevel,
  PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { ElementData, ElementInstanceResults } from '@klicker-uzh/types'
import { PrismaPg } from '@prisma/adapter-pg'
import { createHash, randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ContextWithUser } from '../../src/lib/context.js'
import {
  addUserToUserGroup,
  revokeObjectAccess,
  shareObject,
  transferCourseOwnership,
} from '../../src/services/sharing.js'

const DRY_RUN = process.env.DRY_RUN !== 'false'
const BENCHMARK_PREFIX = 'perm-bench-'
const RECOMPUTE_LOG_PREFIX = 'PERMISSION_RECOMPUTE_BENCHMARK '
const LARGE_ACTIVITY_COUNT = 50
const LARGE_ELEMENTS_PER_ACTIVITY = 30
const LARGE_PERMISSION_USER_COUNT = 30
const GROUP_OBJECT_GRANT_COUNT = 20

type BenchmarkPrismaClient = PrismaClient<'query'>
type ActivityKind =
  | 'LIVE_QUIZ'
  | 'PRACTICE_QUIZ'
  | 'MICRO_LEARNING'
  | 'GROUP_ACTIVITY'

type ActivityShape = {
  kind: ActivityKind
  sourceId: string
  elementKeys: string[]
}

type CourseShape = {
  label: string
  activities: ActivityShape[]
}

type CourseShapeStats = {
  activities: number
  liveQuizzes: number
  practiceQuizzes: number
  microLearnings: number
  groupActivities: number
  uniqueElements: number
  elementTraversals: number
}

type BenchmarkUser = {
  id: string
  shortname: string
  email: string
}

type CourseFixture = {
  label: string
  courseId: string
  owner: BenchmarkUser
  directTarget: BenchmarkUser
  transferTarget: BenchmarkUser
  groupMember: BenchmarkUser
  ambientUsers: BenchmarkUser[]
  allUsers: BenchmarkUser[]
  stats: CourseShapeStats
  configuredPermissionUsers: number
}

type DerivedPermissionSnapshot = Map<string, string>

type RecomputeRecord = {
  objectType: string
  mode: 'user' | 'object'
  durationMs: number
  outcome: 'success' | 'error'
}

type ActiveMeasurement = {
  queryCount: number
  transactionControlQueryCount: number
  queryDurationMs: number
  transactionDurationsMs: number[]
}

type RowChanges = {
  added: number
  removed: number
  updated: number
  total: number
}

type ScenarioResult = {
  scenario: string
  fixture: string
  operation: string
  rootObjectType: string
  mode: 'user' | 'object'
  configuredPermissionUsers: number
  descendants: CourseShapeStats | { objectGrants: number }
  status: 'success' | 'timeout' | 'error' | 'skipped'
  totalMs: number
  transactionMs: number | null
  queryCount: number
  transactionControlQueryCount: number
  queryDurationMs: number
  rowsChanged: RowChanges
  recomputeCalls: number
  recomputeTotalMs: number
  recomputeMaxMs: number
  error?: string
}

type ScopedSnapshot = {
  users: number
  courses: number
  elements: number
  userGroups: number
  directPermissions: number
  derivedPermissions: number
  auditLogEntries: number
}

type BenchmarkHarness = {
  prisma: BenchmarkPrismaClient
  instrumentedPrisma: BenchmarkPrismaClient
  setActiveMeasurement: (measurement: ActiveMeasurement | null) => void
}

function roundMs(value: number) {
  return Math.round(value * 100) / 100
}

function getRunPrefix() {
  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[-:.TZ]/g, '')
    .slice(0, 14)
  return `${BENCHMARK_PREFIX}${timestamp}-${randomUUID().slice(0, 8)}`
}

function assertLocalDatabase(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  const hostname = new URL(databaseUrl).hostname
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', 'postgres'])
  if (!allowedHosts.has(hostname) && !hostname.endsWith('.localhost')) {
    throw new Error(
      `Permission propagation benchmarks only run against a local database; received host "${hostname}".`
    )
  }
}

function createBenchmarkHarness(databaseUrl: string): BenchmarkHarness {
  const adapter = new PrismaPg({ connectionString: databaseUrl })
  const prisma = new PrismaClient({
    adapter,
    log: [{ emit: 'event', level: 'query' }],
  })
  let activeMeasurement: ActiveMeasurement | null = null

  prisma.$on('query', (event) => {
    if (!activeMeasurement) {
      return
    }

    activeMeasurement.queryCount += 1
    activeMeasurement.queryDurationMs += event.duration
    if (/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(event.query)) {
      activeMeasurement.transactionControlQueryCount += 1
    }
  })

  const instrumentedPrisma = new Proxy(prisma, {
    get(target, property) {
      if (property === '$transaction') {
        return async (...args: unknown[]) => {
          const measurement = activeMeasurement
          const startedAt = performance.now()
          try {
            const transaction = target.$transaction as unknown as (
              ...transactionArgs: unknown[]
            ) => Promise<unknown>
            return await transaction.apply(target, args)
          } finally {
            if (measurement) {
              measurement.transactionDurationsMs.push(
                roundMs(performance.now() - startedAt)
              )
            }
          }
        }
      }

      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as BenchmarkPrismaClient

  return {
    prisma,
    instrumentedPrisma,
    setActiveMeasurement(measurement) {
      activeMeasurement = measurement
    },
  }
}

function createContext(
  prisma: BenchmarkPrismaClient,
  userId: string
): ContextWithUser {
  return {
    prisma: prisma as unknown as ContextWithUser['prisma'],
    emitter: new EventEmitter(),
    user: {
      sub: userId,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
  } as ContextWithUser
}

function uniqueElementKeys(activities: ActivityShape[]) {
  return [
    ...new Set(activities.flatMap((activity) => activity.elementKeys)),
  ].sort()
}

function getShapeStats(shape: CourseShape): CourseShapeStats {
  return {
    activities: shape.activities.length,
    liveQuizzes: shape.activities.filter(
      (activity) => activity.kind === 'LIVE_QUIZ'
    ).length,
    practiceQuizzes: shape.activities.filter(
      (activity) => activity.kind === 'PRACTICE_QUIZ'
    ).length,
    microLearnings: shape.activities.filter(
      (activity) => activity.kind === 'MICRO_LEARNING'
    ).length,
    groupActivities: shape.activities.filter(
      (activity) => activity.kind === 'GROUP_ACTIVITY'
    ).length,
    uniqueElements: uniqueElementKeys(shape.activities).length,
    elementTraversals: shape.activities.reduce(
      (total, activity) => total + activity.elementKeys.length,
      0
    ),
  }
}

function normalizeActivityShape(
  kind: ActivityKind,
  sourceId: string,
  elements: { elementId: number }[]
): ActivityShape {
  return {
    kind,
    sourceId,
    elementKeys: [
      ...new Set(elements.map((element) => `testkurs:${element.elementId}`)),
    ].sort(),
  }
}

async function loadTestkursShape(
  prisma: BenchmarkPrismaClient
): Promise<CourseShape> {
  const course = await prisma.course.findFirst({
    where: { displayName: 'Testkurs' },
    select: {
      liveQuizzes: {
        select: {
          id: true,
          blocks: {
            select: {
              elements: { select: { elementId: true } },
            },
          },
        },
      },
      practiceQuizzes: {
        select: {
          id: true,
          stacks: {
            select: {
              elements: { select: { elementId: true } },
            },
          },
        },
      },
      microLearnings: {
        select: {
          id: true,
          stacks: {
            select: {
              elements: { select: { elementId: true } },
            },
          },
        },
      },
      groupActivities: {
        select: {
          id: true,
          stacks: {
            select: {
              elements: { select: { elementId: true } },
            },
          },
        },
      },
    },
  })

  if (!course) {
    throw new Error(
      'The seeded Testkurs course is required for the small benchmark fixture.'
    )
  }

  const activities = [
    ...course.liveQuizzes.map((activity) =>
      normalizeActivityShape(
        'LIVE_QUIZ',
        activity.id,
        activity.blocks.flatMap((block) => block.elements)
      )
    ),
    ...course.practiceQuizzes.map((activity) =>
      normalizeActivityShape(
        'PRACTICE_QUIZ',
        activity.id,
        activity.stacks.flatMap((stack) => stack.elements)
      )
    ),
    ...course.microLearnings.map((activity) =>
      normalizeActivityShape(
        'MICRO_LEARNING',
        activity.id,
        activity.stacks.flatMap((stack) => stack.elements)
      )
    ),
    ...course.groupActivities.map((activity) =>
      normalizeActivityShape(
        'GROUP_ACTIVITY',
        activity.id,
        activity.stacks.flatMap((stack) => stack.elements)
      )
    ),
  ].sort((left, right) =>
    `${left.kind}:${left.sourceId}`.localeCompare(
      `${right.kind}:${right.sourceId}`
    )
  )

  return { label: 'testkurs-sized', activities }
}

function createLargeShape(): CourseShape {
  return {
    label: 'synthetic-large',
    activities: Array.from(
      { length: LARGE_ACTIVITY_COUNT },
      (_, activityIndex) => ({
        kind: 'LIVE_QUIZ' as const,
        sourceId: `large-${activityIndex}`,
        elementKeys: Array.from(
          { length: LARGE_ELEMENTS_PER_ACTIVITY },
          (_, elementIndex) =>
            `large:${activityIndex.toString().padStart(2, '0')}:${elementIndex
              .toString()
              .padStart(2, '0')}`
        ),
      })
    ),
  }
}

async function createUsers(
  prisma: BenchmarkPrismaClient,
  runPrefix: string,
  labels: string[]
) {
  const users = await prisma.user.createManyAndReturn({
    data: labels.map((label) => ({
      shortname: `${runPrefix}-${label}`,
      email: `${runPrefix}-${label}@example.invalid`,
    })),
    select: { id: true, shortname: true, email: true },
  })

  return new Map(
    users.map((user) => [user.shortname.slice(runPrefix.length + 1), user])
  )
}

function requireUser(
  users: Map<string, BenchmarkUser>,
  label: string
): BenchmarkUser {
  const user = users.get(label)
  if (!user) {
    throw new Error(`Benchmark user "${label}" was not created`)
  }
  return user
}

function createInstanceData(
  elementIds: number[],
  ownerId: string,
  type: ElementInstanceType
) {
  return elementIds.map((elementId, order) => ({
    order,
    type,
    elementType: ElementType.CONTENT,
    options: {},
    elementData: {} as ElementData,
    results: {} as ElementInstanceResults,
    anonymousResults: {} as ElementInstanceResults,
    element: { connect: { id: elementId } },
    owner: { connect: { id: ownerId } },
  }))
}

async function createActivity(
  prisma: BenchmarkPrismaClient,
  {
    activity,
    activityIndex,
    courseId,
    elementIdByKey,
    ownerId,
    runPrefix,
    fixtureLabel,
  }: {
    activity: ActivityShape
    activityIndex: number
    courseId: string
    elementIdByKey: Map<string, number>
    ownerId: string
    runPrefix: string
    fixtureLabel: string
  }
) {
  const elementIds = activity.elementKeys.map((key) => {
    const elementId = elementIdByKey.get(key)
    if (typeof elementId === 'undefined') {
      throw new Error(`Missing benchmark element for key "${key}"`)
    }
    return elementId
  })
  const name = `${runPrefix}-${fixtureLabel}-activity-${activityIndex}`
  const scheduledStartAt = new Date('2026-01-01T00:00:00.000Z')
  const scheduledEndAt = new Date('2036-01-01T00:00:00.000Z')

  if (activity.kind === 'LIVE_QUIZ') {
    await prisma.liveQuiz.create({
      data: {
        name,
        displayName: name,
        ownerId,
        courseId,
        blocks: {
          create: {
            order: 0,
            elements: {
              create: createInstanceData(
                elementIds,
                ownerId,
                ElementInstanceType.LIVE_QUIZ
              ),
            },
          },
        },
      },
    })
    return
  }

  if (activity.kind === 'PRACTICE_QUIZ') {
    await prisma.practiceQuiz.create({
      data: {
        name,
        displayName: name,
        ownerId,
        courseId,
        stacks: {
          create: {
            order: 0,
            type: ElementStackType.PRACTICE_QUIZ,
            elements: {
              create: createInstanceData(
                elementIds,
                ownerId,
                ElementInstanceType.PRACTICE_QUIZ
              ),
            },
          },
        },
      },
    })
    return
  }

  if (activity.kind === 'MICRO_LEARNING') {
    await prisma.microLearning.create({
      data: {
        name,
        displayName: name,
        ownerId,
        courseId,
        scheduledStartAt,
        scheduledEndAt,
        stacks: {
          create: {
            order: 0,
            type: ElementStackType.MICROLEARNING,
            elements: {
              create: createInstanceData(
                elementIds,
                ownerId,
                ElementInstanceType.MICROLEARNING
              ),
            },
          },
        },
      },
    })
    return
  }

  await prisma.groupActivity.create({
    data: {
      name,
      displayName: name,
      ownerId,
      courseId,
      scheduledStartAt,
      scheduledEndAt,
      stacks: {
        create: {
          order: 0,
          type: ElementStackType.GROUP_ACTIVITY,
          elements: {
            create: createInstanceData(
              elementIds,
              ownerId,
              ElementInstanceType.GROUP_ACTIVITY
            ),
          },
        },
      },
    },
  })
}

async function createCourseFixture(
  prisma: BenchmarkPrismaClient,
  {
    runPrefix,
    shape,
    configuredPermissionUsers,
  }: {
    runPrefix: string
    shape: CourseShape
    configuredPermissionUsers: number
  }
): Promise<CourseFixture> {
  const ambientUserCount = configuredPermissionUsers - 1
  const userLabels = [
    `${shape.label}-owner`,
    `${shape.label}-direct-target`,
    `${shape.label}-transfer-target`,
    `${shape.label}-group-member`,
    ...Array.from(
      { length: ambientUserCount },
      (_, index) =>
        `${shape.label}-ambient-${(index + 1).toString().padStart(2, '0')}`
    ),
  ]
  const userMap = await createUsers(prisma, runPrefix, userLabels)
  const owner = requireUser(userMap, `${shape.label}-owner`)
  const directTarget = requireUser(userMap, `${shape.label}-direct-target`)
  const transferTarget = requireUser(userMap, `${shape.label}-transfer-target`)
  const groupMember = requireUser(userMap, `${shape.label}-group-member`)
  const ambientUsers = Array.from({ length: ambientUserCount }, (_, index) =>
    requireUser(
      userMap,
      `${shape.label}-ambient-${(index + 1).toString().padStart(2, '0')}`
    )
  )
  const courseName = `${runPrefix}-${shape.label}-course`
  const course = await prisma.course.create({
    data: {
      name: courseName,
      displayName: courseName,
      ownerId: owner.id,
      authType: CourseAuthType.SSO,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2036-01-01T00:00:00.000Z'),
      groupDeadlineDate: new Date('2035-01-01T00:00:00.000Z'),
    },
  })

  const elementKeys = uniqueElementKeys(shape.activities)
  const elementNameByKey = new Map(
    elementKeys.map((key, index) => [
      key,
      `${runPrefix}-${shape.label}-element-${index}`,
    ])
  )
  const elements = await prisma.element.createManyAndReturn({
    data: elementKeys.map((key) => ({
      type: ElementType.CONTENT,
      name: elementNameByKey.get(key)!,
      content: 'Synthetic permission propagation benchmark element.',
      options: {},
      ownerId: owner.id,
    })),
    select: { id: true, name: true },
  })
  const elementIdByName = new Map(
    elements.map((element) => [element.name, element.id])
  )
  const elementIdByKey = new Map(
    elementKeys.map((key) => {
      const name = elementNameByKey.get(key)!
      const id = elementIdByName.get(name)
      if (typeof id === 'undefined') {
        throw new Error(`Benchmark element "${name}" was not created`)
      }
      return [key, id]
    })
  )

  for (let start = 0; start < shape.activities.length; start += 5) {
    await Promise.all(
      shape.activities.slice(start, start + 5).map((activity, batchIndex) =>
        createActivity(prisma, {
          activity,
          activityIndex: start + batchIndex,
          courseId: course.id,
          elementIdByKey,
          ownerId: owner.id,
          runPrefix,
          fixtureLabel: shape.label,
        })
      )
    )
  }

  if (ambientUsers.length > 0) {
    await prisma.permission.createMany({
      data: ambientUsers.map((user) => ({
        permissionLevel: PermissionLevel.ADMIN,
        propagation: true,
        courseId: course.id,
        userId: user.id,
      })),
    })
  }

  return {
    label: shape.label,
    courseId: course.id,
    owner,
    directTarget,
    transferTarget,
    groupMember,
    ambientUsers,
    allUsers: [...userMap.values()],
    stats: getShapeStats(shape),
    configuredPermissionUsers,
  }
}

function derivedPermissionKey(
  permission: Awaited<
    ReturnType<BenchmarkPrismaClient['derivedPermission']['findMany']>
  >[number]
) {
  if (permission.catalogCollectionId) {
    return `CATALOG_COLLECTION:${permission.catalogCollectionId}:${permission.userId}`
  }
  if (permission.answerCollectionId !== null) {
    return `ANSWER_COLLECTION:${permission.answerCollectionId}:${permission.userId}`
  }
  if (permission.elementId !== null) {
    return `ELEMENT:${permission.elementId}:${permission.userId}`
  }
  if (permission.courseId) {
    return `COURSE:${permission.courseId}:${permission.userId}`
  }
  if (permission.liveQuizId) {
    return `LIVE_QUIZ:${permission.liveQuizId}:${permission.userId}`
  }
  if (permission.practiceQuizId) {
    return `PRACTICE_QUIZ:${permission.practiceQuizId}:${permission.userId}`
  }
  if (permission.microLearningId) {
    return `MICRO_LEARNING:${permission.microLearningId}:${permission.userId}`
  }
  if (permission.groupActivityId) {
    return `GROUP_ACTIVITY:${permission.groupActivityId}:${permission.userId}`
  }
  throw new Error(`Derived permission ${permission.id} has no object ID`)
}

async function snapshotDerivedPermissions(
  prisma: BenchmarkPrismaClient,
  userIds: string[]
): Promise<DerivedPermissionSnapshot> {
  const permissions = await prisma.derivedPermission.findMany({
    where: { userId: { in: userIds } },
  })

  return new Map(
    permissions.map((permission) => [
      derivedPermissionKey(permission),
      JSON.stringify({
        permissionLevel: permission.permissionLevel,
        derived: permission.derived,
        directPermissionId: permission.directPermissionId,
      }),
    ])
  )
}

function compareSnapshots(
  before: DerivedPermissionSnapshot,
  after: DerivedPermissionSnapshot
): RowChanges {
  let added = 0
  let removed = 0
  let updated = 0

  for (const [key, value] of after) {
    if (!before.has(key)) {
      added += 1
    } else if (before.get(key) !== value) {
      updated += 1
    }
  }

  for (const key of before.keys()) {
    if (!after.has(key)) {
      removed += 1
    }
  }

  return { added, removed, updated, total: added + removed + updated }
}

function parseRecomputeRecord(message: unknown): RecomputeRecord | undefined {
  if (
    typeof message !== 'string' ||
    !message.startsWith(RECOMPUTE_LOG_PREFIX)
  ) {
    return undefined
  }

  const parsed = JSON.parse(message.slice(RECOMPUTE_LOG_PREFIX.length)) as {
    objectType: string
    mode: 'user' | 'object'
    durationMs: number
    outcome: 'success' | 'error'
  }
  return {
    objectType: parsed.objectType,
    mode: parsed.mode,
    durationMs: parsed.durationMs,
    outcome: parsed.outcome,
  }
}

function classifyError(error: unknown): {
  status: 'timeout' | 'error'
  message: string
} {
  const message = error instanceof Error ? error.message : String(error)
  return {
    status: /timeout|transaction already closed|P2028/i.test(message)
      ? 'timeout'
      : 'error',
    message,
  }
}

async function measureScenario<T>(
  harness: BenchmarkHarness,
  {
    scenario,
    fixture,
    operation,
    rootObjectType,
    mode,
    configuredPermissionUsers,
    descendants,
    affectedUserIds,
    run,
  }: {
    scenario: string
    fixture: string
    operation: string
    rootObjectType: string
    mode: 'user' | 'object'
    configuredPermissionUsers: number
    descendants: CourseShapeStats | { objectGrants: number }
    affectedUserIds: string[]
    run: () => Promise<T>
  }
): Promise<{ measurement: ScenarioResult; result?: T }> {
  const before = await snapshotDerivedPermissions(
    harness.prisma,
    affectedUserIds
  )
  const activeMeasurement: ActiveMeasurement = {
    queryCount: 0,
    transactionControlQueryCount: 0,
    queryDurationMs: 0,
    transactionDurationsMs: [],
  }
  const recomputeRecords: RecomputeRecord[] = []
  const originalConsoleInfo = console.info
  console.info = (message?: unknown, ...optionalParams: unknown[]) => {
    const record = parseRecomputeRecord(message)
    if (record) {
      recomputeRecords.push(record)
      return
    }
    originalConsoleInfo(message, ...optionalParams)
  }

  harness.setActiveMeasurement(activeMeasurement)
  const startedAt = performance.now()
  let result: T | undefined
  let status: ScenarioResult['status'] = 'success'
  let errorMessage: string | undefined

  try {
    result = await run()
  } catch (error) {
    const classified = classifyError(error)
    status = classified.status
    errorMessage = classified.message
  } finally {
    harness.setActiveMeasurement(null)
    console.info = originalConsoleInfo
  }

  const totalMs = roundMs(performance.now() - startedAt)
  const after = await snapshotDerivedPermissions(
    harness.prisma,
    affectedUserIds
  )
  const rowsChanged = compareSnapshots(before, after)
  const recomputeTotalMs = roundMs(
    recomputeRecords.reduce((total, record) => total + record.durationMs, 0)
  )
  const measurement: ScenarioResult = {
    scenario,
    fixture,
    operation,
    rootObjectType,
    mode,
    configuredPermissionUsers,
    descendants,
    status,
    totalMs,
    transactionMs:
      activeMeasurement.transactionDurationsMs.length > 0
        ? roundMs(
            activeMeasurement.transactionDurationsMs.reduce(
              (total, duration) => total + duration,
              0
            )
          )
        : null,
    queryCount: activeMeasurement.queryCount,
    transactionControlQueryCount:
      activeMeasurement.transactionControlQueryCount,
    queryDurationMs: roundMs(activeMeasurement.queryDurationMs),
    rowsChanged,
    recomputeCalls: recomputeRecords.length,
    recomputeTotalMs,
    recomputeMaxMs: roundMs(
      Math.max(0, ...recomputeRecords.map((record) => record.durationMs))
    ),
    ...(errorMessage ? { error: errorMessage } : {}),
  }

  console.log(JSON.stringify({ benchmark: measurement }))
  return { measurement, ...(typeof result !== 'undefined' ? { result } : {}) }
}

function skippedScenario({
  scenario,
  fixture,
  operation,
  rootObjectType,
  mode,
  configuredPermissionUsers,
  descendants,
  reason,
}: {
  scenario: string
  fixture: string
  operation: string
  rootObjectType: string
  mode: 'user' | 'object'
  configuredPermissionUsers: number
  descendants: CourseShapeStats
  reason: string
}): ScenarioResult {
  return {
    scenario,
    fixture,
    operation,
    rootObjectType,
    mode,
    configuredPermissionUsers,
    descendants,
    status: 'skipped',
    totalMs: 0,
    transactionMs: null,
    queryCount: 0,
    transactionControlQueryCount: 0,
    queryDurationMs: 0,
    rowsChanged: { added: 0, removed: 0, updated: 0, total: 0 },
    recomputeCalls: 0,
    recomputeTotalMs: 0,
    recomputeMaxMs: 0,
    error: reason,
  }
}

async function benchmarkCourseFixture(
  harness: BenchmarkHarness,
  fixture: CourseFixture,
  runPrefix: string
): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = []
  const ownerContext = createContext(
    harness.instrumentedPrisma,
    fixture.owner.id
  )

  const directShare = await measureScenario(harness, {
    scenario: `${fixture.label}:share-user`,
    fixture: fixture.label,
    operation: 'share',
    rootObjectType: 'COURSE',
    mode: 'user',
    configuredPermissionUsers: fixture.configuredPermissionUsers,
    descendants: fixture.stats,
    affectedUserIds: [fixture.directTarget.id],
    run: () =>
      shareObject(
        {
          permissionLevel: PermissionLevel.ADMIN,
          shortnameOrEmail: fixture.directTarget.shortname,
          propagation: true,
          courseId: fixture.courseId,
        },
        ownerContext
      ),
  })
  results.push(directShare.measurement)

  const directPermissionId = directShare.result?.permissionId
  if (typeof directPermissionId === 'number') {
    const directRevoke = await measureScenario(harness, {
      scenario: `${fixture.label}:revoke-user`,
      fixture: fixture.label,
      operation: 'revoke',
      rootObjectType: 'COURSE',
      mode: 'user',
      configuredPermissionUsers: fixture.configuredPermissionUsers,
      descendants: fixture.stats,
      affectedUserIds: [fixture.directTarget.id],
      run: () =>
        revokeObjectAccess(
          {
            permissionId: directPermissionId,
            courseId: fixture.courseId,
          },
          ownerContext
        ),
    })
    results.push(directRevoke.measurement)
  } else {
    results.push(
      skippedScenario({
        scenario: `${fixture.label}:revoke-user`,
        fixture: fixture.label,
        operation: 'revoke',
        rootObjectType: 'COURSE',
        mode: 'user',
        configuredPermissionUsers: fixture.configuredPermissionUsers,
        descendants: fixture.stats,
        reason: 'The prerequisite direct share did not commit.',
      })
    )
  }

  const transfer = await measureScenario(harness, {
    scenario: `${fixture.label}:transfer`,
    fixture: fixture.label,
    operation: 'transfer',
    rootObjectType: 'COURSE',
    mode: 'user',
    configuredPermissionUsers: fixture.configuredPermissionUsers,
    descendants: fixture.stats,
    affectedUserIds: [fixture.owner.id, fixture.transferTarget.id],
    run: () =>
      transferCourseOwnership(
        {
          id: fixture.courseId,
          shortnameOrEmail: fixture.transferTarget.shortname,
        },
        ownerContext
      ),
  })
  results.push(transfer.measurement)

  const currentOwner =
    transfer.measurement.status === 'success'
      ? fixture.transferTarget
      : fixture.owner
  const group = await harness.prisma.userGroup.create({
    data: {
      name: `${runPrefix}-${fixture.label}-object-mode-group`,
      ownerId: currentOwner.id,
      members: { connect: { id: fixture.groupMember.id } },
    },
  })
  const currentOwnerContext = createContext(
    harness.instrumentedPrisma,
    currentOwner.id
  )
  const groupShare = await measureScenario(harness, {
    scenario: `${fixture.label}:share-group-object-mode`,
    fixture: fixture.label,
    operation: 'share',
    rootObjectType: 'COURSE',
    mode: 'object',
    configuredPermissionUsers: fixture.configuredPermissionUsers,
    descendants: fixture.stats,
    affectedUserIds: fixture.allUsers.map((user) => user.id),
    run: () =>
      shareObject(
        {
          permissionLevel: PermissionLevel.ADMIN,
          userGroupId: group.id,
          propagation: true,
          courseId: fixture.courseId,
        },
        currentOwnerContext
      ),
  })
  results.push(groupShare.measurement)

  const groupPermissionId = groupShare.result?.permissionId
  if (typeof groupPermissionId === 'number') {
    const groupRevoke = await measureScenario(harness, {
      scenario: `${fixture.label}:revoke-group`,
      fixture: fixture.label,
      operation: 'revoke',
      rootObjectType: 'COURSE',
      mode: 'user',
      configuredPermissionUsers: fixture.configuredPermissionUsers,
      descendants: fixture.stats,
      affectedUserIds: [currentOwner.id, fixture.groupMember.id],
      run: () =>
        revokeObjectAccess(
          {
            permissionId: groupPermissionId,
            courseId: fixture.courseId,
          },
          currentOwnerContext
        ),
    })
    results.push(groupRevoke.measurement)
  } else {
    results.push(
      skippedScenario({
        scenario: `${fixture.label}:revoke-group`,
        fixture: fixture.label,
        operation: 'revoke',
        rootObjectType: 'COURSE',
        mode: 'user',
        configuredPermissionUsers: fixture.configuredPermissionUsers,
        descendants: fixture.stats,
        reason: 'The prerequisite group share did not commit.',
      })
    )
  }

  return results
}

async function benchmarkGroupMembership(
  harness: BenchmarkHarness,
  runPrefix: string
): Promise<ScenarioResult> {
  const userMap = await createUsers(harness.prisma, runPrefix, [
    'group-grants-owner',
    'group-grants-target',
  ])
  const owner = requireUser(userMap, 'group-grants-owner')
  const target = requireUser(userMap, 'group-grants-target')
  const group = await harness.prisma.userGroup.create({
    data: {
      name: `${runPrefix}-group-grants`,
      ownerId: owner.id,
    },
  })
  const elements = await harness.prisma.element.createManyAndReturn({
    data: Array.from({ length: GROUP_OBJECT_GRANT_COUNT }, (_, index) => ({
      type: ElementType.CONTENT,
      name: `${runPrefix}-group-grant-element-${index}`,
      content: 'Synthetic user-group permission benchmark element.',
      options: {},
      ownerId: owner.id,
    })),
    select: { id: true },
  })
  await harness.prisma.permission.createMany({
    data: elements.map((element) => ({
      permissionLevel: PermissionLevel.READ,
      propagation: false,
      elementId: element.id,
      userGroupId: group.id,
    })),
  })
  const ownerContext = createContext(harness.instrumentedPrisma, owner.id)

  return (
    await measureScenario(harness, {
      scenario: 'user-group:add-member-20-object-grants',
      fixture: 'user-group-20-object-grants',
      operation: 'add-group-member',
      rootObjectType: 'ELEMENT',
      mode: 'user',
      configuredPermissionUsers: 1,
      descendants: { objectGrants: GROUP_OBJECT_GRANT_COUNT },
      affectedUserIds: [target.id],
      run: () =>
        addUserToUserGroup(
          {
            groupId: group.id,
            shortnameOrEmail: target.shortname,
          },
          ownerContext
        ),
    })
  ).measurement
}

async function getScopedSnapshot(
  prisma: BenchmarkPrismaClient,
  prefix: string
): Promise<ScopedSnapshot> {
  const users = await prisma.user.findMany({
    where: { shortname: { startsWith: prefix } },
    select: { id: true },
  })
  const courses = await prisma.course.findMany({
    where: { name: { startsWith: prefix } },
    select: { id: true },
  })
  const elements = await prisma.element.findMany({
    where: { name: { startsWith: prefix } },
    select: { id: true },
  })
  const userGroups = await prisma.userGroup.findMany({
    where: { name: { startsWith: prefix } },
    select: { id: true },
  })
  const userIds = users.map((user) => user.id)
  const courseIds = courses.map((course) => course.id)
  const elementIds = elements.map((element) => element.id)
  const userGroupIds = userGroups.map((group) => group.id)
  const objectIds = [
    ...courseIds,
    ...elementIds.map(String),
    ...userGroupIds.map(String),
  ]
  const permissionScope = {
    OR: [
      { userId: { in: userIds } },
      { userGroupId: { in: userGroupIds } },
      { courseId: { in: courseIds } },
      { elementId: { in: elementIds } },
    ],
  }

  const [directPermissions, derivedPermissions, auditLogEntries] =
    await Promise.all([
      prisma.permission.count({ where: permissionScope }),
      prisma.derivedPermission.count({
        where: {
          OR: [
            { userId: { in: userIds } },
            { courseId: { in: courseIds } },
            { elementId: { in: elementIds } },
          ],
        },
      }),
      prisma.auditLogEntry.count({
        where: {
          OR: [
            { sourceUserId: { in: userIds } },
            { targetUserId: { in: userIds } },
            { objectId: { in: objectIds } },
          ],
        },
      }),
    ])

  return {
    users: users.length,
    courses: courses.length,
    elements: elements.length,
    userGroups: userGroups.length,
    directPermissions,
    derivedPermissions,
    auditLogEntries,
  }
}

function snapshotIsEmpty(snapshot: ScopedSnapshot) {
  return Object.values(snapshot).every((count) => count === 0)
}

async function cleanupFixtures(
  prisma: BenchmarkPrismaClient,
  runPrefix: string
) {
  const users = await prisma.user.findMany({
    where: { shortname: { startsWith: runPrefix } },
    select: { id: true },
  })
  const courses = await prisma.course.findMany({
    where: { name: { startsWith: runPrefix } },
    select: { id: true },
  })
  const elements = await prisma.element.findMany({
    where: { name: { startsWith: runPrefix } },
    select: { id: true },
  })
  const userGroups = await prisma.userGroup.findMany({
    where: { name: { startsWith: runPrefix } },
    select: { id: true },
  })
  const userIds = users.map((user) => user.id)
  const objectIds = [
    ...courses.map((course) => course.id),
    ...elements.map((element) => String(element.id)),
    ...userGroups.map((group) => String(group.id)),
  ]

  await prisma.auditLogEntry.deleteMany({
    where: {
      OR: [
        { sourceUserId: { in: userIds } },
        { targetUserId: { in: userIds } },
        { objectId: { in: objectIds } },
      ],
    },
  })
  await prisma.course.deleteMany({
    where: { name: { startsWith: runPrefix } },
  })
  await prisma.element.deleteMany({
    where: { name: { startsWith: runPrefix } },
  })
  await prisma.userGroup.deleteMany({
    where: { name: { startsWith: runPrefix } },
  })
  await prisma.user.deleteMany({
    where: { shortname: { startsWith: runPrefix } },
  })
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function dryRunSummary() {
  return {
    status: 'dry-run',
    writesEnabled: false,
    fixtures: {
      testkursSized:
        'Read the seeded Testkurs topology and clone it with generated local-only users and objects.',
      syntheticLarge: {
        activities: LARGE_ACTIVITY_COUNT,
        elementsPerActivity: LARGE_ELEMENTS_PER_ACTIVITY,
        permissionUsers: LARGE_PERMISSION_USER_COUNT,
      },
      userGroup: { objectGrants: GROUP_OBJECT_GRANT_COUNT },
    },
    safeguards: [
      'Reject non-local DATABASE_URL hosts.',
      'Use only generated example.invalid users and synthetic objects.',
      'Capture scoped before and after dumps under project/_local.',
      'Delete only records carrying the unique benchmark prefix.',
      'Assert that no benchmark rows remain after cleanup.',
    ],
    runCommand:
      'pnpm --filter @klicker-uzh/graphql benchmark:permission-propagation:run',
  }
}

async function main() {
  if (DRY_RUN) {
    console.log(JSON.stringify(dryRunSummary(), null, 2))
    return
  }

  assertLocalDatabase(process.env.DATABASE_URL)
  process.env.PERMISSION_RECOMPUTE_BENCHMARK = '1'
  const runPrefix = getRunPrefix()
  const outputDirectory = resolve(
    import.meta.dirname,
    '../../../../project/_local/permission-propagation-benchmark'
  )
  const runId = runPrefix.slice(BENCHMARK_PREFIX.length)
  await mkdir(outputDirectory, { recursive: true })

  const harness = createBenchmarkHarness(process.env.DATABASE_URL!)
  const results: ScenarioResult[] = []
  let runError: unknown
  let testkursShape: CourseShape | undefined
  let payloadHash: string | undefined
  let beforeSnapshot: ScopedSnapshot | undefined

  try {
    const preExistingSnapshot = await getScopedSnapshot(
      harness.prisma,
      BENCHMARK_PREFIX
    )
    if (!snapshotIsEmpty(preExistingSnapshot)) {
      throw new Error(
        `Refusing to start: existing benchmark rows were found (${JSON.stringify(
          preExistingSnapshot
        )}). Clean up that prior local run first.`
      )
    }

    testkursShape = await loadTestkursShape(harness.prisma)
    const largeShape = createLargeShape()
    payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          testkursShape,
          largeShape,
          groupObjectGrants: GROUP_OBJECT_GRANT_COUNT,
        })
      )
      .digest('hex')
    beforeSnapshot = await getScopedSnapshot(harness.prisma, runPrefix)
    await writeJson(resolve(outputDirectory, `${runId}-dump-before.json`), {
      runId,
      payloadHash,
      snapshot: beforeSnapshot,
    })
    if (!snapshotIsEmpty(beforeSnapshot)) {
      throw new Error('The run-specific benchmark prefix is not empty.')
    }

    console.log(
      JSON.stringify({
        fixture: 'testkurs-sized',
        stats: getShapeStats(testkursShape),
      })
    )
    const smallFixture = await createCourseFixture(harness.prisma, {
      runPrefix,
      shape: testkursShape,
      configuredPermissionUsers: 1,
    })
    results.push(
      ...(await benchmarkCourseFixture(harness, smallFixture, runPrefix))
    )

    console.log(
      JSON.stringify({
        fixture: 'synthetic-large',
        stats: getShapeStats(largeShape),
        configuredPermissionUsers: LARGE_PERMISSION_USER_COUNT,
      })
    )
    const largeFixture = await createCourseFixture(harness.prisma, {
      runPrefix,
      shape: largeShape,
      configuredPermissionUsers: LARGE_PERMISSION_USER_COUNT,
    })
    results.push(
      ...(await benchmarkCourseFixture(harness, largeFixture, runPrefix))
    )

    results.push(await benchmarkGroupMembership(harness, runPrefix))
  } catch (error) {
    runError = error
  }

  let cleanupError: unknown
  try {
    await cleanupFixtures(harness.prisma, runPrefix)
  } catch (error) {
    cleanupError = error
  }

  const afterSnapshot = await getScopedSnapshot(
    harness.prisma,
    BENCHMARK_PREFIX
  )
  const verification = {
    successes: Object.values(afterSnapshot).filter((count) => count === 0)
      .length,
    mismatches: Object.values(afterSnapshot).filter((count) => count !== 0)
      .length,
  }
  await writeJson(resolve(outputDirectory, `${runId}-dump-after.json`), {
    runId,
    payloadHash,
    snapshot: afterSnapshot,
    verification,
  })
  const report = {
    runId,
    payloadHash,
    fixture: {
      testkursSized: testkursShape ? getShapeStats(testkursShape) : null,
      syntheticLarge: getShapeStats(createLargeShape()),
      userGroupObjectGrants: GROUP_OBJECT_GRANT_COUNT,
    },
    results,
    cleanup: {
      snapshot: afterSnapshot,
      verification,
      error:
        cleanupError instanceof Error
          ? cleanupError.message
          : cleanupError
            ? String(cleanupError)
            : null,
    },
    error:
      runError instanceof Error
        ? runError.message
        : runError
          ? String(runError)
          : null,
  }
  await writeJson(resolve(outputDirectory, `${runId}-results.json`), report)
  console.log(
    `Verification Summary: ${verification.successes} Successes, ${verification.mismatches} Mismatches`
  )
  console.log(JSON.stringify({ reportPath: `${runId}-results.json` }))

  await harness.prisma.$disconnect()

  if (!snapshotIsEmpty(afterSnapshot)) {
    throw new Error(
      `Benchmark cleanup left scoped rows behind: ${JSON.stringify(
        afterSnapshot
      )}`
    )
  }
  if (cleanupError) {
    throw cleanupError
  }
  if (runError) {
    throw runError
  }
}

await main()
