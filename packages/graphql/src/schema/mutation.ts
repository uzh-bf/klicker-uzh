import * as DB from '@klicker-uzh/prisma/client'
import { ActivityType as ActivityTypeEnum } from '@klicker-uzh/types'
import { MISSING_CATALOG_COLLECTION_ID } from '@klicker-uzh/util'
import builder from '../builder.js'
import * as AccountService from '../services/accounts.js'
import * as ActivitiesService from '../services/activities.js'
import * as ChatbotsService from '../services/chatbots.js'
import * as CourseService from '../services/courses.js'
import * as ElementService from '../services/elements.js'
import * as FeedbackService from '../services/feedbacks.js'
import * as GroupService from '../services/groups.js'
import * as KnowledgeService from '../services/knowledge.js'
import * as LiveQuizService from '../services/liveQuizzes.js'
import * as MicroLearningService from '../services/microLearning.js'
import * as NotificationService from '../services/notifications.js'
import * as ParticipantService from '../services/participants.js'
import * as PracticeQuizService from '../services/practiceQuizzes.js'
import * as ResourcesService from '../services/resources.js'
import * as SharingService from '../services/sharing.js'
import * as StacksService from '../services/stacks.js'
import * as TemplateService from '../services/templates.js'
import { ActivityInfo } from './activities.js'
import { ActivityType, ElementFeedback } from './analytics.js'
import { PointCorrection, PointCorrectionType } from './assessment.js'
import { Course } from './course.js'
import {
  Element,
  ElementInstance,
  OptionsCaseStudyInput,
  OptionsChoicesInput,
  OptionsFreeTextInput,
  OptionsNumericalInput,
  OptionsSelectionInput,
  Tag,
  TemplateBlockInput,
} from './element.js'
import { ElementStatus, ElementType } from './elementData.js'
import {
  GroupActivity,
  GroupActivityClueInput,
  GroupActivityDetails,
  GroupActivityGradingInput,
  GroupActivityInstance,
} from './groupActivity.js'
import {
  KBGraphQualityTier,
  KBKnowledgeGraphConfigType,
} from './kbKnowledgeGraph.js'
import { KB, KBChatbotBinding, KBFileUpload, KBResource } from './knowledge.js'
import {
  ConfusionTimestep,
  Feedback,
  FeedbackResponse,
  LiveQuiz,
  LiveQuizMeta,
} from './liveQuiz.js'
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
  ElementBlockInput,
  ElementOrderType,
  ElementStackInput,
  PracticeQuiz,
  ReviewStatus,
  StackFeedback,
  StackResponseInput,
} from './practiceQuiz.js'
import {
  AnswerCollection,
  AnswerCollectionEntry,
  Chatbot,
  ChatbotReasoningConfigInput,
} from './resource.js'
import {
  ActivityLogEntry,
  CatalogCollection,
  CatalogObject,
  ObjectAccess,
  ObjectType,
  PermissionInfo,
  PermissionLevel,
  UserGroup,
  UserGroupMembersInput,
} from './sharing.js'
import {
  FileUploadSAS,
  LocaleType,
  User,
  UserInfo,
  UserLogin,
  UserLoginScope,
} from './user.js'

// shorthand for frequently accessed functions
const checkAccess = SharingService.checkAccess
const withPermission = SharingService.withPermission

