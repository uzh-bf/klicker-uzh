import * as DB from '@klicker-uzh/prisma'
import { ActivityType, SharingType } from '@klicker-uzh/types'
import { sortBy } from 'remeda'
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
                include: { _count: { select: { elements: true } } },
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
                include: { _count: { select: { elements: true } } },
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
                include: { _count: { select: { elements: true } } },
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
                include: { _count: { select: { elements: true } } },
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
    const sharingType =
      object.permissionLevel === DB.PermissionLevel.OWNER
        ? SharingType.OWNED
        : object.derived
          ? SharingType.DEPENDENCY
          : SharingType.SHARED

    if (object.liveQuiz) {
      // if the object access is derived and the object is soft-deleted, don't show it
      if (object.derived && object.liveQuiz.isDeleted) {
        return []
      }

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
          (acc, block) => acc + block._count.elements,
          0
        ),
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        areInstancesOutdated: object.liveQuiz.areInstancesOutdated,
        numSharedUsers: undefined, // object.liveQuiz._count.permissions - 1,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        sharingType,
        updatedAt: object.liveQuiz.updatedAt,
      }
    } else if (object.practiceQuiz) {
      // if the object access is derived and the object is soft-deleted, don't show it
      if (object.derived && object.practiceQuiz.isDeleted) {
        return []
      }

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
          (acc, block) => acc + block._count.elements,
          0
        ),
        automaticPublicationAt: object.practiceQuiz.availableFrom,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        areInstancesOutdated: object.practiceQuiz.areInstancesOutdated,
        numSharedUsers: undefined, // object.practiceQuiz._count.permissions - 1,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        sharingType,
        updatedAt: object.practiceQuiz.updatedAt,
      }
    } else if (object.microLearning) {
      // if the object access is derived and the object is soft-deleted, don't show it
      if (object.derived && object.microLearning.isDeleted) {
        return []
      }

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
          (acc, block) => acc + block._count.elements,
          0
        ),
        scheduledStartAt: object.microLearning.scheduledStartAt,
        scheduledEndAt: object.microLearning.scheduledEndAt,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        areInstancesOutdated: object.microLearning.areInstancesOutdated,
        numSharedUsers: undefined, // object.microLearning._count.permissions - 1,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        sharingType,
        updatedAt: object.microLearning.updatedAt,
      }
    } else if (object.groupActivity) {
      // if the object access is derived and the object is soft-deleted, don't show it
      if (object.derived && object.groupActivity.isDeleted) {
        return []
      }

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
          (acc, block) => acc + block._count.elements,
          0
        ),
        scheduledStartAt: object.groupActivity.scheduledStartAt,
        scheduledEndAt: object.groupActivity.scheduledEndAt,
        groupDeadlineDate: object.groupActivity.course.groupDeadlineDate,
        numOfParticipantGroups:
          object.groupActivity.course._count.participantGroups,
        permissionLevel: object.permissionLevel,
        derivedAccess: object.derived,
        areInstancesOutdated: object.groupActivity.areInstancesOutdated,
        numSharedUsers: undefined, // object.groupActivity._count.permissions - 1,
        isOwner,
        isManager,
        isEditor,
        isExecutor,
        isShared,
        isRemovable,
        sharingType,
        updatedAt: object.groupActivity.updatedAt,
      }
    }

    return []
  })

  // the activities should be ordered as follows:
  // 1) first by active vs inactive status (active: published, scheduled, draft, template; inactive: ended, graded)
  // 2) then by type: live quiz, microlearning, practice quiz, group activity
  // 3) then by status within the active/inactive groups
  // 4) then by start date / updated date
  const activityTypeOrder = {
    [ActivityType.LIVE_QUIZ]: 1,
    [ActivityType.MICRO_LEARNING]: 2,
    [ActivityType.PRACTICE_QUIZ]: 3,
    [ActivityType.GROUP_ACTIVITY]: 4,
  }

  const activityStatusOrder = {
    [DB.PublicationStatus.PUBLISHED]: 1,
    [DB.PublicationStatus.SCHEDULED]: 2,
    [DB.PublicationStatus.DRAFT]: 3,
    [DB.PublicationStatus.TEMPLATE]: 4,
    [DB.PublicationStatus.ENDED]: 2,
    [DB.PublicationStatus.GRADED]: 1,
  }

  // Helper function to determine if a status is active or inactive
  const isActiveStatus = (status: DB.PublicationStatus): boolean => {
    return (
      status === DB.PublicationStatus.PUBLISHED ||
      status === DB.PublicationStatus.SCHEDULED ||
      status === DB.PublicationStatus.DRAFT ||
      status === DB.PublicationStatus.TEMPLATE
    )
  }

  return sortBy(
    activities,
    // first order by active/inactive (active first)
    (activity) => (isActiveStatus(activity.status) ? 0 : 1),
    // then order by activity type
    (activity) => activityTypeOrder[activity.type],
    // then order by status within each group
    (activity) => activityStatusOrder[activity.status] || 100,
    // then by scheduled start date or updated date
    (activity) => {
      if (activity.scheduledStartAt) {
        return -new Date(activity.scheduledStartAt).getTime()
      }
      return -new Date(activity.updatedAt).getTime()
    }
  )
}

