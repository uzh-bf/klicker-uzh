import type { ElementInstanceOptions, ResponseInput } from '@/ops.js'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementInstanceResults,
  ElementStackInput,
  HatchetHandlers,
} from '@klicker-uzh/types'
import { ActivityType, ResponseCorrectness } from '@klicker-uzh/types'
import {
  getActivityInstanceConnectOrCreate,
  type PrismaTransactionClient,
  propagateActivityToElements,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import EventEmitter from 'events'
import { GraphQLError } from 'graphql'
import { omitBy, pick, prop, sortBy } from 'remeda'
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
import { computeRanks, shuffle } from '../lib/util.js'
import * as EmailService from '../services/email.js'
import {
  deleteWithPublicationStatusGuard,
  persistActivityWithPermissions,
  UNPUBLISHED_ACTIVITY_STATUSES,
} from './activities.js'
import { splitActivityInstances } from './liveQuizzes.js'
import { sendTeamsNotification } from './notifications.js'
import { upsertDailyTimelineEntry } from './participants.js'
import {
  type RespondToElementStackInput,
  updateCaseStudyResults,
  updateChoicesResults,
  updateFreeTextResults,
  updateNumericalResults,
  updateSelectionResults,
} from './stacks.js'

export const POINTS_PER_GROUP_ACTIVITY_ELEMENT = 25

export async function createParticipantGroup(
  { courseId, name }: { courseId: string; name: string },
  ctx: ContextWithUser
) {
  // check if group creation is enabled on course
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
  })

  if (!course || !course.isGroupCreationEnabled || name.trim() === '') {
    return null
  }

  const code = 100000 + Math.floor(Math.random() * 900000)
  const participantGroup = await ctx.prisma.participantGroup.create({
    data: {
      name: name.trim(),
      code,
      course: { connect: { id: courseId } },
      participants: { connect: { id: ctx.user.sub } },
    },
    include: { participants: true, course: true },
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
    where: { id: courseId },
  })

  if (!course || !course.isGroupCreationEnabled) {
    return false
  }

  // add the participant to the pool of waiting participants
  const poolEntry = await ctx.prisma.groupAssignmentPoolEntry.upsert({
    where: {
      courseId_participantId: { courseId, participantId: ctx.user.sub },
    },
    create: {
      course: { connect: { id: courseId } },
      participant: { connect: { id: ctx.user.sub } },
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
    where: { id: courseId },
    include: {
      groupAssignmentPoolEntries: { where: { participantId: ctx.user.sub } },
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
        courseId_participantId: { courseId, participantId: ctx.user.sub },
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
  prisma: DB.PrismaClient
) {
  const code = 100000 + Math.floor(Math.random() * 900000)
  const groupName =
    uniqueNamesGenerator({
      dictionaries: [colors, adjectives, animals],
      separator: ' ',
      style: 'capital',
    }) + 's'

  // create group and remove participants from the pool
  await prisma.$transaction([
    prisma.participantGroup.create({
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
    prisma.groupAssignmentPoolEntry.deleteMany({
      where: {
        courseId,
        participantId: {
          in: groupParticipantIds,
        },
      },
    }),
  ])
}

export const handleRunningRandomGroupAssignments: HatchetHandlers['handleRunningRandomGroupAssignments'] =
  async (_, globalCtx, executionCtx) => {
    await executionCtx.logger.info(
      '[INFO] [RunningRandomGroupAssignments] Starting to handle running random group assignments...'
    )

    // fetch all courses with future group deadlines
    const courses = await globalCtx.prisma.course.findMany({
      where: {
        randomAssignmentFinalized: false,
        isGroupCreationEnabled: true,
        groupDeadlineDate: { gt: new Date() },
      },
      include: {
        groupAssignmentPoolEntries: { orderBy: { createdAt: 'asc' } },
      },
    })

    await executionCtx.logger.info(
      `[INFO] [RunningRandomGroupAssignments] Found ${courses.length} courses with upcoming group deadlines`
    )

    // filter the courses down to those, which contain more than 2 * preferredGroupSize participants in the pool
    const coursesToUpdate = courses.filter(
      (course) =>
        course.groupAssignmentPoolEntries.length >=
        2 * course.preferredGroupSize
    )

    await executionCtx.logger.info(
      `[INFO] [RunningRandomGroupAssignments] Found ${coursesToUpdate.length} courses with enough participants in the pool`
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
            globalCtx.prisma
          )
        }

        // invalidate the corresponding participants, course and group assignment pool entries in the cache
        globalCtx.emitter.emit('invalidate', {
          typename: 'Course',
          id: course.id,
        })
        participantIds.forEach((participantId) => {
          globalCtx.emitter.emit('invalidate', {
            typename: 'Participant',
            id: participantId,
          })
        })
        poolEntryIds.forEach((poolEntryId) => {
          globalCtx.emitter.emit('invalidate', {
            typename: 'GroupAssignmentPoolEntry',
            id: poolEntryId,
          })
        })

        await executionCtx.logger.info(
          `[INFO] [RunningRandomGroupAssignments] Successfully assigned ${groups.length} new random groups for ${course.name} (id: ${course.id}; rolling assignment).`
        )
      } catch (e) {
        await sendTeamsNotification({
          scope: 'hatchet/running-random-group-assignments',
          text: `Failed to assign random groups for course ${course.name} (id: ${course.id}; rolling assignment) with error: ${
            e || 'missing'
          }`,
        })

        await executionCtx.logger.error(
          `[ERROR] [RunningRandomGroupAssignments] Failed to assign groups for course ${course.name} (id: ${course.id}; rolling assignment) with error: ${e || 'missing'}`
        )
      }
    }

    await executionCtx.logger.info(
      `[INFO] [RunningRandomGroupAssignments] Finished handling running random group assignments.`
    )

    return true
  }

async function resolveSingleParticipantGroups(
  {
    course,
  }: {
    course: DB.Course & {
      participantGroups: (Pick<DB.ParticipantGroup, 'id'> & {
        participants: Pick<DB.Participant, 'id'>[]
      })[]
    }
  },
  prisma: DB.PrismaClient,
  emitter: EventEmitter
) {
  const singleParticipantGroups = course.participantGroups
    .filter((group) => group.participants.length === 1)
    .map((group) => ({
      groupId: group.id,
      participantId: group.participants[0]!.id,
    }))

  const courseExtendedPool = await prisma.course.update({
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
    emitter.emit('invalidate', {
      typename: 'ParticipantGroup',
      id: groupId,
    })
  })

  return courseExtendedPool
}

export const handleFinalRandomGroupAssignments: HatchetHandlers['handleFinalRandomGroupAssignments'] =
  async (_, globalCtx, executionCtx) => {
    await executionCtx.logger.info(
      '[INFO] [FinalRandomGroupAssignments] Starting final random group assignments...'
    )

    // fetch all courses with past group deadlines
    const courses = await globalCtx.prisma.course.findMany({
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

    await executionCtx.logger.info(
      `[INFO] [FinalRandomGroupAssignments] Found ${courses.length} courses with past group deadlines`
    )

    for (const course of courses) {
      try {
        // resolve all groups with a single participant and add them to the pool ids
        // update the course table in case the operation is interrupted to ensure that no ids are lost
        const courseId = course.id
        const courseExtendedPool = await resolveSingleParticipantGroups(
          { course },
          globalCtx.prisma,
          globalCtx.emitter
        )

        await executionCtx.logger.info(
          `[INFO] [FinalRandomGroupAssignments] Resolved all single participant groups for course ${course.name} (id: ${course.id}).`
        )

        const poolParticipantIds =
          courseExtendedPool.groupAssignmentPoolEntries.map(
            (entry) => entry.participantId
          )

        // if the assignment pool is empty, set the finalization boolean and return success
        if (poolParticipantIds.length === 0) {
          await globalCtx.prisma.course.update({
            where: { id: courseId },
            data: { randomAssignmentFinalized: true },
          })

          await executionCtx.logger.info(
            `[INFO] [FinalRandomGroupAssignments] Finalized random assignment for course ${course.name} (id: ${course.id}) - no participants in pool.`
          )

          continue
        }

        // if only one participant is in the pool, send an email to the lecturer to extend group deadline
        if (poolParticipantIds.length === 1) {
          const courseGroupsOverviewLink = `${process.env.APP_ORIGIN_MANAGE}/courses/${course.id}?gamificationTab=groups`

          const emailHtml = await EmailService.hydrateTemplate(
            {
              templateName: 'RandomizedGroupCreationFailure',
              variables: {
                COURSE_NAME: course.name,
                LINK: courseGroupsOverviewLink,
              },
            },
            globalCtx.prisma
          )

          if (!emailHtml) {
            continue
          }

          await EmailService.sendEmail({
            to: course.notificationEmail ?? course.owner.email,
            subject: `KlickerUZH - Group Creation for Course ${course.name}`,
            text: `The automated random group creation for your course ${course.name} has failed. Please refer to the course overview for more details and to change the group creation deadline: ${courseGroupsOverviewLink}.`,
            html: emailHtml,
          })

          await executionCtx.logger.info(
            `[INFO] [FinalRandomGroupAssignments] Failure of automatic group assignment - single participant in pool for course ${course.name} (id ${course.id}). Sent E-Mail to course owner with id ${course.ownerId}.`
          )

          // set random assignment as finalized on course - email should not be re-sent daily and moving the group deadline will set it to false again
          await globalCtx.prisma.course.update({
            where: { id: courseId },
            data: {
              randomAssignmentFinalized: true,
            },
          })

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
            globalCtx.prisma
          )
        }

        // set random assignment as finalized on course
        await globalCtx.prisma.course.update({
          where: { id: courseId },
          data: {
            randomAssignmentFinalized: true,
          },
        })

        await executionCtx.logger.info(
          `[INFO] [FinalRandomGroupAssignments] Successfully completed final random group assignment for course ${course.name} (id ${course.id}) with ${groups.length} new groups.`
        )
      } catch (e) {
        await executionCtx.logger.error(
          `[ERROR] [FinalRandomGroupAssignments] Failed to finalize random group assignments for course ${course.name} (id: ${course.id}) with error: ${e || 'missing'}`
        )

        continue
      }
    }

    await executionCtx.logger.info(
      `[INFO] [FinalRandomGroupAssignments] Complete final random group assignment for all courses with past group formation deadlines.`
    )

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
      groupAssignmentPoolEntries: { orderBy: { createdAt: 'asc' } },
      participantGroups: {
        select: { id: true, participants: { select: { id: true } } },
      },
    },
  })

  // do nothing if the course does not exist
  if (!course) return null

  try {
    // resolve all groups with a single participant and add them to the pool ids
    // update the course table in case the operation is interrupted to ensure that no ids are lost
    const courseExtendedPool = await resolveSingleParticipantGroups(
      { course },
      ctx.prisma,
      ctx.emitter
    )

    await sendTeamsNotification({
      scope: 'graphql/manualRandomGroupAssignments',
      text: `Resolved all single participant groups for course ${course.name} (id: ${course.id}).`,
    })

    // if the assignment pool is empty, set the finalization boolean and return course
    if (courseExtendedPool.groupAssignmentPoolEntries.length === 0) {
      await ctx.prisma.course.update({
        where: { id: courseId },
        data: { randomAssignmentFinalized: true },
      })

      return []
    }

    // if there is only exactly one participant in the pool, return null - do not update course
    // case is already handled in the frontend with a disabled button
    if (courseExtendedPool.groupAssignmentPoolEntries.length === 1) return null

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
      participants: { connect: group.map((id) => ({ id })) },
    }))

    // update the course
    const updatedCourse = await ctx.prisma.course.update({
      where: { id: courseId },
      data: {
        groupDeadlineDate: new Date(),
        randomAssignmentFinalized: true,
        participantGroups: { create: newGroups },
        groupAssignmentPoolEntries: { deleteMany: {} },
      },
      include: { participantGroups: { include: { participants: true } } },
    })

    // invalidate the cache of the course and the group assignment pool entries
    ctx.emitter.emit('invalidate', { typename: 'Course', id: courseId })
    courseExtendedPool.groupAssignmentPoolEntries.forEach((entry) => {
      ctx.emitter.emit('invalidate', {
        typename: 'GroupAssignmentPoolEntry',
        id: entry.id,
      })
    })

    await sendTeamsNotification({
      scope: 'graphql/manualRandomGroupAssignments',
      text: `Successfully completed random group assignment for course ${course.name} (id: ${course.id}) with ${newGroups.length} new groups.`,
    })

    return updatedCourse.participantGroups
  } catch (e) {
    ctx.log.error(
      { event: 'group.assignment.failed' },
      'Manual group assignment failed'
    )
    await sendTeamsNotification({
      scope: 'graphql/manualRandomGroupAssignments',
      text: `Random group creation failed for course ${course.name} (id: ${course.id}) with error: ${
        e || 'missing'
      }`,
    })

    return null
  }
}

