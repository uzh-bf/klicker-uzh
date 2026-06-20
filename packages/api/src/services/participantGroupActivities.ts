import {
  ElementType,
  ParameterType,
  PublicationStatus,
  type Course,
  type ElementInstance,
  type ElementStack,
  type GroupActivity,
  type GroupActivityClue,
  type GroupActivityClueInstance,
  type GroupActivityInstance,
  type Participant,
  type ParticipantGroup,
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
  GroupActivityDecision,
  GroupActivityResults,
  NumericalElementData,
  StackResponseInput,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import {
  toElementDataWithoutSolutions,
  type PracticeQuizElementDataWithoutSolutions,
} from './participantPracticeQuizzes.js'
import {
  updateCaseStudyResults,
  updateChoicesResults,
  updateFreeTextResults,
  updateNumericalResults,
  updateSelectionResults,
} from './participantStackEvaluations.js'
import { randomIndex } from './responseIdentifiers.js'

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

type GroupActivityDetailsElementSource = Pick<
  ElementInstance,
  'elementData' | 'elementType' | 'id' | 'type'
>

type GroupActivityDetailsStackSource = Pick<
  ElementStack,
  'description' | 'displayName' | 'id' | 'order' | 'type'
> & {
  elements?: GroupActivityDetailsElementSource[] | null
}

type GroupActivityDetailsSource = Pick<
  GroupActivity,
  | 'description'
  | 'displayName'
  | 'id'
  | 'scheduledEndAt'
  | 'scheduledStartAt'
  | 'status'
> & {
  clues: Pick<GroupActivityClue, 'displayName' | 'id'>[]
  course: Pick<Course, 'color' | 'displayName' | 'id'>
  group: Pick<ParticipantGroup, 'id' | 'name'> & {
    participants?: (Pick<Participant, 'avatar' | 'id' | 'username'> & {
      isSelf: boolean
    })[]
  }
  activityInstance: GroupActivityDetailsInstance | null
  stacks: GroupActivityDetailsStackSource[]
}

type GroupActivityDetailsInstance = Pick<
  GroupActivityInstance,
  'decisionsSubmittedAt' | 'id' | 'resultsComputedAt'
> & {
  clues?: (Pick<
    GroupActivityClueInstance,
    'displayName' | 'id' | 'type' | 'unit'
  > & {
    participant: Pick<Participant, 'avatar' | 'id' | 'username'> & {
      isSelf: boolean
    }
    value?: string | null
  })[]
  decisions?: GroupActivityDecision[] | null
  results?: GroupActivityResults | null
}

export type GroupActivityDetails = Omit<
  GroupActivityDetailsSource,
  'stacks'
> & {
  stacks: (Pick<
    ElementStack,
    'description' | 'displayName' | 'id' | 'order' | 'type'
  > & {
    elements: (Pick<ElementInstance, 'elementType' | 'id' | 'type'> & {
      elementData: PracticeQuizElementDataWithoutSolutions
    })[]
  })[]
}

export type GroupActivityDetailsOutput = {
  groupActivityDetails: GroupActivityDetails | null
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

function toGroupActivityStack(stack: GroupActivityDetailsStackSource) {
  return {
    id: stack.id,
    type: stack.type,
    displayName: stack.displayName,
    description: stack.description,
    order: stack.order,
    elements:
      stack.elements?.map((element) => ({
        id: element.id,
        type: element.type,
        elementType: element.elementType,
        elementData: toElementDataWithoutSolutions(element.elementData),
      })) ?? [],
  }
}

function toGroupActivityDetails(
  details: GroupActivityDetailsSource
): GroupActivityDetails {
  return {
    ...details,
    stacks: details.stacks.map(toGroupActivityStack),
  }
}

function toGroupActivityDecision(decision: unknown): GroupActivityDecision {
  const typedDecision = decision as GroupActivityDecision & {
    contentReponse?: boolean | null
  }
  const { contentReponse, ...decisionWithoutTypo } = typedDecision

  return {
    ...decisionWithoutTypo,
    contentResponse:
      decisionWithoutTypo.contentResponse ?? contentReponse ?? null,
  }
}

function shuffleItems<T>(items: T[]) {
  const shuffled = [...items]

  for (let ix = shuffled.length - 1; ix > 0; ix -= 1) {
    const swapIx = randomIndex(ix + 1)
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

export async function getGroupActivityDetails({
  activityId,
  groupId,
  participantId,
  prisma,
}: {
  activityId: string
  groupId: string
  participantId: string
  prisma: PrismaClient
}): Promise<GroupActivityDetailsOutput> {
  const groupActivity = await prisma.groupActivity.findUnique({
    where: {
      id: activityId,
      status: {
        in: [
          PublicationStatus.PUBLISHED,
          PublicationStatus.ENDED,
          PublicationStatus.GRADED,
        ],
      },
      isDeleted: false,
    },
    select: {
      id: true,
      displayName: true,
      status: true,
      description: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      clues: {
        orderBy: { displayName: 'asc' },
        select: {
          id: true,
          displayName: true,
        },
      },
      stacks: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          type: true,
          displayName: true,
          description: true,
          order: true,
          elements: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              type: true,
              elementType: true,
              elementData: true,
            },
          },
        },
      },
      course: {
        select: {
          id: true,
          displayName: true,
          color: true,
        },
      },
    },
  })

  const group = await prisma.participantGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      participants: {
        select: {
          id: true,
          username: true,
          avatar: true,
        },
      },
    },
  })

  if (!groupActivity || !group) return { groupActivityDetails: null }

  if (
    !group.participants.some((participant) => participant.id === participantId)
  ) {
    return { groupActivityDetails: null }
  }

  const activityInstance = await prisma.groupActivityInstance.findUnique({
    where: {
      groupActivityId_groupId: {
        groupActivityId: activityId,
        groupId,
      },
    },
    select: {
      id: true,
      decisionsSubmittedAt: true,
      decisions: true,
      resultsComputedAt: true,
      results: true,
      clueInstanceAssignment: {
        select: {
          participantId: true,
          groupActivityClueInstance: {
            select: {
              id: true,
              displayName: true,
              type: true,
              unit: true,
              value: true,
            },
          },
          participant: {
            select: {
              id: true,
              avatar: true,
              username: true,
            },
          },
        },
      },
    },
  })

  const isGraded = groupActivity.status === PublicationStatus.GRADED

  return {
    groupActivityDetails: toGroupActivityDetails({
      ...groupActivity,
      group: {
        id: group.id,
        name: group.name,
        participants: group.participants.map((participant) => ({
          ...participant,
          isSelf: participant.id === participantId,
        })),
      },
      activityInstance: activityInstance
        ? {
            id: activityInstance.id,
            decisionsSubmittedAt: activityInstance.decisionsSubmittedAt,
            decisions:
              Array.isArray(activityInstance.decisions) &&
              activityInstance.decisions.length > 0
                ? activityInstance.decisions.map(toGroupActivityDecision)
                : null,
            resultsComputedAt: activityInstance.resultsComputedAt,
            results: activityInstance.results as GroupActivityResults | null,
            clues: activityInstance.clueInstanceAssignment.map(
              (clueAssignment) => {
                const isSelf = clueAssignment.participantId === participantId
                const clue = clueAssignment.groupActivityClueInstance

                return {
                  id: clue.id,
                  displayName: clue.displayName,
                  type: clue.type,
                  unit: clue.unit,
                  ...(isSelf || isGraded ? { value: clue.value } : {}),
                  participant: {
                    ...clueAssignment.participant,
                    isSelf,
                  },
                }
              }
            ),
          }
        : null,
    }),
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
