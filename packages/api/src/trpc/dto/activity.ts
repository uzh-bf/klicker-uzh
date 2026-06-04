import type * as DB from '@klicker-uzh/prisma/client'
import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { ActivityType, SharingType } from '@klicker-uzh/types'

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
