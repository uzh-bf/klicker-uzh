import {
  computeAwardedCorrectnessPoints,
  computeAwardedXp,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  CodeSubmissionReceipt,
  CodeSubmissionResult,
  ElementResultsCode,
  HatchetHandlers,
  SingleQuestionResponseCode,
} from '@klicker-uzh/types'
import {
  CodeApiClientError,
  createCodeApiClient,
  loadCodeApiConfig,
} from '@klicker-uzh/util/code-api'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import { recordCodeQuestionResponse } from './stacks.js'

const CODE_SUBMISSION_MAX_BYTES = 64 * 1_024
const CODE_SUBMISSION_MAX_ATTEMPTS = 3
const CODE_SUBMISSION_CLAIM_MS = 7 * 60 * 1_000
const CODE_SUBMISSION_FINALIZE_MS = 60 * 1_000
const CODE_SUBMISSION_FAILURE_DETAILS_CHARS = 2_048
const CODE_SUBMISSION_RATE_LIMIT_DEFAULT_SECONDS = 30
const CODE_SUBMISSION_RATE_LIMIT_MAX_SECONDS = 5 * 60

type SubmissionRow = DB.CodeSubmission
type CodeSubmissionReader = Pick<DB.Prisma.TransactionClient, 'codeSubmission'>
type CodeSubmissionExecutor = (input: {
  subject: string
  role: string
  studentCode: string
  entrypoint: string
  tests: Extract<
    DB.ElementInstance['elementData'],
    { type: 'CODE' }
  >['options']['testCases']
  perTestTimeoutSeconds: number
}) => Promise<CodeSubmissionResult>

let codeSubmissionExecutor: CodeSubmissionExecutor | undefined

function getCodeSubmissionExecutor(): CodeSubmissionExecutor {
  codeSubmissionExecutor ??=
    createCodeApiClient(loadCodeApiConfig()).executeAndGrade
  return codeSubmissionExecutor
}

