import * as DB from '@klicker-uzh/prisma'
import { DateTimeResolver, JSONObjectResolver } from 'graphql-scalars'
import {
  arg,
  asNexusMethod,
  enumType,
  idArg,
  inputObjectType,
  interfaceType,
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
import * as LearningElementService from './services/learningElements'
import * as ParticipantService from './services/participants'
import * as SessionService from './services/sessions'

export const jsonScalar = asNexusMethod(JSONObjectResolver, 'json')
export const dateTimeScalar = asNexusMethod(DateTimeResolver, 'date')

export const ResponseInput = inputObjectType({
  name: 'ResponseInput',
  definition(t) {
    t.list.int('choices')
    t.string('value')
  },
})

export const QuestionData = interfaceType({
  name: 'QuestionData',
  definition(t) {
    t.id('id')

    t.nonNull.string('name')
    t.nonNull.string('type')
    t.nonNull.string('content')
    t.nonNull.string('contentPlain')

    t.nonNull.boolean('isArchived')
    t.nonNull.boolean('isDeleted')
  },
  resolveType: (item) => {
    if (item.type === DB.QuestionType.SC || item.type === DB.QuestionType.MC) {
      return 'ChoicesQuestionData'
    }
    return null
  },
})

export const Choice = objectType({
  name: 'Choice',
  definition(t) {
    t.nonNull.string('value')
    t.boolean('correct')
    t.string('feedback')
  },
})

export const ChoicesQuestionOptions = objectType({
  name: 'ChoicesQuestionOptions',
  definition(t) {
    t.list.field('choices', {
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

export const QuestionFeedback = objectType({
  name: 'QuestionFeedback',
  definition(t) {
    t.int('ix')
    t.string('feedback')
    t.boolean('correct')
    t.string('value')
  },
})

export const InstanceEvaluation = objectType({
  name: 'InstanceEvaluation',
  definition(t) {
    t.list.field('feedbacks', {
      type: QuestionFeedback,
    })
    t.field('choices', {
      type: 'JSONObject',
    })
  },
})

export const QuestionInstance = objectType({
  name: 'QuestionInstance',
  definition(t) {
    t.id('id')

    t.field('questionData', {
      type: QuestionData,
    })

    t.field('evaluation', {
      type: InstanceEvaluation,
    })
  },
})

export const Course = objectType({
  name: 'Course',
  definition(t) {
    t.id('id')

    t.nonNull.string('name')
    t.string('displayName')

    t.list.field('learningElements', {
      type: LearningElement,
    })
  },
})

export const LearningElement = objectType({
  name: 'LearningElement',
  definition(t) {
    t.id('id')

    t.list.field('instances', {
      type: QuestionInstance,
    })

    t.field('course', {
      type: Course,
    })
  },
})

export const Participant = objectType({
  name: 'Participant',
  definition(t) {
    t.id('id')

    t.string('avatar')
    t.string('username')
  },
})

export const Participation = objectType({
  name: 'Participation',
  definition(t) {
    t.id('id')

    t.boolean('isActive')
    t.int('points')
  },
})

export const ParticipantLearningData = objectType({
  name: 'ParticipantLearningData',
  definition(t) {
    t.id('id')

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
  },
})

export const SessionBlockStatus = enumType({
  name: 'SessionBlockStatus',
  members: DB.SessionBlockStatus,
})

export const SessionBlock = objectType({
  name: 'SessionBlock',
  definition(t) {
    t.id('id')

    t.nonNull.field('status', {
      type: SessionBlockStatus,
    })
    t.date('expiresAt')
    t.int('timeLimit')
    t.boolean('randomSelection')

    t.list.field('instances', {
      type: QuestionInstance,
    })
  },
})

export const SessionStatus = enumType({
  name: 'SessionStatus',
  members: DB.SessionStatus,
})

export const Session = objectType({
  name: 'Session',
  definition(t) {
    t.id('id')

    t.nonNull.boolean('isAudienceInteractionActive')
    t.nonNull.boolean('isFeedbackChannelPublic')

    t.nonNull.string('namespace')
    t.nonNull.int('execution')
    t.nonNull.string('name')
    t.nonNull.string('displayName')

    t.nonNull.field('status', {
      type: SessionStatus,
    })

    t.nonNull.int('activeBlock')
    t.list.field('blocks', {
      type: SessionBlock,
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

    t.field('learningElement', {
      type: LearningElement,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithOptionalUser) {
        return LearningElementService.getLearningElementData(args, ctx)
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

    t.list.field('getParticipantCourses', {
      type: Course,
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantService.getParticipantCourses(args, ctx)
      },
    })

    t.field('session', {
      type: Session,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.getSession(args, ctx)
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

    t.field('registerParticipantFromLTI', {
      type: ParticipantLearningData,
      args: {
        courseId: nonNull(idArg()),
        participantId: nonNull(idArg()),
        participantEmail: nonNull(idArg()),
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

    t.field('respondToQuestionInstance', {
      type: QuestionInstance,
      args: {
        courseId: nonNull(idArg()),
        id: nonNull(idArg()),
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

    t.field('startSession', {
      type: Session,
      args: {
        id: nonNull(idArg()),
      },
      resolve(_, args, ctx: ContextWithUser) {
        return SessionService.startSession(args, ctx)
      },
    })
  },
})