export async function joinParticipantGroup(
  { courseId, code }: { courseId: string; code: number },
  ctx: ContextWithUser
) {
  // find participantgroup with code
  const participantGroup = await ctx.prisma.participantGroup.findUnique({
    where: {
      courseId_code: { courseId, code },
    },
    include: {
      course: true,
      participants: { include: { leaderboards: true } },
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
      type: DB.LeaderboardType.COURSE,
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
    where: { courseId_code: { courseId, code } },
    data: {
      participants: { connect: { id: ctx.user.sub } },
      averageMemberScore: averageMemberScore,
    },
    include: { participants: true, course: true },
  })

  return updatedParticipantGroup.id
}

export async function leaveParticipantGroup(
  { groupId, courseId }: { groupId: string; courseId: string },
  ctx: ContextWithUser
) {
  // find participantgroup with corresponding id
  const participantGroup = await ctx.prisma.participantGroup.findUnique({
    where: { id: groupId },
    include: { participants: { include: { leaderboards: true } } },
  })

  // if no participant group with the provided id exists in this course or at all, return null
  if (!participantGroup) return null

  // if the participant is the only one in the group, delete the group
  if (participantGroup.participants.length === 1) {
    const deletedGroup = await ctx.prisma.participantGroup.delete({
      where: { id: groupId },
    })

    // invalidate graphql response cache
    ctx.emitter.emit('invalidate', {
      typename: 'ParticipantGroup',
      id: groupId,
    })

    return deletedGroup
  }

  // compute new average member score for the group without the participant that is leaving
  const aggregate = participantGroup.participants.reduce(
    (acc, participant) => {
      // skip the participant that is about to leave
      if (participant.id === ctx.user.sub) return acc

      const matchingLeaderboard = participant.leaderboards.find(
        (lb) =>
          lb.courseId === courseId && lb.type === DB.LeaderboardType.COURSE
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
  { groupId, name }: { groupId: string; name: string },
  ctx: ContextWithUser
) {
  if (name.trim() === '') {
    return null
  }

  const updatedGroup = await ctx.prisma.participantGroup.update({
    where: { id: groupId },
    data: { name: name.trim() },
  })

  ctx.emitter.emit('invalidate', { typename: 'ParticipantGroup', id: groupId })
  return updatedGroup
}

export async function getParticipantGroups(
  { courseId }: { courseId: string },
  ctx: Context
) {
  // return early, if no user is authenticated or if the user does not have a participant role
  if (!ctx.user?.sub || ctx.user?.role !== DB.UserRole.PARTICIPANT) {
    return []
  }

  // find participant with corresponding id ctx.user.sub and return all his participant groups with correct id
  const participant = await ctx.prisma.participant.findUnique({
    where: { id: ctx.user.sub },
    include: {
      participantGroups: {
        where: { course: { id: courseId } },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            include: { participant: true },
          },
          participants: {
            include: {
              leaderboards: {
                where: { courseId, type: DB.LeaderboardType.COURSE },
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
    participants: computeRanks(
      sortBy(
        group.participants.map((participant) => ({
          ...participant,
          score: participant.leaderboards[0]?.score ?? 0,
          isSelf: participant.id === ctx.user!.sub,
        })),
        [prop('score'), 'desc'],
        [prop('username'), 'asc']
      )
    ),
  }))
}

interface ClueInput {
  name: string
  displayName: string
  type: DB.ParameterType
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
  stack: ElementStackInput
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
  ctx: ContextWithUser,
  transactionPrisma?: PrismaTransactionClient
) {
  const prisma = transactionPrisma ?? ctx.prisma

  // in EDIT mode - validate that the group activity exists and is not published, remove the old clues
  let existingActivity: DB.GroupActivity | null = null
  if (id) {
    existingActivity = await prisma.groupActivity.findUnique({
      where: { id, isDeleted: false },
    })

    if (!existingActivity) {
      throw new GraphQLError('Group Activity not found')
    }
    if (
      existingActivity.status === DB.PublicationStatus.SCHEDULED ||
      existingActivity.status === DB.PublicationStatus.PUBLISHED ||
      existingActivity.status === DB.PublicationStatus.GRADED
    ) {
      throw new GraphQLError('Can only edit draft group activities')
    }

    // remove old clues as they will be replaced through new values
    await prisma.groupActivity.update({
      where: { id },
      data: { clues: { deleteMany: {} } },
    })
  }

  // get the course to which the practice quiz should be assigned
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { isGamificationEnabled: true, isAssessmentEnabled: true },
  })

  if (!course) {
    throw new GraphQLError('Course not found')
  }

  // get required splits of instances based on provided stacks values
  const {
    persistentInstanceIds,
    persistentInstances,
    persistentInstanceOrderMap,
    duplicationInstances,
    elementMap,
    anyInstanceOutdated,
  } = await splitActivityInstances({ stacksOrBlocks: [stack] }, ctx, prisma)

  // in EDIT mode - check which instances and stacks should be removed
  let instancesToDelete: number[] = []
  let unlinkedElementIds: number[] = [] // ids of all elements, which will no longer require a derived permissions link to the activity
  let stacksToDelete: number[] = []
  if (id) {
    const instances = await prisma.elementInstance.findMany({
      where: {
        id: { notIn: persistentInstanceIds },
        elementStack: { groupActivityId: id },
      },
    })

    const stacks = await prisma.elementStack.findMany({
      where: { groupActivityId: id },
    })

    instancesToDelete = instances.map((instance) => instance.id)
    unlinkedElementIds = instances.map((instance) => instance.elementId)
    stacksToDelete = stacks.map((stack) => stack.id)
  }

  const newId = uuidv4()
  const createOrUpdateJSON = {
    id: id ?? newId,
    name: name,
    displayName: displayName,
    description: description,
    status: DB.PublicationStatus.DRAFT,
    scheduledStartAt: startDate,
    scheduledEndAt: endDate,
    pointsMultiplier: multiplier,
    areInstancesOutdated: anyInstanceOutdated,
    isGamificationEnabled: course.isGamificationEnabled,
    isAssessmentEnabled: course.isAssessmentEnabled,
    reviewStatus:
      existingActivity?.courseId !== courseId
        ? DB.ReviewStatus.INCOMPLETE
        : existingActivity?.reviewStatus === DB.ReviewStatus.REVIEWED
          ? DB.ReviewStatus.MODIFIED_AFTER_REVIEW
          : undefined,
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
        type: DB.ElementStackType.GROUP_ACTIVITY,
        order: 0,
        displayName: stack.displayName,
        description: stack.description,
        elements: {
          connectOrCreate: stack.elements.map((instance) =>
            getActivityInstanceConnectOrCreate({
              instance,
              instanceType: DB.ElementInstanceType.GROUP_ACTIVITY,
              activityMultiplier: multiplier,
              persistentInstances,
              duplicationInstances,
              elementMap,
              userId: ctx.user.sub,
            })
          ),
        },
      },
    },
    course: { connect: { id: courseId } },
  }

  const persistGroupActivity = async (prisma: PrismaTransactionClient) => {
    // delete all instances that are not used anymore
    await prisma.elementInstance.deleteMany({
      where: { id: { in: instancesToDelete } },
    })

    // disconnect all instances that should be kept in edit mode and set new order value (to satisfy uniqueness constraints)
    for (const instance of persistentInstances) {
      const elementMultiplier =
        'pointsMultiplier' in instance.elementData
          ? ((instance.elementData.pointsMultiplier as number) ?? 1)
          : 1

      await prisma.elementInstance.update({
        where: {
          id: instance.id,
        },
        data: {
          elementStackId: null,
          order: persistentInstanceOrderMap[instance.id],
          options: {
            ...instance.options,
            pointsMultiplier: multiplier * elementMultiplier,
          },
        },
      })
    }

    // delete all stacks
    await prisma.elementStack.deleteMany({
      where: { id: { in: stacksToDelete } },
    })

    const upsertedActivity = await prisma.groupActivity.upsert({
      where: { id: id ?? newId },
      create: {
        ...createOrUpdateJSON,
        owner: { connect: { id: ctx.user.sub } }, // only connect the owner during activity creation (not editing)!
      },
      update: createOrUpdateJSON,
      include: {
        templateInfo: true,
        permissions: {
          where: { userId: ctx.user.sub },
          include: { directPermission: true },
          take: 1,
        },
        course: {
          include: {
            _count: {
              select: {
                participantGroups: true,
                permissions: {
                  where: {
                    userId: ctx.user.sub,
                    permissionLevel: {
                      in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
                    },
                  },
                },
              },
            },
          },
        },
        stacks: { include: { _count: { select: { elements: true } } } },
        _count: { select: { permissions: true } },
      },
    })

    // enforce derived permissions update to elements that were potentially removed from the quiz (-> removal of derived permissions)
    if (unlinkedElementIds.length > 0) {
      for (const elementId of unlinkedElementIds) {
        await recomputeDerivedPermissions({ elementId }, prisma)
      }
    }

    // update all permissions linked to this group activity (since course might have changed on edit as well --> new derived permissions)
    await recomputeDerivedPermissions(
      { groupActivityId: upsertedActivity.id },
      prisma
    )

    return upsertedActivity
  }

  const {
    activity,
    permissionLevel,
    derived,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    sharingType,
  } = await persistActivityWithPermissions({
    persist: persistGroupActivity,
    ctx,
    transactionPrisma,
  })

  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.GROUP_ACTIVITY,
    status: activity.status,
    courseId: activity.course?.id,
    courseName: activity.course?.name,
    courseLanguage: activity.course?.language,
    courseStartDate: activity.course?.startDate,
    numOfStacks: activity.stacks.length,
    numOfElements: activity.stacks.reduce(
      (acc, block) => acc + block._count.elements,
      0
    ),
    scheduledStartAt: activity.scheduledStartAt,
    scheduledEndAt: activity.scheduledEndAt,
    groupDeadlineDate: activity.course.groupDeadlineDate,
    numOfParticipantGroups: activity.course._count.participantGroups,
    permissionLevel,
    derivedAccess: derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    numSharedUsers: id ? activity._count.permissions - 1 : 0,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    isActivityReviewer: activity.course._count.permissions > 0,
    sharingType,
    updatedAt: activity.updatedAt,
  }
}

export const handleUpdateGroupAverageScores: HatchetHandlers['handleUpdateGroupAverageScores'] =
  async (_, globalCtx, executionCtx) => {
    await executionCtx.logger.info(
      '[INFO] [UpdateGroupAverageScores] Updating average group scores for all participant groups in ongoing / future courses...'
    )

    const groupsWithParticipants =
      await globalCtx.prisma.participantGroup.findMany({
        where: { course: { endDate: { gt: new Date() } } },
        include: {
          participants: {
            include: {
              leaderboards: {
                where: { type: DB.LeaderboardType.COURSE },
              },
            },
          },
        },
      })

    await executionCtx.logger.info(
      `[INFO] [UpdateGroupAverageScores] Found ${groupsWithParticipants.length} participant groups in ongoing or future courses`
    )

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
            aggregate.count > 1
              ? Math.round(aggregate.sum / aggregate.count)
              : 0

          if (averageMemberScore === group.averageMemberScore)
            return Promise.resolve()

          globalCtx.emitter.emit('invalidate', {
            typename: 'ParticipantGroup',
            id: group.id,
          })

          return globalCtx.prisma.participantGroup.update({
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
      await executionCtx.logger.error(
        `[ERROR] [UpdateGroupAverageScores] Failed to update average group scores with error: ${e || 'missing'}`
      )
      return false
    }

    await executionCtx.logger.info(
      '[INFO] [UpdateGroupAverageScores] Successfully updated average group scores'
    )

    return true
  }

export async function getGroupActivityDetails(
  { activityId, groupId }: { activityId: string; groupId: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: {
      id: activityId,
      status: {
        in: [
          DB.PublicationStatus.PUBLISHED,
          DB.PublicationStatus.ENDED,
          DB.PublicationStatus.GRADED,
        ],
      },
      isDeleted: false,
    },
    include: {
      course: true,
      clues: { orderBy: { displayName: 'asc' } },
      stacks: { include: { elements: { orderBy: { order: 'asc' } } } },
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
                ...(groupActivity.status === DB.PublicationStatus.GRADED
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
  { activityId, groupId }: { activityId: string; groupId: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id: activityId, status: DB.PublicationStatus.PUBLISHED },
    include: {
      course: true,
      clues: { orderBy: { displayName: 'asc' } },
      stacks: { include: { elements: { orderBy: { order: 'asc' } } } },
      // parameters: true, // TODO: reintroduce as soon as these are used
    },
  })

  const group = await ctx.prisma.participantGroup.findUnique({
    where: { id: groupId },
    include: { participants: true },
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
          group: { connect: { id: groupId } },
          groupActivity: { connect: { id: activityId } },
          clues: { create: allClues },
        },
        include: { clues: true },
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
          data: { clueInstanceAssignment: { create: clueAssignments.clues } },
          include: {
            clueInstanceAssignment: {
              include: { groupActivityClueInstance: true, participant: true },
            },
          },
        }
      )

      return updatedActivityInstance
    })

    return { ...groupActivity, group, activityInstance }
  } catch (e) {
    ctx.log.error(
      { event: 'group.activity.join.failed' },
      'Joining group activity failed'
    )
    return null
  }
}

