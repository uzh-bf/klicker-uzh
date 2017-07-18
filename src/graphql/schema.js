const graphql = require('graphql')

const { GraphQLObjectType, GraphQLString, GraphQLSchema } = graphql

const QuestionModel = require('../database/question')

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
        const question = QuestionModel.findById(args.id)
        console.dir(question)

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
