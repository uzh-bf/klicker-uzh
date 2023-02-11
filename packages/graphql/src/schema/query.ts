import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import * as AccountService from '../services/accounts'
import * as CourseService from '../services/courses'
import * as FeedbackService from '../services/feedbacks'
import * as ParticipantGroupService from '../services/groups'
import * as LearningElementService from '../services/learningElements'
import * as MicroSessionService from '../services/microLearning'
import * as QuestionService from '../services/questions'
import * as SessionService from '../services/sessions'
import { Course } from './course'
import { LearningElement } from './learningElements'
import { MicroSession } from './microSession'
import { Participant, ParticipantGroup } from './participant'
import { Question, Tag } from './question'
import { Feedback, Session } from './session'
import { User } from './user'

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
      self: asParticipant.prismaField({
        nullable: true,
        type: Participant,
        resolve(query, _, __, ctx) {
          return ctx.prisma.participant.findUnique({
            ...query,
            where: { id: ctx.user.sub },
          })
        },
      }),
      controlCourse: asUser.prismaField({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, __, args, ctx) {
          return CourseService.getControlCourse(args, ctx)
        },
      }),
      basicCourseInformation: asUser.prismaField({
        nullable: true,
        type: Course,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, __, args, ctx) {
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
      userCourses: asUser.prismaField({
        nullable: true,
        type: [Course],
        resolve(_, __, ___, ctx) {
          return CourseService.getUserCourses(ctx)
        },
      }),
      unassignedSessions: asUser.prismaField({
        nullable: true,
        type: [Session],
        resolve(_, __, ___, ctx) {
          return SessionService.getUnassignedSessions(ctx)
        },
      }),
      runningSessions: asUser.prismaField({
        nullable: true,
        type: [Session],
        args: {
          shortname: t.arg.string({ required: true }),
        },
        resolve(_, __, args, ctx) {
          return SessionService.getRunningSessions(args, ctx)
        },
      }),
      controlCourses: asUser.prismaField({
        nullable: true,
        type: [Course],
        resolve(_, __, ___, ctx) {
          return CourseService.getControlCourses(ctx)
        },
      }),
      userSessions: asUser.prismaField({
        nullable: true,
        type: [Session],
        resolve(_, __, ___, ctx) {
          return SessionService.getUserSessions({ userId: ctx.user.sub }, ctx)
        },
      }),
      cockpitSession: asUser.prismaField({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, __, args, ctx) {
          return SessionService.getCockpitSession(args, ctx)
        },
      }),
      controlSession: asUser.prismaField({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, __, args, ctx) {
          return SessionService.getControlSession(args, ctx)
        },
      }),
      learningElement: t.prismaField({
        nullable: true,
        type: LearningElement,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, __, args, ctx) {
          return LearningElementService.getLearningElementData(args, ctx)
        },
      }),
      learningElements: asUser.prismaField({
        nullable: true,
        type: [LearningElement],
        resolve(_, __, ___, ctx) {
          return CourseService.getUserLearningElements(ctx)
        },
      }),
      microSession: asAuthenticated.prismaField({
        nullable: true,
        type: MicroSession,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, __, args, ctx) {
          return MicroSessionService.getSingleMicroSession(args, ctx)
        },
      }),
      participantGroups: asAuthenticated.prismaField({
        nullable: true,
        type: [ParticipantGroup],
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, __, args, ctx) {
          return ParticipantGroupService.getParticipantGroups(args, ctx)
        },
      }),
      session: asUser.prismaField({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, __, args, ctx) {
          return SessionService.getRunningSession(args, ctx)
        },
      }),
    }
  },
})