export async function submitGroupActivityDecisions(
  {
    activityId,
    responses,
  }: Pick<RespondToElementStackInput, 'responses'> & { activityId: number },
  ctx: ContextWithUser
) {
  const groupActivityInstance =
    await ctx.prisma.groupActivityInstance.findUnique({
      where: { id: activityId },
      include: {
        groupActivity: true,
        group: { include: { participants: { where: { id: ctx.user.sub } } } },
      },
    })

  // if the instance does not exist or the logged-in participant is not part of the group
  // or if the results have already been submitted
  if (
    !groupActivityInstance ||
    groupActivityInstance.group.participants.length === 0 ||
    !!groupActivityInstance.decisionsSubmittedAt ||
    groupActivityInstance.groupActivity.status === DB.PublicationStatus.DRAFT ||
    groupActivityInstance.groupActivity.status ===
      DB.PublicationStatus.SCHEDULED ||
    groupActivityInstance.groupActivity.status === DB.PublicationStatus.ENDED
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
        if (inputResponse.type === DB.ElementType.CONTENT) return []
        const instanceId = inputResponse.instanceId

        // fetch the existing instance
        const instance = await prisma.elementInstance.findUnique({
          where: { id: instanceId },
        })
        if (!instance || !instance.elementData) return []

        // compute the updated results
        let response: ResponseInput
        let updatedResults: {
          results: ElementInstanceResults
          modified: boolean
        }
        if (
          (inputResponse.type === DB.ElementType.SC ||
            inputResponse.type === DB.ElementType.MC ||
            inputResponse.type === DB.ElementType.KPRIM) &&
          'choices' in instance.results
        ) {
          response = { choices: inputResponse.choicesResponse }
          updatedResults = updateChoicesResults({
            previousResults: instance.results,
            response: response,
          })
        } else if (
          inputResponse.type === DB.ElementType.NUMERICAL &&
          'responses' in instance.results
        ) {
          response = { value: String(inputResponse.numericalResponse) }
          updatedResults = updateNumericalResults({
            previousResults: instance.results,
            elementData: instance.elementData,
            response: response,
          })
        } else if (
          inputResponse.type === DB.ElementType.FREE_TEXT &&
          'responses' in instance.results
        ) {
          response = { value: inputResponse.freeTextResponse }
          updatedResults = updateFreeTextResults({
            previousResults: instance.results,
            elementData: instance.elementData,
            response: response,
          })
        } else if (
          inputResponse.type === DB.ElementType.SELECTION &&
          'selections' in instance.results
        ) {
          updatedResults = updateSelectionResults({
            previousResults: instance.results,
            response: { selection: inputResponse.selectionResponse },
          })
        } else if (
          inputResponse.type === DB.ElementType.CASE_STUDY &&
          'assessments' in instance.results
        ) {
          updatedResults = updateCaseStudyResults({
            previousResults: instance.results,
            response: { assessment: inputResponse.caseStudyResponse },
          })
        } else {
          ctx.log.warn(
            {
              event: 'group.activity.response.rejected',
              reason: 'unsupported_element_type',
            },
            'Group activity response rejected'
          )
          return
        }

        if (!updatedResults.modified) return

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

export async function getGroupActivity(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id, isDeleted: false },
    include: {
      course: true,
      clues: true,
      activityInstances: { include: { group: true } },
      stacks: { include: { elements: { orderBy: { order: 'asc' } } } },
    },
  })

  return groupActivity
}

