import { filter, pipe } from '@graphql-yoga/node'
import * as DB from '@klicker-uzh/prisma'
import { DateTimeResolver, JSONObjectResolver } from 'graphql-scalars'
import {
  arg,
  asNexusMethod,
  booleanArg,
  enumType,
  idArg,
  inputObjectType,
  intArg,
  interfaceType,
  list,
  nonNull,
  objectType,
  stringArg,
  subscriptionType,
} from 'nexus'
import {
  Context,
  ContextWithOptionalUser,
  ContextWithUser,
} from './lib/context'
import * as AccountService from './services/accounts'
import * as FeedbackService from './services/feedbacks'
import * as LearningElementService from './services/learningElements'
import * as MicroLearningService from './services/microLearning'
import * as NotificationService from './services/notifications'
import * as ParticipantService from './services/participants'
import * as QuestionService from './services/questions'
import * as SessionService from './services/sessions'

export const jsonScalar = asNexusMethod(JSONObjectResolver, 'json')
export const dateTimeScalar = asNexusMethod(DateTimeResolver, 'date')

export const AvatarSettingsInput = inputObjectType({
  name: 'AvatarSettingsInput',
  definition(t) {
    t.nonNull.string('skinTone')
    t.nonNull.string('eyes')
    t.nonNull.string('mouth')
    t.nonNull.string('hair')
    t.nonNull.string('accessory')
    t.nonNull.string('hairColor')
    t.nonNull.string('clothing')
    t.nonNull.string('clothingColor')
    t.nonNull.string('facialHair')
  },
})

export const BlockInput = inputObjectType({
  name: 'BlockInput',
  definition(t) {
    t.nonNull.list.nonNull.int('questionIds')
    t.int('randomSelection')
    t.int('timeLimit')
  },
})

export const SubscriptionKeysInput = inputObjectType({
  name: 'SubscriptionKeys',
  definition(t) {
    t.nonNull.string('p256dh')
    t.nonNull.string('auth')
  },
})

export const SubscriptionObjectInput = inputObjectType({
  name: 'SubscriptionObjectInput',
  definition(t) {
    t.nonNull.string('endpoint')
    t.int('expirationTime')
    t.nonNull.field('keys', {
      type: SubscriptionKeysInput,
    })
  },
})

export const ResponseInput = inputObjectType({
  name: 'ResponseInput',
  definition(t) {
    t.list.nonNull.int('choices')
    t.string('value')
  },
})

export const Restrictions = inputObjectType({
  name: 'Restrictions',
  definition(t) {
    t.float('min')
    t.float('max')
    t.int('maxLength')
  },
})

export const ChoiceInput = inputObjectType({
  name: 'ChoiceInput',
  definition(t) {
    t.int('ix')
    t.boolean('correct')
    t.string('value')
    t.string('feedback')
  },
})

export const SolutionRange = inputObjectType({
  name: 'SolutionRange',
  definition(t) {
    t.float('min')
    t.float('max')
  },
})

export const OptionsInput = inputObjectType({
  name: 'OptionsInput',
  definition(t) {
    t.list.field('choices', {
      type: ChoiceInput,
    })
    t.field('restrictions', { type: Restrictions })
    t.field('solutionRanges', { type: SolutionRange })
    t.list.string('solutions')
  },
})

export const AttachmentInput = inputObjectType({
  name: 'AttachmentInput',
  definition(t) {
    t.string('id')
  },
})

export const TagInput = inputObjectType({
  name: 'TagInput',
  definition(t) {
    t.string('id')
  },
})

export const QuestionData = interfaceType({
  name: 'QuestionData',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.string('name')
    t.nonNull.string('type')
    t.nonNull.string('content')
    t.nonNull.string('contentPlain')

    t.nonNull.boolean('isArchived')
    t.nonNull.boolean('isDeleted')
  },
  resolveType: (item) => {
    if (
      item.type === DB.QuestionType.SC ||
      item.type === DB.QuestionType.MC ||
      item.type === DB.QuestionType.KPRIM
    ) {
      return 'ChoicesQuestionData'
    } else if (item.type === DB.QuestionType.NUMERICAL) {
      return 'NumericalQuestionData'
    } else if (item.type === DB.QuestionType.FREE_TEXT) {
      return 'FreeTextQuestionData'
    }
    return null
  },
})

