import { objectType } from 'nexus'

export const Query = objectType({
  name: 'Query',
  definition(t) {
    t.nonNull.field('hello', {
      type: 'String',
      resolve: () => 'world',
    })
  },
})

export const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.nonNull.field('hello', {
      type: 'String',
      resolve: () => 'world',
    })
  },
})