export async function publishGroupActivity(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id, isDeleted: false, status: DB.PublicationStatus.DRAFT },
  })

  if (!groupActivity) {
    return null
  }

  if (groupActivity.scheduledStartAt > new Date()) {
    try {
      // schedule the task to publish the group activity at the scheduled start date
      const publicationTask =
        await ctx.tasks.publishScheduledGroupActivity.schedule(
          groupActivity.scheduledStartAt,
          {
            groupActivityId: groupActivity.id,
            loggingContext: ctx.requestContext,
          }
        )
      const publicationTaskId = publicationTask.metadata.id

      // schedule the task to end the group activity at the scheduled end date
      const completionTask = await ctx.tasks.endExpiredGroupActivity.schedule(
        groupActivity.scheduledEndAt,
        {
          groupActivityId: groupActivity.id,
          loggingContext: ctx.requestContext,
        }
      )
      const completionTaskId = completionTask.metadata.id

      // set the status of the group activity to scheduled and store the hatchet task ID
      const updatedGroupActivity = await ctx.prisma.groupActivity.update({
        where: { id },
        data: {
          status: DB.PublicationStatus.SCHEDULED,
          scheduledPublicationTaskId: publicationTaskId,
          scheduledCompletionTaskId: completionTaskId,
        },
      })

      ctx.emitter.emit('invalidate', { typename: 'GroupActivity', id })
      return updatedGroupActivity
    } catch {
      ctx.log.error(
        { event: 'hatchet.schedule.failed', task: 'group-activity-publish' },
        'Hatchet task scheduling failed'
      )
      return null
    }
  } else if (groupActivity.scheduledEndAt < new Date()) {
    // if the scheduled end date is in the past, set the status to ended
    const updatedGroupActivity = await ctx.prisma.groupActivity.update({
      where: { id },
      data: { status: DB.PublicationStatus.ENDED },
    })

    ctx.emitter.emit('invalidate', { typename: 'GroupActivity', id })
    return updatedGroupActivity
  }

  // if the start date is in the past, but the end date is in the future, schedule the completion task
  const completionTask = await ctx.tasks.endExpiredGroupActivity.schedule(
    groupActivity.scheduledEndAt,
    {
      groupActivityId: groupActivity.id,
      loggingContext: ctx.requestContext,
    }
  )
  const completionTaskId = completionTask.metadata.id

  // if the start date is in the past, directly publish the group activity
  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id },
    data: {
      status: DB.PublicationStatus.PUBLISHED,
      scheduledCompletionTaskId: completionTaskId,
    },
  })

  ctx.emitter.emit('invalidate', { typename: 'GroupActivity', id })
  return updatedGroupActivity
}

