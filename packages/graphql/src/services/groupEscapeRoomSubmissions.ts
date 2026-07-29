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
import { getRemainingSecondsUntil } from './escapeRooms.js'
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

const RELEASE_ESCAPE_ROOM_CLAIM = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`

type GroupEscapeRoomInstance = DB.Prisma.ElementInstanceGetPayload<{
  include: { element: { select: { qrScanCode: true } } }
}>

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
                    include: {
                      elements: {
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
          transactionInstance.decisionsSubmittedAt ||
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

        const attempt = await prisma.escapeRoomAttempt.findUnique({
          where: { groupId_groupActivityId: { groupId, groupActivityId } },
        })
        if (!attempt || attempt.status !== DB.EscapeRoomStatus.IN_PROGRESS) {
          throw new GraphQLError(
            'No active escape room attempt found for this activity',
            { extensions: { code: 'ESCAPE_ROOM_NO_ATTEMPT' } }
          )
        }
        if (
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
          await prisma.escapeRoomAttempt.update({
            where: { id: attempt.id },
            data: { status: DB.EscapeRoomStatus.EXPIRED },
          })
          return { expired: true, correct: false }
        }

        const requiredInstances = transactionInstance.groupActivity.stacks
          .flatMap((stack) => stack.elements)
          .filter((instance) =>
            isGroupEscapeRoomResponseType(instance.elementType)
          )
        if (
          requiredInstances.some(
            (instance) => !hasEscapeRoomSampleSolution(instance)
          )
        ) {
          throw new GraphQLError(
            'Escape room group activity instances require sample solutions'
          )
        }
        if (
          !hasExactEscapeRoomResponseSet({
            instances: requiredInstances,
            responses,
            validateShape: true,
            requireSampleSolution: true,
          })
        ) {
          throw invalidResponseSet()
        }

        const requiredById = new Map(
          requiredInstances.map((instance) => [instance.id, instance])
        )
        let allCorrect = true
        for (const response of responses) {
          const instance = requiredById.get(response.instanceId)
          if (!instance) throw invalidResponseSet()
          allCorrect =
            (await updateAndGradeResponse({ prisma, instance, response })) &&
            allCorrect
        }

        await prisma.groupActivityInstance.update({
          where: { id: activityId },
          data: allCorrect
            ? {
                decisions: responses.map((response) =>
                  response.type === DB.ElementType.QR_SCAN
                    ? { ...response, qrScanResponse: null }
                    : response
                ),
                decisionsSubmittedAt: new Date(),
              }
            : { decisionsSubmittedAt: null },
        })
        await prisma.escapeRoomAttempt.update({
          where: { id: attempt.id },
          data: allCorrect
            ? {
                status: DB.EscapeRoomStatus.COMPLETED,
                completedAt: new Date(),
              }
            : {
                lockoutUntil: dayjs()
                  .add(
                    transactionInstance.groupActivity.escapeRoomConfig
                      .lockoutSeconds,
                    'second'
                  )
                  .toDate(),
              },
        })

        return { expired: false, correct: allCorrect }
      },
      { isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable }
    )

    if (result.expired) {
      throw new GraphQLError('Escape room time has expired', {
        extensions: { code: 'ESCAPE_ROOM_EXPIRED' },
      })
    }
    if (!result.correct) {
      throw new GraphQLError(
        'Some answers are incorrect. You are locked out.',
        {
          extensions: {
            code: 'ESCAPE_ROOM_LOCKOUT',
            lockoutRemainingSeconds: lockoutSeconds,
          },
        }
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
        'This group activity submission conflicted with another response'
      )
    }
    throw error
  } finally {
    await ctx.redisExec.eval(RELEASE_ESCAPE_ROOM_CLAIM, 1, claimKey, claimToken)
  }
}
