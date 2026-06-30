import type * as DB from '@klicker-uzh/prisma/client'
import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { ActivityType, SharingType } from '@klicker-uzh/types'

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

type CourseDetailPermissionSource = Pick<
  DB.DerivedPermission,
  'derived' | 'permissionLevel'
> & {
  directPermission: Pick<DB.Permission, 'userGroupId'> | null
}

type CourseDetailActivityStackSource = {
  _count: {
    elements: number
  }
}

type CourseDetailActivityBaseSource = {
  id: string
  name: string
  displayName: string
  status: DB.PublicationStatus
  reviewStatus: DB.ReviewStatus
  isGamificationEnabled: boolean
  isAssessmentEnabled: boolean
  areInstancesOutdated: boolean
  updatedAt: Date
  permissions: CourseDetailPermissionSource[]
  templateInfo: Pick<DB.ActivityTemplate, 'id'> | null
  _count: {
    permissions: number
  }
}

type CourseDetailLiveQuizSource = CourseDetailActivityBaseSource & {
  pinCode: string | null
  blocks: CourseDetailActivityStackSource[]
}

type CourseDetailStackedActivitySource = CourseDetailActivityBaseSource & {
  stacks: CourseDetailActivityStackSource[]
}

type CourseDetailPracticeQuizSource = CourseDetailStackedActivitySource & {
  availableFrom: Date | null
}

type CourseDetailScheduledActivitySource = CourseDetailStackedActivitySource & {
  scheduledStartAt: Date | null
  scheduledEndAt: Date | null
}

type CourseDetailSource = ActiveUserCourseSource &
  Pick<
    DB.Course,
    | 'displayName'
    | 'language'
    | 'maxGroupSize'
    | 'notificationEmail'
    | 'preferredGroupSize'
    | 'randomAssignmentFinalized'
  > & {
    _count: {
      participantGroups: number
      participations: number
      permissions: number
    }
    permissions: CourseDetailPermissionSource[]
    liveQuizzes: CourseDetailLiveQuizSource[]
    practiceQuizzes: CourseDetailPracticeQuizSource[]
    microLearnings: CourseDetailScheduledActivitySource[]
    groupActivities: CourseDetailScheduledActivitySource[]
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

type CourseActivitiesSource = Pick<DB.Course, 'id' | 'name'> & {
  practiceQuizzes?: Pick<DB.PracticeQuiz, 'id' | 'name' | 'status'>[] | null
  microLearnings?: Pick<DB.MicroLearning, 'id' | 'name' | 'status'>[] | null
}

type CourseGroupParticipantSource = Pick<
  DB.Participant,
  'avatar' | 'email' | 'id' | 'username'
>

type CourseParticipantGroupSource = Pick<
  DB.ParticipantGroup,
  'averageMemberScore' | 'code' | 'groupActivityScore' | 'id' | 'name'
> & {
  participants?: CourseGroupParticipantSource[] | null
}

type CourseGroupPoolEntrySource = Pick<DB.GroupAssignmentPoolEntry, 'id'> & {
  participant?: CourseGroupParticipantSource | null
}

type CourseGroupsSource = {
  participantGroups?: CourseParticipantGroupSource[] | null
  groupAssignmentPoolEntries?: CourseGroupPoolEntrySource[] | null
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

function toPermissionBooleans({
  permissionLevel,
  derived,
  directPermission,
}: CourseDetailPermissionSource) {
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
      directPermission?.userGroupId === null,
    sharingType:
      permissionLevel === PermissionLevel.OWNER
        ? SharingType.OWNED
        : derived
          ? SharingType.DEPENDENCY
          : SharingType.SHARED,
  }
}

function toCourseDetailActivity({
  activity,
  course,
  type,
  numOfStacks,
  numOfElements,
  automaticPublicationAt,
  scheduledStartAt,
  scheduledEndAt,
  groupDeadlineDate,
  numOfParticipantGroups,
  pinCode,
  isActivityReviewer,
}: {
  activity: CourseDetailActivityBaseSource
  course: CourseDetailSource
  type: ActivityType
  numOfStacks: number
  numOfElements: number
  automaticPublicationAt?: Date | null
  scheduledStartAt?: Date | null
  scheduledEndAt?: Date | null
  groupDeadlineDate?: Date | null
  numOfParticipantGroups?: number | null
  pinCode?: string | null
  isActivityReviewer: boolean
}) {
  const permission = activity.permissions[0]
  if (!permission) return null

  const permissionBooleans = toPermissionBooleans(permission)

  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    type,
    status: activity.status,
    courseId: course.id,
    courseName: course.name,
    courseStartDate: course.startDate,
    courseLanguage: course.language,
    numOfStacks,
    numOfElements,
    reviewStatus: activity.reviewStatus,
    automaticPublicationAt: automaticPublicationAt ?? null,
    scheduledStartAt: scheduledStartAt ?? null,
    scheduledEndAt: scheduledEndAt ?? null,
    groupDeadlineDate: groupDeadlineDate ?? null,
    numOfParticipantGroups: numOfParticipantGroups ?? null,
    name: activity.name,
    displayName: activity.displayName,
    permissionLevel: permission.permissionLevel,
    derivedAccess: permission.derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    pinCode: pinCode ?? null,
    numSharedUsers: activity._count.permissions - 1,
    ...permissionBooleans,
    isActivityReviewer,
    updatedAt: activity.updatedAt,
  }
}