export async function openGroupActivity(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id, status: DB.PublicationStatus.SCHEDULED },
  })

  if (!groupActivity) {
    return null
  }

  // remove the scheduled hatchet publication task, if it exists
  if (groupActivity.scheduledPublicationTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(
        groupActivity.scheduledPublicationTaskId
      )
    } catch {
      ctx.log.warn(
        { event: 'hatchet.schedule.delete_failed', task: 'group-activity' },
        'Hatchet scheduled task deletion failed'
      )
    }
  }

  // check if the scheduled ending task is still in place and if not, create a new one
  let scheduledCompletionTaskId: string | undefined
  if (!groupActivity.scheduledCompletionTaskId) {
    const completionTask = await ctx.tasks.endExpiredGroupActivity.schedule(
      groupActivity.scheduledEndAt,
      {
        groupActivityId: groupActivity.id,
        loggingContext: ctx.requestContext,
      }
    )
    scheduledCompletionTaskId = completionTask.metadata.id
  }

  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id, status: DB.PublicationStatus.SCHEDULED },
    data: {
      status: DB.PublicationStatus.PUBLISHED,
      scheduledStartAt: new Date(),
      scheduledPublicationTaskId: null,
      scheduledCompletionTaskId,
    },
  })

  // trigger subscription to immediately update student frontend
  ctx.pubSub.publish('groupActivityStarted', updatedGroupActivity)
  return updatedGroupActivity
}

