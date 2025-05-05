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
              course: { select: { name: true } },
              templateInfo: { select: { id: true } },
              blocks: { include: { elements: true } },
            },
          },
          practiceQuiz: {
            include: {
              course: { select: { name: true } },
              templateInfo: { select: { id: true } },
              stacks: { include: { elements: true } },
            },
          },
          microLearning: {
            include: {
              course: { select: { name: true } },
              templateInfo: { select: { id: true } },
              stacks: { include: { elements: true } },
            },
          },
          groupActivity: {
            include: {
              course: { select: { name: true } },
              templateInfo: { select: { id: true } },
              stacks: { include: { elements: true } },
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
        course: object.liveQuiz.course?.name,
        numOfStacks: object.liveQuiz.blocks.length,
        numOfElements: object.liveQuiz.blocks.reduce(
          (acc, block) => acc + block.elements.length,
          0
        ),
        stacks,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        isOwner,
        isManager,
        isEditor,
        isShared,
        isRemovable,
        updatedAt: object.liveQuiz.updatedAt,
      }
    }

    // TODO: include other activity types again, once the activity overview supports them
    // if (object.practiceQuiz) {
    //   const elements = object.practiceQuiz.stacks
    //     .flatMap((block) => block.elements)
    //     .map((instance) => ({
    //       id: instance.id,
    //       name: instance.elementData.name,
    //     }))

    //   return {
    //     id: object.practiceQuiz.id,
    //     templateId: object.practiceQuiz.templateInfo?.id ?? null,
    //     name: object.practiceQuiz.name,
    //     displayName: object.practiceQuiz.displayName,
    //     type: ActivityType.PRACTICE_QUIZ,
    //     status: object.practiceQuiz.status,
    //     course: object.practiceQuiz.course?.name,
    //     numOfStacks: object.practiceQuiz.stacks.length,
    //     numOfElements: object.practiceQuiz.stacks.reduce(
    //       (acc, stack) => acc + stack.elements.length,
    //       0
    //     ),
    //     elements,
    //     permissionLevel: object.permissionLevel,
    //     derivedAccess: object.derived,
    //     isOwner,
    //     isManager,
    //     isEditor,
    //     isShared,
    //     isRemovable,
    //     updatedAt: object.practiceQuiz.updatedAt,
    //   }
    // }

    // if (object.microLearning) {
    //   const elements = object.microLearning.stacks
    //     .flatMap((block) => block.elements)
    //     .map((instance) => ({
    //       id: instance.id,
    //       name: instance.elementData.name,
    //     }))

    //   return {
    //     id: object.microLearning.id,
    //     templateId: object.microLearning.templateInfo?.id ?? null,
    //     name: object.microLearning.name,
    //     displayName: object.microLearning.displayName,
    //     type: ActivityType.MICRO_LEARNING,
    //     status: object.microLearning.status,
    //     course: object.microLearning.course?.name,
    //     numOfStacks: object.microLearning.stacks.length,
    //     numOfElements: object.microLearning.stacks.reduce(
    //       (acc, stack) => acc + stack.elements.length,
    //       0
    //     ),
    //     elements,
    //     permissionLevel: object.permissionLevel,
    //     derivedAccess: object.derived,
    //     isOwner,
    //     isManager,
    //     isEditor,
    //     isShared,
    //     isRemovable,
    //     updatedAt: object.microLearning.updatedAt,
    //   }
    // }

    // if (object.groupActivity) {
    //   const elements = object.groupActivity.stacks
    //     .flatMap((block) => block.elements)
    //     .map((instance) => ({
    //       id: instance.id,
    //       name: instance.elementData.name,
    //     }))

    //   return {
    //     id: object.groupActivity.id,
    //     templateId: object.groupActivity.templateInfo?.id ?? null,
    //     name: object.groupActivity.name,
    //     displayName: object.groupActivity.displayName,
    //     type: ActivityType.GROUP_ACTIVITY,
    //     status: object.groupActivity.status,
    //     course: object.groupActivity.course?.name,
    //     numOfStacks: object.groupActivity.stacks.length,
    //     numOfElements: object.groupActivity.stacks.reduce(
    //       (acc, stack) => acc + stack.elements.length,
    //       0
    //     ),
    //     elements,
    //     permissionLevel: object.permissionLevel,
    //     derivedAccess: object.derived,
    //     isOwner,
    //     isManager,
    //     isEditor,
    //     isShared,
    //     isRemovable,
    //     updatedAt: object.groupActivity.updatedAt,
    //   }
    // }

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