export const Mutation = builder.mutationType({
  fields(t) {
    const asParticipant = { authenticated: true, role: DB.UserRole.PARTICIPANT }
    const asTemporaryParticipant = {
      authenticated: true,
      role: DB.UserRole.TEMPORARY_PARTICIPANT,
    }
    const asUser = { authenticated: true, role: DB.UserRole.USER }
    const asAdmin = { authenticated: true, role: DB.UserRole.ADMIN }
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
          quizId: t.arg.string({ required: true }),
          difficulty: t.arg.int({ required: true }),
          speed: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await FeedbackService.addConfusionTimestep(args, ctx)
        },
      }),

      changeParticipantLocale: t.field({
        nullable: true,
        type: Participant,
        args: { locale: t.arg({ type: LocaleType, required: true }) },
        resolve: async (_, args, ctx) => {
          return await AccountService.changeParticipantLocale(args, ctx)
        },
      }),

      createFeedback: t.field({
        nullable: true,
        type: Feedback,
        args: {
          quizId: t.arg.string({ required: true }),
          content: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await FeedbackService.createFeedback(args, ctx)
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
        resolve: async (_, args, ctx) => {
          return await FeedbackService.voteFeedbackResponse(args, ctx)
        },
      }),

      upvoteFeedback: t.field({
        nullable: true,
        type: Feedback,
        args: {
          feedbackId: t.arg.int({ required: true }),
          increment: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await FeedbackService.upvoteFeedback(args, ctx)
        },
      }),

      loginParticipant: t.id({
        nullable: true,
        args: {
          usernameOrEmail: t.arg.string({ required: true }),
          password: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await AccountService.loginParticipant(args, ctx)
        },
      }),

      loginTemporaryParticipant: t.id({
        nullable: true,
        args: {
          liveQuizId: t.arg.string({ required: true }),
          pseudonym: t.arg.string({ required: true }),
          avatar: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await AccountService.loginTemporaryParticipant(args, ctx)
        },
      }),

      loginParticipantMagicLink: t.id({
        nullable: true,
        args: { token: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await AccountService.loginParticipantMagicLink(args, ctx)
        },
      }),

      activateParticipantAccount: t.id({
        nullable: true,
        args: { token: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await AccountService.activateParticipantAccount(args, ctx)
        },
      }),

      sendMagicLink: t.boolean({
        nullable: true,
        args: { usernameOrEmail: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
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
      //   resolve: async(_, args, ctx) => {
      //     return await  ParticipantService.createParticipantAndJoinCourse(args, ctx)
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
      //   resolve: async(_, args, ctx) => {
      //     return await  ParticipantService.registerParticipantFromLTI(args, ctx)
      //   },
      // }),

      setLiveQuizPin: t.field({
        nullable: false,
        type: 'Boolean',
        args: {
          liveQuizId: t.arg.string({ required: true }),
          pin: t.arg.string({
            required: true,
            validate: { minLength: 6, maxLength: 6, regex: /^[A-Z0-9]+$/ },
          }),
        },
        resolve: async (_, args, ctx) => {
          return await LiveQuizService.setLiveQuizPinCookie(args, ctx)
        },
      }),

      respondToElementStack: t.field({
        nullable: true,
        type: StackFeedback,
        args: {
          isOwner: t.arg.boolean({ required: true }),
          stackId: t.arg.int({ required: true }),
          courseId: t.arg.string({ required: true }),
          responses: t.arg({ type: [StackResponseInput], required: true }),
          stackAnswerTime: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await StacksService.respondToElementStack(args, ctx)
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
        resolve: async (_, args, ctx) => {
          return await AccountService.createParticipantAccount(args, ctx)
        },
      }),

      loginParticipantWithLti: t.field({
        nullable: true,
        type: ParticipantTokenData,
        args: {
          signedLtiData: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await AccountService.loginParticipantWithLti(args, ctx)
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
        resolve: async (_, args, ctx) => {
          return await GroupService.addMessageToGroup(args, ctx)
        },
      }),

      ensureParticipation: t.withAuth(asParticipant).boolean({
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.ensureParticipation(args, ctx)
        },
      }),

      joinCourseLeaderboard: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantLearningData,
        args: {
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.joinCourseLeaderboard(args, ctx)
        },
      }),

      startGroupActivity: t.withAuth(asParticipant).field({
        nullable: true,
        type: GroupActivityDetails,
        args: {
          activityId: t.arg.string({ required: true }),
          groupId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await GroupService.startGroupActivity(args, ctx)
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
        resolve: async (_, args, ctx) => {
          return await CourseService.joinCourseWithPin(args, ctx)
        },
      }),

      manualRandomGroupAssignments: t.withAuth(asUser).field({
        type: [ParticipantGroup],
        nullable: true,
        args: { courseId: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await GroupService.manualRandomGroupAssignments(args, ctx)
          }
        ),
      }),

      joinParticipantGroup: t.withAuth(asParticipant).string({
        nullable: true,
        args: {
          courseId: t.arg.string({ required: true }),
          code: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await GroupService.joinParticipantGroup(args, ctx)
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
        resolve: async (_, args, ctx) => {
          return await ParticipantService.updateParticipantProfile(args, ctx)
        },
      }),

      updateParticipantAvatar: t.withAuth(asParticipant).field({
        nullable: true,
        type: Participant,
        args: {
          avatar: t.arg.string({ required: true }),
          avatarSettings: t.arg({ type: AvatarSettingsInput, required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ParticipantService.updateParticipantAvatar(args, ctx)
        },
      }),

      leaveParticipantGroup: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantGroup,
        args: {
          courseId: t.arg.string({ required: true }),
          groupId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await GroupService.leaveParticipantGroup(args, ctx)
        },
      }),

      renameParticipantGroup: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantGroup,
        args: {
          groupId: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await GroupService.renameParticipantGroup(args, ctx)
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
        resolve: async (_, args, ctx) => {
          return await NotificationService.subscribeToPush(args, ctx)
        },
      }),

      unsubscribeFromPush: t.withAuth(asParticipant).boolean({
        nullable: true,
        args: {
          courseId: t.arg.string({ required: true }),
          endpoint: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await NotificationService.unsubscribeFromPush(args, ctx)
        },
      }),

      submitGroupActivityDecisions: t.withAuth(asParticipant).field({
        nullable: true,
        type: 'Int',
        args: {
          activityId: t.arg.int({ required: true }),
          responses: t.arg({ type: [StackResponseInput], required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await GroupService.submitGroupActivityDecisions(args, ctx)
        },
      }),

      logoutParticipant: t.withAuth(asParticipant).id({
        nullable: true,
        resolve: async (_, __, ctx) => {
          return await AccountService.logoutParticipant(ctx)
        },
      }),

      logoutTemporaryParticipant: t.withAuth(asTemporaryParticipant).boolean({
        nullable: true,
        args: { liveQuizId: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await AccountService.logoutTemporaryParticipant(args, ctx)
        },
      }),

      leaveCourseLeaderboard: t.withAuth(asParticipant).field({
        nullable: true,
        type: LeaveCourseParticipation,
        args: { courseId: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await CourseService.leaveCourseLeaderboard(args, ctx)
        },
      }),

      markMicroLearningCompleted: t.withAuth(asParticipant).field({
        nullable: true,
        type: Participation,
        args: {
          id: t.arg.string({ required: true }),
          courseId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await MicroLearningService.markMicroLearningCompleted(
            args,
            ctx
          )
        },
      }),

      createParticipantGroup: t.withAuth(asParticipant).field({
        nullable: true,
        type: ParticipantGroup,
        args: {
          courseId: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await GroupService.createParticipantGroup(args, ctx)
        },
      }),

      joinRandomCourseGroupPool: t.withAuth(asParticipant).boolean({
        nullable: false,
        args: { courseId: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await GroupService.joinRandomCourseGroupPool(args, ctx)
        },
      }),

      leaveRandomCourseGroupPool: t.withAuth(asParticipant).boolean({
        nullable: false,
        args: { courseId: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await GroupService.leaveRandomCourseGroupPool(args, ctx)
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
        resolve: async (_, args, ctx) => {
          return await ParticipantService.bookmarkElementStack(args, ctx)
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
        resolve: async (_, args, ctx) => {
          return await ParticipantService.flagElement(args, ctx)
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
        resolve: async (_, args, ctx) => {
          return await ParticipantService.rateElement(args, ctx)
        },
      }),

      deleteParticipantAccount: t.withAuth(asParticipant).boolean({
        nullable: true,
        resolve: async (_, __, ctx) => {
          return await AccountService.deleteParticipantAccount(ctx)
        },
      }),
      // #endregion

      // ----- USER OPERATIONS -----
      // #region
      changeUserLocale: t.withAuth(asUser).field({
        nullable: true,
        type: User,
        args: { locale: t.arg({ type: LocaleType, required: true }) },
        resolve: async (_, args, ctx) => {
          return await AccountService.changeUserLocale(args, ctx)
        },
      }),

      cancelLiveQuiz: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: LiveQuiz,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await LiveQuizService.cancelLiveQuiz(args, ctx)
          }
        ),
      }),

      enableCourseGamification: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Course,
        args: { courseId: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await CourseService.enableGamification(args, ctx)
          }
        ),
      }),

      deleteCourse: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ courseId: args.id }),
          DB.PermissionLevel.ADMIN,
          async (_, args, ctx) => {
            return await CourseService.deleteCourse(args, ctx)
          }
        ),
      }),

      deleteTag: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Tag,
        args: { id: t.arg.int({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await ElementService.deleteTag(args, ctx)
        },
      }),

      deleteElement: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: { id: t.arg.int({ required: true }) },
        resolve: withPermission(
          (args) => ({ elementId: args.id }),
          DB.PermissionLevel.ADMIN,
          async (_, args, ctx) => {
            return await ElementService.deleteElement(args, ctx)
          }
        ),
      }),

      editTag: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Tag,
        args: {
          id: t.arg.int({ required: true }),
          name: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ElementService.editTag(args, ctx)
        },
      }),

      endLiveQuiz: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: LiveQuiz,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await LiveQuizService.endLiveQuiz(args, ctx)
          }
        ),
      }),

      startLiveQuiz: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: LiveQuizMeta,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await LiveQuizService.startLiveQuiz(args, ctx)
          }
        ),
      }),

      scheduleLiveQuiz: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: LiveQuizMeta,
        args: {
          id: t.arg.string({ required: true }),
          availableFrom: t.arg({ type: 'Date', required: false }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await LiveQuizService.scheduleLiveQuiz(args, ctx)
          }
        ),
      }),

      unpublishLiveQuiz: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: LiveQuizMeta,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await LiveQuizService.unpublishLiveQuiz(args, ctx)
          }
        ),
      }),

      deleteFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          liveQuizId: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.liveQuizId }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await FeedbackService.deleteFeedback(args, ctx)
          }
        ),
      }),

      deleteFeedbackResponse: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          liveQuizId: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.liveQuizId }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await FeedbackService.deleteFeedbackResponse(args, ctx)
          }
        ),
      }),

      pinFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          isPinned: t.arg.boolean({ required: true }),
          liveQuizId: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.liveQuizId }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await FeedbackService.pinFeedback(args, ctx)
          }
        ),
      }),

      publishFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          isPublished: t.arg.boolean({ required: true }),
          liveQuizId: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.liveQuizId }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await FeedbackService.publishFeedback(args, ctx)
          }
        ),
      }),

      resolveFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          isResolved: t.arg.boolean({ required: true }),
          liveQuizId: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.liveQuizId }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await FeedbackService.resolveFeedback(args, ctx)
          }
        ),
      }),

      respondToFeedback: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: Feedback,
        args: {
          id: t.arg.int({ required: true }),
          responseContent: t.arg.string({ required: true }),
          liveQuizId: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.liveQuizId }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await FeedbackService.respondToFeedback(args, ctx)
          }
        ),
      }),

      logoutUser: t.withAuth(asUser).id({
        nullable: true,
        resolve: async (_, args, ctx) => {
          return await AccountService.logoutUser(args, ctx)
        },
      }),

      deactivateLiveQuizBlock: t.withAuth(asUserSessionExec).boolean({
        nullable: true,
        args: {
          quizId: t.arg.string({ required: true }),
          blockId: t.arg.int({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.quizId }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await LiveQuizService.deactivateLiveQuizBlock(args, ctx)
          }
        ),
      }),

      changeLiveQuizSettings: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          id: t.arg.string({ required: true }),
          isLiveQAEnabled: t.arg.boolean({ required: false }),
          isConfusionFeedbackEnabled: t.arg.boolean({ required: false }),
          isModerationEnabled: t.arg.boolean({ required: false }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await LiveQuizService.changeLiveQuizSettings(args, ctx)
          }
        ),
      }),

      activateLiveQuizBlock: t.withAuth(asUserSessionExec).field({
        nullable: true,
        type: LiveQuiz,
        args: {
          quizId: t.arg.string({ required: true }),
          blockId: t.arg.int({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.quizId }),
          DB.PermissionLevel.EXECUTE,
          async (_, args, ctx) => {
            return await LiveQuizService.activateLiveQuizBlock(args, ctx)
          }
        ),
      }),

      createLiveQuiz: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: ActivityInfo,
        args: {
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          blocks: t.arg({ type: [ElementBlockInput], required: true }),
          courseId: t.arg.string({ required: false }),
          multiplier: t.arg.int({ required: true }),

          defaultPoints: t.arg.int({ required: false }),
          defaultCorrectPoints: t.arg.int({ required: false }),
          maxBonusPoints: t.arg.int({ required: false }),
          timeToZeroBonus: t.arg.int({ required: false }),
          isGamificationEnabled: t.arg.boolean({ required: true }),
          isPinProtected: t.arg.boolean({ required: true }),
          isConfusionFeedbackEnabled: t.arg.boolean({ required: true }),
          isLiveQAEnabled: t.arg.boolean({ required: true }),
          isModerationEnabled: t.arg.boolean({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await LiveQuizService.manipulateLiveQuiz(args, ctx)
        },
      }),

      editLiveQuiz: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: ActivityInfo,
        args: {
          id: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          blocks: t.arg({ type: [ElementBlockInput], required: true }),
          courseId: t.arg.string({ required: false }),
          multiplier: t.arg.int({ required: true }),

          defaultPoints: t.arg.int({ required: false }),
          defaultCorrectPoints: t.arg.int({ required: false }),
          maxBonusPoints: t.arg.int({ required: false }),
          timeToZeroBonus: t.arg.int({ required: false }),
          isGamificationEnabled: t.arg.boolean({ required: true }),
          isPinProtected: t.arg.boolean({ required: true }),
          isConfusionFeedbackEnabled: t.arg.boolean({ required: true }),
          isLiveQAEnabled: t.arg.boolean({ required: true }),
          isModerationEnabled: t.arg.boolean({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await LiveQuizService.manipulateLiveQuiz(args, ctx)
          }
        ),
      }),

      changeElementStatus: t.withAuth(asUserFullAccess).boolean({
        nullable: true,
        args: {
          elementId: t.arg.int({ required: true }),
          status: t.arg({ type: ElementStatus, required: true }),
        },
        resolve: withPermission(
          (args) => ({ elementId: args.elementId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await ElementService.changeElementStatus(args, ctx)
          }
        ),
      }),

      manipulateContentElement: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
          status: t.arg({ type: ElementStatus, required: false }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          basePoints: t.arg.boolean({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          // if element is edited, >= WRITE permissions on element required
          if (typeof args.id !== 'undefined' && args.id !== null) {
            const validAccess = await checkAccess(
              [
                {
                  elementId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }
          }

          return await ElementService.manipulateElement(
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
          basePoints: t.arg.boolean({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          // if element is edited, >= WRITE permissions on element required
          if (typeof args.id !== 'undefined' && args.id !== null) {
            const validAccess = await checkAccess(
              [
                {
                  elementId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }
          }

          return await ElementService.manipulateElement(
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
          basePoints: t.arg.boolean({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsChoicesInput,
          }),
        },
        resolve: async (_, args, ctx) => {
          // if element is edited, >= WRITE permissions on element required
          if (typeof args.id !== 'undefined' && args.id !== null) {
            const validAccess = await checkAccess(
              [
                {
                  elementId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }
          }

          return await ElementService.manipulateElement(args, ctx)
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
          basePoints: t.arg.boolean({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsNumericalInput,
          }),
        },
        resolve: async (_, args, ctx) => {
          // if element is edited, >= WRITE permissions on element required
          if (typeof args.id !== 'undefined' && args.id !== null) {
            const validAccess = await checkAccess(
              [
                {
                  elementId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }
          }

          return await ElementService.manipulateElement(
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
          basePoints: t.arg.boolean({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsFreeTextInput,
          }),
        },
        resolve: async (_, args, ctx) => {
          // if element is edited, >= WRITE permissions on element required
          if (typeof args.id !== 'undefined' && args.id !== null) {
            const validAccess = await checkAccess(
              [
                {
                  elementId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }
          }

          return await ElementService.manipulateElement(
            { ...args, type: DB.ElementType.FREE_TEXT },
            ctx
          )
        },
      }),

      manipulateSelectionQuestion: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
          status: t.arg({ type: ElementStatus, required: false }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          basePoints: t.arg.boolean({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsSelectionInput,
          }),
        },
        resolve: async (_, args, ctx) => {
          // if element is edited, >= WRITE permissions on element required
          if (typeof args.id !== 'undefined' && args.id !== null) {
            const validAccess = await checkAccess(
              [
                {
                  elementId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }
          }

          return await ElementService.manipulateElement(
            { ...args, type: DB.ElementType.SELECTION },
            ctx
          )
        },
      }),

      manipulateCaseStudyQuestion: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: Element,
        args: {
          id: t.arg.int({ required: false }),
          status: t.arg({ type: ElementStatus, required: false }),
          name: t.arg.string({ required: false }),
          content: t.arg.string({ required: false }),
          explanation: t.arg.string({ required: false }),
          basePoints: t.arg.boolean({ required: false }),
          pointsMultiplier: t.arg.int({ required: false }),
          tags: t.arg.stringList({ required: false }),
          options: t.arg({
            type: OptionsCaseStudyInput,
          }),
        },
        resolve: async (_, args, ctx) => {
          // if element is edited, >= WRITE permissions on element required
          if (typeof args.id !== 'undefined' && args.id !== null) {
            const validAccess = await checkAccess(
              [
                {
                  elementId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }
          }

          return await ElementService.manipulateElement(
            { ...args, type: DB.ElementType.CASE_STUDY },
            ctx
          )
        },
      }),

      setActivityReviewStatus: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: ReviewStatus,
        args: {
          activityId: t.arg.string({ required: true }),
          activityType: t.arg({ type: ActivityType, required: true }),
          isReviewed: t.arg.boolean({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ActivitiesService.setActivityReviewStatus(args, ctx)
        },
      }),

      applyElementBatchOperations: t.withAuth(asUserFullAccess).int({
        args: {
          elementIds: t.arg.intList({ required: true }),
          archive: t.arg.boolean({ required: true }),
          unarchive: t.arg.boolean({ required: true }),
          status: t.arg({ type: ElementStatus, required: false }),
          multiplier: t.arg.int({ required: false }),
          basePoints: t.arg.boolean({ required: false }),
          updateInstances: t.arg.boolean({ required: true }),
          updateTemplateInstances: t.arg.boolean({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ElementService.applyElementBatchOperations(args, ctx)
        },
      }),

      applyActivityBatchOperations: t.withAuth(asUserFullAccess).int({
        args: {
          activityIds: t.arg.stringList({ required: true }),
          multiplier: t.arg.int({ required: false }),
          courseId: t.arg.string({ required: false }),
          basePoints: t.arg.int({ required: false }),
          correctnessPoints: t.arg.int({ required: false }),
          bonusPoints: t.arg.int({ required: false }),
          timeToZeroBonus: t.arg.int({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await ActivitiesService.applyActivityBatchOperations(args, ctx)
        },
      }),

      updateElementInstances: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: [ElementInstance],
        args: {
          elementId: t.arg.int({ required: true }),
          includeTemplates: t.arg.boolean({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ elementId: args.elementId }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await ElementService.updateElementInstances(
              args,
              ctx.prisma,
              ctx.emitter,
              ctx.user.sub
            )
          }
        ),
      }),

      flagOutdatedElementInstances: t.withAuth(asUserFullAccess).boolean({
        nullable: true,
        args: { elementId: t.arg.int({ required: true }) },
        resolve: withPermission(
          (args) => ({ elementId: args.elementId }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await ElementService.flagOutdatedElementInstances(
              args,
              ctx.prisma,
              ctx.emitter
            )
          }
        ),
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
          language: t.arg({ type: LocaleType, required: true }),
          notificationEmail: t.arg.string({
            required: false,
            validate: { email: true },
          }),
          isGamificationEnabled: t.arg.boolean({ required: true }),
          sourceCourseId: t.arg.string({ required: false }),
          duplicateLiveQuizzes: t.arg.boolean({ required: false }),
          duplicatePracticeQuizzes: t.arg.boolean({ required: false }),
          duplicateMicrolearnings: t.arg.boolean({ required: false }),
          duplicateGroupActivities: t.arg.boolean({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          if (!args.sourceCourseId) {
            return await CourseService.createCourse(args, ctx)
          } else {
            return await CourseService.duplicateCourse(args, ctx)
          }
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
          language: t.arg({ type: LocaleType, required: true }),
          notificationEmail: t.arg.string({
            required: false,
            validate: { email: false },
          }),
          isGamificationEnabled: t.arg.boolean({ required: false }),
        },
        resolve: withPermission(
          (args) => ({ courseId: args.id }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await CourseService.updateCourseSettings(args, ctx)
          }
        ),
      }),

      updateChatbotModelSettings: t.withAuth(asUser).field({
        nullable: true,
        type: Chatbot,
        args: {
          chatbotId: t.arg.string({ required: true }),
          modelSelection: t.arg.boolean({ required: true }),
          allowedModelIds: t.arg.stringList({ required: true }),
          allowedReasoningEffortsByModel: t.arg({
            type: [ChatbotReasoningConfigInput],
            required: false,
          }),
        },
        resolve: async (_, args, ctx) => {
          return await ChatbotsService.updateChatbotModelSettings(args, ctx)
        },
      }),

      updateWeeklyTimelineEntriesCourse: t.withAuth(asUserFullAccess).boolean({
        nullable: true,
        args: { courseId: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ courseId: args.courseId }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await ParticipantService.updateWeeklyTimelineEntriesCourse(
              args,
              ctx.prisma
            )
          }
        ),
      }),

      toggleArchiveCourse: t.withAuth(asUser).field({
        nullable: true,
        type: Course,
        args: {
          id: t.arg.string({ required: true }),
          isArchived: t.arg.boolean({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ courseId: args.id }),
          DB.PermissionLevel.ADMIN,
          async (_, args, ctx) => {
            return await CourseService.toggleArchiveCourse(args, ctx)
          }
        ),
      }),

      updateTagOrdering: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: [Tag],
        args: {
          originIx: t.arg.int({ required: true }),
          targetIx: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ElementService.updateTagOrdering(args, ctx)
        },
      }),

      deleteLiveQuiz: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: LiveQuiz,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.ADMIN,
          async (_, args, ctx) => {
            return await LiveQuizService.deleteLiveQuiz(args, ctx)
          }
        ),
      }),

      resetAssessmentLiveQuiz: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: ActivityInfo,
        args: { id: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ liveQuizId: args.id }),
          DB.PermissionLevel.ADMIN,
          async (_, args, ctx) => {
            return await LiveQuizService.resetAssessmentLiveQuiz(args, ctx)
          }
        ),
      }),

      correctAssessmentPointsInstance: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: PointCorrection,
        args: {
          instanceId: t.arg.int({ required: true }),
          awardBasePoints: t.arg.boolean({ required: false }),
          awardCorrectnessPoints: t.arg.boolean({ required: false }),
          awardBonusPoints: t.arg.boolean({ required: false }),
          deductBasePoints: t.arg.boolean({ required: false }),
          deductCorrectnessPoints: t.arg.boolean({ required: false }),
          deductBonusPoints: t.arg.boolean({ required: false }),
          reason: t.arg.string({ required: true }),
          studentReason: t.arg.string({ required: true }),
          scope: t.arg({ type: PointCorrectionType, required: true }),
          participantId: t.arg.string({ required: false }),
          participantIds: t.arg.stringList({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.correctAssessmentPointsInstance(args, ctx)
        },
      }),

      correctAssessmentPointsLiveQuiz: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: PointCorrection,
        args: {
          liveQuizId: t.arg.string({ required: true }),
          awardBasePoints: t.arg.boolean({ required: false }),
          awardCorrectnessPoints: t.arg.boolean({ required: false }),
          awardBonusPoints: t.arg.boolean({ required: false }),
          deductBasePoints: t.arg.boolean({ required: false }),
          deductCorrectnessPoints: t.arg.boolean({ required: false }),
          deductBonusPoints: t.arg.boolean({ required: false }),
          reason: t.arg.string({ required: true }),
          studentReason: t.arg.string({ required: true }),
          scope: t.arg({ type: PointCorrectionType, required: true }),
          participantId: t.arg.string({ required: false }),
          participantIds: t.arg.stringList({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await CourseService.correctAssessmentPointsLiveQuiz(args, ctx)
        },
      }),

      changeActivityName: t.withAuth(asUserFullAccess).boolean({
        nullable: true,
        args: {
          id: t.arg.string({ required: true }),
          type: t.arg({ required: true, type: ActivityType }),
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          if (args.type === ActivityTypeEnum.LIVE_QUIZ) {
            const validAccess = await checkAccess(
              [
                {
                  liveQuizId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await LiveQuizService.changeLiveQuizName(args, ctx)
          } else if (args.type === ActivityTypeEnum.PRACTICE_QUIZ) {
            const validAccess = await checkAccess(
              [
                {
                  practiceQuizId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await PracticeQuizService.changePracticeQuizName(args, ctx)
          } else if (args.type === ActivityTypeEnum.MICRO_LEARNING) {
            const validAccess = await checkAccess(
              [
                {
                  microLearningId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await MicroLearningService.changeMicroLearningName(args, ctx)
          } else if (args.type === ActivityTypeEnum.GROUP_ACTIVITY) {
            const validAccess = await checkAccess(
              [
                {
                  groupActivityId: args.id,
                  minimumPermissionLevel: DB.PermissionLevel.WRITE,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await GroupService.changeGroupActivityName(args, ctx)
          }
          return null
        },
      }),

      getFileUploadSas: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: FileUploadSAS,
        args: {
          fileName: t.arg.string({ required: true }),
          contentType: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ElementService.getFileUploadSas(args, ctx)
        },
      }),

      changeShortname: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: User,
        args: { shortname: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await AccountService.changeShortname(args, ctx)
        },
      }),

      changeEmailSettings: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: User,
        args: { projectUpdates: t.arg.boolean({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await AccountService.changeEmailSettings(args, ctx)
        },
      }),

      changeInitialSettings: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: User,
        args: {
          shortname: t.arg.string({ required: true }),
          locale: t.arg({ type: LocaleType, required: true }),
          sendUpdates: t.arg.boolean({ required: true }),
          seedDemoElements: t.arg.boolean({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await AccountService.changeInitialSettings(args, ctx)
        },
      }),

      grantPrivatePreviewAccess: t.withAuth(asAdmin).int({
        nullable: true,
        args: { email: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await AccountService.grantPrivatePreviewAccess(args, ctx)
        },
      }),

      createKb: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: KB,
        args: {
          name: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.createKb(args, ctx)
        },
      }),

      deleteKb: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: KB,
        args: { id: t.arg.id({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.deleteKb(args, ctx)
        },
      }),

      attachKbToChatbot: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: KBChatbotBinding,
        args: {
          kbId: t.arg.id({ required: true }),
          chatbotId: t.arg.id({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.attachKbToChatbot(args, ctx)
        },
      }),

      detachKbFromChatbot: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: {
          kbId: t.arg.id({ required: true }),
          chatbotId: t.arg.id({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.detachKbFromChatbot(args, ctx)
        },
      }),

      requestKbFileUpload: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: KBFileUpload,
        args: {
          kbId: t.arg.id({ required: true }),
          fileName: t.arg.string({ required: true }),
          contentType: t.arg.string({ required: true }),
          sizeBytes: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.requestKbFileUpload(args, ctx)
        },
      }),

      confirmKbFileUpload: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: KBResource,
        args: {
          kbId: t.arg.id({ required: true }),
          blobName: t.arg.string({ required: true }),
          title: t.arg.string({ required: true }),
          originalFilename: t.arg.string({ required: true }),
          mimeType: t.arg.string({ required: true }),
          sizeBytes: t.arg.int({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.confirmKbFileUpload(args, ctx)
        },
      }),

      createKbUrlResource: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: KBResource,
        args: {
          kbId: t.arg.id({ required: true }),
          url: t.arg.string({ required: true }),
          title: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.createKbUrlResource(args, ctx)
        },
      }),

      deleteKbResource: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: KBResource,
        args: { id: t.arg.id({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.deleteKbResource(args, ctx)
        },
      }),

      deleteKbResources: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: [KBResource],
        args: {
          kbId: t.arg.id({ required: true }),
          ids: t.arg.stringList({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.deleteKbResources(args, ctx)
        },
      }),

      ingestKbResource: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: KBResource,
        args: { id: t.arg.id({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.ingestKbResource(args, ctx)
        },
      }),

      rebuildKbKnowledgeGraph: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: KBKnowledgeGraphConfigType,
        args: {
          kbId: t.arg.id({ required: true }),
          qualityTier: t.arg({ type: KBGraphQualityTier, required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.rebuildKbKnowledgeGraph(args, ctx)
        },
      }),

      setKbKnowledgeGraphEnabled: t.withAuth(asUserFullAccess).field({
        nullable: false,
        type: KBKnowledgeGraphConfigType,
        args: {
          kbId: t.arg.id({ required: true }),
          enabled: t.arg.boolean({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await KnowledgeService.setKbKnowledgeGraphEnabled(args, ctx)
        },
      }),

      createAnswerCollection: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: AnswerCollection,
        args: {
          name: t.arg.string({ required: true }),
          description: t.arg.string({ required: true }),
          answers: t.arg.stringList({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await ResourcesService.createAnswerCollection(args, ctx)
        },
      }),

      duplicateAnswerCollection: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: AnswerCollection,
        args: { id: t.arg.int({ required: true }) },
        resolve: withPermission(
          (args) => ({ answerCollectionId: args.id }),
          DB.PermissionLevel.READ,
          async (_, args, ctx) => {
            return await ResourcesService.duplicateAnswerCollection(args, ctx)
          }
        ),
      }),

      modifyAnswerCollection: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: AnswerCollection,
        args: {
          id: t.arg.int({ required: true }),
          name: t.arg.string({ required: false }),
          description: t.arg.string({ required: false }),
        },
        resolve: withPermission(
          (args) => ({ answerCollectionId: args.id }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await ResourcesService.modifyAnswerCollection(args, ctx)
          }
        ),
      }),

      editAnswerCollectionEntry: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: AnswerCollectionEntry,
        args: {
          id: t.arg.int({ required: true }),
          value: t.arg.string({ required: true }),
          collectionId: t.arg.int({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ answerCollectionId: args.collectionId }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await ResourcesService.editAnswerCollectionEntry(args, ctx)
          }
        ),
      }),

      deleteAnswerCollectionEntry: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: 'Int',
        args: {
          id: t.arg.int({ required: true }),
          collectionId: t.arg.int({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ answerCollectionId: args.collectionId }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await ResourcesService.deleteAnswerCollectionEntry(args, ctx)
          }
        ),
      }),

      addAnswerCollectionOption: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: AnswerCollectionEntry,
        args: {
          collectionId: t.arg.int({ required: true }),
          value: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ answerCollectionId: args.collectionId }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await ResourcesService.addAnswerCollectionOption(args, ctx)
          }
        ),
      }),

      createUserGroup: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: UserGroup,
        args: {
          name: t.arg.string({ required: true }),
          members: t.arg({ type: [UserGroupMembersInput], required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.createUserGroup(args, ctx)
        },
      }),

      leaveUserGroup: t.withAuth(asUserFullAccess).boolean({
        args: { groupId: t.arg.int({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await SharingService.leaveUserGroup(args, ctx)
        },
      }),

      deleteUserGroup: t.withAuth(asUserFullAccess).boolean({
        args: { groupId: t.arg.int({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await SharingService.deleteUserGroup(args, ctx)
        },
      }),

      promoteGroupMemberToAdmin: t.withAuth(asUserFullAccess).boolean({
        args: {
          groupId: t.arg.int({ required: true }),
          memberId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.promoteGroupMemberToAdmin(args, ctx)
        },
      }),

      demoteGroupAdminToMember: t.withAuth(asUserFullAccess).boolean({
        args: {
          groupId: t.arg.int({ required: true }),
          adminId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.demoteGroupAdminToMember(args, ctx)
        },
      }),

      removeUserFromGroup: t.withAuth(asUserFullAccess).boolean({
        args: {
          groupId: t.arg.int({ required: true }),
          userId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.removeUserFromGroup(args, ctx)
        },
      }),

      changeUserGroupName: t.withAuth(asUserFullAccess).boolean({
        args: {
          id: t.arg.int({ required: true }),
          name: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.changeUserGroupName(args, ctx)
        },
      }),

      transferGroupOwnership: t.withAuth(asUserFullAccess).boolean({
        args: {
          id: t.arg.int({ required: true }),
          newOwnerId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.transferGroupOwnership(args, ctx)
        },
      }),

      addUserToUserGroup: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: UserInfo,
        args: {
          groupId: t.arg.int({ required: true }),
          shortnameOrEmail: t.arg.string({ required: true }),
          asAdmin: t.arg.boolean({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.addUserToUserGroup(args, ctx)
        },
      }),

      resolveActivityLogEntry: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: ActivityLogEntry,
        args: { id: t.arg.int({ required: true }) },
        resolve: async (_, __, ___) => {
          return null

          // TODO: implement resolveActivityLogEntry
          // how to do permissions smartly here? permission on the source object ADMIN or higher?
          // return await SharingService.resolveActivityLogEntry(args, ctx)
        },
      }),

      addActivityMessage: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: ActivityLogEntry,
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
          message: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // activity entries are not supported for catalog collections and user groups
          if (
            args.objectType === DB.ObjectType.CATALOG_COLLECTION ||
            args.objectType === DB.ObjectType.USER_GROUP
          ) {
            return null
          }

          // >= READ permissions on the object required
          const validAccess = await checkAccess(
            [
              ...(args.objectType === DB.ObjectType.ANSWER_COLLECTION
                ? [
                    {
                      answerCollectionId: parseInt(args.objectId),
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.ELEMENT
                ? [
                    {
                      elementId: parseInt(args.objectId),
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.COURSE
                ? [
                    {
                      courseId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.LIVE_QUIZ
                ? [
                    {
                      liveQuizId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.PRACTICE_QUIZ
                ? [
                    {
                      practiceQuizId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.MICRO_LEARNING
                ? [
                    {
                      microLearningId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.GROUP_ACTIVITY
                ? [
                    {
                      groupActivityId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.READ,
                    },
                  ]
                : []),
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await SharingService.addActivityMessage(args, ctx)
        },
      }),

      deleteActivityMessage: t.withAuth(asUserFullAccess).boolean({
        args: { id: t.arg.int({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await SharingService.deleteActivityMessage(
            { messageId: args.id },
            ctx
          )
        },
      }),

      addObjectToCatalog: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: CatalogObject,
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
          access: t.arg({ type: ObjectAccess, required: true }),
          catalogCollectionId: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          // if defined, >= WRITE permissions on catalog collection required
          const validAccess =
            args.catalogCollectionId &&
            args.catalogCollectionId !== MISSING_CATALOG_COLLECTION_ID
              ? await checkAccess(
                  [
                    {
                      catalogCollectionId: args.catalogCollectionId,
                      minimumPermissionLevel: DB.PermissionLevel.WRITE,
                    },
                  ],
                  ctx
                )
              : true
          if (!validAccess) {
            return null
          }

          return await SharingService.addObjectToCatalog(
            {
              access: args.access,
              catalogCollectionId: args.catalogCollectionId,
              answerCollectionId:
                args.objectType === DB.ObjectType.ANSWER_COLLECTION
                  ? parseInt(args.objectId)
                  : undefined,
              elementId:
                args.objectType === DB.ObjectType.ELEMENT
                  ? parseInt(args.objectId)
                  : undefined,
              courseId: undefined, // not supported in catalog at the moment
              liveQuizId:
                // not supported in catalog at the moment (except templates)
                args.objectType === DB.ObjectType.LIVE_QUIZ
                  ? args.objectId
                  : undefined,
              practiceQuizId: undefined, // not supported in catalog at the moment (except templates)
              microLearningId: undefined, // not supported in catalog at the moment (except templates)
              groupActivityId: undefined, // not supported in catalog at the moment (except templates)
            },
            ctx
          )
        },
      }),

      copyCatalogObjectToAccount: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
          catalogCollectionId: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          // access control implemented inside service functions (does not fit default schema)
          if (args.objectType === DB.ObjectType.ANSWER_COLLECTION) {
            return await SharingService.copyAnswerCollectionToAccount(
              {
                collectionId: parseInt(args.objectId),
                catalogCollectionId: args.catalogCollectionId,
              },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.ELEMENT) {
            return await SharingService.copyElementToAccount(
              {
                elementId: parseInt(args.objectId),
                catalogCollectionId: args.catalogCollectionId,
              },
              ctx
            )
          }

          // elements and activities are not supported for the import feature (for now)
          return false
        },
      }),

      importCatalogObject: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
          catalogCollectionId: t.arg.string({ required: false }),
        },
        resolve: async (_, args, ctx) => {
          // access control implemented inside service functions (does not fit default schema)
          if (args.objectType === DB.ObjectType.ANSWER_COLLECTION) {
            return await SharingService.importAnswerCollection(
              {
                collectionId: parseInt(args.objectId),
                catalogCollectionId: args.catalogCollectionId,
              },
              ctx
            )
          }

          // elements and activities are not supported for the import feature (for now)
          return false
        },
      }),

      requestCatalogObject: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
          catalogCollectionId: t.arg.string({ required: false }),
          requestedPermissionLevel: t.arg({
            type: PermissionLevel,
            required: false,
          }),
        },
        resolve: async (_, args, ctx) => {
          // access control implemented inside service function (does not fit default schema)
          return await SharingService.requestCatalogObject(
            {
              requestedPermissionLevel: args.requestedPermissionLevel,
              catalogCollectionId: args.catalogCollectionId,
              answerCollectionId:
                args.objectType === DB.ObjectType.ANSWER_COLLECTION
                  ? parseInt(args.objectId)
                  : undefined,
              elementId:
                args.objectType === DB.ObjectType.ELEMENT
                  ? parseInt(args.objectId)
                  : undefined,
              courseId: undefined,
              liveQuizId: undefined,
              practiceQuizId: undefined,
              microLearningId: undefined,
              groupActivityId: undefined,
            },
            ctx
          )
        },
      }),

      cancelObjectSharingRequest: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.cancelObjectSharingRequest(
            {
              answerCollectionId:
                args.objectType === DB.ObjectType.ANSWER_COLLECTION
                  ? parseInt(args.objectId)
                  : undefined,
              elementId:
                args.objectType === DB.ObjectType.ELEMENT
                  ? parseInt(args.objectId)
                  : undefined,
              courseId: undefined,
              liveQuizId: undefined,
              practiceQuizId: undefined,
              microLearningId: undefined,
              groupActivityId: undefined,
            },
            ctx
          )
        },
      }),

      deleteAnswerCollection: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: 'Int',
        args: { collectionId: t.arg.int({ required: true }) },
        resolve: withPermission(
          (args) => ({ answerCollectionId: args.collectionId }),
          DB.PermissionLevel.ADMIN,
          async (_, args, ctx) => {
            return await ResourcesService.deleteAnswerCollection(args, ctx)
          }
        ),
      }),

      createCatalogCollection: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: CatalogCollection,
        args: {
          name: t.arg.string({ required: true }),
          access: t.arg({ type: ObjectAccess, required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.createCatalogCollection(args, ctx)
        },
      }),

      changeCatalogObjectAccess: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: {
          assignmentId: t.arg.int({ required: true }),
          access: t.arg({ type: ObjectAccess, required: true }),
        },
        resolve: async (_, args, ctx) => {
          // access control implemented inside service function (does not fit default schema)
          return await SharingService.changeCatalogObjectAccess(args, ctx)
        },
      }),

      changeCatalogCollectionObjectAccess: t
        .withAuth(asUserFullAccess)
        .boolean({
          nullable: true,
          args: {
            catalogCollectionId: t.arg.string({ required: true }),
            access: t.arg({ type: ObjectAccess, required: true }),
          },
          resolve: withPermission(
            (args) => ({ catalogCollectionId: args.catalogCollectionId }),
            DB.PermissionLevel.ADMIN,
            async (_, args, ctx) => {
              return await SharingService.changeCatalogCollectionObjectAccess(
                args,
                ctx
              )
            }
          ),
        }),

      changeCatalogCollectionName: t.withAuth(asUserFullAccess).boolean({
        nullable: true,
        args: {
          catalogCollectionId: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
        },
        resolve: withPermission(
          (args) => ({ catalogCollectionId: args.catalogCollectionId }),
          DB.PermissionLevel.WRITE,
          async (_, args, ctx) => {
            return await SharingService.changeCatalogCollectionName(args, ctx)
          }
        ),
      }),

      requestCatalogCollection: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: CatalogCollection,
        args: {
          catalogCollectionId: t.arg.string({ required: true }),
          requestedPermissionLevel: t.arg({
            type: PermissionLevel,
            required: false,
          }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.requestCatalogCollection(args, ctx)
        },
      }),

      deleteCatalogCollection: t.withAuth(asUserFullAccess).string({
        nullable: true,
        args: { catalogCollectionId: t.arg.string({ required: true }) },
        resolve: withPermission(
          (args) => ({ catalogCollectionId: args.catalogCollectionId }),
          DB.PermissionLevel.ADMIN,
          async (_, args, ctx) => {
            return await SharingService.deleteCatalogCollection(args, ctx)
          }
        ),
      }),

      createActivityTemplate: t.withAuth(asUserFullAccess).boolean({
        nullable: true,
        args: {
          activityId: t.arg.string({ required: true }),
          activityType: t.arg({ type: ActivityType, required: true }),
          templateName: t.arg.string({ required: true }),
          templateDescription: t.arg.string({ required: true }),
          templateInstructions: t.arg.string({ required: true }),
          copyBeforeConversion: t.arg.boolean({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= ADMIN permissions on the activity required (conversion = live quiz not available anymore)
          const validAccess = await checkAccess(
            [
              ...(args.activityType === ActivityTypeEnum.LIVE_QUIZ
                ? [
                    {
                      liveQuizId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.PRACTICE_QUIZ
                ? [
                    {
                      practiceQuizId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.MICRO_LEARNING
                ? [
                    {
                      microLearningId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.GROUP_ACTIVITY
                ? [
                    {
                      groupActivityId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await TemplateService.createActivityTemplate(args, ctx)
        },
      }),

      editActivityTemplate: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: {
          activityId: t.arg.string({ required: true }),
          activityType: t.arg({ type: ActivityType, required: true }),
          templateId: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
          description: t.arg.string({ required: true }),
          instructions: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= WRITE permissions on the activity required
          const validAccess = await checkAccess(
            [
              ...(args.activityType === ActivityTypeEnum.LIVE_QUIZ
                ? [
                    {
                      liveQuizId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.WRITE,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.PRACTICE_QUIZ
                ? [
                    {
                      practiceQuizId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.WRITE,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.MICRO_LEARNING
                ? [
                    {
                      microLearningId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.WRITE,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.GROUP_ACTIVITY
                ? [
                    {
                      groupActivityId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.WRITE,
                    },
                  ]
                : []),
            ],
            ctx
          )
          if (!validAccess) {
            return false
          }

          return await TemplateService.editActivityTemplate(args, ctx)
        },
      }),

      deleteActivityTemplate: t.withAuth(asUserFullAccess).string({
        nullable: true,
        args: {
          activityId: t.arg.string({ required: true }),
          activityType: t.arg({ type: ActivityType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= ADMIN permissions on the activity required
          const validAccess = await checkAccess(
            [
              ...(args.activityType === ActivityTypeEnum.LIVE_QUIZ
                ? [
                    {
                      liveQuizId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.PRACTICE_QUIZ
                ? [
                    {
                      practiceQuizId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.MICRO_LEARNING
                ? [
                    {
                      microLearningId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.activityType === ActivityTypeEnum.GROUP_ACTIVITY
                ? [
                    {
                      groupActivityId: args.activityId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await TemplateService.deleteActivityTemplate(args, ctx)
        },
      }),

      createLiveQuizFromTemplate: t.withAuth(asUserFullAccess).string({
        nullable: true,
        args: {
          templateId: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
          displayName: t.arg.string({ required: true }),
          description: t.arg.string({ required: false }),
          courseId: t.arg.string({ required: false }),
          isGamificationEnabled: t.arg.boolean({ required: true }),
          blocks: t.arg({
            type: [TemplateBlockInput],
            required: true,
          }),
        },
        resolve: async (_, args, ctx) => {
          return await TemplateService.createLiveQuizFromTemplate(args, ctx)
        },
      }),

      shareObject: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: PermissionInfo,
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
          permissionLevel: t.arg({ type: PermissionLevel, required: true }),
          shortnameOrEmail: t.arg.string({ required: false }),
          userGroupId: t.arg.int({ required: false }),
          propagation: t.arg.boolean({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= ADMIN permissions on the object required
          const validAccess = await checkAccess(
            [
              ...(args.objectType === DB.ObjectType.CATALOG_COLLECTION
                ? [
                    {
                      catalogCollectionId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.ANSWER_COLLECTION
                ? [
                    {
                      answerCollectionId: parseInt(args.objectId),
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.ELEMENT
                ? [
                    {
                      elementId: parseInt(args.objectId),
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.COURSE
                ? [
                    {
                      courseId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.LIVE_QUIZ
                ? [
                    {
                      liveQuizId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.PRACTICE_QUIZ
                ? [
                    {
                      practiceQuizId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.MICRO_LEARNING
                ? [
                    {
                      microLearningId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.GROUP_ACTIVITY
                ? [
                    {
                      groupActivityId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await SharingService.shareObject(
            {
              permissionLevel: args.permissionLevel,
              shortnameOrEmail: args.shortnameOrEmail,
              userGroupId: args.userGroupId,
              propagation: args.propagation,
              catalogCollectionId:
                args.objectType === DB.ObjectType.CATALOG_COLLECTION
                  ? args.objectId
                  : undefined,
              answerCollectionId:
                args.objectType === DB.ObjectType.ANSWER_COLLECTION
                  ? parseInt(args.objectId)
                  : undefined,
              elementId:
                args.objectType === DB.ObjectType.ELEMENT
                  ? parseInt(args.objectId)
                  : undefined,
              courseId:
                args.objectType === DB.ObjectType.COURSE
                  ? args.objectId
                  : undefined,
              liveQuizId:
                args.objectType === DB.ObjectType.LIVE_QUIZ
                  ? args.objectId
                  : undefined,
              practiceQuizId:
                args.objectType === DB.ObjectType.PRACTICE_QUIZ
                  ? args.objectId
                  : undefined,
              microLearningId:
                args.objectType === DB.ObjectType.MICRO_LEARNING
                  ? args.objectId
                  : undefined,
              groupActivityId:
                args.objectType === DB.ObjectType.GROUP_ACTIVITY
                  ? args.objectId
                  : undefined,
            },
            ctx
          )
        },
      }),

      revokeObjectAccess: t.withAuth(asUserFullAccess).int({
        nullable: true,
        args: {
          permissionId: t.arg.int({ required: true }),
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          const validAccess = await checkAccess(
            [
              ...(args.objectType === DB.ObjectType.CATALOG_COLLECTION
                ? [
                    {
                      catalogCollectionId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.ANSWER_COLLECTION
                ? [
                    {
                      answerCollectionId: parseInt(args.objectId),
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.ELEMENT
                ? [
                    {
                      elementId: parseInt(args.objectId),
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.COURSE
                ? [
                    {
                      courseId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.LIVE_QUIZ
                ? [
                    {
                      liveQuizId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.PRACTICE_QUIZ
                ? [
                    {
                      practiceQuizId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.MICRO_LEARNING
                ? [
                    {
                      microLearningId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.GROUP_ACTIVITY
                ? [
                    {
                      groupActivityId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
            ],
            ctx
          )
          if (!validAccess) {
            return null
          }

          return await SharingService.revokeObjectAccess(
            {
              permissionId: args.permissionId,
              catalogCollectionId:
                args.objectType === DB.ObjectType.CATALOG_COLLECTION
                  ? args.objectId
                  : undefined,
              answerCollectionId:
                args.objectType === DB.ObjectType.ANSWER_COLLECTION
                  ? parseInt(args.objectId)
                  : undefined,
              elementId:
                args.objectType === DB.ObjectType.ELEMENT
                  ? parseInt(args.objectId)
                  : undefined,
              courseId:
                args.objectType === DB.ObjectType.COURSE
                  ? args.objectId
                  : undefined,
              liveQuizId:
                args.objectType === DB.ObjectType.LIVE_QUIZ
                  ? args.objectId
                  : undefined,
              practiceQuizId:
                args.objectType === DB.ObjectType.PRACTICE_QUIZ
                  ? args.objectId
                  : undefined,
              microLearningId:
                args.objectType === DB.ObjectType.MICRO_LEARNING
                  ? args.objectId
                  : undefined,
              groupActivityId:
                args.objectType === DB.ObjectType.GROUP_ACTIVITY
                  ? args.objectId
                  : undefined,
            },
            ctx
          )
        },
      }),

      changePermissionLevel: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: {
          permissionId: t.arg.int({ required: true }),
          permissionLevel: t.arg({ type: PermissionLevel, required: true }),
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
          propagation: t.arg.boolean({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          // >= ADMIN permissions on the object required
          const validAccess = await checkAccess(
            [
              ...(args.objectType === DB.ObjectType.CATALOG_COLLECTION
                ? [
                    {
                      catalogCollectionId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.ANSWER_COLLECTION
                ? [
                    {
                      answerCollectionId: parseInt(args.objectId),
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.ELEMENT
                ? [
                    {
                      elementId: parseInt(args.objectId),
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.COURSE
                ? [
                    {
                      courseId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.LIVE_QUIZ
                ? [
                    {
                      liveQuizId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.PRACTICE_QUIZ
                ? [
                    {
                      practiceQuizId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.MICRO_LEARNING
                ? [
                    {
                      microLearningId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
              ...(args.objectType === DB.ObjectType.GROUP_ACTIVITY
                ? [
                    {
                      groupActivityId: args.objectId,
                      minimumPermissionLevel: DB.PermissionLevel.ADMIN,
                    },
                  ]
                : []),
            ],
            ctx
          )
          if (!validAccess) {
            return false
          }

          return await SharingService.changeObjectPermissionLevel(
            {
              permissionId: args.permissionId,
              permissionLevel: args.permissionLevel,
              propagation: args.propagation,
              catalogCollectionId:
                args.objectType === DB.ObjectType.CATALOG_COLLECTION
                  ? args.objectId
                  : undefined,
              answerCollectionId:
                args.objectType === DB.ObjectType.ANSWER_COLLECTION
                  ? parseInt(args.objectId)
                  : undefined,
              elementId:
                args.objectType === DB.ObjectType.ELEMENT
                  ? parseInt(args.objectId)
                  : undefined,
              courseId:
                args.objectType === DB.ObjectType.COURSE
                  ? args.objectId
                  : undefined,
              liveQuizId:
                args.objectType === DB.ObjectType.LIVE_QUIZ
                  ? args.objectId
                  : undefined,
              practiceQuizId:
                args.objectType === DB.ObjectType.PRACTICE_QUIZ
                  ? args.objectId
                  : undefined,
              microLearningId:
                args.objectType === DB.ObjectType.MICRO_LEARNING
                  ? args.objectId
                  : undefined,
              groupActivityId:
                args.objectType === DB.ObjectType.GROUP_ACTIVITY
                  ? args.objectId
                  : undefined,
            },
            ctx
          )
        },
      }),

      transferObjectOwnership: t.withAuth(asUserFullAccess).field({
        nullable: true,
        type: PermissionInfo,
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
          shortnameOrEmail: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          if (args.objectType === DB.ObjectType.CATALOG_COLLECTION) {
            // == OWNER permissions on catalog collection required
            const validAccess = await checkAccess(
              [
                {
                  catalogCollectionId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.OWNER,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.transferCatalogCollectionOwnership(
              {
                id: args.objectId,
                shortnameOrEmail: args.shortnameOrEmail,
              },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.ANSWER_COLLECTION) {
            // == OWNER permissions on answer collection required
            const validAccess = await checkAccess(
              [
                {
                  answerCollectionId: parseInt(args.objectId),
                  minimumPermissionLevel: DB.PermissionLevel.OWNER,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.transferAnswerCollectionOwnership(
              {
                id: parseInt(args.objectId),
                shortnameOrEmail: args.shortnameOrEmail,
              },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.ELEMENT) {
            // == OWNER permissions on element required
            const validAccess = await checkAccess(
              [
                {
                  elementId: parseInt(args.objectId),
                  minimumPermissionLevel: DB.PermissionLevel.OWNER,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.transferElementOwnership(
              {
                id: parseInt(args.objectId),
                shortnameOrEmail: args.shortnameOrEmail,
              },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.COURSE) {
            // == OWNER permissions on course required
            const validAccess = await checkAccess(
              [
                {
                  courseId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.OWNER,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.transferCourseOwnership(
              {
                id: args.objectId,
                shortnameOrEmail: args.shortnameOrEmail,
              },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.LIVE_QUIZ) {
            // == OWNER permissions on live quiz required
            const validAccess = await checkAccess(
              [
                {
                  liveQuizId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.OWNER,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.transferLiveQuizOwnership(
              {
                id: args.objectId,
                shortnameOrEmail: args.shortnameOrEmail,
              },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.PRACTICE_QUIZ) {
            // == OWNER permissions on practice quiz required
            const validAccess = await checkAccess(
              [
                {
                  practiceQuizId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.OWNER,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.transferPracticeQuizOwnership(
              {
                id: args.objectId,
                shortnameOrEmail: args.shortnameOrEmail,
              },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.MICRO_LEARNING) {
            // == OWNER permissions on microlearning required
            const validAccess = await checkAccess(
              [
                {
                  microLearningId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.OWNER,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.transferMicroLearningOwnership(
              {
                id: args.objectId,
                shortnameOrEmail: args.shortnameOrEmail,
              },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.GROUP_ACTIVITY) {
            // == OWNER permissions on group activity required
            const validAccess = await checkAccess(
              [
                {
                  groupActivityId: args.objectId,
                  minimumPermissionLevel: DB.PermissionLevel.OWNER,
                },
              ],
              ctx
            )
            if (!validAccess) {
              return null
            }

            return await SharingService.transferGroupActivityOwnership(
              {
                id: args.objectId,
                shortnameOrEmail: args.shortnameOrEmail,
              },
              ctx
            )
          }

          return null
        },
      }),

      removeObject: t.withAuth(asUserFullAccess).string({
        nullable: true,
        args: {
          objectId: t.arg.string({ required: true }),
          objectType: t.arg({ type: ObjectType, required: true }),
        },
        resolve: async (_, args, ctx) => {
          if (args.objectType === DB.ObjectType.ANSWER_COLLECTION) {
            return await ResourcesService.removeAnswerCollection(
              { id: parseInt(args.objectId) },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.ELEMENT) {
            return await ElementService.removeElement(
              { id: parseInt(args.objectId) },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.COURSE) {
            return await CourseService.removeCourse({ id: args.objectId }, ctx)
          } else if (args.objectType === DB.ObjectType.LIVE_QUIZ) {
            return await LiveQuizService.removeLiveQuiz(
              { id: args.objectId },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.PRACTICE_QUIZ) {
            return await PracticeQuizService.removePracticeQuiz(
              { id: args.objectId },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.MICRO_LEARNING) {
            return await MicroLearningService.removeMicroLearning(
              { id: args.objectId },
              ctx
            )
          } else if (args.objectType === DB.ObjectType.GROUP_ACTIVITY) {
            return await GroupService.removeGroupActivity(
              { id: args.objectId },
              ctx
            )
          }

          return null
        },
      }),

      removeCatalogObjectAssignment: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: { assignmentId: t.arg.int({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await SharingService.removeCatalogObjectAssignment(args, ctx)
        },
      }),

      approveObjectSharingRequest: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: {
          requestId: t.arg.int({ required: true }),
          userId: t.arg.string({ required: true }),
          permissionLevel: t.arg({ type: PermissionLevel, required: true }),
          propagation: t.arg.boolean({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.resolveObjectSharingRequest(
            { ...args, approved: true },
            ctx
          )
        },
      }),

      declineObjectSharingRequest: t.withAuth(asUserFullAccess).boolean({
        nullable: false,
        args: {
          requestId: t.arg.int({ required: true }),
          userId: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await SharingService.resolveObjectSharingRequest(
            {
              ...args,
              permissionLevel: DB.PermissionLevel.READ, // dummy value for interface typing
              propagation: false,
              approved: false,
            },
            ctx
          )
        },
      }),
      // #endregion

      // ----- USER WITH CATALYST -----
      // #region
      createPracticeQuiz: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: ActivityInfo,
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
            resetTimeDays: t.arg.int({ required: true }),
          },
          resolve: async (_, args, ctx) => {
            return await PracticeQuizService.manipulatePracticeQuiz(args, ctx)
          },
        }),

      editPracticeQuiz: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: ActivityInfo,
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
            resetTimeDays: t.arg.int({ required: true }),
          },
          resolve: withPermission(
            (args) => ({ practiceQuizId: args.id }),
            DB.PermissionLevel.WRITE,
            async (_, args, ctx) => {
              return await PracticeQuizService.manipulatePracticeQuiz(args, ctx)
            }
          ),
        }),

      createMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: ActivityInfo,
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
          resolve: async (_, args, ctx) => {
            return await MicroLearningService.manipulateMicroLearning(args, ctx)
          },
        }),

      editMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: ActivityInfo,
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
          resolve: withPermission(
            (args) => ({ microLearningId: args.id }),
            DB.PermissionLevel.WRITE,
            async (_, args, ctx) => {
              return await MicroLearningService.manipulateMicroLearning(
                args,
                ctx
              )
            }
          ),
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
          resolve: withPermission(
            (args) => ({ microLearningId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await MicroLearningService.extendMicroLearning(args, ctx)
            }
          ),
        }),

      endMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ microLearningId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await MicroLearningService.endMicroLearning(args, ctx)
            }
          ),
        }),

      createGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: ActivityInfo,
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
          resolve: async (_, args, ctx) => {
            return await GroupService.manipulateGroupActivity(args, ctx)
          },
        }),

      editGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: ActivityInfo,
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
          resolve: withPermission(
            (args) => ({ groupActivityId: args.id }),
            DB.PermissionLevel.WRITE,
            async (_, args, ctx) => {
              return await GroupService.manipulateGroupActivity(args, ctx)
            }
          ),
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
          resolve: withPermission(
            (args) => ({ groupActivityId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await GroupService.extendGroupActivity(args, ctx)
            }
          ),
        }),

      publishPracticeQuiz: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: PracticeQuiz,
          args: {
            id: t.arg.string({ required: true }),
            availableFrom: t.arg({ type: 'Date', required: false }),
          },
          resolve: withPermission(
            (args) => ({ practiceQuizId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await PracticeQuizService.publishPracticeQuiz(args, ctx)
            }
          ),
        }),

      publishMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ microLearningId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await MicroLearningService.publishMicroLearning(args, ctx)
            }
          ),
        }),

      unpublishPracticeQuiz: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: PracticeQuiz,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ practiceQuizId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await PracticeQuizService.unpublishPracticeQuiz(args, ctx)
            }
          ),
        }),

      unpublishMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ microLearningId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await MicroLearningService.unpublishMicroLearning(
                args,
                ctx
              )
            }
          ),
        }),

      deletePracticeQuiz: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: PracticeQuiz,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ practiceQuizId: args.id }),
            DB.PermissionLevel.ADMIN,
            async (_, args, ctx) => {
              return await PracticeQuizService.deletePracticeQuiz(args, ctx)
            }
          ),
        }),

      deleteMicroLearning: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: MicroLearning,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ microLearningId: args.id }),
            DB.PermissionLevel.ADMIN,
            async (_, args, ctx) => {
              return await MicroLearningService.deleteMicroLearning(args, ctx)
            }
          ),
        }),

      publishGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ groupActivityId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await GroupService.publishGroupActivity(args, ctx)
            }
          ),
        }),

      unpublishGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ groupActivityId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await GroupService.unpublishGroupActivity(args, ctx)
            }
          ),
        }),

      openGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ groupActivityId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await GroupService.openGroupActivity(args, ctx)
            }
          ),
        }),

      endGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ groupActivityId: args.id }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await GroupService.endGroupActivity(args, ctx)
            }
          ),
        }),

      deleteGroupActivity: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ groupActivityId: args.id }),
            DB.PermissionLevel.ADMIN,
            async (_, args, ctx) => {
              return await GroupService.deleteGroupActivity(args, ctx)
            }
          ),
        }),

      gradeGroupActivitySubmission: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivityInstance,
          args: {
            id: t.arg.int({ required: true }),
            groupActivityId: t.arg.string({ required: true }),
            gradingDecisions: t.arg({
              type: GroupActivityGradingInput,
              required: true,
            }),
          },
          resolve: withPermission(
            (args) => ({ groupActivityId: args.groupActivityId }),
            DB.PermissionLevel.EXECUTE,
            async (_, args, ctx) => {
              return await GroupService.gradeGroupActivitySubmission(args, ctx)
            }
          ),
        }),

      finalizeGroupActivityGrading: t
        .withAuth({ ...asUserWithCatalyst, ...asUserFullAccess })
        .field({
          nullable: true,
          type: GroupActivity,
          args: { id: t.arg.string({ required: true }) },
          resolve: withPermission(
            (args) => ({ groupActivityId: args.id }),
            DB.PermissionLevel.WRITE,
            async (_, args, ctx) => {
              return await GroupService.finalizeGroupActivityGrading(args, ctx)
            }
          ),
        }),
      // #endregion

      // ----- USER OWNER OPERATIONS -----
      // #region
      createUserLogin: t.withAuth(asUserOwner).field({
        nullable: true,
        type: UserLogin,
        args: {
          password: t.arg.string({ required: true }),
          name: t.arg.string({ required: true }),
          scope: t.arg({ type: UserLoginScope, required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await AccountService.createUserLogin(args, ctx)
        },
      }),

      updateUserLogin: t.withAuth(asUserOwner).field({
        nullable: true,
        type: UserLogin,
        args: {
          id: t.arg.string({ required: true }),
          password: t.arg.string({ required: true }),
        },
        resolve: async (_, args, ctx) => {
          return await AccountService.updateUserLogin(args, ctx)
        },
      }),

      deleteUserLogin: t.withAuth(asUserOwner).field({
        nullable: true,
        type: UserLogin,
        args: { id: t.arg.string({ required: true }) },
        resolve: async (_, args, ctx) => {
          return await AccountService.deleteUserLogin(args, ctx)
        },
      }),

      // #endregion
    }
  },
})
