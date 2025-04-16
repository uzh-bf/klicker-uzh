import * as DB from '@klicker-uzh/prisma'
import { CatalogObjectType as CatalogObjectTypeEnum } from '@klicker-uzh/types'
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

export const Query = builder.queryType({
  fields(t) {
    const asAuthenticated = { authenticated: true }
    const asParticipant = { authenticated: true, role: DB.UserRole.PARTICIPANT }
    const asUser = { authenticated: true, role: DB.UserRole.USER }

    return {
      self: t.field({
        nullable: true,
        type: Participant,
        resolve(_, __, ctx) {
          if (!ctx.user?.sub) return null
          return ctx.prisma.participant.findUnique({
            where: { id: ctx.user.sub },
          })
        },
      }),

      selfWithAchievements: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantWithAchievements,
        async resolve(_, __, ctx) {
          if (!ctx.user?.sub) return null
          return ParticipantService.getParticipantWithAchievements(ctx)
        },
      }),

      publicParticipantProfile: t.withAuth(asParticipant).field({
        nullable: true,
        type: Participant,
        args: {
          participantId: t.arg.string({ required: true }),
        },
        async resolve(_, args, ctx) {
          return ParticipantService.getPublicParticipantProfile(args, ctx)
        },
      }),

      // TODO: potentially update access control
      controlCourse: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(__, args, ctx) {
          return CourseService.getControlCourse(args, ctx)
        },
      }),

      basicCourseInformation: t.field({
        nullable: true,
        type: StudentCourse,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(__, args, ctx) {
          return CourseService.getBasicCourseInformation(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getLoginToken: t.withAuth(asUser).field({
        nullable: true,
        type: User,
        resolve(_, ___, ctx) {
          return AccountService.getLoginToken(ctx)
        },
      }),

      // TODO: potentially update access control
      userTags: t.withAuth(asUser).field({
        nullable: true,
        type: [Tag],
        async resolve(_, __, ctx) {
          const user = await ctx.prisma.user.findUnique({
            where: { id: ctx.user.sub },
            include: { tags: { orderBy: { order: 'asc' } } },
          })

          if (!user) return []

          return user.tags
        },
      }),

      // TODO: potentially update access control
      userMediaFiles: t.withAuth(asUser).field({
        nullable: true,
        type: [MediaFile],
        async resolve(_, __, ctx) {
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
        resolve(_, args, ctx) {
          return FeedbackService.getFeedbacks(args, ctx)
        },
      }),

      // TODO: potentially update access control
      userProfile: t.withAuth(asUser).field({
        nullable: true,
        type: User,
        async resolve(_, __, ctx) {
          const user = await ctx.prisma.user.findUnique({
            where: { id: ctx.user.sub },
          })

          if (!user) return null

          return user
        },
      }),

      // TODO: potentially update access control
      userScope: t.withAuth(asUser).field({
        nullable: true,
        type: UserLoginScope,
        resolve(_, __, ctx) {
          return ctx.user.scope
        },
      }),

      // TODO: potentially update access control
      userQuestions: t.withAuth(asUser).field({
        nullable: true,
        type: [Element],
        resolve(_, __, ctx) {
          return QuestionService.getUserQuestions(ctx)
        },
      }),

      // TODO: potentially update access control
      userCourses: t.withAuth(asUser).field({
        nullable: true,
        type: [Course],
        resolve(_, __, ctx) {
          return CourseService.getUserCourses(ctx)
        },
      }),

      // TODO: potentially update access control
      getActiveUserCourses: t.withAuth(asUser).field({
        nullable: true,
        type: [Course],
        resolve(_, __, ctx) {
          return CourseService.getActiveUserCourses(ctx)
        },
      }),

      // TODO: potentially update access control
      getCourseSummary: t.withAuth(asUser).field({
        nullable: true,
        type: CourseSummary,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.getCourseSummary(args, ctx)
        },
      }),

      participantCourses: t.withAuth(asParticipant).field({
        nullable: true,
        type: [Course],
        resolve(_, __, ctx) {
          return CourseService.getParticipantCourses(ctx)
        },
      }),

      // TODO: potentially update access control
      unassignedLiveQuizzes: t.withAuth(asUser).field({
        nullable: true,
        type: [LiveQuiz],
        resolve(_, __, ctx) {
          return LiveQuizService.getUnassignedLiveQuizzes(ctx)
        },
      }),

      shortnameQuizzes: t.field({
        nullable: true,
        type: [LiveQuiz],
        args: {
          shortname: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getShortnameQuizzes(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getLiveQuizSummary: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuizSummary,
        args: {
          quizId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getLiveQuizSummary(args, ctx)
        },
      }),

      getCourseRunningLiveQuizzes: t.field({
        nullable: true,
        type: [LiveQuiz],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getCourseRunningLiveQuizzes(args, ctx)
        },
      }),

      getCoursePublishedPracticeQuizzes: t.field({
        nullable: true,
        type: [PracticeQuiz],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return PracticeQuizService.getCoursePublishedPracticeQuizzes(
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
        resolve(_, args, ctx) {
          return MicroLearningService.getCoursePublishedMicroLearnings(
            args,
            ctx
          )
        },
      }),

      // TODO: potentially update access control
      userRunningLiveQuizzes: t.withAuth(asUser).field({
        nullable: true,
        type: [LiveQuizInfo],
        resolve(_, __, ctx) {
          return LiveQuizService.getUserRunningLiveQuizzes(ctx)
        },
      }),

      // TODO: potentially update access control
      controlCourses: t.withAuth(asUser).field({
        nullable: true,
        type: [Course],
        resolve(_, __, ctx) {
          return CourseService.getControlCourses(ctx)
        },
      }),

      // TODO: potentially update access control
      userLiveQuizzes: t.withAuth(asUser).field({
        nullable: true,
        type: [LiveQuiz],
        resolve(_, __, ctx) {
          return LiveQuizService.getUserLiveQuizzes(ctx)
        },
      }),

      // TODO: potentially update access control
      cockpitQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getCockpitQuiz(args, ctx)
        },
      }),

      // TODO: potentially update access control
      controlLiveQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getControlLiveQuiz(args, ctx)
        },
      }),

      practiceQuiz: t.field({
        nullable: true,
        type: PracticeQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return PracticeQuizService.getPracticeQuizData(args, ctx)
        },
      }),

      getPreviousStackEvaluation: t.field({
        nullable: true,
        type: StackFeedback,
        args: {
          stackId: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return StacksService.getPreviousStackEvaluation(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getPracticeQuizEvaluation: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityEvaluation,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return PracticeQuizService.getPracticeQuizEvaluation(args, ctx)
        },
      }),

      microLearning: t.field({
        nullable: true,
        type: MicroLearning,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.getMicroLearningData(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getMicroLearningEvaluation: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityEvaluation,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.getMicroLearningEvaluation(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getSinglePracticeQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: PracticeQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return PracticeQuizService.getSinglePracticeQuiz(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getSingleMicroLearning: t.withAuth(asUser).field({
        nullable: true,
        type: MicroLearning,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.getSingleMicroLearning(args, ctx)
        },
      }),

      liveQuizEvaluation: t.field({
        nullable: true,
        type: ActivityEvaluation,
        args: {
          id: t.arg.string({ required: true }),
          hmac: t.arg.string(),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getLiveQuizEvaluation(args, ctx)
        },
      }),

      studentLiveQuiz: t.field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getRunningLiveQuiz(args, ctx)
        },
      }),

      participantGroups: t.withAuth(asAuthenticated).field({
        nullable: true,
        type: [ParticipantGroup],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.getParticipantGroups(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getCourseGroups: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.getCourseGroups(args, ctx)
        },
      }),

      // TODO: potentially update access control
      liveQuizHMAC: t.withAuth(asUser).field({
        nullable: true,
        type: 'String',
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getLiveQuizHMAC(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getLecturerViewLiveQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getLecturerViewLiveQuiz(args, ctx)
        },
      }),

      // TODO: potentially update access control
      course: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.getCourseData(args, ctx)
        },
      }),

      // TODO: potentially update access control
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
        resolve(_, args, ctx) {
          return CourseService.getCourseLeaderboard(args, ctx)
        },
      }),

      // TODO: potentially update access control
      liveQuiz: t.withAuth(asUser).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getLiveQuizData(args, ctx)
        },
      }),

      // TODO: potentially update access control
      question: t.withAuth(asUser).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.getSingleQuestion(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getInstanceUpdateActivities: t.withAuth(asUser).field({
        nullable: true,
        type: [InstanceUpdateActivityInfo],
        args: {
          elementId: t.arg.int({ required: true }),
          hasSampleSolution: t.arg.boolean({ required: false }),
          includeTemplateInstances: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.getInstanceUpdateActivities(args, ctx)
        },
      }),

      // TODO: potentially update access control
      artificialInstance: t.withAuth(asUser).field({
        nullable: true,
        type: ElementInstance,
        args: {
          elementId: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.getArtificialElementInstance(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getSingleElementInstance: t.withAuth(asUser).field({
        nullable: true,
        type: ElementInstance,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.getSingleElementInstance(args, ctx)
        },
      }),

      liveQuizLeaderboard: t.field({
        nullable: true,
        type: [LeaderboardEntry],
        args: {
          quizId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LiveQuizService.getLiveQuizLeaderboard(args, ctx)
        },
      }),

      participations: t.withAuth(asParticipant).field({
        nullable: true,
        type: [Participation],
        args: {
          endpoint: t.arg.string({ required: false }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.getParticipations(args, ctx)
        },
      }),

      getPracticeCourses: t.withAuth(asParticipant).field({
        nullable: true,
        type: [Course],
        resolve(_, __, ctx) {
          return ParticipantService.getPracticeCourses(ctx)
        },
      }),

      getParticipation: t.field({
        nullable: true,
        type: Participation,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.getParticipation(args, ctx)
        },
      }),

      getCourseOverviewData: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantLearningData,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.getCourseOverviewData(args, ctx)
        },
      }),

      getStudentCourseLeaderboard: t.withAuth(asParticipant).field({
        nullable: true,
        type: StudentCourseLeaderboard,
        args: {
          courseId: t.arg.string({ required: true }),
          mode: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.getStudentCourseLeaderboard(args, ctx)
        },
      }),

      groupActivities: t.withAuth(asParticipant).field({
        nullable: true,
        type: [GroupActivity],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.getCourseGroupActivities(args, ctx)
        },
      }),

      groupActivityInstances: t.withAuth(asParticipant).field({
        nullable: true,
        type: [GroupActivityInstance],
        args: {
          groupId: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.getGroupActivityInstances(args, ctx)
        },
      }),

      groupActivityDetails: t.withAuth(asParticipant).field({
        nullable: true,
        type: GroupActivityDetails,
        args: {
          activityId: t.arg.string({ required: true }),
          groupId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.getGroupActivityDetails(args, ctx)
        },
      }),

      getBookmarkedElementStacks: t.withAuth(asParticipant).field({
        nullable: true,
        type: [ElementStack],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.getBookmarkedElementStacks(args, ctx)
        },
      }),

      getStackElementFeedbacks: t.withAuth(asParticipant).field({
        nullable: true,
        type: [ElementFeedback],
        args: {
          elementInstanceIds: t.arg.intList({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.getStackElementFeedbacks(args, ctx)
        },
      }),

      getPracticeQuizList: t.withAuth(asParticipant).field({
        nullable: true,
        type: [Course],
        resolve(_, __, ctx) {
          return ParticipantService.getPracticeQuizList(ctx)
        },
      }),

      getCourseStudentTimelines: t.withAuth(asParticipant).field({
        nullable: true,
        type: [CourseStudentTimeline],
        resolve(_, __, ctx) {
          return ParticipantService.getCourseStudentTimelines(ctx)
        },
      }),

      // TODO: potentially update access control
      getPracticeQuizSummary: t.withAuth(asUser).field({
        nullable: true,
        type: ActivitySummary,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return PracticeQuizService.getPracticeQuizSummary(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getMicroLearningSummary: t.withAuth(asUser).field({
        nullable: true,
        type: ActivitySummary,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.getMicroLearningSummary(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getGroupActivitySummary: t.withAuth(asUser).field({
        nullable: true,
        type: GroupActivitySummary,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.getGroupActivitySummary(args, ctx)
        },
      }),

      // TODO: potentially update access control
      userLogins: t.withAuth(asUser).field({
        nullable: true,
        type: [UserLogin],
        resolve(_, __, ctx) {
          return AccountService.getUserLogins(ctx)
        },
      }),

      // TODO: potentially update access control
      groupActivity: t.withAuth(asUser).field({
        nullable: true,
        type: GroupActivity,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.getGroupActivity(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getGradingGroupActivity: t.withAuth(asUser).field({
        nullable: true,
        type: GroupActivity,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.getGradingGroupActivity(args, ctx)
        },
      }),

      checkParticipantNameAvailable: t.field({
        nullable: false,
        type: 'Boolean',
        args: {
          username: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.checkParticipantNameAvailable(args, ctx)
        },
      }),

      checkShortnameAvailable: t.field({
        nullable: false,
        type: 'Boolean',
        args: {
          shortname: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.checkShortnameAvailable(args, ctx)
        },
      }),

      checkPublicPreviewAvailable: t.boolean({
        nullable: false,
        resolve(_, __, ctx) {
          return AccountService.checkPublicPreviewAvailable(ctx)
        },
      }),

      checkPrivatePreviewAvailable: t.boolean({
        nullable: false,
        resolve(_, __, ctx) {
          return AccountService.checkPrivatePreviewAvailable(ctx)
        },
      }),

      checkValidCoursePin: t.field({
        nullable: true,
        type: 'String',
        args: {
          pin: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.checkValidCoursePin(args, ctx)
        },
      }),

      coursePracticeQuiz: t.withAuth(asParticipant).field({
        nullable: true,
        type: PracticeQuiz,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.getCoursePracticeQuiz(args, ctx)
        },
      }),

      getBookmarksPracticeQuiz: t.withAuth(asParticipant).field({
        nullable: true,
        type: ['Int'],
        args: {
          quizId: t.arg.string({ required: false }),
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return PracticeQuizService.getBookmarksPracticeQuiz(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getCourseActivityAnalytics: t.withAuth(asUser).field({
        nullable: true,
        type: CourseActivityAnalytics,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AnalyticsService.getCourseActivityAnalytics(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getCourseWeeklyActivity: t.withAuth(asUser).field({
        nullable: true,
        type: WeeklyCourseActivities,
        args: {
          courseId: t.arg.string({ required: false }),
        },
        resolve(_, args, ctx) {
          return AnalyticsService.getCourseWeeklyActivity(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getCoursePerformanceAnalytics: t.withAuth(asUser).field({
        nullable: true,
        type: CoursePerformanceAnalytics,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AnalyticsService.getCoursePerformanceAnalytics(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getCourseActivities: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.getCourseActivities(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getActivityAnalytics: t.withAuth(asUser).field({
        nullable: true,
        type: QuizAnalytics,
        args: {
          activityId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AnalyticsService.getActivityAnalytics(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getAnswerCollectionsElements: t.withAuth(asUser).field({
        nullable: true,
        type: [AnswerCollection],
        args: {
          templateId: t.arg.string({ required: false }),
        },
        resolve(_, args, ctx) {
          return ResourcesService.getAnswerCollectionsElements(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getAnswerCollectionsInfo: t.withAuth(asUser).field({
        nullable: true,
        type: [AnswerCollection],
        resolve(_, __, ctx) {
          return ResourcesService.getAnswerCollectionsInfo(ctx)
        },
      }),

      // TODO: potentially update access control
      getSingleAnswerCollection: t.withAuth(asUser).field({
        nullable: true,
        type: AnswerCollection,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return ResourcesService.getSingleAnswerCollection(args, ctx)
        },
      }),

      // TODO: potentially update access control
      checkTemplateInfoAvailable: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityTemplateInfo,
        args: {
          activityId: t.arg.string({ required: true }),
          activityType: t.arg({ type: ActivityType, required: true }),
        },
        resolve(_, args, ctx) {
          return TemplateService.checkTemplateInfoAvailable(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getTemplateInformation: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityTemplateMetadata,
        args: {
          activityId: t.arg.string({ required: true }),
          activityType: t.arg({ type: ActivityType, required: true }),
        },
        resolve(_, args, ctx) {
          return TemplateService.getTemplateInformation(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getActivityTemplate: t.withAuth(asUser).field({
        nullable: true,
        type: ActivityTemplate,
        args: {
          templateId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return TemplateService.getActivityTemplate(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getMatchingUserElementsTemplate: t.withAuth(asUser).field({
        nullable: true,
        type: [TemplateElementInformation],
        args: {
          elementType: t.arg({ type: ElementType, required: true }),
          hasSampleSolution: t.arg.boolean({ required: false }),
          hasAnswerFeedbacks: t.arg.boolean({ required: false }),
        },
        resolve(_, args, ctx) {
          return TemplateService.getMatchingUserElementsTemplate(args, ctx)
        },
      }),

      // TODO: potentially update access control
      checkTemplateElementExists: t.withAuth(asUser).boolean({
        nullable: false,
        args: {
          name: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return TemplateService.checkTemplateElementExists(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getTemplatePreviewAnswerCollectionEntries: t.withAuth(asUser).field({
        nullable: true,
        type: [AnswerCollectionPreviewEntry],
        args: {
          templateId: t.arg.string({ required: true }),
          answerCollectionId: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return TemplateService.getTemplatePreviewAnswerCollectionEntries(
            args,
            ctx
          )
        },
      }),

      // TODO: potentially update access control
      getObjectPermissions: t.withAuth(asUser).field({
        nullable: true,
        type: [PermissionInfo],
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: CatalogObjectType, required: true }),
        },
        resolve(_, args, ctx) {
          if (args.objectType === CatalogObjectTypeEnum.CATALOG_COLLECTION) {
            return SharingService.getCatalogCollectionPermissions(
              {
                catalogCollectionId: args.objectId,
              },
              ctx
            )
          } else if (
            args.objectType === CatalogObjectTypeEnum.ANSWER_COLLECTION
          ) {
            return SharingService.getAnswerCollectionPermissions(
              {
                collectionId: parseInt(args.objectId),
              },
              ctx
            )
          }

          return null
        },
      }),

      // TODO: potentially update access control
      getCatalogCollectionsList: t.withAuth(asUser).field({
        nullable: true,
        type: [CatalogCollection],
        resolve(_, __, ctx) {
          return SharingService.getCatalogCollectionsList(ctx)
        },
      }),

      // TODO: potentially update access control
      getCatalogCollectionInfo: t.withAuth(asUser).field({
        nullable: true,
        type: CatalogCollection,
        args: {
          catalogCollectionId: t.arg.string({ required: false }),
        },
        resolve(_, args, ctx) {
          return SharingService.getCatalogCollectionInfo(args, ctx)
        },
      }),

      // TODO: potentially update access control
      countCatalogSharingRequests: t.withAuth(asUser).int({
        nullable: false,
        resolve(_, __, ctx) {
          return SharingService.countCatalogSharingRequests(ctx)
        },
      }),

      // TODO: potentially update access control
      getCatalogSharingRequests: t.withAuth(asUser).field({
        nullable: true,
        type: [ObjectSharingRequest],
        resolve(_, __, ctx) {
          return SharingService.getCatalogSharingRequests(ctx)
        },
      }),

      // TODO: potentially update access control
      getCatalogObjects: t.withAuth(asUser).field({
        nullable: true,
        type: [CatalogObject],
        args: {
          catalogCollectionId: t.arg.string({ required: false }),
        },
        resolve(_, args, ctx) {
          return SharingService.getCatalogObjects(args, ctx)
        },
      }),

      // TODO: potentially update access control
      getCatalogAnswerCollections: t.withAuth(asUser).field({
        nullable: true,
        type: [CatalogSelectionObject],
        resolve(_, __, ctx) {
          return SharingService.getCatalogAnswerCollections(ctx)
        },
      }),

      // TODO: potentially update access control
      getCatalogLiveQuizTemplates: t.withAuth(asUser).field({
        nullable: true,
        type: [CatalogSelectionObject],
        resolve(_, __, ctx) {
          return SharingService.getCatalogLiveQuizTemplates(ctx)
        },
      }),

      // TODO: potentially update access control
      getAnswerCollectionCatalogInfo: t.withAuth(asUser).field({
        nullable: true,
        type: AnswerCollection,
        args: {
          collectionId: t.arg.int({ required: true }),
          catalogCollectionId: t.arg.string({ required: false }),
        },
        resolve(_, args, ctx) {
          return SharingService.getAnswerCollectionCatalogInfo(args, ctx)
        },
      }),
    }
  },
})
