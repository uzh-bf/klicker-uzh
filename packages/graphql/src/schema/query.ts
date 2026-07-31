import { PrismaTransactionContextWithUser } from '@/lib/context.js'
import * as DB from '@klicker-uzh/prisma/client'
import { ActivityType as ActivityTypeEnum } from '@klicker-uzh/types'
import builder from '../builder.js'
import * as AccountService from '../services/accounts.js'
import * as ActivityService from '../services/activities.js'
import * as AnalyticsService from '../services/analytics.js'
import * as ChatbotsService from '../services/chatbots.js'
import * as CourseService from '../services/courses.js'
import * as ElementService from '../services/elements.js'
import * as FeedbackService from '../services/feedbacks.js'
import * as GroupService from '../services/groups.js'
import * as LiveQuizService from '../services/liveQuizzes.js'
import * as MicroLearningService from '../services/microLearning.js'
import * as ParticipantService from '../services/participants.js'
import * as PracticeQuizService from '../services/practiceQuizzes.js'
import * as ResourcesService from '../services/resources.js'
import * as SharingService from '../services/sharing.js'
import * as StacksService from '../services/stacks.js'
import * as TemplateService from '../services/templates.js'
import {
  ActivityDetails,
  CourseActivityList,
  UserActivityList,
} from './activities.js'
import {
  ActivityType,
  CourseActivityAnalytics,
  CoursePerformanceAnalytics,
  ElementFeedback,
  LearningAnalyticsExport,
  QuizAnalytics,
  WeeklyCourseActivities,
} from './analytics.js'
import {
  ActivityStudentPerformance,
  AssessmentResultsCourse,
  AssessmentResultsLiveQuiz,
  PointCorrection,
  StudentAssessmentBlockResponse,
  StudentAssessmentResults,
} from './assessment.js'
import {
  AssessmentParticipant,
  Course,
  CourseLeaderboard,
  CourseListEntry,
  CourseOverview,
  CourseStudentTimeline,
  CourseSummary,
  LeaderboardEntry,
  LiveQuizSelectionItem,
  StudentCourse,
} from './course.js'
import {
  Element,
  ElementInstance,
  ElementInstanceVersionInfo,
  ElementSummary,
  InstanceUpdateActivityInfo,
  SortByType,
  Tag,
  UserElementList,
} from './element.js'
import { ElementStatus, ElementType } from './elementData.js'
import { ActivityEvaluation } from './evaluation.js'
import {
  GroupActivity,
  GroupActivityDetails,
  GroupActivityInstance,
  GroupActivitySummary,
} from './groupActivity.js'
import {
  Feedback,
  LiveQuiz,
  LiveQuizEmbeddingInfo,
  LiveQuizInfo,
  LiveQuizSummary,
} from './liveQuiz.js'
import { MicroLearning } from './microLearning.js'
import {
  LearningAnalyticsParticipantChoice,
  Participant,
  ParticipantGroup,
  ParticipantLearningData,
  ParticipantWithAchievements,
  Participation,
  StudentCourseLeaderboard,
} from './participant.js'
import {
  ActivitySummary,
  ElementStack,
  PracticeQuiz,
  PublicationStatus,
  ReviewStatus,
  StackFeedback,
} from './practiceQuiz.js'
import {
  AnswerCollection,
  AnswerCollectionPreviewEntry,
  ChatModelCapability,
  Chatbot,
} from './resource.js'
import {
  ActivityLogEntry,
  CatalogCollection,
  CatalogObject,
  CatalogSelectionObject,
  DerivedPermissionInfo,
  DerivedPermissionOriginInformation,
  ObjectSharingRequest,
  ObjectType,
  PermissionsList,
  UserGroup,
} from './sharing.js'
import {
  ActivityTemplate,
  ActivityTemplateInfo,
  ActivityTemplateMetadata,
  TemplateElementInformation,
} from './template.js'
import { MediaFile, User, UserInfo, UserLogin, UserLoginScope } from './user.js'

// shortcut notations
const checkAccess = SharingService.checkAccess
const withPermission = SharingService.withPermission

