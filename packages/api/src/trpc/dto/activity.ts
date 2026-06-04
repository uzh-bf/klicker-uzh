import type * as DB from '@klicker-uzh/prisma/client'
import { ElementType, PermissionLevel } from '@klicker-uzh/prisma/client'
import { ActivityType, SharingType } from '@klicker-uzh/types'

const POINTS_PER_INSTANCE = 10
const POINTS_PER_GROUP_ACTIVITY_ELEMENT = 25

type JsonRecord = Record<string, unknown>

type UserActivitiesCourseObjectSource = {
  courseId: string | null
  course: {
    id: string
    name: string
    _count: {
      liveQuizzes: number
      practiceQuizzes: number
      microLearnings: number
      groupActivities: number
    }
  } | null
}

type ActivityElementSource = DB.ElementInstance & {
  element: {
    isDeleted: boolean
    permissions?: unknown[]
    _count?: {
      permissions: number
    }
  }
}

type ActivityStackSource = {
  id: number
  displayName?: string | null
  description?: string | null
  elements: ActivityElementSource[]
}

type LiveQuizBlockSource = {
  id: number
  timeLimit?: number | null
  elements: ActivityElementSource[]
}

type ActivityOwnerSource = {
  shortname: string
  email: string | null
}

type ActivityCoursePermissionSource = {
  _count: {
    permissions: number
  }
} | null

type ActivityDetailsBaseSource = {
  id: string
  name: string
  displayName: string
  status: DB.PublicationStatus
  reviewStatus: DB.ReviewStatus
  courseId: string | null
  owner: ActivityOwnerSource
  isGamificationEnabled: boolean
  isAssessmentEnabled: boolean
  pointsMultiplier: number
  _count: {
    permissions: number
  }
  course: ActivityCoursePermissionSource
}

type LiveQuizDetailsSource = ActivityDetailsBaseSource & {
  defaultPoints: number
  defaultCorrectPoints: number
  maxBonusPoints: number
  pinCode: string | null
  blocks: LiveQuizBlockSource[]
}

type AsyncActivityDetailsSource = ActivityDetailsBaseSource & {
  stacks: ActivityStackSource[]
}