function toReceipt(submission: SubmissionRow): CodeSubmissionReceipt {
  const result =
    submission.status === DB.CodeSubmissionStatus.COMPLETED
      ? submission.result
      : null
  return {
    id: submission.id,
    gradingStatus: submission.status,
    feedback: result
      ? {
          pointsPercentage: result.pointsPercentage,
          publicTestResults: result.publicTestResults,
        }
      : null,
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof DB.Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

async function findReusableCodeSubmission({
  prisma,
  participantId,
  elementInstanceId,
  liveQuizId,
  elementBlockExecution,
}: {
  prisma: CodeSubmissionReader
  participantId: string
  elementInstanceId: number
  liveQuizId?: string | null
  elementBlockExecution?: number | null
}) {
  return await prisma.codeSubmission.findFirst({
    where: {
      participantId,
      elementInstanceId,
      ...(liveQuizId
        ? { liveQuizId, elementBlockExecution }
        : { liveQuizId: null }),
      status: {
        in: liveQuizId
          ? [
              DB.CodeSubmissionStatus.PENDING,
              DB.CodeSubmissionStatus.RUNNING,
              DB.CodeSubmissionStatus.COMPLETED,
            ]
          : [DB.CodeSubmissionStatus.PENDING, DB.CodeSubmissionStatus.RUNNING],
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

function validateSubmittedCode(code: string): void {
  if (
    typeof code !== 'string' ||
    code.length === 0 ||
    new TextEncoder().encode(code).byteLength > CODE_SUBMISSION_MAX_BYTES
  ) {
    throw new GraphQLError('CODE submission is too large', {
      extensions: { code: 'BAD_USER_INPUT' },
    })
  }
}

function codeSubmissionUnavailable(): GraphQLError {
  return new GraphQLError('CODE element instance is unavailable', {
    extensions: { code: 'NOT_FOUND' },
  })
}

function claimableCodeSubmissionWhere(
  now: Date
): DB.Prisma.CodeSubmissionWhereInput {
  return {
    claimAttempts: { lt: CODE_SUBMISSION_MAX_ATTEMPTS },
    OR: [
      {
        status: DB.CodeSubmissionStatus.PENDING,
        OR: [{ retryAt: null }, { retryAt: { lte: now } }],
      },
      {
        status: DB.CodeSubmissionStatus.RUNNING,
        claimExpiresAt: { lt: now },
      },
    ],
  }
}

function updateCodeResults({
  previous,
  result,
  configuredTestIds,
}: {
  previous: ElementResultsCode
  result: CodeSubmissionResult
  configuredTestIds: Set<string>
}): ElementResultsCode {
  const allTestResults = [
    ...result.publicTestResults,
    ...result.hiddenTestResults,
  ]
  const resultTestIds = new Set(allTestResults.map(({ id }) => id))
  if (
    allTestResults.length !== configuredTestIds.size ||
    resultTestIds.size !== configuredTestIds.size ||
    allTestResults.some(({ id }) => !configuredTestIds.has(id)) ||
    !Number.isFinite(result.pointsPercentage) ||
    result.pointsPercentage < 0 ||
    result.pointsPercentage > 1
  ) {
    throw new Error('CODE submission results do not match configured tests')
  }

  const tests = Object.fromEntries(
    Object.entries(previous.tests).map(([id, counts]) => [id, { ...counts }])
  )
  for (const testResult of allTestResults) {
    const counts = tests[testResult.id]
    if (!counts) {
      throw new Error('CODE submission result references an unknown test')
    }
    counts.total += 1
    if (testResult.passed) counts.passed += 1
  }

  return { tests, total: previous.total + 1 }
}

type LiveQuizCodeProjection = {
  receiptId: string
  liveQuizId: string
  blockId: number
  blockExecution: number
  instanceId: number
  participantId: string
  isAssessmentEnabled: boolean
  isGamificationEnabled: boolean
  pointsAwarded: number
  xpAwarded: number
  testResults: { id: string; passed: boolean }[]
}

async function recordLiveQuizCodeResponse({
  prisma,
  submission,
  result,
}: {
  prisma: DB.Prisma.TransactionClient
  submission: SubmissionRow
  result: CodeSubmissionResult
}): Promise<LiveQuizCodeProjection> {
  if (!submission.liveQuizId || submission.elementBlockExecution === null) {
    throw new Error('Live Quiz CODE submission scope is invalid')
  }

  const participation = await prisma.participation.findUnique({
    where: { id: submission.participationId },
  })
  if (
    !participation ||
    participation.participantId !== submission.participantId ||
    participation.courseId !== submission.courseId
  ) {
    throw new Error('CODE submission participation is invalid')
  }

  const instance = await prisma.elementInstance.findUnique({
    where: { id: submission.elementInstanceId },
    include: {
      elementBlock: { include: { liveQuiz: true } },
      liveQuizResponses: {
        where: {
          participantId: submission.participantId,
          elementBlockExecution: submission.elementBlockExecution,
        },
        take: 1,
      },
    },
  })
  const block = instance?.elementBlock
  const liveQuiz = block?.liveQuiz
  if (
    !instance ||
    instance.elementType !== DB.ElementType.CODE ||
    instance.elementData.type !== DB.ElementType.CODE ||
    !block ||
    !liveQuiz ||
    liveQuiz.id !== submission.liveQuizId ||
    liveQuiz.courseId !== submission.courseId ||
    block.execution !== submission.elementBlockExecution ||
    !block.startedAt ||
    submission.createdAt < block.startedAt ||
    (block.closedAt && submission.createdAt > block.closedAt)
  ) {
    throw new Error('Live Quiz CODE submission instance is invalid')
  }

  const configuredTestIds = new Set(
    instance.elementData.options.testCases.map(({ id }) => id)
  )
  const allTestResults = [
    ...result.publicTestResults,
    ...result.hiddenTestResults,
  ]
  const existingResponse = instance.liveQuizResponses[0]
  const options = instance.options as {
    basePoints?: boolean
    pointsMultiplier?: number
  }

  const basePoints = options.basePoints ? liveQuiz.defaultPoints : 0
  const xpAwarded = computeAwardedXp({
    pointsPercentage: result.pointsPercentage,
  })
  let correctnessPoints = existingResponse?.correctnessPoints ?? 0
  let bonusPoints = existingResponse?.bonusPoints ?? 0

  if (!existingResponse) {
    const firstCorrectResponse = await prisma.liveQuizResponse.findFirst({
      where: {
        instanceId: instance.id,
        elementBlockExecution: submission.elementBlockExecution,
        correctness: DB.ResponseCorrectness.CORRECT,
      },
      // CODE grading is asynchronous, so submission timestamps can arrive here
      // out of order. The instance row lock serializes finalization; the
      // sequence-backed id is assigned on insertion after that lock and keeps
      // the selected first-correct anchor immutable.
      orderBy: { id: 'asc' },
      select: { submittedAt: true },
    })
    const awardedCorrectness = computeAwardedCorrectnessPoints({
      firstResponseReceivedAt: firstCorrectResponse
        ? String(firstCorrectResponse.submittedAt.getTime())
        : undefined,
      responseTimestamp: submission.createdAt.getTime(),
      maxBonus: liveQuiz.maxBonusPoints,
      timeToZeroBonus: liveQuiz.timeToZeroBonus,
      defaultCorrectPoints: liveQuiz.defaultCorrectPoints,
      pointsPercentage: result.pointsPercentage,
      pointsMultiplier: options.pointsMultiplier,
    })
    correctnessPoints = awardedCorrectness.correctnessPoints
    bonusPoints = awardedCorrectness.bonusPoints

    const previousResults = (
      liveQuiz.isAssessmentEnabled
        ? instance.results
        : instance.anonymousResults
    ) as ElementResultsCode
    const nextResults = updateCodeResults({
      previous: previousResults,
      result,
      configuredTestIds,
    })
    const response: SingleQuestionResponseCode = {
      code: submission.code,
      correctness: result.pointsPercentage,
    }

    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: submission.createdAt,
        response,
        timeSpent: submission.timeSpent,
        correctness:
          result.pointsPercentage === 1
            ? DB.ResponseCorrectness.CORRECT
            : result.pointsPercentage === 0
              ? DB.ResponseCorrectness.WRONG
              : DB.ResponseCorrectness.PARTIAL,
        basePoints,
        correctnessPoints,
        bonusPoints,
        elementBlockExecution: submission.elementBlockExecution,
        instanceId: submission.elementInstanceId,
        participantId: submission.participantId,
      },
    })
    await prisma.elementInstance.update({
      where: { id: submission.elementInstanceId },
      data: liveQuiz.isAssessmentEnabled
        ? { results: nextResults }
        : { anonymousResults: nextResults },
    })
  }

  const pointsAwarded = Math.round(
    (existingResponse?.basePoints ?? basePoints) +
      correctnessPoints +
      bonusPoints
  )

  return {
    receiptId: submission.id,
    liveQuizId: liveQuiz.id,
    blockId: block.id,
    blockExecution: submission.elementBlockExecution,
    instanceId: instance.id,
    participantId: submission.participantId,
    isAssessmentEnabled: liveQuiz.isAssessmentEnabled,
    isGamificationEnabled: liveQuiz.isGamificationEnabled,
    pointsAwarded,
    xpAwarded,
    testResults: allTestResults.map(({ id, passed }) => ({ id, passed })),
  }
}

async function projectLiveQuizCodeResponse({
  redis,
  projection,
}: {
  redis: Pick<Redis, 'eval'>
  projection: LiveQuizCodeProjection
}) {
  const instanceKey = `lq:${projection.liveQuizId}:i:${projection.instanceId}`
  const markerKey = `${instanceKey}:code-submissions:${projection.blockExecution}`
  const resultsKey = `${instanceKey}:results`
  const liveQuizKey = `lq:${projection.liveQuizId}`
  const script = `
    if redis.call('HGET', KEYS[1], 'blockExecution') ~= ARGV[1] then
      return -1
    end
    if redis.call('HEXISTS', KEYS[2], ARGV[2]) == 1 then
      return 0
    end
    redis.call('HSET', KEYS[2], ARGV[2], '1')
    redis.call('EXPIRE', KEYS[2], 86400)
    redis.call('HINCRBY', KEYS[3], 'participants', 1)
    local testCount = tonumber(ARGV[6])
    local offset = 7
    for index = 0, testCount - 1 do
      local testId = ARGV[offset + index * 2]
      local passed = tonumber(ARGV[offset + index * 2 + 1])
      redis.call('HINCRBY', KEYS[3], 'test:' .. testId .. ':total', 1)
      if passed == 1 then
        redis.call('HINCRBY', KEYS[3], 'test:' .. testId .. ':passed', 1)
      end
    end
    if ARGV[5] == '1' then
      redis.call('HINCRBY', KEYS[4], ARGV[3], tonumber(ARGV[4]))
      redis.call('HINCRBY', KEYS[5], ARGV[3], tonumber(ARGV[4]))
      redis.call('HINCRBY', KEYS[6], ARGV[3], tonumber(ARGV[7 + testCount * 2]))
    end
    return 1
  `
  const projectionResult = await redis.eval(
    script,
    6,
    `${instanceKey}:info`,
    markerKey,
    resultsKey,
    `${liveQuizKey}:lb`,
    `${liveQuizKey}:b:${projection.blockId}:lb`,
    `${liveQuizKey}:xp`,
    String(projection.blockExecution),
    projection.receiptId,
    projection.participantId,
    String(projection.pointsAwarded),
    !projection.isAssessmentEnabled || projection.isGamificationEnabled
      ? '1'
      : '0',
    String(projection.testResults.length),
    ...projection.testResults.flatMap(({ id, passed }) => [
      encodeURIComponent(id),
      passed ? '1' : '0',
    ]),
    String(projection.xpAwarded)
  )
  if (projectionResult !== 0 && projectionResult !== 1) {
    throw new Error('Live Quiz CODE cache projection execution is stale')
  }
}

export async function submitCodeResponse(
  {
    instanceId,
    courseId,
    code,
    timeSpent,
  }: {
    instanceId: number
    courseId: string
    code: string
    timeSpent: number
  },
  ctx: ContextWithUser
): Promise<CodeSubmissionReceipt> {
  validateSubmittedCode(code)
  if (!Number.isFinite(timeSpent) || timeSpent < 0) {
    throw new GraphQLError('CODE submission time is invalid', {
      extensions: { code: 'BAD_USER_INPUT' },
    })
  }

  let receipt: CodeSubmissionReceipt
  let liveQuizScope:
    | { liveQuizId: string; elementBlockExecution: number }
    | undefined
  try {
    receipt = await ctx.prisma.$transaction(async (prisma) => {
      const participation = await prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId,
            participantId: ctx.user.sub,
          },
        },
      })
      if (!participation?.isActive) {
        throw codeSubmissionUnavailable()
      }

      const now = new Date()
      const instance = await prisma.elementInstance.findFirst({
        where: {
          id: instanceId,
          elementType: DB.ElementType.CODE,
          OR: [
            {
              elementStack: {
                practiceQuiz: {
                  courseId,
                  isDeleted: false,
                  status: DB.PublicationStatus.PUBLISHED,
                  OR: [
                    { availableFrom: null },
                    { availableFrom: { lte: now } },
                  ],
                },
              },
            },
            {
              elementStack: {
                microLearning: {
                  courseId,
                  isDeleted: false,
                  status: DB.PublicationStatus.PUBLISHED,
                  scheduledStartAt: { lte: now },
                  scheduledEndAt: { gte: now },
                },
              },
            },
            {
              elementBlock: {
                status: DB.ElementBlockStatus.ACTIVE,
                liveQuiz: {
                  courseId,
                  isDeleted: false,
                  status: DB.PublicationStatus.PUBLISHED,
                },
              },
            },
          ],
        },
        include: {
          elementStack: {
            include: {
              practiceQuiz: true,
              microLearning: true,
            },
          },
          elementBlock: { include: { liveQuiz: true } },
        },
      })
      if (!instance || instance.elementData.type !== DB.ElementType.CODE) {
        throw codeSubmissionUnavailable()
      }

      const practiceQuiz = instance.elementStack?.practiceQuiz
      const microLearning = instance.elementStack?.microLearning
      const liveQuiz = instance.elementBlock?.liveQuiz
      const activityCount =
        Number(!!practiceQuiz) + Number(!!microLearning) + Number(!!liveQuiz)
      const activityCourseId =
        practiceQuiz?.courseId ?? microLearning?.courseId ?? liveQuiz?.courseId
      if (activityCount !== 1 || activityCourseId !== courseId) {
        throw codeSubmissionUnavailable()
      }

      if (liveQuiz) {
        const block = instance.elementBlock
        await prisma.$queryRaw`
          SELECT "id"
          FROM "LiveQuiz"
          WHERE "id" = ${liveQuiz.id}::uuid
          FOR UPDATE
        `
        const currentBlock = block
          ? await prisma.elementBlock.findFirst({
              where: {
                id: block.id,
                status: DB.ElementBlockStatus.ACTIVE,
                liveQuiz: {
                  id: liveQuiz.id,
                  courseId,
                  isDeleted: false,
                  status: DB.PublicationStatus.PUBLISHED,
                  activeBlockId: block.id,
                },
              },
            })
          : null
        if (
          !currentBlock ||
          (currentBlock.expiresAt && currentBlock.expiresAt <= now)
        ) {
          throw codeSubmissionUnavailable()
        }
        liveQuizScope = {
          liveQuizId: liveQuiz.id,
          elementBlockExecution: currentBlock.execution,
        }
      }

      if (microLearning) {
        const priorResponse = await prisma.questionResponse.findUnique({
          where: {
            participantId_elementInstanceId: {
              participantId: ctx.user.sub,
              elementInstanceId: instanceId,
            },
          },
          select: { id: true },
        })
        if (priorResponse) {
          throw new GraphQLError(
            'This microlearning CODE question is already closed',
            { extensions: { code: 'BAD_USER_INPUT' } }
          )
        }
      }

      const existing = await findReusableCodeSubmission({
        prisma,
        participantId: ctx.user.sub,
        elementInstanceId: instanceId,
        liveQuizId: liveQuizScope?.liveQuizId,
        elementBlockExecution: liveQuizScope?.elementBlockExecution,
      })
      if (existing) return toReceipt(existing)

      const created = await prisma.codeSubmission.create({
        data: {
          code,
          timeSpent,
          participantId: ctx.user.sub,
          participationId: participation.id,
          elementInstanceId: instance.id,
          practiceQuizId: practiceQuiz?.id,
          microLearningId: microLearning?.id,
          liveQuizId: liveQuizScope?.liveQuizId,
          elementBlockExecution: liveQuizScope?.elementBlockExecution,
          courseId,
        },
      })
      return toReceipt(created)
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const concurrent = await findReusableCodeSubmission({
      prisma: ctx.prisma,
      participantId: ctx.user.sub,
      elementInstanceId: instanceId,
      liveQuizId: liveQuizScope?.liveQuizId,
      elementBlockExecution: liveQuizScope?.elementBlockExecution,
    })
    if (!concurrent) throw error
    receipt = toReceipt(concurrent)
  }

  if (receipt.gradingStatus === DB.CodeSubmissionStatus.COMPLETED) {
    return receipt
  }

  try {
    await ctx.tasks.gradeCodeSubmission.runNoWait({
      submissionId: receipt.id,
    })
  } catch {
    await ctx.prisma.codeSubmission.updateMany({
      where: {
        id: receipt.id,
        status: DB.CodeSubmissionStatus.PENDING,
        claimAttempts: 0,
      },
      data: {
        failureCode: 'ENQUEUE_FAILED',
        failureDetails: 'CODE submission awaits recovery dispatch',
      },
    })
  }

  return receipt
}

export async function getCodeSubmission(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<CodeSubmissionReceipt | null> {
  const submission = await ctx.prisma.codeSubmission.findFirst({
    where: {
      id,
      participantId: ctx.user.sub,
    },
  })
  return submission ? toReceipt(submission) : null
}

async function claimCodeSubmission({
  submissionId,
  prisma,
  now,
}: {
  submissionId: string
  prisma: DB.PrismaClient
  now: Date
}) {
  const claimToken = randomUUID()
  const claimed = await prisma.codeSubmission.updateMany({
    where: {
      id: submissionId,
      ...claimableCodeSubmissionWhere(now),
    },
    data: {
      status: DB.CodeSubmissionStatus.RUNNING,
      claimToken,
      claimExpiresAt: new Date(now.getTime() + CODE_SUBMISSION_CLAIM_MS),
      claimAttempts: { increment: 1 },
      failureCode: null,
      failureDetails: null,
      failedAt: null,
      retryAt: null,
    },
  })
  if (claimed.count !== 1) return null
  return await prisma.codeSubmission.findFirst({
    where: { id: submissionId, claimToken },
    include: { elementInstance: true },
  })
}

async function finalizeCodeSubmission({
  submission,
  claimToken,
  result,
  prisma,
  redisExec,
  redisAssessmentExec,
}: {
  submission: SubmissionRow
  claimToken: string
  result: CodeSubmissionResult
  prisma: DB.PrismaClient
  redisExec: Redis
  redisAssessmentExec: Redis
}) {
  if (submission.liveQuizId) {
    const projection = await prisma.$transaction(async (transaction) => {
      const locked = await transaction.codeSubmission.updateMany({
        where: {
          id: submission.id,
          status: DB.CodeSubmissionStatus.RUNNING,
          claimToken,
        },
        data: {
          claimExpiresAt: new Date(Date.now() + CODE_SUBMISSION_FINALIZE_MS),
          result,
        },
      })
      if (locked.count !== 1) return null

      await transaction.$queryRaw`
        SELECT "id"
        FROM "ElementInstance"
        WHERE "id" = ${submission.elementInstanceId}
        FOR UPDATE
      `
      return await recordLiveQuizCodeResponse({
        prisma: transaction,
        submission,
        result,
      })
    })
    if (!projection) return null

    // Keep the external Redis projection outside the database transaction. If
    // this call fails, the RUNNING receipt remains recoverable; a retry sees
    // the existing LiveQuizResponse and the receipt marker makes projection
    // idempotent.
    await projectLiveQuizCodeResponse({
      redis: projection.isAssessmentEnabled ? redisAssessmentExec : redisExec,
      projection,
    })

    return await prisma.$transaction(async (transaction) => {
      const completed = await transaction.codeSubmission.updateMany({
        where: {
          id: submission.id,
          status: DB.CodeSubmissionStatus.RUNNING,
          claimToken,
        },
        data: {
          status: DB.CodeSubmissionStatus.COMPLETED,
          result,
          completedAt: new Date(),
          claimToken: null,
          claimExpiresAt: null,
          failureCode: null,
          failureDetails: null,
          failedAt: null,
          retryAt: null,
        },
      })
      if (completed.count !== 1) {
        throw new Error('CODE submission claim was lost during finalization')
      }
      return await transaction.codeSubmission.findUniqueOrThrow({
        where: { id: submission.id },
      })
    })
  }

  return await prisma.$transaction(async (transaction) => {
    const locked = await transaction.codeSubmission.updateMany({
      where: {
        id: submission.id,
        status: DB.CodeSubmissionStatus.RUNNING,
        claimToken,
      },
      data: {
        claimExpiresAt: new Date(Date.now() + CODE_SUBMISSION_FINALIZE_MS),
      },
    })
    if (locked.count !== 1) return null

    await transaction.$queryRaw`
      SELECT "id"
      FROM "ElementInstance"
      WHERE "id" = ${submission.elementInstanceId}
      FOR UPDATE
    `
    await recordCodeQuestionResponse({
      prisma: transaction,
      submission,
      result,
    })
    const completed = await transaction.codeSubmission.updateMany({
      where: {
        id: submission.id,
        status: DB.CodeSubmissionStatus.RUNNING,
        claimToken,
      },
      data: {
        status: DB.CodeSubmissionStatus.COMPLETED,
        result,
        completedAt: new Date(),
        claimToken: null,
        claimExpiresAt: null,
        failureCode: null,
        failureDetails: null,
        failedAt: null,
        retryAt: null,
      },
    })
    if (completed.count !== 1) {
      throw new Error('CODE submission claim was lost during finalization')
    }
    return await transaction.codeSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    })
  })
}

function failureMetadata(error: unknown) {
  const code =
    error instanceof CodeApiClientError
      ? `CODEAPI_${error.kind.toUpperCase()}`
      : 'GRADING_FAILED'
  const details =
    error instanceof Error ? error.message : 'CODE submission grading failed'
  return {
    code,
    details: details.slice(0, CODE_SUBMISSION_FAILURE_DETAILS_CHARS),
  }
}

function rateLimitRetryAt(error: unknown, now: Date): Date | null {
  if (!(error instanceof CodeApiClientError) || error.kind !== 'rate_limit') {
    return null
  }
  const delaySeconds = Math.min(
    Math.max(
      error.retryAfterSeconds ?? CODE_SUBMISSION_RATE_LIMIT_DEFAULT_SECONDS,
      1
    ),
    CODE_SUBMISSION_RATE_LIMIT_MAX_SECONDS
  )
  return new Date(now.getTime() + delaySeconds * 1_000)
}

async function releaseOrFailCodeSubmission({
  submission,
  claimToken,
  error,
  now,
  prisma,
}: {
  submission: SubmissionRow
  claimToken: string
  error: unknown
  now: Date
  prisma: DB.PrismaClient
}) {
  const failure = failureMetadata(error)
  const retryAt = rateLimitRetryAt(error, now)
  const deferred = retryAt !== null
  const persistedLiveQuizResult = submission.liveQuizId
    ? await prisma.codeSubmission.findUnique({
        where: { id: submission.id },
        select: { result: true },
      })
    : null
  const projectionPending = !!persistedLiveQuizResult?.result
  const exhausted =
    !projectionPending &&
    !deferred &&
    submission.claimAttempts >= CODE_SUBMISSION_MAX_ATTEMPTS
  const updated = await prisma.codeSubmission.updateMany({
    where: {
      id: submission.id,
      status: DB.CodeSubmissionStatus.RUNNING,
      claimToken,
    },
    data: projectionPending
      ? {
          status: DB.CodeSubmissionStatus.PENDING,
          claimAttempts: 0,
          failureCode: failure.code,
          failureDetails: failure.details,
          claimToken: null,
          claimExpiresAt: null,
          retryAt: null,
        }
      : deferred
        ? {
            status: DB.CodeSubmissionStatus.PENDING,
            claimAttempts: { decrement: 1 },
            failureCode: failure.code,
            failureDetails: failure.details,
            claimToken: null,
            claimExpiresAt: null,
            retryAt,
          }
        : exhausted
          ? {
              status: DB.CodeSubmissionStatus.FAILED,
              failureCode: failure.code,
              failureDetails: failure.details,
              failedAt: now,
              claimToken: null,
              claimExpiresAt: null,
              retryAt: null,
            }
          : {
              status: DB.CodeSubmissionStatus.PENDING,
              failureCode: failure.code,
              failureDetails: failure.details,
              claimToken: null,
              claimExpiresAt: null,
              retryAt,
            },
  })
  if (updated.count !== 1) {
    return { kind: 'retry' } as const
  }
  if (projectionPending) return { kind: 'retry' } as const
  if (deferred) return { kind: 'deferred' } as const
  if (!exhausted) return { kind: 'retry' } as const
  return {
    kind: 'failed',
    submission: await prisma.codeSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    }),
  } as const
}

