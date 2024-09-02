import {
  Element,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  GroupActivityStatus,
  LeaderboardType,
  ParameterType,
} from '@klicker-uzh/prisma'
import { PrismaClientKnownRequestError } from '@klicker-uzh/prisma/dist/runtime/library.js'
import {
  getInitialElementResults,
  getInitialInstanceStatistics,
  processElementData,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { pickRandom } from 'mathjs'
import * as R from 'ramda'
import { ElementInstanceOptions } from 'src/ops.js'
import { v4 as uuidv4 } from 'uuid'
import { Context, ContextWithUser } from '../lib/context.js'
import { shuffle } from '../lib/util.js'
import { ResponseCorrectness, StackInput } from '../types/app.js'
import {
  RespondToElementStackInput,
  updateQuestionResults,
} from './practiceQuizzes.js'

const POINTS_PER_GROUP_ACTIVITY_ELEMENT = 25

interface CreateParticipantGroupArgs {
  courseId: string
  name: string
}

export async function createParticipantGroup(
  { courseId, name }: CreateParticipantGroupArgs,
  ctx: ContextWithUser
) {
  // check if group creation is enabled on course
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
    },
  })
  if (!course || !course.isGroupCreationEnabled) {
    return null
  }

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

export async function joinRandomCourseGroupPool(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  // check if group creation is enabled on course
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
    },
  })
  if (!course || !course.isGroupCreationEnabled) {
    return false
  }

  // add the participant to the pool of waiting participants
  const poolEntry = await ctx.prisma.groupAssignmentPoolEntry.upsert({
    where: {
      courseId_participantId: {
        courseId,
        participantId: ctx.user.sub,
      },
    },
    create: {
      course: {
        connect: {
          id: courseId,
        },
      },
      participant: {
        connect: {
          id: ctx.user.sub,
        },
      },
    },
    update: {},
  })

  if (poolEntry) {
    // return success
    return true
  }
  return false
}