export async function unpublishGroupActivity(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id, status: DB.PublicationStatus.SCHEDULED },
  })

  if (!groupActivity) {
    return null
  }

  // remove the scheduled hatchet task, if it exists
  if (groupActivity.scheduledPublicationTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(
        groupActivity.scheduledPublicationTaskId
      )
    } catch {
      ctx.log.warn(
        {
          event: 'hatchet.schedule.delete_failed',
          task: 'group-activity-publish',
        },
        'Hatchet scheduled task deletion failed'
      )
    }
  }

  // remove the completion task, if it exists
  if (groupActivity.scheduledCompletionTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(
        groupActivity.scheduledCompletionTaskId
      )
    } catch {
      ctx.log.warn(
        {
          event: 'hatchet.schedule.delete_failed',
          task: 'group-activity-end',
        },
        'Hatchet scheduled task deletion failed'
      )
    }
  }

  // reset the status of the group activity to draft
  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id, status: DB.PublicationStatus.SCHEDULED },
    data: {
      status: DB.PublicationStatus.DRAFT,
      scheduledPublicationTaskId: null,
      scheduledCompletionTaskId: null,
    },
  })

  ctx.emitter.emit('invalidate', { typename: 'GroupActivity', id })
  return updatedGroupActivity
}

export async function endGroupActivity(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id, status: DB.PublicationStatus.PUBLISHED },
  })

  if (!groupActivity) {
    return null
  }

  // remove the scheduled completion task, if it exists
  if (groupActivity.scheduledCompletionTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(
        groupActivity.scheduledCompletionTaskId
      )
    } catch {
      ctx.log.warn(
        {
          event: 'hatchet.schedule.delete_failed',
          task: 'group-activity-end',
        },
        'Hatchet scheduled task deletion failed'
      )
    }
  }

  // end the group activity and unset the completion task it
  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id },
    data: {
      status: DB.PublicationStatus.ENDED,
      scheduledEndAt: new Date(),
      scheduledCompletionTaskId: null,
    },
  })

  // trigger subscription to immediately update student frontend
  ctx.pubSub.publish('groupActivityEnded', updatedGroupActivity)
  ctx.pubSub.publish('singleGroupActivityEnded', updatedGroupActivity)

  return updatedGroupActivity
}

export async function extendGroupActivity(
  { id, endDate }: { id: string; endDate: Date },
  ctx: ContextWithUser
) {
  // check that the new end date lies in the future
  if (endDate < new Date()) {
    return null
  }

  const groupActivity = await ctx.prisma.groupActivity.update({
    where: {
      id,
      status: {
        in: [DB.PublicationStatus.SCHEDULED, DB.PublicationStatus.PUBLISHED],
      },
      scheduledEndAt: { gt: new Date() },
    },
    data: { scheduledEndAt: endDate },
  })

  if (!groupActivity) {
    return null
  }

  // remove the previous scheduled completion task, if it exists and create a new one
  if (groupActivity.scheduledCompletionTaskId) {
    try {
      await ctx.hatchet.scheduled.delete(
        groupActivity.scheduledCompletionTaskId
      )
    } catch {
      ctx.log.warn(
        {
          event: 'hatchet.schedule.delete_failed',
          task: 'group-activity-end',
        },
        'Hatchet scheduled task deletion failed'
      )
    }
  }
  const completionTask = await ctx.tasks.endExpiredGroupActivity.schedule(
    endDate,
    {
      groupActivityId: groupActivity.id,
      loggingContext: ctx.requestContext,
    }
  )

  // store the task ID of the completion task on the group activity
  const updatedGroupActivity = await ctx.prisma.groupActivity.update({
    where: { id },
    data: { scheduledCompletionTaskId: completionTask.metadata.id },
  })

  return updatedGroupActivity
}

