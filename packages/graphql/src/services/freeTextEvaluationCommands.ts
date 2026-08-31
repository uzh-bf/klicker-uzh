import { randomUUID } from 'node:crypto'
import {
  getDefaultFreeTextOutcomeBands,
  mapFreeTextOutcome,
  matchesAcceptedExactAnswer,
  normalizeFreeTextAnswer,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type { ElementOptionsFreeText } from '@klicker-uzh/types'
import type { ContextWithUser } from '@/lib/context.js'
import { v5 as uuidv5 } from 'uuid'
import { resolveFreeTextAttemptUnavailability } from './freeTextEvaluationFallback.js'
import {
  assertParticipant,
  evaluationAvailabilityReason,
  type FreeTextEvaluationServiceOptions,
  freeTextEvaluationError,
  getConsentDecision,
  getDisclosureVersion,
  getSemanticEvaluationDisclosureVersion,
  getSemanticFreeTextConfigHash,
  getSemanticInstance,
  isUniqueConstraintError,
  ownerHasCatalyst,
} from './freeTextEvaluationPolicy.js'
import {
  createCycle,
  getActiveOrCreateCycle,
  loadCycleState,
} from './freeTextEvaluationState.js'
import {
  markConsentRequiredAttemptsDeclinedInTransaction,
  retryFreeTextAttemptInTransaction,
  revealFreeTextSolutionInTransaction,
} from './freeTextEvaluationTransitions.js'
import { applyEvaluatedFreeTextAttemptInTransaction } from './freeTextPracticeResponseApplication.js'

// Absolute ceiling for participant free-text answers on semantic elements,
// independent of the lecturer-configured maxLength.
const MAX_SEMANTIC_ANSWER_LENGTH = 10_000
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function assertValidFreeTextAttemptInput({
  answer,
  answerTime,
  clientSubmissionId,
}: Pick<
  CreateFreeTextAttemptInput,
  'answer' | 'answerTime' | 'clientSubmissionId'
>) {
  assertValidFreeTextAnswerInput({ answer, answerTime })
  if (!UUID_PATTERN.test(clientSubmissionId)) {
    throw freeTextEvaluationError(
      'Client submission ID must be a UUID',
      'BAD_USER_INPUT'
    )
  }
}

export function assertValidFreeTextAnswerInput({
  answer,
  answerTime,
}: Pick<CreateFreeTextAttemptInput, 'answer' | 'answerTime'>) {
  if (!answer.trim()) {
    throw freeTextEvaluationError('Answer must not be empty', 'BAD_USER_INPUT')
  }
  if (!Number.isFinite(answerTime) || answerTime < 0) {
    throw freeTextEvaluationError(
      'Answer time must be a non-negative finite number',
      'BAD_USER_INPUT'
    )
  }
  if (answer.length > MAX_SEMANTIC_ANSWER_LENGTH) {
    throw freeTextEvaluationError(
      'Answer exceeds the maximum allowed length',
      'BAD_USER_INPUT'
    )
  }
}

export function assertConfiguredFreeTextAnswerLength({
  answer,
  maxLength,
}: {
  answer: string
  maxLength?: number | null
}) {
  if (typeof maxLength === 'number' && answer.length > maxLength) {
    throw freeTextEvaluationError(
      'Answer exceeds the configured maximum length',
      'BAD_USER_INPUT'
    )
  }
}

export function getLocalExactFreeTextSubmissionId({
  cycleId,
  answer,
}: {
  cycleId: string
  answer: string
}) {
  return uuidv5(
    ['klicker-semantic-legacy', cycleId, normalizeFreeTextAnswer(answer)].join(
      ':'
    ),
    uuidv5.URL
  )
}

async function scheduleAttempt(
  attempt: DB.FreeTextAttempt,
  ctx: ContextWithUser
) {
  const schedulingClaim = `scheduling:${randomUUID()}`
  const claimed = await ctx.prisma.freeTextAttempt.updateMany({
    where: {
      id: attempt.id,
      evaluationRevision: attempt.evaluationRevision,
      workflowRunId: null,
      OR: [
        { evaluationStatus: DB.FreeTextEvaluationStatus.PENDING },
        {
          evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
          questionResponseDetailId: null,
        },
      ],
    },
    data: { workflowRunId: schedulingClaim },
  })
  if (claimed.count !== 1) return false

  try {
    const run = await ctx.tasks.evaluateFreeTextAttempt.runNoWait({
      attemptId: attempt.id,
      evaluationRevision: attempt.evaluationRevision,
    })
    const workflowRunId = await run.getWorkflowRunId()
    const scheduled = await ctx.prisma.freeTextAttempt.updateMany({
      where: {
        id: attempt.id,
        evaluationRevision: attempt.evaluationRevision,
        workflowRunId: schedulingClaim,
      },
      data: { workflowRunId },
    })
    return scheduled.count === 1
  } catch (error) {
    await ctx.prisma.freeTextAttempt.updateMany({
      where: {
        id: attempt.id,
        evaluationRevision: attempt.evaluationRevision,
        workflowRunId: schedulingClaim,
      },
      data: { workflowRunId: null },
    })
    throw error
  }
}

async function schedulePendingAttempt(
  attempt: DB.FreeTextAttempt,
  ctx: ContextWithUser
) {
  try {
    await scheduleAttempt(attempt, ctx)
  } catch (error) {
    console.error(
      `Failed to schedule pending free-text attempt ${attempt.id}:`,
      error
    )
    await resolveFreeTextAttemptUnavailability(
      {
        attemptId: attempt.id,
        evaluationRevision: attempt.evaluationRevision,
        reason: 'SCHEDULING_FAILED',
        retryable: true,
      },
      ctx.prisma
    )
  }
}

async function resumeAttemptIfNeeded(
  attempt: DB.FreeTextAttempt,
  ctx: ContextWithUser
) {
  if (attempt.workflowRunId !== null) return
  if (attempt.evaluationStatus === DB.FreeTextEvaluationStatus.PENDING) {
    await schedulePendingAttempt(attempt, ctx)
  } else if (
    attempt.evaluationStatus === DB.FreeTextEvaluationStatus.EVALUATED &&
    attempt.questionResponseDetailId === null
  ) {
    await scheduleAttempt(attempt, ctx)
  }
}

export type CreateFreeTextAttemptInput = {
  instanceId: number
  answer: string
  answerTime: number
  clientSubmissionId: string
}

export type CreateLocalExactFreeTextAttemptInput = Omit<
  CreateFreeTextAttemptInput,
  'clientSubmissionId'
>

type InternalCreateFreeTextAttemptInput =
  CreateLocalExactFreeTextAttemptInput & {
    clientSubmissionId?: string
  }

type InternalCreateFreeTextAttemptOptions = FreeTextEvaluationServiceOptions & {
  localExactOnly?: boolean
}

export async function createFreeTextAttempt(
  input: CreateFreeTextAttemptInput,
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  assertValidFreeTextAttemptInput(input)
  return await createFreeTextAttemptInternal(input, ctx, options)
}

export async function createLocalExactFreeTextAttempt(
  input: CreateLocalExactFreeTextAttemptInput,
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  assertValidFreeTextAnswerInput(input)
  return await createFreeTextAttemptInternal(input, ctx, {
    ...options,
    localExactOnly: true,
  })
}

async function createFreeTextAttemptInternal(
  {
    instanceId,
    answer,
    answerTime,
    clientSubmissionId: suppliedClientSubmissionId,
  }: InternalCreateFreeTextAttemptInput,
  ctx: ContextWithUser,
  options?: InternalCreateFreeTextAttemptOptions
) {
  const semanticInstance = await getSemanticInstance(instanceId, ctx)
  const freeTextOptions = semanticInstance.instance.elementData
    .options as ElementOptionsFreeText
  const maxLength = freeTextOptions.restrictions?.maxLength
  assertConfiguredFreeTextAnswerLength({ answer, maxLength })
  let cycle: Awaited<ReturnType<typeof getActiveOrCreateCycle>>
  let clientSubmissionId: string
  if (options?.localExactOnly) {
    const activeCycle = await ctx.prisma.freeTextPracticeCycle.findFirst({
      where: {
        participantId: ctx.user.sub,
        elementInstanceId: instanceId,
        status: DB.FreeTextPracticeCycleStatus.ACTIVE,
      },
      orderBy: { ordinal: 'desc' },
    })
    if (!activeCycle) {
      const priorCompatibilityAttempts =
        await ctx.prisma.freeTextAttempt.findMany({
          where: {
            availabilityReason: 'CLIENT_SUBMISSION_ID_UNAVAILABLE',
            cycle: {
              participantId: ctx.user.sub,
              elementInstanceId: instanceId,
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      const priorReplay = priorCompatibilityAttempts.find(
        (attempt) =>
          normalizeFreeTextAnswer(attempt.answer) ===
          normalizeFreeTextAnswer(answer)
      )
      if (priorReplay) {
        return await loadCycleState(priorReplay.cycleId, ctx, options)
      }
    }
    cycle = activeCycle ?? (await getActiveOrCreateCycle(semanticInstance, ctx))
    clientSubmissionId = getLocalExactFreeTextSubmissionId({
      cycleId: cycle.id,
      answer,
    })
  } else {
    clientSubmissionId = suppliedClientSubmissionId!
    const priorDuplicate = await ctx.prisma.freeTextAttempt.findFirst({
      where: {
        clientSubmissionId,
        cycle: {
          participantId: ctx.user.sub,
          elementInstanceId: instanceId,
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (priorDuplicate) {
      await resumeAttemptIfNeeded(priorDuplicate, ctx)
      return await loadCycleState(priorDuplicate.cycleId, ctx, options)
    }
    cycle = await getActiveOrCreateCycle(semanticInstance, ctx)
  }
  const duplicate = await ctx.prisma.freeTextAttempt.findUnique({
    where: {
      cycleId_clientSubmissionId: { cycleId: cycle.id, clientSubmissionId },
    },
  })
  if (duplicate) {
    if (!options?.localExactOnly) {
      await resumeAttemptIfNeeded(duplicate, ctx)
    }
    return await loadCycleState(cycle.id, ctx, options)
  }

  const config = semanticInstance.config
  const rubricHash = getSemanticFreeTextConfigHash(config)
  const exactMatch = matchesAcceptedExactAnswer({
    response: answer,
    acceptedExactAnswers: config.accepted_exact_answers,
  })
  const disclosureVersion = getDisclosureVersion(options)
  const consent = options?.localExactOnly
    ? null
    : await getConsentDecision(ctx.user.sub, disclosureVersion, ctx)
  const unavailableReason = options?.localExactOnly
    ? 'CLIENT_SUBMISSION_ID_UNAVAILABLE'
    : evaluationAvailabilityReason({
        ownerEntitled: ownerHasCatalyst(semanticInstance.practiceQuiz),
        consent: consent?.decision ?? null,
      })
  const exactMatchFallback = unavailableReason !== null && exactMatch
  const fallbackScore = 100
  const bands =
    config.outcome_bands ??
    getDefaultFreeTextOutcomeBands(config.question_language)
  const exactBand = exactMatchFallback
    ? mapFreeTextOutcome({ score: fallbackScore, outcomeBands: bands })
    : null
  const fallbackCompletedAt = unavailableReason ? new Date() : null
  let attempt: DB.FreeTextAttempt
  let createdAttempt = false
  try {
    const result = await ctx.prisma.$transaction(async (tx) => {
      const lockedCycles = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "FreeTextPracticeCycle"
        WHERE "id" = ${cycle.id}
        FOR UPDATE
      `
      if (!lockedCycles[0]) {
        throw freeTextEvaluationError(
          'Free-text practice cycle not found',
          'NOT_FOUND'
        )
      }

      const racedDuplicate = await tx.freeTextAttempt.findUnique({
        where: {
          cycleId_clientSubmissionId: {
            cycleId: cycle.id,
            clientSubmissionId,
          },
        },
      })
      if (racedDuplicate) {
        return { attempt: racedDuplicate, created: false }
      }

      const [lockedCycle, currentAttempt, submissionCount] = await Promise.all([
        tx.freeTextPracticeCycle.findUnique({ where: { id: cycle.id } }),
        tx.freeTextAttempt.findFirst({
          where: { cycleId: cycle.id },
          orderBy: { ordinal: 'desc' },
        }),
        tx.freeTextAttempt.count({ where: { cycleId: cycle.id } }),
      ])
      if (
        !lockedCycle ||
        lockedCycle.status !== DB.FreeTextPracticeCycleStatus.ACTIVE
      ) {
        throw freeTextEvaluationError(
          'Free-text practice cycle is no longer active',
          'FREE_TEXT_EVALUATION_INVALID_STATE'
        )
      }
      if (
        currentAttempt?.evaluationStatus === DB.FreeTextEvaluationStatus.PENDING
      ) {
        throw freeTextEvaluationError(
          'Retry the current free-text evaluation before answering',
          'FREE_TEXT_EVALUATION_INVALID_STATE'
        )
      }
      if (submissionCount >= lockedCycle.attemptLimit) {
        throw freeTextEvaluationError(
          'Free-text attempt limit reached',
          'FREE_TEXT_ATTEMPT_LIMIT_REACHED'
        )
      }

      const unavailableAtLimit =
        unavailableReason !== null &&
        !exactMatchFallback &&
        submissionCount + 1 >= lockedCycle.attemptLimit
      const created = await tx.freeTextAttempt.create({
        data: {
          cycleId: cycle.id,
          ordinal: submissionCount + 1,
          clientSubmissionId,
          answer,
          answerTime,
          rubricSchemaVersion: config.rubric_schema.schema_version,
          rubricSchemaHash: rubricHash,
          evaluationStatus: exactMatchFallback
            ? DB.FreeTextEvaluationStatus.EVALUATED
            : unavailableReason
              ? DB.FreeTextEvaluationStatus.UNAVAILABLE
              : DB.FreeTextEvaluationStatus.PENDING,
          evaluationSource: exactMatchFallback
            ? DB.FreeTextEvaluationSource.EXACT_MATCH
            : null,
          retryable:
            !unavailableAtLimit &&
            !exactMatchFallback &&
            unavailableReason !== null,
          availabilityReason: unavailableReason,
          completedAt: fallbackCompletedAt,
          aggregateScore: exactMatchFallback ? fallbackScore : null,
          outcomeBandId: exactBand?.id,
          outcomeBandLabel: exactBand?.label,
          correctness: exactBand?.category ?? null,
        },
      })
      const transitioned = await tx.freeTextPracticeCycle.updateMany({
        where: {
          id: cycle.id,
          status: DB.FreeTextPracticeCycleStatus.ACTIVE,
        },
        data: exactMatchFallback
          ? {
              status: DB.FreeTextPracticeCycleStatus.CORRECT,
              endedAt: fallbackCompletedAt,
              bestScore: Math.max(lockedCycle.bestScore, fallbackScore),
              stateVersion: { increment: 1 },
            }
          : unavailableAtLimit
            ? {
                status: DB.FreeTextPracticeCycleStatus.UNAVAILABLE,
                endedAt: new Date(),
                stateVersion: { increment: 1 },
              }
            : { stateVersion: { increment: 1 } },
      })
      if (transitioned.count !== 1) {
        throw freeTextEvaluationError(
          'Free-text practice cycle is no longer active',
          'FREE_TEXT_EVALUATION_INVALID_STATE'
        )
      }
      if (exactMatchFallback) {
        const responseApplied =
          await applyEvaluatedFreeTextAttemptInTransaction(
            { attemptId: created.id, bumpStateVersion: false },
            tx
          )
        if (!responseApplied) {
          throw new Error(
            'Exact-match evaluation could not apply its response atomically'
          )
        }
      }
      return { attempt: created, created: true }
    })
    attempt = result.attempt
    createdAttempt = result.created
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const racedDuplicate = await ctx.prisma.freeTextAttempt.findUnique({
      where: {
        cycleId_clientSubmissionId: {
          cycleId: cycle.id,
          clientSubmissionId,
        },
      },
    })
    if (racedDuplicate) {
      return await loadCycleState(cycle.id, ctx, options)
    }
    throw error
  }

  if (!createdAttempt && !options?.localExactOnly) {
    await resumeAttemptIfNeeded(attempt, ctx)
  } else if (!unavailableReason) {
    await schedulePendingAttempt(attempt, ctx)
  }

  return await loadCycleState(cycle.id, ctx, options)
}

export async function getFreeTextPracticeState(
  { instanceId }: { instanceId: number },
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  await getSemanticInstance(instanceId, ctx)
  const cycle = await ctx.prisma.freeTextPracticeCycle.findFirst({
    where: { participantId: ctx.user.sub, elementInstanceId: instanceId },
    orderBy: { ordinal: 'desc' },
  })
  return cycle ? await loadCycleState(cycle.id, ctx, options) : null
}

export async function retryFreeTextEvaluation(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  assertParticipant(ctx)
  const attempt = await ctx.prisma.freeTextAttempt.findFirst({
    where: { id: attemptId, cycle: { participantId: ctx.user.sub } },
    include: {
      cycle: {
        include: {
          elementInstance: true,
          practiceQuiz: { include: { owner: true } },
        },
      },
    },
  })
  if (!attempt) {
    throw freeTextEvaluationError(
      'Free-text evaluation attempt not found',
      'NOT_FOUND'
    )
  }
  const semanticInstance = await getSemanticInstance(
    attempt.cycle.elementInstanceId,
    ctx
  )
  if (attempt.cycle.status !== DB.FreeTextPracticeCycleStatus.ACTIVE) {
    throw freeTextEvaluationError(
      'Free-text evaluation cannot be retried',
      'FREE_TEXT_EVALUATION_NOT_RETRYABLE'
    )
  }
  if (attempt.evaluationStatus === DB.FreeTextEvaluationStatus.PENDING) {
    return await loadCycleState(attempt.cycleId, ctx, options)
  }
  if (
    attempt.evaluationStatus !== DB.FreeTextEvaluationStatus.UNAVAILABLE ||
    !attempt.retryable
  ) {
    throw freeTextEvaluationError(
      'Free-text evaluation cannot be retried',
      'FREE_TEXT_EVALUATION_NOT_RETRYABLE'
    )
  }
  const consent = await getConsentDecision(
    ctx.user.sub,
    getDisclosureVersion(options),
    ctx
  )
  const unavailableReason = evaluationAvailabilityReason({
    ownerEntitled: ownerHasCatalyst(semanticInstance.practiceQuiz),
    consent: consent?.decision ?? null,
  })
  if (unavailableReason) {
    throw freeTextEvaluationError(unavailableReason, unavailableReason)
  }

  const transitioned = await ctx.prisma.$transaction((prisma) =>
    retryFreeTextAttemptInTransaction(
      {
        attemptId: attempt.id,
        cycleId: attempt.cycleId,
        evaluationRevision: attempt.evaluationRevision,
      },
      prisma
    )
  )
  if (!transitioned) {
    return await loadCycleState(attempt.cycleId, ctx, options)
  }
  const updated = await ctx.prisma.freeTextAttempt.findUniqueOrThrow({
    where: { id: attempt.id },
  })
  await schedulePendingAttempt(updated, ctx)
  return await loadCycleState(attempt.cycleId, ctx, options)
}

export async function revealFreeTextSolution(
  { cycleId }: { cycleId: string },
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  assertParticipant(ctx)
  const cycle = await ctx.prisma.freeTextPracticeCycle.findFirst({
    where: { id: cycleId, participantId: ctx.user.sub },
    include: {
      elementInstance: true,
      attempts: { orderBy: { ordinal: 'desc' }, take: 1 },
    },
  })
  if (!cycle) {
    throw freeTextEvaluationError(
      'Free-text practice cycle not found',
      'NOT_FOUND'
    )
  }
  const semanticInstance = await getSemanticInstance(
    cycle.elementInstanceId,
    ctx
  )
  if (cycle.status === DB.FreeTextPracticeCycleStatus.SOLUTION_REVEALED) {
    return await loadCycleState(cycle.id, ctx, options)
  }
  const config = semanticInstance.config
  const currentAttempt = cycle.attempts[0]
  if (
    (cycle.status !== DB.FreeTextPracticeCycleStatus.ACTIVE &&
      cycle.status !== DB.FreeTextPracticeCycleStatus.UNAVAILABLE) ||
    !config.solution_reveal_enabled ||
    !currentAttempt ||
    currentAttempt.evaluationStatus === DB.FreeTextEvaluationStatus.PENDING
  ) {
    throw freeTextEvaluationError(
      'Free-text solution cannot be revealed',
      'FREE_TEXT_SOLUTION_NOT_REVEALABLE'
    )
  }
  const revealed = await ctx.prisma.$transaction((prisma) =>
    revealFreeTextSolutionInTransaction(
      {
        cycleId: cycle.id,
        attemptId: currentAttempt.id,
        evaluationRevision: currentAttempt.evaluationRevision,
        evaluationStatus: currentAttempt.evaluationStatus,
      },
      prisma
    )
  )
  if (revealed.count !== 1) {
    return await loadCycleState(cycle.id, ctx, options)
  }
  return await loadCycleState(cycle.id, ctx, options)
}

export async function startFreeTextPracticeCycle(
  { instanceId }: { instanceId: number },
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  const semanticInstance = await getSemanticInstance(instanceId, ctx)
  const active = await ctx.prisma.freeTextPracticeCycle.findFirst({
    where: {
      participantId: ctx.user.sub,
      elementInstanceId: instanceId,
      status: DB.FreeTextPracticeCycleStatus.ACTIVE,
    },
  })
  if (active) {
    return await loadCycleState(active.id, ctx, options)
  }
  try {
    const cycle = await createCycle({
      ...semanticInstance,
      participantId: ctx.user.sub,
      ctx,
    })
    return await loadCycleState(cycle.id, ctx, options)
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const racedCycle = await ctx.prisma.freeTextPracticeCycle.findFirst({
      where: {
        participantId: ctx.user.sub,
        elementInstanceId: instanceId,
        status: DB.FreeTextPracticeCycleStatus.ACTIVE,
      },
      orderBy: { ordinal: 'desc' },
    })
    if (racedCycle) return await loadCycleState(racedCycle.id, ctx, options)
    throw error
  }
}

export async function decideSemanticEvaluationConsent(
  {
    disclosureVersion,
    accepted,
  }: { disclosureVersion: string; accepted: boolean },
  ctx: ContextWithUser
) {
  assertParticipant(ctx)
  if (disclosureVersion !== getSemanticEvaluationDisclosureVersion()) {
    throw freeTextEvaluationError(
      'Disclosure version is not current',
      'SEMANTIC_DISCLOSURE_STALE'
    )
  }
  return await ctx.prisma.$transaction(async (prisma) => {
    await prisma.$queryRaw`
      SELECT "id"
      FROM "Participant"
      WHERE "id" = CAST(${ctx.user.sub} AS UUID)
      FOR UPDATE
    `
    const consent = await prisma.participantSemanticEvaluationConsent.upsert({
      where: {
        participantId_disclosureVersion: {
          participantId: ctx.user.sub,
          disclosureVersion,
        },
      },
      create: {
        participantId: ctx.user.sub,
        disclosureVersion,
        decision: accepted
          ? DB.SemanticEvaluationConsentDecision.ACCEPTED
          : DB.SemanticEvaluationConsentDecision.DECLINED,
      },
      update: {
        decision: accepted
          ? DB.SemanticEvaluationConsentDecision.ACCEPTED
          : DB.SemanticEvaluationConsentDecision.DECLINED,
        decidedAt: new Date(),
      },
    })

    if (!accepted) {
      await markConsentRequiredAttemptsDeclinedInTransaction(
        ctx.user.sub,
        prisma
      )
    }

    return consent
  })
}