export async function leaveRandomCourseGroupPool(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  // check if group creation is enabled on course and if a corresponding pool entry exists
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
    },
    include: {
      groupAssignmentPoolEntries: {
        where: {
          participantId: ctx.user.sub,
        },
      },
    },
  })
  if (
    !course ||
    !course.isGroupCreationEnabled ||
    course.groupAssignmentPoolEntries.length === 0
  ) {
    return false
  }

  // remove the participant from the pool
  try {
    await ctx.prisma.groupAssignmentPoolEntry.delete({
      where: {
        courseId_participantId: {
          courseId,
          participantId: ctx.user.sub,
        },
      },
    })
    return true
  } catch (e) {
    return false
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
      participants: {
        include: {
          leaderboards: true,
        },
      },
    },
  })

  // if no participant group exists in this course with the provided code, return failure
  if (!participantGroup) {
    return 'FAILURE'
  }

  // if the group is full, return full
  if (
    participantGroup.participants.length >= participantGroup.course.maxGroupSize
  ) {
    return 'FULL'
  }

  // fetch the current participants score
  const lbEntry = await ctx.prisma.leaderboardEntry.findFirst({
    where: {
      participantId: ctx.user.sub,
      courseId: courseId,
      type: LeaderboardType.COURSE,
    },
  })

  const numGroupMembersOld = participantGroup.participants.length
  const aggregateScore =
    participantGroup.averageMemberScore * numGroupMembersOld +
    (lbEntry?.score ?? 0)
  const aggregateCount = numGroupMembersOld + 1
  const averageMemberScore = Math.round(aggregateScore / aggregateCount)

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
      averageMemberScore: averageMemberScore,
    },
    include: {
      participants: true,
      course: true,
    },
  })

  return updatedParticipantGroup.id
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
      participants: {
        include: {
          leaderboards: true,
        },
      },
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

  // compute new average member score for the group without the participant that is leaving
  const aggregate = participantGroup.participants.reduce(
    (acc, participant) => {
      // skip the participant that is about to leave
      if (participant.id === ctx.user.sub) return acc

      const matchingLeaderboard = participant.leaderboards.find(
        (lb) => lb.courseId === courseId && lb.type === LeaderboardType.COURSE
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
  const averageMemberScore = Math.round(aggregate.sum / aggregate.count)

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
      averageMemberScore: averageMemberScore,
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
  if (id) {
    // delete all old instances and clues as their content might have changed
    const oldElement = await ctx.prisma.groupActivity.findUnique({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      include: {
        stacks: true,
        clues: true,
      },
    })

    if (!oldElement) {
      throw new GraphQLError('Group Activity not found')
    }
    if (
      oldElement.status === GroupActivityStatus.PUBLISHED ||
      oldElement.status === GroupActivityStatus.GRADED
    ) {
      throw new GraphQLError('Cannot edit a published or graded group activity')
    }

    await ctx.prisma.groupActivity.update({
      where: { id },
      data: {
        stacks: {
          deleteMany: {},
        },
        clues: {
          deleteMany: {},
        },
      },
    })
  }

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
    pointsMultiplier: multiplier,
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
            const element = elementMap[elem.elementId]!
            const processedElementData = processElementData(element)
            const initialResults =
              getInitialElementResults(processedElementData)

            return {
              elementType: element.type,
              migrationId: uuidv4(),
              order: elem.order,
              type: ElementInstanceType.GROUP_ACTIVITY,
              elementData: processedElementData,
              options: {
                pointsMultiplier: multiplier * element.pointsMultiplier,
              },
              results: initialResults,
              anonymousResults: initialResults,
              instanceStatistics: {
                create: getInitialInstanceStatistics(
                  ElementInstanceType.GROUP_ACTIVITY
                ),
              },
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
                ...(groupActivity.status === GroupActivityStatus.GRADED
                  ? clueAssignment.groupActivityClueInstance
                  : R.dissoc(
                      'value',
                      clueAssignment.groupActivityClueInstance
                    )),
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
          previousResults: instance.results,
          elementData: instance.elementData,
          response: response,
        })

        if (!updatedResults.results) return

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
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
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

interface GetGradingGroupActivityArgs {
  id: string
}

export async function getGradingGroupActivity(
  { id }: GetGradingGroupActivityArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
    include: {
      stacks: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
      },
      activityInstances: {
        include: {
          group: true,
        },
        orderBy: {
          decisionsSubmittedAt: 'asc',
        },
      },
    },
  })

  if (!groupActivity) return null

  const mappedInstances = groupActivity?.activityInstances.map((instance) => ({
    ...instance,
    groupName: instance.group.name,
  }))

  return { ...groupActivity, activityInstances: mappedInstances }
}

interface GradeGroupActivitySubmissionArgs {
  id: number
  gradingDecisions: {
    passed: boolean
    comment?: string | null
    grading: {
      instanceId: number
      score: number
      feedback?: string | null
    }[]
  }
}

export async function gradeGroupActivitySubmission(
  { id, gradingDecisions }: GradeGroupActivitySubmissionArgs,
  ctx: ContextWithUser
) {
  const instanceIds = gradingDecisions.grading.map((res) => res.instanceId)

  // fetch all elementInstances
  const elementInstances = await ctx.prisma.elementInstance.findMany({
    where: {
      owner: { id: ctx.user.sub },
      id: { in: instanceIds },
    },
  })
  const elementInstanceMap = elementInstances.reduce<
    Record<number, ElementInstanceOptions>
  >((acc, instance) => ({ ...acc, [instance.id]: instance.options }), {})

  const updatedInstance = await ctx.prisma.groupActivityInstance.update({
    where: { id },
    data: {
      results: {
        passed: gradingDecisions.passed,
        points: gradingDecisions.grading.reduce(
          (acc, res) => acc + res.score,
          0
        ),
        comment: gradingDecisions.comment,
        grading: gradingDecisions.grading.map((res) => {
          const computedMaxPoints =
            POINTS_PER_GROUP_ACTIVITY_ELEMENT *
            (elementInstanceMap[res.instanceId]?.pointsMultiplier ?? 1)

          return {
            instanceId: res.instanceId,
            score: Math.min(res.score, computedMaxPoints),
            maxPoints: computedMaxPoints,
            feedback: res.feedback,
            correctness:
              res.score === 0
                ? ResponseCorrectness.INCORRECT
                : res.score < computedMaxPoints
                  ? ResponseCorrectness.PARTIAL
                  : ResponseCorrectness.CORRECT,
          }
        }),
      },
    },
  })

  return updatedInstance
}

