import type { PrismaTransactionClient } from '@klicker-uzh/util'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '@klicker-uzh/graphql/adaptive-context-types'
import { emitAdaptiveOperationalEvent } from './adaptivePracticeQuizEvents.js'
import {
  isAdaptiveUniqueConstraintConflict,
  isRetryableAdaptiveTransactionConflict,
  waitForAdaptiveTransactionRetry,
} from './adaptiveTransactions.js'

const ADAPTIVE_SERIALIZABLE_TRANSACTION_ATTEMPTS = 3
// Attempt commands run at READ COMMITTED and only contend with the same
// participant's work on one quiz, so a retry is rare; the extra jittered
// attempts absorb lock-ordering deadlocks and duplicate-start races.
const ADAPTIVE_ATTEMPT_TRANSACTION_ATTEMPTS = 5

export type LockedAdaptiveCourse = {
  id: string
  isAdaptiveLearningEnabled: boolean
  deletionRequestedAt: Date | null
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
  publicationId: string
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
  resultStatus?: DB.AdaptiveResultStatus | null
  classificationProbability?: number | null
  credibleLower?: number | null
  credibleUpper?: number | null
  bandProbabilities?: Record<string, number> | null
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

// Participant lifecycle order: Course -> PracticeQuiz -> config ->
// participant-quiz advisory lock -> attempt -> publication exposure rows.
// Administrative rollout prepends User. Quiz deletion inserts direct
// Permission rows before its persisted DerivedPermission authorization check.
export async function lockAdaptiveCourseForShare(
  courseId: string,
  prisma: PrismaTransactionClient
): Promise<LockedAdaptiveCourse | null> {
  const rows = await prisma.$queryRaw<LockedAdaptiveCourse[]>`
    SELECT "id", "isAdaptiveLearningEnabled", "deletionRequestedAt"
    FROM "Course"
    WHERE "id" = ${courseId}::uuid
    FOR SHARE
  `
  return rows[0] ?? null
}

export async function lockAdaptiveCourseForUpdate(
  courseId: string,
  prisma: PrismaTransactionClient
): Promise<LockedAdaptiveCourse | null> {
  const rows = await prisma.$queryRaw<LockedAdaptiveCourse[]>`
    SELECT "id", "isAdaptiveLearningEnabled", "deletionRequestedAt"
    FROM "Course"
    WHERE "id" = ${courseId}::uuid
    FOR UPDATE
  `
  return rows[0] ?? null
}

export async function lockPracticeQuizForShare(
  practiceQuizId: string,
  courseId: string,
  prisma: PrismaTransactionClient
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
  prisma: PrismaTransactionClient
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
  prisma: PrismaTransactionClient
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
  prisma: PrismaTransactionClient
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
  prisma: PrismaTransactionClient
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
  prisma: PrismaTransactionClient
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "AdaptivePracticeQuizAttempt"
    WHERE "id" = ${identity.id}::uuid
      AND "participantId" = ${participantId}::uuid
      AND "courseId" = ${identity.courseId}::uuid
      AND "practiceQuizId" = ${identity.practiceQuizId}::uuid
      AND "configId" = ${identity.configId}::uuid
      AND "publicationId" = ${identity.publicationId}::uuid
    FOR UPDATE
  `
  return Boolean(rows[0])
}

/**
 * Serializes every attempt command of one participant on one quiz (start,
 * resume, restart, submit, abandon, time-limit expiry). Attempt commands run
 * at READ COMMITTED, so after this lock each statement observes everything
 * the participant's previous command committed. Different participants never
 * share this lock, which keeps a whole class starting together conflict-free.
 */
export async function lockAdaptiveParticipantQuizAttempts(
  practiceQuizId: string,
  participantId: string,
  prisma: PrismaTransactionClient
): Promise<void> {
  await prisma.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(
        ${`adaptive-attempt:${practiceQuizId}:${participantId}`},
        0
      )
    )
  `
}

export async function lockPracticeQuizAdminPermissionForShare(
  practiceQuizId: string,
  userId: string,
  prisma: PrismaTransactionClient
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
  prisma: PrismaTransactionClient
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
  prisma: PrismaTransactionClient
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
  prisma: PrismaTransactionClient
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
        "stopReason",
        "resultStatus",
        "classificationProbability",
        "credibleLower",
        "credibleUpper",
        "bandProbabilities"
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
        "stopReason" = EXCLUDED."stopReason",
        "resultStatus" = EXCLUDED."resultStatus",
        "classificationProbability" = EXCLUDED."classificationProbability",
        "credibleLower" = EXCLUDED."credibleLower",
        "credibleUpper" = EXCLUDED."credibleUpper",
        "bandProbabilities" = EXCLUDED."bandProbabilities"
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
          "stopReason",
          "resultStatus",
          "classificationProbability",
          "credibleLower",
          "credibleUpper",
          "bandProbabilities"
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
          "stopReason" = EXCLUDED."stopReason",
          "resultStatus" = EXCLUDED."resultStatus",
          "classificationProbability" = EXCLUDED."classificationProbability",
          "credibleLower" = EXCLUDED."credibleLower",
          "credibleUpper" = EXCLUDED."credibleUpper",
          "bandProbabilities" = EXCLUDED."bandProbabilities"
      `
    )
  }
}

type AdaptiveRetryOptions = {
  retryOnUniqueConstraint?: boolean
  conflictCode?: string
  conflictMessage?: string
  operation?: 'ATTEMPT' | 'COHORT_SNAPSHOT' | 'PUBLICATION'
}

/**
 * Serializable transaction for read-mostly snapshots (cohort results) whose
 * correctness depends on one consistent view of many attempts. Do not use it
 * for participant attempt commands: predicate locks on shared attempt,
 * response and estimate pages make independent attempts abort each other.
 */
export async function withSerializableRetry<T>(
  ctx: ContextWithUser,
  operation: (prisma: PrismaTransactionClient) => Promise<T>,
  options: AdaptiveRetryOptions = {}
): Promise<T> {
  return runAdaptiveTransactionWithRetry(ctx, operation, {
    ...options,
    isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
    maxAttempts: ADAPTIVE_SERIALIZABLE_TRANSACTION_ATTEMPTS,
  })
}

/**
 * READ COMMITTED transaction for participant attempt commands. Correctness for
 * one attempt comes from the explicit lock protocol (course, quiz and config
 * FOR SHARE, the participant-quiz advisory lock, the attempt FOR UPDATE and,
 * for IRT v2, the publication exposure rows FOR UPDATE) and from the
 * one-in-progress and response-order unique indexes, not from SSI.
 */
export async function withAdaptiveAttemptTransaction<T>(
  ctx: ContextWithUser,
  operation: (prisma: PrismaTransactionClient) => Promise<T>,
  options: AdaptiveRetryOptions = {}
): Promise<T> {
  return runAdaptiveTransactionWithRetry(ctx, operation, {
    ...options,
    isolationLevel: DB.Prisma.TransactionIsolationLevel.ReadCommitted,
    maxAttempts: ADAPTIVE_ATTEMPT_TRANSACTION_ATTEMPTS,
  })
}

async function runAdaptiveTransactionWithRetry<T>(
  ctx: ContextWithUser,
  operation: (prisma: PrismaTransactionClient) => Promise<T>,
  {
    retryOnUniqueConstraint = false,
    conflictCode = 'ADAPTIVE_ATTEMPT_CONFLICT',
    conflictMessage = 'The adaptive attempt could not be updated due to concurrent activity.',
    operation: eventOperation = 'ATTEMPT',
    isolationLevel,
    maxAttempts,
  }: AdaptiveRetryOptions & {
    isolationLevel: DB.Prisma.TransactionIsolationLevel
    maxAttempts: number
  }
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await ctx.prisma.$transaction(operation, {
        isolationLevel,
        maxWait: 5_000,
        timeout: 20_000,
      })
    } catch (error) {
      if (
        isRetryableAdaptiveTransactionConflict(error) ||
        (retryOnUniqueConstraint && isAdaptiveUniqueConstraintConflict(error))
      ) {
        if (attempt < maxAttempts - 1) {
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
          ${estimate.stopReason}::"AdaptivePracticeQuizStopReason",
          ${estimate.resultStatus ?? null}::"AdaptiveResultStatus",
          ${estimate.classificationProbability ?? null}::double precision,
          ${estimate.credibleLower ?? null}::double precision,
          ${estimate.credibleUpper ?? null}::double precision,
          ${estimate.bandProbabilities === undefined || estimate.bandProbabilities === null ? null : JSON.stringify(estimate.bandProbabilities)}::jsonb
        )
      `
    )
  )
}

function adaptiveRepositoryError(message: string, code: string) {
  return new GraphQLError(message, { extensions: { code } })
}
