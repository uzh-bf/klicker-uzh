import {
  applyEscapeRoomWrongAnswer,
  type EscapeRoomRules,
  type EscapeRoomStageOutcome,
  getEscapeRoomBonusCredit,
  isEscapeRoomBonusStage,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementInstanceResults,
  StackResponseInput,
} from '@klicker-uzh/types'
import {
  getEscapeRoomLifecycleClaimKey,
  gradeQrScanResponse,
  isEscapeRoomExpired,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import {
  hasEscapeRoomSampleSolution,
  hasExactEscapeRoomResponseSet,
  isGroupEscapeRoomResponseType,
} from './escapeRoomResponseValidation.js'
import {
  getRemainingSecondsUntil,
  releaseEscapeRoomLifecycleClaim,
} from './escapeRooms.js'
import {
  getEscapeRoomRules,
  getStageOutcome,
  parseEscapeRoomStageOutcomes,
  setStageOutcome,
} from './escapeRoomStageOutcomes.js'
import {
  evaluateCaseStudyAnswerCorrectness,
  evaluateChoicesAnswerCorrectness,
  evaluateFreeTextAnswerCorrectness,
  evaluateNumericalAnswerCorrectness,
  evaluateSelectionAnswerCorrectness,
  updateCaseStudyResults,
  updateChoicesResults,
  updateFreeTextResults,
  updateNumericalResults,
  updateSelectionResults,
} from './stacks.js'

type GroupEscapeRoomInstance = DB.Prisma.ElementInstanceGetPayload<{
  include: { element: { select: { qrScanCode: true } } }
}>

export interface GroupEscapeRoomStageResponse {
  instanceId: number
  // null when the stage was revealed or skipped instead of answered
  response: StackResponseInput | null
  clearedAt: string
  // Missing on entries written before scoring rules existed; read as SOLVED.
  outcome?: EscapeRoomStageOutcome
  creditSeconds?: number
}

/**
 * The stages of a Group Activity escape room are its answerable elements in
 * stack and element order. Content and flashcard elements never gate.
 */
export function getGroupEscapeRoomStages<
  T extends { elementType: DB.ElementType; order: number },
>(stacks: Array<{ order: number; elements: T[] }>): T[] {
  return [...stacks]
    .sort((a, b) => a.order - b.order)
    .flatMap((stack) => [...stack.elements].sort((a, b) => a.order - b.order))
    .filter((instance) => isGroupEscapeRoomResponseType(instance.elementType))
}

export function parseGroupEscapeRoomStageResponses(
  value: unknown
): GroupEscapeRoomStageResponse[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (entry): entry is GroupEscapeRoomStageResponse =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { instanceId?: unknown }).instanceId === 'number'
  )
}

// The attempt completes once every stage except a bonus stage has an entry.
export function isGroupEscapeRoomComplete(
  stages: Array<{ id: number }>,
  entries: GroupEscapeRoomStageResponse[],
  rules: EscapeRoomRules
) {
  return stages.every(
    (stage, index) =>
      isEscapeRoomBonusStage(rules, index, stages.length) ||
      entries.some((entry) => entry.instanceId === stage.id)
  )
}

// Writes the team's answered stages as the group's decisions, so grading and
// evaluation see the same record as a regular group activity submission.
export async function completeGroupEscapeRoomDecisions(
  prisma: DB.Prisma.TransactionClient,
  activityId: number,
  entries: GroupEscapeRoomStageResponse[]
) {
  await prisma.groupActivityInstance.update({
    where: { id: activityId },
    data: {
      decisions: entries.flatMap((entry) =>
        entry.response ? [entry.response] : []
      ),
      decisionsSubmittedAt: new Date(),
    },
  })
}

function withoutQrScanCode(response: StackResponseInput): StackResponseInput {
  return response.type === DB.ElementType.QR_SCAN
    ? { ...response, qrScanResponse: null }
    : response
}

function unsupportedResponse() {
  return new GraphQLError('Group activity response type is not supported')
}

function invalidResponseSet() {
  return new GraphQLError(
    'Group activity responses must exactly match the required instances'
  )
}

