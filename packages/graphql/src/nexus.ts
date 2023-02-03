import * as DB from '@klicker-uzh/prisma'
import { DateTimeResolver, JSONObjectResolver } from 'graphql-scalars'
import { filter, pipe } from 'graphql-yoga'
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
import * as CourseService from './services/courses'
import * as FeedbackService from './services/feedbacks'
import * as ParticipantGroupService from './services/groups'
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
    t.nonNull.int('ix')
    t.boolean('correct')
    t.nonNull.string('value')
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

export const OptionsChoicesInput = inputObjectType({
  name: 'OptionsChoicesInput',
  definition(t) {
    t.nonNull.list.field('choices', {
      type: ChoiceInput,
    })
  },
})

export const OptionsNumericalInput = inputObjectType({
  name: 'OptionsNumericalInput',
  definition(t) {
    t.int('accuracy')
    t.field('restrictions', { type: Restrictions })
    t.list.field('solutionRanges', { type: SolutionRange })
  },
})

export const OptionsFreeTextInput = inputObjectType({
  name: 'OptionsFreeTextInput',
  definition(t) {
    t.field('restrictions', { type: Restrictions })
    t.list.string('solutions')
  },
})

export const AttachmentInput = inputObjectType({
  name: 'AttachmentInput',
  definition(t) {
    t.nonNull.string('id')
  },
})

