import * as DB from '@klicker-uzh/prisma'
import builder from '../builder'
import { checkCronToken } from '../lib/util'
import * as AccountService from '../services/accounts'
import * as CourseService from '../services/courses'
import * as FeedbackService from '../services/feedbacks'
import * as ParticipantGroupService from '../services/groups'
import * as LearningElementService from '../services/learningElements'
import * as MicroLearningService from '../services/microLearning'
import * as NotificationService from '../services/notifications'
import * as ParticipantService from '../services/participants'
import * as QuestionService from '../services/questions'
import * as SessionService from '../services/sessions'
import { Course } from './course'
import {
  GroupActivityDecisionInput,
  GroupActivityDetails,
  GroupActivityInstance,
} from './groupActivity'
import {
  LearningElement,
  LearningElementOrderType,
  QuestionStack,
  StackInput,
} from './learningElements'
import { MicroSession } from './microSession'
import {
  AvatarSettingsInput,
  LeaveCourseParticipation,
  Participant,
  ParticipantGroup,
  ParticipantLearningData,
  Participation,
  SubscriptionObjectInput,
} from './participant'
import {
  AttachmentInput,
  OptionsChoicesInput,
  OptionsFreeTextInput,
  OptionsNumericalInput,
  Question,
  QuestionInstance,
  ResponseInput,
  Tag,
} from './question'
import { QuestionDisplayMode, QuestionType } from './questionData'
import {
  BlockInput,
  ConfusionTimestep,
  Feedback,
  FeedbackResponse,
  Session,
} from './session'
import { User } from './user'

