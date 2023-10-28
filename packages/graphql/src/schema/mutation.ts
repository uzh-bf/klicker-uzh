import * as DB from '@klicker-uzh/prisma'
import builder from '../builder.js'
import { checkCronToken } from '../lib/util.js'
import * as AccountService from '../services/accounts.js'
import * as CourseService from '../services/courses.js'
import * as FeedbackService from '../services/feedbacks.js'
import * as ParticipantGroupService from '../services/groups.js'
import * as LearningElementService from '../services/learningElements.js'
import * as MicroLearningService from '../services/microLearning.js'
import * as MigrationService from '../services/migration.js'
import * as NotificationService from '../services/notifications.js'
import * as ParticipantService from '../services/participants.js'
import * as PracticeQuizService from '../services/practiceQuizzes.js'
import * as QuestionService from '../services/questions.js'
import * as SessionService from '../services/sessions.js'
import { Course } from './course.js'
import {
  GroupActivityDecisionInput,
  GroupActivityDetails,
  GroupActivityInstance,
} from './groupActivity.js'
import {
  LearningElement,
  LearningElementOrderType,
  QuestionStack,
  StackInput,
} from './learningElements.js'
import { MicroSession } from './microSession.js'
import {
  AvatarSettingsInput,
  LeaveCourseParticipation,
  Participant,
  ParticipantGroup,
  ParticipantLearningData,
  ParticipantTokenData,
  Participation,
  SubscriptionObjectInput,
} from './participant.js'
import {
  Element,
  OptionsChoicesInput,
  OptionsFreeTextInput,
  OptionsNumericalInput,
  QuestionInstance,
  ResponseInput,
  Tag,
} from './question.js'
import { ElementType } from './questionData.js'
import {
  BlockInput,
  ConfusionTimestep,
  Feedback,
  FeedbackResponse,
  QuestionResponse,
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
          return FeedbackService.addConfusionTimestep(args, ctx) as any
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
          return FeedbackService.createFeedback(args, ctx) as any
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

      loginUserToken: t.id({
        nullable: true,
        args: {
          email: t.arg.string({ required: true, validate: { email: true } }),
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

      respondToFlashcardInstance: t.field({
        nullable: true,
        type: QuestionResponse,
        args: {
          id: t.arg.int({ required: true }),
          courseId: t.arg.string({ required: true }),
          correctness: t.arg.int({
            required: true,
          }),
        },
        resolve: (_, args, ctx) => {
          return PracticeQuizService.respondToFlashcardInstance(args, ctx)
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
        },
        resolve(_, args, ctx) {
          return AccountService.loginParticipantWithLti(args, ctx)
        },
      }),
      // #endregion

      // ----- PARTICIPANT OPERATIONS
      // #region
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
          return ParticipantGroupService.startGroupActivity(args, ctx)
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

      joinParticipantGroup: t.withAuth(asParticipant).field({
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

      updateParticipantProfile: t.withAuth(asParticipant).field({
        nullable: true,
        type: Participant,
        args: {
          isProfilePublic: t.arg.boolean({ required: false }),
          email: t.arg.string({ required: false, validate: { email: true } }),
          username: t.arg.string({
            required: false,
            validate: { minLength: 5, maxLength: 15 },
          }),
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

      leaveParticipantGroup: t.withAuth(asParticipant).field({
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

      markMicroSessionCompleted: t.withAuth(asParticipant).field({
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

      createParticipantGroup: t.withAuth(asParticipant).field({
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

      bookmarkQuestion: t.withAuth(asParticipant).field({
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

      flagQuestion: t.withAuth(asParticipant).string({
        nullable: true,
        args: {
          questionInstanceId: t.arg.int({ required: true }),
          content: t.arg.string({ required: true }),
        },
        async resolve(_, args, ctx) {
          return ParticipantService.flagQuestion(args, ctx)
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
          return AccountService.changeUserLocale(args, ctx) as any
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

      changeCourseColor: t.withAuth(asUserFullAccess).field({
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

      changeCourseDescription: t.withAuth(asUserFullAccess).field({
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

      deleteTag: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Tag,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.deleteTag(args, ctx) as any
        },
      }),

      deleteFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.deleteFeedback(args, ctx) as any
        },
      }),

      deleteFeedbackResponse: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return FeedbackService.deleteFeedbackResponse(args, ctx) as any
        },
      }),

      deleteQuestion: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: true }),
        },
        resolve(_, args, ctx) {
          return QuestionService.deleteQuestion(args, ctx) as any
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
          return QuestionService.editTag(args, ctx) as any
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
          return FeedbackService.pinFeedback(args, ctx) as any
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
          return FeedbackService.publishFeedback(args, ctx) as any
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
          return FeedbackService.resolveFeedback(args, ctx) as any
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
          return FeedbackService.respondToFeedback(args, ctx) as any
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
          return AccountService.generateLoginToken(ctx) as any
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
          isGamificationEnabled: t.arg.boolean({ required: true }),
          isConfusionFeedbackEnabled: t.arg.boolean({ required: true }),
          isLiveQAEnabled: t.arg.boolean({ required: true }),
          isModerationEnabled: t.arg.boolean({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.editSession(args, ctx)
        },
      }),

      manipulateChoicesQuestion: t.withAuth(asUserFullAccess).prismaField({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
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
        resolve(_, __, args, ctx) {
          return QuestionService.manipulateQuestion(args as any, ctx) as any
        },
      }),

      manipulateNumericalQuestion: t.withAuth(asUserFullAccess).prismaField({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
          type: t.arg({ required: true, type: ElementType }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsNumericalInput,
          }),
        },
        resolve(_, __, args, ctx) {
          return QuestionService.manipulateQuestion(args as any, ctx) as any
        },
      }),

      manipulateFreeTextQuestion: t.withAuth(asUserFullAccess).prismaField({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
          type: t.arg({ required: true, type: ElementType }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsFreeTextInput,
          }),
        },
        resolve(_, __, args, ctx) {
          return QuestionService.manipulateQuestion(args as any, ctx) as any
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
          groupDeadlineDate: t.arg({ type: 'Date', required: false }),
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

      changeCourseDates: t.withAuth(asUserFullAccess).field({
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

      toggleIsArchived: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: [Element],
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

      deleteSession: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Session,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return SessionService.deleteSession(args, ctx)
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
          return AccountService.changeShortname(args, ctx) as any
        },
      }),

      changeInitialSettings: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: User,
        args: {
          shortname: t.arg.string({ required: true }),
          locale: t.arg({ type: LocaleType, required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.changeInitialSettings(args, ctx) as any
        },
      }),
      // #endregion

      // ----- USER WITH CATALYST -----
      // #region
      createLearningElement: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
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

      editLearningElement: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
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

      createMicroSession: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
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

      editMicroSession: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
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

      publishLearningElement: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: LearningElement,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return LearningElementService.publishLearningElement(args, ctx)
          },
        }),

      publishMicroSession: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroSession,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return MicroLearningService.publishMicroSession(args, ctx)
          },
        }),

      unpublishMicroSession: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroSession,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return MicroLearningService.unpublishMicroSession(args, ctx)
          },
        }),

      // TODO: delete operations only as owner?
      deleteLearningElement: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: LearningElement,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return LearningElementService.deleteLearningElement(args, ctx)
          },
        }),
      deleteMicroSession: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroSession,
          args: {
            id: t.arg.string({ required: true }),
          },
          resolve(_, args, ctx) {
            return MicroLearningService.deleteMicroSession(args, ctx)
          },
        }),
      // #endregion

      // ----- USER OWNER OPERATIONS -----
      // #region
      requestMigrationToken: t.withAuth(asUserOwner).boolean({
        nullable: true,
        args: {
          email: t.arg.string({ required: true, validate: { email: true } }),
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
          return AccountService.createUserLogin(args, ctx) as any
        },
      }),

      deleteUserLogin: t.withAuth(asUserOwner).field({
        nullable: true,
        type: UserLogin,
        args: {
          id: t.arg.string({ required: true }),
        },
        resolve(_, args, ctx) {
          return AccountService.deleteUserLogin(args, ctx) as any
        },
      }),

      // #endregion
    }
  },
})