export async function getLiveQuizDetails(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    include: {
      blocks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!liveQuiz) {
    return null
  }

  const defaultPoints = liveQuiz.defaultPoints
  const defaultCorrectPoints = liveQuiz.defaultCorrectPoints
  const defaultMaxBonusPoints = liveQuiz.maxBonusPoints
  const pointsMultiplierActivity = liveQuiz.pointsMultiplier

  const stacks = liveQuiz.blocks.map((block) => ({
    id: block.id,
    numOfParticipants: block.elements[0]
      ? block.elements[0].results.total +
        block.elements[0].anonymousResults.total
      : 0,
    timeLimit: block.timeLimit,
    stackPoints: block.elements.reduce((elementSum, instance) => {
      if (
        instance.elementType === DB.ElementType.CONTENT ||
        instance.elementType === DB.ElementType.FLASHCARD
      ) {
        // no points awarded
        return elementSum
      }

      const { elementData } = instance

      const hasBasePoints = elementData.basePoints
      const pointsMultiplier = instance.options.pointsMultiplier ?? 1
      const hasSampleSolution =
        'hasSampleSolution' in elementData.options &&
        ((elementData.options as { hasSampleSolution?: boolean })
          .hasSampleSolution ??
          false)

      const basePoints = hasBasePoints ? defaultPoints : 0
      const correctnessPoints = hasSampleSolution ? defaultCorrectPoints : 0
      const maxBonusPoints = hasSampleSolution ? defaultMaxBonusPoints : 0

      const totalPoints =
        basePoints + pointsMultiplier * (correctnessPoints + maxBonusPoints)

      return elementSum + totalPoints
    }, 0),
    elements: block.elements.map((instance) => {
      const isContentOrFlashcard =
        instance.elementType === DB.ElementType.CONTENT ||
        instance.elementType === DB.ElementType.FLASHCARD
      const { elementData } = instance

      const hasBasePoints = elementData.basePoints
      const pointsMultiplier = instance.options.pointsMultiplier ?? 1
      const hasSampleSolution =
        'hasSampleSolution' in elementData.options &&
        ((elementData.options as { hasSampleSolution?: boolean })
          .hasSampleSolution ??
          false)

      const basePoints =
        !isContentOrFlashcard && hasBasePoints ? defaultPoints : 0
      const correctnessPoints =
        !isContentOrFlashcard && hasSampleSolution
          ? pointsMultiplier * defaultCorrectPoints
          : 0
      const bonusPoints =
        !isContentOrFlashcard && hasSampleSolution
          ? pointsMultiplier * defaultMaxBonusPoints
          : 0
      const totalPoints = basePoints + (correctnessPoints + bonusPoints)
      return {
        basePoints: basePoints,
        correctnessPoints: correctnessPoints,
        bonusPoints: bonusPoints,
        totalPoints: totalPoints,
        hasSampleSolution: hasSampleSolution,
        instance: instance,
      }
    }),
  }))

  const {
    totalBasePoints,
    totalCorrectnessPoints,
    totalBonusPoints,
    totalPoints,
  } = stacks.reduce(
    (acc, stack) => {
      for (const el of stack.elements) {
        acc.totalBasePoints += el.basePoints
        acc.totalCorrectnessPoints += el.correctnessPoints ?? 0
        acc.totalBonusPoints += el.bonusPoints ?? 0
      }
      acc.totalPoints += stack.stackPoints
      return acc
    },
    {
      totalBasePoints: 0,
      totalCorrectnessPoints: 0,
      totalBonusPoints: 0,
      totalPoints: 0,
    }
  )

  const metadata = {
    name: liveQuiz.name,
    displayName: liveQuiz.displayName,
    type: ActivityType.LIVE_QUIZ,
    pointsMultiplier: pointsMultiplierActivity,
    totalBasePoints: totalBasePoints,
    totalCorrectnessPoints: totalCorrectnessPoints,
    totalBonusPoints: totalBonusPoints,
    totalPoints: totalPoints,
  }

  return { id: liveQuiz.id, metadata, stacks }
}

