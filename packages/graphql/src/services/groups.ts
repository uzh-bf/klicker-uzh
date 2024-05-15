import {
  Element,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  GroupActivityStatus,
  LeaderboardType,
  ParameterType,
} from '@klicker-uzh/prisma'
import { PrismaClientKnownRequestError } from '@klicker-uzh/prisma/dist/runtime/library'
import { getInitialElementResults, processElementData } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { pickRandom } from 'mathjs'
import * as R from 'ramda'
import { StackInput } from 'src/types/app'
import { v4 as uuidv4 } from 'uuid'
import { Context, ContextWithUser } from '../lib/context'
import { shuffle } from '../lib/util'
import {
  RespondToElementStackInput,
  updateQuestionResults,
} from './practiceQuizzes'

interface CreateParticipantGroupArgs {
  courseId: string
  name: string
}

export async function createParticipantGroup(
  { courseId, name }: CreateParticipantGroupArgs,
  ctx: ContextWithUser
) {
  const code = 100000 + Math.floor(Math.random() * 900000)

  const participantGroup = await ctx.prisma.participantGroup.create({
    data: {
      name: name.trim(),
      code: code,
      course: {
        connect: {
          id: courseId,
        },
      },
      participants: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      participants: true,
      course: true,
    },
  })

  // invalidate graphql response cache
  ctx.emitter.emit('invalidate', {
    typename: 'ParticipantGroup',
    id: participantGroup.id,
  })

  return {
    ...participantGroup,
    score:
      participantGroup.averageMemberScore + participantGroup.groupActivityScore,
  }
}

interface JoinParticipantGroupArgs {
  courseId: string
  code: number
}

export async function joinParticipantGroup(
  { courseId, code }: JoinParticipantGroupArgs,
  ctx: ContextWithUser
) {
  // find participantgroup with code
  const participantGroup = await ctx.prisma.participantGroup.findUnique({
    where: {
      courseId_code: {
        courseId,
        code,
      },
    },
    include: {
      course: true,
    },
  })

  // if no participant group with the provided id exists in this course or at all, return null
  if (!participantGroup || participantGroup.course?.id !== courseId) return null

  // otherwise update the participant group with the current participant and return it
  const updatedParticipantGroup = await ctx.prisma.participantGroup.update({
    where: {
      courseId_code: {
        courseId,
        code,
      },
    },
    data: {
      participants: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      participants: true,
      course: true,
    },
  })

  return {
    ...updatedParticipantGroup,
    score:
      updatedParticipantGroup.averageMemberScore +
      updatedParticipantGroup.groupActivityScore,
  }
}

interface LeaveParticipantGroupArgs {
  groupId: string
  courseId: string
}

export async function leaveParticipantGroup(
  { groupId, courseId }: LeaveParticipantGroupArgs,
  ctx: ContextWithUser
) {
  // find participantgroup with corresponding id
  const participantGroup = await ctx.prisma.participantGroup.findUnique({
    where: {
      id: groupId,
    },
    include: {
      participants: true,
    },
  })

  // if no participant group with the provided id exists in this course or at all, return null
  if (!participantGroup) return null

  // if the participant is the only one in the group, delete the group
  if (participantGroup.participants.length === 1) {
    await ctx.prisma.participantGroup.delete({
      where: {
        id: groupId,
      },
    })

    // invalidate graphql response cache
    ctx.emitter.emit('invalidate', {
      typename: 'ParticipantGroup',
      id: groupId,
    })

    return null
  }

  // otherwise update the participant group with the current participant and return it
  const updatedParticipantGroup = await ctx.prisma.participantGroup.update({
    where: {
      id: groupId,
    },
    data: {
      participants: {
        disconnect: {
          id: ctx.user.sub,
        },
      },
    },
    include: {
      participants: true,
      course: true,
    },
  })

  return {
    ...updatedParticipantGroup,
    score:
      updatedParticipantGroup.averageMemberScore +
      updatedParticipantGroup.groupActivityScore,
  }
}

interface GetParticipantGroupsArgs {
  courseId: string
}