export async function processCodeSubmission(
  {
    submissionId,
  }: {
    submissionId: string
  },
  globalCtx: Parameters<HatchetHandlers['handleGradeCodeSubmission']>[1],
  executor: CodeSubmissionExecutor = getCodeSubmissionExecutor()
): Promise<boolean> {
  const claimed = await claimCodeSubmission({
    submissionId,
    prisma: globalCtx.prisma,
    now: new Date(),
  })
  if (!claimed?.claimToken) return false

  try {
    if (
      claimed.elementInstance.elementType !== DB.ElementType.CODE ||
      claimed.elementInstance.elementData.type !== DB.ElementType.CODE
    ) {
      throw new Error('CODE submission element instance is invalid')
    }
    const options = claimed.elementInstance.elementData.options
    const result =
      claimed.result ??
      (await executor({
        subject: claimed.participantId,
        role: DB.UserRole.PARTICIPANT,
        studentCode: claimed.code,
        entrypoint: options.entrypoint,
        tests: options.testCases,
        perTestTimeoutSeconds: options.executionLimits.perTestTimeoutSeconds,
      }))
    const completed = await finalizeCodeSubmission({
      submission: claimed,
      claimToken: claimed.claimToken,
      result,
      prisma: globalCtx.prisma,
      redisExec: globalCtx.redisExec,
      redisAssessmentExec: globalCtx.redisAssessmentExec,
    })
    if (!completed) return false
    globalCtx.pubSub.publish('codeSubmissionUpdated', {
      participantId: completed.participantId,
      receipt: toReceipt(completed),
    })
    return true
  } catch (error) {
    const outcome = await releaseOrFailCodeSubmission({
      submission: claimed,
      claimToken: claimed.claimToken,
      error,
      now: new Date(),
      prisma: globalCtx.prisma,
    })
    if (outcome.kind === 'failed') {
      globalCtx.pubSub.publish('codeSubmissionUpdated', {
        participantId: outcome.submission.participantId,
        receipt: toReceipt(outcome.submission),
      })
      return false
    }
    if (outcome.kind === 'deferred') return false
    throw error
  }
}