export async function deleteGroupActivity(
  {
    id,
    onlyIfUnpublished = false,
  }: { id: string; onlyIfUnpublished?: boolean },
  ctx: ContextWithUser
) {
  let groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
    include: {
      activityInstances: true,
      stacks: { include: { elements: true } },
    },
  })

  if (!groupActivity) {
    return null
  }

  let groupActivityForSoftDelete = {
    status: groupActivity.status,
    scheduledCompletionTaskId: groupActivity.scheduledCompletionTaskId,
  }

  const isUnpublished = UNPUBLISHED_ACTIVITY_STATUSES.includes(
    groupActivity.status
  )

  if (onlyIfUnpublished && !isUnpublished) {
    return null
  }

  // if the the group activity is not yet published / has not started or has no instances -> hard deletion
  // as soon as an instance exists (independent of results) -> soft deletion
  if (
    isUnpublished ||
    (!onlyIfUnpublished && groupActivity.activityInstances.length === 0)
  ) {
    // Recheck publication status and instance state in the delete statement
    // because the initial read can become stale while the user confirms the batch.
    let deletedItem: DB.GroupActivity | null
    if (onlyIfUnpublished) {
      deletedItem = await deleteWithPublicationStatusGuard(() =>
        ctx.prisma.groupActivity.delete({
          where: { id, status: { in: UNPUBLISHED_ACTIVITY_STATUSES } },
        })
      )
    } else {
      deletedItem = await deleteWithPublicationStatusGuard(() =>
        ctx.prisma.groupActivity.delete({
          where: {
            id,
            OR: [
              { status: { in: UNPUBLISHED_ACTIVITY_STATUSES } },
              { activityInstances: { none: {} } },
            ],
          },
        })
      )
    }

    if (deletedItem) {
      // remove the scheduled publication task, if it exists (should only exist for scheduled group activities)
      if (
        deletedItem.scheduledPublicationTaskId &&
        deletedItem.status === DB.PublicationStatus.SCHEDULED
      ) {
        try {
          await ctx.hatchet.scheduled.delete(
            deletedItem.scheduledPublicationTaskId
          )
        } catch {
          ctx.log.warn(
            {
              event: 'hatchet.schedule.delete_failed',
              task: 'group-activity-publish',
            },
            'Hatchet scheduled task deletion failed'
          )
        }
      }

      // remove the scheduled completion task, if it exists (should only exist for scheduled/published group activities)
      if (
        deletedItem.scheduledCompletionTaskId &&
        (deletedItem.status === DB.PublicationStatus.SCHEDULED ||
          deletedItem.status === DB.PublicationStatus.PUBLISHED)
      ) {
        try {
          await ctx.hatchet.scheduled.delete(
            deletedItem.scheduledCompletionTaskId
          )
        } catch {
          ctx.log.warn(
            {
              event: 'hatchet.schedule.delete_failed',
              task: 'group-activity-end',
            },
            'Hatchet scheduled task deletion failed'
          )
        }
      }

      // update derived permissions on all linked elements (to make sure that invalid derived permissions are also removed)
      // this case cannot be handled by the permissions module, since the group activity is already hard deleted
      // access requests need to be updated as well, since the derived permissions on elements might have changed
      await propagateActivityToElements(
        { stacks: groupActivity.stacks, updateAccessRequests: true },
        ctx.prisma
      )

      ctx.emitter.emit('invalidate', { typename: 'GroupActivity', id })
      return deletedItem
    }

    if (onlyIfUnpublished) {
      return null
    }

    // A concurrent instance can make the atomic hard-delete predicate fail.
    // Reload the activity before taking the soft-delete path.
    const reloadedGroupActivity = await ctx.prisma.groupActivity.findUnique({
      where: { id },
      select: {
        status: true,
        scheduledCompletionTaskId: true,
      },
    })

    if (!reloadedGroupActivity) {
      return null
    }

    groupActivityForSoftDelete = reloadedGroupActivity
  }

  // if the group activity already has active instances, only soft delete it
  const updatedGroupActivity = await ctx.prisma.$transaction(
    async (prisma) => {
      // remove the scheduled completion task, if it exists (should only exist for published group activities)
      if (
        groupActivityForSoftDelete.status === DB.PublicationStatus.PUBLISHED &&
        groupActivityForSoftDelete.scheduledCompletionTaskId
      ) {
        try {
          await ctx.hatchet.scheduled.delete(
            groupActivityForSoftDelete.scheduledCompletionTaskId
          )
        } catch {
          ctx.log.warn(
            {
              event: 'hatchet.schedule.delete_failed',
              task: 'group-activity-end',
            },
            'Hatchet scheduled task deletion failed'
          )
        }
      }

      // soft delete the group activity and remove all direct permissions
      const updatedActivity = await deleteWithPublicationStatusGuard(() =>
        prisma.groupActivity.update({
          where: { id },
          data: {
            isDeleted: true,
            directPermissions: { deleteMany: {} }, // delete all direct permissions on the activity
            scheduledCompletionTaskId:
              groupActivityForSoftDelete.status ===
              DB.PublicationStatus.PUBLISHED
                ? null
                : undefined,
          },
        })
      )

      if (!updatedActivity) {
        return null
      }

      // update derived permissions for this group activity (after soft deletion)
      // this function call automatically includes permission updates for all linked elements
      await recomputeDerivedPermissions(
        { groupActivityId: updatedActivity.id },
        prisma
      )

      return updatedActivity
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', { typename: 'GroupActivity', id })
  return updatedGroupActivity
}

export async function removeGroupActivity(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  // verify that the user has a direct permission on the specified group activity
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id, directPermissions: { some: { userId: ctx.user.sub } } },
  })

  if (!groupActivity) {
    return null
  }

  // remove direct permission and recompute derived permissions for this group activity and user
  await ctx.prisma.$transaction(
    async (prisma) => {
      await prisma.groupActivity.update({
        where: { id },
        data: { directPermissions: { deleteMany: { userId: ctx.user.sub } } },
      })

      // create an audit log entry for the removal
      await prisma.auditLogEntry.create({
        data: {
          type: DB.AuditLogType.PERMISSION_REMOVED,
          objectId: String(id),
          objectType: DB.ObjectType.GROUP_ACTIVITY,
          sourceUserId: ctx.user.sub,
          message: `User ${ctx.user.sub} removed own permission on ${DB.ObjectType.GROUP_ACTIVITY} (ID: ${id})`,
        },
      })

      await recomputeDerivedPermissions(
        { groupActivityId: id, userId: ctx.user.sub },
        prisma
      )
    },
    { timeout: 60000 }
  )

  ctx.emitter.emit('invalidate', {
    typename: 'GroupActivity',
    id,
  })

  return id
}

