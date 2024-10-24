import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'
import { checkCronToken } from '../lib/util.js'
import * as AccountService from '../services/accounts.js'
import * as CourseService from '../services/courses.js'
import * as FeedbackService from '../services/feedbacks.js'
import * as GroupService from '../services/groups.js'
import * as MicroLearningService from '../services/microLearning.js'
import * as MigrationService from '../services/migration.js'
import * as NotificationService from '../services/notifications.js'
import * as ParticipantService from '../services/participants.js'
import * as PracticeQuizService from '../services/practiceQuizzes.js'
import * as QuestionService from '../services/questions.js'
import * as SessionService from '../services/sessions.js'
import { ElementFeedback } from './analytics.js'
import { Course } from './course.js'
import {
  GroupActivity,
  GroupActivityClueInput,
  GroupActivityDetails,
  GroupActivityGradingInput,
  GroupActivityInstance,
} from './groupActivity.js'
import { MicroLearning } from './microLearning.js'
import {
  AvatarSettingsInput,
  GroupMessage,
  LeaveCourseParticipation,
  Participant,
  ParticipantGroup,
  ParticipantLearningData,
  ParticipantTokenData,
  Participation,
  SubscriptionObjectInput,
} from './participant.js'
import {
  ElementOrderType,
  ElementStackInput,
  PracticeQuiz,
  StackFeedback,
  StackResponseInput,
} from './practiceQuizzes.js'
import {
  ArchivedElement,
  Element,
  OptionsChoicesInput,
  OptionsFreeTextInput,
  OptionsNumericalInput,
  QuestionOrElementInstance,
  Tag,
} from './question.js'
import { ElementStatus, ElementType } from './questionData.js'
import {
  BlockInput,
  ConfusionTimestep,
  Feedback,
  FeedbackResponse,
  Session,
} from './session.js'
import {
  FileUploadSAS,
  LocaleType,
  User,
  UserLogin,
  UserLoginScope,
} from './user.js'

