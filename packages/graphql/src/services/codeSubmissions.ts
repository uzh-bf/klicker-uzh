import * as DB from '@klicker-uzh/prisma/client'
import type {
  CodeSubmissionReceipt,
  CodeSubmissionResult,
  HatchetHandlers,
} from '@klicker-uzh/types'
import {
  CodeApiClientError,
  createCodeApiClient,
  loadCodeApiConfig,
} from '@klicker-uzh/util/code-api'
import { GraphQLError } from 'graphql'
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

async function findActiveCodeSubmission({
  prisma,
  participantId,
  elementInstanceId,
}: {
  prisma: CodeSubmissionReader
  participantId: string
  elementInstanceId: number
}) {
  return await prisma.codeSubmission.findFirst({
    where: {
      participantId,
      elementInstanceId,
      status: {
        in: [DB.CodeSubmissionStatus.PENDING, DB.CodeSubmissionStatus.RUNNING],
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
  try {
    receipt = await ctx.prisma.$transaction(async (prisma) => {
      const instance = await prisma.elementInstance.findUnique({
        where: { id: instanceId },
        include: {
          elementStack: {
            include: {
              practiceQuiz: true,
              microLearning: true,
            },
          },
        },
      })
      if (
        !instance ||
        instance.elementType !== DB.ElementType.CODE ||
        instance.elementData.type !== DB.ElementType.CODE
      ) {
        throw new GraphQLError('CODE element instance not found', {
          extensions: { code: 'NOT_FOUND' },
        })
      }

      const practiceQuiz = instance.elementStack?.practiceQuiz
      const microLearning = instance.elementStack?.microLearning
      const activityCount = Number(!!practiceQuiz) + Number(!!microLearning)
      const activityCourseId = practiceQuiz?.courseId ?? microLearning?.courseId
      if (activityCount !== 1 || activityCourseId !== courseId) {
        throw new GraphQLError(
          'CODE element instance is not part of this course',
          { extensions: { code: 'FORBIDDEN' } }
        )
      }
      const now = Date.now()
      if (
        (practiceQuiz &&
          (practiceQuiz.isDeleted ||
            practiceQuiz.status !== DB.PublicationStatus.PUBLISHED ||
            (practiceQuiz.availableFrom &&
              now < practiceQuiz.availableFrom.getTime()))) ||
        (microLearning &&
          (microLearning.isDeleted ||
            microLearning.status !== DB.PublicationStatus.PUBLISHED ||
            now < microLearning.scheduledStartAt.getTime() ||
            now > microLearning.scheduledEndAt.getTime()))
      ) {
        throw new GraphQLError('This CODE question is not available', {
          extensions: { code: 'BAD_USER_INPUT' },
        })
      }

      const participation = await prisma.participation.findUnique({
        where: {
          courseId_participantId: {
            courseId,
            participantId: ctx.user.sub,
          },
        },
      })
      if (!participation?.isActive) {
        throw new GraphQLError('Participant is not enrolled in this course', {
          extensions: { code: 'FORBIDDEN' },
        })
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

      const existing = await findActiveCodeSubmission({
        prisma,
        participantId: ctx.user.sub,
        elementInstanceId: instanceId,
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
          courseId,
        },
      })
      return toReceipt(created)
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const concurrent = await findActiveCodeSubmission({
      prisma: ctx.prisma,
      participantId: ctx.user.sub,
      elementInstanceId: instanceId,
    })
    if (!concurrent) throw error
    receipt = toReceipt(concurrent)
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
}: {
  submission: SubmissionRow
  claimToken: string
  result: CodeSubmissionResult
  prisma: DB.PrismaClient
}) {
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
  const exhausted = submission.claimAttempts >= CODE_SUBMISSION_MAX_ATTEMPTS
  const failure = failureMetadata(error)
  const retryAt = rateLimitRetryAt(error, now)
  const updated = await prisma.codeSubmission.updateMany({
    where: {
      id: submission.id,
      status: DB.CodeSubmissionStatus.RUNNING,
      claimToken,
    },
    data: exhausted
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
  if (!exhausted && retryAt) {
    return { kind: 'deferred' } as const
  }
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
    const result = await executor({
      subject: claimed.participantId,
      role: DB.UserRole.PARTICIPANT,
      studentCode: claimed.code,
      entrypoint: options.entrypoint,
      tests: options.testCases,
      perTestTimeoutSeconds: options.executionLimits.perTestTimeoutSeconds,
    })
    const completed = await finalizeCodeSubmission({
      submission: claimed,
      claimToken: claimed.claimToken,
      result,
      prisma: globalCtx.prisma,
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
      },
    })
    for (const submission of exhausted) {
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
      where: {
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
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: { id: true },
    })
    return recoverable.map(({ id }) => id)
  }