export async function getCourseGroupActivities(
  { courseId }: { courseId: string },
  ctx: Context
) {
  // if the no participant is logged in, return early
  if (!ctx.user?.sub || ctx.user.role !== DB.UserRole.PARTICIPANT) return null

  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
      participations: { some: { participantId: ctx.user.sub } },
    },
    include: {
      groupActivities: {
        where: {
          status: {
            in: [
              DB.PublicationStatus.SCHEDULED,
              DB.PublicationStatus.PUBLISHED,
              DB.PublicationStatus.ENDED,
              DB.PublicationStatus.GRADED,
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

export async function changeGroupActivityName(
  { id, name, displayName }: { id: string; name: string; displayName: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
  })

  if (!groupActivity) return false

  // if both name and displayname remain unchanged, skip the update
  if (
    groupActivity.name === name &&
    groupActivity.displayName === displayName
  ) {
    return true
  }

  try {
    await ctx.prisma.groupActivity.update({
      where: { id },
      data: {
        name,
        displayName,
        reviewStatus:
          groupActivity.reviewStatus === DB.ReviewStatus.REVIEWED
            ? DB.ReviewStatus.MODIFIED_AFTER_REVIEW
            : undefined,
      },
    })

    ctx.emitter.emit('invalidate', { typename: 'GroupActivity', id })
    return true
  } catch {
    ctx.log.error(
      { event: 'group.activity.rename.failed' },
      'Group activity rename failed'
    )
    return false
  }
}

export async function getGroupActivitySummary(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
    include: { activityInstances: true },
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

export async function getGradingGroupActivity(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
    include: {
      stacks: { include: { elements: { orderBy: { order: 'asc' } } } },
      activityInstances: {
        include: { group: true },
        orderBy: { decisionsSubmittedAt: 'asc' },
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
    where: { id: { in: instanceIds } },
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
    include: { activityInstances: true },
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
      status: DB.PublicationStatus.GRADED,
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
                      type: DB.LeaderboardType.COURSE,
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
  const gradedInstances = updatedGroupActivity.activityInstances.filter(
    (instance) => instance.results
  )

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

  await ctx.prisma.$transaction(async (prisma) => {
    // increment groupActivityScore on participantGroup
    for (const instance of gradedInstances) {
      await prisma.participantGroup.update({
        where: { id: instance.groupId },
        data: { groupActivityScore: { increment: instance.results!.points } },
      })
    }

    // award the achievements to the participants
    for (const [participantId, results] of Object.entries(
      participantAchievementMap
    )) {
      // keep track of the total number of points and XP awarded (for student timeline update)
      let pointsAwarded: number | undefined = undefined
      let xpAwarded: number | undefined = undefined

      for (const id of results.achievements) {
        // create the participant achievement instance
        await prisma.participantAchievementInstance.upsert({
          where: {
            participantId_achievementId: {
              participantId,
              achievementId: id,
            },
          },
          create: {
            participantId,
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

        // participants with achievement id 9 should get 250 xp
        if (id === 9) {
          await prisma.participant.update({
            where: { id: participantId },
            data: { xp: { increment: 250 } },
          })

          xpAwarded = (xpAwarded ?? 0) + 250
        }

        // participants with achievement id 8 should get 1000 xp and 500 points in the leaderboard
        if (id === 8) {
          await prisma.participant.update({
            where: { id: participantId },
            data: { xp: { increment: 1000 } },
          })

          // update total number of XP awarded
          xpAwarded = (xpAwarded ?? 0) + 1000

          // if the student is part of the leaderboard, increment the score by 500
          if (results.leaderboard) {
            await prisma.leaderboardEntry.update({
              where: {
                type_participantId_courseId: {
                  type: 'COURSE',
                  participantId,
                  courseId: updatedGroupActivity.courseId,
                },
              },
              data: {
                score: {
                  increment: 500,
                },
              },
            })

            // update total number of points awarded
            pointsAwarded = (pointsAwarded ?? 0) + 500
          }
        }
      }

      // update the student timeline entry with the awarded points and / or XP
      await upsertDailyTimelineEntry({
        prisma,
        participantId,
        courseId: updatedGroupActivity.courseId,
        pointsAwarded,
        xpAwarded,
      })
    }
  })

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

export const handleEndExpiredGroupActivity: HatchetHandlers['handleEndExpiredGroupActivity'] =
  async ({ groupActivityId }, globalCtx) => {
    try {
      const groupActivity = await globalCtx.prisma.groupActivity.findUnique({
        where: {
          id: groupActivityId,
          isDeleted: false,
          status: DB.PublicationStatus.PUBLISHED,
          scheduledEndAt: { lte: new Date() },
        },
      })

      if (!groupActivity) {
        await sendTeamsNotification({
          scope: 'hatchet/group-activity-end',
          text: `Group activity with ID ${groupActivityId} not found or scheduled end time is not in the past yet.`,
        })
        throw new Error(
          `Group activity with ID ${groupActivityId} not found or scheduled end time is not in the past yet.`
        )
      }

      // end the group activity
      const updatedGroupActivity = await globalCtx.prisma.groupActivity.update({
        where: { id: groupActivityId },
        data: { status: DB.PublicationStatus.ENDED },
      })

      await sendTeamsNotification({
        scope: 'hatchet/group-activity-end',
        text: `Successfully ended expired group activity ${updatedGroupActivity.id}`,
      })

      // publish the event to subscribers
      globalCtx.pubSub.publish('groupActivityEnded', updatedGroupActivity)
      globalCtx.pubSub.publish('singleGroupActivityEnded', updatedGroupActivity)
      globalCtx.emitter.emit('invalidate', {
        typename: 'GroupActivity',
        id: updatedGroupActivity.id,
      })

      return true
    } catch (error) {
      await sendTeamsNotification({
        scope: 'hatchet/group-activity-end',
        text: `Error ending group activity with ID ${groupActivityId}: ${error}`,
      })
      throw error // rethrow to allow Hatchet to handle retries
    }
  }

export const handlePublishScheduledGroupActivity: HatchetHandlers['handlePublishScheduledGroupActivity'] =
  async ({ groupActivityId }, globalCtx) => {
    try {
      // check if the group activity exists and if its start date is in the past
      const groupActivity = await globalCtx.prisma.groupActivity.findUnique({
        where: {
          id: groupActivityId,
          scheduledStartAt: { lte: new Date() },
          status: DB.PublicationStatus.SCHEDULED,
        },
      })

      if (!groupActivity) {
        await sendTeamsNotification({
          scope: 'hatchet/group-activity-start',
          text: `Group activity with ID ${groupActivityId} not found or scheduled start time is not in the past yet.`,
        })
        throw new Error(
          `Group activity with ID ${groupActivityId} not found or scheduled start time is not in the past yet.`
        )
      }

      // publish the group activity
      await globalCtx.prisma.groupActivity.update({
        where: { id: groupActivityId },
        data: { status: DB.PublicationStatus.PUBLISHED },
      })

      // send a teams notification
      await sendTeamsNotification({
        scope: 'graphql/publishScheduledGroupActivitys',
        text: `Successfully published scheduled group activity ${groupActivity.id}`,
      })

      // invalidate the cache for the group activity
      globalCtx.emitter.emit('invalidate', {
        typename: 'GroupActivity',
        id: groupActivity.id,
      })

      return true
    } catch (error) {
      await sendTeamsNotification({
        scope: 'hatchet/group-activity-start',
        text: `Error publishing group activity with ID ${groupActivityId}: ${error}`,
      })
      throw error // rethrow to allow Hatchet to handle retries
    }
  }
