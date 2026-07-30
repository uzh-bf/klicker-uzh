import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  isAdaptiveUniqueConstraintConflict,
  isRetryableAdaptiveTransactionConflict,
  waitForAdaptiveTransactionRetry,
} from './adaptiveTransactions.js'

const ADAPTIVE_RUNTIME_TRANSACTION_RETRIES = 3

export type LockedAdaptiveCourse = {
  id: string
  isAdaptiveLearningEnabled: boolean
}

export type LockedPracticeQuiz = {
  id: string
  courseId: string
  mode: DB.PracticeQuizMode
  status: DB.PublicationStatus
  availableFrom: Date | null
  scheduledPublicationTaskId: string | null
  isDeleted: boolean
}

export type LockedAdaptivePracticeQuizConfig = {
  id: string
  practiceQuizId: string
}

export type AdaptiveAttemptLifecycleIdentity = {
  id: string
  courseId: string
  practiceQuizId: string
  configId: string
}

export type LockedAdaptiveAdministrator = {
  id: string
  role: DB.UserRole
}

type AdaptiveEstimateValues = {
  theta: number | null
  standardError: number | null
  responseCount: number
  levelId: number | null
  stopReason: DB.AdaptivePracticeQuizStopReason | null
}

type OverallAdaptiveEstimateWrite = AdaptiveEstimateValues & {
  nodeKind: typeof DB.AdaptiveEstimateNodeKind.OVERALL
  nodeId: null
}

type NodeAdaptiveEstimateWrite = AdaptiveEstimateValues & {
  nodeKind:
    | typeof DB.AdaptiveEstimateNodeKind.COMPETENCE
    | typeof DB.AdaptiveEstimateNodeKind.SUBCOMPETENCE
  nodeId: number
}

export type PersistAdaptivePracticeQuizEstimatesInput = {
  attemptId: string
  configId: string
  competenceTreeId: string
  overall: OverallAdaptiveEstimateWrite
  nodes: readonly NodeAdaptiveEstimateWrite[]
}

// Trees are capped at 500 nodes. OVERALL needs its partial-index conflict
// target, so 250-row node chunks bound persistence to at most three queries.
const ADAPTIVE_ESTIMATE_NODE_CHUNK_SIZE = 250

