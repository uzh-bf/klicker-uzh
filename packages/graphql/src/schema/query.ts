import { UserRole } from '@klicker-uzh/prisma'
import builder from '../builder'
import * as CourseService from '../services/courses'
import { Course } from './course'
import { Participant } from './participant'

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
  }),
})
