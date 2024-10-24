import {
  type Course,
  type Element,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  GroupActivityStatus,
  LeaderboardType,
  ParameterType,
  type Participant,
  type ParticipantGroup,
} from '@klicker-uzh/prisma'
import { ResponseCorrectness, type StackInput } from '@klicker-uzh/types'
import {
  getInitialElementResults,
  getInitialInstanceStatistics,
  processElementData,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { omitBy, pick, prop, sortBy } from 'remeda'
import type { ElementInstanceOptions } from 'src/ops.js'
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from 'unique-names-generator'
import { v4 as uuidv4 } from 'uuid'
import type { Context, ContextWithUser } from '../lib/context.js'
import {
  splitGroupsFinal,
  splitGroupsRunning,
} from '../lib/randomizedGroups.js'
import { sendTeamsNotifications, shuffle } from '../lib/util.js'
import * as EmailService from '../services/email.js'
import {
  type RespondToElementStackInput,
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
  if (!course || !course.isGroupCreationEnabled || name.trim() === '') {
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

async function createRandomGroup(
  {
    courseId,
    groupParticipantIds,
  }: { courseId: string; groupParticipantIds: string[] },
  ctx: Context
) {
  const code = 100000 + Math.floor(Math.random() * 900000)
  const groupName =
    uniqueNamesGenerator({
      dictionaries: [colors, adjectives, animals],
      separator: ' ',
      style: 'capital',
    }) + 's'

  // create group and remove participants from the pool
  await ctx.prisma.$transaction([
    ctx.prisma.participantGroup.create({
      data: {
        randomlyAssigned: true,
        name: groupName,
        code: code,
        course: {
          connect: {
            id: courseId,
          },
        },
        participants: {
          connect: groupParticipantIds.map((id) => ({ id })),
        },
      },
    }),
    ctx.prisma.groupAssignmentPoolEntry.deleteMany({
      where: {
        courseId,
        participantId: {
          in: groupParticipantIds,
        },
      },
    }),
  ])
}

export async function runningRandomGroupAssignments(ctx: Context) {
  // fetch all courses with future group deadlines
  const courses = await ctx.prisma.course.findMany({
    where: {
      randomAssignmentFinalized: false,
      isGroupCreationEnabled: true,
      groupDeadlineDate: {
        gt: new Date(),
      },
    },
    include: {
      groupAssignmentPoolEntries: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  // filter the courses down to those, which contain more than 2 * preferredGroupSize participants in the pool
  const coursesToUpdate = courses.filter(
    (course) =>
      course.groupAssignmentPoolEntries.length >= 2 * course.preferredGroupSize
  )

  // update the group assignments for all courses that have enough participants in the pool
  for (const course of coursesToUpdate) {
    try {
      const { participantIds, poolEntryIds } =
        course.groupAssignmentPoolEntries.reduce<{
          participantIds: string[]
          poolEntryIds: number[]
        }>(
          (acc, entry) => {
            acc.participantIds.push(entry.participantId)
            acc.poolEntryIds.push(entry.id)
            return acc
          },
          { participantIds: [], poolEntryIds: [] }
        )

      // split the participants into groups
      const { groups } = splitGroupsRunning({
        participantIds,
        preferredGroupSize: course.preferredGroupSize,
      })

      for (const groupParticipantIds of groups) {
        await createRandomGroup(
          { courseId: course.id, groupParticipantIds },
          ctx
        )
      }

      // invalidate the corresponding participants, course and group assignment pool entries in the cache
      ctx.emitter.emit('invalidate', {
        typename: 'Course',
        id: course.id,
      })
      participantIds.forEach((participantId) => {
        ctx.emitter.emit('invalidate', {
          typename: 'Participant',
          id: participantId,
        })
      })
      poolEntryIds.forEach((poolEntryId) => {
        ctx.emitter.emit('invalidate', {
          typename: 'GroupAssignmentPoolEntry',
          id: poolEntryId,
        })
      })

      await sendTeamsNotifications(
        'graphql/runningRandomGroupAssignments',
        `Successfully assigned new random groups for ${course.name} (id: ${course.id}; rolling assignment).`
      )
    } catch (e) {
      console.error(e)
      await sendTeamsNotifications(
        'graphql/runningRandomGroupAssignments',
        `Failed to assign groups for course ${course.name} (id: ${course.id}; rolling assignment) with error: ${
          e || 'missing'
        }`
      )
    }
  }

  return true
}

async function resolveSingleParticipantGroups(
  {
    course,
  }: {
    course: Course & {
      participantGroups: (Pick<ParticipantGroup, 'id'> & {
        participants: Pick<Participant, 'id'>[]
      })[]
    }
  },
  ctx: Context
) {
  const singleParticipantGroups = course.participantGroups
    .filter((group) => group.participants.length === 1)
    .map((group) => ({
      groupId: group.id,
      participantId: group.participants[0]!.id,
    }))

  const courseExtendedPool = await ctx.prisma.course.update({
    where: { id: course.id },
    data: {
      groupAssignmentPoolEntries: {
        create: singleParticipantGroups.map(({ participantId }) => ({
          participant: {
            connect: { id: participantId },
          },
        })),
      },
      participantGroups: {
        deleteMany: {
          id: {
            in: singleParticipantGroups.map(({ groupId }) => groupId),
          },
        },
      },
    },
    include: {
      groupAssignmentPoolEntries: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  })

  // invalidate cache for the resolve participant groups
  singleParticipantGroups.forEach(({ groupId }) => {
    ctx.emitter.emit('invalidate', {
      typename: 'ParticipantGroup',
      id: groupId,
    })
  })

  return courseExtendedPool
}

export async function finalRandomGroupAssignments(ctx: Context) {
  // fetch all courses with past group deadlines
  const courses = await ctx.prisma.course.findMany({
    where: {
      randomAssignmentFinalized: false,
      isGroupCreationEnabled: true,
      groupDeadlineDate: {
        lte: new Date(),
      },
    },
    include: {
      groupAssignmentPoolEntries: {
        orderBy: {
          createdAt: 'asc',
        },
      },
      participantGroups: {
        select: {
          id: true,
          participants: {
            select: {
              id: true,
            },
          },
        },
      },
      owner: true,
    },
  })

  for (const course of courses) {
    try {
      // resolve all groups with a single participant and add them to the pool ids
      // update the course table in case the operation is interrupted to ensure that no ids are lost
      const courseId = course.id
      const courseExtendedPool = await resolveSingleParticipantGroups(
        { course },
        ctx
      )

      await sendTeamsNotifications(
        'graphql/finalRandomGroupAssignments',
        `Resolved all single participant groups for course ${course.name} (id: ${course.id}).`
      )

      const poolParticipantIds =
        courseExtendedPool.groupAssignmentPoolEntries.map(
          (entry) => entry.participantId
        )

      // if the assignment pool is empty, set the finalization boolean and return success
      if (poolParticipantIds.length === 0) {
        await ctx.prisma.course.update({
          where: { id: courseId },
          data: {
            randomAssignmentFinalized: true,
          },
        })

        continue
      }

      // if only one participant is in the pool, send an email to the lecturer to extend group deadline
      if (poolParticipantIds.length === 1) {
        const courseGroupsOverviewLink = `${
          process.env.NODE_ENV === 'production' ? 'https' : 'http'
        }://${process.env.APP_MANAGE_DOMAIN}/courses/${course.id}?gamificationTab=groups`

        const emailHtml = await EmailService.hydrateTemplate(
          {
            templateName: 'RandomizedGroupCreationFailure',
            variables: {
              COURSE_NAME: course.name,
              LINK: courseGroupsOverviewLink,
            },
          },
          ctx
        )

        if (!emailHtml) {
          continue
        }

        await EmailService.sendEmail({
          to: course.owner.email,
          subject: `KlickerUZH - Group Creation for Course ${course.name}`,
          text: `The automated random group creation for your course ${course.name} has failed. Please refer to the course overview for more details and to change the group creation deadline: ${courseGroupsOverviewLink}.`,
          html: emailHtml,
        })

        await sendTeamsNotifications(
          'graphql/finalRandomGroupAssignments',
          `Failure of automatic group assignment - single participant in pool for course ${course.name} (id ${course.id}). Sent E-Mail to course owner with id ${course.ownerId}.`
        )

        continue
      }

      // compute finalized group distribution
      const groups = splitGroupsFinal({
        participantIds: poolParticipantIds,
        preferredGroupSize: course.preferredGroupSize,
      })

      for (const group of groups) {
        await createRandomGroup(
          { courseId: courseId, groupParticipantIds: group },
          ctx
        )
      }

      // set random assignment as finalized on course
      await ctx.prisma.course.update({
        where: { id: courseId },
        data: {
          randomAssignmentFinalized: true,
        },
      })

      await sendTeamsNotifications(
        'graphql/finalRandomGroupAssignments',
        `Successfully completed final random group assignment for course ${course.name} (id ${course.id}) with ${groups.length} new groups.`
      )
    } catch (e) {
      console.error(e)
      await sendTeamsNotifications(
        'graphql/finalRandomGroupAssignments',
        `Failed to finalize random group assignments for course ${course.name} (id: ${course.id}) with error: ${
          e || 'missing'
        }`
      )

      continue
    }
  }

  return true
}

export async function manualRandomGroupAssignments(
  { courseId }: { courseId: string },
  ctx: Context
) {
  // fetch the course and all participants in the pool
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
      randomAssignmentFinalized: false,
      isGroupCreationEnabled: true,
    },
    include: {
      groupAssignmentPoolEntries: {
        orderBy: {
          createdAt: 'asc',
        },
      },
      participantGroups: {
        select: {
          id: true,
          participants: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  })

  // do nothing if the course does not exist
  if (!course) {
    return null
  }

  try {
    // resolve all groups with a single participant and add them to the pool ids
    // update the course table in case the operation is interrupted to ensure that no ids are lost
    const courseExtendedPool = await resolveSingleParticipantGroups(
      { course },
      ctx
    )

    await sendTeamsNotifications(
      'graphql/manualRandomGroupAssignments',
      `Resolved all single participant groups for course ${course.name} (id: ${course.id}).`
    )

    // if the assignment pool is empty, set the finalization boolean and return course
    if (courseExtendedPool.groupAssignmentPoolEntries.length === 0) {
      const courseUpdated = await ctx.prisma.course.update({
        where: { id: courseId },
        data: {
          randomAssignmentFinalized: true,
        },
      })

      return courseUpdated
    }

    // if there is only exactly one participant in the pool, return null - do not update course
    // case is already handled in the frontend with a disabled button
    if (courseExtendedPool.groupAssignmentPoolEntries.length === 1) {
      return null
    }

    // run the final group assignment logic and update the course accordingly
    const groupParticipantIds = splitGroupsFinal({
      participantIds: courseExtendedPool.groupAssignmentPoolEntries.map(
        (entry) => entry.participantId
      ),
      preferredGroupSize: course.preferredGroupSize,
    })

    const newGroups = groupParticipantIds!.map((group) => ({
      randomlyAssigned: true,
      name:
        uniqueNamesGenerator({
          dictionaries: [colors, adjectives, animals],
          separator: ' ',
          style: 'capital',
        }) + 's',
      code: 100000 + Math.floor(Math.random() * 900000),
      participants: {
        connect: group.map((id) => ({ id })),
      },
    }))

    // update the course
    const updatedCourse = await ctx.prisma.course.update({
      where: { id: courseId },
      data: {
        groupDeadlineDate: dayjs().subtract(1, 'day').toDate(),
        randomAssignmentFinalized: true,
        participantGroups: {
          create: newGroups,
        },
        groupAssignmentPoolEntries: {
          deleteMany: {},
        },
      },
      include: {
        participantGroups: true,
      },
    })

    // invalidate the cache of the course and the group assignment pool entries
    ctx.emitter.emit('invalidate', {
      typename: 'Course',
      id: courseId,
    })
    courseExtendedPool.groupAssignmentPoolEntries.forEach((entry) => {
      ctx.emitter.emit('invalidate', {
        typename: 'GroupAssignmentPoolEntry',
        id: entry.id,
      })
    })

    await sendTeamsNotifications(
      'graphql/manualRandomGroupAssignments',
      `Successfully completed random group assignment for course ${course.name} (id: ${course.id}) with ${newGroups.length} new groups.`
    )

    return updatedCourse
  } catch (e) {
    console.error(e)
    await sendTeamsNotifications(
      'graphql/manualRandomGroupAssignments',
      `Random group creation failed for course ${course.name} (id: ${course.id}) with error: ${
        e || 'missing'
      }`
    )

    return null
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
  if (!participantGroup || !participantGroup.course) {
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

export async function renameParticipantGroup(
  {
    groupId,
    name,
  }: {
    groupId: string
    name: string
  },
  ctx: ContextWithUser
) {
  if (name.trim() === '') {
    return null
  }

  const updatedGroup = await ctx.prisma.participantGroup.update({
    where: {
      id: groupId,
    },
    data: {
      name: name.trim(),
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'ParticipantGroup',
    id: groupId,
  })

  return updatedGroup
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
          messages: {
            orderBy: {
              createdAt: 'desc',
            },
            include: {
              participant: true,
            },
          },
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
    participants: sortBy(
      group.participants.map((participant) => ({
        ...participant,
        score: participant.leaderboards[0]?.score ?? 0,
        isSelf: participant.id === ctx.user.sub,
      })),
      [prop('score'), 'desc'],
      [prop('username'), 'asc']
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
        isDeleted: false,
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
      oldElement.status === GroupActivityStatus.SCHEDULED ||
      oldElement.status === GroupActivityStatus.PUBLISHED ||
      oldElement.status === GroupActivityStatus.GRADED
    ) {
      throw new GraphQLError('Can only edit draft group activities')
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
            const initialResults = getInitialElementResults(element)

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
    where: {
      id: activityId,
      status: {
        in: [
          GroupActivityStatus.PUBLISHED,
          GroupActivityStatus.ENDED,
          GroupActivityStatus.GRADED,
        ],
      },
      isDeleted: false,
    },
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
    !group.participants.some((participant) => participant.id === ctx.user.sub)
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
                  : omitBy(
                      clueAssignment.groupActivityClueInstance,
                      (_, key) => key === 'value'
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
    where: { id: activityId, status: GroupActivityStatus.PUBLISHED },
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
      // parameters: true, // TODO: reintroduce as soon as these are used
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
    ...groupActivity.clues.map((clue) => ({
      ...pick(clue, ['name', 'displayName', 'type', 'unit', 'value']),
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
    groupActivityInstance.groupActivity.status === GroupActivityStatus.DRAFT ||
    groupActivityInstance.groupActivity.status ===
      GroupActivityStatus.SCHEDULED ||
    groupActivityInstance.groupActivity.status === GroupActivityStatus.ENDED
  ) {
    return null
  }

  // before the active date or after the end date, return null
  // scheduled and ended states should already catch these cases in general, simply to avoid edge cases
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
    where: { id, ownerId: ctx.user.sub, isDeleted: false },
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

  const now = new Date()
  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id },
    data: {
      status:
        now < groupActivity.scheduledStartAt
          ? GroupActivityStatus.SCHEDULED
          : now > groupActivity.scheduledEndAt
            ? GroupActivityStatus.ENDED
            : GroupActivityStatus.PUBLISHED,
    },
  })

  return updatedGroupActivity
}

export async function unpublishGroupActivity(
  { id }: GetGroupActivityArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
      status: GroupActivityStatus.SCHEDULED,
      isDeleted: false,
    },
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

export async function openGroupActivity(
  { id }: GetGroupActivityArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
      status: GroupActivityStatus.SCHEDULED,
      isDeleted: false,
    },
  })

  if (!groupActivity) return null

  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id },
    data: {
      status: GroupActivityStatus.PUBLISHED,
      scheduledStartAt: new Date(),
    },
  })

  // trigger subscription to immediately update student frontend
  ctx.pubSub.publish('groupActivityStarted', updatedGroupActivity)

  return updatedGroupActivity
}

export async function endGroupActivity(
  { id }: GetGroupActivityArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
      status: GroupActivityStatus.PUBLISHED,
      isDeleted: false,
    },
  })

  if (!groupActivity) return null

  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id },
    data: {
      status: GroupActivityStatus.ENDED,
      scheduledEndAt: new Date(),
    },
  })

  // trigger subscription to immediately update student frontend
  ctx.pubSub.publish('groupActivityEnded', updatedGroupActivity)
  ctx.pubSub.publish('singleGroupActivityEnded', updatedGroupActivity)

  return updatedGroupActivity
}