export const Tag = objectType({
  name: 'Tag',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.string('name')
  },
})

export const Choice = objectType({
  name: 'Choice',
  definition(t) {
    t.nonNull.id('id')
    t.nonNull.int('ix')
    t.nonNull.string('value')
    t.boolean('correct')
    t.string('feedback')
  },
})

export const ChoicesQuestionOptions = objectType({
  name: 'ChoicesQuestionOptions',
  definition(t) {
    t.nonNull.list.nonNull.field('choices', {
      type: Choice,
    })
  },
})

export const ChoicesQuestionData = objectType({
  name: 'ChoicesQuestionData',
  definition(t) {
    t.implements(QuestionData)

    t.nonNull.field('options', {
      type: ChoicesQuestionOptions,
    })
  },
})

export const NumericalRestrictions = objectType({
  name: 'NumericalRestrictions',
  definition(t) {
    t.int('min')
    t.int('max')
  },
})

export const NumericalSolutionRange = objectType({
  name: 'NumericalSolutionRange',
  definition(t) {
    t.float('min')
    t.float('max')
  },
})

export const NumericalQuestionOptions = objectType({
  name: 'NumericalQuestionOptions',
  definition(t) {
    t.field('restrictions', {
      type: NumericalRestrictions,
    })
    t.list.nonNull.field('solutionRanges', {
      type: NumericalSolutionRange,
    })
  },
})

export const NumericalQuestionData = objectType({
  name: 'NumericalQuestionData',
  definition(t) {
    t.implements(QuestionData)

    t.nonNull.field('options', {
      type: NumericalQuestionOptions,
    })
  },
})

export const FreeTextRestrictions = objectType({
  name: 'FreeTextRestrictions',
  definition(t) {
    t.int('maxLength')
  },
})

export const FreeTextQuestionOptions = objectType({
  name: 'FreeTextQuestionOptions',
  definition(t) {
    t.field('restrictions', {
      type: FreeTextRestrictions,
    })
    t.list.nonNull.string('solutions')
  },
})

export const FreeTextQuestionData = objectType({
  name: 'FreeTextQuestionData',
  definition(t) {
    t.implements(QuestionData)

    t.nonNull.field('options', {
      type: FreeTextQuestionOptions,
    })
  },
})

export const Question = objectType({
  name: 'Question',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.string('name')
    t.nonNull.string('type')
    t.nonNull.string('content')
    t.nonNull.string('contentPlain')

    t.nonNull.boolean('isArchived')
    t.nonNull.boolean('isDeleted')

    t.nonNull.field('questionData', {
      type: QuestionData,
    })

    t.nonNull.date('createdAt')
    t.date('updatedAt')

    t.list.nonNull.field('attachments', { type: Attachment })
    t.list.nonNull.field('tags', { type: Tag })
  },
})

export const QuestionFeedback = objectType({
  name: 'QuestionFeedback',
  definition(t) {
    t.nonNull.int('ix')
    t.nonNull.string('feedback')
    t.nonNull.boolean('correct')
    t.nonNull.string('value')
  },
})

export const InstanceEvaluation = objectType({
  name: 'InstanceEvaluation',
  definition(t) {
    t.list.nonNull.field('feedbacks', {
      type: QuestionFeedback,
    })
    t.nonNull.field('choices', {
      type: 'JSONObject',
    })
    t.nonNull.float('score')
    t.float('pointsAwarded')
    t.float('percentile')
    t.date('newPointsFrom')
  },
})

export const AttachmentType = enumType({
  name: 'AttachmentType',
  members: DB.AttachmentType,
})

export const Attachment = objectType({
  name: 'Attachment',
  definition(t) {
    t.nonNull.string('id')

    t.nonNull.string('href')
    t.nonNull.string('name')

    t.string('originalName')
    t.string('description')

    t.nonNull.field('type', { type: AttachmentType })
  },
})

export const QuestionInstance = objectType({
  name: 'QuestionInstance',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.field('questionData', {
      type: QuestionData,
    })

    t.field('evaluation', {
      type: InstanceEvaluation,
    })

    t.list.field('attachments', { type: Attachment })
  },
})

