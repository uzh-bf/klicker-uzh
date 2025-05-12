import * as DB from '@klicker-uzh/prisma'
import { ActivityType } from '@klicker-uzh/types'
import { prop, sortBy } from 'remeda'
import { ContextWithUser } from 'src/lib/context.js'

export async function getUserActivities(ctx: ContextWithUser) {
  // fetch all activities that are available to the user
  const user = await ctx.prisma.user.findUnique({
    where: {
      id: ctx.user.sub,
    },
    include: {
      objects: {
        where: {
          OR: [
            { liveQuizId: { not: null } },
            { practiceQuizId: { not: null } },
            { microLearningId: { not: null } },
            { groupActivityId: { not: null } },
          ],
        },
        include: {
          directPermission: true,
          liveQuiz: {
            include: {
              course: { select: { id: true, name: true, startDate: true } },
              templateInfo: { select: { id: true } },
              blocks: {
                include: { elements: { orderBy: { order: 'asc' } } },
                orderBy: { order: 'asc' },
              },
              // _count: { select: { permissions: true } }, // ? shared user counts left out for efficiency on activity list
            },
          },
          practiceQuiz: {
            include: {
              course: { select: { id: true, name: true, startDate: true } },
              templateInfo: { select: { id: true } },
              stacks: {
                include: { elements: { orderBy: { order: 'asc' } } },
                orderBy: { order: 'asc' },
              },
              // _count: { select: { permissions: true } },
            },
          },
          microLearning: {
            include: {
              course: { select: { id: true, name: true, startDate: true } },
              templateInfo: { select: { id: true } },
              stacks: {
                include: { elements: { orderBy: { order: 'asc' } } },
                orderBy: { order: 'asc' },
              },
              // _count: { select: { permissions: true } },
            },
          },
          groupActivity: {
            include: {
              course: {
                include: { _count: { select: { participantGroups: true } } },
              },
              templateInfo: { select: { id: true } },
              stacks: {
                include: { elements: { orderBy: { order: 'asc' } } },
                orderBy: { order: 'asc' },
              },
              // _count: { select: { permissions: true } },
            },
          },
        },
      },
    },
  })

  if (!user) {
    return null
  }

  // map the activities to a unified format
  const activities = user.objects.flatMap((object) => {
    const isOwner = object.permissionLevel === DB.PermissionLevel.OWNER
    const isManager =
      object.permissionLevel === DB.PermissionLevel.OWNER ||
      object.permissionLevel === DB.PermissionLevel.ADMIN
    const isEditor =
      object.permissionLevel === DB.PermissionLevel.OWNER ||
      object.permissionLevel === DB.PermissionLevel.ADMIN ||
      object.permissionLevel === DB.PermissionLevel.WRITE
    const isExecutor =
      object.permissionLevel === DB.PermissionLevel.EXECUTE ||
      object.permissionLevel === DB.PermissionLevel.WRITE ||
      object.permissionLevel === DB.PermissionLevel.ADMIN ||
      object.permissionLevel === DB.PermissionLevel.OWNER
    const isShared = object.permissionLevel !== DB.PermissionLevel.OWNER
    const isRemovable =
      object.permissionLevel !== DB.PermissionLevel.OWNER &&
      !object.derived &&
      object.directPermission?.userGroupId === null

    if (object.liveQuiz) {
      const stacks = object.liveQuiz.blocks.map((block) => ({
        id: block.id,
        numOfParticipants: block.elements[0]
          ? block.elements[0].results.total +
            block.elements[0].anonymousResults.total
          : 0,
        elements: block.elements.map((instance) => ({
          id: instance.id,
          name: instance.elementData.name,
          type: instance.elementType,
        })),
      }))

      return {
        id: object.liveQuiz.id,
        templateId: object.liveQuiz.templateInfo?.id ?? null,
        name: object.liveQuiz.name,
        displayName: object.liveQuiz.displayName,
        type: ActivityType.LIVE_QUIZ,
        status: object.liveQuiz.status,
        courseId: object.liveQuiz.course?.id,
        courseName: object.liveQuiz.course?.name,
        courseStartDate: object.liveQuiz.course?.startDate,
        numOfStacks: object.liveQuiz.blocks.length,
        numOfElements: object.liveQuiz.blocks.reduce(
          (acc, block) => acc + block.elements.length,
          0
        ),
        stacks,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        numSharedUsers: undefined, // object.liveQuiz._count.permissions - 1,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        updatedAt: object.liveQuiz.updatedAt,
      }
    } else if (object.practiceQuiz) {
      const stacks = object.practiceQuiz.stacks.map((block) => ({
        id: block.id,
        numOfParticipants: block.elements[0]
          ? block.elements[0].results.total +
            block.elements[0].anonymousResults.total
          : 0,
        elements: block.elements.map((instance) => ({
          id: instance.id,
          name: instance.elementData.name,
          type: instance.elementType,
        })),
      }))

      return {
        id: object.practiceQuiz.id,
        templateId: object.practiceQuiz.templateInfo?.id ?? null,
        name: object.practiceQuiz.name,
        displayName: object.practiceQuiz.displayName,
        type: ActivityType.PRACTICE_QUIZ,
        status: object.practiceQuiz.status,
        courseId: object.practiceQuiz.course?.id,
        courseName: object.practiceQuiz.course?.name,
        courseStartDate: object.practiceQuiz.course?.startDate,
        numOfStacks: object.practiceQuiz.stacks.length,
        numOfElements: object.practiceQuiz.stacks.reduce(
          (acc, block) => acc + block.elements.length,
          0
        ),
        scheduledStartAt: object.practiceQuiz.availableFrom,
        stacks,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        numSharedUsers: undefined, // object.practiceQuiz._count.permissions - 1,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        updatedAt: object.practiceQuiz.updatedAt,
      }
    } else if (object.microLearning) {
      const stacks = object.microLearning.stacks.map((block) => ({
        id: block.id,
        numOfParticipants: block.elements[0]
          ? block.elements[0].results.total +
            block.elements[0].anonymousResults.total
          : 0,
        elements: block.elements.map((instance) => ({
          id: instance.id,
          name: instance.elementData.name,
          type: instance.elementType,
        })),
      }))

      return {
        id: object.microLearning.id,
        templateId: object.microLearning.templateInfo?.id ?? null,
        name: object.microLearning.name,
        displayName: object.microLearning.displayName,
        type: ActivityType.MICRO_LEARNING,
        status: object.microLearning.status,
        courseId: object.microLearning.course?.id,
        courseName: object.microLearning.course?.name,
        courseStartDate: object.microLearning.course?.startDate,
        numOfStacks: object.microLearning.stacks.length,
        numOfElements: object.microLearning.stacks.reduce(
          (acc, block) => acc + block.elements.length,
          0
        ),
        scheduledStartAt: object.microLearning.scheduledStartAt,
        scheduledEndAt: object.microLearning.scheduledEndAt,
        stacks,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        numSharedUsers: undefined, // object.microLearning._count.permissions - 1,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        updatedAt: object.microLearning.updatedAt,
      }
    } else if (object.groupActivity) {
      const stacks = object.groupActivity.stacks.map((block) => ({
        id: block.id,
        numOfParticipants: block.elements[0]
          ? block.elements[0].results.total +
            block.elements[0].anonymousResults.total
          : 0,
        elements: block.elements.map((instance) => ({
          id: instance.id,
          name: instance.elementData.name,
          type: instance.elementType,
        })),
      }))

      return {
        id: object.groupActivity.id,
        templateId: object.groupActivity.templateInfo?.id ?? null,
        name: object.groupActivity.name,
        displayName: object.groupActivity.displayName,
        type: ActivityType.GROUP_ACTIVITY,
        status: object.groupActivity.status,
        courseId: object.groupActivity.course?.id,
        courseName: object.groupActivity.course?.name,
        courseStartDate: object.groupActivity.course?.startDate,
        numOfStacks: object.groupActivity.stacks.length,
        numOfElements: object.groupActivity.stacks.reduce(
          (acc, block) => acc + block.elements.length,
          0
        ),
        scheduledStartAt: object.groupActivity.scheduledStartAt,
        scheduledEndAt: object.groupActivity.scheduledEndAt,
        groupDeadlineDate: object.groupActivity.course.groupDeadlineDate,
        numOfParticipantGroups:
          object.groupActivity.course._count.participantGroups,
        stacks,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        numSharedUsers: undefined, // object.groupActivity._count.permissions - 1,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        updatedAt: object.groupActivity.updatedAt,
      }
    }

    return []
  })

  // sort the activities first by type and then by status and name
  const activityTypeOrder = {
    [ActivityType.LIVE_QUIZ]: 1,
    [ActivityType.PRACTICE_QUIZ]: 2,
    [ActivityType.MICRO_LEARNING]: 3,
    [ActivityType.GROUP_ACTIVITY]: 4,
  }

  const activityStatusOrder = {
    [DB.PublicationStatus.PUBLISHED]: 1,
    [DB.PublicationStatus.SCHEDULED]: 2,
    [DB.PublicationStatus.DRAFT]: 3,
    [DB.PublicationStatus.TEMPLATE]: 6,
    [DB.PublicationStatus.ENDED]: 4,
    [DB.PublicationStatus.GRADED]: 5,
  }

  return sortBy(
    activities,
    (activity) =>
      activityTypeOrder[activity.type as keyof typeof activityTypeOrder],
    (activity) =>
      activityStatusOrder[
        activity.status as keyof typeof activityStatusOrder
      ] || 999, // Use a high number for any unknown status
    prop('name') // sort by name
  )
}
