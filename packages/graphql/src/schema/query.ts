import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import * as AccountService from '../services/accounts'
import * as CourseService from '../services/courses'
import * as FeedbackService from '../services/feedbacks'
import * as ParticipantGroupService from '../services/groups'
import * as MicroLearningService from '../services/microLearning'
import * as ParticipantService from '../services/participants'
import * as PracticeQuizService from '../services/practiceQuizzes'
import * as QuestionService from '../services/questions'
import * as SessionService from '../services/sessions'
import { Course, LeaderboardEntry } from './course'
import { GroupActivityDetails } from './groupActivity'
import { MicroLearning } from './microLearning'
import {
  Participant,
  ParticipantGroup,
  ParticipantLearningData,
  ParticipantWithAchievements,
  Participation,
} from './participant'
import { ElementStack, PracticeQuiz } from './practiceQuizzes'
import { Element, Tag } from './question'
import { Feedback, Session, SessionEvaluation } from './session'
import { MediaFile, User, UserLogin, UserLoginScope } from './user'

export const Query = builder.queryType({
  fields(t) {
    const asAuthenticated = t.withAuth({
      authenticated: true,
    })

    const asParticipant = t.withAuth({
      authenticated: true,
      role: DB.UserRole.PARTICIPANT,
    })

    const asUser = t.withAuth({
      authenticated: true,
      role: DB.UserRole.USER,
    })

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

      selfWithAchievements: asParticipant.field({
        nullable: true,
        type: ParticipantWithAchievements,
        async resolve(_, __, ctx) {
          if (!ctx.user?.sub) return null
          return ParticipantService.getParticipantWithAchievements(ctx)
        },
      }),

      publicParticipantProfile: asParticipant.field({
        nullable: true,
        type: Participant,
        args: {
          participantId: t.arg.string({ required: true }),
        },
        async resolve(_, args, ctx) {
          return ParticipantService.getPublicParticipantProfile(args, ctx)
        },
      }),

      controlCourse: asUser.field({
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
        type: Course,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(__, args, ctx) {
          return CourseService.getBasicCourseInformation(args, ctx)
        },
      }),

      getLoginToken: asUser.field({
        nullable: true,
        type: User,
        resolve(_, ___, ctx) {
          return AccountService.getLoginToken(ctx)
        },
      }),

      userTags: asUser.field({
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

      userMediaFiles: asUser.field({
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
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.getFeedbacks(args, ctx)
        },
      }),

      userProfile: asUser.field({
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

      userScope: asUser.field({
        nullable: true,
        type: UserLoginScope,
        resolve(_, __, ctx) {
          return ctx.user.scope
        },
      }),

      userQuestions: asUser.field({
        nullable: true,
        type: [Element],
        resolve(_, __, ctx) {
          return QuestionService.getUserQuestions(ctx)
        },
      }),

      userCourses: asUser.field({
        nullable: true,
        type: [Course],
        resolve(_, __, ctx) {
          return CourseService.getUserCourses(ctx)
        },
      }),

      participantCourses: asParticipant.field({
        nullable: true,
        type: [Course],
        resolve(_, __, ctx) {
          return CourseService.getParticipantCourses(ctx)
        },
      }),

      unassignedSessions: asUser.field({
        nullable: true,
        type: [Session],
        resolve(_, __, ctx) {
          return SessionService.getUnassignedSessions(ctx)
        },
      }),

      runningSessions: t.field({
        nullable: true,
        type: [Session],
        args: {
          shortname: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.getRunningSessions(args, ctx)
        },
      }),

      userRunningSessions: asUser.field({
        nullable: true,
        type: [Session],
        resolve(_, __, ctx) {
          return SessionService.getUserRunningSessions(ctx)
        },
      }),

      controlCourses: asUser.field({
        nullable: true,
        type: [Course],
        resolve(_, __, ctx) {
          return CourseService.getControlCourses(ctx)
        },
      }),

      userSessions: asUser.field({
        nullable: true,
        type: [Session],
        resolve(_, __, ctx) {
          return SessionService.getUserSessions(ctx)
        },
      }),

      cockpitSession: asUser.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          // FIXME: subsetting
          return SessionService.getCockpitSession(args, ctx) as any
        },
      }),

      controlSession: asUser.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.getControlSession(args, ctx)
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

      microLearning: t.field({
        nullable: true,
        type: MicroLearning,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.getSingleMicroLearning(args, ctx)
        },
      }),

      sessionEvaluation: t.field({
        nullable: true,
        type: SessionEvaluation,
        args: {
          id: t.arg.string({ required: true }),
          hmac: t.arg.string(),
        },
        resolve(_, args, ctx) {
          // FIXME: subsetting
          return SessionService.getSessionEvaluation(args, ctx) as any
        },
      }),

      session: t.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.getRunningSession(args, ctx)
        },
      }),

      participantGroups: asAuthenticated.field({
        nullable: true,
        type: [ParticipantGroup],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantGroupService.getParticipantGroups(args, ctx)
        },
      }),

      sessionHMAC: asUser.field({
        nullable: true,
        type: 'String',
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.getSessionHMAC(args, ctx)
        },
      }),

      pinnedFeedbacks: asUser.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.getPinnedFeedbacks(args, ctx)
        },
      }),

      course: asUser.field({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.getCourseData(args, ctx)
        },
      }),

      liveSession: asUser.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.getLiveSessionData(args, ctx)
        },
      }),

      question: asUser.field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.getSingleQuestion(args, ctx)
        },
      }),

      sessionLeaderboard: t.field({
        nullable: true,
        type: [LeaderboardEntry],
        args: {
          sessionId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          // FIXME: seems to not respect nullable property correctly here?
          return SessionService.getLeaderboard(args, ctx) as any
        },
      }),

      participations: asParticipant.field({
        nullable: true,
        type: [Participation],
        args: {
          endpoint: t.arg.string({ required: false }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.getParticipations(args, ctx)
        },
      }),

      getPracticeCourses: asParticipant.field({
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

      getCourseOverviewData: asParticipant.field({
        nullable: true,
        type: ParticipantLearningData,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          // FIXME: getCourseOverviewData has no more type issues, but contains a lot of mappings and subsetting of existing types
          return CourseService.getCourseOverviewData(args, ctx) as any
        },
      }),

      groupActivityDetails: asParticipant.field({
        nullable: true,
        type: GroupActivityDetails,
        args: {
          activityId: t.arg.string({ required: true }),
          groupId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantGroupService.getGroupActivityDetails(args, ctx)
        },
      }),

      getBookmarkedElementStacks: asParticipant.field({
        nullable: true,
        type: [ElementStack],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.getBookmarkedElementStacks(args, ctx)
        },
      }),

      getPracticeQuizList: asParticipant.field({
        nullable: true,
        type: [Course],
        resolve(_, __, ctx) {
          return ParticipantService.getPracticeQuizList(ctx)
        },
      }),

      userLogins: asUser.field({
        nullable: true,
        type: [UserLogin],
        resolve(_, __, ctx) {
          return AccountService.getUserLogins(ctx)
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

      coursePracticeQuiz: asParticipant.field({
        nullable: true,
        type: PracticeQuiz,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.getCoursePracticeQuiz(args, ctx)
        },
      }),

      getBookmarksPracticeQuiz: asParticipant.field({
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
    }
  },
})
