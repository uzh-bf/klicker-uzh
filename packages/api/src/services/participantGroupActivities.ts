import {
  ElementType,
  ParameterType,
  PublicationStatus,
  type GroupActivity,
  type GroupActivityInstance,
  type Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  ElementInstanceResults,
  ElementResultsCaseStudy,
  ElementResultsChoices,
  ElementResultsOpen,
  ElementResultsSelection,
  FreeTextElementData,
  NumericalElementData,
  StackResponseInput,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import {
  updateCaseStudyResults,
  updateChoicesResults,
  updateFreeTextResults,
  updateNumericalResults,
  updateSelectionResults,
} from './participantStackEvaluations.js'

type GroupActivityClueSource = {
  displayName: string
  name: string
  type: ParameterType
  unit: string | null
  value: string
}

type StartGroupActivitySource = Pick<
  GroupActivity,
  'id' | 'scheduledEndAt' | 'scheduledStartAt' | 'status'
> & {
  clues: GroupActivityClueSource[]
}

export type StartGroupActivityOutput = {
  groupActivity: {
    activityInstance: Pick<GroupActivityInstance, 'id'>
    id: string
    status: PublicationStatus
  } | null
}

export type SubmitGroupActivityDecisionsOutput = {
  groupActivityInstanceId: number | null
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items]

  for (let ix = shuffled.length - 1; ix > 0; ix -= 1) {
    const swapIx = Math.floor(Math.random() * (ix + 1))
    const item = shuffled[ix]
    shuffled[ix] = shuffled[swapIx]!
    shuffled[swapIx] = item!
  }

  return shuffled
}

function isActivityAvailable(activity: StartGroupActivitySource) {
  return (
    !dayjs().isBefore(activity.scheduledStartAt) &&
    !dayjs().isAfter(activity.scheduledEndAt)
  )
}

export async function startGroupActivity({
  activityId,
  groupId,
  participantId,
  prisma,
}: {
  activityId: string
  groupId: string
  participantId: string
  prisma: PrismaClient
}): Promise<StartGroupActivityOutput> {
  const groupActivity = await prisma.groupActivity.findUnique({
    where: { id: activityId, status: PublicationStatus.PUBLISHED },
    select: {
      id: true,
      status: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      clues: {
        orderBy: { displayName: 'asc' },
        select: {
          name: true,
          displayName: true,
          type: true,
          unit: true,
          value: true,
        },
      },
    },
  })

  const group = await prisma.participantGroup.findUnique({
    where: { id: groupId },
    select: {
      participants: {
        select: { id: true },
      },
    },
  })

  if (!groupActivity || !group) return { groupActivity: null }

  if (
    !group.participants.some((participant) => participant.id === participantId)
  ) {
    return { groupActivity: null }
  }

  if (!isActivityAvailable(groupActivity)) return { groupActivity: null }

  const groupMembers = group.participants
  if (groupMembers.length < 2) return { groupActivity: null }

  try {
    const activityInstance = await prisma.$transaction(async (tx) => {
      const createdInstance = await tx.groupActivityInstance.create({
        data: {
          group: { connect: { id: groupId } },
          groupActivity: { connect: { id: activityId } },
          clues: { create: groupActivity.clues },
        },
        select: {
          id: true,
          clues: {
            select: { id: true },
          },
        },
      })

      const shuffledClues = shuffleItems(createdInstance.clues)
      const clueAssignments = groupMembers.reduce<{
        assignments: {
          groupActivityClueInstance: { connect: { id: number } }
          participant: { connect: { id: string } }
        }[]
        remainingClues: number
        remainingMembers: number
        startIx: number
      }>(
        (acc, participant) => {
          const numOfClues = Math.ceil(
            acc.remainingClues / acc.remainingMembers
          )
          const endIx = acc.startIx + numOfClues
          const participantClues = shuffledClues.slice(acc.startIx, endIx)

          return {
            remainingClues: acc.remainingClues - numOfClues,
            remainingMembers: acc.remainingMembers - 1,
            startIx: endIx,
            assignments: [
              ...acc.assignments,
              ...participantClues.map((clue) => ({
                groupActivityClueInstance: {
                  connect: { id: clue.id },
                },
                participant: {
                  connect: { id: participant.id },
                },
              })),
            ],
          }
        },
        {
          assignments: [],
          remainingClues: groupActivity.clues.length,
          remainingMembers: groupMembers.length,
          startIx: 0,
        }
      )

      return tx.groupActivityInstance.update({
        where: { id: createdInstance.id },
        data: {
          clueInstanceAssignment: {
            create: clueAssignments.assignments,
          },
        },
        select: { id: true },
      })
    })

    return {
      groupActivity: {
        id: groupActivity.id,
        status: groupActivity.status,
        activityInstance,
      },
    }
  } catch (error) {
    console.error(error)
    return { groupActivity: null }
  }
}

