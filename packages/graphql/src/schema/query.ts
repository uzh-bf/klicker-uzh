import { UserRole } from '@klicker-uzh/prisma'
import builder from '../builder'
import * as AccountService from '../services/accounts'
import * as CourseService from '../services/courses'
import * as FeedbackService from '../services/feedbacks'
import * as QuestionService from '../services/questions'
import { Course } from './course'
import { Participant } from './participant'
import { Tag } from './question'
import { Feedback } from './session'
import { User } from './user'

export const Query = builder.queryType({
  fields: (t) => ({
    self: t.prismaField({
      nullable: true,
      type: Participant,
      authScopes: {
        role: UserRole.PARTICIPANT,
      },
      resolve(query, _, _args, ctx) {
        if (!ctx.user?.sub) return null
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
        role: UserRole.USER,
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
        role: UserRole.USER,
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
        role: UserRole.USER,
      },
      resolve(_, __, args, ctx) {
        return AccountService.getLoginToken(args, ctx)
      },
    }),
    userTags: t.prismaField({
      nullable: true,
      type: [Tag],
      authScopes: {
        role: UserRole.USER,
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
  }),
})
