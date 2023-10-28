import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'
import * as AccountService from '../services/accounts.js'
import * as CourseService from '../services/courses.js'
import * as FeedbackService from '../services/feedbacks.js'
import * as ParticipantGroupService from '../services/groups.js'
import * as LearningElementService from '../services/learningElements.js'
import * as MicroSessionService from '../services/microLearning.js'
import * as ParticipantService from '../services/participants.js'
import * as PracticeQuizService from '../services/practiceQuizzes.js'
import * as QuestionService from '../services/questions.js'
import * as SessionService from '../services/sessions.js'
import { Course, LeaderboardEntry } from './course.js'
import { GroupActivityDetails } from './groupActivity.js'
import { LearningElement, QuestionStack } from './learningElements.js'
import { MicroSession } from './microSession.js'
import {
  Participant,
  ParticipantGroup,
  ParticipantLearningData,
  ParticipantWithAchievements,
  Participation,
} from './participant.js'
import { PracticeQuiz } from './practiceQuizzes.js'
import { Element, Tag } from './question.js'
import { Feedback, Session, SessionEvaluation } from './session.js'
import { MediaFile, User, UserLogin } from './user.js'

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

      userTags: asUser.prismaField({
        nullable: true,
        type: [Tag],
        async resolve(_, __, ___, ctx) {
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

      feedbacks: t.prismaField({
        nullable: true,
        type: [Feedback],
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, __, args, ctx) {
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

      userQuestions: asUser.prismaField({
        nullable: true,
        type: [Element],
        resolve(_, __, ___, ctx) {
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
          return SessionService.getCockpitSession(args, ctx)
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

      learningElement: t.field({
        nullable: true,
        type: LearningElement,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          // FIXME by fixing type issues in LearningElementService
          return LearningElementService.getLearningElementData(args, ctx) as any
        },
      }),

      learningElements: asParticipant.field({
        nullable: true,
        type: [LearningElement],
        resolve(_, __, ctx) {
          return CourseService.getUserLearningElements(ctx)
        },
      }),

      practiceQuiz: t.field({
        nullable: true,
        type: PracticeQuiz,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          // FIXME by fixing type issues in LearningElementService
          return PracticeQuizService.getPracticeQuizData(args, ctx) as any
        },
      }),

      practiceQuizzes: asParticipant.field({
        nullable: true,
        type: [PracticeQuiz],
        resolve(_, __, ctx) {
          return CourseService.getUserPracticeQuizzes(ctx)
        },
      }),

      microSession: t.field({
        nullable: true,
        type: MicroSession,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroSessionService.getSingleMicroSession(args, ctx)
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

      question: asUser.prismaField({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, __, args, ctx) {
          return QuestionService.getSingleQuestion(args, ctx) as any
        },
      }),

      singleMicroSession: asUser.field({
        nullable: true,
        type: MicroSession,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroSessionService.getSingleMicroSession(args, ctx)
        },
      }),

      sessionLeaderboard: t.field({
        nullable: true,
        type: [LeaderboardEntry],
        args: {
          sessionId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
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
          // FIXME by fixing type issues in CourseService
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

      getBookmarkedQuestions: asParticipant.field({
        nullable: true,
        type: [QuestionStack],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.getBookmarkedQuestions(args, ctx)
        },
      }),

      getBookmarksLearningElement: t.field({
        nullable: true,
        type: [QuestionStack],
        args: {
          elementId: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LearningElementService.getBookmarksLearningElement(args, ctx)
        },
      }),

      questionStack: asParticipant.field({
        nullable: true,
        type: QuestionStack,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return LearningElementService.getQuestionStack(args, ctx)
        },
      }),

      userLogins: asUser.field({
        nullable: true,
        type: [UserLogin],
        resolve(_, __, ctx) {
          return AccountService.getUserLogins(ctx)
        },
      }),

      checkUsernameAvailability: t.field({
        nullable: false,
        type: 'Boolean',
        args: {
          username: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.checkUsernameAvailability(args, ctx)
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
    }
  },
})
