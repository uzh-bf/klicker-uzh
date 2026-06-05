import type * as DB from '@klicker-uzh/prisma/client'
import { PermissionLevel } from '@klicker-uzh/prisma/client'

type ControlCourseListItem = Pick<
  DB.Course,
  'description' | 'displayName' | 'id' | 'isArchived' | 'name'
>

type ControlCourseSource = Pick<DB.Course, 'id' | 'name'> & {
  liveQuizzes?: Pick<DB.LiveQuiz, 'id' | 'name' | 'status'>[] | null
}

type BasicCourseInformationSource = Pick<
  DB.Course,
  'color' | 'description' | 'displayName' | 'id'
> & {
  owner: Pick<DB.User, 'shortname'>
}

type ManageCourseListCourseSource = Pick<
  DB.Course,
  | 'color'
  | 'createdAt'
  | 'description'
  | 'displayName'
  | 'endDate'
  | 'id'
  | 'isArchived'
  | 'isAssessmentEnabled'
  | 'isGamificationEnabled'
  | 'isGroupCreationEnabled'
  | 'name'
  | 'startDate'
  | 'updatedAt'
> & {
  _count: {
    permissions: number
  }
}

type ManageCourseListObjectSource = {
  course: ManageCourseListCourseSource | null
  derived: boolean
  directPermission: Pick<DB.Permission, 'userGroupId'> | null
  permissionLevel: DB.PermissionLevel
}

type ActiveUserCourseSource = Pick<
  DB.Course,
  | 'color'
  | 'createdAt'
  | 'description'
  | 'displayName'
  | 'endDate'
  | 'groupDeadlineDate'
  | 'id'
  | 'isArchived'
  | 'isAssessmentEnabled'
  | 'isGamificationEnabled'
  | 'isGroupCreationEnabled'
  | 'name'
  | 'pinCode'
  | 'startDate'
  | 'updatedAt'
>

type ActiveUserCourseObjectSource = {
  course: ActiveUserCourseSource | null
  permissionLevel: DB.PermissionLevel
}

type CourseSummarySource = {
  _count: {
    participations: number
    liveQuizzes: number
    practiceQuizzes: number
    microLearnings: number
    groupActivities: number
    leaderboard: number
    participantGroups: number
  }
}

export function toControlCourseListItem(course: ControlCourseListItem) {
  return {
    id: course.id,
    name: course.name,
    isArchived: course.isArchived,
    displayName: course.displayName,
    description: course.description,
  }
}

export function toManageCourseListItem(object: ManageCourseListObjectSource) {
  const course = object.course
  if (!course) return null

  return {
    id: course.id,
    name: course.name,
    displayName: course.displayName,
    color: course.color,
    isArchived: course.isArchived,
    isGamificationEnabled: course.isGamificationEnabled,
    isAssessmentEnabled: course.isAssessmentEnabled,
    isGroupCreationEnabled: course.isGroupCreationEnabled,
    description: course.description,
    startDate: course.startDate,
    endDate: course.endDate,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    derivedAccess: object.derived,
    numSharedUsers: course._count.permissions - 1,
    permissionLevel: object.permissionLevel,
    isOwner: object.permissionLevel === PermissionLevel.OWNER,
    isManager:
      object.permissionLevel === PermissionLevel.OWNER ||
      object.permissionLevel === PermissionLevel.ADMIN,
    isEditor:
      object.permissionLevel === PermissionLevel.OWNER ||
      object.permissionLevel === PermissionLevel.ADMIN ||
      object.permissionLevel === PermissionLevel.WRITE,
    isShared: object.permissionLevel !== PermissionLevel.OWNER,
    isRemovable:
      object.permissionLevel !== PermissionLevel.OWNER &&
      !object.derived &&
      object.directPermission?.userGroupId === null,
  }
}

function toActiveUserCourseBase(course: ActiveUserCourseSource) {
  return {
    id: course.id,
    name: course.name,
    displayName: course.displayName,
    color: course.color,
    pinCode: course.pinCode,
    isArchived: course.isArchived,
    isGamificationEnabled: course.isGamificationEnabled,
    isAssessmentEnabled: course.isAssessmentEnabled,
    isGroupCreationEnabled: course.isGroupCreationEnabled,
    description: course.description,
    startDate: course.startDate,
    endDate: course.endDate,
    groupDeadlineDate: course.groupDeadlineDate,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  }
}

export function toActiveUserCourse(object: ActiveUserCourseObjectSource) {
  const course = object.course
  if (!course) return null

  return {
    ...toActiveUserCourseBase(course),
    isOwner: object.permissionLevel === PermissionLevel.OWNER,
    isManager:
      object.permissionLevel === PermissionLevel.OWNER ||
      object.permissionLevel === PermissionLevel.ADMIN,
    isEditor:
      object.permissionLevel === PermissionLevel.OWNER ||
      object.permissionLevel === PermissionLevel.ADMIN ||
      object.permissionLevel === PermissionLevel.WRITE,
    isShared: object.permissionLevel !== PermissionLevel.OWNER,
  }
}

export function toActiveUserCourseWithoutPermissions(
  course: ActiveUserCourseSource | null
) {
  if (!course) return null

  return {
    ...toActiveUserCourseBase(course),
    isOwner: false,
    isManager: false,
    isEditor: false,
    isShared: false,
  }
}

export function toControlCourse(course: ControlCourseSource | null) {
  if (!course) return null

  return {
    id: course.id,
    name: course.name,
    liveQuizzes:
      course.liveQuizzes?.map((quiz) => ({
        id: quiz.id,
        name: quiz.name,
        status: quiz.status,
      })) ?? [],
  }
}

export function toBasicCourseInformation(
  course: BasicCourseInformationSource | null
) {
  if (!course) return null

  return {
    id: course.id,
    displayName: course.displayName,
    description: course.description,
    color: course.color,
    owner: {
      shortname: course.owner.shortname,
    },
  }
}

export function toCourseSummary(course: CourseSummarySource | null) {
  if (!course) return null

  return {
    numOfParticipations: course._count.participations,
    numOfLiveQuizzes: course._count.liveQuizzes,
    numOfPracticeQuizzes: course._count.practiceQuizzes,
    numOfMicroLearnings: course._count.microLearnings,
    numOfGroupActivities: course._count.groupActivities,
    numOfLeaderboardEntries: course._count.leaderboard,
    numOfParticipantGroups: course._count.participantGroups,
  }
}