function getAsynchronousActivityElementInstanceDetails(
  instance: DB.ElementInstance,
  isGroupActivity: boolean
): {
  basePoints: number
  isContentOrFlashcard: boolean
  hasSampleSolution: boolean
} {
  const isContentOrFlashcard =
    instance.elementType === DB.ElementType.CONTENT ||
    instance.elementType === DB.ElementType.FLASHCARD
  const { elementData } = instance

  const hasBasePoints = elementData.basePoints
  const pointsMultiplier = !isContentOrFlashcard
    ? 'pointsMultiplier' in elementData.options
      ? ((elementData.options as { pointsMultiplier?: number })
          .pointsMultiplier ?? 1)
      : 1
    : 1
  const hasSampleSolution =
    !isContentOrFlashcard &&
    'hasSampleSolution' in elementData.options &&
    ((elementData.options as { hasSampleSolution?: boolean })
      .hasSampleSolution ??
      false)

  const defaultBasePoints = isGroupActivity ? 25 : 10
  const basePoints =
    !isContentOrFlashcard && hasBasePoints && hasSampleSolution
      ? pointsMultiplier * defaultBasePoints
      : 0
  return {
    basePoints,
    isContentOrFlashcard,
    hasSampleSolution,
  }
}

export async function getPracticeQuizDetails(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: { id },
    include: {
      stacks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!practiceQuiz) {
    return null
  }

  const pointsMultiplierActivity = practiceQuiz.pointsMultiplier

  const stacks = practiceQuiz.stacks.map((block) => ({
    id: block.id,
    numOfParticipants: block.elements[0]
      ? block.elements[0].results.total +
        block.elements[0].anonymousResults.total
      : 0,
    stackPoints: block.elements.reduce((elementSum, instance) => {
      const { basePoints, isContentOrFlashcard, hasSampleSolution } =
        getAsynchronousActivityElementInstanceDetails(instance, false)

      return isContentOrFlashcard ? elementSum : elementSum + basePoints
    }, 0),
    elements: block.elements.map((instance) => {
      const { basePoints, isContentOrFlashcard, hasSampleSolution } =
        getAsynchronousActivityElementInstanceDetails(instance, false)

      return {
        basePoints: basePoints,
        correctnessPoints: null,
        bonusPoints: null,
        totalPoints: basePoints,
        hasSampleSolution: hasSampleSolution,
        instance: instance,
      }
    }),
  }))

  const { totalBasePoints, totalPoints } = stacks.reduce(
    (acc, stack) => {
      for (const el of stack.elements) {
        acc.totalBasePoints += el.basePoints
      }
      acc.totalPoints += stack.stackPoints
      return acc
    },
    {
      totalBasePoints: 0,
      totalPoints: 0,
    }
  )
  const metadata = {
    name: practiceQuiz.name,
    displayName: practiceQuiz.displayName,
    type: ActivityType.PRACTICE_QUIZ,
    pointsMultiplier: pointsMultiplierActivity,
    totalBasePoints: totalBasePoints,
    totalCorrectnessPoints: null,
    totalBonusPoints: null,
    totalPoints: totalPoints,
  }
  return { id: practiceQuiz.id, metadata, stacks }
}