export const Query = builder.queryType({
  fields(t) {
    const asParticipant = { authenticated: true, role: DB.UserRole.PARTICIPANT }
    const asUser = { authenticated: true, role: DB.UserRole.USER }
    const asAdmin = { authenticated: true, role: DB.UserRole.ADMIN }

    return {
      self: t.field({
        nullable: true,
        type: Participant,
        args: { liveQuizId: t.arg.string({ required: false }) },
        resolve: async (_, args, ctx) => ParticipantService.getSelf(args, ctx),
      }),

      selfWithAchievements: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantWithAchievements,
        resolve: async (_, __, ctx) => {
          if (!ctx.user?.sub) return null
          return await ParticipantService.getParticipantWithAchievements(ctx)
        },
      }),

      publicParticipantProfile: t.withAuth(asParticipant).field({
        nullable: true,
        type: Participant,
        args: {
          participantId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ParticipantService.getPublicParticipantProfile(args, ctx)
        },
      }),

      controlCourse: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ courseId: args.id }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await CourseService.getControlCourse(args, ctx)
          }
        ),
      }),

      basicCourseInformation: t.field({
        nullable: true,
        type: StudentCourse,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (__, args, ctx) => {
          return await CourseService.getBasicCourseInformation(args, ctx)
        },
      }),

      userTags: t.withAuth(asUser).field({
        nullable: true,
        type: [Tag],
        resolve: async (_, __, ctx) => {
          const user = await ctx.prisma.user.findUnique({
            where: { id: ctx.user.sub },
            include: { tags: { orderBy: { order: 'asc' } } },
          })

          if (!user) return []

          return user.tags
        },
      }),

      userMediaFiles: t.withAuth(asUser).field({
        nullable: true,
        type: [MediaFile],
        resolve: async (_, __, ctx) => {
          const user = await ctx.prisma.user.findUnique({
            where: { id: ctx.user.sub },
            include: { mediaFiles: { orderBy: { createdAt: 'desc' } } },
          })

          if (!user) return []

          return user.mediaFiles
        },
      }),

      feedbacks: t.field({
        nullable: true,
        type: [Feedback],
        args: {
          quizId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await FeedbackService.getFeedbacks(args, ctx)
        },
      }),

      userProfile: t.withAuth(asUser).field({
        nullable: true,
        type: User,
        resolve: async (_, __, ctx) => {
          const user = await ctx.prisma.user.findUnique({
            where: { id: ctx.user.sub },
          })

          if (!user) return null

          return user
        },
      }),

      userScope: t.withAuth(asUser).field({
        nullable: true,
        type: UserLoginScope,
        resolve: (_, __, ctx) => {
          return ctx.user.scope
        },
      }),

      getUsersPrivatePreview: t.withAuth(asAdmin).field({
        nullable: true,
        type: [UserInfo],
        resolve: async (_, __, ctx) => {
          return await AccountService.getUsersPrivatePreview(ctx)
        },
      }),

      userElements: t.withAuth(asUser).field({
        nullable: true,
        type: UserElementList,
        args: {
          status: t.arg({ type: ElementStatus, required: false }),
          type: t.arg({ type: ElementType, required: false }),
          hasSampleSolution: t.arg.boolean({ required: true }),
          hasAnswerFeedbacks: t.arg.boolean({ required: true }),
          searchString: t.arg.string({ required: false }),
          showOwned: t.arg.boolean({ required: false }),
          showShared: t.arg.boolean({ required: false }),
          showDependencies: t.arg.boolean({ required: false }),
          tagIds: t.arg.intList({ required: true }),
          activityId: t.arg.string({ required: false }),
          multiplier: t.arg.int({ required: false }),
          showUntagged: t.arg.boolean({ required: true }),
          sortByType: t.arg({ type: SortByType, required: true }),
          sortByAsc: t.arg.boolean({ required: true }),
          showArchived: t.arg.boolean({ required: true }),
          numEntries: t.arg.int({ required: true }),
          offset: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ElementService.getUserElements(args, ctx)
        },
      }),

      getUserActivitiesCourses: t.withAuth(asUser).field({
        nullable: true,
        type: [CourseListEntry],
        resolve: async (_, __, ctx) => {
          return await ActivityService.getUserActivitiesCourses(ctx)
        },
      }),

      userActivities: t.withAuth(asUser).field({
        nullable: true,
        type: UserActivityList,
        args: {
          statusFilter: t.arg({ type: [PublicationStatus], required: false }),
          activityTypeFilter: t.arg({ type: ActivityType, required: false }),
          courseId: t.arg.string({ required: false }),
          withoutCourse: t.arg.boolean({ required: false }),
          searchString: t.arg.string({ required: false }),
          showOwned: t.arg.boolean({ required: false }),
          showShared: t.arg.boolean({ required: false }),
          showDependencies: t.arg.boolean({ required: false }),
          multiplier: t.arg.int({ required: false }),
          reviewStatus: t.arg({ type: ReviewStatus, required: false }),
          isGamificationEnabled: t.arg.boolean({ required: false }),
          isAssessmentEnabled: t.arg.boolean({ required: false }),
          isPinProtected: t.arg.boolean({ required: false }),
          sortByType: t.arg({ type: SortByType, required: true }),
          sortByAsc: t.arg.boolean({ required: true }),
          numEntries: t.arg.int({ required: false }),
          offset: t.arg.int({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await ActivityService.getUserActivities(args, ctx)
        },
      }),

      userCourses: t.withAuth(asUser).field({
        nullable: true,
        type: [Course],
        resolve: async (_, __, ctx) => {
          return await CourseService.getUserCourses(ctx)
        },
      }),

      activityDetails: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityDetails,
        args: {
          activityId: t.arg.string({ required: true }),
          activityType: t.arg({ type: ActivityType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          // if not logged in as a user, return null
          if (!ctx.user?.sub) return null

          // live quiz activity
          if (args.activityType === ActivityTypeEnum.LIVE_QUIZ) {
            // permission check - minimum read level required
            const validAccess = await checkAccess(
              [
                {
                  liveQuizId: args.activityId,
                  minimumPermissionLevel: DB.PermissionLevel.READ,
                },
              ],
              ctx
            )
            if (!validAccess) return null

            // get live quiz details
            const liveQuiz = await ActivityService.getLiveQuizDetails(
              { id: args.activityId },
              ctx
            )
            return liveQuiz
          }

          // practice quiz activity
          else if (args.activityType === ActivityTypeEnum.PRACTICE_QUIZ) {
            // permission check - minimum read level required
            const validAccess = await checkAccess(
              [
                {
                  practiceQuizId: args.activityId,
                  minimumPermissionLevel: DB.PermissionLevel.READ,
                },
              ],
              ctx
            )
            if (!validAccess) return null

            // get practice quiz details
            const practiceQuiz = await ActivityService.getPracticeQuizDetails(
              { id: args.activityId },
              ctx
            )
            return practiceQuiz
          }

          // micro learning activity
          else if (args.activityType === ActivityTypeEnum.MICRO_LEARNING) {
            // permission check - minimum read level required
            const validAccess = await checkAccess(
              [
                {
                  microLearningId: args.activityId,
                  minimumPermissionLevel: DB.PermissionLevel.READ,
                },
              ],
              ctx
            )
            if (!validAccess) return null

            // get micro learning details
            const microLearning = await ActivityService.getMicroLearningDetails(
              { id: args.activityId },
              ctx
            )
            return microLearning
          }

          // group activity
          else if (args.activityType === ActivityTypeEnum.GROUP_ACTIVITY) {
            // permission check - minimum read level required
            const validAccess = await checkAccess(
              [
                {
                  groupActivityId: args.activityId,
                  minimumPermissionLevel: DB.PermissionLevel.READ,
                },
              ],
              ctx
            )
            if (!validAccess) return null

            // get group activity details
            const groupActivity = await ActivityService.getGroupActivityDetails(
              { id: args.activityId },
              ctx
            )
            return groupActivity
          }

          return null
        },
      }),

      getActiveUserCourses: t.withAuth(asUser).field({
        nullable: true,
        type: [Course],
        args: {
          activityId: t.arg.string({ required: false }),
          activityType: t.arg({ type: ActivityType, required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.getActiveUserCourses(args, ctx)
        },
      }),

      getCourseActivityIds: t.withAuth(asUser).field({
        nullable: true,
        type: CourseActivityList,
        args: { courseId: t.arg.string({ required: false }) },
        resolve: async (_, args, ctx) => {
          return await ActivityService.getCourseActivityIds(args, ctx)
        },
      }),

      getCourseSummary: t.withAuth(asUser).field({
        nullable: true,
        type: CourseSummary,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await CourseService.getCourseSummary(args, ctx)
          }
        ),
      }),

      participantCourses: t.withAuth(asParticipant).field({
        nullable: true,
        type: [Course],
        resolve: async (_, __, ctx) => {
          return await CourseService.getParticipantCourses(ctx)
        },
      }),

      unassignedLiveQuizzes: t.withAuth(asUser).field({
        nullable: true,
        type: [LiveQuiz],
        resolve: async (_, __, ctx) => {
          return await LiveQuizService.getUnassignedLiveQuizzes(ctx)
        },
      }),

      shortnameQuizzes: t.field({
        nullable: true,
        type: [LiveQuiz],
        args: { shortname: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await LiveQuizService.getShortnameQuizzes(args, ctx)
        },
      }),

      getLiveQuizSummary: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuizSummary,
        args: { quizId: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.quizId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await LiveQuizService.getLiveQuizSummary(args, ctx)
          }
        ),
      }),

      getCourseRunningLiveQuizzes: t.field({
        nullable: true,
        type: [LiveQuiz],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await LiveQuizService.getCourseRunningLiveQuizzes(args, ctx)
        },
      }),

      getCoursePublishedPracticeQuizzes: t.field({
        nullable: true,
        type: [PracticeQuiz],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await PracticeQuizService.getCoursePublishedPracticeQuizzes(
            args,
            ctx
          )
        },
      }),

      getCoursePublishedMicroLearnings: t.field({
        nullable: true,
        type: [MicroLearning],
        args: { courseId: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await MicroLearningService.getCoursePublishedMicroLearnings(
            args,
            ctx
          )
        },
      }),

      userRunningLiveQuizzes: t.withAuth(asUser).field({
        nullable: true,
        type: [LiveQuizInfo],
        resolve: async (_, __, ctx) => {
          return await LiveQuizService.getUserRunningLiveQuizzes(ctx)
        },
      }),

      controlCourses: t.withAuth(asUser).field({
        nullable: true,
        type: [Course],
        resolve: async (_, __, ctx) => {
          return await CourseService.getControlCourses(ctx)
        },
      }),

      cockpitQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await LiveQuizService.getCockpitQuiz(args, ctx)
          }
        ),
      }),

      controlLiveQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await LiveQuizService.getControlLiveQuiz(args, ctx)
          }
        ),
      }),

      practiceQuiz: t.field({
        nullable: true,
        type: PracticeQuiz,
        args: { id: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await PracticeQuizService.getPracticeQuizData(args, ctx)
        },
      }),

      getPreviousStackEvaluation: t.field({
        nullable: true,
        type: StackFeedback,
        args: { stackId: t.arg.int({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await StacksService.getPreviousStackEvaluation(args, ctx)
        },
      }),

      getPracticeQuizEvaluation: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityEvaluation,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ practiceQuizId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await PracticeQuizService.getPracticeQuizEvaluation(
              args,
              ctx
            )
          }
        ),
      }),

      microLearning: t.field({
        nullable: true,
        type: MicroLearning,
        args: { id: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await MicroLearningService.getMicroLearningData(args, ctx)
        },
      }),

      getMicroLearningEvaluation: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityEvaluation,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ microLearningId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await MicroLearningService.getMicroLearningEvaluation(
              args,
              ctx
            )
          }
        ),
      }),

      getSinglePracticeQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: PracticeQuiz,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ practiceQuizId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await PracticeQuizService.getSinglePracticeQuiz(args, ctx)
          }
        ),
      }),

      getSingleMicroLearning: t.withAuth(asUser).field({
        nullable: true,
        type: MicroLearning,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ microLearningId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await MicroLearningService.getSingleMicroLearning(args, ctx)
          }
        ),
      }),

      liveQuizEvaluation: t.field({
        nullable: true,
        type: ActivityEvaluation,
        args: {
          id: t.arg.string({ required: true }),
          hmac: t.arg.string(),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on live quiz required if hmac is not provided
          if (!args.hmac) {
            const validAccess = ctx.user?.sub
              ? await checkAccess(
                  [
                    {
                      liveQuizId: args.id,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ],
                  ctx as PrismaTransactionContextWithUser
                )
              : false

            if (!validAccess) {
              return null
            }
          }

          return await LiveQuizService.getLiveQuizEvaluation(args, ctx)
        },
      }),

      studentLiveQuiz: t.field({
        nullable: true,
        type: LiveQuiz,
        args: { id: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await LiveQuizService.getRunningLiveQuiz(args, ctx)
        },
      }),

      validateAvailableLiveQuiz: t.boolean({
        nullable: true,
        args: {
          quizId: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await LiveQuizService.validateAvailableLiveQuiz(args, ctx)
        },
      }),

      participantGroups: t.field({
        nullable: true,
        type: [ParticipantGroup],
        args: { courseId: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await GroupService.getParticipantGroups(args, ctx)
        },
      }),

      getCourseGroups: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: { courseId: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await GroupService.getCourseGroups(args, ctx)
          }
        ),
      }),

      getLiveQuizEmbeddingInfo: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuizEmbeddingInfo,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await LiveQuizService.getLiveQuizEmbeddingInfo(args, ctx)
          }
        ),
      }),

      getLecturerViewLiveQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await LiveQuizService.getLecturerViewLiveQuiz(args, ctx)
          }
        ),
      }),

      course: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ courseId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await CourseService.getCourseData(args, ctx)
          }
        ),
      }),

      getCourseLeaderboard: t.withAuth(asUser).field({
        nullable: true,
        type: CourseLeaderboard,
        args: {
          courseId: t.arg.string({ required: true }),
          courseSelection: t.arg.boolean({ required: true }),
          weeklySelection: t.arg.boolean({ required: true }),
          rollingSelection: t.arg.boolean({ required: true }),
          customSelection: t.arg.boolean({ required: true }),
          startDate: t.arg.string({ required: false }),
          endDate: t.arg.string({ required: false }),
          days: t.arg.int({ required: false }),
        },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await CourseService.getCourseLeaderboard(args, ctx)
          }
        ),
      }),

      liveQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await LiveQuizService.getLiveQuizData(args, ctx)
          }
        ),
      }),

      element: t.withAuth(asUser).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ elementId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await ElementService.getSingleElement(args, ctx)
          }
        ),
      }),

      getInstanceUpdateActivities: t.withAuth(asUser).field({
        nullable: true,
        type: [InstanceUpdateActivityInfo],
        args: {
          elementId: t.arg.int({ required: true }),
          hasSampleSolution: t.arg.boolean({ required: false }),
          includeTemplateInstances: t.arg.boolean({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ elementId: args.elementId }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await ElementService.getInstanceUpdateActivities(args, ctx)
          }
        ),
      }),

      getElementSummary: t.withAuth(asUser).field({
        nullable: true,
        type: ElementSummary,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ elementId: args.id }),
          DB.PermissionLevel.ADMIN,
          async (_, args, ctx) => {
            return await ElementService.getElementSummary(args, ctx)
          }
        ),
      }),

      getOutdatedElementInstances: t.withAuth(asUser).field({
        nullable: true,
        type: [ElementInstanceVersionInfo],
        args: {
          instanceIds: t.arg.intList({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ElementService.getOutdatedElementInstances(args, ctx)
        },
      }),

      artificialInstance: t.withAuth(asUser).field({
        nullable: true,
        type: ElementInstance,
        args: {
          elementId: t.arg.int({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ elementId: args.elementId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await ElementService.getArtificialElementInstance(args, ctx)
          }
        ),
      }),

      getSingleElementInstance: t.withAuth(asUser).field({
        nullable: true,
        type: ElementInstance,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // access validation to the activity that contains this instance is performed inside the serive function
          return await ElementService.getSingleElementInstance(args, ctx)
        },
      }),

      liveQuizLeaderboard: t.field({
        nullable: true,
        type: [LeaderboardEntry],
        args: {
          quizId: t.arg.string({ required: true }),
          hmac: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await LiveQuizService.getLiveQuizLeaderboard(args, ctx)
        },
      }),

      studentAssessmentResults: t.withAuth(asParticipant).field({
        nullable: true,
        type: StudentAssessmentResults,
        args: { courseId: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await CourseService.getStudentAssessmentResults(
            { courseId: args.courseId, participantId: ctx.user.sub },
            ctx
          )
        },
      }),

      studentCourseResults: t.withAuth(asUser).field({
        nullable: true,
        type: [ActivityStudentPerformance],
        args: {
          courseId: t.arg.string({ required: true }),
          participantId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          const studentResults =
            await CourseService.getStudentAssessmentResults(args, ctx)
          return studentResults?.liveQuizzes ?? []
        },
      }),

      assessmentResultsLiveQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: AssessmentResultsLiveQuiz,
        args: { liveQuizId: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await CourseService.getAssessmentResultsLiveQuiz(args, ctx)
        },
      }),

      assessmentResultsCourse: t.withAuth(asUser).field({
        nullable: true,
        type: AssessmentResultsCourse,
        args: { courseId: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.ADMIN,
          async (_, args, ctx) => {
            return await CourseService.getAssessmentResultsCourse(args, ctx)
          }
        ),
      }),

      liveQuizStudentAssessmentResponses: t.withAuth(asUser).field({
        nullable: true,
        type: [StudentAssessmentBlockResponse],
        args: {
          liveQuizId: t.arg.string({ required: true }),
          participantId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.getLiveQuizStudentAssessmentResponses(
            args,
            ctx
          )
        },
      }),

      participations: t.withAuth(asParticipant).field({
        nullable: true,
        type: [Participation], // TODO: if possible, link student course instead of normal course here
        args: {
          endpoint: t.arg.string({ required: false }),
          assessmentOnly: t.arg.boolean({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await ParticipantService.getParticipations(args, ctx)
        },
      }),

      getPracticeCourses: t.withAuth(asParticipant).field({
        nullable: true,
        type: [Course],
        resolve: async (_, __, ctx) => {
          return await ParticipantService.getPracticeCourses(ctx)
        },
      }),

      getParticipation: t.field({
        nullable: true,
        type: Participation,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ParticipantService.getParticipation(args, ctx)
        },
      }),

      getOwnLearningAnalyticsChoice: t.withAuth(asParticipant).field({
        nullable: true,
        type: LearningAnalyticsParticipantChoice,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ParticipantService.getOwnLearningAnalyticsChoice(
            args,
            ctx
          )
        },
      }),

      getCourseOverviewData: t.field({
        nullable: true,
        type: ParticipantLearningData,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.getCourseOverviewData(args, ctx)
        },
      }),

      getStudentCourseLeaderboard: t.field({
        nullable: true,
        type: StudentCourseLeaderboard,
        args: {
          courseId: t.arg.string({ required: true }),
          mode: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.getStudentCourseLeaderboard(args, ctx)
        },
      }),

      groupActivities: t.field({
        nullable: true,
        type: [GroupActivity],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await GroupService.getCourseGroupActivities(args, ctx)
        },
      }),

      groupActivityInstances: t.withAuth(asParticipant).field({
        nullable: true,
        type: [GroupActivityInstance],
        args: {
          groupId: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await GroupService.getGroupActivityInstances(args, ctx)
        },
      }),

      groupActivityDetails: t.withAuth(asParticipant).field({
        nullable: true,
        type: GroupActivityDetails,
        args: {
          activityId: t.arg.string({ required: true }),
          groupId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await GroupService.getGroupActivityDetails(args, ctx)
        },
      }),

      getBookmarkedElementStacks: t.withAuth(asParticipant).field({
        nullable: true,
        type: [ElementStack],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ParticipantService.getBookmarkedElementStacks(args, ctx)
        },
      }),

      getStackElementFeedbacks: t.withAuth(asParticipant).field({
        nullable: true,
        type: [ElementFeedback],
        args: {
          elementInstanceIds: t.arg.intList({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ParticipantService.getStackElementFeedbacks(args, ctx)
        },
      }),

      getPracticeQuizList: t.withAuth(asParticipant).field({
        nullable: true,
        type: [CourseOverview],
        resolve: async (_, __, ctx) => {
          return await ParticipantService.getPracticeQuizList(ctx)
        },
      }),

      getCourseStudentTimelines: t.withAuth(asParticipant).field({
        nullable: true,
        type: [CourseStudentTimeline],
        resolve: async (_, __, ctx) => {
          return await ParticipantService.getCourseStudentTimelines(ctx)
        },
      }),

      getPracticeQuizSummary: t.withAuth(asUser).field({
        nullable: true,
        type: ActivitySummary,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ practiceQuizId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await PracticeQuizService.getPracticeQuizSummary(args, ctx)
          }
        ),
      }),

      getMicroLearningSummary: t.withAuth(asUser).field({
        nullable: true,
        type: ActivitySummary,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ microLearningId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await MicroLearningService.getMicroLearningSummary(args, ctx)
          }
        ),
      }),

      getGroupActivitySummary: t.withAuth(asUser).field({
        nullable: true,
        type: GroupActivitySummary,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ groupActivityId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await GroupService.getGroupActivitySummary(args, ctx)
          }
        ),
      }),

      userLogins: t.withAuth(asUser).field({
        nullable: true,
        type: [UserLogin],
        resolve: async (_, __, ctx) => {
          return await AccountService.getUserLogins(ctx)
        },
      }),

      groupActivity: t.withAuth(asUser).field({
        nullable: true,
        type: GroupActivity,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ groupActivityId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await GroupService.getGroupActivity(args, ctx)
          }
        ),
      }),

      getGradingGroupActivity: t.withAuth(asUser).field({
        nullable: true,
        type: GroupActivity,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ groupActivityId: args.id }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await GroupService.getGradingGroupActivity(args, ctx)
          }
        ),
      }),

      checkParticipantNameAvailable: t.field({
        nullable: false,
        type: 'Boolean',
        args: {
          username: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await AccountService.checkParticipantNameAvailable(args, ctx)
        },
      }),

      checkShortnameAvailable: t.field({
        nullable: false,
        type: 'Boolean',
        args: {
          shortname: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await AccountService.checkShortnameAvailable(args, ctx)
        },
      }),

      checkValidCoursePin: t.field({
        nullable: true,
        type: 'String',
        args: {
          pin: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.checkValidCoursePin(args, ctx)
        },
      }),

      coursePracticeQuiz: t.withAuth(asParticipant).field({
        nullable: true,
        type: PracticeQuiz,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.getCoursePracticeQuiz(args, ctx)
        },
      }),

      getBookmarksPracticeQuiz: t.withAuth(asParticipant).field({
        nullable: true,
        type: ['Int'],
        args: {
          quizId: t.arg.string({ required: false }),
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await PracticeQuizService.getBookmarksPracticeQuiz(args, ctx)
        },
      }),

      getCourseActivityAnalytics: t.withAuth(asUser).field({
        nullable: true,
        type: CourseActivityAnalytics,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await AnalyticsService.getCourseActivityAnalytics(args, ctx)
          }
        ),
      }),

      getCourseWeeklyActivity: t.withAuth(asUser).field({
        nullable: true,
        type: WeeklyCourseActivities,
        args: {
          courseId: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          // if the courseId is not provided, return early
          if (args.courseId === null || typeof args.courseId === 'undefined') {
            return null
          }

          // >= READ permissions on course required
          const validAccess = await checkAccess(
            [
              {
                courseId: args.courseId!,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await AnalyticsService.getCourseWeeklyActivity(
            { courseId: args.courseId! },
            ctx
          )
        },
      }),

      getCoursePerformanceAnalytics: t.withAuth(asUser).field({
        nullable: true,
        type: CoursePerformanceAnalytics,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await AnalyticsService.getCoursePerformanceAnalytics(
              args,
              ctx
            )
          }
        ),
      }),

      getLearningAnalyticsExport: t.withAuth(asUser).field({
        nullable: true,
        type: LearningAnalyticsExport,
        args: {
          courseId: t.arg.string({ required: true }),
          includePartial: t.arg.boolean({ defaultValue: false }),
        },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await AnalyticsService.getLearningAnalyticsExport(args, ctx)
          }
        ),
      }),

      getCourseActivities: t.withAuth(asUser).field({
        nullable: true,
        type: Course, // TODO: define custom return type here
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await CourseService.getCourseActivities(args, ctx)
          }
        ),
      }),

      endedLiveQuizzesCourse: t.withAuth(asUser).field({
        nullable: true,
        type: [LiveQuizSelectionItem],
        args: { courseId: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await CourseService.getEndedLiveQuizzesCourse(args, ctx)
          }
        ),
      }),

      previousPointCorrections: t.withAuth(asUser).field({
        nullable: true,
        type: [PointCorrection],
        args: {
          courseId: t.arg.string({ required: false }),
          liveQuizId: t.arg.string({ required: false }),
          instanceId: t.arg.int({ required: false }),
        },
        resolve: (_, args, ctx) => {
          return CourseService.getPreviousPointCorrections(args, ctx)
        },
      }),

      assessmentCourseParticipants: t.withAuth(asUser).field({
        nullable: true,
        type: [AssessmentParticipant],
        args: { courseId: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.ADMIN,
          async (_, args, ctx) => {
            return await CourseService.getAssessmentCourseParticipants(
              args,
              ctx
            )
          }
        ),
      }),

      getActivityAnalytics: t.withAuth(asUser).field({
        nullable: true,
        type: QuizAnalytics,
        args: {
          activityId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on the corresponding practice quiz / microlearning
          const validAccessPQ = await checkAccess(
            [
              {
                practiceQuizId: args.activityId,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          const validAccessML = await checkAccess(
            [
              {
                microLearningId: args.activityId,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccessPQ && !validAccessML) {
            return null
          }

          return await AnalyticsService.getActivityAnalytics(args, ctx)
        },
      }),

      getAnswerCollectionsElements: t.withAuth(asUser).field({
        nullable: true,
        type: [AnswerCollection],
        args: {
          templateId: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await ResourcesService.getAnswerCollectionsElements(args, ctx)
        },
      }),

      getAnswerCollectionsInfo: t.withAuth(asUser).field({
        nullable: true,
        type: [AnswerCollection],
        resolve: async (_, __, ctx) => {
          return await ResourcesService.getAnswerCollectionsInfo(ctx)
        },
      }),

      getChatbotsInfo: t.withAuth(asUser).field({
        nullable: true,
        type: [Chatbot],
        resolve: async (_, __, ctx) => {
          return await ChatbotsService.getChatbotsInfo(ctx)
        },
      }),

      getChatModelRegistry: t.withAuth(asUser).field({
        nullable: false,
        type: [ChatModelCapability],
        resolve: async () => {
          return ChatbotsService.getChatModelRegistry()
        },
      }),

      getSingleAnswerCollection: t.withAuth(asUser).field({
        nullable: true,
        type: AnswerCollection,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ answerCollectionId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await ResourcesService.getSingleAnswerCollection(args, ctx)
          }
        ),
      }),

      checkTemplateInfoAvailable: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityTemplateInfo,
        args: {
          activityId: t.arg.string({ required: true }),
          activityType: t.arg({ type: ActivityType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= ADMIN permissions on activity (part of template conversion process)
          const validAccess = await checkAccess(
            [
              ...(args.activityType === ActivityTypeEnum.LIVE_QUIZ
                ? [
                    {
                      liveQuizId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.PRACTICE_QUIZ
                ? [
                    {
                      practiceQuizId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.MICRO_LEARNING
                ? [
                    {
                      microLearningId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.GROUP_ACTIVITY
                ? [
                    {
                      groupActivityId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await TemplateService.checkTemplateInfoAvailable(args, ctx)
        },
      }),

      getTemplateInformation: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityTemplateMetadata,
        args: {
          activityId: t.arg.string({ required: true }),
          activityType: t.arg({ type: ActivityType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= WRITE permissions on activity template
          const validAccess = await checkAccess(
            [
              ...(args.activityType === ActivityTypeEnum.LIVE_QUIZ
                ? [
                    {
                      liveQuizId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.WRITE,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.PRACTICE_QUIZ
                ? [
                    {
                      practiceQuizId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.WRITE,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.MICRO_LEARNING
                ? [
                    {
                      microLearningId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.WRITE,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.GROUP_ACTIVITY
                ? [
                    {
                      groupActivityId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.WRITE,
                    },
                  ]
                : []),
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await TemplateService.getTemplateInformation(args, ctx)
        },
      }),

      getActivityTemplate: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityTemplate,
        args: {
          templateId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // access validation to linked activity is performed inside the service function
          return await TemplateService.getActivityTemplate(args, ctx)
        },
      }),

      getMatchingUserElementsTemplate: t.withAuth(asUser).field({
        nullable: true,
        type: [TemplateElementInformation],
        args: {
          elementType: t.arg({ type: ElementType, required: true }),
          hasSampleSolution: t.arg.boolean({ required: false }),
          hasAnswerFeedbacks: t.arg.boolean({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          // all elements of a user with >= READ permissions and matching settings should be shown here
          // the corresponding permission validation logic is implemented inside the service function
          return await TemplateService.getMatchingUserElementsTemplate(
            args,
            ctx
          )
        },
      }),

      checkTemplateElementExists: t.withAuth(asUser).boolean({
        nullable: false,
        args: {
          name: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await TemplateService.checkTemplateElementExists(args, ctx)
        },
      }),

      getTemplatePreviewAnswerCollectionEntries: t.withAuth(asUser).field({
        nullable: true,
        type: [AnswerCollectionPreviewEntry],
        args: {
          templateId: t.arg.string({ required: true }),
          answerCollectionId: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await TemplateService.getTemplatePreviewAnswerCollectionEntries(
            args,
            ctx
          )
        },
      }),

      getUserGroupsUser: t.withAuth(asUser).field({
        nullable: true,
        type: [UserGroup],
        resolve: async (_, __, ctx) => {
          return await SharingService.getUserGroupsUser(ctx)
        },
      }),

      getObjectPermissions: t.withAuth(asUser).field({
        nullable: true,
        type: PermissionsList,
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          if (args.objectType === DB.ObjectType.CATALOG_COLLECTION) {
            // >= ADMIN permissions on catalog collection
            const validAccess = await checkAccess(
              [
                {
                  catalogCollectionId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.getCatalogCollectionPermissions(
              { id: args.objectId },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.ANSWER_COLLECTION) {
            // >= ADMIN permissions on answer collection
            const validAccess = await checkAccess(
              [
                {
                  answerCollectionId: parseInt(args.objectId),
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.getAnswerCollectionPermissions(
              { id: parseInt(args.objectId) },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.ELEMENT) {
            // >= ADMIN permissions on element
            const validAccess = await checkAccess(
              [
                {
                  elementId: parseInt(args.objectId),
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.getElementPermissions(
              { id: parseInt(args.objectId) },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.COURSE) {
            // >= ADMIN permissions on course
            const validAccess = await checkAccess(
              [
                {
                  courseId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.getCoursePermissions(
              { id: args.objectId },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.LIVE_QUIZ) {
            // >= ADMIN permissions on live quiz
            const validAccess = await checkAccess(
              [
                {
                  liveQuizId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.getLiveQuizPermissions(
              { id: args.objectId },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.PRACTICE_QUIZ) {
            // >= ADMIN permissions on practice quiz
            const validAccess = await checkAccess(
              [
                {
                  practiceQuizId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.getPracticeQuizPermissions(
              { id: args.objectId },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.MICRO_LEARNING) {
            // >= ADMIN permissions on microlearning
            const validAccess = await checkAccess(
              [
                {
                  microLearningId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.getMicroLearningPermissions(
              { id: args.objectId },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.GROUP_ACTIVITY) {
            // >= ADMIN permissions on group activity
            const validAccess = await checkAccess(
              [
                {
                  groupActivityId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.getGroupActivityPermissions(
              { id: args.objectId },
              ctx
            )
          }

          return null
        },
      }),

      getDerivedObjectPermissions: t.withAuth(asUser).field({
        nullable: true,
        type: [DerivedPermissionInfo],
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          // on certain top-level objects, no derived permissions can be created -> return an empty array
          if (args.objectType === DB.ObjectType.CATALOG_COLLECTION) {
            return []
          } else if (args.objectType === DB.ObjectType.ANSWER_COLLECTION) {
            // >= ADMIN permissions on answer collection
            const validAccess = await checkAccess(
              [
                {
                  answerCollectionId: parseInt(args.objectId),
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return (
              (await SharingService.getDerivedAnswerCollectionPermissions(
                { id: parseInt(args.objectId) },
                ctx
              )) ?? []
            )
          } else if (args.objectType === DB.ObjectType.ELEMENT) {
            // >= ADMIN permissions on answer collection
            const validAccess = await checkAccess(
              [
                {
                  elementId: parseInt(args.objectId),
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return (
              (await SharingService.getDerivedElementPermissions(
                { id: parseInt(args.objectId) },
                ctx
              )) ?? []
            )
          } else if (args.objectType === DB.ObjectType.COURSE) {
            // >= ADMIN permissions on answer collection
            const validAccess = await checkAccess(
              [
                {
                  courseId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return (
              (await SharingService.getDerivedCoursePermissions(
                { id: args.objectId },
                ctx
              )) ?? []
            )
          } else if (args.objectType === DB.ObjectType.LIVE_QUIZ) {
            // >= ADMIN permissions on live quiz
            const validAccess = await checkAccess(
              [
                {
                  liveQuizId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return (
              (await SharingService.getDerivedLiveQuizPermissions(
                { id: args.objectId },
                ctx
              )) ?? []
            )
          } else if (args.objectType === DB.ObjectType.PRACTICE_QUIZ) {
            // >= ADMIN permissions on practice quiz
            const validAccess = await checkAccess(
              [
                {
                  practiceQuizId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return (
              (await SharingService.getDerivedPracticeQuizPermissions(
                { id: args.objectId },
                ctx
              )) ?? []
            )
          } else if (args.objectType === DB.ObjectType.MICRO_LEARNING) {
            // >= ADMIN permissions on microlearning
            const validAccess = await checkAccess(
              [
                {
                  microLearningId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return (
              (await SharingService.getDerivedMicroLearningPermissions(
                { id: args.objectId },
                ctx
              )) ?? []
            )
          } else if (args.objectType === DB.ObjectType.GROUP_ACTIVITY) {
            // >= ADMIN permissions on group activity
            const validAccess = await checkAccess(
              [
                {
                  groupActivityId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return (
              (await SharingService.getDerivedGroupActivityPermissions(
                { id: args.objectId },
                ctx
              )) ?? []
            )
          }

          return null
        },
      }),

      getDerivedPermissionOrigin: t.withAuth(asUser).field({
        nullable: true,
        type: DerivedPermissionOriginInformation,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.getDerivedPermissionOrigin(args, ctx)
        },
      }),

      getObjectActivity: t.withAuth(asUser).field({
        nullable: true,
        type: [ActivityLogEntry],
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on the corresponding object
          const validAccess = await checkAccess(
            [
              ...(args.objectType === DB.ObjectType.ELEMENT
                ? [
                    {
                      elementId: parseInt(args.objectId),
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.ANSWER_COLLECTION
                ? [
                    {
                      answerCollectionId: parseInt(args.objectId),
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.COURSE
                ? [
                    {
                      courseId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.LIVE_QUIZ
                ? [
                    {
                      liveQuizId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.PRACTICE_QUIZ
                ? [
                    {
                      practiceQuizId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.MICRO_LEARNING
                ? [
                    {
                      microLearningId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.GROUP_ACTIVITY
                ? [
                    {
                      groupActivityId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
            ],
            ctx
          )

          if (!validAccess) {
            return null
          }

          return SharingService.getObjectActivity(args, ctx)
        },
      }),

      getCatalogCollectionsList: t.withAuth(asUser).field({
        nullable: true,
        type: [CatalogCollection],
        resolve: async (_, __, ctx) => {
          return await SharingService.getCatalogCollectionsList(ctx)
        },
      }),

      getCatalogCollectionInfo: t.withAuth(asUser).field({
        nullable: true,
        type: CatalogCollection,
        args: {
          catalogCollectionId: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.getCatalogCollectionInfo(args, ctx)
        },
      }),

      countCatalogSharingRequests: t.withAuth(asUser).int({
        nullable: false,
        resolve: async (_, __, ctx) => {
          return await SharingService.countCatalogSharingRequests(ctx)
        },
      }),

      getCatalogSharingRequests: t.withAuth(asUser).field({
        nullable: true,
        type: [ObjectSharingRequest],
        resolve: async (_, __, ctx) => {
          return await SharingService.getCatalogSharingRequests(ctx)
        },
      }),

      getCatalogObjects: t.withAuth(asUser).field({
        nullable: true,
        type: [CatalogObject],
        args: {
          catalogCollectionId: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          // access validation to the catalog collection is handled inside service function
          return await SharingService.getCatalogObjects(args, ctx)
        },
      }),

      getCatalogAnswerCollections: t.withAuth(asUser).field({
        nullable: true,
        type: [CatalogSelectionObject],
        resolve: async (_, __, ctx) => {
          return await SharingService.getCatalogAnswerCollections(ctx)
        },
      }),

      getCatalogLiveQuizTemplates: t.withAuth(asUser).field({
        nullable: true,
        type: [CatalogSelectionObject],
        resolve: async (_, __, ctx) => {
          return await SharingService.getCatalogLiveQuizTemplates(ctx)
        },
      }),

      getCatalogElements: t.withAuth(asUser).field({
        nullable: true,
        type: [CatalogSelectionObject],
        resolve: async (_, __, ctx) => {
          return await SharingService.getCatalogElements(ctx)
        },
      }),

      getAnswerCollectionCatalogInfo: t.withAuth(asUser).field({
        nullable: true,
        type: AnswerCollection,
        args: {
          collectionId: t.arg.int({ required: true }),
          catalogCollectionId: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.getAnswerCollectionCatalogInfo(args, ctx)
        },
      }),
    }
  },
})