function nonNullable<T>(value: T | null): value is T {
  return value !== null
}

export function toCourseDetail(course: CourseDetailSource | null) {
  if (!course) return null

  const coursePermission = course.permissions[0]
  if (!coursePermission) return null

  const coursePermissionBooleans = toPermissionBooleans(coursePermission)
  const isActivityReviewer =
    coursePermission.permissionLevel === PermissionLevel.ADMIN ||
    coursePermission.permissionLevel === PermissionLevel.OWNER

  return {
    id: course.id,
    isArchived: course.isArchived,
    isGamificationEnabled: course.isGamificationEnabled,
    isAssessmentEnabled: course.isAssessmentEnabled,
    pinCode: course.pinCode,
    name: course.name,
    displayName: course.displayName,
    description: course.description,
    language: course.language,
    notificationEmail: course.notificationEmail,
    color: course.color,
    numOfParticipants: course._count.participations,
    numOfParticipantGroups: course._count.participantGroups,
    averageScore: null,
    startDate: course.startDate,
    endDate: course.endDate,
    isGroupCreationEnabled: course.isGroupCreationEnabled,
    groupDeadlineDate: course.groupDeadlineDate,
    maxGroupSize: course.maxGroupSize,
    preferredGroupSize: course.preferredGroupSize,
    randomAssignmentFinalized: course.randomAssignmentFinalized,
    derivedAccess: coursePermission.derived,
    numSharedUsers: course._count.permissions - 1,
    permissionLevel: coursePermission.permissionLevel,
    ...coursePermissionBooleans,
    liveQuizzesInfo: course.liveQuizzes
      .map((activity) =>
        toCourseDetailActivity({
          activity,
          course,
          type: ActivityType.LIVE_QUIZ,
          numOfStacks: activity.blocks.length,
          numOfElements: activity.blocks.reduce(
            (acc, block) => acc + block._count.elements,
            0
          ),
          pinCode: activity.pinCode,
          isActivityReviewer,
        })
      )
      .filter(nonNullable),
    practiceQuizzesInfo: course.practiceQuizzes
      .map((activity) =>
        toCourseDetailActivity({
          activity,
          course,
          type: ActivityType.PRACTICE_QUIZ,
          numOfStacks: activity.stacks.length,
          numOfElements: activity.stacks.reduce(
            (acc, stack) => acc + stack._count.elements,
            0
          ),
          automaticPublicationAt: activity.availableFrom,
          isActivityReviewer,
        })
      )
      .filter(nonNullable),
    microLearningsInfo: course.microLearnings
      .map((activity) =>
        toCourseDetailActivity({
          activity,
          course,
          type: ActivityType.MICRO_LEARNING,
          numOfStacks: activity.stacks.length,
          numOfElements: activity.stacks.reduce(
            (acc, stack) => acc + stack._count.elements,
            0
          ),
          scheduledStartAt: activity.scheduledStartAt,
          scheduledEndAt: activity.scheduledEndAt,
          isActivityReviewer,
        })
      )
      .filter(nonNullable),
    groupActivitiesInfo: course.groupActivities
      .map((activity) =>
        toCourseDetailActivity({
          activity,
          course,
          type: ActivityType.GROUP_ACTIVITY,
          numOfStacks: activity.stacks.length,
          numOfElements: activity.stacks.reduce(
            (acc, stack) => acc + stack._count.elements,
            0
          ),
          scheduledStartAt: activity.scheduledStartAt,
          scheduledEndAt: activity.scheduledEndAt,
          groupDeadlineDate: course.groupDeadlineDate,
          numOfParticipantGroups: course._count.participantGroups,
          isActivityReviewer,
        })
      )
      .filter(nonNullable),
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

export function toCourseActivities(course: CourseActivitiesSource | null) {
  if (!course) return null

  return {
    id: course.id,
    name: course.name,
    practiceQuizzes:
      course.practiceQuizzes?.map((quiz) => ({
        id: quiz.id,
        name: quiz.name,
        status: quiz.status,
      })) ?? [],
    microLearnings:
      course.microLearnings?.map((microLearning) => ({
        id: microLearning.id,
        name: microLearning.name,
        status: microLearning.status,
      })) ?? [],
  }
}

function toCourseParticipantGroup(group: CourseParticipantGroupSource) {
  return {
    id: group.id,
    name: group.name,
    code: group.code,
    averageMemberScore: group.averageMemberScore,
    groupActivityScore: group.groupActivityScore,
    participants:
      group.participants?.map((participant) => ({
        id: participant.id,
        username: participant.username,
        email: participant.email,
        avatar: participant.avatar,
      })) ?? [],
  }
}

export function toCourseGroups(course: CourseGroupsSource | null) {
  if (!course) return null

  return {
    participantGroups:
      course.participantGroups?.map(toCourseParticipantGroup) ?? [],
    groupAssignmentPoolEntries:
      course.groupAssignmentPoolEntries?.map((entry) => ({
        id: entry.id,
        participant: entry.participant
          ? {
              id: entry.participant.id,
              username: entry.participant.username,
              email: entry.participant.email,
              avatar: entry.participant.avatar,
            }
          : null,
      })) ?? [],
  }
}

export function toCourseParticipantGroups(
  groups: CourseParticipantGroupSource[] | null
) {
  return groups?.map(toCourseParticipantGroup) ?? groups
}