export async function finalizeGroupActivityGrading(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // find the group activity and all instances
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
    include: {
      activityInstances: true,
    },
  })

  if (!groupActivity) return null

  const solvedInstances =
    groupActivity.activityInstances.filter((instance) => instance.decisions) ??
    []

  // check that all instances with decisions have results
  if (!solvedInstances.every((instance) => instance.results)) {
    return null
  }

  // update the status of the group activity and set resultsComputedAt on group activity instances
  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id },
    data: {
      status: GroupActivityStatus.GRADED,
      activityInstances: {
        updateMany: {
          where: {
            id: {
              in: solvedInstances.map((instance) => instance.id),
            },
          },
          data: {
            resultsComputedAt: new Date(),
          },
        },
      },
    },
    include: {
      activityInstances: {
        include: {
          group: {
            include: {
              participants: {
                include: {
                  leaderboards: {
                    where: {
                      type: LeaderboardType.COURSE,
                      courseId: groupActivity.courseId,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (
    updatedGroupActivity.activityInstances.length === 0 ||
    updatedGroupActivity.activityInstances.some(
      (instance) => instance.decisions && !instance.results
    )
  ) {
    return updatedGroupActivity
  }

  // distribute points and achievements to the participants
  let promises: any[] = []
  const gradedInstances = updatedGroupActivity.activityInstances.filter(
    (instance) => instance.results
  )

  // increment groupActivityScore on participantGroup
  gradedInstances.forEach((instance) => {
    promises.push(
      ctx.prisma.participantGroup.update({
        where: {
          id: instance.groupId,
        },
        data: {
          groupActivityScore: {
            increment: instance.results!.points,
          },
        },
      })
    )
  })

  // create a map between participants and achievements
  const participantAchievementMap = gradedInstances.reduce<
    Record<string, { leaderboard: boolean; achievements: number[] }>
  >((acc, instance) => {
    instance.group.participants.forEach((participant) => {
      acc[participant.id] = {
        achievements: [9],
        leaderboard: participant.leaderboards.length > 0,
      }
      if (instance.results!.passed) {
        acc[participant.id]!.achievements.push(8)
      }
    })

    return acc
  }, {})

  // award the achievements to the participants
  Object.entries(participantAchievementMap).forEach(
    ([participantId, results]) => {
      results.achievements.forEach((id) => {
        // create the participant achievement instance
        promises.push(
          ctx.prisma.participantAchievementInstance.upsert({
            where: {
              participantId_achievementId: {
                participantId: participantId,
                achievementId: id,
              },
            },
            create: {
              participantId: participantId,
              achievementId: id,
              achievedAt: new Date(),
              achievedCount: 1,
            },
            update: {
              achievedCount: {
                increment: 1,
              },
            },
          })
        )

        // participants with achievement id 9 should get 250 xp
        if (id === 9) {
          promises.push(
            ctx.prisma.participant.update({
              where: {
                id: participantId,
              },
              data: {
                xp: {
                  increment: 250,
                },
              },
            })
          )
        }

        // participants with achievement id 8 should get 1000 xp and 500 points in the leaderboard
        if (id === 8) {
          promises.push(
            ctx.prisma.participant.update({
              where: {
                id: participantId,
              },
              data: {
                xp: {
                  increment: 1000,
                },
              },
            })
          )
          if (results.leaderboard) {
            promises.push(
              ctx.prisma.leaderboardEntry.update({
                where: {
                  type_participantId_courseId: {
                    type: 'COURSE',
                    participantId: participantId,
                    courseId: updatedGroupActivity.courseId,
                  },
                },
                data: {
                  score: {
                    increment: 500,
                  },
                },
              })
            )
          }
        }
      })
    }
  )

  await ctx.prisma.$transaction(promises)

  return updatedGroupActivity
}
