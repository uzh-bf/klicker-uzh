const graphql = require('graphql')

const { GraphQLObjectType, GraphQLString, GraphQLSchema } = graphql

const QuestionType = new GraphQLObjectType({
  name: 'Question',
  fields: () => ({
    id: { type: GraphQLString },
    title: { type: GraphQLString },
  }),
})

const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    question: {
      type: QuestionType,
      args: { id: { type: GraphQLString } },
      resolve(parentValue, args) {
        return {
          id: args.id,
          title: 'Hello World',
        }
      },
    },
  },
})

module.exports = new GraphQLSchema({
  query: RootQuery,
})