export const Course = objectType({
  name: 'Course',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('name')
    t.nonNull.string('displayName')
    t.string('color')

    t.nonNull.list.nonNull.field('learningElements', {
      type: LearningElement,
    })

    t.nonNull.list.nonNull.field('microSessions', {
      type: MicroSession,
    })

    t.nonNull.list.nonNull.field('sessions', {
      type: Session,
    })
  },
})

export const LearningElement = objectType({
  name: 'LearningElement',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('name')
    t.nonNull.string('displayName')

    t.nonNull.list.nonNull.field('instances', {
      type: QuestionInstance,
    })

    t.nonNull.field('course', {
      type: Course,
    })
  },
})

export const MicroSession = objectType({
  name: 'MicroSession',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('name')
    t.nonNull.string('displayName')
    t.string('description')

    t.nonNull.date('scheduledStartAt')
    t.nonNull.date('scheduledEndAt')

    t.nonNull.list.nonNull.field('instances', {
      type: QuestionInstance,
    })

    t.nonNull.field('course', {
      type: Course,
    })
  },
})

export const User = objectType({
  name: 'User',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.boolean('isActive')

    t.nonNull.string('email')
    t.nonNull.string('shortname')

    t.string('description')
  },
})

export const Participant = objectType({
  name: 'Participant',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('username')
    t.string('avatar')
    t.field('avatarSettings', {
      type: 'JSONObject',
    })
  },
})

export const PublicSubscriptionData = objectType({
  name: 'PublicSubscriptionData',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.string('endpoint')
  },
})

export const Participation = objectType({
  name: 'Participation',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.boolean('isActive')

    t.field('course', {
      type: Course,
    })
    t.list.nonNull.field('subscriptions', {
      type: PublicSubscriptionData,
    })
    t.list.string('completedMicroSessions')
  },
})

export const LeaderboardEntry = objectType({
  name: 'LeaderboardEntry',
  definition(t) {
    t.nonNull.id('id')
    t.nonNull.id('participantId')

    t.nonNull.string('username')
    t.string('avatar')

    t.nonNull.float('score')

    t.boolean('isSelf')
  },
})

export const ParticipantLearningData = objectType({
  name: 'ParticipantLearningData',
  definition(t) {
    t.nonNull.id('id')

    t.string('participantToken')

    t.field('participant', {
      type: Participant,
    })

    t.field('participation', {
      type: Participation,
    })

    t.field('course', {
      type: Course,
    })

    t.list.nonNull.field('leaderboard', {
      type: LeaderboardEntry,
    })
  },
})

export const Feedback = objectType({
  name: 'Feedback',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.boolean('isPublished')
    t.nonNull.boolean('isPinned')
    t.nonNull.boolean('isResolved')

    t.nonNull.string('content')

    t.nonNull.int('votes')

    t.list.field('responses', { type: FeedbackResponse })

    t.date('resolvedAt')
    t.date('createdAt')
    t.date('updatedAt')
  },
})

export const FeedbackResponse = objectType({
  name: 'FeedbackResponse',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.string('content')

    t.nonNull.int('positiveReactions')
    t.nonNull.int('negativeReactions')

    t.date('resolvedAt')
    t.nonNull.date('createdAt')
  },
})

export const ConfusionTimestep = objectType({
  name: 'ConfusionTimestep',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.int('difficulty')
    t.nonNull.int('speed')

    t.nonNull.date('createdAt')
  },
})

export const AggregatedConfusionFeedbacks = objectType({
  name: 'AggregatedConfusionFeedbacks',
  definition(t) {
    t.nonNull.float('difficulty')
    t.nonNull.float('speed')

    t.nonNull.int('numberOfParticipants')

    t.date('timestamp')
  },
})

export const SessionBlockStatus = enumType({
  name: 'SessionBlockStatus',
  members: DB.SessionBlockStatus,
})

export const SessionBlock = objectType({
  name: 'SessionBlock',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.field('status', {
      type: SessionBlockStatus,
    })
    t.date('expiresAt')
    t.int('timeLimit')
    t.boolean('randomSelection')
    t.nonNull.int('execution')

    t.nonNull.list.nonNull.field('instances', {
      type: QuestionInstance,
    })
  },
})

export const SessionStatus = enumType({
  name: 'SessionStatus',
  members: DB.SessionStatus,
})

export const AccessMode = enumType({
  name: 'AccessMode',
  members: DB.AccessMode,
})