export async function getParticipantGroups(
  { courseId }: GetParticipantGroupsArgs,
  ctx: ContextWithUser
) {
  // find participant with correspoinding id ctx.user.sub and return all his participant groups with correct id
  const participant = await ctx.prisma.participant.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      participantGroups: {
        where: {
          course: {
            id: courseId,
          },
        },
        include: {
          participants: {
            include: {
              leaderboards: {
                where: {
                  courseId,
                  type: LeaderboardType.COURSE,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!participant || !participant.participantGroups) return []

  return participant.participantGroups.map((group) => ({
    ...group,
    score: group.averageMemberScore + group.groupActivityScore,
    participants: R.sortWith(
      [R.descend(R.prop('score')), R.ascend(R.prop('username'))],
      group.participants.map((participant) => ({
        ...participant,
        score: participant.leaderboards[0]?.score ?? 0,
        isSelf: participant.id === ctx.user.sub,
      }))
    ).map((entry, ix) => ({ ...entry, rank: ix + 1 })),
  }))
}

interface ClueInput {
  name: string
  displayName: string
  type: ParameterType
  value: string
  unit?: string | null
}

interface CreateGroupActivityArgs {
  id?: string
  name: string
  displayName: string
  description?: string | null
  courseId: string
  multiplier: number
  startDate: Date
  endDate: Date
  clues: ClueInput[]
  stack: StackInput
}

export async function manipulateGroupActivity(
  {
    id,
    name,
    displayName,
    description,
    courseId,
    multiplier,
    startDate,
    endDate,
    clues,
    stack,
  }: CreateGroupActivityArgs,
  ctx: ContextWithUser
) {
  const elements = stack.elements
    .map((stackElem) => stackElem.elementId)
    .filter(
      (stackElem) => stackElem !== null && typeof stackElem !== 'undefined'
    )

  const dbElements = await ctx.prisma.element.findMany({
    where: {
      id: { in: elements },
      ownerId: ctx.user.sub,
    },
  })

  const uniqueElements = new Set(dbElements.map((q) => q.id))
  if (dbElements.length !== uniqueElements.size) {
    throw new GraphQLError('Not all elements could be found')
  }

  const elementMap = dbElements.reduce<Record<number, Element>>(
    (acc, elem) => ({ ...acc, [elem.id]: elem }),
    {}
  )

  const newId = uuidv4()
  const createOrUpdateJSON = {
    id: id ?? newId,
    name: name,
    displayName: displayName,
    description: description,
    status: GroupActivityStatus.DRAFT,
    scheduledStartAt: startDate,
    scheduledEndAt: endDate,
    parameters: {},
    pointsMultiplier: 2,
    clues: {
      connectOrCreate: [
        ...clues.map((clue) => ({
          where: {
            groupActivityId_name: {
              groupActivityId: id ?? newId,
              name: clue.name,
            },
          },
          create: {
            name: clue.name,
            displayName: clue.displayName,
            type: clue.type,
            value: clue.value,
            unit: clue.unit,
          },
        })),
      ],
    },
    stacks: {
      create: {
        type: ElementStackType.GROUP_ACTIVITY,
        order: 0,
        displayName: stack.displayName,
        description: stack.description,
        options: {},
        elements: {
          create: stack.elements.map((elem) => {
            const element = elementMap[elem.elementId]
            const processedElementData = processElementData(element)

            return {
              elementType: element.type,
              migrationId: uuidv4(),
              order: elem.order,
              type: ElementInstanceType.GROUP_ACTIVITY,
              elementData: processedElementData,
              options: {
                pointsMultiplier: multiplier * element.pointsMultiplier,
              },
              results: getInitialElementResults(processedElementData),
              element: {
                connect: { id: element.id },
              },
              owner: {
                connect: { id: ctx.user.sub },
              },
            }
          }),
        },
      },
    },
    owner: {
      connect: {
        id: ctx.user.sub,
      },
    },
    course: {
      connect: {
        id: courseId,
      },
    },
  }

  const groupActivity = await ctx.prisma.groupActivity.upsert({
    where: {
      id: id ?? newId,
    },
    create: createOrUpdateJSON,
    update: createOrUpdateJSON,
  })

  return groupActivity
}

export async function updateGroupAverageScores(ctx: Context) {
  const groupsWithParticipants = await ctx.prisma.participantGroup.findMany({
    include: {
      participants: {
        include: {
          leaderboards: {
            where: { type: LeaderboardType.COURSE },
          },
        },
      },
    },
  })

  try {
    await Promise.all(
      groupsWithParticipants.map((group) => {
        const aggregate = group.participants.reduce(
          (acc, participant) => {
            const matchingLeaderboard = participant.leaderboards.find(
              (item) => item.courseId === group.courseId
            )
            return {
              sum: acc.sum + (matchingLeaderboard?.score ?? 0),
              count: acc.count + 1,
            }
          },
          {
            sum: 0,
            count: 0,
          }
        )

        if (aggregate.count === 0) return Promise.resolve()

        // compute the average score of all participants in the group
        // if it has not changed, exit early
        // if the group consists of only one participant, the member score should be zero
        const averageMemberScore =
          aggregate.count > 1 ? Math.round(aggregate.sum / aggregate.count) : 0

        if (averageMemberScore === group.averageMemberScore)
          return Promise.resolve()

        ctx.emitter.emit('invalidate', {
          typename: 'ParticipantGroup',
          id: group.id,
        })

        return ctx.prisma.participantGroup.update({
          where: { id: group.id },
          data: { averageMemberScore },
        })
      })
    )

    // send a heartbeat to the uptime monitor
    if (typeof process.env.HEARTBEAT_DAILY_GROUP_SCORES === 'string') {
      await fetch(process.env.HEARTBEAT_DAILY_GROUP_SCORES)
    }
  } catch (e) {
    console.error(e)
  }

  return true
}

interface GetGroupActivityDetailsArgs {
  activityId: string
  groupId: string
}

export async function getGroupActivityDetails(
  { activityId, groupId }: GetGroupActivityDetailsArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id: activityId },
    include: {
      course: true,
      clues: {
        orderBy: {
          displayName: 'asc',
        },
      },
      stacks: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      parameters: true,
    },
  })

  const group = await ctx.prisma.participantGroup.findUnique({
    where: { id: groupId },
    include: {
      participants: true,
    },
  })

  if (!groupActivity || !group) return null

  // ensure that the requesting participant is part of the group and that the group activity is active
  if (
    !group.participants.some(
      (participant) => participant.id === ctx.user.sub
    ) ||
    dayjs().isBefore(groupActivity.scheduledStartAt)
  ) {
    return null
  }

  const activityInstance = await ctx.prisma.groupActivityInstance.findUnique({
    where: {
      groupActivityId_groupId: {
        groupActivityId: activityId,
        groupId,
      },
    },
    include: {
      clueInstanceAssignment: {
        include: {
          groupActivityClueInstance: true,
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

  // if the group activity has ended and no decisions / results have been provided, return null
  if (
    dayjs().isAfter(groupActivity.scheduledEndAt) &&
    (!activityInstance?.decisionsSubmittedAt ||
      !activityInstance?.resultsComputedAt)
  ) {
    return null
  }

  return {
    ...groupActivity,
    group,
    activityInstance: activityInstance
      ? {
          ...activityInstance,
          clues: activityInstance?.clueInstanceAssignment.map(
            (clueAssignment) => {
              if (clueAssignment.participantId === ctx.user.sub) {
                return {
                  ...clueAssignment.groupActivityClueInstance,
                  participant: {
                    ...clueAssignment.participant,
                    isSelf: true,
                  },
                }
              }

              return {
                ...R.dissoc('value', clueAssignment.groupActivityClueInstance),
                participant: {
                  ...clueAssignment.participant,
                  isSelf: false,
                },
              }
            }
          ),
        }
      : null,
  }
}

export async function startGroupActivity(
  { activityId, groupId }: GetGroupActivityDetailsArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id: activityId },
    include: {
      course: true,
      clues: {
        orderBy: {
          displayName: 'asc',
        },
      },
      stacks: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      parameters: true,
    },
  })

  const group = await ctx.prisma.participantGroup.findUnique({
    where: { id: groupId },
    include: {
      participants: true,
    },
  })

  if (!groupActivity || !group) return null

  // ensure that the requesting participant is part of the group
  if (
    !group.participants.some((participant) => participant.id === ctx.user.sub)
  ) {
    return null
  }

  // before the active date, return null
  if (
    dayjs().isBefore(groupActivity.scheduledStartAt) ||
    dayjs().isAfter(groupActivity.scheduledEndAt)
  ) {
    return null
  }

  const groupMemberCount = group.participants.length
  if (groupMemberCount < 2) return null

  const allClues = [
    ...groupActivity.clues.map(
      R.pick(['name', 'displayName', 'type', 'unit', 'value'])
    ),
    ...groupActivity.parameters.map((parameter) => ({
      ...R.pick(['name', 'displayName', 'type', 'unit'], parameter),
      value: pickRandom(parameter.options),
    })),
  ]

  try {
    const activityInstance = await ctx.prisma.$transaction(async (prisma) => {
      const activityInstance = await prisma.groupActivityInstance.create({
        data: {
          group: {
            connect: { id: groupId },
          },
          groupActivity: {
            connect: { id: activityId },
          },
          clues: {
            create: allClues,
          },
        },
        include: {
          clues: true,
        },
      })

      const shuffledClues = shuffle(activityInstance.clues)

      const clueAssignments = group.participants.reduce<{
        remainingClues: number
        remainingMembers: number
        startIx: number
        clues: any[]
      }>(
        (acc, participant) => {
          const numOfClues = Math.ceil(
            acc.remainingClues / acc.remainingMembers
          )
          const endIx = acc.startIx + numOfClues
          const clues = shuffledClues.slice(acc.startIx, endIx)

          return {
            remainingClues: acc.remainingClues - numOfClues,
            remainingMembers: acc.remainingMembers - 1,
            startIx: endIx,
            clues: [
              ...acc.clues,
              ...clues.map((clue) => ({
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
          remainingClues: groupActivity.clues.length,
          remainingMembers: groupMemberCount,
          startIx: 0,
          clues: [],
        }
      )

      const updatedActivityInstance = await prisma.groupActivityInstance.update(
        {
          where: { id: activityInstance.id },
          data: {
            clueInstanceAssignment: {
              create: clueAssignments.clues,
            },
          },
          include: {
            clueInstanceAssignment: {
              include: {
                groupActivityClueInstance: true,
                participant: true,
              },
            },
          },
        }
      )

      return updatedActivityInstance
    })

    return {
      ...groupActivity,
      group,
      activityInstance,
    }
  } catch (e) {
    console.error(e)
    return null
  }
}

export async function submitGroupActivityDecisions(
  {
    activityId,
    responses,
  }: Partial<RespondToElementStackInput> & { activityId: number },
  ctx: ContextWithUser
) {
  const groupActivityInstance =
    await ctx.prisma.groupActivityInstance.findUnique({
      where: { id: activityId },
      include: {
        groupActivity: true,
        group: {
          include: {
            participants: {
              where: {
                id: ctx.user.sub,
              },
            },
          },
        },
      },
    })

  // if the instance does not exist or the logged-in participant is not part of the group
  // or if the results have already been submitted
  if (
    !groupActivityInstance ||
    groupActivityInstance.group.participants.length === 0 ||
    !!groupActivityInstance.decisionsSubmittedAt ||
    groupActivityInstance.groupActivity.status === GroupActivityStatus.DRAFT
  ) {
    return null
  }

  // before the active date, return null
  if (
    dayjs().isBefore(groupActivityInstance.groupActivity.scheduledStartAt) ||
    dayjs().isAfter(groupActivityInstance.groupActivity.scheduledEndAt)
  ) {
    return null
  }

  // save answers on instances in aggregated form
  await Promise.all(
    responses!.flatMap((inputResponse) => {
      return ctx.prisma.$transaction(async (prisma) => {
        if (inputResponse.type === ElementType.CONTENT) return []
        const instanceId = inputResponse.instanceId

        // fetch the existing instance
        const instance = await prisma.elementInstance.findUnique({
          where: { id: instanceId },
        })
        if (!instance || !instance.elementData) return []

        let response
        if (
          inputResponse.type === ElementType.SC ||
          inputResponse.type === ElementType.MC ||
          inputResponse.type === ElementType.KPRIM
        ) {
          response = { choices: inputResponse.choicesResponse }
        } else if (inputResponse.type === ElementType.NUMERICAL) {
          response = { value: String(inputResponse.numericalResponse) }
        } else if (inputResponse.type === ElementType.FREE_TEXT) {
          response = { value: inputResponse.freeTextResponse }
        } else {
          console.log('Element type not supported for group activity')
          return
        }

        // compute the updated results
        const updatedResults = updateQuestionResults({
          instance,
          elementData: instance.elementData,
          response: response,
        })

        // update the instance with the new results
        await prisma.elementInstance.update({
          where: { id: instanceId },
          data: {
            results: updatedResults.results,
          },
        })
      })
    })
  )

  const updatedActivityInstance = await ctx.prisma.groupActivityInstance.update(
    {
      where: { id: activityId },
      data: {
        decisions: responses,
        decisionsSubmittedAt: new Date(),
      },
    }
  )

  // return updatedActivityInstance
  return updatedActivityInstance.id
}

interface GetGroupActivityArgs {
  id: string
}

export async function getGroupActivity(
  { id }: GetGroupActivityArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      course: true,
      clues: true,
      activityInstances: {
        include: {
          group: true,
        },
      },
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  return groupActivity
}

export async function publishGroupActivity(
  { id }: GetGroupActivityArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id, ownerId: ctx.user.sub },
  })

  if (!groupActivity) return null

  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id },
    data: {
      status: GroupActivityStatus.PUBLISHED,
    },
  })

  return updatedGroupActivity
}

export async function unpublishGroupActivity(
  { id }: GetGroupActivityArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id, ownerId: ctx.user.sub },
  })

  if (!groupActivity) return null

  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id },
    data: {
      status: GroupActivityStatus.DRAFT,
    },
  })

  return updatedGroupActivity
}

export async function deleteGroupActivity(
  { id }: GetGroupActivityArgs,
  ctx: ContextWithUser
) {
  try {
    const deletedItem = await ctx.prisma.groupActivity.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
        status: GroupActivityStatus.DRAFT,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'GroupActivity', id })

    return deletedItem
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
      console.warn(
        'The group activity is already published and cannot be deleted anymore.'
      )
      return null
    }

    throw e
  }
}
