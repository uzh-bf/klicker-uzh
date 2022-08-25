import { DateTimeResolver, JSONObjectResolver } from 'graphql-scalars'
import { asNexusMethod, idArg, nonNull, objectType, stringArg } from 'nexus'
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

export const QuestionInstance = objectType({
  name: 'QuestionInstance',
  definition(t) {
    t.nonNull.id('id')

    t.field('questionData', {
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

    t.list.field('getParticipantCourses', {
      type: Course,
      resolve(_, args, ctx: ContextWithUser) {
        return ParticipantService.getParticipantCourses(args, ctx)
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
  },
})