export const Session = objectType({
  name: 'Session',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.boolean('isAudienceInteractionActive')
    t.nonNull.boolean('isModerationEnabled')
    t.nonNull.boolean('isGamificationEnabled')

    t.nonNull.string('namespace')
    t.nonNull.string('name')
    t.nonNull.string('displayName')
    t.string('linkTo')

    t.nonNull.field('status', {
      type: SessionStatus,
    })

    t.field('activeBlock', {
      type: SessionBlock,
    })

    t.list.nonNull.field('blocks', {
      type: SessionBlock,
    })

    t.nonNull.field('accessMode', { type: AccessMode })

    t.list.field('feedbacks', { type: Feedback })

    t.list.field('confusionFeedbacks', { type: AggregatedConfusionFeedbacks })

    t.field('course', { type: Course })

    t.nonNull.date('createdAt')
    t.date('startedAt')
    t.date('finishedAt')
  },
})

export const InstanceResults = objectType({
  name: 'InstanceResults',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.int('blockIx')
    t.nonNull.int('instanceIx')

    t.nonNull.field('status', {
      type: SessionBlockStatus,
    })

    t.nonNull.field('questionData', {
      type: QuestionData,
    })

    t.nonNull.int('participants')

    t.nonNull.field('results', {
      type: 'JSONObject',
    })
  },
})

export const SessionEvaluation = objectType({
  name: 'SessionEvaluation',
  definition(t) {
    t.nonNull.id('id')

    t.list.nonNull.field('instanceResults', {
      type: InstanceResults,
    })
  },
})

export const PushSubscription = objectType({
  name: 'PushSubscription',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.string('endpoint')
    t.int('expirationTime')
    t.nonNull.string('p256dh')
    t.nonNull.string('auth')
  },
})

export const Query = objectType({
  name: 'Query',
  definition(t) {
    t.field('self', {
      type: Participant,
      resolve(_, _args, ctx: ContextWithUser) {
        return ParticipantService.getParticipantProfile(
          { id: ctx.user.sub },
          ctx
        )
      },
    })

    t.field('userProfile', {
      type: User,
      resolve(_, _args, ctx: ContextWithUser) {
        return AccountService.getUserProfile({ id: ctx.user.sub }, ctx)
      },
    })

    t.field('learningElement', {
      type: LearningElement,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return LearningElementService.getLearningElementData(args, ctx)
      },
    })

    t.field('microSession', {
      type: MicroSession,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return MicroLearningService.getMicroSessionData(args, ctx)
      },
    })

    t.field('getCourseOverviewData', {
      type: ParticipantLearningData,
      args: {
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return ParticipantService.getCourseOverviewData(args, ctx)
      },
    })

    t.list.nonNull.field('participations', {
      type: Participation,
      args: {
        endpoint: stringArg(),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantService.getParticipations(args, ctx)
      },
    })

    t.field('session', {
      type: Session,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.getRunningSession(args, ctx)
      },
    })

    t.field('sessionEvaluation', {
      type: SessionEvaluation,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.getSessionEvaluation(args, ctx)
      },
    })

    t.field('cockpitSession', {
      type: Session,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.getCockpitSession(args, ctx)
      },
    })

    t.field('pinnedFeedbacks', {
      type: Session,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.getPinnedFeedbacks(args, ctx)
      },
    })

    t.list.nonNull.field('sessionLeaderboard', {
      type: LeaderboardEntry,
      args: {
        sessionId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.getLeaderboard(args, ctx)
      },
    })

    t.list.nonNull.field('feedbacks', {
      type: Feedback,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return FeedbackService.getFeedbacks(args, ctx)
      },
    })

    t.list.nonNull.field('runningSessions', {
      type: Session,
      args: {
        shortname: nonNull(stringArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return SessionService.getRunningSessions(args, ctx)
      },
    })

    t.list.nonNull.field('userSessions', {
      type: Session,
      resolve(_, _args, ctx: ContextWithUser) {
        return SessionService.getUserSessions({ userId: ctx.user.sub }, ctx)
      },
    })

    t.list.nonNull.field('userQuestions', {
      type: Question,
      resolve(_, _args, ctx: ContextWithUser) {
        return QuestionService.getUserQuestions({ userId: ctx.user.sub }, ctx)
      },
    })

    t.field('question', {
      type: Question,
      args: {
        id: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return QuestionService.getSingleQuestion(args, ctx)
      },
    })
  },
})

