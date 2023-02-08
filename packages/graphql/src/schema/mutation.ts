import { UserRole } from '@klicker-uzh/prisma'
import builder from '../builder'
import * as AccountService from '../services/accounts'
import * as CourseService from '../services/courses'
import * as FeedbackService from '../services/feedbacks'
import * as ParticipantGroupService from '../services/groups'
import * as QuestionService from '../services/questions'
import * as SessionService from '../services/sessions'
import { Course } from './course'
import { Participant, ParticipantGroup } from './participant'
import { Question, Tag } from './question'
import { Feedback, Session } from './session'

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
    createFeedback: t.field({
      nullable: true,
      type: Feedback,
      args: {
        sessionId: t.arg.string({ required: true }),
        content: t.arg.string({ required: true }),
      },
      resolve(_, args, ctx) {
        return FeedbackService.createFeedback(args, ctx)
      },
    }),
    deleteFeedback: t.field({
      nullable: true,
      type: Feedback,
      args: {
        id: t.arg.int({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.USER,
      },
      resolve(_, args, ctx) {
        return FeedbackService.deleteFeedback(args, ctx)
      },
    }),
    deleteFeedbackResponse: t.field({
      nullable: true,
      type: Feedback,
      args: {
        id: t.arg.int({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.USER,
      },
      resolve(_, args, ctx) {
        return FeedbackService.deleteFeedbackResponse(args, ctx)
      },
    }),
    deleteQuestion: t.field({
      nullable: true,
      type: Question,
      args: {
        id: t.arg.int({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.USER,
      },
      resolve(_, args, ctx) {
        return QuestionService.deleteQuestion(args, ctx)
      },
    }),
    editTag: t.field({
      nullable: true,
      type: Tag,
      args: {
        id: t.arg.int({ required: true }),
        name: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.USER,
      },
      resolve(_, args, ctx) {
        return QuestionService.editTag(args, ctx)
      },
    }),
    joinCourseWithPin: t.field({
      nullable: true,
      type: Participant,
      args: {
        courseId: t.arg.string({ required: true }),
        pin: t.arg.int({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.USER,
      },
      resolve(_, args, ctx) {
        return CourseService.joinCourseWithPin(args, ctx)
      },
    }),
    endSession: t.field({
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
        return SessionService.endSession(args, ctx)
      },
    }),
    joinParticipantGroup: t.field({
      nullable: true,
      type: ParticipantGroup,
      args: {
        courseId: t.arg.string({ required: true }),
        code: t.arg.int({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.PARTICIPANT,
      },
      resolve(_, args, ctx) {
        return ParticipantGroupService.joinParticipantGroup(args, ctx)
      },
    }),
    leaveParticipantGroup: t.field({
      nullable: true,
      type: ParticipantGroup,
      args: {
        courseId: t.arg.string({ required: true }),
        groupId: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.PARTICIPANT,
      },
      resolve(_, args, ctx) {
        return ParticipantGroupService.leaveParticipantGroup(args, ctx)
      },
    }),
  }),
})
