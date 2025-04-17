import * as DB from '@klicker-uzh/prisma'
import {
  ActivityType as ActivityTypeEnum,
  CatalogObjectType as CatalogObjectTypeEnum,
} from '@klicker-uzh/types'
import { PrismaTransactionContextWithUser } from 'src/lib/context.js'
import builder from '../builder.js'
import * as AccountService from '../services/accounts.js'
import * as AnalyticsService from '../services/analytics.js'
import * as CourseService from '../services/courses.js'
import * as FeedbackService from '../services/feedbacks.js'
import * as GroupService from '../services/groups.js'
import * as LiveQuizService from '../services/liveQuizzes.js'
import * as MicroLearningService from '../services/microLearning.js'
import * as ParticipantService from '../services/participants.js'
import * as PracticeQuizService from '../services/practiceQuizzes.js'
import * as QuestionService from '../services/questions.js'
import * as ResourcesService from '../services/resources.js'
import * as SharingService from '../services/sharing.js'
import * as StacksService from '../services/stacks.js'
import * as TemplateService from '../services/templates.js'
import {
  ActivityType,
  CourseActivityAnalytics,
  CoursePerformanceAnalytics,
  ElementFeedback,
  QuizAnalytics,
  WeeklyCourseActivities,
} from './analytics.js'
import {
  Course,
  CourseLeaderboard,
  CourseStudentTimeline,
  CourseSummary,
  LeaderboardEntry,
  StudentCourse,
} from './course.js'
import { ElementType } from './elementData.js'
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
  LiveQuizInfo,
  LiveQuizSummary,
} from './liveQuiz.js'
import { MicroLearning } from './microLearning.js'
import {
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
  StackFeedback,
} from './practiceQuiz.js'
import {
  Element,
  ElementInstance,
  InstanceUpdateActivityInfo,
  Tag,
} from './question.js'
import { AnswerCollection, AnswerCollectionPreviewEntry } from './resource.js'
import {
  CatalogCollection,
  CatalogObject,
  CatalogObjectType,
  CatalogSelectionObject,
  ObjectSharingRequest,
  PermissionInfo,
} from './sharing.js'
import {
  ActivityTemplate,
  ActivityTemplateInfo,
  ActivityTemplateMetadata,
  TemplateElementInformation,
} from './template.js'
import { MediaFile, User, UserLogin, UserLoginScope } from './user.js'

// shortcut notations
const checkAccess = SharingService.checkAccess