export const QuestionData = interfaceType({
  name: 'QuestionData',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.string('name')
    t.nonNull.string('type')
    t.nonNull.string('content')
    t.int('pointsMultiplier')

    t.nonNull.boolean('hasSampleSolution')
    t.nonNull.boolean('hasAnswerFeedbacks')

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

export const EvaluationData = interfaceType({
  name: 'EvaluationData',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.string('name')
    t.nonNull.string('type')
    t.nonNull.string('content')
  },
  resolveType: (item) => {
    if (
      item.type === DB.QuestionType.SC ||
      item.type === DB.QuestionType.MC ||
      item.type === DB.QuestionType.KPRIM
    ) {
      return 'ChoicesEvaluationData'
    } else if (item.type === DB.QuestionType.NUMERICAL) {
      return 'NumericalEvaluationData'
    } else if (item.type === DB.QuestionType.FREE_TEXT) {
      return 'FreeTextEvaluationData'
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

export const ChoicesEvaluationData = objectType({
  name: 'ChoicesEvaluationData',
  definition(t) {
    t.implements(EvaluationData)

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
    t.int('accuracy')
    t.string('placeholder')
    t.string('unit')
    t.field('restrictions', {
      type: NumericalRestrictions,
    })
    t.list.nonNull.field('solutionRanges', {
      type: NumericalSolutionRange,
    })
  },
})

export const Statistics = objectType({
  name: 'Statistics',
  definition(t) {
    t.float('max')
    t.float('mean')
    t.float('median')
    t.float('min')
    t.float('q1')
    t.float('q3')
    t.float('sd')
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

export const NumericalEvaluationData = objectType({
  name: 'NumericalEvaluationData',
  definition(t) {
    t.implements(EvaluationData)

    t.nonNull.field('options', {
      type: NumericalQuestionOptions,
    })
    t.field('statistics', {
      type: Statistics,
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

export const FreeTextEvaluationData = objectType({
  name: 'FreeTextEvaluationData',
  definition(t) {
    t.implements(EvaluationData)

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
    t.nonNull.int('pointsMultiplier')
    t.nonNull.string('content')

    t.nonNull.boolean('isArchived')
    t.nonNull.boolean('isDeleted')

    t.nonNull.boolean('hasSampleSolution')
    t.nonNull.boolean('hasAnswerFeedbacks')

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
    t.nonNull.id('id')

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

    t.nonNull.int('pointsMultiplier')

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
    t.boolean('isArchived')
    t.string('description')

    t.int('pinCode')
    t.int('numOfParticipants')
    t.int('numOfActiveParticipants')
    t.float('averageScore')
    t.float('averageActiveScore')

    t.nonNull.list.nonNull.field('learningElements', {
      type: LearningElement,
    })

    t.nonNull.list.nonNull.field('microSessions', {
      type: MicroSession,
    })

    t.nonNull.list.nonNull.field('sessions', {
      type: Session,
    })

    t.nonNull.list.field('participantGroups', { type: ParticipantGroup })

    t.list.nonNull.field('awards', {
      type: AwardEntry,
    })

    t.list.field('leaderboard', { type: LeaderboardEntry })

    t.date('createdAt')
    t.date('updatedAt')
  },
})

export const OrderType = enumType({
  name: 'OrderType',
  members: DB.OrderType,
})

export const LearningElement = objectType({
  name: 'LearningElement',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('name')
    t.nonNull.string('displayName')
    t.string('description')
    t.nonNull.int('pointsMultiplier')
    t.nonNull.int('resetTimeDays')
    t.nonNull.field('orderType', {
      type: OrderType,
    })

    t.int('previouslyAnswered')
    t.float('previousScore')
    t.float('previousPointsAwarded')
    t.int('totalTrials')

    t.list.nonNull.field('instances', {
      type: QuestionInstance,
    })

    t.string('courseId')
    t.field('course', {
      type: Course,
    })

    t.int('numOfInstances')
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

    t.list.nonNull.field('instances', {
      type: QuestionInstance,
    })

    t.nonNull.int('pointsMultiplier')

    t.nonNull.field('course', {
      type: Course,
    })

    t.int('numOfInstances')
  },
})

export const User = objectType({
  name: 'User',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.boolean('isActive')

    t.nonNull.string('email')
    t.nonNull.string('shortname')

    t.string('loginToken')
    t.date('loginTokenExpiresAt')

    t.string('description')
  },
})

export const AchievementType = enumType({
  name: 'AchievementType',
  members: DB.AchievementType,
})

export const Achievement = objectType({
  name: 'Achievement',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.string('name')
    t.nonNull.string('description')
    t.nonNull.string('icon')
    t.string('iconColor')

    t.int('rewardedPoints')
    t.int('rewardedXP')
    t.list.nonNull.string('rewardedTitles')
    t.nonNull.field('type', {
      type: AchievementType,
    })
  },
})

export const ParticipantAchievementInstance = objectType({
  name: 'ParticipantAchievementInstance',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.date('achievedAt')
    t.nonNull.int('achievedCount')

    t.nonNull.field('achievement', {
      type: Achievement,
    })
  },
})

export const GroupAchievementInstance = objectType({
  name: 'GroupAchievementInstance',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.date('achievedAt')
    t.nonNull.int('achievedCount')

    t.nonNull.field('achievement', {
      type: Achievement,
    })
  },
})

export const ClassAchievementInstance = objectType({
  name: 'ClassAchievementInstance',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.date('achievedAt')
    t.nonNull.int('achievedCount')

    t.nonNull.field('achievement', {
      type: Achievement,
    })
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
    t.boolean('isSelf')

    t.list.nonNull.field('participantGroups', { type: ParticipantGroup })
    t.nonNull.list.nonNull.field('achievements', {
      type: ParticipantAchievementInstance,
    })
  },
})

export const ParticipantGroup = objectType({
  name: 'ParticipantGroup',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('name')
    t.nonNull.int('code')

    t.nonNull.float('groupActivityScore')
    t.nonNull.float('averageMemberScore')
    t.nonNull.float('score')

    t.nonNull.list.nonNull.field('participants', {
      type: LeaderboardEntry,
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
    t.field('participant', { type: Participant })
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
    t.nonNull.int('rank')

    t.boolean('isSelf')

    t.field('participation', {
      type: Participation,
    })

    t.int('lastBlockOrder')
  },
})

export const GroupLeaderboardEntry = objectType({
  name: 'GroupLeaderboardEntry',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('name')
    t.nonNull.float('score')
    t.nonNull.int('rank')
    t.boolean('isMember')
  },
})

export const LeaderboardStatistics = objectType({
  name: 'LeaderboardStatistics',
  definition(t) {
    t.nonNull.int('participantCount')
    t.nonNull.float('averageScore')
    // TODO: add histogram bins
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

    t.nonNull.field('course', {
      type: Course,
    })

    t.list.nonNull.field('leaderboard', {
      type: LeaderboardEntry,
    })

    t.nonNull.field('leaderboardStatistics', {
      type: LeaderboardStatistics,
    })

    t.list.nonNull.field('groupLeaderboard', {
      type: GroupLeaderboardEntry,
    })

    t.nonNull.field('groupLeaderboardStatistics', {
      type: LeaderboardStatistics,
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

    t.nonNull.int('order')

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
    t.string('description')
    t.nonNull.string('displayName')
    t.string('linkTo')
    t.int('pinCode')

    t.int('numOfBlocks')
    t.int('numOfQuestions')

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

    t.nonNull.int('pointsMultiplier')

    t.nonNull.date('createdAt')
    t.date('updatedAt')
    t.date('startedAt')
    t.date('finishedAt')
  },
})

export const InstanceResult = objectType({
  name: 'InstanceResult',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.int('blockIx')
    t.nonNull.int('instanceIx')

    t.nonNull.field('status', {
      type: SessionBlockStatus,
    })

    t.nonNull.field('questionData', {
      type: EvaluationData,
    })

    t.nonNull.int('participants')

    t.nonNull.field('results', {
      type: 'JSONObject',
    })
    t.field('statistics', {
      type: Statistics,
    })
  },
})

export const TabData = objectType({
  name: 'TabData',
  definition(t) {
    t.nonNull.id('id')
    t.nonNull.int('questionIx')
    t.nonNull.string('name')
    t.nonNull.string('status')
  },
})

export const Block = objectType({
  name: 'Block',
  definition(t) {
    t.nonNull.int('blockIx')
    t.nonNull.string('blockStatus')
    t.list.nonNull.field('tabData', {
      type: TabData,
    })
  },
})

export const SessionEvaluation = objectType({
  name: 'SessionEvaluation',
  definition(t) {
    t.nonNull.id('id')
    t.nonNull.field('status', { type: SessionStatus })
    t.nonNull.boolean('isGamificationEnabled')
    t.list.nonNull.field('blocks', {
      type: Block,
    })
    t.list.nonNull.field('instanceResults', {
      type: InstanceResult,
    })
    t.list.nonNull.field('feedbacks', { type: Feedback })

    t.list.nonNull.field('confusionFeedbacks', { type: ConfusionTimestep })
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

export const GroupActivityDecisionInput = inputObjectType({
  name: 'GroupActivityDecisionInput',
  definition(t) {
    t.nonNull.int('id')

    t.list.nonNull.int('selectedOptions')
    t.string('response')
  },
})

export const ParameterType = enumType({
  name: 'ParameterType',
  members: DB.ParameterType,
})

export const GroupActivityClue = objectType({
  name: 'GroupActivityClue',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('name')
    t.nonNull.string('displayName')
  },
})

export const GroupActivityClueWithValue = objectType({
  name: 'GroupActivityClueWithValue',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('name')
    t.nonNull.string('displayName')
    t.string('value')
    t.string('unit')
    t.nonNull.field('type', {
      type: ParameterType,
    })

    t.nonNull.field('participant', {
      type: Participant,
    })
  },
})

export const GroupActivityInstance = objectType({
  name: 'GroupActivityInstance',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.list.nonNull.field('clues', {
      type: GroupActivityClueWithValue,
    })

    t.list.nonNull.json('decisions')
    t.date('decisionsSubmittedAt')
  },
})

export const GroupActivityDetails = objectType({
  name: 'GroupActivityDetails',
  definition(t) {
    t.nonNull.id('id')

    t.nonNull.string('name')
    t.nonNull.string('displayName')
    t.string('description')
    t.nonNull.date('scheduledStartAt')
    t.nonNull.date('scheduledEndAt')

    t.nonNull.field('group', {
      type: ParticipantGroup,
    })
    t.nonNull.field('course', {
      type: Course,
    })
    t.field('activityInstance', {
      type: GroupActivityInstance,
    })
    t.nonNull.list.nonNull.field('clues', {
      type: GroupActivityClue,
    })
    t.nonNull.list.nonNull.field('instances', {
      type: QuestionInstance,
    })
  },
})

export const AwardType = enumType({
  name: 'AwardType',
  members: DB.AwardType,
})

export const AwardEntry = objectType({
  name: 'AwardEntry',
  definition(t) {
    t.nonNull.int('id')

    t.nonNull.int('order')
    t.nonNull.field('type', {
      type: AwardType,
    })
    t.nonNull.string('name')
    t.nonNull.string('displayName')
    t.nonNull.string('description')

    t.nonNull.field('course', {
      type: Course,
    })

    t.field('participant', {
      type: Participant,
    })

    t.field('participantGroup', {
      type: ParticipantGroup,
    })
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

    t.field('getLoginToken', {
      type: User,
      resolve(_, _args, ctx: ContextWithUser) {
        return AccountService.getLoginToken({ id: ctx.user.sub }, ctx)
      },
    })

    t.field('userProfile', {
      type: User,
      resolve(_, _args, ctx: ContextWithUser) {
        return AccountService.getUserProfile({ id: ctx.user.sub }, ctx)
      },
    })

    t.list.nonNull.field('userTags', {
      type: Tag,
      resolve(_, _args, ctx: ContextWithUser) {
        return QuestionService.getUserTags(ctx)
      },
    })

    t.field('liveSession', {
      type: Session,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return SessionService.getLiveSessionData(args, ctx)
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

    t.field('singleMicroSession', {
      type: MicroSession,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return MicroLearningService.getSingleMicroSession(args, ctx)
      },
    })

    t.field('getCourseOverviewData', {
      type: ParticipantLearningData,
      args: {
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return CourseService.getCourseOverviewData(args, ctx)
      },
    })

    t.field('course', {
      type: Course,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return CourseService.getCourseData(args, ctx)
      },
    })

    t.field('controlCourse', {
      type: Course,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return CourseService.getControlCourse(args, ctx)
      },
    })

    t.field('basicCourseInformation', {
      type: Course,
      args: {
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return CourseService.getBasicCourseInformation(args, ctx)
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

    t.list.nonNull.field('participantGroups', {
      type: ParticipantGroup,
      args: {
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantGroupService.getParticipantGroups(args, ctx)
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

    t.field('controlSession', {
      type: Session,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.getControlSession(args, ctx)
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

    t.list.nonNull.field('userCourses', {
      type: Course,
      resolve(_, _args, ctx: ContextWithUser) {
        return CourseService.getUserCourses({ userId: ctx.user.sub }, ctx)
      },
    })

    t.list.nonNull.field('controlCourses', {
      type: Course,
      resolve(_, _args, ctx: ContextWithUser) {
        return CourseService.getControlCourses({ userId: ctx.user.sub }, ctx)
      },
    })

    t.list.nonNull.field('userSessions', {
      type: Session,
      resolve(_, _args, ctx: ContextWithUser) {
        return SessionService.getUserSessions({ userId: ctx.user.sub }, ctx)
      },
    })

    t.list.nonNull.field('unassignedSessions', {
      type: Session,
      resolve(_, _args, ctx: ContextWithUser) {
        return SessionService.getUnassignedSessions(
          { userId: ctx.user.sub },
          ctx
        )
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

    t.field('groupActivityDetails', {
      type: GroupActivityDetails,
      args: {
        activityId: nonNull(idArg()),
        groupId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantGroupService.getGroupActivityDetails(args, ctx)
      },
    })

    t.nonNull.list.nonNull.field('learningElements', {
      type: LearningElement,
      resolve(_, _args, ctx: ContextWithUser) {
        return CourseService.getUserLearningElements(ctx)
      },
    })
  },
})

export const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.field('changeCourseDescription', {
      type: Course,
      args: {
        courseId: nonNull(idArg()),
        input: nonNull(stringArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return CourseService.changeCourseDescription(args, ctx)
      },
    })

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

    t.field('loginUserToken', {
      type: 'ID',
      args: {
        email: nonNull(stringArg()),
        token: nonNull(stringArg()),
      },
      resolve(_, args, ctx: Context) {
        return AccountService.loginUserToken(args, ctx)
      },
    })

    t.field('generateLoginToken', {
      type: User,
      resolve(_, args, ctx: ContextWithUser) {
        return AccountService.generateLoginToken(args, ctx)
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

    t.field('createParticipantAndJoinCourse', {
      type: Participant,
      args: {
        username: nonNull(stringArg()),
        password: nonNull(stringArg()),
        courseId: nonNull(idArg()),
        pin: nonNull(intArg()),
      },
      resolve(_, args, ctx: Context) {
        return ParticipantService.createParticipantAndJoinCourse(args, ctx)
      },
    })

    t.field('joinCourse', {
      type: ParticipantLearningData,
      args: {
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return CourseService.joinCourse(args, ctx)
      },
    })

    t.field('joinCourseWithPin', {
      type: Participant,
      args: {
        courseId: nonNull(idArg()),
        pin: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return CourseService.joinCourseWithPin(args, ctx)
      },
    })

    t.field('leaveCourse', {
      type: ParticipantLearningData,
      args: {
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return CourseService.leaveCourse(args, ctx)
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

    t.field('cancelSession', {
      type: Session,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.cancelSession(args, ctx)
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
        return CourseService.createCourse(args, ctx)
      },
    })

    t.field('createSession', {
      type: Session,
      args: {
        name: nonNull(stringArg()),
        displayName: stringArg(),
        description: stringArg(),
        blocks: nonNull(
          list(
            arg({
              type: nonNull(BlockInput),
            })
          )
        ),
        courseId: stringArg(),
        multiplier: nonNull(intArg()),
        isGamificationEnabled: booleanArg(),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.createSession(args, ctx)
      },
    })

    t.field('createMicroSession', {
      type: MicroSession,
      args: {
        name: nonNull(stringArg()),
        displayName: nonNull(stringArg()),
        description: stringArg(),
        questions: nonNull(list(intArg())),
        courseId: stringArg(),
        multiplier: nonNull(intArg()),
        startDate: nonNull(stringArg()),
        endDate: nonNull(stringArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return MicroLearningService.createMicroSession(args, ctx)
      },
    })

    t.field('createLearningElement', {
      type: MicroSession,
      args: {
        name: nonNull(stringArg()),
        displayName: nonNull(stringArg()),
        description: stringArg(),
        questions: nonNull(list(intArg())),
        courseId: stringArg(),
        multiplier: nonNull(intArg()),
        order: nonNull(arg({ type: 'OrderType' })),
        resetTimeDays: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return LearningElementService.createLearningElement(args, ctx)
      },
    })

    t.field('editTag', {
      type: Tag,
      args: {
        id: nonNull(intArg()),
        name: nonNull(stringArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return QuestionService.editTag(args, ctx)
      },
    })

    t.field('deleteTag', {
      type: Tag,
      args: {
        id: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return QuestionService.deleteTag(args, ctx)
      },
    })

    t.field('editSession', {
      type: Session,
      args: {
        id: nonNull(idArg()),
        name: nonNull(stringArg()),
        displayName: stringArg(),
        description: stringArg(),
        blocks: nonNull(
          list(
            arg({
              type: nonNull(BlockInput),
            })
          )
        ),
        courseId: stringArg(),
        multiplier: nonNull(intArg()),
        isGamificationEnabled: booleanArg(),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.editSession(args, ctx)
      },
    })

    t.field('editMicroSession', {
      type: MicroSession,
      args: {
        id: nonNull(idArg()),
        name: nonNull(stringArg()),
        displayName: nonNull(stringArg()),
        description: stringArg(),
        questions: nonNull(list(intArg())),
        courseId: stringArg(),
        multiplier: nonNull(intArg()),
        startDate: nonNull(stringArg()),
        endDate: nonNull(stringArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return MicroLearningService.editMicroSession(args, ctx)
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

    t.field('manipulateChoicesQuestion', {
      type: Question,
      args: {
        id: intArg(),
        type: stringArg(),
        name: stringArg(),
        content: stringArg(),
        hasSampleSolution: booleanArg(),
        hasAnswerFeedbacks: booleanArg(),
        options: arg({ type: 'OptionsChoicesInput' }),
        attachments: list(arg({ type: 'AttachmentInput' })),
        tags: list(stringArg()),
      },
      resolve(_, args, ctx: Context) {
        return QuestionService.manipulateQuestion(args, ctx)
      },
    })

    t.field('manipulateNUMERICALQuestion', {
      type: Question,
      args: {
        id: intArg(),
        type: stringArg(),
        name: stringArg(),
        content: stringArg(),
        hasSampleSolution: booleanArg(),
        hasAnswerFeedbacks: booleanArg(),
        options: arg({ type: 'OptionsNumericalInput' }),
        attachments: list(arg({ type: 'AttachmentInput' })),
        tags: list(stringArg()),
      },
      resolve(_, args, ctx: Context) {
        return QuestionService.manipulateQuestion(args, ctx)
      },
    })

    t.field('manipulateFREETEXTQuestion', {
      type: Question,
      args: {
        id: intArg(),
        type: stringArg(),
        name: stringArg(),
        content: stringArg(),
        hasSampleSolution: booleanArg(),
        hasAnswerFeedbacks: booleanArg(),
        options: arg({ type: 'OptionsFreeTextInput' }),
        attachments: list(arg({ type: 'AttachmentInput' })),
        tags: list(stringArg()),
      },
      resolve(_, args, ctx: Context) {
        return QuestionService.manipulateQuestion(args, ctx)
      },
    })

    t.field('deleteQuestion', {
      type: Question,
      args: {
        id: intArg(),
      },
      resolve(_, args, ctx: Context) {
        return QuestionService.deleteQuestion(args, ctx)
      },
    })

    t.field('createParticipantGroup', {
      type: ParticipantGroup,
      args: {
        courseId: nonNull(idArg()),
        name: nonNull(stringArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantGroupService.createParticipantGroup(args, ctx)
      },
    })

    t.field('joinParticipantGroup', {
      type: ParticipantGroup,
      args: {
        courseId: nonNull(idArg()),
        code: nonNull(intArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantGroupService.joinParticipantGroup(args, ctx)
      },
    })

    t.field('leaveParticipantGroup', {
      type: ParticipantGroup,
      args: {
        groupId: nonNull(idArg()),
        courseId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantGroupService.leaveParticipantGroup(args, ctx)
      },
    })

    t.boolean('updateGroupAverageScores', {
      resolve(_, _args, ctx: Context) {
        return ParticipantGroupService.updateGroupAverageScores(ctx)
      },
    })

    t.field('startGroupActivity', {
      type: GroupActivityDetails,
      args: {
        activityId: nonNull(idArg()),
        groupId: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantGroupService.startGroupActivity(args, ctx)
      },
    })

    t.field('submitGroupActivityDecisions', {
      type: GroupActivityDetails,
      args: {
        activityInstanceId: nonNull(intArg()),
        decisions: nonNull(
          list(nonNull(arg({ type: 'GroupActivityDecisionInput' })))
        ),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantGroupService.submitGroupActivityDecisions(args, ctx)
      },
    })

    t.field('changeCourseColor', {
      type: Course,
      args: {
        courseId: nonNull(idArg()),
        color: nonNull(stringArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return CourseService.changeCourseColor(args, ctx)
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
