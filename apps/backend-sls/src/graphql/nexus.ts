import { nonNull, objectType, stringArg } from 'nexus'
import { Context } from '../lib/context'
import * as AccountService from '../services/accounts'

export const Query = objectType({
  name: 'Query',
  definition(t) {
    t.nonNull.field('hello', {
      type: 'String',
      resolve() {
        return 'world'
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