export const Mutation = builder.mutationType({
  fields(t) {
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
      loginUser: t.string({
        nullable: true,
        args: {
          email: t.arg.string({ required: true, validate: { email: true } }),
          password: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.loginUser(args, ctx)
        },
      }),

      changeUserLocale: asUser.field({
        nullable: true,
        type: User,
        args: {
          locale: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.changeUserLocale(args, ctx) as any
        },
      }),

      changeParticipantLocale: asParticipant.field({
        nullable: true,
        type: Participant,
        args: {
          locale: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.changeParticipantLocale(args, ctx)
        },
      }),

      cancelSession: asUser.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.cancelSession(args, ctx)
        },
      }),

      changeCourseColor: asUser.field({
        nullable: true,
        type: Course,
        args: {
          courseId: t.arg.string({ required: true }),
          color: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.changeCourseColor(args, ctx)
        },
      }),

      changeCourseDescription: asUser.field({
        nullable: true,
        type: Course,
        args: {
          courseId: t.arg.string({ required: true }),
          input: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.changeCourseDescription(args, ctx)
        },
      }),

      deleteTag: asUser.field({
        nullable: true,
        type: Tag,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.deleteTag(args, ctx) as any
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
          return FeedbackService.createFeedback(args, ctx) as any
        },
      }),

      deleteFeedback: asUser.field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.deleteFeedback(args, ctx) as any
        },
      }),

      deleteFeedbackResponse: asUser.field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.deleteFeedbackResponse(args, ctx) as any
        },
      }),

      deleteQuestion: asUser.field({
        nullable: true,
        type: Question,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.deleteQuestion(args, ctx) as any
        },
      }),

      editTag: asUser.field({
        nullable: true,
        type: Tag,
        args: {
          id: t.arg.int({ required: true }),
          name: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.editTag(args, ctx) as any
        },
      }),

      joinCourseWithPin: asParticipant.field({
        nullable: true,
        type: Participant,
        args: {
          pin: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.joinCourseWithPin(args, ctx)
        },
      }),

      endSession: asUser.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.endSession(args, ctx)
        },
      }),

      joinParticipantGroup: asParticipant.field({
        nullable: true,
        type: ParticipantGroup,
        args: {
          courseId: t.arg.string({ required: true }),
          code: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantGroupService.joinParticipantGroup(args, ctx)
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
          return FeedbackService.voteFeedbackResponse(args, ctx) as any
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
          return FeedbackService.upvoteFeedback(args, ctx) as any
        },
      }),

      updateParticipantProfile: asParticipant.field({
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
        resolve(_, args, ctx) {
          return ParticipantService.updateParticipantProfile(args, ctx)
        },
      }),

      leaveParticipantGroup: asParticipant.field({
        nullable: true,
        type: ParticipantGroup,
        args: {
          courseId: t.arg.string({ required: true }),
          groupId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantGroupService.leaveParticipantGroup(args, ctx)
        },
      }),

      subscribeToPush: asParticipant.field({
        nullable: true,
        type: Participation,
        args: {
          subscriptionObject: t.arg({
            type: SubscriptionObjectInput,
            required: true,
          }),
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return NotificationService.subscribeToPush(args, ctx)
        },
      }),

      unsubscribeFromPush: asParticipant.boolean({
        nullable: true,
        args: {
          courseId: t.arg.string({ required: true }),
          endpoint: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return NotificationService.unsubscribeFromPush(args, ctx)
        },
      }),

      submitGroupActivityDecisions: asParticipant.field({
        nullable: true,
        type: GroupActivityInstance,
        args: {
          activityInstanceId: t.arg.int({ required: true }),
          decisions: t.arg({
            type: [GroupActivityDecisionInput],
            required: true,
          }),
        },
        resolve(_, args, ctx) {
          return ParticipantGroupService.submitGroupActivityDecisions(args, ctx)
        },
      }),

      startSession: asUser.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.startSession(args, ctx)
        },
      }),

      pinFeedback: asUser.field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          isPinned: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.pinFeedback(args, ctx) as any
        },
      }),

      publishFeedback: asUser.field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          isPublished: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.publishFeedback(args, ctx) as any
        },
      }),

      resolveFeedback: asUser.field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          isResolved: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.resolveFeedback(args, ctx) as any
        },
      }),

      respondToFeedback: asUser.field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          responseContent: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.respondToFeedback(args, ctx) as any
        },
      }),

      logoutUser: asUser.id({
        nullable: true,
        resolve(_, args, ctx) {
          return AccountService.logoutUser(args, ctx)
        },
      }),

      logoutParticipant: asParticipant.id({
        nullable: true,
        resolve(_, args, ctx) {
          return AccountService.logoutParticipant(args, ctx)
        },
      }),

      leaveCourse: asParticipant.field({
        nullable: true,
        type: LeaveCourseParticipation,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.leaveCourse(args, ctx)
        },
      }),

      markMicroSessionCompleted: asParticipant.field({
        nullable: true,
        type: Participation,
        args: {
          id: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.markMicroSessionCompleted(args, ctx)
        },
      }),

      loginUserToken: t.id({
        nullable: true,
        args: {
          email: t.arg.string({ required: true }),
          token: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.loginUserToken(args, ctx)
        },
      }),

      loginParticipant: t.id({
        nullable: true,
        args: {
          username: t.arg.string({ required: true }),
          password: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.loginParticipant(args, ctx)
        },
      }),

      generateLoginToken: asUser.field({
        nullable: true,
        type: User,
        resolve(_, __, ctx) {
          return AccountService.generateLoginToken(ctx) as any
        },
      }),

      deactivateSessionBlock: asUser.field({
        nullable: true,
        type: Session,
        args: {
          sessionId: t.arg.string({ required: true }),
          sessionBlockId: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.deactivateSessionBlock(args, ctx)
        },
      }),

      createParticipantGroup: asParticipant.field({
        nullable: true,
        type: ParticipantGroup,
        args: {
          courseId: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantGroupService.createParticipantGroup(args, ctx)
        },
      }),

      createParticipantAndJoinCourse: t.field({
        nullable: true,
        type: Participant,
        args: {
          username: t.arg.string({ required: true }),
          password: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: true }),
          pin: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.createParticipantAndJoinCourse(args, ctx)
        },
      }),

      changeSessionSettings: asUser.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
          isLiveQAEnabled: t.arg.boolean({ required: false }),
          isConfusionFeedbackEnabled: t.arg.boolean({ required: false }),
          isModerationEnabled: t.arg.boolean({ required: false }),
          isGamificationEnabled: t.arg.boolean({ required: false }),
        },
        resolve(_, args, ctx) {
          return SessionService.changeSessionSettings(args, ctx)
        },
      }),

      addConfusionTimestep: t.field({
        nullable: true,
        type: ConfusionTimestep,
        args: {
          sessionId: t.arg.string({ required: true }),
          difficulty: t.arg.int({ required: true }),
          speed: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.addConfusionTimestep(args, ctx) as any
        },
      }),

      activateSessionBlock: asUser.field({
        nullable: true,
        type: Session,
        args: {
          sessionId: t.arg.string({ required: true }),
          sessionBlockId: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.activateSessionBlock(args, ctx)
        },
      }),

      createSession: asUser.field({
        nullable: true,
        type: Session,
        args: {
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          blocks: t.arg({
            type: [BlockInput],
            required: true,
          }),
          courseId: t.arg.string({ required: false }),
          multiplier: t.arg.int({ required: true }),
          isGamificationEnabled: t.arg.boolean({ required: false }),
        },
        resolve(_, args, ctx) {
          return SessionService.createSession(args, ctx)
        },
      }),

      editSession: asUser.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          blocks: t.arg({
            type: [BlockInput],
            required: true,
          }),
          courseId: t.arg.string({ required: false }),
          multiplier: t.arg.int({ required: true }),
          isGamificationEnabled: t.arg.boolean({ required: false }),
        },
        resolve(_, args, ctx) {
          return SessionService.editSession(args, ctx)
        },
      }),

      createLearningElement: asUser.field({
        nullable: true,
        type: LearningElement,
        args: {
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          stacks: t.arg({
            type: [StackInput],
            required: true,
          }),
          courseId: t.arg.string({ required: false }),
          multiplier: t.arg.int({ required: true }),
          order: t.arg({
            type: LearningElementOrderType,
            required: true,
          }),
          resetTimeDays: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return LearningElementService.manipulateLearningElement(args, ctx)
        },
      }),

      editLearningElement: asUser.field({
        nullable: true,
        type: LearningElement,
        args: {
          id: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          stacks: t.arg({
            type: [StackInput],
            required: true,
          }),
          courseId: t.arg.string({ required: false }),
          multiplier: t.arg.int({ required: true }),
          order: t.arg({
            type: LearningElementOrderType,
            required: true,
          }),
          resetTimeDays: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return LearningElementService.manipulateLearningElement(args, ctx)
        },
      }),

      createMicroSession: asUser.field({
        nullable: true,
        type: MicroSession,
        args: {
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          questions: t.arg.intList({ required: true }),
          courseId: t.arg.string({ required: false }),
          multiplier: t.arg.int({ required: true }),
          startDate: t.arg({ type: 'Date', required: true }),
          endDate: t.arg({ type: 'Date', required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.createMicroSession(args, ctx)
        },
      }),

      editMicroSession: asUser.field({
        nullable: true,
        type: MicroSession,
        args: {
          id: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          questions: t.arg.intList({ required: true }),
          courseId: t.arg.string({ required: false }),
          multiplier: t.arg.int({ required: true }),
          startDate: t.arg({ type: 'Date', required: true }),
          endDate: t.arg({ type: 'Date', required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.editMicroSession(args, ctx)
        },
      }),

      joinCourse: asParticipant.field({
        nullable: true,
        type: ParticipantLearningData,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.joinCourse(args, ctx)
        },
      }),

      registerParticipantFromLTI: t.field({
        nullable: true,
        type: ParticipantLearningData,
        args: {
          courseId: t.arg.string({ required: true }),
          participantId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.registerParticipantFromLTI(args, ctx)
        },
      }),

      respondToQuestionInstance: t.field({
        nullable: true,
        type: QuestionInstance,
        args: {
          courseId: t.arg.string({ required: true }),
          id: t.arg.int({ required: true }),
          response: t.arg({
            type: ResponseInput,
            required: true,
          }),
        },
        resolve: (_, args, ctx) => {
          return LearningElementService.respondToQuestionInstance(args, ctx)
        },
      }),

      startGroupActivity: asParticipant.field({
        nullable: true,
        type: GroupActivityDetails,
        args: {
          activityId: t.arg.string({ required: true }),
          groupId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantGroupService.startGroupActivity(args, ctx)
        },
      }),

      manipulateChoicesQuestion: asUser.prismaField({
        nullable: true,
        type: Question,
        args: {
          id: t.arg.int({ required: false }),
          type: t.arg({ required: true, type: QuestionType }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          displayMode: t.arg({ required: false, type: QuestionDisplayMode }),
          hasSampleSolution: t.arg.boolean({ required: false }),
          hasAnswerFeedbacks: t.arg.boolean({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsChoicesInput,
          }),
          attachments: t.arg({
            type: [AttachmentInput],
          }),
        },
        resolve(_, __, args, ctx) {
          return QuestionService.manipulateQuestion(args as any, ctx) as any
        },
      }),

      manipulateNumericalQuestion: asUser.prismaField({
        nullable: true,
        type: Question,
        args: {
          id: t.arg.int({ required: false }),
          type: t.arg({ required: true, type: QuestionType }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          hasSampleSolution: t.arg.boolean({ required: false }),
          hasAnswerFeedbacks: t.arg.boolean({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsNumericalInput,
          }),
          attachments: t.arg({
            type: [AttachmentInput],
          }),
        },
        resolve(_, __, args, ctx) {
          return QuestionService.manipulateQuestion(args as any, ctx) as any
        },
      }),

      manipulateFreeTextQuestion: asUser.prismaField({
        nullable: true,
        type: Question,
        args: {
          id: t.arg.int({ required: false }),
          type: t.arg({ required: true, type: QuestionType }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          hasSampleSolution: t.arg.boolean({ required: false }),
          hasAnswerFeedbacks: t.arg.boolean({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsFreeTextInput,
          }),
          attachments: t.arg({
            type: [AttachmentInput],
          }),
        },
        resolve(_, __, args, ctx) {
          return QuestionService.manipulateQuestion(args as any, ctx) as any
        },
      }),

      bookmarkQuestion: asParticipant.field({
        nullable: true,
        type: [QuestionStack],
        args: {
          courseId: t.arg.string({ required: true }),
          stackId: t.arg.int({ required: true }),
          bookmarked: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.bookmarkQuestion(args, ctx)
        },
      }),

      flagQuestion: asParticipant.string({
        nullable: true,
        args: {
          questionInstanceId: t.arg.int({ required: true }),
          content: t.arg.string({ required: true }),
        },
        async resolve(_, args, ctx) {
          return ParticipantService.flagQuestion(args, ctx)
        },
      }),

      createCourse: asUser.field({
        nullable: true,
        type: Course,
        args: {
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          color: t.arg.string({ required: false }),
          startDate: t.arg({ type: 'Date', required: true }),
          endDate: t.arg({ type: 'Date', required: true }),
          groupDeadlineDate: t.arg({ type: 'Date', required: false }),
          notificationEmail: t.arg.string({ required: false }),
          isGamificationEnabled: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.createCourse(args, ctx)
        },
      }),

      changeCourseDates: asUser.field({
        nullable: true,
        type: Course,
        args: {
          courseId: t.arg.string({ required: true }),
          startDate: t.arg({ type: 'Date', required: false }),
          endDate: t.arg({ type: 'Date', required: false }),
        },
        resolve(_, args, ctx) {
          return CourseService.changeCourseDates(args, ctx)
        },
      }),

      publishLearningElement: asUser.field({
        nullable: true,
        type: LearningElement,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LearningElementService.publishLearningElement(args, ctx)
        },
      }),

      deleteLearningElement: asUser.field({
        nullable: true,
        type: LearningElement,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return LearningElementService.deleteLearningElement(args, ctx)
        },
      }),

      deleteSession: asUser.field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.deleteSession(args, ctx)
        },
      }),

      publishMicroSession: asUser.field({
        nullable: true,
        type: MicroSession,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.publishMicroSession(args, ctx)
        },
      }),

      deleteMicroSession: asUser.field({
        nullable: true,
        type: MicroSession,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.deleteMicroSession(args, ctx)
        },
      }),

      updateGroupAverageScores: t.boolean({
        resolve(_, __, ctx) {
          checkCronToken(ctx)
          return ParticipantGroupService.updateGroupAverageScores(ctx)
        },
      }),

      sendPushNotifications: t.boolean({
        resolve(_, __, ctx) {
          checkCronToken(ctx)
          return NotificationService.sendPushNotifications(ctx)
        },
      }),
    }
  },
})