export async function deleteGroupActivity(
  { id }: GetGroupActivityArgs,
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id, ownerId: ctx.user.sub },
    include: {
      activityInstances: true,
    },
  })

  if (!groupActivity) {
    return null
  }

  // if the the group activity is not yet published / has not started or has no instances -> hard deletion
  // as soon as an instance exists (independent of results) -> soft deletion
  if (
    groupActivity.status === GroupActivityStatus.DRAFT ||
    groupActivity.status === GroupActivityStatus.SCHEDULED ||
    groupActivity.activityInstances.length === 0
  ) {
    const deletedItem = await ctx.prisma.groupActivity.delete({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'GroupActivity', id })
    return deletedItem
  } else {
    // if the group activity already has active instance, only soft delete it
    const updatedGroupActivity = await ctx.prisma.groupActivity.update({
      where: {
        id,
        ownerId: ctx.user.sub,
      },
      data: {
        isDeleted: true,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
    return updatedGroupActivity
  }
}

export async function getCourseGroupActivities(
  {
    courseId,
  }: {
    courseId: string
  },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      groupActivities: {
        where: {
          status: {
            in: [
              GroupActivityStatus.SCHEDULED,
              GroupActivityStatus.PUBLISHED,
              GroupActivityStatus.ENDED,
              GroupActivityStatus.GRADED,
            ],
          },
          isDeleted: false,
        },
        orderBy: {
          scheduledStartAt: 'desc',
        },
      },
    },
  })

  return course?.groupActivities
}