export const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.field('updateParticipantProfile', {
      type: Participant,
      args: {
        password: stringArg(),
        username: stringArg(),
        avatar: stringArg(),
        avatarSettings: arg({
          type: AvatarSettingsInput,
        }),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantService.updateParticipantProfile(args, ctx)
      },
    })

    t.field('loginUser', {
      type: 'ID',
      args: {
        email: nonNull(stringArg()),
        password: nonNull(stringArg()),
      },
      resolve(_, args, ctx: Context) {
        return AccountService.loginUser(args, ctx)
      },
    })

    t.field('loginParticipant', {
      type: 'ID',
      args: {
        username: nonNull(stringArg()),
        password: nonNull(stringArg()),
      },
      resolve(_, args, ctx: Context) {
        return AccountService.loginParticipant(args, ctx)
      },
    })

    t.field('logoutUser', {
      type: 'ID',
      resolve(_, args, ctx: ContextWithUser) {
        return AccountService.logoutUser(args, ctx)
      },
    })

    t.field('logoutParticipant', {
      type: 'ID',
      resolve(_, args, ctx: ContextWithUser) {
        return AccountService.logoutParticipant(args, ctx)
      },
    })

    t.field('registerParticipantFromLTI', {
      type: ParticipantLearningData,
      args: {
        courseId: nonNull(idArg()),
        participantId: nonNull(idArg()),
      },
      resolve(_, args, ctx: Context) {
        return ParticipantService.registerParticipantFromLTI(args, ctx)
      },
    })

    t.field('joinCourse', {
      type: ParticipantLearningData,
      args: {
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantService.joinCourse(args, ctx)
      },
    })

    t.field('leaveCourse', {
      type: ParticipantLearningData,
      args: {
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantService.leaveCourse(args, ctx)
      },
    })

    t.field('upvoteFeedback', {
      type: Feedback,
      args: {
        feedbackId: nonNull(intArg()),
        increment: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return FeedbackService.upvoteFeedback(args, ctx)
      },
    })

    t.field('voteFeedbackResponse', {
      type: FeedbackResponse,
      args: {
        id: nonNull(intArg()),
        incrementUpvote: nonNull(intArg()),
        incrementDownvote: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return FeedbackService.voteFeedbackResponse(args, ctx)
      },
    })

    t.field('createFeedback', {
      type: Feedback,
      args: {
        sessionId: nonNull(idArg()),
        content: nonNull(stringArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return FeedbackService.createFeedback(args, ctx)
      },
    })

    t.field('resolveFeedback', {
      type: Feedback,
      args: {
        id: nonNull(intArg()),
        isResolved: nonNull(booleanArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return FeedbackService.resolveFeedback(args, ctx)
      },
    })

    t.field('respondToFeedback', {
      type: Feedback,
      args: {
        id: nonNull(intArg()),
        responseContent: nonNull(stringArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return FeedbackService.respondToFeedback(args, ctx)
      },
    })

    t.field('deleteFeedback', {
      type: Feedback,
      args: {
        id: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return FeedbackService.deleteFeedback(args, ctx)
      },
    })

    t.field('deleteFeedbackResponse', {
      type: Feedback,
      args: {
        id: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return FeedbackService.deleteFeedbackResponse(args, ctx)
      },
    })

    t.field('respondToQuestionInstance', {
      type: QuestionInstance,
      args: {
        courseId: nonNull(idArg()),
        id: nonNull(intArg()),
        response: nonNull(
          arg({
            type: ResponseInput,
          })
        ),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return LearningElementService.respondToQuestionInstance(args, ctx)
      },
    })

    t.field('addConfusionTimestep', {
      type: ConfusionTimestep,
      args: {
        sessionId: nonNull(idArg()),
        difficulty: nonNull(intArg()),
        speed: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return FeedbackService.addConfusionTimestep(args, ctx)
      },
    })

    t.field('publishFeedback', {
      type: Feedback,
      args: {
        id: nonNull(intArg()),
        isPublished: nonNull(booleanArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return FeedbackService.publishFeedback(args, ctx)
      },
    })

    t.field('pinFeedback', {
      type: Feedback,
      args: {
        id: nonNull(intArg()),
        isPinned: nonNull(booleanArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return FeedbackService.pinFeedback(args, ctx)
      },
    })

    t.field('createCourse', {
      type: Course,
      args: {
        name: nonNull(stringArg()),
        displayName: stringArg(),
        color: stringArg(),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.createCourse(args, ctx)
      },
    })

    t.field('createSession', {
      type: Session,
      args: {
        name: nonNull(stringArg()),
        displayName: stringArg(),
        blocks: nonNull(
          list(
            arg({
              type: nonNull(BlockInput),
            })
          )
        ),
        courseId: stringArg(),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.createSession(args, ctx)
      },
    })

    t.field('startSession', {
      type: Session,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.startSession(args, ctx)
      },
    })

    t.field('endSession', {
      type: Session,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.endSession(args, ctx)
      },
    })

    t.field('changeSessionSettings', {
      type: Session,
      args: {
        id: nonNull(idArg()),
        isAudienceInteractionActive: booleanArg(),
        isModerationEnabled: booleanArg(),
        isGamificationEnabled: booleanArg(),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.changeSessionSettings(args, ctx)
      },
    })

    t.field('activateSessionBlock', {
      type: Session,
      args: {
        sessionId: nonNull(idArg()),
        sessionBlockId: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.activateSessionBlock(args, ctx)
      },
    })

    t.field('deactivateSessionBlock', {
      type: Session,
      args: {
        sessionId: nonNull(idArg()),
        sessionBlockId: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.deactivateSessionBlock(args, ctx)
      },
    })

    t.field('subscribeToPush', {
      type: Participation,
      args: {
        subscriptionObject: nonNull(SubscriptionObjectInput),
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return NotificationService.subscribeToPush(args, ctx)
      },
    })

    t.field('markMicroSessionCompleted', {
      type: Participation,
      args: {
        courseId: nonNull(idArg()),
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return MicroLearningService.markMicroSessionCompleted(args, ctx)
      },
    })

    t.field('editQuestion', {
      type: Question,
      args: {
        id: nonNull(intArg()),
        name: stringArg(),
        content: stringArg(),
        contentPlain: stringArg(),
        options: arg({ type: 'OptionsInput' }),
        attachments: list(arg({ type: 'AttachmentInput' })),
        tags: list(arg({ type: 'TagInput' })),
      },
      resolve(_, args, ctx: Context) {
        return QuestionService.editQuestion(args, ctx)
      },
    })
  },
})