export const Query = builder.queryType({
  fields(t) {
    const asAuthenticated = { authenticated: true }
    const asParticipant = { authenticated: true, role: DB.UserRole.PARTICIPANT }
    const asUser = { authenticated: true, role: DB.UserRole.USER }

    return {
      self: t.field({
        nullable: true,
        type: Participant,
        resolve: async (_, __, ctx) => {
          if (!ctx.user?.sub) return null
          return await ctx.prisma.participant.findUnique({
            where: { id: ctx.user.sub },
          })
        },
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
        resolve: async (__, args, ctx) => {
          // >= EXECUTE permissions on course required
          const validAccess = await checkAccess(
            [
              {
                courseId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.EXECUTE,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await CourseService.getControlCourse(args, ctx)
        },
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

      getLoginToken: t.withAuth(asUser).field({
        nullable: true,
        type: User,
        resolve: async (_, ___, ctx) => {
          return await AccountService.getLoginToken(ctx)
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

      userQuestions: t.withAuth(asUser).field({
        nullable: true,
        type: [Element],
        resolve: async (_, __, ctx) => {
          return await QuestionService.getUserQuestions(ctx)
        },
      }),

      userCourses: t.withAuth(asUser).field({
        nullable: true,
        type: [Course],
        resolve: async (_, __, ctx) => {
          return await CourseService.getUserCourses(ctx)
        },
      }),

      getActiveUserCourses: t.withAuth(asUser).field({
        nullable: true,
        type: [Course],
        resolve: async (_, __, ctx) => {
          return await CourseService.getActiveUserCourses(ctx)
        },
      }),

      getCourseSummary: t.withAuth(asUser).field({
        nullable: true,
        type: CourseSummary,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on course required
          const validAccess = await checkAccess(
            [
              {
                courseId: args.courseId,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await CourseService.getCourseSummary(args, ctx)
        },
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
        args: {
          shortname: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await LiveQuizService.getShortnameQuizzes(args, ctx)
        },
      }),

      getLiveQuizSummary: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuizSummary,
        args: {
          quizId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on live quiz required
          const validAccess = await checkAccess(
            [
              {
                liveQuizId: args.quizId,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return LiveQuizService.getLiveQuizSummary(args, ctx)
        },
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
        args: {
          courseId: t.arg.string({ required: true }),
        },
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

      userLiveQuizzes: t.withAuth(asUser).field({
        nullable: true,
        type: [LiveQuiz],
        resolve: async (_, __, ctx) => {
          return await LiveQuizService.getUserLiveQuizzes(ctx)
        },
      }),

      cockpitQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= EXECUTE permissions on live quiz required
          const validAccess = await checkAccess(
            [
              {
                liveQuizId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.EXECUTE,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await LiveQuizService.getCockpitQuiz(args, ctx)
        },
      }),

      controlLiveQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on live quiz required
          const validAccess = await checkAccess(
            [
              {
                liveQuizId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await LiveQuizService.getControlLiveQuiz(args, ctx)
        },
      }),

      practiceQuiz: t.field({
        nullable: true,
        type: PracticeQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await PracticeQuizService.getPracticeQuizData(args, ctx)
        },
      }),

      getPreviousStackEvaluation: t.field({
        nullable: true,
        type: StackFeedback,
        args: {
          stackId: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await StacksService.getPreviousStackEvaluation(args, ctx)
        },
      }),

      getPracticeQuizEvaluation: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityEvaluation,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on practice quiz required
          const validAccess = await checkAccess(
            [
              {
                practiceQuizId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await PracticeQuizService.getPracticeQuizEvaluation(args, ctx)
        },
      }),

      microLearning: t.field({
        nullable: true,
        type: MicroLearning,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await MicroLearningService.getMicroLearningData(args, ctx)
        },
      }),

      getMicroLearningEvaluation: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityEvaluation,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on micro learning required
          const validAccess = await checkAccess(
            [
              {
                microLearningId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await MicroLearningService.getMicroLearningEvaluation(
            args,
            ctx
          )
        },
      }),

      getSinglePracticeQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: PracticeQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on practice quiz required (actualy only used for edit operations currently)
          const validAccess = await checkAccess(
            [
              {
                practiceQuizId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await PracticeQuizService.getSinglePracticeQuiz(args, ctx)
        },
      }),

      getSingleMicroLearning: t.withAuth(asUser).field({
        nullable: true,
        type: MicroLearning,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on micro learning required (actualy only used for edit operations currently)
          const validAccess = await checkAccess(
            [
              {
                microLearningId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await MicroLearningService.getSingleMicroLearning(args, ctx)
        },
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
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await LiveQuizService.getRunningLiveQuiz(args, ctx)
        },
      }),

      participantGroups: t.withAuth(asAuthenticated).field({
        nullable: true,
        type: [ParticipantGroup],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await GroupService.getParticipantGroups(args, ctx)
        },
      }),

      getCourseGroups: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on course required
          const validAccess = await checkAccess(
            [
              {
                courseId: args.courseId,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await GroupService.getCourseGroups(args, ctx)
        },
      }),

      liveQuizHMAC: t.withAuth(asUser).field({
        nullable: true,
        type: 'String',
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on live quiz required
          const validAccess = await checkAccess(
            [
              {
                liveQuizId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await LiveQuizService.getLiveQuizHMAC(args, ctx)
        },
      }),

      getLecturerViewLiveQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on live quiz required
          const validAccess = await checkAccess(
            [
              {
                liveQuizId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await LiveQuizService.getLecturerViewLiveQuiz(args, ctx)
        },
      }),

      course: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on course required
          const validAccess = await checkAccess(
            [
              {
                courseId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await CourseService.getCourseData(args, ctx)
        },
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
        resolve: async (_, args, ctx) => {
          // >= READ permissions on course required
          const validAccess = await checkAccess(
            [
              {
                courseId: args.courseId,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await CourseService.getCourseLeaderboard(args, ctx)
        },
      }),

      liveQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on live quiz required
          const validAccess = await checkAccess(
            [
              {
                liveQuizId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await LiveQuizService.getLiveQuizData(args, ctx)
        },
      }),

      question: t.withAuth(asUser).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on element required (only needed for element editing at this time)
          const validAccess = await checkAccess(
            [
              {
                elementId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await QuestionService.getSingleQuestion(args, ctx)
        },
      }),

      getInstanceUpdateActivities: t.withAuth(asUser).field({
        nullable: true,
        type: [InstanceUpdateActivityInfo],
        args: {
          elementId: t.arg.int({ required: true }),
          hasSampleSolution: t.arg.boolean({ required: false }),
          includeTemplateInstances: t.arg.boolean({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= WRITE permissions on element required
          const validAccess = await checkAccess(
            [
              {
                elementId: args.elementId,
                minimumPermissionLevel: DB.PermissionLevel.WRITE,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await QuestionService.getInstanceUpdateActivities(args, ctx)
        },
      }),

      artificialInstance: t.withAuth(asUser).field({
        nullable: true,
        type: ElementInstance,
        args: {
          elementId: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on element required
          const validAccess = ctx.user?.sub
            ? await checkAccess(
                [
                  {
                    elementId: args.elementId,
                    minimumPermissionLevel: DB.PermissionLevel.READ,
                  },
                ],
                ctx
              )
            : false
          if (!validAccess) {
            return null
          }

          return await QuestionService.getArtificialElementInstance(args, ctx)
        },
      }),

      getSingleElementInstance: t.withAuth(asUser).field({
        nullable: true,
        type: ElementInstance,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // access validation to the activity that contains this instance is performed inside the serive function
          return await QuestionService.getSingleElementInstance(args, ctx)
        },
      }),

      liveQuizLeaderboard: t.field({
        nullable: true,
        type: [LeaderboardEntry],
        args: {
          quizId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await LiveQuizService.getLiveQuizLeaderboard(args, ctx)
        },
      }),

      participations: t.withAuth(asParticipant).field({
        nullable: true,
        type: [Participation],
        args: {
          endpoint: t.arg.string({ required: false }),
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

      getCourseOverviewData: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantLearningData,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.getCourseOverviewData(args, ctx)
        },
      }),

      getStudentCourseLeaderboard: t.withAuth(asParticipant).field({
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

      groupActivities: t.withAuth(asParticipant).field({
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
        type: [Course],
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
        resolve: async (_, args, ctx) => {
          // >= READ permissions on practice quiz required
          const validAccess = await checkAccess(
            [
              {
                practiceQuizId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await PracticeQuizService.getPracticeQuizSummary(args, ctx)
        },
      }),

      getMicroLearningSummary: t.withAuth(asUser).field({
        nullable: true,
        type: ActivitySummary,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on microlearning required
          const validAccess = await checkAccess(
            [
              {
                microLearningId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await MicroLearningService.getMicroLearningSummary(args, ctx)
        },
      }),

      getGroupActivitySummary: t.withAuth(asUser).field({
        nullable: true,
        type: GroupActivitySummary,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on group activity required
          const validAccess = await checkAccess(
            [
              {
                groupActivityId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await GroupService.getGroupActivitySummary(args, ctx)
        },
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
        resolve: async (_, args, ctx) => {
          // >= READ permissions on group activity required (only required for editing at the moment however)
          const validAccess = await checkAccess(
            [
              {
                groupActivityId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await GroupService.getGroupActivity(args, ctx)
        },
      }),

      getGradingGroupActivity: t.withAuth(asUser).field({
        nullable: true,
        type: GroupActivity,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= EXECUTE permissions on group activity required (for grading process)
          const validAccess = await checkAccess(
            [
              {
                groupActivityId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.EXECUTE,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await GroupService.getGradingGroupActivity(args, ctx)
        },
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

      checkPublicPreviewAvailable: t.boolean({
        nullable: false,
        resolve: async (_, __, ctx) => {
          return await AccountService.checkPublicPreviewAvailable(ctx)
        },
      }),

      checkPrivatePreviewAvailable: t.boolean({
        nullable: false,
        resolve: async (_, __, ctx) => {
          return await AccountService.checkPrivatePreviewAvailable(ctx)
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
        resolve: async (_, args, ctx) => {
          // >= READ permissions on course required
          const validAccess = await checkAccess(
            [
              {
                courseId: args.courseId,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await AnalyticsService.getCourseActivityAnalytics(args, ctx)
        },
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
        resolve: async (_, args, ctx) => {
          // >= READ permissions on course required
          const validAccess = await checkAccess(
            [
              {
                courseId: args.courseId,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await AnalyticsService.getCoursePerformanceAnalytics(args, ctx)
        },
      }),

      getCourseActivities: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on course required
          const validAccess = await checkAccess(
            [
              {
                courseId: args.courseId,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await CourseService.getCourseActivities(args, ctx)
        },
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

      getSingleAnswerCollection: t.withAuth(asUser).field({
        nullable: true,
        type: AnswerCollection,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= READ permissions on answer collection required
          const validAccess = await checkAccess(
            [
              {
                answerCollectionId: args.id,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await ResourcesService.getSingleAnswerCollection(args, ctx)
        },
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

      getObjectPermissions: t.withAuth(asUser).field({
        nullable: true,
        type: [PermissionInfo],
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: CatalogObjectType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          if (args.objectType === CatalogObjectTypeEnum.CATALOG_COLLECTION) {
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
              {
                catalogCollectionId: args.objectId,
              },
              ctx
            )
          } else if (
            args.objectType === CatalogObjectTypeEnum.ANSWER_COLLECTION
          ) {
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
              {
                collectionId: parseInt(args.objectId),
              },
              ctx
            )
          }

          return null
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
          // if no catalogCollectionId is provided, return early
          if (
            args.catalogCollectionId === null ||
            typeof args.catalogCollectionId === 'undefined'
          ) {
            return null
          }

          // >= READ permissions on catalog collection
          const validAccess = await checkAccess(
            [
              {
                catalogCollectionId: args.catalogCollectionId,
                minimumPermissionLevel: DB.PermissionLevel.READ,
              },
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await SharingService.getCatalogCollectionInfo(
            { catalogCollectionId: args.catalogCollectionId! },
            ctx
          )
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