function isObjectResult(
  results: unknown
): results is Record<string, unknown> & ElementInstanceResults {
  return (
    typeof results === 'object' && results !== null && !Array.isArray(results)
  )
}

function isSubmittableGroupActivity(
  activity: Pick<
    GroupActivity,
    'scheduledEndAt' | 'scheduledStartAt' | 'status'
  >
) {
  return (
    activity.status !== PublicationStatus.DRAFT &&
    activity.status !== PublicationStatus.SCHEDULED &&
    activity.status !== PublicationStatus.ENDED &&
    isActivityAvailable({ ...activity, id: '', clues: [] })
  )
}

async function updateAggregatedElementResults({
  prisma,
  response,
}: {
  prisma: PrismaClient
  response: StackResponseInput
}) {
  if (response.type === ElementType.CONTENT) return

  const instance = await prisma.elementInstance.findUnique({
    where: { id: response.instanceId },
    select: {
      elementData: true,
      results: true,
    },
  })
  if (!instance?.elementData || !isObjectResult(instance.results)) return

  const previousResults = instance.results
  let updatedResults:
    | { modified: boolean; results: ElementInstanceResults }
    | undefined

  if (
    (response.type === ElementType.SC ||
      response.type === ElementType.MC ||
      response.type === ElementType.KPRIM) &&
    'choices' in previousResults
  ) {
    updatedResults = updateChoicesResults({
      previousResults: previousResults as ElementResultsChoices,
      response: { choices: response.choicesResponse ?? [] },
    })
  } else if (
    response.type === ElementType.NUMERICAL &&
    'responses' in previousResults
  ) {
    updatedResults = updateNumericalResults({
      previousResults: previousResults as ElementResultsOpen,
      elementData: instance.elementData as NumericalElementData,
      response: { value: String(response.numericalResponse) },
    })
  } else if (
    response.type === ElementType.FREE_TEXT &&
    'responses' in previousResults
  ) {
    updatedResults = updateFreeTextResults({
      previousResults: previousResults as ElementResultsOpen,
      elementData: instance.elementData as FreeTextElementData,
      response: { value: response.freeTextResponse ?? '' },
    })
  } else if (
    response.type === ElementType.SELECTION &&
    'selections' in previousResults
  ) {
    updatedResults = updateSelectionResults({
      previousResults: previousResults as ElementResultsSelection,
      response: { selection: response.selectionResponse ?? [] },
    })
  } else if (
    response.type === ElementType.CASE_STUDY &&
    'assessments' in previousResults
  ) {
    updatedResults = updateCaseStudyResults({
      previousResults: previousResults as ElementResultsCaseStudy,
      response: { assessment: response.caseStudyResponse ?? [] },
    })
  } else {
    console.log('Element type not supported for group activity')
    return
  }

  if (!updatedResults.modified) return

  await prisma.elementInstance.update({
    where: { id: response.instanceId },
    data: {
      results: updatedResults.results as Prisma.InputJsonValue,
    },
  })
}

export async function submitGroupActivityDecisions({
  activityId,
  participantId,
  prisma,
  responses,
}: {
  activityId: number
  participantId: string
  prisma: PrismaClient
  responses: StackResponseInput[]
}): Promise<SubmitGroupActivityDecisionsOutput> {
  const groupActivityInstance = await prisma.groupActivityInstance.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      decisionsSubmittedAt: true,
      group: {
        select: {
          participants: {
            where: { id: participantId },
            select: { id: true },
          },
        },
      },
      groupActivity: {
        select: {
          scheduledEndAt: true,
          scheduledStartAt: true,
          status: true,
        },
      },
    },
  })

  if (
    !groupActivityInstance ||
    groupActivityInstance.group.participants.length === 0 ||
    groupActivityInstance.decisionsSubmittedAt ||
    !isSubmittableGroupActivity(groupActivityInstance.groupActivity)
  ) {
    return { groupActivityInstanceId: null }
  }

  await Promise.all(
    responses.map((response) =>
      prisma.$transaction((tx) =>
        updateAggregatedElementResults({
          prisma: tx as PrismaClient,
          response,
        })
      )
    )
  )

  const updatedActivityInstance = await prisma.groupActivityInstance.update({
    where: { id: activityId },
    data: {
      decisions: responses as Prisma.InputJsonValue,
      decisionsSubmittedAt: new Date(),
    },
    select: { id: true },
  })

  return { groupActivityInstanceId: updatedActivityInstance.id }
}