export const Subscription = subscriptionType({
  definition(t) {
    t.field('runningSessionUpdated', {
      type: SessionBlock,
      args: {
        sessionId: nonNull(idArg()),
      },
      subscribe: (_, args, ctx) =>
        pipe(
          ctx.pubSub.subscribe('runningSessionUpdated'),
          filter((data) => data.sessionId === args.sessionId)
        ),
      resolve: (payload) => payload.block,
    })

    t.field('feedbackCreated', {
      type: Feedback,
      args: {
        sessionId: nonNull(idArg()),
      },
      subscribe: (_, args, ctx) =>
        pipe(
          ctx.pubSub.subscribe('feedbackCreated'),
          filter((data) => data.sessionId === args.sessionId)
        ),
      resolve: (payload) => payload,
    })

    t.field('feedbackAdded', {
      type: Feedback,
      args: {
        sessionId: nonNull(idArg()),
      },
      subscribe: (_, args, ctx) =>
        pipe(
          ctx.pubSub.subscribe('feedbackAdded'),
          filter((data) => data.sessionId === args.sessionId)
        ),
      resolve: (payload) => payload,
    })

    t.int('feedbackRemoved', {
      args: {
        sessionId: nonNull(idArg()),
      },
      subscribe: (_, args, ctx) =>
        pipe(
          ctx.pubSub.subscribe('feedbackRemoved'),
          filter((data) => data.sessionId === args.sessionId)
        ),
      resolve: (payload) => payload.id,
    })

    t.field('feedbackUpdated', {
      type: Feedback,
      args: {
        sessionId: nonNull(idArg()),
      },
      subscribe: (_, args, ctx) =>
        pipe(
          ctx.pubSub.subscribe('feedbackUpdated'),
          filter((data) => data.sessionId === args.sessionId)
        ),
      resolve: (payload) => payload,
    })
  },
})
