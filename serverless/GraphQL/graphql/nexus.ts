import { idArg, nonNull, objectType, stringArg } from 'nexus'
import { Context } from '../lib/context'
import * as AccountService from '../services/accounts'
import * as LearningElementService from '../services/learningElements'

export const LearningElement = objectType({
  name: 'LearningElement',
  definition(t) {
    t.id('id')
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
      resolve(_, args, ctx: Context) {
        return LearningElementService.getLearningElementData(args, ctx)
      },
    })
  },
})

export const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.nonNull.field('login', {
      type: 'ID',
      args: {
        email: nonNull(stringArg()),
        password: nonNull(stringArg()),
      },
      resolve(_, args, ctx: Context) {
        return AccountService.login(args, ctx)
      },
    })
  },
})
