import { UserRole } from '@klicker-uzh/prisma'
import builder from '../builder'
import * as AccountService from '../services/accounts'
import * as CourseService from '../services/courses'
import * as FeedbackService from '../services/feedbacks'
import * as GroupService from '../services/groups'
import * as NotificationService from '../services/notifications'
import * as ParticipantService from '../services/participants'
import * as QuestionService from '../services/questions'
import * as SessionService from '../services/sessions'
import { Course } from './course'
import {
  GroupActivityDecisionInput,
  GroupActivityDetails,
} from './groupActivity'
import {
  AvatarSettingsInput,
  Participant,
  Participation,
  SubscriptionObjectInput,
} from './participant'
import { Tag } from './question'
import { Feedback, FeedbackResponse, Session } from './session'

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
    voteFeedbackResponse: t.field({
      nullable: true,
      type: FeedbackResponse,
      args: {
        id: t.arg.int({ required: true }),
        incrementUpvote: t.arg.int({ required: true }),
        incrementDownvote: t.arg.int({ required: true }),
      },
      resolve(_, args, ctx) {
        return FeedbackService.voteFeedbackResponse(args, ctx)
      },
    }),
    upvoteFeedback: t.field({
      nullable: true,
      type: Feedback,
      args: {
        feedbackId: t.arg.int({ required: true }),
        increment: t.arg.int({ required: true }),
      },
      resolve(_, args, ctx) {
        return FeedbackService.upvoteFeedback(args, ctx)
      },
    }),
    updateParticipantProfile: t.field({
      nullable: true,
      type: Participant,
      args: {
        username: t.arg.string({ required: false }),
        avatar: t.arg.string({ required: false }),
        password: t.arg.string({ required: false }),
        avatarSettings: t.arg({
          type: AvatarSettingsInput,
          required: false,
        }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.PARTICIPANT,
      },
      resolve(_, args, ctx) {
        return ParticipantService.updateParticipantProfile(args, ctx)
      },
    }),
    subscribeToPush: t.field({
      nullable: true,
      type: Participation,
      args: {
        subscriptionObject: t.arg({
          type: SubscriptionObjectInput,
          required: true,
        }),
        courseId: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.PARTICIPANT,
      },
      resolve(_, args, ctx) {
        return NotificationService.subscribeToPush(args, ctx)
      },
    }),
    submitGroupActivityDecisions: t.field({
      nullable: true,
      type: GroupActivityDetails,
      args: {
        activityInstanceId: t.arg.int({ required: true }),
        decisions: t.arg({
          type: [GroupActivityDecisionInput],
          required: true,
        }),
      },
      authScopes: {
        authenticated: true,
        role: UserRole.PARTICIPANT,
      },
      resolve(_, args, ctx) {
        return GroupService.submitGroupActivityDecisions(args, ctx)
      },
    }),
  }),
})
