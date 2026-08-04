import * as DB from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { getPermissionBooleans } from './activities.js'

export type LiveQuizActivityInfoPermission = Pick<
  DB.DerivedPermission,
  'permissionLevel' | 'derived'
> & {
  directPermission: Pick<DB.Permission, 'userGroupId'> | null
}

export type LiveQuizActivityInfoSource = Pick<
  DB.LiveQuiz,
  | 'id'
  | 'name'
  | 'displayName'
  | 'reviewStatus'
  | 'status'
  | 'courseId'
  | 'areInstancesOutdated'
  | 'isGamificationEnabled'
  | 'isAssessmentEnabled'
  | 'pinCode'
  | 'updatedAt'
> & {
  templateInfo: { id: string } | null
  course?: Pick<DB.Course, 'name' | 'startDate' | 'language'> | null
  blocks: Array<{ _count: { elements: number } }>
  _count: { permissions: number }
}

export function formatLiveQuizActivityInfo({
  activity,
  permission,
  course = activity.course,
  isActivityReviewer,
  implicitOwner = false,
  exposedCourseId = activity.courseId,
  numSharedUsers,
}: {
  activity: LiveQuizActivityInfoSource
  permission: LiveQuizActivityInfoPermission
  course?: LiveQuizActivityInfoSource['course']
  isActivityReviewer: boolean
  implicitOwner?: boolean
  exposedCourseId?: string | null
  numSharedUsers?: number
}) {
  const access = getPermissionBooleans({
    permissionLevel: permission.permissionLevel,
    derived: permission.derived,
    directGroupPermission:
      permission.directPermission?.userGroupId !== null &&
      permission.directPermission?.userGroupId !== undefined,
  })

  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.LIVE_QUIZ,
    status: activity.status,
    courseId: exposedCourseId,
    courseName: course?.name,
    courseStartDate: course?.startDate,
    courseLanguage: course?.language,
    numOfStacks: activity.blocks.length,
    numOfElements: activity.blocks.reduce(
      (total, block) => total + block._count.elements,
      0
    ),
    permissionLevel: permission.permissionLevel,
    derivedAccess: permission.derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    pinCode: activity.pinCode,
    numSharedUsers:
      numSharedUsers ??
      Math.max(0, activity._count.permissions - (implicitOwner ? 0 : 1)),
    ...access,
    isActivityReviewer,
    updatedAt: activity.updatedAt,
  }
}

export type LiveQuizActivityInfo = ReturnType<typeof formatLiveQuizActivityInfo>
