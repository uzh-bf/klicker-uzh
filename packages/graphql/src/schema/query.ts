import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import * as AccountService from '../services/accounts'
import * as CourseService from '../services/courses'
import * as FeedbackService from '../services/feedbacks'
import * as QuestionService from '../services/questions'
import * as SessionService from '../services/sessions'
import { Course } from './course'
import { Participant } from './participant'
import { Question, Tag } from './question'
import { Feedback, Session } from './session'
import { User } from './user'

export const Query = builder.queryType({
  fields: (t) => ({
    self: t
      .withAuth({
        authenticated: true,
        role: DB.UserRole.PARTICIPANT,
      })
      .prismaField({
        nullable: true,
        type: Participant,
        resolve(query, _, __, ctx) {
          return ctx.prisma.participant.findUnique({
            ...query,
            where: { id: ctx.user.sub },
          })
        },
      }),
    controlCourse: t.prismaField({
      nullable: true,
      type: Course,
      authScopes: {
        role: DB.UserRole.USER,
      },
      args: {
        id: t.arg.string({ required: true }),
      },
      resolve(_, __, args, ctx) {
        return CourseService.getControlCourse(args, ctx)
      },
    }),
    basicCourseInformation: t.prismaField({
      nullable: true,
      type: Course,
      authScopes: {
        role: DB.UserRole.USER,
      },
      args: {
        courseId: t.arg.string({ required: true }),
      },
      resolve(_, __, args, ctx) {
        return CourseService.getBasicCourseInformation(args, ctx)
      },
    }),
    getLoginToken: t.prismaField({
      nullable: true,
      type: User,
      authScopes: {
        role: DB.UserRole.USER,
      },
      resolve(_, __, args, ctx) {
        return AccountService.getLoginToken(args, ctx)
      },
    }),
    userTags: t.prismaField({
      nullable: true,
      type: [Tag],
      authScopes: {
        role: DB.UserRole.USER,
      },
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
    userProfile: t.prismaField({
      nullable: true,
      type: User,
      authScopes: {
        role: DB.UserRole.USER,
      },
      resolve(_, __, ___, ctx) {
        return AccountService.getUserProfile(ctx)
      },
    }),
    userQuestions: t.prismaField({
      nullable: true,
      type: [Question],
      authScopes: {
        role: DB.UserRole.USER,
      },
      resolve(_, __, ___, ctx) {
        return QuestionService.getUserQuestions(ctx)
      },
    }),
    userCourses: t.prismaField({
      nullable: true,
      type: [Course],
      authScopes: {
        role: DB.UserRole.USER,
      },
      resolve(_, __, ___, ctx) {
        return CourseService.getUserCourses(ctx)
      },
    }),
    unassignedSessions: t.prismaField({
      nullable: true,
      type: [Session],
      authScopes: {
        role: DB.UserRole.USER,
      },
      resolve(_, __, ___, ctx) {
        return SessionService.getUnassignedSessions(ctx)
      },
    }),
    runningSessions: t.prismaField({
      nullable: true,
      type: [Session],
      authScopes: {
        role: DB.UserRole.USER,
      },
      args: {
        shortname: t.arg.string({ required: true }),
      },
      resolve(_, __, args, ctx) {
        return SessionService.getRunningSessions(args, ctx)
      },
    }),
    controlCourses: t.prismaField({
      nullable: true,
      type: [Course],
      authScopes: {
        role: DB.UserRole.USER,
      },
      resolve(_, __, ___, ctx) {
        return CourseService.getControlCourses(ctx)
      },
    }),
    userSessions: t.prismaField({
      nullable: true,
      type: [Session],
      authScopes: {
        role: DB.UserRole.USER,
      },
      resolve(_, __, ___, ctx) {
        return SessionService.getUserSessions({ userId: ctx.user!.sub }, ctx)
      },
    }),
  }),
})
