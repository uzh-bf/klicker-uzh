import { QuestionType } from '@klicker-uzh/prisma'
import { DateTimeResolver, JSONObjectResolver } from 'graphql-scalars'
import {
  arg,
  asNexusMethod,
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
    if (item.type === QuestionType.SC || item.type === QuestionType.MC) {
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

export const QuestionInstance = objectType({
  name: 'QuestionInstance',
  definition(t) {
    t.id('id')

    t.field('questionData', {
      type: QuestionData,
    })

    t.field('evaluation', {
      type: 'JSONObject',
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
    t.string('pseudonym')
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

export const Query = objectType({
  name: 'Query',
  definition(t) {
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
  },
})

export const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.field('login', {
      type: 'ID',
      args: {
        email: nonNull(stringArg()),
        password: nonNull(stringArg()),
      },
      resolve(_, args, ctx: Context) {
        return AccountService.login(args, ctx)
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
  },
})