// Participant lifecycle order: Course -> PracticeQuiz -> config -> attempt.
// Administrative rollout prepends User. Quiz deletion inserts direct
// Permission rows before its persisted DerivedPermission authorization check.
export async function lockAdaptiveCourseForShare(
  courseId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<LockedAdaptiveCourse | null> {
  const rows = await prisma.$queryRaw<LockedAdaptiveCourse[]>`
    SELECT "id", "isAdaptiveLearningEnabled"
    FROM "Course"
    WHERE "id" = ${courseId}::uuid
    FOR SHARE
  `
  return rows[0] ?? null
}

export async function lockAdaptiveCourseForUpdate(
  courseId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<LockedAdaptiveCourse | null> {
  const rows = await prisma.$queryRaw<LockedAdaptiveCourse[]>`
    SELECT "id", "isAdaptiveLearningEnabled"
    FROM "Course"
    WHERE "id" = ${courseId}::uuid
    FOR UPDATE
  `
  return rows[0] ?? null
}

export async function lockPracticeQuizForShare(
  practiceQuizId: string,
  courseId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<LockedPracticeQuiz | null> {
  const rows = await prisma.$queryRaw<LockedPracticeQuiz[]>`
    SELECT "id", "courseId", "mode", "status", "availableFrom",
      "scheduledPublicationTaskId", "isDeleted"
    FROM "PracticeQuiz"
    WHERE "id" = ${practiceQuizId}::uuid
      AND "courseId" = ${courseId}::uuid
    FOR SHARE
  `
  return rows[0] ?? null
}

export async function lockPracticeQuizForUpdate(
  practiceQuizId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<LockedPracticeQuiz | null> {
  const rows = await prisma.$queryRaw<LockedPracticeQuiz[]>`
    SELECT "id", "courseId", "mode", "status", "availableFrom",
      "scheduledPublicationTaskId", "isDeleted"
    FROM "PracticeQuiz"
    WHERE "id" = ${practiceQuizId}::uuid
    FOR UPDATE
  `
  return rows[0] ?? null
}

export async function lockPracticeQuizForUpdateInCourse(
  practiceQuizId: string,
  courseId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<LockedPracticeQuiz | null> {
  const rows = await prisma.$queryRaw<LockedPracticeQuiz[]>`
    SELECT "id", "courseId", "mode", "status", "availableFrom",
      "scheduledPublicationTaskId", "isDeleted"
    FROM "PracticeQuiz"
    WHERE "id" = ${practiceQuizId}::uuid
      AND "courseId" = ${courseId}::uuid
    FOR UPDATE
  `
  return rows[0] ?? null
}

export async function lockAdaptivePracticeQuizConfigForShare(
  practiceQuizId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<LockedAdaptivePracticeQuizConfig | null> {
  const rows = await prisma.$queryRaw<LockedAdaptivePracticeQuizConfig[]>`
    SELECT "id", "practiceQuizId"
    FROM "PracticeQuizAdaptiveConfig"
    WHERE "practiceQuizId" = ${practiceQuizId}::uuid
    FOR SHARE
  `
  return rows[0] ?? null
}

export async function lockAdaptivePracticeQuizConfigForUpdate(
  practiceQuizId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<LockedAdaptivePracticeQuizConfig | null> {
  const rows = await prisma.$queryRaw<LockedAdaptivePracticeQuizConfig[]>`
    SELECT "id", "practiceQuizId"
    FROM "PracticeQuizAdaptiveConfig"
    WHERE "practiceQuizId" = ${practiceQuizId}::uuid
    FOR UPDATE
  `
  return rows[0] ?? null
}

export async function lockAdaptiveAttemptForUpdate(
  identity: AdaptiveAttemptLifecycleIdentity,
  participantId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "AdaptivePracticeQuizAttempt"
    WHERE "id" = ${identity.id}::uuid
      AND "participantId" = ${participantId}::uuid
      AND "courseId" = ${identity.courseId}::uuid
      AND "practiceQuizId" = ${identity.practiceQuizId}::uuid
      AND "configId" = ${identity.configId}::uuid
    FOR UPDATE
  `
  return Boolean(rows[0])
}

export async function lockPracticeQuizAdminPermissionForShare(
  practiceQuizId: string,
  userId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT "id"
    FROM "DerivedPermission"
    WHERE "practiceQuizId" = ${practiceQuizId}::uuid
      AND "userId" = ${userId}::uuid
      AND "permissionLevel" IN (
        'ADMIN'::"PermissionLevel",
        'OWNER'::"PermissionLevel"
      )
    FOR SHARE
  `
  return Boolean(rows[0])
}

export async function lockPracticeQuizPermissionsForShare(
  practiceQuizId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT "id"
    FROM "Permission"
    WHERE "practiceQuizId" = ${practiceQuizId}::uuid
    ORDER BY "id"
    FOR SHARE
  `
}

export async function lockAdaptiveAdministratorForShare(
  userId: string,
  prisma: DB.Prisma.TransactionClient
): Promise<LockedAdaptiveAdministrator | null> {
  const rows = await prisma.$queryRaw<LockedAdaptiveAdministrator[]>`
    SELECT "id", "role"
    FROM "User"
    WHERE "id" = ${userId}::uuid
    FOR SHARE
  `
  return rows[0] ?? null
}

export async function persistAdaptivePracticeQuizEstimates(
  input: PersistAdaptivePracticeQuizEstimatesInput,
  prisma: DB.Prisma.TransactionClient
): Promise<void> {
  await prisma.$executeRaw(
    DB.Prisma.sql`
      INSERT INTO "AdaptivePracticeQuizEstimate" (
        "attemptId",
        "configId",
        "competenceTreeId",
        "nodeKind",
        "nodeId",
        "theta",
        "standardError",
        "responseCount",
        "levelId",
        "stopReason"
      )
      VALUES ${adaptiveEstimateRows(input, [input.overall])}
      ON CONFLICT ("attemptId", "nodeKind") WHERE "nodeId" IS NULL
      DO UPDATE SET
        "configId" = EXCLUDED."configId",
        "competenceTreeId" = EXCLUDED."competenceTreeId",
        "theta" = EXCLUDED."theta",
        "standardError" = EXCLUDED."standardError",
        "responseCount" = EXCLUDED."responseCount",
        "levelId" = EXCLUDED."levelId",
        "stopReason" = EXCLUDED."stopReason"
    `
  )

  for (
    let offset = 0;
    offset < input.nodes.length;
    offset += ADAPTIVE_ESTIMATE_NODE_CHUNK_SIZE
  ) {
    const chunk = input.nodes.slice(
      offset,
      offset + ADAPTIVE_ESTIMATE_NODE_CHUNK_SIZE
    )
    await prisma.$executeRaw(
      DB.Prisma.sql`
        INSERT INTO "AdaptivePracticeQuizEstimate" (
          "attemptId",
          "configId",
          "competenceTreeId",
          "nodeKind",
          "nodeId",
          "theta",
          "standardError",
          "responseCount",
          "levelId",
          "stopReason"
        )
        VALUES ${adaptiveEstimateRows(input, chunk)}
        ON CONFLICT ("attemptId", "nodeKind", "nodeId")
        DO UPDATE SET
          "configId" = EXCLUDED."configId",
          "competenceTreeId" = EXCLUDED."competenceTreeId",
          "theta" = EXCLUDED."theta",
          "standardError" = EXCLUDED."standardError",
          "responseCount" = EXCLUDED."responseCount",
          "levelId" = EXCLUDED."levelId",
          "stopReason" = EXCLUDED."stopReason"
      `
    )
  }
}

export async function withSerializableRetry<T>(
  ctx: ContextWithUser,
  operation: (prisma: DB.Prisma.TransactionClient) => Promise<T>,
  {
    retryOnUniqueConstraint = false,
    conflictCode = 'ADAPTIVE_ATTEMPT_CONFLICT',
    conflictMessage = 'The adaptive attempt could not be updated due to concurrent activity.',
    operation: eventOperation = 'ATTEMPT',
  }: {
    retryOnUniqueConstraint?: boolean
    conflictCode?: string
    conflictMessage?: string
    operation?: 'ATTEMPT' | 'COHORT_SNAPSHOT' | 'PUBLICATION'
  } = {}
): Promise<T> {
  for (
    let attempt = 0;
    attempt < ADAPTIVE_RUNTIME_TRANSACTION_RETRIES;
    attempt++
  ) {
    try {
      return await ctx.prisma.$transaction(operation, {
        isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 20_000,
      })
    } catch (error) {
      if (
        isRetryableAdaptiveTransactionConflict(error) ||
        (retryOnUniqueConstraint && isAdaptiveUniqueConstraintConflict(error))
      ) {
        if (attempt < ADAPTIVE_RUNTIME_TRANSACTION_RETRIES - 1) {
          emitAdaptiveOperationalEvent({
            name: 'adaptive_transaction_retry',
            operation: eventOperation,
            outcome: 'RETRYING',
            retryNumber: attempt + 1,
          })
          await waitForAdaptiveTransactionRetry(attempt)
          continue
        }
        emitAdaptiveOperationalEvent({
          name: 'adaptive_transaction_retry',
          operation: eventOperation,
          outcome: 'EXHAUSTED',
          retryNumber: attempt + 1,
        })
        throw adaptiveRepositoryError(conflictMessage, conflictCode)
      }
      throw error
    }
  }
  throw new Error('Unreachable adaptive transaction retry state.')
}

function adaptiveEstimateRows(
  input: Pick<
    PersistAdaptivePracticeQuizEstimatesInput,
    'attemptId' | 'configId' | 'competenceTreeId'
  >,
  estimates: readonly (
    | OverallAdaptiveEstimateWrite
    | NodeAdaptiveEstimateWrite
  )[]
): DB.Prisma.Sql {
  return DB.Prisma.join(
    estimates.map(
      (estimate) => DB.Prisma.sql`
        (
          ${input.attemptId}::uuid,
          ${input.configId}::uuid,
          ${input.competenceTreeId}::uuid,
          ${estimate.nodeKind}::"AdaptiveEstimateNodeKind",
          ${estimate.nodeId}::integer,
          ${estimate.theta}::double precision,
          ${estimate.standardError}::double precision,
          ${estimate.responseCount}::integer,
          ${estimate.levelId}::integer,
          ${estimate.stopReason}::"AdaptivePracticeQuizStopReason"
        )
      `
    )
  )
}

function adaptiveRepositoryError(message: string, code: string) {
  return new GraphQLError(message, { extensions: { code } })
}
