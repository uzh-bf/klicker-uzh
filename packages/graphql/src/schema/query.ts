import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import * as AccountService from '../services/accounts'
import * as CourseService from '../services/courses'
import * as FeedbackService from '../services/feedbacks'
import * as ParticipantGroupService from '../services/groups'
import * as LearningElementService from '../services/learningElements'
import * as MicroSessionService from '../services/microLearning'
import * as ParticipantService from '../services/participants'
import * as QuestionService from '../services/questions'
import * as SessionService from '../services/sessions'
import { Course, LeaderboardEntry } from './course'
import { GroupActivityDetails } from './groupActivity'
import { LearningElement } from './learningElements'
import { MicroSession } from './microSession'
import {
  Participant,
  ParticipantGroup,
  ParticipantLearningData,
  ParticipantWithAchievements,
  Participation,
} from './participant'
import { Question, QuestionInstance, Tag } from './question'
import { Feedback, Session, SessionEvaluation } from './session'
import { User } from './user'

export const Query = builder.queryType({
  fields(t) {
    const asAuthenticated = t.withAuth({
      authenticated: true,
    })

    const asParticipant = t.withAuth({
      $all: {
        authenticated: true,
        role: DB.UserRole.PARTICIPANT,
      },
    })

    const asUser = t.withAuth({
      $all: {
        authenticated: true,
        role: DB.UserRole.USER,
      },
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
      participantDetails: t.field({
        nullable: true,
        type: ParticipantWithAchievements,
        args: {
          participantId: t.arg.string({ required: true }),
        },
        async resolve(_, args, ctx) {
          const participant = await ctx.prisma.participant.findUnique({
            where: { id: args.participantId }
            })
          if (!participant) return null
          const achievements = await ctx.prisma.achievement.findMany()
          return {
            participant,
            achievements
          }
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
      getLoginToken: asUser.prismaField({
        nullable: true,
        type: User,
        resolve(_, __, args, ctx) {
          return AccountService.getLoginToken(args, ctx)
        },
      }),
      userTags: asUser.prismaField({
        nullable: true,
        type: [Tag],
        resolve(_, __, ___, ctx) {
          return QuestionService.getUserTags(ctx)
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
      userProfile: asUser.prismaField({
        nullable: true,
        type: User,
        resolve(_, __, ___, ctx) {
          return AccountService.getUserProfile(ctx)
        },
      }),
      userQuestions: asUser.prismaField({
        nullable: true,
        type: [Question],
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
          return SessionService.getUserSessions({ userId: ctx.user.sub }, ctx)
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
      course: asAuthenticated.field({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.getCourseData(args, ctx)
        },
      }),
      liveSession: t.field({
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
        type: Question,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, __, args, ctx) {
          return QuestionService.getSingleQuestion(args, ctx)
        },
      }),
      singleMicroSession: asAuthenticated.field({
        nullable: true,
        type: MicroSession,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroSessionService.getSingleMicroSession(args, ctx)
        },
      }),
      sessionEvaluation: asUser.field({
        nullable: true,
        type: SessionEvaluation,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.getSessionEvaluation(args, ctx)
        },
      }),
      sessionLeaderboard: t.field({
        nullable: true,
        type: [LeaderboardEntry],
        args: {
          sessionId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.getLeaderboard(args, ctx)
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
      getCourseOverviewData: asAuthenticated.field({
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
        type: [QuestionInstance],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.getBookmarkedQuestions(args, ctx)
        },
      }),

      getBookmarksLearningElement: asParticipant.field({
        nullable: true,
        type: [QuestionInstance],
        args: {
          elementId: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LearningElementService.getBookmarksLearningElement(args, ctx)
        },
      }),
    }
  },
})