type OutdatedElementInstanceSource = DB.ElementInstance & {
  element: {
    version: number
    name: string
    options: unknown
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getObjectProperty(value: unknown, key: string) {
  return isRecord(value) ? value[key] : undefined
}

function getBooleanProperty(value: unknown, key: string, fallback = false) {
  const property = getObjectProperty(value, key)
  return typeof property === 'boolean' ? property : fallback
}

function getNumberProperty(value: unknown, key: string, fallback = 0) {
  const property = getObjectProperty(value, key)
  return typeof property === 'number' ? property : fallback
}

function getElementDataOptions(elementData: DB.ElementInstance['elementData']) {
  return getObjectProperty(elementData, 'options')
}

function getHasSampleSolution(instance: DB.ElementInstance) {
  return getBooleanProperty(
    getElementDataOptions(instance.elementData),
    'hasSampleSolution'
  )
}

function getResultTotal(results: unknown) {
  return getNumberProperty(results, 'total')
}

function toActivityElementInstance(instance: DB.ElementInstance) {
  return {
    id: instance.id,
    type: instance.type,
    elementType: instance.elementType,
    options: instance.options,
    elementData: instance.elementData,
  }
}

function toLiveQuizBlockDetails({
  block,
  arePointsAwarded,
  defaultPoints,
  defaultCorrectPoints,
  defaultMaxBonusPoints,
}: {
  block: LiveQuizBlockSource
  arePointsAwarded: boolean
  defaultPoints: number
  defaultCorrectPoints: number
  defaultMaxBonusPoints: number
}) {
  const elements = block.elements.map((instance) => {
    const hasSampleSolution = getHasSampleSolution(instance)
    const isEditor = (instance.element._count?.permissions ?? 0) > 0
    const isDeleted = instance.element.isDeleted

    if (!arePointsAwarded) {
      return {
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        totalPoints: 0,
        hasSampleSolution,
        isEditor,
        isDeleted,
        instance: toActivityElementInstance(instance),
      }
    }

    const hasBasePoints =
      instance.elementType !== ElementType.FLASHCARD &&
      instance.elementType !== ElementType.CONTENT &&
      getBooleanProperty(instance.options, 'basePoints')
    const pointsMultiplier = getNumberProperty(
      instance.options,
      'pointsMultiplier',
      1
    )

    const basePoints = hasBasePoints ? defaultPoints : 0
    const correctnessPoints = hasSampleSolution
      ? pointsMultiplier * defaultCorrectPoints
      : 0
    const bonusPoints = hasSampleSolution
      ? pointsMultiplier * defaultMaxBonusPoints
      : 0
    const totalPoints = basePoints + correctnessPoints + bonusPoints

    return {
      basePoints,
      correctnessPoints,
      bonusPoints,
      totalPoints,
      hasSampleSolution,
      isEditor,
      isDeleted,
      instance: toActivityElementInstance(instance),
    }
  })

  return {
    id: block.id,
    numOfParticipants: block.elements[0]
      ? getResultTotal(block.elements[0].results) +
        getResultTotal(block.elements[0].anonymousResults)
      : 0,
    timeLimit: block.timeLimit ?? null,
    stackPoints: arePointsAwarded
      ? elements.reduce((acc, element) => acc + element.totalPoints, 0)
      : null,
    elements,
  }
}

function getAsyncActivityElementInstanceDetails({
  instance,
  isGroupActivity,
}: {
  instance: DB.ElementInstance
  isGroupActivity: boolean
}) {
  const hasSampleSolution = getHasSampleSolution(instance)
  const pointsMultiplier = getNumberProperty(
    instance.options,
    'pointsMultiplier',
    1
  )
  const defaultBasePoints = isGroupActivity
    ? POINTS_PER_GROUP_ACTIVITY_ELEMENT
    : POINTS_PER_INSTANCE

  return {
    points: hasSampleSolution ? pointsMultiplier * defaultBasePoints : 0,
    hasSampleSolution,
  }
}

function toAsyncActivityStackDetails({
  stack,
  isGroupActivity = false,
  arePointsAwarded,
}: {
  stack: ActivityStackSource
  isGroupActivity?: boolean
  arePointsAwarded: boolean
}) {
  const { elements, stackPoints } = stack.elements.reduce<{
    elements: {
      totalPoints: number
      hasSampleSolution: boolean
      isEditor: boolean
      isDeleted: boolean
      instance: ReturnType<typeof toActivityElementInstance>
    }[]
    stackPoints: number
  }>(
    (acc, instance) => {
      const { points, hasSampleSolution } = arePointsAwarded
        ? getAsyncActivityElementInstanceDetails({
            instance,
            isGroupActivity,
          })
        : {
            points: 0,
            hasSampleSolution: getHasSampleSolution(instance),
          }

      acc.elements.push({
        totalPoints: points,
        hasSampleSolution,
        isEditor: Boolean(instance.element.permissions?.[0]),
        isDeleted: instance.element.isDeleted,
        instance: toActivityElementInstance(instance),
      })
      acc.stackPoints += points
      return acc
    },
    { elements: [], stackPoints: 0 }
  )

  return {
    id: stack.id,
    numOfParticipants: stack.elements[0]
      ? getResultTotal(stack.elements[0].results) +
        getResultTotal(stack.elements[0].anonymousResults)
      : 0,
    stackTitle: stack.displayName ?? null,
    stackDescription: stack.description ?? null,
    stackPoints: arePointsAwarded ? stackPoints : null,
    elements,
  }
}

export function toUserActivitiesCourseListItem(
  object: UserActivitiesCourseObjectSource
) {
  const course = object.course
  if (!course || !object.courseId) return null

  const hasActivities =
    course._count.liveQuizzes > 0 ||
    course._count.practiceQuizzes > 0 ||
    course._count.microLearnings > 0 ||
    course._count.groupActivities > 0

  if (!hasActivities) return null

  return {
    id: object.courseId,
    name: course.name,
  }
}

export function toActivityPermissionBooleans({
  permissionLevel,
  derived,
  directGroupPermission,
}: {
  permissionLevel: DB.PermissionLevel
  derived: boolean
  directGroupPermission: boolean
}) {
  return {
    isOwner: permissionLevel === PermissionLevel.OWNER,
    isManager:
      permissionLevel === PermissionLevel.OWNER ||
      permissionLevel === PermissionLevel.ADMIN,
    isEditor:
      permissionLevel === PermissionLevel.OWNER ||
      permissionLevel === PermissionLevel.ADMIN ||
      permissionLevel === PermissionLevel.WRITE,
    isExecutor:
      permissionLevel === PermissionLevel.EXECUTE ||
      permissionLevel === PermissionLevel.WRITE ||
      permissionLevel === PermissionLevel.ADMIN ||
      permissionLevel === PermissionLevel.OWNER,
    isShared: permissionLevel !== PermissionLevel.OWNER,
    isRemovable:
      permissionLevel !== PermissionLevel.OWNER &&
      !derived &&
      !directGroupPermission,
    sharingType:
      permissionLevel === PermissionLevel.OWNER
        ? SharingType.OWNED
        : derived
          ? SharingType.DEPENDENCY
          : SharingType.SHARED,
  }
}

export function toUserActivityOverviewItem(activity: DB.UserActivities) {
  if (activity.derived && activity.isDeleted) return null

  const {
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    sharingType,
  } = toActivityPermissionBooleans({
    permissionLevel: activity.permissionLevel,
    derived: activity.derived,
    directGroupPermission: activity.directPermissionUserGroupId !== null,
  })

  return {
    id: activity.id,
    templateId: activity.templateId,
    type: activity.type as ActivityType,
    status: activity.status,
    courseId: activity.courseId,
    courseName: activity.courseName,
    courseStartDate: activity.courseStartDate,
    courseLanguage: activity.courseLanguage,
    numOfStacks: activity.numOfStacks,
    numOfElements: activity.numOfElements,
    reviewStatus: activity.reviewStatus,
    automaticPublicationAt: activity.availableFrom,
    scheduledStartAt: activity.scheduledStartAt,
    scheduledEndAt: activity.scheduledEndAt,
    groupDeadlineDate: activity.groupDeadlineDate,
    numOfParticipantGroups: activity.numOfParticipantGroups,
    name: activity.name,
    displayName: activity.displayName,
    permissionLevel: activity.permissionLevel,
    derivedAccess: activity.derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    pinCode: activity.type === ActivityType.LIVE_QUIZ ? activity.pinCode : null,
    numSharedUsers: activity.numActivityPermissions,
    isOwner,
    isManager,
    isEditor,
    isExecutor,
    isShared,
    isRemovable,
    isActivityReviewer:
      (activity.type === ActivityType.LIVE_QUIZ &&
        activity.courseId === null &&
        (activity.permissionLevel === PermissionLevel.OWNER ||
          activity.permissionLevel === PermissionLevel.ADMIN)) ||
      activity.isUserCourseAdmin,
    sharingType,
    updatedAt: activity.updatedAt,
  }
}

export function toLiveQuizActivityDetails(liveQuiz: LiveQuizDetailsSource) {
  const arePointsAwarded =
    liveQuiz.isGamificationEnabled || liveQuiz.isAssessmentEnabled
  const stacks = liveQuiz.blocks.map((block) =>
    toLiveQuizBlockDetails({
      block,
      arePointsAwarded,
      defaultPoints: liveQuiz.defaultPoints,
      defaultCorrectPoints: liveQuiz.defaultCorrectPoints,
      defaultMaxBonusPoints: liveQuiz.maxBonusPoints,
    })
  )

  const totals = arePointsAwarded
    ? stacks.reduce(
        (acc, stack) => {
          for (const element of stack.elements) {
            acc.totalBasePoints += element.basePoints
            acc.totalCorrectnessPoints += element.correctnessPoints
            acc.totalBonusPoints += element.bonusPoints
          }
          acc.totalPoints += stack.stackPoints ?? 0
          return acc
        },
        {
          totalBasePoints: 0,
          totalCorrectnessPoints: 0,
          totalBonusPoints: 0,
          totalPoints: 0,
        }
      )
    : {
        totalBasePoints: 0,
        totalCorrectnessPoints: 0,
        totalBonusPoints: 0,
        totalPoints: 0,
      }

  const isActivityManager = liveQuiz._count.permissions > 0

  return {
    id: liveQuiz.id,
    name: liveQuiz.name,
    displayName: liveQuiz.displayName,
    status: liveQuiz.status,
    reviewStatus: liveQuiz.reviewStatus,
    isActivityReviewer:
      (liveQuiz.courseId === null && liveQuiz._count.permissions > 0) ||
      (liveQuiz.course?._count.permissions ?? 0) > 0,
    isActivityManager,
    courseId: liveQuiz.courseId,
    ownerShortname: liveQuiz.owner.shortname,
    ownerEmail: isActivityManager ? liveQuiz.owner.email : null,
    isGamificationEnabled: liveQuiz.isGamificationEnabled,
    arePointsAwarded,
    pointsMultiplier: liveQuiz.pointsMultiplier,
    totalBasePoints: totals.totalBasePoints,
    totalCorrectnessPoints: totals.totalCorrectnessPoints,
    totalBonusPoints: totals.totalBonusPoints,
    totalPoints: totals.totalPoints,
    isAssessmentEnabled: liveQuiz.isAssessmentEnabled,
    isPinProtected: Boolean(liveQuiz.pinCode),
    pinCode: liveQuiz.pinCode,
    stacks,
  }
}

export function toAsyncActivityDetails({
  activity,
  isGroupActivity = false,
}: {
  activity: AsyncActivityDetailsSource
  isGroupActivity?: boolean
}) {
  const arePointsAwarded =
    activity.isGamificationEnabled || activity.isAssessmentEnabled
  const stacks = activity.stacks.map((stack) =>
    toAsyncActivityStackDetails({
      stack,
      isGroupActivity,
      arePointsAwarded,
    })
  )
  const totalPoints = arePointsAwarded
    ? stacks.reduce((acc, stack) => acc + (stack.stackPoints ?? 0), 0)
    : 0
  const isActivityManager = activity._count.permissions > 0

  return {
    id: activity.id,
    name: activity.name,
    displayName: activity.displayName,
    status: activity.status,
    reviewStatus: activity.reviewStatus,
    isActivityReviewer: (activity.course?._count.permissions ?? 0) > 0,
    isActivityManager,
    courseId: activity.courseId,
    ownerShortname: activity.owner.shortname,
    ownerEmail: isActivityManager ? activity.owner.email : null,
    isGamificationEnabled: activity.isGamificationEnabled,
    arePointsAwarded,
    pointsMultiplier: activity.pointsMultiplier,
    totalBasePoints: null,
    totalCorrectnessPoints: null,
    totalBonusPoints: null,
    totalPoints,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    isPinProtected: false,
    pinCode: null,
    stacks,
  }
}

export function toOutdatedElementInstanceInfo(
  instance: OutdatedElementInstanceSource
) {
  const elementDataId = getObjectProperty(instance.elementData, 'id')
  if (typeof elementDataId !== 'string') return null

  const [, instanceVersion] = elementDataId.split('-v')
  if (!instanceVersion) return null

  if (Number.parseInt(instanceVersion, 10) >= instance.element.version) {
    return null
  }

  return {
    id: instance.id,
    newTitle: instance.element.name,
    newSampleSolution: getBooleanProperty(
      instance.element.options,
      'hasSampleSolution'
    ),
  }
}
