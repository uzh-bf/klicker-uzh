import { UserRole } from '@klicker-uzh/prisma'
import builder from '../builder'
import * as AccountService from '../services/accounts'
import * as CourseService from '../services/courses'
import * as QuestionService from '../services/questions'
import * as SessionService from '../services/sessions'
import { Course } from './course'
import { Tag } from './question'
import { Session } from './session'

export const Mutation = builder.mutationType({
  fields: (t) => ({
    loginUser: t.field({
      nullable: true,
      type: 'String',
      args: {
        email: t.arg.string({ required: true, validate: { email: true } }),
        password: t.arg.string({ required: true }),
      },
      resolve(_, args, ctx) {
        return AccountService.loginUser(args, ctx)
      },
    }),
    cancelSession: t.field({
      nullable: true,
      type: Session,
      args: {
        id: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.USER,
      },
      resolve(_, args, ctx) {
        return SessionService.cancelSession(args, ctx)
      },
    }),
    changeCourseColor: t.field({
      nullable: true,
      type: Course,
      args: {
        courseId: t.arg.string({ required: true }),
        color: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.USER,
      },
      resolve(_, args, ctx) {
        return CourseService.changeCourseColor(args, ctx)
      },
    }),
    changeCourseDescription: t.field({
      nullable: true,
      type: Course,
      args: {
        courseId: t.arg.string({ required: true }),
        input: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.USER,
      },
      resolve(_, args, ctx) {
        return CourseService.changeCourseDescription(args, ctx)
      },
    }),
    deleteTag: t.field({
      nullable: true,
      type: Tag,
      args: {
        id: t.arg.int({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.USER,
      },
      resolve(_, args, ctx) {
        return QuestionService.deleteTag(args, ctx)
      },
    }),
  }),
})