async function updateAndGradeResponse({
  prisma,
  instance,
  response,
}: {
  prisma: DB.Prisma.TransactionClient
  instance: GroupEscapeRoomInstance
  response: StackResponseInput
}) {
  const elementData = instance.elementData
  if (!elementData || elementData.type !== response.type) {
    throw invalidResponseSet()
  }

  let updatedResults:
    | { results: ElementInstanceResults; modified: boolean }
    | undefined
  let correctness: number | null = null

  if (
    (response.type === DB.ElementType.SC ||
      response.type === DB.ElementType.MC ||
      response.type === DB.ElementType.KPRIM) &&
    (elementData.type === DB.ElementType.SC ||
      elementData.type === DB.ElementType.MC ||
      elementData.type === DB.ElementType.KPRIM) &&
    'choices' in instance.results
  ) {
    updatedResults = updateChoicesResults({
      previousResults: instance.results,
      response: { choices: response.choicesResponse },
    })
    correctness = evaluateChoicesAnswerCorrectness({
      elementData,
      response: { choices: response.choicesResponse },
    })
  } else if (
    response.type === DB.ElementType.NUMERICAL &&
    elementData.type === DB.ElementType.NUMERICAL &&
    'responses' in instance.results
  ) {
    const value = String(response.numericalResponse)
    updatedResults = updateNumericalResults({
      previousResults: instance.results,
      elementData,
      response: { value },
    })
    correctness = evaluateNumericalAnswerCorrectness({
      elementData,
      response: { value },
    })
  } else if (
    response.type === DB.ElementType.FREE_TEXT &&
    elementData.type === DB.ElementType.FREE_TEXT &&
    'responses' in instance.results
  ) {
    updatedResults = updateFreeTextResults({
      previousResults: instance.results,
      elementData,
      response: { value: response.freeTextResponse },
    })
    correctness = evaluateFreeTextAnswerCorrectness({
      elementData,
      response: { value: response.freeTextResponse },
    })
  } else if (
    response.type === DB.ElementType.SELECTION &&
    elementData.type === DB.ElementType.SELECTION &&
    'selections' in instance.results
  ) {
    updatedResults = updateSelectionResults({
      previousResults: instance.results,
      response: { selection: response.selectionResponse },
    })
    correctness = evaluateSelectionAnswerCorrectness({
      elementData,
      response: { selection: response.selectionResponse },
    })
  } else if (
    response.type === DB.ElementType.CASE_STUDY &&
    elementData.type === DB.ElementType.CASE_STUDY &&
    'assessments' in instance.results
  ) {
    updatedResults = updateCaseStudyResults({
      previousResults: instance.results,
      response: { assessment: response.caseStudyResponse },
    })
    correctness = evaluateCaseStudyAnswerCorrectness({
      elementData,
      response: { assessment: response.caseStudyResponse },
    })
  } else if (response.type === DB.ElementType.QR_SCAN) {
    updatedResults = {
      results: { total: instance.results.total + 1 },
      modified: true,
    }
    correctness = gradeQrScanResponse(
      instance.element.qrScanCode,
      response.qrScanResponse
    )
      ? 1
      : 0
  }

  if (!updatedResults?.modified || correctness === null) {
    throw unsupportedResponse()
  }
  await prisma.elementInstance.update({
    where: { id: instance.id },
    data: { results: updatedResults.results },
  })
  return correctness === 1
}