export const Mutation = builder.mutationType({
  fields(t) {
    const asParticipant = { authenticated: true, role: DB.UserRole.PARTICIPANT }
    const asUser = { authenticated: true, role: DB.UserRole.USER }
    const asUserWithCatalyst = { ...asUser, catalyst: true }
    const asUserSessionExec = {
      ...asUser,
      scope: DB.UserLoginScope.SESSION_EXEC,
    }
    const asUserFullAccess = { ...asUser, scope: DB.UserLoginScope.FULL_ACCESS }
    const asUserOwner = { ...asUser, scope: DB.UserLoginScope.ACCOUNT_OWNER }

    return {
      // ----- ANONYMOUS OPERATIONS -----
      // #region
      addConfusionTimestep: t.field({
        nullable: true,
        type: ConfusionTimestep,
        args: {
          sessionId: t.arg.string({ required: true }),
          difficulty: t.arg.int({ required: true }),
          speed: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.addConfusionTimestep(args, ctx)
        },
      }),

      changeParticipantLocale: t.field({
        nullable: true,
        type: Participant,
        args: {
          locale: t.arg({ type: LocaleType, required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.changeParticipantLocale(args, ctx)
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

      loginUserToken: t.id({
        nullable: true,
        args: {
          shortname: t.arg.string({ required: true }),
          token: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.loginUserToken(args, ctx)
        },
      }),

      loginParticipant: t.id({
        nullable: true,
        args: {
          usernameOrEmail: t.arg.string({ required: true }),
          password: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.loginParticipant(args, ctx)
        },
      }),

      loginParticipantMagicLink: t.id({
        nullable: true,
        args: {
          token: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.loginParticipantMagicLink(args, ctx)
        },
      }),

      activateParticipantAccount: t.id({
        nullable: true,
        args: {
          token: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.activateParticipantAccount(args, ctx)
        },
      }),

      sendMagicLink: t.boolean({
        nullable: true,
        args: {
          usernameOrEmail: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          // TODO: at some point we should do rate limiting or similar things here (to prevent spamming)
          return AccountService.sendMagicLink(args, ctx)
        },
      }),

      // createParticipantAndJoinCourse: t.field({
      //   nullable: true,
      //   type: Participant,
      //   args: {
      //     username: t.arg.string({ required: true }),
      //     password: t.arg.string({ required: true }),
      //     courseId: t.arg.string({ required: true }),
      //     pin: t.arg.int({ required: true }),
      //   },
      //   resolve(_, args, ctx) {
      //     return ParticipantService.createParticipantAndJoinCourse(args, ctx)
      //   },
      // }),

      // registerParticipantFromLTI: t.field({
      //   nullable: true,
      //   type: ParticipantLearningData,
      //   args: {
      //     courseId: t.arg.string({ required: true }),
      //     participantId: t.arg.string({ required: true }),
      //     email: t.arg.string({ required: true }),
      //   },
      //   resolve(_, args, ctx) {
      //     return ParticipantService.registerParticipantFromLTI(args, ctx)
      //   },
      // }),

      respondToElementStack: t.field({
        nullable: true,
        type: StackFeedback,
        args: {
          stackId: t.arg.int({ required: true }),
          courseId: t.arg.string({ required: true }),
          responses: t.arg({
            type: [StackResponseInput],
            required: true,
          }),
          stackAnswerTime: t.arg.int({ required: true }),
        },
        resolve: (_, args, ctx) => {
          return PracticeQuizService.respondToElementStack(args, ctx)
        },
      }),

      updateGroupAverageScores: t.boolean({
        resolve(_, __, ctx) {
          checkCronToken(ctx)
          return GroupService.updateGroupAverageScores(ctx)
        },
      }),

      sendPushNotifications: t.boolean({
        resolve(_, __, ctx) {
          checkCronToken(ctx)
          return NotificationService.sendPushNotifications(ctx)
        },
      }),

      publishScheduledActivities: t.boolean({
        resolve(_, __, ctx) {
          checkCronToken(ctx)
          return CourseService.publishScheduledActivities(ctx)
        },
      }),

      createParticipantAccount: t.field({
        nullable: true,
        type: ParticipantTokenData,
        args: {
          username: t.arg.string({
            required: true,
            validate: { minLength: 5, maxLength: 15 },
          }),
          password: t.arg.string({ required: true }),
          email: t.arg.string({ required: true, validate: { email: true } }),
          isProfilePublic: t.arg.boolean({ required: true }),
          courseId: t.arg.string({ required: false }),
          signedLtiData: t.arg.string({ required: false }),
        },
        resolve(_, args, ctx) {
          return AccountService.createParticipantAccount(args, ctx)
        },
      }),

      loginParticipantWithLti: t.field({
        nullable: true,
        type: ParticipantTokenData,
        args: {
          signedLtiData: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: false }),
        },
        resolve(_, args, ctx) {
          return AccountService.loginParticipantWithLti(args, ctx)
        },
      }),
      // #endregion

      // ----- PARTICIPANT OPERATIONS
      // #region
      addMessageToGroup: t.withAuth(asParticipant).field({
        nullable: true,
        type: GroupMessage,
        args: {
          groupId: t.arg.string({ required: true }),
          content: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.addMessageToGroup(args, ctx)
        },
      }),

      joinCourse: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantLearningData,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.joinCourse(args, ctx)
        },
      }),

      startGroupActivity: t.withAuth(asParticipant).field({
        nullable: true,
        type: GroupActivityDetails,
        args: {
          activityId: t.arg.string({ required: true }),
          groupId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.startGroupActivity(args, ctx)
        },
      }),

      joinCourseWithPin: t.withAuth(asParticipant).field({
        nullable: true,
        type: Participant,
        args: {
          pin: t.arg.int({
            required: true,
            validate: { min: 0, max: 999999999 },
          }),
        },
        resolve(_, args, ctx) {
          return CourseService.joinCourseWithPin(args, ctx)
        },
      }),

      runningRandomGroupAssignments: t.boolean({
        resolve(_, __, ctx) {
          checkCronToken(ctx)
          return GroupService.runningRandomGroupAssignments(ctx)
        },
      }),

      finalRandomGroupAssignments: t.boolean({
        resolve(_, __, ctx) {
          checkCronToken(ctx)
          return GroupService.finalRandomGroupAssignments(ctx)
        },
      }),

      manualRandomGroupAssignments: t.withAuth(asUser).field({
        type: Course,
        nullable: true,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.manualRandomGroupAssignments(args, ctx)
        },
      }),

      joinParticipantGroup: t.withAuth(asParticipant).string({
        nullable: true,
        args: {
          courseId: t.arg.string({ required: true }),
          code: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.joinParticipantGroup(args, ctx)
        },
      }),

      updateParticipantProfile: t.withAuth(asParticipant).field({
        nullable: true,
        type: Participant,
        args: {
          isProfilePublic: t.arg.boolean({ required: false }),
          email: t.arg.string({ required: true, validate: { email: true } }),
          username: t.arg.string({
            required: true,
            validate: { minLength: 5, maxLength: 15 },
          }),
          password: t.arg.string({ required: false }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.updateParticipantProfile(args, ctx)
        },
      }),

      updateParticipantAvatar: t.withAuth(asParticipant).field({
        nullable: true,
        type: Participant,
        args: {
          avatar: t.arg.string({ required: true }),
          avatarSettings: t.arg({
            type: AvatarSettingsInput,
            required: true,
          }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.updateParticipantAvatar(args, ctx)
        },
      }),

      leaveParticipantGroup: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantGroup,
        args: {
          courseId: t.arg.string({ required: true }),
          groupId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.leaveParticipantGroup(args, ctx)
        },
      }),

      renameParticipantGroup: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantGroup,
        args: {
          groupId: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.renameParticipantGroup(args, ctx)
        },
      }),

      subscribeToPush: t.withAuth(asParticipant).field({
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

      unsubscribeFromPush: t.withAuth(asParticipant).boolean({
        nullable: true,
        args: {
          courseId: t.arg.string({ required: true }),
          endpoint: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return NotificationService.unsubscribeFromPush(args, ctx)
        },
      }),

      submitGroupActivityDecisions: t.withAuth(asParticipant).field({
        nullable: true,
        type: 'Int',
        args: {
          activityId: t.arg.int({ required: true }),
          responses: t.arg({
            type: [StackResponseInput],
            required: true,
          }),
        },
        resolve(_, args, ctx) {
          return GroupService.submitGroupActivityDecisions(args, ctx)
        },
      }),

      logoutParticipant: t.withAuth(asParticipant).id({
        nullable: true,
        resolve(_, args, ctx) {
          return AccountService.logoutParticipant(args, ctx)
        },
      }),

      leaveCourse: t.withAuth(asParticipant).field({
        nullable: true,
        type: LeaveCourseParticipation,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.leaveCourse(args, ctx)
        },
      }),

      markMicroLearningCompleted: t.withAuth(asParticipant).field({
        nullable: true,
        type: Participation,
        args: {
          id: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MicroLearningService.markMicroLearningCompleted(args, ctx)
        },
      }),

      createParticipantGroup: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantGroup,
        args: {
          courseId: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.createParticipantGroup(args, ctx)
        },
      }),

      joinRandomCourseGroupPool: t.withAuth(asParticipant).boolean({
        nullable: false,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.joinRandomCourseGroupPool(args, ctx)
        },
      }),

      leaveRandomCourseGroupPool: t.withAuth(asParticipant).boolean({
        nullable: false,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return GroupService.leaveRandomCourseGroupPool(args, ctx)
        },
      }),

      bookmarkElementStack: t.withAuth(asParticipant).field({
        nullable: true,
        type: ['Int'],
        args: {
          courseId: t.arg.string({ required: true }),
          stackId: t.arg.int({ required: true }),
          bookmarked: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.bookmarkElementStack(args, ctx)
        },
      }),

      flagElement: t.withAuth(asParticipant).field({
        type: ElementFeedback,
        nullable: true,
        args: {
          elementInstanceId: t.arg.int({ required: true }),
          elementId: t.arg.int({ required: true }),
          content: t.arg.string({ required: true }),
        },
        async resolve(_, args, ctx) {
          return ParticipantService.flagElement(args, ctx)
        },
      }),

      rateElement: t.withAuth(asParticipant).field({
        nullable: true,
        type: ElementFeedback,
        args: {
          elementInstanceId: t.arg.int({ required: true }),
          elementId: t.arg.int({ required: true }),
          rating: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return ParticipantService.rateElement(args, ctx)
        },
      }),

      deleteParticipantAccount: t.withAuth(asParticipant).boolean({
        nullable: true,
        resolve(_, __, ctx) {
          return AccountService.deleteParticipantAccount(ctx)
        },
      }),
      // #endregion

      // ----- USER OPERATIONS -----
      // #region
      changeUserLocale: t.withAuth(asUser).field({
        nullable: true,
        type: User,
        args: {
          locale: t.arg({ type: LocaleType, required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.changeUserLocale(args, ctx)
        },
      }),

      cancelSession: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.cancelSession(args, ctx)
        },
      }),

      enableCourseGamification: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Course,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.enableGamification(args, ctx)
        },
      }),

      deleteCourse: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.deleteCourse(args, ctx)
        },
      }),

      deleteTag: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Tag,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.deleteTag(args, ctx)
        },
      }),

      deleteFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.deleteFeedback(args, ctx)
        },
      }),

      deleteFeedbackResponse: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.deleteFeedbackResponse(args, ctx)
        },
      }),

      deleteQuestion: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.deleteQuestion(args, ctx)
        },
      }),

      editTag: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Tag,
        args: {
          id: t.arg.int({ required: true }),
          name: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.editTag(args, ctx)
        },
      }),

      endSession: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.endSession(args, ctx)
        },
      }),

      startSession: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.startSession(args, ctx)
        },
      }),

      pinFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          isPinned: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.pinFeedback(args, ctx)
        },
      }),

      publishFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          isPublished: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.publishFeedback(args, ctx)
        },
      }),

      resolveFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          isResolved: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.resolveFeedback(args, ctx)
        },
      }),

      respondToFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          responseContent: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.respondToFeedback(args, ctx)
        },
      }),

      logoutUser: t.withAuth(asUser).id({
        nullable: true,
        resolve(_, args, ctx) {
          return AccountService.logoutUser(args, ctx)
        },
      }),

      generateLoginToken: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: User,
        resolve(_, __, ctx) {
          return AccountService.generateLoginToken(ctx)
        },
      }),

      deactivateSessionBlock: t.withAuth(asUserSessionExec).field({
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

      changeSessionSettings: t.withAuth(asUserSessionExec).field({
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

      activateSessionBlock: t.withAuth(asUserSessionExec).field({
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

      createSession: t.withAuth(asUserFullAccess).field({
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
          maxBonusPoints: t.arg.int({ required: true }),
          timeToZeroBonus: t.arg.int({ required: true }),
          isGamificationEnabled: t.arg.boolean({ required: true }),
          isConfusionFeedbackEnabled: t.arg.boolean({ required: true }),
          isLiveQAEnabled: t.arg.boolean({ required: true }),
          isModerationEnabled: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.createSession(args, ctx)
        },
      }),

      editSession: t.withAuth(asUserFullAccess).field({
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
          maxBonusPoints: t.arg.int({ required: true }),
          timeToZeroBonus: t.arg.int({ required: true }),
          isGamificationEnabled: t.arg.boolean({ required: true }),
          isConfusionFeedbackEnabled: t.arg.boolean({ required: true }),
          isLiveQAEnabled: t.arg.boolean({ required: true }),
          isModerationEnabled: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.editSession(args, ctx)
        },
      }),

      manipulateContentElement: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
          status: t.arg({ type: ElementStatus, required: false }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
        },
        resolve(_, args, ctx) {
          return QuestionService.manipulateQuestion(
            { ...args, type: DB.ElementType.CONTENT },
            ctx
          )
        },
      }),

      manipulateFlashcardElement: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
          status: t.arg({ type: ElementStatus, required: false }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
        },
        resolve(_, args, ctx) {
          return QuestionService.manipulateQuestion(
            { ...args, type: DB.ElementType.FLASHCARD },
            ctx
          )
        },
      }),

      manipulateChoicesQuestion: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
          status: t.arg({ type: ElementStatus, required: false }),
          type: t.arg({ required: true, type: ElementType }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsChoicesInput,
          }),
        },
        resolve(_, args, ctx) {
          return QuestionService.manipulateQuestion(args, ctx)
        },
      }),

      manipulateNumericalQuestion: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
          status: t.arg({ type: ElementStatus, required: false }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsNumericalInput,
          }),
        },
        resolve(_, args, ctx) {
          return QuestionService.manipulateQuestion(
            { ...args, type: DB.ElementType.NUMERICAL },
            ctx
          )
        },
      }),

      manipulateFreeTextQuestion: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
          status: t.arg({ type: ElementStatus, required: false }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsFreeTextInput,
          }),
        },
        resolve(_, args, ctx) {
          return QuestionService.manipulateQuestion(
            { ...args, type: DB.ElementType.FREE_TEXT },
            ctx
          )
        },
      }),

      updateQuestionInstances: t.withAuth(asUserFullAccess).field({
        type: [QuestionOrElementInstance],
        args: {
          questionId: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.updateQuestionInstances(args, ctx)
        },
      }),

      createCourse: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Course,
        args: {
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          color: t.arg.string({ required: false }),
          startDate: t.arg({ type: 'Date', required: true }),
          endDate: t.arg({ type: 'Date', required: true }),
          isGroupCreationEnabled: t.arg.boolean({ required: true }),
          groupDeadlineDate: t.arg({ type: 'Date', required: true }),
          maxGroupSize: t.arg.int({ required: true }),
          preferredGroupSize: t.arg.int({ required: true }),
          notificationEmail: t.arg.string({
            required: false,
            validate: { email: true },
          }),
          isGamificationEnabled: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.createCourse(args, ctx)
        },
      }),

      updateCourseSettings: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
          name: t.arg.string({ required: false }),
          displayName: t.arg.string({ required: false }),
          description: t.arg.string({ required: false }),
          color: t.arg.string({ required: false }),
          startDate: t.arg({ type: 'Date', required: false }),
          endDate: t.arg({ type: 'Date', required: false }),
          isGroupCreationEnabled: t.arg.boolean({ required: false }),
          groupDeadlineDate: t.arg({ type: 'Date', required: false }),
          notificationEmail: t.arg.string({
            required: false,
            validate: { email: false },
          }),
          isGamificationEnabled: t.arg.boolean({ required: false }),
        },
        resolve(_, args, ctx) {
          return CourseService.updateCourseSettings(args, ctx)
        },
      }),

      toggleArchiveCourse: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
          isArchived: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return CourseService.toggleArchiveCourse(args, ctx)
        },
      }),

      toggleIsArchived: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: [ArchivedElement],
        args: {
          questionIds: t.arg.intList({ required: true }),
          isArchived: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.toggleIsArchived(args, ctx)
        },
      }),

      updateTagOrdering: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: [Tag],
        args: {
          originIx: t.arg.int({ required: true }),
          targetIx: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.updateTagOrdering(args, ctx)
        },
      }),

      deleteLiveQuiz: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.deleteLiveQuiz(args, ctx)
        },
      }),

      changeLiveQuizName: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.changeLiveQuizName(args, ctx)
        },
      }),

      getFileUploadSas: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: FileUploadSAS,
        args: {
          fileName: t.arg.string({ required: true }),
          contentType: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.getFileUploadSas(args, ctx)
        },
      }),

      changeShortname: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: User,
        args: {
          shortname: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.changeShortname(args, ctx)
        },
      }),

      changeEmailSettings: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: User,
        args: {
          projectUpdates: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.changeEmailSettings(args, ctx)
        },
      }),

      changeInitialSettings: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: User,
        args: {
          shortname: t.arg.string({ required: true }),
          locale: t.arg({ type: LocaleType, required: true }),
          sendUpdates: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.changeInitialSettings(args, ctx)
        },
      }),
      // #endregion

      // ----- USER WITH CATALYST -----
      // #region
      createPracticeQuiz: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: PracticeQuiz,
          args: {
            name: t.arg.string({ required: true }),
            displayName: t.arg.string({ required: true }),
            description: t.arg.string({ required: false }),
            stacks: t.arg({
              type: [ElementStackInput],
              required: true,
            }),
            courseId: t.arg.string({ required: true }),
            multiplier: t.arg.int({ required: true }),
            order: t.arg({
              type: ElementOrderType,
              required: true,
            }),
            availableFrom: t.arg({ type: 'Date', required: false }),
            resetTimeDays: t.arg.int({ required: true }),
          },
          resolve(_, args, ctx) {
            return PracticeQuizService.manipulatePracticeQuiz(args, ctx)
          },
        }),

      editPracticeQuiz: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: PracticeQuiz,
          args: {
            id: t.arg.string({ required: true }),
            name: t.arg.string({ required: true }),
            displayName: t.arg.string({ required: true }),
            description: t.arg.string({ required: false }),
            stacks: t.arg({
              type: [ElementStackInput],
              required: true,
            }),
            courseId: t.arg.string({ required: true }),
            multiplier: t.arg.int({ required: true }),
            order: t.arg({
              type: ElementOrderType,
              required: true,
            }),
            availableFrom: t.arg({ type: 'Date', required: false }),
            resetTimeDays: t.arg.int({ required: true }),
          },
          resolve(_, args, ctx) {
            return PracticeQuizService.manipulatePracticeQuiz(args, ctx)
          },
        }),

      createMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: {
            name: t.arg.string({ required: true }),
            displayName: t.arg.string({ required: true }),
            description: t.arg.string({ required: false }),
            stacks: t.arg({ required: true, type: [ElementStackInput] }),
            courseId: t.arg.string({ required: true }),
            multiplier: t.arg.int({ required: true }),
            startDate: t.arg({ type: 'Date', required: true }),
            endDate: t.arg({ type: 'Date', required: true }),
          },
          resolve(_, args, ctx) {
            return MicroLearningService.manipulateMicroLearning(args, ctx)
          },
        }),

      editMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: {
            id: t.arg.string({ required: true }),
            name: t.arg.string({ required: true }),
            displayName: t.arg.string({ required: true }),
            description: t.arg.string({ required: false }),
            stacks: t.arg({ required: true, type: [ElementStackInput] }),
            courseId: t.arg.string({ required: true }),
            multiplier: t.arg.int({ required: true }),
            startDate: t.arg({ type: 'Date', required: true }),
            endDate: t.arg({ type: 'Date', required: true }),
          },
          resolve(_, args, ctx) {
            return MicroLearningService.manipulateMicroLearning(args, ctx)
          },
        }),

      extendMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: {
            id: t.arg.string({ required: true }),
            endDate: t.arg({ type: 'Date', required: true }),
          },
          resolve(_, args, ctx) {
            return MicroLearningService.extendMicroLearning(args, ctx)
          },
        }),

      endMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return MicroLearningService.endMicroLearning(args, ctx)
          },
        }),

      createGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: {
            name: t.arg.string({ required: true }),
            displayName: t.arg.string({ required: true }),
            description: t.arg.string({ required: false }),
            courseId: t.arg.string({ required: true }),
            multiplier: t.arg.int({ required: true }),
            startDate: t.arg({ type: 'Date', required: true }),
            endDate: t.arg({ type: 'Date', required: true }),
            clues: t.arg({ required: true, type: [GroupActivityClueInput] }),
            stack: t.arg({ required: true, type: ElementStackInput }),
          },
          resolve(_, args, ctx) {
            return GroupService.manipulateGroupActivity(args, ctx)
          },
        }),

      editGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: {
            id: t.arg.string({ required: true }),
            name: t.arg.string({ required: true }),
            displayName: t.arg.string({ required: true }),
            description: t.arg.string({ required: false }),
            courseId: t.arg.string({ required: true }),
            multiplier: t.arg.int({ required: true }),
            startDate: t.arg({ type: 'Date', required: true }),
            endDate: t.arg({ type: 'Date', required: true }),
            clues: t.arg({ required: true, type: [GroupActivityClueInput] }),
            stack: t.arg({ required: true, type: ElementStackInput }),
          },
          resolve(_, args, ctx) {
            return GroupService.manipulateGroupActivity(args, ctx)
          },
        }),

      extendGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: {
            id: t.arg.string({ required: true }),
            endDate: t.arg({ type: 'Date', required: true }),
          },
          resolve(_, args, ctx) {
            return GroupService.extendGroupActivity(args, ctx)
          },
        }),

      publishPracticeQuiz: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: PracticeQuiz,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return PracticeQuizService.publishPracticeQuiz(args, ctx)
          },
        }),

      publishMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return MicroLearningService.publishMicroLearning(args, ctx)
          },
        }),

      unpublishPracticeQuiz: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: PracticeQuiz,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return PracticeQuizService.unpublishPracticeQuiz(args, ctx)
          },
        }),

      unpublishMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return MicroLearningService.unpublishMicroLearning(args, ctx)
          },
        }),

      // TODO: delete operations only as owner?
      deletePracticeQuiz: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: PracticeQuiz,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return PracticeQuizService.deletePracticeQuiz(args, ctx)
          },
        }),
      deleteMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return MicroLearningService.deleteMicroLearning(args, ctx)
          },
        }),

      publishGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return GroupService.publishGroupActivity(args, ctx)
          },
        }),

      unpublishGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return GroupService.unpublishGroupActivity(args, ctx)
          },
        }),

      openGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return GroupService.openGroupActivity(args, ctx)
          },
        }),

      endGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return GroupService.endGroupActivity(args, ctx)
          },
        }),

      deleteGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return GroupService.deleteGroupActivity(args, ctx)
          },
        }),

      gradeGroupActivitySubmission: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivityInstance,
          args: {
            id: t.arg.int({ required: true }),
            gradingDecisions: t.arg({
              type: GroupActivityGradingInput,
              required: true,
            }),
          },
          resolve(_, args, ctx) {
            return GroupService.gradeGroupActivitySubmission(args, ctx)
          },
        }),

      finalizeGroupActivityGrading: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return GroupService.finalizeGroupActivityGrading(args, ctx)
          },
        }),

      // #endregion

      // ----- USER OWNER OPERATIONS -----
      // #region
      requestMigrationToken: t.withAuth(asUserOwner).boolean({
        nullable: true,
        args: {
          email: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MigrationService.requestMigrationToken(args, ctx)
        },
      }),

      triggerMigration: t.withAuth(asUserOwner).boolean({
        nullable: true,
        args: {
          token: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return MigrationService.triggerMigration(args, ctx)
        },
      }),

      createUserLogin: t.withAuth(asUserOwner).field({
        nullable: true,
        type: UserLogin,
        args: {
          password: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
          scope: t.arg({ type: UserLoginScope, required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.createUserLogin(args, ctx)
        },
      }),

      deleteUserLogin: t.withAuth(asUserOwner).field({
        nullable: true,
        type: UserLogin,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.deleteUserLogin(args, ctx)
        },
      }),

      // #endregion
    }
  },
})