export async function getGroupActivityInstances(
  { groupId, courseId }: { groupId: string; courseId: string },
  ctx: ContextWithUser
) {
  const instances = await ctx.prisma.groupActivityInstance.findMany({
    where: {
      groupActivity: {
        course: {
          id: courseId,
        },
      },
      group: {
        id: groupId,
      },
    },
  })

  return instances
}

export async function getGroupActivitySummary(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: {
      id,
      ownerId: ctx.user.sub,
    },
    include: {
      activityInstances: true,
    },
  })

  if (!groupActivity) {
    return null
  }

  const numOfStartedInstances = groupActivity.activityInstances.filter(
    (instance) => instance.decisionsSubmittedAt === null
  ).length
  const numOfSubmissions =
    groupActivity.activityInstances.length - numOfStartedInstances

  return {
    numOfStartedInstances,
    numOfSubmissions,
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

export async function extendGroupActivity(
  {
    id,
    endDate,
  }: {
    id: string
    endDate: Date
  },
  ctx: ContextWithUser
) {
  // check that the new end date lies in the future
  if (endDate < new Date()) {
    return null
  }

  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: {
      id,
      ownerId: ctx.user.sub,
      status: {
        in: [GroupActivityStatus.SCHEDULED, GroupActivityStatus.PUBLISHED],
      },
      scheduledEndAt: { gt: new Date() },
    },
    data: {
      scheduledEndAt: endDate,
    },
  })

  return updatedGroupActivity
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

export async function getCourseGroups(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      participantGroups: {
        include: {
          participants: true,
        },
      },
      groupAssignmentPoolEntries: {
        include: {
          participant: true,
        },
      },
    },
  })

  return course
}

export async function addMessageToGroup(
  {
    groupId,
    content,
  }: {
    groupId: string
    content: string
  },
  ctx: ContextWithUser
) {
  // ensure that the currently logged in user is actually a participant of the group
  const group = await ctx.prisma.participantGroup.findUnique({
    where: { id: groupId },
    include: {
      participants: true,
    },
  })

  if (!group) return null

  // if the participant is not part of the group, return early
  if (
    !group.participants.some((participant) => participant.id === ctx.user.sub)
  ) {
    return null
  }

  // create a new message
  const message = await ctx.prisma.groupMessage.create({
    data: {
      content,
      group: {
        connect: { id: groupId },
      },
      participant: {
        connect: { id: ctx.user.sub },
      },
    },
    include: {
      group: true,
      participant: true,
    },
  })

  return message
}
