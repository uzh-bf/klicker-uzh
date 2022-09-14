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
import * as ParticipantService from './services/participants'
import * as SessionService from './services/sessions'

export const jsonScalar = asNexusMethod(JSONObjectResolver, 'json')
export const dateTimeScalar = asNexusMethod(DateTimeResolver, 'date')

export const BlockInput = inputObjectType({
  name: 'BlockInput',
  definition(t) {
    t.nonNull.list.nonNull.int('questionIds')
    t.int('randomSelection')
    t.int('timeLimit')
  },
})

export const ResponseInput = inputObjectType({
  name: 'ResponseInput',
  definition(t) {
    t.list.nonNull.int('choices')
    t.string('value')
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

export const Choice = objectType({
  name: 'Choice',
  definition(t) {
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

    t.nonNull.list.field('attachments', { type: Attachment })
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

    t.nonNull.string('avatar')
    t.nonNull.string('username')
  },
})

export const Participation = objectType({
  name: 'Participation',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.boolean('isActive')
    t.nonNull.int('points')

    t.nonNull.field('course', {
      type: Course,
    })
  },
})

export const ParticipantLearningData = objectType({
  name: 'ParticipantLearningData',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('participantToken')

    t.nonNull.field('participant', {
      type: Participant,
    })

    t.nonNull.field('participation', {
      type: Participation,
    })

    t.nonNull.field('course', {
      type: Course,
    })
  },
})

export const LeaderboardEntry = objectType({
  name: 'LeaderboardEntry',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('username')
    t.string('avatar')

    t.nonNull.float('score')
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

    t.nonNull.field('status', {
      type: SessionStatus,
    })

    t.field('activeBlock', {
      type: SessionBlock,
    })
    t.nonNull.list.nonNull.field('blocks', {
      type: SessionBlock,
    })

    t.nonNull.field('accessMode', { type: AccessMode })

    t.list.field('feedbacks', { type: Feedback })

    t.list.field('confusionFeedbacks', { type: ConfusionTimestep })

    t.field('course', { type: Course })

    t.nonNull.date('createdAt')
  },
})

export const LecturerSession = objectType({
  name: 'LecturerSession',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.boolean('isAudienceInteractionActive')
    t.nonNull.boolean('isModerationEnabled')
    t.nonNull.boolean('isGamificationEnabled')

    t.nonNull.string('namespace')
    t.nonNull.string('name')
    t.nonNull.string('displayName')

    t.nonNull.field('status', {
      type: SessionStatus,
    })

    t.field('activeBlock', {
      type: SessionBlock,
    })
    t.nonNull.list.nonNull.field('blocks', {
      type: SessionBlock,
    })

    t.nonNull.field('accessMode', { type: AccessMode })

    t.list.field('feedbacks', { type: Feedback })

    t.list.field('confusionFeedbacks', { type: AggregatedConfusionFeedbacks })

    t.field('course', { type: Course })

    t.date('startedAt')
    t.date('finishedAt')
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

    t.field('cockpitSession', {
      type: LecturerSession,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.getCockpitSession(args, ctx)
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
  },
})

export const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
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
      args: {
        userId: nonNull(idArg()),
      },
      resolve(_, args, ctx: Context) {
        return AccountService.logoutUser(args, ctx)
      },
    })

    t.field('logoutParticipant', {
      type: 'ID',
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: Context) {
        return AccountService.logoutParticipant(args, ctx)
      },
    })

    t.field('registerParticipantFromLTI', {
      type: ParticipantLearningData,
      args: {
        courseId: nonNull(idArg()),
        participantId: nonNull(idArg()),
        participantEmail: nonNull(stringArg()),
      },
      resolve(_, args, ctx: Context) {
        return ParticipantService.registerParticipantFromLTI(args, ctx)
      },
    })

    t.field('joinCourse', {
      type: Participation,
      args: {
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantService.joinCourse(args, ctx)
      },
    })

    t.field('leaveCourse', {
      type: Participation,
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
        isPublished: nonNull(booleanArg()),
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
      type: FeedbackResponse,
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
  },
})