export async function getMicroLearningDetails(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: { id },
    include: {
      stacks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!microLearning) {
    return null
  }

  const pointsMultiplierActivity = microLearning.pointsMultiplier

  const stacks = microLearning.stacks.map((block) => ({
    id: block.id,
    numOfParticipants: block.elements[0]
      ? block.elements[0].results.total +
        block.elements[0].anonymousResults.total
      : 0,
    stackPoints: block.elements.reduce((elementSum, instance) => {
      const { basePoints, isContentOrFlashcard, hasSampleSolution } =
        getAsynchronousActivityElementInstanceDetails(instance, false)

      return isContentOrFlashcard ? elementSum : elementSum + basePoints
    }, 0),
    elements: block.elements.map((instance) => {
      const { basePoints, isContentOrFlashcard, hasSampleSolution } =
        getAsynchronousActivityElementInstanceDetails(instance, false)

      return {
        basePoints: basePoints,
        correctnessPoints: null,
        bonusPoints: null,
        totalPoints: basePoints,
        hasSampleSolution: hasSampleSolution,
        instance: instance,
      }
    }),
  }))

  const { totalBasePoints, totalPoints } = stacks.reduce(
    (acc, stack) => {
      for (const el of stack.elements) {
        acc.totalBasePoints += el.basePoints
      }
      acc.totalPoints += stack.stackPoints
      return acc
    },
    {
      totalBasePoints: 0,
      totalPoints: 0,
    }
  )
  const metadata = {
    name: microLearning.name,
    displayName: microLearning.displayName,
    type: ActivityType.MICRO_LEARNING,
    pointsMultiplier: pointsMultiplierActivity,
    totalBasePoints: totalBasePoints,
    totalCorrectnessPoints: null,
    totalBonusPoints: null,
    totalPoints: totalPoints,
  }
  return { id: microLearning.id, metadata, stacks }
}

export async function getGroupActivityDetails(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const groupActivity = await ctx.prisma.groupActivity.findUnique({
    where: { id },
    include: {
      course: {
        include: { _count: { select: { participantGroups: true } } },
      },
      stacks: {
        include: { elements: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!groupActivity) {
    return null
  }

  const pointsMultiplierActivity = groupActivity.pointsMultiplier

  const stacks = groupActivity.stacks.map((block) => ({
    id: block.id,
    numOfParticipants: block.elements[0]
      ? block.elements[0].results.total +
        block.elements[0].anonymousResults.total
      : 0,
    stackPoints: block.elements.reduce((elementSum, instance) => {
      const { basePoints, isContentOrFlashcard, hasSampleSolution } =
        getAsynchronousActivityElementInstanceDetails(instance, true)

      return isContentOrFlashcard ? elementSum : elementSum + basePoints
    }, 0),
    elements: block.elements.map((instance) => {
      const { basePoints, isContentOrFlashcard, hasSampleSolution } =
        getAsynchronousActivityElementInstanceDetails(instance, true)

      return {
        basePoints: basePoints,
        correctnessPoints: null,
        bonusPoints: null,
        totalPoints: basePoints,
        hasSampleSolution: hasSampleSolution,
        instance: instance,
      }
    }),
  }))

  const { totalBasePoints, totalPoints } = stacks.reduce(
    (acc, stack) => {
      for (const el of stack.elements) {
        acc.totalBasePoints += el.basePoints
      }
      acc.totalPoints += stack.stackPoints
      return acc
    },
    {
      totalBasePoints: 0,
      totalPoints: 0,
    }
  )
  const metadata = {
    name: groupActivity.name,
    displayName: groupActivity.displayName,
    type: ActivityType.GROUP_ACTIVITY,
    pointsMultiplier: pointsMultiplierActivity,
    totalBasePoints: totalBasePoints,
    totalCorrectnessPoints: null,
    totalBonusPoints: null,
    totalPoints: totalPoints,
  }

  return { id: groupActivity.id, metadata, stacks }
}