export async function submitEscapeRoomGroupActivityDecisions(
  {
    activityId,
    groupActivityId,
    groupId,
    responses,
    lockoutSeconds,
  }: {
    activityId: number
    groupActivityId: string
    groupId: string
    responses: StackResponseInput[]
    lockoutSeconds: number
  },
  ctx: ContextWithUser
) {
  const claimedAttempt = await ctx.prisma.escapeRoomAttempt.findUnique({
    where: { groupId_groupActivityId: { groupId, groupActivityId } },
    select: { id: true },
  })
  if (!claimedAttempt) {
    throw new GraphQLError(
      'No active escape room attempt found for this activity',
      { extensions: { code: 'ESCAPE_ROOM_NO_ATTEMPT' } }
    )
  }

  const claimKey = getEscapeRoomLifecycleClaimKey(
    'groupActivity',
    groupActivityId,
    groupId
  )
  const claimToken = randomUUID()
  const claimed = await ctx.redisExec.set(claimKey, claimToken, 'EX', 300, 'NX')
  if (claimed !== 'OK') {
    throw new GraphQLError(
      'Another escape room response is already being processed',
      { extensions: { code: 'ESCAPE_ROOM_RESPONSE_PROCESSING' } }
    )
  }

  try {
    const result = await ctx.prisma.$transaction(
      async (prisma) => {
        const transactionInstance =
          await prisma.groupActivityInstance.findUnique({
            where: { id: activityId },
            include: {
              groupActivity: {
                include: {
                  escapeRoomConfig: true,
                  stacks: {
                    orderBy: { order: 'asc' },
                    include: {
                      elements: {
                        orderBy: { order: 'asc' },
                        include: {
                          element: { select: { qrScanCode: true } },
                        },
                      },
                    },
                  },
                },
              },
              group: {
                include: {
                  participants: { where: { id: ctx.user.sub } },
                },
              },
            },
          })

        if (
          !transactionInstance ||
          transactionInstance.groupId !== groupId ||
          transactionInstance.groupActivityId !== groupActivityId ||
          transactionInstance.group.participants.length === 0 ||
          !transactionInstance.groupActivity.escapeRoomConfig ||
          transactionInstance.groupActivity.status !==
            DB.PublicationStatus.PUBLISHED ||
          dayjs().isBefore(
            transactionInstance.groupActivity.scheduledStartAt
          ) ||
          dayjs().isAfter(transactionInstance.groupActivity.scheduledEndAt)
        ) {
          throw new GraphQLError(
            'This group activity cannot accept escape room responses'
          )
        }

        const config = transactionInstance.groupActivity.escapeRoomConfig
        const rules = getEscapeRoomRules(config)
        const attempt = await prisma.escapeRoomAttempt.findUnique({
          where: { groupId_groupActivityId: { groupId, groupActivityId } },
        })
        const stages = getGroupEscapeRoomStages(
          transactionInstance.groupActivity.stacks
        )
        if (stages.some((instance) => !hasEscapeRoomSampleSolution(instance))) {
          throw new GraphQLError(
            'Escape room group activity instances require sample solutions'
          )
        }

        // Stages unlock in order: only the first uncleared stage may be
        // answered, one response per submission.
        const clearedStages = parseGroupEscapeRoomStageResponses(
          attempt?.stageResponses
        )
        const clearedIds = new Set(
          clearedStages.map((entry) => entry.instanceId)
        )
        const currentStage = stages.find((stage) => !clearedIds.has(stage.id))
        const isBonus =
          !!currentStage &&
          isEscapeRoomBonusStage(
            rules,
            stages.indexOf(currentStage),
            stages.length
          )

        // A completed attempt still accepts its one bonus answer in time.
        const bonusAfterCompletion =
          isBonus && attempt?.status === DB.EscapeRoomStatus.COMPLETED
        if (
          !attempt ||
          (attempt.status !== DB.EscapeRoomStatus.IN_PROGRESS &&
            !bonusAfterCompletion) ||
          (transactionInstance.decisionsSubmittedAt && !bonusAfterCompletion)
        ) {
          throw new GraphQLError(
            'No active escape room attempt found for this activity',
            { extensions: { code: 'ESCAPE_ROOM_NO_ATTEMPT' } }
          )
        }
        if (
          !bonusAfterCompletion &&
          attempt.lockoutUntil &&
          dayjs().isBefore(dayjs(attempt.lockoutUntil))
        ) {
          throw new GraphQLError(
            'You are locked out from submitting answers due to a recent incorrect attempt',
            {
              extensions: {
                code: 'ESCAPE_ROOM_LOCKOUT',
                lockoutUntil: attempt.lockoutUntil.toISOString(),
                lockoutRemainingSeconds: getRemainingSecondsUntil(
                  attempt.lockoutUntil
                ),
              },
            }
          )
        }
        if (isEscapeRoomExpired(attempt)) {
          if (bonusAfterCompletion) {
            throw new GraphQLError('Escape room time has expired', {
              extensions: { code: 'ESCAPE_ROOM_EXPIRED' },
            })
          }
          await prisma.escapeRoomAttempt.update({
            where: { id: attempt.id },
            data: { status: DB.EscapeRoomStatus.EXPIRED },
          })
          return { kind: 'expired' as const }
        }

        const [response] = responses
        if (!currentStage || !response) throw invalidResponseSet()
        if (
          responses.length !== 1 ||
          (response.instanceId !== currentStage.id &&
            stages.some((stage) => stage.id === response.instanceId))
        ) {
          throw new GraphQLError(
            'Only the current escape room stage can be answered',
            { extensions: { code: 'ESCAPE_ROOM_GATED' } }
          )
        }
        if (
          !hasExactEscapeRoomResponseSet({
            instances: [currentStage],
            responses,
            validateShape: true,
            requireSampleSolution: true,
          })
        ) {
          throw invalidResponseSet()
        }

        const correct = await updateAndGradeResponse({
          prisma,
          instance: currentStage,
          response,
        })
        const now = new Date()

        if (isBonus) {
          const outcome = correct ? 'BONUS_CORRECT' : 'BONUS_WRONG'
          const outcomes = parseEscapeRoomStageOutcomes(attempt.stageOutcomes)
          await prisma.escapeRoomAttempt.update({
            where: { id: attempt.id },
            data: {
              // Mirrored into stageOutcomes so team members can read the result.
              stageOutcomes: setStageOutcome(outcomes, {
                ...getStageOutcome(outcomes, currentStage.id),
                outcome,
                at: now.toISOString(),
              }) as unknown as DB.Prisma.InputJsonValue,
              stageResponses: [
                ...clearedStages,
                {
                  instanceId: currentStage.id,
                  response: withoutQrScanCode(response),
                  clearedAt: now.toISOString(),
                  outcome,
                  creditSeconds: getEscapeRoomBonusCredit(rules, correct),
                },
              ] as unknown as DB.Prisma.InputJsonValue,
            },
          })
          return { kind: 'bonus' as const }
        }

        const outcomes = parseEscapeRoomStageOutcomes(attempt.stageOutcomes)
        const currentOutcome = getStageOutcome(outcomes, currentStage.id)
        const wrong = correct
          ? null
          : applyEscapeRoomWrongAnswer(rules, currentOutcome.wrongAttempts)

        if (wrong && !wrong.revealed) {
          await prisma.escapeRoomAttempt.update({
            where: { id: attempt.id },
            data: {
              stageOutcomes: setStageOutcome(outcomes, {
                ...currentOutcome,
                wrongAttempts: wrong.wrongAttempts,
              }) as unknown as DB.Prisma.InputJsonValue,
              ...(wrong.penaltySeconds > 0
                ? { penaltySeconds: { increment: wrong.penaltySeconds } }
                : {}),
              lockoutUntil: dayjs(now)
                .add(config.lockoutSeconds, 'second')
                .toDate(),
            },
          })
          return { kind: 'wrong' as const, attemptsLeft: wrong.attemptsLeft }
        }

        const nextStages: GroupEscapeRoomStageResponse[] = [
          ...clearedStages,
          wrong
            ? {
                instanceId: currentStage.id,
                response: null,
                clearedAt: now.toISOString(),
                outcome: 'REVEALED',
              }
            : {
                instanceId: currentStage.id,
                response: withoutQrScanCode(response),
                clearedAt: now.toISOString(),
                outcome: 'SOLVED',
              },
        ]
        const completed = isGroupEscapeRoomComplete(stages, nextStages, rules)
        await prisma.escapeRoomAttempt.update({
          where: { id: attempt.id },
          data: {
            stageResponses: nextStages as unknown as DB.Prisma.InputJsonValue,
            ...(wrong
              ? {
                  stageOutcomes: setStageOutcome(outcomes, {
                    ...currentOutcome,
                    wrongAttempts: wrong.wrongAttempts,
                    outcome: 'REVEALED',
                    at: now.toISOString(),
                  }) as unknown as DB.Prisma.InputJsonValue,
                  penaltySeconds: { increment: wrong.penaltySeconds },
                }
              : {}),
            ...(completed
              ? { status: DB.EscapeRoomStatus.COMPLETED, completedAt: now }
              : {}),
          },
        })
        if (completed) {
          await completeGroupEscapeRoomDecisions(prisma, activityId, nextStages)
        }

        return { kind: wrong ? ('revealed' as const) : ('correct' as const) }
      },
      { isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable }
    )

    if (result.kind === 'expired') {
      throw new GraphQLError('Escape room time has expired', {
        extensions: { code: 'ESCAPE_ROOM_EXPIRED' },
      })
    }
    if (result.kind === 'wrong') {
      throw new GraphQLError('This answer is incorrect. You are locked out.', {
        extensions: {
          code: 'ESCAPE_ROOM_LOCKOUT',
          lockoutRemainingSeconds: lockoutSeconds,
          attemptsLeft: result.attemptsLeft,
        },
      })
    }
    if (result.kind === 'revealed') {
      throw new GraphQLError(
        'Too many incorrect answers. The solution was revealed.',
        { extensions: { code: 'ESCAPE_ROOM_REVEALED' } }
      )
    }
    return activityId
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    ) {
      throw new GraphQLError(
        'This group activity submission conflicted with another response',
        { extensions: { code: 'ESCAPE_ROOM_CONFLICT' } }
      )
    }
    throw error
  } finally {
    await releaseEscapeRoomLifecycleClaim(ctx, claimKey, claimToken)
  }
}