export const handleGradeCodeSubmission: HatchetHandlers['handleGradeCodeSubmission'] =
  async (input, globalCtx) => {
    return await processCodeSubmission(input, globalCtx)
  }

export const handleRecoverCodeSubmissions: HatchetHandlers['handleRecoverCodeSubmissions'] =
  async (_, globalCtx) => {
    const now = new Date()
    const exhausted = await globalCtx.prisma.codeSubmission.findMany({
      where: {
        status: DB.CodeSubmissionStatus.RUNNING,
        claimAttempts: { gte: CODE_SUBMISSION_MAX_ATTEMPTS },
        claimExpiresAt: { lt: now },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
        id: true,
        participantId: true,
        claimToken: true,
        liveQuizId: true,
        result: true,
      },
    })
    for (const submission of exhausted) {
      if (submission.liveQuizId && submission.result) {
        await globalCtx.prisma.codeSubmission.updateMany({
          where: {
            id: submission.id,
            status: DB.CodeSubmissionStatus.RUNNING,
            claimToken: submission.claimToken,
            claimExpiresAt: { lt: now },
          },
          data: {
            status: DB.CodeSubmissionStatus.PENDING,
            claimAttempts: 0,
            failureCode: 'CACHE_PROJECTION_RECOVERY',
            failureDetails: 'Recovering the Live Quiz CODE cache projection',
            claimToken: null,
            claimExpiresAt: null,
            retryAt: null,
          },
        })
        continue
      }

      const updated = await globalCtx.prisma.codeSubmission.updateMany({
        where: {
          id: submission.id,
          status: DB.CodeSubmissionStatus.RUNNING,
          claimToken: submission.claimToken,
          claimExpiresAt: { lt: now },
        },
        data: {
          status: DB.CodeSubmissionStatus.FAILED,
          failureCode: 'GRADING_ATTEMPTS_EXHAUSTED',
          failureDetails: 'CODE submission grading attempts were exhausted',
          failedAt: now,
          claimToken: null,
          claimExpiresAt: null,
          retryAt: null,
        },
      })
      if (updated.count === 1) {
        globalCtx.pubSub.publish('codeSubmissionUpdated', {
          participantId: submission.participantId,
          receipt: {
            id: submission.id,
            gradingStatus: DB.CodeSubmissionStatus.FAILED,
            feedback: null,
          },
        })
      }
    }

    const recoverable = await globalCtx.prisma.codeSubmission.findMany({
      where: claimableCodeSubmissionWhere(now),
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true },
    })
    return recoverable.map(({ id }) => id)
  }
